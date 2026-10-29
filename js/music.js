import { state } from './state.js';
import { enemies } from './enemies.js';
import { getMasterVolume } from './audio.js';

const TRACKS = {
  idle:  'idle.mp3',
  room1: 'room1.mp3',
  room2: 'room2.mp3',
  room3: 'room3.mp3',
};

let musicVolume = 0.5;
let currentAudio = null;
let currentKey   = null;

function isCutscene() {
  return state.dialogue.active && state.dialogue.style === 'cutscene';
}

function applyVolume(audio) {
  if (!audio) return;
  audio.volume = Math.max(0, Math.min(1, getMasterVolume() * musicVolume));
}

export function setMusicVolume(v) {
  musicVolume = v;
  applyVolume(currentAudio);
}

export function refreshMusicVolume() {
  applyVolume(currentAudio);
}

function determineKey() {
  const p = state.player.pos;

  // Дом героя — безопасная зона: боевая музыка здесь не играет
  const inHouse = p.x > -6.5 && p.x < 6.5 && p.z > 12.5 && p.z < 23.5;
  if (inHouse) return 'idle';

  // Границы комнат (по стенам из level.js)
  const inRoom1 = p.x > -20 && p.x < 20 && p.z > -28 && p.z < 28;
  const inRoom2 = p.x > 10  && p.x < 60 && p.z > -106 && p.z < -40;
  const inRoom3 = p.x > 50  && p.x < 110 && p.z > -180 && p.z < -110;

  // Бой с боссом — играет room3, пока босс жив
  if (inRoom3 && state.boss.state !== 'dead') {
    return 'room3';
  }

  // Есть ли живые враги соответствующей волны?
  const hasRoom1Enemies = enemies.some(e => e.wave === 0 && e.hp > 0);
  const hasRoom2Enemies = enemies.some(e => (e.wave === 1 || e.wave === 2) && e.hp > 0);

  // Бой идёт только в той комнате, где сейчас находится игрок
  if (hasRoom1Enemies && inRoom1) return 'room1';
  if (hasRoom2Enemies && inRoom2) return 'room2';

  // Рядом боя нет — спокойный трек
  return 'idle';
}

function playTrack(key) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (!key) { currentKey = null; return; }

  currentAudio = new Audio(TRACKS[key]);
  currentAudio.loop = true;
  applyVolume(currentAudio);
  currentKey = key;
  currentAudio.play().catch(() => {});
}

export function updateMusic() {
  if (!state.running) {
    if (currentAudio && !currentAudio.paused) currentAudio.pause();
    return;
  }
  if (isCutscene()) {
    if (currentAudio && !currentAudio.paused) currentAudio.pause();
    return;
  }
  const key = determineKey();
  if (currentKey !== key) {
    playTrack(key);
    return;
  }
  if (currentAudio && currentAudio.paused) {
    currentAudio.play().catch(() => {});
  }
}

export function stopMusic() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  currentKey = null;
}