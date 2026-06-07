// Evidence-based skill tracking
// Hours = deliberate practice time
// Stage = progression through competency
// Evidence = projects/tasks using this skill
// Status = current focus/engagement level

export const PROFICIENCY_STAGES = ['Exploring', 'Learning', 'Applying', 'Established', 'Mentoring'];

export const SKILL_STATUS = {
  ACTIVE: 'active',       // Currently practicing
  MAINTENANCE: 'maintenance', // Keep fresh, occasional use
  STALE: 'stale',         // Needs attention
  LEARNING: 'learning',   // Currently studying
};

// Stage thresholds in hours of deliberate practice
export const STAGE_HOUR_THRESHOLDS = [0, 10, 50, 150, 400];

export function getProficiencyStage(hours) {
  let stageIdx = 0;
  for (let i = STAGE_HOUR_THRESHOLDS.length - 1; i >= 0; i--) {
    if (hours >= STAGE_HOUR_THRESHOLDS[i]) { stageIdx = i; break; }
  }
  return PROFICIENCY_STAGES[Math.min(stageIdx, PROFICIENCY_STAGES.length - 1)];
}

export function getSkillStatus(data) {
  const now = Date.now();
  const DAY_MS = 86_400_000;
  
  const daysSince = data.lastApplied
    ? (now - new Date(data.lastApplied).getTime()) / DAY_MS
    : Infinity;
  
  // Explicit status overrides
  if (data.manualStatus) return data.manualStatus;
  
  // Auto-calculate based on recency
  if (data.hours === 0) return SKILL_STATUS.LEARNING;
  if (daysSince > 21) return SKILL_STATUS.STALE;
  if (daysSince > 7) return SKILL_STATUS.MAINTENANCE;
  return SKILL_STATUS.ACTIVE;
}

export function getStatusColor(status) {
  switch (status) {
    case SKILL_STATUS.ACTIVE: return '#3ecf7e';
    case SKILL_STATUS.MAINTENANCE: return '#53aaff';
    case SKILL_STATUS.STALE: return '#f0b429';
    case SKILL_STATUS.LEARNING: return '#9b79e8';
    default: return '#56687f';
  }
}

export function getStatusIndicator(status) {
  switch (status) {
    case SKILL_STATUS.ACTIVE: return '●';
    case SKILL_STATUS.MAINTENANCE: return '◐';
    case SKILL_STATUS.STALE: return '○';
    case SKILL_STATUS.LEARNING: return '▲';
    default: return '○';
  }
}

export function formatLastApplied(dateStr) {
  if (!dateStr) return 'Never applied';
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const days = Math.floor((now - date) / 86_400_000);
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

// Get skills that need attention (stale or new)
export function getSkillGap(data) {
  const currentIdx = PROFICIENCY_STAGES.indexOf(getProficiencyStage(data.hours || 0));
  const targetIdx  = (data.targetStage != null) ? data.targetStage : null;
  const gapSize    = (targetIdx != null) ? Math.max(0, targetIdx - currentIdx) : 0;
  return { currentIdx, targetIdx, gapSize };
}

export function getSkillReminders(skills) {
  const reminders = [];

  for (const [groupName, group] of Object.entries(skills)) {
    for (const [skillName, data] of Object.entries(group.skills)) {
      const status = getSkillStatus(data);
      const { currentIdx, targetIdx, gapSize } = getSkillGap(data);

      if (targetIdx != null && gapSize > 0) {
        reminders.push({
          skillName, groupName, status, gapSize,
          currentStage: PROFICIENCY_STAGES[currentIdx],
          targetStage:  PROFICIENCY_STAGES[targetIdx],
          reason: `${gapSize} stage${gapSize > 1 ? 's' : ''} to target`,
          type: 'gap',
        });
      } else if (targetIdx == null && (status === SKILL_STATUS.STALE || status === SKILL_STATUS.LEARNING)) {
        reminders.push({
          skillName, groupName, status, gapSize: 0,
          reason: status === SKILL_STATUS.STALE ? 'not applied in 3+ weeks' : 'new skill — start practicing',
          type: 'reminder',
        });
      }
    }
  }

  return reminders.sort((a, b) => {
    if (a.type === 'gap' && b.type !== 'gap') return -1;
    if (b.type === 'gap' && a.type !== 'gap') return 1;
    return b.gapSize - a.gapSize;
  });
}

// Record evidence of skill application
export function addSkillEvidence(skills, groupName, skillName, hours = 0, context = '') {
  const group = skills[groupName];
  if (!group || !group.skills[skillName]) return skills;
  
  const skill = group.skills[skillName];
  const newEvidence = context ? [context] : [];
  
  return {
    ...skills,
    [groupName]: {
      ...group,
      skills: {
        ...group.skills,
        [skillName]: {
          ...skill,
          hours: (skill.hours || 0) + hours,
          evidenceCount: (skill.evidenceCount || 0) + (context ? 1 : 0),
          lastApplied: new Date().toISOString(),
          evidence: [...(skill.evidence || []).slice(-9), ...newEvidence], // Keep last 10
        },
      },
    },
  };
}

// Update skill metadata (status, notes, etc)
export function updateSkillMeta(skills, groupName, skillName, updates) {
  const group = skills[groupName];
  if (!group || !group.skills[skillName]) return skills;
  
  return {
    ...skills,
    [groupName]: {
      ...group,
      skills: {
        ...group.skills,
        [skillName]: {
          ...group.skills[skillName],
          ...updates,
        },
      },
    },
  };
}

// Compute productivity metrics from goals data
export function computeProductivityMetrics(goals, streakDays) {
  const allSubtasks = goals.flatMap(g => g.subtasks || []);
  const totalCompleted = allSubtasks.filter(s => s.done || s.completed).length;
  const total = allSubtasks.length;
  const rate = total > 0 ? totalCompleted / total : 0;
  
  return {
    tasksCompleted: totalCompleted,
    tasksTotal: total,
    completionRate: rate,
    streakDays,
    isHealthy: rate >= 0.6 && streakDays >= 3,
  };
}

// Initial skills structure - no XP, just evidence tracking
export const INITIAL_SKILLS = {
  'Core CS': {
    color: '#53aaff',
    skills: {
      'Data Structures':       { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'Algorithms':            { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'System Design':         { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'Networking':            { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'Computer Architecture': { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'Security':              { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
    }
  },
  'Languages': {
    color: '#f0b429',
    skills: {
      'JavaScript/TypeScript': { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'Python':                { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'Go':                    { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'C/C++':                 { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'SQL':                   { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
    }
  },
  Frontend: {
    color: '#9b79e8',
    skills: {
      'React & Ecosystem':     { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'HTML & CSS':            { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'Build & Testing Tools': { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'Performance & A11y':    { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
    }
  },
  Backend: {
    color: '#3ecf7e',
    skills: {
      'APIs & Services':       { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'Databases & Storage':   { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'Architecture & Scaling':{ hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'DevOps & Deployment':   { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
    }
  },
  'CS Practice': {
    color: '#f77171',
    skills: {
      'Problem Solving':       { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'Code Review':           { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'System Architecture':   { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      'Technical Writing':     { hours: 0, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
    }
  },
};

export const TAGGABLE_SKILLS = Object.entries(INITIAL_SKILLS)
  .flatMap(([, group]) => Object.keys(group.skills));
