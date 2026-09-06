# Meteor Split Mania

> **Tap. Split. Survive the chaos.**

A fast, one-touch arcade game built for the web and prepared for YouTube Playables. Crack incoming meteors into fragments, maintain a clean combo, and keep the Chaos Meter from overloading.

## Highlights

- Infinite, biome-changing progression with escalating events
- Shielded boss meteors with orbiting debris and weak points
- Nova Pulse: a one-tap emergency blast with a cooldown
- Daily and seeded weekly challenges, local scoreboards, and replayable missions
- Unlockable meteor skins and visual themes
- Post-run recap with accuracy, best combo, and boss statistics
- Accessibility settings for larger UI, high contrast, and reduced flashing
- YouTube Playables lifecycle, pause/resume, audio, score, and cloud-save support

## Controls

| Action | Control |
| --- | --- |
| Split a meteor | Tap or click it |
| Nova Pulse | Use the glowing NOVA PULSE button |
| Fullscreen on the web | Press `F` |
| Exit fullscreen | Press `Esc` |

The game is intentionally playable with one finger. Accuracy matters: repeated taps on the same target raise the Chaos Meter.

## Run locally

Requires Node.js 20+ and npm.

```sh
git clone https://github.com/Rahul08319/meteor-split-mania.git
cd meteor-split-mania
npm ci
npm run dev
```

Useful commands:

```sh
npm run build      # production bundle
npm run test       # unit tests
npm run lint       # lint source files
```

## Project structure

```text
src/
├── game/                 # game loop, mechanics, challenges, audio, Playables adapter
├── components/           # reusable interface components
├── pages/                # application entry screens
└── index.css             # visual system and responsive shell
```

## YouTube Playables

The SDK loads before the game entry point. The game reports first-frame and ready states, listens for platform-controlled pause/resume, respects the platform audio setting, sends the player score, and loads cloud data before saving it.

For release validation, build the project, host the generated `dist/` files with the required Playables CSP, then run the Test Suite link provided for the release in the YouTube Playables Developer Portal. The suite requires an onboarded Playables channel and cannot be completed from a local browser alone. See the official [integration requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_integration), [Test Suite guide](https://developers.google.com/youtube/gaming/playables/reference/test_suite_guide), and [design requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements_design).

## Quality checks

GitHub Actions runs install, production build, and unit tests for pushes and pull requests. Local progress and validation notes are kept in [progress.md](progress.md).

## No monetization SDKs

This project deliberately contains no ad, in-app-purchase, or monetization integration.

## License

No license has been selected yet. Add one before distributing the project publicly.
