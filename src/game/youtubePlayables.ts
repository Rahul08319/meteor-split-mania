/**
 * Host-bridge for embedded game hosts (Instant Games / Playables style webviews).
 * Every call degrades to a safe local no-op when no host SDK is present, so the
 * same build runs in a browser, in the Capacitor APK, and inside a host webview.
 */
import { initPlatformLifecycle } from './platform';
import { collectSnapshot, applySnapshot, SaveSnapshot } from './cloudSync';

interface HostSdk {
  game?: {
    firstFrameReady?: () => void;
    gameReady?: () => void;
  };
  system?: {
    onPause?: (cb: () => void) => void;
    onResume?: (cb: () => void) => void;
    onAudioEnabledChange?: (cb: (enabled: boolean) => void) => void;
    getLanguage?: () => string;
  };
  engagement?: {
    sendScore?: (payload: { value: number }) => Promise<void>;
  };
  saveData?: {
    save?: (data: string) => Promise<void>;
    load?: () => Promise<string | null>;
  };
}

const getHost = (): HostSdk | null => {
  const w = window as unknown as { ytgame?: HostSdk; SamsungInstantPlays?: HostSdk };
  return w.ytgame ?? w.SamsungInstantPlays ?? null;
};

let firstFrameSent = false;
let gameReadySent = false;

export const notifyFirstFrameReady = () => {
  if (firstFrameSent) return;
  firstFrameSent = true;
  try { getHost()?.game?.firstFrameReady?.(); } catch { /* host optional */ }
};

export const notifyGameReady = () => {
  if (gameReadySent) return;
  gameReadySent = true;
  try { getHost()?.game?.gameReady?.(); } catch { /* host optional */ }
};

export interface HostCallbacks {
  onAudioEnabled: (enabled: boolean) => void;
  onPause: () => void;
  onResume: () => void;
  onLanguage: (locale: string) => void;
}

export const initializeYouTubePlayables = (cb: HostCallbacks): (() => void) => {
  const host = getHost();
  try {
    host?.system?.onPause?.(cb.onPause);
    host?.system?.onResume?.(cb.onResume);
    host?.system?.onAudioEnabledChange?.(cb.onAudioEnabled);
    const locale = host?.system?.getLanguage?.();
    if (locale) cb.onLanguage(locale);
  } catch { /* host optional */ }

  // Works with or without a host SDK: unlocks audio on first gesture and
  // pauses/resumes with page visibility.
  return initPlatformLifecycle({
    onUnlockAudio: () => cb.onAudioEnabled(true),
    onPause: cb.onPause,
    onResume: cb.onResume,
  });
};

export const saveYouTubeProgress = async (): Promise<void> => {
  const host = getHost();
  if (!host?.saveData?.save) return;
  try { await host.saveData.save(JSON.stringify(collectSnapshot())); }
  catch { /* progress still lives in local storage */ }
};

export const loadYouTubeProgress = async (): Promise<boolean> => {
  const host = getHost();
  if (!host?.saveData?.load) return false;
  try {
    const raw = await host.saveData.load();
    if (!raw) return false;
    applySnapshot(JSON.parse(raw) as SaveSnapshot);
    return true;
  } catch {
    return false;
  }
};

export const sendYouTubeScore = async (score: number): Promise<void> => {
  const host = getHost();
  if (!host?.engagement?.sendScore) return;
  try { await host.engagement.sendScore({ value: score }); }
  catch { /* scores still stored locally */ }
};

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (milliseconds: number) => void;
  }
}
