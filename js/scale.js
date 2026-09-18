// Keeps the game's fixed 480x840 coordinate space scaled uniformly to fit
// any screen -- phone, tablet, or desktop -- without distorting proportions
// or letting anything drift outside the visible area. Sets a CSS custom
// property that the .stage rule reads via transform: scale(var(--game-scale)).
window.gameScale = (function () {
    const NATIVE_W = 480, NATIVE_H = 840;
    const MAX_SCALE = 1.5; // stops it from getting comically huge on large monitors

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