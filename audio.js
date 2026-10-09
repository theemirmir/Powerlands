(() => {
  'use strict';

  let ctx = null, master = null, musicBus = null, sfxBus = null, sfxRoot = null, verb = null, noiseBuf = null;
  let muted = localStorage.getItem('powerland-muted') === '1';
  let wanted = null, cur = null;
  let outNode = null, recDest = null;
  const MASTER_VOL = 1;
  const rnd = Math.random;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function impulse(sec) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  function makeBus(vol, send) {
    const g = ctx.createGain();
    g.gain.value = vol;
    g.connect(master);
    const s = ctx.createGain();
    s.gain.value = send;
    g.connect(s).connect(verb);
    return g;
  }

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOL;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    master.connect(comp).connect(ctx.destination);
    outNode = comp;
    verb = ctx.createConvolver();
    verb.buffer = impulse(2.6);
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.4;
    verb.connect(verbOut).connect(master);
    musicBus = makeBus(0.42, 0.3);
    sfxRoot = sfxBus = makeBus(2.2, 0.2);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = rnd() * 2 - 1;
    const w = wanted;
    wanted = null;
    setMusic(w);
  }
  ['keydown', 'mousedown', 'pointerdown', 'touchstart'].forEach((ev) => window.addEventListener(ev, init, true));

  // ---------- Synth ----------
  const INST = {
    square: { w: ['square'], a: 0.005, r: 0.06 },
    tri: { w: ['triangle'], a: 0.005, r: 0.08 },
    sine: { w: ['sine'], a: 0.01, r: 0.12 },
    saw: { w: ['sawtooth'], lp: 2200, a: 0.005, r: 0.06 },
    bass: { w: ['sawtooth', 'square'], d: [0, -1200], g: [1, 0.6], lp: 900, a: 0.005, r: 0.05 },
    pluck: { w: ['sawtooth'], lpEnv: [4000, 300, 0.18], perc: 0.3 },
    marimba: { w: ['sine', 'sine'], m: [1, 4], g: [1, 0.25], perc: 0.28 },
    bell: { w: ['sine', 'sine', 'sine'], m: [1, 2.76, 5.4], g: [1, 0.4, 0.15], perc: 1.4 },
    harp: { w: ['triangle', 'sine'], m: [1, 2], g: [1, 0.3], perc: 0.7 },
    flute: { w: ['sine', 'triangle'], m: [1, 2], g: [1, 0.15], a: 0.06, r: 0.15, vib: [5, 10] },
    brass: { w: ['sawtooth', 'sawtooth'], d: [-7, 7], lp: 1500, a: 0.04, r: 0.12 },
    strings: { w: ['sawtooth', 'sawtooth'], d: [-12, 12], lp: 1300, a: 0.3, r: 0.5, vib: [5, 6] },
    organ: { w: ['sine', 'sine', 'sine', 'square'], m: [1, 2, 4, 1], g: [1, 0.6, 0.3, 0.08], a: 0.03, r: 0.25 },
    choir: { w: ['sawtooth', 'sawtooth', 'sawtooth'], d: [-14, 0, 14], bp: [1000, 1.2], lp: 2600, a: 0.45, r: 0.7, vib: [4.5, 12] },
    supersaw: { w: ['sawtooth', 'sawtooth', 'sawtooth', 'square'], d: [-18, 0, 18, -1200], g: [1, 1, 1, 0.5], lp: 4200, a: 0.01, r: 0.15 },
    horn: { w: ['sawtooth', 'sawtooth'], d: [-5, 5], lp: 1100, a: 0.06, r: 0.2 },
    stacc: { w: ['sawtooth', 'sawtooth'], d: [-8, 8], lp: 2800, a: 0.005, r: 0.04 },
  };

  function voice(name, midi, t, dur, vol, out) {
    const p = INST[name] || INST.square;
    const f = mtof(midi);
    const g = ctx.createGain();
    g.connect(out);
    let dest = g;
    if (p.lp || p.lpEnv) {
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      if (p.lpEnv) {
        fl.frequency.setValueAtTime(p.lpEnv[0], t);
        fl.frequency.exponentialRampToValueAtTime(p.lpEnv[1], t + p.lpEnv[2]);
      } else {
        fl.frequency.value = p.lp;
      }
      fl.connect(dest);
      dest = fl;
    }
    if (p.bp) {
      const b = ctx.createBiquadFilter();
      b.type = 'bandpass';
      b.frequency.value = p.bp[0];
      b.Q.value = p.bp[1];
      b.connect(dest);
      dest = b;
    }
    const hold = Math.max(p.a || 0, dur);
    const end = p.perc ? t + p.perc : t + hold + p.r;
    let lfoGain = null;
    if (p.vib) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = p.vib[0];
      lfoGain = ctx.createGain();
      lfoGain.gain.value = p.vib[1];
      lfo.connect(lfoGain);
      lfo.start(t);
      lfo.stop(end + 0.05);
    }
    p.w.forEach((w, i) => {
      const o = ctx.createOscillator();
      o.type = w;
      o.frequency.value = f * (p.m ? p.m[i] : 1);
      if (p.d) o.detune.value = p.d[i];
      if (lfoGain) lfoGain.connect(o.detune);
      const og = ctx.createGain();
      og.gain.value = (p.g ? p.g[i] : 1) / p.w.length;
      o.connect(og).connect(dest);
      o.start(t);
      o.stop(end + 0.05);
    });
    const gg = g.gain;
    gg.setValueAtTime(0.0001, t);
    if (p.perc) {
      gg.exponentialRampToValueAtTime(vol, t + 0.005);
      gg.exponentialRampToValueAtTime(0.0001, end);
    } else {
      gg.linearRampToValueAtTime(vol, t + p.a);
      gg.setValueAtTime(vol, t + hold);
      gg.exponentialRampToValueAtTime(0.0001, end);
    }
  }

  function noise(t, dur, vol, type, f0, f1, out, q = 1, atk = 0) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    if (atk) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + atk);
    } else {
      g.gain.setValueAtTime(vol, t);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(out);
    s.start(t, rnd() * 1.5);
    s.stop(t + dur + 0.05);
  }

  function sweep(type, f0, f1, t, dur, vol, out, atk = 0) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    if (atk) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + atk);
    } else {
      g.gain.setValueAtTime(vol, t);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // ---------- Drums ----------
  function kick(t, v, out) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.35);
  }
  function snare(t, v, out) {
    noise(t, 0.16, v, 'highpass', 1500, 1500, out);
    sweep('triangle', 220, 120, t, 0.09, v * 0.6, out);
  }
  const hat = (t, v, out) => noise(t, 0.04, v, 'highpass', 8000, 8000, out);
  const ohat = (t, v, out) => noise(t, 0.22, v, 'highpass', 7000, 7000, out);
  const tom = (t, v, out) => sweep('sine', 210, 115, t, 0.22, v, out);
  const crash = (t, v, out) => noise(t, 1.4, v, 'highpass', 3500, 5000, out);
  function timp(t, v, out, f = 72) {
    sweep('sine', f, f * 0.8, t, 1.6, v, out);
    noise(t, 0.25, v * 0.4, 'lowpass', 400, 150, out);
  }
  function taiko(t, v, out) {
    sweep('sine', 110, 52, t, 0.5, v, out);
    noise(t, 0.15, v * 0.5, 'lowpass', 700, 200, out);
  }
  const DRUM = { k: kick, s: snare, h: hat, o: ohat, t: tom, c: crash, p: timp, T: taiko };
  const DRUM_VOL = { k: 0.5, s: 0.22, h: 0.05, o: 0.07, t: 0.25, c: 0.12, p: 0.45, T: 0.5 };

  // ---------- Music ----------
  const QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus: [0, 5, 7],
    7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], 5: [0, 7],
  };
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function parseChord(name) {
    const m = /^([A-G])([#b]?)(.*)$/.exec(name);
    const r = (SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
    return { r, iv: QUAL[m[3]] || QUAL[''] };
  }

  const CRASH8 = ['x...............', '', '', '', 'x...............', '', '', ''];
  const ROLL8 = ['', '', '', '', '', '', '', 'x.x.x.x.xxxxxxxx'];
  const TRACKS = {
    grasslands: {
      bpm: 120, prog: 'G D Em C G D C D',
      parts: [
        { kind: 'bass', inst: 'tri', pat: 'x...x.o.x...x.o.', vol: 0.3 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.045 },
        { kind: 'tone', inst: 'pluck', pat: '0.2.1.2.3.2.1.2.', vol: 0.05 },
        {
          kind: 'tone', inst: 'square', vol: 0.055,
          pat: ['2-1-0---1---2---', '3---2---1-------', '2-1-0---1---2-4-', '3---------------', '4---3---2---3---', '4---5---4-------', '3---2---1---2---', '1---------------'],
        },
      ],
      drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', c: ['x...............', '', '', '', '', '', '', ''] },
      dv: { h: 0.03 },
    },
    jungle: {
      bpm: 108, prog: 'Dm Dm C Dm Bb C Dm Dm',
      parts: [
        { kind: 'bass', inst: 'tri', pat: 'x..x..x...x..x..', vol: 0.32 },
        { kind: 'tone', inst: 'marimba', pat: '0.2.3.2.1.2.4.2.', vol: 0.2 },
        {
          kind: 'tone', inst: 'flute', vol: 0.09,
          pat: ['3-4-5-4.3.......', '2-------1---2---', '3-4-5-6.5.......', '4---------------', '5---4---3---2---', '3---4---5-------', '4-3-2---1---2---', '0---------------'],
        },
      ],
      drums: { k: 'x.....x...x.....', T: 'x.......x.......', t: '..x.x...x.x..x.x', h: 'xx.xxx.xxx.xxx.x' },
      dv: { h: 0.025, t: 0.18, T: 0.35 },
    },
    treehouse: {
      bpm: 90, prog: 'F Dm Bb C',
      parts: [
        { kind: 'bass', inst: 'tri', pat: 'x.......x.......', vol: 0.28 },
        { kind: 'tone', inst: 'harp', pat: '0.1.2.1.3.1.2.1.', vol: 0.08 },
        { kind: 'tone', inst: 'flute', vol: 0.06, pat: ['2---1---0-------', '1---2---3-------', '4---3---2---1---', '2---------------'] },
      ],
      drums: { h: '..x...x...x...x.' },
      dv: { h: 0.025 },
    },
    mountains: {
      bpm: 92, prog: 'Am F C G Am F G E',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x-------x---x---', vol: 0.3 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.055 },
        { kind: 'pad', inst: 'choir', pat: ['', '', '', '', 'x---------------', 'x---------------', 'x---------------', 'x---------------'], vol: 0.035 },
        { kind: 'tone', inst: 'stacc', pat: '0.0.1.0.2.0.1.0.', vol: 0.035 },
        {
          kind: 'tone', inst: 'horn', vol: 0.1,
          pat: ['2-------3---4---', '5-----------4-3-', '4-------3---2---', '3---------------', '5-------6---5---', '4-------3-------', '4-----5-6---5---', '4---------------'],
        },
      ],
      drums: { k: 'x.......x.x.....', s: '........x.......', T: 'x.......x.......', p: ['x...............', '', '', '', 'x...............', '', '', 'x.x.x.x.xxxxxxxx'], c: CRASH8 },
      dv: { T: 0.35 },
    },
    skyrun: {
      bpm: 150, prog: 'Em C G D',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.o.x.o.x.o.x.o.', vol: 0.28 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.04 },
        { kind: 'tone', inst: 'square', pat: '0123012301230123', oct: 1, vol: 0.022, len: 0.5 },
        { kind: 'tone', inst: 'square', vol: 0.065, pat: ['4-3-4---5---4---', '3-----2-----1---', '4-3-4---5---6---', '5---------------'] },
      ],
      drums: { k: 'x...x...x...x...', s: '....x.......x...', h: '.x.x.x.x.x.x.x.x', c: ['x...............', '', '', ''] },
    },
    skylands: {
      bpm: 80, prog: 'Fmaj7 G Am7 G',
      parts: [
        { kind: 'bass', inst: 'sine', pat: 'x-------x-------', vol: 0.3 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.05 },
        { kind: 'tone', inst: 'bell', pat: '0..1..2..3..4..2', oct: 1, vol: 0.06 },
        { kind: 'tone', inst: 'flute', oct: 1, vol: 0.06, pat: ['3-------------2-', '3-------1-------', '2-------3---4---', '5---------------'] },
      ],
      drums: { h: '....x.......x...' },
      dv: { h: 0.03 },
    },
    cloud2: {
      bpm: 126, prog: 'Bm G D A Bm G Em F#',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.xx.xx.x.xx.xo.', vol: 0.26 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.04 },
        { kind: 'tone', inst: 'pluck', pat: '0.1.2.1.3.1.2.1.', oct: 1, vol: 0.055 },
        {
          kind: 'tone', inst: 'square', oct: 1, vol: 0.05,
          pat: ['2.2.3-2-1-0-----', '1---2---3-------', '2.2.3-2-4---3---', '2-------1-------', '4---3---2---1---', '2---3---4-------', '3---2---1---0---', '1---------------'],
        },
      ],
      drums: { k: 'x.....x.x.......', s: '....x.......x..x', h: 'x.x.x.x.x.x.x.x.', c: CRASH8 },
    },
    arena: {
      bpm: 110, prog: 'Em Em C B',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.x.x.x.x.x.x.x.', vol: 0.22, len: 0.5 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.05 },
        { kind: 'tone', inst: 'stacc', pat: '0.0.0.0.1.1.1.1.', vol: 0.035 },
      ],
      drums: { k: 'x..x............', T: 'x.......x.......', p: ['', '', '', 'x.x.x.x.xxxxxxxx'] },
      dv: { k: 0.4, T: 0.35 },
    },
    stairs: {
      bpm: 70, prog: 'Cm Ab Eb Bb',
      parts: [
        { kind: 'bass', inst: 'organ', pat: 'x---------------', vol: 0.2 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.05 },
        { kind: 'tone', inst: 'bell', pat: '0...1...2...3...', oct: 1, vol: 0.045 },
      ],
      drums: { p: 'x.......x.......' },
      dv: { p: 0.25 },
    },
    holy: {
      bpm: 60, prog: 'E A C#m B',
      parts: [
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.08 },
        { kind: 'pad', inst: 'organ', pat: 'x---------------', vol: 0.04 },
        { kind: 'tone', inst: 'bell', pat: '0..2..4..3..1..2', oct: 1, vol: 0.06 },
      ],
      drums: { p: ['x...............', '........x.......'] },
    },
    battle_redKid: {
      bpm: 156, prog: 'Am F G Am Am F G E',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.x.o.x.x.x.o.x.', vol: 0.3 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.045 },
        { kind: 'pad', inst: 'brass', pat: 'x.....x.....x...', vol: 0.03, len: 0.5 },
        { kind: 'tone', inst: 'stacc', pat: '0.1.2.1.0.1.2.1.', vol: 0.03 },
        {
          kind: 'tone', inst: 'square', vol: 0.06,
          pat: ['2.3.4---2.3.4---', '5.4.3.2.3-------', '3.4.5---3.4.5---', '6.5.4.3.4---4---', '4-------5---6---', '5-------4---3---', '4---5---6---7---', '6---------------'],
        },
      ],
      drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', T: ['', '', '', 'x.......x.x.x.x.'], c: CRASH8, p: ROLL8 },
      dv: { h: 0.03 },
    },
    battle_monkey: {
      bpm: 164, prog: 'Gm Gm Eb F Gm Gm Eb D',
      parts: [
        { kind: 'bass', inst: 'tri', pat: 'x..x..x...x.x...', vol: 0.36 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.03 },
        { kind: 'pad', inst: 'brass', pat: 'x.....x.....x...', vol: 0.03, len: 0.5 },
        {
          kind: 'tone', inst: 'marimba', vol: 0.26,
          pat: ['4.5.4.2.3-2-----', '4.5.6.5.4-------', '4.5.4.2.3-2-0---', '1---2---3-------', '4.4.5.4.3.3.2.2.', '3.3.4.3.2-------', '4.5.6.5.4.3.2.1.', '2---------------'],
        },
      ],
      drums: { k: 'x.....x...x.....', s: '....x.......x...', t: 'x.xx.x.xx.x.x.xx', h: 'xxxxxxxxxxxxxxxx', T: 'x.......x.......', c: CRASH8, p: ROLL8 },
      dv: { t: 0.16, h: 0.025, T: 0.4 },
    },
    battle_angel: {
      bpm: 144, prog: 'Dm Bb Gm A Dm Bb C A',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.....x.x.....x.', vol: 0.28 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.06 },
        { kind: 'tone', inst: 'harp', pat: '0123432101234321', vol: 0.07 },
        {
          kind: 'tone', inst: 'brass', vol: 0.09,
          pat: ['3-----4-5-------', '4---3---2-------', '2-----3-4-------', '3---------------', '5-----4-3-------', '4---5---6-------', '5---4---3---2---', '3---------------'],
        },
      ],
      drums: { k: 'x.......x..x....', s: '....x.......x...', h: '..x...x...x...x.', T: 'x.......x.......', c: CRASH8, p: ROLL8 },
      dv: { T: 0.4 },
    },
    battle_skyBird: {
      bpm: 176, prog: 'Em C D B Em C Am B',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'xoxoxoxoxoxoxoxo', vol: 0.24, len: 0.7 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.05 },
        { kind: 'tone', inst: 'stacc', pat: '0123012301230123', vol: 0.028 },
        {
          kind: 'tone', inst: 'square', vol: 0.06,
          pat: ['4-4-5-6---5-4---', '3-------2-------', '4-4-5-6---7-6---', '5-------4---3---', '6---5---4---3---', '4---5---6-------', '4---3---2---1---', '2---------------'],
        },
        {
          kind: 'tone', inst: 'horn', oct: -1, vol: 0.06,
          pat: ['4-4-5-6---5-4---', '3-------2-------', '4-4-5-6---7-6---', '5-------4---3---', '6---5---4---3---', '4---5---6-------', '4---3---2---1---', '2---------------'],
        },
      ],
      drums: { k: 'x.x...x.x.x...x.', s: '....x.......x.x.', h: 'x.x.x.x.x.x.x.x.', T: 'x.......x.......', c: CRASH8, p: ROLL8 },
      dv: { T: 0.4 },
    },
    battle_knight: {
      bpm: 152, prog: 'Em C Am B Em C D B',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.xox.xox.xox.xo', vol: 0.27, len: 0.7 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.05 },
        { kind: 'pad', inst: 'brass', pat: 'x..x..x.x..x..x.', vol: 0.03, len: 0.4 },
        { kind: 'tone', inst: 'stacc', pat: '0.1.2.0.1.2.0.1.', vol: 0.032 },
        {
          kind: 'tone', inst: 'horn', vol: 0.11,
          pat: ['2---3-4-5-------', '4---3---2-------', '2---3-4-5---6---', '5---------------', '6---5---4---5---', '4---3---2-------', '3---4---5---6---', '5---------------'],
        },
      ],
      drums: { k: 'x...x...x...x...', s: '..x...x.x.x...xx', h: 'x.x.x.x.x.x.x.x.', T: 'x.......x.......', c: CRASH8, p: ROLL8 },
      dv: { s: 0.18, h: 0.025, T: 0.4 },
    },
    maze: {
      bpm: 96, prog: 'Am Am F E Dm Am E E',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x..x..x.x..x..x.', vol: 0.24 },
        { kind: 'pad', inst: 'organ', pat: 'x---------------', vol: 0.035 },
        { kind: 'tone', inst: 'harp', pat: '0.1.2.1.0.1.2.3.', vol: 0.06 },
        {
          kind: 'tone', inst: 'flute', vol: 0.06,
          pat: ['2-------1---0---', '1---------------', '2---3---4-------', '3---------------', '2---1---2---3---', '4-------3-------', '2---1---0---1---', '0---------------'],
        },
      ],
      drums: { k: 'x.......x.......', t: '......x.......x.', h: '..x...x...x...x.', p: ['', '', '', 'x...............'] },
      dv: { h: 0.025, t: 0.15 },
    },
    menu: {
      bpm: 120, prog: 'D Bb C D D Bb C A',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.x.o.x.x.x.o.x.', vol: 0.24 },
        { kind: 'pad', inst: 'organ', pat: 'x-------x-------', vol: 0.045 },
        { kind: 'tone', inst: 'harp', pat: '0.1.2.1.0.1.2.3.', vol: 0.045 },
        {
          kind: 'tone', inst: 'flute', vol: 0.065,
          pat: ['0---2-4-5---4---', '3---2---1-------', '2-3-4---5-4-3---', '4---------------', '0---2-4-5---6---', '5---4---3-------', '4-5-6-5-4-3-2---', '1---------------'],
        },
      ],
      drums: { k: 'x...x...x...x...', s: '....x.......x.x.', h: 'x.x.x.x.x.x.x.x.' },
      dv: { h: 0.02, s: 0.12 },
    },
    king: {
      bpm: 112, prog: 'C Am F G C Am Dm G',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x...o...x...o...', vol: 0.22 },
        { kind: 'pad', inst: 'organ', pat: 'x-------x-------', vol: 0.04 },
        { kind: 'tone', inst: 'pluck', pat: '..0.1...2.1.....', vol: 0.05 },
        {
          kind: 'tone', inst: 'flute', vol: 0.06,
          pat: ['4-3-4---2-------', '1---2---3-------', '4-5-4-3-2-------', '3---------------', '4-3-4---2-------', '1---2---3-------', '2-3-4-5-4-3-2---', '0---------------'],
        },
      ],
      drums: { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.' },
      dv: { h: 0.02, s: 0.12 },
    },
    battle_king: {
      bpm: 132, prog: 'Cm Ab Eb Bb Cm Fm G G',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x..xx..xx..xx.x.', vol: 0.28 },
        { kind: 'pad', inst: 'organ', pat: 'x---------------', vol: 0.06 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.035 },
        { kind: 'tone', inst: 'harp', pat: '0.1.2.3.2.1.0.1.', vol: 0.05 },
        {
          kind: 'tone', inst: 'brass', vol: 0.08,
          pat: ['4---3-2-4-------', '5---4---3-------', '6---5-4-3---2---', '4---------------', '4---3-2-4---5---', '6---5---4-------', '3---4---5---6---', '7---------------'],
        },
      ],
      drums: { k: 'x...x...x.x.x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', T: 'x.......x.......', c: CRASH8, p: ROLL8 },
      dv: { T: 0.45 },
    },
    battle_joker: {
      bpm: 176, prog: 'C G C G F C G C',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x...o...x...o...', vol: 0.28, len: 0.5 },
        { kind: 'tone', inst: 'organ', pat: '....012.....012.', vol: 0.05, len: 0.5 },
        {
          kind: 'tone', inst: 'square', oct: 1, vol: 0.05, len: 0.6,
          pat: ['4321234-4321234-', '5-4-3-2-1-------', '4321234-4321234-', '5-6-7-----------', '6543456-6543456-', '4-3-2-1-0-------', '4-4-5-5-6-6-7---', '7---0-----------'],
        },
        {
          kind: 'tone', inst: 'pluck', vol: 0.05,
          pat: '0.2.4.2.0.2.4.2.',
        },
      ],
      drums: { k: 'x...x...x...x...', s: '..x...x...x...x.', h: 'xxxxxxxxxxxxxxxx', c: CRASH8, p: ROLL8 },
      dv: { h: 0.02 },
    },
    battle_archer: {
      bpm: 160, prog: 'Dm Bb F C Dm Bb Gm A',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.xox.xox.xox.xo', vol: 0.26, len: 0.7 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.05 },
        { kind: 'tone', inst: 'pluck', pat: '0123210101232101', vol: 0.055 },
        {
          kind: 'tone', inst: 'flute', oct: 1, vol: 0.08,
          pat: ['4-3-2-1-2---4---', '5---4---3-------', '4-3-2-1-2---5---', '6---------------', '7---6---5---4---', '5---4---3-------', '4---5---6---5---', '4---------------'],
        },
        {
          kind: 'tone', inst: 'horn', vol: 0.07,
          pat: ['2-------3-------', '4-------3-------', '2-------3-------', '4---------------', '5-------4-------', '3-------2-------', '3-------4-------', '3---------------'],
        },
      ],
      drums: { k: 'x...x.x.x...x...', s: '....x.......x..x', h: 'x.x.x.x.x.x.x.x.', T: 'x.......x.......', c: CRASH8, p: ROLL8 },
      dv: { T: 0.4 },
    },
    battle_lightGods: {
      bpm: 136, prog: 'Cm Ab Fm G Cm Ab Bb G',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x..x..x.x..x..x.', vol: 0.28 },
        { kind: 'pad', inst: 'organ', pat: 'x---------------', vol: 0.07 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.05 },
        { kind: 'tone', inst: 'bell', pat: '0.1.2.1.0.1.2.1.', oct: 1, vol: 0.04 },
        {
          kind: 'tone', inst: 'brass', vol: 0.09,
          pat: ['2-------3---2---', '1-------0-------', '2-------3---4---', '3---------------', '4-------5---4---', '3-------2-------', '3---4---5---4---', '3---------------'],
        },
      ],
      drums: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x...x...x...x...', T: 'x..x..x.........', c: CRASH8, p: ROLL8 },
      dv: { T: 0.4 },
    },
    battle_lightGods2: {
      bpm: 100, prog: 'C#m D C#m D',
      parts: [
        { kind: 'bass', inst: 'organ', pat: 'x---------------', vol: 0.22 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.08 },
        { kind: 'tone', inst: 'bell', pat: '0...3...1...4...', oct: 1, vol: 0.05 },
      ],
      drums: { p: 'x.......x.......' },
    },
    finalBoss: {
      bpm: 174, prog: 'Dm Bb C A Dm Bb Gm A',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'xoxoxoxoxoxoxoxo', vol: 0.26, len: 0.7 },
        { kind: 'bass', inst: 'sine', pat: 'x---x---x---x---', vol: 0.22 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.06 },
        { kind: 'tone', inst: 'pluck', pat: '0123210123432101', vol: 0.05 },
        {
          kind: 'tone', inst: 'supersaw', vol: 0.11,
          pat: ['3-----4---5---6-', '5-------4-------', '3-----4---5---3-', '4---------------', '6-----5---4---5-', '6-------7-------', '5-----4---3---4-', '5---------------'],
        },
        { kind: 'tone', inst: 'horn', oct: -1, vol: 0.07, pat: ['', '', '', '', '3-------4-------', '5-------4-------', '3-------2-------', '3---------------'] },
      ],
      drums: {
        k: ['x...x...x...x...', 'x...x...x...x...', 'x...x...x...x...', 'x...x...x.x.x.x.'],
        s: ['....x.......x...', '....x.......x...', '....x.......x...', '....x...x.x.xxxx'],
        o: '..x...x...x...x.',
        h: '.x.x.x.x.x.x.x.x',
        c: CRASH8,
        p: ROLL8,
      },
      dv: { k: 0.6, s: 0.26 },
    },
    castle: {
      bpm: 84, prog: 'D G A D Bm G Em A',
      parts: [
        { kind: 'bass', inst: 'tri', pat: 'x.......x...x...', vol: 0.28 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.045 },
        { kind: 'tone', inst: 'harp', pat: '0.1.2.3.4.3.2.1.', vol: 0.07 },
        {
          kind: 'tone', inst: 'horn', vol: 0.08,
          pat: ['2-------1---2---', '3-------2-------', '2---1---0---1---', '2---------------', '3-------2---1---', '2-------3-------', '4---3---2---1---', '2---------------'],
        },
      ],
      drums: { p: ['x...............', '', '', '', 'x...............', '', '', ''], h: '....x.......x...' },
      dv: { h: 0.02, p: 0.3 },
    },
    ending: {
      bpm: 92, prog: 'C Am F G',
      parts: [
        { kind: 'bass', inst: 'tri', pat: 'x.......x...x...', vol: 0.3 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.05 },
        { kind: 'tone', inst: 'bell', pat: '0.2.1.2.3.2.1.2.', oct: 1, vol: 0.04 },
        { kind: 'tone', inst: 'flute', oct: 1, vol: 0.07, pat: ['4-------3---2---', '2-------1---0---', '1-------2---3---', '4---------------'] },
      ],
      drums: { k: 'x.......x.......', h: '..x...x...x...x.' },
    },
  };
  for (const k in TRACKS) TRACKS[k].chords = TRACKS[k].prog.split(' ').map(parseChord);

  const pick = (p, bar) => (Array.isArray(p) ? p[bar % p.length] : p);
  function holds(str, i) {
    let n = 1;
    while (str[i + n] === '-') n++;
    return n;
  }

  function playStep(c, step, t) {
    const d = c.def, sd = c.sd, out = c.bus;
    const bar = Math.floor(step / 16), s = step % 16;
    const ch = d.chords[bar % d.chords.length];
    const cb = 60 + ch.r - (ch.r > 7 ? 12 : 0);
    if (d.drums) {
      for (const k in d.drums) {
        const str = pick(d.drums[k], bar);
        if (str && str[s] === 'x') DRUM[k](t, (d.dv && d.dv[k]) || DRUM_VOL[k], out);
      }
    }
    for (const p of d.parts) {
      const str = pick(p.pat, bar);
      if (!str) continue;
      const sym = str[s];
      const oct = 12 * (p.oct || 0);
      let notes = null;
      if (p.kind === 'bass') {
        const off = { x: 0, o: 12, 5: 7, 3: ch.iv[1] }[sym];
        if (off !== undefined) notes = [36 + ch.r - (ch.r > 6 ? 12 : 0) + oct + off];
      } else if (p.kind === 'pad') {
        if (sym === 'x') notes = ch.iv.slice(0, 4).map((v) => cb + oct + v);
      } else if (sym >= '0' && sym <= '9') {
        const i = +sym, n = ch.iv.length;
        notes = [cb + oct + ch.iv[i % n] + 12 * Math.floor(i / n)];
      }
      if (!notes) continue;
      const dur = holds(str, s) * sd * (p.len || 0.9);
      for (const m of notes) voice(p.inst, m, t, dur, p.vol, out);
    }
  }

  function setMusic(name) {
    if (name === wanted) return;
    wanted = name;
    if (!ctx) return;
    if (cur) {
      const old = cur.bus;
      const now = ctx.currentTime;
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.value, now);
      old.gain.linearRampToValueAtTime(0.0001, now + 0.25);
      setTimeout(() => old.disconnect(), 400);
      cur = null;
    }
    const def = name && TRACKS[name];
    if (!def) return;
    const start = ctx.currentTime + 0.35;
    const bus = ctx.createGain();
    bus.connect(musicBus);
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.setValueAtTime(0.0001, start);
    bus.gain.linearRampToValueAtTime(1, start + 0.3);
    cur = { name, def, bus, step: 0, next: start, sd: 60 / def.bpm / 4 };
  }

  setInterval(() => {
    if (!ctx || !cur || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (cur.next < now - 0.2) cur.next = now + 0.05;
    while (cur.next < now + 0.15) {
      playStep(cur, cur.step, cur.next);
      cur.next += cur.sd;
      cur.step++;
    }
  }, 25);

  // ---------- Sound effects ----------
  const bells = (t, notes, gap, vol = 0.07) => notes.forEach((m, i) => voice('bell', m, t + i * gap, 0.3, vol, sfxBus));
  const chordV = (inst, t, notes, dur, vol) => notes.forEach((m) => voice(inst, m, t, dur, vol, sfxBus));
  function explode(t, s = 1) {
    kick(t, 0.8 * s, sfxBus);
    noise(t, 0.7 * s, 0.35 * s, 'lowpass', 1400, 90, sfxBus);
  }
  function megaBoom(t) {
    kick(t, 1, sfxBus);
    kick(t + 0.06, 0.8, sfxBus);
    noise(t, 1.8, 0.5, 'lowpass', 2200, 50, sfxBus);
    crash(t, 0.25, sfxBus);
    timp(t, 1, sfxBus, 45);
  }
  const STAIR_SCALE = [0, 2, 3, 5, 7, 8, 10];

  const SFX = {
    jump: (t) => sweep('square', 260, 620, t, 0.11, 0.06, sfxBus),
    land: (t) => noise(t, 0.08, 0.16, 'lowpass', 700, 200, sfxBus),
    step: (t) => noise(t, 0.04, 0.12, 'bandpass', 2200, 1500, sfxBus, 2),
    stair(t, i) {
      const root = 43 + STAIR_SCALE[i % 7] + 12 * Math.floor(i / 7);
      timp(t, 0.85, sfxBus, 50 + i * 2);
      kick(t, 0.5, sfxBus);
      chordV('brass', t, [root, root + 7, root + 12], 0.45, 0.07);
      chordV('choir', t, [root + 12, root + 15, root + 19], 1.3, 0.05);
      crash(t, 0.05, sfxBus);
    },
    stairTop(t) {
      timp(t, 1, sfxBus, 48);
      kick(t, 0.7, sfxBus);
      crash(t, 0.2, sfxBus);
      chordV('choir', t, [48, 55, 60, 64, 67, 72], 3, 0.05);
      chordV('brass', t, [48, 55, 60, 64], 1.2, 0.06);
      bells(t + 0.2, [72, 76, 79, 84, 88], 0.12);
    },
    blip(t, who) {
      const f = {
        MONKEY: 1000 + rnd() * 400, ANGEL: 1100, 'SKY BIRD': 1350 + rnd() * 250, 'LIGHT OF GODS': 200, KNIGHT: 330, ARCHER: 760, JOKER: 500 + rnd() * 700, KING: 200,
      }[who] || 620;
      const w = who === 'LIGHT OF GODS' || who === 'KING' ? 'sawtooth' : who === 'ANGEL' ? 'sine' : 'square';
      sweep(w, f, f * 0.97, t, 0.04, 0.06, sfxBus);
    },
    text: (t) => sweep('square', 520, 500, t, 0.03, 0.045, sfxBus),
    cursor: (t) => sweep('square', 880, 880, t, 0.04, 0.06, sfxBus),
    confirm(t) {
      sweep('square', 660, 660, t, 0.05, 0.05, sfxBus);
      sweep('square', 990, 990, t + 0.05, 0.08, 0.05, sfxBus);
    },
    back: (t) => sweep('square', 600, 300, t, 0.08, 0.05, sfxBus),
    battleStart(t) {
      sweep('sawtooth', 150, 1400, t, 0.85, 0.06, sfxBus, 0.75);
      noise(t, 0.85, 0.2, 'highpass', 500, 6000, sfxBus, 1, 0.75);
      kick(t + 0.85, 0.8, sfxBus);
      crash(t + 0.85, 0.18, sfxBus);
      sweep('square', 880, 110, t + 0.85, 0.45, 0.06, sfxBus);
    },
    punch(t) {
      noise(t + 0.05, 0.14, 0.18, 'bandpass', 500, 2200, sfxBus, 1.5, 0.08);
    },
    fire(t) {
      noise(t, 0.12, 0.25, 'bandpass', 200, 1200, sfxBus, 1);
      noise(t + 0.08, 0.45, 0.3, 'lowpass', 500, 2500, sfxBus, 0.8, 0.15);
      sweep('sawtooth', 70, 140, t + 0.08, 0.4, 0.06, sfxBus, 0.1);
      for (let i = 0; i < 10; i++) noise(t + 0.08 + i * 0.035 + rnd() * 0.02, 0.025, 0.12, 'highpass', 2500 + rnd() * 3000, 3000, sfxBus);
    },
    imp_punch(t) {
      kick(t, 0.7, sfxBus);
      noise(t, 0.06, 0.35, 'bandpass', 1800, 800, sfxBus, 1.2);
      noise(t, 0.2, 0.2, 'lowpass', 900, 200, sfxBus);
    },
    imp_fire(t) {
      kick(t, 0.9, sfxBus);
      noise(t, 1.0, 0.45, 'lowpass', 2400, 80, sfxBus);
      noise(t, 0.4, 0.2, 'bandpass', 900, 300, sfxBus, 1);
      for (let i = 0; i < 12; i++) noise(t + 0.1 + i * 0.05 + rnd() * 0.03, 0.03, 0.1, 'highpass', 3000 + rnd() * 3000, 3000, sfxBus);
    },
    imp_ace(t) {
      kick(t, 0.4, sfxBus);
      chordV('bell', t, [79, 84, 88, 91], 0.4, 0.07);
      noise(t, 0.6, 0.2, 'highpass', 5000, 9000, sfxBus);
    },
    imp_leaf(t) {
      kick(t, 0.55, sfxBus);
      noise(t, 0.9, 0.32, 'bandpass', 1800, 500, sfxBus, 1.2);
      for (let i = 0; i < 9; i++) noise(t + i * 0.07, 0.1, 0.22, 'highpass', 6500, 1500, sfxBus, 2);
      for (let i = 0; i < 14; i++) noise(t + 0.05 + i * 0.045, 0.05, 0.1, 'bandpass', 3500 + rnd() * 3000, 2500, sfxBus, 3);
    },
    imp_beam(t) {
      kick(t, 0.6, sfxBus);
      sweep('sawtooth', 1800, 200, t, 0.35, 0.1, sfxBus);
      noise(t, 0.6, 0.3, 'lowpass', 3000, 150, sfxBus);
    },
    imp_dive(t) {
      kick(t, 1, sfxBus);
      timp(t, 0.8, sfxBus, 45);
      noise(t, 1.2, 0.45, 'lowpass', 1500, 60, sfxBus);
      for (let i = 0; i < 6; i++) noise(t + 0.15 + i * 0.08, 0.06, 0.12, 'bandpass', 1200, 600, sfxBus, 2);
    },
    imp_xbeam(t) {
      SFX.imp_fire(t);
      kick(t + 0.18, 0.9, sfxBus);
      noise(t + 0.18, 0.9, 0.4, 'lowpass', 2000, 70, sfxBus);
    },
    imp_gust(t) {
      noise(t, 0.7, 0.45, 'bandpass', 2500, 300, sfxBus, 0.8);
      kick(t, 0.6, sfxBus);
    },
    imp_spot(t) {
      megaBoom(t);
      chordV('bell', t + 0.05, [84, 88, 91], 0.5, 0.05);
    },
    superDing(t) {
      voice('square', 84, t + 0.06, 0.08, 0.06, sfxBus);
      voice('square', 91, t + 0.14, 0.15, 0.06, sfxBus);
    },
    ace(t) {
      bells(t, [84, 88, 91, 96], 0.06, 0.08);
      noise(t, 0.5, 0.06, 'highpass', 6000, 9000, sfxBus, 1, 0.1);
    },
    leaf(t) {
      noise(t, 0.5, 0.22, 'bandpass', 300, 1400, sfxBus, 1, 0.45);
      noise(t + 0.4, 1.4, 0.38, 'bandpass', 900, 2600, sfxBus, 0.7, 0.15);
      noise(t + 0.4, 1.4, 0.2, 'lowpass', 200, 700, sfxBus, 1, 0.2);
      sweep('sine', 180, 520, t, 0.45, 0.04, sfxBus, 0.4);
      for (let i = 0; i < 28; i++) {
        noise(t + 0.08 + i * 0.055 + rnd() * 0.03, 0.07, 0.13, 'bandpass', 3000 + rnd() * 3500, 2000, sfxBus, 3);
      }
    },
    beam(t) {
      sweep('sawtooth', 200, 900, t, 0.42, 0.05, sfxBus, 0.4);
      sweep('sawtooth', 110, 100, t + 0.42, 0.5, 0.09, sfxBus);
      noise(t + 0.42, 0.5, 0.15, 'highpass', 2000, 800, sfxBus);
    },
    dive(t) {
      sweep('sine', 300, 1400, t, 0.35, 0.06, sfxBus, 0.3);
      sweep('sine', 1600, 250, t + 0.35, 0.35, 0.07, sfxBus);
    },
    xbeam(t) {
      sweep('sawtooth', 300, 1500, t, 0.5, 0.06, sfxBus);
      sweep('sawtooth', 1500, 300, t, 0.5, 0.06, sfxBus);
      noise(t + 0.3, 0.5, 0.18, 'highpass', 1500, 600, sfxBus);
    },
    gust: (t) => noise(t, 1.0, 0.32, 'bandpass', 300, 2500, sfxBus, 1.2, 0.5),
    slash(t) {
      sweep('sine', 1800, 300, t, 0.14, 0.06, sfxBus);
      noise(t, 0.12, 0.2, 'highpass', 6000, 2000, sfxBus);
      sweep('sine', 300, 1800, t + 0.16, 0.12, 0.06, sfxBus);
      noise(t + 0.16, 0.1, 0.18, 'highpass', 2000, 7000, sfxBus);
    },
    imp_slash(t) {
      noise(t, 0.09, 0.32, 'highpass', 7000, 2500, sfxBus, 1.5);
      voice('bell', 98 + Math.floor(rnd() * 3), t, 0.1, 0.05, sfxBus);
      kick(t, 0.35, sfxBus);
    },
    oblivion(t) {
      sweep('sawtooth', 55, 40, t, 1.2, 0.08, sfxBus, 0.3);
      noise(t, 1.2, 0.15, 'lowpass', 300, 900, sfxBus, 1, 0.8);
      timp(t, 0.7, sfxBus, 42);
    },
    clank(t) {
      noise(t, 0.08, 0.3, 'bandpass', 3000, 1500, sfxBus, 3);
      voice('bell', 74, t, 0.1, 0.04, sfxBus);
      noise(t + 0.09, 0.06, 0.2, 'bandpass', 2500, 1200, sfxBus, 3);
    },
    shine(t) {
      bells(t, [96, 103], 0.07, 0.09);
      sweep('sine', 2000, 5000, t, 0.4, 0.04, sfxBus);
      noise(t, 0.5, 0.08, 'highpass', 7000, 10000, sfxBus, 1, 0.05);
    },
    leap(t) {
      noise(t, 0.45, 0.35, 'bandpass', 400, 3500, sfxBus, 1);
      sweep('sine', 200, 1200, t, 0.4, 0.06, sfxBus);
    },
    plunge(t) {
      sweep('sine', 2400, 200, t, 0.35, 0.08, sfxBus);
      noise(t, 0.35, 0.3, 'bandpass', 4000, 500, sfxBus, 1, 0.2);
    },
    bow(t) {
      noise(t, 0.3, 0.12, 'bandpass', 600, 1200, sfxBus, 4, 0.25);
      sweep('triangle', 120, 180, t, 0.3, 0.04, sfxBus, 0.25);
    },
    drawBow(t) {
      noise(t, 0.5, 0.14, 'bandpass', 500, 1400, sfxBus, 5, 0.45);
      sweep('triangle', 100, 220, t, 0.5, 0.05, sfxBus, 0.45);
    },
    twang(t) {
      sweep('triangle', 220, 110, t, 0.25, 0.12, sfxBus);
      noise(t, 0.18, 0.25, 'bandpass', 3000, 6000, sfxBus, 1);
    },
    imp_bow(t) {
      kick(t, 0.8, sfxBus);
      noise(t, 0.08, 0.4, 'highpass', 6000, 2000, sfxBus, 1.5);
      noise(t, 0.3, 0.25, 'lowpass', 1500, 200, sfxBus);
      sweep('square', 900, 120, t, 0.18, 0.05, sfxBus);
    },
    rain(t) {
      sweep('sawtooth', 60, 50, t, 1.0, 0.07, sfxBus, 0.3);
      timp(t, 0.6, sfxBus, 48);
    },
    flameOn(t) {
      noise(t, 0.6, 0.3, 'bandpass', 300, 1500, sfxBus, 1, 0.1);
      sweep('sawtooth', 80, 160, t, 0.5, 0.05, sfxBus);
    },
    arrowsUp(t) {
      for (let i = 0; i < 12; i++) noise(t + i * 0.04, 0.2, 0.14, 'bandpass', 1500 + rnd() * 2000, 5000, sfxBus, 3);
      SFX.twang(t);
    },
    imp_rain(t) {
      kick(t, 0.5, sfxBus);
      noise(t, 0.35, 0.3, 'lowpass', 2000, 200, sfxBus);
      noise(t, 0.06, 0.25, 'highpass', 5000, 2000, sfxBus, 1.5);
    },
    boing(t) {
      sweep('sine', 160, 720, t, 0.12, 0.12, sfxBus);
      sweep('sine', 720, 300, t + 0.12, 0.2, 0.08, sfxBus);
      sweep('triangle', 300, 520, t + 0.32, 0.12, 0.05, sfxBus);
    },
    honk(t) {
      sweep('sawtooth', 330, 300, t, 0.12, 0.08, sfxBus);
      sweep('square', 335, 305, t, 0.12, 0.04, sfxBus);
      sweep('sawtooth', 250, 220, t + 0.15, 0.18, 0.08, sfxBus);
    },
    laugh(t) {
      for (let i = 0; i < 5; i++) sweep('square', 820 - i * 60, 600 - i * 60, t + i * 0.09, 0.07, 0.05, sfxBus);
    },
    jingle(t) {
      [72, 74, 76, 77, 79, 77, 76, 74].forEach((m, i) => voice('bell', m, t + i * 0.09, 0.12, 0.06, sfxBus));
    },
    shuffle(t) {
      for (let i = 0; i < 8; i++) noise(t + i * 0.035, 0.03, 0.12, 'bandpass', 3500, 2500, sfxBus, 2);
    },
    cardFlip(t) {
      noise(t, 0.05, 0.2, 'highpass', 4000, 3000, sfxBus, 1);
      sweep('square', 600, 900, t, 0.05, 0.04, sfxBus);
    },
    safe(t) {
      bells(t, [72, 76, 79, 84], 0.08, 0.08);
      chordV('square', t + 0.32, [72, 76, 79], 0.5, 0.04);
    },
    rumble(t) {
      noise(t, 0.9, 0.35, 'lowpass', 160, 60, sfxBus);
      sweep('sawtooth', 45, 38, t, 0.9, 0.08, sfxBus);
      kick(t, 0.4, sfxBus);
    },
    beamDown(t) {
      sweep('sawtooth', 1600, 120, t, 0.6, 0.05, sfxBus);
      sweep('sine', 110, 112, t + 0.4, 2.5, 0.08, sfxBus, 0.5);
      noise(t, 0.6, 0.12, 'highpass', 4000, 8000, sfxBus);
    },
    liftOff(t) {
      sweep('sine', 120, 900, t, 2.4, 0.08, sfxBus, 0.6);
      sweep('square', 240, 1800, t, 2.4, 0.025, sfxBus, 0.6);
    },
    digital(t) {
      for (let i = 0; i < 4; i++) sweep('square', 1500 + rnd() * 1500, 1500 + rnd() * 1500, t + i * 0.06, 0.03, 0.025, sfxBus);
    },
    beep: (t) => sweep('square', 1200, 1200, t, 0.025, 0.035, sfxBus),
    glitch(t) {
      for (let i = 0; i < 6; i++) sweep('square', 200 + rnd() * 2000, 100 + rnd() * 1500, t + i * 0.04, 0.035, 0.04, sfxBus);
      noise(t, 0.25, 0.12, 'highpass', 3000, 6000, sfxBus);
    },
    swoosh(t) {
      noise(t, 0.3, 0.2, 'bandpass', 600, 4000, sfxBus, 1.5);
      sweep('sine', 200, 900, t, 0.25, 0.05, sfxBus);
    },
    goldify(t) {
      for (let i = 0; i < 10; i++) voice('bell', 76 + (i % 5) * 3 + Math.floor(i / 5) * 12, t + i * 0.12, 0.25, 0.04, sfxBus);
      sweep('triangle', 300, 1200, t, 1.3, 0.04, sfxBus);
    },
    kpunch: (t) => sweep('square', 500, 200, t, 0.12, 0.05, sfxBus),
    midas(t) {
      chordV('brass', t, [55, 62, 67], 0.6, 0.05);
      bells(t + 0.1, [79, 83, 86], 0.08, 0.05);
    },
    throne(t) {
      chordV('brass', t, [48, 55, 60, 64], 0.7, 0.06);
      timp(t, 0.8, sfxBus, 48);
    },
    grail(t) {
      chordV('choir', t, [60, 64, 67, 72], 1.2, 0.05);
      bells(t + 0.2, [84, 88, 91, 96], 0.1, 0.06);
    },
    imp_kpunch(t) {
      kick(t, 0.7, sfxBus);
      noise(t, 0.12, 0.25, 'lowpass', 2500, 400, sfxBus);
      voice('bell', 84, t, 0.2, 0.04, sfxBus);
    },
    imp_midas(t) {
      megaBoom(t);
      bells(t + 0.05, [96, 91, 88, 84, 79], 0.05, 0.06);
    },
    imp_throne(t) {
      megaBoom(t);
      noise(t, 0.5, 0.3, 'lowpass', 900, 100, sfxBus);
    },
    imp_grail(t) {
      kick(t, 0.6, sfxBus);
      noise(t, 0.15, 0.3, 'lowpass', 2500, 400, sfxBus);
    },
    glove: (t) => SFX.laugh(t),
    jack(t) {
      sweep('sine', 900, 200, t, 0.35, 0.06, sfxBus);
      SFX.laugh(t + 0.2);
    },
    cards(t) {
      SFX.laugh(t);
      sweep('sawtooth', 120, 900, t + 0.3, 0.5, 0.05, sfxBus);
      SFX.jingle(t + 0.6);
    },
    imp_glove(t) {
      kick(t, 0.6, sfxBus);
      SFX.honk(t + 0.02);
      noise(t, 0.12, 0.25, 'lowpass', 2000, 300, sfxBus);
    },
    imp_jack(t) {
      explode(t, 0.7);
      SFX.laugh(t + 0.1);
    },
    imp_cards(t) {
      explode(t, 0.9);
      crash(t, 0.15, sfxBus);
    },
    imp_oblivion(t) {
      megaBoom(t);
      noise(t, 0.2, 0.35, 'highpass', 8000, 2500, sfxBus);
      chordV('brass', t + 0.05, [40, 47, 52], 0.9, 0.08);
      for (let i = 0; i < 10; i++) noise(t + 0.15 + i * 0.06, 0.05, 0.12, 'bandpass', 2000 + rnd() * 4000, 1200, sfxBus, 3);
    },
    spot(t) {
      sweep('sine', 200, 1600, t, 0.85, 0.07, sfxBus, 0.8);
      noise(t, 0.85, 0.08, 'highpass', 3000, 9000, sfxBus, 1, 0.8);
    },
    hit(t) {
      kick(t, 0.6, sfxBus);
      noise(t, 0.15, 0.25, 'lowpass', 2500, 400, sfxBus);
    },
    superHit(t) {
      SFX.hit(t);
      voice('square', 84, t + 0.04, 0.08, 0.05, sfxBus);
      voice('square', 91, t + 0.12, 0.15, 0.05, sfxBus);
    },
    hurt(t) {
      kick(t, 0.5, sfxBus);
      noise(t, 0.18, 0.25, 'lowpass', 1800, 300, sfxBus);
      sweep('square', 300, 90, t, 0.2, 0.05, sfxBus);
    },
    explode: (t) => explode(t, 1),
    boom: (t) => explode(t, 0.6),
    faint: (t) => sweep('square', 900, 80, t, 0.6, 0.06, sfxBus),
    victory(t) {
      [72, 76, 79].forEach((m, i) => voice('square', m, t + i * 0.11, 0.09, 0.06, sfxBus));
      chordV('square', t + 0.33, [72, 76, 79, 84], 0.7, 0.04);
      voice('tri', 48, t + 0.33, 0.7, 0.25, sfxBus);
    },
    defeat(t) {
      [67, 63, 60].forEach((m, i) => voice('square', m, t + i * 0.22, 0.18, 0.05, sfxBus));
      voice('square', 55, t + 0.66, 0.8, 0.05, sfxBus);
      voice('tri', 43, t + 0.66, 0.8, 0.25, sfxBus);
    },
    transform(t) {
      noise(t, 1.1, 0.4, 'lowpass', 80, 500, sfxBus, 1, 1.0);
      chordV('choir', t, [49, 56, 61, 64], 1.2, 0.06);
      megaBoom(t + 1.0);
    },
    itemGet: (t) => bells(t, [79, 84, 88, 91, 96], 0.07),
    open: (t) => sweep('square', 400, 700, t, 0.07, 0.05, sfxBus),
    close: (t) => sweep('square', 700, 400, t, 0.07, 0.05, sfxBus),
    equip: (t) => bells(t, [84, 91], 0.08),
    throw: (t) => noise(t, 0.25, 0.15, 'bandpass', 2000, 300, sfxBus),
    launch(t) {
      noise(t, 1.1, 0.3, 'bandpass', 300, 4000, sfxBus, 1, 0.6);
      sweep('sawtooth', 100, 800, t, 1.1, 0.05, sfxBus, 0.6);
      kick(t, 0.6, sfxBus);
    },
    boost: (t) => [72, 76, 79, 84].forEach((m, i) => voice('square', m, t + i * 0.04, 0.05, 0.05, sfxBus)),
    crash: (t) => explode(t, 1),
    chime: (t) => bells(t, [84, 88, 91], 0.1),
    portal(t) {
      bells(t, [72, 76, 79, 84, 88, 91, 96], 0.05, 0.06);
      noise(t, 0.9, 0.12, 'highpass', 1000, 8000, sfxBus, 1, 0.5);
    },
    checkpoint: (t) => [72, 79, 84].forEach((m, i) => voice('square', m, t + i * 0.08, 0.07, 0.05, sfxBus)),
    fall: (t) => sweep('sine', 1000, 150, t, 0.8, 0.08, sfxBus),
    title: (t) => chordV('bell', t, [72, 76, 79], 0.5, 0.05),
    holyDescend(t) {
      chordV('choir', t, [64, 68, 71, 76], 3.5, 0.07);
      for (let i = 0; i < 8; i++) voice('bell', 84 + [0, 4, 7, 11][i % 4], t + 0.3 + i * 0.38, 0.3, 0.04, sfxBus);
    },
    holyArrive(t) {
      timp(t, 0.9, sfxBus, 55);
      crash(t, 0.15, sfxBus);
      bells(t, [76, 83, 88], 0.1);
    },
    gateOpen(t) {
      noise(t, 1.5, 0.2, 'lowpass', 120, 300, sfxBus, 1, 0.3);
      bells(t + 0.2, [79, 84, 88, 91], 0.12);
    },
    ascend: (t) => bells(t, [72, 76, 79, 84, 88], 0.1, 0.05),
    monkey: (t) => [0, 1, 2].forEach((i) => sweep('square', 1100, 1700, t + i * 0.1, 0.08, 0.04, sfxBus)),
    flap: (t) => [0, 1, 2, 3].forEach((i) => noise(t + i * 0.12, 0.08, 0.12, 'lowpass', 800, 300, sfxBus)),
    rise: (t) => sweep('sine', 200, 900, t, 0.6, 0.06, sfxBus, 0.5),
    whistle: (t) => sweep('sine', 1800, 300, t, 0.3, 0.07, sfxBus),
    megaBoom: (t) => megaBoom(t),
    skyGem(t) {
      bells(t, [72, 79, 84, 88, 91, 96], 0.04, 0.06);
      noise(t, 0.6, 0.15, 'highpass', 1000, 8000, sfxBus, 1, 0.3);
    },
    warn: (t) => sweep('square', 1046, 1046, t, 0.07, 0.045, sfxBus),
    laser(t) {
      kick(t, 0.6, sfxBus);
      sweep('sawtooth', 90, 70, t, 0.5, 0.12, sfxBus);
      sweep('sawtooth', 181, 140, t, 0.5, 0.08, sfxBus);
      noise(t, 0.5, 0.2, 'highpass', 2000, 600, sfxBus);
    },
    orb: (t) => sweep('sine', 1000, 350, t, 0.12, 0.06, sfxBus),
    lockOn: (t) => [0, 1, 2].forEach((i) => sweep('square', 700 + i * 200, 700 + i * 200, t + i * 0.08, 0.06, 0.05, sfxBus)),
    siren: (t) => [0, 1, 2, 3].forEach((i) => sweep('sawtooth', i % 2 ? 700 : 950, i % 2 ? 680 : 930, t + i * 0.15, 0.15, 0.05, sfxBus)),
    dashRoar(t) {
      noise(t, 0.55, 0.4, 'lowpass', 300, 4000, sfxBus);
      sweep('sawtooth', 80, 40, t, 0.5, 0.1, sfxBus);
    },
    die(t) {
      explode(t, 1);
      sweep('square', 600, 60, t + 0.05, 0.6, 0.06, sfxBus);
    },
    respawn: (t) => [72, 76, 79, 84].forEach((m, i) => voice('square', m, t + i * 0.04, 0.05, 0.04, sfxBus)),
    tired(t) {
      chordV('choir', t, [62, 65, 69], 1.4, 0.06);
      sweep('sine', 400, 150, t + 0.3, 1.4, 0.06, sfxBus);
    },
    vines(t) {
      for (let i = 0; i < 6; i++) noise(t + i * 0.09, 0.05, 0.25, 'highpass', 2500, 2500, sfxBus, 1);
      noise(t, 1.2, 0.3, 'bandpass', 2500, 800, sfxBus, 1.5, 0.2);
      for (let i = 0; i < 20; i++) noise(t + 0.1 + i * 0.05 + rnd() * 0.03, 0.06, 0.12, 'bandpass', 3000 + rnd() * 3000, 2000, sfxBus, 3);
      kick(t + 0.9, 0.6, sfxBus);
      noise(t + 0.9, 0.5, 0.3, 'lowpass', 800, 150, sfxBus);
      kick(t + 1.15, 0.4, sfxBus);
    },
    heartbeat(t) {
      sweep('sine', 70, 40, t, 0.16, 0.7, sfxBus);
      sweep('sine', 64, 38, t + 0.2, 0.14, 0.45, sfxBus);
    },
    knock(t) {
      megaBoom(t);
      sweep('square', 500, 50, t + 0.05, 0.8, 0.07, sfxBus);
      noise(t, 0.9, 0.3, 'bandpass', 3000, 200, sfxBus, 1);
    },
    wake(t) {
      chordV('choir', t, [62, 66, 69, 74], 2.5, 0.04);
      bells(t + 0.3, [86, 81, 78, 74], 0.25, 0.04);
    },
    finalBoom(t) {
      megaBoom(t);
      chordV('choir', t + 0.2, [50, 57, 62, 66, 69, 74], 4, 0.05);
      bells(t + 0.6, [74, 78, 81, 86, 90, 93], 0.15, 0.05);
    },
  };

  const lastPlay = {};
  const COOLDOWN = { step: 0.12, land: 0.1, hit: 0.08, hurt: 0.08, boom: 0.15, warn: 0.1 };
  function play(name, arg) {
    if (!ctx || ctx.state !== 'running' || muted) return;
    const fn = SFX[name];
    if (!fn) return;
    const now = ctx.currentTime;
    const prev = lastPlay[name];
    if (prev && now - prev.t < (COOLDOWN[name] || 0.05)) return;
    if (prev) {
      prev.g.gain.cancelScheduledValues(now);
      prev.g.gain.setValueAtTime(prev.g.gain.value, now);
      prev.g.gain.linearRampToValueAtTime(0.0001, now + 0.04);
      const old = prev.g;
      setTimeout(() => old.disconnect(), 3000);
    }
    const g = ctx.createGain();
    g.connect(sfxRoot);
    lastPlay[name] = { t: now, g };
    sfxBus = g;
    try {
      fn(now + 0.01, arg);
    } finally {
      sfxBus = sfxRoot;
    }
  }

  function toggleMute() {
    muted = !muted;
    localStorage.setItem('powerland-muted', muted ? '1' : '0');
    if (master) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, ctx.currentTime, 0.05);
    return muted;
  }

  function stream() {
    init();
    if (!ctx || !outNode) return null;
    if (!recDest) {
      recDest = ctx.createMediaStreamDestination();
      outNode.connect(recDest);
    }
    return recDest.stream;
  }

  window.Sound = { play, music: setMusic, toggleMute, isMuted: () => muted, stream };
})();
