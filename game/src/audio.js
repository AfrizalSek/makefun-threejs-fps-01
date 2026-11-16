// Procedural WebAudio: no audio files. The context is created on the first
// user gesture (Play click) and stays suspended until then, so nothing plays
// before the player opts in. One master gain; everything else is oscillators
// and filtered noise.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let volume = 0.7;
  let ambientOn = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function noise(dur, filterFreq, gainValue, type = 'lowpass') {
    if (!ensure()) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start();
    src.stop(ctx.currentTime + dur + 0.02);
  }

  function tone(freq, dur, gainValue, type = 'sine', when = 0) {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + when;
    gain.gain.setValueAtTime(gainValue, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const SHOT_FILTER = { pistol: 1800, smg: 2200, rifle: 1500, sniper: 900 };
  const SHOT_DUR = { pistol: 0.09, smg: 0.07, rifle: 0.1, sniper: 0.18 };

  return {
    get volume() {
      return volume;
    },
    unlock() {
      if (ensure()) this.startAmbient();
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      if (master) master.gain.value = volume;
    },
    shot(weapon) {
      noise(SHOT_DUR[weapon] ?? 0.1, SHOT_FILTER[weapon] ?? 1500, weapon === 'sniper' ? 0.5 : 0.32);
      tone(weapon === 'sniper' ? 90 : 160, 0.06, 0.18, 'square');
    },
    reload() {
      tone(1200, 0.03, 0.12, 'square');
      tone(900, 0.03, 0.12, 'square', 0.12);
    },
    hit() {
      tone(2000, 0.05, 0.15);
    },
    kill() {
      tone(660, 0.08, 0.2);
      tone(880, 0.1, 0.2, 'sine', 0.09);
    },
    plantBeep() {
      tone(1000, 0.07, 0.16);
    },
    defuseBeep() {
      tone(1250, 0.07, 0.16);
    },
    explosion() {
      noise(0.9, 300, 0.6);
      tone(55, 0.7, 0.5);
    },
    step() {
      noise(0.04, 900, 0.05);
    },
    roundWin() {
      tone(523, 0.12, 0.2);
      tone(659, 0.12, 0.2, 'sine', 0.12);
      tone(784, 0.2, 0.2, 'sine', 0.24);
    },
    startAmbient() {
      if (ambientOn || !ensure()) return;
      ambientOn = true;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      const gain = ctx.createGain();
      gain.gain.value = 0.02;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.01;
      lfo.connect(lfoGain).connect(gain.gain);
      src.connect(filter).connect(gain).connect(master);
      src.start();
      lfo.start();
    },
  };
}
