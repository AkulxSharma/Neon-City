// Procedural engine audio, ported from the original's initAudio()/tick() audio
// block — same oscillator types, frequencies, and filter/gain constants. A
// plain module-level singleton (not React state): Web Audio nodes are
// inherently imperative and only ever need one instance for the whole page,
// same spirit as the original's single `audio` object.

interface AudioRig {
  ctx: AudioContext;
  gain: GainNode;
  osc: OscillatorNode;
  osc2: OscillatorNode;
  nitroGain: GainNode;
  nFilt: BiquadFilterNode;
}

let audio: AudioRig | null = null;
let muted = false;

/** Must be called from a real user gesture (click/keydown) — browsers block audio otherwise. */
export function initAudio() {
  if (audio) return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    const osc2 = ctx.createOscillator();
    osc2.type = "square";
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filt);
    osc2.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc2.start();

    // dedicated NITRO roar voice (bandpassed saw+square swell while boosting)
    const nOsc = ctx.createOscillator();
    nOsc.type = "sawtooth";
    nOsc.frequency.value = 72;
    const nOsc2 = ctx.createOscillator();
    nOsc2.type = "square";
    nOsc2.frequency.value = 46;
    const nFilt = ctx.createBiquadFilter();
    nFilt.type = "bandpass";
    nFilt.frequency.value = 260;
    nFilt.Q.value = 0.8;
    const nitroGain = ctx.createGain();
    nitroGain.gain.value = 0;
    nOsc.connect(nFilt);
    nOsc2.connect(nFilt);
    nFilt.connect(nitroGain);
    nitroGain.connect(ctx.destination);
    nOsc.start();
    nOsc2.start();

    audio = { ctx, gain, osc, osc2, nitroGain, nFilt };
    if (muted) ctx.suspend();
  } catch {
    // Web Audio unavailable — game stays fully playable without sound
  }
}

export function toggleMute() {
  muted = !muted;
  if (audio) {
    if (muted) audio.ctx.suspend();
    else audio.ctx.resume();
  }
  return muted;
}

export function isMuted() {
  return muted;
}

/** Restore mute state from a save — before initAudio() has necessarily run. */
export function setMuted(v: boolean) {
  muted = v;
  if (audio) {
    if (muted) audio.ctx.suspend();
    else audio.ctx.resume();
  }
}

/** Call every frame with the driving vehicle's speed and nitro state. */
export function updateEngineAudio(speedKmh: number, nitroActive: boolean) {
  if (!audio) return;
  const drv = speedKmh / 3.6; // back to m/s, matches the original's Math.abs(v.speed)
  const g = !muted ? clamp(0.02 + drv * 0.0008, 0, 0.06) : 0;
  audio.osc.frequency.setTargetAtTime(48 + drv * 2.4, audio.ctx.currentTime, 0.05);
  audio.osc2.frequency.setTargetAtTime(24 + drv * 1.2, audio.ctx.currentTime, 0.05);
  audio.gain.gain.setTargetAtTime(g, audio.ctx.currentTime, 0.08);

  if (nitroActive && !muted) {
    audio.nitroGain.gain.setTargetAtTime(0.13, audio.ctx.currentTime, 0.05);
    audio.nFilt.frequency.setTargetAtTime(220 + drv * 9, audio.ctx.currentTime, 0.05);
  } else {
    audio.nitroGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.08);
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
