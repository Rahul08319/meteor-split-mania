import { LeaderboardEntry } from './types';
import { SeededRNG, DailyModifiers } from './daily';

const STORAGE_KEY = 'meteorSplit_weekly';

/** ISO-ish week key, e.g. 2026-W07. Stable for the player's local week. */
export const getWeekKey = (): string => {
  const now = new Date();
  const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const weekSeed = (): number => {
  const key = getWeekKey();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const NAMES = [
  'Iron Gauntlet', 'Nova Cascade', 'Shatter Run', 'Hollow Orbit',
  'Ember Trial', 'Glass Horizon', 'Pulse Siege', 'Silent Debris',
];

export interface WeeklyModifiers extends DailyModifiers {
  seed: number;
}

export const getWeeklyModifiers = (): WeeklyModifiers => {
  const seed = weekSeed();
  const rng = new SeededRNG(seed);
  const name = NAMES[rng.int(0, NAMES.length - 1)];
  const spawnRateMult = rng.range(1.0, 1.7);
  const chaosMult = rng.range(0.9, 1.6);
  const bonusScoreMult = rng.range(1.4, 2.6);
  const traits = [
    spawnRateMult > 1.35 ? 'Dense meteor fields' : 'Steady meteor fields',
    chaosMult > 1.25 ? 'Chaos builds fast' : 'Chaos builds slowly',
    `${bonusScoreMult.toFixed(1)}x score bonus`,
  ];
  return {
    seed,
    name,
    description: `A week-long gauntlet: ${traits.join(' • ')}`,
    spawnRateMult,
    chaosMult,
    meteorSizeMult: rng.range(0.85, 1.25),
    bonusScoreMult,
    specialStartLevel: rng.int(2, 3),
  };
};

interface WeeklyData {
  week: string;
  leaderboard: LeaderboardEntry[];
  bestScore: number;
  attempts: number;
}

const getStored = (): WeeklyData | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeeklyData;
    if (parsed.week !== getWeekKey()) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const getWeeklyLeaderboard = (): LeaderboardEntry[] => getStored()?.leaderboard ?? [];
export const getWeeklyBestScore = (): number => getStored()?.bestScore ?? 0;
export const getWeeklyAttempts = (): number => getStored()?.attempts ?? 0;

export const addWeeklyEntry = (entry: LeaderboardEntry): LeaderboardEntry[] => {
  const data = getStored() ?? { week: getWeekKey(), leaderboard: [], bestScore: 0, attempts: 0 };
  data.leaderboard.push(entry);
  data.leaderboard.sort((a, b) => b.score - a.score);
  data.leaderboard = data.leaderboard.slice(0, 10);
  data.bestScore = Math.max(data.bestScore, entry.score);
  data.attempts++;
  data.week = getWeekKey();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data.leaderboard;
};
