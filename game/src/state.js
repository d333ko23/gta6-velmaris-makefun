// The game's persistent state: cash, jobs finished, turf, crew, garage upgrades,
// the clock and the best score. save() writes it to localStorage; load() reads it
// back at boot. Nothing here draws or steps the world.

import { BEST_KEY, DISTRICTS, SAVE_KEY } from './config.js';

export function createGameState() {
  const turf = {};
  for (const district of DISTRICTS) turf[district.id] = district.id === 'harbor' ? 20 : 0;
  return {
    cash: 500,
    jobsDone: 0,
    turf,
    crew: [],
    upgrades: { engine: 0, armor: 0, tires: 0 },
    timeOfDay: 10, // 10:00 in the morning
    bestScore: 0,
    totalEarned: 0,
  };
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      jobsDone: state.jobsDone,
      turf: state.turf,
      crew: state.crew,
      upgrades: state.upgrades,
      timeOfDay: state.timeOfDay,
      bestScore: state.bestScore,
      totalEarned: state.totalEarned,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.cash !== 'number') return null;
    const state = createGameState();
    state.cash = data.cash;
    state.jobsDone = data.jobsDone || 0;
    if (data.turf) for (const key of Object.keys(state.turf)) {
      if (typeof data.turf[key] === 'number') state.turf[key] = Math.max(0, Math.min(100, data.turf[key]));
    }
    if (Array.isArray(data.crew)) state.crew = data.crew.filter((id) => typeof id === 'string');
    if (data.upgrades) {
      for (const key of Object.keys(state.upgrades)) {
        if (typeof data.upgrades[key] === 'number') state.upgrades[key] = data.upgrades[key];
      }
    }
    if (typeof data.timeOfDay === 'number') state.timeOfDay = data.timeOfDay;
    if (typeof data.bestScore === 'number') state.bestScore = data.bestScore;
    if (typeof data.totalEarned === 'number') state.totalEarned = data.totalEarned;
    return state;
  } catch {
    return null;
  }
}

export function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Best score then lasts this visit only.
  }
}

/** Dollars as a readable string, e.g. 12500 -> "$12,500". */
export function money(value) {
  return '$' + Math.round(value).toLocaleString('en-US');
}

/** Total turf control across all districts, as a percent. */
export function totalTurfPercent(state) {
  let sum = 0;
  for (const key of Object.keys(state.turf)) sum += state.turf[key];
  return Math.round(sum / Object.keys(state.turf).length);
}
