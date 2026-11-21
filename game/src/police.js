// The wanted system: stars rise with crimes, fall when you lay low, and the
// Solmar Bay PD responds — interceptors on the road, officers on foot. Get
// caught on foot and you are busted; outrun them long enough and the heat dies.
import { BUST_DISTANCE, BUST_SECONDS, CAR_MAX_SPEED, WANTED_DECAY_SECONDS, WANTED_MAX } from './config.js';
import { nearestRoadPoint } from './world.js';
import { makeCar } from './vehicles.js';
import { addParticles, playerPos, showMessage } from './state.js';

export function addWanted(state, stars) {
  state.wanted = Math.min(WANTED_MAX, state.wanted + stars);
  state.wantedTimer = 0;
  state.quietTimer = 0;
}

export function updateWanted(state, dt, audio) {
  if (state.wanted <= 0) return;
  state.wantedTimer += dt;
  const committingCrime = state.quietTimer < 2;
  if (!committingCrime) {
    state.quietTimer += dt;
    if (state.quietTimer > WANTED_DECAY_SECONDS) {
      state.wanted -= 1;
      state.quietTimer = 0;
      state.wantedTimer = 0;
      showMessage(state, state.wanted > 0 ? `Heat dropping… ${state.wanted} star${state.wanted === 1 ? '' : 's'} left` : 'You lost them. The heat is off.');
      if (state.wanted === 0 && audio) audio.siren(false);
    }
  }
  if (audio) audio.siren(state.wanted > 0 && state.policeCars.length > 0);
}

// Keep the right number of police units on the street for the current stars:
// 1 star = 1 interceptor, up to 5 stars = 4 interceptors + foot officers.
export function updatePolice(state, dt, audio) {
  const pp = playerPos(state);
  const wantCars = state.wanted === 0 ? 0 : Math.min(1 + Math.floor(state.wanted / 2), 4);
  const wantCops = state.wanted >= 2 && state.player.inCar === null ? Math.min(state.wanted - 1, 3) : 0;

  while (state.policeCars.length < wantCars) {
    const spot = nearestRoadPoint(state.city, pp.x + (state.rng.chance(0.5) ? 700 : -700), pp.y + (state.rng.chance(0.5) ? 700 : -700), state.rng);
    const car = makeCar(state, spot.x, spot.y, state.rng.range(0, Math.PI * 2), '#1e3a5f', 'Interceptor', { driver: 'police' });
    car.isPolice = true;
    car.speed = 200;
    state.cars.push(car);
    state.policeCars.push(car);
    addParticles(state, car.x, car.y, '#3b82f6', 8, 120);
  }
  while (state.policeCars.length > wantCars) {
    const car = state.policeCars.pop();
    car.driver = 'parked';
    car.isPolice = false;
    const idx = state.cars.indexOf(car);
    if (idx !== -1) state.cars.splice(idx, 1);
  }
  while (state.cops.length < wantCops) {
    state.cops.push({
      x: pp.x + state.rng.range(-400, 400), y: pp.y + state.rng.range(-400, 400),
      hp: 100, angle: 0, bustTimer: 0, speed: 165, dead: false, shootCd: 1,
    });
  }
  while (state.cops.length > wantCops) state.cops.pop();

  // Interceptors steer toward the player and ram.
  for (const car of state.policeCars) {
    const dx = pp.x - car.x;
    const dy = pp.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const top = CAR_MAX_SPEED * (0.82 + state.wanted * 0.03);
    car.speed += Math.sign(top - car.speed) * 420 * dt;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    car.x = nx;
    car.y = ny;
    if (dist < 60 && state.rng.chance(0.1)) {
      addParticles(state, car.x, car.y, '#f5c542', 4, 100);
    }
    // Ramming the player's car dents it and shakes the camera.
    const pcar = state.cars.find((c) => c.id === state.player.inCar);
    if (pcar && dist < 52) {
      pcar.hp = Math.max(0, pcar.hp - 6 * dt);
      pcar.speed *= 0.985;
      state.shake = Math.max(state.shake, 3);
      if (pcar.hp <= 0) {
        state.player.inCar = null;
        state.player.x = pcar.x + 40;
        state.player.y = pcar.y + 40;
      }
    }
  }

  // Foot officers chase on foot; stand next to you long enough and you are busted.
  const onFoot = state.player.inCar === null;
  for (const cop of state.cops) {
    if (cop.dead) continue;
    const dx = pp.x - cop.x;
    const dy = pp.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    cop.angle = Math.atan2(dy, dx);
    if (dist > 26) {
      cop.x += (dx / dist) * cop.speed * dt;
      cop.y += (dy / dist) * cop.speed * dt;
      cop.bustTimer = 0;
    } else if (onFoot) {
      cop.bustTimer += dt;
      if (cop.bustTimer > BUST_SECONDS) {
        bustPlayer(state, audio);
        return;
      }
    }
    // Officers shoot when you are far and armed with heat.
    cop.shootCd -= dt;
    if (state.wanted >= 3 && dist > 120 && dist < 420 && cop.shootCd <= 0) {
      cop.shootCd = 1.1;
      state.bullets.push({ x: cop.x, y: cop.y, tx: pp.x, ty: pp.y, t: 0.09, fromPlayer: false });
      if (audio) audio.enemyShot();
    }
  }
  state.cops = state.cops.filter((c) => !c.dead);
}

function bustPlayer(state, audio) {
  const fine = Math.min(state.money, 200);
  state.money -= fine;
  state.busted = 3;
  state.wanted = 0;
  state.cops.length = 0;
  state.policeCars.length = 0;
  if (audio) {
    audio.siren(false);
    audio.bust();
  }
  showMessage(state, `BUSTED — fined $${fine}. The car is impounded.`);
}
