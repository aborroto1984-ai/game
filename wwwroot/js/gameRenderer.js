// ==========================================
// 1. GAME AUDIO (With Pool for Mobile)
// ==========================================
window.gameAudio = (function () {
    let musicEl = null;
    let currentMusicSrc = null;

    let temporaryMusicEl = null;

    let musicPaused = false;
    let unlockArmed = false;

    // ------------------------------------------
    // Web Audio SFX
    // ------------------------------------------

    let sfxContext = null;

    const sfxBuffers =
        new Map();

    const sfxLoads =
        new Map();

    function getSfxContext() {
        const AudioContextType =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContextType) {
            return null;
        }

        if (!sfxContext) {
            sfxContext =
                new AudioContextType({
                    latencyHint: "interactive"
                });
        }

        return sfxContext;
    }

    async function loadSfx(src) {
        if (sfxBuffers.has(src)) {
            return sfxBuffers.get(src);
        }

        if (sfxLoads.has(src)) {
            return sfxLoads.get(src);
        }

        const loadPromise =
            (async () => {
                const context =
                    getSfxContext();

                if (!context) {
                    return null;
                }

                const response =
                    await fetch(
                        src,
                        {
                            cache: "force-cache"
                        }
                    );

                if (!response.ok) {
                    throw new Error(
                        `Could not load SFX: ${src}`
                    );
                }

                const data =
                    await response.arrayBuffer();

                const buffer =
                    await context.decodeAudioData(
                        data
                    );

                sfxBuffers.set(
                    src,
                    buffer
                );

                return buffer;
            })();

        sfxLoads.set(
            src,
            loadPromise
        );

        try {
            return await loadPromise;
        }
        finally {
            sfxLoads.delete(src);
        }
    }

    async function preloadSfx(sources) {
        if (!sources) {
            return;
        }

        await Promise.allSettled(
            sources.map(
                src => loadSfx(src)
            )
        );
    }

    function unlockSfxContext() {
        const context =
            getSfxContext();

        if (
            context &&
            context.state === "suspended"
        ) {
            context
                .resume()
                .catch(() => { });
        }
    }

    // iPhone/WebKit requires audio to be unlocked
    // from a user interaction.
    [
        "pointerdown",
        "touchstart",
        "keydown"
    ].forEach(eventName => {
        document.addEventListener(
            eventName,
            unlockSfxContext,
            {
                passive: true
            }
        );
    });

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

    function playSfx(src, volume
    ) {
        const context =
            getSfxContext();

        if (!context) {
            return;
        }

        if (
            context.state ===
            "suspended"
        ) {
            context
                .resume()
                .catch(() => { });
        }

        const playBuffer =
            buffer => {
                if (!buffer) {
                    return;
                }

                const source =
                    context
                        .createBufferSource();

                const gain =
                    context
                        .createGain();

                source.buffer =
                    buffer;

                gain.gain.value =
                    Math.max(
                        0,
                        Math.min(
                            1,
                            volume ?? 0.7
                        )
                    );

                source.connect(gain);
                gain.connect(
                    context.destination
                );

                source.onended =
                    () => {
                        source.disconnect();
                        gain.disconnect();
                    };

                source.start(0);
            };

        const buffer =
            sfxBuffers.get(src);

        if (buffer) {
            playBuffer(buffer);
            return;
        }

        // Safety fallback if a sound was not preloaded.
        loadSfx(src)
            .then(playBuffer)
            .catch(() => { });
    }

    return {
        playMusic,
        playTemporaryMusic,
        stopTemporaryMusic,
        stopMusic,
        pauseMusic,
        resumeMusic,
        preloadSfx,
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

    // Latest player pointer position stays entirely
    // on the JavaScript side until the next existing
    // Pixi sync call.
    let inputSurface = null;
    let pendingPlayerTargetX = null;

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
    const bomberBlasts = new Map();

    const enemyTypes = [
        "Fighter",
        "Thief",
        "Elite",
        "Boss",
        "Interceptor",
        "Bomber"
    ];

    let enemyBulletContext = null;

    function handlePlayerPointer(event) {
        if (!config || !inputSurface) {
            return;
        }

        // Ignore menus, pause screen, and actual buttons.
        // We only want gameplay movement.
        const target = event.target;

        if (
            target instanceof Element &&
            target.closest(".overlay, button")
        ) {
            return;
        }

        const rect =
            inputSurface.getBoundingClientRect();

        if (rect.width <= 0) {
            return;
        }

        // Convert browser/CSS coordinates back into
        // the game's native 480px coordinate system.
        const gameX =
            (event.clientX - rect.left) *
            (config.width / rect.width);

        pendingPlayerTargetX =
            Math.max(
                24,
                Math.min(
                    config.width - 24,
                    gameX
                )
            );
    }

    function resetPlayerInput() {
        pendingPlayerTargetX = null;
    }

    async function init(canvas, options) {
        config = options;
        app = new PIXI.Application();

        const stageScale = parseFloat(
            getComputedStyle(document.documentElement)
                .getPropertyValue('--game-scale')
        ) || 1;

        const pixelRatio =
            window.devicePixelRatio || 1;

        const renderResolution =
            Math.min(
                pixelRatio * stageScale,
                1.5
            );

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

        await loadTextures(
            options.assets
        );

        itemLayer =
            new PIXI.Container();

        enemyLayer =
            new PIXI.Container();

        projectileLayer =
            new PIXI.Container();

        pickupLayer =
            new PIXI.Container();

        explosionLayer =
            new PIXI.Container();

        playerLayer =
            new PIXI.Container();

        app.stage.addChild(
            itemLayer,
            enemyLayer,
            projectileLayer,
            pickupLayer,
            explosionLayer,
            playerLayer
        );

        createSharedBulletGeometry();

        createWobble();
        createFarmer();

        // Listen on the stage rather than the canvas itself.
        // This preserves movement even when the transparent
        // mobile touch-control elements are above the canvas.
        inputSurface =
            canvas.parentElement ||
            canvas;

        inputSurface.addEventListener(
            "pointerdown",
            handlePlayerPointer,
            {
                passive: true
            }
        );

        inputSurface.addEventListener(
            "pointermove",
            handlePlayerPointer,
            {
                passive: true
            }
        );

        // Smooth enemy movement at the browser/display
        // refresh rate instead of snapping to each
        // C# -> JS snapshot.
        app.ticker.add(
            updateEnemyInterpolation
        );

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

            tedBullet: texture(assets.tedBullet),
            tedFlameBurst: texture(assets.tedFlameBurst),

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

            ufoInterceptor: texture(assets.ufoInterceptor),
            ufoBomber: texture(assets.ufoBomber),

            ufoBossScout: texture(assets.ufoBossScout),
            ufoBossHarvester: texture(assets.ufoBossHarvester),
            ufoBossWar: texture(assets.ufoBossWar),

            interceptorShot: texture(assets.interceptorShot),
            bomberBomb: texture(assets.bomberBomb),
            bomberBlast: texture(assets.bomberBlast),
            harvesterBeamEmitter: texture(assets.harvesterBeamEmitter),
            warMothershipShot: texture(assets.warMothershipShot),

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
        enemyBulletContext =
            new PIXI.GraphicsContext()
                .circle(0, 0, 6)
                .fill(0x8bff6b);
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

    function enemyTexture(type, bossVariant = 0) {
        switch (type) {
            case "Thief":
                return textures.ufoThief;

            case "Elite":
                return textures.ufoElite;

            case "Interceptor":
                return textures.ufoInterceptor;

            case "Bomber":
                return textures.ufoBomber;

            case "Boss":
                if (bossVariant === 1)
                    return textures.ufoBossHarvester;

                if (bossVariant === 2)
                    return textures.ufoBossWar;

                return textures.ufoBossScout;

            default:
                return textures.ufoFighter;
        }
    }

    const ENEMY_INTERPOLATION_MS = 34;

    function updateEnemyInterpolation() {
        const now = performance.now();

        for (const node of enemies.values()) {
            const motion = node.motion;

            if (!motion) {
                continue;
            }

            const progress =
                Math.min(
                    1,
                    (now - motion.startedAt) /
                    ENEMY_INTERPOLATION_MS
                );

            node.root.position.set(
                motion.fromX +
                (motion.toX - motion.fromX) *
                progress,

                motion.fromY +
                (motion.toY - motion.fromY) *
                progress
            );
        }
    }

    function createEnemy(data) {
        const root = new PIXI.Container();

        // Regular Thief tractor beam.
        const beam = new PIXI.Sprite(textures.beamColumn);
        beam.anchor.set(0.5, 0);
        beam.visible = false;
        root.addChild(beam);

        // Harvester mothership beam.
        const harvesterBeam = new PIXI.Sprite(
            textures.harvesterBeamEmitter
        );
        harvesterBeam.anchor.set(0.5, 0);
        harvesterBeam.visible = false;
        root.addChild(harvesterBeam);

        // Rising stolen item sprite.
        const risingItem = new PIXI.Sprite();
        risingItem.anchor.set(0.5);
        risingItem.width = 28;
        risingItem.height = 28;
        risingItem.visible = false;
        root.addChild(risingItem);

        const bossVariant = data.bossVariant || 0;

        const sprite = new PIXI.Sprite(
            enemyTexture(data.type, bossVariant)
        );
        sprite.anchor.set(0.5);
        root.addChild(sprite);

        const hp = new PIXI.Text({
            text: "",
            style: {
                fontFamily: "Arial",
                fontSize: 11,
                fontWeight: "700",
                fill: 0xffffff
            }
        });
        hp.anchor.set(0.5);
        root.addChild(hp);

        enemyLayer.addChild(root);

        return {
            root,
            sprite,
            hp,
            beam,
            harvesterBeam,
            risingItem,
            type: data.type,
            bossVariant,

            motion: null
        };
    }

    function updateEnemy(node, data) {
        const now =
            performance.now();

        if (!node.motion) {
            // First appearance: place immediately.
            node.root.position.set(
                data.x,
                data.y
            );

            node.motion = {
                fromX: data.x,
                fromY: data.y,
                toX: data.x,
                toY: data.y,
                startedAt: now
            };
        }
        else {
            // Continue from wherever the interpolated
            // sprite currently is.
            node.motion.fromX =
                node.root.x;

            node.motion.fromY =
                node.root.y;

            node.motion.toX =
                data.x;

            node.motion.toY =
                data.y;

            node.motion.startedAt =
                now;
        }

        const bossVariant = data.bossVariant || 0;

        if (
            node.type !== data.type ||
            node.bossVariant !== bossVariant
        ) {
            node.type = data.type;
            node.bossVariant = bossVariant;
            node.sprite.texture = enemyTexture(
                data.type,
                bossVariant
            );
        }

        if (data.type === "Boss") {
            const targetWidth = 205;

            const ratio =
                node.sprite.texture.height /
                node.sprite.texture.width || 1;

            node.sprite.width = targetWidth;
            node.sprite.height = targetWidth * ratio;

            node.hp.text =
                data.hp +
                "/" +
                data.maxHp;

            node.hp.y =
                -(node.sprite.height / 2) -
                18;
        }
        else {
            let targetWidth = 75;

            if (data.type === "Interceptor")
                targetWidth = 70;

            if (data.type === "Bomber")
                targetWidth = 90;

            const ratio =
                node.sprite.texture.height /
                node.sprite.texture.width || 1;

            node.sprite.width = targetWidth;
            node.sprite.height = targetWidth * ratio;

            node.hp.text = String(data.hp);
            node.hp.y =
                -(node.sprite.height / 2) -
                10;
        }

        node.beam.visible = false;
        node.harvesterBeam.visible = false;
        node.risingItem.visible = false;

        // ---------------------------------
        // Harvester mothership beam
        // ---------------------------------
        if (data.isHarvesterBeaming) {
            const beamStartY = 45;

            node.harvesterBeam.visible = true;
            node.harvesterBeam.x = 0;
            node.harvesterBeam.y = beamStartY;

            const beamWidth = 175;
            const beamRatio =
                node.harvesterBeam.texture.height /
                node.harvesterBeam.texture.width || 1;

            node.harvesterBeam.width = beamWidth;
            node.harvesterBeam.height =
                beamWidth * beamRatio;

            const pulse =
                (Math.sin(performance.now() / 90) + 1) / 2;

            node.harvesterBeam.alpha =
                0.75 +
                pulse * 0.25;

            if (
                data.targetItemId &&
                textures.items[data.targetItemId]
            ) {
                const tex =
                    textures.items[data.targetItemId];

                node.risingItem.visible = true;
                node.risingItem.texture = tex;

                const targetWidth =
                    (itemBaseWidths[data.targetItemId] || 36) *
                    0.9;

                const ratio =
                    tex.height /
                    tex.width || 1;

                node.risingItem.width = targetWidth;
                node.risingItem.height =
                    targetWidth * ratio;

                const totalHeight =
                    config.itemFieldY -
                    data.y;

                const easedProgress =
                    data.beamProgress *
                    data.beamProgress;

                node.risingItem.x = 0;
                node.risingItem.y =
                    totalHeight *
                    (1 - easedProgress);
            }

            return;
        }

        // ---------------------------------
        // Regular Thief tractor beam
        // ---------------------------------
        if (data.isBeaming) {
            const beamStartY = 32;

            node.beam.visible = true;
            node.beam.x = 0;
            node.beam.y = beamStartY;
            node.beam.width = 96;

            const totalBeamHeight =
                config.itemFieldY -
                data.y -
                beamStartY;

            node.beam.height =
                Math.max(0, totalBeamHeight);

            const pulse =
                (Math.sin(performance.now() / 110) + 1) / 2;

            node.beam.alpha =
                0.7 +
                pulse * 0.3;

            if (
                data.targetItemId &&
                textures.items[data.targetItemId]
            ) {
                node.risingItem.visible = true;

                const tex =
                    textures.items[data.targetItemId];

                node.risingItem.texture = tex;

                const targetWidth =
                    (itemBaseWidths[data.targetItemId] || 36) *
                    0.85;

                const ratio =
                    tex.height /
                    tex.width || 1;

                node.risingItem.width = targetWidth;
                node.risingItem.height =
                    targetWidth * ratio;

                const easedProgress =
                    data.beamProgress *
                    data.beamProgress;

                const currentOffsetY =
                    totalBeamHeight *
                    (1 - easedProgress);

                node.risingItem.x = 0;
                node.risingItem.y =
                    beamStartY +
                    currentOffsetY;
            }
        }
    }

    function createBullet(kind, isEnemy) {
        let bullet;

        if (!isEnemy) {
            const texture =
                kind === 1
                    ? textures.tedFlameBurst
                    : textures.tedBullet;

            bullet = new PIXI.Sprite(texture);
            bullet.anchor.set(0.5);

            // Keep the larger values that made Ted's shots readable.
            const targetWidth =
                kind === 1
                    ? 80
                    : 58;

            const ratio =
                texture.height /
                texture.width || 1;

            bullet.width = targetWidth;
            bullet.height = targetWidth * ratio;
        }
        else {
            let texture = null;
            let targetWidth = 0;

            switch (kind) {
                case 1:
                    texture = textures.interceptorShot;
                    targetWidth = 34;
                    break;

                case 2:
                    texture = textures.bomberBomb;
                    targetWidth = 44;
                    break;

                case 3:
                    texture = textures.warMothershipShot;
                    targetWidth = 60;
                    break;
            }

            if (texture) {
                bullet = new PIXI.Sprite(texture);
                bullet.anchor.set(0.5);

                const ratio =
                    texture.height /
                    texture.width || 1;

                bullet.width = targetWidth;
                bullet.height = targetWidth * ratio;
            }
            else {
                bullet = new PIXI.Graphics(
                    enemyBulletContext
                );
            }
        }

        bullet.projectileKind = kind;

        projectileLayer.addChild(bullet);
        return bullet;
    }

    function syncBulletsFlat(map, list, isEnemy) {
        if (!list)
            return;

        const seen = new Set();

        const stride =
            isEnemy
                ? 5
                : 4;

        for (
            let i = 0;
            i < list.length;
            i += stride
        ) {
            const id = String(list[i]);
            const x = list[i + 1];
            const y = list[i + 2];
            const kind = list[i + 3] || 0;

            const rotation =
                isEnemy
                    ? list[i + 4]
                    : 0;

            seen.add(id);

            let bullet = map.get(id);

            if (
                !bullet ||
                bullet.projectileKind !== kind
            ) {
                if (bullet) {
                    projectileLayer.removeChild(bullet);
                    bullet.destroy();
                }

                bullet = createBullet(
                    kind,
                    isEnemy
                );

                map.set(id, bullet);
            }

            bullet.position.set(x, y);

            // The custom sprites are drawn pointing upward.
            if (
                isEnemy &&
                (kind === 1 || kind === 3)
            ) {
                bullet.rotation =
                    rotation -
                    Math.PI / 2;
            }
        }

        for (const [id, bullet] of map) {
            if (!seen.has(id)) {
                projectileLayer.removeChild(bullet);
                bullet.destroy();
                map.delete(id);
            }
        }
    }

    function syncEnemies(list) {
        if (!list || !Array.isArray(list))
            return;

        const seen = new Set();

        for (const en of list) {
            const id = String(en.id);
            const typeStr =
                enemyTypes[en.type] ||
                "Fighter";

            const bossVariant =
                en.bossVariant || 0;

            seen.add(id);

            let node = enemies.get(id);

            if (!node) {
                node = createEnemy({
                    type: typeStr,
                    bossVariant
                });

                enemies.set(id, node);
            }

            updateEnemy(node, {
                x: en.x,
                y: en.y,
                hp: en.hp,
                maxHp: en.maxHp,
                type: typeStr,
                bossVariant,
                isBeaming: en.isBeaming,
                isHarvesterBeaming:
                    en.isHarvesterBeaming,
                targetItemId:
                    en.targetItemId,
                beamProgress:
                    en.beamProgress || 0
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

    function syncBomberBlasts(list) {
        if (!list)
            return;

        const seen = new Set();
        const stride = 4;

        for (
            let i = 0;
            i < list.length;
            i += stride
        ) {
            const id = String(list[i]);
            const x = list[i + 1];
            const y = list[i + 2];
            const progress = list[i + 3];

            seen.add(id);

            let sprite = bomberBlasts.get(id);

            if (!sprite) {
                sprite = new PIXI.Sprite(
                    textures.bomberBlast
                );

                sprite.anchor.set(0.5);
                explosionLayer.addChild(sprite);
                bomberBlasts.set(id, sprite);
            }

            const width =
                85 +
                progress * 60;

            const ratio =
                sprite.texture.height /
                sprite.texture.width || 1;

            sprite.width = width;
            sprite.height = width * ratio;
            sprite.alpha = 1 - progress;
            sprite.position.set(x, y);
        }

        for (const [id, sprite] of bomberBlasts) {
            if (!seen.has(id)) {
                explosionLayer.removeChild(sprite);
                sprite.destroy();
                bomberBlasts.delete(id);
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
        syncBomberBlasts(frame.bomberBlasts);

        // Return the newest pointer position as part of
        // this existing C# -> JS crossing.
        const playerTargetX =
            pendingPlayerTargetX;

        pendingPlayerTargetX = null;

        // -1 means there has been no new pointer movement.
        return playerTargetX ?? -1;
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
            b.destroy();
        });

        playerBullets.clear();

        // -----------------------------
        // Enemy bullets
        // -----------------------------
        enemyBullets.forEach(b => {
            projectileLayer.removeChild(b);
            b.destroy();
        });

        enemyBullets.clear();

        // -----------------------------
        // Bomber blast effects
        // -----------------------------
        bomberBlasts.forEach(sprite => {
            explosionLayer.removeChild(sprite);
            sprite.destroy();
        });

        bomberBlasts.clear();

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

    return {
        init,
        sync,
        clear,
        resetPlayerInput
    };
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