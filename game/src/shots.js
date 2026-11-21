// The screenshot scenes behind ?shot=drive|chase|mission|start. Each one plays
// the real game forward from a fresh world, steered by a small autopilot, so
// the frame is what real play looks like and the same seed gives the same
// frame. Audio is silenced while staging.
import { STEP } from './config.js';
import { createGame, say, showBanner } from './state.js';
import { stepAmbient, stepGame } from './update.js';
import { startMission } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { enterCar, makeCar } from './vehicles.js';
import { addWanted } from './police.js';

const SILENT = {
  engine() {}, siren() {}, shot() {}, enemyShot() {}, crash() {}, punch() {},
  pickup() {}, coin() {}, ui() {}, bust() {}, missionDone() {}, ensure() { return false; },
};

function fakeInput() {
  const held = new Set();
  const pressed = new Set();
  return {
    held,
    mouse: { x: 640, y: 300, clicked: false, down: false },
    isDown(action) { return held.has(action); },
    wasPressed(action) { return pressed.has(action); },
    press(action) { pressed.add(action); held.add(action); },
    release(action) { held.delete(action); },
    endFrame() { pressed.clear(); this.mouse.clicked = false; },
  };
}

// Steer a car toward a point: throttle on, steer by the angle difference.
function driveToward(input, state, tx, ty) {
  const car = state.cars.find((c) => c.id === state.player.inCar);
  if (!car) return;
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  input.held.clear();
  input.held.add('up');
  if (diff > 0.12) input.held.add('right');
  else if (diff < -0.12) input.held.add('left');
}

function stepN(state, input, n) {
  for (let i = 0; i < n; i += 1) {
    stepGame(state, input, STEP, SILENT);
    input.endFrame();
  }
}

export function stageShot(name, state) {
  const input = fakeInput();
  if (name === 'start') {
    // A busy downtown view behind the title panel.
    state.camera.x = 1080;
    state.camera.y = 1080;
    state.player.x = 1300;
    state.player.y = 1300;
    for (let i = 0; i < 6 * 60; i += 1) stepAmbient(state, STEP);
    return { screen: SCREEN_TITLE, state };
  }

  if (name === 'chase') {
    // Steal the getaway car on the southern boulevard, earn 3 stars, then
    // drive east along the same road with two interceptors on the tail.
    const car = state.cars.find((c) => c.id === state.getawayCarId) || state.cars[0];
    car.x = 700; car.y = 2940; car.angle = 0; car.speed = 0;
    state.player.x = car.x - 30;
    state.player.y = car.y;
    enterCar(state, car, SILENT);
    addWanted(state, 2); // enterCar already added 1 star for the theft: 3 total
    say(state, 'Mara', 'Mara: "Three stars, Jax — lose them before the whole PD shows up!"', 6);
    state.mission.text = 'Lose your 3-star wanted level — lay low until the heat dies down.';
    for (let i = 0; i < 7 * 60; i += 1) {
      driveToward(input, state, 3100, 2940);
      stepGame(state, input, STEP, SILENT);
      input.endFrame();
    }
    // Freeze the frame the shot wants: exactly 3 stars, the warning up.
    state.wanted = 3;
    state.mission.text = 'Lose your 3-star wanted level — lay low until the heat dies down.';
    say(state, 'Mara', 'Mara: "Three stars, Jax — lose them before the whole PD shows up!"', 6);
    return { screen: SCREEN_PLAY, state };
  }

  if (name === 'mission') {
    // Package run in progress: one package collected, the next marked, with
    // Mara talking and traffic and pedestrians all around.
    startMission(state, 1);
    const pk = state.pickups[0];
    state.player.x = pk.x - 120;
    state.player.y = pk.y + 40;
    state.mission.collected = 1;
    state.mission.text = 'Collect the packages: 1/5 found.';
    say(state, 'Mara', 'Mara: "One down, four to go. The next package is marked — keep moving, the cops watch the usual spots."', 7);
    showBanner(state, 'Mission 2: Package Run', 'Collect all 5 packages around Solmar Bay.', 6);
    for (let i = 0; i < 4 * 60; i += 1) {
      stepGame(state, input, STEP, SILENT);
      input.endFrame();
    }
    return { screen: SCREEN_PLAY, state };
  }

  // Default: drive — the cover. Steal the gold getaway Comet on the southern
  // boulevard and cruise east past traffic and pedestrians, HUD and minimap
  // in frame, the boathouse marker waiting to the north.
  const car = state.cars.find((c) => c.id === state.getawayCarId) || state.cars[0];
  car.x = 700; car.y = 2940; car.angle = 0; car.speed = 0;
  state.player.x = car.x - 30;
  state.player.y = car.y;
  enterCar(state, car, SILENT);
  state.wanted = 0;
  for (let i = 0; i < 3.5 * 60; i += 1) {
    driveToward(input, state, 3100, 2940);
    stepGame(state, input, STEP, SILENT);
    input.endFrame();
  }
  state.wanted = 0; // a clean cover: no stray star from a bumped pedestrian
  return { screen: SCREEN_PLAY, state };
}

export { createGame };
export { makeCar };
