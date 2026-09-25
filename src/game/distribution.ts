export type DistributionTarget =
  | 'web' | 'youtube-playables' | 'facebook-instant-games' | 'poki' | 'crazygames'
  | 'yandex-games' | 'gamedistribution' | 'discord-activities' | 'jiogames' | 'y8'
  | 'lagged' | 'microsoft-store-pwa' | 'huawei-quick-game' | 'xiaomi-quick-game'
  | 'msn-games' | 'reddit-games';

export const DISTRIBUTION_TARGETS: Record<DistributionTarget, { label: string; packaging: 'html5' | 'pwa' | 'native-wrapper' }> = {
  web: { label: 'Web', packaging: 'html5' },
  'youtube-playables': { label: 'YouTube Playables', packaging: 'html5' },
  'facebook-instant-games': { label: 'Facebook Instant Games', packaging: 'html5' },
  poki: { label: 'Poki', packaging: 'html5' }, crazygames: { label: 'CrazyGames', packaging: 'html5' },
  'yandex-games': { label: 'Yandex Games', packaging: 'html5' }, gamedistribution: { label: 'GameDistribution', packaging: 'html5' },
  'discord-activities': { label: 'Discord Activities', packaging: 'html5' }, jiogames: { label: 'JioGames', packaging: 'html5' },
  y8: { label: 'Y8', packaging: 'html5' }, lagged: { label: 'Lagged', packaging: 'html5' },
  'microsoft-store-pwa': { label: 'Microsoft Store PWA', packaging: 'pwa' },
  'huawei-quick-game': { label: 'Huawei Quick Game', packaging: 'native-wrapper' },
  'xiaomi-quick-game': { label: 'Xiaomi Quick Game', packaging: 'native-wrapper' },
  'msn-games': { label: 'MSN Games', packaging: 'html5' }, 'reddit-games': { label: 'Reddit Games', packaging: 'html5' },
};

const isTarget = (value: string): value is DistributionTarget => value in DISTRIBUTION_TARGETS;
const configuredTarget = import.meta.env.VITE_DISTRIBUTION_TARGET || new URLSearchParams(window.location.search).get('platform') || 'web';
export const distributionTarget: DistributionTarget = isTarget(configuredTarget) ? configuredTarget : 'web';
export const shouldRegisterServiceWorker = distributionTarget === 'web' || distributionTarget === 'microsoft-store-pwa';
