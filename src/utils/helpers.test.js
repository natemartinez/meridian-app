/**
 * Tests for helpers.js
 *
 * What we're testing:
 * - progress: calculates completion % from subtasks + checkpoints
 * - parseDeferClue: extracts microId and targetDay from task titles
 * - estimatePomodoros: estimates 25-min sessions based on word count and step indicators
 * - buildDailySummary: categorizes today's sessions into core/maintenance/distractions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { progress, parseDeferClue, estimatePomodoros, buildDailySummary } from './helpers.js';

// ============================================================
// progress
// ============================================================
describe('progress', () => {
  it('returns 0 for a project with no subtasks or checkpoints', () => {
    expect(progress({ subtasks: [], checkpoints: [] })).toBe(0);
  });

  it('returns 0 when nothing is done', () => {
    const p = {
      subtasks: [{ done: false }, { done: false }],
      checkpoints: [{ done: false }],
    };
    expect(progress(p)).toBe(0);
  });

  it('returns 100 when everything is done', () => {
    const p = {
      subtasks: [{ done: true }, { done: true }],
      checkpoints: [{ done: true }],
    };
    expect(progress(p)).toBe(100);
  });

  it('calculates partial progress correctly', () => {
    const p = {
      subtasks: [{ done: true }, { done: false }, { done: true }],
      checkpoints: [{ done: false }],
    };
    // total = 4, done = 2 => 50%
    expect(progress(p)).toBe(50);
  });

  it('rounds to nearest integer', () => {
    const p = {
      subtasks: [{ done: true }],
      checkpoints: [{ done: false }],
    };
    // total = 2, done = 1 => 50%
    expect(progress(p)).toBe(50);
  });
});

// ============================================================
// parseDeferClue
// ============================================================
describe('parseDeferClue', () => {
  it('parses "Micro 1 - Sat." pattern', () => {
    const result = parseDeferClue('Micro 1 - Sat.');
    expect(result).toEqual({ microId: 'Micro 1', targetDay: 'Sat' });
  });

  it('parses "Micro 2 – Mon" with en-dash', () => {
    const result = parseDeferClue('Micro 2 – Mon');
    expect(result).toEqual({ microId: 'Micro 2', targetDay: 'Mon' });
  });

  it('parses "Micro 3 — Tue" with em-dash', () => {
    const result = parseDeferClue('Micro 3 — Tue');
    expect(result).toEqual({ microId: 'Micro 3', targetDay: 'Tue' });
  });

  it('returns null for titles without defer clue', () => {
    expect(parseDeferClue('Just a normal task')).toBeNull();
    expect(parseDeferClue('')).toBeNull();
    expect(parseDeferClue('Micro without dash')).toBeNull();
  });

  it('is case-insensitive for day names', () => {
    expect(parseDeferClue('Micro 1 - sat')).toEqual({ microId: 'Micro 1', targetDay: 'sat' });
    expect(parseDeferClue('Micro 1 - MON')).toEqual({ microId: 'Micro 1', targetDay: 'MON' });
  });
});

// ============================================================
// estimatePomodoros
// ============================================================
describe('estimatePomodoros', () => {
  it('returns at least 1 pomodoro for short titles', () => {
    expect(estimatePomodoros('Fix bug')).toBe(1);
  });

  it('estimates based on word count (~50 words per pomodoro)', () => {
    // 49 words => ceil(49/50) = 1 (minimum)
    // 50 words => ceil(50/50) = 1
    // 51 words => ceil(51/50) = 2
    // Note: the function appends a space + description, so text has 51 tokens
    const longTitle = Array.from({ length: 50 }, () => 'word').join(' ');
    expect(estimatePomodoros(longTitle)).toBe(2);
  });

  it('counts step indicators as additional pomodoros', () => {
    // "1. Do this 2. Do that 3. Do another" => 3 step indicators
    // word count ~9 => ceil(9/50) = 1
    // total = 1 + 3 = 4
    expect(estimatePomodoros('1. Do this 2. Do that 3. Do another')).toBe(4);
  });

  it('counts bullet points as step indicators', () => {
    // "- Step one - Step two" => 2 indicators
    // word count ~6 => ceil(6/50) = 1
    // total = 1 + 2 = 3
    expect(estimatePomodoros('- Step one - Step two')).toBe(3);
  });

  it('counts bullet • as step indicators', () => {
    expect(estimatePomodoros('• Item one • Item two')).toBe(3);
  });

  it('includes description in word count', () => {
    const title = 'Short title';
    const desc = 'word '.repeat(100).trim(); // 100 words
    // total words = 2 + 100 = 102 => ceil(102/50) = 3
    expect(estimatePomodoros(title, desc)).toBe(3);
  });

  it('caps at 8 pomodoros', () => {
    const text = '1. a 2. b 3. c 4. d 5. e 6. f 7. g 8. h ';
    // 8 step indicators, word count ~24 => ceil(24/50)=1 => total=9, capped at 8
    expect(estimatePomodoros(text)).toBe(8);
  });
});

// ============================================================
// buildDailySummary
// ============================================================
describe('buildDailySummary', () => {
  // We need to control Date.now() and new Date() for deterministic tests
  const today = new Date('2026-06-08T12:00:00Z'); // A fixed "today"
  const todayStr = today.toDateString();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(today);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns zeros when there are no sessions', () => {
    const summary = buildDailySummary([], [], [], []);
    expect(summary).toEqual({
      coreMinutes: 0,
      maintenanceMinutes: 0,
      distractionsCount: 0,
      totalMinutes: 0,
      sessionCount: 0,
    });
  });

  it('categorizes sessions linked to high-priority goals as core', () => {
    const sessions = [
      { startTime: today.toISOString(), duration: 25, goalId: 'goal-1', label: 'Build API' },
    ];
    const projects = [
      { id: 'goal-1', priority: 'high', title: 'Build API' },
    ];
    const summary = buildDailySummary(sessions, [], [], projects);
    expect(summary.coreMinutes).toBe(25);
    expect(summary.maintenanceMinutes).toBe(0);
    expect(summary.sessionCount).toBe(1);
  });

  it('categorizes sessions linked to non-high-priority goals as maintenance', () => {
    const sessions = [
      { startTime: today.toISOString(), duration: 25, goalId: 'goal-2', label: 'Organize files' },
    ];
    const projects = [
      { id: 'goal-2', priority: 'low', title: 'Organize files' },
    ];
    const summary = buildDailySummary(sessions, [], [], projects);
    expect(summary.coreMinutes).toBe(0);
    expect(summary.maintenanceMinutes).toBe(25);
  });

  it('categorizes sessions with high-priority onward items as core', () => {
    const sessions = [
      { startTime: today.toISOString(), duration: 25, goalId: null, label: 'Fix login bug' },
    ];
    const onwardItems = [
      { title: 'Fix login bug', priority: 'high', done: false },
    ];
    const summary = buildDailySummary(sessions, [], onwardItems, []);
    expect(summary.coreMinutes).toBe(25);
    expect(summary.maintenanceMinutes).toBe(0);
  });

  it('categorizes sessions with low-priority onward items as maintenance', () => {
    const sessions = [
      { startTime: today.toISOString(), duration: 25, goalId: null, label: 'Tidy notes' },
    ];
    const onwardItems = [
      { title: 'Tidy notes', priority: 'low', done: false },
    ];
    const summary = buildDailySummary(sessions, [], onwardItems, []);
    expect(summary.coreMinutes).toBe(0);
    expect(summary.maintenanceMinutes).toBe(25);
  });

  it('counts brain dump entries as distractions', () => {
    const brainDumps = [
      { timestamp: today.toISOString(), text: 'Remember to buy milk' },
      { timestamp: today.toISOString(), text: 'Idea for new feature' },
    ];
    const summary = buildDailySummary([], brainDumps, [], []);
    expect(summary.distractionsCount).toBe(2);
  });

  it('only counts today sessions, not past sessions', () => {
    const yesterday = new Date(today.getTime() - 86400000);
    const sessions = [
      { startTime: yesterday.toISOString(), duration: 25, goalId: null, label: 'Old task' },
    ];
    const summary = buildDailySummary(sessions, [], [], []);
    expect(summary.sessionCount).toBe(0);
    expect(summary.totalMinutes).toBe(0);
  });

  it('calculates totalMinutes as core + maintenance', () => {
    const sessions = [
      { startTime: today.toISOString(), duration: 25, goalId: 'g1', label: 'Core work' },
      { startTime: today.toISOString(), duration: 15, goalId: null, label: 'Email cleanup' },
    ];
    const projects = [
      { id: 'g1', priority: 'high', title: 'Core work' },
    ];
    const summary = buildDailySummary(sessions, [], [], projects);
    expect(summary.coreMinutes).toBe(25);
    expect(summary.maintenanceMinutes).toBe(15);
    expect(summary.totalMinutes).toBe(40);
    expect(summary.sessionCount).toBe(2);
  });
});
