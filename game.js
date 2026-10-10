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
  const exportState = { on: false, encoder: null, chunks: [], n: 0, step: 0, finishing: false, saved: false, error: false };
  const sfx = (name, arg) => window.Sound && !exportState.on && window.Sound.play(name, arg);

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

  const ALIEN_TOP = [
    '..y....y..',
    '...k..k...',
    '..kkkkkk..',
    '.kggggggk.',
    'kggggggggk',
    'kgEEggEEgk',
    'kgEwggEwgk',
    'kggggggggk',
    '.kggkkggk.',
    '..kkkkkk..',
    '..kWWtWWk.',
    '.gkWWtWWkg',
    '..kWWtWWk.',
    '..kbbkbbk.',
  ];
  const alienSprites = (g) => {
    const pal = { k: '#1a1420', y: '#ffe14d', g, E: '#101018', w: '#ffffff', W: '#e8ecf4', t: '#c2202e', b: '#3a3f58' };
    return [buildSprite([...ALIEN_TOP, '..kk...kk.'], pal), buildSprite([...ALIEN_TOP, '...kk.kk..'], pal)];
  };
  const ALIEN_SKINS = [alienSprites('#6fd86a'), alienSprites('#b07cff'), alienSprites('#5fc8f0')];

  const MECHANIC_ROWS = [
    '....kkkkk.....',
    '...khhhhhkk...',
    '..khhhhhhhhk..',
    '..kGGGGGGcck..',
    '..khsssssssk..',
    '..khsssseesk..',
    '..kssssssssk..',
    '...ksssmmsk...',
    '....kkssk.....',
    '...koooooook..',
    '..kooyoooooOk.',
    '..kOoooooooOk.',
    '..kOoooooooOk.',
    '..kgbbbybbbgk.',
    '...koooooook..',
    '...kook.kook..',
    '...kook.kook..',
    '...kOOk.kOOk..',
    '..kBBBk.kBBBk.',
    '..kkkkk.kkkkk.',
  ].map((r) => r.padEnd(14, '.'));
  const mechanicBlinkRows = [...MECHANIC_ROWS];
  mechanicBlinkRows[5] = '..khsssssssk..';
  const MECHANIC_PAL = {
    k: '#1a1420', h: '#5a3a1c', G: '#3a3a48', c: '#5ff0ff', s: '#f2c79b', e: '#1a1a1a', m: '#c2202e',
    o: '#e8742a', O: '#b8501a', y: '#ffe14d', g: '#4a4a5a', b: '#3b2a1a', B: '#2a2a38',
  };
  const mechanicFrames = [buildSprite(MECHANIC_ROWS, MECHANIC_PAL), buildSprite(mechanicBlinkRows, MECHANIC_PAL)];

  const CAPTAIN_ROWS = [
    '...y......y...',
    '....k....k....',
    '...kNNNNNNk...',
    '..kNNNNyNNNk..',
    '.kkkkkkkkkkkk.',
    '.kcccccccccck.',
    '.kcEEccccEEck.',
    '.kcEwccccEwck.',
    '.kcccccccccck.',
    '..kcckkkkcck..',
    '...kkkkkkkk...',
    '.yyNNNWWNNNyy.',
    'cNNNNNWWNNNNNc',
    'cNNNNyNNyNNNNc',
    '.kNNNNyNNyNNk.',
    '.kNNNNNNNNNNk.',
    '..kbbk..kbbk..',
    '..kkkk..kkkk..',
  ];
  const captainBlinkRows = [...CAPTAIN_ROWS];
  captainBlinkRows[6] = '.kcccccccccck.';
  captainBlinkRows[7] = '.kcEEccccEEck.';
  const CAPTAIN_PAL = { k: '#1a1420', y: '#ffe14d', N: '#2a3a7a', W: '#e8ecf4', c: '#6fd86a', E: '#101018', w: '#ffffff', b: '#1a1f30' };
  const captainFrames = [buildSprite(CAPTAIN_ROWS, CAPTAIN_PAL), buildSprite(captainBlinkRows, CAPTAIN_PAL)];

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
  const MECH_PUNCH = { name: 'PUNCH', dmg: 2, type: 'normal', anim: 'mpunch' };
  const RAY_BLAST = { name: 'RAY BLAST', dmg: 4, type: 'normal', anim: 'ray' };
  const MASH_UP = { name: 'MASH UP', dmg: 5, type: 'normal', anim: 'mash' };
  const MECH_UNLEASHED = { name: 'MECH UNLEASHED', dmg: 1, hits: 6, type: 'normal', special: true, anim: 'mech' };
  const CAPTAIN_PUNCH = { name: 'PUNCH', dmg: 2, type: 'normal', anim: 'cpunch' };
  const CAPTAIN_RAY_GUN = { name: 'CAPTAIN RAY GUN', dmg: 5, type: 'normal', anim: 'cray' };
  const CAPTAIN_SLASH = { name: 'CAPTAIN SLASH', dmg: 6, type: 'normal', anim: 'katana' };
  const CAPTAIN_CONTROL = { name: 'CAPTAIN CONTROL', dmg: 3, hits: 4, type: 'normal', special: true, anim: 'kontrol' };
  const BROKEN_PUNCH = { name: 'PUNCH', dmg: 2, type: 'normal', anim: 'bpunch' };
  const SMASH_DOWN = { name: 'SMASH DOWN', dmg: 5, type: 'normal', anim: 'smash' };
  const INFERNO_BEAMS = { name: 'INFERNO BEAMS', dmg: 6, type: 'normal', anim: 'inferno' };
  const OVERACTIVE = { name: 'OVERACTIVE', dmg: 1, hits: 7, type: 'normal', special: true, anim: 'overactive' };
  const FORGE_PUNCH = { name: 'PUNCH', dmg: 2, type: 'normal', anim: 'fpunch' };
  const BRICK_SMASH = { name: 'BRICK SMASH', dmg: 3, hits: 2, type: 'normal', anim: 'brick' };
  const GHOSTLY_BEAM = { name: 'GHOSTLY BEAM', dmg: 7, type: 'normal', special: true, anim: 'gbeam' };
  const CASTLE_DEFENCE = { name: 'CASTLE DEFENCE', dmg: 4, type: 'normal', special: true, anim: 'cdef' };
  const GLITCH_PUNCH = { name: 'PUNCH', dmg: 2, type: 'normal', anim: 'gpunch' };
  const AFTER_IMAGE = { name: 'AFTER IMAGE', dmg: 2, hits: 3, type: 'normal', anim: 'afterimg' };
  const GLITCH_INFERNO = { name: 'GLITCH INFERNO', dmg: 7, hits: 3, type: 'normal', special: true, anim: 'ginferno' };
  const GLITCH_DOMAIN = { name: 'GLITCH DOMAIN', dmg: 2, hits: 5, type: 'normal', special: true, anim: 'gdomain' };
  const P_GLITCH_PUNCH = { name: 'GLITCH PUNCH', dmg: 5, type: 'normal', anim: 'gpunch' };
  const P_GLITCH_INFERNO = { name: 'GLITCH INFERNO', dmg: 3, hits: 3, type: 'normal', special: true, anim: 'ginferno' };
  const P_SUPER_DOMAIN = { name: 'SUPER DOMAIN', dmg: 2, hits: 4, type: 'normal', special: true, anim: 'gdomain' };
  const CORE_PUNCH = { name: 'PUNCH', dmg: 2, type: 'normal', anim: 'dfist' };
  const PORTAL_BARRAGE = { name: 'PORTAL BARRAGE', dmg: 1, hits: 6, type: 'normal', anim: 'pbarrage' };
  const GLITCH_LANDSCAPE = { name: 'GLITCH LANDSCAPE', dmg: 7, type: 'normal', special: true, anim: 'gland' };
  const DESTABILIZE = { name: 'DESTABILIZE', dmg: 8, type: 'normal', special: true, anim: 'destab' };
  const LATE_BOSS_WEIGHTS = [40, 25, 20, 15];
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
    mechanic: {
      name: 'MECHANIC', hp: 50, type: 'normal', moves: [MECH_PUNCH, RAY_BLAST, MASH_UP, MECH_UNLEASHED],
      weights: LATE_BOSS_WEIGHTS, frames: mechanicFrames, reward: 'mechCrystal', bg: 'ufo', hands: true,
    },
    captain: {
      name: 'CAPTAIN', hp: 55, type: 'normal', moves: [CAPTAIN_PUNCH, CAPTAIN_RAY_GUN, CAPTAIN_SLASH, CAPTAIN_CONTROL],
      weights: LATE_BOSS_WEIGHTS, frames: captainFrames, reward: 'captainCrystal', bg: 'ship', captain: true,
    },
    brokenMech: {
      name: 'BROKEN MECH', hp: 60, type: 'normal', moves: [BROKEN_PUNCH, SMASH_DOWN, INFERNO_BEAMS, OVERACTIVE],
      weights: LATE_BOSS_WEIGHTS, frames: mechanicFrames, reward: 'brokenCrystal', bg: 'wreck', broken: true, breaks: true,
    },
    thousandForger: {
      name: 'THOUSAND FORGER', hp: 75, type: 'normal', moves: [FORGE_PUNCH, BRICK_SMASH, GHOSTLY_BEAM, CASTLE_DEFENCE],
      weights: LATE_BOSS_WEIGHTS, frames: mechanicFrames, reward: 'forgerCrystal', bg: 'ruins', forger: true, crumbles: true,
    },
    glitch: {
      name: 'THE GLITCH', hp: 60, type: 'normal', moves: [GLITCH_PUNCH, AFTER_IMAGE, GLITCH_INFERNO, GLITCH_DOMAIN],
      weights: LATE_BOSS_WEIGHTS, frames: [npcFrames[0], npcBlink], reward: 'glitchCrystal', bg: 'glitch', glitchKid: true, shatters: true,
    },
    core: {
      name: 'THE CORE', hp: 65, type: 'normal', moves: [CORE_PUNCH, PORTAL_BARRAGE, GLITCH_LANDSCAPE, DESTABILIZE],
      weights: LATE_BOSS_WEIGHTS, frames: [npcFrames[0], npcBlink], bg: 'core', core: true, overloads: true,
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
    mechCrystal: {
      name: 'MECH CRYSTAL', desc: 'RAY BLAST + MASH UP + MECH UNLEASHED, 50 MAX HP', kind: 'gem',
      moves: [RAY_BLAST, MASH_UP, MECH_UNLEASHED], hpBonus: 30,
    },
    captainCrystal: {
      name: 'CAPTAIN CRYSTAL', desc: 'RAY GUN + SLASH + CONTROL, 55 MAX HP', kind: 'gem',
      moves: [CAPTAIN_RAY_GUN, CAPTAIN_SLASH, CAPTAIN_CONTROL], hpBonus: 35,
    },
    brokenCrystal: {
      name: 'BROKEN GEM', desc: 'BECOME THE BROKEN MECH, 60 MAX HP', kind: 'gem',
      moves: [SMASH_DOWN, INFERNO_BEAMS, OVERACTIVE], hpBonus: 40, form: 'broken',
    },
    forgerCrystal: {
      name: 'FORGER GEM', desc: 'BECOME THE FORGER, 65 MAX HP', kind: 'gem',
      moves: [BRICK_SMASH, GHOSTLY_BEAM, CASTLE_DEFENCE], hpBonus: 45, form: 'forger',
    },
    glitchCrystal: {
      name: 'GLITCH GEM', desc: 'GLITCH PUNCH, INFERNO + SUPER DOMAIN, 70 MAX HP', kind: 'gem',
      moves: [P_GLITCH_PUNCH, P_GLITCH_INFERNO, P_SUPER_DOMAIN], hpBonus: 50,
    },
    lightGem: {
      name: 'LIGHT GEM', desc: 'EXHALE + SECRETS, 30 MAX HP', kind: 'gem',
      moves: [GLOW_EXHALE, LIGHT_OF_SECRETS], hpBonus: 10,
    },
  };
  const INV_SIZE = 15;
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
    paused: true, dl: false, fast: false, doneT: 0, recorder: null, chunks: [], vcan: null, vctx: null, saved: false, failed: false,
  };
  const clockNow = () => (replay.on ? rec.f * (1000 / 60) : performance.now());
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
  const menu = { screen: 'splash', t: 0, typing: store.get(STORE.name, '') || '', focus: false, saved: 0, confirmClear: 0, board: false, scroll: 0, ver: null };
  let titleInfo = { main: 'GRASSLANDS', sub: '- CHAPTER I -', hint: true };

  // ---------- Input ----------
  const keys = {};
  const JUMP_KEYS = ['w', 'arrowup', ' '];
  const BLOCK_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '];
  const CONFIRM_KEYS = ['enter', ' ', 'z'];
  const mouse = { x: -1, y: -1 };

  // Set to true to bring back the admin panel (TAB).
  const ADMIN_ENABLED = true;

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
  cvs.addEventListener('wheel', (e) => {
    if (admin.open && game.mode !== 'menu') {
      e.preventDefault();
      adminScroll(Math.sign(e.deltaY) * 2);
      return;
    }
    if (game.mode !== 'menu' || !menu.board) return;
    e.preventDefault();
    scrollBoard(Math.sign(e.deltaY));
  }, { passive: false });

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
      adminPage('main');
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
    } else if (k === 't' && !e.repeat && canTeleport()) {
      openTeleport();
    } else if (k === 'e' && game.mode === 'world' && !dialog.active && nearCrystal()) {
      pickUpCrystal();
    } else if (game.mode === 'battle' && !e.repeat && battle && battle.ctrl) {
      if (JUMP_KEYS.includes(k) || CONFIRM_KEYS.includes(k)) ctrlJump();
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
      pointer = inRect(mouse, BAG_BTN) || (tpUnlocked && inRect(mouse, TP_BTN)) || (game.mode === 'ufo' && ship.phase === 'button' && inRect(mouse, shipBtnScreen()));
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
      const i = adminOptions().findIndex((o, j) => adminRowVisible(j) && inRect(p, adminRowRect(j)));
      if (i >= 0) adminChoose(i);
      return;
    }
    if (inv.open) {
      invClick(p);
      return;
    }
    if (shipButtonClick(p)) return;
    if (canOpenInventory()) {
      if (inRect(p, BAG_BTN)) openInventory();
      else if (canTeleport() && inRect(p, TP_BTN)) openTeleport();
      return;
    }
    if (game.mode !== 'battle') return;
    if (battle && battle.ctrl) {
      ctrlJump();
      return;
    }
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
  const TP_BTN = { x: W - 56, y: 4, w: 24, h: 22 };
  const INV_PANEL = { x: 72, y: 20, w: 240, h: 176 };
  const INV_CLOSE = { x: INV_PANEL.x + INV_PANEL.w - 20, y: INV_PANEL.y + 6, w: 14, h: 14 };
  const EQUIP_BTN = { x: INV_PANEL.x + INV_PANEL.w / 2 - 42, y: 175, w: 84, h: 17 };
  const invSlots = () => Math.min(INV_SIZE, 1 + inventory.filter(Boolean).length);

  function invSlotRect(i) {
    return { x: 105 + (i % 5) * 36, y: 36 + Math.floor(i / 5) * 34, w: 30, h: 30 };
  }

  const isGem = (id) => !!id && ITEMS[id].kind === 'gem';

  function canOpenInventory() {
    const castleOk = game.mode === 'castle' && castle.awake && !castle.leaving;
    const mazeOk = game.mode === 'maze' && !maze.leaving;
    const kingOk = game.mode === 'king' && !kingRoom.leaving;
    const shipOk = game.mode === 'ufo' && !ship.leaving && ship.phase !== 'cut';
    const mechOk = game.mode === 'mech' && !mechRoom.leaving && ['work', 'ready', 'beaten'].includes(mechNpc.state);
    const bridgeOk = game.mode === 'bridge' && (bridge.state === 'walk' || bridge.state === 'ready');
    const wreckOk = game.mode === 'wreck' && ['idle', 'ready', 'clear'].includes(wreck.state);
    const ruinsOk = game.mode === 'ruins' && (ruins.state === 'walk' || ruins.state === 'ready');
    const groadOk = game.mode === 'groad' && (groad.state === 'walk' || groad.state === 'ready');
    const climbOk = game.mode === 'climb' && (climb.state === 'walk' || climb.state === 'ready');
    return (game.mode === 'world' || castleOk || mazeOk || kingOk || shipOk || mechOk || bridgeOk || wreckOk || ruinsOk || groadOk || climbOk) && !dialog.active && fade.dir === 0;
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
    const { enemyId, onWin, onLose, returnMode = 'world', admin: adminTest = false } = pendingBattle;
    const enemy = ENEMIES[enemyId];
    battle = {
      id: enemyId, enemy, onWin, onLose, returnMode, admin: adminTest,
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
  const SWAP_PANEL = { x: 22, y: 18, w: 340, h: 142 };
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
  const MECH_HITS = [196, 210, 224, 238, 252, 266];
  const MECH_PART_T = [96, 104, 112, 120, 128, 136];
  const MECH_END = 300;
  const MECH_SUIT_T = 170;
  const KATANA_DASH = [48, 54, 60];
  const OVER_BEAMS = [120, 135, 150, 165];
  const OVER_BULLETS = [184, 190, 196, 202, 208, 214];
  const OVER_FIST = 232;
  const OVER_HITS = [128, 143, 158, 173, 196, 214, 248];
  const OVER_END = 300;
  const BREAK_BOOM = 110;
  const FP_HIT = 44, FP_END = 84;
  const BRICK_HITS = [50, 105], BRICK_END = 140;
  const GB_CUT = 130, GB_HIT = 172, GB_END = 262;
  const CD_CUT = 120, CD_HIT = 152, CD_END = 200;
  const CRUMBLE_END = 170;
  const GP_GLITCH = 16, GP_FIRE = 30, GP_HIT = 48, GP_END = 80;
  const AI_HITS = [76, 106, 136], AI_END = 180;
  const GI_LIGHTS = [40, 56, 72], GI_HITS = [128, 164, 200], GI_END = 250;
  const GD_FOE_T = [30, 38, 46, 54, 62], GD_DOME = 76, GD_HITS = [118, 140, 162, 184, 206], GD_SHATTER = 226, GD_END = 268;
  const DF_FORM = 30, DF_HIT = 50, DF_END = 92;
  const PB_OPEN = 24, PB_HITS = [40, 60, 80, 100, 120, 140], PB_END = 180;
  const GL_RISE = [34, 46, 58, 70], GL_HIT = 124, GL_END = 176;
  const DS_CODE = 56, DS_BEAM = 128, DS_HIT = 150, DS_END = 204;
  const OVERLOAD_BOOM = 160, OVERLOAD_END = 210;
  const SHATTER_BOOM = 140, SHATTER_END = 190;

  // Captain Control: boxes drop at the sides of the deck and slide through the middle.
  const CTRL_BOX_T = [130, 206, 282, 358];
  const CTRL_FLOOR = 176;
  const CTRL_X = 192;
  const CTRL_END = 470;
  const CTRL_BOX = 22;
  const CTRL_HIT_W = 18;
  const CTRL_JUMP_V = 6.2;
  const CTRL_GRAV = 0.32;

  function ctrlJump() {
    const c = battle && battle.ctrl;
    if (!c || c.fromP || c.done || c.jy > 0 || c.t < 60 || battle.over) return;
    c.jv = CTRL_JUMP_V;
    c.jy = 0.01;
    sfx('jump');
  }

  function ctrlBurst(x, y, n, colors, speed, up = 0) {
    const c = battle.ctrl;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * speed;
      c.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - up, life: 26 + Math.floor(Math.random() * 14), color: colors[i % colors.length], big: i % 4 === 0 });
    }
  }

  function updateCtrl(e) {
    const b = battle, c = b.ctrl;
    const t = ++c.t;
    if (t === 64 || t === 250) sfx('siren');
    if (t === 70) sfx('lurch');
    if (c.shake > 0) c.shake--;
    if (c.hurt > 0) c.hurt--;
    if (t > 64 && !c.done) c.shake = Math.max(c.shake, Math.abs(Math.sin(t * 0.05)) > 0.97 ? 3 : 0);

    if (c.jy > 0) {
      c.jy += c.jv;
      c.jv -= CTRL_GRAV;
      if (c.jy <= 0) {
        c.jy = 0;
        c.jv = 0;
        sfx('land');
        ctrlBurst(CTRL_X, CTRL_FLOOR, 6, ['#8a96aa', '#c8d2e0'], 1.2, 0.6);
      }
    }

    CTRL_BOX_T.forEach((bt, i) => {
      if (t === bt - 36) {
        c.boxes.push({ i, side: i % 2 ? 1 : -1, x: 0, y: -40, vx: 0, vy: 0, rot: 0, state: 'warn', t: 0, land: 0, judged: false, ai: null });
        sfx('warn');
      }
    });
    for (const box of c.boxes) {
      box.t++;
      if (box.state === 'warn') {
        if (box.t % 12 === 0) sfx('warn');
        if (box.t >= 36) {
          Object.assign(box, { state: 'fall', x: CTRL_X + box.side * 160, y: -30, vy: 1, t: 0 });
          sfx('whistle');
        }
      } else if (box.state === 'fall') {
        box.vy += 0.45;
        box.y += box.vy;
        box.rot += 0.18 * box.side;
        if (box.y >= CTRL_FLOOR) {
          Object.assign(box, { y: CTRL_FLOOR, state: 'slide', rot: 0, vx: -box.side * 3.4, land: 0 });
          sfx('crate');
          c.shake = 8;
          ctrlBurst(box.x, CTRL_FLOOR, 14, ['#8a96aa', '#c8d2e0', '#4a5468'], 2, 1);
          if (c.fromP) box.ai = Math.random() < 0.5 ? 'good' : Math.random() < 0.5 ? 'early' : 'none';
        }
      } else if (box.state === 'slide') {
        box.land++;
        box.x += box.vx;
        const dx = box.x - CTRL_X;
        const coming = Math.sign(dx) !== Math.sign(box.vx);
        if (c.fromP && !box.judged && c.jy === 0 && coming && !b.over) {
          const reach = box.ai === 'good' ? 40 : box.ai === 'early' ? 150 : -1;
          if (Math.abs(dx) < reach) {
            c.jv = CTRL_JUMP_V;
            c.jy = 0.01;
            sfx('jump');
          }
        }
        if (box.land % 4 === 0) c.parts.push({ x: box.x - Math.sign(box.vx) * 11, y: CTRL_FLOOR - 1, vx: -box.vx * 0.3, vy: -0.6 - Math.random(), life: 12, color: box.land % 8 ? '#ffe14d' : '#ff9a2e' });
        if (!box.judged && Math.abs(dx) < CTRL_HIT_W && c.jy < CTRL_BOX - 3 && !b.over) {
          box.judged = true;
          box.state = 'smash';
          box.t = 0;
          c.hurt = 30;
          c.shake = 12;
          ctrlBurst(box.x, CTRL_FLOOR - 12, 26, ['#6e7a90', '#8a96aa', '#e8742a', '#1a1420', '#6fd86a'], 3.2, 2);
          c.pops.push({ text: 'CRASH! -3', x: CTRL_X, y: CTRL_FLOOR - 64, t: 0, col: '#ff3e6c' });
          applyHit(e);
        } else if (!box.judged && !coming && Math.abs(dx) >= CTRL_HIT_W) {
          box.judged = true;
          c.dodged++;
          sfx('safe');
          c.pops.push({ text: ['NICE!', 'CLEAN!', 'WOAH!', 'PERFECT!'][box.i], x: CTRL_X, y: CTRL_FLOOR - 70, t: 0, col: '#7ed860' });
        }
        if (Math.abs(dx) > 240) box.state = 'gone';
      } else if (box.state === 'smash' && box.t > 30) {
        box.state = 'gone';
      }
    }
    for (let i = c.parts.length - 1; i >= 0; i--) {
      const p = c.parts[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      if (p.y > CTRL_FLOOR) {
        p.y = CTRL_FLOOR;
        p.vy *= -0.4;
        p.vx *= 0.7;
      }
      if (--p.life <= 0) c.parts.splice(i, 1);
    }
    for (let i = c.pops.length - 1; i >= 0; i--) if (++c.pops[i].t > 50) c.pops.splice(i, 1);

    const allGone = c.boxes.length === CTRL_BOX_T.length && c.boxes.every((x) => x.state === 'gone');
    if (!c.done && (b.over ? ++c.overT > 50 : allGone && t >= CTRL_END - 20)) c.done = true;
    if (c.done && ++c.doneT >= 20) {
      if (!b.over) {
        const who = c.fromP ? `${b.enemy.name} DODGED` : 'YOU DODGED';
        b.queue.unshift({ type: 'msg', text: `${who} ${c.dodged} OF ${CTRL_BOX_T.length} BOXES!` });
      }
      b.ctrl = null;
      b.cur = null;
    }
  }

  function applyHit(e) {
    const b = battle;
    const name = b.enemy.name;
    const color = { fire: '#ff9a2e', grass: '#5cc84a', holy: '#fff3a8', flying: '#bfe6ff', light: '#fff6b0' }[e.move.type] ||
      (e.move.anim === 'slash' ? '#7fdcff' : '#ffffff');
    const calc = calcDamage(e.move, e.who === 'player' ? b.enemy.type : PLAYER_TYPE);
    const dmg = e.blocked ? 0 : calc.dmg, sup = e.blocked ? false : calc.sup;
    const supMsg = sup ? [{ type: 'msg', text: "IT'S SUPER EFFECTIVE!" }] : [];
    b.shake = sup ? 12 : 8;
    if (e.blocked) {
      const onP = e.who === 'enemy';
      if (onP) b.pShieldHit = 20;
      else b.shieldHit = 20;
      b.fx.push(...Array.from({ length: 16 }, (_, i) => ({ x: onP ? 100 : 280, y: onP ? 116 : 60, vx: Math.cos(i * 0.4) * 2.4, vy: Math.sin(i * 0.4) * 2.4, life: 22, color: i % 2 ? '#b8ff6a' : '#ffffff' })));
      sfx('shieldBlock');
      return;
    }
    const rewardMsg = b.enemy.reward && !inventory.includes(b.enemy.reward)
      ? [{ type: 'msg', text: `YOU GOT THE ${ITEMS[b.enemy.reward].name}!` }]
      : [];
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
      if (b.ehp === 0 && b.enemy.breaks) {
        b.over = true;
        b.queue = [{ type: 'break' }, ...rewardMsg, { type: 'end', win: true }];
        return;
      }
      if (b.ehp === 0 && b.enemy.crumbles) {
        b.over = true;
        b.shield = false;
        b.queue = [{ type: 'crumble' }, ...rewardMsg, { type: 'end', win: true }];
        return;
      }
      if (b.ehp === 0 && b.enemy.shatters) {
        b.over = true;
        b.queue = [{ type: 'shatter' }, ...rewardMsg, { type: 'end', win: true }];
        return;
      }
      if (b.ehp === 0 && b.enemy.overloads) {
        b.over = true;
        b.queue = [{ type: 'overload' }, { type: 'msg', text: 'THE CORE IS COLLAPSING!' }, { type: 'end', win: true }];
        return;
      }
      if (b.ehp === 0) {
        b.over = true;
        sfx('faint');
        b.queue = [
          ...supMsg,
          { type: 'msg', text: `${name} QUIT!` },
          { type: 'msg', text: 'YOU WON THE BATTLE!' },
          ...rewardMsg,
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
    if (b.shieldHit > 0) b.shieldHit--;
    if (b.shieldRel > 0) b.shieldRel--;
    if (b.pShieldHit > 0) b.pShieldHit--;
    if (b.pShieldRel > 0) b.pShieldRel--;
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
      if (b.t === 1 && e.who === 'player' && b.shield) {
        e.blocked = true;
        b.shield = false;
        b.queue.unshift({ type: 'msg', text: 'THE CASTLE SHIELD BLOCKED IT! 0 DAMAGE!' }, { type: 'release' });
      }
      if (b.t === 1 && e.who === 'enemy' && b.pShield) {
        e.blocked = true;
        b.pShield = false;
        b.queue.unshift({ type: 'msg', text: 'YOUR CASTLE SHIELD BLOCKED IT! 0 DAMAGE!' }, { type: 'release', who: 'player' });
      }
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
      } else if (e.move.anim === 'mpunch') {
        duration = 44;
        if (b.t === 18) applyHit(e);
      } else if (e.move.anim === 'ray') {
        duration = 86;
        if (b.t === 30) sfx('rayFire');
        if (b.t === 36) {
          applyHit(e);
          b.shake = 16;
        }
      } else if (e.move.anim === 'mash') {
        duration = 96;
        if (b.t === 38) sfx('swoosh');
        if (b.t === 52) {
          applyHit(e);
          b.shake = 22;
          const [x, y] = e.who === 'player' ? [300, 92] : [100, 154];
          for (let i = 0; i < 34; i++) {
            const a = Math.PI + Math.random() * Math.PI, sp = 1 + Math.random() * 3;
            b.fx.push({ x, y, vx: Math.cos(a) * sp * 1.5, vy: Math.sin(a) * sp * 0.7, life: 32, color: ['#8a96aa', '#5ff0ff', '#c8d2e0'][i % 3] });
          }
        }
      } else if (e.move.anim === 'mech') {
        duration = MECH_END;
        if (MECH_PART_T.includes(b.t)) sfx('clank');
        if (b.t === 150) sfx('mechReady');
        MECH_HITS.forEach((h) => {
          if (b.t === h - 8) sfx('gun');
        });
        if (MECH_HITS.includes(b.t) && !b.over && !b.pre2) applyHit(e);
      } else if (e.move.anim === 'cpunch') {
        duration = 46;
        if (b.t === 18) {
          applyHit(e);
          b.shake = 12;
        }
      } else if (e.move.anim === 'cray') {
        duration = 100;
        if (b.t === 12) sfx('ray');
        if (b.t === 40) sfx('rayFire');
        if (b.t === 48) {
          applyHit(e);
          b.shake = 18;
          const [x, y] = e.who === 'player' ? [300, 62] : [100, 116];
          for (let i = 0; i < 36; i++) {
            const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3;
            b.fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 34, color: ['#6fd86a', '#ff3e6c', '#ffffff', '#c8ffb0'][i % 4] });
          }
        }
      } else if (e.move.anim === 'katana') {
        duration = 124;
        if (b.t === 10) sfx('unsheathe');
        if (b.t === 42 || b.t === 94) sfx('teleport');
        if (KATANA_DASH.includes(b.t)) sfx('swoosh');
        if (b.t === 82) sfx('sheathe');
        if (b.t === 88) {
          applyHit(e);
          b.shake = 22;
          const [x, y] = e.who === 'player' ? [300, 62] : [100, 118];
          for (let i = 0; i < 40; i++) {
            const a = (i / 40) * Math.PI * 2, sp = 1.5 + Math.random() * 3;
            b.fx.push({ x, y, vx: Math.cos(a) * sp * 1.4, vy: Math.sin(a) * sp * 0.6, life: 30, color: ['#5ff0ff', '#ffffff', '#ff4ae8'][i % 3] });
          }
        }
      } else if (e.move.anim === 'bpunch') {
        duration = 48;
        if (b.t === 10) sfx('rocketFist');
        if (b.t === 20) {
          applyHit(e);
          b.shake = 12;
        }
      } else if (e.move.anim === 'smash') {
        duration = 104;
        if (b.t === 8) sfx('rocketFist');
        if (b.t === 14) sfx('lockOn');
        if (b.t === 48) sfx('whistle');
        if (b.t === 60) {
          applyHit(e);
          b.shake = 24;
          const [x, y] = e.who === 'player' ? [300, 94] : [100, 154];
          for (let i = 0; i < 40; i++) {
            const a = Math.PI + Math.random() * Math.PI, sp = 1 + Math.random() * 3.5;
            b.fx.push({ x, y, vx: Math.cos(a) * sp * 1.6, vy: Math.sin(a) * sp * 0.8, life: 34, color: ['#8a7a6a', '#5ff0ff', '#9a5cf0', '#c8d2e0'][i % 4] });
          }
        }
      } else if (e.move.anim === 'inferno') {
        duration = 124;
        if (b.t === 20) sfx('lockOn');
        if (b.t === 44) sfx('rayFire');
        if (b.t === 70) {
          applyHit(e);
          b.shake = 22;
          const [x, y] = e.who === 'player' ? [300, 62] : [100, 118];
          for (let i = 0; i < 44; i++) {
            const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3;
            b.fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, life: 40, color: ['#ff2a2a', '#ff9a2e', '#ffe14d', '#ffffff'][i % 4] });
          }
        }
        if (b.t > 70 && b.t < 100 && b.shake < 4) b.shake = 4;
      } else if (e.move.anim === 'overactive') {
        duration = OVER_END;
        if ([30, 45, 60, 75].includes(b.t)) sfx('warnSign');
        if (b.t === 88) sfx('overactive');
        OVER_BEAMS.forEach((bt) => {
          if (b.t === bt) sfx('rayFire');
        });
        OVER_BULLETS.forEach((bt) => {
          if (b.t === bt) sfx('gun');
        });
        if (b.t === OVER_FIST) sfx('rocketFist');
        if (b.t === OVER_FIST + 40) sfx('clank');
        if (OVER_HITS.includes(b.t) && !b.over) applyHit(e);
        if (b.t > 100 && b.t < 290 && b.shake < 3) b.shake = 3;
      } else if (e.move.anim === 'fpunch') {
        duration = FP_END;
        if (b.t === 20) sfx('swoosh');
        if (b.t === FP_HIT - 10) sfx('whistle');
        if (b.t === FP_HIT) {
          applyHit(e);
          b.shake = 26;
          const [x, y] = e.who === 'player' ? [300, 94] : [100, 154];
          for (let i = 0; i < 60; i++) {
            const a = Math.PI + Math.random() * Math.PI, sp = 1 + Math.random() * 4.5;
            b.fx.push({ x: x + (Math.random() - 0.5) * 30, y, vx: Math.cos(a) * sp * 1.6, vy: Math.sin(a) * sp, life: 30 + Math.floor(Math.random() * 16), color: ['#8a86a0', '#5e5a76', '#a8a4bc', '#b8ff6a', '#c8c0a8'][i % 5] });
          }
        }
      } else if (e.move.anim === 'brick') {
        duration = BRICK_END;
        if (b.t === 12 || b.t === 64) sfx('lockOn');
        if (b.t === BRICK_HITS[0] - 8 || b.t === BRICK_HITS[1] - 8) sfx('whistle');
        BRICK_HITS.forEach((ht) => {
          if (b.t !== ht || b.over) return;
          applyHit(e);
          b.shake = 22;
          const [x, y] = e.who === 'player' ? [300, 94] : [100, 154];
          for (let i = 0; i < 40; i++) {
            const a = Math.PI + Math.random() * Math.PI, sp = 1 + Math.random() * 3.5;
            b.fx.push({ x, y, vx: Math.cos(a) * sp * 1.5, vy: Math.sin(a) * sp, life: 34, color: ['#9a4a3a', '#c86a4a', '#8a86a0', '#e8d8b0'][i % 4] });
          }
        });
      } else if (e.move.anim === 'gbeam') {
        duration = GB_END;
        if (b.t === 24) sfx('rumble');
        if (b.t === 62) sfx('ghostScream');
        if (b.t === 92) sfx('gcharge');
        if (b.t === GB_CUT + 8) sfx('ghostBeam');
        if (b.t === GB_HIT) {
          applyHit(e);
          b.shake = 30;
          const [x, y] = e.who === 'player' ? [300, 60] : [100, 120];
          for (let i = 0; i < 50; i++) {
            const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3;
            b.fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 44, color: ['#b8ff6a', '#e8fff8', '#7fe0c8', '#ffffff'][i % 4] });
          }
        }
        if (b.t > GB_CUT + 8 && b.t < GB_HIT + 40 && b.shake < 4) b.shake = 4;
        if (b.t === 60 || (b.t > 60 && b.t < 70)) b.shake = Math.max(b.shake, 10);
      } else if (e.move.anim === 'cdef') {
        duration = CD_END;
        if (b.t === 52) sfx('shieldUp');
        if (b.t === 96) sfx('clank');
        if (b.t === CD_CUT + 6) sfx('shockwave');
        if (b.t === CD_HIT) {
          applyHit(e);
          b.shake = 20;
          if (!b.over) {
            if (e.who === 'player') b.pShield = true;
            else b.shield = true;
          }
        }
        if (b.t === CD_END && e.who === 'enemy' && b.shield) b.queue.unshift({ type: 'msg', text: 'A CASTLE SHIELD PROTECTS THE FORGER!' });
        if (b.t === CD_END && e.who === 'player' && b.pShield) b.queue.unshift({ type: 'msg', text: 'A CASTLE SHIELD PROTECTS YOU!' });
      } else if (e.move.anim === 'gpunch') {
        duration = GP_END;
        if (b.t === 2) sfx('gshift');
        if (b.t === GP_GLITCH) sfx('glitch');
        if (b.t === GP_FIRE) sfx('gbullet');
        if (b.t === GP_HIT) {
          applyHit(e);
          b.shake = 16;
          const onP = e.who === 'enemy';
          for (let i = 0; i < 30; i++) {
            const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3;
            b.fx.push({ x: onP ? 100 : 298, y: onP ? 118 : 66, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 30, color: ['#ff3eb0', '#5ff0ff', '#ffffff', '#1a1420'][i % 4] });
          }
        }
      } else if (e.move.anim === 'afterimg') {
        duration = AI_END;
        if (b.t === 6) sfx('afterimg');
        if (b.t === 30) sfx('glitch');
        AI_HITS.forEach((ht, i) => {
          if (b.t === ht - 18) sfx('gdash');
          if (b.t === ht && !b.over) {
            applyHit(e);
            b.shake = 14;
            const col = [['#c8d2e0', '#7fdcff'], ['#fff3a8', '#ffffff'], ['#5cc84a', '#8a5a2a']][i];
            for (let k = 0; k < 24; k++) {
              const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3;
              b.fx.push({ x: 104, y: 120, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 26, color: k % 3 ? col[k % 2] : '#ff3eb0' });
            }
          }
        });
        if (b.t === AI_END - 26) sfx('glitch');
      } else if (e.move.anim === 'ginferno') {
        duration = GI_END;
        if (b.t === 10) sfx('ginferno');
        GI_LIGHTS.forEach((lt) => {
          if (b.t === lt) sfx('glightAppear');
        });
        GI_HITS.forEach((ht) => {
          if (b.t === ht - 24) sfx('gcharge');
          if (b.t === ht - 4) sfx('gblueBeam');
          if (b.t === ht && !b.over) {
            applyHit(e);
            b.shake = 24;
          }
        });
        if (b.t > GI_HITS[0] - 4 && b.t < GI_HITS[2] + 20 && b.shake < 4) b.shake = 4;
      } else if (e.move.anim === 'gdomain') {
        duration = GD_END;
        if (b.t === 4) sfx('leap');
        if (!b.gFoes) b.gFoes = glitchFoePool().slice(0, e.move.hits);
        GD_FOE_T.forEach((ft, i) => {
          if (b.t === ft && i < b.gFoes.length) sfx('glightAppear');
        });
        if (b.t === GD_DOME) sfx('domainUp');
        GD_HITS.forEach((ht, i) => {
          if (i >= b.gFoes.length) return;
          if (b.t === ht - 6) sfx('gslash');
          if (b.t === ht && !b.over) {
            applyHit(e);
            b.shake = 14;
            for (let k = 0; k < 20; k++) {
              const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3;
              const [fx, fy] = e.who === 'player' ? [298, 66] : [96, 124];
              b.fx.push({ x: fx, y: fy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 24, color: ['#5ff0ff', '#ffffff', '#ff3eb0'][k % 3] });
            }
          }
        });
        if (b.t === GD_SHATTER) {
          sfx('shieldBreak');
          b.shake = 18;
        }
        if (b.t === GD_END - 22) sfx('whistle');
        if (b.t === GD_END - 6) {
          sfx('land');
          b.shake = 10;
        }
        if (b.t === GD_END) b.gFoes = null;
      } else if (e.move.anim === 'dfist') {
        duration = DF_END;
        if (b.t === 10) sfx('dfistForm');
        if (b.t === DF_HIT - 8) sfx('whistle');
        if (b.t === DF_HIT) {
          applyHit(e);
          b.shake = 22;
          for (let i = 0; i < 30; i++) {
            const a = Math.PI + Math.random() * Math.PI, sp = 1 + Math.random() * 3.5;
            b.fx.push({ x: 96, y: 140, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 30, color: ['#5ff0ff', '#ffffff', '#7a3fd8', '#ff3eb0'][i % 4] });
          }
        }
      } else if (e.move.anim === 'pbarrage') {
        duration = PB_END;
        if (b.t === PB_OPEN - 14) sfx('portal');
        if (b.t === 34) sfx('pzap');
        PB_HITS.forEach((ht, i) => {
          if (b.t === ht && !b.over) {
            applyHit(e);
            b.shake = 10;
            const [px, py] = PB_PORTALS[i];
            for (let k = 0; k < 16; k++) {
              const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.5;
              b.fx.push({ x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 22, color: ['#ff3eb0', '#5ff0ff', '#ffffff'][k % 3] });
            }
          }
          if (b.t === ht + 6 && i < PB_HITS.length - 1) sfx('pzap');
        });
        if (b.t === PB_END - 26) sfx('portal');
        if (b.t === PB_END - 12) sfx('land');
      } else if (e.move.anim === 'gland') {
        duration = GL_END;
        if (b.t === 8) sfx('quake');
        GL_RISE.forEach((rt) => {
          if (b.t === rt) sfx('stoneRise');
        });
        if (b.t === GL_RISE[3] + 20) sfx('gcharge');
        if (b.t > GL_RISE[0] && b.t < GL_HIT && b.shake < 3) b.shake = 3;
        if (b.t === GL_HIT) {
          applyHit(e);
          b.shake = 28;
        }
      } else if (e.move.anim === 'destab') {
        duration = DS_END;
        if (b.t === DS_CODE) sfx('codeRush');
        if (b.t === DS_BEAM) sfx('gcharge');
        if (b.t === DS_HIT - 4) sfx('coreBeam');
        if (b.t === DS_HIT) {
          applyHit(e);
          b.shake = 30;
        }
        if (b.t > DS_HIT && b.t < DS_HIT + 30 && b.shake < 6) b.shake = 6;
      } else if (e.move.anim === 'kontrol') {
        duration = Infinity;
        if (!b.ctrl) {
          b.ctrl = {
            t: 0, fromP: e.who === 'player', jy: 0, jv: 0, boxes: [], parts: [], pops: [],
            dodged: 0, hurt: 0, shake: 0, done: false, doneT: 0, overT: 0,
          };
        }
        updateCtrl(e);
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
    } else if (e.type === 'break') {
      b.t++;
      const gap = Math.max(3, 18 - Math.floor(b.t / 7));
      if (b.t < BREAK_BOOM && b.t % gap === 0) sfx('warn');
      if (b.t % 16 === 0 && b.t < BREAK_BOOM) sfx('spark');
      if (b.t === BREAK_BOOM) {
        sfx('megaBoom');
        b.shake = 26;
      }
      if (b.t >= BREAK_BOOM + 80) b.cur = null;
    } else if (e.type === 'release') {
      b.t++;
      if (b.t === 1) {
        sfx('shieldBreak');
        if (e.who === 'player') b.pShieldRel = 40;
        else b.shieldRel = 40;
      }
      if (b.t >= 40) {
        b.cur = null;
        b.queue.unshift({ type: 'msg', text: e.who === 'player' ? 'YOUR SHIELD WAS RELEASED!' : 'THE SHIELD WAS RELEASED!' });
      }
    } else if (e.type === 'shatter') {
      b.t++;
      if (b.t === 1) sfx('glitchShatter');
      if (b.t % 12 === 0 && b.t < SHATTER_BOOM) sfx('glitch');
      if (b.t % 4 === 0 && b.t < SHATTER_BOOM) b.shake = Math.max(b.shake, 2 + Math.floor(b.t / 30));
      if (b.t === SHATTER_BOOM) {
        sfx('megaBoom');
        b.shake = 26;
      }
      if (b.t >= SHATTER_END) b.cur = null;
    } else if (e.type === 'overload') {
      b.t++;
      if (b.t === 1) sfx('coreAlarm');
      if (b.t % 10 === 0 && b.t < OVERLOAD_BOOM) sfx(b.t % 20 ? 'spark' : 'glitch');
      if (b.t % 4 === 0 && b.t < OVERLOAD_BOOM) b.shake = Math.max(b.shake, 2 + Math.floor(b.t / 25));
      if (b.t === OVERLOAD_BOOM) {
        sfx('megaBoom');
        b.shake = 28;
      }
      if (b.t >= OVERLOAD_END) b.cur = null;
    } else if (e.type === 'crumble') {
      b.t++;
      if (b.t === 1) sfx('crumble');
      if (b.t % 14 === 0 && b.t < 130) sfx('boom');
      if (b.t === 60) sfx('ghostWail');
      if (b.t % 4 === 0 && b.t < 140) b.shake = Math.max(b.shake, 2 + Math.floor(b.t / 30));
      if (b.t === 140) {
        sfx('megaBoom');
        b.shake = 24;
      }
      if (b.t >= CRUMBLE_END) b.cur = null;
    } else if (e.type === 'end') {
      b.phase = 'done';
      b.over = true;
      sfx(e.win ? 'victory' : 'defeat');
      const done = e.win ? b.onWin : b.onLose;
      if (e.win && b.enemy.reward) addItem(b.enemy.reward);
      if (e.win && !b.admin) classicSave(b.id);
      fadeThen(() => {
        game.mode = b.returnMode;
        battle = null;
        done();
      });
    }
  }

  function inGlitchWorld() {
    if (game.mode === 'climb' && (climb.state === 'outro' || (climb.state === 'stabilize' && climb.t > ST_BOOM))) return false;
    const glitchy = ['crash', 'wreck', 'ruins', 'groad', 'climb'];
    if (glitchy.includes(game.mode)) return true;
    if (game.mode === 'battle' && battle) return glitchy.includes(battle.returnMode);
    return game.mode === 'transition' && !!pendingBattle && glitchy.includes(pendingBattle.returnMode);
  }

  function pickMusic() {
    if (game.mode === 'menu') return 'menu';
    if (game.mode === 'coma') return null;
    if (game.mode === 'castle') return 'castle';
    if (game.mode === 'maze') return 'maze';
    if (game.mode === 'omen') return null;
    if (game.mode === 'ufo') return ship.phase === 'cut' && ship.cutT < 300 ? null : 'ufo';
    if (game.mode === 'bridge') {
      if (bridge.state === 'pose') return bridge.t > 40 ? 'battle_captain' : null;
      if (bridge.state === 'fight' || bridge.state === 'beaten' || bridge.state === 'failure') return null;
      return bridge.state === 'outro' ? (bridge.t > 150 ? 'ending' : null) : 'captain';
    }
    if (game.mode === 'crash') return null;
    if (game.mode === 'wreck') {
      if (wreck.state === 'pose') return wreck.t > 40 ? 'battle_brokenMech' : null;
      if (['boot', 'talk', 'fight', 'broken'].includes(wreck.state)) return null;
      return 'wreck';
    }
    if (game.mode === 'ruins') {
      const s = ruins.state;
      if (s === 'pose') return ruins.t > 40 ? 'battle_thousandForger' : null;
      if (s === 'appear' || s === 'talk' || s === 'again') return 'haunt';
      if (s === 'dying') return 'lament';
      if (s === 'outro') return ruins.t > 150 ? 'ending' : null;
      if (['rumble', 'explode', 'fight', 'dissolve', 'gone'].includes(s)) return null;
      return 'ruins';
    }
    if (game.mode === 'groad') {
      const s = groad.state;
      if (s === 'pose') return groad.t > 40 ? 'battle_glitch' : null;
      if (s === 'meet' || s === 'talk' || s === 'again') return 'echo';
      if (s === 'dying') return 'lament';
      if (s === 'outro') return groad.t > 150 ? 'ending' : null;
      if (['shot', 'threat', 'fight', 'dissolve', 'gone'].includes(s)) return null;
      return 'groad';
    }
    if (game.mode === 'climb') {
      const s = climb.state;
      if (s === 'pose') return climb.t > 40 ? 'battle_core' : null;
      if (s === 'meet' || s === 'talk' || s === 'again') return 'coreTheme';
      if (s === 'dying') return 'lament';
      if (s === 'stabilize') return climb.t > ST_BOOM + 10 ? 'dawn' : null;
      if (s === 'outro') return climb.t > 150 ? 'ending' : null;
      if (s === 'fight') return null;
      return player.y < CL_G - 200 ? 'skystairs' : 'barren';
    }
    if (game.mode === 'mech') {
      if (mechIntro.on) return mechIntro.t > 40 ? 'battle_mechanic' : null;
      if (mechCutscene() || (mechNpc.state === 'talk' && !mechRoom.leaving)) return null;
      return 'mech';
    }
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
    if (window.Sound) {
      window.Sound.music(exportState.on ? null : pickMusic());
      if (window.Sound.glitch) window.Sound.glitch(inGlitchWorld());
    }
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
    } else if (game.mode === 'ufo') {
      updateShip();
    } else if (game.mode === 'mech') {
      updateMech();
    } else if (game.mode === 'bridge') {
      updateBridge();
    } else if (game.mode === 'crash') {
      updateCrash();
    } else if (game.mode === 'wreck') {
      updateWreck();
    } else if (game.mode === 'ruins') {
      updateRuins();
    } else if (game.mode === 'groad') {
      updateGlitchRoad();
    } else if (game.mode === 'climb') {
      updateClimb();
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

  let glitchSelfDrawing = false;
  function drawImg(img, x, y, face, scale = 1) {
    const dx = Math.round(x);
    const dy = Math.round(y);
    const w = img.width * scale;
    const h = img.height * scale;
    if (!glitchSelfDrawing && inv.equipped === 'glitchCrystal' && (img === playerBack || playerFrames.includes(img))) {
      glitchSelfDrawing = true;
      drawGlitchSprite(img, dx + w / 2, dy + h, scale, face, 0.45, 3);
      glitchSelfDrawing = false;
      return;
    }
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
    ctx.fillStyle = { MONKEY: '#6b4220', ANGEL: '#b8901a', 'SKY BIRD': '#24509a', 'LIGHT OF GODS': '#c8a020', KNIGHT: '#4a5468', ARCHER: '#2e7d32', JOKER: '#7a2a9c', KING: '#b8701a', MECHANIC: '#b8501a', CAPTAIN: '#2a3a7a', 'BROKEN MECH': '#4a2a8a', '???': '#1a1a2a', 'THOUSAND FORGER': '#1e6a5a', 'THE GLITCH': '#5a1a6a', 'THE CORE': '#2a1a6a', [playerName]: '#1d4a9e' }[dialog.speaker] || '#9a1c1a';
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
    const t = (clockNow() - titleStart) / 1000;
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
    titleStart = clockNow();
    sfx('title');
  }

  function drawHint() {
    if (titleStart === null || !titleInfo.hint) return;
    const t = (clockNow() - titleStart) / 1000;
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
  function drawGemFx(id, cx, cy, s) {
    if (id === 'glitchCrystal') {
      const img = ITEM_SPRITES[id], w = img.width * s, h = img.height * s;
      const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
      const ph = tick % 300;
      const split = ph < 70 ? Math.sin((ph / 70) * Math.PI) : 0;
      if (split > 0) {
        const d = Math.round(split * 7 * s);
        ctx.save();
        ctx.globalAlpha *= 0.9;
        drawImg(tinted(img, '#ff3eb0'), x0 - d, y0 + Math.round(split * s), 1, s);
        drawImg(tinted(img, '#5ff0ff'), x0 + d, y0 - Math.round(split * s), 1, s);
        ctx.restore();
        drawImg(img, x0, y0, 1, s);
      } else if (hash(Math.floor(tick / 4) * 1.37) < 0.25) {
        ctx.save();
        ctx.globalAlpha *= 0.6;
        drawImg(tinted(img, '#ff3eb0'), x0 - s, y0, 1, s);
        drawImg(tinted(img, '#5ff0ff'), x0 + s, y0, 1, s);
        ctx.restore();
        drawImg(img, x0, y0, 1, s);
      }
      if (hash(Math.floor(tick / 3) * 2.1) < 0.3) {
        const sy = y0 + Math.floor(hash(tick * 0.7) * h), sh = Math.max(1, Math.round(s * 1.5));
        const dx = Math.round((hash(tick * 1.3) - 0.5) * 4 * s);
        ctx.drawImage(cvs, x0 - 2, sy, w + 4, sh, x0 - 2 + dx, sy, w + 4, sh);
      }
      for (let i = 0; i < 3; i++) {
        if (hash(i * 3.7 + Math.floor(tick / 5)) < 0.5) continue;
        cRect(Math.round(cx + (hash(i + Math.floor(tick / 5) * 1.1) - 0.5) * w * 1.6), Math.round(cy + (hash(i * 2 + Math.floor(tick / 5)) - 0.5) * h * 1.4), Math.max(1, s - 1), Math.max(1, s - 1), i % 2 ? '#5ff0ff' : '#ff3eb0');
      }
    } else if (id === 'brokenCrystal') {
      for (let i = 0; i < 3; i++) {
        const T = Math.floor((tick + i * 7) / 5) + i * 31;
        if (hash(T * 1.3) < 0.45) continue;
        const a = hash(T * 2.7) * Math.PI * 2, r = 3 * s + hash(T * 4.1) * 2 * s;
        let x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.9;
        const col = hash(T * 5.3) < 0.5 ? '#ffe14d' : '#5ff0ff';
        for (let k = 0; k < 3; k++) {
          const nx = x + Math.cos(a) * s * 1.4 + (hash(T + k * 3.3) - 0.5) * s * 2;
          const ny = y + Math.sin(a) * s * 1.4 + (hash(T * 1.9 + k) - 0.5) * s * 2;
          pxLine(Math.round(x), Math.round(y), Math.round(nx), Math.round(ny), col);
          x = nx;
          y = ny;
        }
        cRect(Math.round(x), Math.round(y), Math.max(1, s - 1), Math.max(1, s - 1), '#ffffff');
      }
    } else if (id === 'forgerCrystal') {
      const bw = Math.max(2, Math.round(s * 1.4)), bh = Math.max(1, s);
      for (let i = 0; i < 3; i++) {
        const a = tick * 0.04 + i * 2.094;
        const x = Math.round(cx + Math.cos(a) * 5.5 * s - bw / 2);
        const y = Math.round(cy + Math.sin(a) * 2 * s + Math.sin(tick * 0.08 + i) * s * 0.5 - bh / 2);
        cRect(x - 1, y - 1, bw + 2, bh + 2, '#1a1420');
        cRect(x, y, bw, bh, i % 2 ? '#8a8698' : '#b8b4c6');
        if (bw > 3) cRect(x + Math.floor(bw / 2), y, 1, bh, '#5e5a76');
      }
    }
  }

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
    mechCrystal: buildSprite(GEM_ROWS, {
      k: '#1a1420', w: '#ffffff', y: '#bff8ff', o: '#5ff0ff', r: '#e8742a', R: '#8a3a10',
    }),
    captainCrystal: buildSprite(GEM_ROWS, {
      k: '#1a1420', w: '#ffffff', y: '#c8ffb0', o: '#6fd86a', r: '#2a3a7a', R: '#1a2450',
    }),
    brokenCrystal: buildSprite(GEM_ROWS, {
      k: '#1a1420', w: '#ffffff', y: '#5ff0ff', o: '#c8a8ff', r: '#7a3fd8', R: '#2a1650',
    }),
    forgerCrystal: buildSprite(GEM_ROWS, {
      k: '#1a1420', w: '#ffffff', y: '#e8fff8', o: '#b8ff6a', r: '#5e5a76', R: '#2a2838',
    }),
    glitchCrystal: buildSprite(GEM_ROWS, {
      k: '#1a1420', w: '#ffffff', y: '#5ff0ff', o: '#ff3eb0', r: '#d8322e', R: '#3a0a2a',
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
    if (canTeleport()) drawTeleportButton();
  }

  function drawTeleportButton() {
    const r = TP_BTN;
    const hover = inRect(mouse, r);
    ctx.fillStyle = '#1c140c';
    ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    ctx.fillStyle = hover ? '#9c3fd8' : '#7a2a9c';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#5a1a78';
    ctx.fillRect(r.x, r.y + r.h - 2, r.w, 2);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2 - 1;
    ctx.fillStyle = '#1a0a2a';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5ff0ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 7, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = tick * (hover ? 0.2 : 0.08) + (i * Math.PI) / 3, rr = 2 + (i % 3) * 1.5;
      ctx.fillStyle = i % 2 ? '#ff3eb0' : '#ffffff';
      ctx.fillRect(Math.round(cx + Math.cos(a) * rr) - 1, Math.round(cy + Math.sin(a) * rr * 0.85) - 1, 2, 2);
    }
    if (hover) drawText('TELEPORT (T)', r.x + r.w, r.y + r.h + 4, 8, '#ffffff', 'right', '#1a0e2a');
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
        drawGemFx(id, r.x + r.w / 2, r.y + r.h / 2, 3);
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
      drawText(item.name + (inv.equipped === sel ? ' (EQUIPPED)' : ''), P.x + 18, P.y + 120, 8, '#9a1c1a', 'left', null);
      wrapText(item.desc, P.w - 36).forEach((line, i) => drawText(line, P.x + 18, P.y + 132 + i * 10, 8, '#3b2a1a', 'left', null));
    } else {
      drawText(inventory.some(Boolean) ? 'SELECT AN ITEM' : 'YOUR BAG IS EMPTY', P.x + 18, P.y + 128, 8, '#8a7550', 'left', null);
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
    const shipBg = b.enemy.bg === 'ship';
    const wreckBg = b.enemy.bg === 'wreck';
    const ruinsBg = b.enemy.bg === 'ruins';
    const glitchBg = b.enemy.bg === 'glitch';
    const coreBg = b.enemy.bg === 'core';
    const ufoBg = b.enemy.bg === 'ufo' || shipBg || wreckBg || ruinsBg || glitchBg || coreBg;
    const skyBands = ufoBg ? ['#0e0c22', '#141030', '#1a143c', '#201848', '#261c52']
      : heaven ? ['#f6d77a', '#f9e29a', '#fbecb8', '#fdf4d4', '#fffaea']
      : cloudBg ? ['#2c4aa6', '#3a5cb8', '#4a70c8', '#6189d6', '#7ca0e2', '#9ab8ee']
      : castleBg ? ['#1e1b2a', '#24202f', '#2a2638', '#302b40', '#36314a'] : SKY;
    const band = Math.ceil(HORIZON / skyBands.length);
    skyBands.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(-8, i * band, W + 16, band);
    });
    const forest = b.enemy.bg === 'forest';
    if (coreBg) {
      drawCoreBattleBg(HORIZON);
    } else if (glitchBg) {
      drawGlitchBattleBg(HORIZON);
    } else if (ruinsBg) {
      drawRuinsBattleBg(HORIZON);
    } else if (wreckBg) {
      drawWreckBattleBg(HORIZON);
    } else if (shipBg) {
      drawShipBattleBg(HORIZON);
    } else if (ufoBg) {
      drawUfoBattleBg(HORIZON);
    } else if (heaven) {
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
    if (!heaven && !cloudBg && !castleBg && !ufoBg) {
      ctx.fillStyle = forest ? '#86c070' : '#9fd38a';
      ctx.fillRect(-8, HORIZON, W + 16, H - HORIZON);
      ctx.fillStyle = forest ? '#78b062' : '#8cc878';
      for (let y = HORIZON + 4, gap = 4; y < 164; gap += 2, y += gap) ctx.fillRect(-8, y, W + 16, 2);
    }

    const slide = clamp(1 - b.introT / 30, 0, 1);
    const eBaseX = 282 + Math.round(slide * 160);
    const pBaseX = 72 - Math.round(slide * 160);

    const pal = coreBg ? ['#8a6ad8', '#5a3aa8', '#2a1a5a']
      : glitchBg ? ['#5a3a7a', '#3a2456', '#22143a']
      : ruinsBg ? ['#7d7892', '#5e5a72', '#3e3a52']
      : wreckBg ? ['#5a4a5e', '#3e3046', '#2a2032']
      : ufoBg ? ['#8a96aa', '#6e7a90', '#4a5468']
      : heaven ? ['#fff3a8', '#ffd84a', '#e0b830']
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
    const mechAnim = e && e.type === 'hit' ? e.move.anim : null;
    if (mechAnim === 'mech' && b.t >= MECH_SUIT_T && b.t < MECH_END - 4) {
      if (e.who === 'player') pHide = true;
      else eHide = true;
    }
    if (mechAnim === 'katana' && b.t >= 42 && b.t < 100) {
      if (e.who === 'player') pHide = true;
      else eHide = true;
    }

    const transforming = e && e.type === 'transform';
    const breaking = e && e.type === 'break';
    const crumbling = e && e.type === 'crumble';
    const shattering = e && e.type === 'shatter';
    const eFainted = b.ehp === 0 && b.eHurt === 0 && !transforming && !(breaking && b.t < BREAK_BOOM) && !(crumbling && b.t < 140) && !(shattering && b.t < SHATTER_BOOM) && !(e && e.type === 'overload' && b.t < OVERLOAD_BOOM);
    const gk = b.enemy.glitchKid ? glitchKidPose(b, e) : null;
    if (gk && gk.hide) eHide = true;
    const overloading = e && e.type === 'overload';
    if (overloading && b.t >= OVERLOAD_BOOM) eHide = true;
    if (mechAnim === 'pbarrage' && b.t >= 34 && b.t < PB_END - 14) {
      if (e.who === 'player') eHide = true;
      else pHide = true;
    }
    if (mechAnim === 'gpunch' && e.who === 'player') pOff += gpShift(b.t);
    if (mechAnim === 'gdomain' && e.who === 'player') {
      const lt = b.t;
      if (lt < 6) pDy = 3;
      else if (lt < 22) pDy = -Math.round(Math.pow((lt - 6) / 16, 2) * 160);
      else if (lt < GD_END - 22) pHide = true;
      else if (lt < GD_END - 6) pDy = -Math.round(Math.pow(1 - (lt - (GD_END - 22)) / 16, 2) * 160);
    }
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
      } else if (b.enemy.broken) {
        const anim = e && e.type === 'hit' && e.who === 'enemy' ? e.move.anim : null;
        const over = anim === 'overactive';
        const crazy = (over && b.t > 90 && b.t < 290) || (breaking && b.t > 40);
        const jit = crazy ? Math.round((Math.random() - 0.5) * (breaking ? b.t / 18 : 4)) : 0;
        drawBrokenMech(eBaseX + 18 + eOff + jit, 97 + eDy, 0.95, -1, {
          noArm: anim === 'bpunch' || anim === 'smash' || (over && b.t >= OVER_FIST - 4 && b.t < OVER_FIST + 44),
          rage: over ? clamp((b.t - 90) / 20, 0, 1) * (b.t < 290 ? 1 : 0) : anim === 'inferno' && b.t < 100 ? clamp(b.t / 30, 0, 1) : 0,
          lights: breaking ? b.t / BREAK_BOOM : 0,
        });
      } else if (b.enemy.forger) {
        drawForger(eBaseX + 18 + eOff, 100 + eDy, FG_S, forgerBattlePose(b, e, crumbling));
      } else if (gk) {
        drawGlitchKid(eBaseX + 18 + eOff + gk.dx, 94 + eDy + gk.dy, 3, -1, gk.amt, gk.blink);
      } else if (b.enemy.core) {
        const foeAnim = e && e.type === 'hit' && e.who === 'enemy' ? e.move.anim : null;
        const crack = overloading ? clamp(b.t / OVERLOAD_BOOM, 0, 1) : 0;
        const jit = crack ? Math.round((Math.random() - 0.5) * crack * 6) : 0;
        drawBigCore(eBaseX + 18 + eOff + jit, 54 + eDy + Math.round(Math.sin(tick * 0.05) * 3), 1.6, {
          rage: foeAnim ? 1 : 0, crack, eye: b.introT % 200 < 8 ? 0 : 1,
        });
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
    if (b.enemy.hands && !eFainted && !eHide) {
      const foeAnim = e && e.type === 'hit' && e.who === 'enemy' ? e.move.anim : null;
      for (let i = 0; i < 2; i++) {
        if (foeAnim === 'mash' || foeAnim === 'mech' || (foeAnim === 'mpunch' && i === 0)) continue;
        const [hx, hy] = mechHandPos(false, i, eBaseX, pBaseX);
        drawMechFist(hx + eOff, hy + eDy, -1, 2, 0.35);
      }
      if (foeAnim !== 'ray') drawRayGun(eBaseX + 4 + eOff, 76 + eDy, -Math.PI / 2, 1.2);
    }
    if (b.enemy.captain && !eFainted && !eHide) {
      const foeAnim = e && e.type === 'hit' && e.who === 'enemy' ? e.move.anim : null;
      if (foeAnim !== 'katana') drawKatana(eBaseX + 30 + eOff, 52 + eDy, 2.3, 1, 0, 0);
      if (foeAnim !== 'cray') drawCapGun(eBaseX - 2 + eOff, 80 + eDy, Math.PI / 2, 1);
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
    const pForm = inv.equipped && ITEMS[inv.equipped] ? ITEMS[inv.equipped].form : null;
    if (!pFainted && !pHide && !(b.pHurt > 0 && Math.floor(b.pHurt / 3) % 2 === 0)) {
      const bob = Math.floor(b.introT / 30) % 2;
      const pAnim = e && e.type === 'hit' && e.who === 'player' ? e.move.anim : null;
      if (pForm === 'broken') {
        const over = pAnim === 'overactive';
        const jit = over && b.t > 90 && b.t < 290 ? Math.round((Math.random() - 0.5) * 4) : 0;
        drawBrokenMech(pBaseX + 24 + pOff + jit, PM_BOT + pDy, BM_S, 1, {
          noArm: pAnim === 'smash' || (over && b.t >= OVER_FIST - 4 && b.t < OVER_FIST + 44),
          rage: over ? clamp((b.t - 90) / 20, 0, 1) * (b.t < 290 ? 1 : 0) : pAnim === 'inferno' && b.t < 100 ? clamp(b.t / 30, 0, 1) : 0,
        });
      } else if (pForm === 'forger') {
        drawForger(pBaseX + 24 + pOff, PF_BOT + pDy, PF_S, forgerBattlePose(b, e, false, 'player'));
      } else {
        drawImg(playerBack, pBaseX + pOff, 154 - 72 + 4 + bob + pDy, 1, 4);
      }
      if (pGold > 0 && !pForm) {
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
    if (mechAnim === 'mpunch') drawMechPunch({ fromP: e.who === 'player', lt: b.t }, eBaseX, pBaseX);
    if (mechAnim === 'ray') drawRayBlast({ fromP: e.who === 'player', lt: b.t }, eBaseX, pBaseX);
    if (mechAnim === 'mash') drawMashUp({ fromP: e.who === 'player', lt: b.t }, eBaseX, pBaseX);
    if (mechAnim === 'mech') drawMechBattle({ fromP: e.who === 'player', lt: b.t }, eBaseX, pBaseX);
    if (mechAnim === 'cpunch') drawCapPunch({ fromP: e.who === 'player', lt: b.t }, eBaseX, pBaseX);
    if (mechAnim === 'cray') drawCapRay({ fromP: e.who === 'player', lt: b.t }, eBaseX, pBaseX);
    if (mechAnim === 'katana') drawCapKatana({ fromP: e.who === 'player', lt: b.t }, eBaseX, pBaseX);
    const atkP = !!(e && e.who === 'player');
    if (pForm !== 'forger' && (b.pShield || b.pShieldRel > 0)) drawPlayerShield(pBaseX + 24, 118, b.pShield ? 1 : b.pShieldRel / 40, b.pShieldHit > 0);
    if (mechAnim === 'bpunch' && !atkP) drawBmPunch(b.t, eBaseX, pBaseX);
    if (mechAnim === 'smash') drawBmSmash(b.t, eBaseX, pBaseX, atkP);
    if (mechAnim === 'inferno') drawBmInferno(b.t, eBaseX, pBaseX, atkP);
    if (mechAnim === 'overactive' && b.t >= 100) drawBmOveractive(b.t, eBaseX, pBaseX, atkP);
    if (breaking) drawMechBreak(b.t, eBaseX);
    if (mechAnim === 'fpunch' && !atkP) drawFgPunch(b.t, eBaseX, pBaseX);
    if (mechAnim === 'brick') drawFgBrick(b.t, eBaseX, pBaseX, atkP);
    if (mechAnim === 'gbeam' && b.t >= GB_CUT) drawFgBeam(b.t, eBaseX, pBaseX, atkP);
    if (mechAnim === 'cdef' && b.t >= CD_CUT) drawFgShock(b.t, eBaseX, pBaseX, atkP);
    if (crumbling) drawForgerCrumble(b.t, eBaseX);
    if (mechAnim === 'gpunch') drawGlitchPunch(b.t, eBaseX, pBaseX, atkP);
    if (mechAnim === 'dfist') drawDigitalFist(b.t, pBaseX);
    if (mechAnim === 'pbarrage') drawPortalBarrage(b.t, eBaseX, pBaseX, atkP);
    if (overloading) drawCoreOverload(b.t, eBaseX);
    if (mechAnim === 'afterimg') drawAfterImage(b.t, eBaseX, pBaseX);
    if (mechAnim === 'gdomain' && b.t >= 6 && b.t < 24) {
      ctx.fillStyle = '#ffffff';
      const [sx, sy] = atkP ? [pBaseX + 8, 140] : [eBaseX + 4, 40];
      for (let i = 0; i < 5; i++) ctx.fillRect(sx + i * 7, sy - ((b.t * 9 + i * 13) % 50), 2, 16);
    }
    if (shattering) drawGlitchShatter(b.t, eBaseX);
    if (pForm === 'forger' && b.pShieldHit > 0) drawComic('BLOCKED!', pBaseX + 24, 70, 20 - b.pShieldHit, '#b8ff6a');
    if (b.enemy.forger && b.shieldHit > 0) drawComic('BLOCKED!', eBaseX - 10, 30, 20 - b.shieldHit, '#b8ff6a');

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
            drawGemFx(it.gem, r.x + 4 + img.width / 2, r.y + r.h / 2, 1);
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
    if (e && e.type === 'hit' && e.move.anim === 'mech') drawMechCutscene({ fromP: e.who === 'player', lt: b.t });
    if (e && e.type === 'hit' && e.move.anim === 'katana' && b.t < 40) drawKatanaCutscene({ fromP: e.who === 'player', lt: b.t });
    if (b.ctrl) drawCtrlScene(b);
    if (e && e.type === 'hit' && e.move.anim === 'overactive' && b.t < 110) drawOverCutscene(b.t, e.who === 'player');
    if (e && e.type === 'hit' && e.move.anim === 'gbeam' && b.t < GB_CUT) drawBeamCutscene(b.t, e.who === 'player');
    if (e && e.type === 'hit' && e.move.anim === 'cdef' && b.t < CD_CUT) drawDefCutscene(b.t, e.who === 'player');
    if (e && e.type === 'hit' && e.move.anim === 'ginferno') drawGlitchInferno(b.t, e.who === 'player' ? b : null);
    if (e && e.type === 'hit' && e.move.anim === 'gland') drawGlitchLandscape(b.t);
    if (e && e.type === 'hit' && e.move.anim === 'destab') drawDestabilize(b.t);
    if (e && e.type === 'hit' && e.move.anim === 'gdomain') drawGlitchDomain(b, b.t, e.who === 'player');
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

  function drawComic(text, x, y, t, col, joke = false) {
    if (!joke) {
      const num = text.match(/-\d+/);
      if (!num) return;
      text = num[0];
    }
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
      drawComic('BONK!', tx, ty - 26, lt - 16, '#ffe14d', true);
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
        drawComic('POP!', tx, ty - 36, lt - 57, '#ff3e6c', true);
        drawStars(tx, ty - 6, 6, lt);
      }
      if (lt >= 60 && lt < 90 && lt % 10 < 6) drawComic('HONK!', bx + 30, by - 60, 6, '#ffe14d', true);
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
      drawComic('HA', W / 2 - 44, 26 + Math.sin(tick * 0.2) * 4, 6, '#ffe14d', true);
      drawComic('HA!', W / 2 + 48, 34 + Math.cos(tick * 0.2) * 4, 6, '#ff3e6c', true);
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
      drawComic(safe ? 'PHEW! SAFE!' : 'KA-BOOM! -6', W / 2, 180, t - 14, safe ? '#7ed860' : '#ff3e6c', true);
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

  function drawMechFist(x, y, dir, s = 1, glow = 0, rot = 0) {
    if (glow > 0) {
      ctx.save();
      ctx.globalAlpha = glow * (0.3 + 0.15 * Math.sin(tick * 0.4));
      blob(Math.round(x), Math.round(y), Math.round(12 * s), '#5ff0ff');
      ctx.restore();
    }
    const R = (rx, ry, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(rx, ry, w, h);
    };
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(rot);
    ctx.scale(dir * s, s);
    R(-13, -5, 8, 10, '#1a1420');
    R(-12, -4, 6, 8, '#4a5468');
    R(-8, -5, 1, 10, '#5ff0ff');
    R(-6, -8, 15, 16, '#1a1420');
    R(-5, -7, 13, 14, '#8a96aa');
    R(-5, -7, 13, 2, '#c8d2e0');
    R(-5, 3, 13, 1, '#e8742a');
    R(8, -7, 4, 14, '#1a1420');
    R(8, -6, 3, 12, '#6e7a90');
    for (const ky of [-3, 0, 3]) R(8, ky, 3, 1, '#1a1420');
    R(-2, 6, 8, 3, '#1a1420');
    R(-1, 6, 6, 2, '#6e7a90');
    R(-1, -2, 2, 2, '#4a5468');
    ctx.restore();
  }

  function drawRayGun(x, y, ang, s = 1) {
    const R = (rx, ry, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(rx, ry, w, h);
    };
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(ang);
    ctx.scale(s, Math.abs(ang) > Math.PI / 2 ? -s : s);
    R(-6, -6, 4, 3, '#1a1420');
    R(-5, -5, 2, 2, '#ffe14d');
    R(-7, -3, 14, 7, '#1a1420');
    R(-6, -2, 12, 5, '#c2202e');
    R(-6, -2, 12, 1, '#ff6b6b');
    R(6, -2, 9, 5, '#1a1420');
    R(6, -1, 8, 3, '#c8d2e0');
    R(8, -2, 1, 5, '#5ff0ff');
    R(11, -2, 1, 5, '#5ff0ff');
    R(14, -2, 3, 5, '#5ff0ff');
    R(-4, 3, 5, 6, '#1a1420');
    R(-3, 3, 3, 5, '#4a4a5a');
    ctx.restore();
  }

  const mechHandPos = (fromP, i, eBaseX, pBaseX) => {
    const bob = Math.sin(tick * 0.07 + i * 2) * 3;
    if (fromP) return i === 0 ? [pBaseX + 66, 102 + bob] : [pBaseX - 10, 94 + bob];
    return i === 0 ? [eBaseX - 18, 56 + bob] : [eBaseX + 54, 48 + bob];
  };

  function drawMechPunch({ fromP, lt }, eBaseX, pBaseX) {
    const [hx, hy] = mechHandPos(fromP, 0, eBaseX, pBaseX);
    const [tx, ty] = fromP ? [eBaseX + 6, 62] : [pBaseX + 38, 118];
    const dir = fromP ? 1 : -1;
    let p = 0, wind = 0;
    if (lt < 4) wind = lt * 2;
    else if (lt < 18) p = Math.pow((lt - 4) / 14, 2);
    else if (lt < 24) p = 1;
    else p = Math.max(0, 1 - (lt - 24) / 16);
    const x = hx + (tx - hx) * p - dir * wind, y = hy + (ty - hy) * p;
    if (lt >= 4 && lt < 18) {
      ctx.fillStyle = '#c8d2e0';
      for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(x - dir * (18 + i * 8)), Math.round(y - 6 + i * 4), 10, 1);
    }
    drawMechFist(x, y, dir, 2, lt < 18 ? 0.6 : 0);
    if (lt >= 18 && lt < 28) {
      drawStars(tx, ty - 10, 6, lt);
      drawComic('CLANK!', tx, ty - 36, lt - 18, '#5ff0ff');
    }
  }

  function drawRayBlast({ fromP, lt }, eBaseX, pBaseX) {
    const [gx, gy] = fromP ? [pBaseX + 58, 104] : [eBaseX - 6, 60];
    const [tx, ty] = fromP ? [eBaseX + 18, 62] : [pBaseX + 24, 116];
    const ang = Math.atan2(ty - gy, tx - gx);
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const recoil = lt >= 30 && lt < 38 ? 4 - (lt - 30) / 2 : 0;
    const mx = gx + ux * (24 - recoil), my = gy + uy * (24 - recoil);
    if (lt < 82) drawRayGun(gx - ux * recoil, gy - uy * recoil, ang, 1.5);
    if (lt >= 2 && lt < 32) {
      const k = (lt - 2) / 30;
      ctx.save();
      ctx.globalAlpha = 0.35 + k * 0.4;
      blob(Math.round(mx), Math.round(my), Math.round(3 + k * 10), '#5ff0ff');
      ctx.globalAlpha = 0.8;
      blob(Math.round(mx), Math.round(my), Math.round(1 + k * 4), '#ffffff');
      ctx.restore();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + lt * 0.25;
        const d = (32 - lt) * 1.4 + 3;
        ctx.fillStyle = i % 2 ? '#5ff0ff' : '#ff4ae8';
        ctx.fillRect(Math.round(mx + Math.cos(a) * d), Math.round(my + Math.sin(a) * d), 2, 2);
      }
      if (lt > 14 && lt % 6 < 3) drawText('!', mx, my - 22, 8, '#5ff0ff', 'center', '#1a1420');
    }
    if (lt >= 30 && lt < 68) {
      const k = lt < 34 ? (lt - 30) / 4 : lt > 56 ? (68 - lt) / 12 : 1;
      const w = (12 + Math.sin(lt * 0.9) * 2) * k;
      const ex = tx + ux * 30, ey = ty + uy * 30;
      ctx.save();
      ctx.globalAlpha = 0.12 * k;
      ctx.fillStyle = '#5ff0ff';
      ctx.fillRect(-8, 0, W + 16, H);
      ctx.lineCap = 'round';
      const beam = (lw, col, a) => {
        ctx.globalAlpha = a;
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      };
      beam(w * 2, '#ff4ae8', 0.35 * k);
      beam(w * 1.3, '#5ff0ff', 0.8 * k);
      beam(w * 0.5, '#ffffff', k);
      ctx.globalAlpha = k;
      for (let i = 0; i < 6; i++) {
        const p = ((lt * 0.08 + i / 6) % 1);
        const rx = mx + (ex - mx) * p, ry = my + (ey - my) * p;
        ctx.strokeStyle = i % 2 ? '#ffffff' : '#ff4ae8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(rx, ry, 2, w, ang, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (lt >= 36 && lt < 66) {
      const d = lt - 36;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - d / 30);
      blob(tx, ty, 12 + (d % 6), '#5ff0ff');
      blob(tx, ty, 6 + (d % 4), '#ffffff');
      ctx.restore();
      if (d < 3) {
        ctx.fillStyle = 'rgba(200,250,255,0.7)';
        ctx.fillRect(0, 0, W, H);
      }
      drawComic('ZZZAP!', tx, ty - 44, d, '#5ff0ff');
    }
  }

  function drawMashUp({ fromP, lt }, eBaseX, pBaseX) {
    const [tx, ground] = fromP ? [eBaseX + 18, 96] : [pBaseX + 24, 156];
    if (lt >= 30 && lt < 56) {
      const k = (lt - 30) / 26;
      ctx.fillStyle = `rgba(0,0,0,${0.15 + k * 0.3})`;
      const sw = Math.round(10 + k * 28);
      ctx.fillRect(tx - sw, ground - 2, sw * 2, 4);
    }
    let alpha = 1;
    if (lt >= 70) alpha = Math.max(0, 1 - (lt - 70) / 26);
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 2; i++) {
      const [sx, sy] = mechHandPos(fromP, i, eBaseX, pBaseX);
      const side = i === 0 ? -1 : 1;
      const [hx, hy] = [tx + side * 22, ground - 112];
      const [kx, ky] = [tx + side * 12, ground - 14];
      let x, y, rot;
      if (lt < 30) {
        const p = 1 - Math.pow(1 - lt / 30, 2);
        x = sx + (hx - sx) * p;
        y = sy + (hy - sy) * p;
        rot = (Math.PI / 2) * p;
      } else if (lt < 40) {
        x = hx + (lt % 2 ? 1 : -1);
        y = hy;
        rot = Math.PI / 2;
      } else if (lt < 52) {
        const q = Math.pow((lt - 40) / 12, 2);
        x = hx + (kx - hx) * q;
        y = hy + (ky - hy) * q;
        rot = Math.PI / 2;
        ctx.fillStyle = '#c8d2e0';
        for (let j = 0; j < 3; j++) ctx.fillRect(Math.round(x - 8 + j * 8), Math.round(y - 40 - (j % 2) * 8), 1, 22);
      } else {
        x = kx;
        y = ky - (lt >= 70 ? (lt - 70) * 3 : 0);
        rot = Math.PI / 2;
      }
      drawMechFist(x, y, 1, 2.2, lt >= 30 && lt < 52 ? 0.8 : 0, rot);
    }
    ctx.restore();
    if (lt >= 52 && lt < 72) {
      const d = lt - 52;
      ctx.save();
      ctx.globalAlpha = 1 - d / 20;
      ctx.fillStyle = '#c8d2e0';
      for (let a = 0; a < Math.PI * 2; a += 0.12) {
        ctx.fillRect(Math.round(tx + Math.cos(a) * d * 5), Math.round(ground + Math.sin(a) * d * 1.3), 3, 2);
      }
      ctx.restore();
      if (d < 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(0, 0, W, H);
      }
      drawComic('MASH!', tx, ground - 96, d, '#ff9a2e');
    }
  }

  const MK = { out: '#1a1420', hi: '#d8e2ee', light: '#8a96aa', mid: '#6e7a90', dark: '#4a5468', deep: '#2a3046', or: '#e8742a', yel: '#ffe14d', glow: '#5ff0ff' };
  function mkRect(x, y, w, h, c) {
    ctx.fillStyle = MK.out;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = MK.hi;
    ctx.fillRect(x, y, w, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y + h - 2, w, 2);
  }
  function mkPoly(pts, c) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = MK.out;
    ctx.stroke();
    ctx.fillStyle = c;
    ctx.fill();
  }
  function mkHazard(x, y, w, h) {
    for (let i = 0; i < w; i += 4) {
      ctx.fillStyle = (i / 4) % 2 ? MK.out : MK.yel;
      ctx.fillRect(x + i, y, Math.min(4, w - i), h);
    }
  }
  const MECH_PARTS = [
    {
      from: [0, 1],
      draw() {
        for (const fx of [-25, 6]) {
          mkRect(fx, -7, 19, 7, MK.dark);
          ctx.fillStyle = MK.deep;
          ctx.fillRect(fx, -2, 19, 2);
          mkRect(fx + 19, -5, 4, 5, MK.mid);
          mkRect(fx - 3, -4, 3, 4, MK.mid);
        }
      },
    },
    {
      from: [0, 1],
      draw() {
        for (const lx of [-21, 9]) {
          mkRect(lx, -31, 12, 24, MK.mid);
          ctx.fillStyle = MK.light;
          ctx.fillRect(lx + 2, -28, 3, 16);
          mkHazard(lx, -15, 12, 3);
          blob(lx + 6, -32, 6, MK.out);
          blob(lx + 6, -32, 5, MK.light);
          blob(lx + 6, -32, 2, MK.glow);
        }
      },
    },
    {
      from: [-1, 0],
      draw() {
        for (const lx of [-20, 10]) {
          mkRect(lx, -44, 10, 12, MK.mid);
          ctx.fillStyle = MK.hi;
          ctx.fillRect(lx + 8, -42, 2, 9);
          ctx.fillStyle = MK.deep;
          ctx.fillRect(lx + 3, -41, 1, 7);
        }
      },
    },
    {
      from: [-1, 0],
      draw() {
        mkRect(-23, -50, 46, 8, MK.dark);
        mkHazard(-21, -48, 42, 2);
        blob(0, -45, 3, MK.out);
        blob(0, -45, 2, tick % 30 < 15 ? MK.or : MK.yel);
      },
    },
    {
      from: [-1, -1],
      draw(pilot) {
        mkRect(-36, -80, 11, 28, MK.dark);
        ctx.fillStyle = MK.mid;
        ctx.fillRect(-35, -76, 2, 20);
        mkRect(-38, -54, 9, 5, MK.deep);
        if (pilot) {
          const fl = 3 + (tick % 4);
          ctx.fillStyle = '#ff9a2e';
          ctx.fillRect(-37, -49, 7, fl);
          ctx.fillStyle = MK.yel;
          ctx.fillRect(-36, -49, 5, Math.max(1, fl - 2));
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-35, -49, 3, 1);
        }
      },
    },
    {
      from: [1, 0],
      draw() {
        mkPoly([[-25, -84], [25, -84], [21, -50], [-21, -50]], MK.light);
        ctx.fillStyle = MK.mid;
        ctx.beginPath();
        ctx.moveTo(-25, -84);
        ctx.lineTo(-19, -84);
        ctx.lineTo(-16, -50);
        ctx.lineTo(-21, -50);
        ctx.fill();
        ctx.fillStyle = MK.hi;
        ctx.fillRect(-24, -83, 48, 1);
        ctx.fillStyle = MK.or;
        ctx.fillRect(-22, -58, 44, 2);
        ctx.fillRect(-23, -78, 46, 1);
        ctx.fillStyle = MK.deep;
        for (let i = 0; i < 3; i++) ctx.fillRect(-13 + i * 4, -72, 2, 8);
        blob(9, -69, 7, MK.out);
        blob(9, -69, 6, '#123a5a');
        const pulse = 3 + Math.round(Math.sin(tick * 0.15));
        blob(9, -69, pulse, MK.glow);
        blob(9, -69, 1, '#ffffff');
        ctx.fillStyle = MK.out;
        ctx.fillRect(-12, -56, 24, 1);
        ctx.fillStyle = MK.dark;
        ctx.fillRect(-18, -66, 2, 2);
        ctx.fillRect(-18, -62, 2, 2);
      },
    },
    {
      from: [0, -1],
      draw() {
        mkRect(-38, -90, 17, 14, MK.light);
        mkRect(18, -90, 20, 15, MK.light);
        mkHazard(19, -80, 19, 3);
        ctx.fillStyle = MK.mid;
        ctx.fillRect(-37, -84, 15, 2);
        blob(28, -86, 2, MK.or);
      },
    },
    {
      from: [1, -1],
      gun: 0,
      draw(pilot, rk) {
        mkRect(22 + rk, -98, 30, 9, MK.dark);
        mkRect(24 + rk, -104, 11, 6, MK.or);
        ctx.fillStyle = MK.yel;
        ctx.fillRect(26 + rk, -102, 7, 1);
        ctx.fillStyle = MK.out;
        ctx.fillRect(52 + rk, -97, 13, 2);
        ctx.fillRect(52 + rk, -93, 13, 2);
        mkRect(63 + rk, -98, 3, 9, MK.mid);
        ctx.fillStyle = MK.glow;
        ctx.fillRect(28 + rk, -95, 14, 1);
      },
    },
    {
      from: [1, 1],
      gun: 1,
      draw(pilot, rk, spin) {
        mkRect(24, -76, 9, 17, MK.mid);
        blob(28, -58, 6, MK.out);
        blob(28, -58, 5, MK.light);
        blob(28, -58, 2, MK.or);
        mkRect(26 + rk, -64, 23, 13, MK.dark);
        mkHazard(28 + rk, -53, 19, 2);
        for (let j = 0; j < 3; j++) {
          const yy = -59 + Math.round(Math.sin(spin + j * 2.09) * 3);
          ctx.fillStyle = Math.cos(spin + j * 2.09) > 0 ? MK.light : MK.out;
          ctx.fillRect(49 + rk, yy, 13, 2);
        }
        mkRect(61 + rk, -63, 3, 11, MK.light);
      },
    },
    {
      from: [0, -1],
      draw(pilot) {
        mkRect(-14, -104, 28, 21, MK.dark);
        ctx.fillStyle = '#123a5a';
        ctx.fillRect(-12, -101, 24, 16);
        if (pilot) ctx.drawImage(pilot, 0, 0, pilot.width, 11, -pilot.width / 2, -97, pilot.width, 11);
        ctx.fillStyle = 'rgba(95,240,255,0.3)';
        ctx.fillRect(-12, -101, 24, 16);
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillRect(-10, -100, 3, 7);
        ctx.fillRect(-6, -100, 1, 4);
        ctx.fillStyle = MK.or;
        ctx.fillRect(-14, -104, 28, 2);
        ctx.fillStyle = MK.out;
        ctx.fillRect(9, -113, 1, 9);
        blob(9, -114, 2, tick % 40 < 20 ? '#ff4a4a' : '#7a1520');
      },
    },
  ];
  const mechMuzzles = (cx, bottom, s, face) => [[cx + face * 67 * s, bottom - 94 * s], [cx + face * 65 * s, bottom - 58 * s]];

  function drawMechSuit(cx, bottom, s, build, face, pilot, recoil = [0, 0]) {
    const n = MECH_PARTS.length;
    const spin = recoil[1] > 0 ? tick * 0.9 : 0;
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(bottom));
    ctx.scale(face * s, s);
    MECH_PARTS.forEach((part, i) => {
      const p = clamp(build * n - i, 0, 1);
      if (p <= 0) return;
      const off = Math.pow(1 - p, 2) * 150;
      ctx.save();
      ctx.translate(part.from[0] * off, part.from[1] * off);
      part.draw(pilot, part.gun !== undefined ? -recoil[part.gun] : 0, spin);
      ctx.restore();
    });
    ctx.restore();
  }

  function drawMechBattle({ fromP, lt }, eBaseX, pBaseX) {
    if (lt < MECH_SUIT_T || lt >= MECH_END) return;
    const [cx, bottom, s, face] = fromP ? [pBaseX + 24, 156, 1.15, 1] : [eBaseX + 18, 97, 0.8, -1];
    const [tx, ty] = fromP ? [eBaseX + 18, 62] : [pBaseX + 24, 116];
    const pilot = fromP ? playerFrames[0] : mechanicFrames[0];
    const recoil = [0, 0];
    MECH_HITS.forEach((h, i) => {
      const d = lt - (h - 8);
      if (d >= 0 && d < 4) recoil[i % 2] = 3 - d;
    });
    const fade = lt > MECH_END - 16 ? (MECH_END - lt) / 16 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    drawMechSuit(cx, bottom, s, 1, face, pilot, recoil);
    ctx.restore();
    if (lt < MECH_SUIT_T + 6) {
      ctx.save();
      ctx.globalAlpha = 1 - (lt - MECH_SUIT_T) / 6;
      drawMechSuit(cx, bottom, s, 1, face, null);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    const muzzles = mechMuzzles(cx, bottom, s, face);
    MECH_HITS.forEach((h, i) => {
      const d = lt - (h - 8);
      const [mx, my] = muzzles[i % 2];
      const jx = ((i * 37) % 17) - 8, jy = ((i * 23) % 13) - 6;
      if (d >= 0 && d < 4) {
        blob(Math.round(mx + face * 4), Math.round(my), 5 - d, '#ffe14d');
        blob(Math.round(mx + face * 4), Math.round(my), Math.max(1, 3 - d), '#ffffff');
      }
      if (d >= 0 && d <= 8) {
        const p = d / 8;
        const bx = mx + (tx + jx - mx) * p, by = my + (ty + jy - my) * p;
        const ang = Math.atan2(ty + jy - my, tx + jx - mx);
        ctx.save();
        ctx.strokeStyle = '#ffe14d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx - Math.cos(ang) * 10, by - Math.sin(ang) * 10);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.restore();
      }
      if (d > 0 && d < 30) {
        ctx.fillStyle = '#e8c547';
        ctx.fillRect(Math.round(mx - face * (6 + d)), Math.round(my + d * d * 0.08), 2, 1);
      }
      if (d > 8 && d < 16) {
        const dd = d - 8;
        ctx.save();
        ctx.globalAlpha = 1 - dd / 8;
        blob(tx + jx, ty + jy, 4 + dd, '#ff9a2e');
        blob(tx + jx, ty + jy, 2 + dd / 2, '#ffffff');
        ctx.restore();
      }
    });
    if (lt >= MECH_HITS[0] && lt < MECH_HITS[5] + 12) {
      drawComic('RATATAT!', tx, ty - 48, Math.min(10, lt - MECH_HITS[0]), '#ffe14d');
    }
  }

  function drawMechArm(bx, by, angles, ext, s = 1) {
    let x = bx, y = by, last = angles[0];
    ctx.save();
    ctx.lineCap = 'round';
    angles.forEach((a, k) => {
      const len = clamp(ext * angles.length - k, 0, 1) * 22 * s;
      if (len <= 0) return;
      const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
      for (const [lw, col] of [[9 * s, '#1a1420'], [6 * s, '#8a96aa'], [2 * s, '#c8d2e0']]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }
      blob(Math.round(x), Math.round(y), Math.round(5 * s), '#1a1420');
      blob(Math.round(x), Math.round(y), Math.round(4 * s), '#4a5468');
      blob(Math.round(x), Math.round(y), Math.round(2 * s), '#5ff0ff');
      x = nx;
      y = ny;
      last = a;
    });
    ctx.restore();
    if (ext > 0) drawMechFist(x, y, 1, 2 * s, 0.6, last);
  }

  function drawMechCutscene({ fromP, lt }) {
    if (lt >= MECH_SUIT_T) return;
    const k = Math.min(clamp(lt / 8, 0, 1), clamp((MECH_SUIT_T - lt) / 6, 0, 1));
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = '#103562';
    ctx.fillRect(0, 0, W, H);
    const off = (lt * 0.5) % 16;
    ctx.fillStyle = '#1b4a82';
    for (let x = -off; x < W; x += 16) ctx.fillRect(Math.round(x), 0, 1, H);
    for (let y = -off; y < H; y += 16) ctx.fillRect(0, Math.round(y), W, 1);
    ctx.fillStyle = '#2c64a8';
    for (let x = -off; x < W; x += 64) ctx.fillRect(Math.round(x), 0, 1, H);
    for (let y = -off; y < H; y += 64) ctx.fillRect(0, Math.round(y), W, 1);
    const cx = W / 2, bottom = 180;
    const face = fromP ? 1 : -1;
    const pilot = fromP ? playerFrames[0] : mechanicFrames[0];
    const build = clamp((lt - 90) / 50, 0, 1);
    if (build < 0.5) {
      const sc = 4;
      drawImg(pilot, cx - (pilot.width * sc) / 2, bottom - pilot.height * sc, face, sc);
    }
    const armA = 1 - clamp((lt - 90) / 24, 0, 1);
    if (armA > 0 && lt >= 8) {
      ctx.globalAlpha = k * armA;
      const e1 = clamp((lt - 10) / 50, 0, 1), e2 = clamp((lt - 30) / 60, 0, 1);
      const w1 = Math.sin(lt * 0.06) * 0.12, w2 = Math.cos(lt * 0.05) * 0.12;
      drawMechArm(cx - 22, bottom - 56, [-2.5 + w1, -2.2 + w1, -1.8 + w1], e1);
      drawMechArm(cx + 22, bottom - 56, [0.5 + w2, -0.3 + w2, -1.1 + w2], e2);
      ctx.globalAlpha = k;
    }
    if (build > 0) drawMechSuit(cx, bottom, 1.4, build, face, pilot);
    MECH_PART_T.forEach((t0) => {
      const d = lt - t0;
      if (d >= 0 && d < 6) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + t0;
          sparkle(Math.round(cx + Math.cos(a) * (20 + d * 6)), Math.round(bottom - 70 + Math.sin(a) * (16 + d * 4)), 2, '#ffe14d');
        }
      }
    });
    if (lt >= 140) {
      const text = 'MECH UNLEASHED!';
      drawText(text.slice(0, Math.floor((lt - 140) / 1.5)), W / 2, 34, 16, lt % 6 < 3 ? '#5ff0ff' : '#ffffff', 'center', '#0a1a30');
    }
    if (lt >= 150 && lt < 158) {
      ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - (lt - 150) / 8)})`;
      ctx.fillRect(0, 0, W, H);
    }
    const bar = 22;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);
    drawText('MECH UNLEASHED', W / 2, 7, 8, '#e8742a', 'center', '#1a1420');
    const label = `${fromP ? playerName : 'THE MECHANIC'} BUILDS A MECH!`;
    drawText(label.slice(0, Math.floor(lt / 2)), W / 2, H - 15, 8, '#ffffff', 'center', '#1a1420');
    ctx.restore();
  }

  function drawUfoBattleBg(HORIZON) {
    for (let x = 0; x < W; x += 48) {
      ctx.fillStyle = '#2a2f4a';
      ctx.fillRect(x, 0, 1, HORIZON);
    }
    for (const [px, planet] of [[64, false], [192, true], [320, false]]) {
      blob(px, 34, 17, '#1a1420');
      blob(px, 34, 16, '#8a96aa');
      blob(px, 34, 13, '#05040e');
      for (let i = 0; i < 8; i++) {
        const sx = px - 11 + ((i * 7 + Math.floor(tick / 4)) % 22);
        const sy = 26 + ((i * 5) % 16);
        if (Math.hypot(sx - px, sy - 34) < 11) {
          ctx.fillStyle = i % 3 ? '#ffffff' : '#5ff0ff';
          ctx.fillRect(sx, sy, 1, 1);
        }
      }
      if (planet) {
        blob(px + 4, 37, 6, '#b07cff');
        ctx.fillStyle = '#e8c547';
        ctx.fillRect(px - 5, 37, 18, 1);
      }
      ctx.fillStyle = '#c8d2e0';
      ctx.fillRect(px - 9, 22, 4, 2);
    }
    for (let x = 0; x < W; x += 16) {
      const on = (Math.floor(tick / 6) + x / 16) % 8 < 5;
      ctx.fillStyle = on ? '#5ff0ff' : '#1e5a70';
      ctx.fillRect(x + 2, 6, 10, 2);
      ctx.fillStyle = on ? '#ff4ae8' : '#5a1e58';
      ctx.fillRect(x + 2, HORIZON - 6, 10, 2);
    }
    ctx.fillStyle = '#3a4256';
    ctx.fillRect(-8, HORIZON, W + 16, H - HORIZON);
    ctx.fillStyle = '#465070';
    for (let y = HORIZON + 4, gap = 4; y < 164; gap += 2, y += gap) ctx.fillRect(-8, y, W + 16, 2);
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(tick * 0.1);
    ctx.fillStyle = '#5ff0ff';
    ctx.fillRect(-8, HORIZON, W + 16, 1);
    ctx.restore();
  }

  // ---------- Captain battle ----------
  const CPT = { out: '#1a1420', navy: '#2a3a7a', navyD: '#1a2450', gold: '#ffe14d', glove: '#e8ecf4', neon: '#5ff0ff', pink: '#ff4ae8', green: '#6fd86a', red: '#ff3e6c' };
  const cRect = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };

  function drawCapFist(x, y, dir, s = 1, glow = 0) {
    if (glow > 0) {
      ctx.save();
      ctx.globalAlpha = glow * (0.35 + 0.15 * Math.sin(tick * 0.5));
      blob(Math.round(x), Math.round(y), Math.round(11 * s), CPT.green);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(dir * s, s);
    cRect(-15, -4, 8, 8, CPT.out);
    cRect(-14, -3, 7, 6, CPT.navy);
    cRect(-14, -3, 7, 1, '#4a5ca8');
    cRect(-8, -5, 4, 10, CPT.out);
    cRect(-7, -4, 2, 8, CPT.gold);
    cRect(-5, -6, 12, 12, CPT.out);
    cRect(-4, -5, 10, 10, CPT.glove);
    cRect(-4, -5, 10, 1, '#ffffff');
    for (const ky of [-3, 0, 3]) cRect(4, ky, 2, 1, '#9aa4b8');
    cRect(-3, 2, 6, 3, CPT.out);
    cRect(-2, 2, 5, 2, '#c8d0dc');
    ctx.restore();
  }

  function drawCapGun(x, y, ang, s = 1) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(ang);
    ctx.scale(s, Math.abs(ang) > Math.PI / 2 ? -s : s);
    cRect(-5, 1, 5, 8, CPT.out);
    cRect(-4, 2, 3, 6, CPT.navyD);
    cRect(-4, 3, 3, 1, CPT.gold);
    cRect(-9, -7, 18, 10, CPT.out);
    cRect(-8, -6, 16, 8, CPT.navy);
    cRect(-8, -6, 16, 1, '#4a5ca8');
    cRect(-6, -3, 7, 2, CPT.gold);
    cRect(2, -4, 2, 4, CPT.green);
    cRect(8, -6, 11, 4, CPT.out);
    cRect(8, -5, 10, 2, '#c8d2e0');
    cRect(8, -1, 11, 4, CPT.out);
    cRect(8, 0, 10, 2, '#c8d2e0');
    cRect(18, -6, 2, 4, CPT.green);
    cRect(18, -1, 2, 4, CPT.red);
    cRect(-3, -9, 5, 2, CPT.out);
    cRect(-2, -9, 3, 1, CPT.green);
    ctx.restore();
  }
  function capGunMuzzles(x, y, ang, s) {
    const flip = Math.abs(ang) > Math.PI / 2 ? -1 : 1;
    const c = Math.cos(ang), sn = Math.sin(ang);
    return [-4, 1].map((ly) => {
      const lx = 20 * s, yy = ly * s * flip;
      return [x + c * lx - sn * yy, y + sn * lx + c * yy];
    });
  }

  function drawKatana(x, y, ang, s = 1, ext = 1, glow = 1) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(ang);
    ctx.scale(s, s);
    cRect(-11, -2, 10, 4, CPT.out);
    cRect(-10, -1, 8, 2, '#3a3f58');
    for (let i = -9; i < -2; i += 2) cRect(i, -1, 1, 2, CPT.gold);
    cRect(-12, -1, 1, 2, CPT.gold);
    cRect(-2, -4, 3, 8, CPT.out);
    cRect(-1, -3, 1, 6, CPT.gold);
    const len = Math.round(36 * ext);
    if (len > 1) {
      if (glow > 0) {
        ctx.save();
        ctx.globalAlpha *= 0.3 * glow;
        cRect(1, -4, len + 3, 8, CPT.neon);
        ctx.restore();
      }
      cRect(1, -2, len, 4, CPT.out);
      cRect(1, -1, len - 1, 2, '#bff8ff');
      cRect(1, 0, len - 1, 1, CPT.neon);
      cRect(len, -1, 2, 1, CPT.out);
      cRect(len, -1, 1, 1, '#ffffff');
      for (let i = 4; i < len - 2; i += 6) cRect(i + ((tick >> 1) % 6), -1, 1, 1, '#ffffff');
    }
    ctx.restore();
  }

  function drawShipBattleBg(HORIZON) {
    ctx.fillStyle = '#161a2c';
    ctx.fillRect(-8, 0, W + 16, HORIZON);
    ctx.fillStyle = '#1e2338';
    for (let x = 0; x < W; x += 32) ctx.fillRect(x, 0, 1, HORIZON);
    const win = [[64, 6], [320, 6], [340, 52], [44, 52]];
    const path = () => {
      ctx.beginPath();
      win.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    };
    ctx.save();
    path();
    ctx.clip();
    ctx.fillStyle = '#05040e';
    ctx.fillRect(0, 0, W, HORIZON);
    for (let i = 0; i < 70; i++) {
      const a = i * 2.39996;
      const d = (tick * (1 + (i % 4) * 0.4) + i * 37) % 200;
      const x1 = 192 + Math.cos(a) * d, y1 = 29 + Math.sin(a) * d * 0.4;
      ctx.strokeStyle = i % 5 ? '#ffffff' : CPT.neon;
      ctx.globalAlpha = Math.min(1, d / 50);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + Math.cos(a) * (1 + d * 0.05), y1 + Math.sin(a) * (1 + d * 0.05) * 0.4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    blob(192, 29, 11, '#2f6fdc');
    blob(192, 29, 9, '#2a64c8');
    blob(189, 27, 4, '#3ea84a');
    blob(196, 32, 3, '#3ea84a');
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1a1420';
    path();
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#8a96aa';
    path();
    ctx.stroke();
    for (const [x1, x2] of [[128, 118], [256, 266]]) {
      ctx.fillStyle = '#1a1420';
      ctx.beginPath();
      ctx.moveTo(x1 - 2, 6);
      ctx.lineTo(x1 + 2, 6);
      ctx.lineTo(x2 + 2, 52);
      ctx.lineTo(x2 - 2, 52);
      ctx.fill();
    }
    drawText('COURSE: EARTH', 192, 9, 8, tick % 40 < 28 ? '#ff4a4a' : '#7a1520', 'center', '#05040e');
    for (const sx of [18, 366]) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(tick * 0.15 + sx);
      blob(sx, 14, 4, '#ff3e3e');
      ctx.restore();
      blob(sx, 14, 2, '#ffd0d0');
    }
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(-8, 52, W + 16, HORIZON - 52);
    ctx.fillStyle = '#2a3046';
    ctx.fillRect(-8, 54, W + 16, HORIZON - 56);
    ctx.fillStyle = '#4a5468';
    ctx.fillRect(-8, 54, W + 16, 1);
    for (let i = 0; i < 38; i++) {
      const on = (Math.floor(tick / (6 + (i % 4) * 3)) + i * 7) % 5 < 3;
      ctx.fillStyle = on ? ['#ff4a4a', '#5fff8a', '#ffe14d', '#5ff0ff'][i % 4] : '#1a1f30';
      ctx.fillRect(4 + i * 10, 58 + (i % 2) * 5, 4, 2);
    }
    ctx.fillStyle = '#3a4256';
    ctx.fillRect(-8, HORIZON, W + 16, H - HORIZON);
    ctx.fillStyle = '#465070';
    for (let y = HORIZON + 4, gap = 4; y < 164; gap += 2, y += gap) ctx.fillRect(-8, y, W + 16, 2);
    ctx.fillStyle = '#2a3046';
    for (let x = -((tick >> 2) % 48); x < W; x += 48) ctx.fillRect(x, HORIZON, 1, H - HORIZON);
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(tick * 0.1);
    ctx.fillStyle = CPT.green;
    ctx.fillRect(-8, HORIZON, W + 16, 1);
    ctx.restore();
  }

  const capPunchP = (lt) => {
    if (lt < 10) return -0.15 * Math.sin((lt / 10) * Math.PI);
    if (lt < 18) return Math.pow((lt - 10) / 8, 2);
    if (lt < 24) return 1;
    return Math.max(0, 1 - (lt - 24) / 16);
  };
  function drawCapPunch({ fromP, lt }, eBaseX, pBaseX) {
    const [hx, hy] = fromP ? [pBaseX + 58, 104] : [eBaseX - 6, 74];
    const [tx, ty] = fromP ? [eBaseX + 8, 62] : [pBaseX + 36, 116];
    const dir = fromP ? 1 : -1;
    const at = (l) => {
      const p = capPunchP(l);
      return [hx + (tx - hx) * p, hy + (ty - hy) * p - Math.sin(clamp(p, 0, 1) * Math.PI) * 10];
    };
    if (lt < 12) {
      const [x, y] = at(lt);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + lt * 0.3;
        const d = (12 - lt) * 2.5 + 4;
        ctx.fillStyle = i % 2 ? CPT.green : '#ffffff';
        ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), 2, 2);
      }
    }
    if (lt >= 10 && lt < 20) {
      for (let k = 3; k >= 1; k--) {
        const [gx, gy] = at(lt - k * 2);
        ctx.save();
        ctx.globalAlpha = 0.18 * (4 - k);
        drawCapFist(gx, gy, dir, 2.2);
        ctx.restore();
      }
      const [x, y] = at(lt);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(x - dir * (20 + i * 7)), Math.round(y - 8 + i * 4), 12, 1);
    }
    const [x, y] = at(lt);
    drawCapFist(x, y, dir, 2.2, lt < 18 ? 0.8 : 0);
    if (lt >= 18 && lt < 34) {
      const d = lt - 18;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - d / 14);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(tx, ty, 6 + d * 3, 3 + d * 1.4, dir * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = CPT.green;
      ctx.beginPath();
      ctx.ellipse(tx, ty, 3 + d * 2, 2 + d, dir * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (d < 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(0, 0, W, H);
      }
      drawStars(tx, ty - 12, 6, lt);
      drawComic('POW!', tx, ty - 38, d, CPT.gold);
    }
  }

  function drawCapRay({ fromP, lt }, eBaseX, pBaseX) {
    const [gx, gy] = fromP ? [pBaseX + 58, 104] : [eBaseX - 6, 70];
    const [tx, ty] = fromP ? [eBaseX + 18, 62] : [pBaseX + 24, 116];
    const ang0 = Math.atan2(ty - gy, tx - gx);
    const ux = Math.cos(ang0), uy = Math.sin(ang0), nx = -uy, ny = ux;
    const spin = lt < 12 ? (1 - lt / 12) * Math.PI * 2 * (fromP ? -1 : 1) : 0;
    const recoil = lt >= 40 && lt < 48 ? (48 - lt) / 2 : 0;
    const px = gx - ux * recoil, py = gy - uy * recoil;
    const muz = capGunMuzzles(px, py, ang0, 1.6);
    if (lt < 94) {
      ctx.save();
      if (lt > 80) ctx.globalAlpha = (94 - lt) / 14;
      drawCapGun(px, py, ang0 + spin, 1.6);
      ctx.restore();
    }
    if (lt < 10) drawComic('*SPIN*', gx, gy - 26, lt, '#ffffff');
    if (lt >= 12 && lt < 42) {
      const k = (lt - 12) / 30;
      muz.forEach(([mx, my], i) => {
        const col = i ? CPT.red : CPT.green;
        ctx.save();
        ctx.globalAlpha = 0.3 + k * 0.4;
        blob(Math.round(mx), Math.round(my), Math.round(2 + k * 7), col);
        ctx.globalAlpha = 0.9;
        blob(Math.round(mx), Math.round(my), Math.round(1 + k * 3), '#ffffff');
        ctx.restore();
        for (let j = 0; j < 6; j++) {
          const a = (j / 6) * Math.PI * 2 + lt * (i ? -0.3 : 0.3);
          const d = (42 - lt) * 1.1 + 3;
          ctx.fillStyle = j % 2 ? col : '#ffffff';
          ctx.fillRect(Math.round(mx + Math.cos(a) * d), Math.round(my + Math.sin(a) * d), 2, 2);
        }
      });
      if (lt > 28 && lt % 6 < 3) drawText('!!', gx, gy - 28, 8, CPT.gold, 'center', '#1a1420');
    }
    if (lt >= 40 && lt < 76) {
      const reach = clamp((lt - 40) / 6, 0, 1);
      const k = lt > 64 ? (76 - lt) / 12 : 1;
      const [m0, m1] = muz;
      const sx = (m0[0] + m1[0]) / 2, sy = (m0[1] + m1[1]) / 2;
      const len = Math.hypot(tx - sx, ty - sy);
      ctx.save();
      ctx.globalAlpha = 0.1 * k;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-8, 0, W + 16, H);
      ctx.lineCap = 'round';
      [[CPT.green, '#c8ffb0', 0], [CPT.red, '#ffc0d0', Math.PI]].forEach(([outer, inner, ph]) => {
        const pts = [];
        for (let s = 0; s <= 1.0001; s += 0.04) {
          if (s > reach) break;
          const off = Math.sin(s * Math.PI * 3 - lt * 0.7 + ph) * 9 * (1 - s) * k;
          pts.push([sx + (tx - sx) * s + nx * off, sy + (ty - sy) * s + ny * off]);
        }
        for (const [lw, col, a] of [[9, outer, 0.35], [5, outer, 0.9], [2, inner, 1]]) {
          ctx.globalAlpha = a * k;
          ctx.strokeStyle = col;
          ctx.lineWidth = lw * (0.8 + 0.2 * Math.sin(lt * 1.3));
          ctx.beginPath();
          pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        }
      });
      ctx.globalAlpha = k;
      for (let i = 0; i < 8; i++) {
        const p = (lt * 0.06 + i / 8) % 1;
        if (p > reach) continue;
        sparkle(Math.round(sx + (tx - sx) * p), Math.round(sy + (ty - sy) * p), 1, i % 2 ? '#ffffff' : CPT.gold);
      }
      ctx.restore();
      if (len > 0 && lt < 44) {
        for (const [mx, my] of muz) blob(Math.round(mx), Math.round(my), 6 - (lt - 40), '#ffffff');
      }
    }
    if (lt >= 48 && lt < 84) {
      const d = lt - 48;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - d / 36);
      blob(tx - 4, ty, 14 + (d % 6), CPT.green);
      blob(tx + 4, ty, 12 + ((d + 3) % 6), CPT.red);
      blob(tx, ty, 7 + (d % 4), '#ffffff');
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(tx, ty, d * 3, d * 1.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (d < 3) {
        ctx.fillStyle = 'rgba(220,255,220,0.7)';
        ctx.fillRect(0, 0, W, H);
      }
      drawComic('ZZ-ZAP!', tx, ty - 46, d, CPT.green);
      if (d > 6) drawComic('-5', tx + 26, ty - 26 - d * 0.4, d - 6, CPT.red);
    }
  }

  function drawCapKatana({ fromP, lt }, eBaseX, pBaseX) {
    if (lt < 40) return;
    const [tx, ty, ground] = fromP ? [eBaseX + 18, 62, 94] : [pBaseX + 24, 118, 154];
    const [bx, by] = fromP ? [pBaseX + 24, 154] : [eBaseX + 18, 94];
    const img = fromP ? playerFrames[0] : captainFrames[0];
    const sc = 3, w = img.width * sc, h = img.height * sc;
    const side = fromP ? 1 : -1;
    const endX = tx + side * 60;
    if (lt >= 40 && lt < 50) teleportStreak(bx, by, 1 - (lt - 40) / 10);
    KATANA_DASH.forEach((d0, i) => {
      const d = lt - d0;
      if (d < -2 || d > 40) return;
      const ang = [-0.42, 0.38, -0.05][i] * side;
      const half = 64;
      const p = clamp((d + 2) / 4, 0, 1);
      const x0 = tx - Math.cos(ang) * half * side, y0 = ty - Math.sin(ang) * half * side;
      const x1 = tx + Math.cos(ang) * half * side, y1 = ty + Math.sin(ang) * half * side;
      const ex = x0 + (x1 - x0) * p, ey = y0 + (y1 - y0) * p;
      const a = d < 4 ? 1 : lt < 88 ? 0.35 + 0.15 * Math.sin(lt * 0.8) : Math.max(0, 1 - (lt - 88) / 8);
      ctx.save();
      ctx.lineCap = 'round';
      for (const [lw, col] of [[5, CPT.pink], [3, CPT.neon], [1, '#ffffff']]) {
        ctx.globalAlpha = a * (lw === 5 ? 0.5 : 1);
        ctx.strokeStyle = col;
        ctx.lineWidth = d < 4 ? lw : Math.max(1, lw - 2);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      ctx.restore();
      if (d >= 0 && d < 4) {
        ctx.save();
        ctx.globalAlpha = 0.45 * (1 - d / 4);
        drawImg(img, ex - w / 2, ground - h + 3 - 8, side, sc);
        ctx.restore();
        for (let j = 0; j < 5; j++) sparkle(Math.round(ex - Math.cos(ang) * side * j * 8), Math.round(ey - Math.sin(ang) * side * j * 8), 1, '#ffffff');
      }
    });
    if (lt >= 62 && lt < 96) {
      const sheath = clamp((lt - 66) / 16, 0, 1);
      const appear = clamp((lt - 62) / 4, 0, 1);
      ctx.save();
      ctx.globalAlpha = appear * (lt > 92 ? (96 - lt) / 4 : 1);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(Math.round(endX - 14), ground - 1, 28, 3);
      drawImg(img, endX - w / 2, ground - h + 3, side, sc);
      const hx = endX + side * w * 0.42, hy = ground - h * 0.42;
      drawKatana(hx, hy, side > 0 ? 0.55 : Math.PI - 0.55, 1.4, 1 - sheath, 1 - sheath);
      ctx.restore();
      if (lt >= 82 && lt < 88) {
        sparkle(Math.round(hx), Math.round(hy), 3, '#ffffff');
        drawComic('*CLICK*', endX, ground - h - 12, lt - 82, '#ffffff');
      }
    }
    if (lt >= 84 && lt < 88 && tick % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tx - 30, ty, 60, 1);
    }
    if (lt >= 88 && lt < 110) {
      const d = lt - 88;
      const s = Math.min(1, d / 3) * 46;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - d / 22);
      ctx.lineCap = 'round';
      for (const [lw, col] of [[10, CPT.pink], [6, CPT.neon], [2, '#ffffff']]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(tx - s, ty - s * 0.6);
        ctx.lineTo(tx + s, ty + s * 0.6);
        ctx.moveTo(tx + s, ty - s * 0.6);
        ctx.lineTo(tx - s, ty + s * 0.6);
        ctx.stroke();
      }
      ctx.restore();
      if (d < 4) {
        ctx.fillStyle = `rgba(230,255,255,${0.75 - d * 0.15})`;
        ctx.fillRect(0, 0, W, H);
      }
      drawComic('SLASH!', tx, ty - 50, d, CPT.neon);
      if (d > 5) drawComic('-6', tx + 30, ty - 30 - d * 0.4, d - 5, CPT.red);
    }
    if (lt >= 94 && lt < 108) {
      teleportStreak(endX, ground, lt < 98 ? (lt - 94) / 4 : Math.max(0, 1 - (lt - 98) / 6));
      teleportStreak(bx, by, lt < 100 ? (lt - 94) / 6 : Math.max(0, 1 - (lt - 100) / 8));
    }
  }

  function drawKatanaCutscene({ fromP, lt }) {
    const k = Math.min(clamp(lt / 6, 0, 1), clamp((40 - lt) / 6, 0, 1));
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = '#0a0c1e';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) {
      const y = ((i * 37 + lt * (6 + (i % 3) * 3)) % (H + 40)) - 20;
      ctx.fillStyle = i % 3 ? '#1a2450' : '#2a3a7a';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y - 80);
      ctx.lineTo(W, y - 78 - (i % 4));
      ctx.lineTo(0, y + 2 + (i % 4));
      ctx.fill();
    }
    ctx.globalAlpha = k * 0.25;
    blob(150, 120, 70, CPT.neon);
    ctx.globalAlpha = k;
    const img = fromP ? playerFrames[0] : captainFrames[lt > 30 && lt < 34 ? 1 : 0];
    const sc = 6;
    const left = 150 - (img.width * sc) / 2, top = 194 - img.height * sc + Math.round(Math.sin(lt * 0.2) * 2);
    drawImg(img, left, top, 1, sc);
    const hx = left + img.width * sc * 0.9, hy = top + img.height * sc * 0.7;
    const ext = clamp((lt - 8) / 16, 0, 1);
    const ang = -0.95 - (1 - ext) * 0.5;
    drawKatana(hx, hy, ang, 3, ext, 0.6 + 0.4 * Math.sin(lt * 0.5));
    if (ext > 0 && ext < 1) {
      const bx = hx + Math.cos(ang) * 108 * ext, by = hy + Math.sin(ang) * 108 * ext;
      for (let i = 0; i < 6; i++) sparkle(Math.round(bx + Math.sin(i * 2 + lt) * 8), Math.round(by + Math.cos(i * 3 + lt) * 8), 2, i % 2 ? CPT.neon : '#ffffff');
    }
    if (lt >= 24 && lt < 36) {
      const g = (lt - 24) / 12;
      const gx = hx + Math.cos(ang) * 108 * g, gy = hy + Math.sin(ang) * 108 * g;
      sparkle(Math.round(gx), Math.round(gy), 4, '#ffffff');
      sparkle(Math.round(gx), Math.round(gy), 2, CPT.neon);
    }
    if (!fromP && lt >= 28 && lt < 36) {
      const ex = left + 4 * sc, ey = top + 5 * sc;
      sparkle(Math.round(ex), Math.round(ey), 3, '#ff3e3e');
      sparkle(Math.round(ex + 5 * sc), Math.round(ey), 3, '#ff3e3e');
    }
    const bar = 22;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);
    drawText('CAPTAIN SLASH', W / 2, 7, 8, CPT.neon, 'center', '#1a1420');
    const label = `${fromP ? playerName : 'THE CAPTAIN'} DRAWS A CYBER KATANA!`;
    drawText(label.slice(0, Math.floor(lt * 1.4)), W / 2, H - 15, 8, '#ffffff', 'center', '#1a1420');
    ctx.restore();
  }

  function drawCargoBox(x, bottom, rot = 0, sq = 0) {
    const S = CTRL_BOX, h = S / 2;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(bottom - h * (1 - sq)));
    ctx.rotate(rot);
    ctx.scale(1 + sq, 1 - sq);
    cRect(-h - 1, -h - 1, S + 2, S + 2, CPT.out);
    cRect(-h, -h, S, S, '#6e7a90');
    cRect(-h, -h, S, 2, '#a8b4c8');
    cRect(-h, h - 2, S, 2, '#4a5468');
    for (let i = 0; i < S; i += 4) cRect(-h + i, -3, 4, 6, (i / 4) % 2 ? CPT.out : '#e8742a');
    cRect(-h, -h, 2, S, '#2a3046');
    cRect(h - 2, -h, 2, S, '#2a3046');
    cRect(-3, -h + 3, 6, 4, CPT.green);
    cRect(-2, -h + 4, 1, 1, CPT.out);
    cRect(1, -h + 4, 1, 1, CPT.out);
    cRect(-1, -h + 7, 2, 1, CPT.green);
    cRect(-3, h - 7, 6, 3, '#4a5468');
    for (const [rx, ry] of [[-h + 3, -h + 3], [h - 4, -h + 3], [-h + 3, h - 4], [h - 4, h - 4]]) cRect(rx, ry, 1, 1, '#d8e2ee');
    ctx.restore();
  }

  function drawCtrlScene(b) {
    const c = b.ctrl, t = c.t;
    const fadeOut = c.done ? clamp(1 - c.doneT / 20, 0, 1) : 1;
    const k = Math.min(clamp(t / 10, 0, 1), fadeOut);
    const amp = clamp((t - 64) / 30, 0, 1) * 0.06 * fadeOut;
    const tilt = Math.sin(t * 0.05) * amp;
    const fromP = c.fromP;
    const capImg = captainFrames[tick % 160 < 6 ? 1 : 0];
    const pilotImg = fromP ? playerFrames[0] : capImg;
    const pilotName = fromP ? playerName : 'THE CAPTAIN';
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = '#05040e';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (c.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * c.shake), Math.round((Math.random() - 0.5) * c.shake * 0.5));
    ctx.translate(W / 2, CTRL_FLOOR);
    ctx.rotate(tilt);
    ctx.translate(-W / 2, -CTRL_FLOOR);

    ctx.fillStyle = '#161a2c';
    ctx.fillRect(-60, -60, W + 120, H + 120);
    ctx.fillStyle = '#1e2338';
    for (let x = -64; x < W + 64; x += 32) ctx.fillRect(x, -60, 1, H + 120);
    const win = [[74, 26], [310, 26], [334, 100], [50, 100]];
    const winPath = () => {
      ctx.beginPath();
      win.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    };
    ctx.save();
    winPath();
    ctx.clip();
    ctx.fillStyle = '#05040e';
    ctx.fillRect(0, 0, W, 120);
    const swerve = Math.sin(t * 0.05) * clamp((t - 64) / 30, 0, 1);
    for (let i = 0; i < 90; i++) {
      const a = i * 2.39996;
      const d = (t * (1.5 + (i % 5) * 0.5) + i * 53) % 230;
      const x1 = 192 + Math.cos(a) * d + swerve * d * 0.6, y1 = 62 + Math.sin(a) * d * 0.5;
      const len = 2 + d * 0.08;
      ctx.strokeStyle = i % 6 ? '#ffffff' : CPT.neon;
      ctx.globalAlpha = k * Math.min(1, d / 50);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + Math.cos(a) * len + swerve * 10, y1 + Math.sin(a) * len * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = k;
    const ex = 192 - swerve * 90, er = 16 + Math.min(10, t * 0.03);
    blob(Math.round(ex), 62, Math.round(er + 3), '#2f6fdc');
    blob(Math.round(ex), 62, Math.round(er), '#2a64c8');
    blob(Math.round(ex - er * 0.3), 58, Math.round(er * 0.4), '#3ea84a');
    blob(Math.round(ex + er * 0.35), 67, Math.round(er * 0.3), '#3ea84a');
    ctx.restore();
    ctx.lineWidth = 4;
    ctx.strokeStyle = CPT.out;
    winPath();
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#8a96aa';
    winPath();
    ctx.stroke();
    for (const [x1, x2] of [[152, 144], [232, 240]]) {
      ctx.fillStyle = CPT.out;
      ctx.beginPath();
      ctx.moveTo(x1 - 2, 26);
      ctx.lineTo(x1 + 2, 26);
      ctx.lineTo(x2 + 2, 100);
      ctx.lineTo(x2 - 2, 100);
      ctx.fill();
    }

    for (const side of [-1, 1]) {
      const hx = CTRL_X + side * 160;
      const warn = c.boxes.some((x) => x.side === side && (x.state === 'warn' || (x.state === 'fall' && x.t < 8)));
      cRect(hx - 20, 22, 40, 10, CPT.out);
      cRect(hx - 19, 23, 38, 8, warn ? '#05040e' : '#2a3046');
      for (let i = 0; i < 38; i += 6) cRect(hx - 19 + i, 31, 3, 2, (i / 6) % 2 ? CPT.out : '#ffe14d');
      if (warn && tick % 10 < 6) {
        blob(hx, 44, 7, '#ff3e3e');
        drawText('!', hx, 40, 8, '#ffffff', 'center', null);
      }
    }

    cRect(30, 100, W - 60, 22, CPT.out);
    cRect(32, 102, W - 64, 18, '#2a3046');
    cRect(32, 102, W - 64, 2, '#4a5468');
    for (let i = 0; i < 30; i++) {
      const x = 38 + i * 10.5;
      if (x > 76 && x < 160) continue;
      const on = (Math.floor(t / (4 + (i % 4) * 2)) + i * 7) % 5 < 3;
      const alarm = t > 64 && !c.done;
      ctx.fillStyle = on ? (alarm ? (i % 2 ? '#ff3e3e' : '#ffe14d') : ['#ff4a4a', '#5fff8a', '#ffe14d', '#5ff0ff'][i % 4]) : '#1a1f30';
      ctx.fillRect(Math.round(x), 108 + (i % 2) * 5, 5, 3);
    }

    const chairX = 104, seatY = 132;
    const lean = t > 64 ? tilt * -4 : 0;
    const tp = clamp((t - 6) / 34, 0, 1);
    cRect(chairX - 2, seatY - 4, 4, 12, CPT.out);
    cRect(chairX - 12, seatY + 6, 24, 3, CPT.out);
    cRect(chairX - 16, seatY - 46, 6, 44, CPT.out);
    cRect(chairX - 15, seatY - 45, 4, 42, '#7a1520');
    cRect(chairX - 15, seatY - 45, 4, 1, CPT.gold);
    cRect(chairX - 14, seatY - 8, 24, 5, CPT.out);
    cRect(chairX - 13, seatY - 7, 22, 3, '#c2202e');
    const wheelX = 144, wheelY = seatY - 22;
    cRect(wheelX - 2, wheelY, 4, seatY - wheelY + 6, CPT.out);
    cRect(wheelX - 1, wheelY, 2, seatY - wheelY + 6, '#6e7a90');
    if (tp > 0) {
      const pw = pilotImg.width * 2, ph = pilotImg.height * 2;
      const pxL = chairX - pw / 2 + 4, pyT = seatY - ph + 4 + (tick % 20 < 10 ? 0 : 1);
      ctx.save();
      ctx.beginPath();
      ctx.rect(pxL - 10, pyT + ph * (1 - tp), pw + 20, ph * tp + 2);
      ctx.clip();
      ctx.translate(chairX, seatY);
      ctx.rotate(lean);
      ctx.translate(-chairX, -seatY);
      drawImg(pilotImg, pxL, pyT, 1, 2);
      ctx.restore();
      if (tp < 1) {
        ctx.save();
        ctx.globalAlpha = k * 0.6 * (1 - tp * 0.5);
        cRect(chairX - 14, -40, 28, seatY + 40, '#7fdcff');
        ctx.globalAlpha = k;
        cRect(chairX - 4, -40, 8, seatY + 40, '#ffffff');
        cRect(pxL - 6, Math.round(pyT + ph * (1 - tp)), pw + 12, 1, '#ffffff');
        ctx.restore();
        for (let i = 0; i < 6; i++) sparkle(Math.round(chairX + Math.sin(i * 2.1 + t * 0.4) * 16), Math.round(seatY - ((t * 4 + i * 17) % 80)), 1, '#eef4ff');
      }
      if (t >= 40) {
        const wa = (t > 50 ? tilt * 14 : 0) + Math.sin(t * 0.2) * (t > 64 ? 0.3 : 0);
        ctx.save();
        ctx.translate(wheelX, wheelY);
        ctx.rotate(wa);
        ctx.lineWidth = 3;
        ctx.strokeStyle = CPT.out;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.strokeStyle = CPT.gold;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          cRect(Math.round(Math.cos(a) * 4) - 1, Math.round(Math.sin(a) * 4) - 1, 2, 2, CPT.gold);
        }
        cRect(-2, -2, 4, 4, '#c2202e');
        ctx.restore();
        const hand = fromP ? '#f2c79b' : CPT.green;
        cRect(wheelX - 12, wheelY - 3 + Math.round(Math.sin(wa) * 4), 4, 4, CPT.out);
        cRect(wheelX - 11, wheelY - 2 + Math.round(Math.sin(wa) * 4), 2, 2, hand);
      }
    }
    if (t >= 44 && t < 96) drawSpeech(fromP ? 'HERE WE GO!' : 'HOLD ON TIGHT!', chairX, seatY - 36);

    cRect(-60, CTRL_FLOOR, W + 120, H, '#2a3046');
    cRect(-60, CTRL_FLOOR, W + 120, 2, '#4a5468');
    for (let x = -60 - ((t * 2) % 24); x < W + 60; x += 24) cRect(x, CTRL_FLOOR + 2, 1, H, '#1a1f30');
    for (let x = -60; x < W + 60; x += 8) cRect(x, CTRL_FLOOR + 6, 4, 2, (x / 8) % 2 ? CPT.out : '#e8742a');

    for (const box of c.boxes) {
      if (box.state === 'fall') {
        const near = clamp(1 - (CTRL_FLOOR - box.y) / 200, 0, 1);
        ctx.fillStyle = `rgba(0,0,0,${0.15 + near * 0.3})`;
        const sw = Math.round(4 + near * 10);
        ctx.fillRect(Math.round(box.x - sw), CTRL_FLOOR - 1, sw * 2, 3);
        drawCargoBox(box.x, box.y, box.rot);
        if (box.t < 20) {
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(box.x - 8 + i * 8), Math.round(box.y - 40 - (i % 2) * 8), 1, 16);
        }
      } else if (box.state === 'slide') {
        const sq = box.land < 8 ? ((8 - box.land) / 8) * 0.3 : 0;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(Math.round(box.x - 12), CTRL_FLOOR - 1, 24, 3);
        drawCargoBox(box.x, CTRL_FLOOR, Math.sin(box.land * 0.6) * 0.04, sq);
        ctx.fillStyle = '#c8d2e0';
        for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(box.x - Math.sign(box.vx) * (16 + i * 7)), CTRL_FLOOR - 6 - i * 5, 6 - i, 1);
      }
    }

    const jImg = fromP ? capImg : playerFrames[c.jy > 0 ? 1 : 0];
    const incoming = c.boxes.find((x) => x.state === 'slide' && !x.judged) || c.boxes.find((x) => x.state === 'fall' || x.state === 'warn');
    const face = incoming ? incoming.side : 1;
    const jw = jImg.width * 2, jh = jImg.height * 2;
    const sh = Math.max(4, Math.round(12 - c.jy * 0.12));
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(CTRL_X - sh, CTRL_FLOOR - 1, sh * 2, 3);
    if (!(c.hurt > 0 && Math.floor(c.hurt / 3) % 2 === 0)) {
      const stretch = c.jv > 3 ? 1.12 : 1;
      ctx.save();
      ctx.translate(CTRL_X, Math.round(CTRL_FLOOR - c.jy));
      ctx.scale(1 / stretch, stretch);
      drawImg(jImg, -jw / 2, -jh, face, 2);
      ctx.restore();
      if (c.hurt > 20) drawStars(CTRL_X, CTRL_FLOOR - c.jy - jh - 4, 5, t);
    }
    if (!fromP && t >= 100 && !c.done && !b.over && c.jy === 0 && incoming && incoming.state === 'slide' && Math.abs(incoming.x - CTRL_X) < 90 && tick % 10 < 6) {
      drawText('JUMP!', CTRL_X, CTRL_FLOOR - jh - 18, 8, '#ffe14d', 'center', CPT.out);
    }

    for (const p of c.parts) {
      ctx.globalAlpha = k * clamp(p.life / 10, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.big ? 3 : 2, p.big ? 3 : 2);
    }
    ctx.globalAlpha = k;
    for (const box of c.boxes) {
      if (box.state === 'smash' && box.t < 4) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(-60, -60, W + 120, H + 120);
      }
    }
    for (const p of c.pops) drawComic(p.text, p.x, p.y - p.t * 0.6, p.t, p.col);
    ctx.restore();

    if (t > 64 && !c.done) {
      ctx.save();
      ctx.globalAlpha = k * (0.12 + 0.1 * Math.sin(t * 0.25));
      ctx.fillStyle = '#ff2020';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (t < 12) {
      ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - t / 12)})`;
      ctx.fillRect(0, 0, W, H);
    }

    const bar = 22;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);
    drawText('CAPTAIN CONTROL', W / 2, 7, 8, '#ff4a4a', 'center', CPT.out);
    drawText(fromP ? 'CAPTAIN' : playerName, 8, 4, 8, '#ffffff', 'left', null);
    drawHpBar(8, 13, 70, fromP ? b.eDisp : b.pDisp, fromP ? b.enemy.hp : b.pmax);
    const n = c.boxes.filter((x) => x.state !== 'warn').length;
    if (n > 0) drawText(`BOX ${n}/${CTRL_BOX_T.length}`, W - 8, 7, 8, '#ffe14d', 'right', null);
    let msg;
    if (t < 100) msg = (fromP ? `${pilotName} TELEPORTS TO THE CAPTAIN'S SEAT!` : `${pilotName} TAKES THE WHEEL!`).slice(0, Math.floor(t * 1.2));
    else if (fromP) msg = 'THE SHIP GOES OVERBOARD! CAPTAIN, JUMP!';
    else msg = tick % 40 < 30 ? 'PRESS SPACE TO JUMP OVER THE BOXES!' : '';
    drawText(msg, W / 2, H - 15, 8, t >= 100 && !fromP ? '#ffe14d' : '#ffffff', 'center', CPT.out);
    ctx.restore();
  }

  // ---------- Broken mech ----------
  const hash = (i) => {
    const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const BMK = { out: '#140a24', hi: '#c8a8ff', light: '#9a5cf0', mid: '#7a3fd8', dark: '#4a2a8a', deep: '#2a1650', blue: '#4a5ce0', cyan: '#5ff0ff', red: '#ff2a3a' };
  const BM_S = 0.95;
  const bmPt = (cx, bottom, s, face, lx, ly) => [cx + face * s * lx, bottom + s * ly];

  function bmBox(x, y, w, h, c, hi = BMK.light) {
    cRect(x - 1, y - 1, w + 2, h + 2, BMK.out);
    cRect(x, y, w, h, c);
    cRect(x, y, w, 1, hi);
    cRect(x, y + h - 2, w, 2, BMK.dark);
  }

  function pxLine(x0, y0, x1, y1, c) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    ctx.fillStyle = c;
    for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
  }

  function bmSparks(x, y, seed, amt = 1) {
    ctx.save();
    for (let k = 0; k < 7; k++) {
      const cyc = tick + k * 5 + seed * 11;
      const n = Math.floor(cyc / 16), ph = cyc % 16;
      if (hash(n * 13.7 + k * 3.1 + seed) > 0.5 * amt) continue;
      const a = -Math.PI / 2 + (hash(n * 5.3 + k + seed) - 0.5) * 2.8;
      const sp = 0.8 + hash(n * 9.1 + k * 2 + seed) * 2.2;
      const px = x + Math.cos(a) * sp * ph, py = y + Math.sin(a) * sp * ph + 0.12 * ph * ph;
      ctx.globalAlpha = 1 - ph / 16;
      ctx.fillStyle = ph < 4 ? '#ffffff' : ph < 9 ? '#ffe14d' : '#ff9a2e';
      ctx.fillRect(Math.round(px), Math.round(py), ph < 5 ? 2 : 1, 1);
      ctx.fillRect(Math.round(px - Math.cos(a) * sp), Math.round(py - Math.sin(a) * sp - 0.24 * ph), 1, 1);
    }
    ctx.globalAlpha = 1;
    if (hash(Math.floor(tick / 3) * 2.7 + seed) < 0.3 * amt) {
      blob(Math.round(x), Math.round(y), 2, '#ffffff');
      let ax = x, ay = y;
      for (let i = 0; i < 4; i++) {
        const nx = ax + (hash(tick * 1.3 + i + seed) - 0.5) * 10, ny = ay + (hash(tick * 2.1 + i + seed) - 0.5) * 10;
        pxLine(ax, ay, nx, ny, i % 2 ? '#ffffff' : BMK.cyan);
        ax = nx;
        ay = ny;
      }
    }
    ctx.restore();
  }

  function drawBmFist(x, y, ang, s = 1, glow = 0, flame = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(s, s);
    if (glow > 0) {
      ctx.save();
      ctx.globalAlpha *= glow * (0.35 + 0.15 * Math.sin(tick * 0.5));
      blob(0, 0, 14, BMK.cyan);
      ctx.restore();
    }
    if (flame > 0) {
      const fl = flame * (8 + ((tick * 7) % 6));
      cRect(-13 - fl, -4, fl, 8, 'rgba(95,240,255,0.45)');
      cRect(-13 - fl * 0.75, -3, fl * 0.75, 6, BMK.cyan);
      cRect(-13 - fl * 0.4, -2, fl * 0.4, 4, '#ffffff');
    }
    bmBox(-12, -7, 18, 14, BMK.mid);
    cRect(-14, -6, 3, 12, BMK.out);
    cRect(-13, -5, 2, 10, BMK.cyan);
    cRect(-7, -4, 9, 1, BMK.cyan);
    cRect(-7, -4, 1, 6, BMK.cyan);
    cRect(6, -8, 7, 16, BMK.out);
    cRect(6, -7, 6, 14, BMK.blue);
    cRect(6, -7, 6, 1, '#8a9cff');
    for (const ky of [-4, 0, 4]) cRect(7, ky, 5, 1, BMK.out);
    ctx.restore();
  }

  function drawBmCable(x0, y0, x1, y1, lt) {
    const pts = [];
    const d = Math.hypot(x1 - x0, y1 - y0);
    for (let i = 0; i <= 12; i++) {
      const p = i / 12;
      const sag = Math.sin(p * Math.PI) * Math.min(14, d * 0.12);
      const jit = Math.sin(p * 20 + lt * 0.9) * 1.2;
      pts.push([x0 + (x1 - x0) * p, y0 + (y1 - y0) * p + sag + jit]);
    }
    ctx.save();
    ctx.lineCap = 'round';
    for (const [lw, col] of [[4, BMK.out], [2, BMK.dark], [1, BMK.cyan]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    const pi = Math.floor((lt * 0.8) % 13);
    if (pts[pi]) blob(Math.round(pts[pi][0]), Math.round(pts[pi][1]), 2, '#ffffff');
    ctx.restore();
  }

  function drawBrokenMech(cx, bottom, s, face, o = {}) {
    const power = o.power === undefined ? 1 : o.power;
    const slump = o.slump || 0, rage = o.rage || 0, lights = o.lights || 0;
    const glitch = hash(Math.floor(tick / 3) * 7.1) < 0.07 ? (hash(tick) < 0.5 ? -2 : 2) : 0;
    const bob = Math.round(Math.sin(tick * 0.08) * power);
    const swing = Math.sin(tick * 0.05) * 0.15;
    const ty = -53 + bob;
    const cyan = (k) => (rage > 0.5 ? BMK.red : hash(Math.floor(tick / 4) + k * 9.3) < power * 0.94 ? BMK.cyan : '#1e3a4a');
    ctx.save();
    ctx.translate(Math.round(cx + glitch * s), Math.round(bottom));
    ctx.scale(face * s, s);
    ctx.translate(0, slump * 8);
    ctx.rotate(-0.14 * slump);

    ctx.save();
    ctx.translate(-24, -40 + bob);
    ctx.rotate(0.5 + swing * 0.5);
    bmBox(-4, 0, 8, 10, BMK.dark, BMK.mid);
    cRect(-4, 10, 2, 2, BMK.out);
    cRect(0, 10, 3, 3, BMK.out);
    cRect(-2, 10, 2, 1, '#ff9a2e');
    ctx.restore();
    const wx = -29 + Math.sin(tick * 0.05) * 2, wy = -12;
    ctx.save();
    ctx.lineWidth = 1;
    ['#ff3e3e', '#ffe14d', BMK.cyan].forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.moveTo(-26 + i * 1.5, -30 + bob);
      ctx.quadraticCurveTo(-34 + i * 2, -16 + i * 2, wx + i * 2, wy);
      ctx.stroke();
    });
    ctx.restore();
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(1.35 + swing);
    bmBox(0, -5, 18, 10, BMK.dark, BMK.mid);
    cRect(-1, -4, 2, 8, '#1e3a4a');
    cRect(18, -6, 4, 12, BMK.out);
    cRect(18, -5, 3, 10, '#3a46a0');
    ctx.restore();

    ctx.save();
    ctx.translate(-18, -46 + bob);
    ctx.rotate(-0.6);
    if (hash(Math.floor(tick / 2) * 3.3) < 0.65 * power) {
      const fl = 4 + hash(tick * 1.7) * 9;
      cRect(-16 - fl, -3, fl, 6, 'rgba(95,240,255,0.5)');
      cRect(-16 - fl * 0.6, -2, fl * 0.6, 4, '#ffffff');
    }
    bmBox(-14, -4, 12, 8, BMK.deep, BMK.dark);
    cRect(-17, -5, 3, 10, BMK.out);
    cRect(-16, -4, 1, 8, cyan(1));
    ctx.restore();
    ctx.save();
    ctx.translate(-17, -24 + bob);
    ctx.rotate(0.95 + Math.sin(tick * 0.13) * 0.14);
    cRect(-3, -3, 6, 6, BMK.out);
    cRect(-2, -2, 4, 4, '#6e7a90');
    if (hash(Math.floor(tick / 3) * 5.9) < 0.3 * power) {
      const fl = 3 + hash(tick * 2.3) * 6;
      cRect(-16 - fl, -2, fl, 4, BMK.cyan);
    }
    bmBox(-14, -4, 11, 8, BMK.deep, BMK.dark);
    cRect(-17, -5, 3, 10, BMK.out);
    ctx.restore();

    bmBox(-31, ty - 2, 14, 14, BMK.dark, BMK.mid);
    cRect(-28, ty + 4, 5, 1, BMK.out);
    cRect(-25, ty + 5, 4, 1, BMK.out);
    bmBox(-15, -18, 10, 18, BMK.dark, BMK.mid);
    bmBox(5, -18, 10, 18, BMK.dark, BMK.mid);
    bmBox(-17, -5, 14, 5, BMK.deep, BMK.dark);
    bmBox(3, -5, 14, 5, BMK.deep, BMK.dark);
    cRect(-12, -12, 4, 1, cyan(2));
    cRect(8, -12, 4, 1, cyan(3));
    bmBox(-13, -25 + bob, 26, 8, BMK.deep, BMK.dark);

    bmBox(-18, ty, 36, 30, BMK.mid);
    for (const [x, y] of [[-18, ty], [15, ty], [-18, ty + 27], [15, ty + 27]]) cRect(x, y, 3, 3, BMK.out);
    cRect(-15, ty + 17, 8, 1, cyan(4));
    cRect(-8, ty + 17, 1, 6, cyan(4));
    cRect(11, ty + 13, 1, 10, cyan(5));
    cRect(11, ty + 13, 5, 1, cyan(5));
    cRect(3, ty + 24, 7, 1, BMK.dark);
    cRect(-14, ty + 6, 1, 7, BMK.dark);
    cRect(13, ty + 3, 3, 1, BMK.dark);
    const vis = rage > 0.3 ? BMK.red : power < 0.3 ? '#1e3a4a' : cyan(6);
    for (let r = 0; r < 5; r++) {
      cRect(-11 + r * 2, ty + 19 + r, 4, 1, vis);
      cRect(7 - r * 2, ty + 19 + r, 4, 1, vis);
    }

    bmBox(-11, ty + 3, 22, 13, BMK.deep, BMK.dark);
    cRect(-10, ty + 4, 20, 11, '#1e6a88');
    cRect(-8, ty + 5, 7, 1, '#bff8ff');
    cRect(4, ty + 6, 4, 1, '#8adcf0');
    ctx.fillStyle = '#05040e';
    ctx.beginPath();
    [[-10, ty + 6], [-5, ty + 4], [-1, ty + 8], [-3, ty + 11], [-6, ty + 14], [-10, ty + 12]].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.fill();
    const eyeOn = rage > 0 || (power > 0.2 && tick % 90 > 4);
    blob(-6, ty + 9, 2, eyeOn ? (rage > 0 ? '#ff2020' : '#ff3e3e') : '#3a0a10');
    if (eyeOn) cRect(-6, ty + 8, 1, 1, '#ffd0d0');
    const ck = [-2, ty + 8];
    for (const [x, y] of [[9, ty + 5], [9, ty + 13], [3, ty + 15], [-9, ty + 4], [6, ty + 9]]) pxLine(ck[0], ck[1], x, y, 'rgba(230,252,255,0.9)');
    pxLine(4, ty + 6, 7, ty + 4, 'rgba(230,252,255,0.7)');

    ctx.fillStyle = BMK.out;
    ctx.beginPath();
    [[4, ty + 1], [13, ty + 1], [21, ty - 12], [18, ty - 13], [16, ty - 11]].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.fill();
    ctx.fillStyle = BMK.mid;
    ctx.beginPath();
    [[6, ty], [12, ty], [19, ty - 11], [17, ty - 11], [15, ty - 9]].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.fill();

    bmBox(16, ty - 2, 14, 14, BMK.mid);
    cRect(20, ty + 2, 6, 6, BMK.out);
    cRect(21, ty + 3, 4, 4, cyan(7));
    if (!o.noArm) {
      bmBox(19, ty + 11, 7, 11, BMK.dark, BMK.mid);
      drawBmFist(32, -32 + bob, 0.08 + Math.sin(tick * 0.06) * 0.05, 1, 0.3 * power, 0.35 * power);
    }

    if (rage > 0) {
      ctx.save();
      ctx.globalAlpha *= rage * (0.22 + 0.12 * Math.sin(tick * 0.6));
      blob(0, ty + 20, 36, '#ff2020');
      ctx.restore();
    }
    if (lights > 0) {
      const rate = Math.max(2, Math.round(12 - lights * 10));
      const LP = [[-14, ty + 3], [14, ty + 4], [-10, ty + 26], [10, ty + 27], [23, ty + 5], [-24, ty + 5], [-10, -10], [10, -10], [0, ty + 2], [30, -32], [-2, -22]];
      LP.forEach(([x, y], i) => {
        if ((tick + i * 3) % (rate * 2) < rate) blob(x, y, Math.round(1 + lights * 2), i % 2 ? '#ff2a2a' : '#ffffff');
      });
      if (lights > 0.45) {
        ctx.save();
        ctx.globalAlpha *= (lights - 0.45) * 1.6;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + tick * 0.05;
          const len = 30 + lights * 50;
          ctx.fillStyle = i % 2 ? '#ffffff' : '#ffd0d0';
          ctx.beginPath();
          ctx.moveTo(0, ty + 14);
          ctx.lineTo(Math.cos(a - 0.05) * len, ty + 14 + Math.sin(a - 0.05) * len);
          ctx.lineTo(Math.cos(a + 0.05) * len, ty + 14 + Math.sin(a + 0.05) * len);
          ctx.fill();
        }
        ctx.restore();
      }
    }
    ctx.restore();

    const P = (lx, ly) => {
      const [x, y] = bmPt(cx + glitch * s, bottom, s, face, lx, ly + slump * 8);
      return [x, y];
    };
    const amt = 1 + lights * 2 + rage;
    bmSparks(...P(-25, -31 + bob), 1, amt);
    bmSparks(...P(-2, ty + 8), 2, amt * 0.8);
    bmSparks(...P(-17, -24 + bob), 3, amt);
    bmSparks(...P(wx, wy), 4, amt * 0.7);
    if (power > 0.2 && hash(Math.floor(tick / 5) * 1.9) < 0.25) bmSparks(...P(18, ty - 10), 5, 0.6);
  }

  function drawBmPunch(lt, eBaseX, pBaseX) {
    const cx = eBaseX + 18, bot = 97;
    const [hx, hy] = bmPt(cx, bot, BM_S, -1, 32, -32);
    const [sx, sy] = bmPt(cx, bot, BM_S, -1, 22, -42);
    const [tx, ty] = [pBaseX + 40, 116];
    const P = (l) => (l < 10 ? -0.18 * Math.sin((l / 10) * Math.PI) : l < 20 ? Math.pow((l - 10) / 10, 2) : l < 28 ? 1 : Math.max(0, 1 - (l - 28) / 20));
    const at = (l) => [hx + (tx - hx) * P(l), hy + (ty - hy) * P(l)];
    const [x, y] = at(lt);
    drawBmCable(sx, sy, x, y, lt);
    if (lt < 10) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + lt * 0.4;
        const d = (10 - lt) * 3 + 4;
        ctx.fillStyle = i % 2 ? BMK.cyan : '#ffffff';
        ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), 2, 2);
      }
    }
    if (lt >= 10 && lt < 22) {
      for (let k = 3; k >= 1; k--) {
        const [gx, gy] = at(lt - k * 2);
        ctx.save();
        ctx.globalAlpha = 0.15 * (4 - k);
        drawBmFist(gx, gy, Math.PI, BM_S);
        ctx.restore();
      }
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(x + 18 + i * 6), Math.round(y - 8 + i * 4), 12, 1);
    }
    drawBmFist(x, y, Math.PI, BM_S, lt < 20 ? 0.8 : 0.2, lt >= 8 && lt < 22 ? 1.2 : 0.3);
    if (lt >= 20 && lt < 36) {
      const d = lt - 20;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - d / 14);
      ctx.strokeStyle = BMK.cyan;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(tx - 8, ty, 4 + d * 3, 3 + d * 1.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ctx.fillStyle = i % 2 ? BMK.cyan : BMK.light;
        ctx.fillRect(Math.round(tx - 8 + Math.cos(a) * d * 3.5), Math.round(ty + Math.sin(a) * d * 2.2), 3, 3);
      }
      ctx.restore();
      if (d < 2) {
        ctx.fillStyle = 'rgba(200,250,255,0.55)';
        ctx.fillRect(0, 0, W, H);
      }
      drawComic('KRAK!', tx - 8, ty - 38, d, BMK.cyan);
    }
  }

  const PM_BOT = 157;
  function bmGeo(fromP, eBaseX, pBaseX) {
    return fromP
      ? { cx: pBaseX + 24, bot: PM_BOT, f: 1, tx: eBaseX + 18, ty: 62, ground: 96, top: 6 }
      : { cx: eBaseX + 18, bot: 97, f: -1, tx: pBaseX + 24, ty: 116, ground: 156, top: 16 };
  }
  const mirA = (G, a) => (G.f < 0 ? a : Math.PI - a);

  function drawBmSmash(lt, eBaseX, pBaseX, fromP = false) {
    const G = bmGeo(fromP, eBaseX, pBaseX);
    const cx = G.cx, bot = G.bot;
    const [hx, hy] = bmPt(cx, bot, BM_S, G.f, 32, -32);
    const [sx, sy] = bmPt(cx, bot, BM_S, G.f, 22, -42);
    const tx = G.tx, ground = G.ground;
    const top = [tx, G.top], low = [tx, ground - 12];
    let x, y, ang;
    if (lt < 28) {
      const p = 1 - Math.pow(1 - lt / 28, 3);
      x = hx + (top[0] - hx) * p;
      y = hy + (top[1] - hy) * p - Math.sin(p * Math.PI) * 30;
      ang = mirA(G, Math.PI - (Math.PI / 2) * p);
    } else if (lt < 48) {
      x = top[0] + Math.sin(lt * 1.7) * (lt - 28) * 0.08;
      y = top[1] + Math.sin(lt * 0.3) * 2;
      ang = Math.PI / 2;
    } else if (lt < 60) {
      const p = Math.pow((lt - 48) / 12, 2.2);
      x = top[0];
      y = top[1] + (low[1] - top[1]) * p;
      ang = Math.PI / 2;
    } else if (lt < 82) {
      x = low[0] + (lt < 66 ? (lt % 2 ? 1 : -1) : 0);
      y = low[1];
      ang = Math.PI / 2;
    } else {
      const p = (lt - 82) / 22;
      x = low[0] + (hx - low[0]) * p;
      y = low[1] + (hy - low[1]) * p - Math.sin(p * Math.PI) * 40;
      ang = mirA(G, Math.PI / 2 + (Math.PI / 2) * p);
    }
    if (lt >= 10 && lt < 62) {
      const k = clamp((lt - 10) / 10, 0, 1);
      const r = 30 - clamp((lt - 10) / 40, 0, 1) * 16;
      ctx.save();
      ctx.globalAlpha = k * (tick % 6 < 4 ? 1 : 0.5);
      ctx.strokeStyle = '#ff2a3a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(tx, ground, r, r * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + lt * 0.08;
        const bx = tx + Math.cos(a) * (r + 4), by = ground + Math.sin(a) * (r + 4) * 0.3;
        ctx.fillStyle = '#ff2a3a';
        ctx.fillRect(Math.round(bx) - 3, Math.round(by), 6, 1);
        ctx.fillRect(Math.round(bx), Math.round(by) - 2, 1, 4);
      }
      ctx.restore();
      if (lt > 18 && tick % 10 < 6) drawText('LOCK', tx, ground + 4, 8, '#ff2a3a', 'center', BMK.out);
    }
    if (lt >= 28 && lt < 60) {
      const near = clamp((y - top[1]) / (low[1] - top[1]), 0, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.15 + near * 0.35})`;
      const sw = Math.round(6 + near * 18);
      ctx.fillRect(tx - sw, ground - 2, sw * 2, 4);
    }
    drawBmCable(sx, sy, x, y - 10, lt);
    if (lt >= 28 && lt < 48) {
      for (let r = 0; r < 3; r++) {
        const rr = ((lt * 2 + r * 8) % 24);
        ctx.save();
        ctx.globalAlpha = 1 - rr / 24;
        ctx.strokeStyle = BMK.cyan;
        ctx.beginPath();
        ctx.ellipse(x, y, rr + 6, (rr + 6) * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (lt >= 48 && lt < 60) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(x - 12 + i * 8), Math.round(y - 30 - (i % 2) * 10), 1, 22);
    }
    drawBmFist(x, y, ang, BM_S * 1.5, lt >= 28 && lt < 62 ? 0.9 : 0.2, lt < 28 || lt >= 82 ? 0.8 : lt >= 48 && lt < 60 ? 1.6 : 0.3);
    if (lt >= 60) {
      const d = lt - 60;
      ctx.save();
      ctx.globalAlpha = clamp(1 - (d - 20) / 24, 0, 1);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        const len = Math.min(1, d / 6) * (26 + hash(i * 3.7) * 26);
        const ex = tx + Math.cos(a) * len * 1.8, ey = ground + Math.abs(Math.sin(a)) * len * 0.25;
        pxLine(tx, ground, ex, ey, BMK.out);
        pxLine(tx, ground - 1, ex, ey - 1, i % 2 ? BMK.cyan : '#ff9a2e');
      }
      ctx.restore();
      if (d < 26) {
        ctx.save();
        ctx.globalAlpha = 1 - d / 26;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(tx, ground, d * 6, d * 1.5, 0, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const gx = tx + (hash(i * 4.1 + lt) - 0.5) * 120, gy = ground - 10 - hash(i * 2.3 + lt) * 50;
          ctx.fillStyle = i % 2 ? BMK.cyan : '#ff3eb0';
          ctx.fillRect(Math.round(gx), Math.round(gy), 4 + (i % 3) * 3, 2);
        }
        ctx.restore();
      }
      if (d < 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(0, 0, W, H);
      }
      if (d < 30) {
        drawComic('SMASH!', tx, ground - 70, d, '#ff9a2e');
        if (d > 6) drawComic('-5', tx + 34, ground - 52 - d * 0.4, d - 6, '#ff3e3e');
      }
    }
  }

  const BM_EMIT = [[-23, -48], [23, -48], [-6, -44], [0, -31]];
  function drawBmInferno(lt, eBaseX, pBaseX, fromP = false) {
    const G = bmGeo(fromP, eBaseX, pBaseX);
    const cx = G.cx, bot = G.bot, fl = G.ground;
    const [tx, ty] = [G.tx, G.ty];
    const em = BM_EMIT.map(([lx, ly]) => bmPt(cx, bot, BM_S, G.f, lx, ly + Math.round(Math.sin(tick * 0.08))));
    const OFF = [[-34, -34], [36, -26], [-28, 28], [30, 30]];
    if (lt < 46) {
      const k = clamp(lt / 40, 0, 1);
      em.forEach(([ex, ey], i) => {
        ctx.save();
        ctx.globalAlpha = 0.35 + k * 0.4;
        blob(Math.round(ex), Math.round(ey), Math.round(2 + k * 5), '#ff2a2a');
        ctx.globalAlpha = 0.9;
        blob(Math.round(ex), Math.round(ey), Math.round(1 + k * 2), '#ffe14d');
        ctx.restore();
        for (let j = 0; j < 6; j++) {
          const a = (j / 6) * Math.PI * 2 + lt * 0.3 + i;
          const d = (46 - lt) * 0.9 + 3;
          ctx.fillStyle = j % 2 ? '#ff9a2e' : '#ff2a2a';
          ctx.fillRect(Math.round(ex + Math.cos(a) * d), Math.round(ey + Math.sin(a) * d), 2, 2);
        }
      });
      if (lt >= 20) {
        em.forEach(([ex, ey], i) => {
          if ((tick + i * 2) % 6 < 3) pxLine(ex, ey, tx + OFF[i][0], ty + OFF[i][1], 'rgba(255,60,60,0.7)');
        });
        if (tick % 10 < 6) drawText('TARGET LOCKED', W / 2, 80, 8, '#ff2a3a', 'center', BMK.out);
      }
    }
    if (lt >= 44 && lt < 98) {
      const conv = 1 - clamp((lt - 44) / 22, 0, 1);
      const k = lt > 88 ? (98 - lt) / 10 : 1;
      const grow = clamp((lt - 44) / 4, 0, 1);
      ctx.save();
      ctx.globalAlpha = 0.14 * k;
      ctx.fillStyle = '#ff2a2a';
      ctx.fillRect(-8, 0, W + 16, H);
      ctx.lineCap = 'round';
      em.forEach(([ex, ey], i) => {
        const gx = tx + OFF[i][0] * conv, gy = ty + OFF[i][1] * conv;
        const ux = gx - ex, uy = gy - ey, len = Math.hypot(ux, uy) || 1;
        const nx = -uy / len, ny = ux / len;
        const pts = [];
        for (let s = 0; s <= 1.0001; s += 0.08) {
          if (s > grow) break;
          const off = Math.sin(s * 14 - lt * 0.8 + i) * 1.6;
          pts.push([ex + ux * s + nx * off, ey + uy * s + ny * off]);
        }
        const w = 4 + Math.sin(lt * 1.1 + i) * 1;
        for (const [lw, col, a] of [[w * 2.4, '#8a0a0a', 0.5], [w * 1.5, '#ff2a2a', 0.95], [w * 0.8, '#ff9a2e', 1], [w * 0.3, '#ffffff', 1]]) {
          ctx.globalAlpha = a * k;
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;
          ctx.beginPath();
          pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        }
        ctx.globalAlpha = k;
        for (let j = 0; j < 5; j++) {
          const p = (lt * 0.07 + j / 5 + i * 0.13) % 1;
          if (p > grow) continue;
          ctx.fillStyle = j % 2 ? '#ffe14d' : '#ff9a2e';
          ctx.fillRect(Math.round(ex + ux * p + nx * Math.sin(j * 3 + lt) * 5), Math.round(ey + uy * p + ny * Math.sin(j * 3 + lt) * 5), 2, 2);
        }
        blob(Math.round(ex), Math.round(ey), Math.round(4 + (tick % 3)), '#ffe14d');
      });
      ctx.restore();
    }
    if (lt >= 70 && lt < 116) {
      const d = lt - 70;
      const a = clamp(1 - (d - 20) / 26, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      blob(tx, ty, 16 + (d % 5), '#ff2a2a');
      blob(tx, ty - 2, 11 + (d % 4), '#ff9a2e');
      blob(tx, ty - 3, 6 + (d % 3), '#ffe14d');
      for (let i = 0; i < 9; i++) {
        const fx = tx - 30 + i * 7.5, h = 14 + hash(i * 1.7 + Math.floor(lt / 3)) * 26;
        ctx.fillStyle = i % 3 === 0 ? '#ffe14d' : i % 3 === 1 ? '#ff9a2e' : '#ff2a2a';
        ctx.beginPath();
        ctx.moveTo(fx - 4, fl);
        ctx.lineTo(fx + 4, fl);
        ctx.lineTo(fx + Math.sin(lt * 0.4 + i) * 3, fl - h);
        ctx.fill();
      }
      ctx.restore();
      if (d < 3) {
        ctx.fillStyle = 'rgba(255,200,150,0.7)';
        ctx.fillRect(0, 0, W, H);
      }
      drawComic('INFERNO!', tx, ty - 50, d, '#ff9a2e');
      if (d > 6) drawComic('-6', tx + 34, ty - 30 - d * 0.4, d - 6, '#ff3e3e');
    }
  }

  const SIGN_OFF = [[-46, -78], [40, -84], [-60, -30], [54, -34]];
  function drawWarnSign(x, y, sc, a, seed) {
    if (a <= 0) return;
    const fl = hash(Math.floor(tick / 2) + seed * 7) < 0.1 ? 0.3 : 1;
    const gx = hash(Math.floor(tick / 3) + seed * 3) < 0.1 ? 3 : 0;
    ctx.save();
    ctx.globalAlpha *= a * fl;
    ctx.translate(Math.round(x + gx), Math.round(y + Math.sin(tick * 0.1 + seed) * 2));
    ctx.scale(sc, sc);
    ctx.save();
    ctx.globalAlpha *= 0.3;
    blob(0, 2, 15, '#ff2a3a');
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(12, 9);
    ctx.lineTo(-12, 9);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,40,60,0.35)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ff2a3a';
    ctx.stroke();
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = '#ffd0d0';
    ctx.stroke();
    for (let yy = -6; yy < 9; yy += 3) {
      const hw = ((yy + 11) / 20) * 12 - 2;
      cRect(-hw, yy + ((tick >> 1) % 3), hw * 2, 1, 'rgba(255,220,220,0.18)');
    }
    cRect(-1, -5, 2, 8, '#ffffff');
    cRect(-1, 5, 2, 2, '#ffffff');
    cRect(-15, -13, 4, 1, '#ff2a3a');
    cRect(-15, -13, 1, 4, '#ff2a3a');
    cRect(11, 11, 4, 1, '#ff2a3a');
    cRect(14, 8, 1, 4, '#ff2a3a');
    ctx.restore();
  }

  function drawBmOveractive(lt, eBaseX, pBaseX, fromP = false) {
    const G = bmGeo(fromP, eBaseX, pBaseX);
    const cx = G.cx, bot = G.bot, f = G.f;
    const [tx, ty] = [G.tx, G.ty];
    const signA = lt < 280 ? 1 : (300 - lt) / 20;
    const signs = SIGN_OFF.map(([ox, oy]) => [cx + ox, bot + oy]);
    signs.forEach(([x, y], i) => drawWarnSign(x, y, 1, signA, i));
    OVER_BEAMS.forEach((bt, i) => {
      const d = lt - bt;
      const [sx, sy] = signs[i];
      if (d >= -8 && d < 0) {
        ctx.save();
        ctx.globalAlpha = 0.5 + (d + 8) / 16;
        blob(Math.round(sx), Math.round(sy), Math.round(4 + (d + 8)), '#ffffff');
        ctx.restore();
      }
      if (d >= 0 && d < 16) {
        const k = d < 12 ? 1 : (16 - d) / 4;
        const reach = clamp(d / 3, 0, 1);
        const ex = sx + (tx - sx) * reach, ey = sy + (ty - sy) * reach;
        const col = i % 2 ? '#ff2a3a' : BMK.cyan;
        ctx.save();
        ctx.lineCap = 'round';
        for (const [lw, c, a] of [[12, col, 0.35], [7, col, 1], [3, '#ffffff', 1]]) {
          ctx.globalAlpha = a * k;
          ctx.strokeStyle = c;
          ctx.lineWidth = lw * (0.85 + 0.15 * Math.sin(d * 2));
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
        ctx.restore();
        if (d >= 8 && d < 14) {
          blob(tx, ty, 10 + (d - 8) * 2, col);
          blob(tx, ty, 5 + (d - 8), '#ffffff');
          if (d === 8) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillRect(0, 0, W, H);
          }
        }
      }
    });
    const [mx, my] = bmPt(cx, bot, BM_S, f, 40, -32);
    OVER_BULLETS.forEach((bt, i) => {
      const d = lt - bt;
      const jx = ((i * 37) % 21) - 10, jy = ((i * 23) % 17) - 8;
      if (d >= 0 && d < 3) {
        blob(Math.round(mx + f * 4), Math.round(my), 5 - d, '#ffe14d');
        blob(Math.round(mx + f * 4), Math.round(my), Math.max(1, 3 - d), '#ffffff');
      }
      if (d >= 0 && d <= 6) {
        const p = d / 6;
        const bx = mx + (tx + jx - mx) * p, by = my + (ty + jy - my) * p;
        const ang = Math.atan2(ty + jy - my, tx + jx - mx);
        ctx.save();
        ctx.strokeStyle = '#ffe14d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx - Math.cos(ang) * 14, by - Math.sin(ang) * 14);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.restore();
      }
      if (d > 0 && d < 28) {
        ctx.fillStyle = '#e8c547';
        ctx.fillRect(Math.round(mx - f * (4 + d)), Math.round(my - 4 + d * d * 0.07), 2, 1);
      }
      if (d > 6 && d < 14) {
        ctx.save();
        ctx.globalAlpha = 1 - (d - 6) / 8;
        blob(tx + jx, ty + jy, 3 + (d - 6), '#ff9a2e');
        ctx.restore();
      }
    });
    if (lt >= OVER_BULLETS[0] && lt < OVER_BULLETS[5] + 14) drawComic('BRRRAT!', tx, ty - 50, Math.min(10, lt - OVER_BULLETS[0]), '#ffe14d');
    const d = lt - OVER_FIST;
    const [sx, sy] = bmPt(cx, bot, BM_S, f, 22, -42);
    const [hx, hy] = bmPt(cx, bot, BM_S, f, 32, -32);
    const fx = tx - f * 10;
    if (d >= -4 && d < 44) {
      let p, back = false;
      if (d < 0) p = 0;
      else if (d < 16) p = Math.pow(d / 16, 1.6);
      else if (d < 22) p = 1;
      else {
        p = 1 - (d - 22) / 22;
        back = true;
      }
      const x = hx + (fx - hx) * p, y = hy + (ty - hy) * p - Math.sin(p * Math.PI) * 26;
      for (let i = 1; i <= 8 && d > 0; i++) {
        const q = clamp(p - (back ? -i * 0.04 : i * 0.04), 0, 1);
        const px = hx + (fx - hx) * q, py = hy + (ty - hy) * q - Math.sin(q * Math.PI) * 26;
        ctx.save();
        ctx.globalAlpha = 0.4 - i * 0.04;
        blob(Math.round(px + Math.sin(i + lt * 0.5) * 3), Math.round(py + Math.cos(i + lt * 0.5) * 3), 4 - i * 0.3, i % 2 ? '#c8c8d8' : '#8a8aa0');
        ctx.restore();
      }
      drawBmCable(sx, sy, x, y, lt);
      drawBmFist(x, y, mirA(G, back ? 0 : Math.PI), BM_S * 1.2, 0.8, d < 16 ? 1.6 : back ? 1.2 : 0.4);
      if (d >= 16 && d < 34) {
        const dd = d - 16;
        ctx.save();
        ctx.globalAlpha = 1 - dd / 18;
        blob(tx, ty, 10 + dd * 2, '#ff9a2e');
        blob(tx, ty, 6 + dd, '#ffffff');
        ctx.restore();
        if (dd < 2) {
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillRect(0, 0, W, H);
        }
        drawComic('BOOM!', tx, ty - 46, dd, BMK.cyan);
      }
    }
    if (lt >= OVER_FIST + 44 && lt < OVER_END) drawComic('-7 TOTAL!', tx, ty - 56, lt - OVER_FIST - 44, '#ff3e3e');
  }

  function drawOverCutscene(lt, fromP = false) {
    const k = Math.min(clamp(lt / 8, 0, 1), clamp((110 - lt) / 8, 0, 1));
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = '#12020a';
    ctx.fillRect(0, 0, W, H);
    const off = (lt * 1.5) % 16;
    ctx.fillStyle = '#3a0812';
    for (let x = -off; x < W; x += 16) ctx.fillRect(Math.round(x), 0, 1, H);
    for (let y = -off; y < H; y += 16) ctx.fillRect(0, Math.round(y), W, 1);
    for (let i = 0; i < 14; i++) {
      if (hash(i * 3.3 + Math.floor(lt / 3)) < 0.5) continue;
      ctx.fillStyle = i % 3 ? 'rgba(255,40,60,0.35)' : 'rgba(95,240,255,0.3)';
      ctx.fillRect(Math.round(hash(i * 7.1 + lt) * W), Math.round(hash(i * 5.7 + lt) * H), 10 + (i % 4) * 12, 3);
    }
    const shakeX = lt > 82 ? Math.round((Math.random() - 0.5) * 8) : lt > 20 ? Math.round((Math.random() - 0.5) * 2) : 0;
    const cx = W / 2 + shakeX, bot = 192;
    const sc = 2.3;
    drawBrokenMech(cx, bot, sc, fromP ? 1 : -1, { rage: clamp((lt - 14) / 14, 0, 1) });
    [30, 45, 60, 75].forEach((t0, i) => {
      if (lt < t0) return;
      const pop = clamp((lt - t0) / 6, 0, 1);
      const [ox, oy] = [[-120, -130], [110, -140], [-140, -50], [130, -60]][i];
      drawWarnSign(cx + ox, bot + oy, 1.6 + (1 - pop) * 2, pop, i);
      if (lt - t0 < 4) {
        ctx.fillStyle = 'rgba(255,40,60,0.35)';
        ctx.fillRect(0, 0, W, H);
      }
    });
    if (lt >= 80) {
      for (let i = 0; i < 6; i++) {
        const y = Math.floor(hash(i * 2.9 + lt) * H);
        const h = 3 + Math.floor(hash(i * 4.4 + lt) * 10);
        const dx = Math.round((hash(i * 6.1 + lt) - 0.5) * 30);
        ctx.drawImage(cvs, 0, y, W, h, dx, y, W, h);
      }
    }
    if (lt >= 88 && lt < 96) {
      ctx.fillStyle = `rgba(255,30,40,${0.6 * (1 - (lt - 88) / 8)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (lt >= 64) {
      const tx = W / 2 + (tick % 4 < 2 ? 1 : -1);
      drawText('OVERACTIVE', tx - 2, 40, 16, '#5ff0ff', 'center', null);
      drawText('OVERACTIVE', tx + 2, 40, 16, '#ff2a3a', 'center', null);
      drawText('OVERACTIVE', tx, 40, 16, '#ffffff', 'center', null);
    }
    const bar = 22;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);
    drawText('!! WARNING !!', W / 2, 7, 8, tick % 10 < 5 ? '#ff2a3a' : '#ffe14d', 'center', BMK.out);
    const label = fromP ? 'YOU GO OVERACTIVE!' : 'THE BROKEN MECH GOES OVERACTIVE!';
    drawText(label.slice(0, Math.floor(lt / 2)), W / 2, H - 15, 8, '#ffffff', 'center', BMK.out);
    ctx.restore();
  }

  function drawMechBreak(lt, eBaseX) {
    const cx = eBaseX + 18, cy = 66, ground = 96;
    if (lt < BREAK_BOOM) {
      if (lt > 70) {
        ctx.fillStyle = `rgba(255,255,255,${((lt - 70) / 40) * 0.6})`;
        ctx.fillRect(0, 0, W, H);
      }
      for (let i = 0; i < 3; i++) bmSparks(cx + (hash(i * 3.1) - 0.5) * 40, cy + (hash(i * 5.3) - 0.5) * 40, 10 + i, 1 + lt / 40);
      return;
    }
    const d = lt - BREAK_BOOM;
    if (d < 6) {
      ctx.fillStyle = `rgba(255,255,255,${1 - d / 6})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (d < 40) {
      const a = 1 - d / 40;
      ctx.save();
      ctx.globalAlpha = a;
      blob(cx, cy, Math.round(10 + d * 1.8), '#ff2a2a');
      blob(cx, cy, Math.round(6 + d * 1.3), '#ff9a2e');
      blob(cx, cy, Math.round(3 + d * 0.8), '#ffe14d');
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, ground, d * 5, d * 1.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (let i = 0; i < 9; i++) {
      const vx = (hash(i * 4.7) - 0.5) * 5, vy = -2 - hash(i * 2.9) * 4;
      const t = Math.min(d, 60);
      const x = cx + vx * t, y = Math.min(ground, cy + vy * t + 0.18 * t * t);
      const rot = d * (hash(i * 6.2) - 0.5) * 0.5;
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(rot);
      const w = 5 + Math.floor(hash(i * 8.8) * 7), h = 4 + Math.floor(hash(i * 3.3) * 5);
      cRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2, BMK.out);
      cRect(-w / 2, -h / 2, w, h, [BMK.mid, BMK.dark, BMK.light, BMK.blue][i % 4]);
      if (i % 3 === 0) cRect(-w / 2, -h / 2, w, 1, BMK.cyan);
      ctx.restore();
      if (y < ground && d % 3 === 0) blob(Math.round(x - vx), Math.round(y + 3), 2, 'rgba(60,50,60,0.6)');
    }
    for (let i = 0; i < 6; i++) {
      const rise = (d * (0.6 + (i % 3) * 0.2) + i * 9) % 70;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.5 - rise / 140) * clamp(d / 10, 0, 1);
      blob(Math.round(cx - 20 + i * 8 + Math.sin(rise * 0.1 + i) * 4), Math.round(ground - 4 - rise), Math.round(4 + rise * 0.12), '#3a3040');
      ctx.restore();
    }
    for (let i = 0; i < 5; i++) {
      if (hash(i * 9.1 + Math.floor(d / 2)) < 0.5) continue;
      ctx.fillStyle = i % 2 ? BMK.cyan : '#ff3eb0';
      ctx.fillRect(Math.round(cx + (hash(i + d) - 0.5) * 60), Math.round(cy + (hash(i * 2 + d) - 0.5) * 50), 3 + i * 2, 2);
    }
  }

  function drawWreckBattleBg(HORIZON) {
    const bands = ['#12041e', '#1c0830', '#2a0c3c', '#3a1040', '#4a1438'];
    const bh = Math.ceil(HORIZON / bands.length);
    bands.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(-8, i * bh, W + 16, bh);
    });
    drawBarrierGrid(0, HORIZON, 0.28);
    for (const [x, w, h] of [[10, 50, 22], [90, 30, 14], [250, 60, 26], [330, 44, 18]]) {
      ctx.fillStyle = '#0a0610';
      ctx.beginPath();
      ctx.moveTo(x, HORIZON);
      ctx.lineTo(x + w * 0.2, HORIZON - h);
      ctx.lineTo(x + w * 0.5, HORIZON - h * 0.7);
      ctx.lineTo(x + w * 0.8, HORIZON - h * 1.1);
      ctx.lineTo(x + w, HORIZON);
      ctx.fill();
      for (let f = 0; f < 3; f++) {
        const fh = 4 + hash(f * 3.1 + x + Math.floor(tick / 4)) * 8;
        ctx.fillStyle = f % 2 ? '#ff9a2e' : '#ffe14d';
        ctx.fillRect(x + w * (0.3 + f * 0.2), HORIZON - h * 0.6 - fh, 2, fh);
      }
      for (let s = 0; s < 4; s++) {
        const rise = (tick * 0.3 + s * 18 + x) % 60;
        ctx.save();
        ctx.globalAlpha = 0.35 * (1 - rise / 60);
        blob(Math.round(x + w * 0.5 + Math.sin(rise * 0.1) * 4), Math.round(HORIZON - h - rise), Math.round(3 + rise * 0.15), '#2a2030');
        ctx.restore();
      }
    }
    ctx.fillStyle = '#3a2a30';
    ctx.fillRect(-8, HORIZON, W + 16, H - HORIZON);
    ctx.fillStyle = '#45333a';
    for (let y = HORIZON + 4, gap = 4; y < 164; gap += 2, y += gap) ctx.fillRect(-8, y, W + 16, 2);
    for (let i = 0; i < 6; i++) {
      const x0 = 20 + i * 66, y0 = HORIZON + 10 + (i % 3) * 24;
      pxLine(x0, y0, x0 + 18, y0 + 6, '#1a1018');
      pxLine(x0 + 18, y0 + 6, x0 + 30, y0 + 2, '#1a1018');
      if ((tick + i * 20) % 80 < 40) cRect(x0 + 18, y0 + 5, 2, 1, '#ff6a2a');
    }
    for (let i = 0; i < 12; i++) {
      const rise = (tick * (0.4 + (i % 3) * 0.2) + i * 37) % 150;
      ctx.fillStyle = i % 2 ? '#ff9a2e' : '#ffe14d';
      ctx.fillRect(Math.round((i * 53 + Math.sin(rise * 0.05 + i) * 8) % W), Math.round(H - rise), 1, 1);
    }
    if (hash(Math.floor(tick / 4) * 1.7) < 0.15) {
      ctx.fillStyle = 'rgba(95,240,255,0.25)';
      ctx.fillRect(Math.round(hash(tick) * W), Math.round(hash(tick * 2) * HORIZON), 30, 2);
    }
  }

  function drawBarrierGrid(y0, y1, alpha) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-8, y0, W + 16, y1 - y0);
    ctx.clip();
    const S = 14, hh = S * 0.866;
    for (let row = -1; row * hh < y1 + hh; row++) {
      for (let col = -1; col * S * 1.5 < W + S * 2; col++) {
        const x = col * S * 1.5, y = row * hh * 2 + (col % 2 ? hh : 0) + y0;
        const flick = hash(row * 13.1 + col * 7.7 + Math.floor(tick / 20)) ;
        ctx.globalAlpha = alpha * (0.6 + 0.4 * Math.sin(tick * 0.05 + col * 0.4 + row));
        ctx.strokeStyle = flick < 0.08 ? '#ff3eb0' : '#5ff0ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k <= 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const px = x + Math.cos(a) * S, py = y + Math.sin(a) * hh;
          if (k) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.stroke();
        if (flick < 0.05) {
          ctx.globalAlpha = alpha * 0.8;
          ctx.fillStyle = flick < 0.025 ? '#ff3eb0' : '#5ff0ff';
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // ---------- Thousand Forger ----------
  const FGK = {
    out: '#120e1a', stone: '#8a86a0', hi: '#b4b0c8', mid: '#6e6a86', dark: '#4a4660', deep: '#2e2a40', moss: '#4a7a4a',
    ghost: '#bff5e6', ghostMid: '#7fe0c8', ghostDeep: '#2a8a7a', eye: '#b8ff6a', red: '#ff2a3a', roof: '#5a2a4a', roofHi: '#8a3a5a', flag: '#a3202a', gold: '#e8c547',
  };
  const FG_S = 0.62;

  function fgBricks(x, y, w, h, c = FGK.stone) {
    cRect(x - 1, y - 1, w + 2, h + 2, FGK.out);
    cRect(x, y, w, h, c);
    cRect(x, y, w, 1, FGK.hi);
    cRect(x, y + h - 2, w, 2, FGK.dark);
    ctx.fillStyle = FGK.dark;
    for (let row = 0, yy = y + 5; yy < y + h - 2; yy += 5, row++) {
      ctx.fillRect(x, yy, w, 1);
      for (let xx = x + (row % 2 ? 4 : 9); xx < x + w - 1; xx += 10) ctx.fillRect(xx, yy - 4, 1, 4);
    }
  }

  function drawForgerHand(x, y, s, side, o = {}) {
    const glow = o.glow || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * side, s);
    const A = ctx.globalAlpha;
    for (let i = 0; i < 6; i++) {
      ctx.globalAlpha = A * (0.35 - i * 0.05);
      blob(16 + i * 5, 6 + Math.sin(tick * 0.2 + i) * 2, 7 - i, FGK.ghostMid);
    }
    if (glow > 0) {
      ctx.globalAlpha = A * glow * (0.3 + 0.15 * Math.sin(tick * 0.4));
      blob(0, 0, 22, FGK.eye);
    }
    ctx.globalAlpha = A;
    fgBricks(-14, -10, 28, 22, FGK.stone);
    for (let k = 0; k < 4; k++) fgBricks(-14 + k * 7, -17, 6, 7, k % 2 ? FGK.mid : FGK.stone);
    fgBricks(-19, -6, 6, 12, FGK.mid);
    ctx.fillStyle = hash(Math.floor(tick / 5) + side) < 0.85 ? FGK.eye : FGK.ghostDeep;
    ctx.fillRect(-8, -2, 12, 1);
    ctx.fillRect(-3, -2, 1, 8);
    ctx.fillRect(5, 4, 5, 1);
    ctx.restore();
  }

  function drawForger(cx, bottom, s, o = {}) {
    const open = o.open || 0, crumble = o.crumble || 0, shield = o.shield || 0, broken = !!o.broken;
    const fall = (t0) => (crumble > t0 ? Math.pow((crumble - t0) * 6, 2) * 6 : 0);
    const bob = Math.sin(tick * 0.05) * 3;
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(bottom + bob * s + (broken ? 8 * s : 0)));
    ctx.scale(s, s);
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    const A = ctx.globalAlpha;
    ctx.globalAlpha = A * (0.16 + 0.06 * Math.sin(tick * 0.1));
    blob(0, -72, 74, FGK.ghostMid);
    ctx.globalAlpha = A;
    const orbit = (front) => {
      for (let i = 0; i < 7; i++) {
        const a = tick * 0.02 + i * 0.9;
        if (Math.sin(a) > 0 !== front) continue;
        const ox = Math.cos(a) * 80, oy = -66 + Math.sin(a) * 16 + Math.sin(tick * 0.05 + i) * 4;
        fgBricks(Math.round(ox) - 3, Math.round(oy) - 2, 7, 5, i % 2 ? FGK.mid : FGK.stone);
      }
    };
    if (!broken) orbit(false);

    const sway = Math.sin(tick * 0.06) * 6;
    const bodyPath = (k) => {
      ctx.beginPath();
      ctx.moveTo(-44 * k, -98);
      ctx.quadraticCurveTo(-54 * k, -62, -30 * k, -42);
      for (let i = 0; i <= 10; i++) {
        const p = i / 10;
        ctx.lineTo(-30 * k + p * 60 * k + sway * Math.sin(p * Math.PI), -42 + Math.sin(p * Math.PI) * 38 * k + Math.sin(tick * 0.15 + i * 1.3) * 3);
      }
      ctx.quadraticCurveTo(54 * k, -62, 44 * k, -98);
      ctx.closePath();
    };
    ctx.globalAlpha = A * 0.55;
    ctx.fillStyle = FGK.ghostMid;
    bodyPath(1);
    ctx.fill();
    ctx.globalAlpha = A * 0.5;
    ctx.fillStyle = FGK.ghost;
    bodyPath(0.7);
    ctx.fill();
    ctx.globalAlpha = A;
    ctx.strokeStyle = FGK.ghostDeep;
    ctx.lineWidth = 1.5;
    bodyPath(1);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 6; j++) {
        ctx.globalAlpha = A * (0.5 - j * 0.07);
        blob(Math.round(-14 + i * 14 + Math.sin(tick * 0.1 + i * 2 + j * 0.6) * (2 + j)), -8 + j * 4, 4 - j * 0.5, FGK.ghostMid);
      }
    }
    ctx.globalAlpha = A;

    if (!broken) {
      for (const sd of [-1, 1]) {
        const f = fall(sd < 0 ? 0.15 : 0.3);
        ctx.save();
        ctx.translate(sd * 40, f);
        ctx.rotate(f * 0.01 * sd);
        fgBricks(-9, -114, 18, 42, sd < 0 ? FGK.stone : FGK.mid);
        if (!o.back) {
          cRect(-3, -104, 6, 8, FGK.out);
          cRect(-2, -103, 4, 7, hash(Math.floor(tick / 6) + sd) < 0.8 ? FGK.eye : FGK.ghostDeep);
          cRect(-3, -86, 6, 6, FGK.out);
          cRect(-2, -85, 4, 5, FGK.ghostDeep);
        }
        for (const [c, inset] of [[FGK.out, 0], [FGK.roof, 2]]) {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.moveTo(-12 + inset, -113 - inset / 2);
          ctx.lineTo(12 - inset, -113 - inset / 2);
          if (sd > 0) {
            ctx.lineTo(4, -128 + inset);
            ctx.lineTo(-3, -123 + inset);
          } else {
            ctx.lineTo(0, -136 + inset);
          }
          ctx.closePath();
          ctx.fill();
        }
        cRect(-10, -115, 20, 1, FGK.roofHi);
        if (sd < 0) {
          cRect(0, -145, 1, 10, FGK.out);
          const wv = Math.sin(tick * 0.2);
          ctx.fillStyle = FGK.flag;
          ctx.beginPath();
          ctx.moveTo(1, -145);
          ctx.lineTo(13, -143 + wv * 2);
          ctx.lineTo(9, -140);
          ctx.lineTo(12, -137 + wv);
          ctx.lineTo(1, -138);
          ctx.closePath();
          ctx.fill();
          cRect(5, -142, 2, 2, FGK.out);
        } else {
          pxLine(-6, -110, 2, -96, FGK.out);
          pxLine(2, -96, -2, -84, FGK.out);
        }
        ctx.restore();
      }
    }

    {
      ctx.save();
      ctx.translate(0, fall(0.5));
      if (broken) {
        fgBricks(-24, -80, 22, 20, FGK.mid);
        fgBricks(4, -72, 18, 14, FGK.dark);
        pxLine(-22, -78, -8, -62, FGK.out);
      } else {
        fgBricks(-28, -94, 56, 38);
        for (let i = 0; i < 5; i++) fgBricks(-28 + i * 12, -100, 8, 6, FGK.stone);
      }
      if (!broken && o.back) {
        fgBricks(-12, -86, 24, 30, FGK.mid);
        pxLine(-26, -90, -16, -80, FGK.out);
        pxLine(20, -60, 26, -74, FGK.out);
        cRect(-28, -60, 8, 3, FGK.moss);
        cRect(18, -94, 6, 2, FGK.moss);
      } else if (!broken) {
        cRect(-10, -84, 20, 28, FGK.out);
        blob(0, -84, 10, FGK.out);
        ctx.globalAlpha = A * (0.6 + 0.4 * Math.sin(tick * 0.15));
        cRect(-8, -84, 16, 27, FGK.ghostDeep);
        blob(0, -84, 8, FGK.ghostDeep);
        ctx.globalAlpha = A;
        blob(0, -70, 3 + Math.sin(tick * 0.2), FGK.eye);
        for (let k = -7; k <= 7; k += 4) cRect(k, -92, 1, 36, FGK.dark);
        cRect(-9, -76, 18, 1, FGK.dark);
        cRect(-9, -66, 18, 1, FGK.dark);
        pxLine(-26, -90, -16, -80, FGK.out);
        pxLine(-16, -80, -20, -66, FGK.out);
        pxLine(20, -60, 26, -74, FGK.out);
        cRect(-28, -60, 8, 3, FGK.moss);
        cRect(18, -94, 6, 2, FGK.moss);
        for (const chx of [-22, 22]) {
          for (let j = 0; j < 5; j++) cRect(chx + Math.round(Math.sin(tick * 0.08 + j * 0.5)), -56 + j * 4, 2, 3, j % 2 ? FGK.mid : FGK.dark);
        }
      }
      ctx.restore();
    }

    {
      ctx.save();
      ctx.translate(0, fall(0.62));
      const hy = -114;
      if ((open > 0 || broken) && o.heroFace && o.back) {
        blob(0, hy, 14, FGK.out);
        blob(0, hy, 13, '#6b4220');
        blob(-3, hy - 5, 5, '#8a5a30');
        for (const k of [-6, 0, 6]) pxLine(k, hy - 8, k + 1, hy + 9, '#4e2e14');
        cRect(-14, hy + 1, 2, 4, '#f2c79b');
        cRect(12, hy + 1, 2, 4, '#f2c79b');
      } else if ((open > 0 || broken) && o.heroFace) {
        blob(0, hy, 14, FGK.out);
        blob(0, hy - 3, 13, '#6b4220');
        blob(0, hy + 3, 11, '#f2c79b');
        cRect(-11, hy - 6, 22, 4, '#6b4220');
        cRect(-8, hy - 3, 5, 2, '#6b4220');
        cRect(2, hy - 3, 7, 2, '#6b4220');
        for (const ex of [-6, 3]) {
          cRect(ex, hy, 3, 4, FGK.out);
          cRect(ex + 1, hy, 1, 1, '#ffffff');
        }
        cRect(-10, hy + 5, 3, 2, '#e89a8a');
        cRect(7, hy + 5, 3, 2, '#e89a8a');
        if (o.scream) {
          const mo = Math.round(3 + open * 2 + Math.sin(tick * 0.8));
          cRect(-3, hy + 7, 6, mo, FGK.out);
          cRect(-2, hy + 8, 4, Math.max(1, mo - 2), '#c84a4a');
        } else {
          cRect(-3, hy + 8, 6, 1, FGK.out);
          cRect(-4, hy + 7, 1, 1, FGK.out);
          cRect(3, hy + 7, 1, 1, FGK.out);
        }
      } else if (open > 0 || broken) {
        blob(0, hy, 14, FGK.ghostDeep);
        blob(0, hy, 13, FGK.ghost);
        blob(-1, hy - 3, 8, '#e8fff8');
        for (const ex of [-5, 5]) blob(ex, hy - 4, 4, FGK.out);
        for (const [ex, ey, r] of [[-6, -4, 1.5], [-4, -3, 1], [5, -5, 1.5], [6, -3, 1], [0, -10, 2], [-9, -8, 1], [9, -9, 1]]) {
          if (hash(Math.floor(tick / 7) + ex * 3 + ey) < 0.92) blob(ex, hy + ey, r, FGK.red);
        }
        const mo = Math.round(4 + open * 4 + (o.scream ? Math.sin(tick * 0.8) * 1.5 : 0));
        cRect(-8, hy + 2, 16, mo, FGK.out);
        cRect(-6, hy + 3, 12, Math.max(1, mo - 2), '#3a0a14');
        ctx.fillStyle = '#f0ead8';
        for (let k = -7; k < 7; k += 3) {
          ctx.fillRect(k, hy + 2, 2, 2 + ((k + 7) % 2));
          ctx.fillRect(k + 1, hy + mo, 2, 2);
        }
        pxLine(-4, hy - 13, -1, hy - 8, FGK.ghostDeep);
        pxLine(8, hy - 11, 4, hy - 8, FGK.ghostDeep);
        for (let k = 0; k < 3; k++) cRect(-5 + k * 5, hy + 2 + mo, 1, (tick * 0.5 + k * 7) % 12, FGK.eye);
      }
      if (!broken) {
        for (const sd of [-1, 1]) {
          ctx.save();
          ctx.translate(sd * open * 16, -open * 4);
          ctx.rotate(sd * open * 0.35);
          const x0 = sd < 0 ? -17 : 0;
          fgBricks(x0, hy - 14, 17, 28, sd < 0 ? FGK.stone : FGK.mid);
          for (let k = 0; k < 2; k++) fgBricks(x0 + 1 + k * 9, hy - 20, 6, 6, FGK.stone);
          if (!o.back) cRect(sd < 0 ? -12 : 0, hy - 4, 12, 4, FGK.out);
          if (open < 0.3 && !o.back) cRect(sd < 0 ? -8 : 4, hy - 3, 4, 2, hash(Math.floor(tick / 4) + sd) < 0.9 ? FGK.eye : FGK.ghost);
          ctx.restore();
        }
      }
      ctx.restore();
    }

    const hb = Math.sin(tick * 0.07) * 3;
    for (const sd of [-1, 1]) {
      if (sd < 0 ? o.hideL : o.hideR) continue;
      const rx = sd * 62, ry = -54 + (sd < 0 ? hb : -hb);
      const hx = rx + (sd * 13 - rx) * shield, hy2 = ry + (-62 - ry) * shield;
      drawForgerHand(hx, hy2 + fall(sd < 0 ? 0.25 : 0.4) + (broken ? 34 : 0), 1, sd, { glow: shield * 0.6 });
    }
    if (shield > 0) {
      ctx.save();
      ctx.globalAlpha = A * shield * (o.shieldFlash ? 0.9 : 0.4 + 0.1 * Math.sin(tick * 0.2));
      ctx.strokeStyle = o.shieldFlash ? '#ffffff' : FGK.eye;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(-4, -64, 56, 66, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha *= 0.3;
      ctx.fillStyle = FGK.eye;
      ctx.fill();
      ctx.restore();
      if (shield > 0.9) {
        blob(0, -64, 6, FGK.out);
        blob(0, -64, 5, FGK.gold);
        cRect(-1, -68, 2, 8, FGK.flag);
        cRect(-3, -66, 6, 2, FGK.flag);
      }
    }
    if (!broken) orbit(true);
    if (crumble > 0.3) {
      const k = (crumble - 0.3) / 0.7;
      for (let i = 0; i < 10; i++) {
        const a = i * 0.628 + tick * 0.03;
        ctx.globalAlpha = A * k * (0.4 + 0.3 * Math.sin(tick * 0.5 + i));
        ctx.fillStyle = i % 2 ? '#ffffff' : FGK.eye;
        ctx.beginPath();
        ctx.moveTo(0, -72);
        ctx.lineTo(Math.cos(a - 0.05) * 220, -72 + Math.sin(a - 0.05) * 220);
        ctx.lineTo(Math.cos(a + 0.05) * 220, -72 + Math.sin(a + 0.05) * 220);
        ctx.fill();
      }
    }
    ctx.restore();
    if (o.glitch !== false && hash(Math.floor(tick / 3) * 1.9 + Math.round(cx)) < 0.22) {
      const x0 = Math.round(cx - 90 * s), w = Math.round(180 * s);
      for (let i = 0; i < 3; i++) {
        const y = Math.round(bottom - hash(tick + i * 3.1) * 130 * s);
        const h = 2 + Math.floor(hash(tick * 1.7 + i) * 5 * s);
        const dx = Math.round((hash(tick * 2.3 + i) - 0.5) * 16 * s);
        ctx.drawImage(cvs, x0, y, w, h, x0 + dx, y, w, h);
      }
      ctx.fillStyle = hash(tick) < 0.5 ? 'rgba(255,62,176,0.5)' : 'rgba(95,240,255,0.5)';
      ctx.fillRect(Math.round(cx + (hash(tick * 3) - 0.5) * 100 * s), Math.round(bottom - hash(tick * 4) * 130 * s), Math.round(10 * s + 4), 2);
    }
  }

  function forgerBattlePose(b, e, crumbling, who = 'enemy') {
    const anim = e && e.type === 'hit' && e.who === who ? e.move.anim : null;
    const lt = b.t;
    const o = who === 'player'
      ? { heroFace: true, back: true, shield: b.pShield ? 1 : b.pShieldRel > 0 ? b.pShieldRel / 40 : 0, shieldFlash: b.pShieldHit > 0 }
      : { shield: b.shield ? 1 : b.shieldRel > 0 ? b.shieldRel / 40 : 0, shieldFlash: b.shieldHit > 0 };
    if (anim === 'fpunch') o.hideL = lt >= 2 && lt < FP_END - 2;
    if (anim === 'brick') {
      o.hideL = lt >= 4 && lt < 80;
      o.hideR = lt >= 56 && lt < 138;
    }
    if (anim === 'gbeam') {
      o.open = lt < GB_CUT ? 0 : lt < GB_END - 40 ? 1 : (GB_END - lt) / 40;
      o.scream = lt < GB_HIT + 30;
    }
    if (anim === 'cdef' && lt >= CD_CUT) o.shield = 1;
    if (crumbling) o.crumble = clamp(lt / 140, 0, 1);
    return o;
  }

  const fgEase = (p) => p * p * (3 - 2 * p);

  function drawFgPunch(lt, eBaseX, pBaseX) {
    const S = 1.7, floor = 154;
    const rx = eBaseX + 18 - 62 * FG_S, ry = 100 - 54 * FG_S;
    const tx = pBaseX + 24, ty = floor - 12 * S;
    let x, y, sc = S;
    if (lt < 24) {
      const p = fgEase(lt / 24);
      x = rx + (tx - rx) * p;
      y = ry + (-20 - ry) * p;
      sc = FG_S + (S - FG_S) * p;
    } else if (lt < 34) {
      x = tx + Math.sin(lt * 1.3) * 2;
      y = -20 - (lt - 24) * 0.8;
    } else if (lt < FP_HIT) {
      const p = (lt - 34) / (FP_HIT - 34);
      x = tx;
      y = -28 + (ty + 28) * p * p;
    } else if (lt < 62) {
      x = tx;
      y = ty;
    } else {
      const p = fgEase((lt - 62) / (FP_END - 62));
      x = tx + (rx - tx) * p;
      y = ty + (ry - ty) * p;
      sc = S + (FG_S - S) * p;
    }
    if (lt >= 18 && lt < 64) {
      const k = clamp((lt - 18) / 26, 0, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.15 + k * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(tx, floor, 8 + k * 26, 3 + k * 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (lt >= 34 && lt < FP_HIT) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 5; i++) ctx.fillRect(tx - 24 + i * 12, y - 44 - (i % 2) * 10, 2, 30);
    }
    if (lt >= FP_HIT && lt < 64) {
      for (let i = 0; i < 5; i++) pxLine(tx, floor, tx + (i % 2 ? 1 : -1) * (24 + i * 8), floor + 2 + (i % 3) * 2, FGK.out);
    }
    drawForgerHand(x, y, sc, -1, { glow: lt >= 24 && lt < FP_HIT ? 1 : 0 });
    const d = lt - FP_HIT;
    if (d >= 0 && d < 30) {
      ctx.save();
      ctx.globalAlpha = 1 - d / 30;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(tx, floor, d * 6, d * 1.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = FGK.eye;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(tx, floor, d * 4, d * 1.1, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = Math.PI + (i / 7) * Math.PI;
        blob(Math.round(tx + Math.cos(a) * d * 3), Math.round(floor - 4 + Math.sin(a) * d * 1.5), 5 + d * 0.3, '#8a86a0');
      }
      ctx.restore();
      if (d < 4) {
        ctx.fillStyle = `rgba(255,255,255,${0.6 - d * 0.15})`;
        ctx.fillRect(0, 0, W, H);
      }
      drawComic('CRUSH!', tx + 40, floor - 74, d, '#ffe14d');
    }
  }

  const PF_S = 0.5, PF_BOT = 160;
  function fgGeo(fromP, eBaseX, pBaseX) {
    return fromP
      ? { cx: pBaseX + 24, bot: PF_BOT, s: PF_S, tx: eBaseX + 18, floor: 94, ty: 60, hover: 6, S: 0.95 }
      : { cx: eBaseX + 18, bot: 100, s: FG_S, tx: pBaseX + 24, floor: 154, ty: 118, hover: 34, S: 1.25 };
  }

  function drawFgBrick(lt, eBaseX, pBaseX, fromP = false) {
    const G = fgGeo(fromP, eBaseX, pBaseX);
    const S = G.S, floor = G.floor, tx = G.tx, gs = G.s;
    const hands = [
      { sd: -1, t0: 4, hit: BRICK_HITS[0], end: 80, rx: G.cx - 62 * gs, ry: G.bot - 54 * gs, hx: tx - 8 },
      { sd: 1, t0: 56, hit: BRICK_HITS[1], end: 138, rx: G.cx + 62 * gs, ry: G.bot - 54 * gs, hx: tx + 8 },
    ];
    for (const h of hands) {
      if (lt < h.t0 || lt >= h.end) continue;
      const hover = h.hit - 16, ty = floor - 10 * S, hy = G.hover;
      let x, y, sc = S, glow = 0;
      if (lt < hover) {
        const p = fgEase((lt - h.t0) / (hover - h.t0));
        x = h.rx + (h.hx - h.rx) * p;
        y = h.ry + (hy - h.ry) * p;
        sc = gs + (S - gs) * p;
      } else if (lt < h.hit - 6) {
        x = h.hx + Math.sin(lt * 2.1) * 1.5;
        y = hy - (lt - hover) * 1.2;
        glow = 1;
      } else if (lt < h.hit) {
        const p = (lt - (h.hit - 6)) / 6;
        x = h.hx;
        y = hy - 12 + (ty - hy + 12) * p * p;
        glow = 1;
      } else if (lt < h.hit + 16) {
        x = h.hx;
        y = ty;
      } else {
        const p = fgEase((lt - h.hit - 16) / (h.end - h.hit - 16));
        x = h.hx + (h.rx - h.hx) * p;
        y = ty + (h.ry - ty) * p;
        sc = S + (gs - S) * p;
      }
      if (lt >= hover - 10 && lt < h.hit + 16) {
        const k = clamp((lt - hover + 10) / 26, 0, 1);
        ctx.fillStyle = `rgba(0,0,0,${0.15 + k * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(h.hx, floor, 10 + k * 18, 3 + k * 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (lt >= hover && lt < h.hit) {
        for (let i = 0; i < 4; i++) {
          const fy = (lt * 4 + i * 23) % 60;
          cRect(Math.round(x - 14 + i * 9), Math.round(y + 14 + fy), 3, 2, i % 2 ? '#c86a4a' : '#8a86a0');
        }
      }
      drawForgerHand(x, y, sc, h.sd, { glow });
      const d = lt - h.hit;
      if (d >= 0 && d < 24) {
        ctx.save();
        ctx.globalAlpha = 1 - d / 24;
        ctx.strokeStyle = '#ffe14d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(h.hx, floor, d * 5, d * 1.3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        drawComic(h.sd < 0 ? 'BRICK!' : 'SMASH!', h.hx + (h.sd < 0 ? -30 : 38), floor - 66, d, h.sd < 0 ? '#ff9a2e' : '#ff3e6c');
        if (d < 3) {
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillRect(0, 0, W, H);
        }
      }
    }
  }

  function drawGhostSkull(x, y, s, a) {
    ctx.save();
    ctx.globalAlpha *= a * 0.85;
    blob(Math.round(x), Math.round(y), 4 * s, '#e8fff8');
    const e = Math.max(1, Math.round(s));
    cRect(Math.round(x - 2 * s), Math.round(y - 1), e, e + 1, FGK.out);
    cRect(Math.round(x + s), Math.round(y - 1), e, e + 1, FGK.out);
    cRect(Math.round(x - s), Math.round(y + 2 * s), Math.max(1, Math.round(2 * s)), 1, FGK.out);
    ctx.restore();
  }

  function drawFgBeam(lt, eBaseX, pBaseX, fromP = false) {
    const G = fgGeo(fromP, eBaseX, pBaseX);
    const hx = G.cx, my = Math.round(G.bot + (-114 + 6) * G.s);
    const tx = G.tx, ty = G.ty;
    const d = lt - GB_CUT;
    ctx.save();
    ctx.globalAlpha = 0.18 * clamp(d / 10, 0, 1) * clamp((GB_HIT + 50 - lt) / 20, 0, 1);
    ctx.fillStyle = '#2aff8a';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    if (d < 12) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      blob(hx, my, 3 + d * 0.8, FGK.eye);
      blob(hx, my, 2 + d * 0.4, '#ffffff');
      ctx.restore();
      return;
    }
    if (lt > GB_HIT + 44) return;
    const fade = clamp((GB_HIT + 44 - lt) / 14, 0, 1);
    const reach = clamp((d - 10) / 10, 0, 1);
    const ex = hx + (tx - hx) * reach, ey = my + (ty - my) * reach;
    const dx = ex - hx, dy = ey - my, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const strand = (amp, freq, ph, col, w, a) => {
      ctx.save();
      ctx.globalAlpha = a * fade;
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) {
        const p = i / 30;
        const off = Math.sin(p * freq + lt * 0.5 + ph) * amp * Math.sin(p * Math.PI * 0.9 + 0.3);
        const x = hx + dx * p + nx * off, y = my + dy * p + ny * off;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    };
    strand(0, 1, 0, FGK.ghostMid, 18, 0.3);
    strand(0, 1, 0, FGK.eye, 9, 0.55);
    strand(8, 9, 0, FGK.ghost, 2, 0.9);
    strand(6, 11, 2, FGK.ghostMid, 2, 0.9);
    strand(5, 7, 4, '#ffffff', 1, 0.9);
    strand(0, 1, 0, '#ffffff', 3, 0.95);
    for (let i = 0; i < 5; i++) {
      const p = ((lt * 0.03 + i / 5) % 1) * reach;
      const wob = Math.sin(lt * 0.3 + i) * 6;
      drawGhostSkull(hx + dx * p + nx * wob, my + dy * p + ny * wob, 1 + p, fade);
    }
    blob(hx, my, 6, FGK.eye);
    blob(hx, my, 3, '#ffffff');
    if (reach >= 1) {
      ctx.save();
      ctx.globalAlpha = fade;
      blob(tx, ty, 12 + Math.sin(lt) * 3, FGK.ghostMid);
      blob(tx, ty, 7, '#ffffff');
      ctx.restore();
    }
    if (lt >= GB_HIT && lt < GB_HIT + 30) drawComic('-7!', tx + 34, ty - 50, lt - GB_HIT, FGK.eye);
  }

  function cutsceneBars(top, caption, lt, col) {
    const bar = 22;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);
    drawText(top, W / 2, 7, 8, tick % 10 < 5 ? col : '#ffffff', 'center', FGK.out);
    drawText(caption.slice(0, Math.floor(lt / 2)), W / 2, H - 15, 8, '#ffffff', 'center', FGK.out);
  }

  function glitchText(text, y, size, base) {
    const tx = W / 2 + (tick % 4 < 2 ? 1 : -1);
    drawText(text, tx - 2, y, size, '#ff3eb0', 'center', null);
    drawText(text, tx + 2, y, size, '#5ff0ff', 'center', null);
    drawText(text, tx, y, size, base, 'center', null);
  }

  function regionGlitch(n, amt) {
    for (let i = 0; i < n; i++) {
      const y = Math.floor(Math.random() * H), h = 2 + Math.floor(Math.random() * 8);
      const dx = Math.round((Math.random() - 0.5) * amt);
      ctx.drawImage(cvs, 0, y, W, h, dx, y, W, h);
    }
  }

  function drawBeamCutscene(lt, fromP = false) {
    const k = Math.min(clamp(lt / 8, 0, 1), clamp((GB_CUT - lt) / 8, 0, 1));
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = '#040c0a';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) {
      const fx = ((i * 71 + lt * (0.5 + (i % 3) * 0.3)) % (W + 80)) - 40;
      ctx.globalAlpha = k * 0.15;
      blob(Math.round(fx), 120 + (i % 4) * 22, 30 + (i % 3) * 10, FGK.ghostDeep);
    }
    ctx.globalAlpha = k;
    const sh = lt > 58 && lt < 80 ? Math.round((Math.random() - 0.5) * 10) : lt > 92 ? Math.round((Math.random() - 0.5) * 4) : 0;
    const bot = H + 230;
    drawForger(W / 2 + sh, bot, 3, { open: clamp((lt - 30) / 30, 0, 1), hideL: true, hideR: true, scream: lt > 60, glitch: false, heroFace: fromP });
    const mouthY = Math.round(bot + Math.sin(tick * 0.05) * 9 + (-114 + 8) * 3);
    if (lt > 92) {
      const c = (lt - 92) / 38;
      ctx.globalAlpha = k * 0.85;
      blob(W / 2 + sh, mouthY, 4 + c * 16, FGK.eye);
      blob(W / 2 + sh, mouthY, 2 + c * 9, '#ffffff');
      for (let i = 0; i < 12; i++) {
        const a = i * 0.52 + lt * 0.2, r = 70 - ((lt * 3 + i * 7) % 70);
        cRect(Math.round(W / 2 + Math.cos(a) * r), Math.round(mouthY + Math.sin(a) * r * 0.6), 2, 2, i % 2 ? FGK.eye : '#ffffff');
      }
      ctx.globalAlpha = k;
    }
    if (lt >= 58 && lt < 64) {
      ctx.fillStyle = 'rgba(232,255,248,0.85)';
      ctx.fillRect(0, 0, W, H);
    }
    if (lt > 60) regionGlitch(lt > 92 ? 6 : 3, 24);
    if (lt >= 70) glitchText('GHOSTLY BEAM', 30, 16, '#e8fff8');
    cutsceneBars('!! DANGER !!', fromP ? 'YOUR TRUE FACE IS REVEALED!' : 'IT REVEALS ITS TRUE FACE...', lt, FGK.eye);
    ctx.restore();
  }

  function drawDefCutscene(lt, fromP = false) {
    const k = Math.min(clamp(lt / 8, 0, 1), clamp((CD_CUT - lt) / 8, 0, 1));
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) {
      const a = i * 0.524 + lt * 0.01;
      ctx.globalAlpha = k * 0.12;
      ctx.fillStyle = i % 2 ? FGK.gold : FGK.eye;
      ctx.beginPath();
      ctx.moveTo(W / 2, 140);
      ctx.lineTo(W / 2 + Math.cos(a - 0.1) * 400, 140 + Math.sin(a - 0.1) * 400);
      ctx.lineTo(W / 2 + Math.cos(a + 0.1) * 400, 140 + Math.sin(a + 0.1) * 400);
      ctx.fill();
    }
    ctx.globalAlpha = k;
    const sh = fgEase(clamp((lt - 20) / 32, 0, 1));
    const quake = lt >= 52 && lt < 62 ? Math.round((Math.random() - 0.5) * 8) : 0;
    drawForger(W / 2 + quake, H + 70, 2.2, { shield: sh, glitch: false, shieldFlash: lt >= 52 && lt < 58 });
    if (lt >= 52 && lt < 56) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(0, 0, W, H);
    }
    if (lt >= 96) {
      const r = (lt - 96) * 14;
      ctx.save();
      ctx.globalAlpha = k * Math.max(0, 1 - (lt - 96) / 24);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(W / 2, 145, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = FGK.eye;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(W / 2, 145, r * 0.8, r * 0.44, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (lt >= 60) glitchText('CASTLE DEFENCE', 30, 16, FGK.gold);
    cutsceneBars('!! WARNING !!', fromP ? 'YOU RAISE A CASTLE SHIELD!' : 'IT RAISES A CASTLE SHIELD!', lt, FGK.gold);
    ctx.restore();
  }

  function drawFgShock(lt, eBaseX, pBaseX, fromP = false) {
    const G = fgGeo(fromP, eBaseX, pBaseX);
    const d = lt - CD_CUT;
    const sx = G.cx + (fromP ? 4 : -4), sy = Math.round(G.bot - 64 * G.s), tx = G.tx, ty = fromP ? 66 : 128;
    for (let r = 0; r < 3; r++) {
      const p = clamp((d - r * 6) / 30, 0, 1);
      if (p <= 0 || p >= 1) continue;
      const x = sx + (tx - sx) * p, y = sy + (ty - sy) * p;
      ctx.save();
      ctx.globalAlpha = 1 - p * 0.5;
      ctx.strokeStyle = r === 0 ? '#ffffff' : FGK.eye;
      ctx.lineWidth = 3 - r;
      ctx.beginPath();
      ctx.ellipse(x, y, 8 + p * 26, 16 + p * 36, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const h = lt - CD_HIT;
    if (h >= 0 && h < 28) {
      ctx.save();
      ctx.globalAlpha = 1 - h / 28;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(tx, G.floor, h * 5, h * 1.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      drawComic('SHOCKWAVE!', tx + 44, ty - 52, h, FGK.eye);
    }
  }

  function drawForgerCrumble(lt, eBaseX) {
    const cx = eBaseX + 18, ground = 96;
    for (let i = 0; i < 14; i++) {
      const t0 = i * 9;
      if (lt < t0) continue;
      const d = Math.min(lt - t0, 50);
      const x = cx + (hash(i * 3.7) - 0.5) * 100, y0 = 10 + hash(i * 1.3) * 50;
      const y = Math.min(ground, y0 + 0.12 * d * d);
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(d * 0.1 * (hash(i) - 0.5));
      fgBricks(-4, -3, 8, 6, i % 2 ? FGK.mid : FGK.stone);
      ctx.restore();
      if (y >= ground && lt - t0 < 60) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        blob(Math.round(x), ground - 2, 5, '#5e5a72');
        ctx.restore();
      }
    }
    if (lt >= 140) {
      const d = lt - 140;
      if (d < 10) {
        ctx.fillStyle = `rgba(232,255,248,${1 - d / 10})`;
        ctx.fillRect(0, 0, W, H);
      }
      for (let i = 0; i < 20; i++) {
        const p = (d * (1 + (i % 4) * 0.4) + i * 2) / 40;
        if (p > 1) continue;
        ctx.save();
        ctx.globalAlpha = 1 - p;
        blob(Math.round(cx + (hash(i * 5.1) - 0.5) * 120), Math.round(70 - p * 80), 3, i % 2 ? FGK.ghost : FGK.eye);
        ctx.restore();
      }
    }
  }

  function drawRuinsBattleBg(HORIZON) {
    const bands = ['#10061c', '#1a0a2a', '#260e36', '#341240', '#3e1844'];
    const bh = Math.ceil(HORIZON / bands.length);
    bands.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(-8, i * bh, W + 16, bh);
    });
    drawBarrierGrid(0, HORIZON, 0.22);
    for (const [x, w, h, merl] of [[-6, 70, 50, false], [70, 40, 34, true], [262, 52, 58, false], [326, 66, 40, true]]) {
      fgBricks(x, HORIZON - h, w, h, FGK.deep);
      if (merl) for (let i = 0; i < Math.floor(w / 12); i++) fgBricks(x + 2 + i * 12, HORIZON - h - 6, 7, 6, FGK.deep);
      else for (let i = 0; i < 4; i++) fgBricks(x + 4 + i * (w / 4), HORIZON - h - 3 - (i * 7) % 9, 6, 4 + (i * 5) % 7, FGK.deep);
    }
    fgBricks(140, 6, 26, HORIZON - 6, FGK.dark);
    ctx.fillStyle = FGK.out;
    ctx.beginPath();
    ctx.moveTo(136, 7);
    ctx.lineTo(170, 7);
    ctx.lineTo(160, -14);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#05020a';
    ctx.fillRect(-8, 0, W + 16, HORIZON);
    ctx.restore();
    for (const fx of [40, 120, 300, 360]) {
      for (let f = 0; f < 3; f++) {
        const fh = 4 + hash(f * 3.1 + fx + Math.floor(tick / 4)) * 8;
        cRect(fx - 3 + f * 3, Math.round(HORIZON - fh), 3, Math.round(fh), f % 2 ? '#ff9a2e' : FGK.eye);
      }
    }
    for (let i = 0; i < 8; i++) {
      const gx = (i * 53 + tick * 0.3) % W, gy = 10 + ((i * 29 + Math.sin(tick * 0.03 + i) * 8) % 50);
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(tick * 0.1 + i);
      blob(Math.round(gx), Math.round(gy), 2, FGK.ghost);
      ctx.restore();
    }
    ctx.fillStyle = '#3e3a52';
    ctx.fillRect(-8, HORIZON, W + 16, H - HORIZON);
    ctx.fillStyle = '#4a4660';
    for (let y = HORIZON + 4, gap = 4; y < 164; gap += 2, y += gap) ctx.fillRect(-8, y, W + 16, 2);
    for (const [x, y, w] of [[20, 120, 10], [170, 100, 8], [350, 130, 12], [250, 150, 9]]) fgBricks(x, y, w, 6, FGK.mid);
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
    } else if (game.mode === 'ufo') {
      renderShip();
    } else if (game.mode === 'mech') {
      renderMech();
    } else if (game.mode === 'bridge') {
      renderBridge();
    } else if (game.mode === 'crash') {
      renderCrash();
    } else if (game.mode === 'wreck') {
      renderWreck();
    } else if (game.mode === 'ruins') {
      renderRuins();
    } else if (game.mode === 'groad') {
      renderGlitchRoad();
    } else if (game.mode === 'climb') {
      renderClimb();
    } else if (game.mode === 'transition' && pendingBattle && pendingBattle.returnMode !== 'world') {
      if (pendingBattle.returnMode === 'mech') renderMech();
      else if (pendingBattle.returnMode === 'groad') renderGlitchRoad();
      else if (pendingBattle.returnMode === 'climb') renderClimb();
      else if (pendingBattle.returnMode === 'bridge') renderBridge();
      else if (pendingBattle.returnMode === 'wreck') renderWreck();
      else if (pendingBattle.returnMode === 'ruins') renderRuins();
      else if (pendingBattle.returnMode === 'maze') renderMaze();
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
    if (run.mode === 'speedrun' && !(game.mode === 'eye' && eye.phase === 'end')) drawRunTimer();
    if (admin.open) drawAdminPanel();
    if (replay.recorder && replay.recorder.state === 'recording') {
      replay.vctx.drawImage(cvs, 0, 0, replay.vcan.width, replay.vcan.height);
    }
    if (replay.on && !exportState.on) drawReplayBar();
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
    if (tpJustUnlocked && t > 120) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (t - 120) / 30);
      const col = Math.floor(tick / 8) % 2 ? '#ff3eb0' : '#c87cff';
      drawText('TELEPORT UNLOCKED IN CLASSIC MODE!', W / 2, 74, 8, col, 'center');
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
      if (run.rank) drawText(`RANK #${run.rank} ON THE ${GAME_VERSION} LEADERBOARD`, W / 2, 24, 8, '#ffe14d', 'center');
      const ver = `PLAYED ON VERSION ${replay.on ? replay.version : GAME_VERSION}`;
      const vw = ver.length * 8 + 10;
      ctx.fillStyle = 'rgba(122,42,156,0.85)';
      ctx.fillRect(W / 2 - vw / 2, 35, vw, 12);
      ctx.fillStyle = '#c87cff';
      ctx.fillRect(W / 2 - vw / 2, 46, vw, 1);
      drawText(ver, W / 2, 37, 8, '#ffffff', 'center', null);
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
    if (b === 290) fadeThen(enterShip);
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

  // ---------- Chapter 4: the spaceship ----------
  const SH_CW = 22, SH_CH = 22;
  const SH_W = SH_CW * 2 + 1, SH_H = SH_CH * 2 + 1;
  const SH_R = SH_W / 2;
  const shipDist = (tx, ty) => Math.hypot(tx + 0.5 - SH_W / 2, ty + 0.5 - SH_H / 2);
  const shipInside = (tx, ty) => shipDist(tx, ty) < SH_R - 0.5;
  const shipCellIn = (cx, cy) => cx >= 0 && cy >= 0 && cx < SH_CW && cy < SH_CH && shipDist(cx * 2 + 1, cy * 2 + 1) < SH_R - 2;
  const shipCore = (tx, ty) => shipDist(tx, ty) < 1.8;
  const shipGrid = (() => {
    const r = rng(4040);
    const g = [];
    for (let y = 0; y < SH_H; y++) g.push(new Array(SH_W).fill(1));
    const start = [Math.floor(SH_CW / 2), Math.floor(SH_CH / 2)];
    const seen = new Set([start.join(',')]);
    const stack = [start];
    g[start[1] * 2 + 1][start[0] * 2 + 1] = 0;
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        .map(([dx, dy]) => [cx + dx, cy + dy, dx, dy])
        .filter(([x, y]) => shipCellIn(x, y) && !seen.has(x + ',' + y));
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
    const r2 = rng(99);
    for (let i = 0; i < 70; i++) {
      const x = 1 + Math.floor(r2() * (SH_W - 2)), y = 1 + Math.floor(r2() * (SH_H - 2));
      if (g[y][x] !== 1) continue;
      const horiz = x % 2 === 0 && y % 2 === 1, vert = x % 2 === 1 && y % 2 === 0;
      if (horiz && shipCellIn(x / 2 - 1, (y - 1) / 2) && shipCellIn(x / 2, (y - 1) / 2)) g[y][x] = 0;
      if (vert && shipCellIn((x - 1) / 2, y / 2 - 1) && shipCellIn((x - 1) / 2, y / 2)) g[y][x] = 0;
    }
    for (let y = 0; y < SH_H; y++) {
      for (let x = 0; x < SH_W; x++) {
        const d = shipDist(x, y);
        if (d < 4.6) g[y][x] = shipCore(x, y) ? 1 : 0;
      }
    }
    return g;
  })();
  const shipBfs = (from) => {
    const dist = new Map([[from.join(','), 0]]);
    const q = [from];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (dist.has(k) || nx < 0 || ny < 0 || nx >= SH_W || ny >= SH_H || shipGrid[ny][nx]) continue;
        dist.set(k, dist.get(x + ',' + y) + 1);
        q.push([nx, ny]);
      }
    }
    return dist;
  };
  const SHIP_SPAWN = (() => {
    const cy = Math.floor(SH_CH / 2);
    for (let cx = 0; cx < SH_CW; cx++) if (shipCellIn(cx, cy)) return [cx * 2 + 1, cy * 2 + 1];
    return [SH_W >> 1, SH_H >> 1];
  })();
  const SHIP_DOOR = (() => {
    let best = SHIP_SPAWN, bd = -1;
    for (const [k, d] of shipBfs(SHIP_SPAWN)) {
      const [x, y] = k.split(',').map(Number);
      if (x % 2 === 1 && y % 2 === 1 && x > SH_W / 2 && d > bd) {
        bd = d;
        best = [x, y];
      }
    }
    return best;
  })();
  const SHIP_HIDDEN = (() => {
    const [dx, dy] = SHIP_DOOR;
    let best = null, bs = 1e9;
    for (let y = 2; y < SH_H - 2; y += 2) {
      for (let x = 1; x < SH_W - 1; x += 2) {
        if (shipGrid[y][x] !== 1 || shipGrid[y + 1][x] !== 0 || shipGrid[y - 1][x] !== 0 || shipCore(x, y)) continue;
        const ax = Math.abs(x - dx), ay = Math.abs(y - dy);
        if (ax > 9 || ay > 4 || ax + ay < 3) continue;
        const score = Math.abs(ax + ay - 6);
        if (score < bs) {
          bs = score;
          best = [x, y];
        }
      }
    }
    return best || [dx - 2, dy - 1];
  })();
  const SHIP_BUTTON = (() => {
    const cx = Math.floor(SH_CW / 2);
    for (let cy = SH_CH - 1; cy >= 0; cy--) if (shipCellIn(cx, cy)) return [cx * 2 + 1, cy * 2 + 1];
    return SHIP_SPAWN;
  })();
  const shipWall = (tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= SH_W || ty >= SH_H) return true;
    if (tx === SHIP_HIDDEN[0] && ty === SHIP_HIDDEN[1] && ship.hdOpen >= 1) return false;
    return shipGrid[ty][tx] === 1;
  };
  function shipBlocked(x, y) {
    for (const [ox, oy] of [[-4, -3], [3, -3], [-4, 3], [3, 3]]) {
      if (shipWall(Math.floor((x + ox) / MZ_T), Math.floor((y + oy) / MZ_T))) return true;
    }
    return false;
  }
  const ALIEN_LINES = [
    'HEY! NO HUMANS ALLOWED ON THIS DECK!',
    'I AM ON MY LUNCH BREAK. GO AWAY.',
    'HAVE YOU SEEN MY STAPLER?',
    'BLEEP BLOOP... I MEAN, HELLO.',
    'THE BOSS IS IN THE MECH STORAGE.',
    'WATCH WHERE YOU WALK, EARTHLING!',
    'ANOTHER DAY, ANOTHER GALAXY...',
    'IS IT FRIDAY YET? IT IS NEVER FRIDAY.',
    'DID YOU FILL OUT FORM 7-B?',
    'COFFEE... NEED... COFFEE...',
    'YOU MUST BE {NAME}! EVERYONE IS TALKING!',
    'THE MECH STORAGE IS IN THE FAR CORNER.',
  ];
  const ship = {
    px: 0, py: 0, face: 1, up: false, walk: 0, cx: 0, cy: 0, leaving: false, doorT: 0, aliens: [],
    phase: 'find', cutT: 0, hdOpen: 0, hdTarget: 0, focus: null, cutAlien: null, btnT: 0,
  };
  const SHIP_SEEN_LINES = ['WHAT WAS THAT?!', 'A SECRET DOOR...', 'IT LOOKS EXACTLY LIKE THE WALL!', 'THERE MUST BE A WAY TO OPEN IT...'];
  const SHIP_QUEST = { find: 'FIND THE MECH STORAGE', button: 'QUEST: CLICK THE RED BUTTON', enter: 'QUEST: ENTER THE HIDDEN DOOR' };

  function makeAliens() {
    const r = rng(77);
    const list = [];
    for (let guard = 0; list.length < 22 && guard < 6000; guard++) {
      const tx = Math.floor(r() * SH_CW) * 2 + 1, ty = Math.floor(r() * SH_CH) * 2 + 1;
      if (shipGrid[ty][tx] !== 0) continue;
      if (Math.abs(tx - SHIP_SPAWN[0]) + Math.abs(ty - SHIP_SPAWN[1]) < 8) continue;
      if (Math.abs(tx - SHIP_DOOR[0]) + Math.abs(ty - SHIP_DOOR[1]) < 6) continue;
      if (list.some((a) => Math.abs(a.tx - tx) + Math.abs(a.ty - ty) < 4)) continue;
      const [x, y] = tileCenter([tx, ty]);
      list.push({ x, y, tx, ty, dir: [0, 0], skin: list.length % ALIEN_SKINS.length, t: Math.floor(r() * 300), say: '', sayT: 0, id: list.length });
    }
    return list;
  }

  function shipCam(snap) {
    const [fx, fy] = ship.focus || [ship.px, ship.py];
    const tx = clamp(fx - W / 2, -40, SH_W * MZ_T - W + 40);
    const ty = clamp(fy - H / 2, -40, SH_H * MZ_T - H + 40);
    const k = ship.focus ? 0.06 : 0.2;
    ship.cx = snap ? tx : ship.cx + (tx - ship.cx) * k;
    ship.cy = snap ? ty : ship.cy + (ty - ship.cy) * k;
  }

  function enterShip() {
    game.mode = 'ufo';
    Object.assign(ship, { leaving: false, doorT: 0, phase: 'find', cutT: 0, hdOpen: 0, hdTarget: 0, focus: null, cutAlien: null, btnT: 0 });
    if (!ship.aliens.length) ship.aliens = makeAliens();
    for (const a of ship.aliens) a.sayT = 0;
    [ship.px, ship.py] = tileCenter(SHIP_SPAWN);
    ship.face = 1;
    ship.up = false;
    shipCam(true);
    showTitle('THE SPACESHIP', '- CHAPTER 4 -');
  }

  function shipAfterMech() {
    game.mode = 'ufo';
    Object.assign(ship, { leaving: false, doorT: 0, phase: 'cut', cutT: 0, hdOpen: 0, hdTarget: 0, focus: null, btnT: 0 });
    if (!ship.aliens.length) ship.aliens = makeAliens();
    for (const a of ship.aliens) a.sayT = 0;
    const [dx, dy] = SHIP_DOOR;
    const out = [[-1, 0], [0, 1], [0, -1], [1, 0]].find(([ox, oy]) => !shipWall(dx + ox, dy + oy)) || [0, 0];
    [ship.px, ship.py] = tileCenter([dx + out[0], dy + out[1]]);
    ship.face = -1;
    ship.up = false;
    const [hx, hy] = SHIP_HIDDEN;
    let sx = hx, sy = hy + 1;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1]]) {
      let n = 0;
      while (n < 4 && !shipWall(sx + ox * (n + 1), sy + oy * (n + 1))) n++;
      if (n >= 2) {
        sx += ox * n;
        sy += oy * n;
        break;
      }
    }
    const [ax, ay] = tileCenter([sx, sy]);
    ship.cutAlien = { x: ax, y: ay, skin: Math.floor(Math.random() * ALIEN_SKINS.length), face: 1, alpha: 0, walk: 0 };
    shipCam(true);
  }

  function updateShipCutscene() {
    const t = ++ship.cutT;
    const a = ship.cutAlien;
    const [hx, hy] = tileCenter(SHIP_HIDDEN);
    const below = hy + MZ_T;
    if (t >= 30 && t < 250) ship.focus = [hx, hy + 8];
    if (t >= 250) ship.focus = null;
    if (t >= 60 && t < 130) {
      a.alpha = Math.min(1, a.alpha + 0.1);
      const dx = hx - a.x, dy = below - a.y;
      if (Math.abs(dx) > 0.5) a.face = Math.sign(dx);
      a.x += Math.sign(dx) * Math.min(0.5, Math.abs(dx));
      a.y += Math.sign(dy) * Math.min(0.5, Math.abs(dy));
      if (Math.abs(dx) + Math.abs(dy) > 0.5) a.walk++;
    }
    if (t === 130 || t === 140) {
      a.face = t === 130 ? -1 : 1;
      a.x = hx;
      a.y = below;
    }
    if (t === 150) {
      sfx('door');
      ship.hdTarget = 1;
    }
    if (t >= 176 && t < 206) {
      a.y -= 0.6;
      a.walk++;
      a.alpha = clamp(1 - (t - 186) / 18, 0, 1);
    }
    if (t === 214) {
      sfx('door');
      ship.hdTarget = 0;
    }
    if (t === 300) {
      sfx('spot');
      startDialog(SHIP_SEEN_LINES, () => {
        ship.phase = 'button';
        ship.cutAlien = null;
        toast.text = 'NEW QUEST: CLICK THE RED BUTTON!';
        toast.t = 200;
        sfx('itemGet');
      }, 'YOU');
    }
  }

  const shipBtnScreen = () => {
    const [bx, by] = tileCenter(SHIP_BUTTON);
    return { x: Math.round(bx - ship.cx) - 7, y: Math.round(by - ship.cy) - 16, w: 14, h: 12 };
  };
  const shipBtnNear = () => {
    const [bx, by] = tileCenter(SHIP_BUTTON);
    return Math.hypot(ship.px - bx, ship.py - by) < 30;
  };
  function shipButtonClick(p) {
    if (game.mode !== 'ufo' || ship.phase !== 'button' || dialog.active || fade.dir !== 0) return false;
    const r = shipBtnScreen();
    if (!inRect(p, { x: r.x - 4, y: r.y - 4, w: r.w + 8, h: r.h + 10 })) return false;
    if (!shipBtnNear()) {
      toast.text = 'GET CLOSER TO THE BUTTON!';
      toast.t = 90;
      sfx('back');
      return true;
    }
    ship.btnT = 1;
    ship.phase = 'enter';
    ship.hdTarget = 1;
    sfx('confirm');
    sfx('door');
    toast.text = 'THE HIDDEN DOOR OPENED!';
    toast.t = 160;
    return true;
  }

  function updateShip() {
    updateDialog();
    if (ship.hdOpen !== ship.hdTarget) ship.hdOpen = clamp(ship.hdOpen + Math.sign(ship.hdTarget - ship.hdOpen) / 24, 0, 1);
    if (ship.btnT > 0) ship.btnT++;
    if (ship.phase === 'cut') updateShipCutscene();
    const locked = dialog.active || fade.dir !== 0 || inv.open || ship.leaving || ship.phase === 'cut';
    const h = locked ? 0 : (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
    const v = locked ? 0 : (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);
    const sp = h && v ? 1.1 : 1.5;
    if (h && !shipBlocked(ship.px + h * sp, ship.py)) ship.px += h * sp;
    if (v && !shipBlocked(ship.px, ship.py + v * sp)) ship.py += v * sp;
    if (h) ship.face = h;
    if (h || v) {
      ship.up = v < 0 && !h;
      const prevWalk = ship.walk;
      ship.walk += 0.15;
      if (Math.floor(ship.walk / 1.6) !== Math.floor(prevWalk / 1.6)) sfx('step');
    } else {
      ship.walk = 0;
    }
    shipCam(false);

    for (const a of ship.aliens) {
      a.t++;
      if (a.sayT > 0) a.sayT--;
      if (a.sayT > 60) continue;
      const [cx, cy] = tileCenter([a.tx, a.ty]);
      const dx = cx - a.x, dy = cy - a.y;
      if (Math.abs(dx) < 0.6 && Math.abs(dy) < 0.6) {
        a.x = cx;
        a.y = cy;
        const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ox, oy]) => !shipWall(a.tx + ox, a.ty + oy));
        const fwd = opts.filter(([ox, oy]) => !(ox === -a.dir[0] && oy === -a.dir[1]));
        const pool = fwd.length ? fwd : opts;
        if (pool.length) {
          a.dir = pool[Math.floor(Math.random() * pool.length)];
          a.tx += a.dir[0];
          a.ty += a.dir[1];
        }
      } else {
        a.x += Math.sign(dx) * Math.min(0.55, Math.abs(dx));
        a.y += Math.sign(dy) * Math.min(0.55, Math.abs(dy));
      }
      const d = Math.hypot(ship.px - a.x, ship.py - a.y);
      if (d < 11 && a.sayT <= 0 && !locked) {
        a.sayT = 140;
        a.say = ALIEN_LINES[(a.id + Math.floor(a.t / 500)) % ALIEN_LINES.length].split('{NAME}').join(playerName);
        sfx('alien');
        const kx = (ship.px - a.x) / (d || 1), ky = (ship.py - a.y) / (d || 1);
        for (let i = 0; i < 12; i++) {
          if (!shipBlocked(ship.px + kx, ship.py)) ship.px += kx;
          if (!shipBlocked(ship.px, ship.py + ky)) ship.py += ky;
        }
      }
    }

    const [dx, dy] = tileCenter(SHIP_DOOR);
    if (ship.phase === 'find' && !ship.leaving && !locked && Math.hypot(ship.px - dx, ship.py - dy) < 14) {
      ship.leaving = true;
      ship.doorT = 0;
      sfx('door');
    }
    if (ship.phase === 'find' && ship.leaving && ++ship.doorT === 40) fadeThen(enterMech);
    const [hx, hy] = tileCenter(SHIP_HIDDEN);
    if (ship.phase === 'enter' && !ship.leaving && !locked && ship.hdOpen >= 1 && Math.hypot(ship.px - hx, ship.py - hy) < 9) {
      ship.leaving = true;
      fadeThen(enterBridge);
    }
  }

  function drawShipEntity(img, x, y, face) {
    const sx = Math.round(x - ship.cx), sy = Math.round(y - ship.cy);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(sx - 5, sy + 5, 10, 2);
    drawImg(img, sx - img.width / 2, sy + 6 - img.height, face);
  }

  function drawSpeech(text, sx, sy) {
    const w = text.length * 8 + 10;
    const x = clamp(Math.round(sx - w / 2), 4, W - 4 - w), y = Math.max(4, sy - 30);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x - 1, y - 1, w + 2, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, 14);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(clamp(sx, x + 4, x + w - 6) - 2, y + 14, 4, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(clamp(sx, x + 4, x + w - 6) - 1, y + 14, 2, 2);
    drawText(text, x + 5, y + 3, 8, '#1a1420', 'left', null);
  }

  function renderShip() {
    ctx.fillStyle = '#0c0a18';
    ctx.fillRect(0, 0, W, H);
    const cx = Math.round(ship.cx), cy = Math.round(ship.cy);
    const x0 = Math.floor(cx / MZ_T), y0 = Math.floor(cy / MZ_T);
    const lights = [];
    for (let ty = y0 - 1; ty <= y0 + Math.ceil(H / MZ_T) + 1; ty++) {
      for (let tx = x0 - 1; tx <= x0 + Math.ceil(W / MZ_T) + 1; tx++) {
        const sx = tx * MZ_T - cx, sy = ty * MZ_T - cy;
        const hsh = (((tx * 7 + ty * 13) % 11) + 11) % 11;
        if (!shipInside(tx, ty)) {
          const st = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
          if (st % 5 === 0) {
            ctx.fillStyle = st % 3 ? '#ffffff' : '#5ff0ff';
            ctx.fillRect(sx + (st % 13), sy + ((st >> 4) % 13), 1, 1);
          }
          if (st % 97 === 0) sparkle(sx + 8, sy + 8, 1, '#fff3c0');
          continue;
        }
        if (shipCore(tx, ty)) {
          ctx.fillStyle = '#1a1f30';
          ctx.fillRect(sx, sy, MZ_T, MZ_T);
          continue;
        }
        if (shipWall(tx, ty) && shipWall(tx, ty + 1) && shipDist(tx, ty) > SH_R - 2.2) {
          ctx.fillStyle = '#3a4058';
          ctx.fillRect(sx, sy, MZ_T, MZ_T);
          ctx.fillStyle = '#2a3046';
          ctx.fillRect(sx, sy + 7, MZ_T, 2);
          if (hsh % 3 === 0) {
            ctx.fillStyle = '#5a6684';
            ctx.fillRect(sx + 3, sy + 3, 1, 1);
            ctx.fillRect(sx + 12, sy + 12, 1, 1);
          }
          continue;
        }
        if (shipWall(tx, ty)) {
          const front = !shipWall(tx, ty + 1);
          ctx.fillStyle = '#4a5470';
          ctx.fillRect(sx, sy, MZ_T, MZ_T);
          ctx.fillStyle = '#6a7898';
          ctx.fillRect(sx, sy, MZ_T, 1);
          ctx.fillStyle = '#3a4260';
          if (!shipWall(tx - 1, ty)) ctx.fillRect(sx, sy, 1, MZ_T);
          if (!shipWall(tx + 1, ty)) ctx.fillRect(sx + MZ_T - 1, sy, 1, MZ_T);
          if ((tx + ty) % 3 === 0) {
            ctx.fillStyle = '#5a6684';
            ctx.fillRect(sx + 3, sy + 3, 2, 2);
            ctx.fillRect(sx + 11, sy + 3, 2, 2);
          }
          if (!shipWall(tx, ty - 1)) {
            ctx.fillStyle = '#1a1420';
            ctx.fillRect(sx, sy, MZ_T, 1);
          }
          if (front) {
            ctx.fillStyle = '#2a3046';
            ctx.fillRect(sx, sy + 8, MZ_T, 8);
            const on = (Math.floor(tick / 8) + tx) % 6 < 4;
            ctx.fillStyle = on ? '#5ff0ff' : '#1e5a70';
            ctx.fillRect(sx, sy + 8, MZ_T, 1);
            if (hsh === 0) {
              blob(sx + 8, sy + 12, 3, '#8a96aa');
              blob(sx + 8, sy + 12, 2, '#05040e');
              if (tick % 40 < 30) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(sx + 7 + (tx % 2), sy + 11, 1, 1);
              }
            } else if (hsh === 3) {
              for (let i = 0; i < 3; i++) {
                ctx.fillStyle = (tick + i * 9 + tx * 5) % 30 < 15 ? ['#ff4a4a', '#ffe14d', '#5fff8a'][i] : '#2a2a3a';
                ctx.fillRect(sx + 3 + i * 4, sy + 11, 2, 2);
              }
            } else if (hsh === 6) {
              ctx.fillStyle = '#6e7a90';
              ctx.fillRect(sx, sy + 12, MZ_T, 2);
              ctx.fillStyle = '#8a96aa';
              ctx.fillRect(sx, sy + 12, MZ_T, 1);
            } else if (hsh === 9) {
              for (let i = 0; i < 4; i++) {
                ctx.fillStyle = i % 2 ? '#1a1420' : '#ffe14d';
                ctx.fillRect(sx + i * 4, sy + 10, 4, 5);
              }
            }
            if (hsh === 1) lights.push([sx + 8, sy + 9]);
          }
        } else {
          ctx.fillStyle = (tx + ty) % 2 ? '#1c2234' : '#1a1f30';
          ctx.fillRect(sx, sy, MZ_T, MZ_T);
          ctx.fillStyle = '#262d44';
          ctx.fillRect(sx, sy, MZ_T, 1);
          ctx.fillRect(sx, sy, 1, MZ_T);
          ctx.fillStyle = '#2e3650';
          ctx.fillRect(sx + 2, sy + 2, 1, 1);
          ctx.fillRect(sx + 13, sy + 13, 1, 1);
          if ((tx * 5 + ty * 3) % 13 === 0) {
            ctx.save();
            ctx.globalAlpha = 0.35 + 0.2 * Math.sin(tick * 0.08 + tx);
            ctx.fillStyle = '#5ff0ff';
            ctx.fillRect(sx + 6, sy + 6, 4, 4);
            ctx.restore();
          }
          if (shipWall(tx, ty - 1)) {
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(sx, sy, MZ_T, 4);
          }
        }
      }
    }
    for (const [lx, ly] of lights) {
      ctx.save();
      ctx.globalAlpha = 0.14;
      blob(lx, ly + 6, 12, '#5ff0ff');
      ctx.restore();
    }

    const ccx = (SH_W * MZ_T) / 2 - cx, ccy = (SH_H * MZ_T) / 2 - cy, hullR = (SH_R - 0.5) * MZ_T;
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1a1420';
    ctx.beginPath();
    ctx.arc(ccx, ccy, hullR + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#8a96aa';
    ctx.beginPath();
    ctx.arc(ccx, ccy, hullR + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const lx = Math.round(ccx + Math.cos(a) * (hullR + 7)), ly = Math.round(ccy + Math.sin(a) * (hullR + 7));
      if (lx < -4 || ly < -4 || lx > W + 4 || ly > H + 4) continue;
      const on = (Math.floor(tick / 6) + i) % 8 < 2;
      ctx.fillStyle = on ? '#ffe14d' : '#5a4a1a';
      ctx.fillRect(lx - 1, ly - 1, 3, 3);
    }

    if (Math.abs(ccx - W / 2) < W && Math.abs(ccy - H / 2) < H) {
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(tick * 0.05);
      blob(Math.round(ccx), Math.round(ccy), 44, '#5ff0ff');
      ctx.restore();
      blob(Math.round(ccx), Math.round(ccy + 4), 26, '#1a1420');
      blob(Math.round(ccx), Math.round(ccy + 4), 24, '#4a5468');
      blob(Math.round(ccx), Math.round(ccy), 24, '#1a1420');
      blob(Math.round(ccx), Math.round(ccy), 22, '#6e7a90');
      blob(Math.round(ccx), Math.round(ccy), 16, '#1a1420');
      blob(Math.round(ccx), Math.round(ccy), 14, '#123a5a');
      const pr = 9 + Math.round(Math.sin(tick * 0.12) * 2);
      blob(Math.round(ccx), Math.round(ccy), pr, '#5ff0ff');
      blob(Math.round(ccx), Math.round(ccy), Math.round(pr / 2), '#ffffff');
      for (let i = 0; i < 6; i++) {
        const a = tick * 0.03 + (i / 6) * Math.PI * 2;
        ctx.fillStyle = i % 2 ? '#ffe14d' : '#ff4ae8';
        ctx.fillRect(Math.round(ccx + Math.cos(a) * 19) - 1, Math.round(ccy + Math.sin(a) * 19) - 1, 3, 3);
      }
      drawText('CORE', Math.round(ccx), Math.round(ccy + 32), 8, '#5ff0ff', 'center', '#1a1420');
    }

    const [px0, py0] = tileCenter(SHIP_SPAWN);
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(tick * 0.1);
    ctx.strokeStyle = '#5ff0ff';
    ctx.beginPath();
    ctx.ellipse(px0 - cx, py0 - cy + 4, 9, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const [hdx, hdy] = tileCenter(SHIP_HIDDEN);
    if (ship.hdOpen > 0) {
      const hsx = Math.round(hdx - cx) - 8, hsy = Math.round(hdy - cy) - 8;
      const oh = Math.round(15 * ship.hdOpen);
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(hsx + 1, hsy + 1, 14, 15);
      ctx.fillStyle = '#05040e';
      ctx.fillRect(hsx + 2, hsy + 16 - oh, 12, oh);
      ctx.save();
      ctx.globalAlpha = 0.5 * ship.hdOpen;
      ctx.fillStyle = '#ff4a4a';
      ctx.fillRect(hsx + 2, hsy + 15, 12, 1);
      ctx.fillRect(hsx + 4, hsy + 16 - oh, 8, 1);
      ctx.restore();
      ctx.fillStyle = '#4a5470';
      ctx.fillRect(hsx + 2, hsy + 1, 12, 15 - oh);
    }

    const [bx, by] = tileCenter(SHIP_BUTTON);
    const bsx = Math.round(bx - cx), bsy = Math.round(by - cy);
    if (bsx > -20 && bsx < W + 20 && bsy > -30 && bsy < H + 20) {
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(bsx - 6, bsy - 8, 12, 14);
      ctx.fillStyle = '#6e7a90';
      ctx.fillRect(bsx - 5, bsy - 7, 10, 12);
      ctx.fillStyle = '#ffe14d';
      ctx.fillRect(bsx - 5, bsy - 7, 10, 1);
      const pressed = ship.phase === 'enter' || ship.phase === 'done';
      const glow = ship.phase === 'button' ? 0.35 + 0.25 * Math.sin(tick * 0.15) : 0;
      if (glow) {
        ctx.save();
        ctx.globalAlpha = glow;
        blob(bsx, bsy - 11, 10, '#ff4a4a');
        ctx.restore();
      }
      blob(bsx, bsy - 9, 6, '#1a1420');
      blob(bsx, bsy - (pressed ? 9 : 11), 5, pressed ? '#7a1520' : '#c2202e');
      blob(bsx - 1, bsy - (pressed ? 10 : 13), 2, pressed ? '#c2202e' : '#ff8a8a');
      if (ship.phase === 'button') {
        const bob = Math.round(Math.sin(tick * 0.12) * 2);
        drawText(shipBtnNear() ? 'CLICK!' : 'RED BUTTON', bsx, bsy - 30 + bob, 8, '#ff4a4a', 'center', '#1a1420');
      }
    }

    const [dxw, dyw] = tileCenter(SHIP_DOOR);
    const dsx = Math.round(dxw - cx), dsy = Math.round(dyw - cy);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(dsx - 10, dsy - 14, 20, 22);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#1a1420' : '#ffe14d';
      ctx.fillRect(dsx - 10 + i * 4, dsy - 14, 4, 2);
    }
    const open = ship.leaving ? clamp(ship.doorT / 24, 0, 1) : 0;
    ctx.fillStyle = '#ff9a2e';
    ctx.fillRect(dsx - 8, dsy - 12, 16, 19);
    ctx.fillStyle = '#05040e';
    ctx.fillRect(dsx - 8, dsy - 12, 16, 19);
    const half = Math.round(8 * (1 - open));
    ctx.fillStyle = '#8a96aa';
    ctx.fillRect(dsx - 8, dsy - 12, half, 19);
    ctx.fillRect(dsx + 8 - half, dsy - 12, half, 19);
    ctx.fillStyle = '#e8742a';
    if (half > 1) {
      ctx.fillRect(dsx - 8, dsy - 4, half, 2);
      ctx.fillRect(dsx + 8 - half, dsy - 4, half, 2);
    }
    if (tick % 30 < 20) blob(dsx, dsy - 18, 2, '#ff4a4a');
    const bob = Math.round(Math.sin(tick * 0.1) * 2);
    if (ship.phase === 'find') drawText('MECH STORAGE', dsx, dsy - 34 + bob, 8, '#ffe14d', 'center', '#1a1420');

    const ents = [];
    for (const a of ship.aliens) {
      const frames = ALIEN_SKINS[a.skin];
      const img = frames[a.sayT > 60 ? 0 : Math.floor(a.t / 10) % 2];
      ents.push([a.y, () => drawShipEntity(img, a.x, a.y, ship.px < a.x ? -1 : 1)]);
    }
    const ca = ship.cutAlien;
    if (ca && ca.alpha > 0) {
      ents.push([ca.y, () => {
        ctx.save();
        ctx.globalAlpha = ca.alpha;
        drawShipEntity(ALIEN_SKINS[ca.skin][Math.floor(ca.walk / 10) % 2], ca.x, ca.y, ca.face);
        ctx.restore();
        if (ship.cutT >= 128 && ship.cutT < 150) drawText('?', Math.round(ca.x - cx), Math.round(ca.y - cy - 26), 8, '#ffe14d', 'center', '#1a1420');
      }]);
    }
    ents.push([ship.py, () => {
      const img = ship.up ? playerBack : playerFrames[ship.walk > 0 ? walkFrame(ship.walk) : 0];
      drawShipEntity(img, ship.px, ship.py, ship.face);
      if (ship.phase === 'cut' && ship.cutT >= 290) {
        drawText('!', Math.round(ship.px - cx), Math.round(ship.py - cy - 30 - Math.max(0, 300 - ship.cutT)), 16, '#ff3e6c', 'center', '#1a1420');
      }
    }]);
    ents.sort((p, q) => p[0] - q[0]).forEach(([, fn]) => fn());

    const px = ship.px - cx, py = ship.py - cy;
    const grad = ctx.createRadialGradient(px, py - 6, 70, px, py - 6, 230);
    grad.addColorStop(0, 'rgba(8,4,24,0)');
    grad.addColorStop(1, 'rgba(8,4,24,0.65)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    for (const a of ship.aliens) {
      if (a.sayT > 0) drawSpeech(a.say, Math.round(a.x - cx), Math.round(a.y - cy - 14));
    }

    if (ship.phase === 'cut') {
      const bar = Math.round(22 * clamp(Math.min(ship.cutT / 20, (320 - ship.cutT) / 20), 0, 1));
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, bar);
      ctx.fillRect(0, H - bar, W, bar);
    } else {
      const quest = SHIP_QUEST[ship.phase] || '';
      const [qx, qy] = ship.phase === 'button' ? [bx, by] : ship.phase === 'enter' ? [hdx, hdy] : [dxw, dyw];
      const qc = ship.phase === 'find' ? '#5ff0ff' : '#ff8a5a';
      drawText(quest, 6, 6, 8, qc, 'left');
      const ang = Math.atan2(qy - ship.py, qx - ship.px);
      const ax = 6 + quest.length * 8 + 12, ay = 9;
      ctx.fillStyle = '#ffe14d';
      for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(ax + Math.cos(ang) * i), Math.round(ay + Math.sin(ang) * i), 2, 2);
      for (const s of [-1, 1]) {
        const a2 = ang + Math.PI + s * 0.6;
        for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(ax + Math.cos(ang) * 6 + Math.cos(a2) * i), Math.round(ay + Math.sin(ang) * 6 + Math.sin(a2) * i), 2, 2);
      }
    }

    drawDialog();
    drawTitle();
    drawToast();
    if (canOpenInventory() || inv.open) drawBagButton();
    if (inv.open) drawInventory();
  }

  // ---------- Chapter 4: the mech storage ----------
  const MF = 184;
  const MS_TOP = MF - 66;
  const MR_W = 640;
  const MS_WORK_X = 556;
  const MS_LAND_X = 492;
  const MS_GATE_X = 36;
  const mechNpc = { state: 'work', x: MS_WORK_X, y: MS_TOP, face: 1, t: 0, rot: 0 };
  const mechIntro = { on: false, t: 0 };
  const mechRoom = { leaving: false, cam: 0, gate: 0 };
  const MECH_LINES = [
    '...',
    'WHY ARE YOU HERE?',
    'NOBODY IS ALLOWED IN MY MECH STORAGE!',
    'YOU CAME UP WITH THE BEAM, {NAME}?',
    'THEN LET ME INTRODUCE MYSELF.',
    'I AM THE GOD OF CREATING...',
  ];
  const MECH_AGAIN_LINES = ['BACK FOR MORE, {NAME}?', 'MY MACHINES NEVER GET TIRED!'];
  const MECH_WIN_LINES = [
    'MY... MY BEAUTIFUL MACHINES...',
    'NOBODY HAS EVER BROKEN MY CREATIONS.',
    'TAKE THE MECH CRYSTAL, {NAME}.',
    'NOW GET OUT OF MY STORAGE!',
  ];
  const mechCutscene = () => ['turn', 'jump', 'roll', 'stand', 'pose'].includes(mechNpc.state);

  function resetMechRoom(state = 'work') {
    mechIntro.on = false;
    mechIntro.t = 0;
    if (state === 'work') Object.assign(mechNpc, { state, x: MS_WORK_X, y: MS_TOP, face: 1, t: 0, rot: 0 });
    else Object.assign(mechNpc, { state, x: MS_LAND_X - 30, y: MF, face: -1, t: 0, rot: 0 });
  }

  function mechCamTarget() {
    const m = mechNpc;
    const follow = m.state === 'work' || m.state === 'beaten' || m.state === 'ready';
    const fx = follow ? player.x + 30 : (player.x + m.x) / 2;
    return clamp(fx - W / 2, 0, MR_W - W);
  }

  function enterMech() {
    game.mode = 'mech';
    mechRoom.leaving = false;
    mechRoom.gate = 0;
    cam = 0;
    camY = 0;
    if (mechCutscene() || mechNpc.state === 'talk' || mechNpc.state === 'fight') resetMechRoom(mechNpc.state === 'fight' ? 'ready' : 'work');
    Object.assign(player, { x: MS_GATE_X + 6, y: MF - player.h, vx: 0, vy: 0, face: 1, onGround: true, walk: 0 });
    mechRoom.cam = mechCamTarget();
    showTitle('MECH STORAGE', '- CHAPTER 4 -');
  }

  function fightMechanic() {
    mechNpc.state = 'fight';
    startBattleTransition('mechanic', winMechanic, () => {
      resetMechRoom('ready');
      enterMech();
    }, 'mech');
  }

  function winMechanic() {
    resetMechRoom('beaten');
    startDialog(MECH_WIN_LINES, () => {
      toast.text = 'HEAD BACK OUT THE MECH GATE!';
      toast.t = 180;
    }, 'MECHANIC');
  }

  function updateMechNpc() {
    const m = mechNpc;
    m.t++;
    const canTrigger = !dialog.active && fade.dir === 0 && !inv.open;
    if (m.state === 'work') {
      if (m.t % 14 === 0) sfx('weld');
      if (canTrigger && player.x > MS_LAND_X - 96) {
        m.state = 'turn';
        m.t = 0;
        player.vx = 0;
      }
    } else if (m.state === 'turn') {
      if (m.t === 14) {
        m.face = -1;
        sfx('spot');
      }
      if (m.t >= 56) {
        m.state = 'jump';
        m.t = 0;
        sfx('jump');
      }
    } else if (m.state === 'jump') {
      const p = Math.min(1, m.t / 36);
      m.x = MS_WORK_X + (MS_LAND_X - MS_WORK_X) * p;
      m.y = MS_TOP + (MF - MS_TOP) * p - Math.sin(p * Math.PI) * 40;
      if (p >= 1) {
        m.state = 'roll';
        m.t = 0;
        sfx('land');
      }
    } else if (m.state === 'roll') {
      const p = Math.min(1, m.t / 30);
      m.x = MS_LAND_X - 30 * p;
      m.y = MF;
      m.rot = -p * Math.PI * 2;
      if (m.t % 8 === 0) sfx('step');
      if (p >= 1) {
        m.state = 'stand';
        m.t = 0;
        m.rot = 0;
        sfx('land');
      }
    } else if (m.state === 'stand' && m.t === 24) {
      m.state = 'talk';
      startDialog(MECH_LINES, () => {
        m.state = 'pose';
        m.t = 0;
        mechIntro.on = true;
        mechIntro.t = 0;
      }, 'MECHANIC');
    } else if (m.state === 'pose') {
      const t = ++mechIntro.t;
      if (t === 1) sfx('mechIntro');
      if (t === 24) sfx('swoosh');
      if (t === 44) sfx('crash');
      if (t === 230) {
        mechIntro.on = false;
        fightMechanic();
      }
    } else if (m.state === 'ready' && canTrigger && player.x > MS_LAND_X - 116) {
      m.state = 'talk';
      player.vx = 0;
      startDialog(MECH_AGAIN_LINES, fightMechanic, 'MECHANIC');
    }
  }

  function updateMech() {
    updateDialog();
    const locked = dialog.active || fade.dir !== 0 || inv.open || mechRoom.leaving || mechCutscene();
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
    const maxX = mechNpc.state === 'work' || mechNpc.state === 'turn' ? MS_LAND_X + 14 : mechNpc.x - 34;
    const canExit = mechNpc.state === 'beaten' && !dialog.active;
    player.x = clamp(player.x + player.vx, MS_GATE_X, maxX);
    if (canExit && !mechRoom.leaving && player.x <= MS_GATE_X + 1 && (keys['a'] || keys['arrowleft'])) {
      mechRoom.leaving = true;
      sfx('door');
    }
    if (mechRoom.leaving) {
      mechRoom.gate = Math.min(1, mechRoom.gate + 1 / 24);
      if (mechRoom.gate >= 1 && fade.dir === 0 && game.mode === 'mech') fadeThen(shipAfterMech);
    }
    mechRoom.cam += (mechCamTarget() - mechRoom.cam) * 0.1;
    const wasGround = player.onGround;
    player.y += player.vy;
    player.onGround = false;
    if (player.y + player.h >= MF) {
      player.y = MF - player.h;
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
    updateMechNpc();
  }

  function drawMechBay(x, label, build, face, tint) {
    const fy = MF;
    ctx.fillStyle = '#161a2a';
    ctx.fillRect(x - 40, 50, 80, fy - 50);
    ctx.save();
    ctx.globalAlpha = 0.18 + 0.06 * Math.sin(tick * 0.05 + x);
    ctx.fillStyle = tint;
    ctx.fillRect(x - 36, 56, 72, fy - 60);
    ctx.restore();
    drawMechSuit(x, fy - 6, 0.82, build, face, null);
    ctx.fillStyle = 'rgba(14,16,30,0.28)';
    ctx.fillRect(x - 40, 50, 80, fy - 56);
    for (const px of [x - 42, x + 36]) {
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(px, 48, 6, fy - 48);
      ctx.fillStyle = '#5a6684';
      ctx.fillRect(px + 1, 48, 4, fy - 48);
      ctx.fillStyle = '#8a96aa';
      ctx.fillRect(px + 1, 48, 1, fy - 48);
      for (let y = 60; y < fy - 8; y += 18) {
        ctx.fillStyle = (Math.floor(tick / 10) + y / 18) % 4 ? '#2a3046' : tint;
        ctx.fillRect(px + 2, y, 2, 3);
      }
    }
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x - 44, 42, 88, 8);
    ctx.fillStyle = '#4a5468';
    ctx.fillRect(x - 43, 43, 86, 6);
    for (let i = 0; i < 86; i += 6) {
      ctx.fillStyle = (i / 6) % 2 ? '#1a1420' : '#ffe14d';
      ctx.fillRect(x - 43 + i, 47, 3, 2);
    }
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x - 15, 30, 30, 11);
    ctx.fillStyle = '#123a5a';
    ctx.fillRect(x - 14, 31, 28, 9);
    drawText(label, x, 32, 8, tint, 'center', null);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = tint;
    ctx.fillRect(x - 30, fy - 6, 60, 2);
    ctx.restore();
  }

  function drawWeldArm(bx, tx, ty, phase) {
    const fy = MF;
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(bx - 8, fy - 8, 16, 8);
    ctx.fillStyle = '#e8742a';
    ctx.fillRect(bx - 7, fy - 7, 14, 6);
    const ex = bx + (tx - bx) * 0.45 + Math.sin(phase) * 3, ey = fy - 34 + Math.cos(phase * 0.7) * 2;
    const hx = tx + Math.sin(phase * 1.3) * 2, hy = ty + Math.cos(phase) * 2;
    ctx.save();
    ctx.lineCap = 'round';
    for (const [lw, col] of [[6, '#1a1420'], [4, '#e8742a']]) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo(bx, fy - 6);
      ctx.lineTo(ex, ey);
      ctx.lineTo(hx, hy);
      ctx.stroke();
    }
    ctx.restore();
    blob(Math.round(ex), Math.round(ey), 3, '#1a1420');
    blob(Math.round(ex), Math.round(ey), 2, '#8a96aa');
    if (tick % 12 < 8) {
      blob(Math.round(hx), Math.round(hy), 2, '#ffffff');
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? '#ffe14d' : '#5ff0ff';
        ctx.fillRect(Math.round(hx + Math.random() * 12 - 6), Math.round(hy + Math.random() * 10 - 2), 1, 1);
      }
    }
  }

  function drawCrate(x, top, w, h, label) {
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x - 1, top - 1, w + 2, h + 2);
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(x, top, w, h);
    ctx.fillStyle = '#8b6238';
    ctx.fillRect(x, top, w, 2);
    ctx.fillRect(x + 2, top + Math.floor(h / 2), w - 4, 1);
    ctx.fillStyle = '#4a321c';
    ctx.fillRect(x, top, 2, h);
    ctx.fillRect(x + w - 2, top, 2, h);
    if (label) drawText(label, x + w / 2, top + h / 2 - 3, 8, '#ffe14d', 'center', '#1a1420');
  }

  function drawBarrel(x, fy, c) {
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x - 1, fy - 19, 14, 19);
    ctx.fillStyle = c;
    ctx.fillRect(x, fy - 18, 12, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x + 2, fy - 18, 2, 18);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x, fy - 13, 12, 1);
    ctx.fillRect(x, fy - 6, 12, 1);
  }

  function drawMechGate() {
    const fy = MF, x0 = 0, gw = MS_GATE_X - 6;
    const open = mechRoom.gate;
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x0, 70, gw + 6, fy - 70);
    ctx.fillStyle = '#05040e';
    ctx.fillRect(x0, 76, gw, fy - 76);
    ctx.save();
    ctx.globalAlpha = open;
    ctx.fillStyle = '#5ff0ff';
    ctx.fillRect(x0, fy - 3, gw, 2);
    ctx.restore();
    const half = Math.round(((fy - 76) / 2) * (1 - open));
    for (const [y, h] of [[76, half], [fy - half, half]]) {
      if (h <= 0) continue;
      ctx.fillStyle = '#5a6684';
      ctx.fillRect(x0, y, gw, h);
      ctx.fillStyle = '#6e7a90';
      for (let yy = y + 4; yy < y + h - 2; yy += 8) ctx.fillRect(x0 + 2, yy, gw - 4, 2);
    }
    if (half > 2) {
      for (let i = 0; i < gw; i += 6) {
        ctx.fillStyle = (i / 6) % 2 ? '#1a1420' : '#ffe14d';
        ctx.fillRect(x0 + i, 76 + half - 4, 6, 4);
        ctx.fillRect(x0 + i, fy - half, 6, 4);
      }
    }
    ctx.fillStyle = '#8a96aa';
    ctx.fillRect(gw, 70, 6, fy - 70);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(gw + 2, 72, 2, fy - 72);
    const ok = mechNpc.state === 'beaten';
    blob(gw + 3, 64, 4, '#1a1420');
    blob(gw + 3, 64, 3, ok ? (tick % 30 < 20 ? '#5fff8a' : '#2e8a3a') : (tick % 30 < 20 ? '#ff4a4a' : '#7a1520'));
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(0, 50, 44, 11);
    ctx.fillStyle = '#3a4256';
    ctx.fillRect(1, 51, 42, 9);
    drawText('GATE', 21, 52, 8, '#ffe14d', 'center', null);
    drawText('MECH', 21, 40, 8, '#ffe14d', 'center', '#1a1420');
  }

  function drawMechRoomBg() {
    const fy = MF;
    ctx.fillStyle = '#1e2236';
    ctx.fillRect(0, 0, MR_W, fy);
    ctx.fillStyle = '#262b42';
    for (let x = 0; x < MR_W; x += 32) ctx.fillRect(x, 0, 1, fy);
    for (let y = 24; y < fy; y += 40) ctx.fillRect(0, y, MR_W, 1);

    ctx.fillStyle = '#1a1420';
    ctx.fillRect(164, 22, 110, 62);
    ctx.fillStyle = '#05040e';
    ctx.fillRect(168, 26, 102, 54);
    for (let i = 0; i < 26; i++) {
      const sx = 168 + ((i * 37 + Math.floor(tick / 3)) % 102), sy = 26 + ((i * 23) % 54);
      ctx.fillStyle = i % 4 ? '#ffffff' : '#5ff0ff';
      ctx.fillRect(sx, sy, 1, 1);
    }
    blob(240, 62, 14, '#b07cff');
    blob(236, 58, 6, '#d8a8ff');
    ctx.fillStyle = '#e8c547';
    ctx.fillRect(218, 62, 46, 1);
    ctx.fillStyle = '#8a96aa';
    ctx.fillRect(217, 22, 4, 62);
    ctx.fillRect(164, 52, 110, 3);

    ctx.fillStyle = '#3a4256';
    ctx.fillRect(0, 10, MR_W, 7);
    ctx.fillStyle = '#5a6684';
    ctx.fillRect(0, 10, MR_W, 1);
    for (let x = 4; x < MR_W; x += 20) {
      ctx.fillStyle = '#2a3046';
      ctx.fillRect(x, 13, 2, 2);
    }

    drawMechBay(92, 'MK-1', 1, 1, '#5ff0ff');
    drawMechBay(330, 'MK-2', 0.7, 1, '#ff9a2e');
    drawMechBay(420, 'MK-3', 1, -1, '#5fff8a');
    drawWeldArm(372, 344, 120, tick * 0.08);

    for (let i = 0; i < 4; i++) {
      const sx = 286 + i * 8;
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(sx - 1, 110, 7, 2);
    }

    ctx.fillStyle = '#1a1420';
    ctx.fillRect(160, 96, 120, 4);
    ctx.fillRect(160, 120, 120, 4);
    ctx.fillStyle = '#6e7a90';
    ctx.fillRect(161, 97, 118, 2);
    ctx.fillRect(161, 121, 118, 2);
    for (let i = 0; i < 6; i++) drawMechFist(172 + i * 19, 90, 1, 0.8, 0, 0);
    for (let i = 0; i < 5; i++) {
      const hx = 176 + i * 22;
      blob(hx, 114, 6, '#1a1420');
      blob(hx, 114, 5, '#4a5468');
      ctx.fillStyle = '#123a5a';
      ctx.fillRect(hx - 4, 111, 8, 5);
      ctx.fillStyle = 'rgba(95,240,255,0.5)';
      ctx.fillRect(hx - 3, 112, 2, 2);
    }
    drawText('SPARE PARTS', 220, 128, 8, '#ffe14d', 'center', '#1a1420');
    ctx.fillStyle = '#2a3046';
    ctx.fillRect(160, 140, 120, 28);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(160, 140, 120, 2);
    for (const [wx, ang] of [[172, 0.3], [190, -0.2], [208, 0.1], [258, -0.4]]) {
      ctx.save();
      ctx.translate(wx, 152);
      ctx.rotate(ang);
      ctx.fillStyle = '#8a96aa';
      ctx.fillRect(-1, -8, 2, 14);
      ctx.fillRect(-3, -10, 6, 3);
      ctx.restore();
    }
    blob(234, 152, 6, '#1a1420');
    blob(234, 152, 5, '#6e7a90');
    blob(234, 152, 2, '#1a1420');

    const crane = (x0, x1, sp, ph) => {
      const hx = x0 + (x1 - x0) * (0.5 + 0.5 * Math.sin(tick * sp + ph));
      ctx.fillStyle = '#4a5468';
      ctx.fillRect(hx - 7, 15, 14, 6);
      ctx.fillStyle = '#8a96aa';
      ctx.fillRect(hx - 1, 21, 2, 26);
      ctx.fillRect(hx - 5, 47, 10, 3);
      ctx.fillRect(hx - 5, 47, 2, 7);
      ctx.fillRect(hx + 3, 47, 2, 7);
      return hx;
    };
    drawMechFist(crane(130, 160, 0.015, 0), 62, -1, 1.4, 0, Math.PI / 2);
    const h2 = crane(470, 520, 0.012, 2);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(h2 - 9, 54, 18, 14);
    ctx.fillStyle = '#4a5468';
    ctx.fillRect(h2 - 8, 55, 16, 12);
    ctx.fillStyle = '#123a5a';
    ctx.fillRect(h2 - 6, 57, 12, 7);
    ctx.fillStyle = '#e8742a';
    ctx.fillRect(h2 - 8, 55, 16, 2);

    for (const lx of [60, 150, 250, 350, 450, 560]) {
      ctx.fillStyle = '#4a5468';
      ctx.fillRect(lx - 6, 17, 12, 4);
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = '#fff3c0';
      ctx.beginPath();
      ctx.moveTo(lx - 5, 21);
      ctx.lineTo(lx + 5, 21);
      ctx.lineTo(lx + 34, fy);
      ctx.lineTo(lx - 34, fy);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff3c0';
      ctx.fillRect(lx - 4, 21, 8, 1);
    }

    drawCrate(464, fy - 24, 28, 24, 'PARTS');
    drawCrate(468, fy - 44, 20, 20, 'BOLTS');
    drawCrate(140, fy - 18, 18, 18, null);
    drawBarrel(496, fy, '#c2202e');
    drawBarrel(510, fy, '#2f6fdc');
    drawBarrel(124, fy, '#e8c547');

    drawMechSuit(610, fy, 1.15, 0.6, -1, null);
    ctx.fillStyle = '#1a1420';
    for (const px of [538, 574]) ctx.fillRect(px - 2, MS_TOP, 4, fy - MS_TOP);
    ctx.fillStyle = '#6e7a90';
    for (const px of [538, 574]) ctx.fillRect(px - 1, MS_TOP, 2, fy - MS_TOP);
    for (let y = MS_TOP + 10; y < fy; y += 12) {
      ctx.fillStyle = '#4a5468';
      ctx.fillRect(538, y, 36, 1);
    }
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(528, MS_TOP, 56, 5);
    ctx.fillStyle = '#8a96aa';
    ctx.fillRect(529, MS_TOP + 1, 54, 3);
    ctx.fillStyle = '#ffe14d';
    for (let x = 530; x < 582; x += 6) ctx.fillRect(x, MS_TOP + 1, 3, 1);

    const beltY = fy - 10;
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(160, beltY - 1, 124, 8);
    ctx.fillStyle = '#3a4058';
    ctx.fillRect(161, beltY, 122, 6);
    for (let x = 0; x < 122; x += 6) {
      ctx.fillStyle = '#5a6684';
      ctx.fillRect(161 + ((x + Math.floor(tick / 2)) % 122), beltY + 1, 2, 4);
    }
    for (let i = 0; i < 4; i++) {
      const px = 162 + ((i * 31 + tick * 0.5) % 116);
      if (i % 2) drawMechFist(px + 4, beltY - 4, 1, 0.6, 0, 0);
      else {
        blob(Math.round(px + 4), beltY - 4, 4, '#1a1420');
        blob(Math.round(px + 4), beltY - 4, 3, '#8a96aa');
        blob(Math.round(px + 4), beltY - 4, 1, '#1a1420');
      }
    }

    for (let x = 0; x < MR_W; x += 8) {
      ctx.fillStyle = (x / 8) % 2 ? '#1a1420' : '#ffe14d';
      ctx.fillRect(x, fy - 3, 8, 3);
    }
    drawMechGate();
    ctx.fillStyle = '#3a4256';
    ctx.fillRect(0, fy, MR_W, H - fy);
    for (let x = 0; x < MR_W; x += 24) {
      ctx.fillStyle = '#465070';
      ctx.fillRect(x, fy, 1, H - fy);
      ctx.fillStyle = '#2e3650';
      ctx.fillRect(x + 4, fy + 6, 2, 2);
    }
    ctx.fillStyle = '#5a6684';
    ctx.fillRect(0, fy, MR_W, 1);
  }

  function drawMechanicNpc() {
    const m = mechNpc;
    const img = mechanicFrames[m.t % 150 < 6 ? 1 : 0];
    const x = Math.round(m.x), feet = Math.round(m.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    if (m.state !== 'work' && m.state !== 'turn' && m.state !== 'jump') ctx.fillRect(x - 8, MF - 1, 16, 2);
    if (m.state === 'roll') {
      ctx.save();
      ctx.translate(x, feet - 10);
      ctx.rotate(m.rot);
      ctx.drawImage(img, -7, -10);
      ctx.restore();
      return;
    }
    drawImg(img, x - 7, feet - img.height, m.face);
    if (m.state === 'work') {
      const wx = x + 9, wy = feet - 11;
      if (tick % 14 < 9) {
        blob(wx, wy, 2, '#ffffff');
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = i % 2 ? '#ffe14d' : '#5ff0ff';
          ctx.fillRect(wx + Math.round(Math.random() * 10 - 2), wy + Math.round(Math.random() * 10 - 6), 1, 1);
        }
      }
    }
    if (m.state === 'turn') {
      if (m.t < 14) drawText('?', x, feet - 30, 8, '#ffe14d', 'center', '#1a1420');
      else drawText('!', x, feet - 30 - Math.max(0, 22 - m.t), 16, '#ff3e6c', 'center', '#1a1420');
    }
    if (['stand', 'talk', 'ready', 'fight', 'beaten', 'pose'].includes(m.state)) {
      for (let i = 0; i < 2; i++) {
        const bob = Math.sin(tick * 0.07 + i * 2) * 2;
        drawMechFist(x + (i ? 18 : -18), feet - 22 + bob, i ? 1 : -1, 1, 0.3);
      }
      if (m.state !== 'beaten') drawRayGun(x - 6, feet - 12, -Math.PI / 2, 0.8);
      if (m.state === 'ready' && tick % 60 < 40) drawText('!', x, feet - 32, 8, '#ffe14d', 'center');
    }
  }

  function renderMechIntro(t) {
    const k = clamp(t / 12, 0, 1);
    ctx.save();
    ctx.globalAlpha = k;
    for (let y = 0; y < H; y += 4) {
      for (let x = 0; x < W; x += 8) {
        const v = Math.sin(x * 0.025 + t * 0.04) + Math.sin(y * 0.035 - t * 0.03 + Math.sin(x * 0.01 + t * 0.02) * 2);
        const hue = Math.round((v * 70 + t * 1.5 + y * 0.4) % 360 + 360) % 360;
        ctx.fillStyle = `hsl(${hue},55%,${38 + Math.round(v * 6)}%)`;
        ctx.fillRect(x, y, 8, 4);
      }
    }
    ctx.fillStyle = 'rgba(10,6,24,0.35)';
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2;
    ctx.save();
    ctx.globalAlpha = k * 0.25;
    ctx.fillStyle = '#fff3c0';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t * 0.01;
      ctx.beginPath();
      ctx.moveTo(cx, 130);
      ctx.lineTo(cx + Math.cos(a) * 300, 130 + Math.sin(a) * 300);
      ctx.lineTo(cx + Math.cos(a + 0.12) * 300, 130 + Math.sin(a + 0.12) * 300);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#140c20';
    for (const [x, w, h] of [[0, 40, 50], [30, 18, 80], [60, 30, 40], [100, 12, 66], [262, 14, 70], [290, 34, 44], [330, 16, 84], [350, 40, 52]]) {
      ctx.fillRect(x, H - h, w, h);
      ctx.fillRect(x + w / 2 - 1, H - h - 14, 2, 14);
      if (tick % 40 < 20) {
        ctx.fillStyle = '#ff4a4a';
        ctx.fillRect(x + w / 2 - 1, H - h - 16, 2, 2);
        ctx.fillStyle = '#140c20';
      }
    }
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const bob = Math.sin(t * 0.06 + i * 2) * 5;
      const slide = Math.pow(clamp(1 - (t - 10) / 24, 0, 1), 2) * 140;
      drawMechFist(cx + side * (108 + slide), 128 + bob, -side, 4, 0.8, side * 0.25);
    }
    const sc = 5;
    const img = mechanicFrames[t % 120 < 6 ? 1 : 0];
    const rise = Math.pow(clamp(1 - t / 20, 0, 1), 2) * 60;
    drawImg(img, cx - (img.width * sc) / 2, H - img.height * sc + rise, 1, sc);
    const gx = cx + 26, gy = 112 + rise;
    drawRayGun(gx, gy, -Math.PI / 2 + 0.12, 2.6);
    if (t > 30) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 0.3);
      blob(Math.round(gx + 5), Math.round(gy - 44), 7, '#5ff0ff');
      blob(Math.round(gx + 5), Math.round(gy - 44), 3, '#ffffff');
      ctx.restore();
    }
    const subX = cx - Math.pow(clamp(1 - (t - 20) / 14, 0, 1), 2) * 400;
    if (t >= 20) {
      for (let d = 4; d >= 1; d--) drawText('THE GOD OF CREATING', subX + d, 22 + d, 16, '#2a2a3a', 'center', null);
      drawText('THE GOD OF CREATING', subX, 22, 16, '#ffffff', 'center', null);
    }
    if (t >= 40) {
      const slam = Math.max(0, 1 - (t - 40) / 6);
      ctx.save();
      ctx.translate(cx, 66);
      ctx.scale(1 + slam * 0.8, 1 + slam * 0.8);
      for (let d = 6; d >= 1; d--) drawText('MECHANIC', d, -16 + d, 32, '#4a0606', 'center', null);
      for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) drawText('MECHANIC', ox, -16 + oy, 32, '#ffffff', 'center', null);
      drawText('MECHANIC', 0, -16, 32, '#ff2a2a', 'center', null);
      ctx.restore();
      if (t < 46) {
        ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - (t - 40) / 6)})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
    if (t > 206) {
      ctx.fillStyle = `rgba(0,0,0,${clamp((t - 206) / 20, 0, 1)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  function renderMech() {
    const shake = mechIntro.on && mechIntro.t >= 44 && mechIntro.t < 60 ? (mechIntro.t % 2 ? 3 : -3) : 0;
    ctx.save();
    ctx.translate(shake - Math.round(mechRoom.cam), 0);
    drawMechRoomBg();
    drawMechanicNpc();
    let frame = 0;
    if (!player.onGround) frame = 1;
    else if (player.walk > 0) frame = walkFrame(player.walk);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(Math.round(player.x), Math.round(player.y + player.h) - 1, player.w, 1);
    drawImg(playerFrames[frame], player.x - 2, player.y, player.face);
    ctx.restore();
    ctx.save();
    ctx.translate(shake, 0);
    if (mechIntro.on) renderMechIntro(mechIntro.t);
    ctx.restore();
    if (!mechIntro.on) {
      if (mechNpc.state === 'beaten' && !dialog.active) {
        drawText('HEAD OUT THE MECH GATE', 18, 6, 8, '#ff8a5a', 'left');
        const ax = 8 - (Math.floor(tick / 8) % 3);
        ctx.fillStyle = '#ffe14d';
        for (let i = 0; i < 3; i++) ctx.fillRect(ax + i, 9 - i, 1, i * 2 + 1);
        ctx.fillRect(ax + 3, 8, 4, 3);
      }
      drawDialog();
      drawTitle();
      drawToast();
      if (canOpenInventory() || inv.open) drawBagButton();
      if (inv.open) drawInventory();
    }
  }

  // ---------- Chapter 4: the control room ----------
  const BF = 184;
  const BR_CHAIR_X = 270;
  const bridge = { state: 'walk', t: 0, swivel: 0 };
  const CAPTAIN_LINES = [
    '...',
    'SO. YOU MUST BE {NAME}.',
    'YOU WANDERED THROUGH MY SHIP...',
    'BUMPED INTO MY CREW...',
    'AND EVEN DEFEATED MY MECHANIC.',
    'IMPRESSIVE. FOR AN EARTHLING.',
    'ALLOW ME TO INTRODUCE MYSELF.',
    'I AM THE CAPTAIN OF THIS SHIP.',
    'BUT YOU ARE TOO LATE, {NAME}.',
    'LOOK OUT THE WINDOW.',
    'WE ARE ALREADY ON COURSE...',
    '...FOR YOUR HOME PLANET!',
    'AND NOBODY CAN STOP US.',
    'ESPECIALLY NOT YOU, {NAME}.',
    'NOW... FACE THE CAPTAIN!',
  ];
  const CAPTAIN_AGAIN_LINES = ['BACK FOR MORE, {NAME}?', 'THIS TIME I WILL NOT HOLD BACK!'];
  const CAPTAIN_WIN_LINES = [
    'IMPOSSIBLE...',
    'BESTED BY AN EARTHLING...',
    'BUT IT IS TOO LATE, {NAME}.',
    'THE SHIP CANNOT BE STOPPED NOW.',
    'WE WILL MEET AGAIN. VERY SOON.',
  ];
  function fightCaptain() {
    bridge.state = 'fight';
    startBattleTransition('captain', winCaptain, () => {
      Object.assign(bridge, { state: 'ready', t: 0, swivel: 1 });
      Object.assign(player, { x: 24, y: BF - player.h, vx: 0, vy: 0, face: 1, onGround: true, walk: 0 });
    }, 'bridge');
  }

  function winCaptain() {
    Object.assign(bridge, { state: 'beaten', t: 0, swivel: 1 });
    startDialog(CAPTAIN_WIN_LINES, () => {
      bridge.state = 'failure';
      bridge.t = 0;
    }, 'CAPTAIN');
  }

  function enterBridge() {
    game.mode = 'bridge';
    ship.phase = 'done';
    toast.t = 0;
    Object.assign(bridge, { state: 'walk', t: 0, swivel: 0 });
    Object.assign(player, { x: 24, y: BF - player.h, vx: 0, vy: 0, face: 1, onGround: true, walk: 0 });
    showTitle('THE CONTROL ROOM', '- CHAPTER 4 -');
  }

  function updateBridge() {
    updateDialog();
    const b = bridge;
    b.t++;
    const locked = dialog.active || fade.dir !== 0 || inv.open || (b.state !== 'walk' && b.state !== 'ready');
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
    player.x = clamp(player.x + player.vx, 8, BR_CHAIR_X - 64);
    const wasGround = player.onGround;
    player.y += player.vy;
    player.onGround = false;
    if (player.y + player.h >= BF) {
      player.y = BF - player.h;
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

    if (b.state === 'walk' && !locked && player.x > 150) {
      b.state = 'turn';
      b.t = 0;
      player.vx = 0;
      player.face = 1;
      startDialog(['...', 'I HAVE BEEN EXPECTING YOU.'], () => {
        b.state = 'swivel';
        b.t = 0;
        sfx('clank');
      }, 'CAPTAIN');
    } else if (b.state === 'swivel') {
      b.swivel = clamp(b.t / 60, 0, 1);
      if (b.t % 12 === 0 && b.t <= 60) sfx('step');
      if (b.t === 62) sfx('spot');
      if (b.t === 90) {
        b.state = 'talk';
        startDialog(CAPTAIN_LINES, () => {
          b.state = 'pose';
          b.t = 0;
        }, 'CAPTAIN');
      }
    } else if (b.state === 'pose') {
      if (b.t === 1) sfx('capIntro');
      if (b.t === 24) sfx('swoosh');
      if (b.t === 44) sfx('crash');
      if (b.t === 30) sfx('unsheathe');
      if (b.t === 230) fightCaptain();
    } else if (b.state === 'failure') {
      if (b.t === 1) sfx('shipFail');
      if (b.t % 60 === 20) sfx('siren');
      if (b.t === 70 || b.t === 130 || b.t === 170) sfx('boom');
      if (b.t === 210) fadeThen(startCrash);
    } else if (b.state === 'ready' && !locked && player.x > 150) {
      b.state = 'again';
      player.vx = 0;
      player.face = 1;
      startDialog(CAPTAIN_AGAIN_LINES, fightCaptain, 'CAPTAIN');
    } else if (b.state === 'outro') {
      if (b.t === 40 || b.t === 80) sfx('laugh');
      if (b.t === 360) {
        fadeThen(() => {
          game.mode = 'eye';
          eye.phase = 'end';
          eye.t = 0;
        });
      }
    }
  }

  function drawCaptainChair(x, s) {
    const fy = BF;
    const w = Math.max(4, Math.round(36 * Math.abs(Math.cos(s * Math.PI))));
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x - 3, fy - 26, 6, 18);
    ctx.fillStyle = '#6e7a90';
    ctx.fillRect(x - 2, fy - 26, 4, 18);
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(x - 14, fy - 10, 28, 3);
    const back = () => {
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(x - w / 2 - 1, fy - 72, w + 2, 46);
      ctx.fillStyle = '#7a1520';
      ctx.fillRect(x - w / 2, fy - 71, w, 44);
      ctx.fillStyle = '#c2202e';
      ctx.fillRect(x - w / 2 + 2, fy - 69, Math.max(1, w - 4), 2);
      ctx.fillStyle = '#ffe14d';
      ctx.fillRect(x - w / 2, fy - 71, w, 1);
      ctx.fillRect(x - w / 2, fy - 28, w, 1);
      if (w > 12) blob(x, fy - 56, 3, '#ffe14d');
    };
    return back;
  }

  function renderBridge() {
    const b = bridge;
    const shake = b.state === 'outro' && b.t < 120 ? Math.round(Math.sin(b.t * 1.7) * 1.5)
      : b.state === 'failure' ? Math.round(Math.sin(b.t * 1.9) * Math.min(4, b.t / 40)) : 0;
    ctx.save();
    ctx.translate(shake, 0);
    ctx.fillStyle = '#161a2c';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1e2338';
    for (let x = 0; x < W; x += 32) ctx.fillRect(x, 0, 1, BF);

    const win = [[44, 12], [340, 12], [372, 112], [12, 112]];
    ctx.save();
    ctx.beginPath();
    win.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#05040e';
    ctx.fillRect(0, 0, W, 120);
    const wcx = 192, wcy = 60;
    for (let i = 0; i < 80; i++) {
      const a = i * 2.39996;
      const d = (tick * (1.2 + (i % 5) * 0.3) + i * 53) % 220;
      const len = 1 + d * 0.06;
      const x1 = wcx + Math.cos(a) * d, y1 = wcy + Math.sin(a) * d * 0.6;
      ctx.strokeStyle = i % 6 ? '#ffffff' : '#5ff0ff';
      ctx.globalAlpha = Math.min(1, d / 60);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + Math.cos(a) * len, y1 + Math.sin(a) * len * 0.6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const er = 16 + (b.state === 'outro' ? Math.min(30, b.t * 0.15) : 0);
    blob(wcx, wcy, Math.round(er + 3), '#2f6fdc');
    blob(wcx, wcy, Math.round(er), '#2a64c8');
    blob(wcx - Math.round(er * 0.3), wcy - Math.round(er * 0.2), Math.round(er * 0.4), '#3ea84a');
    blob(wcx + Math.round(er * 0.35), wcy + Math.round(er * 0.3), Math.round(er * 0.3), '#3ea84a');
    blob(wcx + Math.round(er * 0.1), wcy - Math.round(er * 0.55), Math.round(er * 0.2), '#ffffff');
    ctx.restore();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1a1420';
    ctx.beginPath();
    win.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#8a96aa';
    ctx.stroke();
    for (const [x1, x2] of [[118, 106], [192, 192], [266, 278]]) {
      ctx.fillStyle = '#1a1420';
      ctx.beginPath();
      ctx.moveTo(x1 - 2, 12);
      ctx.lineTo(x1 + 2, 12);
      ctx.lineTo(x2 + 2, 112);
      ctx.lineTo(x2 - 2, 112);
      ctx.fill();
    }
    drawText('COURSE: EARTH', wcx, 16, 8, tick % 40 < 28 ? '#ff4a4a' : '#7a1520', 'center', '#05040e');

    ctx.fillStyle = '#1a1420';
    ctx.fillRect(0, 112, W, 30);
    ctx.fillStyle = '#2a3046';
    ctx.fillRect(0, 114, W, 26);
    ctx.fillStyle = '#4a5468';
    ctx.fillRect(0, 114, W, 2);
    for (let i = 0; i < 40; i++) {
      const x = 6 + i * 9.5;
      if (x > 50 && x < 96) continue;
      if (x > 294 && x < 344) continue;
      const on = (Math.floor(tick / (6 + (i % 4) * 3)) + i * 7) % 5 < 3;
      ctx.fillStyle = on ? ['#ff4a4a', '#5fff8a', '#ffe14d', '#5ff0ff'][i % 4] : '#1a1f30';
      ctx.fillRect(Math.round(x), 122 + (i % 2) * 8, 4, 3);
    }
    ctx.fillStyle = '#05140e';
    ctx.fillRect(54, 118, 40, 20);
    ctx.strokeStyle = '#2e8a3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(74, 128, 9, 0, Math.PI * 2);
    ctx.stroke();
    const sa = tick * 0.06;
    ctx.strokeStyle = '#5fff8a';
    ctx.beginPath();
    ctx.moveTo(74, 128);
    ctx.lineTo(74 + Math.cos(sa) * 9, 128 + Math.sin(sa) * 9);
    ctx.stroke();
    if ((tick % 120) < 60) {
      ctx.fillStyle = '#ff4a4a';
      ctx.fillRect(79, 124, 2, 2);
    }
    ctx.fillStyle = '#0a1028';
    ctx.fillRect(298, 118, 44, 20);
    for (let i = 0; i < 7; i++) {
      const h = 3 + Math.round((Math.sin(tick * 0.05 + i) * 0.5 + 0.5) * 12);
      ctx.fillStyle = '#5ff0ff';
      ctx.fillRect(301 + i * 6, 136 - h, 4, h);
    }

    for (const [cx0, skin, face] of [[40, 1, -1], [350, 2, 1]]) {
      const img = ALIEN_SKINS[skin][0];
      const bob = tick % 20 < 10 ? 0 : 1;
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(cx0 - 6, BF - 10, 12, 3);
      ctx.fillRect(cx0 - 1, BF - 8, 2, 8);
      drawImg(img, cx0 - img.width / 2, BF - 12 - img.height + bob, face);
    }

    ctx.fillStyle = '#1a1420';
    ctx.fillRect(BR_CHAIR_X - 44, BF - 9, 88, 9);
    ctx.fillStyle = '#4a5468';
    ctx.fillRect(BR_CHAIR_X - 43, BF - 8, 86, 7);
    for (let i = 0; i < 86; i += 6) {
      ctx.fillStyle = (Math.floor(tick / 6) + i / 6) % 4 ? '#2a3046' : '#5ff0ff';
      ctx.fillRect(BR_CHAIR_X - 43 + i, BF - 3, 3, 1);
    }
    const back = drawCaptainChair(BR_CHAIR_X, b.swivel);
    const capImg = captainFrames[tick % 160 < 6 ? 1 : 0];
    const talking = dialog.active && dialog.speaker === 'CAPTAIN' && dialog.chars < dialog.lines[dialog.line].length;
    const capY = BF - 26 - capImg.height * 2 + 6 + (talking && tick % 8 < 4 ? -1 : 0) + (b.state === 'outro' && b.t < 120 && tick % 6 < 3 ? -2 : 0);
    if (b.swivel < 0.5) {
      drawImg(capImg, BR_CHAIR_X - capImg.width, capY, -1, 2);
      back();
    } else {
      back();
      drawImg(capImg, BR_CHAIR_X - capImg.width, capY, -1, 2);
      ctx.fillStyle = '#1a1420';
      ctx.fillRect(BR_CHAIR_X - 20, BF - 32, 6, 4);
      ctx.fillRect(BR_CHAIR_X + 14, BF - 32, 6, 4);
      ctx.fillStyle = '#c2202e';
      ctx.fillRect(BR_CHAIR_X - 19, BF - 31, 4, 2);
      ctx.fillRect(BR_CHAIR_X + 15, BF - 31, 4, 2);
    }
    if (b.state === 'turn' || (b.state === 'swivel' && b.t < 40)) {
      drawText('?', BR_CHAIR_X, BF - 86, 8, '#ffe14d', 'center', '#1a1420');
    }
    if (b.state === 'ready' && tick % 60 < 40) drawText('!', BR_CHAIR_X - 14, BF - 86, 8, '#ffe14d', 'center', '#1a1420');
    if (b.state === 'beaten') {
      drawStars(BR_CHAIR_X - 14, BF - 80, 5, tick);
      if (tick % 30 < 4) sparkle(BR_CHAIR_X - 4 + ((tick >> 2) % 12), BF - 60, 2, CPT.neon);
    }
    if (b.state === 'outro' && b.t < 140) {
      for (let i = 0; i < 3; i++) {
        const lt = (b.t + i * 14) % 42;
        ctx.save();
        ctx.globalAlpha = 1 - lt / 42;
        drawText('HA', BR_CHAIR_X - 20 + i * 18, BF - 80 - lt, 8, '#5fff8a', 'center', '#1a1420');
        ctx.restore();
      }
    }

    ctx.fillStyle = '#2a3046';
    ctx.fillRect(0, BF, W, H - BF);
    ctx.fillStyle = '#4a5468';
    ctx.fillRect(0, BF, W, 1);
    for (let x = 0; x < W; x += 24) {
      ctx.fillStyle = '#1a1f30';
      ctx.fillRect(x, BF, 1, H - BF);
    }
    let frame = 0;
    if (!player.onGround) frame = 1;
    else if (player.walk > 0) frame = walkFrame(player.walk);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(Math.round(player.x), Math.round(player.y + player.h) - 1, player.w, 1);
    drawImg(playerFrames[frame], player.x - 2, player.y, player.face);
    ctx.restore();

    if (b.state === 'outro' && b.t > 140) {
      const k = clamp((b.t - 140) / 40, 0, 1);
      ctx.fillStyle = `rgba(0,0,0,${k})`;
      ctx.fillRect(0, 0, W, H);
      if (b.t > 180) {
        const text = 'TO BE CONTINUED...';
        drawText(text.slice(0, Math.floor((b.t - 180) / 4)), W / 2, H / 2 - 8, 16, '#ffe14d', 'center', '#5a3a1a');
      }
    }
    if (b.state === 'failure') {
      const dark = 0.25 + Math.min(0.35, b.t / 400) + (hash(Math.floor(b.t / 3) * 3.7) < 0.3 ? 0.4 : 0);
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.9, dark)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = `rgba(255,20,20,${0.12 + 0.1 * Math.sin(b.t * 0.2)})`;
      ctx.fillRect(0, 0, W, H);
      for (const [sx, sy, seed] of [[60, 120, 1], [140, 126, 2], [250, 122, 3], [320, 128, 4], [192, 112, 5]]) bmSparks(sx, sy, seed + 20, 1.6);
      for (const t0 of [70, 130, 170]) {
        const d = b.t - t0;
        if (d >= 0 && d < 20) {
          const x = 60 + (t0 % 7) * 40;
          ctx.save();
          ctx.globalAlpha = 1 - d / 20;
          blob(x, 124, 6 + d, '#ff9a2e');
          blob(x, 124, 3 + d / 2, '#ffe14d');
          ctx.restore();
        }
      }
      if (b.t % 30 < 20) drawText('!! CORE FAILURE !!', W / 2, 52, 16, '#ff2a2a', 'center', '#1a0408');
      drawText('POWER: ' + Math.max(0, 100 - Math.floor(b.t / 2)) + '%', W / 2, 74, 8, '#ffe14d', 'center', '#1a0408');
      if (b.t > 60) drawSpeech(b.t < 140 ? 'NO... THE CORE!' : 'WE ARE GOING DOWN!', BR_CHAIR_X - 14, BF - 70);
    } else if (b.state === 'pose') {
      ctx.save();
      if (b.t >= 44 && b.t < 60) ctx.translate(b.t % 2 ? 3 : -3, 0);
      renderCaptainIntro(b.t);
      ctx.restore();
    } else if (b.state !== 'outro') {
      drawDialog();
      drawTitle();
      drawToast();
      if (canOpenInventory() || inv.open) drawBagButton();
      if (inv.open) drawInventory();
    }
  }

  function renderCaptainIntro(t) {
    const k = clamp(t / 12, 0, 1);
    const cx = W / 2, vy = 92;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = '#070512';
    ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < 7; r++) {
      const p = ((t * 0.012 + r / 7) % 1);
      ctx.strokeStyle = `hsl(${(250 + r * 20 + t) % 360},70%,${20 + p * 30}%)`;
      ctx.lineWidth = 1 + p * 3;
      ctx.beginPath();
      ctx.ellipse(cx, vy, p * p * 320, p * p * 190, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 150; i++) {
      const a = i * 2.39996;
      const d = (t * (2 + (i % 5)) + i * 41) % 280;
      const len = 3 + d * 0.14;
      ctx.strokeStyle = i % 4 ? '#ffffff' : `hsl(${(180 + i * 9 + t * 3) % 360},90%,65%)`;
      ctx.globalAlpha = k * Math.min(1, d / 60);
      ctx.lineWidth = d > 150 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * d, vy + Math.sin(a) * d * 0.6);
      ctx.lineTo(cx + Math.cos(a) * (d + len), vy + Math.sin(a) * (d + len) * 0.6);
      ctx.stroke();
    }
    ctx.globalAlpha = k;
    const pr = 14 + t * 0.06;
    blob(cx, vy, Math.round(pr + 3), '#2f6fdc');
    blob(cx, vy, Math.round(pr), '#2a64c8');
    blob(Math.round(cx - pr * 0.3), Math.round(vy - pr * 0.2), Math.round(pr * 0.4), '#3ea84a');
    blob(Math.round(cx + pr * 0.35), Math.round(vy + pr * 0.3), Math.round(pr * 0.3), '#3ea84a');

    const oct = [[60, 8], [324, 8], [376, 60], [376, 150], [8, 150], [8, 60]];
    ctx.fillStyle = '#0e1020';
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    oct.slice().reverse().forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill('evenodd');
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#4a5468';
    ctx.beginPath();
    oct.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = k * 0.18;
    for (const [lx, dir] of [[20, 1], [364, -1]]) {
      const a = Math.PI / 2 + dir * (0.6 + Math.sin(t * 0.06) * 0.5);
      ctx.fillStyle = '#ff2a2a';
      ctx.beginPath();
      ctx.moveTo(lx, 12);
      ctx.lineTo(lx + Math.cos(a - 0.12) * 400, 12 + Math.sin(a - 0.12) * 400);
      ctx.lineTo(lx + Math.cos(a + 0.12) * 400, 12 + Math.sin(a + 0.12) * 400);
      ctx.fill();
    }
    ctx.restore();
    for (const lx of [20, 364]) {
      blob(lx, 12, 6, tick % 20 < 10 ? '#ff3e3e' : '#8a1a1a');
      blob(lx, 12, 2, '#ffd0d0');
    }
    ctx.fillStyle = '#0b0c18';
    for (const [x, w, h] of [[0, 70, 46], [64, 40, 30], [280, 40, 30], [314, 70, 46]]) {
      ctx.fillRect(x, H - h, w, h);
      for (let i = 0; i < Math.floor(w / 8); i++) {
        const on = (Math.floor(tick / (5 + (i % 3) * 3)) + i * 5 + x) % 4 < 2;
        ctx.fillStyle = on ? ['#ff4a4a', '#5fff8a', '#ffe14d', '#5ff0ff'][(i + x) % 4] : '#1a1f30';
        ctx.fillRect(x + 4 + i * 8, H - h + 6 + (i % 2) * 6, 4, 2);
      }
      ctx.fillStyle = '#0b0c18';
    }

    const sc = 5;
    const img = captainFrames[t % 120 < 6 ? 1 : 0];
    const rise = Math.pow(clamp(1 - t / 20, 0, 1), 2) * 70;
    const left = cx - (img.width * sc) / 2, top = H - img.height * sc + rise;
    ctx.save();
    ctx.globalAlpha = k * 0.3;
    blob(cx, top + 50, 60, CPT.green);
    ctx.restore();
    const ext = clamp((t - 30) / 14, 0, 1);
    drawKatana(left + img.width * sc - 4, top + 64, -1.05, 2.6, ext, 0.6 + 0.4 * Math.sin(t * 0.3));
    drawImg(img, left, top, 1, sc);
    drawCapGun(left + 6, top + 62, -2.1, 2.4);
    if (t > 30) {
      const [m0, m1] = capGunMuzzles(left + 6, top + 62, -2.1, 2.4);
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 0.3);
      blob(Math.round(m0[0]), Math.round(m0[1]), 5, CPT.green);
      blob(Math.round(m1[0]), Math.round(m1[1]), 5, CPT.red);
      ctx.restore();
    }
    if (ext > 0 && ext < 1) {
      const bx = left + img.width * sc - 4 + Math.cos(-1.05) * 94 * ext, by = top + 64 + Math.sin(-1.05) * 94 * ext;
      for (let i = 0; i < 5; i++) sparkle(Math.round(bx + Math.sin(i * 2 + t) * 7), Math.round(by + Math.cos(i * 3 + t) * 7), 2, i % 2 ? CPT.neon : '#ffffff');
    }
    if (t >= 46 && t < 58) {
      const g = (t - 46) / 12;
      const kx = left + img.width * sc - 4, ky = top + 64;
      sparkle(Math.round(kx + Math.cos(-1.05) * 94 * g), Math.round(ky + Math.sin(-1.05) * 94 * g), 4, '#ffffff');
    }
    const subX = cx - Math.pow(clamp(1 - (t - 20) / 14, 0, 1), 2) * 400;
    if (t >= 20) {
      for (let d = 4; d >= 1; d--) drawText('LORD OF THE STARS', subX + d, 20 + d, 16, '#1a2450', 'center', null);
      drawText('LORD OF THE STARS', subX, 20, 16, '#ffffff', 'center', null);
    }
    if (t >= 40) {
      const slam = Math.max(0, 1 - (t - 40) / 6);
      ctx.save();
      ctx.translate(cx, 64);
      ctx.scale(1 + slam * 0.8, 1 + slam * 0.8);
      for (let d = 6; d >= 1; d--) drawText('CAPTAIN', d, -16 + d, 32, '#0a1a10', 'center', null);
      for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) drawText('CAPTAIN', ox, -16 + oy, 32, '#ffffff', 'center', null);
      drawText('CAPTAIN', 0, -16, 32, CPT.green, 'center', null);
      ctx.restore();
      if (t < 46) {
        ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - (t - 40) / 6)})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
    if (t > 206) {
      ctx.fillStyle = `rgba(0,0,0,${clamp((t - 206) / 20, 0, 1)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // ---------- Chapter 4: the crash ----------
  const crash = { t: 0 };
  const CRASH_ATMO = 180, CRASH_HIT = 540, CRASH_CORE = 640, CRASH_RISE = 760, CRASH_HACK = 860, CRASH_END = 1080;
  const CRASH_CAPTIONS = [
    [20, 'THE SHIP STOPPED WORKING...'],
    [CRASH_ATMO + 20, 'IT FELL LIKE A COMET...'],
    [CRASH_ATMO + 180, 'BURNING THROUGH THE SKY...'],
    [CRASH_HIT + 30, '...AND CRASHED.'],
    [CRASH_CORE + 10, 'BUT THE CORE... WAS BROKEN.'],
    [CRASH_HACK + 40, 'THE WORLD WAS HACKED.'],
    [CRASH_HACK + 120, 'A DIGITAL BARRIER SEALED IT OFF...'],
  ];

  function startCrash() {
    game.mode = 'crash';
    crash.t = 0;
    toast.t = 0;
  }

  function updateCrash() {
    const t = ++crash.t;
    if (t === 1) sfx('shipFail');
    if (t < CRASH_ATMO && t % 40 === 10) sfx('warn');
    if (t === 120) sfx('glitch');
    if (t === CRASH_ATMO) sfx('fallRoar');
    if (t > CRASH_ATMO && t < CRASH_HIT && t % 90 === 0) sfx('rumble');
    if (t === CRASH_HIT - 60) sfx('whistle');
    if (t === CRASH_HIT) sfx('megaBoom');
    if (t === CRASH_HIT + 8) sfx('finalBoom');
    if (t === CRASH_HIT + 40 || t === CRASH_HIT + 70) sfx('boom');
    if (t >= CRASH_CORE && t < CRASH_RISE && t % 24 === 0) sfx('glitch');
    if (t === CRASH_CORE + 50) sfx('spark');
    if (t === CRASH_RISE) sfx('coreRise');
    if (t === CRASH_HACK) sfx('hack');
    if (t > CRASH_HACK && t < CRASH_END - 40 && t % 50 === 20) sfx('glitch');
    if (t === CRASH_HACK + 30) sfx('digital');
    if (t === CRASH_END) fadeThen(enterWreck);
  }

  function drawSaucer(x, y, s, ang, o = {}) {
    const lights = o.lights === undefined ? 1 : o.lights;
    const heat = o.heat || 0;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(ang);
    ctx.scale(s, s);
    ctx.fillStyle = '#140a24';
    ctx.beginPath();
    ctx.ellipse(0, -6, 13, 10, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = heat > 0.5 ? '#ffb070' : '#5ff0ff';
    ctx.beginPath();
    ctx.ellipse(0, -6, 11, 8, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(-6, -12, 4, 2);
    ctx.fillStyle = '#140a24';
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    const hull = heat > 0 ? `rgb(${Math.round(138 + heat * 117)},${Math.round(150 - heat * 40)},${Math.round(170 - heat * 130)})` : '#8a96aa';
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.ellipse(0, -1, 30, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = heat > 0 ? '#7a2a1a' : '#4a5468';
    ctx.fillRect(-30, 0, 60, 3);
    for (let i = 0; i < 8; i++) {
      const on = hash(Math.floor(tick / 5) + i * 3.3) < lights;
      ctx.fillStyle = on ? ['#ff4a4a', '#5fff8a', '#ffe14d', '#5ff0ff'][i % 4] : '#2a2a34';
      ctx.fillRect(-26 + i * 7, -1, 3, 2);
    }
    if (o.dmg) {
      ctx.fillStyle = '#140a24';
      ctx.fillRect(10, -4, 8, 3);
      ctx.fillRect(-20, 1, 6, 3);
    }
    ctx.restore();
  }

  function drawFireTrail(x, y, dx, dy, len, t, scale = 1) {
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L;
    for (let i = 40; i >= 0; i--) {
      const p = i / 40;
      const jit = (hash(i * 3.1 + Math.floor(t / 2)) - 0.5) * 10 * p * scale;
      const px = x - ux * len * p - uy * jit, py = y - uy * len * p + ux * jit;
      const r = Math.round((3 + p * 14) * scale * (0.8 + hash(i + t * 0.7) * 0.4));
      ctx.globalAlpha = (1 - p) * 0.9;
      blob(Math.round(px), Math.round(py), r, p < 0.15 ? '#ffffff' : p < 0.35 ? '#ffe14d' : p < 0.65 ? '#ff9a2e' : '#c2202e');
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 14; i++) {
      const p = ((t * 0.04 + i / 14) % 1);
      const px = x - ux * len * 1.3 * p + (hash(i * 7.7) - 0.5) * 30 * p;
      const py = y - uy * len * 1.3 * p + (hash(i * 5.3) - 0.5) * 30 * p;
      ctx.globalAlpha = (1 - p) * 0.5;
      blob(Math.round(px), Math.round(py), Math.round((4 + p * 10) * scale), '#3a3044');
    }
    ctx.globalAlpha = 1;
  }

  function drawCore(x, y, r, crack, glitch) {
    const pulse = 0.6 + 0.4 * Math.sin(tick * 0.3);
    ctx.save();
    ctx.globalAlpha = 0.35 * pulse;
    blob(Math.round(x), Math.round(y), Math.round(r * 2.2), '#5ff0ff');
    ctx.restore();
    if (glitch) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      blob(Math.round(x - 3), Math.round(y), r, '#ff2a6a');
      blob(Math.round(x + 3), Math.round(y), r, '#2a6aff');
      ctx.restore();
    }
    blob(Math.round(x), Math.round(y), r + 1, '#140a24');
    blob(Math.round(x), Math.round(y), r, '#5ff0ff');
    blob(Math.round(x - r * 0.25), Math.round(y - r * 0.25), Math.round(r * 0.5), '#e8ffff');
    if (crack > 0) {
      const n = Math.ceil(crack * 6);
      for (let i = 0; i < n; i++) {
        const a = i * 1.7 + 0.4;
        let ax = x, ay = y;
        for (let k = 0; k < 3; k++) {
          const nx = ax + Math.cos(a + (hash(i * 4 + k) - 0.5)) * r * 0.45;
          const ny = ay + Math.sin(a + (hash(i * 4 + k) - 0.5)) * r * 0.45;
          pxLine(ax, ay, nx, ny, '#140a24');
          ax = nx;
          ay = ny;
        }
      }
    }
  }

  function crashGlitchSlices(amt) {
    const n = Math.floor(amt * 8);
    for (let i = 0; i < n; i++) {
      if (Math.random() > 0.6) continue;
      const y = Math.floor(Math.random() * H), h = 2 + Math.floor(Math.random() * 10);
      const dx = Math.round((Math.random() - 0.5) * 30 * amt);
      ctx.drawImage(cvs, 0, y, W, h, dx, y, W, h);
      if (Math.random() < 0.3) {
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,40,140,0.35)' : 'rgba(95,240,255,0.35)';
        ctx.fillRect(0, y, W, h);
      }
    }
  }

  function drawCrashGround(gy, t, hacked) {
    ctx.fillStyle = hacked ? '#1a0a2a' : '#2a4a2a';
    ctx.beginPath();
    ctx.moveTo(0, gy);
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, gy - 10 - Math.sin(x * 0.03) * 8 - Math.sin(x * 0.011 + 1) * 10);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
    ctx.fillStyle = hacked ? '#120620' : '#1e3a20';
    ctx.fillRect(0, gy, W, H - gy);
    ctx.fillStyle = hacked ? '#2a1040' : '#3e6a34';
    ctx.fillRect(0, gy, W, 2);
    for (let i = 0; i < 14; i++) {
      const x = (i * 29 + 7) % W;
      ctx.fillStyle = hacked ? '#0e0418' : '#16301a';
      ctx.fillRect(x, gy - 12, 3, 12);
      blob(x + 1, gy - 14, 5, hacked ? '#0e0418' : '#16301a');
    }
  }

  function renderCrash() {
    const t = crash.t;
    let shake = 0;
    if (t < CRASH_ATMO) shake = t > 100 ? 1 : 0;
    else if (t < CRASH_HIT) shake = 1 + Math.floor((t - CRASH_ATMO) / 90);
    else if (t < CRASH_HIT + 60) shake = Math.round(10 * (1 - (t - CRASH_HIT) / 60)) + 1;
    else if (t >= CRASH_CORE && t < CRASH_RISE) shake = (t - CRASH_CORE) > 80 ? 2 : 0;
    else if (t >= CRASH_HACK && t < CRASH_HACK + 30) shake = 8;
    ctx.save();
    if (shake) ctx.translate(Math.round((Math.random() - 0.5) * shake * 2), Math.round((Math.random() - 0.5) * shake));

    if (t < CRASH_ATMO) {
      ctx.fillStyle = '#05040e';
      ctx.fillRect(-10, -10, W + 20, H + 20);
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = i % 7 ? '#ffffff' : '#5ff0ff';
        ctx.fillRect(Math.round((i * 97 + t * 0.1 * (1 + (i % 3))) % W), (i * 53) % H, 1, 1);
      }
      const er = 120 + t * 0.15;
      blob(W + 20, H + 70, Math.round(er + 6), '#2f6fdc');
      blob(W + 20, H + 70, Math.round(er), '#2a64c8');
      blob(W - 40, H - 10, 40, '#3ea84a');
      blob(W - 90, H + 20, 30, '#3ea84a');
      blob(W - 10, H - 50, 18, '#ffffff');
      const p = t / CRASH_ATMO;
      const sx = 110 + p * 120, sy = 70 + p * 60 + Math.sin(t * 0.1) * 2;
      for (let i = 0; i < 6; i++) {
        const q = ((t * 0.02 + i / 6) % 1);
        ctx.globalAlpha = (1 - q) * 0.6;
        blob(Math.round(sx - 10 - q * 60), Math.round(sy - 4 - q * 30), Math.round(3 + q * 8), '#3a3044');
      }
      ctx.globalAlpha = 1;
      drawSaucer(sx, sy, 1.4, 0.15 + p * 0.35 + Math.sin(t * 0.07) * 0.05, { lights: Math.max(0.05, 1 - t / 140), dmg: true });
      if (t % 20 < 10) bmSparks(sx + 18, sy, 3, 1.4);
      bmSparks(sx - 20, sy + 4, 8, 1);
      if (t > 60 && t < 120 && t % 30 < 15) drawText('!! CORE OFFLINE !!', sx, sy - 34, 8, '#ff2a2a', 'center', '#05040e');
    } else if (t < CRASH_HIT) {
      const lt = t - CRASH_ATMO;
      const p = lt / (CRASH_HIT - CRASH_ATMO);
      const heat = clamp(lt / 120, 0, 1);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, p < 0.5 ? '#0a0a2a' : '#1a2a6a');
      g.addColorStop(1, p < 0.5 ? '#3a1a3a' : '#6aa0e0');
      ctx.fillStyle = g;
      ctx.fillRect(-10, -10, W + 20, H + 20);
      ctx.save();
      ctx.globalAlpha = 0.25 * heat;
      ctx.fillStyle = '#ff6a2a';
      ctx.fillRect(-10, -10, W + 20, H + 20);
      ctx.restore();
      for (let i = 0; i < 18; i++) {
        const speed = 3 + (i % 4) * 2;
        const cy = H + 40 - ((lt * speed + i * 67) % (H + 120));
        const cx = (i * 71) % W + Math.sin(i) * 20 - ((lt * speed * 0.6 + i * 40) % 60);
        ctx.globalAlpha = 0.55 + (i % 3) * 0.15;
        blob(Math.round(cx), Math.round(cy), 10 + (i % 4) * 4, '#e8ecf4');
        blob(Math.round(cx + 12), Math.round(cy + 4), 8 + (i % 3) * 3, '#ffffff');
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 30; i++) {
        const y = (i * 37 + lt * 9) % (H + 40) - 20;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect((i * 53) % W, H - y, 1, 10);
      }
      const sx = 150 + Math.sin(lt * 0.05) * 6 + (p > 0.8 ? (p - 0.8) * 300 : 0);
      const sy = 90 + Math.cos(lt * 0.07) * 4 + (p > 0.8 ? (p - 0.8) * 400 : 0);
      drawFireTrail(sx, sy, 1, 1.3, 70 + heat * 70, lt, 0.6 + heat * 0.8);
      ctx.save();
      ctx.globalAlpha = 0.5 * heat + 0.15 * Math.sin(lt * 0.5);
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx + 4, sy + 6, 36, 0.1, 1.6);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx + 2, sy + 4, 32, 0.15, 1.5);
      ctx.stroke();
      ctx.restore();
      drawSaucer(sx, sy, 1.6, 0.65 + Math.sin(lt * 0.3) * 0.04, { lights: 0, heat, dmg: true });
      for (let i = 0; i < 6; i++) bmSparks(sx - 10 + i * 4, sy - 6, 30 + i, 1.4);
      if (p > 0.75) drawCrashGround(H + 30 - (p - 0.75) * 180, lt, false);
    } else if (t < CRASH_CORE) {
      const lt = t - CRASH_HIT;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#3a2a5a');
      g.addColorStop(1, '#e07a4a');
      ctx.fillStyle = g;
      ctx.fillRect(-10, -10, W + 20, H + 20);
      drawCrashGround(170, lt, false);
      const ix = 220, iy = 168;
      for (let i = 0; i < 4; i++) {
        const q = ((lt * 0.01 + i / 4) % 1);
        ctx.globalAlpha = (1 - q) * 0.7;
        blob(Math.round(ix + Math.sin(i + lt * 0.02) * 10), Math.round(iy - 20 - q * 150), Math.round(14 + q * 30), '#2a2030');
      }
      ctx.globalAlpha = 1;
      const fr = Math.min(70, lt * 3);
      ctx.save();
      ctx.globalAlpha = clamp(1 - (lt - 30) / 60, 0, 1);
      blob(ix, iy - 10, Math.round(fr), '#c2202e');
      blob(ix, iy - 10, Math.round(fr * 0.75), '#ff9a2e');
      blob(ix, iy - 10, Math.round(fr * 0.45), '#ffe14d');
      blob(ix, iy - 10, Math.round(fr * 0.2), '#ffffff');
      ctx.restore();
      for (let i = 0; i < 18; i++) {
        const a = -Math.PI / 2 + (hash(i * 3.7) - 0.5) * 2.6;
        const v = 2 + hash(i * 1.9) * 4;
        const dx = Math.cos(a) * v * lt, dy = Math.sin(a) * v * lt + 0.08 * lt * lt;
        if (iy + dy > 175) continue;
        cRect(Math.round(ix + dx), Math.round(iy + dy), 3, 3, i % 3 ? '#4a5468' : '#ff9a2e');
      }
      for (let i = 0; i < 5; i++) {
        const fx = ix - 40 + i * 20;
        const fh = 10 + hash(i + Math.floor(lt / 3)) * 10;
        blob(fx, 168 - fh / 2, Math.round(fh / 2), '#ff6a2a');
        blob(fx, 166 - fh / 3, Math.round(fh / 4), '#ffe14d');
      }
      if (lt < 16) {
        ctx.fillStyle = `rgba(255,255,255,${1 - lt / 16})`;
        ctx.fillRect(-10, -10, W + 20, H + 20);
      }
    } else if (t < CRASH_HACK) {
      const lt = t - CRASH_CORE;
      ctx.fillStyle = '#120a1a';
      ctx.fillRect(-10, -10, W + 20, H + 20);
      ctx.fillStyle = '#2a1a2a';
      ctx.beginPath();
      ctx.ellipse(W / 2, 200, 220, 46, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const [x, y, w, h, r] of [[80, 150, 70, 20, -0.3], [230, 156, 90, 18, 0.25], [150, 170, 120, 14, 0]]) {
        ctx.save();
        ctx.translate(x + w / 2, y);
        ctx.rotate(r);
        bmBox(-w / 2, -h / 2, w, h, '#4a5468', '#8a96aa');
        ctx.restore();
      }
      for (let i = 0; i < 8; i++) {
        const fx = 30 + i * 46;
        const fh = 12 + hash(i + Math.floor(lt / 3)) * 14;
        blob(fx, 176 - fh / 2, Math.round(fh / 2), '#ff6a2a');
        blob(fx, 174 - fh / 3, Math.round(fh / 4), '#ffe14d');
      }
      for (let i = 0; i < 4; i++) bmSparks(90 + i * 70, 150, 50 + i, 1.5);
      const rising = t >= CRASH_RISE;
      const rt = t - CRASH_RISE;
      const cx = W / 2 + (rising ? 0 : (lt > 60 ? (Math.random() - 0.5) * 4 : 0));
      const cy = rising ? 128 - rt * rt * 0.04 - rt * 0.3 : 128 + Math.sin(lt * 0.1) * 2;
      if (rising) {
        for (let i = 0; i < 20; i++) {
          ctx.globalAlpha = (1 - i / 20) * 0.6;
          blob(Math.round(cx + (hash(i + rt) - 0.5) * 4), Math.round(cy + i * 6), Math.round(10 - i * 0.4), i % 2 ? '#5ff0ff' : '#ff3eb0');
        }
        ctx.globalAlpha = 1;
      }
      const crack = clamp(lt / 100, 0, 1);
      drawCore(cx, cy, 12 + (rising ? 0 : Math.sin(lt * 0.4) * 1.5), crack, lt > 30 && hash(Math.floor(tick / 2) * 1.3) < 0.4);
      if (!rising) {
        for (let i = 0; i < 4; i++) {
          const a = lt * 0.12 + i * 1.57;
          pxLine(cx, cy, cx + Math.cos(a) * 26, cy + Math.sin(a) * 18, hash(i + tick) < 0.5 ? '#ff3eb0' : '#5ff0ff');
        }
        if (lt > 40) {
          for (let i = 0; i < 6; i++) {
            const gx = cx + (hash(i * 3 + Math.floor(tick / 3)) - 0.5) * 80;
            const gy = cy + (hash(i * 5 + Math.floor(tick / 3)) - 0.5) * 50;
            ctx.fillStyle = i % 2 ? '#5ff0ff' : '#ff3eb0';
            ctx.fillRect(Math.round(gx), Math.round(gy), 4 + (i % 3) * 3, 2);
          }
          if (tick % 20 < 12) drawText('ERR0R', cx, cy - 30, 8, '#ff3eb0', 'center', '#120a1a');
        }
      }
      crashGlitchSlices(rising ? 0.6 : crack * 0.8);
    } else {
      const lt = t - CRASH_HACK;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#12041e');
      g.addColorStop(1, '#3a0a3a');
      ctx.fillStyle = g;
      ctx.fillRect(-10, -10, W + 20, H + 20);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = i % 3 ? '#5ff0ff' : '#ff3eb0';
        ctx.fillRect((i * 97) % W, (i * 41 + lt) % 140, 1, 2);
      }
      drawCrashGround(180, lt, true);
      const dome = Math.min(1, lt / 70);
      const rx = 40 + dome * 300, ry = 20 + dome * 180;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(W / 2, 180, rx, ry, 0, Math.PI, 0);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = 'rgba(95,240,255,0.08)';
      ctx.fillRect(0, 0, W, H);
      drawBarrierGrid(0, 182, 0.55);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = '#5ff0ff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(lt * 0.3);
      ctx.beginPath();
      ctx.ellipse(W / 2, 180, rx, ry, 0, Math.PI, 0);
      ctx.stroke();
      ctx.restore();
      for (let i = 0; i < 5; i++) {
        const sx = (i * 83 + lt * 2) % W;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(sx), 180 - Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((sx - W / 2) / rx, 2))) * ry), 2, 2);
      }
      if (lt < 30) {
        const r = lt * 10;
        ctx.save();
        ctx.globalAlpha = 1 - lt / 30;
        blob(W / 2, 20, Math.round(r), '#5ff0ff');
        blob(W / 2, 20, Math.round(r * 0.6), '#ffffff');
        ctx.restore();
      }
      if (lt > 50) {
        const rg = hash(Math.floor(tick / 3)) < 0.3 ? 3 : 1;
        ctx.save();
        ctx.globalAlpha = 0.7;
        for (const [word, y] of [['WORLD', 34], ['HACKED', 70]]) {
          drawText(word, W / 2 - rg, y, 32, '#ff2a6a', 'center', null);
          drawText(word, W / 2 + rg, y, 32, '#2a8aff', 'center', null);
        }
        ctx.restore();
        drawText('WORLD', W / 2, 34, 32, '#ffffff', 'center', null);
        drawText('HACKED', W / 2, 70, 32, '#ffffff', 'center', null);
      }
      crashGlitchSlices(lt < 40 ? 1 : 0.35);
    }
    ctx.restore();

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, 18);
    ctx.fillRect(0, H - 18, W, 18);
    let cap = null;
    for (const c of CRASH_CAPTIONS) if (t >= c[0]) cap = c;
    if (cap && t - cap[0] < 160) {
      const n = Math.floor((t - cap[0]) / 2);
      drawText(cap[1].slice(0, n), W / 2, H - 14, 8, '#ffffff', 'center', null);
    }
    if (t > CRASH_END - 30) {
      ctx.fillStyle = `rgba(0,0,0,${clamp((t - CRASH_END + 30) / 30, 0, 1)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- Chapter 4: the wreckage ----------
  const WR_W = 1200, WF = 178, WR_MX = 1090;
  const WR_SOLIDS = [{ x: 210, w: 30, h: 16 }, { x: 360, w: 44, h: 28 }, { x: 520, w: 26, h: 14 }, { x: 650, w: 60, h: 32 }, { x: 830, w: 34, h: 22 }];
  const WR_HOLES = [[150, 70], [460, 90], [740, 60], [960, 80]];
  const WR_FIRES = [120, 300, 445, 600, 790, 1010];
  const WR_CABLES = [[90, 40], [270, 56], [420, 34], [580, 50], [720, 44], [900, 60], [1040, 38]];
  const wreck = { state: 'idle', t: 0, cam: 0 };
  const BM_LINES = [
    '...SYS...TEM... REBOOT...',
    'INTRUDER... DETECTED.',
    'THE CRASH... BROKE MOST OF MY PARTS.',
    'MY ARM... MY THRUSTERS... MY GLASS...',
    'BUT MY WEAPONS... STILL WORK.',
    'I WILL... KILL YOU, {NAME}.',
  ];
  const BM_AGAIN_LINES = ['TARGET... STILL... ALIVE.', 'RESUMING... ELIMINATION.'];

  function enterWreck() {
    game.mode = 'wreck';
    toast.t = 0;
    Object.assign(wreck, { state: 'idle', t: 0, cam: 0 });
    Object.assign(player, { x: 24, y: WF - player.h, vx: 0, vy: 0, face: 1, onGround: true, walk: 0 });
    showTitle('THE WRECKAGE', '- CHAPTER 4 -');
  }

  function fightBroken() {
    wreck.state = 'fight';
    startBattleTransition('brokenMech', winBroken, () => {
      Object.assign(wreck, { state: 'ready', t: 0 });
      Object.assign(player, { x: WR_MX - 200, y: WF - player.h, vx: 0, vy: 0, face: 1, onGround: true, walk: 0 });
    }, 'wreck');
  }

  function winBroken() {
    Object.assign(wreck, { state: 'broken', t: 0 });
    Object.assign(player, { x: WR_MX - 120, y: WF - player.h, vx: 0, vy: 0, face: 1, onGround: true, walk: 0 });
  }

  function updateWreck() {
    updateDialog();
    const w = wreck;
    w.t++;
    const locked = dialog.active || fade.dir !== 0 || inv.open || !['idle', 'ready', 'clear'].includes(w.state);
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
    player.x = clamp(player.x + player.vx, 8, w.state === 'clear' || w.state === 'leaving' ? WR_W - 12 : WR_MX - 44);
    for (const s of WR_SOLIDS) {
      const top = WF - s.h;
      if (player.y + player.h > top + 1 && player.x + player.w > s.x && player.x < s.x + s.w) {
        player.x = player.x + player.w / 2 < s.x + s.w / 2 ? s.x - player.w : s.x + s.w;
        player.vx = 0;
      }
    }
    const wasGround = player.onGround;
    const prevBottom = player.y + player.h;
    player.y += player.vy;
    player.onGround = false;
    let floor = WF;
    for (const s of WR_SOLIDS) {
      if (player.x + player.w > s.x && player.x < s.x + s.w && prevBottom <= WF - s.h + 0.5) floor = Math.min(floor, WF - s.h);
    }
    if (player.vy >= 0 && player.y + player.h >= floor) {
      player.y = floor - player.h;
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
    w.cam += (clamp(player.x - W / 2 + 40, 0, WR_W - W) - w.cam) * 0.12;

    if (w.state === 'idle' && !locked && player.x > WR_MX - 150) {
      w.state = 'boot';
      w.t = 0;
      player.vx = 0;
      player.face = 1;
      sfx('mechBoot');
    } else if (w.state === 'boot') {
      if (w.t % 20 === 0) sfx('spark');
      if (w.t === 70) sfx('glitch');
      if (w.t === 100) {
        w.state = 'talk';
        startDialog(BM_LINES, () => {
          w.state = 'pose';
          w.t = 0;
        }, 'BROKEN MECH');
      }
    } else if (w.state === 'pose') {
      if (w.t === 1) sfx('wreckIntro');
      if (w.t === 24) sfx('glitch');
      if (w.t === 44) sfx('crash');
      if (w.t === 230) fightBroken();
    } else if (w.state === 'ready' && !locked && player.x > WR_MX - 150) {
      w.state = 'again';
      player.vx = 0;
      player.face = 1;
      startDialog(BM_AGAIN_LINES, fightBroken, 'BROKEN MECH');
    } else if (w.state === 'broken') {
      if (w.t % 25 === 0 && w.t < 120) sfx('spark');
      if (w.t === 100) sfx('door');
      if (w.t === 150) {
        w.state = 'clear';
        w.t = 0;
      }
    } else if (w.state === 'clear' && !locked && player.x > WR_W - 34) {
      w.state = 'leaving';
      fadeThen(enterRuins);
    }
  }

  function drawWreckFlame(x, y, seed, s = 1) {
    for (let i = 0; i < 5; i++) {
      const h = (8 + hash(i * 3.3 + seed + Math.floor(tick / 4)) * 10) * s;
      const ox = (i - 2) * 3 * s;
      blob(Math.round(x + ox), Math.round(y - h * 0.4), Math.round(h * 0.4), '#c2202e');
      blob(Math.round(x + ox), Math.round(y - h * 0.35), Math.round(h * 0.3), '#ff6a2a');
      blob(Math.round(x + ox * 0.6), Math.round(y - h * 0.25), Math.round(h * 0.18), '#ffe14d');
    }
    for (let i = 0; i < 3; i++) {
      const q = ((tick * 0.02 + i / 3 + seed * 0.1) % 1);
      ctx.globalAlpha = (1 - q) * 0.4;
      blob(Math.round(x + Math.sin(q * 6 + seed) * 4), Math.round(y - 20 * s - q * 50), Math.round(4 + q * 8), '#2a2030');
    }
    ctx.globalAlpha = 1;
  }

  function drawMechScrap(x, y) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    blob(x, y - 4, 30, '#ff6a2a');
    ctx.restore();
    for (const [dx, dy, w, h, r, c] of [[-26, -8, 20, 10, -0.4, BMK.dark], [8, -10, 24, 12, 0.3, BMK.mid], [-8, -18, 22, 14, 0.1, BMK.mid], [18, -4, 14, 8, -0.2, BMK.blue], [-34, -3, 12, 6, 0.5, BMK.deep]]) {
      ctx.save();
      ctx.translate(x + dx, y + dy);
      ctx.rotate(r);
      bmBox(-w / 2, -h / 2, w, h, c);
      cRect(-w / 2 + 2, -1, w - 4, 1, hash(Math.floor(tick / 6) + dx) < 0.2 ? BMK.cyan : '#1e3a4a');
      ctx.restore();
    }
    cRect(x - 6, y - 30, 12, 6, BMK.out);
    cRect(x - 5, y - 29, 10, 4, '#1e3a4a');
    cRect(x - 2, y - 29, 2, 2, hash(Math.floor(tick / 5)) < 0.15 ? BMK.red : '#3a0a10');
    cRect(x + 14, y - 26, 3, 8, BMK.light);
    bmSparks(x - 12, y - 16, 61, 1.2);
    bmSparks(x + 10, y - 20, 62, 1);
    for (let i = 0; i < 4; i++) {
      const q = ((tick * 0.012 + i / 4) % 1);
      ctx.globalAlpha = (1 - q) * 0.5;
      blob(Math.round(x + Math.sin(q * 5 + i) * 6), Math.round(y - 24 - q * 70), Math.round(5 + q * 12), '#2a2030');
    }
    ctx.globalAlpha = 1;
  }

  function renderWreck() {
    const w = wreck;
    const cam = Math.round(w.cam);
    const shake = w.state === 'boot' && w.t > 60 ? (tick % 4 < 2 ? 1 : -1) : 0;
    ctx.save();
    ctx.translate(shake, 0);
    ctx.fillStyle = '#100a1c';
    ctx.fillRect(-4, 0, W + 8, H);
    for (let x = -(cam * 0.6) % 40; x < W; x += 40) {
      ctx.fillStyle = '#1a1230';
      ctx.fillRect(Math.round(x), 0, 18, WF);
      ctx.fillStyle = '#22183c';
      ctx.fillRect(Math.round(x) + 2, 0, 2, WF);
    }
    for (const [hx, hw] of WR_HOLES) {
      const sx = hx - cam;
      if (sx > W + 20 || sx + hw < -20) continue;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(sx, 30);
      ctx.lineTo(sx + hw * 0.3, 18);
      ctx.lineTo(sx + hw * 0.7, 26);
      ctx.lineTo(sx + hw, 20);
      ctx.lineTo(sx + hw - 6, 90);
      ctx.lineTo(sx + hw * 0.5, 104);
      ctx.lineTo(sx + 4, 86);
      ctx.closePath();
      ctx.save();
      ctx.clip();
      const g = ctx.createLinearGradient(0, 18, 0, 104);
      g.addColorStop(0, '#12041e');
      g.addColorStop(1, '#4a0a4a');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 4, 0, hw + 8, 110);
      drawBarrierGrid(10, 110, 0.5);
      ctx.restore();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#3a2a52';
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ff9a2e';
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(tick * 0.2 + hx);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#0a0614';
    ctx.fillRect(-4, 0, W + 8, 12);
    for (let x = -(cam % 60); x < W; x += 60) {
      ctx.fillStyle = '#2a2040';
      ctx.fillRect(Math.round(x), 12, 30, 4);
    }
    for (const [cx0, len] of WR_CABLES) {
      const sx = cx0 - cam;
      if (sx < -30 || sx > W + 30) continue;
      const sw = Math.sin(tick * 0.04 + cx0) * 4;
      ctx.strokeStyle = '#140a24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, 12);
      ctx.quadraticCurveTo(sx + sw * 0.5, 12 + len * 0.5, sx + sw, 12 + len);
      ctx.stroke();
      cRect(Math.round(sx + sw) - 1, 12 + len, 3, 3, '#ff9a2e');
      bmSparks(sx + sw, 14 + len, cx0 * 0.01, 1);
    }
    ctx.save();
    ctx.translate(-cam, 0);
    for (let i = 0; i < 14; i++) {
      const x = i * 90 + 30;
      const on = hash(Math.floor(tick / 7) + i * 4.1) < 0.35;
      ctx.fillStyle = '#140a24';
      ctx.fillRect(x - 6, 120, 12, 6);
      ctx.fillStyle = on ? '#ff2a3a' : '#3a0a10';
      ctx.fillRect(x - 5, 121, 10, 4);
      if (on) {
        ctx.save();
        ctx.globalAlpha = 0.15;
        blob(x, 124, 18, '#ff2a3a');
        ctx.restore();
      }
    }
    for (const fx of WR_FIRES) drawWreckFlame(fx, WF, fx * 0.1);
    for (const s of WR_SOLIDS) {
      const top = WF - s.h;
      bmBox(s.x, top, s.w, s.h, '#3a3456', '#6a6488');
      cRect(s.x + 3, top + 4, s.w - 6, 1, '#1a1430');
      cRect(s.x + s.w - 8, top + 2, 4, 3, hash(Math.floor(tick / 8) + s.x) < 0.3 ? BMK.cyan : '#1e3a4a');
      bmSparks(s.x + s.w - 4, top, s.x * 0.03, 0.6);
    }
    if (['broken', 'clear', 'leaving'].includes(w.state)) {
      const open = w.state === 'broken' ? clamp((w.t - 100) / 40, 0, 1) : 1;
      const ex = WR_W - 40;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ex, WF);
      ctx.lineTo(ex + 4, WF - 70 * open);
      ctx.lineTo(ex + 16, WF - 86 * open);
      ctx.lineTo(ex + 32, WF - 74 * open);
      ctx.lineTo(ex + 40, WF - 90 * open);
      ctx.lineTo(ex + 40, WF);
      ctx.closePath();
      ctx.clip();
      const g = ctx.createLinearGradient(0, WF - 90, 0, WF);
      g.addColorStop(0, '#2a0a3a');
      g.addColorStop(1, '#ff3eb0');
      ctx.fillStyle = g;
      ctx.fillRect(ex, WF - 90, 40, 90);
      ctx.fillStyle = 'rgba(95,240,255,0.5)';
      for (let i = 0; i < 6; i++) ctx.fillRect(ex + ((i * 13 + tick) % 40), WF - 90 + ((i * 29) % 80), 6, 1);
      ctx.restore();
      ctx.strokeStyle = '#ff9a2e';
      ctx.lineWidth = 1;
      ctx.strokeRect(ex + 0.5, WF - 90 * open + 0.5, 39, 90 * open);
      bmSparks(ex + 2, WF - 60 * open, 88, 1);
      if (w.state === 'clear' && tick % 40 < 26) drawText('>', ex + 20, WF - 104, 16, '#ffe14d', 'center', '#140a24');
      drawMechScrap(WR_MX, WF);
    } else {
      const k = w.state === 'idle' ? 0 : w.state === 'boot' ? clamp(w.t / 100, 0, 1) : 1;
      if (w.state === 'idle' && player.x > WR_MX - 400) bmSparks(WR_MX - 10, WF - 30, 77, 1);
      drawBrokenMech(WR_MX, WF, 0.8, -1, { power: 0.15 + k * 0.85, slump: 1 - k });
      if (w.state === 'boot') {
        if (w.t < 90 && w.t % 30 < 15) drawText('REBOOT ' + Math.min(100, Math.floor(w.t)) + '%', WR_MX, WF - 74, 8, BMK.cyan, 'center', BMK.out);
        if (w.t > 60) bmSparks(WR_MX, WF - 40, 78, 1.6);
      }
      if (w.state === 'ready' && tick % 60 < 40) drawText('!', WR_MX - 6, WF - 72, 8, '#ff2a3a', 'center', BMK.out);
    }
    ctx.fillStyle = '#2a2040';
    ctx.fillRect(0, WF, WR_W, H - WF);
    ctx.fillStyle = '#4a3a66';
    ctx.fillRect(0, WF, WR_W, 1);
    for (let x = 0; x < WR_W; x += 24) {
      ctx.fillStyle = '#1a1430';
      ctx.fillRect(x, WF, 1, H - WF);
      if (hash(x) < 0.3) cRect(x + 6, WF + 4, 10, 2, '#140a24');
    }
    let frame = 0;
    if (!player.onGround) frame = 1;
    else if (player.walk > 0) frame = walkFrame(player.walk);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(Math.round(player.x), Math.round(player.y + player.h) - 1, player.w, 1);
    drawImg(playerFrames[frame], player.x - 2, player.y, player.face);
    ctx.restore();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#ffffff';
    for (let sy = tick % 4; sy < H; sy += 4) ctx.fillRect(0, sy, W, 1);
    ctx.restore();
    if (hash(Math.floor(tick / 5) * 3.9) < 0.06 || (w.state === 'boot' && w.t > 60)) crashGlitchSlices(0.3);

    if (w.state === 'pose') {
      ctx.save();
      if (w.t >= 44 && w.t < 60) ctx.translate(w.t % 2 ? 3 : -3, 0);
      renderWreckIntro(w.t);
      ctx.restore();
    } else {
      drawDialog();
      drawTitle();
      drawToast();
      if (canOpenInventory() || inv.open) drawBagButton();
      if (inv.open) drawInventory();
    }
  }

  function renderWreckIntro(t) {
    const k = clamp(t / 12, 0, 1);
    const cx = W / 2;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = '#0a0414';
    ctx.fillRect(0, 0, W, H);
    drawBarrierGrid(0, H, 0.25);
    for (let i = 0; i < 12; i++) {
      const y = (i * 23 + t * 3) % H;
      ctx.fillStyle = i % 2 ? 'rgba(255,42,58,0.25)' : 'rgba(95,240,255,0.2)';
      ctx.fillRect(0, Math.round(y), W, 1 + (i % 3));
    }
    for (let i = 0; i < 90; i++) {
      const a = i * 2.39996;
      const d = (t * (2 + (i % 4)) + i * 41) % 280;
      ctx.strokeStyle = i % 3 ? '#ff2a3a' : '#5ff0ff';
      ctx.globalAlpha = k * Math.min(1, d / 60) * 0.7;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * d, 100 + Math.sin(a) * d * 0.6);
      ctx.lineTo(cx + Math.cos(a) * (d + 4 + d * 0.1), 100 + Math.sin(a) * (d + 4 + d * 0.1) * 0.6);
      ctx.stroke();
    }
    ctx.globalAlpha = k;
    const rise = Math.pow(clamp(1 - t / 20, 0, 1), 2) * 80;
    ctx.save();
    ctx.globalAlpha = k * 0.3;
    blob(cx, H - 70 + rise, 70, BMK.red);
    ctx.restore();
    drawBrokenMech(cx, H + 40 + rise, 2.5, -1, { power: 1, rage: t > 40 && t % 16 < 8 ? 1 : 0 });
    for (const [ox, oy, sd] of [[-50, -110, 91], [40, -70, 92], [-20, -150, 93]]) bmSparks(cx + ox, H + oy + rise, sd, 1.6);
    if (t >= 20) {
      const subX = cx - Math.pow(clamp(1 - (t - 20) / 14, 0, 1), 2) * 400;
      for (let d = 4; d >= 1; d--) drawText('SYSTEM CORRUPTED', subX + d, 20 + d, 16, '#3a0a14', 'center', null);
      drawText('SYSTEM CORRUPTED', subX, 20, 16, '#ffffff', 'center', null);
    }
    if (t >= 40) {
      const slam = Math.max(0, 1 - (t - 40) / 6);
      const rg = hash(Math.floor(t / 3) * 1.7) < 0.35 ? 4 : 1;
      ctx.save();
      ctx.translate(cx, 64);
      ctx.scale(1 + slam * 0.8, 1 + slam * 0.8);
      for (let d = 6; d >= 1; d--) drawText('BROKEN MECH', d, -16 + d, 32, '#140a24', 'center', null);
      ctx.globalAlpha = 0.8;
      drawText('BROKEN MECH', -rg, -16, 32, '#ff2a3a', 'center', null);
      drawText('BROKEN MECH', rg, -16, 32, BMK.cyan, 'center', null);
      ctx.globalAlpha = 1;
      drawText('BROKEN MECH', 0, -16, 32, '#ffffff', 'center', null);
      ctx.restore();
      if (t < 46) {
        ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - (t - 40) / 6)})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
    ctx.restore();
    if (t > 40 && hash(Math.floor(t / 4) * 2.3) < 0.3) crashGlitchSlices(0.5);
    if (t > 206) {
      ctx.fillStyle = `rgba(0,0,0,${clamp((t - 206) / 20, 0, 1)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- Chapter 5: the castle ruins ----------
  const RU_W = 900, RF = 182, RU_CX = 760, RU_TRIGGER = 540, RU_MAX_X = 610;
  const RU_SOLIDS = [{ x: 190, w: 30, h: 14 }, { x: 340, w: 42, h: 24 }];
  const RU_FS = 1.3;
  const ruins = { state: 'walk', t: 0, cam: 0 };
  const FORGER_LINES = [
    '...',
    'WHO... DARES... DISTURB MY RUINS?',
    'THIS CASTLE WAS ONCE MY PRISON.',
    'A THOUSAND YEARS I SLEPT INSIDE ITS WALLS.',
    'THEN THE SKY FELL... AND THE WORLD BROKE.',
    'THE GLITCH CRACKED MY TOMB WIDE OPEN.',
    'I TORE THESE STONES FROM THE EARTH...',
    '...AND FORGED THEM INTO MY SOUL.',
    'I REMEMBER YOU, {NAME}.',
    'YOU WALKED THESE HALLS. YOU BEAT THE KING.',
    'NOW THE CASTLE ITSELF... WILL BURY YOU.',
  ];
  const FORGER_AGAIN_LINES = ['YOU CRAWL BACK TO YOUR GRAVE, {NAME}?', 'THE STONES REMEMBER YOUR SCREAMS.'];
  const FORGER_DEATH_LINES = [
    '...GRRAAAAAAAHHH...',
    'NO... MY WALLS... MY THOUSAND WALLS...',
    'EVERY STONE I FORGED HELD A STOLEN SOUL.',
    'AND YOU SHATTERED THEM. ONE. BY. ONE.',
    'DO YOU HEAR THEM, {NAME}?',
    'THEY ARE SCREAMING...',
    '...NO. THEY ARE LAUGHING.',
    'THEY ARE FREE... AND I AM NOTHING.',
    'BUT HEAR ME, CHILD OF THE BROKEN WORLD...',
    'I AM NOT THE ONE WHO HACKED THIS PLACE.',
    'THE BARRIER... THE GLITCH... HAS A MASTER.',
    'AND IT HAS WATCHED YOU... FROM THE START.',
    'THE DEATH OF GHOSTS IS ONLY THE FIRST...',
    '...DEATH.',
  ];

  function enterRuins() {
    game.mode = 'ruins';
    toast.t = 0;
    Object.assign(ruins, { state: 'walk', t: 0, cam: 0 });
    Object.assign(player, { x: 24, y: RF - player.h, vx: 0, vy: 0, face: 1, onGround: true, walk: 0 });
    showTitle('THE CASTLE RUINS', '- CHAPTER 5 -');
  }

  function fightForger() {
    ruins.state = 'fight';
    startBattleTransition('thousandForger', winForger, () => {
      Object.assign(ruins, { state: 'ready', t: 0, cam: RU_W - W });
      Object.assign(player, { x: RU_W - W + 40, y: RF - player.h, vx: 0, vy: 0, face: 1, onGround: true, walk: 0 });
    }, 'ruins');
  }

  function winForger() {
    Object.assign(ruins, { state: 'dying', t: 0, cam: RU_W - W });
    Object.assign(player, { x: RU_TRIGGER, y: RF - player.h, vx: 0, vy: 0, face: 1, onGround: true, walk: 0 });
    startDialog(FORGER_DEATH_LINES, () => {
      ruins.state = 'dissolve';
      ruins.t = 0;
    }, 'THOUSAND FORGER');
  }

  function updateRuins() {
    updateDialog();
    const r = ruins;
    r.t++;
    const free = r.state === 'walk' || r.state === 'ready';
    const locked = dialog.active || fade.dir !== 0 || inv.open || !free;
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
    player.x = clamp(player.x + player.vx, r.state === 'walk' ? 8 : RU_W - W + 8, RU_MAX_X);
    for (const s of RU_SOLIDS) {
      const top = RF - s.h;
      if (player.y + player.h > top + 1 && player.x + player.w > s.x && player.x < s.x + s.w) {
        player.x = player.x + player.w / 2 < s.x + s.w / 2 ? s.x - player.w : s.x + s.w;
        player.vx = 0;
      }
    }
    const wasGround = player.onGround;
    const prevBottom = player.y + player.h;
    player.y += player.vy;
    player.onGround = false;
    let floor = RF;
    for (const s of RU_SOLIDS) {
      if (player.x + player.w > s.x && player.x < s.x + s.w && prevBottom <= RF - s.h + 0.5) floor = Math.min(floor, RF - s.h);
    }
    if (player.vy >= 0 && player.y + player.h >= floor) {
      player.y = floor - player.h;
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
    const camT = r.state === 'walk' ? clamp(player.x - W / 2 + 40, 0, RU_W - W) : RU_W - W;
    r.cam += (camT - r.cam) * (r.state === 'walk' ? 0.12 : 0.06);

    if (r.state === 'walk' && !locked && player.x > RU_TRIGGER) {
      r.state = 'rumble';
      r.t = 0;
      player.vx = 0;
      player.face = 1;
      sfx('rumble');
    } else if (r.state === 'rumble') {
      if (r.t % 30 === 0) sfx('rumble');
      if (r.t % 40 === 25) sfx('boom');
      if (r.t === 100) sfx('ghostWail');
      if (r.t === 160) {
        r.state = 'explode';
        r.t = 0;
        sfx('castleBoom');
      }
    } else if (r.state === 'explode') {
      if (r.t === 36) {
        r.state = 'appear';
        r.t = 0;
        sfx('ghostAppear');
      }
    } else if (r.state === 'appear') {
      if (r.t === 50) {
        r.state = 'talk';
        startDialog(FORGER_LINES, () => {
          r.state = 'pose';
          r.t = 0;
        }, '???');
      }
    } else if (r.state === 'pose') {
      if (r.t === 1) sfx('forgerIntro');
      if (r.t === 24) sfx('ghostWail');
      if (r.t === 44) sfx('crash');
      if (r.t === 230) fightForger();
    } else if (r.state === 'ready' && !locked && player.x > RU_MAX_X - 10) {
      r.state = 'again';
      player.vx = 0;
      player.face = 1;
      startDialog(FORGER_AGAIN_LINES, fightForger, 'THOUSAND FORGER');
    } else if (r.state === 'dying') {
      if (r.t % 90 === 45) sfx('glitch');
    } else if (r.state === 'dissolve') {
      if (r.t === 1) sfx('crumble');
      if (r.t % 18 === 0 && r.t < 150) sfx('boom');
      if (r.t === 60) sfx('ghostWail');
      if (r.t === 150) sfx('ghostDeath');
      if (r.t === 260) {
        r.state = 'gone';
        fadeThen(enterGlitchRoad);
      }
    } else if (r.state === 'outro') {
      if (r.t === 330) {
        fadeThen(() => {
          game.mode = 'eye';
          eye.phase = 'end';
          eye.t = 0;
        });
      }
    }
  }

  function drawRuinCastle(cx, floor, crack) {
    const glowLine = (x0, y0, x1, y1) => {
      pxLine(x0, y0, x1, y1, FGK.out);
      if (crack > 0) {
        ctx.save();
        ctx.globalAlpha = crack;
        pxLine(x0 + 1, y0, x1 + 1, y1, FGK.eye);
        ctx.restore();
      }
    };
    fgBricks(cx - 130, floor - 80, 260, 80, FGK.mid);
    for (let i = 0; i < 13; i++) if (i % 4 !== 3) fgBricks(cx - 128 + i * 20, floor - 87, 12, 7, FGK.mid);
    fgBricks(cx - 150, floor - 132, 40, 132, FGK.stone);
    for (const [ox, h] of [[0, 10], [10, 4], [18, 14], [30, 7]]) fgBricks(cx - 150 + ox, floor - 132 - h, 9, h, FGK.stone);
    fgBricks(cx + 108, floor - 170, 40, 170, FGK.stone);
    ctx.fillStyle = FGK.out;
    ctx.beginPath();
    ctx.moveTo(cx + 104, floor - 169);
    ctx.lineTo(cx + 152, floor - 169);
    ctx.lineTo(cx + 136, floor - 204);
    ctx.lineTo(cx + 126, floor - 192);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = FGK.roof;
    ctx.beginPath();
    ctx.moveTo(cx + 107, floor - 170);
    ctx.lineTo(cx + 149, floor - 170);
    ctx.lineTo(cx + 135, floor - 200);
    ctx.lineTo(cx + 126, floor - 189);
    ctx.closePath();
    ctx.fill();
    fgBricks(cx - 54, floor - 140, 108, 140, FGK.stone);
    for (let i = 0; i < 6; i++) if (i !== 2) fgBricks(cx - 54 + i * 19, floor - 149, 12, 9, FGK.stone);
    for (const [wx, wy] of [[cx - 30, floor - 118], [cx + 22, floor - 118], [cx - 4, floor - 96], [cx - 136, floor - 110], [cx + 122, floor - 140]]) {
      cRect(wx - 1, wy - 1, 10, 16, FGK.out);
      cRect(wx, wy, 8, 14, crack > 0 && hash(Math.floor(tick / 5) + wx) < 0.5 + crack * 0.5 ? FGK.eye : '#1a1428');
    }
    cRect(cx - 18, floor - 44, 36, 44, FGK.out);
    blob(cx, floor - 44, 18, FGK.out);
    for (let i = 0; i < 9; i++) fgBricks(cx - 26 + ((i * 13) % 50), floor - 8 - (i % 3) * 6, 8 + (i % 3) * 3, 6, i % 2 ? FGK.mid : FGK.dark);
    for (const [bx, torn] of [[cx - 44, 0], [cx + 34, 1]]) {
      cRect(bx, floor - 136, 10, torn ? 18 : 30, FGK.flag);
      cRect(bx, floor - 136, 10, 2, FGK.gold);
      cRect(bx + 4, floor - 124, 2, 2, FGK.gold);
      if (torn) cRect(bx + 2, floor - 118, 6, 3, FGK.flag);
    }
    glowLine(cx - 10, floor - 140, cx + 4, floor - 110);
    glowLine(cx + 4, floor - 110, cx - 6, floor - 76);
    glowLine(cx - 6, floor - 76, cx + 8, floor - 50);
    glowLine(cx - 140, floor - 100, cx - 124, floor - 70);
    glowLine(cx + 120, floor - 150, cx + 132, floor - 120);
    glowLine(cx + 60, floor - 60, cx + 90, floor - 40);
    if (crack > 0) {
      ctx.save();
      ctx.globalAlpha = crack * (0.25 + 0.15 * Math.sin(tick * 0.3));
      blob(cx, floor - 90, 40 + crack * 30, FGK.ghostMid);
      ctx.restore();
    }
  }

  function drawRuinBase(cx, floor) {
    for (const [ox, w, h] of [[-150, 40, 34], [-110, 30, 14], [-60, 50, 22], [0, 40, 12], [50, 50, 26], [108, 40, 40]]) fgBricks(cx + ox, floor - h, w, h, FGK.dark);
  }

  function renderRuins() {
    const r = ruins, cam = Math.round(r.cam);
    let shake = 0;
    if (r.state === 'rumble') shake = 1 + r.t / 40;
    else if (r.state === 'explode') shake = Math.max(1, 10 - r.t / 6);
    else if (r.state === 'appear') shake = Math.max(0, 8 - r.t / 5);
    else if (r.state === 'dissolve' && r.t < 150) shake = 1 + r.t / 50;
    ctx.save();
    if (shake) ctx.translate(Math.round((Math.random() - 0.5) * shake * 2), Math.round((Math.random() - 0.5) * shake));
    const g = ctx.createLinearGradient(0, 0, 0, RF);
    g.addColorStop(0, '#0c0418');
    g.addColorStop(1, '#3a0e3a');
    ctx.fillStyle = g;
    ctx.fillRect(-10, -10, W + 20, H + 20);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = i % 3 ? '#5ff0ff' : '#ff3eb0';
      ctx.fillRect((i * 97 - cam * 0.05 + W * 4) % W, (i * 41) % 100, 1, hash(i + Math.floor(tick / 30)) < 0.5 ? 1 : 2);
    }
    drawBarrierGrid(0, 96, 0.3);
    ctx.fillStyle = '#1c0a26';
    ctx.beginPath();
    ctx.moveTo(0, RF);
    for (let x = 0; x <= W; x += 12) ctx.lineTo(x, RF - 40 - Math.sin((x + cam * 0.25) * 0.02) * 14 - Math.sin((x + cam * 0.25) * 0.05) * 6);
    ctx.lineTo(W, RF);
    ctx.fill();
    for (let i = 0; i < 9; i++) {
      const tx = ((i * 113 - cam * 0.55) % (W + 100) + W + 100) % (W + 100) - 50;
      ctx.fillStyle = '#120618';
      ctx.fillRect(Math.round(tx), RF - 50, 3, 50);
      pxLine(tx + 1, RF - 40, tx - 9, RF - 52, '#120618');
      pxLine(tx + 1, RF - 34, tx + 10, RF - 46, '#120618');
    }

    ctx.save();
    ctx.translate(-cam, 0);
    ctx.fillStyle = '#2a2236';
    ctx.fillRect(0, RF, RU_W, H - RF);
    ctx.fillStyle = '#4a3e5a';
    ctx.fillRect(0, RF, RU_W, 1);
    for (let x = 0; x < RU_W; x += 18) if (hash(x * 0.37) < 0.4) cRect(x, RF + 4 + Math.floor(hash(x) * 20), 8, 1, '#1a1424');
    for (const [x, w] of [[90, 8], [260, 10], [430, 7], [500, 9]]) fgBricks(x, RF - 5, w, 5, FGK.dark);
    fgBricks(120, RF - 26, 4, 26, '#5a3a2a');
    ctx.save();
    ctx.translate(122, RF - 26);
    ctx.rotate(0.18);
    cRect(-18, -8, 40, 12, '#1a1020');
    cRect(-17, -7, 38, 10, '#8a5a3a');
    drawText('CASTLE', 2, -6, 8, '#2a1408', 'center', null);
    ctx.restore();
    for (const s of RU_SOLIDS) {
      fgBricks(s.x, RF - s.h, s.w, s.h, FGK.mid);
      fgBricks(s.x + 4, RF - s.h - 4, s.w - 10, 4, FGK.stone);
    }
    const castleUp = r.state === 'walk' || r.state === 'rumble';
    if (castleUp) {
      const k = r.state === 'rumble' ? r.t / 160 : 0;
      ctx.save();
      if (k > 0) ctx.translate(Math.round((Math.random() - 0.5) * k * 6), 0);
      drawRuinCastle(RU_CX, RF, k);
      ctx.restore();
      if (r.state === 'rumble') {
        for (let i = 0; i < 12; i++) {
          const p = ((r.t * (0.02 + (i % 3) * 0.01) + i / 12) % 1);
          cRect(Math.round(RU_CX - 140 + hash(i * 3.3) * 280), Math.round(RF - 200 + p * 200), 3, 3, i % 2 ? FGK.mid : FGK.stone);
        }
      }
    } else {
      drawRuinBase(RU_CX, RF);
    }
    for (const fx of [RU_CX - 160, RU_CX - 70, RU_CX + 60, RU_CX + 150, 300, 470]) drawWreckFlame(fx, RF, fx * 0.07, 0.8);
    ctx.restore();

    if (r.state === 'explode') {
      const t = r.t;
      const ox = RU_CX - cam;
      if (t < 30) {
        ctx.save();
        ctx.globalAlpha = 1 - t / 30;
        blob(ox, RF - 80, 30 + t * 5, '#ff9a2e');
        blob(ox, RF - 80, 20 + t * 4, '#ffe14d');
        blob(ox, RF - 80, 10 + t * 3, '#ffffff');
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = clamp((t - 10) / 20, 0, 0.6);
      ctx.fillStyle = FGK.ghostMid;
      ctx.fillRect(ox - 40, 0, 80, RF);
      ctx.restore();
    }
    if (['explode', 'appear', 'talk', 'pose', 'fight'].includes(r.state)) {
      const t = r.state === 'explode' ? r.t : 36 + (r.state === 'appear' ? r.t : 60);
      for (let i = 0; i < 26; i++) {
        const vx = (hash(i * 4.7) - 0.5) * 9, vy = -3 - hash(i * 2.9) * 6;
        const x = RU_CX - cam + (hash(i * 1.7) - 0.5) * 220 + vx * t, y = RF - 40 - hash(i * 8.3) * 130 + vy * t + 0.22 * t * t;
        if (y > H + 20) continue;
        ctx.save();
        ctx.translate(Math.round(x), Math.round(y));
        ctx.rotate(t * (hash(i * 6.2) - 0.5) * 0.3);
        const w = 6 + Math.floor(hash(i * 8.8) * 12), h = 5 + Math.floor(hash(i * 3.3) * 8);
        fgBricks(-w / 2, -h / 2, w, h, i % 3 ? FGK.stone : FGK.mid);
        ctx.restore();
      }
    }
    const fx = RU_CX - cam, fb = RF + 4;
    if (['appear', 'talk', 'pose', 'fight', 'ready', 'again'].includes(r.state)) {
      drawForger(fx, fb, RU_FS, { open: r.state === 'appear' && r.t < 20 ? 1 : 0, scream: r.state === 'appear' && r.t < 40 });
    } else if (r.state === 'dying') {
      const flick = hash(Math.floor(tick / 3)) < 0.15 ? 0.4 : 0.85;
      drawForger(fx + (tick % 6 < 3 ? 1 : -1), fb, RU_FS, { broken: true, open: 1, alpha: flick, scream: dialog.active && dialog.chars < dialog.lines[dialog.line].length });
      bmSparks(fx - 20, fb - 90, 101, 0.8);
    } else if (r.state === 'dissolve' && r.t < 150) {
      const k = r.t / 150;
      drawForger(fx + Math.round((Math.random() - 0.5) * k * 8), fb, RU_FS, { broken: true, open: 1, alpha: 1 - k * 0.4, crumble: 0.3 + k * 0.7, scream: true });
    }
    if (r.state === 'dissolve') {
      for (let i = 0; i < 30; i++) {
        const p = ((r.t * (0.006 + (i % 5) * 0.002) + i / 30) % 1);
        ctx.save();
        ctx.globalAlpha = (1 - p) * clamp(r.t / 30, 0, 1);
        drawGhostSkull(fx + (hash(i * 3.1) - 0.5) * 200 + Math.sin(p * 8 + i) * 8, RF - 20 - p * 200, 1 + (i % 3) * 0.4, 1);
        ctx.restore();
      }
      if (r.t >= 150 && r.t < 175) {
        ctx.fillStyle = `rgba(232,255,248,${1 - (r.t - 150) / 25})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    let frame = 0;
    if (!player.onGround) frame = 1;
    else if (player.walk > 0) frame = walkFrame(player.walk);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(Math.round(player.x - cam), Math.round(player.y + player.h) - 1, player.w, 1);
    drawImg(playerFrames[frame], player.x - 2 - cam, player.y, player.face);
    if (r.state === 'rumble' && r.t > 20 && r.t < 70) drawText('!', player.x - cam + 5, player.y - 14, 8, '#ffe14d', 'center', '#1a1420');
    if (r.state === 'ready' && tick % 60 < 40) drawText('!', fx, 12, 8, FGK.eye, 'center', FGK.out);
    ctx.restore();

    if (r.state === 'appear' && r.t < 8) {
      ctx.fillStyle = `rgba(232,255,248,${0.9 - r.t * 0.1})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#ffffff';
    for (let sy = tick % 4; sy < H; sy += 4) ctx.fillRect(0, sy, W, 1);
    ctx.restore();
    if (hash(Math.floor(tick / 5) * 2.9) < 0.07 || r.state === 'explode' || (r.state === 'appear' && r.t < 30)) crashGlitchSlices(r.state === 'walk' ? 0.3 : 0.8);

    if (r.state === 'outro') {
      const k = clamp((r.t - 60) / 40, 0, 1);
      ctx.fillStyle = `rgba(0,0,0,${k})`;
      ctx.fillRect(0, 0, W, H);
      if (r.t > 110) {
        const text = 'TO BE CONTINUED...';
        drawText(text.slice(0, Math.floor((r.t - 110) / 4)), W / 2, H / 2 - 8, 16, '#ffe14d', 'center', '#5a3a1a');
      }
    }
    if (r.state === 'pose') {
      ctx.save();
      if (r.t >= 44 && r.t < 60) ctx.translate(r.t % 2 ? 3 : -3, 0);
      renderForgerIntro(r.t);
      ctx.restore();
    } else if (r.state !== 'outro') {
      drawDialog();
      drawTitle();
      drawToast();
      if (canOpenInventory() || inv.open) drawBagButton();
      if (inv.open) drawInventory();
    }
  }

  function renderForgerIntro(t) {
    const k = clamp(t / 12, 0, 1);
    const cx = W / 2;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = '#06040e';
    ctx.fillRect(0, 0, W, H);
    drawBarrierGrid(0, H, 0.16);
    for (let i = 0; i < 14; i++) {
      const a = i * 0.449 + t * 0.008;
      ctx.globalAlpha = k * 0.1;
      ctx.fillStyle = i % 2 ? FGK.eye : '#ff3eb0';
      ctx.beginPath();
      ctx.moveTo(cx, 130);
      ctx.lineTo(cx + Math.cos(a - 0.08) * 400, 130 + Math.sin(a - 0.08) * 400);
      ctx.lineTo(cx + Math.cos(a + 0.08) * 400, 130 + Math.sin(a + 0.08) * 400);
      ctx.fill();
    }
    ctx.globalAlpha = k;
    for (let i = 0; i < 6; i++) {
      ctx.globalAlpha = k * 0.12;
      blob(Math.round(((i * 83 + t * 0.8) % (W + 60)) - 30), 190 - (i % 3) * 10, 28, FGK.ghostDeep);
    }
    ctx.globalAlpha = k;
    const rise = Math.pow(clamp(1 - t / 20, 0, 1), 2) * 90;
    drawForger(cx, H + 120 + rise, 1.9, { open: t > 40 ? clamp((t - 40) / 10, 0, 1) : 0, scream: t > 40 && t < 140, glitch: false });
    if (t >= 20) {
      const subX = cx - Math.pow(clamp(1 - (t - 20) / 14, 0, 1), 2) * 400;
      for (let d = 4; d >= 1; d--) drawText('DEATH OF GHOSTS', subX + d, 10 + d, 16, '#0a2a20', 'center', null);
      drawText('DEATH OF GHOSTS', subX, 10, 16, '#e8fff8', 'center', null);
    }
    if (t >= 40) {
      const slam = Math.max(0, 1 - (t - 40) / 6);
      const rg = hash(Math.floor(t / 3) * 1.7) < 0.35 ? 4 : 1;
      for (const [word, y] of [['THOUSAND', 46], ['FORGER', 80]]) {
        ctx.save();
        ctx.translate(cx, y);
        ctx.scale(1 + slam * 0.8, 1 + slam * 0.8);
        for (let d = 6; d >= 1; d--) drawText(word, d, -16 + d, 32, FGK.out, 'center', null);
        ctx.globalAlpha = 0.8;
        drawText(word, -rg, -16, 32, '#ff3eb0', 'center', null);
        drawText(word, rg, -16, 32, '#5ff0ff', 'center', null);
        ctx.globalAlpha = 1;
        drawText(word, 0, -16, 32, FGK.eye, 'center', null);
        ctx.restore();
      }
      if (t < 46) {
        ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - (t - 40) / 6)})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
    ctx.restore();
    if (t > 40 && hash(Math.floor(t / 4) * 2.3) < 0.3) crashGlitchSlices(0.5);
    if (t > 206) {
      ctx.fillStyle = `rgba(0,0,0,${clamp((t - 206) / 20, 0, 1)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- The Glitch: battle visuals ----------
  const GK_EYE = [6, 4];

  function drawGlitchSprite(img, cx, bottom, sc, face, amt, seed = 0) {
    const w = img.width * sc, h = img.height * sc;
    const x = Math.round(cx - w / 2), y = Math.round(bottom - h);
    const T = Math.floor(tick / 3) + seed * 13;
    const rg = Math.max(1, Math.round(sc * (hash(T * 1.3) < amt * 0.6 ? 1.6 : 0.6)));
    const A = ctx.globalAlpha;
    ctx.globalAlpha = A * 0.55;
    drawImg(tinted(img, '#ff3eb0'), x - rg, y, face, sc);
    drawImg(tinted(img, '#5ff0ff'), x + rg, y, face, sc);
    ctx.globalAlpha = A * (hash(T * 0.7) < amt * 0.06 ? 0.7 : 1);
    drawImg(img, x, y, face, sc);
    ctx.globalAlpha = A;
    if (hash(T * 2.7 + seed) < amt) {
      for (let i = 0; i < 2; i++) {
        const sy = y + Math.floor(hash(T * 3.1 + i) * h), sh = Math.max(2, Math.floor(hash(T * 4.3 + i) * sc * 3));
        const dx = Math.round((hash(T * 5.7 + i) - 0.5) * sc * 6);
        ctx.drawImage(cvs, x - sc * 2, sy, w + sc * 4, sh, x - sc * 2 + dx, sy, w + sc * 4, sh);
      }
    }
    for (let i = 0; i < Math.round(amt * 5); i++) {
      cRect(Math.round(x + hash(T + i * 1.7) * w), Math.round(y + hash(T + i * 2.9) * h), Math.max(1, sc), Math.max(1, Math.round(sc / 2)), ['#ff3eb0', '#5ff0ff', '#000000'][i % 3]);
    }
    return { x, y, w, h };
  }

  function drawGlitchKid(cx, bottom, sc, face, amt = 0.35, blink = false) {
    const img = blink ? npcBlink : npcFrames[0];
    const A = ctx.globalAlpha;
    ctx.globalAlpha = A * (0.22 + 0.08 * Math.sin(tick * 0.1));
    blob(Math.round(cx), Math.round(bottom - img.height * sc * 0.5), Math.round(img.height * sc * 0.6), '#3a0a4a');
    ctx.globalAlpha = A;
    const r = drawGlitchSprite(img, cx, bottom + sc, sc, face, amt, 7);
    if (!blink) {
      const ex = face < 0 ? img.width - 1 - GK_EYE[0] : GK_EYE[0];
      const px = r.x + ex * sc, py = r.y + GK_EYE[1] * sc;
      ctx.globalAlpha = A * 0.5;
      blob(Math.round(px + sc / 2), Math.round(py + sc / 2), Math.max(1, Math.round(sc * 1.6)), '#5ff0ff');
      ctx.globalAlpha = A;
      cRect(px, py, sc, sc, hash(Math.floor(tick / 5)) < 0.85 ? '#5ff0ff' : '#ffffff');
    }
  }

  function glitchKidPose(b, e) {
    const anim = e && e.type === 'hit' && e.who === 'enemy' ? e.move.anim : null;
    const lt = b.t;
    const o = { dx: 0, dy: 0, hide: false, amt: 0.35, blink: b.introT % 160 < 8 };
    if (anim === 'gpunch') {
      if (lt < GP_GLITCH) o.dx = Math.round(fgEase(lt / GP_GLITCH) * 34);
      else if (lt < GP_END - 14) o.dx = 34;
      else o.dx = Math.round(34 * (1 - (lt - (GP_END - 14)) / 14));
      if (lt >= GP_GLITCH && lt < GP_FIRE + 4) o.amt = 1;
    } else if (anim === 'afterimg') {
      o.hide = lt >= 24 && lt < AI_END - 8;
      o.amt = lt < 24 ? 1 : 0.6;
    } else if (anim === 'ginferno') {
      o.amt = 0.8;
    } else if (anim === 'gdomain') {
      if (lt < 6) o.dy = 3;
      else if (lt < 22) o.dy = -Math.round(Math.pow((lt - 6) / 16, 2) * 160);
      else if (lt < GD_END - 22) o.hide = true;
      else if (lt < GD_END - 6) o.dy = -Math.round(Math.pow(1 - (lt - (GD_END - 22)) / 16, 2) * 160);
    } else if (e && e.type === 'shatter') {
      o.amt = Math.min(1, 0.4 + lt / 100);
      o.dx = Math.round((Math.random() - 0.5) * lt / 20);
      o.blink = false;
    }
    return o;
  }

  const GLITCH_FOES = ['monkey', 'angel', 'skyBird', 'knight', 'archer', 'joker', 'king', 'mechanic', 'captain', 'lightGods'];
  function glitchFoePool() {
    return [...GLITCH_FOES].sort(() => Math.random() - 0.5).slice(0, 5).map((id) => ENEMIES[id].frames[0]);
  }

  function drawGlitchBattleBg(HORIZON) {
    drawBarrierGrid(0, HORIZON, 0.22);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = i % 3 ? '#5ff0ff' : '#ff3eb0';
      ctx.fillRect((i * 97) % W, (i * 37) % (HORIZON - 10), 1, hash(i + Math.floor(tick / 30)) < 0.5 ? 1 : 2);
    }
    blob(300, 22, 12, '#3a2456');
    blob(300, 22, 10, '#c8a8ff');
    cRect(288 + (hash(Math.floor(tick / 6)) < 0.3 ? 4 : 0), 20, 24, 3, '#1a143c');
    ctx.fillStyle = '#2a1a44';
    ctx.beginPath();
    ctx.moveTo(-8, HORIZON);
    for (let x = -8; x <= W + 8; x += 8) ctx.lineTo(x, HORIZON - 14 - Math.sin(x * 0.03) * 8 - Math.sin(x * 0.07 + 1) * 4);
    ctx.lineTo(W + 8, HORIZON);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const fx = (i * 71 + 20) % W, fy = Math.round(12 + ((i * 23) % 34) + Math.sin(tick * 0.03 + i) * 3);
      const fw = 8 + (i % 3) * 4;
      cRect(fx, fy, fw, 2, '#4caf3a');
      cRect(fx, fy + 2, fw, 4, '#6b4220');
      if (hash(i + Math.floor(tick / 6)) < 0.2) cRect(fx + 2, fy, fw - 4, 6, '#ff3eb0');
    }
    ctx.fillStyle = '#1c1030';
    ctx.fillRect(-8, HORIZON, W + 16, H - HORIZON);
    ctx.fillStyle = '#2a1a44';
    for (let y = HORIZON + 4, gap = 4; y < 164; gap += 2, y += gap) ctx.fillRect(-8, y, W + 16, 2);
    for (let i = 0; i < 18; i++) {
      if (hash(i * 3.1 + Math.floor(tick / 20)) > 0.7) continue;
      cRect((i * 53 + 11) % W, HORIZON + 6 + ((i * 29) % 90), 6, 2, i % 4 ? '#3a8a2c' : '#ff3eb0');
    }
    if (hash(Math.floor(tick / 4) * 1.7) < 0.15) {
      ctx.fillStyle = 'rgba(95,240,255,0.25)';
      ctx.fillRect(0, Math.floor(hash(tick) * H), W, 2);
    }
  }

  function drawPlayerShield(cx, cy, a, flash) {
    ctx.save();
    ctx.globalAlpha = a * (flash ? 0.9 : 0.4 + 0.1 * Math.sin(tick * 0.2));
    ctx.strokeStyle = flash ? '#ffffff' : FGK.eye;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 34, 44, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha *= 0.3;
    ctx.fillStyle = FGK.eye;
    ctx.fill();
    ctx.restore();
  }

  function drawPlayerFigure(cx, bottom, k) {
    const form = inv.equipped && ITEMS[inv.equipped] ? ITEMS[inv.equipped].form : null;
    if (form === 'broken') drawBrokenMech(cx, bottom, BM_S * k, 1, {});
    else if (form === 'forger') drawForger(cx, bottom + 4, PF_S * k, { heroFace: true, glitch: false });
    else drawImg(playerBack, cx - playerBack.width * 2 * k, bottom - playerBack.height * 4 * k, 1, 4 * k);
  }

  function drawGlitchBullet(x, y, r, spin) {
    ctx.save();
    ctx.globalAlpha *= 0.6;
    blob(Math.round(x - 2), Math.round(y), r + 2, '#ff3eb0');
    blob(Math.round(x + 2), Math.round(y), r + 2, '#5ff0ff');
    ctx.restore();
    blob(Math.round(x), Math.round(y), r + 1, '#000000');
    blob(Math.round(x), Math.round(y), r, '#1a0a2a');
    for (let i = 0; i < 6; i++) {
      const a = spin + i * 1.047;
      cRect(Math.round(x + Math.cos(a) * r * 0.6) - 1, Math.round(y + Math.sin(a) * r * 0.6) - 1, 2, 2, i % 2 ? '#ff3eb0' : '#5ff0ff');
    }
    blob(Math.round(x - r * 0.3), Math.round(y - r * 0.3), Math.max(1, Math.round(r * 0.25)), '#ffffff');
  }

  function gpShift(lt) {
    if (lt < GP_GLITCH) return Math.round(fgEase(lt / GP_GLITCH) * 34);
    if (lt < GP_END - 14) return 34;
    return Math.round(34 * (1 - (lt - (GP_END - 14)) / 14));
  }

  function drawGlitchPunch(lt, eBaseX, pBaseX, fromP) {
    const kx = fromP ? pBaseX + 24 + 34 : eBaseX + 18 + 34, ky = fromP ? 110 : 70;
    const bx0 = fromP ? kx + 20 : kx - 24, tx = fromP ? eBaseX + 18 : pBaseX + 28, ty = fromP ? 64 : 116;
    if (lt < GP_GLITCH) {
      const p = fgEase(lt / GP_GLITCH), img = fromP ? playerBack : npcFrames[0], sc = fromP ? 4 : 3;
      for (let k = 1; k <= 3; k++) {
        ctx.save();
        ctx.globalAlpha = 0.3 - k * 0.08;
        const x = fromP ? pBaseX + p * 34 - k * 14 : eBaseX + 18 + p * 34 - k * 14 - 18;
        drawImg(tinted(img, k % 2 ? '#ff3eb0' : '#5ff0ff'), x, (fromP ? 158 : 97) - img.height * sc, fromP ? 1 : -1, sc);
        ctx.restore();
      }
    }
    if (lt >= GP_GLITCH && lt < GP_FIRE + 6) {
      const d = lt - GP_GLITCH, k = clamp(d / 10, 0, 1);
      for (let i = 0; i < 16; i++) {
        const a = hash(i * 2.3 + Math.floor(lt / 2)) * Math.PI * 2, r = 6 + hash(i * 4.1 + lt) * 30 * k;
        cRect(Math.round(kx - 10 + Math.cos(a) * r), Math.round(ky + Math.sin(a) * r * 0.8), 3 + Math.floor(hash(i * 1.9 + lt) * 10), 2 + (i % 3), ['#ff3eb0', '#5ff0ff', '#000000', '#ffffff'][i % 4]);
      }
      if (lt >= GP_GLITCH + 4 && lt < GP_FIRE) drawGlitchBullet(bx0, ky, Math.round(3 + 8 * clamp((lt - GP_GLITCH - 4) / 10, 0, 1)), lt * 0.3);
      if (d < 3) {
        ctx.fillStyle = 'rgba(255,62,176,0.25)';
        ctx.fillRect(0, 0, W, H);
      }
    }
    if (lt >= GP_FIRE && lt < GP_HIT) {
      const p = Math.pow((lt - GP_FIRE) / (GP_HIT - GP_FIRE), 1.4);
      for (let k = 1; k <= 5; k++) {
        const q = Math.max(0, p - k * 0.05);
        cRect(Math.round(bx0 + (tx - bx0) * q + (hash(k + lt) - 0.5) * 6), Math.round(ky + (ty - ky) * q + (hash(k * 3 + lt) - 0.5) * 10), 6 - k, 3, k % 2 ? '#ff3eb0' : '#5ff0ff');
      }
      drawGlitchBullet(bx0 + (tx - bx0) * p, ky + (ty - ky) * p, 11, lt * 0.3);
    }
    const d = lt - GP_HIT;
    if (d >= 0 && d < 26) {
      ctx.save();
      ctx.globalAlpha = 1 - d / 26;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ff3eb0';
      ctx.beginPath();
      ctx.ellipse(tx - 2, ty, 6 + d * 3, 5 + d * 2.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#5ff0ff';
      ctx.beginPath();
      ctx.ellipse(tx + 2, ty, 4 + d * 2.4, 3 + d * 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (d < 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(0, 0, W, H);
      }
      drawComic(fromP ? '-' + P_GLITCH_PUNCH.dmg : '-2', tx + 30, ty - 40 - d * 0.4, d, '#ff3e3e');
    }
  }

  const AI_COPIES = [
    { frames: () => knightFrames, ox: -58, fist: '#c8d2e0' },
    { frames: () => angelFrames, ox: 0, fist: '#fff3a8' },
    { frames: () => monkeyFrames, ox: 52, fist: '#8a5a2a' },
  ];
  function drawAfterImage(lt, eBaseX, pBaseX) {
    const cx = eBaseX + 18, bot = 94, sc = 2.5;
    const tx = pBaseX + 56, tb = 156;
    if (lt < 8) return;
    AI_COPIES.forEach((c, i) => {
      const home = cx + c.ox;
      const hit = AI_HITS[i], t0 = hit - 20, back = hit + 16;
      let x = home, y = bot, img;
      if (lt < 24) {
        x = cx + c.ox * fgEase((lt - 8) / 16);
        img = npcFrames[0];
      } else if (lt < 44) {
        img = hash(Math.floor(lt / 2) + i * 5) < (lt - 24) / 20 ? c.frames()[0] : npcFrames[0];
      } else {
        img = c.frames()[lt % 40 < 3 ? 1 : 0];
      }
      if (lt >= t0 && lt < hit) {
        const p = Math.pow((lt - t0) / 20, 2);
        x = home + (tx - home) * p;
        y = bot + (tb - bot) * p;
        for (let k = 1; k <= 3; k++) {
          const q = Math.max(0, p - k * 0.12);
          ctx.save();
          ctx.globalAlpha = 0.3 - k * 0.08;
          drawImg(tinted(img, k % 2 ? '#ff3eb0' : '#5ff0ff'), home + (tx - home) * q - (img.width * sc) / 2, bot + (tb - bot) * q - img.height * sc, -1, sc);
          ctx.restore();
        }
      } else if (lt >= hit && lt < hit + 6) {
        x = tx;
        y = tb;
      } else if (lt >= hit + 6 && lt < back) {
        const p = fgEase((lt - hit - 6) / (back - hit - 6));
        x = tx + (home - tx) * p;
        y = tb + (bot - tb) * p;
      }
      if (lt >= AI_END - 20) {
        if (lt >= AI_END - 8) return;
        const p = fgEase(clamp((lt - (AI_END - 20)) / 12, 0, 1));
        x = home + (cx - home) * p;
        if (p > 0.5) img = npcFrames[0];
      }
      drawGlitchSprite(img, x, y, sc, -1, lt < 44 ? 0.9 : 0.4, i + 1);
      if (lt >= hit - 2 && lt < hit + 10) {
        const d = lt - hit;
        const fx = tx - 24, fy = Math.round(tb - img.height * sc * 0.55);
        blob(fx, fy, 6, '#1a1420');
        blob(fx, fy, 5, c.fist);
        ctx.fillStyle = '#ffffff';
        for (let k = 0; k < 4; k++) ctx.fillRect(fx + 8 + k * 5, fy - 6 + k * 4, 10, 1);
        if (d >= 0) {
          ctx.save();
          ctx.globalAlpha = 1 - d / 10;
          for (let k = 0; k < 8; k++) {
            const a = k * 0.785;
            pxLine(fx - 6, fy, fx - 6 + Math.cos(a) * (6 + d * 2), fy + Math.sin(a) * (6 + d * 2), '#ffffff');
          }
          ctx.restore();
          if (d < 2) {
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillRect(0, 0, W, H);
          }
        }
      }
      if (lt >= hit && lt < hit + 26) drawComic('-2', tx - 20, tb - 70 - (lt - hit) * 0.4, lt - hit, '#ff3e3e');
    });
  }

  function drawGlitchInferno(lt, foeB) {
    const k = Math.min(clamp(lt / 8, 0, 1), clamp((GI_END - lt) / 10, 0, 1));
    const cx = W / 2, by = 178, ty = by - 40;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = '#02041a';
    ctx.fillRect(0, 0, W, H);
    const off = (lt * 0.8) % 16;
    ctx.fillStyle = '#0a1a4a';
    for (let x = -off; x < W; x += 16) ctx.fillRect(Math.round(x), 0, 1, H);
    for (let y = -off; y < H; y += 16) ctx.fillRect(0, Math.round(y), W, 1);
    for (let i = 0; i < 12; i++) {
      if (hash(i * 3.3 + Math.floor(lt / 3)) < 0.55) continue;
      ctx.fillStyle = i % 3 ? 'rgba(62,140,255,0.3)' : 'rgba(255,62,176,0.25)';
      ctx.fillRect(Math.round(hash(i * 7.1 + lt) * W), Math.round(hash(i * 5.7 + lt) * H), 10 + (i % 4) * 12, 3);
    }
    const lastHit = GI_HITS.reduce((m, h) => (lt >= h ? h : m), -99);
    const hurt = lt - lastHit < 14 && Math.floor((lt - lastHit) / 2) % 2 === 0;
    ctx.globalAlpha = k * 0.35;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(cx, by, 30, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = k;
    if (!hurt) {
      if (foeB) drawFoeFigure(foeB, cx, by);
      else drawPlayerFigure(cx, by, 1.25);
    }
    const POS = [[cx - 124, 80], [cx, 52], [cx + 124, 80]];
    POS.forEach(([ox, oy], i) => {
      const t0 = GI_LIGHTS[i];
      if (lt < t0) return;
      const fadeOut = clamp((GI_END - 24 - lt) / 14, 0, 1);
      if (fadeOut <= 0) return;
      const p = clamp((lt - t0) / 12, 0, 1);
      const x = Math.round(ox + Math.sin(tick * 0.05 + i * 2) * 3), y = Math.round(oy + Math.cos(tick * 0.04 + i) * 3);
      const a = k * fadeOut * (p < 1 && hash(lt + i) < 0.5 ? 0.3 : 1);
      ctx.save();
      if (p < 1) {
        ctx.globalAlpha = a * (1 - p);
        cRect(x - 2, 0, 4, y, '#3e8cff');
        cRect(x - 1, 0, 2, y, '#ffffff');
      }
      ctx.globalAlpha = a * 0.3;
      blob(x, y, Math.round(22 + Math.sin(tick * 0.2 + i) * 2), '#3e8cff');
      const img = lightFrames[Math.floor(tick / 12) % 2];
      ctx.globalAlpha = a;
      drawImg(img, x - img.width, y - img.height, 1, 2);
      ctx.globalAlpha = a * 0.65;
      drawImg(tinted(img, '#3e8cff'), x - img.width, y - img.height, 1, 2);
      if (hash(Math.floor(tick / 3) + i * 9) < 0.3) {
        ctx.globalAlpha = a * 0.8;
        cRect(x - 20 + Math.round((hash(tick + i) - 0.5) * 10), y - 6 + Math.round(hash(tick * 1.3 + i) * 12), 40, 2, hash(tick + i * 2) < 0.5 ? '#ff3eb0' : '#9fd8ff');
      }
      const d = lt - GI_HITS[i];
      if (d >= -24 && d < -4) {
        const c = (d + 24) / 20;
        ctx.globalAlpha = a;
        blob(x, y, Math.round(4 + c * 8), '#9fd8ff');
        blob(x, y, Math.round(2 + c * 4), '#ffffff');
        for (let j = 0; j < 8; j++) {
          const an = (j / 8) * Math.PI * 2 + lt * 0.3, r = (1 - c) * 30 + 4;
          cRect(Math.round(x + Math.cos(an) * r), Math.round(y + Math.sin(an) * r), 2, 2, j % 2 ? '#3e8cff' : '#ffffff');
        }
      }
      if (d >= -4 && d < 18) {
        const reach = clamp((d + 4) / 4, 0, 1), fade = d < 12 ? 1 : (18 - d) / 6;
        const ex = x + (cx - x) * reach, ey = y + (ty - y) * reach;
        ctx.lineCap = 'round';
        for (const [lw, col, al, o] of [[16, '#0a2a8a', 0.5, 0], [10, '#3e8cff', 0.9, 0], [5, '#9fd8ff', 1, 0], [2, '#ffffff', 1, 0], [3, '#ff3eb0', 0.5, -4]]) {
          ctx.globalAlpha = a * al * fade;
          ctx.strokeStyle = col;
          ctx.lineWidth = lw * (0.85 + 0.15 * Math.sin(d * 2 + i));
          ctx.beginPath();
          ctx.moveTo(x + o, y);
          ctx.lineTo(ex + o, ey);
          ctx.stroke();
        }
        if (reach >= 1) {
          ctx.globalAlpha = a * fade;
          blob(cx, ty, 12 + (Math.abs(d) % 4), '#3e8cff');
          blob(cx, ty, 6, '#ffffff');
        }
      }
      ctx.restore();
      if (d >= 0 && d < 3) {
        ctx.fillStyle = 'rgba(160,210,255,0.6)';
        ctx.fillRect(0, 0, W, H);
      }
      if (d >= 0 && d < 30) drawComic(foeB ? '-' + P_GLITCH_INFERNO.dmg : '-7', cx + 40, ty - 30 - d * 0.5, d, '#ff3e3e');
    });
    if (hash(Math.floor(lt / 4) * 1.3) < 0.35) regionGlitch(3, 22);
    if (lt >= 20) glitchText('GLITCH INFERNO', 30, 16, '#9fd8ff');
    cutsceneBars(foeB ? '!! GLITCH POWER !!' : '!! DANGER !!', foeB ? 'YOU SUMMON THREE GLITCHED LIGHTS...' : 'THREE GLITCHED LIGHTS SURROUND YOU...', lt, '#3e8cff');
    ctx.restore();
  }

  const GD_ANG = [-165, -15, -125, -55, -90].map((d) => (d * Math.PI) / 180);
  function drawGlitchDomain(b, lt, fromP = false) {
    const foes = b.gFoes;
    if (!foes) return;
    const k = Math.min(clamp((lt - 18) / 8, 0, 1), clamp((GD_END - 22 - lt) / 10, 0, 1));
    if (k <= 0) return;
    const px = W / 2, py = 136, rx = 132, ry = 84, by = 186;
    const pts = GD_ANG.map((a) => [px + Math.cos(a) * 172, py + Math.sin(a) * 100]);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = '#0a0414';
    ctx.fillRect(0, 0, W, H);
    const off = (lt * 0.6) % 16;
    ctx.fillStyle = '#2a0a3a';
    for (let x = -off; x < W; x += 16) ctx.fillRect(Math.round(x), 0, 1, H);
    for (let y = -off; y < H; y += 16) ctx.fillRect(0, Math.round(y), W, 1);
    for (let i = 0; i < 14; i++) {
      if (hash(i * 3.3 + Math.floor(lt / 3)) < 0.55) continue;
      ctx.fillStyle = i % 3 ? 'rgba(255,62,176,0.3)' : 'rgba(95,240,255,0.3)';
      ctx.fillRect(Math.round(hash(i * 7.1 + lt) * W), Math.round(hash(i * 5.7 + lt) * H), 10 + (i % 4) * 12, 3);
    }
    const lastHit = GD_HITS.reduce((m, h) => (lt >= h ? h : m), -99);
    const hurt = lt - lastHit < 12 && Math.floor((lt - lastHit) / 2) % 2 === 0;
    ctx.globalAlpha = k * 0.35;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(px, by, 30, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = k;
    if (!hurt) {
      if (fromP) drawFoeFigure(b, px, by);
      else drawPlayerFigure(px, by, 1.25);
    }
    const domeK = lt >= GD_DOME && lt < GD_SHATTER ? clamp((lt - GD_DOME) / 12, 0, 1) : 0;
    if (domeK > 0) {
      const R = fgEase(domeK);
      ctx.save();
      ctx.globalAlpha = 0.14 + 0.04 * Math.sin(tick * 0.2);
      ctx.fillStyle = '#5ff0ff';
      ctx.beginPath();
      ctx.ellipse(px, py, rx * R, ry * R, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#5ff0ff';
      ctx.lineWidth = 1;
      for (let j = 1; j <= 3; j++) {
        ctx.beginPath();
        ctx.ellipse(px, py, rx * R, (ry * R * j) / 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(px, py, (rx * R * j) / 4, ry * R, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      ctx.strokeStyle = tick % 6 < 3 ? '#5ff0ff' : '#ff3eb0';
      ctx.beginPath();
      ctx.ellipse(px, py, rx * R, ry * R, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (lt - GD_DOME < 3) {
        ctx.fillStyle = 'rgba(95,240,255,0.35)';
        ctx.fillRect(0, 0, W, H);
      }
    }
    if (lt >= GD_HITS[0] - 10 && lt < GD_SHATTER) {
      const T = Math.floor(lt / 2);
      ctx.save();
      ctx.lineWidth = 1;
      for (let j = 0; j < 3; j++) {
        const a = hash(T * 1.3 + j * 7.7) * Math.PI;
        const dx = Math.cos(a) * rx * 0.9, dy = Math.sin(a) * ry * 0.9;
        const ox = (hash(T * 2.1 + j) - 0.5) * 20, oy = (hash(T * 3.7 + j) - 0.5) * 20;
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = j % 2 ? '#ffffff' : '#5ff0ff';
        ctx.beginPath();
        ctx.moveTo(px + ox - dx, py + oy - dy);
        ctx.lineTo(px + ox + dx, py + oy + dy);
        ctx.stroke();
      }
      ctx.restore();
    }
    foes.forEach((img, i) => {
      const t0 = GD_FOE_T[i];
      if (lt < t0) return;
      const [hx, hy] = pts[i];
      const gone = lt >= GD_SHATTER ? clamp((lt - GD_SHATTER) / 16, 0, 1) : 0;
      const h = GD_HITS[i];
      const ox = 2 * px - hx, oy = 2 * py - hy;
      let x = hx, y = hy, alpha = 1 - gone;
      if (lt >= h - 8 && lt < h + 4) {
        const p = (lt - (h - 8)) / 12;
        x = hx + (ox - hx) * p;
        y = hy + (oy - hy) * p;
        for (let k = 1; k <= 3; k++) {
          const q = Math.max(0, p - k * 0.1);
          ctx.save();
          ctx.globalAlpha = 0.3 - k * 0.08;
          drawImg(tinted(img, k % 2 ? '#ff3eb0' : '#5ff0ff'), hx + (ox - hx) * q - img.width * 1.5, hy + (oy - hy) * q - img.height * 1.5, x > px ? -1 : 1, 3);
          ctx.restore();
        }
      } else if (lt >= h + 4 && lt < h + 12) {
        alpha = 0;
      }
      if (alpha > 0) {
        ctx.save();
        ctx.globalAlpha = alpha * (lt - t0 < 10 && hash(lt + i) < 0.5 ? 0.3 : 1);
        drawGlitchSprite(img, x, y + img.height * 1.5, 3, hx > px ? -1 : 1, 0.5, i + 3);
        ctx.restore();
      }
      if (lt - t0 < 10) {
        ctx.save();
        ctx.globalAlpha = 1 - (lt - t0) / 10;
        cRect(Math.round(hx) - 2, 0, 4, Math.round(hy), '#ff3eb0');
        cRect(Math.round(hx) - 1, 0, 2, Math.round(hy), '#ffffff');
        ctx.restore();
      }
      const sd = lt - (h - 2);
      if (sd >= 0 && sd < 16) {
        const sx0 = px + (hx - px) * 1.25, sy0 = py + (hy - py) * 1.25, sx1 = px + (ox - px) * 1.25, sy1 = py + (oy - py) * 1.25;
        ctx.save();
        ctx.globalAlpha = 1 - sd / 16;
        ctx.lineCap = 'round';
        for (const [lw, col] of [[12, 'rgba(95,240,255,0.5)'], [6, '#5ff0ff'], [2, '#ffffff']]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(sx0, sy0);
          ctx.lineTo(sx1, sy1);
          ctx.stroke();
        }
        ctx.restore();
        if (sd < 2) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(0, 0, W, H);
        }
      }
      if (lt >= h && lt < h + 24) drawComic('-2', px + 56, 70 - (lt - h) * 0.4, lt - h, '#ff3e3e');
    });
    if (lt >= GD_SHATTER && lt < GD_SHATTER + 30) {
      const d = lt - GD_SHATTER;
      ctx.save();
      ctx.globalAlpha = 1 - d / 30;
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2;
        const r = 1 + d * (2 + hash(i * 3.3) * 2);
        const x = px + Math.cos(a) * (rx + r), y = py + Math.sin(a) * (ry + r) + d * d * 0.05;
        ctx.fillStyle = i % 3 ? '#5ff0ff' : i % 2 ? '#ff3eb0' : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 6, y + 4);
        ctx.lineTo(x - 4, y + 6);
        ctx.fill();
      }
      ctx.restore();
      if (d < 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(0, 0, W, H);
      }
    }
    if (hash(Math.floor(lt / 4) * 1.7) < 0.3) regionGlitch(3, 22);
    if (lt >= 24 && lt < GD_FOE_T[4]) glitchText(fromP ? 'SUPER DOMAIN' : 'GLITCH DOMAIN', 30, 16, fromP ? '#5ff0ff' : '#ff3eb0');
    if (fromP) cutsceneBars('!! GLITCH POWER !!', 'YOU TRAP THE FOE IN YOUR DOMAIN...', lt - 18, '#5ff0ff');
    else cutsceneBars('!! DANGER !!', 'THE GLITCH TRAPS YOU IN ITS DOMAIN...', lt - 18, '#ff3eb0');
    ctx.restore();
  }

  function drawGlitchShatter(lt, eBaseX) {
    const cx = eBaseX + 18, cy = 70;
    for (let i = 0; i < 46; i++) {
      const t0 = i < 26 ? i * 5 : SHATTER_BOOM;
      if (lt < t0) continue;
      const d = lt - t0;
      if (d > 50) continue;
      const a = hash(i * 1.7) * Math.PI * 2, sp = (i < 26 ? 0.6 : 2) + hash(i * 2.9) * 1.5;
      const x = cx + Math.cos(a) * d * sp + (hash(i * 3.1) - 0.5) * 20;
      const y = cy + Math.sin(a) * d * sp * 0.7 - d * 0.3 + (hash(i * 4.4) - 0.5) * 40;
      const s = 2 + Math.floor(hash(i * 5.3) * 4);
      ctx.save();
      ctx.globalAlpha = 1 - d / 50;
      cRect(Math.round(x), Math.round(y), s, s, ['#d8322e', '#2a1a12', '#5ff0ff', '#ff3eb0', '#f2c79b'][i % 5]);
      ctx.restore();
    }
    if (lt >= SHATTER_BOOM - 20 && lt < SHATTER_BOOM) {
      const k = (lt - (SHATTER_BOOM - 20)) / 20;
      ctx.save();
      ctx.globalAlpha = k * 0.6;
      blob(cx, cy, Math.round(10 + k * 30), '#ffffff');
      ctx.restore();
    }
    if (lt >= SHATTER_BOOM && lt < SHATTER_BOOM + 6) {
      ctx.fillStyle = `rgba(255,255,255,${0.9 - (lt - SHATTER_BOOM) * 0.15})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (lt > 20 && lt < SHATTER_BOOM && hash(Math.floor(lt / 3)) < 0.4) regionGlitch(3, 10 + lt / 6);
  }

  // ---------- Chapter 6: the glitched road ----------
  const GR_W = 2400, GF = 178, GR_KID_X = 2236, GR_TRIGGER = 2130, GR_MAX_X = 2180;
  const GR_SOLIDS = [{ x: 420, w: 30, h: 16 }, { x: 860, w: 40, h: 24 }, { x: 1320, w: 30, h: 14 }, { x: 1740, w: 44, h: 20 }];
  const GR_WHISPERS = [[560, 'ERROR'], [1040, 'WHERE ARE YOU GOING?'], [1520, "IT'S ALL BREAKING..."], [1960, "HE'S WAITING FOR YOU"]];
  const SHOT_FIRE = 40, SHOT_END = 110;
  const groad = { state: 'walk', t: 0, cam: 0 };
  const GLITCH_MEET_LINES = ['RED KID...? IS THAT YOU?', "HEY! WHAT'S UP? ARE YOU OKAY?"];
  const GLITCH_LINES = [
    "...WHAT'S UP? HEH. HEH. HEH.",
    'THE GLITCH ATE EVERYTHING, {NAME}.',
    'THE GRASS. THE SKY. THE CASTLE. ME.',
    'IT LIVES IN MY HEAD NOW...',
    'AND IT TOLD ME A SECRET.',
    'THIS WORLD ONLY BREAKS... BECAUSE OF YOU.',
    'SO YOU GOT TO DIE.',
    'YOU. GOT. TO. DIE.',
  ];
  const GLITCH_AGAIN_LINES = ['B-BACK AGAIN, {NAME}?', 'YOU STILL GOT TO DIE.'];
  const GLITCH_DEATH_LINES = [
    '...ERR... ERROR... ERROR...',
    'W-WHERE AM I...? {NAME}...?',
    'IT WAS IN MY HEAD... THE WHOLE TIME...',
    "I COULDN'T STOP IT. I'M SO SORRY.",
    "LISTEN... THE GLITCH ISN'T A MONSTER.",
    "IT'S A VOICE. AND IT KNOWS YOUR NAME.",
    'IT SAID... WHEN THE LAST PIECE BREAKS...',
    '...THE WHOLE WORLD RESETS.',
    'RUN, {NAME}. BEFORE IT FINDS...',
    '...YOU.',
  ];

  function enterGlitchRoad() {
    game.mode = 'groad';
    toast.t = 0;
    Object.assign(groad, { state: 'walk', t: 0, cam: 0 });
    Object.assign(player, { x: 24, y: GF - player.h, vx: 0, vy: 0, face: 1, onGround: true, walk: 0 });
    showTitle('THE GLITCHED ROAD', '- CHAPTER 6 -');
  }

  function fightGlitch() {
    groad.state = 'fight';
    startBattleTransition('glitch', winGlitch, () => {
      Object.assign(groad, { state: 'ready', t: 0, cam: GR_W - W });
      Object.assign(player, { x: GR_W - W + 40, y: GF - player.h, vx: 0, vy: 0, face: 1, onGround: true, walk: 0 });
    }, 'groad');
  }

  function winGlitch() {
    Object.assign(groad, { state: 'dying', t: 0, cam: GR_W - W });
    Object.assign(player, { x: GR_TRIGGER, y: GF - player.h, vx: 0, vy: 0, face: 1, onGround: true, walk: 0 });
    startDialog(GLITCH_DEATH_LINES, () => {
      groad.state = 'dissolve';
      groad.t = 0;
    }, 'RED KID');
  }

  function updateGlitchRoad() {
    updateDialog();
    const g = groad;
    g.t++;
    const free = g.state === 'walk' || g.state === 'ready';
    const locked = dialog.active || fade.dir !== 0 || inv.open || !free;
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
    player.x = clamp(player.x + player.vx, g.state === 'walk' ? 8 : GR_W - W + 8, GR_MAX_X);
    for (const s of GR_SOLIDS) {
      const top = GF - s.h;
      if (player.y + player.h > top + 1 && player.x + player.w > s.x && player.x < s.x + s.w) {
        player.x = player.x + player.w / 2 < s.x + s.w / 2 ? s.x - player.w : s.x + s.w;
        player.vx = 0;
      }
    }
    const wasGround = player.onGround;
    const prevBottom = player.y + player.h;
    player.y += player.vy;
    player.onGround = false;
    let floor = GF;
    for (const s of GR_SOLIDS) {
      if (player.x + player.w > s.x && player.x < s.x + s.w && prevBottom <= GF - s.h + 0.5) floor = Math.min(floor, GF - s.h);
    }
    if (player.vy >= 0 && player.y + player.h >= floor) {
      player.y = floor - player.h;
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
    const camT = g.state === 'walk' ? clamp(player.x - W / 2 + 40, 0, GR_W - W) : GR_W - W;
    g.cam += (camT - g.cam) * (g.state === 'walk' ? 0.12 : 0.06);

    if (g.state === 'walk' && !locked && player.x > GR_TRIGGER) {
      g.state = 'meet';
      g.t = 0;
      player.vx = 0;
      player.face = 1;
      sfx('glitch');
    } else if (g.state === 'meet') {
      if (g.t === 50) {
        g.state = 'talk';
        startDialog(GLITCH_MEET_LINES, () => {
          g.state = 'shot';
          g.t = 0;
        }, playerName);
      }
    } else if (g.state === 'shot') {
      if (g.t === 8) sfx('gcharge');
      if (g.t === SHOT_FIRE) sfx('kidBeam');
      if (g.t === SHOT_FIRE + 5) sfx('boom');
      if (g.t > SHOT_FIRE + 5 && g.t < SHOT_FIRE + 25) player.x -= (SHOT_FIRE + 25 - g.t) * 0.12;
      if (g.t === SHOT_END) {
        g.state = 'threat';
        startDialog(GLITCH_LINES, () => {
          g.state = 'pose';
          g.t = 0;
        }, 'RED KID');
      }
    } else if (g.state === 'threat') {
      if (g.t % 80 === 40) sfx('glitch');
    } else if (g.state === 'pose') {
      if (g.t === 1) sfx('glitchIntro');
      if (g.t === 44) sfx('crash');
      if (g.t === 230) fightGlitch();
    } else if (g.state === 'ready' && !locked && player.x > GR_MAX_X - 10) {
      g.state = 'again';
      player.vx = 0;
      player.face = 1;
      startDialog(GLITCH_AGAIN_LINES, fightGlitch, 'THE GLITCH');
    } else if (g.state === 'dying') {
      if (g.t % 90 === 45) sfx('glitch');
    } else if (g.state === 'dissolve') {
      if (g.t === 1) sfx('glitchShatter');
      if (g.t % 16 === 0 && g.t < 150) sfx('glitch');
      if (g.t === 150) sfx('megaBoom');
      if (g.t === 240) {
        g.state = 'gone';
        fadeThen(enterClimb);
      }
    } else if (g.state === 'outro') {
      if (g.t === 330) {
        fadeThen(() => {
          game.mode = 'eye';
          eye.phase = 'end';
          eye.t = 0;
        });
      }
    }
  }

  function drawRoadMemory(type, x, y, seed) {
    ctx.save();
    ctx.globalAlpha = 0.75;
    if (type === 0) {
      cRect(x - 20, y, 40, 3, '#4caf3a');
      cRect(x - 20, y + 3, 40, 8, '#6b4220');
      cRect(x - 14, y + 11, 28, 5, '#4a3018');
      cRect(x - 2, y - 16, 4, 16, '#3e2a18');
      blob(x, y - 20, 10, '#2e6b34');
      blob(x + 5, y - 14, 6, '#3a8a40');
    } else if (type === 1) {
      blob(x - 10, y, 10, '#c8b8e8');
      blob(x + 6, y - 4, 12, '#d8ccf0');
      blob(x + 18, y + 2, 8, '#c8b8e8');
      cRect(x - 18, y + 2, 44, 6, '#b8a8d8');
    } else if (type === 2) {
      fgBricks(x - 10, y - 24, 20, 30, FGK.stone);
      for (let k = 0; k < 3; k++) fgBricks(x - 10 + k * 7, y - 30, 5, 6, FGK.stone);
      cRect(x - 3, y - 14, 6, 8, '#1a1428');
    } else {
      ctx.fillStyle = '#6e7a90';
      ctx.beginPath();
      ctx.ellipse(x, y, 22, 6, 0.2, 0, Math.PI * 2);
      ctx.fill();
      cRect(x - 8, y - 9, 16, 6, '#8a96aa');
      ctx.globalAlpha = 0.5;
      blob(x, y - 9, 7, '#5ff0ff');
      ctx.globalAlpha = 0.75;
      if (tick % 30 < 4) cRect(x + 14, y - 2, 2, 2, '#ffe14d');
    }
    if (hash(Math.floor(tick / 4) + seed * 5) < 0.18) {
      cRect(Math.round(x - 24 + (hash(tick + seed) - 0.5) * 10), Math.round(y - 10 + hash(tick * 1.3 + seed) * 20), 48, 2, hash(tick) < 0.5 ? '#ff3eb0' : '#5ff0ff');
    }
    ctx.restore();
  }

  function renderGlitchRoad() {
    const g = groad, cam = Math.round(g.cam);
    let shake = 0;
    if (g.state === 'shot' && g.t >= SHOT_FIRE && g.t < SHOT_FIRE + 20) shake = 6;
    else if (g.state === 'dissolve' && g.t < 150) shake = 1 + g.t / 50;
    ctx.save();
    if (shake) ctx.translate(Math.round((Math.random() - 0.5) * shake * 2), Math.round((Math.random() - 0.5) * shake));
    const prog = clamp(cam / (GR_W - W), 0, 1);
    const sky = ctx.createLinearGradient(0, 0, 0, GF);
    sky.addColorStop(0, '#0c0418');
    sky.addColorStop(1, '#2a0e3a');
    ctx.fillStyle = sky;
    ctx.fillRect(-10, -10, W + 20, H + 20);
    if (prog > 0.6) {
      for (let i = 0; i < 5; i++) {
        if (hash(i * 2.7 + Math.floor(tick / 10)) > (prog - 0.6) * 1.5) continue;
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = SKY[i % SKY.length];
        ctx.fillRect(0, i * 22 + Math.floor(hash(i + Math.floor(tick / 10)) * 10), W, 6 + (i % 3) * 4);
        ctx.restore();
      }
    }
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = i % 3 ? '#5ff0ff' : '#ff3eb0';
      ctx.fillRect((i * 97 - cam * 0.05 + W * 8) % W, (i * 41) % 100, 1, hash(i + Math.floor(tick / 30)) < 0.5 ? 1 : 2);
    }
    drawBarrierGrid(0, 100, 0.25);
    ctx.fillStyle = '#1c0a26';
    ctx.beginPath();
    ctx.moveTo(0, GF);
    for (let x = 0; x <= W; x += 12) ctx.lineTo(x, GF - 46 - Math.sin((x + cam * 0.2) * 0.018) * 16 - Math.sin((x + cam * 0.2) * 0.047) * 6);
    ctx.lineTo(W, GF);
    ctx.fill();
    for (let i = 0; i < 14; i++) {
      const sx = Math.round(150 + i * 150 - cam * 0.5);
      if (sx < -80 || sx > W + 80) continue;
      drawRoadMemory(i % 4, sx, Math.round(40 + ((i * 37) % 50) + Math.sin(tick * 0.02 + i) * 4), i);
    }

    ctx.save();
    ctx.translate(-cam, 0);
    ctx.fillStyle = '#2a2236';
    ctx.fillRect(cam - 8, GF, W + 16, H - GF);
    for (let x = Math.max(0, Math.floor(cam / 16) * 16); x < Math.min(GR_W, cam + W + 16); x += 16) {
      const green = hash(x * 0.13) < Math.pow(x / GR_W, 1.6);
      const flick = hash(x * 0.71 + Math.floor(tick / 8)) < 0.04;
      cRect(x, GF, 16, 2, flick ? '#ff3eb0' : green ? '#4caf3a' : '#4a3e5a');
      if (green) cRect(x, GF + 2, 16, 3, '#6b4a2a');
      if (hash(x * 0.37) < 0.4) cRect(x + 4, GF + 8 + Math.floor(hash(x) * 20), 8, 1, '#1a1424');
    }
    cRect(GR_KID_X - 70, GF, 140, 2, '#7ad957');
    for (const fx of [-50, -22, 30, 58]) {
      cRect(GR_KID_X + fx, GF - 3, 1, 3, '#3a8a2c');
      cRect(GR_KID_X + fx - 1, GF - 5, 3, 2, fx % 4 ? '#ffe14d' : '#ff3e6c');
    }
    for (const s of GR_SOLIDS) {
      cRect(s.x, GF - s.h, s.w, s.h, '#140a24');
      ctx.strokeStyle = (tick + s.x) % 20 < 10 ? '#5ff0ff' : '#ff3eb0';
      ctx.lineWidth = 1;
      ctx.strokeRect(s.x + 0.5, GF - s.h + 0.5, s.w - 1, s.h - 1);
      for (let k = 0; k < 4; k++) {
        if (hash(k * 3.1 + s.x + Math.floor(tick / 6)) < 0.5) continue;
        cRect(s.x + 2 + Math.floor(hash(k + s.x) * (s.w - 6)), GF - s.h + 2 + Math.floor(hash(k * 2 + s.x) * (s.h - 5)), 3, 2, k % 2 ? '#5ff0ff' : '#ff3eb0');
      }
    }
    const signX = GR_W - 470;
    cRect(signX, GF - 26, 4, 26, '#5a3a2a');
    ctx.save();
    ctx.translate(signX + 2, GF - 26);
    ctx.rotate(-0.12);
    cRect(-34, -8, 72, 12, '#1a1020');
    cRect(-33, -7, 70, 10, '#8a5a3a');
    drawText(hash(Math.floor(tick / 10)) < 0.3 ? 'GR4SSL@NDS' : 'GRASSLANDS', 2, -5, 6, '#2a1408', 'center', null);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 16; i++) {
      const fx = (i * 157) % GR_W, fy = 40 + ((i * 53) % 110) + Math.sin(tick * 0.04 + i) * 6;
      if (fx < cam - 20 || fx > cam + W + 20) continue;
      cRect(fx, Math.round(fy), 3 + (i % 3) * 2, 3 + (i % 2) * 2, i % 2 ? '#5ff0ff' : '#ff3eb0');
    }
    ctx.restore();
    for (const [wx, text] of GR_WHISPERS) {
      const dist = Math.abs(player.x - wx);
      if (dist > 160) continue;
      ctx.save();
      ctx.globalAlpha = (1 - dist / 160) * (hash(Math.floor(tick / 4) + wx) < 0.15 ? 0.3 : 0.8);
      drawText(text, wx - 2, 60, 8, '#ff3eb0', 'center', null);
      drawText(text, wx + 2, 60, 8, '#5ff0ff', 'center', null);
      drawText(text, wx, 60, 8, '#e8e0ff', 'center', null);
      ctx.restore();
    }
    ctx.restore();

    const kx = GR_KID_X - cam;
    if (['walk', 'meet', 'talk', 'shot', 'threat', 'pose', 'fight', 'ready', 'again'].includes(g.state)) {
      if (kx > -20 && kx < W + 20) {
        const amt = g.state === 'threat' || g.state === 'shot' ? 0.7 : g.state === 'walk' ? 0.25 : 0.4;
        drawGlitchKid(kx, GF, 1, -1, amt, tick % 160 < 8);
      }
    } else if (g.state === 'dying') {
      if (hash(Math.floor(tick / 6)) < 0.6) drawImg(npcFrames[0], kx - 6, GF - npcFrames[0].height + 1, -1);
      else drawGlitchKid(kx + (tick % 6 < 3 ? 1 : -1), GF, 1, -1, 0.9, false);
    } else if (g.state === 'dissolve' && g.t < 150) {
      ctx.save();
      ctx.globalAlpha = 1 - (g.t / 150) * 0.6;
      drawGlitchKid(kx + Math.round((Math.random() - 0.5) * (g.t / 150) * 6), GF, 1, -1, 1, false);
      ctx.restore();
    }
    if (g.state === 'dissolve') {
      for (let i = 0; i < 40; i++) {
        const p = (g.t * (0.006 + (i % 5) * 0.002) + i / 40) % 1;
        ctx.save();
        ctx.globalAlpha = (1 - p) * clamp(g.t / 30, 0, 1);
        const s = 2 + (i % 3);
        cRect(Math.round(kx + (hash(i * 3.1) - 0.5) * 60 + Math.sin(p * 8 + i) * 6), Math.round(GF - 8 - p * 160), s, s, ['#d8322e', '#5ff0ff', '#ff3eb0', '#ffffff'][i % 4]);
        ctx.restore();
      }
      if (g.t >= 150 && g.t < 175) {
        ctx.fillStyle = `rgba(255,255,255,${1 - (g.t - 150) / 25})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
    if (g.state === 'shot') {
      const t = g.t, hx = kx - 7, hy = GF - 10;
      const tx = player.x - cam + 6, ty = player.y + 8;
      if (t >= 8 && t < SHOT_FIRE + 2) {
        const c = clamp((t - 8) / (SHOT_FIRE - 8), 0, 1);
        blob(hx, hy, Math.round(2 + c * 5), '#ff2a3a');
        blob(hx, hy, Math.round(1 + c * 2), '#ffffff');
        for (let j = 0; j < 6; j++) {
          const a = (j / 6) * Math.PI * 2 + t * 0.3, r = (1 - c) * 24 + 3;
          cRect(Math.round(hx + Math.cos(a) * r), Math.round(hy + Math.sin(a) * r), 2, 2, j % 2 ? '#5ff0ff' : '#ff2a3a');
        }
      }
      if (t >= SHOT_FIRE && t < SHOT_FIRE + 18) {
        const k = t < SHOT_FIRE + 12 ? 1 : (SHOT_FIRE + 18 - t) / 6;
        const reach = clamp((t - SHOT_FIRE) / 5, 0, 1);
        const ex = hx + (tx - hx) * reach, ey = hy + (ty - hy) * reach;
        ctx.save();
        ctx.lineCap = 'round';
        for (const [lw, col, a, o] of [[9, '#ff2a3a', 0.4, 0], [5, '#ff2a3a', 1, 0], [3, '#5ff0ff', 0.7, -2], [2, '#ffffff', 1, 0]]) {
          ctx.globalAlpha = a * k;
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(hx, hy + o);
          ctx.lineTo(ex, ey + o);
          ctx.stroke();
        }
        ctx.restore();
        if (t >= SHOT_FIRE + 5 && t < SHOT_FIRE + 8) {
          ctx.fillStyle = 'rgba(255,60,60,0.45)';
          ctx.fillRect(0, 0, W, H);
        }
      }
    }

    let frame = 0;
    if (!player.onGround) frame = 1;
    else if (player.walk > 0) frame = walkFrame(player.walk);
    const hurt = g.state === 'shot' && g.t > SHOT_FIRE + 5 && g.t < SHOT_FIRE + 45 && tick % 4 < 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(Math.round(player.x - cam), Math.round(player.y + player.h) - 1, player.w, 1);
    if (!hurt) drawImg(playerFrames[frame], player.x - 2 - cam, player.y, player.face);
    if (g.state === 'meet' && g.t > 10) drawText('!', player.x - cam + 5, player.y - 14, 8, '#ffe14d', 'center', '#1a1420');
    if (g.state === 'ready' && tick % 60 < 40) drawText('!', kx, GF - 34, 8, '#5ff0ff', 'center', '#1a1420');
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#ffffff';
    for (let sy = tick % 4; sy < H; sy += 4) ctx.fillRect(0, sy, W, 1);
    ctx.restore();
    if (hash(Math.floor(tick / 5) * 2.9) < 0.05 + prog * 0.06 || (g.state === 'shot' && g.t >= SHOT_FIRE && g.t < SHOT_FIRE + 12)) crashGlitchSlices(g.state === 'walk' ? 0.3 : 0.8);

    if (g.state === 'outro') {
      ctx.fillStyle = `rgba(0,0,0,${clamp((g.t - 60) / 40, 0, 1)})`;
      ctx.fillRect(0, 0, W, H);
      if (g.t > 110) {
        const text = 'TO BE CONTINUED...';
        drawText(text.slice(0, Math.floor((g.t - 110) / 4)), W / 2, H / 2 - 8, 16, '#ffe14d', 'center', '#5a3a1a');
      }
    }
    if (g.state === 'pose') {
      ctx.save();
      if (g.t >= 44 && g.t < 60) ctx.translate(g.t % 2 ? 3 : -3, 0);
      renderGlitchIntro(g.t);
      ctx.restore();
    } else if (g.state !== 'outro') {
      drawDialog();
      drawTitle();
      drawToast();
      if (canOpenInventory() || inv.open) drawBagButton();
      if (inv.open) drawInventory();
    }
  }

  function renderGlitchIntro(t) {
    const k = clamp(t / 12, 0, 1), cx = W / 2;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = '#06040e';
    ctx.fillRect(0, 0, W, H);
    drawBarrierGrid(0, H, 0.16);
    for (let i = 0; i < 14; i++) {
      const a = i * 0.449 + t * 0.008;
      ctx.globalAlpha = k * 0.1;
      ctx.fillStyle = i % 2 ? '#5ff0ff' : '#d8322e';
      ctx.beginPath();
      ctx.moveTo(cx, 150);
      ctx.lineTo(cx + Math.cos(a - 0.08) * 400, 150 + Math.sin(a - 0.08) * 400);
      ctx.lineTo(cx + Math.cos(a + 0.08) * 400, 150 + Math.sin(a + 0.08) * 400);
      ctx.fill();
    }
    ctx.globalAlpha = k;
    const rise = Math.pow(clamp(1 - t / 20, 0, 1), 2) * 90;
    drawGlitchKid(cx, H + 16 + rise, 8, -1, t > 40 ? 0.9 : 0.4, false);
    if (t >= 20) {
      const subX = cx - Math.pow(clamp(1 - (t - 20) / 14, 0, 1), 2) * 400;
      for (let d = 4; d >= 1; d--) drawText('WHAT IS LEFT OF RED KID', subX + d, 10 + d, 16, '#2a0a1a', 'center', null);
      drawText('WHAT IS LEFT OF RED KID', subX, 10, 16, '#ffd0d0', 'center', null);
    }
    if (t >= 40) {
      const slam = Math.max(0, 1 - (t - 40) / 6);
      const rg = hash(Math.floor(t / 3) * 1.7) < 0.35 ? 5 : 2;
      ctx.save();
      ctx.translate(cx, 62);
      ctx.scale(1 + slam * 0.8, 1 + slam * 0.8);
      for (let d = 6; d >= 1; d--) drawText('THE GLITCH', d, -16 + d, 32, '#1a0a2a', 'center', null);
      ctx.globalAlpha = 0.8;
      drawText('THE GLITCH', -rg, -16, 32, '#ff3eb0', 'center', null);
      drawText('THE GLITCH', rg, -16, 32, '#5ff0ff', 'center', null);
      ctx.globalAlpha = 1;
      drawText('THE GLITCH', 0, -16, 32, '#ffffff', 'center', null);
      ctx.restore();
      if (t < 46) {
        ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - (t - 40) / 6)})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
    ctx.restore();
    if (t > 40 && hash(Math.floor(t / 4) * 2.3) < 0.35) crashGlitchSlices(0.6);
    if (t > 206) {
      ctx.fillStyle = `rgba(0,0,0,${clamp((t - 206) / 20, 0, 1)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- Chapter 7: the core ----------
  function mixHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (s) => {
      const x = (pa >> s) & 255, y = (pb >> s) & 255;
      return Math.round(x + (y - x) * t);
    };
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  function drawFoeFigure(b, cx, by) {
    const en = b.enemy;
    if (en.core) drawBigCore(cx, by - 36, 1.5, { rage: 1 });
    else if (en.glitchKid) drawGlitchKid(cx, by, 3.5, 1, 0.5, false);
    else if (en.broken) drawBrokenMech(cx, by, 1.1, 1, {});
    else if (en.forger) drawForger(cx, by, 0.75, { glitch: false });
    else {
      const img = (b.form2 ? seraphFrames : en.frames)[0], sc = b.form2 ? 1.6 : 3.5;
      drawImg(img, cx - (img.width * sc) / 2, by - img.height * sc, -1, sc);
    }
  }

  function drawBigCore(cx, cy, s, o = {}) {
    const crack = o.crack || 0, rage = o.rage || 0, eye = o.eye === undefined ? 1 : o.eye;
    const R = Math.round(20 * s), x = Math.round(cx), y = Math.round(cy);
    const pulse = 0.6 + 0.4 * Math.sin(tick * 0.3);
    ctx.save();
    const A = ctx.globalAlpha;
    ctx.globalAlpha = A * 0.35 * pulse;
    blob(x, y, Math.round(R * 2.2), rage ? '#ff3eb0' : '#5ff0ff');
    ctx.globalAlpha = A * 0.18;
    blob(x, y, Math.round(R * 3), '#5ff0ff');
    if (hash(Math.floor(tick / 2) * 1.3 + x) < 0.4 + crack * 0.4) {
      ctx.globalAlpha = A * 0.6;
      blob(x - Math.round(R * 0.15), y, R, '#ff2a6a');
      blob(x + Math.round(R * 0.15), y, R, '#2a6aff');
    }
    ctx.globalAlpha = A;
    blob(x, y, R + Math.max(1, Math.round(s)), '#140a24');
    blob(x, y, R, '#5ff0ff');
    blob(x + Math.round(R * 0.15), y + Math.round(R * 0.2), Math.round(R * 0.75), '#3ac8e0');
    blob(x - Math.round(R * 0.25), y - Math.round(R * 0.25), Math.round(R * 0.5), '#e8ffff');
    const lw = Math.max(1, Math.round(s * 0.8));
    const crackLines = (n, col, w, scale) => {
      for (let i = 0; i < n; i++) {
        const a = i * 1.7 + 0.4;
        let ax = x, ay = y;
        for (let k = 0; k < 3; k++) {
          const nx = ax + Math.cos(a + (hash(i * 4 + k) - 0.5)) * R * 0.45 * scale;
          const ny = ay + Math.sin(a + (hash(i * 4 + k) - 0.5)) * R * 0.45 * scale;
          ctx.strokeStyle = col;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(Math.round(ax), Math.round(ay));
          ctx.lineTo(Math.round(nx), Math.round(ny));
          ctx.stroke();
          ax = nx;
          ay = ny;
        }
      }
    };
    crackLines(4, '#140a24', lw, 1);
    if (eye > 0) {
      const ew = R * 0.62, eh = R * 0.38 * eye;
      ctx.fillStyle = '#140a24';
      ctx.beginPath();
      ctx.ellipse(x, y, ew + lw, eh + lw, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x, y, ew, Math.max(0.5, eh), 0, 0, Math.PI * 2);
      ctx.fill();
      if (eye > 0.3) {
        const look = o.lookX === undefined ? Math.sin(tick * 0.03) : o.lookX;
        const px = Math.round(x + look * ew * 0.35), pr = Math.max(1, Math.round(Math.min(eh, R * 0.26)));
        blob(px, y, pr, rage ? '#ff2a3a' : '#d8322e');
        blob(px, y, Math.max(1, Math.round(pr * 0.45)), '#140a24');
        cRect(px - Math.round(pr * 0.5), y - Math.round(pr * 0.6), Math.max(1, Math.round(s)), Math.max(1, Math.round(s)), '#ffffff');
      }
    } else {
      cRect(x - Math.round(R * 0.4), y, Math.round(R * 0.8), lw, '#140a24');
    }
    if (crack > 0) {
      crackLines(Math.ceil(crack * 8), '#ffffff', lw + 1, 1 + crack);
      ctx.globalAlpha = A * crack * (0.4 + 0.3 * Math.sin(tick * 0.6));
      blob(x, y, Math.round(R * (1.1 + crack * 0.6)), '#ffffff');
      ctx.globalAlpha = A;
    }
    for (let i = 0; i < 6; i++) {
      if (hash(i * 3.7 + Math.floor(tick / 5)) < 0.5) continue;
      const a = hash(i * 1.3 + Math.floor(tick / 5)) * Math.PI * 2, r = R * (1.3 + hash(i * 2.1 + Math.floor(tick / 5)) * 0.8);
      cRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), Math.max(2, Math.round(s * 1.5)), Math.max(2, Math.round(s * 1.5)), i % 2 ? '#5ff0ff' : '#ff3eb0');
    }
    ctx.restore();
    if (o.glitch !== false && hash(Math.floor(tick / 3) * 1.3 + x) < 0.16 + crack * 0.4) {
      const w = R * 3, x0 = x - Math.round(w / 2);
      for (let i = 0; i < 2; i++) {
        const sy = Math.round(y - R + hash(tick + i * 3.1) * R * 2), h = 2 + Math.floor(hash(tick * 1.7 + i) * 3 * s);
        const dx = Math.round((hash(tick * 2.3 + i) - 0.5) * 10 * s);
        ctx.drawImage(cvs, x0, sy, w, h, x0 + dx, sy, w, h);
      }
    }
  }

  function drawCoreBattleBg(HORIZON) {
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, '#04020c');
    g.addColorStop(1, '#2a1052');
    ctx.fillStyle = g;
    ctx.fillRect(-8, 0, W + 16, HORIZON);
    for (let i = 0; i < 26; i++) {
      const x = (i * 29 + 7) % W, sp = 0.4 + (i % 4) * 0.25;
      const y = ((tick * sp + i * 41) % (HORIZON + 40)) - 20;
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = k === 0 ? '#d8ffff' : i % 3 ? `rgba(95,240,255,${0.45 - k * 0.08})` : `rgba(255,62,176,${0.4 - k * 0.07})`;
        ctx.fillRect(x, Math.round(y - k * 5), 1, 3);
      }
    }
    blob(330, 22, 13, '#3a1a6a');
    blob(330, 22, 10, '#6a3ab8');
    cRect(318 + (hash(Math.floor(tick / 6)) < 0.3 ? 3 : 0), 20, 24, 2, '#04020c');
    for (let i = 0; i < 12; i++) {
      const x = i * 36 + ((tick >> 3) % 36) - 18;
      blob(x, HORIZON - 2, 15, '#3a2266');
      blob(x + 6, HORIZON - 7, 9, '#5a3a8e');
    }
    ctx.fillStyle = '#120a28';
    ctx.fillRect(-8, HORIZON, W + 16, H - HORIZON);
    ctx.fillStyle = '#22164a';
    for (let y = HORIZON + 4, gap = 4; y < 164; gap += 2, y += gap) ctx.fillRect(-8, y, W + 16, 2);
    ctx.save();
    ctx.strokeStyle = 'rgba(122,63,216,0.35)';
    ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * 20, HORIZON);
      ctx.lineTo(W / 2 + i * 90, H);
      ctx.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const fx = (i * 83 + 30) % W, fy = Math.round(18 + ((i * 13) % 34) + Math.sin(tick * 0.03 + i) * 4);
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(tick * 0.05 + i);
      cRect(fx, fy, 18, 4, '#9a5aff');
      cRect(fx, fy, 18, 1, '#e0c8ff');
    }
    ctx.restore();
    if (hash(Math.floor(tick / 4) * 1.9) < 0.12) {
      ctx.fillStyle = 'rgba(255,62,176,0.2)';
      ctx.fillRect(0, Math.floor(hash(tick) * H), W, 2);
    }
  }

  function drawPortal(x, y, r, seed) {
    if (r < 1) return;
    const rx = r * 0.62;
    ctx.save();
    const ell = (a, b) => {
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(0.5, a), Math.max(0.5, b), 0, 0, Math.PI * 2);
    };
    ctx.globalAlpha *= 0.35;
    ctx.fillStyle = '#ff3eb0';
    ell(rx + 4, r + 4);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#0a0418';
    ell(rx, r);
    ctx.fill();
    for (let k = 0; k < 10; k++) {
      const a = tick * 0.15 * (seed % 2 ? 1 : -1) + k * 0.628;
      const rr = 0.3 + 0.6 * ((k * 0.37 + tick * 0.02) % 1);
      cRect(Math.round(x + Math.cos(a) * rx * rr), Math.round(y + Math.sin(a) * r * rr), 2, 2, k % 2 ? '#5ff0ff' : '#ff3eb0');
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = (tick + seed * 3) % 8 < 4 ? '#5ff0ff' : '#ff3eb0';
    ell(rx, r);
    ctx.stroke();
    ctx.globalAlpha *= 0.6;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ffffff';
    ell(rx - 2, r - 2);
    ctx.stroke();
    ctx.restore();
  }

  const PB_PORTALS = [[170, 50], [40, 72], [236, 120], [112, 34], [326, 128], [52, 128]];
  function drawPortalBarrage(lt, eBaseX, pBaseX) {
    const home = [pBaseX + 24, 126];
    const homeK = Math.max(clamp((lt - 14) / 8, 0, 1) * clamp((38 - lt) / 6, 0, 1), clamp((lt - (PB_END - 36)) / 8, 0, 1) * clamp((PB_END - 6 - lt) / 8, 0, 1));
    if (homeK > 0) drawPortal(home[0], home[1], 28 * homeK, 7);
    PB_PORTALS.forEach(([x, y], i) => {
      const k = clamp((lt - (PB_OPEN - 14 + i * 3)) / 10, 0, 1) * clamp((PB_END - 30 - lt) / 10, 0, 1);
      if (k > 0) drawPortal(x, y, 20 * k, i);
    });
    let pos = null, k = 0.6, flash = false;
    if (lt >= 22 && lt < 32) {
      pos = home;
      k = 0.75 * (1 - (lt - 22) / 10);
    }
    PB_HITS.forEach((ht, i) => {
      const [x, y] = PB_PORTALS[i];
      if (lt >= ht - 8 && lt < ht + 4) {
        pos = [x, y];
        k = 0.25 + 0.4 * clamp((lt - (ht - 8)) / 6, 0, 1);
        flash = lt >= ht && lt < ht + 3;
      } else if (lt >= ht + 4 && lt < ht + 12) {
        const p = (lt - ht - 4) / 8;
        const [nx, ny] = i < PB_HITS.length - 1 ? PB_PORTALS[i + 1] : home;
        pos = [x + (nx - x) * p, y + (ny - y) * p - Math.sin(p * Math.PI) * 20];
        k = 0.65 - 0.4 * p;
      }
    });
    if (lt >= PB_END - 28 && lt < PB_END - 14) {
      pos = home;
      k = 0.25 + 0.5 * ((lt - (PB_END - 28)) / 14);
    }
    PB_HITS.forEach((ht, i) => {
      const d = lt - ht;
      if (d < 0 || d >= 8) return;
      const [tx, ty] = PB_PORTALS[i];
      for (const j of [2, 3]) {
        const [sx, sy] = PB_PORTALS[(i + j) % PB_PORTALS.length];
        let x = sx, y = sy;
        for (let s = 1; s <= 6; s++) {
          const nx = sx + ((tx - sx) * s) / 6 + (s < 6 ? (hash(s * 3.1 + lt + j) - 0.5) * 16 : 0);
          const ny = sy + ((ty - sy) * s) / 6 + (s < 6 ? (hash(s * 1.9 + lt + j) - 0.5) * 16 : 0);
          pxLine(Math.round(x), Math.round(y), Math.round(nx), Math.round(ny), d % 2 ? '#ffffff' : j === 2 ? '#5ff0ff' : '#ff3eb0');
          x = nx;
          y = ny;
        }
      }
    });
    if (pos && k > 0.05) {
      const bottom = pos[1] + (playerBack.height * 4 * k) / 2;
      if (flash) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        blob(Math.round(pos[0]), Math.round(pos[1]), Math.round(18 * k + 6), '#ffffff');
        ctx.restore();
      }
      drawPlayerFigure(pos[0], bottom, k);
    }
    PB_HITS.forEach((ht, i) => {
      const d = lt - ht;
      if (d >= 0 && d < 20) drawComic('-1', PB_PORTALS[i][0] + 22, PB_PORTALS[i][1] - 20 - d * 0.4, d, '#ff3e3e');
    });
  }

  const DFIST_ROWS = [
    '...XXXXXX...',
    '...XXXXXX...',
    '..XXXXXXXX..',
    '.XXXXXXXXXX.',
    'XXXXXXXXXXXX',
    'XXXXXXXXXXXX',
    'XX.XX.XX.XXX',
    'XXXXXXXXXXXX',
    '.XXXXXXXXXX.',
    '..XX.XX.XX..',
  ];
  function drawDigitalFist(lt, pBaseX) {
    const C = 6, cols = 12, rows = DFIST_ROWS.length;
    const cx = pBaseX + 24;
    let bottom;
    if (lt < DF_FORM) bottom = 40 + lt * 0.3;
    else if (lt < DF_HIT - 8) bottom = 49 - (lt - DF_FORM) * 0.8;
    else if (lt < DF_HIT) bottom = 39 + (142 - 39) * Math.pow((lt - (DF_HIT - 8)) / 8, 2);
    else bottom = 142;
    const x0 = Math.round(cx - (cols * C) / 2), y0 = Math.round(bottom - rows * C);
    const form = clamp(lt / DF_FORM, 0, 1), gone = clamp((lt - DF_HIT - 14) / 24, 0, 1);
    if (gone < 1) {
      ctx.save();
      ctx.globalAlpha = (1 - gone) * form;
      for (let i = 0; i < 6; i++) {
        const ax = x0 + 3 * C + i * C;
        for (let y = y0 - 4; y > -10; y -= 7) {
          if (hash(i * 3.1 + y * 0.7 + Math.floor(tick / 2)) < 0.45) continue;
          cRect(ax + 1, y, C - 2, 4, i % 2 ? '#5ff0ff' : '#7a3fd8');
        }
      }
      ctx.restore();
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (DFIST_ROWS[r][c] !== 'X') continue;
        const id = r * cols + c;
        const p = clamp(form * 1.6 - hash(id * 1.7) * 0.6, 0, 1);
        if (p <= 0 || gone >= 1) continue;
        const sx = (hash(id * 2.3) - 0.5) * 260 * (1 - p), sy = (hash(id * 3.9) - 0.5) * 160 * (1 - p) - (1 - p) * 60;
        const gx = gone * (hash(id * 5.1) - 0.5) * 80, gy = -gone * (20 + hash(id * 6.3) * 80);
        const x = Math.round(x0 + c * C + sx + gx), y = Math.round(y0 + r * C + sy + gy);
        ctx.save();
        ctx.globalAlpha *= (1 - gone) * (hash(id + Math.floor(tick / 3)) < 0.04 ? 0.3 : 1);
        cRect(x, y, C, C, '#1a0e3a');
        cRect(x + 1, y + 1, C - 2, C - 2, r >= rows - 4 ? '#7a5ae8' : '#4a2aa8');
        cRect(x + 1, y + 1, C - 2, 1, '#c8b8ff');
        if (hash(id * 0.9 + Math.floor(tick / 6)) < 0.15) cRect(x + 2, y + 2, 2, 2, '#5ff0ff');
        ctx.restore();
      }
    }
    if (lt >= DF_HIT - 8 && lt < DF_HIT) {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) ctx.fillRect(x0 - 10 + i * 18, Math.round(y0 - 40 - (i % 2) * 14), 2, 30);
    }
    const d = lt - DF_HIT;
    if (d >= 0 && d < 26) {
      ctx.save();
      ctx.globalAlpha = 1 - d / 26;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#5ff0ff';
      ctx.beginPath();
      ctx.ellipse(cx, 152, 10 + d * 4, 3 + d, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ff3eb0';
      ctx.beginPath();
      ctx.ellipse(cx, 152, 6 + d * 3, 2 + d * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (d < 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(0, 0, W, H);
      }
      drawComic('-2', cx + 46, 70 - d * 0.4, d, '#ff3e3e');
    }
  }

  function drawGlitchStone(x, bottom, w, h, seed, charge) {
    const top = bottom - h;
    const shape = (o) => {
      ctx.beginPath();
      ctx.moveTo(x - w / 2 - o, bottom);
      ctx.lineTo(x - w / 2 + 2 - o, top + 11);
      ctx.lineTo(x - 2, top - o);
      ctx.lineTo(x + w / 2 + o, top + 15);
      ctx.lineTo(x + w / 2 + 1 + o, bottom);
      ctx.closePath();
    };
    ctx.fillStyle = '#0a0418';
    shape(2);
    ctx.fill();
    ctx.fillStyle = '#2e1e52';
    shape(0);
    ctx.fill();
    ctx.fillStyle = '#4a3478';
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + 2, bottom);
    ctx.lineTo(x - w / 2 + 3, top + 12);
    ctx.lineTo(x - 2, top + 2);
    ctx.lineTo(x - 3, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.globalAlpha *= 0.5 + 0.5 * charge;
    for (let k = 0; k < 3; k++) {
      const yy = Math.round(top + 16 + (k * (h - 24)) / 3);
      pxLine(x - 5 + (k % 2) * 4, yy, x + 3 - (k % 2) * 5, yy + 8, charge > 0.5 && tick % 4 < 2 ? '#ffffff' : '#ff3eb0');
    }
    ctx.restore();
    for (let k = 0; k < 4; k++) {
      const fy = top - 4 - ((tick * 0.6 + k * 9 + seed * 5) % 24);
      cRect(Math.round(x - 8 + hash(k + seed * 3) * 16), Math.round(fy), 2, 2, k % 2 ? '#5ff0ff' : '#9a5aff');
    }
    if (hash(Math.floor(tick / 3) + seed * 7) < 0.2 + charge * 0.4) {
      const sy = Math.round(top + hash(tick + seed) * h);
      ctx.drawImage(cvs, x - w, sy, w * 2, 3, x - w + (hash(tick * 1.7 + seed) < 0.5 ? -3 : 3), sy, w * 2, 3);
    }
    if (charge > 0) {
      ctx.save();
      ctx.globalAlpha *= charge * (0.3 + 0.2 * Math.sin(tick * 0.8));
      blob(x, Math.round(top + h / 2), w, '#ff3eb0');
      ctx.restore();
    }
  }

  const GL_STONES = [[-136, 124], [-68, 98], [68, 104], [136, 128]];
  function drawGlitchLandscape(lt) {
    const k = Math.min(clamp(lt / 8, 0, 1), clamp((GL_END - lt) / 10, 0, 1));
    const cx = W / 2, gy = 178;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = '#07030f';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = i % 3 ? '#5ff0ff' : '#ff3eb0';
      ctx.fillRect((i * 97) % W, 24 + ((i * 37) % 80), 1, hash(i + Math.floor(lt / 20)) < 0.5 ? 1 : 2);
    }
    ctx.fillStyle = '#1a0e30';
    ctx.beginPath();
    ctx.moveTo(0, gy);
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, gy - 40 - hash(x * 0.37) * 50);
    ctx.lineTo(W, gy);
    ctx.fill();
    ctx.fillStyle = '#140a26';
    ctx.fillRect(0, gy, W, H - gy);
    cRect(0, gy, W, 2, '#7a3fd8');
    const hit = lt >= GL_HIT;
    const hurt = hit && lt - GL_HIT < 24 && Math.floor((lt - GL_HIT) / 2) % 2 === 0;
    ctx.globalAlpha = k * 0.35;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(cx, gy, 30, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = k;
    if (!hurt) drawPlayerFigure(cx, gy, 1.25);
    const charge = clamp((lt - (GL_RISE[3] + 16)) / (GL_HIT - GL_RISE[3] - 16), 0, 1);
    if (!hit) {
      GL_STONES.forEach(([ox, hgt], i) => {
        const t0 = GL_RISE[i];
        if (lt < t0) return;
        const x = cx + ox;
        const p = clamp((lt - t0) / 8, 0, 1);
        const h = Math.round(hgt * (p < 1 ? p * 1.12 : 1 + 0.12 * Math.max(0, 1 - (lt - t0 - 8) / 6)));
        drawGlitchStone(x + (charge > 0 ? Math.round((Math.random() - 0.5) * charge * 4) : 0), gy, 28, h, i, charge);
        if (lt - t0 < 16) {
          const q = (lt - t0) / 16;
          for (let j = 0; j < 8; j++) {
            cRect(Math.round(x + (hash(j * 3.3 + i) - 0.5) * 50 * q), Math.round(gy - 4 - Math.sin(q * Math.PI) * (20 + hash(j + i) * 30)), 3, 3, j % 2 ? '#5a4a7a' : '#ff3eb0');
          }
        }
      });
      if (charge > 0) {
        GL_STONES.forEach(([ox, hgt], i) => {
          if (hash(Math.floor(lt / 2) + i * 5) > 0.3 + charge * 0.6) return;
          const sx = cx + ox, sy = gy - hgt + 6, tx = cx, ty = gy - 40;
          let x = sx, y = sy;
          for (let s = 1; s <= 6; s++) {
            const nx = sx + ((tx - sx) * s) / 6 + (s < 6 ? (hash(s * 3.1 + lt + i) - 0.5) * 14 : 0);
            const ny = sy + ((ty - sy) * s) / 6 + (s < 6 ? (hash(s * 1.9 + lt + i) - 0.5) * 14 : 0);
            pxLine(Math.round(x), Math.round(y), Math.round(nx), Math.round(ny), i % 2 ? '#ffffff' : '#ff3eb0');
            x = nx;
            y = ny;
          }
        });
      }
    } else {
      const d = lt - GL_HIT;
      GL_STONES.forEach(([ox, hgt], i) => {
        const x = cx + ox, y0 = gy - hgt / 2;
        for (let j = 0; j < 12; j++) {
          const a = hash(j * 2.1 + i) * Math.PI * 2, sp = 2 + hash(j * 4.3 + i) * 4;
          cRect(Math.round(x + Math.cos(a) * sp * d), Math.round(y0 + Math.sin(a) * sp * d + d * d * 0.08), 5, 4, ['#2e1e52', '#5ff0ff', '#ff3eb0', '#ffffff'][j % 4]);
        }
        if (d < 20) {
          ctx.save();
          ctx.globalAlpha *= 1 - d / 20;
          blob(x, Math.round(y0), 10 + d * 3, '#ff3eb0');
          blob(x, Math.round(y0), 6 + d * 2, '#ffffff');
          ctx.restore();
        }
      });
      if (d < 6) {
        ctx.fillStyle = `rgba(255,255,255,${0.9 - d * 0.15})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (d < 34) drawComic('-7', cx + 44, 92 - d * 0.5, d, '#ff3e3e');
    }
    if (hash(Math.floor(lt / 4) * 1.3) < 0.3) regionGlitch(3, 18);
    if (lt >= 20 && lt < 110) glitchText('GLITCH LANDSCAPE', 30, 16, '#c8a8ff');
    cutsceneBars('!! DANGER !!', 'THE GROUND ITSELF TURNS AGAINST YOU...', lt, '#7a3fd8');
    ctx.restore();
  }

  function drawDestabilize(lt) {
    const k = Math.min(clamp(lt / 8, 0, 1), clamp((DS_END - lt) / 12, 0, 1));
    const cx = W / 2;
    ctx.save();
    ctx.globalAlpha = k;
    if (lt < DS_CODE) {
      ctx.fillStyle = '#05020a';
      ctx.fillRect(0, 0, W, H);
      drawBarrierGrid(0, H, 0.12);
      const amt = lt / DS_CODE, by = 176;
      const jit = Math.round((Math.random() - 0.5) * amt * 6);
      ctx.globalAlpha = k * 0.35;
      drawPlayerFigure(cx - 2 - amt * 10, by, 1.25);
      drawPlayerFigure(cx + 2 + amt * 10, by, 1.25);
      ctx.globalAlpha = k;
      drawPlayerFigure(cx + jit, by, 1.25);
      for (let i = 0; i < Math.floor(amt * 34); i++) {
        const q = (lt * 0.02 + hash(i * 1.3)) % 1;
        cRect(Math.round(cx + (hash(i * 2.7) - 0.5) * 50 + (hash(i * 5.1) - 0.5) * q * 80), Math.round(by - 20 - hash(i * 3.3) * 60 - q * 60), 3, 3, ['#5ff0ff', '#ff3eb0', '#ffffff'][i % 3]);
      }
      if (hash(Math.floor(lt / 2)) < 0.3 + amt * 0.6) regionGlitch(2 + Math.floor(amt * 4), 10 + amt * 30);
      if (lt > DS_CODE - 6) {
        ctx.fillStyle = `rgba(255,255,255,${(lt - (DS_CODE - 6)) / 6})`;
        ctx.fillRect(0, 0, W, H);
      }
    } else {
      const sp = lt - DS_CODE;
      ctx.fillStyle = '#020610';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        const a = hash(i * 1.7) * Math.PI * 2, r0 = (sp * 6 + hash(i * 3.1) * 300) % 300;
        ctx.globalAlpha = k * Math.min(1, r0 / 120) * 0.6;
        ctx.strokeStyle = i % 3 ? '#5ff0ff' : '#ff3eb0';
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, 108 + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * (r0 + 14 + r0 * 0.3), 108 + Math.sin(a) * (r0 + 14 + r0 * 0.3));
        ctx.stroke();
      }
      for (let c = 0; c < 24; c++) {
        const x = c * 16 + 4, speed = 3 + (c % 4);
        for (let r = 0; r < 8; r++) {
          const y = ((sp * speed + c * 37 + r * 28) % (H + 40)) - 20;
          ctx.globalAlpha = k * (1 - r * 0.1) * 0.8;
          const ch = hash(c * 7 + r * 3 + Math.floor((sp + r * 5) / 8)) < 0.5 ? '0' : '1';
          drawText(ch, x, Math.round(y), 8, r === 0 ? '#e0ffff' : c % 3 ? '#2ad8a0' : '#5ff0ff', 'left', null);
        }
      }
      ctx.restore();
      const beam = lt >= DS_BEAM;
      const px = beam ? 110 : cx - 30 + Math.sin(sp * 0.07) * 30, py = beam ? 120 : 112 + Math.sin(sp * 0.11) * 10;
      const hitD = lt - DS_HIT;
      if (!(hitD >= 0 && hitD < 34 && tick % 4 < 2)) {
        ctx.save();
        ctx.translate(Math.round(px), Math.round(py));
        if (!beam) ctx.rotate(sp * 0.08);
        ctx.globalAlpha = k * 0.4;
        drawPlayerFigure(-3, 30, 0.9);
        drawPlayerFigure(3, 30, 0.9);
        ctx.globalAlpha = k;
        drawPlayerFigure(0, 30, 0.9);
        ctx.restore();
      }
      if (beam) {
        const ap = fgEase(clamp((lt - DS_BEAM) / 14, 0, 1));
        const coreX = W - 60 + (1 - ap) * 140, coreY = py;
        const sx = coreX - 26, sy = py;
        if (hitD < 0) {
          drawBigCore(coreX, coreY, 1.8, { rage: 1, glitch: false, lookX: -1 });
          const c = (lt - DS_BEAM) / (DS_HIT - DS_BEAM);
          blob(Math.round(sx), Math.round(sy), Math.round(4 + c * 16), '#ff3eb0');
          blob(Math.round(sx), Math.round(sy), Math.round(2 + c * 8), '#ffffff');
          for (let j = 0; j < 10; j++) {
            const a = (j / 10) * Math.PI * 2 + lt * 0.3, r = (1 - c) * 50 + 6;
            cRect(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r), 2, 2, j % 2 ? '#5ff0ff' : '#ffffff');
          }
        } else {
          drawBigCore(coreX, coreY, 1.8, { rage: 1, glitch: false, lookX: -1 });
          const fade = hitD < 30 ? 1 : clamp(1 - (hitD - 30) / 14, 0, 1);
          const hw = 40 * (0.9 + 0.1 * Math.sin(hitD * 1.3)) * Math.min(1, (hitD + 1) / 4);
          ctx.save();
          for (const [h, col, a] of [[hw + 10, '#7a3fd8', 0.5], [hw, '#ff3eb0', 0.85], [hw * 0.65, '#5ff0ff', 0.95], [hw * 0.35, '#ffffff', 1]]) {
            ctx.globalAlpha = k * a * fade;
            ctx.fillStyle = col;
            ctx.fillRect(0, Math.round(sy - h), Math.round(sx), Math.round(h * 2));
          }
          ctx.globalAlpha = k * fade;
          for (let j = 0; j < 14; j++) cRect(Math.round(hash(j * 3.7 + hitD) * sx), Math.round(sy + (hash(j * 1.3 + hitD) - 0.5) * hw * 2.4), 6, 2, j % 2 ? '#ffffff' : '#ff3eb0');
          ctx.restore();
          if (hitD < 4) {
            ctx.fillStyle = `rgba(255,255,255,${0.9 - hitD * 0.2})`;
            ctx.fillRect(0, 0, W, H);
          }
          if (hitD < 34) drawComic('-8', 150, 56 - hitD * 0.4, hitD, '#ff3e3e');
        }
      }
      if (sp < 4) {
        ctx.fillStyle = `rgba(255,255,255,${1 - sp / 4})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
    if (lt >= 16 && lt < DS_HIT) glitchText('DESTABILIZE', 30, 16, '#5ff0ff');
    const cap = lt < DS_CODE ? 'YOU START TO DESTABILIZE...' : lt < DS_BEAM ? 'YOU FALL THROUGH THE CODE...' : 'THE CORE FIRES A MASSIVE BEAM!';
    cutsceneBars('!! DANGER !!', cap, lt < DS_CODE ? lt : lt < DS_BEAM ? lt - DS_CODE : lt - DS_BEAM, '#5ff0ff');
    ctx.restore();
  }

  function drawCoreOverload(lt, eBaseX) {
    const cx = eBaseX + 18, cy = 54;
    if (lt < OVERLOAD_BOOM) {
      const n = Math.floor(lt / 14) + 1;
      ctx.save();
      for (let i = 0; i < n; i++) {
        const a = hash(i * 2.9) * Math.PI * 2 + Math.sin(tick * 0.02 + i) * 0.1;
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(tick * 0.5 + i);
        ctx.fillStyle = i % 2 ? '#ffffff' : '#c8a8ff';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a - 0.04) * 300, cy + Math.sin(a - 0.04) * 300);
        ctx.lineTo(cx + Math.cos(a + 0.04) * 300, cy + Math.sin(a + 0.04) * 300);
        ctx.fill();
      }
      ctx.restore();
      for (let j = 0; j < 5; j++) {
        if (hash(j * 3.3 + Math.floor(tick / 3)) > lt / OVERLOAD_BOOM) continue;
        const a = hash(j * 1.1 + tick) * Math.PI * 2, r = 30 + hash(j + tick) * 20;
        pxLine(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.6), Math.round(cx + Math.cos(a) * (r + 10)), Math.round(cy + Math.sin(a) * (r + 10) * 0.6), j % 2 ? '#ffe14d' : '#5ff0ff');
      }
      if (lt > 20 && hash(Math.floor(lt / 3)) < 0.4) regionGlitch(3, 8 + lt / 8);
    } else {
      const d = lt - OVERLOAD_BOOM;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - d / 40);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, d * 8, d * 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 30; i++) {
        const a = hash(i * 2.3) * Math.PI * 2, sp = 1.5 + hash(i * 4.1) * 3;
        cRect(Math.round(cx + Math.cos(a) * sp * d), Math.round(cy + Math.sin(a) * sp * d + d * d * 0.05), 4, 3, ['#5e4e86', '#5ff0ff', '#ff3eb0', '#2e2248'][i % 4]);
      }
      ctx.restore();
      if (d < 8) {
        ctx.fillStyle = `rgba(255,255,255,${1 - d / 8})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  const CL_W = 2000, CL_G = 1300, CL_STAIR_X = 1460, CL_RISE = 22, CL_RUN = 34, CL_STEP_W = 28;
  const CL_STEPS = [];
  for (let i = 0, x = CL_STAIR_X; i < 50; i++) {
    if (i % 8 !== 0) x += (Math.floor(i / 8) % 2 === 0 ? 1 : -1) * CL_RUN;
    CL_STEPS.push({ x, y: CL_G - CL_RISE * (i + 1) });
  }
  const CL_TOP = CL_G - CL_RISE * 51;
  const CL_SUMMIT = { x: 1520, w: 470 };
  const CL_CORE_X = 1890, CL_CORE_Y = CL_TOP - 62, CL_TRIGGER = 1700, CL_MAX_X = 1790;
  const CL_CAM_MAX_Y = CL_G + 30 - H;
  const CL_WHISPERS = [
    [420, CL_G - 70, 'NOTHING GROWS HERE ANYMORE'], [900, CL_G - 70, 'THE GLITCH TOOK THE COLOR'], [1300, CL_G - 80, 'LOOK UP...'],
    [1580, CL_G - 330, 'HIGHER...'], [1580, CL_G - 640, 'ABOVE THE CLOUDS...'], [1580, CL_G - 900, 'IT IS WATCHING YOU'], [1640, CL_TOP - 60, 'THE CORE AWAITS'],
  ];
  const climb = { state: 'walk', t: 0, camX: 0, camY: CL_CAM_MAX_Y, stab: 0 };
  const CORE_MEET_LINES = ['WHAT... IS THAT THING?'];
  const CORE_LINES = [
    'SO. YOU CLIMBED ALL THE WAY UP HERE.',
    'I AM THE CORE. THE HEART OF THE GLITCH.',
    'EVERY CRACK IN THIS WORLD... I MADE IT.',
    'THE KID. THE GHOST. THE MECH. ALL MINE.',
    'AND YOU KEEP FIXING WHAT I BREAK, {NAME}.',
    'NO MORE. THIS WORLD WILL BE DELETED.',
    'AND YOU... WILL BE DELETED FIRST.',
  ];
  const CORE_AGAIN_LINES = ['YOU ARE STILL HERE?', 'DELETING... AGAIN.'];
  const CORE_DEATH_LINES = [
    'ERROR... ERROR... CORE UNSTABLE...',
    'IMPOSSIBLE... YOU FIXED... ME?',
    'THE WORLD... IS... STABILIZING...',
    'N... O...',
  ];
  const ST_BOOM = 140, ST_PAN = 250, ST_DONE = 620;

  function enterClimb() {
    game.mode = 'climb';
    toast.t = 0;
    Object.assign(climb, { state: 'walk', t: 0, camX: 0, camY: CL_CAM_MAX_Y, stab: 0 });
    Object.assign(player, { x: 24, y: CL_G - player.h, vx: 0, vy: 0, face: 1, onGround: true, walk: 0 });
    showTitle('THE BARREN FOREST', '- CHAPTER 7 -');
  }

  function climbAtSummit(x) {
    Object.assign(player, { x, y: CL_TOP - player.h, vx: 0, vy: 0, face: 1, onGround: true, walk: 0 });
    climb.camX = clamp(x - W / 2 + 20, 0, CL_W - W);
    climb.camY = clamp(player.y - 110, 0, CL_CAM_MAX_Y);
  }

  function fightCore() {
    climb.state = 'fight';
    startBattleTransition('core', winCore, () => {
      Object.assign(climb, { state: 'ready', t: 0 });
      climbAtSummit(CL_TRIGGER - 120);
    }, 'climb');
  }

  function winCore() {
    Object.assign(climb, { state: 'dying', t: 0 });
    climbAtSummit(CL_TRIGGER);
    startDialog(CORE_DEATH_LINES, () => {
      climb.state = 'stabilize';
      climb.t = 0;
    }, 'THE CORE');
  }

  function updateClimb() {
    updateDialog();
    const c = climb;
    c.t++;
    const free = c.state === 'walk' || c.state === 'ready';
    const locked = dialog.active || fade.dir !== 0 || inv.open || !free;
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
    player.x = clamp(player.x + player.vx, 8, CL_MAX_X);
    const wasGround = player.onGround;
    const prevBottom = player.y + player.h;
    player.y += player.vy;
    player.onGround = false;
    if (player.vy >= 0) {
      let floor = CL_G;
      const over = (x, w) => player.x + player.w > x && player.x < x + w;
      for (const s of CL_STEPS) {
        if (over(s.x, CL_STEP_W) && prevBottom <= s.y + 0.5 && player.y + player.h >= s.y) floor = Math.min(floor, s.y);
      }
      if (over(CL_SUMMIT.x, CL_SUMMIT.w) && prevBottom <= CL_TOP + 0.5 && player.y + player.h >= CL_TOP) floor = Math.min(floor, CL_TOP);
      if (player.y + player.h >= floor) {
        player.y = floor - player.h;
        player.vy = 0;
        player.onGround = true;
      }
    }
    if (player.onGround && !wasGround) sfx('land');
    if (player.onGround && Math.abs(player.vx) > 0.3) {
      const prevWalk = player.walk;
      player.walk += Math.abs(player.vx) * 0.12;
      if (Math.floor(player.walk / 1.6) !== Math.floor(prevWalk / 1.6)) sfx('step');
    } else {
      player.walk = 0;
    }
    if (c.state !== 'stabilize' && c.state !== 'outro') {
      const scene = ['meet', 'talk', 'again', 'dying', 'pose', 'fight'].includes(c.state);
      const tx = clamp(scene ? CL_CORE_X - W + 90 : player.x - W / 2 + 20, 0, CL_W - W), ty = clamp(player.y - 110, 0, CL_CAM_MAX_Y);
      c.camX += (tx - c.camX) * 0.12;
      c.camY += (ty - c.camY) * 0.12;
    }
    const onSummit = player.onGround && player.y + player.h <= CL_TOP + 1;

    if (c.state === 'walk' && !locked && onSummit && player.x > CL_TRIGGER) {
      c.state = 'meet';
      c.t = 0;
      player.vx = 0;
      player.face = 1;
      sfx('coreHum');
    } else if (c.state === 'meet') {
      if (c.t === 30) sfx('glitch');
      if (c.t === 80) {
        c.state = 'talk';
        startDialog(CORE_MEET_LINES, () => startDialog(CORE_LINES, () => {
          c.state = 'pose';
          c.t = 0;
        }, 'THE CORE'), playerName);
      }
    } else if (c.state === 'talk') {
      if (c.t % 90 === 45) sfx('glitch');
    } else if (c.state === 'pose') {
      if (c.t === 1) sfx('coreIntro');
      if (c.t === 44) sfx('crash');
      if (c.t === 230) fightCore();
    } else if (c.state === 'ready' && !locked && onSummit && player.x > CL_TRIGGER) {
      c.state = 'again';
      player.vx = 0;
      player.face = 1;
      startDialog(CORE_AGAIN_LINES, fightCore, 'THE CORE');
    } else if (c.state === 'dying') {
      if (c.t % 60 === 30) sfx('spark');
    } else if (c.state === 'stabilize') {
      const t = c.t;
      if (t === 1) sfx('coreAlarm');
      if (t < ST_BOOM && t % 12 === 0) sfx(t % 24 ? 'spark' : 'glitch');
      if (t === ST_BOOM) sfx('megaBoom');
      if (t === ST_BOOM + 10) sfx('stabilize');
      if (t === 460) sfx('superDing');
      c.stab = fgEase(clamp((t - ST_BOOM - 20) / 180, 0, 1));
      if (t === ST_PAN) {
        c.panX = c.camX;
        c.panY = c.camY;
      }
      if (t >= ST_PAN) {
        const p = fgEase(clamp((t - ST_PAN) / 260, 0, 1));
        c.camX = c.panX + (900 - c.panX) * p;
        c.camY = c.panY + (CL_CAM_MAX_Y - c.panY) * p;
      }
      if (t === ST_DONE) {
        c.state = 'outro';
        c.t = 0;
        finishRun();
      }
    } else if (c.state === 'outro') {
      if (c.t === 330) {
        fadeThen(() => {
          game.mode = 'eye';
          eye.phase = 'end';
          eye.t = 0;
          tpJustUnlocked = unlockTeleport();
        });
      }
    }
  }

  function drawDeadTree(x, base, h, seed, stab) {
    const trunk = mixHex('#2e2428', '#5a3a22', stab);
    cRect(x - 3, base - h, 6, h, trunk);
    cRect(x - 3, base - h, 2, h, mixHex('#3e3438', '#6e4a2a', stab));
    for (let k = 0; k < 4; k++) {
      const by = base - h + 8 + k * Math.floor(h / 5);
      const sd = (k + seed) % 2 ? 1 : -1, len = 10 + ((seed * 7 + k * 5) % 12);
      pxLine(x, by, x + sd * len, by - 8 - (k % 2) * 4, trunk);
      pxLine(x + sd * Math.floor(len * 0.6), by - 5, x + sd * (len - 2), by - 14, trunk);
    }
    pxLine(x, base - h, x - 4, base - h - 10, trunk);
    pxLine(x, base - h, x + 5, base - h - 8, trunk);
    if (stab > 0) {
      ctx.save();
      ctx.globalAlpha *= stab;
      blob(x, base - h - 2, 16, '#2e7d32');
      blob(x - 11, base - h + 8, 11, '#3a8a40');
      blob(x + 12, base - h + 6, 12, '#4caf50');
      ctx.restore();
    }
  }

  function renderClimb() {
    const c = climb, camX = Math.round(c.camX), camY = Math.round(c.camY), stab = c.stab;
    const st = c.state === 'stabilize' ? c.t : -1;
    let shake = 0;
    if (st >= 0 && st < ST_BOOM) shake = 1 + st / 30;
    else if (st >= ST_BOOM && st < ST_BOOM + 30) shake = 8;
    ctx.save();
    if (shake) ctx.translate(Math.round((Math.random() - 0.5) * shake * 2), Math.round((Math.random() - 0.5) * shake));
    const alt = clamp(1 - camY / CL_CAM_MAX_Y, 0, 1);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, mixHex(alt > 0.6 ? '#05020c' : '#1a1620', '#3a7ad8', stab));
    sky.addColorStop(1, mixHex(alt > 0.6 ? '#2a1050' : '#3a3040', '#bfe4ff', stab));
    ctx.fillStyle = sky;
    ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.save();
    ctx.globalAlpha = 0.5 * (1 - Math.abs(alt - 0.55) * 1.6) * (1 - stab);
    if (ctx.globalAlpha > 0) {
      ctx.fillStyle = '#4a2a7a';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    if (alt > 0.4) {
      ctx.save();
      ctx.globalAlpha = (alt - 0.4) * 1.6 * (1 - stab);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = i % 5 ? '#ffffff' : i % 2 ? '#5ff0ff' : '#ff3eb0';
        ctx.fillRect((i * 97 + 13) % W, (i * 53 + Math.floor(camY * 0.05)) % H, 1, hash(i + Math.floor(tick / 20)) < 0.5 ? 1 : 2);
      }
      ctx.restore();
    }
    if (stab > 0) {
      ctx.save();
      ctx.globalAlpha = stab;
      blob(310, 46, 22, '#fff3a8');
      blob(310, 46, 16, '#ffe14d');
      ctx.globalAlpha = stab * 0.25;
      blob(310, 46, 40, '#fff3a8');
      ctx.restore();
    }
    const groundY = CL_G - camY;
    if (groundY < H + 120) {
      ctx.fillStyle = mixHex('#241e2a', '#5a8a6a', stab);
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      for (let x = 0; x <= W; x += 12) ctx.lineTo(x, groundY - 50 - Math.sin((x + camX * 0.2) * 0.02) * 18 - Math.sin((x + camX * 0.2) * 0.051) * 7);
      ctx.lineTo(W, groundY);
      ctx.fill();
      for (let i = 0; i < 16; i++) {
        const tx = Math.round(((i * 61 - camX * 0.4) % (W + 60) + W + 60) % (W + 60)) - 30;
        drawDeadTree(tx, groundY - 22, 30 + ((i * 13) % 20), i, stab * 0.8);
      }
    }

    ctx.save();
    ctx.translate(-camX, -camY);
    ctx.fillStyle = mixHex('#2a2428', '#6b4220', stab);
    ctx.fillRect(camX - 8, CL_G, W + 16, H + 40);
    for (let x = Math.max(0, Math.floor(camX / 16) * 16); x < Math.min(CL_W, camX + W + 16); x += 16) {
      cRect(x, CL_G, 16, 2, mixHex(hash(x * 0.21) < 0.2 ? '#6a5a4a' : '#4a4038', '#4caf3a', stab));
      if (hash(x * 0.37) < 0.4) cRect(x + 4, CL_G + 8 + Math.floor(hash(x) * 20), 8, 1, '#1a1418');
      if (hash(x * 0.53) < 0.3) {
        cRect(x + 6, CL_G - 3, 1, 3, mixHex('#6a5a3a', '#3a8a2c', stab));
        cRect(x + 8, CL_G - 2, 1, 2, mixHex('#6a5a3a', '#3a8a2c', stab));
      }
    }
    for (let i = 0; i < 11; i++) {
      const tx = 90 + i * 128 + ((i * 37) % 40);
      if (tx < camX - 60 || tx > camX + W + 60) continue;
      drawDeadTree(tx, CL_G, 56 + ((i * 17) % 28), i + 3, stab);
    }
    for (let i = 0; i < 6; i++) {
      const rx = 200 + i * 230;
      cRect(rx, CL_G - 5, 14, 5, '#3e3640');
      cRect(rx + 2, CL_G - 7, 8, 2, '#4e4650');
    }
    const ext = 1 - stab;
    CL_STEPS.forEach((s, i) => {
      if (s.x < camX - 40 || s.x > camX + W + 10 || s.y < camY - 20 || s.y > camY + H + 20) return;
      const near = Math.abs(player.x - s.x - 14) < 60 && Math.abs(player.y + player.h - s.y) < 70;
      let a = 0.3 + 0.25 * Math.sin(tick * 0.05 + i * 0.7) + (near ? 0.3 : 0);
      if (hash(Math.floor(tick / 4) + i * 3.3) < 0.04 * ext) a *= 0.3;
      ctx.save();
      ctx.globalAlpha = a * ext + stab;
      ctx.globalAlpha = Math.min(1, ctx.globalAlpha);
      const gx = hash(Math.floor(tick / 5) + i * 1.9) < 0.06 * ext ? (hash(tick + i) < 0.5 ? -2 : 2) : 0;
      cRect(s.x + gx, s.y, CL_STEP_W, 6, mixHex('#7a3fd8', '#9a948c', stab));
      cRect(s.x + gx, s.y, CL_STEP_W, 1, mixHex('#e0c8ff', '#d8d2c8', stab));
      cRect(s.x + gx, s.y + 5, CL_STEP_W, 1, mixHex('#3a1a6a', '#6a645c', stab));
      if (ext > 0 && hash(i * 7.1 + Math.floor(tick / 8)) < 0.3) {
        ctx.globalAlpha = a * ext * 0.6;
        cRect(s.x + 4 + Math.floor(hash(i) * 18), s.y + 7 + ((tick + i * 5) % 10), 2, 2, i % 2 ? '#5ff0ff' : '#ff3eb0');
      }
      ctx.restore();
    });
    {
      const sx = CL_SUMMIT.x, sw = CL_SUMMIT.w;
      ctx.save();
      ctx.globalAlpha = 0.85 + 0.15 * stab;
      cRect(sx, CL_TOP, sw, 10, mixHex('#3a2466', '#8a847c', stab));
      cRect(sx, CL_TOP, sw, 2, mixHex('#c8a8ff', '#e8e2d8', stab));
      for (let x = sx + 6; x < sx + sw - 6; x += 22) cRect(x, CL_TOP + 4, 10, 1, mixHex('#5ff0ff', '#6a645c', stab));
      for (let i = 0; i < 10; i++) {
        const x = sx + 10 + i * 46, len = 6 + ((i * 7) % 12);
        cRect(x, CL_TOP + 10, 6, len, mixHex('#2a1a4a', '#6a645c', stab));
      }
      ctx.restore();
    }
    for (const [wx, wy, text] of CL_WHISPERS) {
      const dist = Math.hypot(player.x - wx, (player.y - wy) * 1.5);
      if (dist > 170 || stab > 0) continue;
      ctx.save();
      ctx.globalAlpha = (1 - dist / 170) * (hash(Math.floor(tick / 4) + wx + wy) < 0.15 ? 0.3 : 0.8);
      drawText(text, wx - 2, wy, 8, '#ff3eb0', 'center', null);
      drawText(text, wx + 2, wy, 8, '#5ff0ff', 'center', null);
      drawText(text, wx, wy, 8, '#e8e0ff', 'center', null);
      ctx.restore();
    }
    const coreBob = Math.round(Math.sin(tick * 0.04) * 4);
    const showCore = !['stabilize', 'outro'].includes(c.state) || st < ST_BOOM;
    if (showCore) {
      const cy = CL_CORE_Y + coreBob;
      const crack = st >= 0 ? clamp(st / ST_BOOM, 0, 1) : c.state === 'dying' ? 0.3 : 0;
      const jit = crack ? Math.round((Math.random() - 0.5) * crack * 6) : 0;
      const near = clamp((320 - Math.hypot(player.x - CL_CORE_X, player.y - CL_CORE_Y)) / 140, 0, 1);
      const eye = c.state === 'walk' ? near : c.state === 'meet' ? Math.max(near, clamp(c.t / 30, 0, 1)) : 1;
      drawBigCore(CL_CORE_X + jit, cy, 2.3, {
        rage: ['pose', 'again', 'talk'].includes(c.state) ? 1 : 0, crack, eye,
        lookX: clamp((player.x - CL_CORE_X) / 150, -1, 1),
      });
      if (st >= 0 && st < ST_BOOM) {
        ctx.save();
        const n = Math.floor(st / 12) + 1;
        for (let i = 0; i < n; i++) {
          const a = hash(i * 2.9) * Math.PI * 2;
          ctx.globalAlpha = 0.3 + 0.2 * Math.sin(tick * 0.5 + i);
          ctx.fillStyle = i % 2 ? '#ffffff' : '#fff3a8';
          ctx.beginPath();
          ctx.moveTo(CL_CORE_X, cy);
          ctx.lineTo(CL_CORE_X + Math.cos(a - 0.05) * 500, cy + Math.sin(a - 0.05) * 500);
          ctx.lineTo(CL_CORE_X + Math.cos(a + 0.05) * 500, cy + Math.sin(a + 0.05) * 500);
          ctx.fill();
        }
        ctx.restore();
      }
    }
    if (st >= ST_BOOM && st < ST_BOOM + 200) {
      const d = st - ST_BOOM;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - d / 200);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(CL_CORE_X, CL_CORE_Y, d * 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#fff3a8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(CL_CORE_X, CL_CORE_Y, d * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    let frame = 0;
    if (!player.onGround) frame = 1;
    else if (player.walk > 0) frame = walkFrame(player.walk);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(Math.round(player.x), Math.round(player.y + player.h) - 1, player.w, 1);
    drawImg(playerFrames[frame], player.x - 2, player.y, player.face);
    if (c.state === 'meet' && c.t > 10) drawText('!', player.x + 5, player.y - 14, 8, '#ffe14d', 'center', '#1a1420');
    if (c.state === 'ready' && tick % 60 < 40) drawText('!', CL_CORE_X, CL_CORE_Y - 62, 8, '#5ff0ff', 'center', '#1a1420');

    for (let i = 0; i < 22; i++) {
      const wx = ((i * 137 + tick * (0.15 + (i % 3) * 0.08)) % (CL_W + 200)) - 100;
      const wy = 560 + ((i * 47) % 150);
      if (wx < camX - 80 || wx > camX + W + 80 || wy < camY - 60 || wy > camY + H + 60) continue;
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.2 * stab;
      const col = mixHex('#4a3a6e', '#ffffff', stab), hi = mixHex('#6a5a8e', '#ffffff', stab);
      blob(Math.round(wx), wy, 26 + (i % 3) * 8, col);
      blob(Math.round(wx + 22), wy + 4, 20, col);
      blob(Math.round(wx - 6), wy - 8, 14, hi);
      ctx.restore();
    }
    ctx.restore();

    if (ext > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5 * ext;
      for (let i = 0; i < 18; i++) {
        const fx = (i * 71 + 13) % W, fy = (i * 37 + tick * (0.3 + (i % 3) * 0.15)) % H;
        cRect(fx + Math.round(Math.sin(tick * 0.03 + i) * 4), Math.round(fy), 2, 2, alt > 0.5 ? (i % 2 ? '#5ff0ff' : '#ff3eb0') : '#8a8090');
      }
      ctx.restore();
    }
    if (st >= ST_BOOM) {
      ctx.save();
      for (let i = 0; i < 40; i++) {
        const p = ((st - ST_BOOM) * (0.004 + (i % 5) * 0.0015) + i / 40) % 1;
        ctx.globalAlpha = (1 - p) * ext;
        cRect(Math.round((i * 53 + 7) % W + Math.sin(p * 8 + i) * 6), Math.round(H - p * (H + 20)), 2 + (i % 3), 2 + (i % 3), ['#5ff0ff', '#ff3eb0', '#ffffff', '#7a3fd8'][i % 4]);
      }
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = 0.06 * ext;
    ctx.fillStyle = '#ffffff';
    for (let sy = tick % 4; sy < H; sy += 4) ctx.fillRect(0, sy, W, 1);
    ctx.restore();
    if (ext > 0 && hash(Math.floor(tick / 5) * 2.9) < (0.04 + alt * 0.05) * ext) crashGlitchSlices(0.4);
    if (st >= ST_BOOM && st < ST_BOOM + 70) {
      ctx.fillStyle = `rgba(255,255,255,${st < ST_BOOM + 20 ? 1 : 1 - (st - ST_BOOM - 20) / 50})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    if (st >= 200 && st < ST_DONE) {
      const text = 'THE WORLD IS STABILIZING...';
      ctx.save();
      ctx.globalAlpha = clamp((ST_DONE - st) / 30, 0, 1);
      drawText(text.slice(0, Math.floor((st - 200) / 3)), W / 2, 14, 8, '#ffffff', 'center', '#1a2a4a');
      ctx.restore();
    }
    if (st >= 460 && st < ST_DONE) {
      const d = st - 460, slam = Math.max(0, 1 - d / 8);
      ctx.save();
      ctx.globalAlpha = clamp((ST_DONE - st) / 30, 0, 1);
      ctx.translate(W / 2, H / 2 - 20);
      ctx.scale(1 + slam, 1 + slam);
      for (let k = 4; k >= 1; k--) drawText('STABILIZED', k, -12 + k, 24, '#1a3a6a', 'center', null);
      drawText('STABILIZED', 0, -12, 24, '#fff3a8', 'center', null);
      ctx.restore();
      if (d < 6) {
        ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - d / 6)})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
    if (c.state === 'outro') {
      ctx.fillStyle = `rgba(0,0,0,${clamp((c.t - 60) / 40, 0, 1)})`;
      ctx.fillRect(0, 0, W, H);
      if (c.t > 110) {
        const text = 'TO BE CONTINUED...';
        drawText(text.slice(0, Math.floor((c.t - 110) / 4)), W / 2, H / 2 - 8, 16, '#ffe14d', 'center', '#5a3a1a');
      }
    }
    if (c.state === 'pose') {
      ctx.save();
      if (c.t >= 44 && c.t < 60) ctx.translate(c.t % 2 ? 3 : -3, 0);
      renderCoreIntro(c.t);
      ctx.restore();
    } else if (c.state !== 'outro') {
      drawDialog();
      drawTitle();
      drawToast();
      if (canOpenInventory() || inv.open) drawBagButton();
      if (inv.open) drawInventory();
    }
  }

  function renderCoreIntro(t) {
    const k = clamp(t / 12, 0, 1), cx = W / 2;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = '#04020c';
    ctx.fillRect(0, 0, W, H);
    for (let c = 0; c < 24; c++) {
      const x = c * 16 + 4, speed = 1.5 + (c % 4) * 0.6;
      for (let r = 0; r < 6; r++) {
        const y = ((t * speed + c * 37 + r * 30) % (H + 40)) - 20;
        ctx.globalAlpha = k * (0.35 - r * 0.05);
        drawText(hash(c * 7 + r * 3 + Math.floor((t + r * 5) / 10)) < 0.5 ? '0' : '1', x, Math.round(y), 8, c % 3 ? '#7a3fd8' : '#5ff0ff', 'left', null);
      }
    }
    for (let i = 0; i < 16; i++) {
      const a = i * 0.3927 + t * 0.01;
      ctx.globalAlpha = k * 0.1;
      ctx.fillStyle = i % 2 ? '#5ff0ff' : '#9a5aff';
      ctx.beginPath();
      ctx.moveTo(cx, 140);
      ctx.lineTo(cx + Math.cos(a - 0.07) * 400, 140 + Math.sin(a - 0.07) * 400);
      ctx.lineTo(cx + Math.cos(a + 0.07) * 400, 140 + Math.sin(a + 0.07) * 400);
      ctx.fill();
    }
    ctx.globalAlpha = k;
    const rise = Math.pow(clamp(1 - t / 24, 0, 1), 2) * 140;
    drawBigCore(cx, 150 + rise + Math.sin(t * 0.06) * 3, 3.6, { rage: t > 44 ? 1 : 0, eye: clamp((t - 24) / 10, 0, 1), lookX: 0 });
    if (t >= 30 && t < 36) {
      ctx.fillStyle = `rgba(95,240,255,${0.5 * (1 - (t - 30) / 6)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (t >= 20) {
      const subX = cx + Math.pow(clamp(1 - (t - 20) / 14, 0, 1), 2) * 400;
      for (let d = 4; d >= 1; d--) drawText('THE HEART OF THE GLITCH', subX + d, 10 + d, 16, '#1a0a3a', 'center', null);
      drawText('THE HEART OF THE GLITCH', subX, 10, 16, '#d8c8ff', 'center', null);
    }
    if (t >= 44) {
      const slam = Math.max(0, 1 - (t - 44) / 6);
      const rg = hash(Math.floor(t / 3) * 1.7) < 0.35 ? 5 : 2;
      ctx.save();
      ctx.translate(cx, 64);
      ctx.scale(1 + slam * 0.8, 1 + slam * 0.8);
      for (let d = 6; d >= 1; d--) drawText('THE CORE', d, -16 + d, 32, '#120a2a', 'center', null);
      ctx.globalAlpha = 0.8;
      drawText('THE CORE', -rg, -16, 32, '#ff3eb0', 'center', null);
      drawText('THE CORE', rg, -16, 32, '#5ff0ff', 'center', null);
      ctx.globalAlpha = 1;
      drawText('THE CORE', 0, -16, 32, '#ffffff', 'center', null);
      ctx.restore();
      if (t < 50) {
        ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - (t - 44) / 6)})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
    ctx.restore();
    if (t > 44 && hash(Math.floor(t / 4) * 2.3) < 0.35) crashGlitchSlices(0.6);
    if (t > 206) {
      ctx.fillStyle = `rgba(0,0,0,${clamp((t - 206) / 20, 0, 1)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- Admin panel ----------
  const admin = { open: false, sel: 0, page: 'main', scroll: 0 };
  const ADMIN_PANEL = { x: 72, y: 0, w: 240, h: 216 };

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

  const GEM_ORDER = ['fireGem', 'leafGem', 'swapCrystal', 'angelCrystal', 'skyGem', 'lightGem', 'knightCrystal', 'archerCrystal', 'jokerCrystal', 'kingCrystal', 'mechCrystal', 'captainCrystal', 'brokenCrystal', 'forgerCrystal', 'glitchCrystal'];
  function adminGiveGems(count) {
    for (const id of GEM_ORDER.slice(0, count)) addItem(id);
    if (inventory.includes('swapCrystal')) crystal.taken = true;
  }

  const adminHeader = (label) => ({ label, header: true });
  const adminGo = (gems, spot) => () => { adminGiveGems(gems); adminTeleport(...spot()); };
  const lastSkyCloud = SKY_CLOUDS[SKY_CLOUDS.length - 1];

  const ADMIN_OPTIONS = [
    adminHeader('- GRASSLANDS -'),
    { label: 'START', go: adminGo(0, () => groundSpot(SPAWN_X)) },
    { label: 'TO RED KID', go: adminGo(0, () => groundSpot(NPC_X - 70)) },
    { label: 'BEHIND RED KID', go: () => adminTeleport(...groundSpot(NPC_X + 80)) },
    { label: 'THE JUNGLE TREE', go: adminGo(1, () => groundSpot(TREE_SPAWN_X)) },
    { label: 'TO MONKEY', go: adminGo(1, () => [BRANCHES[4].x + 4, BRANCHES[4].y - 18]) },
    { label: 'BEHIND MONKEY', go: () => { adminGiveGems(1); adminTeleport(...groundSpot(VINE_WALL.x + 40)); } },
    {
      label: 'THE TREE HOUSE',
      go: () => {
        adminGo(2, () => [HOUSE.x + 40, HOUSE.floorY - 18])();
        monkey.state = 'gone';
        vines.state = 'gone';
      },
    },
    { label: 'THE MOUNTAIN', go: adminGo(3, () => groundSpot(MOUNTAIN_X - 40)) },
    { label: 'MOUNTAIN TOP', go: adminGo(3, () => [PLATEAU_X + 20, PLATEAU_Y - 18]) },
    adminHeader('- THE SKY LANDS -'),
    { label: 'THE SKY CLOUDS', go: adminGo(3, () => [YCLOUD.x + 40, SKY_Y - 18]) },
    { label: 'TO ANGEL', go: adminGo(3, () => [lastSkyCloud.x + 8, lastSkyCloud.y - 18]) },
    { label: 'BEHIND ANGEL', go: () => { adminGiveGems(3); adminTeleport(C2_START.x + 80, C2 - 18); } },
    { label: 'CLOUD MAP MIDDLE', go: adminGo(4, () => [C2_MID.x + 40, C2_MID.y - 18]) },
    { label: 'TO SKY BIRD', go: adminGo(4, () => [C2_CLOUDS[C2_CLOUDS.length - 2].x + 4, C2_CLOUDS[C2_CLOUDS.length - 2].y - 18]) },
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
    adminHeader('- THE CASTLE -'),
    { label: 'THE COMA', go: () => { adminGiveGems(6); adminTeleport(...groundSpot(SPAWN_X)); startComa(); } },
    { label: 'THE CASTLE', go: () => { adminGiveGems(6); adminTeleport(...groundSpot(SPAWN_X)); enterCastle(96); } },
    {
      label: 'TO THE KNIGHT',
      go: () => {
        adminGiveGems(6);
        adminTeleport(...groundSpot(SPAWN_X));
        if (knight.state !== 'idle') knight.state = 'idle';
        enterCastle(knight.x - 90);
        player.face = 1;
      },
    },
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
    adminHeader('- THE SPACESHIP -'),
    { label: 'THE SPACESHIP', go: () => adminChapter4(false) },
    { label: 'TO THE MECHANIC', go: () => adminChapter4(true) },
    { label: 'THE HIDDEN DOOR', go: () => adminChapter4('hidden') },
    { label: 'THE CAPTAIN', go: () => adminChapter4('captain') },
    { label: 'THE CRASH', go: () => { adminChapter4('wreck'); startCrash(); } },
    { label: 'THE WRECKAGE', go: () => adminChapter4('wreck') },
    { label: 'TO THE BROKEN MECH', go: adminBrokenReady },
    adminHeader('- THE CASTLE RUINS -'),
    { label: 'THE CASTLE RUINS', go: () => adminChapter4('ruins') },
    {
      label: 'BEFORE THE CASTLE',
      go: () => {
        adminChapter4('ruins');
        player.x = RU_TRIGGER - 80;
        ruins.cam = clamp(player.x - W / 2 + 40, 0, RU_W - W);
      },
    },
    { label: 'THE THOUSAND FORGER', go: adminForgerReady },
    adminHeader('- THE GLITCHED ROAD -'),
    { label: 'THE GLITCHED ROAD', go: () => adminChapter4('groad') },
    {
      label: 'HALFWAY DOWN THE ROAD',
      go: () => {
        adminChapter4('groad');
        player.x = GR_W / 2;
        groad.cam = clamp(player.x - W / 2 + 40, 0, GR_W - W);
      },
    },
    {
      label: 'TO RED KID (GLITCHED)',
      go: () => {
        adminChapter4('groad');
        player.x = GR_TRIGGER - 120;
        groad.cam = clamp(player.x - W / 2 + 40, 0, GR_W - W);
      },
    },
    { label: 'THE GLITCH', go: adminGlitchReady },
    adminHeader('- THE BARREN FOREST -'),
    { label: 'THE BARREN FOREST', go: () => adminChapter4('climb') },
    {
      label: 'THE GLITCH STAIRS',
      go: () => {
        adminChapter4('climb');
        player.x = CL_STAIR_X - 60;
        climb.camX = clamp(player.x - W / 2 + 20, 0, CL_W - W);
      },
    },
    {
      label: 'ABOVE THE CLOUDS',
      go: () => {
        adminChapter4('climb');
        const s = CL_STEPS[34];
        Object.assign(player, { x: s.x + 10, y: s.y - player.h, onGround: true });
        climb.camX = clamp(player.x - W / 2 + 20, 0, CL_W - W);
        climb.camY = clamp(player.y - 110, 0, CL_CAM_MAX_Y);
      },
    },
    {
      label: 'THE SUMMIT',
      go: () => {
        adminChapter4('climb');
        climbAtSummit(CL_SUMMIT.x + 20);
      },
    },
    { label: 'THE CORE', go: adminCoreReady },
    adminHeader('- TOOLS -'),
    { label: 'BOSS BATTLES >', stay: true, go: () => adminPage('bosses') },
    { label: 'GET ANY GEM >', stay: true, go: () => adminPage('gems') },
    { label: 'CLOSE', go: () => {} },
  ];

  function adminBrokenReady() {
    adminChapter4('wreck');
    Object.assign(wreck, { state: 'ready', t: 0 });
    player.x = WR_MX - 200;
    wreck.cam = clamp(player.x - W / 2 + 40, 0, WR_W - W);
  }

  function adminForgerReady() {
    adminChapter4('ruins');
    Object.assign(ruins, { state: 'ready', t: 0, cam: RU_W - W });
    player.x = RU_W - W + 40;
  }

  function adminGlitchReady() {
    adminChapter4('groad');
    Object.assign(groad, { state: 'ready', t: 0, cam: GR_W - W });
    player.x = GR_W - W + 40;
  }

  function adminCoreReady() {
    adminChapter4('climb');
    Object.assign(climb, { state: 'ready', t: 0 });
    climbAtSummit(CL_TRIGGER - 120);
  }

  function adminFight(id, gems) {
    adminGiveGems(gems);
    adminTeleport(...groundSpot(SPAWN_X));
    startBattleTransition(id, () => {}, () => {}, 'world');
  }

  const adminBoss = (label, run) => ({ label, go: () => { run(); if (pendingBattle) pendingBattle.admin = true; } });
  const ADMIN_BOSS_OPTIONS = [
    adminBoss('RED KID', () => adminFight('redKid', 0)),
    adminBoss('MONKEY', () => adminFight('monkey', 1)),
    adminBoss('ANGEL', () => adminFight('angel', 3)),
    adminBoss('SKY BIRD', () => adminFight('skyBird', 4)),
    adminBoss('LIGHT OF GODS', () => adminFight('lightGods', 5)),
    adminBoss('KNIGHT', () => adminFight('knight', 6)),
    adminBoss('ARCHER', () => adminFight('archer', 7)),
    adminBoss('JOKER', () => adminFight('joker', 8)),
    adminBoss('KING', () => adminFight('king', 9)),
    adminBoss('MECHANIC', () => { adminChapter4(true); fightMechanic(); }),
    adminBoss('CAPTAIN', () => { adminChapter4('captain'); fightCaptain(); }),
    adminBoss('BROKEN MECH', () => { adminBrokenReady(); fightBroken(); }),
    adminBoss('THOUSAND FORGER', () => { adminForgerReady(); fightForger(); }),
    adminBoss('THE GLITCH', () => { adminGlitchReady(); fightGlitch(); }),
    adminBoss('THE CORE', () => { adminCoreReady(); fightCore(); }),
    { label: '< BACK', stay: true, go: () => adminPage('main', 'BOSS BATTLES >') },
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
    { label: '< BACK', stay: true, go: () => adminPage('main', 'GET ANY GEM >') },
  ];

  function tpKeep(go, announce) {
    return () => {
      const keep = inventory.slice(), eq = inv.equipped;
      go();
      inventory.splice(0, inventory.length, ...keep);
      inv.equipped = eq;
      if (inventory.includes('swapCrystal')) crystal.taken = true;
      sfx('portal');
      if (announce) {
        toast.text = 'TELEPORTED!';
        toast.t = 90;
      }
    };
  }

  const TP_OPTIONS = [
    ...ADMIN_OPTIONS.slice(0, ADMIN_OPTIONS.findIndex((o) => o.label === '- TOOLS -'))
      .map((o) => (o.header ? o : { label: o.label, go: tpKeep(o.go, true) })),
    adminHeader('- MORE -'),
    { label: 'REDO BOSS FIGHTS >', stay: true, go: () => adminPage('tpBosses') },
    { label: 'CLOSE', go: () => {} },
  ];
  const TP_BOSS_OPTIONS = [
    ...ADMIN_BOSS_OPTIONS.filter((o) => !o.stay).map((o) => ({ label: o.label, go: tpKeep(o.go, false) })),
    { label: '< BACK', stay: true, go: () => adminPage('tp', 'REDO BOSS FIGHTS >') },
  ];

  const ADMIN_PAGES = { main: ADMIN_OPTIONS, gems: ADMIN_GEM_OPTIONS, bosses: ADMIN_BOSS_OPTIONS, tp: TP_OPTIONS, tpBosses: TP_BOSS_OPTIONS };
  const adminOptions = () => ADMIN_PAGES[admin.page] || ADMIN_OPTIONS;

  function adminPage(page, selLabel) {
    admin.page = page;
    const opts = adminOptions();
    const i = selLabel ? opts.findIndex((o) => o.label === selLabel) : -1;
    admin.sel = i >= 0 ? i : opts.findIndex((o) => !o.header);
    admin.scroll = 0;
    adminKeepVisible();
  }

  function adminKingRoom(x) {
    adminGiveGems(8);
    adminTeleport(...groundSpot(SPAWN_X));
    knight.state = 'gone';
    if (joker.state !== 'idle') Object.assign(joker, { state: 'idle', x: KR_JOKER_X, y: 0, spin: 0 });
    Object.assign(kingNpc, { state: 'none', x: KR_DOOR_X, t: 0, door: 0 });
    enterKingRoom();
    player.x = x;
  }

  function adminChapter4(where) {
    const late = where === 'wreck' || where === 'ruins' || where === 'groad' || where === 'climb';
    const after = where === 'hidden' || where === 'captain' || late;
    adminGiveGems(where === 'climb' ? 15 : where === 'groad' ? 14 : where === 'ruins' ? 13 : late ? 12 : after ? 11 : 10);
    adminTeleport(...groundSpot(SPAWN_X));
    knight.state = 'gone';
    joker.state = 'gone';
    kingNpc.state = 'beaten';
    kingRoom.rumble = 0;
    resetMechRoom(after ? 'beaten' : 'work');
    if (where === true) {
      enterMech();
      player.x = MS_LAND_X - 130;
      mechRoom.cam = mechCamTarget();
    } else if (where === 'hidden') {
      shipAfterMech();
    } else if (where === 'captain') {
      enterBridge();
    } else if (where === 'wreck') {
      enterWreck();
    } else if (where === 'ruins') {
      enterRuins();
    } else if (where === 'groad') {
      enterGlitchRoad();
    } else if (where === 'climb') {
      enterClimb();
    } else {
      enterShip();
    }
  }

  const ADMIN_ROW_H = 9, ADMIN_LIST_Y = 14, ADMIN_ROWS = 21;
  const adminRowRect = (i) => ({
    x: ADMIN_PANEL.x + 10, y: ADMIN_PANEL.y + ADMIN_LIST_Y + (i - admin.scroll) * ADMIN_ROW_H,
    w: ADMIN_PANEL.w - 26, h: ADMIN_ROW_H,
  });
  const adminRowVisible = (i) => i >= admin.scroll && i < admin.scroll + ADMIN_ROWS;
  const adminMaxScroll = () => Math.max(0, adminOptions().length - ADMIN_ROWS);

  function adminKeepVisible() {
    const s = admin.scroll || 0;
    const top = admin.sel > 0 && adminOptions()[admin.sel - 1].header ? admin.sel - 1 : admin.sel;
    admin.scroll = clamp(top < s ? top : admin.sel >= s + ADMIN_ROWS ? admin.sel - ADMIN_ROWS + 1 : s, 0, adminMaxScroll());
  }

  function adminScroll(d) {
    admin.scroll = clamp((admin.scroll || 0) + d, 0, adminMaxScroll());
    const opts = adminOptions();
    if (!adminRowVisible(admin.sel)) {
      let i = clamp(admin.sel, admin.scroll, admin.scroll + ADMIN_ROWS - 1);
      while (opts[i] && opts[i].header && adminRowVisible(i + d)) i += d > 0 ? 1 : -1;
      if (opts[i] && !opts[i].header) admin.sel = i;
    }
  }

  function adminMove(d) {
    const opts = adminOptions();
    const n = opts.length;
    let i = admin.sel;
    do i = (i + d + n) % n;
    while (opts[i].header);
    admin.sel = i;
    adminKeepVisible();
    sfx('cursor');
  }

  function adminChoose(i) {
    const o = adminOptions()[i];
    if (!o || o.header) return;
    if (!o.stay) {
      admin.open = false;
      admin.page = 'main';
    }
    sfx('confirm');
    o.go();
  }

  function adminKey(k) {
    if ((k === 'escape' || k === 'backspace') && admin.page === 'tpBosses') {
      adminPage('tp', 'REDO BOSS FIGHTS >');
      sfx('back');
    } else if ((k === 'escape' || k === 'backspace' || k === 't') && admin.page === 'tp') {
      admin.open = false;
      admin.page = 'main';
      sfx('close');
    } else if ((k === 'escape' || k === 'backspace') && admin.page !== 'main') {
      adminPage('main', admin.page === 'gems' ? 'GET ANY GEM >' : 'BOSS BATTLES >');
      sfx('back');
    } else if (k === 'escape' || k === 'tab') {
      admin.open = false;
      admin.page = 'main';
      sfx('close');
    } else if (k === 'arrowup' || k === 'w') {
      adminMove(-1);
    } else if (k === 'arrowdown' || k === 's') {
      adminMove(1);
    } else if (k === 'pageup' || k === 'arrowleft' || k === 'a') {
      for (let j = 0; j < ADMIN_ROWS - 1; j++) adminMove(-1);
    } else if (k === 'pagedown' || k === 'arrowright' || k === 'd') {
      for (let j = 0; j < ADMIN_ROWS - 1; j++) adminMove(1);
    } else if (k === 'enter' || k === ' ') {
      adminChoose(admin.sel);
    }
  }

  function drawAdminPanel() {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    const p = ADMIN_PANEL;
    drawPanel(p.x, p.y, p.w, p.h);
    const title = { gems: 'GET ANY GEM', bosses: 'BOSS BATTLES', tp: 'TELEPORT', tpBosses: 'REDO BOSS FIGHTS' }[admin.page] || 'ADMIN PANEL';
    const tpPage = admin.page === 'tp' || admin.page === 'tpBosses';
    drawText(title, W / 2, p.y + 4, 8, tpPage ? '#7a2a9c' : '#c2202e', 'center', null);
    const opts = adminOptions();
    opts.forEach((o, i) => {
      if (!adminRowVisible(i)) return;
      const r = adminRowRect(i);
      if (o.header) {
        drawText(o.label, r.x + r.w / 2, r.y + 1, 8, '#7a2a18', 'center', null);
        return;
      }
      const on = i === admin.sel;
      if (on) {
        ctx.fillStyle = '#3b2a1a';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      drawText((on ? '> ' : '  ') + o.label, r.x + 4, r.y + 1, 8, on ? '#ffe14d' : '#3b2a1a', 'left', null);
    });
    const max = adminMaxScroll();
    if (max > 0) {
      const tx = p.x + p.w - 13, ty = p.y + ADMIN_LIST_Y, th = ADMIN_ROWS * ADMIN_ROW_H;
      ctx.fillStyle = 'rgba(59,42,26,0.25)';
      ctx.fillRect(tx, ty, 4, th);
      const kh = Math.max(10, Math.round(th * ADMIN_ROWS / opts.length));
      ctx.fillStyle = '#3b2a1a';
      ctx.fillRect(tx, ty + Math.round((th - kh) * admin.scroll / max), 4, kh);
      const blink = Math.floor(performance.now() / 400) % 2 === 0;
      if (admin.scroll < max && blink) drawText('v MORE v', W / 2, ty + th + 1, 8, '#7a2a18', 'center', null);
    }
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

  const BOSS_ORDER = ['redKid', 'monkey', 'angel', 'skyBird', 'lightGods', 'eye', 'knight', 'archer', 'joker', 'king', 'mechanic', 'captain', 'brokenMech', 'thousandForger', 'glitch', 'core'];
  const BOSS_RESTORE = [
    'BEHIND RED KID', 'BEHIND MONKEY', 'BEHIND ANGEL', 'BEHIND SKY BIRD', 'FINAL BOSS START',
    'THE CASTLE', 'THE MAZE', "THE KING'S ROOM", 'TO THE KING', 'THE SPACESHIP', 'THE HIDDEN DOOR', 'THE WRECKAGE',
    'THE CASTLE RUINS', 'THE GLITCHED ROAD', 'THE BARREN FOREST', 'THE BARREN FOREST',
  ];
  const CONTINUE_TITLES = [
    ['GRASSLANDS', '- CHAPTER I -'], ['GRASSLANDS', '- CHAPTER I -'], ['THE SKY LANDS', '- WORLD 2 -'],
    ['THE CLOUD MAP', '- WORLD 2 : PART 2 -'], null, ['THE CASTLE', '- WORLD 3 -'], ['THE MAIN CASTLE', '- THE MAZE -'],
    ["THE KING'S ROOM", '- WORLD 3 -'], ["THE KING'S ROOM", '- WORLD 3 -'], ['THE SPACESHIP', '- CHAPTER 4 -'],
    ['THE SPACESHIP', '- CHAPTER 4 -'], ['THE WRECKAGE', '- CHAPTER 4 -'],
    ['THE CASTLE RUINS', '- CHAPTER 5 -'], ['THE GLITCHED ROAD', '- CHAPTER 6 -'], ['THE BARREN FOREST', '- CHAPTER 7 -'],
    ['THE BARREN FOREST', '- CHAPTER 7 -'],
  ];

  // Changes whenever an update adds a boss, so teleport must be re-earned from the new ending.
  const TELEPORT_KEY = BOSS_ORDER.join('|');
  let tpUnlocked = false, tpJustUnlocked = false;

  function refreshTeleport() {
    const s = store.get(STORE.save, null);
    tpUnlocked = run.mode === 'classic' && !replay.on && !!s && s.teleport === TELEPORT_KEY;
  }

  function unlockTeleport() {
    if (run.mode !== 'classic' || replay.on) return false;
    const s = store.get(STORE.save, null);
    if (!s || s.progress < BOSS_ORDER.length) return false;
    const fresh = s.teleport !== TELEPORT_KEY;
    store.set(STORE.save, { ...s, inventory: inventory.filter(Boolean), equipped: inv.equipped, teleport: TELEPORT_KEY });
    tpUnlocked = true;
    return fresh;
  }

  const canTeleport = () => tpUnlocked && !inv.open && !admin.open && canOpenInventory();

  function openTeleport() {
    admin.open = true;
    adminPage('tp');
    sfx('open');
  }

  function classicSave(id) {
    if (run.mode !== 'classic') return;
    const i = BOSS_ORDER.indexOf(id);
    if (i < 0) return;
    const cur = store.get(STORE.save, null);
    const progress = Math.max(cur ? cur.progress : 0, i + 1);
    store.set(STORE.save, { ...(cur || {}), progress, inventory: inventory.filter(Boolean), equipped: inv.equipped });
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

  const BOARD_ROWS = 7;
  const GAME_VERSION = 'V4.8';
  const LEGACY_VERSION = 'OLD';
  const entryVersion = (r) => r.v || LEGACY_VERSION;
  const verNum = (v) => (v === LEGACY_VERSION ? -1 : parseFloat(v.slice(1)) || 0);
  function boardVersions() {
    const vs = new Set([GAME_VERSION]);
    for (const r of store.get(STORE.board, [])) vs.add(entryVersion(r));
    return [...vs].sort((a, b) => verNum(b) - verNum(a));
  }
  const boardFor = (v) => store.get(STORE.board, []).filter((r) => entryVersion(r) === v);

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
    const entry = { name: playerName, frames: run.frames, at: Date.now(), v: GAME_VERSION };
    board.push(entry);
    board.sort((a, b) => a.frames - b.frames);
    run.rank = board.filter((r) => entryVersion(r) === GAME_VERSION).indexOf(entry) + 1;
    const data = { seed: rec.seed, name: playerName, frames: run.frames, v: GAME_VERSION, ev: encodeReplay(rec.ev) };
    if (store.set(STORE.rep + entry.at, data)) entry.rid = entry.at;
    store.set(STORE.board, board);
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
    replay.fast = !!req.dl && typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
    replay.dl = !!req.dl && (replay.fast || (typeof MediaRecorder !== 'undefined' && !!cvs.captureStream));
    replay.ev = decodeReplay(data.ev);
    replay.i = 0;
    replay.name = data.name;
    replay.frames = data.frames;
    replay.version = data.v || LEGACY_VERSION;
    rec.seed = data.seed;
    playerName = data.name;
    beginGame('speedrun');
    if (replay.fast) startExport();
    return true;
  }

  const EXPORT_SCALE = 3, EXPORT_FPS = 30;

  async function startExport() {
    const width = W * EXPORT_SCALE, height = H * EXPORT_SCALE;
    let cfg = null, codecId = '';
    for (const [codec, id] of [['vp8', 'V_VP8'], ['vp09.00.10.08', 'V_VP9']]) {
      const c = { codec, width, height, bitrate: 4000000, framerate: EXPORT_FPS };
      try {
        if ((await VideoEncoder.isConfigSupported(c)).supported) {
          cfg = c;
          codecId = id;
          break;
        }
      } catch (err) {}
    }
    if (!cfg) {
      replay.fast = false;
      replay.dl = typeof MediaRecorder !== 'undefined' && !!cvs.captureStream;
      return;
    }
    replay.vcan = document.createElement('canvas');
    replay.vcan.width = width;
    replay.vcan.height = height;
    replay.vctx = replay.vcan.getContext('2d');
    replay.vctx.imageSmoothingEnabled = false;
    Object.assign(exportState, { on: true, chunks: [], n: 0, step: 0, finishing: false, saved: false, error: false, codecId, width, height });
    exportState.encoder = new VideoEncoder({
      output: (chunk) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        exportState.chunks.push({ ts: Math.round(chunk.timestamp / 1000), key: chunk.type === 'key', data });
      },
      error: () => {
        exportState.error = true;
      },
    });
    exportState.encoder.configure(cfg);
    if (window.Sound) window.Sound.music(null);
    replay.paused = false;
  }

  function exportTick() {
    const ex = exportState;
    if (!ex.finishing && !ex.error) {
      const start = performance.now();
      for (let guard = 0; guard < 600 && performance.now() - start < 28 && !ex.finishing; guard++) {
        if (ex.encoder.encodeQueueSize > 8) break;
        stepGame();
        if (ex.step++ % (60 / EXPORT_FPS) !== 0) continue;
        Math.random = nativeRandom;
        render();
        Math.random = gameRandom;
        replay.vctx.drawImage(cvs, 0, 0, ex.width, ex.height);
        const frame = new VideoFrame(replay.vcan, { timestamp: Math.round((ex.n * 1e6) / EXPORT_FPS), duration: Math.round(1e6 / EXPORT_FPS) });
        ex.encoder.encode(frame, { keyFrame: ex.n % (EXPORT_FPS * 2) === 0 });
        frame.close();
        ex.n++;
        if (!run.done && rec.f > replay.frames + 900) finishExport();
      }
    }
    Math.random = nativeRandom;
    render();
    Math.random = gameRandom;
    drawExportScreen();
  }

  function drawExportScreen() {
    const ex = exportState;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    drawPanel(62, 60, 260, 96);
    drawText('DOWNLOAD RUN VIDEO', W / 2, 70, 8, '#9a1c1a', 'center', null);
    drawText(`${replay.name} - ${fmtTime(replay.frames)} - ${replay.version}`, W / 2, 86, 8, '#3b2a1a', 'center', null);
    const total = replay.frames + 240;
    const p = ex.saved ? 1 : clamp(rec.f / total, 0, 1) * (ex.finishing ? 1 : 0.97);
    ctx.fillStyle = '#1c140c';
    ctx.fillRect(81, 103, 222, 12);
    ctx.fillStyle = '#c9ae74';
    ctx.fillRect(82, 104, 220, 10);
    ctx.fillStyle = ex.error ? '#c0302c' : '#2e8a3a';
    ctx.fillRect(82, 104, Math.round(220 * p), 10);
    drawText(`${Math.floor(p * 100)}%`, W / 2, 105, 8, '#ffffff', 'center', '#1c140c');
    let msg = 'MAKING YOUR VIDEO...';
    if (ex.error) msg = 'VIDEO FAILED - ESC:MENU';
    else if (ex.saved) msg = 'VIDEO SAVED!';
    else if (ex.finishing) msg = 'SAVING FILE...';
    drawText(msg, W / 2, 124, 8, ex.saved ? '#2e8a3a' : '#3b2a1a', 'center', null);
    drawText(ex.saved ? 'RETURNING TO MENU...' : 'ESC: CANCEL', W / 2, 140, 8, '#8a6a3a', 'center', null);
  }

  function saveVideoBlob(blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `powerland-speedrun-${replay.name}-${fmtTime(replay.frames).replace(/[:.]/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function finishExport() {
    const ex = exportState;
    if (ex.finishing) return;
    ex.finishing = true;
    try {
      await ex.encoder.flush();
      ex.encoder.close();
      saveVideoBlob(buildWebm(ex.chunks, ex.codecId, ex.width, ex.height, (ex.n * 1000) / EXPORT_FPS));
      ex.chunks = [];
      ex.saved = true;
      if (window.Sound) window.Sound.play('itemGet');
      setTimeout(() => location.reload(), 2500);
    } catch (err) {
      ex.error = true;
    }
  }

  function buildWebm(chunks, codecId, width, height, durationMs) {
    const te = new TextEncoder();
    const uint = (n) => {
      const b = [];
      do {
        b.unshift(n % 256);
        n = Math.floor(n / 256);
      } while (n > 0);
      return new Uint8Array(b);
    };
    const u64 = (n) => {
      const b = new Uint8Array(8);
      for (let i = 7; i >= 0; i--) {
        b[i] = n % 256;
        n = Math.floor(n / 256);
      }
      return b;
    };
    const f64 = (v) => {
      const b = new Uint8Array(8);
      new DataView(b.buffer).setFloat64(0, v);
      return b;
    };
    const el = (id, kids) => {
      const parts = [];
      let len = 0;
      for (const k of kids) {
        if (k instanceof Uint8Array) {
          parts.push(k);
          len += k.length;
        } else {
          for (const p of k.parts) parts.push(p);
          len += k.len;
        }
      }
      const head = new Uint8Array(id.length + 8);
      head.set(id);
      head[id.length] = 0x01;
      let v = len;
      for (let i = 7; i >= 1; i--) {
        head[id.length + i] = v % 256;
        v = Math.floor(v / 256);
      }
      return { parts: [head, ...parts], len: head.length + len };
    };
    const CLUSTER = [0x1f, 0x43, 0xb6, 0x75];
    const clusters = [];
    const cueTimes = [];
    let cur = null, base = 0;
    for (const c of chunks) {
      if (!cur || c.key || c.ts - base > 30000) {
        if (cur) clusters.push(el(CLUSTER, cur));
        base = c.ts;
        cueTimes.push(base);
        cur = [el([0xe7], [uint(base)])];
      }
      const rel = c.ts - base;
      cur.push(el([0xa3], [new Uint8Array([0x81, (rel >> 8) & 0xff, rel & 0xff, c.key ? 0x80 : 0]), c.data]));
    }
    if (cur) clusters.push(el(CLUSTER, cur));

    const header = el([0x1a, 0x45, 0xdf, 0xa3], [
      el([0x42, 0x86], [uint(1)]), el([0x42, 0xf7], [uint(1)]), el([0x42, 0xf2], [uint(4)]), el([0x42, 0xf3], [uint(8)]),
      el([0x42, 0x82], [te.encode('webm')]), el([0x42, 0x87], [uint(2)]), el([0x42, 0x85], [uint(2)]),
    ]);
    const info = el([0x15, 0x49, 0xa9, 0x66], [
      el([0x2a, 0xd7, 0xb1], [uint(1000000)]), el([0x4d, 0x80], [te.encode('Powerland')]),
      el([0x57, 0x41], [te.encode('Powerland')]), el([0x44, 0x89], [f64(durationMs)]),
    ]);
    const tracks = el([0x16, 0x54, 0xae, 0x6b], [
      el([0xae], [
        el([0xd7], [uint(1)]), el([0x73, 0xc5], [uint(1)]), el([0x83], [uint(1)]), el([0x86], [te.encode(codecId)]),
        el([0xe0], [el([0xb0], [uint(width)]), el([0xba], [uint(height)])]),
      ]),
    ]);
    const seekHead = (cuesPos) => el([0x11, 0x4d, 0x9b, 0x74], [
      el([0x4d, 0xbb], [el([0x53, 0xab], [new Uint8Array([0x1c, 0x53, 0xbb, 0x6b])]), el([0x53, 0xac], [u64(cuesPos)])]),
    ]);
    const shLen = seekHead(0).len;
    let pos = shLen + info.len + tracks.len;
    const cuePoints = clusters.map((cl, i) => {
      const cp = el([0xbb], [el([0xb3], [uint(cueTimes[i])]), el([0xb7], [el([0xf7], [uint(1)]), el([0xf1], [uint(pos)])])]);
      pos += cl.len;
      return cp;
    });
    const cues = el([0x1c, 0x53, 0xbb, 0x6b], cuePoints);
    const segment = el([0x18, 0x53, 0x80, 0x67], [seekHead(pos), info, tracks, ...clusters, cues]);
    return new Blob([...header.parts, ...segment.parts], { type: 'video/webm' });
  }

  function startPlayback() {
    if (replay.fast) return;
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
    if (exportState.on || replay.fast) {
      if (k === 'escape') location.reload();
      return;
    }
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
      drawText(`${replay.name} - ${fmtTime(replay.frames)} - ${replay.version}`, W / 2, 92, 8, '#3b2a1a', 'center', null);
      if (replay.fast) {
        drawText('GETTING READY...', W / 2, 112, 8, '#2e8a3a', 'center', null);
        return;
      }
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
    const v = replay.on ? replay.version : GAME_VERSION;
    const vw = v.length * 8 + 8, vx = W / 2 + w / 2 + 2;
    ctx.fillStyle = 'rgba(122,42,156,0.85)';
    ctx.fillRect(vx, 3, vw, 14);
    ctx.fillStyle = '#c87cff';
    ctx.fillRect(vx, 16, vw, 1);
    drawText(v, vx + vw / 2, 6, 8, '#ffffff', 'center', null);
  }

  const MENU_PANEL = { x: 72, y: 26, w: 240, h: 166 };
  const BOARD_PANEL = { x: 42, y: 24, w: 300, h: 172 };
  const BOARD_CLOSE = { x: 322, y: 28, w: 16, h: 14 };
  const boardRowY = (i) => BOARD_PANEL.y + 46 + i * 15;
  const watchRect = (i) => ({ x: BOARD_PANEL.x + 206, y: boardRowY(i) - 3, w: 52, h: 13 });
  const dlRect = (i) => ({ x: BOARD_PANEL.x + 264, y: boardRowY(i) - 3, w: 28, h: 13 });
  const BOARD_UP = { x: BOARD_PANEL.x + 92, y: BOARD_PANEL.y + 152, w: 18, h: 13 };
  const BOARD_DOWN = { x: BOARD_PANEL.x + 190, y: BOARD_PANEL.y + 152, w: 18, h: 13 };
  const VER_PREV = { x: BOARD_PANEL.x + 52, y: BOARD_PANEL.y + 29, w: 16, h: 12 };
  const VER_NEXT = { x: BOARD_PANEL.x + BOARD_PANEL.w - 68, y: BOARD_PANEL.y + 29, w: 16, h: 12 };
  const shownVer = () => menu.ver || GAME_VERSION;
  const shownBoard = () => boardFor(shownVer());
  function switchVersion(d) {
    const vs = boardVersions();
    const i = Math.max(0, vs.indexOf(shownVer()));
    const next = clamp(i + d, 0, vs.length - 1);
    if (next === i) return;
    menu.ver = vs[next];
    menu.scroll = 0;
    sfx('cursor');
  }
  const boardMaxScroll = () => Math.max(0, shownBoard().length - BOARD_ROWS);
  function scrollBoard(d) {
    const next = clamp(menu.scroll + d, 0, boardMaxScroll());
    if (next !== menu.scroll) sfx('cursor');
    menu.scroll = next;
  }
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
      if (inRect(p, BOARD_UP)) return 'boardUp';
      if (inRect(p, BOARD_DOWN)) return 'boardDown';
      if (inRect(p, VER_PREV)) return 'verPrev';
      if (inRect(p, VER_NEXT)) return 'verNext';
      const board = shownBoard().slice(menu.scroll, menu.scroll + BOARD_ROWS);
      const i = board.findIndex((r, j) => r.rid && inRect(p, watchRect(j)));
      if (i >= 0) return 'watch' + (menu.scroll + i);
      const d = board.findIndex((r, j) => r.rid && inRect(p, dlRect(j)));
      return d >= 0 ? 'dl' + (menu.scroll + d) : null;
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
    refreshTeleport();
    tpJustUnlocked = false;
    game.mode = 'world';
    fade.alpha = 1;
    fade.dir = -1;
    sfx('battleStart');
    if (mode === 'classic') {
      const s = store.get(STORE.save, null);
      if (s && s.progress > 0) {
        restoreClassic(s);
        const ct = CONTINUE_TITLES[s.progress - 1];
        if (ct) showTitle(ct[0], ct[1]);
        toast.text = 'WELCOME BACK, ' + playerName + '!';
        toast.t = 180;
        return;
      }
    }
    titleInfo = { main: 'GRASSLANDS', sub: '- CHAPTER I -', hint: true };
    titleStart = clockNow();
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
        const r = shownBoard()[Number(hv.slice(dl ? 2 : 5))];
        sfx('confirm');
        watchRun(r.rid, dl);
        return;
      }
      if (hv === 'boardUp' || hv === 'boardDown') {
        scrollBoard(hv === 'boardUp' ? -BOARD_ROWS : BOARD_ROWS);
        return;
      }
      if (hv === 'verPrev' || hv === 'verNext') {
        switchVersion(hv === 'verPrev' ? -1 : 1);
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
      menu.scroll = 0;
      menu.ver = GAME_VERSION;
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
      if (k === 'arrowup' || k === 'w') scrollBoard(-1);
      else if (k === 'arrowdown' || k === 's') scrollBoard(1);
      else if (k === 'arrowleft' || k === 'a') switchVersion(-1);
      else if (k === 'arrowright' || k === 'd') switchVersion(1);
      else if (k === 'escape' || CONFIRM_KEYS.includes(k)) {
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
    knightFrames[0], archerFrames[0], jokerFrames[0], kingWalkFrames[0], mechanicFrames[0],
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
      drawGemFx(id, x, y, s);
      ctx.restore();
      if (front && (t + i * 9) % 40 < 6) sparkle(Math.round(x + 6), Math.round(y - 6), 1, '#ffffff');
    });
  }

  function renderSplash() {
    const t = menu.t;
    drawSplashScene(tick);
    const cast = SPLASH_CAST();
    cast.forEach((img, i) => {
      const x = 168 + i * 24;
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
    const hv = menuHover(mouse);
    const ver = shownVer(), vs = boardVersions(), vi = vs.indexOf(ver);
    const verLabel = ver === LEGACY_VERSION ? 'OLD VERSIONS' : `VERSION ${ver}${ver === GAME_VERSION ? ' (NEW)' : ''}`;
    drawText(verLabel, B.x + B.w / 2, B.y + 31, 8, ver === GAME_VERSION ? '#2e8a3a' : '#8a6a3a', 'center', null);
    [[VER_PREV, 'verPrev', -1, vi > 0], [VER_NEXT, 'verNext', 1, vi < vs.length - 1]].forEach(([r, key, dir, on]) => {
      ctx.fillStyle = '#1c140c';
      ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
      ctx.fillStyle = !on ? '#8a7a5a' : hv === key ? '#3eaa4a' : '#2e8a3a';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = on ? '#ffffff' : '#c8b890';
      for (let j = 0; j < 4; j++) {
        const xx = dir < 0 ? r.x + 5 + j : r.x + r.w - 6 - j;
        ctx.fillRect(xx, r.y + r.h / 2 - j - 1, 1, j * 2 + 2);
      }
    });
    const board = shownBoard();
    if (!board.length) {
      drawText('NO RUNS YET!', B.x + B.w / 2, B.y + 76, 8, '#8a7a5a', 'center', null);
      drawText('BEAT SPEEDRUN MODE', B.x + B.w / 2, B.y + 96, 8, '#8a7a5a', 'center', null);
      drawText(`TO GET ON THE ${ver} BOARD`, B.x + B.w / 2, B.y + 108, 8, '#8a7a5a', 'center', null);
    }
    menu.scroll = clamp(menu.scroll, 0, boardMaxScroll());
    if (board.length) {
      const pageText = `${menu.scroll + 1}-${Math.min(board.length, menu.scroll + BOARD_ROWS)} OF ${board.length}`;
      drawText(pageText, B.x + B.w / 2, BOARD_UP.y + 3, 8, '#8a6a3a', 'center', null);
      [[BOARD_UP, 'boardUp', -1, menu.scroll > 0], [BOARD_DOWN, 'boardDown', 1, menu.scroll < boardMaxScroll()]].forEach(([r, key, dir, on]) => {
        ctx.fillStyle = '#1c140c';
        ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
        ctx.fillStyle = !on ? '#8a7a5a' : hv === key ? '#4a8af0' : '#2f6fdc';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = on ? '#ffffff' : '#c8b890';
        for (let j = 0; j < 4; j++) {
          const yy = dir < 0 ? r.y + 4 + j : r.y + 8 - j;
          ctx.fillRect(r.x + r.w / 2 - j - 1, yy, j * 2 + 2, 1);
        }
      });
    }
    board.slice(menu.scroll, menu.scroll + BOARD_ROWS).forEach((r, row) => {
      const i = menu.scroll + row;
      const y = boardRowY(row);
      const col = ['#c8901a', '#7a7a90', '#a0603a'][i] || '#3b2a1a';
      if (i < 3) {
        ctx.fillStyle = ['rgba(232,160,32,0.25)', 'rgba(140,140,170,0.25)', 'rgba(160,96,58,0.25)'][i];
        ctx.fillRect(B.x + 6, y - 3, 196, 13);
      }
      drawText(`${i + 1}.`, B.x + 10, y, 8, col, 'left', null);
      drawText(r.name.slice(0, 11), B.x + (i >= 99 ? 42 : 34), y, 8, col, 'left', null);
      drawText(fmtTime(r.frames), B.x + 198, y, 8, '#3b2a1a', 'right', null);
      const wr = watchRect(row), on = !!r.rid, over = hv === 'watch' + i;
      ctx.fillStyle = '#1c140c';
      ctx.fillRect(wr.x - 1, wr.y - 1, wr.w + 2, wr.h + 2);
      ctx.fillStyle = !on ? '#8a7a5a' : over ? '#4a8af0' : '#2f6fdc';
      ctx.fillRect(wr.x, wr.y, wr.w, wr.h);
      ctx.fillStyle = on ? '#ffffff' : '#c8b890';
      for (let j = 0; j < 4; j++) ctx.fillRect(wr.x + 4 + j, wr.y + 3 + j, 1, 7 - 2 * j);
      drawText('WATCH', wr.x + 30, wr.y + 3, 8, on ? (over ? '#ffe14d' : '#ffffff') : '#c8b890', 'center', null);
      const dr = dlRect(row), dOver = hv === 'dl' + i;
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
    drawMenuButton(MB.speedrun, 'SPEEDRUN MODE', `VERSION ${GAME_VERSION}`, ['#7a2a9c', '#9c3fd8'], hover === 'speedrun', false, drawSpeedPic);

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
    if (exportState.on) {
      last = t;
      exportTick();
      requestAnimationFrame(loop);
      return;
    }
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
    if (replay.on && run.done && ++replay.doneT === 240 && replay.dl) {
      if (exportState.on) finishExport();
      else stopRecording(false);
    }
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

  game.mode = 'menu';
  startReplay();
  requestAnimationFrame(loop);
})();
