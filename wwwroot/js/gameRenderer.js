window.alienFarmPixi = (function () {
    let app = null;
    let ready = false;

    let config = null;

    let enemyLayer = null;
    let projectileLayer = null;
    let playerLayer = null;

    let farmer = null;

    let textures = {};

    const playerBullets = new Map();
    const enemyBullets = new Map();
    const enemies = new Map();

    let playerBulletContext = null;
    let flameBulletContext = null;
    let enemyBulletContext = null;

    async function init(canvas, options) {
        config = options;

        app = new PIXI.Application();

        const stageScale = parseFloat(
            getComputedStyle(document.documentElement)
                .getPropertyValue('--game-scale')
        ) || 1;

        const pixelRatio = window.devicePixelRatio || 1;

        // Account for BOTH:
        // 1. high-DPI/Retina displays
        // 2. our CSS stage scaling
        const renderResolution = Math.min(
            pixelRatio * stageScale,
            3
        );

        await app.init({
            canvas: canvas,
            width: options.width,
            height: options.height,
            backgroundAlpha: 0,
            antialias: true,
            preference: "webgl",
            resolution: renderResolution,
            autoDensity: true
        });

        await loadTextures(options.assets);

        enemyLayer = new PIXI.Container();
        projectileLayer = new PIXI.Container();
        playerLayer = new PIXI.Container();

        app.stage.addChild(
            enemyLayer,
            projectileLayer,
            playerLayer
        );

        createSharedBulletGeometry();
        createFarmer();

        ready = true;
    }

    async function loadTextures(assets) {
        const urls = new Set();

        function collect(value) {
            if (!value) {
                return;
            }

            if (typeof value === "string") {
                urls.add(value);
                return;
            }

            if (typeof value === "object") {
                Object.values(value).forEach(collect);
            }
        }

        collect(assets);

        const loaded = await PIXI.Assets.load([...urls]);

        function texture(path) {
            return loaded[path];
        }

        textures = {
            farmer: texture(assets.farmer),
            farmerFlame: texture(assets.farmerFlame),

            ufoFighter: texture(assets.ufoFighter),
            ufoThief: texture(assets.ufoThief),
            ufoElite: texture(assets.ufoElite),
            ufoBoss: texture(assets.ufoBoss),

            beamColumn: texture(assets.beamColumn),

            items: {}
        };

        for (const [key, path] of Object.entries(assets.items)) {
            textures.items[key] = texture(path);
        }
    }

    function createSharedBulletGeometry() {
        playerBulletContext = new PIXI.GraphicsContext()
            .circle(0, 0, 5)
            .fill(0xffe36b);

        flameBulletContext = new PIXI.GraphicsContext()
            .circle(0, 0, 6.5)
            .fill(0xff8a2e);

        enemyBulletContext = new PIXI.GraphicsContext()
            .circle(0, 0, 5)
            .fill(0x8bff6b);
    }

    function createFarmer() {
        farmer = new PIXI.Sprite(textures.farmer);

        farmer.anchor.set(0.5);
        farmer.width = 34;
        farmer.height = 76;

        playerLayer.addChild(farmer);
    }

    function enemyTexture(type) {
        switch (type) {
            case "Thief":
                return textures.ufoThief;

            case "Elite":
                return textures.ufoElite;

            case "Boss":
                return textures.ufoBoss;

            default:
                return textures.ufoFighter;
        }
    }

    function createEnemy(data) {
        const root = new PIXI.Container();

        const beam = new PIXI.Sprite(textures.beamColumn);

        beam.anchor.set(0.5, 0);
        beam.visible = false;

        root.addChild(beam);

        const sprite = new PIXI.Sprite(enemyTexture(data.type));

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

        const firstItemTexture =
            Object.values(textures.items)[0];

        const target = new PIXI.Sprite(firstItemTexture);

        target.anchor.set(0.5);
        target.width = 20;
        target.height = 20;
        target.visible = false;

        root.addChild(target);

        const attack = new PIXI.Text({
            text: "⚡",
            style: {
                fontSize: 13
            }
        });

        attack.anchor.set(0.5);
        attack.visible = false;

        root.addChild(attack);

        enemyLayer.addChild(root);

        return {
            root,
            sprite,
            hp,
            target,
            attack,
            beam,
            type: data.type
        };
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
        }
        else {
            node.sprite.width = 54;
            node.sprite.height = 54;

            node.hp.text = String(data.hp);
            node.hp.y = -35;
        }

        const hasTarget =
            data.type === "Thief" &&
            data.targetItemId &&
            (
                data.state === "Descending" ||
                data.state === "Beaming"
            );

        node.target.visible = !!hasTarget;

        if (hasTarget) {
            const itemTexture =
                textures.items[data.targetItemId];

            if (itemTexture) {
                node.target.texture = itemTexture;
            }

            node.target.y = -39;
        }

        node.attack.visible =
            (
                data.type === "Fighter" ||
                data.type === "Elite"
            ) &&
            data.state === "Hovering";

        node.attack.y = -39;

        const beaming =
            data.type === "Thief" &&
            data.state === "Beaming";

        node.beam.visible = beaming;

        if (beaming) {
            const beamStartY = 25;

            node.beam.x = 0;
            node.beam.y = beamStartY;

            node.beam.width = 100;
            node.beam.height = Math.max(
                0,
                config.itemFieldY -
                data.y -
                beamStartY
            );

            const pulse =
                (Math.sin(performance.now() / 110) + 1) / 2;

            node.beam.alpha =
                0.7 + pulse * 0.3;
        }
    }

    function syncEnemies(list) {
        const seen = new Set();

        for (const data of list) {
            const id = String(data.id);

            seen.add(id);

            let node = enemies.get(id);

            if (!node) {
                node = createEnemy(data);
                enemies.set(id, node);
            }

            updateEnemy(node, data);
        }

        for (const [id, node] of enemies) {
            if (!seen.has(id)) {
                enemyLayer.removeChild(node.root);

                node.root.destroy({
                    children: true
                });

                enemies.delete(id);
            }
        }
    }

    function createBullet(isFlame, isEnemy) {
        let context;

        if (isEnemy) {
            context = enemyBulletContext;
        }
        else if (isFlame) {
            context = flameBulletContext;
        }
        else {
            context = playerBulletContext;
        }

        const bullet =
            new PIXI.Graphics(context);

        projectileLayer.addChild(bullet);

        return bullet;
    }

    function syncBullets(map, list, isEnemy) {
        const seen = new Set();

        for (const data of list) {
            const id = String(data.id);

            seen.add(id);

            let bullet = map.get(id);

            if (!bullet) {
                bullet = createBullet(
                    data.isFlame === true,
                    isEnemy
                );

                map.set(id, bullet);
            }

            bullet.position.set(
                data.x,
                data.y
            );
        }

        for (const [id, bullet] of map) {
            if (!seen.has(id)) {
                projectileLayer.removeChild(bullet);

                bullet.destroy();

                map.delete(id);
            }
        }
    }

    function sync(frame) {
        if (!ready) {
            return;
        }

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

        syncBullets(
            playerBullets,
            frame.bullets,
            false
        );

        syncBullets(
            enemyBullets,
            frame.enemyBullets,
            true
        );

        syncEnemies(frame.enemies);
    }

    function clearMap(map, layer, getDisplay) {
        for (const value of map.values()) {
            const display =
                getDisplay
                    ? getDisplay(value)
                    : value;

            layer.removeChild(display);

            display.destroy({
                children: true
            });
        }

        map.clear();
    }

    function clear() {
        if (!ready) {
            return;
        }

        clearMap(
            enemies,
            enemyLayer,
            x => x.root
        );

        clearMap(
            playerBullets,
            projectileLayer
        );

        clearMap(
            enemyBullets,
            projectileLayer
        );

        farmer.visible = false;
    }

    return {
        init,
        sync,
        clear
    };
})();