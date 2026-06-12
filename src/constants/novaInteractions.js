/**
 * NOVA Interaction Pattern Definitions
 *
 * Each pattern is a structured object that defines:
 *  - trigger: what event + conditions fire this pattern
 *  - cooldown: how long to wait before firing again
 *  - priority: low | medium | high
 *  - presentation: toast | waypoint | inline
 *  - template: the message template with {variable} slots
 *  - variables: how to resolve each variable (from event, state, or computed)
 *
 * Register these with the store via:
 *   import { registerPatterns } from '../store/novaInteractionStore';
 *   import { PATTERNS } from '../constants/novaInteractions';
 *   registerPatterns(PATTERNS);
 */

// ── Category A: Achievement & Momentum ──

const A1_TASK_COMPLETED = {
  id: 'A1_task_completed',
  trigger: {
    source: 'user_action',
    event: 'task_completed',
    conditions: { minStreak: 1 },
  },
  cooldown: { type: 'per-pattern', durationMs: 120_000 },
  priority: 'low',
  presentation: 'toast',
  template: {
    title: 'Nice work!',
    body: 'You just completed "{taskTitle}". Keep the momentum going!',
    action: { label: 'View Progress', type: 'open_insights', payload: {} },
  },
  variables: {
    taskTitle: { source: 'event', path: 'title' },
  },
};

const A2_STREAK_MILESTONE = {
  id: 'A2_streak_milestone',
  trigger: {
    source: 'performance_signal',
    event: 'streak_milestone',
    conditions: {},
  },
  cooldown: { type: 'per-pattern', durationMs: 300_000 },
  priority: 'medium',
  presentation: 'waypoint',
  template: {
    title: '🔥 {streakDays}-Day Streak!',
    body: 'You\'ve been consistent for {streakDays} days. {milestoneMessage}',
    action: { label: 'View Insights', type: 'open_insights', payload: {} },
  },
  variables: {
    streakDays: { source: 'state', path: 'currentStreak' },
    milestoneMessage: {
      source: 'computed',
      fn: (_payload, appState) => {
        const s = appState.currentStreak || 0;
        if (s >= 30) return 'A full month of momentum — incredible!';
        if (s >= 14) return 'Two weeks strong — this is becoming a habit!';
        if (s >= 7) return 'A full week of progress — you\'re on fire!';
        if (s >= 3) return 'Three days in a row — great start!';
        return 'Keep going!';
      },
    },
  },
};

const A3_DAY_COMPLETE = {
  id: 'A3_day_complete',
  trigger: {
    source: 'performance_signal',
    event: 'all_tasks_done',
    conditions: {},
  },
  cooldown: { type: 'per-pattern', durationMs: 300_000 },
  priority: 'medium',
  presentation: 'waypoint',
  template: {
    title: 'Day Complete! 🎉',
    body: 'You finished everything on your plate today. {windDownSuggestion}',
    action: { label: 'Preview Tomorrow', type: 'open_program', payload: { programId: 'preview' } },
  },
  variables: {
    windDownSuggestion: {
      source: 'computed',
      fn: () => {
        const suggestions = [
          'Time to wind down — maybe review what went well?',
          'Great discipline! Consider journaling about today\'s wins.',
          'All done! Use the remaining time for something restorative.',
        ];
        return suggestions[Math.floor(Math.random() * suggestions.length)];
      },
    },
  },
};

const A4_FIRST_WIN = {
  id: 'A4_first_win',
  trigger: {
    source: 'user_action',
    event: 'task_completed',
    conditions: { minStreak: 1 },
  },
  cooldown: { type: 'per-pattern', durationMs: 300_000 },
  priority: 'low',
  presentation: 'toast',
  template: {
    title: 'First win of the day!',
    body: 'You completed "{taskTitle}". The rest will follow.',
  },
  variables: {
    taskTitle: { source: 'event', path: 'title' },
  },
};

const A5_TASK_ACCEPTED = {
  id: 'A5_task_accepted',
  trigger: {
    source: 'user_action',
    event: 'task_accepted',
    conditions: {},
  },
  cooldown: { type: 'per-pattern', durationMs: 120_000 },
  priority: 'medium',
  presentation: 'toast',
  template: {
    title: 'Tasks accepted!',
    body: 'You\'ve added "{taskTitle}" to your schedule. Ready to get started?',
    action: { label: 'Start First Task', type: 'start_first_task', payload: {} },
  },
  variables: {
    taskTitle: { source: 'event', path: 'title' },
  },
};

// ── Category B: Check-in & Reflection ──

const B2_SESSION_OVERRAN = {
  id: 'B2_session_overran',
  trigger: {
    source: 'app_state_change',
    event: 'session_completed',
    conditions: {},
  },
  cooldown: { type: 'per-pattern', durationMs: 120_000 },
  priority: 'medium',
  presentation: 'toast',
  template: {
    title: 'Session overran estimate',
    body: 'Your "{taskTitle}" session took longer than expected. Would breaking it down help?',
    action: { label: 'Break Down', type: 'open_program', payload: { programId: 'focus' } },
  },
  variables: {
    taskTitle: { source: 'event', path: 'label' },
  },
};

const B3_IDLE_NUDGE = {
  id: 'B3_idle_nudge',
  trigger: {
    source: 'time_based',
    event: 'user_idle',
    conditions: {},
  },
  cooldown: { type: 'per-pattern', durationMs: 300_000 },
  priority: 'low',
  presentation: 'toast',
  template: {
    title: 'Still there?',
    body: 'You\'ve been idle for {durationMinutes} minutes. Need to log a distraction or resume?',
  },
  variables: {
    durationMinutes: { source: 'event', path: 'durationMinutes' },
  },
};

const B4_END_OF_DAY = {
  id: 'B4_end_of_day',
  trigger: {
    source: 'time_based',
    event: 'end_of_day',
    conditions: {},
  },
  cooldown: { type: 'per-pattern', durationMs: 60_000 },
  priority: 'medium',
  presentation: 'waypoint',
  template: {
    title: 'End of day — want to preview tomorrow?',
    body: 'You\'ve put in work today. Taking 5 minutes to plan tomorrow can save you 30 minutes of decision fatigue.',
    action: { label: 'Preview Tomorrow', type: 'open_program', payload: { programId: 'preview' } },
  },
  variables: {},
};

// ── Category C: Intervention & Correction ──

const C1_STREAK_BROKEN = {
  id: 'C1_streak_broken',
  trigger: {
    source: 'performance_signal',
    event: 'streak_broken',
    conditions: {},
  },
  cooldown: { type: 'per-pattern', durationMs: 600_000 },
  priority: 'high',
  presentation: 'waypoint',
  template: {
    title: 'Streak reset — that\'s okay',
    body: 'Your {previousStreak}-day streak ended. Every reset is a chance to build back stronger. Want to regroup?',
    action: { label: 'Regroup', type: 'open_program', payload: { programId: 'regroup' } },
  },
  variables: {
    previousStreak: { source: 'event', path: 'previousStreak' },
  },
};

const C2_MULTIPLE_DEFERRED = {
  id: 'C2_multiple_deferred',
  trigger: {
    source: 'performance_signal',
    event: 'tasks_deferred',
    conditions: {},
  },
  cooldown: { type: 'per-pattern', durationMs: 600_000 },
  priority: 'high',
  presentation: 'waypoint',
  template: {
    title: 'Noticing some deferrals',
    body: 'You\'ve deferred {deferredCount} tasks recently. This might mean your workload needs adjusting.',
    action: { label: 'Review Workload', type: 'open_program', payload: { programId: 'regroup' } },
  },
  variables: {
    deferredCount: { source: 'event', path: 'count' },
  },
};

const C3_LOW_FOCUS_RATING = {
  id: 'C3_low_focus_rating',
  trigger: {
    source: 'app_state_change',
    event: 'focus_rated',
    conditions: {},
  },
  cooldown: { type: 'per-pattern', durationMs: 300_000 },
  priority: 'medium',
  presentation: 'toast',
  template: {
    title: 'Tough session?',
    body: 'You rated that session a {rating}/5. Sometimes regrouping helps — want to try?',
    action: { label: 'Regroup', type: 'open_program', payload: { programId: 'regroup' } },
  },
  variables: {
    rating: { source: 'event', path: 'rating' },
  },
};

const C4_HIGH_REJECTION = {
  id: 'C4_high_rejection',
  trigger: {
    source: 'performance_signal',
    event: 'suggestion_rejected',
    conditions: {},
  },
  cooldown: { type: 'per-pattern', durationMs: 600_000 },
  priority: 'high',
  presentation: 'waypoint',
  template: {
    title: 'NOVA suggestions not landing?',
    body: 'You\'ve declined several suggestions recently. Maybe your goals need recalibration?',
    action: { label: 'Review Goals', type: 'open_program', payload: { programId: 'briefing' } },
  },
  variables: {
    rejectionRate: { source: 'event', path: 'rate' },
  },
};

// ── Category D: Proactive Suggestions ──

const D1_BRIEFING_REMINDER = {
  id: 'D1_briefing_reminder',
  trigger: {
    source: 'time_based',
    event: 'app_opened',
    conditions: { timeOfDay: 'morning' },
  },
  cooldown: { type: 'per-pattern', durationMs: 600_000 },
  priority: 'medium',
  presentation: 'waypoint',
  template: {
    title: 'Good morning — ready to brief?',
    body: 'Starting with a quick briefing helps set the tone for the day. It only takes a few minutes.',
    action: { label: 'Open Briefing', type: 'open_program', payload: { programId: 'briefing' } },
  },
  variables: {},
};

const D2_GOAL_CREATED = {
  id: 'D2_goal_created',
  trigger: {
    source: 'user_action',
    event: 'goal_created',
    conditions: {},
  },
  cooldown: { type: 'per-pattern', durationMs: 120_000 },
  priority: 'low',
  presentation: 'toast',
  template: {
    title: 'New goal created!',
    body: '"{goalTitle}" has been added. Want to break it down into actionable steps?',
    action: { label: 'Break Down', type: 'open_waypoint', payload: {} },
  },
  variables: {
    goalTitle: { source: 'event', path: 'title' },
  },
};

const D3_DEADLINE_URGENT = {
  id: 'D3_deadline_urgent',
  trigger: {
    source: 'performance_signal',
    event: 'deadline_approaching',
    conditions: {},
  },
  cooldown: { type: 'per-pattern', durationMs: 600_000 },
  priority: 'high',
  presentation: 'waypoint',
  template: {
    title: '⏰ Deadline approaching: {goalTitle}',
    body: 'This goal is due in {daysRemaining} days and is only {progress}% complete. Time to reprioritize?',
    action: { label: 'View Goal', type: 'open_waypoint', payload: {} },
  },
  variables: {
    goalTitle: { source: 'event', path: 'title' },
    daysRemaining: { source: 'event', path: 'daysRemaining' },
    progress: { source: 'event', path: 'progress' },
  },
};

const D4_LOW_COMPLETION = {
  id: 'D4_low_completion',
  trigger: {
    source: 'performance_signal',
    event: 'low_completion_rate',
    conditions: {},
  },
  cooldown: { type: 'per-pattern', durationMs: 600_000 },
  priority: 'medium',
  presentation: 'waypoint',
  template: {
    title: 'Slower week?',
    body: 'You\'ve been completing fewer tasks than usual. Maybe the scope needs adjusting?',
    action: { label: 'Regroup', type: 'open_program', payload: { programId: 'regroup' } },
  },
  variables: {
    avgPerDay: { source: 'event', path: 'avgPerDay' },
  },
};

// ── Category E: Contextual Awareness ──

const E1_PAGE_TIP = {
  id: 'E1_page_tip',
  trigger: {
    source: 'app_state_change',
    event: 'page_navigated',
    conditions: {},
  },
  cooldown: { type: 'per-pattern', durationMs: 600_000 },
  priority: 'low',
  presentation: 'toast',
  template: {
    title: 'Tip for {pageName}',
    body: '{tipText}',
  },
  variables: {
    pageName: { source: 'event', path: 'page' },
    tipText: {
      source: 'computed',
      fn: (payload) => {
        const tips = {
          onward: 'Drag subtasks from goals directly into time slots to schedule your day.',
          map: 'Use the map to see how your goals connect and overlap.',
          paths: 'Paths show your long-term trajectory across different areas.',
          skills: 'Track skill growth by logging evidence from completed tasks.',
          constellation: 'Your goals form a solar system — drag to rearrange.',
        };
        return tips[payload.page] || 'Explore around to discover features.';
      },
    },
  },
};

const E2_GOAL_INSIGHT = {
  id: 'E2_goal_insight',
  trigger: {
    source: 'app_state_change',
    event: 'goal_opened',
    conditions: {},
  },
  cooldown: { type: 'per-pattern', durationMs: 300_000 },
  priority: 'low',
  presentation: 'inline',
  template: {
    title: 'Related insight',
    body: '{insightText}',
  },
  variables: {
    insightText: {
      source: 'computed',
      fn: (_payload, appState) => {
        const knowledge = appState.knowledgePool || [];
        if (knowledge.length > 0) {
          const random = knowledge[Math.floor(Math.random() * knowledge.length)];
          return `From your knowledge pool: "${random.text}"`;
        }
        return 'Track insights here as you work on this goal.';
      },
    },
  },
};

// ── Export all patterns ──

export const PATTERNS = [
  A1_TASK_COMPLETED,
  A2_STREAK_MILESTONE,
  A3_DAY_COMPLETE,
  A4_FIRST_WIN,
  A5_TASK_ACCEPTED,
  B2_SESSION_OVERRAN,
  B3_IDLE_NUDGE,
  B4_END_OF_DAY,
  C1_STREAK_BROKEN,
  C2_MULTIPLE_DEFERRED,
  C3_LOW_FOCUS_RATING,
  C4_HIGH_REJECTION,
  D1_BRIEFING_REMINDER,
  D2_GOAL_CREATED,
  D3_DEADLINE_URGENT,
  D4_LOW_COMPLETION,
  E1_PAGE_TIP,
  E2_GOAL_INSIGHT,
];
