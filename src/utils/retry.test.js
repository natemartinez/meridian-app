/**
 * Tests for retry.js
 *
 * What we're testing:
 * - NovaRetryError: custom error class with structured info (status, retryable, userMessage, retryAfter)
 * - exponentialBackoff: computes delay with full jitter (random between 50%-100% of exponential value)
 * - shouldAbortRetry: returns true for 401/403, false otherwise
 * - getRetryAfter: parses Retry-After header (seconds or HTTP-date format)
 * - withRetry: orchestrates retries with backoff, abort, and exhaustion handling
 * - getCachedResponse / setCachedResponse: localStorage-based caching with 1-hour TTL
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NovaRetryError,
  exponentialBackoff,
  shouldAbortRetry,
  getRetryAfter,
  withRetry,
  DEFAULT_RETRY_CONFIG,
  getCachedResponse,
  setCachedResponse,
} from './retry.js';

// ============================================================
// NovaRetryError
// ============================================================
describe('NovaRetryError', () => {
  it('creates an error with default values', () => {
    const err = new NovaRetryError('Something went wrong');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('NovaRetryError');
    expect(err.message).toBe('Something went wrong');
    expect(err.status).toBeUndefined();
    expect(err.retryable).toBe(true);
    expect(err.userMessage).toBe('Something went wrong');
    expect(err.retryAfter).toBeNull();
  });

  it('accepts structured options', () => {
    const err = new NovaRetryError('Rate limited', {
      status: 429,
      retryable: true,
      userMessage: 'Too many requests. Please wait.',
      retryAfter: 30,
    });
    expect(err.status).toBe(429);
    expect(err.retryable).toBe(true);
    expect(err.userMessage).toBe('Too many requests. Please wait.');
    expect(err.retryAfter).toBe(30);
  });

  it('marks non-retryable errors', () => {
    const err = new NovaRetryError('Unauthorized', {
      status: 401,
      retryable: false,
      userMessage: 'Invalid API key.',
    });
    expect(err.retryable).toBe(false);
  });
});

// ============================================================
// exponentialBackoff
// ============================================================
describe('exponentialBackoff', () => {
  it('returns a number within expected range (without jitter variance)', () => {
    // Mock Math.random to return 0.5 (minimum jitter = 50%)
    vi.spyOn(Math, 'random').mockReturnValue(0.0);
    // At attempt 0: min(60000, 1000 * 2^0) = 1000, jitter 0.5 => 500
    expect(exponentialBackoff(0)).toBe(500);
    // At attempt 3: min(60000, 1000 * 2^3) = 8000, jitter 0.5 => 4000
    expect(exponentialBackoff(3)).toBe(4000);
    vi.restoreAllMocks();
  });

  it('scales exponentially with attempt number', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0); // minimum jitter
    const delays = [0, 1, 2, 3, 4, 5].map(attempt => exponentialBackoff(attempt));
    // Each delay should be >= the previous (exponential growth)
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
    }
    vi.restoreAllMocks();
  });

  it('caps at maxMs', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1.0); // maximum jitter
    // At attempt 10: min(60000, 1000 * 2^10) = min(60000, 1024000) = 60000
    // With max jitter: 60000 * 1.0 = 60000
    expect(exponentialBackoff(10)).toBe(60000);
    vi.restoreAllMocks();
  });

  it('uses custom baseMs and maxMs', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    // baseMs=500, maxMs=10000
    // attempt 4: min(10000, 500 * 16) = 8000
    expect(exponentialBackoff(4, 500, 10000)).toBe(8000);
    vi.restoreAllMocks();
  });

  it('applies full jitter between 50% and 100%', () => {
    // Test multiple random values to ensure jitter range
    const testRandoms = [0.0, 0.25, 0.5, 0.75, 1.0];
    const expectedJitters = [0.5, 0.625, 0.75, 0.875, 1.0];
    for (let i = 0; i < testRandoms.length; i++) {
      vi.spyOn(Math, 'random').mockReturnValue(testRandoms[i]);
      // attempt 2: min(60000, 1000 * 4) = 4000
      // expected: Math.round(4000 * jitter)
      expect(exponentialBackoff(2)).toBe(Math.round(4000 * expectedJitters[i]));
      vi.restoreAllMocks();
    }
  });
});

// ============================================================
// shouldAbortRetry
// ============================================================
describe('shouldAbortRetry', () => {
  it('returns true for 401 Unauthorized', () => {
    expect(shouldAbortRetry(401)).toBe(true);
  });

  it('returns true for 403 Forbidden', () => {
    expect(shouldAbortRetry(403)).toBe(true);
  });

  it('returns false for other status codes', () => {
    expect(shouldAbortRetry(200)).toBe(false);
    expect(shouldAbortRetry(429)).toBe(false);
    expect(shouldAbortRetry(500)).toBe(false);
    expect(shouldAbortRetry(503)).toBe(false);
    expect(shouldAbortRetry(0)).toBe(false);
  });
});

// ============================================================
// getRetryAfter
// ============================================================
describe('getRetryAfter', () => {
  it('returns null when no Retry-After header', () => {
    const headers = { get: () => null };
    expect(getRetryAfter(headers)).toBeNull();
  });

  it('returns null when headers is undefined', () => {
    expect(getRetryAfter(undefined)).toBeNull();
  });

  it('parses seconds from Retry-After header', () => {
    const headers = { get: () => '30' };
    expect(getRetryAfter(headers)).toBe(30);
  });

  it('parses HTTP-date format', () => {
    const future = new Date(Date.now() + 5000);
    const headers = { get: () => future.toUTCString() };
    const result = getRetryAfter(headers);
    expect(result).toBeGreaterThanOrEqual(4);
    expect(result).toBeLessThanOrEqual(6);
  });

  it('returns null for unparseable values', () => {
    const headers = { get: () => 'not-a-number' };
    expect(getRetryAfter(headers)).toBeNull();
  });
});

// ============================================================
// withRetry
// ============================================================
describe('withRetry', () => {
  it('returns successful result on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    expect(result).toEqual({ data: 'success', attempts: 1 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue('success');
    
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
    expect(result).toEqual({ data: 'success', attempts: 3 });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('aborts on non-retryable NovaRetryError', async () => {
    const fn = vi.fn().mockRejectedValue(
      new NovaRetryError('Unauthorized', { status: 401, retryable: false })
    );
    const onAbort = vi.fn();

    await expect(withRetry(fn, { onAbort })).rejects.toThrow('Unauthorized');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onAbort).toHaveBeenCalledTimes(1);
  });

  it('throws NovaRetryError after exhausting retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Persistent failure'));
    const onExhausted = vi.fn();

    await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 10, onExhausted }))
      .rejects.toThrow(NovaRetryError);
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    expect(onExhausted).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry callback before each retry', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('success');
    const onRetry = vi.fn();

    await withRetry(fn, { maxRetries: 3, baseDelayMs: 10, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error), expect.any(Number));
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error), expect.any(Number));
  });

  it('handles 429 with Retry-After header', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(
        new NovaRetryError('Rate limited', { status: 429, retryable: true, retryAfter: 1 })
      )
      .mockResolvedValue('success');

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10000 });
    // The 429 handler does attempt-- then continue, so the successful call
    // happens on the same attempt number, resulting in attempts=1
    expect(result).toEqual({ data: 'success', attempts: 1 });
  });

  it('passes attempt number to the wrapped function', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await withRetry(fn);
    expect(fn).toHaveBeenCalledWith(0);
  });

  it('uses custom retry configuration', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');
    
    const result = await withRetry(fn, { maxRetries: 1, baseDelayMs: 5 });
    expect(result.attempts).toBe(2);
  });
});

// ============================================================
// DEFAULT_RETRY_CONFIG
// ============================================================
describe('DEFAULT_RETRY_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_RETRY_CONFIG).toEqual({
      maxRetries: 5,
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      retryableStatuses: [429, 500, 501, 502, 503],
      abortStatuses: [401, 403],
    });
  });
});

// ============================================================
// getCachedResponse / setCachedResponse
// ============================================================
describe('cache functions', () => {
  // Mock localStorage (not available in Node.js by default)
  const store = {};

  beforeEach(() => {
    // Create a minimal localStorage mock on globalThis
    globalThis.localStorage = {
      getItem: vi.fn((key) => store[key] ?? null),
      setItem: vi.fn((key, value) => { store[key] = value; }),
      removeItem: vi.fn((key) => { delete store[key]; }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.keys(store).forEach(key => delete store[key]);
    delete globalThis.localStorage;
  });

  it('stores and retrieves cached data', () => {
    setCachedResponse('my-key', { result: 42 });
    expect(getCachedResponse('my-key')).toEqual({ result: 42 });
  });

  it('returns null for missing cache key', () => {
    expect(getCachedResponse('nonexistent')).toBeNull();
  });

  it('returns null for expired cache (> 1 hour)', () => {
    const expired = Date.now() - 3600001; // 1 hour + 1ms ago
    store['old-key'] = JSON.stringify({ data: 'old', timestamp: expired });
    expect(getCachedResponse('old-key')).toBeNull();
    // Should have been removed
    expect(store['old-key']).toBeUndefined();
  });

  it('returns data for fresh cache (< 1 hour)', () => {
    const fresh = Date.now() - 1800000; // 30 minutes ago
    store['fresh-key'] = JSON.stringify({ data: 'fresh', timestamp: fresh });
    expect(getCachedResponse('fresh-key')).toBe('fresh');
  });

  it('handles localStorage errors gracefully', () => {
    // Simulate localStorage being full
    globalThis.localStorage.setItem = vi.fn(() => { throw new Error('QuotaExceededError'); });
    // Should not throw
    expect(() => setCachedResponse('key', 'data')).not.toThrow();
  });

  it('handles corrupted cache data gracefully', () => {
    store['corrupt'] = 'not-json';
    expect(getCachedResponse('corrupt')).toBeNull();
  });
});
