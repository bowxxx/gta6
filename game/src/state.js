// The whole game state in one object, built fresh per seed. state.js owns
// creation and reset; the other modules each update one slice of it.
import {
  CAR_MAX_SPEED, PLAYER_MAX_HP, START_MONEY, START_TIME_MINUTES,
} from './config.js';
import { createRandom } from './random.js';
import { generateCity, nearestRoadPoint } from './world.js';
import { makeCar, spawnParkedCars, spawnTraffic } from './vehicles.js';
import { spawnPedestrians } from './player.js';
import { startMission } from './missions.js';

export const CITY_NAME = 'Solmar Bay';

export function createGame(seed) {
  const rng = createRandom(seed);
  const city = generateCity(rng);

  const state = {
    seed,
    rng,
    city,
    time: 0, // seconds since the game started
    timeMinutes: START_TIME_MINUTES,
    money: START_MONEY,
    wanted: 0,
    wantedTimer: 0,
    quietTimer: 0,
    stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0, missionsDone: 0, crashes: 0 },
    player: {
      x: 0, y: 0, angle: -Math.PI / 2, hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP,
      inCar: null, moving: false, shootCd: 0, punchCd: 0, invuln: 0,
      aimX: 0, aimY: 0,
    },
    cars: [],
    peds: [],
    cops: [], // on-foot officers
    policeCars: [],
    enemies: [],
    bullets: [],
    particles: [],
    pickups: [],
    mission: {
      index: 0, stage: 0, done: false, allDone: false,
      marker: null, timer: 0, collected: 0, needed: 0,
      text: '', reward: 0,
    },
    dialogue: { speaker: '', text: '', t: 0 },
    message: { text: '', t: 0 },
    banner: { text: '', sub: '', t: 0 },
    camera: { x: 0, y: 0 },
    flash: 0, // white/red screen flash timer
    shake: 0,
    busted: 0, // countdown while the BUSTED overlay shows
    wasted: 0, // countdown while the WASTED overlay shows
    saveTimer: 0,
  };

  // Player starts on the promenade near the south-west marina, on foot.
  const start = nearestRoadPoint(city, 540, 2940, rng);
  state.player.x = start.x;
  state.player.y = start.y + 60;

  // A few parked cars near the start so the first steal is seconds away.
  spawnParkedCars(state, 26);
  spawnTraffic(state, 16);
  spawnPedestrians(state, 42);

  // The getaway car for mission 1 waits in the marina car park.
  const getaway = makeCar(state, 1180, 2880, Math.PI / 2, '#e8b93b', 'Comet GT', { special: 'getaway' });
  state.cars.push(getaway);
  state.getawayCarId = getaway.id;

  startMission(state, 0);
  return state;
}

// Put the player back on their feet after a bust or a wipe, at a safe place.
export function respawnPlayer(state, place) {
  const p = state.player;
  if (p.inCar) {
    const car = state.cars.find((c) => c.id === p.inCar);
    if (car) car.driver = 'parked';
    p.inCar = null;
  }
  const spot = place === 'hospital'
    ? { x: 540, y: 840 }
    : { x: 540, y: 2940 };
  p.x = spot.x;
  p.y = spot.y;
  p.hp = p.maxHp;
  p.angle = -Math.PI / 2;
  state.wanted = 0;
  state.wantedTimer = 0;
  state.cops.length = 0;
  state.policeCars.length = 0;
  state.enemies.length = 0;
}

export function addMoney(state, amount) {
  state.money = Math.max(0, state.money + amount);
}

export function showMessage(state, text, seconds) {
  state.message = { text, t: seconds || 3 };
}

export function showBanner(state, text, sub, seconds) {
  state.banner = { text, sub: sub || '', t: seconds || 3 };
}

export function say(state, speaker, text, seconds) {
  state.dialogue = { speaker, text, t: seconds || 5 };
}

export function addParticles(state, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const s = state.rng.range(speed * 0.3, speed);
    state.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: state.rng.range(0.3, 0.8), maxLife: 0.8, color, size: state.rng.range(2, 5),
    });
  }
  if (state.particles.length > 400) state.particles.splice(0, state.particles.length - 400);
}

export function playerCar(state) {
  if (state.player.inCar === null) return null;
  return state.cars.find((c) => c.id === state.player.inCar) || null;
}

export function playerPos(state) {
  const car = playerCar(state);
  if (car) return { x: car.x, y: car.y };
  return { x: state.player.x, y: state.player.y };
}

export function playerSpeed(state) {
  const car = playerCar(state);
  return car ? Math.abs(car.speed) : 0;
}

export { CAR_MAX_SPEED };
