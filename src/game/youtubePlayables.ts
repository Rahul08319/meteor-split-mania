/**
 * A defensive adapter around the YouTube Playables SDK. The SDK is a no-op in
 * local development, so every integration also has a safe browser fallback.
 */

interface YouTubePlayablesSdk {
  IN_PLAYABLES_ENV?: boolean;
  game: {
    firstFrameReady: () => void;
    gameReady: () => void;
    loadData: () => Promise<string>;
    saveData: (data: string) => Promise<void>;
  };
  system: {
    getLanguage: () => Promise<string>;
    isAudioEnabled: () => boolean;
    onAudioEnabledChange: (callback: (enabled: boolean) => void) => () => void;
    onPause: (callback: () => void) => () => void;
    onResume: (callback: () => void) => () => void;
  };
  engagement: { sendScore: (score: { value: number }) => Promise<void> };
  health: { logError: () => void; logWarning: () => void };
}

declare global {
  interface Window {
    ytgame?: YouTubePlayablesSdk;
    render_game_to_text?: () => string;
    advanceTime?: (milliseconds: number) => void;
  }
}

const SAVE_VERSION = 1;
const STORAGE_PREFIX = 'meteorSplit';
const MAX_SAVE_BYTES = 3 * 1024 * 1024;
let firstFrameReported = false;
let gameReadyReported = false;
let gameReadyQueued = false;
let cloudLoadCompleted = false;

const sdk = () => window.ytgame;
export const isYouTubePlayables = () => Boolean(sdk()?.IN_PLAYABLES_ENV);

const logHealth = (level: 'error' | 'warning') => {
  try { sdk()?.health[level === 'error' ? 'logError' : 'logWarning'](); } catch { /* best effort */ }
};

const isWellFormed = (value: string) => {
  const candidate = value as string & { isWellFormed?: () => boolean };
  return candidate.isWellFormed?.() ?? true;
};

const collectLocalProgress = () => {
  const storage: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key?.startsWith(STORAGE_PREFIX)) {
      const value = localStorage.getItem(key);
      if (value !== null) storage[key] = value;
    }
  }
  return storage;
};

/** Saves all existing Meteor Split progress keys in one YouTube cloud-save. */
export const saveYouTubeProgress = async () => {
  // YouTube rejects saves that race loadData; never risk overwriting an
  // existing cloud save before its load has completed.
  if (!isYouTubePlayables() || !cloudLoadCompleted) return;
  const data = JSON.stringify({ version: SAVE_VERSION, storage: collectLocalProgress() });
  // The Playables limit is 3 MiB and saveData accepts UTF-16 strings.
  if (!isWellFormed(data) || data.length * 2 >= MAX_SAVE_BYTES) { logHealth('warning'); return; }
  try {
    await sdk()!.game.saveData(data);
  } catch {
    logHealth('warning');
  }
};

/** Restores a validated cloud-save into the same local storage keys used by the game. */
export const loadYouTubeProgress = async () => {
  if (!isYouTubePlayables()) return false;
  try {
    const data = await sdk()!.game.loadData();
    if (!data) { cloudLoadCompleted = true; return false; }
    const parsed: unknown = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid Playables save');
    const storage = (parsed as { storage?: unknown }).storage;
    if (!storage || typeof storage !== 'object') throw new Error('Missing Playables save storage');
    Object.entries(storage).forEach(([key, value]) => {
      if (key.startsWith(STORAGE_PREFIX) && typeof value === 'string') localStorage.setItem(key, value);
    });
    cloudLoadCompleted = true;
    return true;
  } catch {
    logHealth('warning');
    return false;
  }
};

export const notifyFirstFrameReady = () => {
  if (firstFrameReported || !isYouTubePlayables()) return;
  try {
    sdk()!.game.firstFrameReady();
    firstFrameReported = true;
    if (gameReadyQueued) notifyGameReady();
  } catch { logHealth('error'); }
};

export const notifyGameReady = () => {
  if (gameReadyReported || !isYouTubePlayables()) return;
  if (!firstFrameReported) { gameReadyQueued = true; return; }
  try { sdk()!.game.gameReady(); gameReadyReported = true; } catch { logHealth('error'); }
};

export const sendYouTubeScore = async (score: number) => {
  if (!isYouTubePlayables() || !Number.isSafeInteger(score) || score < 0) return;
  try { await sdk()!.engagement.sendScore({ value: score }); } catch { logHealth('warning'); }
};

export const initializeYouTubePlayables = (options: {
  onAudioEnabled: (enabled: boolean) => void;
  onPause: () => void;
  onResume: () => void;
  onLanguage: (locale: string) => void;
}) => {
  if (!isYouTubePlayables()) return () => undefined;
  const api = sdk()!;
  const cleanups: Array<() => void> = [];

  try {
    options.onAudioEnabled(api.system.isAudioEnabled());
    cleanups.push(api.system.onAudioEnabledChange(options.onAudioEnabled));
    cleanups.push(api.system.onPause(options.onPause));
    cleanups.push(api.system.onResume(options.onResume));
    void api.system.getLanguage().then(options.onLanguage).catch(() => logHealth('warning'));
  } catch {
    logHealth('error');
  }

  const onError = () => logHealth('error');
  const onUnhandledRejection = () => logHealth('error');
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
  return () => {
    cleanups.forEach(cleanup => cleanup());
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
};
