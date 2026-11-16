// Deterministic screenshot scenes behind ?shot=combat|upgrade|over&seed=n.
// Each scene starts a real run and plays it forward with the fixed step —
// combat and upgrade with a competent autopilot, game over with a pilot who
// never touches the controls — so the frame is what an actual game looks
// like, and the same seed always stages the same scene.

import { FIELD, STEP } from './config.js';

/** Controls from a pilot that aims with lead, keeps its distance and feeds on cores. */
function autopilot(state) {
  const p = state.player;
  let target = null;
  let targetDist = Infinity;
  for (const e of state.enemies) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < targetDist) {
      targetDist = d;
      target = e;
    }
  }
  let moveX = 0;
  let moveY = 0;
  if (target) {
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const keep = target.type === 'boss' ? 320 : 225;
    const away = targetDist < keep ? -1 : targetDist > keep + 90 ? 0.4 : 0;
    moveX = (dx / targetDist) * away + (-dy / targetDist) * 0.55;
    moveY = (dy / targetDist) * away + (dx / targetDist) * 0.55;
  }
  let core = null;
  let coreDist = Infinity;
  for (const c of state.cores) {
    const dx = c.x - p.x;
    const dy = c.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < coreDist) {
      coreDist = d;
      core = c;
    }
  }
  if (core && (!target || targetDist > 200)) {
    moveX = (core.x - p.x) / Math.max(1, coreDist);
    moveY = (core.y - p.y) / Math.max(1, coreDist);
  }
  if (!target && !core) {
    moveX = FIELD.width / 2 - p.x;
    moveY = FIELD.height / 2 - p.y;
  }
  const len = Math.sqrt(moveX * moveX + moveY * moveY);
  if (len > 1) {
    moveX /= len;
    moveY /= len;
  }
  let aimX = p.x + 10;
  let aimY = p.y;
  if (target) {
    const lead = Math.min(0.45, targetDist / 660);
    aimX = target.x + target.vx * lead;
    aimY = target.y + target.vy * lead;
  }
  return { mx: moveX, my: moveY, aimX, aimY, firing: target !== null && targetDist < 640 };
}

/** Controls from a pilot who never flies and never fires: the swarm wins. */
function kamikaze(state) {
  return { mx: 0, my: 0, aimX: state.player.x + 10, aimY: state.player.y, firing: false };
}

/**
 * Stage the named scene on a fresh run. `helpers` carries main.js's own
 * startRun, stepGame and chooseUpgrade so this file stays free of the state
 * machine it drives. Returns when the scene is set; the caller then renders
 * it without stepping further.
 */
/**
 * True when a combat frame is worth keeping: wave 2 or deeper, at least two
 * drones close to the skiff, fire in the air, and the skiff away from the
 * field's edges — the difference between a battle and a parking spot.
 */
function richCombatFrame(state) {
  if (state.wave < 2 || state.enemies.length < 4) return false;
  const p = state.player;
  if (p.x < 150 || p.x > FIELD.width - 150 || p.y < 150 || p.y > FIELD.height - 150) return false;
  let near = 0;
  for (const e of state.enemies) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    if (dx * dx + dy * dy < 430 * 430) near += 1;
  }
  return near >= 2 && state.bullets.length + state.enemyBullets.length >= 4;
}

export function stageShot(state, name, helpers) {
  helpers.startRun(state);
  const pilot = name === 'over' ? kamikaze : autopilot;
  const limit = name === 'over' ? 200 : name === 'upgrade' ? 150 : 120;
  const steps = Math.floor(limit / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (state.screen === 'upgrade') {
      if (name === 'upgrade') return;
      helpers.chooseUpgrade(state, 0);
    }
    if (state.screen === 'over') return;
    if (name === 'combat' && richCombatFrame(state)) return;
    helpers.stepGame(state, STEP, pilot(state));
  }
}
