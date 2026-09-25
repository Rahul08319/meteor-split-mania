Original prompt: Make Meteor Split Mania more realistic and aesthetic; create SDK-free distribution versions for YouTube Playables, Facebook Instant Games, Poki, CrazyGames, Yandex Games, GameDistribution, Discord Activities, JioGames, Y8, Lagged, Microsoft Store PWA, Huawei/Xiaomi Quick Games, and MSN/Reddit Games; improve the README and update GitHub.

## Progress
- Added a GPU-rendered WebGL cosmic backdrop and an Apple-inspired glass interface in the previous update.
- Creating platform build targets that do not appear in the game UI and do not add Playgama or third-party portal SDKs.
- Built `youtube-playables` and SDK-free `crazygames` outputs successfully. The YouTube output includes the YouTube SDK before the app module; the CrazyGames output does not.

## TODO
- Run the remaining unit-test suite. The previous focused Playables test file is no longer present on the remote branch.
- Portal upload, account onboarding, native wrappers, and any optional first-party SDK features must be completed in each platform's developer portal.
