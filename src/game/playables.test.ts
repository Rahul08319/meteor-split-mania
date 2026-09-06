import { expect, it, vi } from 'vitest';
import { createRunMissions, updateRunMissions } from './missions';
import { getWeekKey, getWeeklyModifiers } from './weekly';

it('creates repeatable weekly rules and advances run missions', () => {
  const first = getWeeklyModifiers();
  const second = getWeeklyModifiers();
  expect(first.seed).toBe(second.seed);
  expect(getWeekKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  const missions = updateRunMissions(createRunMissions(), { destroyed: 50, combo: 10, score: 5000 });
  expect(missions.every(mission => mission.complete)).toBe(true);
});

it('loads cloud data before saving and reports readiness in the required order', async () => {
  vi.resetModules();
  const calls: string[] = [];
  const saved: string[] = [];
  (window as any).ytgame = {
    IN_PLAYABLES_ENV: true,
    game: {
      firstFrameReady: () => calls.push('first-frame'),
      gameReady: () => calls.push('game-ready'),
      loadData: async () => JSON.stringify({ version: 1, storage: { meteorSplitHigh: '1200' } }),
      saveData: async (data: string) => { saved.push(data); },
    },
    system: {
      getLanguage: async () => 'en-US',
      isAudioEnabled: () => true,
      onAudioEnabledChange: () => () => undefined,
      onPause: () => () => undefined,
      onResume: () => () => undefined,
    },
    engagement: { sendScore: async () => undefined },
    health: { logError: () => undefined, logWarning: () => undefined },
  };

  const sdk = await import('./youtubePlayables');
  await sdk.loadYouTubeProgress();
  sdk.notifyGameReady();
  sdk.notifyFirstFrameReady();
  await sdk.saveYouTubeProgress();

  expect(calls).toEqual(['first-frame', 'game-ready']);
  expect(localStorage.getItem('meteorSplitHigh')).toBe('1200');
  expect(saved).toHaveLength(1);
});
