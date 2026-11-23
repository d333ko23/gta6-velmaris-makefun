// The crew: three specialists the player hires once, each with a different edge in
// a job. Hiring is permanent and saved; bonuses are read by the missions and the
// police modules through the small helpers below.

import { CREW_DEFS } from './config.js';

export function createCrew(state) {
  return { hired: state.crew.slice() };
}

export function hireCrewMember(crew, state, memberId) {
  const def = CREW_DEFS.find((c) => c.id === memberId);
  if (!def || crew.hired.includes(memberId)) return false;
  if (state.cash < def.cost) return false;
  state.cash -= def.cost;
  crew.hired.push(memberId);
  state.crew = crew.hired.slice();
  return true;
}

/** Loot multiplier from the hired crew (Mira the hacker). */
export function crewLootMult(crew) {
  return crew.hired.includes('mira') ? 1.1 : 1;
}

/** How much faster wanted decays with Rook driving the getaway. */
export function crewDecayMult(crew) {
  return crew.hired.includes('rook') ? 1.3 : 1;
}

/** Hold steps run faster with Mira, and faster still with a lockpick set. */
export function crewHoldMult(crew, hasLockpick) {
  let mult = 1;
  if (crew.hired.includes('mira')) mult *= 1.25;
  if (hasLockpick) mult *= 1.3;
  return mult;
}

/** Brute smashes roadblocks aside instead of the player stopping for them. */
export function crewSmashesRoadblocks(crew) {
  return crew.hired.includes('brute');
}
