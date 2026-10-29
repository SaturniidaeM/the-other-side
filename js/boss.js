// ==========================================================================
//  СТРАЖ ПОРОГА — босс комнаты 3
// ==========================================================================
import { CONFIG } from './config.js';
import { state, keys } from './state.js';
import { scene } from './engine.js';
import { colliders } from './level.js';
import { spawnImpact, spawnStunRing, spawnBlast } from './effects.js';
import {
  playMonsterGrowl, playHitPlayer,
  playBossStep, playBossVolley, playBossSwing, playBossShockwave,
  playBossDeath
} from './audio.js';

let bossGroup = null;
let bodyGroup = null;
let torso = null;
let head = null;
let eyes = [];
let eyeMat = null;
let bodyDarkMat = null;
let bodyDarkerMat = null;

let armSegment1L, armSegment1R, armSegment2L, armSegment2R, fistL, fistR;
const capePieces = [];
const skirtPieces = [];
let wingL = null, wingR = null;            // крылья
let auraRing = null;
let hitbox = null;

export const bossMeshes = [];       // визуальные части
export const bossHitbox = [];       // невидимый Box для стрельбы
const bossProjectiles = [];

let lastAttack = null;
let lastBossAttackSoundAt = 0;      // анти-спам звука удара
const deathPieces = [];
const activeMeteors = [];
let pendingMeteor = null;

const BOSS_CENTER = new THREE.Vector3(80, 0, -145);
const ENEMY_RADIUS = 1.5;

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

// ==========================================================================
//  СПАВН
// ==========================================================================
export function spawnBoss() {
  if (bossGroup) return;

  bossGroup = new THREE.Group();
  bossGroup.position.copy(BOSS_CENTER);
  scene.add(bossGroup);

  bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.4;
  bossGroup.add(bodyGroup);

  bodyDarkMat   = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  bodyDarkerMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const capeMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a, side: THREE.DoubleSide });
  const skirtMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a, side: THREE.DoubleSide });
  eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 });

  // --- Торс ---
  torso = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3, 1.4), bodyDarkMat);
  torso.position.set(0, 3.5, 0);
  torso.rotation.x = 0.12;
  bodyGroup.add(torso);
  bossMeshes.push(torso);

  // --- Голова ---
  head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), bodyDarkMat);
  head.position.set(0, 5.4, 0.1);
  bodyGroup.add(head);
  bossMeshes.push(head);

  // --- Глаза (утоплены) ---
  for (const sx of [-0.22, 0.22]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.05), eyeMat);
    eye.position.set(sx, 5.4, 0.45);
    bodyGroup.add(eye);
    bossMeshes.push(eye);
    eyes.push(eye);
  }

  // --- Плечи ---
  const shL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.2), bodyDarkMat);
  shL.position.set(-1.6, 4.6, 0);
  bodyGroup.add(shL); bossMeshes.push(shL);

  const shR = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.2), bodyDarkMat);
  shR.position.set(1.6, 4.6, 0);
  bodyGroup.add(shR); bossMeshes.push(shR);

  // --- Руки (2 сегмента + кулак) ---
  armSegment1L = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.6), bodyDarkerMat);
  armSegment1L.position.set(-1.6, 3.8, 0);
  bodyGroup.add(armSegment1L); bossMeshes.push(armSegment1L);

  armSegment2L = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.4, 0.55), bodyDarkerMat);
  armSegment2L.position.set(-1.6, 2.5, 0);
  bodyGroup.add(armSegment2L); bossMeshes.push(armSegment2L);

  fistL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), bodyDarkMat);
  fistL.position.set(-1.6, 1.55, 0);
  bodyGroup.add(fistL); bossMeshes.push(fistL);

  armSegment1R = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.6), bodyDarkerMat);
  armSegment1R.position.set(1.6, 3.8, 0);
  bodyGroup.add(armSegment1R); bossMeshes.push(armSegment1R);

  armSegment2R = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.4, 0.55), bodyDarkerMat);
  armSegment2R.position.set(1.6, 2.5, 0);
  bodyGroup.add(armSegment2R); bossMeshes.push(armSegment2R);

  fistR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), bodyDarkMat);
  fistR.position.set(1.6, 1.55, 0);
  bodyGroup.add(fistR); bossMeshes.push(fistR);

  // --- Крылья ---
  const wingMat = new THREE.MeshLambertMaterial({
    color: 0x141414, side: THREE.DoubleSide, transparent: true, opacity: 0.95
  });
  const wingGeo = createWingGeometry();

  wingR = new THREE.Mesh(wingGeo, wingMat);
  wingR.position.set(0.9, 4.6, -0.6);
  bodyGroup.add(wingR);
  bossMeshes.push(wingR);

  wingL = new THREE.Mesh(wingGeo, wingMat);
  wingL.position.set(-0.9, 4.6, -0.6);
  wingL.rotation.y = Math.PI;
  bodyGroup.add(wingL);
  bossMeshes.push(wingL);

  // --- Плащ: 6 плоскостей с плеч ---
  for (let i = 0; i < 6; i++) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 2.8), capeMat);
    const angle = (i / 6) * Math.PI - Math.PI / 2;
    plane.position.set(Math.sin(angle) * 1.3, 3.5, -Math.cos(angle) * 1.3);
    plane.rotation.y = angle;
    bodyGroup.add(plane);
    bossMeshes.push(plane);
    capePieces.push({ mesh: plane, baseY: 3.5, phase: i * 0.5 });
  }

  // --- Юбка: 6 клиньев ---
  for (let i = 0; i < 6; i++) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.0), skirtMat);
    const angle = (i / 6) * Math.PI * 2;
    plane.position.set(Math.sin(angle) * 0.9, 1.8, Math.cos(angle) * 0.9);
    plane.rotation.y = -angle;
    bodyGroup.add(plane);
    bossMeshes.push(plane);
    skirtPieces.push({ mesh: plane, phase: i * 0.7 });
  }

  // --- Аура ---
  auraRing = new THREE.Mesh(
    new THREE.RingGeometry(1.8, 2.1, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
  );
  auraRing.rotation.x = -Math.PI / 2;
  auraRing.position.y = 0.05;
  bossGroup.add(auraRing);

  // --- Хитбокс (невидимый Box на bossGroup, чтобы не крутился с торсом) ---
  hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 3, 1.4),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.set(0, 3.5, 0);
  bossGroup.add(hitbox);
  bossHitbox.length = 0;
  bossHitbox.push(hitbox);

  // --- Стейт ---
  state.boss.state = 'sleep';
  state.boss.maxHp = CONFIG.boss.maxHp;        // синхронизация с HUD
  state.boss.hp = CONFIG.boss.maxHp;
  state.boss.animTime = 0;
  state.boss.attackCooldown = 0;
  state.boss.iceCooldown = 0;
  state.boss.qteCooldown = CONFIG.boss.qteInterval;
  state.boss.qteTriggeredPhase2 = false;
  state.boss._stunTimer = 0;
  state.boss._dashing = false;
  state.boss._stepTimer = 0;
}

// Силуэт крыла (летучая мышь с рваными краями)
function createWingGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.4);
  s.lineTo(3.5, 1.4);
  s.lineTo(3.0, 0.4);
  s.lineTo(3.6, 0.0);
  s.lineTo(2.8, -0.3);
  s.lineTo(3.2, -1.0);
  s.lineTo(2.0, -0.8);
  s.lineTo(1.8, -1.3);
  s.lineTo(0.9, -0.7);
  s.lineTo(0.4, -0.6);
  s.lineTo(0, -0.2);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

export function getBossHitbox()      { return bossHitbox; }
export function getBossProjectiles() { return bossProjectiles; }

// ==========================================================================
//  УРОН / СТАН / СМЕРТЬ
// ==========================================================================
export function bossStun(sec) {
  if (!bossGroup || state.boss.state === 'dead') return;
  state.boss.state = 'stunned';
  state.boss.animTime = 0;
  state.boss._stunTimer = sec;
  if (bodyDarkMat)   bodyDarkMat.color.setHex(0x4a6a8a);
  if (bodyDarkerMat) bodyDarkerMat.color.setHex(0x2a4a6a);
}

export function bossTakeHit(dmg, type = 'bullet') {
  if (!bossGroup || state.boss.state === 'dead') return;
  if (state.qte.active) return;

  state.boss.hp -= dmg;

  if (type === 'ice' && state.boss.iceCooldown <= 0) {
    bossStun(CONFIG.boss.stunTime);
    state.boss.iceCooldown = 8.0;
  }

  if (state.boss.hp <= 0) {
    state.boss.hp = 0;
    killBoss();
  } else if (state.boss.state === 'sleep') {
    state.boss.state = 'awake';
    state.boss.animTime = 0;
    playMonsterGrowl();
  }
}

export function playerTakeDamage(dmg, sourceVec) {
  if (state.gameOver) return;
  state.player.hp -= dmg;
  playHitPlayer();

  if (sourceVec) {
    const dx = state.player.pos.x - sourceVec.x;
    const dz = state.player.pos.z - sourceVec.z;
    const dist = Math.hypot(dx, dz) || 1;
    state.player.vel.x += (dx / dist) * 8;
    state.player.vel.z += (dz / dist) * 8;
  }
}

function killBoss() {
  state.boss.state = 'dead';
  state.boss.animTime = 0;

  playBossDeath();                            // звук смерти

  if (bodyGroup) bodyGroup.visible = false;
  if (auraRing)  auraRing.visible = false;

  // Чистим снаряды
  for (const proj of bossProjectiles) {
    if (proj.mesh.parent) proj.mesh.parent.remove(proj.mesh);
    proj.mesh.geometry.dispose();
    proj.mesh.material.dispose();
  }
  bossProjectiles.length = 0;

  // Чистим метеоры
  if (pendingMeteor && pendingMeteor.telegraph) {
    scene.remove(pendingMeteor.telegraph);
    pendingMeteor.telegraph.geometry.dispose();
    pendingMeteor.telegraph.material.dispose();
    pendingMeteor = null;
  }
  for (const m of activeMeteors) {
    if (m.mesh.parent) m.mesh.parent.remove(m.mesh);
    m.mesh.geometry.dispose();
    m.mesh.material.dispose();
  }
  activeMeteors.length = 0;

  // 8 кусков
  const basePos = bossGroup.position.clone();
  for (let i = 0; i < 8; i++) {
    const piece = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
    );
    piece.position.copy(basePos);
    piece.position.y += 1 + Math.random() * 3;
    piece.position.x += (Math.random() - 0.5) * 2;
    piece.position.z += (Math.random() - 0.5) * 2;
    scene.add(piece);
    deathPieces.push({
      mesh: piece,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        4 + Math.random() * 5,
        (Math.random() - 0.5) * 8
      ),
    });
  }

  // Зажигаем арку
  import('./level.js').then(level => level.activateArch());
}

// ==========================================================================
//  QTE
// ==========================================================================
export function updateQTE(dt) {
  if (!state.qte.active) return;
  state.qte.timer -= dt;

  const keysEl = document.getElementById('qteKeys');
  const timerFill = document.getElementById('qteTimerFill');
  if (keysEl) keysEl.textContent = `${state.qte.mashCount} / ${state.qte.target}`;
  if (timerFill) timerFill.style.width = Math.max(0, (state.qte.timer / CONFIG.boss.qteDuration) * 100) + '%';

  if (state.qte.mashCount >= state.qte.target) {
    endQTE(true);
  } else if (state.qte.timer <= 0) {
    endQTE(false);
  }
}

function startQTE(boss, p) {
  // Сброс клавиш, чтобы не «залипало» движение
  for (const k in keys) keys[k] = false;

  state.qte.active = true;
  state.qte.mashCount = 0;
  state.qte.target = CONFIG.boss.qteTarget;    // 10
  state.qte.timer = CONFIG.boss.qteDuration;

  boss.state = 'qteGrab';
  boss.animTime = 0;
  resetArmPose();
  poseArmsForward();

  const panel = document.getElementById('qtePanel');
  if (panel) panel.classList.remove('hidden');
  const canvas = document.getElementById('game');
  if (canvas) canvas.classList.add('shake');
  playMonsterGrowl();
}

function endQTE(success) {
  state.qte.active = false;

  if (success) {
    bossTakeHit(CONFIG.boss.qteSuccessDamage, 'qte');
    bossStun(3.0);
  } else {
    if (bossGroup) playerTakeDamage(CONFIG.boss.qteDamage, bossGroup.position.clone());
    if (state.boss.state === 'qteGrab') {
      state.boss.state = 'recover';
      state.boss.animTime = 0;
    }
  }

  const panel = document.getElementById('qtePanel');
  if (panel) panel.classList.add('hidden');
  const canvas = document.getElementById('game');
  if (canvas) canvas.classList.remove('shake');
}

// ==========================================================================
//  UPDATE
// ==========================================================================
export function updateBoss(dt) {
  if (!bossGroup) return;
  const boss = state.boss;
  const p = state.player;

  if (boss.state === 'dead') {
    updateDeathPieces(dt);
    boss.animTime += dt;
    if (boss.animTime > 2.0 && bossGroup.parent) {
      scene.remove(bossGroup);
      bossGroup = null;
      for (const d of deathPieces) {
        if (d.mesh.parent) d.mesh.parent.remove(d.mesh);
        d.mesh.geometry.dispose();
        d.mesh.material.dispose();
      }
      deathPieces.length = 0;
    }
    return;
  }

  // Кулдауны
  if (boss.iceCooldown > 0) boss.iceCooldown -= dt;
  if (boss.qteCooldown > 0) boss.qteCooldown -= dt;

  // Сон
  if (boss.state === 'sleep') {
    const inRoom3 = p.pos.x > 50 && p.pos.x < 110 && p.pos.z < -110;
    if (inRoom3) {
      boss.state = 'awake';
      boss.animTime = 0;
      playMonsterGrowl();
    }
    applyIdleAnim(boss, dt);
    updateAura(boss, 0.15);
    updateBossProjectiles(dt);
    updateMeteors(dt, p);
    if (eyeMat) eyeMat.opacity = 0.4;
    return;
  }
  if (eyeMat) eyeMat.opacity = 1.0;

  // QTE-грэб: босс замер
  if (boss.state === 'qteGrab') {
    applyIdleAnim(boss, dt * 0.3);
    poseArmsForward();
    updateAura(boss, 0.6);
    return;
  }

  boss.animTime += dt;
  updateBossProjectiles(dt);
  updateMeteors(dt, p);

  // Поворот к игроку (в любом «активном» стейте)
  if (bodyGroup) {
    const dx = p.pos.x - bossGroup.position.x;
    const dz = p.pos.z - bossGroup.position.z;
    const targetAngle = Math.atan2(dx, dz);
    let diff = targetAngle - bodyGroup.rotation.y;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    bodyGroup.rotation.y += diff * Math.min(1, 5 * dt);
  }

  switch (boss.state) {
    case 'awake':
      applyIdleAnim(boss, dt);
      updateAura(boss, 0.5 + Math.sin(boss.animTime * 8) * 0.3);
      if (boss.animTime >= 1.0) { boss.state = 'chase'; boss.animTime = 0; }
      break;

    case 'chase':
      applyIdleAnim(boss, dt);
      updateAura(boss, 0.25);
      updateChase(boss, p, dt);
      if (boss.attackCooldown <= 0 && !boss._dashing) {
        lastAttack = chooseAttack(boss);
        boss.state = 'windup';
        boss.animTime = 0;
        boss._slamTarget = new THREE.Vector3(p.pos.x, 0, p.pos.z);
      }
      break;

    case 'windup': {
      applyIdleAnim(boss, dt);
      applyWindupAnim(boss);
      updateAura(boss, 0.4 + (boss.animTime / CONFIG.boss.windupTime) * 0.4);
      const dur = lastAttack === 'meteor'? 1.2 : (lastAttack === 'volley' ? 0.5 : CONFIG.boss.windupTime);
      if (lastAttack === 'meteor') updateMeteorTelegraph(boss, dur);
      if (boss.animTime >= dur) {
        boss.state = 'attack';
        boss.animTime = 0;
        if (lastAttack === 'volley') spawnVolley(boss, p);
        if (lastAttack === 'meteor') launchMeteor(boss);
      }
      break;
    }

    case 'attack':
      applyAttackAnim(boss);
      updateAura(boss, 0.8);
      if (boss.animTime >= CONFIG.boss.attackTime) {
        if (lastAttack === 'slam' || lastAttack === 'sweep') applyMeleeDamage(boss, p);
        if (lastAttack === 'shockwave') spawnShockwave(boss, p);
        boss.state = 'recover';
        boss.animTime = 0;
        resetArmPose();
      }
      break;

    case 'recover':
      applyIdleAnim(boss, dt);
      updateAura(boss, 0.15);
      if (boss.animTime >= CONFIG.boss.recoverTime) {
        boss.state = 'chase';
        boss.animTime = 0;
        boss.attackCooldown = lastAttack === 'volley'
        ? 0.1 + Math.random() * 0.2
        : 0.4 + Math.random() * 0.6;
}
      break;

    case 'stunned':
      applyIdleAnim(boss, dt);
      updateAura(boss, 0.1 + Math.abs(Math.sin(boss.animTime * 10)) * 0.4);
      if (boss.animTime >= (boss._stunTimer || CONFIG.boss.stunTime)) {
        boss.state = 'chase';
        boss.animTime = 0;
        boss._stunTimer = 0;
        boss.attackCooldown = 0.5;
        if (bodyDarkMat)   bodyDarkMat.color.setHex(0x2a2a2a);
        if (bodyDarkerMat) bodyDarkerMat.color.setHex(0x1a1a1a);
      }
      break;
  }

  if (boss.attackCooldown > 0) boss.attackCooldown -= dt;

  checkQteTrigger(boss, p);
}

// ==========================================================================
//  CHASE / DASH
// ==========================================================================
function updateChase(boss, p, dt) {
  const dx = p.pos.x - bossGroup.position.x;
  const dz = p.pos.z - bossGroup.position.z;
  const dist = Math.hypot(dx, dz);

  if (boss._dashing) {
    boss._dashTimer += dt;
    const k = Math.min(1, boss._dashTimer / 0.4);
    bossGroup.position.lerpVectors(boss._dashFrom, boss._dashTo, k);
    if (k >= 1) {
      boss._dashing = false;
      spawnBlast(bossGroup.position.clone(), 4, 0xffffff);
      playBossStep();
    }
    return;
  }

  if (dist > 18) {
    // Телепорт-дэш
    boss._dashing = true;
    boss._dashTimer = 0;
    boss._dashFrom = bossGroup.position.clone();
    const stopDist = 3.0;
    boss._dashTo = new THREE.Vector3(
      p.pos.x - (dx / (dist || 1)) * stopDist,
      0,
      p.pos.z - (dz / (dist || 1)) * stopDist
    );
    spawnBlast(boss._dashFrom, 4, 0xffffff);
    playBossStep();
    return;
  }

  if (dist > 2.5) {
    const step = CONFIG.boss.speed * dt;
    const nx = bossGroup.position.x + (dx / dist) * step;
    const nz = bossGroup.position.z + (dz / dist) * step;
    if (!bossCollidesAt(nx, nz)) {
      bossGroup.position.x = nx;
      bossGroup.position.z = nz;

      // звук шага
      boss._stepTimer = (boss._stepTimer || 0) - dt;
      if (boss._stepTimer <= 0) {
        playBossStep();
        boss._stepTimer = 0.55;
      }
    }
  }
}

function bossCollidesAt(x, z) {
  for (const b of colliders) {
    if (b.isRound) {
      const ddx = x - b.x, ddz = z - b.z, r = b.radius + ENEMY_RADIUS;
      if (ddx * ddx + ddz * ddz < r * r) return true;
    } else if (b.min && b.max) {
      if (x > b.min.x - ENEMY_RADIUS && x < b.max.x + ENEMY_RADIUS &&
          z > b.min.z - ENEMY_RADIUS && z < b.max.z + ENEMY_RADIUS) return true;
    }
  }
  return false;
}

// ==========================================================================
//  ВЫБОР АТАК
// ==========================================================================
function chooseAttack(boss) {
  // volley добавлен 3 раза → вероятность выбора ~50% (вместо 25%)
  const opts = ['slam', 'sweep', 'volley', 'volley', 'volley', 'shockwave'];
  if (boss.hp < boss.maxHp * 0.5) opts.push('meteor', 'volley');
  let choice;
  do { choice = opts[Math.floor(Math.random() * opts.length)]; }
  while (choice === lastAttack && opts.length > 1);
  return choice;
}

// ==========================================================================
//  АНИМАЦИИ
// ==========================================================================
function applyIdleAnim(boss, dt) {
  const t = performance.now() * 0.001;
  if (bodyGroup) {
    bodyGroup.position.y = 0.4 + Math.sin(t * 2) * 0.15;
    bodyGroup.rotation.z = Math.sin(t * 1.3) * 0.02;
  }
  for (const c of capePieces) {
    c.mesh.rotation.x = Math.sin(t * 1.5 + c.phase) * 0.1;
    c.mesh.position.y = c.baseY + Math.sin(t * 1.5 + c.phase) * 0.05;
  }
  for (const s of skirtPieces) {
    s.mesh.rotation.z = Math.sin(t * 1.2 + s.phase) * 0.15;
  }
  // Крылья: плавное «дыхание»
  const flap = Math.sin(t * 2.2) * 0.18;
  if (wingL) wingL.rotation.z = 0.15 + flap;
  if (wingR) wingR.rotation.z = 0.15 + flap;
}

function updateAura(boss, opacity) {
  if (!auraRing) return;
  auraRing.material.opacity = Math.max(0, Math.min(1, opacity));
  const pulse = 1.0 + Math.sin(boss.animTime * 4) * 0.1;
  auraRing.scale.setScalar(pulse);
}

function resetArmPose() {
  if (fistL) fistL.position.set(-1.6, 1.55, 0);
  if (fistR) fistR.position.set(1.6, 1.55, 0);
  if (armSegment1L) armSegment1L.position.set(-1.6, 3.8, 0);
  if (armSegment1R) armSegment1R.position.set(1.6, 3.8, 0);
  if (armSegment2L) armSegment2L.position.set(-1.6, 2.5, 0);
  if (armSegment2R) armSegment2R.position.set(1.6, 2.5, 0);
  if (armSegment1L) armSegment1L.rotation.set(0, 0, 0);
  if (armSegment1R) armSegment1R.rotation.set(0, 0, 0);
  if (armSegment2L) armSegment2L.rotation.set(0, 0, 0);
  if (armSegment2R) armSegment2R.rotation.set(0, 0, 0);
}

function poseArmsForward() {
  if (fistL) fistL.position.set(-1.6, 2.5, 1.5);
  if (fistR) fistR.position.set(1.6, 2.5, 1.5);
  if (armSegment1L) armSegment1L.position.set(-1.6, 4.0, 0.7);
  if (armSegment1R) armSegment1R.position.set(1.6, 4.0, 0.7);
  if (armSegment2L) armSegment2L.position.set(-1.6, 3.2, 1.2);
  if (armSegment2R) armSegment2R.position.set(1.6, 3.2, 1.2);
}

function applyWindupAnim(boss) {
  const dur = lastAttack === 'meteor' ? 1.2 : CONFIG.boss.windupTime;
  const t = Math.min(1, boss.animTime / dur);
  const k = Math.sin(t * Math.PI);

  if (lastAttack === 'slam') {
    if (fistR) fistR.position.y = 1.55 + k * 2.2;
    if (armSegment2R) armSegment2R.position.y = 2.5 + k * 1.4;
    if (armSegment1R) armSegment1R.rotation.z = -k * 0.4;
  } else if (lastAttack === 'sweep') {
    if (bodyGroup) bodyGroup.rotation.y -= k * 0.3;
    if (fistL) fistL.position.x = -1.6 - k * 0.8;
    if (fistR) fistR.position.x = 1.6 + k * 0.8;
  } else if (lastAttack === 'volley') {
    if (fistL) fistL.position.y = 1.55 + k * 1.5;
    if (fistR) fistR.position.y = 1.55 + k * 1.5;
  } else if (lastAttack === 'meteor') {
    if (fistL) fistL.position.y = 1.55 + k * 3.5;
    if (fistR) fistR.position.y = 1.55 + k * 3.5;
  } else if (lastAttack === 'shockwave') {
    // оба кулака вздымаются вверх
    if (fistL) fistL.position.y = 1.55 + k * 3.0;
    if (fistR) fistR.position.y = 1.55 + k * 3.0;
    if (armSegment2L) armSegment2L.position.y = 2.5 + k * 1.5;
    if (armSegment2R) armSegment2R.position.y = 2.5 + k * 1.5;
    // крылья раскрываются шире
    if (wingL) wingL.rotation.z = 0.15 + k * 0.5;
    if (wingR) wingR.rotation.z = 0.15 + k * 0.5;
  }
}

function applyAttackAnim(boss) {
  const t = Math.min(1, boss.animTime / CONFIG.boss.attackTime);

  if (lastAttack === 'slam') {
    if (fistR) fistR.position.y = 3.75 - t * 3.75;
    if (armSegment2R) armSegment2R.position.y = 3.9 - t * 2.4;
  } else if (lastAttack === 'sweep') {
    if (fistL) fistL.position.x = -2.4 + t * 1.6;
    if (fistR) fistR.position.x = 2.4 - t * 1.6;
    if (bodyGroup) bodyGroup.rotation.y += t * 0.5;
  } else if (lastAttack === 'shockwave') {
    if (fistL) fistL.position.y = 4.55 - t * 4.55;
    if (fistR) fistR.position.y = 4.55 - t * 4.55;
    if (armSegment2L) armSegment2L.position.y = 4.0 - t * 2.5;
    if (armSegment2R) armSegment2R.position.y = 4.0 - t * 2.5;
    if (wingL) wingL.rotation.z = 0.65 - t * 0.5;
    if (wingR) wingR.rotation.z = 0.65 - t * 0.5;
  }
}

// ==========================================================================
//  УРОН АТАК
// ==========================================================================
function applyMeleeDamage(boss, p) {
  const now = performance.now();
  if (now - lastBossAttackSoundAt > 300) {
    lastBossAttackSoundAt = now;
    playBossSwing();
  }

  if (lastAttack === 'slam') {
    const target = boss._slamTarget || bossGroup.position;
    spawnImpact(new THREE.Vector3(target.x, 0.1, target.z));
    spawnStunRing(target, CONFIG.boss.slamRadius, 0xffffff);

    const dx = p.pos.x - target.x;
    const dz = p.pos.z - target.z;
    if (dx * dx + dz * dz < CONFIG.boss.slamRadius * CONFIG.boss.slamRadius) {
      const feetY = p.pos.y - CONFIG.player.eyeHeight;
      if (feetY < 0.3) {
        playerTakeDamage(CONFIG.boss.slamDamage, target);
      }
    }
  } else if (lastAttack === 'sweep') {
    spawnStunRing(bossGroup.position.clone(), 6, 0xffffff);
    const dx = p.pos.x - bossGroup.position.x;
    const dz = p.pos.z - bossGroup.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.001 && dist < 6) {
      const fwdX = Math.sin(bodyGroup.rotation.y);
      const fwdZ = Math.cos(bodyGroup.rotation.y);
      if ((dx * fwdX + dz * fwdZ) / dist > 0.3) {
        playerTakeDamage(CONFIG.boss.sweepDamage, bossGroup.position.clone());
      }
    }
  }
}

// ==========================================================================
//  SHOCKWAVE — круговой залп снарядов из земли
// ==========================================================================
function spawnShockwave(boss, p) {
  playBossShockwave();

  const origin = new THREE.Vector3(bossGroup.position.x, 0.8, bossGroup.position.z);
  const count = CONFIG.boss.shockwaveProjectiles || 12;
  const speed = 11;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(angle), 0.08, Math.sin(angle)).normalize();
    spawnBossProjectile(origin.clone(), dir, speed, CONFIG.boss.shockwaveDamage);
  }

  spawnStunRing(bossGroup.position.clone(), 5, 0xaaaaaa);
  spawnBlast(new THREE.Vector3(bossGroup.position.x, 1, bossGroup.position.z), 3, 0x666666);

  // урон вблизи
  const dx = p.pos.x - bossGroup.position.x;
  const dz = p.pos.z - bossGroup.position.z;
  if (dx * dx + dz * dz < 9) {
    const feetY = p.pos.y - CONFIG.player.eyeHeight;
    if (feetY < 0.4) playerTakeDamage(CONFIG.boss.shockwaveDamage, bossGroup.position.clone());
  }
}

// ==========================================================================
//  СНАРЯДЫ (volley)
// ==========================================================================
function spawnVolley(boss, p) {
  playBossVolley();

  const origin = new THREE.Vector3(bossGroup.position.x, 3.5, bossGroup.position.z);
  tmpA.set(p.pos.x, p.pos.y - 0.5, p.pos.z).sub(origin).normalize();

  for (let i = -1; i <= 1; i++) {
    const angle = i * 0.15;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const dir = new THREE.Vector3(
      tmpA.x * cos - tmpA.z * sin,
      tmpA.y,
      tmpA.x * sin + tmpA.z * cos
    ).normalize();
    spawnBossProjectile(origin.clone(), dir, 12, CONFIG.boss.volleyDamage);
  }
}

function spawnBossProjectile(start, dir, speed, damage) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.95 })
  );
  mesh.position.copy(start);
  scene.add(mesh);
  bossProjectiles.push({ mesh, dir: dir.clone(), speed, damage, life: 4.0 });
}

export function destroyBossProjectile(proj) {
  if (!proj) return;
  if (proj.mesh.parent) proj.mesh.parent.remove(proj.mesh);
  proj.mesh.geometry.dispose();
  proj.mesh.material.dispose();
  const i = bossProjectiles.indexOf(proj);
  if (i !== -1) bossProjectiles.splice(i, 1);
}

function bossProjHitsWall(pos, radius) {
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

function updateBossProjectiles(dt) {
  const p = state.player;
  for (let i = bossProjectiles.length - 1; i >= 0; i--) {
    const proj = bossProjectiles[i];
    proj.life -= dt;
    let kill = proj.life <= 0;

    if (!kill) {
      let rem = proj.speed * dt;
      while (rem > 0 && !kill) {
        const step = Math.min(0.3, rem);
        proj.mesh.position.addScaledVector(proj.dir, step);
        rem -= step;

        const dx = proj.mesh.position.x - p.pos.x;
        const dy = proj.mesh.position.y - (p.pos.y - 0.5);
        const dz = proj.mesh.position.z - p.pos.z;
        if (dx * dx + dy * dy + dz * dz < 0.9 * 0.9) {
          playerTakeDamage(proj.damage, proj.mesh.position.clone());
          kill = true;
          break;
        }
        if (bossProjHitsWall(proj.mesh.position, 0.25)) {
          spawnImpact(proj.mesh.position.clone());
          kill = true;
          break;
        }
      }
    }

    if (kill) destroyBossProjectile(proj);
  }
}

// ==========================================================================
//  МЕТЕОР
// ==========================================================================
function updateMeteorTelegraph(boss, dur) {
  if (!pendingMeteor || !pendingMeteor.telegraph) return;
  const k = Math.min(1, boss.animTime / dur);
  pendingMeteor.telegraph.scale.setScalar(1 + k * 2);
  pendingMeteor.telegraph.material.opacity = 0.3 + k * 0.5;
}

function launchMeteor(boss) {
  if (!pendingMeteor) return;
  const target = pendingMeteor.target;

  if (pendingMeteor.telegraph) {
    scene.remove(pendingMeteor.telegraph);
    pendingMeteor.telegraph.geometry.dispose();
    pendingMeteor.telegraph.material.dispose();
  }
  pendingMeteor = null;

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0x444444 })
  );
  ball.position.set(target.x, 14, target.z);
  scene.add(ball);
  activeMeteors.push({ mesh: ball, target });
}

function updateMeteors(dt, p) {
  for (let i = activeMeteors.length - 1; i >= 0; i--) {
    const m = activeMeteors[i];
    m.mesh.position.y -= 30 * dt;
    m.mesh.rotation.x += dt * 4;
    m.mesh.rotation.z += dt * 3;

    if (m.mesh.position.y <= 0.5) {
      spawnBlast(new THREE.Vector3(m.mesh.position.x, 1, m.mesh.position.z), 3.0, 0x666666);
      const dx = p.pos.x - m.mesh.position.x;
      const dz = p.pos.z - m.mesh.position.z;
      if (dx * dx + dz * dz < 3.0 * 3.0) {
        playerTakeDamage(CONFIG.boss.meteorDamage, m.mesh.position.clone());
      }
      if (m.mesh.parent) m.mesh.parent.remove(m.mesh);
      m.mesh.geometry.dispose();
      m.mesh.material.dispose();
      activeMeteors.splice(i, 1);
    }
  }
}

// ==========================================================================
//  QTE-ТРИГГЕР
// ==========================================================================
function checkQteTrigger(boss, p) {
  if (state.qte.active) return;
  if (boss.state === 'sleep' || boss.state === 'dead' || boss.state === 'stunned') return;
  if (boss.state === 'qteGrab') return;

  const dx = p.pos.x - bossGroup.position.x;
  const dz = p.pos.z - bossGroup.position.z;
  const dist = Math.hypot(dx, dz);

  // Форсированный QTE при < 50% HP
  if (!boss.qteTriggeredPhase2 && boss.hp < boss.maxHp * 0.5 && dist < 8) {
    boss.qteTriggeredPhase2 = true;
    startQTE(boss, p);
    return;
  }

  if (boss.qteCooldown <= 0 && dist < 6) {
    boss.qteCooldown = CONFIG.boss.qteInterval;
    startQTE(boss, p);
  }
}

// ==========================================================================
//  СМЕРТЬ: куски
// ==========================================================================
function updateDeathPieces(dt) {
  for (const p of deathPieces) {
    p.vel.y -= 18 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.rotation.x += dt * 3;
    p.mesh.rotation.z += dt * 2;
    if (p.mesh.position.y <= 0.3) {
      p.mesh.position.y = 0.3;
      p.vel.y *= -0.3;
      p.vel.x *= 0.6;
      p.vel.z *= 0.6;
    }
  }
}