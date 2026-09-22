<div align="center">

# ☄️ Meteor Split Mania

**A fast-paced arcade game for YouTube Playables**

Tap to split meteors. Keep the chaos meter in check. How long can you survive?

[![Play on YouTube](https://img.shields.io/badge/Play%20on-YouTube%20Playables-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/@Rahul08319)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

</div>

---

## 🎮 Gameplay

```
  ☄️           ✦ split  ✦  ✦  ✦         combo x4 🔥
                          ↘ split  ↘ split
       ☄️  →  tap  →  ✦  ✦  →  ✦ ✦ ✦ ✦  →  🌟 score
                          ↗ split  ↗ split
```

| Action | Effect |
|--------|--------|
| **Tap a meteor** | Split it into smaller fragments |
| **Chain splits** | Build a combo multiplier |
| **Destroy all fragments** | Clear the screen, score bonus |
| **Miss a tap** | Chaos meter rises |
| **Chaos reaches 100%** | Game over — CHAOS OVERLOAD |

---

## ✨ Features

- 🌋 **Dynamic biomes** — space, magma, ice, void, neon, jungle themes as you level up
- 🐉 **Boss meteors** — shielded, multi-hit bosses with weak points
- ⚡ **Power-ups** — slow-motion, score multiplier, pulse wave, shield
- 📅 **Daily Challenge** — seeded modifiers that reset every midnight
- 🛰 **Weekly Gauntlet** — harder week-long seeds with special rules
- 🏆 **Achievements & Unlocks** — 20+ achievements, collectible meteor skins & visual themes
- ♿ **Accessibility** — colour-blind modes, reduced motion, adjustable UI scale
- 📱 **Cross-platform** — browser, Capacitor Android APK, and **YouTube Playables**

---

## 📺 YouTube Playables SDK Integration

This game is fully integrated with the **YouTube Playables SDK v1**.

### How the SDK is loaded

Per SDK requirements, the script is the **very first** tag in `index.html` — before any game code:

```html
<!-- MUST be first — loaded before any other script -->
<script src="https://www.youtube.com/game_api/v1"></script>
```

### Required integrations ✅

| API | Where used | File |
|-----|-----------|------|
| `ytgame.game.firstFrameReady()` | Called on first canvas paint | `MeteorSplitGame.tsx` |
| `ytgame.game.gameReady()` | Called after cloud save loads | `MeteorSplitGame.tsx` |
| `ytgame.IN_PLAYABLES_ENV` | Guards all SDK calls | `youtubePlayables.ts` |
| `ytgame.system.isAudioEnabled()` | Initialises audio state at boot | `youtubePlayables.ts` |
| `ytgame.system.onAudioEnabledChange()` | Mutes/unmutes audio in real time | `youtubePlayables.ts` |
| `ytgame.system.onPause()` | Pauses animation loop & audio | `youtubePlayables.ts` |
| `ytgame.system.onResume()` | Resumes animation loop & audio | `youtubePlayables.ts` |
| `ytgame.game.loadData()` | Loads cloud save snapshot on boot | `youtubePlayables.ts` |
| `ytgame.game.saveData()` | Saves progress on game-over & level-up | `youtubePlayables.ts` |

### Recommended integrations ✅

| API | Purpose |
|-----|---------|
| `ytgame.system.getLanguage()` | Sets `document.lang` for UI localisation |
| `ytgame.engagement.sendScore()` | Reports best score to YouTube UI card |
| `ytgame.ads.requestInterstitialAd()` | Shown at game-over (natural break) |
| `ytgame.ads.requestRewardedAd()` | Watch-ad-for-slow-mo-boost on game-over screen |
| `ytgame.health.logError()` | Emitted on SDK catch paths |
| `ytgame.health.logWarning()` | Emitted on non-critical failures |

### Architecture

```
index.html
  └── <script src="https://www.youtube.com/game_api/v1">   ← SDK first
  └── <script type="module" src="/src/main.tsx">            ← game second

src/game/
  ├── ytgame.d.ts              ← TypeScript types for the ytgame global
  ├── youtubePlayables.ts      ← SDK bridge (graceful no-op outside Playables)
  ├── MeteorSplitGame.tsx      ← Game engine — calls SDK via bridge
  └── platform.ts              ← Lifecycle shim (audio unlock, visibility pause)
```

All SDK calls degrade safely to no-ops when run outside YouTube — the same build works in a browser, an Android APK, and inside the YouTube Playables webview.

### Content Security Policy

When testing locally, override the `Content-Security-Policy` header ([how-to guide](https://developer.chrome.com/docs/devtools/overrides)) with:

```
default-src 'none'; script-src 'report-sample' 'self' 'unsafe-eval' 'unsafe-inline' blob: https://www.youtube.com/game_api/v0 https://www.youtube.com/game_api/v0/ https://www.youtube.com/game_api/v1 https://www.youtube.com/game_api/v1/; object-src 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com; connect-src 'self' blob: data:; sandbox allow-pointer-lock allow-same-origin allow-scripts; base-uri 'self'; manifest-src 'self'; worker-src 'self' blob:
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript 5.8 |
| Bundler | Vite 5 + SWC |
| Rendering | HTML5 Canvas (Web Audio API for all sound) |
| Styling | Tailwind CSS + shadcn/ui |
| Mobile | Capacitor (Android APK) |
| Database | Supabase (optional cloud leaderboard) |
| Game platform | **YouTube Playables SDK v1** |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm

### Install & run

```sh
# 1. Clone
git clone https://github.com/Rahul08319/meteor-split-mania.git
cd meteor-split-mania

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

### Build

```sh
npm run build        # Production build
npm run build:dev    # Development build
npm run preview      # Preview the production build
```

### Test

```sh
npm run test         # Run tests once
npm run test:watch   # Watch mode
```

---

## 📁 Project Structure

```
meteor-split-mania/
├── index.html                  ← Entry point — SDK script loaded first
├── src/
│   ├── game/
│   │   ├── MeteorSplitGame.tsx ← Main game component (canvas, UI, state)
│   │   ├── ytgame.d.ts         ← YouTube Playables SDK TypeScript types
│   │   ├── youtubePlayables.ts ← SDK bridge
│   │   ├── platform.ts         ← Cross-platform lifecycle shim
│   │   ├── sounds.ts           ← Web Audio procedural SFX & BGM
│   │   ├── skins.ts            ← Meteor skins & visual themes
│   │   ├── achievements.ts     ← Achievement system
│   │   ├── cloudSync.ts        ← Save snapshot (localStorage + ytgame)
│   │   ├── daily.ts            ← Daily challenge seeds & modifiers
│   │   ├── weekly.ts           ← Weekly gauntlet
│   │   ├── leaderboard.ts      ← Local leaderboard
│   │   └── types.ts            ← Shared game types
│   ├── components/             ← UI components (shadcn/ui based)
│   ├── pages/                  ← App routes
│   └── main.tsx                ← React entry point
├── public/                     ← Static assets
└── supabase/                   ← Database migrations
```

---

## 🎯 Ads Integration

Pre-roll ads are handled automatically by YouTube — no code needed.

**Interstitial ads** are shown at game-over (a natural gameplay break):

```ts
// Shown automatically after game-over in MeteorSplitGame.tsx
void showInterstitialAd(); // fire-and-forget, never blocks gameplay
```

**Rewarded ads** let players opt in for a Slow-Mo Boost on the next run:

```ts
const earned = await showRewardedAd(REWARD_IDS.SLOW_MO_BOOST);
if (earned) {
  localStorage.setItem('meteorSplit_pendingSlowMo', '1');
}
```

Reward IDs are stable, hard-coded strings with no user data:

```ts
export const REWARD_IDS = {
  EXTRA_LIFE:    'meteor-split-extra-life-001',
  SLOW_MO_BOOST: 'meteor-split-slowmo-boost-001',
  SHIELD_POWER:  'meteor-split-shield-power-001',
};
```

---

## 🧪 Testing with the YouTube Test Suite

1. Open the [YouTube Playables Test Suite](https://developers.google.com/youtube/gaming/playables/test_suite)
2. Set up the CSP header override in Chrome DevTools (see above)
3. Verify all required SDK integrations pass

---

## 🌐 Other Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| YouTube Playables | ✅ | Full SDK integration |
| Web browser | ✅ | SDK is a no-op; all features work |
| Android (Capacitor) | ✅ | APK build via `npx cap sync android` |
| Samsung Instant Games | ✅ | `SamsungInstantPlays` bridge in `platform.ts` |

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Made with ☄️ by [Rahul Kumar](https://github.com/Rahul08319)

</div>
