import { useEffect, useRef } from 'react';
import { useNovaInteractionStore } from '../store/novaInteractionStore';

/**
 * useNovaInteractions
 *
 * Thin React wrapper around the Zustand NovaInteractionStore.
 * Provides:
 *  - syncAppState: called on every render to keep the store's appState ref current
 *  - fireEvent: stable reference to the store's fireEvent action
 *  - dismissToast: stable reference to dismiss a toast
 *  - dequeueNext: pop the next high-priority interaction from the queue
 *  - queue / toastQueue: current state slices
 *
 * IMPORTANT: Uses Zustand selectors to subscribe only to the slices that
 * Meridian actually renders (queue, toastQueue). The syncAppState function
 * uses store.getState() internally to avoid triggering re-renders when
 * pushing app state snapshots. This prevents an infinite re-render loop
 * where syncAppState → set({ appState }) → subscriber re-render → syncAppState.
 *
 * Timers and intervals use empty dependency arrays + store.getState()
 * to avoid the "timer never fires" bug caused by referential instability.
 */
export function useNovaInteractions() {
  // Subscribe only to the slices Meridian renders — NOT appState or cooldowns.
  // This prevents syncAppState from triggering re-renders.
  const queue = useNovaInteractionStore((s) => s.queue);
  const toastQueue = useNovaInteractionStore((s) => s.toastQueue);

  // Use refs for action references so they stay stable across renders.
  const fireEventRef = useRef(null);
  const dismissToastRef = useRef(null);
  const clearQueueRef = useRef(null);
  const dequeueNextRef = useRef(null);
  const syncAppStateRef = useRef(null);

  // Lazily initialize refs from the store (runs once).
  if (!fireEventRef.current) {
    const store = useNovaInteractionStore.getState();
    fireEventRef.current = store.fireEvent;
    dismissToastRef.current = store.dismissToast;
    clearQueueRef.current = store.clearQueue;
    dequeueNextRef.current = store.dequeueNext;
    syncAppStateRef.current = store.syncAppState;
  }

  /**
   * syncAppState: called by App.jsx on every render to push the latest
   * app state snapshot into the store without triggering re-renders.
   * Uses getState() to avoid subscribing to the store.
   */
  const syncAppState = (appState) => {
    useNovaInteractionStore.getState().syncAppState(appState);
  };

  // ── Idle detection timer ──
  // Uses empty deps + store.getState() to stay stable across renders.
  useEffect(() => {
    let lastActivity = Date.now();
    let idleFired = false;

    // Track user activity via mousemove/keydown
    const onActivity = () => {
      lastActivity = Date.now();
      idleFired = false;
    };
    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });

    // Check every 30s if user has been idle > 5min
    const idleTimer = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      if (elapsed > 5 * 60_000 && !idleFired) {
        idleFired = true;
        useNovaInteractionStore.getState().fireEvent('user_idle', {
          durationMinutes: Math.floor(elapsed / 60_000),
        });
      }
    }, 30_000);

    return () => {
      clearInterval(idleTimer);
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, []); // Empty deps — stable because we use store.getState()

  // ── End-of-day timer ──
  useEffect(() => {
    const checkEndOfDay = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      // Fire at configurable time (default: 20:00 = 8 PM)
      if (hour === 20 && minute === 0) {
        useNovaInteractionStore.getState().fireEvent('end_of_day', {});
      }
    };

    // Check every minute
    const eodTimer = setInterval(checkEndOfDay, 60_000);
    return () => clearInterval(eodTimer);
  }, []);

  return {
    fireEvent: fireEventRef.current,
    dismissToast: dismissToastRef.current,
    clearQueue: clearQueueRef.current,
    dequeueNext: dequeueNextRef.current,
    queue,
    toastQueue,
    syncAppState,
  };
}
