// Emberdrift's state machine and loop: title, play, upgrade, pause and game
// over screens; the fixed-step simulation (director, entities, collisions,
// damage); and the wiring between input, audio and render. Everything else
// lives in the module named for its job; this file only orchestrates.

import { FIELD, PLAYER, STEP, makeRng, rand } from './config.js';
import { createInput, endFrame, pressed, readControls } from './input.js';
import { sfx, startMusic, stopMusic, unlockAudio } from './audio.js';
import { burst, makePlayer, spawnCore, spawnEnemy, spawnText, updateEntities, updatePlayer } from './entities.js';
import { startWave, updateDirector, waveCleared } from './waves.js';
import { applyUpgrade, rollChoices } from './upgrades.js';
import { SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, drawGame, upgradeCardRects } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const input = createInput(canvas);

function loadBest() {
  try {
    return Number(window.localStorage.getItem('emberdrift-best')) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem('emberdrift-best', String(value));
  } catch {
    /* storage is a nicety, never a requirement */
  }
}

/** A fresh game state: an empty field, a stocked sky, and a title screen. */
export function createState(seed) {
  const rng = makeRng(seed);
  const stars = [];
  for (let i = 0; i < 110; i += 1) {
    stars.push({ x: rng() * FIELD.width, y: rng() * FIELD.height, size: rng() < 0.85 ? 1.6 : 2.6, alpha: 0.35 + rng() * 0.6, tw: 0.4 + rng() * 1.6, phase: rng() * 9 });
  }
  const motes = [];
  for (let i = 0; i < 34; i += 1) {
    motes.push({ x: rng() * FIELD.width, y: rng() * FIELD.height, vx: rand(rng, -9, 9), vy: rand(rng, -16, -5), size: 1.4 + rng() * 2.4, phase: rng() * 9 });
  }
  return {
    screen: SCREEN_TITLE,
    time: 0,
    rng,
    player: makePlayer(),
    enemies: [],
    bullets: [],
    enemyBullets: [],
    cores: [],
    particles: [],
    texts: [],
    events: [],
    director: { queue: [], timer: 0, interval: 0.7 },
    choices: [],
    score: 0,
    coresCollected: 0,
    wave: 0,
    best: loadBest(),
    shake: 0,
    flashT: 0,
    muzzle: 0,
    banner: '',
    bannerT: 0,
    mouse: { x: FIELD.width / 2, y: FIELD.height / 2 },
    muted: false,
    stars,
    motes,
  };
}

/** Reset everything and launch wave 1. */
export function startRun(state) {
  const best = state.best;
  const fresh = createState((Math.random() * 1e9) | 0);
  Object.assign(state, fresh, { best, screen: SCREEN_PLAY });
  nextWave(state);
}

/** Advance to the next wave with its banner. */
function nextWave(state) {
  const wave = state.wave + 1;
  startWave(state, wave, spawnEnemy);
  state.banner = wave % 5 === 0 ? '⚠  EMBER DREADNOUGHT  ⚠' : `WAVE ${wave}`;
  state.bannerT = 1.7;
}

/** Take the upgrade at index i and launch the next wave. */
export function chooseUpgrade(state, index) {
  const choice = state.choices[index];
  if (!choice) return;
  applyUpgrade(state, choice);
  state.choices = [];
  state.screen = SCREEN_PLAY;
  nextWave(state);
}

/** Hurt the skiff: shield first, then hull, with flash, shake and a verdict. */
function damagePlayer(state, amount, fromX, fromY) {
  const p = state.player;
  if (!p.alive || p.invulnT > 0) return;
  p.sinceDamage = 0;
  p.invulnT = PLAYER.hurtInvulnerability;
  let rest = amount;
  if (p.shield > 0) {
    const absorbed = Math.min(p.shield, rest);
    p.shield -= absorbed;
    rest -= absorbed;
    state.events.push('shieldHit');
  }
  if (rest > 0) {
    p.hull -= rest;
    state.events.push('hurt');
    state.flashT = 0.55;
    state.shake = Math.max(state.shake, 11);
    const dx = p.x - fromX;
    const dy = p.y - fromY;
    const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    p.vx += (dx / d) * 170;
    p.vy += (dy / d) * 170;
  }
  if (p.hull <= 0) {
    p.hull = 0;
    p.alive = false;
    burst(state, p.x, p.y, '#ffd9a0', 46, 320);
    burst(state, p.x, p.y, '#ff9a3c', 30, 220);
    state.events.push('gameover');
    state.shake = 22;
    state.screen = SCREEN_OVER;
    if (state.score > state.best) {
      state.best = state.score;
      saveBest(state.best);
    }
  }
}

const ENEMY_COLORS = { chaser: '#ff4d6d', shooter: '#b26bff', splitter: '#ff7847', mini: '#ff8fa3', boss: '#e33d5f' };

/** Destroy a drone: score, wreckage, cores, and a splitter's children. */
function killEnemy(state, e, payScore = true) {
  e.dead = true;
  if (payScore) {
    state.score += e.score;
    if (state.texts.length < 12) spawnText(state, e.x, e.y - 6, `+${e.score}`, '#ffd9a0');
  }
  burst(state, e.x, e.y, ENEMY_COLORS[e.type], e.type === 'boss' ? 60 : 16, e.type === 'boss' ? 330 : 230);
  state.events.push(e.type === 'boss' ? 'bigExplosion' : 'explosion');
  if (e.type === 'boss') state.shake = Math.max(state.shake, 16);
  const coreCount = e.type === 'boss' ? 8 : 1 + (state.rng() < 0.35 ? 1 : 0);
  for (let i = 0; i < coreCount; i += 1) spawnCore(state, e.x, e.y);
  if (e.type === 'splitter') {
    for (let i = 0; i < 3; i += 1) {
      const child = spawnEnemy(state, 'mini', e.x + (i - 1) * 14, e.y + (i % 2 === 0 ? -8 : 8));
      child.vx = (i - 1) * 120;
      child.vy = (i % 2 === 0 ? -1 : 1) * 90;
    }
  }
}

/** Circle collision test between two things with x, y and radius. */
function touches(a, b, pad = 0) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.radius + b.radius + pad;
  return dx * dx + dy * dy < r * r;
}

/** One fixed simulation step of live play. */
export function stepGame(state, dt, controls) {
  if (state.screen !== SCREEN_PLAY) return;
  state.time += dt;
  if (state.bannerT > 0) state.bannerT -= dt;
  if (state.flashT > 0) state.flashT -= dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);

  updateDirector(state, dt, spawnEnemy);
  updatePlayer(state, dt, controls);
  for (const e of state.enemies) if (e.flashT > 0) e.flashT -= dt;
  updateEntities(state, dt);

  const p = state.player;
  for (const b of state.bullets) {
    if (b.dead) continue;
    for (const e of state.enemies) {
      if (e.dead) continue;
      if (touches(b, e)) {
        b.dead = true;
        e.hp -= b.damage;
        e.flashT = 0.09;
        state.events.push('hit');
        if (e.hp <= 0) killEnemy(state, e);
        break;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => !b.dead);
  if (p.alive) {
    for (const b of state.enemyBullets) {
      if (!b.dead && touches(b, p, -2)) {
        b.dead = true;
        damagePlayer(state, b.damage, b.x, b.y);
      }
    }
    state.enemyBullets = state.enemyBullets.filter((b) => !b.dead);
    for (const e of state.enemies) {
      if (e.dead || !p.alive) continue;
      if (touches(e, p, -3)) {
        if (e.type === 'boss') {
          damagePlayer(state, e.contactDamage, e.x, e.y);
        } else {
          killEnemy(state, e, false);
          damagePlayer(state, e.contactDamage, e.x, e.y);
        }
      }
    }
    state.enemies = state.enemies.filter((e) => !e.dead);
  }

  if (state.screen === SCREEN_PLAY && p.alive && waveCleared(state)) {
    state.choices = rollChoices(state);
    state.screen = SCREEN_UPGRADE;
    state.events.push('waveClear');
  }
  drainEvents(state);
}

/** Play the sounds the simulation asked for this step, unless muted. */
function drainEvents(state) {
  if (!state.muted) {
    for (const event of state.events) {
      if (event === 'shoot') sfx.shoot();
      else if (event === 'enemyShoot') sfx.enemyShoot();
      else if (event === 'hit') sfx.hit();
      else if (event === 'explosion') sfx.explosion();
      else if (event === 'bigExplosion') sfx.bigExplosion();
      else if (event === 'hurt') sfx.hurt();
      else if (event === 'shieldHit') sfx.shieldHit();
      else if (event === 'pickup') sfx.pickup();
      else if (event === 'upgrade') sfx.upgrade();
      else if (event === 'waveClear') sfx.waveClear();
      else if (event === 'gameover') sfx.gameOver();
      else if (event === 'bossWarn') sfx.bossWarn();
    }
  }
  state.events.length = 0;
}

/** Advance only the scenery: drifting motes, settling particles, labels. */
function stepAmbient(state, dt) {
  state.time += dt;
  if (state.bannerT > 0) state.bannerT -= dt;
  if (state.flashT > 0) state.flashT -= dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
  for (const mote of state.motes) {
    mote.x += mote.vx * dt;
    mote.y += mote.vy * dt;
    if (mote.y < -6) { mote.y = FIELD.height + 6; mote.x = state.rng() * FIELD.width; }
    if (mote.x < -6) mote.x = FIELD.width + 6;
    if (mote.x > FIELD.width + 6) mote.x = -6;
  }
  updateEntities(state, dt);
  drainEvents(state);
}

/** Per-frame screen keys and clicks, handled before the world steps. */
function handleScreenInput(state) {
  if (state.screen === SCREEN_TITLE) {
    if (input.clicked || pressed(input, 'Enter') || pressed(input, 'Space')) {
      unlockAudio();
      startMusic();
      sfx.ui();
      startRun(state);
    }
  } else if (state.screen === SCREEN_PLAY) {
    if (pressed(input, 'KeyP') || pressed(input, 'Escape')) state.screen = SCREEN_PAUSE;
  } else if (state.screen === SCREEN_PAUSE) {
    if (pressed(input, 'KeyP') || pressed(input, 'Escape')) state.screen = SCREEN_PLAY;
  } else if (state.screen === SCREEN_UPGRADE) {
    for (let i = 0; i < 3; i += 1) {
      if (pressed(input, `Digit${i + 1}`)) {
        chooseUpgrade(state, i);
        return;
      }
    }
    if (input.clicked) {
      const rects = upgradeCardRects();
      for (let i = 0; i < rects.length; i += 1) {
        const r = rects[i];
        if (input.clickX >= r.x && input.clickX <= r.x + r.w && input.clickY >= r.y && input.clickY <= r.y + r.h) {
          chooseUpgrade(state, i);
          return;
        }
      }
    }
  } else if (state.screen === SCREEN_OVER) {
    if (input.clicked || pressed(input, 'KeyR') || pressed(input, 'Enter')) {
      unlockAudio();
      startMusic();
      startRun(state);
    }
  }
  if (pressed(input, 'KeyM')) {
    state.muted = !state.muted;
    if (state.muted) stopMusic();
    else if (state.screen !== SCREEN_TITLE) startMusic();
  }
}

function fitCanvas() {
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  canvas.style.width = `${Math.floor(FIELD.width * scale)}px`;
  canvas.style.height = `${Math.floor(FIELD.height * scale)}px`;
}
window.addEventListener('resize', fitCanvas);

/** Boot: a staged screenshot scene when ?shot= is present, else live play. */
function boot() {
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  fitCanvas();
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = Number(params.get('seed')) || 1;
  const state = createState(seed);
  window.EMBERDRIFT = { state, startRun, stepGame, chooseUpgrade };

  if (shot) {
    if (shot === 'title') {
      for (let i = 0; i < Math.floor(2.5 / STEP); i += 1) stepAmbient(state, STEP);
    } else {
      stageShot(state, shot, { startRun, stepGame, chooseUpgrade });
    }
    const renderFrozen = () => {
      drawGame(ctx, state);
      window.requestAnimationFrame(renderFrozen);
    };
    renderFrozen();
    return;
  }

  let last = performance.now();
  let accumulator = 0;
  let lastScreen = state.screen;
  const frame = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    state.mouse.x = input.mouseX;
    state.mouse.y = input.mouseY;
    handleScreenInput(state);
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard < 16) {
      if (state.screen === SCREEN_PLAY) stepGame(state, STEP, readControls(input));
      else if (state.screen !== SCREEN_PAUSE) stepAmbient(state, STEP);
      else state.time += STEP;
      accumulator -= STEP;
      guard += 1;
    }
    if (guard === 16) accumulator = 0;
    if (state.screen !== lastScreen) {
      lastScreen = state.screen;
      status.textContent = `Emberdrift: ${state.screen}, wave ${state.wave}, score ${state.score}`;
    }
    drawGame(ctx, state);
    endFrame(input);
    window.requestAnimationFrame(frame);
  };
  window.requestAnimationFrame(frame);
}

boot();
