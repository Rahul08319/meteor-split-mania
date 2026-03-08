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
  type: 'spark' | 'debris' | 'chaos';
}

export interface Star {
  x: number;
  y: number;
  size: number;
  brightness: number;
  twinkleSpeed: number;
  twinkleOffset: number;
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
}
