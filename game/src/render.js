// Everything drawn: the ember field, the skiff, the drones, the HUD and the
// four screens (title, upgrade choice, pause, game over). Canvas vector art
// only, in the shared indigo-and-ember palette — no image assets anywhere.

import { COLORS, ENEMIES, FIELD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';

const FONT = 'system-ui, "Segoe UI", sans-serif';

/** The three upgrade card rectangles, shared by drawing and click tests. */
export function upgradeCardRects() {
  const rects = [];
  const w = 360;
  const h = 300;
  const gap = 30;
  const x0 = (FIELD.width - (w * 3 + gap * 2)) / 2;
  for (let i = 0; i < 3; i += 1) rects.push({ x: x0 + i * (w + gap), y: 250, w, h });
  return rects;
}

/** Word-wrap a line of text to a maximum pixel width. */
function wrap(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line === '' ? word : `${line} ${word}`;
    if (ctx.measureText(trial).width > maxWidth && line !== '') {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

function drawBackground(ctx, state) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, COLORS.spaceTop);
  gradient.addColorStop(1, COLORS.spaceBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  for (const star of state.stars) {
    const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(state.time * star.tw + star.phase));
    ctx.globalAlpha = tw * star.alpha;
    ctx.fillStyle = COLORS.star;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
  for (const mote of state.motes) {
    const flicker = 0.5 + 0.5 * Math.sin(state.time * 2.2 + mote.phase);
    ctx.globalAlpha = 0.25 + 0.45 * flicker;
    ctx.fillStyle = COLORS.mote;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** The player's salvage skiff: a pale dart with an ember thruster. */
export function drawSkiff(ctx, x, y, angle, scale, thrust) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  if (thrust > 0) {
    const flame = 12 + thrust * 10 + Math.sin(performance.now() / 31) * 3;
    ctx.fillStyle = COLORS.thrust;
    ctx.beginPath();
    ctx.moveTo(-11, -4.5);
    ctx.lineTo(-11 - flame, 0);
    ctx.lineTo(-11, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.moveTo(-11, -2.2);
    ctx.lineTo(-11 - flame * 0.55, 0);
    ctx.lineTo(-11, 2.2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = COLORS.hull;
  ctx.beginPath();
  ctx.moveTo(17, 0);
  ctx.lineTo(-4, -5);
  ctx.lineTo(-12, -12);
  ctx.lineTo(-9, 0);
  ctx.lineTo(-12, 12);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.hullDark;
  ctx.fillRect(-11, -2, 9, 4);
  ctx.fillStyle = COLORS.canopy;
  ctx.beginPath();
  ctx.arc(4, 0, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (!p.alive) return;
  if (p.invulnT > 0 && Math.floor(state.time * 18) % 2 === 0) ctx.globalAlpha = 0.35;
  const thrust = Math.min(1, Math.sqrt(p.vx * p.vx + p.vy * p.vy) / 200);
  drawSkiff(ctx, p.x, p.y, p.angle, 1, thrust);
  ctx.globalAlpha = 1;
  if (state.muzzle > 0) {
    ctx.fillStyle = 'rgba(255, 233, 176, 0.9)';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (p.maxShield > 0 && p.shield > 0.5) {
    ctx.strokeStyle = 'rgba(143, 232, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 7, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawEnemy(ctx, state, e) {
  const p = state.player;
  const aim = Math.atan2(p.y - e.y, p.x - e.x);
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.type === 'chaser' || e.type === 'mini') {
    ctx.rotate(aim);
    ctx.fillStyle = e.type === 'mini' ? COLORS.mini : COLORS.chaser;
    ctx.beginPath();
    ctx.moveTo(e.radius + 3, 0);
    ctx.lineTo(-e.radius, -e.radius * 0.8);
    ctx.lineTo(-e.radius * 0.4, 0);
    ctx.lineTo(-e.radius, e.radius * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2b0a14';
    ctx.beginPath();
    ctx.arc(2, 0, e.radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'shooter') {
    ctx.fillStyle = COLORS.shooter;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + e.t * 0.7;
      const px = Math.cos(a) * e.radius;
      const py = Math.sin(a) * e.radius;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.rotate(aim);
    ctx.fillStyle = '#e9dcff';
    ctx.fillRect(e.radius - 2, -2.5, 9, 5);
    ctx.fillStyle = '#1d0b33';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'splitter') {
    const pulse = 1 + Math.sin(e.t * 4) * 0.06;
    ctx.scale(pulse, pulse);
    ctx.fillStyle = COLORS.splitter;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd9a0';
    for (let i = 0; i < ENEMIES.splitter.children; i += 1) {
      const a = (i / ENEMIES.splitter.children) * Math.PI * 2 + e.t * 1.4;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * e.radius * 0.5, Math.sin(a) * e.radius * 0.5, 4.6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (e.type === 'boss') {
    ctx.rotate(e.t * 0.25);
    ctx.strokeStyle = COLORS.boss;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      ctx.fillStyle = COLORS.boss;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (e.radius + 12), Math.sin(a) * (e.radius + 12));
      ctx.lineTo(Math.cos(a + 0.22) * (e.radius - 4), Math.sin(a + 0.22) * (e.radius - 4));
      ctx.lineTo(Math.cos(a - 0.22) * (e.radius - 4), Math.sin(a - 0.22) * (e.radius - 4));
      ctx.closePath();
      ctx.fill();
    }
    ctx.rotate(-e.t * 0.6);
    ctx.fillStyle = '#3d0a18';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    const corePulse = 0.75 + 0.25 * Math.sin(e.t * 5);
    ctx.fillStyle = COLORS.core;
    ctx.beginPath();
    ctx.arc(0, 0, 10 * corePulse + 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (e.flashT > 0) {
    ctx.globalAlpha = Math.min(1, e.flashT * 9);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (e.type !== 'boss' && e.hp < e.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(e.x - e.radius, e.y - e.radius - 9, e.radius * 2, 4);
    ctx.fillStyle = '#ff8fa3';
    ctx.fillRect(e.x - e.radius, e.y - e.radius - 9, e.radius * 2 * Math.max(0, e.hp / e.maxHp), 4);
  }
}

function drawCore(ctx, state, c) {
  const fade = c.t > 11 ? (Math.floor(state.time * 6) % 2 === 0 ? 0.35 : 0.9) : 1;
  const pulse = 1 + Math.sin(state.time * 5 + c.x) * 0.15;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(Math.PI / 4);
  ctx.globalAlpha = fade;
  ctx.fillStyle = COLORS.core;
  const s = 6 * pulse;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.fillStyle = COLORS.coreHot;
  ctx.fillRect(-s / 4, -s / 4, s / 2, s / 2);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawHud(ctx, state) {
  const p = state.player;
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.textDim;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText('SCORE', 22, 30);
  ctx.fillStyle = COLORS.text;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(String(state.score), 22, 62);
  ctx.fillStyle = COLORS.core;
  ctx.font = `600 17px ${FONT}`;
  ctx.fillText(`◆ ${state.coresCollected} cores`, 22, 90);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.textDim;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(state.wave % 5 === 0 ? 'BOSS WAVE' : 'WAVE', FIELD.width / 2, 30);
  ctx.fillStyle = COLORS.text;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(String(state.wave), FIELD.width / 2, 62);
  const boss = state.enemies.find((e) => e.type === 'boss');
  if (boss) {
    const w = 420;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(FIELD.width / 2 - w / 2, 72, w, 10);
    ctx.fillStyle = COLORS.boss;
    ctx.fillRect(FIELD.width / 2 - w / 2, 72, w * Math.max(0, boss.hp / boss.maxHp), 10);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `600 11px ${FONT}`;
    ctx.fillText('EMBER DREADNOUGHT', FIELD.width / 2, 96);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.textDim;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText('BEST', FIELD.width - 22, 30);
  ctx.fillStyle = COLORS.text;
  ctx.font = `700 30px ${FONT}`;
  ctx.fillText(String(Math.max(state.best, state.score)), FIELD.width - 22, 62);

  const barW = 230;
  const barX = 22;
  const barY = FIELD.height - 34;
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.textDim;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText('HULL', barX, barY - 8);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(barX, barY, barW, 13);
  const hullFrac = Math.max(0, p.hull / p.maxHull);
  ctx.fillStyle = hullFrac < 0.3 && Math.floor(state.time * 5) % 2 === 0 ? COLORS.bad : '#ffb35c';
  ctx.fillRect(barX, barY, barW * hullFrac, 13);
  if (p.maxShield > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY - 22, barW, 6);
    ctx.fillStyle = COLORS.canopy;
    ctx.fillRect(barX, barY - 22, barW * Math.max(0, p.shield / p.maxShield), 6);
  }
  ctx.fillStyle = COLORS.textDim;
  ctx.font = `600 12px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('P pause · M mute', FIELD.width - 22, FIELD.height - 21);
  ctx.textAlign = 'left';

  if (state.bannerT > 0) {
    ctx.globalAlpha = Math.min(1, state.bannerT / 0.6);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = `800 44px ${FONT}`;
    ctx.fillText(state.banner, FIELD.width / 2, 190);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function drawTitle(ctx, state) {
  ctx.fillStyle = 'rgba(4, 6, 20, 0.45)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = COLORS.mote;
  ctx.shadowBlur = 34;
  ctx.fillStyle = '#ffb35c';
  ctx.font = `800 92px ${FONT}`;
  ctx.fillText('EMBERDRIFT', FIELD.width / 2, 218);
  ctx.restore();
  ctx.fillStyle = COLORS.text;
  ctx.font = `600 21px ${FONT}`;
  ctx.fillText('Salvage the ember field. Outlive the swarm.', FIELD.width / 2, 262);
  const bob = Math.sin(state.time * 1.3) * 8;
  drawSkiff(ctx, FIELD.width / 2, 348 + bob, -Math.PI / 2 + Math.sin(state.time * 0.7) * 0.14, 2.1, 0.7);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = `500 18px ${FONT}`;
  ctx.fillText('WASD / arrows — drift      Mouse — aim      Hold click / Space — fire', FIELD.width / 2, 452);
  ctx.fillText('Down drones, harvest their ember cores, and spend each wave break on an upgrade.', FIELD.width / 2, 484);
  ctx.fillText('A dreadnought rises every fifth wave. Your hull is all you have.', FIELD.width / 2, 516);
  if (Math.floor(state.time * 1.6) % 2 === 0) {
    ctx.fillStyle = COLORS.core;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', FIELD.width / 2, 586);
  }
  if (state.best > 0) {
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText(`Best score so far: ${state.best}`, FIELD.width / 2, 632);
  }
  ctx.textAlign = 'left';
}

function drawUpgrade(ctx, state) {
  ctx.fillStyle = 'rgba(4, 6, 20, 0.62)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.good;
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(`WAVE ${state.wave} CLEARED`, FIELD.width / 2, 150);
  ctx.fillStyle = COLORS.text;
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText('Choose one upgrade for your skiff', FIELD.width / 2, 188);
  const rects = upgradeCardRects();
  state.choices.forEach((choice, i) => {
    const r = rects[i];
    const hover = state.mouse.x >= r.x && state.mouse.x <= r.x + r.w && state.mouse.y >= r.y && state.mouse.y <= r.y + r.h;
    panel(ctx, r.x, r.y, r.w, r.h);
    if (hover) {
      ctx.strokeStyle = COLORS.core;
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
    ctx.fillStyle = COLORS.core;
    ctx.font = `400 64px ${FONT}`;
    ctx.fillText(choice.glyph, r.x + r.w / 2, r.y + 92);
    ctx.fillStyle = COLORS.text;
    ctx.font = `700 25px ${FONT}`;
    ctx.fillText(choice.name, r.x + r.w / 2, r.y + 142);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `500 17px ${FONT}`;
    const lines = wrap(ctx, choice.blurb, r.w - 48);
    lines.forEach((line, j) => ctx.fillText(line, r.x + r.w / 2, r.y + 182 + j * 24));
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText(`[ ${i + 1} ]`, r.x + r.w / 2, r.y + r.h - 22);
  });
  ctx.textAlign = 'left';
}

function drawPause(ctx) {
  ctx.fillStyle = 'rgba(4, 6, 20, 0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = `800 48px ${FONT}`;
  ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 10);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = `500 19px ${FONT}`;
  ctx.fillText('Press P or Esc to drift on', FIELD.width / 2, FIELD.height / 2 + 30);
  ctx.textAlign = 'left';
}

function drawOver(ctx, state) {
  ctx.fillStyle = 'rgba(10, 4, 10, 0.66)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.bad;
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText('SKIFF DOWN', FIELD.width / 2, 232);
  ctx.fillStyle = COLORS.text;
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(`Score ${state.score}`, FIELD.width / 2, 316);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = `500 21px ${FONT}`;
  ctx.fillText(`Reached wave ${state.wave} · harvested ${state.coresCollected} ember cores`, FIELD.width / 2, 362);
  ctx.fillText(`Best score: ${Math.max(state.best, state.score)}`, FIELD.width / 2, 396);
  if (Math.floor(state.time * 1.6) % 2 === 0) {
    ctx.fillStyle = COLORS.core;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', FIELD.width / 2, 486);
  }
  ctx.textAlign = 'left';
}

/** Draw the whole game for the current state. */
export function drawGame(ctx, state) {
  ctx.save();
  if (state.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  drawBackground(ctx, state);
  if (state.screen !== SCREEN_TITLE) {
    for (const c of state.cores) drawCore(ctx, state, c);
    for (const b of state.enemyBullets) {
      ctx.fillStyle = 'rgba(255, 93, 122, 0.22)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius + 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.enemyBullet;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of state.bullets) {
      ctx.fillStyle = 'rgba(255, 201, 107, 0.25)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius + 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.bullet;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const e of state.enemies) drawEnemy(ctx, state, e);
    drawPlayer(ctx, state);
  }
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const t of state.texts) {
    ctx.globalAlpha = Math.min(1, t.life);
    ctx.fillStyle = t.color;
    ctx.font = `700 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.restore();

  if (state.flashT > 0) {
    ctx.fillStyle = `rgba(255, 45, 70, ${Math.min(0.32, state.flashT * 0.5)})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
  if (state.screen === SCREEN_TITLE) drawTitle(ctx, state);
  else {
    drawHud(ctx, state);
    if (state.screen === SCREEN_UPGRADE) drawUpgrade(ctx, state);
    else if (state.screen === SCREEN_PAUSE) drawPause(ctx);
    else if (state.screen === SCREEN_OVER) drawOver(ctx, state);
  }
}
