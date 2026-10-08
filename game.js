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
  const playerBack = buildSprite([...BACK_BODY, ...LEGS[0]], BLUE_PAL);
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
      name: 'ANGEL', hp: 25, type: 'holy', moves: [PUNCH, ANGELIC_ACE, ANGELISM],
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
  };

  // ---------- Items ----------
  const ITEMS = {
    fireGem: { name: 'FIRE GEM', desc: 'GRANTS FIRELITE IN BATTLE', kind: 'gem', moves: [FIRELITE] },
    leafGem: { name: 'LEAF GEM', desc: 'GRANTS LEAF STORM IN BATTLE', kind: 'gem', moves: [LEAF_STORM] },
    swapCrystal: { name: 'SWAP CRYSTAL', desc: 'SWAP GEMS MID BATTLE', kind: 'key', moves: [] },
    angelCrystal: {
      name: 'ANGELIC CRYSTAL', desc: 'ACE + ANGELISM, 30 MAX HP', kind: 'gem',
      moves: [ANGELIC_ACE, ANGELISM], hpBonus: 10,
    },
    skyGem: {
      name: 'SKY GEM', desc: 'DESCENT + BEAM FIRE X', kind: 'gem',
      moves: [AERIAL_DESCENT, BEAM_FIRE_X],
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
    'HALT, TRAVELER!',
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
    'YOU WANT GO UP? THEN YOU FIGHTS ME NOW!',
    'ME BEATS YOU GOOD! OOH OOH!',
  ];
  const angel = { x: ANGEL_CLOUD.x + 80, y: ANGEL_CLOUD.y - 24, face: 1, t: 0, vy: 0, state: 'idle' };
  const ANGEL_LINES = [
    'HALT, MORTAL!',
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

  const bird = { x: C2_ARENA.x + 150, y: C2_ARENA.y - 22, face: -1, t: 0, vy: 0, state: 'idle' };
  const c2 = { checkpoint: false };
  const BIRD_LINES = [
    'SQUAWK! WHO DARES CLIMB TO MY CLOUDS?',
    'I AM THE SKY BIRD, RULER OF THE WIND!',
    'THE ANGEL LET YOU THROUGH? HMPH!',
    'WITH THIS SKY GEM I COMMAND THE STORM.',
    'PREPARE TO FALL FROM THE SKY!',
  ];
  const BIRD_WIN_LINES = [
    'SQUAWK... MY FEATHERS ARE ALL RUFFLED.',
    'FINE! TAKE THE SKY GEM. THE WIND IS YOURS.',
    'CAW CAW! UNTIL WE MEET AGAIN!',
  ];

  const LIGHT_HOVER_Y = STAIR_TOP.y - 48;
  const light = { x: STAIR_TOP.x + 150, y: LIGHT_HOVER_Y, t: 0, state: 'idle' };
  const LIGHT_LINES = [
    'MORTAL... YOU HAVE CLIMBED TOO HIGH.',
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
  let titleInfo = { main: 'GRASSLANDS', sub: '- CHAPTER I -', hint: true };

  // ---------- Input ----------
  const keys = {};
  const JUMP_KEYS = ['w', 'arrowup', ' '];
  const BLOCK_KEYS = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '];
  const CONFIRM_KEYS = ['enter', ' ', 'z'];
  const mouse = { x: -1, y: -1 };

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (BLOCK_KEYS.includes(k)) e.preventDefault();
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
    } else if (game.mode === 'battle' && !e.repeat) {
      if (CONFIRM_KEYS.includes(k)) battleConfirm();
      if ((k === 'escape' || k === 'backspace') && battle.phase === 'swap') {
        battle.phase = 'choose';
        battle.sel = 0;
      }
      if (k === 'arrowleft' || k === 'a') moveCursor(-1, 0);
      if (k === 'arrowright' || k === 'd') moveCursor(1, 0);
      if (k === 'arrowup' || k === 'w') moveCursor(0, -1);
      if (k === 'arrowdown' || k === 's') moveCursor(0, 1);
    } else if (JUMP_KEYS.includes(k) && !keys[k]) {
      player.jumpBuf = 7;
    }
    keys[k] = true;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });
  const jumpHeld = () => JUMP_KEYS.some((k) => keys[k]);

  function toCanvas(e) {
    const r = cvs.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  }
  cvs.addEventListener('mousemove', (e) => {
    Object.assign(mouse, toCanvas(e));
    let pointer = false;
    if (inv.open) {
      pointer = invHitTest(mouse.x, mouse.y) !== null;
    } else if (canOpenInventory()) {
      pointer = inRect(mouse, BAG_BTN);
    } else if (game.mode === 'battle' && inMenu()) {
      const i = slotAt(mouse.x, mouse.y);
      const items = menuItems();
      if (i >= 0 && items[i]) battle.sel = i;
      pointer = i >= 0 && !!items[i];
    }
    cvs.style.cursor = pointer ? 'pointer' : 'default';
  });
  cvs.addEventListener('mousedown', (e) => {
    const p = toCanvas(e);
    if (inv.open) {
      invClick(p);
      return;
    }
    if (canOpenInventory()) {
      if (inRect(p, BAG_BTN)) openInventory();
      return;
    }
    if (game.mode !== 'battle') return;
    if (inMenu()) {
      const i = slotAt(p.x, p.y);
      if (i >= 0 && menuItems()[i]) {
        battle.sel = i;
        battleConfirm();
      }
    } else {
      battleConfirm();
    }
  });

  // ---------- Inventory ----------
  const inRect = (p, r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
  const BAG_BTN = { x: W - 28, y: 4, w: 24, h: 22 };
  const INV_PANEL = { x: 72, y: 20, w: 240, h: 176 };
  const INV_CLOSE = { x: INV_PANEL.x + INV_PANEL.w - 20, y: INV_PANEL.y + 6, w: 14, h: 14 };
  const EQUIP_BTN = { x: 96, y: 170, w: 84, h: 18 };
  const THROW_BTN = { x: 204, y: 170, w: 84, h: 18 };

  function invSlotRect(i) {
    return { x: 90 + (i % 5) * 42, y: 48 + Math.floor(i / 5) * 42, w: 36, h: 36 };
  }

  const isGem = (id) => !!id && ITEMS[id].kind === 'gem';

  function canOpenInventory() {
    return game.mode === 'world' && !dialog.active && fade.dir === 0;
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
    if (inRect(p, THROW_BTN) && inventory[inv.sel]) return 'throw';
    for (let i = 0; i < INV_SIZE; i++) {
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
    } else if (hit === 'throw') {
      if (inv.equipped === inventory[inv.sel]) inv.equipped = null;
      inventory[inv.sel] = null;
      inv.sel = -1;
      sfx('throw');
    } else if (typeof hit === 'number') {
      inv.sel = hit;
      sfx('cursor');
    }
  }

  const overlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function wallActive(s) {
    if (s === arenaWall) return bird.state !== 'leaving' && bird.state !== 'gone';
    return s !== npcWall || npc.state !== 'gone';
  }

  // ---------- World update ----------
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

    if (dialog.active) {
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
  function startBattleTransition(enemyId, onWin, onLose) {
    pendingBattle = { enemyId, onWin, onLose };
    game.mode = 'transition';
    game.transT = 0;
    sfx('battleStart');
  }

  function startBattle() {
    const { enemyId, onWin, onLose } = pendingBattle;
    const enemy = ENEMIES[enemyId];
    battle = {
      id: enemyId, enemy, onWin, onLose,
      pmax: getPlayerMaxHp(), php: getPlayerMaxHp(), ehp: enemy.hp,
      pDisp: getPlayerMaxHp(), eDisp: enemy.hp,
      phase: 'events', queue: [], cur: null,
      t: 0, chars: 0, sel: 0, advance: false,
      shake: 0, pHurt: 0, eHurt: 0, fx: [], introT: 0,
      moves: getPlayerMoves(), lastEnemyMove: null, fireball: null, leafStorm: null,
    };
    battle.queue.push({ type: 'msg', text: `${enemy.name} WANTS TO FIGHT!` });
    game.mode = 'battle';
    fade.alpha = 1;
    fade.dir = -1;
  }

  function slotRect(i) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    return { x: 110 + col * 134, y: 172 + row * 18, w: 128, h: 15 };
  }
  function slotAt(x, y) {
    for (let i = 0; i < 4; i++) {
      const r = slotRect(i);
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
    }
    return -1;
  }
  function moveCursor(dx, dy) {
    if (!inMenu()) return;
    let col = (battle.sel % 2) + dx;
    let row = Math.floor(battle.sel / 2) + dy;
    const i = clamp(row, 0, 1) * 2 + clamp(col, 0, 1);
    if (menuItems()[i] && i !== battle.sel) {
      battle.sel = i;
      sfx('cursor');
    }
  }

  const inMenu = () => !!battle && (battle.phase === 'choose' || battle.phase === 'swap');

  function menuItems() {
    if (!battle) return [];
    if (battle.phase === 'choose') {
      const swap = inventory.includes('swapCrystal') ? [{ name: 'SWAP', swap: true }] : [];
      return [...battle.moves, ...swap];
    }
    if (battle.phase === 'swap') {
      const gems = inventory
        .filter((id) => id && ITEMS[id].kind === 'gem' && id !== inv.equipped)
        .slice(0, 2)
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
    const item = menuItems()[battle.sel];
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

  function applyHit(e) {
    const b = battle;
    const name = b.enemy.name;
    const color = { fire: '#ff9a2e', grass: '#5cc84a', holy: '#fff3a8', flying: '#bfe6ff', light: '#fff6b0' }[e.move.type] || '#ffffff';
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
      fadeThen(() => {
        game.mode = 'world';
        battle = null;
        done();
      });
    }
  }

  function pickMusic() {
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
      return 'battle_' + battle.id;
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
    if (window.Sound) window.Sound.music(pickMusic());
    if (toast.t > 0) toast.t--;
    if (game.mode === 'battle') {
      updateBattle();
    } else if (game.mode === 'sky') {
      updateSky();
    } else if (game.mode === 'eye') {
      updateEye();
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
    ctx.fillStyle = { MONKEY: '#6b4220', ANGEL: '#b8901a', 'SKY BIRD': '#24509a', 'LIGHT OF GODS': '#c8a020' }[dialog.speaker] || '#9a1c1a';
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

    for (let i = 0; i < INV_SIZE; i++) {
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
      drawText(item.name + (inv.equipped === sel ? ' (EQUIPPED)' : ''), P.x + 18, P.y + 116, 8, '#9a1c1a', 'left', null);
      drawText(item.desc, P.x + 18, P.y + 130, 8, '#3b2a1a', 'left', null);
    } else {
      drawText(inventory.some(Boolean) ? 'SELECT AN ITEM' : 'YOUR BAG IS EMPTY', P.x + 18, P.y + 122, 8, '#8a7550', 'left', null);
    }

    drawButton(EQUIP_BTN, sel && inv.equipped === sel ? 'UNEQUIP' : 'EQUIP', isGem(sel));
    drawButton(THROW_BTN, 'THROW', !!sel);
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
    const skyBands = heaven ? ['#f6d77a', '#f9e29a', '#fbecb8', '#fdf4d4', '#fffaea']
      : cloudBg ? ['#2c4aa6', '#3a5cb8', '#4a70c8', '#6189d6', '#7ca0e2', '#9ab8ee'] : SKY;
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
    if (!heaven && !cloudBg) {
      ctx.fillStyle = forest ? '#86c070' : '#9fd38a';
      ctx.fillRect(-8, HORIZON, W + 16, H - HORIZON);
      ctx.fillStyle = forest ? '#78b062' : '#8cc878';
      for (let y = HORIZON + 4, gap = 4; y < 164; gap += 2, y += gap) ctx.fillRect(-8, y, W + 16, 2);
    }

    const slide = clamp(1 - b.introT / 30, 0, 1);
    const eBaseX = 282 + Math.round(slide * 160);
    const pBaseX = 72 - Math.round(slide * 160);

    const pal = heaven ? ['#fff3a8', '#ffd84a', '#e0b830']
      : cloudBg ? ['#ffffff', '#dbe7f7', '#b4c8e6'] : undefined;
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
      drawImg(img, eBaseX + 18 - (img.width * sc) / 2 + eOff + jitter, 94 - img.height * sc + 3 + eDy + bob, -1, sc);
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

    drawPanel(14, 14, 160, 34);
    drawText(b.enemy.name, 22, 20, 8, '#3b2a1a', 'left', null);
    drawText('HP', 22, 35, 8, '#c08020', 'left', null);
    drawHpBar(44, 36, 120, b.eDisp, b.enemy.hp);

    drawPanel(208, 112, 164, 40);
    drawText('YOU', 216, 118, 8, '#3b2a1a', 'left', null);
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
      for (let i = 0; i < 4; i++) {
        const r = slotRect(i);
        const move = items[i];
        if (move) {
          const selected = b.sel === i;
          ctx.fillStyle = selected ? (move.swap || swapping ? '#5a3fb0' : '#9a1c1a') : '#c9ae74';
          ctx.fillRect(r.x, r.y, r.w, r.h);
          drawText(move.name, r.x + 12, r.y + 4, 8, selected ? '#ffe14d' : '#3b2a1a', 'left', null);
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
  }

  // ---------- Render ----------
  function render() {
    if (game.mode === 'battle') {
      renderBattle();
    } else if (game.mode === 'sky') {
      renderSky();
    } else if (game.mode === 'eye') {
      renderEye();
    } else {
      renderWorld();
      if (game.mode === 'transition') renderTransition();
    }
    if (fade.alpha > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fade.alpha})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- Eye boss (true form) ----------
  const EYE_FIGHT_FRAMES = 1800;
  const EYE_INTRO_END = 230;
  const BANDS = { top: [[0, 78]], bottom: [[138, H]], both: [[0, 78], [138, H]], middle: [[72, 144]] };
  const DASH_HALF = 24;
  const PX = 70;
  const eye = {
    phase: 'intro', t: 0, py: 108, pvy: 0, attempt: 1, timer: 0,
    beams: [], orbs: [], next: 60, nextOrb: 0, shake: 0, flash: 0, parts: [], streaks: [],
    ex: 316, ey: 108,
  };

  function startEyeFight() {
    game.mode = 'eye';
    Object.assign(eye, {
      phase: 'intro', t: 0, py: 99 + 9, pvy: 0, attempt: 1, timer: 0,
      beams: [], orbs: [], dash: null, next: 60, nextOrb: 0, shake: 0, flash: 0, parts: [], ex: 300, ey: -60, energyDisp: undefined,
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
    Object.assign(eye, { phase: 'fight', t: 0, timer: 0, beams: [], orbs: [], dash: null, next: 70, nextOrb: 0, py: 108, pvy: 0, ex: 316, ey: 108 });
  }

  function eyeIntroPlayerY(t) {
    if (t < 74) return 167;
    const p = Math.min(1, (t - 74) / 30);
    return 167 + (108 - 167) * (1 - (1 - p) * (1 - p));
  }

  function updateEye() {
    const e = eye;
    e.t++;
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
        sfx('orb');
        e.nextOrb = Math.round(72 - prog * 22);
      }
      let hit = dashHit;
      const top = e.py - 5, bot = e.py + 5;
      for (let i = e.beams.length - 1; i >= 0; i--) {
        const b = e.beams[i];
        b.t++;
        const firing = b.t >= b.warn && b.t < b.warn + b.fire;
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
        sfx('finalBoom');
        e.flash = 60;
        e.shake = 40;
        eyeBurst(e.ex, e.ey, 90, ['#ffffff', '#fff3a8', '#ffe14d', '#e8c547'], 6, 50);
      }
      if (t === 330) fadeThen(() => { e.phase = 'end'; e.t = 0; });
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
    ctx.fillStyle = '#c8301e';
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
        } else {
          const ft = b.t - b.warn;
          const k = ft < 4 ? ft / 4 : ft > b.fire - 6 ? (b.fire - ft) / 6 : 1;
          const mid = (y0 + y1) / 2, half = ((y1 - y0) / 2) * k;
          ctx.save();
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#e8c547';
          ctx.beginPath();
          ctx.moveTo(e.ex - 20, e.ey - 6);
          ctx.lineTo(e.ex - 20, e.ey + 6);
          ctx.lineTo(e.ex - 70, mid + half);
          ctx.lineTo(e.ex - 70, mid - half);
          ctx.fill();
          ctx.fillRect(0, mid - half, e.ex - 70, half * 2);
          ctx.fillStyle = '#fff3a8';
          ctx.fillRect(0, mid - half * 0.7, e.ex - 60, half * 1.4);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, mid - half * 0.35 + (tick % 4 < 2 ? 1 : 0), e.ex - 50, half * 0.7);
          ctx.restore();
          for (let i = 0; i < 6; i++) {
            sparkle((W - ((tick * 9 + i * 67) % W)), Math.round(mid + Math.sin(i * 2.1 + tick * 0.3) * half * 0.8), 1, '#ffffff');
          }
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

    if (e.phase !== 'dead') {
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
  }

  // ---------- Loop ----------
  let last = performance.now();
  let acc = 0;
  const STEP = 1000 / 60;
  function loop(t) {
    acc += Math.min(100, t - last);
    last = t;
    while (acc >= STEP) {
      update();
      acc -= STEP;
    }
    render();
    requestAnimationFrame(loop);
  }

  const startTitle = () => {
    if (titleStart === null) titleStart = performance.now();
  };
  if (document.fonts && document.fonts.load) {
    document.fonts.load(`8px ${FONT}`).then(startTitle, startTitle);
  }
  setTimeout(startTitle, 1500);
  requestAnimationFrame(loop);
})();
