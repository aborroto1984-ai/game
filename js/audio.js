// Tiny audio helper called from Blazor via IJSRuntime. Not a build tool or
// framework -- just wraps the browser's native Audio API so C# can trigger
// music/SFX with one-line JS interop calls (no inline eval needed).
window.gameAudio = (function () {
    let musicEl = null;
    let currentMusicSrc = null;
    let unlockArmed = false;

    // Pre-allocate a pool of 8 reusable channels for mobile browser safety
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
        // Grab next available channel in round-robin fashion
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