/**
 * NovaRetryError — custom error with structured information
 * @property {number} status - HTTP status code
 * @property {boolean} retryable - whether retry should be attempted
 * @property {string} userMessage - user-facing explanation
 * @property {number|null} retryAfter - seconds to wait (from Retry-After header)
 */
export class NovaRetryError extends Error {
  constructor(message, { status, retryable = true, userMessage, retryAfter = null } = {}) {
    super(message);
    this.name = 'NovaRetryError';
    this.status = status;
    this.retryable = retryable;
    this.userMessage = userMessage || message;
    this.retryAfter = retryAfter;
  }
}

/**
 * Compute exponential backoff delay with full jitter.
 * Formula: min(maxMs, baseMs * 2^attempt) * random(0.5, 1)
 * @param {number} attempt - zero-based attempt number
 * @param {number} [baseMs=1000] - base delay in ms
 * @param {number} [maxMs=60000] - maximum delay in ms
 * @returns {number} delay in milliseconds
 */
export function exponentialBackoff(attempt, baseMs = 1000, maxMs = 60000) {
  const exponential = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  // Full jitter: random between 50% and 100% of the computed delay
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.round(exponential * jitter);
}

/**
 * Determine if a status code should abort retries entirely.
 * @param {number} status - HTTP status code
 * @returns {boolean} true if retries should be aborted
 */
export function shouldAbortRetry(status) {
  return status === 401 || status === 403;
}

/**
 * Parse Retry-After header value.
 * @param {Headers} headers - Response headers
 * @returns {number|null} seconds to wait, or null if not present
 */
export function getRetryAfter(headers) {
  const val = headers?.get?.('Retry-After');
  if (!val) return null;
  const seconds = parseInt(val, 10);
  if (!isNaN(seconds)) return seconds;
  // Handle HTTP-date format (rare but possible)
  const date = new Date(val);
  if (!isNaN(date.getTime())) {
    return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
  }
  return null;
}

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  retryableStatuses: [429, 500, 501, 502, 503],
  abortStatuses: [401, 403],
};

/**
 * Wrap an async function with retry logic.
 * @param {Function} fn - async function to retry. Receives (attempt) as argument.
 * @param {Object} [options] - retry configuration
 * @param {number} [options.maxRetries=5]
 * @param {number} [options.baseDelayMs=1000]
 * @param {number} [options.maxDelayMs=60000]
 * @param {Function} [options.onRetry] - callback(attempt, error, delayMs) called before each retry
 * @param {Function} [options.onAbort] - callback(error) called when retries are aborted
 * @param {Function} [options.onExhausted] - callback(error) called when all retries exhausted
 * @returns {Promise<{data: any, attempts: number, cached?: boolean}>}
 */
export async function withRetry(fn, options = {}) {
  const config = { ...DEFAULT_RETRY_CONFIG, ...options };
  let lastError = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = exponentialBackoff(attempt - 1, config.baseDelayMs, config.maxDelayMs);
        if (config.onRetry) config.onRetry(attempt, lastError, delay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      const data = await fn(attempt);
      return { data, attempts: attempt + 1 };
    } catch (err) {
      lastError = err;

      // Handle NovaRetryError with structured info
      if (err instanceof NovaRetryError) {
        if (!err.retryable) {
          if (config.onAbort) config.onAbort(err);
          throw err;
        }
        // For 429 with Retry-After, wait that long instead of backoff
        if (err.status === 429 && err.retryAfter != null && attempt < config.maxRetries) {
          const waitMs = Math.min(err.retryAfter * 1000, config.maxDelayMs);
          if (config.onRetry) config.onRetry(attempt, err, waitMs);
          await new Promise(resolve => setTimeout(resolve, waitMs));
          // Re-run this attempt (don't increment attempt counter for the wait)
          attempt--; // will be incremented by for loop
          continue;
        }
        // For 500-503, use normal backoff (handled at top of loop)
        if (config.retryableStatuses.includes(err.status) && attempt < config.maxRetries) {
          continue;
        }
        // Non-retryable or exhausted
        if (attempt >= config.maxRetries) {
          if (config.onExhausted) config.onExhausted(err);
        }
        throw err;
      }

      // Handle generic errors (network, timeout, etc.)
      if (attempt < config.maxRetries) {
        continue;
      }

      // Exhausted all retries
      if (config.onExhausted) config.onExhausted(err);
      throw new NovaRetryError(err.message || 'Request failed after all retries', {
        status: 0,
        retryable: false,
        userMessage: 'The service is currently unavailable. Please try again later.',
      });
    }
  }

  // Should never reach here, but just in case
  throw lastError || new Error('Unknown retry error');
}

/**
 * Attempt to retrieve a cached response from localStorage.
 * @param {string} cacheKey - localStorage key
 * @returns {any|null} cached data or null
 */
export function getCachedResponse(cacheKey) {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    // Invalidate cache older than 1 hour
    if (Date.now() - cached.timestamp > 3600000) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    return cached.data;
  } catch {
    return null;
  }
}

/**
 * Store a response in localStorage cache.
 * @param {string} cacheKey - localStorage key
 * @param {any} data - data to cache
 */
export function setCachedResponse(cacheKey, data) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}
