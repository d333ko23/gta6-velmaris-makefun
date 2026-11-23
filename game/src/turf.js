// Turf control: each district holds a control percent. Finishing a job in a
// district raises it; every 30 seconds of play the controlled turf pays out in
// cash. The HUD shows the total as one number.

import { DISTRICTS, TURF_INCOME_PER_POINT } from './config.js';

export function createTurf(state) {
  return { incomeTimer: 0, lastPayout: 0 };
}

export function districtName(id) {
  const found = DISTRICTS.find((d) => d.id === id);
  return found ? found.name : id;
}

/** Add control to a district, capped at 100. */
export function addTurf(state, districtId, amount) {
  state.turf[districtId] = Math.min(100, (state.turf[districtId] || 0) + amount);
}

/** One step: pay out every 30 s. Returns the dollars paid this step, if any. */
export function stepTurf(turf, state, dt) {
  turf.incomeTimer += dt;
  if (turf.incomeTimer < 30) return 0;
  turf.incomeTimer -= 30;
  let points = 0;
  for (const key of Object.keys(state.turf)) points += state.turf[key];
  const payout = Math.round(points * TURF_INCOME_PER_POINT);
  if (payout > 0) {
    state.cash += payout;
    state.totalEarned += payout;
  }
  turf.lastPayout = payout;
  return payout;
}
