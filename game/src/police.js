// The Velmaris Police Department: a wanted level from 0 to 5 stars, patrol cars
// that chase, roadblocks at 3 stars, PIT/RAM units at 4, and the "Air One"
// helicopter at 5. Wanted fades when no unit can see the player; getting caught
// while slow or on foot means busted.

import { CAR, HORIZONTAL_ROADS, LANDMARKS, VERTICAL_ROADS, WANTED, WORLD } from './config.js';
import { pickRandom, rangeRandom } from './random.js';

export const EVENT_BUSTED = 1;
export const EVENT_HIT_PED = 2;

function spawnPointNear(random, x, y) {
  const road = pickRandom(random, VERTICAL_ROADS.concat(HORIZONTAL_ROADS));
  const vertical = VERTICAL_ROADS.includes(road);
  const along = rangeRandom(random, 300, WORLD.height - 300);
  const offset = rangeRandom(random, 500, 900) * (random() < 0.5 ? -1 : 1);
  if (vertical) return { x: road, y: Math.max(280, Math.min(WORLD.height - 40, y + offset)) };
  return { x: Math.max(40, Math.min(WORLD.width - 40, x + offset)), y: road };
}

export function createPolice(random) {
  return {
    random,
    wanted: 0,
    heat: 0, // 0..1: how sure the VPD is where the player is
    units: [], // {x,y,angle,speed,kind:'patrol'|'pit',bustTimer}
    roadblocks: [], // {x,y,angle} stationary police cars
    heli: { active: false, angle: 0, x: 0, y: 0 },
    decayTimer: 0,
    spawnTimer: 0,
    bustTimer: 0,
    siren: false,
  };
}

export function addWanted(police, amount, reason) {
  police.wanted = Math.max(0, Math.min(WANTED.max, police.wanted + amount));
  police.heat = 1;
  police.decayTimer = 0;
  return reason;
}

function spawnUnit(police, x, y, kind) {
  const spot = spawnPointNear(police.random, x, y);
  police.units.push({
    x: spot.x, y: spot.y, angle: 0, speed: 0,
    kind: kind || 'patrol', bustTimer: 0,
  });
}

function placeRoadblocks(police, x, y) {
  police.roadblocks = [];
  const aheadX = Math.max(120, Math.min(WORLD.width - 120, x + 420));
  const aheadY = Math.max(280, Math.min(WORLD.height - 120, y));
  police.roadblocks.push({ x: aheadX, y: aheadY, angle: Math.PI / 2 });
  police.roadblocks.push({ x: aheadX + 70, y: aheadY + 40, angle: Math.PI / 2 });
  if (police.wanted >= 4) police.roadblocks.push({ x: aheadX - 70, y: aheadY - 40, angle: Math.PI / 2 });
}

/**
 * One step of the VPD. `player` is {x, y, inCar, car, speed, onFoot}. Returns
 * EVENT_BUSTED when a unit catches the player, else 0. `mod` carries the job's
 * modifiers: { spawnRate, decayMult }.
 */
export function stepPolice(police, player, dt, mod) {
  const spawnRate = (mod && mod.spawnRate) || 1;
  const decayMult = (mod && mod.decayMult) || 1;
  let events = 0;

  // How many units the wanted level calls for.
  const want = police.wanted;
  const targetUnits = want === 0 ? 0 : want <= 2 ? want : want <= 4 ? want + 1 : 7;
  police.spawnTimer -= dt;
  if (police.units.length < targetUnits && police.spawnTimer <= 0) {
    const kind = want >= 4 && police.units.filter((u) => u.kind === 'pit').length < 2 ? 'pit' : 'patrol';
    spawnUnit(police, player.x, player.y, kind);
    police.spawnTimer = 1.6 / spawnRate;
  }
  if (police.units.length > targetUnits) police.units.splice(targetUnits);

  // Roadblocks from 3 stars up; the helicopter at 5.
  if (want >= 3 && police.roadblocks.length === 0) placeRoadblocks(police, player.x, player.y);
  if (want < 3) police.roadblocks = [];
  police.heli.active = want >= 5;
  if (police.heli.active) {
    police.heli.angle += dt * 0.5;
    police.heli.x = player.x + Math.cos(police.heli.angle) * 220;
    police.heli.y = player.y + Math.sin(police.heli.angle) * 220 - 60;
  }

  // Chase: steer toward the player, PIT units faster and ramming.
  let nearest = Infinity;
  for (const unit of police.units) {
    const dx = player.x - unit.x;
    const dy = player.y - unit.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < nearest) nearest = dist;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - unit.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const top = unit.kind === 'pit' ? 560 : 420 + want * 22;
    unit.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    unit.speed = Math.min(top, unit.speed + 380 * dt);
    unit.x += Math.cos(unit.angle) * unit.speed * dt;
    unit.y += Math.sin(unit.angle) * unit.speed * dt;
    // PIT: a hard shove when close to the player's car.
    if (unit.kind === 'pit' && dist < 70 && player.inCar && player.car) {
      player.car.speed *= 0.82;
      player.car.angle += (Math.random() - 0.5) * 0.35;
      unit.speed *= 0.9;
    }
    // Busted: caught while slow or on foot.
    const playerSlow = !player.inCar || Math.abs(player.car ? player.car.speed : 0) < 45;
    if (dist < 46 && playerSlow) {
      unit.bustTimer += dt;
      if (unit.bustTimer > 1.4) {
        events |= EVENT_BUSTED;
        unit.bustTimer = 0;
      }
    } else {
      unit.bustTimer = 0;
    }
  }

  // Wanted fades when the VPD loses sight of the player.
  if (want > 0) {
    if (nearest > 620) {
      police.decayTimer += dt * decayMult;
      if (police.decayTimer >= WANTED.decaySeconds) {
        police.wanted -= 1;
        police.decayTimer = 0;
        if (police.wanted === 0) police.units = [];
      }
    } else {
      police.decayTimer = 0;
    }
  }
  police.siren = want >= 2;
  return events;
}

/** Clear all heat: used after being busted or finishing a clean escape. */
export function clearWanted(police) {
  police.wanted = 0;
  police.heat = 0;
  police.units = [];
  police.roadblocks = [];
  police.heli.active = false;
  police.decayTimer = 0;
}

export function policeCarCount(police) {
  return police.units.length;
}
