// Web Audio API sound effects - procedurally generated
let audioCtx: AudioContext | null = null;

const getCtx = (): AudioContext => {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
};

export const resumeAudio = () => {
  if (audioCtx?.state === 'suspended') audioCtx.resume();
};

export const playSplit = (generation: number) => {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  
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
  gain.connect(ctx.destination);
  
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
    gain.connect(ctx.destination);
    
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
    gain.connect(ctx.destination);
    
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
    gain.connect(ctx.destination);
    
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
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
    
    gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.08);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + i * 0.08 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.2);
    
    osc.start(ctx.currentTime + i * 0.08);
    osc.stop(ctx.currentTime + i * 0.08 + 0.25);
  });
};
