import { CONFIG } from './config.js';
import { state } from './state.js';
import { camera } from './engine.js';

export const viewmodel = new THREE.Group();
camera.add(viewmodel);

const textureLoader = new THREE.TextureLoader();
const texRightHand = textureLoader.load('assets/righthand.png');
const texLeftHandIdle = textureLoader.load('assets/lefthandidle.png');
const texIceHand   = textureLoader.load('assets/lefthandice.png');
const texFireHand  = textureLoader.load('assets/lefthandfire.png');
const texIceMagic  = textureLoader.load('assets/icemagic.png');
const texFireMagic = textureLoader.load('assets/firemagic.png');

[texRightHand, texLeftHandIdle, texIceHand, texFireHand, texIceMagic, texFireMagic].forEach(tex => {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
});

const HAND_X = 0.42;

export const rightHand = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: texRightHand, transparent: true, depthTest: false }));
rightHand.position.set(HAND_X, -0.25, -0.5);
rightHand.renderOrder = 999;
viewmodel.add(rightHand);

export const leftHand = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: texLeftHandIdle, transparent: true, depthTest: false }));
leftHand.position.set(-HAND_X, -0.25, -0.5);
leftHand.renderOrder = 999;
viewmodel.add(leftHand);

export const magicCircle = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: texIceMagic, transparent: true, opacity: 0.0, depthTest: false, side: THREE.DoubleSide }));
magicCircle.position.set(-HAND_X, -0.25, -0.45);
magicCircle.visible = false;
magicCircle.renderOrder = 998;
viewmodel.add(magicCircle);

export function updateViewmodel(dt) {
  // Скрываем руки только во время катсцены (не во время обучения)
  if (state.dialogue.active && state.dialogue.style === 'cutscene') {
    viewmodel.visible = false;
    return;
  }
  viewmodel.visible = true;

  const p = state.player, v = state.view, w = state.weapon;
  const horizontalSpeed = Math.hypot(p.vel.x, p.vel.z);
  const isMoving = horizontalSpeed > 0.5 && p.onGround;

  v.bob += dt * (isMoving ? 5 + horizontalSpeed * 0.6 : 1.5);
  const bobX = Math.sin(v.bob) * (isMoving ? 0.012 : 0.003);
  const bobY = Math.abs(Math.cos(v.bob)) * (isMoving ? 0.012 : 0.003);

  v.recoil = Math.max(0, v.recoil - dt * 10);
  v.cast   = Math.max(0, v.cast   - dt * 1.5);

  let reloadShakeX = 0, reloadShakeY = 0, reloadRot = 0;
  if (w.reloading > 0) {
    reloadShakeX = (Math.random() - 0.5) * 0.03;
    reloadShakeY = (Math.random() - 0.5) * 0.03;
    reloadRot = (Math.random() - 0.5) * 0.08;
  }

  viewmodel.position.set(bobX, -bobY, 0);
  rightHand.position.set(HAND_X + reloadShakeX, -0.25 + v.recoil * 0.02 + reloadShakeY, -0.5 + v.recoil * 0.08);
  rightHand.rotation.set(-v.recoil * 0.4, 0, 0.05 + reloadRot);

  leftHand.position.set(-HAND_X, -0.25 + v.cast * 0.12, -0.5 - v.cast * 0.08);
  leftHand.rotation.set(-v.cast * 0.25, 0, -0.05 - v.cast * 0.4);

  magicCircle.visible = v.cast > 0.1;
  if (magicCircle.visible) {
    const t = v.cast;
    magicCircle.position.set(-HAND_X, -0.25 + t * 0.12, -0.4 - t * 0.1);
    magicCircle.scale.setScalar(0.5 + t * 0.5);
    magicCircle.material.opacity = 0.8 * t;

    const targetTex = state.spell.active === 0 ? texIceMagic : texFireMagic;
    if (magicCircle.material.map !== targetTex) {
      magicCircle.material.map = targetTex;
      magicCircle.material.needsUpdate = true;
    }
  }

  const targetMap = state.spell.active === 0 ? texIceHand : texFireHand;
  if (v.cast > 0.1 && leftHand.material.map !== targetMap) {
    leftHand.material.map = targetMap;
    leftHand.material.needsUpdate = true;
  } else if (v.cast <= 0.1 && leftHand.material.map !== texLeftHandIdle) {
    leftHand.material.map = texLeftHandIdle;
    leftHand.material.needsUpdate = true;
  }
}