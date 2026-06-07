export function buildFullKnowledgeBlock(pool) {
  if (!pool) return '';
  const { entries = [], corrections = '' } = pool;
  const CONF_THRESHOLD = 0.5;
  const CAT_LABELS = { work: 'Work Style', goals: 'Goals & Motivation', prefs: 'Preferences', context: 'Personal Context' };
  const qualifying = entries.filter(e => e.source === 'manual' || e.conf >= CONF_THRESHOLD);
  if (qualifying.length === 0 && !corrections.trim()) return '';
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
  return '\n' + lines.join('\n');
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
 */
export function buildStructuredKnowledgeBlock(pool) {
  if (!pool) return '';
  const { entries = [], corrections = '' } = pool;
  const CONF_THRESHOLD = 0.5;
  const CAT_LABELS = { work: 'WORK STYLE', goals: 'GOALS', prefs: 'PREFERENCES', context: 'CONTEXT' };
  const qualifying = entries.filter(e => e.source === 'manual' || e.conf >= CONF_THRESHOLD);
  if (qualifying.length === 0 && !corrections.trim()) return '';
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
  return '\n' + lines.join('\n');
}
