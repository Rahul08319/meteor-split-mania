import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const targets = [
  'youtube-playables', 'facebook-instant-games', 'poki', 'crazygames', 'yandex-games',
  'gamedistribution', 'discord-activities', 'jiogames', 'y8', 'lagged',
  'microsoft-store-pwa', 'huawei-quick-game', 'xiaomi-quick-game', 'msn-games', 'reddit-games',
];
const targetIndex = process.argv.indexOf('--target');
const requested = process.argv.includes('--all') ? targets : targetIndex >= 0 ? [process.argv[targetIndex + 1]] : [];

if (!requested.length || requested.some((target) => !targets.includes(target))) {
  console.error(`Usage: npm run build:target -- --target <target>\nTargets: ${targets.join(', ')}`);
  process.exit(1);
}

const vite = resolve('node_modules', 'vite', 'bin', 'vite.js');
for (const target of requested) {
  console.log(`\nBuilding ${target}…`);
  const result = spawnSync(process.execPath, [vite, 'build', '--mode', target, '--outDir', `dist/${target}`], {
    env: { ...process.env, VITE_DISTRIBUTION_TARGET: target },
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
