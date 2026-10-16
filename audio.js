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
    wobble: { w: ['sawtooth', 'square', 'sine'], d: [0, -1200, -1200], g: [1, 0.7, 0.9], lp: 700, wob: [6, 600], a: 0.005, r: 0.06 },
    growl: { w: ['sawtooth', 'sawtooth', 'square'], d: [-22, 22, -1200], g: [1, 1, 0.5], lp: 1600, wob: [9, 1100], a: 0.01, r: 0.1, vib: [6, 8] },
    sonar: { w: ['sine', 'sine'], m: [1, 3.01], g: [1, 0.12], perc: 2.4 },
    glass: { w: ['sine', 'triangle', 'sine'], m: [1, 2, 6.3], g: [1, 0.3, 0.08], lpEnv: [6000, 900, 0.3], perc: 0.5 },
    whale: { w: ['sine', 'triangle', 'sawtooth'], m: [1, 1, 2], d: [0, 6, 0], g: [1, 0.5, 0.06], lp: 1400, a: 0.25, r: 0.6, vib: [3, 30] },
  };

  function voice(name, midi, t, dur, vol, out) {
    const p = INST[name] || INST.square;
    const f = mtof(midi);
    const g = ctx.createGain();
    g.connect(out);
    let dest = g, fl = null;
    if (p.lp || p.lpEnv) {
      fl = ctx.createBiquadFilter();
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
    if (p.wob && fl) {
      const wl = ctx.createOscillator();
      wl.type = 'triangle';
      wl.frequency.value = p.wob[0];
      const wg = ctx.createGain();
      wg.gain.value = p.wob[1];
      wl.connect(wg).connect(fl.frequency);
      wl.start(t);
      wl.stop(end + 0.05);
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
  const SC = {
    pentaMin: [0, 3, 5, 7, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixo: [0, 2, 4, 5, 7, 9, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    aeolian: [0, 2, 3, 5, 7, 8, 10],
    harmMin: [0, 2, 3, 5, 7, 8, 11],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    phrygDom: [0, 1, 4, 5, 7, 8, 10],
    blues: [0, 3, 5, 6, 7, 10],
    major: [0, 2, 4, 5, 7, 9, 11],
  };
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
    // Fiery punk: power-chord stabs, offbeat "oom-pa" snare, minor pentatonic riffs.
    battle_redKid: {
      bpm: 172, prog: 'E5 E5 C5 D5 E5 G5 A5 B5', key: 4, scale: SC.pentaMin,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.x.x.x.x.x.x.x.', vol: 0.3, len: 0.6 },
        { kind: 'pad', inst: 'saw', pat: 'x..x..x...x..x..', vol: 0.035, len: 0.45 },
        {
          kind: 'tone', inst: 'square', vol: 0.06,
          pat: ['0.0.2.3-4-3-2---', '0.0.2.3-2-------', '5-4-3-2-3-4-5---', '7---6---5---4---', '0.0.2.3-4-3-2---', '5-5-6-7-6-5-4---', '3-4-5-6-7-------', '9-------7---5---'],
        },
      ],
      drums: { k: 'x...x...x...x...', s: '..x...x...x...x.', h: 'x.x.x.x.x.x.x.x.', c: CRASH8 },
      dv: { h: 0.035, s: 0.17 },
    },
    // Jungle shuffle: swung bongos and shakers, no snare, bouncy marimba hook.
    battle_monkey: {
      bpm: 128, swing: 0.3, prog: 'Gm Gm C Gm Gm Gm D C', key: 7, scale: SC.pentaMin,
      parts: [
        { kind: 'bass', inst: 'tri', pat: 'x..x..x.x.o.x...', vol: 0.36 },
        { kind: 'tone', inst: 'marimba', pat: '0.2.1.2.0.2.3.2.', vol: 0.13 },
        {
          kind: 'tone', inst: 'marimba', oct: 1, vol: 0.24,
          pat: ['0.2.3.4.3.2.0...', '3.4.5---3.2.0---', '0.2.3.4.5.6.5...', '4---3---2-------', '5.5.4.4.3.3.2.2.', '3.2.0---2.3.4---', '5.6.7.6.5.4.3.2.', '0---------------'],
        },
        { kind: 'tone', inst: 'flute', oct: 1, vol: 0.05, pat: ['', '', '', '', '7-------6-------', '5-------4-------', '5---6---7-------', '5---------------'] },
      ],
      drums: { k: 'x.........x.....', T: 'x.....x...x.....', t: '..x.x...x.xx..x.', h: 'xxxxxxxxxxxxxxxx', c: CRASH8 },
      dv: { t: 0.2, h: 0.03, T: 0.38 },
    },
    // Heavenly waltz in 3/4: choir, flowing harp, bright Lydian melody, timpani on the downbeat.
    battle_angel: {
      bpm: 172, steps: 12, prog: 'F G Em Am F G C C', key: 5, scale: SC.lydian,
      parts: [
        { kind: 'bass', inst: 'tri', pat: 'x-----------', vol: 0.32 },
        { kind: 'pad', inst: 'choir', pat: 'x-----------', vol: 0.055 },
        { kind: 'pad', inst: 'strings', pat: '....x...x...', vol: 0.035, len: 0.5 },
        { kind: 'tone', inst: 'harp', pat: '0.1.2.3.2.1.', vol: 0.07 },
        {
          kind: 'tone', inst: 'flute', oct: 1, vol: 0.085,
          pat: ['4-----5-6---', '5-----4-----', '2-----3-4---', '3-----------', '4-----5-6---', '7-----6-5---', '6---5---4---', '4-----------'],
        },
        { kind: 'tone', inst: 'bell', oct: 2, vol: 0.03, pat: ['4-----------', '', '2-----------', '', '4-----------', '7-----------', '6-----------', '4-----------'] },
      ],
      drums: { p: 'x...........', h: '....x...x...', c: CRASH8 },
      dv: { p: 0.35, h: 0.03 },
    },
    // Soaring sky chase: fast Mixolydian flute runs over shimmering wind arps and syncopated kicks.
    battle_skyBird: {
      bpm: 188, prog: 'D C G D D C Em A', key: 2, scale: SC.mixo,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.ox.ox.x.ox.oxo', vol: 0.24, len: 0.6 },
        { kind: 'pad', inst: 'strings', pat: 'x-------x-------', vol: 0.04 },
        { kind: 'tone', inst: 'stacc', oct: 1, pat: '0123432101234321', vol: 0.022 },
        {
          kind: 'tone', inst: 'flute', oct: 1, vol: 0.09,
          pat: ['4-5-7---6-5-4---', '3-------2-------', '4-5-7---9---8---', '7---------------', '7-8-9-8-7-6-5---', '6---5---4-------', '4-5-6-7-6-5-4-2-', '1---------------'],
        },
      ],
      drums: { k: 'x..x..x...x..x..', s: '....x.......x...', o: '..x...x...x...x.', h: '.x.x.x.x.x.x.x.x', c: CRASH8 },
      dv: { h: 0.025, o: 0.05 },
    },
    // Medieval war march: military snare rolls, root-fifth bass, heroic horn fanfare.
    battle_knight: {
      bpm: 132, prog: 'Em D C B Em G D B', key: 4, scale: SC.aeolian,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x...5...x...5...', vol: 0.3, len: 0.5 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.045 },
        { kind: 'tone', inst: 'pluck', pat: '0.2.1.2.0.2.1.2.', vol: 0.045 },
        {
          kind: 'tone', inst: 'horn', vol: 0.11,
          pat: ['0---0-2-4-------', '3---2---1-------', '0---0-2-4---5---', '4---------------', '7---6-5-4---5---', '6---5---4-------', '4---5---6---5---', '4-------2-------'],
        },
        { kind: 'tone', inst: 'brass', oct: -1, vol: 0.05, pat: ['0-------', '', '0-------', '', '4-------', '3-------', '4-------', '4-------'] },
      ],
      drums: { k: 'x.......x.......', s: ['x.xxx.x.x.xxx.x.', 'x.xxx.x.x.x.xxxx'], T: 'x.......x.......', c: CRASH8 },
      dv: { s: 0.1, T: 0.35 },
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
    // Baroque royal court: harpsichord 16ths, walking continuo bass, trumpet fanfare, timpani instead of a drum kit.
    battle_king: {
      bpm: 124, prog: 'Cm Fm G Cm Ab Fm G C', key: 0, scale: SC.harmMin,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.o.x.o.x.o.x.o.', vol: 0.24, len: 0.6 },
        { kind: 'pad', inst: 'organ', pat: 'x-------x-------', vol: 0.05 },
        { kind: 'tone', inst: 'pluck', oct: 1, pat: '0121012101210121', vol: 0.04 },
        {
          kind: 'tone', inst: 'brass', vol: 0.085,
          pat: ['4-4-4-7-------6-', '5-------3-------', '4---5---6---7---', '7-------6-------', '2-3-4-2-0-------', '5---4---3---2---', '1---2---3-6-5---', '7---------------'],
        },
      ],
      drums: { p: 'x.....x.x.......', s: ['', '', '', '', '', '', '', 'x.x.x.x.xxxxxxxx'], c: CRASH8 },
      dv: { p: 0.4, s: 0.12 },
    },
    ufo: {
      bpm: 104, prog: 'Em C Am B Em C D B',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x..x..x.x..x..x.', vol: 0.22 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.035 },
        { kind: 'tone', inst: 'bell', oct: 1, pat: '0.2.4.2.0.2.4.6.', vol: 0.035 },
        {
          kind: 'tone', inst: 'sine', oct: 1, vol: 0.06,
          pat: ['4-------3---2---', '0---------------', '2---3---4---5---', '6---------------', '4-------5---6---', '7---6---5-------', '4---3---2---1---', '0---------------'],
        },
      ],
      drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' },
      dv: { h: 0.018, s: 0.1 },
    },
    mech: {
      bpm: 96, prog: 'Am F G Em Am F E E',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x...x.x.x...x.x.', vol: 0.24 },
        { kind: 'pad', inst: 'organ', pat: 'x-------x-------', vol: 0.035 },
        { kind: 'tone', inst: 'marimba', pat: '0.1.2...0.1.2...', vol: 0.05 },
      ],
      drums: { k: 'x.......x.......', T: '....x.......x...', h: '..x...x...x...x.' },
      dv: { h: 0.02, T: 0.25 },
    },
    captain: {
      bpm: 84, prog: 'Dm Bb Gm A Dm Bb Gm A',
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.......x...x...', vol: 0.24 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.03 },
        { kind: 'pad', inst: 'organ', pat: 'x-------x-------', vol: 0.035 },
        { kind: 'tone', inst: 'bell', pat: '0...2...4...2...', vol: 0.035 },
        {
          kind: 'tone', inst: 'horn', vol: 0.06,
          pat: ['4-------3-------', '2-------1-------', '4---5---6---5---', '4---------------', '4-------5-------', '6---5---4-------', '3---2---1---2---', '0---------------'],
        },
      ],
      drums: { k: 'x.......x.......', T: '....x.......x.x.', h: '..x...x...x...x.' },
      dv: { h: 0.02, T: 0.3 },
    },
    // Industrial workshop funk: swung slap bass, offbeat synth stabs, clanking toms, bluesy saw lead.
    battle_mechanic: {
      bpm: 118, swing: 0.18, prog: 'Am Am C D Am Am F E', key: 9, scale: SC.blues,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x..x.xo.x..x.x.o', vol: 0.32, len: 0.5 },
        { kind: 'pad', inst: 'supersaw', pat: '....x.......x...', vol: 0.03, len: 0.3 },
        { kind: 'tone', inst: 'pluck', pat: '0.3.0.3.2.3.0.3.', vol: 0.04 },
        {
          kind: 'tone', inst: 'saw', vol: 0.06,
          pat: ['0-2-3-4-3-2-0---', '5---4---3---2---', '0-2-3-4-5-4-3---', '2-------0-------', '5-6-7-6-5-4-3---', '4---3---2---3---', '5-5-4-4-3-3-2-2-', '0---------------'],
        },
      ],
      drums: { k: 'x..x..x...x..x..', s: '....x.......x...', t: '......x.......x.', o: '..x...x...x...x.', h: 'x.x.x.x.x.x.x.x.' },
      dv: { t: 0.14, h: 0.025, o: 0.04 },
    },
    // Space opera: relentless 16th ostinato, half-time drums, choir and a commanding brass theme.
    battle_captain: {
      bpm: 148, prog: 'Dm Bb Gm A Dm Bb Eb A', key: 2, scale: SC.harmMin,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'xxxxxxxxxxxxxxxx', vol: 0.22, len: 0.4 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.05 },
        { kind: 'pad', inst: 'supersaw', pat: 'x---------------', vol: 0.022 },
        { kind: 'tone', inst: 'bell', oct: 1, pat: '0...1...2...1...', vol: 0.04 },
        {
          kind: 'tone', inst: 'brass', vol: 0.09,
          pat: ['0-----4-------3-', '4-------1-------', '2---3---4---5---', '6-------4-------', '7-----6---5---4-', '5-------3-------', '4---3---2---1---', '6---------------'],
        },
        { kind: 'tone', inst: 'horn', oct: -1, vol: 0.06, pat: ['0-------', '', '2-------', '', '0-------4-------', '5-------', '4-------2-------', '1---------------'] },
      ],
      drums: { k: 'x.........x.....', s: '........x.......', T: 'x.......x.....x.', h: 'x.x.x.x.x.x.x.x.', c: CRASH8 },
      dv: { T: 0.4, s: 0.28, h: 0.025 },
    },
    wreck: {
      bpm: 78, prog: 'C#m A F#m G# C#m A D G#', glitch: true,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.......x..x....', vol: 0.24 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.035 },
        { kind: 'tone', inst: 'bell', oct: 1, pat: '0...3...1...4...', vol: 0.025 },
        {
          kind: 'tone', inst: 'sine', vol: 0.05,
          pat: ['4-------3-------', '2---------------', '1-------2-------', '3---------------', '4-------5-------', '4---3---2-------', '1---2---3-------', '0---------------'],
        },
      ],
      drums: { k: 'x.........x.....', T: '....x.......x...', h: '..x...x...x...x.' },
      dv: { h: 0.015, T: 0.25 },
    },
    // Glitched drum & bass: broken breakbeats, long growling bass, dark Phrygian saw lead.
    battle_brokenMech: {
      bpm: 174, prog: 'C#m C#m D D C#m C#m A G#', glitch: true, key: 1, scale: SC.phrygian,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x-------x--x-o--', vol: 0.3, len: 0.95 },
        { kind: 'pad', inst: 'supersaw', pat: 'x---------------', vol: 0.024 },
        { kind: 'tone', inst: 'square', oct: 1, vol: 0.022, pat: '0.0.4.4.0.0.5.5.' },
        {
          kind: 'tone', inst: 'saw', vol: 0.065,
          pat: ['0---1---0-------', '3---1---0-------', '0---1---3---4---', '5-------4-------', '7---8---7---5---', '4---5---4---3---', '1-------0-------', '1---------------'],
        },
      ],
      drums: {
        k: ['x.........x.....', 'x.........xx....'],
        s: ['....x..x.x..x...', '....x.......x..x'],
        h: 'x.xxx.xxx.xxx.xx',
        c: CRASH8,
      },
      dv: { h: 0.02, s: 0.22 },
    },
    ruins: {
      bpm: 88, prog: 'Fm Db Bbm C Fm Db Eb C', glitch: true,
      parts: [
        { kind: 'bass', inst: 'tri', pat: 'x..x....x..x.o..', vol: 0.28 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.028 },
        { kind: 'tone', inst: 'square', oct: 1, pat: '0..2..1.3..2..1.', vol: 0.022 },
        {
          kind: 'tone', inst: 'tri', oct: 1, vol: 0.07,
          pat: ['2-------1---0---', '1-------2-------', '3---2---1---2---', '4---------------', '2---3---4---5---', '6-------5-------', '4---3---2---1---', '0---------------'],
        },
      ],
      drums: { k: 'x.......x..x....', s: '........x.......', h: 'x.x.x.x.x.x.xxx.' },
      dv: { h: 0.02, s: 0.12 },
    },
    haunt: {
      bpm: 66, prog: 'Fm Gb Fm E', glitch: true, form: ['A', 'B'],
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x---------------', vol: 0.2 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.04 },
        { kind: 'tone', inst: 'bell', pat: '0.......4.......', oct: 1, vol: 0.035 },
        { kind: 'tone', inst: 'sine', oct: 2, vol: 0.025, pat: ['5-------4-------', '3---------------', '5-------6-------', '7---------------'] },
      ],
      drums: { p: 'x...............' },
      dv: { p: 0.3 },
    },
    // Gothic ghost tarantella in 6/8: pipe organ, choir, harpsichord and an eerie Phrygian-dominant theme.
    battle_thousandForger: {
      bpm: 216, steps: 12, prog: 'F Gb F C F Bbm Gb C', glitch: true, key: 5, scale: SC.phrygDom,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x..x..x..x..', vol: 0.28, len: 0.6 },
        { kind: 'pad', inst: 'organ', pat: 'x-----------', vol: 0.05 },
        { kind: 'pad', inst: 'choir', pat: 'x-----------', vol: 0.04 },
        { kind: 'tone', inst: 'pluck', oct: 1, pat: '0.1.2.1.2.1.', vol: 0.04 },
        {
          kind: 'tone', inst: 'brass', vol: 0.085,
          pat: ['4.5.4.3.2.1.', '2-----1-----', '4.5.4.3.4.5.', '6-----4-----', '7.8.7.6.5.4.', '5-----3-----', '4.3.2.1.2.3.', '4-----------'],
        },
        { kind: 'tone', inst: 'horn', oct: -1, vol: 0.05, pat: ['0-----------', '1-----------', '0-----------', '4-----------', '0-----------', '3-----------', '1-----------', '4-----------'] },
      ],
      drums: { T: 'x.....x.....', k: 'x..x..x..x..', s: '......x.....', h: 'x.x.x.x.x.x.', p: ['', '', '', 'x.x.x.xxxxxx'], c: CRASH8 },
      dv: { T: 0.42, h: 0.022, s: 0.18, k: 0.35 },
    },
    // The long walk: a lonely, detuned drive through what's left of the world.
    groad: {
      bpm: 92, prog: 'Em C G D Em C Am B', glitch: true, key: 4, scale: SC.aeolian,
      parts: [
        { kind: 'bass', inst: 'tri', pat: 'x.......x.x.....', vol: 0.26 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.035 },
        { kind: 'tone', inst: 'pluck', oct: 1, pat: '0...2...4...2...', vol: 0.03 },
        {
          kind: 'tone', inst: 'sine', vol: 0.055,
          pat: ['4-------2---1---', '0---------------', '2-------4-------', '3---------------', '4---5---4---2---', '1-------0-------', '2---1---0---1---', '-1--------------'],
        },
      ],
      drums: { k: 'x.......x.......', h: '..x...x...x...x.', p: ['', '', '', 'x...x...x.x.x.x.'] },
      dv: { h: 0.015, p: 0.2 },
    },
    // Red Kid's grassland theme on a broken music box.
    echo: {
      bpm: 70, prog: 'G D Em C', glitch: true, noMod: true,
      parts: [
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.025 },
        { kind: 'tone', inst: 'harp', pat: '0.2.1.2.0.2.1.2.', vol: 0.03 },
        { kind: 'tone', inst: 'bell', oct: 1, vol: 0.05, pat: ['2-1-0---1---2---', '3---2---1-------', '2-1-0---1---2-4-', '3---------------'] },
      ],
    },
    // Red Kid's punk battle theme, corrupted: Phrygian lead, breakbeats and stuttering glitch.
    battle_glitch: {
      bpm: 186, prog: 'E5 F5 C5 D5 E5 G5 A#5 B5', glitch: true, key: 4, scale: SC.phrygian,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.o.x.o.xxo.x.o.', vol: 0.3, len: 0.55 },
        { kind: 'pad', inst: 'supersaw', pat: 'x-------x-------', vol: 0.022 },
        { kind: 'tone', inst: 'bell', oct: 1, pat: '0.4.7.4.0.4.7.4.', vol: 0.025 },
        {
          kind: 'tone', inst: 'square', vol: 0.06,
          pat: ['0.0.2.3-4-3-2---', '0.0.2.3-2-------', '5-4-3-2-3-4-5---', '7---6---5---4---', '0.0.1.3-4-3-1---', '5-5-6-7-6-5-4---', '3-4-5-6-7-8-9---', '9-8-7-------0---'],
        },
        { kind: 'tone', inst: 'saw', oct: -1, vol: 0.035, pat: ['0-------', '', '1-------', '', '0-------', '', '4-------', '5-------'] },
      ],
      drums: {
        k: ['x.....x...x.....', 'x.....x...x..x..'],
        s: ['....x.......x...', '....x..x....x.xx'],
        h: 'xxx.xxx.xxx.xxxx',
        c: CRASH8,
      },
      dv: { h: 0.025, s: 0.2 },
    },
    // Chapter 7: a dead, colorless forest. Sparse plucks over a hollow drone.
    barren: {
      bpm: 74, prog: 'Am F Dm E Am F G E', glitch: true, key: 9, scale: SC.harmMin,
      parts: [
        { kind: 'bass', inst: 'tri', pat: 'x.......x.......', vol: 0.24 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.03 },
        { kind: 'tone', inst: 'harp', pat: '0...2...1...2...', vol: 0.03 },
        {
          kind: 'tone', inst: 'flute', vol: 0.05,
          pat: ['4-------3---2---', '0---------------', '1-------2---3---', '4---------------', '4---5---4---2---', '0-------1-------', '2-------1---0---', '-1--------------'],
        },
      ],
      drums: { p: 'x.......x.......' },
      dv: { p: 0.15 },
    },
    // The floating glitch staircase: airy rising arpeggios, the sky opening up.
    skystairs: {
      bpm: 84, prog: 'D E F#m G A Bm G A', glitch: true, key: 2, scale: SC.lydian,
      parts: [
        { kind: 'bass', inst: 'sine', pat: 'x-------x-------', vol: 0.24 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.035 },
        { kind: 'tone', inst: 'bell', oct: 1, pat: '0.1.2.3.4.3.2.1.', vol: 0.03 },
        {
          kind: 'tone', inst: 'flute', oct: 1, vol: 0.05,
          pat: ['2-------3---4---', '4-------5-------', '5---4---3---2---', '3---------------', '4---5---6---7---', '7-------6-------', '5---6---7---8---', '7---------------'],
        },
      ],
      drums: { h: '..x...x...x...x.', k: 'x.......x.......' },
      dv: { h: 0.012, k: 0.25 },
    },
    // The Core speaks: a cold choir and a slow, heavy heartbeat.
    coreTheme: {
      bpm: 60, prog: 'Cm Ab Cm G', glitch: true, noMod: true,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x---------------', vol: 0.24 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.05 },
        { kind: 'tone', inst: 'bell', pat: '0.......2.......', oct: 1, vol: 0.04 },
      ],
      drums: { k: 'x..x............' },
      dv: { k: 0.4 },
    },
    // Final boss: harmonic-minor supersaw anthem with brass, choir and a relentless breakbeat.
    battle_core: {
      bpm: 196, prog: 'Cm Ab Fm G Cm Eb Ab G', glitch: true, key: 0, scale: SC.harmMin,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.xox.xox.xox.xo', vol: 0.3, len: 0.5 },
        { kind: 'pad', inst: 'supersaw', pat: 'x-------x-------', vol: 0.03 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.035 },
        { kind: 'tone', inst: 'square', oct: 1, pat: '0246024602460246', vol: 0.02, len: 0.5 },
        {
          kind: 'tone', inst: 'brass', vol: 0.085,
          pat: ['4---3-2-1---2---', '4-------6-------', '5---4-3-2---3---', '7---------------', '4-5-6-7-8---7---', '6-------4-------', '5---6---7---6---', '7-------8-------'],
        },
        { kind: 'tone', inst: 'horn', oct: -1, vol: 0.05, pat: ['0---------------', '5---------------', '3---------------', '4---------------'] },
      ],
      drums: {
        k: ['x.....x...x.....', 'x.....x...x..x.x'],
        s: ['....x.......x...', '....x..x....x.xx'],
        h: 'xxxxxxxxxxxxxxxx',
        c: CRASH8,
      },
      dv: { h: 0.022, s: 0.2, k: 0.4 },
    },
    // The world stabilizes: warm, bright and triumphant.
    dawn: {
      bpm: 96, prog: 'C G Am F C G F C', key: 0, scale: SC.major,
      parts: [
        { kind: 'bass', inst: 'tri', pat: 'x...x...x...x.o.', vol: 0.28 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.05 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.03 },
        { kind: 'tone', inst: 'harp', pat: '0.2.4.2.0.2.4.2.', vol: 0.04 },
        {
          kind: 'tone', inst: 'horn', vol: 0.09,
          pat: ['4-------5---6---', '7-------4-------', '5---6---7---8---', '7---------------', '9-------8---7---', '8-------6-------', '7---6---5---4---', '4---------------'],
        },
        { kind: 'tone', inst: 'bell', oct: 1, vol: 0.03, pat: ['0---------------', '', '2---------------', '', '4---------------', '', '3---------------', '0---------------'] },
      ],
      drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', c: CRASH8 },
      dv: { h: 0.018, s: 0.12 },
    },
    // Chapter 8: a sunny seaside city. Bouncy marimba and a whistly lead.
    town: {
      bpm: 112, swing: 0.15, prog: 'F C Dm Bb F C Bb C', key: 5, scale: SC.major,
      parts: [
        { kind: 'bass', inst: 'tri', pat: 'x...x.o.x...x.o.', vol: 0.28 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.03 },
        { kind: 'tone', inst: 'marimba', pat: '0.2.4.2.1.2.4.2.', vol: 0.14 },
        {
          kind: 'tone', inst: 'flute', oct: 1, vol: 0.07,
          pat: ['4-3-2---4---5---', '4-------2-------', '3-4-5---4-3-2---', '1---------------', '4-5-6---7---6---', '5-------4-------', '3---4---5---3---', '4---------------'],
        },
      ],
      drums: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', c: CRASH8 },
      dv: { h: 0.02, s: 0.12 },
    },
    // The beach: slow, warm and swaying, like the waves.
    beach: {
      bpm: 84, swing: 0.25, prog: 'C Am F G C Am Dm G', key: 0, scale: SC.major,
      parts: [
        { kind: 'bass', inst: 'sine', pat: 'x.....x...x.....', vol: 0.26 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.035 },
        { kind: 'tone', inst: 'harp', pat: '0.2.4.2.0.2.4.2.', vol: 0.035 },
        {
          kind: 'tone', inst: 'marimba', oct: 1, vol: 0.12,
          pat: ['4---2---3---4---', '2-------0-------', '1---2---3---2---', '4---------------', '4---5---6---5---', '4-------2-------', '3---2---1---2---', '0---------------'],
        },
      ],
      drums: { k: 'x.......x.......', h: '..x...x...x...x.', p: '....x.......x...' },
      dv: { h: 0.015, p: 0.1 },
    },
    // Deep ocean: slow dreamy bells over a deep drone.
    deepsea: {
      bpm: 70, prog: 'Dm Bb F C Dm Bb Gm A', key: 2, scale: SC.dorian,
      parts: [
        { kind: 'bass', inst: 'sine', pat: 'x-------x-------', vol: 0.26 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.03 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.03 },
        { kind: 'tone', inst: 'bell', oct: 1, pat: '0...2...4...2...', vol: 0.025 },
        {
          kind: 'tone', inst: 'flute', vol: 0.05,
          pat: ['4-------3---2---', '1---------------', '2-------3-------', '4---------------', '5-------4---3---', '2---------------', '3-------2-------', '1---------------'],
        },
      ],
      drums: { p: 'x.......x.......' },
      dv: { p: 0.1 },
    },
    // The titan fish wakes: heavy, slow and ancient.
    eaterTheme: {
      bpm: 60, prog: 'D Eb D Cm D Eb Gm Eb', key: 2, scale: SC.phrygDom, noMod: true, ocean: true,
      parts: [
        { kind: 'bass', inst: 'wobble', pat: 'x---------------', vol: 0.22 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.045 },
        { kind: 'tone', inst: 'glass', oct: 1, pat: '0...2...1...3...', vol: 0.03 },
        {
          kind: 'tone', inst: 'whale', oct: -1, vol: 0.08,
          pat: ['0-------1---2---', '1---------------', '4---2---1---0---', '6---------------', '0---1---2---4---', '5-------4---1---', '3---------------', '1-------0-------'],
        },
      ],
      drums: { T: ['x.......x..x....', 'x...........x.x.'], p: ['x...............', '', '', ''] },
      dv: { T: 0.45, p: 0.35 },
      brkInst: 'sonar', peakInst: 'horn',
    },
    // Mega Eater battle: phrygian dominant sea-shanty riff over a wobbling bass, sonar pings and taiko.
    battle_megaEater: {
      bpm: 156, prog: 'D Eb D Cm D Eb Gm Eb', key: 2, scale: SC.phrygDom, ocean: true,
      parts: [
        { kind: 'bass', inst: 'wobble', pat: 'x-.x-.x-x-.x-o-.', vol: 0.26 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.03 },
        { kind: 'tone', inst: 'glass', oct: 1, pat: '0.2.3.1.0.2.3.2.', vol: 0.035 },
        {
          kind: 'tone', inst: 'brass', vol: 0.075,
          pat: ['0-1-2---4---2-1-', '1-------8---7---', '7-6-5-4-5---4---', '3---------6-5-3-', '4-4-7---4-4-8-7-', '8---------7-8-9-', '7---5---3---5---', '4---1---0-------'],
        },
        { kind: 'tone', inst: 'whale', oct: -1, vol: 0.04, pat: ['0---------------', '1---------------', '2---------------', '3---------------', '4---------------', '5---------------', '3---------------', '1---------------'] },
      ],
      drums: {
        k: ['x..x..x...x..x..', 'x..x..x...x.x.x.'],
        s: ['....x.......x...', '....x.......x..x'],
        h: 'x.xxx.x.x.xxx.x.',
        T: ['x.........x.....', '', 'x.........x.....', 'x...x...x.x.x.x.'],
        c: CRASH8,
      },
      dv: { h: 0.018, s: 0.17, T: 0.35 },
      brkInst: 'sonar', peakInst: 'whale',
    },
    // Phase 2: furious and distorted, a growling lead climbing high over supersaws and racing taiko.
    battle_megaEater2: {
      bpm: 184, prog: 'D Eb D Eb Cm Gm Eb D', key: 2, scale: SC.phrygDom, ocean: true, drive: true,
      parts: [
        { kind: 'bass', inst: 'wobble', pat: 'x.xox.xox.xox.xo', vol: 0.26, len: 0.6 },
        { kind: 'pad', inst: 'supersaw', pat: 'x-------x-------', vol: 0.028 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.04 },
        { kind: 'tone', inst: 'glass', oct: 1, pat: '0213021302130213', vol: 0.025, len: 0.5 },
        {
          kind: 'tone', inst: 'growl', vol: 0.07,
          pat: ['7-8-7-4-7-8-9-8-', '8---7---5---4---', '7-8-7-4-5-6-7---', '8---------------', '4-5-4-1-4-5-6-5-', '7---6---5---3---', '3-4-5-6-7-8-9---', '7---------------'],
        },
        { kind: 'tone', inst: 'horn', oct: -1, vol: 0.05, pat: ['0---------------', '1---------------', '0---------------', '1---------------', '6---------------', '3---------------', '1---------------', '0---------------'] },
      ],
      drums: {
        k: ['x.x...x.x.x...x.', 'x.x...x.x.x.x.xx'],
        s: ['....x.......x...', '....x..x....x.xx'],
        h: 'xxxxxxxxxxxxxxxx',
        T: 'x...x...x...x...',
        c: CRASH8,
      },
      dv: { h: 0.018, s: 0.2, k: 0.42, T: 0.32 },
      brkInst: 'whale', peakInst: 'supersaw',
    },
    // The Aqua awakens: a slow knightly hymn in E harmonic minor, choir and horn over the deep.
    aquaTheme: {
      bpm: 72, prog: 'Em C Am B Em C D B', key: 4, scale: SC.harmMin, noMod: true, ocean: true,
      parts: [
        { kind: 'bass', inst: 'wobble', pat: 'x-------x-------', vol: 0.18 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.05 },
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.03 },
        { kind: 'tone', inst: 'harp', oct: 1, pat: '0.2.4.2.0.2.4.6.', vol: 0.03 },
        {
          kind: 'tone', inst: 'horn', vol: 0.07,
          pat: ['4-------3---2---', '0---------------', '2---3---4---5---', '6---------------', '4-------5---7---', '6---4---2---0---', '1---2---3---4---', '6---------------'],
        },
      ],
      drums: { T: ['x.......x.......', 'x.......x...x.x.'], p: ['x...............', '', '', ''] },
      dv: { T: 0.4, p: 0.35 },
      brkInst: 'glass', peakInst: 'brass',
    },
    // The Aqua battle: heroic E harmonic minor march, staccato strings, brass lead and taiko.
    battle_aqua: {
      bpm: 162, prog: 'Em C D B Em C Am B', key: 4, scale: SC.harmMin, ocean: true,
      parts: [
        { kind: 'bass', inst: 'wobble', pat: 'x.xx.xx.x.xx.x.x', vol: 0.24, len: 0.7 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.03 },
        { kind: 'tone', inst: 'stacc', pat: '0.0.2.0.4.0.2.0.', vol: 0.035 },
        { kind: 'tone', inst: 'glass', oct: 1, pat: '0...4...2...6...', vol: 0.025 },
        {
          kind: 'tone', inst: 'brass', vol: 0.075,
          pat: ['4-3-2-1-0---6---', '0-------2---4---', '5-4-3-2-3---5---', '4---------------', '7-6-5-4-5---7---', '8-------7---6---', '5-4-3-2-1---6---', '7---------------'],
        },
        { kind: 'tone', inst: 'horn', oct: -1, vol: 0.04, pat: ['0---------------', '5---------------', '6---------------', '4---------------', '0---------------', '5---------------', '3---------------', '4---------------'] },
      ],
      drums: {
        k: ['x...x.x.x...x.x.', 'x...x.x.x.x.x.xx'],
        s: ['....x.......x...', '....x.......x.xx'],
        h: 'x.x.x.x.x.x.x.x.',
        T: ['x.......x.......', 'x...x...x.x.x.x.'],
        c: CRASH8,
      },
      dv: { h: 0.018, s: 0.18, T: 0.36 },
      brkInst: 'harp', peakInst: 'brass',
    },
    // The Aqua goes rogue: faster, distorted, a growling lead and supersaws over pounding drums.
    battle_aqua2: {
      bpm: 186, prog: 'Em C Am B Em C D B', key: 4, scale: SC.harmMin, ocean: true, drive: true,
      parts: [
        { kind: 'bass', inst: 'wobble', pat: 'x.xox.xox.xox.xo', vol: 0.26, len: 0.6 },
        { kind: 'pad', inst: 'supersaw', pat: 'x-------x-------', vol: 0.028 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.04 },
        { kind: 'tone', inst: 'stacc', oct: 1, pat: '0246024602460246', vol: 0.022, len: 0.5 },
        {
          kind: 'tone', inst: 'growl', vol: 0.07,
          pat: ['7-7-9-7-6-4-6-7-', '8---7---5---4---', '4-4-5-4-3-2-3-4-', '6---------------', '7-8-9-8-7-6-5-4-', '5---4---3---2---', '3-4-5-6-7-8-9---', '7---------------'],
        },
        { kind: 'tone', inst: 'horn', oct: -1, vol: 0.05, pat: ['0---------------', '5---------------', '3---------------', '4---------------', '0---------------', '5---------------', '6---------------', '4---------------'] },
      ],
      drums: {
        k: ['x.x...x.x.x...x.', 'x.x.x.x.x.x.x.xx'],
        s: ['....x.......x...', '....x..x....x.xx'],
        h: 'xxxxxxxxxxxxxxxx',
        T: 'x...x...x.x.x...',
        c: CRASH8,
      },
      dv: { h: 0.018, s: 0.2, k: 0.42, T: 0.32 },
      brkInst: 'growl', peakInst: 'supersaw',
    },
    // The Leviathan stirs: slow serpentine D phrygian dominant, low choir, creeping harp and a hissing horn.
    snakeTheme: {
      bpm: 76, prog: 'Dm Eb Dm C Dm Eb Bb A', key: 2, scale: SC.phrygDom, noMod: true, ocean: true,
      parts: [
        { kind: 'bass', inst: 'wobble', pat: 'x-----x---------', vol: 0.2 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.05 },
        { kind: 'tone', inst: 'harp', oct: 1, pat: '0.1.2.1.0.1.4.1.', vol: 0.025 },
        {
          kind: 'tone', inst: 'horn', vol: 0.065,
          pat: ['0-------1---0---', '2---------------', '4---3---1---0---', '1---------------', '0---1---2---4---', '5-------4---2---', '3---2---1---0---', '1---------------'],
        },
      ],
      drums: { T: ['x.....x.........', 'x.....x.....x.x.'], p: ['x...............', '', '', ''] },
      dv: { T: 0.45, p: 0.35 },
      brkInst: 'glass', peakInst: 'growl',
    },
    // The Leviathan battle: coiling phrygian dominant riff, staccato strings, brass and taiko.
    battle_leviathan: {
      bpm: 168, prog: 'Dm Eb Dm C Dm Eb Bb A', key: 2, scale: SC.phrygDom, ocean: true,
      parts: [
        { kind: 'bass', inst: 'wobble', pat: 'x.xx.x.xx.xx.x.x', vol: 0.25, len: 0.7 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.03 },
        { kind: 'tone', inst: 'stacc', pat: '0.1.0.2.0.1.0.4.', vol: 0.035 },
        {
          kind: 'tone', inst: 'brass', vol: 0.075,
          pat: ['0-1-2-1-0---4---', '1-------0---1---', '2-3-4-3-2---0---', '1---------------', '4-5-4-3-2---1---', '2-------1---0---', '3-2-1-0-1---2---', '1---------------'],
        },
        { kind: 'tone', inst: 'horn', oct: -1, vol: 0.04, pat: ['0---------------', '1---------------', '0---------------', '6---------------', '0---------------', '1---------------', '5---------------', '4---------------'] },
      ],
      drums: {
        k: ['x..x..x.x..x..x.', 'x..x..x.x.x.x.xx'],
        s: ['....x.......x...', '....x.......x.xx'],
        h: 'x.x.x.x.x.x.x.x.',
        T: ['x.....x.x.......', 'x..x..x.x.x.x.x.'],
        c: CRASH8,
      },
      dv: { h: 0.018, s: 0.18, T: 0.38 },
      brkInst: 'harp', peakInst: 'brass',
    },
    // Two heads: faster and distorted, growling lead and supersaws.
    battle_leviathan2: {
      bpm: 194, prog: 'Dm Eb Dm C Dm Eb Bb A', key: 2, scale: SC.phrygDom, ocean: true, drive: true,
      parts: [
        { kind: 'bass', inst: 'wobble', pat: 'x.xox.xox.xox.xo', vol: 0.27, len: 0.6 },
        { kind: 'pad', inst: 'supersaw', pat: 'x-------x-------', vol: 0.028 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.04 },
        { kind: 'tone', inst: 'stacc', oct: 1, pat: '0124012401240124', vol: 0.022, len: 0.5 },
        {
          kind: 'tone', inst: 'growl', vol: 0.07,
          pat: ['7-8-7-5-4-5-7-8-', '8---7---5---4---', '4-5-4-2-1-2-4-5-', '6---------------', '7-8-9-8-7-5-4-2-', '5---4---2---1---', '1-2-4-5-7-8-9---', '8---------------'],
        },
      ],
      drums: {
        k: ['x.x..xx.x.x..xx.', 'x.x.x.x.x.x.x.xx'],
        s: ['....x.......x...', '....x..x....x.xx'],
        h: 'xxxxxxxxxxxxxxxx',
        T: 'x..x..x.x.x.x...',
        c: CRASH8,
      },
      dv: { h: 0.018, s: 0.2, k: 0.42, T: 0.32 },
      brkInst: 'growl', peakInst: 'supersaw',
    },
    // The sunken island: a grand 6/8 anthem in G major. Wooden flute doubled by low horns, sweeping strings, sonar bells, timpani swells.
    turtleTheme: {
      bpm: 96, steps: 12, prog: 'G Em C D G Em Am D', key: 7, scale: SC.major, ocean: true,
      parts: [
        { kind: 'bass', inst: 'sine', pat: 'x-----x-----', vol: 0.32 },
        { kind: 'pad', inst: 'strings', pat: 'x-----------', vol: 0.05 },
        { kind: 'pad', inst: 'whale', pat: 'x-----------', vol: 0.035 },
        { kind: 'tone', inst: 'sonar', oct: 1, pat: '0.2.4.2.4.2.', vol: 0.05 },
        {
          kind: 'tone', inst: 'flute', oct: 1, vol: 0.08,
          pat: ['4---5-6-----', '5-----4-----', '2---3-4-----', '3-----------', '4---5-6---7-', '8-----7-----', '6---5---4---', '4-----------'],
        },
        {
          kind: 'tone', inst: 'horn', oct: -1, vol: 0.05,
          pat: ['4---5-6-----', '5-----4-----', '2---3-4-----', '3-----------', '4---5-6---7-', '8-----7-----', '6---5---4---', '4-----------'],
        },
      ],
      drums: { p: ['x...........', 'x...........', 'x.....x.....', 'x.....x.xxxx'], T: 'x...........', t: ['......x.....', '......x...x.'], c: CRASH8 },
      dv: { p: 0.36, T: 0.3, t: 0.14 },
      brkInst: 'bell', peakInst: 'brass',
    },
    // Island Turtle battle: an epic 6/8 tribal war march in A mixolydian. Thundering taiko and timpani, marimba ostinato,
    // plucked hero lead with a brass fanfare above it, low horns, strings and a distant choir.
    battle_turtle: {
      bpm: 172, steps: 12, prog: 'A G D A F G E E', key: 9, scale: SC.mixo, ocean: true,
      parts: [
        { kind: 'bass', inst: 'tri', pat: 'x..x.ox..x.o', vol: 0.36 },
        { kind: 'pad', inst: 'strings', pat: 'x-----x-----', vol: 0.045 },
        { kind: 'pad', inst: 'choir', pat: 'x-----------', vol: 0.025 },
        { kind: 'tone', inst: 'marimba', pat: '0.2.1.2.0.2.', vol: 0.13 },
        {
          kind: 'tone', inst: 'pluck', oct: 1, vol: 0.12,
          pat: ['0.2.4.5-4.2.', '4-----2-----', '5.4.2.4.5.7.', '7-----------', '7.8.7.5.4.2.', '4-----5-----', '2.4.5.4.2.1.', '0-----------'],
        },
        {
          kind: 'tone', inst: 'brass', vol: 0.065,
          pat: ['0-----------', '2-----------', '4-----5-----', '7-----------', '7-----------', '5-----4-----', '2-----4-----', '0-----------'],
        },
        { kind: 'tone', inst: 'horn', oct: -1, vol: 0.045, pat: ['0-----------', '6-----------', '3-----------', '0-----------', '5-----------', '6-----------', '4-----------', '4-----------'] },
        { kind: 'tone', inst: 'bell', oct: 2, vol: 0.025, pat: ['0-----------', '', '4-----------', '', '7-----------', '', '5-----------', '4-----------'] },
      ],
      drums: {
        k: 'x.....x.....',
        T: ['x.....x.x...', 'x..x..x.x.x.'],
        t: ['..x.x...x.xx', '..x.x..xx.x.'],
        p: ['x...........', 'x.....x.....', 'x...........', 'x.....x.xxxx'],
        h: 'xxxxxxxxxxxx',
        c: ['x...........', '', 'x...........', '', 'x...........', '', 'x...........', 'x.....x.....'],
      },
      dv: { T: 0.5, t: 0.22, p: 0.42, h: 0.022, k: 0.4 },
      brkInst: 'sonar', peakInst: 'brass',
    },
    // Rogue: the evil castle's pipe organ takes over. E harmonic minor, gothic organ lead doubled by low brass,
    // tremolo strings, a dark choir, and a pounding taiko-and-timpani gallop.
    battle_turtle2: {
      bpm: 190, steps: 12, prog: 'Em C Am B Em C D B', key: 4, scale: SC.harmMin, ocean: true, drive: true,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.xx.ox.xx.o', vol: 0.25, len: 0.6 },
        { kind: 'pad', inst: 'organ', pat: 'x-----x-----', vol: 0.045 },
        { kind: 'pad', inst: 'choir', pat: 'x-----------', vol: 0.04 },
        { kind: 'tone', inst: 'stacc', oct: 1, pat: '012012012012', vol: 0.022, len: 0.5 },
        {
          kind: 'tone', inst: 'organ', oct: 1, vol: 0.08,
          pat: ['7-6-5-4-3-2-', '4-----------', '5-4-3-2-1-0-', '6-----------', '7-8-9-8-7-6-', '5---4---3---', '4-5-6-7-8-9-', '7-----------'],
        },
        {
          kind: 'tone', inst: 'brass', oct: -1, vol: 0.05,
          pat: ['7-----3-----', '4-----------', '5-----1-----', '6-----------', '7-----6-----', '5---4---3---', '4-----7-----', '7-----------'],
        },
      ],
      drums: {
        k: 'x..x..x..x..',
        T: ['x..x..x.x.x.', 'x..x..x.xxxx'],
        t: '..x...x.xxxx',
        p: ['x.....x.....', 'x.....x.....', 'x.....x.....', 'x..x..xxxxxx'],
        h: 'xxxxxxxxxxxx',
        c: ['x...........', '', 'x...........', '', 'x...........', '', 'x...........', 'x..x..x.....'],
      },
      dv: { T: 0.52, t: 0.24, p: 0.45, k: 0.46, h: 0.02 },
      brkInst: 'bell', peakInst: 'choir',
    },
    // The Megalodon: a creeping two-note shark ostinato in D phrygian that tightens bar by bar, low brass, whale moans.
    megTheme: {
      bpm: 84, prog: 'Dm Eb Dm Eb Bb C Dm Eb', key: 2, scale: SC.phrygian, ocean: true, noMod: true,
      parts: [
        { kind: 'tone', inst: 'bass', oct: -1, pat: '0.......1.......', vol: 0.3, len: 0.8 },
        { kind: 'tone', inst: 'bass', oct: -1, pat: ['', '', '0...1...0...1...', '0...1...0...1...', '0.1.0.1.0.1.0.1.', '0.1.0.1.0.1.0.1.', '0101010101010101', '0101010101010101'], vol: 0.22, len: 0.5 },
        { kind: 'pad', inst: 'whale', pat: 'x---------------', vol: 0.04 },
        { kind: 'pad', inst: 'strings', pat: 'x-------x-------', vol: 0.04 },
        { kind: 'tone', inst: 'brass', oct: -1, vol: 0.06, pat: ['0---------------', '', '1-------0-------', '', '5---------------', '6---------------', '0-------1-------', '0---------------'] },
        { kind: 'tone', inst: 'sonar', oct: 1, pat: '4.......7.......', vol: 0.03 },
      ],
      drums: { T: ['x...............', 'x.......x.......'], p: ['', '', '', 'x...........x.x.'] },
      dv: { T: 0.4, p: 0.35 },
      brkInst: 'glass', peakInst: 'horn',
    },
    // Megalodon battle: a deep-sea surf-rock chase in B dorian. Tremolo-picked surf lead, galloping surf bass,
    // marimba ripples, whale-song pad and a low horn answer over a driving surf beat.
    battle_megalodon: {
      bpm: 176, prog: 'Bm A Bm A G A F# F#', key: 11, scale: SC.dorian, ocean: true, drive: true,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.x.o.x.x.x.o.5.', vol: 0.26, len: 0.5 },
        { kind: 'pad', inst: 'whale', pat: 'x-------x-------', vol: 0.035 },
        { kind: 'tone', inst: 'marimba', oct: 1, pat: '0.2.1.2.0.2.1.2.', vol: 0.05 },
        {
          kind: 'tone', inst: 'pluck', vol: 0.09,
          pat: ['4444444466665555', '4444.3.2111.....', '4444444477776666', '5555.4.36666....', '2222222244443333', '1111.2.34444....', '4.4.6.7.8.7.6.4.', '4444444455556666'],
        },
        { kind: 'tone', inst: 'horn', oct: -1, vol: 0.05, pat: ['0---------------', '6---------------', '0---------------', '6---------------', '2---------------', '1---------------', '4-------4-4-4---', '4---------------'] },
      ],
      drums: {
        k: 'x.....x.x.....x.',
        s: ['....x.......x...', '....x.......x.xx'],
        h: 'x.xxx.xxx.xxx.xx',
        T: ['', '', '', '............xxxx'],
        c: ['x...............', '', '', '', 'x...............', '', '', ''],
      },
      dv: { k: 0.42, s: 0.26, h: 0.018, T: 0.38 },
      brkInst: 'marimba', peakInst: 'horn',
    },
    // Rogue: the same surf riff turns monstrous. B aeolian with a Neapolitan C, 12/8 gallop, growling chord stabs,
    // screaming supersaw tremolo lead, dark choir and whale pad.
    battle_megalodon2: {
      bpm: 200, steps: 12, prog: 'Bm C Bm A G C F# F#', key: 11, scale: SC.aeolian, ocean: true, drive: true,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x..x..x.ox..', vol: 0.26, len: 0.6 },
        { kind: 'tone', inst: 'growl', oct: -1, pat: '0..0..0..0.1', vol: 0.12, len: 0.5 },
        { kind: 'pad', inst: 'choir', pat: 'x-----------', vol: 0.045 },
        { kind: 'pad', inst: 'whale', pat: 'x-----x-----', vol: 0.03 },
        { kind: 'tone', inst: 'marimba', oct: 1, pat: '012102012102', vol: 0.04 },
        {
          kind: 'tone', inst: 'supersaw', oct: 1, vol: 0.045,
          pat: ['444444666555', '4444.3.2111.', '444444777666', '8888.7.6444.', '777777999888', '7777.6.5444.', '5555.7.9.7..', '444488884444'],
        },
        { kind: 'tone', inst: 'horn', oct: -1, vol: 0.05, pat: ['0-----2-----', '2-----------', '3-----5-----', '4-----------', '7-----9-----', '9-----------', '9-----8-----', '8-----------'] },
      ],
      drums: {
        k: 'x..x.xx..x.x',
        s: ['...x.....x..', '...x.....xxx'],
        h: 'xxxxxxxxxxxx',
        T: ['x.....x.....', 'x.....x.x.xx'],
        c: ['x...........', '', 'x...........', '', 'x...........', '', 'x...........', 'x..x..x.....'],
      },
      dv: { k: 0.46, s: 0.26, h: 0.018, T: 0.45 },
      brkInst: 'glass', peakInst: 'choir',
    },
    // The Kraken's wreck: a drowned sailors' dirge in 6/8, Eb dorian. Wheezing organ, a ghostly sine
    // theremin melody, slow plucked rigging and a ship's bell tolling from the deep.
    krakenTheme: {
      bpm: 66, steps: 12, prog: 'Ebm Ebm Ab Ebm Gb Db Ab Bbm', key: 3, scale: SC.dorian, ocean: true, noMod: true,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.....x..5..', vol: 0.24 },
        { kind: 'pad', inst: 'organ', pat: 'x-----------', vol: 0.035 },
        { kind: 'tone', inst: 'pluck', pat: '0..1..2..1..', vol: 0.03 },
        { kind: 'tone', inst: 'sine', oct: 1, vol: 0.05, pat: ['4-----3-2---', '0-----------', '5-----4-3---', '3-----------', '2-----3-4---', '6-----5-----', '5-----4-3---', '4-----------'] },
        { kind: 'tone', inst: 'bell', vol: 0.035, pat: ['0-----------', '', '', '', '0-----------', '', '', '4-----------'] },
      ],
      drums: { p: ['x...........', '', 'x.....x.....', ''], h: '...x.....x..' },
      dv: { p: 0.32, h: 0.015 },
      brkInst: 'harp', peakInst: 'strings',
    },
    // Kraken battle: a frantic tarantella in G# harmonic minor. Accordion-style organ lead, harp arpeggios,
    // oom-pah afterbeat stabs and a rattling tambourine over taiko.
    battle_kraken: {
      bpm: 184, steps: 12, prog: 'G#m C#m G#m D#7 G#m E C#m D#7', key: 8, scale: SC.harmMin, ocean: true, drive: true,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x..5..x..5..', vol: 0.26, len: 0.5 },
        { kind: 'tone', inst: 'organ', pat: '...0.....1..', vol: 0.03, len: 0.3 },
        { kind: 'tone', inst: 'harp', oct: 1, pat: '012012012012', vol: 0.035 },
        { kind: 'pad', inst: 'strings', pat: 'x-----------', vol: 0.03 },
        {
          kind: 'tone', inst: 'organ', oct: 1, vol: 0.07, len: 0.6,
          pat: ['4.3.4.3.2.1.', '3.2.3.2.1.0.', '4.3.4.5.6.7.', '6.5.4.6-----', '7.6.7.6.5.4.', '5.4.5.4.3.2.', '3.4.5.3.2.1.', '2.1.6.4-----'],
        },
      ],
      drums: {
        T: 'x.....x.....', k: 'x.....x.....', h: 'xxxxxxxxxxxx',
        s: ['......x.....', '......x...xx'], p: ['', '', '', 'x.....x.x.x.'],
        c: ['x...........', '', '', '', 'x...........', '', '', ''],
      },
      dv: { T: 0.4, k: 0.38, h: 0.02, s: 0.2, p: 0.35 },
      brkInst: 'bell', peakInst: 'brass',
    },
    // Ink rogue: the tarantella motif turns to chip-metal in G# phrygian dominant, straight 4/4 at 208.
    // Saw power bass, square-wave shred lead, sonar pings and choir.
    battle_kraken2: {
      bpm: 208, prog: 'G#5 B5 A5 G#5 E5 F#5 A5 G#5', key: 8, scale: SC.phrygDom, ocean: true, drive: true,
      parts: [
        { kind: 'bass', inst: 'saw', pat: 'x.xxx.xxx.xxx.xo', vol: 0.2, len: 0.5 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.045 },
        { kind: 'tone', inst: 'sonar', oct: 1, pat: '0.......1.......', vol: 0.025 },
        {
          kind: 'tone', inst: 'square', oct: 1, vol: 0.06, len: 0.7,
          pat: ['4.3.4.3.2.1.0...', '1.0.1.2.3-------', '4.3.4.5.6.7.8...', '7.6.5.4.3-------', '7.6.7.6.5.4.3...', '5.4.5.4.3.2.1...', '3.4.5.3.2.1.0.1.', '0---------------'],
        },
      ],
      drums: {
        k: 'x.xxx.xxx.xxx.xx', s: '....x.......x...', h: '.x.x.x.x.x.x.x.x',
        T: ['', '', '', '............xxxx'], c: CRASH8,
      },
      dv: { k: 0.46, s: 0.26, h: 0.02, T: 0.4 },
      brkInst: 'sonar', peakInst: 'choir',
    },
    // The abyssal temple: a sleeping god's breathing. Bb aeolian, very slow, glass-harmonica motif over
    // whale-song and a hushed choir, with a low horn calling from far below and a single timpani heartbeat.
    abyssTheme: {
      bpm: 58, prog: 'Bbm Gb Db Ab Bbm Gb Eb F', key: 10, scale: SC.aeolian, ocean: true, noMod: true,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x---------------', vol: 0.22 },
        { kind: 'pad', inst: 'whale', pat: 'x---------------', vol: 0.04 },
        { kind: 'pad', inst: 'choir', pat: ['x---------------', '', 'x---------------', '', 'x---------------', '', 'x---------------', 'x-------x-------'], vol: 0.03 },
        { kind: 'tone', inst: 'glass', oct: 1, pat: ['0...2...4...', '', '', ''].map((p) => p.padEnd(16, '.')), vol: 0.035 },
        { kind: 'tone', inst: 'horn', oct: -1, vol: 0.05, pat: ['4-------3-------', '2---------------', '4-------5-------', '6-------5---4---', '4-------2-------', '1---------------', '2-------3---1---', '0---------------'] },
      ],
      drums: { p: ['x...............', '', 'x.......x.......', ''] },
      dv: { p: 0.3 },
      brkInst: 'sonar', peakInst: 'strings',
    },
    // Leviathan, the Abyssal God: an ancient war-hymn in F# harmonic minor. Galloping low strings,
    // a heroic brass line, cathedral choir, bells and thundering taiko under a timpani roll.
    battle_abyssGod: {
      bpm: 168, prog: 'F#m D Bm C#7 F#m E D C#7', key: 6, scale: SC.harmMin, ocean: true, drive: true,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.xox.xox.xox.xo', vol: 0.24, len: 0.5 },
        { kind: 'tone', inst: 'stacc', pat: '0202420202424202', vol: 0.032 },
        { kind: 'pad', inst: 'choir', pat: 'x-------x-------', vol: 0.04 },
        {
          kind: 'tone', inst: 'brass', vol: 0.085,
          pat: ['4-----5-6---4---', '2-----------1-0-', '3-----4-5---3---', '6-------7-------', '4-----5-6---8---', '7---6---5-------', '2---3---4---5---', '6---------------'],
        },
        { kind: 'tone', inst: 'bell', oct: 1, pat: ['0.......', '', '0.......', '4.......'].map((p) => p.padEnd(16, '.')), vol: 0.03 },
      ],
      drums: {
        T: 'x.....x...x.....', k: 'x.......x.......', s: '....x.......x...',
        p: ['', '', '', 'x.x.x.x.xxxxxxxx'], c: CRASH8,
      },
      dv: { T: 0.42, k: 0.4, s: 0.2, p: 0.35 },
      brkInst: 'harp', peakInst: 'horn',
    },
    // God of the Endless Abyss: the war-hymn's opening rise twisted into C# phrygian, 12/8 at 192.
    // Growling bass, screaming supersaw lead, organ stabs, choir and whale moans over a pounding gallop.
    battle_abyssGod2: {
      bpm: 192, steps: 12, prog: 'C#m D C#m B A D B C#m', key: 1, scale: SC.phrygian, ocean: true, drive: true,
      parts: [
        { kind: 'tone', inst: 'growl', oct: -1, pat: '0..0.00..0.1', vol: 0.12, len: 0.5 },
        { kind: 'tone', inst: 'organ', pat: '.0..1..0..1.', vol: 0.03, len: 0.3 },
        { kind: 'pad', inst: 'choir', pat: 'x-----------', vol: 0.045 },
        { kind: 'pad', inst: 'whale', pat: 'x-----x-----', vol: 0.03 },
        {
          kind: 'tone', inst: 'supersaw', oct: 1, vol: 0.045,
          pat: ['4..5..6.....', '6.5.4.1.....', '3..4..5.....', '7-----8-----', '8.7.6.5.4.3.', '4..1..2.....', '3.4.5.6.7.8.', '7-----------'],
        },
      ],
      drums: {
        k: 'x..x..x..x.x', T: ['x.....x.....', 'x.....x.xxxx'], s: '...x.....x..', h: 'x.xx.xx.xx.x',
        c: ['x...........', '', 'x...........', '', 'x...........', '', 'x...........', 'x..x..x..x..'],
      },
      dv: { k: 0.46, T: 0.45, s: 0.24, h: 0.018 },
      brkInst: 'glass', peakInst: 'choir',
    },
    // The god goes insane: A phrygian dominant at 222. Wall-to-wall taiko and timpani, double kick,
    // a tortured horn line, growl bass, sonar pings and whale screams from the abyss.
    battle_abyssGod3: {
      bpm: 222, prog: 'A Bb A Gm A Bb Dm A', key: 9, scale: SC.phrygDom, ocean: true, drive: true,
      parts: [
        { kind: 'tone', inst: 'growl', oct: -1, pat: '0.000.000.000.01', vol: 0.13, len: 0.5 },
        { kind: 'pad', inst: 'whale', pat: 'x-------x-------', vol: 0.045 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.05 },
        { kind: 'tone', inst: 'sonar', oct: 1, pat: '0...1...0...7...', vol: 0.028 },
        {
          kind: 'tone', inst: 'horn', vol: 0.09,
          pat: ['0-1-0-------4---', '5-4-1-----------', '0-1-0-------6---', '7-6-5-4---------', '4-5-4-------8---', '7-6-4-----------', '5-6-7-8-9-8-7-6-', '4---------------'],
        },
      ],
      drums: {
        k: 'x.xxx.xxx.xxx.xx', T: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', p: ['x...x...x...x...', 'x.x.x.x.x.x.x.x.'],
        c: ['x...............', 'x...............', 'x...............', 'x.......x.......'],
      },
      dv: { k: 0.48, T: 0.4, s: 0.26, p: 0.32 },
      brkInst: 'sonar', peakInst: 'supersaw',
    },
    // The Luke Trial: frantic E-minor chiptune at 176 with a jittery square lead and a pumping octave bass.
    lukeParkour: {
      bpm: 176, prog: 'Em C D B Em C Am B7', key: 4, scale: SC.harmMin,
      parts: [
        { kind: 'bass', inst: 'square', pat: 'xoxoxoxoxoxoxoxo', vol: 0.12, len: 0.45 },
        { kind: 'tone', inst: 'tri', pat: '0.1.2.1.0.1.2.3.', oct: 1, vol: 0.05, len: 0.5 },
        {
          kind: 'tone', inst: 'square', oct: 1, vol: 0.05, len: 0.7,
          pat: ['4.4.5.4.3.2.1.0.', '2-3-4-----------', '5.5.6.5.4.3.2.1.', '6---4---6-------', '7.7.8.7.6.5.4.3.', '4-5-6-----------', '3.4.5.6.7.6.5.4.', '6-------7-------'],
        },
      ],
      drums: { k: 'x...x...x...x..x', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', c: CRASH8 },
      dv: { h: 0.02, s: 0.2 },
      brkInst: 'marimba', peakInst: 'supersaw',
    },
    lament: {
      bpm: 60, prog: 'Fm Db Bbm C', glitch: true, noMod: true,
      parts: [
        { kind: 'pad', inst: 'strings', pat: 'x---------------', vol: 0.05 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.03 },
        { kind: 'tone', inst: 'harp', pat: '0.2.4.2.0.2.4.2.', vol: 0.03 },
        { kind: 'tone', inst: 'flute', oct: 1, vol: 0.06, pat: ['4-------3---2---', '1---------------', '2-------3-------', '2---------------'] },
      ],
    },
    // Circus polka: oom-pah tuba bass, calliope organ lead, silly chromatic-ish runs.
    battle_joker: {
      bpm: 184, prog: 'C G C G F C G C',
      parts: [
        { kind: 'bass', inst: 'tri', pat: 'x...5...x...5...', vol: 0.34, len: 0.5 },
        { kind: 'tone', inst: 'organ', pat: '..0...1...0...1.', vol: 0.05, len: 0.4 },
        {
          kind: 'tone', inst: 'organ', oct: 1, vol: 0.06, len: 0.6,
          pat: ['4321234-4321234-', '5-4-3-2-1-------', '4321234-4321234-', '5-6-7-----------', '6543456-6543456-', '4-3-2-1-0-------', '4-4-5-5-6-6-7---', '7---0-----------'],
        },
        { kind: 'tone', inst: 'bell', oct: 1, vol: 0.03, pat: '0.......2.......' },
      ],
      drums: { k: 'x.......x.......', s: '....x.......x...', o: '..x...x...x...x.', c: CRASH8 },
      dv: { s: 0.14, o: 0.045 },
    },
    // Forest jig in 6/8: bodhran drum, plucked lute, nimble Dorian flute like an outlaw's tune.
    battle_archer: {
      bpm: 204, steps: 12, prog: 'Dm C G Dm F C G A', key: 2, scale: SC.dorian,
      parts: [
        { kind: 'bass', inst: 'tri', pat: 'x..o..x..o..', vol: 0.32 },
        { kind: 'tone', inst: 'pluck', pat: '0.1.2.0.1.2.', vol: 0.05 },
        {
          kind: 'tone', inst: 'flute', oct: 1, vol: 0.085,
          pat: ['4.3.2.4.3.2.', '1.2.3.4-----', '4.3.2.4.5.6.', '7-----4-----', '6.5.4.6.5.4.', '3.4.5.6-----', '4.5.6.7.6.5.', '4-----------'],
        },
        { kind: 'tone', inst: 'harp', vol: 0.04, pat: ['0-----2-----', '1-----------', '3-----------', '0-----------', '2-----------', '1-----------', '3-----------', '4-----------'] },
      ],
      drums: { T: 'x.....x.....', t: '...x.x...x.x', h: 'x.x.x.x.x.x.', c: CRASH8 },
      dv: { T: 0.36, t: 0.15, h: 0.022 },
    },
    // Divine judgement in 6/8: cathedral organ, choir, chiming bells, rolling timpani, harmonic minor.
    battle_lightGods: {
      bpm: 150, steps: 12, prog: 'Cm Ab Fm G Cm Ab Db G', key: 0, scale: SC.harmMin,
      parts: [
        { kind: 'bass', inst: 'bass', pat: 'x.....x.....', vol: 0.26 },
        { kind: 'pad', inst: 'organ', pat: 'x-----------', vol: 0.06 },
        { kind: 'pad', inst: 'choir', pat: 'x-----------', vol: 0.05 },
        { kind: 'tone', inst: 'bell', oct: 1, pat: '0..1..2..1..', vol: 0.045 },
        {
          kind: 'tone', inst: 'brass', vol: 0.09,
          pat: ['4-----3-2---', '2-----0-----', '4-----5-6---', '4-----------', '7-----6-5---', '6-----5-4---', '5-----3-2---', '1-----------'],
        },
      ],
      drums: { T: 'x.....x.....', k: 'x.....x..x..', h: '..x..x..x..x', p: ['', '', '', 'x.x.x.xxxxxx'], c: CRASH8 },
      dv: { T: 0.4, h: 0.022, k: 0.4 },
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
    // The final boss: a cathedral-metal anthem in Eb harmonic minor. Organ and choir over a wobble-bass gallop,
    // a staccato saw ostinato, a soaring supersaw lead doubled by choir at the peak, taiko hits and timpani rolls.
    // The form skips the breakdown (main / variation / peak) so the key-change climax lands inside the 30s fight.
    finalBoss: {
      bpm: 182, prog: 'Ebm B Gb Bb Ebm Abm B Bb7', key: 3, scale: SC.harmMin, drive: true, form: ['A', 'B', 'P'],
      parts: [
        { kind: 'bass', inst: 'wobble', pat: 'x.oxx.oxx.oxx.ox', vol: 0.12, len: 0.55 },
        { kind: 'bass', inst: 'sine', pat: 'x-------x-------', vol: 0.2 },
        { kind: 'pad', inst: 'organ', pat: 'x-------x-------', vol: 0.045 },
        { kind: 'pad', inst: 'choir', pat: 'x---------------', vol: 0.06 },
        { kind: 'tone', inst: 'stacc', pat: '0120312041203120', vol: 0.04, len: 0.5 },
        { kind: 'tone', inst: 'bell', oct: 1, pat: '0.......2.......', vol: 0.025 },
        {
          kind: 'tone', inst: 'supersaw', vol: 0.1,
          pat: ['7---6-7-4-------', '5-----7---9-----', '9-8-7-8-9---7---', '8-----6---4-----', '4-7-9---7---4---', '3-5-7---5---3---', '5-7-9---9-8-7-5-', '8---6---4-------'],
        },
        { kind: 'tone', inst: 'brass', oct: -1, vol: 0.06, pat: ['', '', '', '', '4-------5-------', '3-------7-------', '5-------7-------', '6-------4-------'] },
      ],
      drums: {
        k: ['x..x..x.x..x..x.', 'x..x..x.x..x..x.', 'x..x..x.x..x..x.', 'x..x..x.x.xxxxxx'],
        s: ['....x.......x...', '....x.......x..x', '....x.......x...', '....x...x.x.xxxx'],
        h: 'x.xxx.xxx.xxx.xx',
        T: ['x...............', '', 'x.......x.......', ''],
        p: ['', '', '', '', '', '', '', 'x...x...x.x.xxxx'],
        c: CRASH8,
      },
      dv: { k: 0.55, s: 0.26, h: 0.03, T: 0.4, p: 0.3 },
      peakInst: 'choir',
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

  // Every track loops through main / variation / breakdown / peak sections so no area repeats one loop forever.
  const FORM = ['A', 'B', 'C', 'P'];
  const BRK_KICK = { 16: 'x.......x.......', 12: 'x.....x.....' };
  const BRK_HAT = { 16: '..x...x...x...x.', 12: '..x..x..x..x' };
  const BRK_BASS = { 16: 'x-------x-------', 12: 'x-----x-----' };
  const hashA = (n) => {
    const v = Math.sin(n * 91.345 + 47.853) * 43758.5453;
    return v - Math.floor(v);
  };
  const ARP_RHY = ['x.x.x.x.x.x.x.x.', 'x..x..x.x..x..x.', 'xx.x.xx.xx.x.xx.', 'x.xxx.x.x.xxx.x.', 'x...x.x.x...x.x.', 'x.x..x.xx.x..x.x', 'xxx.x.x.xxx.x.x.'];
  function seedOf(name) {
    let h = 7;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 100003;
    return h;
  }
  function genArp(seed, k, steps = 16) {
    const rhy = ARP_RHY[Math.floor(hashA(seed + k * 13.1) * ARP_RHY.length)];
    let deg = Math.floor(hashA(seed * 1.7 + k) * 3), out = '';
    for (let i = 0; i < steps; i++) {
      if (rhy[i] !== 'x') {
        out += '.';
        continue;
      }
      out += deg;
      deg = Math.max(0, Math.min(5, deg + [-2, -1, 1, 1, 2, -1, 3][Math.floor(hashA(seed + k * 7 + i * 3.3) * 7)]));
    }
    return out;
  }
  function varyLead(str, seed) {
    let out = '';
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (c >= '0' && c <= '9' && hashA(seed + i * 5.7) < 0.4) out += Math.max(0, Math.min(8, +c + (hashA(seed + i * 2.3) < 0.5 ? 1 : -1)));
      else out += c;
    }
    return out;
  }
  function arrange(name, d) {
    const seed = seedOf(name);
    const arps = [0, 1, 2].map((k) => genArp(seed, k, d.steps || 16));
    const leadVar = d.parts.map((p, pi) => (Array.isArray(p.pat) ? p.pat.map((s, i) => varyLead(s, seed + pi * 17 + i * 31)) : null));
    return { seed, arps, leadVar };
  }

  function playStep(c, step, t) {
    const d = c.def, sd = c.sd, out = c.bus, ar = c.ar;
    const S = d.steps || 16;
    const bar = Math.floor(step / S), s = step % S;
    if (d.swing && s % 2 === 1) t += d.swing * sd;
    const nb = d.chords.length, lb = bar % nb;
    const sec = (d.form || FORM)[Math.floor(bar / nb) % (d.form || FORM).length];
    const lastBar = lb === nb - 1;
    const tr = sec === 'P' && !d.noMod ? 2 : 0;
    const ch = d.chords[lb];
    const cb = 60 + ch.r - (ch.r > 7 ? 12 : 0) + tr;
    const glitchy = !!d.glitch;
    if (d.drums) {
      for (const k in d.drums) {
        let str = pick(d.drums[k], bar);
        if (sec === 'C') str = k === 'k' ? BRK_KICK[S] : k === 'h' ? BRK_HAT[S] : null;
        if (str && str[s] === 'x') DRUM[k](t, (d.dv && d.dv[k]) || DRUM_VOL[k], out);
      }
      if (sec === 'C' && lastBar) {
        if (s >= 4) snare(t, 0.04 + s * 0.012, out);
        if (s === 0) noise(t, sd * S, 0.07, 'bandpass', 300, 6000, out, 2, sd * (S - 2));
      } else if (lastBar && s >= S - 4 && sec !== 'C') {
        snare(t, 0.12 + (s - S + 4) * 0.03, out);
        if (s >= S - 2) tom(t, 0.2, out);
      }
      if (sec === 'P') {
        if (s === 0 && lb % 2 === 0) crash(t, 0.11, out);
        if (s % 2 === 1 && d.drums.h) hat(t, 0.025, out);
        if (s === 0 && lb === 0) kick(t, 0.6, out);
      }
    }
    d.parts.forEach((p, pi) => {
      const lead = p.kind === 'tone' && Array.isArray(p.pat);
      const arp = p.kind === 'tone' && !lead;
      let str = pick(p.pat, bar), inst = p.inst, vol = p.vol;
      if (sec === 'B') {
        if (lead) str = pick(ar.leadVar[pi], bar);
        else if (arp) str = ar.arps[0];
      } else if (sec === 'C') {
        if (lead) {
          str = ar.arps[1];
          inst = d.brkInst || (glitchy ? 'tri' : 'harp');
          vol *= 0.8;
        } else if (arp) str = null;
        else if (p.kind === 'bass') str = BRK_BASS[S];
      } else if (sec === 'P' && arp) {
        str = ar.arps[2];
      }
      if (!str) return;
      const sym = str[s];
      const oct = 12 * (p.oct || 0);
      let notes = null;
      if (p.kind === 'bass') {
        const off = { x: 0, o: 12, 5: 7, 3: ch.iv[1] }[sym];
        if (off !== undefined) notes = [36 + ch.r - (ch.r > 6 ? 12 : 0) + oct + off + tr];
      } else if (p.kind === 'pad') {
        if (sym === 'x') notes = ch.iv.slice(0, 4).map((v) => cb + oct + v);
      } else if (sym >= '0' && sym <= '9') {
        const i = +sym;
        if (lead && d.scale) {
          const n = d.scale.length;
          notes = [60 + d.key - (d.key > 7 ? 12 : 0) + tr + oct + d.scale[i % n] + 12 * Math.floor(i / n)];
        } else {
          const n = ch.iv.length;
          notes = [cb + oct + ch.iv[i % n] + 12 * Math.floor(i / n)];
        }
      }
      if (!notes) return;
      const dur = holds(str, s) * sd * (p.len || 0.9);
      for (const m of notes) {
        voice(inst, m, t, dur, vol, out);
        if (lead && sec === 'P') voice(d.peakInst || (glitchy ? 'square' : 'brass'), m + 12, t, dur, vol * 0.4, out);
        if (lead && (sec === 'A' || sec === 'B') && hashA(ar.seed + step * 1.7) < 0.08) voice('bell', m + 12, t + sd * 0.5, sd * 0.5, vol * 0.35, out);
        if (glitchy && hashA(ar.seed * 3 + step * 1.31 + pi) < (sec === 'P' ? 0.1 : 0.05)) {
          for (let r = 1; r <= 3; r++) voice(inst, m + (r === 3 ? 12 : 0), t + (r * sd) / 4, sd / 5, vol * Math.pow(0.7, r), out);
        }
      }
    });
    if (glitchy) {
      if (rnd() < (sec === 'P' ? 0.08 : 0.04)) sweep('square', 200 + rnd() * 2000, 100 + rnd() * 3000, t, sd * 0.6, 0.022, out);
      if (s % 4 === 2 && hashA(ar.seed + step * 0.77) < 0.035) {
        c.gate.gain.setValueAtTime(0.0001, t);
        c.gate.gain.setValueAtTime(1, t + sd * 0.85);
      }
      if (s === 0 && lb === 0 && sec === 'P') noise(t, 0.25, 0.08, 'bandpass', 4000, 300, out, 3);
    }
    if (d.ocean) {
      if (s === 0 && bar % 2 === 0) {
        const ping = 60 + d.key + 24 + (sec === 'P' ? 7 : 0);
        voice('sonar', ping, t, 1, 0.035, out);
        voice('sonar', ping, t + sd * 6, 1, 0.014, out);
      }
      if (hashA(ar.seed + step * 2.13) < 0.05) {
        const f = 260 + hashA(step * 1.7) * 500;
        sweep('sine', f, f * 3.5, t, 0.07, 0.018, out);
      }
      if (s === 0 && lb === 0) noise(t, sd * 12, 0.03, 'bandpass', 200, 900, out, 1.5, sd * 6);
    }
  }

  function makeCrusher(levels, pre = 1.5) {
    const input = ctx.createGain();
    input.gain.value = pre;
    const sh = ctx.createWaveShaper();
    const n = 4096, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.round(x * levels) / levels;
    }
    sh.curve = curve;
    const output = ctx.createGain();
    output.gain.value = 1 / pre;
    input.connect(sh).connect(output);
    return { input, output };
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
      if (cur.lfo) cur.lfo.stop(now + 0.4);
      cur = null;
    }
    const def = name && TRACKS[name];
    if (!def) return;
    const start = ctx.currentTime + 0.35;
    const bus = ctx.createGain();
    const gate = ctx.createGain();
    let oceanLfo = null;
    if (def.ocean) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3000;
      lp.Q.value = 2;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08;
      const lg = ctx.createGain();
      lg.gain.value = 1800;
      lfo.connect(lg).connect(lp.frequency);
      lfo.start();
      bus.connect(lp).connect(gate);
      oceanLfo = lfo;
    } else {
      bus.connect(gate);
    }
    let tail = gate;
    if (def.drive) {
      const sh = ctx.createWaveShaper();
      const n = 2048, curve = new Float32Array(n);
      for (let i = 0; i < n; i++) curve[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * 2.2) / Math.tanh(2.2);
      sh.curve = curve;
      gate.connect(sh);
      tail = sh;
    }
    if (def.glitch) {
      const cr = makeCrusher(10);
      tail.connect(cr.input);
      cr.output.connect(musicBus);
    } else {
      tail.connect(musicBus);
    }
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.setValueAtTime(0.0001, start);
    bus.gain.linearRampToValueAtTime(1, start + 0.3);
    if (!def.ar) def.ar = arrange(name, def);
    cur = { name, def, bus, gate, ar: def.ar, step: 0, next: start, sd: 60 / def.bpm / 4, lfo: oceanLfo };
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
      if (who === 'LEVIATHAN') {
        const f = 36 + rnd() * 10;
        sweep('sine', f, f * 0.8, t, 0.16, 0.12, sfxBus);
        sweep('triangle', f * 1.5, f * 1.2, t, 0.14, 0.05, sfxBus);
        sweep('sine', f * 6, f * 5.4, t, 0.12, 0.012, sfxBus);
        noise(t, 0.14, 0.07, 'bandpass', 180 + rnd() * 80, 320, sfxBus, 4);
        return;
      }
      if (who === 'KRAKEN') {
        const f = 44 + rnd() * 16;
        sweep('sawtooth', f, f * 0.7, t, 0.11, 0.075, sfxBus);
        sweep('sine', f * 2.02, f * 1.4, t, 0.1, 0.05, sfxBus);
        noise(t, 0.1, 0.09, 'bandpass', 240 + rnd() * 120, 500, sfxBus, 3);
        return;
      }
      if (who === 'MEGALODON') {
        const f = 62 + rnd() * 22;
        sweep('sawtooth', f, f * 0.85, t, 0.08, 0.07, sfxBus);
        sweep('square', f * 0.5, f * 0.45, t, 0.08, 0.04, sfxBus);
        noise(t, 0.08, 0.07, 'lowpass', 380, 140, sfxBus);
        return;
      }
      const f = {
        MONKEY: 1000 + rnd() * 400, ANGEL: 1100, 'SKY BIRD': 1350 + rnd() * 250, 'LIGHT OF GODS': 200, KNIGHT: 330, ARCHER: 760, JOKER: 500 + rnd() * 700, KING: 200,
        MECHANIC: 280 + rnd() * 60, ALIEN: 1200 + rnd() * 900, CAPTAIN: 170 + rnd() * 40,
        'BROKEN MECH': rnd() < 0.2 ? 900 + rnd() * 900 : 110 + rnd() * 50,
        '???': 70 + rnd() * 30, 'THOUSAND FORGER': rnd() < 0.15 ? 600 + rnd() * 600 : 80 + rnd() * 30,
        'THE MEGA EATER': 60 + rnd() * 25, PILOT: 380 + rnd() * 60,
      }[who] || 620;
      const w = ['LIGHT OF GODS', 'KING', 'MECHANIC', 'CAPTAIN', 'BROKEN MECH', '???', 'THOUSAND FORGER', 'THE MEGA EATER'].includes(who) ? 'sawtooth' : who === 'ANGEL' ? 'sine' : 'square';
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
    mpunch(t) {
      sweep('square', 300, 900, t, 0.12, 0.04, sfxBus);
      noise(t + 0.15, 0.2, 0.15, 'bandpass', 600, 2400, sfxBus, 1);
    },
    imp_mpunch(t) {
      kick(t, 0.7, sfxBus);
      noise(t, 0.12, 0.3, 'bandpass', 3500, 1500, sfxBus, 3);
      sweep('square', 1600, 1200, t, 0.08, 0.04, sfxBus);
    },
    ray: (t) => sweep('sine', 300, 2200, t, 0.5, 0.06, sfxBus),
    rayFire(t) {
      sweep('sawtooth', 1800, 120, t, 0.7, 0.07, sfxBus);
      sweep('square', 900, 60, t, 0.7, 0.04, sfxBus);
      noise(t, 0.8, 0.25, 'highpass', 2000, 6000, sfxBus, 1);
    },
    imp_ray(t) {
      explode(t, 0.7);
      sweep('sine', 1200, 200, t, 0.5, 0.06, sfxBus);
    },
    mash(t) {
      sweep('sawtooth', 100, 500, t, 0.6, 0.05, sfxBus, 0.5);
      noise(t, 0.6, 0.15, 'bandpass', 400, 1600, sfxBus, 2);
    },
    imp_mash(t) {
      megaBoom(t);
      noise(t, 0.4, 0.35, 'bandpass', 3000, 800, sfxBus, 2);
    },
    mech(t) {
      sweep('sawtooth', 80, 300, t, 1.2, 0.05, sfxBus, 1);
      chordV('brass', t + 0.2, [43, 50, 55], 1, 0.05);
    },
    imp_mech(t) {
      kick(t, 0.5, sfxBus);
      noise(t, 0.06, 0.25, 'highpass', 3000, 3000, sfxBus, 1);
    },
    gun(t) {
      for (let i = 0; i < 3; i++) {
        noise(t + i * 0.05, 0.04, 0.3, 'bandpass', 2500, 900, sfxBus, 2);
        kick(t + i * 0.05, 0.25, sfxBus);
      }
    },
    mechReady(t) {
      chordV('brass', t, [43, 50, 55, 62], 0.9, 0.07);
      timp(t, 0.8, sfxBus, 43);
      crash(t, 0.12, sfxBus);
      sweep('square', 400, 1600, t, 0.3, 0.04, sfxBus);
    },
    door(t) {
      sweep('sawtooth', 120, 60, t, 0.7, 0.05, sfxBus);
      noise(t, 0.8, 0.18, 'lowpass', 1200, 300, sfxBus);
      kick(t + 0.7, 0.4, sfxBus);
    },
    alien: (t) => [0, 1, 2].forEach((i) => sweep('sine', 900 + rnd() * 900, 500 + rnd() * 1400, t + i * 0.07, 0.06, 0.05, sfxBus)),
    weld: (t) => noise(t, 0.12, 0.12, 'highpass', 5000, 3000, sfxBus, 1),
    mechIntro(t) {
      megaBoom(t);
      chordV('brass', t, [40, 47, 52, 59], 1.6, 0.07);
      chordV('choir', t + 0.1, [52, 59, 64, 71], 2, 0.04);
      crash(t, 0.25, sfxBus);
    },
    capIntro(t) {
      megaBoom(t);
      chordV('brass', t, [38, 45, 50, 57], 1.8, 0.07);
      chordV('choir', t + 0.1, [50, 57, 62, 69], 2.2, 0.045);
      sweep('sawtooth', 60, 900, t, 1.2, 0.04, sfxBus, 0.8);
      crash(t, 0.25, sfxBus);
    },
    cpunch(t) {
      sweep('sine', 300, 1400, t, 0.18, 0.05, sfxBus);
      noise(t + 0.17, 0.14, 0.22, 'bandpass', 900, 2800, sfxBus, 1);
    },
    imp_cpunch(t) {
      kick(t, 0.85, sfxBus);
      noise(t, 0.14, 0.32, 'bandpass', 2200, 1100, sfxBus, 2);
      sweep('square', 1000, 260, t, 0.14, 0.05, sfxBus);
    },
    cray(t) {
      sweep('sine', 120, 900, t, 0.25, 0.05, sfxBus);
      [0, 1, 2].forEach((i) => sweep('square', 600 + i * 300, 650 + i * 300, t + 0.25 + i * 0.06, 0.05, 0.03, sfxBus));
    },
    imp_cray(t) {
      explode(t, 0.8);
      sweep('sawtooth', 1500, 180, t, 0.5, 0.05, sfxBus);
      sweep('sine', 2000, 300, t + 0.03, 0.5, 0.05, sfxBus);
    },
    katana: (t) => chordV('choir', t, [62, 69, 74], 0.8, 0.03),
    unsheathe(t) {
      noise(t, 0.45, 0.2, 'bandpass', 4500, 7500, sfxBus, 4, 0.3);
      voice('bell', 98, t + 0.42, 0.6, 0.06, sfxBus);
      voice('bell', 105, t + 0.46, 0.5, 0.03, sfxBus);
    },
    sheathe(t) {
      noise(t, 0.25, 0.15, 'bandpass', 5000, 3000, sfxBus, 3);
      sweep('square', 2200, 2200, t + 0.24, 0.03, 0.06, sfxBus);
    },
    imp_katana(t) {
      noise(t, 0.3, 0.45, 'highpass', 5000, 1200, sfxBus, 1);
      kick(t, 0.8, sfxBus);
      sweep('sawtooth', 2600, 90, t, 0.55, 0.06, sfxBus);
      crash(t, 0.12, sfxBus);
    },
    teleport(t) {
      sweep('sine', 2200, 260, t, 0.22, 0.06, sfxBus);
      sweep('square', 260, 2200, t + 0.08, 0.18, 0.025, sfxBus);
    },
    kontrol(t) {
      sweep('sine', 300, 2400, t, 0.4, 0.05, sfxBus);
      chordV('brass', t + 0.3, [38, 45, 50], 0.9, 0.06);
      timp(t + 0.3, 0.7, sfxBus, 45);
    },
    lurch(t) {
      sweep('sawtooth', 70, 40, t, 1.4, 0.12, sfxBus);
      noise(t, 1.4, 0.3, 'lowpass', 500, 120, sfxBus, 1, 0.2);
      for (let i = 0; i < 5; i++) noise(t + 0.2 + i * 0.18, 0.08, 0.15, 'bandpass', 1800 + rnd() * 1500, 1200, sfxBus, 3);
    },
    crate(t) {
      kick(t, 0.7, sfxBus);
      noise(t, 0.22, 0.3, 'lowpass', 1000, 220, sfxBus);
      noise(t, 0.05, 0.15, 'bandpass', 3000, 2000, sfxBus, 2);
    },
    imp_kontrol(t) {
      kick(t, 0.9, sfxBus);
      noise(t, 0.45, 0.4, 'lowpass', 2400, 200, sfxBus);
      for (let i = 0; i < 6; i++) noise(t + 0.05 + i * 0.04, 0.05, 0.18, 'bandpass', 1500 + rnd() * 2500, 1500, sfxBus, 3);
    },
    spark(t) {
      noise(t, 0.06, 0.18, 'highpass', 6000, 4000, sfxBus, 1);
      sweep('square', 2400 + rnd() * 1200, 1800, t, 0.03, 0.025, sfxBus);
      noise(t + 0.07, 0.04, 0.1, 'highpass', 5000, 5000, sfxBus, 1);
    },
    bpunch(t) {
      sweep('sawtooth', 90, 260, t, 0.25, 0.05, sfxBus);
      noise(t + 0.2, 0.12, 0.2, 'bandpass', 800, 2400, sfxBus, 1);
    },
    imp_bpunch(t) {
      kick(t, 0.8, sfxBus);
      noise(t, 0.14, 0.3, 'bandpass', 1800, 900, sfxBus, 2);
      sweep('square', 700, 140, t, 0.16, 0.05, sfxBus);
    },
    smash(t) {
      sweep('sawtooth', 60, 420, t, 0.7, 0.05, sfxBus, 0.5);
      sweep('sine', 1400, 200, t + 0.75, 0.25, 0.06, sfxBus);
    },
    imp_smash(t) {
      megaBoom(t);
      noise(t, 0.6, 0.35, 'lowpass', 900, 80, sfxBus);
      for (let i = 0; i < 5; i++) noise(t + 0.1 + i * 0.07, 0.06, 0.14, 'bandpass', 1200 + rnd() * 2000, 1200, sfxBus, 3);
    },
    inferno(t) {
      sweep('sawtooth', 100, 1400, t, 0.9, 0.05, sfxBus, 0.7);
      chordV('choir', t + 0.2, [45, 52, 57], 1.2, 0.035);
    },
    imp_inferno(t) {
      explode(t, 0.9);
      sweep('sawtooth', 2200, 90, t, 0.8, 0.07, sfxBus);
      noise(t, 0.9, 0.3, 'bandpass', 1500, 400, sfxBus, 1);
    },
    warnSign(t) {
      sweep('square', 1320, 1320, t, 0.08, 0.05, sfxBus);
      sweep('square', 990, 990, t + 0.1, 0.08, 0.05, sfxBus);
      noise(t, 0.05, 0.12, 'highpass', 4000, 4000, sfxBus, 1);
    },
    overactive(t) {
      megaBoom(t);
      chordV('supersaw', t, [40, 46, 52, 58], 1.4, 0.05);
      sweep('sawtooth', 80, 2400, t, 1.1, 0.05, sfxBus, 0.8);
      for (let i = 0; i < 8; i++) sweep('square', 1500, 1500, t + i * 0.09, 0.04, 0.03, sfxBus);
    },
    rocketFist(t) {
      sweep('sawtooth', 200, 900, t, 0.4, 0.05, sfxBus);
      noise(t, 0.6, 0.3, 'bandpass', 900, 3000, sfxBus, 1, 0.1);
    },
    imp_overactive(t) {
      kick(t, 0.8, sfxBus);
      noise(t, 0.18, 0.3, 'bandpass', 2600, 900, sfxBus, 2);
      sweep('sawtooth', 1600, 200, t, 0.2, 0.04, sfxBus);
    },
    shipFail(t) {
      sweep('sawtooth', 600, 40, t, 2.2, 0.08, sfxBus, 0.1);
      sweep('square', 300, 30, t + 0.1, 2.2, 0.04, sfxBus);
      noise(t, 1.6, 0.2, 'lowpass', 1200, 100, sfxBus, 1);
      [0, 1, 2].forEach((i) => sweep('square', 880, 880, t + 0.3 + i * 0.3, 0.12, 0.04, sfxBus));
    },
    fallRoar(t) {
      noise(t, 4, 0.35, 'lowpass', 300, 1800, sfxBus, 1, 1.5);
      noise(t + 1, 3.5, 0.25, 'bandpass', 600, 2600, sfxBus, 0.7, 1);
      sweep('sawtooth', 50, 90, t, 4, 0.05, sfxBus, 1.5);
    },
    coreRise(t) {
      sweep('sine', 120, 2400, t, 1.6, 0.07, sfxBus, 0.2);
      sweep('square', 240, 3200, t + 0.1, 1.5, 0.025, sfxBus, 0.2);
      for (let i = 0; i < 6; i++) sweep('square', 400 + rnd() * 2000, 200 + rnd() * 3000, t + 0.2 + i * 0.15, 0.06, 0.03, sfxBus);
    },
    hack(t) {
      megaBoom(t);
      chordV('supersaw', t, [37, 43, 49, 55], 2.4, 0.05);
      for (let i = 0; i < 16; i++) sweep('square', 200 + rnd() * 3000, 200 + rnd() * 3000, t + i * 0.06, 0.05, 0.035, sfxBus);
      noise(t, 1.5, 0.2, 'bandpass', 3000, 300, sfxBus, 2);
    },
    mechBoot(t) {
      sweep('sawtooth', 40, 320, t, 1.6, 0.06, sfxBus, 0.8);
      for (let i = 0; i < 6; i++) noise(t + 0.3 + i * 0.22, 0.05, 0.15, 'highpass', 5000, 4000, sfxBus, 1);
      [0, 1, 2].forEach((i) => sweep('square', 500 + i * 250, 500 + i * 250, t + 1.2 + i * 0.12, 0.08, 0.04, sfxBus));
    },
    wreckIntro(t) {
      megaBoom(t);
      chordV('brass', t, [37, 44, 49, 56], 1.8, 0.07);
      chordV('supersaw', t + 0.1, [49, 55, 61], 2, 0.035);
      for (let i = 0; i < 10; i++) sweep('square', 300 + rnd() * 2500, 200 + rnd() * 2500, t + 0.4 + i * 0.05, 0.04, 0.03, sfxBus);
      crash(t, 0.25, sfxBus);
    },
    ghostWail(t) {
      sweep('sine', 300, 900, t, 0.6, 0.05, sfxBus, 0.2);
      sweep('sine', 900, 250, t + 0.6, 1.2, 0.05, sfxBus);
      sweep('triangle', 310, 880, t, 0.6, 0.03, sfxBus, 0.2);
      noise(t, 1.6, 0.08, 'bandpass', 800, 2400, sfxBus, 6, 0.4);
    },
    ghostAppear(t) {
      megaBoom(t);
      chordV('choir', t, [41, 42, 48, 53, 54], 2.2, 0.06);
      sweep('sawtooth', 1800, 90, t, 0.9, 0.08, sfxBus);
      for (let i = 0; i < 12; i++) sweep('square', 200 + rnd() * 3000, 100 + rnd() * 3000, t + i * 0.04, 0.04, 0.04, sfxBus);
      crash(t, 0.3, sfxBus);
    },
    castleBoom(t) {
      megaBoom(t);
      megaBoom(t + 0.25);
      for (let i = 0; i < 10; i++) noise(t + 0.2 + i * 0.09, 0.15, 0.2, 'lowpass', 1600, 200, sfxBus);
    },
    forgerIntro(t) {
      megaBoom(t);
      chordV('organ', t, [29, 36, 41, 44], 2.2, 0.08);
      chordV('choir', t + 0.1, [53, 56, 60, 65], 2.4, 0.05);
      sweep('sawtooth', 50, 1200, t, 1.2, 0.05, sfxBus, 0.9);
      crash(t, 0.3, sfxBus);
    },
    fpunch(t) {
      sweep('sawtooth', 70, 220, t, 0.5, 0.06, sfxBus, 0.3);
      noise(t, 0.6, 0.15, 'lowpass', 400, 1600, sfxBus, 1, 0.3);
    },
    imp_fpunch(t) {
      megaBoom(t);
      for (let i = 0; i < 8; i++) noise(t + 0.05 + i * 0.05, 0.08, 0.18, 'bandpass', 900 + rnd() * 2400, 900, sfxBus, 2);
    },
    brick(t) {
      sweep('sawtooth', 60, 180, t, 0.6, 0.05, sfxBus, 0.4);
      chordV('organ', t, [29, 36], 0.8, 0.05);
    },
    imp_brick(t) {
      kick(t, 1, sfxBus);
      noise(t, 0.5, 0.4, 'lowpass', 1800, 150, sfxBus);
      for (let i = 0; i < 6; i++) noise(t + 0.04 + i * 0.05, 0.06, 0.16, 'bandpass', 1500 + rnd() * 2000, 1200, sfxBus, 3);
    },
    gbeam(t) {
      chordV('choir', t, [41, 47, 52], 2, 0.05);
      sweep('sine', 120, 60, t, 2, 0.06, sfxBus);
    },
    ghostScream(t) {
      sweep('sawtooth', 400, 1400, t, 0.4, 0.07, sfxBus);
      sweep('sawtooth', 1400, 300, t + 0.4, 0.9, 0.06, sfxBus);
      sweep('square', 413, 1390, t, 0.4, 0.03, sfxBus);
      noise(t, 1.3, 0.25, 'bandpass', 1200, 3500, sfxBus, 2, 0.1);
      chordV('choir', t, [53, 54, 60], 1.6, 0.06);
    },
    gcharge(t) {
      sweep('sine', 100, 1800, t, 1.1, 0.06, sfxBus, 0.8);
      noise(t, 1.1, 0.15, 'bandpass', 300, 4000, sfxBus, 4, 0.9);
    },
    ghostBeam(t) {
      sweep('sawtooth', 900, 120, t, 1.4, 0.08, sfxBus);
      sweep('sine', 1300, 200, t, 1.4, 0.06, sfxBus);
      noise(t, 1.4, 0.3, 'bandpass', 2000, 500, sfxBus, 1);
      chordV('choir', t, [48, 54, 60, 66], 1.4, 0.05);
    },
    imp_gbeam(t) {
      megaBoom(t);
      sweep('sawtooth', 2400, 80, t, 0.9, 0.07, sfxBus);
    },
    cdef(t) {
      chordV('brass', t, [41, 48, 53], 1.4, 0.06);
      timp(t, 0.8, sfxBus, 41);
    },
    shieldUp(t) {
      kick(t, 0.9, sfxBus);
      noise(t, 0.3, 0.3, 'lowpass', 2000, 300, sfxBus);
      voice('bell', 77, t + 0.1, 0.8, 0.07, sfxBus);
      voice('bell', 84, t + 0.18, 0.8, 0.05, sfxBus);
      sweep('sine', 200, 1600, t, 0.6, 0.04, sfxBus);
    },
    shockwave(t) {
      sweep('sine', 160, 40, t, 0.9, 0.12, sfxBus);
      noise(t, 0.9, 0.35, 'lowpass', 3000, 100, sfxBus);
    },
    imp_cdef(t) {
      kick(t, 1, sfxBus);
      noise(t, 0.4, 0.3, 'bandpass', 900, 300, sfxBus, 1);
    },
    shieldBlock(t) {
      voice('bell', 72, t, 0.5, 0.09, sfxBus);
      voice('bell', 79, t, 0.5, 0.06, sfxBus);
      noise(t, 0.12, 0.3, 'bandpass', 3000, 2000, sfxBus, 2);
      kick(t, 0.5, sfxBus);
    },
    shieldBreak(t) {
      noise(t, 0.6, 0.35, 'highpass', 3000, 6000, sfxBus, 1);
      for (let i = 0; i < 6; i++) voice('bell', 84 + Math.floor(rnd() * 12), t + i * 0.05, 0.3, 0.04, sfxBus);
    },
    crumble(t) {
      for (let i = 0; i < 14; i++) noise(t + i * 0.12, 0.2, 0.2, 'lowpass', 1200 + rnd() * 800, 150, sfxBus);
      sweep('sawtooth', 200, 40, t, 1.8, 0.05, sfxBus);
    },
    ghostDeath(t) {
      megaBoom(t);
      chordV('choir', t, [41, 48, 53, 56, 60, 65], 4, 0.06);
      bells(t + 0.3, [77, 80, 84, 89, 92, 96], 0.14, 0.05);
      sweep('sine', 1600, 60, t, 2.5, 0.06, sfxBus);
    },
    gpunch(t) {
      sweep('square', 1200, 200, t, 0.15, 0.04, sfxBus);
    },
    gshift(t) {
      sweep('sawtooth', 300, 1400, t, 0.18, 0.05, sfxBus);
      for (let i = 0; i < 4; i++) sweep('square', 400 + rnd() * 2000, 400 + rnd() * 2000, t + 0.05 + i * 0.04, 0.03, 0.03, sfxBus);
    },
    gbullet(t) {
      sweep('sawtooth', 900, 60, t, 0.5, 0.08, sfxBus);
      sweep('square', 1800, 120, t, 0.4, 0.03, sfxBus);
      noise(t, 0.4, 0.25, 'bandpass', 2000, 300, sfxBus, 2);
    },
    imp_gpunch(t) {
      kick(t, 0.9, sfxBus);
      for (let i = 0; i < 6; i++) sweep('square', 200 + rnd() * 2400, 100 + rnd() * 1200, t + i * 0.03, 0.04, 0.035, sfxBus);
    },
    afterimg(t) {
      for (let i = 0; i < 3; i++) {
        sweep('square', 300 + i * 200, 1200 + i * 300, t + i * 0.1, 0.12, 0.04, sfxBus);
        voice('bell', 64 + i * 5, t + i * 0.1, 0.4, 0.04, sfxBus);
      }
    },
    gdash(t) {
      sweep('sawtooth', 200, 1600, t, 0.15, 0.05, sfxBus);
      noise(t, 0.18, 0.2, 'highpass', 3000, 5000, sfxBus, 1);
    },
    imp_afterimg(t) {
      kick(t, 0.8, sfxBus);
      noise(t, 0.2, 0.3, 'bandpass', 1800, 600, sfxBus, 2);
    },
    ginferno(t) {
      chordV('choir', t, [40, 47, 52, 59], 2.6, 0.05);
      chordV('supersaw', t + 0.2, [52, 55, 59], 2, 0.03);
      sweep('sine', 1400, 90, t, 2.2, 0.05, sfxBus);
      for (let i = 0; i < 8; i++) sweep('square', 300 + rnd() * 2500, 200 + rnd() * 2500, t + i * 0.08, 0.04, 0.03, sfxBus);
    },
    glightAppear(t) {
      voice('bell', 84, t, 0.8, 0.06, sfxBus);
      voice('bell', 91, t + 0.06, 0.8, 0.04, sfxBus);
      sweep('square', 600, 2400, t, 0.2, 0.025, sfxBus);
    },
    gblueBeam(t) {
      sweep('sawtooth', 1400, 200, t, 0.8, 0.07, sfxBus);
      sweep('sine', 2000, 300, t, 0.8, 0.05, sfxBus);
      noise(t, 0.8, 0.28, 'bandpass', 2500, 600, sfxBus, 1);
    },
    imp_ginferno(t) {
      megaBoom(t);
      sweep('sawtooth', 2200, 100, t, 0.7, 0.06, sfxBus);
    },
    gdomain(t) {
      chordV('supersaw', t, [40, 46, 52], 1.2, 0.04);
      sweep('sawtooth', 100, 900, t, 0.6, 0.05, sfxBus, 0.3);
    },
    domainUp(t) {
      sweep('sine', 200, 1600, t, 0.5, 0.06, sfxBus);
      bells(t + 0.1, [76, 83, 88, 95], 0.06, 0.04);
      noise(t, 0.5, 0.15, 'highpass', 2000, 6000, sfxBus, 1);
    },
    gslash(t) {
      noise(t, 0.12, 0.35, 'highpass', 4000, 6000, sfxBus, 1);
      sweep('sawtooth', 3000, 400, t, 0.12, 0.05, sfxBus);
    },
    imp_gdomain(t) {
      kick(t, 0.6, sfxBus);
      noise(t, 0.14, 0.25, 'bandpass', 3200, 1200, sfxBus, 2);
    },
    glitchShatter(t) {
      for (let i = 0; i < 18; i++) sweep('square', 200 + rnd() * 3000, 100 + rnd() * 3000, t + i * 0.07, 0.05, 0.035, sfxBus);
      sweep('sawtooth', 1200, 40, t, 2.4, 0.05, sfxBus);
      chordV('choir', t + 0.4, [40, 46, 52], 2, 0.04);
    },
    kidBeam(t) {
      sweep('sawtooth', 1600, 200, t, 0.6, 0.08, sfxBus);
      sweep('square', 1640, 220, t, 0.6, 0.03, sfxBus);
      noise(t, 0.6, 0.3, 'bandpass', 2400, 500, sfxBus, 1);
    },
    glitchIntro(t) {
      megaBoom(t);
      chordV('supersaw', t, [40, 47, 52, 55], 2.2, 0.06);
      chordV('brass', t + 0.1, [28, 35, 40], 2, 0.06);
      for (let i = 0; i < 14; i++) sweep('square', 200 + rnd() * 3000, 100 + rnd() * 3000, t + 0.3 + i * 0.05, 0.04, 0.035, sfxBus);
      crash(t, 0.3, sfxBus);
    },
    dfist(t) {
      for (let i = 0; i < 10; i++) sweep('square', 300 + i * 160, 600 + i * 200, t + i * 0.03, 0.05, 0.03, sfxBus);
    },
    dfistForm(t) {
      sweep('sawtooth', 80, 400, t, 0.6, 0.05, sfxBus);
      for (let i = 0; i < 8; i++) voice('bell', 60 + i * 3, t + i * 0.05, 0.2, 0.025, sfxBus);
    },
    imp_dfist(t) {
      megaBoom(t);
      for (let i = 0; i < 6; i++) sweep('square', 2000 - i * 250, 100, t + i * 0.02, 0.08, 0.035, sfxBus);
    },
    pbarrage(t) {
      sweep('sine', 200, 1200, t, 0.4, 0.05, sfxBus);
      sweep('square', 1200, 200, t + 0.2, 0.4, 0.025, sfxBus);
    },
    pzap(t) {
      sweep('sawtooth', 2400, 300, t, 0.12, 0.05, sfxBus);
      sweep('sine', 300, 1800, t + 0.04, 0.1, 0.04, sfxBus);
    },
    imp_pbarrage(t) {
      kick(t, 0.5, sfxBus);
      noise(t, 0.1, 0.22, 'bandpass', 3000, 1500, sfxBus, 2);
    },
    gland(t) {
      chordV('choir', t, [36, 43, 48], 1.6, 0.04);
      sweep('sawtooth', 60, 30, t, 1.5, 0.07, sfxBus);
    },
    quake(t) {
      noise(t, 1.4, 0.35, 'lowpass', 200, 60, sfxBus);
      sweep('sine', 50, 30, t, 1.4, 0.12, sfxBus);
    },
    stoneRise(t) {
      noise(t, 0.35, 0.4, 'lowpass', 900, 200, sfxBus, 1);
      kick(t, 0.8, sfxBus);
      sweep('square', 200, 900, t, 0.2, 0.03, sfxBus);
    },
    imp_gland(t) {
      megaBoom(t);
      megaBoom(t + 0.12);
      for (let i = 0; i < 10; i++) sweep('square', 200 + rnd() * 3000, 100 + rnd() * 1000, t + i * 0.04, 0.05, 0.035, sfxBus);
    },
    destab(t) {
      for (let i = 0; i < 12; i++) sweep('square', 200 + rnd() * 3000, 100 + rnd() * 3000, t + i * 0.06, 0.05, 0.035, sfxBus);
      sweep('sawtooth', 600, 60, t, 1.2, 0.05, sfxBus);
    },
    codeRush(t) {
      noise(t, 1.6, 0.25, 'highpass', 2000, 6000, sfxBus, 1);
      for (let i = 0; i < 16; i++) voice('bell', 72 + ((i * 5) % 24), t + i * 0.08, 0.15, 0.02, sfxBus);
    },
    coreBeam(t) {
      sweep('sawtooth', 2000, 60, t, 1.4, 0.09, sfxBus);
      sweep('square', 1980, 70, t, 1.4, 0.04, sfxBus);
      noise(t, 1.4, 0.4, 'bandpass', 1800, 300, sfxBus, 1);
    },
    imp_destab(t) {
      megaBoom(t);
      crash(t, 0.4, sfxBus);
    },
    coreHum(t) {
      sweep('sine', 40, 80, t, 2, 0.12, sfxBus);
      chordV('choir', t + 0.3, [36, 43, 46], 2, 0.04);
    },
    coreIntro(t) {
      megaBoom(t);
      chordV('supersaw', t, [36, 43, 48, 51], 2.4, 0.06);
      chordV('brass', t + 0.1, [24, 31, 36], 2.2, 0.06);
      chordV('choir', t + 0.2, [48, 55, 60, 63], 2.4, 0.04);
      for (let i = 0; i < 16; i++) sweep('square', 200 + rnd() * 3000, 100 + rnd() * 3000, t + 0.3 + i * 0.05, 0.04, 0.035, sfxBus);
      crash(t, 0.35, sfxBus);
    },
    coreAlarm(t) {
      for (let i = 0; i < 6; i++) sweep('square', 880, 660, t + i * 0.3, 0.25, 0.04, sfxBus);
      sweep('sawtooth', 100, 1400, t, 2.2, 0.04, sfxBus);
    },
    stabilize(t) {
      chordV('choir', t, [48, 52, 55, 60, 64, 67], 4, 0.06);
      chordV('strings', t + 0.2, [36, 43, 48, 52], 4, 0.05);
      bells(t + 0.4, [72, 76, 79, 84, 88, 91, 96], 0.12, 0.05);
      sweep('sine', 200, 1600, t, 2.5, 0.05, sfxBus);
    },
    dig(t) {
      noise(t, 0.12, 0.3, 'bandpass', 900, 500, sfxBus, 1);
      kick(t, 0.25, sfxBus);
    },
    chestOpen(t) {
      sweep('square', 300, 200, t, 0.12, 0.05, sfxBus);
      bells(t + 0.15, [72, 76, 79, 84], 0.08, 0.06);
    },
    paper(t) {
      noise(t, 0.3, 0.2, 'highpass', 3000, 5000, sfxBus, 1);
    },
    planeHum(t) {
      sweep('sawtooth', 70, 80, t, 1.6, 0.04, sfxBus);
      noise(t, 1.6, 0.12, 'lowpass', 500, 400, sfxBus);
    },
    tentacle(t) {
      noise(t, 1.2, 0.45, 'lowpass', 600, 120, sfxBus);
      sweep('sawtooth', 50, 140, t, 1, 0.08, sfxBus);
      kick(t + 0.2, 0.9, sfxBus);
    },
    splash(t) {
      noise(t, 0.8, 0.5, 'bandpass', 1200, 300, sfxBus, 0.8);
      kick(t, 0.6, sfxBus);
      for (let i = 0; i < 8; i++) sweep('sine', 600 + rnd() * 900, 1500 + rnd() * 1000, t + 0.1 + i * 0.05, 0.06, 0.03, sfxBus);
    },
    bubble(t) {
      sweep('sine', 400, 1400, t, 0.12, 0.08, sfxBus);
      sweep('sine', 700, 1800, t + 0.06, 0.1, 0.05, sfxBus);
    },
    swimDash(t) {
      noise(t, 0.35, 0.3, 'bandpass', 700, 2500, sfxBus, 1);
      for (let i = 0; i < 5; i++) sweep('sine', 500 + rnd() * 700, 1400 + rnd() * 600, t + i * 0.04, 0.06, 0.03, sfxBus);
    },
    drown(t) {
      sweep('square', 600, 120, t, 0.8, 0.05, sfxBus);
      for (let i = 0; i < 6; i++) sweep('sine', 900 - i * 100, 300, t + i * 0.08, 0.08, 0.04, sfxBus);
    },
    roar(t) {
      noise(t, 2, 0.55, 'lowpass', 900, 120, sfxBus);
      sweep('sawtooth', 120, 50, t, 2, 0.1, sfxBus);
      sweep('sawtooth', 180, 70, t + 0.05, 1.9, 0.07, sfxBus);
      timp(t, 1, sfxBus, 40);
    },
    tornado(t) {
      noise(t, 2.2, 0.45, 'bandpass', 300, 2400, sfxBus, 0.7);
      sweep('sawtooth', 80, 400, t, 2.2, 0.05, sfxBus);
    },
    waterBeam(t) {
      noise(t, 1.2, 0.5, 'bandpass', 2400, 600, sfxBus, 0.8);
      sweep('sawtooth', 900, 200, t, 1.2, 0.06, sfxBus);
      kick(t, 0.6, sfxBus);
    },
    lureGlow(t) {
      chordV('choir', t, [62, 69, 74], 1.4, 0.04);
      sweep('sine', 300, 1200, t, 1.2, 0.05, sfxBus);
    },
    eyeGlow(t) {
      sweep('sine', 200, 1600, t, 0.6, 0.06, sfxBus);
      chordV('brass', t + 0.1, [38, 45, 50], 1, 0.05);
    },
    ruinFall(t) {
      noise(t, 2.4, 0.4, 'lowpass', 300, 80, sfxBus);
      sweep('sine', 90, 40, t, 2.4, 0.1, sfxBus);
    },
    imp_epunch(t) {
      kick(t, 1, sfxBus);
      noise(t, 0.5, 0.4, 'bandpass', 900, 300, sfxBus, 1);
    },
    imp_eglow(t) {
      megaBoom(t);
      noise(t, 1, 0.4, 'bandpass', 2000, 500, sfxBus, 1);
    },
    imp_edeath(t) {
      megaBoom(t);
      megaBoom(t + 0.1);
    },
    imp_eruins(t) {
      megaBoom(t);
      crash(t, 0.4, sfxBus);
      for (let i = 0; i < 8; i++) kick(t + 0.1 + i * 0.08, 0.5, sfxBus);
    },
    inviteDing(t) {
      bells(t, [76, 83, 88], 0.09, 0.07);
    },
    tridentSlash(t) {
      noise(t, 0.35, 0.45, 'highpass', 2500, 6000, sfxBus, 1);
      sweep('sawtooth', 1600, 300, t, 0.25, 0.05, sfxBus);
      sweep('sine', 2400, 3200, t + 0.05, 0.3, 0.04, sfxBus);
    },
    aquaGlow(t) {
      chordV('choir', t, [64, 71, 76], 1.4, 0.04);
      sweep('sine', 400, 1600, t, 1.1, 0.05, sfxBus);
      bells(t + 0.2, [88, 95], 0.06, 0.05);
    },
    aquaPortal(t) {
      for (let i = 0; i < 9; i++) sweep('sine', 300 + i * 60, 900 + i * 90, t + i * 0.05, 0.25, 0.03, sfxBus);
      noise(t, 1, 0.25, 'bandpass', 600, 1800, sfxBus, 0.8);
    },
    aquaBeam(t) {
      noise(t, 0.6, 0.45, 'bandpass', 2800, 900, sfxBus, 0.9);
      sweep('square', 1400, 500, t, 0.5, 0.04, sfxBus);
    },
    statueCrack(t) {
      noise(t, 0.25, 0.5, 'highpass', 1800, 900, sfxBus, 1);
      for (let i = 0; i < 4; i++) noise(t + 0.06 + i * 0.05, 0.06, 0.35, 'bandpass', 2400, 1400, sfxBus, 1);
    },
    groundSlam(t) {
      megaBoom(t);
      noise(t, 1.6, 0.45, 'lowpass', 500, 80, sfxBus);
      for (let i = 0; i < 6; i++) sweep('sine', 500 + rnd() * 700, 1500, t + 0.1 + i * 0.05, 0.08, 0.03, sfxBus);
    },
    imp_apunch(t) {
      kick(t, 1, sfxBus);
      noise(t, 0.4, 0.45, 'highpass', 2000, 5000, sfxBus, 1);
    },
    imp_athrow(t) {
      megaBoom(t);
      crash(t, 0.35, sfxBus);
    },
    imp_aseas(t) {
      kick(t, 0.5, sfxBus);
      noise(t, 0.25, 0.3, 'bandpass', 2200, 800, sfxBus, 1);
    },
    imp_awraith(t) {
      megaBoom(t);
      megaBoom(t + 0.12);
      noise(t, 0.6, 0.4, 'highpass', 2500, 6000, sfxBus, 1);
    },
    hiss(t) {
      noise(t, 1.1, 0.5, 'highpass', 4000, 7000, sfxBus, 0.7);
      noise(t + 0.05, 0.9, 0.25, 'bandpass', 6000, 3000, sfxBus, 2);
      sweep('sawtooth', 120, 70, t, 0.8, 0.04, sfxBus);
    },
    boatHorn(t) {
      chordV('horn', t, [43, 50], 1.4, 0.08);
      chordV('horn', t + 1.6, [43, 50], 0.8, 0.07);
    },
    sandBurst(t) {
      kick(t, 0.8, sfxBus);
      noise(t, 0.9, 0.45, 'lowpass', 1400, 200, sfxBus);
    },
    snakeBeam(t) {
      noise(t, 2.6, 0.45, 'bandpass', 2600, 900, sfxBus, 0.9);
      sweep('sawtooth', 1200, 300, t, 2.4, 0.05, sfxBus);
      for (let i = 0; i < 8; i++) kick(t + 0.07 + i * 0.167, 0.4, sfxBus);
    },
    waterBullet(t) {
      for (let i = 0; i < 2; i++) {
        sweep('sine', 1400, 300, t + i * 0.167, 0.12, 0.06, sfxBus);
        noise(t + i * 0.167, 0.1, 0.3, 'bandpass', 1800, 900, sfxBus, 1);
      }
    },
    sunGlow(t) {
      chordV('choir', t, [62, 66, 69, 74], 1.6, 0.05);
      bells(t + 0.1, [86, 90, 93, 98], 0.08, 0.05);
      sweep('sine', 500, 2000, t, 1.2, 0.04, sfxBus);
    },
    quakeWave(t) {
      noise(t, 3, 0.5, 'lowpass', 300, 60, sfxBus);
      noise(t + 0.5, 2.4, 0.3, 'bandpass', 900, 400, sfxBus, 0.6);
      sweep('sine', 70, 35, t, 3, 0.12, sfxBus);
    },
    imp_stackle(t) {
      megaBoom(t);
      noise(t, 0.5, 0.4, 'bandpass', 900, 300, sfxBus, 1);
    },
    imp_sbeam(t) {
      kick(t, 0.5, sfxBus);
      noise(t, 0.25, 0.3, 'bandpass', 2600, 900, sfxBus, 1);
    },
    imp_sfire(t) {
      kick(t, 0.45, sfxBus);
      noise(t, 0.2, 0.3, 'bandpass', 1600, 700, sfxBus, 1);
    },
    imp_squake(t) {
      megaBoom(t);
      megaBoom(t + 0.15);
      crash(t, 0.45, sfxBus);
    },
    grassGrow(t) {
      for (let i = 0; i < 6; i++) noise(t + i * 0.06, 0.12, 0.22, 'bandpass', 1200 + i * 300, 2400, sfxBus, 2);
      sweep('triangle', 200, 500, t, 0.4, 0.04, sfxBus);
    },
    ruinBeam(t) {
      noise(t, 1.6, 0.45, 'bandpass', 1800, 600, sfxBus, 0.8);
      sweep('sawtooth', 900, 200, t, 1.4, 0.05, sfxBus);
      chordV('choir', t, [52, 59, 64], 1.2, 0.04);
      for (let i = 0; i < 5; i++) kick(t + 0.1 + i * 0.22, 0.35, sfxBus);
    },
    structRise(t) {
      noise(t, 2.2, 0.5, 'lowpass', 600, 120, sfxBus);
      sweep('sine', 50, 120, t, 2, 0.1, sfxBus);
      for (let i = 0; i < 5; i++) noise(t + 0.2 + i * 0.3, 0.1, 0.3, 'highpass', 1500, 900, sfxBus, 1);
    },
    turtleCall(t) {
      sweep('sawtooth', 110, 180, t, 0.9, 0.08, sfxBus);
      sweep('sawtooth', 180, 90, t + 0.9, 1.1, 0.08, sfxBus);
      sweep('sine', 220, 360, t, 1.8, 0.05, sfxBus);
      noise(t, 2, 0.15, 'bandpass', 400, 200, sfxBus, 1);
    },
    swarmRush(t) {
      noise(t, 2.2, 0.5, 'bandpass', 900, 2400, sfxBus, 0.7);
      for (let i = 0; i < 14; i++) sweep('sine', 600 + rnd() * 900, 1500 + rnd() * 800, t + i * 0.1, 0.07, 0.025, sfxBus);
    },
    imp_ttangle(t) {
      kick(t, 0.5, sfxBus);
      noise(t, 0.4, 0.3, 'bandpass', 1400, 600, sfxBus, 1);
    },
    imp_tbeam(t) {
      megaBoom(t);
      noise(t, 0.6, 0.35, 'highpass', 1800, 900, sfxBus, 1);
    },
    imp_ttitan(t) {
      megaBoom(t);
      megaBoom(t + 0.12);
      crash(t, 0.5, sfxBus);
      noise(t, 1.4, 0.45, 'lowpass', 500, 80, sfxBus);
    },
    imp_tswarm(t) {
      megaBoom(t);
      noise(t, 1, 0.45, 'bandpass', 1100, 2800, sfxBus, 0.8);
    },
    brazierCrackle(t) {
      for (let i = 0; i < 3; i++) noise(t + i * 0.05 + Math.random() * 0.04, 0.04, 0.05, 'highpass', 2500 + Math.random() * 1500, 4000, sfxBus, 1);
      noise(t, 0.5, 0.025, 'lowpass', 400, 200, sfxBus);
    },
    runeHum(t) {
      const f = 220 * (1 + (Math.random() - 0.5) * 0.04);
      sweep('sine', f, f * 1.01, t, 1.6, 0.03, sfxBus, 0.5);
      sweep('sine', f * 1.5, f * 1.5, t + 0.1, 1.4, 0.015, sfxBus, 0.5);
    },
    megThrash(t) {
      const p = 1 + (Math.random() - 0.5) * 0.15;
      noise(t, 0.22, 0.28, 'bandpass', 1400 * p, 400 * p, sfxBus, 1.4);
      sweep('sawtooth', 110 * p, 55 * p, t, 0.18, 0.12, sfxBus);
      kick(t + 0.02, 0.35, sfxBus);
    },
    megSnap(t) {
      const p = 1 + (Math.random() - 0.5) * 0.1;
      noise(t, 0.06, 0.18, 'highpass', 2200 * p, 1200 * p, sfxBus, 1);
      sweep('square', 180 * p, 70 * p, t, 0.08, 0.08, sfxBus);
    },
    megAura(t) {
      chordV('choir', t, [50, 53, 56, 61], 1.4, 0.04);
      sweep('sawtooth', 60, 240, t, 1.4, 0.05, sfxBus);
      noise(t, 1.4, 0.25, 'bandpass', 500, 1600, sfxBus, 1);
    },
    megChomp(t) {
      kick(t, 0.9, sfxBus);
      noise(t, 0.25, 0.5, 'highpass', 2400, 1200, sfxBus, 1);
      sweep('square', 400, 60, t, 0.2, 0.08, sfxBus);
      timp(t, 0.8, sfxBus, 45);
    },
    megWave(t) {
      noise(t, 2.4, 0.55, 'lowpass', 2400, 300, sfxBus);
      noise(t + 0.3, 1.8, 0.35, 'bandpass', 1200, 500, sfxBus, 0.7);
      sweep('sine', 120, 40, t, 2, 0.1, sfxBus);
    },
    dragonRoar(t) {
      sweep('sawtooth', 300, 700, t, 0.4, 0.06, sfxBus);
      sweep('sawtooth', 700, 220, t + 0.4, 0.8, 0.06, sfxBus);
      noise(t, 1.2, 0.25, 'bandpass', 900, 2200, sfxBus, 1);
    },
    dragonBeam(t) {
      for (let i = 0; i < 3; i++) sweep('sawtooth', 1400 - i * 200, 300, t + i * 0.05, 1.2, 0.04, sfxBus);
      noise(t, 1.6, 0.45, 'bandpass', 2600, 900, sfxBus, 0.9);
      kick(t, 0.6, sfxBus);
    },
    megDie(t) {
      chordV('choir', t + 0.2, [45, 52, 57, 64], 2.4, 0.05);
      bells(t + 0.4, [81, 86, 88, 93], 0.12, 0.05);
      noise(t, 3, 0.5, 'lowpass', 1200, 80, sfxBus);
    },
    imp_mbite(t) {
      megaBoom(t);
      noise(t, 0.4, 0.4, 'highpass', 2000, 900, sfxBus, 1);
    },
    imp_mwave(t) {
      megaBoom(t);
      noise(t, 1.2, 0.5, 'lowpass', 1800, 200, sfxBus);
    },
    imp_mdragons(t) {
      megaBoom(t);
      noise(t, 0.8, 0.4, 'bandpass', 2400, 800, sfxBus, 1);
    },
    imp_marise(t) {
      megaBoom(t);
      megaBoom(t + 0.15);
      crash(t, 0.5, sfxBus);
      noise(t, 1.6, 0.45, 'bandpass', 600, 2400, sfxBus, 0.7);
    },
    planeCreak(t) {
      const p = 1 + (Math.random() - 0.5) * 0.2;
      sweep('sawtooth', 140 * p, 90 * p, t, 0.9, 0.05, sfxBus);
      sweep('square', 260 * p, 180 * p, t + 0.2, 0.6, 0.025, sfxBus);
      noise(t, 0.9, 0.12, 'bandpass', 700 * p, 300, sfxBus, 3);
    },
    krakRise(t) {
      noise(t, 2.8, 0.5, 'lowpass', 500, 80, sfxBus);
      sweep('sine', 70, 34, t, 2.6, 0.18, sfxBus);
      timp(t + 0.4, 0.9, sfxBus, 38);
      timp(t + 1.2, 0.8, sfxBus, 36);
    },
    krakRoar(t) {
      noise(t, 2.4, 0.5, 'lowpass', 700, 90, sfxBus);
      sweep('sawtooth', 90, 38, t, 2.2, 0.12, sfxBus);
      sweep('sawtooth', 134, 52, t + 0.04, 2.1, 0.08, sfxBus);
      sweep('square', 46, 30, t, 2.3, 0.06, sfxBus);
      noise(t + 0.2, 1.8, 0.2, 'bandpass', 260, 900, sfxBus, 4);
      timp(t, 1, sfxBus, 34);
    },
    krakGurgle(t) {
      const p = 1 + (Math.random() - 0.5) * 0.3;
      for (let i = 0; i < 4; i++) sweep('sine', (90 + i * 30) * p, (200 + i * 40) * p, t + i * 0.07, 0.07, 0.05, sfxBus);
      noise(t, 0.35, 0.06, 'lowpass', 500 * p, 200, sfxBus);
    },
    tentWhoosh(t) {
      const p = 1 + (Math.random() - 0.5) * 0.2;
      noise(t, 0.45, 0.3, 'bandpass', 500 * p, 2600 * p, sfxBus, 1.2);
      sweep('sine', 200 * p, 80 * p, t, 0.4, 0.06, sfxBus);
    },
    tentSlam(t) {
      const p = 1 + (Math.random() - 0.5) * 0.12;
      kick(t, 1, sfxBus);
      timp(t, 1, sfxBus, 40 * p);
      noise(t, 0.5, 0.5, 'lowpass', 1600 * p, 150, sfxBus);
      noise(t + 0.02, 0.25, 0.25, 'bandpass', 600 * p, 300, sfxBus, 2);
    },
    whirlSpin(t) {
      noise(t, 2.6, 0.4, 'bandpass', 400, 2000, sfxBus, 0.8);
      noise(t + 0.2, 2.4, 0.25, 'bandpass', 1800, 500, sfxBus, 0.8);
      sweep('sine', 120, 260, t, 2.6, 0.05, sfxBus);
    },
    drillSpin(t) {
      sweep('sawtooth', 60, 340, t, 1.6, 0.07, sfxBus);
      sweep('square', 90, 500, t, 1.6, 0.03, sfxBus);
      noise(t, 1.6, 0.25, 'bandpass', 300, 3000, sfxBus, 2);
    },
    drillBurrow(t) {
      noise(t, 1.8, 0.55, 'lowpass', 900, 60, sfxBus);
      sweep('sawtooth', 340, 70, t, 1.6, 0.08, sfxBus);
      for (let i = 0; i < 6; i++) noise(t + i * 0.18, 0.1, 0.18, 'bandpass', 1400 - i * 120, 600, sfxBus, 2);
      timp(t, 1, sfxBus, 36);
    },
    drillRumble(t) {
      noise(t, 1.4, 0.35, 'lowpass', 260, 60, sfxBus);
      sweep('sine', 50, 40, t, 1.4, 0.1, sfxBus);
    },
    drillBurst(t) {
      megaBoom(t);
      crash(t, 0.5, sfxBus);
      sweep('sawtooth', 120, 600, t, 0.5, 0.08, sfxBus);
      noise(t, 1.2, 0.5, 'bandpass', 700, 2600, sfxBus, 0.8);
    },
    tentGrab(t) {
      const p = 1 + (Math.random() - 0.5) * 0.2;
      noise(t, 0.3, 0.3, 'lowpass', 900 * p, 200, sfxBus);
      for (let i = 0; i < 3; i++) sweep('sine', 300 * p, 120 * p, t + i * 0.06, 0.08, 0.06, sfxBus);
    },
    beakChomp(t) {
      kick(t, 0.9, sfxBus);
      noise(t, 0.18, 0.4, 'highpass', 1800, 900, sfxBus, 1);
      sweep('square', 220, 50, t, 0.22, 0.1, sfxBus);
      timp(t, 0.7, sfxBus, 42);
    },
    gulp(t) {
      sweep('sine', 260, 60, t, 0.5, 0.2, sfxBus);
      sweep('sine', 180, 40, t + 0.15, 0.5, 0.15, sfxBus);
      noise(t, 0.5, 0.2, 'lowpass', 400, 100, sfxBus);
    },
    acidSizzle(t) {
      const p = 1 + (Math.random() - 0.5) * 0.3;
      noise(t, 0.28, 0.16, 'highpass', 4200 * p, 2600 * p, sfxBus, 1);
      sweep('sine', 500 * p, 900 * p, t, 0.06, 0.04, sfxBus);
    },
    acidBubble(t) {
      const p = 1 + (Math.random() - 0.5) * 0.4;
      sweep('sine', 160 * p, 420 * p, t, 0.09, 0.08, sfxBus);
      sweep('sine', 120 * p, 300 * p, t + 0.1, 0.08, 0.05, sfxBus);
    },
    spitOut(t) {
      noise(t, 0.6, 0.45, 'lowpass', 1400, 200, sfxBus);
      sweep('sawtooth', 70, 180, t, 0.4, 0.08, sfxBus);
      sweep('sine', 400, 90, t + 0.1, 0.4, 0.12, sfxBus);
    },
    inkSpray(t) {
      noise(t, 1.6, 0.45, 'lowpass', 1100, 140, sfxBus);
      noise(t, 1.2, 0.22, 'bandpass', 700, 2200, sfxBus, 1);
      sweep('sine', 140, 50, t, 1.4, 0.12, sfxBus);
    },
    inkSplat(t) {
      const p = 1 + (Math.random() - 0.5) * 0.3;
      noise(t, 0.2, 0.32, 'lowpass', 1200 * p, 300, sfxBus);
      sweep('sine', 260 * p, 70 * p, t, 0.16, 0.12, sfxBus);
    },
    krakDie(t) {
      sweep('sawtooth', 110, 30, t, 2.6, 0.1, sfxBus);
      noise(t, 3, 0.5, 'lowpass', 900, 60, sfxBus);
      chordV('choir', t + 0.4, [44, 51, 56, 59], 2.4, 0.045);
      bells(t + 0.8, [80, 83, 87, 92], 0.14, 0.045);
    },
    gemSocket(t) {
      bells(t, [76, 80, 83, 88], 0.08, 0.06);
      sweep('sine', 300, 1200, t, 0.5, 0.06, sfxBus);
      kick(t + 0.4, 0.5, sfxBus);
    },
    gateOpen(t) {
      noise(t, 3, 0.45, 'lowpass', 600, 80, sfxBus);
      sweep('sawtooth', 50, 70, t, 3, 0.07, sfxBus);
      chordV('choir', t + 0.6, [56, 60, 63, 68], 2.4, 0.04);
      timp(t, 1, sfxBus, 38);
    },
    imp_ksmash(t) {
      megaBoom(t);
      kick(t, 1, sfxBus);
      noise(t, 0.8, 0.5, 'lowpass', 2000, 150, sfxBus);
    },
    imp_kwhirl(t) {
      const p = 1 + (Math.random() - 0.5) * 0.3;
      noise(t, 0.16, 0.28, 'bandpass', 1500 * p, 900 * p, sfxBus, 1);
      kick(t, 0.4, sfxBus);
    },
    imp_kdrill(t) {
      megaBoom(t);
      megaBoom(t + 0.12);
      crash(t, 0.5, sfxBus);
      noise(t, 1.4, 0.5, 'bandpass', 500, 2000, sfxBus, 0.7);
    },
    imp_kdescent(t) {
      const p = 1 + (Math.random() - 0.5) * 0.35;
      noise(t, 0.22, 0.24, 'highpass', 3800 * p, 2400 * p, sfxBus, 1);
      sweep('sine', 140 * p, 360 * p, t, 0.1, 0.1, sfxBus);
    },
    // ----- Leviathan, the Abyssal God -----
    lvRumble(t) {
      noise(t, 3.2, 0.5, 'lowpass', 300, 50, sfxBus, 1, 0.6);
      sweep('sine', 38, 30, t, 3.2, 0.2, sfxBus, 0.5);
      for (let i = 0; i < 5; i++) noise(t + 0.4 + i * 0.5, 0.2, 0.12, 'bandpass', 900 - i * 80, 400, sfxBus, 2);
    },
    lvEyeOpen(t) {
      sweep('sine', 55, 82, t, 2.4, 0.16, sfxBus, 0.8);
      chordV('choir', t + 0.2, [42, 49, 54, 57, 61], 2.6, 0.04);
      bells(t + 0.6, [78, 85], 0.5, 0.05);
      noise(t, 2.4, 0.08, 'bandpass', 2400, 4800, sfxBus, 6, 1);
    },
    lvRise(t) {
      noise(t, 3.4, 0.55, 'lowpass', 400, 2400, sfxBus, 0.7, 1);
      noise(t + 1.6, 1.8, 0.4, 'bandpass', 900, 300, sfxBus, 0.8);
      sweep('sawtooth', 40, 70, t, 3, 0.07, sfxBus, 1);
      timp(t + 0.5, 1, sfxBus, 36);
      timp(t + 1.5, 1, sfxBus, 34);
    },
    lvRoar(t) {
      megaBoom(t);
      noise(t, 3.2, 0.6, 'lowpass', 900, 70, sfxBus);
      sweep('sawtooth', 120, 42, t, 2.8, 0.13, sfxBus, 0.08);
      sweep('sawtooth', 181, 60, t + 0.03, 2.7, 0.09, sfxBus, 0.08);
      sweep('square', 60, 34, t, 2.9, 0.07, sfxBus, 0.1);
      sweep('sine', 30, 24, t, 3, 0.3, sfxBus);
      noise(t + 0.1, 2.6, 0.25, 'bandpass', 300, 1400, sfxBus, 3);
      noise(t, 2, 0.12, 'bandpass', 2600, 900, sfxBus, 5);
      crash(t, 0.4, sfxBus);
      timp(t, 1, sfxBus, 32);
    },
    lvPillar(t) {
      const p = 1 + (Math.random() - 0.5) * 0.2;
      kick(t, 0.9, sfxBus);
      noise(t, 0.12, 0.5, 'highpass', 2600 * p, 1800, sfxBus, 1);
      noise(t + 0.05, 1.4, 0.45, 'lowpass', 1400 * p, 90, sfxBus);
      for (let i = 0; i < 6; i++) noise(t + 0.2 + i * 0.11, 0.08, 0.16, 'bandpass', 1600 - i * 150, 700, sfxBus, 3);
      timp(t, 0.8, sfxBus, 44 * p);
    },
    lvSplash(t) {
      const p = 1 + (Math.random() - 0.5) * 0.2;
      noise(t, 1, 0.45, 'lowpass', 2600 * p, 300, sfxBus);
      noise(t, 0.5, 0.25, 'highpass', 3000 * p, 1500, sfxBus, 1);
      sweep('sine', 300 * p, 80 * p, t, 0.3, 0.12, sfxBus);
    },
    lvGlow(t) {
      bells(t, [74, 81, 86, 90], 0.07, 0.045);
      sweep('sine', 400, 1600, t, 0.8, 0.05, sfxBus, 0.2);
      noise(t, 0.9, 0.06, 'bandpass', 3000, 6000, sfxBus, 6, 0.3);
    },
    lvTailWhoosh(t) {
      noise(t, 0.9, 0.5, 'bandpass', 250, 1800, sfxBus, 0.9, 0.3);
      sweep('sine', 160, 60, t, 0.9, 0.12, sfxBus, 0.3);
    },
    lvSlam(t) {
      megaBoom(t);
      megaBoom(t + 0.08);
      crash(t, 0.6, sfxBus);
      noise(t, 1.6, 0.55, 'lowpass', 2400, 120, sfxBus);
      for (let i = 0; i < 8; i++) noise(t + 0.15 + i * 0.09, 0.07, 0.18, 'bandpass', 1800 - i * 120, 900, sfxBus, 3);
      sweep('sine', 40, 26, t, 1.6, 0.35, sfxBus);
    },
    lvShock(t) {
      noise(t, 1.6, 0.4, 'bandpass', 600, 200, sfxBus, 0.8);
      sweep('sawtooth', 90, 50, t, 1.4, 0.06, sfxBus);
      bells(t, [86, 89], 0.06, 0.03);
    },
    lvSwim(t) {
      const p = 1 + (Math.random() - 0.5) * 0.2;
      noise(t, 0.8, 0.4, 'bandpass', 300 * p, 1400 * p, sfxBus, 0.8, 0.2);
      noise(t + 0.2, 0.6, 0.2, 'lowpass', 900, 200, sfxBus);
    },
    lvTornado(t) {
      noise(t, 2.2, 0.4, 'bandpass', 300, 2400, sfxBus, 0.7, 0.4);
      noise(t + 0.3, 1.8, 0.2, 'bandpass', 2000, 600, sfxBus, 0.7);
      sweep('sine', 90, 220, t, 2, 0.06, sfxBus, 0.4);
    },
    lvZap(t) {
      const p = 1 + (Math.random() - 0.5) * 0.4;
      noise(t, 0.12, 0.3, 'highpass', 5000 * p, 2000, sfxBus, 1);
      sweep('square', 1800 * p, 120, t, 0.1, 0.05, sfxBus);
    },
    lvLaunch(t) {
      const p = 1 + (Math.random() - 0.5) * 0.2;
      noise(t, 0.7, 0.45, 'bandpass', 2000 * p, 400, sfxBus, 0.8);
      sweep('sawtooth', 300 * p, 90, t, 0.5, 0.07, sfxBus);
      kick(t, 0.6, sfxBus);
    },
    lvDive(t) {
      noise(t, 1.4, 0.5, 'lowpass', 2000, 100, sfxBus);
      sweep('sine', 260, 40, t, 1.2, 0.15, sfxBus);
      noise(t + 0.3, 1.2, 0.18, 'bandpass', 400, 150, sfxBus, 2);
    },
    lvShadow(t) {
      sweep('sine', 52, 40, t, 0.5, 0.25, sfxBus);
      sweep('sine', 52, 40, t + 0.28, 0.5, 0.18, sfxBus);
      noise(t, 0.6, 0.06, 'lowpass', 200, 80, sfxBus);
    },
    lvWarn(t) {
      const p = 1 + (Math.random() - 0.5) * 0.06;
      sweep('square', 880 * p, 660 * p, t, 0.12, 0.04, sfxBus);
      sweep('sine', 440 * p, 330 * p, t, 0.14, 0.06, sfxBus);
    },
    lvBurst(t) {
      megaBoom(t);
      crash(t, 0.5, sfxBus);
      noise(t, 1.8, 0.6, 'lowpass', 3000, 200, sfxBus);
      noise(t, 0.8, 0.3, 'highpass', 2600, 1200, sfxBus, 1);
      sweep('sawtooth', 70, 200, t, 0.6, 0.1, sfxBus);
    },
    lvChomp(t) {
      kick(t, 1, sfxBus);
      noise(t, 0.2, 0.5, 'highpass', 2400, 900, sfxBus, 1);
      sweep('square', 260, 40, t, 0.3, 0.14, sfxBus);
      timp(t, 0.9, sfxBus, 40);
    },
    lvGulp(t) {
      sweep('sine', 220, 40, t, 0.8, 0.22, sfxBus);
      sweep('sine', 140, 30, t + 0.25, 0.9, 0.18, sfxBus);
      noise(t, 2.2, 0.25, 'lowpass', 500, 60, sfxBus);
      chordV('whale', t + 0.3, [30, 37], 1.6, 0.05);
    },
    lvSpit(t) {
      megaBoom(t);
      noise(t, 1.2, 0.55, 'lowpass', 2600, 200, sfxBus);
      sweep('sawtooth', 60, 220, t, 0.5, 0.1, sfxBus);
      sweep('sine', 500, 90, t + 0.1, 0.5, 0.14, sfxBus);
    },
    lvCharge(t) {
      sweep('sawtooth', 70, 600, t, 1.6, 0.06, sfxBus, 0.3);
      sweep('sine', 140, 1200, t, 1.6, 0.06, sfxBus, 0.3);
      noise(t, 1.6, 0.2, 'bandpass', 600, 4000, sfxBus, 4, 0.6);
      bells(t + 1.2, [82, 86, 89], 0.06, 0.04);
    },
    lvCircle(t) {
      const p = 1 + (Math.random() - 0.5) * 0.1;
      bells(t, [69 * p, 76 * p, 81 * p].map(Math.round), 0.05, 0.04);
      sweep('sine', 220 * p, 880 * p, t, 0.4, 0.05, sfxBus);
      noise(t, 0.5, 0.06, 'bandpass', 3000, 6000, sfxBus, 6);
    },
    lvSpear(t) {
      const p = 1 + (Math.random() - 0.5) * 0.25;
      sweep('sawtooth', 1400 * p, 200, t, 0.3, 0.06, sfxBus);
      noise(t, 0.35, 0.3, 'bandpass', 3000 * p, 800, sfxBus, 1.5);
      sweep('sine', 900 * p, 300, t, 0.3, 0.06, sfxBus);
    },
    lvSpearHit(t) {
      const p = 1 + (Math.random() - 0.5) * 0.25;
      kick(t, 0.8, sfxBus);
      noise(t, 0.8, 0.45, 'lowpass', 2200 * p, 160, sfxBus);
      noise(t + 0.05, 0.6, 0.18, 'bandpass', 1200 * p, 3000, sfxBus, 1);
    },
    lvBeamCharge(t) {
      sweep('sawtooth', 50, 400, t, 1.8, 0.07, sfxBus, 0.4);
      sweep('square', 75, 600, t, 1.8, 0.03, sfxBus, 0.4);
      noise(t, 1.8, 0.25, 'bandpass', 200, 3000, sfxBus, 3, 0.8);
      chordV('choir', t + 0.6, [49, 56, 61, 64], 1.3, 0.035);
    },
    lvBeam(t) {
      megaBoom(t);
      sweep('sawtooth', 110, 90, t, 1.9, 0.1, sfxBus);
      sweep('sawtooth', 165, 130, t, 1.9, 0.06, sfxBus);
      sweep('square', 55, 50, t, 1.9, 0.08, sfxBus);
      noise(t, 1.9, 0.4, 'bandpass', 900, 600, sfxBus, 0.8);
      noise(t, 1.9, 0.12, 'highpass', 4000, 3000, sfxBus, 1);
    },
    lvBeamHit(t) {
      const p = 1 + (Math.random() - 0.5) * 0.3;
      kick(t, 0.6, sfxBus);
      noise(t, 0.4, 0.3, 'lowpass', 1600 * p, 200, sfxBus);
    },
    lvEyes(t) {
      chordV('choir', t, [37, 44, 49, 52, 56], 2.2, 0.05);
      sweep('sine', 46, 92, t, 2, 0.15, sfxBus, 0.5);
      for (let i = 0; i < 5; i++) bells(t + 0.2 + i * 0.22, [80 - i * 3], 0.1, 0.04);
    },
    lvEyeBeam(t) {
      const p = 1 + (Math.random() - 0.5) * 0.2;
      sweep('sawtooth', 300 * p, 220 * p, t, 1, 0.07, sfxBus);
      noise(t, 1, 0.3, 'bandpass', 1400 * p, 900, sfxBus, 1);
      kick(t, 0.5, sfxBus);
    },
    lvCrack(t) {
      const p = 1 + (Math.random() - 0.5) * 0.4;
      noise(t, 0.1, 0.22, 'highpass', 3000 * p, 2000, sfxBus, 2);
      sweep('square', 900 * p, 200, t, 0.06, 0.03, sfxBus);
    },
    lvFall(t) {
      sweep('sawtooth', 90, 30, t, 2.4, 0.08, sfxBus);
      noise(t, 2, 0.45, 'lowpass', 900, 80, sfxBus);
      noise(t + 1.6, 1.6, 0.5, 'lowpass', 2000, 120, sfxBus);
      timp(t + 1.6, 1, sfxBus, 36);
    },
    lvDarkRoar(t) {
      megaBoom(t);
      megaBoom(t + 0.2);
      noise(t, 4, 0.65, 'lowpass', 700, 40, sfxBus);
      sweep('sawtooth', 80, 24, t, 3.6, 0.15, sfxBus, 0.1);
      sweep('sawtooth', 121, 36, t + 0.05, 3.5, 0.1, sfxBus, 0.1);
      sweep('square', 40, 22, t, 3.8, 0.09, sfxBus, 0.1);
      sweep('sine', 24, 18, t, 4, 0.35, sfxBus);
      noise(t + 0.2, 3, 0.3, 'bandpass', 180, 1100, sfxBus, 3);
      chordV('choir', t + 0.3, [25, 32, 37, 38], 3.2, 0.06);
      crash(t, 0.5, sfxBus);
    },
    lvShatter(t) {
      const p = 1 + (Math.random() - 0.5) * 0.3;
      noise(t, 0.3, 0.35, 'highpass', 4000 * p, 1800, sfxBus, 1);
      for (let i = 0; i < 4; i++) sweep('triangle', (1400 + i * 400) * p, 300, t + i * 0.04, 0.12, 0.04, sfxBus);
      kick(t, 0.4, sfxBus);
    },
    lvInsane(t) {
      megaBoom(t);
      noise(t, 2.6, 0.6, 'lowpass', 1600, 80, sfxBus);
      for (let i = 0; i < 6; i++) sweep('sawtooth', 160 - i * 10, 50, t + i * 0.12, 0.5, 0.08, sfxBus);
      noise(t, 2.4, 0.2, 'bandpass', 2200, 400, sfxBus, 4);
      chordV('choir', t, [33, 34, 40, 45], 2.4, 0.05);
      crash(t, 0.5, sfxBus);
    },
    lvCollapse(t) {
      noise(t, 2.6, 0.5, 'lowpass', 600, 60, sfxBus, 1, 0.3);
      for (let i = 0; i < 7; i++) {
        kick(t + i * 0.3 + Math.random() * 0.1, 0.5, sfxBus);
        noise(t + i * 0.3, 0.12, 0.15, 'bandpass', 1500 - i * 100, 600, sfxBus, 3);
      }
    },
    lvRock(t) {
      const p = 1 + (Math.random() - 0.5) * 0.3;
      kick(t, 0.7, sfxBus);
      noise(t, 0.4, 0.3, 'lowpass', 1400 * p, 120, sfxBus);
      noise(t, 0.08, 0.2, 'highpass', 2600 * p, 1500, sfxBus, 2);
    },
    lvDie(t) {
      megaBoom(t);
      crash(t, 0.6, sfxBus);
      sweep('sawtooth', 130, 26, t, 3.4, 0.12, sfxBus);
      sweep('square', 65, 22, t, 3.6, 0.07, sfxBus);
      noise(t, 4, 0.55, 'lowpass', 1200, 50, sfxBus);
      chordV('choir', t + 0.5, [42, 49, 54, 58, 61], 3.4, 0.055);
      bells(t + 1.4, [78, 82, 85, 90, 94], 0.16, 0.05);
    },
    lvBlast(t) {
      const p = 1 + (Math.random() - 0.5) * 0.3;
      kick(t, 0.9, sfxBus);
      noise(t, 0.6, 0.4, 'lowpass', 2600 * p, 200, sfxBus);
      sweep('sine', 900 * p, 200, t, 0.3, 0.06, sfxBus);
      bells(t, [Math.round(84 * p)], 0.05, 0.03);
    },
    lvWave(t) {
      noise(t, 4, 0.6, 'lowpass', 300, 2600, sfxBus, 0.6, 1.2);
      noise(t + 1.4, 2.6, 0.55, 'lowpass', 2600, 150, sfxBus);
      sweep('sine', 40, 28, t, 3.6, 0.3, sfxBus, 1);
      timp(t + 1.4, 1, sfxBus, 32);
      crash(t + 1.4, 0.5, sfxBus);
    },
    lvHeart(t) {
      chordV('choir', t, [54, 61, 66, 70], 3, 0.045);
      bells(t + 0.3, [78, 82, 85, 90, 94, 97], 0.14, 0.05);
      sweep('sine', 200, 800, t, 2.4, 0.05, sfxBus, 0.8);
    },
    lvHeartGet(t) {
      bells(t, [78, 82, 85, 90, 94, 97, 102], 0.06, 0.06);
      chordV('brass', t + 0.1, [54, 61, 66], 1.2, 0.06);
      chordV('choir', t + 0.1, [66, 70, 73, 78], 2.4, 0.05);
      timp(t, 0.9, sfxBus, 46);
      crash(t, 0.2, sfxBus);
    },
    lvDash(t) {
      const p = 1 + (Math.random() - 0.5) * 0.2;
      noise(t, 0.3, 0.32, 'bandpass', 800 * p, 3200 * p, sfxBus, 1);
      sweep('sine', 500 * p, 1200 * p, t, 0.15, 0.06, sfxBus);
    },
    lvHurt(t) {
      const p = 1 + (Math.random() - 0.5) * 0.2;
      kick(t, 0.8, sfxBus);
      sweep('square', 400 * p, 90 * p, t, 0.25, 0.1, sfxBus);
      noise(t, 0.3, 0.3, 'lowpass', 2000 * p, 300, sfxBus);
    },
    lvSafe(t) {
      bells(t, [84, 88, 91], 0.05, 0.04);
    },
    lvAllyJump(t) {
      const p = 1 + (Math.random() - 0.5) * 0.15;
      sweep('square', 330 * p, 620 * p, t, 0.09, 0.04, sfxBus);
      noise(t, 0.12, 0.08, 'bandpass', 1800 * p, 2600, sfxBus, 2);
    },
    lvAllyHurt(t) {
      const p = 1 + (Math.random() - 0.5) * 0.2;
      kick(t, 0.5, sfxBus);
      sweep('sawtooth', 620 * p, 160 * p, t, 0.22, 0.08, sfxBus);
      noise(t, 0.2, 0.22, 'bandpass', 1400 * p, 500, sfxBus, 2);
    },
    lvAllyDown(t) {
      sweep('triangle', 520, 90, t, 0.7, 0.12, sfxBus);
      sweep('square', 260, 60, t + 0.1, 0.6, 0.05, sfxBus);
      kick(t + 0.55, 0.7, sfxBus);
      noise(t + 0.55, 0.35, 0.25, 'lowpass', 900, 200, sfxBus);
    },
    // ----- The Luke Trial -----
    lukeSecret(t) {
      bells(t, [76, 83, 88, 95, 100], 0.07, 0.05);
      sweep('sine', 300, 1800, t, 0.9, 0.05, sfxBus, 0.3);
      noise(t, 1.0, 0.08, 'bandpass', 600, 4000, sfxBus, 3, 0.4);
      voice('glass', 88, t + 0.4, 0.6, 0.06, sfxBus);
    },
    lukeJump(t) {
      sweep('square', 300, 760, t, 0.08, 0.05, sfxBus);
      sweep('triangle', 600, 1200, t, 0.06, 0.04, sfxBus);
    },
    lukeLand: (t) => noise(t, 0.06, 0.14, 'lowpass', 900, 250, sfxBus),
    lukeDie(t) {
      sweep('square', 880, 110, t, 0.35, 0.08, sfxBus);
      sweep('sawtooth', 440, 55, t + 0.05, 0.4, 0.05, sfxBus);
      noise(t, 0.3, 0.25, 'lowpass', 3000, 200, sfxBus);
      kick(t, 0.6, sfxBus);
    },
    lukeRespawn(t) {
      sweep('triangle', 200, 900, t, 0.12, 0.05, sfxBus);
      voice('glass', 84, t + 0.06, 0.1, 0.04, sfxBus);
    },
    lukeCheckpoint(t) {
      voice('square', 76, t, 0.07, 0.05, sfxBus);
      voice('square', 83, t + 0.07, 0.07, 0.05, sfxBus);
      voice('square', 88, t + 0.14, 0.2, 0.05, sfxBus);
      voice('bell', 100, t + 0.14, 0.6, 0.04, sfxBus);
      sweep('triangle', 400, 1600, t, 0.25, 0.04, sfxBus);
    },
    lukeCrumble(t) {
      noise(t, 0.25, 0.18, 'bandpass', 500, 300, sfxBus, 2);
      for (let i = 0; i < 4; i++) noise(t + i * 0.05, 0.04, 0.12, 'highpass', 2500, 2500, sfxBus);
    },
    lukeCrumbleFall(t) {
      noise(t, 0.4, 0.2, 'lowpass', 900, 120, sfxBus);
      sweep('triangle', 160, 50, t, 0.4, 0.06, sfxBus);
    },
    lukeFake(t) {
      sweep('square', 400, 300, t, 0.15, 0.06, sfxBus);
      sweep('square', 300, 200, t + 0.17, 0.15, 0.06, sfxBus);
      sweep('square', 200, 90, t + 0.34, 0.45, 0.07, sfxBus);
    },
    lukeLaser(t) {
      sweep('sawtooth', 1800, 400, t, 0.22, 0.04, sfxBus);
      noise(t, 0.25, 0.06, 'bandpass', 3000, 1200, sfxBus, 4);
    },
    lukeLaserWarn: (t) => [0, 0.1].forEach((d) => sweep('square', 1400, 1400, t + d, 0.04, 0.025, sfxBus)),
    lukeSaw(t) {
      noise(t, 0.2, 0.05, 'bandpass', 3800, 4200, sfxBus, 6);
      sweep('sawtooth', 900, 1100, t, 0.2, 0.012, sfxBus);
    },
    lukeGemGet(t) {
      bells(t, [72, 76, 79, 84, 88, 91, 96, 100], 0.07, 0.07);
      chordV('brass', t + 0.6, [60, 64, 67, 72], 1.4, 0.06);
      chordV('choir', t + 0.6, [72, 76, 79, 84], 2.4, 0.05);
      timp(t + 0.6, 0.9, sfxBus, 48);
      crash(t + 0.6, 0.3, sfxBus);
    },
    // ----- Luke Gem moves -----
    lmegaCharge(t) {
      sweep('sawtooth', 80, 420, t, 1.2, 0.05, sfxBus, 0.2);
      noise(t, 1.2, 0.12, 'bandpass', 300, 2400, sfxBus, 3, 0.5);
    },
    lmegaLaunch(t) {
      noise(t, 0.45, 0.35, 'bandpass', 600, 4000, sfxBus, 1.5);
      sweep('square', 200, 900, t, 0.3, 0.06, sfxBus);
    },
    lmegaImpact(t) {
      megaBoom(t);
      sweep('square', 600, 60, t, 0.5, 0.1, sfxBus);
      crash(t, 0.4, sfxBus);
    },
    lunfairWhistle(t) {
      for (const d of [0, 0.22]) {
        sweep('sine', 2900, 3100, t + d, 0.16, 0.08, sfxBus);
        noise(t + d, 0.16, 0.05, 'bandpass', 3000, 3000, sfxBus, 8);
      }
    },
    lunfairRip(t) {
      noise(t, 0.35, 0.3, 'bandpass', 1500, 5000, sfxBus, 1);
      noise(t + 0.05, 0.25, 0.15, 'highpass', 4000, 4000, sfxBus);
    },
    lunfairClone(t) {
      const p = 1 + (Math.random() - 0.5) * 0.2;
      sweep('triangle', 500 * p, 1500 * p, t, 0.1, 0.05, sfxBus);
      noise(t, 0.12, 0.1, 'highpass', 3000, 3000, sfxBus);
    },
    lunfairDash(t) {
      for (let i = 0; i < 4; i++) noise(t + i * 0.04, 0.2, 0.2, 'bandpass', 900, 3500, sfxBus, 1.5);
    },
    lunfairSlash(t) {
      noise(t, 0.3, 0.4, 'highpass', 2000, 6000, sfxBus);
      sweep('sawtooth', 1200, 200, t, 0.3, 0.08, sfxBus);
      explode(t + 0.02, 0.8);
    },
    memeRecord(t) {
      sweep('sawtooth', 300, 900, t, 0.12, 0.06, sfxBus);
      sweep('sawtooth', 900, 200, t + 0.12, 0.16, 0.06, sfxBus);
      noise(t, 0.3, 0.12, 'bandpass', 1200, 3000, sfxBus, 2);
    },
    memeRise(t) {
      chordV('choir', t, [60, 67, 72, 76], 1.4, 0.05);
      sweep('sine', 200, 1200, t, 1.2, 0.05, sfxBus, 0.4);
    },
    memeAirhorn(t) {
      for (const d of [0, 0.16, 0.32]) {
        for (const m of [64, 64.2, 76]) voice('brass', m, t + d, d === 0.32 ? 0.5 : 0.12, 0.08, sfxBus);
      }
    },
    memeSting(t) {
      chordV('brass', t, [48, 55, 60], 0.3, 0.08);
      chordV('brass', t + 0.35, [47, 54, 59], 0.3, 0.08);
      chordV('brass', t + 0.7, [46, 53, 58, 63], 1.0, 0.09);
      timp(t + 0.7, 0.8, sfxBus, 40);
    },
    memeWhoosh: (t) => noise(t, 0.35, 0.3, 'bandpass', 400, 3000, sfxBus, 1.2),
    emotionalDamage(t) {
      megaBoom(t);
      for (let i = 0; i < 4; i++) sweep('square', 520 - i * 60, 320 - i * 50, t + 0.1 + i * 0.12, 0.1, 0.06, sfxBus);
      chordV('choir', t + 0.1, [55, 58, 62], 1.6, 0.05);
      crash(t, 0.35, sfxBus);
    },
    lchopGong(t) {
      voice('bell', 43, t, 2, 0.16, sfxBus);
      voice('bell', 50, t, 2, 0.08, sfxBus);
      noise(t, 2.0, 0.06, 'bandpass', 400, 200, sfxBus, 4);
    },
    lchopPose(t) {
      noise(t, 0.05, 0.3, 'highpass', 3000, 3000, sfxBus);
      kick(t, 0.5, sfxBus);
      chordV('brass', t + 0.02, [62, 69, 74], 0.35, 0.06);
    },
    lchopGlint(t) {
      voice('glass', 100, t, 0.1, 0.06, sfxBus);
      voice('glass', 107, t + 0.06, 0.1, 0.04, sfxBus);
    },
    lchopCharge(t) {
      sweep('sawtooth', 100, 600, t, 1.4, 0.05, sfxBus, 0.3);
      chordV('choir', t, [62, 66, 69, 74], 1.4, 0.04);
      noise(t, 1.4, 0.1, 'bandpass', 400, 3000, sfxBus, 2, 0.8);
    },
    lchopKiai(t) {
      noise(t, 0.35, 0.35, 'bandpass', 900, 1400, sfxBus, 3);
      sweep('sawtooth', 320, 520, t, 0.12, 0.09, sfxBus);
      sweep('sawtooth', 520, 260, t + 0.12, 0.25, 0.09, sfxBus);
    },
    lchopDash(t) {
      noise(t, 0.4, 0.35, 'bandpass', 500, 5000, sfxBus, 1.2);
      sweep('square', 150, 600, t, 0.35, 0.05, sfxBus);
    },
    lchopImpact(t) {
      megaBoom(t);
      kick(t + 0.08, 1, sfxBus);
      noise(t, 0.2, 0.5, 'highpass', 2500, 6000, sfxBus);
      sweep('square', 900, 50, t, 0.7, 0.1, sfxBus);
      crash(t, 0.5, sfxBus);
      timp(t + 0.1, 1, sfxBus, 36);
    },
    lchopBow: (t) => bells(t, [79, 84, 91], 0.1, 0.05),
    lchopEmpty(t) {
      sweep('square', 220, 160, t, 0.12, 0.07, sfxBus);
      sweep('square', 160, 110, t + 0.14, 0.18, 0.07, sfxBus);
    },
    imp_lev(t) {
      megaBoom(t);
      noise(t, 0.6, 0.4, 'bandpass', 1400, 600, sfxBus, 1);
    },
  };

  const lastPlay = {};
  const COOLDOWN = {
    step: 0.12, land: 0.1, hit: 0.08, hurt: 0.08, boom: 0.15, warn: 0.1,
    lvZap: 0.08, lvBeamHit: 0.1, lvRock: 0.09, lvWarn: 0.15, lvCrack: 0.06, lvBlast: 0.08, lvShatter: 0.07, lvSplash: 0.12, lvSpearHit: 0.08,
  };
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
    if (glitchOn && !sfxCrush) {
      sfxCrush = makeCrusher(12);
      sfxCrush.output.connect(sfxRoot);
    }
    g.connect(glitchOn ? sfxCrush.input : sfxRoot);
    lastPlay[name] = { t: now, g };
    sfxBus = g;
    try {
      fn(now + 0.01, arg);
      if (glitchOn && !NO_STUTTER.has(name) && rnd() < 0.3) {
        const g2 = ctx.createGain();
        g2.gain.value = 0.3;
        g2.connect(sfxCrush.input);
        sfxBus = g2;
        fn(now + 0.07 + rnd() * 0.05, arg);
        sweep('square', 300 + rnd() * 2500, 150 + rnd() * 2500, now + 0.02, 0.06, 0.08, g2);
        setTimeout(() => g2.disconnect(), 4000);
      }
    } finally {
      sfxBus = sfxRoot;
    }
  }
  let glitchOn = false, sfxCrush = null;
  const NO_STUTTER = new Set(['step', 'land', 'text', 'cursor', 'blip', 'jump', 'warn', 'beep', 'spark', 'confirm', 'back', 'open', 'close']);

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

  window.Sound = { play, music: setMusic, toggleMute, isMuted: () => muted, stream, glitch: (on) => { glitchOn = !!on; } };
})();
