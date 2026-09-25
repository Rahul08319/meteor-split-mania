import { useRef, useEffect, useCallback, useState } from 'react';
import { Meteor, Particle, Shockwave, Star, GameState, PowerUp, PowerUpType } from './types';
import { playSplit, playDestroy, playChaos, playCombo, playChaosOverload, playPowerUp, playBossHit, playBossDefeat, playShowerWarning, resumeAudio, startBGM, updateBGMChaos, stopBGM, setSfxVolume, setMusicVolume, setHostAudioEnabled, suspendAudio } from './sounds';
import { addLeaderboardEntry, getLeaderboard, getStats } from './leaderboard';
import { Difficulty, DIFFICULTY_CONFIGS, DifficultyConfig } from './difficulty';
import { getDailySeed, getDailyModifiers, getDailyLeaderboard, addDailyEntry, getDailyAttempts, getDailyBestScore, SeededRNG, DailyModifiers } from './daily';
import { METEOR_SKINS, VISUAL_THEMES, MeteorSkin, VisualTheme, getSelectedSkin, setSelectedSkin, getSelectedTheme, setSelectedTheme, getUnlockStats, addBossDefeat, MeteorSkinId, ThemeId, UnlockStats } from './skins';
import { getSettings, setSettings, ColorBlindMode } from './settings';
import { hapticSplit, hapticDestroy, hapticPowerUp, hapticChaos, hapticBoss } from './haptics';
import { ACHIEVEMENTS, checkAchievements, getAllUnlocked, Achievement } from './achievements';
import { mapHue, isReducedMotion, applyUiScale } from './a11y';
import { supportsHaptics, initPlatformLifecycle } from './platform';
import { shareScoreImage, shareScoreText, ShareData } from './share';
import SkinPreview from '@/components/SkinPreview';
import CloudSyncPanel from '@/components/CloudSyncPanel';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { CalendarDays, CircleHelp, Palette, Settings2, Trophy } from 'lucide-react';
import { initializeYouTubePlayables, loadYouTubeProgress, notifyFirstFrameReady, notifyGameReady, saveYouTubeProgress, sendYouTubeScore, logYTError } from './youtubePlayables';
import { createRunMissions, RunMission, updateRunMissions } from './missions';
import { addWeeklyEntry, getWeeklyAttempts, getWeeklyBestScore, getWeeklyLeaderboard, getWeeklyModifiers, getWeekKey } from './weekly';
import { createWebGLBackdrop, WebGLBackdrop } from './webglBackdrop';

const MAX_METEORS = 60;
const CHAOS_THRESHOLD = 0.7;
const COMBO_TIMEOUT = 2000;
const POWERUP_DURATION = 5000;
const EVENT_INTERVAL_LEVELS = 3;
const SHOWER_DURATION = 6000;
const PULSE_COOLDOWN = 12000;
const TUTORIAL_KEY = 'meteorSplit_tutorialSeen';

const BIOMES = [
  { name: 'NEBULA FRINGE', hue: 275 }, { name: 'SOLAR FRONT', hue: 32 },
  { name: 'CRYSTAL DRIFT', hue: 190 }, { name: 'VOID CITADEL', hue: 315 },
  { name: 'AURORA REACH', hue: 145 },
];
const getBiome = (level: number) => BIOMES[Math.floor((level - 1) / 5) % BIOMES.length];

let idCounter = 0;
const genId = () => `m${++idCounter}`;

const createVertices = (n: number): number[] => {
  const verts: number[] = [];
  for (let i = 0; i < n; i++) {
    verts.push(0.7 + Math.random() * 0.6);
  }
  return verts;
};

const createMeteor = (x: number, y: number, gen: number, canvasW: number, canvasH: number, skin: MeteorSkin): Meteor => {
  const radii = [45, 28, 16, 8];
  const r = radii[Math.min(gen, 3)] * (0.8 + Math.random() * 0.4);
  const speed = 0.3 + gen * 0.4 + Math.random() * 0.5;
  const angle = Math.random() * Math.PI * 2;
  return {
    id: genId(),
    x: Math.max(r, Math.min(canvasW - r, x)),
    y: Math.max(r, Math.min(canvasH - r, y)),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: r,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.03,
    generation: gen,
    opacity: 1,
    hue: skin.hues[Math.min(gen, 3)],
    tapCount: 0,
    vertices: createVertices(8 + Math.floor(Math.random() * 5)),
    trail: [],
  };
};

const createBossMeteor = (w: number, h: number, level: number, bossHpBase: number, bossHpPerLevel: number): Meteor => {
  const side = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  if (side === 0) { x = Math.random() * w; y = -80; }
  else if (side === 1) { x = w + 80; y = Math.random() * h; }
  else if (side === 2) { x = Math.random() * w; y = h + 80; }
  else { x = -80; y = Math.random() * h; }

  const hp = bossHpBase + Math.floor(level * bossHpPerLevel);
  const boss: Meteor = {
    id: genId(), x, y, vx: 0, vy: 0,
    radius: Math.min(120, 70 + level * 3), rotation: 0, rotationSpeed: 0.005,
    generation: 0, opacity: 1, hue: 300, tapCount: 0,
    vertices: createVertices(12), trail: [],
    isBoss: true, bossHp: hp, bossMaxHp: hp,
    bossShield: 2 + (level % 3), bossMaxShield: 2 + (level % 3),
    bossWeakPointAngle: Math.random() * Math.PI * 2,
    bossOrbitPhase: Math.random() * Math.PI * 2,
    bossOrbiters: 3 + (level % 3),
  };
  const cx = w / 2 + (Math.random() - 0.5) * w * 0.3;
  const cy = h / 2 + (Math.random() - 0.5) * h * 0.3;
  const a = Math.atan2(cy - y, cx - x);
  boss.vx = Math.cos(a) * 0.3;
  boss.vy = Math.sin(a) * 0.3;
  return boss;
};

const spawnMeteorsAtEdge = (count: number, gen: number, w: number, h: number, skin: MeteorSkin, speedMult: number = 1): Meteor[] => {
  const meteors: Meteor[] = [];
  for (let i = 0; i < count; i++) {
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    if (side === 0) { x = Math.random() * w; y = -50; }
    else if (side === 1) { x = w + 50; y = Math.random() * h; }
    else if (side === 2) { x = Math.random() * w; y = h + 50; }
    else { x = -50; y = Math.random() * h; }
    const m = createMeteor(x, y, gen, w, h, skin);
    const cx = w / 2 + (Math.random() - 0.5) * w * 0.5;
    const cy = h / 2 + (Math.random() - 0.5) * h * 0.5;
    const a = Math.atan2(cy - y, cx - x);
    const spd = (0.5 + Math.random() * 0.8) * speedMult;
    m.vx = Math.cos(a) * spd;
    m.vy = Math.sin(a) * spd;
    meteors.push(m);
  }
  return meteors;
};

const POWERUP_TYPES: PowerUpType[] = ['slowmo', 'chaos_reduce', 'score_multi'];
const POWERUP_COLORS: Record<PowerUpType, number> = { slowmo: 180, chaos_reduce: 120, score_multi: 50 };
const POWERUP_LABELS: Record<PowerUpType, string> = { slowmo: '⏱', chaos_reduce: '💚', score_multi: '⭐' };

const maybeSpawnPowerUp = (x: number, y: number, powerups: PowerUp[], dropChance: number) => {
  if (Math.random() < dropChance && powerups.length < 3) {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerups.push({ id: genId(), x, y, vy: 0.3 + Math.random() * 0.3, type, life: 6000, radius: 14, pulse: 0 });
  }
};

type Screen = 'title' | 'playing' | 'gameover' | 'leaderboard' | 'tutorial' | 'settings' | 'daily' | 'weekly' | 'skins';
type GameMode = 'classic' | 'daily' | 'weekly';

interface TutorialStep { title: string; desc: string; icon: string; }
const TUTORIAL_STEPS: TutorialStep[] = [
  { title: 'TAP TO SPLIT', desc: 'Tap meteors to break them into smaller pieces. Smaller = more points!', icon: '☄️' },
  { title: 'WATCH THE CHAOS', desc: 'Over-tapping the same meteor fills your Chaos Meter. Hit 100% and it\'s game over!', icon: '⚠️' },
  { title: 'COLLECT POWER-UPS', desc: 'Destroyed meteors drop power-ups: Slow-Mo ⏱, Chaos Reduce 💚, Score Boost ⭐', icon: '✨' },
  { title: 'SURVIVE EVENTS', desc: 'Meteor Showers rain down fast! Boss Meteors need multiple hits to defeat.', icon: '💥' },
];

export default function MeteorSplitGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backdropCanvasRef = useRef<HTMLCanvasElement>(null);
  const backdropRef = useRef<WebGLBackdrop | null>(null);
  const gameRef = useRef<GameState>({
    score: 0, level: 1, meteorsDestroyed: 0, chaosLevel: 0,
    gameOver: false, started: false,
    highScore: parseInt(localStorage.getItem('meteorSplitHigh') || '0'),
    combo: 0, comboTimer: 0, screenShake: 0, maxCombo: 0,
    slowmoTimer: 0, scoreMultiTimer: 0, scoreMultiplier: 1,
    specialEvent: null, lastEventLevel: 0, bossDefeated: 0,
    pulseCooldown: 0, runTime: 0, taps: 0, hits: 0,
  });
  const meteorsRef = useRef<Meteor[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const starsRef = useRef<Star[]>([]);
  const powerupsRef = useRef<PowerUp[]>([]);
  const spawnTimerRef = useRef(0);
  const showerTimerRef = useRef(0);
  const animRef = useRef(0);
  const resumeAnimationRef = useRef<() => void>(() => undefined);
  const isHostPausedRef = useRef(false);
  const viewportRef = useRef({ width: 1, height: 1, dpr: 1 });

  const [screen, setScreen] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const [tutorialStep, setTutorialStep] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [selectedSkinId, setSelectedSkinId] = useState<MeteorSkinId>(getSelectedSkin());
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>(getSelectedTheme());

  const diffConfigRef = useRef<DifficultyConfig>(DIFFICULTY_CONFIGS.normal);
  const dailyModRef = useRef<DailyModifiers | null>(null);
  const activeSkinRef = useRef<MeteorSkin>(METEOR_SKINS[0]);
  const activeThemeRef = useRef<VisualTheme>(VISUAL_THEMES[0]);

  const [uiState, setUiState] = useState({
    score: 0, level: 1, chaos: 0, highScore: gameRef.current.highScore, combo: 0,
    slowmo: false, scoreMult: false, scoreMultiplier: 1,
    eventText: '', bossHpPct: 0, bossShieldPct: 0, showBossHp: false,
    pulseCooldown: 0, biome: BIOMES[0].name,
  });
  const [leaderboard, setLeaderboard] = useState(getLeaderboard());
  const [stats, setStats] = useState(getStats());
  const [dailyLeaderboard, setDailyLeaderboard] = useState(getDailyLeaderboard());
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState(getWeeklyLeaderboard());
  const [unlockStats, setUnlockStats] = useState<UnlockStats>(getUnlockStats(getStats()));
  const [settingsState, setSettingsState] = useState(getSettings());
  const [achievementToasts, setAchievementToasts] = useState<Achievement[]>([]);
  const [allUnlocked, setAllUnlocked] = useState<string[]>(getAllUnlocked());
  const powerupsCollectedRef = useRef(0);
  const missionsRef = useRef<RunMission[]>(createRunMissions());
  const [missions, setMissions] = useState<RunMission[]>(missionsRef.current);

  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { applyUiScale(settingsState.uiScale); }, [settingsState.uiScale]);

  const triggerAchievementCheck = useCallback(() => {
    const g = gameRef.current;
    const newly = checkAchievements({
      score: g.score, level: g.level, combo: g.maxCombo,
      meteorsDestroyed: g.meteorsDestroyed, bossDefeated: g.bossDefeated,
      chaosLevel: g.chaosLevel, powerupsCollected: powerupsCollectedRef.current,
      gamesPlayed: stats?.gamesPlayed || 0,
    });
    if (newly.length) {
      setAchievementToasts(prev => [...prev, ...newly]);
      setAllUnlocked(getAllUnlocked());
      newly.forEach((a, i) => {
        setTimeout(() => setAchievementToasts(prev => prev.filter(x => x.id !== a.id)), 4000 + i * 600);
      });
    }
  }, [stats]);

  const hasSeenTutorial = useRef(localStorage.getItem(TUTORIAL_KEY) === '1');

  // Refresh unlock stats
  const refreshUnlocks = useCallback(() => {
    const s = getStats();
    setStats(s);
    setUnlockStats(getUnlockStats(s));
  }, []);

  const updateMissionProgress = useCallback(() => {
    const game = gameRef.current;
    const next = updateRunMissions(missionsRef.current, {
      destroyed: game.meteorsDestroyed,
      combo: game.maxCombo,
      score: game.score,
    });
    missionsRef.current = next;
    setMissions(next);
  }, []);

  const initStars = useCallback((w: number, h: number) => {
    const stars: Star[] = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * w, y: Math.random() * h,
        size: Math.random() * 2 + 0.5, brightness: Math.random(),
        twinkleSpeed: 0.5 + Math.random() * 2, twinkleOffset: Math.random() * Math.PI * 2,
      });
    }
    starsRef.current = stars;
  }, []);

  const addParticles = (x: number, y: number, count: number, hue: number, type: 'spark' | 'debris' | 'chaos' | 'shower') => {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = type === 'chaos' ? 2 + Math.random() * 5 : type === 'shower' ? 1 + Math.random() * 2 : 1 + Math.random() * 3;
      particlesRef.current.push({
        x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: 1, maxLife: 0.5 + Math.random() * 0.8,
        size: type === 'chaos' ? 3 + Math.random() * 4 : 1 + Math.random() * 3,
        hue, type,
      });
    }
  };

  const addShockwave = (x: number, y: number, hue: number, maxRadius = 110, maxLife = 460, width = 3) => {
    if (shockwavesRef.current.length >= 10) shockwavesRef.current.shift();
    shockwavesRef.current.push({ x, y, hue, maxRadius, maxLife, life: maxLife, width });
  };

  const triggerSpecialEvent = useCallback((w: number, h: number) => {
    const game = gameRef.current;
    const cfg = diffConfigRef.current;
    const eventType = Math.random() < 0.5 ? 'meteor_shower' : 'boss_meteor';

    if (eventType === 'meteor_shower') {
      playShowerWarning();
      game.specialEvent = { type: 'meteor_shower', timer: SHOWER_DURATION, duration: SHOWER_DURATION, active: true };
      showerTimerRef.current = 0;
    } else {
      const boss = createBossMeteor(w, h, game.level, cfg.bossHpBase, cfg.bossHpPerLevel);
      meteorsRef.current.push(boss);
      game.specialEvent = { type: 'boss_meteor', timer: 0, duration: 0, active: true, data: { bossId: boss.id } };
    }
    game.lastEventLevel = game.level;
  }, []);

  const splitMeteor = useCallback((meteor: Meteor, tapX = meteor.x, tapY = meteor.y) => {
    const game = gameRef.current;
    const canvas = canvasRef.current;
    const cfg = diffConfigRef.current;
    const skin = activeSkinRef.current;
    if (!canvas) return;

    // Boss
    if (meteor.isBoss && meteor.bossHp !== undefined) {
      const hitAngle = Math.atan2(tapY - meteor.y, tapX - meteor.x);
      const weakAngle = meteor.bossWeakPointAngle ?? 0;
      const angleDifference = Math.abs(Math.atan2(Math.sin(hitAngle - weakAngle), Math.cos(hitAngle - weakAngle)));
      if (angleDifference > 0.48) {
        addParticles(tapX, tapY, 5, 220, 'debris');
        game.combo = 0;
        return;
      }

      meteor.tapCount++;
      meteor.bossWeakPointAngle = (weakAngle + Math.PI * 0.78) % (Math.PI * 2);
      game.screenShake = Math.min(game.screenShake + 4, 12);
      addParticles(tapX, tapY, 12, meteor.bossShield ? 195 : 300, 'spark');
      addShockwave(tapX, tapY, meteor.bossShield ? 195 : 300, meteor.radius * 1.4, 330, 3);
      playBossHit();

      if ((meteor.bossShield ?? 0) > 0) {
        meteor.bossShield = Math.max(0, (meteor.bossShield ?? 0) - 1);
        hapticSplit();
        return;
      }

      meteor.bossHp--;

      if (meteor.bossHp <= 0) {
        meteorsRef.current = meteorsRef.current.filter(m => m.id !== meteor.id);
        addParticles(meteor.x, meteor.y, 40, 300, 'spark');
        addParticles(meteor.x, meteor.y, 20, 50, 'debris');
        addShockwave(meteor.x, meteor.y, 300, meteor.radius * 3.2, 700, 5);
        game.score += Math.round(500 * game.scoreMultiplier * cfg.scoreMultiplier);
        game.bossDefeated++;
        game.screenShake = 15;
        game.specialEvent = null;
        playBossDefeat();
        hapticBoss();
        const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
        powerupsRef.current.push({ id: genId(), x: meteor.x, y: meteor.y, vy: 0.2, type, life: 8000, radius: 18, pulse: 0 });
        triggerAchievementCheck();
      } else {
        // The shield reforms in phases, forcing players to follow the new weak point.
        if (meteor.bossHp % 3 === 0) meteor.bossShield = meteor.bossMaxShield;
        hapticSplit();
      }
      return;
    }

    meteor.tapCount++;
    const mult = game.scoreMultiplier * cfg.scoreMultiplier * (dailyModRef.current?.bonusScoreMult ?? 1);
    addShockwave(tapX, tapY, skin.particleHue, Math.max(48, meteor.radius * 2.1), 360, 2.5);

    if (meteor.generation >= 3) {
      meteorsRef.current = meteorsRef.current.filter(m => m.id !== meteor.id);
      addParticles(meteor.x, meteor.y, 8, skin.particleHue, 'spark');
      game.score += Math.round(50 * (game.combo + 1) * mult);
      game.meteorsDestroyed++;
      game.combo++;
      game.maxCombo = Math.max(game.maxCombo, game.combo);
      game.comboTimer = COMBO_TIMEOUT;
      game.screenShake = Math.min(game.screenShake + 2, 8);
      playDestroy();
      hapticDestroy();
      if (game.combo > 2) playCombo(game.combo);
      maybeSpawnPowerUp(meteor.x, meteor.y, powerupsRef.current, cfg.powerUpDropChance);
      triggerAchievementCheck();
      updateMissionProgress();
      return;
    }

    if (meteor.tapCount > 1 && meteor.generation < 2) {
      const chaosMult = dailyModRef.current?.chaosMult ?? 1;
      game.chaosLevel = Math.min(1, game.chaosLevel + cfg.chaosPerOverTap * chaosMult);
      game.screenShake = Math.min(game.screenShake + 5, 15);
      addParticles(meteor.x, meteor.y, 20, 0, 'chaos');
      playChaos();
      hapticChaos();
      const count = 3 + Math.floor(Math.random() * 3);
      meteorsRef.current = meteorsRef.current.filter(m => m.id !== meteor.id);
      if (meteorsRef.current.length < MAX_METEORS) {
        for (let i = 0; i < count; i++) {
          const { width, height } = viewportRef.current;
          const nm = createMeteor(meteor.x + (Math.random() - 0.5) * 30, meteor.y + (Math.random() - 0.5) * 30, meteor.generation + 1, width, height, skin);
          const a = Math.random() * Math.PI * 2;
          const spd = 1.5 + Math.random() * 2;
          nm.vx = Math.cos(a) * spd * cfg.meteorSpeedMult;
          nm.vy = Math.sin(a) * spd * cfg.meteorSpeedMult;
          nm.hue = 0;
          meteorsRef.current.push(nm);
        }
      }
      game.score += Math.round(10 * mult);
    } else {
      meteorsRef.current = meteorsRef.current.filter(m => m.id !== meteor.id);
      addParticles(meteor.x, meteor.y, 12, skin.particleHue, 'spark');
      addParticles(meteor.x, meteor.y, 5, skin.particleHue, 'debris');
      playSplit(meteor.generation);
      hapticSplit();
      for (let i = 0; i < 2; i++) {
        if (meteorsRef.current.length < MAX_METEORS) {
          const { width, height } = viewportRef.current;
          const nm = createMeteor(meteor.x + (Math.random() - 0.5) * 20, meteor.y + (Math.random() - 0.5) * 20, meteor.generation + 1, width, height, skin);
          nm.vx *= cfg.meteorSpeedMult;
          nm.vy *= cfg.meteorSpeedMult;
          meteorsRef.current.push(nm);
        }
      }
      game.score += Math.round((meteor.generation + 1) * 25 * (game.combo + 1) * mult);
      game.meteorsDestroyed++;
      game.combo++;
      game.maxCombo = Math.max(game.maxCombo, game.combo);
      game.comboTimer = COMBO_TIMEOUT;
      game.screenShake = Math.min(game.screenShake + 3, 10);
      if (game.combo > 2) playCombo(game.combo);
      maybeSpawnPowerUp(meteor.x, meteor.y, powerupsRef.current, cfg.powerUpDropChance);
      triggerAchievementCheck();
    }

    updateMissionProgress();

    const prevLevel = game.level;
    if (game.meteorsDestroyed > 0 && game.meteorsDestroyed % 15 === 0) {
      game.level += 1;
      void saveYouTubeProgress();
    }

    const eventStart = dailyModRef.current?.specialStartLevel ?? 3;
    if (game.level > prevLevel && game.level - game.lastEventLevel >= EVENT_INTERVAL_LEVELS && game.level >= eventStart) {
      triggerSpecialEvent(viewportRef.current.width, viewportRef.current.height);
    }

    if (game.chaosLevel >= 1) {
      game.gameOver = true;
      stopBGM();
      playChaosOverload();
      if (game.bossDefeated > 0) addBossDefeat(game.bossDefeated);
      if (game.score > game.highScore) {
        game.highScore = game.score;
        localStorage.setItem('meteorSplitHigh', String(game.score));
      }
      if (game.score >= game.highScore && game.score > 0) void sendYouTubeScore(game.score);
      const entry = {
        score: game.score, level: game.level,
        meteorsDestroyed: game.meteorsDestroyed, maxCombo: game.maxCombo,
        date: new Date().toISOString(),
      };
      if (gameMode === 'daily') {
        addDailyEntry(entry);
        setDailyLeaderboard(getDailyLeaderboard());
      } else if (gameMode === 'weekly') {
        addWeeklyEntry(entry);
        setWeeklyLeaderboard(getWeeklyLeaderboard());
      } else {
        addLeaderboardEntry(entry);
        setLeaderboard(getLeaderboard());
      }
      refreshUnlocks();
      addParticles(viewportRef.current.width / 2, viewportRef.current.height / 2, 50, 0, 'chaos');
      void saveYouTubeProgress();
      setScreen('gameover');
    }
  }, [triggerSpecialEvent, gameMode, refreshUnlocks, updateMissionProgress]);

  const collectPowerUp = useCallback((pu: PowerUp) => {
    const game = gameRef.current;
    powerupsRef.current = powerupsRef.current.filter(p => p.id !== pu.id);
    playPowerUp();
    hapticPowerUp();
    powerupsCollectedRef.current++;
    addParticles(pu.x, pu.y, 15, POWERUP_COLORS[pu.type], 'spark');
    switch (pu.type) {
      case 'slowmo': game.slowmoTimer = POWERUP_DURATION; break;
      case 'chaos_reduce': game.chaosLevel = Math.max(0, game.chaosLevel - 0.3); game.screenShake = Math.min(game.screenShake + 3, 8); break;
      case 'score_multi': game.scoreMultiTimer = POWERUP_DURATION; game.scoreMultiplier = 3; break;
    }
    triggerAchievementCheck();
  }, [triggerAchievementCheck]);

  const activatePulse = useCallback(() => {
    const game = gameRef.current;
    if (!game.started || game.gameOver || isHostPausedRef.current || game.pulseCooldown > 0) return;
    game.pulseCooldown = PULSE_COOLDOWN;
    game.chaosLevel = Math.max(0, game.chaosLevel - 0.22);
    game.screenShake = 14;
    let cleared = 0;
    meteorsRef.current = meteorsRef.current.filter(meteor => {
      if (meteor.isBoss) {
        if ((meteor.bossShield ?? 0) > 0) meteor.bossShield = Math.max(0, (meteor.bossShield ?? 0) - 1);
        else if (meteor.bossHp !== undefined) meteor.bossHp = Math.max(1, meteor.bossHp - 1);
        addParticles(meteor.x, meteor.y, 16, 195, 'spark');
        return true;
      }
      cleared++;
      addParticles(meteor.x, meteor.y, 10, 190, 'spark');
      return false;
    });
    game.meteorsDestroyed += cleared;
    game.score += Math.round(cleared * 20 * game.scoreMultiplier * diffConfigRef.current.scoreMultiplier);
    addParticles(viewportRef.current.width / 2, viewportRef.current.height / 2, 36, 190, 'spark');
    addShockwave(viewportRef.current.width / 2, viewportRef.current.height / 2, 190, Math.hypot(viewportRef.current.width, viewportRef.current.height) * 0.68, 850, 6);
    hapticPowerUp();
    updateMissionProgress();
  }, [updateMissionProgress]);

  const startGame = useCallback((mode: GameMode = 'classic') => {
    const game = gameRef.current;
    const cfg = DIFFICULTY_CONFIGS[difficulty];
    diffConfigRef.current = cfg;
    activeSkinRef.current = METEOR_SKINS.find(s => s.id === selectedSkinId) || METEOR_SKINS[0];
    activeThemeRef.current = VISUAL_THEMES.find(t => t.id === selectedThemeId) || VISUAL_THEMES[0];

    setGameMode(mode);
    if (mode === 'daily') {
      dailyModRef.current = getDailyModifiers();
    } else if (mode === 'weekly') {
      dailyModRef.current = getWeeklyModifiers();
    } else {
      dailyModRef.current = null;
    }

    game.started = true;
    game.gameOver = false;
    game.score = 0;
    game.level = 1;
    game.meteorsDestroyed = 0;
    game.chaosLevel = 0;
    game.combo = 0;
    game.comboTimer = 0;
    game.maxCombo = 0;
    game.slowmoTimer = 0;
    game.scoreMultiTimer = 0;
    game.scoreMultiplier = 1;
    game.specialEvent = null;
    game.lastEventLevel = 0;
    game.bossDefeated = 0;
    game.pulseCooldown = 0;
    game.runTime = 0;
    game.taps = 0;
    game.hits = 0;
    meteorsRef.current = [];
    particlesRef.current = [];
    shockwavesRef.current = [];
    powerupsRef.current = [];
    spawnTimerRef.current = 0;
    showerTimerRef.current = 0;
    powerupsCollectedRef.current = 0;
    missionsRef.current = createRunMissions();
    setMissions(missionsRef.current);
    startBGM();
    setScreen('playing');
  }, [difficulty, selectedSkinId, selectedThemeId]);

  const enterClassicFromTitle = useCallback(() => {
    resumeAudio();
    if (!hasSeenTutorial.current) {
      hasSeenTutorial.current = true;
      localStorage.setItem(TUTORIAL_KEY, '1');
      setTutorialStep(0);
      setScreen('tutorial');
      return;
    }
    startGame('classic');
  }, [startGame]);

  const handleTap = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const game = gameRef.current;
    if (!canvas) return;
    if (isHostPausedRef.current) return;
    resumeAudio();

    const rect = canvas.getBoundingClientRect();
    const scaleX = viewportRef.current.width / rect.width;
    const scaleY = viewportRef.current.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    if (!game.started) {
      enterClassicFromTitle();
      return;
    }

    if (game.gameOver) {
      game.started = false;
      setScreen('title');
      return;
    }

    game.taps++;

    for (const pu of powerupsRef.current) {
      const d = Math.hypot(pu.x - x, pu.y - y);
      if (d < pu.radius * 2) { collectPowerUp(pu); return; }
    }

    let closest: Meteor | null = null;
    let closestDist = Infinity;
    for (const m of meteorsRef.current) {
      const d = Math.hypot(m.x - x, m.y - y);
      const hitRadius = m.isBoss ? m.radius * 1.1 : m.radius * 1.3;
      if (d < hitRadius && d < closestDist) { closest = m; closestDist = d; }
    }

    if (closest) { game.hits++; splitMeteor(closest, x, y); }
    else game.combo = 0;
  }, [splitMeteor, collectPowerUp, enterClassicFromTitle]);

  // Restore cloud progress before declaring the title screen ready to YouTube.
  useEffect(() => {
    let mounted = true;
    const cleanup = initializeYouTubePlayables({
      onAudioEnabled: setHostAudioEnabled,
      onPause: () => {
        isHostPausedRef.current = true;
        cancelAnimationFrame(animRef.current);
        suspendAudio();
        void saveYouTubeProgress();
      },
      onResume: () => {
        isHostPausedRef.current = false;
        resumeAudio();
        resumeAnimationRef.current();
      },
      onLanguage: (locale) => { document.documentElement.lang = locale; },
    });

    void loadYouTubeProgress().then((restored) => {
      if (!mounted || !restored) { notifyGameReady(); return; }
      const highScore = parseInt(localStorage.getItem('meteorSplitHigh') || '0', 10) || 0;
      gameRef.current.highScore = highScore;
      setUiState(current => ({ ...current, highScore }));
      setLeaderboard(getLeaderboard());
      setDailyLeaderboard(getDailyLeaderboard());
      setWeeklyLeaderboard(getWeeklyLeaderboard());
      const restoredStats = getStats();
      setStats(restoredStats);
      setUnlockStats(getUnlockStats(restoredStats));
      setSettingsState(getSettings());
      setSelectedSkinId(getSelectedSkin());
      setSelectedThemeId(getSelectedTheme());
      setAllUnlocked(getAllUnlocked());
      notifyGameReady();
    });

    return () => { mounted = false; cleanup(); };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        activatePulse();
        return;
      }
      if (event.key.toLowerCase() !== 'f' || event.repeat) return;
      const toggle = document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen();
      void toggle.catch(() => undefined).finally(() => window.dispatchEvent(new Event('resize')));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activatePulse]);

  useEffect(() => {
    const canvas = backdropCanvasRef.current;
    if (!canvas) return;
    const backdrop = createWebGLBackdrop(canvas);
    backdropRef.current = backdrop;
    return () => {
      if (backdropRef.current === backdrop) backdropRef.current = null;
      backdrop.destroy();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const width = Math.floor(window.innerWidth);
      const height = Math.floor(window.innerHeight);
      // Playables can initially boot in a hidden 0×0 WebView. Keep the game
      // alive and wait for its real viewport instead of resetting progress.
      if (width <= 0 || height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      viewportRef.current = { width, height, dpr };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      backdropRef.current?.resize(width, height, dpr);
      initStars(width, height);
    };
    resize();
    window.addEventListener('resize', resize);

    const onTouch = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        handleTap(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
      }
    };
    const onClick = (e: MouseEvent) => handleTap(e.clientX, e.clientY);

    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('mousedown', onClick);

    const ctx = canvas.getContext('2d')!;
    let lastTime = performance.now();

    const loop = (now: number, scheduleNextFrame = true) => {
      // YouTube's pause callback stops all game work, including painting and
      // particle updates. onResume explicitly schedules the next frame.
      if (isHostPausedRef.current) return;
      const rawDt = Math.min(now - lastTime, 50);
      lastTime = now;
      const game = gameRef.current;
      const { width: w, height: h } = viewportRef.current;
      const cfg = diffConfigRef.current;
      const skin = activeSkinRef.current;
      const theme = activeThemeRef.current;
      const dailyMod = dailyModRef.current;
      const accessibility = getSettings();
      const reducedMotion = isReducedMotion();
      const biome = getBiome(game.level);
      backdropRef.current?.render(now, biome.hue, game.chaosLevel);

      const timeScale = game.slowmoTimer > 0 ? 0.4 : 1;
      const dt = rawDt * timeScale;

      if (game.started && !game.gameOver && !isHostPausedRef.current) {
        // Spawn
        spawnTimerRef.current -= rawDt;
        if (spawnTimerRef.current <= 0) {
          const spawnMult = dailyMod?.spawnRateMult ?? 1;
          const endlessTier = Math.floor((game.level - 1) / 5);
          const interval = Math.max(cfg.spawnIntervalMin * Math.max(0.5, 1 - endlessTier * 0.04), cfg.spawnIntervalBase - game.level * cfg.spawnIntervalPerLevel) / spawnMult;
          spawnTimerRef.current = interval;
          const count = Math.min(5, 1 + Math.floor(game.level / 3));
          meteorsRef.current.push(...spawnMeteorsAtEdge(count, 0, w, h, skin, cfg.meteorSpeedMult * (1 + endlessTier * 0.08)));
        }

        // Meteor shower
        if (game.specialEvent?.type === 'meteor_shower' && game.specialEvent.active) {
          game.specialEvent.timer -= rawDt;
          showerTimerRef.current -= rawDt;
          if (showerTimerRef.current <= 0) {
            showerTimerRef.current = 400;
            const count = 2 + Math.floor(Math.random() * 3);
            const newMeteors = spawnMeteorsAtEdge(count, Math.random() < 0.3 ? 1 : 0, w, h, skin, cfg.meteorSpeedMult * 1.5);
            newMeteors.forEach(m => { m.hue = 40; });
            meteorsRef.current.push(...newMeteors);
          }
          if (game.specialEvent.timer <= 0) game.specialEvent = null;
        }

        // Boss check
        if (game.specialEvent?.type === 'boss_meteor' && game.specialEvent.active) {
          const bossId = game.specialEvent.data?.bossId;
          if (bossId && !meteorsRef.current.find(m => m.id === bossId)) game.specialEvent = null;
        }

        if (game.comboTimer > 0) { game.comboTimer -= rawDt; if (game.comboTimer <= 0) game.combo = 0; }
        if (game.slowmoTimer > 0) game.slowmoTimer -= rawDt;
        if (game.scoreMultiTimer > 0) { game.scoreMultiTimer -= rawDt; if (game.scoreMultiTimer <= 0) game.scoreMultiplier = 1; }
        if (game.pulseCooldown > 0) game.pulseCooldown = Math.max(0, game.pulseCooldown - rawDt);
        game.runTime += rawDt;

        game.chaosLevel = Math.max(0, game.chaosLevel - cfg.chaosDecayRate * dt);
        updateBGMChaos(game.chaosLevel);
        game.screenShake *= 0.92;

        // Update meteors
        for (const m of meteorsRef.current) {
          m.x += m.vx * dt * 0.06;
          m.y += m.vy * dt * 0.06;
          m.rotation += m.rotationSpeed * dt * 0.06;
          m.trail.push({ x: m.x, y: m.y, age: 0 });
          if (m.trail.length > (m.isBoss ? 12 : 8)) m.trail.shift();
          for (const t of m.trail) t.age += dt * 0.001;

          if (!m.isBoss) {
            if (m.x < -m.radius * 2) m.x = w + m.radius;
            if (m.x > w + m.radius * 2) m.x = -m.radius;
            if (m.y < -m.radius * 2) m.y = h + m.radius;
            if (m.y > h + m.radius * 2) m.y = -m.radius;
          } else {
            m.bossOrbitPhase = (m.bossOrbitPhase ?? 0) + dt * 0.0015;
            m.vx += Math.cos(m.bossOrbitPhase) * 0.003;
            m.vy += Math.sin(m.bossOrbitPhase) * 0.003;
            if (m.x - m.radius < 0 || m.x + m.radius > w) m.vx *= -1;
            if (m.y - m.radius < 0 || m.y + m.radius > h) m.vy *= -1;
            m.x = Math.max(m.radius, Math.min(w - m.radius, m.x));
            m.y = Math.max(m.radius, Math.min(h - m.radius, m.y));
          }
        }

        for (let i = powerupsRef.current.length - 1; i >= 0; i--) {
          const pu = powerupsRef.current[i];
          pu.y += pu.vy * dt * 0.06;
          pu.life -= rawDt;
          pu.pulse += rawDt * 0.005;
          if (pu.life <= 0 || pu.y > h + 30) powerupsRef.current.splice(i, 1);
        }
      }

      // Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx * dt * 0.06;
        p.y += p.vy * dt * 0.06;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= dt * 0.001 / p.maxLife;
        if (p.life <= 0) particlesRef.current.splice(i, 1);
      }

      for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
        const wave = shockwavesRef.current[i];
        wave.life -= rawDt;
        if (wave.life <= 0) shockwavesRef.current.splice(i, 1);
      }

      // === DRAW ===
      const shake = reducedMotion ? 0 : game.screenShake;
      const sx = shake > 0.5 ? (Math.random() - 0.5) * shake : 0;
      const sy = shake > 0.5 ? (Math.random() - 0.5) * shake : 0;
      ctx.save();
      ctx.translate(sx, sy);

      // The 2D layer stays transparent so the GPU-rendered cosmic scene is visible.
      ctx.clearRect(-10, -10, w + 20, h + 20);

      if (game.chaosLevel > 0.3) {
        ctx.fillStyle = `hsla(${theme.chaosOverlayHue}, 80%, 20%, ${(game.chaosLevel - 0.3) * 0.3})`;
        ctx.fillRect(-10, -10, w + 20, h + 20);
      }
      if (game.slowmoTimer > 0) {
        ctx.fillStyle = `hsla(200, 80%, 30%, 0.08)`;
        ctx.fillRect(-10, -10, w + 20, h + 20);
      }
      if (game.specialEvent?.type === 'meteor_shower' && game.specialEvent.active) {
        const pulse = 0.03 + Math.sin(now * 0.005) * 0.02;
        ctx.fillStyle = `hsla(40, 90%, 50%, ${pulse})`;
        ctx.fillRect(-10, -10, w + 20, h + 20);
      }

      // Stars
      const t = now * 0.001;
      for (const s of starsRef.current) {
        const b = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinkleOffset));
        ctx.fillStyle = `rgba(255,255,255,${b * s.brightness * theme.starBrightness})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }

      // Meteor trails
      for (const m of meteorsRef.current) {
        if (m.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(m.trail[0].x, m.trail[0].y);
          for (let i = 1; i < m.trail.length; i++) ctx.lineTo(m.trail[i].x, m.trail[i].y);
          const trailHue = mapHue(m.isBoss ? 300 : m.hue, accessibility.colorBlindMode);
          ctx.strokeStyle = `hsla(${trailHue}, 80%, 60%, ${m.isBoss ? 0.3 : 0.15})`;
          ctx.lineWidth = m.radius * (m.isBoss ? 0.7 : skin.trailWidth);
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }

      // Meteors
      for (const m of meteorsRef.current) {
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.rotation);

        if (m.isBoss) {
          const bPulse = reducedMotion ? 1 : 1 + Math.sin(now * 0.004) * 0.15;
          const glowGrad = ctx.createRadialGradient(0, 0, m.radius * 0.2, 0, 0, m.radius * 3 * bPulse);
          glowGrad.addColorStop(0, `hsla(300, 90%, 60%, 0.5)`);
          glowGrad.addColorStop(0.5, `hsla(280, 80%, 40%, 0.2)`);
          glowGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = glowGrad;
          ctx.fillRect(-m.radius * 3, -m.radius * 3, m.radius * 6, m.radius * 6);

          ctx.beginPath();
          for (let i = 0; i < m.vertices.length; i++) {
            const angle = (i / m.vertices.length) * Math.PI * 2;
            const r = m.radius * m.vertices[i] * bPulse;
            if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
            else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
          }
          ctx.closePath();
          const bodyGrad = ctx.createRadialGradient(-m.radius * 0.3, -m.radius * 0.3, 0, 0, 0, m.radius);
          bodyGrad.addColorStop(0, `hsl(310, 70%, 55%)`);
          bodyGrad.addColorStop(0.6, `hsl(290, 60%, 35%)`);
          bodyGrad.addColorStop(1, `hsl(270, 50%, 18%)`);
          ctx.fillStyle = bodyGrad;
          ctx.fill();
          ctx.strokeStyle = `hsla(320, 90%, 75%, 0.8)`;
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, 0, m.radius * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(350, 100%, 60%, ${0.7 + Math.sin(now * 0.006) * 0.3})`;
          ctx.fill();

          const weakPointAngle = m.bossWeakPointAngle ?? 0;
          const weakX = Math.cos(weakPointAngle) * m.radius * 0.72;
          const weakY = Math.sin(weakPointAngle) * m.radius * 0.72;
          ctx.beginPath();
          ctx.arc(weakX, weakY, m.radius * 0.16, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(55, 100%, 65%, ${reducedMotion ? 1 : 0.7 + Math.sin(now * 0.009) * 0.3})`;
          ctx.fill();
          ctx.strokeStyle = 'hsla(55, 100%, 88%, 0.95)';
          ctx.lineWidth = 2;
          ctx.stroke();

          if ((m.bossShield ?? 0) > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, m.radius * 1.18, 0, Math.PI * 2);
            ctx.strokeStyle = 'hsla(195, 95%, 68%, 0.68)';
            ctx.lineWidth = 4;
            ctx.stroke();
          }
          const orbiters = m.bossOrbiters ?? 0;
          for (let i = 0; i < orbiters; i++) {
            const angle = (m.bossOrbitPhase ?? 0) + (i / orbiters) * Math.PI * 2;
            const distance = m.radius * 1.58;
            ctx.beginPath();
            ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, m.radius * 0.12, 0, Math.PI * 2);
            ctx.fillStyle = 'hsl(210, 80%, 58%)';
            ctx.fill();
            ctx.strokeStyle = 'hsla(210, 90%, 82%, 0.75)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        } else {
          const glowGrad = ctx.createRadialGradient(0, 0, m.radius * 0.2, 0, 0, m.radius * 2);
          const meteorHue = mapHue(m.hue, accessibility.colorBlindMode);
          glowGrad.addColorStop(0, `hsla(${meteorHue}, 80%, 60%, ${skin.glowIntensity})`);
          glowGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = glowGrad;
          ctx.fillRect(-m.radius * 2, -m.radius * 2, m.radius * 4, m.radius * 4);

          ctx.beginPath();
          for (let i = 0; i < m.vertices.length; i++) {
            const angle = (i / m.vertices.length) * Math.PI * 2;
            const r = m.radius * m.vertices[i];
            if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
            else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
          }
          ctx.closePath();
          const bodyGrad = ctx.createRadialGradient(-m.radius * 0.3, -m.radius * 0.3, 0, 0, 0, m.radius);
          bodyGrad.addColorStop(0, `hsl(${meteorHue}, 60%, 50%)`);
          bodyGrad.addColorStop(0.6, `hsl(${meteorHue}, 50%, 30%)`);
          bodyGrad.addColorStop(1, `hsl(${meteorHue}, 40%, 15%)`);
          ctx.fillStyle = bodyGrad;
          ctx.fill();
          ctx.strokeStyle = `hsla(${meteorHue}, 70%, 65%, 0.6)`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          for (let i = 0; i < 3; i++) {
            const cx2 = Math.sin(i * 2.1 + m.id.charCodeAt(1)) * m.radius * 0.4;
            const cy2 = Math.cos(i * 3.7 + m.id.charCodeAt(1)) * m.radius * 0.4;
            ctx.beginPath();
            ctx.arc(cx2, cy2, m.radius * 0.12, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${meteorHue}, 30%, 20%, 0.5)`;
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // Power-ups
      for (const pu of powerupsRef.current) {
        const hue = POWERUP_COLORS[pu.type];
        const pulseR = pu.radius + Math.sin(pu.pulse * 3) * 3;
        const alpha = pu.life < 1500 ? pu.life / 1500 : 1;
        ctx.save();
        ctx.translate(pu.x, pu.y);
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, pulseR * 2.5);
        glow.addColorStop(0, `hsla(${hue}, 90%, 60%, ${0.4 * alpha})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(-pulseR * 3, -pulseR * 3, pulseR * 6, pulseR * 6);
        ctx.beginPath();
        ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 80%, 50%, ${0.9 * alpha})`;
        ctx.fill();
        ctx.strokeStyle = `hsla(${hue}, 90%, 80%, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = `hsla(0, 0%, 100%, ${alpha})`;
        ctx.font = `${pulseR}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(POWERUP_LABELS[pu.type], 0, 1);
        ctx.restore();
      }

      // Particles
      for (const wave of shockwavesRef.current) {
        const progress = 1 - wave.life / wave.maxLife;
        const eased = 1 - Math.pow(1 - progress, 3);
        const radius = wave.maxRadius * eased;
        const alpha = (1 - progress) * (reducedMotion ? 0.35 : 0.72);
        ctx.save();
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${mapHue(wave.hue, accessibility.colorBlindMode)}, 95%, 76%, ${alpha})`;
        ctx.shadowColor = `hsla(${wave.hue}, 95%, 65%, ${alpha})`;
        ctx.shadowBlur = 14;
        ctx.lineWidth = Math.max(1, wave.width * (1 - progress * 0.55));
        ctx.stroke();
        ctx.restore();
      }

      for (const p of particlesRef.current) {
        const alpha = p.life;
        if (p.type === 'chaos') {
          ctx.fillStyle = `hsla(${p.hue}, 90%, 55%, ${alpha})`;
          ctx.shadowColor = `hsla(${p.hue}, 90%, 55%, ${alpha * 0.5})`;
          ctx.shadowBlur = 10;
        } else if (p.type === 'spark' || p.type === 'shower') {
          ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, ${alpha})`;
          ctx.shadowColor = `hsla(${p.hue}, 80%, 70%, ${alpha * 0.5})`;
          ctx.shadowBlur = 6;
        } else {
          ctx.fillStyle = `hsla(${p.hue}, 50%, 50%, ${alpha})`;
          ctx.shadowBlur = 0;
        }
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size * p.life, p.size * p.life);
        ctx.shadowBlur = 0;
      }

      ctx.restore();

      // Boss HP
      let bossHpPct = 0, bossShieldPct = 0, showBossHp = false;
      if (game.specialEvent?.type === 'boss_meteor') {
        const boss = meteorsRef.current.find(m => m.isBoss);
        if (boss?.bossHp !== undefined && boss.bossMaxHp) {
          bossHpPct = boss.bossHp / boss.bossMaxHp;
          bossShieldPct = boss.bossMaxShield ? (boss.bossShield ?? 0) / boss.bossMaxShield : 0;
          showBossHp = true;
        }
      }

      let eventText = '';
      if (game.specialEvent?.type === 'meteor_shower' && game.specialEvent.active) eventText = '☄️ METEOR SHOWER!';
      else if (game.specialEvent?.type === 'boss_meteor' && game.specialEvent.active) eventText = bossShieldPct > 0 ? '👾 BOSS: BREAK THE SHIELD' : '👾 BOSS: HIT THE GOLD WEAK POINT';

      setUiState({
        score: game.score, level: game.level, chaos: game.chaosLevel,
        highScore: game.highScore, combo: game.combo,
        slowmo: game.slowmoTimer > 0, scoreMult: game.scoreMultiTimer > 0,
        scoreMultiplier: game.scoreMultiplier, eventText, bossHpPct, bossShieldPct, showBossHp,
        pulseCooldown: game.pulseCooldown, biome: biome.name,
      });

      notifyFirstFrameReady();
      if (scheduleNextFrame) animRef.current = requestAnimationFrame(loop);
    };

    window.render_game_to_text = () => {
      const game = gameRef.current;
      return JSON.stringify({
        coordinateSystem: 'canvas origin is top-left; x increases right, y increases down',
        screen: screenRef.current,
        paused: isHostPausedRef.current,
        score: game.score,
        level: game.level,
        biome: getBiome(game.level).name,
        chaos: game.chaosLevel,
        combo: game.combo,
        pulseCooldown: game.pulseCooldown,
        missions: missionsRef.current.map(({ id, progress, target, complete }) => ({ id, progress, target, complete })),
        meteors: meteorsRef.current.map(({ x, y, radius, generation, isBoss, bossHp, bossShield }) => ({ x, y, radius, generation, isBoss, bossHp, bossShield })),
        powerups: powerupsRef.current.map(({ x, y, type, life }) => ({ x, y, type, life })),
        shockwaves: shockwavesRef.current.map(({ x, y, life, maxLife, maxRadius }) => ({ x, y, progress: 1 - life / maxLife, maxRadius })),
      });
    };
    window.advanceTime = (milliseconds: number) => {
      let remaining = Math.max(0, milliseconds);
      while (remaining > 0) {
        const step = Math.min(50, remaining);
        loop(lastTime + step, false);
        remaining -= step;
      }
    };

    resumeAnimationRef.current = () => {
      if (isHostPausedRef.current) return;
      lastTime = performance.now();
      cancelAnimationFrame(animRef.current);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('mousedown', onClick);
      delete window.render_game_to_text;
      delete window.advanceTime;
      resumeAnimationRef.current = () => undefined;
      stopBGM();
    };
  }, [handleTap, initStars]);

  // Helper for panel styling
  const panelStyle = { backgroundColor: 'hsl(var(--card) / 0.95)', backdropFilter: 'blur(20px)' };
  const btnPrimary = { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' };
  const btnSecondary = { backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' };

  const dailyMod = getDailyModifiers();
  const weeklyMod = getWeeklyModifiers();

  return (
    <div className="fixed inset-0 overflow-hidden bg-background" style={{ filter: settingsState.highContrast ? 'contrast(1.18) saturate(1.08)' : undefined }}>
      <canvas ref={backdropCanvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* HUD */}
      {screen === 'playing' && !gameRef.current.gameOver && (
        <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-4 pointer-events-none z-10">
          <div className="flex flex-col gap-1">
            <div className="font-display text-2xl font-bold text-glow" style={{ color: 'hsl(var(--primary))' }}>
              {uiState.score.toLocaleString()}
            </div>
            <div className="font-body text-xs uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Level {uiState.level} • {uiState.biome} {gameMode === 'daily' && '• DAILY'} {gameMode === 'weekly' && '• WEEKLY'}
            </div>
            {uiState.scoreMult && (
              <div className="font-display text-xs font-bold" style={{ color: 'hsl(var(--score-gold))' }}>
                {uiState.scoreMultiplier}x SCORE
              </div>
            )}
            {uiState.slowmo && (
              <div className="font-display text-xs font-bold" style={{ color: 'hsl(var(--secondary))' }}>⏱ SLOW-MO</div>
            )}
          </div>
          {uiState.combo > 1 && (
            <div className="font-display text-lg font-bold text-glow-blue animate-pulse" style={{ color: 'hsl(var(--secondary))' }}>
              {uiState.combo}x COMBO
            </div>
          )}
          <div className="flex flex-col items-end gap-1">
            <div className="font-body text-xs uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground))' }}>Chaos</div>
            <div className="w-24 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'hsl(var(--muted))' }}>
              <div className="h-full rounded-full transition-all duration-200" style={{
                width: `${uiState.chaos * 100}%`,
                backgroundColor: uiState.chaos > CHAOS_THRESHOLD ? 'hsl(var(--accent))' : 'hsl(var(--primary))',
                boxShadow: uiState.chaos > CHAOS_THRESHOLD ? '0 0 10px hsl(var(--accent) / 0.7)' : 'none',
              }} />
            </div>
          </div>
        </div>
      )}

      {screen === 'playing' && (
        <>
          <div className="absolute bottom-5 left-4 z-10 pointer-events-none space-y-1">
            {missions.map(mission => (
              <div key={mission.id} className="font-body text-[10px] rounded-full px-2 py-1" style={{
                backgroundColor: 'hsl(var(--card) / 0.76)',
                color: mission.complete ? 'hsl(var(--score-gold))' : 'hsl(var(--muted-foreground))',
              }}>{mission.complete ? '✓' : mission.icon} {mission.progress.toLocaleString()}/{mission.target.toLocaleString()} {mission.title}</div>
            ))}
          </div>
          <button aria-label="Activate Nova Pulse" className="nova-pulse absolute bottom-5 right-4 z-20 w-16 h-16 rounded-full font-display text-[10px] font-bold pointer-events-auto transition-all" style={{
            backgroundColor: uiState.pulseCooldown <= 0 ? 'hsl(190, 85%, 45% / 0.92)' : 'hsl(var(--muted) / 0.88)',
            color: 'hsl(var(--foreground))',
            border: `2px solid ${uiState.pulseCooldown <= 0 ? 'hsl(190, 95%, 75%)' : 'hsl(var(--border))'}`,
            boxShadow: uiState.pulseCooldown <= 0 ? '0 0 18px hsl(190, 90%, 60% / 0.65)' : 'none',
          }} onClick={(event) => { event.stopPropagation(); activatePulse(); }}>
            {uiState.pulseCooldown <= 0 ? 'NOVA\nPULSE' : `${Math.ceil(uiState.pulseCooldown / 1000)}s`}
          </button>
        </>
      )}

      {/* Event Banner */}
      {screen === 'playing' && uiState.eventText && (
        <div className="absolute top-14 left-0 right-0 flex justify-center pointer-events-none z-10">
          <div className="font-display text-sm font-bold px-4 py-1.5 rounded-full animate-pulse" style={{
            backgroundColor: 'hsl(var(--card) / 0.8)',
            color: uiState.eventText.includes('BOSS') ? 'hsl(300, 80%, 70%)' : 'hsl(40, 90%, 65%)',
            border: `1px solid ${uiState.eventText.includes('BOSS') ? 'hsl(300, 60%, 50%)' : 'hsl(40, 70%, 50%)'}`,
          }}>{uiState.eventText}</div>
        </div>
      )}

      {/* Boss HP */}
      {screen === 'playing' && uiState.showBossHp && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-10 flex flex-col items-center gap-1">
          {uiState.bossShieldPct > 0 && (
            <>
              <div className="font-display text-[10px] uppercase tracking-widest" style={{ color: 'hsl(195, 90%, 75%)' }}>Shield • target the gold weak point</div>
              <div className="w-40 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}>
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${uiState.bossShieldPct * 100}%`, background: 'hsl(195, 90%, 58%)' }} />
              </div>
            </>
          )}
          <div className="font-display text-[10px] uppercase tracking-widest" style={{ color: 'hsl(300, 70%, 75%)' }}>BOSS HP</div>
          <div className="w-40 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{
              width: `${uiState.bossHpPct * 100}%`,
              background: 'linear-gradient(90deg, hsl(300, 80%, 50%), hsl(340, 90%, 60%))',
              boxShadow: '0 0 8px hsl(300, 80%, 60% / 0.6)',
            }} />
          </div>
        </div>
      )}

      {/* Tutorial */}
      {screen === 'tutorial' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-6">
          <div className="w-full max-w-sm rounded-2xl p-8 text-center" style={panelStyle}>
            <div className="text-5xl mb-4">{TUTORIAL_STEPS[tutorialStep].icon}</div>
            <h2 className="font-display text-2xl font-black mb-3" style={{ color: 'hsl(var(--primary))' }}>{TUTORIAL_STEPS[tutorialStep].title}</h2>
            <p className="font-body text-sm leading-relaxed mb-6" style={{ color: 'hsl(var(--muted-foreground))' }}>{TUTORIAL_STEPS[tutorialStep].desc}</p>
            <div className="flex justify-center gap-2 mb-6">
              {TUTORIAL_STEPS.map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full transition-all" style={{
                  backgroundColor: i === tutorialStep ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                  transform: i === tutorialStep ? 'scale(1.3)' : 'scale(1)',
                }} />
              ))}
            </div>
            <button className="font-display text-sm px-8 py-3 rounded-lg w-full" style={btnPrimary}
              onClick={() => tutorialStep < TUTORIAL_STEPS.length - 1 ? setTutorialStep(tutorialStep + 1) : startGame('classic')}>
              {tutorialStep < TUTORIAL_STEPS.length - 1 ? 'NEXT' : 'LET\'S GO!'}
            </button>
            {tutorialStep < TUTORIAL_STEPS.length - 1 && (
              <button className="font-body text-xs mt-3 opacity-60" style={{ color: 'hsl(var(--muted-foreground))' }}
                onClick={() => startGame('classic')}>Skip tutorial</button>
            )}
          </div>
        </div>
      )}

      {/* Title Screen */}
      {screen === 'title' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-4 title-screen">
          <div className="title-orbit title-orbit-one" aria-hidden="true" />
          <div className="title-orbit title-orbit-two" aria-hidden="true" />
          <div className="title-card">
          <div className="title-kicker">ARCADE SURVIVAL</div>
          <h1 className="title-wordmark font-display text-5xl md:text-7xl font-black text-glow mb-1 tracking-tight" style={{ color: 'hsl(var(--foreground))' }}>METEOR</h1>
          <h2 className="title-wordmark-accent font-display text-3xl md:text-5xl font-bold text-glow-blue mb-3 tracking-[0.13em]" style={{ color: 'hsl(var(--secondary))' }}>SPLIT MANIA</h2>
          <p className="title-subtitle font-body text-sm mb-5" style={{ color: 'hsl(var(--muted-foreground))' }}>Tap. Split. Survive the chaos.</p>

          {/* Difficulty selector */}
          <div className="flex gap-2 mb-5 justify-center">
            {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => {
              const cfg = DIFFICULTY_CONFIGS[d];
              const active = difficulty === d;
              return (
                <button key={d} className="font-display text-xs px-4 py-2 rounded-lg pointer-events-auto transition-all" style={{
                  backgroundColor: active ? 'hsl(var(--primary))' : 'hsl(var(--card))',
                  color: active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                  border: `1px solid ${active ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                  transform: active ? 'scale(1.05)' : 'scale(1)',
                }} onClick={(e) => { e.stopPropagation(); setDifficulty(d); }}>
                  {cfg.icon} {cfg.label}
                </button>
              );
            })}
          </div>

          <p className="title-rule font-body text-xs mb-5 tracking-[0.12em]" style={{ color: 'hsl(var(--accent))' }}>PRECISION OVER PANIC</p>

          <button type="button" className="title-start font-display text-base cursor-pointer mb-3" onClick={enterClassicFromTitle}>
            TAP TO START
          </button>

          {uiState.highScore > 0 && (
            <div className="font-body text-sm mb-4" style={{ color: 'hsl(var(--score-gold))' }}>Best: {uiState.highScore.toLocaleString()}</div>
          )}

          <div className="title-nav">
            <button className="title-nav-item" onClick={() => setScreen('daily')}><CalendarDays size={17} strokeWidth={1.6} /><span>DAILY</span></button>
            <button className="title-nav-item" onClick={() => setScreen('weekly')}><CalendarDays size={17} strokeWidth={1.6} /><span>WEEKLY</span></button>
            <button className="title-nav-item" onClick={() => setScreen('leaderboard')}><Trophy size={17} strokeWidth={1.6} /><span>SCORES</span></button>
            <button className="title-nav-item" onClick={() => { refreshUnlocks(); setScreen('skins'); }}><Palette size={17} strokeWidth={1.6} /><span>SKINS</span></button>
            <button className="title-nav-item" onClick={() => { setTutorialStep(0); setScreen('tutorial'); }}><CircleHelp size={17} strokeWidth={1.6} /><span>HOW TO</span></button>
            <button className="title-nav-item" onClick={() => { setSettingsState(getSettings()); setScreen('settings'); }}><Settings2 size={17} strokeWidth={1.6} /><span>SETTINGS</span></button>
          </div>
          <div className="title-footer">TAP METEORS TO SPLIT • BUILD COMBOS • SURVIVE THE FIELD</div>
          </div>
        </div>
      )}

      {/* Game Over */}
      {screen === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <div className="px-8 py-10 rounded-2xl text-center" style={{ ...panelStyle, backgroundColor: 'hsl(var(--card) / 0.9)' }}>
            <h2 className="font-display text-4xl font-black mb-2" style={{ color: 'hsl(var(--accent))' }}>CHAOS OVERLOAD</h2>
            {gameMode === 'daily' && <div className="font-display text-xs mb-2" style={{ color: 'hsl(var(--secondary))' }}>📅 DAILY CHALLENGE</div>}
            {gameMode === 'weekly' && <div className="font-display text-xs mb-2" style={{ color: 'hsl(var(--secondary))' }}>🛰 WEEKLY GAUNTLET</div>}
            <div className="font-display text-5xl font-bold text-glow my-4" style={{ color: 'hsl(var(--primary))' }}>{uiState.score.toLocaleString()}</div>
            <p className="font-body text-sm mb-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Level {uiState.level} • {gameRef.current.maxCombo > 0 ? `Best combo: ${gameRef.current.maxCombo}x` : ''}
              {gameRef.current.bossDefeated > 0 ? ` • Bosses: ${gameRef.current.bossDefeated}` : ''}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4 text-left">
              <div className="rounded-lg p-2" style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}>
                <div className="font-display text-sm" style={{ color: 'hsl(var(--secondary))' }}>{gameRef.current.taps ? Math.round((gameRef.current.hits / gameRef.current.taps) * 100) : 0}%</div>
                <div className="font-body text-[10px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>Tap accuracy</div>
              </div>
              <div className="rounded-lg p-2" style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}>
                <div className="font-display text-sm" style={{ color: 'hsl(var(--secondary))' }}>{gameRef.current.meteorsDestroyed}</div>
                <div className="font-body text-[10px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>Fragments split</div>
              </div>
            </div>
            <div className="mt-4 text-left space-y-1">
              <div className="font-display text-[10px] uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground))' }}>Run missions</div>
              {missions.map(mission => <div key={mission.id} className="font-body text-[11px]" style={{ color: mission.complete ? 'hsl(var(--score-gold))' : 'hsl(var(--muted-foreground))' }}>{mission.complete ? '✓' : '○'} {mission.title}: {mission.progress.toLocaleString()}/{mission.target.toLocaleString()}</div>)}
            </div>
            {uiState.score >= uiState.highScore && uiState.score > 0 && (
              <p className="font-display text-sm mt-2" style={{ color: 'hsl(var(--score-gold))' }}>★ NEW HIGH SCORE ★</p>
            )}
            <div className="font-display text-base mt-6 animate-pulse" style={{ color: 'hsl(var(--foreground))' }}>TAP TO CONTINUE</div>
          </div>
        </div>
      )}

      {/* Daily Challenge Screen */}
      {screen === 'daily' && (
        <div className="absolute inset-0 flex flex-col items-center z-20 overflow-auto py-8 px-4">
          <div className="w-full max-w-md rounded-2xl p-6" style={panelStyle}>
            <h2 className="font-display text-2xl font-bold mb-1 text-center" style={{ color: 'hsl(var(--primary))' }}>📅 DAILY CHALLENGE</h2>
            <p className="font-body text-xs text-center mb-4" style={{ color: 'hsl(var(--muted-foreground))' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>

            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: 'hsl(var(--muted) / 0.4)' }}>
              <div className="font-display text-sm font-bold mb-1" style={{ color: 'hsl(var(--secondary))' }}>{dailyMod.name}</div>
              <p className="font-body text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{dailyMod.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4 text-center">
              <div className="rounded-lg p-2" style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}>
                <div className="font-display text-sm font-bold" style={{ color: 'hsl(var(--score-gold))' }}>{getDailyBestScore().toLocaleString()}</div>
                <div className="font-body text-[10px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>Best Today</div>
              </div>
              <div className="rounded-lg p-2" style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}>
                <div className="font-display text-sm font-bold" style={{ color: 'hsl(var(--secondary))' }}>{getDailyAttempts()}</div>
                <div className="font-body text-[10px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>Attempts</div>
              </div>
            </div>

            {dailyLeaderboard.length > 0 && (
              <div className="space-y-1 mb-4">
                <div className="font-display text-xs uppercase tracking-widest mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>Today's Scores</div>
                {dailyLeaderboard.slice(0, 5).map((entry, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg px-3 py-1.5" style={{ backgroundColor: i === 0 ? 'hsl(var(--muted) / 0.6)' : 'transparent' }}>
                    <span className="font-display text-sm font-bold" style={{ color: i === 0 ? 'hsl(var(--score-gold))' : 'hsl(var(--foreground))' }}>{entry.score.toLocaleString()}</span>
                    <span className="font-body text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Lv{entry.level}</span>
                  </div>
                ))}
              </div>
            )}

            <button className="w-full font-display text-sm px-6 py-3 rounded-lg mb-3" style={btnPrimary}
              onClick={() => startGame('daily')}>
              PLAY DAILY CHALLENGE
            </button>
            <button className="w-full font-display text-sm px-6 py-3 rounded-lg" style={btnSecondary}
              onClick={() => setScreen('title')}>BACK</button>
          </div>
        </div>
      )}

      {/* Weekly Challenge Screen */}
      {screen === 'weekly' && (
        <div className="absolute inset-0 flex flex-col items-center z-20 overflow-auto py-8 px-4">
          <div className="w-full max-w-md rounded-2xl p-6" style={panelStyle}>
            <h2 className="font-display text-2xl font-bold mb-1 text-center" style={{ color: 'hsl(var(--secondary))' }}>🛰 WEEKLY GAUNTLET</h2>
            <p className="font-body text-xs text-center mb-4" style={{ color: 'hsl(var(--muted-foreground))' }}>Week of {getWeekKey()} • Seed {weeklyMod.seed}</p>
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: 'hsl(var(--muted) / 0.4)' }}>
              <div className="font-display text-sm font-bold mb-1" style={{ color: 'hsl(var(--score-gold))' }}>{weeklyMod.name}</div>
              <p className="font-body text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{weeklyMod.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4 text-center">
              <div className="rounded-lg p-2" style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}>
                <div className="font-display text-sm font-bold" style={{ color: 'hsl(var(--score-gold))' }}>{getWeeklyBestScore().toLocaleString()}</div>
                <div className="font-body text-[10px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>Best This Week</div>
              </div>
              <div className="rounded-lg p-2" style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}>
                <div className="font-display text-sm font-bold" style={{ color: 'hsl(var(--secondary))' }}>{getWeeklyAttempts()}</div>
                <div className="font-body text-[10px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>Attempts</div>
              </div>
            </div>
            <div className="space-y-1 mb-4">
              <div className="font-display text-xs uppercase tracking-widest mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>Weekly Scores</div>
              {weeklyLeaderboard.length === 0 ? (
                <p className="font-body text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Set the first score for this week.</p>
              ) : weeklyLeaderboard.slice(0, 5).map((entry, index) => (
                <div key={`${entry.date}-${index}`} className="flex justify-between rounded-lg px-3 py-1.5" style={{ backgroundColor: index === 0 ? 'hsl(var(--muted) / 0.6)' : 'transparent' }}>
                  <span className="font-display text-sm" style={{ color: index === 0 ? 'hsl(var(--score-gold))' : 'hsl(var(--foreground))' }}>{entry.score.toLocaleString()}</span>
                  <span className="font-body text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Lv{entry.level}</span>
                </div>
              ))}
            </div>
            <button className="w-full font-display text-sm px-6 py-3 rounded-lg mb-3" style={btnPrimary} onClick={() => startGame('weekly')}>ENTER WEEKLY GAUNTLET</button>
            <button className="w-full font-display text-sm px-6 py-3 rounded-lg" style={btnSecondary} onClick={() => setScreen('title')}>BACK</button>
          </div>
        </div>
      )}

      {/* Skins & Themes Screen */}
      {screen === 'skins' && (
        <div className="absolute inset-0 flex flex-col items-center z-20 overflow-auto py-6 px-4">
          <div className="w-full max-w-md rounded-2xl p-5" style={panelStyle}>
            <h2 className="font-display text-xl font-bold mb-4 text-center" style={{ color: 'hsl(var(--primary))' }}>🎨 CUSTOMIZE</h2>

            {/* Meteor Skins */}
            <div className="font-display text-xs uppercase tracking-widest mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>Meteor Skins</div>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {METEOR_SKINS.map(skin => {
                const unlocked = skin.check(unlockStats);
                const active = selectedSkinId === skin.id;
                return (
                  <button key={skin.id} className="rounded-lg p-3 text-left pointer-events-auto transition-all" style={{
                    backgroundColor: active ? 'hsl(var(--primary) / 0.2)' : 'hsl(var(--muted) / 0.4)',
                    border: `1px solid ${active ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                    opacity: unlocked ? 1 : 0.5,
                  }} onClick={() => {
                    if (unlocked) { setSelectedSkinId(skin.id); setSelectedSkin(skin.id); }
                  }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{skin.icon}</span>
                      <span className="font-display text-xs font-bold" style={{ color: unlocked ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>{skin.name}</span>
                    </div>
                    <p className="font-body text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {unlocked ? skin.description : `🔒 ${skin.unlockCondition}`}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Visual Themes */}
            <div className="font-display text-xs uppercase tracking-widest mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>Visual Themes</div>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {VISUAL_THEMES.map(theme => {
                const unlocked = theme.check(unlockStats);
                const active = selectedThemeId === theme.id;
                return (
                  <button key={theme.id} className="rounded-lg p-3 text-left pointer-events-auto transition-all" style={{
                    backgroundColor: active ? 'hsl(var(--primary) / 0.2)' : 'hsl(var(--muted) / 0.4)',
                    border: `1px solid ${active ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                    opacity: unlocked ? 1 : 0.5,
                  }} onClick={() => {
                    if (unlocked) { setSelectedThemeId(theme.id); setSelectedTheme(theme.id); }
                  }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{theme.icon}</span>
                      <span className="font-display text-xs font-bold" style={{ color: unlocked ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>{theme.name}</span>
                    </div>
                    <p className="font-body text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {unlocked ? theme.description : `🔒 ${theme.unlockCondition}`}
                    </p>
                  </button>
                );
              })}
            </div>

            <button className="w-full font-display text-sm px-6 py-3 rounded-lg" style={btnPrimary}
              onClick={() => setScreen('title')}>BACK</button>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {screen === 'leaderboard' && (
        <div className="absolute inset-0 flex flex-col items-center z-20 overflow-auto py-8 px-4">
          <div className="w-full max-w-md rounded-2xl p-6" style={panelStyle}>
            <h2 className="font-display text-2xl font-bold mb-4 text-center" style={{ color: 'hsl(var(--primary))' }}>🏆 LEADERBOARD</h2>
            {stats && (
              <div className="grid grid-cols-3 gap-2 mb-6 text-center">
                {[
                  { label: 'Games', value: stats.gamesPlayed },
                  { label: 'Best', value: stats.bestScore.toLocaleString() },
                  { label: 'Avg', value: stats.avgScore.toLocaleString() },
                  { label: 'Meteors', value: stats.totalMeteors },
                  { label: 'Top Lvl', value: stats.bestLevel },
                  { label: 'Best Combo', value: `${stats.bestCombo}x` },
                ].map((s, i) => (
                  <div key={i} className="rounded-lg p-2" style={{ backgroundColor: 'hsl(var(--muted) / 0.5)' }}>
                    <div className="font-display text-sm font-bold" style={{ color: 'hsl(var(--secondary))' }}>{s.value}</div>
                    <div className="font-body text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
            {leaderboard.length === 0 ? (
              <p className="font-body text-sm text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>No games yet. Play to set a score!</p>
            ) : (
              <div className="space-y-1">
                {leaderboard.slice(0, 10).map((entry, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: i < 3 ? 'hsl(var(--muted) / 0.6)' : 'transparent' }}>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-sm w-6 text-center" style={{
                        color: i === 0 ? 'hsl(var(--score-gold))' : i === 1 ? 'hsl(210, 20%, 70%)' : i === 2 ? 'hsl(25, 60%, 55%)' : 'hsl(var(--muted-foreground))',
                      }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                      <div>
                        <span className="font-display text-sm font-bold" style={{ color: 'hsl(var(--foreground))' }}>{entry.score.toLocaleString()}</span>
                        <span className="font-body text-[10px] ml-2" style={{ color: 'hsl(var(--muted-foreground))' }}>Lv{entry.level} • {entry.maxCombo}x</span>
                      </div>
                    </div>
                    <span className="font-body text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{new Date(entry.date).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="mt-6 w-full font-display text-sm px-6 py-3 rounded-lg" style={btnPrimary}
              onClick={() => setScreen('title')}>BACK</button>
          </div>
        </div>
      )}

      {/* Settings */}
      {screen === 'settings' && (
        <div className="absolute inset-0 flex flex-col items-center z-20 overflow-auto py-8 px-4">
          <div className="w-full max-w-md rounded-2xl p-6" style={panelStyle}>
            <h2 className="font-display text-2xl font-bold mb-6 text-center" style={{ color: 'hsl(var(--primary))' }}>⚙ SETTINGS</h2>

            <div className="mb-6">
              <div className="font-display text-xs uppercase tracking-widest mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>Accessibility presets</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'standard', label: 'Standard', settings: { reducedMotion: false, highContrast: false, colorBlindMode: 'off' as const, uiScale: 1 } },
                  { id: 'focus', label: 'Focus', settings: { reducedMotion: false, highContrast: true, colorBlindMode: 'deuteranopia' as const, uiScale: 1.2 } },
                  { id: 'calm', label: 'Calm', settings: { reducedMotion: true, highContrast: true, colorBlindMode: 'off' as const, uiScale: 1.1 } },
                ].map(preset => {
                  const active = settingsState.reducedMotion === preset.settings.reducedMotion && settingsState.highContrast === preset.settings.highContrast && settingsState.colorBlindMode === preset.settings.colorBlindMode && settingsState.uiScale === preset.settings.uiScale;
                  return <button key={preset.id} className="rounded-lg px-2 py-2 font-display text-[10px]" style={{ backgroundColor: active ? 'hsl(var(--primary) / 0.25)' : 'hsl(var(--muted) / 0.45)', color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))', border: `1px solid ${active ? 'hsl(var(--primary))' : 'hsl(var(--border))'}` }} onClick={() => { setSettings(preset.settings); applyUiScale(preset.settings.uiScale); setSettingsState(getSettings()); }}>{preset.label}</button>;
                })}
              </div>
              <p className="font-body text-[10px] mt-2" style={{ color: 'hsl(var(--muted-foreground))' }}>Focus enlarges UI and boosts contrast. Calm reduces flashing and motion.</p>
            </div>

            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="font-display text-xs uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground))' }}>SFX Volume</span>
                <span className="font-display text-xs" style={{ color: 'hsl(var(--secondary))' }}>{Math.round(settingsState.sfxVolume * 100)}%</span>
              </div>
              <Slider value={[settingsState.sfxVolume * 100]} max={100} step={1}
                onValueChange={(v) => {
                  const vol = v[0] / 100;
                  setSettings({ sfxVolume: vol });
                  setSfxVolume(vol);
                  setSettingsState(getSettings());
                }} />
            </div>

            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="font-display text-xs uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground))' }}>Music Volume</span>
                <span className="font-display text-xs" style={{ color: 'hsl(var(--secondary))' }}>{Math.round(settingsState.musicVolume * 100)}%</span>
              </div>
              <Slider value={[settingsState.musicVolume * 100]} max={100} step={1}
                onValueChange={(v) => {
                  const vol = v[0] / 100;
                  setSettings({ musicVolume: vol });
                  setMusicVolume(vol);
                  setSettingsState(getSettings());
                }} />
            </div>

            <div className="flex items-center justify-between mb-8 rounded-lg p-3" style={{ backgroundColor: 'hsl(var(--muted) / 0.4)' }}>
              <div>
                <div className="font-display text-sm font-bold" style={{ color: 'hsl(var(--foreground))' }}>Haptic Feedback</div>
                <div className="font-body text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Vibrate on mobile devices</div>
              </div>
              <Switch checked={settingsState.hapticsEnabled}
                onCheckedChange={(c) => { setSettings({ hapticsEnabled: c }); setSettingsState(getSettings()); }} />
            </div>

            <div className="font-display text-xs uppercase tracking-widest mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
              🏅 Achievements ({allUnlocked.length}/{ACHIEVEMENTS.length})
            </div>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {ACHIEVEMENTS.map(a => {
                const unlocked = allUnlocked.includes(a.id);
                return (
                  <div key={a.id} className="rounded-lg p-2" style={{
                    backgroundColor: unlocked ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted) / 0.3)',
                    border: `1px solid ${unlocked ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--border))'}`,
                    opacity: unlocked ? 1 : 0.55,
                  }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{unlocked ? a.icon : '🔒'}</span>
                      <span className="font-display text-[11px] font-bold" style={{ color: 'hsl(var(--foreground))' }}>{a.title}</span>
                    </div>
                    <p className="font-body text-[9px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{a.description}</p>
                  </div>
                );
              })}
            </div>

            <button className="w-full font-display text-sm px-6 py-3 rounded-lg" style={btnPrimary}
              onClick={() => setScreen('title')}>BACK</button>
          </div>
        </div>
      )}

      {/* Achievement toasts */}
      {achievementToasts.length > 0 && (
        <div className="absolute top-20 right-4 z-30 flex flex-col gap-2 pointer-events-none">
          {achievementToasts.map(a => (
            <div key={a.id} className="rounded-lg px-4 py-3 flex items-center gap-3 animate-in slide-in-from-right" style={{
              backgroundColor: 'hsl(var(--card) / 0.95)',
              border: '1px solid hsl(var(--primary))',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 4px 20px hsl(var(--primary) / 0.4)',
              minWidth: 220,
            }}>
              <div className="text-2xl">{a.icon}</div>
              <div>
                <div className="font-display text-[10px] uppercase tracking-widest" style={{ color: 'hsl(var(--score-gold))' }}>Achievement</div>
                <div className="font-display text-sm font-bold" style={{ color: 'hsl(var(--foreground))' }}>{a.title}</div>
                <div className="font-body text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{a.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
