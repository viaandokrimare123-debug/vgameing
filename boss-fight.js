/* Vgameing Ender Dragon global raid: shared counter, 24-hour event cycle, 1% rare reward. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const TARGET = 100000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const CLIENT_CLEANUP_MS = 2 * 60 * 60 * 1000;
  let initialized = false;
  let busy = false;
  let raidState = null;
  let eventEndAt = 0;
  let stateRefreshBusy = false;

  function client() {
    return window.vgSupabase || (typeof vgSupabase !== 'undefined' ? vgSupabase : null);
  }

  function getSessionId() {
    const key = 'vg-boss-session-id-v1';
    try {
      let id = sessionStorage.getItem(key);
      if (!id) {
        id = window.crypto && typeof window.crypto.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
              const r = Math.random() * 16 | 0;
              return (c === 'x' ? r : (r & 3 | 8)).toString(16);
            });
        sessionStorage.setItem(key, id);
      }
      return id;
    } catch (_) {
      return '00000000-0000-4000-8000-' + Math.floor(Math.random() * 1e12).toString().padStart(12, '0');
    }
  }

  function setStatus(message, isError) {
    const status = $('bossFightStatus');
    const globalStatus = $('bossGlobalStatus');
    const log = $('bossFightLog');
    if (status) status.textContent = message;
    if (globalStatus) {
      globalStatus.textContent = message;
      globalStatus.style.color = isError ? '#fda4af' : '';
    }
    if (log) log.textContent = message;
  }

  function paintState(state) {
    if (!state) return;
    const wasDefeated = !!(raidState && raidState.defeated);
    raidState = state;
    eventEndAt = Date.parse(state.event_ends_at) || (Date.now() + DAY_MS);
    const count = Math.max(0, Math.min(Number(state.total_clicks) || 0, TARGET));
    const target = Number(state.target_clicks) || TARGET;
    const percent = Math.min(100, count / target * 100);
    const countText = count.toLocaleString() + ' / ' + target.toLocaleString();

    const hpText = $('bossFightHpText');
    const hpBar = $('bossFightHpBar');
    const globalCount = $('bossGlobalCount');
    const globalFill = $('vgBossFill');
    const bannerCount = $('vgBossCount');
    if (hpText) hpText.textContent = countText + ' attacks';
    if (hpBar) hpBar.style.width = percent + '%';
    if (globalCount) globalCount.textContent = countText;
    if (globalFill) globalFill.style.width = percent + '%';
    if (bannerCount) bannerCount.textContent = countText + ' global attacks';

    const boss = $('bossFightBoss');
    if (boss) boss.textContent = state.defeated ? '🏆' : '🐉';
    const attackBtn = $('bossAttackBtn');
    if (attackBtn) {
      attackBtn.disabled = busy || !!state.defeated;
      attackBtn.textContent = state.defeated ? '🏆 ENDER DRAGON DEFEATED' : (busy ? '⚡ STRIKE IN PROGRESS…' : '⚔️ ATTACK THE ENDER DRAGON');
    }
    if (state.defeated && !wasDefeated) setStatus('WORLD RAID CLEARED — waiting for the next 24-hour cycle.');
    else if (!state.defeated && !busy && !wasDefeated) setStatus('GLOBAL RAID ONLINE · every strike counts for all players.');
    paintCountdown();
  }

  function paintCountdown() {
    const node = $('bossEventCountdown');
    if (!node) return;
    if (!eventEndAt) {
      node.textContent = 'SYNCING…';
      return;
    }
    const remaining = Math.max(0, Math.floor((eventEndAt - Date.now()) / 1000));
    const hh = String(Math.floor(remaining / 3600)).padStart(2, '0');
    const mm = String(Math.floor((remaining % 3600) / 60)).padStart(2, '0');
    const ss = String(remaining % 60).padStart(2, '0');
    node.textContent = hh + ':' + mm + ':' + ss;
    node.setAttribute('aria-label', hh + ' hours ' + mm + ' minutes ' + ss + ' seconds until global event reset');
    if (remaining === 0) refreshState();
  }

  async function refreshState() {
    const sb = client();
    if (!sb || stateRefreshBusy) {
      if (!sb) setStatus('SERVER CONNECTION UNAVAILABLE — reload after the site connection is restored.', true);
      return;
    }
    stateRefreshBusy = true;
    try {
      const result = await sb.rpc('vg_get_boss_state');
      if (result.error) throw result.error;
      paintState(result.data);
    } catch (error) {
      console.error('[Vgameing] Could not sync Ender Dragon raid:', error);
      setStatus('Could not sync global raid. Check connection and retry.', true);
    } finally {
      stateRefreshBusy = false;
    }
  }

  async function attack() {
    if (busy || !raidState || raidState.defeated) return;
    const sb = client();
    if (!sb) {
      setStatus('Global raid needs a live server connection. Your click was not counted.', true);
      return;
    }
    busy = true;
    const button = $('bossAttackBtn');
    if (button) {
      button.disabled = true;
      button.textContent = '⚡ STRIKE IN PROGRESS…';
    }
    try {
      const result = await sb.rpc('vg_boss_attack', { p_session_id: getSessionId() });
      if (result.error) throw result.error;
      const state = result.data;
      paintState(state);
      if (state.victory_now) {
        const reward = state.ultra_rare
          ? '🌟 ULTRA-RARE DROP! Dragon Heart Relic (1% server roll)!'
          : '🎁 Dragon Cache earned! The 1% Dragon Heart Relic did not drop this time.';
        setStatus('🏆 THE ENDER DRAGON HAS FALLEN! ' + reward);
        if (button) button.textContent = '🏆 ENDER DRAGON DEFEATED';
        try {
          window.dispatchEvent(new CustomEvent('vg:boss-reward', {
            detail: { item: state.ultra_rare ? 'Dragon Heart Relic' : 'Dragon Cache', ultraRare: !!state.ultra_rare }
          }));
        } catch (_) {}
      } else if (state.defeated) {
        setStatus('The Ender Dragon is already defeated for this event cycle.');
      } else if (state.accepted === false) {
        setStatus('Strike rate-limited — wait a moment before attacking again.', true);
      } else {
        setStatus('⚔️ Strike registered! ' + Number(state.total_clicks).toLocaleString() + ' / ' + TARGET.toLocaleString() + ' global attacks.');
      }
    } catch (error) {
      console.error('[Vgameing] Ender Dragon attack failed:', error);
      setStatus('Attack was not confirmed by the server. Please retry.', true);
    } finally {
      busy = false;
      if (raidState) paintState(raidState);
    }
  }

  // Browser-only cache cleanup is supplementary; the actual two-hour cleanup is a Supabase pg_cron job.
  function resetTemporaryClientState() {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('vg-temp-cache:') || key.startsWith('vg-session-pool:'))) sessionStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('[Vgameing] Temporary browser cache cleanup skipped:', error);
    }
    try {
      const pool = window.vgTemporarySessionPool;
      if (Array.isArray(pool)) pool.length = 0;
      else if (pool && typeof pool === 'object') Object.keys(pool).forEach(key => delete pool[key]);
    } catch (error) {
      console.warn('[Vgameing] Temporary browser pool cleanup skipped:', error);
    }
    try {
      window.dispatchEvent(new CustomEvent('vg:temporary-session-reset', { detail: { at: Date.now(), intervalMs: CLIENT_CLEANUP_MS } }));
    } catch (_) {}
  }

  window.initBossFight = function () {
    if (!$('bossFightApp')) return;
    if (!initialized) {
      const attackBtn = $('bossAttackBtn');
      const refreshBtn = $('bossRefreshBtn');
      if (attackBtn) attackBtn.addEventListener('click', attack);
      if (refreshBtn) refreshBtn.addEventListener('click', refreshState);
      initialized = true;
    }
    refreshState();
    paintCountdown();
  };

  if (!window.__vgBossSystemsStarted) {
    window.__vgBossSystemsStarted = true;
    window.setInterval(paintCountdown, 1000);
    window.setInterval(refreshState, 15000);
    window.setInterval(resetTemporaryClientState, CLIENT_CLEANUP_MS);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', window.initBossFight, { once: true });
    } else {
      window.initBossFight();
    }
  }
})();
