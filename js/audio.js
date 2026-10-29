import { state } from './state.js';

let audioCtx = null;
let noiseBuf = null;
let masterGain = null;
let sfxGain = null;

let masterVolume = 0.8;
let sfxVolume = 0.7;

function getAudioContext() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = masterVolume;
      masterGain.connect(audioCtx.destination);
      sfxGain = audioCtx.createGain();
      sfxGain.gain.value = sfxVolume;
      sfxGain.connect(masterGain);
    } catch (e) {
      console.warn('AudioContext недоступен:', e);
    }
  }
  return audioCtx;
}

export function initAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

export function setMasterVolume(v) {
  masterVolume = v;
  if (masterGain) masterGain.gain.value = v;
}

export function setSfxVolume(v) {
  sfxVolume = v;
  if (sfxGain) sfxGain.gain.value = v;
}

export function getMasterVolume() {
  return masterVolume;
}

function isMuted() {
  return state.dialogue.active && state.dialogue.style === 'cutscene';
}

function getNoiseBuffer(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 1.0);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

// =====================================================================
//                       РЫК / ШУРШАНИЕ МОНСТРА
// =====================================================================
let lastGrowlTime = 0;
const GROWL_COOLDOWN_MS = 350;

export function playMonsterGrowl() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
    return;
  }
  const now = performance.now();
  if (now - lastGrowlTime < GROWL_COOLDOWN_MS) return;
  lastGrowlTime = now;

  try {
    const t = ctx.currentTime;
    const dur = 0.45 + Math.random() * 0.35;

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);
    noise.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400 + Math.random() * 1600, t);
    bp.frequency.exponentialRampToValueAtTime(1100 + Math.random() * 800, t + dur);
    bp.Q.value = 0.7;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;

    const noiseEnv = ctx.createGain();
    noiseEnv.gain.setValueAtTime(0.0001, t);
    noiseEnv.gain.exponentialRampToValueAtTime(0.09, t + 0.05);
    noiseEnv.gain.setValueAtTime(0.09, t + dur - 0.1);
    noiseEnv.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const mod = ctx.createGain();
    mod.gain.value = 0.5;

    const lfoFast = ctx.createOscillator();
    lfoFast.type = 'square';
    lfoFast.frequency.value = 24 + Math.random() * 26;
    const lfoFastAmt = ctx.createGain();
    lfoFastAmt.gain.value = 0.35;
    lfoFast.connect(lfoFastAmt);
    lfoFastAmt.connect(mod.gain);

    const lfoSlow = ctx.createOscillator();
    lfoSlow.type = 'triangle';
    lfoSlow.frequency.value = 5 + Math.random() * 7;
    const lfoSlowAmt = ctx.createGain();
    lfoSlowAmt.gain.value = 0.18;
    lfoSlow.connect(lfoSlowAmt);
    lfoSlowAmt.connect(mod.gain);

    noise.connect(bp);
    bp.connect(hp);
    hp.connect(noiseEnv);
    noiseEnv.connect(mod);
    mod.connect(sfxGain);

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const oscFilter = ctx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.value = 320;

    osc.type = 'sawtooth';
    const baseFreq = 48 + Math.random() * 28;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.55, t + dur);

    oscGain.gain.setValueAtTime(0.0001, t);
    oscGain.gain.exponentialRampToValueAtTime(0.010, t + 0.06);
    oscGain.gain.setValueAtTime(0.010, t + dur - 0.1);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(sfxGain);

    noise.start(t);
    lfoFast.start(t);
    lfoSlow.start(t);
    osc.start(t);

    noise.stop(t + dur);
    lfoFast.stop(t + dur);
    lfoSlow.stop(t + dur);
    osc.stop(t + dur);
  } catch (e) {}
}

// =====================================================================
//                       УДАР ПО ИГРОКУ
// =====================================================================
export function playHitPlayer() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;

  try {
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);

    oscGain.gain.setValueAtTime(0.0001, t);
    oscGain.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

    osc.connect(oscGain);
    oscGain.connect(sfxGain);
    osc.start(t);
    osc.stop(t + 0.24);

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800;
    bp.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.08, t + 0.005);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    noise.connect(bp);
    bp.connect(ng);
    ng.connect(sfxGain);
    noise.start(t);
    noise.stop(t + 0.12);
  } catch (e) {}
}

// =====================================================================
//                              ВЫСТРЕЛ
// =====================================================================
export function playGunShot() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;

  try {
    const t = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.08);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.18, t + 0.004);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    noise.connect(lp);
    lp.connect(ng);
    ng.connect(sfxGain);
    noise.start(t);
    noise.stop(t + 0.12);

    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.13, t + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(og);
    og.connect(sfxGain);
    osc.start(t);
    osc.stop(t + 0.12);
  } catch (e) {}
}

// =====================================================================
//                            ПЕРЕЗАРЯДКА
// =====================================================================
export function playReloadStart() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;

  try {
    const t = ctx.currentTime;

    const c1 = ctx.createBufferSource();
    c1.buffer = getNoiseBuffer(ctx);
    c1.loop = true;
    const bp1 = ctx.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.frequency.value = 1800;
    bp1.Q.value = 4;
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.0001, t);
    g1.gain.exponentialRampToValueAtTime(0.12, t + 0.003);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    c1.connect(bp1);
    bp1.connect(g1);
    g1.connect(sfxGain);
    c1.start(t);
    c1.stop(t + 0.06);

    const t2 = t + 0.55;
    const c2 = ctx.createBufferSource();
    c2.buffer = getNoiseBuffer(ctx);
    c2.loop = true;
    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.value = 1400;
    bp2.Q.value = 5;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t2);
    g2.gain.exponentialRampToValueAtTime(0.14, t2 + 0.003);
    g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.06);
    c2.connect(bp2);
    bp2.connect(g2);
    g2.connect(sfxGain);
    c2.start(t2);
    c2.stop(t2 + 0.07);
  } catch (e) {}
}

export function playReloadFinish() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;

  try {
    const t = ctx.currentTime;
    const c = ctx.createBufferSource();
    c.buffer = getNoiseBuffer(ctx);
    c.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200;
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    c.connect(bp);
    bp.connect(g);
    g.connect(sfxGain);
    c.start(t);
    c.stop(t + 0.05);
  } catch (e) {}
}

// =====================================================================
//                              ЗАКЛИНАНИЯ
// =====================================================================
export function playSpellCast(isIce) {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;

  try {
    const t = ctx.currentTime;
    const dur = 0.4;

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    if (isIce) {
      bp.frequency.setValueAtTime(1800, t);
      bp.frequency.exponentialRampToValueAtTime(4000, t + dur);
    } else {
      bp.frequency.setValueAtTime(1800, t);
      bp.frequency.exponentialRampToValueAtTime(500, t + dur);
    }
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.15, t + 0.08);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    noise.connect(bp);
    bp.connect(ng);
    ng.connect(sfxGain);
    noise.start(t);
    noise.stop(t + dur + 0.05);

    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = isIce ? 'triangle' : 'sawtooth';
    if (isIce) {
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(1600, t + dur);
    } else {
      osc.frequency.setValueAtTime(280, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + dur);
    }
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.04, t + 0.05);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = isIce ? 3500 : 800;
    osc.connect(lp);
    lp.connect(og);
    og.connect(sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  } catch (e) {}
}

export function playSpellImpact(isIce) {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;

  try {
    const t = ctx.currentTime;

    if (isIce) {
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);
      noise.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2500;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.exponentialRampToValueAtTime(0.15, t + 0.005);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      noise.connect(hp);
      hp.connect(ng);
      ng.connect(sfxGain);
      noise.start(t);
      noise.stop(t + 0.4);

      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400, t);
      osc.frequency.exponentialRampToValueAtTime(1600, t + 0.25);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(og);
      og.connect(sfxGain);
      osc.start(t);
      osc.stop(t + 0.35);
    } else {
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(35, t + 0.4);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.28, t + 0.01);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(og);
      og.connect(sfxGain);
      osc.start(t);
      osc.stop(t + 0.45);

      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx);
      noise.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 800;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      noise.connect(lp);
      lp.connect(ng);
      ng.connect(sfxGain);
      noise.start(t);
      noise.stop(t + 0.35);
    }
  } catch (e) {}
}

// =====================================================================
//                       СЛИЗЬ
// =====================================================================
export function playSlimeSpit() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;
  try {
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx); noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(1300, t + 0.12);
    bp.frequency.exponentialRampToValueAtTime(280, t + 0.3);
    bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    noise.connect(bp); bp.connect(g); g.connect(sfxGain);
    noise.start(t); noise.stop(t + 0.34);

    const osc = ctx.createOscillator(); const og = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.16);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.10, t + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(lp); lp.connect(og); og.connect(sfxGain);
    osc.start(t); osc.stop(t + 0.22);
  } catch (e) {}
}

export function playSlimeHit() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;
  try {
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx); noise.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    noise.connect(lp); lp.connect(g); g.connect(sfxGain);
    noise.start(t); noise.stop(t + 0.2);

    const osc = ctx.createOscillator(); const og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.14);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.15, t + 0.005);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    osc.connect(og); og.connect(sfxGain);
    osc.start(t); osc.stop(t + 0.17);
  } catch (e) {}
}

export function playSlimeGurgle() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;
  try {
    const t = ctx.currentTime; const dur = 0.7;
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx); noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(300 + Math.random() * 200, t);
    bp.frequency.exponentialRampToValueAtTime(500 + Math.random() * 200, t + dur);
    bp.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    noise.connect(bp); bp.connect(g); g.connect(sfxGain);
    noise.start(t); noise.stop(t + dur + 0.05);
  } catch (e) {}
}

// =====================================================================
//                       ЛЕТАЮЩИЙ МОНСТР
// =====================================================================
export function playFlyerScreech() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;
  try {
    const t = ctx.currentTime; const dur = 0.5;
    const osc = ctx.createOscillator(); const og = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 2;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(2500, t + dur);
    osc.frequency.exponentialRampToValueAtTime(900, t + dur + 0.18);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    osc.connect(bp); bp.connect(og); og.connect(sfxGain);
    osc.start(t); osc.stop(t + dur + 0.22);

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx); noise.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    noise.connect(hp); hp.connect(ng); ng.connect(sfxGain);
    noise.start(t); noise.stop(t + dur + 0.05);
  } catch (e) {}
}

export function playFlyerWings() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;
  try {
    const t = ctx.currentTime; const dur = 0.4;
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx); noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < 4; i++) {
      const pt = t + i * 0.08;
      g.gain.exponentialRampToValueAtTime(0.06, pt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, pt + 0.06);
    }
    noise.connect(bp); bp.connect(g); g.connect(sfxGain);
    noise.start(t); noise.stop(t + dur + 0.05);
  } catch (e) {}
}
// =====================================================================
//                       БОСС: ШАГ / ДЭШ
// =====================================================================
let lastBossStepTime = 0;
export function playBossStep() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;
  const now = performance.now();
  if (now - lastBossStepTime < 180) return;
  lastBossStepTime = now;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(75 + Math.random() * 20, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.28);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(og); og.connect(sfxGain);
    osc.start(t); osc.stop(t + 0.32);

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx); noise.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = 380;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.09, t + 0.01);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    noise.connect(lp); lp.connect(ng); ng.connect(sfxGain);
    noise.start(t); noise.stop(t + 0.24);
  } catch (e) {}
}

// =====================================================================
//                       БОСС: ВОЛЕЙ СНАРЯДОВ
// =====================================================================
export function playBossVolley() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.38);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    osc.connect(lp); lp.connect(og); og.connect(sfxGain);
    osc.start(t); osc.stop(t + 0.45);

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx); noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2000, t);
    bp.frequency.exponentialRampToValueAtTime(380, t + 0.32);
    bp.Q.value = 1.5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    noise.connect(bp); bp.connect(ng); ng.connect(sfxGain);
    noise.start(t); noise.stop(t + 0.38);
  } catch (e) {}
}

// =====================================================================
//                       БОСС: УДАР РУКОЙ
// =====================================================================
export function playBossSwing() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;
  try {
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx); noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.15);
    bp.frequency.exponentialRampToValueAtTime(280, t + 0.32);
    bp.Q.value = 2.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    noise.connect(bp); bp.connect(g); g.connect(sfxGain);
    noise.start(t); noise.stop(t + 0.36);

    const osc = ctx.createOscillator(); const og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.32);
    og.gain.setValueAtTime(0.0001, t + 0.05);
    og.gain.exponentialRampToValueAtTime(0.22, t + 0.07);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    osc.connect(og); og.connect(sfxGain);
    osc.start(t + 0.05); osc.stop(t + 0.4);
  } catch (e) {}
}

// =====================================================================
//                       БОСС: УДАР ПО ЗЕМЛЕ (SHOCKWAVE)
// =====================================================================
export function playBossShockwave() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;
  try {
    const t = ctx.currentTime;
    // тяжёлый саб-удар
    const osc = ctx.createOscillator(); const og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.6);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    osc.connect(og); og.connect(sfxGain);
    osc.start(t); osc.stop(t + 0.7);

    // низкий рёв-разлёт
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx); noise.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + 0.5);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    noise.connect(lp); lp.connect(ng); ng.connect(sfxGain);
    noise.start(t); noise.stop(t + 0.62);
  } catch (e) {}
}
// =====================================================================
//                       БОСС: СМЕРТЬ
// =====================================================================
export function playBossDeath() {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'suspended') return;
  try {
    const t = ctx.currentTime;

    // 1. Глубокий нисходящий саб — «выдох» умирающего
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, t);
    sub.frequency.exponentialRampToValueAtTime(22, t + 1.8);
    subGain.gain.setValueAtTime(0.0001, t);
    subGain.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
    sub.connect(subGain); subGain.connect(sfxGain);
    sub.start(t); sub.stop(t + 2.0);

    // 2. Долгий шумовой рёв (осыпающийся камень / распад)
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + 1.6);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
    ng.gain.setValueAtTime(0.18, t + 0.8);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    noise.connect(lp); lp.connect(ng); ng.connect(sfxGain);
    noise.start(t); noise.stop(t + 1.9);

    // 3. Скрип-вопль (saw) сверху — «последний крик»
    const shriek = ctx.createOscillator();
    const shGain = ctx.createGain();
    const shBP = ctx.createBiquadFilter();
    shBP.type = 'bandpass';
    shBP.frequency.value = 1400;
    shBP.Q.value = 3;
    shriek.type = 'sawtooth';
    shriek.frequency.setValueAtTime(900, t);
    shriek.frequency.exponentialRampToValueAtTime(180, t + 1.2);
    shGain.gain.setValueAtTime(0.0001, t);
    shGain.gain.exponentialRampToValueAtTime(0.09, t + 0.06);
    shGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    shriek.connect(shBP); shBP.connect(shGain); shGain.connect(sfxGain);
    shriek.start(t); shriek.stop(t + 1.35);

    // 4. Финальный металлический грохот через 0.6с — тело падает
    const t2 = t + 0.6;
    const clang = ctx.createOscillator();
    const cg = ctx.createGain();
    clang.type = 'triangle';
    clang.frequency.setValueAtTime(220, t2);
    clang.frequency.exponentialRampToValueAtTime(55, t2 + 0.5);
    cg.gain.setValueAtTime(0.0001, t2);
    cg.gain.exponentialRampToValueAtTime(0.20, t2 + 0.01);
    cg.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.55);
    clang.connect(cg); cg.connect(sfxGain);
    clang.start(t2); clang.stop(t2 + 0.6);
  } catch (e) {}
}