export type MeteorSkinId = 'default' | 'ice' | 'magma' | 'neon' | 'crystal' | 'shadow' | 'golden';
export type ThemeId = 'default' | 'deep_ocean' | 'blood_nebula' | 'aurora' | 'void';

export interface MeteorSkin {
  id: MeteorSkinId;
  name: string;
  icon: string;
  description: string;
  unlockCondition: string;
  check: (stats: UnlockStats) => boolean;
  // Hue overrides per generation [gen0, gen1, gen2, gen3]
  hues: [number, number, number, number];
  glowIntensity: number;
  trailWidth: number;
  particleHue: number;
}

export interface VisualTheme {
  id: ThemeId;
  name: string;
  icon: string;
  description: string;
  unlockCondition: string;
  check: (stats: UnlockStats) => boolean;
  bgGradient: [string, string, string]; // top, mid, bottom HSL
  starBrightness: number;
  chaosOverlayHue: number;
}

export interface UnlockStats {
  bestScore: number;
  bestLevel: number;
  totalMeteors: number;
  bestCombo: number;
  gamesPlayed: number;
  bossesDefeated: number;
}

export const METEOR_SKINS: MeteorSkin[] = [
  {
    id: 'default', name: 'Classic', icon: '☄️',
    description: 'The original meteor look.',
    unlockCondition: 'Available from start',
    check: () => true,
    hues: [25, 35, 200, 0],
    glowIntensity: 0.3, trailWidth: 0.5, particleHue: 30,
  },
  {
    id: 'ice', name: 'Frozen', icon: '🧊',
    description: 'Icy blue meteors with frost trails.',
    unlockCondition: 'Reach Level 5',
    check: (s) => s.bestLevel >= 5,
    hues: [200, 210, 220, 190],
    glowIntensity: 0.4, trailWidth: 0.6, particleHue: 200,
  },
  {
    id: 'magma', name: 'Magma', icon: '🌋',
    description: 'Molten rock with ember trails.',
    unlockCondition: 'Score 5,000 points',
    check: (s) => s.bestScore >= 5000,
    hues: [10, 20, 30, 0],
    glowIntensity: 0.5, trailWidth: 0.7, particleHue: 15,
  },
  {
    id: 'neon', name: 'Neon', icon: '💜',
    description: 'Glowing neon with electric sparks.',
    unlockCondition: 'Get a 10x combo',
    check: (s) => s.bestCombo >= 10,
    hues: [280, 300, 320, 260],
    glowIntensity: 0.6, trailWidth: 0.5, particleHue: 290,
  },
  {
    id: 'crystal', name: 'Crystal', icon: '💎',
    description: 'Prismatic crystals that shimmer.',
    unlockCondition: 'Destroy 500 total meteors',
    check: (s) => s.totalMeteors >= 500,
    hues: [160, 180, 200, 140],
    glowIntensity: 0.45, trailWidth: 0.4, particleHue: 170,
  },
  {
    id: 'shadow', name: 'Shadow', icon: '🌑',
    description: 'Dark matter with void trails.',
    unlockCondition: 'Reach Level 10',
    check: (s) => s.bestLevel >= 10,
    hues: [260, 270, 280, 250],
    glowIntensity: 0.2, trailWidth: 0.8, particleHue: 265,
  },
  {
    id: 'golden', name: 'Golden', icon: '⭐',
    description: 'Legendary golden meteors.',
    unlockCondition: 'Score 25,000 points',
    check: (s) => s.bestScore >= 25000,
    hues: [45, 50, 55, 40],
    glowIntensity: 0.55, trailWidth: 0.6, particleHue: 48,
  },
];

export const VISUAL_THEMES: VisualTheme[] = [
  {
    id: 'default', name: 'Deep Space', icon: '🌌',
    description: 'Classic dark cosmos.',
    unlockCondition: 'Available from start',
    check: () => true,
    bgGradient: ['240, 30%, 3%', '260, 25%, 5%', '240, 20%, 4%'],
    starBrightness: 1, chaosOverlayHue: 0,
  },
  {
    id: 'deep_ocean', name: 'Deep Ocean', icon: '🌊',
    description: 'Abyssal ocean depths.',
    unlockCondition: 'Play 10 games',
    check: (s) => s.gamesPlayed >= 10,
    bgGradient: ['210, 40%, 3%', '200, 35%, 6%', '220, 30%, 4%'],
    starBrightness: 0.6, chaosOverlayHue: 30,
  },
  {
    id: 'blood_nebula', name: 'Blood Nebula', icon: '🔴',
    description: 'A crimson cosmic cloud.',
    unlockCondition: 'Defeat 5 bosses total',
    check: (s) => s.bossesDefeated >= 5,
    bgGradient: ['350, 30%, 4%', '0, 25%, 6%', '340, 20%, 3%'],
    starBrightness: 0.8, chaosOverlayHue: 350,
  },
  {
    id: 'aurora', name: 'Aurora', icon: '🟢',
    description: 'Northern lights shimmer.',
    unlockCondition: 'Reach Level 15',
    check: (s) => s.bestLevel >= 15,
    bgGradient: ['160, 25%, 3%', '180, 20%, 5%', '200, 25%, 4%'],
    starBrightness: 1.2, chaosOverlayHue: 120,
  },
  {
    id: 'void', name: 'The Void', icon: '⚫',
    description: 'Pure darkness. Minimal stars.',
    unlockCondition: 'Score 50,000 points',
    check: (s) => s.bestScore >= 50000,
    bgGradient: ['0, 0%, 1%', '0, 0%, 2%', '0, 0%, 1%'],
    starBrightness: 0.3, chaosOverlayHue: 270,
  },
];

// Persistence
const SKIN_KEY = 'meteorSplit_skin';
const THEME_KEY = 'meteorSplit_theme';
const BOSS_DEFEATS_KEY = 'meteorSplit_bossDefeats';

export const getSelectedSkin = (): MeteorSkinId => {
  return (localStorage.getItem(SKIN_KEY) as MeteorSkinId) || 'default';
};

export const setSelectedSkin = (id: MeteorSkinId) => {
  localStorage.setItem(SKIN_KEY, id);
};

export const getSelectedTheme = (): ThemeId => {
  return (localStorage.getItem(THEME_KEY) as ThemeId) || 'default';
};

export const setSelectedTheme = (id: ThemeId) => {
  localStorage.setItem(THEME_KEY, id);
};

export const getTotalBossDefeats = (): number => {
  return parseInt(localStorage.getItem(BOSS_DEFEATS_KEY) || '0');
};

export const addBossDefeat = (count: number) => {
  const total = getTotalBossDefeats() + count;
  localStorage.setItem(BOSS_DEFEATS_KEY, String(total));
};

export const getUnlockStats = (leaderboardStats: {
  gamesPlayed: number; bestScore: number; bestLevel: number;
  totalMeteors: number; bestCombo: number;
} | null): UnlockStats => {
  return {
    bestScore: leaderboardStats?.bestScore ?? 0,
    bestLevel: leaderboardStats?.bestLevel ?? 0,
    totalMeteors: leaderboardStats?.totalMeteors ?? 0,
    bestCombo: leaderboardStats?.bestCombo ?? 0,
    gamesPlayed: leaderboardStats?.gamesPlayed ?? 0,
    bossesDefeated: getTotalBossDefeats(),
  };
};
