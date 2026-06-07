import React, { useState, useEffect } from 'react';
import { T } from '../../utils/theme.js';

/**
 * RetryFeedback — displays loading spinner, success/error toasts, and refresh button.
 * 
 * Props:
 * @param {Object} retryState - from useNovaRetry hook
 * @param {boolean} retryState.loading
 * @param {string|null} retryState.error
 * @param {number} retryState.attempt
 * @param {number} retryState.maxRetries
 * @param {boolean} retryState.cached
 * @param {boolean} retryState.cooldownActive
 * @param {number} retryState.cooldownRemaining
 * @param {Function} onRefresh - called when manual refresh button clicked
 * @param {string} [size='sm'] - 'sm' | 'md' | 'lg'
 * @param {Object} [style] - additional styles for the container
 */
export default function RetryFeedback({
  loading,
  error,
  attempt,
  maxRetries,
  cached,
  cooldownActive,
  cooldownRemaining,
  onRefresh,
  size = 'sm',
  style,
}) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [prevLoading, setPrevLoading] = useState(false);

  // Detect transition from loading to success → show toast
  useEffect(() => {
    if (prevLoading && !loading && !error) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
    setPrevLoading(loading);
  }, [loading, error, prevLoading]);

  // Auto-dismiss success toast
  useEffect(() => {
    if (!showSuccess) return;
    const timer = setTimeout(() => setShowSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [showSuccess]);

  const sizeStyles = {
    sm: { spinner: 14, fontSize: 9, padding: '4px 8px' },
    md: { spinner: 20, fontSize: 11, padding: '6px 12px' },
    lg: { spinner: 26, fontSize: 13, padding: '8px 16px' },
  }[size] || sizeStyles.sm;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {/* Loading spinner with attempt counter */}
      {loading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: sizeStyles.padding,
          background: `${T.accent}10`,
          border: `1px solid ${T.accent}30`,
          borderRadius: 6,
        }}>
          <div style={{
            width: sizeStyles.spinner,
            height: sizeStyles.spinner,
            border: `2px solid ${T.border}`,
            borderTopColor: T.accent,
            borderRadius: '50%',
            animation: 'nova-spin 0.8s linear infinite',
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: sizeStyles.fontSize,
            color: T.accent,
          }}>
            {attempt > 0
              ? `Retrying... (${attempt}/${maxRetries})`
              : 'Connecting...'}
          </span>
          <style>{`
            @keyframes nova-spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Success toast */}
      {showSuccess && !loading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: sizeStyles.padding,
          background: `${T.green}15`,
          border: `1px solid ${T.green}40`,
          borderRadius: 6,
          animation: 'nova-fade-in 0.2s ease-out',
        }}>
          <span style={{ color: T.green, fontSize: sizeStyles.fontSize + 2 }}>✓</span>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: sizeStyles.fontSize,
            color: T.green,
          }}>
            {cached ? 'Loaded from cache' : 'Request successful'}
          </span>
          <style>{`
            @keyframes nova-fade-in {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Error message with inline refresh button */}
      {error && !loading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: sizeStyles.padding,
          background: `${T.rose}12`,
          border: `1px solid ${T.rose}35`,
          borderRadius: 6,
        }}>
          <span style={{ color: T.rose, fontSize: sizeStyles.fontSize + 2, flexShrink: 0 }}>⚠</span>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: sizeStyles.fontSize,
            color: T.rose,
            flex: 1,
            lineHeight: 1.4,
          }}>
            {error}
          </span>
          {/* Inline retry button inside the error banner */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={cooldownActive}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px',
                background: cooldownActive ? T.border : `${T.rose}20`,
                border: `1px solid ${cooldownActive ? T.border : T.rose}40`,
                borderRadius: 4,
                color: cooldownActive ? T.muted : T.rose,
                cursor: cooldownActive ? 'default' : 'pointer',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: sizeStyles.fontSize,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
              title={cooldownActive ? `Wait ${cooldownRemaining}s before retrying` : 'Retry request'}
            >
              {cooldownActive ? <>Wait {cooldownRemaining}s</> : <>↻ Retry</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
