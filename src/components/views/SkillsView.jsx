import {
  getProficiencyStage,
  getSkillStatus,
  getStatusColor,
  getStatusIndicator,
  formatLastApplied,
  getSkillReminders,
  computeProductivityMetrics,
  getSkillGap,
  PROFICIENCY_STAGES,
} from '../../constants/skills';

export default function SkillsView({ skills, goals, streakDays, onUpdateSkillMeta }) {
  const reminders = getSkillReminders(skills);
  const prodMetrics = computeProductivityMetrics(goals, streakDays);

  const skillsWithGaps = Object.values(skills)
    .flatMap(g => Object.values(g.skills))
    .filter(d => d.targetStage != null && getSkillGap(d).gapSize > 0)
    .length;

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'Syne', color: '#f0b429', margin: 0, fontSize: 22 }}>COMPETENCY</h2>
        <p style={{ color: '#56687f', fontSize: 12, fontFamily: 'IBM Plex Mono', marginTop: 4 }}>
          Hours of deliberate practice • Applied skills • Progress stages
        </p>
      </div>

      {/* Summary Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20,
      }}>
        <StatBox label="Tasks" value={prodMetrics.tasksCompleted} sub={`${Math.round(prodMetrics.completionRate * 100)}% rate`} color="#53aaff" />
        <StatBox label="Streak" value={`${streakDays}d`} sub="consecutive" color="#3ecf7e" />
        <StatBox label="Active Skills" value={reminders.filter(r => r.status === 'active').length} sub="in practice" color="#f0b429" />
        <StatBox label="Skills w/ Gaps" value={skillsWithGaps} sub="target set" color="#f77171" />
      </div>

      {/* Focus Areas */}
      {reminders.length > 0 && (
        <div style={{
          background: 'rgba(240,180,41,0.05)', border: '1px solid rgba(240,180,41,0.2)',
          borderRadius: 8, padding: '12px 16px', marginBottom: 20,
        }}>
          <div style={{ fontFamily: 'Syne', fontSize: 11, color: '#f0b429', marginBottom: 8, letterSpacing: 1 }}>
            FOCUS AREAS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {reminders.map(r => (
              <span key={r.skillName} style={{
                fontFamily: 'IBM Plex Mono', fontSize: 10,
                background: r.type === 'gap'
                  ? 'rgba(247,113,113,0.12)'
                  : r.status === 'learning' ? 'rgba(155,121,232,0.15)' : 'rgba(240,180,41,0.1)',
                color: r.type === 'gap'
                  ? '#f77171'
                  : r.status === 'learning' ? '#9b79e8' : '#f0b429',
                padding: '4px 10px', borderRadius: 4,
              }}>
                {r.skillName}
                {r.type === 'gap'
                  ? ` • ${r.currentStage} → ${r.targetStage}`
                  : ` • ${r.reason}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Skills Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {Object.entries(skills).map(([groupName, group]) => (
          <div key={groupName} style={{
            background: '#0d1017', border: '1px solid #1b2336',
            borderRadius: 10, padding: '14px 16px',
          }}>
            <div style={{
              fontFamily: 'Syne', fontSize: 11, fontWeight: 700,
              color: group.color, letterSpacing: 2, marginBottom: 12,
            }}>
              {groupName.toUpperCase()}
            </div>

            {Object.entries(group.skills).map(([skillName, data]) => {
              const stage = getProficiencyStage(data.hours || 0);
              const status = getSkillStatus(data);
              const statusColor = getStatusColor(status);
              const indicator = getStatusIndicator(status);
              const lastApplied = formatLastApplied(data.lastApplied);
              const { currentIdx, targetIdx, gapSize } = getSkillGap(data);

              return (
                <div key={skillName} style={{
                  marginBottom: 12,
                  padding: '8px 10px',
                  background: gapSize > 0
                    ? 'rgba(247,113,113,0.04)'
                    : status === 'stale' ? 'rgba(240,180,41,0.05)' : 'transparent',
                  borderRadius: 6,
                  border: gapSize > 0
                    ? '1px solid rgba(247,113,113,0.25)'
                    : status === 'stale' ? '1px solid rgba(240,180,41,0.15)' : '1px solid transparent',
                }}>
                  {/* Skill Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#d6e2f5' }}>
                      {skillName}
                    </span>
                    <span style={{
                      fontFamily: 'IBM Plex Mono', fontSize: 10,
                      color: statusColor, display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {indicator} {stage}
                    </span>
                  </div>

                  {/* Stats Row */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#56687f',
                  }}>
                    <span>{data.hours || 0}h invested</span>
                    <span>{data.evidenceCount || 0}× applied</span>
                  </div>

                  {/* Gap Bar */}
                  <GapBar currentIdx={currentIdx} targetIdx={targetIdx} />

                  {/* Target Stage Selector */}
                  <TargetStageSelector
                    currentIdx={currentIdx}
                    targetIdx={targetIdx}
                    onSelect={(idx) => onUpdateSkillMeta && onUpdateSkillMeta(groupName, skillName, { targetStage: idx })}
                  />

                  {targetIdx == null && (
                    <div style={{
                      fontFamily: 'IBM Plex Mono', fontSize: 9,
                      color: '#56687f', marginTop: 2, fontStyle: 'italic',
                    }}>
                      tap a dot to set target
                    </div>
                  )}

                  {/* Last Applied */}
                  <div style={{
                    fontFamily: 'IBM Plex Mono', fontSize: 9,
                    color: status === 'stale' ? '#f0b429' : '#56687f',
                    marginTop: 4,
                  }}>
                    Last applied: {lastApplied}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function GapBar({ currentIdx, targetIdx }) {
  if (targetIdx == null) return null;
  const gapSize = Math.max(0, targetIdx - currentIdx);
  if (gapSize === 0) return (
    <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#3ecf7e', marginTop: 4 }}>
      ✓ at target
    </div>
  );
  const dashes = '─'.repeat(gapSize * 2);
  return (
    <div style={{
      fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#f77171',
      marginTop: 4, display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{ color: '#53aaff' }}>{PROFICIENCY_STAGES[currentIdx]}</span>
      <span style={{ color: '#56687f' }}>{dashes}►</span>
      <span>{PROFICIENCY_STAGES[targetIdx]}</span>
    </div>
  );
}

function TargetStageSelector({ currentIdx, targetIdx, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 6 }}>
      {PROFICIENCY_STAGES.map((stage, i) => {
        const isPast    = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isTarget  = i === targetIdx;
        const isBetween = targetIdx != null && i > currentIdx && i < targetIdx;

        let bg = '#1b2336';
        if (isPast)    bg = '#3ecf7e';
        if (isCurrent) bg = '#53aaff';
        if (isBetween) bg = 'rgba(247,113,113,0.4)';
        if (isTarget)  bg = '#f77171';

        return (
          <button
            key={stage}
            title={stage}
            onClick={() => onSelect(isTarget ? null : i)}
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: bg,
              border: isTarget ? '1px solid #f77171' : isCurrent ? '1px solid #53aaff' : '1px solid transparent',
              cursor: 'pointer', padding: 0, flexShrink: 0, outline: 'none',
            }}
          />
        );
      })}
    </div>
  );
}

function StatBox({ label, value, sub, color }) {
  return (
    <div style={{
      background: '#0d1017', border: '1px solid #1b2336',
      borderRadius: 8, padding: '12px 14px',
    }}>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#56687f', marginBottom: 4, letterSpacing: 1 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontFamily: 'Syne', fontSize: 20, color, fontWeight: 600 }}>
        {value}
      </div>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 9, color: '#56687f', marginTop: 2 }}>
        {sub}
      </div>
    </div>
  );
}
