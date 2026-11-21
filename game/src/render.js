// Drawing only: the city, the cars, the people and the particles, plus the
// title / pause / busted panels. The HUD (health, money, stars, minimap) lives
// in hud.js. The camera follows the player; everything is drawn in world
// coordinates after translating by the camera.
import { FONT, ROAD_W, SAND_X, VIEW_H, VIEW_W, WATER_X, WORLD_H, WORLD_W } from './config.js';
import { onSand } from './world.js';
import { playerCar, playerPos } from './state.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PALETTE = {
  grass: '#6da34f',
  grassDark: '#5d8f43',
  sand: '#e3cd8f',
  water: '#2f7fb8',
  waterDeep: '#256b9e',
  road: '#3c4048',
  roadEdge: '#565b66',
  sidewalk: '#9aa0a8',
  park: '#4e8a3d',
  text: '#f2f4f6',
  muted: '#c8cdd4',
  panel: 'rgba(16, 20, 28, 0.88)',
  gold: '#f2c94c',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? weight + ' ' : ''}${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
  }

  function drawGround(state) {
    const cam = state.camera;
    const x0 = Math.max(0, cam.x - 40);
    const y0 = Math.max(0, cam.y - 40);
    const x1 = Math.min(WORLD_W, cam.x + VIEW_W + 40);
    const y1 = Math.min(WORLD_H, cam.y + VIEW_H + 40);
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Mown stripes for a little texture.
    ctx.fillStyle = PALETTE.grassDark;
    const stripe = 120;
    for (let y = Math.floor(y0 / stripe) * stripe; y < y1; y += stripe * 2) {
      ctx.fillRect(x0, y, x1 - x0, stripe);
    }
    // Sand, then the sea with animated wave lines.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(Math.max(x0, SAND_X), y0, Math.min(x1, WATER_X) - Math.max(x0, SAND_X), y1 - y0);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(Math.max(x0, WATER_X), y0, x1 - Math.max(x0, WATER_X), y1 - y0);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let y = Math.floor(y0 / 90) * 90; y < y1; y += 90) {
      const wobble = Math.sin(state.time * 1.4 + y * 0.05) * 8;
      ctx.fillRect(Math.max(x0, WATER_X) + 30 + wobble, y, 60, 5);
    }
    // Parks.
    for (const park of state.city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      ctx.fillStyle = PALETTE.park;
      roundRect(ctx, park.x, park.y, park.w, park.h, 12);
      ctx.fill();
    }
  }

  function drawRoads(state) {
    const cam = state.camera;
    const x0 = cam.x - 40;
    const y0 = cam.y - 40;
    const x1 = cam.x + VIEW_W + 40;
    const y1 = cam.y + VIEW_H + 40;
    // Sidewalk halo, then asphalt, then centre dashes.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const v of state.city.roadsV) {
      if (v < x0 - ROAD_W || v > x1 + ROAD_W) continue;
      ctx.fillRect(v - ROAD_W / 2 - 10, y0, ROAD_W + 20, y1 - y0);
    }
    for (const h of state.city.roadsH) {
      if (h < y0 - ROAD_W || h > y1 + ROAD_W) continue;
      ctx.fillRect(x0, h - ROAD_W / 2 - 10, x1 - x0, ROAD_W + 20);
    }
    ctx.fillStyle = PALETTE.road;
    for (const v of state.city.roadsV) {
      if (v < x0 - ROAD_W || v > x1 + ROAD_W) continue;
      ctx.fillRect(v - ROAD_W / 2, y0, ROAD_W, y1 - y0);
    }
    for (const h of state.city.roadsH) {
      if (h < y0 - ROAD_W || h > y1 + ROAD_W) continue;
      ctx.fillRect(x0, h - ROAD_W / 2, x1 - x0, ROAD_W);
    }
    ctx.fillStyle = '#d8c56a';
    for (const v of state.city.roadsV) {
      if (v < x0 - ROAD_W || v > x1 + ROAD_W) continue;
      for (let y = Math.floor(y0 / 46) * 46; y < y1; y += 46) {
        if (Math.floor(y / 46) % 2 === 0) ctx.fillRect(v - 2, y, 4, 22);
      }
    }
    for (const h of state.city.roadsH) {
      if (h < y0 - ROAD_W || h > y1 + ROAD_W) continue;
      for (let x = Math.floor(x0 / 46) * 46; x < x1; x += 46) {
        if (Math.floor(x / 46) % 2 === 0) ctx.fillRect(x, h - 2, 22, 4);
      }
    }
  }

  function drawBuildings(state) {
    const cam = state.camera;
    for (const b of state.city.buildings) {
      if (b.x > cam.x + VIEW_W + 60 || b.x + b.w < cam.x - 60 || b.y > cam.y + VIEW_H + 60 || b.y + b.h < cam.y - 60) continue;
      // Soft shadow to the south-east: the sun is high and to the west.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      roundRect(ctx, b.x + 7, b.y + 9, b.w, b.h, 5);
      ctx.fill();
      ctx.fillStyle = b.color;
      roundRect(ctx, b.x, b.y, b.w, b.h, 5);
      ctx.fill();
      ctx.fillStyle = b.roof;
      roundRect(ctx, b.x + 7, b.y + 7, b.w - 14, b.h - 14, 4);
      ctx.fill();
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, 6);
      }
      // Windows along the edges.
      ctx.fillStyle = 'rgba(20,30,45,0.55)';
      for (let wx = b.x + 12; wx < b.x + b.w - 12; wx += 22) {
        ctx.fillRect(wx, b.y + 3, 10, 5);
        ctx.fillRect(wx, b.y + b.h - 8, 10, 5);
      }
    }
  }

  function drawTrees(state) {
    const cam = state.camera;
    for (const t of state.city.trees) {
      if (t.x < cam.x - 40 || t.x > cam.x + VIEW_W + 40 || t.y < cam.y - 40 || t.y > cam.y + VIEW_H + 40) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.palm ? '#3f9e4d' : '#2f7a33';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#57b25e';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCarShape(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, -car.len / 2 + 3, -car.wid / 2 + 4, car.len, car.wid, 6);
    ctx.fill();
    ctx.fillStyle = car.color;
    roundRect(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 6);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,28,40,0.85)';
    roundRect(ctx, -car.len / 2 + 10, -car.wid / 2 + 4, car.len * 0.42, car.wid - 8, 4);
    ctx.fill();
    ctx.fillStyle = '#bfe3ff';
    ctx.fillRect(-car.len / 2 + 12, -car.wid / 2 + 5, 5, car.wid - 10);
    // Headlights and taillights.
    ctx.fillStyle = '#fff6b0';
    ctx.fillRect(car.len / 2 - 3, -car.wid / 2 + 3, 3, 5);
    ctx.fillRect(car.len / 2 - 3, car.wid / 2 - 8, 3, 5);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-car.len / 2, -car.wid / 2 + 3, 3, 5);
    ctx.fillRect(-car.len / 2, car.wid / 2 - 8, 3, 5);
    if (car.isPolice) {
      // Flashing light bar.
      const phase = Math.floor(performance.now() / 280) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2d2d' : '#2d6bff';
      ctx.fillRect(-6, -car.wid / 2 + 2, 12, 6);
      ctx.fillStyle = phase ? '#2d6bff' : '#ff2d2d';
      ctx.fillRect(-6, car.wid / 2 - 8, 12, 6);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      roundRect(ctx, -car.len / 2 - 3, -car.wid / 2 - 3, car.len + 6, car.wid + 6, 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, color, radius, walkPhase, gun) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.arc(2, 3, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick + simple arms that swing while walking.
    const swing = walkPhase ? Math.sin(walkPhase) * 3 : 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * (radius + 7), Math.sin(angle) * (radius + 7));
    ctx.stroke();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 4 + swing * 0.3, Math.sin(angle) * 4, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    if (gun) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      ctx.lineTo(Math.cos(angle) * (radius + 12), Math.sin(angle) * (radius + 12));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMarker(state) {
    const m = state.mission.marker;
    if (!m) return;
    const pulse = 1 + Math.sin(state.time * 4) * 0.15;
    // Beacon column so the marker is visible from across the neighbourhood.
    ctx.fillStyle = 'rgba(242, 201, 76, 0.18)';
    ctx.fillRect(m.x - 14, m.y - 260, 28, 260);
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#f2c94c';
    ctx.strokeStyle = '#7a5b00';
    ctx.lineWidth = 3;
    const s = 16 * pulse;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
    text(m.label, m.x, m.y - 34, 15, '#ffffff', 'center', '700');
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeText(m.label, m.x, m.y - 34);
  }

  function drawWorld(state) {
    drawGround(state);
    drawRoads(state);
    drawBuildings(state);
    drawTrees(state);
    // Packages to collect.
    for (const pk of state.pickups) {
      const bob = Math.sin(state.time * 3 + pk.x) * 3;
      ctx.fillStyle = '#f2c94c';
      ctx.strokeStyle = '#7a5b00';
      ctx.lineWidth = 2;
      ctx.fillRect(pk.x - 11, pk.y - 11 + bob, 22, 22);
      ctx.strokeRect(pk.x - 11, pk.y - 11 + bob, 22, 22);
      ctx.strokeStyle = '#7a5b00';
      ctx.beginPath();
      ctx.moveTo(pk.x - 11, pk.y + bob);
      ctx.lineTo(pk.x + 11, pk.y + bob);
      ctx.stroke();
    }
    drawMarker(state);
    // Cars, sorted so the player's car draws on top when overlapping.
    const cars = [...state.cars].sort((a, b) => (a.id === state.player.inCar ? 1 : 0) - (b.id === state.player.inCar ? 1 : 0));
    for (const car of cars) {
      if (car.x < state.camera.x - 80 || car.x > state.camera.x + VIEW_W + 80 || car.y < state.camera.y - 80 || car.y > state.camera.y + VIEW_H + 80) continue;
      drawCarShape(car, car.id === state.player.inCar);
      if (car.special === 'getaway' && state.mission.index === 0 && state.mission.stage === 0) {
        text('GETAWAY', car.x, car.y - 34, 13, '#ffe27a', 'center', '700');
      }
    }
    for (const ped of state.peds) {
      if (ped.down > 0) {
        ctx.save();
        ctx.translate(ped.x, ped.y);
        ctx.rotate(1.2);
        ctx.fillStyle = ped.color;
        ctx.fillRect(-12, -5, 24, 10);
        ctx.restore();
        continue;
      }
      drawPerson(ped.x, ped.y, ped.angle, ped.color, 10, ped.walkPhase, false);
    }
    for (const cop of state.cops) {
      drawPerson(cop.x, cop.y, cop.angle, '#1e3a5f', 11, state.time * 8, false);
      ctx.fillStyle = '#dfe6ee';
      ctx.font = `700 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('PD', cop.x, cop.y - 16);
    }
    for (const e of state.enemies) {
      drawPerson(e.x, e.y, e.angle, '#8e2f2f', 12, state.time * 8, true);
      // Health bar over an enemy.
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - 16, e.y - 26, 32, 5);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(e.x - 16, e.y - 26, 32 * Math.max(0, e.hp / 70), 5);
    }
    // The player on foot.
    if (state.player.inCar === null) {
      const p = state.player;
      const blink = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;
      if (!blink) drawPerson(p.x, p.y, p.angle, '#2ecc71', 12, p.moving ? state.time * 10 : 0, true);
    }
    // Tracer lines.
    for (const b of state.bullets) {
      ctx.strokeStyle = b.fromPlayer ? '#ffe27a' : '#ff7a5c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.tx, b.ty);
      ctx.stroke();
    }
    // Particles.
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = 640;
    const lineH = 30;
    const h = 150 + lines.length * lineH + 64;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = accent || PALETTE.gold;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 14);
    ctx.stroke();
    text(title, VIEW_W / 2, y + 62, 44, PALETTE.text, 'center', '800');
    lines.forEach((line, i) => {
      text(line, VIEW_W / 2, y + 118 + i * lineH, 19, PALETTE.muted, 'center');
    });
    text(prompt, VIEW_W / 2, y + h - 28, 20, PALETTE.gold, 'center', '700');
  }

  function drawTitle(state, hasSave) {
    ctx.save();
    ctx.translate(-state.camera.x, -state.camera.y);
    drawWorld(state);
    ctx.restore();
    ctx.fillStyle = 'rgba(8, 14, 24, 0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text('SOLMAR BAY', VIEW_W / 2, 190, 84, '#ffffff', 'center', '900');
    text('an open-world crime story', VIEW_W / 2, 232, 24, PALETTE.gold, 'center', '600');
    const lines = [
      'Jax Marlowe is back in Solmar Bay — broke, fast, and out of options.',
      'Steal cars, outrun the PD, run jobs for Mara and Deacon, and pull off the big score.',
      '',
      'WASD / Arrows — walk & drive      E — steal car / interact      Space — handbrake',
      'Mouse — aim      Click — shoot      P — pause      M — mute',
    ];
    const w = 700;
    const h = 150 + lines.length * 30 + 110;
    const x = (VIEW_W - w) / 2;
    const y = 300;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    lines.forEach((line, i) => text(line, VIEW_W / 2, y + 52 + i * 30, 18, i < 2 ? PALETTE.text : PALETTE.muted, 'center'));
    text(hasSave ? 'ENTER / click — Continue      N — New Game' : 'Press ENTER or click to start', VIEW_W / 2, y + h - 30, 20, PALETTE.gold, 'center', '700');
    text('A fictional city. No real people, places or brands.', VIEW_W / 2, VIEW_H - 24, 14, 'rgba(255,255,255,0.55)', 'center');
  }

  function draw(state, screen, opts) {
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    // Scale the 1280x800 view to the window, letterboxed.
    const scale = Math.min(canvas.width / ratio / VIEW_W, canvas.height / ratio / VIEW_H);
    const ox = (canvas.width / ratio - VIEW_W * scale) / 2;
    const oy = (canvas.height / ratio - VIEW_H * scale) / 2;
    ctx.fillStyle = '#0b0e13';
    ctx.fillRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    // Camera shake.
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    if (screen === SCREEN_TITLE) {
      drawTitle(state, opts && opts.hasSave);
    } else {
      // World space: translate by the camera.
      ctx.save();
      ctx.translate(-state.camera.x, -state.camera.y);
      drawWorld(state);
      ctx.restore();
      if (screen === SCREEN_PAUSED) {
        ctx.fillStyle = 'rgba(8, 14, 24, 0.5)';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        drawPanel('Paused', ['The bay waits for no one — except right now.', `Money $${state.money}  •  Mission ${state.mission.index + 1} of 4`], 'Press P or Enter to resume');
      } else if (screen === SCREEN_OVER) {
        ctx.fillStyle = 'rgba(8, 14, 24, 0.5)';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        drawPanel('Story complete', [`You finished every job in Solmar Bay with $${state.money}.`, 'The bay is yours. Keep driving.'], 'Press Enter to keep playing');
      }
      // Busted / wasted flashes.
      if (state.busted > 0) {
        ctx.fillStyle = 'rgba(20, 40, 90, 0.72)';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        text('BUSTED', VIEW_W / 2, VIEW_H / 2 - 10, 72, '#ffffff', 'center', '900');
        text('The PD caught you — fined $200, car impounded.', VIEW_W / 2, VIEW_H / 2 + 40, 20, PALETTE.muted, 'center');
      } else if (state.wasted > 0) {
        ctx.fillStyle = 'rgba(90, 10, 10, 0.72)';
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        text('WASTED', VIEW_W / 2, VIEW_H / 2 - 10, 72, '#ffffff', 'center', '900');
        text('You wake up at St. Marina Hospital, $150 lighter.', VIEW_W / 2, VIEW_H / 2 + 40, 20, PALETTE.muted, 'center');
      }
      if (state.flash > 0) {
        ctx.fillStyle = `rgba(255, 60, 40, ${Math.min(0.35, state.flash)})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
    }
    ctx.restore();
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    draw,
    // Convert a screen point (CSS pixels in the canvas) back to view coords.
    screenToView(sx, sy) {
      const ratio = window.devicePixelRatio || 1;
      const scale = Math.min(canvas.width / ratio / VIEW_W, canvas.height / ratio / VIEW_H);
      const ox = (canvas.width / ratio - VIEW_W * scale) / 2;
      const oy = (canvas.height / ratio - VIEW_H * scale) / 2;
      return { x: (sx - ox) / scale, y: (sy - oy) / scale };
    },
  };
}
