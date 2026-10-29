import { state } from './state.js';
import { CONFIG } from './config.js';

const SAVE_KEY = 'the_other_side_save_v2';

export function saveGame() {
  try {
    const p = state.player;

    // При сохранении здоровье полностью восстанавливается
    p.hp = CONFIG.player.maxHp;

    const data = {
      pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z },
      yaw: p.yaw,
      pitch: p.pitch,
      hp: p.hp,
      mana: p.mana,
      ammo: state.weapon.ammo,
      timestamp: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Не удалось сохранить игру:', e);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !data.pos) return false;

    const p = state.player;
    p.pos.set(data.pos.x, data.pos.y, data.pos.z);
    if (typeof data.yaw   === 'number') p.yaw   = data.yaw;
    if (typeof data.pitch === 'number') p.pitch = data.pitch;
    if (typeof data.hp    === 'number') p.hp    = data.hp;
    if (typeof data.mana  === 'number') p.mana  = data.mana;
    if (typeof data.ammo  === 'number') state.weapon.ammo = data.ammo;
    return true;
  } catch (e) {
    console.warn('Не удалось загрузить игру:', e);
    return false;
  }
}