// The upgrade pool offered between waves. Each entry knows its name, its
// pitch, the glyph drawn on its card, and how it bends the skiff's stats.
// Choices are drawn three at a time, distinct, and every one of them is
// worth taking — the build you end up with is the strategy of the run.

/** All upgrades, in the order the cards prefer to appear. */
export const UPGRADES = [
  {
    id: 'damage', name: 'Heavy Rounds', glyph: '◆',
    blurb: '+25% bullet damage. Wrecks melt faster.',
    apply(p) { p.damageMul *= 1.25; },
  },
  {
    id: 'rate', name: 'Rapid Cycler', glyph: '»',
    blurb: '+20% fire rate. More lead in the air.',
    apply(p) { p.fireRateMul *= 1.2; },
  },
  {
    id: 'split', name: 'Split Cannon', glyph: '✦',
    blurb: '+1 projectile per shot, fanned wide.',
    apply(p) { p.projectiles += 1; },
  },
  {
    id: 'speed', name: 'Ion Thrusters', glyph: '▲',
    blurb: '+12% top speed. Outrun the swarm.',
    apply(p) { p.speedMul *= 1.12; },
  },
  {
    id: 'hull', name: 'Reinforced Hull', glyph: '⬢',
    blurb: '+25 max hull, and patch 25 back now.',
    apply(p) { p.maxHull += 25; p.hull = Math.min(p.maxHull, p.hull + 25); },
  },
  {
    id: 'shield', name: 'Aegis Plating', glyph: '◎',
    blurb: '+20 shield that recharges out of fire.',
    apply(p) { p.maxShield += 20; p.shield += 20; },
  },
  {
    id: 'magnet', name: 'Tractor Magnet', glyph: '⊕',
    blurb: '+60% core pickup pull. Vacuum the field.',
    apply(p) { p.magnetMul *= 1.6; },
  },
  {
    id: 'barrel', name: 'Long Barrel', glyph: '➤',
    blurb: '+30% bullet speed and +10% damage.',
    apply(p) { p.bulletSpeedMul *= 1.3; p.damageMul *= 1.1; },
  },
  {
    id: 'nanites', name: 'Repair Nanites', glyph: '✚',
    blurb: 'Regenerate +0.9 hull every second.',
    apply(p) { p.regen += 0.9; },
  },
  {
    id: 'repair', name: 'Field Repair', glyph: '✚',
    blurb: 'Patch 45 hull back right now.',
    apply(p) { p.hull = Math.min(p.maxHull, p.hull + 45); },
  },
];

/** Draw three distinct upgrades the skiff can still use. */
export function rollChoices(state) {
  const pool = UPGRADES.filter((u) => u.id !== 'split' || state.player.projectiles < 5);
  const choices = [];
  const copy = pool.slice();
  while (choices.length < 3 && copy.length > 0) {
    const index = Math.floor(state.rng() * copy.length);
    choices.push(copy.splice(index, 1)[0]);
  }
  return choices;
}

/** Apply a chosen upgrade to the player and announce it. */
export function applyUpgrade(state, upgrade) {
  upgrade.apply(state.player);
  state.events.push('upgrade');
}
