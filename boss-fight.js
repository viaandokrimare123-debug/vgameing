/* Vgameing Boss Fight — safe to initialize whenever its tab opens. */
(function () {
  'use strict';
  let initialized = false, bossHp = 1000, playerHp = 100, busy = false, ended = false, heals = 3;
  const maxBossHp = 1000, maxPlayerHp = 100;
  const $ = id => document.getElementById(id);
  function paint() {
    const bossText = $('bossFightHpText'), bossBar = $('bossFightHpBar'), playerText = $('bossPlayerHpText');
    if (bossText) bossText.textContent = Math.max(0,bossHp) + ' / ' + maxBossHp;
    if (bossBar) bossBar.style.width = (Math.max(0,bossHp) / maxBossHp * 100) + '%';
    if (playerText) playerText.textContent = Math.max(0,playerHp) + ' / ' + maxPlayerHp;
    const attack = $('bossAttackBtn'), heal = $('bossHealBtn');
    if (attack) { attack.disabled = busy || ended; attack.style.opacity = attack.disabled ? '.5' : '1'; }
    if (heal) { heal.disabled = busy || ended || heals <= 0 || playerHp >= maxPlayerHp; heal.textContent = '💚 HEAL (+35) · ' + heals; heal.style.opacity = heal.disabled ? '.5' : '1'; }
  }
  function say(message) { const log=$('bossFightLog'), status=$('bossFightStatus'); if(log) log.textContent=message; if(status) status.textContent=message; }
  function finish(won) { ended=true; busy=false; say(won?'🏆 RAID CLEAR! The Ender Titan has been defeated!':'💀 RAID FAILED. Restart and try again.'); const boss=$('bossFightBoss'); if(boss) boss.textContent=won?'🏆':'💀'; paint(); }
  function bossTurn() {
    if(ended) return; busy=true; paint();
    window.setTimeout(function(){ if(ended)return; const damage=8+Math.floor(Math.random()*16); playerHp=Math.max(0,playerHp-damage); if(playerHp<=0){finish(false);return;} busy=false; say('The Titan strikes for '+damage+' damage. Your turn!'); paint(); },450);
  }
  function attack() {
    if(busy||ended)return; busy=true; const damage=85+Math.floor(Math.random()*91); bossHp=Math.max(0,bossHp-damage);
    const boss=$('bossFightBoss'); if(boss){boss.textContent='💥';window.setTimeout(()=>{if(!ended&&bossHp>0)boss.textContent='👾';},220);}
    say('You dealt '+damage+' damage to the Ender Titan!'); paint(); if(bossHp<=0){finish(true);return;} bossTurn();
  }
  function heal() { if(busy||ended||heals<=0||playerHp>=maxPlayerHp)return; const amount=Math.min(35,maxPlayerHp-playerHp);playerHp+=amount;heals--;say('You restored '+amount+' HP. The Titan takes its turn…');bossTurn(); }
  function restart() { bossHp=maxBossHp;playerHp=maxPlayerHp;heals=3;busy=false;ended=false;const boss=$('bossFightBoss');if(boss)boss.textContent='👾';say('The Ender Titan is waiting…');paint(); }
  window.initBossFight = function(){if(!$('bossFightApp'))return;if(!initialized){$('bossAttackBtn')?.addEventListener('click',attack);$('bossHealBtn')?.addEventListener('click',heal);$('bossRestartBtn')?.addEventListener('click',restart);initialized=true;}paint();};
})();
