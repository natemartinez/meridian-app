/**
 * Tests for skills.js
 *
 * What we're testing:
 * - PROFICIENCY_STAGES: the 5 stages of competency
 * - SKILL_STATUS: 4 possible statuses (active, maintenance, stale, learning)
 * - STAGE_HOUR_THRESHOLDS: hour boundaries for each stage
 * - getProficiencyStage: maps hours to a stage name
 * - getSkillStatus: determines status based on recency and hours
 * - getStatusColor: maps status to hex color
 * - getStatusIndicator: maps status to a unicode symbol
 * - formatLastApplied: human-readable "time since" strings
 * - getSkillGap: computes gap between current and target stage
 * - getSkillReminders: finds skills needing attention
 * - addSkillEvidence: records practice hours and evidence
 * - updateSkillMeta: updates skill metadata
 * - computeProductivityMetrics: calculates completion rate and health
 * - INITIAL_SKILLS: the default skills structure
 * - TAGGABLE_SKILLS: flat list of all skill names
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PROFICIENCY_STAGES,
  SKILL_STATUS,
  STAGE_HOUR_THRESHOLDS,
  getProficiencyStage,
  getSkillStatus,
  getStatusColor,
  getStatusIndicator,
  formatLastApplied,
  getSkillGap,
  getSkillReminders,
  addSkillEvidence,
  updateSkillMeta,
  computeProductivityMetrics,
  INITIAL_SKILLS,
  TAGGABLE_SKILLS,
} from './skills.js';

// ============================================================
// Constants
// ============================================================
describe('PROFICIENCY_STAGES', () => {
  it('has 5 stages in order', () => {
    expect(PROFICIENCY_STAGES).toEqual([
      'Exploring', 'Learning', 'Applying', 'Established', 'Mentoring',
    ]);
  });
});

describe('SKILL_STATUS', () => {
  it('has 4 statuses', () => {
    expect(SKILL_STATUS).toEqual({
      ACTIVE: 'active',
      MAINTENANCE: 'maintenance',
      STALE: 'stale',
      LEARNING: 'learning',
    });
  });
});

describe('STAGE_HOUR_THRESHOLDS', () => {
  it('has 5 thresholds matching the 5 stages', () => {
    expect(STAGE_HOUR_THRESHOLDS).toEqual([0, 10, 50, 150, 400]);
  });
});

// ============================================================
// getProficiencyStage
// ============================================================
describe('getProficiencyStage', () => {
  it('returns Exploring for 0 hours', () => {
    expect(getProficiencyStage(0)).toBe('Exploring');
  });

  it('returns Learning for hours between 10 and 49', () => {
    expect(getProficiencyStage(10)).toBe('Learning');
    expect(getProficiencyStage(25)).toBe('Learning');
    expect(getProficiencyStage(49)).toBe('Learning');
  });

  it('returns Applying for hours between 50 and 149', () => {
    expect(getProficiencyStage(50)).toBe('Applying');
    expect(getProficiencyStage(100)).toBe('Applying');
    expect(getProficiencyStage(149)).toBe('Applying');
  });

  it('returns Established for hours between 150 and 399', () => {
    expect(getProficiencyStage(150)).toBe('Established');
    expect(getProficiencyStage(300)).toBe('Established');
    expect(getProficiencyStage(399)).toBe('Established');
  });

  it('returns Mentoring for 400+ hours', () => {
    expect(getProficiencyStage(400)).toBe('Mentoring');
    expect(getProficiencyStage(1000)).toBe('Mentoring');
  });
});

// ============================================================
// getSkillStatus
// ============================================================
describe('getSkillStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns LEARNING when hours is 0', () => {
    expect(getSkillStatus({ hours: 0, lastApplied: null })).toBe('learning');
  });

  it('returns ACTIVE when applied within 7 days', () => {
    const recent = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
    expect(getSkillStatus({ hours: 10, lastApplied: recent })).toBe('active');
  });

  it('returns MAINTENANCE when applied 8-21 days ago', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString(); // 14 days ago
    expect(getSkillStatus({ hours: 10, lastApplied: twoWeeksAgo })).toBe('maintenance');
  });

  it('returns STALE when applied more than 21 days ago', () => {
    const old = new Date(Date.now() - 30 * 86400000).toISOString(); // 30 days ago
    expect(getSkillStatus({ hours: 10, lastApplied: old })).toBe('stale');
  });

  it('respects manualStatus override', () => {
    expect(getSkillStatus({
      hours: 10,
      lastApplied: new Date().toISOString(),
      manualStatus: 'stale',
    })).toBe('stale');
  });
});

// ============================================================
// getStatusColor
// ============================================================
describe('getStatusColor', () => {
  it('returns green for active', () => expect(getStatusColor('active')).toBe('#3ecf7e'));
  it('returns blue for maintenance', () => expect(getStatusColor('maintenance')).toBe('#53aaff'));
  it('returns yellow for stale', () => expect(getStatusColor('stale')).toBe('#f0b429'));
  it('returns purple for learning', () => expect(getStatusColor('learning')).toBe('#9b79e8'));
  it('returns gray for unknown', () => expect(getStatusColor('unknown')).toBe('#56687f'));
});

// ============================================================
// getStatusIndicator
// ============================================================
describe('getStatusIndicator', () => {
  it('returns filled circle for active', () => expect(getStatusIndicator('active')).toBe('●'));
  it('returns half circle for maintenance', () => expect(getStatusIndicator('maintenance')).toBe('◐'));
  it('returns empty circle for stale', () => expect(getStatusIndicator('stale')).toBe('○'));
  it('returns triangle for learning', () => expect(getStatusIndicator('learning')).toBe('▲'));
  it('returns empty circle for unknown', () => expect(getStatusIndicator('unknown')).toBe('○'));
});

// ============================================================
// formatLastApplied
// ============================================================
describe('formatLastApplied', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Never applied" for null/undefined', () => {
    expect(formatLastApplied(null)).toBe('Never applied');
    expect(formatLastApplied(undefined)).toBe('Never applied');
    expect(formatLastApplied('')).toBe('Never applied');
  });

  it('returns "Today" for today', () => {
    expect(formatLastApplied(new Date().toISOString())).toBe('Today');
  });

  it('returns "Yesterday" for 1 day ago', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    expect(formatLastApplied(yesterday)).toBe('Yesterday');
  });

  it('returns "X days ago" for less than 7 days', () => {
    const threeDays = new Date(Date.now() - 3 * 86400000).toISOString();
    expect(formatLastApplied(threeDays)).toBe('3 days ago');
  });

  it('returns "X weeks ago" for less than 30 days', () => {
    const twoWeeks = new Date(Date.now() - 14 * 86400000).toISOString();
    expect(formatLastApplied(twoWeeks)).toBe('2 weeks ago');
  });

  it('returns "X months ago" for less than 365 days', () => {
    const twoMonths = new Date(Date.now() - 60 * 86400000).toISOString();
    expect(formatLastApplied(twoMonths)).toBe('2 months ago');
  });

  it('returns "X years ago" for 365+ days', () => {
    const twoYears = new Date(Date.now() - 730 * 86400000).toISOString();
    expect(formatLastApplied(twoYears)).toBe('2 years ago');
  });
});

// ============================================================
// getSkillGap
// ============================================================
describe('getSkillGap', () => {
  it('returns gap of 0 when no target stage', () => {
    const result = getSkillGap({ hours: 10, targetStage: null });
    expect(result.gapSize).toBe(0);
    expect(result.targetIdx).toBeNull();
  });

  it('computes positive gap when target > current', () => {
    // 10 hours => Learning (index 1), target Mentoring (index 4) => gap = 3
    const result = getSkillGap({ hours: 10, targetStage: 4 });
    expect(result.currentIdx).toBe(1);
    expect(result.targetIdx).toBe(4);
    expect(result.gapSize).toBe(3);
  });

  it('returns gap of 0 when already at or above target', () => {
    // 500 hours => Mentoring (index 4), target Learning (index 1) => gap = 0
    const result = getSkillGap({ hours: 500, targetStage: 1 });
    expect(result.gapSize).toBe(0);
  });
});

// ============================================================
// getSkillReminders
// ============================================================
describe('getSkillReminders', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty array for empty skills object', () => {
    expect(getSkillReminders({})).toEqual([]);
  });

  it('generates gap reminders for skills with target > current', () => {
    const skills = {
      'Core CS': {
        skills: {
          'Algorithms': { hours: 10, lastApplied: new Date().toISOString(), targetStage: 4 },
        },
      },
    };
    const reminders = getSkillReminders(skills);
    expect(reminders).toHaveLength(1);
    expect(reminders[0].type).toBe('gap');
    expect(reminders[0].skillName).toBe('Algorithms');
    expect(reminders[0].gapSize).toBe(3);
  });

  it('generates reminder for stale skills without target', () => {
    const old = new Date(Date.now() - 30 * 86400000).toISOString();
    const skills = {
      'Core CS': {
        skills: {
          'Data Structures': { hours: 10, lastApplied: old, targetStage: null },
        },
      },
    };
    const reminders = getSkillReminders(skills);
    expect(reminders).toHaveLength(1);
    expect(reminders[0].type).toBe('reminder');
    expect(reminders[0].reason).toBe('not applied in 3+ weeks');
  });

  it('sorts gap reminders before regular reminders', () => {
    const old = new Date(Date.now() - 30 * 86400000).toISOString();
    const skills = {
      'Core CS': {
        skills: {
          'Algorithms': { hours: 10, lastApplied: new Date().toISOString(), targetStage: 4 },
          'Data Structures': { hours: 10, lastApplied: old, targetStage: null },
        },
      },
    };
    const reminders = getSkillReminders(skills);
    expect(reminders[0].type).toBe('gap');
    expect(reminders[1].type).toBe('reminder');
  });
});

// ============================================================
// addSkillEvidence
// ============================================================
describe('addSkillEvidence', () => {
  const baseSkills = {
    'Core CS': {
      color: '#53aaff',
      skills: {
        'Algorithms': { hours: 10, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      },
    },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds hours and updates lastApplied', () => {
    const result = addSkillEvidence(baseSkills, 'Core CS', 'Algorithms', 5);
    expect(result['Core CS'].skills['Algorithms'].hours).toBe(15);
    expect(result['Core CS'].skills['Algorithms'].lastApplied).toBe(new Date().toISOString());
  });

  it('adds evidence context and increments count', () => {
    const result = addSkillEvidence(baseSkills, 'Core CS', 'Algorithms', 2, 'Solved 3 LeetCode problems');
    const skill = result['Core CS'].skills['Algorithms'];
    expect(skill.hours).toBe(12);
    expect(skill.evidenceCount).toBe(1);
    expect(skill.evidence).toContain('Solved 3 LeetCode problems');
  });

  it('keeps only last 10 evidence entries', () => {
    let skills = baseSkills;
    for (let i = 0; i < 15; i++) {
      skills = addSkillEvidence(skills, 'Core CS', 'Algorithms', 0, `Evidence #${i}`);
    }
    const evidence = skills['Core CS'].skills['Algorithms'].evidence;
    expect(evidence).toHaveLength(10);
    expect(evidence[0]).toBe('Evidence #5'); // first 5 were sliced off
    expect(evidence[9]).toBe('Evidence #14');
  });

  it('returns unchanged skills if group or skill not found', () => {
    const result = addSkillEvidence(baseSkills, 'Nonexistent', 'Algorithms', 5);
    expect(result).toBe(baseSkills);
    const result2 = addSkillEvidence(baseSkills, 'Core CS', 'Nonexistent', 5);
    expect(result2).toBe(baseSkills);
  });
});

// ============================================================
// updateSkillMeta
// ============================================================
describe('updateSkillMeta', () => {
  const baseSkills = {
    'Core CS': {
      color: '#53aaff',
      skills: {
        'Algorithms': { hours: 10, lastApplied: null, evidenceCount: 0, evidence: [], notes: '', targetStage: null },
      },
    },
  };

  it('updates skill metadata', () => {
    const result = updateSkillMeta(baseSkills, 'Core CS', 'Algorithms', { notes: 'Getting better', targetStage: 3 });
    expect(result['Core CS'].skills['Algorithms'].notes).toBe('Getting better');
    expect(result['Core CS'].skills['Algorithms'].targetStage).toBe(3);
    // Original hours should be preserved
    expect(result['Core CS'].skills['Algorithms'].hours).toBe(10);
  });

  it('returns unchanged skills if group or skill not found', () => {
    expect(updateSkillMeta(baseSkills, 'Nonexistent', 'Algorithms', {})).toBe(baseSkills);
    expect(updateSkillMeta(baseSkills, 'Core CS', 'Nonexistent', {})).toBe(baseSkills);
  });
});

// ============================================================
// computeProductivityMetrics
// ============================================================
describe('computeProductivityMetrics', () => {
  it('returns zero values for empty goals', () => {
    const result = computeProductivityMetrics([], 0);
    expect(result).toEqual({
      tasksCompleted: 0,
      tasksTotal: 0,
      completionRate: 0,
      streakDays: 0,
      isHealthy: false,
    });
  });

  it('calculates completion rate correctly', () => {
    const goals = [
      { subtasks: [{ done: true }, { done: true }, { done: false }] },
      { subtasks: [{ done: true }, { done: false }] },
    ];
    const result = computeProductivityMetrics(goals, 5);
    expect(result.tasksCompleted).toBe(3);
    expect(result.tasksTotal).toBe(5);
    expect(result.completionRate).toBe(0.6);
  });

  it('handles tasks with "completed" property instead of "done"', () => {
    const goals = [
      { subtasks: [{ completed: true }, { completed: false }] },
    ];
    const result = computeProductivityMetrics(goals, 0);
    expect(result.tasksCompleted).toBe(1);
    expect(result.tasksTotal).toBe(2);
  });

  it('isHealthy when rate >= 0.6 and streak >= 3', () => {
    const goals = [
      { subtasks: [{ done: true }, { done: true }, { done: true }] },
    ];
    expect(computeProductivityMetrics(goals, 3).isHealthy).toBe(true);
    expect(computeProductivityMetrics(goals, 2).isHealthy).toBe(false);
  });

  it('isHealthy is false when rate < 0.6', () => {
    const goals = [
      { subtasks: [{ done: true }, { done: false }, { done: false }] },
    ];
    expect(computeProductivityMetrics(goals, 5).isHealthy).toBe(false);
  });
});

// ============================================================
// INITIAL_SKILLS
// ============================================================
describe('INITIAL_SKILLS', () => {
  it('has 5 skill groups', () => {
    expect(Object.keys(INITIAL_SKILLS)).toEqual([
      'Core CS', 'Languages', 'Frontend', 'Backend', 'CS Practice',
    ]);
  });

  it('each skill has the correct shape', () => {
    const skill = INITIAL_SKILLS['Core CS'].skills['Data Structures'];
    expect(skill).toHaveProperty('hours', 0);
    expect(skill).toHaveProperty('lastApplied', null);
    expect(skill).toHaveProperty('evidenceCount', 0);
    expect(skill).toHaveProperty('evidence');
    expect(skill).toHaveProperty('notes', '');
    expect(skill).toHaveProperty('targetStage', null);
  });

  it('each group has a color', () => {
    for (const group of Object.values(INITIAL_SKILLS)) {
      expect(group).toHaveProperty('color');
    }
  });
});

// ============================================================
// TAGGABLE_SKILLS
// ============================================================
describe('TAGGABLE_SKILLS', () => {
  it('is a flat array of all skill names', () => {
    expect(Array.isArray(TAGGABLE_SKILLS)).toBe(true);
    expect(TAGGABLE_SKILLS).toContain('Data Structures');
    expect(TAGGABLE_SKILLS).toContain('JavaScript/TypeScript');
    expect(TAGGABLE_SKILLS).toContain('React & Ecosystem');
    expect(TAGGABLE_SKILLS).toContain('APIs & Services');
    expect(TAGGABLE_SKILLS).toContain('Problem Solving');
  });

  it('has the correct total count', () => {
    // Core CS: 6, Languages: 5, Frontend: 4, Backend: 4, CS Practice: 4 = 23
    expect(TAGGABLE_SKILLS).toHaveLength(23);
  });
});
