<div align="center">

# ☄️ Meteor Split Mania

### A tactile cosmic arcade game for YouTube Playables

**Tap. Split. Survive the chaos.**

[Gameplay](#gameplay) · [Visual system](#visual-system) · [Run locally](#run-locally) · [Playables](#youtube-playables)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

</div>

Meteor Split Mania is a one-touch cosmic survival game. Break incoming meteors into fragments, maintain a clean combo, and prevent the Chaos Meter from overloading.

> [!TIP]
> Built for quick sessions in portrait or landscape. Every core action works with one finger.

## Gameplay

| Action | Effect |
| --- | --- |
| **Tap a meteor** | Split it into smaller fragments |
| **Chain splits** | Build a combo multiplier |
| **Use Nova Pulse** | Clear danger with a cooldown-based emergency blast |
| **Miss a tap** | Raise the Chaos Meter |
| **Chaos reaches 100%** | Trigger CHAOS OVERLOAD |

### Play modes

| Mode | What makes it different |
| --- | --- |
| **Classic** | Endless biome progression, escalating meteor density, and boss encounters |
| **Daily** | A deterministic modifier that refreshes each day |
| **Weekly** | A fixed-seed gauntlet for comparable runs and local rankings |

## Visual system

The playfield layers a native WebGL cosmic backdrop behind a precise Canvas gameplay renderer. Procedural star fields, nebula ribbons, biome-tinted light, and chaos-reactive colour create depth without a heavyweight 3D engine or downloaded art packs.

| Layer | Purpose |
| --- | --- |
| **WebGL cosmos** | Atmosphere, biome identity, and lightweight GPU motion |
| **Canvas gameplay** | Meteors, boss effects, fragments, power-ups, and accurate touch targets |
| **Glass UI** | Clear hierarchy, restrained copy, and accessible high-contrast options |

## Features

- Infinite biome-changing progression with escalating special events
- Shielded boss meteors with orbiting debris and weak points
- Nova Pulse, missions, unlockable skins, and visual themes
- Daily and weekly challenges with local scoreboards
- Post-run recap with accuracy, fragments, best combo, and boss statistics
- Accessibility settings for colour-blind modes, larger UI, high contrast, and reduced flashing
- No ads, in-app purchases, or monetization SDKs

## Run locally

Requires Node.js 20+ and npm.

```sh
git clone https://github.com/Rahul08319/meteor-split-mania.git
cd meteor-split-mania
npm ci
npm run dev
```

```sh
npm run build      # production bundle
npm run test       # unit tests
npm run lint       # lint source files
```

## Architecture

```text
src/
├── game/
│   ├── MeteorSplitGame.tsx  # game loop, interactions, HUD
│   ├── webglBackdrop.ts     # procedural GPU-rendered cosmic scene
│   └── youtubePlayables.ts  # safe YouTube SDK bridge
├── components/              # reusable interface components
└── pages/                   # application routes
```

## YouTube Playables

The SDK loads before the application entry point. The game reports first-frame and ready states, loads cloud data before saving, respects platform audio, handles host pause/resume, reports score, and degrades safely outside YouTube.

For release validation, build the project, host `dist/` with the required Playables CSP, then run the release-specific Test Suite link provided in the YouTube Playables Developer Portal. See the official [integration requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_integration), [Test Suite guide](https://developers.google.com/youtube/gaming/playables/reference/test_suite_guide), and [design requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_design).

## Design principles

1. **Instantly legible.** Targets, chaos, and the special ability outrank decoration.
2. **Motion with purpose.** Reduced-flashing settings and deterministic timing keep play comfortable and testable.
3. **Atmosphere without weight.** GPU depth supports the game instead of obscuring it.

## License

MIT — see [LICENSE](LICENSE).

<div align="center">

Made with ☄️ by [Rahul Kumar](https://github.com/Rahul08319)

</div>
