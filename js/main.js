import { scene, renderer, camera, onResize } from './engine.js';
import { state, keys, isTouch } from './state.js';
import { buildLevel, updateLevel } from './level.js';
import { updatePlayer } from './player.js';
import { updateWeapon } from './combat.js';
import { updateViewmodel } from './viewmodel.js';
import { updateHUD } from './ui.js';
import { updateDialogue, checkInteraction } from './dialogue.js';
import { updateEffects } from './effects.js';
import { initInput } from './input.js';
import { updateEnemies } from './enemies.js';
import { updateMusic } from './music.js';
import { spawnBoss, updateBoss, updateQTE } from './boss.js';
import * as dom from './dom.js';

window.onerror = function(message, source, lineno, colno, error) {
    console.error("КРИТИЧЕСКАЯ ОШИБКА:", message, "на строке", lineno);
    alert("Ошибка в игре: " + message + "\nПроверьте консоль (F12).");
    return false;
};

if (isTouch) document.body.classList.add('is-mobile');

try {
    buildLevel();
    spawnBoss();
    initInput();
    window.addEventListener('resize', onResize);
    onResize();
    console.log("Инициализация успешна!");
} catch (e) {
    console.error("Ошибка при инициализации:", e);
}

const clock = new THREE.Clock();

function triggerGameOver() {
  state.gameOver = true;
  state.running = false;
  state.player.hp = 0;

  for (const k in keys) keys[k] = false;

  state.qte.active = false;
  const qtePanel = document.getElementById('qtePanel');
  if (qtePanel) qtePanel.classList.add('hidden');
  const canvasEl = document.getElementById('game');
  if (canvasEl) canvasEl.classList.remove('shake');

  if (document.pointerLockElement) {
    document.exitPointerLock();
  }

  dom.hudEl.classList.add('hidden');
  dom.skipBtn.classList.add('hidden');
  dom.tutorialBox.classList.add('hidden');
  dom.vnContainer.classList.add('hidden');
  if (dom.mobileControls) dom.mobileControls.classList.add('hidden');

  dom.gameOverScreen.classList.remove('hidden');
}

function animate() {
  requestAnimationFrame(animate);
  const rawDt = Math.min(clock.getDelta(), 0.05);
  const slow = state.qte.active ? 0.3 : 1.0;
  const gameDt = rawDt * slow;

  if (state.running) {
    try {
        updatePlayer(gameDt);
        updateBoss(gameDt);
        updateEnemies(rawDt);
        updateWeapon(rawDt);
        updateViewmodel(rawDt);
        updateHUD(rawDt);
        updateDialogue(rawDt);
        updateLevel(rawDt);
        checkInteraction();
        updateQTE(rawDt);

        if (state.player.hp <= 0 && !state.gameOver) {
          triggerGameOver();
        }
    } catch (e) {
        console.error("Ошибка в игровом цикле:", e);
        state.running = false;
    }
  }

  updateEffects(rawDt);
  updateMusic();
  renderer.render(scene, camera);
}

animate();