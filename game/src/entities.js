// The things that move: the player's skiff, the five drone kinds, bullets,
// ember cores, particles and floating score text — their shapes and their
// per-step behaviour. Collisions between them live in main.js, which owns
// the state machine; sounds are requested through state.events, never played
// from here, so the simulation stays deterministic under a fixed seed.

import { CORE, ENEMIES, ENEMY_BULLET, FIELD, PLAYER, SCALING, clamp, distance, rand } from './config.js';

/** A fresh player skiff at the centre of the field with base stats. */
export function makePlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2 + 120,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hull: PLAYER.hull,
    maxHull: PLAYER.hull,
    shield: 0,
    maxShield: 0,
    fireTimer: 0,
    invulnT: 0,
    sinceDamage: 99,
    damageMul: 1,
    fireRateMul: 1,
    speedMul: 1,
    magnetMul: 1,
    bulletSpeedMul: 1,
    projectiles: 1,
    regen: 0,
    alive: true,
  };
}

/** One drone of the given kind at (x, y), its toughness scaled by the wave. */
export function spawnEnemy(state, type, x, y) {
  const def = ENEMIES[type];
  const hpScale = 1 + SCALING.hpPerWave * (state.wave - 1) + (type === 'boss' ? SCALING.bossHpPerBoss * (Math.ceil(state.wave / 5) - 1) : 0);
  const speedScale = 1 + SCALING.speedPerWave * (state.wave - 1);
  const enemy = {
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: def.hp * hpScale,
    maxHp: def.hp * hpScale,
    radius: def.radius,
    speed: def.speed * speedScale,
    contactDamage: def.contactDamage,
    bulletDamage: def.bulletDamage ?? 0,
    score: def.score,
    fireTimer: rand(state.rng, 0.6, 1.6),
    attackTimer: 2.2,
    attackIndex: 0,
    t: 0,
    phase: rand(state.rng, 0, Math.PI * 2),
    dead: false,
  };
  state.enemies.push(enemy);
  return enemy;
}

/** A bullet fired by the player (friendly) or by a drone. */
export function spawnBullet(state, friendly, x, y, vx, vy, damage) {
  const bullet = { x, y, vx, vy, damage, radius: friendly ? PLAYER.bulletRadius : ENEMY_BULLET.radius, life: 2.4, dead: false };
  (friendly ? state.bullets : state.enemyBullets).push(bullet);
  return bullet;
}

/** An ember core that pops out of wreckage and drifts until collected. */
export function spawnCore(state, x, y) {
  const angle = rand(state.rng, 0, Math.PI * 2);
  const speed = rand(state.rng, 20, 90);
  state.cores.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    t: 0,
    value: CORE.value,
    dead: false,
  });
}

/** A burst of glowing debris; the cheapest good-looking explosion there is. */
export function burst(state, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const angle = rand(state.rng, 0, Math.PI * 2);
    const v = rand(state.rng, speed * 0.2, speed);
    const life = rand(state.rng, 0.3, 0.8);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life,
      maxLife: life,
      size: rand(state.rng, 1.5, 3.8),
      color,
      dead: false,
    });
  }
}

/** A short-lived label that floats up from a point (score popups, warnings). */
export function spawnText(state, x, y, text, color) {
  state.texts.push({ x, y, text, color, life: 1.1, dead: false });
}

/** Move the skiff, aim it, fire its cannon, and tick its shield and repairs. */
export function updatePlayer(state, dt, controls) {
  const p = state.player;
  if (!p.alive) return;
  p.vx += controls.mx * PLAYER.acceleration * dt;
  p.vy += controls.my * PLAYER.acceleration * dt;
  const drag = Math.max(0, 1 - PLAYER.drag * dt);
  p.vx *= drag;
  p.vy *= drag;
  const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  const maxSpeed = PLAYER.speed * p.speedMul;
  if (speed > maxSpeed) {
    p.vx = (p.vx / speed) * maxSpeed;
    p.vy = (p.vy / speed) * maxSpeed;
  }
  p.x = clamp(p.x + p.vx * dt, p.radius, FIELD.width - p.radius);
  p.y = clamp(p.y + p.vy * dt, p.radius, FIELD.height - p.radius);
  p.angle = Math.atan2(controls.aimY - p.y, controls.aimX - p.x);

  p.fireTimer -= dt;
  if (controls.firing && p.fireTimer <= 0) {
    p.fireTimer = PLAYER.fireInterval / p.fireRateMul;
    const count = p.projectiles;
    const spreadStep = 0.09;
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * spreadStep;
      const angle = p.angle + offset;
      const speedB = PLAYER.bulletSpeed * p.bulletSpeedMul;
      spawnBullet(
        state, true,
        p.x + Math.cos(p.angle) * (p.radius + 4),
        p.y + Math.sin(p.angle) * (p.radius + 4),
        Math.cos(angle) * speedB,
        Math.sin(angle) * speedB,
        PLAYER.bulletDamage * p.damageMul,
      );
    }
    state.events.push('shoot');
    state.muzzle = 0.05;
  }

  if (p.invulnT > 0) p.invulnT -= dt;
  p.sinceDamage += dt;
  if (p.maxShield > 0 && p.sinceDamage > PLAYER.shieldRegenDelay && p.shield < p.maxShield) {
    p.shield = Math.min(p.maxShield, p.shield + PLAYER.shieldRegenRate * dt);
  }
  if (p.regen > 0 && p.hull < p.maxHull) {
    p.hull = Math.min(p.maxHull, p.hull + p.regen * dt);
  }
  if (state.muzzle > 0) state.muzzle -= dt;
}

/** Steer one drone for a step, according to its kind's habits. */
function steer(state, e, dt) {
  const p = state.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const ux = dx / dist;
  const uy = dy / dist;
  if (e.type === 'chaser' || e.type === 'mini') {
    const wobble = Math.sin(e.t * 3.1 + e.phase) * 0.35;
    const tx = ux * Math.cos(wobble) - uy * Math.sin(wobble);
    const ty = ux * Math.sin(wobble) + uy * Math.cos(wobble);
    e.vx += (tx * e.speed - e.vx) * Math.min(1, 5 * dt);
    e.vy += (ty * e.speed - e.vy) * Math.min(1, 5 * dt);
  } else if (e.type === 'shooter') {
    const standoff = ENEMIES.shooter.standoff;
    const radial = dist > standoff + 30 ? 1 : dist < standoff - 30 ? -1 : 0;
    const orbit = Math.sin(e.phase) > 0 ? 1 : -1;
    const tx = ux * radial + -uy * orbit * 0.7;
    const ty = uy * radial + ux * orbit * 0.7;
    const len = Math.max(1, Math.sqrt(tx * tx + ty * ty));
    e.vx += ((tx / len) * e.speed - e.vx) * Math.min(1, 3.5 * dt);
    e.vy += ((ty / len) * e.speed - e.vy) * Math.min(1, 3.5 * dt);
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && dist < 560 && p.alive) {
      e.fireTimer = ENEMIES.shooter.fireInterval * rand(state.rng, 0.85, 1.2);
      const bs = ENEMIES.shooter.bulletSpeed;
      spawnBullet(state, false, e.x + ux * (e.radius + 4), e.y + uy * (e.radius + 4), ux * bs, uy * bs, e.bulletDamage);
      state.events.push('enemyShoot');
    }
  } else if (e.type === 'splitter') {
    e.vx += (ux * e.speed - e.vx) * Math.min(1, 3 * dt);
    e.vy += (uy * e.speed - e.vy) * Math.min(1, 3 * dt);
  } else if (e.type === 'boss') {
    steerBoss(state, e, dt);
  }
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.x = clamp(e.x, e.radius, FIELD.width - e.radius);
  e.y = clamp(e.y, e.radius, FIELD.height - e.radius);
}

/** The boss holds the top of the field and cycles radial, aimed and spawn attacks. */
function steerBoss(state, e, dt) {
  const targetX = FIELD.width / 2 + Math.sin(e.t * 0.45) * 300;
  const targetY = 150 + Math.sin(e.t * 0.8) * 36;
  e.vx += (clamp(targetX - e.x, -1, 1) * e.speed - e.vx) * Math.min(1, 2 * dt);
  e.vy += (clamp(targetY - e.y, -1, 1) * e.speed - e.vy) * Math.min(1, 2 * dt);
  e.attackTimer -= dt;
  if (e.attackTimer > 0 || !state.player.alive) return;
  const p = state.player;
  const kind = e.attackIndex % 3;
  e.attackIndex += 1;
  if (kind === 0) {
    const n = 18;
    const base = rand(state.rng, 0, Math.PI * 2);
    for (let i = 0; i < n; i += 1) {
      const a = base + (i / n) * Math.PI * 2;
      spawnBullet(state, false, e.x + Math.cos(a) * e.radius, e.y + Math.sin(a) * e.radius, Math.cos(a) * ENEMIES.boss.bulletSpeed, Math.sin(a) * ENEMIES.boss.bulletSpeed, e.bulletDamage);
    }
    e.attackTimer = 2.6;
    state.events.push('enemyShoot');
  } else if (kind === 1) {
    const base = Math.atan2(p.y - e.y, p.x - e.x);
    for (let i = -2; i <= 2; i += 1) {
      const a = base + i * 0.13;
      spawnBullet(state, false, e.x + Math.cos(a) * e.radius, e.y + Math.sin(a) * e.radius, Math.cos(a) * (ENEMIES.boss.bulletSpeed + 60), Math.sin(a) * (ENEMIES.boss.bulletSpeed + 60), e.bulletDamage);
    }
    e.attackTimer = 1.7;
    state.events.push('enemyShoot');
  } else {
    for (let i = 0; i < 2; i += 1) {
      const child = spawnEnemy(state, 'chaser', e.x + (i === 0 ? -70 : 70), e.y + 30);
      child.vx = (i === 0 ? -1 : 1) * 90;
      child.vy = 120;
    }
    e.attackTimer = 3.1;
  }
}

/** Advance every drone, bullet, core, particle and floating label one step. */
export function updateEntities(state, dt) {
  for (const e of state.enemies) {
    e.t += dt;
    steer(state, e, dt);
  }
  for (const listName of ['bullets', 'enemyBullets']) {
    for (const b of state[listName]) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) b.dead = true;
    }
  }
  const p = state.player;
  for (const c of state.cores) {
    c.t += dt;
    c.vx *= Math.max(0, 1 - 2.2 * dt);
    c.vy *= Math.max(0, 1 - 2.2 * dt);
    const d = distance(c.x, c.y, p.x, p.y);
    const magnet = PLAYER.magnetRadius * p.magnetMul;
    if (p.alive && d < magnet && d > 1) {
      const pull = CORE.pullSpeed * (1.15 - d / magnet);
      c.vx += ((p.x - c.x) / d) * pull * dt * 4;
      c.vy += ((p.y - c.y) / d) * pull * dt * 4;
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (c.t > CORE.lifetime) c.dead = true;
    else if (p.alive && d < PLAYER.pickupRadius) {
      c.dead = true;
      state.score += c.value;
      state.coresCollected += 1;
      burst(state, c.x, c.y, '#ffc46b', 4, 90);
      state.events.push('pickup');
    }
  }
  for (const pt of state.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= Math.max(0, 1 - 2.6 * dt);
    pt.vy *= Math.max(0, 1 - 2.6 * dt);
    if (pt.life <= 0) pt.dead = true;
  }
  for (const t of state.texts) {
    t.life -= dt;
    t.y -= 34 * dt;
    if (t.life <= 0) t.dead = true;
  }
  for (const listName of ['enemies', 'bullets', 'enemyBullets', 'cores', 'particles', 'texts']) {
    state[listName] = state[listName].filter((item) => !item.dead);
  }
}
