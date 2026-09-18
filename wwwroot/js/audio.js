// Tiny audio helper called from Blazor via IJSRuntime. Not a build tool or
// framework -- just wraps the browser's native Audio API so C# can trigger
// music/SFX with one-line JS interop calls (no inline eval needed).
window.gameAudio = (function () {
    let musicEl = null;
    let currentMusicSrc = null;
    let unlockArmed = false;

    // Browsers block audio.play() until the page has had at least one real
    // user gesture (click/tap/key). If our first attempt gets blocked, this
    // arms a one-time listener that retries as soon as that gesture happens,
    // instead of just staying silent forever.
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
        // a fresh Audio() per call so overlapping SFX (e.g. rapid-fire bullets) don't cut each other off
        const a = new Audio(src);
        a.volume = volume ?? 0.7;
        a.play().catch(() => { });
    }

    return { playMusic, stopMusic, pauseMusic, resumeMusic, playSfx };
})();