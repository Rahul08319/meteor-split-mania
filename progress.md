Original prompt: Make Meteor Split Mania more realistic and aesthetic; create SDK-free distribution versions for YouTube Playables, Facebook Instant Games, Poki, CrazyGames, Yandex Games, GameDistribution, Discord Activities, JioGames, Y8, Lagged, Microsoft Store PWA, Huawei/Xiaomi Quick Games, and MSN/Reddit Games; improve the README and update GitHub.

## Progress
- Added a GPU-rendered WebGL cosmic backdrop and an Apple-inspired glass interface in the previous update.
- Creating platform build targets that do not appear in the game UI and do not add Playgama or third-party portal SDKs.
- Built `youtube-playables` and SDK-free `crazygames` outputs successfully. The YouTube output includes the YouTube SDK before the app module; the CrazyGames output does not.

## TODO
- Run the remaining unit-test suite. The previous focused Playables test file is no longer present on the remote branch.
- Portal upload, account onboarding, native wrappers, and any optional first-party SDK features must be completed in each platform's developer portal.

## 2026-09-25 — Observatory title-screen direction
- Added `public/art/meteor-observatory-backdrop.png`, an original cinematic backdrop used only on the title screen.
- Rebuilt the title/menu composition around the selected observatory direction: refined wordmark, real Start button, accessible focus states, and icon-based game navigation.
- Kept existing modes and menus intact, and updated the README header with the game key art.
- Next: run build/tests and visually verify title → tutorial/gameplay plus title navigation.

### Verification
- `npm run build` completed successfully after the title-screen changes.
- Browser verification completed in the Codex in-app browser: title → tutorial → gameplay and Settings → Back both worked.
- The local Vitest command is inconclusive: it begins but does not return a completion summary in this environment; its sandboxed attempt could not read the local config. See the next pass if test-runner diagnosis is needed.

## 2026-09-25 — Gameplay feedback
- Added canvas-drawn kinetic impact shockwaves for successful meteor splits, boss weak-point hits, boss defeats, and Nova Pulse.
- Shockwaves respect reduced-motion settings, are capped for stable performance, and are exposed through `render_game_to_text` for UI test automation.
- Verified with `npm run build`, `git diff --check`, and the focused Vitest file (`src/test/example.test.ts`, 1 passing test).
- Added combo Resonance rewards every fifth consecutive meteor destroyed: bonus score, a small chaos reduction, and a 1.5-second Nova Pulse cooldown reduction, with animated in-game feedback.
- Re-verified the production build, focused game-file ESLint, and the existing Vitest file (1 passing test).
