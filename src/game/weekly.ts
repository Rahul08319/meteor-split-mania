import { LeaderboardEntry } from './types';
import { SeededRNG } from './daily';

const WEEKLY_STORAGE_KEY = 'meteorSplit_weekly';

export interface WeeklyModifiers {
  name: string;
  description: string;
  seed: number;
  spawnRateMult: number;
  chaosMult: number;
  meteorSizeMult: number;
  bonusScoreMult: number;
  specialStartLevel: number;
}

interface WeeklyData {
  week: string;
  leaderboard: LeaderboardEntry[];
  bestScore: number;
  attempts: number;
}

export const getWeekKey = (date = new Date()): string => {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = local.getDay() || 7;
  local.setDate(local.getDate() - day + 1);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
};

const hash = (value: string) => [...value].reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0) >>> 0;
export const getWeeklySeed = () => hash(`meteor-split-week-${getWeekKey()}`);

const getStoredWeekly = (): WeeklyData | null => {
  try {
    const parsed = JSON.parse(localStorage.getItem(WEEKLY_STORAGE_KEY) || '') as WeeklyData;
    return parsed.week === getWeekKey() ? parsed : null;
  } catch { return null; }
};

export const getWeeklyModifiers = (): WeeklyModifiers => {
  const seed = getWeeklySeed();
  const rng = new SeededRNG(seed);
  const sectors = ['ECLIPSE CIRCUIT', 'ION FRONTIER', 'NOVA GAUNTLET', 'VOID RELAY', 'AURORA RIFT'];
  return {
    name: sectors[rng.int(0, sectors.length - 1)],
    description: 'Shared sector rules generated from this fixed weekly seed, with one leaderboard for the week.',
    seed,
    spawnRateMult: rng.range(1.05, 1.35),
    chaosMult: rng.range(0.8, 1.15),
    meteorSizeMult: rng.range(0.9, 1.15),
    bonusScoreMult: rng.range(1.2, 1.8),
    specialStartLevel: rng.int(2, 3),
  };
};

export const getWeeklyLeaderboard = () => getStoredWeekly()?.leaderboard ?? [];
export const getWeeklyBestScore = () => getStoredWeekly()?.bestScore ?? 0;
export const getWeeklyAttempts = () => getStoredWeekly()?.attempts ?? 0;

export const addWeeklyEntry = (entry: LeaderboardEntry) => {
  const existing = getStoredWeekly() ?? { week: getWeekKey(), leaderboard: [], bestScore: 0, attempts: 0 };
  existing.leaderboard = [...existing.leaderboard, entry].sort((a, b) => b.score - a.score).slice(0, 10);
  existing.bestScore = Math.max(existing.bestScore, entry.score);
  existing.attempts += 1;
  existing.week = getWeekKey();
  localStorage.setItem(WEEKLY_STORAGE_KEY, JSON.stringify(existing));
  return existing.leaderboard;
};
