import { CONFIG } from './config.js';
import { canvasEl } from './dom.js';

export const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: false });
renderer.setPixelRatio(1);
renderer.outputEncoding = THREE.sRGBEncoding;

export const scene = new THREE.Scene();
// Чёрное небо без синевы — окружение должно быть строго ч/б
scene.background = new THREE.Color(0x050505);
scene.fog = new THREE.Fog(0x050505, CONFIG.graphics.fogNear, CONFIG.graphics.fogFar);

export const camera = new THREE.PerspectiveCamera(CONFIG.graphics.fov, 1, CONFIG.graphics.near, CONFIG.graphics.far);
camera.rotation.order = 'YXZ';
scene.add(camera);

// Серый свет — красит только пол/стены (MeshLambertMaterial).
// Ассеты и эффекты используют MeshBasicMaterial и не зависят от ламп.
scene.add(new THREE.HemisphereLight(0x444444, 0x080808, 0.85));
const dirLight = new THREE.DirectionalLight(0xaaaaaa, 0.65);
dirLight.position.set(12, 24, 10);
scene.add(dirLight);

export function onResize() {
  const w = window.innerWidth, h = window.innerHeight, s = CONFIG.graphics.pixelScale;
  renderer.setSize(Math.max(1, Math.floor(w * s)), Math.max(1, Math.floor(h * s)), false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}