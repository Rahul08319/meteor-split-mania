import { LeaderboardEntry } from './types';

const STORAGE_KEY = 'meteorSplit_leaderboard';
const MAX_ENTRIES = 20;

export const getLeaderboard = (): LeaderboardEntry[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const addLeaderboardEntry = (entry: LeaderboardEntry): LeaderboardEntry[] => {
  const board = getLeaderboard();
  board.push(entry);
  board.sort((a, b) => b.score - a.score);
  const trimmed = board.slice(0, MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return trimmed;
};

export const getStats = () => {
  const board = getLeaderboard();
  if (board.length === 0) return null;
  return {
    gamesPlayed: board.length,
    bestScore: board[0]?.score ?? 0,
    bestLevel: Math.max(...board.map(e => e.level)),
    totalMeteors: board.reduce((s, e) => s + e.meteorsDestroyed, 0),
    avgScore: Math.round(board.reduce((s, e) => s + e.score, 0) / board.length),
    bestCombo: Math.max(...board.map(e => e.maxCombo)),
  };
};
