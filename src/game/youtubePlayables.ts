/**
 * YouTube Playables SDK integration for Meteor Split Mania.
 *
 * Bridges the ytgame global (injected by the SDK script) with the game engine.
 * Every call degrades gracefully to a safe no-op when the SDK is absent, so the
 * same build works in a regular browser, Capacitor APK, Samsung Instant Games,
 * and inside the YouTube Playables webview.
 *
 * SDK reference: https://developers.google.com/youtube/gaming/playables/reference/sdk
 */

import { initPlatformLifecycle } from './platform';
import { collectSnapshot, applySnapshot, SaveSnapshot } from './cloudSync';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true when the SDK is loaded AND we are inside the Playables env. */
export const inPlayablesEnv = (): boolean =>
  typeof window.ytgame !== 'undefined' && window.ytgame!.IN_PLAYABLES_ENV === true;

/** Safe accessor — returns the ytgame global or null when absent. */
const sdk = (): typeof ytgame | null =>
  typeof window.ytgame !== 'undefined' ? window.ytgame! : null;

// ─── Lifecycle ────────────────────────────────────────────────────────────────

let firstFrameSent = false;
let gameReadySent = false;

/**
 * `ytgame.game.firstFrameReady()` — call once when the canvas has drawn its
 * first frame.  Required: game is hidden until this fires.
 */
export const notifyFirstFrameReady = (): void => {
  if (firstFrameSent) return;
  firstFrameSent = true;
  try {
    sdk()?.game.firstFrameReady();
  } catch (err) {
    sdk()?.health.logError();
    console.warn('[ytgame] firstFrameReady error:', err);
  }
};

/**
 * `ytgame.game.gameReady()` — call once when the loading screen is gone and
 * the game is fully interactable.  Required for certification.
 */
export const notifyGameReady = (): void => {
  if (gameReadySent) return;
  if (!firstFrameSent) {
    notifyFirstFrameReady();
  }
  gameReadySent = true;
  try {
    sdk()?.game.gameReady();
  } catch (err) {
    sdk()?.health.logError();
    console.warn('[ytgame] gameReady error:', err);
  }
};

// ─── Cloud Save ───────────────────────────────────────────────────────────────

/**
 * `ytgame.game.saveData()` — persists the full game snapshot (progress,
 * settings, skins, leaderboard) to YouTube cloud storage.
 * Falls back silently — data always lives in localStorage too.
 */
export const saveYouTubeProgress = async (): Promise<void> => {
  const g = sdk();
  if (!g || !inPlayablesEnv()) return;
  try {
    const data = JSON.stringify(collectSnapshot());
    if (!data.isWellFormed?.()) {
      // String.isWellFormed is ES2024 — guard for older runtimes
      console.warn('[ytgame] saveData: snapshot is not a well-formed UTF-16 string');
      return;
    }
    await g.game.saveData(data);
  } catch (err) {
    g.health.logError();
    console.warn('[ytgame] saveData error:', err);
  }
};

/**
 * `ytgame.game.loadData()` — loads the cloud snapshot and merges it with
 * localStorage. Returns true when cloud data was applied.
 */
export const loadYouTubeProgress = async (): Promise<boolean> => {
  const g = sdk();
  if (!g || !inPlayablesEnv()) return false;
  try {
    const raw = await g.game.loadData();
    if (!raw) return false;
    applySnapshot(JSON.parse(raw) as SaveSnapshot);
    return true;
  } catch (err) {
    g.health.logWarning();
    console.warn('[ytgame] loadData error:', err);
    return false;
  }
};

// ─── Score ────────────────────────────────────────────────────────────────────

/**
 * `ytgame.engagement.sendScore()` — reports the best score to YouTube so it
 * can be displayed in the game's YouTube UI card.
 */
export const sendYouTubeScore = async (score: number): Promise<void> => {
  const g = sdk();
  if (!g || !inPlayablesEnv() || score <= 0) return;
  // Score must be a safe integer
  const safeScore = Math.min(Math.floor(score), Number.MAX_SAFE_INTEGER);
  try {
    await g.engagement.sendScore({ value: safeScore });
  } catch (err) {
    g.health.logWarning();
    console.warn('[ytgame] sendScore error:', err);
  }
};

// ─── System events & callbacks ────────────────────────────────────────────────

export interface HostCallbacks {
  onAudioEnabled: (enabled: boolean) => void;
  onPause: () => void;
  onResume: () => void;
  onLanguage: (locale: string) => void;
}

/**
 * Registers all required YouTube Playables system callbacks and initialises the
 * platform lifecycle shim (audio unlock, visibility-based pause/resume).
 *
 * Required callbacks wired up here:
 *  - `ytgame.system.isAudioEnabled()` — initial audio state (synchronous)
 *  - `ytgame.system.onAudioEnabledChange()` — ongoing audio mute/unmute
 *  - `ytgame.system.onPause()` — host pause (backgrounded, ad playing, etc.)
 *  - `ytgame.system.onResume()` — host resume
 *  - `ytgame.system.getLanguage()` — BCP-47 locale for UI localisation
 *
 * @returns cleanup function — call on component unmount.
 */
export const initializeYouTubePlayables = (cb: HostCallbacks): (() => void) => {
  const g = sdk();
  const cleanupFns: Array<() => void> = [];

  if (g) {
    try {
      // ── Required: initial audio state ──────────────────────────────────────
      const audioEnabled = g.system.isAudioEnabled();
      cb.onAudioEnabled(audioEnabled);

      // ── Required: ongoing audio state changes ──────────────────────────────
      const unsetAudio = g.system.onAudioEnabledChange((enabled) => {
        cb.onAudioEnabled(enabled);
      });
      if (typeof unsetAudio === 'function') cleanupFns.push(unsetAudio);

      // ── Required: pause / resume ───────────────────────────────────────────
      const unsetPause = g.system.onPause(() => {
        cb.onPause();
      });
      if (typeof unsetPause === 'function') cleanupFns.push(unsetPause);

      const unsetResume = g.system.onResume(() => {
        cb.onResume();
      });
      if (typeof unsetResume === 'function') cleanupFns.push(unsetResume);

      // ── Recommended: locale ────────────────────────────────────────────────
      g.system.getLanguage().then((locale) => {
        if (locale) cb.onLanguage(locale);
      }).catch((err) => {
        g.health.logWarning();
        console.warn('[ytgame] getLanguage error:', err);
      });
    } catch (err) {
      g.health.logError();
      console.warn('[ytgame] initializeYouTubePlayables error:', err);
    }
  }

  // Platform shim: works with or without the SDK.
  // Unlocks audio on first gesture and bridges visibility-based pause/resume
  // for browsers and Capacitor builds that have no host SDK.
  const cleanupPlatform = initPlatformLifecycle({
    onUnlockAudio: () => cb.onAudioEnabled(true),
    onPause: cb.onPause,
    onResume: cb.onResume,
  });

  return () => {
    cleanupFns.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
    cleanupPlatform();
  };
};

// ─── Health logging helpers ───────────────────────────────────────────────────

/**
 * Log a game error to YouTube's health system (best-effort, rate-limited).
 * Use inside catch blocks for critical game paths.
 */
export const logYTError = (): void => {
  try { sdk()?.health.logError(); } catch { /* ignore */ }
};

/**
 * Log a game warning to YouTube's health system (best-effort, rate-limited).
 */
export const logYTWarning = (): void => {
  try { sdk()?.health.logWarning(); } catch { /* ignore */ }
};

// ─── Window augmentation for test environment ─────────────────────────────────
declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (milliseconds: number) => void;
  }
}
