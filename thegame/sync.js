/*
 * The Game shared-state bridge.
 * The original page code is retained; this file adds cross-device synchronization.
 * Shared fields: customGames, deletedBaseIds, banners.
 * Device-local fields (theme and favorites) remain local to each browser.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'thegame-state-v2';
  const TOKEN_KEY = 'thegame-admin-sync-token';
  const VERSION_KEY = 'thegame-shared-updated-at';
  const BOOT_KEY = 'thegame-shared-boot-reload';
  const POLL_MS = 15000;
  let busy = false;
  let lastRemoteUpdatedAt = sessionStorage.getItem(VERSION_KEY) || '';
  let lastPostedFingerprint = '';

  const readLocal = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch { return null; }
  };

  const sharedOnly = (state) => ({
    customGames: Array.isArray(state && state.customGames) ? state.customGames : [],
    deletedBaseIds: Array.isArray(state && state.deletedBaseIds) ? state.deletedBaseIds : [],
    banners: Array.isArray(state && state.banners) ? state.banners : []
  });

  const fingerprint = (value) => {
    try { return JSON.stringify(value); } catch { return ''; }
  };

  async function request(url, options = {}) {
    const response = await fetch(url, {
      cache: 'no-store',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
    return result;
  }

  function mergeSharedIntoLocal(remote) {
    const local = readLocal() || {};
    const next = { ...local, ...remote };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch (error) { console.error('[The Game Sync] Could not update local cache:', error); }
  }

  async function pullRemote({ allowReload = true } = {}) {
    if (busy) return;
    busy = true;
    try {
      const result = await request('/api/state');
      if (!result.sharedState || !result.updatedAt) return;

      const remoteStamp = String(result.updatedAt);
      const remoteFingerprint = fingerprint(result.sharedState);
      const localFingerprint = fingerprint(sharedOnly(readLocal() || {}));

      if (remoteStamp !== lastRemoteUpdatedAt && remoteFingerprint !== localFingerprint) {
        mergeSharedIntoLocal(result.sharedState);
        lastRemoteUpdatedAt = remoteStamp;
        sessionStorage.setItem(VERSION_KEY, remoteStamp);

        // Reload once so the unchanged original application initializes from the shared data.
        if (allowReload && sessionStorage.getItem(BOOT_KEY) !== remoteStamp) {
          sessionStorage.setItem(BOOT_KEY, remoteStamp);
          location.reload();
          return;
        }
      } else if (remoteStamp !== lastRemoteUpdatedAt) {
        lastRemoteUpdatedAt = remoteStamp;
        sessionStorage.setItem(VERSION_KEY, remoteStamp);
      }
    } catch (error) {
      console.warn('[The Game Sync] Shared data could not be loaded:', error.message);
    } finally {
      busy = false;
    }
  }

  async function pushLocal() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const local = readLocal();
    if (!local) return;
    const sharedState = sharedOnly(local);
    const nextFingerprint = fingerprint(sharedState);
    if (!nextFingerprint || nextFingerprint === lastPostedFingerprint) return;

    try {
      const result = await request('/api/state', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(sharedState)
      });
      lastPostedFingerprint = nextFingerprint;
      if (result.updatedAt) {
        lastRemoteUpdatedAt = result.updatedAt;
        sessionStorage.setItem(VERSION_KEY, result.updatedAt);
        sessionStorage.removeItem(BOOT_KEY);
      }
      console.info('[The Game Sync] Shared changes saved.');
    } catch (error) {
      console.error('[The Game Sync] Save failed:', error.message);
      if (error.message.includes('session') || error.message.includes('sign in')) {
        sessionStorage.removeItem(TOKEN_KEY);
      }
      if (typeof window.toast === 'function') window.toast('همگام‌سازی انجام نشد؛ اتصال و تنظیمات را بررسی کنید');
    }
  }

  // Patch only the storage write method; the original application logic stays unchanged.
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    const result = originalSetItem.call(this, key, value);
    if (this === localStorage && key === STORAGE_KEY) {
      clearTimeout(window.__theGameSyncDebounce);
      window.__theGameSyncDebounce = setTimeout(pushLocal, 700);
    }
    return result;
  };

  // Authenticate against the server when the existing admin login form is submitted.
  document.addEventListener('submit', async (event) => {
    if (!event.target || event.target.id !== 'loginForm') return;
    const username = document.querySelector('#loginUser')?.value?.trim() || '';
    const password = document.querySelector('#loginPass')?.value || '';
    try {
      const result = await request('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      if (result.token) {
        sessionStorage.setItem(TOKEN_KEY, result.token);
        // The original form handler may already have saved the login state; push current data now.
        await pushLocal();
      }
    } catch (error) {
      console.warn('[The Game Sync] Server sign-in failed:', error.message);
      sessionStorage.removeItem(TOKEN_KEY);
    }
  }, true);

  // Initial pull, then periodic checks so changes made on another device appear here.
  pullRemote();
  setInterval(() => pullRemote(), POLL_MS);
  window.addEventListener('focus', () => pullRemote());

  // Expose a harmless manual retry for troubleshooting in the browser console.
  window.theGameSync = { refresh: () => pullRemote(), save: () => pushLocal() };
})();
