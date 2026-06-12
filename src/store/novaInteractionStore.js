import { create } from 'zustand';

// ── Pattern Registry ──
// Patterns are registered externally via registerPatterns().
// This keeps the store decoupled from specific pattern definitions.
let patternRegistry = [];

export function registerPatterns(patterns) {
  patternRegistry = patterns;
}

export function getPatternRegistry() {
  return patternRegistry;
}

// ── Cooldown helpers ──
const GLOBAL_COOLDOWN_MS = 30_000;
const CATEGORY_COOLDOWN_MS = 5 * 60_000;
const SESSION_COOLDOWN_MS = 24 * 60 * 60_000; // don't repeat same pattern in a session

function getCategoryForPattern(patternId) {
  const prefix = patternId.charAt(0).toUpperCase();
  if ('ABCDE'.includes(prefix)) return prefix;
  return 'Z';
}

// ── Store ──
export const useNovaInteractionStore = create((set, get) => ({
  // --- State ---
  cooldowns: {},           // { patternId: expiryTimestamp }
  globalCooldownUntil: 0,  // timestamp
  categoryCooldowns: {},   // { category: expiryTimestamp }
  sessionPatterns: new Set(), // patternIds seen this session
  queue: [],               // pending interaction queue
  toastQueue: [],          // currently visible toasts
  toastIdCounter: 0,       // monotonic counter for toast IDs
  appState: {},            // latest snapshot synced via syncAppState

  // --- Actions (stable references, created once) ---

  /**
   * Sync the latest app state snapshot into the store.
   * Called by App.jsx on every render via the hook's syncAppState.
   */
  syncAppState: (appState) => {
    set({ appState });
  },

  /**
   * Fire an event from the application.
   * Matches against the pattern registry, checks cooldowns,
   * resolves variables, and pushes to queue or shows toast.
   */
  fireEvent: (type, payload = {}) => {
    const state = get();
    const now = Date.now();

    // 1. Global cooldown check
    if (now < state.globalCooldownUntil) {
      return; // Silently drop — global cooldown active
    }

    // 2. Find matching patterns
    const matches = patternRegistry.filter(p => {
      if (p.trigger.event !== type) return false;
      if (p.trigger.conditions) {
        return evaluateConditions(p.trigger.conditions, payload, state.appState);
      }
      return true;
    });

    if (matches.length === 0) return;

    // 3. For each match, check per-pattern and category cooldowns
    const fireable = matches.filter(p => {
      // Per-pattern cooldown
      const patternExpiry = state.cooldowns[p.id];
      if (patternExpiry && now < patternExpiry) return false;

      // Category cooldown
      const cat = getCategoryForPattern(p.id);
      const catExpiry = state.categoryCooldowns[cat];
      if (catExpiry && now < catExpiry) return false;

      // Session cooldown (don't repeat same pattern)
      if (state.sessionPatterns.has(p.id)) return false;

      return true;
    });

    if (fireable.length === 0) return;

    // 4. Sort by priority (high > medium > low)
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    fireable.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));

    // 5. Resolve variables and build interactions
    const interactions = fireable.map(p => {
      const resolved = resolveVariables(p, payload, state.appState);
      return {
        patternId: p.id,
        priority: p.priority,
        presentation: p.presentation,
        title: fillTemplate(p.template.title, resolved),
        body: fillTemplate(p.template.body, resolved),
        action: p.template.action ? {
          label: p.template.action.label,
          type: p.template.action.type,
          payload: p.template.action.payload || {},
        } : null,
        createdAt: now,
      };
    });

    // 6. Set cooldowns
    const newCooldowns = { ...state.cooldowns };
    const newCategoryCooldowns = { ...state.categoryCooldowns };
    const newSessionPatterns = new Set(state.sessionPatterns);

    fireable.forEach(p => {
      const duration = p.cooldown?.durationMs || 120_000;
      newCooldowns[p.id] = now + duration;
      newSessionPatterns.add(p.id);

      const cat = getCategoryForPattern(p.id);
      if (!newCategoryCooldowns[cat]) {
        newCategoryCooldowns[cat] = now + CATEGORY_COOLDOWN_MS;
      }
    });

    // 7. Push to queue or show toast based on priority
    const highPriority = interactions.filter(i => i.priority === 'high');
    const mediumPriority = interactions.filter(i => i.priority === 'medium');
    const lowPriority = interactions.filter(i => i.priority === 'low');

    let newQueue = [...state.queue];
    let newToastQueue = [...state.toastQueue];
    let newToastIdCounter = state.toastIdCounter;

    // High priority: push to queue (shown as waypoint popup)
    highPriority.forEach(i => {
      newQueue = [...newQueue, i];
    });

    // Medium priority: show as toast with action button
    mediumPriority.forEach(i => {
      newToastIdCounter += 1;
      newToastQueue = [...newToastQueue, { ...i, id: newToastIdCounter }];
    });

    // Low priority: show as simple toast
    lowPriority.forEach(i => {
      newToastIdCounter += 1;
      newToastQueue = [...newToastQueue, { ...i, id: newToastIdCounter }];
    });

    // 8. Enforce queue limit (max 3, drop oldest low-priority)
    if (newQueue.length > 3) {
      const kept = [];
      let dropped = 0;
      for (const item of newQueue) {
        if (dropped < newQueue.length - 3 && item.priority === 'low') {
          dropped += 1;
          continue;
        }
        kept.push(item);
      }
      newQueue = kept;
    }

    // 9. Enforce toast limit (max 3 visible)
    if (newToastQueue.length > 3) {
      newToastQueue = newToastQueue.slice(-3);
    }

    set({
      cooldowns: newCooldowns,
      globalCooldownUntil: now + GLOBAL_COOLDOWN_MS,
      categoryCooldowns: newCategoryCooldowns,
      sessionPatterns: newSessionPatterns,
      queue: newQueue,
      toastQueue: newToastQueue,
      toastIdCounter: newToastIdCounter,
    });
  },

  /**
   * Dismiss a toast by ID.
   */
  dismissToast: (toastId) => {
    set((state) => ({
      toastQueue: state.toastQueue.filter(t => t.id !== toastId),
    }));
  },

  /**
   * Clear the pending interaction queue.
   */
  clearQueue: () => set({ queue: [] }),

  /**
   * Pop the next interaction from the queue (returns it).
   */
  dequeueNext: () => {
    const state = get();
    if (state.queue.length === 0) return null;
    const [next, ...rest] = state.queue;
    set({ queue: rest });
    return next;
  },

  /**
   * Reset session cooldowns (e.g., on new day).
   */
  resetSession: () => {
    set({
      sessionPatterns: new Set(),
      cooldowns: {},
      categoryCooldowns: {},
      globalCooldownUntil: 0,
    });
  },

  // --- Internal helpers ---

  _checkCooldown: (patternId) => {
    const cooldowns = get().cooldowns;
    return !cooldowns[patternId] || Date.now() > cooldowns[patternId];
  },

  _setCooldown: (patternId, durationMs) => {
    set((state) => ({
      cooldowns: {
        ...state.cooldowns,
        [patternId]: Date.now() + durationMs,
      },
    }));
  },
}));

// ── Helper Functions ──

function evaluateConditions(conditions, payload, appState) {
  for (const [key, value] of Object.entries(conditions)) {
    if (key === 'minStreak') {
      if ((appState.currentStreak || 0) < value) return false;
    } else if (key === 'timeOfDay') {
      if (value !== 'any') {
        const hour = new Date().getHours();
        if (value === 'morning' && (hour < 5 || hour >= 12)) return false;
        if (value === 'afternoon' && (hour < 12 || hour >= 17)) return false;
        if (value === 'evening' && (hour < 17 || hour >= 22)) return false;
        if (value === 'night' && (hour < 22 || hour >= 5)) return false;
      }
    } else if (key === 'minConfidence') {
      if ((appState.confidence || 0) < value) return false;
    }
    // Add more condition types as needed
  }
  return true;
}

function resolveVariables(pattern, payload, appState) {
  const resolved = {};

  for (const [key, def] of Object.entries(pattern.variables || {})) {
    let value;
    if (def.source === 'event') {
      value = getNestedValue(payload, def.path);
    } else if (def.source === 'state') {
      value = getNestedValue(appState, def.path);
    } else if (def.source === 'computed') {
      value = def.fn(payload, appState);
    } else if (def.default !== undefined) {
      value = def.default;
    } else {
      value = '';
    }
    // Coerce undefined to empty string so fillTemplate replaces the variable
    resolved[key] = value !== undefined ? value : '';
  }

  return resolved;
}

function fillTemplate(template, variables) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return variables[key] !== undefined ? variables[key] : `{${key}}`;
  });
}

function getNestedValue(obj, path) {
  if (!path) return undefined;
  return path.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object') return acc[part];
    return undefined;
  }, obj);
}
