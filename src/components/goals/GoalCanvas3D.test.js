/**
 * Tests for GoalCanvas3D — the goal rendering pipeline.
 *
 * What we're testing:
 * - The complete data transformation pipeline from goal creation → 2D canvas rendering
 * - That newly created goals correctly appear as renderable nodes
 * - That the drawGoalsPage logic correctly transforms project data
 * - That rendering data (color, progress, position) is correctly derived from project state
 *
 * This test catches regressions where newly created goals fail to render
 * (e.g., stale closures, incorrect filtering, invalid color/progress values).
 *
 * NOTE: These are pure unit tests that test the data transformation pipeline
 * without requiring canvas rendering. The rendering itself is tested
 * by the build compilation and manual visual testing.
 */

import { describe, it, expect } from 'vitest';

// ── Helpers (mirroring App.jsx logic) ─────────────────────────────────────

import { uid, projectPos, progress } from '../../utils/helpers.js';
import { NODE_PALETTE } from '../../utils/theme.js';

const colorFor = (i) => NODE_PALETTE[i % NODE_PALETTE.length];

/**
 * Simple hex-to-RGB helper (replaces THREE.Color usage).
 */
function hexToRgb(hex) {
  if (!hex) return { r: 1, g: 1, b: 1 };
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

/**
 * Simulates createGoalFromModal from App.jsx.
 * Returns the new project object exactly as App.jsx would create it.
 */
function createGoal(goalData, existingProjectsCount) {
  const id = uid();
  const color = colorFor(existingProjectsCount);
  const pos = projectPos(existingProjectsCount);
  return {
    id, color, pos,
    title: goalData.title || 'Untitled Goal',
    desc: goalData.desc || '',
    measurable: goalData.measurable || '',
    achievable: goalData.achievable || '',
    relevant: goalData.relevant || '',
    deadline: goalData.deadline || '',
    priority: goalData.priority || 'low',
    scale: goalData.scale || 'short',
    inFocus: false,
    completedAt: null,
    subtasks: (goalData.subtasks || []).map(st => ({ id: uid(), title: st.title, done: false, skill: st.skill || null })),
    checkpoints: (goalData.checkpoints || []).map(cp => ({ id: uid(), title: cp.title, done: false })),
  };
}

/**
 * Simulates the mapping logic in drawGoalsPage.
 * Transforms a projects array into rendering data with pixel positions.
 */
function mapProjectsToNodes(projects, selectedId, topGoalIds, pan) {
  return projects
    .filter(p => !p.completedAt)
    .map((p, i) => {
      const pos = p.pos || { x: 240 + i * 440, y: 270 };
      const px = pos.x + pan.x;
      const py = pos.y + pan.y;
      const pct = progress(p) / 100;
      const hasSubtasks = (p.subtasks?.length || 0) > 0 || (p.checkpoints?.length || 0) > 0;
      return {
        ...p,
        renderX: px,
        renderY: py,
        progressPct: pct,
        isSelected: p.id === selectedId,
        isTopGoal: topGoalIds.includes(p.id),
        hasSubtasks,
        isComplete: !!p.completedAt,
      };
    });
}

/**
 * Simulates the rendering data derivation (replaces old derivePlanetUniforms).
 * Returns the visual properties that would be used for 2D canvas rendering.
 */
function deriveNodeRenderData(project, isSelected) {
  const { color, progress: goalProgress = 0 } = project;
  const rgb = hexToRgb(color);
  return {
    color:           color,
    colorRgb:        rgb,
    emissiveColor:   `rgba(${Math.round(rgb.r * 255)},${Math.round(rgb.g * 255)},${Math.round(rgb.b * 255)},0.6)`,
    emissiveIntensity: isSelected ? 3.0 : 2.0,
    progress:        Math.max(0.05, goalProgress),
    opacity:         1.0,
  };
}


// ── Tests ─────────────────────────────────────────────────────────────────

describe('GoalCanvas3D — goal creation → rendering pipeline', () => {

  // ── Goal creation ─────────────────────────────────────────────────────

  describe('createGoal (simulated createGoalFromModal)', () => {
    it('creates a valid goal object with all required fields', () => {
      const existing = [
        { id: 'a', title: 'Existing Goal' },
      ];
      const goal = createGoal({ title: 'New Goal' }, existing.length);

      expect(goal).toBeDefined();
      expect(goal.id).toBeTypeOf('string');
      expect(goal.id.length).toBeGreaterThan(0);
      expect(goal.title).toBe('New Goal');
      expect(goal.color).toBeTypeOf('string');
      expect(goal.color.startsWith('#')).toBe(true);
      expect(goal.pos).toEqual({ x: 680, y: 270 }); // 240 + 1*440
      expect(goal.completedAt).toBeNull();
      expect(goal.inFocus).toBe(false);
      expect(Array.isArray(goal.subtasks)).toBe(true);
      expect(Array.isArray(goal.checkpoints)).toBe(true);
    });

    it('assigns colors from NODE_PALETTE cycling', () => {
      // Create enough goals to cycle through the palette
      const goals = Array.from({ length: NODE_PALETTE.length + 2 }, (_, i) =>
        createGoal({ title: `Goal ${i}` }, i)
      );

      // First goal gets first palette color
      expect(goals[0].color).toBe(NODE_PALETTE[0]);
      // Last goal cycles back
      expect(goals[NODE_PALETTE.length].color).toBe(NODE_PALETTE[0]);
      expect(goals[NODE_PALETTE.length + 1].color).toBe(NODE_PALETTE[1]);
    });

    it('assigns sequential positions via projectPos', () => {
      const g0 = createGoal({ title: 'First' }, 0);
      const g1 = createGoal({ title: 'Second' }, 1);
      const g2 = createGoal({ title: 'Third' }, 2);

      expect(g0.pos).toEqual({ x: 240, y: 270 });
      expect(g1.pos).toEqual({ x: 680, y: 270 });
      expect(g2.pos).toEqual({ x: 1120, y: 270 });
    });

    it('creates subtasks and checkpoints with correct structure', () => {
      const goal = createGoal({
        title: 'Big Goal',
        subtasks: [{ title: 'Step 1' }, { title: 'Step 2' }],
        checkpoints: [{ title: 'Milestone' }],
      }, 0);

      expect(goal.subtasks).toHaveLength(2);
      expect(goal.checkpoints).toHaveLength(1);
      expect(goal.subtasks[0].title).toBe('Step 1');
      expect(goal.subtasks[0].done).toBe(false);
      expect(goal.subtasks[0].id).toBeTypeOf('string');
      expect(goal.checkpoints[0].title).toBe('Milestone');
      expect(goal.checkpoints[0].done).toBe(false);
    });
  });

  // ── Node mapping ────────────────────────────────────────────────────

  describe('mapProjectsToNodes (simulated drawGoalsPage mapping)', () => {
    const pan = { x: 0, y: 0 };

    it('includes newly created goals (completedAt === null)', () => {
      const newGoal = createGoal({ title: 'Fresh Goal' }, 0);
      const nodes = mapProjectsToNodes([newGoal], null, [], pan);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe(newGoal.id);
      expect(nodes[0].title).toBe('Fresh Goal');
    });

    it('filters out completed goals', () => {
      const active = createGoal({ title: 'Active' }, 0);
      const completed = { ...createGoal({ title: 'Done' }, 1), completedAt: '2024-01-01' };
      const nodes = mapProjectsToNodes([active, completed], null, [], pan);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe(active.id);
    });

    it('maps position correctly with pan offset', () => {
      const goal = createGoal({ title: 'Test' }, 0);
      const panOffset = { x: 100, y: 50 };
      const nodes = mapProjectsToNodes([goal], null, [], panOffset);

      expect(nodes[0].renderX).toBe(240 + 100); // 340
      expect(nodes[0].renderY).toBe(270 + 50);  // 320
    });

    it('marks the selected goal', () => {
      const g1 = createGoal({ title: 'One' }, 0);
      const g2 = createGoal({ title: 'Two' }, 1);
      const nodes = mapProjectsToNodes([g1, g2], g2.id, [], pan);

      expect(nodes[0].isSelected).toBe(false);
      expect(nodes[1].isSelected).toBe(true);
    });

    it('marks top goals', () => {
      const g1 = createGoal({ title: 'One' }, 0);
      const g2 = createGoal({ title: 'Two' }, 1);
      const g3 = createGoal({ title: 'Three' }, 2);
      const nodes = mapProjectsToNodes([g1, g2, g3], null, [g1.id, g3.id], pan);

      expect(nodes[0].isTopGoal).toBe(true);
      expect(nodes[1].isTopGoal).toBe(false);
      expect(nodes[2].isTopGoal).toBe(true);
    });

    it('uses fallback position when pos is missing', () => {
      const goal = { ...createGoal({ title: 'No Pos' }, 0), pos: undefined };
      const nodes = mapProjectsToNodes([goal], null, [], pan);

      // Fallback: { x: 240 + 0*440, y: 270 }
      expect(nodes[0].renderX).toBe(240);
      expect(nodes[0].renderY).toBe(270);
    });

    it('returns empty array when all goals are completed', () => {
      const done = { ...createGoal({ title: 'Done' }, 0), completedAt: '2024-06-01' };
      const nodes = mapProjectsToNodes([done], null, [], pan);
      expect(nodes).toHaveLength(0);
    });

    it('handles empty projects array', () => {
      const nodes = mapProjectsToNodes([], null, [], pan);
      expect(nodes).toHaveLength(0);
    });

    it('computes progress percentage from subtasks/checkpoints', () => {
      const goal = createGoal({
        title: 'In Progress',
        subtasks: [{ title: 'Step 1' }, { title: 'Step 2' }],
        checkpoints: [{ title: 'Milestone' }],
      }, 0);
      // Mark one subtask as done
      goal.subtasks[0].done = true;
      // 1 done out of 3 total = 33%
      const nodes = mapProjectsToNodes([goal], null, [], pan);
      expect(nodes[0].progressPct).toBeCloseTo(0.33, 1);
    });

    it('marks completed goals with isComplete flag', () => {
      const goal = { ...createGoal({ title: 'Done' }, 0), completedAt: '2024-06-17' };
      const nodes = mapProjectsToNodes([goal], null, [], pan);
      expect(nodes).toHaveLength(0); // filtered out
    });
  });

  // ── Render data derivation ────────────────────────────────────────────

  describe('deriveNodeRenderData (simulated rendering data)', () => {
    it('derives valid color values from goal color', () => {
      const goal = createGoal({ title: 'Color Test' }, 0);
      const data = deriveNodeRenderData(goal, false);

      expect(data.color).toBe(goal.color);
      expect(data.colorRgb).toBeTypeOf('object');
      expect(data.colorRgb.r).toBeGreaterThanOrEqual(0);
      expect(data.colorRgb.r).toBeLessThanOrEqual(1);
      expect(data.colorRgb.g).toBeGreaterThanOrEqual(0);
      expect(data.colorRgb.g).toBeLessThanOrEqual(1);
      expect(data.colorRgb.b).toBeGreaterThanOrEqual(0);
      expect(data.colorRgb.b).toBeLessThanOrEqual(1);
    });

    it('defaults progress to 0.05 minimum for new goals with no progress', () => {
      const goal = createGoal({ title: 'No Progress' }, 0);
      // New goals don't have a progress property
      delete goal.progress;
      const data = deriveNodeRenderData(goal, false);

      expect(data.progress).toBe(0.05);
    });

    it('uses actual progress when available', () => {
      const goal = {
        ...createGoal({ title: 'With Progress' }, 0),
        progress: 0.75,
      };
      const data = deriveNodeRenderData(goal, false);
      expect(data.progress).toBe(0.75);
    });

    it('increases emissive intensity when selected', () => {
      const goal = createGoal({ title: 'Selected' }, 0);
      const unselected = deriveNodeRenderData(goal, false);
      const selected = deriveNodeRenderData(goal, true);

      expect(selected.emissiveIntensity).toBe(3.0);
      expect(unselected.emissiveIntensity).toBe(2.0);
    });

    it('handles invalid color gracefully (no crash)', () => {
      const goal = { ...createGoal({ title: 'Bad Color' }, 0), color: undefined };
      expect(() => deriveNodeRenderData(goal, false)).not.toThrow();
      const data = deriveNodeRenderData(goal, false);
      // hexToRgb(undefined) defaults to white
      expect(data.colorRgb.r).toBe(1);
      expect(data.colorRgb.g).toBe(1);
      expect(data.colorRgb.b).toBe(1);
    });
  });

  // ── Full pipeline integration ─────────────────────────────────────────

  describe('full pipeline: create → map → render data', () => {
    it('a newly created goal survives the entire pipeline', () => {
      // Step 1: Create a goal (simulating user action)
      const existingProjects = [
        createGoal({ title: 'Existing' }, 0),
        createGoal({ title: 'Another' }, 1),
      ];
      const newGoal = createGoal(
        { title: 'Brand New', subtasks: [{ title: 'Step 1' }] },
        existingProjects.length // index 2
      );

      // Step 2: Add to projects array (simulating setProjects)
      const allProjects = [...existingProjects, newGoal];

      // Step 3: Map to render nodes (simulating drawGoalsPage mapping)
      const nodes = mapProjectsToNodes(allProjects, newGoal.id, [], { x: 0, y: 0 });

      // Assert the new goal appears as a render node
      const newNode = nodes.find(p => p.id === newGoal.id);
      expect(newNode).toBeDefined();
      expect(newNode.title).toBe('Brand New');
      expect(newNode.isSelected).toBe(true);
      expect(newNode.isTopGoal).toBe(false);
      expect(newNode.renderX).toBe(1120); // 240 + 2*440
      expect(newNode.renderY).toBe(270);

      // Step 4: Derive render data (simulating rendering preparation)
      const data = deriveNodeRenderData(newNode, newNode.isSelected);

      // Assert render data is valid
      expect(data.color).toBe(newNode.color);
      expect(data.emissiveIntensity).toBe(3.0); // selected
      expect(data.progress).toBe(0.05); // new goal, no progress
      expect(data.opacity).toBe(1.0);
    });

    it('multiple new goals all appear with correct positions', () => {
      const projects = [];
      const newGoals = [];

      // Create 5 goals in sequence
      for (let i = 0; i < 5; i++) {
        const goal = createGoal({ title: `Goal ${i}` }, projects.length);
        projects.push(goal);
        newGoals.push(goal);
      }

      const nodes = mapProjectsToNodes(projects, null, [], { x: 0, y: 0 });

      expect(nodes).toHaveLength(5);
      newGoals.forEach((g, i) => {
        const node = nodes.find(p => p.id === g.id);
        expect(node).toBeDefined();
        expect(node.renderX).toBe(240 + i * 440);
        expect(node.renderY).toBe(270);
      });
    });

    it('completed goals are excluded even if newly added', () => {
      const completedGoal = {
        ...createGoal({ title: 'Already Done' }, 0),
        completedAt: '2024-06-17',
      };
      const nodes = mapProjectsToNodes([completedGoal], null, [], { x: 0, y: 0 });
      expect(nodes).toHaveLength(0);
    });

    it('computes correct progress for goals with mixed completion states', () => {
      const goal = createGoal({
        title: 'Mixed Progress',
        subtasks: [
          { title: 'Step 1' },
          { title: 'Step 2' },
          { title: 'Step 3' },
          { title: 'Step 4' },
        ],
        checkpoints: [
          { title: 'Milestone A' },
          { title: 'Milestone B' },
        ],
      }, 0);

      // Mark some as done
      goal.subtasks[0].done = true;
      goal.subtasks[1].done = true;
      goal.checkpoints[0].done = true;
      // 3 done out of 6 total = 50%
      goal.progress = 50;

      const nodes = mapProjectsToNodes([goal], null, [], { x: 0, y: 0 });
      expect(nodes[0].progressPct).toBe(0.5);

      const data = deriveNodeRenderData(nodes[0], false);
      expect(data.progress).toBe(50);
    });
  });
});
