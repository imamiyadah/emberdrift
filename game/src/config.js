// Emberdrift tuning: the field, the skiff, the drone bestiary and the palette.
// Every number that shapes how the game feels lives in this one file, so the
// balance can be adjusted without hunting through the simulation code.

/** The play field is a fixed 1280x720 stage; the canvas scales to fit the window. */
export const FIELD = { width: 1280, height: 720 };

/** Fixed simulation step (120 Hz); the render loop accumulates real time into steps. */
export const STEP = 1 / 120;

/** The salvage skiff the player pilots. Speeds are pixels per second. */
export const PLAYER = {
  radius: 13,
  speed: 258,
  acceleration: 2400,
  drag: 6.5,
  hull: 100,
  fireInterval: 0.16,
  bulletSpeed: 660,
  bulletDamage: 10,
  bulletRadius: 4,
  magnetRadius: 78,
  pickupRadius: 24,
  hurtInvulnerability: 0.35,
  shieldRegenDelay: 4,
  shieldRegenRate: 7,
};

/** Enemy drone definitions. `score` is paid on destruction; cores drop separately. */
export const ENEMIES = {
  chaser: { hp: 20, speed: 108, radius: 13, contactDamage: 12, score: 50, coreChance: 0.55 },
  shooter: { hp: 26, speed: 74, radius: 14, contactDamage: 10, score: 80, coreChance: 0.6, fireInterval: 2.3, bulletSpeed: 265, bulletDamage: 8, standoff: 285 },
  splitter: { hp: 36, speed: 60, radius: 18, contactDamage: 10, score: 70, coreChance: 0.7, children: 3 },
  mini: { hp: 8, speed: 172, radius: 8, contactDamage: 6, score: 25, coreChance: 0.25 },
  boss: { hp: 720, speed: 44, radius: 44, contactDamage: 26, score: 1000, coreChance: 1, fireInterval: 1.5, bulletSpeed: 240, bulletDamage: 10 },
};

/** Enemy bullets share one look; only speed and damage vary by shooter. */
export const ENEMY_BULLET = { radius: 5 };

/** Ember cores: the currency that drifts out of wreckage and flies to the skiff. */
export const CORE = { radius: 6, value: 10, lifetime: 14, pullSpeed: 430 };

/** Wave growth: how much tougher drones get as the waves climb. */
export const SCALING = { hpPerWave: 0.13, speedPerWave: 0.012, bossHpPerBoss: 0.55 };

/** The ember-and-indigo palette every drawing in render.js shares. */
export const COLORS = {
  spaceTop: '#05071a',
  spaceBottom: '#0d1233',
  star: '#aebaff',
  mote: '#ff9a3c',
  hull: '#ffd9a0',
  hullDark: '#b06a28',
  canopy: '#8fe8ff',
  thrust: '#ff9a3c',
  bullet: '#ffe9b0',
  enemyBullet: '#ff5d7a',
  core: '#ffc46b',
  coreHot: '#fff3cf',
  chaser: '#ff4d6d',
  shooter: '#b26bff',
  splitter: '#ff7847',
  mini: '#ff8fa3',
  boss: '#e33d5f',
  text: '#f4ecd9',
  textDim: '#9aa3c7',
  panel: 'rgba(10, 13, 34, 0.82)',
  panelEdge: '#3a4470',
  good: '#7dffb0',
  bad: '#ff5d7a',
};

/**
 * A small seedable random generator (mulberry32). Gameplay draws from one of
 * these so a staged screenshot scene with a fixed seed is reproducible.
 */
export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  return function rng() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max) drawn from the given generator. */
export function rand(rng, min, max) {
  return min + rng() * (max - min);
}

/** Clamp a value into [min, max]. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Distance between two points. */
export function distance(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}
