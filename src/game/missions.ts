export type MissionMetric = 'destroyed' | 'combo' | 'score';

export interface RunMission {
  id: string;
  title: string;
  icon: string;
  metric: MissionMetric;
  target: number;
  progress: number;
  complete: boolean;
}

interface MissionTemplate {
  id: string;
  title: string;
  icon: string;
  metric: MissionMetric;
  targets: number[];
}

const TEMPLATES: MissionTemplate[] = [
  { id: 'split', title: 'fragments split', icon: '☄️', metric: 'destroyed', targets: [25, 40, 60] },
  { id: 'combo', title: 'combo streak', icon: '🔥', metric: 'combo', targets: [8, 12, 18] },
  { id: 'score', title: 'points scored', icon: '⭐', metric: 'score', targets: [3000, 6000, 10000] },
];

/** Three fresh objectives per run, one per metric, with a randomised tier. */
export const createRunMissions = (): RunMission[] =>
  TEMPLATES.map(t => ({
    id: t.id,
    title: t.title,
    icon: t.icon,
    metric: t.metric,
    target: t.targets[Math.floor(Math.random() * t.targets.length)],
    progress: 0,
    complete: false,
  }));

export const updateRunMissions = (
  missions: RunMission[],
  values: { destroyed: number; combo: number; score: number },
): RunMission[] =>
  missions.map(m => {
    const progress = Math.min(m.target, Math.round(values[m.metric] ?? 0));
    return { ...m, progress, complete: progress >= m.target };
  });
