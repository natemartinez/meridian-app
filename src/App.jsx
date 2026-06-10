import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import meridianLogo from './assets/meridian_full_logo.png';

import { T, NODE_PALETTE } from './utils/theme.js';
import { askAI } from './utils/api.js';
import { uid, projectPos, progress, DEFAULT_SKILLS, parseDeferClue } from './utils/helpers.js';
import { hexToRgb, rgba, drawGlow, drawProgressArc, drawSubtaskNode, drawCheckpointNode, rrect } from './utils/canvas.js';

import CompassWidget from './components/CompassWidget.jsx';
import OnwardPanel from './components/OnwardPanel.jsx';
import MapPanel from './components/MapPanel.jsx';
import SkillsPanel from './components/SkillsPanel.jsx';
import ApiKeyScreen from './components/ApiKeyScreen.jsx';
import TrackingPage from './components/TrackingPage.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import MindCheckPage from './components/MindCheckPage.jsx';
import KnowledgePoolPage from './components/KnowledgePoolPage.jsx';
import MindCheckCard from './components/MindCheckCard.jsx';
import SkillsView from './components/views/SkillsView.jsx';
import PathsView from './components/views/PathsView.jsx';
import WorkLogsView from './components/views/WorkLogsView.jsx';
import GoalModal from './components/panels/GoalModal.jsx';
import FocusScreen from './components/views/FocusScreen.jsx';
import { INITIAL_SKILLS, addSkillEvidence, updateSkillMeta } from './constants/skills.js';
import { buildLightKnowledgeContext } from './utils/knowledge.js';
import { computePlanningConfidence } from './utils/nova.js';
import NOVAProgramPanel from './components/nova/NOVAProgramPanel.jsx';
import { useNOVA } from './hooks/useNOVA.js';
import { drawOnwardPage, drawMapPage, drawPathsPage, drawSkillsPage, drawConstellationPage } from './utils/drawPages.js';

    function Meridian() {
      const [projects, setProjects]     = useState(() => { try { const s = localStorage.getItem('meridian_projects_v2'); return s ? JSON.parse(s) : []; } catch { return []; } });
      const [selectedId, setSelectedId] = useState(null);
      const [focus, setFocus]           = useState(["", "", ""]);
      const [modal, setModal]           = useState(false);
      const [form, setForm]             = useState({ title: "", desc: "", measurable: "", achievable: "", relevant: "", deadline: "", priority: "low", scale: "short" });
      const [aiMsg, setAiMsg]           = useState("");
      const [companionLoading, setCompanionLoading] = useState(false);
      const [pan, setPan]               = useState({ x: 0, y: 0 });
      const [dragging, setDragging]     = useState(null);
      const [loaded, setLoaded]         = useState(false);
      const [apiKey, setApiKey]         = useState(() => localStorage.getItem('meridian_api_key') || null);
      const [expandedNote, setExpandedNote] = useState(null);
      const [planningDay, setPlanningDay]   = useState(false);
      const [addInput, setAddInput]     = useState('');
      const [confirmDelete, setConfirmDelete] = useState(null);
      // Compass/page state
      const [activePage, setActivePage]           = useState('constellation');
      const [onwardItems, setOnwardItems]         = useState(() => { try { const s = localStorage.getItem('meridian_onward_v2'); return s ? JSON.parse(s) : []; } catch { return []; } });
      const [freeformTasks, setFreeformTasks]     = useState(() => { try { const s = localStorage.getItem('meridian_freeform_tasks'); return s ? JSON.parse(s) : []; } catch { return []; } });
      const [skills, setSkills]                   = useState([]);
      const [onwardForm, setOnwardForm]           = useState({ title:'', hour:480, priority:'low', goalId:null });
      // Drag and drop state for subtasks/checkpoints to time blocks
      const [draggedTask, setDraggedTask]         = useState(null); // { type: 'subtask'|'checkpoint', id, title, goalId, goalColor, goalTitle }
      const [dragOverHour, setDragOverHour]       = useState(null); // which hour slot is being hovered
      const [pendingDrop, setPendingDrop]         = useState(null); // { task, hour } waiting for confirmation
      // Compute available incomplete subtasks/checkpoints from all goals
      const availableTasks = useMemo(() => {
        const scheduledIds = new Set(
          onwardItems.filter(it => it.linkedId).map(it => `${it.linkedType}:${it.linkedId}`)
        );
        const tasks = [];
        projects.forEach(proj => {
          proj.subtasks?.filter(st => !st.done && !scheduledIds.has(`subtask:${st.id}`)).forEach(st => {
            tasks.push({
              type: 'subtask',
              id: st.id,
              title: st.title,
              goalId: proj.id,
              goalTitle: proj.title,
              goalColor: proj.color
            });
          });
          proj.checkpoints?.filter(cp => !cp.done && !scheduledIds.has(`checkpoint:${cp.id}`)).forEach(cp => {
            tasks.push({
              type: 'checkpoint',
              id: cp.id,
              title: cp.title,
              goalId: proj.id,
              goalTitle: proj.title,
              goalColor: proj.color
            });
          });
        });
        freeformTasks.forEach(ft => {
          const proj = projects.find(p => p.id === ft.goalId);
          tasks.push({
            type: 'freeform',
            id: ft.id,
            title: ft.title,
            goalId: ft.goalId,
            goalTitle: proj?.title || '',
            goalColor: proj?.color || '#888'
          });
        });
        return tasks;
      }, [projects, onwardItems, freeformTasks]);
      const [hoveredWeek, setHoveredWeek]         = useState(null);
      const [selectedSkillId, setSelectedSkillId] = useState(null);
      // Top-level navigation
      const [mainPage, setMainPage]           = useState('hq');
      const [carouselOpen, setCarouselOpen]   = useState(true);
      const [intensity, setIntensity]         = useState({ low:35, medium:55, high:75 });
      const [showApiKey, setShowApiKey]       = useState(false);
      const [showMindCheckCard, setShowMindCheckCard] = useState(false);
      const [sessions, setSessions]                   = useState([]);
      const [activeSession, setActiveSession]         = useState(null);
      const [prioritizeInput, setPrioritizeInput]     = useState('');
      const [trackingPeriod, setTrackingPeriod]       = useState('day');
      const [geminiInput, setGeminiInput]             = useState('');
      const [geminiResponse, setGeminiResponse]       = useState('');
      const [geminiLoading, setGeminiLoading]         = useState(false);
      const [pomodoroPreselect, setPomodoroPreselect] = useState(null);
      const [routines, setRoutines] = useState([
        { id:'r1', phase:'before', text:'Review the goal tied to this task' },
        { id:'r2', phase:'before', text:'Clear distractions' },
        { id:'r3', phase:'during', text:'Stay focused on one thing' },
        { id:'r4', phase:'during', text:'Take short breaks if needed' },
        { id:'r5', phase:'after',  text:'Reflect on what was accomplished' },
        { id:'r6', phase:'after',  text:'Note what to pick up next' },
      ]);

      // ── Ingestion & Smart Sorting state ──
      const [focusMode, setFocusMode] = useState(null); // { active, taskTitle, taskId, goalId } | null
      const [selectedForToday, setSelectedForToday] = useState(() => {
        try { const s = localStorage.getItem('meridian_selected_today'); return s ? JSON.parse(s) : []; } catch { return []; }
      });
      const [deferredItems, setDeferredItems] = useState(() => {
        try { const s = localStorage.getItem('meridian_deferred'); return s ? JSON.parse(s) : []; } catch { return []; }
      });
      const [backlogItems, setBacklogItems] = useState(() => {
        try { const s = localStorage.getItem('meridian_backlog'); return s ? JSON.parse(s) : []; } catch { return []; }
      });
      const [brainDumpEntries, setBrainDumpEntries] = useState(() => {
        try { const s = localStorage.getItem('meridian_brain_dump'); return s ? JSON.parse(s) : []; } catch { return []; }
      });
      const [journalEntries, setJournalEntries] = useState(() => {
        try { const s = localStorage.getItem('meridian_journal'); return s ? JSON.parse(s) : []; } catch { return []; }
      });

      const [waypointOpen, setWaypointOpen]       = useState(false);
      const [waypointContext, setWaypointContext] = useState(null);
      // waypointContext shape: { type: 'goal' | 'focus' | 'canvas-panel' | 'program', id: string | null }

      const [onwardClickedItem, setOnwardClickedItem] = useState(null);
      const [sunId, setSunId] = useState(() => localStorage.getItem('meridian_sun_id') || null);
      const [companionName, setCompanionName] = useState(() => localStorage.getItem('meridian_companion_name') || 'AI Companion');

      const {
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
        buildNOVASystemPrompt,
        scanWeeklyGoals,
        novaRetry,
      } = useNOVA({ apiKey, projects, focus, waypointContext, loaded });

      const [renamingGoalId, setRenamingGoalId] = useState(null);
      const [renameValue, setRenameValue] = useState('');
      // Deadline notifier
      const [showDeadlineNotifier, setShowDeadlineNotifier] = useState(false);
      const [deadlineAlerts, setDeadlineAlerts] = useState([]);

      // XP-based skills (separate from slider-based skills used by canvas/SkillsPanel)
      const [xpSkills, setXpSkills] = useState(() => {
        try {
          const saved = localStorage.getItem('meridian_skills');
          if (!saved) return INITIAL_SKILLS;
          const parsed = JSON.parse(saved);
          
          // Migration: convert old XP-based format to new evidence-based format
          const needsMigration = Object.values(parsed).some(g => 
            Object.values(g.skills || {}).some(s => s.xp !== undefined)
          );
          
          if (needsMigration) {
            const migrated = structuredClone(parsed);
            for (const group of Object.values(migrated)) {
              for (const [skillName, skill] of Object.entries(group.skills || {})) {
                if (skill.xp !== undefined) {
                  // Convert XP to hours (approximate: 1 XP ≈ 15 min of practice)
                  const hours = Math.round(skill.xp / 4); // 10 XP per task, ~2.5 hours per 10 XP
                  group.skills[skillName] = {
                    hours: hours,
                    lastApplied: skill.lastCompleted,
                    evidenceCount: Math.floor(skill.xp / 10), // Approximate task count
                    evidence: [],
                    notes: '',
                  };
                }
              }
            }
            return migrated;
          }
          
          return parsed;
        } catch { return INITIAL_SKILLS; }
      });

      // Streak tracking
      const [streakDays, setStreakDays]         = useState(() => {
        try { return parseInt(localStorage.getItem('meridian_streak_days') || '0', 10); } catch { return 0; }
      });
      const [lastActiveDate, setLastActiveDate] = useState(() => {
        try { return localStorage.getItem('meridian_last_active') || null; } catch { return null; }
      });

      const openWaypoint = (context) => {
        setWaypointContext(context);
        setWaypointOpen(true);
        if (context.type === 'goal') setSelectedId(context.id);
      };

      const closeWaypoint = () => {
        setWaypointOpen(false);
      };

      // Refs
      const canvasRef     = useRef(null);
      const animRef       = useRef(null);
      const animT         = useRef(0);
      const emptyAlpha    = useRef(0);
      const starsRef      = useRef([]);
      const nodeDragged   = useRef(false);
      const mouseDownPos  = useRef(null);
      const projectsRef   = useRef([]);
      const apiKeyRef     = useRef(null);
      const selectedIdRef = useRef(null);
      const panRef        = useRef({ x: 0, y: 0 });
      const draggingRef   = useRef(null);
      const resizeRef     = useRef(null);
      const roRef         = useRef(null);
      // Page refs
      const activePageRef     = useRef('constellation');
      const onwardItemsRef    = useRef([]);
      const skillsRef         = useRef([]);
      const hoveredWeekRef    = useRef(null);
      const selectedSkillRef  = useRef(null);
      const skillsHitAreasRef  = useRef([]);
      const onwardHitAreasRef  = useRef([]);
      const pathsHitAreasRef   = useRef([]);
      const mapWeekRectsRef    = useRef([]);
      const sunIdRef         = useRef(null);
      const solarHitAreasRef  = useRef([]);
      const solarSunPosRef    = useRef({ x: 0, y: 0, R: 0, id: null });
      // Drag/drop refs for canvas access
      const draggedTaskRef    = useRef(null);
      const pendingDropRef    = useRef(null);
      const dragOverHourRef   = useRef(null);
      // Resize drag state for task duration adjustment
      const [resizeDrag, setResizeDrag] = useState(null); // { itemId, startY, startDuration, hour, startMinute }
      const resizeDragRef    = useRef(null);
      // Onward card drag state (free-form vertical reorder)
      const onwardDragRef    = useRef(null);

      // Load persisted state + API key + settings on mount
      useEffect(() => {
        Promise.all([
          window.electronAPI?.loadState() ?? Promise.resolve(null),
          window.electronAPI?.getApiKey() ?? Promise.resolve(null),
        ]).then(([saved, key]) => {
          if (saved) {
            // projects and onwardItems are already loaded from localStorage synchronously.
            // Only override from Electron IPC if localStorage was empty (first run migration).
            const lsProjects = localStorage.getItem('meridian_projects_v2');
            const lsOnward   = localStorage.getItem('meridian_onward_v2');
            if (!lsProjects && saved.projects)    setProjects(saved.projects);
            if (!lsOnward   && saved.onwardItems) setOnwardItems(saved.onwardItems);
            if (saved.focus)        setFocus(saved.focus);
            if (saved.skills)       setSkills(saved.skills);
            else                    setSkills(DEFAULT_SKILLS);
            if (saved.intensity)    setIntensity(saved.intensity);
            if (saved.routines)     setRoutines(saved.routines);
            if (saved.sessions)     setSessions(saved.sessions);
          } else {
            setSkills(DEFAULT_SKILLS);
          }
          if (key) setApiKey(key);
          setLoaded(true);
          
          // Calculate deadline alerts after loading
          setTimeout(() => {
            const alerts = calculateDeadlineAlerts(projects);
            if (alerts.length > 0) {
              setDeadlineAlerts(alerts);
              setShowDeadlineNotifier(true);
            }
          }, 500);
        });
      }, []);

      // Auto-save on every projects/focus/onwardItems/skills change
      useEffect(() => {
        if (!loaded) return;
        window.electronAPI?.saveState({ projects, focus, onwardItems, skills, intensity, routines, sessions });
      }, [projects, focus, onwardItems, skills, intensity, routines, sessions, loaded]);

      // Persist all critical state to localStorage (safety net alongside Electron IPC)
      useEffect(() => { localStorage.setItem('meridian_projects_v2',  JSON.stringify(projects));    }, [projects]);
      useEffect(() => { localStorage.setItem('meridian_onward_v2',    JSON.stringify(onwardItems)); }, [onwardItems]);
      useEffect(() => { localStorage.setItem('meridian_freeform_tasks', JSON.stringify(freeformTasks)); }, [freeformTasks]);
      useEffect(() => { localStorage.setItem('meridian_skills',       JSON.stringify(xpSkills)); }, [xpSkills]);
      useEffect(() => { localStorage.setItem('meridian_companion_name', companionName); }, [companionName]);
      useEffect(() => { localStorage.setItem('meridian_streak_days', String(streakDays));       }, [streakDays]);
      useEffect(() => { if (lastActiveDate) localStorage.setItem('meridian_last_active', lastActiveDate); }, [lastActiveDate]);
      // Persist new Ingestion & Smart Sorting state
      useEffect(() => { localStorage.setItem('meridian_selected_today', JSON.stringify(selectedForToday)); }, [selectedForToday]);
      useEffect(() => { localStorage.setItem('meridian_deferred', JSON.stringify(deferredItems)); }, [deferredItems]);
      useEffect(() => { localStorage.setItem('meridian_backlog', JSON.stringify(backlogItems)); }, [backlogItems]);
      useEffect(() => { localStorage.setItem('meridian_brain_dump', JSON.stringify(brainDumpEntries)); }, [brainDumpEntries]);
      useEffect(() => { localStorage.setItem('meridian_journal', JSON.stringify(journalEntries)); }, [journalEntries]);

      // Escape key exits focus mode
      useEffect(() => {
        const onKey = (e) => {
          if (e.key === 'Escape' && focusMode) {
            handleExitFocus();
          }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [focusMode]);

      function updateStreak() {
        const today = new Date().toDateString();
        if (lastActiveDate === today) return;
        const yesterday = new Date(Date.now() - 86_400_000).toDateString();
        setStreakDays(prev => lastActiveDate === yesterday ? prev + 1 : 1);
        setLastActiveDate(today);
      }

      // Calculate deadline alerts for startup notifier
      function calculateDeadlineAlerts(projectsList) {
        const now = new Date();
        const alerts = [];
        
        projectsList.forEach(p => {
          if (!p.deadline || p.subtasks?.every(s => s.done)) return;
          
          const deadline = new Date(p.deadline);
          const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            alerts.push({ id: p.id, title: p.title, days: diffDays, type: 'overdue', color: '#f77171', priority: p.priority });
          } else if (diffDays <= 3) {
            alerts.push({ id: p.id, title: p.title, days: diffDays, type: 'urgent', color: '#f0b429', priority: p.priority });
          } else if (diffDays <= 7) {
            alerts.push({ id: p.id, title: p.title, days: diffDays, type: 'upcoming', color: '#53aaff', priority: p.priority });
          }
        });
        
        return alerts.sort((a, b) => {
          if (a.type === 'overdue' && b.type !== 'overdue') return -1;
          if (b.type === 'overdue' && a.type !== 'overdue') return 1;
          return a.days - b.days;
        });
      }

      // Sync refs
      useEffect(() => { projectsRef.current   = projects;      }, [projects]);
      useEffect(() => { apiKeyRef.current     = apiKey;        }, [apiKey]);
      useEffect(() => { if (apiKey) localStorage.setItem('meridian_api_key', apiKey); }, [apiKey]);
      useEffect(() => { selectedIdRef.current = selectedId;    }, [selectedId]);
      useEffect(() => { panRef.current        = pan;           }, [pan]);
      useEffect(() => { draggingRef.current   = dragging;      }, [dragging]);
      useEffect(() => { activePageRef.current = activePage;    }, [activePage]);
      
      // Scroll to current time when Onward page opens (center in 5:45 window)
      useEffect(() => {
        if (activePage !== 'onward') return;
        const timer = setTimeout(() => {
          const canvas = canvasRef.current;
          const parent = canvas?.parentElement;
          if (!parent) return;
          
          const now = new Date();
          const curH = now.getHours() + now.getMinutes() / 60;
          const ROW_START = 6;
          const TOTAL_ROWS = 19;
          const VISIBLE_HOURS = 5.75;
          const PAD = 24;
          // Calculate row height to fill viewport (matches drawOnwardPage)
          const rowHeightPx = parent.clientHeight / VISIBLE_HOURS;
          // Center current time in the visible window
          const targetY = PAD + (curH - ROW_START) * rowHeightPx - (parent.clientHeight / 2) + (VISIBLE_HOURS * rowHeightPx / 2);
          // Max scroll = content height - viewport = (TOTAL_ROWS + VISIBLE_HOURS) * rowHeight + PAD - viewport
          const maxScroll = (TOTAL_ROWS + VISIBLE_HOURS) * rowHeightPx + PAD * 2 - parent.clientHeight;
          
          parent.scrollTo({ top: Math.max(0, Math.min(targetY, maxScroll)), behavior: 'smooth' });
        }, 100);
        return () => clearTimeout(timer);
      }, [activePage]);
      useEffect(() => { onwardItemsRef.current = onwardItems;  }, [onwardItems]);
      useEffect(() => { draggedTaskRef.current = draggedTask;  }, [draggedTask]);
      useEffect(() => { pendingDropRef.current = pendingDrop;  }, [pendingDrop]);
      useEffect(() => { dragOverHourRef.current = dragOverHour;  }, [dragOverHour]);
      useEffect(() => { resizeDragRef.current = resizeDrag; }, [resizeDrag]);
      useEffect(() => { skillsRef.current     = skills;        }, [skills]);
      useEffect(() => { hoveredWeekRef.current = hoveredWeek;  }, [hoveredWeek]);
      useEffect(() => { selectedSkillRef.current = selectedSkillId; }, [selectedSkillId]);
      useEffect(() => { sunIdRef.current = sunId; if (sunId) localStorage.setItem('meridian_sun_id', sunId); }, [sunId]);
      
      // Resize canvas when waypoint sidebar opens/closes (after CSS transition)
      useEffect(() => {
        if (activePage !== 'onward') return;
        const timer = setTimeout(() => {
          resizeRef.current?.();
        }, 450); // Wait for CSS transition (0.4s) + small buffer
        return () => clearTimeout(timer);
      }, [waypointOpen, activePage]);


      // ── Canvas draw loop ──────────────────────────────────────
      useEffect(() => {
        if (!loaded || !apiKey || mainPage !== 'hq') return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;

        function resize() {
          const parent = canvas.parentElement;
          if (!parent) return;
          const rect = parent.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;

          const isOnward = activePageRef.current === 'onward';
          const TOTAL_ROWS = 19;
          const VISIBLE_HOURS = 5.75;
          const visibleHeight = rect.height;
          const rowHeightPx = visibleHeight / VISIBLE_HOURS;

          if (isOnward) {
            const contentHeight = (TOTAL_ROWS + VISIBLE_HOURS) * rowHeightPx + 48;
            canvas.width  = rect.width  * dpr;
            canvas.height = contentHeight * dpr;
            canvas.style.width  = rect.width  + 'px';
            canvas.style.height = contentHeight + 'px';
          } else {
            canvas.width  = rect.width  * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width  = rect.width  + 'px';
            canvas.style.height = rect.height + 'px';
          }

          starsRef.current = Array.from({ length: 42 }, () => ({
            x:    Math.random() * rect.width,
            y:    Math.random() * rect.height,
            s:    Math.random() * 1.4 + .25,
            base: Math.random() * .18 + .03,
            ts:   Math.random() * 1.2 + .3,
            to:   Math.random() * Math.PI * 2,
          }));
        }
        resizeRef.current = resize;
        resize();
        roRef.current = new ResizeObserver(resize);
        roRef.current.observe(canvas.parentElement);
        const ctx = canvas.getContext('2d');

        const refs = {
          projectsRef, selectedIdRef, sunIdRef, panRef, draggingRef, activePageRef,
          onwardItemsRef, pendingDropRef, dragOverHourRef, onwardHitAreasRef,
          skillsRef, selectedSkillRef, skillsHitAreasRef,
          hoveredWeekRef, mapWeekRectsRef,
          pathsHitAreasRef,
          solarHitAreasRef, solarSunPosRef,
          emptyAlpha, starsRef, animT,
          resizeDragRef,
          onwardDragRef,
        };

        function frame() {
          animT.current += .016;
          const t    = animT.current;
          const w    = canvas.width;
          const h    = canvas.height;
          const page = activePageRef.current;

          ctx.clearRect(0,0,w,h);
          ctx.fillStyle = T.bg; ctx.fillRect(0,0,w,h);

          // Star field (all pages)
          starsRef.current.forEach(s => {
            const tw = .5 + .5 * Math.sin(t * s.ts + s.to);
            ctx.save(); ctx.beginPath();
            ctx.arc(s.x*dpr, s.y*dpr, s.s*dpr, 0, Math.PI*2);
            ctx.fillStyle = `rgba(214,226,245,${s.base*(.3+.7*tw)})`; ctx.fill(); ctx.restore();
          });

          if (page === 'onward') {
            const parent = canvas.parentElement;
            const viewH  = parent ? parent.clientHeight * dpr : h;
            const scrollY = parent ? parent.scrollTop * dpr : 0;
            drawOnwardPage(ctx, dpr, w, viewH, t, scrollY, refs);
          } else if (page === 'map') {
            drawMapPage(ctx, dpr, w, h, t, refs);
          } else if (page === 'paths') {
            drawPathsPage(ctx, dpr, w, h, t, refs);
          } else if (page === 'skills') {
            drawSkillsPage(ctx, dpr, w, h, t, refs);
          } else {
            drawConstellationPage(ctx, dpr, w, h, t, refs);
          }

          animRef.current = requestAnimationFrame(frame);
        }


        animRef.current = requestAnimationFrame(frame);
        return () => {
          cancelAnimationFrame(animRef.current);
          roRef.current?.disconnect();
        };
      }, [loaded, apiKey, mainPage]);

      const selected  = projects.find((p) => p.id === selectedId);
      const colorFor  = (i) => NODE_PALETTE[i % NODE_PALETTE.length];

      const smartComplete = (f) =>
        f.title.trim() && f.measurable.trim() && f.achievable.trim() && f.relevant.trim() && f.deadline;

      const addProject = useCallback(async () => {
        if (!smartComplete(form)) return;
        const id    = uid();
        const color = colorFor(projects.length);
        const pos   = projectPos(projects.length);
        setProjects((p) => [...p, {
          id, color, pos,
          title:      form.title.trim(),
          desc:       form.desc.trim(),
          measurable: form.measurable.trim(),
          achievable: form.achievable.trim(),
          relevant:   form.relevant.trim(),
          deadline:   form.deadline,
          priority:   form.priority || 'low',
          scale:      form.scale    || 'short',
          inFocus:    false,
          completedAt: null,
          subtasks: [], checkpoints: [],
        }]);
        setSelectedId(id);
        setModal(false);
        setAiMsg("✦ Generating subtasks and checkpoints...");

        const system  = `You are a productivity assistant. Return ONLY a valid JSON array of objects shaped {title:string, isCheckpoint:boolean}. No markdown, no explanation. 4–6 items. Include 1–2 milestones (isCheckpoint:true) and the rest as regular subtasks. Milestones should mark meaningful progress gates toward the measurable outcome. Subtasks should be concrete and actionable.`;
        const userCtx = `Goal: "${form.title}". Description: "${form.desc || "none"}". Success metric: "${form.measurable}". Motivation: "${form.relevant}". Achievability note: "${form.achievable}". Deadline: ${form.deadline}. Generate subtasks and milestone checkpoints for this SMART goal.`;
        const raw = await askAI(system, userCtx, apiKey);

        try {
          const items = JSON.parse(raw.replace(/```json|```/g, "").trim());
          setProjects((prev) =>
            prev.map((p) => {
              if (p.id !== id) return p;
              return {
                ...p,
                subtasks:    items.filter((x) => !x.isCheckpoint).map((x) => ({ id: uid(), title: x.title, done: false })),
                checkpoints: items.filter((x) =>  x.isCheckpoint).map((x) => ({ id: uid(), title: x.title, done: false })),
              };
            })
          );
          setAiMsg(`✦ ${items.length} items generated for "${form.title}"`);
        } catch {
          setAiMsg("AI responded but couldn't parse. Try adding subtasks manually.");
        }
        setForm({ title: "", desc: "", measurable: "", achievable: "", relevant: "", deadline: "", priority: "low", scale: "short" });
      }, [form, projects.length, apiKey]);

      // Handler for GoalModal onCreate — creates a goal from the new two-stage modal
      const createGoalFromModal = useCallback((goalData) => {
        const id    = uid();
        const color = colorFor(projects.length);
        const pos   = projectPos(projects.length);
        const newProject = {
          id, color, pos,
          title:       goalData.title || 'Untitled Goal',
          desc:        goalData.desc || '',
          measurable:  goalData.measurable || '',
          achievable:  goalData.achievable || '',
          relevant:    goalData.relevant || '',
          deadline:    goalData.deadline || '',
          priority:    goalData.priority || 'low',
          scale:       goalData.scale || 'short',
          inFocus:     false,
          completedAt: null,
          subtasks:    (goalData.subtasks || []).map(st => ({ id: uid(), title: st.title, done: false, skill: st.skill || null })),
          checkpoints: (goalData.checkpoints || []).map(cp => ({ id: uid(), title: cp.title, done: false })),
        };
        setProjects(prev => [...prev, newProject]);
        setSelectedId(id);
        if (goalData.subtasks?.length || goalData.checkpoints?.length) {
          setAiMsg(`✦ ${(goalData.subtasks?.length || 0) + (goalData.checkpoints?.length || 0)} items generated for "${newProject.title}"`);
        }
      }, [projects.length]);

      // Onward item handlers
      const addOnwardItem = () => {
        if (!onwardForm.title.trim()) return;
        const item = { id: uid(), title: onwardForm.title.trim(), hour: onwardForm.hour, done: false, priority: onwardForm.priority, goalId: onwardForm.goalId, date: new Date().toDateString(), duration: 60 };
        setOnwardItems(prev => [...prev, item]);
        setOnwardForm(f => ({ ...f, title: '', goalId: null }));
      };
      // Confirm a dropped subtask/checkpoint into a time block
      const confirmPendingDrop = () => {
        if (!pendingDrop) return;
        const { task, hour } = pendingDrop;
        const item = {
          id: uid(),
          title: task.title,
          hour,
          done: false,
          priority: 'low',
          goalId: task.goalId,
          date: new Date().toDateString(),
          duration: 60,
          ...(task.type !== 'freeform' && { linkedType: task.type, linkedId: task.id }),
        };
        setOnwardItems(prev => [...prev, item]);
        if (task.type === 'freeform') {
          setFreeformTasks(prev => prev.filter(ft => ft.id !== task.id));
        }
        setPendingDrop(null);
        setDraggedTask(null);
        setDragOverHour(null);
      };
      const cancelPendingDrop = () => {
        setPendingDrop(null);
        setDraggedTask(null);
        setDragOverHour(null);
      };
      const deleteOnwardItem = (id) => setOnwardItems(prev => prev.filter(it => it.id !== id));
      const returnOnwardItemToAvailable = (id) => {
        const item = onwardItems.find(it => it.id === id);
        if (!item) return;
        if (!item.linkedId) {
          setFreeformTasks(prev => [...prev, { id: item.id, title: item.title, goalId: item.goalId || null }]);
        }
        setOnwardItems(prev => prev.filter(it => it.id !== id));
      };
      const moveOnwardItem = (id, dir) => {
        setOnwardItems(prev => {
          const sorted = [...prev].sort((a, b) => a.hour - b.hour);
          const idx = sorted.findIndex(it => it.id === id);
          const swapIdx = idx + dir;
          if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
          const hourA = sorted[idx].hour;
          const hourB = sorted[swapIdx].hour;
          return prev.map(it => {
            if (it.id === sorted[idx].id) return { ...it, hour: hourB };
            if (it.id === sorted[swapIdx].id) return { ...it, hour: hourA };
            return it;
          });
        });
      };
      const handleStartFocus = (item) => {
        const POMODORO_KEY = 'meridian_pomodoro'; // must match STORAGE_KEY in PomodoroView.jsx
        try {
          const current = JSON.parse(localStorage.getItem(POMODORO_KEY) || 'null') || {};
          localStorage.setItem(POMODORO_KEY, JSON.stringify({
            ...current,
            linkedGoalId: item.goalId ?? null,
            linkedTaskId: item.id,
            running: false,
          }));
        } catch {}
        setPomodoroPreselect({ goalId: item.goalId ?? null, taskId: item.id });
        // Also set focusMode for immersive FocusScreen
        setFocusMode({ active: true, taskTitle: item.title, taskId: item.id, goalId: item.goalId ?? null });
      };

      // ── New Ingestion & Smart Sorting handlers ──
      const handleFocusSessionComplete = (session) => {
        setSessions(prev => [...prev, session]);
        // Check if task overran estimate → fire journal prompt
        const onwardItem = onwardItems.find(it => it.id === session.goalId || it.title === session.label);
        if (onwardItem && onwardItem.duration) {
          const estimated = onwardItem.duration;
          if (session.duration > estimated * 1.2) {
            // Will be handled by FocusScreen's journal prompt
          }
        }
      };

      const handleBrainDump = (entry) => {
        setBrainDumpEntries(prev => [...prev, entry]);
      };

      const handleJournalEntry = (entry) => {
        setJournalEntries(prev => [...prev, entry]);
      };

      const handleBreakdownTask = (task, subTasks) => {
        // Find or create a project for this task, then add subtasks
        const existingProject = projects.find(p => p.id === task.goalId);
        if (existingProject) {
          // Add subtasks to the existing project
          const newSubtasks = subTasks.map(st => ({
            id: uid(),
            title: st.trim(),
            done: false,
            createdAt: Date.now(),
          }));
          setProjects(prev => prev.map(p =>
            p.id === existingProject.id
              ? { ...p, subtasks: [...p.subtasks, ...newSubtasks] }
              : p
          ));
        } else {
          // Create a new project for this task
          const newProject = {
            id: uid(),
            title: task.title,
            desc: '',
            color: T.accent,
            priority: task.priority || 'low',
            scale: 'short',
            deadline: '',
            measurable: '',
            achievable: '',
            relevant: '',
            completedAt: null,
            createdAt: Date.now(),
            subtasks: subTasks.map(st => ({
              id: uid(),
              title: st.trim(),
              done: false,
              createdAt: Date.now(),
            })),
            checkpoints: [],
          };
          setProjects(prev => [...prev, newProject]);
        }
      };

      const handleBreakdownSuggestion = (taskLabel) => {
        // Open the Briefing program's breakdown phase for this task
        const task = onwardItems.find(it => it.title === taskLabel);
        if (task) {
          handleBreakdownTask(task, [`${taskLabel} — Part 1`, `${taskLabel} — Part 2`]);
        }
      };

      const handleRestoreFromBacklog = (itemId) => {
        const item = backlogItems.find(b => b.id === itemId);
        if (!item) return;
        // Remove from backlog
        setBacklogItems(prev => prev.filter(b => b.id !== itemId));
        // Add back to onwardItems with a default time
        setOnwardItems(prev => [...prev, {
          id: uid(),
          title: item.title,
          hour: 480, // 8:00 AM default
          priority: item.priority || 'low',
          goalId: item.goalId || null,
          done: false,
          createdAt: Date.now(),
        }]);
      };

      const handleExitFocus = () => {
        setFocusMode(null);
      };
      const toggleOnwardDone = (id) => {
        const item = onwardItems.find(it => it.id === id);
        if (item?.novaTaskId && !item.done) {
          addSyncEvent('task_completed', item.title);
        }
        setOnwardItems(prev => prev.map(it => it.id === id ? { ...it, done: !it.done } : it));
        if (item && !item.done) setShowMindCheckCard(true);
        const remainingNovaItems = onwardItems.filter(it => it.novaTaskId && !it.done && it.id !== id).length;
        if (novaState.dailyPlan && remainingNovaItems < 5 && !novaState.planGenLoading) {
          generateNovaPlan();
        }
      };

      // Skills handlers
      const updateSkillLevel = (groupId, subId, level) =>
        setSkills(prev => prev.map(g => g.id !== groupId ? g : {
          ...g, subskills: g.subskills.map(ss => ss.id === subId ? { ...ss, level } : ss)
        }));
      const addSubskill = (groupId, name) =>
        setSkills(prev => prev.map(g => g.id !== groupId ? g : {
          ...g, subskills: [...g.subskills, { id: uid(), name, level: 1 }]
        }));

      const toggleSubtask = (projId, stId) => {
        setProjects((prev) => prev.map((p) => {
          if (p.id !== projId) return p;
          return {
            ...p, subtasks: p.subtasks.map((s) => {
              if (s.id !== stId) return s;
              const nowCompleting = !s.done;

              if (s.skill && nowCompleting) {
                // Find which group contains this skill and record evidence
                setXpSkills(prevSkills => {
                  for (const [groupName, group] of Object.entries(prevSkills)) {
                    if (group.skills[s.skill] !== undefined) {
                      return addSkillEvidence(prevSkills, groupName, s.skill, 0, p.title);
                    }
                  }
                  return prevSkills;
                });
              }

              if (nowCompleting) updateStreak();
              return { ...s, done: nowCompleting, completedAt: nowCompleting ? new Date().toISOString() : null };
            }),
          };
        }));
      };

      const handleUpdateSkillMeta = (groupName, skillName, updates) => {
        setXpSkills(prev => updateSkillMeta(prev, groupName, skillName, updates));
      };

      const toggleCheckpoint = (projId, cpId) =>
        setProjects((prev) => prev.map((p) => p.id !== projId ? p : {
          ...p, checkpoints: p.checkpoints.map((c) => c.id === cpId
            ? { ...c, done: !c.done, completedAt: !c.done ? new Date().toISOString() : null }
            : c)
        }));

      const toggleFocus = (projId) =>
        setProjects(prev => prev.map(p => p.id !== projId ? p : { ...p, inFocus: !p.inFocus }));

      const deleteGoal = (id) => {
        setProjects(prev => prev.filter(p => p.id !== id));
        if (selectedId === id) setSelectedId(null);
        setConfirmDelete(null);
      };

      const completeGoal = (id) => {
        setProjects(prev => prev.map(p => p.id !== id ? p : { ...p, completedAt: new Date().toISOString() }));
        if (sunId === id) setSunId(null);
        closeWaypoint();
        setSelectedId(null);
      };

      const renameGoal = (id, newTitle) => {
        if (!newTitle.trim()) return;
        setProjects(prev => prev.map(p => p.id !== id ? p : { ...p, title: newTitle.trim() }));
      };

      const deleteSubtask = (projId, stId) =>
        setProjects(prev => prev.map(p => p.id !== projId ? p : { ...p, subtasks: p.subtasks.filter(s => s.id !== stId) }));

      const deleteCheckpoint = (projId, cpId) =>
        setProjects(prev => prev.map(p => p.id !== projId ? p : { ...p, checkpoints: p.checkpoints.filter(c => c.id !== cpId) }));

      const addSubtask = () => {
        const t = addInput.trim();
        if (!t || !selected) return;
        setProjects((prev) => prev.map((p) => p.id === selected.id ? { ...p, subtasks: [...p.subtasks, { id: uid(), title: t, done: false }] } : p));
        setAddInput('');
      };

      const addCheckpoint = () => {
        const t = addInput.trim();
        if (!t || !selected) return;
        setProjects((prev) => prev.map((p) => p.id === selected.id ? { ...p, checkpoints: [...p.checkpoints, { id: uid(), title: t, done: false }] } : p));
        setAddInput('');
      };

      const updateNote = (projId, itemId, isCheckpoint, notes) =>
        setProjects(prev => prev.map(p => {
          if (p.id !== projId) return p;
          return isCheckpoint
            ? { ...p, checkpoints: p.checkpoints.map(c => c.id === itemId ? { ...c, notes } : c) }
            : { ...p, subtasks:    p.subtasks.map(s    => s.id === itemId ? { ...s, notes } : s) };
        }));

      const startSession = (label = '', goalId = null) => {
        const s = { id: uid(), startTime: new Date().toISOString(), endTime: null, label, goalId };
        setActiveSession(s);
        setSessions(prev => [...prev, s]);
      };
      const stopSession = () => {
        if (!activeSession) return;
        const endTime = new Date().toISOString();
        setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, endTime } : s));
        setActiveSession(null);
      };

      const planDay = async () => {
        if (!projects.length) return;
        setPlanningDay(true);
        const summary = projects.map(p => `"${p.title}" (${progress(p)}% done)`).join(', ');
        const system  = 'Return ONLY a JSON array of exactly 3 short strings (max 28 chars each) as focus areas for today. No explanation, no markdown.';
        const raw     = await askAI(system, `Goals: ${summary}. Suggest 3 focus areas for today.`, apiKey);
        try {
          const areas = JSON.parse(raw.replace(/```json|```/g, '').trim());
          if (Array.isArray(areas) && areas.length >= 3)
            setFocus([String(areas[0]), String(areas[1]), String(areas[2])]);
        } catch {}
        setPlanningDay(false);
      };

      // ── Performance calculations ──────────────────────────────
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

      const getMonthlyData = () => {
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
      };


      // ── Tracking helpers ─────────────────────────────────────────
      const todayStr = () => new Date().toISOString().slice(0, 10);
      const sessionDurationMin = (s) => {
        const end = s.endTime ? new Date(s.endTime) : new Date();
        return Math.max(0, Math.round((end - new Date(s.startTime)) / 60000));
      };
      const getSessionsForDay = (dateStr) => sessions.filter(s => s.startTime.startsWith(dateStr));
      const getSessionsForWeek = () => {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6); cutoff.setHours(0,0,0,0);
        return sessions.filter(s => new Date(s.startTime) >= cutoff);
      };
      const getSessionsForMonth = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return sessions.filter(s => new Date(s.startTime) >= start);
      };
      const getTodayStats = () => {
        const todaySessions = getSessionsForDay(todayStr()).filter(s => s.endTime);
        const totalMin = todaySessions.reduce((a, s) => a + sessionDurationMin(s), 0);
        const focusedMin = todaySessions.filter(s => sessionDurationMin(s) >= 25).reduce((a, s) => a + sessionDurationMin(s), 0);
        const productiveMin = todaySessions.filter(s => s.goalId).reduce((a, s) => a + sessionDurationMin(s), 0);
        const lastEnded = todaySessions.slice().sort((a,b) => new Date(b.endTime)-new Date(a.endTime))[0];
        const minSinceBreak = lastEnded ? Math.round((Date.now() - new Date(lastEnded.endTime)) / 60000) : 0;
        return { totalMin, focusedMin, productiveMin, minSinceBreak };
      };

      const checkIn = async () => {
        if (!selected) { setAiMsg('Open a goal first to use Check In.'); return; }
        if (!apiKey)   { setAiMsg('Add your OpenRouter API key in Settings.'); return; }
        setCompanionLoading(true);
        setAiMsg("");
        try {
          const subtasks    = selected.subtasks    ?? [];
          const checkpoints = selected.checkpoints ?? [];
          const done   = subtasks.filter((s) => s.done).length;
          const total  = subtasks.length;
          const cpDone = checkpoints.filter((c) => c.done).length;
          const lightCtx = buildLightKnowledgeContext(knowledgePool);
          const system = (`You are a thoughtful, non-pushy productivity companion named ${companionName}. Keep check-ins brief (2–3 sentences), warm, and psychologically honest. No toxic positivity. Focus on reflection and clarity, not pressure.${lightCtx ? ' ' + lightCtx : ''}`).trim();
          const msg = await askAI(system, `Goal: "${selected.title}". Progress: ${done}/${total} subtasks done, ${cpDone}/${checkpoints.length} checkpoints reached. Do a brief check-in.`, apiKey);
          setAiMsg(msg || 'No response from AI. Check your API key in Settings.');
        } finally {
          setCompanionLoading(false);
        }
      };

      const suggestSubtask = async () => {
        if (!selected) { setAiMsg('Open a goal first to get suggestions.'); return; }
        if (!apiKey)   { setAiMsg('Add your OpenRouter API key in Settings.'); return; }
        setCompanionLoading(true);
        try {
          const subtasks = selected.subtasks ?? [];
          const existing = subtasks.map((s) => s.title).join(", ");
          const lightCtx = buildLightKnowledgeContext(knowledgePool);
          const system = (`You are a JSON API. Respond with ONLY a raw JSON object and nothing else. No markdown, no code fences, no explanation. Example: {"title":"Buy groceries"}${lightCtx ? ' ' + lightCtx : ''}`).trim();
          const raw = await askAI(system, `Goal: "${selected.title}". Existing subtasks: ${existing || "none"}. Reply with exactly one JSON object {"title":"<next subtask>"}.`, apiKey);
          try {
            const cleaned = raw.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();
            const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
            const item = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
            if (!item.title) throw new Error('no title');
            setProjects((prev) => prev.map((p) => p.id === selected.id ? { ...p, subtasks: [...(p.subtasks ?? []), { id: uid(), title: item.title, done: false }] } : p));
            setAiMsg(`✦ Added: "${item.title}"`);
          } catch {
            setAiMsg(`Couldn't parse the suggestion. Raw: ${raw?.slice(0,120)}`);
          }
        } finally {
          setCompanionLoading(false);
        }
      };

      // ── Canvas mouse handlers ─────────────────────────────────
      const onCanvasMouseDown = (e) => {
        console.log(`[DEBUG_RESIZE] onCanvasMouseDown fired. page=${activePageRef.current} clientX=${e.clientX} clientY=${e.clientY} target=${e.target?.tagName}`);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const cx   = e.clientX - rect.left;
        const cy   = e.clientY - rect.top;
        nodeDragged.current  = false;
        mouseDownPos.current = { cx, cy, clientX: e.clientX, clientY: e.clientY };
        console.log(`[DEBUG_RESIZE] onCanvasMouseDown: canvas rect top=${rect.top} left=${rect.left} cx=${cx.toFixed(1)} cy=${cy.toFixed(1)}`);

        // Check for resize handle click on Onward page
        if (activePageRef.current === 'onward') {
          console.log(`[DEBUG_RESIZE] onCanvasMouseDown: searching onwardHitAreas (count=${onwardHitAreasRef.current.length})`);
          const hit = onwardHitAreasRef.current.find(a => cx>=a.x && cx<=a.x+a.w && cy>=a.y && cy<=a.y+a.h);
          console.log(`[DEBUG_RESIZE] onCanvasMouseDown: hit found =`, hit ? `id=${hit.id} x=${hit.x} y=${hit.y} w=${hit.w} h=${hit.h}` : 'null');
          if (hit && hit.id.startsWith('resize:')) {
            const itemId = hit.resizeItemId;
            const item = onwardItemsRef.current.find(it => it.id === itemId);
            console.log(`[DEBUG_RESIZE] onCanvasMouseDown: RESIZE HANDLE CLICKED! itemId=${itemId} item=`, item ? item.title : 'NOT FOUND');
            if (item) {
              const ROW_START = 6;
              const VISIBLE_HOURS = 5.75;
              const parent = canvas.parentElement;
              const clientH = parent ? parent.clientHeight : 800;
              const rowHcss = clientH / VISIBLE_HOURS;
              const PAD = 24;
              const minuteOffset = item.hour % 60;
              const minuteFrac = minuteOffset / 60;
              const itemTopY = PAD + (Math.floor(item.hour / 60) - ROW_START) * rowHcss + minuteFrac * rowHcss;
              const startDuration = item.duration || 60;
              console.log(`[DEBUG_RESIZE] onCanvasMouseDown: Setting resizeDrag state itemId=${itemId} startY=${cy.toFixed(1)} startDuration=${startDuration}`);
              setResizeDrag({ itemId, startY: cy, startDuration, hour: Math.floor(item.hour / 60), startMinute: item.hour % 60, itemTopY });
              return;
            } else {
              console.log(`[DEBUG_RESIZE] onCanvasMouseDown: item NOT FOUND in onwardItems for itemId=${itemId}`);
            }
          }

          // Check for onward card body drag (not resize handle, not confirm/cancel buttons)
          if (hit && !hit.id.startsWith('resize:') && !hit.id.startsWith('confirm') && !hit.id.startsWith('cancel')) {
            const itemId = hit.id;
            const item = onwardItemsRef.current.find(it => it.id === itemId);
            if (item) {
              const ROW_START = 6;
              const VISIBLE_HOURS = 5.75;
              const parent = canvas.parentElement;
              const clientH = parent ? parent.clientHeight : 800;
              const rowHcss = clientH / VISIBLE_HOURS;
              const PAD = 24;
              const minuteOffset = item.hour % 60;
              const minuteFrac = minuteOffset / 60;
              const itemTopY = PAD + (Math.floor(item.hour / 60) - ROW_START) * rowHcss + minuteFrac * rowHcss;
              onwardDragRef.current = {
                itemId,
                startY: cy,
                startHour: item.hour,
                startDuration: item.duration || 60,
                offsetY: 0,
                itemTopY,
              };
              return;
            }
          }
        }

        if (activePageRef.current !== 'constellation') return;

        const pan    = panRef.current;
        const projs  = projectsRef.current;

        const clickedProj = projs.find((p, pi) => {
          const pp = p.pos || projectPos(pi);
          return Math.hypot(cx - (pp.x + pan.x), cy - (pp.y + pan.y)) < 44;
        });

        if (clickedProj) {
          const pi = projs.indexOf(clickedProj);
          const pp = clickedProj.pos || projectPos(pi);
          const d  = { type: 'node', id: clickedProj.id, ox: cx - pan.x - pp.x, oy: cy - pan.y - pp.y };
          draggingRef.current = d;
          setDragging(d);
        } else {
          const d = { type: 'pan', sx: e.clientX - pan.x, sy: e.clientY - pan.y };
          draggingRef.current = d;
          setDragging(d);
        }
      };

      const onCanvasMouseMove = (e) => {
        // Map hover detection (does not need drag state)
        if (activePageRef.current === 'map') {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          const my   = e.clientY - rect.top;
          const rects = mapWeekRectsRef.current;
          let found = null;
          for (const wr of rects) {
            if (my >= wr.y && my < wr.y + wr.h) { found = wr.weekIdx; break; }
          }
          if (found !== hoveredWeekRef.current) {
            hoveredWeekRef.current = found;
            setHoveredWeek(found);
          }
          return;
        }
        // Handle resize drag on Onward page
        if (activePageRef.current === 'onward') {
          const rd = resizeDragRef.current;
          console.log(`[DEBUG_RESIZE] onCanvasMouseMove: onward page, resizeDragRef.current=`, rd ? `itemId=${rd.itemId} startY=${rd.startY.toFixed(1)} startDuration=${rd.startDuration}` : 'null');
          if (rd) {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const cy = e.clientY - rect.top;
            const dy = cy - rd.startY;
            const VISIBLE_HOURS = 5.75;
            const parent = canvas.parentElement;
            const clientH = parent ? parent.clientHeight : 800;
            const rowHcss = clientH / VISIBLE_HOURS;
            // Convert pixel delta to minutes (1 hour = rowHcss pixels)
            const deltaMinutes = Math.round(dy / rowHcss * 60);
            // Clamp duration between 15 and 240 minutes
            const newDuration = Math.max(15, Math.min(240, rd.startDuration + deltaMinutes));
            console.log(`[DEBUG_RESIZE] onCanvasMouseMove: RESIZING! dy=${dy.toFixed(1)}px deltaMinutes=${deltaMinutes} newDuration=${newDuration} rowHcss=${rowHcss.toFixed(2)}`);
            setOnwardItems(prev => prev.map(it =>
              it.id === rd.itemId ? { ...it, duration: newDuration } : it
            ));
            return;
          }

          // Handle onward card body drag
          const od = onwardDragRef.current;
          if (od) {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const cy = e.clientY - rect.top;
            od.offsetY = cy - od.startY;
            return;
          }
        }
        if (activePageRef.current !== 'constellation') return;

        const d = draggingRef.current;
        if (!d) return;
        if (d.type === 'pan') {
          const newPan = { x: e.clientX - d.sx, y: e.clientY - d.sy };
          panRef.current = newPan;
          setPan(newPan);
        } else if (d.type === 'node') {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const rect = canvas.getBoundingClientRect();
          const cx   = e.clientX - rect.left;
          const cy   = e.clientY - rect.top;
          if (mouseDownPos.current) {
            const dist = Math.hypot(cx - mouseDownPos.current.cx, cy - mouseDownPos.current.cy);
            if (dist > 4) nodeDragged.current = true;
          }
          if (nodeDragged.current) {
            const pan = panRef.current;
            setProjects(prev => prev.map(p => p.id === d.id
              ? { ...p, pos: { x: cx - pan.x - d.ox, y: cy - pan.y - d.oy } }
              : p
            ));
          }
        }
      };

      // Drag and drop handlers for subtask/checkpoint to time block
      const onCanvasDragOver = (e) => {
        if (activePageRef.current !== 'onward') return;
        e.preventDefault();
        const task = draggedTaskRef.current;
        if (!task) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const cy = e.clientY - rect.top;
        // Calculate which hour row is being hovered (cy is absolute canvas CSS Y)
        const PAD = 24;
        const ROW_START = 6;
        const ROW_END = 24;
        const VISIBLE_HOURS = 5.75;
        const parent = canvas.parentElement;
        const clientH = parent ? parent.clientHeight : 800;
        const rowHcss = clientH / VISIBLE_HOURS;
        const totalRows = ROW_END - ROW_START;
        const hi = Math.floor((cy - PAD) / rowHcss);
        if (hi >= 0 && hi < totalRows) {
          setDragOverHour(ROW_START + hi);
        }
      };
      const onCanvasDragLeave = (e) => {
        setDragOverHour(null);
      };
      const onCanvasDrop = (e) => {
        if (activePageRef.current !== 'onward') return;
        e.preventDefault();
        const task = draggedTaskRef.current;
        const hour = dragOverHourRef.current;
        if (task && hour !== null) {
          // Set pending drop - shows ghost block with confirm/cancel buttons
          setPendingDrop({ task, hour: hour * 60 }); // hour in minutes
        }
        setDragOverHour(null);
        setDraggedTask(null);
      };

      const onCanvasMouseUp = (e) => {
        const page = activePageRef.current;
        const d    = draggingRef.current;
        const md   = mouseDownPos.current;
        const wasClick = md && Math.hypot(e.clientX - md.clientX, e.clientY - md.clientY) < 5;
        console.log(`[DEBUG_RESIZE] onCanvasMouseUp: page=${page} wasClick=${wasClick} resizeDrag=`, resizeDrag ? `itemId=${resizeDrag.itemId}` : 'null');

        // Clear resize drag state on mouse up — use ref, not state, since setResizeDrag is async
        if (resizeDragRef.current) {
          console.log(`[DEBUG_RESIZE] onCanvasMouseUp: CLEARING resizeDrag for itemId=${resizeDragRef.current.itemId}`);
          setResizeDrag(null);
        }

        // Commit onward card drag if active
        if (onwardDragRef.current) {
          const od = onwardDragRef.current;
          const ROW_START = 6;
          const ROW_END = 24;
          const VISIBLE_HOURS = 5.75;
          const parent = canvasRef.current?.parentElement;
          const clientH = parent ? parent.clientHeight : 800;
          const rowHcss = clientH / VISIBLE_HOURS;
          const PAD = 24;

          // Calculate drop position
          const dropY = od.itemTopY + od.offsetY;
          const dropHourFrac = ROW_START + (dropY - PAD) / rowHcss;
          // Convert fractional hour to total minutes, clamp to valid range
          const newHour = Math.max(ROW_START * 60, Math.min(ROW_END * 60 - 15, Math.round(dropHourFrac * 60)));

          // Only update if position actually changed
          if (newHour !== od.startHour) {
            setOnwardItems(prev => prev.map(it =>
              it.id === od.itemId ? { ...it, hour: newHour } : it
            ));
          }

          onwardDragRef.current = null;
        }

        if (wasClick && page === 'onward') {
          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const hit = onwardHitAreasRef.current.find(a => cx>=a.x && cx<=a.x+a.w && cy>=a.y && cy<=a.y+a.h);
            if (hit) {
              // Handle confirm/cancel drop buttons
              if (hit.id === 'confirm-drop') {
                confirmPendingDrop();
                draggingRef.current = null; mouseDownPos.current = null; setDragging(null);
                return;
              }
              if (hit.id === 'cancel-drop') {
                cancelPendingDrop();
                draggingRef.current = null; mouseDownPos.current = null; setDragging(null);
                return;
              }
              // Regular task click
              const item = onwardItemsRef.current.find(it => it.id === hit.id);
              if (item) setOnwardClickedItem({ ...item, cardX: e.clientX, cardY: e.clientY });
            }
          }
          draggingRef.current = null; mouseDownPos.current = null; setDragging(null);
          return;
        }

        if (wasClick && page === 'paths') {
          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const hit = pathsHitAreasRef.current.find(a => cx>=a.x && cx<=a.x+a.w && cy>=a.y && cy<=a.y+a.h);
            if (hit) setSelectedId(id => id === hit.id ? null : hit.id);
          }
          draggingRef.current = null; mouseDownPos.current = null; setDragging(null);
          return;
        }

        if (wasClick && page === 'skills') {
          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const hit = skillsHitAreasRef.current.find(a => cx>=a.x && cx<=a.x+a.w && cy>=a.y && cy<=a.y+a.h);
            if (hit) {
              selectedSkillRef.current = hit.id;
              setSelectedSkillId(id => id === hit.id ? null : hit.id);
            }
          }
          draggingRef.current = null; mouseDownPos.current = null; setDragging(null);
          return;
        }

        if (page === 'map') {
          draggingRef.current = null; mouseDownPos.current = null; setDragging(null);
          return;
        }

        // Solar system / Constellation click logic
        if (wasClick) {
          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const cx   = e.clientX - rect.left;
            const cy   = e.clientY - rect.top;

            // Check sun click
            const sun = solarSunPosRef.current;
            if (sun.id && Math.hypot(cx - sun.x, cy - sun.y) < sun.R) {
              if (selectedIdRef.current === sun.id) {
                setSelectedId(null); closeWaypoint();
              } else {
                setSelectedId(sun.id); openWaypoint({ type: 'goal', id: sun.id });
              }
              draggingRef.current = null; mouseDownPos.current = null; setDragging(null);
              return;
            }

            // Check planet clicks
            const hitPlanet = solarHitAreasRef.current.find(a => Math.hypot(cx - a.x, cy - a.y) < a.R);
            if (hitPlanet) {
              if (selectedIdRef.current === hitPlanet.id) {
                setSelectedId(null); closeWaypoint();
              } else {
                setSelectedId(hitPlanet.id); openWaypoint({ type: 'goal', id: hitPlanet.id });
              }
              draggingRef.current = null; mouseDownPos.current = null; setDragging(null);
              return;
            }
          }
        }

        draggingRef.current  = null;
        mouseDownPos.current = null;
        setDragging(null);
      };

      if (!loaded) return null;
      if (!apiKey) return <ApiKeyScreen onSave={setApiKey} />;

      return (
        <>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
            *{box-sizing:border-box;margin:0;padding:0;}
            ::-webkit-scrollbar{width:3px;}
            ::-webkit-scrollbar-track{background:${T.surface};}
            ::-webkit-scrollbar-thumb{background:${T.dim};border-radius:2px;}

            /* ── App shell ── */
            .app-shell{display:flex;height:100vh;overflow:hidden;background:${T.bg};color:${T.text};font-family:'Syne',sans-serif;}

            /* ── SIGNAL ── */
            .sig{width:180px;flex-shrink:0;background:${T.surface};border-right:1px solid ${T.border};display:flex;flex-direction:column;overflow:hidden;}
            .sig-logo{padding:14px 13px 11px;border-bottom:1px solid ${T.border};}
            .sig-brand{font-size:15px;font-weight:700;color:${T.accent};letter-spacing:.14em;}
            .sig-subt{font-size:7px;color:${T.muted};letter-spacing:.18em;text-transform:uppercase;margin-top:3px;}
            .sec{padding:10px 11px 6px;}
            .secl{font-size:7.5px;color:${T.muted};text-transform:uppercase;letter-spacing:.12em;display:flex;align-items:center;gap:5px;margin-bottom:8px;}
            .pip{width:5px;height:5px;border-radius:50%;flex-shrink:0;}
            .fci{display:flex;align-items:center;gap:7px;padding:6px 7px;background:${T.card};border-radius:6px;margin-bottom:4px;cursor:pointer;border:1px solid transparent;transition:all .14s;}
            .fci:hover{border-color:${T.dim};}
            .fci.sel{border-color:${T.accent}50;background:${T.accent}08;}
            .fci-ico{width:22px;height:22px;border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
            .fci-txt{font-size:10.5px;color:${T.text};line-height:1.25;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
            .fci-input{background:transparent;border:none;color:${T.text};font-family:'Syne',sans-serif;font-size:10.5px;width:100%;outline:none;padding:0;cursor:text;}
            .fci-input::placeholder{color:${T.muted};font-size:10px;}
            .grl{display:flex;align-items:center;gap:7px;padding:6px 7px;border-radius:6px;cursor:pointer;border:1px solid transparent;transition:all .14s;margin-bottom:3px;}
            .grl:hover{background:${T.card};}
            .grl.sel{background:${T.card};border-color:${T.accent}40;}
            .gr-pip{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
            .gr-nm{font-size:10.5px;color:${T.text};flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
            .gr-pc{font-size:9.5px;color:${T.muted};}
            .sig-add{margin:5px 11px 7px;padding:7px;background:${T.accentLo};border:1px solid ${T.accent}30;border-radius:6px;color:${T.accent};font-size:10.5px;text-align:center;cursor:pointer;letter-spacing:.04em;font-family:'Syne',sans-serif;font-weight:700;transition:all .14s;}
            .sig-add:hover{background:${T.accent}22;border-color:${T.accent}60;}
            .sig-nav{display:flex;border-top:1px solid ${T.border};background:${T.bg};margin-top:auto;flex-shrink:0;}
            .nb{flex:1;padding:9px 2px;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;border:none;background:none;}
            .ni{width:27px;height:27px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:background .14s;}
            .nl{font-size:7px;letter-spacing:.06em;text-transform:uppercase;color:${T.muted};transition:color .14s;font-family:'IBM Plex Mono',monospace;}
            .nb.on .nl{color:${T.accent};}
            .nb.on .ni{background:${T.accent}12;}

            /* ── COMMAND ── */
            .cmd{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden;position:relative;}
            .ctb{padding:11px 14px;border-bottom:1px solid ${T.border};display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
            .cttl{font-size:14px;color:${T.accent};font-weight:700;letter-spacing:.1em;font-family:'Syne',sans-serif;}
            .cdt{font-size:9px;color:${T.muted};margin-top:2px;font-family:'IBM Plex Mono',monospace;}
            .cbtn{padding:6px 11px;background:${T.accentLo};border:1px solid ${T.accent}30;border-radius:20px;color:${T.accent};font-size:9.5px;cursor:pointer;font-family:'IBM Plex Mono',monospace;letter-spacing:.04em;white-space:nowrap;transition:all .14s;}
            .cbtn:hover{background:${T.accent}22;border-color:${T.accent}60;}
            .cbody{flex:1;overflow:hidden;position:relative;}
            .cv{width:100%;height:100%;position:relative;overflow:hidden;}
            .cv::-webkit-scrollbar{width:8px;height:8px;}
            .cv::-webkit-scrollbar-track{background:${T.bg};}
            .cv::-webkit-scrollbar-thumb{background:${T.border};border-radius:4px;}
            .cv::-webkit-scrollbar-thumb:hover{background:${T.muted};}

            /* ── WAYPOINT ── */
            .wp{position:absolute;top:0;right:0;height:100%;width:0;overflow:hidden;background:${T.surface};display:flex;transition:width .4s cubic-bezier(.4,0,.2,1);z-index:20;box-shadow:-4px 0 24px rgba(0,0,0,.35);}
            .wp.open{width:244px;border-left:1px solid ${T.border};}
            .wpi{width:244px;flex-shrink:0;display:flex;flex-direction:column;height:100%;overflow:hidden;}
            .wp-accent{height:3px;flex-shrink:0;transition:background .25s;}
            .wp-hd{padding:13px 13px 10px;border-bottom:1px solid ${T.border};flex-shrink:0;position:relative;}
            .wp-close{position:absolute;top:9px;right:9px;width:20px;height:20px;border-radius:4px;background:${T.border};display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;font-family:monospace;font-size:12px;color:${T.muted};line-height:1;transition:all .13s;}
            .wp-close:hover{background:${T.dim};color:${T.text};}
            .wp-badge{font-size:7.5px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:7px;display:flex;align-items:center;gap:5px;font-family:'IBM Plex Mono',monospace;}
            .wp-ttl{font-size:14px;font-weight:700;letter-spacing:.04em;line-height:1.2;margin-bottom:4px;padding-right:24px;}
            .wp-dsc{font-size:10.5px;color:${T.muted};line-height:1.5;font-family:'IBM Plex Mono',monospace;}
            .wp-pg{padding:9px 13px;border-bottom:1px solid ${T.border};flex-shrink:0;}
            .wp-pgr{display:flex;justify-content:space-between;font-size:8.5px;color:${T.muted};margin-bottom:4px;font-family:'IBM Plex Mono',monospace;}
            .wp-pgtr{height:5px;background:${T.dim};border-radius:3px;overflow:hidden;}
            .wp-pgf{height:100%;border-radius:3px;transition:width .4s;}
            .wp-bdy{flex:1;overflow-y:auto;overflow-x:hidden;padding:9px 13px 4px;}
            .wp-bdy::-webkit-scrollbar{width:3px;}
            .wp-bdy::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px;}
            .wsh{font-size:7.5px;color:${T.muted};text-transform:uppercase;letter-spacing:.11em;margin:10px 0 5px;display:flex;align-items:center;gap:4px;font-family:'IBM Plex Mono',monospace;}
            .wsh:first-child{margin-top:0;}
            .wti{display:flex;align-items:flex-start;gap:7px;padding:5px 0;border-bottom:1px solid ${T.border}40;}
            .wck{width:14px;height:14px;border-radius:3px;border:1.5px solid ${T.dim};flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .14s;}
            .wck.done{background:${T.green}18;border-color:${T.green};}
            .wtx{font-size:10.5px;color:${T.text};line-height:1.35;flex:1;}
            .wtx.dn{color:${T.muted};text-decoration:line-through;}
            .wdm{width:14px;height:14px;border-radius:2.5px;border:1.5px solid ${T.blue}40;flex-shrink:0;margin-top:1px;transform:rotate(45deg);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .14s;}
            .wdm.done{border-color:${T.blue};background:${T.blue}18;}
            .w-del{opacity:0;background:none;border:none;color:${T.muted};font-size:12px;cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0;transition:all .14s;}
            .wti:hover .w-del{opacity:1;}
            .w-del:hover{color:${T.rose};}
            .w-add-row{display:flex;gap:5px;margin-top:8px;}
            .w-add-inp{flex:1;background:${T.card};border:1px solid ${T.border};border-radius:5px;padding:5px 8px;color:${T.text};font-family:'IBM Plex Mono',monospace;font-size:10px;outline:none;}
            .w-add-inp:focus{border-color:${T.accent}60;}
            .w-add-inp::placeholder{color:${T.muted};}
            .w-add-btn{background:${T.card};border:1px solid ${T.border};border-radius:5px;padding:5px 8px;color:${T.muted};font-size:10px;cursor:pointer;font-family:'IBM Plex Mono',monospace;white-space:nowrap;transition:all .13s;}
            .w-add-btn:hover{border-color:${T.blue};color:${T.blue};}
            .wp-ai{margin:8px 12px 12px;border-radius:9px;overflow:hidden;flex-shrink:0;border:1px solid ${T.blue}25;}
            .wp-ai-h{padding:9px 12px 7px;border-bottom:1px solid ${T.border};display:flex;align-items:center;gap:8px;background:${T.blue}06;}
            .wp-ai-orb{width:28px;height:28px;border-radius:50%;border:1.5px solid ${T.blue}50;background:${T.blue}12;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${T.blue};}
            .wp-ai-lbl{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${T.blue};font-family:'IBM Plex Mono',monospace;}
            .wp-ai-sub{font-size:8.5px;color:${T.muted};margin-top:1px;font-family:'IBM Plex Mono',monospace;}
            .wp-ai-dot{width:7px;height:7px;border-radius:50%;background:${T.green};flex-shrink:0;}
            .wp-ai-b{padding:9px 12px;background:${T.card};}
            .wp-ai-msg{font-size:10.5px;color:${T.text};line-height:1.65;font-style:italic;font-family:'IBM Plex Mono',monospace;}
            .wp-ai-btns{display:flex;gap:5px;margin-top:8px;}
            .waib{flex:1;padding:6px 4px;border-radius:6px;font-size:8.5px;text-align:center;cursor:pointer;letter-spacing:.03em;text-transform:uppercase;font-family:'IBM Plex Mono',monospace;border:1px solid;transition:filter .13s;background:none;}
            .waib:hover{filter:brightness(1.1);}
            .waib:disabled{opacity:.35;cursor:not-allowed;}
            .wp-await{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:8px;opacity:.4;padding-bottom:20px;}
            .wp-await-ico{width:38px;height:38px;border-radius:10px;background:${T.border};display:flex;align-items:center;justify-content:center;}
            .wp-await-txt{font-size:9.5px;color:${T.muted};text-align:center;line-height:1.6;max-width:140px;font-family:'IBM Plex Mono',monospace;}

            /* ── Modals (unchanged) ── */
            .overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(4px);}
            .modal{background:${T.card};border:1px solid ${T.border};border-radius:14px;padding:28px;width:540px;max-width:94vw;max-height:90vh;overflow-y:auto;}
            .modal h2{font-size:17px;font-weight:800;margin-bottom:14px;color:${T.accent};letter-spacing:.06em;}
            .m-btns{display:flex;gap:8px;margin-top:8px;}
            .m-btns button{flex:1;padding:10px;border-radius:6px;font-family:'Syne',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;}
            .m-ok{background:${T.accent};border:none;color:#000;}
            .m-ok:hover{opacity:.9;}
            .m-ok:disabled{opacity:.35;cursor:not-allowed;}
            .m-cancel{background:transparent;border:1px solid ${T.border};color:${T.muted};}
            .m-cancel:hover{border-color:${T.muted};color:${T.text};}
            .smart-status{display:flex;align-items:center;gap:5px;margin-bottom:18px;padding:9px 12px;background:${T.surface};border-radius:8px;border:1px solid ${T.border};}
            .s-dot{width:26px;height:26px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;font-family:'IBM Plex Mono',monospace;transition:all .18s;flex-shrink:0;}
            .s-dot.on{background:${T.green}18;color:${T.green};border:1px solid ${T.green}45;}
            .s-dot.off{background:${T.dim};color:${T.muted};border:1px solid ${T.border};}
            .smart-field{margin-bottom:15px;}
            .smart-lbl{display:flex;align-items:center;gap:8px;margin-bottom:7px;}
            .smart-badge{width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;font-family:'IBM Plex Mono',monospace;flex-shrink:0;}
            .smart-name{font-size:12px;font-weight:700;letter-spacing:.04em;}
            .smart-hint{font-size:10px;color:${T.muted};font-family:'IBM Plex Mono',monospace;margin-left:auto;}
            .s-inp{width:100%;box-sizing:border-box;background:${T.surface};border:1px solid ${T.border};border-radius:6px;padding:8px 11px;color:${T.text};font-family:'Syne',sans-serif;font-size:12px;outline:none;transition:border-color .15s;display:block;}
            .s-inp:focus{border-color:${T.accent}60;}
            .s-inp::placeholder{color:${T.muted};font-size:11px;}
            .s-inp.ok{border-color:${T.green}35;}
            @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3);}}

            /* ── Responsive Scaling ── */
            /* Fluid typography base - zoomed in for readability */
            .sig-brand{font-size:clamp(17px, 1.55vw, 24px);}
            .sig-subt{font-size:clamp(9px, 0.77vw, 12px);}
            .secl{font-size:clamp(10px, 0.88vw, 13px);}
            .fci-input,.fci-txt,.gr-nm{font-size:clamp(13px, 1.15vw, 16px);}
            .gr-pc{font-size:clamp(12px, 1.05vw, 15px);}
            .sig-add{font-size:clamp(13px, 1.1vw, 16px);}
            .nl{font-size:clamp(9px, 0.77vw, 12px);}
            .cttl{font-size:clamp(18px, 1.55vw, 24px);}
            .cdt{font-size:clamp(12px, 1.05vw, 15px);}
            .cbtn{font-size:clamp(12px, 1.05vw, 15px);}
            .wp-ttl{font-size:clamp(18px, 1.55vw, 24px);}
            .wp-badge{font-size:clamp(10px, 0.88vw, 13px);}
            .wp-dsc{font-size:clamp(13px, 1.15vw, 16px);}
            .wtx{font-size:clamp(14px, 1.27vw, 18px);}
            .wp-ai-msg{font-size:clamp(14px, 1.27vw, 18px);}
            .wp-ai-lbl{font-size:clamp(13px, 1.1vw, 15px);}
            .wp-ai-sub{font-size:clamp(11px, 0.94vw, 13px);}
            .waib{font-size:clamp(11px, 0.94vw, 13px);}
            .w-add-inp,.w-add-btn{font-size:clamp(13px, 1.1vw, 15px);}
            .wp-pgr{font-size:clamp(11px, 0.94vw, 13px);}
            .wsh{font-size:clamp(10px, 0.88vw, 12px);}
            .wp-await-txt{font-size:clamp(13px, 1.1vw, 15px);}
            .nova-lbl{font-size:9px;}
            .nova-pct{font-size:11px;}
            .nova-status{font-size:9px;}
            .plan-lbl{font-size:9px;}
            .plan-item-title{font-size:9px;}
            .plan-item-meta{font-size:8px;}
            .plan-refresh-btn{font-size:8px;}

            /* Base sizes (1440px - 1919px) - default zoomed in */
            .sig{width:253px;}
            .sig-logo{padding:18px 16px 14px;}
            .sec{padding:14px 14px 10px;}
            .sig-add{margin:6px 14px 10px;padding:9px;}
            .nb{padding:12px 3px;}
            .ni{width:32px;height:32px;}
            .wp.open{width:345px;}
            .wpi{width:345px;}
            .wp-hd{padding:16px 16px 12px;}
            .wp-pg{padding:12px 16px;}
            .wp-bdy{padding:12px 16px 6px;}
            .wp-ai{margin:10px 14px 14px;}
            .wp-ai-h{padding:12px 14px 10px;}
            .wp-ai-b{padding:12px 14px;}
            .wp-ai-orb{width:32px;height:32px;}
            .ctb{padding:14px 18px;}
            .fci-ico{width:26px;height:26px;}
            .fci{padding:8px 10px;}
            .grl{padding:8px 10px;}
            .gr-pip{width:10px;height:10px;}
            .wck,.wdm{width:18px;height:18px;}
            .wp-close{width:24px;height:24px;font-size:14px;}

            /* Small screens (laptops, 1366px - 1439px) - slight reduction */
            @media (max-width: 1439px) {
              .sig{width:230px;}
              .wp.open{width:299px;}
              .wpi{width:299px;}
              .sig-logo{padding:16px 14px 12px;}
              .sec{padding:12px 12px 8px;}
              .sig-add{margin:5px 12px 8px;padding:8px;}
              .nb{padding:10px 2px;}
              .ni{width:28px;height:28px;}
              .wp-hd{padding:14px 14px 10px;}
              .wp-pg{padding:10px 14px;}
              .wp-bdy{padding:10px 14px 5px;}
              .wp-ai{margin:8px 12px 12px;}
              .wp-ai-h{padding:10px 12px 8px;}
              .wp-ai-b{padding:10px 12px;}
              .wp-ai-orb{width:28px;height:28px;}
              .ctb{padding:12px 16px;}
              .fci-ico{width:24px;height:24px;}
              .fci{padding:7px 8px;}
              .grl{padding:7px 8px;}
            }

            /* Extra small screens (compact laptops, < 1366px) */
            @media (max-width: 1365px) {
              .sig{width:207px;}
              .wp.open{width:276px;}
              .wpi{width:276px;}
              .sig-logo{padding:14px 12px 10px;}
              .sec{padding:10px 10px 6px;}
              .sig-add{margin:4px 10px 6px;padding:7px;}
              .nb{padding:8px 2px;}
              .ni{width:26px;height:26px;}
              .wp-hd{padding:12px 12px 9px;}
              .wp-pg{padding:9px 12px;}
              .wp-bdy{padding:9px 12px 4px;}
              .wp-ai{margin:7px 10px 10px;}
              .wp-ai-h{padding:9px 10px 7px;}
              .wp-ai-b{padding:9px 10px;}
              .wp-ai-orb{width:26px;height:26px;}
              .ctb{padding:10px 14px;}
              .fci-ico{width:22px;height:22px;}
              .fci{padding:6px 7px;}
              .grl{padding:6px 7px;}
              .gr-pip{width:9px;height:9px;}
            }

            /* Large screens (1920px - 2559px) - bigger for TV/desktop */
            @media (min-width: 1920px) {
              .sig{width:299px;}
              .wp.open{width:391px;}
              .wpi{width:391px;}
              .sig-logo{padding:22px 20px 18px;}
              .sec{padding:18px 18px 12px;}
              .sig-add{margin:8px 18px 12px;padding:11px;}
              .nb{padding:14px 4px;}
              .ni{width:38px;height:38px;}
              .wp-hd{padding:20px 20px 16px;}
              .wp-pg{padding:14px 20px;}
              .wp-bdy{padding:14px 20px 8px;}
              .wp-ai{margin:12px 18px 18px;}
              .wp-ai-h{padding:14px 18px 12px;}
              .wp-ai-b{padding:14px 18px;}
              .wp-ai-orb{width:38px;height:38px;}
              .ctb{padding:18px 24px;}
              .fci-ico{width:30px;height:30px;}
              .fci{padding:10px 12px;}
              .grl{padding:10px 12px;}
              .gr-pip{width:12px;height:12px;}
              .wck,.wdm{width:20px;height:20px;}
              .wp-close{width:28px;height:28px;font-size:16px;}
              .nova-lbl{font-size:11px;}
              .nova-pct{font-size:14px;}
              .nova-status{font-size:11px;}
              .plan-lbl{font-size:11px;}
              .plan-item-title{font-size:11px;}
              .plan-item-meta{font-size:10px;}
              .plan-refresh-btn{font-size:10px;}
            }

            /* Extra large screens (4K, >= 2560px) - very zoomed in */
            @media (min-width: 2560px) {
              .sig{width:368px;}
              .wp.open{width:460px;}
              .wpi{width:460px;}
              .sig-logo{padding:28px 24px 22px;}
              .sec{padding:22px 22px 16px;}
              .sig-add{margin:10px 22px 16px;padding:13px;}
              .nb{padding:18px 6px;}
              .ni{width:46px;height:46px;}
              .ni svg{width:20px;height:20px;}
              .wp-hd{padding:24px 24px 20px;}
              .wp-pg{padding:18px 24px;}
              .wp-bdy{padding:18px 24px 10px;}
              .wp-ai{margin:14px 22px 22px;}
              .wp-ai-h{padding:16px 22px 14px;}
              .wp-ai-b{padding:16px 22px;}
              .wp-ai-orb{width:44px;height:44px;}
              .wp-ai-orb svg{width:18px;height:18px;}
              .ctb{padding:22px 28px;}
              .fci-ico{width:36px;height:36px;}
              .fci-ico svg{width:14px;height:14px;}
              .fci{padding:12px 14px;}
              .grl{padding:12px 14px;}
              .gr-pip{width:14px;height:14px;}
              .wck,.wdm{width:22px;height:22px;}
              .wp-close{width:32px;height:32px;font-size:18px;}
              .nova-lbl{font-size:13px;}
              .nova-pct{font-size:17px;}
              .nova-status{font-size:13px;}
              .plan-lbl{font-size:13px;}
              .plan-item-title{font-size:13px;}
              .plan-item-meta{font-size:12px;}
              .plan-refresh-btn{font-size:12px;}
            }

            /* Very small viewports - absolute minimums */
            @media (max-width: 1200px) {
              .sig{width:184px;}
              .wp.open{width:253px;}
              .wpi{width:253px;}
              .sig-logo{padding:12px 10px 9px;}
              .sec{padding:8px 9px 5px;}
              .nb{padding:8px 1px;}
              .ni{width:24px;height:24px;}
              .fci-ico{width:20px;height:20px;}
              .wp-ai-orb{width:24px;height:24px;}
            }
          `}</style>

          <div className="app-shell">
            {/* ═══ SIGNAL ═══ */}
            <div className="sig">
              {/* Logo block */}
              <div className="sig-logo">
                <img src={meridianLogo} alt="MERIDIAN" style={{ width:130, display:'block' }} />
                <div className="sig-subt">Navigate Your Growth</div>
                {(() => {
                  const streak = calcStreak();
                  if (!streak) return null;
                  const color = streak >= 14 ? T.rose : streak >= 7 ? T.accent : T.green;
                  return (
                    <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ fontSize:10 }}>{streak >= 7 ? '🔥' : '✦'}</span>
                      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color, fontWeight:600 }}>
                        {streak} day streak
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Nova Confidence + Today's Plan */}
              <div className="sec nova-block">
                {(() => {
                  const confidence = computePlanningConfidence(novaState.syncEvents);
                  const confidenceColor = confidence >= 70 ? T.green : confidence >= 40 ? T.accent : T.muted;
                  const confidenceLabel = confidence >= 70 ? 'Knows you well' : confidence >= 40 ? 'Learning fast' : 'Getting started';
                  const plan = novaState.dailyPlan;
                  const today = new Date().toISOString().slice(0, 10);
                  const planItems = (plan?.date === today && plan?.items) ? plan.items : [];
                  const insightsOpen = waypointOpen && waypointContext?.type === 'nova-insights';
                  const planError = novaState.planError;
                  const fmtTime = (mins) => {
                    const h = Math.floor(mins / 60);
                    const m = mins % 60;
                    const ap = h >= 12 ? 'PM' : 'AM';
                    return `${h % 12 || 12}:${m.toString().padStart(2, '0')}${ap}`;
                  };
                  return (
                    <div
                      style={{ borderRadius:7, border:`1px solid ${insightsOpen ? T.accent : T.border}`, background:T.card, overflow:'hidden', cursor:'pointer', transition:'border-color .2s' }}
                      onClick={() => insightsOpen ? closeWaypoint() : openWaypoint({ type:'nova-insights' })}
                    >
                      {/* Confidence header */}
                      <div style={{ padding:'8px 10px 6px' }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                          <div className="nova-lbl" style={{ fontFamily:"'IBM Plex Mono',monospace", color:T.muted, letterSpacing:'.08em' }}>NOVA CONFIDENCE</div>
                          <div className="nova-pct" style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:confidenceColor }}>{confidence}%</div>
                        </div>
                        <div style={{ height:3, borderRadius:2, background:T.border, overflow:'hidden', marginBottom:4 }}>
                          <div style={{ height:'100%', width:`${confidence}%`, background:confidenceColor, borderRadius:2, transition:'width .5s ease' }} />
                        </div>
                        <div className="nova-status" style={{ fontFamily:"'IBM Plex Mono',monospace", color:confidenceColor, opacity:.8 }}>{confidenceLabel}</div>
                      </div>
                      {/* Divider */}
                      <div style={{ height:1, background:T.border }} />
                      {/* Daily plan header */}
                      <div style={{ padding:'6px 10px 4px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div className="plan-lbl" style={{ fontFamily:"'IBM Plex Mono',monospace", color:T.muted, letterSpacing:'.08em' }}>TODAY'S PLAN</div>
                        <button
                          onClick={e => { e.stopPropagation(); generateNovaPlan(prioritizeInput); }}
                          disabled={novaState.planGenLoading || !apiKey}
                          className="plan-refresh-btn"
                          style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:4, color: novaState.planGenLoading ? T.muted : T.accent, cursor: novaState.planGenLoading || !apiKey ? 'default' : 'pointer', padding:'2px 5px', fontFamily:"'IBM Plex Mono',monospace", letterSpacing:'.05em', opacity: novaState.planGenLoading ? .5 : 1 }}
                        >{novaState.planGenLoading ? '···' : 'REFRESH'}</button>
                      </div>
                      {/* Prioritization input */}
                      <div style={{ padding:'0 10px 6px' }} onClick={e => e.stopPropagation()}>
                        <input
                          value={prioritizeInput}
                          onChange={e => setPrioritizeInput(e.target.value)}
                          placeholder="What should I prioritize today?"
                          style={{ width:'100%', boxSizing:'border-box', background:T.bg, border:`1px solid ${T.border}`, borderRadius:4, padding:'5px 7px', color:T.text, fontFamily:"'IBM Plex Mono',monospace", fontSize:9, outline:'none' }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && prioritizeInput.trim()) {
                              e.stopPropagation();
                              generateNovaPlan(prioritizeInput);
                            }
                          }}
                        />
                      </div>
                      {/* Plan error message */}
                      {planError && (
                        <div style={{ padding:'6px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.rose, lineHeight:1.6, borderTop:`1px solid ${T.border}` }}>
                          {planError}
                        </div>
                      )}
                      {/* Plan items */}
                      {novaState.planGenLoading && planItems.length === 0 ? (
                        <div style={{ padding:'8px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, textAlign:'center' }}>Building plan…</div>
                      ) : planItems.length === 0 && !planError ? (
                        <div style={{ padding:'8px 10px', fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, lineHeight:1.6 }}>
                          {apiKey ? 'No plan yet — complete a Briefing or tap Refresh.' : 'Add an API key to generate plans.'}
                        </div>
                      ) : planItems.length > 0 ? (
                        <div style={{ maxHeight:160, overflowY:'auto', padding:'2px 0 6px' }}>
                          {planItems.map((item, idx) => {
                            const dotColor = item.complexity === 'high' ? T.rose : item.complexity === 'medium' ? T.accent : T.muted;
                            return (
                              <div key={item.id} style={{ padding:'5px 10px', display:'flex', alignItems:'flex-start', gap:6, borderBottom: idx < planItems.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                                <div style={{ width:4, height:4, borderRadius:'50%', background:dotColor, marginTop:4, flexShrink:0 }} />
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div className="plan-item-title" style={{ fontFamily:"'IBM Plex Mono',monospace", color:T.text, lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</div>
                                  <div className="plan-item-meta" style={{ fontFamily:"'IBM Plex Mono',monospace", color:T.muted, marginTop:1 }}>
                                    {item.startMinutes !== undefined ? `${fmtTime(item.startMinutes)}` : ''} ~{item.estimatedMinutes}m{item.goalTitle ? ` · ${item.goalTitle.slice(0,18)}${item.goalTitle.length > 18 ? '…' : ''}` : ''}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>

              {/* Programs */}
              <div className="sec" style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', gap:6 }}>
                <div className="secl">
                  <span className="pip" style={{ background: T.accent }} />
                  PROGRAMS
                </div>
                {[
                  {
                    id: 'briefing',
                    label: 'Briefing',
                    desc: 'Full debrief to start your day',
                    color: '#F59E0B',
                    icon: (
                      <svg width="13" height="13" viewBox="0 0 13 13">
                        <circle cx="6.5" cy="6.5" r="5" fill="none" stroke="#F59E0B" strokeWidth="1.4"/>
                        <path d="M6.5 4v3l2 1" fill="none" stroke="#F59E0B" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                    ),
                  },
                  {
                    id: 'focus',
                    label: 'Focus',
                    desc: 'Quick sprint, get locked in',
                    color: T.blue,
                    icon: (
                      <svg width="13" height="13" viewBox="0 0 13 13">
                        <path d="M6.5 1.5 L11.5 6.5 L6.5 11.5 L1.5 6.5 Z" fill="none" stroke={T.blue} strokeWidth="1.4"/>
                        <circle cx="6.5" cy="6.5" r="2" fill={T.blue}/>
                      </svg>
                    ),
                  },
                  {
                    id: 'regroup',
                    label: 'Re-group',
                    desc: 'Reset and recalibrate',
                    color: T.purple,
                    icon: (
                      <svg width="13" height="13" viewBox="0 0 13 13">
                        <path d="M2 6.5 A4.5 4.5 0 0 1 10 3.5" fill="none" stroke={T.purple} strokeWidth="1.4" strokeLinecap="round"/>
                        <path d="M11 6.5 A4.5 4.5 0 0 1 3 9.5" fill="none" stroke={T.purple} strokeWidth="1.4" strokeLinecap="round"/>
                        <polygon points="10,1.5 12,4 8,4" fill={T.purple}/>
                        <polygon points="3,8.5 1,11 5,11" fill={T.purple}/>
                      </svg>
                    ),
                  },
                  {
                    id: 'preview',
                    label: 'Preview',
                    desc: 'Plan the next day',
                    color: T.cyan,
                    icon: (
                      <svg width="13" height="13" viewBox="0 0 13 13">
                        <path d="M6.5 1.5 L11.5 6.5 L6.5 11.5 L1.5 6.5 Z" fill="none" stroke={T.cyan} strokeWidth="1.4"/>
                        <circle cx="6.5" cy="6.5" r="1.5" fill={T.cyan}/>
                        <path d="M6.5 4v3l2 1" fill="none" stroke={T.cyan} strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                    ),
                  },
                ].map(prog => {
                  const isActive = waypointOpen && waypointContext?.type === 'program' && waypointContext?.id === prog.id;
                  return (
                    <div
                      key={prog.id}
                      onClick={() => {
                        if (isActive) { closeWaypoint(); }
                        else {
                          openWaypoint({ type: 'program', id: prog.id });
                          addSyncEvent('program_opened', prog.id);
                        }
                      }}
                      style={{
                        display:'flex', alignItems:'center', gap:9, padding:'8px 10px',
                        borderRadius:7, cursor:'pointer', userSelect:'none',
                        background: isActive ? `${prog.color}18` : 'transparent',
                        border: `1px solid ${isActive ? prog.color + '55' : T.border}`,
                        transition:'all .15s',
                      }}
                    >
                      <div style={{ width:28, height:28, borderRadius:6, background:`${prog.color}18`, border:`1px solid ${prog.color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {prog.icon}
                      </div>
                      <div style={{ flex:1, overflow:'hidden' }}>
                        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, color: isActive ? prog.color : T.text, letterSpacing:'.03em' }}>{prog.label}</div>
                        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{prog.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom nav */}
              <div className="sig-nav">
                {[
                  { page:'hq', label:'HQ', icon: (
                    <svg width="16" height="16" viewBox="0 0 16 16">
                      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" fill={T.accent}/>
                      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" fill={T.accent} opacity=".55"/>
                      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" fill={T.accent} opacity=".55"/>
                      <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" fill={T.accent} opacity=".35"/>
                    </svg>
                  )},
                  { page:'tracking', label:'Track', icon: (
                    <svg width="16" height="16" viewBox="0 0 16 16">
                      <path d="M2 12 L5.5 7 L9 10 L14 4" fill="none" stroke={T.blue} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="14" cy="4" r="1.8" fill={T.blue}/>
                    </svg>
                  )},
                  { page:'settings', label:'Settings', icon: (
                    <svg width="16" height="16" viewBox="0 0 16 16">
                      <circle cx="8" cy="8" r="5.5" fill="none" stroke={T.purple} strokeWidth="1.6"/>
                      <circle cx="8" cy="8" r="2" fill={T.purple}/>
                      <path d="M8 2.5v1M8 12.5v1M2.5 8h1M12.5 8h1" stroke={T.purple} strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                  )},
                  { page:'mindcheck', label:'Mind', icon: (
                    <svg width="16" height="16" viewBox="0 0 16 16">
                      <path d="M8 13C8 13 2.5 9.2 2.5 5.8a3.5 3.5 0 016.5-1.8 3.5 3.5 0 016.5 1.8C15.5 9.2 8 13 8 13z" fill="none" stroke={T.green} strokeWidth="1.6"/>
                      <path d="M5.5 6.5l1.8 1.8L10 5.5" fill="none" stroke={T.green} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )},
                ].map(({ page, label, icon }) => (
                  <button
                    key={page}
                    className={`nb${mainPage === page ? ' on' : ''}`}
                    onClick={() => { setMainPage(page); closeWaypoint(); }}
                  >
                    <div className="ni">{icon}</div>
                    <div className="nl">{label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* ═══ COMMAND ═══ */}
            <div className="cmd">
              {/* Top bar */}
              <div className="ctb">
                <div>
                  <div className="cttl">
                    {mainPage === 'hq' ? (activePage === 'onward' ? 'ONWARD' : activePage === 'map' ? 'MAP' : activePage === 'paths' ? 'PATHS' : activePage === 'skills' ? 'SKILLS' : activePage === 'worklogs' ? 'WORK LOGS' : 'CONSTELLATION') : mainPage === 'tracking' ? 'TRACKING' : mainPage === 'settings' ? 'SETTINGS' : mainPage === 'knowledge-pool' ? 'KNOWLEDGE POOL' : 'MIND CHECK'}
                  </div>
                  <div className="cdt">
                    {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })} · {mainPage === 'knowledge-pool' ? 'KNOWLEDGE POOL' : mainPage.toUpperCase()}
                  </div>
                </div>
                {mainPage === 'hq' && activePage === 'constellation' && (
                  <button className="cbtn" onClick={() => setModal(true)}>+ New Goal</button>
                )}
              </div>

              {/* Compass sub-nav (HQ only, sits just under the top bar) */}
              {mainPage === 'hq' && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderBottom:`1px solid ${T.border}`, background:T.bg, flexShrink:0 }}>
                  {[
                    { page:'constellation', label:'✦ Solar System' },
                    { page:'onward',        label:'ONWARD' },
                    { page:'map',           label:'MAP' },
                    { page:'paths',         label:'PATHS' },
                    { page:'skills',        label:'SKILLS' },
                    { page:'worklogs',      label:'WORK LOGS' },
                  ].map(({ page, label }) => (
                    <button
                      key={page}
                      onClick={() => {
                        setActivePage(page);
                        activePageRef.current = page;
                        if (page !== 'constellation' && page !== 'worklogs') openWaypoint({ type: 'canvas-panel', id: page });
                        else closeWaypoint();
                      }}
                      style={{
                        background: activePage === page ? `${T.accent}15` : 'transparent',
                        border: `1px solid ${activePage === page ? T.accent + '50' : 'transparent'}`,
                        borderRadius: 5,
                        padding: '3px 9px',
                        fontFamily: "'IBM Plex Mono',monospace",
                        fontSize: 9,
                        fontWeight: 700,
                        color: activePage === page ? T.accent : T.muted,
                        cursor: 'pointer',
                        letterSpacing: '.08em',
                        transition: 'all .14s',
                      }}
                    >{label}</button>
                  ))}
                </div>
              )}

              {/* Body */}
              <div className="cbody">
                {mainPage === 'hq' && (
                  <div className="cv" style={{ cursor: activePage === 'constellation' ? (dragging ? 'grabbing' : 'grab') : activePage === 'onward' ? 'default' : 'pointer', position: 'relative', overflow: activePage === 'onward' ? 'auto' : 'hidden', width: (activePage === 'onward' && waypointOpen) ? 'calc(100% - 244px)' : '100%', transition: 'width 0.4s cubic-bezier(.4,0,.2,1)', scrollbarWidth: 'thin', scrollbarColor: `${T.border} ${T.bg}` }}>
                    <canvas
                      ref={canvasRef}
                      style={{ position:'absolute', top:0, left:0 }}
                      onMouseDown={onCanvasMouseDown}
                      onMouseMove={onCanvasMouseMove}
                      onMouseUp={onCanvasMouseUp}
                      onMouseLeave={onCanvasMouseUp}
                      onDragOver={onCanvasDragOver}
                      onDragLeave={onCanvasDragLeave}
                      onDrop={onCanvasDrop}
                    />
                    {activePage === 'skills' && (
                      <div style={{ position: 'absolute', inset: 0, background: '#07090f', overflowY: 'auto', zIndex: 10 }}>
                        <SkillsView skills={xpSkills} goals={projects} streakDays={streakDays} onUpdateSkillMeta={handleUpdateSkillMeta} />
                      </div>
                    )}
                    {activePage === 'paths' && (
                      <div style={{ position: 'absolute', inset: 0, background: '#07090f', overflowY: 'auto', zIndex: 10 }}>
                        <PathsView />
                      </div>
                    )}
                    {activePage === 'worklogs' && (
                      <div style={{ position: 'absolute', inset: 0, background: '#07090f', overflowY: 'auto', zIndex: 10 }}>
                        <WorkLogsView />
                      </div>
                    )}
                  </div>
                )}
                {mainPage === 'tracking' && (
                  <TrackingPage
                    projects={projects}
                    onwardItems={onwardItems}
                    sessions={sessions}
                    activeSession={activeSession}
                    trackingPeriod={trackingPeriod}
                    setTrackingPeriod={setTrackingPeriod}
                    startSession={startSession}
                    stopSession={stopSession}
                    sessionDurationMin={sessionDurationMin}
                    getTodayStats={getTodayStats}
                    getSessionsForDay={getSessionsForDay}
                    getSessionsForWeek={getSessionsForWeek}
                    getSessionsForMonth={getSessionsForMonth}
                    todayStr={todayStr}
                    apiKey={apiKey}
                    geminiInput={geminiInput}
                    setGeminiInput={setGeminiInput}
                    geminiResponse={geminiResponse}
                    setGeminiResponse={setGeminiResponse}
                    geminiLoading={geminiLoading}
                    setGeminiLoading={setGeminiLoading}
                    focus={focus}
                    knowledgePool={knowledgePool}
                    pomodoroPreselect={pomodoroPreselect}
                    onClearPomodoroPreselect={() => setPomodoroPreselect(null)}
                  />
                )}
                {mainPage === 'settings' && (
                  <SettingsPage
                    apiKey={apiKey}
                    setApiKey={setApiKey}
                    intensity={intensity}
                    setIntensity={setIntensity}
                    showApiKey={showApiKey}
                    setShowApiKey={setShowApiKey}
                    companionName={companionName}
                    setCompanionName={setCompanionName}
                    setMainPage={setMainPage}
                  />
                )}
                {mainPage === 'knowledge-pool' && (
                  <KnowledgePoolPage
                    knowledgePool={knowledgePool}
                    onAdd={addKnowledgeEntry}
                    onDelete={deleteKnowledgeEntry}
                    onEdit={editKnowledgeEntry}
                    onUpdateCorrections={updateCorrections}
                    setMainPage={setMainPage}
                  />
                )}
                {mainPage === 'mindcheck' && (
                  <MindCheckPage routines={routines} setRoutines={setRoutines} />
                )}
              </div>
            </div>

            {/* ═══ WAYPOINT ═══ */}
            <div className={`wp${waypointOpen ? ' open' : ''}`}>
              <div className="wpi">
                {waypointContext?.type === 'goal' && (() => {
                  const proj = projects.find(p => p.id === waypointContext.id);
                  if (!proj) return null;
                  const pct = progress(proj);
                  return (
                    <>
                      <div className="wp-accent" style={{ background: proj.color }} />
                      <div className="wp-hd">
                        <button className="wp-close" onClick={closeWaypoint}>×</button>
                        <div className="wp-badge">
                          <span style={{ width:5, height:5, borderRadius:'50%', background:proj.color, display:'inline-block' }} />
                          <span style={{ color: proj.color }}>Goal</span>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          {renamingGoalId === proj.id ? (
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onBlur={() => { renameGoal(proj.id, renameValue); setRenamingGoalId(null); }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { renameGoal(proj.id, renameValue); setRenamingGoalId(null); }
                                if (e.key === 'Escape') setRenamingGoalId(null);
                              }}
                              style={{ flex:1, background:'transparent', border:'none', borderBottom:`1px solid ${proj.color}`, color:proj.color, fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, outline:'none', padding:'2px 0', width:'100%' }}
                            />
                          ) : (
                            <div className="wp-ttl" style={{ color: proj.color, flex:1 }}>{proj.title}</div>
                          )}
                          <button
                            title="Rename goal"
                            onClick={() => { setRenamingGoalId(proj.id); setRenameValue(proj.title); }}
                            style={{ background:'none', border:'none', color:T.muted, cursor:'pointer', fontSize:12, padding:'2px 4px', flexShrink:0, lineHeight:1 }}
                          >✎</button>
                          <button
                            title="Delete goal"
                            onClick={() => setConfirmDelete(proj.id)}
                            style={{ background:'none', border:'none', color:T.rose, cursor:'pointer', fontSize:14, padding:'2px 4px', flexShrink:0, lineHeight:1, opacity:.7 }}
                          >🗑</button>
                        </div>
                        {proj.desc && <div className="wp-dsc">{proj.desc}</div>}
                      </div>
                      <div className="wp-pg">
                        <div className="wp-pgr">
                          <span>Progress</span>
                          <span style={{ fontSize:12, fontWeight:700, color: proj.color }}>{pct}%</span>
                        </div>
                        <div className="wp-pgtr">
                          <div className="wp-pgf" style={{ width:`${pct}%`, background: proj.color }} />
                        </div>
                      </div>
                      <div className="wp-bdy">
                        {proj.subtasks.length > 0 && (
                          <>
                            <div className="wsh">
                              <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="1.5" fill="none" stroke={T.muted} strokeWidth="1.2"/><path d="M3 5l1.5 1.5 3-3" fill="none" stroke={T.muted} strokeWidth="1.2" strokeLinecap="round"/></svg>
                              Subtasks
                            </div>
                            {proj.subtasks.map(st => (
                              <div key={st.id} className="wti">
                                <div className={`wck${st.done ? ' done' : ''}`} onClick={() => toggleSubtask(proj.id, st.id)}>
                                  {st.done && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" fill="none" stroke={T.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                </div>
                                <div className={`wtx${st.done ? ' dn' : ''}`}>{st.title}</div>
                                <button className="w-del" onClick={() => deleteSubtask(proj.id, st.id)}>×</button>
                              </div>
                            ))}
                          </>
                        )}
                        {proj.checkpoints.length > 0 && (
                          <>
                            <div className="wsh" style={{ marginTop: proj.subtasks.length ? 10 : 0 }}>
                              <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="none" stroke={T.blue} strokeWidth="1.2" transform="rotate(45 5 5)"/></svg>
                              <span style={{ color: T.blue }}>Checkpoints</span>
                            </div>
                            {proj.checkpoints.map(cp => (
                              <div key={cp.id} className="wti">
                                <div className={`wdm${cp.done ? ' done' : ''}`} onClick={() => toggleCheckpoint(proj.id, cp.id)}>
                                  {cp.done && <svg width="7" height="7" viewBox="0 0 7 7" style={{ transform:'rotate(-45deg)' }}><path d="M1 3.5l1.8 1.8 3.5-3.5" fill="none" stroke={T.blue} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                </div>
                                <div className="wtx">{cp.title}</div>
                                <button className="w-del" onClick={() => deleteCheckpoint(proj.id, cp.id)}>×</button>
                              </div>
                            ))}
                          </>
                        )}
                        <div className="w-add-row">
                          <input
                            className="w-add-inp"
                            placeholder="Add subtask or checkpoint..."
                            value={addInput}
                            onChange={e => setAddInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addSubtask()}
                          />
                        </div>
                        <div style={{ display:'flex', gap:5, marginTop:5 }}>
                          <button className="w-add-btn" onClick={addSubtask} disabled={!addInput.trim()}>+ Task</button>
                          <button className="w-add-btn" onClick={addCheckpoint} disabled={!addInput.trim()}>◆ CP</button>
                        </div>
                        {pct === 100 && !proj.completedAt && (
                          <button
                            onClick={() => completeGoal(proj.id)}
                            style={{ marginTop:10, width:'100%', background:`${T.green}12`, border:`1px solid ${T.green}40`, borderRadius:6, padding:'7px', color:T.green, fontFamily:"'Syne',sans-serif", fontSize:10, fontWeight:700, cursor:'pointer', letterSpacing:'.05em' }}
                          >✓ Mark Complete</button>
                        )}
                        {sunId !== proj.id && (
                          <button
                            onClick={() => setSunId(proj.id)}
                            style={{ marginTop:10, width:'100%', background:`${T.accent}12`, border:`1px solid ${T.accent}35`, borderRadius:6, padding:'7px', color:T.accent, fontFamily:"'Syne',sans-serif", fontSize:10, fontWeight:700, cursor:'pointer', letterSpacing:'.05em' }}
                          >☀ Make Focus Sun</button>
                        )}
                        {sunId === proj.id && (
                          <div style={{ marginTop:10, textAlign:'center', fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.accent, opacity:.7 }}>★ This is the Focus Sun</div>
                        )}
                      </div>
                      <div className="wp-ai">
                        <div className="wp-ai-h">
                          <div className="wp-ai-orb">
                            <svg width="13" height="13" viewBox="0 0 13 13"><polygon points="6.5,1 8,5 12.5,5.2 9.2,8 10.3,12.5 6.5,9.8 2.7,12.5 3.8,8 0.5,5.2 5,5" fill="currentColor"/></svg>
                          </div>
                          <div>
                            <div className="wp-ai-lbl">{companionName}</div>
                            <div className="wp-ai-sub">Contextual reflection</div>
                          </div>
                          <div className="wp-ai-dot" />
                        </div>
                        <div className="wp-ai-b">
                          <div className="wp-ai-msg">
                            {companionLoading ? 'thinking...' : (aiMsg || 'Ask for a check-in or subtask suggestion.')}
                          </div>
                          <div className="wp-ai-btns">
                            <button
                              className="waib"
                              style={{ color: proj.color, borderColor:`${proj.color}40`, background:`${proj.color}10` }}
                              onClick={checkIn}
                              disabled={companionLoading}
                            >✦ Check In</button>
                            <button
                              className="waib"
                              style={{ color: T.purple, borderColor:`${T.purple}40`, background:`${T.purple}10` }}
                              onClick={suggestSubtask}
                              disabled={companionLoading}
                            >+ Suggest</button>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {waypointContext?.type === 'program' && (
                  <NOVAProgramPanel
                    progId={waypointContext.id}
                    novaState={novaState}
                    setNovaState={setNovaState}
                    novaChatInput={novaChatInput}
                    setNovaChatInput={setNovaChatInput}
                    novaLoading={novaLoading}
                    sendNOVAMessage={sendNOVAMessage}
                    addSyncEvent={addSyncEvent}
                    setOnwardItems={setOnwardItems}
                    uid={uid}
                    closeWaypoint={closeWaypoint}
                    T={T}
                    onNewSession={onNewSession}
                    buildNOVASystemPrompt={buildNOVASystemPrompt}
                    // New props for Briefing/Focus/Re-group enhancement
                    onwardItems={onwardItems}
                    projects={projects}
                    selectedForToday={selectedForToday}
                    setSelectedForToday={setSelectedForToday}
                    deferredItems={deferredItems}
                    setDeferredItems={setDeferredItems}
                    backlogItems={backlogItems}
                    setBacklogItems={setBacklogItems}
                    onBreakdownTask={handleBreakdownTask}
                    sessions={sessions}
                    brainDumpEntries={brainDumpEntries}
                    onBrainDump={handleBrainDump}
                    journalEntries={journalEntries}
                    onJournalEntry={handleJournalEntry}
                    onBreakdownSuggestion={handleBreakdownSuggestion}
                    novaRetry={novaRetry}
                  />
                )}

                {waypointContext?.type === 'canvas-panel' && (() => {
                  const panelId = waypointContext.id;
                  return (
                    <>
                      <div className="wp-accent" style={{ background: T.accent }} />
                      <div className="wp-hd">
                        <button className="wp-close" onClick={closeWaypoint}>×</button>
                        <div className="wp-badge"><span style={{ color:T.muted }}>Canvas</span></div>
                        <div className="wp-ttl" style={{ color:T.accent }}>{panelId.toUpperCase()}</div>
                      </div>
                      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
                        {panelId === 'onward' && (
                          <OnwardPanel
                            onwardItems={onwardItems}
                            onwardForm={onwardForm}
                            setOnwardForm={setOnwardForm}
                            projects={projects}
                            onAdd={addOnwardItem}
                            onDelete={deleteOnwardItem}
                            onToggleDone={toggleOnwardDone}
                            selectedId={selectedId}
                            onSelectGoal={id => { setSelectedId(id); openWaypoint({ type:'goal', id }); }}
                            onToggleFocus={toggleFocus}
                            onConfirmDelete={setConfirmDelete}
                            availableTasks={availableTasks}
                            onDragStart={task => setDraggedTask(task)}
                            onMoveItem={moveOnwardItem}
                            onStartFocus={handleStartFocus}
                            onReturnToAvailable={returnOnwardItemToAvailable}
                            backlogItems={backlogItems}
                            deferredItems={deferredItems}
                            selectedForToday={selectedForToday}
                            onRestoreFromBacklog={handleRestoreFromBacklog}
                          />
                        )}
                        {panelId === 'map' && (
                          <MapPanel
                            hoveredWeek={hoveredWeek}
                            projects={projects}
                            weeklyInsights={novaState.weeklyInsights}
                            onWeeklyCheckin={scanWeeklyGoals}
                            companionLoading={novaState.weeklyInsights?.loading || false}
                          />
                        )}
                        {panelId === 'skills' && (
                          <SkillsPanel
                            skills={skills}
                            selectedSkillId={selectedSkillId}
                            onUpdateLevel={updateSkillLevel}
                            onAddSubskill={addSubskill}
                          />
                        )}
                      </div>
                    </>
                  );
                })()}

                {waypointContext?.type === 'nova-insights' && (() => {
                  const confidence = computePlanningConfidence(novaState.syncEvents);
                  const confidenceColor = confidence >= 70 ? T.green : confidence >= 40 ? T.accent : T.muted;
                  const evts = novaState.syncEvents;
                  const accepted  = evts.filter(e => e.type === 'task_accepted').length;
                  const rejected  = evts.filter(e => e.type === 'task_rejected').length;
                  const completed = evts.filter(e => e.type === 'task_completed').length;
                  const total = accepted + rejected;
                  const acceptPct   = total > 0 ? Math.round(accepted / total * 100) : 50;
                  const completePct = accepted > 0 ? Math.round(Math.min(completed / accepted, 1) * 100) : 0;
                  const meaningfulEvts = evts.filter(e => ["task_accepted","task_rejected","task_completed","briefing_done"].includes(e.type));
                  const richPct     = Math.round(Math.min(meaningfulEvts.length / 40, 1) * 100);
                  const streak      = calcStreak();
                  const weekly      = getWeeklyData();
                  const avgPerDay   = weekly.length ? (weekly.reduce((s, d) => s + d.count, 0) / weekly.length).toFixed(1) : '0';
                  const weekMax     = Math.max(...weekly.map(d => d.count), 1);
                  const plan = novaState.dailyPlan;
                  const today = new Date().toISOString().slice(0, 10);
                  const planItems = (plan?.date === today && plan?.items) ? plan.items : [];
                  const recentEvents = [...evts].reverse().slice(0, 12);
                  const relTime = (ts) => {
                    const diff = Date.now() - new Date(ts).getTime();
                    if (diff < 60000) return 'just now';
                    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
                    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
                    return `${Math.floor(diff/86400000)}d ago`;
                  };
                  const evtLabel = { task_accepted:'Accepted', task_rejected:'Rejected', task_completed:'Completed', briefing_done:'Briefing', program_opened:'Opened' };
                  const evtColor = { task_accepted: T.green, task_rejected: T.rose, task_completed: T.accent, briefing_done: T.blue, program_opened: T.muted };
                  return (
                    <>
                      <div className="wp-accent" style={{ background: T.accent }} />
                      <div className="wp-hd">
                        <button className="wp-close" onClick={closeWaypoint}>×</button>
                        <div className="wp-badge"><span style={{ color:T.muted }}>Nova</span></div>
                        <div className="wp-ttl" style={{ color:T.accent }}>PRODUCTIVITY INSIGHTS</div>
                      </div>
                      <div style={{ flex:1, overflowY:'auto', padding:'16px 18px', display:'flex', flexDirection:'column', gap:18 }}>

                        {/* Confidence breakdown */}
                        <div>
                          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.1em', marginBottom:10 }}>PLANNING CONFIDENCE</div>
                          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:32, fontWeight:800, color:confidenceColor, lineHeight:1 }}>{confidence}%</div>
                            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:confidenceColor }}>{confidence >= 70 ? 'Nova knows you well' : confidence >= 40 ? 'Nova is learning fast' : 'Nova is getting started'}</div>
                          </div>
                          {[
                            { label:'Suggestion accuracy', pct: acceptPct, detail:`${accepted} accepted / ${rejected} rejected` },
                            { label:'Plan completion',     pct: completePct, detail:`${completed} of ${accepted} accepted tasks done` },
                            { label:'Data richness',       pct: richPct, detail:`${meaningfulEvts.length} meaningful / ${evts.length} total events` },
                          ].map(row => (
                            <div key={row.label} style={{ marginBottom:8 }}>
                              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.text }}>{row.label}</div>
                                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted }}>{row.detail}</div>
                              </div>
                              <div style={{ height:3, borderRadius:2, background:T.border, overflow:'hidden' }}>
                                <div style={{ height:'100%', width:`${row.pct}%`, background: row.pct >= 70 ? T.green : row.pct >= 40 ? T.accent : T.muted, borderRadius:2 }} />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Work pattern */}
                        <div>
                          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.1em', marginBottom:8 }}>WORK PATTERN</div>
                          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color: novaState.routine ? T.text : T.muted, lineHeight:1.7, background:T.bg, padding:'10px 12px', borderRadius:6, border:`1px solid ${T.border}` }}>
                            {novaState.routine?.summary || 'No pattern learned yet — complete a Briefing to begin.'}
                          </div>
                        </div>

                        {/* Performance */}
                        <div>
                          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.1em', marginBottom:10 }}>PERFORMANCE</div>
                          <div style={{ display:'flex', gap:12, marginBottom:12 }}>
                            {[
                              { label:'Day Streak', value: streak, unit:'days' },
                              { label:'Daily Avg',  value: avgPerDay, unit:'tasks/day' },
                            ].map(stat => (
                              <div key={stat.label} style={{ flex:1, background:T.bg, border:`1px solid ${T.border}`, borderRadius:6, padding:'8px 10px' }}>
                                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:T.accent }}>{stat.value}</div>
                                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted, marginTop:2 }}>{stat.unit}</div>
                                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted }}>{stat.label}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:40 }}>
                            {weekly.map(d => (
                              <div key={d.day} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                                <div style={{ width:'100%', height: d.count > 0 ? `${Math.round(d.count / weekMax * 32)}px` : '2px', background: d.isToday ? T.accent : d.count > 0 ? `${T.accent}60` : T.border, borderRadius:2, transition:'height .3s' }} />
                                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:7, color: d.isToday ? T.accent : T.muted }}>{d.day}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Today's plan */}
                        {planItems.length > 0 && (
                          <div>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.1em' }}>TODAY'S PLAN</div>
                              <button onClick={e => { e.stopPropagation(); generateNovaPlan(); }} disabled={novaState.planGenLoading || !apiKey} style={{ background:'none', border:`1px solid ${T.border}`, borderRadius:4, color: novaState.planGenLoading ? T.muted : T.accent, cursor: novaState.planGenLoading || !apiKey ? 'default' : 'pointer', fontSize:8, padding:'2px 6px', fontFamily:"'IBM Plex Mono',monospace", opacity: novaState.planGenLoading ? .5 : 1 }}>{novaState.planGenLoading ? '···' : 'REFRESH'}</button>
                            </div>
                            {planItems.map((item, idx) => {
                              const dotColor = item.complexity === 'high' ? T.rose : item.complexity === 'medium' ? T.accent : T.muted;
                              return (
                                <div key={item.id} style={{ padding:'8px 10px', marginBottom:6, background:T.bg, border:`1px solid ${T.border}`, borderLeft:`3px solid ${dotColor}`, borderRadius:4 }}>
                                  <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:T.text, marginBottom:3 }}>{item.title}</div>
                                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted }}>~{item.estimatedMinutes}m</span>
                                    {item.goalTitle && <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted }}>· {item.goalTitle}</span>}
                                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, padding:'1px 5px', borderRadius:3, background:`${dotColor}20`, color:dotColor, textTransform:'uppercase' }}>{item.complexity}</span>
                                  </div>
                                  {item.rationale && <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted, marginTop:4, lineHeight:1.5, opacity:.8 }}>{item.rationale}</div>}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Recent activity */}
                        {recentEvents.length > 0 && (
                          <div>
                            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, letterSpacing:'.1em', marginBottom:8 }}>RECENT ACTIVITY</div>
                            {recentEvents.map((ev, i) => (
                              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom: i < recentEvents.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, padding:'2px 5px', borderRadius:3, background:`${evtColor[ev.type] || T.muted}20`, color: evtColor[ev.type] || T.muted, textTransform:'uppercase', flexShrink:0 }}>{evtLabel[ev.type] || ev.type}</span>
                                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.text, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.detail}</span>
                                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:8, color:T.muted, flexShrink:0 }}>{relTime(ev.ts)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                      </div>
                    </>
                  );
                })()}

                {!waypointContext && (
                  <div className="wp-await">
                    <div className="wp-await-ico">
                      <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="none" stroke={T.muted} strokeWidth="1.5"/><path d="M9 6v3l2 1" fill="none" stroke={T.muted} strokeWidth="1.4" strokeLinecap="round"/></svg>
                    </div>
                    <div className="wp-await-txt">Select a goal or focus area to view details.</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── New Goal Modal ── */}
          {modal && (
            <GoalModal
              apiKey={apiKey}
              onClose={() => { setModal(false); setForm({ title:'', desc:'', measurable:'', achievable:'', relevant:'', deadline:'', priority:'low', scale:'short' }); }}
              onCreate={createGoalFromModal}
            />
          )}

          {/* ── Legacy SMART Modal (kept for reference, hidden) ── */}
          {false && modal && (
            <div className="overlay" onClick={(e) => { if (e.target.className === "overlay") setModal(false); }}>
              <div className="modal">
                <h2>NEW GOAL</h2>
                <div className="smart-status">
                  {[
                    { l:'S', ok: form.title.trim().length > 0 },
                    { l:'M', ok: form.measurable.trim().length > 0 },
                    { l:'A', ok: form.achievable.trim().length > 0 },
                    { l:'R', ok: form.relevant.trim().length > 0 },
                    { l:'T', ok: form.deadline.length > 0 },
                  ].map(({ l, ok }) => (
                    <div key={l} className={`s-dot ${ok ? 'on' : 'off'}`}>{ok ? '✓' : l}</div>
                  ))}
                  <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:T.muted, marginLeft:'auto' }}>all 5 required</span>
                </div>
                <div className="smart-field">
                  <div className="smart-lbl">
                    <div className="smart-badge" style={{ background:`${T.accent}20`, color:T.accent }}>S</div>
                    <span className="smart-name" style={{ color:T.accent }}>Specific</span>
                    <span className="smart-hint">What exactly are you working toward?</span>
                  </div>
                  <input className={`s-inp${form.title.trim() ? ' ok' : ''}`}
                    placeholder="e.g. Land a software role via Handshake by graduation"
                    value={form.title} autoFocus
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  <input className="s-inp"
                    placeholder="Brief context or description (optional)..."
                    value={form.desc}
                    onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} />
                </div>
                <div className="smart-field">
                  <div className="smart-lbl">
                    <div className="smart-badge" style={{ background:`${T.blue}20`, color:T.blue }}>M</div>
                    <span className="smart-name" style={{ color:T.blue }}>Measurable</span>
                    <span className="smart-hint">How will you know you succeeded?</span>
                  </div>
                  <input className={`s-inp${form.measurable.trim() ? ' ok' : ''}`}
                    placeholder="e.g. Receive and accept a written job offer"
                    value={form.measurable}
                    onChange={e => setForm(f => ({ ...f, measurable: e.target.value }))} />
                </div>
                <div className="smart-field">
                  <div className="smart-lbl">
                    <div className="smart-badge" style={{ background:`${T.green}20`, color:T.green }}>A</div>
                    <span className="smart-name" style={{ color:T.green }}>Achievable</span>
                    <span className="smart-hint">Why is this realistic right now?</span>
                  </div>
                  <input className={`s-inp${form.achievable.trim() ? ' ok' : ''}`}
                    placeholder="e.g. I have relevant skills and 3 months to prepare"
                    value={form.achievable}
                    onChange={e => setForm(f => ({ ...f, achievable: e.target.value }))} />
                </div>
                <div className="smart-field">
                  <div className="smart-lbl">
                    <div className="smart-badge" style={{ background:`${T.purple}20`, color:T.purple }}>R</div>
                    <span className="smart-name" style={{ color:T.purple }}>Relevant</span>
                    <span className="smart-hint">Why does this matter to you?</span>
                  </div>
                  <input className={`s-inp${form.relevant.trim() ? ' ok' : ''}`}
                    placeholder="e.g. Financial independence and work I care about"
                    value={form.relevant}
                    onChange={e => setForm(f => ({ ...f, relevant: e.target.value }))} />
                </div>
                <div className="smart-field">
                  <div className="smart-lbl">
                    <div className="smart-badge" style={{ background:`${T.rose}20`, color:T.rose }}>T</div>
                    <span className="smart-name" style={{ color:T.rose }}>Time-bound</span>
                    <span className="smart-hint">Target deadline</span>
                  </div>
                  <input type="date"
                    className={`s-inp${form.deadline ? ' ok' : ''}`}
                    style={{ fontFamily:"'IBM Plex Mono',monospace", colorScheme:'dark' }}
                    value={form.deadline}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
                </div>
                {/* Priority + Horizon */}
                <div style={{ display:'flex', gap:10, marginBottom:16 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                      <div style={{ width:20, height:20, borderRadius:4, background:`${T.rose}20`, color:T.rose, fontSize:9, fontWeight:800, fontFamily:"'IBM Plex Mono',monospace", display:'flex', alignItems:'center', justifyContent:'center' }}>P</div>
                      <span style={{ fontSize:12, fontWeight:700, letterSpacing:'.04em' }}>Priority</span>
                    </div>
                    <select className="s-inp" value={form.priority}
                      onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                      style={{ fontFamily:"'IBM Plex Mono',monospace" }}>
                      <option value="low">Low</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                      <div style={{ width:20, height:20, borderRadius:4, background:`${T.blue}20`, color:T.blue, fontSize:9, fontWeight:800, fontFamily:"'IBM Plex Mono',monospace", display:'flex', alignItems:'center', justifyContent:'center' }}>H</div>
                      <span style={{ fontSize:12, fontWeight:700, letterSpacing:'.04em' }}>Horizon</span>
                    </div>
                    <select className="s-inp" value={form.scale}
                      onChange={e => setForm(f => ({ ...f, scale: e.target.value }))}
                      style={{ fontFamily:"'IBM Plex Mono',monospace" }}>
                      <option value="short">Short-term</option>
                      <option value="medium">Medium-term</option>
                      <option value="long">Long-term</option>
                    </select>
                  </div>
                </div>
                <div className="m-btns">
                  <button className="m-cancel" onClick={() => { setModal(false); setForm({ title:'', desc:'', measurable:'', achievable:'', relevant:'', deadline:'', priority:'low', scale:'short' }); }}>Cancel</button>
                  <button className="m-ok" onClick={addProject} disabled={!smartComplete(form)}>Create + Generate Tasks</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Onward Task Popover ── */}
          {onwardClickedItem && (() => {
            const item = onwardItems.find(it => it.id === onwardClickedItem.id) || onwardClickedItem;
            const fmt  = (m) => { const h = Math.floor(m/60); const min = m%60; const ap = h>=12?'PM':'AM'; return `${h%12||12}:${min.toString().padStart(2,'0')}${ap}`; };
            const color = item.priority === 'high' ? T.rose : T.blue;
            const linkedGoal = projects.find(p => p.id === item.goalId);
            return (
              <div style={{ position:'fixed', inset:0, zIndex:300 }} onClick={() => setOnwardClickedItem(null)}>
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position:'fixed',
                    left: Math.min(onwardClickedItem.cardX + 8, window.innerWidth - 260),
                    top:  Math.min(onwardClickedItem.cardY + 8, window.innerHeight - 200),
                    width:240,
                    background:'#0d1017',
                    border:`1px solid ${color}55`,
                    borderRadius:10,
                    padding:'14px 16px',
                    boxShadow:`0 8px 32px rgba(0,0,0,.6)`,
                    zIndex:301,
                  }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0 }} />
                    <span style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, color:T.text, flex:1 }}>{item.title}</span>
                    <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:color }}>{fmt(item.hour)}</span>
                  </div>
                  {linkedGoal && (
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:T.muted, marginBottom:10 }}>
                      ↳ {linkedGoal.title}
                    </div>
                  )}
                  <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                    <button
                      onClick={() => {
                        startSession(item.title, item.goalId || null);
                        setOnwardClickedItem(null);
                        setMainPage('tracking');
                      }}
                      style={{ background:`${T.green}18`, border:`1px solid ${T.green}55`, borderRadius:6, color:T.green, padding:'8px 0', fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700, cursor:'pointer', letterSpacing:'.06em' }}
                    >▶ Start Focus Session</button>
                    <button
                      onClick={() => {
                        setOnwardItems(prev => prev.map(it => it.id===item.id ? { ...it, done: !it.done } : it));
                        setOnwardClickedItem(null);
                      }}
                      style={{ background: item.done ? `${T.muted}18` : `${color}18`, border:`1px solid ${item.done ? T.muted : color}55`, borderRadius:6, color: item.done ? T.muted : color, padding:'7px 0', fontFamily:"'IBM Plex Mono',monospace", fontSize:11, cursor:'pointer' }}
                    >{item.done ? '↩ Mark Undone' : '✓ Mark Done'}</button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Delete confirmation ── */}
          {confirmDelete && (() => {
            const target = projects.find(p => p.id === confirmDelete);
            return (
              <div className="overlay" onClick={() => setConfirmDelete(null)}>
                <div className="modal" style={{ width:340 }} onClick={e => e.stopPropagation()}>
                  <h2 style={{ color:T.rose, fontSize:16, marginBottom:8 }}>Delete goal?</h2>
                  <p style={{ fontSize:13, color:T.muted, marginBottom:20, lineHeight:1.5 }}>
                    "{target?.title}" and all its subtasks and checkpoints will be permanently removed.
                  </p>
                  <div className="m-btns">
                    <button className="m-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
                    <button className="m-ok" style={{ background:T.rose }} onClick={() => deleteGoal(confirmDelete)}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })()}

          {showMindCheckCard && (
            <MindCheckCard
              onMoveOn={() => setShowMindCheckCard(false)}
              onMindCheck={() => { setMainPage('mindcheck'); setShowMindCheckCard(false); }}
            />
          )}

          {/* ── Deadline Notifier ── */}
          {showDeadlineNotifier && deadlineAlerts.length > 0 && (
            <div className="overlay" onClick={() => setShowDeadlineNotifier(false)}>
              <div className="modal" style={{ width:360, maxHeight:'70vh' }} onClick={e => e.stopPropagation()}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                  <span style={{ fontSize:20 }}>⏰</span>
                  <h2 style={{ color:T.accent, fontSize:16, margin:0 }}>Deadline Alerts</h2>
                </div>
                <div style={{ maxHeight:'50vh', overflowY:'auto', marginBottom:16 }}>
                  {deadlineAlerts.map(alert => (
                    <div key={alert.id} style={{
                      padding:'10px 12px',
                      background:'rgba(27,35,54,0.5)',
                      borderRadius:6,
                      marginBottom:8,
                      borderLeft:`3px solid ${alert.color}`,
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <span style={{ fontSize:12, color:T.text, fontWeight:600 }}>{alert.title}</span>
                        <span style={{
                          fontFamily:"'IBM Plex Mono',monospace",
                          fontSize:9,
                          color:alert.color,
                          padding:'2px 6px',
                          background:`${alert.color}15`,
                          borderRadius:4,
                        }}>
                          {alert.type === 'overdue' ? `${Math.abs(alert.days)}d overdue` :
                           alert.days === 0 ? 'Due today' :
                           alert.days === 1 ? '1 day left' :
                           `${alert.days} days left`}
                        </span>
                      </div>
                      <div style={{ fontSize:9, color:T.muted, marginTop:4, fontFamily:"'IBM Plex Mono',monospace" }}>
                        {alert.priority === 'high' ? 'High priority' : 'Low priority'} • Click to view in Map
                      </div>
                    </div>
                  ))}
                </div>
                <div className="m-btns" style={{ justifyContent:'space-between' }}>
                  <button className="m-cancel" onClick={() => setShowDeadlineNotifier(false)}>Dismiss</button>
                  <button
                    className="m-ok"
                    onClick={() => { setShowDeadlineNotifier(false); setActivePage('map'); }}
                  >
                    View in Map
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Immersive Focus Screen ── */}
          {focusMode && (
            <FocusScreen
              taskTitle={focusMode.taskTitle}
              taskId={focusMode.taskId}
              goalId={focusMode.goalId}
              onExit={handleExitFocus}
              onSessionComplete={handleFocusSessionComplete}
              onBrainDump={handleBrainDump}
              brainDumpEntries={brainDumpEntries}
              projects={projects}
            />
          )}
        </>
      );
    }


export default Meridian;
