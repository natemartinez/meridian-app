import { T } from './theme.js';
import { hexToRgb, rgba, drawGlow, drawProgressArc, rrect, drawSubtaskNode, drawCheckpointNode } from './canvas.js';
import { progress } from './helpers.js';

// ── Onward page ──────────────────────────────────────────────────────────────
// scrollY: canvas.parentElement.scrollTop * dpr (computed in frame() before call)
export function drawOnwardPage(ctx, dpr, w, viewH, t, scrollY, refs) {
  const { onwardItemsRef, pendingDropRef, dragOverHourRef, onwardHitAreasRef, projectsRef, resizeDragRef, onwardDragRef } = refs;
  const hitAreas = [];
  const PAD  = 24 * dpr;
  const LEFT = 90 * dpr;
  const ROW_START = 6;     // 6 AM
  const ROW_END   = 24;    // 12 AM (midnight)
  const now    = new Date();
  const curH   = now.getHours() + now.getMinutes() / 60;

  // Calculate visible time window (5 hours 45 minutes = 5.75 hours)
  const VISIBLE_HOURS = 5.75;
  // Row height fills viewport exactly for the visible hours (no padding subtraction)
  const rowH = viewH / VISIBLE_HOURS;

  const firstVisibleHour = ROW_START + scrollY / rowH;
  const lastVisibleHour = firstVisibleHour + VISIBLE_HOURS;

  // Helper: get Y position for any fractional hour
  const getY = (hour) => PAD + (hour - ROW_START) * rowH;

  const today  = new Date().toDateString();
  const items  = onwardItemsRef.current.filter(it => !it.date || it.date === today);
  const pending  = pendingDropRef.current;
  const dragOver = dragOverHourRef.current;
  const resizeDrag = resizeDragRef?.current || null;
  const onwardDrag = onwardDragRef?.current || null;

  // Page heading (fixed at top of viewport, doesn't scroll with content)
  ctx.save();
  ctx.font = `700 ${13*dpr}px 'Syne',sans-serif`;
  ctx.fillStyle = T.accent;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('ONWARD', PAD + LEFT, PAD * 0.4 + scrollY);
  ctx.restore();

  // Draw current time indicator line across visible area
  if (curH >= firstVisibleHour && curH <= lastVisibleHour) {
    const lineY = getY(curH);
    ctx.save();
    ctx.strokeStyle = rgba(T.accent, .5 + .3 * Math.sin(t*2));
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath(); ctx.moveTo(PAD + LEFT, lineY); ctx.lineTo(w - PAD, lineY);
    ctx.stroke(); ctx.restore();
  }

  // Calculate which hour rows to draw (include partial at edges)
  const startHour = Math.floor(firstVisibleHour);
  const endHour = Math.ceil(lastVisibleHour);

  // Draw 15-minute lines from previous hour when partially visible at top
  if (startHour > ROW_START && firstVisibleHour > startHour) {
    const prevHour = startHour - 1;
    if (prevHour >= ROW_START) {
      const prevY0 = getY(prevHour);
      ctx.save();
      ctx.font = `${9*dpr}px 'IBM Plex Mono',monospace`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let q = 1; q <= 3; q++) {
        const qy = prevY0 + (q * 0.25) * rowH;
        if (qy < scrollY - 10*dpr || qy > scrollY + viewH + 10*dpr) continue;
        // Only draw if in the visible range (above firstVisibleHour)
        const minuteTime = prevHour + q * 0.25;
        if (minuteTime < firstVisibleHour) continue;
        const min = q * 15;
        ctx.strokeStyle = rgba(T.dim, .5);
        ctx.lineWidth = 0.8 * dpr;
        ctx.beginPath();
        ctx.moveTo(PAD + LEFT + 20*dpr, qy);
        ctx.lineTo(w - PAD, qy);
        ctx.stroke();
        ctx.fillStyle = rgba(T.muted, .8);
        ctx.fillText(`:${min}`, PAD + LEFT - 6*dpr, qy);
      }
      ctx.restore();
    }
  }

  for (let hour = startHour; hour <= endHour; hour++) {
    if (hour < ROW_START || hour > ROW_END) continue;

    const y0 = getY(hour);
    const isNow = curH >= hour && curH < hour + 1;
    const isDragTarget = dragOver === hour;

    // Hour row background (visible stripe for all rows)
    ctx.save();
    ctx.fillStyle = hour % 2 === 0 ? rgba(T.border, .2) : rgba(T.border, .35);
    ctx.fillRect(PAD + LEFT, y0, w - PAD*2 - LEFT, rowH);
    ctx.restore();

    // Current hour highlight (subtle background)
    if (isNow) {
      ctx.save();
      ctx.fillStyle = rgba(T.accent, .04);
      ctx.fillRect(PAD, y0, w - PAD*2, rowH);
      ctx.restore();
    }

    // Drag hover highlight
    if (isDragTarget) {
      ctx.save();
      ctx.fillStyle = rgba(T.accent, .08);
      ctx.fillRect(PAD + LEFT, y0, w - PAD*2 - LEFT, rowH);
      ctx.strokeStyle = rgba(T.accent, .3);
      ctx.lineWidth = 1.5 * dpr;
      ctx.setLineDash([6*dpr, 4*dpr]);
      ctx.beginPath(); ctx.moveTo(PAD + LEFT, y0); ctx.lineTo(w - PAD, y0);
      ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }

    // Hour label (only if fully visible or mostly visible)
    if (y0 >= scrollY - rowH * 0.5 && y0 <= scrollY + viewH + rowH * 0.5) {
      const h12 = hour % 12 || 12;
      const ap  = hour >= 12 && hour < 24 ? 'PM' : 'AM';
      ctx.save();
      ctx.font = `${14*dpr}px 'IBM Plex Mono',monospace`;
      ctx.fillStyle = isNow ? T.accent : rgba(T.muted, .8);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`${h12}${ap}`, PAD + LEFT - 8*dpr, y0 + 6*dpr);
      ctx.restore();
    }

    // Hour line (full width)
    ctx.save();
    ctx.strokeStyle = rgba(T.border, isNow ? .6 : .4);
    ctx.lineWidth = 0.8 * dpr;
    ctx.beginPath(); ctx.moveTo(PAD + LEFT, y0); ctx.lineTo(w - PAD, y0);
    ctx.stroke(); ctx.restore();

    // 15-minute increment lines and labels
    ctx.save();
    ctx.font = `${9*dpr}px 'IBM Plex Mono',monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let q = 1; q <= 3; q++) {
      const qy = y0 + (q * 0.25) * rowH;
      if (qy < scrollY - 10*dpr || qy > scrollY + viewH + 10*dpr) continue;
      const min = q * 15;
      ctx.strokeStyle = rgba(T.dim, .5);
      ctx.lineWidth = 0.8 * dpr;
      ctx.beginPath();
      ctx.moveTo(PAD + LEFT + 20*dpr, qy);
      ctx.lineTo(w - PAD, qy);
      ctx.stroke();
      ctx.fillStyle = rgba(T.muted, .8);
      ctx.fillText(`:${min}`, PAD + LEFT - 6*dpr, qy);
    }
    ctx.restore();

    // Ghost time block for pending drop at this hour
    if (pending && Math.floor(pending.hour / 60) === hour) {
      const task = pending.task;
      const ghostW = Math.min(320 * dpr, w - PAD * 2 - LEFT - 16*dpr);
      const ghostH = rowH * 0.75;
      const gx = PAD + LEFT + 8*dpr;
      const gy = y0 + rowH * 0.12;
      // Skip if ghost is outside visible viewport (with tolerance buffer)
      if (gy + ghostH < scrollY - 10*dpr || gy > scrollY + viewH + 10*dpr) continue;
      const pulse = .5 + .5 * Math.sin(t * 2.5);

      // Ghost card background - cleaner, subtle
      ctx.save();
      rrect(ctx, gx, gy, ghostW, ghostH, 4*dpr);
      ctx.fillStyle = rgba(T.card, .9);
      ctx.fill();
      ctx.strokeStyle = rgba(task.goalColor, .5 + pulse * .2);
      ctx.lineWidth = 1.5 * dpr;
      ctx.setLineDash([6*dpr, 3*dpr]);
      ctx.stroke(); ctx.setLineDash([]);
      // Left accent bar
      ctx.fillStyle = rgba(task.goalColor, .6);
      ctx.fillRect(gx, gy, 3*dpr, ghostH);
      ctx.restore();

      // Type badge - compact, top right
      const badgeText = task.type === 'subtask' ? 'Subtask' : 'Checkpoint';
      const badgeColor = task.type === 'subtask' ? T.blue : T.purple;
      ctx.save();
      ctx.font = `500 ${6*dpr}px 'IBM Plex Mono',monospace`;
      const badgeW = ctx.measureText(badgeText).width + 8*dpr;
      const badgeX = gx + ghostW - badgeW - 70*dpr;
      const badgeY = gy + 5*dpr;
      rrect(ctx, badgeX, badgeY, badgeW, 11*dpr, 2*dpr);
      ctx.fillStyle = rgba(badgeColor, .15);
      ctx.fill();
      ctx.strokeStyle = rgba(badgeColor, .4);
      ctx.lineWidth = 0.5*dpr; ctx.stroke();
      ctx.fillStyle = badgeColor;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, badgeX + 4*dpr, badgeY + 5.5*dpr);
      ctx.restore();

      // Task title - single line, clean
      ctx.save();
      ctx.font = `500 ${10*dpr}px 'Syne',sans-serif`;
      ctx.fillStyle = T.text;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const titleMax = Math.floor((ghostW - 90*dpr) / (5.5*dpr));
      const title = task.title.length > titleMax ? task.title.slice(0, titleMax-1) + '…' : task.title;
      ctx.fillText(title, gx + 10*dpr, gy + ghostH/2 - 2*dpr);
      ctx.restore();

      // Goal name - smaller, below title
      ctx.save();
      ctx.font = `${6*dpr}px 'IBM Plex Mono',monospace`;
      ctx.fillStyle = rgba(task.goalColor, .7);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const goalText = `in ${task.goalTitle}`;
      const goalMax = Math.floor((ghostW - 90*dpr) / (3.5*dpr));
      const goalLabel = goalText.length > goalMax ? goalText.slice(0, goalMax-2) + '…' : goalText;
      ctx.fillText(goalLabel, gx + 10*dpr, gy + ghostH/2 + 10*dpr);
      ctx.restore();

      // Button area - right side, cleaner
      const btnY = gy + ghostH/2;
      const btnR = 11 * dpr;

      // Cancel button (X) - left of confirm
      const canX = gx + ghostW - btnR - 34*dpr;
      ctx.save();
      ctx.beginPath(); ctx.arc(canX, btnY, btnR, 0, Math.PI*2);
      ctx.fillStyle = rgba(T.muted, .08);
      ctx.fill();
      ctx.strokeStyle = rgba(T.muted, .35);
      ctx.lineWidth = 0.8*dpr; ctx.stroke();
      // X icon
      ctx.beginPath();
      ctx.moveTo(canX - 3*dpr, btnY - 3*dpr); ctx.lineTo(canX + 3*dpr, btnY + 3*dpr);
      ctx.moveTo(canX + 3*dpr, btnY - 3*dpr); ctx.lineTo(canX - 3*dpr, btnY + 3*dpr);
      ctx.strokeStyle = rgba(T.muted, .6);
      ctx.lineWidth = 1.2*dpr; ctx.lineCap = 'round'; ctx.stroke();
      ctx.restore();

      // Confirm button (checkmark) - rightmost
      const btnX = gx + ghostW - btnR - 10*dpr;
      ctx.save();
      ctx.beginPath(); ctx.arc(btnX, btnY, btnR, 0, Math.PI*2);
      ctx.fillStyle = rgba(T.green, .12);
      ctx.fill();
      ctx.strokeStyle = rgba(T.green, .5);
      ctx.lineWidth = 1*dpr; ctx.stroke();
      // Checkmark icon
      ctx.beginPath();
      ctx.moveTo(btnX - 4*dpr, btnY);
      ctx.lineTo(btnX - 1*dpr, btnY + 3*dpr);
      ctx.lineTo(btnX + 5*dpr, btnY - 4*dpr);
      ctx.strokeStyle = T.green;
      ctx.lineWidth = 1.8*dpr; ctx.lineCap = 'round'; ctx.stroke();
      ctx.restore();

      // Hit areas for confirm/cancel buttons (in CSS px)
      hitAreas.push({ id: 'confirm-drop', x: (btnX-btnR)/dpr, y: (btnY-btnR)/dpr, w: (btnR*2)/dpr, h: (btnR*2)/dpr });
      hitAreas.push({ id: 'cancel-drop',  x: (canX-btnR)/dpr, y: (btnY-btnR)/dpr, w: (btnR*2)/dpr, h: (btnR*2)/dpr });

      // Store pending drop info on the hit areas ref for click handling
      if (!hitAreas.pendingDropInfo) hitAreas.pendingDropInfo = pending;
    }

    // Task cards for this hour
    // item.hour is stored as total minutes (e.g. 480 = 8:00 AM)
    // item.duration is stored as minutes (default 60)
    const hourItems = items.filter(it => Math.floor(it.hour / 60) === hour);
    if (hourItems.length) {
      const cardW = (w - PAD * 2 - LEFT) / hourItems.length;
      hourItems.forEach((item, ii) => {
        const minuteOffset = item.hour % 60;
        const minuteFrac   = minuteOffset / 60;
        const durationMinutes = item.duration || 60; // default 60 min duration
        const durationFrac = durationMinutes / 60;
        const cx = PAD + LEFT + ii * cardW + 3 * dpr;
        const cy = y0 + minuteFrac * rowH + 3 * dpr;
        const cw = cardW - 6 * dpr;
        const ch = durationFrac * rowH - 6 * dpr;
        // Skip if card is outside visible viewport (with tolerance buffer)
        if (cy + ch < scrollY - 10*dpr || cy > scrollY + viewH + 10*dpr) return;

        // If this item is being dragged, skip rendering at original position
        // (it will be rendered at the dragged position below)
        if (onwardDrag && onwardDrag.itemId === item.id) return;

        // Look up goal color from projects by goalId (fallback to T.blue)
        const projects = projectsRef?.current || [];
        const goalProj = item.goalId ? projects.find(p => p.id === item.goalId) : null;
        const color = goalProj?.color || T.blue;

        ctx.save();
        rrect(ctx, cx, cy, cw, ch, 4 * dpr);
        ctx.fillStyle = rgba(color, item.done ? .06 : .12);
        ctx.fill();
        ctx.strokeStyle = rgba(color, item.done ? .2 : .45);
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();
        ctx.restore();

        // Type badge with distinct colors: Task=blue, Subtask=purple, Checkpoint=green
        const typeLabel = !item.linkedType ? 'TASK' : (item.linkedType === 'subtask' ? 'SUBTASK' : 'CHECKPOINT');
        const typeColor = !item.linkedType ? T.blue : (item.linkedType === 'subtask' ? T.purple : T.green);
        ctx.save();
        ctx.font = `600 ${5.5*dpr}px 'IBM Plex Mono',monospace`;
        const typeW = ctx.measureText(typeLabel).width + 8*dpr;
        const typeH = 11 * dpr;
        const typeX = cx + cw - typeW - 4*dpr;
        const typeY = cy + 3*dpr;
        rrect(ctx, typeX, typeY, typeW, typeH, 2*dpr);
        ctx.fillStyle = rgba(typeColor, .15);
        ctx.fill();
        ctx.strokeStyle = rgba(typeColor, .4);
        ctx.lineWidth = 0.5*dpr; ctx.stroke();
        ctx.fillStyle = typeColor;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(typeLabel, typeX + 4*dpr, typeY + 5.5*dpr);
        ctx.restore();

        // Parent goal title for subtasks (shown below the type badge)
        if (item.linkedType === 'subtask' && goalProj) {
          ctx.save();
          ctx.font = `${5.5*dpr}px 'IBM Plex Mono',monospace`;
          ctx.fillStyle = rgba(color, .6);
          ctx.textAlign = 'right'; ctx.textBaseline = 'top';
          const parentLabel = `← ${goalProj.title}`;
          const parentMax = Math.floor((cw - 12*dpr) / (3.2*dpr));
          const parentText = parentLabel.length > parentMax ? parentLabel.slice(0, parentMax-2) + '…' : parentLabel;
          ctx.fillText(parentText, cx + cw - 4*dpr, typeY + typeH + 2*dpr);
          ctx.restore();
        }

        // Title
        const maxChars = Math.floor(cw / (6.5*dpr));
        const label = item.title.length > maxChars ? item.title.slice(0, maxChars-1) + '…' : item.title;
        ctx.save();
        ctx.font = `${8*dpr}px 'IBM Plex Mono',monospace`;
        ctx.fillStyle = item.done ? rgba(color, .35) : color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        if (item.done) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(cx + 6*dpr, cy + ch/2 - 4*dpr, Math.min(cw-12*dpr, ctx.measureText(label).width), 8*dpr);
          ctx.clip();
        }
        ctx.fillText(label, cx + 6*dpr, cy + ch/2);
        if (item.done) ctx.restore();
        ctx.restore();

        // Duration label (bottom-right corner)
        ctx.save();
        ctx.font = `${6*dpr}px 'IBM Plex Mono',monospace`;
        ctx.fillStyle = rgba(T.muted, .6);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${durationMinutes}m`, cx + cw - 4*dpr, cy + ch - 4*dpr);
        ctx.restore();

        // DEBUG: Resize handle at bottom of card (small drag bar)
        const resizeHandleH = 6 * dpr;
        const resizeHandleY = cy + ch - resizeHandleH;
        ctx.save();
        // DEBUG: If this item is currently being resized, paint handle red for visual feedback
        const isResizing = resizeDrag && resizeDrag.itemId === item.id;
        ctx.fillStyle = isResizing ? 'rgba(255,0,0,0.6)' : rgba(color, .25);
        rrect(ctx, cx + cw * 0.25, resizeHandleY, cw * 0.5, resizeHandleH, 2*dpr);
        ctx.fill();
        ctx.restore();

        // DEBUG: Log hit area registration for resize handles
        const hitAreaX = (cx + cw * 0.25)/dpr;
        const hitAreaY = resizeHandleY/dpr;
        const hitAreaW = (cw * 0.5)/dpr;
        const hitAreaH = resizeHandleH/dpr;
        console.log(`[DEBUG_RESIZE] drawPages: registering hitArea for item="${item.title}" id=resize:${item.id} x=${hitAreaX.toFixed(1)} y=${hitAreaY.toFixed(1)} w=${hitAreaW.toFixed(1)} h=${hitAreaH.toFixed(1)}`);

        // Store resize handle hit area FIRST so .find() matches it before the card body
        hitAreas.push({
          id: `resize:${item.id}`,
          x: hitAreaX,
          y: hitAreaY,
          w: hitAreaW,
          h: hitAreaH,
          resizeItemId: item.id,
        });
        // Store hit area in CSS px (for the card body) — pushed second so .find() only matches it if no resize handle was hit
        hitAreas.push({ id: item.id, x: cx/dpr, y: cy/dpr, w: cw/dpr, h: ch/dpr });
      });
    }
  }

  // ── Render dragged card at offset position ──
  if (onwardDrag) {
    const draggedItem = items.find(it => it.id === onwardDrag.itemId);
    if (draggedItem) {
      const minuteOffset = draggedItem.hour % 60;
      const minuteFrac = minuteOffset / 60;
      const durationMinutes = draggedItem.duration || 60;
      const durationFrac = durationMinutes / 60;

      // Calculate original position
      const origHour = Math.floor(draggedItem.hour / 60);
      const origY0 = getY(origHour);
      const origCy = origY0 + minuteFrac * rowH + 3 * dpr;

      // Apply drag offset (convert CSS pixels to canvas pixels)
      const dragOffsetCanvas = onwardDrag.offsetY * dpr;
      const draggedCy = origCy + dragOffsetCanvas;

      // Clamp to prevent dragging above 6am or below midnight
      const minY = getY(ROW_START) + 3 * dpr;
      const maxY = getY(ROW_END) - durationFrac * rowH - 3 * dpr;
      const clampedCy = Math.max(minY, Math.min(maxY, draggedCy));

      // Calculate card dimensions (same as normal rendering)
      const hourItemsForWidth = items.filter(it => Math.floor(it.hour / 60) === origHour);
      const cardW = (w - PAD * 2 - LEFT) / Math.max(hourItemsForWidth.length, 1);
      const cx = PAD + LEFT + 3 * dpr;
      const cw = cardW - 6 * dpr;
      const ch = durationFrac * rowH - 6 * dpr;

      // Skip if outside viewport
      if (clampedCy + ch >= scrollY - 10*dpr && clampedCy <= scrollY + viewH + 10*dpr) {
        // Look up goal color
        const projects = projectsRef?.current || [];
        const goalProj = draggedItem.goalId ? projects.find(p => p.id === draggedItem.goalId) : null;
        const color = goalProj?.color || T.blue;

        // Draw card with slight transparency to indicate drag state
        ctx.save();
        ctx.globalAlpha = 0.85;
        rrect(ctx, cx, clampedCy, cw, ch, 4 * dpr);
        ctx.fillStyle = rgba(color, 0.18);
        ctx.fill();
        ctx.strokeStyle = rgba(color, 0.7);
        ctx.lineWidth = 1.5 * dpr;
        ctx.setLineDash([4*dpr, 3*dpr]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Draw title (simplified for drag state)
        const maxChars = Math.floor(cw / (6.5*dpr));
        const label = draggedItem.title.length > maxChars ? draggedItem.title.slice(0, maxChars-1) + '…' : draggedItem.title;
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.font = `${8*dpr}px 'IBM Plex Mono',monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx + 6*dpr, clampedCy + ch/2);
        ctx.restore();

        // Draw a subtle "ghost" at the original position to show where it came from
        ctx.save();
        ctx.globalAlpha = 0.2;
        rrect(ctx, cx, origCy, cw, ch, 4 * dpr);
        ctx.fillStyle = rgba(color, 0.1);
        ctx.fill();
        ctx.strokeStyle = rgba(color, 0.2);
        ctx.lineWidth = 1 * dpr;
        ctx.setLineDash([3*dpr, 3*dpr]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Register hit area at the dragged position
      hitAreas.push({ id: draggedItem.id, x: cx/dpr, y: clampedCy/dpr, w: cw/dpr, h: ch/dpr });
    }
  }

  onwardHitAreasRef.current = hitAreas;
}

// ── Map page ──────────────────────────────────────────────────────────────────
export function drawMapPage(ctx, dpr, w, h, t, refs) {
  const { projectsRef, hoveredWeekRef, mapWeekRectsRef } = refs;
  const weekRects = [];
  const PAD  = 20 * dpr;
  const now  = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const firstDow   = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const numWeeks   = Math.ceil((firstDow + daysInMonth) / 7);
  const projs      = projectsRef.current;
  const hovWk      = hoveredWeekRef.current;

  // Page heading
  const monthName = now.toLocaleString('default', { month:'long' }).toUpperCase();
  ctx.save();
  ctx.font = `700 ${13*dpr}px 'Syne',sans-serif`;
  ctx.fillStyle = T.accent;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('MAP  ·  ' + monthName + ' ' + year, PAD, PAD * 0.4);
  ctx.restore();

  const topPad = 28 * dpr;
  const calW   = (w - PAD*2) * 0.75;
  const tierX  = PAD + calW + 8*dpr;
  const tierW  = w - tierX - PAD;

  // Day-of-week headers
  const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const cellW = calW / 7;
  DOW.forEach((d, i) => {
    ctx.save();
    ctx.font = `${7*dpr}px 'IBM Plex Mono',monospace`;
    ctx.fillStyle = rgba(T.muted, .6);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(d, PAD + (i + 0.5) * cellW, PAD + topPad);
    ctx.restore();
  });

  // Compute row heights (hovered gets 1.6x)
  const rowAreaH = h - PAD*2 - topPad - 16*dpr;
  const baseH    = rowAreaH / (numWeeks * (hovWk !== null ? (1 + 0.6 / numWeeks) : 1));
  const rowHeights = Array.from({ length: numWeeks }, (_, wi) =>
    wi === hovWk ? baseH * 1.6 : baseH
  );
  // Normalize so sum = rowAreaH
  const sum = rowHeights.reduce((a,b) => a+b, 0);
  const scale = rowAreaH / sum;
  const normH = rowHeights.map(r => r * scale);

  let rowY = PAD + topPad + 16*dpr;
  let dayNum = 1 - firstDow;

  normH.forEach((rh, wi) => {
    weekRects.push({ weekIdx: wi, y: rowY/dpr, h: rh/dpr });
    const isHov = wi === hovWk;

    // Week row background if hovered
    if (isHov) {
      ctx.save();
      ctx.fillStyle = rgba(T.accent, .03);
      ctx.fillRect(PAD, rowY, calW, rh);
      ctx.restore();
    }

    for (let dow = 0; dow < 7; dow++) {
      const dn = dayNum + dow;
      if (dn < 1 || dn > daysInMonth) { continue; }
      const cx = PAD + dow * cellW;
      const cy = rowY;
      const isToday = dn === today;

      // Today ring
      if (isToday) {
        ctx.save();
        ctx.strokeStyle = T.accent;
        ctx.lineWidth = 1.5 * dpr;
        rrect(ctx, cx + 2*dpr, cy + 2*dpr, cellW - 4*dpr, rh - 4*dpr, 4*dpr);
        ctx.stroke();
        ctx.restore();
      }

      // Day number
      ctx.save();
      ctx.font = `${(isHov ? 10 : 8)*dpr}px 'IBM Plex Mono',monospace`;
      ctx.fillStyle = isToday ? T.accent : rgba(T.text, .7);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(dn), cx + cellW/2, cy + 5*dpr);
      ctx.restore();

      // Deadline dot
      const hasDeadline = projs.some(p => {
        if (!p.deadline) return false;
        const pd = new Date(p.deadline);
        return pd.getFullYear()===year && pd.getMonth()===month && pd.getDate()===dn;
      });
      if (hasDeadline) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx + cellW/2, cy + rh - 7*dpr, 2.5*dpr, 0, Math.PI*2);
        ctx.fillStyle = rgba(T.accent, .8);
        ctx.fill();
        ctx.restore();
      }
    }

    // Tier panel for this week (always visible, full detail on hover)
    const wkStart = new Date(year, month, dayNum);
    const wkEnd   = new Date(year, month, dayNum + 6);
    const highGoals = projs.filter(p => p.priority==='high' && p.deadline && (() => { const d=new Date(p.deadline); return d>=wkStart&&d<=wkEnd; })());
    const lowGoals  = projs.filter(p => p.priority!=='high' && p.deadline && (() => { const d=new Date(p.deadline); return d>=wkStart&&d<=wkEnd; })());
    const overdueGoals = projs.filter(p => {
      if (!p.deadline) return false;
      const d=new Date(p.deadline);
      const tot=p.subtasks.length+p.checkpoints.length;
      const dn=p.subtasks.filter(s=>s.done).length+p.checkpoints.filter(c=>c.done).length;
      return d < wkStart && dn < tot;
    });

    if (isHov) {
      // Full detail in tier panel
      let ty = rowY + 4*dpr;
      const drawTier = (items, color, label) => {
        if (!items.length) return;
        ctx.save();
        ctx.font = `${7*dpr}px 'IBM Plex Mono',monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(label, tierX, ty); ty += 12*dpr;
        ctx.restore();
        items.forEach(p => {
          const pct = progress(p);
          const label2 = p.title.length > 14 ? p.title.slice(0,13)+'…' : p.title;
          ctx.save();
          ctx.font = `${8*dpr}px 'Syne',sans-serif`;
          ctx.fillStyle = T.text;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(label2, tierX, ty);
          ctx.restore();
          ty += 11*dpr;
          // mini progress bar
          ctx.save();
          ctx.fillStyle = T.dim;
          ctx.fillRect(tierX, ty, tierW, 2*dpr);
          ctx.fillStyle = p.color;
          ctx.fillRect(tierX, ty, tierW * pct/100, 2*dpr);
          ctx.restore();
          ty += 7*dpr;
        });
      };
      drawTier(highGoals,   T.rose,  'HIGH');
      drawTier(lowGoals,    T.blue,  'LOW');
      drawTier(overdueGoals, T.muted, 'OVERDUE');
    } else {
      // Compact dots
      let dotX = tierX;
      const dotY = rowY + rh/2;
      [[highGoals, T.rose], [lowGoals, T.blue], [overdueGoals, T.muted]].forEach(([items, color]) => {
        if (!items.length) return;
        ctx.save();
        ctx.beginPath(); ctx.arc(dotX + 3*dpr, dotY, 3*dpr, 0, Math.PI*2);
        ctx.fillStyle = rgba(color, .7); ctx.fill();
        ctx.font = `${7*dpr}px 'IBM Plex Mono',monospace`;
        ctx.fillStyle = rgba(color, .7);
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(items.length, dotX + 9*dpr, dotY);
        ctx.restore();
        dotX += 20*dpr;
      });
    }

    rowY += rh;
    dayNum += 7;
  });

  mapWeekRectsRef.current = weekRects;

  // Tier panel divider line
  ctx.save();
  ctx.strokeStyle = rgba(T.border, .4);
  ctx.lineWidth = 0.5 * dpr;
  ctx.beginPath();
  ctx.moveTo(tierX - 6*dpr, PAD + topPad + 16*dpr);
  ctx.lineTo(tierX - 6*dpr, h - PAD);
  ctx.stroke();
  ctx.restore();
}

// ── Paths page ────────────────────────────────────────────────────────────────
export function drawPathsPage(ctx, dpr, w, h, t, refs) {
  const { projectsRef, selectedIdRef, pathsHitAreasRef } = refs;
  const hitAreas = [];
  const PAD  = 24 * dpr;
  const projs = projectsRef.current.filter(p => p.scale === 'medium' || p.scale === 'long');
  const selId = selectedIdRef.current;

  // Heading
  ctx.save();
  ctx.font = `700 ${13*dpr}px 'Syne',sans-serif`;
  ctx.fillStyle = T.accent;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('PATHS', PAD, PAD * 0.4);
  ctx.restore();

  if (!projs.length) {
    ctx.save();
    ctx.font = `${11*dpr}px 'IBM Plex Mono',monospace`;
    ctx.fillStyle = T.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No medium or long-term goals yet.', w/2, h/2 - 10*dpr);
    ctx.font = `${9*dpr}px 'IBM Plex Mono',monospace`;
    ctx.fillText('Set Horizon to Medium or Long in New Goal.', w/2, h/2 + 10*dpr);
    ctx.restore();
    pathsHitAreasRef.current = hitAreas;
    return;
  }

  const topPad = 28 * dpr;
  const colW = (w - PAD*3) / 2;
  const medium = projs.filter(p => p.scale === 'medium');
  const long   = projs.filter(p => p.scale === 'long');

  const CARD_H = 90 * dpr;
  const CARD_GAP = 10 * dpr;

  const drawCol = (items, colX, colLabel) => {
    // Column header
    ctx.save();
    ctx.font = `${8*dpr}px 'IBM Plex Mono',monospace`;
    ctx.fillStyle = rgba(T.muted, .7);
    ctx.letterSpacing = '.14em';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(colLabel, colX, PAD + topPad - 16*dpr);
    ctx.restore();

    items.forEach((p, ci) => {
      const cy = PAD + topPad + ci * (CARD_H + CARD_GAP);
      const pct = progress(p);
      const isSel = p.id === selId;

      if (isSel) drawGlow(ctx, colX + colW/2, cy + CARD_H/2, CARD_H/2, p.color, .12);

      // Card background
      ctx.save();
      rrect(ctx, colX, cy, colW, CARD_H, 8*dpr);
      ctx.fillStyle = T.card;
      ctx.fill();
      ctx.strokeStyle = isSel ? rgba(p.color, .7) : rgba(T.border, .7);
      ctx.lineWidth = isSel ? 1.5*dpr : 1*dpr;
      ctx.stroke();
      ctx.restore();

      // Color accent bar (left edge)
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.fillRect(colX, cy + 8*dpr, 3*dpr, CARD_H - 16*dpr);
      ctx.restore();

      // Title
      const titleLabel = p.title.length > 18 ? p.title.slice(0,17)+'…' : p.title;
      ctx.save();
      ctx.font = `700 ${10*dpr}px 'Syne',sans-serif`;
      ctx.fillStyle = p.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(titleLabel, colX + 12*dpr, cy + 10*dpr);
      ctx.restore();

      // Progress bar
      const barX = colX + 12*dpr;
      const barY = cy + 30*dpr;
      const barW = colW - 24*dpr;
      ctx.save();
      ctx.fillStyle = T.dim;
      rrect(ctx, barX, barY, barW, 3*dpr, 2*dpr);
      ctx.fill();
      if (pct > 0) {
        ctx.fillStyle = p.color;
        rrect(ctx, barX, barY, barW * pct/100, 3*dpr, 2*dpr);
        ctx.fill();
      }
      ctx.restore();

      // Subtask ratio
      const tot  = p.subtasks.length + p.checkpoints.length;
      const done = p.subtasks.filter(s=>s.done).length + p.checkpoints.filter(c=>c.done).length;
      ctx.save();
      ctx.font = `${7*dpr}px 'IBM Plex Mono',monospace`;
      ctx.fillStyle = rgba(T.muted, .7);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${done}/${tot} tasks · ${pct}%`, colX + 12*dpr, cy + 42*dpr);
      ctx.restore();

      // Days-left badge
      if (p.deadline) {
        const dl = Math.ceil((new Date(p.deadline) - new Date()) / 86400000);
        const dlColor = dl < 0 ? T.rose : dl < 7 ? T.rose : dl < 21 ? T.accent : T.muted;
        const dlLabel = dl < 0 ? 'overdue' : dl === 0 ? 'due today' : `${dl}d left`;
        ctx.save();
        ctx.font = `${7*dpr}px 'IBM Plex Mono',monospace`;
        ctx.fillStyle = dlColor;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(dlLabel, colX + colW - 8*dpr, cy + 10*dpr);
        ctx.restore();
      }

      // Hit area in CSS px
      hitAreas.push({ id: p.id, x: colX/dpr, y: cy/dpr, w: colW/dpr, h: CARD_H/dpr });
    });
  };

  drawCol(medium, PAD,          'MEDIUM TERM');
  drawCol(long,   PAD*2+colW,   'LONG TERM');

  pathsHitAreasRef.current = hitAreas;
}

// ── Skills page ─────────────────────────────────────────────────────────
export function drawSkillsPage(ctx, dpr, w, h, t, refs) {
  const { skillsRef, selectedSkillRef, skillsHitAreasRef } = refs;
  const hitAreas = [];
  const PAD  = 24 * dpr;
  const skills = skillsRef.current;
  const selId = selectedSkillRef.current;

  // Heading
  ctx.save();
  ctx.font = `700 ${13*dpr}px 'Syne',sans-serif`;
  ctx.fillStyle = T.accent;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('SKILLS', PAD, PAD * 0.4);
  ctx.restore();

  if (!skills.length) {
    ctx.save();
    ctx.font = `${11*dpr}px 'IBM Plex Mono',monospace`;
    ctx.fillStyle = T.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No skills added yet.', w/2, h/2);
    ctx.restore();
    skillsHitAreasRef.current = hitAreas;
    return;
  }

  const topPad = 28 * dpr;
  const gap = 10 * dpr;
  const cardW = (w - PAD * 3) / 2;
  const cardH = 80 * dpr;

  skills.forEach((group, gi) => {
    const col = gi % 2;
    const row = Math.floor(gi / 2);
    const cx = PAD + col * (cardW + gap);
    const cy = PAD + topPad + row * (cardH + gap);

    // Card background
    ctx.save();
    rrect(ctx, cx, cy, cardW, cardH, 8*dpr);
    ctx.fillStyle = T.card;
    ctx.fill();
    ctx.strokeStyle = selId === group.id ? rgba(group.color, .7) : rgba(T.border, .7);
    ctx.lineWidth = selId === group.id ? 1.5*dpr : 1*dpr;
    ctx.stroke();
    ctx.restore();

    // Color accent bar
    ctx.save();
    ctx.fillStyle = group.color;
    ctx.fillRect(cx, cy + 6*dpr, 3*dpr, cardH - 12*dpr);
    ctx.restore();

    // Group name
    ctx.save();
    ctx.font = `700 ${10*dpr}px 'Syne',sans-serif`;
    ctx.fillStyle = group.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(group.name, cx + 12*dpr, cy + 8*dpr);
    ctx.restore();

    // Subskills as dots
    const dotSize = 5 * dpr;
    const dotGap = 14 * dpr;
    group.subskills.forEach((ss, si) => {
      const dx = cx + 12*dpr + si * dotGap;
      const dy = cy + cardH - 14*dpr;
      ctx.save();
      ctx.beginPath();
      ctx.arc(dx, dy, dotSize, 0, Math.PI*2);
      ctx.fillStyle = rgba(group.color, .15 + ss.level * .07);
      ctx.fill();
      ctx.strokeStyle = rgba(group.color, .4);
      ctx.lineWidth = 0.8*dpr;
      ctx.stroke();
      // Subskill initial
      ctx.font = `500 ${5*dpr}px 'IBM Plex Mono',monospace`;
      ctx.fillStyle = rgba(group.color, .7);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ss.name[0], dx, dy);
      ctx.restore();
    });

    // Hit area
    hitAreas.push({ id: group.id, x: cx/dpr, y: cy/dpr, w: cardW/dpr, h: cardH/dpr });
  });

  skillsHitAreasRef.current = hitAreas;
}

// ── Goals page ──────────────────────────────────────────────────────────────
export function drawGoalsPage(ctx, dpr, w, h, t, refs) {
  const { projectsRef, selectedIdRef, panRef, draggingRef, goalHitAreasRef, topGoalsRef, goalDragRef } = refs;
  const hitAreas = [];
  const projs = projectsRef.current.filter(p => !p.completedAt);
  const selId = selectedIdRef.current;
  const pan = panRef.current;
  const drag = draggingRef.current;
  const topGoalIds = topGoalsRef?.current || [];
  const gd = goalDragRef?.current;

  // ── Background nebula glow ──────────────────────────────────────────
  if (projs.length > 0) {
    // Compute bounding box of all goals
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    projs.forEach((p, i) => {
      const pos = p.pos || { x: 240 + i * 440, y: 270 };
      const px = pos.x + pan.x * dpr;
      const py = pos.y + pan.y * dpr;
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
    });
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const nebulaR = Math.max(maxX - minX, maxY - minY) * 0.8 + 200 * dpr;

    // Subtle purple-blue nebula glow behind goals
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, nebulaR);
    grd.addColorStop(0, 'rgba(155,121,232,0.04)');
    grd.addColorStop(0.4, 'rgba(83,170,255,0.025)');
    grd.addColorStop(1, 'rgba(155,121,232,0)');
    ctx.save();
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // ── Constellation lines between nearby goals ────────────────────────
  if (projs.length >= 2) {
    const positions = projs.map((p, i) => {
      const pos = p.pos || { x: 240 + i * 440, y: 270 };
      return { x: pos.x + pan.x * dpr, y: pos.y + pan.y * dpr, color: p.color };
    });
    // Connect goals that are within 600px of each other
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 600 * dpr) {
          const alpha = Math.max(0, 0.12 * (1 - dist / (600 * dpr)));
          const twinkle = 0.6 + 0.4 * Math.sin(t * 0.5 + i * 2.3 + j * 1.7);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(positions[i].x, positions[i].y);
          ctx.lineTo(positions[j].x, positions[j].y);
          ctx.strokeStyle = `rgba(214,226,245,${alpha * twinkle})`;
          ctx.lineWidth = 0.5 * dpr;
          ctx.setLineDash([3 * dpr, 6 * dpr]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
    }
  }

  // Heading
  ctx.save();
  ctx.font = `700 ${13*dpr}px 'Syne',sans-serif`;
  ctx.fillStyle = T.accent;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('GOALS', 24*dpr, 10*dpr);
  ctx.restore();

  if (!projs.length) {
    // Empty state
    ctx.save();
    ctx.font = `${11*dpr}px 'IBM Plex Mono',monospace`;
    ctx.fillStyle = T.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No goals yet — create one to see it here.', w/2, h/2);
    ctx.restore();
    goalHitAreasRef.current = hitAreas;
    return;
  }

  // ── Floating space dust particles ───────────────────────────────────
  // Deterministic particles based on goal positions for visual depth
  projs.forEach((p, i) => {
    const pos = p.pos || { x: 240 + i * 440, y: 270 };
    const px = pos.x + pan.x * dpr;
    const py = pos.y + pan.y * dpr;
    // Scatter tiny dots around each goal
    for (let d = 0; d < 4; d++) {
      const angle = t * 0.3 + i * 1.8 + d * 1.2;
      const rad = (40 + d * 12) * dpr;
      const dx = Math.cos(angle) * rad;
      const dy = Math.sin(angle * 0.7) * rad * 0.5;
      const dotSize = (0.8 + 0.4 * Math.sin(t * 0.5 + i + d)) * dpr;
      ctx.save();
      ctx.beginPath();
      ctx.arc(px + dx, py + dy, dotSize, 0, Math.PI * 2);
      ctx.fillStyle = rgba(p.color, 0.08 + 0.06 * Math.sin(t + i + d));
      ctx.fill();
      ctx.restore();
    }
  });

  // Draw each goal as a static, draggable node
  projs.forEach((p, i) => {
    const pos = p.pos || { x: 240 + i * 440, y: 270 };
    // Apply drag offset if this goal is being dragged
    const dragOffX = (gd && gd.id === p.id) ? gd.offsetX : 0;
    const dragOffY = (gd && gd.id === p.id) ? gd.offsetY : 0;
    const px = pos.x + pan.x * dpr + dragOffX;
    const py = pos.y + pan.y * dpr + dragOffY;
    const nodeR = 28 * dpr; // Fixed node radius
    const isSel = p.id === selId;
    const isTopGoal = topGoalIds.includes(p.id);
    const pct = progress(p) / 100;
    const hasSubtasks = (p.subtasks?.length || 0) > 0 || (p.checkpoints?.length || 0) > 0;
    const isComplete = !!p.completedAt;

    // Glow if selected
    if (isSel) drawGlow(ctx, px, py, nodeR * 1.5, p.color, .15);

    // Top goal ring (outer ring) with orbiting dots
    if (isTopGoal) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, nodeR + 6*dpr, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(p.color, .6);
      ctx.lineWidth = 3*dpr;
      ctx.stroke();
      ctx.restore();

      // Orbiting moonlets around top goals
      for (let m = 0; m < 3; m++) {
        const orbitAngle = t * 0.8 + m * Math.PI * 2 / 3 + i * 0.5;
        const orbitR = (nodeR + 16 * dpr) + 4 * dpr * Math.sin(t * 0.3 + m);
        const mx = px + Math.cos(orbitAngle) * orbitR;
        const my = py + Math.sin(orbitAngle) * orbitR;
        const moonSize = (1.5 + 0.8 * Math.sin(t * 0.7 + m * 2)) * dpr;
        ctx.save();
        ctx.beginPath();
        ctx.arc(mx, my, moonSize, 0, Math.PI * 2);
        ctx.fillStyle = rgba(p.color, 0.3 + 0.2 * Math.sin(t + m));
        ctx.fill();
        ctx.restore();
      }
    }

    // Node body
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, nodeR, 0, Math.PI * 2);
    ctx.fillStyle = rgba(p.color, .15);
    ctx.fill();
    ctx.strokeStyle = isSel ? p.color : rgba(p.color, .5);
    ctx.lineWidth = isSel ? 2*dpr : 1*dpr;
    ctx.stroke();
    ctx.restore();

    // Progress arc
    if (pct > 0) drawProgressArc(ctx, px, py, nodeR + 3*dpr, pct, p.color, dpr);

    // Status indicator (complete checkmark or incomplete cross)
    if (isComplete) {
      // Green checkmark
      ctx.save();
      ctx.beginPath();
      ctx.arc(px + nodeR - 4*dpr, py - nodeR + 4*dpr, 6*dpr, 0, Math.PI * 2);
      ctx.fillStyle = T.green;
      ctx.fill();
      // Checkmark path
      ctx.strokeStyle = T.bg;
      ctx.lineWidth = 1.5*dpr;
      ctx.beginPath();
      ctx.moveTo(px + nodeR - 6*dpr, py - nodeR + 4*dpr);
      ctx.lineTo(px + nodeR - 4*dpr, py - nodeR + 6*dpr);
      ctx.lineTo(px + nodeR - 1*dpr, py - nodeR + 2*dpr);
      ctx.stroke();
      ctx.restore();
    } else if (!hasSubtasks) {
      // Red cross for incomplete (no sub-goals set)
      ctx.save();
      ctx.beginPath();
      ctx.arc(px + nodeR - 4*dpr, py - nodeR + 4*dpr, 6*dpr, 0, Math.PI * 2);
      ctx.fillStyle = T.rose;
      ctx.fill();
      // Cross path
      ctx.strokeStyle = T.bg;
      ctx.lineWidth = 1.5*dpr;
      ctx.beginPath();
      ctx.moveTo(px + nodeR - 6*dpr, py - nodeR + 2*dpr);
      ctx.lineTo(px + nodeR - 2*dpr, py - nodeR + 6*dpr);
      ctx.moveTo(px + nodeR - 2*dpr, py - nodeR + 2*dpr);
      ctx.lineTo(px + nodeR - 6*dpr, py - nodeR + 6*dpr);
      ctx.stroke();
      ctx.restore();
    }

    // Title label
    const label = p.title.length > 14 ? p.title.slice(0, 13) + '…' : p.title;
    ctx.save();
    ctx.font = `${7*dpr}px 'IBM Plex Mono',monospace`;
    ctx.fillStyle = isSel ? p.color : rgba(T.text, .6);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, px, py + nodeR + 5*dpr);
    ctx.restore();

    // Hit area (circle)
    hitAreas.push({ id: p.id, x: px/dpr, y: py/dpr, R: nodeR/dpr });
  });

  goalHitAreasRef.current = hitAreas;
}

