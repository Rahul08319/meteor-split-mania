const KEY = 'meteorSplit_achievements';
export interface Achievement {
  id: string; title: string; description: string; icon: string;
  check: (ctx: AchievementCtx) => boolean;
}
export interface AchievementCtx {
  score: number; level: number; combo: number; meteorsDestroyed: number;
  bossDefeated: number; chaosLevel: number; powerupsCollected: number;
  gamesPlayed: number;
}
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_blood', title: 'First Strike', description: 'Destroy your first meteor', icon: '☄️', check: c => c.meteorsDestroyed >= 1 },
  { id: 'combo_10', title: 'Combo Master', description: 'Reach a 10x combo', icon: '🔥', check: c => c.combo >= 10 },
  { id: 'combo_25', title: 'Unstoppable', description: 'Reach a 25x combo', icon: '⚡', check: c => c.combo >= 25 },
  { id: 'first_boss', title: 'Boss Slayer', description: 'Defeat your first boss meteor', icon: '👾', check: c => c.bossDefeated >= 1 },
  { id: 'boss_5', title: 'Boss Hunter', description: 'Defeat 5 boss meteors', icon: '💀', check: c => c.bossDefeated >= 5 },
  { id: 'level_5', title: 'Rising Star', description: 'Reach level 5', icon: '⭐', check: c => c.level >= 5 },
  { id: 'level_10', title: 'Cosmic Veteran', description: 'Reach level 10', icon: '🌟', check: c => c.level >= 10 },
  { id: 'score_10k', title: 'Ten Thousand', description: 'Score 10,000 points', icon: '💯', check: c => c.score >= 10000 },
  { id: 'score_50k', title: 'High Scorer', description: 'Score 50,000 points', icon: '🏆', check: c => c.score >= 50000 },
  { id: 'meteors_100', title: 'Centurion', description: 'Destroy 100 meteors in one game', icon: '🎯', check: c => c.meteorsDestroyed >= 100 },
  { id: 'powerup_collector', title: 'Collector', description: 'Collect 10 power-ups', icon: '✨', check: c => c.powerupsCollected >= 10 },
  { id: 'edge_of_chaos', title: 'Edge of Chaos', description: 'Survive at 90% chaos', icon: '⚠️', check: c => c.chaosLevel >= 0.9 },
];
const getUnlocked = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); }
  catch { return new Set(); }
};
const saveUnlocked = (s: Set<string>) => localStorage.setItem(KEY, JSON.stringify([...s]));
export const isUnlocked = (id: string): boolean => getUnlocked().has(id);
export const getAllUnlocked = (): string[] => [...getUnlocked()];
export const checkAchievements = (ctx: AchievementCtx): Achievement[] => {
  const unlocked = getUnlocked();
  const newly: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!unlocked.has(a.id) && a.check(ctx)) {
      unlocked.add(a.id); newly.push(a);
    }
  }
  if (newly.length) saveUnlocked(unlocked);
  return newly;
};
