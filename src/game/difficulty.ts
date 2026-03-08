export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyConfig {
  label: string;
  icon: string;
  chaosPerOverTap: number;
  chaosDecayRate: number;
  spawnIntervalBase: number;
  spawnIntervalPerLevel: number;
  spawnIntervalMin: number;
  bossHpBase: number;
  bossHpPerLevel: number;
  meteorSpeedMult: number;
  scoreMultiplier: number;
  powerUpDropChance: number;
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: 'EASY',
    icon: '🌙',
    chaosPerOverTap: 0.08,
    chaosDecayRate: 0.00015,
    spawnIntervalBase: 3500,
    spawnIntervalPerLevel: 200,
    spawnIntervalMin: 1200,
    bossHpBase: 3,
    bossHpPerLevel: 0.3,
    meteorSpeedMult: 0.8,
    scoreMultiplier: 0.8,
    powerUpDropChance: 0.22,
  },
  normal: {
    label: 'NORMAL',
    icon: '☀️',
    chaosPerOverTap: 0.15,
    chaosDecayRate: 0.0001,
    spawnIntervalBase: 3000,
    spawnIntervalPerLevel: 250,
    spawnIntervalMin: 800,
    bossHpBase: 5,
    bossHpPerLevel: 0.5,
    meteorSpeedMult: 1,
    scoreMultiplier: 1,
    powerUpDropChance: 0.15,
  },
  hard: {
    label: 'HARD',
    icon: '🔥',
    chaosPerOverTap: 0.22,
    chaosDecayRate: 0.00006,
    spawnIntervalBase: 2500,
    spawnIntervalPerLevel: 300,
    spawnIntervalMin: 500,
    bossHpBase: 7,
    bossHpPerLevel: 0.8,
    meteorSpeedMult: 1.3,
    scoreMultiplier: 1.5,
    powerUpDropChance: 0.1,
  },
};
