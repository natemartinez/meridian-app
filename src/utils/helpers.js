import { T } from './theme.js';

export const uid = () => Math.random().toString(36).slice(2, 9);

export const projectPos = (i) => ({ x: 240 + i * 440, y: 270 });

export const progress = (p) => {
  const total = p.subtasks.length + p.checkpoints.length;
  if (!total) return 0;
  const done = p.subtasks.filter(s => s.done).length + p.checkpoints.filter(c => c.done).length;
  return Math.round((done / total) * 100);
};

/**
 * Parse defer clues from task titles.
 * Patterns: "Micro 1 - Sat.", "Micro 2 – Mon", "Micro 3 — Tue"
 * Returns { microId, targetDay } or null.
 */
export function parseDeferClue(title) {
  const match = title.match(/\b(Micro\s+\d+)\s*[-–—]\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i);
  if (!match) return null;
  return { microId: match[1], targetDay: match[2] };
}

/**
 * Estimate pomodoros for a task based on title length and sub-step indicators.
 * Returns suggested number of 25-min pomodoros (minimum 1).
 */
export function estimatePomodoros(title, description = '') {
  const text = `${title} ${description}`;
  const wordCount = text.split(/\s+/).length;
  // Count sub-step indicators like "1.", "2.", "-", "•"
  const stepIndicators = (text.match(/(\d+\.|[-•])\s/g) || []).length;
  // Base estimate: 1 pomodoro per ~50 words, plus sub-steps
  const base = Math.max(1, Math.ceil(wordCount / 50));
  const steps = Math.max(0, stepIndicators);
  return Math.min(base + steps, 8); // Cap at 8 pomodoros
}

/**
 * Build daily summary from sessions, brain dump entries, and task data.
 * Categorizes time into Core Building, Maintenance, and Distractions Intercepted.
 */
export function buildDailySummary(sessions, brainDumpEntries, onwardItems, projects) {
  const today = new Date().toDateString();
  const todaySessions = sessions.filter(s => {
    const sDate = new Date(s.startTime || s.ts || Date.now()).toDateString();
    return sDate === today;
  });
  const todayBrainDumps = brainDumpEntries.filter(e => {
    const eDate = new Date(e.timestamp).toDateString();
    return eDate === today;
  });

  let coreMinutes = 0;
  let maintenanceMinutes = 0;

  for (const session of todaySessions) {
    const duration = session.duration || 25;
    // Check if session is linked to a high-priority goal or selected objective
    const linkedGoal = session.goalId ? projects.find(p => p.id === session.goalId) : null;
    if (linkedGoal && linkedGoal.priority === 'high') {
      coreMinutes += duration;
    } else {
      // Check if the session task is in onwardItems with high priority
      const onwardTask = onwardItems.find(it => it.title === session.label && !it.done);
      if (onwardTask && onwardTask.priority === 'high') {
        coreMinutes += duration;
      } else {
        maintenanceMinutes += duration;
      }
    }
  }

  return {
    coreMinutes,
    maintenanceMinutes,
    distractionsCount: todayBrainDumps.length,
    totalMinutes: coreMinutes + maintenanceMinutes,
    sessionCount: todaySessions.length,
  };
}

export const DEFAULT_SKILLS = [
  { id: uid(), name: 'Programming', color: T.blue, subskills: [
    { id: uid(), name: 'JavaScript', level: 5 },
    { id: uid(), name: 'Python',     level: 4 },
    { id: uid(), name: 'Systems',    level: 3 },
  ]},
  { id: uid(), name: 'Creative', color: T.purple, subskills: [
    { id: uid(), name: 'Writing', level: 6 },
    { id: uid(), name: 'Design',  level: 4 },
    { id: uid(), name: 'Music',   level: 3 },
  ]},
  { id: uid(), name: 'Leadership', color: T.green, subskills: [
    { id: uid(), name: 'Communication', level: 5 },
    { id: uid(), name: 'Planning',      level: 4 },
    { id: uid(), name: 'Mentoring',     level: 3 },
  ]},
  { id: uid(), name: 'Wellness', color: T.rose, subskills: [
    { id: uid(), name: 'Exercise',    level: 5 },
    { id: uid(), name: 'Sleep',       level: 6 },
    { id: uid(), name: 'Mindfulness', level: 3 },
  ]},
];
