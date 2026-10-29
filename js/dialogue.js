import { state } from './state.js';
import {
  canvasEl, vnContainer, dialogueName, dialogueText, interactEl, portraitImg,
  tutorialBox, tutorialName, tutorialText, skipBtn
} from './dom.js';
import { camera } from './engine.js';
import {
  npcMesh, savePointPos, savePointPosCorridor, savePointPosCorridor2,
  setDoorOpen, setNPCTexture
} from './level.js';
import { getRaycaster, getScreenCenter } from './combat.js';

const SAVE_POINT_RADIUS = 2.5;
const TUTORIAL_AUTO_ADVANCE = 8.0;

export function checkInteraction() {
  if (state.dialogue.active && state.dialogue.style === 'cutscene') {
    interactEl.classList.add('hidden');
    state.dialogue.npcInView = false;
    state.savePoint.near = false;
    state.arch.near = false;
    return;
  }

  if (state.savePoint.feedbackTimer > 0) {
    interactEl.textContent = '✓ Сохранено';
    interactEl.classList.remove('hidden');
    state.dialogue.npcInView = false;
    state.savePoint.near = false;
    state.arch.near = false;
    return;
  }

  // === Арка после смерти босса ===
  if (state.boss.state === 'dead') {
    const adx = state.player.pos.x - 80;
    const adz = state.player.pos.z + 176;
    if (adx * adx + adz * adz < 64) {
      state.arch.near = true;
      state.savePoint.near = false;
      state.dialogue.npcInView = false;
      interactEl.textContent = '[E] Пройти через арку';
      interactEl.classList.remove('hidden');
      return;
    }
  }
  state.arch.near = false;

  const dx1 = state.player.pos.x - savePointPos.x;
  const dz1 = state.player.pos.z - savePointPos.z;
  const dx2 = state.player.pos.x - savePointPosCorridor.x;
  const dz2 = state.player.pos.z - savePointPosCorridor.z;
  const dx3 = state.player.pos.x - savePointPosCorridor2.x;
  const dz3 = state.player.pos.z - savePointPosCorridor2.z;

  state.savePoint.near =
    (dx1 * dx1 + dz1 * dz1) < SAVE_POINT_RADIUS * SAVE_POINT_RADIUS ||
    (dx2 * dx2 + dz2 * dz2) < SAVE_POINT_RADIUS * SAVE_POINT_RADIUS ||
    (dx3 * dx3 + dz3 * dz3) < SAVE_POINT_RADIUS * SAVE_POINT_RADIUS;

  if (state.savePoint.near) {
    interactEl.textContent = '[E] Сохранить';
    interactEl.classList.remove('hidden');
    state.dialogue.npcInView = false;
    return;
  }

  if (!npcMesh || !npcMesh.visible) {
    state.dialogue.npcInView = false;
    interactEl.classList.add('hidden');
    return;
  }

  const raycaster = getRaycaster();
  raycaster.setFromCamera(getScreenCenter(), camera);
  raycaster.far = 4.5;
  const hits = raycaster.intersectObject(npcMesh, false);

  if (hits.length > 0) {
    state.dialogue.npcInView = true;
    interactEl.textContent = '[E] Поговорить';
    interactEl.classList.remove('hidden');
  } else {
    state.dialogue.npcInView = false;
    interactEl.classList.add('hidden');
  }
}

function getTextEl() {
  return state.dialogue.style === 'tutorial' ? tutorialText : dialogueText;
}

function applyLineUI(line) {
  if (line.portrait) {
    if (line.speaker === 'player') {
      portraitImg.src = line.portrait;
    } else {
      setNPCTexture(line.portrait.split('/').pop());
    }
  }

  if (state.dialogue.style === 'cutscene') {
    dialogueName.textContent = line.name;
    dialogueName.style.color = '#000';
    dialogueName.style.backgroundColor = line.speaker === 'player' ? '#dddddd' : '#aaaaaa';
    dialogueText.textContent = '';
  } else {
    tutorialName.textContent = line.name;
    tutorialText.textContent = '';
  }
}

function updateSkipVisibility() {
  if (state.dialogue.active && state.dialogue.style === 'cutscene') {
    skipBtn.classList.remove('hidden');
  } else {
    skipBtn.classList.add('hidden');
  }
}

export function startDialogue(isCutscene = false) {
  const d = state.dialogue;
  d.active = true;
  d.isCutscene = isCutscene;
  d.currentLine = 0;
  d.typing = true;
  d.charIndex = 0;
  d.timer = 0;
  d.tutorialTimer = 0;

  if (isCutscene) {
    d.activeLines = d.lines;
    setDoorOpen(false);
    if (npcMesh) {
      npcMesh.position.set(0, 1.5, 15.5);
      npcMesh.rotation.y = 0;
      npcMesh.visible = true;
    }
  } else if (localStorage.getItem('tutorial_seen')) {
    d.activeLines = d.postLines;
  } else {
    d.activeLines = d.lines;
  }

  const firstLine = d.activeLines[0];
  d.style = firstLine.style || 'cutscene';

  if (d.style === 'cutscene') {
    vnContainer.classList.remove('hidden');
    tutorialBox.classList.add('hidden');
  } else {
    vnContainer.classList.add('hidden');
    tutorialBox.classList.remove('hidden');
    if (npcMesh) npcMesh.visible = false;
    try { canvasEl.requestPointerLock(); } catch (e) {}
  }

  applyLineUI(firstLine);
  updateSkipVisibility();

  document.exitPointerLock();
  if (d.style === 'tutorial') {
    try { canvasEl.requestPointerLock(); } catch (e) {}
  }
}

function transitionStyle(newStyle) {
  const d = state.dialogue;
  if (newStyle === 'tutorial' && d.style === 'cutscene') {
    vnContainer.classList.add('hidden');
    tutorialBox.classList.remove('hidden');
    if (npcMesh) npcMesh.visible = false;
    try { canvasEl.requestPointerLock(); } catch (e) {}
  } else if (newStyle === 'cutscene' && d.style === 'tutorial') {
    tutorialBox.classList.add('hidden');
    vnContainer.classList.remove('hidden');
    if (npcMesh) npcMesh.visible = true;
  }
  d.style = newStyle;
  updateSkipVisibility();
}

function finishDialogue() {
  const d = state.dialogue;
  d.active = false;
  vnContainer.classList.add('hidden');
  tutorialBox.classList.add('hidden');
  skipBtn.classList.add('hidden');

  if (d.isCutscene) {
    d.isCutscene = false;
    localStorage.setItem('tutorial_seen', 'true');
    setDoorOpen(true);
    if (npcMesh) {
      npcMesh.position.set(-10, 1.25, 0);
      npcMesh.rotation.y = Math.PI / 2;
      npcMesh.visible = true;
      setNPCTexture('happynpc.png');
    }
  }

  try { canvasEl.requestPointerLock(); } catch (e) {}
}

export function skipDialogue() {
  const d = state.dialogue;
  if (!d.active) return;

  while (d.currentLine < d.activeLines.length - 1) {
    d.currentLine++;
    const line = d.activeLines[d.currentLine];
    const newStyle = line.style || 'cutscene';
    if (newStyle !== d.style) {
      transitionStyle(newStyle);
    }
    if (line.portrait) {
      if (line.speaker === 'player') {
        portraitImg.src = line.portrait;
      } else {
        setNPCTexture(line.portrait.split('/').pop());
      }
    }
  }

  finishDialogue();
}

export function advanceDialogue() {
  const d = state.dialogue;

  if (d.typing) {
    d.typing = false;
    const el = getTextEl();
    el.textContent = d.activeLines[d.currentLine].text;
    return;
  }

  d.currentLine++;
  if (d.currentLine >= d.activeLines.length) {
    finishDialogue();
    return;
  }

  const newLine = d.activeLines[d.currentLine];
  const newStyle = newLine.style || 'cutscene';

  if (newStyle !== d.style) {
    transitionStyle(newStyle);
  }

  d.typing = true;
  d.charIndex = 0;
  d.timer = 0;
  d.tutorialTimer = 0;

  applyLineUI(newLine);
}

export function updateDialogue(dt) {
  if (state.savePoint.feedbackTimer > 0) {
    state.savePoint.feedbackTimer -= dt;
    if (state.savePoint.feedbackTimer <= 0) {
      state.savePoint.feedbackTimer = 0;
      interactEl.classList.add('hidden');
    }
  }

  const d = state.dialogue;
  if (!d.active) return;

  const line = d.activeLines[d.currentLine];
  if (!line) return;
  const el = getTextEl();

  if (d.typing) {
    d.timer += dt;
    if (d.timer >= d.speed) {
      d.timer = 0;
      if (d.charIndex < line.text.length) {
        d.charIndex++;
        el.textContent = line.text.substring(0, d.charIndex);
      } else {
        d.typing = false;
        d.tutorialTimer = 0;
      }
    }
  } else if (d.style === 'tutorial') {
    d.tutorialTimer += dt;
    if (d.tutorialTimer >= TUTORIAL_AUTO_ADVANCE) {
      advanceDialogue();
    }
  }
}