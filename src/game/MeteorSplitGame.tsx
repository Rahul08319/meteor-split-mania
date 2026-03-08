import { useRef, useEffect, useCallback, useState } from 'react';
import { Meteor, Particle, Star, GameState, PowerUp, PowerUpType } from './types';
import { playSplit, playDestroy, playChaos, playCombo, playChaosOverload, playPowerUp, playBossHit, playBossDefeat, playShowerWarning, resumeAudio, startBGM, updateBGMChaos, stopBGM } from './sounds';
import { addLeaderboardEntry, getLeaderboard, getStats } from './leaderboard';
import { Difficulty, DIFFICULTY_CONFIGS, DifficultyConfig } from './difficulty';
import { getDailySeed, getDailyModifiers, getDailyLeaderboard, addDailyEntry, getDailyAttempts, getDailyBestScore, SeededRNG, DailyModifiers } from './daily';
import { METEOR_SKINS, VISUAL_THEMES, MeteorSkin, VisualTheme, getSelectedSkin, setSelectedSkin, getSelectedTheme, setSelectedTheme, getUnlockStats, addBossDefeat, MeteorSkinId, ThemeId, UnlockStats } from './skins';

const MAX_METEORS = 60;
const CHAOS_THRESHOLD = 0.7;
const COMBO_TIMEOUT = 2000;
const POWERUP_DURATION = 5000;
const EVENT_INTERVAL_LEVELS = 3;
const SHOWER_DURATION = 6000;
const TUTORIAL_KEY = 'meteorSplit_tutorialSeen';

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
    radius: 70 + level * 3, rotation: 0, rotationSpeed: 0.005,
    generation: 0, opacity: 1, hue: 300, tapCount: 0,
    vertices: createVertices(12), trail: [],
    isBoss: true, bossHp: hp, bossMaxHp: hp,
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

type Screen = 'title' | 'playing' | 'gameover' | 'leaderboard' | 'tutorial' | 'settings' | 'daily' | 'skins';
type GameMode = 'classic' | 'daily';

interface TutorialStep { title: string; desc: string; icon: string; }
const TUTORIAL_STEPS: TutorialStep[] = [
  { title: 'TAP TO SPLIT', desc: 'Tap meteors to break them into smaller pieces. Smaller = more points!', icon: '☄️' },
  { title: 'WATCH THE CHAOS', desc: 'Over-tapping the same meteor fills your Chaos Meter. Hit 100% and it\'s game over!', icon: '⚠️' },
  { title: 'COLLECT POWER-UPS', desc: 'Destroyed meteors drop power-ups: Slow-Mo ⏱, Chaos Reduce 💚, Score Boost ⭐', icon: '✨' },
  { title: 'SURVIVE EVENTS', desc: 'Meteor Showers rain down fast! Boss Meteors need multiple hits to defeat.', icon: '💥' },
];

export default function MeteorSplitGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>({
    score: 0, level: 1, meteorsDestroyed: 0, chaosLevel: 0,
    gameOver: false, started: false,
    highScore: parseInt(localStorage.getItem('meteorSplitHigh') || '0'),
    combo: 0, comboTimer: 0, screenShake: 0, maxCombo: 0,
    slowmoTimer: 0, scoreMultiTimer: 0, scoreMultiplier: 1,
    specialEvent: null, lastEventLevel: 0, bossDefeated: 0,
  });
  const meteorsRef = useRef<Meteor[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const powerupsRef = useRef<PowerUp[]>([]);
  const spawnTimerRef = useRef(0);
  const showerTimerRef = useRef(0);
  const animRef = useRef(0);

  const [screen, setScreen] = useState<Screen>('title');
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
    eventText: '', bossHpPct: 0, showBossHp: false,
  });
  const [leaderboard, setLeaderboard] = useState(getLeaderboard());
  const [stats, setStats] = useState(getStats());
  const [dailyLeaderboard, setDailyLeaderboard] = useState(getDailyLeaderboard());
  const [unlockStats, setUnlockStats] = useState<UnlockStats>(getUnlockStats(getStats()));

  const hasSeenTutorial = useRef(localStorage.getItem(TUTORIAL_KEY) === '1');

  // Refresh unlock stats
  const refreshUnlocks = useCallback(() => {
    const s = getStats();
    setStats(s);
    setUnlockStats(getUnlockStats(s));
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

  const splitMeteor = useCallback((meteor: Meteor) => {
    const game = gameRef.current;
    const canvas = canvasRef.current;
    const cfg = diffConfigRef.current;
    const skin = activeSkinRef.current;
    if (!canvas) return;

    // Boss
    if (meteor.isBoss && meteor.bossHp !== undefined) {
      meteor.bossHp--;
      meteor.tapCount++;
      game.screenShake = Math.min(game.screenShake + 4, 12);
      addParticles(meteor.x, meteor.y, 10, 300, 'spark');
      playBossHit();

      if (meteor.bossHp <= 0) {
        meteorsRef.current = meteorsRef.current.filter(m => m.id !== meteor.id);
        addParticles(meteor.x, meteor.y, 40, 300, 'spark');
        addParticles(meteor.x, meteor.y, 20, 50, 'debris');
        game.score += Math.round(500 * game.scoreMultiplier * cfg.scoreMultiplier);
        game.bossDefeated++;
        game.screenShake = 15;
        game.specialEvent = null;
        playBossDefeat();
        const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
        powerupsRef.current.push({ id: genId(), x: meteor.x, y: meteor.y, vy: 0.2, type, life: 8000, radius: 18, pulse: 0 });
      }
      return;
    }

    meteor.tapCount++;
    const mult = game.scoreMultiplier * cfg.scoreMultiplier * (dailyModRef.current?.bonusScoreMult ?? 1);

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
      if (game.combo > 2) playCombo(game.combo);
      maybeSpawnPowerUp(meteor.x, meteor.y, powerupsRef.current, cfg.powerUpDropChance);
      return;
    }

    if (meteor.tapCount > 1 && meteor.generation < 2) {
      const chaosMult = dailyModRef.current?.chaosMult ?? 1;
      game.chaosLevel = Math.min(1, game.chaosLevel + cfg.chaosPerOverTap * chaosMult);
      game.screenShake = Math.min(game.screenShake + 5, 15);
      addParticles(meteor.x, meteor.y, 20, 0, 'chaos');
      playChaos();
      const count = 3 + Math.floor(Math.random() * 3);
      meteorsRef.current = meteorsRef.current.filter(m => m.id !== meteor.id);
      if (meteorsRef.current.length < MAX_METEORS) {
        for (let i = 0; i < count; i++) {
          const nm = createMeteor(meteor.x + (Math.random() - 0.5) * 30, meteor.y + (Math.random() - 0.5) * 30, meteor.generation + 1, canvas.width, canvas.height, skin);
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
      for (let i = 0; i < 2; i++) {
        if (meteorsRef.current.length < MAX_METEORS) {
          const nm = createMeteor(meteor.x + (Math.random() - 0.5) * 20, meteor.y + (Math.random() - 0.5) * 20, meteor.generation + 1, canvas.width, canvas.height, skin);
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
    }

    const prevLevel = game.level;
    if (game.meteorsDestroyed > 0 && game.meteorsDestroyed % 15 === 0) {
      game.level = Math.min(20, game.level + 1);
    }

    const eventStart = dailyModRef.current?.specialStartLevel ?? 3;
    if (game.level > prevLevel && game.level - game.lastEventLevel >= EVENT_INTERVAL_LEVELS && game.level >= eventStart) {
      triggerSpecialEvent(canvas.width, canvas.height);
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
      const entry = {
        score: game.score, level: game.level,
        meteorsDestroyed: game.meteorsDestroyed, maxCombo: game.maxCombo,
        date: new Date().toISOString(),
      };
      if (gameMode === 'daily') {
        addDailyEntry(entry);
        setDailyLeaderboard(getDailyLeaderboard());
      } else {
        addLeaderboardEntry(entry);
        setLeaderboard(getLeaderboard());
      }
      refreshUnlocks();
      addParticles(canvas.width / 2, canvas.height / 2, 50, 0, 'chaos');
      setScreen('gameover');
    }
  }, [triggerSpecialEvent, gameMode, refreshUnlocks]);

  const collectPowerUp = useCallback((pu: PowerUp) => {
    const game = gameRef.current;
    powerupsRef.current = powerupsRef.current.filter(p => p.id !== pu.id);
    playPowerUp();
    addParticles(pu.x, pu.y, 15, POWERUP_COLORS[pu.type], 'spark');
    switch (pu.type) {
      case 'slowmo': game.slowmoTimer = POWERUP_DURATION; break;
      case 'chaos_reduce': game.chaosLevel = Math.max(0, game.chaosLevel - 0.3); game.screenShake = Math.min(game.screenShake + 3, 8); break;
      case 'score_multi': game.scoreMultiTimer = POWERUP_DURATION; game.scoreMultiplier = 3; break;
    }
  }, []);

  const startGame = useCallback((mode: GameMode = 'classic') => {
    const game = gameRef.current;
    const cfg = DIFFICULTY_CONFIGS[difficulty];
    diffConfigRef.current = cfg;
    activeSkinRef.current = METEOR_SKINS.find(s => s.id === selectedSkinId) || METEOR_SKINS[0];
    activeThemeRef.current = VISUAL_THEMES.find(t => t.id === selectedThemeId) || VISUAL_THEMES[0];

    setGameMode(mode);
    if (mode === 'daily') {
      dailyModRef.current = getDailyModifiers();
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
    meteorsRef.current = [];
    particlesRef.current = [];
    powerupsRef.current = [];
    spawnTimerRef.current = 0;
    showerTimerRef.current = 0;
    startBGM();
    setScreen('playing');
  }, [difficulty, selectedSkinId, selectedThemeId]);

  const handleTap = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const game = gameRef.current;
    if (!canvas) return;
    resumeAudio();

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    if (!game.started) {
      if (!hasSeenTutorial.current) {
        hasSeenTutorial.current = true;
        localStorage.setItem(TUTORIAL_KEY, '1');
        setTutorialStep(0);
        setScreen('tutorial');
        return;
      }
      startGame('classic');
      return;
    }

    if (game.gameOver) {
      game.started = false;
      setScreen('title');
      return;
    }

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

    if (closest) splitMeteor(closest);
    else game.combo = 0;
  }, [splitMeteor, collectPowerUp, startGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars(canvas.width, canvas.height);
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

    const loop = (now: number) => {
      const rawDt = Math.min(now - lastTime, 50);
      lastTime = now;
      const game = gameRef.current;
      const w = canvas.width;
      const h = canvas.height;
      const cfg = diffConfigRef.current;
      const skin = activeSkinRef.current;
      const theme = activeThemeRef.current;
      const dailyMod = dailyModRef.current;

      const timeScale = game.slowmoTimer > 0 ? 0.4 : 1;
      const dt = rawDt * timeScale;

      if (game.started && !game.gameOver) {
        // Spawn
        spawnTimerRef.current -= rawDt;
        if (spawnTimerRef.current <= 0) {
          const spawnMult = dailyMod?.spawnRateMult ?? 1;
          const interval = Math.max(cfg.spawnIntervalMin, cfg.spawnIntervalBase - game.level * cfg.spawnIntervalPerLevel) / spawnMult;
          spawnTimerRef.current = interval;
          const count = Math.min(3, 1 + Math.floor(game.level / 3));
          meteorsRef.current.push(...spawnMeteorsAtEdge(count, 0, w, h, skin, cfg.meteorSpeedMult));
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

      // === DRAW ===
      const shake = game.screenShake;
      const sx = shake > 0.5 ? (Math.random() - 0.5) * shake : 0;
      const sy = shake > 0.5 ? (Math.random() - 0.5) * shake : 0;
      ctx.save();
      ctx.translate(sx, sy);

      // Background with theme
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, `hsl(${theme.bgGradient[0]})`);
      grad.addColorStop(0.5, `hsl(${theme.bgGradient[1]})`);
      grad.addColorStop(1, `hsl(${theme.bgGradient[2]})`);
      ctx.fillStyle = grad;
      ctx.fillRect(-10, -10, w + 20, h + 20);

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
          const trailHue = m.isBoss ? 300 : m.hue;
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
          const bPulse = 1 + Math.sin(now * 0.004) * 0.15;
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
        } else {
          const glowGrad = ctx.createRadialGradient(0, 0, m.radius * 0.2, 0, 0, m.radius * 2);
          glowGrad.addColorStop(0, `hsla(${m.hue}, 80%, 60%, ${skin.glowIntensity})`);
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
          bodyGrad.addColorStop(0, `hsl(${m.hue}, 60%, 50%)`);
          bodyGrad.addColorStop(0.6, `hsl(${m.hue}, 50%, 30%)`);
          bodyGrad.addColorStop(1, `hsl(${m.hue}, 40%, 15%)`);
          ctx.fillStyle = bodyGrad;
          ctx.fill();
          ctx.strokeStyle = `hsla(${m.hue}, 70%, 65%, 0.6)`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          for (let i = 0; i < 3; i++) {
            const cx2 = Math.sin(i * 2.1 + m.id.charCodeAt(1)) * m.radius * 0.4;
            const cy2 = Math.cos(i * 3.7 + m.id.charCodeAt(1)) * m.radius * 0.4;
            ctx.beginPath();
            ctx.arc(cx2, cy2, m.radius * 0.12, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${m.hue}, 30%, 20%, 0.5)`;
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
      let bossHpPct = 0, showBossHp = false;
      if (game.specialEvent?.type === 'boss_meteor') {
        const boss = meteorsRef.current.find(m => m.isBoss);
        if (boss?.bossHp !== undefined && boss.bossMaxHp) {
          bossHpPct = boss.bossHp / boss.bossMaxHp;
          showBossHp = true;
        }
      }

      let eventText = '';
      if (game.specialEvent?.type === 'meteor_shower' && game.specialEvent.active) eventText = '☄️ METEOR SHOWER!';
      else if (game.specialEvent?.type === 'boss_meteor' && game.specialEvent.active) eventText = '👾 BOSS METEOR!';

      setUiState({
        score: game.score, level: game.level, chaos: game.chaosLevel,
        highScore: game.highScore, combo: game.combo,
        slowmo: game.slowmoTimer > 0, scoreMult: game.scoreMultiTimer > 0,
        scoreMultiplier: game.scoreMultiplier, eventText, bossHpPct, showBossHp,
      });

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('mousedown', onClick);
      stopBGM();
    };
  }, [handleTap, initStars]);

  // Helper for panel styling
  const panelStyle = { backgroundColor: 'hsl(var(--card) / 0.95)', backdropFilter: 'blur(20px)' };
  const btnPrimary = { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' };
  const btnSecondary = { backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' };

  const dailyMod = getDailyModifiers();

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* HUD */}
      {screen === 'playing' && !gameRef.current.gameOver && (
        <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-4 pointer-events-none z-10">
          <div className="flex flex-col gap-1">
            <div className="font-display text-2xl font-bold text-glow" style={{ color: 'hsl(var(--primary))' }}>
              {uiState.score.toLocaleString()}
            </div>
            <div className="font-body text-xs uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Level {uiState.level} {gameMode === 'daily' && '• DAILY'}
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
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-4">
          <h1 className="font-display text-5xl md:text-7xl font-black text-glow mb-2" style={{ color: 'hsl(var(--primary))' }}>METEOR</h1>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-glow-blue mb-4" style={{ color: 'hsl(var(--secondary))' }}>SPLIT</h2>

          {/* Difficulty selector */}
          <div className="flex gap-2 mb-6">
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

          <p className="font-body text-xs mb-6" style={{ color: 'hsl(var(--accent))' }}>⚠ Over-tapping creates chaos!</p>

          <div className="font-display text-lg animate-pulse cursor-pointer mb-2" style={{ color: 'hsl(var(--foreground))' }}>TAP TO START</div>

          {uiState.highScore > 0 && (
            <div className="font-body text-sm mb-4" style={{ color: 'hsl(var(--score-gold))' }}>Best: {uiState.highScore.toLocaleString()}</div>
          )}

          <div className="flex flex-wrap gap-2 justify-center mt-2">
            <button className="font-display text-xs px-4 py-2 rounded-lg pointer-events-auto" style={btnSecondary}
              onClick={(e) => { e.stopPropagation(); setScreen('daily'); }}>📅 DAILY</button>
            <button className="font-display text-xs px-4 py-2 rounded-lg pointer-events-auto" style={btnSecondary}
              onClick={(e) => { e.stopPropagation(); setScreen('leaderboard'); }}>🏆 SCORES</button>
            <button className="font-display text-xs px-4 py-2 rounded-lg pointer-events-auto" style={btnSecondary}
              onClick={(e) => { e.stopPropagation(); refreshUnlocks(); setScreen('skins'); }}>🎨 SKINS</button>
            <button className="font-display text-xs px-4 py-2 rounded-lg pointer-events-auto" style={btnSecondary}
              onClick={(e) => { e.stopPropagation(); setTutorialStep(0); setScreen('tutorial'); }}>❓ HOW TO</button>
          </div>
        </div>
      )}

      {/* Game Over */}
      {screen === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <div className="px-8 py-10 rounded-2xl text-center" style={{ ...panelStyle, backgroundColor: 'hsl(var(--card) / 0.9)' }}>
            <h2 className="font-display text-4xl font-black mb-2" style={{ color: 'hsl(var(--accent))' }}>CHAOS OVERLOAD</h2>
            {gameMode === 'daily' && <div className="font-display text-xs mb-2" style={{ color: 'hsl(var(--secondary))' }}>📅 DAILY CHALLENGE</div>}
            <div className="font-display text-5xl font-bold text-glow my-4" style={{ color: 'hsl(var(--primary))' }}>{uiState.score.toLocaleString()}</div>
            <p className="font-body text-sm mb-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Level {uiState.level} • {gameRef.current.maxCombo > 0 ? `Best combo: ${gameRef.current.maxCombo}x` : ''}
              {gameRef.current.bossDefeated > 0 ? ` • Bosses: ${gameRef.current.bossDefeated}` : ''}
            </p>
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
    </div>
  );
}
