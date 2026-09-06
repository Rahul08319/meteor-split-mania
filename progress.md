Original prompt: Add all applicable YouTube Playables SDK requirements to https://github.com/Rahul08319/meteor-split-mania.git and suggest additional features, excluding monetization requirements.

## Progress
- Reviewed the supplied Playables SDK requirements. Ads and every monetization API are intentionally excluded.
- Implementing SDK loading, lifecycle readiness, host audio and pause/resume handling, cloud persistence, locale retrieval, score reporting, and health reporting.
- Added endless five-level biome rotation, phasing shielded bosses with orbiting debris and a visible weak point, Nova Pulse, replayable run missions, and a weekly seeded challenge/leaderboard.
- Added accessibility presets (Focus and Calm) plus a run recap with accuracy, fragments, and mission progress.
- Hardened the Playables lifecycle: cloud saves wait for `loadData`, pauses cancel animation/rendering, and Page Visibility is not used for Playables pause handling.
- Added SDK/missions unit coverage and a GitHub Actions workflow that runs `npm ci`, build, and tests on every push.
- Replaced the starter README with a project-specific guide and refreshed the title screen with an orbital arcade visual system, responsive glass panel, and updated sharing metadata.

## TODO
- Install locked dependencies and run the production build plus Playwright game loop. `npm run build` is currently blocked because `node_modules` is absent; the environment denied dependency downloads.
- Validate the production bundle with YouTube's Playables SDK Test Suite before submission.
- The actual YouTube Test Suite requires a release-specific link from the Playables Developer Portal after the channel has been onboarded and the bundle uploaded.
