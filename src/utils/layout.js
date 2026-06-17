/**
 * Auto-organize goals into a clean grid layout within the canvas viewport.
 *
 * @param {Array} projects - Array of goal/project objects with .pos {x,y}
 * @param {number} canvasWidth - Width of the canvas in CSS pixels
 * @param {number} canvasHeight - Height of the canvas in CSS pixels
 * @param {number} padding - Padding from edges (default: 80)
 * @returns {Array} New projects array with updated .pos values
 */
export function autoOrganizeGoals(projects, canvasWidth, canvasHeight, padding = 80) {
  if (!projects.length) return projects;

  const nodeSpacingX = 160;
  const nodeSpacingY = 140;
  const cols = Math.max(1, Math.floor((canvasWidth - padding * 2) / nodeSpacingX));

  return projects.map((p, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      ...p,
      pos: {
        x: padding + col * nodeSpacingX,
        y: padding + row * nodeSpacingY,
      },
    };
  });
}
