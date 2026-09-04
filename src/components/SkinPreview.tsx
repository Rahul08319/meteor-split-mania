import { useEffect, useRef } from 'react';
import { MeteorSkin, VisualTheme } from '@/game/skins';
import { mapHue, isReducedMotion } from '@/game/a11y';
import { getSettings } from '@/game/settings';

interface Props {
  skin: MeteorSkin;
  theme: VisualTheme;
  height?: number;
}

interface PreviewMeteor { x: number; y: number; r: number; gen: number; rot: number; rotSpeed: number; verts: number[]; }
interface PreviewParticle { x: number; y: number; vx: number; vy: number; life: number; }

/** Live canvas preview: theme background + stars, skin meteors, trail glow and particles. */
export default function SkinPreview({ skin, theme, height = 160 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const cb = getSettings().colorBlindMode;
    const reduced = isReducedMotion();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      s: Math.random() * 1.8 + 0.4, b: Math.random(),
      sp: 0.5 + Math.random() * 2, off: Math.random() * Math.PI * 2,
    }));

    const meteors: PreviewMeteor[] = [0, 1, 2, 3].map((gen, i) => ({
      x: w * (0.2 + i * 0.2),
      y: h * 0.55,
      r: [26, 19, 14, 9][gen],
      gen,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: reduced ? 0 : (Math.random() - 0.5) * 0.02,
      verts: Array.from({ length: 9 }, () => 0.75 + Math.random() * 0.5),
    }));

    const particles: PreviewParticle[] = [];
    let raf = 0;
    let last = performance.now();
    let spawn = 0;

    const draw = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;

      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `hsl(${theme.bgGradient[0]})`);
      g.addColorStop(0.5, `hsl(${theme.bgGradient[1]})`);
      g.addColorStop(1, `hsl(${theme.bgGradient[2]})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const t = now * 0.001;
      for (const s of stars) {
        const b = reduced ? 0.7 : 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.sp + s.off));
        ctx.fillStyle = `rgba(255,255,255,${b * s.b * theme.starBrightness})`;
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }

      if (!reduced) {
        spawn -= dt;
        if (spawn <= 0) {
          spawn = 220;
          const m = meteors[Math.floor(Math.random() * meteors.length)];
          for (let i = 0; i < 6; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 0.6 + Math.random() * 1.6;
            particles.push({ x: m.x, y: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
          }
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt * 0.06;
        p.y += p.vy * dt * 0.06;
        p.life -= dt * 0.0015;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.fillStyle = `hsla(${mapHue(skin.particleHue, cb)}, 85%, 70%, ${p.life})`;
        ctx.fillRect(p.x, p.y, 2.5 * p.life, 2.5 * p.life);
      }

      for (const m of meteors) {
        const hue = mapHue(skin.hues[m.gen], cb);
        // trail
        ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.2)`;
        ctx.lineWidth = m.r * skin.trailWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(m.x - m.r * 2.4, m.y + m.r * 0.5);
        ctx.lineTo(m.x, m.y);
        ctx.stroke();

        ctx.save();
        ctx.translate(m.x, m.y);
        m.rot += m.rotSpeed * dt * 0.06;
        ctx.rotate(m.rot);

        const glow = ctx.createRadialGradient(0, 0, m.r * 0.2, 0, 0, m.r * 2);
        glow.addColorStop(0, `hsla(${hue}, 80%, 60%, ${skin.glowIntensity})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(-m.r * 2, -m.r * 2, m.r * 4, m.r * 4);

        ctx.beginPath();
        m.verts.forEach((v, i) => {
          const a = (i / m.verts.length) * Math.PI * 2;
          const r = m.r * v;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        });
        ctx.closePath();
        const body = ctx.createRadialGradient(-m.r * 0.3, -m.r * 0.3, 0, 0, 0, m.r);
        body.addColorStop(0, `hsl(${hue}, 60%, 50%)`);
        body.addColorStop(0.6, `hsl(${hue}, 50%, 30%)`);
        body.addColorStop(1, `hsl(${hue}, 40%, 15%)`);
        ctx.fillStyle = body;
        ctx.fill();
        ctx.strokeStyle = `hsla(${hue}, 70%, 65%, 0.6)`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [skin, theme, height]);

  return (
    <canvas
      ref={ref}
      className="w-full rounded-xl"
      style={{ height, border: '1px solid hsl(var(--border))' }}
      aria-label={`Preview of ${skin.name} meteors on the ${theme.name} theme`}
      role="img"
    />
  );
}
