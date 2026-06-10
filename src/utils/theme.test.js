/**
 * Tests for theme.js
 *
 * What we're testing:
 * - T: the theme color object with 14 properties
 * - NODE_PALETTE: array of 6 colors used for node rendering
 */

import { describe, it, expect } from 'vitest';
import { T, NODE_PALETTE } from './theme.js';

// ============================================================
// T (Theme object)
// ============================================================
describe('T (theme object)', () => {
  it('has all 13 color properties', () => {
    const keys = Object.keys(T);
    expect(keys).toHaveLength(13);
    expect(keys).toEqual([
      'bg', 'surface', 'card', 'border', 'accent', 'accentLo',
      'blue', 'green', 'purple', 'rose',
      'text', 'muted', 'dim',
    ]);
  });

  it('bg is a dark color', () => {
    expect(T.bg).toBe('#07090f');
  });

  it('surface is slightly lighter than bg', () => {
    expect(T.surface).toBe('#0d1017');
  });

  it('accent is gold/yellow', () => {
    expect(T.accent).toBe('#f0b429');
  });

  it('accentLo is accent with low opacity', () => {
    expect(T.accentLo).toBe('#f0b42912');
  });

  it('blue, green, purple, rose are defined', () => {
    expect(T.blue).toBe('#53aaff');
    expect(T.green).toBe('#3ecf7e');
    expect(T.purple).toBe('#9b79e8');
    expect(T.rose).toBe('#f77171');
  });

  it('text is light, muted and dim are darker', () => {
    expect(T.text).toBe('#d6e2f5');
    expect(T.muted).toBe('#56687f');
    expect(T.dim).toBe('#243044');
  });

  it('all values are valid hex color strings', () => {
    const hexRegex = /^#[0-9a-fA-F]{6,8}$/;
    for (const value of Object.values(T)) {
      expect(value).toMatch(hexRegex);
    }
  });
});

// ============================================================
// NODE_PALETTE
// ============================================================
describe('NODE_PALETTE', () => {
  it('is an array of 6 colors', () => {
    expect(NODE_PALETTE).toHaveLength(6);
  });

  it('contains the expected colors', () => {
    expect(NODE_PALETTE).toEqual([
      T.accent,   // '#f0b429'
      T.blue,     // '#53aaff'
      T.green,    // '#3ecf7e'
      T.purple,   // '#9b79e8'
      T.rose,     // '#f77171'
      '#fb923c',  // orange
    ]);
  });

  it('all values are valid hex colors', () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    for (const color of NODE_PALETTE) {
      expect(color).toMatch(hexRegex);
    }
  });
});
