# NOVA System Improvements Plan

## Overview

Five targeted improvements to push NOVA's effectiveness from ~55-60% to ~75-80%.
Each improvement is independent and can be implemented in any order.

---

## Improvement 1: Knowledge Decay + Pruning + Usage Tracking

**Files affected:** [`src/hooks/useNOVA.js`](src/hooks/useNOVA.js), [`src/utils/knowledge.js`](src/utils/knowledge.js)

### What changes

#### A. Add `lastUsed` tracking to knowledge entries

Every knowledge entry gets a `lastUsed` timestamp. When the knowledge block is built (in [`buildStructuredKnowledgeBlock`](src/utils/knowledge.js:66) / [`buildFullKnowledgeBlock`](src/utils/knowledge.js:1)), each entry used gets its `lastUsed` updated.

**New function in [`knowledge.js`](src/utils/knowledge.js):**
```js
// Called after building knowledge blocks to mark entries as used
export function markEntriesUsed(pool, entryIds) {
  const now = Date.now();
  return {
    ...pool,
    entries: pool.entries.map(e =>
      entryIds.includes(e.id) ? { ...e, lastUsed: now } : e
    ),
  };
}
```

#### B. Add decay function

**New function in [`knowledge.js`](src/utils/knowledge.js):**
```js
export function decayKnowledge(pool) {
  const now = Date.now();
  const DAY_MS = 86400000;
  return {
    ...pool,
    entries: pool.entries
      .map(e => {
        if (e.source === 'manual') return e; // manual entries don't decay
        const daysSinceUse = e.lastUsed ? (now - e.lastUsed) / DAY_MS : 30;
        const decayedConf = Math.max(0.1, e.conf - 0.05 * daysSinceUse);
        return { ...e, conf: decayedConf };
      })
      .filter(e => e.source === 'manual' || e.conf >= 0.15), // prune low-confidence AI entries
  };
}
```

#### C. Call decay on session start

In [`useNOVA.js`](src/hooks/useNOVA.js), add a `useEffect` that runs decay on mount and periodically (e.g., every hour):

```js
// Knowledge decay effect
useEffect(() => {
  const runDecay = () => {
    setKnowledgePool(prev => decayKnowledge(prev));
  };
  runDecay(); // Run on mount
  const interval = setInterval(runDecay, 3600000); // Every hour
  return () => clearInterval(interval);
}, []);
```

#### D. Track usage in knowledge block builders

Modify [`buildStructuredKnowledgeBlock`](src/utils/knowledge.js:66) and [`buildFullKnowledgeBlock`](src/utils/knowledge.js:1) to return both the formatted string AND the list of entry IDs used, so the caller can update `lastUsed`.

**New return format:**
```js
export function buildStructuredKnowledgeBlock(pool) {
  // ... existing logic ...
  const usedEntryIds = qualifying.map(e => e.id);
  return {
    text: '\n' + lines.join('\n'),
    usedEntryIds,
  };
}
```

Then in [`buildNOVASystemPrompt`](src/hooks/useNOVA.js:144), after building the knowledge block, call `markEntriesUsed` with the returned IDs.

---

## Improvement 2: Response Validation Layer

**Files affected:** [`src/hooks/useNOVA.js`](src/hooks/useNOVA.js), [`src/utils/nova.js`](src/utils/nova.js)

### What changes

#### A. Create validation function in [`nova.js`](src/utils/nova.js)

```js
/**
 * Validate NOVA's response based on program type.
 * Returns { valid: boolean, reason: string|null }
 */
export function validateNOVAResponse(text, programId) {
  if (!text || text.trim().length < 10) {
    return { valid: false, reason: 'Response too short or empty.' };
  }

  switch (programId) {
    case 'briefing': {
      // Must contain a question or planning language
      const hasQuestion = text.includes('?');
      const hasPlanning = /plan|focus|priorit|today|scale|headspace/i.test(text);
      if (!hasQuestion && !hasPlanning) {
        return { valid: false, reason: 'Briefing should include a question or planning guidance.' };
      }
      return { valid: true, reason: null };
    }

    case 'focus': {
      // Must contain bullet points or numbered steps
      const hasBullets = /^[\s]*[-*•]\s/m.test(text);
      const hasNumbers = /^\s*\d+[.)]\s/m.test(text);
      const hasActionVerbs = /^(break|create|implement|write|build|refactor|test|review|analyze|setup|configure|research|draft)/im.test(text);
      if (!hasBullets && !hasNumbers) {
        return { valid: false, reason: 'Focus plan should use bullet points or numbered steps.' };
      }
      if (!hasActionVerbs) {
        return { valid: false, reason: 'Focus plan steps should start with action verbs.' };
      }
      return { valid: true, reason: null };
    }

    case 'regroup': {
      // Must acknowledge the situation, not be purely motivational
      const hasAcknowledgment = /happened|interrupt|lost|understand|feel|noticed|signal|break|reset/i.test(text);
      if (!hasAcknowledgment) {
        return { valid: false, reason: 'Regroup should acknowledge the situation first.' };
      }
      return { valid: true, reason: null };
    }

    case 'preview': {
      // Must reference planning for tomorrow/later
      const hasHorizon = /tomorrow|today|later|plan|next|upcoming|schedule/i.test(text);
      const hasQuestion = text.includes('?');
      if (!hasHorizon) {
        return { valid: false, reason: 'Preview should reference upcoming planning horizon.' };
      }
      return { valid: true, reason: null };
    }

    default:
      return { valid: true, reason: null };
  }
}
```

#### B. Integrate into [`sendNOVAMessage`](src/hooks/useNOVA.js:241)

After receiving the reply from `novaRetry.executeWithRetry`, validate it:

```js
// After getting reply
const validation = validateNOVAResponse(reply, programId);
if (!validation.valid) {
  console.warn(`[NOVA] Response validation failed for ${programId}: ${validation.reason}`);
  // Optionally: retry with a stronger system prompt hint, or show warning in UI
  // For now: still show the response but flag it
  // Future: could auto-retry with "Please follow the format instructions more carefully"
}
```

#### C. Add validation state to [`NOVAProgramPanel`](src/components/nova/NOVAProgramPanel.jsx)

Add a small warning indicator when validation fails:
```jsx
{validationWarning && (
  <div style={{ fontSize:8, color:T.rose, padding:'2px 8px', fontFamily:"'IBM Plex Mono',monospace" }}>
    ⚠ Response may not match expected format
  </div>
)}
```

---

## Improvement 3: Insight Confirmation Queue

**Files affected:** [`src/hooks/useNOVA.js`](src/hooks/useNOVA.js), [`src/components/nova/NOVAProgramPanel.jsx`](src/components/nova/NOVAProgramPanel.jsx), [`src/components/nova/NovaInsightsPanel.jsx`](src/components/nova/NovaInsightsPanel.jsx)

### What changes

#### A. Add `pendingInsights` to NOVA state

In [`NOVA_DEFAULT`](src/utils/nova.js:18):
```js
pendingInsights: [], // { id, type: 'routine'|'knowledge'|'task', content, source, createdAt }
```

#### B. Modify [`extractNOVAInsights`](src/hooks/useNOVA.js:218)

Instead of directly calling `addInferredEntries` and setting `novaState.routine`, push to a `pendingInsights` array:

```js
const extractNOVAInsights = useCallback(async (programId, messages) => {
  // ... existing parsing logic ...
  try {
    const parsed = JSON.parse(cleaned);
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
        pendingInsights: [...prev.pendingInsights, ...pending],
      }));
    }
  } catch { /* silently ignore parse errors */ }
}, [apiKey]);
```

#### C. Add confirmation actions

```js
const confirmInsight = useCallback((insightId) => {
  setNovaState(prev => {
    const insight = prev.pendingInsights.find(i => i.id === insightId);
    if (!insight) return prev;
    
    const remaining = prev.pendingInsights.filter(i => i.id !== insightId);
    
    if (insight.type === 'routine') {
      return {
        ...prev,
        routine: { summary: insight.content, lastUpdated: new Date().toISOString() },
        pendingInsights: remaining,
      };
    }
    
    if (insight.type === 'knowledge') {
      // Add to knowledge pool
      addInferredEntries([insight.content]);
      return { ...prev, pendingInsights: remaining };
    }
    
    if (insight.type === 'task') {
      return {
        ...prev,
        suggestedTasks: [...prev.suggestedTasks, { id: uid(), text: insight.content, source: insight.source, accepted: null }],
        pendingInsights: remaining,
      };
    }
    
    return { ...prev, pendingInsights: remaining };
  });
}, [addInferredEntries]);

const dismissInsight = useCallback((insightId) => {
  setNovaState(prev => ({
    ...prev,
    pendingInsights: prev.pendingInsights.filter(i => i.id !== insightId),
  }));
}, []);
```

#### D. Add confirmation UI in [`NOVAProgramPanel`](src/components/nova/NOVAProgramPanel.jsx)

After the chat area (or in a modal), show pending insights:

```jsx
{novaState.pendingInsights.length > 0 && (
  <div style={{ padding:'8px 12px', borderTop:`1px solid ${T.border}`, background:`${T.accent}08` }}>
    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.accent, letterSpacing:'.08em', marginBottom:6 }}>
      NOVA Insights — Review before saving
    </div>
    {novaState.pendingInsights.map(insight => (
      <div key={insight.id} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, padding:'1px 4px', borderRadius:2, background:`${T.accent}20`, color:T.accent }}>
          {insight.type}
        </span>
        <span style={{ flex:1, fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:T.text }}>
          {insight.type === 'knowledge' ? insight.content.text : insight.content}
        </span>
        <button onClick={() => confirmInsight(insight.id)} style={acceptBtnStyle}>✓</button>
        <button onClick={() => dismissInsight(insight.id)} style={dismissBtnStyle}>×</button>
      </div>
    ))}
  </div>
)}
```

#### E. Also show in [`NovaInsightsPanel`](src/components/nova/NovaInsightsPanel.jsx)

Add a "Pending Insights" section that shows unconfirmed insights with accept/dismiss buttons.

---

## Improvement 4: Real-Time Knowledge Inference During Conversation

**Files affected:** [`src/hooks/useNOVA.js`](src/hooks/useNOVA.js)

### What changes

#### A. Add real-time inference trigger in [`sendNOVAMessage`](src/hooks/useNOVA.js:241)

After each user message in a conversation (not just at the end), run a lightweight inference:

```js
// After adding user message to history, before sending to API
if (programId !== 'focus' && text.trim().length > 20) {
  // Schedule lightweight real-time inference (non-blocking)
  inferKnowledgeFromMessage(text, programId);
}
```

#### B. Create `inferKnowledgeFromMessage` function

```js
const inferKnowledgeFromMessage = useCallback(async (userText, programId) => {
  if (!apiKey) return;
  
  // Use a lightweight prompt — just extract if anything is learnable
  const system = 'You are a knowledge extraction API. Return ONLY a JSON array or empty array. Each item: {"cat":"work"|"goals"|"prefs"|"context","text":"factual present-tense statement (max 80 chars)","conf":0.0-1.0}. Only extract if the user reveals something new about their work style, preferences, goals, or context. Otherwise return [].';
  
  try {
    const result = await chatWithNOVA([
      { role: 'system', content: system },
      { role: 'user', content: `Extract any new knowledge from this message: "${userText}"` },
    ], apiKey);
    
    const cleaned = result.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
    const entries = JSON.parse(cleaned);
    
    if (Array.isArray(entries) && entries.length > 0) {
      // Add to pending insights (not directly to pool)
      const pending = entries.map(e => ({
        id: uid(),
        type: 'knowledge',
        content: { cat: e.cat, text: e.text, conf: Math.min(0.6, e.conf || 0.3) }, // Cap real-time confidence at 0.6
        source: `${programId}_realtime`,
        createdAt: Date.now(),
      }));
      
      setNovaState(prev => ({
        ...prev,
        pendingInsights: [...prev.pendingInsights, ...pending],
      }));
    }
  } catch {
    // Silently fail — real-time inference is best-effort
  }
}, [apiKey]);
```

**Key design decisions:**
- Runs asynchronously (fire-and-forget, doesn't block the main message flow)
- Confidence capped at 0.6 (lower than post-session extraction)
- Results go to `pendingInsights`, not directly to the knowledge pool
- Only triggers on messages > 20 characters
- Silent failure — never blocks the user

---

## Improvement 5: Plan Accuracy Tracking + Feedback Loop

**Files affected:** [`src/hooks/useNOVA.js`](src/hooks/useNOVA.js), [`src/utils/nova.js`](src/utils/nova.js), [`src/components/nova/NovaInsightsPanel.jsx`](src/components/nova/NovaInsightsPanel.jsx)

### What changes

#### A. Add plan accuracy tracking to NOVA state

In [`NOVA_DEFAULT`](src/utils/nova.js:18):
```js
planAccuracy: {
  history: [], // { date, planned: N, completed: N, accuracy: 0-1 }
  movingAverage: null, // rolling average of last 7 plans
},
```

#### B. Create tracking function in [`nova.js`](src/utils/nova.js)

```js
export function computePlanAccuracy(planItems, completedTaskIds) {
  if (!planItems?.length) return 0;
  const matched = planItems.filter(item => completedTaskIds.includes(item.id));
  return matched.length / planItems.length;
}

export function updatePlanAccuracyHistory(history, newEntry) {
  const updated = [...history, newEntry].slice(-30); // Keep last 30 days
  const last7 = updated.slice(-7);
  const movingAverage = last7.reduce((s, e) => s + e.accuracy, 0) / last7.length;
  return { history: updated, movingAverage };
}
```

#### C. Record accuracy when tasks are completed

In [`useNOVA.js`](src/hooks/useNOVA.js), add a function called when tasks are checked off:

```js
const recordPlanAccuracy = useCallback(() => {
  const plan = novaState.dailyPlan;
  if (!plan?.items?.length) return;
  
  const today = new Date().toISOString().slice(0, 10);
  if (plan.date !== today) return;
  
  // Count how many plan items were completed
  const completedPlanItems = plan.items.filter(item => {
    // Check if this item's title matches any completed subtask
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
```

#### D. Adjust confidence threshold dynamically

Modify [`generateNovaPlan`](src/hooks/useNOVA.js:337) to use a dynamic threshold:

```js
// Dynamic confidence threshold
const baseThreshold = 80;
const accuracyBonus = novaState.planAccuracy?.movingAverage 
  ? Math.round((novaState.planAccuracy.movingAverage - 0.5) * 40) // -20 to +20
  : 0;
const effectiveThreshold = Math.max(50, Math.min(95, baseThreshold - accuracyBonus));
// If plan accuracy is high (e.g., 90%), threshold drops to 64% — NOVA is more willing to plan
// If plan accuracy is low (e.g., 30%), threshold rises to 92% — NOVA is more cautious

if (confidence < effectiveThreshold) {
  setNovaState(prev => ({
    ...prev,
    planGenLoading: false,
    dailyPlan: null,
    planError: `NOVA confidence is ${confidence}% — needs to be at least ${effectiveThreshold}% to generate a reliable plan. ${accuracyBonus < 0 ? 'Previous plans have had low accuracy, so NOVA is being more cautious.' : ''}`,
  }));
  return;
}
```

#### E. Show plan accuracy in [`NovaInsightsPanel`](src/components/nova/NovaInsightsPanel.jsx)

Add a new section:
```jsx
{novaState.planAccuracy?.history?.length > 0 && (
  <div>
    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.1em', marginBottom:8 }}>PLAN ACCURACY</div>
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800, color:T.accent }}>
        {Math.round((novaState.planAccuracy.movingAverage || 0) * 100)}%
      </div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted }}>
        avg. plan completion rate (last 7 days)
      </div>
    </div>
    {/* Mini chart of last 7 plans */}
    <div style={{ display:'flex', gap:4, height:24, alignItems:'flex-end' }}>
      {novaState.planAccuracy.history.slice(-7).map((entry, i) => (
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
          <div style={{ width:'100%', height:`${Math.max(2, entry.accuracy * 20)}px`, background: entry.accuracy >= 0.7 ? T.green : entry.accuracy >= 0.4 ? T.accent : T.rose, borderRadius:2 }} />
        </div>
      ))}
    </div>
  </div>
)}
```

---

## Implementation Order (Recommended)

| Order | Improvement | Files Changed | Complexity | Risk |
|-------|-------------|---------------|------------|------|
| 1 | **Knowledge decay + pruning** | `knowledge.js`, `useNOVA.js` | Low | Low — purely additive, no breaking changes |
| 2 | **Response validation** | `nova.js`, `useNOVA.js`, `NOVAProgramPanel.jsx` | Low | Low — validation is advisory, never blocks |
| 3 | **Insight confirmation queue** | `useNOVA.js`, `NOVAProgramPanel.jsx`, `NovaInsightsPanel.jsx` | Medium | Medium — changes how insights flow into state |
| 4 | **Real-time inference** | `useNOVA.js` | Medium | Low — fire-and-forget, silent failure |
| 5 | **Plan accuracy tracking** | `nova.js`, `useNOVA.js`, `NovaInsightsPanel.jsx` | Medium | Low — purely additive metrics |

---

## Data Flow Diagram

```mermaid
flowchart TD
    UserMsg[User sends message] --> sendNOVA
    
    subgraph sendNOVA[sendNOVAMessage]
        direction TB
        A[Build system prompt] --> B[Call API with retry]
        B --> C[Validate response]
        C --> D{Valid?}
        D -->|Yes| E[Add to chat history]
        D -->|No| F[Log warning + still show]
        F --> E
        E --> G{Is [READY]?}
        G -->|Yes| H[extractNOVAInsights]
        G -->|No| I[Check for real-time inference]
    end
    
    subgraph extractNOVAInsights
        direction TB
        J[Parse AI response] --> K[Create pendingInsights]
        K --> L[Store in novaState.pendingInsights]
    end
    
    subgraph realtime[Real-time inference]
        M[User message > 20 chars] --> N[Lightweight API call]
        N --> O[Parse knowledge entries]
        O --> P[Add to pendingInsights with capped confidence]
    end
    
    subgraph confirm[User Confirmation]
        Q[Pending insights shown in UI] --> R{User action}
        R -->|Accept| S[Commit to knowledge pool / routine / tasks]
        R -->|Dismiss| T[Remove from pending]
    end
    
    subgraph decay[Knowledge Decay]
        U[Periodic timer] --> V[Decay AI entries by days since lastUse]
        V --> W[Prune entries below 0.15 conf]
    end
    
    subgraph planAccuracy[Plan Accuracy]
        X[Task completed] --> Y[Match against plan items]
        Y --> Z[Update planAccuracy.history]
        Z --> AA[Adjust dynamic confidence threshold]
    end
    
    H --> extractNOVAInsights
    I --> realtime
    L --> confirm
    confirm --> decay
    sendNOVA --> planAccuracy
    planAccuracy --> AA
    AA --> generateNovaPlan
```

---

## State Changes

### [`NOVA_DEFAULT`](src/utils/nova.js:18) additions:
```js
pendingInsights: [],       // Array of { id, type, content, source, createdAt }
planAccuracy: {            // Plan accuracy tracking
  history: [],             // Array of { date, planned, completed, accuracy }
  movingAverage: null,     // Number 0-1 or null
},
```

### Knowledge entry additions:
```js
{
  // ... existing fields ...
  lastUsed: null,          // Timestamp of last inclusion in system prompt
}
```

### Return value additions from [`useNOVA`](src/hooks/useNOVA.js):
```js
confirmInsight,            // (insightId) => void
dismissInsight,            // (insightId) => void
recordPlanAccuracy,        // () => void
```
