// Save / load through localStorage. Only plain numbers and small facts are
// stored: money, position, mission progress, clock and wanted level. A corrupt
// or missing save simply means "no continue available".
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      money: state.money,
      missionIndex: state.mission.index,
      missionDone: state.mission.done,
      timeMinutes: state.timeMinutes,
      wanted: state.wanted,
      player: { x: state.player.x, y: state.player.y, hp: state.player.hp },
      stats: state.stats,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage off: nothing to clear.
  }
}
