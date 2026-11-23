// Drawing only: the city, the cars, the people, the police, the HUD with its
// minimap, and every menu panel. The game state comes in, pixels go out. The
// logical view is 1280x720, scaled to fit the window, and the camera follows
// the player through the 3200x2400 city.

import {
  APPROACHES, DISTRICTS, FONT, HORIZONTAL_ROADS, LANDMARKS, PALETTE, ROAD_WIDTH,
  TOOLS, UPGRADES, VERTICAL_ROADS, WORLD,
} from './config.js';
import { money, totalTurfPercent } from './state.js';
import { currentJob, currentStep, planCost, planLoot } from './missions.js';
import { CREW_DEFS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PLAN = 'plan';
export const SCREEN_GARAGE = 'garage';
export const SCREEN_CREW = 'crew';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_COMPLETE = 'complete';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_CAMPAIGN = 'campaign';

const VIEW = { width: 1280, height: 720 };
const MINIMAP = { x: 1040, y: 16, w: 224, h: 168 };

function nightFactor(hour) {
  if (hour >= 7 && hour < 18) return 0;
  if (hour >= 18 && hour < 20) return ((hour - 18) / 2) * 0.45;
  if (hour >= 6 && hour < 7) return ((7 - hour) / 1) * 0.45;
  return 0.45;
}

function clockText(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function wantedStars(wanted) {
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < wanted ? '★' : '☆';
  return stars;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * ratio);
    const h = Math.round(window.innerHeight * ratio);
    canvas.width = w;
    canvas.height = h;
    view.scale = Math.min(w / VIEW.width, h / VIEW.height);
    view.x = (w - VIEW.width * view.scale) / 2;
    view.y = (h - VIEW.height * view.scale) / 2;
  }

  function font(size, bold) {
    const key = `${bold ? '700 ' : ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align, bold) {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function worldToScreen(wx, wy, cam) {
    return {
      x: (wx - cam.x) * view.scale + canvas.width / 2,
      y: (wy - cam.y) * view.scale + canvas.height / 2,
    };
  }

  function drawCity(G, cam) {
    // Everything here is in logical 1280x720 coordinates: the view transform
    // already scales to the window, so world point (wx, wy) lands at
    // (wx - cam.x + 640, wy - cam.y + 360).
    const rx = (wx) => wx - cam.x + VIEW.width / 2;
    const ry = (wy) => wy - cam.y + VIEW.height / 2;
    const rw = (w) => w;

    // Sea and beach along the north edge.
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(rx(0), ry(0), rw(WORLD.width), rw(120));
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(rx(0), ry(120), rw(WORLD.width), rw(120));
    // District ground.
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.ground;
      ctx.fillRect(rx(d.x), ry(d.y), rw(d.w), rw(d.h));
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const x of VERTICAL_ROADS) ctx.fillRect(rx(x - ROAD_WIDTH / 2), ry(240), rw(ROAD_WIDTH), rw(WORLD.height - 240));
    for (const y of HORIZONTAL_ROADS) ctx.fillRect(rx(0), ry(y - ROAD_WIDTH / 2), rw(WORLD.width), rw(ROAD_WIDTH));
    // Sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const x of VERTICAL_ROADS) {
      ctx.fillRect(rx(x - ROAD_WIDTH / 2 - 14), ry(240), rw(14), rw(WORLD.height - 240));
      ctx.fillRect(rx(x + ROAD_WIDTH / 2), ry(240), rw(14), rw(WORLD.height - 240));
    }
    for (const y of HORIZONTAL_ROADS) {
      ctx.fillRect(rx(0), ry(y - ROAD_WIDTH / 2 - 14), rw(WORLD.width), rw(14));
      ctx.fillRect(rx(0), ry(y + ROAD_WIDTH / 2), rw(WORLD.width), rw(14));
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const x of VERTICAL_ROADS) {
      for (let y = 280; y < WORLD.height; y += 70) ctx.fillRect(rx(x - 2), ry(y), rw(4), rw(34));
    }
    for (const y of HORIZONTAL_ROADS) {
      for (let x = 40; x < WORLD.width; x += 70) ctx.fillRect(rx(x), ry(y - 2), rw(34), rw(4));
    }
    // Buildings.
    for (const b of G.city.buildings) {
      ctx.fillStyle = b.color;
      ctx.fillRect(rx(b.x), ry(b.y), rw(b.w), rw(b.h));
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(rx(b.x), ry(b.y), rw(b.w), rw(10));
      if (b.roof) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(rx(b.x + 12), ry(b.y + 12), rw(b.w - 24), rw(b.h - 24));
      }
    }
    // Landmarks.
    for (const key of Object.keys(LANDMARKS)) {
      const mark = LANDMARKS[key];
      ctx.fillStyle = mark.color;
      ctx.fillRect(rx(mark.x - 70), ry(mark.y - 46), rw(140), rw(92));
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.font = font(15, true);
      ctx.textAlign = 'center';
      ctx.fillText(mark.label, rx(mark.x), ry(mark.y + 62));
    }
    // Palms.
    for (const palm of G.city.palms) {
      ctx.fillStyle = '#2f7a3d';
      ctx.beginPath();
      ctx.arc(rx(palm.x), ry(palm.y), rw(13), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#57a05e';
      ctx.beginPath();
      ctx.arc(rx(palm.x - 4), ry(palm.y - 4), rw(7), 0, Math.PI * 2);
      ctx.fill();
    }
    // District names.
    ctx.font = font(26, true);
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillText(d.name.toUpperCase(), rx(d.x + d.w / 2), ry(d.y + d.h / 2));
    }
  }

  function drawCarShape(car, isPolice) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const L = 54;
    const W = 26;
    ctx.fillStyle = isPolice ? '#e8ecf4' : car.color;
    ctx.beginPath();
    ctx.roundRect(-L / 2, -W / 2, L, W, 7);
    ctx.fill();
    ctx.fillStyle = isPolice ? '#1d4fd7' : 'rgba(0,0,0,0.35)';
    ctx.fillRect(-L / 2 + 4, -W / 2, 12, W);
    ctx.fillStyle = 'rgba(20,30,50,0.85)';
    ctx.fillRect(-6, -W / 2 + 4, 18, W - 8);
    if (isPolice) {
      const flash = Math.floor(performance.now() / 180) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#2f6bff';
      ctx.fillRect(-2, -W / 2 - 2, 8, 5);
      ctx.fillStyle = flash ? '#2f6bff' : '#ff3b30';
      ctx.fillRect(-2, W / 2 - 3, 8, 5);
    }
    ctx.restore();
  }

  function drawEntities(G, cam) {
    ctx.save();
    ctx.translate(VIEW.width / 2 - cam.x, VIEW.height / 2 - cam.y);
    // Job objective marker.
    const step = G.missions.phase === 'active' ? currentStep(G.missions) : null;
    if (step) {
      const pulse = 1 + Math.sin(performance.now() / 300) * 0.15;
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(step.x, step.y, 52 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(step.x, step.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Pedestrians.
    for (const ped of G.traffic.peds) {
      const bob = Math.sin(ped.walkPhase) * 2;
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y + bob * 0.3, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(ped.x, ped.y + bob * 0.3, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Traffic cars.
    for (const car of G.traffic.cars) drawCarShape(car, false);
    // Police roadblocks.
    for (const block of G.police.roadblocks) drawCarShape({ ...block, color: '#e8ecf4' }, true);
    // Police units.
    for (const unit of G.police.units) drawCarShape(unit, true);
    // Player's car or the player on foot.
    const player = G.player;
    if (player.inCar && player.car) {
      drawCarShape(player.car, false);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(player.car.x + Math.cos(player.car.angle) * 34, player.car.y + Math.sin(player.car.angle) * 34, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(player.x, player.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(player.x + Math.cos(player.angle) * 8, player.y + Math.sin(player.angle) * 8, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Helicopter "Air One" with its spotlight.
    if (G.police.heli.active) {
      const heli = G.police.heli;
      ctx.fillStyle = 'rgba(255,255,220,0.10)';
      ctx.beginPath();
      ctx.moveTo(heli.x, heli.y);
      ctx.arc(player.x, player.y, 130, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,220,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 130, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#2a2f3a';
      ctx.beginPath();
      ctx.arc(heli.x, heli.y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c9d4ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(heli.x - 26, heli.y);
      ctx.lineTo(heli.x + 26, heli.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawNightOverlay(G) {
    const alpha = nightFactor(G.state.timeOfDay);
    if (alpha <= 0) return;
    ctx.fillStyle = `rgba(6,10,40,${alpha})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Headlights when driving at night.
    const player = G.player;
    if (player.inCar && player.car) {
      const px = player.car.x - G.camera.x + VIEW.width / 2;
      const py = player.car.y - G.camera.y + VIEW.height / 2;
      const grad = ctx.createRadialGradient(px, py, 10, px, py, 260);
      grad.addColorStop(0, 'rgba(255,240,180,0.25)');
      grad.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(px - 300, py - 300, 600, 600);
    }
  }

  function drawMinimap(G) {
    const mm = MINIMAP;
    const sx = mm.w / WORLD.width;
    const sy = mm.h / WORLD.height;
    ctx.fillStyle = 'rgba(10,14,24,0.85)';
    ctx.fillRect(mm.x, mm.y, mm.w, mm.h);
    ctx.strokeStyle = '#3a4152';
    ctx.lineWidth = 1;
    ctx.strokeRect(mm.x, mm.y, mm.w, mm.h);
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.ground;
      ctx.fillRect(mm.x + d.x * sx, mm.y + d.y * sy, d.w * sx, d.h * sy);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    for (const x of VERTICAL_ROADS) {
      ctx.beginPath();
      ctx.moveTo(mm.x + x * sx, mm.y);
      ctx.lineTo(mm.x + x * sx, mm.y + mm.h);
      ctx.stroke();
    }
    for (const y of HORIZONTAL_ROADS) {
      ctx.beginPath();
      ctx.moveTo(mm.x, mm.y + y * sy);
      ctx.lineTo(mm.x + mm.w, mm.y + y * sy);
      ctx.stroke();
    }
    const dot = (wx, wy, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mm.x + wx * sx, mm.y + wy * sy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const key of Object.keys(LANDMARKS)) dot(LANDMARKS[key].x, LANDMARKS[key].y, '#ffffff', 2.5);
    const step = G.missions.phase === 'active' ? currentStep(G.missions) : null;
    if (step) dot(step.x, step.y, PALETTE.gold, 5);
    for (const unit of G.police.units) dot(unit.x, unit.y, PALETTE.police, 3);
    dot(G.player.x, G.player.y, '#7ee787', 4);
    ctx.strokeStyle = '#7ee787';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mm.x + G.player.x * sx, mm.y + G.player.y * sy, 7, 0, Math.PI * 2);
    ctx.stroke();
    text('VELMARIS', mm.x + 4, mm.y + mm.h - 6, 11, 'rgba(255,255,255,0.75)', 'left', true);
  }

  function drawHud(G) {
    const state = G.state;
    ctx.textBaseline = 'alphabetic';
    // Cash and turf, top left.
    ctx.fillStyle = 'rgba(10,14,24,0.8)';
    ctx.fillRect(12, 12, 250, 64);
    text(money(state.cash), 24, 40, 26, PALETTE.cash, 'left', true);
    text(`TURF ${totalTurfPercent(state)}%  ·  JOBS ${state.jobsDone}/8`, 24, 64, 15, PALETTE.text, 'left');
    // Wanted stars, top centre.
    const stars = wantedStars(G.police.wanted);
    text(stars, VIEW.width / 2, 44, 30, G.police.wanted > 0 ? PALETTE.danger : 'rgba(255,255,255,0.35)', 'center', true);
    if (G.police.wanted > 0) text('VPD DISPATCH', VIEW.width / 2, 68, 13, PALETTE.danger, 'center', true);
    // Clock, under the minimap.
    text(`${clockText(state.timeOfDay)}  ·  ${nightFactor(state.timeOfDay) > 0.2 ? 'NIGHT' : 'DAY'}`, MINIMAP.x + MINIMAP.w - 8, MINIMAP.y + MINIMAP.h + 20, 14, PALETTE.text, 'right');
    drawMinimap(G);
    // Objective bar, bottom centre.
    const step = G.missions.phase === 'active' ? currentStep(G.missions) : null;
    const job = currentJob(G.missions);
    if (step && job) {
      const holdText = step.type === 'hold' ? ` — ${Math.max(0, Math.ceil(G.missions.holdLeft))}s` : '';
      const label = `${job.name}: ${step.label}${holdText}`;
      const w = Math.min(760, 24 + label.length * 9.5);
      ctx.fillStyle = 'rgba(10,14,24,0.85)';
      ctx.fillRect((VIEW.width - w) / 2, VIEW.height - 92, w, 40);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect((VIEW.width - w) / 2, VIEW.height - 92, 4, 40);
      text(label, VIEW.width / 2, VIEW.height - 65, 17, PALETTE.text, 'center');
    } else if (job && G.missions.phase !== 'done') {
      text(`Next job: ${job.name} — press E near the Safehouse to plan`, VIEW.width / 2, VIEW.height - 66, 16, PALETTE.muted, 'center');
    }
    // Car health and speed, bottom right.
    const player = G.player;
    if (player.inCar && player.car) {
      const speed = Math.round(Math.abs(player.car.speed) * 0.36);
      text(`${speed} km/h`, VIEW.width - 24, VIEW.height - 110, 22, PALETTE.text, 'right', true);
      ctx.fillStyle = 'rgba(10,14,24,0.8)';
      ctx.fillRect(VIEW.width - 224, VIEW.height - 96, 200, 12);
      ctx.fillStyle = player.car.health > 40 ? PALETTE.cash : PALETTE.danger;
      ctx.fillRect(VIEW.width - 224, VIEW.height - 96, 200 * Math.max(0, player.car.health / 100), 12);
      text('CAR', VIEW.width - 228, VIEW.height - 84, 11, PALETTE.muted, 'right');
    }
    // Controls hint, bottom left.
    text('WASD drive / walk · E carjack · F exit car · G garage · C crew · P pause', 24, VIEW.height - 20, 13, 'rgba(255,255,255,0.55)', 'left');
    // Toast message.
    if (G.toast && G.toast.timer > 0) {
      ctx.fillStyle = 'rgba(10,14,24,0.9)';
      const w = 24 + G.toast.text.length * 8.5;
      ctx.fillRect((VIEW.width - w) / 2, 84, w, 36);
      text(G.toast.text, VIEW.width / 2, 108, 16, PALETTE.gold, 'center', true);
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 30;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    ctx.fillStyle = 'rgba(8,10,18,0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = accent || PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 58, 34, PALETTE.text, 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 106 + i * 30, 17, PALETTE.muted, 'center');
    }
    if (prompt) text(prompt, VIEW.width / 2, y + height - 26, 17, PALETTE.gold, 'center', true);
  }

  function drawTitle(G) {
    drawCity(G, G.camera);
    drawEntities(G, G.camera);
    const lines = [
      'A coastal city. Eight story jobs. One crew. The VPD is always watching.',
      'Steal cars, take turf, plan every job — and mind the five stars.',
      `Best score: ${money(G.state.bestScore)}   ·   Saved progress: ${G.state.jobsDone}/8 jobs done`,
    ];
    drawPanel('VELMARIS', lines, 'Press Space or click to start', PALETTE.gold);
    text('VELMARIS: open-world crime — 8 story jobs, VPD dispatch with roadblocks, PIT units and air support, crew and turf control', VIEW.width / 2, 46, 15, PALETTE.text, 'center');
  }

  function drawPlan(G) {
    const job = currentJob(G.missions);
    const approach = APPROACHES.find((a) => a.id === G.missions.approach);
    const loot = planLoot(G.missions, 1);
    const cost = planCost(G.missions);
    const lines = [
      `${job.name} — ${job.brief}`,
      `Loot ${money(loot)}  ·  Tools ${money(cost)}  ·  Score = loot − tools + bonus`,
      '',
      'APPROACH (press 1-3):',
      ...APPROACHES.map((a, i) => `${i + 1}. ${a.name} — ${a.blurb}${G.missions.approach === a.id ? '  ◀' : ''}`),
      '',
      'TOOLS (press 4-7 to toggle):',
      ...TOOLS.map((t, i) => `${i + 4}. ${t.name} ${money(t.cost)} — ${t.blurb}${G.missions.tools.includes(t.id) ? '  ✓ BOUGHT' : ''}`),
      '',
      `Crew hired: ${G.crew.hired.length ? G.crew.hired.join(', ') : 'none yet — press C at the Safehouse'}`,
    ];
    drawPanel(`PLAN THE JOB — ${job.name.toUpperCase()}`, lines, 'Enter to start the job · Esc to cancel', PALETTE.gold);
  }

  function drawGarage(G) {
    const state = G.state;
    const lines = [
      `Cash: ${money(state.cash)}   ·   Car health: ${Math.round(G.player.car ? G.player.car.health : 100)}%`,
      '',
      'UPGRADES (press 1-3 to buy):',
      ...Object.keys(UPGRADES).map((kind, i) => {
        const def = UPGRADES[kind];
        const level = state.upgrades[kind] || 0;
        const cost = level >= def.costs.length ? 'MAX' : money(def.costs[level]);
        return `${i + 1}. ${def.name} Lv${level} — ${def.blurb}  Next: ${cost}`;
      }),
      '',
      `4. Repair car ${money(300)}`,
      G.garage.lastBought ? `Last: ${G.garage.lastBought}` : '',
    ];
    drawPanel('GARAGE — TUNE YOUR RIDE', lines, 'Esc to leave the garage', '#f2a54c');
  }

  function drawCrewPanel(G) {
    const state = G.state;
    const lines = [
      `Cash: ${money(state.cash)}   ·   Hire once, keep forever.`,
      '',
      'CREW FOR HIRE (press 1-3):',
      ...CREW_DEFS.map((c, i) => `${i + 1}. ${c.name} — ${money(c.cost)} — ${c.blurb}${G.crew.hired.includes(c.id) ? '  ✓ HIRED' : ''}`),
      '',
      'Crew Run approach in planning pays x1.2 loot when any member is hired.',
    ];
    drawPanel('CREW — BUILD YOUR TEAM', lines, 'Esc to go back', '#8fd0a0');
  }

  function drawComplete(G) {
    const score = G.missions.lastScore;
    const lines = score ? score.lines.slice() : [];
    lines.push('');
    lines.push(`TOTAL PAID: ${money(score ? score.total : 0)}   ·   Cash now: ${money(G.state.cash)}`);
    lines.push(`Turf: ${totalTurfPercent(G.state)}% of Velmaris under your control`);
    drawPanel('JOB COMPLETE', lines, 'Press Space for the next job', PALETTE.cash);
  }

  function drawBusted(G) {
    const lines = [
      `The VPD took ${money(G.bustedLoss || 0)} from you. Wanted level cleared.`,
      `Cash now: ${money(G.state.cash)}`,
      'Lay low, then get back to work.',
    ];
    drawPanel('BUSTED', lines, 'Press Space to walk out of the precinct', PALETTE.danger);
  }

  function drawCampaign(G) {
    const lines = [
      'All eight story jobs are done. Velmaris is yours.',
      `Total earned: ${money(G.state.totalEarned)}   ·   Best job score: ${money(G.state.bestScore)}`,
      `Turf controlled: ${totalTurfPercent(G.state)}%`,
      'The VPD will never catch what it cannot see.',
    ];
    drawPanel('VELMARIS IS YOURS', lines, 'Press Space to keep cruising the city', PALETTE.gold);
  }

  /** Paint one frame for the screen the game is on. */
  function draw(G) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const screen = G.screen;
    if (screen === SCREEN_TITLE) {
      drawTitle(G);
      return;
    }
    drawCity(G, G.camera);
    drawEntities(G, G.camera);
    drawNightOverlay(G);
    drawHud(G);
    if (screen === SCREEN_PLAN) drawPlan(G);
    else if (screen === SCREEN_GARAGE) drawGarage(G);
    else if (screen === SCREEN_CREW) drawCrewPanel(G);
    else if (screen === SCREEN_PAUSED) drawPanel('PAUSED', ['The city waits. The VPD does not.'], 'Press P to resume', PALETTE.panelEdge);
    else if (screen === SCREEN_COMPLETE) drawComplete(G);
    else if (screen === SCREEN_BUSTED) drawBusted(G);
    else if (screen === SCREEN_CAMPAIGN) drawCampaign(G);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
