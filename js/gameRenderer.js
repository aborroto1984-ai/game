// ==========================================
// 1. GAME AUDIO (With Pool for Mobile)
// ==========================================
window.gameAudio = (function () {
    let musicEl = null;
    let currentMusicSrc = null;

    let temporaryMusicEl = null;

    let musicPaused = false;
    let unlockArmed = false;

    const POOL_SIZE = 8;
    const sfxPool = Array.from({ length: POOL_SIZE }, () => new Audio());
    let poolIndex = 0;

    function armUnlockRetry() {
        if (unlockArmed) return;
        unlockArmed = true;
        const retry = () => {
            if (musicEl && musicEl.paused) {
                musicEl.play().catch(() => { });
            }
        };
        ['pointerdown', 'keydown', 'touchstart'].forEach(evt =>
            document.addEventListener(evt, retry, { once: true })
        );
    }

    function playMusic(src, volume) {
        // A normal music change should kill any temporary track.
        if (temporaryMusicEl) {
            temporaryMusicEl.pause();
            temporaryMusicEl.currentTime = 0;
            temporaryMusicEl = null;
        }

        musicPaused = false;

        if (currentMusicSrc === src && musicEl) {
            musicEl.volume = volume ?? 0.5;

            if (musicEl.paused) {
                musicEl.play().catch(() => {
                    armUnlockRetry();
                });
            }

            return;
        }

        if (musicEl) {
            musicEl.pause();
        }

        musicEl = new Audio(src);
        musicEl.loop = true;
        musicEl.volume = volume ?? 0.5;

        currentMusicSrc = src;

        musicEl.play().catch(() => {
            armUnlockRetry();
        });
    }


    function playTemporaryMusic(src, volume, startAtSeconds = 0) {
        if (temporaryMusicEl) {
            temporaryMusicEl.pause();
            temporaryMusicEl.currentTime = 0;
        }

        // Pause the normal gameplay music without losing its position.
        if (musicEl && !musicEl.paused) {
            musicEl.pause();
        }

        const tempAudio = new Audio(src);

        tempAudio.loop = true;
        tempAudio.volume = volume ?? 0.7;

        temporaryMusicEl = tempAudio;

        const startPlayback = () => {
            // Make sure this is still the active temporary track.
            if (temporaryMusicEl !== tempAudio) {
                return;
            }

            if (startAtSeconds > 0) {
                tempAudio.currentTime = startAtSeconds;
            }

            if (!musicPaused) {
                tempAudio.play().catch(() => {
                    armUnlockRetry();
                });
            }
        };

        // We need metadata loaded before reliably seeking.
        if (tempAudio.readyState >= 1) {
            startPlayback();
        }
        else {
            tempAudio.addEventListener(
                "loadedmetadata",
                startPlayback,
                { once: true }
            );

            tempAudio.load();
        }
    }


    function stopTemporaryMusic() {
        if (temporaryMusicEl) {
            temporaryMusicEl.pause();
            temporaryMusicEl.currentTime = 0;
            temporaryMusicEl = null;
        }

        // Resume the original background song
        // from exactly where it was paused.
        if (musicEl && !musicPaused) {
            musicEl.play().catch(() => {
                armUnlockRetry();
            });
        }
    }


    function stopMusic() {
        if (musicEl) {
            musicEl.pause();
            musicEl.currentTime = 0;
        }

        if (temporaryMusicEl) {
            temporaryMusicEl.pause();
            temporaryMusicEl.currentTime = 0;
        }

        musicEl = null;
        temporaryMusicEl = null;
        currentMusicSrc = null;
        musicPaused = false;
    }


    function pauseMusic() {
        musicPaused = true;

        if (musicEl) {
            musicEl.pause();
        }

        if (temporaryMusicEl) {
            temporaryMusicEl.pause();
        }
    }


    function resumeMusic() {
        musicPaused = false;

        // Rage music takes priority if it exists.
        if (temporaryMusicEl) {
            temporaryMusicEl.play().catch(() => {
                armUnlockRetry();
            });
        }
        else if (musicEl) {
            musicEl.play().catch(() => {
                armUnlockRetry();
            });
        }
    }

    function playSfx(src, volume) {
        const audio = sfxPool[poolIndex];
        poolIndex = (poolIndex + 1) % POOL_SIZE;

        audio.pause();
        audio.currentTime = 0;
        audio.src = src;
        audio.volume = volume ?? 0.7;
        audio.play().catch(() => { });
    }

    return {
        playMusic,
        playTemporaryMusic,
        stopTemporaryMusic,
        stopMusic,
        pauseMusic,
        resumeMusic,
        playSfx
    };
})();


// ==========================================
// 2. PIXI RENDERER (Optimized for Mobile)
// ==========================================
window.alienFarmPixi = (function () {
    let app = null;
    let ready = false;
    let config = null;

    let itemLayer = null;
    let enemyLayer = null;
    let projectileLayer = null;
    let pickupLayer = null;
    let explosionLayer = null;
    let playerLayer = null;

    let farmer = null;
    let wobble = null;

    let textures = {};

    const wobbleShots = new Map();
    const wobbleEggs = new Map();
    const wobbleEggBlasts = new Map();

    const playerBullets = new Map();
    const enemyBullets = new Map();
    const enemies = new Map();
    const farmItems = new Map();
    const coinMap = new Map();
    const powerupMap = new Map();
    const explosionMap = new Map();

    const bulletPool = [];
    const enemyTypes = ["Fighter", "Thief", "Elite", "Boss"];

    let playerBulletContext = null;
    let flameBulletContext = null;
    let enemyBulletContext = null;

    async function init(canvas, options) {
        config = options;
        app = new PIXI.Application();

        const stageScale = parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--game-scale')
        ) || 1;

        const pixelRatio = window.devicePixelRatio || 1;
        const renderResolution = Math.min(pixelRatio * stageScale, 1.5);

        await app.init({
            canvas: canvas,
            width: options.width,
            height: options.height,
            backgroundAlpha: 0,
            antialias: false,
            preference: "webgl",
            resolution: renderResolution,
            autoDensity: true
        });

        await loadTextures(options.assets);

        itemLayer = new PIXI.Container();
        enemyLayer = new PIXI.Container();
        projectileLayer = new PIXI.Container();
        pickupLayer = new PIXI.Container();
        explosionLayer = new PIXI.Container();
        playerLayer = new PIXI.Container();

        app.stage.addChild(itemLayer, enemyLayer, projectileLayer, pickupLayer, explosionLayer, playerLayer);

        createSharedBulletGeometry();

        createWobble();
        createFarmer();

        ready = true;
    }

    async function loadTextures(assets) {
        const urls = new Set();
        function collect(value) {
            if (!value) return;
            if (typeof value === "string") { urls.add(value); return; }
            if (typeof value === "object") Object.values(value).forEach(collect);
        }
        collect(assets);

        urls.add("images/fx_small_explosion.png");
        urls.add("images/fx_medium_explosion.png");
        urls.add("images/fx_large_explosion.png");

        const loaded = await PIXI.Assets.load([...urls]);
        function texture(path) { return loaded[path]; }

        textures = {
            farmer: texture(assets.farmer),
            farmerFlame: texture(assets.farmerFlame),

            wobbleStanding: texture(assets.wobbleStanding),
            wobbleLeftLeg: texture(assets.wobbleLeftLeg),
            wobbleRightLeg: texture(assets.wobbleRightLeg),

            wobbleStandingRage: texture(assets.wobbleStandingRage),
            wobbleLeftLegRage: texture(assets.wobbleLeftLegRage),
            wobbleRightLegRage: texture(assets.wobbleRightLegRage),

            wobbleKernel: texture(assets.wobbleKernel),
            wobbleEgg: texture(assets.wobbleEgg),
            wobbleEggExplosion: texture(assets.wobbleEggExplosion),

            ufoFighter: texture(assets.ufoFighter),
            ufoThief: texture(assets.ufoThief),
            ufoElite: texture(assets.ufoElite),
            ufoBoss: texture(assets.ufoBoss),

            beamColumn: texture(assets.beamColumn),

            exSmall: texture("images/fx_small_explosion.png"),
            exMedium: texture("images/fx_medium_explosion.png"),
            exLarge: texture("images/fx_large_explosion.png"),

            items: {}
        };

        for (const [key, path] of Object.entries(assets.items)) {
            textures.items[key] = texture(path);
        }
    }

    function createSharedBulletGeometry() {
        playerBulletContext = new PIXI.GraphicsContext().circle(0, 0, 5).fill(0xffe36b);
        flameBulletContext = new PIXI.GraphicsContext().circle(0, 0, 6.5).fill(0xff8a2e);
        enemyBulletContext = new PIXI.GraphicsContext().circle(0, 0, 5).fill(0x8bff6b);
    }

    function createFarmer() {
        farmer = new PIXI.Sprite(textures.farmer);
        farmer.anchor.set(0.5);
        farmer.width = 51;   // 34 * 1.5
        farmer.height = 114; // 76 * 1.5
        playerLayer.addChild(farmer);
    }

    function createWobble() {
        wobble = new PIXI.Sprite(
            textures.wobbleStanding
        );

        // Bottom-center anchor keeps his feet planted while textures change.
        wobble.anchor.set(0.5, 1);

        const targetWidth = 58;

        const ratio =
            wobble.texture.height /
            wobble.texture.width || 1;

        wobble.width = targetWidth;
        wobble.height = targetWidth * ratio;

        playerLayer.addChild(wobble);
    }

    function getWobbleTexture(frame, rage) {
        if (rage) {
            switch (frame) {
                case 1:
                    return textures.wobbleLeftLegRage;

                case 2:
                    return textures.wobbleRightLegRage;

                default:
                    return textures.wobbleStandingRage;
            }
        }

        switch (frame) {
            case 1:
                return textures.wobbleLeftLeg;

            case 2:
                return textures.wobbleRightLeg;

            default:
                return textures.wobbleStanding;
        }
    }

    function syncWobble(data) {
        if (!wobble) return;

        if (!data) {
            wobble.visible = false;
            return;
        }

        wobble.visible = true;

        wobble.position.set(
            data.x,
            data.y
        );

        wobble.texture =
            getWobbleTexture(
                data.frame,
                data.rage
            );

        // Slightly larger when raging.
        const targetWidth =
            data.rage
                ? 62
                : 58;

        const ratio =
            wobble.texture.height /
            wobble.texture.width || 1;

        wobble.width = targetWidth;
        wobble.height =
            targetWidth * ratio;
    }

    function enemyTexture(type) {
        switch (type) {
            case "Thief": return textures.ufoThief;
            case "Elite": return textures.ufoElite;
            case "Boss": return textures.ufoBoss;
            default: return textures.ufoFighter;
        }
    }

    function createEnemy(data) {
        const root = new PIXI.Container();

        // Tractor beam sprite
        const beam = new PIXI.Sprite(textures.beamColumn);
        beam.anchor.set(0.5, 0);
        beam.visible = false;
        root.addChild(beam);

        // Rising stolen item sprite (inside beam)
        const risingItem = new PIXI.Sprite();
        risingItem.anchor.set(0.5);
        risingItem.width = 28;
        risingItem.height = 28;
        risingItem.visible = false;
        root.addChild(risingItem);

        const sprite = new PIXI.Sprite(enemyTexture(data.type));
        sprite.anchor.set(0.5);
        root.addChild(sprite);

        const hp = new PIXI.Text({
            text: "",
            style: { fontFamily: "Arial", fontSize: 11, fontWeight: "700", fill: 0xffffff }
        });
        hp.anchor.set(0.5);
        root.addChild(hp);

        enemyLayer.addChild(root);

        return { root, sprite, hp, beam, risingItem, type: data.type };
    }

    function updateEnemy(node, data) {
        node.root.position.set(data.x, data.y);

        if (node.type !== data.type) {
            node.type = data.type;
            node.sprite.texture = enemyTexture(data.type);
        }

        if (data.type === "Boss") {
            const targetWidth = 150;

            const ratio =
                node.sprite.texture.height /
                node.sprite.texture.width || 1;

            node.sprite.width =
                targetWidth;

            node.sprite.height =
                targetWidth * ratio;

            node.hp.text =
                data.hp +
                "/" +
                data.maxHp;

            node.hp.y =
                -(node.sprite.height / 2) -
                14;
        }
        else {
            const targetWidth = 54;
            const ratio = node.sprite.texture.height / node.sprite.texture.width || 1;
            node.sprite.width = targetWidth;
            node.sprite.height = targetWidth * ratio;

            node.hp.text = String(data.hp);
            node.hp.y = -35;
        }

        // --- Tractor Beam & Rising Stolen Item ---
        if (data.isBeaming) {
            const beamStartY = 25;
            node.beam.visible = true;
            node.beam.x = 0;
            node.beam.y = beamStartY;
            node.beam.width = 80;

            const totalBeamHeight = config.itemFieldY - data.y - beamStartY;
            node.beam.height = Math.max(0, totalBeamHeight);

            const pulse = (Math.sin(performance.now() / 110) + 1) / 2;
            node.beam.alpha = 0.7 + pulse * 0.3;

            // Render Stolen Item Rising Up Beam
            if (data.targetItemId && textures.items[data.targetItemId]) {
                node.risingItem.visible = true;
                const tex = textures.items[data.targetItemId];
                node.risingItem.texture = tex;

                // Apply independent sizing & aspect ratio to the rising item
                const targetWidth = (itemBaseWidths[data.targetItemId] || 36) * 0.85; // Slightly shrink on beam
                const ratio = (tex.height && tex.width) ? (tex.height / tex.width) : 1;
                node.risingItem.width = targetWidth;
                node.risingItem.height = targetWidth * ratio;

                // Quadratic ease curve so the item accelerates upwards into the ship
                const easedProgress = data.beamProgress * data.beamProgress;
                const currentOffsetY = totalBeamHeight * (1 - easedProgress);

                node.risingItem.x = 0;
                node.risingItem.y = beamStartY + currentOffsetY;
            } else {
                node.risingItem.visible = false;
            }
        } else {
            node.beam.visible = false;
            node.risingItem.visible = false;
        }
    }

    function createBullet(isFlame, isEnemy) {
        let context = isEnemy ? enemyBulletContext : (isFlame ? flameBulletContext : playerBulletContext);

        let bullet = bulletPool.pop();
        if (!bullet) {
            bullet = new PIXI.Graphics(context);
        } else {
            bullet.context = context;
            bullet.visible = true;
        }

        projectileLayer.addChild(bullet);
        return bullet;
    }

    function syncBulletsFlat(map, list, isEnemy) {
        if (!list) return;
        const seen = new Set();
        const stride = isEnemy ? 3 : 4;

        for (let i = 0; i < list.length; i += stride) {
            const id = String(list[i]);
            const x = list[i + 1];
            const y = list[i + 2];
            const isFlame = !isEnemy && list[i + 3] === 1;

            seen.add(id);

            let bullet = map.get(id);
            if (!bullet) {
                bullet = createBullet(isFlame, isEnemy);
                map.set(id, bullet);
            }

            bullet.position.set(x, y);
        }

        for (const [id, bullet] of map) {
            if (!seen.has(id)) {
                projectileLayer.removeChild(bullet);
                bullet.visible = false;
                bulletPool.push(bullet);
                map.delete(id);
            }
        }
    }

    function syncEnemies(list) {
        if (!list || !Array.isArray(list)) return;
        const seen = new Set();

        for (const en of list) {
            const id = String(en.id);
            const typeStr = enemyTypes[en.type] || "Fighter";

            seen.add(id);

            let node = enemies.get(id);
            if (!node) {
                node = createEnemy({ type: typeStr });
                enemies.set(id, node);
            }

            updateEnemy(node, {
                x: en.x,
                y: en.y,
                hp: en.hp,
                maxHp: en.maxHp,
                type: typeStr,
                isBeaming: en.isBeaming,
                targetItemId: en.targetItemId,
                beamProgress: en.beamProgress || 0
            });
        }

        for (const [id, node] of enemies) {
            if (!seen.has(id)) {
                enemyLayer.removeChild(node.root);
                node.root.destroy({ children: true });
                enemies.delete(id);
            }
        }
    }

    // Custom base sizes (width in pixels) for each item
    const itemBaseWidths = {
        chicken: 50,
        corn: 28,
        pumpkin: 30,
        cow: 60,
        wife: 36,
        truck: 80,
        tractor: 70
    };

    function syncItems(list) {
        if (!list || !Array.isArray(list)) return;
        const seen = new Set();

        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item || !item.id) continue;

            seen.add(item.id);
            let sprite = farmItems.get(item.id);

            if (!sprite) {
                const tex = textures.items ? textures.items[item.id] : null;
                if (tex) {
                    sprite = new PIXI.Sprite(tex);
                    sprite.anchor.set(0.5);

                    // Look up custom target width, defaulting to 36 if unlisted
                    const targetWidth = itemBaseWidths[item.id] || 36;
                    const ratio = (tex.height && tex.width) ? (tex.height / tex.width) : 1;

                    sprite.width = targetWidth;
                    sprite.height = targetWidth * ratio; // Maintains true aspect ratio

                    itemLayer.addChild(sprite);
                    farmItems.set(item.id, sprite);
                }
            }

            if (sprite) {
                sprite.position.set(item.x, item.y);
            }
        }

        for (const [id, sprite] of farmItems) {
            if (!seen.has(id)) {
                itemLayer.removeChild(sprite);
                sprite.destroy();
                farmItems.delete(id);
            }
        }
    }

    function syncCoinsFlat(list) {
        if (!list) return;
        const seen = new Set();
        const stride = 3;

        for (let i = 0; i < list.length; i += stride) {
            const id = String(list[i]);
            const x = list[i + 1];
            const y = list[i + 2];

            seen.add(id);

            let sprite = coinMap.get(id);
            if (!sprite) {
                const tex = textures.items ? textures.items["coin"] : null;
                if (tex) {
                    sprite = new PIXI.Sprite(tex);
                } else {
                    sprite = new PIXI.Graphics().circle(0, 0, 8).fill(0xffd700);
                }
                sprite.anchor.set(0.5);
                sprite.width = 22;
                sprite.height = 22;
                pickupLayer.addChild(sprite);
                coinMap.set(id, sprite);
            }

            sprite.position.set(x, y);
        }

        for (const [id, sprite] of coinMap) {
            if (!seen.has(id)) {
                pickupLayer.removeChild(sprite);
                sprite.destroy();
                coinMap.delete(id);
            }
        }
    }

    function syncPowerups(list) {
        if (!list || !Array.isArray(list)) return;
        const seen = new Set();

        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            if (!p || !p.id) continue;

            seen.add(p.id);
            let sprite = powerupMap.get(p.id);

            if (!sprite) {
                const tex = textures.items ? textures.items[p.key] : null;
                if (tex) {
                    sprite = new PIXI.Sprite(tex);
                } else {
                    sprite = new PIXI.Graphics().circle(0, 0, 10).fill(0x00ffff);
                }
                sprite.anchor.set(0.5);
                sprite.width = 28;
                sprite.height = 28;
                pickupLayer.addChild(sprite);
                powerupMap.set(p.id, sprite);
            }

            sprite.position.set(p.x, p.y);
        }

        for (const [id, sprite] of powerupMap) {
            if (!seen.has(id)) {
                pickupLayer.removeChild(sprite);
                sprite.destroy();
                powerupMap.delete(id);
            }
        }
    }

    function syncExplosionsFlat(list) {
        if (!list) return;
        const seen = new Set();
        const stride = 5; // [id, x, y, sizeIndex, progress]

        for (let i = 0; i < list.length; i += stride) {
            const id = String(list[i]);
            const x = list[i + 1];
            const y = list[i + 2];
            const sizeIndex = list[i + 3];
            const progress = list[i + 4];

            seen.add(id);

            let sprite = explosionMap.get(id);
            if (!sprite) {
                let tex = textures.exSmall;
                if (sizeIndex === 1) tex = textures.exMedium;
                if (sizeIndex === 2) tex = textures.exLarge;

                sprite = new PIXI.Sprite(tex);
                sprite.anchor.set(0.5);
                explosionLayer.addChild(sprite);
                explosionMap.set(id, sprite);
            }

            let baseWidth = 60;
            if (sizeIndex === 1) baseWidth = 100;
            if (sizeIndex === 2) baseWidth = 160;

            // Preserve native aspect ratio so sprites don't get squished or stretched
            const ratio = (sprite.texture && sprite.texture.width > 0)
                ? (sprite.texture.height / sprite.texture.width)
                : 1;

            const scale = 0.4 + progress * 0.9;
            const targetWidth = baseWidth * scale;

            sprite.width = targetWidth;
            sprite.height = targetWidth * ratio; // Proportional height
            sprite.alpha = 1 - progress;
            sprite.position.set(x, y);
        }

        for (const [id, sprite] of explosionMap) {
            if (!seen.has(id)) {
                explosionLayer.removeChild(sprite);
                sprite.destroy();
                explosionMap.delete(id);
            }
        }
    }

    function syncWobbleShots(list) {
        if (!list) return;

        const seen = new Set();
        const stride = 3;

        for (let i = 0; i < list.length; i += stride) {
            const id = String(list[i]);
            const x = list[i + 1];
            const y = list[i + 2];

            seen.add(id);

            let sprite = wobbleShots.get(id);

            if (!sprite) {
                sprite =
                    new PIXI.Sprite(
                        textures.wobbleKernel
                    );

                sprite.anchor.set(0.5);

                const targetWidth = 12;

                const ratio =
                    sprite.texture.height /
                    sprite.texture.width || 1;

                sprite.width = targetWidth;
                sprite.height =
                    targetWidth * ratio;

                projectileLayer.addChild(sprite);

                wobbleShots.set(
                    id,
                    sprite
                );
            }

            sprite.position.set(x, y);
        }

        for (const [id, sprite] of wobbleShots) {
            if (!seen.has(id)) {
                projectileLayer.removeChild(sprite);
                sprite.destroy();

                wobbleShots.delete(id);
            }
        }
    }

    function syncWobbleEggs(list) {
        if (!list) return;

        const seen = new Set();
        const stride = 4;

        for (let i = 0; i < list.length; i += stride) {
            const id = String(list[i]);
            const x = list[i + 1];
            const y = list[i + 2];
            const rotation = list[i + 3];

            seen.add(id);

            let sprite = wobbleEggs.get(id);

            if (!sprite) {
                sprite = new PIXI.Sprite(
                    textures.wobbleEgg
                );

                sprite.anchor.set(0.5);

                const targetWidth = 22;

                const ratio =
                    sprite.texture.height /
                    sprite.texture.width || 1;

                sprite.width = targetWidth;
                sprite.height =
                    targetWidth * ratio;

                projectileLayer.addChild(sprite);

                wobbleEggs.set(
                    id,
                    sprite
                );
            }

            sprite.position.set(x, y);
            sprite.rotation = rotation;
        }

        for (const [id, sprite] of wobbleEggs) {
            if (!seen.has(id)) {
                projectileLayer.removeChild(sprite);
                sprite.destroy();

                wobbleEggs.delete(id);
            }
        }
    }


    function syncWobbleEggBlasts(list) {
        if (!list) return;

        const seen = new Set();
        const stride = 4;

        for (let i = 0; i < list.length; i += stride) {
            const id = String(list[i]);
            const x = list[i + 1];
            const y = list[i + 2];
            const progress = list[i + 3];

            seen.add(id);

            let sprite =
                wobbleEggBlasts.get(id);

            if (!sprite) {
                sprite = new PIXI.Sprite(
                    textures.wobbleEggExplosion
                );

                sprite.anchor.set(0.5);

                explosionLayer.addChild(sprite);

                wobbleEggBlasts.set(
                    id,
                    sprite
                );
            }

            const baseWidth = 110;

            const scale =
                0.45 +
                progress * 0.75;

            const targetWidth =
                baseWidth * scale;

            const ratio =
                sprite.texture.height /
                sprite.texture.width || 1;

            sprite.width = targetWidth;
            sprite.height =
                targetWidth * ratio;

            sprite.alpha =
                1 - progress;

            sprite.position.set(
                x,
                y
            );
        }

        for (const [id, sprite] of wobbleEggBlasts) {
            if (!seen.has(id)) {
                explosionLayer.removeChild(sprite);
                sprite.destroy();

                wobbleEggBlasts.delete(id);
            }
        }
    }

    function sync(frame) {
        if (!ready || !frame) return;

        // -----------------------------
        // Ted
        // -----------------------------
        if (frame.farmer) {
            farmer.visible = true;

            farmer.position.set(
                frame.farmer.x,
                frame.farmer.y
            );

            farmer.texture =
                frame.farmer.flame
                    ? textures.farmerFlame
                    : textures.farmer;

            farmer.alpha =
                frame.farmer.flash
                    ? 0.35
                    : 1;
        }
        else {
            farmer.visible = false;
        }

        // -----------------------------
        // Wobble
        // -----------------------------
        syncWobble(frame.wobble);

        syncWobbleShots(
            frame.wobbleShots
        );

        syncWobbleEggs(
            frame.wobbleEggs
        );

        syncWobbleEggBlasts(
            frame.wobbleEggBlasts
        );

        // -----------------------------
        // Existing game entities
        // -----------------------------
        syncBulletsFlat(
            playerBullets,
            frame.bullets,
            false
        );

        syncBulletsFlat(
            enemyBullets,
            frame.enemyBullets,
            true
        );

        syncEnemies(frame.enemies);
        syncItems(frame.items);
        syncCoinsFlat(frame.coins);
        syncPowerups(frame.powerups);
        syncExplosionsFlat(frame.explosions);
    }

    function clear() {
        if (!ready) return;

        // -----------------------------
        // Enemies
        // -----------------------------
        enemies.forEach(node => {
            enemyLayer.removeChild(node.root);

            node.root.destroy({
                children: true
            });
        });

        enemies.clear();

        // -----------------------------
        // Ted bullets
        // -----------------------------
        playerBullets.forEach(b => {
            projectileLayer.removeChild(b);
        });

        playerBullets.clear();

        // -----------------------------
        // Enemy bullets
        // -----------------------------
        enemyBullets.forEach(b => {
            projectileLayer.removeChild(b);
        });

        enemyBullets.clear();

        // -----------------------------
        // Wobble kernels
        // -----------------------------
        wobbleShots.forEach(sprite => {
            projectileLayer.removeChild(sprite);
            sprite.destroy();
        });

        wobbleShots.clear();

        // -----------------------------
        // Wobble eggs
        // -----------------------------
        wobbleEggs.forEach(sprite => {
            projectileLayer.removeChild(sprite);
            sprite.destroy();
        });

        wobbleEggs.clear();

        // -----------------------------
        // Wobble egg explosions
        // -----------------------------
        wobbleEggBlasts.forEach(sprite => {
            explosionLayer.removeChild(sprite);
            sprite.destroy();
        });

        wobbleEggBlasts.clear();

        // -----------------------------
        // Players
        // -----------------------------
        farmer.visible = false;

        if (wobble) {
            wobble.visible = false;
        }
    }

    return { init, sync, clear };
})();


// ==========================================
// 3. GAME SCALE UTILITY
// ==========================================
window.gameScale = (function () {
    const NATIVE_W = 480, NATIVE_H = 840;
    const MAX_SCALE = 1.5;

    function apply() {
        const scale = Math.min(
            window.innerWidth / NATIVE_W,
            window.innerHeight / NATIVE_H,
            MAX_SCALE
        );
        document.documentElement.style.setProperty('--game-scale', scale);
    }

    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    apply();

    return { apply };
})();