// One fixed step of the live game: clock, player, cars, traffic, pedestrians,
// police, enemies, bullets, missions, particles and the camera. main.js calls
// this every 1/60 s while playing; shots.js calls it to stage screenshots.
import { STEP, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './config.js';
import { updatePlayer } from './player.js';
import { drivePlayerCar, enterCar, exitCar, nearestEnterableCar, updateTraffic } from './vehicles.js';
import { updatePeds } from './player.js';
import { updatePolice, updateWanted } from './police.js';
import { updateBullets, updateEnemies } from './combat.js';
import { tryMissionInteract, updateMissions } from './missions.js';
import { playerCar, playerPos, respawnPlayer, showMessage } from './state.js';
import { saveGame } from './save.js';

export function stepGame(state, input, dt, audio) {
  state.time += dt;
  state.timeMinutes += dt / 3; // one game minute every 3 real seconds
  if (state.timeMinutes >= 24 * 60) state.timeMinutes -= 24 * 60;

  // Countdowns.
  if (state.dialogue.t > 0) state.dialogue.t -= dt;
  if (state.message.t > 0) state.message.t -= dt;
  if (state.banner.t > 0) state.banner.t -= dt;
  if (state.flash > 0) state.flash -= dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);

  // Busted / wasted overlays freeze the world while they show.
  if (state.busted > 0) {
    state.busted -= dt;
    if (state.busted <= 0) {
      state.busted = 0;
      respawnPlayer(state, 'police');
      showMessage(state, 'You are out. Do not make it a habit.');
    }
    return;
  }
  if (state.wasted > 0) {
    state.wasted -= dt;
    if (state.wasted <= 0) {
      state.wasted = 0;
      state.money = Math.max(0, state.money - 150);
      respawnPlayer(state, 'hospital');
      showMessage(state, 'Patched up at St. Marina Hospital. -$150.');
    }
    return;
  }

  // Camera follows the player (or their car), clamped to the city.
  const pp = playerPos(state);
  state.camera.x = Math.max(0, Math.min(WORLD_W - VIEW_W, pp.x - VIEW_W / 2));
  state.camera.y = Math.max(0, Math.min(WORLD_H - VIEW_H, pp.y - VIEW_H / 2));

  // Interact: step out of a car, grab mission loot, or steal a nearby car.
  if (input.wasPressed('interact')) {
    const car = playerCar(state);
    if (car) {
      exitCar(state, audio);
    } else if (!tryMissionInteract(state, audio)) {
      const near = nearestEnterableCar(state, 64);
      if (near) enterCar(state, near, audio);
    }
  }

  if (state.player.inCar !== null) {
    const car = playerCar(state);
    if (car) drivePlayerCar(state, car, input, dt, audio);
    else state.player.inCar = null;
  } else {
    updatePlayer(state, input, dt, audio);
    if (audio) audio.engine(0);
  }

  // Slow health recovery while the heat is off.
  if (state.wanted === 0 && state.player.hp > 0 && state.player.hp < state.player.maxHp) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 3 * dt);
  }

  updateTraffic(state, dt);
  updatePeds(state, dt);
  updateWanted(state, dt, audio);
  updatePolice(state, dt, audio);
  updateEnemies(state, dt, audio);
  updateBullets(state, dt, audio);
  updateMissions(state, dt, audio);

  // Particles drift and fade.
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy -= 20 * dt;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);

  // Autosave every 20 seconds so Continue is never far behind.
  state.saveTimer += dt;
  if (state.saveTimer > 20) {
    state.saveTimer = 0;
    saveGame(state);
  }
}

// Ambient motion behind the title screen: traffic and pedestrians only.
export function stepAmbient(state, dt) {
  state.time += dt;
  updateTraffic(state, dt);
  updatePeds(state, dt);
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
}

export { STEP };
