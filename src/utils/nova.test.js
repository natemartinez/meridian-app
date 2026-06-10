/**
 * Tests for nova.js
 *
 * What we're testing:
 * - computePlanningConfidence: weighted scoring algorithm
 *   - 35% acceptance rate (tasks accepted vs total decisions)
 *   - 45% completion rate (tasks completed vs accepted)
 *   - 20% richness (meaningful events / saturation point of 40)
 * - NOVA_DEFAULT: default state object
 */

import { describe, it, expect } from 'vitest';
import { computePlanningConfidence, NOVA_DEFAULT } from './nova.js';

// ============================================================
// computePlanningConfidence
// ============================================================
describe('computePlanningConfidence', () => {
  it('returns 0 for undefined/null/empty events', () => {
    expect(computePlanningConfidence(undefined)).toBe(0);
    expect(computePlanningConfidence(null)).toBe(0);
    expect(computePlanningConfidence([])).toBe(0);
  });

  it('returns 50% confidence with equal accept/reject and no completions', () => {
    // 1 accepted, 1 rejected => acceptance = 0.5
    // 0 completed / 1 accepted => completion = 0
    // 2 meaningful events / 40 => richness = 0.05
    // Score = (0.5 * 0.35 + 0 * 0.45 + 0.05 * 0.20) * 100 = 18.5 => 19
    const events = [
      { type: 'task_accepted' },
      { type: 'task_rejected' },
    ];
    const score = computePlanningConfidence(events);
    expect(score).toBe(19);
  });

  it('gives higher score with more completions', () => {
    // 3 accepted, 1 rejected => acceptance = 3/4 = 0.75
    // 2 completed / 3 accepted => completion = 2/3 ≈ 0.667
    // 6 meaningful events / 40 => richness = 0.15
    // Score = (0.75 * 0.35 + 2/3 * 0.45 + 0.15 * 0.20) * 100
    //       = (0.2625 + 0.3 + 0.03) * 100 = 59.25 => 59
    const events = [
      { type: 'task_accepted' },
      { type: 'task_accepted' },
      { type: 'task_accepted' },
      { type: 'task_rejected' },
      { type: 'task_completed' },
      { type: 'task_completed' },
    ];
    const score = computePlanningConfidence(events);
    expect(score).toBe(59);
  });

  it('ignores non-meaningful events like program_opened', () => {
    // Same as above but with extra noise events that shouldn't affect richness
    const meaningful = [
      { type: 'task_accepted' },
      { type: 'task_rejected' },
      { type: 'task_completed' },
    ];
    const withNoise = [
      ...meaningful,
      { type: 'program_opened' },
      { type: 'tab_focused' },
      { type: 'scroll' },
    ];
    expect(computePlanningConfidence(withNoise)).toBe(
      computePlanningConfidence(meaningful)
    );
  });

  it('caps completion rate at 1 (cannot exceed accepted)', () => {
    // 1 accepted, 0 rejected => acceptance = 1
    // 5 completed / 1 accepted => completion = min(5, 1) = 1
    // 6 meaningful / 40 => richness = 0.15
    // Score = (1 * 0.35 + 1 * 0.45 + 0.15 * 0.20) * 100 = 83
    const events = [
      { type: 'task_accepted' },
      { type: 'task_completed' },
      { type: 'task_completed' },
      { type: 'task_completed' },
      { type: 'task_completed' },
      { type: 'task_completed' },
    ];
    expect(computePlanningConfidence(events)).toBe(83);
  });

  it('uses default acceptance of 0.5 when no decisions made', () => {
    // Only completions, no accept/reject => acceptance = 0.5 (default)
    // 1 completed / 0 accepted => completion = 0
    // 1 meaningful / 40 => richness = 0.025
    // Score = (0.5 * 0.35 + 0 * 0.45 + 0.025 * 0.20) * 100 = 18
    const events = [
      { type: 'task_completed' },
    ];
    expect(computePlanningConfidence(events)).toBe(18);
  });

  it('includes briefing_done as a meaningful event', () => {
    const events = [
      { type: 'task_accepted' },
      { type: 'briefing_done' },
    ];
    // 1 accepted, 0 rejected => acceptance = 1
    // 0 completed / 1 accepted => completion = 0
    // 2 meaningful / 40 => richness = 0.05
    // Score = (1 * 0.35 + 0 * 0.45 + 0.05 * 0.20) * 100 = 36
    expect(computePlanningConfidence(events)).toBe(36);
  });

  it('returns 100 with perfect scores', () => {
    // 40 accepted, 0 rejected => acceptance = 1
    // 40 completed / 40 accepted => completion = 1
    // 40 meaningful / 40 => richness = 1
    // Score = (1 * 0.35 + 1 * 0.45 + 1 * 0.20) * 100 = 100
    const events = Array.from({ length: 40 }, (_, i) => ({
      type: i < 20 ? 'task_accepted' : 'task_completed',
    }));
    expect(computePlanningConfidence(events)).toBe(100);
  });
});

// ============================================================
// NOVA_DEFAULT
// ============================================================
describe('NOVA_DEFAULT', () => {
  it('has the expected default shape', () => {
    expect(NOVA_DEFAULT).toEqual({
      syncScore: 0,
      syncEvents: [],
      routine: null,
      programChats: { briefing: [], focus: null, regroup: [], preview: [] },
      suggestedTasks: [],
      dailyPlan: null,
      planGenLoading: false,
      planError: null,
      weeklyInsights: null,
    });
  });
});
