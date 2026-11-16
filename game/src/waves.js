// The wave director: what each wave is made of, where drones warp in, and
// when the next one may enter. Every fifth wave is a boss with a trickle of
// escorts; the rest grow longer and meaner as the count climbs.

import { FIELD } from './config.js';

/** The list of drone kinds a wave sends in, in spawn order. */
export function compositionFor(wave, rng) {
  if (wave % 5 === 0) {
    const list = ['boss'];
    const escorts = 4 + Math.ceil(wave / 5) * 2;
    for (let i = 0; i < escorts; i += 1) list.push(i % 3 === 2 ? 'shooter' : 'chaser');
    return list;
  }
  const list = [];
  const count = 5 + wave * 2;
  for (let i = 0; i < count; i += 1) {
    const roll = rng();
    if (wave >= 3 && roll < 0.2) list.push('splitter');
    else if (wave >= 2 && roll < 0.45) list.push('shooter');
    else list.push('chaser');
  }
  return list;
}

/** A spawn point on a field edge, kept a fair distance from the skiff. */
function spawnPoint(state) {
  const p = state.player;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const edge = Math.floor(state.rng() * 4);
    let x;
    let y;
    if (edge === 0) { x = state.rng() * FIELD.width; y = -24; }
    else if (edge === 1) { x = state.rng() * FIELD.width; y = FIELD.height + 24; }
    else if (edge === 2) { x = -24; y = state.rng() * FIELD.height; }
    else { x = FIELD.width + 24; y = state.rng() * FIELD.height; }
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy > 280 * 280 || attempt === 7) return { x, y };
  }
  return { x: -24, y: -24 };
}

/** Begin a wave: queue its composition and announce it on the state. */
export function startWave(state, wave, spawnEnemy) {
  state.wave = wave;
  state.director.queue = compositionFor(wave, state.rng);
  state.director.timer = 0.6;
  state.director.interval = wave % 5 === 0 ? 1.5 : Math.max(0.38, 0.78 - wave * 0.03);
  if (wave % 5 === 0) state.events.push('bossWarn');
}

/** Feed queued drones into the field, one every interval, boss first. */
export function updateDirector(state, dt, spawnEnemy) {
  const director = state.director;
  if (director.queue.length === 0) return;
  director.timer -= dt;
  if (director.timer > 0) return;
  const type = director.queue.shift();
  const point = type === 'boss' ? { x: FIELD.width / 2, y: -60 } : spawnPoint(state);
  spawnEnemy(state, type, point.x, point.y);
  director.timer = director.interval;
}

/** True when the queue is spent and the field is clear: the wave is won. */
export function waveCleared(state) {
  return state.director.queue.length === 0 && state.enemies.length === 0;
}
