<div align="center">

<p align="center">
  <kbd>ARCADE REIMAGINED</kbd> &nbsp;•&nbsp; <kbd>YOUTUBE PLAYABLES READY</kbd> &nbsp;•&nbsp; <kbd>APPLE HIG CRAFTED</kbd>
</p>

# ☄️ Meteor Split Mania

### A tactile cosmic arcade experience with Apple-grade Liquid Glass craft

**Split meteors. Control the chaos. Survive the orbital storm.**

![Meteor Split Mania key art](./public/art/meteor-observatory-backdrop.png)

> A cinematic, one-touch arcade survival game built for quick play sessions and real replayability.

[Experience](#-gameplay) · [Apple Design](#-apple-design-system) · [Playables SDK](#-youtube-playables-sdk-v1) · [Architecture](#-architecture) · [Quick Start](#-quick-start)

<br/>

[![Playables Certified](https://img.shields.io/badge/YouTube_Playables-SDK_v1_Compliant-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://developers.google.com/youtube/gaming/playables)
[![Apple HIG](https://img.shields.io/badge/Design-Apple_HIG_&_Liquid_Glass-0071E3?style=for-the-badge&logo=apple&logoColor=white)](https://developer.apple.com/design/human-interface-guidelines)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

</div>

---

##  Apple Design System

Crafted around Cupertino's foundational design pillars: **Clarity**, **Deference**, and **Depth**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BENTO GRID SHOWCASE                             │
├───────────────────────────────────┬────────────────────────────────────┤
│ 💎 LIQUID GLASS MATERIALS         │ ⚡ SPRING MOTION & CHOREOGRAPHY    │
│ Multi-layer backdrop-blur (36px), │ Mass-stiffness-damping spring      │
│ specular top-edge lensing (1px),  │ physics (cubic-bezier 0.16,1,0.3,1)│
│ G2 continuous squircle geometry,  │ Tactile button scale on active tap │
│ and high-contrast typography.     │ Ambient orbital planetary rings.   │
├───────────────────────────────────┼────────────────────────────────────┤
│ 🪐 DUAL-RENDERER PIPELINE         │ ♿ INCLUSIVE & ACCESSIBLE          │
│ Hardware-accelerated WebGL cosmos │ Semantic Dynamic Type, color-blind │
│ backdrop + 60fps HTML5 Canvas     │ filters (deuteranopia/protanopia), │
│ sub-pixel meteor particle engine. │ prefers-reduced-motion fallback.   │
└───────────────────────────────────┴────────────────────────────────────┘
```

---

## 🎮 Gameplay

```
  ☄️ ────► [ TAP ] ──┬──► ✦ split fragment ✦ ──► [ CHAIN ] ──► combo multiplier 🔥
                     │
                     └──► ✦ split fragment ✦ ──► [ DESTROY ] ──► high score 🌟
```

| Action | Physical Feedback | Mechanic |
|---|---|---|
| **Tap Meteor** | Micro-haptic + directional spark burst | Splits meteor into sub-fragments |
| **Combo Splitting** | Accelerating pitch Web Audio SFX | Multiplies score up to 10× |
| **Nova Pulse** | Radial shockwave + screen clearing blast | Emergency cooldown button on HUD |
| **Over-tapping / Miss** | Red chromatic pulse | Chaos Meter rises toward 100% |
| **Chaos Overload** | Atmospheric collapse sequence | Game over + Apple Bento stats review |

### Modes
- **Classic**: Infinite escalating cosmic biomes with shielded boss encounters.
- **Daily Challenge**: Deterministic global daily seed with unique modifiers.
- **Weekly Gauntlet**: Week-long competitive gauntlet with local rank tracking.

---

## 📺 YouTube Playables SDK v1

*Meteor Split Mania* meets all mandatory and recommended requirements for **YouTube Playables Certification**.

### SDK Initialization Guarantee
Per YouTube Playables specifications, the SDK script is loaded synchronously as the **very first script** in `<head>`:

```html
<!-- index.html — MUST be loaded before any game code -->
<script src="https://www.youtube.com/game_api/v1"></script>
```

### Integration Matrix

| Sub-system | API Signature | Certification Level | Implementation Details |
|---|---|:---:|---|
| **First Frame** | `ytgame.game.firstFrameReady()` | **MANDATORY** | Guaranteed on canvas paint; strictly precedes `gameReady()` |
| **Game Ready** | `ytgame.game.gameReady()` | **MANDATORY** | Emitted once assets, audio buses, and cloud saves are mounted |
| **Environment Guard** | `ytgame.IN_PLAYABLES_ENV` | **MANDATORY** | Graceful fallback to `localStorage` when testing in browser |
| **Audio Init** | `ytgame.system.isAudioEnabled()` | **MANDATORY** | Synchronous query on boot to match YouTube player mute state |
| **Audio Change** | `ytgame.system.onAudioEnabledChange()` | **MANDATORY** | Dynamic listener muting/unmuting procedural sound synthesizer |
| **Host Pause** | `ytgame.system.onPause()` | **MANDATORY** | Freezes simulation, mutes audio, and flushes cloud state |
| **Host Resume** | `ytgame.system.onResume()` | **MANDATORY** | Smooth animation unpause with time-delta compensation |
| **Cloud Save** | `ytgame.game.saveData(str)` | **MANDATORY** | Serializes high scores, unlocks, skins, and preferences |
| **Cloud Load** | `ytgame.game.loadData()` | **MANDATORY** | Restores state on cold boot before calling `gameReady()` |
| **Language** | `ytgame.system.getLanguage()` | **RECOMMENDED** | Localizes document root `lang` to player's YouTube locale |
| **Score Sync** | `ytgame.engagement.sendScore()` | **RECOMMENDED** | Reports best scores to the native YouTube Playables card |
| **Interstitial Ads**| `ytgame.ads.requestInterstitialAd()` | **RECOMMENDED** | Displayed during natural pause at the Game Over screen |
| **Rewarded Ads** | `ytgame.ads.requestRewardedAd()` | **RECOMMENDED** | Grants an 8-second Slow-Mo Boost on the subsequent run |
| **Health Telemetry**| `ytgame.health.logError/logWarning()`| **RECOMMENDED** | Automated diagnostics reporting on catch blocks |

---

## 🏗 Architecture

```
index.html (Playables SDK v1 loaded first)
  │
  └── src/main.tsx
        └── src/App.tsx
              └── src/game/MeteorSplitGame.tsx
                    ├── src/game/webglBackdrop.ts     (GPU Shaders & Nebula Ribbons)
                    ├── src/game/youtubePlayables.ts  (Playables SDK Bridge & Ads Engine)
                    ├── src/game/ytgame.d.ts          (Ambient TypeScript Types)
                    ├── src/game/sounds.ts            (Web Audio Procedural SFX)
                    ├── src/game/cloudSync.ts         (Save Snapshot Serialization)
                    ├── src/game/skins.ts             (Unlockable Visual Cosmetics)
                    └── src/game/achievements.ts      (Progress Milestones)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or bun

### Local Development
```bash
# Clone the repository
git clone https://github.com/Rahul08319/meteor-split-mania.git
cd meteor-split-mania

# Install dependencies
npm install

# Start Vite local development server
npm run dev
```

### Production Build for YouTube Playables
```bash
# Type check and build with relative asset paths ('./')
npm run build
```
The output in `dist/` contains:
- `dist/index.html` (Playables SDK script at head + relative asset bundles)
- `dist/assets/*.js` and `dist/assets/*.css`
- Fully ready to be zipped and submitted to the **YouTube Playables Portal**.

---

## 🧪 Certification Test Suite

To test the game with YouTube's official suite:
1. Open the [YouTube Playables Test Suite](https://developers.google.com/youtube/gaming/playables/reference/test_suite_guide).
2. Override the `Content-Security-Policy` header in Chrome DevTools:
   ```http
   default-src 'none'; script-src 'report-sample' 'self' 'unsafe-eval' 'unsafe-inline' blob: https://www.youtube.com/game_api/v0 https://www.youtube.com/game_api/v1; object-src 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com; connect-src 'self' blob: data:; sandbox allow-pointer-lock allow-same-origin allow-scripts; base-uri 'self';
   ```
3. Load the game bundle; verify all 14 test suite checks report green.

---

<div align="center">

Crafted with  design precision by [Rahul Kumar](https://github.com/Rahul08319)

</div>
