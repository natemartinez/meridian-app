import { useState, useEffect, useRef, useCallback } from 'react';
import { chatWithNOVA, askAI } from '../utils/api.js';
import { uid, progress } from '../utils/helpers.js';
import { buildFullKnowledgeBlock, buildLightKnowledgeContext, buildStructuredKnowledgeBlock, decayKnowledge, markEntriesUsed } from '../utils/knowledge.js';
import { computePlanningConfidence, NOVA_DEFAULT, validateNOVAResponse, updatePlanAccuracyHistory } from '../utils/nova.js';
import { useNovaRetry } from './useNovaRetry.js';

export function useNOVA({ apiKey, projects, focus, waypointContext, loaded }) {
  const [novaState, setNovaState] = useState(() => {
    try {
      const s = localStorage.getItem('meridian_nova_v1');
      if (!s) return NOVA_DEFAULT;
      return { ...NOVA_DEFAULT, ...JSON.parse(s), planGenLoading: false };
    } catch { return NOVA_DEFAULT; }
  });
  const [novaChatInput, setNovaChatInput] = useState('');
  const [novaLoading, setNovaLoading]     = useState(false);
  const [novaSessionKey, setNovaSessionKey] = useState(0);
  const [knowledgePool, setKnowledgePool] = useState(() => {
    try {
      const s = localStorage.getItem('meridian_knowledge_pool_v1');
      if (!s) return { entries: [], corrections: '', lastUpdated: null };
      return JSON.parse(s);
    } catch { return { entries: [], corrections: '', lastUpdated: null }; }
  });

  const novaRetry = useNovaRetry({
    maxRetries: 5,
    cooldownMs: 5000,
    cacheKey: 'meridian_nova_cache',
    onSuccess: (data, attempts) => {
      // NOVA request succeeded — no action needed
    },
    onError: (error) => {
      console.error('[NOVA] Request failed after all retries:', error.message);
    },
  });

  const knowledgePoolRef = useRef(knowledgePool);
  useEffect(() => { knowledgePoolRef.current = knowledgePool; }, [knowledgePool]);

  // Tracks knowledge entry IDs used by buildNOVASystemPrompt so we can apply
  // markEntriesUsed in a useEffect (not during render, which would cause
  // "Cannot update a component while rendering a different component" in React 19).
  const lastUsedEntryIdsRef = useRef(null);

  // Persist NOVA state
  useEffect(() => { localStorage.setItem('meridian_nova_v1', JSON.stringify(novaState)); }, [novaState]);
  useEffect(() => { localStorage.setItem('meridian_knowledge_pool_v1', JSON.stringify(knowledgePool)); }, [knowledgePool]);

  // Knowledge decay effect — periodically decay AI-inferred entries
  useEffect(() => {
    const runDecay = () => {
      setKnowledgePool(prev => decayKnowledge(prev));
    };
    runDecay(); // Run on mount
    const interval = setInterval(runDecay, 3600000); // Every hour
    return () => clearInterval(interval);
  }, []);

  // Apply markEntriesUsed after render (not during render) to avoid React 19
  // "Cannot update a component while rendering a different component" error.
  // buildNOVASystemPrompt stores used entry IDs in lastUsedEntryIdsRef instead
  // of calling setKnowledgePool directly.
  useEffect(() => {
    if (lastUsedEntryIdsRef.current) {
      setKnowledgePool(prev => markEntriesUsed(prev, lastUsedEntryIdsRef.current));
      lastUsedEntryIdsRef.current = null;
    }
  });

  // Seed initial Knowledge Pool entries on first load (when pool is empty)
  useEffect(() => {
    if (knowledgePool.entries.length > 0) return;
    const now = new Date().toISOString();
    const seedEntries = [
      { id: uid(), cat: 'prefs', text: 'Prefers 90-120 minute uninterrupted work blocks', source: 'manual', conf: 1, createdAt: now, updatedAt: now },
      { id: uid(), cat: 'prefs', text: 'Uses Briefing program for daily planning each morning', source: 'manual', conf: 1, createdAt: now, updatedAt: now },
      { id: uid(), cat: 'work', text: 'Plans the day during morning Briefing session', source: 'manual', conf: 1, createdAt: now, updatedAt: now },
      { id: uid(), cat: 'goals', text: 'Wants to make steady progress on active projects daily', source: 'manual', conf: 1, createdAt: now, updatedAt: now },
    ];
    setKnowledgePool(prev => ({
      ...prev,
      entries: seedEntries,
      lastUpdated: now,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally narrow — one-time seed on mount

  const addSyncEvent = useCallback((type, detail = '') => {
    const POINTS = { task_accepted: 5, task_completed: 10, briefing_done: 5, task_rejected: -2 };
    const delta = POINTS[type] ?? 0;
    setNovaState(prev => ({
      ...prev,
      syncScore: Math.min(100, Math.max(0, prev.syncScore + delta)),
      syncEvents: [...prev.syncEvents, { type, detail, ts: Date.now() }].slice(-200),
    }));
  }, []);

  const onNewSession = useCallback((programId) => {
    const isFocus = programId === 'focus';
    setNovaState(prev => ({
      ...prev,
      programChats: { ...prev.programChats, [programId]: isFocus ? null : [] },
      suggestedTasks: [],
    }));
    setNovaSessionKey(k => k + 1);
  }, []);

  const addKnowledgeEntry = useCallback((cat, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setKnowledgePool(prev => {
      if (prev.entries.filter(e => e.cat === cat).length >= 20) {
        console.warn('[KnowledgePool] Soft limit reached for category:', cat);
      }
      const now = new Date().toISOString();
      return {
        ...prev,
        entries: [...prev.entries, { id: uid(), cat, text: trimmed, source: 'manual', conf: 1, createdAt: now, updatedAt: now }],
        lastUpdated: now,
      };
    });
  }, []);

  const deleteKnowledgeEntry = useCallback((id) => {
    setKnowledgePool(prev => ({
      ...prev,
      entries: prev.entries.filter(e => e.id !== id),
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  const editKnowledgeEntry = useCallback((id, newText) => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    setKnowledgePool(prev => ({
      ...prev,
      entries: prev.entries.map(e =>
        e.id === id ? { ...e, text: trimmed, source: 'manual', conf: 1, updatedAt: now } : e
      ),
      lastUpdated: now,
    }));
  }, []);

  const updateCorrections = useCallback((text) => {
    setKnowledgePool(prev => ({ ...prev, corrections: text, lastUpdated: new Date().toISOString() }));
  }, []);

  const addInferredEntries = useCallback((newEntries) => {
    if (!Array.isArray(newEntries) || newEntries.length === 0) return;
    const validCats = new Set(['work', 'goals', 'prefs', 'context']);
    const current = knowledgePoolRef.current;
    const existingTexts = new Set(current.entries.map(e => e.text.toLowerCase().trim()));
    const filtered = newEntries
      .filter(e => validCats.has(e.cat) && typeof e.text === 'string' && e.text.trim())
      .filter(e => !existingTexts.has(e.text.toLowerCase().trim()))
      .map(e => {
        const now = new Date().toISOString();
        return { id: uid(), cat: e.cat, text: e.text.trim(), source: 'ai', conf: Math.min(1, Math.max(0, Number(e.conf) || 0.5)), createdAt: now, updatedAt: now };
      });
    if (filtered.length === 0) return;
    setKnowledgePool(prev => ({
      ...prev,
      entries: [...prev.entries, ...filtered],
      lastUpdated: new Date().toISOString(),
    }));
  }, []);

  const buildNOVASystemPrompt = useCallback((programId) => {
    const goalsSummary = projects.filter(p => !p.completedAt)
      .map(p => `"${p.title}" (${progress(p)}% done)`).join(', ') || 'none';
    const focusSummary = focus.filter(Boolean).join(', ') || 'none';
    const confidence   = computePlanningConfidence(novaState.syncEvents);
    const routineNote  = novaState.routine ? `Known pattern: ${novaState.routine.summary}` : '';
    // Use structured bullet-point format for weaker models, prose for stronger ones
    const kbResult = buildStructuredKnowledgeBlock(knowledgePool);
    const knowledgeBlock = kbResult.text || buildFullKnowledgeBlock(knowledgePool).text || '';
    // Track which entries were used for decay purposes — store in ref to apply
    // in a useEffect (NOT during render, to avoid React 19 concurrent rendering error:
    // "Cannot update a component while rendering a different component")
    if (kbResult.usedEntryIds?.length > 0) {
      lastUsedEntryIdsRef.current = kbResult.usedEntryIds;
    }
    const base = `You are NOVA, a productivity companion and psychological coach. Planning confidence with this user: ${confidence}%. ${confidence < 30 ? 'Ask more questions to learn their patterns.' : confidence > 70 ? 'You know this user well — make bold, specific suggestions.' : 'Balance questions with suggestions.'} Active goals: ${goalsSummary}. Today's focus: ${focusSummary}. ${routineNote} Psychological coaching scope: stress reduction, task breakdown, work tips only — not personal therapy.${knowledgeBlock}`;

    if (programId === 'briefing') return `${base} This is a morning Briefing. Your FIRST message must be EXACTLY this mindset check-in: "On a scale of 1–5, how's your headspace going into today?" Use their score to calibrate: 1-2 = more coaching and task breakdown; 3 = balanced; 4-5 = jump straight to daily planning. Plan only for TODAY — not the week, not the month. Ask one question at a time. When the user says they feel ready, end your message with the exact token: [READY]`;

    if (programId === 'focus') return `${base} The user wants to lock in on a task. Respond with ONLY a clean bulleted action plan (3–7 steps). No preamble, no sign-off, no conversation. Start each bullet with an action verb. If the task sounds overwhelming, silently break it into smaller steps.`;

    if (programId === 'regroup') return `${base} The user has lost momentum. Your FIRST message must be: "What happened — did something interrupt you, or did you just lose the thread?" Be grounding, not motivational. Ask one question at a time. If you detect stress signals, offer one brief tip (breathing, task reframing, or size reduction).`;

    if (programId === 'preview') {
      const now = new Date();
      const hour = now.getHours();
      const min = now.getMinutes();
      const timeStr = `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
      // After midnight (0-5 AM): "next day" = later today
      // Evening (18-23) or daytime (6-17): "next day" = tomorrow
      const isAfterMidnight = hour >= 0 && hour < 6;
      const horizon = isAfterMidnight ? 'later today' : 'tomorrow';

      // Build yesterday's completion summary
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();
      const yesterdayCompletions = projects
        .flatMap(p => p.subtasks || [])
        .filter(s => s.completedAt && new Date(s.completedAt).toDateString() === yesterdayStr)
        .length;

      // Build today's onward schedule summary
      const today = new Date().toDateString();
      const todayTasks = (novaState.dailyPlan?.date === today ? novaState.dailyPlan.items : [])
        .map(i => `  - ${i.title} (${i.estimatedMinutes}min)`)
        .join('\n');

      return `${base} It's currently ${timeStr}. The user is planning for ${horizon}. Yesterday they completed ${yesterdayCompletions} subtasks.${todayTasks ? `\n\nToday's existing plan:\n${todayTasks}` : ''}\n\nYour FIRST message must be: "It's ${timeStr} — let's plan ${horizon}. What's top of mind?" Be concise. Suggest 2-4 specific tasks based on active goals and what's unfinished. Ask one question at a time. When the user seems satisfied, end with the exact token: [READY]`;
    }

    return base;
  }, [projects, focus, novaState.syncEvents, novaState.routine, knowledgePool, novaState.dailyPlan]);

  // Auto-start NOVA programs when waypoint opens
  useEffect(() => {
    if (!loaded) return;
    if (waypointContext?.type !== 'program') return;
    const progId = waypointContext.id;
    if (progId === 'focus') return;
    const history = novaState.programChats[progId] || [];
    if (history.length > 0) return;
    if (novaLoading) return;
    if (!apiKey) return;

    const systemPrompt = buildNOVASystemPrompt(progId);
    setNovaLoading(true);
    novaRetry.executeWithRetry(() =>
      chatWithNOVA([
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: 'Hello' },
      ], apiKey)
    ).then(reply => {
      const data = typeof reply === 'object' && reply.data ? reply.data : reply;
      const cleanReply = data.replace('[READY]', '').trim();
      setNovaState(prev => ({
        ...prev,
        programChats: { ...prev.programChats, [progId]: [{ role: 'assistant', content: cleanReply }] },
      }));
    }).finally(() => setNovaLoading(false));
  }, [waypointContext?.type, waypointContext?.id, apiKey, buildNOVASystemPrompt, loaded, novaSessionKey, novaRetry, novaLoading, novaState.programChats]);

  const extractNOVAInsights = useCallback(async (programId, messages) => {
    if (!apiKey || messages.length < 3) return;
    const transcript = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    const raw = await chatWithNOVA([
      { role: 'system', content: 'You are a JSON API. Respond with ONLY a raw JSON object and nothing else. No markdown, no code fences.' },
      { role: 'user', content: `Analyze this productivity coaching conversation and extract:\n1. routine_update: one sentence describing the user's work patterns revealed in this chat\n2. suggested_tasks: array of 2–4 specific actionable task strings\n3. knowledge_entries: array of 0–4 objects, each { "cat": "work"|"goals"|"prefs"|"context", "text": string (max 120 chars, factual present-tense), "conf": number 0–1 }\n   - Only include entries you are confident about\n   - "work" = habits/style; "goals" = objectives/motivations; "prefs" = tool/process preferences; "context" = personal/situational facts\n   - Leave empty if nothing clear was revealed\n\nConversation:\n${transcript}\n\nRespond with exactly: {"routine_update":"...","suggested_tasks":["..."],"knowledge_entries":[{"cat":"work","text":"...","conf":0.85}]}` },
    ], apiKey);
    try {
      const cleaned = raw.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
      const parsed  = JSON.parse(cleaned);
      // Build pending insights instead of directly mutating state
      const pending = [];
      if (parsed.routine_update) {
        pending.push({
          id: uid(),
          type: 'routine',
          content: parsed.routine_update,
          source: programId,
          createdAt: Date.now(),
        });
      }
      if (Array.isArray(parsed.suggested_tasks)) {
        parsed.suggested_tasks.forEach(t => {
          pending.push({
            id: uid(),
            type: 'task',
            content: t,
            source: programId,
            createdAt: Date.now(),
          });
        });
      }
      if (Array.isArray(parsed.knowledge_entries)) {
        parsed.knowledge_entries.forEach(e => {
          pending.push({
            id: uid(),
            type: 'knowledge',
            content: e,
            source: programId,
            createdAt: Date.now(),
          });
        });
      }
      if (pending.length > 0) {
        setNovaState(prev => ({
          ...prev,
          pendingInsights: [...(prev.pendingInsights || []), ...pending],
        }));
      }
    } catch { /* silently ignore parse errors */ }
  }, [apiKey]);

  const confirmInsight = useCallback((insightId) => {
    setNovaState(prev => {
      const insight = (prev.pendingInsights || []).find(i => i.id === insightId);
      if (!insight) return prev;
      const remaining = (prev.pendingInsights || []).filter(i => i.id !== insightId);
      if (insight.type === 'routine') {
        return {
          ...prev,
          routine: { summary: insight.content, lastUpdated: new Date().toISOString() },
          pendingInsights: remaining,
        };
      }
      if (insight.type === 'knowledge') {
        // Add to knowledge pool via addInferredEntries
        addInferredEntries([insight.content]);
        return { ...prev, pendingInsights: remaining };
      }
      if (insight.type === 'task') {
        return {
          ...prev,
          suggestedTasks: [...(prev.suggestedTasks || []), { id: uid(), text: insight.content, source: insight.source, accepted: null }],
          pendingInsights: remaining,
        };
      }
      return { ...prev, pendingInsights: remaining };
    });
  }, [addInferredEntries]);

  const dismissInsight = useCallback((insightId) => {
    setNovaState(prev => ({
      ...prev,
      pendingInsights: (prev.pendingInsights || []).filter(i => i.id !== insightId),
    }));
  }, []);

  /**
   * Record plan accuracy by comparing completed tasks against the daily plan.
   * Called when tasks are checked off to build a feedback loop.
   */
  const recordPlanAccuracy = useCallback(() => {
    const plan = novaState.dailyPlan;
    if (!plan?.items?.length) return;
    const today = new Date().toISOString().slice(0, 10);
    if (plan.date !== today) return;
    // Count how many plan items have matching completed subtasks
    const completedPlanItems = plan.items.filter(item => {
      return projects.some(p =>
        (p.subtasks || []).some(s =>
          s.done && s.title.toLowerCase().includes(item.title.toLowerCase().slice(0, 20))
        )
      );
    });
    const accuracy = completedPlanItems.length / plan.items.length;
    setNovaState(prev => ({
      ...prev,
      planAccuracy: updatePlanAccuracyHistory(prev.planAccuracy?.history || [], {
        date: today,
        planned: plan.items.length,
        completed: completedPlanItems.length,
        accuracy,
      }),
    }));
  }, [novaState.dailyPlan, projects]);

  const generateNovaPlanRef = useRef(null);

  /**
   * Real-time knowledge inference — lightweight extraction during conversation.
   * Fire-and-forget: never blocks the main message flow.
   * Results go to pendingInsights for user confirmation.
   */
  const inferKnowledgeFromMessage = useCallback(async (userText, programId) => {
    if (!apiKey || userText.trim().length < 20) return;
    try {
      const system = 'You are a knowledge extraction API. Return ONLY a JSON array or empty array. Each item: {"cat":"work"|"goals"|"prefs"|"context","text":"factual present-tense statement (max 80 chars)","conf":0.0-1.0}. Only extract if the user reveals something new about their work style, preferences, goals, or context. Otherwise return [].';
      const result = await chatWithNOVA([
        { role: 'system', content: system },
        { role: 'user', content: `Extract any new knowledge from this message: "${userText}"` },
      ], apiKey);
      const cleaned = result.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
      const entries = JSON.parse(cleaned);
      if (Array.isArray(entries) && entries.length > 0) {
        const pending = entries.map(e => ({
          id: uid(),
          type: 'knowledge',
          content: { cat: e.cat, text: e.text, conf: Math.min(0.6, e.conf || 0.3) },
          source: `${programId}_realtime`,
          createdAt: Date.now(),
        }));
        setNovaState(prev => ({
          ...prev,
          pendingInsights: [...(prev.pendingInsights || []), ...pending],
        }));
      }
    } catch {
      // Silently fail — real-time inference is best-effort
    }
  }, [apiKey]);

  const sendNOVAMessage = useCallback(async (programId, overrideText) => {
    const text = (overrideText || novaChatInput).trim();
    if (!text || novaLoading || !apiKey) return;
    if (!overrideText) setNovaChatInput('');

    const systemPrompt = buildNOVASystemPrompt(programId);
    const currentHistory = novaState.programChats[programId] || [];

    if (programId === 'focus') {
      const userMsg = { role: 'user', content: text };
      setNovaState(prev => ({
        ...prev,
        programChats: { ...prev.programChats, focus: '__loading__' },
      }));
      setNovaLoading(true);
      try {
        const reply = await novaRetry.executeWithRetry(
          () => chatWithNOVA([{ role: 'system', content: systemPrompt }, userMsg], apiKey)
        ).then(r => r.data);
        // Validate response
        const validation = validateNOVAResponse(reply, programId);
        if (!validation.valid) {
          console.warn(`[NOVA] Response validation failed for ${programId}: ${validation.reason}`);
        }
        setNovaState(prev => ({
          ...prev,
          programChats: { ...prev.programChats, focus: reply },
          lastValidation: validation.valid ? null : validation,
        }));
      } finally { setNovaLoading(false); }
      return;
    }

    const updatedHistory = [...currentHistory, { role: 'user', content: text }];
    setNovaState(prev => ({
      ...prev,
      programChats: { ...prev.programChats, [programId]: updatedHistory },
    }));
    setNovaLoading(true);

    // Fire-and-forget real-time knowledge inference (non-blocking)
    if (programId !== 'focus') {
      inferKnowledgeFromMessage(text, programId);
    }
    try {
      const apiHistory = updatedHistory[0]?.role === 'assistant'
        ? [{ role: 'user', content: 'Hello' }, ...updatedHistory]
        : updatedHistory;
      const messages = [{ role: 'system', content: systemPrompt }, ...apiHistory];
      const reply    = await novaRetry.executeWithRetry(
        () => chatWithNOVA(messages, apiKey)
      ).then(r => r.data);
      // Validate response
      const validation = validateNOVAResponse(reply, programId);
      if (!validation.valid) {
        console.warn(`[NOVA] Response validation failed for ${programId}: ${validation.reason}`);
      }
      const isReady  = reply.includes('[READY]');
      const cleanReply = reply.replace('[READY]', '').trim();
      const finalHistory = [...updatedHistory, { role: 'assistant', content: cleanReply }];
      setNovaState(prev => ({
        ...prev,
        programChats: { ...prev.programChats, [programId]: finalHistory },
        lastValidation: validation.valid ? null : validation,
      }));
      if (isReady) {
        addSyncEvent('briefing_done', programId);
        extractNOVAInsights(programId, finalHistory);
        generateNovaPlanRef.current?.();
      }
    } finally { setNovaLoading(false); }
  }, [novaChatInput, novaLoading, apiKey, novaState, buildNOVASystemPrompt, addSyncEvent, extractNOVAInsights, novaRetry, inferKnowledgeFromMessage]);

  // Internal helpers for generateNovaPlan (same logic as App.jsx's calcStreak/getWeeklyData)
  const allCompletionDates = () => {
    const dates = [];
    projects.forEach(p => {
      p.subtasks.forEach(s    => { if (s.completedAt) dates.push(new Date(s.completedAt)); });
      p.checkpoints.forEach(c => { if (c.completedAt) dates.push(new Date(c.completedAt)); });
    });
    return dates;
  };

  const calcStreak = () => {
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
  };

  const getWeeklyData = () => {
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
  };

  const generateNovaPlan = useCallback(async (userPriorities) => {
    if (!apiKey || novaState.planGenLoading) return;

    // Dynamic confidence threshold based on plan accuracy history
    const confidence = computePlanningConfidence(novaState.syncEvents);
    const baseThreshold = 80;
    const accuracyBonus = novaState.planAccuracy?.movingAverage
      ? Math.round((novaState.planAccuracy.movingAverage - 0.5) * 40) // -20 to +20
      : 0;
    const effectiveThreshold = Math.max(50, Math.min(95, baseThreshold - accuracyBonus));
    if (confidence < effectiveThreshold) {
      setNovaState(prev => ({
        ...prev,
        planGenLoading: false,
        dailyPlan: null,
        planError: `NOVA confidence is ${confidence}% — needs to be at least ${effectiveThreshold}% to generate a reliable plan. ${accuracyBonus < 0 ? 'Previous plans have had low accuracy, so NOVA is being more cautious.' : 'Complete more Briefings and accept/reject tasks to improve confidence.'}`,
      }));
      return;
    }

    const activeGoals = projects.filter(p => !p.completedAt);
    const goalContext = activeGoals.length
      ? activeGoals.map(p => {
          const subs = p.subtasks.filter(s => !s.done).map(s => `  - [subtask] ${s.title}`).join('\n');
          const cps  = p.checkpoints.filter(c => !c.done).map(c => `  - [milestone] ${c.title}`).join('\n');
          const pct  = progress(p);
          const dl   = p.deadline ? ` | deadline: ${p.deadline}` : '';
          const pri  = p.priority === 'high' ? ' | HIGH PRIORITY' : '';
          return `Goal: "${p.title}" (${pct}% complete${dl}${pri})\n${subs}\n${cps}`;
        }).join('\n\n')
      : 'No active goals. Generate general productivity tasks.';

    const streak    = calcStreak();
    const weekly    = getWeeklyData();
    const avgPerDay = weekly.length
      ? (weekly.reduce((s, d) => s + d.count, 0) / weekly.length).toFixed(1)
      : '0';
    const routineNote = novaState.routine?.summary || 'No work pattern established yet.';
    const lightCtx    = buildLightKnowledgeContext(knowledgePool);

    // Determine plan start time based on whether we're planning for today or tomorrow
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const isPlanningForTomorrow = currentHour >= 18; // After 6pm, plan for tomorrow
    const planDate = new Date();
    if (isPlanningForTomorrow) planDate.setDate(planDate.getDate() + 1);
    const planDateStr = planDate.toISOString().slice(0, 10);

    // Start time: if planning for today, start at current time (rounded to next 15min);
    // if planning for tomorrow, start at 11:00 AM
    let startHour, startMinute;
    if (isPlanningForTomorrow) {
      startHour = 11;
      startMinute = 0;
    } else {
      // Round current time up to next 15-minute increment
      startHour = currentHour;
      startMinute = Math.ceil(currentMinute / 15) * 15;
      if (startMinute >= 60) {
        startHour += 1;
        startMinute = 0;
      }
    }
    const startTimeMinutes = startHour * 60 + startMinute;

    const system = (`You are NOVA, an AI planning engine. Return ONLY a raw JSON array — no markdown, no explanation. Each item: { "title": string (max 60 chars), "goalId": string|null, "goalTitle": string|null, "estimatedMinutes": number (15-120), "complexity": "low"|"medium"|"high", "rationale": string (max 80 chars) }. Generate exactly 5 to 7 tasks. Mix urgent deadline work with steady progress on longer goals.${lightCtx ? ' ' + lightCtx : ''}`).trim();

    const priorityContext = userPriorities && userPriorities.trim()
      ? `\n\nUSER'S PRIORITIES:\n${userPriorities.trim()}`
      : '';

    const userMsg = `Plan my day.

ACTIVE GOALS AND INCOMPLETE WORK:
${goalContext}

PERFORMANCE SIGNALS:
- Current streak: ${streak} day(s)
- Average tasks completed per day (last 7 days): ${avgPerDay}
- Nova planning confidence: ${confidence}%
- My work pattern: ${routineNote}

Today is ${planDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.
Plan start time: ${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}
${isPlanningForTomorrow ? 'This plan is for TOMORROW.' : 'This plan is for TODAY.'}
${priorityContext}

Return a JSON array of 5-7 tasks for ${isPlanningForTomorrow ? 'tomorrow' : 'today'}. Use the exact goalId strings from the goals above, or null for general tasks. Each task should be scheduled sequentially starting from the plan start time, with the estimatedMinutes determining the duration of each block.`;

    setNovaState(prev => ({ ...prev, planGenLoading: true, planError: null }));
    try {
      const result  = await novaRetry.executeWithRetry(
        () => askAI(system, userMsg, apiKey)
      );
      const raw     = result.data;
      const cleaned = raw.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
      const parsed  = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length >= 5) {
        // Build sequential time blocks starting from startTimeMinutes
        let currentTimeOffset = 0;
        setNovaState(prev => ({
          ...prev,
          dailyPlan: {
            date: planDateStr,
            generatedAt: new Date().toISOString(),
            startTimeMinutes,
            isTomorrow: isPlanningForTomorrow,
            items: parsed.map(item => {
              const estimatedMinutes = Math.min(120, Math.max(15, Number(item.estimatedMinutes) || 30));
              const itemStart = startTimeMinutes + currentTimeOffset;
              currentTimeOffset += estimatedMinutes;
              return {
                id: uid(),
                title: String(item.title || '').slice(0, 60),
                goalId: item.goalId || null,
                goalTitle: item.goalTitle || null,
                estimatedMinutes,
                startMinutes: itemStart,
                complexity: ['low','medium','high'].includes(item.complexity) ? item.complexity : 'medium',
                rationale: String(item.rationale || '').slice(0, 80),
              };
            }),
          },
          planGenLoading: false,
        }));
      } else {
        setNovaState(prev => ({ ...prev, planGenLoading: false }));
      }
    } catch {
      setNovaState(prev => ({ ...prev, planGenLoading: false }));
    }
  }, [apiKey, projects, novaState.planGenLoading, novaState.syncEvents, novaState.routine, novaState.planAccuracy, knowledgePool, novaRetry]);

  generateNovaPlanRef.current = generateNovaPlan;

  // Startup: generate daily plan if stale (only if confidence >= 80%)
  useEffect(() => {
    if (!apiKey) return;
    const today = new Date().toISOString().slice(0, 10);
    const plan  = novaState.dailyPlan;
    const confidence = computePlanningConfidence(novaState.syncEvents);
    if ((!plan || plan.date !== today) && !novaState.planGenLoading && confidence >= 80) {
      generateNovaPlan();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]); // intentionally narrow — one-time startup trigger

  // ── Weekly Goals Scan ──
  const scanWeeklyGoals = useCallback(async () => {
    if (!apiKey) return;
    setNovaState(prev => ({ ...prev, weeklyInsights: { loading: true, text: null, error: null } }));

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const today = now.getDate();
    const currentWeek = Math.floor((firstDow + today - 1) / 7);
    const weekStart = new Date(year, month, 1 + currentWeek * 7 - firstDow);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);

    const activeProjects = projects.filter(p => !p.completedAt);
    const weekProjects = activeProjects.filter(p => {
      if (!p.deadline) return false;
      const d = new Date(p.deadline);
      return d >= weekStart && d <= weekEnd;
    });
    const overdueProjects = activeProjects.filter(p => {
      if (!p.deadline) return false;
      const d = new Date(p.deadline);
      const done = (p.subtasks.filter(s => s.done).length + p.checkpoints.filter(c => c.done).length);
      const total = p.subtasks.length + p.checkpoints.length;
      return d < weekStart && done < total;
    });

    const goalContext = weekProjects.map(p => {
      const pct = progress(p);
      const subs = p.subtasks.filter(s => !s.done).map(s => s.title).join(', ');
      return `"${p.title}" (${pct}% done)${subs ? ` — remaining: ${subs}` : ''}`;
    }).join('\n');

    const overdueContext = overdueProjects.map(p => {
      const pct = progress(p);
      return `"${p.title}" (${pct}% done) — OVERDUE`;
    }).join('\n');

    const system = 'You are NOVA, a weekly planning analyst. Respond with a concise paragraph (2-4 sentences) assessing the user\'s weekly goal alignment. Be direct and specific. Mention which goals are on track, which need attention, and one actionable suggestion. No markdown, no sign-off.';
    const userMsg = `Current week: ${weekStart.toLocaleDateString('en-US', { month:'short', day:'numeric' })} — ${weekEnd.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}\n\nGoals with deadlines this week:\n${goalContext || 'None'}\n\nOverdue goals:\n${overdueContext || 'None'}\n\nAssess my weekly alignment.`;

    try {
      const result = await novaRetry.executeWithRetry(
        () => askAI(system, userMsg, apiKey)
      );
      const reply  = result.data;
      setNovaState(prev => ({
        ...prev,
        weeklyInsights: { loading: false, text: reply.trim(), error: null, scannedAt: Date.now() },
      }));
    } catch {
      setNovaState(prev => ({
        ...prev,
        weeklyInsights: { loading: false, text: null, error: 'Failed to scan weekly goals. Try again.' },
      }));
    }
  }, [apiKey, projects, novaRetry]);

  return {
    novaState, setNovaState,
    novaChatInput, setNovaChatInput,
    novaLoading,
    novaSessionKey,
    knowledgePool, setKnowledgePool,
    knowledgePoolRef,
    addSyncEvent,
    onNewSession,
    addKnowledgeEntry,
    deleteKnowledgeEntry,
    editKnowledgeEntry,
    updateCorrections,
    addInferredEntries,
    sendNOVAMessage,
    generateNovaPlan,
    generateNovaPlanRef,
    buildNOVASystemPrompt,
    scanWeeklyGoals,
    novaRetry,
    confirmInsight,
    dismissInsight,
    recordPlanAccuracy,
  };
}
