const KEY = 'meteorSplit_settings';

export type ColorBlindMode = 'off' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export interface AudioSettings {
  sfxVolume: number;
  musicVolume: number;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  colorBlindMode: ColorBlindMode;
  uiScale: number; // 1 = default, up to 1.5
}

const DEFAULT: AudioSettings = {
  sfxVolume: 0.8,
  musicVolume: 0.6,
  hapticsEnabled: true,
  reducedMotion: false,
  colorBlindMode: 'off',
  uiScale: 1,
};

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
export const replaceSettings = (s: AudioSettings) => {
  cache = { ...DEFAULT, ...s };
  localStorage.setItem(KEY, JSON.stringify(cache));
};
