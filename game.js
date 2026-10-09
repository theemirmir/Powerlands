(() => {
  const W = 384;
  const H = 216;
  const WORLD_W = 3600;
  const GROUND_Y = 176;
  const SPAWN_X = 40;
  const FONT = '"Press Start 2P", monospace';

  const cvs = document.getElementById('game');
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  function resize() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H) * 0.95;
    const scale = s >= 1 ? Math.floor(s) : s;
    cvs.style.width = W * scale + 'px';
    cvs.style.height = H * scale + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  function rng(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sfx = (name, arg) => window.Sound && window.Sound.play(name, arg);

  // ---------- Sprites ----------
  const SIDE_BODY = [
    '...kkkkk....',
    '..khHHhhkk..',
    '.khhhhhhhhk.',
    '.khhsssssk..',
    '.khsssesk...',
    '.khssssssk..',
    '..kksssskk..',
    '..kBbbbbBk..',
    '.kBbbbbbbBk.',
    'ksbbbbbbbbsk',
    'kbbbbbbbbbbk',
    'ksbllyllbsk.',
    '.kppppppppk.',
  ];
  const SIDE_BLINK = [...SIDE_BODY];
  SIDE_BLINK[4] = '.khssssssk..';

  const BACK_BODY = [
    '...kkkkkk...',
    '..khhhhhhk..',
    '.khhHHhhhhk.',
    '.khhhhhhhhk.',
    '.khhhhhhhhk.',
    '.kshhhhhhsk.',
    '..kkhhhhkk..',
    '..kBbbbbBk..',
    '.kBbbbbbbBk.',
    'kbbbbbbbbbbk',
    'kbbbbbbbbbbk',
    'ksbllllllbsk',
    '.kppppppppk.',
  ];

  const LEGS = [
    ['..kppkkppk..', '..kppkkppk..', '..kPPkkPPk..', '.kook..kook.', '.kkkk..kkkk.'],
    ['.kppk..kppk.', 'kppk....kppk', 'kPPk....kPPk', 'kook....kook', 'kkk......kkk'],
    ['...kppppk...', '...kppppk...', '...kPPPPk...', '...koooook..', '...kkkkkk...'],
  ];

  const BLUE_PAL = {
    k: '#1a1420', h: '#6b4220', H: '#9a6434', s: '#f2c79b', e: '#1a1a1a',
    b: '#2f6fdc', B: '#1d4a9e', p: '#2448a8', P: '#183478',
    l: '#6b4a1e', y: '#e8c547', o: '#5a3818',
  };
  const RED_PAL = {
    ...BLUE_PAL,
    h: '#2a1a12', H: '#4a3020',
    b: '#d8322e', B: '#9a1c1a', p: '#b0241f', P: '#7a1512',
  };

  function buildSprite(rows, pal) {
    const c = document.createElement('canvas');
    c.width = rows[0].length;
    c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (pal[ch]) {
          g.fillStyle = pal[ch];
          g.fillRect(x, y, 1, 1);
        }
      });
    });
    return c;
  }

  const makeFrames = (body, pal) => LEGS.map((legs) => buildSprite([...body, ...legs], pal));
  const playerFrames = makeFrames(SIDE_BODY, BLUE_PAL);
  let playerBack = buildSprite([...BACK_BODY, ...LEGS[0]], BLUE_PAL);

  const JESTER_SIDE = [
    '.y.kkkkk.y..',
    '.krkrrmmkmk.',
    '.krrrrmmmmk.',
    '.krrsssssk..',
    '.krsssesk...',
    '.krsssssnk..',
    '..kksnnskk..',
    '..kyyyyyyk..',
    '.kbBbbBbbBk.',
    'ksBbbBbbBbsk',
    'kbbBbbBbbBbk',
    'ksbllyllbsk.',
    '.kppppppppk.',
  ];
  const JESTER_BACK = [
    '.y.kkkkkk.y.',
    '.kkrrrmmmkk.',
    '.krrrrmmmmk.',
    '.krrrrmmmmk.',
    '.krrrrmmmmk.',
    '.ksrrrmmmsk.',
    '..kksssskk..',
    '..kyyyyyyk..',
    '.kbBbbBbbBk.',
    'kbBbbBbbBbbk',
    'kbbBbbBbbBbk',
    'ksbllllllbsk',
    '.kppppppppk.',
  ];
  const JESTER_PAL = {
    ...BLUE_PAL,
    s: '#fff4f0', r: '#d8322e', m: '#7a2a9c', n: '#e8202e', y: '#ffe14d',
    b: '#7a2a9c', B: '#d8322e', p: '#7a2a9c', P: '#4a1a68', o: '#d8322e',
  };
  const PLAYER_LOOKS = {
    normal: { frames: playerFrames.slice(), back: playerBack },
    joker: { frames: makeFrames(JESTER_SIDE, JESTER_PAL), back: buildSprite([...JESTER_BACK, ...LEGS[0]], JESTER_PAL) },
  };
  let playerLook = 'normal';
  function syncPlayerLook() {
    const look = inv.equipped === 'jokerCrystal' ? 'joker' : 'normal';
    if (look === playerLook) return;
    playerLook = look;
    playerFrames.splice(0, playerFrames.length, ...PLAYER_LOOKS[look].frames);
    playerBack = PLAYER_LOOKS[look].back;
  }
  const npcFrames = makeFrames(SIDE_BODY, RED_PAL);
  const npcBlink = buildSprite([...SIDE_BLINK, ...LEGS[0]], RED_PAL);

  const MONKEY_ROWS = [
    '....kkkkk.....',
    '...kfffffk....',
    '..kfffffffk...',
    '.kfkftttttk...',
    '.kfkftttetk...',
    '..kfftttttttk.',
    '..kffttttttk..',
    '...kfftttkk...',
    '....kffffk....',
    '...kfftttfk...',
    'kk.kfttttfFk..',
    'fk.kfttttfFk..',
    '.fkkfffffFk...',
    '..kfffffffk...',
    '..kFFk.kFFk...',
    '..kkkk.kkkk...',
  ];
  const MONKEY_PAL = {
    k: '#1a1420', f: '#8a5428', F: '#5e3618', t: '#f0c890', e: '#1a1a1a', m: '#7a2a2a',
  };
  const monkeyOpenRows = [...MONKEY_ROWS];
  monkeyOpenRows[6] = '..kfftmmmttk..';
  const monkeyFrames = [buildSprite(MONKEY_ROWS, MONKEY_PAL), buildSprite(monkeyOpenRows, MONKEY_PAL)];

  const ANGEL_ROWS = [
    '.....yyyy.......',
    '....y....y......',
    '.....yyyy.......',
    '.....kkkk.......',
    '....kHHHHk......',
    '...kHHHHHHk.....',
    '...kHHssssk.....',
    '...kHsssesk.....',
    '...kHssssk......',
    'vv..kkssk.......',
    'vWvkwwwwwwk.....',
    'vWWkwwwwwwwk....',
    '.vWkswwwwwsk....',
    '.vWkwwwwwwwk....',
    '..vkwwyywwwk....',
    '...kwwwwwwwk....',
    '...kwwwwwwwk....',
    '..kwwwwwwwwwk...',
    '..kwwwwwwwwwk...',
    '..kkkkkkkkkkk...',
    '....kssk.kssk...',
    '....kkkk.kkkk...',
  ];
  const angelFlapRows = [...ANGEL_ROWS];
  angelFlapRows.splice(9, 7,
    '....kkssk.......',
    '..vkwwwwwwk.....',
    'vvWkwwwwwwwk....',
    'vWWkswwwwwsk....',
    'vWWkwwwwwwwk....',
    '.vWkwwyywwwk....',
    '..vkwwwwwwwk....'
  );
  const ANGEL_PAL = {
    y: '#ffe14d', k: '#1a1420', H: '#f0d060', s: '#f2c79b', e: '#1a1a1a',
    w: '#ffffff', v: '#eef4ff', W: '#b8c8e0',
  };
  const angelFrames = [buildSprite(ANGEL_ROWS, ANGEL_PAL), buildSprite(angelFlapRows, ANGEL_PAL)];

  const BIRD_ROWS = [
    '......kk........',
    '.....kBBk.......',
    '....kBBBBkk.....',
    '...kBBBBBBBk....',
    '...kBBBBwekk....',
    '...kBBBBwwkyyk..',
    '...kbBBBwwkYk...',
    '....kbBBwwkk....',
    '.....kkwwk......',
    '..kbkBBwwwBkbk..',
    '.kbBkBwwwwBkBbk.',
    '.kbBkBwwwwBkBbk.',
    '.kbbkBwwwwBkbbk.',
    '..kbkBBwwBBkbk..',
    '...kckBBBBkgk...',
    '....kkBBBBkk....',
    '.....kbbbbk.....',
    '.....kbkkbk.....',
    '.....kok.kok....',
    '.....kok.kok....',
    '....kook.kook...',
    '....kkkk.kkkk...',
  ];
  const birdFlapRows = [...BIRD_ROWS];
  birdFlapRows.splice(9, 5,
    'kbbkkBBwwwBkkbbk',
    '.kbBkBwwwwBkBbk.',
    '..kbkBwwwwBkbk..',
    '...kkBwwwwBkk...',
    '....kBBwwBBk....'
  );
  const BIRD_PAL = {
    k: '#1a1420', B: '#3a7bd5', b: '#24509a', w: '#f4f8ff', e: '#1a1a1a',
    y: '#ffb020', Y: '#c8780e', o: '#e89a30', c: '#e89a30', g: '#5ff0ff',
  };
  const birdFrames = [buildSprite(BIRD_ROWS, BIRD_PAL), buildSprite(birdFlapRows, BIRD_PAL)];

  const KNIGHT_ROWS = [
    '.....rrr........',
    '....rrrrr.......',
    '.....rr.........',
    '....kkkkkk......',
    '...kAaaaaak.....',
    '...kAaaaaaak....',
    '...kAakkkkkk....',
    '...kAakEkEEk....',
    '...kAaaaaaak....',
    '....kAAAAAk..k..',
    '..kkaaaaaakkkSk.',
    '.kAAaaaaaaAAkSk.',
    '.kAkaayyaakAkSk.',
    '.kAkaayyaakAkSk.',
    '.kak.kaaaak.ggg.',
    '.kk..kbbbbk..g..',
    '....kaaaaak.....',
    '....kak.kak.....',
    '....kAk.kAk.....',
    '...kkAk.kAkk....',
    '...kkkk.kkkk....',
  ];
  const knightBlinkRows = [...KNIGHT_ROWS];
  knightBlinkRows[7] = '...kAakkkkkk....';
  const KNIGHT_PAL = {
    k: '#1a1420', A: '#6e7a90', a: '#b8c4d6', r: '#d8322e', E: '#7fdcff',
    S: '#eef4ff', g: '#e8c547', y: '#e8c547', b: '#6b4a1e',
  };
  const knightFrames = [buildSprite(KNIGHT_ROWS, KNIGHT_PAL), buildSprite(knightBlinkRows, KNIGHT_PAL)];
  const knightShine = buildSprite(KNIGHT_ROWS, { ...KNIGHT_PAL, E: '#ffffff' });

  const ARCHER_ROWS = [
    '....kkkk......',
    '...kGGGGk.....',
    '..kGGggGGk..w.',
    '..kGgsssGk...w',
    '..kGsssesk...w',
    '..kGssssk....w',
    '...kkssk..l..w',
    '..kqgggggkl..w',
    '.kqqgggggskl.w',
    'kqqkgggggksssw',
    'kqk.gyyyg.k..w',
    '.k..kgggk.l..w',
    '....kbbbk.l..w',
    '....kgggk..l.w',
    '....kgggk...w.',
    '....kgkgk..w..',
    '....kgkgk.....',
    '....kbkbk.....',
    '...kkbkbkk....',
    '...kkkkkkk....',
  ];
  const archerBlinkRows = [...ARCHER_ROWS];
  archerBlinkRows[4] = '..kGsssssk...w';
  const ARCHER_PAL = {
    k: '#1a1420', G: '#2e7d32', g: '#4caf50', s: '#f2c79b', e: '#1a1a1a',
    w: '#8b5a2b', l: '#e8e8e8', q: '#6b4220', y: '#e8c547', b: '#5b3a1c',
  };
  const archerFrames = [buildSprite(ARCHER_ROWS, ARCHER_PAL), buildSprite(archerBlinkRows, ARCHER_PAL)];

  const JOKER_ROWS = [
    'Y............Y',
    'rr..........pp',
    '.rr........pp.',
    '..rrr....ppp..',
    '...rrrrpppp...',
    '...kkkkkkkk...',
    '...kwwwwwwk...',
    '...kwbwwbwk...',
    '...kwwwwwwk...',
    '...kwwRRwwk...',
    '...kmwwwwmk...',
    '....kmmmmk....',
    '..YkYkYkYkY...',
    '..krrrrpppk...',
    '.krrrrrppppk..',
    'kwkrrrrppppkwk',
    'kwkYrrrppYpkwk',
    '..krrrrppppk..',
    '..kpppkrrrrk..',
    '..kppk.krrk...',
    '.kYYk...kYYk..',
    'kYYk.....kYYk.',
  ].map((r) => r.padEnd(14, '.'));
  const jokerLaughRows = [...JOKER_ROWS];
  jokerLaughRows[7] = '...kwkwwkwk...';
  jokerLaughRows[10] = '...kmkkkkmk...';
  jokerLaughRows[11] = '....kmRRmk....';
  const JOKER_PAL = {
    k: '#1a1420', r: '#d8322e', p: '#7a3fc8', Y: '#ffe14d', w: '#ffffff',
    b: '#1a1a1a', R: '#ff2020', m: '#c8202e',
  };
  const jokerFrames = [buildSprite(JOKER_ROWS, JOKER_PAL), buildSprite(jokerLaughRows, JOKER_PAL)];

  const KING_ROWS = [
    '..kjk..g.g.g.g..kjk.',
    '..kgk.kgjgggjgk.kgk.',
    '..kgkpkgggggggkpkgk.',
    '..kgkpkssssssskpkgk.',
    '..kgkpksessseskpkgk.',
    '..kgkpksWWWWWskpkgk.',
    '..kgkpkWWWWWWWkpkgk.',
    '..kgkwwkWWWWWkwwkgk.',
    '..kgkwdwrWWWrwdwkgk.',
    '..kgkrrrrgWgrrrrkgk.',
    'kgggkRrrrrgrrrrRgggk',
    'kGGGksrrrrgrrrrsGGGk',
    '..kgkpRRRRgRRRRpkgk.',
    '..kgkgggggggggggkgk.',
    '..kgkPkrrk.krrkPkgk.',
    '..kgkPkrrk.krrkPkgk.',
    '..kgkPkRRk.kRRkPkgk.',
    '..kgkkkkkkkkkkkkkgk.',
    '..kGk...........kGk.',
    '..kkk...........kkk.',
  ];
  const kingBlinkRows = [...KING_ROWS];
  kingBlinkRows[4] = '..kgkpkssssssskpkgk.';
  const KING_PAL = {
    k: '#1a1420', g: '#e8c547', G: '#b8901a', j: '#3ec8ff', s: '#f2c79b', e: '#1a1a1a',
    W: '#e8e4dc', w: '#ffffff', d: '#1a1420', r: '#c2202e', R: '#7a1520', p: '#5b2a86', P: '#3a1a58',
  };
  const kingFrames = [buildSprite(KING_ROWS, KING_PAL), buildSprite(kingBlinkRows, KING_PAL)];
  const KING_WALK_TOP = [
    '..g.g.g.g..',
    '.kgjgggjgk.',
    '.kgggggggk.',
    '.ksssssssk.',
    '.ksesssesk.',
    '.ksWWWWWsk.',
    '.kWWWWWWWk.',
    'wwkWWWWWkww',
    'wdwrWWWrwdw',
    'rrrrgWgrrrr',
    'RrrrrgrrrrR',
    'srrrrgrrrrs',
    'kRRRRgRRRRk',
  ];
  const kingWalkFrames = [
    buildSprite([...KING_WALK_TOP, '.krrk.krrk.', '.krrk.krrk.', '.kRRk.kRRk.'], KING_PAL),
    buildSprite([...KING_WALK_TOP, '..krrkrrk..', '..krrkrrk..', '..kRRkRRk..'], KING_PAL),
  ];

  function makeLightOrb(pulse) {
    const c = document.createElement('canvas');
    c.width = 24;
    c.height = 24;
    const g = c.getContext('2d');
    const disc = (r, col) => {
      g.fillStyle = col;
      for (let y = -r; y <= r; y++) {
        const hw = Math.round(Math.sqrt(r * r - y * y));
        g.fillRect(12 - hw, 12 + y, hw * 2, 1);
      }
    };
    g.fillStyle = '#ffe14d';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + (pulse ? Math.PI / 8 : 0);
      for (let t = 7; t < 12; t++) g.fillRect(Math.round(12 + Math.cos(a) * t), Math.round(12 + Math.sin(a) * t), 1, 1);
    }
    disc(8 + pulse, '#b8901a');
    disc(7 + pulse, '#ffd84a');
    disc(5 + pulse, '#fff3a8');
    disc(3, '#ffffff');
    return c;
  }
  const lightFrames = [makeLightOrb(0), makeLightOrb(1)];

  function makeSeraph(flap) {
    const c = document.createElement('canvas');
    c.width = 72;
    c.height = 64;
    const g = c.getContext('2d');
    const cx = 36, cy = 26;
    const dot = (x, y, s, col) => {
      g.fillStyle = col;
      g.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
    };
    const wing = (deg, spread, len, pass) => {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = ((deg + (i / (n - 1) - 0.5) * spread) * Math.PI) / 180;
        const L = len - Math.abs(i - (n - 1) / 2) * 1.5 + flap;
        for (let t = 9; t < L; t += 0.7) {
          const x = cx + Math.cos(a) * t, y = cy + Math.sin(a) * t;
          if (pass === 0) dot(x, y, 4, '#6b5a30');
          else dot(x, y, 2, t > L - 4 ? '#e8d8a0' : i % 2 ? '#fffbe8' : '#f2e6c0');
        }
      }
    };
    const band = (x0, y0, x1, y1, pass) => {
      const steps = 40;
      for (let s = 0; s <= steps; s++) {
        const p = s / steps;
        const w = Math.max(1, Math.round(5 * Math.sin(p * Math.PI) + 1));
        const x = x0 + (x1 - x0) * p, y = y0 + (y1 - y0) * p;
        if (pass === 0) dot(x, y, w + 2, '#6b5a30');
        else dot(x, y, w, s % 4 < 2 ? '#fffbe8' : '#e8d8a0');
      }
    };
    const WINGS = [[-103, 26, 28], [-77, 26, 28], [-150, 30, 34], [-30, 30, 34], [168, 28, 30], [12, 28, 30]];
    for (const pass of [0, 1]) {
      for (const [d, s, l] of WINGS) wing(d, s, l, pass);
      band(cx - 10, cy + 6, cx + 14, cy + 37, pass);
      band(cx + 10, cy + 6, cx - 14, cy + 37, pass);
    }
    const disc = (r, col) => {
      g.fillStyle = col;
      for (let y = -r; y <= r; y++) {
        const hw = Math.round(Math.sqrt(r * r - y * y));
        g.fillRect(cx - hw, cy + y, hw * 2, 1);
      }
    };
    disc(11, '#4a3810');
    disc(10, '#e8c547');
    disc(8, '#b8901a');
    disc(7, '#fff3a8');
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      dot(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 2, '#1a1420');
      dot(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 1, '#ffffff');
    }
    g.fillStyle = '#1a1420';
    g.fillRect(cx - 6, cy - 2, 12, 5);
    g.fillRect(cx - 4, cy - 3, 8, 7);
    g.fillStyle = '#ffffff';
    g.fillRect(cx - 5, cy - 1, 10, 3);
    g.fillRect(cx - 3, cy - 2, 6, 5);
    g.fillStyle = '#7a5a20';
    g.fillRect(cx - 2, cy - 2, 4, 5);
    g.fillStyle = '#1a1420';
    g.fillRect(cx - 1, cy - 1, 2, 3);
    return c;
  }
  const seraphFrames = [makeSeraph(0), makeSeraph(2)];

  // ---------- Tiles ----------
  function makeTile(withGrass, seed) {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    const r = rng(seed);
    g.fillStyle = '#8b5a2b';
    g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 22; i++) {
      g.fillStyle = r() < 0.6 ? '#6e4520' : '#a3713c';
      g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1 + Math.floor(r() * 2), 1);
    }
    if (withGrass) {
      for (let x = 0; x < 16; x++) {
        const depth = 4 + Math.floor(r() * 3);
        g.fillStyle = '#4caf3a';
        g.fillRect(x, 0, 1, depth);
        g.fillStyle = '#2f7d26';
        g.fillRect(x, depth, 1, 1);
        if (r() < 0.35) {
          g.fillStyle = '#7ad957';
          g.fillRect(x, Math.floor(r() * 2), 1, 1);
        }
      }
    }
    return c;
  }
  const grassTiles = [makeTile(true, 1), makeTile(true, 2), makeTile(true, 3)];

  function makeStoneTile(top, seed) {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    const r = rng(seed);
    g.fillStyle = '#7d8799';
    g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 18; i++) {
      g.fillStyle = r() < 0.5 ? '#69738a' : '#949db0';
      g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1 + Math.floor(r() * 3), 1);
    }
    g.fillStyle = '#5d6677';
    g.fillRect(Math.floor(r() * 10), 15, 7, 1);
    g.fillRect(15, Math.floor(r() * 10), 1, 6);
    if (top === 'snow') {
      for (let x = 0; x < 16; x++) {
        const d = 3 + Math.floor(r() * 3);
        g.fillStyle = '#ffffff';
        g.fillRect(x, 0, 1, d);
        g.fillStyle = '#c8d8ec';
        g.fillRect(x, d, 1, 1);
      }
    } else if (top === 'moss') {
      for (let x = 0; x < 16; x++) {
        const d = 2 + Math.floor(r() * 3);
        g.fillStyle = '#5a9a3a';
        g.fillRect(x, 0, 1, d);
        g.fillStyle = '#3d7a2a';
        g.fillRect(x, d, 1, 1);
      }
    }
    return c;
  }
  const stoneTiles = [makeStoneTile(null, 11), makeStoneTile(null, 12), makeStoneTile(null, 13)];
  const snowTiles = [makeStoneTile('snow', 14), makeStoneTile('snow', 15), makeStoneTile('snow', 16)];
  const mossTiles = [makeStoneTile('moss', 17), makeStoneTile('moss', 18), makeStoneTile('moss', 19)];
  const dirtTiles = [makeTile(false, 4), makeTile(false, 5), makeTile(false, 6)];

  // ---------- Level ----------
  const NPC_X = 960;
  const npcWall = { x: NPC_X - 2, y: -5000, w: 16, h: 5000 + GROUND_Y, invisible: true };
  const solids = [
    { x: 0, y: GROUND_Y, w: WORLD_W, h: 48 },
    { x: 192, y: 160, w: 48, h: 16 },
    { x: 320, y: 144, w: 64, h: 32 },
    { x: 384, y: 160, w: 32, h: 16 },
    { x: 640, y: 160, w: 80, h: 16 },
    { x: 1200, y: 160, w: 64, h: 16 },
    { x: 480, y: 120, w: 48, h: 6, oneWay: true },
    { x: 560, y: 96, w: 48, h: 6, oneWay: true },
    { x: 780, y: 128, w: 48, h: 6, oneWay: true },
    npcWall,
  ];

  // ---------- Jungle tree ----------
  const TREE_X = 1900;
  const TRUNK_W = 56;
  const TREE_SPAWN_X = 1790;
  const HOUSE = { x: 1990, w: 166, floorY: -240, top: -312 };
  const MONKEY_BRANCH = { x: 1840, y: -30, w: 72, h: 6, oneWay: true, branch: true };
  const BRANCHES = [
    { x: 1830, y: 142, w: 24 },
    { x: 1880, y: 106, w: 20 },
    { x: 1940, y: 72, w: 16 },
    { x: 1990, y: 40, w: 16 },
    { x: 1930, y: 4, w: 20 },
    MONKEY_BRANCH,
    { x: 1800, y: -66, w: 16 },
    { x: 1760, y: -102, w: 14 },
    { x: 1810, y: -138, w: 14 },
    { x: 1866, y: -172, w: 16 },
    { x: 1920, y: -206, w: 16 },
  ];
  for (const b of BRANCHES) solids.push({ h: 6, oneWay: true, branch: true, ...b });
  solids.push(
    { x: 1956, y: HOUSE.floorY, w: HOUSE.x + HOUSE.w - 1956 + 4, h: 10, wood: true, oneWay: true },
    { x: HOUSE.x + HOUSE.w, y: HOUSE.top - 20, w: 8, h: HOUSE.floorY - HOUSE.top + 20, invisible: true }
  );
  const VINE_WALL = { x: 2196, y: HOUSE.top - 160, w: 14, h: GROUND_Y - (HOUSE.top - 160), invisible: true };
  solids.push(VINE_WALL);
  const vines = { state: 'up', t: 0 };
  const BG_TRUNKS = [1700, 1765, 2060, 2250, 2340];
  const VINES = [[1878, -230, 90], [1896, -220, 60], [1922, -228, 120], [1846, -140, 50], [1958, -30, 70], [1806, -60, 40]];

  // ---------- Mountains & sky ----------
  const MOUNTAIN_X = 2640;
  const STEP_TOPS = [160, 136, 112, 88, 64, 40, 16, -8, -32, -56, -80, -104];
  const PLATEAU_Y = -120;
  STEP_TOPS.forEach((top, i) => {
    solids.push({ x: MOUNTAIN_X + i * 48, y: top, w: 48, h: 224 - top, stone: true });
  });
  const PLATEAU_X = MOUNTAIN_X + STEP_TOPS.length * 48;
  solids.push({ x: PLATEAU_X, y: PLATEAU_Y, w: WORLD_W - PLATEAU_X, h: 224 - PLATEAU_Y, stone: true });
  const WIND = { x: 3460, y: PLATEAU_Y };

  const SKY_Y = -1400;
  const YCLOUD = { x: 3330, w: 200 };
  solids.push(
    { x: YCLOUD.x, y: SKY_Y, w: YCLOUD.w, h: 12, oneWay: true, custom: true },
    { x: YCLOUD.x + YCLOUD.w, y: SKY_Y - 300, w: 8, h: 300, invisible: true }
  );
  const SKY_CLOUDS = [
    { x: 3270, y: SKY_Y - 20, w: 36 },
    { x: 3205, y: SKY_Y - 50, w: 30 },
    { x: 3140, y: SKY_Y - 30, w: 28 },
    { x: 3075, y: SKY_Y - 62, w: 26 },
    { x: 3005, y: SKY_Y - 40, w: 24 },
    { x: 2940, y: SKY_Y - 70, w: 26 },
    { x: 2870, y: SKY_Y - 46, w: 30 },
  ];
  const ANGEL_CLOUD = { x: 2690, y: SKY_Y - 40, w: 150 };
  for (const c of [...SKY_CLOUDS, ANGEL_CLOUD]) solids.push({ ...c, h: 12, oneWay: true, custom: true });
  solids.push({ x: ANGEL_CLOUD.x - 8, y: SKY_Y - 400, w: 8, h: 400, invisible: true });
  const GATE_X = ANGEL_CLOUD.x + 8;

  const CLOUD2_Y = -3000;
  const C2 = CLOUD2_Y;
  const inCloud2 = (y) => y < CLOUD2_Y + 400;
  const C2_START = { x: 100, y: C2, w: 150 };
  const C2_MID = { x: 950, y: C2 - 96, w: 110 };
  const C2_ARENA = { x: 1800, y: C2 - 220, w: 230 };
  const RETURN_GATE_X = C2_START.x + 6;
  const C2_CLOUDS = [
    C2_START,
    { x: 292, y: C2 - 28, w: 22 },
    { x: 357, y: C2 - 56, w: 20 },
    { x: 428, y: C2 - 36, w: 18 },
    { x: 494, y: C2 - 50, w: 24, rx: 20, spd: 0.03 },
    { x: 572, y: C2 - 84, w: 18 },
    { x: 636, y: C2 - 114, w: 16 },
    { x: 706, y: C2 - 82, w: 16 },
    { x: 790, y: C2 - 82, w: 24, rx: 30, spd: 0.04 },
    { x: 885, y: C2 - 104, w: 16 },
    C2_MID,
    { x: 1096, y: C2 - 110, w: 22, ry: 18, spd: 0.035 },
    { x: 1164, y: C2 - 150, w: 14 },
    { x: 1228, y: C2 - 122, w: 14 },
    { x: 1312, y: C2 - 140, w: 20, rx: 28, spd: 0.05 },
    { x: 1396, y: C2 - 174, w: 14 },
    { x: 1460, y: C2 - 185, w: 20, ry: 24, spd: 0.04 },
    { x: 1524, y: C2 - 226, w: 14 },
    { x: 1588, y: C2 - 198, w: 12 },
    { x: 1640, y: C2 - 230, w: 12 },
    { x: 1713, y: C2 - 214, w: 22, rx: 24, spd: 0.05 },
    C2_ARENA,
  ];
  const C2_MOVERS = C2_CLOUDS.filter((c) => c.spd);
  C2_CLOUDS.forEach((c, i) => {
    Object.assign(c, { h: 12, oneWay: true, custom: true, bx: c.x, by: c.y, ph: i * 1.3 });
    solids.push(c);
  });
  const arenaWall = { x: C2_ARENA.x + C2_ARENA.w, y: C2 - 800, w: 8, h: 600, invisible: true };
  solids.push({ x: C2_START.x - 8, y: C2 - 600, w: 8, h: 600, invisible: true }, arenaWall);

  const STAIR_X = C2_ARENA.x + C2_ARENA.w;
  const STAIR_W = 26, STAIR_RISE = 16, STAIR_COUNT = 18;
  const STAIRS = [];
  for (let i = 0; i <= STAIR_COUNT; i++) {
    const top = C2_ARENA.y - STAIR_RISE * (i + 1);
    STAIRS.push({ x: STAIR_X + i * STAIR_W, y: top, w: i === STAIR_COUNT ? 230 : STAIR_W, h: C2 + 140 - top, custom: true, noDeco: true });
  }
  const STAIR_TOP = STAIRS[STAIR_COUNT];
  solids.push(...STAIRS, { x: STAIR_TOP.x + STAIR_TOP.w, y: STAIR_TOP.y - 400, w: 8, h: 400, invisible: true });

  const FAR_PEAKS = [[1700, 70], [1800, 95], [1910, 80], [2000, 110], [2110, 85], [2210, 105], [2320, 90], [2420, 115], [2520, 80]];

  const trees = [60, 150, 270, 450, 620, 740, 880, 1100, 1300, 1450, 1560, 1640, 2440, 2540];
  const fences = [[100, 6], [700, 4], [1050, 5]];

  const decoRand = rng(42);
  const flowers = [];
  for (let i = 0; i < 160; i++) {
    flowers.push({
      x: Math.floor(decoRand() * 2640),
      kind: decoRand() < 0.55 ? 'tuft' : 'flower',
      color: ['#ffe14d', '#ff6f91', '#ffffff', '#b07cff'][Math.floor(decoRand() * 4)],
    });
  }

  function groundTopAt(x, fromY = -Infinity) {
    const deco = fromY === -Infinity;
    let top = GROUND_Y;
    for (const s of solids) {
      if (s.invisible || (deco && (s.oneWay || s.noDeco))) continue;
      if (x >= s.x && x < s.x + s.w && s.y >= fromY && s.y < top) top = s.y;
    }
    return top;
  }

  const clouds = [];
  const cr = rng(7);
  for (let i = 0; i < 9; i++) {
    clouds.push({ x: cr() * 900, y: 12 + cr() * 50, s: 1 + Math.floor(cr() * 2) });
  }

  // ---------- Moves ----------
  const PUNCH = { name: 'PUNCH', dmg: 2, type: 'normal' };
  const FIRELITE = { name: 'FIRELITE', dmg: 3, type: 'fire', last: true, special: true, anim: 'fire' };
  const LEAF_STORM = { name: 'LEAF STORM', dmg: 3, type: 'grass', special: true, anim: 'leaf' };
  const PLAYER_MOVES = [PUNCH];
  const PLAYER_TYPE = 'normal';
  const ANGELIC_ACE = { name: 'ANGELIC ACE', dmg: 3, type: 'holy', anim: 'ace' };
  const ANGELISM = { name: 'ANGELISM', dmg: 4, type: 'holy', special: true, anim: 'beam' };
  const AERIAL_DESCENT = { name: 'AERIAL DESCENT', dmg: 4, type: 'flying', special: true, anim: 'dive' };
  const BEAM_FIRE_X = { name: 'BEAM FIRE X', dmg: 5, type: 'fire', special: true, anim: 'xbeam' };
  const GLOW_EXHALE = { name: 'GLOW EXHALE', dmg: 4, type: 'light', special: true, anim: 'gust' };
  const LIGHT_OF_SECRETS = { name: 'LIGHT OF SECRETS', dmg: 5, type: 'light', special: true, anim: 'spot' };
  const SWORD_SLASH = { name: 'SWORD SLASH', dmg: 1, hits: 4, type: 'normal', anim: 'slash' };
  const SLASH_OBLIVION = { name: 'SLASH OBLIVION', dmg: 5, type: 'normal', special: true, anim: 'oblivion' };
  const BOW_SHOT = { name: 'BOW SHOT', dmg: 5, type: 'normal', anim: 'bow' };
  const RAIN_OF_ARROWS = { name: 'RAIN OF ARROWS', dmg: 1, hits: 6, type: 'fire', special: true, anim: 'rain' };
  const GAG_PUNCH = { name: 'PUNCH', dmg: 2, type: 'normal', anim: 'glove' };
  const JACK_IN_THE_BOX = { name: 'JACK IN THE BOX', dmg: 5, type: 'normal', anim: 'jack' };
  const JOKER_POWER = { name: 'JOKER POWER', dmg: 6, type: 'normal', special: true, anim: 'cards' };
  const ROYAL_PUNCH = { name: 'PUNCH', dmg: 2, type: 'normal', anim: 'kpunch' };
  const MIDAS_TOUCH = { name: 'MIDAS TOUCH', dmg: 4, type: 'normal', anim: 'midas' };
  const KINGS_CRAFT = { name: "KING'S CRAFT", dmg: 5, type: 'normal', anim: 'throne' };
  const KINGS_GRAIL = { name: "KING'S GRAIL", dmg: 2, hits: 3, type: 'normal', special: true, anim: 'grail' };
  const SUPER_EFFECTIVE = { fire: ['grass', 'holy'] };

  function calcDamage(move, defType) {
    const sup = (SUPER_EFFECTIVE[move.type] || []).includes(defType);
    return { dmg: move.dmg + (sup ? 1 : 0), sup };
  }

  const ENEMIES = {
    redKid: {
      name: 'RED KID', hp: 10, type: 'normal', moves: [PUNCH, FIRELITE],
      frames: [npcFrames[0], npcBlink], reward: 'fireGem', bg: 'grass',
    },
    angel: {
      name: 'ANGEL', hp: 25, type: 'holy', moves: [PUNCH, ANGELIC_ACE, ANGELISM], weights: [65, 20, 15],
      frames: angelFrames, reward: 'angelCrystal', bg: 'heaven',
    },
    lightGods: {
      name: 'LIGHT OF GODS', hp: 30, type: 'light', moves: [PUNCH, GLOW_EXHALE, LIGHT_OF_SECRETS],
      frames: lightFrames, bg: 'heaven', glow: true, phase2: true,
    },
    skyBird: {
      name: 'SKY BIRD', hp: 25, type: 'flying', moves: [PUNCH, AERIAL_DESCENT, BEAM_FIRE_X],
      weights: [65, 25, 10], frames: birdFrames, reward: 'skyGem', bg: 'cloud',
    },
    monkey: {
      name: 'MONKEY', hp: 20, type: 'grass', moves: [PUNCH, LEAF_STORM],
      frames: monkeyFrames, reward: 'leafGem', bg: 'forest',
    },
    knight: {
      name: 'KNIGHT', hp: 35, type: 'normal', moves: [PUNCH, SWORD_SLASH, SLASH_OBLIVION],
      weights: [70, 20, 10], frames: knightFrames, reward: 'knightCrystal', bg: 'castle',
    },
    archer: {
      name: 'ARCHER', hp: 40, type: 'normal', moves: [PUNCH, BOW_SHOT, RAIN_OF_ARROWS],
      weights: [70, 20, 10], frames: archerFrames, reward: 'archerCrystal', bg: 'castle',
    },
    joker: {
      name: 'JOKER', hp: 40, type: 'normal', moves: [GAG_PUNCH, JACK_IN_THE_BOX, JOKER_POWER],
      weights: [60, 25, 15], frames: jokerFrames, reward: 'jokerCrystal', bg: 'king', goofy: true,
    },
    king: {
      name: 'KING', hp: 45, type: 'normal', moves: [ROYAL_PUNCH, MIDAS_TOUCH, KINGS_CRAFT, KINGS_GRAIL],
      weights: [60, 15, 15, 10], frames: kingFrames, reward: 'kingCrystal', bg: 'royal',
    },
  };
  ENEMIES.lightGodsMaze = { ...ENEMIES.lightGods, phase2: false, music: 'battle_lightGods' };

  // ---------- Items ----------
  const ITEMS = {
    fireGem: { name: 'FIRE GEM', desc: 'GRANTS FIRELITE IN BATTLE', kind: 'gem', moves: [FIRELITE] },
    leafGem: { name: 'LEAF GEM', desc: 'LEAF STORM, 20 MAX HP', kind: 'gem', moves: [LEAF_STORM] },
    swapCrystal: { name: 'SWAP CRYSTAL', desc: 'SWAP GEMS MID BATTLE', kind: 'key', moves: [] },
    angelCrystal: {
      name: 'ANGELIC CRYSTAL', desc: 'ACE + ANGELISM, 25 MAX HP', kind: 'gem',
      moves: [ANGELIC_ACE, ANGELISM], hpBonus: 5,
    },
    skyGem: {
      name: 'SKY GEM', desc: 'DESCENT + BEAM FIRE X, 25 MAX HP', kind: 'gem',
      moves: [AERIAL_DESCENT, BEAM_FIRE_X], hpBonus: 5,
    },
    knightCrystal: {
      name: 'KNIGHT CRYSTAL', desc: 'SLASH + OBLIVION, 35 MAX HP', kind: 'gem',
      moves: [SWORD_SLASH, SLASH_OBLIVION], hpBonus: 15,
    },
    archerCrystal: {
      name: 'ARCHER CRYSTAL', desc: 'BOW SHOT + ARROW RAIN, 40 MAX HP', kind: 'gem',
      moves: [BOW_SHOT, RAIN_OF_ARROWS], hpBonus: 20,
    },
    jokerCrystal: {
      name: 'JOKER CRYSTAL', desc: 'JACK IN THE BOX + JOKER POWER, 40 MAX HP', kind: 'gem',
      moves: [JACK_IN_THE_BOX, JOKER_POWER], hpBonus: 20,
    },
    kingCrystal: {
      name: 'KING CRYSTAL', desc: "MIDAS + CRAFT + GRAIL, 45 MAX HP", kind: 'gem',
      moves: [MIDAS_TOUCH, KINGS_CRAFT, KINGS_GRAIL], hpBonus: 25,
    },
    lightGem: {
      name: 'LIGHT GEM', desc: 'EXHALE + SECRETS, 30 MAX HP', kind: 'gem',
      moves: [GLOW_EXHALE, LIGHT_OF_SECRETS], hpBonus: 10,
    },
  };
  const INV_SIZE = 10;
  const inventory = new Array(INV_SIZE).fill(null);
  const inv = { open: false, sel: -1, equipped: null };

  function addItem(id) {
    if (inventory.includes(id)) return;
    const i = inventory.indexOf(null);
    if (i >= 0) inventory[i] = id;
  }

  function getPlayerMaxHp() {
    return PLAYER_MAX_HP + ((inv.equipped && ITEMS[inv.equipped].hpBonus) || 0);
  }

  function getPlayerMoves() {
    const extra = inv.equipped ? ITEMS[inv.equipped].moves : [];
    return [...PLAYER_MOVES, ...extra];
  }
  const PLAYER_MAX_HP = 20;

  // ---------- State ----------
  const game = { mode: 'world', transT: 0 };
  const fade = { alpha: 0, dir: 0, cb: null };
  function fadeThen(cb) {
    fade.dir = 1;
    fade.cb = cb;
  }

  const player = {
    x: SPAWN_X, y: GROUND_Y - 18, w: 8, h: 18,
    vx: 0, vy: 0, face: 1, onGround: false,
    coyote: 0, jumpBuf: 0, walk: 0,
  };

  const npc = { x: NPC_X, y: GROUND_Y - 18, face: -1, t: 0, walk: 0, state: 'idle' };

  const INTRO_LINES = [
    'HALT, {NAME}!',
    'I AM THE GUARDIAN OF THE GRASSLANDS.',
    'NONE MAY PASS THIS WAY... NOT EVEN YOU.',
    'YOU LOOK JUST LIKE ME... BUT BLUE.',
    'BLUE IS A HORRIBLE COLOR!',
    'IF YOU WANT TO CROSS... FIGHT ME!',
  ];
  const WIN_LINES = ['OK, YOU WIN. YOU CAN CROSS.'];

  const monkey = {
    x: MONKEY_BRANCH.x + 44, y: MONKEY_BRANCH.y - 16, face: 1, t: 0,
    vx: 0, vy: 0, state: 'idle',
  };
  const MONKEY_LINES = [
    'OOH OOH AH AH!',
    'YOU NO GO UP TREE HOUSE! IS MONKEY TREE!',
    'EEK EEK! CHK CHK CHK! OOOH AAH EEK EEK!',
    '{NAME} WANT GO UP? THEN {NAME} FIGHTS ME!',
    'ME BEATS YOU GOOD! OOH OOH!',
  ];
  const angel = { x: ANGEL_CLOUD.x + 80, y: ANGEL_CLOUD.y - 24, face: 1, t: 0, vy: 0, state: 'idle' };
  const ANGEL_LINES = [
    'HALT, {NAME} THE MORTAL!',
    'YOU HAVE FLOWN ALL THE WAY INTO HEAVEN...',
    'BUT YOU CANNOT ENTER THE GATES!',
    'NO MORTAL MAY PASS WITHOUT A TRIAL.',
    'BEHOLD THE POWER OF THE ANGELIC CRYSTAL!',
  ];
  const ANGEL_WIN_LINES = [
    'IMPOSSIBLE... A MORTAL HAS BESTED ME.',
    'TAKE THE ANGELIC CRYSTAL. YOU EARNED IT.',
    'FAREWELL, BRAVE ONE!',
  ];
  const gate = { open: 0 };
  const angelBeaten = () => angel.state === 'leaving' || angel.state === 'gone';

  const KNIGHT_LINES = [
    'HALT! I AM THE KNIGHT OF THE CASTLE GATE.',
    'YOU WOKE UP IN MY CASTLE, STRANGER...',
    'MY BLADE HAS NEVER KNOWN DEFEAT.',
    'DRAW YOUR WEAPON, {NAME}!',
  ];
  const KNIGHT_WIN_LINES = [
    'MY BLADE... HAS BEEN BROKEN.',
    'TAKE THE KNIGHT CRYSTAL, WITH HONOR.',
    'THE GATE IS YOURS, CHAMPION.',
  ];

  const bird = { x: C2_ARENA.x + 150, y: C2_ARENA.y - 22, face: -1, t: 0, vy: 0, state: 'idle' };
  const c2 = { checkpoint: false };
  const BIRD_LINES = [
    'SQUAWK! WHO DARES CLIMB TO MY CLOUDS?',
    'I AM THE SKY BIRD, RULER OF THE WIND!',
    'THE ANGEL LET YOU THROUGH? HMPH!',
    'WITH THIS SKY GEM I COMMAND THE STORM.',
    'PREPARE TO FALL, {NAME}!',
  ];
  const BIRD_WIN_LINES = [
    'SQUAWK... MY FEATHERS ARE ALL RUFFLED.',
    'FINE! TAKE THE SKY GEM. THE WIND IS YOURS.',
    'CAW CAW! UNTIL WE MEET AGAIN!',
  ];

  const LIGHT_HOVER_Y = STAIR_TOP.y - 48;
  const light = { x: STAIR_TOP.x + 150, y: LIGHT_HOVER_Y, t: 0, state: 'idle' };
  const LIGHT_LINES = [
    '{NAME}... YOU HAVE CLIMBED TOO HIGH.',
    'I AM THE LIGHT OF GODS.',
    'YOU BEAT THE ANGEL. YOU BEAT THE BIRD.',
    'BUT YOU CANNOT BEAT ME!',
    'DARKNESS FADES. SHADOWS FLEE.',
    'THE LIGHT WILL ALWAYS WIN!',
  ];

  const MONKEY_WIN_LINES = [
    'NO WAY! YOU WINNED ME?!',
    'ME NO BELIEVE... OOH OOH AH...',
    'FINE! YOU GO UP. MONKEY GOES BYE BYE!',
  ];

  const house = { alpha: 1, inside: false };
  const crystal = { x: HOUSE.x + 103, y: HOUSE.floorY - 12, taken: false };
  const toast = { text: '', t: 0 };

  function nearCrystal() {
    return !crystal.taken && house.inside && Math.abs(player.x + 4 - (crystal.x + 4)) < 14;
  }
  function pickUpCrystal() {
    crystal.taken = true;
    addItem('swapCrystal');
    sfx('itemGet');
    toast.text = 'YOU GOT THE SWAP CRYSTAL!';
    toast.t = 180;
  }
  const fallingLeaves = [];

  const dialog = { active: false, lines: [], line: 0, chars: 0, hold: 0, onDone: null, speaker: '' };
  function startDialog(lines, onDone, speaker = 'RED KID') {
    lines = lines.map((l) => l.split('{NAME}').join(playerName));
    Object.assign(dialog, { active: true, lines, line: 0, chars: 0, hold: 0, onDone, speaker });
  }

  const particles = [];
  function dust(x, y, n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -Math.random() * 0.8,
        life: 20 + Math.random() * 10,
      });
    }
  }

  let battle = null;
  let tick = 0;
  let cam = 0;
  let camY = 0;
  let lastStair = -1;
  let titleStart = null;
  const STORE = { name: 'powerland_name', save: 'powerland_classic', board: 'powerland_board', rep: 'powerland_rep_', watch: 'powerland_watch' };
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v === null ? d : JSON.parse(v);
      } catch (err) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
        return true;
      } catch (err) {
        return false;
      }
    },
    del(k) {
      try {
        localStorage.removeItem(k);
      } catch (err) {}
    },
  };
  let playerName = store.get(STORE.name, '') || 'HERO';
  const run = { mode: null, frames: 0, done: false, finalFrames: 0, rank: 0 };
  const rec = { f: 0, seed: 0, ev: [], queue: [] };
  const replay = {
    on: false, ev: [], i: 0, speed: 1, name: '', frames: 0,
    paused: true, dl: false, doneT: 0, recorder: null, chunks: [], vcan: null, vctx: null, saved: false, failed: false,
  };
  const nativeRandom = Math.random;
  let gameRandom = nativeRandom;
  function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const menu = { screen: 'splash', t: 0, typing: store.get(STORE.name, '') || '', focus: false, saved: 0, confirmClear: 0, board: false };
  let titleInfo = { main: 'GRASSLANDS', sub: '- CHAPTER I -', hint: true };

  // ---------- Input ----------
  const keys = {};
  const JUMP_KEYS = ['w', 'arrowup', ' '];
  const BLOCK_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '];
  const CONFIRM_KEYS = ['enter', ' ', 'z'];
  const mouse = { x: -1, y: -1 };

  // Set to true to bring back the admin panel (TAB).
  const ADMIN_ENABLED = false;

  const recording = () => run.mode === 'speedrun' && !run.done && game.mode !== 'menu' && !replay.on;

  function queueInput(ev) {
    const lastEv = rec.queue[rec.queue.length - 1];
    if (ev[0] === 2 && lastEv && lastEv[0] === 2) rec.queue[rec.queue.length - 1] = ev;
    else rec.queue.push(ev);
  }

  function applyInput(ev) {
    if (ev[0] === 0 && replay.on && ev[1].toLowerCase() === 'm') return;
    if (ev[0] === 0) onKeyDown({ key: ev[1], repeat: false, preventDefault() {} });
    else if (ev[0] === 1) keys[ev[1].toLowerCase()] = false;
    else if (ev[0] === 2) onMove({ x: ev[1], y: ev[2] });
    else if (ev[0] === 3) onDown({ x: ev[1], y: ev[2] });
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (BLOCK_KEYS.includes(k) || k === 'tab') e.preventDefault();
    if (replay.on) {
      if (!e.repeat) replayKey(k);
      return;
    }
    if (recording()) {
      if (!e.repeat) queueInput([0, e.key]);
      return;
    }
    onKeyDown(e);
  });
  window.addEventListener('keyup', (e) => {
    if (replay.on) return;
    if (recording()) queueInput([1, e.key]);
    else keys[e.key.toLowerCase()] = false;
  });
  cvs.addEventListener('mousemove', (e) => {
    if (replay.on) return;
    const p = toCanvas(e);
    if (recording()) queueInput([2, Math.floor(p.x), Math.floor(p.y)]);
    else onMove(p);
  });
  cvs.addEventListener('mousedown', (e) => {
    if (replay.on) {
      if (replay.paused) startPlayback();
      return;
    }
    const p = toCanvas(e);
    if (recording()) queueInput([3, Math.floor(p.x), Math.floor(p.y)]);
    else onDown(p);
  });

  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    if (game.mode === 'menu') {
      if (!e.repeat || k === 'backspace') menuKey(e, k);
      return;
    }
    if (run.mode === 'speedrun' && k === ' ' && dialog.active && !admin.open && !e.repeat) {
      sfx('cursor');
      if (dialog.line < dialog.lines.length - 1) {
        dialog.line++;
        dialog.chars = 0;
        dialog.hold = 0;
      } else {
        dialog.active = false;
        if (dialog.onDone) dialog.onDone();
      }
      return;
    }
    if (ADMIN_ENABLED && !admin.open && k === 'tab' && !e.repeat) {
      admin.open = true;
      admin.sel = 0;
      admin.page = 'main';
      sfx('open');
      return;
    }
    if (admin.open) {
      keys[k] = true;
      if (!e.repeat) adminKey(k);
      return;
    }
    if (k === 'm' && !e.repeat && window.Sound) {
      const off = window.Sound.toggleMute();
      toast.text = off ? 'SOUND OFF (M)' : 'SOUND ON (M)';
      toast.t = 90;
    }
    if (inv.open) {
      if (k === 'escape' || k === 'i') {
        inv.open = false;
        sfx('close');
      }
    } else if (k === 'i' && canOpenInventory()) {
      openInventory();
    } else if (k === 'e' && game.mode === 'world' && !dialog.active && nearCrystal()) {
      pickUpCrystal();
    } else if (game.mode === 'battle' && !e.repeat && battle && battle.cards) {
      if (k === 'arrowleft' || k === 'a') moveCard(-1);
      if (k === 'arrowright' || k === 'd') moveCard(1);
      if (CONFIRM_KEYS.includes(k)) pickCard();
    } else if (game.mode === 'battle' && !e.repeat) {
      if (CONFIRM_KEYS.includes(k)) battleConfirm();
      if ((k === 'escape' || k === 'backspace') && battle.phase === 'swap') {
        battle.phase = 'choose';
        battle.sel = 0;
      }
      if (k === 'q' && battle.phase === 'choose' && hasSwap()) {
        battle.sel = -1;
        battleConfirm();
      }
      if (k === 'arrowleft' || k === 'a') moveCursor(-1, 0);
      if (k === 'arrowright' || k === 'd') moveCursor(1, 0);
      if (k === 'arrowup' || k === 'w') moveCursor(0, -1);
      if (k === 'arrowdown' || k === 's') moveCursor(0, 1);
    } else if (JUMP_KEYS.includes(k) && !keys[k]) {
      player.jumpBuf = 7;
    }
    keys[k] = true;
  }
  const jumpHeld = () => JUMP_KEYS.some((k) => keys[k]);

  function toCanvas(e) {
    const r = cvs.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  }
  function onMove(p) {
    Object.assign(mouse, p);
    let pointer = false;
    if (game.mode === 'menu') {
      pointer = menu.screen === 'splash' || !!menuHover(mouse);
    } else if (inv.open) {
      pointer = invHitTest(mouse.x, mouse.y) !== null;
    } else if (canOpenInventory()) {
      pointer = inRect(mouse, BAG_BTN);
    } else if (game.mode === 'battle' && battle && battle.cards && battle.cards.state === 'pick') {
      for (let i = 0; i < 5; i++) {
        if (inRect(mouse, cardRect(i))) {
          if (battle.cards.sel !== i) sfx('cursor');
          battle.cards.sel = i;
          pointer = true;
        }
      }
    } else if (game.mode === 'battle' && inMenu()) {
      const i = slotAt(mouse.x, mouse.y);
      if (menuItemAt(i)) battle.sel = i;
      pointer = !!menuItemAt(i);
    }
    cvs.style.cursor = pointer ? 'pointer' : 'default';
  }

  function onDown(p) {
    if (game.mode === 'menu') {
      menuClick(p);
      return;
    }
    if (admin.open) {
      const i = adminOptions().findIndex((o, j) => inRect(p, adminRowRect(j)));
      if (i >= 0) adminChoose(i);
      return;
    }
    if (inv.open) {
      invClick(p);
      return;
    }
    if (canOpenInventory()) {
      if (inRect(p, BAG_BTN)) openInventory();
      return;
    }
    if (game.mode !== 'battle') return;
    if (battle && battle.cards) {
      for (let i = 0; i < 5; i++) if (inRect(p, cardRect(i))) pickCard(i);
      return;
    }
    if (inMenu()) {
      const i = slotAt(p.x, p.y);
      if (menuItemAt(i)) {
        battle.sel = i;
        battleConfirm();
      }
    } else {
      battleConfirm();
    }
  }

  // ---------- Inventory ----------
  const inRect = (p, r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
  const BAG_BTN = { x: W - 28, y: 4, w: 24, h: 22 };
  const INV_PANEL = { x: 72, y: 20, w: 240, h: 176 };
  const INV_CLOSE = { x: INV_PANEL.x + INV_PANEL.w - 20, y: INV_PANEL.y + 6, w: 14, h: 14 };
  const EQUIP_BTN = { x: INV_PANEL.x + INV_PANEL.w / 2 - 42, y: 170, w: 84, h: 18 };
  const invSlots = () => Math.min(INV_SIZE, 1 + inventory.filter(Boolean).length);

  function invSlotRect(i) {
    return { x: 90 + (i % 5) * 42, y: 48 + Math.floor(i / 5) * 42, w: 36, h: 36 };
  }

  const isGem = (id) => !!id && ITEMS[id].kind === 'gem';

  function canOpenInventory() {
    const castleOk = game.mode === 'castle' && castle.awake && !castle.leaving;
    const mazeOk = game.mode === 'maze' && !maze.leaving;
    const kingOk = game.mode === 'king' && !kingRoom.leaving;
    return (game.mode === 'world' || castleOk || mazeOk || kingOk) && !dialog.active && fade.dir === 0;
  }

  function openInventory() {
    inv.open = true;
    inv.sel = -1;
    sfx('open');
  }

  function invHitTest(x, y) {
    const p = { x, y };
    if (inRect(p, INV_CLOSE)) return 'close';
    if (inRect(p, EQUIP_BTN) && isGem(inventory[inv.sel])) return 'equip';
    for (let i = 0; i < invSlots(); i++) {
      if (inRect(p, invSlotRect(i))) return i;
    }
    return null;
  }

  function invClick(p) {
    const hit = invHitTest(p.x, p.y);
    if (hit === 'close') {
      inv.open = false;
      sfx('close');
    } else if (hit === 'equip') {
      const id = inventory[inv.sel];
      inv.equipped = inv.equipped === id ? null : id;
      sfx('equip');
    } else if (typeof hit === 'number') {
      inv.sel = hit;
      sfx('cursor');
    }
  }

  const overlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function wallActive(s) {
    if (s === arenaWall) return bird.state !== 'leaving' && bird.state !== 'gone';
    if (s === VINE_WALL) return vines.state !== 'gone';
    return s !== npcWall || npc.state !== 'gone';
  }

  // ---------- World update ----------
  function updateDialog() {
    if (!dialog.active) return;
    const text = dialog.lines[dialog.line];
    if (dialog.chars < text.length) {
      if (tick % 2 === 0) {
        dialog.chars++;
        if (dialog.chars % 2 === 0 && text[dialog.chars - 1] !== ' ') sfx('blip', dialog.speaker);
      }
    } else if (++dialog.hold > 100) {
      if (dialog.line < dialog.lines.length - 1) {
        dialog.line++;
        dialog.chars = 0;
        dialog.hold = 0;
      } else {
        dialog.active = false;
        if (dialog.onDone) dialog.onDone();
      }
    }
  }

  function updateWorld() {
    const locked = dialog.active || inv.open || game.mode !== 'world' || light.state === 'descending';
    const left = !locked && (keys['a'] || keys['arrowleft']);
    const right = !locked && (keys['d'] || keys['arrowright']);
    const target = ((right ? 1 : 0) - (left ? 1 : 0)) * 1.6;

    for (const s of C2_MOVERS) {
      const riding = player.onGround && Math.abs(player.y + player.h - s.y) < 1 &&
        player.x + player.w > s.x && player.x < s.x + s.w;
      const wave = Math.sin(tick * s.spd + s.ph);
      const nx = s.bx + (s.rx ? wave * s.rx : 0);
      const ny = s.by + (s.ry ? wave * s.ry : 0);
      if (riding) {
        player.x += nx - s.x;
        player.y += ny - s.y;
      }
      s.x = nx;
      s.y = ny;
    }

    player.vx += (target - player.vx) * 0.3;
    if (Math.abs(player.vx) < 0.05) player.vx = 0;
    if (target !== 0) player.face = Math.sign(target);

    player.coyote = player.onGround ? 6 : player.coyote - 1;
    if (player.jumpBuf > 0) player.jumpBuf--;
    if (!locked && player.jumpBuf > 0 && player.coyote > 0) {
      player.vy = -5.4;
      player.coyote = 0;
      player.jumpBuf = 0;
      dust(player.x + 4, player.y + player.h, 5);
      sfx('jump');
    }
    if (!jumpHeld() && player.vy < -2) player.vy *= 0.8;
    player.vy = Math.min(player.vy + 0.28, 6);

    player.x += player.vx;
    for (const s of solids) {
      if (s.oneWay || !wallActive(s) || !overlap(player, s)) continue;
      if (player.vx > 0) player.x = s.x - player.w;
      else if (player.vx < 0) player.x = s.x + s.w;
      player.vx = 0;
    }
    player.x = clamp(player.x, 0, WORLD_W - player.w);

    const wasGround = player.onGround;
    const prevBottom = player.y + player.h;
    player.y += player.vy;
    player.onGround = false;
    let landedOn = null;
    for (const s of solids) {
      if (!wallActive(s) || !overlap(player, s)) continue;
      if (s.oneWay) {
        if (player.vy >= 0 && prevBottom <= s.y + 0.01) {
          player.y = s.y - player.h;
          player.vy = 0;
          player.onGround = true;
          landedOn = s;
        }
        continue;
      }
      if (player.vy > 0) {
        player.y = s.y - player.h;
        player.onGround = true;
        landedOn = s;
      } else {
        player.y = s.y + s.h;
      }
      player.vy = 0;
    }
    if (player.onGround && !wasGround) {
      dust(player.x + 4, player.y + player.h, 6);
      const si = STAIRS.indexOf(landedOn);
      if (si === STAIR_COUNT && lastStair !== STAIR_COUNT) sfx('stairTop');
      else if (si >= 0 && si < STAIR_COUNT) sfx('stair', si);
      else sfx('land');
    }
    if (player.onGround) lastStair = STAIRS.indexOf(landedOn);
    if (player.onGround && Math.abs(player.vx) > 0.3) {
      const prevWalk = player.walk;
      player.walk += Math.abs(player.vx) * 0.12;
      if (Math.floor(player.walk / 1.6) !== Math.floor(prevWalk / 1.6)) sfx('step');
      if (tick % 14 === 0) dust(player.x + 4, player.y + player.h, 1);
    } else {
      player.walk = 0;
    }

    cam = Math.round(clamp(player.x + 4 - W / 2, 0, WORLD_W - W));
    camY += (camYTargetFor(player.y) - camY) * 0.12;

    if (
      game.mode === 'world' && !dialog.active && fade.dir === 0 &&
      player.x + player.w > WIND.x - 12 && player.x < WIND.x + 12 &&
      player.y < WIND.y && player.y + player.h > WIND.y - 50
    ) {
      startSky();
    }

    const canTrigger = game.mode === 'world' && !inv.open && !dialog.active;

    npc.t++;
    if (npc.state === 'idle' || npc.state === 'talk' || npc.state === 'beaten') {
      npc.face = player.x < npc.x ? -1 : 1;
    }
    if (npc.state === 'idle' && canTrigger && player.y > GROUND_Y - 120 && Math.abs(player.x + 4 - (npc.x + 6)) < 70) {
      npc.state = 'talk';
      startDialog(INTRO_LINES, () => startBattleTransition('redKid', winRedKid, loseRedKid));
    }

    angel.t++;
    if (angel.state === 'idle' || angel.state === 'talk' || angel.state === 'beaten') {
      angel.face = player.x < angel.x ? -1 : 1;
    }
    if (
      angel.state === 'idle' && canTrigger &&
      player.onGround && player.y < SKY_Y && player.y > SKY_Y - 200 &&
      player.x + player.w > ANGEL_CLOUD.x && player.x < ANGEL_CLOUD.x + ANGEL_CLOUD.w
    ) {
      angel.state = 'talk';
      startDialog(ANGEL_LINES, () => startBattleTransition('angel', winAngel, loseAngel), 'ANGEL');
    }
    if (angel.state === 'leaving') {
      angel.vy = Math.max(angel.vy - 0.12, -5);
      angel.y += angel.vy;
      if (angel.y + 22 < camY - 10) angel.state = 'gone';
    }
    if (
      game.mode === 'world' && fade.dir === 0 &&
      player.y > SKY_Y + 140 && player.y < SKY_Y + 1000
    ) {
      sfx('fall');
      fadeThen(() => {
        if (angel.state === 'talk') angel.state = 'idle';
        respawnAt(YCLOUD.x + 40, SKY_Y - 18);
      });
    }

    const gateWas = gate.open;
    gate.open = angelBeaten() ? Math.min(1, gate.open + 0.02) : 0;
    if (gateWas === 0 && gate.open > 0) sfx('gateOpen');
    const enterable = game.mode === 'world' && !dialog.active && fade.dir === 0 && player.onGround;
    if (
      enterable && gate.open >= 1 && Math.abs(player.y + player.h - ANGEL_CLOUD.y) < 2 &&
      player.x + player.w > GATE_X + 18 && player.x < GATE_X + 38
    ) {
      sfx('portal');
      fadeThen(() => {
        respawnAt(C2_START.x + 80, C2 - 18);
        showTitle('THE CLOUD MAP', '- WORLD 2 : PART 2 -');
      });
    }
    if (
      enterable && Math.abs(player.y + player.h - C2_START.y) < 2 &&
      player.x + player.w > RETURN_GATE_X + 18 && player.x < RETURN_GATE_X + 38
    ) {
      sfx('portal');
      fadeThen(() => respawnAt(GATE_X + 70, ANGEL_CLOUD.y - 18));
    }

    if (player.onGround && Math.abs(player.y + player.h - C2_MID.y) < 2 &&
      player.x + player.w > C2_MID.x && player.x < C2_MID.x + C2_MID.w) {
      if (!c2.checkpoint) sfx('checkpoint');
      c2.checkpoint = true;
    }
    if (game.mode === 'world' && fade.dir === 0 && inCloud2(player.y) && player.y > C2 + 140) {
      sfx('fall');
      fadeThen(() => {
        if (bird.state === 'talk') bird.state = 'idle';
        respawnC2();
      });
    }

    bird.t++;
    if (bird.state === 'idle' || bird.state === 'talk' || bird.state === 'beaten') {
      bird.face = player.x < bird.x ? -1 : 1;
    }
    if (
      bird.state === 'idle' && canTrigger && player.onGround &&
      Math.abs(player.y + player.h - C2_ARENA.y) < 2 &&
      player.x + player.w > C2_ARENA.x && player.x < C2_ARENA.x + C2_ARENA.w
    ) {
      bird.state = 'talk';
      startDialog(BIRD_LINES, () => startBattleTransition('skyBird', winBird, loseBird), 'SKY BIRD');
    }
    light.t++;
    if (
      light.state === 'idle' && canTrigger && player.onGround &&
      Math.abs(player.y + player.h - STAIR_TOP.y) < 2 && player.x > STAIR_TOP.x + 40
    ) {
      light.state = 'descending';
      light.y = camY - 40;
      player.face = 1;
      sfx('holyDescend');
    }
    if (light.state === 'descending') {
      light.y += Math.max(0.6, (LIGHT_HOVER_Y - light.y) * 0.03);
      if (light.y >= LIGHT_HOVER_Y) {
        light.y = LIGHT_HOVER_Y;
        light.state = 'talk';
        sfx('holyArrive');
        startDialog(LIGHT_LINES, () => startBattleTransition('lightGods', winLight, loseLight), 'LIGHT OF GODS');
      }
    }

    if (bird.state === 'leaving') {
      bird.vy = Math.max(bird.vy - 0.14, -5);
      bird.y += bird.vy;
      bird.x += 0.8;
      if (bird.y + 22 < camY - 10) bird.state = 'gone';
    }

    if (vines.state === 'falling' && ++vines.t > 90) vines.state = 'gone';
    if (
      vines.state === 'up' && toast.t === 0 && player.x < VINE_WALL.x &&
      player.x + player.w >= VINE_WALL.x - 1 && player.y > VINE_WALL.y
    ) {
      toast.text = 'THICK VINES BLOCK THE WAY...';
      toast.t = 120;
    }

    monkey.t++;
    if (monkey.state === 'idle' || monkey.state === 'talk' || monkey.state === 'beaten') {
      monkey.face = player.x < monkey.x ? -1 : 1;
    }
    if (
      monkey.state === 'idle' && canTrigger &&
      player.y + player.h <= MONKEY_BRANCH.y + 2 && player.y > HOUSE.top - 120 &&
      player.x > TREE_X - 200 && player.x < TREE_X + 200
    ) {
      monkey.state = 'talk';
      startDialog(MONKEY_LINES, () => startBattleTransition('monkey', winMonkey, loseMonkey), 'MONKEY');
    }
    if (monkey.state === 'leaving') {
      monkey.x += monkey.vx;
      monkey.y += monkey.vy;
      monkey.vy = Math.min(monkey.vy + 0.22, 7);
      if (monkey.y > camY + H + 20 || monkey.x + 14 < cam || monkey.x > cam + W) {
        monkey.state = 'gone';
      }
    }

    const px = player.x + 4;
    house.inside = px > HOUSE.x + 4 && px < HOUSE.x + HOUSE.w && player.y > HOUSE.top - 10 && player.y < HOUSE.floorY;
    house.alpha += ((house.inside ? 0.12 : 1) - house.alpha) * 0.12;

    if (cam + W > TREE_X - 260 && cam < TREE_X + 300 && tick % 12 === 0) {
      fallingLeaves.push({
        x: TREE_X - 160 + Math.random() * 380,
        y: HOUSE.floorY + 10 + Math.random() * 30,
        vy: 0.3 + Math.random() * 0.3,
        ph: Math.random() * 6,
        c: Math.random() < 0.5 ? '#5cc84a' : '#2e9a3a',
      });
    }
    for (let i = fallingLeaves.length - 1; i >= 0; i--) {
      const l = fallingLeaves[i];
      l.y += l.vy;
      l.ph += 0.05;
      l.x += Math.sin(l.ph) * 0.4;
      if (l.y > GROUND_Y) fallingLeaves.splice(i, 1);
    }
    if (npc.state === 'leaving') {
      npc.face = -1;
      npc.x -= 0.9;
      npc.walk += 0.08;
      if (npc.x + 12 < cam || npc.x < -14) npc.state = 'gone';
    }

    updateDialog();

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.03;
      if (--p.life <= 0) particles.splice(i, 1);
    }
  }

  // ---------- Battle outcomes ----------
  function camYTargetFor(y) {
    if (inCloud2(y)) return clamp(y + 9 - H * 0.55, C2 - 800, C2 - 40);
    return clamp(y + 9 - H * 0.55, SKY_Y - 160, 0);
  }

  // ---------- Sky launch ----------
  const SKY_FRAMES = 600;
  const SKY_OBSTACLES = 9;
  const sky = { t: 0, px: 0, py: 0, pvx: 0, face: 1, speed: 3, alt: 0, obstacles: [], clouds: [], puffs: [], streaks: [], spawned: 0, dodged: 0, hit: false, done: false, flash: 0, shake: 0 };

  function startSky() {
    game.mode = 'sky';
    sfx('launch');
    Object.assign(sky, {
      t: 0, px: W / 2 - 4, py: H + 10, pvx: 0, face: player.face, speed: 3, alt: 0,
      obstacles: [], clouds: [], puffs: [], spawned: 0, dodged: 0,
      hit: false, done: false, flash: 14, shake: 0,
    });
    sky.streaks = [];
    for (let i = 0; i < 36; i++) {
      sky.streaks.push({ x: Math.random() * W, y: Math.random() * H, len: 6 + Math.random() * 14, s: 0.8 + Math.random() * 0.8 });
    }
  }

  function spawnObstacle() {
    const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    const img = OBSTACLE_SPRITES[type];
    sky.obstacles.push({
      img, w: img.width, h: img.height,
      x: 12 + Math.random() * (W - 24 - img.width),
      y: -img.height - 6,
      fall: 0.8 + Math.random() * 0.8,
      rot: Math.random() * 6, spin: (Math.random() - 0.5) * 0.12,
      passed: false,
    });
    sky.spawned++;
  }

  function updateSky() {
    for (const s of sky.streaks) {
      s.y += sky.speed * 1.6 * s.s;
      if (s.y > H) { s.y = -s.len; s.x = Math.random() * W; }
    }
    for (let i = sky.puffs.length - 1; i >= 0; i--) {
      const p = sky.puffs[i];
      p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92;
      if (--p.life <= 0) sky.puffs.splice(i, 1);
    }
    if (sky.flash > 0) sky.flash--;
    if (sky.shake > 0) sky.shake--;
    if (sky.hit || sky.done) return;

    sky.t++;
    const left = keys['a'] || keys['arrowleft'];
    const right = keys['d'] || keys['arrowright'];
    const target = ((right ? 1 : 0) - (left ? 1 : 0)) * 2.8;
    if (target) sky.face = Math.sign(target);
    sky.pvx += (target - sky.pvx) * 0.25;
    sky.px = clamp(sky.px + sky.pvx, 6, W - 14);
    sky.py += (128 - sky.py) * 0.08;
    sky.speed += (3 - sky.speed) * 0.012;
    sky.alt += sky.speed;

    if (sky.spawned < SKY_OBSTACLES && sky.t >= 50 + sky.spawned * 58) spawnObstacle();
    if (sky.t % 34 === 10 && sky.t < SKY_FRAMES - 60) {
      sky.clouds.push({ x: 10 + Math.random() * (W - 48), y: -16, w: 28, h: 14 });
    }

    const pb = { x: sky.px, y: sky.py, w: 8, h: 18 };
    for (let i = sky.obstacles.length - 1; i >= 0; i--) {
      const o = sky.obstacles[i];
      o.y += sky.speed * 0.9 + o.fall;
      o.rot += o.spin;
      const hb = { x: o.x + o.w * 0.15, y: o.y + o.h * 0.15, w: o.w * 0.7, h: o.h * 0.7 };
      if (overlap(pb, hb)) {
        sky.hit = true;
        sky.shake = 14;
        sfx('crash');
        sky.flash = 10;
        fadeThen(() => {
          game.mode = 'world';
          respawnAt(WIND.x - 48, WIND.y - 18);
        });
        return;
      }
      if (o.y > H + 4) {
        if (!o.passed) sky.dodged++;
        sky.obstacles.splice(i, 1);
      }
    }
    for (let i = sky.clouds.length - 1; i >= 0; i--) {
      const c = sky.clouds[i];
      c.y += sky.speed * 0.8;
      if (overlap(pb, c)) {
        sky.speed = Math.min(sky.speed + 2.5, 10);
        sfx('boost');
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * Math.PI * 2;
          sky.puffs.push({ x: c.x + 14, y: c.y + 7, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2, life: 20 });
        }
        sky.clouds.splice(i, 1);
      } else if (c.y > H) {
        sky.clouds.splice(i, 1);
      }
    }

    if (sky.t >= SKY_FRAMES) {
      sky.done = true;
      sfx('chime');
      fadeThen(() => {
        game.mode = 'world';
        respawnAt(YCLOUD.x + 40, SKY_Y - 18);
        showTitle('THE SKY LANDS', '- WORLD 2 -');
      });
    }
  }

  function respawnAt(x, y) {
    Object.assign(player, { x, y, vx: 0, vy: 0, face: 1 });
    cam = Math.round(clamp(player.x + 4 - W / 2, 0, WORLD_W - W));
    camY = camYTargetFor(y);
    dialog.active = false;
  }

  function respawn(x) {
    Object.assign(player, { x, y: GROUND_Y - 18, vx: 0, vy: 0, face: 1 });
    cam = Math.round(clamp(player.x + 4 - W / 2, 0, WORLD_W - W));
    camY = 0;
    dialog.active = false;
  }

  function winRedKid() {
    npc.state = 'beaten';
    startDialog(WIN_LINES, () => {
      npc.state = 'leaving';
    });
  }
  function loseRedKid() {
    npc.state = 'idle';
    respawn(SPAWN_X);
  }

  function winMonkey() {
    monkey.state = 'beaten';
    startDialog(MONKEY_WIN_LINES, () => {
      monkey.state = 'leaving';
      sfx('monkey');
      vines.state = 'falling';
      vines.t = 0;
      sfx('vines');
      toast.text = 'THE VINES BEHIND THE TREE FELL!';
      toast.t = 180;
      const dir = player.x < monkey.x ? 1 : -1;
      monkey.face = dir;
      monkey.vx = 2 * dir;
      monkey.vy = -4.5;
    }, 'MONKEY');
  }
  function winAngel() {
    angel.state = 'beaten';
    startDialog(ANGEL_WIN_LINES, () => {
      angel.state = 'leaving';
      angel.vy = -0.5;
      sfx('ascend');
    }, 'ANGEL');
  }
  function winKnight() {
    knight.state = 'beaten';
    startDialog(KNIGHT_WIN_LINES, () => {
      knight.state = 'leaving';
      knight.leaveT = 0;
      sfx('chime');
    }, 'KNIGHT');
  }
  function loseKnight() {
    knight.state = 'idle';
    enterCastle(96);
    player.face = 1;
  }
  function respawnC2() {
    if (c2.checkpoint) respawnAt(C2_MID.x + 30, C2_MID.y - 18);
    else respawnAt(C2_START.x + 80, C2 - 18);
  }
  function winBird() {
    bird.state = 'beaten';
    startDialog(BIRD_WIN_LINES, () => {
      bird.state = 'leaving';
      bird.vy = -0.8;
      sfx('flap');
    }, 'SKY BIRD');
  }
  function winLight() {
    light.state = 'revealed';
    startEyeFight();
  }
  function loseLight() {
    light.state = 'idle';
    light.y = LIGHT_HOVER_Y;
    respawnAt(STAIR_TOP.x + 10, STAIR_TOP.y - 18);
  }
  function loseBird() {
    bird.state = 'idle';
    respawnC2();
  }
  function loseAngel() {
    angel.state = 'idle';
    respawnAt(YCLOUD.x + 40, SKY_Y - 18);
  }

  function loseMonkey() {
    monkey.state = 'idle';
    respawn(TREE_SPAWN_X);
  }

  // ---------- Battle ----------
  let pendingBattle = null;
  function startBattleTransition(enemyId, onWin, onLose, returnMode = 'world') {
    pendingBattle = { enemyId, onWin, onLose, returnMode };
    game.mode = 'transition';
    game.transT = 0;
    sfx('battleStart');
  }

  function startBattle() {
    const { enemyId, onWin, onLose, returnMode = 'world' } = pendingBattle;
    const enemy = ENEMIES[enemyId];
    battle = {
      id: enemyId, enemy, onWin, onLose, returnMode,
      pmax: getPlayerMaxHp(), php: getPlayerMaxHp(), ehp: enemy.hp,
      pDisp: getPlayerMaxHp(), eDisp: enemy.hp,
      phase: 'events', queue: [], cur: null,
      t: 0, chars: 0, sel: 0, advance: false,
      shake: 0, pHurt: 0, eHurt: 0, fx: [], introT: 0,
      moves: getPlayerMoves(), lastEnemyMove: null, fireball: null, leafStorm: null,
    };
    battle.queue.push({ type: 'msg', text: `${enemy.name} WANTS TO FIGHT ${playerName}!` });
    game.mode = 'battle';
    fade.alpha = 1;
    fade.dir = -1;
  }

  const SWAP_BTN = { x: 6, y: 4, w: 64, h: 15 };
  const SWAP_PANEL = { x: 22, y: 18, w: 340, h: 126 };
  const SWAP_ITEM = { name: 'SWAP', swap: true };
  const hasSwap = () => inventory.includes('swapCrystal');

  function slotRect(i) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    if (battle && battle.phase === 'swap') {
      return { x: SWAP_PANEL.x + 10 + col * 162, y: SWAP_PANEL.y + 22 + row * 16, w: 156, h: 14 };
    }
    if (i === -1) return SWAP_BTN;
    return { x: 110 + col * 134, y: 172 + row * 18, w: 128, h: 15 };
  }
  function menuItemAt(i) {
    if (i === -1) return battle && battle.phase === 'choose' && hasSwap() ? SWAP_ITEM : null;
    return menuItems()[i] || null;
  }
  function slotAt(x, y) {
    const p = { x, y };
    if (menuItemAt(-1) && inRect(p, SWAP_BTN)) return -1;
    const n = Math.max(4, menuItems().length);
    for (let i = 0; i < n; i++) {
      if (inRect(p, slotRect(i))) return i;
    }
    return -2;
  }
  function moveCursor(dx, dy) {
    if (!inMenu()) return;
    let i;
    if (battle.sel === -1) {
      if (dy <= 0) return;
      i = 0;
    } else {
      const rows = Math.max(1, Math.ceil(menuItems().length / 2));
      const row = Math.floor(battle.sel / 2) + dy;
      if (row < 0 && menuItemAt(-1)) i = -1;
      else i = clamp(row, 0, rows - 1) * 2 + clamp((battle.sel % 2) + dx, 0, 1);
    }
    if (menuItemAt(i) && i !== battle.sel) {
      battle.sel = i;
      sfx('cursor');
    }
  }

  const inMenu = () => !!battle && (battle.phase === 'choose' || battle.phase === 'swap');

  function menuItems() {
    if (!battle) return [];
    if (battle.phase === 'choose') return battle.moves;
    if (battle.phase === 'swap') {
      const gems = inventory
        .filter((id) => id && ITEMS[id].kind === 'gem')
        .map((id) => ({ name: ITEMS[id].name, gem: id }));
      const none = inv.equipped ? [{ name: 'NO GEM', gem: null }] : [];
      return [...gems, ...none, { name: 'BACK', back: true }];
    }
    return [];
  }

  function battleConfirm() {
    if (!battle) return;
    if (!inMenu()) {
      if (battle.cur && battle.cur.type === 'msg') sfx('cursor');
      battle.advance = true;
      return;
    }
    const item = menuItemAt(battle.sel);
    if (!item) return;
    if (battle.phase === 'swap') {
      battle.sel = 0;
      if (item.back) {
        battle.phase = 'choose';
        sfx('back');
        return;
      }
      sfx('equip');
      inv.equipped = item.gem;
      battle.moves = getPlayerMoves();
      battle.pmax = getPlayerMaxHp();
      battle.php = Math.min(battle.php, battle.pmax);
      battle.queue = [{ type: 'msg', text: item.gem ? `YOU SWAPPED TO ${item.name}!` : 'YOU PUT YOUR GEM AWAY!' }];
      battle.phase = 'events';
    } else if (item.swap) {
      battle.phase = 'swap';
      battle.sel = 0;
      sfx('confirm');
    } else {
      sfx('confirm');
      doTurn(item);
    }
  }

  function doTurn(pMove) {
    const { moves, weights } = battle.enemy;
    let eMove;
    if (weights) {
      let r = Math.random() * weights.reduce((a, w) => a + w, 0);
      eMove = moves.find((m, i) => (r -= weights[i]) < 0) || moves[0];
    } else {
      const choices = moves.filter((m) => !(m.special && battle.lastEnemyMove === m));
      eMove = choices[Math.floor(Math.random() * choices.length)];
    }
    battle.lastEnemyMove = eMove;
    const playerFirst = !!pMove.last === !!eMove.last ? Math.random() < 0.5 : !pMove.last;
    const pTurn = [
      { type: 'msg', text: `YOU USED ${pMove.name}!` },
      { type: 'hit', who: 'player', move: pMove },
    ];
    const eTurn = [
      { type: 'msg', text: `${battle.enemy.name} USED ${eMove.name}!` },
      { type: 'hit', who: 'enemy', move: eMove },
    ];
    battle.queue = playerFirst ? [...pTurn, ...eTurn] : [...eTurn, ...pTurn];
    battle.phase = 'events';
  }

  const SLASH_HITS = [20, 30, 40, 50];
  const cardRect = (i) => ({ x: 52 + i * 58, y: 82, w: 48, h: 66 });
  function moveCard(d) {
    const c = battle && battle.cards;
    if (!c || c.state !== 'pick' || c.foe) return;
    c.sel = (c.sel + d + 5) % 5;
    sfx('cursor');
  }
  function pickCard(i) {
    const c = battle && battle.cards;
    if (!c || c.state !== 'pick' || c.foe) return;
    if (i !== undefined) c.sel = i;
    c.pick = c.sel;
    c.state = 'reveal';
    c.t = 0;
  }
  const RAIN_HITS = [86, 94, 102, 110, 118, 126];
  const GRAIL_SEGS = [34, 104, 174];

  function applyHit(e) {
    const b = battle;
    const name = b.enemy.name;
    const color = { fire: '#ff9a2e', grass: '#5cc84a', holy: '#fff3a8', flying: '#bfe6ff', light: '#fff6b0' }[e.move.type] ||
      (e.move.anim === 'slash' ? '#7fdcff' : '#ffffff');
    const { dmg, sup } = calcDamage(e.move, e.who === 'player' ? b.enemy.type : PLAYER_TYPE);
    const supMsg = sup ? [{ type: 'msg', text: "IT'S SUPER EFFECTIVE!" }] : [];
    b.shake = sup ? 12 : 8;
    if (e.who === 'player') {
      b.ehp = Math.max(0, b.ehp - dmg);
      b.eHurt = 30;
      spawnImpact(300, 66, color);
      sfx('imp_' + (e.move.anim || 'punch'));
      if (sup) sfx('superDing');
      if (b.ehp === 0 && b.enemy.phase2 && !b.form2) {
        b.pre2 = true;
        b.queue = [
          ...supMsg,
          { type: 'msg', text: `${name}: ...HA. HA. HA.` },
          { type: 'msg', text: "YOU DIDN'T KILL ME YET!" },
          { type: 'transform' },
          { type: 'msg', text: `${name} REVEALED ITS TRUE FORM!` },
          { type: 'msg', text: 'BE NOT AFRAID...' },
          { type: 'msg', text: 'THE ANGEL RISES INTO THE SKY!' },
          { type: 'end', win: true },
        ];
        return;
      }
      if (b.ehp === 0) {
        b.over = true;
        sfx('faint');
        const reward = b.enemy.reward && !inventory.includes(b.enemy.reward)
          ? [{ type: 'msg', text: `YOU GOT THE ${ITEMS[b.enemy.reward].name}!` }]
          : [];
        b.queue = [
          ...supMsg,
          { type: 'msg', text: `${name} QUIT!` },
          { type: 'msg', text: 'YOU WON THE BATTLE!' },
          ...reward,
          { type: 'end', win: true },
        ];
        return;
      }
    } else {
      b.php = Math.max(0, b.php - dmg);
      b.pHurt = 30;
      spawnImpact(100, 116, color);
      sfx('imp_' + (e.move.anim || 'punch'));
      if (sup) sfx('superDing');
      if (b.php === 0) {
        b.over = true;
        b.queue = [
          ...supMsg,
          { type: 'msg', text: `${name} WON!` },
          { type: 'msg', text: 'YOU QUIT!' },
          { type: 'end', win: false },
        ];
        return;
      }
    }
    b.queue.unshift(...supMsg);
  }

  function spawnImpact(x, y, color) {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const sp = 1 + Math.random() * 1.8;
      battle.fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 22, color });
    }
  }

  function updateBattle() {
    const b = battle;
    b.introT++;
    b.pDisp += clamp(b.php - b.pDisp, -0.15, 0.15);
    b.eDisp += clamp(b.ehp - b.eDisp, -0.15, 0.15);
    if (b.shake > 0) b.shake--;
    if (b.pHurt > 0) b.pHurt--;
    if (b.eHurt > 0) b.eHurt--;
    for (let i = b.fx.length - 1; i >= 0; i--) {
      const p = b.fx[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.92;
      p.vy *= 0.92;
      if (--p.life <= 0) b.fx.splice(i, 1);
    }

    const advance = b.advance;
    b.advance = false;
    if (b.phase !== 'events' || fade.dir !== 0) return;

    if (!b.cur) {
      b.cur = b.queue.shift() || null;
      b.t = 0;
      b.chars = 0;
      if (!b.cur) {
        b.phase = 'choose';
        return;
      }
    }
    const e = b.cur;
    if (e.type === 'msg') {
      if (b.chars < e.text.length) {
        b.chars++;
        if (b.chars % 3 === 0) sfx('text');
      } else if (++b.t > 55 || advance) b.cur = null;
    } else if (e.type === 'hit') {
      b.t++;
      if (b.t === 1) sfx(e.move.anim || 'punch');
      let duration = 50;
      if (e.move.anim === 'gust') {
        duration = 64;
        if (b.t === 36) applyHit(e);
      } else if (e.move.anim === 'spot') {
        duration = 80;
        if (b.t === 52) {
          applyHit(e);
          b.shake = 18;
        }
      } else if (e.move.anim === 'dive') {
        duration = 66;
        if (b.t === 42) {
          applyHit(e);
          b.shake = 16;
        }
      } else if (e.move.anim === 'xbeam') {
        duration = 66;
        if (b.t === 32) applyHit(e);
      } else if (e.move.anim === 'beam') {
        duration = 60;
        if (b.t === 4) b.beam = { t0: b.t, fromPlayer: e.who === 'player' };
        if (b.t === 30) applyHit(e);
        if (b.t === duration) b.beam = null;
      } else if (e.move.anim === 'fire' || e.move.anim === 'ace') {
        if (b.t === 6) b.fireball = { t: 0, fromPlayer: e.who === 'player', holy: e.move.anim === 'ace' };
        if (b.fireball) b.fireball.t++;
        if (b.t === 28) {
          b.fireball = null;
          applyHit(e);
        }
      } else if (e.move.anim === 'slash') {
        duration = 70;
        if (SLASH_HITS.includes(b.t) && !b.over && !b.pre2) applyHit(e);
      } else if (e.move.anim === 'glove') {
        duration = 44;
        if (b.t === 6) sfx('boing');
        if (b.t === 16) {
          applyHit(e);
          sfx('honk');
        }
      } else if (e.move.anim === 'jack') {
        duration = 96;
        if (b.t === 14) sfx('land');
        if (b.t === 18) sfx('jingle');
        if (b.t === 52) sfx('boing');
        if (b.t === 57) {
          applyHit(e);
          b.shake = 12;
          sfx('honk');
          const [x, y] = e.who === 'player' ? [300, 60] : [110, 110];
          for (let i = 0; i < 30; i++) {
            const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.5;
            b.fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, life: 40, color: ['#ff3e6c', '#ffe14d', '#3ec8ff', '#7ed860', '#b07cff'][i % 5] });
          }
        }
      } else if (e.move.anim === 'cards') {
        duration = Infinity;
        if (!b.cards) {
          const deck = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
          b.cards = { state: 'intro', t: 0, sel: 2, pick: -1, safe: deck.slice(0, 2), foe: e.who === 'player' };
        }
        const c = b.cards;
        c.t++;
        if (c.foe && c.state === 'pick') {
          if (c.t % 12 === 0) {
            c.sel = Math.floor(Math.random() * 5);
            sfx('cursor');
          }
          if (c.t >= 70) {
            c.pick = c.sel;
            c.state = 'reveal';
            c.t = 0;
          }
        }
        if (c.state === 'intro') {
          if (c.t === 30 || c.t === 46 || c.t === 62 || c.t === 78) sfx('shuffle');
          if (c.t >= 92) {
            c.state = 'pick';
            c.t = 0;
          }
        } else if (c.state === 'reveal') {
          if (c.t === 1) sfx('cardFlip');
          if (c.t === 14) {
            if (c.safe.includes(c.pick)) {
              sfx('safe');
              b.queue.unshift({ type: 'msg', text: c.foe ? `${b.enemy.name} PICKED A SAFE CARD!` : 'YOU PICKED THE SAFE CARD!' });
            } else {
              sfx('explode');
              applyHit(e);
            }
          }
          if (c.t === 40) sfx('cardFlip');
          if (c.t >= 90) {
            b.cards = null;
            b.cur = null;
          }
        }
      } else if (e.move.anim === 'bow') {
        duration = 54;
        if (b.t === 16) sfx('twang');
        if (b.t === 22) {
          applyHit(e);
          b.shake = 12;
        }
      } else if (e.move.anim === 'rain') {
        duration = 150;
        if (b.t === 22) sfx('drawBow');
        if (b.t === 40) sfx('flameOn');
        if (b.t === 46) sfx('arrowsUp');
        if (b.t === 74) sfx('whistle');
        if (RAIN_HITS.includes(b.t) && !b.over && !b.pre2) applyHit(e);
      } else if (e.move.anim === 'oblivion') {
        duration = 150;
        if (b.t === 22) sfx('clank');
        if (b.t === 38) sfx('shine');
        if (b.t === 76) sfx('leap');
        if (b.t === 100) sfx('plunge');
        if (b.t === 112) {
          applyHit(e);
          b.shake = 22;
          const [x, y] = e.who === 'player' ? [300, 80] : [100, 140];
          for (let i = 0; i < 40; i++) {
            const a = (i / 40) * Math.PI * 2;
            const sp = 1.5 + Math.random() * 3;
            b.fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 1, life: 34, color: ['#7fdcff', '#5a3fb0', '#ffffff'][i % 3] });
          }
        }
      } else if (e.move.anim === 'kpunch') {
        duration = 40;
        if (b.t === 14) applyHit(e);
      } else if (e.move.anim === 'midas') {
        duration = 120;
        if (b.t === 22) sfx('leap');
        if (b.t === 32) {
          sfx('clank');
          b.shake = 6;
        }
        if (b.t === 36) sfx('goldify');
        if (b.t === 84) {
          applyHit(e);
          b.shake = 18;
          const [x, y] = e.who === 'player' ? [300, 66] : [100, 118];
          for (let i = 0; i < 44; i++) {
            const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3.5;
            b.fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 40, color: ['#ffe14d', '#e8c547', '#fff3a8', '#b8901a'][i % 4] });
          }
        }
      } else if (e.move.anim === 'throne') {
        duration = 96;
        if (b.t === 30) sfx('whistle');
        if (b.t === 58) {
          applyHit(e);
          b.shake = 20;
          const [x, y] = e.who === 'player' ? [300, 94] : [96, 154];
          for (let i = 0; i < 30; i++) {
            const a = Math.PI + Math.random() * Math.PI, sp = 1 + Math.random() * 3;
            b.fx.push({ x, y, vx: Math.cos(a) * sp * 1.6, vy: Math.sin(a) * sp * 0.6, life: 30, color: ['#c9ae74', '#e8c547', '#8a86a0'][i % 3] });
          }
        }
      } else if (e.move.anim === 'grail') {
        duration = 250;
        GRAIL_SEGS.forEach((s, i) => {
          if (b.t === s) sfx('swoosh');
          if (b.t === s + 18) sfx(['twang', 'boing', 'leap'][i]);
          if (b.t === s + 52 && !b.over && !b.pre2) applyHit(e);
        });
      } else if (e.move.anim === 'leaf') {
        duration = 100;
        if (b.t === 4) b.leafStorm = { t0: b.t, fromPlayer: e.who === 'player' };
        const lt = b.t - 4;
        if (lt > 50 && lt < 90 && b.shake < 3) b.shake = 3;
        if (b.t === 60) applyHit(e);
        if (b.t === duration) b.leafStorm = null;
      } else if (b.t === 12) {
        applyHit(e);
      }
      if (b.t >= duration) b.cur = null;
    } else if (e.type === 'transform') {
      b.t++;
      if (b.t === 1) sfx('transform');
      if (b.t % 10 === 0 && b.t < 60) b.shake = 6;
      if (b.t === 60) {
        b.form2 = true;
        b.pre2 = false;
        b.ehp = b.eDisp = b.enemy.hp;
        b.shake = 20;
        spawnImpact(300, 50, '#fff3a8');
      }
      if (b.t >= 130) b.cur = null;
    } else if (e.type === 'end') {
      b.phase = 'done';
      b.over = true;
      sfx(e.win ? 'victory' : 'defeat');
      const done = e.win ? b.onWin : b.onLose;
      if (e.win && b.enemy.reward) addItem(b.enemy.reward);
      if (e.win) classicSave(b.id);
      fadeThen(() => {
        game.mode = b.returnMode;
        battle = null;
        done();
      });
    }
  }

  function pickMusic() {
    if (game.mode === 'menu') return 'menu';
    if (game.mode === 'coma') return null;
    if (game.mode === 'castle') return 'castle';
    if (game.mode === 'maze') return 'maze';
    if (game.mode === 'omen') return null;
    if (game.mode === 'king') return kingRoom.rumble > 0 ? null : 'king';
    if (game.mode === 'eye') {
      const e = eye;
      if (e.phase === 'end') return 'ending';
      if (e.phase === 'tired' || e.phase === 'death') return null;
      if (e.phase === 'intro' && e.t < 68) return null;
      return 'finalBoss';
    }
    if (game.mode === 'transition') return null;
    if (game.mode === 'battle' && battle) {
      if (battle.over || battle.pre2) return null;
      if (battle.form2) return 'battle_lightGods2';
      return battle.enemy.music || 'battle_' + battle.id;
    }
    if (game.mode === 'sky') return sky.hit ? null : 'skyrun';
    if (light.state === 'descending' || light.state === 'talk') return 'holy';
    if (inCloud2(player.y)) {
      if (player.x > STAIR_X - 40) return 'stairs';
      const birdHere = bird.state === 'idle' || bird.state === 'talk' || bird.state === 'beaten';
      return birdHere && player.x > C2_ARENA.x - 160 ? 'arena' : 'cloud2';
    }
    if (player.y < SKY_Y + 300) return 'skylands';
    if (house.inside) return 'treehouse';
    if (player.x >= MOUNTAIN_X - 150) return 'mountains';
    if (player.x >= TREE_X - 350 || player.y < -60) return 'jungle';
    return 'grasslands';
  }

  function update() {
    tick++;
    syncPlayerLook();
    if (window.Sound) window.Sound.music(pickMusic());
    if (game.mode === 'menu') {
      updateMenu();
      return;
    }
    if (admin.open) return;
    if (toast.t > 0) toast.t--;
    if (game.mode === 'battle') {
      updateBattle();
    } else if (game.mode === 'sky') {
      updateSky();
    } else if (game.mode === 'eye') {
      updateEye();
    } else if (game.mode === 'coma') {
      updateComa();
    } else if (game.mode === 'castle') {
      updateCastle();
    } else if (game.mode === 'maze') {
      updateMaze();
    } else if (game.mode === 'king') {
      updateKing();
    } else if (game.mode === 'omen') {
      updateOmen();
    } else if (game.mode === 'transition' && pendingBattle && pendingBattle.returnMode !== 'world') {
      if (++game.transT >= 60) startBattle();
    } else {
      updateWorld();
      if (game.mode === 'transition' && ++game.transT >= 60) {
        startBattle();
      }
    }
    if (fade.dir !== 0) {
      fade.alpha += fade.dir * 0.05;
      if (fade.dir > 0 && fade.alpha >= 1) {
        fade.alpha = 1;
        fade.dir = -1;
        if (fade.cb) fade.cb();
        fade.cb = null;
      } else if (fade.dir < 0 && fade.alpha <= 0) {
        fade.alpha = 0;
        fade.dir = 0;
      }
    }
  }

  // ---------- Render helpers ----------
  const SKY = ['#4aa3f0', '#5aaff3', '#6abaf5', '#7cc4f7', '#8fcff9', '#a3d9fa', '#b8e3fb', '#cdecfc'];

  function drawSky() {
    const band = Math.ceil(140 / SKY.length);
    SKY.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, i * band, W, band);
    });
    ctx.fillStyle = SKY[SKY.length - 1];
    ctx.fillRect(0, 140, W, H - 140);

    ctx.fillStyle = '#fff4b0';
    ctx.fillRect(316, 20, 20, 20);
    ctx.fillRect(312, 24, 28, 12);
    ctx.fillRect(320, 16, 12, 28);
    ctx.fillStyle = '#ffe56b';
    ctx.fillRect(318, 22, 16, 16);
  }

  function drawClouds() {
    ctx.fillStyle = '#ffffff';
    for (const c of clouds) {
      const span = W + 120;
      let x = (c.x - cam * 0.15 + tick * 0.05 * c.s) % span;
      if (x < 0) x += span;
      x = Math.floor(x - 60);
      const y = Math.floor(c.y);
      const s = c.s * 4;
      ctx.fillRect(x, y + s, s * 8, s * 2);
      ctx.fillRect(x + s, y, s * 3, s);
      ctx.fillRect(x + s * 4, y - s, s * 3, s * 2);
      ctx.fillStyle = '#e3f1fb';
      ctx.fillRect(x, y + s * 3 - 2, s * 8, 2);
      ctx.fillStyle = '#ffffff';
    }
  }

  function drawHills(factor, base, amp, freq, color) {
    ctx.fillStyle = color;
    for (let x = 0; x < W; x += 2) {
      const wx = x + cam * factor;
      const h = base - Math.floor((Math.sin(wx * freq) * amp + Math.sin(wx * freq * 2.3 + 1) * amp * 0.4) / 2) * 2;
      ctx.fillRect(x, h, 2, H - h);
    }
  }

  function drawCastle() {
    const ox = Math.floor(260 - cam * 0.3);
    const by = 124;
    const stone = '#7d8799';
    const dark = '#5d6677';
    ctx.fillStyle = stone;
    ctx.fillRect(ox, by - 24, 80, 30);
    for (let i = 0; i < 10; i++) ctx.fillRect(ox + i * 8, by - 28, 4, 4);
    const towers = [[ox - 12, 44], [ox + 34, 58], [ox + 80, 44]];
    for (const [tx, th] of towers) {
      ctx.fillStyle = stone;
      ctx.fillRect(tx, by - th, 14, th + 6);
      for (let i = 0; i < 4; i++) ctx.fillRect(tx - 1 + i * 4, by - th - 4, 3, 4);
      ctx.fillStyle = '#a33a3a';
      ctx.beginPath();
      ctx.moveTo(tx - 2, by - th - 4);
      ctx.lineTo(tx + 7, by - th - 18);
      ctx.lineTo(tx + 16, by - th - 4);
      ctx.fill();
      ctx.fillStyle = '#3b2a1a';
      ctx.fillRect(tx + 7, by - th - 26, 1, 9);
      ctx.fillStyle = tick % 40 < 20 ? '#2f6fdc' : '#3d7ff0';
      ctx.fillRect(tx + 8, by - th - 26, 6, 4);
      ctx.fillStyle = dark;
      ctx.fillRect(tx + 5, by - th + 10, 4, 6);
    }
    ctx.fillStyle = dark;
    ctx.fillRect(ox + 36, by - 10, 10, 16);
    ctx.fillRect(ox + 37, by - 12, 8, 2);
  }

  function blob(cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.round(Math.sqrt(r * r - dy * dy));
      ctx.fillRect(cx - w, cy + dy, w * 2, 1);
    }
  }

  function drawTree(x, gy) {
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x - 4, gy - 24, 8, 24);
    ctx.fillStyle = '#5b3a1c';
    ctx.fillRect(x - 3, gy - 24, 6, 24);
    ctx.fillStyle = '#7a4f28';
    ctx.fillRect(x - 3, gy - 24, 2, 24);
    ctx.fillStyle = '#3e2712';
    ctx.fillRect(x + 1, gy - 14, 1, 3);
    ctx.fillRect(x - 6, gy - 1, 12, 1);

    const lobes = [[-9, -34, 10], [9, -34, 10], [0, -44, 12], [0, -32, 11]];
    for (const [dx, dy, r] of lobes) blob(x + dx, gy + dy, r + 1, '#163d1a');
    for (const [dx, dy, r] of lobes) blob(x + dx, gy + dy, r, '#2e7d32');
    blob(x - 3, gy - 46, 7, '#43a047');
    blob(x - 10, gy - 37, 5, '#43a047');
    blob(x - 4, gy - 48, 3, '#66bb6a');
    ctx.fillStyle = '#1f5e23';
    ctx.fillRect(x - 14, gy - 26, 28, 2);

    ctx.fillStyle = '#d32f2f';
    ctx.fillRect(x - 7, gy - 40, 2, 2);
    ctx.fillRect(x + 6, gy - 33, 2, 2);
    ctx.fillRect(x + 2, gy - 48, 2, 2);
  }

  function drawFence(x, n, gy) {
    ctx.fillStyle = '#7a4f28';
    ctx.fillRect(x, gy - 9, n * 10, 2);
    ctx.fillRect(x, gy - 5, n * 10, 2);
    for (let i = 0; i <= n; i++) {
      ctx.fillStyle = '#5b3a1c';
      ctx.fillRect(x + i * 10 - 1, gy - 12, 3, 12);
      ctx.fillStyle = '#8d5f33';
      ctx.fillRect(x + i * 10 - 1, gy - 12, 1, 12);
    }
  }

  function drawSign(x, gy) {
    ctx.fillStyle = '#5b3a1c';
    ctx.fillRect(x + 7, gy - 16, 3, 16);
    ctx.fillStyle = '#a0713c';
    ctx.fillRect(x, gy - 24, 20, 10);
    ctx.fillStyle = '#6e4520';
    ctx.fillRect(x, gy - 15, 20, 1);
    ctx.fillRect(x + 6, gy - 20, 8, 1);
    ctx.fillRect(x + 12, gy - 21, 1, 3);
    ctx.fillRect(x + 13, gy - 20, 1, 1);
  }

  function drawSolids() {
    for (const s of solids) {
      if (s.invisible || s.custom) continue;
      if (s.x + s.w < cam || s.x > cam + W) continue;
      if (s.branch) {
        drawBranch(s);
        continue;
      }
      if (s.wood) {
        drawWoodFloor(s);
        continue;
      }
      if (s.oneWay) {
        for (let x = s.x; x < s.x + s.w; x += 8) {
          ctx.fillStyle = '#a0713c';
          ctx.fillRect(x - cam, s.y, 8, s.h);
          ctx.fillStyle = '#6e4520';
          ctx.fillRect(x - cam + 7, s.y, 1, s.h);
          ctx.fillRect(x - cam, s.y + s.h - 1, 8, 1);
          ctx.fillStyle = '#c38d52';
          ctx.fillRect(x - cam, s.y, 7, 1);
        }
        ctx.fillStyle = '#5b3a1c';
        ctx.fillRect(s.x - cam + 3, s.y + s.h, 2, 4);
        ctx.fillRect(s.x + s.w - cam - 5, s.y + s.h, 2, 4);
        continue;
      }
      const topSet = s.stone ? (s.y < 40 ? snowTiles : mossTiles) : grassTiles;
      const bodySet = s.stone ? stoneTiles : dirtTiles;
      const viewTop = Math.round(camY) - 16;
      for (let ty = 0; ty < s.h; ty += 16) {
        if (s.y + ty < viewTop || s.y + ty > Math.round(camY) + H) continue;
        for (let tx = 0; tx < s.w; tx += 16) {
          if (s.x + tx + 16 < cam || s.x + tx > cam + W) continue;
          const idx = Math.floor((s.x + tx) / 16 + ty / 16) % 3;
          const tile = ty === 0 ? topSet[idx] : bodySet[idx];
          ctx.drawImage(tile, s.x + tx - cam, s.y + ty);
        }
      }
    }
  }

  function drawFlowers() {
    for (const f of flowers) {
      if (f.x < cam - 4 || f.x > cam + W + 4) continue;
      const gy = groundTopAt(f.x);
      const x = f.x - cam;
      if (f.kind === 'tuft') {
        ctx.fillStyle = '#3d9130';
        ctx.fillRect(x, gy - 2, 1, 2);
        ctx.fillRect(x + 2, gy - 3, 1, 3);
        ctx.fillRect(x + 4, gy - 2, 1, 2);
      } else {
        ctx.fillStyle = '#2f7d26';
        ctx.fillRect(x + 1, gy - 3, 1, 3);
        ctx.fillStyle = f.color;
        ctx.fillRect(x, gy - 5, 3, 1);
        ctx.fillRect(x + 1, gy - 6, 1, 3);
        ctx.fillStyle = '#ffb300';
        ctx.fillRect(x + 1, gy - 5, 1, 1);
      }
    }
  }

  function drawImg(img, x, y, face, scale = 1) {
    const dx = Math.round(x);
    const dy = Math.round(y);
    const w = img.width * scale;
    const h = img.height * scale;
    if (face < 0) {
      ctx.save();
      ctx.translate(dx + w, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, dx, dy, w, h);
    }
  }

  function drawChar(img, worldX, y, face) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    const gy = groundTopAt(worldX + img.width / 2, y + img.height - 2);
    ctx.fillRect(Math.round(worldX - cam) + 1, Math.round(gy) - 1, img.width - 2, 1);
    drawImg(img, worldX - cam, y, face);
  }

  function walkFrame(walk) {
    return [0, 1, 0, 2][Math.floor(walk) % 4];
  }

  function fitSize(text, maxW, size = 8) {
    for (; size > 4; size--) {
      ctx.font = `${size}px ${FONT}`;
      if (ctx.measureText(text).width <= maxW) break;
    }
    return size;
  }

  function wrapText(text, maxW, size = 8) {
    ctx.font = `${size}px ${FONT}`;
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? line + ' ' + word : word;
      if (line && ctx.measureText(next).width > maxW) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawText(text, x, y, size, color, align = 'left', shadow = '#1c140c') {
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    if (shadow) {
      ctx.fillStyle = shadow;
      ctx.fillText(text, x + 1, y + 1);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawDialog() {
    if (!dialog.active) return;
    const bx = 8, by = H - 46, bw = W - 16, bh = 38;
    ctx.fillStyle = '#1c140c';
    ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = '#e8d3a2';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#c9ae74';
    ctx.fillRect(bx, by + bh - 3, bw, 3);
    ctx.fillStyle = { MONKEY: '#6b4220', ANGEL: '#b8901a', 'SKY BIRD': '#24509a', 'LIGHT OF GODS': '#c8a020', KNIGHT: '#4a5468', ARCHER: '#2e7d32', JOKER: '#7a2a9c', KING: '#b8701a' }[dialog.speaker] || '#9a1c1a';
    ctx.fillRect(bx + 6, by - 8, dialog.speaker.length * 8 + 8, 12);
    drawText(dialog.speaker, bx + 10, by - 6, 8, '#ffe14d', 'left', '#2a1408');
    const text = dialog.lines[dialog.line];
    drawText(text.slice(0, dialog.chars), bx + 8, by + 14, 8, '#3b2a1a', 'left', '#d9c08a');
    if (dialog.chars >= text.length && tick % 40 < 20) {
      ctx.fillStyle = '#3b2a1a';
      ctx.fillRect(bx + bw - 12, by + bh - 10, 5, 2);
      ctx.fillRect(bx + bw - 11, by + bh - 8, 3, 1);
    }
  }

  function drawTitle() {
    if (titleStart === null) return;
    const t = (performance.now() - titleStart) / 1000;
    let a;
    if (t < 1) a = t;
    else if (t < 3) a = 1;
    else if (t < 4.5) a = 1 - (t - 3) / 1.5;
    else return;
    a = clamp(a, 0, 1);
    ctx.save();
    ctx.globalAlpha = a * 0.45;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 60, W, 70);
    ctx.globalAlpha = a;
    const half = Math.max(110, titleInfo.main.length * 10 + 20);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(W / 2 - half, 70, half * 2, 2);
    ctx.fillRect(W / 2 - half, 118, half * 2, 2);
    drawText(titleInfo.main, W / 2, 82, 20, '#ffd84a', 'center', '#5a3a1a');
    drawText(titleInfo.sub, W / 2, 106, 8, '#f5e6c0', 'center', '#3b2a1a');
    ctx.restore();
  }

  function showTitle(main, sub) {
    titleInfo = { main, sub, hint: false };
    titleStart = performance.now();
    sfx('title');
  }

  function drawHint() {
    if (titleStart === null || !titleInfo.hint) return;
    const t = (performance.now() - titleStart) / 1000;
    if (t < 4.5 || t > 12) return;
    ctx.save();
    ctx.globalAlpha = t > 11 ? 12 - t : Math.min(1, t - 4.5);
    drawText('WASD/ARROWS: MOVE  W/UP/SPACE: JUMP', W / 2, 8, 8, '#ffffff', 'center');
    ctx.restore();
  }

  // ---------- Mountain & sky render ----------
  function drawFarMountains() {
    if (cam < 1500) return;
    for (const [mx, mh] of FAR_PEAKS) {
      const x = Math.round(mx - cam * 0.6) - 120;
      if (x < -140 || x > W + 140) continue;
      const base = 150;
      for (let dy = 0; dy < mh; dy += 2) {
        const hw = Math.round((dy / mh) * mh * 1.1);
        const y = base - mh + dy;
        ctx.fillStyle = dy < mh * 0.25 ? '#f4f8ff' : dy < mh * 0.3 ? '#c8d8ec' : '#8a93a6';
        ctx.fillRect(x - hw, y, hw, 2);
        ctx.fillStyle = dy < mh * 0.25 ? '#dde8f6' : dy < mh * 0.3 ? '#aebcd2' : '#737c90';
        ctx.fillRect(x, y, hw, 2);
      }
      ctx.fillStyle = '#737c90';
      ctx.fillRect(x - mh * 1.1, base, mh * 2.2, H);
    }
  }

  function drawTornado(cx, by, scale = 1) {
    const rings = 9;
    for (let i = 0; i < rings; i++) {
      const y = by - i * 6 * scale;
      const rx = (5 + i * 2.6) * scale;
      const ry = Math.max(2, rx * 0.28);
      const ph = tick * 0.25 + i * 0.7;
      const sz = Math.ceil(2 * scale);
      for (let a = 0; a < Math.PI * 2; a += 0.14) {
        const ang = a + ph;
        const front = Math.sin(ang) > 0;
        const px = Math.round(cx + Math.cos(ang) * rx + Math.sin(tick * 0.1 + i) * 2 * scale);
        const py = Math.round(y + Math.sin(ang) * ry);
        const seg = Math.floor((a / (Math.PI * 2)) * 8) % 4;
        if (seg === 3) continue;
        if (front) {
          ctx.fillStyle = '#4a90c0';
          ctx.fillRect(px, py + 1, sz, sz);
          ctx.fillStyle = seg === 0 ? '#ffffff' : i % 2 ? '#d8f4ff' : '#a8dcf4';
        } else {
          ctx.fillStyle = '#7fbde0';
        }
        ctx.fillRect(px, py, sz, sz);
      }
    }
    const core = Math.round(by - 30 * scale);
    ctx.fillStyle = 'rgba(200,240,255,0.35)';
    blob(Math.round(cx), core, Math.round(10 * scale), 'rgba(200,240,255,0.25)');
    for (let k = 0; k < 6; k++) {
      const a = tick * 0.15 + k * 1.05;
      const r = (16 + (k % 3) * 6) * scale;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(by - 20 * scale - k * 6 * scale + Math.sin(a) * 4), Math.ceil(3 * scale), 1);
    }
  }

  function drawWindCharge() {
    const x = WIND.x - cam;
    if (x < -60 || x > W + 60) return;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x - 12, WIND.y - 1, 24, 2);
    drawTornado(x, WIND.y - 2);
    if (game.mode === 'world' && Math.abs(player.x - WIND.x) < 90 && tick % 60 < 40) {
      drawText('!', x - 3, WIND.y - 72, 8, '#ffffff');
    }
  }

  function sparkle(x, y, size, color = '#ffffff') {
    ctx.fillStyle = color;
    ctx.fillRect(x, y - size, 1, size * 2 + 1);
    ctx.fillRect(x - size, y, size * 2 + 1, 1);
    if (size > 1) ctx.fillRect(x - 1, y - 1, 3, 3);
  }

  const YELLOW_CLOUD = { glow: '#fff3a8', out: '#a87a10', shade: '#e0a820', main: '#ffd84a', mid: '#f0c030', hi: '#fff3a8', top: '#fff8c8' };
  const WHITE_CLOUD = { glow: '#ffffff', out: '#6f8fbf', shade: '#c4d6ee', main: '#f2f7ff', mid: '#dbe7f7', hi: '#ffffff', top: '#ffffff' };
  const MOVING_CLOUD = { glow: '#e8dcff', out: '#7a62b8', shade: '#c8b4f0', main: '#e6dcff', mid: '#d4c4f6', hi: '#f6f0ff', top: '#ffffff' };

  function drawYellowCloud(x, top, w, pal = YELLOW_CLOUD) {
    x = Math.round(x);
    top = Math.round(top);
    const tiny = w < 30;
    const small = w < 60;
    const step = tiny ? 8 : small ? 12 : 18;
    const baseR = tiny ? 6 : small ? 8 : 12;
    const inset = tiny ? 3 : 0;
    const lobes = [];
    for (let i = inset; i <= w - inset; i += step) {
      const r = baseR + ((i * 7) % (tiny ? 2 : 5));
      lobes.push([x + i, top + r - 4 + ((i * 3) % 3), r]);
    }
    if (tiny) lobes.push([x + w - inset, top + baseR - 4, baseR]);
    const under = [];
    for (let i = step / 2; i < w; i += step) under.push([x + i, top + (tiny ? 10 : small ? 13 : 20), tiny ? 4 : small ? 6 : 10]);

    ctx.save();
    ctx.globalAlpha = 0.16 + 0.06 * Math.sin(tick * 0.05 + x * 0.01);
    for (const [cx, cy, r] of lobes) blob(cx, cy, r + 6, pal.glow);
    for (const [cx, cy, r] of under) blob(cx, cy, r + 5, pal.glow);
    ctx.restore();

    for (const [cx, cy, r] of [...lobes, ...under]) blob(cx, cy, r + 1, pal.out);
    for (const [cx, cy, r] of under) blob(cx, cy, r, pal.shade);
    for (const [cx, cy, r] of lobes) blob(cx, cy, r, pal.main);
    ctx.fillStyle = pal.main;
    ctx.fillRect(x - 2 + inset, top, w + 4 - inset * 2, 6);
    ctx.fillStyle = pal.mid;
    for (const [cx, cy, r] of lobes) ctx.fillRect(cx - r + 2, cy + r - 4, r * 2 - 4, 2);
    for (const [cx, cy, r] of lobes) {
      blob(Math.round(cx - r / 3), Math.round(cy - r / 3), Math.round(r * 0.45), pal.hi);
      blob(Math.round(cx - r / 2.5), Math.round(cy - r / 2.2), Math.max(1, Math.round(r * 0.18)), '#ffffff');
    }
    ctx.fillStyle = pal.top;
    ctx.fillRect(x, top, w, 1);

    for (let k = 0; k < (small ? 1 : 3); k++) {
      const ph = (tick + k * 37 + x) % 80;
      if (ph >= 24) continue;
      const cycle = Math.floor((tick + k * 37 + x) / 80);
      const sx = Math.round(x + ((cycle * 53 + k * 29) % Math.max(1, w)));
      const sy = Math.round(top - 3 - ph / 6);
      sparkle(sx, sy, Math.round(ph < 12 ? ph / 4 : (24 - ph) / 4));
    }
  }

  function drawHeavenGate(x, top, open = 0) {
    const gx = Math.round(x);
    const pillar = (px) => {
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(px - 1, top - 62, 12, 62);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px, top - 60, 10, 60);
      ctx.fillStyle = '#d8e0f0';
      ctx.fillRect(px + 7, top - 60, 3, 60);
      ctx.fillStyle = '#e8c547';
      ctx.fillRect(px - 2, top - 64, 14, 4);
      ctx.fillRect(px - 2, top - 4, 14, 4);
    };
    pillar(gx);
    pillar(gx + 46);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(gx + 9, top - 66, 39, 6);
    for (let i = 0; i < 12; i++) {
      const ay = Math.round(Math.sin((i / 11) * Math.PI) * 10);
      ctx.fillStyle = '#e8c547';
      ctx.fillRect(gx + 10 + i * 3, top - 62 - ay, 3, 3);
    }
    if (open > 0) {
      ctx.save();
      ctx.globalAlpha = open;
      const swirl = ['#bfe6ff', '#e8f6ff', '#ffffff', '#fff3a8'];
      for (let r = 0; r < 4; r++) {
        ctx.fillStyle = swirl[(r + (tick >> 3)) % 4];
        ctx.fillRect(gx + 10 + r * 4, top - 58 + r * 5, 36 - r * 8, 58 - r * 5);
      }
      ctx.restore();
      if (tick % 6 === 0) {
        particles.push({ x: gx + cam + 14 + Math.random() * 28, y: top - 4 - Math.random() * 40, vx: 0, vy: -0.4, life: 30 });
      }
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(gx + 10, top - 60, 36, 60);
    ctx.clip();
    ctx.translate(0, -Math.round(open * 58));
    ctx.fillStyle = '#e8c547';
    for (let i = 0; i < 6; i++) ctx.fillRect(gx + 13 + i * 6, top - 58, 2, 56);
    ctx.fillRect(gx + 10, top - 40, 36, 2);
    ctx.fillRect(gx + 10, top - 20, 36, 2);
    ctx.fillStyle = '#fff3a8';
    ctx.fillRect(gx + 26, top - 36, 4, 4);
    ctx.restore();
    if (tick % 50 < 20) sparkle(gx + 28, top - 72, 2, '#fff3a8');
  }

  function drawCheckpointFlag(x, top, lit) {
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x - 1, top - 30, 3, 30);
    ctx.fillStyle = '#e8eef8';
    ctx.fillRect(x, top - 29, 1, 29);
    const wave = Math.round(Math.sin(tick * 0.12) * 1.5);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x + 2, top - 30 + wave, 14, 10);
    ctx.fillStyle = lit ? '#ffd84a' : '#8fa6c8';
    ctx.fillRect(x + 2, top - 29 + wave, 13, 8);
    ctx.fillStyle = lit ? '#fff3a8' : '#b8c8e0';
    ctx.fillRect(x + 2, top - 29 + wave, 13, 2);
    if (lit && tick % 40 < 16) sparkle(x + 9, top - 34, 1);
  }

  function drawCloudMapBg() {
    const bands = ['#2c4aa6', '#3657b4', '#4166c0', '#4f76cc', '#6189d6', '#769ce0', '#8db0ea', '#a7c4f2', '#c3d8f8'];
    const bh = Math.ceil(H / bands.length);
    bands.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, i * bh, W, bh);
    });
    for (let i = 0; i < 18; i++) {
      if ((tick + i * 23) % 90 < 30) continue;
      ctx.fillStyle = '#e8f0ff';
      ctx.fillRect((i * 71 + 13) % W, (i * 37) % 70, 1, 1);
    }
    const yBase = Math.round(150 - (camY - (C2 - 140)) * 0.15);
    for (let i = 0; i < 9; i++) {
      const tx = Math.round(((i * 97 - cam * 0.2) % (W + 120) + W + 120) % (W + 120)) - 60;
      const th = 50 + ((i * 29) % 40);
      ctx.fillStyle = '#9fbbe8';
      ctx.fillRect(tx - 9, yBase - th, 18, th + 80);
      blob(tx, yBase - th, 14, '#b4cbf0');
      blob(tx - 8, yBase - th + 6, 9, '#b4cbf0');
      blob(tx + 9, yBase - th + 8, 10, '#b4cbf0');
      ctx.fillStyle = '#c9daf6';
      ctx.fillRect(tx - 9, yBase - th + 4, 4, th + 76);
    }
    for (let i = 0; i < 12; i++) {
      const sx = Math.round(((i * 53 - cam * 0.35 + tick * 0.2) % (W + 80) + W + 80) % (W + 80)) - 40;
      blob(sx, yBase + 10 + ((i * 13) % 14), 22, '#dbe7fa');
    }
    ctx.fillStyle = '#dbe7fa';
    ctx.fillRect(0, yBase + 20, W, H);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 10; i++) {
      const wx = Math.round(((i * 89 - tick * (1 + (i % 3) * 0.5)) % (W + 60) + W + 60) % (W + 60)) - 30;
      ctx.fillRect(wx, 20 + ((i * 41) % 150), 14 + (i % 3) * 6, 1);
    }
    ctx.restore();
  }

  function drawStairs() {
    if (STAIR_X - cam > W + 10) return;
    const tx = Math.round(light.x - cam);
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.06 * Math.sin(tick * 0.05);
    ctx.fillStyle = '#fff3a8';
    ctx.fillRect(tx - 30, STAIR_TOP.y - 600, 60, 600);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tx - 12, STAIR_TOP.y - 600, 24, 600);
    ctx.restore();
    for (const s of STAIRS) {
      const x = Math.round(s.x - cam);
      if (x > W + 4 || x + s.w < -4) continue;
      const h = C2 + 110 - s.y;
      ctx.fillStyle = '#6a5010';
      ctx.fillRect(x - 1, s.y - 1, s.w + 2, h + 1);
      ctx.fillStyle = '#e8c547';
      ctx.fillRect(x, s.y, s.w, h);
      ctx.fillStyle = '#b8901a';
      ctx.fillRect(x + s.w - 3, s.y + 4, 3, h - 4);
      ctx.fillStyle = '#ffe14d';
      ctx.fillRect(x, s.y, s.w, 4);
      ctx.fillStyle = '#fff3a8';
      ctx.fillRect(x, s.y, s.w, 1);
      ctx.fillStyle = '#c9a030';
      ctx.fillRect(x, s.y + 4, s.w - 3, 1);
      for (let yy = s.y + 14; yy < s.y + h; yy += 16) ctx.fillRect(x + 3, yy, s.w - 9, 1);
      if ((tick + s.x) % 70 < 14) sparkle(x + ((s.x * 7) % (s.w - 4)) + 2, s.y - 2, 1, '#fffbe8');
    }
    drawHeroicPlatform();
  }

  function drawHeroicPlatform() {
    const s = STAIR_TOP;
    const x = Math.round(s.x - cam), y = s.y;
    if (x > W + 10 || x + s.w < -10) return;
    ctx.fillStyle = '#6a5010';
    ctx.fillRect(x - 4, y - 1, s.w + 4, 9);
    ctx.fillStyle = '#ffe14d';
    ctx.fillRect(x - 3, y, s.w + 2, 7);
    ctx.fillStyle = '#fff3a8';
    ctx.fillRect(x - 3, y, s.w + 2, 1);
    ctx.fillStyle = '#b8901a';
    for (let i = x + 2; i < x + s.w - 4; i += 10) {
      ctx.fillRect(i + 3, y + 2, 2, 1);
      ctx.fillRect(i + 2, y + 3, 4, 1);
      ctx.fillRect(i + 3, y + 4, 2, 1);
    }
    for (const bx of [x + 24, x + 96, x + s.w - 44]) {
      const wave = Math.round(Math.sin(tick * 0.05 + bx) * 1);
      ctx.fillStyle = '#4a1010';
      ctx.fillRect(bx - 1, y + 7, 20, 40);
      ctx.fillStyle = '#9a1c1a';
      ctx.fillRect(bx, y + 8, 18, 36 + wave);
      ctx.fillStyle = '#c8302a';
      ctx.fillRect(bx, y + 8, 4, 36 + wave);
      ctx.fillStyle = '#4a1010';
      ctx.fillRect(bx, y + 44 + wave, 6, 3);
      ctx.fillRect(bx + 12, y + 44 + wave, 6, 3);
      ctx.fillStyle = '#e8c547';
      ctx.fillRect(bx, y + 8, 18, 2);
      blob(bx + 9, y + 24, 4, '#e8c547');
      ctx.fillStyle = '#fff3a8';
      ctx.fillRect(bx + 8, y + 23, 2, 2);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.fillStyle = '#e8c547';
        ctx.fillRect(Math.round(bx + 9 + Math.cos(a) * 7), Math.round(y + 24 + Math.sin(a) * 7), 1, 1);
      }
    }
    for (const px of [x + 6, x + s.w - 18]) {
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(px - 1, y - 54, 14, 54);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px, y - 52, 12, 52);
      ctx.fillStyle = '#d8e0f0';
      ctx.fillRect(px + 3, y - 50, 1, 48);
      ctx.fillRect(px + 7, y - 50, 1, 48);
      ctx.fillRect(px + 10, y - 52, 2, 52);
      ctx.fillStyle = '#e8c547';
      ctx.fillRect(px - 3, y - 58, 18, 6);
      ctx.fillRect(px - 2, y - 4, 16, 4);
      ctx.fillStyle = '#fff3a8';
      ctx.fillRect(px - 3, y - 58, 18, 1);
      const fy = y - 68 + Math.round(Math.sin(tick * 0.08 + px) * 2);
      ctx.save();
      ctx.globalAlpha = 0.35;
      blob(px + 6, fy, 9, '#ffe14d');
      ctx.restore();
      blob(px + 6, fy, 4, '#ff9a2e');
      blob(px + 6, fy - 1, 2, '#fff3a8');
      if (tick % 6 === 0) particles.push({ x: px + cam + 6 + (Math.random() - 0.5) * 6, y: fy - 3, vx: 0, vy: -0.5, life: 20 });
    }
    if (tick % 8 === 0) {
      particles.push({ x: s.x + Math.random() * s.w, y: y - 2, vx: 0, vy: -0.35, life: 40 });
    }
  }

  function drawLight() {
    if (light.state !== 'descending' && light.state !== 'talk') return;
    const x = Math.round(light.x - cam);
    const y = Math.round(light.y + Math.sin(tick * 0.06) * 2);
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#fff3a8';
    ctx.fillRect(x - 14, Math.round(camY) - 10, 28, y - Math.round(camY) + 10);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 5, Math.round(camY) - 10, 10, y - Math.round(camY) + 10);
    ctx.globalAlpha = 0.22 + 0.08 * Math.sin(tick * 0.1);
    blob(x, y, 30, '#fff3a8');
    ctx.globalAlpha = 0.3;
    blob(x, y, 18, '#ffffff');
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffe14d';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + tick * 0.02;
      for (let r = 16; r < 28; r += 2) ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1);
    }
    ctx.restore();
    const img = lightFrames[Math.floor(tick / 12) % 2];
    drawImg(img, x - 12, y - 12, 1);
    if (tick % 5 === 0) {
      particles.push({ x: light.x + (Math.random() - 0.5) * 20, y: light.y + 10, vx: 0, vy: 0.2, life: 30 });
    }
  }

  function drawCloudMap() {
    drawStairs();
    for (let i = 0; i < 30; i++) {
      const sx = -40 + ((i * 47) % (W + 80));
      blob(sx, C2 + 92 + Math.round(Math.sin(i * 1.3 + tick * 0.015) * 5), 26, '#ffffff');
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, C2 + 100, W, 400);
    ctx.fillStyle = '#e3eefb';
    for (let i = 0; i < W; i += 48) ctx.fillRect(i + ((tick >> 2) % 48), C2 + 120, 20, 2);

    drawHeavenGate(RETURN_GATE_X - cam, C2_START.y, 1);
    drawCheckpointFlag(C2_MID.x + 14 - cam, C2_MID.y, c2.checkpoint);
    for (const c of C2_CLOUDS) {
      if (c.x + c.w < cam - 40 || c.x > cam + W + 40) continue;
      drawYellowCloud(c.x - cam, c.y, c.w, c.spd ? MOVING_CLOUD : WHITE_CLOUD);
    }
    if (C2_ARENA.x - cam < W + 60) {
      for (const px of [C2_ARENA.x + 20, C2_ARENA.x + C2_ARENA.w - 30]) {
        const x = Math.round(px - cam);
        ctx.fillStyle = '#1a1420';
        ctx.fillRect(x - 1, C2_ARENA.y - 44, 10, 44);
        ctx.fillStyle = '#f2f7ff';
        ctx.fillRect(x, C2_ARENA.y - 42, 8, 42);
        ctx.fillStyle = '#c4d6ee';
        ctx.fillRect(x + 5, C2_ARENA.y - 42, 3, 42);
        ctx.fillStyle = '#3a7bd5';
        ctx.fillRect(x - 2, C2_ARENA.y - 46, 12, 4);
        blob(x + 4, C2_ARENA.y - 52, 4, '#5ff0ff');
        if ((tick + px) % 40 < 14) sparkle(x + 4, C2_ARENA.y - 58, 1, '#e8ffff');
      }
    }
  }

  function drawBird() {
    if (bird.state === 'gone') return;
    const flying = bird.state === 'leaving';
    const flap = Math.floor(tick / (flying ? 4 : 18)) % 2;
    const bob = flying ? 0 : Math.round(Math.sin(tick * 0.08));
    const x = bird.x - cam;
    const y = bird.y + bob;
    drawImg(birdFrames[flap], x, y, bird.face);
    if (bird.state === 'idle' && bird.t % 60 < 40) {
      drawText('!', x + 5, y - 12, 8, '#ffe14d');
    }
    if (flying && tick % 3 === 0) {
      particles.push({ x: bird.x + 4 + Math.random() * 8, y: bird.y + 18, vx: -0.3, vy: 0.4, life: 20 });
    }
  }

  function drawAngel() {
    if (angel.state === 'gone') return;
    const flap = Math.floor(tick / 10) % 2;
    const bob = Math.round(Math.sin(tick * 0.06) * 2);
    const x = angel.x - cam;
    const y = angel.y + bob;
    ctx.save();
    ctx.globalAlpha = 0.25;
    blob(Math.round(x + 8), Math.round(y + 12), 16, '#fff3a8');
    ctx.restore();
    drawImg(angelFrames[flap], x, y, angel.face);
    if (angel.state === 'idle' && angel.t % 60 < 40) {
      drawText('!', x + 5, y - 12, 8, '#ffe14d');
    }
    if (angel.state === 'leaving' && tick % 4 === 0) {
      particles.push({ x: angel.x + 8 + (Math.random() - 0.5) * 12, y: angel.y + 20, vx: 0, vy: 0.3, life: 24 });
    }
  }

  function drawKnight() {
    if (knight.state === 'gone') return;
    const x = knight.x - cam;
    const fi = knight.t % 150 < 6 ? 1 : 0;
    ctx.save();
    if (knight.state === 'leaving') {
      ctx.globalAlpha = Math.max(0, 1 - knight.leaveT / 60);
      for (let i = 0; i < 4; i++) {
        sparkle(Math.round(x + 2 + ((i * 5 + knight.leaveT) % 13)), Math.round(knight.y + 18 - ((knight.leaveT * 1.5 + i * 9) % 40)), i % 2 + 1, '#eef4ff');
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(Math.round(x) + 3, Math.round(knight.y + 20), 10, 1);
    drawImg(knightFrames[fi], x, knight.y, knight.face);
    ctx.restore();
    if (knight.state === 'idle' && knight.t % 60 < 40) {
      drawText('!', x + 5, knight.y - 12, 8, '#ffe14d');
    }
  }

  function drawSkyLands() {
    if (camY > SKY_Y + 600 || inCloud2(camY)) return;
    const islands = [
      [YCLOUD.x - 80, SKY_Y - 105, 50], [YCLOUD.x + 235, SKY_Y - 70, 64], [YCLOUD.x + 115, SKY_Y - 120, 36],
      [3050, SKY_Y - 125, 44], [2880, SKY_Y - 140, 56], [2760, SKY_Y - 150, 40],
    ];
    for (const [ix, iy, iw] of islands) {
      const x = ix - cam;
      for (let dy = 0; dy < iw * 0.6; dy += 2) {
        const hw = Math.round(iw / 2 - dy * 0.8);
        if (hw <= 0) break;
        ctx.fillStyle = dy < 4 ? '#4caf3a' : dy % 6 < 3 ? '#8b5a2b' : '#7a4f28';
        ctx.fillRect(x - hw, iy + dy, hw * 2, 2);
      }
      blob(x - iw / 4, iy - 6, 7, '#2e7d32');
      ctx.fillStyle = '#5b3a1c';
      ctx.fillRect(x - iw / 4 - 1, iy - 2, 2, 3);
    }
    for (let i = 0; i < 26; i++) {
      const sx = -40 + ((i * 53) % (W + 80));
      const cy = SKY_Y + 78 + Math.round(Math.sin(i * 1.7 + tick * 0.01) * 6);
      blob(sx, cy, 24, '#ffffff');
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, SKY_Y + 90, W, 600);
    ctx.fillStyle = '#e3f1fb';
    for (let i = 0; i < W; i += 40) ctx.fillRect(i + ((tick >> 2) % 40), SKY_Y + 110, 18, 2);
    for (const c of SKY_CLOUDS) {
      if (c.x + c.w > cam - 30 && c.x < cam + W + 30) drawYellowCloud(c.x - cam, c.y, c.w);
    }
    if (ANGEL_CLOUD.x + ANGEL_CLOUD.w > cam - 30) {
      drawHeavenGate(GATE_X - cam, ANGEL_CLOUD.y, gate.open);
      drawYellowCloud(ANGEL_CLOUD.x - cam, ANGEL_CLOUD.y, ANGEL_CLOUD.w);
    }
    drawYellowCloud(YCLOUD.x - cam, SKY_Y, YCLOUD.w);
  }

  function makeProp(w, h, parts) {
    const c = document.createElement('canvas');
    c.width = w + 2;
    c.height = h + 2;
    const g = c.getContext('2d');
    g.fillStyle = '#1a1420';
    for (const [x, y, pw, ph] of parts) g.fillRect(x, y, pw + 2, ph + 2);
    for (const [x, y, pw, ph, col] of parts) {
      g.fillStyle = col;
      g.fillRect(x + 1, y + 1, pw, ph);
    }
    return c;
  }
  function makeRock(w, h) {
    return makeProp(w, h, [
      [3, 0, w - 6, h, '#7d8799'], [0, 3, w, h - 6, '#7d8799'],
      [4, 2, Math.round(w / 3), 3, '#949db0'], [2, 5, 4, 2, '#949db0'],
      [w - 9, h - 6, 6, 3, '#5d6677'], [w - 6, Math.round(h / 2), 3, 3, '#5d6677'],
    ]);
  }
  const OBSTACLE_SPRITES = {
    rock: makeRock(20, 16),
    bigRock: makeRock(30, 24),
    chair: makeProp(14, 20, [[0, 0, 4, 20, '#7a4f28'], [0, 10, 14, 4, '#a0713c'], [10, 14, 3, 6, '#7a4f28']]),
    table: makeProp(26, 14, [[0, 0, 26, 4, '#a0713c'], [2, 4, 3, 10, '#7a4f28'], [21, 4, 3, 10, '#7a4f28']]),
    bed: makeProp(32, 14, [
      [0, 6, 32, 6, '#7a4f28'], [0, 0, 4, 14, '#5b3a1c'], [28, 3, 4, 11, '#5b3a1c'],
      [4, 3, 24, 3, '#f5f0e0'], [12, 3, 16, 3, '#c0392b'], [5, 1, 6, 2, '#ffffff'],
    ]),
    lamp: makeProp(12, 24, [[1, 0, 10, 7, '#ffe9a8'], [5, 7, 2, 13, '#5b3a1c'], [1, 20, 10, 4, '#7a4f28']]),
    bookshelf: makeProp(18, 26, [
      [0, 0, 18, 26, '#5b3a1c'], [2, 2, 3, 9, '#c0392b'], [6, 3, 3, 8, '#2f6fdc'], [10, 2, 3, 9, '#e8c547'],
      [2, 14, 3, 9, '#27ae60'], [7, 15, 3, 8, '#8e44ad'], [12, 14, 3, 9, '#e67e22'],
    ]),
  };
  const OBSTACLE_TYPES = Object.keys(OBSTACLE_SPRITES);

  const SKY_RUN_COLORS = [
    ['#4aa3f0', '#8fcff9'], ['#3a86e0', '#7cc4f7'], ['#2f6fd0', '#6ab0f0'], ['#3a5fc0', '#f0c878'],
  ];

  function renderSky() {
    const p = clamp(sky.t / SKY_FRAMES, 0, 1);
    const [topC, botC] = SKY_RUN_COLORS[Math.min(3, Math.floor(p * 4))];
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, topC);
    grad.addColorStop(1, botC);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (sky.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * sky.shake), Math.round((Math.random() - 0.5) * sky.shake));

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (const s of sky.streaks) ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, Math.round(s.len * (sky.speed / 3)));

    if (sky.t < 90) drawTornado(sky.px + 4, H + 40 + sky.t * sky.speed, 1.6);

    if (sky.t > SKY_FRAMES - 70) {
      const y = Math.round(-40 + (sky.t - (SKY_FRAMES - 70)) * 1.8);
      drawYellowCloud(W / 2 - 90, y, 180);
    }

    for (const c of sky.clouds) {
      const x = Math.round(c.x), y = Math.round(c.y);
      const pulse = Math.sin(tick * 0.2 + c.x) * 1.5;
      ctx.save();
      ctx.globalAlpha = 0.3;
      blob(x + 14, y + 7, Math.round(17 + pulse), '#bff4ff');
      ctx.restore();
      const lobes = [[x + 6, y + 9, 6], [x + 13, y + 5, 8], [x + 21, y + 7, 7], [x + 26, y + 10, 4]];
      for (const [cx, cy, r] of lobes) blob(cx, cy, r + 1, '#7fb8e0');
      for (const [cx, cy, r] of lobes) blob(cx, cy, r, '#e8f6ff');
      ctx.fillStyle = '#c8e4f8';
      ctx.fillRect(x + 1, y + 11, 27, 3);
      for (const [cx, cy, r] of lobes) blob(cx - 2, cy - 2, Math.max(1, Math.round(r / 2)), '#ffffff');
      ctx.fillStyle = '#5fc8f0';
      ctx.fillRect(x + 10, y + 8, 2, 1);
      ctx.fillRect(x + 12, y + 7, 1, 3);
      ctx.fillRect(x + 16, y + 8, 2, 1);
      ctx.fillRect(x + 18, y + 7, 1, 3);
      if ((tick + x) % 30 < 12) sparkle(x + 24, y + 1, 1);
    }
    ctx.fillStyle = '#ffffff';
    for (const pf of sky.puffs) {
      ctx.globalAlpha = clamp(pf.life / 12, 0, 1);
      ctx.fillRect(Math.round(pf.x), Math.round(pf.y), 3, 3);
    }
    ctx.globalAlpha = 1;

    for (const o of sky.obstacles) {
      ctx.save();
      ctx.translate(Math.round(o.x + o.w / 2), Math.round(o.y + o.h / 2));
      ctx.rotate(o.rot);
      ctx.drawImage(o.img, -Math.round(o.w / 2), -Math.round(o.h / 2));
      ctx.restore();
    }

    const visible = !(sky.hit && Math.floor(sky.shake / 2) % 2);
    if (visible) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(Math.round(sky.px + 1 + i * 2), Math.round(sky.py + 19 + ((tick + i * 3) % 6)), 1, 4 + (i % 2) * 3);
      }
      drawImg(playerFrames[1], sky.px - 2, sky.py, sky.face);
    }
    ctx.restore();

    if (sky.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${sky.flash / 14})`;
      ctx.fillRect(0, 0, W, H);
    }

    drawPanel(8, 6, 120, 16);
    drawText(`DODGED ${sky.dodged}/${SKY_OBSTACLES}`, 14, 10, 8, '#3b2a1a', 'left', null);
    drawPanel(W - 132, 6, 124, 16);
    ctx.fillStyle = '#504030';
    ctx.fillRect(W - 126, 11, 112, 6);
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(W - 126, 11, Math.round(112 * p), 6);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(W - 126, 11, Math.round(112 * p), 2);
    if (sky.speed > 3.6) {
      drawText('SPEED UP!', W / 2, 30, 8, '#ffffff', 'center', '#2a4a80');
    }
    if (sky.t < 90) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (90 - sky.t) / 30);
      drawText('A/D: DODGE   HIT CLOUDS FOR SPEED!', W / 2, 196, 8, '#ffffff', 'center', '#2a4a80');
      ctx.restore();
    }
  }

  // ---------- Jungle render ----------
  const TRUNK_L = TREE_X - TRUNK_W / 2;
  const TRUNK_R = TREE_X + TRUNK_W / 2;
  const TRUNK_TOP = HOUSE.floorY + 6;

  function drawBranch(s) {
    const x = s.x - cam;
    const y = s.y;
    let c0 = null, c1 = null;
    if (s.x + s.w < TRUNK_L) [c0, c1] = [s.x + s.w, TRUNK_L];
    else if (s.x > TRUNK_R) [c0, c1] = [TRUNK_R, s.x];
    if (c0 !== null) {
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(c0 - cam, y + 1, c1 - c0, 5);
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(c0 - cam, y + 2, c1 - c0, 3);
    }
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x - 1, y - 1, s.w + 2, s.h + 2);
    ctx.fillStyle = '#7a4f28';
    ctx.fillRect(x, y, s.w, s.h);
    ctx.fillStyle = '#a0713c';
    ctx.fillRect(x, y, s.w, 1);
    ctx.fillStyle = '#5b3a1c';
    ctx.fillRect(x, y + s.h - 2, s.w, 2);
    for (let i = 3; i < s.w - 1; i += 5) ctx.fillRect(x + i, y + 2, 1, 2);
    ctx.fillStyle = '#5cc84a';
    for (let i = 1; i < s.w - 1; i += 4) ctx.fillRect(x + i, y - 1, 2, 1);
    const outer = s.x + s.w / 2 < TREE_X ? x - 1 : x + s.w + 1;
    blob(outer, y + 3, 4, '#1f6b2a');
    blob(outer, y + 2, 2, '#4caf50');
  }

  function drawWoodFloor(s) {
    const x = s.x - cam;
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x - 1, s.y - 1, s.w + 2, s.h + 2);
    for (let i = 0; i < s.w; i += 10) {
      ctx.fillStyle = (i / 10) % 2 ? '#8a5a30' : '#7a4f28';
      ctx.fillRect(x + i, s.y, Math.min(10, s.w - i), s.h);
      ctx.fillStyle = '#5b3a1c';
      ctx.fillRect(x + i, s.y, 1, s.h);
    }
    ctx.fillStyle = '#c38d52';
    ctx.fillRect(x, s.y, s.w, 1);
    ctx.fillStyle = '#4a2e14';
    ctx.fillRect(x, s.y + s.h - 2, s.w, 2);
  }

  function drawBgForest() {
    for (let x = TREE_X - 300; x < TREE_X + 560; x += 34) {
      const y = HOUSE.floorY - 10 + Math.round(Math.sin(x * 0.07) * 14);
      blob(x - cam, y, 30, '#1c4a22');
    }
    for (const bx of BG_TRUNKS) {
      const x = bx - cam;
      if (x < -60 || x > W + 60) continue;
      ctx.fillStyle = '#33220f';
      ctx.fillRect(x - 11, HOUSE.top, 22, GROUND_Y - HOUSE.top);
      ctx.fillStyle = '#3e2a18';
      ctx.fillRect(x - 9, HOUSE.top, 16, GROUND_Y - HOUSE.top);
      ctx.fillStyle = '#2a1a0c';
      for (let y = HOUSE.top + 10; y < GROUND_Y; y += 23) ctx.fillRect(x - 5 + ((y >> 2) % 7), y, 3, 5);
      blob(x, HOUSE.top + 8, 34, '#1a4220');
      blob(x - 24, HOUSE.top + 26, 24, '#1f4d24');
      blob(x + 24, HOUSE.top + 28, 22, '#1f4d24');
      blob(x - 6, HOUSE.top, 18, '#26592b');
      blob(x + 10, -40 + ((bx >> 3) % 40), 14, '#1f4d24');
    }
  }

  function drawJungleTree() {
    const L = TRUNK_L - cam;
    for (let dy = 0; dy < 34; dy++) {
      const extra = Math.round(((dy / 34) ** 2) * 34);
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(L - extra - 1, GROUND_Y - 34 + dy, TRUNK_W + extra * 2 + 2, 1);
      ctx.fillStyle = dy % 6 < 3 ? '#5a3a1c' : '#634020';
      ctx.fillRect(L - extra, GROUND_Y - 34 + dy, TRUNK_W + extra * 2, 1);
    }
    const len = GROUND_Y - 34 - TRUNK_TOP;
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(L - 1, TRUNK_TOP, TRUNK_W + 2, len);
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(L, TRUNK_TOP, TRUNK_W, len);
    for (let sx = 5; sx < TRUNK_W - 3; sx += 9) {
      ctx.fillStyle = '#4f3018';
      ctx.fillRect(L + sx, TRUNK_TOP, 2, len);
      ctx.fillStyle = '#8a5a30';
      ctx.fillRect(L + sx + 2, TRUNK_TOP, 1, len);
    }
    ctx.fillStyle = '#4a2c14';
    ctx.fillRect(L, TRUNK_TOP, 5, len);
    for (let y = TRUNK_TOP + 20; y < GROUND_Y - 40; y += 37) {
      const kx = L + 6 + ((y * 7) % (TRUNK_W - 16));
      ctx.fillStyle = '#3a2210';
      ctx.fillRect(kx, y, 6, 8);
      ctx.fillStyle = '#2a180a';
      ctx.fillRect(kx + 2, y + 2, 2, 4);
    }
    ctx.fillStyle = '#3d8a3a';
    for (let y = TRUNK_TOP + 6; y < GROUND_Y - 20; y += 11) {
      ctx.fillRect(L + ((y * 13) % TRUNK_W), y, 3, 2);
    }
  }

  function drawJungleCanopy() {
    const lobes = [
      [-110, 26, 24], [-70, 16, 32], [-20, 22, 36], [40, 18, 38], [100, 14, 36],
      [160, 18, 34], [220, 24, 28], [10, 40, 28], [130, 40, 26],
    ];
    const cy = HOUSE.floorY;
    for (const [dx, dy, r] of lobes) blob(TREE_X + dx - cam, cy + dy, r + 2, '#123a17');
    for (const [dx, dy, r] of lobes) blob(TREE_X + dx - cam, cy + dy, r, '#1f6b2a');
    for (const [dx, dy, r] of lobes) blob(TREE_X + dx - 6 - cam, cy + dy - 8, Math.round(r * 0.5), '#2e8b3a');
  }

  function drawVines() {
    for (const [vx, vy, len] of VINES) {
      for (let yy = 0; yy < len; yy++) {
        const off = Math.round(Math.sin(tick * 0.03 + vx) * 2 * (yy / len));
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(vx - cam + off, vy + yy, 1, 1);
        if (yy % 8 === 4) {
          ctx.fillStyle = '#5cc84a';
          ctx.fillRect(vx - cam + off + (yy % 16 === 4 ? 1 : -2), vy + yy, 2, 1);
        }
      }
    }
  }

  function drawVineWall() {
    const x0 = VINE_WALL.x - 16 - cam;
    if (x0 > W + 40 || x0 < -90) return;
    const top = HOUSE.floorY - 30;
    const falling = vines.state === 'falling';
    const gone = vines.state === 'gone';
    const pileA = gone ? 1 : falling ? clamp((vines.t - 20) / 50, 0, 1) : 0;
    if (pileA > 0) {
      ctx.save();
      ctx.globalAlpha = pileA;
      for (let i = 0; i < 6; i++) blob(x0 + 4 + i * 9, GROUND_Y, 6 + (i % 3) * 2, i % 2 ? '#1f5e24' : '#2e7d32');
      ctx.fillStyle = '#5cc84a';
      for (let i = 0; i < 10; i++) ctx.fillRect(x0 + 2 + i * 5, GROUND_Y - 4 - (i % 3) * 2, 2, 1);
      ctx.restore();
    }
    if (gone) return;

    if (!falling) {
      blob(x0 + 24, top, 26, '#123a17');
      blob(x0 + 24, top - 2, 22, '#1f6b2a');
      blob(x0 + 16, top - 8, 10, '#2e8b3a');
    }
    for (let i = 0; i < 18; i++) {
      const vx = x0 + i * 3 + (i % 3);
      const ft = falling ? Math.max(0, vines.t - ((i * 7) % 24)) : 0;
      const dy = ft * ft * 0.09;
      const alpha = falling ? clamp(1 - (ft - 30) / 30, 0, 1) : 1;
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      const len = GROUND_Y - top - ((i * 13) % 18);
      for (let yy = 0; yy < len; yy += 2) {
        const sway = Math.round(Math.sin(tick * 0.03 + i + yy * 0.02) * 1.5 * (yy / len));
        const y = Math.round(top + yy + dy);
        ctx.fillStyle = i % 2 ? '#2e7d32' : '#1f5e24';
        ctx.fillRect(vx + sway, y, 2, 2);
        if ((yy + i * 6) % 10 === 0) {
          const lx = vx + sway + ((yy / 10) % 2 ? 2 : -3);
          ctx.fillStyle = '#5cc84a';
          ctx.fillRect(lx, y, 3, 2);
          ctx.fillStyle = '#8ee05a';
          ctx.fillRect(lx, y, 1, 1);
        }
      }
    }
    for (let k = 0; k < 7; k++) {
      const hy = top + 40 + k * 52;
      const ft = falling ? Math.max(0, vines.t - k * 3) : 0;
      const dy = ft * ft * 0.1;
      const alpha = falling ? clamp(1 - (ft - 25) / 25, 0, 1) : 1;
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      for (let x = 0; x < 56; x += 2) {
        const sag = Math.round(Math.sin((x / 56) * Math.PI) * 7);
        ctx.fillStyle = '#245f28';
        ctx.fillRect(x0 + x, Math.round(hy + sag + dy), 2, 2);
        if (x % 8 === 4) {
          ctx.fillStyle = '#5cc84a';
          ctx.fillRect(x0 + x, Math.round(hy + sag + dy) + 2, 2, 2);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawBushes() {
    for (let x = TREE_X - 240; x < TREE_X + 420; x += 46) {
      if (Math.abs(x - TREE_X) < 50) continue;
      const r = 10 + ((x >> 2) % 6);
      blob(x - cam, GROUND_Y, r + 1, '#123a17');
      blob(x - cam, GROUND_Y, r, '#2e7d32');
      blob(x - cam - 3, GROUND_Y - 4, Math.round(r / 2), '#43a047');
    }
  }

  function planks(x, y, w, h, a, b) {
    for (let yy = 0; yy < h; yy += 6) {
      ctx.fillStyle = (yy / 6) % 2 ? a : b;
      ctx.fillRect(x, y + yy, w, Math.min(6, h - yy));
    }
  }

  function drawHouseBack() {
    const x = HOUSE.x - cam;
    const top = HOUSE.top;
    const fy = HOUSE.floorY;
    const w = HOUSE.w;
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x - 1, top - 1, w + 2, fy - top + 1);
    planks(x, top, w, fy - top, '#6e4520', '#5f3b1a');

    ctx.fillStyle = '#3e2712';
    ctx.fillRect(x + 69, top + 13, 30, 24);
    ctx.fillStyle = '#8fcff9';
    ctx.fillRect(x + 71, top + 15, 26, 20);
    ctx.fillStyle = '#2e8b3a';
    ctx.fillRect(x + 71, top + 29, 26, 6);
    ctx.fillStyle = '#3e2712';
    ctx.fillRect(x + 83, top + 15, 2, 20);
    ctx.fillRect(x + 71, top + 24, 26, 2);

    ctx.fillStyle = '#3e2712';
    ctx.fillRect(x + 8, fy - 42, 22, 42);
    const books = ['#c0392b', '#2f6fdc', '#e8c547', '#27ae60', '#8e44ad', '#e67e22'];
    for (let s = 0; s < 3; s++) {
      ctx.fillStyle = '#7a4f28';
      ctx.fillRect(x + 9, fy - 41 + s * 14, 20, 12);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = books[(i + s * 2) % books.length];
        ctx.fillRect(x + 10 + i * 4, fy - 39 + s * 14 + (i % 2), 3, 10 - (i % 2));
      }
    }

    ctx.fillStyle = '#3e2712';
    ctx.fillRect(x + 37, top + 11, 20, 14);
    ctx.fillStyle = '#8fcff9';
    ctx.fillRect(x + 39, top + 13, 16, 10);
    ctx.fillStyle = '#4caf3a';
    ctx.fillRect(x + 39, top + 19, 16, 4);
    ctx.fillStyle = '#ffe56b';
    ctx.fillRect(x + 50, top + 14, 3, 3);

    ctx.fillStyle = '#9a1c1a';
    ctx.fillRect(x + 36, fy - 2, 66, 2);
    ctx.fillStyle = '#e8c547';
    for (let i = 0; i < 66; i += 6) ctx.fillRect(x + 36 + i, fy - 2, 2, 1);

    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x + 45, fy - 16, 30, 4);
    ctx.fillStyle = '#a0713c';
    ctx.fillRect(x + 46, fy - 15, 28, 2);
    ctx.fillStyle = '#5b3a1c';
    ctx.fillRect(x + 48, fy - 12, 2, 10);
    ctx.fillRect(x + 70, fy - 12, 2, 10);
    ctx.fillStyle = '#f5e6c0';
    ctx.fillRect(x + 58, fy - 21, 3, 5);
    ctx.fillStyle = tick % 20 < 10 ? '#ffb300' : '#ffe14d';
    ctx.fillRect(x + 59, fy - 24, 1, 3);

    ctx.fillStyle = '#5b3a1c';
    ctx.fillRect(x + 78, fy - 10, 9, 2);
    ctx.fillRect(x + 85, fy - 24, 2, 24);
    ctx.fillRect(x + 78, fy - 8, 2, 8);

    ctx.fillStyle = '#a0522d';
    ctx.fillRect(x + 92, fy - 8, 8, 8);
    blob(x + 96, fy - 12, 5, '#2e8b3a');
    blob(x + 95, fy - 14, 2, '#5cc84a');

    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x + 112, fy - 12, 44, 12);
    ctx.fillRect(x + 152, fy - 24, 8, 24);
    ctx.fillStyle = '#7a4f28';
    ctx.fillRect(x + 153, fy - 23, 6, 23);
    ctx.fillRect(x + 113, fy - 6, 42, 5);
    ctx.fillStyle = '#f5f0e0';
    ctx.fillRect(x + 113, fy - 11, 40, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 142, fy - 15, 10, 4);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(x + 113, fy - 11, 28, 5);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(x + 113, fy - 11, 28, 1);

    const px = 1956 - cam;
    ctx.fillStyle = '#5b3a1c';
    ctx.fillRect(px + 2, fy - 12, 3, 12);
    ctx.fillRect(px + 2, fy - 12, HOUSE.x - 1956 - 2, 2);
  }

  function drawHouseFront() {
    const x = HOUSE.x - cam;
    const top = HOUSE.top;
    const fy = HOUSE.floorY;
    const w = HOUSE.w;

    ctx.save();
    ctx.globalAlpha = house.alpha;
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x - 1, top - 1, w + 2, fy - top + 1);
    planks(x, top, w, fy - top, '#a0713c', '#8f6434');
    ctx.fillStyle = '#5b3a1c';
    ctx.fillRect(x, top, 4, fy - top);
    ctx.fillRect(x + w - 4, top, 4, fy - top);
    ctx.fillRect(x, top, w, 3);

    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x + 5, fy - 32, 20, 32);
    ctx.fillStyle = '#3e2712';
    ctx.fillRect(x + 7, fy - 30, 16, 30);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(x + 19, fy - 16, 2, 2);

    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x + 78, top + 14, 34, 26);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(x + 80, top + 16, 30, 22);
    ctx.fillStyle = '#5b3a1c';
    ctx.fillRect(x + 94, top + 16, 2, 22);
    ctx.fillRect(x + 80, top + 26, 30, 2);
    ctx.fillStyle = '#7a4f28';
    ctx.fillRect(x + 76, top + 40, 38, 5);
    const fl = ['#ff6f91', '#ffe14d', '#ffffff', '#ff6f91', '#b07cff'];
    fl.forEach((c, i) => {
      ctx.fillStyle = '#2e8b3a';
      ctx.fillRect(x + 80 + i * 7, top + 37, 2, 3);
      ctx.fillStyle = c;
      ctx.fillRect(x + 79 + i * 7, top + 35, 3, 2);
    });

    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x + 130, top + 14, 22, 22);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(x + 132, top + 16, 18, 18);
    ctx.fillStyle = '#5b3a1c';
    ctx.fillRect(x + 140, top + 16, 2, 18);
    ctx.restore();

    for (let r = 0; r < 20; r++) {
      const inset = Math.round(r * 4.4);
      const rw = w + 28 - inset * 2;
      if (rw <= 0) break;
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(x - 14 + inset - 1, top - 2 - r * 3, rw + 2, 3);
      ctx.fillStyle = r % 2 ? '#8b3a2a' : '#7a3022';
      ctx.fillRect(x - 14 + inset, top - 2 - r * 3, rw, 3);
    }
    blob(x + 20, top - 6, 8, '#1f6b2a');
    blob(x + w - 16, top - 4, 9, '#1f6b2a');
    blob(x + w - 20, top - 8, 4, '#2e8b3a');
  }

  function drawMonkey() {
    if (monkey.state === 'gone') return;
    let frame = 0;
    let hop = 0;
    if (monkey.state === 'talk' || monkey.state === 'beaten') {
      frame = dialog.active && Math.floor(tick / 6) % 2 ? 1 : 0;
    } else if (monkey.state === 'leaving') {
      frame = 1;
    } else {
      const ph = monkey.t % 90;
      if (ph < 16) hop = -Math.round(Math.sin((ph / 16) * Math.PI) * 4);
      frame = ph < 16 ? 1 : 0;
    }
    drawChar(monkeyFrames[frame], monkey.x, monkey.y + hop, monkey.face);
    if (monkey.state === 'idle' && monkey.t % 60 < 40) {
      drawText('!', monkey.x - cam + 4, monkey.y - 14, 8, '#ffe14d');
    }
  }

  // ---------- Inventory render ----------
  const GEM_ROWS = [
    '..kkkk..',
    '.kwyook.',
    'kwyoorrk',
    'kyoorrRk',
    '.korrRk.',
    '..krRk..',
    '...kk...',
  ];
  const ITEM_SPRITES = {
    skyGem: buildSprite(GEM_ROWS, {
      k: '#1a1420', w: '#ffffff', y: '#cff6ff', o: '#8fe4ff', r: '#3fb6f0', R: '#1f6fb0',
    }),
    angelCrystal: buildSprite(GEM_ROWS, {
      k: '#1a1420', w: '#ffffff', y: '#fff3a8', o: '#ffe14d', r: '#e8c547', R: '#b8901a',
    }),
    knightCrystal: buildSprite(GEM_ROWS, {
      k: '#1a1420', w: '#ffffff', y: '#eef4ff', o: '#b8c4d6', r: '#6e7a90', R: '#3c4458',
    }),
    archerCrystal: buildSprite(GEM_ROWS, {
      k: '#1a1420', w: '#ffffff', y: '#c8f0b0', o: '#7ed860', r: '#4caf50', R: '#2e7d32',
    }),
    jokerCrystal: buildSprite(GEM_ROWS, {
      k: '#1a1420', w: '#ffffff', y: '#f0c8ff', o: '#d07cff', r: '#9c3fd8', R: '#5b2a86',
    }),
    kingCrystal: buildSprite(GEM_ROWS, {
      k: '#1a1420', w: '#ffffff', y: '#fff3a8', o: '#ffd84a', r: '#e8a020', R: '#b8701a',
    }),
    lightGem: buildSprite(GEM_ROWS, {
      k: '#1a1420', w: '#ffffff', y: '#fffbe8', o: '#fff6b0', r: '#ffe9a0', R: '#d8b848',
    }),
    fireGem: buildSprite(GEM_ROWS, {
      k: '#1a1420', w: '#fff6c0', y: '#ffe14d', o: '#ff9a2e', r: '#e83a30', R: '#9a1c1a',
    }),
    leafGem: buildSprite(GEM_ROWS, {
      k: '#1a1420', w: '#eaffd0', y: '#a8f070', o: '#5cc84a', r: '#2e9a3a', R: '#1a5e22',
    }),
    swapCrystal: buildSprite(
      [
        '...kk...',
        '..kwck..',
        '.kwccbk.',
        'kwccbbbk',
        'kccbbbPk',
        '.kcbbPk.',
        '..kbPk..',
        '...kk...',
      ],
      { k: '#1a1420', w: '#ffffff', c: '#9ff0ff', b: '#7a6cff', P: '#4a2fb0' }
    ),
  };

  function drawCrystal() {
    if (crystal.taken) return;
    const bob = Math.round(Math.sin(tick * 0.08) * 2);
    const x = crystal.x - cam;
    const y = crystal.y + bob;
    blob(x + 4, y + 4, 7, 'rgba(160,140,255,0.25)');
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 1, HOUSE.floorY - 1, 6, 1);
    ctx.drawImage(ITEM_SPRITES.swapCrystal, x, y);
    const sp = tick % 60;
    if (sp < 20) {
      const sx = x + [1, 7, 4][Math.floor(tick / 60) % 3];
      const sy = y + [0, 3, -2][Math.floor(tick / 60) % 3];
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx, sy - 1, 1, 3);
      ctx.fillRect(sx - 1, sy, 3, 1);
    }
    if (nearCrystal() && !dialog.active) {
      drawText('E: PICK UP', x + 4, y - 14, 8, '#ffffff', 'center');
    }
  }

  function drawToast() {
    if (toast.t <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, toast.t / 30);
    const w = toast.text.length * 8 + 24;
    const x = Math.round(W / 2 - w / 2);
    drawPanel(x, 30, w, 22);
    ctx.drawImage(ITEM_SPRITES.swapCrystal, x + 6, 37);
    drawText(toast.text, x + 18, 37, 8, '#5a3fb0', 'left', null);
    ctx.restore();
  }

  function drawBagButton() {
    const r = BAG_BTN;
    const hover = !inv.open && inRect(mouse, r);
    ctx.fillStyle = '#1c140c';
    ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    ctx.fillStyle = hover ? '#f5e6c0' : '#e8d3a2';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#c9ae74';
    ctx.fillRect(r.x, r.y + r.h - 2, r.w, 2);
    const bx = r.x + 5, by = r.y + 4;
    ctx.fillStyle = '#3e2712';
    ctx.fillRect(bx + 4, by, 6, 2);
    ctx.fillRect(bx + 3, by + 2, 8, 1);
    ctx.fillRect(bx, by + 3, 14, 11);
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(bx + 1, by + 4, 12, 9);
    ctx.fillStyle = '#a3713c';
    ctx.fillRect(bx + 1, by + 4, 12, 2);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(bx + 6, by + 6, 2, 2);
  }

  function drawButton(r, label, enabled) {
    const hover = enabled && inRect(mouse, r);
    ctx.fillStyle = '#1c140c';
    ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    ctx.fillStyle = !enabled ? '#b8a27a' : hover ? '#c0302c' : '#9a1c1a';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    drawText(label, r.x + r.w / 2, r.y + 5, 8, enabled ? '#ffe14d' : '#8a7550', 'center', null);
  }

  function drawInventory() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, H);
    const P = INV_PANEL;
    drawPanel(P.x, P.y, P.w, P.h);
    drawText('INVENTORY', P.x + 10, P.y + 9, 8, '#3b2a1a', 'left', null);

    const c = INV_CLOSE;
    const hoverX = inRect(mouse, c);
    ctx.fillStyle = hoverX ? '#c0302c' : '#9a1c1a';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = '#ffe14d';
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(c.x + 3 + i, c.y + 3 + i, 1, 1);
      ctx.fillRect(c.x + 10 - i, c.y + 3 + i, 1, 1);
    }

    for (let i = 0; i < invSlots(); i++) {
      const r = invSlotRect(i);
      const id = inventory[i];
      const selected = inv.sel === i;
      ctx.fillStyle = selected ? '#e8c547' : '#1c140c';
      ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
      ctx.fillStyle = selected ? '#f5e6c0' : '#c9ae74';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#b39660';
      ctx.fillRect(r.x, r.y, r.w, 2);
      if (id) {
        const img = ITEM_SPRITES[id];
        drawImg(img, r.x + (r.w - img.width * 3) / 2, r.y + (r.h - img.height * 3) / 2, 1, 3);
        if (inv.equipped === id) {
          ctx.fillStyle = '#2f6fdc';
          ctx.fillRect(r.x + r.w - 10, r.y + 1, 9, 9);
          drawText('E', r.x + r.w - 9, r.y + 2, 8, '#ffffff', 'left', null);
        }
      }
    }

    const sel = inventory[inv.sel];
    if (sel) {
      const item = ITEMS[sel];
      drawText(item.name + (inv.equipped === sel ? ' (EQUIPPED)' : ''), P.x + 18, P.y + 110, 8, '#9a1c1a', 'left', null);
      wrapText(item.desc, P.w - 36).forEach((line, i) => drawText(line, P.x + 18, P.y + 124 + i * 11, 8, '#3b2a1a', 'left', null));
    } else {
      drawText(inventory.some(Boolean) ? 'SELECT AN ITEM' : 'YOUR BAG IS EMPTY', P.x + 18, P.y + 122, 8, '#8a7550', 'left', null);
    }

    drawButton(EQUIP_BTN, sel && inv.equipped === sel ? 'UNEQUIP' : 'EQUIP', isGem(sel));
  }

  // ---------- World render ----------
  function layer(factor, fn) {
    ctx.save();
    ctx.translate(0, Math.round(-camY * factor));
    fn();
    ctx.restore();
  }

  function renderWorld() {
    const cloud2 = inCloud2(camY);
    if (cloud2) {
      drawCloudMapBg();
    } else {
      drawSky();
      layer(0.1, drawClouds);
      layer(0.2, () => drawHills(0.2, 120, 22, 0.012, '#8fc7a0'));
      layer(0.3, drawCastle);
      layer(0.4, drawFarMountains);
      layer(0.45, () => drawHills(0.45, 150, 14, 0.02, '#5fae62'));
      layer(0.7, () => drawHills(0.7, 166, 8, 0.03, '#4c9a4f'));
    }

    ctx.save();
    ctx.translate(0, -Math.round(camY));
    if (cloud2) {
      drawCloudMap();
      drawBird();
      drawLight();
    }
    const nearTree = cam + W > TREE_X - 520 && cam < TREE_X + 560;
    if (nearTree) {
      drawBgForest();
      drawJungleTree();
      drawJungleCanopy();
      drawVines();
    }

    for (const tx of trees) {
      if (tx < cam - 30 || tx > cam + W + 30) continue;
      drawTree(tx - cam, groundTopAt(tx));
    }
    for (const [fx, n] of fences) {
      if (fx + n * 10 < cam || fx > cam + W) continue;
      drawFence(fx - cam, n, GROUND_Y);
    }
    if (cam < 120) drawSign(110 - cam, GROUND_Y);

    if (nearTree) drawHouseBack();
    drawSkyLands();
    drawSolids();
    drawWindCharge();
    drawFlowers();
    if (nearTree) drawBushes();
    if (nearTree) drawVineWall();
    if (nearTree) drawCrystal();
    drawMonkey();
    if (camY < SKY_Y + 600) drawAngel();

    if (npc.state !== 'gone') {
      let img;
      if (npc.state === 'leaving') img = npcFrames[walkFrame(npc.walk)];
      else img = npc.t % 180 < 8 ? npcBlink : npcFrames[0];
      drawChar(img, npc.x, npc.y, npc.face);
      if (npc.state === 'idle' && npc.t % 60 < 40) {
        drawText('!', npc.x - cam + 3, npc.y - 14, 8, '#ffe14d');
      }
    }

    let frame = 0;
    if (!player.onGround) frame = 1;
    else if (player.walk > 0) frame = walkFrame(player.walk);
    drawChar(playerFrames[frame], player.x - 2, player.y, player.face);

    ctx.fillStyle = '#d9c08a';
    for (const p of particles) {
      ctx.globalAlpha = Math.min(1, p.life / 15);
      ctx.fillRect(Math.round(p.x - cam), Math.round(p.y), 1, 1);
    }
    ctx.globalAlpha = 1;
    for (const l of fallingLeaves) {
      ctx.fillStyle = l.c;
      ctx.fillRect(Math.round(l.x - cam), Math.round(l.y), 2, 1);
      ctx.fillRect(Math.round(l.x - cam) + (Math.sin(l.ph) > 0 ? 1 : 0), Math.round(l.y) + 1, 1, 1);
    }
    if (nearTree) drawHouseFront();
    ctx.restore();

    drawDialog();
    drawTitle();
    drawHint();
    drawToast();
    if (canOpenInventory() || inv.open) drawBagButton();
    if (inv.open) drawInventory();
  }

  function renderTransition() {
    const t = game.transT;
    if (t < 16 && Math.floor(t / 4) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(0, 0, W, H);
    }
    if (t >= 16) {
      const p = clamp((t - 16) / 40, 0, 1);
      const rows = 8;
      const rh = H / rows;
      ctx.fillStyle = '#000';
      for (let i = 0; i < rows; i++) {
        const w = Math.ceil(p * W);
        if (i % 2 === 0) ctx.fillRect(0, i * rh, w, rh + 1);
        else ctx.fillRect(W - w, i * rh, w, rh + 1);
      }
    }
  }

  // ---------- Battle render ----------
  const LEAF_COLORS = ['#5cc84a', '#2e9a3a', '#8ee05a', '#3fb04a'];
  function drawLeaf(x, y, spin, i) {
    x = Math.round(x);
    y = Math.round(y);
    const k = ((Math.floor(spin / 3) % 4) + 4) % 4;
    const c = LEAF_COLORS[i % 4];
    if (k === 0 || k === 2) {
      const [w, h] = k === 0 ? [5, 2] : [2, 5];
      ctx.fillStyle = '#14481a';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#c8ff9a';
      ctx.fillRect(x, y, k === 0 ? w : 1, k === 0 ? 1 : h);
    } else {
      const s = k === 1 ? 1 : -1;
      ctx.fillStyle = '#14481a';
      for (let j = -1; j <= 1; j++) ctx.fillRect(x + j * 2 * s - 1, y + j * 2 - 1, 4, 4);
      ctx.fillStyle = c;
      for (let j = -1; j <= 1; j++) ctx.fillRect(x + j * 2 * s, y + j * 2, 2, 2);
      ctx.fillStyle = '#c8ff9a';
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function hpColor(ratio) {
    if (ratio > 0.5) return '#48d048';
    if (ratio > 0.2) return '#f0c030';
    return '#e83a30';
  }

  function drawHpBar(x, y, w, cur, max) {
    ctx.fillStyle = '#1c140c';
    ctx.fillRect(x - 1, y - 1, w + 2, 8);
    ctx.fillStyle = '#504030';
    ctx.fillRect(x, y, w, 6);
    const ratio = clamp(cur / max, 0, 1);
    ctx.fillStyle = hpColor(ratio);
    ctx.fillRect(x, y, Math.round(w * ratio), 6);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, Math.round(w * ratio), 2);
  }

  function drawPanel(x, y, w, h) {
    ctx.fillStyle = '#1c140c';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#e8d3a2';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#c9ae74';
    ctx.fillRect(x, y + h - 3, w, 3);
  }

  function drawPlatform(cx, cy, rx, ry, pal = ['#7ad957', '#4caf3a', '#3a8a2c']) {
    for (let dy = -ry; dy <= ry; dy++) {
      const w = Math.round(rx * Math.sqrt(1 - (dy * dy) / (ry * ry)));
      ctx.fillStyle = dy < -ry + 3 ? pal[0] : dy < 0 ? pal[1] : pal[2];
      ctx.fillRect(cx - w, cy + dy, w * 2, 1);
    }
  }

  function renderBattle() {
    const b = battle;
    ctx.save();
    if (b.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * b.shake), 0);

    const HORIZON = 70;
    const heaven = b.enemy.bg === 'heaven';
    const cloudBg = b.enemy.bg === 'cloud';
    const royalBg = b.enemy.bg === 'royal';
    const kingBg = b.enemy.bg === 'king' || royalBg;
    const castleBg = b.enemy.bg === 'castle' || kingBg;
    const skyBands = heaven ? ['#f6d77a', '#f9e29a', '#fbecb8', '#fdf4d4', '#fffaea']
      : cloudBg ? ['#2c4aa6', '#3a5cb8', '#4a70c8', '#6189d6', '#7ca0e2', '#9ab8ee']
      : castleBg ? ['#1e1b2a', '#24202f', '#2a2638', '#302b40', '#36314a'] : SKY;
    const band = Math.ceil(HORIZON / skyBands.length);
    skyBands.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(-8, i * band, W + 16, band);
    });
    const forest = b.enemy.bg === 'forest';
    if (heaven) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = '#fffbe8';
        const rx = 30 + i * 56 + Math.round(Math.sin(tick * 0.02 + i) * 4);
        ctx.beginPath();
        ctx.moveTo(rx, 0);
        ctx.lineTo(rx + 10, 0);
        ctx.lineTo(rx + 26, HORIZON);
        ctx.lineTo(rx + 12, HORIZON);
        ctx.fill();
      }
      ctx.restore();
      for (const px of [40, 120, 270, 350]) {
        ctx.fillStyle = '#c8b88a';
        ctx.fillRect(px - 6, 14, 12, HORIZON - 14);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - 5, 16, 8, HORIZON - 16);
        ctx.fillStyle = '#e8c547';
        ctx.fillRect(px - 8, 12, 16, 4);
      }
      for (let i = 0; i < 10; i++) blob(i * 42 + ((tick >> 3) % 42) - 20, HORIZON - 2, 14, '#ffffff');
      ctx.fillStyle = '#fffaea';
      ctx.fillRect(-8, HORIZON, W + 16, H - HORIZON);
      ctx.fillStyle = '#f3e6bf';
      for (let y = HORIZON + 4, gap = 4; y < 164; gap += 2, y += gap) ctx.fillRect(-8, y, W + 16, 2);
      for (let k = 0; k < 4; k++) {
        const ph = (tick + k * 29) % 60;
        if (ph < 20) sparkle((k * 97 + Math.floor((tick + k * 29) / 60) * 61) % W, 10 + ((k * 37) % 50), ph < 10 ? 1 : 2, '#ffffff');
      }
    } else if (cloudBg) {
      for (let i = 0; i < 7; i++) {
        const tx = 20 + i * 60;
        const th = 26 + ((i * 17) % 20);
        ctx.fillStyle = '#a7c4f2';
        ctx.fillRect(tx - 7, HORIZON - th, 14, th);
        blob(tx, HORIZON - th, 10, '#bcd2f6');
      }
      for (let i = 0; i < 12; i++) blob(i * 36 + ((tick >> 2) % 36) - 18, HORIZON - 2, 15, '#eef4ff');
      ctx.fillStyle = '#f2f7ff';
      ctx.fillRect(-8, HORIZON, W + 16, H - HORIZON);
      ctx.fillStyle = '#dbe7f7';
      for (let y = HORIZON + 4, gap = 4; y < 164; gap += 2, y += gap) ctx.fillRect(-8, y, W + 16, 2);
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) {
        const wx = Math.round(((i * 97 - tick * (2 + (i % 3))) % (W + 60) + W + 60) % (W + 60)) - 30;
        ctx.fillRect(wx, 8 + ((i * 23) % 56), 18 + (i % 3) * 8, 1);
      }
      ctx.restore();
    } else if (castleBg) {
      ctx.fillStyle = '#3e3a52';
      for (let y = 4; y < HORIZON; y += 8) {
        for (let x = ((y >> 3) % 2) * 12 - 12; x < W; x += 24) ctx.fillRect(x, y, 22, 1);
      }
      for (const [wx, col] of [[96, '#3a6fd8'], [192, '#d84a4a'], [288, '#4ab06a']]) {
        ctx.fillStyle = '#1a1420';
        ctx.fillRect(wx - 10, 10, 20, 44);
        ctx.fillStyle = col;
        ctx.fillRect(wx - 8, 14, 16, 38);
        ctx.fillStyle = '#e8c547';
        ctx.fillRect(wx - 1, 14, 2, 38);
        ctx.fillRect(wx - 8, 32, 16, 2);
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#fff3a8';
        ctx.beginPath();
        ctx.moveTo(wx - 8, 52);
        ctx.lineTo(wx + 8, 52);
        ctx.lineTo(wx + 40, 150);
        ctx.lineTo(wx + 8, 150);
        ctx.fill();
        ctx.restore();
      }
      for (const px of [24, 144, 240, 360]) {
        ctx.fillStyle = '#1a1420';
        ctx.fillRect(px - 9, 0, 18, HORIZON);
        ctx.fillStyle = '#8a86a0';
        ctx.fillRect(px - 8, 0, 16, HORIZON);
        ctx.fillStyle = '#a8a4bc';
        ctx.fillRect(px - 8, 0, 4, HORIZON);
      }
      for (const bx of [48, 336]) {
        ctx.fillStyle = '#a3202a';
        ctx.fillRect(bx - 7, 6, 14, 40);
        ctx.fillStyle = '#e8c547';
        ctx.fillRect(bx - 7, 6, 14, 2);
        ctx.fillRect(bx - 2, 22, 4, 4);
      }
      ctx.fillStyle = '#5e5a72';
      ctx.fillRect(-8, HORIZON, W + 16, H - HORIZON);
      ctx.fillStyle = '#6d6880';
      for (let y = HORIZON + 4, gap = 4; y < 164; gap += 2, y += gap) ctx.fillRect(-8, y, W + 16, 2);
      ctx.fillStyle = kingBg ? '#5b2a86' : '#9c1f2b';
      ctx.fillRect(150, HORIZON, 84, H - HORIZON);
      ctx.fillStyle = '#e8c547';
      ctx.fillRect(152, HORIZON, 1, H - HORIZON);
      ctx.fillRect(231, HORIZON, 1, H - HORIZON);
      if (royalBg) {
        for (let i = 0; i < 14; i++) {
          const ph = (tick + i * 17) % 50;
          if (ph < 16) sparkle((i * 89 + Math.floor((tick + i * 17) / 50) * 53) % W, 6 + ((i * 41) % 60), ph < 8 ? 1 : 2, '#ffe14d');
        }
      } else if (kingBg) {
        for (let i = 0; i < 26; i++) {
          const cx = (i * 47 + Math.sin(tick * 0.03 + i) * 10) % W;
          const cy = (i * 29 + tick * (0.4 + (i % 3) * 0.2)) % H;
          ctx.fillStyle = ['#ff3e6c', '#ffe14d', '#3ec8ff', '#7ed860', '#b07cff'][i % 5];
          ctx.fillRect(Math.round(cx), Math.round(cy), (tick + i) % 20 < 10 ? 3 : 1, 2);
        }
      }
    } else if (forest) {
      for (const tx of [10, 64, 150, 236, 330, 380]) {
        ctx.fillStyle = '#3e2a18';
        ctx.fillRect(tx - 6, 0, 12, HORIZON);
        blob(tx, 6, 30, '#1f4d24');
        blob(tx + 18, 22, 18, '#26592b');
      }
      drawHills(0.2, HORIZON, 6, 0.05, '#2e6b34');
    } else {
      drawHills(0.2, HORIZON, 10, 0.03, '#7fbf8f');
      drawHills(0.5, HORIZON + 2, 6, 0.05, '#6fb27f');
    }
    if (!heaven && !cloudBg && !castleBg) {
      ctx.fillStyle = forest ? '#86c070' : '#9fd38a';
      ctx.fillRect(-8, HORIZON, W + 16, H - HORIZON);
      ctx.fillStyle = forest ? '#78b062' : '#8cc878';
      for (let y = HORIZON + 4, gap = 4; y < 164; gap += 2, y += gap) ctx.fillRect(-8, y, W + 16, 2);
    }

    const slide = clamp(1 - b.introT / 30, 0, 1);
    const eBaseX = 282 + Math.round(slide * 160);
    const pBaseX = 72 - Math.round(slide * 160);

    const pal = heaven ? ['#fff3a8', '#ffd84a', '#e0b830']
      : cloudBg ? ['#ffffff', '#dbe7f7', '#b4c8e6']
      : castleBg ? ['#9c9ab4', '#7d7892', '#5e5a72'] : undefined;
    drawPlatform(eBaseX + 18, 94, 52, 9, pal);
    drawPlatform(pBaseX + 24, 154, 62, 11, pal);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    if (b.ehp > 0 || b.eHurt > 0) ctx.fillRect(eBaseX + 4, 94, 28, 3);
    if (b.php > 0 || b.pHurt > 0) ctx.fillRect(pBaseX + 6, 155, 36, 4);

    const e = b.cur;
    let eOff = 0, pOff = 0;
    if (e && e.type === 'hit' && !e.move.anim) {
      const lunge = b.t < 12 ? b.t : Math.max(0, 24 - b.t);
      if (e.who === 'player') pOff = lunge * 2;
      else eOff = -lunge * 2;
    }
    if (e && e.type === 'hit' && e.move.anim && b.t < 8) {
      if (e.who === 'player') pOff = b.t % 2 ? 2 : -2;
      else eOff = b.t % 2 ? 2 : -2;
    }

    let eDy = 0, pDy = 0, eHide = false, pHide = false, dive = null;
    if (e && e.type === 'hit' && e.move.anim === 'dive') {
      const lt = b.t, fromP = e.who === 'player';
      let dy = 0, hide = false;
      if (lt >= 8 && lt < 24) dy = -Math.pow((lt - 8) / 16, 2) * 220;
      else if (lt >= 24 && lt < 52) hide = true;
      if (lt >= 34 && lt < 52) dive = { fromP, p: clamp((lt - 34) / 8, 0, 1), lt };
      if (fromP) { pDy = dy; pHide = hide; } else { eDy = dy; eHide = hide; }
      if (lt >= 8 && lt < 24) {
        const [bx, by] = fromP ? [pBaseX + 24, 150] : [eBaseX + 18, 90];
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 6; i++) ctx.fillRect(bx - 22 + i * 9, by - 10 - ((lt * 7 + i * 13) % 40), 2, 14);
      }
    }

    let slashFx = null, obl = null, bowFx = null, rainFx = null;
    if (e && e.type === 'hit' && e.move.anim === 'bow') bowFx = { fromP: e.who === 'player', lt: b.t };
    if (e && e.type === 'hit' && e.move.anim === 'rain') rainFx = { fromP: e.who === 'player', lt: b.t };
    if (e && e.type === 'hit' && e.move.anim === 'slash') {
      slashFx = { fromP: e.who === 'player', lt: b.t };
      if (b.t >= 6 && b.t < 60) {
        if (slashFx.fromP) pHide = true;
        else eHide = true;
      }
    }
    if (e && e.type === 'hit' && e.move.anim === 'oblivion') {
      obl = { fromP: e.who === 'player', lt: b.t };
      const lt = b.t;
      if (lt >= 76 && lt < 92) {
        const dy = -Math.pow((lt - 76) / 16, 2) * 240;
        if (obl.fromP) pDy = dy;
        else eDy = dy;
      } else if (lt >= 92 && lt < 134) {
        if (obl.fromP) pHide = true;
        else eHide = true;
      }
    }

    let eGold = 0, pGold = 0;
    if (e && e.type === 'hit' && e.move.anim === 'midas') {
      const g = midasGold(b.t);
      const quake = b.t >= 70 && b.t < 84 ? (b.t % 2 ? 2 : -2) : 0;
      if (e.who === 'player') { eGold = g; eOff += quake; } else { pGold = g; pOff += quake; }
    }

    const transforming = e && e.type === 'transform';
    const eFainted = b.ehp === 0 && b.eHurt === 0 && !transforming;
    const pFainted = b.php === 0 && b.pHurt === 0;
    if (b.enemy.glow && !eFainted) {
      const gx = eBaseX + 18, gy = b.form2 ? 46 : 52;
      const big = b.form2 ? 1.6 : 1;
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.08 * Math.sin(tick * 0.1);
      blob(gx, gy, Math.round(40 * big), '#fff3a8');
      ctx.globalAlpha = 0.25;
      blob(gx, gy, Math.round(26 * big), '#ffffff');
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffe14d';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + tick * 0.01;
        for (let r = 30 * big; r < 48 * big; r += 2) ctx.fillRect(Math.round(gx + Math.cos(a) * r), Math.round(gy + Math.sin(a) * r), 2, 2);
      }
      ctx.restore();
    }
    if (!eFainted && !eHide && !(b.eHurt > 0 && Math.floor(b.eHurt / 3) % 2 === 0)) {
      const frames = b.form2 ? seraphFrames : b.enemy.frames;
      const sc = b.form2 ? 1.5 : 3;
      const fi = b.enemy.glow ? Math.floor(tick / 12) % 2 : b.introT % 160 < 8 ? 1 : 0;
      const img = frames[fi];
      const bob = b.form2 ? Math.round(Math.sin(tick * 0.05) * 2) + 6 : b.enemy.glow ? Math.round(Math.sin(tick * 0.06) * 3) - 8 : 0;
      const jitter = transforming && b.t < 60 ? (b.t % 4 < 2 ? 2 : -2) : 0;
      if (b.enemy.goofy) {
        const laughing = e && e.type === 'hit' && e.who === 'enemy';
        const gi = frames[laughing || tick % 90 < 20 ? 1 : 0];
        drawGoofy(gi, eBaseX + 18 + eOff, 97 + eDy, sc, -1, laughing ? 2 : 1);
        if (eGold > 0) {
          ctx.save();
          ctx.globalAlpha = eGold * 0.85;
          drawGoofy(tinted(gi, '#ffd84a'), eBaseX + 18 + eOff, 97 + eDy, sc, -1, laughing ? 2 : 1);
          ctx.restore();
        }
      } else {
        const ex = eBaseX + 18 - (img.width * sc) / 2 + eOff + jitter, ey = 94 - img.height * sc + 3 + eDy + bob;
        drawImg(img, ex, ey, -1, sc);
        if (eGold > 0) {
          ctx.save();
          ctx.globalAlpha = eGold * 0.85;
          drawImg(tinted(img, '#ffd84a'), ex, ey, -1, sc);
          ctx.restore();
        }
      }
    }
    if (transforming) {
      const lt = b.t;
      const a = lt < 60 ? lt / 60 : Math.max(0, 1 - (lt - 60) / 40);
      ctx.save();
      ctx.globalAlpha = 0.5 * a;
      ctx.fillStyle = '#fff3a8';
      ctx.fillRect(eBaseX + 18 - 6 - lt / 3, 0, 12 + (lt / 3) * 2, 100);
      ctx.globalAlpha = a * a;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      if (lt < 60) {
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2 + lt * 0.1;
          const d = 60 - lt;
          sparkle(Math.round(eBaseX + 18 + Math.cos(ang) * d), Math.round(52 + Math.sin(ang) * d * 0.6), 2, '#fff3a8');
        }
      }
    }
    if (!pFainted && !pHide && !(b.pHurt > 0 && Math.floor(b.pHurt / 3) % 2 === 0)) {
      const bob = Math.floor(b.introT / 30) % 2;
      drawImg(playerBack, pBaseX + pOff, 154 - 72 + 4 + bob + pDy, 1, 4);
      if (pGold > 0) {
        ctx.save();
        ctx.globalAlpha = pGold * 0.85;
        drawImg(tinted(playerBack, '#ffd84a'), pBaseX + pOff, 154 - 72 + 4 + bob + pDy, 1, 4);
        ctx.restore();
      }
    }

    if (dive) {
      const [tx, ty] = dive.fromP ? [eBaseX + 18, 94] : [pBaseX + 24, 154];
      const img = dive.fromP ? playerBack : b.enemy.frames[1];
      const fy = ty - img.height * 3 + 3 - (1 - dive.p) * 150;
      const sw = Math.round(8 + dive.p * 22);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(tx - sw, ty - 1, sw * 2, 3);
      if (dive.p < 1) {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 5; i++) ctx.fillRect(tx - 20 + i * 10, Math.round(fy - 34 - (i % 2) * 10), 2, 26);
      }
      drawImg(img, tx - (img.width * 3) / 2, Math.round(fy), dive.fromP ? 1 : -1, 3);
      if (dive.lt >= 42) {
        const r = (dive.lt - 42) * 7;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - (dive.lt - 42) / 10);
        ctx.fillStyle = '#ffffff';
        for (let a = 0; a < Math.PI * 2; a += 0.12) {
          ctx.fillRect(Math.round(tx + Math.cos(a) * r), Math.round(ty + Math.sin(a) * r * 0.3), 3, 2);
        }
        ctx.restore();
      }
    }
    if (slashFx) drawSwordSlash(slashFx, eBaseX, pBaseX);
    if (obl) drawOblivionStrike(obl, eBaseX, pBaseX);
    if (bowFx) drawBowShot(bowFx, eBaseX, pBaseX);
    if (rainFx) drawArrowRain(rainFx, eBaseX, pBaseX);
    if (e && e.type === 'hit' && e.move.anim === 'glove') drawGlovePunch({ fromP: e.who === 'player', lt: b.t }, eBaseX, pBaseX);
    if (e && e.type === 'hit' && e.move.anim === 'jack') drawJackBox({ fromP: e.who === 'player', lt: b.t }, eBaseX, pBaseX);
    if (e && e.type === 'hit' && e.move.anim === 'kpunch') drawRoyalPunch({ fromP: e.who === 'player', lt: b.t }, eBaseX, pBaseX);
    if (e && e.type === 'hit' && e.move.anim === 'midas') drawMidasTouch({ fromP: e.who === 'player', lt: b.t }, eBaseX, pBaseX);
    if (e && e.type === 'hit' && e.move.anim === 'throne') drawThroneDrop({ fromP: e.who === 'player', lt: b.t }, eBaseX, pBaseX);
    if (e && e.type === 'hit' && e.move.anim === 'grail') drawGrailAttack({ fromP: e.who === 'player', lt: b.t }, eBaseX, pBaseX);

    if (b.fireball) {
      const p = clamp(b.fireball.t / 22, 0, 1);
      const [sx, sy, tx, ty] = b.fireball.fromPlayer ? [100, 116, 300, 66] : [290, 66, 100, 116];
      const dir = Math.sign(tx - sx);
      const fx = sx + (tx - sx) * p;
      const fy = sy + (ty - sy) * p - Math.sin(p * Math.PI) * 24;
      const c = b.fireball.holy ? ['#e8c547', '#fff3a8', '#ffffff'] : ['#e83a30', '#ff9a2e', '#ffe14d'];
      if (b.fireball.holy) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        blob(Math.round(fx), Math.round(fy), 11, '#fff3a8');
        ctx.restore();
      }
      blob(Math.round(fx), Math.round(fy), 7, c[0]);
      blob(Math.round(fx), Math.round(fy), 5, c[1]);
      blob(Math.round(fx), Math.round(fy), 2, c[2]);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? c[1] : c[0];
        ctx.fillRect(Math.round(fx - dir * (6 + i * 4 + Math.random() * 3)), Math.round(fy - 2 + Math.random() * 4), 2, 2);
      }
      if (b.fireball.holy && b.fireball.t % 4 < 2) sparkle(Math.round(fx - dir * 10), Math.round(fy - 6), 2);
    }
    if (e && e.type === 'hit' && e.move.anim === 'gust') {
      const fromP = e.who === 'player';
      const [sx, sy, tx, ty] = fromP ? [110, 108, 300, 60] : [292, 46, 100, 112];
      const lt = b.t;
      const dx = tx - sx, dy = ty - sy, len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
      if (lt < 18) {
        const r = Math.round(4 + lt * 0.6);
        ctx.save();
        ctx.globalAlpha = 0.5;
        blob(sx, sy, r + 6, '#fff3a8');
        ctx.restore();
        blob(sx, sy, r, '#ffffff');
        ctx.fillStyle = '#fff3a8';
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + lt * 0.15;
          const d = (18 - lt) * 2 + 8;
          ctx.fillRect(Math.round(sx + Math.cos(a) * d), Math.round(sy + Math.sin(a) * d), 2, 2);
        }
      }
      if (lt >= 12 && lt < 58) {
        const k = lt < 20 ? (lt - 12) / 8 : lt < 46 ? 1 : (58 - lt) / 12;
        ctx.save();
        ctx.globalAlpha = 0.3 * k;
        ctx.fillStyle = '#fff6c0';
        ctx.beginPath();
        ctx.moveTo(sx + nx * 6, sy + ny * 6);
        ctx.lineTo(sx - nx * 6, sy - ny * 6);
        ctx.lineTo(tx - nx * 46 + ux * 20, ty - ny * 46 + uy * 20);
        ctx.lineTo(tx + nx * 46 + ux * 20, ty + ny * 46 + uy * 20);
        ctx.fill();
        ctx.restore();
        for (let i = 0; i < 50; i++) {
          const p = (lt - 12 - (i % 25) * 0.9) / 18;
          if (p <= 0 || p > 1.25) continue;
          const spread = (((i * 37) % 41) - 20) * p * 2;
          const px = sx + dx * p + nx * spread, py = sy + dy * p + ny * spread;
          ctx.fillStyle = i % 3 === 0 ? '#ffe14d' : '#ffffff';
          for (let s = 0; s < 14; s += 2) ctx.fillRect(Math.round(px - ux * s), Math.round(py - uy * s), 2, 2);
        }
      }
    }
    if (e && e.type === 'hit' && e.move.anim === 'spot') {
      const fromP = e.who === 'player';
      const [tx, ty] = fromP ? [eBaseX + 18, 94] : [pBaseX + 24, 154];
      const lt = b.t;
      if (lt >= 4 && lt < 56) {
        const dark = Math.min(1, (lt - 4) / 12);
        ctx.save();
        ctx.globalAlpha = 0.5 * dark;
        ctx.fillStyle = '#0c0a1e';
        ctx.fillRect(0, 0, W, H);
        const cw = lt < 36 ? 34 : Math.max(8, 34 - (lt - 36) * 1.4);
        ctx.globalAlpha = (lt >= 46 && tick % 4 < 2 ? 0.75 : 0.5) * dark;
        ctx.fillStyle = '#fff6c0';
        ctx.beginPath();
        ctx.moveTo(tx - 6, -4);
        ctx.lineTo(tx + 6, -4);
        ctx.lineTo(tx + cw, ty);
        ctx.lineTo(tx - cw, ty);
        ctx.fill();
        ctx.globalAlpha = 0.7 * dark;
        for (let yy = -4; yy <= 4; yy++) {
          const hw = Math.round(cw * Math.sqrt(1 - (yy * yy) / 16));
          ctx.fillRect(tx - hw, ty + yy, hw * 2, 1);
        }
        ctx.restore();
        for (let i = 0; i < 6; i++) {
          const sy = (lt * 3 + i * 31) % ty;
          sparkle(tx + Math.round(Math.sin(i * 1.7 + lt * 0.2) * (cw * sy) / ty * 0.8), sy, 1, '#ffffff');
        }
      }
      if (lt >= 52 && lt < 76) {
        const p = (lt - 52) / 24;
        const cy = ty - 30;
        ctx.save();
        ctx.globalAlpha = 1 - p;
        blob(tx, cy, Math.round(10 + p * 50), '#ffe14d');
        blob(tx, cy, Math.round(6 + p * 38), '#fff3a8');
        blob(tx, cy, Math.round(3 + p * 24), '#ffffff');
        ctx.fillStyle = '#ffffff';
        for (let a = 0; a < Math.PI * 2; a += 0.1) {
          const r = 14 + p * 70;
          ctx.fillRect(Math.round(tx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.6), 3, 3);
        }
        if (lt < 57) {
          ctx.globalAlpha = 0.8;
          ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();
      }
    }
    if (e && e.type === 'hit' && e.move.anim === 'xbeam') {
      const fromP = e.who === 'player';
      const [sx, sy, tx, ty] = fromP ? [112, 108, 300, 66] : [280, 62, 100, 116];
      const lt = b.t;
      if (lt >= 4 && lt < 26) {
        const r = Math.round(((lt - 4) / 22) * 9) + 2;
        ctx.save();
        ctx.globalAlpha = 0.35;
        blob(sx, sy, r + 7, '#ff9a2e');
        ctx.restore();
        blob(sx, sy, r + 2, '#e83a30');
        blob(sx, sy, r, '#ff9a2e');
        blob(sx, sy, Math.max(1, r - 4), '#fff3a8');
        ctx.fillStyle = '#ffe14d';
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + lt * 0.2;
          const d = (26 - lt) * 1.5 + 6;
          ctx.fillRect(Math.round(sx + Math.cos(a) * d), Math.round(sy + Math.sin(a) * d), 2, 2);
        }
      }
      if (lt >= 22 && lt < 48) {
        const k = lt < 28 ? (lt - 22) / 6 : lt < 40 ? 1 : (48 - lt) / 8;
        const reach = lt < 28 ? k : 1;
        const ex = sx + (tx - sx) * reach, ey = sy + (ty - sy) * reach;
        const flick = tick % 4 < 2 ? 1 : 0;
        ctx.save();
        ctx.lineCap = 'round';
        for (const [wd, col] of [[16, '#9a1c1a'], [12, '#e83a30'], [8, '#ff9a2e'], [4, '#fff3a8']]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = Math.max(1, (wd + flick) * Math.min(1, k + 0.2));
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (lt >= 32 && lt < 62) {
        const s = Math.min(1, (lt - 32) / 6) * 24;
        ctx.save();
        ctx.globalAlpha = lt > 52 ? (62 - lt) / 10 : 1;
        ctx.lineCap = 'square';
        for (const [wd, col] of [[9, '#9a1c1a'], [6, '#ff9a2e'], [2, '#ffffff']]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = wd;
          ctx.beginPath();
          ctx.moveTo(tx - s, ty - s);
          ctx.lineTo(tx + s, ty + s);
          ctx.moveTo(tx + s, ty - s);
          ctx.lineTo(tx - s, ty + s);
          ctx.stroke();
        }
        ctx.restore();
        if (lt >= 32 && lt < 38) {
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = '#ffd8a0';
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
        }
      }
    }
    if (b.beam) {
      const [tx, ty] = b.beam.fromPlayer ? [300, 66] : [100, 116];
      const lt = b.t - b.beam.t0;
      const grow = lt < 20 ? lt / 20 : lt < 40 ? 1 : Math.max(0, (56 - lt) / 16);
      const bw = Math.round(4 + grow * 18);
      ctx.save();
      ctx.globalAlpha = 0.35 * grow;
      ctx.fillStyle = '#fff3a8';
      ctx.fillRect(tx - bw - 6, 0, (bw + 6) * 2, ty + 30);
      ctx.globalAlpha = 0.9 * grow;
      ctx.fillStyle = '#ffe14d';
      ctx.fillRect(tx - bw, 0, bw * 2, ty + 26);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tx - Math.round(bw / 2), 0, bw, ty + 24);
      ctx.restore();
      for (let i = 0; i < 6; i++) {
        const sy = (lt * 4 + i * 29) % (ty + 24);
        sparkle(tx + Math.round(Math.sin(i * 2 + lt * 0.3) * (bw + 4)), sy, i % 2 ? 1 : 2, '#fffbe8');
      }
      if (lt >= 26 && lt < 34) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }
    if (b.leafStorm) {
      const [sx, sy, tx, ty] = b.leafStorm.fromPlayer ? [100, 116, 300, 66] : [300, 66, 100, 116];
      const lt = b.t - b.leafStorm.t0;
      const dx = tx - sx, dy = ty - sy;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len, ny = dx / len;

      if (lt > 20 && lt < 92) {
        ctx.save();
        ctx.globalAlpha = 0.14 * Math.min(1, (lt - 20) / 8) * Math.min(1, (92 - lt) / 10);
        ctx.fillStyle = '#3ccf5a';
        ctx.fillRect(-10, -10, W + 20, H + 20);
        ctx.restore();
      }

      if (lt < 26) {
        const k = lt / 24;
        ctx.save();
        ctx.globalAlpha = 0.3 * Math.min(1, k * 2);
        blob(sx, sy - 6, 14 + k * 10, '#7ee06a');
        ctx.globalAlpha = 0.5 * Math.min(1, k * 2);
        blob(sx, sy - 6, 6 + k * 6, '#c8ff9a');
        ctx.restore();
        for (let i = 0; i < 40; i++) {
          const a = i * 2.4 + lt * 0.28;
          const r = 52 * (1 - k) + 8 + (i % 5) * 2;
          drawLeaf(sx + Math.cos(a) * r, sy - 6 + Math.sin(a) * r * 0.6, i + lt * 0.5, i);
        }
      }

      if (lt > 18 && lt < 62) {
        ctx.save();
        for (let w = 0; w < 7; w++) {
          const p0 = clamp((lt - 20 - w * 2) / 18, 0, 1);
          const p1 = clamp((lt - 14 - w * 2) / 18, 0, 1);
          if (p1 <= p0) continue;
          const off = (w - 3) * 6;
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = w % 2 ? '#bff79a' : '#5cc84a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx + dx * p0 + nx * off, sy + dy * p0 + ny * off);
          ctx.lineTo(sx + dx * p1 + nx * off, sy + dy * p1 + ny * off);
          ctx.stroke();
        }
        ctx.restore();
        for (let i = 0; i < 80; i++) {
          const p = (lt - 20 - (i / 80) * 24) / 16;
          if (p <= 0 || p >= 1) continue;
          const helix = Math.sin(p * Math.PI * 4 + (i % 2) * Math.PI + i * 0.15) * (10 + (i % 4) * 4) * Math.sin(p * Math.PI + 0.3);
          const jitter = Math.cos(i * 1.7 + lt * 0.4) * 4;
          drawLeaf(sx + dx * p + nx * (helix + jitter), sy + dy * p + ny * (helix + jitter), i + lt * 0.6, i);
        }
      }

      if (lt > 48 && lt < 96) {
        const fadeOut = lt > 84 ? 1 - (lt - 84) / 12 : 1;
        const grow = Math.min(1, (lt - 48) / 8);
        ctx.save();
        ctx.strokeStyle = '#a8f070';
        ctx.lineWidth = 1;
        for (let r = 0; r < 6; r++) {
          const hy = ty + 22 - r * 10;
          const rw = (16 + r * 5) * grow;
          ctx.globalAlpha = 0.35 * fadeOut;
          ctx.beginPath();
          ctx.ellipse(tx + Math.sin(lt * 0.3 + r) * 3, hy, rw, rw * 0.28, 0, (lt * 0.4 + r) % (Math.PI * 2), ((lt * 0.4 + r) % (Math.PI * 2)) + Math.PI * 1.3);
          ctx.stroke();
        }
        ctx.restore();
        const count = Math.floor(60 * fadeOut);
        for (let i = 0; i < count; i++) {
          const rise = (i * 7 + (lt - 48) * 1.8) % 60;
          const a = i * 0.9 + lt * (0.3 + (i % 3) * 0.06);
          const rx = (14 + rise * 0.5 + (i % 4) * 3) * grow;
          drawLeaf(tx + Math.cos(a) * rx, ty + 24 - rise + Math.sin(a) * rx * 0.28, i + lt * 0.7, i);
        }
      }
    }
    for (const p of b.fx) {
      ctx.globalAlpha = clamp(p.life / 12, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    drawPanel(14, 22, 160, 34);
    drawText(b.enemy.name, 22, 28, 8, '#3b2a1a', 'left', null);
    drawText('HP', 22, 43, 8, '#c08020', 'left', null);
    drawHpBar(44, 44, 120, b.eDisp, b.enemy.hp);
    if (hasSwap()) {
      const r = SWAP_BTN;
      const live = b.phase === 'choose';
      const on = live && b.sel === -1;
      ctx.fillStyle = '#1c140c';
      ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
      ctx.fillStyle = on ? '#5a3fb0' : live ? '#7a5cd0' : '#5e5a72';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(r.x, r.y, r.w, 1);
      drawText('SWAP Q', r.x + r.w / 2, r.y + 4, 8, on ? '#ffe14d' : '#ffffff', 'center', null);
    }

    drawPanel(208, 112, 164, 40);
    drawText(playerName, 216, 118, 8, '#3b2a1a', 'left', null);
    drawText('HP', 216, 131, 8, '#c08020', 'left', null);
    drawHpBar(238, 132, 126, b.pDisp, b.pmax);
    drawText(`${Math.ceil(b.pDisp)}/${b.pmax}`, 364, 142, 8, '#3b2a1a', 'right', null);

    drawPanel(6, 164, W - 12, 46);
    if (inMenu()) {
      const swapping = b.phase === 'swap';
      drawText(swapping ? 'SWAP TO' : 'WHAT WILL', 16, 174, 8, '#3b2a1a', 'left', null);
      drawText(swapping ? 'WHICH GEM?' : 'YOU DO?', 16, 188, 8, '#3b2a1a', 'left', null);
      ctx.fillStyle = '#1c140c';
      ctx.fillRect(100, 166, 2, 42);
      const items = menuItems();
      if (swapping) {
        const P = SWAP_PANEL;
        drawPanel(P.x, P.y, P.w, P.h);
        drawText('SWAP TO WHICH GEM?', P.x + P.w / 2, P.y + 8, 8, '#5a3fb0', 'center', null);
        items.forEach((it, i) => {
          const r = slotRect(i);
          const selected = b.sel === i;
          ctx.fillStyle = selected ? '#5a3fb0' : '#c9ae74';
          ctx.fillRect(r.x, r.y, r.w, r.h);
          let tx = r.x + 6;
          if (it.gem) {
            const img = ITEM_SPRITES[it.gem];
            drawImg(img, r.x + 4, r.y + (r.h - img.height) / 2, 1);
            tx = r.x + 6 + img.width;
          }
          drawText(it.name, tx, r.y + 3, 8, selected ? '#ffe14d' : '#3b2a1a', 'left', null);
          if (it.gem && it.gem === inv.equipped) {
            ctx.fillStyle = '#2f6fdc';
            ctx.fillRect(r.x + r.w - 11, r.y + 2, 9, 10);
            drawText('E', r.x + r.w - 10, r.y + 3, 8, '#ffffff', 'left', null);
          }
        });
      }
      for (let i = 0; i < 4 && !swapping; i++) {
        const r = slotRect(i);
        const move = items[i];
        if (move) {
          const selected = b.sel === i;
          ctx.fillStyle = selected ? (move.swap || swapping ? '#5a3fb0' : '#9a1c1a') : '#c9ae74';
          ctx.fillRect(r.x, r.y, r.w, r.h);
          const fs = fitSize(move.name, r.w - 16);
          drawText(move.name, r.x + 12, r.y + 4 + Math.floor((8 - fs) / 2), fs, selected ? '#ffe14d' : '#3b2a1a', 'left', null);
          if (selected && tick % 40 < 28) {
            ctx.fillStyle = '#ffe14d';
            ctx.fillRect(r.x + 3, r.y + 4, 2, 7);
            ctx.fillRect(r.x + 5, r.y + 5, 2, 5);
            ctx.fillRect(r.x + 7, r.y + 6, 1, 3);
          }
        } else {
          drawText('-', r.x + 12, r.y + 4, 8, '#a08a5a', 'left', null);
        }
      }
    } else if (e && e.type === 'msg') {
      drawText(e.text.slice(0, b.chars), 16, 180, 8, '#3b2a1a', 'left', null);
    } else if (b.lastMsg) {
      drawText(b.lastMsg, 16, 180, 8, '#3b2a1a', 'left', null);
    }
    if (e && e.type === 'msg') b.lastMsg = e.text;
    if (obl && obl.lt < 78) drawOblivionCutscene(obl);
    if (rainFx && rainFx.lt < 72) drawRainCutscene(rainFx);
    if (b.cards) drawCardScene(b);
    if (e && e.type === 'hit' && e.move.anim === 'grail') drawGrailCutscene({ fromP: e.who === 'player', lt: b.t });
  }

  function drawGoofy(img, cx, bottom, sc, face, energy = 1) {
    const hop = Math.abs(Math.sin(tick * 0.12 * energy)) * 10 * energy;
    const rot = Math.sin(tick * 0.24 * energy) * 0.2;
    const squash = 1 + Math.max(0, 0.25 - hop / 20) * (hop < 2 ? 1 : 0);
    const w = img.width * sc, h = img.height * sc;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(Math.round(cx - w / 3 + hop), Math.round(bottom - 2), Math.round((w * 2) / 3 - hop * 2), 3);
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(bottom - hop));
    ctx.rotate(rot);
    ctx.scale(face * squash, 1 / squash);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  function drawStars(x, y, n, t) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t * 0.15;
      const r = 10 + Math.sin(t * 0.3 + i) * 3;
      sparkle(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.5), 2, i % 2 ? '#ffe14d' : '#ffffff');
    }
  }

  function drawComic(text, x, y, t, col) {
    const s = t < 4 ? 8 + (4 - t) * 3 : 8;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(Math.sin(t * 0.5) * 0.15);
    drawText(text, 0, -s / 2, s, col, 'center', '#1a1420');
    ctx.restore();
  }

  function drawSpring(x0, y0, x1, y1, coils, amp) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    ctx.save();
    ctx.strokeStyle = '#1a1420';
    ctx.lineWidth = 3;
    for (const [col, lw] of [['#1a1420', 3], ['#c8c8d8', 1.5]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (let i = 0; i <= coils * 8; i++) {
        const p = i / (coils * 8);
        const o = Math.sin(p * coils * Math.PI * 2) * amp;
        const px = x0 + dx * p + nx * o, py = y0 + dy * p + ny * o;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGlove(x, y, dir) {
    blob(Math.round(x), Math.round(y), 7, '#1a1420');
    blob(Math.round(x), Math.round(y), 6, '#e83a30');
    ctx.fillStyle = '#ff8a7a';
    ctx.fillRect(Math.round(x - 3), Math.round(y - 4), 3, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(x - dir * 8), Math.round(y - 3), 3, 6);
  }

  function drawGlovePunch({ fromP, lt }, eBaseX, pBaseX) {
    const [sx, sy, tx, ty] = fromP ? [112, 108, eBaseX + 6, 62] : [eBaseX + 4, 66, pBaseX + 44, 112];
    const dir = Math.sign(tx - sx);
    let p;
    if (lt < 6) p = -lt / 30;
    else if (lt < 16) p = (lt - 6) / 10;
    else if (lt < 26) p = 1 - Math.sin(((lt - 16) / 10) * Math.PI * 3) * 0.08 * (1 - (lt - 16) / 10);
    else p = Math.max(0, 1 - (lt - 26) / 12);
    const gx = sx + (tx - sx) * p, gy = sy + (ty - sy) * p;
    if (p > 0.02) drawSpring(sx, sy, gx - dir * 6, gy, 5, 4);
    drawGlove(gx, gy, dir);
    if (lt >= 16 && lt < 34) {
      drawComic('BONK!', tx, ty - 26, lt - 16, '#ffe14d');
      drawStars(tx, ty - 10, 5, lt);
    }
  }

  function drawJackBox({ fromP, lt }, eBaseX, pBaseX) {
    const [bx, groundY, tx, ty] = fromP ? [eBaseX - 34, 94, eBaseX + 18, 50] : [pBaseX + 96, 154, pBaseX + 30, 100];
    let by = groundY, sqx = 1, rot = 0;
    if (lt < 14) {
      by = groundY - (1 - lt / 14) * 180;
      rot = lt * 0.5;
    } else if (lt < 22) {
      const k = (lt - 14) / 8;
      sqx = 1 + Math.sin(k * Math.PI) * 0.35;
    }
    const shakeAmp = lt >= 18 && lt < 52 ? (lt - 18) / 34 * 3 : 0;
    const jx = shakeAmp ? (tick % 2 ? shakeAmp : -shakeAmp) : 0;
    const S = 24;
    ctx.save();
    ctx.translate(Math.round(bx + jx), Math.round(by));
    ctx.rotate(lt < 14 ? rot : Math.sin(lt * 0.8) * shakeAmp * 0.03);
    ctx.scale(sqx, 1 / sqx);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(-S / 2 - 1, -S - 1, S + 2, S + 2);
    for (let yy = 0; yy < 4; yy++) {
      for (let xx = 0; xx < 4; xx++) {
        ctx.fillStyle = (xx + yy) % 2 ? '#d8322e' : '#ffe14d';
        ctx.fillRect(-S / 2 + xx * 6, -S + yy * 6, 6, 6);
      }
    }
    ctx.fillStyle = '#7a3fc8';
    ctx.fillRect(-4, -S + 8, 8, 8);
    drawText('?', 0, -S + 8, 8, '#ffffff', 'center', null);
    const crankA = lt >= 18 && lt < 52 ? lt * 0.6 : 0;
    ctx.fillStyle = '#c8c8d8';
    ctx.fillRect(S / 2, -S / 2 - 1, 5, 2);
    ctx.fillRect(Math.round(S / 2 + 4 + Math.cos(crankA) * 4) - 1, Math.round(-S / 2 + Math.sin(crankA) * 4) - 1, 3, 3);
    if (lt < 50) {
      ctx.fillStyle = '#5b2a86';
      ctx.fillRect(-S / 2 - 2, -S - 4, S + 4, 4);
    } else {
      ctx.save();
      ctx.translate(-S / 2 - 2, -S);
      ctx.rotate(-Math.min(1.9, (lt - 50) * 0.5));
      ctx.fillStyle = '#5b2a86';
      ctx.fillRect(0, -4, S + 4, 4);
      ctx.restore();
    }
    ctx.restore();
    if (lt >= 18 && lt < 52) {
      for (let i = 0; i < 3; i++) {
        const nt = (lt - 18 + i * 11) % 33;
        const nx = bx + 10 + nt * 0.8 + Math.sin(nt * 0.4) * 4, ny = by - S - 6 - nt * 1.2;
        ctx.fillStyle = ['#ff3e6c', '#3ec8ff', '#7ed860'][i];
        ctx.fillRect(Math.round(nx), Math.round(ny), 3, 3);
        ctx.fillRect(Math.round(nx + 2), Math.round(ny - 7), 1, 7);
        ctx.fillRect(Math.round(nx + 2), Math.round(ny - 7), 3, 1);
      }
    }
    if (lt >= 50) {
      const topX = bx, topY = by - S - 2;
      let hx, hy;
      if (lt < 54) {
        const k = (lt - 50) / 4;
        hx = topX;
        hy = topY - k * 50;
      } else if (lt < 58) {
        const k = (lt - 54) / 4;
        hx = topX + (tx - topX) * k;
        hy = topY - 50 + (ty - topY + 50) * k;
      } else {
        const k = Math.min(1, (lt - 58) / 30);
        const wob = Math.sin((lt - 58) * 0.7) * 14 * (1 - k);
        hx = tx + (topX - tx) * k * 0.6 + wob;
        hy = ty + (topY - 34 - ty) * k * 0.6;
      }
      drawSpring(topX, topY, hx, hy + 8, 6, 5);
      const hs = 2;
      const img = jokerFrames[1];
      ctx.save();
      ctx.translate(Math.round(hx), Math.round(hy));
      ctx.rotate(Math.sin(lt * 0.5) * 0.3);
      ctx.beginPath();
      ctx.rect(-img.width * hs / 2, -12 * hs, img.width * hs, 12 * hs);
      ctx.clip();
      ctx.drawImage(img, -img.width * hs / 2, -12 * hs, img.width * hs, img.height * hs);
      ctx.restore();
      if (lt >= 57 && lt < 80) {
        drawComic('POP!', tx, ty - 36, lt - 57, '#ff3e6c');
        drawStars(tx, ty - 6, 6, lt);
      }
      if (lt >= 60 && lt < 90 && lt % 10 < 6) drawComic('HONK!', bx + 30, by - 60, 6, '#ffe14d');
    }
  }

  function drawCard(x, y, w, h, flip, face, raised, glow) {
    const sx = Math.abs(Math.cos(flip * Math.PI));
    const showFace = flip > 0.5;
    const cx = x + w / 2;
    const yy = y - raised;
    ctx.save();
    if (glow) {
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(tick * 0.3);
      blob(Math.round(cx), Math.round(yy + h / 2), Math.round(w * 0.75), '#ffe14d');
      ctx.globalAlpha = 1;
    }
    ctx.translate(cx, 0);
    ctx.scale(Math.max(0.05, sx), 1);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(-w / 2 - 1, yy - 1, w + 2, h + 2);
    if (!showFace) {
      ctx.fillStyle = '#c2202e';
      ctx.fillRect(-w / 2, yy, w, h);
      ctx.fillStyle = '#e8c547';
      ctx.fillRect(-w / 2 + 2, yy + 2, w - 4, 1);
      ctx.fillRect(-w / 2 + 2, yy + h - 3, w - 4, 1);
      ctx.fillRect(-w / 2 + 2, yy + 2, 1, h - 4);
      ctx.fillRect(w / 2 - 3, yy + 2, 1, h - 4);
      ctx.fillStyle = '#8a1420';
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 7; j++) if ((i + j) % 2) ctx.fillRect(-w / 2 + 5 + i * 8, yy + 5 + j * 8, 4, 4);
      }
      drawText('?', 0, yy + h / 2 - 8, 16, '#ffe14d', 'center', '#1a1420');
    } else {
      ctx.fillStyle = '#fffaea';
      ctx.fillRect(-w / 2, yy, w, h);
      if (face === 'safe') {
        drawText('J', -w / 2 + 3, yy + 3, 8, '#7a3fc8', 'left', null);
        ctx.drawImage(jokerFrames[1], -14, yy + 10, 28, 44);
        drawText('SAFE', 0, yy + h - 11, 8, '#2e9a3a', 'center', null);
      } else {
        drawText('6', -w / 2 + 3, yy + 3, 8, '#c2202e', 'left', null);
        blob(0, Math.round(yy + h / 2 + 2), 11, '#1a1420');
        ctx.fillStyle = '#3a364f';
        ctx.fillRect(-3, Math.round(yy + h / 2 - 12), 6, 5);
        ctx.fillStyle = tick % 4 < 2 ? '#ffe14d' : '#ff9a2e';
        ctx.fillRect(1, Math.round(yy + h / 2 - 17), 3, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-5, Math.round(yy + h / 2 - 3), 3, 3);
        drawText('BOOM', 0, yy + h - 11, 8, '#c2202e', 'center', null);
      }
    }
    ctx.restore();
  }

  function drawCardScene(b) {
    const c = b.cards;
    const t = c.t;
    const intro = c.state === 'intro';
    const k = intro ? clamp(t / 18, 0, 1) : c.state === 'reveal' && t > 76 ? clamp((90 - t) / 14, 0, 1) : 1;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = '#2a1040';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 16) {
      for (let x = (y / 16) % 2 ? 8 : 0; x < W; x += 16) {
        ctx.fillStyle = '#3a1858';
        ctx.beginPath();
        ctx.moveTo(x + 8, y);
        ctx.lineTo(x + 16, y + 8);
        ctx.lineTo(x + 8, y + 16);
        ctx.lineTo(x, y + 8);
        ctx.fill();
      }
    }
    ctx.globalAlpha = k * 0.12;
    ctx.fillStyle = '#fff3a8';
    for (const sx of [80, 192, 304]) {
      ctx.beginPath();
      ctx.moveTo(sx - 8, 0);
      ctx.lineTo(sx + 8, 0);
      ctx.lineTo(sx + 50, H);
      ctx.lineTo(sx - 50, H);
      ctx.fill();
    }
    ctx.globalAlpha = k;
    ctx.fillStyle = '#1e5a2e';
    ctx.fillRect(20, 70, W - 40, 96);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(20, 70, W - 40, 2);
    ctx.fillRect(20, 164, W - 40, 2);

    const jy = 6 + Math.abs(Math.sin(tick * 0.15)) * 6;
    ctx.save();
    ctx.translate(W / 2, Math.round(jy + 44));
    ctx.rotate(Math.sin(tick * 0.2) * 0.25);
    ctx.drawImage(jokerFrames[tick % 30 < 15 ? 1 : 0], -21, -44, 42, 66);
    ctx.restore();
    if (tick % 40 < 30) {
      drawComic('HA', W / 2 - 44, 26 + Math.sin(tick * 0.2) * 4, 6, '#ffe14d');
      drawComic('HA!', W / 2 + 48, 34 + Math.cos(tick * 0.2) * 4, 6, '#ff3e6c');
    }

    const jokerEyes = inv.equipped === 'jokerCrystal';
    for (let i = 0; i < 5; i++) {
      const r = cardRect(i);
      let x = r.x, y = r.y, flip = 0, raised = 0;
      if (intro) {
        const ap = clamp((t - 18 - i * 4) / 12, 0, 1);
        x = W / 2 - r.w / 2 + (r.x - (W / 2 - r.w / 2)) * ap;
        y = 40 + (r.y - 40) * ap;
        if (t >= 30) {
          const sh = Math.sin((t - 30) * 0.25 + i * 1.3);
          x += sh * 40 * Math.min(1, (92 - t) / 20);
          y += Math.cos((t - 30) * 0.3 + i) * 6 * Math.min(1, (92 - t) / 20);
        }
        if (ap <= 0) continue;
      }
      const picked = c.state === 'reveal' && i === c.pick;
      if (c.state === 'pick' && i === c.sel) raised = 8 + Math.sin(tick * 0.2) * 2;
      if (picked) {
        raised = 10;
        flip = clamp(t / 12, 0, 1);
      } else if (c.state === 'reveal' && t >= 40) {
        flip = clamp((t - 40 - i * 2) / 10, 0, 1);
      }
      if (jokerEyes && !intro) flip = c.state === 'pick' ? clamp((t - i * 3) / 12, 0, 1) : 1;
      drawCard(x, y, r.w, r.h, flip, c.safe.includes(i) ? 'safe' : 'bomb', raised, (c.state === 'pick' && i === c.sel) || picked);
    }
    if (c.state === 'pick') {
      const r = cardRect(c.sel);
      const ay = r.y - 22 + Math.sin(tick * 0.25) * 3;
      ctx.fillStyle = '#ffe14d';
      for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(r.x + r.w / 2 - 4 + i), Math.round(ay + i), 8 - i * 2, 1);
      if (c.foe) {
        drawText(`${b.enemy.name} IS PICKING A CARD...`, W / 2, 186, 8, '#ffffff', 'center');
      } else if (jokerEyes) {
        drawText('JOKER EYES: YOU CAN SEE THE CARDS!', W / 2, 186, 8, '#ffe14d', 'center');
        drawText('< > TO CHOOSE, ENTER TO PICK', W / 2, 200, 8, '#b07cff', 'center');
      } else {
        drawText('PICK A CARD! TWO ARE SAFE...', W / 2, 186, 8, '#ffffff', 'center');
        drawText('< > TO CHOOSE, ENTER TO PICK', W / 2, 200, 8, '#b07cff', 'center');
      }
    }
    if (c.state === 'reveal' && t >= 14 && t < 40) {
      const r = cardRect(c.pick);
      const safe = c.safe.includes(c.pick);
      if (!safe && t < 30) {
        ctx.save();
        ctx.globalAlpha = 1 - (t - 14) / 16;
        blob(r.x + r.w / 2, r.y + r.h / 2, 20 + (t - 14) * 4, '#ff9a2e');
        blob(r.x + r.w / 2, r.y + r.h / 2, 10 + (t - 14) * 3, '#ffe14d');
        ctx.restore();
        if (t < 17) {
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillRect(0, 0, W, H);
        }
      }
      drawComic(safe ? 'PHEW! SAFE!' : 'KA-BOOM! -6', W / 2, 180, t - 14, safe ? '#7ed860' : '#ff3e6c');
      if (safe) drawStars(r.x + r.w / 2, r.y + 10, 8, t);
    }
    if (intro && t < 18) {
      ctx.globalAlpha = 1;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + t * 0.3;
        const rr = (18 - t) * 14;
        ctx.fillStyle = i % 2 ? '#7a3fc8' : '#d8322e';
        ctx.fillRect(Math.round(W / 2 + Math.cos(a) * rr - 6), Math.round(H / 2 + Math.sin(a) * rr - 6), 12, 12);
      }
    }
    ctx.restore();
  }

  const tintCache = new Map();
  function tinted(img, color) {
    let m = tintCache.get(img);
    if (!m) tintCache.set(img, (m = {}));
    if (!m[color]) {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = color;
      g.fillRect(0, 0, c.width, c.height);
      m[color] = c;
    }
    return m[color];
  }

  function midasGold(lt) {
    if (lt < 32) return 0;
    if (lt < 80) return (lt - 32) / 48;
    if (lt < 84) return 1;
    return Math.max(0, 1 - (lt - 84) / 16);
  }

  function drawGauntlet(x, y, dir, s = 1, glow = false) {
    if (glow) {
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.2 * Math.sin(tick * 0.5);
      blob(Math.round(x), Math.round(y), Math.round(14 * s), '#fff3a8');
      ctx.restore();
    }
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(dir * s, s);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(-15, -8, 25, 16);
    ctx.fillStyle = '#7a1520';
    ctx.fillRect(-14, -6, 6, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-9, -7, 3, 14);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(-6, -7, 15, 14);
    ctx.fillStyle = '#b8901a';
    ctx.fillRect(-6, 3, 15, 4);
    ctx.fillStyle = '#fff3a8';
    ctx.fillRect(-4, -6, 10, 2);
    ctx.fillStyle = '#1a1420';
    for (let i = 0; i < 3; i++) ctx.fillRect(4, -4 + i * 4, 5, 1);
    ctx.fillStyle = '#c2202e';
    ctx.fillRect(-2, -2, 3, 3);
    ctx.restore();
  }

  function drawRoyalPunch({ fromP, lt }, eBaseX, pBaseX) {
    const [sx, sy, tx, ty, dir] = fromP ? [pBaseX + 44, 112, eBaseX + 6, 62, 1] : [eBaseX - 8, 66, pBaseX + 38, 116, -1];
    let p;
    if (lt < 14) p = lt / 14;
    else if (lt < 22) p = 1;
    else p = Math.max(0, 1 - (lt - 22) / 14);
    if (p <= 0) return;
    const x = sx + (tx - sx) * p, y = sy + (ty - sy) * p;
    if (lt < 14) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(x - dir * (16 + i * 7)), Math.round(y - 6 + i * 4), 8, 1);
    }
    drawGauntlet(x, y, dir, 1.3);
    if (lt >= 14 && lt < 24) {
      drawStars(tx, ty - 10, 6, lt);
      drawComic('BONK!', tx, ty - 34, lt - 14, '#ffe14d');
    }
  }

  function drawMidasTouch({ fromP, lt }, eBaseX, pBaseX) {
    const [sx, sy, tx, ty, dir] = fromP ? [pBaseX + 44, 112, eBaseX + 6, 62, 1] : [eBaseX - 8, 66, pBaseX + 38, 116, -1];
    const [cx, cy] = fromP ? [eBaseX + 18, 66] : [pBaseX + 24, 118];
    if (lt < 24) {
      const k = lt / 24;
      ctx.save();
      ctx.globalAlpha = 0.3 + k * 0.4;
      blob(sx, sy, Math.round(4 + k * 12), '#ffe14d');
      ctx.restore();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + lt * 0.2;
        const d = (24 - lt) * 1.6 + 4;
        sparkle(Math.round(sx + Math.cos(a) * d), Math.round(sy + Math.sin(a) * d), 1, '#fff3a8');
      }
      drawGauntlet(sx, sy, dir, 1.2, true);
    } else if (lt < 46) {
      const p = lt < 32 ? (lt - 24) / 8 : 1 - (lt - 36) / 10;
      const k = clamp(p, 0, 1);
      if (k > 0) drawGauntlet(sx + (tx - sx) * k, sy + (ty - sy) * k, dir, 1.3, true);
      if (lt >= 32 && lt < 42) drawComic('TOUCH!', tx, ty - 34, lt - 32, '#ffe14d');
    }
    if (lt >= 32 && lt < 84) {
      for (let i = 0; i < 6; i++) {
        const ph = (lt * 2 + i * 23) % 40;
        sparkle(Math.round(cx - 20 + ((i * 37) % 40)), Math.round(cy + 30 - ph * 1.6), ph < 20 ? 1 : 2, '#fff3a8');
      }
      if (lt >= 50 && lt % 8 < 5) drawText('GOLD!', cx, cy - 56, 8, '#ffe14d', 'center', '#1a1420');
    }
    if (lt >= 84 && lt < 106) {
      const d = lt - 84;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - d / 22);
      blob(cx, cy, 10 + d * 3, '#ff9a2e');
      blob(cx, cy, 6 + d * 2, '#ffe14d');
      blob(cx, cy, Math.max(1, d), '#ffffff');
      ctx.restore();
      if (d < 3) {
        ctx.fillStyle = 'rgba(255,240,180,0.7)';
        ctx.fillRect(0, 0, W, H);
      }
      drawComic('KA-BLING!', cx, cy - 52, d, '#ffe14d');
    }
  }

  function drawBigThrone(cx, bottom, sq = 1) {
    const R = (x, y, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
    };
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(bottom));
    ctx.scale(sq, 1 / sq);
    R(-20, -68, 40, 46, '#1a1420');
    R(-19, -67, 38, 44, '#e8c547');
    R(-15, -63, 30, 38, '#5b2a86');
    R(-13, -61, 4, 34, '#7a3fc8');
    R(-6, -56, 12, 6, '#e8c547');
    R(-6, -59, 2, 3, '#e8c547');
    R(-1, -61, 2, 5, '#e8c547');
    R(4, -59, 2, 3, '#e8c547');
    for (const px of [-26, 18]) {
      R(px, -76, 8, 76, '#1a1420');
      R(px + 1, -75, 6, 74, '#e8c547');
      R(px + 1, -75, 2, 74, '#fff3a8');
      R(px + 1, -82, 6, 6, '#1a1420');
      R(px + 2, -81, 4, 4, '#3ec8ff');
    }
    R(-26, -27, 52, 9, '#1a1420');
    R(-25, -26, 50, 7, '#e8c547');
    R(-22, -31, 44, 5, '#c2202e');
    R(-22, -31, 44, 1, '#e8505a');
    R(-25, -20, 50, 1, '#b8901a');
    ctx.restore();
  }

  function drawThroneDrop({ fromP, lt }, eBaseX, pBaseX) {
    const [sx, sy] = fromP ? [pBaseX + 24, 84] : [eBaseX + 18, 36];
    const [tx, groundY] = fromP ? [eBaseX + 18, 96] : [pBaseX + 24, 158];
    if (lt < 26) {
      for (let i = 0; i < 5; i++) {
        const ph = (lt * 3 + i * 13) % 30;
        sparkle(Math.round(sx - 10 + i * 5), Math.round(sy - ph), 1, '#ffe14d');
      }
      if (lt > 6) drawComic('!', sx + 16, sy - 20, lt - 6, '#ffe14d');
    }
    if (lt >= 24 && lt < 58) {
      const k = (lt - 24) / 34;
      ctx.fillStyle = `rgba(0,0,0,${0.15 + k * 0.3})`;
      const sw = Math.round(8 + k * 26);
      ctx.fillRect(tx - sw, groundY - 2, sw * 2, 4);
    }
    let alpha = 1;
    if (lt >= 80) alpha = Math.max(0, 1 - (lt - 80) / 16);
    if (lt >= 42) {
      const p = clamp((lt - 42) / 16, 0, 1);
      const y = groundY - (1 - p * p) * 260;
      const sq = lt >= 58 && lt < 66 ? 1 + Math.sin(((lt - 58) / 8) * Math.PI) * 0.25 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      drawBigThrone(tx, y, sq);
      ctx.restore();
      if (p < 1) {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 4; i++) ctx.fillRect(tx - 24 + i * 16, Math.round(y - 110 - (i % 2) * 14), 2, 28);
      }
    }
    if (lt >= 58 && lt < 76) {
      const d = lt - 58;
      ctx.save();
      ctx.globalAlpha = 1 - d / 18;
      ctx.fillStyle = '#e8dcc0';
      for (let a = 0; a < Math.PI * 2; a += 0.15) {
        ctx.fillRect(Math.round(tx + Math.cos(a) * d * 4), Math.round(groundY + Math.sin(a) * d * 1.2), 3, 2);
      }
      ctx.restore();
      drawComic('CRASH!', tx, groundY - 104, d, '#ff3e6c');
    }
  }

  function drawMiniBox(x, y, rot, S = 14) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(rot);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(-S / 2 - 1, -S / 2 - 1, S + 2, S + 2);
    const c = S / 2;
    for (let yy = 0; yy < 2; yy++) {
      for (let xx = 0; xx < 2; xx++) {
        ctx.fillStyle = (xx + yy) % 2 ? '#d8322e' : '#ffe14d';
        ctx.fillRect(-S / 2 + xx * c, -S / 2 + yy * c, c, c);
      }
    }
    ctx.fillStyle = '#7a3fc8';
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  }

  function drawGrailCup(x, y, glow) {
    if (glow > 0) {
      ctx.save();
      ctx.globalAlpha = glow * (0.35 + 0.15 * Math.sin(tick * 0.3));
      blob(Math.round(x), Math.round(y - 6), 20, '#fff3a8');
      ctx.restore();
    }
    const R = (dx, dy, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x + dx), Math.round(y + dy), w, h);
    };
    R(-8, -16, 16, 10, '#1a1420');
    R(-7, -15, 14, 8, '#e8c547');
    R(-7, -15, 3, 8, '#fff3a8');
    R(-3, -12, 2, 2, '#c2202e');
    R(2, -12, 2, 2, '#3ec8ff');
    R(-2, -7, 4, 5, '#1a1420');
    R(-1, -7, 2, 5, '#b8901a');
    R(-6, -2, 12, 3, '#1a1420');
    R(-5, -2, 10, 2, '#e8c547');
  }

  function drawGrailAttack({ fromP, lt }, eBaseX, pBaseX) {
    const [kx, ky] = fromP ? [pBaseX + 40, 88] : [eBaseX + 26, 40];
    if (lt < 40) {
      const rise = clamp(lt / 20, 0, 1);
      drawGrailCup(kx, ky - rise * 18, rise);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + lt * 0.15;
        sparkle(Math.round(kx + Math.cos(a) * 16), Math.round(ky - 24 + Math.sin(a) * 8), 1, '#fff3a8');
      }
    }
    const [tx, ty] = fromP ? [eBaseX + 18, 62] : [pBaseX + 24, 118];
    const side = fromP ? -1 : 1;
    GRAIL_SEGS.forEach((s, i) => {
      const d = lt - s;
      if (d < 38 || d > 64) return;
      const p = clamp((d - 38) / 14, 0, 1);
      if (i === 0 && d < 52) {
        const sx = W / 2 + side * (W / 2 + 20), sy = fromP ? 120 : 40;
        const x = sx + (tx - sx) * p, y = sy + (ty - sy) * p;
        const ang = Math.atan2(ty - sy, tx - sx);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx + (tx - sx) * Math.max(0, p - 0.4), sy + (ty - sy) * Math.max(0, p - 0.4));
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.restore();
        drawArrow(x, y, ang, 14, false);
      } else if (i === 1 && d < 52) {
        const sx = W / 2 + side * (W / 2 + 20), sy = 20;
        const x = sx + (tx - sx) * p, y = sy + (ty - sy) * p - Math.sin(p * Math.PI) * 50;
        drawMiniBox(x, y, d * 0.5);
      } else if (i === 2 && d < 56) {
        const sx = W / 2 + side * (W / 2 + 40), sy = -40;
        const x = sx + (tx - sx) * p, y = sy + (ty - sy) * p;
        const img = knightShine;
        drawImg(img, x - (img.width * 3) / 2, y - img.height * 3 + 20, fromP ? 1 : -1, 3);
        ctx.fillStyle = '#7fdcff';
        for (let k = 0; k < 4; k++) ctx.fillRect(Math.round(x + side * (20 + k * 10)), Math.round(y - 50 + k * 8), 10, 1);
      }
      if (d >= 52) {
        const dd = d - 52;
        if (i === 2) drawSlashArc(tx, ty - 20, fromP ? 0 : Math.PI, dd);
        else {
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - dd / 10);
          blob(tx, ty, 6 + dd * 2, i === 0 ? '#ffffff' : '#ff3e6c');
          ctx.restore();
        }
        drawComic(['THWIP!', 'BONK!', 'SWOOP!'][i], tx, ty - 46, dd, ['#ffffff', '#ffe14d', '#7fdcff'][i]);
      }
    });
  }

  function drawGrailCutscene({ fromP, lt }) {
    GRAIL_SEGS.forEach((s, i) => {
      const d = lt - s;
      if (d < 0 || d >= 38) return;
      const k = Math.min(clamp(d / 4, 0, 1), clamp((38 - d) / 4, 0, 1));
      const face = fromP ? 1 : -1;
      ctx.save();
      ctx.globalAlpha = k;
      ctx.fillStyle = ['#0e2a12', '#2a1040', '#141a2a'][i];
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = ['#1e4a24', '#4a1a68', '#2a3450'][i];
      for (let j = 0; j < 16; j++) {
        const sx = ((j * 61 + d * 14) % (W + 60)) - 30;
        ctx.fillRect(fromP ? sx : W - sx, 30 + ((j * 37) % 150), 40, 2);
      }
      const sc = 5;
      const cx = W / 2 - face * 40;
      if (i === 0) {
        const img = archerFrames[0];
        drawImg(img, cx - (img.width * sc) / 2, 112 - (img.height * sc) / 2, face, sc);
        const bx = cx + face * 30, by = 104;
        if (d < 18) {
          drawArrow(bx - face * (d / 18) * 8, by, fromP ? 0 : Math.PI, 18, false);
        } else {
          const p = (d - 18) / 8;
          drawArrow(bx + face * p * 260, by, fromP ? 0 : Math.PI, 18, false);
          if (d < 22) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillRect(0, 0, W, H);
          }
        }
      } else if (i === 1) {
        const img = jokerFrames[1];
        const hop = Math.abs(Math.sin(d * 0.35)) * 14;
        ctx.save();
        ctx.translate(Math.round(cx), Math.round(170 - hop));
        ctx.rotate(Math.sin(d * 0.4) * 0.2);
        ctx.scale(face, 1);
        ctx.drawImage(img, -(img.width * sc) / 2, -img.height * sc, img.width * sc, img.height * sc);
        ctx.restore();
        if (d < 18) drawMiniBox(cx, 170 - hop - img.height * sc - 16, Math.sin(d * 0.5) * 0.3, 24);
        else drawMiniBox(cx + face * (d - 18) * 18, 60 - (d - 18) * 3 + (d - 18) * (d - 18) * 0.2, (d - 18) * 0.6, 24);
        if (d % 10 < 6) drawComic('HEE HEE!', cx - face * 70, 50, 6, '#ff3e6c');
      } else {
        const img = d >= 8 ? knightShine : knightFrames[0];
        const jump = d >= 18 ? Math.pow((d - 18) / 10, 2) * 200 : 0;
        drawImg(img, cx - (img.width * sc) / 2, 112 - (img.height * sc) / 2 - jump, face, sc);
        if (d >= 8 && d < 18) {
          for (let j = 0; j < 8; j++) {
            const a = (j / 8) * Math.PI * 2 + d * 0.3;
            sparkle(Math.round(cx + Math.cos(a) * 30), Math.round(80 + Math.sin(a) * 20), 2, '#ffffff');
          }
        }
        if (d >= 18) {
          ctx.fillStyle = '#7fdcff';
          for (let j = 0; j < 6; j++) ctx.fillRect(Math.round(cx - 20 + j * 8), Math.round(140 - jump + j * 6), 2, 30);
        }
      }
      const bar = 26;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, bar);
      ctx.fillRect(0, H - bar, W, bar);
      const label = ['THE ARCHER!', 'THE JOKER!', 'THE KNIGHT!'][i];
      drawText(label.slice(0, Math.floor(d / 1.5)), W / 2, H - 18, 8, d % 6 < 3 ? '#ffe14d' : '#ffffff', 'center', '#1a1420');
      drawText("KING'S GRAIL", W / 2, 9, 8, '#e8c547', 'center', '#1a1420');
      ctx.restore();
    });
  }

  function drawArrow(x, y, ang, len, flame) {
    const ux = Math.cos(ang), uy = Math.sin(ang);
    ctx.save();
    ctx.lineCap = 'round';
    if (flame) {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = ['#ffe14d', '#ff9a2e', '#e83a30', '#9a1c1a'][i];
        const d = 2 + i * 4;
        const r = 3 - i * 0.5;
        ctx.globalAlpha = 0.9 - i * 0.15;
        ctx.beginPath();
        ctx.arc(x - ux * d + (Math.random() - 0.5) * 2, y - uy * d + (Math.random() - 0.5) * 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = '#6b4220';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - ux * len, y - uy * len);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = '#d8e0f0';
    ctx.beginPath();
    ctx.moveTo(x + ux * 5, y + uy * 5);
    ctx.lineTo(x - uy * 3, y + ux * 3);
    ctx.lineTo(x + uy * 3, y - ux * 3);
    ctx.fill();
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(Math.round(x - ux * len - uy * 2) - 1, Math.round(y - uy * len + ux * 2) - 1, 2, 2);
    ctx.fillRect(Math.round(x - ux * len + uy * 2) - 1, Math.round(y - uy * len - ux * 2) - 1, 2, 2);
    ctx.restore();
  }

  function drawBowShot({ fromP, lt }, eBaseX, pBaseX) {
    const [sx, sy, tx, ty] = fromP ? [112, 108, eBaseX + 18, 62] : [eBaseX - 2, 60, pBaseX + 24, 118];
    const ang = Math.atan2(ty - sy, tx - sx);
    const ux = Math.cos(ang), uy = Math.sin(ang);
    if (lt < 16) {
      const k = lt / 16;
      ctx.save();
      ctx.globalAlpha = 0.3 + k * 0.4;
      blob(Math.round(sx), Math.round(sy), Math.round(4 + k * 6), '#fff3a8');
      ctx.restore();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + lt * 0.3;
        const d = (16 - lt) * 2 + 4;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(sx + Math.cos(a) * d), Math.round(sy + Math.sin(a) * d), 2, 2);
      }
      if (tick % 4 < 2) {
        ctx.fillStyle = 'rgba(255,60,60,0.6)';
        for (let d = 0; d < Math.hypot(tx - sx, ty - sy); d += 8) ctx.fillRect(Math.round(sx + ux * d), Math.round(sy + uy * d), 3, 1);
      }
      drawArrow(sx - ux * (k * 6), sy - uy * (k * 6), ang, 14, false);
    }
    if (lt >= 16 && lt < 28) {
      const p = (lt - 16) / 6;
      const dist = Math.hypot(tx - sx, ty - sy);
      const ax = sx + ux * dist * p, ay = sy + uy * dist * p;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx + ux * dist * Math.max(0, p - 0.6), sy + uy * dist * Math.max(0, p - 0.6));
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.restore();
      drawArrow(ax, ay, ang, 14, false);
    }
    if (lt >= 22 && lt < 40) {
      const k = 1 - (lt - 22) / 18;
      const spread = (lt - 22) * 1.2;
      ctx.save();
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(tx - ux * 40 - uy * spread * s, ty - uy * 40 + ux * spread * s);
        ctx.lineTo(tx + ux * 40 - uy * spread * s, ty + uy * 40 + ux * spread * s);
        ctx.stroke();
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ff5050';
      ctx.beginPath();
      ctx.moveTo(tx - ux * 46, ty - uy * 46);
      ctx.lineTo(tx + ux * 46, ty + uy * 46);
      ctx.stroke();
      ctx.restore();
      if (lt < 25) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }
  }

  function drawArrowRain({ fromP, lt }, eBaseX, pBaseX) {
    const [tx, groundY] = fromP ? [eBaseX + 18, 94] : [pBaseX + 24, 154];
    if (lt < 72) return;
    const shade = Math.min(1, (lt - 72) / 8) * (lt > 136 ? Math.max(0, (150 - lt) / 14) : 1);
    ctx.save();
    ctx.globalAlpha = 0.25 * shade;
    ctx.fillStyle = '#5a1a0a';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    for (let i = 0; i < 34; i++) {
      const start = 74 + (i * 53) % 52;
      const p = (lt - start) / 14;
      if (p < 0 || p > 1) continue;
      const ox = ((i * 37) % 80) - 40;
      const ex = tx + ox, ey = groundY - 4 - ((i * 13) % 20);
      const ang = Math.PI / 2 + 0.35;
      const x = ex - Math.cos(ang) * 200 * (1 - p), y = ey - Math.sin(ang) * 200 * (1 - p);
      drawArrow(x, y, ang, 14, true);
    }
    for (const h of RAIN_HITS) {
      const d = lt - h;
      if (d < 0 || d > 14) continue;
      const hx = tx + ((h * 7) % 50) - 25;
      const r = 4 + d * 2;
      ctx.save();
      ctx.globalAlpha = 1 - d / 14;
      blob(Math.round(hx), groundY - 10, r, '#ff9a2e');
      blob(Math.round(hx), groundY - 10, Math.max(1, r - 4), '#ffe14d');
      ctx.restore();
    }
    for (let i = 0; i < 10; i++) {
      const fx = tx - 45 + i * 10;
      if (lt > 86 && lt < 146) {
        const fh = 4 + ((i * 5 + (tick >> 1)) % 6);
        ctx.fillStyle = i % 2 ? '#ff9a2e' : '#ffe14d';
        ctx.fillRect(fx, groundY - fh, 3, fh);
      }
    }
  }

  function drawRainCutscene({ fromP, lt }) {
    const k = Math.min(clamp(lt / 6, 0, 1), lt > 64 ? clamp((72 - lt) / 8, 0, 1) : 1);
    const img = fromP ? playerFrames[0] : battle.enemy.frames[0];
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = '#2a0e08';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = k * 0.35;
    ctx.fillStyle = '#7a2a10';
    for (let i = 0; i < 14; i++) {
      const sx = ((i * 61 + lt * 10) % (W + 60)) - 30;
      ctx.fillRect(W - sx, 30 + ((i * 37) % 150), 40, 1);
    }
    ctx.globalAlpha = k;
    const pan = clamp(1 - lt / 14, 0, 1);
    const sc = 5, w = img.width * sc, h = img.height * sc;
    const cx = W / 2 + pan * 160, top = 112 - h / 2;
    const tilt = clamp((lt - 18) / 16, 0, 1);
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(top + h * 0.45));
    ctx.rotate(-tilt * 0.5);
    ctx.drawImage(img, -w / 2, -h * 0.45, w, h);
    ctx.restore();
    const bowX = cx + w / 2 - 8, bowY = top + h * 0.35;
    if (lt >= 34 && lt < 50) {
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = ['#ffe14d', '#ff9a2e', '#e83a30'][i % 3];
        ctx.fillRect(Math.round(bowX - 6 + Math.random() * 12), Math.round(bowY - 30 - Math.random() * 20), 3, 3);
      }
      ctx.save();
      ctx.globalAlpha = k * 0.5;
      blob(Math.round(bowX), Math.round(bowY - 34), 12, '#ff9a2e');
      ctx.restore();
    }
    if (lt >= 46) {
      for (let i = 0; i < 16; i++) {
        const p = (lt - 46 - (i % 8) * 1.2) / 10;
        if (p < 0 || p > 1.4) continue;
        const ang = -Math.PI / 2 + ((i % 5) - 2) * 0.12;
        drawArrow(bowX + Math.cos(ang) * p * 200, bowY - 30 + Math.sin(ang) * p * 200, ang, 14, true);
      }
    }
    if (lt >= 46 && lt < 50) {
      ctx.fillStyle = 'rgba(255,200,120,0.6)';
      ctx.fillRect(0, 0, W, H);
    }
    const bar = Math.round(28 * clamp(lt / 10, 0, 1));
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);
    if (lt >= 24) {
      const n = Math.min(14, Math.floor((lt - 24) / 1.5));
      drawText('RAIN OF ARROWS'.slice(0, n), W / 2, H - 20, 8, lt % 6 < 3 ? '#ff9a2e' : '#ffe14d', 'center', '#1a1420');
    }
    ctx.restore();
  }

  function teleportStreak(x, groundY, k) {
    if (k <= 0) return;
    ctx.save();
    ctx.globalAlpha = 0.5 * k;
    ctx.fillStyle = '#7fdcff';
    ctx.fillRect(Math.round(x - 12 * k), 0, Math.round(24 * k), groundY);
    ctx.globalAlpha = k;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(x - 4 * k), 0, Math.max(1, Math.round(8 * k)), groundY);
    ctx.restore();
    for (let i = 0; i < 6; i++) {
      sparkle(Math.round(x + Math.sin(i * 2.1 + tick * 0.3) * 18), Math.round(groundY - 10 - ((tick * 3 + i * 17) % 70)), 1, '#eef4ff');
    }
  }

  function drawSlashArc(cx, cy, ang, d) {
    const p = clamp((d + 3) / 4, 0, 1);
    const a = d < 3 ? 1 : Math.max(0, (8 - d) / 5);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.globalAlpha = a;
    ctx.lineCap = 'round';
    const a0 = Math.PI * 1.1;
    const a1 = a0 + Math.PI * 0.8 * p;
    for (const [lw, col] of [[8, '#3a6fb0'], [5, '#7fdcff'], [2, '#ffffff']]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(0, 14, 38, a0, a1);
      ctx.stroke();
    }
    if (d >= 0 && d < 4) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) {
        const sa = a1 + (i - 3) * 0.25;
        ctx.fillRect(Math.round(Math.cos(sa) * (40 + d * 4)), Math.round(14 + Math.sin(sa) * (40 + d * 4)), 2, 2);
      }
    }
    ctx.restore();
  }

  function drawSwordSlash({ fromP, lt }, eBaseX, pBaseX) {
    const [tx, ty, groundY] = fromP ? [eBaseX + 18, 62, 94] : [pBaseX + 24, 118, 154];
    const [bx, by] = fromP ? [pBaseX + 24, 154] : [eBaseX + 18, 94];
    const img = fromP ? playerFrames[0] : battle.enemy.frames[0];
    const sc = 3, w = img.width * sc, h = img.height * sc;
    if (lt >= 2 && lt < 12) teleportStreak(bx, by, 1 - (lt - 2) / 10);
    if (lt >= 56 && lt < 68) teleportStreak(bx, by, lt < 60 ? (lt - 56) / 4 : 1 - (lt - 60) / 8);

    const SIDES = [1, -1, 1, -1], LIFT = [0, 0, -18, 0], ANG = [-0.5, 0.6, 0, 1.3];
    if (lt >= 12 && lt < 56) {
      const i = clamp(Math.floor((lt - 12) / 10), 0, 3);
      const sinceTp = (lt - 12) % 10;
      if (sinceTp < 3 && i > 0) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        drawImg(img, tx + SIDES[i - 1] * 44 - w / 2, groundY - h + 3 + LIFT[i - 1], -SIDES[i - 1], sc);
        ctx.restore();
        teleportStreak(tx + SIDES[i] * 44, groundY, 1 - sinceTp / 3);
      }
      const lunge = lt - SLASH_HITS[i] >= -3 && lt - SLASH_HITS[i] < 3 ? -SIDES[i] * 10 : 0;
      drawImg(img, tx + SIDES[i] * 44 + lunge - w / 2, groundY - h + 3 + LIFT[i], -SIDES[i], sc);
      if (lt - SLASH_HITS[i] >= -3 && lt - SLASH_HITS[i] < 3) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(tx + SIDES[i] * 30 + lunge - 1), groundY - h + 10 + LIFT[i], 2, 20);
      }
    }
    for (let i = 0; i < 4; i++) {
      const d = lt - SLASH_HITS[i];
      if (d >= -3 && d <= 8) drawSlashArc(tx, ty, ANG[i] * (SIDES[i] > 0 ? 1 : -1), d);
      if (d >= 0 && d < 2) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#eef8ff';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }
  }

  function drawOblivionStrike({ fromP, lt }, eBaseX, pBaseX) {
    const [tx, groundY] = fromP ? [eBaseX + 18, 94] : [pBaseX + 24, 154];
    const [bx, by] = fromP ? [pBaseX + 24, 154] : [eBaseX + 18, 94];
    const img = fromP ? playerFrames[0] : battle.id === 'knight' ? knightShine : battle.enemy.frames[0];
    const sc = 3, w = img.width * sc, h = img.height * sc;
    if (lt >= 76 && lt < 92) {
      const k = 1 - (lt - 76) / 16;
      ctx.save();
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#eef4ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(bx, by, 10 + (1 - k) * 50, 3 + (1 - k) * 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (lt >= 92 && lt < 100 && tick % 4 < 2) {
      sparkle(Math.round(tx), 8, 2, '#7fdcff');
    }
    if (lt >= 96 && lt < 112) {
      const k = (lt - 96) / 16;
      ctx.save();
      ctx.globalAlpha = 0.25 + k * 0.35;
      ctx.fillStyle = '#5a3fb0';
      ctx.beginPath();
      ctx.ellipse(tx, groundY, 8 + k * 30, 2 + k * 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = (0.2 + k * 0.4) * (tick % 4 < 2 ? 1 : 0.6);
      ctx.fillStyle = '#7fdcff';
      ctx.fillRect(Math.round(tx - 1 - k * 3), 0, Math.round(2 + k * 6), groundY);
      ctx.restore();
    }
    if (lt >= 100 && lt < 112) {
      const p = (lt - 100) / 12;
      const fy = groundY - h + 3 - (1 - p) * 160;
      ctx.save();
      for (let i = 0; i < 14; i++) {
        const tx2 = tx + ((i * 7) % 15) - 7 + Math.sin(i + lt) * 6;
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = ['#7fdcff', '#5a3fb0', '#ffffff'][i % 3];
        ctx.fillRect(Math.round(tx2), Math.round(fy - 10 - i * 9), 2, 12 + (i % 3) * 6);
      }
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#7fdcff';
      ctx.fillRect(Math.round(tx - 10), Math.round(fy - 120), 20, 130);
      ctx.restore();
      drawImg(img, tx - w / 2, Math.round(fy), fromP ? 1 : -1, sc);
    }
    if (lt >= 112 && lt < 150) {
      const p = (lt - 112) / 38;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p * 1.6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(tx - 14 + p * 14), 0, Math.round(28 - p * 28), groundY);
      ctx.fillStyle = '#7fdcff';
      ctx.fillRect(Math.round(tx - 22 + p * 22), 0, Math.round(6 - p * 6), groundY);
      ctx.fillRect(Math.round(tx + 16 - p * 6), 0, Math.round(6 - p * 6), groundY);
      ctx.restore();
      for (let r = 0; r < 3; r++) {
        const rp = clamp(p * 1.6 - r * 0.2, 0, 1);
        if (rp <= 0 || rp >= 1) continue;
        ctx.save();
        ctx.globalAlpha = 1 - rp;
        ctx.strokeStyle = r === 1 ? '#5a3fb0' : '#eef4ff';
        ctx.lineWidth = 3 - r;
        ctx.beginPath();
        ctx.ellipse(tx, groundY, 10 + rp * 140, 3 + rp * 30, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      for (let i = 0; i < 16; i++) {
        const a = Math.PI + (i / 15) * Math.PI;
        const d = p * (60 + (i % 4) * 18);
        const sx = tx + Math.cos(a) * d;
        const sy = groundY + Math.sin(a) * d * 0.9 + p * p * 60;
        ctx.fillStyle = i % 2 ? '#b8c4d6' : '#7fdcff';
        if (p < 0.8) ctx.fillRect(Math.round(sx), Math.round(sy), 3, 3);
      }
      if (lt < 134) {
        const side = fromP ? -1 : 1;
        drawImg(img, tx + side * 34 - w / 2, groundY - h + 3, -side, sc);
      }
      if (lt < 116) {
        ctx.save();
        ctx.globalAlpha = lt < 114 ? 0.9 : 0.4;
        ctx.fillStyle = lt < 114 ? '#ffffff' : '#7fdcff';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }
    if (lt >= 132 && lt < 146) teleportStreak(bx, by, lt < 136 ? (lt - 132) / 4 : 1 - (lt - 136) / 10);
  }

  function drawOblivionCutscene({ fromP, lt }) {
    const k = Math.min(clamp(lt / 6, 0, 1), lt > 70 ? clamp((78 - lt) / 8, 0, 1) : 1);
    const shine = lt >= 38;
    const img = fromP ? playerFrames[0] : battle.id === 'knight' ? (shine ? knightShine : knightFrames[0]) : battle.enemy.frames[0];
    const eyes = fromP ? [[6, 4]] : battle.id === 'knight' ? [[7, 7], [9.5, 7]] : [];
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = '#0c0a1e';
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = 104;
    ctx.save();
    ctx.globalAlpha = k * 0.6;
    ctx.strokeStyle = shine ? '#4a3a9a' : '#2a2456';
    ctx.lineWidth = 2;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + lt * 0.01;
      const r0 = 70 + ((i * 37 + lt * 6) % 60);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * (r0 + 120), cy + Math.sin(a) * (r0 + 120));
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = k * (shine ? 0.45 : 0.25);
    blob(cx, cy, 56, shine ? '#3a6fb0' : '#2a2456');
    ctx.restore();

    const sc = 5, w = img.width * sc, h = img.height * sc;
    const top = cy - h / 2 + 4;
    const turn = clamp((lt - 18) / 8, 0, 1);
    const sx = -Math.cos(turn * Math.PI);
    const drawSx = Math.abs(sx) < 0.12 ? Math.sign(sx || 1) * 0.12 : sx;
    ctx.save();
    ctx.translate(Math.round(cx), 0);
    ctx.scale(drawSx, 1);
    ctx.drawImage(img, -w / 2, Math.round(top), w, h);
    ctx.restore();

    if (shine) {
      const gp = Math.min(1, (lt - 38) / 6);
      for (const [col, row] of eyes) {
        const ex = cx - w / 2 + (col + 0.5) * sc;
        const ey = top + (row + 0.5) * sc;
        const len = Math.round((10 + Math.sin(lt * 0.5) * 3) * gp);
        ctx.save();
        ctx.globalAlpha = k * 0.5;
        blob(Math.round(ex), Math.round(ey), Math.round(6 * gp) + 1, '#7fdcff');
        ctx.globalAlpha = k;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(ex - len), Math.round(ey), len * 2, 1);
        ctx.fillRect(Math.round(ex), Math.round(ey - len), 1, len * 2);
        ctx.fillRect(Math.round(ex - 1), Math.round(ey - 1), 3, 3);
        ctx.restore();
      }
    }
    if (lt >= 38 && lt < 42) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(0, 0, W, H);
    }
    const bar = Math.round(28 * clamp(lt / 10, 0, 1));
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);
    if (lt >= 46) {
      const n = Math.min(14, Math.floor((lt - 46) / 1.5));
      drawText('SLASH OBLIVION'.slice(0, n), cx, H - 20, 8, lt % 6 < 3 ? '#7fdcff' : '#ffffff', 'center', '#1a1420');
    }
    ctx.restore();
  }

  // ---------- Render ----------
  function render() {
    if (game.mode === 'menu') {
      renderMenu();
      return;
    }
    if (game.mode === 'battle') {
      renderBattle();
    } else if (game.mode === 'sky') {
      renderSky();
    } else if (game.mode === 'eye') {
      renderEye();
    } else if (game.mode === 'coma') {
      renderComa();
    } else if (game.mode === 'castle') {
      renderCastle();
    } else if (game.mode === 'maze') {
      renderMaze();
    } else if (game.mode === 'king') {
      if (kingRoom.rumble > 0) {
        const s = Math.min(6, 1 + kingRoom.rumble / 25);
        ctx.save();
        ctx.translate(Math.round((Math.random() - 0.5) * s * 2), Math.round((Math.random() - 0.5) * s));
        renderKing();
        drawRumbleDebris();
        ctx.restore();
      } else {
        renderKing();
      }
    } else if (game.mode === 'omen') {
      renderOmen();
    } else if (game.mode === 'transition' && pendingBattle && pendingBattle.returnMode !== 'world') {
      if (pendingBattle.returnMode === 'maze') renderMaze();
      else if (pendingBattle.returnMode === 'king') renderKing();
      else renderCastle();
      renderTransition();
    } else {
      renderWorld();
      if (game.mode === 'transition') renderTransition();
    }
    if (fade.alpha > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fade.alpha})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (run.mode === 'speedrun') drawRunTimer();
    if (admin.open) drawAdminPanel();
    if (replay.recorder && replay.recorder.state === 'recording') {
      replay.vctx.drawImage(cvs, 0, 0, replay.vcan.width, replay.vcan.height);
    }
    if (replay.on) drawReplayBar();
  }

  // ---------- Eye boss (true form) ----------
  const EYE_FIGHT_FRAMES = 1800;
  const EYE_INTRO_END = 230;
  const BANDS = { top: [[0, 78]], bottom: [[138, H]], both: [[0, 78], [138, H]], middle: [[72, 144]] };
  const DASH_HALF = 24;
  const PX = 70;
  const KNOCK_T = 178;
  const PORTAL_X = 248;
  const eye = {
    phase: 'intro', t: 0, py: 108, pvy: 0, attempt: 1, timer: 0,
    beams: [], orbs: [], next: 60, nextOrb: 0, shake: 0, flash: 0, parts: [], streaks: [],
    ex: 316, ey: 108,
  };

  function startEyeFight() {
    game.mode = 'eye';
    Object.assign(eye, {
      phase: 'intro', t: 0, py: 99 + 9, pvy: 0, attempt: 1, timer: 0,
      beams: [], orbs: [], dash: null, next: 60, nextOrb: 0, shake: 0, flash: 0, parts: [], ex: 300, ey: -60, energyDisp: undefined, eyeGlow: 0,
    });
    eye.streaks = [];
    for (let i = 0; i < 40; i++) eye.streaks.push({ x: Math.random() * W, y: Math.random() * H, len: 6 + Math.random() * 18, s: 0.6 + Math.random() });
  }

  function eyeBurst(x, y, n, colors, speed = 3, life = 30) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.5 + Math.random() * speed;
      eye.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: life + Math.random() * 15, c: colors[i % colors.length], s: 2, g: 0 });
    }
  }

  function resetEyeAttempt() {
    eye.attempt++;
    Object.assign(eye, { phase: 'fight', t: 0, timer: 0, beams: [], orbs: [], dash: null, next: 70, nextOrb: 0, py: 108, pvy: 0, ex: 316, ey: 108, eyeGlow: 0 });
  }

  function eyeIntroPlayerY(t) {
    if (t < 74) return 167;
    const p = Math.min(1, (t - 74) / 30);
    return 167 + (108 - 167) * (1 - (1 - p) * (1 - p));
  }

  function updateEye() {
    const e = eye;
    e.t++;
    if (e.phase === 'end') {
      const back = keys['enter'] || keys['e'] || keys['escape'];
      if (e.t > 150 && back && fade.dir === 0) fadeThen(() => location.reload());
      return;
    }
    if (e.shake > 0) e.shake--;
    if (e.flash > 0) e.flash--;
    for (let i = e.parts.length - 1; i >= 0; i--) {
      const p = e.parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g;
      p.vx *= 0.96; p.vy *= p.g ? 1 : 0.96;
      if (--p.life <= 0) e.parts.splice(i, 1);
    }
    const flying = e.phase !== 'intro' || e.t > 104;
    for (const s of e.streaks) {
      s.x -= (flying ? 6 : 0.5) * s.s;
      if (s.x < -s.len) { s.x = W + Math.random() * 40; s.y = Math.random() * H; }
    }

    if (e.phase === 'intro') {
      const t = e.t;
      if (t < 40) e.ey = -60 + t * 2.5;
      else if (t < 58) e.ey = 40 - (t - 40) * 1.1;
      else if (t < 68) e.ey = 20 + (t - 58) * 13;
      else if (t < 110) e.ey = 150;
      else if (t < 150) { const p = (t - 110) / 40; e.ey = 150 + (108 - 150) * p; e.ex = 300 + 16 * p; }
      if (t === 40) sfx('rise');
      if (t === 58) sfx('whistle');
      if (t === 68) {
        sfx('megaBoom');
        e.shake = 30;
        e.flash = 10;
        eyeBurst(e.ex, 176, 40, ['#ffffff', '#fff3a8', '#dbe7fa'], 4);
      }
      if (t === 104) sfx('skyGem');
      if (t === 104) eyeBurst(PX + 4, 108, 24, ['#5ff0ff', '#bff4ff', '#ffffff'], 2.5);
      e.py = eyeIntroPlayerY(t);
      if (t >= EYE_INTRO_END) { e.phase = 'fight'; e.t = 0; e.timer = 0; }
      return;
    }

    if (e.eyeGlow > 0) e.eyeGlow--;
    if (e.phase === 'fight') {
      e.timer++;
      const up = keys['w'] || keys['arrowup'];
      const down = keys['s'] || keys['arrowdown'];
      e.pvy += (((down ? 1 : 0) - (up ? 1 : 0)) * 3 - e.pvy) * 0.3;
      e.py = clamp(e.py + e.pvy, 8, H - 8);
      if (e.timer % 3 === 0) e.parts.push({ x: PX - 2, y: e.py + (Math.random() - 0.5) * 6, vx: -2, vy: 0, life: 16, c: '#5ff0ff', s: 2, g: 0 });

      const prog = e.timer / EYE_FIGHT_FRAMES;
      let dashHit = false;
      if (e.dash) {
        const d = e.dash;
        d.t++;
        if (d.t === 1) sfx('lockOn');
        if (d.t === 24) sfx('siren');
        if (d.t < 24) e.ey += (clamp(e.py, 30, H - 30) - e.ey) * 0.15;
        if (d.t === 24) d.y = e.ey;
        if (d.t === 64) {
          e.shake = 10;
          sfx('dashRoar');
        }
        if (d.t >= 64 && d.t < 94) e.ex -= 14;
        if (d.t === 94) e.ex = W + 90;
        if (d.t > 94) {
          e.ex += (316 - e.ex) * 0.12;
          e.ey += (108 - e.ey) * 0.06;
        }
        if (d.t >= 64 && d.t < 94 && Math.abs(e.py - d.y) < DASH_HALF + 4 && Math.abs(e.ex - (PX + 4)) < 34) dashHit = true;
        if (d.t >= 135) {
          e.ex = 316;
          e.dash = null;
          e.next = 40;
        }
      } else {
        e.ey += (108 + Math.sin(e.timer * 0.03) * 10 - e.ey) * 0.05;
        if (--e.next <= 0) {
          if (e.timer > 300 && e.beams.length === 0 && Math.random() < 0.25) {
            e.dash = { t: 0, y: e.ey };
          } else {
            const pats = ['top', 'bottom', 'both', 'middle'];
            const warn = Math.round(52 - prog * 14);
            e.beams.push({ pat: pats[Math.floor(Math.random() * pats.length)], t: 0, warn, fire: 26 });
            e.next = Math.round(warn + 26 + 34 - prog * 18);
          }
        }
      }
      if (!e.dash && e.timer > 600 && --e.nextOrb <= 0) {
        e.orbs.push({ x: e.ex - 30, y: e.ey, vx: -3.4, vy: (e.py - e.ey) / 70 });
        e.eyeGlow = 60;
        sfx('orb');
        e.nextOrb = Math.round(72 - prog * 22);
      }
      let hit = dashHit;
      const top = e.py - 5, bot = e.py + 5;
      for (let i = e.beams.length - 1; i >= 0; i--) {
        const b = e.beams[i];
        b.t++;
        const firing = b.t >= b.warn && b.t < b.warn + b.fire;
        if (b.t === 1) sfx('portal');
        if (b.t < b.warn && b.t % 12 === 1) sfx('warn');
        if (b.t === b.warn) {
          e.shake = 6;
          sfx('laser');
        }
        if (firing && BANDS[b.pat].some(([y0, y1]) => bot > y0 + 2 && top < y1 - 2)) hit = true;
        if (b.t >= b.warn + b.fire) e.beams.splice(i, 1);
      }
      for (let i = e.orbs.length - 1; i >= 0; i--) {
        const o = e.orbs[i];
        o.x += o.vx; o.y += o.vy;
        if (Math.abs(o.x - (PX + 4)) < 8 && Math.abs(o.y - e.py) < 9) hit = true;
        if (o.x < -10) e.orbs.splice(i, 1);
      }
      if (hit) {
        e.phase = 'dead';
        e.t = 0;
        e.shake = 16;
        e.flash = 6;
        e.beams = [];
        e.orbs = [];
        e.dash = null;
        sfx('die');
        eyeBurst(PX + 4, e.py, 36, ['#2f6fdc', '#5ff0ff', '#ffffff', '#f2c79b'], 4);
      } else if (e.timer >= EYE_FIGHT_FRAMES) {
        e.phase = 'tired';
        e.t = 0;
        e.beams = [];
        e.orbs = [];
        e.dash = null;
        e.ex = 316;
        sfx('tired');
      }
      return;
    }

    if (e.phase === 'dead') {
      if (e.t >= 70) {
        resetEyeAttempt();
        sfx('respawn');
      }
      return;
    }

    if (e.phase === 'tired') {
      e.ey += (124 - e.ey) * 0.02;
      if (e.t >= 140) { e.phase = 'death'; e.t = 0; }
      return;
    }

    if (e.phase === 'death') {
      const t = e.t;
      if (t < 150) e.shake = Math.max(e.shake, Math.floor(t / 25) + 2);
      if (t < 150 && t % 14 === 0) sfx('boom');
      if (t < 150 && t % 7 === 0) {
        eyeBurst(e.ex + (Math.random() - 0.5) * 90, e.ey + (Math.random() - 0.5) * 80, 10, ['#ffffff', '#fff3a8', '#ffe14d'], 2.5, 18);
      }
      if (t % 4 === 0) {
        e.parts.push({ x: e.ex + (Math.random() - 0.5) * 100, y: e.ey - 40, vx: (Math.random() - 0.5) * 0.6, vy: 0.4, life: 160, c: '#fffbe8', s: 2, g: 0.004 });
      }
      if (t === 150) {
        if (!inventory.includes('lightGem')) {
          addItem('lightGem');
          castle.newGem = true;
        }
        classicSave('eye');
        sfx('finalBoom');
        e.flash = 30;
        e.shake = 40;
        eyeBurst(e.ex, e.ey, 90, ['#ffffff', '#fff3a8', '#ffe14d', '#e8c547'], 6, 50);
      }
      if (t === KNOCK_T) {
        sfx('knock');
        e.shake = 24;
        eyeBurst(PX + 4, e.py, 30, ['#2f6fdc', '#5ff0ff', '#ffffff', '#fff3a8'], 4);
      }
      if (t === 330) fadeThen(startComa);
    }
  }

  function drawFlyingPlayer(y) {
    const flap = Math.floor(tick / 5) % 2;
    const cx = PX + 4;
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.1 * Math.sin(tick * 0.2);
    blob(cx, Math.round(y), 13, '#5ff0ff');
    ctx.restore();
    ctx.fillStyle = '#1f6fb0';
    for (const dir of [-1, 1]) {
      const wy = Math.round(y) - 4 + (flap ? -3 : 1);
      ctx.fillRect(cx - 2 + dir * 3, wy, dir * 9, 3);
      ctx.fillRect(cx - 2 + dir * 5, wy + (flap ? -2 : 2), dir * 6, 2);
    }
    ctx.fillStyle = '#bff4ff';
    for (const dir of [-1, 1]) {
      const wy = Math.round(y) - 3 + (flap ? -3 : 1);
      ctx.fillRect(cx - 2 + dir * 4, wy, dir * 7, 1);
    }
    drawImg(playerFrames[1], PX - 2, Math.round(y) - 9, 1);
  }

  function drawEyeBoss(x, y, tired) {
    const img = seraphFrames[Math.floor(tick / (tired ? 24 : 10)) % 2];
    ctx.save();
    ctx.globalAlpha = 0.2 + 0.08 * Math.sin(tick * 0.1);
    blob(Math.round(x), Math.round(y), 62, '#fff3a8');
    ctx.globalAlpha = 0.25;
    blob(Math.round(x), Math.round(y), 36, '#ffffff');
    ctx.restore();
    drawImg(img, x - 54, y - 39, -1, 1.5);
    const ix = Math.round(x), iy = Math.round(y);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(ix - 9, iy - 4, 18, 9);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ix - 8, iy - 3, 16, 7);
    const dx = clamp((PX - x) / 30, -4, 4), dy = clamp((eye.py - y) / 25, -2, 2);
    const glow = eye.eyeGlow > 0 && !tired;
    if (glow) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(tick * 0.6);
      blob(ix, iy, 14, '#ffe14d');
      ctx.restore();
      for (let i = 0; i < 10; i++) {
        const a = Math.PI - (i / 10) * Math.PI * 2;
        const ex = Math.round(ix + Math.cos(a) * 13.5), ey = Math.round(iy + Math.sin(a) * 13.5);
        ctx.fillStyle = '#1a1420';
        ctx.fillRect(ex - 2, ey - 2, 3, 3);
        ctx.fillStyle = '#ffe14d';
        ctx.fillRect(ex - 1, ey - 1, 2, 2);
      }
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(ix - 9, iy - 4, 18, 9);
      ctx.fillStyle = '#fff6c0';
      ctx.fillRect(ix - 8, iy - 3, 16, 7);
    }
    ctx.fillStyle = glow ? '#ffe14d' : '#c8301e';
    ctx.fillRect(Math.round(ix - 3 + dx), Math.round(iy - 2 + dy), 6, 5);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(Math.round(ix - 1 + dx), Math.round(iy - 1 + dy), 2, 3);
    if (tired) {
      ctx.fillStyle = '#e8c547';
      ctx.fillRect(ix - 9, iy - 4, 18, 6);
      ctx.fillStyle = '#6a5010';
      ctx.fillRect(ix - 9, iy + 1, 18, 1);
    }
  }

  function drawPortal(x, cy, ry, open, hot) {
    if (open <= 0) return;
    const rx = Math.max(2, 11 * open), r = Math.max(2, ry * open);
    const oval = (w, h, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(x, cy, Math.max(1, w), Math.max(1, h), 0, 0, Math.PI * 2);
      ctx.fill();
    };
    ctx.save();
    ctx.globalAlpha = 0.3 + (hot ? 0.15 * Math.sin(tick * 0.8) : 0);
    oval(rx + 8, r + 8, hot ? '#fff3a8' : '#b07cff');
    ctx.globalAlpha = 1;
    oval(rx + 2, r + 2, '#1a1420');
    oval(rx + 1, r + 1, '#e8c547');
    oval(rx, r, '#5b2a86');
    oval(rx * 0.7, r * 0.82, '#8a4ad8');
    oval(rx * 0.4, r * 0.6, hot ? '#fffbe8' : '#2a1040');
    for (let i = 0; i < 12; i++) {
      const a = tick * 0.15 + i * 0.52;
      const f = 0.3 + (i % 3) * 0.25;
      ctx.fillStyle = i % 2 ? '#e8d8ff' : '#ffe14d';
      ctx.fillRect(Math.round(x + Math.cos(a) * rx * f), Math.round(cy + Math.sin(a) * r * f), 2, 2);
    }
    ctx.restore();
  }

  function drawEyeBeams() {
    const e = eye;
    if (e.dash && e.dash.t < 64) {
      const d = e.dash;
      const cy = Math.round(d.t < 24 ? e.ey : d.y);
      const pulse = Math.floor(d.t / 4) % 2;
      ctx.save();
      ctx.globalAlpha = (d.t < 24 ? 0.15 : 0.3) + (pulse ? 0.15 : 0);
      ctx.fillStyle = '#ff3030';
      ctx.fillRect(0, cy - DASH_HALF, W, DASH_HALF * 2);
      ctx.restore();
      ctx.fillStyle = pulse ? '#ff5050' : '#ffffff';
      for (let x = W - ((d.t * 3) % 16); x > -16; x -= 16) {
        ctx.fillRect(x, cy - DASH_HALF, 9, 2);
        ctx.fillRect(x, cy + DASH_HALF - 2, 9, 2);
      }
      if (d.t >= 24) {
        for (let i = 0; i < 5; i++) {
          const ax = Math.round(W - 80 - (((d.t - 24) * 6 + i * 60) % (W - 60)));
          ctx.fillStyle = '#ff5050';
          for (let k = 0; k < 6; k++) {
            ctx.fillRect(ax + k, cy - k, 2, 2);
            ctx.fillRect(ax + k, cy + k, 2, 2);
          }
        }
        if (pulse) drawText('!', 14, cy - 8, 16, '#ff5050', 'center');
      }
    }
    if (e.dash && e.dash.t >= 64 && e.dash.t < 94) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 9; i++) {
        const ly = Math.round(e.dash.y - 30 + i * 7.5);
        ctx.fillRect(Math.round(e.ex + 40), ly, 30 + ((i * 37) % 40), 1);
      }
    }
    for (const b of e.beams) {
      const firing = b.t >= b.warn;
      for (const [y0, y1] of BANDS[b.pat]) {
        const mid = (y0 + y1) / 2, ry = (y1 - y0) / 2 - 3;
        if (firing) {
          const ft = b.t - b.warn;
          const k = ft < 4 ? ft / 4 : ft > b.fire - 6 ? (b.fire - ft) / 6 : 1;
          const half = ((y1 - y0) / 2) * k;
          const px = PORTAL_X - 6;
          ctx.save();
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#e8c547';
          ctx.fillRect(0, mid - half, px, half * 2);
          ctx.fillStyle = '#fff3a8';
          ctx.fillRect(0, mid - half * 0.7, px + 2, half * 1.4);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, mid - half * 0.35 + (tick % 4 < 2 ? 1 : 0), px + 4, half * 0.7);
          ctx.restore();
          for (let i = 0; i < 6; i++) {
            sparkle(Math.round(px - ((tick * 9 + i * 67) % px)), Math.round(mid + Math.sin(i * 2.1 + tick * 0.3) * half * 0.8), 1, '#ffffff');
          }
          drawPortal(PORTAL_X, mid, ry, ft > b.fire - 6 ? Math.max(0.2, (b.fire - ft) / 6) : 1, true);
        }
        if (!firing) {
          const pulse = Math.floor(b.t / 4) % 2;
          ctx.save();
          ctx.globalAlpha = 0.32 + (pulse ? 0.18 : 0);
          ctx.fillStyle = '#ff3030';
          ctx.fillRect(0, y0, W, y1 - y0);
          ctx.restore();
          ctx.fillStyle = pulse ? '#ff5050' : '#ffffff';
          for (let x = (b.t * 3) % 16 - 16; x < W; x += 16) {
            if (y0 > 0) ctx.fillRect(x, y0, 9, 2);
            if (y1 < H) ctx.fillRect(x, y1 - 2, 9, 2);
          }
          if (pulse) drawText('!', 14, (y0 + y1) / 2 - 8, 16, '#ff5050', 'center');
          drawPortal(PORTAL_X, mid, ry, Math.min(1, b.t / 16), b.t > b.warn - 10);
        }
      }
    }
    for (const o of e.orbs) {
      const x = Math.round(o.x), y = Math.round(o.y);
      ctx.save();
      ctx.globalAlpha = 0.4;
      blob(x, y, 9, '#fff3a8');
      ctx.restore();
      blob(x, y, 5, '#e8c547');
      blob(x, y, 3, '#ffffff');
      ctx.fillStyle = '#fff3a8';
      ctx.fillRect(x + 5, y - 1, 8, 2);
    }
  }

  function drawAngelEnergy() {
    const e = eye;
    let target;
    if (e.phase === 'intro') {
      if (e.t < 200) return;
      target = Math.min(1, (e.t - 200) / 30);
    } else if (e.phase === 'fight' || e.phase === 'dead') {
      target = 1 - e.timer / EYE_FIGHT_FRAMES;
    } else if (e.phase === 'tired') {
      target = 0;
    } else {
      return;
    }
    e.energyDisp = e.energyDisp === undefined ? target : e.energyDisp + (target - e.energyDisp) * 0.2;
    const v = clamp(e.energyDisp, 0, 1);
    const bw = 150, bh = 7;
    const bx = Math.round(W / 2 - bw / 2), by = 14;
    drawText('ANGEL ENERGY', W / 2, 3, 8, '#fff3a8', 'center');
    ctx.fillStyle = '#1c140c';
    ctx.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = '#2a1f3d';
    ctx.fillRect(bx, by, bw, bh);
    const fw = Math.round(bw * v);
    if (fw > 0) {
      const low = v < 0.2;
      const blink = low && Math.floor(tick / 6) % 2 === 0;
      ctx.fillStyle = blink ? '#ffffff' : low ? '#ff9a2e' : '#ffe14d';
      ctx.fillRect(bx, by, fw, bh);
      ctx.fillStyle = blink ? '#ffffff' : low ? '#ffc27a' : '#fffbe0';
      ctx.fillRect(bx, by, fw, 2);
      ctx.fillStyle = low ? '#c25a10' : '#c8a020';
      ctx.fillRect(bx, by + bh - 2, fw, 2);
      if (v > 0.02) sparkle(bx + fw, by + bh / 2, 1 + (Math.floor(tick / 8) % 2), '#ffffff');
    }
    ctx.fillStyle = '#1c140c';
    for (let i = 1; i < 10; i++) ctx.fillRect(bx + Math.round((bw * i) / 10), by, 1, bh);
  }

  function renderEye() {
    const e = eye;
    if (e.phase === 'end') {
      renderEndScreen();
      return;
    }
    ctx.save();
    if (e.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * e.shake), Math.round((Math.random() - 0.5) * e.shake));
    const bands = ['#140f36', '#211850', '#33216a', '#4a2c7a', '#663a80', '#88497e', '#ad5e76', '#d07a6c', '#eaa064'];
    const bh = Math.ceil(H / bands.length);
    bands.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(-20, i * bh - 20, W + 40, bh + (i === bands.length - 1 ? 40 : 0));
    });
    for (let r = 0; r < 5; r++) {
      const rad = ((tick * 0.8 + r * 40) % 200);
      ctx.save();
      ctx.globalAlpha = 0.15 * (1 - rad / 200);
      ctx.fillStyle = '#fff3a8';
      for (let a = 0; a < Math.PI * 2; a += 0.08) ctx.fillRect(Math.round(e.ex + Math.cos(a) * rad), Math.round(e.ey + Math.sin(a) * rad), 2, 2);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const s of e.streaks) ctx.fillRect(Math.round(s.x), Math.round(s.y), Math.round(s.len), 1);

    if (e.phase === 'intro') {
      const drop = e.t > 80 ? Math.pow(e.t - 80, 1.6) : 0;
      if (drop < 120) {
        for (let i = 0; i < 14; i++) {
          const cx = i * 30 - 6;
          const d = drop * (0.6 + ((i * 37) % 10) / 12);
          blob(cx, Math.round(194 + d), 18, '#ffffff');
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-20, Math.round(196 + drop * 0.6), W + 40, 60);
        if (e.t >= 68) {
          ctx.fillStyle = '#b4c8e6';
          for (let i = 0; i < 6; i++) ctx.fillRect(e.ex - 40 + i * 14, Math.round(178 + drop * 0.7), 2, 10);
        }
      }
    }

    const tired = e.phase === 'tired' || e.phase === 'death';
    const bossVisible = !(e.phase === 'death' && e.t >= 150);
    if (bossVisible) {
      const jx = e.phase === 'death' ? (Math.random() - 0.5) * (e.t / 20) : 0;
      if (e.phase === 'death' && e.t > 40) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (e.t - 40) / 80);
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + i;
          const len = Math.min(90, (e.t - 40) * 1.2);
          for (let r = 8; r < len; r += 2) ctx.fillRect(Math.round(e.ex + Math.cos(a) * r), Math.round(e.ey + Math.sin(a) * r), 2, 2);
        }
        ctx.restore();
      }
      drawEyeBoss(e.ex + jx, e.ey, tired);
    }

    drawEyeBeams();

    if (e.phase === 'death' && e.t >= 150 && e.t < KNOCK_T + 10) {
      const rad = (e.t - 150) * 8.5;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - (e.t - 150) / (KNOCK_T + 10 - 150));
      ctx.fillStyle = '#ffffff';
      for (let a = 0; a < Math.PI * 2; a += 0.03) {
        ctx.fillRect(Math.round(e.ex + Math.cos(a) * rad), Math.round(e.ey + Math.sin(a) * rad), 3, 3);
      }
      ctx.restore();
    }
    if (e.phase === 'death' && e.t >= KNOCK_T) {
      const k = e.t - KNOCK_T;
      if (k < 80) {
        ctx.save();
        ctx.translate(PX + 4 - k * 2.4, e.py - k * 1.2 + k * k * 0.05);
        ctx.rotate(-k * 0.28);
        ctx.translate(-(PX + 4), -e.py);
        drawFlyingPlayer(e.py);
        ctx.restore();
      }
    } else if (e.phase !== 'dead') {
      if (e.phase === 'intro' && e.t < 104) {
        drawImg(e.t < 74 ? playerFrames[0] : playerFrames[1], PX - 2, Math.round(e.py) - 9, 1);
      } else {
        drawFlyingPlayer(e.py);
      }
    }
    if (e.phase === 'intro' && e.t >= 100 && e.t < 150) {
      const r = (e.t - 100) * 0.8;
      ctx.save();
      ctx.globalAlpha = 1 - (e.t - 100) / 50;
      ctx.fillStyle = '#5ff0ff';
      for (let a = 0; a < Math.PI * 2; a += 0.15) ctx.fillRect(Math.round(PX + 4 + Math.cos(a) * r), Math.round(e.py + Math.sin(a) * r), 2, 2);
      ctx.restore();
    }

    for (const p of e.parts) {
      ctx.globalAlpha = Math.min(1, p.life / 12);
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (e.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, e.flash / (e.phase === 'death' ? 40 : 10));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    drawAngelEnergy();

    if (e.phase === 'intro') {
      const t = e.t;
      if (t >= 110 && t < 160) drawText('THE SKY GEM GRANTS YOU FLIGHT!', W / 2, 30, 8, '#5ff0ff', 'center');
      if (t >= 160 && t < 205) drawText('W / S  -  FLY UP AND DOWN', W / 2, 30, 8, '#ffffff', 'center');
      if (t >= 195) drawText('SURVIVE!', W / 2, 60, 16, '#ffe14d', 'center');
    } else if (e.phase === 'tired') {
      drawText('THE ANGEL IS GETTING TIRED...', W / 2, 30, 8, '#ffe14d', 'center');
    } else if (e.phase === 'death' && e.t > 190) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (e.t - 190) / 30);
      drawText('THE LIGHT OF GODS HAS FALLEN.', W / 2, H / 2 - 4, 8, '#ffe14d', 'center');
      ctx.restore();
    }
  }

  function renderEndScreen() {
    const t = eye.t;
    ctx.fillStyle = '#0c0a1e';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      if ((tick + i * 19) % 80 < 20) continue;
      ctx.fillStyle = i % 3 ? '#ffffff' : '#ffe14d';
      ctx.fillRect((i * 97 + 31) % W, (i * 53 + 11) % H, 1, 1);
    }
    for (let i = 0; i < 6; i++) {
      const ph = (tick + i * 41) % 90;
      if (ph < 24) sparkle(30 + ((i * 131) % (W - 60)), 30 + ((i * 71) % 150), ph < 12 ? 1 : 2, '#fff3a8');
    }
    ctx.save();
    ctx.globalAlpha = Math.min(1, t / 60);
    drawText('POWERLAND', W / 2, 50, 16, '#5ff0ff', 'center');
    drawText('NEW UPDATES', W / 2, 92, 16, '#ffe14d', 'center');
    drawText('COMING SOON!', W / 2, 116, 16, '#ffe14d', 'center');
    ctx.restore();
    if (t > 60) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (t - 60) / 60);
      drawText('BY: LEO', W / 2, 142, 8, '#ff9a2e', 'center');
      ctx.restore();
    }
    if (t > 90) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (t - 90) / 60);
      drawText('THANKS FOR PLAYING!', W / 2, 162, 8, '#ffffff', 'center');
      ctx.restore();
    }
    const by = Math.round(186 + Math.sin(tick * 0.08) * 3);
    drawImg(playerFrames[1], W / 2 - 6, by - 9, 1);
    if (run.mode === 'speedrun' && run.done) {
      drawText('YOUR TIME: ' + fmtTime(run.finalFrames), W / 2, 10, 8, '#5ff0ff', 'center');
      if (run.rank) drawText(`RANK #${run.rank} ON THE LEADERBOARD`, W / 2, 24, 8, '#ffe14d', 'center');
    }
    if (t > 150 && Math.floor(tick / 30) % 2 === 0) {
      drawText('ENTER: BACK TO THE MENU', W / 2, 204, 8, '#8a86b0', 'center');
    }
  }

  // ---------- Main castle maze ----------
  const MZ_CW = 21, MZ_CH = 12, MZ_T = 16;
  const MZ_W = MZ_CW * 2 + 1, MZ_H = MZ_CH * 2 + 1;
  const mazeGrid = (() => {
    const r = rng(2024);
    const g = [];
    for (let y = 0; y < MZ_H; y++) g.push(new Array(MZ_W).fill(1));
    const seen = new Set(['0,0']);
    const stack = [[0, 0]];
    g[1][1] = 0;
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .map(([dx, dy]) => [cx + dx, cy + dy, dx, dy])
        .filter(([x, y]) => x >= 0 && y >= 0 && x < MZ_CW && y < MZ_CH && !seen.has(x + ',' + y));
      if (!nb.length) {
        stack.pop();
        continue;
      }
      const [nx, ny, dx, dy] = nb[Math.floor(r() * nb.length)];
      g[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = 0;
      g[ny * 2 + 1][nx * 2 + 1] = 0;
      seen.add(nx + ',' + ny);
      stack.push([nx, ny]);
    }
    return g;
  })();
  const mazePath = (() => {
    const start = [1, 1], end = [MZ_W - 2, MZ_H - 2];
    const prev = new Map([[start.join(), null]]);
    const q = [start];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === end[0] && y === end[1]) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = x + dx + ',' + (y + dy);
        if (mazeGrid[y + dy][x + dx] === 0 && !prev.has(k)) {
          prev.set(k, [x, y]);
          q.push([x + dx, y + dy]);
        }
      }
    }
    const path = [];
    for (let c = end; c; c = prev.get(c.join())) path.unshift(c);
    return path;
  })();
  const MAZE_FOES = [
    { id: 'redKid', frames: npcFrames, speaker: 'RED KID', line: 'YOU AGAIN, BLUE?! REMATCH!' },
    { id: 'monkey', frames: monkeyFrames, speaker: 'MONKEY', line: 'OOH OOH! MONKEY WANTS REVENGE!' },
    { id: 'angel', frames: angelFrames, speaker: 'ANGEL', line: 'THE CASTLE WILL BE YOUR TRIAL, MORTAL!' },
    { id: 'skyBird', frames: birdFrames, speaker: 'SKY BIRD', line: 'SQUAWK! ROUND TWO!' },
    { id: 'lightGodsMaze', frames: lightFrames, speaker: 'LIGHT OF GODS', line: 'THE LIGHT RETURNS... FOR YOU.' },
    { id: 'knight', frames: knightFrames, speaker: 'KNIGHT', line: 'MY BLADE IS MENDED. EN GARDE!' },
  ];
  const ARCHER_LINES = [
    'SO, {NAME}... YOU MADE IT THROUGH THE MAZE.',
    'I AM THE ARCHER, KEEPER OF THE CASTLE.',
    'MY ARROWS NEVER MISS THEIR MARK.',
    'LET THE SKY BURN WITH FIRE!',
  ];
  const ARCHER_WIN_LINES = [
    'MY ARROWS... ALL SPENT...',
    'YOU ARE THE TRUE HERO OF POWERLAND.',
  ];
  const tileCenter = ([tx, ty]) => [tx * MZ_T + MZ_T / 2, ty * MZ_T + MZ_T / 2];
  const MAZE_END = mazePath[mazePath.length - 1];
  const maze = {
    px: 0, py: 0, face: 1, up: false, walk: 0, cx: 0, cy: 0, leaving: false, check: [1, 1],
    foes: MAZE_FOES.map((f, i) => ({ ...f, tile: mazePath[Math.floor((mazePath.length * (i + 1)) / 8)], state: 'idle', t: 0 })),
    archer: { state: 'idle' },
  };

  function mazeSpawnAt(tile) {
    [maze.px, maze.py] = tileCenter(tile);
    maze.face = 1;
    maze.up = false;
    mazeCam(true);
  }

  function enterMaze() {
    game.mode = 'maze';
    maze.leaving = false;
    maze.check = [1, 1];
    for (const f of maze.foes) if (f.state === 'talk') f.state = 'idle';
    if (maze.archer.state === 'talk') maze.archer.state = 'idle';
    mazeSpawnAt([1, 1]);
    showTitle('THE MAIN CASTLE', '- THE MAZE -');
  }

  function mazeCam(snap) {
    const tx = clamp(maze.px - W / 2, 0, MZ_W * MZ_T - W);
    const ty = clamp(maze.py - H / 2, 0, MZ_H * MZ_T - H);
    maze.cx = snap ? tx : maze.cx + (tx - maze.cx) * 0.2;
    maze.cy = snap ? ty : maze.cy + (ty - maze.cy) * 0.2;
  }

  const mazeWall = (tx, ty) => tx < 0 || ty < 0 || tx >= MZ_W || ty >= MZ_H || mazeGrid[ty][tx] === 1;
  function mazeBlocked(x, y) {
    for (const [ox, oy] of [[-4, -3], [3, -3], [-4, 3], [3, 3]]) {
      if (mazeWall(Math.floor((x + ox) / MZ_T), Math.floor((y + oy) / MZ_T))) return true;
    }
    return false;
  }

  function updateMaze() {
    updateDialog();
    const locked = dialog.active || fade.dir !== 0 || inv.open || maze.leaving;
    const h = locked ? 0 : (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
    const v = locked ? 0 : (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);
    const sp = h && v ? 1.1 : 1.5;
    if (h && !mazeBlocked(maze.px + h * sp, maze.py)) maze.px += h * sp;
    if (v && !mazeBlocked(maze.px, maze.py + v * sp)) maze.py += v * sp;
    if (h) maze.face = h;
    if (h || v) {
      maze.up = v < 0 && !h;
      const prevWalk = maze.walk;
      maze.walk += 0.15;
      if (Math.floor(maze.walk / 1.6) !== Math.floor(prevWalk / 1.6)) sfx('step');
    } else {
      maze.walk = 0;
    }
    mazeCam(false);

    const canTrigger = !dialog.active && fade.dir === 0 && !inv.open;
    for (const f of maze.foes) {
      f.t++;
      if (f.state === 'poof' && f.t > 30) f.state = 'gone';
      if (f.state !== 'idle' || !canTrigger) continue;
      const [fx, fy] = tileCenter(f.tile);
      if (Math.hypot(maze.px - fx, maze.py - fy) < 15) {
        f.state = 'talk';
        startDialog([f.line], () => startBattleTransition(f.id, () => {
          f.state = 'poof';
          f.t = 0;
          maze.check = f.tile;
          sfx('chime');
        }, () => {
          f.state = 'idle';
          mazeSpawnAt(maze.check);
        }, 'maze'), f.speaker);
      }
    }
    const a = maze.archer;
    const [ax, ay] = tileCenter(MAZE_END);
    if (a.state === 'idle' && canTrigger && Math.hypot(maze.px - ax, maze.py - ay) < 34) {
      a.state = 'talk';
      sfx('drawBow');
      startDialog(ARCHER_LINES, () => startBattleTransition('archer', winArcher, () => {
        a.state = 'idle';
        mazeSpawnAt(maze.check);
      }, 'maze'), 'ARCHER');
    }
  }

  function winArcher() {
    maze.archer.state = 'beaten';
    startDialog(ARCHER_WIN_LINES, () => {
      maze.archer.state = 'gone';
      maze.leaving = true;
      sfx('gateOpen');
      fadeThen(enterKingRoom);
    }, 'ARCHER');
  }

  // ---------- King's room ----------
  const KR_JOKER_X = 236;
  const KR_THRONE_X = 340;
  const joker = { x: KR_JOKER_X, state: 'idle', t: 0, vx: 0, vy: 0, y: 0, spin: 0 };
  const kingRoom = { leaving: false, rumble: 0 };
  const JOKER_LINES = [
    'HEE HEE HEE! WELCOME TO THE KING\'S ROOM!',
    'THE KING? OH, HE\'S... OUT TO LUNCH! HA HA!',
    'I AM THE JOKER! AND YOU MUST BE {NAME}!',
    'LET\'S PLAY A LITTLE GAME... HONK HONK!',
  ];
  const JOKER_WIN_LINES = [
    'HA... HA... OUCH. THAT WASN\'T FUNNY.',
    'FINE! THE JOKE IS ON ME! HONK...',
  ];
  const KR_DOOR_X = 262;
  const kingNpc = { state: 'none', x: KR_DOOR_X, t: 0, door: 0 };
  const KING_MUSE_LINES = ['AHH... WHAT A LONG DAY OF RULING...', 'JOKER! CAN YOU GIVE ME A SHOW.......'];
  const KING_LINES = [
    '...',
    'WAIT. YOU ARE NOT THE JOKER... {NAME}?!',
    'WHO LET YOU IN HERE?!',
    "NOBODY CAN ENTER THE KING'S ROOM!",
    'GUARDS! ...NO GUARDS? FINE.',
    'THEN I WILL DEAL WITH YOU MYSELF!',
  ];
  const KING_AGAIN_LINES = ['YOU AGAIN?!', 'I SAID YOU CANNOT ENTER MY ROOM!'];
  const KING_WIN_LINES = ['NO... MY CROWN... MY THRONE...', 'FINE! YOU MAY STAY... JUST THIS ONCE.'];
  const kingCutscene = () => ['door', 'walk', 'sit', 'notice'].includes(kingNpc.state);

  function fightKing() {
    startBattleTransition('king', winKing, () => {
      kingNpc.state = 'seated';
      enterKingRoom();
    }, 'king');
  }

  function winKing() {
    kingNpc.state = 'beaten';
    startDialog(KING_WIN_LINES, () => {
      kingRoom.leaving = true;
      kingRoom.rumble = 1;
    }, 'KING');
  }

  const OMEN_LINES = ['> INCOMING TRANSMISSION...', '', 'THEY ARE COMING FOR YOU.'];
  const omen = { t: 0 };
  const omenText = () => OMEN_LINES.join('\n');

  function updateRumble() {
    const r = ++kingRoom.rumble;
    if (r % 40 === 2) sfx('rumble');
    if (r === 150) sfx('crash');
    if (r >= 190) {
      kingRoom.rumble = 0;
      game.mode = 'omen';
      omen.t = 0;
    }
  }

  function updateOmen() {
    const o = omen;
    o.t++;
    const typed = o.t - 60;
    const text = omenText();
    if (typed > 0 && typed % 3 === 0 && typed / 3 <= text.length) {
      const ch = text[typed / 3 - 1];
      if (ch && ch !== ' ' && ch !== '\n') sfx('beep');
    }
    const typedEnd = 60 + text.length * 3;
    if (o.t === typedEnd + 10) sfx('glitch');
    const b = o.t - omenBeamStart();
    if (b === 0) sfx('glitch');
    if (b === 40) sfx('beamDown');
    if (b === 110) sfx('liftOff');
    if (b > 40 && b % 50 === 0) sfx('digital');
    if (b === 290) {
      finishRun();
      fadeThen(() => {
        game.mode = 'eye';
        eye.phase = 'end';
        eye.t = 0;
      });
    }
  }

  const omenBeamStart = () => 60 + omenText().length * 3 + 200;

  function renderOmenBeam(b) {
    const cx = W / 2, groundY = 170;
    const beam = clamp((b - 40) / 30, 0, 1);
    const lift = b > 110 ? Math.pow((b - 110) / 150, 1.6) * 220 : 0;
    const py = groundY - 36 - lift + (b > 110 ? Math.sin(b * 0.08) * 2 : 0);
    if (beam > 0) {
      ctx.save();
      const bw = 14 + beam * 26 + Math.sin(b * 0.2) * 2;
      ctx.globalAlpha = 0.18 * beam;
      ctx.fillStyle = '#3ec8ff';
      ctx.beginPath();
      ctx.moveTo(cx - bw * 0.5, 0);
      ctx.lineTo(cx + bw * 0.5, 0);
      ctx.lineTo(cx + bw, groundY + 4);
      ctx.lineTo(cx - bw, groundY + 4);
      ctx.fill();
      ctx.globalAlpha = 0.3 * beam;
      ctx.fillRect(Math.round(cx - bw * 0.3), 0, Math.round(bw * 0.6), groundY + 4);
      ctx.globalAlpha = 0.5 * beam;
      ctx.fillStyle = '#bff0ff';
      ctx.fillRect(Math.round(cx - 3), 0, 6, groundY + 4);
      ctx.globalAlpha = 0.3 * beam;
      ctx.fillStyle = '#3ec8ff';
      ctx.beginPath();
      ctx.ellipse(cx, groundY + 2, bw + 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = beam;
      for (let i = 0; i < 26; i++) {
        const sp = 0.6 + (i % 5) * 0.25;
        const yy = groundY - ((b * sp * 2 + i * 37) % (groundY + 10));
        const xx = cx + Math.sin(i * 1.7 + b * 0.03) * bw * 0.8;
        ctx.fillStyle = i % 3 ? '#3ec8ff' : '#bff0ff';
        const s = i % 4 === 0 ? 3 : 2;
        ctx.fillRect(Math.round(xx), Math.round(yy), s, s);
      }
      ctx.globalAlpha = 0.12 * beam;
      ctx.fillStyle = '#bff0ff';
      for (let y = (b * 2) % 6; y < groundY; y += 6) ctx.fillRect(Math.round(cx - bw), Math.round(y), Math.round(bw * 2), 1);
      ctx.restore();
    }
    ctx.fillStyle = `rgba(0,0,0,${0.4 * clamp(1 - lift / 40, 0, 1)})`;
    ctx.fillRect(cx - 10, groundY - 1, 20, 2);
    const frame = b > 110 ? playerFrames[1] : playerFrames[0];
    drawImg(frame, cx - 12, py, 1, 2);
    if (beam > 0) {
      ctx.save();
      ctx.globalAlpha = beam * (0.35 + 0.25 * Math.sin(b * 0.3));
      drawImg(tinted(frame, '#7fe0ff'), cx - 12, py, 1, 2);
      ctx.restore();
    }
    if (b > 110 && b % 6 < 3) {
      ctx.fillStyle = '#bff0ff';
      ctx.fillRect(Math.round(cx - 14 + Math.random() * 28), Math.round(py + Math.random() * 36), 4, 1);
    }
    if (b < 20) {
      ctx.fillStyle = `rgba(0,0,0,${1 - b / 20})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function renderOmen() {
    const o = omen;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    if (o.t < 30) return;
    const beamT = o.t - omenBeamStart();
    if (beamT >= 0) {
      renderOmenBeam(beamT);
      return;
    }
    const open = clamp((o.t - 30) / 20, 0, 1) * clamp(-beamT / 16, 0, 1);
    const bw = 280, bh = 74;
    const bx = (W - bw) / 2, by = (H - bh) / 2;
    const h = Math.max(2, Math.round(bh * open));
    const y = Math.round(H / 2 - h / 2);
    const text = omenText();
    const done = o.t > 60 + text.length * 3 + 10;
    const glitch = done && o.t % 47 < 3;
    const gx = glitch ? Math.round((Math.random() - 0.5) * 8) : 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx - 2 + gx, y - 2, bw + 4, h + 4);
    ctx.fillStyle = '#000000';
    ctx.fillRect(bx + gx, y, bw, h);
    ctx.fillStyle = '#ffffff';
    for (const [cx, cy] of [[bx + 3, y + 3], [bx + bw - 6, y + 3], [bx + 3, y + h - 6], [bx + bw - 6, y + h - 6]]) {
      if (h > 10) ctx.fillRect(cx + gx, cy, 3, 3);
    }
    if (open < 1) return;
    const n = clamp(Math.floor((o.t - 60) / 3), 0, text.length);
    const lines = text.slice(0, n).split('\n');
    lines.forEach((line, i) => {
      const big = i === 2;
      drawText(line, W / 2 + gx, by + 14 + i * 16, 8, big ? '#ffffff' : '#bfbfbf', 'center', null);
    });
    if (Math.floor(o.t / 20) % 2 === 0) {
      const last = lines[lines.length - 1];
      ctx.font = `8px ${FONT}`;
      const lw = ctx.measureText(last).width;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(W / 2 + lw / 2 + 2 + gx), by + 14 + (lines.length - 1) * 16, 6, 8);
    }
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#ffffff';
    for (let sy = (o.t % 4); sy < H; sy += 4) ctx.fillRect(0, sy, W, 1);
    ctx.restore();
    if (glitch) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) ctx.fillRect(0, Math.round(Math.random() * H), W, 1);
    }
  }

  function drawRumbleDebris() {
    const r = kingRoom.rumble;
    for (let i = 0; i < 24; i++) {
      const start = (i * 23) % 140;
      const p = (r - start) / 40;
      if (p < 0 || p > 1) continue;
      const x = (i * 71) % W;
      const y = 16 + p * p * (CASTLE_FLOOR - 16);
      ctx.fillStyle = i % 3 ? '#8a86a0' : '#5e5a76';
      ctx.fillRect(Math.round(x), Math.round(y), i % 2 ? 3 : 2, i % 2 ? 3 : 2);
    }
    if (r > 150) {
      ctx.fillStyle = `rgba(0,0,0,${clamp((r - 150) / 40, 0, 1)})`;
      ctx.fillRect(-10, -10, W + 20, H + 20);
    }
  }

  function updateKingNpc() {
    const k = kingNpc;
    k.t++;
    if (k.state === 'door') {
      k.door = Math.min(1, k.door + 0.02);
      if (k.t === 1) sfx('gateOpen');
      if (k.t >= 70) {
        k.state = 'walk';
        k.t = 0;
      }
    } else if (k.state === 'walk') {
      k.x += 0.35;
      if (k.x > KR_DOOR_X + 30) k.door = Math.max(0, k.door - 0.02);
      if (k.t % 24 === 0) sfx('step');
      if (k.x >= KR_THRONE_X) {
        k.x = KR_THRONE_X;
        k.state = 'sit';
        k.t = 0;
        sfx('land');
      }
    } else if (k.state === 'sit' && k.t === 40) {
      startDialog(KING_MUSE_LINES, () => {
        k.state = 'notice';
        k.t = 0;
        sfx('spot');
      }, 'KING');
    } else if (k.state === 'notice' && k.t === 60) {
      k.state = 'talk';
      startDialog(KING_LINES, fightKing, 'KING');
    } else if (
      k.state === 'seated' && !dialog.active && fade.dir === 0 && !inv.open && player.x > KR_THRONE_X - 120
    ) {
      k.state = 'talk';
      player.vx = 0;
      startDialog(KING_AGAIN_LINES, fightKing, 'KING');
    }
  }

  function enterKingRoom() {
    game.mode = 'king';
    kingRoom.leaving = false;
    kingRoom.rumble = 0;
    cam = 0;
    camY = 0;
    if (joker.state === 'talk') joker.state = 'idle';
    if (kingNpc.state === 'talk') kingNpc.state = 'seated';
    Object.assign(player, { x: 24, y: CASTLE_FLOOR - player.h, vx: 0, vy: 0, face: 1, onGround: true, walk: 0 });
    showTitle("THE KING'S ROOM", '- WORLD 3 -');
  }

  function updateKing() {
    updateDialog();
    if (kingRoom.rumble > 0) updateRumble();
    const locked = dialog.active || fade.dir !== 0 || inv.open || kingRoom.leaving || kingCutscene();
    const left = !locked && (keys['a'] || keys['arrowleft']);
    const right = !locked && (keys['d'] || keys['arrowright']);
    const target = ((right ? 1 : 0) - (left ? 1 : 0)) * 1.6;
    player.vx += (target - player.vx) * 0.3;
    if (Math.abs(player.vx) < 0.05) player.vx = 0;
    if (target !== 0) player.face = Math.sign(target);
    player.coyote = player.onGround ? 6 : player.coyote - 1;
    if (player.jumpBuf > 0) player.jumpBuf--;
    if (!locked && player.jumpBuf > 0 && player.coyote > 0) {
      player.vy = -5.4;
      player.coyote = 0;
      player.jumpBuf = 0;
      sfx('jump');
    }
    if (!jumpHeld() && player.vy < -2) player.vy *= 0.8;
    player.vy = Math.min(player.vy + 0.28, 6);
    player.x = clamp(player.x + player.vx, 4, kingNpc.state === 'none' ? W - 60 : KR_THRONE_X - 70);
    updateKingNpc();
    const jokerHere = joker.state === 'idle' || joker.state === 'talk' || joker.state === 'beaten';
    const front = player.x < joker.x;
    if (jokerHere && front) player.x = Math.min(player.x, joker.x - player.w - 4);
    const wasGround = player.onGround;
    player.y += player.vy;
    player.onGround = false;
    if (player.y + player.h >= CASTLE_FLOOR) {
      player.y = CASTLE_FLOOR - player.h;
      player.vy = 0;
      player.onGround = true;
    }
    if (player.onGround && !wasGround) sfx('land');
    if (player.onGround && Math.abs(player.vx) > 0.3) {
      const prevWalk = player.walk;
      player.walk += Math.abs(player.vx) * 0.12;
      if (Math.floor(player.walk / 1.6) !== Math.floor(prevWalk / 1.6)) sfx('step');
    } else {
      player.walk = 0;
    }

    joker.t++;
    if (joker.state === 'idle' && joker.t % 90 === 0) sfx('honk');
    if (
      joker.state === 'idle' && !dialog.active && fade.dir === 0 && !inv.open && front &&
      joker.x - (player.x + 4) < 80
    ) {
      joker.state = 'talk';
      player.vx = 0;
      sfx('laugh');
      startDialog(JOKER_LINES, () => startBattleTransition('joker', winJoker, () => {
        joker.state = 'idle';
        enterKingRoom();
      }, 'king'), 'JOKER');
    }
    if (joker.state === 'leaving') {
      joker.x += joker.vx;
      joker.y += joker.vy;
      joker.vy += 0.25;
      joker.spin += 0.3;
      if (joker.y > 0 && joker.vy > 0) {
        joker.y = 0;
        joker.vy = -5;
        sfx('boing');
      }
      if (joker.x > W + 30) {
        joker.state = 'gone';
        Object.assign(kingNpc, { state: 'door', x: KR_DOOR_X, t: 0, door: 0 });
        player.vx = 0;
        player.face = 1;
      }
    }
  }

  function winJoker() {
    joker.state = 'beaten';
    startDialog(JOKER_WIN_LINES, () => {
      joker.state = 'leaving';
      joker.vx = 2.2;
      joker.vy = -5;
      joker.y = 0;
      sfx('honk');
    }, 'JOKER');
  }

  function drawKingDoor(fy) {
    const x = KR_DOOR_X - 16, top = fy - 50, w = 32, h = 50;
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x - 4, top - 6, w + 8, h + 6);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(x - 3, top - 5, w + 6, 3);
    ctx.fillRect(x - 3, top - 5, 3, h + 5);
    ctx.fillRect(x + w, top - 5, 3, h + 5);
    ctx.fillStyle = '#0c0814';
    ctx.fillRect(x, top, w, h);
    const ow = Math.round(w * (1 - kingNpc.door * 0.85));
    ctx.fillStyle = '#5b3a1c';
    ctx.fillRect(x, top, ow, h);
    ctx.fillStyle = '#7a5028';
    for (let i = 0; i < ow - 2; i += 6) ctx.fillRect(x + 1 + i, top + 1, 4, h - 2);
    ctx.fillStyle = '#e8c547';
    if (ow > 6) ctx.fillRect(x + ow - 5, top + h / 2, 2, 3);
    blob(KR_DOOR_X, top - 10, 4, '#e8c547');
    blob(KR_DOOR_X, top - 10, 2, '#c2202e');
  }

  function drawJuggle(cx, top) {
    for (let i = 0; i < 3; i++) {
      const p = ((tick * 0.04 + i / 3) % 1);
      const x = cx + Math.cos(p * Math.PI * 2) * 10;
      const y = top - Math.abs(Math.sin(p * Math.PI * 2)) * 22;
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
      ctx.fillStyle = ['#ff3e6c', '#3ec8ff', '#ffe14d'][i];
      ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
    }
  }

  function renderKing() {
    const fy = CASTLE_FLOOR;
    ctx.fillStyle = '#2a1840';
    ctx.fillRect(0, 0, W, fy);
    for (let y = 20; y < fy; y += 16) {
      for (let x = (y / 16) % 2 ? 8 : 0; x < W; x += 16) {
        ctx.fillStyle = '#34204e';
        ctx.fillRect(x + 6, y + 2, 4, 4);
        ctx.fillStyle = '#e8c547';
        ctx.fillRect(x + 7, y + 3, 2, 2);
      }
    }
    ctx.fillStyle = '#1c1028';
    ctx.fillRect(0, 0, W, 16);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(0, 16, W, 2);
    ctx.fillRect(0, 40, W, 1);
    const savedCam = cam;
    cam = 0;
    drawCastleWindow(110);
    for (const bx of [40, 190, 350]) drawCastleBanner(bx, 46, 74, '#5b2a86', '#e8c547');
    drawCastlePillar(12);
    drawCastlePillar(W - 12);
    drawTorch(160, 112);
    drawTorch(222, 112);
    drawChandelier(192);
    cam = savedCam;

    ctx.fillStyle = '#3a2a4a';
    ctx.fillRect(0, fy, W, H - fy);
    for (let x = 0; x < W; x += 16) {
      for (let row = 0; row < 4; row++) {
        ctx.fillStyle = (x / 16 + row) % 2 ? '#4a3a5e' : '#3e2f52';
        ctx.fillRect(x, fy + row * 8, 16, 8);
      }
    }
    ctx.fillStyle = '#7a1520';
    ctx.fillRect(0, fy + 1, KR_THRONE_X - 20, 12);
    ctx.fillStyle = '#9c1f2b';
    ctx.fillRect(0, fy + 1, KR_THRONE_X - 20, 10);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(0, fy + 2, KR_THRONE_X - 20, 1);
    ctx.fillRect(0, fy + 9, KR_THRONE_X - 20, 1);

    const tx = KR_THRONE_X;
    ctx.fillStyle = '#6b5a30';
    ctx.fillRect(tx - 50, fy - 6, 100, 6);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(tx - 50, fy - 6, 100, 1);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(tx - 23, fy - 96, 46, 92);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(tx - 22, fy - 95, 44, 90);
    ctx.fillStyle = '#b8901a';
    ctx.fillRect(tx - 22, fy - 95, 4, 90);
    ctx.fillRect(tx + 18, fy - 95, 4, 90);
    ctx.fillStyle = '#5b2a86';
    ctx.fillRect(tx - 15, fy - 86, 30, 56);
    ctx.fillStyle = '#7a3fc8';
    ctx.fillRect(tx - 17, fy - 34, 34, 10);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = '#e8c547';
      ctx.fillRect(tx - 20 + i * 9, fy - 104 - (i % 2 ? 0 : 6), 5, 10 + (i % 2 ? 0 : 6));
      ctx.fillStyle = i % 2 ? '#d8322e' : '#3ec8ff';
      ctx.fillRect(tx - 19 + i * 9, fy - 106 - (i % 2 ? 0 : 6), 3, 3);
    }
    drawKingDoor(fy);
    const k = kingNpc;
    const seated = ['sit', 'notice', 'talk', 'seated', 'beaten'].includes(k.state);
    if (k.state === 'none') drawText('EMPTY...', tx, fy - 64, 8, '#b07cff', 'center', '#1a1420');
    if (seated) {
      const bob = Math.round(Math.sin(tick * 0.05));
      drawImg(kingWalkFrames[0], tx - 11, fy - 57 + bob, -1, 2);
      if (kingRoom.rumble > 0 && kingRoom.rumble < 150) {
        drawText('?!', tx + Math.round(Math.sin(tick * 0.8) * 2), fy - 76, 16, '#ffe14d', 'center', '#1a1420');
      } else if (k.state === 'notice' || (k.state === 'seated' && tick % 60 < 40)) {
        drawText('!', tx, fy - 74 - (k.state === 'notice' ? Math.max(0, 8 - k.t) : 0), 16, k.state === 'notice' ? '#ff3e6c' : '#ffe14d', 'center', '#1a1420');
      }
    } else if (k.state === 'walk' || (k.state === 'door' && k.door > 0.6)) {
      const f = k.state === 'walk' ? kingWalkFrames[Math.floor(k.t / 14) % 2] : kingWalkFrames[0];
      const bob = k.state === 'walk' ? Math.floor(k.t / 14) % 2 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(Math.round(k.x) - 9, fy - 1, 18, 2);
      drawImg(f, k.x - 11, fy - 32 - bob, 1, 2);
    }

    if (joker.state !== 'gone') {
      const cx = joker.x + 7;
      if (joker.state === 'leaving') {
        ctx.save();
        ctx.translate(Math.round(cx), Math.round(fy + joker.y - 11));
        ctx.rotate(joker.spin);
        ctx.drawImage(jokerFrames[1], -7, -11);
        ctx.restore();
      } else {
        drawGoofy(jokerFrames[joker.state === 'talk' && Math.floor(tick / 8) % 2 ? 1 : tick % 120 < 16 ? 1 : 0], cx, fy, 1, player.x < joker.x ? -1 : 1, 0.6);
        if (joker.state === 'idle') {
          drawJuggle(cx, fy - 30);
          if (joker.t % 60 < 40) drawText('!', cx, fy - 62, 8, '#ffe14d', 'center');
        }
      }
    }

    let frame = 0;
    if (!player.onGround) frame = 1;
    else if (player.walk > 0) frame = walkFrame(player.walk);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(Math.round(player.x), Math.round(player.y + player.h) - 1, player.w, 1);
    drawImg(playerFrames[frame], player.x - 2, player.y, player.face);

    drawDialog();
    drawTitle();
    drawToast();
    if (canOpenInventory() || inv.open) drawBagButton();
    if (inv.open) drawInventory();
  }

  function drawMazeEntity(img, x, y, face, bang) {
    const sx = Math.round(x - maze.cx), sy = Math.round(y - maze.cy);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(sx - 5, sy + 5, 10, 2);
    drawImg(img, sx - img.width / 2, sy + 6 - img.height, face);
    if (bang && tick % 60 < 40) drawText('!', sx, sy - img.height - 4, 8, '#ffe14d', 'center');
  }

  function renderMaze() {
    ctx.fillStyle = '#14111c';
    ctx.fillRect(0, 0, W, H);
    const cx = Math.round(maze.cx), cy = Math.round(maze.cy);
    const x0 = Math.floor(cx / MZ_T), y0 = Math.floor(cy / MZ_T);
    const torches = [];
    for (let ty = y0; ty <= y0 + Math.ceil(H / MZ_T) + 1; ty++) {
      for (let tx = x0; tx <= x0 + Math.ceil(W / MZ_T) + 1; tx++) {
        if (ty >= MZ_H || tx >= MZ_W) continue;
        const sx = tx * MZ_T - cx, sy = ty * MZ_T - cy;
        if (mazeWall(tx, ty)) {
          const front = !mazeWall(tx, ty + 1);
          ctx.fillStyle = '#9894b0';
          ctx.fillRect(sx, sy, MZ_T, MZ_T);
          ctx.fillStyle = '#b4b0c8';
          ctx.fillRect(sx, sy, MZ_T, 1);
          ctx.fillStyle = '#7d7892';
          if (!mazeWall(tx - 1, ty)) ctx.fillRect(sx, sy, 1, MZ_T);
          if (!mazeWall(tx + 1, ty)) ctx.fillRect(sx + MZ_T - 1, sy, 1, MZ_T);
          if (!mazeWall(tx, ty - 1)) {
            ctx.fillStyle = '#1a1420';
            ctx.fillRect(sx, sy, MZ_T, 1);
          }
          if (front) {
            ctx.fillStyle = '#4a4660';
            ctx.fillRect(sx, sy + 8, MZ_T, 8);
            ctx.fillStyle = '#36324a';
            ctx.fillRect(sx, sy + 8, MZ_T, 1);
            ctx.fillRect(sx, sy + 12, MZ_T, 1);
            ctx.fillRect(sx + ((tx % 2) ? 4 : 10), sy + 8, 1, 4);
            ctx.fillRect(sx + ((tx % 2) ? 10 : 4), sy + 12, 1, 4);
            if ((tx * 7 + ty * 13) % 11 === 0) torches.push([sx + 8, sy + 10]);
          }
        } else {
          const nearEnd = Math.abs(tx - MAZE_END[0]) <= 1 && Math.abs(ty - MAZE_END[1]) <= 2;
          ctx.fillStyle = nearEnd ? '#9c1f2b' : (tx + ty) % 2 ? '#2e2938' : '#2a2533';
          ctx.fillRect(sx, sy, MZ_T, MZ_T);
          if (nearEnd) {
            ctx.fillStyle = '#e8c547';
            ctx.fillRect(sx, sy + 1, MZ_T, 1);
          } else {
            ctx.fillStyle = '#383244';
            ctx.fillRect(sx, sy, MZ_T, 1);
            ctx.fillRect(sx, sy, 1, MZ_T);
          }
          if (mazeWall(tx, ty - 1)) {
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(sx, sy, MZ_T, 4);
          }
        }
      }
    }
    for (const [tx, ty] of torches) {
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.05 * Math.sin(tick * 0.2 + tx);
      blob(tx, ty, 14, '#ffb347');
      ctx.restore();
      ctx.fillStyle = '#5b3a1c';
      ctx.fillRect(tx - 1, ty, 2, 5);
      ctx.fillStyle = tick % 8 < 4 ? '#ff9a2e' : '#ffe14d';
      ctx.fillRect(tx - 2, ty - 4, 4, 4);
      ctx.fillStyle = '#ffe14d';
      ctx.fillRect(tx - 1, ty - 6 + (tick % 10 < 5 ? 0 : 1), 2, 3);
    }

    const ents = [];
    for (const f of maze.foes) {
      if (f.state === 'gone') continue;
      const [fx, fy] = tileCenter(f.tile);
      if (f.state === 'poof') {
        ents.push([fy, () => {
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + f.t * 0.2;
            sparkle(Math.round(fx - maze.cx + Math.cos(a) * f.t * 0.6), Math.round(fy - 8 - maze.cy + Math.sin(a) * f.t * 0.6), 2, '#ffffff');
          }
        }]);
        continue;
      }
      const img = f.frames[f.id === 'lightGodsMaze' ? Math.floor(tick / 12) % 2 : 0];
      ents.push([fy, () => drawMazeEntity(img, fx, fy, maze.px < fx ? -1 : 1, f.state === 'idle')]);
    }
    if (maze.archer.state !== 'gone') {
      const [ax, ay] = tileCenter(MAZE_END);
      ents.push([ay, () => drawMazeEntity(archerFrames[tick % 150 < 6 ? 1 : 0], ax, ay, maze.px < ax ? -1 : 1, maze.archer.state === 'idle')]);
    }
    ents.push([maze.py, () => {
      const img = maze.up ? playerBack : playerFrames[maze.walk > 0 ? walkFrame(maze.walk) : 0];
      drawMazeEntity(img, maze.px, maze.py, maze.face, false);
    }]);
    ents.sort((p, q) => p[0] - q[0]).forEach(([, fn]) => fn());

    const px = maze.px - cx, py = maze.py - cy;
    const grad = ctx.createRadialGradient(px, py - 6, 60, px, py - 6, 220);
    grad.addColorStop(0, 'rgba(10,6,20,0)');
    grad.addColorStop(1, 'rgba(10,6,20,0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const left = maze.foes.filter((f) => f.state === 'idle' || f.state === 'talk').length;
    drawText(`FOES LEFT: ${left}`, 6, 6, 8, '#ffe14d', 'left');

    drawDialog();
    drawTitle();
    drawToast();
    if (canOpenInventory() || inv.open) drawBagButton();
    if (inv.open) drawInventory();
  }

  // ---------- Admin panel ----------
  const admin = { open: false, sel: 0, page: 'main' };
  const ADMIN_PANEL = { x: 82, y: 4, w: 220, h: 208 };

  function adminTeleport(x, y) {
    inv.open = false;
    battle = null;
    pendingBattle = null;
    game.mode = 'world';
    fade.alpha = 0;
    fade.dir = 0;
    fade.cb = null;
    if (light.state === 'descending' || light.state === 'talk') {
      light.state = 'idle';
      light.y = LIGHT_HOVER_Y;
    }
    for (const n of [npc, monkey, angel, bird, knight]) if (n.state === 'talk') n.state = 'idle';
    respawnAt(x, y);
  }
  const groundSpot = (x) => [x, groundTopAt(x + 4) - 18];

  const GEM_ORDER = ['fireGem', 'leafGem', 'swapCrystal', 'angelCrystal', 'skyGem', 'lightGem', 'knightCrystal', 'archerCrystal', 'jokerCrystal', 'kingCrystal'];
  function adminGiveGems(count) {
    for (const id of GEM_ORDER.slice(0, count)) addItem(id);
    if (inventory.includes('swapCrystal')) crystal.taken = true;
  }

  const ADMIN_OPTIONS = [
    { label: 'BEHIND RED KID', go: () => adminTeleport(...groundSpot(NPC_X + 80)) },
    { label: 'BEHIND MONKEY', go: () => { adminGiveGems(1); adminTeleport(...groundSpot(VINE_WALL.x + 40)); } },
    { label: 'BEHIND ANGEL', go: () => { adminGiveGems(3); adminTeleport(C2_START.x + 80, C2 - 18); } },
    { label: 'BEHIND SKY BIRD', go: () => { adminGiveGems(4); adminTeleport(STAIRS[0].x + 8, STAIRS[0].y - 18); } },
    {
      label: 'FINAL BOSS START',
      go: () => {
        adminGiveGems(5);
        adminTeleport(STAIR_TOP.x + 10, STAIR_TOP.y - 18);
        light.state = 'revealed';
        startEyeFight();
      },
    },
    {
      label: 'SKIP TO EXPLOSION',
      go: () => {
        adminGiveGems(5);
        adminTeleport(STAIR_TOP.x + 10, STAIR_TOP.y - 18);
        light.state = 'revealed';
        startEyeFight();
        Object.assign(eye, { phase: 'death', t: 130, py: 108, ex: 316, ey: 124, beams: [], orbs: [], dash: null, shake: 0, flash: 0 });
      },
    },
    { label: 'THE CASTLE', go: () => { adminGiveGems(6); adminTeleport(...groundSpot(SPAWN_X)); enterCastle(96); } },
    {
      label: 'BEHIND KNIGHT',
      go: () => {
        adminGiveGems(6);
        adminTeleport(...groundSpot(SPAWN_X));
        enterCastle(knight.x + 26);
        player.face = 1;
      },
    },
    {
      label: 'THE MAZE',
      go: () => {
        adminGiveGems(7);
        adminTeleport(...groundSpot(SPAWN_X));
        if (knight.state !== 'gone') knight.state = 'gone';
        enterMaze();
      },
    },
    {
      label: 'TO THE ARCHER',
      go: () => {
        adminGiveGems(7);
        adminTeleport(...groundSpot(SPAWN_X));
        knight.state = 'gone';
        enterMaze();
        for (const f of maze.foes) f.state = 'gone';
        if (maze.archer.state === 'talk') maze.archer.state = 'idle';
        maze.check = mazePath[mazePath.length - 5];
        mazeSpawnAt(maze.check);
      },
    },
    { label: "THE KING'S ROOM", go: () => adminKingRoom(24) },
    { label: 'TO THE JOKER', go: () => adminKingRoom(joker.x - 90) },
    {
      label: 'TO THE KING',
      go: () => {
        adminKingRoom(KR_THRONE_X - 140);
        adminGiveGems(9);
        joker.state = 'gone';
        kingNpc.state = 'seated';
      },
    },
    { label: 'GET ANY GEM >', stay: true, go: () => { admin.page = 'gems'; admin.sel = 0; } },
    { label: 'CLOSE', go: () => {} },
  ];

  function adminGetGem(id) {
    addItem(id);
    if (id === 'swapCrystal') crystal.taken = true;
    sfx('itemGet');
  }

  const ADMIN_GEM_OPTIONS = [
    ...GEM_ORDER.map((id) => ({
      id,
      get label() { return ITEMS[id].name + (inventory.includes(id) ? ' (HAVE)' : ''); },
      stay: true,
      go: () => adminGetGem(id),
    })),
    { label: 'GET ALL', stay: true, go: () => GEM_ORDER.forEach(adminGetGem) },
    { label: '< BACK', stay: true, go: () => { admin.page = 'main'; admin.sel = ADMIN_OPTIONS.length - 2; } },
  ];

  const adminOptions = () => (admin.page === 'gems' ? ADMIN_GEM_OPTIONS : ADMIN_OPTIONS);

  function adminKingRoom(x) {
    adminGiveGems(8);
    adminTeleport(...groundSpot(SPAWN_X));
    knight.state = 'gone';
    if (joker.state !== 'idle') Object.assign(joker, { state: 'idle', x: KR_JOKER_X, y: 0, spin: 0 });
    Object.assign(kingNpc, { state: 'none', x: KR_DOOR_X, t: 0, door: 0 });
    enterKingRoom();
    player.x = x;
  }

  const adminRowRect = (i) => ({ x: ADMIN_PANEL.x + 10, y: ADMIN_PANEL.y + 20 + i * 11, w: ADMIN_PANEL.w - 20, h: 11 });

  function adminChoose(i) {
    const o = adminOptions()[i];
    if (!o.stay) {
      admin.open = false;
      admin.page = 'main';
    }
    sfx('confirm');
    o.go();
  }

  function adminKey(k) {
    const n = adminOptions().length;
    if ((k === 'escape' || k === 'backspace') && admin.page === 'gems') {
      admin.page = 'main';
      admin.sel = ADMIN_OPTIONS.length - 2;
      sfx('back');
    } else if (k === 'escape' || k === 'tab') {
      admin.open = false;
      admin.page = 'main';
      sfx('close');
    } else if (k === 'arrowup' || k === 'w') {
      admin.sel = (admin.sel + n - 1) % n;
      sfx('cursor');
    } else if (k === 'arrowdown' || k === 's') {
      admin.sel = (admin.sel + 1) % n;
      sfx('cursor');
    } else if (k === 'enter' || k === ' ') {
      adminChoose(admin.sel);
    }
  }

  function drawAdminPanel() {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    const p = ADMIN_PANEL;
    drawPanel(p.x, p.y, p.w, p.h);
    drawText(admin.page === 'gems' ? 'GET ANY GEM' : 'ADMIN PANEL', W / 2, p.y + 10, 8, '#c2202e', 'center', null);
    adminOptions().forEach((o, i) => {
      const r = adminRowRect(i);
      const on = i === admin.sel;
      if (on) {
        ctx.fillStyle = '#3b2a1a';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      drawText((on ? '> ' : '  ') + o.label, r.x + 4, r.y + 2, 8, on ? '#ffe14d' : '#3b2a1a', 'left', null);
    });
  }

  // ---------- Coma ----------
  const coma = { t: 0 };
  const COMA_LINES = [
    [40, 210, 'THE BLAST HIT YOU...'],
    [230, 400, 'YOU FELL INTO A COMA...'],
    [420, 580, 'DAYS PASS...'],
    [600, 760, '...WAKE UP...'],
  ];
  const COMA_END = 800;

  function startComa() {
    game.mode = 'coma';
    coma.t = 0;
  }

  function comaBeatPeriod() {
    return coma.t < 420 ? 70 : coma.t < 600 ? 110 : 55;
  }

  function updateComa() {
    coma.t++;
    if (coma.t > 20 && coma.t % comaBeatPeriod() === 0) sfx('heartbeat');
    if (coma.t === COMA_END) enterCastle(null);
  }

  function renderComa() {
    const t = coma.t;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    const period = comaBeatPeriod();
    const since = t % period;
    if (since < 18) {
      ctx.save();
      ctx.globalAlpha = 0.18 * (1 - since / 18);
      ctx.fillStyle = '#8a0a14';
      ctx.fillRect(0, 0, W, 18);
      ctx.fillRect(0, H - 18, W, 18);
      ctx.fillRect(0, 0, 18, H);
      ctx.fillRect(W - 18, 0, 18, H);
      ctx.restore();
    }
    const base = H / 2 + 36;
    const spike = [0, -2, -3, 2, -16, 12, -4, 0, -1, -2, -1];
    const head = (t * 2) % (W + 60);
    for (let x = 0; x < W; x++) {
      const age = (head - x + W + 60) % (W + 60);
      if (age > 180) continue;
      const ph = (x + Math.floor(t / period) * 37) % 96;
      const dy = ph < spike.length ? spike[ph] : 0;
      ctx.globalAlpha = 1 - age / 180;
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(x, base + dy, 1, 1);
      if (dy) {
        const step = Math.sign(dy);
        for (let yy = 0; yy !== dy; yy += step) ctx.fillRect(x, base + yy, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    for (const [a, b, text] of COMA_LINES) {
      if (t < a || t > b) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (t - a) / 30, (b - t) / 30);
      drawText(text, W / 2, H / 2 - 24, 8, '#d8d8e8', 'center');
      ctx.restore();
    }
    if (t > COMA_END - 40) {
      ctx.save();
      ctx.globalAlpha = (t - (COMA_END - 40)) / 40;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  // ---------- Castle ----------
  const CASTLE_W = 1180;
  const CASTLE_FLOOR = 184;
  const CASTLE_DOOR_X = 1110;
  const CASTLE_PILLARS = [240, 430, 610, 960];
  const CASTLE_WINDOWS = [140, 335, 520];
  const CASTLE_BANNERS = [280, 390, 470, 570];
  const CASTLE_CHANDELIERS = [335, 520, 780];
  const CASTLE_STATUES = [650, 905];
  const THRONE_X = 780;
  const castleSolids = [
    { x: -40, y: CASTLE_FLOOR, w: CASTLE_W + 80, h: 40 },
    { x: 680, y: CASTLE_FLOOR - 6, w: 200, h: 6 },
    { x: 700, y: CASTLE_FLOOR - 12, w: 160, h: 12 },
  ];
  const castle = { wake: 0, awake: false, leaving: false, motes: [] };
  const knight = { x: CASTLE_DOOR_X - 70, y: CASTLE_FLOOR - 21, face: -1, t: 0, leaveT: 0, state: 'idle' };
  const knightBeaten = () => knight.state === 'leaving' || knight.state === 'gone';
  for (let i = 0; i < 40; i++) castle.motes.push({ x: Math.random() * CASTLE_W, y: 40 + Math.random() * 140, s: 0.1 + Math.random() * 0.2, ph: Math.random() * 6 });

  const brickTile = (() => {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = '#4b4763';
    g.fillRect(0, 0, 32, 16);
    g.fillStyle = '#57536f';
    g.fillRect(0, 0, 15, 1);
    g.fillRect(16, 0, 16, 1);
    g.fillRect(0, 8, 7, 1);
    g.fillRect(8, 8, 15, 1);
    g.fillRect(24, 8, 8, 1);
    g.fillStyle = '#36324a';
    g.fillRect(0, 7, 32, 1);
    g.fillRect(0, 15, 32, 1);
    g.fillRect(15, 0, 1, 7);
    g.fillRect(7, 8, 1, 7);
    g.fillRect(23, 8, 1, 7);
    g.fillStyle = '#433f5a';
    g.fillRect(5, 3, 2, 1);
    g.fillRect(20, 11, 1, 1);
    g.fillRect(27, 4, 2, 1);
    g.fillRect(11, 12, 2, 1);
    return c;
  })();

  function enterCastle(x) {
    game.mode = 'castle';
    camY = 0;
    castle.leaving = false;
    if (x === null) {
      castle.wake = 0;
      castle.awake = false;
      Object.assign(player, { x: 52, y: 150, vx: 0, vy: 0, face: 1, onGround: false });
    } else {
      castle.wake = 999;
      castle.awake = true;
      Object.assign(player, { x, y: CASTLE_FLOOR - player.h, vx: 0, vy: 0, face: -1, onGround: true });
    }
    cam = Math.round(clamp(player.x + 4 - W / 2, 0, CASTLE_W - W));
  }

  function updateCastle() {
    const c = castle;
    for (const m of c.motes) {
      m.y -= m.s;
      m.x += Math.sin(tick * 0.01 + m.ph) * 0.1;
      if (m.y < 40) m.y = 180;
    }
    updateDialog();
    if (!c.awake) {
      c.wake++;
      if (c.wake === 20) sfx('wake');
      if (c.wake === 130) {
        startDialog(['...UGH... WHERE AM I?', 'IS THIS... A CASTLE?', 'HOW DID I GET HERE...?'], () => {
          c.awake = true;
          Object.assign(player, { x: 96, y: CASTLE_FLOOR - player.h, vx: 0, vy: 0, face: 1, onGround: true });
          sfx('land');
          showTitle('THE CASTLE', '- WORLD 3 -');
          if (c.newGem) {
            c.newGem = false;
            sfx('itemGet');
            toast.text = 'YOU GOT THE LIGHT GEM!';
            toast.t = 240;
          }
        }, 'YOU');
      }
      return;
    }

    const locked = dialog.active || fade.dir !== 0 || c.leaving || inv.open;
    const left = !locked && (keys['a'] || keys['arrowleft']);
    const right = !locked && (keys['d'] || keys['arrowright']);
    const target = ((right ? 1 : 0) - (left ? 1 : 0)) * 1.6;
    player.vx += (target - player.vx) * 0.3;
    if (Math.abs(player.vx) < 0.05) player.vx = 0;
    if (target !== 0) player.face = Math.sign(target);
    player.coyote = player.onGround ? 6 : player.coyote - 1;
    if (player.jumpBuf > 0) player.jumpBuf--;
    if (!locked && player.jumpBuf > 0 && player.coyote > 0) {
      player.vy = -5.4;
      player.coyote = 0;
      player.jumpBuf = 0;
      sfx('jump');
    }
    if (!jumpHeld() && player.vy < -2) player.vy *= 0.8;
    player.vy = Math.min(player.vy + 0.28, 6);

    player.x += player.vx;
    for (const s of castleSolids) {
      if (!overlap(player, s)) continue;
      if (player.vx > 0) player.x = s.x - player.w;
      else if (player.vx < 0) player.x = s.x + s.w;
      player.vx = 0;
    }
    player.x = clamp(player.x, 4, CASTLE_W - player.w - 4);

    const wasGround = player.onGround;
    player.y += player.vy;
    player.onGround = false;
    for (const s of castleSolids) {
      if (!overlap(player, s)) continue;
      if (player.vy > 0) {
        player.y = s.y - player.h;
        player.onGround = true;
      } else {
        player.y = s.y + s.h;
      }
      player.vy = 0;
    }
    if (player.onGround && !wasGround) sfx('land');
    if (player.onGround && Math.abs(player.vx) > 0.3) {
      const prevWalk = player.walk;
      player.walk += Math.abs(player.vx) * 0.12;
      if (Math.floor(player.walk / 1.6) !== Math.floor(prevWalk / 1.6)) sfx('step');
    } else {
      player.walk = 0;
    }
    knight.t++;
    if (knight.state === 'idle' || knight.state === 'talk' || knight.state === 'beaten') {
      knight.face = player.x < knight.x ? -1 : 1;
    }
    const frontOfKnight = player.x < knight.x;
    if (!knightBeaten() && frontOfKnight) player.x = Math.min(player.x, knight.x - player.w - 2);
    if (
      knight.state === 'idle' && game.mode === 'castle' && !dialog.active && fade.dir === 0 && !inv.open &&
      frontOfKnight && knight.x + 8 - (player.x + 4) < 56
    ) {
      knight.state = 'talk';
      player.vx = 0;
      sfx('clank');
      startDialog(KNIGHT_LINES, () => startBattleTransition('knight', winKnight, loseKnight, 'castle'), 'KNIGHT');
    }
    if (knight.state === 'leaving' && ++knight.leaveT > 60) knight.state = 'gone';
    cam = Math.round(clamp(player.x + 4 - W / 2, 0, CASTLE_W - W));

    if (!c.leaving && player.x + player.w > CASTLE_DOOR_X - 16 && fade.dir === 0) {
      c.leaving = true;
      sfx('gateOpen');
      fadeThen(enterMaze);
    }
  }

  function castleArch(a, b, top, base, color, thick) {
    ctx.fillStyle = color;
    for (let x = a; x <= b; x++) {
      const p = (x - a) / (b - a);
      const y = Math.round(base - Math.sin(p * Math.PI) * (base - top));
      ctx.fillRect(x - cam, y, 1, thick);
    }
  }

  function drawCastleWindow(wx) {
    const x = wx - cam;
    if (x < -60 || x > W + 60) return;
    const top = 48, h = 84, hw = 13;
    const panes = ['#3a6fd8', '#d84a4a', '#e8c547', '#4ab06a', '#7a4ad8'];
    ctx.save();
    ctx.globalAlpha = 0.1 + Math.sin(tick * 0.02 + wx) * 0.02;
    ctx.fillStyle = '#fff3a8';
    ctx.beginPath();
    ctx.moveTo(x - hw, top + 20);
    ctx.lineTo(x + hw, top + 20);
    ctx.lineTo(x + hw + 46, CASTLE_FLOOR + 6);
    ctx.lineTo(x - hw + 18, CASTLE_FLOOR + 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    for (let y = -3; y < h + 3; y++) {
      const ry = y < hw ? Math.round(Math.sqrt(Math.max(0, hw * hw - (hw - y) * (hw - y)))) : hw;
      ctx.fillStyle = '#2a2638';
      ctx.fillRect(x - ry - 4, top + y, ry * 2 + 8, 1);
    }
    for (let y = 0; y < h; y++) {
      const ry = y < hw ? Math.round(Math.sqrt(Math.max(0, hw * hw - (hw - y) * (hw - y)))) : hw;
      ctx.fillStyle = '#8a86a0';
      ctx.fillRect(x - ry - 2, top + y, ry * 2 + 4, 1);
      for (let px = -ry; px < ry; px++) {
        const cx = Math.floor((px + hw) / 6.5), cy = Math.floor(y / 10);
        const lead = (px + hw) % 7 === 0 || y % 10 === 0;
        ctx.fillStyle = lead ? '#1c1a28' : panes[(cx * 3 + cy * 2) % panes.length];
        ctx.fillRect(x + px, top + y, 1, 1);
      }
    }
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x - 8, top + 16, 2, 30);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#6d6880';
    ctx.fillRect(x - hw - 5, top + h, hw * 2 + 10, 4);
    ctx.fillStyle = '#a5a1bb';
    ctx.fillRect(x - hw - 5, top + h, hw * 2 + 10, 1);
  }

  function drawCastlePillar(px) {
    const x = px - cam;
    if (x < -40 || x > W + 40) return;
    ctx.fillStyle = '#2a2638';
    ctx.fillRect(x - 12, 30, 24, CASTLE_FLOOR - 30);
    ctx.fillStyle = '#8a86a0';
    ctx.fillRect(x - 10, 36, 20, CASTLE_FLOOR - 48);
    ctx.fillStyle = '#6d6880';
    ctx.fillRect(x - 10, 36, 4, CASTLE_FLOOR - 48);
    ctx.fillStyle = '#a5a1bb';
    ctx.fillRect(x + 5, 36, 2, CASTLE_FLOOR - 48);
    ctx.fillStyle = '#76718c';
    for (const fx of [-3, 1]) ctx.fillRect(x + fx, 38, 1, CASTLE_FLOOR - 52);
    ctx.fillStyle = '#2a2638';
    ctx.fillRect(x - 16, 24, 32, 12);
    ctx.fillStyle = '#9b97b2';
    ctx.fillRect(x - 15, 25, 30, 4);
    ctx.fillStyle = '#7b7792';
    ctx.fillRect(x - 13, 29, 26, 6);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(x - 15, 29, 30, 1);
    ctx.fillStyle = '#2a2638';
    ctx.fillRect(x - 15, CASTLE_FLOOR - 13, 30, 13);
    ctx.fillStyle = '#9b97b2';
    ctx.fillRect(x - 14, CASTLE_FLOOR - 12, 28, 4);
    ctx.fillStyle = '#7b7792';
    ctx.fillRect(x - 13, CASTLE_FLOOR - 8, 26, 8);
    drawTorch(x, 96);
  }

  function drawTorch(x, y) {
    const fl = Math.sin(tick * 0.35 + x) * 1.5 + Math.sin(tick * 0.9 + x * 2);
    ctx.save();
    ctx.globalAlpha = 0.13 + fl * 0.01;
    blob(x, y - 6, 24, '#ffb347');
    ctx.globalAlpha = 0.18;
    blob(x, y - 6, 12, '#ffd27a');
    ctx.restore();
    ctx.fillStyle = '#1c1a28';
    ctx.fillRect(x - 4, y + 2, 8, 3);
    ctx.fillRect(x - 1, y + 5, 2, 6);
    ctx.fillStyle = '#5b3a1c';
    ctx.fillRect(x - 2, y - 2, 4, 5);
    const fh = 7 + Math.round(fl);
    ctx.fillStyle = '#e8501c';
    ctx.fillRect(x - 3, y - 2 - fh, 6, fh);
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(x - 2, y - fh, 4, fh - 2);
    ctx.fillStyle = '#fff3a8';
    ctx.fillRect(x - 1, y - fh + 3, 2, fh - 5);
  }

  function drawCastleBanner(bx, top, len, cloth, emblem) {
    const x = bx - cam;
    if (x < -30 || x > W + 30) return;
    ctx.fillStyle = '#1c1a28';
    ctx.fillRect(x - 13, top - 2, 26, 3);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(x - 12, top - 1, 24, 1);
    ctx.fillRect(x - 14, top - 2, 2, 3);
    ctx.fillRect(x + 12, top - 2, 2, 3);
    const sway = Math.round(Math.sin(tick * 0.025 + bx) * 1.2);
    for (let y = 0; y < len; y++) {
      const off = y > len * 0.6 ? sway : 0;
      const cut = y > len - 8 ? (y - (len - 8)) : 0;
      const l = x - 9 + off, w = 18;
      ctx.fillStyle = '#1c1a28';
      ctx.fillRect(l - 1, top + 1 + y, w + 2, 1);
      ctx.fillStyle = cloth;
      ctx.fillRect(l, top + 1 + y, w, 1);
      ctx.fillStyle = '#e8c547';
      ctx.fillRect(l + 1, top + 1 + y, 1, 1);
      ctx.fillRect(l + w - 2, top + 1 + y, 1, 1);
      if (cut) {
        ctx.fillStyle = '#4b4763';
        ctx.fillRect(l + 9 - cut, top + 1 + y, cut * 2, 1);
      }
    }
    const ey = top + Math.round(len * 0.38);
    blob(x, ey, 4, '#e8c547');
    blob(x, ey, 2, emblem);
    ctx.fillStyle = '#e8c547';
    for (let a = 0; a < 8; a++) ctx.fillRect(Math.round(x + Math.cos(a * 0.785) * 6), Math.round(ey + Math.sin(a * 0.785) * 6), 1, 1);
    ctx.fillRect(x - 5, ey + 9, 10, 1);
  }

  function drawChandelier(cx) {
    const x = cx - cam;
    if (x < -40 || x > W + 40) return;
    ctx.fillStyle = '#1c1a28';
    for (let y = 0; y < 26; y += 3) ctx.fillRect(x - 1, y, 2, 2);
    ctx.save();
    ctx.globalAlpha = 0.1;
    blob(x, 30, 34, '#ffd27a');
    ctx.restore();
    ctx.fillStyle = '#1c1a28';
    ctx.fillRect(x - 19, 30, 38, 4);
    ctx.fillRect(x - 3, 26, 6, 12);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(x - 18, 31, 36, 2);
    ctx.fillRect(x - 2, 27, 4, 10);
    ctx.fillStyle = '#b8901c';
    ctx.fillRect(x - 18, 32, 36, 1);
    for (const dx of [-16, -8, 0, 8, 16]) {
      ctx.fillStyle = '#f4ecd8';
      ctx.fillRect(x + dx - 1, 24, 3, 6);
      const f = Math.floor((tick + dx * 3) / 6) % 2;
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(x + dx - 1 + f, 20, 2, 4);
      ctx.fillStyle = '#fff3a8';
      ctx.fillRect(x + dx, 21, 1, 2);
    }
  }

  function drawArmorStatue(sx) {
    const x = sx - cam;
    if (x < -30 || x > W + 30) return;
    const fy = CASTLE_FLOOR;
    ctx.fillStyle = '#2a2638';
    ctx.fillRect(x - 11, fy - 12, 22, 12);
    ctx.fillStyle = '#8a86a0';
    ctx.fillRect(x - 10, fy - 11, 20, 11);
    ctx.fillStyle = '#a5a1bb';
    ctx.fillRect(x - 10, fy - 11, 20, 2);
    const top = fy - 12;
    ctx.fillStyle = '#5b3a1c';
    ctx.fillRect(x + 8, top - 62, 2, 62);
    ctx.fillStyle = '#d8dce8';
    ctx.fillRect(x + 7, top - 68, 4, 6);
    ctx.fillRect(x + 8, top - 71, 2, 3);
    ctx.fillStyle = '#1c1a28';
    ctx.fillRect(x - 6, top - 20, 12, 20);
    ctx.fillRect(x - 8, top - 40, 16, 21);
    ctx.fillRect(x - 6, top - 52, 12, 13);
    ctx.fillStyle = '#9ca0b0';
    ctx.fillRect(x - 5, top - 20, 4, 20);
    ctx.fillRect(x + 1, top - 20, 4, 20);
    ctx.fillStyle = '#b8bcc8';
    ctx.fillRect(x - 7, top - 39, 14, 19);
    ctx.fillStyle = '#d8dce8';
    ctx.fillRect(x - 5, top - 37, 3, 14);
    ctx.fillStyle = '#7a7e8e';
    ctx.fillRect(x - 7, top - 26, 14, 2);
    ctx.fillStyle = '#b8bcc8';
    ctx.fillRect(x - 5, top - 51, 10, 11);
    ctx.fillStyle = '#1c1a28';
    ctx.fillRect(x - 4, top - 46, 8, 2);
    ctx.fillStyle = '#d8dce8';
    ctx.fillRect(x - 4, top - 50, 2, 3);
    ctx.fillStyle = '#c2202e';
    ctx.fillRect(x - 2, top - 58, 4, 7);
    ctx.fillRect(x + 1, top - 56, 4, 3);
    ctx.fillStyle = '#1c1a28';
    ctx.fillRect(x - 15, top - 38, 9, 18);
    ctx.fillStyle = '#2f5fc0';
    ctx.fillRect(x - 14, top - 37, 7, 16);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(x - 11, top - 35, 1, 12);
    ctx.fillRect(x - 13, top - 30, 5, 1);
  }

  function drawBed() {
    const x = 30 - cam;
    if (x < -80 || x > W) return;
    const fy = CASTLE_FLOOR;
    ctx.fillStyle = '#1c1a28';
    ctx.fillRect(x - 1, fy - 46, 6, 46);
    ctx.fillRect(x + 51, fy - 46, 6, 46);
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(x, fy - 45, 4, 45);
    ctx.fillRect(x + 52, fy - 45, 4, 45);
    ctx.fillStyle = '#1c1a28';
    ctx.fillRect(x - 2, fy - 50, 60, 6);
    ctx.fillStyle = '#9c1f2b';
    ctx.fillRect(x - 1, fy - 49, 58, 4);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(x - 1, fy - 45, 58, 1);
    for (let i = 0; i < 58; i += 6) {
      ctx.fillStyle = '#9c1f2b';
      ctx.fillRect(x - 1 + i, fy - 44, 4, 3 + ((i / 6) % 2) * 2);
    }
    ctx.fillStyle = '#1c1a28';
    ctx.fillRect(x - 1, fy - 22, 58, 22);
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(x, fy - 12, 56, 12);
    ctx.fillStyle = '#8a5a30';
    ctx.fillRect(x, fy - 12, 56, 2);
    ctx.fillStyle = '#f4ecd8';
    ctx.fillRect(x + 2, fy - 21, 52, 9);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 4, fy - 24, 12, 6);
    ctx.fillStyle = '#9c1f2b';
    ctx.fillRect(x + 18, fy - 22, 36, 10);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(x + 18, fy - 22, 36, 1);
    ctx.fillRect(x + 18, fy - 14, 36, 1);
    ctx.fillStyle = '#7a1520';
    ctx.fillRect(x + 18, fy - 13, 36, 1);

    const tx = 104 - cam;
    ctx.fillStyle = '#1c1a28';
    ctx.fillRect(tx - 9, fy - 18, 18, 4);
    ctx.fillRect(tx - 7, fy - 15, 2, 15);
    ctx.fillRect(tx + 5, fy - 15, 2, 15);
    ctx.fillStyle = '#8a5a30';
    ctx.fillRect(tx - 8, fy - 17, 16, 2);
    ctx.fillStyle = '#f4ecd8';
    ctx.fillRect(tx - 1, fy - 25, 3, 7);
    const f = Math.floor(tick / 7) % 2;
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(tx - 1 + f, fy - 29, 2, 4);
    ctx.save();
    ctx.globalAlpha = 0.12;
    blob(tx, fy - 27, 12, '#ffd27a');
    ctx.restore();
  }

  function drawThrone() {
    const x = THRONE_X - cam;
    if (x < -60 || x > W + 60) return;
    const fy = CASTLE_FLOOR;
    for (const [sx, sy, sw, sh] of [[680, fy - 6, 200, 6], [700, fy - 12, 160, 6]]) {
      ctx.fillStyle = '#2a2638';
      ctx.fillRect(sx - cam, sy, sw, sh);
      ctx.fillStyle = '#8a86a0';
      ctx.fillRect(sx - cam + 1, sy + 1, sw - 2, sh - 1);
      ctx.fillStyle = '#e8c547';
      ctx.fillRect(sx - cam, sy, sw, 1);
      ctx.fillStyle = '#9c1f2b';
      ctx.fillRect(sx - cam + 30, sy, sw - 60, 2);
    }
    const base = fy - 12;
    ctx.save();
    ctx.globalAlpha = 0.12 + Math.sin(tick * 0.04) * 0.03;
    blob(x, base - 36, 40, '#fff3a8');
    ctx.restore();
    ctx.fillStyle = '#1c1a28';
    ctx.fillRect(x - 15, base - 66, 30, 66);
    ctx.fillRect(x - 20, base - 30, 40, 30);
    ctx.fillRect(x - 10, base - 74, 20, 9);
    ctx.fillRect(x - 3, base - 80, 6, 7);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(x - 14, base - 65, 28, 65);
    ctx.fillRect(x - 9, base - 73, 18, 8);
    ctx.fillRect(x - 2, base - 79, 4, 6);
    ctx.fillStyle = '#b8901c';
    ctx.fillRect(x + 10, base - 65, 4, 65);
    ctx.fillStyle = '#fff3a8';
    ctx.fillRect(x - 13, base - 64, 2, 50);
    ctx.fillStyle = '#9c1f2b';
    ctx.fillRect(x - 10, base - 60, 20, 32);
    ctx.fillStyle = '#c2303a';
    ctx.fillRect(x - 8, base - 58, 4, 28);
    ctx.fillStyle = '#5ff0ff';
    ctx.fillRect(x - 2, base - 71, 4, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 2, base - 71, 1, 1);
    ctx.fillStyle = '#c2202e';
    ctx.fillRect(x - 1, base - 52, 2, 2);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(x - 19, base - 29, 38, 29);
    ctx.fillStyle = '#b8901c';
    ctx.fillRect(x - 19, base - 6, 38, 6);
    ctx.fillStyle = '#9c1f2b';
    ctx.fillRect(x - 13, base - 27, 26, 8);
    ctx.fillStyle = '#c2303a';
    ctx.fillRect(x - 13, base - 27, 26, 2);
    ctx.fillStyle = '#fff3a8';
    ctx.fillRect(x - 19, base - 29, 6, 2);
    ctx.fillRect(x + 13, base - 29, 6, 2);
    if (tick % 50 < 14) sparkle(x, base - 70, tick % 50 < 7 ? 1 : 2, '#ffffff');
  }

  function drawCastleDoor() {
    const x = CASTLE_DOOR_X - cam;
    if (x < -60 || x > W + 60) return;
    const fy = CASTLE_FLOOR, hw = 28, top = 96;
    for (let y = top - 6; y < fy; y++) {
      const ry = y < top + hw ? Math.round(Math.sqrt(Math.max(0, (hw + 6) ** 2 - (top + hw - y) ** 2))) : hw + 6;
      ctx.fillStyle = '#2a2638';
      ctx.fillRect(x - ry, y, ry * 2, 1);
    }
    for (let y = top - 4; y < fy; y++) {
      const ry = y < top + hw ? Math.round(Math.sqrt(Math.max(0, (hw + 4) ** 2 - (top + hw - y) ** 2))) : hw + 4;
      ctx.fillStyle = (Math.floor((y - top) / 6) % 2) ? '#8a86a0' : '#9b97b2';
      ctx.fillRect(x - ry, y, ry * 2, 1);
    }
    for (let y = top; y < fy; y++) {
      const ry = y < top + hw ? Math.round(Math.sqrt(Math.max(0, hw * hw - (top + hw - y) ** 2))) : hw;
      for (let px = -ry; px < ry; px++) {
        const plank = Math.floor((px + hw) / 7);
        ctx.fillStyle = (px + hw) % 7 === 0 ? '#3a2410' : plank % 2 ? '#6b4423' : '#7a4f2a';
        ctx.fillRect(x + px, y, 1, 1);
      }
    }
    ctx.fillStyle = '#1c1a28';
    ctx.fillRect(x - 1, top, 2, fy - top);
    for (const by of [128, 164]) {
      ctx.fillStyle = '#2a2a33';
      ctx.fillRect(x - hw, by, hw * 2, 4);
      ctx.fillStyle = '#55556a';
      ctx.fillRect(x - hw, by, hw * 2, 1);
      ctx.fillStyle = '#8a8aa0';
      for (let r = -hw + 4; r < hw; r += 8) ctx.fillRect(x + r, by + 1, 2, 2);
    }
    for (const hx of [-6, 6]) {
      ctx.fillStyle = '#b8901c';
      ctx.fillRect(x + hx - 3, 144, 6, 6);
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(x + hx - 1, 146, 2, 2);
      ctx.fillStyle = '#e8c547';
      ctx.fillRect(x + hx - 3, 144, 6, 1);
    }
    drawTorch(x - 46, 120);
    drawTorch(x + 46, 120);
    if (Math.abs(player.x - CASTLE_DOOR_X) < 160) {
      drawText('- THE MAIN CASTLE -', x, top - 22, 8, '#ffe14d', 'center');
    }
  }

  function renderCastle() {
    const c = castle;
    const fy = CASTLE_FLOOR;
    for (let x = -(cam % 32) - 32; x < W; x += 32) {
      for (let y = 0; y < fy; y += 16) ctx.drawImage(brickTile, x, y);
    }
    ctx.fillStyle = '#211e30';
    ctx.fillRect(0, 0, W, 16);
    ctx.fillStyle = '#2f2b42';
    ctx.fillRect(0, 16, W, 3);
    const spans = [0, ...CASTLE_PILLARS, CASTLE_W];
    for (let i = 0; i < spans.length - 1; i++) {
      castleArch(spans[i], spans[i + 1], 16, 40, '#2a2638', 4);
      castleArch(spans[i], spans[i + 1], 18, 42, '#5e5a76', 1);
    }

    for (const wx of CASTLE_WINDOWS) drawCastleWindow(wx);
    for (const m of c.motes) {
      const mx = Math.round(m.x - cam);
      if (mx < 0 || mx > W) continue;
      ctx.fillStyle = Math.sin(tick * 0.05 + m.ph) > 0 ? '#fff3a8' : '#d8d0a0';
      ctx.fillRect(mx, Math.round(m.y), 1, 1);
    }
    for (const bx of CASTLE_BANNERS) drawCastleBanner(bx, 46, 74, '#a3202a', '#c2202e');
    drawCastleBanner(THRONE_X - 46, 40, 104, '#5b2a86', '#e8c547');
    drawCastleBanner(THRONE_X + 46, 40, 104, '#5b2a86', '#e8c547');
    for (const px of CASTLE_PILLARS) drawCastlePillar(px);

    ctx.fillStyle = '#2a2638';
    ctx.fillRect(0, fy - 8, W, 8);
    ctx.fillStyle = '#3a364f';
    ctx.fillRect(0, fy - 7, W, 6);
    ctx.fillStyle = '#5e5a76';
    ctx.fillRect(0, fy - 8, W, 1);
    for (let x = -(cam % 16) - 16; x < W; x += 16) {
      for (let row = 0; row < 4; row++) {
        const ty = fy + row * 8;
        const odd = (Math.floor((x + cam) / 16) + row) % 2;
        ctx.fillStyle = odd ? '#6d6880' : '#5e5a72';
        ctx.fillRect(x, ty, 16, 8);
        ctx.fillStyle = odd ? '#7d7892' : '#6a6680';
        ctx.fillRect(x, ty, 16, 1);
      }
    }
    ctx.fillStyle = '#9c9ab4';
    ctx.fillRect(0, fy, W, 1);
    const cx0 = 170 - cam, cx1 = 690 - cam;
    ctx.fillStyle = '#7a1520';
    ctx.fillRect(cx0, fy + 1, cx1 - cx0, 12);
    ctx.fillStyle = '#9c1f2b';
    ctx.fillRect(cx0, fy + 1, cx1 - cx0, 10);
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(cx0, fy + 2, cx1 - cx0, 1);
    ctx.fillRect(cx0, fy + 9, cx1 - cx0, 1);
    for (let x = cx0 + 6; x < cx1; x += 12) ctx.fillRect(x, fy + 5, 2, 2);

    drawBed();
    for (const sx of CASTLE_STATUES) drawArmorStatue(sx);
    drawThrone();
    drawCastleDoor();
    drawKnight();
    for (const chx of CASTLE_CHANDELIERS) drawChandelier(chx);

    if (!c.awake) {
      ctx.save();
      ctx.translate(Math.round(48 - cam), CASTLE_FLOOR - 24);
      ctx.rotate(-Math.PI / 2);
      drawImg(playerFrames[0], -9, -6, 1);
      ctx.restore();
    } else {
      let frame = 0;
      if (!player.onGround) frame = 1;
      else if (player.walk > 0) frame = walkFrame(player.walk);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(Math.round(player.x - cam), Math.round(player.y + player.h) - 1, player.w, 1);
      drawImg(playerFrames[frame], player.x - 2 - cam, player.y, player.face);
    }

    if (!c.awake && c.wake < 130) {
      const w = c.wake;
      let open;
      if (w < 20) open = 0;
      else if (w < 50) open = (w - 20) / 30 * 0.35;
      else if (w < 64) open = 0.35 * (1 - (w - 50) / 14);
      else if (w < 110) open = Math.min(1, (w - 64) / 40);
      else open = 1;
      const lid = Math.round((H / 2) * (1 - open));
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, lid);
      ctx.fillRect(0, H - lid, W, lid);
    }

    drawDialog();
    drawTitle();
    drawToast();
    if (canOpenInventory() || inv.open) drawBagButton();
    if (inv.open) drawInventory();
  }

  // ---------- Menu, saves & speedrun ----------
  function fmtTime(frames) {
    const ms = Math.floor((frames * 1000) / 60);
    const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, cs = Math.floor(ms / 10) % 100;
    const pad = (v) => String(v).padStart(2, '0');
    return `${pad(m)}:${pad(s)}.${pad(cs)}`;
  }

  const BOSS_ORDER = ['redKid', 'monkey', 'angel', 'skyBird', 'lightGods', 'eye', 'knight', 'archer', 'joker', 'king'];
  const BOSS_RESTORE = [
    'BEHIND RED KID', 'BEHIND MONKEY', 'BEHIND ANGEL', 'BEHIND SKY BIRD', 'FINAL BOSS START',
    'THE CASTLE', 'THE MAZE', "THE KING'S ROOM", 'TO THE KING', 'TO THE KING',
  ];

  function classicSave(id) {
    if (run.mode !== 'classic') return;
    const i = BOSS_ORDER.indexOf(id);
    if (i < 0) return;
    const cur = store.get(STORE.save, null);
    const progress = Math.max(cur ? cur.progress : 0, i + 1);
    store.set(STORE.save, { progress, inventory: inventory.filter(Boolean), equipped: inv.equipped });
    toast.text = 'PROGRESS SAVED!';
    toast.t = 150;
  }

  function restoreClassic(save) {
    const opt = ADMIN_OPTIONS.find((o) => o.label === BOSS_RESTORE[save.progress - 1]);
    if (opt) opt.go();
    inventory.fill(null);
    save.inventory.forEach(addItem);
    if (inventory.includes('swapCrystal')) crystal.taken = true;
    inv.equipped = inventory.includes(save.equipped) ? save.equipped : null;
    const p = save.progress;
    if (p >= 1) npc.state = 'gone';
    if (p >= 2) {
      monkey.state = 'gone';
      vines.state = 'gone';
    }
    if (p >= 3) angel.state = 'gone';
    if (p >= 4) bird.state = 'gone';
    if (p >= 7) knight.state = 'gone';
  }

  const BOARD_SHOWN = 8;

  function encodeReplay(ev) {
    let prev = 0;
    return ev.map(([f, ...rest]) => {
      const d = f - prev;
      prev = f;
      return [d, ...rest];
    });
  }

  function decodeReplay(ev) {
    let f = 0;
    return ev.map(([d, ...rest]) => {
      f += d;
      return [f, ...rest];
    });
  }

  function finishRun() {
    if (run.mode !== 'speedrun' || run.done) return;
    run.done = true;
    run.finalFrames = run.frames;
    if (replay.on) return;
    const board = store.get(STORE.board, []);
    const entry = { name: playerName, frames: run.frames, at: Date.now() };
    board.push(entry);
    board.sort((a, b) => a.frames - b.frames);
    run.rank = board.indexOf(entry) + 1;
    if (run.rank <= BOARD_SHOWN) {
      const data = { seed: rec.seed, name: playerName, frames: run.frames, ev: encodeReplay(rec.ev) };
      if (store.set(STORE.rep + entry.at, data)) entry.rid = entry.at;
    }
    board.forEach((r, i) => {
      if (r.rid && i >= BOARD_SHOWN) {
        store.del(STORE.rep + r.rid);
        delete r.rid;
      }
    });
    store.set(STORE.board, board.slice(0, 50));
  }

  function watchRun(rid, dl) {
    try {
      sessionStorage.setItem(STORE.watch, JSON.stringify({ rid, dl: !!dl }));
    } catch (err) {
      return;
    }
    location.reload();
  }

  function startReplay() {
    let req = null;
    try {
      req = JSON.parse(sessionStorage.getItem(STORE.watch));
      sessionStorage.removeItem(STORE.watch);
    } catch (err) {}
    const data = req && store.get(STORE.rep + req.rid, null);
    if (!data) return false;
    replay.on = true;
    replay.dl = !!req.dl && typeof MediaRecorder !== 'undefined' && !!cvs.captureStream;
    replay.ev = decodeReplay(data.ev);
    replay.i = 0;
    replay.name = data.name;
    replay.frames = data.frames;
    rec.seed = data.seed;
    playerName = data.name;
    beginGame('speedrun');
    return true;
  }

  function startPlayback() {
    replay.paused = false;
    sfx('confirm');
    if (!replay.dl) return;
    replay.vcan = document.createElement('canvas');
    replay.vcan.width = W * 3;
    replay.vcan.height = H * 3;
    replay.vctx = replay.vcan.getContext('2d');
    replay.vctx.imageSmoothingEnabled = false;
    const stream = replay.vcan.captureStream(60);
    const audio = window.Sound && window.Sound.stream && window.Sound.stream();
    if (audio) audio.getAudioTracks().forEach((t) => stream.addTrack(t));
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    replay.chunks = [];
    replay.recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 6000000 } : {});
    replay.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) replay.chunks.push(e.data);
    };
    replay.recorder.start(1000);
  }

  function stopRecording(thenMenu) {
    const r = replay.recorder;
    if (!r || r.state === 'inactive') {
      if (thenMenu) location.reload();
      return;
    }
    r.onstop = () => {
      if (!replay.chunks.length) {
        replay.failed = true;
        if (thenMenu) setTimeout(() => location.reload(), 1500);
        return;
      }
      const blob = new Blob(replay.chunks, { type: 'video/webm' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `powerland-speedrun-${replay.name}-${fmtTime(replay.frames).replace(/[:.]/g, '-')}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      replay.saved = true;
      sfx('itemGet');
      if (thenMenu) setTimeout(() => location.reload(), 1500);
    };
    r.stop();
  }

  function replayKey(k) {
    if (replay.paused) {
      if (CONFIRM_KEYS.includes(k)) startPlayback();
      else if (k === 'escape') location.reload();
      return;
    }
    if (k === 'escape') {
      if (replay.recorder && !replay.saved && !replay.failed) stopRecording(true);
      else location.reload();
    } else if (k === 'f' && !replay.dl) {
      replay.speed = replay.speed >= 8 ? 1 : replay.speed * 2;
      sfx('cursor');
    } else if (k === 'm' && window.Sound) window.Sound.toggleMute();
  }

  function drawReplayBar() {
    if (replay.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      drawPanel(62, 64, 260, 84);
      drawText(replay.dl ? 'DOWNLOAD RUN VIDEO' : 'WATCH RUN', W / 2, 74, 8, '#9a1c1a', 'center', null);
      drawText(`${replay.name} - ${fmtTime(replay.frames)}`, W / 2, 92, 8, '#3b2a1a', 'center', null);
      if (Math.floor(performance.now() / 420) % 2 === 0) {
        drawText(replay.dl ? 'CLICK TO START RECORDING' : 'CLICK TO START', W / 2, 112, 8, '#2e8a3a', 'center', null);
      }
      if (replay.dl) drawText('KEEP THIS TAB OPEN', W / 2, 130, 8, '#8a6a3a', 'center', null);
      return;
    }
    ctx.fillStyle = 'rgba(10,8,24,0.8)';
    ctx.fillRect(0, H - 13, W, 13);
    if (tick % 60 < 40) blob(8, H - 7, 3, '#ff3b3b');
    if (replay.failed) {
      drawText('RECORDING FAILED', 16, H - 10, 8, '#ff6b6b', 'left', null);
      drawText('ESC:MENU', W - 4, H - 10, 8, '#5ff0ff', 'right', null);
      return;
    }
    if (replay.dl) {
      drawText(replay.saved ? 'VIDEO SAVED!' : `REC: ${replay.name}`, 16, H - 10, 8, replay.saved ? '#ffe14d' : '#ffffff', 'left', null);
      drawText(replay.saved ? 'ESC:MENU' : 'ESC:STOP+SAVE', W - 4, H - 10, 8, '#5ff0ff', 'right', null);
      return;
    }
    drawText(`REPLAY: ${replay.name}`, 16, H - 10, 8, '#ffffff', 'left', null);
    const end = run.done ? 'END OF RUN!  ' : '';
    drawText(`${end}F:x${replay.speed}  ESC:EXIT`, W - 4, H - 10, 8, run.done ? '#ffe14d' : '#5ff0ff', 'right', null);
  }

  function drawRunTimer() {
    const t = fmtTime(run.done ? run.finalFrames : run.frames);
    const w = 76;
    ctx.fillStyle = 'rgba(10,8,24,0.75)';
    ctx.fillRect(W / 2 - w / 2, 3, w, 14);
    ctx.fillStyle = '#5ff0ff';
    ctx.fillRect(W / 2 - w / 2, 16, w, 1);
    drawText(t, W / 2, 6, 8, run.done ? '#ffe14d' : '#ffffff', 'center', null);
  }

  const MENU_PANEL = { x: 72, y: 26, w: 240, h: 166 };
  const BOARD_PANEL = { x: 42, y: 24, w: 300, h: 172 };
  const BOARD_CLOSE = { x: 322, y: 28, w: 16, h: 14 };
  const boardRowY = (i) => BOARD_PANEL.y + 46 + i * 15;
  const watchRect = (i) => ({ x: BOARD_PANEL.x + 206, y: boardRowY(i) - 3, w: 52, h: 13 });
  const dlRect = (i) => ({ x: BOARD_PANEL.x + 264, y: boardRowY(i) - 3, w: 28, h: 13 });
  const TROPHY_BTN = { x: 346, y: 4, w: 32, h: 24 };
  const MB = {
    nameBox: { x: 82, y: 54, w: 118, h: 16 },
    saveName: { x: 206, y: 54, w: 96, h: 16 },
    classic: { x: 82, y: 76, w: 220, h: 40 },
    clear: { x: 82, y: 120, w: 220, h: 14 },
    speedrun: { x: 82, y: 140, w: 220, h: 40 },
    trophy: TROPHY_BTN,
  };

  function menuHover(p) {
    if (menu.screen !== 'main') return null;
    if (menu.board) {
      if (inRect(p, BOARD_CLOSE)) return 'closeBoard';
      const board = store.get(STORE.board, []).slice(0, BOARD_SHOWN);
      const i = board.findIndex((r, j) => r.rid && inRect(p, watchRect(j)));
      if (i >= 0) return 'watch' + i;
      const d = board.findIndex((r, j) => r.rid && inRect(p, dlRect(j)));
      return d >= 0 ? 'dl' + d : null;
    }
    return Object.keys(MB).find((k) => inRect(p, MB[k])) || null;
  }

  function saveName() {
    const n = menu.typing.trim();
    playerName = n || 'HERO';
    store.set(STORE.name, n);
    menu.saved = 90;
    menu.focus = false;
    sfx('itemGet');
  }

  function beginGame(mode) {
    run.mode = mode;
    run.frames = 0;
    run.done = false;
    run.rank = 0;
    if (mode === 'speedrun') {
      if (!replay.on) {
        rec.seed = Math.floor(nativeRandom() * 4294967296);
        rec.ev = [];
      }
      rec.f = 0;
      rec.queue.length = 0;
      tick = 0;
      gameRandom = seededRandom(rec.seed);
      Math.random = gameRandom;
    }
    if (!replay.on && menu.typing.trim() && menu.typing.trim() !== playerName) saveName();
    game.mode = 'world';
    fade.alpha = 1;
    fade.dir = -1;
    sfx('battleStart');
    if (mode === 'classic') {
      const s = store.get(STORE.save, null);
      if (s && s.progress > 0) {
        restoreClassic(s);
        toast.text = 'WELCOME BACK, ' + playerName + '!';
        toast.t = 180;
        return;
      }
    }
    titleInfo = { main: 'GRASSLANDS', sub: '- CHAPTER I -', hint: true };
    titleStart = performance.now();
  }

  function menuClick(p) {
    if (menu.screen === 'splash') {
      if (menu.t > 20) {
        menu.screen = 'main';
        menu.t = 0;
        menu.focus = !store.get(STORE.name, '');
        sfx('confirm');
      }
      return;
    }
    if (menu.board) {
      const hv = menuHover(p);
      if (hv && (hv.startsWith('watch') || hv.startsWith('dl'))) {
        const dl = hv.startsWith('dl');
        const r = store.get(STORE.board, [])[Number(hv.slice(dl ? 2 : 5))];
        sfx('confirm');
        watchRun(r.rid, dl);
        return;
      }
      if (inRect(p, BOARD_CLOSE) || !inRect(p, BOARD_PANEL)) {
        menu.board = false;
        sfx('cursor');
      }
      return;
    }
    const h = menuHover(p);
    menu.focus = h === 'nameBox';
    if (h === 'trophy') {
      menu.board = true;
      sfx('confirm');
      return;
    }
    if (h === 'nameBox') sfx('cursor');
    else if (h === 'saveName') saveName();
    else if (h === 'classic') beginGame('classic');
    else if (h === 'speedrun') beginGame('speedrun');
    else if (h === 'clear') {
      if (!store.get(STORE.save, null)) return;
      if (menu.confirmClear > 0) {
        store.del(STORE.save);
        menu.confirmClear = 0;
        sfx('throw');
      } else {
        menu.confirmClear = 150;
        sfx('cursor');
      }
    }
  }

  function menuKey(e, k) {
    if (menu.screen === 'splash') {
      if (CONFIRM_KEYS.includes(k)) menuClick({ x: 0, y: 0 });
      return;
    }
    if (menu.board) {
      if (k === 'escape' || CONFIRM_KEYS.includes(k)) {
        menu.board = false;
        sfx('cursor');
      }
      return;
    }
    if (menu.focus) {
      if (k === 'enter') saveName();
      else if (k === 'escape') menu.focus = false;
      else if (k === 'backspace') {
        e.preventDefault();
        menu.typing = menu.typing.slice(0, -1);
        sfx('text');
      } else if (/^[a-z0-9 ]$/.test(k) && menu.typing.length < 10) {
        e.preventDefault();
        menu.typing += k.toUpperCase();
        sfx('text');
      }
    }
  }

  function updateMenu() {
    menu.t++;
    if (menu.saved > 0) menu.saved--;
    if (menu.confirmClear > 0) menu.confirmClear--;
  }

  const SPLASH_CAST = () => [
    npcFrames[0], monkeyFrames[0], angelFrames[0], birdFrames[0],
    knightFrames[0], archerFrames[0], jokerFrames[0], kingWalkFrames[0],
  ];

  function drawSplashScene(t) {
    const bands = ['#120a2e', '#1e1046', '#2e1658', '#47206a', '#6a2a72', '#93386e', '#c04e62', '#e57a52', '#f7a64a'];
    const bh = Math.ceil(150 / bands.length);
    bands.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, i * bh, W, bh + 1);
    });
    for (let i = 0; i < 50; i++) {
      if ((t + i * 13) % 120 < 30) continue;
      ctx.fillStyle = i % 4 ? '#ffffff' : '#ffe14d';
      ctx.fillRect((i * 97 + 13) % W, (i * 41 + 5) % 80, 1, 1);
    }
    ctx.save();
    ctx.globalAlpha = 0.25;
    blob(300, 112, 46, '#ffd27a');
    ctx.globalAlpha = 1;
    blob(300, 112, 26, '#ffe9a8');
    blob(300, 112, 22, '#fff6d6');
    ctx.restore();
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = layer ? '#3a1e4e' : '#2a1640';
      const off = (t * (layer ? 0.15 : 0.08)) % 120;
      for (let i = -1; i < 6; i++) {
        const mx = i * 120 - off + layer * 60, mh = 40 + ((i * 37 + layer * 11) % 30) + layer * 10;
        ctx.beginPath();
        ctx.moveTo(mx - 80, 150);
        ctx.lineTo(mx, 150 - mh);
        ctx.lineTo(mx + 80, 150);
        ctx.fill();
      }
    }
    const cx = 92;
    ctx.fillStyle = '#1a0e2a';
    ctx.fillRect(cx - 34, 96, 68, 54);
    for (const [tx, th] of [[-34, 30], [-12, 46], [12, 46], [34, 30]]) {
      ctx.fillRect(cx + tx - 7, 96 - th + 26, 14, th);
      for (let b = 0; b < 3; b++) ctx.fillRect(cx + tx - 7 + b * 5, 96 - th + 22, 4, 4);
    }
    ctx.beginPath();
    ctx.moveTo(cx - 12, 76);
    ctx.lineTo(cx - 5, 56);
    ctx.lineTo(cx + 2, 76);
    ctx.fill();
    ctx.fillStyle = '#ffd27a';
    for (const [wx, wy] of [[-12, 92], [12, 92], [-34, 110], [34, 110], [0, 118]]) {
      if ((t + wx * 7) % 200 < 180) ctx.fillRect(cx + wx - 1, wy, 3, 4);
    }
    ctx.fillStyle = '#c2202e';
    ctx.fillRect(cx - 5, 50, 1, 8);
    ctx.fillRect(cx - 4, 50, 6 + Math.round(Math.sin(t * 0.1)), 3);
    for (let i = 0; i < 4; i++) {
      const x = ((i * 130 + t * (0.2 + i * 0.05)) % (W + 100)) - 50;
      ctx.save();
      ctx.globalAlpha = 0.35;
      blob(Math.round(x), 70 + i * 12, 10, '#f4c0c8');
      blob(Math.round(x + 12), 68 + i * 12, 12, '#f4c0c8');
      blob(Math.round(x + 26), 71 + i * 12, 9, '#f4c0c8');
      ctx.restore();
    }
    ctx.fillStyle = '#1f3a2a';
    ctx.beginPath();
    ctx.moveTo(0, 150);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, 150 + Math.sin(x * 0.02) * 4);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    ctx.fillStyle = '#2e5a36';
    ctx.fillRect(0, 168, W, H - 168);
    ctx.fillStyle = '#3e7a44';
    ctx.fillRect(0, 168, W, 2);
    for (let x = (t >> 1) % 6; x < W; x += 6) {
      ctx.fillStyle = '#4e9a52';
      ctx.fillRect(x, 166 - ((x * 7) % 3), 1, 3);
    }
  }

  function drawLogo(cx, y, t) {
    const text = 'POWERLAND';
    const size = 32;
    for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      drawText(text, cx + dx, y + dy, size, '#1a0e2a', 'center', null);
    }
    drawText(text, cx, y + 4, size, '#7a3a10', 'center', null);
    drawText(text, cx, y, size, '#e8a020', 'center', null);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, W, size * 0.45);
    ctx.clip();
    drawText(text, cx, y, size, '#ffe14d', 'center', null);
    ctx.restore();
    const sweep = ((t * 4) % (W + 200)) - 100;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sweep, y - 4);
    ctx.lineTo(sweep + 22, y - 4);
    ctx.lineTo(sweep + 8, y + size + 4);
    ctx.lineTo(sweep - 14, y + size + 4);
    ctx.clip();
    drawText(text, cx, y, size, '#ffffff', 'center', null);
    ctx.restore();
  }

  function drawOrbitGems(cx, cy, t, front) {
    const ids = GEM_ORDER.filter((id) => ITEMS[id].kind === 'gem');
    ids.forEach((id, i) => {
      const a = t * 0.015 + (i / ids.length) * Math.PI * 2;
      const z = Math.sin(a);
      if ((z > 0) !== front) return;
      const x = cx + Math.cos(a) * 170, y = cy + z * 16;
      const img = ITEM_SPRITES[id];
      const s = z > 0 ? 2 : 1;
      ctx.save();
      ctx.globalAlpha = z > 0 ? 1 : 0.6;
      drawImg(img, Math.round(x - (img.width * s) / 2), Math.round(y - (img.height * s) / 2), 1, s);
      ctx.restore();
      if (front && (t + i * 9) % 40 < 6) sparkle(Math.round(x + 6), Math.round(y - 6), 1, '#ffffff');
    });
  }

  function renderSplash() {
    const t = menu.t;
    drawSplashScene(tick);
    const cast = SPLASH_CAST();
    cast.forEach((img, i) => {
      const x = 172 + i * 26;
      const bob = Math.round(Math.abs(Math.sin(tick * 0.06 + i * 0.8)) * 3);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x - img.width / 2 - 1, 169, img.width + 2, 2);
      drawImg(img, x - img.width / 2, 169 - img.height - bob, -1);
    });
    const hb = Math.round(Math.sin(tick * 0.05) * 2);
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.1 * Math.sin(tick * 0.1);
    blob(70, 150, 26, '#5ff0ff');
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(56, 168, 28, 3);
    drawImg(playerFrames[0], 52, 114 + hb, 1, 3);
    drawOrbitGems(W / 2, 46, tick, false);
    const drop = Math.max(0, 1 - t / 30);
    drawLogo(W / 2, 30 - Math.round(drop * drop * 80), tick);
    drawOrbitGems(W / 2, 46, tick, true);
    drawText('A PIXEL ADVENTURE', W / 2, 74, 8, '#fff3a8', 'center', '#1a0e2a');
    if (t > 30 && Math.floor(tick / 25) % 2 === 0) {
      drawText('- CLICK TO START -', W / 2, 192, 8, '#ffffff', 'center', '#1a0e2a');
    }
    if (t < 20) {
      ctx.fillStyle = `rgba(255,255,255,${1 - t / 20})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawMenuButton(r, label, sub, color, hover, disabled, pic) {
    ctx.fillStyle = '#1c140c';
    ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    ctx.fillStyle = disabled ? '#8a7a5a' : hover ? color[1] : color[0];
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(r.x, r.y, r.w, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(r.x, r.y + r.h - 2, r.w, 2);
    let cx = r.x + r.w / 2;
    if (pic) {
      const px = r.x + 4, py = r.y + 4, pw = 48, ph = r.h - 8;
      ctx.fillStyle = '#1c140c';
      ctx.fillRect(px - 1, py - 1, pw + 2, ph + 2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, pw, ph);
      ctx.clip();
      pic(px, py, pw, ph, hover);
      ctx.restore();
      cx = px + pw + (r.x + r.w - px - pw) / 2;
    }
    const ty = sub ? r.y + Math.round(r.h / 2) - 11 : r.y + Math.round((r.h - 8) / 2);
    drawText(label, cx, ty, 8, hover && !disabled ? '#ffe14d' : '#ffffff', 'center', '#1c140c');
    if (sub) drawText(sub, cx, ty + 13, 8, '#f5e6c0', 'center', null);
  }

  function drawClassicPic(x, y, w, h, hover, prog) {
    ctx.fillStyle = '#7ec8f0';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#b4e2f8';
    ctx.fillRect(x, y + 14, w, 6);
    blob(x + 40, y + 12, 4, '#fff3a8');
    ctx.fillStyle = '#4a6a8a';
    ctx.fillRect(x + 34, y + 16, 12, 8);
    ctx.fillRect(x + 33, y + 13, 3, 4);
    ctx.fillRect(x + 44, y + 13, 3, 4);
    ctx.fillStyle = '#3e9a44';
    ctx.fillRect(x, y + h - 5, w, 5);
    ctx.fillStyle = '#5ec060';
    ctx.fillRect(x, y + h - 5, w, 1);
    const f = hover ? Math.floor(tick / 8) % playerFrames.length : 0;
    drawImg(playerFrames[f], x + 4, y + h - 5 - playerFrames[0].height, 1);
    drawImg(npcFrames[0], x + 24, y + h - 5 - npcFrames[0].height, -1);
    if (tick % 30 < 20) drawText('!', x + 30, y + 6, 8, '#ffe14d', 'center', '#1c140c');
    for (let i = 0; i < BOSS_ORDER.length; i++) {
      ctx.fillStyle = '#1c140c';
      ctx.fillRect(x + 3 + i * 4, y + 2, 4, 4);
      ctx.fillStyle = i < prog ? '#ffe14d' : '#6a7a8a';
      ctx.fillRect(x + 4 + i * 4, y + 3, 2, 2);
    }
  }

  function drawSpeedPic(x, y, w, h, hover) {
    ctx.fillStyle = '#2a1640';
    ctx.fillRect(x, y, w, h);
    const spd = hover ? 3 : 1;
    for (let i = 0; i < 9; i++) {
      const ly = y + 3 + ((i * 7) % (h - 8));
      const lx = x + w - (((tick * spd + i * 23) * 1.5) % (w + 20));
      ctx.fillStyle = i % 3 ? '#7a4ab0' : '#5ff0ff';
      ctx.fillRect(Math.round(lx), ly, 8 + (i % 3) * 4, 1);
    }
    ctx.fillStyle = '#5a3a80';
    ctx.fillRect(x, y + h - 4, w, 4);
    ctx.fillStyle = '#9c3fd8';
    for (let gx = x - ((tick * spd) % 8); gx < x + w; gx += 8) ctx.fillRect(gx, y + h - 4, 4, 1);
    const f = Math.floor(tick / (hover ? 3 : 6)) % playerFrames.length;
    const bob = f % 2;
    drawImg(playerFrames[f], x + 8, y + h - 4 - playerFrames[0].height - bob, 1);
    ctx.fillStyle = 'rgba(95,240,255,0.5)';
    ctx.fillRect(x + 2, y + h - 14 - bob, 5, 1);
    ctx.fillRect(x + 4, y + h - 10 - bob, 3, 1);
    const sx = x + 36, sy = y + 13;
    ctx.fillStyle = '#c8c8d8';
    ctx.fillRect(sx - 2, sy - 10, 4, 3);
    blob(sx, sy, 8, '#1c140c');
    blob(sx, sy, 7, '#e8e8f0');
    blob(sx, sy, 5, '#ffffff');
    const a = tick * (hover ? 0.3 : 0.1);
    ctx.fillStyle = '#c2202e';
    for (let r = 0; r < 5; r++) ctx.fillRect(Math.round(sx + Math.sin(a) * r), Math.round(sy - Math.cos(a) * r), 1, 1);
    ctx.fillStyle = '#1c140c';
    ctx.fillRect(sx, sy, 1, 1);
  }

  function drawTrophy(cx, y, shine) {
    const gold = '#e8a020', light = '#ffe14d', dark = '#a06010';
    ctx.fillStyle = '#1c140c';
    ctx.fillRect(cx - 7, y - 1, 14, 11);
    ctx.fillRect(cx - 10, y + 1, 20, 6);
    ctx.fillRect(cx - 3, y + 9, 6, 5);
    ctx.fillRect(cx - 6, y + 13, 12, 5);
    ctx.fillStyle = gold;
    ctx.fillRect(cx - 6, y, 12, 9);
    ctx.fillRect(cx - 9, y + 2, 3, 4);
    ctx.fillRect(cx + 6, y + 2, 3, 4);
    ctx.fillStyle = '#7ec8f0';
    ctx.fillRect(cx - 8, y + 3, 2, 2);
    ctx.fillRect(cx + 6, y + 3, 2, 2);
    ctx.fillStyle = gold;
    ctx.fillRect(cx - 2, y + 9, 4, 4);
    ctx.fillRect(cx - 5, y + 14, 10, 3);
    ctx.fillStyle = light;
    ctx.fillRect(cx - 5, y + 1, 2, 6);
    ctx.fillRect(cx - 5, y + 14, 10, 1);
    ctx.fillStyle = dark;
    ctx.fillRect(cx + 3, y + 1, 2, 7);
    ctx.fillRect(cx - 5, y + 16, 10, 1);
    if (shine) sparkle(cx + 5, y + 1, 1, '#ffffff');
  }

  function renderBoardPopup() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    const B = BOARD_PANEL;
    drawPanel(B.x, B.y, B.w, B.h);
    drawTrophy(B.x + 20, B.y + 5, tick % 60 < 10);
    drawTrophy(B.x + B.w - 46, B.y + 5, tick % 60 > 30 && tick % 60 < 40);
    drawText('LEADERBOARD', B.x + B.w / 2 - 10, B.y + 10, 8, '#9a1c1a', 'center', null);
    const c = BOARD_CLOSE, ch = menuHover(mouse) === 'closeBoard';
    ctx.fillStyle = '#1c140c';
    ctx.fillRect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
    ctx.fillStyle = ch ? '#c0302c' : '#9a1c1a';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    drawText('X', c.x + c.w / 2 + 1, c.y + 3, 8, '#ffffff', 'center', null);
    ctx.fillStyle = '#b39660';
    ctx.fillRect(B.x + 8, B.y + 26, B.w - 16, 1);
    drawText('SPEEDRUN TIMES', B.x + B.w / 2, B.y + 31, 8, '#8a6a3a', 'center', null);
    const board = store.get(STORE.board, []);
    if (!board.length) {
      drawText('NO RUNS YET!', B.x + B.w / 2, B.y + 76, 8, '#8a7a5a', 'center', null);
      drawText('BEAT SPEEDRUN MODE', B.x + B.w / 2, B.y + 96, 8, '#8a7a5a', 'center', null);
      drawText('TO GET ON THE BOARD', B.x + B.w / 2, B.y + 108, 8, '#8a7a5a', 'center', null);
    }
    const hv = menuHover(mouse);
    board.slice(0, BOARD_SHOWN).forEach((r, i) => {
      const y = boardRowY(i);
      const col = ['#c8901a', '#7a7a90', '#a0603a'][i] || '#3b2a1a';
      if (i < 3) {
        ctx.fillStyle = ['rgba(232,160,32,0.25)', 'rgba(140,140,170,0.25)', 'rgba(160,96,58,0.25)'][i];
        ctx.fillRect(B.x + 6, y - 3, 196, 13);
      }
      drawText(`${i + 1}.`, B.x + 10, y, 8, col, 'left', null);
      drawText(r.name, B.x + 30, y, 8, col, 'left', null);
      drawText(fmtTime(r.frames), B.x + 198, y, 8, '#3b2a1a', 'right', null);
      const wr = watchRect(i), on = !!r.rid, over = hv === 'watch' + i;
      ctx.fillStyle = '#1c140c';
      ctx.fillRect(wr.x - 1, wr.y - 1, wr.w + 2, wr.h + 2);
      ctx.fillStyle = !on ? '#8a7a5a' : over ? '#4a8af0' : '#2f6fdc';
      ctx.fillRect(wr.x, wr.y, wr.w, wr.h);
      ctx.fillStyle = on ? '#ffffff' : '#c8b890';
      for (let j = 0; j < 4; j++) ctx.fillRect(wr.x + 4 + j, wr.y + 3 + j, 1, 7 - 2 * j);
      drawText('WATCH', wr.x + 30, wr.y + 3, 8, on ? (over ? '#ffe14d' : '#ffffff') : '#c8b890', 'center', null);
      const dr = dlRect(i), dOver = hv === 'dl' + i;
      ctx.fillStyle = '#1c140c';
      ctx.fillRect(dr.x - 1, dr.y - 1, dr.w + 2, dr.h + 2);
      ctx.fillStyle = !on ? '#8a7a5a' : dOver ? '#3eaa4a' : '#2e8a3a';
      ctx.fillRect(dr.x, dr.y, dr.w, dr.h);
      ctx.fillStyle = on ? (dOver ? '#ffe14d' : '#ffffff') : '#c8b890';
      const ax = dr.x + dr.w / 2, bob = dOver ? (tick >> 3) % 2 : 0;
      ctx.fillRect(ax - 1, dr.y + 2 + bob, 2, 4);
      ctx.fillRect(ax - 3, dr.y + 6 + bob, 6, 1);
      ctx.fillRect(ax - 2, dr.y + 7 + bob, 4, 1);
      ctx.fillRect(ax - 1, dr.y + 8 + bob, 2, 1);
      ctx.fillRect(ax - 6, dr.y + 10, 12, 1);
      ctx.fillRect(ax - 6, dr.y + 8, 1, 2);
      ctx.fillRect(ax + 5, dr.y + 8, 1, 2);
    });
    drawText('CLICK OUTSIDE TO CLOSE', W / 2, 202, 8, '#ffffff', 'center', '#1a0e2a');
  }

  function renderMenu() {
    if (menu.screen === 'splash') {
      renderSplash();
      return;
    }
    drawSplashScene(tick);
    ctx.fillStyle = 'rgba(10,6,24,0.45)';
    ctx.fillRect(0, 0, W, H);
    drawText('POWERLAND', W / 2, 6, 16, '#ffd84a', 'center', '#1a0e2a');
    const hover = menuHover(mouse);

    const P = MENU_PANEL;
    drawPanel(P.x, P.y, P.w, P.h);
    drawText('NAME', P.x + 10, P.y + 9, 8, '#3b2a1a', 'left', null);
    if (menu.saved > 0) drawText('SAVED!', P.x + P.w - 10, P.y + 9, 8, '#2e9a3a', 'right', null);
    const nb = MB.nameBox;
    ctx.fillStyle = menu.focus ? '#e8c547' : '#1c140c';
    ctx.fillRect(nb.x - 1, nb.y - 1, nb.w + 2, nb.h + 2);
    ctx.fillStyle = '#fffaea';
    ctx.fillRect(nb.x, nb.y, nb.w, nb.h);
    const shown = menu.typing || (menu.focus ? '' : 'TYPE NAME');
    drawText(shown, nb.x + 4, nb.y + 4, 8, menu.typing ? '#3b2a1a' : '#b8a888', 'left', null);
    if (menu.focus && Math.floor(tick / 20) % 2 === 0) {
      ctx.font = `8px ${FONT}`;
      ctx.fillStyle = '#3b2a1a';
      ctx.fillRect(nb.x + 5 + ctx.measureText(menu.typing).width, nb.y + 3, 2, 10);
    }
    drawMenuButton(MB.saveName, 'SAVE NAME', null, ['#2f6fdc', '#4a8af0'], hover === 'saveName');

    const save = store.get(STORE.save, null);
    const prog = save ? save.progress : 0;
    const sub = !prog ? 'NEW GAME' : prog >= BOSS_ORDER.length ? 'COMPLETED!' : `SAVED: ${prog}/${BOSS_ORDER.length} BOSSES`;
    drawMenuButton(MB.classic, 'CLASSIC MODE', sub, ['#2e8a3a', '#3eaa4a'], hover === 'classic', false,
      (x, y, w, h, hv) => drawClassicPic(x, y, w, h, hv, prog));
    const clearLabel = menu.confirmClear > 0 ? 'CLICK AGAIN TO CONFIRM' : 'CLEAR PROGRESS';
    drawMenuButton(MB.clear, clearLabel, null, ['#9a1c1a', '#c0302c'], hover === 'clear', !save);
    drawMenuButton(MB.speedrun, 'SPEEDRUN MODE', 'SPACE: SKIP CHAT', ['#7a2a9c', '#9c3fd8'], hover === 'speedrun', false, drawSpeedPic);

    const T = TROPHY_BTN, th = hover === 'trophy';
    ctx.fillStyle = '#1c140c';
    ctx.fillRect(T.x - 1, T.y - 1, T.w + 2, T.h + 2);
    ctx.fillStyle = th ? '#7a4a1a' : '#4a2e14';
    ctx.fillRect(T.x, T.y, T.w, T.h);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(T.x, T.y, T.w, 1);
    drawTrophy(T.x + T.w / 2, T.y + 3 - (th ? 1 : 0), th || tick % 90 < 10);

    if (menu.board) renderBoardPopup();
    else drawText('CLICK A MODE TO PLAY', W / 2, 202, 8, '#ffffff', 'center', '#1a0e2a');
  }

  // ---------- Loop ----------
  let last = performance.now();
  let acc = 0;
  const STEP = 1000 / 60;
  function loop(t) {
    acc += Math.min(100, t - last);
    last = t;
    while (acc >= STEP) {
      const n = replay.on ? replay.speed : 1;
      for (let s = 0; s < n; s++) stepGame();
      acc -= STEP;
    }
    Math.random = nativeRandom;
    render();
    Math.random = gameRandom;
    requestAnimationFrame(loop);
  }

  function stepGame() {
    if (replay.on && replay.paused) return;
    if (replay.on && run.done && ++replay.doneT === 240 && replay.dl) stopRecording(false);
    const live = run.mode === 'speedrun' && game.mode !== 'menu';
    if (live) {
      if (replay.on) {
        const ev = replay.ev;
        while (replay.i < ev.length && ev[replay.i][0] <= rec.f) applyInput(ev[replay.i++].slice(1));
      } else if (rec.queue.length) {
        const q = rec.queue.splice(0);
        for (const ev of q) {
          if (!run.done) rec.ev.push([rec.f, ...ev]);
          applyInput(ev);
        }
      }
    }
    const timing = live && !run.done && !admin.open;
    if (timing) run.frames++;
    update();
    if (live) rec.f++;
  }

  const startTitle = () => {
    if (titleStart === null && game.mode !== 'menu') titleStart = performance.now();
  };
  game.mode = 'menu';
  startReplay();
  if (document.fonts && document.fonts.load) {
    document.fonts.load(`8px ${FONT}`).then(startTitle, startTitle);
  }
  setTimeout(startTitle, 1500);
  requestAnimationFrame(loop);
})();
