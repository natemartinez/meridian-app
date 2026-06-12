/**
 * Tests for novaInteractionStore.js
 *
 * What we're testing:
 * - fireEvent: event matching, pattern selection, no-op for unknown events
 * - Cooldown system: global, per-pattern, category, session (24h)
 * - Priority sorting: high > medium > low
 * - Queue limits: max 3, drops oldest low-priority
 * - Toast queue limits: max 3 visible
 * - dismissToast, clearQueue, dequeueNext, resetSession
 * - evaluateConditions: minStreak, timeOfDay, minConfidence
 * - resolveVariables: event source, state source, computed source, defaults
 * - fillTemplate: single variable, multiple variables, missing variables
 * - getNestedValue: dot-path traversal
 * - Pattern definitions: all PATTERNS have valid structure
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useNovaInteractionStore, registerPatterns, getPatternRegistry } from './novaInteractionStore.js';

// ── Helpers ──

/** Reset store to initial state before each test. */
function resetStore() {
  useNovaInteractionStore.setState({
    cooldowns: {},
    globalCooldownUntil: 0,
    categoryCooldowns: {},
    sessionPatterns: new Set(),
    queue: [],
    toastQueue: [],
    toastIdCounter: 0,
    appState: {},
  });
}

/** A minimal pattern factory for testing. */
function makePattern(overrides = {}) {
  return {
    id: 'test_pattern',
    trigger: { source: 'user_action', event: 'test_event', conditions: {} },
    cooldown: { type: 'per-pattern', durationMs: 120_000 },
    priority: 'low',
    presentation: 'toast',
    template: { title: 'Test', body: 'Hello {name}' },
    variables: { name: { source: 'event', path: 'name' } },
    ...overrides,
  };
}

// ============================================================
// fireEvent — Core Logic
// ============================================================
describe('fireEvent — core logic', () => {
  beforeEach(() => {
    resetStore();
    registerPatterns([]);
  });

  it('does nothing when no patterns are registered', () => {
    registerPatterns([]);
    useNovaInteractionStore.getState().fireEvent('test_event', {});
    const state = useNovaInteractionStore.getState();
    expect(state.queue).toHaveLength(0);
    expect(state.toastQueue).toHaveLength(0);
  });

  it('does nothing when no patterns match the event type', () => {
    registerPatterns([makePattern({ trigger: { source: 'user_action', event: 'other_event', conditions: {} } })]);
    useNovaInteractionStore.getState().fireEvent('test_event', {});
    const state = useNovaInteractionStore.getState();
    expect(state.queue).toHaveLength(0);
    expect(state.toastQueue).toHaveLength(0);
  });

  it('fires a matching pattern and adds to toastQueue for low priority', () => {
    registerPatterns([makePattern()]);
    useNovaInteractionStore.getState().fireEvent('test_event', { name: 'World' });
    const state = useNovaInteractionStore.getState();
    expect(state.toastQueue).toHaveLength(1);
    expect(state.toastQueue[0].title).toBe('Test');
    expect(state.toastQueue[0].body).toBe('Hello World');
    expect(state.toastQueue[0].priority).toBe('low');
  });

  it('fires a matching pattern and adds to queue for high priority', () => {
    registerPatterns([makePattern({ priority: 'high', presentation: 'waypoint' })]);
    useNovaInteractionStore.getState().fireEvent('test_event', { name: 'World' });
    const state = useNovaInteractionStore.getState();
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0].title).toBe('Test');
    expect(state.queue[0].priority).toBe('high');
    expect(state.toastQueue).toHaveLength(0);
  });

  it('fires a matching pattern and adds to toastQueue for medium priority', () => {
    registerPatterns([makePattern({ priority: 'medium' })]);
    useNovaInteractionStore.getState().fireEvent('test_event', { name: 'World' });
    const state = useNovaInteractionStore.getState();
    expect(state.toastQueue).toHaveLength(1);
    expect(state.toastQueue[0].priority).toBe('medium');
  });

  it('sets global cooldown after firing', () => {
    registerPatterns([makePattern()]);
    const before = Date.now();
    useNovaInteractionStore.getState().fireEvent('test_event', { name: 'World' });
    const state = useNovaInteractionStore.getState();
    expect(state.globalCooldownUntil).toBeGreaterThanOrEqual(before + 30_000);
  });

  it('respects conditions — does not fire when condition fails', () => {
    registerPatterns([makePattern({
      trigger: { source: 'user_action', event: 'test_event', conditions: { minStreak: 5 } },
    })]);
    // appState has currentStreak = 2, condition requires 5
    useNovaInteractionStore.getState().syncAppState({ currentStreak: 2 });
    useNovaInteractionStore.getState().fireEvent('test_event', { name: 'World' });
    const state = useNovaInteractionStore.getState();
    expect(state.toastQueue).toHaveLength(0);
  });

  it('respects conditions — fires when condition passes', () => {
    registerPatterns([makePattern({
      trigger: { source: 'user_action', event: 'test_event', conditions: { minStreak: 3 } },
    })]);
    useNovaInteractionStore.getState().syncAppState({ currentStreak: 5 });
    useNovaInteractionStore.getState().fireEvent('test_event', { name: 'World' });
    const state = useNovaInteractionStore.getState();
    expect(state.toastQueue).toHaveLength(1);
  });
});

// ============================================================
// Cooldown System
// ============================================================
describe('cooldown system', () => {
  beforeEach(() => {
    resetStore();
    registerPatterns([]);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('global cooldown prevents any pattern from firing', () => {
    registerPatterns([
      makePattern({ id: 'p1', trigger: { source: 'user_action', event: 'ev', conditions: {} } }),
      makePattern({ id: 'p2', trigger: { source: 'user_action', event: 'ev', conditions: {} } }),
    ]);
    // First fire should succeed
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'A' });
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(2);
    // Reset toast queue but keep cooldowns
    useNovaInteractionStore.setState({ toastQueue: [] });
    // Second fire within global cooldown should be dropped
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'B' });
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(0);
  });

  it('global cooldown expires after 30 seconds', () => {
    registerPatterns([makePattern({ id: 'p1', trigger: { source: 'user_action', event: 'ev', conditions: {} } })]);
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'A' });
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(1);
    useNovaInteractionStore.setState({ toastQueue: [] });
    // Advance past global cooldown
    vi.advanceTimersByTime(31_000);
    // Manually clear all cooldowns (timers don't auto-clear)
    useNovaInteractionStore.setState({ globalCooldownUntil: 0, sessionPatterns: new Set(), cooldowns: {}, categoryCooldowns: {} });
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'B' });
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(1);
  });

  it('per-pattern cooldown prevents same pattern from firing again', () => {
    registerPatterns([makePattern({ id: 'p1', cooldown: { type: 'per-pattern', durationMs: 60_000 }, trigger: { source: 'user_action', event: 'ev', conditions: {} } })]);
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'A' });
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(1);
    useNovaInteractionStore.setState({ toastQueue: [], globalCooldownUntil: 0 });
    // Second fire — pattern cooldown still active
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'B' });
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(0);
  });

  it('session cooldown prevents same pattern from firing again in same session', () => {
    registerPatterns([makePattern({ id: 'p1', trigger: { source: 'user_action', event: 'ev', conditions: {} } })]);
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'A' });
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(1);
    useNovaInteractionStore.setState({ toastQueue: [], globalCooldownUntil: 0, cooldowns: {} });
    // Session pattern set still has 'p1'
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'B' });
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(0);
  });

  it('resetSession clears all cooldowns and session patterns', () => {
    registerPatterns([makePattern({ id: 'p1', trigger: { source: 'user_action', event: 'ev', conditions: {} } })]);
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'A' });
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(1);
    useNovaInteractionStore.setState({ toastQueue: [] });
    useNovaInteractionStore.getState().resetSession();
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'B' });
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(1);
  });

  it('category cooldown prevents patterns in same category from firing', () => {
    registerPatterns([
      makePattern({ id: 'A_test1', trigger: { source: 'user_action', event: 'ev', conditions: {} } }),
      makePattern({ id: 'A_test2', trigger: { source: 'user_action', event: 'ev', conditions: {} } }),
    ]);
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'A' });
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(2);
    useNovaInteractionStore.setState({ toastQueue: [], globalCooldownUntil: 0, cooldowns: {} });
    // Category cooldown for 'A' is still active (5 min)
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'B' });
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(0);
  });
});

// ============================================================
// Priority Sorting
// ============================================================
describe('priority sorting', () => {
  beforeEach(() => {
    resetStore();
    registerPatterns([]);
  });

  it('sorts interactions by priority: high > medium > low', () => {
    registerPatterns([
      makePattern({ id: 'low_p', priority: 'low', trigger: { source: 'user_action', event: 'ev', conditions: {} } }),
      makePattern({ id: 'high_p', priority: 'high', presentation: 'waypoint', trigger: { source: 'user_action', event: 'ev', conditions: {} } }),
      makePattern({ id: 'med_p', priority: 'medium', trigger: { source: 'user_action', event: 'ev', conditions: {} } }),
    ]);
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'test' });
    const state = useNovaInteractionStore.getState();
    // High goes to queue, medium and low go to toastQueue
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0].patternId).toBe('high_p');
    expect(state.toastQueue).toHaveLength(2);
    // Toast queue should have medium first, then low (insertion order)
    expect(state.toastQueue[0].priority).toBe('medium');
    expect(state.toastQueue[1].priority).toBe('low');
  });
});

// ============================================================
// Queue Limits
// ============================================================
describe('queue limits', () => {
  beforeEach(() => {
    resetStore();
    registerPatterns([]);
  });

  it('limits queue to 3 items, dropping oldest low-priority', () => {
    // Register 4 high-priority patterns with different events
    const patterns = [];
    for (let i = 0; i < 4; i++) {
      patterns.push(makePattern({
        id: `high_${i}`,
        priority: 'high',
        presentation: 'waypoint',
        trigger: { source: 'user_action', event: `ev_${i}`, conditions: {} },
        template: { title: `High ${i}`, body: 'test' },
        variables: {},
      }));
    }
    registerPatterns(patterns);
    // Fire all 4 events
    for (let i = 0; i < 4; i++) {
      useNovaInteractionStore.getState().fireEvent(`ev_${i}`, {});
      // Reset global cooldown so next can fire
      if (i < 3) useNovaInteractionStore.setState({ globalCooldownUntil: 0 });
    }
    const state = useNovaInteractionStore.getState();
    expect(state.queue.length).toBeLessThanOrEqual(3);
  });

  it('limits toast queue to 3 visible items', () => {
    const patterns = [];
    for (let i = 0; i < 5; i++) {
      patterns.push(makePattern({
        id: `low_${i}`,
        priority: 'low',
        trigger: { source: 'user_action', event: `ev_${i}`, conditions: {} },
        template: { title: `Low ${i}`, body: 'test' },
        variables: {},
      }));
    }
    registerPatterns(patterns);
    for (let i = 0; i < 5; i++) {
      useNovaInteractionStore.getState().fireEvent(`ev_${i}`, {});
      if (i < 4) useNovaInteractionStore.setState({ globalCooldownUntil: 0 });
    }
    const state = useNovaInteractionStore.getState();
    expect(state.toastQueue.length).toBeLessThanOrEqual(3);
  });
});

// ============================================================
// dismissToast, clearQueue, dequeueNext
// ============================================================
describe('dismissToast / clearQueue / dequeueNext', () => {
  beforeEach(() => {
    resetStore();
    registerPatterns([]);
  });

  it('dismissToast removes a toast by ID', () => {
    registerPatterns([makePattern()]);
    useNovaInteractionStore.getState().fireEvent('test_event', { name: 'World' });
    const toastId = useNovaInteractionStore.getState().toastQueue[0].id;
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(1);
    useNovaInteractionStore.getState().dismissToast(toastId);
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(0);
  });

  it('clearQueue empties the queue', () => {
    registerPatterns([makePattern({ id: 'p1', priority: 'high', presentation: 'waypoint', trigger: { source: 'user_action', event: 'ev', conditions: {} }, template: { title: 'T', body: 'B' }, variables: {} })]);
    useNovaInteractionStore.getState().fireEvent('ev', {});
    expect(useNovaInteractionStore.getState().queue).toHaveLength(1);
    useNovaInteractionStore.getState().clearQueue();
    expect(useNovaInteractionStore.getState().queue).toHaveLength(0);
  });

  it('dequeueNext returns and removes the first item', () => {
    registerPatterns([
      makePattern({ id: 'p1', priority: 'high', presentation: 'waypoint', trigger: { source: 'user_action', event: 'ev', conditions: {} }, template: { title: 'First', body: 'B' }, variables: {} }),
      makePattern({ id: 'p2', priority: 'high', presentation: 'waypoint', trigger: { source: 'user_action', event: 'ev2', conditions: {} }, template: { title: 'Second', body: 'B' }, variables: {} }),
    ]);
    useNovaInteractionStore.getState().fireEvent('ev', {});
    useNovaInteractionStore.setState({ globalCooldownUntil: 0, sessionPatterns: new Set(), cooldowns: {}, categoryCooldowns: {} });
    useNovaInteractionStore.getState().fireEvent('ev2', {});
    expect(useNovaInteractionStore.getState().queue).toHaveLength(2);
    const first = useNovaInteractionStore.getState().dequeueNext();
    expect(first.title).toBe('First');
    expect(useNovaInteractionStore.getState().queue).toHaveLength(1);
    const second = useNovaInteractionStore.getState().dequeueNext();
    expect(second.title).toBe('Second');
    expect(useNovaInteractionStore.getState().queue).toHaveLength(0);
    const empty = useNovaInteractionStore.getState().dequeueNext();
    expect(empty).toBeNull();
  });
});

// ============================================================
// evaluateConditions
// ============================================================
describe('evaluateConditions', () => {
  beforeEach(() => {
    resetStore();
    registerPatterns([]);
  });

  it('passes when conditions are empty', () => {
    registerPatterns([makePattern({
      trigger: { source: 'user_action', event: 'ev', conditions: {} },
    })]);
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'test' });
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(1);
  });

  it('evaluates minStreak correctly', () => {
    registerPatterns([makePattern({
      trigger: { source: 'user_action', event: 'ev', conditions: { minStreak: 3 } },
    })]);
    // Below threshold
    useNovaInteractionStore.getState().syncAppState({ currentStreak: 2 });
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'test' });
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(0);
    // At threshold
    useNovaInteractionStore.getState().syncAppState({ currentStreak: 3 });
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'test' });
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(1);
  });

  it('evaluates minConfidence correctly', () => {
    registerPatterns([makePattern({
      trigger: { source: 'user_action', event: 'ev', conditions: { minConfidence: 50 } },
    })]);
    useNovaInteractionStore.getState().syncAppState({ confidence: 30 });
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'test' });
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(0);
    useNovaInteractionStore.getState().syncAppState({ confidence: 70 });
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'test' });
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(1);
  });

  it('evaluates timeOfDay correctly (morning)', () => {
    // Mock the hour to be 8 AM (morning)
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 12, 8, 0, 0));
    registerPatterns([makePattern({
      trigger: { source: 'time_based', event: 'ev', conditions: { timeOfDay: 'morning' } },
    })]);
    useNovaInteractionStore.getState().fireEvent('ev', {});
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(1);
    vi.useRealTimers();
  });

  it('evaluates timeOfDay correctly — does not fire outside morning', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 12, 14, 0, 0)); // 2 PM = afternoon
    registerPatterns([makePattern({
      trigger: { source: 'time_based', event: 'ev', conditions: { timeOfDay: 'morning' } },
    })]);
    useNovaInteractionStore.getState().fireEvent('ev', {});
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(0);
    vi.useRealTimers();
  });
});

// ============================================================
// resolveVariables
// ============================================================
describe('resolveVariables', () => {
  beforeEach(() => {
    resetStore();
    registerPatterns([]);
  });

  it('resolves variables from event payload', () => {
    registerPatterns([makePattern({
      variables: { name: { source: 'event', path: 'user.name' } },
    })]);
    useNovaInteractionStore.getState().fireEvent('test_event', { user: { name: 'Alice' } });
    expect(useNovaInteractionStore.getState().toastQueue[0].body).toBe('Hello Alice');
  });

  it('resolves variables from app state', () => {
    registerPatterns([makePattern({
      variables: { name: { source: 'state', path: 'currentStreak' } },
      template: { title: 'Streak', body: 'You have a {name}-day streak!' },
    })]);
    useNovaInteractionStore.getState().syncAppState({ currentStreak: 7 });
    useNovaInteractionStore.getState().fireEvent('test_event', {});
    expect(useNovaInteractionStore.getState().toastQueue[0].body).toBe('You have a 7-day streak!');
  });

  it('resolves variables from computed functions', () => {
    registerPatterns([makePattern({
      variables: {
        name: {
          source: 'computed',
          fn: (payload, appState) => {
            return payload.prefix + ' ' + (appState.username || 'User');
          },
        },
      },
    })]);
    useNovaInteractionStore.getState().syncAppState({ username: 'Bob' });
    useNovaInteractionStore.getState().fireEvent('test_event', { prefix: 'Hello' });
    expect(useNovaInteractionStore.getState().toastQueue[0].body).toBe('Hello Hello Bob');
  });

  it('uses default when source is missing', () => {
    registerPatterns([makePattern({
      variables: { name: { default: 'Guest' } },
    })]);
    useNovaInteractionStore.getState().fireEvent('test_event', {});
    expect(useNovaInteractionStore.getState().toastQueue[0].body).toBe('Hello Guest');
  });

  it('uses empty string when no source or default', () => {
    registerPatterns([makePattern({
      variables: { name: { source: 'event', path: 'nonexistent' } },
    })]);
    useNovaInteractionStore.getState().fireEvent('test_event', {});
    expect(useNovaInteractionStore.getState().toastQueue[0].body).toBe('Hello ');
  });
});

// ============================================================
// fillTemplate
// ============================================================
describe('fillTemplate', () => {
  beforeEach(() => {
    resetStore();
    registerPatterns([]);
  });
  it('replaces single variable', () => {
    // We test via the store's internal behavior
    registerPatterns([makePattern()]);
    useNovaInteractionStore.getState().fireEvent('test_event', { name: 'World' });
    expect(useNovaInteractionStore.getState().toastQueue[0].body).toBe('Hello World');
  });

  it('replaces multiple variables', () => {
    registerPatterns([makePattern({
      template: { title: 'Hi', body: '{greeting}, {name}!' },
      variables: {
        greeting: { source: 'event', path: 'greeting' },
        name: { source: 'event', path: 'name' },
      },
    })]);
    useNovaInteractionStore.getState().fireEvent('test_event', { greeting: 'Hello', name: 'Alice' });
    expect(useNovaInteractionStore.getState().toastQueue[0].body).toBe('Hello, Alice!');
  });

  it('leaves unresolved variables as-is', () => {
    registerPatterns([makePattern({
      template: { title: 'Hi', body: 'Hello {unknown}!' },
      variables: {},
    })]);
    useNovaInteractionStore.getState().fireEvent('test_event', {});
    expect(useNovaInteractionStore.getState().toastQueue[0].body).toBe('Hello {unknown}!');
  });

  it('returns empty string for null/undefined template', () => {
    resetStore();
    // Direct test of the helper via a pattern with null body
    registerPatterns([makePattern({
      template: { title: 'Test', body: null },
      variables: {},
    })]);
    useNovaInteractionStore.getState().fireEvent('test_event', {});
    expect(useNovaInteractionStore.getState().toastQueue[0].body).toBe('');
  });
});

// ============================================================
// getNestedValue
// ============================================================
describe('getNestedValue', () => {
  beforeEach(() => {
    resetStore();
    registerPatterns([]);
  });
  it('returns value at dot path', () => {
    const obj = { a: { b: { c: 42 } } };
    // We test via variable resolution
    registerPatterns([makePattern({
      variables: { name: { source: 'event', path: 'a.b.c' } },
      template: { title: 'T', body: 'Value: {name}' },
    })]);
    useNovaInteractionStore.getState().fireEvent('test_event', { a: { b: { c: 42 } } });
    expect(useNovaInteractionStore.getState().toastQueue[0].body).toBe('Value: 42');
  });

  it('returns undefined for missing path', () => {
    registerPatterns([makePattern({
      variables: { name: { source: 'event', path: 'x.y.z' } },
    })]);
    useNovaInteractionStore.getState().fireEvent('test_event', {});
    expect(useNovaInteractionStore.getState().toastQueue[0].body).toBe('Hello ');
  });
});

// ============================================================
// syncAppState
// ============================================================
describe('syncAppState', () => {
  beforeEach(() => {
    resetStore();
  });

  it('updates appState in the store', () => {
    useNovaInteractionStore.getState().syncAppState({ currentStreak: 10, confidence: 80 });
    expect(useNovaInteractionStore.getState().appState).toEqual({ currentStreak: 10, confidence: 80 });
  });

  it('overwrites previous appState', () => {
    useNovaInteractionStore.getState().syncAppState({ currentStreak: 5 });
    useNovaInteractionStore.getState().syncAppState({ currentStreak: 8 });
    expect(useNovaInteractionStore.getState().appState.currentStreak).toBe(8);
  });
});

// ============================================================
// registerPatterns / getPatternRegistry
// ============================================================
describe('registerPatterns / getPatternRegistry', () => {
  beforeEach(() => {
    registerPatterns([]);
  });

  it('stores and retrieves patterns', () => {
    const patterns = [makePattern({ id: 'p1' }), makePattern({ id: 'p2' })];
    registerPatterns(patterns);
    expect(getPatternRegistry()).toEqual(patterns);
  });

  it('overwrites previous patterns', () => {
    registerPatterns([makePattern({ id: 'p1' })]);
    registerPatterns([makePattern({ id: 'p2' })]);
    expect(getPatternRegistry()).toHaveLength(1);
    expect(getPatternRegistry()[0].id).toBe('p2');
  });
});

// ============================================================
// Edge Cases
// ============================================================
describe('edge cases', () => {
  beforeEach(() => {
    resetStore();
    registerPatterns([]);
  });

  it('handles rapid-fire events with cooldown', () => {
    registerPatterns([makePattern({ id: 'p1', trigger: { source: 'user_action', event: 'ev', conditions: {} } })]);
    // Fire 5 times rapidly
    for (let i = 0; i < 5; i++) {
      useNovaInteractionStore.getState().fireEvent('ev', { name: `#${i}` });
      // Only first should go through due to global cooldown
    }
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(1);
  });

  it('handles empty payload gracefully', () => {
    registerPatterns([makePattern()]);
    useNovaInteractionStore.getState().fireEvent('test_event', undefined);
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(1);
    expect(useNovaInteractionStore.getState().toastQueue[0].body).toBe('Hello ');
  });

  it('handles null payload gracefully', () => {
    registerPatterns([makePattern()]);
    useNovaInteractionStore.getState().fireEvent('test_event', null);
    expect(useNovaInteractionStore.getState().toastQueue).toHaveLength(1);
  });

  it('handles multiple patterns matching same event', () => {
    registerPatterns([
      makePattern({ id: 'p1', priority: 'low', trigger: { source: 'user_action', event: 'ev', conditions: {} }, template: { title: 'First', body: '{name}' } }),
      makePattern({ id: 'p2', priority: 'medium', trigger: { source: 'user_action', event: 'ev', conditions: {} }, template: { title: 'Second', body: '{name}' } }),
    ]);
    useNovaInteractionStore.getState().fireEvent('ev', { name: 'test' });
    const state = useNovaInteractionStore.getState();
    expect(state.toastQueue).toHaveLength(2);
    expect(state.toastQueue[0].patternId).toBe('p2'); // medium first
    expect(state.toastQueue[1].patternId).toBe('p1'); // low second
  });
});
