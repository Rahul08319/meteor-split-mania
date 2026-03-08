import { useRef, useEffect, useCallback, useState } from 'react';
import { Meteor, Particle, Star, GameState, PowerUp, PowerUpType } from './types';
import { playSplit, playDestroy, playChaos, playCombo, playChaosOverload, playPowerUp, resumeAudio } from './sounds';
import { addLeaderboardEntry, getLeaderboard, getStats } from './leaderboard';

const MAX_METEORS = 60;
const CHAOS_THRESHOLD = 0.7;
const COMBO_TIMEOUT = 2000;
const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5000;

let idCounter = 0;
const genId = () => `m${++idCounter}`;

const createVertices = (n: number): number[] => {
  const verts: number[] = [];
  for (let i = 0; i < n; i++) {
    verts.push(0.7 + Math.random() * 0.6);
  }
  return verts;
};

const createMeteor = (x: number, y: number, gen: number, canvasW: number, canvasH: number): Meteor => {
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
    hue: gen === 0 ? 25 : gen === 1 ? 35 : gen === 2 ? 200 : 0,
    tapCount: 0,
    vertices: createVertices(8 + Math.floor(Math.random() * 5)),
    trail: [],
  };
};

const spawnMeteorsAtEdge = (count: number, gen: number, w: number, h: number): Meteor[] => {
  const meteors: Meteor[] = [];
  for (let i = 0; i < count; i++) {
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    if (side === 0) { x = Math.random() * w; y = -50; }
    else if (side === 1) { x = w + 50; y = Math.random() * h; }
    else if (side === 2) { x = Math.random() * w; y = h + 50; }
    else { x = -50; y = Math.random() * h; }
    const m = createMeteor(x, y, gen, w, h);
    const cx = w / 2 + (Math.random() - 0.5) * w * 0.5;
    const cy = h / 2 + (Math.random() - 0.5) * h * 0.5;
    const a = Math.atan2(cy - y, cx - x);
    const spd = 0.5 + Math.random() * 0.8;
    m.vx = Math.cos(a) * spd;
    m.vy = Math.sin(a) * spd;
    meteors.push(m);
  }
  return meteors;
};

const POWERUP_TYPES: PowerUpType[] = ['slowmo', 'chaos_reduce', 'score_multi'];
const POWERUP_COLORS: Record<PowerUpType, number> = { slowmo: 180, chaos_reduce: 120, score_multi: 50 };
const POWERUP_LABELS: Record<PowerUpType, string> = { slowmo: '⏱', chaos_reduce: '💚', score_multi: '⭐' };

const maybeSpawnPowerUp = (x: number, y: number, powerups: PowerUp[]) => {
  if (Math.random() < POWERUP_DROP_CHANCE && powerups.length < 3) {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerups.push({
      id: genId(),
      x, y,
      vy: 0.3 + Math.random() * 0.3,
      type,
      life: 6000,
      radius: 14,
      pulse: 0,
    });
  }
};

type Screen = 'title' | 'playing' | 'gameover' | 'leaderboard';

export default function MeteorSplitGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState>({
    score: 0, level: 1, meteorsDestroyed: 0, chaosLevel: 0,
    gameOver: false, started: false,
    highScore: parseInt(localStorage.getItem('meteorSplitHigh') || '0'),
    combo: 0, comboTimer: 0, screenShake: 0, maxCombo: 0,
    slowmoTimer: 0, scoreMultiTimer: 0, scoreMultiplier: 1,
  });
  const meteorsRef = useRef<Meteor[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const powerupsRef = useRef<PowerUp[]>([]);
  const spawnTimerRef = useRef(0);
  const animRef = useRef(0);
  const [screen, setScreen] = useState<Screen>('title');
  const [uiState, setUiState] = useState({
    score: 0, level: 1, chaos: 0, highScore: gameRef.current.highScore, combo: 0,
    slowmo: false, scoreMult: false, scoreMultiplier: 1,
  });
  const [leaderboard, setLeaderboard] = useState(getLeaderboard());
  const [stats, setStats] = useState(getStats());

  const initStars = useCallback((w: number, h: number) => {
    const stars: Star[] = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * w, y: Math.random() * h,
        size: Math.random() * 2 + 0.5,
        brightness: Math.random(),
        twinkleSpeed: 0.5 + Math.random() * 2,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }
    starsRef.current = stars;
  }, []);

  const addParticles = (x: number, y: number, count: number, hue: number, type: 'spark' | 'debris' | 'chaos') => {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = type === 'chaos' ? 2 + Math.random() * 5 : 1 + Math.random() * 3;
      particlesRef.current.push({
        x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        life: 1, maxLife: 0.5 + Math.random() * 0.8,
        size: type === 'chaos' ? 3 + Math.random() * 4 : 1 + Math.random() * 3,
        hue, type,
      });
    }
  };

  const splitMeteor = useCallback((meteor: Meteor) => {
    const game = gameRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    meteor.tapCount++;
    const mult = game.scoreMultiplier;

    if (meteor.generation >= 3) {
      meteorsRef.current = meteorsRef.current.filter(m => m.id !== meteor.id);
      addParticles(meteor.x, meteor.y, 8, 200, 'spark');
      game.score += Math.round(50 * (game.combo + 1) * mult);
      game.meteorsDestroyed++;
      game.combo++;
      game.maxCombo = Math.max(game.maxCombo, game.combo);
      game.comboTimer = COMBO_TIMEOUT;
      game.screenShake = Math.min(game.screenShake + 2, 8);
      playDestroy();
      if (game.combo > 2) playCombo(game.combo);
      maybeSpawnPowerUp(meteor.x, meteor.y, powerupsRef.current);
      return;
    }

    if (meteor.tapCount > 1 && meteor.generation < 2) {
      game.chaosLevel = Math.min(1, game.chaosLevel + 0.15);
      game.screenShake = Math.min(game.screenShake + 5, 15);
      addParticles(meteor.x, meteor.y, 20, 0, 'chaos');
      playChaos();
      const count = 3 + Math.floor(Math.random() * 3);
      meteorsRef.current = meteorsRef.current.filter(m => m.id !== meteor.id);
      if (meteorsRef.current.length < MAX_METEORS) {
        for (let i = 0; i < count; i++) {
          const nm = createMeteor(
            meteor.x + (Math.random() - 0.5) * 30,
            meteor.y + (Math.random() - 0.5) * 30,
            meteor.generation + 1, canvas.width, canvas.height
          );
          const a = Math.random() * Math.PI * 2;
          const spd = 1.5 + Math.random() * 2;
          nm.vx = Math.cos(a) * spd;
          nm.vy = Math.sin(a) * spd;
          nm.hue = 0;
          meteorsRef.current.push(nm);
        }
      }
      game.score += Math.round(10 * mult);
    } else {
      meteorsRef.current = meteorsRef.current.filter(m => m.id !== meteor.id);
      addParticles(meteor.x, meteor.y, 12, meteor.hue, 'spark');
      addParticles(meteor.x, meteor.y, 5, meteor.hue, 'debris');
      playSplit(meteor.generation);
      const count = 2;
      for (let i = 0; i < count; i++) {
        if (meteorsRef.current.length < MAX_METEORS) {
          const nm = createMeteor(
            meteor.x + (Math.random() - 0.5) * 20,
            meteor.y + (Math.random() - 0.5) * 20,
            meteor.generation + 1, canvas.width, canvas.height
          );
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
      maybeSpawnPowerUp(meteor.x, meteor.y, powerupsRef.current);
    }

    if (game.meteorsDestroyed > 0 && game.meteorsDestroyed % 15 === 0) {
      game.level = Math.min(10, game.level + 1);
    }

    if (game.chaosLevel >= 1) {
      game.gameOver = true;
      playChaosOverload();
      if (game.score > game.highScore) {
        game.highScore = game.score;
        localStorage.setItem('meteorSplitHigh', String(game.score));
      }
      addLeaderboardEntry({
        score: game.score, level: game.level,
        meteorsDestroyed: game.meteorsDestroyed, maxCombo: game.maxCombo,
        date: new Date().toISOString(),
      });
      setLeaderboard(getLeaderboard());
      setStats(getStats());
      addParticles(canvas.width / 2, canvas.height / 2, 50, 0, 'chaos');
      setScreen('gameover');
    }
  }, []);

  const collectPowerUp = useCallback((pu: PowerUp) => {
    const game = gameRef.current;
    powerupsRef.current = powerupsRef.current.filter(p => p.id !== pu.id);
    playPowerUp();
    addParticles(pu.x, pu.y, 15, POWERUP_COLORS[pu.type], 'spark');

    switch (pu.type) {
      case 'slowmo':
        game.slowmoTimer = POWERUP_DURATION;
        break;
      case 'chaos_reduce':
        game.chaosLevel = Math.max(0, game.chaosLevel - 0.3);
        game.screenShake = Math.min(game.screenShake + 3, 8);
        break;
      case 'score_multi':
        game.scoreMultiTimer = POWERUP_DURATION;
        game.scoreMultiplier = 3;
        break;
    }
  }, []);

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
      meteorsRef.current = [];
      particlesRef.current = [];
      powerupsRef.current = [];
      spawnTimerRef.current = 0;
      setScreen('playing');
      return;
    }

    if (game.gameOver) {
      game.started = false;
      setScreen('title');
      return;
    }

    // Check power-up collection
    for (const pu of powerupsRef.current) {
      const d = Math.hypot(pu.x - x, pu.y - y);
      if (d < pu.radius * 2) {
        collectPowerUp(pu);
        return;
      }
    }

    // Find tapped meteor
    let closest: Meteor | null = null;
    let closestDist = Infinity;
    for (const m of meteorsRef.current) {
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < m.radius * 1.3 && d < closestDist) {
        closest = m;
        closestDist = d;
      }
    }

    if (closest) {
      splitMeteor(closest);
    } else {
      game.combo = 0;
    }
  }, [splitMeteor, collectPowerUp]);

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

      const timeScale = game.slowmoTimer > 0 ? 0.4 : 1;
      const dt = rawDt * timeScale;

      if (game.started && !game.gameOver) {
        // Spawn
        spawnTimerRef.current -= rawDt; // spawn on real time
        if (spawnTimerRef.current <= 0) {
          const interval = Math.max(800, 3000 - game.level * 250);
          spawnTimerRef.current = interval;
          const count = Math.min(3, 1 + Math.floor(game.level / 3));
          meteorsRef.current.push(...spawnMeteorsAtEdge(count, 0, w, h));
        }

        // Combo timer
        if (game.comboTimer > 0) {
          game.comboTimer -= rawDt;
          if (game.comboTimer <= 0) game.combo = 0;
        }

        // Power-up timers
        if (game.slowmoTimer > 0) {
          game.slowmoTimer -= rawDt;
        }
        if (game.scoreMultiTimer > 0) {
          game.scoreMultiTimer -= rawDt;
          if (game.scoreMultiTimer <= 0) game.scoreMultiplier = 1;
        }

        // Chaos decay
        game.chaosLevel = Math.max(0, game.chaosLevel - 0.0001 * dt);

        // Screen shake decay
        game.screenShake *= 0.92;

        // Update meteors
        for (const m of meteorsRef.current) {
          m.x += m.vx * dt * 0.06;
          m.y += m.vy * dt * 0.06;
          m.rotation += m.rotationSpeed * dt * 0.06;

          m.trail.push({ x: m.x, y: m.y, age: 0 });
          if (m.trail.length > 8) m.trail.shift();
          for (const t of m.trail) t.age += dt * 0.001;

          if (m.x < -m.radius * 2) m.x = w + m.radius;
          if (m.x > w + m.radius * 2) m.x = -m.radius;
          if (m.y < -m.radius * 2) m.y = h + m.radius;
          if (m.y > h + m.radius * 2) m.y = -m.radius;
        }

        // Update power-ups
        for (let i = powerupsRef.current.length - 1; i >= 0; i--) {
          const pu = powerupsRef.current[i];
          pu.y += pu.vy * dt * 0.06;
          pu.life -= rawDt;
          pu.pulse += rawDt * 0.005;
          if (pu.life <= 0 || pu.y > h + 30) {
            powerupsRef.current.splice(i, 1);
          }
        }
      }

      // Update particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx * dt * 0.06;
        p.y += p.vy * dt * 0.06;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= dt * 0.001 / p.maxLife;
        if (p.life <= 0) particlesRef.current.splice(i, 1);
      }

      // Draw
      const shake = game.screenShake;
      const sx = shake > 0.5 ? (Math.random() - 0.5) * shake : 0;
      const sy = shake > 0.5 ? (Math.random() - 0.5) * shake : 0;

      ctx.save();
      ctx.translate(sx, sy);

      // Background
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'hsl(240, 30%, 3%)');
      grad.addColorStop(0.5, 'hsl(260, 25%, 5%)');
      grad.addColorStop(1, 'hsl(240, 20%, 4%)');
      ctx.fillStyle = grad;
      ctx.fillRect(-10, -10, w + 20, h + 20);

      // Chaos overlay
      if (game.chaosLevel > 0.3) {
        ctx.fillStyle = `hsla(0, 80%, 20%, ${(game.chaosLevel - 0.3) * 0.3})`;
        ctx.fillRect(-10, -10, w + 20, h + 20);
      }

      // Slow-mo overlay
      if (game.slowmoTimer > 0) {
        ctx.fillStyle = `hsla(200, 80%, 30%, 0.08)`;
        ctx.fillRect(-10, -10, w + 20, h + 20);
      }

      // Stars
      const t = now * 0.001;
      for (const s of starsRef.current) {
        const b = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinkleOffset));
        ctx.fillStyle = `rgba(255,255,255,${b * s.brightness})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }

      // Meteor trails
      for (const m of meteorsRef.current) {
        if (m.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(m.trail[0].x, m.trail[0].y);
          for (let i = 1; i < m.trail.length; i++) {
            ctx.lineTo(m.trail[i].x, m.trail[i].y);
          }
          ctx.strokeStyle = `hsla(${m.hue}, 80%, 60%, 0.15)`;
          ctx.lineWidth = m.radius * 0.5;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }

      // Meteors
      for (const m of meteorsRef.current) {
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.rotation);

        const glowGrad = ctx.createRadialGradient(0, 0, m.radius * 0.2, 0, 0, m.radius * 2);
        glowGrad.addColorStop(0, `hsla(${m.hue}, 80%, 60%, 0.3)`);
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(-m.radius * 2, -m.radius * 2, m.radius * 4, m.radius * 4);

        ctx.beginPath();
        const verts = m.vertices;
        for (let i = 0; i < verts.length; i++) {
          const angle = (i / verts.length) * Math.PI * 2;
          const r = m.radius * verts[i];
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
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
          const cx2 = (Math.sin(i * 2.1 + m.id.charCodeAt(1)) * m.radius * 0.4);
          const cy2 = (Math.cos(i * 3.7 + m.id.charCodeAt(1)) * m.radius * 0.4);
          const cr = m.radius * 0.12;
          ctx.beginPath();
          ctx.arc(cx2, cy2, cr, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${m.hue}, 30%, 20%, 0.5)`;
          ctx.fill();
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

        // Glow
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, pulseR * 2.5);
        glow.addColorStop(0, `hsla(${hue}, 90%, 60%, ${0.4 * alpha})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(-pulseR * 3, -pulseR * 3, pulseR * 6, pulseR * 6);

        // Body
        ctx.beginPath();
        ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 80%, 50%, ${0.9 * alpha})`;
        ctx.fill();
        ctx.strokeStyle = `hsla(${hue}, 90%, 80%, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Icon
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
        } else if (p.type === 'spark') {
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

      // UI update
      setUiState({
        score: game.score,
        level: game.level,
        chaos: game.chaosLevel,
        highScore: game.highScore,
        combo: game.combo,
        slowmo: game.slowmoTimer > 0,
        scoreMult: game.scoreMultiTimer > 0,
        scoreMultiplier: game.scoreMultiplier,
      });

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('mousedown', onClick);
    };
  }, [handleTap, initStars]);

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
              Level {uiState.level}
            </div>
            {uiState.scoreMult && (
              <div className="font-display text-xs font-bold" style={{ color: 'hsl(var(--score-gold))' }}>
                {uiState.scoreMultiplier}x SCORE
              </div>
            )}
            {uiState.slowmo && (
              <div className="font-display text-xs font-bold" style={{ color: 'hsl(var(--secondary))' }}>
                ⏱ SLOW-MO
              </div>
            )}
          </div>

          {uiState.combo > 1 && (
            <div className="font-display text-lg font-bold text-glow-blue animate-pulse" style={{ color: 'hsl(var(--secondary))' }}>
              {uiState.combo}x COMBO
            </div>
          )}

          <div className="flex flex-col items-end gap-1">
            <div className="font-body text-xs uppercase tracking-widest" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Chaos
            </div>
            <div className="w-24 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'hsl(var(--muted))' }}>
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${uiState.chaos * 100}%`,
                  backgroundColor: uiState.chaos > CHAOS_THRESHOLD
                    ? 'hsl(var(--accent))'
                    : 'hsl(var(--primary))',
                  boxShadow: uiState.chaos > CHAOS_THRESHOLD
                    ? '0 0 10px hsl(var(--accent) / 0.7)'
                    : 'none',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Start Screen */}
      {screen === 'title' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <h1 className="font-display text-5xl md:text-7xl font-black text-glow mb-2" style={{ color: 'hsl(var(--primary))' }}>
            METEOR
          </h1>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-glow-blue mb-8" style={{ color: 'hsl(var(--secondary))' }}>
            SPLIT
          </h2>
          <p className="font-body text-sm mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Tap meteors to split them
          </p>
          <p className="font-body text-xs mb-8" style={{ color: 'hsl(var(--accent))' }}>
            ⚠ Over-tapping creates chaos!
          </p>
          <div className="font-display text-lg animate-pulse cursor-pointer" style={{ color: 'hsl(var(--foreground))' }}>
            TAP TO START
          </div>
          {uiState.highScore > 0 && (
            <div className="font-body text-sm mt-6" style={{ color: 'hsl(var(--score-gold))' }}>
              Best: {uiState.highScore.toLocaleString()}
            </div>
          )}
          <button
            className="mt-8 font-display text-sm px-6 py-2 rounded-lg pointer-events-auto"
            style={{
              backgroundColor: 'hsl(var(--card))',
              color: 'hsl(var(--secondary))',
              border: '1px solid hsl(var(--border))',
            }}
            onClick={(e) => { e.stopPropagation(); setScreen('leaderboard'); }}
          >
            🏆 LEADERBOARD
          </button>
        </div>
      )}

      {/* Game Over */}
      {screen === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <div className="px-8 py-10 rounded-2xl text-center" style={{ backgroundColor: 'hsl(var(--card) / 0.9)', backdropFilter: 'blur(20px)' }}>
            <h2 className="font-display text-4xl font-black mb-2" style={{ color: 'hsl(var(--accent))' }}>
              CHAOS OVERLOAD
            </h2>
            <div className="font-display text-5xl font-bold text-glow my-4" style={{ color: 'hsl(var(--primary))' }}>
              {uiState.score.toLocaleString()}
            </div>
            <p className="font-body text-sm mb-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Level {uiState.level} • {uiState.combo > 0 ? `Best combo: ${gameRef.current.maxCombo}x` : ''}
            </p>
            {uiState.score >= uiState.highScore && uiState.score > 0 && (
              <p className="font-display text-sm mt-2" style={{ color: 'hsl(var(--score-gold))' }}>
                ★ NEW HIGH SCORE ★
              </p>
            )}
            <div className="font-display text-base mt-6 animate-pulse" style={{ color: 'hsl(var(--foreground))' }}>
              TAP TO CONTINUE
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Screen */}
      {screen === 'leaderboard' && (
        <div className="absolute inset-0 flex flex-col items-center z-20 overflow-auto py-8 px-4">
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: 'hsl(var(--card) / 0.95)', backdropFilter: 'blur(20px)' }}>
            <h2 className="font-display text-2xl font-bold mb-4 text-center" style={{ color: 'hsl(var(--primary))' }}>
              🏆 LEADERBOARD
            </h2>

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
              <p className="font-body text-sm text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
                No games yet. Play to set a score!
              </p>
            ) : (
              <div className="space-y-1">
                {leaderboard.slice(0, 10).map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg px-3 py-2"
                    style={{ backgroundColor: i < 3 ? 'hsl(var(--muted) / 0.6)' : 'transparent' }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-display text-sm w-6 text-center" style={{
                        color: i === 0 ? 'hsl(var(--score-gold))' : i === 1 ? 'hsl(210, 20%, 70%)' : i === 2 ? 'hsl(25, 60%, 55%)' : 'hsl(var(--muted-foreground))',
                      }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                      </span>
                      <div>
                        <span className="font-display text-sm font-bold" style={{ color: 'hsl(var(--foreground))' }}>
                          {entry.score.toLocaleString()}
                        </span>
                        <span className="font-body text-[10px] ml-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
                          Lv{entry.level} • {entry.maxCombo}x
                        </span>
                      </div>
                    </div>
                    <span className="font-body text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {new Date(entry.date).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              className="mt-6 w-full font-display text-sm px-6 py-3 rounded-lg"
              style={{
                backgroundColor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
              }}
              onClick={() => setScreen('title')}
            >
              BACK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
