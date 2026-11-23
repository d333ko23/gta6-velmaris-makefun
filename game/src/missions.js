// The 8 story jobs: the planning screen before each one (approach + tools with
// explicit costs), the step chain while it runs, and the score at the end:
// loot x approach - tool costs + bonuses. A job pays its district's turf too.

import { APPROACHES, CLEAN_BONUS, FAST_BONUS, JOBS, TOOLS, TURF_JOB_GAIN } from './config.js';
import { money } from './state.js';

export function createMissions() {
  return {
    phase: 'idle', // idle | plan | active | done
    jobIndex: 0,
    approach: 'quiet',
    tools: [], // tool ids bought for this job
    stepIndex: 0,
    holdLeft: 0,
    elapsed: 0,
    damageTaken: false,
    lastScore: null, // {loot, costs, bonuses, total, lines}
    jobHeat: 0,
  };
}

export function currentJob(missions) {
  return JOBS[missions.jobIndex] || null;
}

export function startPlanning(missions, jobIndex) {
  missions.phase = 'plan';
  missions.jobIndex = jobIndex;
  missions.approach = 'quiet';
  missions.tools = [];
  missions.stepIndex = 0;
  missions.holdLeft = 0;
  missions.elapsed = 0;
  missions.damageTaken = false;
  missions.lastScore = null;
}

export function planCost(missions) {
  let cost = 0;
  for (const id of missions.tools) {
    const tool = TOOLS.find((t) => t.id === id);
    if (tool) cost += tool.cost;
  }
  return cost;
}

export function planLoot(missions, crewBonus) {
  const job = currentJob(missions);
  const approach = APPROACHES.find((a) => a.id === missions.approach) || APPROACHES[0];
  return Math.round(job.loot * approach.lootMult * (crewBonus || 1));
}

export function toggleTool(missions, toolId) {
  const at = missions.tools.indexOf(toolId);
  if (at >= 0) missions.tools.splice(at, 1);
  else missions.tools.push(toolId);
}

export function beginJob(missions) {
  missions.phase = 'active';
  missions.stepIndex = 0;
  missions.holdLeft = 0;
  missions.elapsed = 0;
  missions.damageTaken = false;
  const job = currentJob(missions);
  missions.jobHeat = 0;
  if (missions.approach === 'loud') missions.jobHeat += 1;
  return job;
}

export function currentStep(missions) {
  const job = currentJob(missions);
  if (!job) return null;
  return job.steps[missions.stepIndex] || null;
}

function stepRadius(step) {
  return step.type === 'hold' ? 90 : 64;
}

/**
 * Advance the active job one step. `pos` is the player's position. Returns
 * 'step' when a step completes, 'job' when the whole job completes, else ''.
 * `mods` carries { holdMult } from tools and crew.
 */
export function stepMission(missions, pos, dt, mods) {
  if (missions.phase !== 'active') return '';
  missions.elapsed += dt;
  const step = currentStep(missions);
  if (!step) return '';
  const dx = pos.x - step.x;
  const dy = pos.y - step.y;
  const inside = dx * dx + dy * dy < stepRadius(step) * stepRadius(step);
  if (step.type === 'hold') {
    if (inside) {
      const mult = (mods && mods.holdMult) || 1;
      missions.holdLeft -= dt * mult;
      if (missions.holdLeft <= 0) return advanceStep(missions);
    } else {
      missions.holdLeft = step.holdSeconds;
    }
    return '';
  }
  if (inside) return advanceStep(missions);
  return '';
}

function advanceStep(missions) {
  const job = currentJob(missions);
  missions.stepIndex += 1;
  const next = job.steps[missions.stepIndex];
  if (next && next.type === 'hold') missions.holdLeft = next.holdSeconds;
  if (missions.stepIndex >= job.steps.length) {
    missions.phase = 'done';
    return 'job';
  }
  return 'step';
}

/** Score the finished job and return the breakdown lines for the results panel. */
export function scoreJob(missions, state, crew) {
  const job = currentJob(missions);
  const approach = APPROACHES.find((a) => a.id === missions.approach) || APPROACHES[0];
  const crewMult = crew && crew.hired.includes('mira') ? 1.1 : 1;
  const loot = Math.round(job.loot * approach.lootMult * crewMult);
  const costs = planCost(missions);
  let bonuses = 0;
  const lines = [];
  lines.push(`Loot: ${money(loot)} (${job.name})`);
  if (costs > 0) lines.push(`Tools: -${money(costs)}`);
  if (!missions.damageTaken) {
    bonuses += CLEAN_BONUS;
    lines.push(`Clean run bonus: +${money(CLEAN_BONUS)}`);
  }
  if (missions.elapsed <= job.par) {
    bonuses += FAST_BONUS;
    lines.push(`Under par (${Math.round(missions.elapsed)}s vs ${job.par}s): +${money(FAST_BONUS)}`);
  }
  if (crew && crew.hired.includes('brute')) {
    bonuses += 300;
    lines.push(`Brute muscle bonus: +${money(300)}`);
  }
  const total = loot - costs + bonuses;
  state.cash += total;
  state.totalEarned += total;
  state.jobsDone = Math.max(state.jobsDone, missions.jobIndex + 1);
  state.turf[job.district] = Math.min(100, (state.turf[job.district] || 0) + TURF_JOB_GAIN);
  const best = Math.max(state.bestScore, total);
  state.bestScore = best;
  missions.lastScore = { loot, costs, bonuses, total, lines };
  return missions.lastScore;
}

/** Move on to the next job; returns null when the campaign is finished. */
export function nextJob(missions) {
  missions.jobIndex += 1;
  missions.phase = 'idle';
  missions.lastScore = null;
  return currentJob(missions);
}

export function jobsRemaining(missions) {
  return JOBS.length - missions.jobIndex;
}
