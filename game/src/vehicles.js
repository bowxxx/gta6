// Cars: parked, traffic, the player's ride and police interceptors. Driving is
// simple arcade physics — accelerate, brake/reverse, steer harder the faster
// you go, handbrake to slide — with building collision and car-vs-car bumps.
import {
  CAR_ACCEL, CAR_BRAKE, CAR_MAX_REVERSE, CAR_MAX_SPEED, CAR_RADIUS, CAR_TURN,
  TRAFFIC_SPEED,
} from './config.js';
import { clampToWorld, collideBuildings, nearestRoadPoint, onSand } from './world.js';
import { hitPed } from './player.js';

const MODELS = [
  { name: 'Comet GT', color: '#e8b93b', len: 46, wid: 22 },
  { name: 'Bison', color: '#7f8c8d', len: 52, wid: 24 },
  { name: 'Sunrunner', color: '#e74c3c', len: 44, wid: 21 },
  { name: 'Marlin', color: '#3498db', len: 46, wid: 22 },
  { name: 'Dune Buggy', color: '#2ecc71', len: 42, wid: 22 },
  { name: 'Regal', color: '#9b59b6', len: 48, wid: 22 },
  { name: 'Pickup', color: '#d35400', len: 50, wid: 23 },
];

let nextCarId = 1;

export function makeCar(state, x, y, angle, color, modelName, opts) {
  const model = MODELS.find((m) => m.name === modelName) || MODELS[0];
  const car = {
    id: nextCarId,
    x, y, angle,
    speed: 0,
    color: color || model.color,
    model: modelName || model.name,
    len: model.len,
    wid: model.wid,
    driver: (opts && opts.driver) || 'parked', // parked | traffic | player | police
    special: (opts && opts.special) || null,
    hp: 100,
    smoke: 0,
    axis: null, // traffic: 'x' | 'y'
    dir: 1,
    lane: 0,
    skid: 0,
  };
  nextCarId += 1;
  return car;
}

export function spawnParkedCars(state, count) {
  for (let i = 0; i < count; i += 1) {
    const spot = nearestRoadPoint(state.city, state.rng.range(200, 3150), state.rng.range(200, 3400), state.rng);
    const vertical = Math.abs(spot.x - state.city.roadsV.reduce((a, b) => (Math.abs(spot.x - b) < Math.abs(spot.x - a) ? b : a))) < 20;
    const angle = vertical ? (state.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (state.rng.chance(0.5) ? 0 : Math.PI);
    const off = 52;
    const x = vertical ? spot.x + (state.rng.chance(0.5) ? off : -off) : spot.x + state.rng.range(-60, 60);
    const y = vertical ? spot.y + state.rng.range(-60, 60) : spot.y + (state.rng.chance(0.5) ? off : -off);
    state.cars.push(makeCar(state, x, y, angle, null, state.rng.pick(MODELS).name, { driver: 'parked' }));
  }
}

export function spawnTraffic(state, count) {
  for (let i = 0; i < count; i += 1) {
    const car = makeTrafficCar(state);
    if (car) state.cars.push(car);
  }
}

export function makeTrafficCar(state) {
  const vertical = state.rng.chance(0.5);
  const road = state.rng.pick(vertical ? state.city.roadsV : state.city.roadsH);
  const lane = state.rng.chance(0.5) ? 18 : -18;
  const along = state.rng.range(120, 3400);
  const dir = state.rng.chance(0.5) ? 1 : -1;
  const car = makeCar(
    state,
    vertical ? road + lane : along,
    vertical ? along : road + lane,
    vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
    null, state.rng.pick(MODELS).name, { driver: 'traffic' },
  );
  car.axis = vertical ? 'y' : 'x';
  car.dir = dir;
  car.lane = lane;
  car.speed = state.rng.range(TRAFFIC_SPEED * 0.7, TRAFFIC_SPEED * 1.1);
  return car;
}

// The player's car: WASD/arrows, Space handbrake, E to step out.
export function drivePlayerCar(state, car, input, dt, audio) {
  const accelIn = input.isDown('up') ? 1 : 0;
  const brakeIn = input.isDown('down') ? 1 : 0;
  const steer = (input.isDown('left') ? -1 : 0) + (input.isDown('right') ? 1 : 0);
  const handbrake = input.isDown('handbrake');

  if (accelIn) car.speed += CAR_ACCEL * dt;
  if (brakeIn) {
    if (car.speed > 20) car.speed -= CAR_BRAKE * dt;
    else car.speed -= CAR_ACCEL * 0.5 * dt;
  }
  if (!accelIn && !brakeIn) {
    // Rolling resistance.
    car.speed -= Math.sign(car.speed) * 140 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * 520 * dt;
    if (Math.abs(car.speed) < 30) car.speed = 0;
    if (Math.abs(car.speed) > 60 && state.rng.chance(0.5)) {
      state.particles.push({
        x: car.x - Math.cos(car.angle) * 18, y: car.y - Math.sin(car.angle) * 18,
        vx: 0, vy: 0, life: 0.5, maxLife: 0.5, color: '#cccccc', size: 4,
      });
    }
  }
  const max = onSand(car.x) ? CAR_MAX_SPEED * 0.55 : CAR_MAX_SPEED;
  car.speed = Math.max(-CAR_MAX_REVERSE, Math.min(max, car.speed));

  const speedFactor = Math.min(1, Math.abs(car.speed) / 240);
  const steerAmount = steer * CAR_TURN * speedFactor * (car.speed < 0 ? -1 : 1) * dt;
  car.angle += steerAmount;

  moveCar(state, car, dt, audio, true);
  if (audio) audio.engine(Math.abs(car.speed) / CAR_MAX_SPEED);
}

function moveCar(state, car, dt, audio, isPlayer) {
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const solved = collideBuildings(state.city, nx, ny, CAR_RADIUS);
  if (solved.hit && Math.abs(car.speed) > 180) {
    crashCar(state, car, audio);
  } else if (solved.hit) {
    car.speed *= 0.4;
  }
  car.x = solved.x;
  car.y = solved.y;
  const clamped = clampToWorld(car.x, car.y, 26);
  if ((clamped.x !== car.x || clamped.y !== car.y) && Math.abs(car.speed) > 200) crashCar(state, car, audio);
  car.x = clamped.x;
  car.y = clamped.y;

  // Bumping other cars slows both down and can dent them.
  for (const other of state.cars) {
    if (other === car || other.driver === 'traffic' && !isPlayer) continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < 46 && d > 0.01) {
      const push = (46 - d) / 2;
      const ux = (other.x - car.x) / d;
      const uy = (other.y - car.y) / d;
      other.x += ux * push;
      other.y += uy * push;
      car.x -= ux * push * 0.5;
      car.y -= uy * push * 0.5;
      if (Math.abs(car.speed) > 220) {
        car.speed *= 0.55;
        other.hp -= 12;
        crashCar(state, car, audio);
        if (isPlayer) {
          state.wanted = Math.min(5, state.wanted + 0); // a bump alone is not a crime
        }
      }
    }
  }

  // Running over a pedestrian is a crime, and the city notices.
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30 && Math.abs(car.speed) > 60) {
      hitPed(state, ped, car);
      car.speed *= 0.7;
    }
  }

  // Damage smoke when the car is beaten up.
  if (car.hp < 45) {
    car.smoke += dt;
    if (car.smoke > 0.12) {
      car.smoke = 0;
      state.particles.push({
        x: car.x + state.rng.range(-8, 8), y: car.y + state.rng.range(-8, 8),
        vx: state.rng.range(-10, 10), vy: state.rng.range(-40, -10),
        life: 0.9, maxLife: 0.9, color: '#555555', size: 5,
      });
    }
  }
}

function crashCar(state, car, audio) {
  car.speed *= 0.35;
  car.hp = Math.max(0, car.hp - 14);
  state.stats.crashes += 1;
  state.shake = Math.max(state.shake, 5);
  for (let i = 0; i < 10; i += 1) {
    state.particles.push({
      x: car.x, y: car.y,
      vx: state.rng.range(-120, 120), vy: state.rng.range(-120, 120),
      life: 0.5, maxLife: 0.5, color: '#f5c542', size: 3,
    });
  }
  if (audio) audio.crash();
  if (car.hp <= 0 && car.driver === 'player') {
    // A wrecked ride strands you on foot.
    state.player.inCar = null;
    state.player.x = car.x + 40;
    state.player.y = car.y + 40;
  }
}

// Traffic drives along its road and turns at intersections; at the edge of the
// city it loops back to the other side so the streets never empty out.
export function updateTraffic(state, dt) {
  const pp = { x: state.player.x, y: state.player.y };
  const pcar = state.cars.find((c) => c.id === state.player.inCar);
  if (pcar) { pp.x = pcar.x; pp.y = pcar.y; }
  for (const car of state.cars) {
    if (car.driver !== 'traffic') continue;
    // Slow down for the car ahead on the same lane.
    let target = TRAFFIC_SPEED;
    for (const other of state.cars) {
      if (other === car) continue;
      const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
      const side = Math.abs((other.x - car.x) * -Math.sin(car.angle) + (other.y - car.y) * Math.cos(car.angle));
      if (ahead > 0 && ahead < 70 && side < 26) { target = 0; break; }
    }
    car.speed += Math.sign(target - car.speed) * 200 * dt;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    car.x = nx;
    car.y = ny;
    // At an intersection, sometimes turn onto the cross street.
    const onV = nearestRoad(state.city.roadsV, car.x) < 8;
    const onH = nearestRoad(state.city.roadsH, car.y) < 8;
    if (onV && onH && state.rng.chance(0.004)) {
      const turn = state.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
      car.angle += turn;
      car.axis = car.axis === 'x' ? 'y' : 'x';
    }
    // Loop around the city edge.
    if (car.x < 80) car.x = 3280;
    if (car.x > 3320) car.x = 120;
    if (car.y < 80) car.y = 3440;
    if (car.y > 3480) car.y = 120;
  }
  // Keep traffic dense near the player: recycle far-away cars to nearby roads.
  if (state.cars.filter((c) => c.driver === 'traffic').length < 14 && state.rng.chance(0.02)) {
    const car = makeTrafficCar(state);
    if (car) {
      const spot = nearestRoadPoint(state.city, pp.x + state.rng.range(-500, 500), pp.y + state.rng.range(-500, 500), state.rng);
      car.x = spot.x;
      car.y = spot.y;
      state.cars.push(car);
    }
  }
}

function nearestRoad(roads, v) {
  let best = Infinity;
  for (const r of roads) best = Math.min(best, Math.abs(v - r));
  return best;
}

// Walk up to a car and press E: parked and traffic cars can be stolen (the
// driver bails out), which is a crime; your own car just opens.
export function nearestEnterableCar(state, maxDist) {
  const p = state.player;
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.driver === 'police') continue;
    if (car.hp <= 0) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(state, car, audio) {
  const p = state.player;
  const stolen = car.driver !== 'player';
  if (car.driver === 'traffic') {
    // The driver jumps out and runs.
    state.peds.push({
      x: car.x + 30, y: car.y + 30, angle: state.rng.range(0, Math.PI * 2),
      tx: car.x + 300, ty: car.y + 300, speed: 120, color: '#ecf0f1', panic: 3, down: 0, walkPhase: 0,
    });
  }
  car.driver = 'player';
  p.inCar = car.id;
  p.x = car.x;
  p.y = car.y;
  if (stolen) {
    state.stats.carsStolen += 1;
    state.wanted = Math.min(5, state.wanted + 1);
    state.wantedTimer = 0;
    state.quietTimer = 0;
    if (audio) audio.ui();
  }
}

export function exitCar(state, audio) {
  const p = state.player;
  const car = state.cars.find((c) => c.id === p.inCar);
  if (!car) { p.inCar = null; return; }
  car.driver = 'parked';
  car.speed = 0;
  p.inCar = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 36;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 36;
  p.angle = car.angle;
  if (audio) audio.ui();
}
