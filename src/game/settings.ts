const KEY = 'meteorSplit_settings';
export interface AudioSettings { sfxVolume: number; musicVolume: number; hapticsEnabled: boolean; }
const DEFAULT: AudioSettings = { sfxVolume: 0.8, musicVolume: 0.6, hapticsEnabled: true };

let cache: AudioSettings | null = null;
export const getSettings = (): AudioSettings => {
  if (cache) return cache;
  try { cache = { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { cache = { ...DEFAULT }; }
  return cache!;
};
export const setSettings = (s: Partial<AudioSettings>) => {
  cache = { ...getSettings(), ...s };
  localStorage.setItem(KEY, JSON.stringify(cache));
};
