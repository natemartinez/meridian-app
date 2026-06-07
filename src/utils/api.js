import { withRetry, NovaRetryError, getRetryAfter, shouldAbortRetry } from './retry.js';

/**
 * Parse an OpenRouter API error response into a NovaRetryError.
 * @param {Response} response - fetch Response object
 * @returns {Promise<NovaRetryError>}
 */
async function parseApiError(response) {
  let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
  let retryAfter = getRetryAfter(response.headers);

  try {
    const body = await response.json();
    if (body?.error?.message) {
      errorMessage = body.error.message;
    }
  } catch {
    // Response body not JSON — use default message
  }

  const status = response.status;
  const retryable = !shouldAbortRetry(status);
  const userMessages = {
    429: 'Rate limit reached. Waiting before retrying...',
    500: 'OpenRouter server error. Retrying...',
    502: 'OpenRouter gateway error. Retrying...',
    503: 'OpenRouter service temporarily unavailable. Retrying...',
    401: 'Authentication failed. Please check your API key in Settings.',
    403: 'Access denied. Please check your API key permissions.',
  };

  return new NovaRetryError(errorMessage, {
    status,
    retryable,
    userMessage: userMessages[status] || errorMessage,
    retryAfter,
  });
}

/**
 * Call the OpenRouter API via Electron IPC with automatic retry.
 * @param {string} systemPrompt - system prompt text
 * @param {string} userMsg - user message text
 * @param {string} apiKey - OpenRouter API key
 * @param {Object} [retryOptions] - passed through to withRetry
 * @returns {Promise<string>} response text
 */
export async function askAI(systemPrompt, userMsg, apiKey, retryOptions = {}) {
  const result = await withRetry(async (attempt) => {
    const response = await window.electronAPI?.queryAI({ systemPrompt, userMsg, apiKey });
    
    // electronAPI.queryAI returns the raw response string.
    // Check if it's an error string from the main process.
    if (typeof response === 'string' && response.startsWith('Error:')) {
      // Main process returned an error — parse it
      const msg = response.replace('Error: ', '');
      throw new NovaRetryError(msg, {
        status: 0,
        retryable: true,
        userMessage: msg,
      });
    }
    
    return response ?? '';
  }, {
    maxRetries: retryOptions.maxRetries ?? 5,
    baseDelayMs: retryOptions.baseDelayMs ?? 1000,
    maxDelayMs: retryOptions.maxDelayMs ?? 60000,
    ...retryOptions,
  });

  return result.data;
}

/**
 * Chat with NOVA via OpenRouter API with automatic retry.
 * @param {Array} messages - array of {role, content} objects
 * @param {string} apiKey - OpenRouter API key
 * @param {Object} [retryOptions] - passed through to withRetry
 * @returns {Promise<string>} response text
 */
export async function chatWithNOVA(messages, apiKey, retryOptions = {}) {
  const result = await withRetry(async (attempt) => {
    const response = await window.electronAPI?.chatNOVA({ messages, apiKey });
    
    if (typeof response === 'string' && response.startsWith('Error:')) {
      const msg = response.replace('Error: ', '');
      throw new NovaRetryError(msg, {
        status: 0,
        retryable: true,
        userMessage: msg,
      });
    }
    
    return response ?? '';
  }, {
    maxRetries: retryOptions.maxRetries ?? 5,
    baseDelayMs: retryOptions.baseDelayMs ?? 1000,
    maxDelayMs: retryOptions.maxDelayMs ?? 60000,
    ...retryOptions,
  });

  return result.data;
}
