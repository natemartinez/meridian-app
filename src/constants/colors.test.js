/**
 * Tests for colors.js
 *
 * What we're testing:
 * - PROJECT_COLORS: array of 6 hex colors used for project/goal color coding
 */

import { describe, it, expect } from 'vitest';
import { PROJECT_COLORS } from './colors.js';

// ============================================================
// PROJECT_COLORS
// ============================================================
describe('PROJECT_COLORS', () => {
  it('is an array of 6 colors', () => {
    expect(Array.isArray(PROJECT_COLORS)).toBe(true);
    expect(PROJECT_COLORS).toHaveLength(6);
  });

  it('contains the expected hex colors', () => {
    expect(PROJECT_COLORS).toEqual([
      '#f0b429', // gold/accent
      '#53aaff', // blue
      '#3ecf7e', // green
      '#9b79e8', // purple
      '#f77171', // rose
      '#fb923c', // orange
    ]);
  });

  it('all values are valid 6-character hex colors', () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    for (const color of PROJECT_COLORS) {
      expect(color).toMatch(hexRegex);
    }
  });

  it('matches the NODE_PALETTE from theme.js (same 6 colors)', async () => {
    // This ensures consistency between the two color sources
    const { NODE_PALETTE } = await import('../utils/theme.js');
    expect(PROJECT_COLORS).toEqual(NODE_PALETTE);
  });
});
