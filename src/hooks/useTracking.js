import { useCallback } from 'react';
import { uid } from '../utils/helpers.js';

/**
 * Provides session tracking, streak calculation, and performance data helpers.
 */
export default function useTracking({ projects, sessions, activeSession, setSessions, setActiveSession, apiKey, setFocus, setPlanningDay }) {
  const todayStr = useCallback(() => new Date().toISOString().slice(0, 10), []);

  const sessionDurationMin = useCallback((s) => {
    const end = s.endTime ? new Date(s.endTime) : new Date();
    return Math.max(0, Math.round((end - new Date(s.startTime)) / 60000));
  }, []);

  const getSessionsForDay = useCallback((dateStr) =>
    sessions.filter(s => s.startTime.startsWith(dateStr)), [sessions]);

  const getSessionsForWeek = useCallback(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6); cutoff.setHours(0,0,0,0);
    return sessions.filter(s => new Date(s.startTime) >= cutoff);
  }, [sessions]);

  const getSessionsForMonth = useCallback(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return sessions.filter(s => new Date(s.startTime) >= start);
  }, [sessions]);

  const getTodayStats = useCallback(() => {
    const todaySessions = getSessionsForDay(todayStr()).filter(s => s.endTime);
    const totalMin = todaySessions.reduce((a, s) => a + sessionDurationMin(s), 0);
    const focusedMin = todaySessions.filter(s => sessionDurationMin(s) >= 25).reduce((a, s) => a + sessionDurationMin(s), 0);
    const productiveMin = todaySessions.filter(s => s.goalId).reduce((a, s) => a + sessionDurationMin(s), 0);
    const lastEnded = todaySessions.slice().sort((a,b) => new Date(b.endTime)-new Date(a.endTime))[0];
    const minSinceBreak = lastEnded ? Math.round((Date.now() - new Date(lastEnded.endTime)) / 60000) : 0;
    return { totalMin, focusedMin, productiveMin, minSinceBreak };
  }, [getSessionsForDay, todayStr, sessionDurationMin]);

  const startSession = useCallback((label = '', goalId = null) => {
    const s = { id: uid(), startTime: new Date().toISOString(), endTime: null, label, goalId };
    setActiveSession(s);
    setSessions(prev => [...prev, s]);
  }, [setActiveSession, setSessions]);

  const stopSession = useCallback(() => {
    if (!activeSession) return;
    const endTime = new Date().toISOString();
    setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, endTime } : s));
    setActiveSession(null);
  }, [activeSession, setSessions, setActiveSession]);

  const allCompletionDates = useCallback(() => {
    const dates = [];
    projects.forEach(p => {
      p.subtasks.forEach(s    => { if (s.completedAt) dates.push(new Date(s.completedAt)); });
      p.checkpoints.forEach(c => { if (c.completedAt) dates.push(new Date(c.completedAt)); });
    });
    return dates;
  }, [projects]);

  const calcStreak = useCallback(() => {
    const dateStrings = [...new Set(allCompletionDates().map(d => {
      const x = new Date(d); x.setHours(0,0,0,0); return x.getTime();
    }))].sort((a,b) => b-a);
    if (!dateStrings.length) return 0;
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
    const mostRecent = new Date(dateStrings[0]);
    if (mostRecent < yesterday) return 0;
    let streak = 1;
    for (let i = 1; i < dateStrings.length; i++) {
      if ((dateStrings[i-1] - dateStrings[i]) === 86400000) streak++;
      else break;
    }
    return streak;
  }, [allCompletionDates]);

  const getWeeklyData = useCallback(() => {
    const completions = allCompletionDates();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - (6-i));
      const end = new Date(d); end.setHours(23,59,59,999);
      return {
        day:     ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()],
        count:   completions.filter(c => c >= d && c <= end).length,
        isToday: i === 6,
      };
    });
  }, [allCompletionDates]);

  const getMonthlyData = useCallback(() => {
    const completions = allCompletionDates();
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const firstDow    = new Date(year, month, 1).getDay();
    return {
      firstDow,
      days: Array.from({ length: daysInMonth }, (_, i) => {
        const d   = new Date(year, month, i+1);
        const end = new Date(year, month, i+1, 23, 59, 59, 999);
        return {
          day:     i+1,
          count:   completions.filter(c => c >= d && c <= end).length,
          isToday: i+1 === now.getDate(),
        };
      }),
    };
  }, [allCompletionDates]);

  const planDay = useCallback(async () => {
    if (!projects.length) return;
    setPlanningDay(true);
    const { askAI } = await import('../utils/api.js');
    const { progress } = await import('../utils/helpers.js');
    const summary = projects.map(p => `"${p.title}" (${progress(p)}% done)`).join(', ');
    const system  = 'Return ONLY a JSON array of exactly 3 short strings (max 28 chars each) as focus areas for today. No explanation, no markdown.';
    const raw     = await askAI(system, `Goals: ${summary}. Suggest 3 focus areas for today.`, apiKey);
    try {
      const areas = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (Array.isArray(areas) && areas.length >= 3)
        setFocus([String(areas[0]), String(areas[1]), String(areas[2])]);
    } catch { /* empty — AI response parse failure is non-critical */ }
    setPlanningDay(false);
  }, [projects, apiKey, setFocus, setPlanningDay]);

  return {
    todayStr,
    sessionDurationMin,
    getSessionsForDay,
    getSessionsForWeek,
    getSessionsForMonth,
    getTodayStats,
    startSession,
    stopSession,
    allCompletionDates,
    calcStreak,
    getWeeklyData,
    getMonthlyData,
    planDay,
  };
}
