// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between
// screens: title, play, plan, garage, crew, paused, job complete, busted and the
// campaign finale. One game hour passes every 45 seconds of play.
//
// ?seed=N fixes the city and the traffic. ?shot=start|play|chase|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.

import { CAR, JOBS, LANDMARKS, STEP, WANTED } from './config.js';
import { createRandom } from './random.js';
import { buildCity, pushOutOfBuildings } from './city.js';
import { createGameState, loadGame, money, readBest, saveBest, saveGame } from './state.js';
import { createTraffic, nearestTrafficCar, stepTraffic } from './traffic.js';
import { addWanted, clearWanted, createPolice, EVENT_BUSTED, stepPolice } from './police.js';
import {
  beginJob, currentJob, currentStep, nextJob, scoreJob, startPlanning,
  stepMission, toggleTool,
} from './missions.js';
import { buyUpgrade, createGarage, repairCar, tunedCarStats } from './garage.js';
import { createCrew, crewDecayMult, crewHoldMult, crewSmashesRoadblocks, hireCrewMember } from './crew.js';
import { createTurf, stepTurf } from './turf.js';
import { createAudio } from './audio.js';
import {
  ACTION_CANCEL, ACTION_CONFIRM, ACTION_CREW, ACTION_EXIT_CAR, ACTION_GARAGE,
  ACTION_INTERACT, ACTION_PAUSE, createInput,
} from './input.js';
import {
  createRenderer, SCREEN_BUSTED, SCREEN_CAMPAIGN, SCREEN_COMPLETE, SCREEN_CREW,
  SCREEN_GARAGE, SCREEN_PAUSED, SCREEN_PLAN, SCREEN_PLAY, SCREEN_TITLE,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const DAY_LENGTH = 45; // seconds of play per game hour

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

/** Build a whole fresh game: state, city, traffic, police, missions, crew, turf. */
export function createGame(seedValue) {
  const random = createRandom(seedValue);
  const saved = loadGame();
  const state = saved || createGameState();
  state.bestScore = Math.max(state.bestScore, readBest());
  const city = buildCity(random);
  const traffic = createTraffic(random);
  const police = createPolice(random);
  const missions = {
    phase: 'idle',
    jobIndex: Math.min(state.jobsDone, 8),
    approach: 'quiet',
    tools: [],
    stepIndex: 0,
    holdLeft: 0,
    elapsed: 0,
    damageTaken: false,
    lastScore: null,
    jobHeat: 0,
  };
  const crew = createCrew(state);
  const turf = createTurf(state);
  const garage = createGarage(state);
  const audio = createAudio();
  const player = {
    x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, angle: 0,
    inCar: false, car: null, health: 100,
  };
  const G = {
    random, state, city, traffic, police, missions, crew, turf, garage, audio, player,
    screen: SCREEN_TITLE,
    camera: { x: 1600, y: 1200 },
    toast: { text: '', timer: 0 },
    bustedLoss: 0,
    saveTimer: 0,
  };

  function showToast(text) {
    G.toast.text = text;
    G.toast.timer = 3.5;
  }

  function distTo(x, y) {
    const dx = G.player.x - x;
    const dy = G.player.y - y;
    return Math.hypot(dx, dy);
  }

  function enterCar(car) {
    car.stolen = true;
    G.player.inCar = true;
    G.player.car = car;
    G.player.x = car.x;
    G.player.y = car.y;
    G.player.angle = car.angle;
  }

  function exitCar() {
    const car = G.player.car;
    if (!car) return;
    G.player.inCar = false;
    G.player.car = null;
    G.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    G.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    G.player.angle = car.angle;
  }

  function damageCar(amount) {
    const car = G.player.car;
    if (!car) return;
    const stats = tunedCarStats(G.state);
    car.health = Math.max(0, car.health - amount * stats.armor);
    if (G.missions.phase === 'active') G.missions.damageTaken = true;
    if (car.health <= 0) {
      showToast('Your car is wrecked!');
      audio.crash();
      exitCar();
    }
  }

  function carCollisions(dt) {
    const car = G.player.car;
    if (!car) return;
    // Buildings: bounce off and take damage at speed.
    const before = { x: car.x, y: car.y };
    const hit = pushOutOfBuildings(G.city, car, 30);
    if (hit && Math.abs(car.speed) > 120) {
      damageCar(Math.abs(car.speed) * 0.06);
      car.speed *= 0.4;
      audio.crash();
    }
    if (hit) {
      // Slide along the wall instead of sticking to it.
      const dx = car.x - before.x;
      const dy = car.y - before.y;
      if (Math.abs(dx) < 0.5) car.speed *= 0.85;
    }
    // Other cars: a soft shove and a little damage.
    const allCars = G.traffic.cars.concat(G.police.units);
    for (const other of allCars) {
      if (other === car || other.stolen) continue;
      const dx = car.x - other.x;
      const dy = car.y - other.y;
      const d = Math.hypot(dx, dy);
      if (d < 52 && d > 0.01) {
        const push = (52 - d) / 2;
        car.x += (dx / d) * push;
        car.y += (dy / d) * push;
        if (Math.abs(car.speed) > 200) {
          damageCar(6);
          audio.crash();
        }
        car.speed *= 0.92;
        if (other.kind === 'traffic') other.speed *= 0.5;
      }
    }
    // Roadblocks: stop, unless Brute smashes through.
    for (let i = 0; i < G.police.roadblocks.length; i += 1) {
      const block = G.police.roadblocks[i];
      const dx = car.x - block.x;
      const dy = car.y - block.y;
      const d = Math.hypot(dx, dy);
      if (d < 56) {
        if (crewSmashesRoadblocks(G.crew)) {
          G.police.roadblocks.splice(i, 1);
          showToast('Brute smashed the roadblock!');
          damageCar(4);
        } else {
          car.speed *= 0.5;
          car.x += (dx / (d || 1)) * 4;
          car.y += (dy / (d || 1)) * 4;
          if (Math.abs(car.speed) > 150) damageCar(8);
        }
        break;
      }
    }
    // Pedestrians: a fast car knocks one down and earns a star.
    for (const ped of G.traffic.peds) {
      const dx = ped.x - car.x;
      const dy = ped.y - car.y;
      if (dx * dx + dy * dy < 34 * 34 && Math.abs(car.speed) > 60) {
        ped.x = 60 + G.random() * 3000;
        ped.y = 300 + G.random() * 2000;
        addWanted(G.police, WANTED.hitPed, 'hit a pedestrian');
        showToast('VPD +1★ — pedestrian hit');
        damageCar(2);
      }
    }
  }

  function driveCar(dt, move) {
    const car = G.player.car;
    const stats = tunedCarStats(G.state);
    const steering = move.x * stats.steer * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
    if (Math.abs(car.speed) > 4) car.angle += steering * dt * (car.speed >= 0 ? 1 : -1);
    if (move.y < 0) car.speed += CAR.accel * dt;
    else if (move.y > 0) {
      if (car.speed > 10) car.speed -= CAR.brake * dt;
      else car.speed = Math.max(-CAR.reverseSpeed, car.speed - CAR.accel * 0.6 * dt);
    } else {
      car.speed -= car.speed * CAR.drag * dt * 2;
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    car.speed = Math.max(-CAR.reverseSpeed, Math.min(stats.topSpeed, car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(40, Math.min(3160, car.x));
    car.y = Math.max(140, Math.min(2360, car.y));
    G.player.x = car.x;
    G.player.y = car.y;
    G.player.angle = car.angle;
    carCollisions(dt);
  }

  function walkPlayer(dt, move) {
    const speed = 200;
    const len = Math.hypot(move.x, move.y) || 1;
    const nx = move.x / len;
    const ny = move.y / len;
    if (move.x !== 0 || move.y !== 0) G.player.angle = Math.atan2(ny, nx);
    G.player.x += nx * speed * dt * (move.x !== 0 || move.y !== 0 ? 1 : 0);
    G.player.y += ny * speed * dt * (move.x !== 0 || move.y !== 0 ? 1 : 0);
    G.player.x = Math.max(40, Math.min(3160, G.player.x));
    G.player.y = Math.max(140, Math.min(2360, G.player.y));
    pushOutOfBuildings(G.city, G.player, 15);
  }

  function tryCarjack() {
    const car = nearestTrafficCar(G.traffic, G.player.x, G.player.y, 80);
    if (!car) {
      // Near the safehouse, E opens the next job's planning screen.
      if (distTo(LANDMARKS.safehouse.x, LANDMARKS.safehouse.y) < 150) {
        openPlanning();
        return;
      }
      showToast('No car close enough — walk up to one');
      return;
    }
    enterCar(car);
    addWanted(G.police, WANTED.carjack, 'carjacked a car');
    showToast('Carjacked! VPD +1★');
    G.audio.crash();
  }

  function openPlanning() {
    if (G.missions.jobIndex >= 8) {
      G.screen = SCREEN_CAMPAIGN;
      return;
    }
    startPlanning(G.missions, G.missions.jobIndex);
    G.screen = SCREEN_PLAN;
    G.audio.click();
  }

  function startJobFromPlan() {
    const job = beginJob(G.missions);
    if (G.missions.tools.includes('getaway')) {
      const car = {
        x: G.player.x + 60, y: G.player.y, angle: 0, speed: 0,
        color: '#e8b13c', kind: 'traffic', health: CAR.health, stolen: false, baseSpeed: 0,
      };
      G.traffic.cars.push(car);
      enterCar(car);
    }
    if (job.night) G.state.timeOfDay = 23;
    if (G.missions.jobHeat > 0) addWanted(G.police, G.missions.jobHeat, 'job heat');
    const heat = { 'bank-job': 2, 'big-score': 3 }[job.id] || 0;
    if (heat > 0) addWanted(G.police, heat, 'job heat');
    G.screen = SCREEN_PLAY;
    showToast(`${job.name} — ${currentStep(G.missions).label}`);
    G.audio.pickup();
  }

  function finishJob() {
    const score = scoreJob(G.missions, G.state, G.crew);
    G.audio.jobDone();
    G.toast.timer = 0;
    saveGame(G.state);
    saveBest(G.state.bestScore);
    clearWanted(G.police);
    G.screen = SCREEN_COMPLETE;
    return score;
  }

  function bustPlayer() {
    const loss = Math.round(G.state.cash * 0.15);
    G.state.cash -= loss;
    G.bustedLoss = loss;
    clearWanted(G.police);
    if (G.player.inCar) exitCar();
    G.player.x = LANDMARKS.safehouse.x;
    G.player.y = LANDMARKS.safehouse.y;
    if (G.missions.phase === 'active') {
      G.missions.phase = 'idle';
      showToast('Job failed — the VPD caught you');
    }
    saveGame(G.state);
    G.audio.busted();
    G.screen = SCREEN_BUSTED;
  }

  function handleActions(actions, numbers) {
    if (G.screen === SCREEN_TITLE || G.screen === SCREEN_COMPLETE || G.screen === SCREEN_BUSTED || G.screen === SCREEN_CAMPAIGN) {
      if (actions & ACTION_CONFIRM) {
        if (G.screen === SCREEN_COMPLETE) {
          const next = nextJob(G.missions);
          G.screen = next ? SCREEN_PLAY : SCREEN_CAMPAIGN;
          if (next) showToast(`Next job: ${next.name} — plan it at the Safehouse (E)`);
        } else if (G.screen === SCREEN_TITLE) {
          G.screen = SCREEN_PLAY;
          showToast('Welcome to Velmaris — plan your first job at the Safehouse (E)');
        } else {
          G.screen = SCREEN_PLAY;
        }
        G.audio.click();
      }
      return;
    }
    if (G.screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        G.screen = SCREEN_PLAY;
        G.audio.click();
      }
      return;
    }
    if (G.screen === SCREEN_PLAN) {
      if (numbers & 1) G.missions.approach = 'quiet';
      if (numbers & 2) G.missions.approach = 'loud';
      if (numbers & 4) {
        if (G.crew.hired.length > 0) G.missions.approach = 'crew';
        else showToast('Crew Run needs a hired crew member — press C at the Safehouse');
      }
      const toolKeys = ['lockpick', 'disguise', 'getaway', 'jammer'];
      toolKeys.forEach((id, i) => {
        if (numbers & (1 << (3 + i))) toggleTool(G.missions, id);
      });
      if (actions & ACTION_CONFIRM) startJobFromPlan();
      else if (actions & ACTION_CANCEL) G.screen = SCREEN_PLAY;
      return;
    }
    if (G.screen === SCREEN_GARAGE) {
      const kinds = ['engine', 'armor', 'tires'];
      kinds.forEach((kind, i) => {
        if (numbers & (1 << i)) {
          if (buyUpgrade(G.garage, G.state, kind)) {
            G.audio.cash();
            showToast(`Bought ${G.garage.lastBought}`);
          } else showToast('Not enough cash or already maxed');
        }
      });
      if (numbers & 8) {
        if (repairCar(G.garage, G.state, G.player.car)) {
          G.audio.cash();
          showToast('Car repaired');
        } else showToast('Car is fine, or not enough cash');
      }
      if (actions & ACTION_CANCEL) G.screen = SCREEN_PLAY;
      return;
    }
    if (G.screen === SCREEN_CREW) {
      const ids = ['rook', 'mira', 'brute'];
      ids.forEach((id, i) => {
        if (numbers & (1 << i)) {
          if (hireCrewMember(G.crew, G.state, id)) {
            G.audio.cash();
            showToast(`Hired ${id} — welcome to the crew`);
          } else showToast('Already hired, or not enough cash');
        }
      });
      if (actions & ACTION_CANCEL) G.screen = SCREEN_PLAY;
      return;
    }
    // SCREEN_PLAY actions.
    if (actions & ACTION_PAUSE) {
      G.screen = SCREEN_PAUSED;
      saveGame(G.state);
      return;
    }
    if (actions & ACTION_INTERACT) {
      if (G.player.inCar) return;
      if (distTo(LANDMARKS.garage.x, LANDMARKS.garage.y) < 170) {
        G.screen = SCREEN_GARAGE;
        G.audio.click();
        return;
      }
      tryCarjack();
    }
    if (actions & ACTION_EXIT_CAR && G.player.inCar) exitCar();
    if (actions & ACTION_GARAGE && distTo(LANDMARKS.garage.x, LANDMARKS.garage.y) < 220) {
      G.screen = SCREEN_GARAGE;
      G.audio.click();
    }
    if (actions & ACTION_CREW) {
      G.screen = SCREEN_CREW;
      G.audio.click();
    }
  }

  /** One fixed step of the whole game. `raw` is {mx, my, actions, numbers}. */
  function step(dt, raw) {
    handleActions(raw.actions || 0, raw.numbers || 0);
    if (G.screen === SCREEN_TITLE) {
      // Ambient city behind the title: traffic cruises, nothing else moves.
      const allCars = G.traffic.cars.concat(G.police.units);
      stepTraffic(G.traffic, allCars, G.player, dt, G.random);
      return;
    }
    if (G.screen !== SCREEN_PLAY) return;

    const move = { x: raw.mx || 0, y: raw.my || 0 };
    if (G.player.inCar) driveCar(dt, move);
    else walkPlayer(dt, move);

    // The clock: one game hour every 45 seconds.
    G.state.timeOfDay = (G.state.timeOfDay + dt / DAY_LENGTH) % 24;

    const allCars = G.traffic.cars.concat(G.police.units);
    if (G.player.inCar && G.player.car) allCars.push(G.player.car);
    stepTraffic(G.traffic, allCars, G.player, dt, G.random);

    // Police, with the job's modifiers.
    const jobMods = {
      spawnRate: G.missions.tools.includes('jammer') && G.missions.phase === 'active' ? 0.5 : 1,
      decayMult: crewDecayMult(G.crew) * (G.missions.tools.includes('disguise') && G.missions.phase === 'active' ? 1.5 : 1),
    };
    const policeEvents = stepPolice(G.police, {
      x: G.player.x, y: G.player.y,
      inCar: G.player.inCar, car: G.player.car,
    }, dt, jobMods);
    if (policeEvents & EVENT_BUSTED) bustPlayer();
    G.audio.siren(dt, G.police.wanted);

    // Missions.
    if (G.missions.phase === 'active') {
      const holdMult = crewHoldMult(G.crew, G.missions.tools.includes('lockpick'));
      const result = stepMission(G.missions, G.player, dt, { holdMult });
      if (result === 'step') {
        G.audio.pickup();
        const step = currentStep(G.missions);
        if (step) showToast(step.label);
      } else if (result === 'job') {
        finishJob();
      }
    }

    // Turf pays out every 30 seconds.
    const payout = stepTurf(G.turf, G.state, dt);
    if (payout > 0) showToast(`Turf income: +${money(payout)}`);

    // Camera follows the player, clamped inside the city.
    G.camera.x = Math.max(640, Math.min(2560, G.player.x));
    G.camera.y = Math.max(360, Math.min(2040, G.player.y));

    if (G.toast.timer > 0) G.toast.timer -= dt;
    G.saveTimer += dt;
    if (G.saveTimer > 20) {
      G.saveTimer = 0;
      saveGame(G.state);
    }
  }

  G.step = step;
  G.showToast = showToast;
  G.enterCar = enterCar;
  G.openPlanning = openPlanning;
  G.startJobFromPlan = startJobFromPlan;
  G.finishJob = finishJob;
  G.jobs = JOBS;
  return G;
}

const game = createGame(seed);
const renderer = createRenderer(canvas);
// A handle for local play-testing only (used by the maker's own test script).
window.__velmaris = game;

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const staged = stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(game);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    const numbers = input.takeNumbers();
    const move = input.move();
    if (actions & ACTION_CONFIRM) game.audio.unlock();
    let pendingActions = actions;
    let pendingNumbers = numbers;
    while (accumulator >= STEP) {
      game.step(STEP, { mx: move.x, my: move.y, actions: pendingActions, numbers: pendingNumbers });
      pendingActions = 0;
      pendingNumbers = 0;
      accumulator -= STEP;
    }
    renderer.draw(game);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === SCREEN_PLAY) {
      game.screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Velmaris. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
