# Refactoring Plan: `src/App.jsx`

## Goal
Reduce `src/App.jsx` from **2786 lines** to approximately **~1200 lines** by extracting self-contained logic into custom hooks and UI into separate components.

## Strategy
1. **Delete dead code** (the hidden legacy SMART modal)
2. **Extract inline CSS** into a proper stylesheet
3. **Extract UI sections** into standalone components
4. **Extract logic** into custom hooks
5. Keep the core wiring, state declarations, and canvas draw loop in `App.jsx`

---

## Step 1: Delete Dead Code

**File:** `src/App.jsx` lines 2521-2632

The legacy SMART modal is wrapped in `{false && modal && (...)}` — it's dead code that never renders. Delete it entirely.

**Lines saved:** ~112

---

## Step 2: Extract Inline CSS → Stylesheet

**File:** `src/App.jsx` lines 1400-1716

The giant `<style>{`...`}</style>` block uses `${T.*}` JS template variables. To extract to CSS, we need to:

1. Define CSS custom properties on `:root` based on the `T` theme object
2. Move all CSS classes into `src/styles/app.css`
3. Replace `${T.*}` references with `var(--t-*)` equivalents

**New file:** `src/styles/app.css`
**Lines saved:** ~316

---

## Step 3: Extract Custom Hooks

### 3a. `useCanvasInteraction` hook

**Source:** Lines 1042-1393

Extract all canvas mouse/touch/drag handlers:
- `onCanvasMouseDown`
- `onCanvasMouseMove`
- `onCanvasMouseUp`
- `onCanvasDragOver`
- `onCanvasDragLeave`
- `onCanvasDrop`

**New file:** `src/hooks/useCanvasInteraction.js`
**Lines saved:** ~350

### 3b. `useTracking` hook

**Source:** Lines 884-995

Extract session/tracking helpers:
- `startSession`, `stopSession`
- `planDay`
- `getWeeklyData`, `getMonthlyData`
- `getTodayStats`, `getSessionsForDay/Week/Month`
- `sessionDurationMin`, `todayStr`
- `allCompletionDates`, `calcStreak`

**New file:** `src/hooks/useTracking.js`
**Lines saved:** ~110

### 3c. `useLocalStorageSync` hook

**Source:** Lines 310-323

Extract the many `useEffect` blocks that persist state to localStorage into a single hook that takes a config map of `{ stateKey: 'localStorageKey' }`.

**New file:** `src/hooks/useLocalStorageSync.js`
**Lines saved:** ~20

### 3d. `useOnwardScroll` hook

**Source:** Lines 380-422

Extract the onward page auto-scroll and waypoint resize effects.

**New file:** `src/hooks/useOnwardScroll.js`
**Lines saved:** ~40

---

## Step 4: Extract UI Components

### 4a. `NovaSidebarBlock` component

**Source:** Lines 1741-1834

The NOVA confidence meter + daily plan UI in the sidebar. Props needed:
- `novaState`, `novaState.planGenLoading`, `novaState.dailyPlan`, `novaState.planError`, `novaState.syncEvents`
- `waypointOpen`, `waypointContext`
- `prioritizeInput`, `setPrioritizeInput`
- `generateNovaPlan`, `closeWaypoint`, `openWaypoint`
- `apiKey`, `T`

**New file:** `src/components/nova/NovaSidebarBlock.jsx`
**Lines saved:** ~93

### 4b. `ProgramsList` component

**Source:** Lines 1837-1924

The programs section in the sidebar. Props needed:
- `waypointOpen`, `waypointContext`
- `openWaypoint`, `closeWaypoint`
- `addSyncEvent`, `T`

**New file:** `src/components/nova/ProgramsList.jsx`
**Lines saved:** ~90

### 4c. `BottomNav` component

**Source:** Lines 1927-1966

The bottom navigation bar. Props needed:
- `mainPage`, `setMainPage`, `closeWaypoint`, `T`

**New file:** `src/components/BottomNav.jsx`
**Lines saved:** ~40

### 4d. `GoalDetailPanel` component

**Source:** Lines 2116-2264

The goal detail view inside the waypoint sidebar. Props needed:
- `proj` (the project object)
- `renamingGoalId`, `renameValue`, `setRenamingGoalId`, `setRenameValue`
- `addInput`, `setAddInput`
- `toggleSubtask`, `toggleCheckpoint`, `deleteSubtask`, `deleteCheckpoint`
- `addSubtask`, `addCheckpoint`, `completeGoal`, `renameGoal`
- `closeWaypoint`, `setConfirmDelete`
- `sunId`, `setSunId`
- `companionLoading`, `aiMsg`, `companionName`
- `checkIn`, `suggestSubtask`

**New file:** `src/components/panels/GoalDetailPanel.jsx`
**Lines saved:** ~148

### 4e. `NovaInsightsPanel` component

**Source:** Lines 2359-2496

The NOVA productivity insights panel. Props needed:
- `novaState`, `apiKey`
- `calcStreak`, `getWeeklyData`
- `closeWaypoint`, `generateNovaPlan`

**New file:** `src/components/nova/NovaInsightsPanel.jsx`
**Lines saved:** ~137

### 4f. `CanvasPanelWrapper` component

**Source:** Lines 2302-2357

Routes to OnwardPanel/MapPanel/SkillsPanel inside the waypoint. Props needed:
- `waypointContext.id` (panelId)
- All props currently passed to OnwardPanel, MapPanel, SkillsPanel

**New file:** `src/components/panels/CanvasPanelWrapper.jsx`
**Lines saved:** ~55

### 4g. `OnwardTaskPopover` component

**Source:** Lines 2635-2687

The popover that appears when clicking an onward task. Props needed:
- `onwardClickedItem`, `setOnwardClickedItem`
- `onwardItems`, `projects`
- `startSession`, `setMainPage`, `setOnwardItems`

**New file:** `src/components/OnwardTaskPopover.jsx`
**Lines saved:** ~53

### 4h. `DeadlineNotifier` component

**Source:** Lines 2716-2765

The deadline alerts modal. Props needed:
- `showDeadlineNotifier`, `setShowDeadlineNotifier`
- `deadlineAlerts`, `setActivePage`

**New file:** `src/components/DeadlineNotifier.jsx`
**Lines saved:** ~50

---

## Summary of Savings

| Step | Action | Lines Saved | Remaining |
|------|--------|-------------|-----------|
| — | Current total | — | 2786 |
| 1 | Delete dead code | 112 | 2674 |
| 2 | Extract CSS | 316 | 2358 |
| 3a | `useCanvasInteraction` hook | 350 | 2008 |
| 3b | `useTracking` hook | 110 | 1898 |
| 3c | `useLocalStorageSync` hook | 20 | 1878 |
| 3d | `useOnwardScroll` hook | 40 | 1838 |
| 4a | `NovaSidebarBlock` | 93 | 1745 |
| 4b | `ProgramsList` | 90 | 1655 |
| 4c | `BottomNav` | 40 | 1615 |
| 4d | `GoalDetailPanel` | 148 | 1467 |
| 4e | `NovaInsightsPanel` | 137 | 1330 |
| 4f | `CanvasPanelWrapper` | 55 | 1275 |
| 4g | `OnwardTaskPopover` | 53 | 1222 |
| 4h | `DeadlineNotifier` | 50 | **~1172** |

**Final estimated size: ~1172 lines** (a **58% reduction**)

---

## Execution Order

The refactoring should be done in this order to avoid breaking the app:

1. **Delete dead code** — safe, no impact
2. **Extract hooks** (3a-3d) — these are pure logic moves, no UI changes
3. **Extract UI components** (4a-4h) — each component extraction followed by import + usage in App.jsx
4. **Extract CSS** (step 2) — do this last since it's the riskiest change (switching from JS template strings to CSS custom properties)

Each step should be done as a separate commit for clean history.
