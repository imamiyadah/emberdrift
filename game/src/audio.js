// Synthesized sound: every effect and the ambient music loop are built from
// oscillators and filtered noise in code — the game ships no audio files.
// The context is created lazily on the first user gesture, as browsers require.

let context = null;
let master = null;
let musicGain = null;
let musicTimer = null;
let chordIndex = 0;

/** Create (or resume) the audio context. Safe to call on every gesture. */
export function unlockAudio() {
  if (context) {
    if (context.state === 'suspended') context.resume();
    return;
  }
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  context = new AudioCtor();
  master = context.createGain();
  master.gain.value = 0.5;
  master.connect(context.destination);
  musicGain = context.createGain();
  musicGain.gain.value = 0.16;
  musicGain.connect(master);
}

/** True once the context exists and is running. */
function ready() {
  return context !== null && context.state === 'running';
}

/** One oscillator blip that slides from freqFrom to freqTo over its lifetime. */
function blip(freqFrom, freqTo, duration, type, volume, when = 0) {
  if (!ready()) return;
  const t0 = context.currentTime + when;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + duration);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** One burst of filtered white noise, the raw material of explosions. */
function noiseBurst(duration, volume, filterFreq, when = 0) {
  if (!ready()) return;
  const t0 = context.currentTime + when;
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFreq, t0);
  filter.frequency.exponentialRampToValueAtTime(60, t0 + duration);
  const gain = context.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(t0);
}

export const sfx = {
  shoot() { blip(880, 320, 0.09, 'square', 0.10); },
  enemyShoot() { blip(340, 180, 0.12, 'sawtooth', 0.05); },
  hit() { blip(220, 140, 0.05, 'square', 0.08); },
  explosion() { noiseBurst(0.32, 0.30, 900); blip(160, 40, 0.3, 'sine', 0.25); },
  bigExplosion() { noiseBurst(0.7, 0.45, 700); blip(120, 28, 0.65, 'sine', 0.4); noiseBurst(0.4, 0.2, 300, 0.08); },
  hurt() { blip(200, 60, 0.22, 'sawtooth', 0.28); noiseBurst(0.15, 0.15, 1200); },
  shieldHit() { blip(620, 900, 0.08, 'sine', 0.14); },
  pickup() { blip(660, 660, 0.06, 'sine', 0.12); blip(990, 990, 0.09, 'sine', 0.12, 0.05); },
  upgrade() { blip(523, 523, 0.1, 'triangle', 0.16); blip(659, 659, 0.1, 'triangle', 0.16, 0.08); blip(784, 784, 0.16, 'triangle', 0.16, 0.16); },
  ui() { blip(440, 520, 0.06, 'sine', 0.10); },
  waveClear() { blip(392, 392, 0.1, 'triangle', 0.14); blip(523, 523, 0.1, 'triangle', 0.14, 0.09); blip(659, 659, 0.2, 'triangle', 0.14, 0.18); },
  gameOver() { blip(392, 392, 0.25, 'triangle', 0.2); blip(311, 311, 0.25, 'triangle', 0.2, 0.22); blip(233, 110, 0.6, 'triangle', 0.22, 0.44); },
  bossWarn() { blip(98, 98, 0.3, 'sawtooth', 0.2); blip(98, 98, 0.3, 'sawtooth', 0.2, 0.38); },
};

/** A slow D-minor pad progression with a soft bass pulse, scheduled ahead. */
const CHORDS = [
  { bass: 73.42, pad: [146.83, 174.61, 220.0] },   // Dm
  { bass: 58.27, pad: [116.54, 146.83, 174.61] },  // Bb
  { bass: 87.31, pad: [174.61, 220.0, 261.63] },   // F
  { bass: 65.41, pad: [130.81, 164.81, 196.0] },   // C
];
const CHORD_SECONDS = 3.2;

function scheduleChord() {
  if (!ready()) return;
  const chord = CHORDS[chordIndex % CHORDS.length];
  chordIndex += 1;
  const t0 = context.currentTime + 0.05;
  for (const freq of chord.pad) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.05, t0 + 0.8);
    gain.gain.setValueAtTime(0.05, t0 + CHORD_SECONDS - 0.8);
    gain.gain.linearRampToValueAtTime(0.0001, t0 + CHORD_SECONDS);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(musicGain);
    osc.start(t0);
    osc.stop(t0 + CHORD_SECONDS + 0.02);
  }
  for (let beat = 0; beat < 4; beat += 1) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    const bt = t0 + beat * (CHORD_SECONDS / 4);
    osc.type = 'sine';
    osc.frequency.value = chord.bass;
    gain.gain.setValueAtTime(0.0001, bt);
    gain.gain.linearRampToValueAtTime(0.16, bt + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, bt + 0.5);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(bt);
    osc.stop(bt + 0.55);
  }
}

/** Start the ambient loop (idempotent); stop it with stopMusic(). */
export function startMusic() {
  if (!ready() || musicTimer !== null) return;
  scheduleChord();
  musicTimer = window.setInterval(scheduleChord, CHORD_SECONDS * 1000);
}

export function stopMusic() {
  if (musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
}
