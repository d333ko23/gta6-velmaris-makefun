// Traffic and pedestrians: cars that cruise the road grid in their lanes and slow
// for the car ahead, and walkers who stroll the sidewalks. Both are pure scenery
// with collisions — the player can steal any traffic car.

import { CAR, HORIZONTAL_ROADS, TRAFFIC_COLORS, VERTICAL_ROADS, WORLD } from './config.js';
import { pickRandom, rangeRandom } from './random.js';
import { pushOutOfBuildings } from './city.js';

const TRAFFIC_COUNT = 26;
const PED_COUNT = 34;

function randomRoadPoint(random) {
  if (random() < 0.5) {
    return { x: pickRandom(random, VERTICAL_ROADS), y: rangeRandom(random, 240, WORLD.height - 40), vertical: true };
  }
  return { x: rangeRandom(random, 40, WORLD.width - 40), y: pickRandom(random, HORIZONTAL_ROADS), vertical: false };
}

export function createTraffic(random) {
  const cars = [];
  for (let index = 0; index < TRAFFIC_COUNT; index += 1) {
    const spot = randomRoadPoint(random);
    const dir = random() < 0.5 ? 1 : -1;
    cars.push({
      x: spot.x, y: spot.y,
      angle: spot.vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: rangeRandom(random, 90, 170),
      baseSpeed: 0,
      color: pickRandom(random, TRAFFIC_COLORS),
      vertical: spot.vertical, dir,
      kind: 'traffic',
      health: CAR.health,
      stolen: false,
    });
    cars[cars.length - 1].baseSpeed = cars[cars.length - 1].speed;
  }
  const peds = [];
  for (let index = 0; index < PED_COUNT; index += 1) {
    const spot = randomRoadPoint(random);
    const dir = random() < 0.5 ? 1 : -1;
    peds.push({
      x: spot.x + (spot.vertical ? 62 : 0), y: spot.y + (spot.vertical ? 0 : 62),
      angle: spot.vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: rangeRandom(random, 28, 55),
      color: pickRandom(random, TRAFFIC_COLORS),
      vertical: spot.vertical, dir,
      walkPhase: random() * Math.PI * 2,
      flee: 0,
    });
  }
  return { cars, peds };
}

function carAhead(cars, self) {
  let nearest = Infinity;
  for (const other of cars) {
    if (other === self || !other) continue;
    const dx = other.x - self.x;
    const dy = other.y - self.y;
    const ahead = dx * Math.cos(self.angle) + dy * Math.sin(self.angle);
    const side = Math.abs(-dx * Math.sin(self.angle) + dy * Math.cos(self.angle));
    if (ahead > 0 && ahead < 110 && side < 30 && ahead < nearest) nearest = ahead;
  }
  return nearest;
}

function moveAlongRoad(body, dt, speed) {
  body.x += Math.cos(body.angle) * speed * dt;
  body.y += Math.sin(body.angle) * speed * dt;
}

function respawnAtEdge(random, body) {
  const spot = randomRoadPoint(random);
  body.x = spot.x;
  body.y = spot.y;
  body.vertical = spot.vertical;
  body.dir = random() < 0.5 ? 1 : -1;
  body.angle = spot.vertical ? (body.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (body.dir > 0 ? 0 : Math.PI);
}

/**
 * Advance traffic and pedestrians one step. `allCars` includes the player's car and
 * police cars so traffic slows for them too. Returns nothing; peds hit by a fast car
 * are knocked down and respawn at an edge.
 */
export function stepTraffic(traffic, allCars, player, dt, random) {
  for (const car of traffic.cars) {
    if (car.stolen) continue; // a stolen car is driven by the player now
    const ahead = carAhead(allCars, car);
    const target = ahead < 110 ? 0 : car.baseSpeed;
    car.speed += (target - car.speed) * Math.min(1, dt * 2);
    moveAlongRoad(car, dt, car.speed);
    if (car.x < -60 || car.x > WORLD.width + 60 || car.y < 180 || car.y > WORLD.height + 60) {
      respawnAtEdge(random, car);
    }
  }
  for (const ped of traffic.peds) {
    if (ped.flee > 0) {
      ped.flee -= dt;
      moveAlongRoad(ped, dt, ped.speed * 2.4);
    } else {
      moveAlongRoad(ped, dt, ped.speed);
    }
    ped.walkPhase += dt * 6;
    // Turn around at the map edge or, sometimes, at an intersection.
    if (ped.x < 60 || ped.x > WORLD.width - 60 || ped.y < 260 || ped.y > WORLD.height - 60) {
      ped.dir *= -1;
      ped.angle += Math.PI;
    } else if (random() < dt * 0.02) {
      ped.dir *= -1;
      ped.angle += Math.PI;
    }
    // A fast car nearby scares a pedestrian off the road.
    if (player && player.inCar && player.car) {
      const dx = ped.x - player.car.x;
      const dy = ped.y - player.car.y;
      if (dx * dx + dy * dy < 90 * 90 && Math.abs(player.car.speed) > 120) ped.flee = 1.2;
    }
  }
}

/** The nearest traffic car to (x, y) within `range`, or null. */
export function nearestTrafficCar(traffic, x, y, range) {
  let best = null;
  let bestD = range * range;
  for (const car of traffic.cars) {
    if (car.stolen) continue;
    const dx = car.x - x;
    const dy = car.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
