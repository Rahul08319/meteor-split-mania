// Web Audio API sound effects - procedurally generated
import { getSettings } from './settings';

let audioCtx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let hostAudioEnabled = true;

/** Applies the YouTube host's audio preference without changing player volume settings. */
export const setHostAudioEnabled = (enabled: boolean) => {
  hostAudioEnabled = enabled;
  if (!audioCtx) return;
  if (enabled) void audioCtx.resume().catch(() => undefined);
  else void audioCtx.suspend().catch(() => undefined);
};

export const suspendAudio = () => {
  if (audioCtx) void audioCtx.suspend().catch(() => undefined);
};

const getCtx = (): AudioContext => {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
};

const getSfxBus = (): GainNode => {
  const ctx = getCtx();
  if (!sfxBus) {
    sfxBus = ctx.createGain();
    sfxBus.gain.value = getSettings().sfxVolume;
    sfxBus.connect(ctx.destination);
  }
  return sfxBus;
};

const getMusicBus = (): GainNode => {
  const ctx = getCtx();
  if (!musicBus) {
    musicBus = ctx.createGain();
    musicBus.gain.value = getSettings().musicVolume;
    musicBus.connect(ctx.destination);
  }
  return musicBus;
};

export const setSfxVolume = (v: number) => {
  if (sfxBus && audioCtx) sfxBus.gain.setValueAtTime(v, audioCtx.currentTime);
};
export const setMusicVolume = (v: number) => {
  if (musicBus && audioCtx) musicBus.gain.setValueAtTime(v, audioCtx.currentTime);
};

export const resumeAudio = () => {
  if (hostAudioEnabled && audioCtx?.state === 'suspended') void audioCtx.resume();
};

export const playSplit = (generation: number) => {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(getSfxBus());
  
  const baseFreq = 300 + generation * 200;
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.5, ctx.currentTime + 0.08);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, ctx.currentTime + 0.25);
  
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
};

export const playDestroy = () => {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxBus());
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000, ctx.currentTime);
  
  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
};

export const playChaos = () => {
  const ctx = getCtx();
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(getSfxBus());
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(100 + Math.random() * 200, ctx.currentTime + i * 0.05);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.4 + i * 0.05);
    
    gain.gain.setValueAtTime(0.06, ctx.currentTime + i * 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4 + i * 0.05);
    
    osc.start(ctx.currentTime + i * 0.05);
    osc.stop(ctx.currentTime + 0.5);
  }
};

export const playCombo = (comboLevel: number) => {
  const ctx = getCtx();
  const baseNote = 440 * Math.pow(2, Math.min(comboLevel, 12) / 12);
  
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(getSfxBus());
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseNote * (1 + i * 0.5), ctx.currentTime + i * 0.06);
    
    gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.06);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + i * 0.06 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.2);
    
    osc.start(ctx.currentTime + i * 0.06);
    osc.stop(ctx.currentTime + i * 0.06 + 0.25);
  }
};

export const playChaosOverload = () => {
  const ctx = getCtx();
  for (let i = 0; i < 5; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(getSfxBus());
    
    osc.type = i % 2 === 0 ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(200 - i * 30, ctx.currentTime + i * 0.1);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.8 + i * 0.1);
    
    gain.gain.setValueAtTime(0.1 - i * 0.015, ctx.currentTime + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8 + i * 0.1);
    
    osc.start(ctx.currentTime + i * 0.1);
    osc.stop(ctx.currentTime + 1 + i * 0.1);
  }
};

export const playPowerUp = () => {
  const ctx = getCtx();
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(getSfxBus());
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
    
    gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.08);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + i * 0.08 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.2);
    
    osc.start(ctx.currentTime + i * 0.08);
    osc.stop(ctx.currentTime + i * 0.08 + 0.25);
  });
};

export const playBossHit = () => {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(getSfxBus());

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.2);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(800, ctx.currentTime);

  gain.gain.setValueAtTime(0.18, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.25);
};

export const playBossDefeat = () => {
  const ctx = getCtx();
  const notes = [261, 329, 392, 523, 659, 784];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(getSfxBus());

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);

    gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.1 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.3);

    osc.start(ctx.currentTime + i * 0.1);
    osc.stop(ctx.currentTime + i * 0.1 + 0.35);
  });
};

export const playShowerWarning = () => {
  const ctx = getCtx();
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(getSfxBus());

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime + i * 0.15);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + i * 0.15 + 0.1);

    gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.12);

    osc.start(ctx.currentTime + i * 0.15);
    osc.stop(ctx.currentTime + i * 0.15 + 0.15);
  }
};

// === Background Music System ===
let bgmNodes: {
  bassOsc?: OscillatorNode;
  bassGain?: GainNode;
  padOsc1?: OscillatorNode;
  padOsc2?: OscillatorNode;
  padGain?: GainNode;
  droneOsc?: OscillatorNode;
  droneGain?: GainNode;
  chaosOsc?: OscillatorNode;
  chaosGain?: GainNode;
  chaosFilter?: BiquadFilterNode;
  masterGain?: GainNode;
  lfoOsc?: OscillatorNode;
  lfoGain?: GainNode;
} = {};

let bgmActive = false;

export const startBGM = () => {
  if (bgmActive) return;
  const ctx = getCtx();
  bgmActive = true;

  // Master gain
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.06, ctx.currentTime);
  master.connect(getMusicBus());
  bgmNodes.masterGain = master;

  // Deep bass pulse
  const bassOsc = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bassOsc.type = 'sine';
  bassOsc.frequency.setValueAtTime(55, ctx.currentTime);
  bassGain.gain.setValueAtTime(0.5, ctx.currentTime);
  bassOsc.connect(bassGain);
  bassGain.connect(master);
  bassOsc.start(ctx.currentTime);
  bgmNodes.bassOsc = bassOsc;
  bgmNodes.bassGain = bassGain;

  // LFO for bass pulse
  const lfoOsc = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfoOsc.type = 'sine';
  lfoOsc.frequency.setValueAtTime(0.5, ctx.currentTime);
  lfoGain.gain.setValueAtTime(0.3, ctx.currentTime);
  lfoOsc.connect(lfoGain);
  lfoGain.connect(bassGain.gain);
  lfoOsc.start(ctx.currentTime);
  bgmNodes.lfoOsc = lfoOsc;
  bgmNodes.lfoGain = lfoGain;

  // Ambient pad (two detuned oscillators)
  const padOsc1 = ctx.createOscillator();
  const padOsc2 = ctx.createOscillator();
  const padGain = ctx.createGain();
  padOsc1.type = 'sine';
  padOsc2.type = 'sine';
  padOsc1.frequency.setValueAtTime(110, ctx.currentTime);
  padOsc2.frequency.setValueAtTime(112, ctx.currentTime); // slight detune for width
  padGain.gain.setValueAtTime(0.15, ctx.currentTime);
  padOsc1.connect(padGain);
  padOsc2.connect(padGain);
  padGain.connect(master);
  padOsc1.start(ctx.currentTime);
  padOsc2.start(ctx.currentTime);
  bgmNodes.padOsc1 = padOsc1;
  bgmNodes.padOsc2 = padOsc2;
  bgmNodes.padGain = padGain;

  // Drone
  const droneOsc = ctx.createOscillator();
  const droneGain = ctx.createGain();
  droneOsc.type = 'triangle';
  droneOsc.frequency.setValueAtTime(82.4, ctx.currentTime); // E2
  droneGain.gain.setValueAtTime(0.1, ctx.currentTime);
  droneOsc.connect(droneGain);
  droneGain.connect(master);
  droneOsc.start(ctx.currentTime);
  bgmNodes.droneOsc = droneOsc;
  bgmNodes.droneGain = droneGain;

  // Chaos layer (filtered noise-like oscillator, starts silent)
  const chaosOsc = ctx.createOscillator();
  const chaosFilter = ctx.createBiquadFilter();
  const chaosGain = ctx.createGain();
  chaosOsc.type = 'sawtooth';
  chaosOsc.frequency.setValueAtTime(73.4, ctx.currentTime); // D2
  chaosFilter.type = 'bandpass';
  chaosFilter.frequency.setValueAtTime(200, ctx.currentTime);
  chaosFilter.Q.setValueAtTime(2, ctx.currentTime);
  chaosGain.gain.setValueAtTime(0, ctx.currentTime);
  chaosOsc.connect(chaosFilter);
  chaosFilter.connect(chaosGain);
  chaosGain.connect(master);
  chaosOsc.start(ctx.currentTime);
  bgmNodes.chaosOsc = chaosOsc;
  bgmNodes.chaosFilter = chaosFilter;
  bgmNodes.chaosGain = chaosGain;
};

export const updateBGMChaos = (chaosLevel: number) => {
  if (!bgmActive || !audioCtx) return;
  const ctx = audioCtx;
  const t = ctx.currentTime;

  // Intensify chaos layer
  if (bgmNodes.chaosGain) {
    bgmNodes.chaosGain.gain.linearRampToValueAtTime(chaosLevel * 0.8, t + 0.1);
  }
  if (bgmNodes.chaosFilter) {
    bgmNodes.chaosFilter.frequency.linearRampToValueAtTime(200 + chaosLevel * 1800, t + 0.1);
    bgmNodes.chaosFilter.Q.linearRampToValueAtTime(2 + chaosLevel * 8, t + 0.1);
  }

  // Speed up LFO with chaos
  if (bgmNodes.lfoOsc) {
    bgmNodes.lfoOsc.frequency.linearRampToValueAtTime(0.5 + chaosLevel * 4, t + 0.1);
  }

  // Raise master volume slightly with chaos
  if (bgmNodes.masterGain) {
    bgmNodes.masterGain.gain.linearRampToValueAtTime(0.06 + chaosLevel * 0.06, t + 0.1);
  }

  // Detune pads more with chaos
  if (bgmNodes.padOsc2) {
    bgmNodes.padOsc2.frequency.linearRampToValueAtTime(112 + chaosLevel * 20, t + 0.1);
  }
};

export const stopBGM = () => {
  if (!bgmActive || !audioCtx) return;
  const ctx = audioCtx;
  const t = ctx.currentTime;

  if (bgmNodes.masterGain) {
    bgmNodes.masterGain.gain.linearRampToValueAtTime(0, t + 0.5);
  }

  setTimeout(() => {
    try {
      bgmNodes.bassOsc?.stop();
      bgmNodes.padOsc1?.stop();
      bgmNodes.padOsc2?.stop();
      bgmNodes.droneOsc?.stop();
      bgmNodes.chaosOsc?.stop();
      bgmNodes.lfoOsc?.stop();
    } catch {}
    bgmNodes = {};
    bgmActive = false;
  }, 600);
};
