import { scene } from './engine.js';
import { state } from './state.js';
import { spawnMonster2 } from './enemies.js';

export const worldObjects = [];
export const colliders = [];
export const platforms = [];
export const targets = [];
export let npcMesh;

// ===== Точка сохранения (дом) =====
export const savePointPos = new THREE.Vector3(4, 0, 15);
export let saveOrbMesh = null;

// ===== Точка сохранения (коридор) =====
export const savePointPosCorridor = new THREE.Vector3(28, 0, 0);
export let saveOrbMeshCorridor = null;

// ===== Точка сохранения (коридор 2) =====
export const savePointPosCorridor2 = new THREE.Vector3(72, 0, -72);
export let saveOrbMeshCorridor2 = null;

// ===== Дверь дома =====
let doorMesh = null;
let doorCollider = null;

// ===== Гейт в коридор =====
let gateMesh = null;
let gateCollider = null;

// ===== Гейт 2 (выход из комнаты 2 в коридор 2) =====
let gate2Mesh = null;
let gate2Collider = null;

export function setDoorOpen(isOpen) {
  if (doorMesh) {
    doorMesh.visible = !isOpen;
  }
  if (doorCollider) {
    const idx = colliders.indexOf(doorCollider);
    if (isOpen && idx !== -1) {
      colliders.splice(idx, 1);
    } else if (!isOpen && idx === -1) {
      colliders.push(doorCollider);
    }
  }
}

export function setGateOpen(isOpen) {
  if (gateMesh) {
    gateMesh.visible = !isOpen;
  }
  if (gateCollider) {
    const idx = colliders.indexOf(gateCollider);
    if (isOpen && idx !== -1) {
      colliders.splice(idx, 1);
    } else if (!isOpen && idx === -1) {
      colliders.push(gateCollider);
    }
  }
}

export function setGate2Open(isOpen) {
  if (gate2Mesh) gate2Mesh.visible = !isOpen;
  if (gate2Collider) {
    const idx = colliders.indexOf(gate2Collider);
    if (isOpen && idx !== -1) colliders.splice(idx, 1);
    else if (!isOpen && idx === -1) colliders.push(gate2Collider);
  }
}

// ===== Смена текстуры NPC =====
const textureLoader = new THREE.TextureLoader();
export function setNPCTexture(texName) {
  if (!npcMesh) return;
  const tex = textureLoader.load(`assets/${texName}`);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  npcMesh.material.map = tex;
  npcMesh.material.needsUpdate = true;
}

// ===== Арка-ворота =====
let archGlowMat = null;
let archLight = null;
export function activateArch() {
  if (archGlowMat) archGlowMat.color.setHex(0xffffff);
  if (archLight) archLight.intensity = 2.5;
}

function makeGridTexture(repeat = 1) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, S - 4, S - 4);
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S); ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2); ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.repeat.set(repeat, repeat);
  return tex;
}

function makeBuildingTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, 256, 512);

  for (let y = 30; y < 480; y += 40) {
    for (let x = 20; x < 236; x += 40) {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(x, y, 20, 25);
      ctx.strokeStyle = '#141414';
      ctx.strokeRect(x, y, 20, 25);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

export function buildLevel() {
  const floorTex = makeGridTexture(80);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshLambertMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor); worldObjects.push(floor);

  const buildingTex = makeBuildingTexture();
  buildingTex.repeat.set(2, 1);
  const wallMat = new THREE.MeshLambertMaterial({ map: buildingTex });

  const H = 15;

  function addWall(x, z, w, d) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat);
    mesh.position.set(x, H / 2, z);
    scene.add(mesh); worldObjects.push(mesh);
    colliders.push({
      min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
      max: new THREE.Vector3(x + w / 2, H, z + d / 2)
    });
  }

  // ================= КОМНАТА 1 =================
  addWall(-20, 0, 1, 56);
  addWall(0, -28, 40, 1);
  addWall(0, 28, 40, 1);
  addWall(20, -16, 1, 24);
  addWall(20, 16, 1, 24);

  // ===== ГЕЙТ В КОРИДОР =====
  const gateMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  gateMesh = new THREE.Mesh(new THREE.BoxGeometry(1, H, 8), gateMat);
  gateMesh.position.set(20, H / 2, 0);
  scene.add(gateMesh); worldObjects.push(gateMesh);

  gateCollider = {
    min: new THREE.Vector3(19.5, 0, -4),
    max: new THREE.Vector3(20.5, H, 4)
  };
  colliders.push(gateCollider);

  // ================= КОРИДОР 1 =================
  addWall(28, -4, 16, 1);
  addWall(32, 4, 24, 1);
  addWall(36, -22, 1, 36);
  addWall(44, -18, 1, 44);

  // ===== ТОЧКА СОХРАНЕНИЯ В КОРИДОРЕ =====
  const savePedestalCorr = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.6, 0.6, 8),
    new THREE.MeshLambertMaterial({ color: 0x555555 })
  );
  savePedestalCorr.position.set(savePointPosCorridor.x, 0.3, savePointPosCorridor.z);
  scene.add(savePedestalCorr); worldObjects.push(savePedestalCorr);

  colliders.push({
    min: new THREE.Vector3(savePointPosCorridor.x - 0.45, 0, savePointPosCorridor.z - 0.45),
    max: new THREE.Vector3(savePointPosCorridor.x + 0.45, 0.6, savePointPosCorridor.z + 0.45)
  });

  const safeTexCorr = textureLoader.load('assets/safe.png');
  safeTexCorr.magFilter = THREE.NearestFilter;
  safeTexCorr.minFilter = THREE.NearestFilter;

  saveOrbMeshCorridor = new THREE.Sprite(new THREE.SpriteMaterial({ map: safeTexCorr, transparent: true }));
  saveOrbMeshCorridor.scale.set(1.2, 1.2, 1);
  saveOrbMeshCorridor.position.set(savePointPosCorridor.x, 1.2, savePointPosCorridor.z);
  scene.add(saveOrbMeshCorridor);
  worldObjects.push(saveOrbMeshCorridor);

  const saveLightCorr = new THREE.PointLight(0xffffff, 0.7, 6);
  saveLightCorr.position.set(savePointPosCorridor.x, 1.5, savePointPosCorridor.z);
  scene.add(saveLightCorr);

  // ================= КОМНАТА 2 =================
  addWall(35, -106, 50, 1);
  addWall(10, -73, 1, 66);
  addWall(60, -91, 1, 30);
  addWall(60, -54, 1, 28);
  addWall(23, -40, 26, 1);
  addWall(52, -40, 16, 1);

  // ================= ДЕКОР КОМНАТЫ 2 =================
  function addPillar(x, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, H, 2), wallMat);
    mesh.position.set(x, H / 2, z);
    scene.add(mesh); worldObjects.push(mesh);
    colliders.push({
      min: new THREE.Vector3(x - 1, 0, z - 1),
      max: new THREE.Vector3(x + 1, H, z + 1)
    });
  }
  addPillar(22, -60);
  addPillar(48, -60);
  addPillar(22, -85);
  addPillar(48, -85);

  // ================= КОРИДОР 2 =================
  addWall(68, -76, 16, 1);
  addWall(72, -68, 24, 1);
  addWall(76, -93, 1, 34);
  addWall(84, -89, 1, 42);

  // ===== ГЕЙТ 2 (выход из комнаты 2 в коридор 2) =====
  {
    const gate2Mat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    gate2Mesh = new THREE.Mesh(new THREE.BoxGeometry(1, H, 8), gate2Mat);
    gate2Mesh.position.set(60, H / 2, -72);
    scene.add(gate2Mesh); worldObjects.push(gate2Mesh);

    gate2Collider = {
      min: new THREE.Vector3(59.5, 0, -76),
      max: new THREE.Vector3(60.5, H, -68)
    };
    colliders.push(gate2Collider);
  }

  // ===== ТОЧКА СОХРАНЕНИЯ В КОРИДОРЕ 2 =====
  {
    const savePedestalCorr2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.6, 0.6, 8),
      new THREE.MeshLambertMaterial({ color: 0x555555 })
    );
    savePedestalCorr2.position.set(savePointPosCorridor2.x, 0.3, savePointPosCorridor2.z);
    scene.add(savePedestalCorr2); worldObjects.push(savePedestalCorr2);

    colliders.push({
      min: new THREE.Vector3(savePointPosCorridor2.x - 0.45, 0, savePointPosCorridor2.z - 0.45),
      max: new THREE.Vector3(savePointPosCorridor2.x + 0.45, 0.6, savePointPosCorridor2.z + 0.45)
    });

    const safeTexCorr2 = textureLoader.load('assets/safe.png');
    safeTexCorr2.magFilter = THREE.NearestFilter;
    safeTexCorr2.minFilter = THREE.NearestFilter;

    saveOrbMeshCorridor2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: safeTexCorr2, transparent: true }));
    saveOrbMeshCorridor2.scale.set(1.2, 1.2, 1);
    saveOrbMeshCorridor2.position.set(savePointPosCorridor2.x, 1.2, savePointPosCorridor2.z);
    scene.add(saveOrbMeshCorridor2);
    worldObjects.push(saveOrbMeshCorridor2);

    const saveLightCorr2 = new THREE.PointLight(0xffffff, 0.7, 6);
    saveLightCorr2.position.set(savePointPosCorridor2.x, 1.5, savePointPosCorridor2.z);
    scene.add(saveLightCorr2);
  }

  // ================= КОМНАТА 3 =================
  addWall(80, -180, 60, 1);
  addWall(50, -145, 1, 70);
  addWall(110, -145, 1, 70);
  addWall(63, -110, 26, 1);
  addWall(97, -110, 26, 1);

  // ============ КОМНАТА 3: КРУГЛЫЕ СВЕТЛЫЕ КОЛОННЫ ============
  const lightPillarMat = new THREE.MeshLambertMaterial({ color: 0xa5a5a5 });

  function addRoundPillar(x, z, r = 1.0, h = 15) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.3, r * 1.45, 0.5, 18), lightPillarMat);
    base.position.set(x, 0.25, z);
    scene.add(base); worldObjects.push(base);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h - 1.0, 18), lightPillarMat);
    shaft.position.set(x, h / 2, z);
    scene.add(shaft); worldObjects.push(shaft);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.45, r * 1.3, 0.5, 18), lightPillarMat);
    cap.position.set(x, h - 0.25, z);
    scene.add(cap); worldObjects.push(cap);

    colliders.push({
      isRound: true,
      x, z, radius: r * 1.05,
      min: new THREE.Vector3(x - r, 0, z - r),
      max: new THREE.Vector3(x + r, h, z + r)
    });
  }

  addRoundPillar(65, -125);
  addRoundPillar(95, -125);
  addRoundPillar(65, -165);
  addRoundPillar(95, -165);

  // ================= СВЕТ =================
  const room2Light = new THREE.PointLight(0x555555, 0.8, 100);
  room2Light.position.set(35, 12, -73);
  scene.add(room2Light);

  const corridorLight = new THREE.PointLight(0x444444, 0.6, 50);
  corridorLight.position.set(25, 8, 0);
  scene.add(corridorLight);

  const corridor2Light = new THREE.PointLight(0x444444, 0.6, 60);
  corridor2Light.position.set(72, 8, -72);
  scene.add(corridor2Light);

  const room3Light = new THREE.PointLight(0x555555, 0.85, 130);
  room3Light.position.set(80, 14, -145);
  scene.add(room3Light);

  // =====================================================================
  //                        ДОМИК ГЕРОЯ
  // =====================================================================
  const HOUSE_H = 4.0;
  const HOUSE_CZ = 18;

  function addHouseWall(x, z, w, d) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, HOUSE_H, d), wallMat);
    mesh.position.set(x, HOUSE_H / 2, z);
    scene.add(mesh); worldObjects.push(mesh);
    colliders.push({
      min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
      max: new THREE.Vector3(x + w / 2, HOUSE_H, z + d / 2)
    });
  }

  addHouseWall(-4, 13, 4, 0.5);
  addHouseWall( 4, 13, 4, 0.5);

  // ---- ДВЕРЬ ----
  doorMesh = new THREE.Mesh(new THREE.BoxGeometry(4, HOUSE_H, 0.5), wallMat);
  doorMesh.position.set(0, HOUSE_H / 2, 13);
  scene.add(doorMesh);
  worldObjects.push(doorMesh);

  doorCollider = {
    min: new THREE.Vector3(-2, 0, 13 - 0.25),
    max: new THREE.Vector3(2, HOUSE_H, 13 + 0.25)
  };
  colliders.push(doorCollider);

  addHouseWall(0, 23, 12, 0.5);
  addHouseWall(-6, HOUSE_CZ, 0.5, 10);
  addHouseWall( 6, HOUSE_CZ, 0.5, 10);

  const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(13, 0.3, 11), wallMat);
  roofMesh.position.set(0, HOUSE_H, HOUSE_CZ);
  scene.add(roofMesh); worldObjects.push(roofMesh);

  const houseLight = new THREE.PointLight(0xaaaaaa, 0.9, 12);
  houseLight.position.set(0, 3.4, HOUSE_CZ);
  scene.add(houseLight);

  // ---- Чучела (target.png) ----
  const targetTex = textureLoader.load('assets/target.png');
  targetTex.magFilter = THREE.NearestFilter;
  targetTex.minFilter = THREE.NearestFilter;

  function addTrainingTarget(x, z) {
    const mat = new THREE.MeshBasicMaterial({ map: targetTex, transparent: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.5), mat);
    mesh.position.set(x, 0.75, z);
    mesh.rotation.y = Math.PI;
    scene.add(mesh);
    worldObjects.push(mesh);
    targets.push({ mesh, x, z, respawnTimer: 0 });
  }

  addTrainingTarget(-3, 21);
  addTrainingTarget( 0, 21);
  addTrainingTarget( 3, 21);

  // ---- Точка сохранения (дом) ----
  const savePedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.6, 0.6, 8),
    new THREE.MeshLambertMaterial({ color: 0x555555 })
  );
  savePedestal.position.set(savePointPos.x, 0.3, savePointPos.z);
  scene.add(savePedestal); worldObjects.push(savePedestal);

  colliders.push({
    min: new THREE.Vector3(savePointPos.x - 0.45, 0, savePointPos.z - 0.45),
    max: new THREE.Vector3(savePointPos.x + 0.45, 0.6, savePointPos.z + 0.45)
  });

  const safeTex = textureLoader.load('assets/safe.png');
  safeTex.magFilter = THREE.NearestFilter;
  safeTex.minFilter = THREE.NearestFilter;

  saveOrbMesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: safeTex, transparent: true }));
  saveOrbMesh.scale.set(1.2, 1.2, 1);
  saveOrbMesh.position.set(savePointPos.x, 1.2, savePointPos.z);
  scene.add(saveOrbMesh);
  worldObjects.push(saveOrbMesh);

  const saveLight = new THREE.PointLight(0xffffff, 0.7, 6);
  saveLight.position.set(savePointPos.x, 1.5, savePointPos.z);
  scene.add(saveLight);

  // =====================================================================
  //                              NPC
  // =====================================================================
  const npcTex = textureLoader.load('assets/happynpc.png');
  const npcMat = new THREE.MeshBasicMaterial({ map: npcTex, transparent: true, side: THREE.DoubleSide });
  npcMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.5), npcMat);
  npcMesh.position.set(-10, 1.25, 0);
  npcMesh.rotation.y = Math.PI / 2;
  scene.add(npcMesh); worldObjects.push(npcMesh);

  // =====================================================================
  //            ДЕКОР ПЕРВОЙ КОМНАТЫ — РУИНЫ ГОРОДА
  // =====================================================================
  const decoConcrete = new THREE.MeshLambertMaterial({ color: 0x505050 });
  const decoDark     = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const decoMetal    = new THREE.MeshLambertMaterial({ color: 0x5a5a5a });
  const decoRust     = new THREE.MeshLambertMaterial({ color: 0x424242 });
  const decoTire     = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const decoGlass    = new THREE.MeshLambertMaterial({ color: 0x6a6a6a, transparent: true, opacity: 0.4 });
  const decoLampGlow = new THREE.MeshBasicMaterial({ color: 0xdddddd });

  function addProp(x, yBase, z, w, h, d, mat, opts = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, yBase + h / 2, z);
    scene.add(mesh);
    worldObjects.push(mesh);

    if (opts.collide !== false) {
      colliders.push({
        min: new THREE.Vector3(x - w / 2, yBase, z - d / 2),
        max: new THREE.Vector3(x + w / 2, yBase + h, z + d / 2)
      });
    }
    if (opts.platform) {
      platforms.push({
        min: new THREE.Vector3(x - w / 2, yBase, z - d / 2),
        max: new THREE.Vector3(x + w / 2, yBase + h, z + d / 2)
      });
    }
    return mesh;
  }

  function addStreetLamp(x, z) {
    addProp(x, 0, z, 0.55, 0.35, 0.55, decoDark);
    addProp(x, 0.35, z, 0.14, 5.4, 0.14, decoMetal);
    addProp(x + 0.55, 5.55, z, 1.1, 0.1, 0.1, decoMetal, { collide: false });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.4), decoLampGlow);
    lamp.position.set(x + 1.05, 5.4, z);
    scene.add(lamp); worldObjects.push(lamp);
    const light = new THREE.PointLight(0x999999, 0.65, 15);
    light.position.set(x + 1.05, 5.2, z);
    scene.add(light);
  }

  function addBusStop(x, z) {
    const W = 4, D = 1.7, H = 2.4;
    const bx = x - W / 2;

    addProp(bx, 0, z, 0.12, H, D, decoGlass);
    addProp(x, 0, z - D / 2, W, H, 0.12, decoGlass);
    addProp(x, 0, z + D / 2, W, H, 0.12, decoGlass);
    addProp(x, H, z, W + 0.4, 0.16, D + 0.4, decoDark, { collide: false });

    addProp(bx + 0.55, 0.5, z, 0.55, 0.1, D - 0.5, decoRust, { collide: false, platform: true });
    addProp(bx + 0.55, 0, z - 0.5, 0.1, 0.5, 0.1, decoMetal, { collide: false });
    addProp(bx + 0.55, 0, z + 0.5, 0.1, 0.5, 0.1, decoMetal, { collide: false });

    addProp(x + W / 2 - 0.15, H + 0.16, z, 0.06, 0.5, 1.3, decoRust, { collide: false });
  }

  function addCar(x, z) {
    const bodyW = 5.2, bodyD = 2.2, bodyTop = 1.05;

    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.28, 8);
    for (const [wx, wz] of [[-1.65, 1.05], [1.65, 1.05], [-1.65, -1.05], [1.65, -1.05]]) {
      const wheel = new THREE.Mesh(wheelGeo, decoTire);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x + wx, 0.4, z + wz);
      scene.add(wheel); worldObjects.push(wheel);
    }

    addProp(x, 0.3, z, bodyW, bodyTop - 0.3, bodyD, decoDark, { platform: true });

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.95), decoMetal);
    cabin.position.set(x - 0.4, bodyTop + 0.25, z);
    scene.add(cabin); worldObjects.push(cabin);

    const win = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.38, 1.9), new THREE.MeshBasicMaterial({ color: 0x151515 }));
    win.position.set(x - 0.4, bodyTop + 0.25, z);
    scene.add(win); worldObjects.push(win);
  }

  function addBrokenColumn(x, z) {
    addProp(x, 0, z, 1.2, 4, 1.2, decoConcrete);
    addProp(x + 0.15, 4, z - 0.1, 0.9, 0.35, 0.9, decoConcrete, { collide: false });
  }

  function addCrate(x, z, size) {
    addProp(x, 0, z, size, size, size, decoRust, { platform: true });
  }

  function addBigCrate(x, z, size = 1.5) {
    addProp(x, 0, z, size, size, size, decoRust, { platform: true });
  }

  function addBarrier(x, z, w) {
    addProp(x, 0, z, w, 0.9, 0.4, decoConcrete, { platform: true });
  }

  function addConcreteBlock(x, z, w = 2.0, h = 1.2, d = 1.2) {
    addProp(x, 0, z, w, h, d, decoConcrete, { platform: true });
  }

  function addBrokenWall(x, z, w, d, height = 2.5) {
    addProp(x, 0, z, w, height, d, decoConcrete, { platform: true });

    const topPieces = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < topPieces; i++) {
      const bw = 0.2 + Math.random() * 0.5;
      const bh = 0.15 + Math.random() * 0.45;
      const bd = 0.2 + Math.random() * 0.5;
      const along = Math.random() - 0.5;
      const px = x + (w > d ? along * (w - 0.5) : 0) + (Math.random() - 0.5) * 0.3;
      const pz = z + (d > w ? along * (d - 0.5) : 0) + (Math.random() - 0.5) * 0.3;
      addProp(px, height, pz, bw, bh, bd, Math.random() > 0.5 ? decoConcrete : decoDark, { collide: false });
    }

    for (let i = 0; i < 4; i++) {
      addProp(
        x + (Math.random() - 0.5) * (w + 1.2),
        0,
        z + (Math.random() - 0.5) * (d + 1.2),
        0.2 + Math.random() * 0.35,
        0.1 + Math.random() * 0.25,
        0.2 + Math.random() * 0.35,
        Math.random() > 0.5 ? decoConcrete : decoDark,
        { collide: false }
      );
    }
  }

  function addRubble(x, z) {
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const w = 0.2 + Math.random() * 0.4;
      const h = 0.1 + Math.random() * 0.3;
      const d = 0.2 + Math.random() * 0.4;
      const rx = x + (Math.random() - 0.5) * 1.4;
      const rz = z + (Math.random() - 0.5) * 1.4;
      addProp(rx, 0, rz, w, h, d, Math.random() > 0.5 ? decoConcrete : decoDark, { collide: false });
    }
  }

  // ================= РАССТАНОВКА =================
  addStreetLamp(-16, -8);
  addStreetLamp(16, -18);
  addStreetLamp(-16, 16);

  addBusStop(-14, 6);

  addCar(-12, -18);
  addCar(13, 10);
  addCar(11, -12);

  addBrokenColumn(-8, -22);
  addBrokenColumn(8, -22);
  addBrokenColumn(-8, -8);
  addBrokenColumn(16, 0);

  addCrate(-4, -8, 0.8);
  addCrate(7, -6, 0.9);
  addCrate(-9, -16, 1.0);
  addCrate(11, -25, 0.85);
  addCrate(2, -5, 0.7);
  addCrate(-2, -12, 0.7);

  addCrate(-15, 12, 1.1);
  addCrate(-11, -20, 0.75);
  addCrate(5, -25, 0.9);
  addBigCrate(-6, -4, 1.5);
  addBigCrate(9, 3, 1.4);
  addBigCrate(15, 20, 1.3);

  addBarrier(-3, -18, 3.0);
  addBarrier(4, -20, 2.0);
  addBarrier(10, -8, 2.5);
  addBarrier(-11, -12, 2.0);

  addConcreteBlock(-14, -5, 2.4, 1.1, 1.4);
  addConcreteBlock(6, -16, 1.8, 1.4, 1.2);
  addConcreteBlock(-6, 8, 2.0, 0.9, 1.2);
  addConcreteBlock(13, 15, 1.5, 1.6, 1.0);
  addConcreteBlock(-15, -10, 1.6, 0.8, 1.6);

  addBrokenWall(-13, -25, 3.0, 0.5, 2.5);
  addBrokenWall(12, -25, 2.5, 0.5, 2.2);
  addBrokenWall(-15, 20, 0.5, 3.0, 2.8);
  addBrokenWall(16, 14, 0.5, 2.5, 2.4);

  addRubble(-18, -26);
  addRubble(-16, -24);
  addRubble(-19, -22);
  addRubble(-15, -27);

  addRubble(18, -26);
  addRubble(16, -24);
  addRubble(19, -22);
  addRubble(16, -27);

  addRubble(-18, 26);
  addRubble(-16, 24);
  addRubble(-19, 22);
  addRubble(-17, 27);

  addRubble(18, 26);
  addRubble(16, 24);
  addRubble(19, 22);

  addRubble(-5, -20);
  addRubble(14, -25);
  addRubble(18, -5);
  addRubble(-17, -2);
  addRubble(5, 8);
  addRubble(-10, 10);
  addRubble(12, -20);
  addRubble(-12, 15);
  addRubble(8, -3);
  addRubble(16, -10);

  // =====================================================================
  //     ДЕКОР ВТОРОЙ КОМНАТЫ — БОЛЬШИЕ ЗАПРЫГИВАЕМЫЕ РУИНЫ
  // =====================================================================
  function addRuinTower(x, z, baseW = 7, baseD = 7, totalH = 10) {
    addProp(x, 0, z, baseW, totalH, baseD, decoConcrete, { platform: true });
    addProp(x + 0.3, totalH, z - 0.2, baseW * 0.55, 2, baseD * 0.55, decoDark, { platform: true });

    for (let i = 0; i < 10; i++) {
      addProp(
        x + 0.3 + (Math.random() - 0.5) * baseW * 0.55,
        totalH + 2 + Math.random() * 0.6,
        z - 0.2 + (Math.random() - 0.5) * baseD * 0.55,
        0.3 + Math.random() * 0.6,
        0.2 + Math.random() * 0.8,
        0.3 + Math.random() * 0.6,
        Math.random() > 0.5 ? decoConcrete : decoDark,
        { collide: false }
      );
    }

    const rise = 0.75, depth = 0.7, width = 1.5;
    const nSteps = Math.ceil(totalH / rise);
    const stairX = x - baseW / 2 + width / 2 + 0.4;
    const topZ  = z + baseD / 2 + depth / 2 + 0.05;
    for (let i = 0; i < nSteps; i++) {
      addProp(stairX, i * rise, topZ + (nSteps - 1 - i) * depth, width, rise, depth, decoDark, { platform: true });
    }

    addRubble(x + baseW * 0.7, z + 0.3);
    addRubble(x - baseW * 0.6, z - 0.4);
    addRubble(x + 0.3, z + baseD * 0.8);
  }

  function addRuinFacade(x, z, w = 12, h = 8) {
    const t = 0.8, doorW = 2.5;
    const wallH1 = h * 0.4;
    const sideW = (w - doorW) / 2;

    addProp(x - doorW / 2 - sideW / 2, 0, z, sideW, wallH1, t, decoConcrete, { platform: true });
    addProp(x + doorW / 2 + sideW / 2, 0, z, sideW, wallH1, t, decoConcrete, { platform: true });

    const segW = 2.2;
    const nSegs = Math.floor(w / segW);
    const startX = x - (nSegs * segW) / 2 + segW / 2;
    for (let i = 0; i < nSegs; i++) {
      const sx = startX + i * segW;
      if (Math.random() < 0.18) continue;
      const segH = h * 0.5 + Math.random() * h * 0.3;
      addProp(sx, wallH1, z, segW * 0.9, segH, t, decoConcrete, { platform: true });
      if (Math.random() > 0.5) {
        addProp(sx, wallH1 + segH, z, segW * 0.9, 0.25, t, decoDark, { collide: false });
      }
    }

    const rise = 0.7, depth = 0.7;
    const totalH = wallH1 + h * 0.7;
    const nSteps = Math.ceil(totalH / rise);
    const stairX = x - w / 2 - 0.8;
    const topZ  = z + t / 2 + depth / 2 + 0.1;
    for (let i = 0; i < nSteps; i++) {
      addProp(stairX, i * rise, topZ + (nSteps - 1 - i) * depth, 1.2, rise, depth, decoDark, { platform: true });
    }

    for (let i = 0; i < 5; i++) {
      addProp(
        x + (Math.random() - 0.5) * w,
        0, z + 1.0 + Math.random() * 1.2,
        0.7 + Math.random() * 0.9,
        0.15 + Math.random() * 0.2,
        0.4 + Math.random() * 0.5,
        Math.random() > 0.5 ? decoConcrete : decoDark,
        { collide: false }
      );
    }
    addRubble(x + w * 0.45, z + 0.7);
    addRubble(x - w * 0.45, z + 0.7);
  }

  function addRuinSunk(x, z, w = 7, d = 6) {
    const slabH = 1.6;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), decoConcrete);
    slab.position.set(x, slabH, z);
    slab.rotation.z = 0.25;
    slab.rotation.y = 0.08;
    scene.add(slab); worldObjects.push(slab);

    colliders.push({
      min: new THREE.Vector3(x - w / 2, 0, z - d / 2),
      max: new THREE.Vector3(x + w / 2, slabH * 0.8, z + d / 2)
    });
    platforms.push({
      min: new THREE.Vector3(x - w * 0.4, 0, z - d * 0.4),
      max: new THREE.Vector3(x + w * 0.4, slabH + 0.2, z + d * 0.4)
    });

    addProp(x - w * 0.3, 0, z - d * 0.35, w * 0.5, 1.8, 0.5, decoDark, { platform: true });

    const slab2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.3, d * 0.6), decoDark);
    slab2.position.set(x + w * 0.35, 0.5, z + d * 0.35);
    slab2.rotation.z = -0.35;
    scene.add(slab2); worldObjects.push(slab2);

    const rise = 0.65, depth = 0.7;
    const nSteps = Math.ceil((slabH + 0.2) / rise);
    const stairX = x - w / 2 - 0.9;
    const topZ  = z + d / 2 - 0.3;
    for (let i = 0; i < nSteps; i++) {
      addProp(stairX, i * rise, topZ + (nSteps - 1 - i) * depth, 1.2, rise, depth, decoDark, { platform: true });
    }

    addRubble(x + w * 0.5, z - d * 0.3);
    addRubble(x - w * 0.4, z + d * 0.4);
    addRubble(x, z + d * 0.7);
  }

  function addRuinCorner(x, z, w = 5, h = 6) {
    addProp(x - w * 0.5, 0, z, 0.6, h, w, decoConcrete, { platform: true });
    addProp(x, 0, z + w * 0.5, w, h * 0.65, 0.6, decoConcrete, { platform: true });

    const topY = h * 0.65;
    for (let i = 0; i < 5; i++) {
      addProp(
        x + (Math.random() - 0.5) * w, topY,
        z + w * 0.5 + (Math.random() - 0.5) * 0.2,
        0.4 + Math.random() * 0.6,
        0.2 + Math.random() * 0.5,
        0.4 + Math.random() * 0.5,
        decoDark, { collide: false }
      );
    }

    addProp(x - w * 0.5, 0, z + w * 0.5, 0.7, h, 0.7, decoDark, { platform: true });

    const rise = 0.7;
    const steps = Math.ceil(topY / rise);
    for (let i = 0; i < steps; i++) {
      addProp(
        x + w * 0.5 - 0.6, i * rise,
        z + w * 0.5 - 0.6 - (steps - 1 - i) * 0.7,
        1.0, rise, 0.7, decoDark, { platform: true }
      );
    }

    addRubble(x + w * 0.3, z - w * 0.3);
    addRubble(x - w * 0.7, z + w * 0.7);
  }

  function addRuinStairs(x, z, steps = 6, dir = 'south') {
    const stepW = 2.0, stepD = 0.9, stepH = 0.7;
    for (let i = 0; i < steps; i++) {
      if (Math.random() > 0.1) {
        const offZ = dir === 'north' ? -i * stepD : i * stepD;
        addProp(x, i * stepH, z + offZ, stepW - Math.random() * 0.2, stepH, stepD, i % 2 ? decoConcrete : decoDark, { platform: true });
      }
    }
    const topY = steps * stepH;
    const topZ = z + (dir === 'north' ? -steps * stepD : steps * stepD);
    addProp(x, topY, topZ, stepW, 0.3, stepD * 1.5, decoConcrete, { platform: true });
    for (let i = 0; i < 3; i++) {
      addProp(
        x + (Math.random() - 0.5) * stepW,
        topY + 0.3 + Math.random() * 0.3,
        topZ + (Math.random() - 0.5) * stepD,
        0.3 + Math.random() * 0.4,
        0.3 + Math.random() * 0.5,
        0.3 + Math.random() * 0.4,
        decoDark, { collide: false }
      );
    }
    addRubble(x + 1.5, z);
    addRubble(x - 1.5, z + (dir === 'north' ? -steps * stepD * 0.5 : steps * stepD * 0.5));
  }

  function addEnterableRuin(x, z, w = 6, d = 5, wallH = 2.5) {
    const t = 0.4, doorW = 2.0, roofH = 0.3;
    const sideW = (w - doorW) / 2;

    addProp(x - doorW / 2 - sideW / 2, 0, z + d / 2, sideW, wallH, t, decoConcrete);
    addProp(x + doorW / 2 + sideW / 2, 0, z + d / 2, sideW, wallH, t, decoConcrete);
    addProp(x, 0, z - d / 2, w, wallH, t, decoConcrete);
    addProp(x - w / 2, 0, z, t, wallH, d, decoConcrete);
    addProp(x + w / 2, 0, z, t, wallH, d, decoConcrete);

    addProp(x, wallH, z, w + 0.5, roofH, d + 0.5, decoDark, { platform: true });

    const roofY = wallH + roofH;
    const rise = 0.7, depth = 0.6;
    const nSteps = Math.ceil(roofY / rise);
    const stairX = x - w / 2 - 0.9;
    const topZ  = z + d / 2 + depth / 2 + 0.3;
    for (let i = 0; i < nSteps; i++) {
      addProp(stairX, i * rise, topZ + (nSteps - 1 - i) * depth, 1.2, rise, depth, decoDark, { platform: true });
    }

    for (let i = 0; i < 5; i++) {
      addProp(
        x + (Math.random() - 0.5) * (w - 2), 0,
        z + (Math.random() - 0.5) * (d - 2),
        0.3 + Math.random() * 0.4,
        0.1 + Math.random() * 0.2,
        0.3 + Math.random() * 0.4,
        decoDark, { collide: false }
      );
    }
  }

  // ================= РАССТАНОВКА ЗДАНИЙ =================
  addRuinTower(18, -95, 7, 7, 11);
  addRuinTower(52, -52, 6, 6, 6);
  addRuinFacade(38, -102, 14, 9);
  addRuinFacade(55, -85, 8, 7);
  addRuinSunk(30, -78, 7, 6);
  addRuinCorner(16, -65, 5, 5.5);
  addRuinCorner(34, -57, 4.5, 4.5);
  addRuinStairs(54, -95, 6, 'north');
  addEnterableRuin(44, -70, 6, 5, 2.5);

  // ================= ДЕКОРАЦИИ КОМНАТЫ 2 =================
  addStreetLamp(12, -50);
  addStreetLamp(58, -95);
  addStreetLamp(13, -88);
  addStreetLamp(32, -44);

  addBusStop(13, -78);

  addCar(26, -48);
  addCar(44, -88);
  addCar(26, -100);

  addCrate(20, -55, 0.9);
  addCrate(40, -55, 0.85);
  addCrate(26, -85, 1.0);
  addCrate(37, -95, 0.8);
  addCrate(14, -60, 0.75);
  addBigCrate(28, -55, 1.4);
  addBigCrate(46, -50, 1.5);
  addBigCrate(18, -50, 1.3);

  addConcreteBlock(44, -65, 2.0, 1.0, 1.2);
  addConcreteBlock(26, -92, 2.2, 1.2, 1.4);
  addConcreteBlock(56, -55, 1.6, 0.9, 1.2);
  addConcreteBlock(18, -55, 1.8, 1.1, 1.3);
  addConcreteBlock(44, -78, 1.5, 0.8, 1.5);

  addBarrier(24, -52, 2.5);
  addBarrier(42, -95, 2.0);
  addBarrier(50, -78, 2.2);
  addBarrier(30, -62, 1.8);

  addBrokenWall(44, -95, 3.0, 0.5, 2.5);
  addBrokenWall(14, -82, 0.5, 3.0, 2.2);

  addRubble(12, -104);
  addRubble(14, -103);
  addRubble(58, -104);
  addRubble(57, -102);
  addRubble(12, -42);
  addRubble(14, -41);
  addRubble(57, -42);

  addRubble(22, -45);
  addRubble(48, -45);
  addRubble(36, -50);
  addRubble(24, -68);
  addRubble(38, -82);
  addRubble(50, -60);
  addRubble(14, -94);
  addRubble(46, -100);
  addRubble(28, -100);
  addRubble(40, -75);

  // =====================================================================
  //     АРКА (ВОРОТА) В КОНЦЕ КОМНАТЫ 3
  // =====================================================================
  const archCenterX = 80;
  const archZ = -176;
  const archPillarOffset = 6;
  const archPillarWidth  = 2.5;
  const archPillarHeight = 8;
  const archTube = 1.25;

  const archFrameMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  archGlowMat = new THREE.MeshBasicMaterial({ color: 0x050505 });

  for (const side of [-1, 1]) {
    const px = archCenterX + side * archPillarOffset;

    const pillar = new THREE.Mesh(new THREE.BoxGeometry(archPillarWidth, archPillarHeight, 2), archFrameMat);
    pillar.position.set(px, archPillarHeight / 2, archZ);
    scene.add(pillar); worldObjects.push(pillar);

    const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(archPillarWidth + 0.6, 0.6, 2.6), archFrameMat);
    baseBlock.position.set(px, 0.3, archZ);
    scene.add(baseBlock); worldObjects.push(baseBlock);

    const topBlock = new THREE.Mesh(new THREE.BoxGeometry(archPillarWidth + 0.4, 0.5, 2.3), archFrameMat);
    topBlock.position.set(px, archPillarHeight - 0.25, archZ);
    scene.add(topBlock); worldObjects.push(topBlock);

    colliders.push({
      min: new THREE.Vector3(px - archPillarWidth / 2, 0, archZ - 1),
      max: new THREE.Vector3(px + archPillarWidth / 2, archPillarHeight, archZ + 1)
    });
  }

  const archRing = new THREE.Mesh(new THREE.TorusGeometry(archPillarOffset, archTube, 10, 40, Math.PI), archFrameMat);
  archRing.position.set(archCenterX, archPillarHeight, archZ);
  scene.add(archRing); worldObjects.push(archRing);

  const portalFill = new THREE.Mesh(
    new THREE.PlaneGeometry((archPillarOffset - archPillarWidth / 2) * 2, archPillarHeight),
    archGlowMat
  );
  portalFill.position.set(archCenterX, archPillarHeight / 2, archZ - 0.4);
  scene.add(portalFill); worldObjects.push(portalFill);

  const archFill = new THREE.Mesh(
    new THREE.CircleGeometry(archPillarOffset - archTube, 32, 0, Math.PI),
    archGlowMat
  );
  archFill.position.set(archCenterX, archPillarHeight, archZ - 0.4);
  scene.add(archFill); worldObjects.push(archFill);

  archLight = new THREE.PointLight(0xffffff, 0, 18);
  archLight.position.set(archCenterX, archPillarHeight * 0.6, archZ - 2);
  scene.add(archLight);

  // ================= ДЕКОРАЦИИ КОМНАТЫ 3 =================
  addStreetLamp(55, -118);
  addStreetLamp(105, -155);
  addStreetLamp(55, -170);
  addStreetLamp(105, -122);

  addBusStop(57, -145);

  addCar(75, -135);
  addCar(88, -162);
  addCar(60, -168);

  addCrate(70, -116, 0.9);
  addCrate(90, -118, 0.85);
  addCrate(58, -132, 1.0);
  addCrate(105, -140, 0.8);
  addCrate(72, -155, 0.75);
  addCrate(88, -145, 1.1);

  addBigCrate(60, -175, 1.4);
  addBigCrate(100, -175, 1.5);
  addBigCrate(68, -112, 1.3);

  addConcreteBlock(85, -140, 2.4, 1.1, 1.4);
  addConcreteBlock(72, -168, 1.8, 1.4, 1.2);
  addConcreteBlock(102, -130, 2.0, 0.9, 1.2);
  addConcreteBlock(58, -160, 1.5, 1.6, 1.0);

  addBarrier(75, -150, 3.0);
  addBarrier(95, -150, 2.0);
  addBarrier(70, -142, 2.5);

  addBrokenWall(78, -168, 3.0, 0.5, 2.5);
  addBrokenWall(102, -145, 0.5, 3.0, 2.2);
  addBrokenWall(58, -138, 2.5, 0.5, 2.2);

  addRubble(54, -114);
  addRubble(106, -114);
  addRubble(54, -178);
  addRubble(106, -178);

  addRubble(65, -140);
  addRubble(95, -135);
  addRubble(80, -150);
  addRubble(70, -160);
  addRubble(90, -170);
  addRubble(58, -150);
  addRubble(102, -160);
  addRubble(84, -128);

  // =====================================================================
  //          СПАВН 20 МОНСТРОВ MONSTER2 В ПЕРВОЙ КОМНАТЕ
  // =====================================================================
  let spawned = 0;
  let attempts = 0;
  while (spawned < 20 && attempts < 800) {
    attempts++;
    const x = -17 + Math.random() * 34;
    const z = -25 + Math.random() * 50;

    // Не спавним внутри домика героя
    if (x > -8 && x < 8 && z > 10 && z < 26) continue;

    // Проверка, что точка спавна не внутри препятствия (с запасом)
    const SPAWN_CLEARANCE = 1.0;
    let blocked = false;
    for (const b of colliders) {
      if (b.isRound) {
        const ddx = x - b.x, ddz = z - b.z;
        const rr = b.radius + SPAWN_CLEARANCE;
        if (ddx * ddx + ddz * ddz < rr * rr) { blocked = true; break; }
      } else if (b.min && b.max) {
        if (x > b.min.x - SPAWN_CLEARANCE && x < b.max.x + SPAWN_CLEARANCE &&
            z > b.min.z - SPAWN_CLEARANCE && z < b.max.z + SPAWN_CLEARANCE) {
          blocked = true;
          break;
        }
      }
    }
    if (blocked) continue;

    spawnMonster2(x, z);
    spawned++;
  }
}

// ================= Анимация =================
export function updateLevel(dt) {
  if (saveOrbMesh) {
    saveOrbMesh.position.y = 1.2 + Math.sin(performance.now() * 0.0015) * 0.06;
  }
  if (saveOrbMeshCorridor) {
    saveOrbMeshCorridor.position.y = 1.2 + Math.sin(performance.now() * 0.0015) * 0.06;
  }
  if (saveOrbMeshCorridor2) {
    saveOrbMeshCorridor2.position.y = 1.2 + Math.sin(performance.now() * 0.0015) * 0.06;
  }

  if (state.dialogue.active && state.dialogue.isCutscene && npcMesh) {
    npcMesh.position.y = 1.5 + Math.sin(performance.now() * 0.002) * 0.15;
    npcMesh.position.x = Math.sin(performance.now() * 0.001) * 0.3;
  }

  // Респавн мишеней
  for (const t of targets) {
    if (t.respawnTimer > 0) {
      t.respawnTimer -= dt;
      if (t.respawnTimer <= 0) {
        t.respawnTimer = 0;
        t.mesh.visible = true;
        if (!worldObjects.includes(t.mesh)) {
          worldObjects.push(t.mesh);
        }
      }
    }
  }
}