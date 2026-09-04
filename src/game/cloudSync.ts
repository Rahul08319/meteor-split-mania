import { supabase } from '@/integrations/supabase/client';
import { getSettings, replaceSettings, AudioSettings } from './settings';

const KEYS = {
  settings: 'meteorSplit_settings',
  skin: 'meteorSplit_skin',
  theme: 'meteorSplit_theme',
  bossDefeats: 'meteorSplit_bossDefeats',
  high: 'meteorSplitHigh',
  leaderboard: 'meteorSplit_leaderboard',
  achievements: 'meteorSplit_achievements',
};

export interface SaveSnapshot {
  settings: AudioSettings;
  unlocks: { skin: string; theme: string; bossDefeats: number; highScore: number };
  leaderboard: unknown[];
  achievements: string[];
}

const readJson = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; }
  catch { return fallback; }
};

export const collectSnapshot = (): SaveSnapshot => ({
  settings: getSettings(),
  unlocks: {
    skin: localStorage.getItem(KEYS.skin) || 'default',
    theme: localStorage.getItem(KEYS.theme) || 'default',
    bossDefeats: parseInt(localStorage.getItem(KEYS.bossDefeats) || '0'),
    highScore: parseInt(localStorage.getItem(KEYS.high) || '0'),
  },
  leaderboard: readJson<unknown[]>(KEYS.leaderboard, []),
  achievements: readJson<string[]>(KEYS.achievements, []),
});

export const applySnapshot = (snap: SaveSnapshot) => {
  if (snap.settings) replaceSettings(snap.settings);
  if (snap.unlocks) {
    localStorage.setItem(KEYS.skin, snap.unlocks.skin || 'default');
    localStorage.setItem(KEYS.theme, snap.unlocks.theme || 'default');
    localStorage.setItem(KEYS.bossDefeats, String(snap.unlocks.bossDefeats ?? 0));
    const localHigh = parseInt(localStorage.getItem(KEYS.high) || '0');
    localStorage.setItem(KEYS.high, String(Math.max(localHigh, snap.unlocks.highScore ?? 0)));
  }
  // Merge leaderboards (best 20) and union achievements so no device loses progress.
  const local = readJson<{ score: number }[]>(KEYS.leaderboard, []);
  const remote = (snap.leaderboard as { score: number }[]) || [];
  const seen = new Set<string>();
  const merged = [...remote, ...local]
    .filter(e => {
      const k = JSON.stringify(e);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
  localStorage.setItem(KEYS.leaderboard, JSON.stringify(merged));

  const localAch = readJson<string[]>(KEYS.achievements, []);
  const mergedAch = [...new Set([...localAch, ...(snap.achievements || [])])];
  localStorage.setItem(KEYS.achievements, JSON.stringify(mergedAch));
};

export const pushSave = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const snap = collectSnapshot();
  const { error } = await supabase.from('game_saves').upsert({
    user_id: user.id,
    settings: snap.settings as unknown as Record<string, unknown>,
    unlocks: snap.unlocks as unknown as Record<string, unknown>,
    leaderboard: snap.leaderboard as unknown as Record<string, unknown>[],
    achievements: snap.achievements,
  });
  if (error) throw error;
};

export const pullSave = async (): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('game_saves')
    .select('settings, unlocks, leaderboard, achievements')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;
  applySnapshot({
    settings: data.settings as unknown as AudioSettings,
    unlocks: data.unlocks as unknown as SaveSnapshot['unlocks'],
    leaderboard: (data.leaderboard as unknown as unknown[]) || [],
    achievements: (data.achievements as unknown as string[]) || [],
  });
  return true;
};
