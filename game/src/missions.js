// The story: four missions for Jax Marlowe, a driver fresh out of luck in
// Solmar Bay, told through Mara the fixer and Deacon the fence. Each mission
// sets a world marker, an objective line and a reward; the loop in main.js
// calls updateMissions every step and tryInteract when the player presses E.
import { MISSION_REWARDS } from './config.js';
import { nearestRoadPoint } from './world.js';
import { addMoney, say, showBanner, showMessage } from './state.js';
import { spawnEnemy } from './combat.js';

export const MISSIONS = [
  {
    name: 'The Getaway',
    intro: 'Mara: "Jax. You drive, we eat. A gold Comet is waiting at the marina car park. Take it to the old boathouse, north side. No cops, no heroes."',
    objective: 'Steal the gold Comet GT at the marina, then drive it to the boathouse.',
  },
  {
    name: 'Package Run',
    intro: 'Mara: "Deacon stashed five packages around town before the raid. Collect them all. The cops are watching the usual spots, so keep moving."',
    objective: 'Collect all 5 packages around Solmar Bay.',
  },
  {
    name: 'Lay Low',
    intro: 'Deacon: "You made the evening news, kid. Three stars. Sit tight, ditch the heat, and do NOT do anything stupid until the radio goes quiet."',
    objective: 'Lose your 3-star wanted level — lay low until the heat dies down.',
  },
  {
    name: 'The Big Score',
    intro: 'Mara: "Last job. The Meridian Bank vault opens at noon and the crew is in place. Grab the loot, hold off the guards, and get it to the beach. Then we are done."',
    objective: 'Hit the Meridian Bank, grab the loot and deliver it to the beach.',
  },
];

const PACKAGE_SPOTS = [
  [840, 840], [2340, 540], [540, 2040], [2640, 2340], [1740, 2940],
];

export function startMission(state, index) {
  const m = state.mission;
  m.index = index;
  m.stage = 0;
  m.done = false;
  m.collected = 0;
  m.timer = 0;
  const def = MISSIONS[index];
  m.text = def.objective;
  m.reward = MISSION_REWARDS[index];
  say(state, index === 2 ? 'Deacon' : 'Mara', def.intro, 7);
  showBanner(state, `Mission ${index + 1}: ${def.name}`, def.objective, 4);

  if (index === 0) {
    const car = state.cars.find((c) => c.id === state.getawayCarId);
    m.marker = car ? { x: car.x, y: car.y, label: 'Getaway car' } : { x: 1180, y: 2880, label: 'Getaway car' };
  } else if (index === 1) {
    state.pickups.length = 0;
    for (const [x, y] of PACKAGE_SPOTS) {
      const spot = nearestRoadPoint(state.city, x, y, state.rng);
      state.pickups.push({ x: spot.x, y: spot.y, kind: 'package', taken: false });
    }
    m.needed = state.pickups.length;
    m.marker = { x: state.pickups[0].x, y: state.pickups[0].y, label: 'Package' };
  } else if (index === 2) {
    state.wanted = 3;
    state.wantedTimer = 0;
    state.quietTimer = 0;
    m.marker = null;
    m.timer = 0;
  } else if (index === 3) {
    const bank = nearestRoadPoint(state.city, 1540, 1540, state.rng);
    m.marker = { x: bank.x, y: bank.y, label: 'Meridian Bank' };
    m.bank = { x: bank.x, y: bank.y };
  }
}

function completeMission(state, audio) {
  const m = state.mission;
  const reward = m.reward;
  addMoney(state, reward);
  state.stats.missionsDone += 1;
  m.done = true;
  showBanner(state, `Mission complete — $${reward}`, MISSIONS[m.index].name, 4);
  showMessage(state, `+$${reward}. ${m.index + 1 < MISSIONS.length ? 'Next job is on the map.' : 'That is the whole story.'}`);
  if (audio) audio.missionDone();
  if (m.index + 1 < MISSIONS.length) {
    startMission(state, m.index + 1);
  } else {
    m.allDone = true;
    m.marker = null;
    m.text = 'Story complete — Solmar Bay is yours. Free roam, steal cars, dodge the law.';
    say(state, 'Mara', 'Mara: "That is every job, Jax. The bay is yours now. Try not to get busted before lunch."', 7);
  }
}

export function updateMissions(state, dt, audio) {
  const m = state.mission;
  if (m.allDone || m.done) return;
  const p = state.player;
  const px = p.inCar !== null ? (state.cars.find((c) => c.id === p.inCar) || { x: p.x, y: p.y }).x : p.x;
  const py = p.inCar !== null ? (state.cars.find((c) => c.id === p.inCar) || { x: p.x, y: p.y }).y : p.y;

  if (m.index === 0) {
    const car = state.cars.find((c) => c.id === state.getawayCarId);
    if (m.stage === 0) {
      if (p.inCar === state.getawayCarId) {
        m.stage = 1;
        const drop = nearestRoadPoint(state.city, 600, 600, state.rng);
        m.marker = { x: drop.x, y: drop.y, label: 'Boathouse drop-off' };
        m.text = 'Drive the Comet GT to the boathouse drop-off (north side).';
        say(state, 'Mara', 'Mara: "That is the one. Easy does it — the boathouse is on the north side."', 5);
      } else if (car) {
        m.marker = { x: car.x, y: car.y, label: 'Getaway car' };
      }
    } else if (m.marker && Math.hypot(px - m.marker.x, py - m.marker.y) < 110) {
      completeMission(state, audio);
    }
  } else if (m.index === 1) {
    let remaining = null;
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      if (Math.hypot(px - pk.x, py - pk.y) < 46) {
        pk.taken = true;
        m.collected += 1;
        addMoney(state, 50);
        showMessage(state, `Package ${m.collected}/${m.needed} — +$50`);
        if (audio) audio.pickup();
      }
      if (!pk.taken && remaining === null) remaining = pk;
    }
    state.pickups = state.pickups.filter((pk) => !pk.taken);
    if (remaining) m.marker = { x: remaining.x, y: remaining.y, label: 'Package' };
    m.text = `Collect the packages: ${m.collected}/${m.needed} found.`;
    if (m.collected >= m.needed) completeMission(state, audio);
  } else if (m.index === 2) {
    m.timer += dt;
    m.text = `Lay low until the heat dies down — wanted: ${state.wanted} star${state.wanted === 1 ? '' : 's'}.`;
    if (state.wanted === 0) {
      say(state, 'Deacon', 'Deacon: "Radio is quiet. You are a ghost again. Nice work, kid."', 5);
      completeMission(state, audio);
    }
  } else if (m.index === 3) {
    if (m.stage === 0) {
      m.text = 'Go to the Meridian Bank and press E to grab the loot.';
      if (m.marker) m.marker = { x: m.bank.x, y: m.bank.y, label: 'Meridian Bank' };
    } else if (m.stage === 1) {
      m.text = 'Escape to the beach drop-off — do not get busted with the loot!';
      if (m.marker && Math.hypot(px - m.marker.x, py - m.marker.y) < 110) {
        completeMission(state, audio);
      }
    }
  }
}

// E near the bank during the finale: grab the loot, wake the guards and the law.
export function tryMissionInteract(state, audio) {
  const m = state.mission;
  if (m.index !== 3 || m.stage !== 0 || m.done) return false;
  const p = state.player;
  const d = Math.hypot(p.x - m.bank.x, p.y - m.bank.y);
  if (d > 130) return false;
  m.stage = 1;
  state.wanted = 4;
  state.wantedTimer = 0;
  state.quietTimer = 0;
  spawnEnemy(state, m.bank.x + 90, m.bank.y - 60);
  spawnEnemy(state, m.bank.x - 90, m.bank.y + 70);
  spawnEnemy(state, m.bank.x + 40, m.bank.y + 120);
  const beach = { x: 3290, y: 1800 };
  m.marker = { x: beach.x, y: beach.y, label: 'Beach drop-off' };
  showBanner(state, 'The loot is yours!', 'Guards are coming — run for the beach.', 4);
  say(state, 'Mara', 'Mara: "Four stars and counting! Get to the beach, Jax — do NOT stop!"', 6);
  if (audio) audio.pickup();
  return true;
}
