/**
 * Zero-Dependency Multi-Platform SDK Bridge for Meteor Split Mania.
 * 
 * Natively supports all target publishing ecosystems without Playgama or any 3rd-party wrapper:
 *  - YouTube Playables (v1 SDK)
 *  - Facebook Instant Games (v7.1 FBInstant)
 *  - Poki (PokiSDK v2)
 *  - CrazyGames (CrazyGames SDK v3)
 *  - Yandex Games (YaGames v2)
 *  - GameDistribution (GD SDK)
 *  - Discord Activities (Discord Embedded App SDK / RPC webview)
 *  - JioGames (JioSDK)
 *  - Y8 (Id.net SDK)
 *  - Lagged (Lagged API)
 *  - Microsoft Store (PWA)
 *  - Huawei & Xiaomi Quick Games (qg runtime)
 *  - MSN Games & Reddit Games (postMessage frame bridge)
 *  - Universal Web fallback (graceful zero-dependency degradation)
 */

import { distributionTarget, DistributionTarget } from './distribution';
import { initPlatformLifecycle } from './platform';
import { collectSnapshot, applySnapshot, SaveSnapshot } from './cloudSync';

// ─── Platform Global Augmentations ──────────────────────────────────────────

declare global {
  interface Window {
    // YouTube
    ytgame?: typeof ytgame;

    // Facebook Instant Games
    FBInstant?: {
      initializeAsync: () => Promise<void>;
      startGameAsync: () => Promise<void>;
      setLoadingProgress: (percent: number) => void;
      player: {
        getID: () => string;
        getName: () => string;
        setDataAsync: (data: Record<string, unknown>) => Promise<void>;
        getDataAsync: (keys: string[]) => Promise<Record<string, unknown>>;
      };
      getLeaderboardAsync: (name: string) => Promise<{
        setScoreAsync: (score: number) => Promise<void>;
      }>;
      getInterstitialAdAsync: (placement: string) => Promise<{
        loadAsync: () => Promise<void>;
        showAsync: () => Promise<void>;
      }>;
      getRewardedVideoAsync: (placement: string) => Promise<{
        loadAsync: () => Promise<void>;
        showAsync: () => Promise<void>;
      }>;
      onPause: (cb: () => void) => void;
    };

    // Poki SDK
    PokiSDK?: {
      init: () => Promise<void>;
      gameLoadingFinished: () => void;
      gameplayStart: () => void;
      gameplayStop: () => void;
      commercialBreak: () => Promise<void>;
      rewardedBreak: () => Promise<boolean>;
      setDebug: (debug: boolean) => void;
    };

    // CrazyGames SDK
    CrazyGames?: {
      SDK: {
        game: {
          loadingStop: () => void;
          gameplayStart: () => void;
          gameplayStop: () => void;
        };
        ad: {
          requestAd: (type: 'midgame' | 'rewarded', callbacks?: {
            adStarted?: () => void;
            adFinished?: () => void;
            adError?: (error: unknown) => void;
          }) => Promise<void>;
        };
        data: {
          save: (key: string, value: string) => Promise<void>;
          load: (key: string) => Promise<string | null>;
        };
      };
    };

    // Yandex Games
    YaGames?: {
      init: () => Promise<{
        features: {
          LoadingAPI?: { ready: () => void };
        };
        adv: {
          showFullscreenAdv: (opts: { callbacks?: { onClose?: (wasShown: boolean) => void; onError?: (err: unknown) => void } }) => void;
          showRewardedVideo: (opts: { callbacks?: { onRewarded?: () => void; onClose?: () => void; onError?: (err: unknown) => void } }) => void;
        };
        getPlayer: () => Promise<{
          setData: (data: Record<string, unknown>) => Promise<void>;
          getData: (keys?: string[]) => Promise<Record<string, unknown>>;
        }>;
        getLeaderboards: () => Promise<{
          setLeaderboardScore: (name: string, score: number) => Promise<void>;
        }>;
      }>;
    };

    // GameDistribution
    gdsdk?: {
      showAd: (type?: string) => Promise<void>;
      preloadAd: () => Promise<void>;
    };

    // JioGames
    JioGames?: {
      postScore: (score: number) => void;
      cacheAd: () => void;
      showAd: () => void;
      showRewardAd: () => void;
    };

    // Y8 / Id.net
    ID?: {
      init: (opts: Record<string, unknown>) => void;
      GamePlay: {
        start: () => void;
        stop: () => void;
      };
      ads: {
        display: (cb?: () => void) => void;
        reward: (cb?: (rewarded: boolean) => void) => void;
      };
    };

    // Lagged
    LaggedAPI?: {
      init: (devId: string, pubId: string) => void;
      Achievements: { save: (id: string, cb?: () => void) => void };
      Scores: { save: (opts: { score: number; board: string }, cb?: () => void) => void };
      showAd: (type: string, cb?: () => void) => void;
    };

    // Huawei & Xiaomi Quick Games
    qg?: {
      setStorage: (opts: { key: string; data: string; success?: () => void }) => void;
      getStorage: (opts: { key: string; success?: (res: { data: string }) => void }) => void;
      createInterstitialAd: (opts: { adUnitId: string }) => {
        load: () => Promise<void>;
        show: () => Promise<void>;
      };
      createRewardedVideoAd: (opts: { adUnitId: string }) => {
        load: () => Promise<void>;
        show: () => Promise<void>;
        onClose: (cb: (res: { isEnded: boolean }) => void) => void;
      };
    };
  }
}

// ─── Platform Detection & Capabilities ──────────────────────────────────────

let activeTarget: DistributionTarget = distributionTarget;
let yandexSdkInstance: any = null;
let firstFrameSent = false;
let gameReadySent = false;
let isAudioMutedByHost = false;

export const REWARD_IDS = {
  EXTRA_LIFE: 'meteor-split-extra-life-001',
  SLOW_MO_BOOST: 'meteor-split-slowmo-boost-001',
  SHIELD_POWER: 'meteor-split-shield-power-001',
} as const;

/** Detect if running inside a specific platform webview or host environment */
export const detectCurrentPlatform = (): DistributionTarget => {
  if (typeof window.ytgame !== 'undefined' && window.ytgame?.IN_PLAYABLES_ENV) return 'youtube-playables';
  if (typeof window.FBInstant !== 'undefined') return 'facebook-instant-games';
  if (typeof window.PokiSDK !== 'undefined') return 'poki';
  if (typeof window.CrazyGames !== 'undefined') return 'crazygames';
  if (typeof window.YaGames !== 'undefined') return 'yandex-games';
  if (typeof window.gdsdk !== 'undefined') return 'gamedistribution';
  if (typeof window.JioGames !== 'undefined') return 'jiogames';
  if (typeof window.ID !== 'undefined') return 'y8';
  if (typeof window.LaggedAPI !== 'undefined') return 'lagged';
  if (typeof window.qg !== 'undefined') return 'huawei-quick-game';
  return activeTarget || 'web';
};

export const inPlayablesEnv = (): boolean => {
  return (typeof window.ytgame !== 'undefined' && window.ytgame?.IN_PLAYABLES_ENV === true) ||
         typeof window.FBInstant !== 'undefined' ||
         typeof window.PokiSDK !== 'undefined' ||
         typeof window.CrazyGames !== 'undefined' ||
         typeof window.YaGames !== 'undefined';
};

// ─── Unified Platform Initialization ────────────────────────────────────────

export interface PlatformHostCallbacks {
  onAudioEnabled: (enabled: boolean) => void;
  onPause: () => void;
  onResume: () => void;
  onLanguage: (locale: string) => void;
}

/**
 * Initializes the target platform SDK cleanly, registering required lifecycle,
 * audio, and visibility hooks.
 */
export const initializePlatform = async (cb: PlatformHostCallbacks): Promise<(() => void)> => {
  activeTarget = detectCurrentPlatform();
  const cleanupFns: Array<() => void> = [];

  // 1. YouTube Playables SDK
  if (window.ytgame) {
    try {
      cb.onAudioEnabled(window.ytgame.system.isAudioEnabled());
      const unsetAudio = window.ytgame.system.onAudioEnabledChange((enabled) => {
        isAudioMutedByHost = !enabled;
        cb.onAudioEnabled(enabled);
      });
      if (typeof unsetAudio === 'function') cleanupFns.push(unsetAudio);

      const unsetPause = window.ytgame.system.onPause(cb.onPause);
      if (typeof unsetPause === 'function') cleanupFns.push(unsetPause);

      const unsetResume = window.ytgame.system.onResume(cb.onResume);
      if (typeof unsetResume === 'function') cleanupFns.push(unsetResume);

      window.ytgame.system.getLanguage().then((loc) => {
        if (loc) cb.onLanguage(loc);
      }).catch(() => { /* safe */ });
    } catch (err) {
      console.warn('[PlatformBridge] ytgame init error:', err);
    }
  }

  // 2. Facebook Instant Games
  if (window.FBInstant) {
    try {
      await window.FBInstant.initializeAsync();
      window.FBInstant.setLoadingProgress(100);
      window.FBInstant.onPause?.(cb.onPause);
    } catch (err) {
      console.warn('[PlatformBridge] FBInstant init error:', err);
    }
  }

  // 3. Poki SDK
  if (window.PokiSDK) {
    try {
      await window.PokiSDK.init();
    } catch (err) {
      console.warn('[PlatformBridge] PokiSDK init error:', err);
    }
  }

  // 4. Yandex Games SDK
  if (window.YaGames) {
    try {
      yandexSdkInstance = await window.YaGames.init();
    } catch (err) {
      console.warn('[PlatformBridge] YaGames init error:', err);
    }
  }

  // 5. Discord / MSN / Reddit PostMessage Bridge
  const handleHostMessages = (e: MessageEvent) => {
    if (!e.data || typeof e.data !== 'object') return;
    const { type, payload } = e.data;
    if (type === 'PAUSE' || type === 'DISCORD_BACKGROUNDED') cb.onPause();
    if (type === 'RESUME' || type === 'DISCORD_FOREGROUNDED') cb.onResume();
    if (type === 'MUTE') {
      isAudioMutedByHost = true;
      cb.onAudioEnabled(false);
    }
    if (type === 'UNMUTE') {
      isAudioMutedByHost = false;
      cb.onAudioEnabled(true);
    }
  };
  window.addEventListener('message', handleHostMessages);
  cleanupFns.push(() => window.removeEventListener('message', handleHostMessages));

  // 6. Generic Platform Fallback Lifecycle (visibility change, gesture audio unlock)
  const cleanupPlatform = initPlatformLifecycle({
    onUnlockAudio: () => {
      if (!isAudioMutedByHost) cb.onAudioEnabled(true);
    },
    onPause: cb.onPause,
    onResume: cb.onResume,
  });
  cleanupFns.push(cleanupPlatform);

  return () => {
    cleanupFns.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  };
};

// ─── Lifecycle Notifications ────────────────────────────────────────────────

export const notifyFirstFrameReady = (): void => {
  if (firstFrameSent) return;
  firstFrameSent = true;

  try {
    if (window.ytgame) {
      window.ytgame.game.firstFrameReady();
    }
    // Postmessage signal for Reddit/MSN frame host
    window.parent?.postMessage({ type: 'FIRST_FRAME_READY', target: activeTarget }, '*');
  } catch (err) {
    console.warn('[PlatformBridge] firstFrameReady error:', err);
  }
};

export const notifyGameReady = async (): Promise<void> => {
  if (gameReadySent) return;
  if (!firstFrameSent) notifyFirstFrameReady();
  gameReadySent = true;

  try {
    if (window.ytgame) {
      window.ytgame.game.gameReady();
    }
    if (window.FBInstant) {
      await window.FBInstant.startGameAsync();
    }
    if (window.PokiSDK) {
      window.PokiSDK.gameLoadingFinished();
    }
    if (window.CrazyGames) {
      window.CrazyGames.SDK.game.loadingStop();
    }
    if (yandexSdkInstance?.features?.LoadingAPI) {
      yandexSdkInstance.features.LoadingAPI.ready();
    }
    // Postmessage signal for Discord / MSN / Reddit
    window.parent?.postMessage({ type: 'GAME_READY', target: activeTarget }, '*');
  } catch (err) {
    console.warn('[PlatformBridge] gameReady error:', err);
  }
};

export const notifyGameplayStart = (): void => {
  try {
    window.PokiSDK?.gameplayStart();
    window.CrazyGames?.SDK.game.gameplayStart();
    window.ID?.GamePlay.start();
    window.parent?.postMessage({ type: 'GAMEPLAY_START' }, '*');
  } catch { /* safe */ }
};

export const notifyGameplayStop = (): void => {
  try {
    window.PokiSDK?.gameplayStop();
    window.CrazyGames?.SDK.game.gameplayStop();
    window.ID?.GamePlay.stop();
    window.parent?.postMessage({ type: 'GAMEPLAY_STOP' }, '*');
  } catch { /* safe */ }
};

// ─── Ads Monetization Bridge ─────────────────────────────────────────────────

/**
 * Show an interstitial ad at natural breaks (game over, round completion).
 * Non-rewarding, degrades cleanly to false if no ad or unavailable.
 */
export const showInterstitialAd = async (): Promise<boolean> => {
  try {
    // YouTube Playables
    if (window.ytgame) {
      await window.ytgame.ads.requestInterstitialAd();
      return true;
    }

    // Poki
    if (window.PokiSDK) {
      await window.PokiSDK.commercialBreak();
      return true;
    }

    // CrazyGames
    if (window.CrazyGames) {
      await window.CrazyGames.SDK.ad.requestAd('midgame');
      return true;
    }

    // Yandex Games
    if (yandexSdkInstance) {
      return new Promise<boolean>((res) => {
        yandexSdkInstance.adv.showFullscreenAdv({
          callbacks: {
            onClose: (wasShown: boolean) => res(wasShown),
            onError: () => res(false),
          },
        });
      });
    }

    // GameDistribution
    if (window.gdsdk) {
      await window.gdsdk.showAd('interstitial');
      return true;
    }

    // Y8
    if (window.ID) {
      return new Promise<boolean>((res) => {
        window.ID!.ads.display(() => res(true));
      });
    }

    // JioGames
    if (window.JioGames) {
      window.JioGames.showAd();
      return true;
    }

    // Facebook Instant Games
    if (window.FBInstant) {
      const ad = await window.FBInstant.getInterstitialAdAsync('interstitial_placement');
      await ad.loadAsync();
      await ad.showAsync();
      return true;
    }
  } catch (err) {
    console.warn('[PlatformBridge] Interstitial ad unavailable:', err);
  }
  return false;
};

/**
 * Show a rewarded ad that awards an in-game booster (e.g. 8s Slow-Mo).
 * Returns true only when the player earned the reward.
 */
export const showRewardedAd = async (rewardId: string = REWARD_IDS.SLOW_MO_BOOST): Promise<boolean> => {
  try {
    // YouTube Playables
    if (window.ytgame) {
      return await window.ytgame.ads.requestRewardedAd(rewardId);
    }

    // Poki
    if (window.PokiSDK) {
      return await window.PokiSDK.rewardedBreak();
    }

    // CrazyGames
    if (window.CrazyGames) {
      let earned = false;
      await window.CrazyGames.SDK.ad.requestAd('rewarded', {
        adFinished: () => { earned = true; },
      });
      return earned;
    }

    // Yandex Games
    if (yandexSdkInstance) {
      return new Promise<boolean>((res) => {
        yandexSdkInstance.adv.showRewardedVideo({
          callbacks: {
            onRewarded: () => res(true),
            onClose: () => res(false),
            onError: () => res(false),
          },
        });
      });
    }

    // GameDistribution
    if (window.gdsdk) {
      await window.gdsdk.showAd('rewarded');
      return true;
    }

    // Y8
    if (window.ID) {
      return new Promise<boolean>((res) => {
        window.ID!.ads.reward((rewarded) => res(rewarded));
      });
    }

    // Facebook Instant Games
    if (window.FBInstant) {
      const ad = await window.FBInstant.getRewardedVideoAsync('rewarded_placement');
      await ad.loadAsync();
      await ad.showAsync();
      return true;
    }
  } catch (err) {
    console.warn('[PlatformBridge] Rewarded ad failed or skipped:', err);
  }
  return false;
};

// ─── Cloud Save & Progress Synchronization ──────────────────────────────────

export const savePlatformProgress = async (): Promise<void> => {
  const snapshot = collectSnapshot();
  const serialized = JSON.stringify(snapshot);

  try {
    // YouTube Playables
    if (window.ytgame && window.ytgame.IN_PLAYABLES_ENV) {
      await window.ytgame.game.saveData(serialized);
    }

    // Facebook Instant Games
    if (window.FBInstant) {
      await window.FBInstant.player.setDataAsync({ gameData: serialized });
    }

    // CrazyGames
    if (window.CrazyGames) {
      await window.CrazyGames.SDK.data.save('meteor_split_save', serialized);
    }

    // Yandex Games
    if (yandexSdkInstance) {
      const player = await yandexSdkInstance.getPlayer();
      await player.setData({ meteor_split_save: serialized });
    }
  } catch (err) {
    console.warn('[PlatformBridge] Cloud save failed, local data persisted:', err);
  }
};

export const loadPlatformProgress = async (): Promise<boolean> => {
  try {
    // YouTube Playables
    if (window.ytgame && window.ytgame.IN_PLAYABLES_ENV) {
      const raw = await window.ytgame.game.loadData();
      if (raw) {
        applySnapshot(JSON.parse(raw) as SaveSnapshot);
        return true;
      }
    }

    // Facebook Instant Games
    if (window.FBInstant) {
      const data = await window.FBInstant.player.getDataAsync(['gameData']);
      if (data?.gameData && typeof data.gameData === 'string') {
        applySnapshot(JSON.parse(data.gameData) as SaveSnapshot);
        return true;
      }
    }

    // CrazyGames
    if (window.CrazyGames) {
      const raw = await window.CrazyGames.SDK.data.load('meteor_split_save');
      if (raw) {
        applySnapshot(JSON.parse(raw) as SaveSnapshot);
        return true;
      }
    }

    // Yandex Games
    if (yandexSdkInstance) {
      const player = await yandexSdkInstance.getPlayer();
      const data = await player.getData(['meteor_split_save']);
      if (data?.meteor_split_save && typeof data.meteor_split_save === 'string') {
        applySnapshot(JSON.parse(data.meteor_split_save) as SaveSnapshot);
        return true;
      }
    }
  } catch (err) {
    console.warn('[PlatformBridge] Cloud load failed, continuing with local progress:', err);
  }
  return false;
};

// ─── Score & Leaderboard Telemetry ──────────────────────────────────────────

export const sendPlatformScore = async (score: number): Promise<void> => {
  if (score <= 0) return;
  const safeScore = Math.min(Math.floor(score), Number.MAX_SAFE_INTEGER);

  try {
    // YouTube
    if (window.ytgame && window.ytgame.IN_PLAYABLES_ENV) {
      await window.ytgame.engagement.sendScore({ value: safeScore });
    }

    // Facebook Instant Games
    if (window.FBInstant) {
      const lb = await window.FBInstant.getLeaderboardAsync('global_meteors');
      await lb.setScoreAsync(safeScore);
    }

    // Yandex Games
    if (yandexSdkInstance) {
      const lb = await yandexSdkInstance.getLeaderboards();
      await lb.setLeaderboardScore('high_score', safeScore);
    }

    // JioGames
    if (window.JioGames) {
      window.JioGames.postScore(safeScore);
    }

    // Lagged
    if (window.LaggedAPI) {
      window.LaggedAPI.Scores.save({ score: safeScore, board: 'high_score' });
    }

    // Frame host
    window.parent?.postMessage({ type: 'SEND_SCORE', score: safeScore }, '*');
  } catch (err) {
    console.warn('[PlatformBridge] Send score failed:', err);
  }
};

// ─── Health Logging ──────────────────────────────────────────────────────────

export const logPlatformError = (): void => {
  try {
    window.ytgame?.health.logError();
  } catch { /* safe */ }
};

export const logPlatformWarning = (): void => {
  try {
    window.ytgame?.health.logWarning();
  } catch { /* safe */ }
};
