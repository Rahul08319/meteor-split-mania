export interface ShareData {
  score: number;
  level: number;
  maxCombo: number;
  meteorsDestroyed: number;
  mode: 'classic' | 'daily';
  dailyName?: string;
  achievements: { icon: string; title: string }[];
}

export const buildShareText = (d: ShareData): string => {
  const head = d.mode === 'daily'
    ? `☄️ Meteor Split — Daily Challenge${d.dailyName ? ` "${d.dailyName}"` : ''}`
    : '☄️ Meteor Split';
  const ach = d.achievements.length
    ? `\n🏅 ${d.achievements.slice(0, 3).map(a => `${a.icon} ${a.title}`).join(' • ')}`
    : '';
  return `${head}\nScore: ${d.score.toLocaleString()} • Level ${d.level} • ${d.maxCombo}x combo • ${d.meteorsDestroyed} meteors split${ach}\nCan you beat it?`;
};

/** Renders a branded 1080x1080 score card. */
export const buildShareCard = (d: ShareData): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1080;
  const ctx = c.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 0, 0, 1080);
  g.addColorStop(0, '#06060f');
  g.addColorStop(0.5, '#0b0918');
  g.addColorStop(1, '#050510');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1080, 1080);

  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 1080, y = Math.random() * 1080;
    ctx.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.65})`;
    ctx.fillRect(x, y, Math.random() * 2.5 + 0.6, Math.random() * 2.5 + 0.6);
  }

  // Meteor motif
  for (let i = 0; i < 3; i++) {
    const cx = 200 + i * 340, cy = 800 + (i % 2) * 60, r = 70 - i * 14;
    const rg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r * 2.2);
    rg.addColorStop(0, 'rgba(255,150,60,0.9)');
    rg.addColorStop(0.35, 'rgba(200,80,30,0.5)');
    rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e0762c';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff7a2f';
  ctx.font = 'bold 92px system-ui, sans-serif';
  ctx.fillText('METEOR SPLIT', 540, 170);

  ctx.fillStyle = '#6fd6ff';
  ctx.font = 'bold 38px system-ui, sans-serif';
  ctx.fillText(d.mode === 'daily' ? `DAILY CHALLENGE${d.dailyName ? ` · ${d.dailyName.toUpperCase()}` : ''}` : 'CLASSIC RUN', 540, 232);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 200px system-ui, sans-serif';
  ctx.fillText(d.score.toLocaleString(), 540, 430);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '36px system-ui, sans-serif';
  ctx.fillText('SCORE', 540, 480);

  const stats: [string, string][] = [
    ['LEVEL', String(d.level)],
    ['BEST COMBO', `${d.maxCombo}x`],
    ['METEORS', String(d.meteorsDestroyed)],
  ];
  stats.forEach(([label, value], i) => {
    const x = 200 + i * 340;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x - 140, 540, 280, 130);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText(value, x, 605);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText(label, x, 648);
  });

  if (d.achievements.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '34px system-ui, sans-serif';
    ctx.fillText(d.achievements.slice(0, 3).map(a => `${a.icon} ${a.title}`).join('   '), 540, 730);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '30px system-ui, sans-serif';
  ctx.fillText('Tap meteors. Avoid the chaos.', 540, 1010);

  return c;
};

const canvasToBlob = (c: HTMLCanvasElement): Promise<Blob> =>
  new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('encode failed'))), 'image/png'));

export const shareScoreImage = async (d: ShareData): Promise<'shared' | 'downloaded'> => {
  const blob = await canvasToBlob(buildShareCard(d));
  const file = new File([blob], 'meteor-split-score.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], text: buildShareText(d), title: 'Meteor Split' });
    return 'shared';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'meteor-split-score.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
};

export const shareScoreText = async (d: ShareData): Promise<'shared' | 'copied'> => {
  const text = buildShareText(d);
  if (navigator.share) {
    try { await navigator.share({ text, title: 'Meteor Split' }); return 'shared'; } catch { /* fall through */ }
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
};
