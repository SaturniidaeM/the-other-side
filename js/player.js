import { CONFIG } from './config.js';
import { state, keys } from './state.js';
import { camera } from './engine.js';
import { colliders, platforms, npcMesh } from './level.js';

const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpWish = new THREE.Vector3();
const tmpHoriz = new THREE.Vector3();

export function resolveCollisions(pos, radius) {
  const feetY = pos.y - CONFIG.player.eyeHeight;
  const headY = pos.y + 0.2;

  for (const b of colliders) {
    if (headY < b.min.y || feetY > b.max.y - 0.15) continue;

    if (b.isRound) {
      const dx = pos.x - b.x;
      const dz = pos.z - b.z;
      const distSq = dx * dx + dz * dz;
      const minDist = b.radius + radius;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq) || 0.0001;
        const push = (minDist - dist) / dist;
        pos.x += dx * push;
        pos.z += dz * push;
      }
    } else if (b.isAngled) {
      const dx = pos.x - b.x;
      const dz = pos.z - b.z;
      const cos = Math.cos(-b.angle);
      const sin = Math.sin(-b.angle);

      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;

      const hw = b.w / 2;
      const hd = b.d / 2;

      const cx = Math.max(-hw, Math.min(lx, hw));
      const cz = Math.max(-hd, Math.min(lz, hd));

      const distX = lx - cx;
      const distZ = lz - cz;
      const distSq = distX * distX + distZ * distZ;

      if (distSq < radius * radius) {
        let pushX = 0;
        let pushZ = 0;

        if (distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const push = (radius - dist) / dist;
          pushX = distX * push;
          pushZ = distZ * push;
        } else {
          const overlapX = hw - Math.abs(lx);
          const overlapZ = hd - Math.abs(lz);
          if (overlapX < overlapZ) {
            pushX = (lx > 0 ? 1 : -1) * (overlapX + radius);
          } else {
            pushZ = (lz > 0 ? 1 : -1) * (overlapZ + radius);
          }
        }

        const wcos = Math.cos(b.angle);
        const wsin = Math.sin(b.angle);
        pos.x += pushX * wcos - pushZ * wsin;
        pos.z += pushX * wsin + pushZ * wcos;
      }
    } else {
      const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
      const cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;

      if (d2 < radius * radius) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (radius - d) / d;
          pos.x += dx * push;
          pos.z += dz * push;
        } else {
          const left = Math.abs(pos.x - b.min.x);
          const right = Math.abs(b.max.x - pos.x);
          const front = Math.abs(pos.z - b.min.z);
          const back = Math.abs(b.max.z - pos.z);
          const m = Math.min(left, right, front, back);

          if (m === left) pos.x = b.min.x - radius;
          else if (m === right) pos.x = b.max.x + radius;
          else if (m === front) pos.z = b.min.z - radius;
          else pos.z = b.max.z + radius;
        }
      }
    }
  }
}

export function updatePlayer(dt) {
  const p = state.player;

  if (state.dialogue.active && state.dialogue.style === 'cutscene') {
    p.vel.x = 0; p.vel.z = 0;

    if (state.dialogue.isCutscene && npcMesh) {
      const dx = npcMesh.position.x - p.pos.x;
      const dz = npcMesh.position.z - p.pos.z;
      p.yaw = Math.atan2(-dx, -dz);
      p.pitch = 0;
    }

    camera.position.copy(p.pos);
    camera.rotation.y = p.yaw;
    camera.rotation.x = p.pitch;
    return;
  }

  tmpForward.set(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
  tmpRight.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));

  tmpWish.set(0, 0, 0);
  if (keys['KeyW']) tmpWish.add(tmpForward);
  if (keys['KeyS']) tmpWish.sub(tmpForward);
  if (keys['KeyD']) tmpWish.add(tmpRight);
  if (keys['KeyA']) tmpWish.sub(tmpRight);

  // Аналоговый ввод с мобильного джойстика (сохраняем величину наклона)
  if (state.touch && state.touch.active) {
    tmpWish.addScaledVector(tmpForward, -state.touch.y);
    tmpWish.addScaledVector(tmpRight, state.touch.x);
  }

  if (tmpWish.lengthSq() > 1) {
    tmpWish.normalize();
  }

  const isSprinting =
    keys['ControlLeft'] || keys['ControlRight'] ||
    (state.touch && state.touch.sprint);
  const currentSpeed = CONFIG.player.speed * (isSprinting ? CONFIG.player.sprintMultiplier : 1);

  tmpHoriz.set(p.vel.x, 0, p.vel.z);

  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    const k = Math.max(0, p.dashTimer / CONFIG.player.dashDuration);
    const spd = CONFIG.player.dashSpeed * (0.55 + 0.45 * k);
    tmpHoriz.set(p.dashDir.x * spd, 0, p.dashDir.z * spd);
  } else {
    const rate = p.onGround ? CONFIG.player.accelGround : CONFIG.player.accelAir;
    const t = Math.min(1, rate * dt);
    tmpHoriz.x += (tmpWish.x * currentSpeed - tmpHoriz.x) * t;
    tmpHoriz.z += (tmpWish.z * currentSpeed - tmpHoriz.z) * t;
  }

  p.vel.x = tmpHoriz.x;
  p.vel.z = tmpHoriz.z;
  p.vel.y -= CONFIG.player.gravity * dt;
  p.pos.y += p.vel.y * dt;

  let groundY = CONFIG.player.eyeHeight;
  const prevY = p.pos.y - p.vel.y * dt;
  for (const plat of platforms) {
    if (p.pos.x >= plat.min.x && p.pos.x <= plat.max.x &&
        p.pos.z >= plat.min.z && p.pos.z <= plat.max.z) {
      const topY = plat.max.y + CONFIG.player.eyeHeight;
      if (topY > groundY && p.vel.y <= 0 && prevY >= topY - 0.3) {
        groundY = topY;
      }
    }
  }

  if (p.pos.y <= groundY) {
    p.pos.y = groundY;
    p.vel.y = 0;
    p.onGround = true;
  } else {
    p.onGround = false;
  }

  p.pos.x += p.vel.x * dt;
  p.pos.z += p.vel.z * dt;

  resolveCollisions(p.pos, CONFIG.player.radius);

  if (p.dashCooldown > 0) {
    p.dashCooldown -= dt;
  }

  p.mana = Math.min(CONFIG.player.maxMana, p.mana + CONFIG.player.manaRegen * dt);

  camera.position.copy(p.pos);
  camera.rotation.y = p.yaw;
  camera.rotation.x = p.pitch;
}

export function tryDash() {
  const p = state.player;
  if (p.dashCooldown > 0) return;
  if (state.dialogue.active && state.dialogue.style === 'cutscene') return;

  tmpForward.set(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
  tmpRight.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));

  const dir = new THREE.Vector3();
  if (keys['KeyW']) dir.add(tmpForward);
  if (keys['KeyS']) dir.sub(tmpForward);
  if (keys['KeyD']) dir.add(tmpRight);
  if (keys['KeyA']) dir.sub(tmpRight);

  if (state.touch && state.touch.active) {
    dir.addScaledVector(tmpForward, -state.touch.y);
    dir.addScaledVector(tmpRight, state.touch.x);
  }

  if (dir.lengthSq() < 1e-4) {
    dir.copy(tmpForward);
  }

  dir.normalize();

  p.dashDir.copy(dir);
  p.dashTimer = CONFIG.player.dashDuration;
  p.dashCooldown = CONFIG.player.dashCooldown;
}