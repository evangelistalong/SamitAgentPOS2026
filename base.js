// =============================================================
// SAMIT AGENT POS — SHARED UI UTILITIES
// Included by every page. Depends on config.js + sheets.js.
// =============================================================

// ── TOAST ────────────────────────────────────────────────────
function showToast(msg, isError) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'toast' + (isError ? ' error' : '') + ' show';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.className = 'toast', 2500);
}

// ── CURRENCY FORMAT ───────────────────────────────────────────
function fmt(n) {
    return '₱' + (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtN(n) {
    return (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── CONNECTION STATUS ─────────────────────────────────────────
function updateConnectionStatus() {
    const online = navigator.onLine;
    document.body.classList.toggle('is-offline', !online);
    const ind = document.getElementById('connectionIndicator');
    if (ind) {
        ind.className = 'conn-indicator ' + (online ? 'online' : 'offline');
        ind.innerHTML = online ? '🟢 Online' : '🔴 Offline';
    }
    if (online) setTimeout(() => OfflineQueue.syncAll(), 1000);
}

// ── RENDER SHARED CHROME ──────────────────────────────────────
function renderConnBar() {
    const bar = document.createElement('div');
    bar.className = 'conn-bar';
    bar.innerHTML = `
        <div class="conn-indicator online" id="connectionIndicator">🟢 Online</div>
        <div class="sync-area">
            <div class="sync-badge" id="syncBadge">0</div>
            <button class="sync-btn" onclick="OfflineQueue.syncAll().then(()=>showToast('🔄 Syncing...'))">🔄 Sync</button>
        </div>`;
    const offBanner = document.createElement('div');
    offBanner.className = 'offline-banner';
    offBanner.id = 'offlineBanner';
    offBanner.textContent = '📡 Offline Mode — Changes will sync when connected';
    const agentBadge = document.createElement('div');
    agentBadge.id = 'agentBadge';
    agentBadge.style.cssText = 'text-align:center;font-size:0.65rem;font-weight:600;padding:2px 0;background:var(--bg2);color:var(--text2);border-bottom:1px solid var(--border);';
    agentBadge.textContent = '👤 ' + CONFIG.AGENT_NAME + ' · ' + Sheets.today();
    document.body.insertAdjacentElement('afterbegin', agentBadge);
    document.body.insertAdjacentElement('afterbegin', offBanner);
    document.body.insertAdjacentElement('afterbegin', bar);
}

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Inject toast element
    if (!document.getElementById('toast')) {
        const t = document.createElement('div');
        t.className = 'toast'; t.id = 'toast';
        document.body.appendChild(t);
    }
    renderConnBar();
    updateConnectionStatus();
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    OfflineQueue.updateBadge();
    // Auto-sync every 30s
    setInterval(() => { if (navigator.onLine) OfflineQueue.syncAll(); }, 30000);
});
