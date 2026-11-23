// The Garage: buy permanent upgrades for every car the player drives, and repair
// a wrecked one. Upgrades live in the saved state, so they survive between visits.

import { CAR, REPAIR_COST, UPGRADES } from './config.js';

export function createGarage(state) {
  return { lastBought: '' };
}

export function upgradeCost(kind, level) {
  const def = UPGRADES[kind];
  if (!def || level >= def.costs.length) return null;
  return def.costs[level];
}

export function buyUpgrade(garage, state, kind) {
  const level = state.upgrades[kind] || 0;
  const cost = upgradeCost(kind, level);
  if (cost === null || state.cash < cost) return false;
  state.cash -= cost;
  state.upgrades[kind] = level + 1;
  garage.lastBought = `${UPGRADES[kind].name} Lv${level + 1}`;
  return true;
}

export function repairCar(garage, state, car) {
  if (!car || car.health >= CAR.health || state.cash < REPAIR_COST) return false;
  state.cash -= REPAIR_COST;
  car.health = CAR.health;
  garage.lastBought = 'Repaired to full';
  return true;
}

/** The car's tuned stats from the saved upgrades. */
export function tunedCarStats(state) {
  const up = state.upgrades;
  return {
    topSpeed: CAR.topSpeed * (1 + 0.12 * (up.engine || 0)),
    armor: 1 - 0.25 * (up.armor || 0),
    steer: CAR.steer * (1 + 0.2 * (up.tires || 0)),
  };
}
