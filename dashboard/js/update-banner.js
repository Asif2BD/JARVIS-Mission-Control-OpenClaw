/**
 * JARVIS Mission Control — Update Available Banner (v1.11.0)
 *
 * Checks npm registry for new version on page load + every 6 hours.
 * Shows dismissable banner in header if update is available.
 * Dismiss state persisted in localStorage.
 */

const UPDATE_DISMISS_KEY = 'jarvis-update-dismissed';
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Check for updates and show the banner if a newer version is available.
 */
async function checkForUpdate() {
    try {
        const dismissed = localStorage.getItem(UPDATE_DISMISS_KEY);

        const data = await api.checkForUpdate();
        if (!data || !data.updateAvailable) return;

        // If the user dismissed THIS specific version, don't show again
        if (dismissed === data.latest) return;

        showUpdateBanner(data.current, data.latest, data.downloadUrl);
    } catch (err) {
        // Silent fail — update check is non-critical
    }
}

/**
 * Show the update banner with version info.
 */
function showUpdateBanner(current, latest, downloadUrl) {
    const banner = document.getElementById('update-banner');
    const text = document.getElementById('update-banner-text');
    const link = document.getElementById('update-banner-link');

    if (!banner) return;

    if (text) text.textContent = `🚀 Update available: v${current} → v${latest}`;
    if (link && downloadUrl) link.href = downloadUrl;

    banner.style.display = 'flex';
}

/**
 * Dismiss the update banner and save state to localStorage.
 */
function dismissUpdateBanner() {
    const banner = document.getElementById('update-banner');
    if (banner) banner.style.display = 'none';

    // Save the dismissed version so we only re-show for a newer release
    const text = document.getElementById('update-banner-text');
    if (text) {
        const match = text.textContent.match(/→ v([\d.]+)/);
        if (match) {
            localStorage.setItem(UPDATE_DISMISS_KEY, match[1]);
        }
    }
}

// Check on page load
document.addEventListener('DOMContentLoaded', () => {
    checkForUpdate();
    // Re-check every 6 hours
    setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
});
