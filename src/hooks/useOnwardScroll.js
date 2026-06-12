import { useEffect } from 'react';

/**
 * Scrolls the Onward page canvas to center the current time when the page opens.
 */
export function useOnwardScroll(activePage, canvasRef, resizeRef) {
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
      const rowHeightPx = parent.clientHeight / VISIBLE_HOURS;
      const targetY = PAD + (curH - ROW_START) * rowHeightPx - (parent.clientHeight / 2) + (VISIBLE_HOURS * rowHeightPx / 2);
      const maxScroll = (TOTAL_ROWS + VISIBLE_HOURS) * rowHeightPx + PAD * 2 - parent.clientHeight;

      parent.scrollTo({ top: Math.max(0, Math.min(targetY, maxScroll)), behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, [activePage, canvasRef]);

  // Resize canvas when waypoint sidebar opens/closes (after CSS transition)
  useEffect(() => {
    if (activePage !== 'onward') return;
    const timer = setTimeout(() => {
      resizeRef.current?.();
    }, 450);
    return () => clearTimeout(timer);
  }, [activePage, resizeRef]);
}
