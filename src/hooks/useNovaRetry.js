import { useState, useRef, useCallback, useEffect } from 'react';
import { withRetry, NovaRetryError, getCachedResponse, setCachedResponse } from '../utils/retry.js';

/**
 * @typedef {Object} RetryState
 * @property {'idle'|'loading'|'success'|'error'} status
 * @property {number} attempt - current attempt number (0-indexed)
 * @property {number} maxRetries - maximum retries configured
 * @property {number|null} cooldownUntil - timestamp when cooldown ends (for rate limiting)
 * @property {string|null} errorMessage - user-facing error message
 * @property {number|null} errorStatus - HTTP status code of last error
 * @property {boolean} cached - whether fallback cached data was used
 */

const INITIAL_RETRY_STATE = {
  status: 'idle',
  attempt: 0,
  maxRetries: 5,
  cooldownUntil: null,
  errorMessage: null,
  errorStatus: null,
  cached: false,
};

/**
 * Hook for managing API retry/refresh state with user feedback.
 * 
 * Features:
 * - Automatic retry with exponential backoff
 * - Manual refresh button with cooldown tracking
 * - Cache fallback when retries exhausted
 * - Toast-friendly status updates
 *
 * @param {Object} [options]
 * @param {number} [options.maxRetries=5]
 * @param {number} [options.cooldownMs=5000] - ms to block manual retries after failure
 * @param {string} [options.cacheKey] - localStorage key for cached fallback
 * @param {Function} [options.onSuccess] - callback(data, attempts)
 * @param {Function} [options.onError] - callback(error)
 * @returns {Object} retry controls and state
 */
export function useNovaRetry(options = {}) {
  const {
    maxRetries = 5,
    cooldownMs = 5000,
    cacheKey = null,
    onSuccess,
    onError,
  } = options;

  const [retryState, setRetryState] = useState(INITIAL_RETRY_STATE);
  const cooldownTimerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  /**
   * Execute an async function with automatic retry logic.
   * Manages loading state, cooldown, and cache fallback.
   * 
   * @param {Function} apiFn - async function to execute. Receives (attempt) argument.
   * @param {Object} [execOptions]
   * @param {boolean} [execOptions.useCache=true] - whether to attempt cache fallback
   * @returns {Promise<{data: any, attempts: number, cached: boolean}>}
   */
  const executeWithRetry = useCallback(async (apiFn, execOptions = {}) => {
    const { useCache = true } = execOptions;

    setRetryState(prev => ({
      ...prev,
      status: 'loading',
      attempt: 0,
      errorMessage: null,
      errorStatus: null,
      cached: false,
    }));

    try {
      const result = await withRetry(apiFn, {
        maxRetries,
        onRetry: (attempt, error, delayMs) => {
          if (!mountedRef.current) return;
          setRetryState(prev => ({
            ...prev,
            status: 'loading',
            attempt,
            errorMessage: error?.userMessage || `Retrying... (${attempt}/${maxRetries})`,
            errorStatus: error?.status || null,
          }));
        },
        onAbort: (error) => {
          if (!mountedRef.current) return;
          setRetryState(prev => ({
            ...prev,
            status: 'error',
            errorMessage: error.userMessage,
            errorStatus: error.status,
          }));
        },
        onExhausted: (error) => {
          if (!mountedRef.current) return;
          // Attempt cache fallback
          if (useCache && cacheKey) {
            const cached = getCachedResponse(cacheKey);
            if (cached) {
              setRetryState(prev => ({
                ...prev,
                status: 'success',
                cached: true,
                errorMessage: null,
              }));
              if (onSuccess) onSuccess(cached, maxRetries + 1);
              return;
            }
          }
          setRetryState(prev => ({
            ...prev,
            status: 'error',
            errorMessage: error.userMessage || 'Unable to complete request after multiple attempts.',
            errorStatus: error.status,
          }));
          if (onError) onError(error);
        },
      });

      if (!mountedRef.current) return result;

      // Cache successful response
      if (cacheKey && result.data) {
        setCachedResponse(cacheKey, result.data);
      }

      setRetryState({
        status: 'success',
        attempt: result.attempts - 1,
        maxRetries,
        cooldownUntil: null,
        errorMessage: null,
        errorStatus: null,
        cached: false,
      });

      if (onSuccess) onSuccess(result.data, result.attempts);
      return result;
    } catch (err) {
      if (!mountedRef.current) throw err;

      // If we get here, retries were aborted or exhausted without cache fallback
      const errorMessage = err instanceof NovaRetryError
        ? err.userMessage
        : 'An unexpected error occurred. Please try again.';

      // Start cooldown timer for manual refresh
      const cooldownUntil = Date.now() + cooldownMs;
      cooldownTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setRetryState(prev => ({ ...prev, cooldownUntil: null }));
        }
      }, cooldownMs);

      setRetryState({
        status: 'error',
        attempt: maxRetries,
        maxRetries,
        cooldownUntil,
        errorMessage,
        errorStatus: err instanceof NovaRetryError ? err.status : null,
        cached: false,
      });

      if (onError) onError(err);
      throw err;
    }
  }, [maxRetries, cooldownMs, cacheKey, onSuccess, onError]);

  /**
   * Manual refresh — respects cooldown period.
   * If within cooldown, returns false without executing.
   * 
   * @param {Function} apiFn - async function to retry
   * @param {Object} [execOptions]
   * @returns {Promise<{data: any, attempts: number, cached: boolean}|false>}
   */
  const manualRefresh = useCallback(async (apiFn, execOptions = {}) => {
    if (retryState.cooldownUntil && Date.now() < retryState.cooldownUntil) {
      return false; // Still in cooldown
    }
    return executeWithRetry(apiFn, execOptions);
  }, [retryState.cooldownUntil, executeWithRetry]);

  /**
   * Reset retry state to idle.
   */
  const resetRetryState = useCallback(() => {
    setRetryState(INITIAL_RETRY_STATE);
  }, []);

  /**
   * Seconds remaining in cooldown (0 if no cooldown active).
   */
  const cooldownRemaining = retryState.cooldownUntil
    ? Math.max(0, Math.ceil((retryState.cooldownUntil - Date.now()) / 1000))
    : 0;

  /**
   * Whether manual refresh is blocked by cooldown.
   */
  const cooldownActive = cooldownRemaining > 0;

  return {
    retryState,
    executeWithRetry,
    manualRefresh,
    resetRetryState,
    cooldownRemaining,
    cooldownActive,
    loading: retryState.status === 'loading',
    error: retryState.status === 'error' ? retryState.errorMessage : null,
    errorStatus: retryState.errorStatus,
    attempt: retryState.attempt,
    maxRetries: retryState.maxRetries,
    cached: retryState.cached,
  };
}
