// Synthesised UI sounds (no audio files). Muted until the user turns sound on.
let ctx: AudioContext | null = null;
let muted = true;
const subs = new Set<() => void>();

const audio = () => (ctx ??= new AudioContext());

export const sound = {
  isMuted: () => muted,
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => void subs.delete(fn);
  },
  toggle() {
    muted = !muted;
    if (!muted) audio().resume();
    subs.forEach((f) => f());
  },
  beep(freq = 880, dur = 0.07, vol = 0.04) {
    if (muted) return;
    const a = audio();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur);
  },
  // Short wing buzz: sawtooth through a band-pass with a fast tremolo.
  buzz(vol = 0.035) {
    if (muted) return;
    const a = audio(), t = a.currentTime;
    const o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
    const lfo = a.createOscillator(), lg = a.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(180 + Math.random() * 40, t);
    o.frequency.linearRampToValueAtTime(240, t + 0.18);
    f.type = "bandpass";
    f.frequency.value = 1100;
    f.Q.value = 2;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    lfo.frequency.value = 42;
    lg.gain.value = vol * 0.8;
    lfo.connect(lg).connect(g.gain);
    o.connect(f).connect(g).connect(a.destination);
    o.start(t); lfo.start(t);
    o.stop(t + 0.23); lfo.stop(t + 0.23);
  },
  // Soft "drop" for honey pulses.
  pulse() {
    if (muted) return;
    const a = audio(), t = a.currentTime;
    const o = a.createOscillator(), g = a.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.35);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.46);
  },
  blast() {
    if (muted) return;
    const a = audio();
    const len = a.sampleRate * 0.6;
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = a.createBufferSource();
    const f = a.createBiquadFilter();
    const g = a.createGain();
    src.buffer = buf;
    f.type = "lowpass";
    f.frequency.setValueAtTime(3000, a.currentTime);
    f.frequency.exponentialRampToValueAtTime(120, a.currentTime + 0.5);
    g.gain.value = 0.25;
    src.connect(f).connect(g).connect(a.destination);
    src.start();
    sound.beep(90, 0.5, 0.15);
  },
};
