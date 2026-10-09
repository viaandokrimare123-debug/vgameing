/* Vgameing Boss Fight systems: 24-hour event countdown, rarity drops, and safe client maintenance. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const DAY_MS = 86400000, RESET_MS = 7200000, EVENT_END_KEY = 'vgBossEventEndAt_v1';
  let initialized = false, bossHp = 1000, playerHp = 100, busy = false, ended = false, heals = 3;
  const maxBossHp = 1000, maxPlayerHp = 100;

  function getEventEndAt() {
    let endAt = 0;
    try { endAt = Number(localStorage.getItem(EVENT_END_KEY)) || 0; } catch (_) {}
    if (!endAt || endAt <= Date.now()) {
      endAt = Date.now() + DAY_MS;
      try { localStorage.setItem(EVENT_END_KEY, String(endAt)); } catch (_) {}
    }
    return endAt;
  }
  function paintCountdown() {
    const node = $('bossEventCountdown');
    if (!node) return;
    let endAt = getEventEndAt();
    if (endAt <= Date.now()) {
      do { endAt += DAY_MS; } while (endAt <= Date.now());
      try { localStorage.setItem(EVENT_END_KEY, String(endAt)); } catch (_) {}
    }
    const n = Math.max(0, Math.floor((endAt - Date.now()) / 1000));
    const hh = String(Math.floor(n / 3600)).padStart(2, '0');
    const mm = String(Math.floor((n % 3600) / 60)).padStart(2, '0');
    const ss = String(n % 60).padStart(2, '0');
    node.textContent = hh + ':' + mm + ':' + ss;
    node.setAttribute('aria-label', hh + ' hours ' + mm + ' minutes ' + ss + ' seconds until event reset');
  }
  function rollBossReward() {
    // One 1–100 roll; only 1 is the ultra-rare drop.
    const roll = Math.floor(Math.random() * 100) + 1;
    if (roll === 1) return { ultraRare: true, name: '🐉 Dragon Heart Relic', message: '🌟 ULTRA-RARE DROP! Dragon Heart Relic (1 in 100)!' };
    const common = ['💎 Titan Shard', '🟣 Ender Fragment', '✨ Void Dust'];
    const item = common[Math.floor(Math.random() * common.length)];
    return { ultraRare: false, name: item, message: '🎁 Reward earned: ' + item + '.' };
  }
  function paint() {
    const bossText = $('bossFightHpText'), bossBar = $('bossFightHpBar'), playerText = $('bossPlayerHpText');
    if (bossText) bossText.textContent = Math.max(0, bossHp) + ' / ' + maxBossHp;
    if (bossBar) bossBar.style.width = (Math.max(0, bossHp) / maxBossHp * 100) + '%';
    if (playerText) playerText.textContent = Math.max(0, playerHp) + ' / ' + maxPlayerHp;
    const attackBtn = $('bossAttackBtn'), healBtn = $('bossHealBtn');
    if (attackBtn) { attackBtn.disabled = busy || ended; attackBtn.style.opacity = attackBtn.disabled ? '.5' : '1'; }
    if (healBtn) { healBtn.disabled = busy || ended || heals <= 0 || playerHp >= maxPlayerHp; healBtn.textContent = '💚 HEAL (+35) · ' + heals; healBtn.style.opacity = healBtn.disabled ? '.5' : '1'; }
  }
  function say(message) {
    const log = $('bossFightLog'), status = $('bossFightStatus');
    if (log) log.textContent = message;
    if (status) status.textContent = message;
  }
  function finish(won) {
    ended = true; busy = false;
    if (won) {
      const reward = rollBossReward();
      say('🏆 RAID CLEAR! ' + reward.message);
      const boss = $('bossFightBoss'); if (boss) boss.textContent = '🏆';
      try { window.dispatchEvent(new CustomEvent('vg:boss-reward', { detail: { item: reward.name, ultraRare: reward.ultraRare } })); } catch (_) {}
    } else {
      say('💀 RAID FAILED. Restart and try again.');
      const boss = $('bossFightBoss'); if (boss) boss.textContent = '💀';
    }
    paint();
  }
  function bossTurn() {
    if (ended) return;
    busy = true; paint();
    window.setTimeout(function () {
      if (ended) return;
      const damage = 8 + Math.floor(Math.random() * 16);
      playerHp = Math.max(0, playerHp - damage);
      if (playerHp <= 0) { finish(false); return; }
      busy = false; say('The Titan strikes for ' + damage + ' damage. Your turn!'); paint();
    }, 450);
  }
  function attack() {
    if (busy || ended) return;
    busy = true;
    const damage = 85 + Math.floor(Math.random() * 91);
    bossHp = Math.max(0, bossHp - damage);
    const boss = $('bossFightBoss');
    if (boss) { boss.textContent = '💥'; window.setTimeout(function () { if (!ended && bossHp > 0) boss.textContent = '👾'; }, 220); }
    say('You dealt ' + damage + ' damage to the Ender Titan!'); paint();
    if (bossHp <= 0) { finish(true); return; }
    bossTurn();
  }
  function heal() {
    if (busy || ended || heals <= 0 || playerHp >= maxPlayerHp) return;
    const amount = Math.min(35, maxPlayerHp - playerHp);
    playerHp += amount; heals--;
    say('You restored ' + amount + ' HP. The Titan takes its turn…'); bossTurn();
  }
  function restart() {
    bossHp = maxBossHp; playerHp = maxPlayerHp; heals = 3; busy = false; ended = false;
    const boss = $('bossFightBoss'); if (boss) boss.textContent = '👾';
    say('The Ender Titan is waiting…'); paint();
  }

  // Browser-side maintenance only: never clear authentication, saved progress, or all storage.
  function resetTemporarySessionState() {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('vg-temp-cache:') || key.startsWith('vg-session-pool:'))) sessionStorage.removeItem(key);
      }
    } catch (error) { console.warn('[Vgameing] Temporary cache cleanup skipped:', error); }
    try {
      const pool = window.vgTemporarySessionPool;
      if (Array.isArray(pool)) pool.length = 0;
      else if (pool && typeof pool === 'object') Object.keys(pool).forEach(key => delete pool[key]);
    } catch (error) { console.warn('[Vgameing] Temporary pool refresh skipped:', error); }
    try { window.dispatchEvent(new CustomEvent('vg:temporary-session-reset', { detail: { at: Date.now(), intervalMs: RESET_MS } })); } catch (_) {}
    console.info('[Vgameing] Two-hour temporary client maintenance cycle completed.');
  }

  window.initBossFight = function () {
    if (!$('bossFightApp')) return;
    if (!initialized) {
      $('bossAttackBtn')?.addEventListener('click', attack);
      $('bossHealBtn')?.addEventListener('click', heal);
      $('bossRestartBtn')?.addEventListener('click', restart);
      initialized = true;
    }
    paint(); paintCountdown();
  };

  if (!window.__vgBossSystemsStarted) {
    window.__vgBossSystemsStarted = true;
    getEventEndAt(); paintCountdown();
    window.setInterval(paintCountdown, 1000);
    window.setInterval(resetTemporarySessionState, RESET_MS);
  }
})();
