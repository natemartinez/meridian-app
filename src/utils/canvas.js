import { T } from './theme.js';

export function hexToRgb(hex) {
  return { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) };
}

export function rgba(hex, a) {
  const {r,g,b} = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function drawGlow(ctx, x, y, R, color, alpha) {
  const {r,g,b} = hexToRgb(color);
  const gr = ctx.createRadialGradient(x,y,0,x,y,R*3.2);
  gr.addColorStop(0,  `rgba(${r},${g},${b},${alpha})`);
  gr.addColorStop(.4, `rgba(${r},${g},${b},${alpha*.35})`);
  gr.addColorStop(1,  `rgba(${r},${g},${b},0)`);
  ctx.save(); ctx.beginPath(); ctx.arc(x,y,R*3.2,0,Math.PI*2);
  ctx.fillStyle=gr; ctx.fill(); ctx.restore();
}

export function drawProgressArc(ctx, x, y, R, pct, color, dpr) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x,y,R,-Math.PI/2,Math.PI*3/2);
  ctx.strokeStyle=rgba(color,.18); ctx.lineWidth=3*dpr; ctx.stroke();
  if (pct > 0) {
    ctx.beginPath(); ctx.arc(x,y,R,-Math.PI/2,-Math.PI/2+(Math.PI*2)*pct);
    ctx.strokeStyle=color; ctx.lineWidth=3*dpr; ctx.lineCap='round'; ctx.stroke();
  }
  ctx.restore();
}

export function drawSubtaskNode(ctx, x, y, R, color, done, dpr) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x,y,R,0,Math.PI*2);
  ctx.fillStyle = done ? rgba(color,.22) : T.card; ctx.fill();
  ctx.beginPath(); ctx.arc(x,y,R,0,Math.PI*2);
  ctx.strokeStyle = done ? color : rgba(color,.42);
  ctx.lineWidth = done ? 1.5*dpr : 1*dpr;
  if (!done) ctx.setLineDash([3*dpr,3*dpr]);
  ctx.stroke(); ctx.setLineDash([]);
  if (done) {
    ctx.beginPath();
    ctx.moveTo(x-4*dpr,y); ctx.lineTo(x-1*dpr,y+3*dpr); ctx.lineTo(x+5*dpr,y-3*dpr);
    ctx.strokeStyle=color; ctx.lineWidth=1.5*dpr; ctx.lineCap='round'; ctx.stroke();
  }
  ctx.restore();
}

export function drawCheckpointNode(ctx, x, y, sz, color, done, dpr) {
  ctx.save(); ctx.translate(x,y); ctx.rotate(Math.PI/4);
  ctx.beginPath(); ctx.rect(-sz/2,-sz/2,sz,sz);
  ctx.fillStyle = done ? rgba(color,.2) : T.card; ctx.fill();
  ctx.strokeStyle = done ? color : rgba(color,.45);
  ctx.lineWidth = 1.5*dpr; ctx.stroke();
  ctx.restore();
  if (done) {
    ctx.save(); ctx.beginPath();
    ctx.moveTo(x-3*dpr,y); ctx.lineTo(x-1*dpr,y+2*dpr); ctx.lineTo(x+4*dpr,y-3*dpr);
    ctx.strokeStyle=color; ctx.lineWidth=1.5*dpr; ctx.lineCap='round'; ctx.stroke(); ctx.restore();
  }
}

export function rrect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  } else {
    const rad = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rad, y);
    ctx.lineTo(x+w-rad, y);  ctx.quadraticCurveTo(x+w, y,   x+w, y+rad);
    ctx.lineTo(x+w, y+h-rad); ctx.quadraticCurveTo(x+w, y+h, x+w-rad, y+h);
    ctx.lineTo(x+rad, y+h);  ctx.quadraticCurveTo(x,   y+h, x,   y+h-rad);
    ctx.lineTo(x, y+rad);    ctx.quadraticCurveTo(x,   y,   x+rad, y);
    ctx.closePath();
  }
}
