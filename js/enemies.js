import { scene, camera } from './engine.js';
import { state } from './state.js';
import { colliders } from './level.js';
import {
  playMonsterGrowl, playHitPlayer,
  playSlimeSpit, playSlimeHit, playSlimeGurgle,
  playFlyerScreech, playFlyerWings
} from './audio.js';
import { spawnImpact } from './effects.js';

export const enemies = [];

const textureLoader = new THREE.TextureLoader();
function loadTex(url) {
  const tex = textureLoader.load(url);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

// Текстуры для разных типов
const texMonster1 = loadTex('assets/monster1.png'); // волна 1: плеватели / волна 2: пешие
const texMonster2 = loadTex('assets/monster2.png'); // волна 1: пешие
const texMonster3 = loadTex('assets/monster3.png'); // волна 2: летающие

const ENEMY_RADIUS = 0.6;
const enemyProjectiles = [];

function collidesAt(x, z, radius) {
  for (const b of colliders) {
    if (b.isRound) {
      const dx = x - b.x, dz = z - b.z, r = b.radius + radius;
      if (dx * dx + dz * dz < r * r) return true;
    } else if (b.isAngled) {
      const dx = x - b.x, dz = z - b.z;
      const cos = Math.cos(-b.angle), sin = Math.sin(-b.angle);
      const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
      if (Math.abs(lx) < b.w / 2 + radius && Math.abs(lz) < b.d / 2 + radius) return true;
    } else if (b.min && b.max) {
      if (x > b.min.x - radius && x < b.max.x + radius &&
          z > b.min.z - radius && z < b.max.z + radius) return true;
    }
  }
  return false;
}

// Проверка горизонтальной коллизии с учётом высоты (для летающих)
function collidesAtHeight(x, z, radius, height) {
  for (const b of colliders) {
    if (b.max && b.max.y < height) continue;
    if (b.isRound) {
      const dx = x - b.x, dz = z - b.z, r = b.radius + radius;
      if (dx * dx + dz * dz < r * r) return true;
    } else if (b.min && b.max) {
      if (x > b.min.x - radius && x < b.max.x + radius &&
          z > b.min.z - radius && z < b.max.z + radius) return true;
    }
  }
  return false;
}

// =====================================================================
//                         СПАВН
// =====================================================================
export function spawnMonster2(x, z, wave = 0, texture = texMonster2) {
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.5), mat);
  mesh.position.set(x, 1.25, z);
  scene.add(mesh);
  enemies.push({
    mesh, type: 'melee', wave,
    hp: 30, speed: 4.5,
    attackTimer: 0, attackCooldown: 1.5, damage: 10,
    stunTimer: 0, soundTimer: 1 + Math.random() * 4, stuckTimer: 0,
  });
}

export function spawnSpitter(x, baseY, z, wave = 1, texture = texMonster2) {
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.5), mat);
  mesh.position.set(x, baseY + 1.25, z);
  scene.add(mesh);
  enemies.push({
    mesh, type: 'spitter', wave,
    hp: 30, speed: 0,
    attackTimer: 1.0 + Math.random() * 1.5,
    attackCooldown: 2.5 + Math.random() * 1.0,
    damage: 12,
    stunTimer: 0,
    soundTimer: 2 + Math.random() * 3,
    baseY,
    projectileSpeed: 12,
  });
}

export function spawnFlyer(x, z, wave = 2) {
  const mat = new THREE.MeshBasicMaterial({
    map: texMonster3, transparent: true, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.2), mat);
  mesh.position.set(x, 3.0, z);
  scene.add(mesh);
  enemies.push({
    mesh, type: 'flyer', wave,
    hp: 25, speed: 5.0,
    attackTimer: 0, attackCooldown: 1.5, damage: 8,
    stunTimer: 0,
    hoverBaseY: 2.8,
    hoverPhase: Math.random() * Math.PI * 2,
    diveTimer: 0,
    diveCooldown: 2 + Math.random() * 2,
    isDiving: false,
    diveDir: new THREE.Vector3(),
    diveSpeed: 0,
    soundTimer: 1 + Math.random() * 2,
  });
}

// =====================================================================
//                    УРОН / СТАН
// =====================================================================
export function hitEnemy(enemy, damage) {
  enemy.hp -= damage;
  if (enemy.hp <= 0) enemy.mesh.visible = false;
}

export function stunEnemy(enemy, duration) {
  enemy.stunTimer = Math.max(enemy.stunTimer, duration);
  enemy.attackTimer = enemy.attackCooldown;
  if (enemy.isDiving) {
    enemy.isDiving = false;
    enemy.diveCooldown = 2;
  }
}

// =====================================================================
//                    СНАРЯДЫ ВРАГОВ
// =====================================================================
function projectileHitsWall(pos, radius) {
  if (pos.y <= radius) return true;
  for (const b of colliders) {
    if (b.max && (pos.y < b.min.y - radius || pos.y > b.max.y + radius)) continue;
    if (b.isRound) {
      const dx = pos.x - b.x, dz = pos.z - b.z, r = b.radius + radius;
      if (dx * dx + dz * dz < r * r) return true;
    } else if (b.min && b.max) {
      if (pos.x > b.min.x - radius && pos.x < b.max.x + radius &&
          pos.z > b.min.z - radius && pos.z < b.max.z + radius) return true;
    }
  }
  return false;
}

function spawnEnemyProjectile(startPos, dir, speed, damage) {
  const geo = new THREE.SphereGeometry(0.18, 6, 6);
  const mat = new THREE.MeshBasicMaterial({ color: 0x88ff66, transparent: true, opacity: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(startPos);
  scene.add(mesh);
  enemyProjectiles.push({ mesh, dir: dir.clone().normalize(), speed, damage, life: 4.0 });
}

function updateEnemyProjectiles(dt) {
  const p = state.player;
  for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
    const proj = enemyProjectiles[i];
    proj.life -= dt;
    let kill = proj.life <= 0;

    if (!kill) {
      let remaining = proj.speed * dt;
      while (remaining > 0 && !kill) {
        const step = Math.min(0.3, remaining);
        proj.mesh.position.addScaledVector(proj.dir, step);
        remaining -= step;

        const dx = proj.mesh.position.x - p.pos.x;
        const dy = proj.mesh.position.y - (p.pos.y - 0.5);
        const dz = proj.mesh.position.z - p.pos.z;
        if (dx * dx + dy * dy + dz * dz < 0.8 * 0.8) {
          state.player.hp -= proj.damage;
          playSlimeHit();
          playHitPlayer();
          spawnImpact(proj.mesh.position.clone());
          kill = true;
          break;
        }
        if (projectileHitsWall(proj.mesh.position, 0.18)) {
          playSlimeHit();
          spawnImpact(proj.mesh.position.clone());
          kill = true;
          break;
        }
      }
    }

    if (kill) {
      scene.remove(proj.mesh);
      proj.mesh.geometry.dispose();
      proj.mesh.material.dispose();
      enemyProjectiles.splice(i, 1);
    }
  }
}

// =====================================================================
//                     ЛОГИКА ПО ТИПАМ
// =====================================================================
function updateSpitter(e, dt, p) {
  e.mesh.lookAt(camera.position.x, e.mesh.position.y, camera.position.z);

  const dx = p.pos.x - e.mesh.position.x;
  const dz = p.pos.z - e.mesh.position.z;
  const distSq = dx * dx + dz * dz;

  if (distSq < 625 && distSq > 4) {
    e.attackTimer -= dt;
    if (e.attackTimer <= 0) {
      const dist = Math.sqrt(distSq);
      const dir = new THREE.Vector3(dx / dist, 0, dz / dist);
      const dy = (p.pos.y - 0.5) - e.mesh.position.y;
      dir.y = dy / Math.max(dist, 1);
      dir.normalize();

      const start = e.mesh.position.clone();
      start.y -= 0.3;
      start.x += dir.x * 1.0;
      start.z += dir.z * 1.0;

      spawnEnemyProjectile(start, dir, e.projectileSpeed, e.damage);
      playSlimeSpit();
      e.attackTimer = e.attackCooldown;
    }
  }

  e.soundTimer -= dt;
  if (e.soundTimer <= 0) {
    playSlimeGurgle();
    e.soundTimer = 4 + Math.random() * 4;
  }
}

function updateFlyer(e, dt, p) {
  e.hoverPhase += dt * 2.5;
  const hoverOffset = Math.sin(e.hoverPhase) * 0.35;

  const dx = p.pos.x - e.mesh.position.x;
  const dy = p.pos.y - e.mesh.position.y;
  const dz = p.pos.z - e.mesh.position.z;
  const dist = Math.hypot(dx, dz);

  if (e.isDiving) {
    e.mesh.position.addScaledVector(e.diveDir, e.diveSpeed * dt);

    const px = p.pos.x - e.mesh.position.x;
    const py = p.pos.y - e.mesh.position.y;
    const pz = p.pos.z - e.mesh.position.z;
    if (px * px + py * py + pz * pz < 2.0 * 2.0) {
      if (e.attackTimer <= 0) {
        state.player.hp -= e.damage;
        e.attackTimer = e.attackCooldown;
        playHitPlayer();
      }
      e.isDiving = false;
      e.diveCooldown = 2 + Math.random() * 2;
      e.mesh.position.y += 1.0;
    }

    e.diveTimer -= dt;
    if (e.diveTimer <= 0 || e.mesh.position.y < 0.4) {
      e.isDiving = false;
      e.diveCooldown = 2 + Math.random() * 2;
      e.mesh.position.y = Math.max(e.mesh.position.y, 1.0);
    }
  } else {
    const targetY = p.pos.y + e.hoverBaseY + hoverOffset;

    if (dist > 5) {
      const step = e.speed * dt;
      const stepX = (dx / dist) * step;
      const stepZ = (dz / dist) * step;
      if (!collidesAtHeight(e.mesh.position.x + stepX, e.mesh.position.z, 0.5, e.mesh.position.y))
        e.mesh.position.x += stepX;
      if (!collidesAtHeight(e.mesh.position.x, e.mesh.position.z + stepZ, 0.5, e.mesh.position.y))
        e.mesh.position.z += stepZ;
    } else if (dist > 1) {
      const perpX = -dz / dist, perpZ = dx / dist;
      const step = e.speed * 0.6 * dt;
      const stepX = perpX * step;
      const stepZ = perpZ * step;
      if (!collidesAtHeight(e.mesh.position.x + stepX, e.mesh.position.z, 0.5, e.mesh.position.y))
        e.mesh.position.x += stepX;
      if (!collidesAtHeight(e.mesh.position.x, e.mesh.position.z + stepZ, 0.5, e.mesh.position.y))
        e.mesh.position.z += stepZ;
    }

    e.mesh.position.y += (targetY - e.mesh.position.y) * Math.min(1, 3 * dt);

    e.diveCooldown -= dt;
    if (e.diveCooldown <= 0 && dist < 11 && dist > 1.5) {
      e.isDiving = true;
      e.diveSpeed = 14;
      const diveLen = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      e.diveDir.set(dx / diveLen, dy / diveLen, dz / diveLen);
      e.diveTimer = 1.0;
      playFlyerScreech();
    }
  }

  e.mesh.lookAt(camera.position.x, e.mesh.position.y, camera.position.z);
  if (e.attackTimer > 0) e.attackTimer -= dt;

  e.soundTimer -= dt;
  if (e.soundTimer <= 0) {
    playFlyerWings();
    e.soundTimer = 2.5 + Math.random() * 3;
  }
}

function tryMoveAxisSeparated(e, stepX, stepZ) {
  const oldX = e.mesh.position.x, oldZ = e.mesh.position.z;
  e.mesh.position.x += stepX;
  if (collidesAt(e.mesh.position.x, e.mesh.position.z, ENEMY_RADIUS)) e.mesh.position.x = oldX;
  e.mesh.position.z += stepZ;
  if (collidesAt(e.mesh.position.x, e.mesh.position.z, ENEMY_RADIUS)) e.mesh.position.z = oldZ;
  return Math.hypot(e.mesh.position.x - oldX, e.mesh.position.z - oldZ);
}

function updateMelee(e, dt, p) {
  const dx = p.pos.x - e.mesh.position.x;
  const dz = p.pos.z - e.mesh.position.z;
  const distSq = dx * dx + dz * dz;

  e.mesh.lookAt(camera.position.x, e.mesh.position.y, camera.position.z);

  if (distSq < 225) {
    if (distSq > 2.25) {
      const dist = Math.sqrt(distSq);
      const dirX = dx / dist, dirZ = dz / dist;
      const step = e.speed * dt;
      const oldX = e.mesh.position.x, oldZ = e.mesh.position.z;
      const moved = tryMoveAxisSeparated(e, dirX * step, dirZ * step);
      const desiredMove = step;

      if (moved < desiredMove * 0.35) {
        e.stuckTimer += dt;
        if (e.stuckTimer > 0.2) {
          const angles = [0, 20, -20, 40, -40, 60, -60, 80, -80, 100, -100,
                          120, -120, 140, -140, 160, -160, 180];
          const escStep = Math.max(step * 3, 0.3);
          let escaped = false;
          for (let sub = 1; sub <= 3 && !escaped; sub++) {
            const ss = escStep * sub;
            for (const deg of angles) {
              const rad = deg * Math.PI / 180;
              const cos = Math.cos(rad), sin = Math.sin(rad);
              const rdx = dirX * cos - dirZ * sin;
              const rdz = dirX * sin + dirZ * cos;
              const testX = e.mesh.position.x + rdx * ss;
              const testZ = e.mesh.position.z + rdz * ss;
              if (!collidesAt(testX, testZ, ENEMY_RADIUS)) {
                e.mesh.position.x = testX; e.mesh.position.z = testZ;
                escaped = true; break;
              }
            }
          }
          if (!escaped) {
            for (let j = 0; j < 12; j++) {
              const rad = Math.random() * Math.PI * 2;
              const jump = 0.8 + Math.random() * 1.5;
              const testX = e.mesh.position.x + Math.cos(rad) * jump;
              const testZ = e.mesh.position.z + Math.sin(rad) * jump;
              if (!collidesAt(testX, testZ, ENEMY_RADIUS)) {
                e.mesh.position.x = testX; e.mesh.position.z = testZ; break;
              }
            }
          }
          e.stuckTimer = 0;
        }
      } else {
        e.stuckTimer = 0;
      }

      const totalMoved = Math.hypot(e.mesh.position.x - oldX, e.mesh.position.z - oldZ);
      if (totalMoved > desiredMove * 0.5 && distSq < 400) {
        e.soundTimer -= dt;
        if (e.soundTimer <= 0) {
          playMonsterGrowl();
          e.soundTimer = 2.5 + Math.random() * 3.5;
        }
      }
    } else {
      if (e.attackTimer <= 0) {
        state.player.hp -= e.damage;
        e.attackTimer = e.attackCooldown;
        playHitPlayer();
      }
    }
  }
  if (e.attackTimer > 0) e.attackTimer -= dt;
}

// =====================================================================
//                        ВОЛНЫ
// =====================================================================

// Спавн 12 пеших в комнате 2 (случайные позиции, свободные от коллайдеров)
function spawnMeleeWave(count, texture, wave) {
  let spawned = 0, attempts = 0;
  while (spawned < count && attempts < 2000) {
    attempts++;
    const x = 14 + Math.random() * 44;    // комната 2: x 14..58
    const z = -46 - Math.random() * 56;   // комната 2: z -46..-102
    if (collidesAt(x, z, 1.2)) continue;
    spawnMonster2(x, z, wave, texture);
    spawned++;
  }
}

// Спавн 8 плевателей на крышах зданий комнаты 2
function spawnSpitterWave(texture = texMonster2) {
  const spots = [
    [18, 13, -95],   // башня 1 (высокая)
    [20, 13, -92],   // башня 1 (смещение)
    [52,  8, -52],   // башня 2
    [50,  8, -50],   // башня 2 (смещение)
    [38, 3.6, -102], // фасад 1 (низкий)
    [55, 2.8, -85],  // фасад 2 (низкий)
    [16, 5.5, -67.5],// угловая башня 1
    [31.75, 4.5, -57],// угловая башня 2
  ];
  for (const [x, y, z] of spots) spawnSpitter(x, y, z, 1, texture);
}

// Спавн 8 летающих
function spawnFlyerWave() {
  let spawned = 0, attempts = 0;
  while (spawned < 8 && attempts < 200) {
    attempts++;
    const x = 16 + Math.random() * 40;
    const z = -48 - Math.random() * 52;
    if (collidesAt(x, z, 1.0)) continue;
    spawnFlyer(x, z, 2);
    spawned++;
  }
}

function spawnWave1() {
  spawnMeleeWave(12, texMonster2, 1); // 12 пеших (теперь monster2.png)
  spawnSpitterWave(texMonster1);      // 8 плевателей (теперь monster1.png)
  // Итого 20
}

function spawnWave2() {
  spawnMeleeWave(12, texMonster2, 2); // 12 пеших (monster2.png)
  spawnFlyerWave();                   // 8 летающих (monster3.png)
  // Итого 20
}

function checkWaveTriggers() {
  if (state.room2Cleared) return;

  const p = state.player.pos;
  const inRoom2 = p.x > 12 && p.x < 58 && p.z < -44 && p.z > -104;

  if (!state.room2Wave1Spawned && inRoom2) {
    state.room2Wave1Spawned = true;
    state.room2Wave = 1;
    spawnWave1();
    return;
  }

  if (state.room2Wave === 1 && !state.room2Wave2Spawned) {
    if (!enemies.some(e => e.wave === 1)) {
      state.room2Wave2Spawned = true;
      state.room2Wave = 2;
      spawnWave2();
    }
  } else if (state.room2Wave === 2) {
    if (!enemies.some(e => e.wave === 2)) {
      state.room2Wave = 3;
      state.room2Cleared = true;
      import('./level.js').then(level => level.setGate2Open(true));
    }
  }
}

// =====================================================================
//                        ОБНОВЛЕНИЕ
// =====================================================================
export function updateEnemies(dt) {
  const p = state.player;
  const isCutscene = state.dialogue.active && state.dialogue.style === 'cutscene';

  if (!isCutscene) updateEnemyProjectiles(dt);

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.hp <= 0) {
      scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      enemies.splice(i, 1);
      continue;
    }

    if (isCutscene) {
      e.mesh.lookAt(camera.position.x, e.mesh.position.y, camera.position.z);
      continue;
    }

    if (e.stunTimer > 0) {
      e.stunTimer -= dt;
      e.mesh.lookAt(camera.position.x, e.mesh.position.y, camera.position.z);
      if (e.mesh.material.color) e.mesh.material.color.setHex(0x88aaff);
      continue;
    } else if (e.mesh.material.color) {
      if (e.mesh.material.color.getHex() !== 0xffffff) {
        e.mesh.material.color.setHex(0xffffff);
      }
    }

    if (e.type === 'spitter') updateSpitter(e, dt, p);
    else if (e.type === 'flyer') updateFlyer(e, dt, p);
    else updateMelee(e, dt, p);
  }

  checkWaveTriggers();

  if (!state.room1Cleared && enemies.length === 0) {
    // ждём зачистки первой комнаты (учитываем только монстров волны 0)
    // Простая эвристика: если нет врагов с wave===0
    if (!enemies.some(e => e.wave === 0)) {
      state.room1Cleared = true;
      import('./level.js').then(level => level.setGateOpen(true));
    }
  }
}