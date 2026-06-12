/**
 * Tests for novaInteractions.js
 *
 * What we're testing:
 * - All 18 patterns have valid structure (id, trigger, cooldown, priority, presentation, template)
 * - All pattern IDs are unique
 * - All referenced variables have resolvers (event source, state source, or computed fn)
 * - All priorities are valid (low, medium, high)
 * - All presentations are valid (toast, waypoint, inline)
 * - All cooldowns have valid durationMs
 */

import { describe, it, expect } from 'vitest';
import { PATTERNS } from './novaInteractions.js';

const VALID_PRIORITIES = ['low', 'medium', 'high'];
const VALID_PRESENTATIONS = ['toast', 'waypoint', 'inline'];
const VALID_SOURCES = ['user_action', 'performance_signal', 'app_state_change', 'time_based'];

describe('PATTERNS', () => {
  it('exports an array of 18 patterns', () => {
    expect(Array.isArray(PATTERNS)).toBe(true);
    expect(PATTERNS).toHaveLength(18);
  });

  it('all patterns have unique IDs', () => {
    const ids = PATTERNS.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all patterns have required top-level fields', () => {
    PATTERNS.forEach((p, i) => {
      expect(p.id).toBeDefined();
      expect(typeof p.id).toBe('string');
      expect(p.trigger).toBeDefined();
      expect(p.cooldown).toBeDefined();
      expect(p.priority).toBeDefined();
      expect(p.presentation).toBeDefined();
      expect(p.template).toBeDefined();
      expect(p.template.title).toBeDefined();
      expect(p.template.body).toBeDefined();
    });
  });

  it('all patterns have valid priorities', () => {
    PATTERNS.forEach(p => {
      expect(VALID_PRIORITIES).toContain(p.priority);
    });
  });

  it('all patterns have valid presentations', () => {
    PATTERNS.forEach(p => {
      expect(VALID_PRESENTATIONS).toContain(p.presentation);
    });
  });

  it('all patterns have valid trigger sources', () => {
    PATTERNS.forEach(p => {
      expect(VALID_SOURCES).toContain(p.trigger.source);
    });
  });

  it('all patterns have a trigger event string', () => {
    PATTERNS.forEach(p => {
      expect(typeof p.trigger.event).toBe('string');
      expect(p.trigger.event.length).toBeGreaterThan(0);
    });
  });

  it('all patterns have trigger conditions as an object', () => {
    PATTERNS.forEach(p => {
      expect(p.trigger.conditions).toBeDefined();
      expect(typeof p.trigger.conditions).toBe('object');
    });
  });

  it('all patterns have valid cooldown durationMs', () => {
    PATTERNS.forEach(p => {
      expect(p.cooldown.durationMs).toBeDefined();
      expect(typeof p.cooldown.durationMs).toBe('number');
      expect(p.cooldown.durationMs).toBeGreaterThan(0);
    });
  });

  it('all patterns with variables have resolvers for each variable', () => {
    PATTERNS.forEach(p => {
      const vars = p.variables || {};
      Object.entries(vars).forEach(([key, def]) => {
        const hasSource = def.source === 'event' || def.source === 'state' || def.source === 'computed';
        const hasDefault = def.default !== undefined;
        expect(hasSource || hasDefault).toBe(true);
        if (def.source === 'event') {
          expect(typeof def.path).toBe('string');
        }
        if (def.source === 'state') {
          expect(typeof def.path).toBe('string');
        }
        if (def.source === 'computed') {
          expect(typeof def.fn).toBe('function');
        }
      });
    });
  });

  it('all patterns with actions have valid action structure', () => {
    PATTERNS.forEach(p => {
      if (p.template.action) {
        expect(typeof p.template.action.label).toBe('string');
        expect(typeof p.template.action.type).toBe('string');
        expect(p.template.action.payload).toBeDefined();
      }
    });
  });

  it('pattern IDs follow the convention: {category}{number}_{description}', () => {
    PATTERNS.forEach(p => {
      expect(p.id).toMatch(/^[A-Z]\d+_[a-z_]+$/);
    });
  });

  it('patterns are ordered by category (A, B, C, D, E)', () => {
    const categories = PATTERNS.map(p => p.id.charAt(0));
    const expectedOrder = categories.slice().sort();
    expect(categories).toEqual(expectedOrder);
  });
});
