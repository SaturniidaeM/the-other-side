import { CONFIG } from './config.js';
import { state, keys, isTouch } from './state.js';
import * as dom from './dom.js';
import { shoot, reload, castSpell } from './combat.js';
import { tryDash } from './player.js';
import { startDialogue, advanceDialogue, skipDialogue } from './dialogue.js';
import { saveGame, loadGame } from './save.js';
import { initAudio, setMasterVolume, setSfxVolume } from './audio.js';
import { setMusicVolume, refreshMusicVolume } from './music.js';

let isRequestingLock = false;
let hasLoadedSave = false;
let settingsReturnTarget = 'menu';

function triggerEndGame() {
  state.running = false;
  state.locked = false;
  for (const k in keys) keys[k] = false;
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }

  dom.hudEl.classList.add('hidden');
  dom.interactEl.classList.add('hidden');
  dom.bossBarEl.classList.add('hidden');
  dom.endGameScreen.classList.remove('hidden');
}

// =====================================================================
//                       МОБИЛЬНОЕ УПРАВЛЕНИЕ
// =====================================================================
function initTouchControls() {
  document.body.classList.add('is-mobile');
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // ===================== ДЖОЙСТИК =====================
  const JOY_RADIUS = 55;
  let joyId = null;
  let joyCX = 0, joyCY = 0;

  const getCenter = () => {
    const r = dom.joystickBase.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  const resetJoy = () => {
    state.touch.x = 0;
    state.touch.y = 0;
    state.touch.active = false;
    state.touch.sprint = false;
    dom.joystickKnob.style.transform = 'translate(-50%, -50%)';
  };

  const updateJoy = (cx, cy) => {
    const dx = cx - joyCX;
    const dy = cy - joyCY;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, JOY_RADIUS);
    const ang = Math.atan2(dy, dx);
    const nx = (Math.cos(ang) * clamped) / JOY_RADIUS;
    const ny = (Math.sin(ang) * clamped) / JOY_RADIUS;

    const kx = nx * JOY_RADIUS;
    const ky = ny * JOY_RADIUS;
    dom.joystickKnob.style.transform =
      `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;

    state.touch.x = nx;
    state.touch.y = ny;
    state.touch.active = dist > JOY_RADIUS * 0.15;
    state.touch.sprint = dist > JOY_RADIUS * 0.95;
  };

  dom.joystickBase.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (joyId === null) {
        joyId = t.identifier;
        const c = getCenter();
        joyCX = c.x;
        joyCY = c.y;
        updateJoy(t.clientX, t.clientY);
        break;
      }
    }
  }, { passive: false });

  dom.joystickBase.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) updateJoy(t.clientX, t.clientY);
    }
  }, { passive: false });

  const endJoy = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        joyId = null;
        resetJoy();
      }
    }
  };
  dom.joystickBase.addEventListener('touchend', endJoy);
  dom.joystickBase.addEventListener('touchcancel', endJoy);

  // ===================== ЗОНА ОБЗОРА =====================
  let lookId = null;
  let lastLX = 0, lastLY = 0;

  dom.lookZone.addEventListener('touchstart', (e) => {
    if (!state.running || !state.locked) return;
    if (state.dialogue.active && state.dialogue.style === 'cutscene') return;
    if (state.qte.active) return;
    for (const t of e.changedTouches) {
      if (lookId === null) {
        lookId = t.identifier;
        lastLX = t.clientX;
        lastLY = t.clientY;
        break;
      }
    }
  }, { passive: true });

  dom.lookZone.addEventListener('touchmove', (e) => {
    if (lookId === null) return;
    if (state.dialogue.active && state.dialogue.style === 'cutscene') return;
    if (state.qte.active) return;
    for (const t of e.changedTouches) {
      if (t.identifier === lookId) {
        e.preventDefault();
        const dx = t.clientX - lastLX;
        const dy = t.clientY - lastLY;
        lastLX = t.clientX;
        lastLY = t.clientY;

        const s = CONFIG.input.sensitivity * 4;
        state.player.yaw -= dx * s;
        state.player.pitch -= dy * s;
        const limit = Math.PI / 2 - 0.02;
        state.player.pitch = Math.max(-limit, Math.min(limit, state.player.pitch));
      }
    }
  }, { passive: false });

  const endLook = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === lookId) lookId = null;
    }
  };
  dom.lookZone.addEventListener('touchend', endLook);
  dom.lookZone.addEventListener('touchcancel', endLook);

  // ===================== КНОПКИ =====================
  function bindButton(el, onDown, onUp) {
    if (!el) return;
    let down = false;

    const press = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (down) return;
      down = true;
      el.classList.add('pressed');
      onDown && onDown();
    };
    const release = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (!down) return;
      down = false;
      el.classList.remove('pressed');
      onUp && onUp();
    };

    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release);
    el.addEventListener('touchcancel', release);
    el.addEventListener('mousedown', press);
    el.addEventListener('mouseup', release);
    el.addEventListener('mouseleave', release);
  }

  bindButton(dom.btnShoot,
    () => { state.touch.shootHeld = true; },
    () => { state.touch.shootHeld = false; });

  bindButton(dom.btnSpell, () => { castSpell(); });

  bindButton(dom.btnJump, () => {
    if (state.player.onGround) {
      state.player.vel.y = CONFIG.player.jumpSpeed;
      state.player.onGround = false;
    }
  });

  bindButton(dom.btnDash,   () => tryDash());
  bindButton(dom.btnReload, () => reload());
  bindButton(dom.btnSwitch, () => {
    state.spell.active = state.spell.active === 0 ? 1 : 0;
  });

  bindButton(dom.btnInteract, () => {
    if (state.arch.near) {
      triggerEndGame();
    } else if (state.savePoint.near) {
      saveGame();
      state.savePoint.feedbackTimer = 1.5;
    } else if (state.dialogue.npcInView) {
      startDialogue(false);
    }
  });

  bindButton(dom.mobilePauseBtn, () => {
    if (!state.running) return;
    state.running = false;
    state.locked = false;
    state.touch.x = 0;
    state.touch.y = 0;
    state.touch.active = false;
    state.touch.sprint = false;
    state.touch.shootHeld = false;
    dom.pauseMenu.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  });

  // ===================== ОРИЕНТАЦИЯ =====================
  const updateOrientation = () => {
    if (!isTouch) return;
    const portrait = window.innerHeight > window.innerWidth;
    if (portrait) dom.orientationWarn.classList.remove('hidden');
    else dom.orientationWarn.classList.add('hidden');
  };
  window.addEventListener('resize', updateOrientation);
  window.addEventListener('orientationchange', () => setTimeout(updateOrientation, 200));
  updateOrientation();

  // ===================== ПОДСКАЗКА В МЕНЮ =====================
  const noteEl = document.getElementById('menuNote');
  if (noteEl) noteEl.textContent = 'Левый стик — движение · Свайп справа — обзор';
}

// =====================================================================
//                       ИНИЦИАЛИЗАЦИЯ ВВОДА
// =====================================================================
export function initInput() {
  if (isTouch) initTouchControls();

  // === ГЛАВНОЕ МЕНЮ ===
  dom.playBtn.addEventListener('click', () => {
    initAudio();

    dom.menuEl.classList.add('hidden');
    dom.hudEl.classList.remove('hidden');
    state.running = true;
    state.locked = false;
    state.gameOver = false;
    for (const k in keys) keys[k] = false;

    if (!hasLoadedSave) {
      loadGame();
      hasLoadedSave = true;
    }

    if (!localStorage.getItem('tutorial_seen')) {
      state.player.pos.set(0, CONFIG.player.eyeHeight, 18);
      state.player.yaw = 0;
      state.player.pitch = 0;
      if (isTouch) state.locked = true;
      startDialogue(true);
    } else {
      if (isTouch) {
        state.locked = true;
        return;
      }
      isRequestingLock = true;
      try {
        const promise = dom.canvasEl.requestPointerLock();
        if (promise) {
          promise.catch(err => {
            console.warn("Браузер заблокировал захват мыши:", err);
            isRequestingLock = false;
          });
        }
      } catch (e) {
        console.warn("Ошибка захвата мыши:", e);
        isRequestingLock = false;
      }
    }
  });

  dom.settingsBtn.addEventListener('click', () => {
    dom.menuEl.classList.add('hidden');
    dom.settingsMenu.classList.remove('hidden');
    settingsReturnTarget = 'menu';
  });

  // === НАСТРОЙКИ ===
  dom.backBtn.addEventListener('click', () => {
    dom.settingsMenu.classList.add('hidden');
    if (settingsReturnTarget === 'menu') {
      dom.menuEl.classList.remove('hidden');
    } else if (settingsReturnTarget === 'pause') {
      dom.pauseMenu.classList.remove('hidden');
    }
  });

  const savedSens   = +(localStorage.getItem('setting_sensitivity') ?? 50);
  const savedMaster = +(localStorage.getItem('setting_masterVol') ?? 80);
  const savedMusic  = +(localStorage.getItem('setting_musicVol') ?? 50);
  const savedSfx    = +(localStorage.getItem('setting_sfxVol') ?? 70);

  dom.mouseSensInput.value = savedSens;
  dom.masterVolInput.value = savedMaster;
  dom.musicVolInput.value  = savedMusic;
  dom.sfxVolInput.value    = savedSfx;

  CONFIG.input.sensitivity = 0.0005 + (savedSens / 100) * 0.0045;
  setMasterVolume(savedMaster / 100);
  setMusicVolume(savedMusic / 100);
  setSfxVolume(savedSfx / 100);

  dom.mouseSensInput.addEventListener('input', (e) => {
    const v = +e.target.value;
    CONFIG.input.sensitivity = 0.0005 + (v / 100) * 0.0045;
    localStorage.setItem('setting_sensitivity', v);
  });

  dom.masterVolInput.addEventListener('input', (e) => {
    const v = +e.target.value;
    setMasterVolume(v / 100);
    refreshMusicVolume();
    localStorage.setItem('setting_masterVol', v);
  });

  dom.musicVolInput.addEventListener('input', (e) => {
    const v = +e.target.value;
    setMusicVolume(v / 100);
    localStorage.setItem('setting_musicVol', v);
  });

  dom.sfxVolInput.addEventListener('input', (e) => {
    const v = +e.target.value;
    setSfxVolume(v / 100);
    localStorage.setItem('setting_sfxVol', v);
  });

  // === МЕНЮ ПАУЗЫ ===
  dom.resumeBtn.addEventListener('click', () => {
    dom.pauseMenu.classList.add('hidden');
    state.running = true;
    if (isTouch) {
      state.locked = true;
      return;
    }
    isRequestingLock = true;
    dom.canvasEl.requestPointerLock();
  });

  dom.pauseSettingsBtn.addEventListener('click', () => {
    dom.pauseMenu.classList.add('hidden');
    dom.settingsMenu.classList.remove('hidden');
    settingsReturnTarget = 'pause';
  });

  // === В ГЛАВНОЕ МЕНЮ (СБРОС) ===
  dom.mainMenuBtn.addEventListener('click', () => {
    localStorage.removeItem('tutorial_seen');
    localStorage.removeItem('the_other_side_save_v2');

    state.player.pos.set(0, CONFIG.player.eyeHeight, 18);
    state.player.vel.set(0, 0, 0);
    state.player.yaw = 0;
    state.player.pitch = 0;
    state.player.hp = CONFIG.player.maxHp;
    state.player.mana = CONFIG.player.maxMana;
    state.player.dashTimer = 0;
    state.player.dashCooldown = 0;
    state.weapon.ammo = CONFIG.weapon.magSize;
    state.weapon.cooldown = 0;
    state.weapon.reloading = 0;
    state.spell.active = 0;
    state.dialogue.active = false;
    state.gameOver = false;

    hasLoadedSave = false;
    state.running = false;
    state.locked = false;
    for (const k in keys) keys[k] = false;

    dom.hudEl.classList.add('hidden');
    dom.pauseMenu.classList.add('hidden');
    dom.menuEl.classList.remove('hidden');
    dom.skipBtn.classList.add('hidden');

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  });

  // === ЭКРАН ПРОИГРЫША: ПРОДОЛЖИТЬ С СОХРАНЕНИЯ ===
  dom.loadSaveBtn.addEventListener('click', () => {
    state.weapon.cooldown = 0;
    state.weapon.reloading = 0;
    state.weapon.ammo = CONFIG.weapon.magSize;
    state.player.vel.set(0, 0, 0);
    state.player.dashTimer = 0;
    state.player.dashCooldown = 0;
    state.player.hp = CONFIG.player.maxHp;
    state.player.mana = CONFIG.player.maxMana;

    const loaded = loadGame();
    if (!loaded) {
      state.player.pos.set(0, CONFIG.player.eyeHeight, 18);
      state.player.yaw = 0;
      state.player.pitch = 0;
    }

    if (state.player.hp <= 0) state.player.hp = CONFIG.player.maxHp;

    state.gameOver = false;
    state.running = true;
    state.locked = false;
    for (const k in keys) keys[k] = false;

    dom.gameOverScreen.classList.add('hidden');
    dom.hudEl.classList.remove('hidden');

    if (isTouch) {
      state.locked = true;
    } else {
      try {
        dom.canvasEl.requestPointerLock();
      } catch (e) {
        console.warn("Ошибка захвата мыши:", e);
      }
    }
  });

  // === ЭКРАН ПРОИГРЫША: В ГЛАВНОЕ МЕНЮ ===
  dom.gameOverMainMenuBtn.addEventListener('click', () => {
    state.player.pos.set(0, CONFIG.player.eyeHeight, 18);
    state.player.vel.set(0, 0, 0);
    state.player.yaw = 0;
    state.player.pitch = 0;
    state.player.hp = CONFIG.player.maxHp;
    state.player.mana = CONFIG.player.maxMana;
    state.player.dashTimer = 0;
    state.player.dashCooldown = 0;
    state.weapon.ammo = CONFIG.weapon.magSize;
    state.weapon.cooldown = 0;
    state.weapon.reloading = 0;
    state.spell.active = 0;
    state.dialogue.active = false;
    state.gameOver = false;

    hasLoadedSave = false;

    state.running = false;
    state.locked = false;
    for (const k in keys) keys[k] = false;

    dom.gameOverScreen.classList.add('hidden');
    dom.hudEl.classList.add('hidden');
    dom.menuEl.classList.remove('hidden');
    dom.skipBtn.classList.add('hidden');
    dom.vnContainer.classList.add('hidden');
    dom.tutorialBox.classList.add('hidden');

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  });

  // === ЭКРАН КОНЦА ИГРЫ: ПРОДОЛЖИТЬ ИССЛЕДОВАТЬ ===
  dom.endGameContinueBtn.addEventListener('click', () => {
    dom.endGameScreen.classList.add('hidden');
    dom.hudEl.classList.remove('hidden');
    state.arch.near = false;
    state.running = true;
    state.locked = false;
    if (isTouch) {
      state.locked = true;
      return;
    }
    try {
      const p = dom.canvasEl.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  });

  // === ЭКРАН КОНЦА ИГРЫ: В ГЛАВНОЕ МЕНЮ ===
  dom.endGameMainMenuBtn.addEventListener('click', () => {
    localStorage.removeItem('the_other_side_save_v2');
    localStorage.removeItem('tutorial_seen');
    location.reload();
  });

  // === КНОПКА ПРОПУСКА ДИАЛОГА ===
  dom.skipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    skipDialogue();
  });

  dom.skipBtn.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  // === ИГРОВЫЕ СОБЫТИЯ ===
  dom.canvasEl.addEventListener('click', () => {
    if (isTouch) return;
    if (!state.running || state.locked) return;
    if (state.dialogue.active && state.dialogue.style === 'cutscene') return;
    dom.canvasEl.requestPointerLock();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
      e.preventDefault();
    }

    if (state.qte.active) {
      if (e.code === 'Space') {
        state.qte.mashCount++;
        return;
      }
      if (e.code !== 'Escape') return;
    }

    keys[e.code] = true;

    if (e.code === 'Escape' && state.running && state.locked) {
      document.exitPointerLock();
      return;
    }

    if (!state.running) return;

    if (state.dialogue.active) {
      if (state.dialogue.style === 'cutscene') {
        if (e.code === 'KeyE' || e.code === 'Space') advanceDialogue();
        if (e.code === 'Tab') {
          e.preventDefault();
          skipDialogue();
        }
        return;
      } else if (state.dialogue.style === 'tutorial') {
        if (e.code === 'KeyE') {
          advanceDialogue();
          return;
        }
      }
    }

    if (e.repeat) return;

    switch (e.code) {
      case 'Space':
        if (state.player.onGround) {
          state.player.vel.y = CONFIG.player.jumpSpeed;
          state.player.onGround = false;
        }
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        tryDash();
        break;
      case 'KeyR':
        reload();
        break;
      case 'Digit1':
        state.spell.active = 0;
        break;
      case 'Digit2':
        state.spell.active = 1;
        break;
      case 'KeyE':
        if (state.arch.near) {
          triggerEndGame();
        } else if (state.savePoint.near) {
          saveGame();
          state.savePoint.feedbackTimer = 1.5;
        } else if (state.dialogue.npcInView) {
          startDialogue(false);
        }
        break;
    }
  });

  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  document.addEventListener('mousemove', (e) => {
    if (isTouch) return;
    if (!state.running || !state.locked) return;
    if (state.dialogue.active && state.dialogue.style === 'cutscene') return;
    if (state.qte.active) return;
    const s = CONFIG.input.sensitivity;
    state.player.yaw -= e.movementX * s;
    state.player.pitch -= e.movementY * s;
    const limit = Math.PI / 2 - 0.02;
    state.player.pitch = Math.max(-limit, Math.min(limit, state.player.pitch));
  });

  dom.canvasEl.addEventListener('mousedown', (e) => {
    if (isTouch) return;
    if (!state.running) return;
    if (state.dialogue.active && state.dialogue.style === 'cutscene') return;
    if (state.qte.active) return;
    if (!state.locked) {
      dom.canvasEl.requestPointerLock();
      return;
    }
    if (e.button === 0) shoot();
    if (e.button === 2) castSpell();
  });

  dom.dialogueBox.addEventListener('mousedown', (e) => {
    if (isTouch) return;
    if (e.button === 0 && state.dialogue.active && state.dialogue.style === 'cutscene') {
      advanceDialogue();
    }
  });

  if (isTouch) {
    dom.dialogueBox.addEventListener('touchstart', (e) => {
      if (state.dialogue.active && state.dialogue.style === 'cutscene') {
        e.preventDefault();
        advanceDialogue();
      }
    }, { passive: false });
  }

  window.addEventListener('contextmenu', (e) => e.preventDefault());

  // === POINTER LOCK ===
  document.addEventListener('pointerlockchange', () => {
    if (isTouch) return;
    state.locked = document.pointerLockElement === dom.canvasEl;

    if (state.locked) {
      isRequestingLock = false;
    } else if (!state.locked && state.running) {
      if (state.dialogue.active && state.dialogue.style === 'cutscene') {
        isRequestingLock = false;
        return;
      }
      if (isRequestingLock) {
        isRequestingLock = false;
      } else {
        state.running = false;
        for (const k in keys) keys[k] = false;
        dom.pauseMenu.classList.remove('hidden');
      }
    }
  });
}