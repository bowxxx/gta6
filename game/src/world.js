// Solmar Bay itself: a sun-soaked coastal city on a road grid. generateCity
// lays out the roads, the blocks between them (buildings, parks, car parks),
// the beach and the sea, plus the trees. It also owns collision: circle-vs-
// building-rectangle push-out, and helpers to find road points for spawning.
import { BLOCK, ROAD_FIRST, ROAD_W, SAND_X, WATER_X, WORLD_H, WORLD_W } from './config.js';

export const ROAD_COLORS = ['#3a3f4a', '#424753'];

const BUILDING_COLORS = ['#c98f5f', '#b5764f', '#8fa3b5', '#d9b380', '#a87f6d', '#7d9b8a', '#c4a484', '#9aa5b1'];
const ROOF_COLORS = ['#8a5a3b', '#6e7f8c', '#a3764a', '#5f7a6a', '#7c6a58'];

export function roadCentres() {
  const lines = [];
  for (let v = ROAD_FIRST; v <= WORLD_W - 200; v += BLOCK) lines.push(v);
  return lines;
}

export function generateCity(rng) {
  const roadsV = roadCentres();
  const roadsH = roadCentres();
  const buildings = [];
  const parks = [];
  const trees = [];
  const carParks = [];

  // Blocks sit between neighbouring roads. Each block is either buildings,
  // a park, or an open car park; the beach strip and the sea stay clear.
  for (let i = 0; i < roadsV.length - 1; i += 1) {
    for (let j = 0; j < roadsH.length - 1; j += 1) {
      const x0 = roadsV[i] + ROAD_W / 2 + 14;
      const y0 = roadsH[j] + ROAD_W / 2 + 14;
      const x1 = roadsV[i + 1] - ROAD_W / 2 - 14;
      const y1 = roadsH[j + 1] - ROAD_W / 2 - 14;
      if (x1 > SAND_X - 10) continue; // beach blocks stay open sand
      const roll = rng.next();
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const count = rng.int(4, 8);
        for (let t = 0; t < count; t += 1) {
          trees.push({ x: rng.range(x0 + 16, x1 - 16), y: rng.range(y0 + 16, y1 - 16), r: rng.range(9, 15) });
        }
        continue;
      }
      if (roll < 0.24) {
        carParks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      // 2x2 buildings per block, with jitter so no two blocks look alike.
      const cols = 2;
      const rows = 2;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const bw = (x1 - x0) / cols - 18;
          const bh = (y1 - y0) / rows - 18;
          const bx = x0 + c * ((x1 - x0) / cols) + 9 + rng.range(-4, 4);
          const by = y0 + r * ((y1 - y0) / rows) + 9 + rng.range(-4, 4);
          buildings.push({
            x: bx, y: by, w: bw, h: bh,
            color: rng.pick(BUILDING_COLORS),
            roof: rng.pick(ROOF_COLORS),
            tall: rng.chance(0.35),
          });
        }
      }
    }
  }

  // Palm trees along the beach promenade.
  for (let y = 120; y < WORLD_H - 100; y += 130) {
    trees.push({ x: SAND_X + 26 + rng.range(-8, 8), y: y + rng.range(-20, 20), r: 12, palm: true });
  }
  return { roadsV, roadsH, buildings, parks, trees, carParks };
}

export function isOnRoad(city, x, y) {
  const half = ROAD_W / 2;
  for (const v of city.roadsV) if (Math.abs(x - v) < half) return true;
  for (const h of city.roadsH) if (Math.abs(y - h) < half) return true;
  return false;
}

export function nearestRoadPoint(city, x, y, rng) {
  // Snap to the closest road centreline, then slide along it a little.
  let bestV = city.roadsV[0];
  let bestD = Infinity;
  for (const v of city.roadsV) {
    const d = Math.abs(x - v);
    if (d < bestD) { bestD = d; bestV = v; }
  }
  let bestH = city.roadsH[0];
  bestD = Infinity;
  for (const h of city.roadsH) {
    const d = Math.abs(y - h);
    if (d < bestD) { bestD = d; bestH = h; }
  }
  if (Math.abs(x - bestV) < Math.abs(y - bestH)) {
    return { x: bestV + (rng ? rng.range(-14, 14) : 0), y: Math.max(60, Math.min(WORLD_H - 60, y)) };
  }
  return { x: Math.max(60, Math.min(WORLD_W - 60, x)), y: bestH + (rng ? rng.range(-14, 14) : 0) };
}

// Push a circle (x, y, radius) out of every building it overlaps. Returns the
// corrected position; also reports whether a hit happened (for crash sounds).
export function collideBuildings(city, x, y, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 0.01) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * radius;
      y = cy + (dy / d) * radius;
    } else {
      // Centre inside the rect: push out along the smallest penetration.
      const left = x - b.x;
      const right = b.x + b.w - x;
      const top = y - b.y;
      const bottom = b.y + b.h - y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) x = b.x - radius;
      else if (min === right) x = b.x + b.w + radius;
      else if (min === top) y = b.y - radius;
      else y = b.y + b.h + radius;
    }
  }
  return { x, y, hit };
}

export function clampToWorld(x, y, margin) {
  return {
    x: Math.max(margin, Math.min(WORLD_W - margin, x)),
    y: Math.max(margin, Math.min(WORLD_H - margin, y)),
  };
}

export function inWater(x) {
  return x > WATER_X;
}

export function onSand(x) {
  return x > SAND_X && x <= WATER_X;
}
