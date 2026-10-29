import { CONFIG } from './config.js';
import { state } from './state.js';
import { camera } from './engine.js';
import { worldObjects, targets } from './level.js';
import { enemies, hitEnemy, stunEnemy } from './enemies.js';
import { spawnImpact, spawnStunRing, spawnBlast, spawnProjectile } from './effects.js';
import { playGunShot, playReloadStart, playReloadFinish, playSpellCast, playSpellImpact } from './audio.js';
import {
  getBossHitbox, getBossProjectiles, bossTakeHit, destroyBossProjectile
} from './boss.js';

const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);

function hitTarget(mesh) {
  const target = targets.find(t => t.mesh === mesh);
  if (!target || target.respawnTimer > 0) return false;
  target.mesh.visible = false;
  target.respawnTimer = 2.0;
  const idx = worldObjects.indexOf(target.mesh);
  if (idx !== -1) worldObjects.splice(idx, 1);
  return true;
}

export function shoot() {
  if (state.dialogue.active && state.dialogue.style === 'cutscene') return;
  const w = state.weapon;
  if (w.reloading > 0 || w.cooldown > 0 || w.ammo <= 0) return;

  w.ammo--; w.cooldown = CONFIG.weapon.fireRate;
  state.view.recoil = 1;
  playGunShot();

  raycaster.setFromCamera(screenCenter, camera);
  raycaster.far = CONFIG.weapon.range;

  const bossHitboxes = getBossHitbox();
  const bossProjs    = getBossProjectiles();

  const allTargets = [
    ...worldObjects,
    ...enemies.map(e => e.mesh),
    ...bossHitboxes,
    ...bossProjs.map(p => p.mesh),
  ];

  const hits = raycaster.intersectObjects(allTargets, false);
  if (hits.length === 0) return;

  const hitObj = hits[0].object;

  const proj = bossProjs.find(p => p.mesh === hitObj);
  if (proj) {
    destroyBossProjectile(proj);
    spawnImpact(hits[0].point);
    return;
  }

  if (bossHitboxes.includes(hitObj)) {
    bossTakeHit(10, 'bullet');
    spawnImpact(hits[0].point);
    return;
  }

  const enemy = enemies.find(e => e.mesh === hitObj);
  if (enemy) {
    hitEnemy(enemy, 10);
    spawnImpact(hits[0].point);
    return;
  }

  hitTarget(hitObj);
  spawnImpact(hits[0].point);
}

export function reload() {
  const w = state.weapon, p = state.player;
  if (state.dialogue.active || w.reloading > 0 || w.ammo >= CONFIG.weapon.magSize || p.mana < CONFIG.weapon.reloadManaCost) return;
  p.mana -= CONFIG.weapon.reloadManaCost;
  w.reloading = CONFIG.weapon.reloadTime;
  playReloadStart();
}

export function updateWeapon(dt) {
  const w = state.weapon;
  if (w.cooldown > 0) w.cooldown -= dt;
  if (w.reloading > 0) {
    w.reloading -= dt;
    if (w.reloading <= 0) {
      w.reloading = 0;
      w.ammo = CONFIG.weapon.magSize;
      playReloadFinish();
    }
  }

  // Авто-стрельба при удержании мобильной кнопки
  if (state.touch && state.touch.shootHeld &&
      w.cooldown <= 0 && w.reloading <= 0 && w.ammo > 0) {
    shoot();
  }
}

const STUN_DURATION = 4.0;

export function castSpell() {
  if (state.dialogue.active && state.dialogue.style === 'cutscene') return;
  const idx = state.spell.active, spell = CONFIG.spells.list[idx], p = state.player;
  if (p.mana < spell.cost) return;

  p.mana -= spell.cost;
  state.view.cast = 1;
  playSpellCast(idx === 0);

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const start = new THREE.Vector3().copy(camera.position).addScaledVector(dir, 1.0);

  const onEnd = (pos) => {
    playSpellImpact(idx === 0);

    for (const t of targets) {
      if (t.respawnTimer > 0) continue;
      const dx = t.x - pos.x;
      const dy = 0.75 - pos.y;
      const dz = t.z - pos.z;
      if (dx * dx + dy * dy + dz * dz < spell.radius * spell.radius) {
        hitTarget(t.mesh);
      }
    }

    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const dx = e.mesh.position.x - pos.x;
      const dy = e.mesh.position.y - pos.y;
      const dz = e.mesh.position.z - pos.z;
      if (dx * dx + dy * dy + dz * dz < spell.radius * spell.radius) {
        if (idx === 0) stunEnemy(e, STUN_DURATION);
        else           hitEnemy(e, 40);
      }
    }

    if (state.boss && state.boss.state !== 'sleep' && state.boss.state !== 'dead' && !state.qte.active) {
      const hb = getBossHitbox()[0];
      if (hb) {
        const bPos = new THREE.Vector3();
        hb.getWorldPosition(bPos);
        const dx = bPos.x - pos.x;
        const dy = bPos.y - pos.y;
        const dz = bPos.z - pos.z;
        if (dx * dx + dy * dy + dz * dz < spell.radius * spell.radius) {
          if (idx === 0) bossTakeHit(15, 'ice');
          else           bossTakeHit(40, 'fire');
        }
      }
    }

    if (idx === 0) spawnStunRing(pos, spell.radius, spell.color);
    else          spawnBlast(pos, spell.radius, spell.color);
  };

  spawnProjectile(start, dir, spell.projectileSpeed, spell.projectileColor, idx === 1, onEnd);
}

export function getRaycaster() { return raycaster; }
export function getScreenCenter() { return screenCenter; }