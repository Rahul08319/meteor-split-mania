export type MissionKind = 'destroyed' | 'combo' | 'score';

export interface RunMission {
  id: MissionKind;
  icon: string;
  title: string;
  target: number;
  progress: number;
  complete: boolean;
}

const TEMPLATES: Array<Omit<RunMission, 'progress' | 'complete'>> = [
  { id: 'destroyed', icon: '☄️', title: 'Destroy 50 fragments', target: 50 },
  { id: 'combo', icon: '⚡', title: 'Reach a 10x combo', target: 10 },
  { id: 'score', icon: '⭐', title: 'Earn 5,000 points', target: 5000 },
];

export const createRunMissions = (): RunMission[] => TEMPLATES.map(mission => ({ ...mission, progress: 0, complete: false }));

export const updateRunMissions = (missions: RunMission[], stats: { destroyed: number; combo: number; score: number }) =>
  missions.map(mission => {
    const progress = mission.id === 'destroyed' ? stats.destroyed : mission.id === 'combo' ? stats.combo : stats.score;
    const next = Math.min(mission.target, Math.max(mission.progress, progress));
    return { ...mission, progress: next, complete: next >= mission.target };
  });
