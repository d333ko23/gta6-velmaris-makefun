// Velmaris tuning: every number and name that shapes the city, the jobs, the crew,
// the police and the economy lives here, so the rules can be read in one place.
// The world is a fixed 3200x2400 coastal city; the renderer scales it to the window.

export const STEP = 1 / 60;
export const WORLD = { width: 3200, height: 2400 };
export const ROAD_WIDTH = 96;
export const VERTICAL_ROADS = [400, 800, 1200, 1600, 2000, 2400, 2800];
export const HORIZONTAL_ROADS = [400, 800, 1200, 1600, 2000];

export const SAVE_KEY = 'velmaris.save.v1';
export const BEST_KEY = 'velmaris.best.v1';
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const PALETTE = {
  backdrop: '#0b0f1a',
  sea: '#1d6f8f',
  sand: '#d9c08a',
  grass: '#3f7a4a',
  road: '#33363d',
  roadLine: '#d8c95a',
  sidewalk: '#5a5f6b',
  panel: '#141824',
  panelEdge: '#2c3345',
  text: '#f2f4f8',
  muted: '#9aa3b5',
  gold: '#f2c94c',
  cash: '#7ee787',
  danger: '#ff5a4e',
  police: '#4f8ef7',
  heli: '#c9d4ff',
};

export const DISTRICTS = [
  { id: 'harbor', name: 'Old Harbor', x: 0, y: 240, w: 1600, h: 760, ground: '#4a6b52', accent: '#8fd0a0' },
  { id: 'marina', name: 'Marina Bay', x: 1600, y: 240, w: 1600, h: 760, ground: '#3d6b7a', accent: '#7fd4e8' },
  { id: 'coral', name: 'Coral Row', x: 0, y: 1000, w: 1600, h: 760, ground: '#6b4a5e', accent: '#f0a0c8' },
  { id: 'foundry', name: 'Foundry', x: 1600, y: 1000, w: 1600, h: 760, ground: '#5e5648', accent: '#e8b07f' },
  { id: 'palm', name: 'Palm Court', x: 0, y: 1760, w: 1600, h: 640, ground: '#4a6b3d', accent: '#b8e87f' },
  { id: 'docks', name: 'North Docks', x: 1600, y: 1760, w: 1600, h: 640, ground: '#4d4a6b', accent: '#a0a8f0' },
];

export const LANDMARKS = {
  safehouse: { x: 560, y: 560, label: 'SAFEHOUSE', color: '#7ee787' },
  garage: { x: 2560, y: 560, label: 'GARAGE', color: '#f2a54c' },
  bank: { x: 1400, y: 1400, label: 'VELMARIS BANK', color: '#f2c94c' },
  casino: { x: 2200, y: 1800, label: 'GILDED GULL CASINO', color: '#e87fd4' },
  docks: { x: 2960, y: 300, label: 'NORTH DOCKS', color: '#7fd4e8' },
  marina: { x: 1800, y: 300, label: 'MARINA', color: '#8fd0a0' },
};

export const PLAYER = { walkSpeed: 200, radius: 15, health: 100 };
export const CAR = {
  length: 54, width: 26, accel: 430, topSpeed: 540, reverseSpeed: 190,
  steer: 2.7, brake: 760, drag: 0.35, health: 100,
};
export const TRAFFIC_COLORS = ['#c94f4f', '#4f7ec9', '#c9a44f', '#7f8a96', '#8a4fc9', '#4fc98a', '#d8d8d8'];

// One story job: a name, a briefing, a loot value, the district it pays off in, and a
// chain of steps. Step types: go (reach the point), pickup (reach and grab), hold (stay
// in the circle for the seconds), deliver (reach with the goods).
export const JOBS = [
  {
    id: 'harbor-heist', name: '1 · Harbor Heist', loot: 2500, par: 120, district: 'marina',
    brief: 'A crate of dock cargo is waiting at North Docks. Grab it and bring it home.',
    steps: [
      { type: 'pickup', x: 2960, y: 300, label: 'Pick up the crate at North Docks' },
      { type: 'deliver', x: 560, y: 560, label: 'Deliver the crate to the Safehouse' },
    ],
  },
  {
    id: 'getaway-driver', name: '2 · Getaway Driver', loot: 3200, par: 150, district: 'coral',
    brief: 'A tuned coupe is parked on Coral Row. Steal it and park it in the Garage.',
    steps: [
      { type: 'pickup', x: 1200, y: 1200, label: 'Steal the coupe on Coral Row' },
      { type: 'deliver', x: 2560, y: 560, label: 'Deliver the coupe to the Garage' },
    ],
  },
  {
    id: 'silent-courier', name: '3 · Silent Courier', loot: 4000, par: 180, district: 'harbor',
    brief: 'Three drops, no noise. Collect them all, stay out of the VPD spotlight.',
    steps: [
      { type: 'pickup', x: 800, y: 800, label: 'Collect drop 1 of 3 — Old Harbor' },
      { type: 'pickup', x: 2000, y: 1200, label: 'Collect drop 2 of 3 — Foundry' },
      { type: 'pickup', x: 1200, y: 2000, label: 'Collect drop 3 of 3 — Palm Court' },
      { type: 'deliver', x: 560, y: 560, label: 'Bring the drops to the Safehouse' },
    ],
  },
  {
    id: 'bank-job', name: '4 · Bank Job', loot: 12000, par: 150, district: 'foundry',
    brief: 'Velmaris Bank keeps its vault open too long. Hold the lobby, then vanish.',
    steps: [
      { type: 'go', x: 1400, y: 1400, label: 'Reach Velmaris Bank' },
      { type: 'hold', x: 1400, y: 1400, label: 'Hold the lobby — crack the vault', holdSeconds: 8 },
      { type: 'escape', x: 560, y: 560, label: 'Escape to the Safehouse' },
    ],
  },
  {
    id: 'turf-war', name: '5 · Turf War', loot: 5500, par: 180, district: 'palm',
    brief: 'Palm Court answers to whoever paints it. Mark three corners as yours.',
    steps: [
      { type: 'hold', x: 400, y: 1600, label: 'Tag corner 1 of 3 — Palm Court', holdSeconds: 4 },
      { type: 'hold', x: 1600, y: 2000, label: 'Tag corner 2 of 3 — Palm Court', holdSeconds: 4 },
      { type: 'hold', x: 800, y: 2000, label: 'Tag corner 3 of 3 — Palm Court', holdSeconds: 4 },
    ],
  },
  {
    id: 'informant', name: '6 · The Informant', loot: 6800, par: 150, district: 'marina',
    brief: 'An informant wants out of Marina Bay. Pick him up and get him to the Marina.',
    steps: [
      { type: 'pickup', x: 2400, y: 800, label: 'Pick up the informant — Foundry' },
      { type: 'deliver', x: 1800, y: 300, label: 'Drop him at the Marina' },
    ],
  },
  {
    id: 'midnight-run', name: '7 · Midnight Run', loot: 9500, par: 150, district: 'docks', night: true,
    brief: 'A midnight cargo run across the whole city. Fast, dark, and do not get followed.',
    steps: [
      { type: 'pickup', x: 400, y: 2000, label: 'Pick up the cargo — Palm Court' },
      { type: 'deliver', x: 2800, y: 2000, label: 'Deliver to North Docks' },
    ],
  },
  {
    id: 'big-score', name: '8 · The Big Score', loot: 25000, par: 210, district: 'coral',
    brief: 'The Gilded Gull Casino. The vault, the whole crew, five stars of heat. The big one.',
    steps: [
      { type: 'go', x: 2200, y: 1800, label: 'Reach the Gilded Gull Casino' },
      { type: 'hold', x: 2200, y: 1800, label: 'Crack the casino vault', holdSeconds: 12 },
      { type: 'escape', x: 2960, y: 300, label: 'Escape to North Docks' },
    ],
  },
];

export const APPROACHES = [
  { id: 'quiet', name: 'Quiet', lootMult: 0.9, blurb: 'Slow police response. Loot x0.9.' },
  { id: 'loud', name: 'Loud', lootMult: 1.15, blurb: '+1 wanted star at the start. Loot x1.15.' },
  { id: 'crew', name: 'Crew Run', lootMult: 1.2, blurb: 'Needs a hired crew member. Loot x1.2.' },
];

export const TOOLS = [
  { id: 'lockpick', name: 'Lockpick set', cost: 150, blurb: 'Hold steps finish 30% faster.' },
  { id: 'disguise', name: 'Disguise', cost: 300, blurb: 'Wanted rises 50% slower during the job.' },
  { id: 'getaway', name: 'Getaway car', cost: 400, blurb: 'Start the job in a fast tuned car.' },
  { id: 'jammer', name: 'Signal jammer', cost: 250, blurb: 'Police spawn half as often during the job.' },
];

export const CREW_DEFS = [
  { id: 'rook', name: 'Rook — Driver', cost: 1500, blurb: 'Getaway speed +15%. Police lose you 30% faster.' },
  { id: 'mira', name: 'Mira — Hacker', cost: 2500, blurb: '+10% loot. Hold steps finish 25% faster.' },
  { id: 'brute', name: 'Brute — Muscle', cost: 2000, blurb: 'Smashes through roadblocks. +$300 per job.' },
];

export const UPGRADES = {
  engine: { name: 'Engine', costs: [1200, 2000, 3000], blurb: 'Top speed +12% per level.' },
  armor: { name: 'Armor', costs: [1000, 1800, 2600], blurb: 'Crash damage -25% per level.' },
  tires: { name: 'Tires', costs: [800, 1500], blurb: 'Handling +20% per level.' },
};
export const REPAIR_COST = 300;

export const WANTED = {
  max: 5,
  decaySeconds: 6,
  carjack: 1,
  hitPed: 1,
  hitCop: 2,
  jobHeat: { 'bank-job': 2, 'big-score': 3 },
};

export const TURF_INCOME_PER_POINT = 2; // dollars per 30 s per turf point
export const TURF_JOB_GAIN = 15;
export const CLEAN_BONUS = 500;
export const FAST_BONUS = 300;
export const BUSTED_LOSS = 0.15; // lose 15% of cash when busted
