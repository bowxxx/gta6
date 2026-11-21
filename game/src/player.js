// On-foot player: walking, aiming, punching and shooting, plus pedestrians
// wandering the sidewalks. Cars and the wanted level live in their own files.
import {
  CAR_RADIUS, ENEMY_DAMAGE, PISTOL_DAMAGE, PISTOL_RANGE, PISTOL_RATE,
  PLAYER_RADIUS, PLAYER_SPEED,
} from './config.js';
import { clampToWorld, collideBuildings, inWater, nearestRoadPoint } from './world.js';
import { addParticles, playerCar } from './state.js';

const PED_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1'];

export function spawnPedestrians(state, count) {
  for (let i = 0; i < count; i += 1) {
    const spot = nearestRoadPoint(state.city, state.rng.range(200, 3200), state.rng.range(200, 3400), state.rng);
    state.peds.push(makePed(state, spot.x + state.rng.range(-40, 40), spot.y + state.rng.range(-40, 40)));
  }
}

export function makePed(state, x, y) {
  return {
    x, y, angle: state.rng.range(0, Math.PI * 2),
    tx: x, ty: y, speed: state.rng.range(35, 70),
    color: state.rng.pick(PED_COLORS),
    panic: 0, down: 0, walkPhase: state.rng.range(0, 6),
  };
}

// Walk with WASD/arrows; the player faces the mouse. Shooting fires a hitscan
// tracer toward the mouse; punching hits whatever is right in front.
export function updatePlayer(state, input, dt, audio) {
  const p = state.player;
  if (p.inCar) return; // driving is handled by vehicles.js
  if (p.shootCd > 0) p.shootCd -= dt;
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.invuln > 0) p.invuln -= dt;

  let dx = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
  let dy = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
  const len = Math.hypot(dx, dy);
  p.moving = len > 0;
  if (len > 0) {
    dx /= len;
    dy /= len;
    const nx = p.x + dx * PLAYER_SPEED * dt;
    const ny = p.y + dy * PLAYER_SPEED * dt;
    const solved = collideBuildings(state.city, nx, ny, PLAYER_RADIUS);
    p.x = solved.x;
    p.y = solved.y;
  }
  const clamped = clampToWorld(p.x, p.y, 24);
  p.x = clamped.x;
  p.y = clamped.y;
  if (inWater(p.x)) {
    // The sea is not swimmable: the tide pushes you back onto the sand.
    p.x = 3340;
    showSplash(state);
  }

  // Aim at the mouse (screen coords -> world coords via the camera).
  const wx = state.camera.x + input.mouse.x;
  const wy = state.camera.y + input.mouse.y;
  p.aimX = wx;
  p.aimY = wy;
  p.angle = Math.atan2(wy - p.y, wx - p.x);

  if (input.mouse.clicked && p.shootCd <= 0) {
    shoot(state, audio);
  }
}

function showSplash(state) {
  addParticles(state, state.player.x + 20, state.player.y, '#7ec8e3', 10, 120);
}

export function shoot(state, audio) {
  const p = state.player;
  p.shootCd = PISTOL_RATE;
  state.stats.shotsFired += 1;
  const tx = p.aimX;
  const ty = p.aimY;
  const dist = Math.hypot(tx - p.x, ty - p.y);
  const range = Math.min(dist, PISTOL_RANGE);
  const angle = Math.atan2(ty - p.y, tx - p.x);
  const ex = p.x + Math.cos(angle) * range;
  const ey = p.y + Math.sin(angle) * range;
  state.bullets.push({ x: p.x, y: p.y, tx: ex, ty: ey, t: 0.09, fromPlayer: true });
  addParticles(state, p.x + Math.cos(angle) * 20, p.y + Math.sin(angle) * 20, '#ffd76a', 5, 160);
  if (audio) audio.shot();
  // Hitting something?
  let best = null;
  let bestD = range;
  for (const e of state.enemies) {
    const d = distToSegment(e.x, e.y, p.x, p.y, ex, ey);
    if (d < 22 && distAlong(p, e, angle) < bestD && distAlong(p, e, angle) > 0) {
      best = e;
      bestD = distAlong(p, e, angle);
    }
  }
  for (const cop of state.cops) {
    const d = distToSegment(cop.x, cop.y, p.x, p.y, ex, ey);
    if (d < 22 && distAlong(p, cop, angle) < bestD && distAlong(p, cop, angle) > 0) {
      best = cop;
      bestD = distAlong(p, cop, angle);
    }
  }
  if (best) {
    best.hp -= PISTOL_DAMAGE;
    addParticles(state, best.x, best.y, '#c0392b', 8, 140);
    if (best.hp <= 0) {
      best.dead = true;
      state.money += 25;
      addParticles(state, best.x, best.y, '#e74c3c', 18, 220);
    }
    raiseAlarm(state, 1);
  } else if (dist < PISTOL_RANGE * 0.9) {
    raiseAlarm(state, 0);
  }
}

function distAlong(p, target, angle) {
  return (target.x - p.x) * Math.cos(angle) + (target.y - p.y) * Math.sin(angle);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Gunfire (and other crimes) raise the wanted level; called by several modules.
export function raiseAlarm(state, stars) {
  if (stars > 0) {
    state.wanted = Math.min(5, state.wanted + stars);
    state.wantedTimer = 0;
    state.quietTimer = 0;
  } else if (state.wanted > 0) {
    state.quietTimer = 0; // a shot nearby keeps the heat on
  }
}

export function damagePlayer(state, amount, audio) {
  const p = state.player;
  if (p.invuln > 0 || p.hp <= 0) return;
  p.hp = Math.max(0, p.hp - amount);
  p.invuln = 0.35;
  state.flash = 0.25;
  state.shake = 6;
  if (audio) audio.punch();
  if (p.hp <= 0) {
    state.wasted = 3;
    if (audio) audio.bust();
  }
}

// Pedestrians stroll between sidewalk points, panic and scatter when a car
// speeds past or a shot rings out, and can be knocked down by a speeding car.
export function updatePeds(state, dt) {
  const pp = { x: state.player.x, y: state.player.y };
  const car = playerCar(state);
  const carSpeed = car ? Math.abs(car.speed) : 0;
  for (const ped of state.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    if (ped.panic > 0) ped.panic -= dt;
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      const spot = nearestRoadPoint(state.city, ped.x + state.rng.range(-500, 500), ped.y + state.rng.range(-500, 500), state.rng);
      // Keep pedestrians off the sand and out of the sea.
      ped.tx = Math.min(spot.x + state.rng.range(-46, 46), 3180);
      ped.ty = spot.y + state.rng.range(-46, 46);
    } else {
      const speed = ped.panic > 0 ? ped.speed * 2.4 : ped.speed;
      ped.x += (dx / d) * speed * dt;
      ped.y += (dy / d) * speed * dt;
      ped.angle = Math.atan2(dy, dx);
      ped.walkPhase += dt * 8;
    }
    // Panic: the player's car screaming past, or a gunshot nearby.
    const nearCar = car && Math.hypot(ped.x - car.x, ped.y - car.y) < 110 && carSpeed > 260;
    const nearShot = state.bullets.length > 0 && Math.hypot(ped.x - pp.x, ped.y - pp.y) < 320;
    if ((nearCar || nearShot) && ped.panic <= 0) ped.panic = 2.5;
  }
  // Respawning keeps the streets alive: a knocked-down ped gets back up and a
  // fresh face wanders in from the edge of the camera view.
  if (state.peds.length < 42 && state.rng.chance(0.01)) {
    const spot = nearestRoadPoint(state.city, state.camera.x + state.rng.range(0, 1280), state.camera.y + state.rng.range(0, 800), state.rng);
    state.peds.push(makePed(state, spot.x, spot.y));
  }
}

// A car hitting a pedestrian: the ped goes down, the city notices.
export function hitPed(state, ped, car) {
  if (ped.down > 0) return;
  ped.down = 4;
  ped.panic = 4;
  state.stats.pedsHit += 1;
  addParticles(state, ped.x, ped.y, '#e74c3c', 10, 160);
  state.wanted = Math.min(5, state.wanted + 1);
  state.wantedTimer = 0;
  state.quietTimer = 0;
  state.shake = 5;
}
