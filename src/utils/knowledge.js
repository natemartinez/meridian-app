/**
 * Build a prose-formatted knowledge block for stronger models.
 * Returns { text: string, usedEntryIds: string[] }
 */
export function buildFullKnowledgeBlock(pool) {
  if (!pool) return { text: '', usedEntryIds: [] };
  const { entries = [], corrections = '' } = pool;
  const CONF_THRESHOLD = 0.5;
  const CAT_LABELS = { work: 'Work Style', goals: 'Goals & Motivation', prefs: 'Preferences', context: 'Personal Context' };
  const qualifying = entries.filter(e => e.source === 'manual' || e.conf >= CONF_THRESHOLD);
  const usedEntryIds = qualifying.map(e => e.id);
  if (qualifying.length === 0 && !corrections.trim()) return { text: '', usedEntryIds };
  const lines = ['--- Nova Knowledge Pool ---'];
  if (corrections.trim()) {
    lines.push('[USER CORRECTIONS]');
    lines.push(corrections.trim());
    lines.push('');
  }
  const byCategory = {};
  for (const e of qualifying) {
    if (!byCategory[e.cat]) byCategory[e.cat] = [];
    byCategory[e.cat].push(e);
  }
  const order = ['work', 'goals', 'prefs', 'context'];
  const catLines = [];
  for (const cat of order) {
    const catEntries = byCategory[cat];
    if (!catEntries || catEntries.length === 0) continue;
    catLines.push(`${CAT_LABELS[cat]}:`);
    const sorted = [...catEntries].sort((a, b) => {
      if (a.source === 'manual' && b.source !== 'manual') return -1;
      if (b.source === 'manual' && a.source !== 'manual') return 1;
      return b.conf - a.conf;
    });
    for (const e of sorted) {
      const badge = e.source === 'manual' ? '✎' : '·';
      const note = e.source === 'manual' ? '(manual)' : `(${Math.round(e.conf * 100)}%)`;
      catLines.push(`  ${badge} ${e.text} ${note}`);
    }
  }
  if (catLines.length > 0) {
    lines.push('[WHAT NOVA KNOWS ABOUT THIS USER]');
    lines.push(...catLines);
  }
  lines.push('Treat manual entries as ground truth. Treat AI-inferred entries as probabilistic signals.');
  lines.push('---');
  return { text: '\n' + lines.join('\n'), usedEntryIds };
}

export function buildLightKnowledgeContext(pool) {
  if (!pool) return '';
  const { entries = [], corrections = '' } = pool;
  const CONF_THRESHOLD = 0.5;
  const manual = entries.filter(e => e.source === 'manual');
  const aiHigh = entries.filter(e => e.source === 'ai' && e.conf >= CONF_THRESHOLD).sort((a, b) => b.conf - a.conf);
  const top = [...manual, ...aiHigh].slice(0, 5);
  if (top.length === 0 && !corrections.trim()) return '';
  const parts = [];
  if (top.length > 0) {
    parts.push('User context: ' + top.map(e => e.text).join('; ') + '.');
  }
  if (corrections.trim()) parts.push('User note: ' + corrections.trim());
  return parts.join(' ');
}

/**
 * Build a structured bullet-point knowledge block optimized for weaker models.
 * Same data as buildFullKnowledgeBlock but formatted as simple bullet points
 * with clear labels, no decorative characters, and explicit instructions.
 * Returns { text: string, usedEntryIds: string[] }
 */
export function buildStructuredKnowledgeBlock(pool) {
  if (!pool) return { text: '', usedEntryIds: [] };
  const { entries = [], corrections = '' } = pool;
  const CONF_THRESHOLD = 0.5;
  const CAT_LABELS = { work: 'WORK STYLE', goals: 'GOALS', prefs: 'PREFERENCES', context: 'CONTEXT' };
  const qualifying = entries.filter(e => e.source === 'manual' || e.conf >= CONF_THRESHOLD);
  const usedEntryIds = qualifying.map(e => e.id);
  if (qualifying.length === 0 && !corrections.trim()) return { text: '', usedEntryIds };
  const lines = ['[KNOWLEDGE POOL]'];
  if (corrections.trim()) {
    lines.push('User corrections: ' + corrections.trim());
  }
  const byCategory = {};
  for (const e of qualifying) {
    if (!byCategory[e.cat]) byCategory[e.cat] = [];
    byCategory[e.cat].push(e);
  }
  const order = ['work', 'goals', 'prefs', 'context'];
  for (const cat of order) {
    const catEntries = byCategory[cat];
    if (!catEntries || catEntries.length === 0) continue;
    lines.push(CAT_LABELS[cat] + ':');
    const sorted = [...catEntries].sort((a, b) => {
      if (a.source === 'manual' && b.source !== 'manual') return -1;
      if (b.source === 'manual' && a.source !== 'manual') return 1;
      return b.conf - a.conf;
    });
    for (const e of sorted) {
      const confidence = e.source === 'manual' ? '[CONFIRMED]' : `[${Math.round(e.conf * 100)}% sure]`;
      lines.push('- ' + e.text + ' ' + confidence);
    }
  }
  lines.push('Manual entries are ground truth. AI entries are probabilistic signals.');
  lines.push('[/KNOWLEDGE POOL]');
  return { text: '\n' + lines.join('\n'), usedEntryIds };
}

/**
 * Decay AI-inferred knowledge entries based on time since last use.
 * Manual entries are immune to decay.
 * Entries below the pruning threshold are removed.
 *
 * @param {Object} pool - The knowledge pool { entries, corrections, lastUpdated }
 * @returns {Object} Updated pool with decayed and pruned entries
 */
export function decayKnowledge(pool) {
  if (!pool) return pool;
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

/**
 * Mark specific knowledge entries as used (update lastUsed timestamp).
 * Called after building knowledge blocks to track which entries were included.
 *
 * @param {Object} pool - The knowledge pool
 * @param {string[]} entryIds - Array of entry IDs that were used
 * @returns {Object} Updated pool with lastUsed timestamps
 */
export function markEntriesUsed(pool, entryIds) {
  if (!pool || !entryIds?.length) return pool;
  const now = Date.now();
  return {
    ...pool,
    entries: pool.entries.map(e =>
      entryIds.includes(e.id) ? { ...e, lastUsed: now } : e
    ),
  };
}
