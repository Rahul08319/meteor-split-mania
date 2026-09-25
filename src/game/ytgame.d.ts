/**
 * TypeScript type definitions for the YouTube Playables SDK.
 * SDK is loaded via <script src="https://www.youtube.com/game_api/v1"></script>
 * and exposed as the globally-scoped `ytgame` object.
 *
 * @see https://developers.google.com/youtube/gaming/playables/reference/sdk
 */

declare namespace ytgame {
  /** Whether the game is running inside the YouTube Playables environment. */
  const IN_PLAYABLES_ENV: boolean;

  /** The YouTube Playables SDK version string. */
  const SDK_VERSION: string;

  /** Error types that the YouTube Playables SDK throws. */
  const enum SdkErrorType {
    API_UNAVAILABLE = 'API_UNAVAILABLE',
    INVALID_PARAMS = 'INVALID_PARAMS',
    SIZE_LIMIT_EXCEEDED = 'SIZE_LIMIT_EXCEEDED',
    UNKNOWN = 'UNKNOWN',
  }

  /** The error object the YouTube Playables SDK throws. */
  class SdkError extends Error {
    readonly errorType: SdkErrorType;
    readonly message: string;
    readonly name: string;
    readonly stack?: string;
  }

  namespace game {
    /**
     * Notifies YouTube that the game has begun showing frames.
     * MUST be called. MUST be called before gameReady().
     */
    function firstFrameReady(): void;

    /**
     * Notifies YouTube that the game is ready for players to interact with.
     * MUST be called when the game is fully interactable (no loading screens).
     */
    function gameReady(): void;

    /**
     * Saves game data to YouTube as a serialized UTF-16 string (max 3 MiB).
     * Use String.isWellFormed() to verify the string before saving.
     */
    function saveData(data: string): Promise<void>;

    /**
     * Loads game data from YouTube as a serialized string.
     */
    function loadData(): Promise<string>;
  }

  namespace system {
    /**
     * Returns whether game audio is enabled in YouTube settings (synchronous).
     * Use this to initialize game audio state.
     */
    function isAudioEnabled(): boolean;

    /**
     * Sets a callback triggered when audio settings change.
     * MUST use this to keep audio state in sync.
     * @returns a cleanup function to unset the callback.
     */
    function onAudioEnabledChange(callback: (isAudioEnabled: boolean) => void): () => void;

    /**
     * Sets a callback triggered when a pause event is fired from YouTube.
     * Called for all pause types including user exit. Resume is not guaranteed.
     * @returns a cleanup function to unset the callback.
     */
    function onPause(callback: () => void): () => void;

    /**
     * Sets a callback triggered when a resume event is fired from YouTube.
     * @returns a cleanup function to unset the callback.
     */
    function onResume(callback: () => void): () => void;

    /**
     * Returns the user's YouTube language as a BCP-47 tag (e.g. "en-US").
     * Always use this — do NOT store language in cloud save or use other methods.
     */
    function getLanguage(): Promise<string>;
  }

  namespace engagement {
    /** The possible types of YouTube content. */
    const enum ContentType {
      VIDEO = 'VIDEO',
      PLAYABLE = 'PLAYABLE',
    }

    interface Content {
      /** The YouTube content ID. */
      id: string;
      /**
       * The type of content. Defaults to VIDEO if not provided.
       */
      contentType?: ContentType;
    }

    interface Score {
      /** Integer score value. Must be ≤ Number.MAX_SAFE_INTEGER. */
      value: number;
    }

    /**
     * Sends the player's score to YouTube.
     * Scores are sorted; the highest is displayed in YouTube UI.
     */
    function sendScore(score: Score): Promise<void>;

    /**
     * Requests YouTube to open content (video or Playable).
     * On mobile, videos open in mini-player; Playables replace the current one.
     */
    function openYTContent(content: Content): Promise<void>;
  }

  namespace ads {
    /**
     * Requests an interstitial ad to be shown.
     * Makes no guarantee whether the ad was actually shown.
     * Do NOT use to reward players.
     */
    function requestInterstitialAd(): Promise<void>;

    /**
     * Requests a rewarded ad for a specific reward type.
     * @param rewardId A unique, stable ID per reward type. Must not contain user data.
     * @returns true if user met reward conditions, false otherwise.
     */
    function requestRewardedAd(rewardId: string): Promise<boolean>;
  }

  namespace health {
    /**
     * Logs an error to YouTube (best-effort, rate-limited).
     */
    function logError(): void;

    /**
     * Logs a warning to YouTube (best-effort, rate-limited).
     */
    function logWarning(): void;
  }
}

interface Window {
  ytgame?: typeof ytgame;
}
