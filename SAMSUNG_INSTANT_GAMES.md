# Meteor Split — Samsung Instant Games / Game Plug-in Integration Plan

Target surfaces: **Samsung Instant Plays (Instant Games)** inside Galaxy Store / Game
Launcher, and the **Capacitor Android APK**. One web build serves both; the platform
shim lives in `src/game/platform.ts`.

## 1. Build & packaging

| Item | Value |
| --- | --- |
| Entry | `dist/index.html` (Vite build, fully static) |
| Bundle target | Keep the initial payload small; Instant Plays favours fast first paint. No external asset downloads — all visuals are procedurally drawn on canvas. |
| Orientation | Portrait-first, canvas resizes to `window.innerWidth/Height` on `resize`. |
| Package | Instant Plays: zip of `dist/`. APK: `npx cap sync android` then build in Android Studio. |

Before packaging for the store, remove the live-reload `server.url` block from
`capacitor.config.json` so the APK ships the bundled `dist/` instead of the preview URL.

## 2. Audio (Web Audio API)

The Instant Plays webview starts with the audio context suspended and can suspend it
again when the host UI (ads, launcher overlay, incoming call) takes focus.

- `initPlatformLifecycle({ onUnlockAudio })` resumes the context on the first
  pointer/touch/key event — already wired to `resumeAudio()`.
- On `visibilitychange` hidden: stop background music and mute the SFX bus.
  On visible: restart music only if a run is in progress.
- Never autoplay music on the title screen before a gesture; the first tap starts it.
- Respect the SFX/music volume settings, which persist in localStorage and sync to the cloud save.

## 3. Haptics

- Instant Plays exposes `navigator.vibrate` inconsistently. `supportsHaptics()` gates
  the Settings toggle so players never see a switch that does nothing.
- In the Capacitor APK, `navigator.vibrate` works in the WebView; if a stronger native
  feel is wanted later, add `@capacitor/haptics` and route `src/game/haptics.ts` through it
  when `platform === 'capacitor'`.
- All vibration patterns are short (15–200 ms) to stay within host policy.

## 4. Daily challenge

- The seed is derived from the **device local date** (`daily.ts::getDailySeed`), so it works
  offline and needs no server clock.
- Instant Plays may clear site data between sessions. Daily attempts, best score and the
  daily leaderboard live in `localStorage` under `meteorSplit_daily`; `dailyDiagnostics()`
  reports whether storage is writable so the UI can degrade to a session-only daily.
- Cloud sync (optional sign-in) is the durable backup for the classic leaderboard,
  achievements and unlocks if the webview clears storage.

## 5. Lifecycle & performance checklist

- Pause `requestAnimationFrame` work implicitly via `document.hidden` (the loop keeps
  drawing but spawns/physics stop when the game is not started).
- Cap meteors at 60 and particles by lifetime — steady 60 fps on mid-range Galaxy A devices.
- Reduced-motion setting disables screen shake and lowers particle counts for
  accessibility and for low-end devices.
- No cookies, no third-party network calls at boot; the only network use is opt-in cloud sync.

## 6. QA matrix before submission

1. Cold start with sound: first tap must produce SFX and start music.
2. Background/foreground the app mid-run: music stops, then resumes without duplicate loops.
3. Haptics toggle hidden on devices without vibration support.
4. Daily challenge: same modifier name across two launches on the same day; new one after midnight.
5. Storage cleared: game still boots, leaderboard empty, cloud restore recovers progress.
6. Portrait and landscape resize with no canvas stretching.
7. Reduced motion, color-blind modes and larger UI text all readable at 1.5x scale.
