import React, { useEffect, useRef } from 'react';
import { T } from '../../utils/theme.js';

/**
 * NovaToast
 *
 * A small auto-dismiss toast notification for NOVA interactions.
 * Supports:
 *  - Auto-dismiss after configurable duration (default 4s for low, 8s for medium)
 *  - Optional action button
 *  - Slide-in animation
 *  - Stacking (newest on top)
 */
export default function NovaToast({ toast, onDismiss, onAction }) {
  const timerRef = useRef(null);

  const dismissAfterMs = toast.priority === 'medium' ? 8000 : 4000;

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, dismissAfterMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, dismissAfterMs, onDismiss]);

  const handleAction = () => {
    if (toast.action && onAction) {
      onAction(toast.action);
    }
    onDismiss(toast.id);
  };

  return (
    <div
      style={{
        background: T.surface || '#141822',
        border: `1px solid ${T.border || '#2a2f3e'}`,
        borderRadius: 8,
        padding: '10px 14px',
        marginBottom: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        animation: 'novaToastIn 0.25s ease-out',
        maxWidth: 320,
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* NOVA indicator dot */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: T.accent || '#53aaff',
            flexShrink: 0,
            marginTop: 4,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: T.accent || '#53aaff',
              marginBottom: 2,
              letterSpacing: '0.02em',
            }}
          >
            {toast.title}
          </div>

          {/* Body */}
          <div
            style={{
              fontSize: 11,
              color: T.muted || '#8a8f9d',
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}
          >
            {toast.body}
          </div>

          {/* Action button */}
          {toast.action && (
            <button
              onClick={handleAction}
              style={{
                marginTop: 6,
                padding: '3px 10px',
                fontSize: 10,
                fontWeight: 600,
                fontFamily: "'IBM Plex Mono', monospace",
                background: `${T.accent || '#53aaff'}20`,
                color: T.accent || '#53aaff',
                border: `1px solid ${T.accent || '#53aaff'}40`,
                borderRadius: 4,
                cursor: 'pointer',
                letterSpacing: '0.04em',
                transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${T.accent || '#53aaff'}35`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `${T.accent || '#53aaff'}20`;
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={() => onDismiss(toast.id)}
          style={{
            background: 'none',
            border: 'none',
            color: T.muted || '#8a8f9d',
            cursor: 'pointer',
            fontSize: 14,
            padding: '0 2px',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
