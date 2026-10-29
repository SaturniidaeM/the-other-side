export const CONFIG = {
  graphics: { pixelScale: 0.35, fov: 75, near: 0.05, far: 300, fogNear: 50, fogFar: 180 },
  player: {
    eyeHeight: 1.7, radius: 0.4,
    speed: 7.0,
    sprintMultiplier: 1.6,
    accelGround: 14,
    accelAir: 5,
    jumpSpeed: 9.0,
    gravity: 18,
    dashSpeed: 30,
    dashDuration: 0.25,
    dashCooldown: 0.9,
    maxHp: 100, maxMana: 200, manaRegen: 12,   // было maxMana: 120
  },
  weapon: { magSize: 30, fireRate: 0.15, range: 100, reloadTime: 1.5, reloadManaCost: 30 },
  spells: {
    castDistance: 8,
    list: [
      { key: '1', name: 'ЛЕД (СТАН)',   cost: 25, radius: 6, color: 0x55ccff, projectileSpeed: 18, projectileColor: 0x55ccff, circleTex: 'icemagic.png' },
      { key: '2', name: 'ОГОНЬ (ВЗРЫВ)', cost: 40, radius: 5, color: 0xff5500, projectileSpeed: 14, projectileColor: 0xff5500, circleTex: 'firemagic.png' },
    ],
  },
   boss: {
    maxHp: 1100,                       // было 600
    speed: 2.2,
    slamRadius: 4,
    slamDamage: 25,
    sweepDamage: 20,
    volleyDamage: 22,                  // было 15 — теперь от залпа больно
    meteorDamage: 36,                  // было 30
    shockwaveDamage: 26,               // было 18 — веером больно ловить
    shockwaveProjectiles: 12,
    windupTime: 0.8,
    attackTime: 0.3,
    recoverTime: 0.9,
    stunTime: 2.5,
    qteInterval: 15,
    qteDamage: 40,
    qteSuccessDamage: 150,
    qteDuration: 3.0,
    qteTarget: 10,                     // было 15 — QTE стало короче
},
  input: { sensitivity: 0.0022 },
};
