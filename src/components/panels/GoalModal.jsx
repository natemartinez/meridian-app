import { useState } from 'react';
import { TAGGABLE_SKILLS } from '../../constants/skills';
import { askAI } from '../../utils/api';

export default function GoalModal({ onClose, onCreate, apiKey }) {
  const [step,    setStep]    = useState('choose'); // 'choose' | 'form'
  const [goalType, setGoalType] = useState(null);

  const [title,   setTitle]   = useState('');
  const [desc,    setDesc]    = useState('');
  const [smart,   setSmart]   = useState({
    specific: '', measurable: '', achievable: '', relevant: '', timeBound: ''
  });
  const [loading, setLoading] = useState(false);

  const isLong = goalType === 'long';

  async function handleCreate() {
    if (!isLong && !title.trim()) return;
    if (isLong && !smart.specific.trim()) return;
    setLoading(true);

    const systemPrompt = `You are a productivity assistant.
Return ONLY a valid JSON array. No markdown, no explanation.
Each item: { "title": string, "isCheckpoint": boolean, "skill": string|null }
Generate ${isLong ? '3-4 checkpoints and 2-3 subtasks' : '4-6 subtasks and 1-2 checkpoints'}.
For "skill", pick the most relevant from: ${TAGGABLE_SKILLS.join(', ')}. Use null if none fit.`;

    const userPrompt = isLong
      ? `Long-term goal:
Specific: ${smart.specific}
Measurable: ${smart.measurable}
Achievable: ${smart.achievable}
Relevant: ${smart.relevant}
Target date: ${smart.timeBound}`
      : `Goal: ${title}\nDescription: ${desc}`;

    try {
      const raw    = await askAI(systemPrompt, userPrompt, apiKey);
      const text   = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);

      const subtasks    = parsed.filter(item => !item.isCheckpoint).map(item => ({
        id:    Date.now() + Math.random(),
        title: item.title,
        done:  false,
        skill: item.skill || null,
      }));
      const checkpoints = parsed.filter(item => item.isCheckpoint).map(item => ({
        id:    Date.now() + Math.random(),
        title: item.title,
        done:  false,
      }));

      onCreate({
        title:       isLong ? smart.specific : title,
        desc:        isLong ? `Measurable: ${smart.measurable}. Relevant: ${smart.relevant}.` : desc,
        measurable:  isLong ? smart.measurable : '',
        achievable:  isLong ? smart.achievable : '',
        relevant:    isLong ? smart.relevant : '',
        deadline:    isLong ? smart.timeBound : '',
        priority:    'low',
        scale:       isLong ? 'long' : 'short',
        subtasks,
        checkpoints,
      });
    } catch (e) {
      console.error('Subtask generation failed', e);
      onCreate({
        title:      isLong ? smart.specific : title,
        desc:       isLong ? '' : desc,
        measurable: isLong ? smart.measurable : '',
        achievable: isLong ? smart.achievable : '',
        relevant:   isLong ? smart.relevant : '',
        deadline:   isLong ? smart.timeBound : '',
        priority:   'low',
        scale:      isLong ? 'long' : 'short',
        subtasks:    [],
        checkpoints: [],
      });
    } finally {
      setLoading(false);
      onClose();
    }
  }

  const inputStyle = {
    width: '100%', background: '#121820', border: '1px solid #1b2336',
    borderRadius: 6, padding: '8px 12px', color: '#d6e2f5',
    fontFamily: 'IBM Plex Mono', fontSize: 12, outline: 'none',
    marginBottom: 12, boxSizing: 'border-box',
  };
  const labelStyle = {
    fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#56687f',
    letterSpacing: 1, marginBottom: 4, display: 'block',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: '#0d1017', border: '1px solid #1b2336', borderRadius: 12, padding: 28, width: 440, maxHeight: '85vh', overflowY: 'auto' }}>

        {step === 'choose' && (
          <>
            <h3 style={{ fontFamily: 'Syne', color: '#f0b429', margin: '0 0 6px' }}>New Goal</h3>
            <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#56687f', margin: '0 0 24px' }}>
              Choose a goal type to get started
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div onClick={() => { setGoalType('short'); setStep('form'); }}
                   style={{ background: '#121820', border: '1px solid #1b2336', borderRadius: 10, padding: '16px 18px', cursor: 'pointer', transition: 'border-color 0.2s' }}
                   onMouseEnter={e => e.currentTarget.style.borderColor = '#f0b42960'}
                   onMouseLeave={e => e.currentTarget.style.borderColor = '#1b2336'}>
                <div style={{ fontFamily: 'Syne', fontSize: 14, color: '#d6e2f5', fontWeight: 600, marginBottom: 4 }}>Short-Term Goal</div>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#56687f' }}>Days · Weeks — quick start</div>
              </div>
              <div onClick={() => { setGoalType('long'); setStep('form'); }}
                   style={{ background: '#121820', border: '1px solid #1b2336', borderRadius: 10, padding: '16px 18px', cursor: 'pointer', transition: 'border-color 0.2s' }}
                   onMouseEnter={e => e.currentTarget.style.borderColor = '#f0b42960'}
                   onMouseLeave={e => e.currentTarget.style.borderColor = '#1b2336'}>
                <div style={{ fontFamily: 'Syne', fontSize: 14, color: '#d6e2f5', fontWeight: 600, marginBottom: 4 }}>Long-Term Goal</div>
                <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#56687f' }}>Months · Years — SMART methodology</div>
              </div>
            </div>

            <button onClick={onClose} style={{ width: '100%', background: 'transparent', border: '1px solid #1b2336', borderRadius: 6, color: '#56687f', padding: '9px 0', fontFamily: 'IBM Plex Mono', fontSize: 11, cursor: 'pointer' }}>
              Cancel
            </button>
          </>
        )}

        {step === 'form' && (
          <>
            <h3 style={{ fontFamily: 'Syne', color: '#f0b429', margin: '0 0 6px' }}>
              {isLong ? 'Long-Term Goal' : 'Short-Term Goal'}
            </h3>
            <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#56687f', margin: '0 0 20px' }}>
              {isLong ? 'Months · Years — SMART methodology' : 'Days · Weeks — quick start'}
            </p>

            {!isLong && (
              <>
                <label style={labelStyle}>TITLE</label>
                <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="e.g. Build a REST API" />
                <label style={labelStyle}>DESCRIPTION (optional)</label>
                <textarea value={desc} onChange={e => setDesc(e.target.value)}
                          style={{ ...inputStyle, height: 72, resize: 'none' }} />
              </>
            )}

            {isLong && (
              <>
                {[
                  ['S', 'specific',   'SPECIFIC',   'What exactly do you want to accomplish?'],
                  ['M', 'measurable', 'MEASURABLE',  'How will you measure success?'],
                  ['A', 'achievable', 'ACHIEVABLE',  'What makes this realistic for you?'],
                  ['R', 'relevant',   'RELEVANT',    'Why does this matter to you?'],
                ].map(([letter, key, label, placeholder]) => (
                  <div key={key}>
                    <label style={labelStyle}>
                      <span style={{ color: '#f0b429' }}>{letter}</span> — {label}
                    </label>
                    <input
                      value={smart[key]}
                      onChange={e => setSmart(s => ({ ...s, [key]: e.target.value }))}
                      style={inputStyle}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
                <label style={labelStyle}><span style={{ color: '#f0b429' }}>T</span> — TIME-BOUND</label>
                <input type="date" value={smart.timeBound}
                       onChange={e => setSmart(s => ({ ...s, timeBound: e.target.value }))}
                       style={{ ...inputStyle, colorScheme: 'dark' }} />
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => setStep('choose')} style={{ flex: 1, background: 'transparent', border: '1px solid #1b2336', borderRadius: 6, color: '#56687f', padding: '9px 0', fontFamily: 'IBM Plex Mono', fontSize: 11, cursor: 'pointer' }}>
                Back
              </button>
              <button onClick={handleCreate} disabled={loading} style={{ flex: 2, background: '#f0b429', border: 'none', borderRadius: 6, color: '#07090f', padding: '9px 0', fontFamily: 'IBM Plex Mono', fontSize: 11, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.8 : 1 }}>
                {loading ? 'Generating...' : 'Create Goal'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
