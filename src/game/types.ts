export interface Meteor {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  rotationSpeed: number;
  generation: number; // 0=large, 1=medium, 2=small, 3=tiny
  opacity: number;
  hue: number;
  tapCount: number;
  vertices: number[];
  trail: { x: number; y: number; age: number }[];
  isBoss?: boolean;
  bossHp?: number;
  bossMaxHp?: number;
  bossShield?: number;
  bossMaxShield?: number;
  bossWeakPointAngle?: number;
  bossOrbitPhase?: number;
  bossOrbiters?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  type: 'spark' | 'debris' | 'chaos' | 'shower';
}

export interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

export type PowerUpType = 'slowmo' | 'chaos_reduce' | 'score_multi';

export interface PowerUp {
  id: string;
  x: number;
  y: number;
  vy: number;
  type: PowerUpType;
  life: number;
  radius: number;
  pulse: number;
}

export interface LeaderboardEntry {
  score: number;
  level: number;
  meteorsDestroyed: number;
  maxCombo: number;
  date: string;
}

export type SpecialEventType = 'meteor_shower' | 'boss_meteor';

export interface SpecialEvent {
  type: SpecialEventType;
  timer: number;
  duration: number;
  active: boolean;
  data?: { bossId?: string } & Record<string, unknown>;
}

export interface GameState {
  score: number;
  level: number;
  meteorsDestroyed: number;
  chaosLevel: number;
  gameOver: boolean;
  started: boolean;
  highScore: number;
  combo: number;
  comboTimer: number;
  screenShake: number;
  maxCombo: number;
  slowmoTimer: number;
  scoreMultiTimer: number;
  scoreMultiplier: number;
  specialEvent: SpecialEvent | null;
  lastEventLevel: number;
  bossDefeated: number;
  pulseCooldown: number;
  runTime: number;
  taps: number;
  hits: number;
}
