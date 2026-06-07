export function computePlanningConfidence(syncEvents) {
  const SATURATION = 40;
  if (!syncEvents?.length) return 0;
  const accepted  = syncEvents.filter(e => e.type === 'task_accepted').length;
  const rejected  = syncEvents.filter(e => e.type === 'task_rejected').length;
  const completed = syncEvents.filter(e => e.type === 'task_completed').length;
  const total     = accepted + rejected;
  const acceptance = total > 0 ? accepted / total : 0.5;
  const completion = accepted > 0 ? Math.min(completed / accepted, 1) : 0;
  // Only count meaningful decision events — not UI clicks like program_opened
  const meaningfulEvents = syncEvents.filter(e =>
    ['task_accepted', 'task_rejected', 'task_completed', 'briefing_done'].includes(e.type)
  );
  const richness   = Math.min(meaningfulEvents.length / SATURATION, 1);
  return Math.round((acceptance * 0.35 + completion * 0.45 + richness * 0.20) * 100);
}

export const NOVA_DEFAULT = {
  syncScore: 0,
  syncEvents: [],
  routine: null,
  programChats: { briefing: [], focus: null, regroup: [], preview: [] },
  suggestedTasks: [],
  dailyPlan: null,
  planGenLoading: false,
  planError: null,
  weeklyInsights: null,
};
