import { LeaderboardEntry } from './types';

// Seeded PRNG (mulberry32)
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6D2B79F5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}

// Generate a daily seed from the current date
export const getDailySeed = (): number => {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getDailyDateKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Daily leaderboard
const DAILY_STORAGE_KEY = 'meteorSplit_daily';

interface DailyData {
  date: string;
  leaderboard: LeaderboardEntry[];
  bestScore: number;
  attempts: number;
}

const getStoredDaily = (): DailyData | null => {
  try {
    const data = localStorage.getItem(DAILY_STORAGE_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data) as DailyData;
    if (parsed.date !== getDailyDateKey()) return null; // expired
    return parsed;
  } catch {
    return null;
  }
};

export const getDailyLeaderboard = (): LeaderboardEntry[] => {
  return getStoredDaily()?.leaderboard ?? [];
};

export const getDailyBestScore = (): number => {
  return getStoredDaily()?.bestScore ?? 0;
};

export const getDailyAttempts = (): number => {
  return getStoredDaily()?.attempts ?? 0;
};

export const addDailyEntry = (entry: LeaderboardEntry): LeaderboardEntry[] => {
  const existing = getStoredDaily() ?? {
    date: getDailyDateKey(),
    leaderboard: [],
    bestScore: 0,
    attempts: 0,
  };
  existing.leaderboard.push(entry);
  existing.leaderboard.sort((a, b) => b.score - a.score);
  existing.leaderboard = existing.leaderboard.slice(0, 10);
  existing.bestScore = Math.max(existing.bestScore, entry.score);
  existing.attempts++;
  existing.date = getDailyDateKey();
  localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(existing));
  return existing.leaderboard;
};

// Daily challenge modifiers - generated from seed
export interface DailyModifiers {
  name: string;
  description: string;
  spawnRateMult: number;
  chaosMult: number;
  meteorSizeMult: number;
  bonusScoreMult: number;
  specialStartLevel: number;
}

const MODIFIER_NAMES = [
  'Asteroid Belt', 'Crimson Storm', 'Crystal Fields', 'Dark Nebula',
  'Frozen Drift', 'Solar Flare', 'Void Rush', 'Gravity Well',
  'Plasma Rain', 'Cosmic Tide', 'Nova Burst', 'Quantum Shift',
];

export const getDailyModifiers = (): DailyModifiers => {
  const rng = new SeededRNG(getDailySeed());
  const nameIdx = rng.int(0, MODIFIER_NAMES.length - 1);

  return {
    name: MODIFIER_NAMES[nameIdx],
    description: generateDescription(rng),
    spawnRateMult: rng.range(0.7, 1.5),
    chaosMult: rng.range(0.6, 1.4),
    meteorSizeMult: rng.range(0.8, 1.3),
    bonusScoreMult: rng.range(1.0, 2.0),
    specialStartLevel: rng.int(2, 4),
  };
};

function generateDescription(rng: SeededRNG): string {
  const traits: string[] = [];
  const r1 = rng.next();
  if (r1 < 0.33) traits.push('Fast spawns');
  else if (r1 < 0.66) traits.push('Slow spawns');
  else traits.push('Normal spawns');

  const r2 = rng.next();
  if (r2 < 0.33) traits.push('High chaos');
  else if (r2 < 0.66) traits.push('Low chaos');
  else traits.push('Normal chaos');

  const r3 = rng.next();
  if (r3 < 0.5) traits.push('2x score bonus');

  return traits.join(' • ');
}
