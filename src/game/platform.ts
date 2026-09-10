/**
 * Platform shim for Samsung Instant Games (Instant Plays / Game Plug-in webview)
 * and Capacitor Android builds. Keeps audio, haptics and the daily challenge
 * behaving the same on every target without platform-specific game code.
 */
export type Platform = 'web' | 'capacitor' | 'samsung_instant';

export const detectPlatform = (): Platform => {
  const w = window as unknown as { Capacitor?: unknown; SamsungInstantPlays?: unknown };
  if (w.SamsungInstantPlays) return 'samsung_instant';
  if (w.Capacitor) return 'capacitor';
  const ua = navigator.userAgent || '';
  if (/SamsungInstant|InstantPlays/i.test(ua)) return 'samsung_instant';
  return 'web';
};

export const platform = detectPlatform();
export const isInstantGame = platform === 'samsung_instant';

/**
 * Instant Games webviews start with audio locked and can suspend the page when
 * the host UI takes focus. Call once at boot: unlocks audio on the first
 * gesture and reports visibility changes so music/SFX can be paused.
 */
export const initPlatformLifecycle = (opts: {
  onUnlockAudio: () => void;
  onPause: () => void;
  onResume: () => void;
}) => {
  const unlock = () => {
    opts.onUnlockAudio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('touchstart', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });

  const onVis = () => (document.hidden ? opts.onPause() : opts.onResume());
  document.addEventListener('visibilitychange', onVis);

  return () => {
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };
};

/**
 * Instant Games runs inside a host webview where `navigator.vibrate` may be
 * gated. Returns whether vibration is usable so the settings screen can hide
 * the haptics toggle instead of offering a dead switch.
 */
export const supportsHaptics = (): boolean => {
  try { return typeof navigator.vibrate === 'function'; } catch { return false; }
};

/**
 * The daily challenge seed must be stable for a player's calendar day even when
 * the host webview reports UTC. Uses the device's local date, which matches the
 * seed logic in daily.ts, and exposes the resolved key for diagnostics.
 */
export const dailyDiagnostics = () => ({
  platform,
  localDate: new Date().toString(),
  timezoneOffsetMinutes: new Date().getTimezoneOffset(),
  storageAvailable: (() => {
    try { localStorage.setItem('__probe', '1'); localStorage.removeItem('__probe'); return true; }
    catch { return false; }
  })(),
});
