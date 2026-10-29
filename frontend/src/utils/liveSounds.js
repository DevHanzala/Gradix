/**
 * Short sounds for live sessions, synthesised with the Web Audio API (no audio files
 * to download). Played only when the session has sounds on; browsers allow audio
 * after the user's first tap (joining or answering counts).
 */
let context = null;

const audio = () => {
  try {
    context ??= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === "suspended") context.resume();
    return context;
  } catch {
    return null;
  }
};

const tone = (frequency, start, duration, { type = "sine", gain = 0.08 } = {}) => {
  const ctx = audio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const volume = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  volume.gain.setValueAtTime(gain, ctx.currentTime + start);
  volume.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(volume).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration);
};

export const liveSounds = {
  correct: () => {
    tone(660, 0, 0.12);
    tone(880, 0.12, 0.2);
  },
  wrong: () => tone(220, 0, 0.3, { type: "triangle" }),
  tick: () => tone(1000, 0, 0.05, { gain: 0.04 }),
  fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.3)),
};
