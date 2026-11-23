// The screenshot scenes behind ?shot=start|play|chase|end. Each one plays the real
// rules forward from a fresh game for a fixed number of steps, steered by a simple
// autopilot (drive toward the next waypoint, brake for nothing, keep the pedal
// down), so the frame is what a short game really looks like and the same seed
// always gives the same frame.

import { CAR, LANDMARKS, STEP } from './config.js';
import { currentStep, scoreJob, startPlanning } from './missions.js';
import { addWanted } from './police.js';
import { SCREEN_COMPLETE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 16;
const CHASE_SECONDS = 12;

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/** Drive the player's car through a list of road waypoints, in order. */
function driveRoute(G, waypoints, route) {
  const car = G.player.car;
  if (!car) return { mx: 0, my: 0, actions: 0, numbers: 0 };
  let target = waypoints[route.index];
  if (Math.hypot(target.x - car.x, target.y - car.y) < 70 && route.index < waypoints.length - 1) {
    route.index += 1;
    target = waypoints[route.index];
  }
  return driveToward(G, target.x, target.y);
}

/** Drive the player's car toward (tx, ty): steer to the bearing, pedal down. */
function driveToward(G, tx, ty) {
  const car = G.player.car;
  if (!car) return { mx: 0, my: 0, actions: 0, numbers: 0 };
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = normalizeAngle(want - car.angle);
  return {
    mx: diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0,
    my: -1,
    actions: 0,
    numbers: 0,
  };
}

/** Walk on foot toward (tx, ty). */
function walkToward(G, tx, ty) {
  const dx = tx - G.player.x;
  const dy = ty - G.player.y;
  const len = Math.hypot(dx, dy) || 1;
  return { mx: dx / len, my: dy / len, actions: 0, numbers: 0 };
}

function putPlayerInCar(G, x, y, angle, color) {
  const car = {
    x, y, angle, speed: 0, color: color || '#c94f4f',
    kind: 'traffic', health: CAR.health, stolen: false, baseSpeed: 0,
  };
  G.traffic.cars.push(car);
  G.enterCar(car);
  return car;
}

/**
 * Set the game to the named scene (start, play, chase or end; any other name is
 * start) and return the screen to draw over it.
 */
export function stageShot(name, G) {
  if (name === 'play') {
    G.screen = SCREEN_PLAY;
    G.state.cash = 12450;
    G.state.turf.harbor = 45;
    G.state.turf.marina = 30;
    G.state.turf.coral = 20;
    G.state.timeOfDay = 15.5;
    putPlayerInCar(G, 1000, 1200, 0, '#4f7ec9');
    startPlanning(G.missions, 0);
    G.missions.approach = 'loud';
    G.missions.tools = ['lockpick'];
    G.startJobFromPlan();
    const route = { index: 0 };
    const waypoints = [{ x: 2000, y: 1200 }, { x: 2800, y: 1200 }, { x: 2800, y: 400 }, { x: 2900, y: 400 }];
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      G.step(STEP, driveRoute(G, waypoints, route));
      if (G.missions.phase !== 'active') break;
    }
    return { screen: SCREEN_PLAY };
  }

  if (name === 'chase') {
    G.screen = SCREEN_PLAY;
    G.state.cash = 18200;
    G.state.turf.foundry = 55;
    G.state.turf.palm = 40;
    G.state.timeOfDay = 21.5;
    putPlayerInCar(G, 1200, 1200, 0, '#e8b13c');
    startPlanning(G.missions, 3);
    G.missions.approach = 'loud';
    G.startJobFromPlan();
    addWanted(G.police, 5, 'staged chase');
    const route = { index: 0 };
    const waypoints = [{ x: 2000, y: 1200 }, { x: 2800, y: 1200 }, { x: 2800, y: 800 }, { x: 2000, y: 800 }];
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      G.step(STEP, driveRoute(G, waypoints, route));
      if (G.screen !== SCREEN_PLAY) break;
    }
    G.screen = SCREEN_PLAY;
    return { screen: SCREEN_PLAY };
  }

  if (name === 'end') {
    G.screen = SCREEN_PLAY;
    G.state.cash = 9800;
    G.state.timeOfDay = 11;
    putPlayerInCar(G, 700, 560, 0, '#4fc98a');
    startPlanning(G.missions, 0);
    G.missions.approach = 'quiet';
    G.startJobFromPlan();
    // Walk the job through for real: teleport to each step and let the rules finish it.
    for (let guard = 0; guard < 3 && G.missions.phase === 'active'; guard += 1) {
      const step = currentStep(G.missions);
      if (!step) break;
      G.player.car.x = step.x;
      G.player.car.y = step.y;
      G.player.x = step.x;
      G.player.y = step.y;
      for (let i = 0; i < 2 / STEP; i += 1) {
        G.step(STEP, { mx: 0, my: 0, actions: 0, numbers: 0 });
        if (G.missions.phase !== 'active') break;
      }
    }
    if (G.missions.phase !== 'done') {
      // Fallback: score it directly so the end panel always has real numbers.
      G.missions.phase = 'done';
      scoreJob(G.missions, G.state, G.crew);
      G.screen = SCREEN_COMPLETE;
    }
    return { screen: SCREEN_COMPLETE };
  }

  // start: the title over a living city.
  G.screen = SCREEN_TITLE;
  G.state.timeOfDay = 10;
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    G.step(STEP, { mx: 0, my: 0, actions: 0, numbers: 0 });
  }
  G.camera.x = 1600;
  G.camera.y = 1200;
  return { screen: SCREEN_TITLE };
}
