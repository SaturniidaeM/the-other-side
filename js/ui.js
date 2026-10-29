import { CONFIG } from './config.js';
import { state, isTouch } from './state.js';
import {
  hpBarEl, manaBarEl, ammoEl, spellEl, bossBarEl, bossHpFillEl,
  mobileControls, btnInteract
} from './dom.js';

let hudTimer = 0;

export function updateHUD(dt) {
  hudTimer -= dt;
  if (hudTimer > 0) return;
  hudTimer = 0.05;

  const p = state.player, w = state.weapon;
  hpBarEl.style.width = Math.max(0, (p.hp / CONFIG.player.maxHp) * 100) + '%';
  manaBarEl.style.width = Math.max(0, (p.mana / CONFIG.player.maxMana) * 100) + '%';
  ammoEl.textContent = w.reloading > 0 ? 'ЗАРЯДКА...' : `${w.ammo} / ${CONFIG.weapon.magSize}`;

  let html = '';
  for (let i = 0; i < CONFIG.spells.list.length; i++) {
    const s = CONFIG.spells.list[i], active = state.spell.active === i;
    html += `<div class="${active ? 'active' : ''}">[${s.key}] ${s.name} (${s.cost} MP)</div>`;
  }
  spellEl.innerHTML = html;

  // HP босса
  const b = state.boss;
  if (bossBarEl && bossHpFillEl && b) {
    if (b.state !== 'sleep' && b.state !== 'dead') {
      bossBarEl.classList.remove('hidden');
      bossHpFillEl.style.width = Math.max(0, (b.hp / b.maxHp) * 100) + '%';
    } else {
      bossBarEl.classList.add('hidden');
    }
  }

  // === Мобильный UI ===
  if (isTouch && mobileControls) {
    const inCutscene = state.dialogue.active && state.dialogue.style === 'cutscene';
    const shouldShow = state.running && !inCutscene && !state.gameOver;

    if (shouldShow) {
      mobileControls.classList.remove('hidden');
    } else {
      mobileControls.classList.add('hidden');
      state.touch.x = 0;
      state.touch.y = 0;
      state.touch.active = false;
      state.touch.sprint = false;
      state.touch.shootHeld = false;
    }

    // Кнопка взаимодействия
    if (btnInteract) {
      let label = null;
      if (state.savePoint.feedbackTimer > 0) label = '✓ Сохранено';
      else if (state.arch.near) label = 'ПРОЙТИ ЧЕРЕЗ АРКУ';
      else if (state.savePoint.near) label = 'СОХРАНИТЬ';
      else if (state.dialogue.npcInView) label = 'ПОГОВОРИТЬ';

      if (label && shouldShow) {
        btnInteract.textContent = label;
        btnInteract.classList.remove('hidden');
      } else {
        btnInteract.classList.add('hidden');
      }
    }
  }
}