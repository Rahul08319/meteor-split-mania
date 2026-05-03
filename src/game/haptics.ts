import { getSettings } from './settings';
export const haptic = (pattern: number | number[]) => {
  if (!getSettings().hapticsEnabled) return;
  try { if ('vibrate' in navigator) navigator.vibrate(pattern); } catch {}
};
export const hapticSplit = () => haptic(15);
export const hapticDestroy = () => haptic(25);
export const hapticPowerUp = () => haptic([20, 30, 40]);
export const hapticChaos = () => haptic([50, 50, 100]);
export const hapticBoss = () => haptic([100, 50, 100, 50, 200]);
