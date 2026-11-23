// The city of Velmaris, built once from a seed: district ground, a road grid, a
// building in most blocks, palms and lamps along the streets, and a beach and sea
// along the north edge. Landmark plazas stay open so their buildings stand alone.

import { DISTRICTS, HORIZONTAL_ROADS, LANDMARKS, VERTICAL_ROADS, WORLD } from './config.js';
import { pickRandom, rangeRandom } from './random.js';

const BUILDING_COLORS = ['#7a6a58', '#5e6b7a', '#8a7a6a', '#6a7a5e', '#7a5e6b', '#5e5e6b', '#9a8a72'];

function nearLandmark(x, y) {
  for (const key of Object.keys(LANDMARKS)) {
    const mark = LANDMARKS[key];
    if (Math.abs(mark.x - x) < 260 && Math.abs(mark.y - y) < 260) return true;
  }
  return false;
}

function districtAt(x, y) {
  for (const district of DISTRICTS) {
    if (x >= district.x && x < district.x + district.w && y >= district.y && y < district.y + district.h) return district;
  }
  return DISTRICTS[0];
}

export function buildCity(random) {
  const buildings = [];
  const palms = [];
  const lamps = [];
  // One or two buildings per block, in the cells between the roads.
  const cellXs = [48, 448, 848, 1248, 1648, 2048, 2448, 2848];
  const cellYs = [248, 648, 1048, 1448, 1848];
  for (const cellX of cellXs) {
    for (const cellY of cellYs) {
      const cx = cellX + 152;
      const cy = cellY + 152;
      if (nearLandmark(cx, cy)) continue;
      const count = random() < 0.6 ? 1 : 2;
      for (let index = 0; index < count; index += 1) {
        const w = rangeRandom(random, 90, 200);
        const h = rangeRandom(random, 90, 200);
        const x = cellX + 20 + random() * Math.max(1, 304 - 40 - w);
        const y = cellY + 20 + random() * Math.max(1, 304 - 40 - h);
        buildings.push({
          x, y, w, h,
          color: pickRandom(random, BUILDING_COLORS),
          roof: random() < 0.3,
          district: districtAt(cx, cy).id,
        });
      }
    }
  }
  // Palms along the beach and lamps at every intersection.
  for (let x = 100; x < WORLD.width; x += 160) {
    palms.push({ x: x + rangeRandom(random, -30, 30), y: rangeRandom(random, 150, 210) });
  }
  for (const rx of VERTICAL_ROADS) {
    for (const ry of HORIZONTAL_ROADS) {
      lamps.push({ x: rx + 58, y: ry - 58 });
      if (random() < 0.5) palms.push({ x: rx - 70 + rangeRandom(random, -10, 10), y: ry + 70 });
    }
  }
  return { buildings, palms, lamps };
}

/** True when the circle at (x, y) with radius r touches any building. */
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

/** Push a circle out of any building it overlaps; returns the building hit, if any. */
export function pushOutOfBuildings(city, body, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r || d2 === 0) continue;
    const d = Math.sqrt(d2);
    body.x = cx + (dx / d) * r;
    body.y = cy + (dy / d) * r;
    return b;
  }
  return null;
}

/** The district whose ground the point stands on. */
export function districtAtPoint(x, y) {
  return districtAt(x, y);
}
