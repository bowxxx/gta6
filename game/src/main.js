// Boot and the one loop: Solmar Bay runs in fixed 1/60 s steps, the renderer
// paints what is there, and the game moves between title, play, paused and
// story-complete screens. New Game starts fresh; Continue loads the save.
//
// ?seed=N fixes the city. ?shot=drive|chase|mission|start (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP, VIEW_H, VIEW_W } from './config.js';
import { createGame, respawnPlayer } from './state.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { drawHUD } from './hud.js';
import { stepAmbient, stepGame } from './update.js';
import { stageShot } from './shots.js';
import { hasSave, loadSave, saveGame } from './save.js';
import { startMission } from './missions.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createGame(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();
const ctx = canvas.getContext('2d');

// The HUD draws on the same canvas after the world, in screen space.
function paintHUD(screen) {
  if (screen !== SCREEN_PLAY) return;
  const ratio = window.devicePixelRatio || 1;
  const scale = Math.min(canvas.width / ratio / VIEW_W, canvas.height / ratio / VIEW_H);
  const ox = (canvas.width / ratio - VIEW_W * scale) / 2;
  const oy = (canvas.height / ratio - VIEW_H * scale) / 2;
  ctx.save();
  ctx.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * ox, ratio * oy);
  drawHUD(ctx, state);
  ctx.restore();
}

function runShot(name) {
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, { hasSave: hasSave() });
    paintHUD(scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startFresh() {
    const fresh = createGame(Math.floor(Math.random() * 4294967296));
    Object.assign(state, fresh);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.ensure();
    audio.startMusic();
    announce('Playing. Follow the gold marker — Mara is waiting.');
  }

  function continueGame() {
    const save = loadSave();
    if (!save) { startFresh(); return; }
    state.money = save.money;
    state.timeMinutes = save.timeMinutes;
    state.wanted = save.wanted;
    state.player.x = save.player.x;
    state.player.y = save.player.y;
    state.player.hp = save.player.hp;
    state.stats = { ...state.stats, ...save.stats };
    // Resume the mission the save was on (its stage restarts cleanly).
    startMission(state, Math.min(save.missionIndex, 3));
    if (save.missionDone) {
      // A finished mission stays finished: jump to the next one.
      startMission(state, Math.min(save.missionIndex + 1, 3));
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.ensure();
    audio.startMusic();
    announce('Continued. Welcome back to Solmar Bay.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    if (input.wasPressed('mute')) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }

    if (screen === SCREEN_TITLE) {
      // Ambient city life behind the title; Enter/click starts.
      while (accumulator >= STEP) {
        stepAmbient(state, STEP);
        accumulator -= STEP;
      }
      if (input.wasPressed('newgame')) {
        startFresh();
      } else if (input.wasPressed('confirm') || input.mouse.clicked) {
        if (hasSave()) continueGame();
        else startFresh();
      }
      // Keep the title camera drifting over downtown.
      state.camera.x = 1080 + Math.sin(state.time * 0.05) * 160;
      state.camera.y = 1080 + Math.cos(state.time * 0.04) * 120;
    } else if (screen === SCREEN_PLAY) {
      if (input.wasPressed('pause')) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else {
        while (accumulator >= STEP) {
          stepGame(state, input, STEP, audio);
          accumulator -= STEP;
        }
        if (state.mission.allDone) screen = SCREEN_OVER;
      }
    } else if (screen === SCREEN_PAUSED) {
      accumulator = 0;
      if (input.wasPressed('pause') || input.wasPressed('confirm')) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_OVER) {
      accumulator = 0;
      if (input.wasPressed('confirm') || input.mouse.clicked) {
        screen = SCREEN_PLAY;
        state.mission.allDone = false;
        announce('Free roam. Solmar Bay is yours.');
      }
    }

    renderer.draw(state, screen, { hasSave: hasSave() });
    paintHUD(screen);
    input.endFrame();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(state);
      announce('Paused.');
    }
  });
  window.addEventListener('beforeunload', () => saveGame(state));

  announce('Solmar Bay. Press Enter or click to start.');
  // Debug/testing handle: lets automated checks drive the real game (teleport
  // the player, read state, force a save). It changes nothing about play.
  window.__solmar = {
    state,
    input,
    save: () => saveGame(state),
    version: 1,
  };
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
