// The HUD: health bar, money, wanted stars, speed, clock, mission objective,
// dialogue box, message banners and the minimap (streets, sea, player,
// mission marker, police and cars as dots).
import { FONT, SAND_X, VIEW_H, VIEW_W, WATER_X, WORLD_H, WORLD_W } from './config.js';
import { playerCar, playerPos, playerSpeed } from './state.js';

const MM_W = 216;
const MM_H = 216;
const MM_X = VIEW_W - MM_W - 16;
const MM_Y = 16;

function clockString(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function drawHUD(ctx, state) {
  ctx.textBaseline = 'alphabetic';
  // ---- Top-left: health, money, wanted stars.
  ctx.fillStyle = 'rgba(10, 14, 20, 0.62)';
  roundRect(ctx, 14, 14, 250, 108, 10);
  ctx.fill();
  ctx.font = `700 15px ${FONT}`;
  ctx.fillStyle = '#e8ecf0';
  ctx.textAlign = 'left';
  ctx.fillText('HEALTH', 28, 38);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, 96, 26, 150, 14, 7);
  ctx.fill();
  const hpFrac = Math.max(0, state.player.hp / state.player.maxHp);
  ctx.fillStyle = hpFrac > 0.5 ? '#2ecc71' : hpFrac > 0.25 ? '#f39c12' : '#e74c3c';
  roundRect(ctx, 96, 26, 150 * hpFrac, 14, 7);
  ctx.fill();
  ctx.font = `800 26px ${FONT}`;
  ctx.fillStyle = '#7dff9b';
  ctx.fillText(`$${state.money}`, 28, 76);
  // Wanted stars.
  for (let i = 0; i < 5; i += 1) {
    drawStar(ctx, 30 + i * 26, 100, 11, i < state.wanted ? '#ffd21f' : 'rgba(255,255,255,0.22)');
  }

  // ---- Top-centre: mission objective.
  if (state.mission.text) {
    ctx.font = `600 16px ${FONT}`;
    const w = ctx.measureText(state.mission.text).width + 36;
    const x = (VIEW_W - w) / 2;
    ctx.fillStyle = 'rgba(10, 14, 20, 0.62)';
    roundRect(ctx, x, 14, w, 34, 10);
    ctx.fill();
    ctx.fillStyle = '#ffe27a';
    ctx.textAlign = 'center';
    ctx.fillText(state.mission.text, VIEW_W / 2, 37);
  }

  // ---- Clock, bottom-left: speed + context hint.
  ctx.font = `700 20px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(clockString(state.timeMinutes), 28, VIEW_H - 58);
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('Solmar Bay', 28, VIEW_H - 34);
  const car = playerCar(state);
  const speedKmh = Math.round((playerSpeed(state) / 560) * 180);
  ctx.font = `800 30px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.fillText(`${speedKmh}`, VIEW_W - 260, VIEW_H - 40);
  ctx.font = `600 14px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('km/h', VIEW_W - 212, VIEW_H - 40);
  const hint = car
    ? 'E — step out    Space — handbrake'
    : 'E — steal car    Click — shoot';
  ctx.font = `600 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(hint, VIEW_W / 2, VIEW_H - 18);

  // ---- Minimap, top-right.
  drawMinimap(ctx, state);

  // ---- Dialogue box, bottom-centre above the hint.
  if (state.dialogue.t > 0 && state.dialogue.text) {
    const w = 760;
    const x = (VIEW_W - w) / 2;
    const y = VIEW_H - 172;
    ctx.fillStyle = 'rgba(10, 14, 20, 0.78)';
    roundRect(ctx, x, y, w, 86, 10);
    ctx.fill();
    ctx.strokeStyle = '#f2c94c';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, 86, 10);
    ctx.stroke();
    ctx.font = `800 15px ${FONT}`;
    ctx.fillStyle = '#f2c94c';
    ctx.textAlign = 'left';
    ctx.fillText(state.dialogue.speaker, x + 18, y + 24);
    ctx.font = `500 15px ${FONT}`;
    ctx.fillStyle = '#f2f4f6';
    wrapText(ctx, state.dialogue.text, x + 18, y + 46, w - 36, 19);
  }

  // ---- Banner (mission title / big event), centre-top below the objective.
  if (state.banner.t > 0 && state.banner.text) {
    ctx.font = `900 34px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(state.banner.text, VIEW_W / 2 + 2, 122);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(state.banner.text, VIEW_W / 2, 120);
    if (state.banner.sub) {
      ctx.font = `600 17px ${FONT}`;
      ctx.fillStyle = '#ffe27a';
      ctx.fillText(state.banner.sub, VIEW_W / 2, 146);
    }
  }

  // ---- Transient message, under the banner.
  if (state.message.t > 0 && state.message.text) {
    ctx.font = `600 17px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(state.message.text, VIEW_W / 2, 178);
  }
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const ang = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawMinimap(ctx, state) {
  const sx = MM_W / WORLD_W;
  const sy = MM_H / WORLD_H;
  ctx.fillStyle = 'rgba(10, 14, 20, 0.66)';
  roundRect(ctx, MM_X - 4, MM_Y - 4, MM_W + 8, MM_H + 8, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, MM_X, MM_Y, MM_W, MM_H, 8);
  ctx.clip();
  ctx.fillStyle = '#5d8f43';
  ctx.fillRect(MM_X, MM_Y, MM_W, MM_H);
  ctx.fillStyle = '#e3cd8f';
  ctx.fillRect(MM_X + SAND_X * sx, MM_Y, (WATER_X - SAND_X) * sx, MM_H);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(MM_X + WATER_X * sx, MM_Y, MM_W - WATER_X * sx, MM_H);
  ctx.strokeStyle = '#3c4048';
  ctx.lineWidth = 2;
  for (const v of state.city.roadsV) {
    ctx.beginPath();
    ctx.moveTo(MM_X + v * sx, MM_Y);
    ctx.lineTo(MM_X + v * sx, MM_Y + MM_H);
    ctx.stroke();
  }
  for (const h of state.city.roadsH) {
    ctx.beginPath();
    ctx.moveTo(MM_X, MM_Y + h * sy);
    ctx.lineTo(MM_X + MM_W, MM_Y + h * sy);
    ctx.stroke();
  }
  // Cars as grey dots, police flashing red/blue, mission marker gold.
  for (const car of state.cars) {
    if (car.driver === 'player') continue;
    ctx.fillStyle = car.isPolice ? '#ff3b30' : 'rgba(230,230,230,0.85)';
    ctx.beginPath();
    ctx.arc(MM_X + car.x * sx, MM_Y + car.y * sy, car.isPolice ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of state.cops) {
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(MM_X + cop.x * sx, MM_Y + cop.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const m = state.mission.marker;
  if (m) {
    const pulse = 3 + Math.sin(state.time * 4) * 1.5;
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(MM_X + m.x * sx, MM_Y + m.y * sy, pulse + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5b00';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  const pp = playerPos(state);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(MM_X + pp.x * sx, MM_Y + pp.y * sy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR BAY', MM_X + 2, MM_Y + MM_H + 18);
}
