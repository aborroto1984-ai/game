// ==========================================
// 1. GAME AUDIO (With Pool for Mobile)
// ==========================================
window.gameAudio = (function () {
    let musicEl = null;
    let currentMusicSrc = null;
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
        if (currentMusicSrc === src && musicEl && !musicEl.paused) return;
        if (musicEl) { musicEl.pause(); }
        musicEl = new Audio(src);
        musicEl.loop = true;
        musicEl.volume = volume ?? 0.5;
        currentMusicSrc = src;
        musicEl.play().catch(() => { armUnlockRetry(); });
    }

    function stopMusic() {
        if (musicEl) { musicEl.pause(); }
        musicEl = null;
        currentMusicSrc = null;
    }

    function pauseMusic() {
        if (musicEl) musicEl.pause();
    }

    function resumeMusic() {
        if (musicEl) musicEl.play().catch(() => { armUnlockRetry(); });
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

    return { playMusic, stopMusic, pauseMusic, resumeMusic, playSfx };
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
    let textures = {};

    const playerBullets = new Map();
    const enemyBullets = new Map();
    const enemies = new Map();
    const farmItems = new Map();
    const coinMap = new Map();
    const powerupMap = new Map();
    const explosionMap = new Map();

    const bulletPool = [];
    const itemKeys = ["cow", "chicken", "tractor", "truck", "corn", "pumpkin", "wife"];
    const powerupKeys = ["rapid", "wide", "shield", "life", "flame"];
    const enemyTypes = ["Fighter", "Thief", "Elite", "Boss"];

    const itemBaseWidths = {
        chicken: 50,
        corn: 28,
        pumpkin: 30,
        cow: 60,
        wife: 36,
        truck: 80,
        tractor: 70
    };

    let playerBulletContext = null;
    let flameBulletContext = null;
    let enemyBulletContext = null;

    async function init(canvas, options) {
        config = options;
        app = new PIXI.Application();

        const stageScale = parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--game-scale')
        ) || 1;

        // Cap mobile render resolution to 1.0 to eliminate Mobile Safari GPU fill-rate lag
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const pixelRatio = window.devicePixelRatio || 1;
        const renderResolution = isMobile ? 1.0 : Math.min(pixelRatio * stageScale, 1.5);

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
        farmer.width = 51;
        farmer.height = 114;
        playerLayer.addChild(farmer);
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

        const beam = new PIXI.Sprite(textures.beamColumn);
        beam.anchor.set(0.5, 0);
        beam.visible = false;
        root.addChild(beam);

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
            node.sprite.width = 150;
            node.sprite.height = 100;
            node.hp.text = data.hp + "/" + data.maxHp;
            node.hp.y = -62;
        } else {
            const targetWidth = 54;
            const ratio = node.sprite.texture.height / node.sprite.texture.width || 1;
            node.sprite.width = targetWidth;
            node.sprite.height = targetWidth * ratio;

            node.hp.text = String(data.hp);
            node.hp.y = -35;
        }

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

            if (data.targetItemId && textures.items[data.targetItemId]) {
                node.risingItem.visible = true;
                const tex = textures.items[data.targetItemId];
                node.risingItem.texture = tex;

                const targetWidth = (itemBaseWidths[data.targetItemId] || 36) * 0.85;
                const ratio = (tex.height && tex.width) ? (tex.height / tex.width) : 1;
                node.risingItem.width = targetWidth;
                node.risingItem.height = targetWidth * ratio;

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

    function syncFlat(buf, totalLen) {
        if (!ready || !buf || totalLen === 0) return;

        let ptr = 0;

        // 1. Farmer
        const farmerX = buf[ptr++];
        const farmerY = buf[ptr++];
        const flameOn = buf[ptr++] === 1;
        const flashOn = buf[ptr++] === 1;

        farmer.visible = true;
        farmer.position.set(farmerX, farmerY);
        farmer.texture = flameOn ? textures.farmerFlame : textures.farmer;
        farmer.alpha = flashOn ? 0.35 : 1;

        // 2. Bullets
        const bulletCount = buf[ptr++];
        const seenBullets = new Set();
        for (let i = 0; i < bulletCount; i++) {
            const id = String(buf[ptr++]);
            const x = buf[ptr++];
            const y = buf[ptr++];
            const isFlame = buf[ptr++] === 1;

            seenBullets.add(id);
            let b = playerBullets.get(id);
            if (!b) {
                b = createBullet(isFlame, false);
                playerBullets.set(id, b);
            }
            b.position.set(x, y);
        }
        for (const [id, b] of playerBullets) {
            if (!seenBullets.has(id)) {
                projectileLayer.removeChild(b);
                b.visible = false;
                bulletPool.push(b);
                playerBullets.delete(id);
            }
        }

        // 3. Enemy Bullets
        const enemyBulletCount = buf[ptr++];
        const seenEnemyBullets = new Set();
        for (let i = 0; i < enemyBulletCount; i++) {
            const id = String(buf[ptr++]);
            const x = buf[ptr++];
            const y = buf[ptr++];

            seenEnemyBullets.add(id);
            let b = enemyBullets.get(id);
            if (!b) {
                b = createBullet(false, true);
                enemyBullets.set(id, b);
            }
            b.position.set(x, y);
        }
        for (const [id, b] of enemyBullets) {
            if (!seenEnemyBullets.has(id)) {
                projectileLayer.removeChild(b);
                b.visible = false;
                bulletPool.push(b);
                enemyBullets.delete(id);
            }
        }

        // 4. Enemies
        const enemyCount = buf[ptr++];
        const seenEnemies = new Set();
        for (let i = 0; i < enemyCount; i++) {
            const id = String(buf[ptr++]);
            const x = buf[ptr++];
            const y = buf[ptr++];
            const hp = buf[ptr++];
            const maxHp = buf[ptr++];
            const typeIdx = buf[ptr++];
            const isBeaming = buf[ptr++] === 1;
            const targetItemIdx = buf[ptr++];
            const beamProgress = buf[ptr++];

            const typeStr = enemyTypes[typeIdx] || "Fighter";
            const targetItemId = targetItemIdx >= 0 ? itemKeys[targetItemIdx] : null;
            seenEnemies.add(id);

            let node = enemies.get(id);
            if (!node) {
                node = createEnemy({ type: typeStr });
                enemies.set(id, node);
            }

            updateEnemy(node, {
                x: x,
                y: y,
                hp: hp,
                maxHp: maxHp,
                type: typeStr,
                isBeaming: isBeaming,
                targetItemId: targetItemId,
                beamProgress: beamProgress
            });
        }
        for (const [id, node] of enemies) {
            if (!seenEnemies.has(id)) {
                enemyLayer.removeChild(node.root);
                node.root.destroy({ children: true });
                enemies.delete(id);
            }
        }

        // 5. Items
        const itemCount = buf[ptr++];
        const seenItems = new Set();
        for (let i = 0; i < itemCount; i++) {
            const itemIdx = buf[ptr++];
            const x = buf[ptr++];
            const y = buf[ptr++];
            const itemKey = itemKeys[itemIdx] || "corn";

            seenItems.add(itemKey);
            let sprite = farmItems.get(itemKey);

            if (!sprite) {
                const tex = textures.items ? textures.items[itemKey] : null;
                if (tex) {
                    sprite = new PIXI.Sprite(tex);
                    sprite.anchor.set(0.5);

                    const targetWidth = itemBaseWidths[itemKey] || 36;
                    const ratio = (tex.height && tex.width) ? (tex.height / tex.width) : 1;

                    sprite.width = targetWidth;
                    sprite.height = targetWidth * ratio;

                    itemLayer.addChild(sprite);
                    farmItems.set(itemKey, sprite);
                }
            }

            if (sprite) {
                sprite.position.set(x, y);
            }
        }
        for (const [id, sprite] of farmItems) {
            if (!seenItems.has(id)) {
                itemLayer.removeChild(sprite);
                sprite.destroy();
                farmItems.delete(id);
            }
        }

        // 6. Coins
        const coinCount = buf[ptr++];
        const seenCoins = new Set();
        for (let i = 0; i < coinCount; i++) {
            const id = String(buf[ptr++]);
            const x = buf[ptr++];
            const y = buf[ptr++];

            seenCoins.add(id);
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
            if (!seenCoins.has(id)) {
                pickupLayer.removeChild(sprite);
                sprite.destroy();
                coinMap.delete(id);
            }
        }

        // 7. Powerups
        const powerupCount = buf[ptr++];
        const seenPowerups = new Set();
        for (let i = 0; i < powerupCount; i++) {
            const id = String(buf[ptr++]);
            const keyIdx = buf[ptr++];
            const x = buf[ptr++];
            const y = buf[ptr++];
            const pKey = powerupKeys[keyIdx] || "rapid";

            seenPowerups.add(id);
            let sprite = powerupMap.get(id);
            if (!sprite) {
                const tex = textures.items ? textures.items[pKey] : null;
                if (tex) {
                    sprite = new PIXI.Sprite(tex);
                } else {
                    sprite = new PIXI.Graphics().circle(0, 0, 10).fill(0x00ffff);
                }
                sprite.anchor.set(0.5);
                sprite.width = 28;
                sprite.height = 28;
                pickupLayer.addChild(sprite);
                powerupMap.set(id, sprite);
            }
            sprite.position.set(x, y);
        }
        for (const [id, sprite] of powerupMap) {
            if (!seenPowerups.has(id)) {
                pickupLayer.removeChild(sprite);
                sprite.destroy();
                powerupMap.delete(id);
            }
        }

        // 8. Explosions
        const explosionCount = buf[ptr++];
        const seenExplosions = new Set();
        for (let i = 0; i < explosionCount; i++) {
            const id = String(buf[ptr++]);
            const x = buf[ptr++];
            const y = buf[ptr++];
            const sizeIdx = buf[ptr++];
            const progress = buf[ptr++];

            seenExplosions.add(id);
            let sprite = explosionMap.get(id);
            if (!sprite) {
                let tex = textures.exSmall;
                if (sizeIdx === 1) tex = textures.exMedium;
                if (sizeIdx === 2) tex = textures.exLarge;

                sprite = new PIXI.Sprite(tex);
                sprite.anchor.set(0.5);
                explosionLayer.addChild(sprite);
                explosionMap.set(id, sprite);
            }

            let baseWidth = 60;
            if (sizeIdx === 1) baseWidth = 100;
            if (sizeIdx === 2) baseWidth = 160;

            const ratio = (sprite.texture && sprite.texture.width > 0)
                ? (sprite.texture.height / sprite.texture.width)
                : 1;

            const scale = 0.4 + progress * 0.9;
            const targetWidth = baseWidth * scale;

            sprite.width = targetWidth;
            sprite.height = targetWidth * ratio;
            sprite.alpha = 1 - progress;
            sprite.position.set(x, y);
        }
        for (const [id, sprite] of explosionMap) {
            if (!seenExplosions.has(id)) {
                explosionLayer.removeChild(sprite);
                sprite.destroy();
                explosionMap.delete(id);
            }
        }
    }

    function clear() {
        if (!ready) return;
        enemies.forEach(node => {
            enemyLayer.removeChild(node.root);
            node.root.destroy({ children: true });
        });
        enemies.clear();

        playerBullets.forEach(b => projectileLayer.removeChild(b));
        playerBullets.clear();

        enemyBullets.forEach(b => projectileLayer.removeChild(b));
        enemyBullets.clear();

        farmer.visible = false;
    }

    return { init, sync: syncFlat, syncFlat, clear };
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