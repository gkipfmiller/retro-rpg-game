// Boss-arena set dressing, drawn as pixel art (16 source pixels per tile): coffins and bone piles
// for Super Skeletor's crypt, pits, a butcher's slab, stitched seams and meat hooks for Patches'
// Stitching Pit, and the throne, pillars, and void fissures for the Abyssal Overlord. Also the wall
// braziers every arena lights when its boss wakes, and the iron bars that seal the entrance.
// Cosmetic only; which tiles block is decided in utils.isBlockedFloor.

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Paints a grid of palette keys ("." is transparent) at 1 source pixel = tileSize / 16.
function paint(ctx, grid, palette, x, y, tileSize) {
  const pixel = tileSize / 16;
  grid.forEach((row, gy) => {
    [...row].forEach((key, gx) => {
      const color = palette[key];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x + gx * pixel), Math.floor(y + gy * pixel), Math.ceil(pixel), Math.ceil(pixel));
    });
  });
}

const COFFIN = {
  palette: { k: "#1a1010", d: "#3b2418", w: "#5e3a24", l: "#7a4e30", g: "#b9a27a" },
  grid: [
    "................",
    ".....kkkkkk.....",
    "....kwwwwwwk....",
    "...kwllllllwk...",
    "...kwlllgllwk...",
    "..kwllgggggllwk.",
    "..kwllllgllllwk.",
    "..kwllllgllllwk.",
    "..kwllllgllllwk.",
    "...kwllllllllwk.",
    "...kwllllllllwk.",
    "....kwllllllwk..",
    "....kwllllllwk..",
    ".....kwwwwwwk...",
    "......kkkkkk....",
    "................",
  ],
};

const BONES = [
  {
    palette: { b: "#d9d2bd", s: "#a39a82", k: "#2a2420" },
    grid: [
      "................", "................", "................", "................",
      "................", "................", "................", ".....bbb........",
      "....bbbbb.......", "....bkbkb.......", "....bbbbb....b.b", ".....b.b......b.",
      ".........bbbbbb.", "........s....b.b", "................", "................",
    ],
  },
  {
    palette: { b: "#d9d2bd", s: "#a39a82" },
    grid: [
      "................", "................", "................", "................",
      "................", "................", "................", "................",
      "..b.b...........", "...bbbbbbbb.....", "..b.b.....bb....", "........b.bs....",
      "...s......bbbbb.", "..........b..b..", "................", "................",
    ],
  },
];

const PIT = {
  palette: { r: "#4a3a30", e: "#2a1e18", k: "#08050a", c: "#6b5a4a", m: "#6a1c1c" },
  grid: [
    "................",
    "..rrrrrrrrrrrr..",
    ".rreeeeeeeeeerr.",
    ".reekkkkkkkkeer.",
    ".rekkkkkkkkkker.",
    ".rekkkkmkkkkker.",
    ".rekkkkkkkkkker.",
    ".rekkkkkkkkmker.",
    ".rekkkkkkkkkker.",
    ".rekkmkkkkkkker.",
    ".rekkkkkkkkkker.",
    ".reekkkkkkkkeer.",
    ".rreeeeeeeeeerr.",
    "..rrrrrrrrrrrr..",
    "................",
    "................",
  ],
};

const SLAB = {
  palette: { k: "#1e1410", w: "#6e4a30", l: "#8e6440", r: "#8a1f1f", s: "#c8ced4", h: "#4a3020" },
  grid: [
    "................",
    "................",
    "................",
    "................",
    "kkkkkkkkkkkkkkkk",
    "klllllllllllllll",
    "kllrrllllllsslll",
    "klrrrlllllsssssl",
    "kllrllllllhhllll",
    "klllllllrrllllll",
    "kwwwwwwwwwwwwwww",
    "kkkkkkkkkkkkkkkk",
    ".kh.........hk..",
    ".kh.........hk..",
    ".kh.........hk..",
    "................",
  ],
};

const PILLAR = {
  // 16 wide, 32 tall: drawn standing on its tile and rising a tile above it.
  palette: { k: "#07050a", o: "#1c1426", m: "#2e2240", h: "#4a3a66", g: "#d9a441", y: "#ffe08a" },
  grid: [
    "...kkkkkkkkkk...", "..kgggggggggggk.", "..kgyyyyyyyyygk.", "...kkkkkkkkkk...",
    "....kommmhmok...", "....kommmhmok...", "....kommmhmok...", "....kommmhmok...",
    "....kommmhmok...", "....kommmhmok...", "....kommmhmok...", "....kgggggggk...",
    "....kgyyyyygk...", "....kommmhmok...", "....kommmhmok...", "....kommmhmok...",
    "....kommmhmok...", "....kommmhmok...", "....kommmhmok...", "....kommmhmok...",
    "....kommmhmok...", "....kgggggggk...", "....kgyyyyygk...", "....kommmhmok...",
    "....kommmhmok...", "....kommmhmok...", "....kommmhmok...", "...kkkkkkkkkk...",
    "..kgggggggggggk.", "..kgyyyyyyyyygk.", ".kkkkkkkkkkkkkkk", "................",
  ],
};

const THRONE = {
  // 48 wide, 48 tall: centred on the middle of its three tiles, rising two tiles into the wall.
  palette: { k: "#07050a", o: "#1c1426", m: "#2e2240", h: "#4a3a66", g: "#d9a441", y: "#ffe08a", r: "#7a1030", p: "#b0306a" },
  grid: [
    "......................kk........................",
    ".....................kggk.......................",
    "....................kgyygk......................",
    "..........kk.......kgyyyygk.......kk............",
    ".........kggk......kgyrrygk......kggk...........",
    "........kgyygk.....kgyrrygk.....kgyygk..........",
    "........kgyygk......kgyygk......kgyygk..........",
    "........kkggkk......kkggkk......kkggkk..........",
    ".........kmmk......kkmmmmkk......kmmk...........",
    ".........kmmkkkkkkkkmmhhmmkkkkkkkkmmk...........",
    ".........kmmoooooooommhhmmoooooooommk...........",
    ".........kmmorrrrrrrrrrrrrrrrrrrrommk...........",
    ".........kmmorpppppppppppppppppprommk...........",
    ".........kmmorprrrrrrrrrrrrrrrrprommk...........",
    ".........kmmorprrrrrrrrrrrrrrrrprommk...........",
    ".........kmmorprrrrrrrrrrrrrrrrprommk...........",
    ".........kmmorprrrrrrrrrrrrrrrrprommk...........",
    ".........kmmorprrrrrrrrrrrrrrrrprommk...........",
    ".........kmmorprrrrrrrrrrrrrrrrprommk...........",
    ".........kmmorprrrrrrrrrrrrrrrrprommk...........",
    ".........kmmorprrrrrrrrrrrrrrrrprommk...........",
    ".........kmmorprrrrrrrrrrrrrrrrprommk...........",
    ".........kmmorprrrrrrrrrrrrrrrrprommk...........",
    ".........kmmorprrrrrrrrrrrrrrrrprommk...........",
    ".........kmmorpppppppppppppppppprommk...........",
    ".....kkkkkmmorrrrrrrrrrrrrrrrrrrrommkkkkk.......",
    "....kgggggmmooooooooooooooooooooommgggggk.......",
    "....kgyyyymmhhhhhhhhhhhhhhhhhhhhhmmyyyygk.......",
    "....kgggggmmmmmmmmmmmmmmmmmmmmmmmmmgggggk.......",
    "....kkkkkommmmmmmmmmmmmmmmmmmmmmmmokkkkk........",
    "........komhhhhhhhhhhhhhhhhhhhhhhmok............",
    "........kommmmmmmmmmmmmmmmmmmmmmmmok............",
    "........kommmmmmmmmmmmmmmmmmmmmmmmok............",
    "........kgggggggggggggggggggggggggggk...........",
    "........kgyyyyyyyyyyyyyyyyyyyyyyyyygk...........",
    "........kggggggggggggggggggggggggggggk..........",
    "........kommmmk..............kommmmk............",
    "........kommmmk..............kommmmk............",
    "........kommmmk..............kommmmk............",
    "........kgggggk..............kgggggk............",
    "........kkkkkkk..............kkkkkkk............",
    "................................................",
    "................................................",
    "................................................",
    "................................................",
    "................................................",
    "................................................",
    "................................................",
  ],
};

// Brazier bowl on a wall bracket; the flame is drawn separately so it can flicker and change colour.
const BRAZIER = {
  palette: { k: "#0e0a08", i: "#3a3030", h: "#5c5050", e: "#6a2a10" },
  grid: [
    "................", "................", "................", "................",
    "................", "................", "...kkkkkkkkkk...", "...kiiiiiiiik...",
    "...khhhhhhhhk...", "....kiiiiiik....", ".....kiiiik.....", "......kiik......",
    "......kiik......", ".....kkkkkk.....", "................", "................",
  ],
};

// Flame colours per arena: necrotic green, butcher's orange, void violet. A boss's later phase
// can override (Patches enraged burns red).
export const ARENA_FIRE = {
  grave: { core: "#e8ffe0", mid: "#7dff9a", outer: "#1f8a4a", light: "110, 255, 150" },
  stitch: { core: "#fff1c2", mid: "#ff9a3c", outer: "#b8401c", light: "255, 150, 70" },
  throne: { core: "#f6e0ff", mid: "#c07cff", outer: "#5a1f9a", light: "190, 120, 255" },
  enraged: { core: "#ffe0c0", mid: "#ff4a2a", outer: "#8a1010", light: "255, 70, 40" },
  victory: { core: "#ffffff", mid: "#ffe08a", outer: "#d9a441", light: "255, 220, 150" },
};

export function drawArenaProp(ctx, prop, x, y, tileSize, seed) {
  switch (prop) {
    case "coffin":
      paint(ctx, COFFIN.grid, COFFIN.palette, x, y, tileSize);
      break;
    case "bones": {
      const pile = BONES[seed % BONES.length];
      ctx.save();
      if (seed % 3 === 0) {
        ctx.translate(x + tileSize, y);
        ctx.scale(-1, 1);
        paint(ctx, pile.grid, pile.palette, 0, 0, tileSize);
      } else {
        paint(ctx, pile.grid, pile.palette, x, y, tileSize);
      }
      ctx.restore();
      break;
    }
    case "pit":
      paint(ctx, PIT.grid, PIT.palette, x, y, tileSize);
      break;
    case "slab":
      paint(ctx, SLAB.grid, SLAB.palette, x, y, tileSize);
      break;
    case "pillar":
      paint(ctx, PILLAR.grid, PILLAR.palette, x, y - tileSize, tileSize);
      break;
    case "fissure":
      drawFissure(ctx, x, y, tileSize, seed);
      break;
    default:
      break;
  }
}

// The throne is drawn once, from its middle tile.
export function drawThrone(ctx, centreX, y, tileSize) {
  paint(ctx, THRONE.grid, THRONE.palette, centreX - tileSize * 1.5, y - tileSize * 2 + tileSize * 0.4, tileSize);
}

function drawFissure(ctx, x, y, tileSize, seed) {
  const now = performance.now();
  const glow = reduceMotion() ? 0.7 : 0.55 + Math.sin(now / 420 + seed) * 0.25;
  const points = [[0.1, 0.3], [0.35, 0.45], [0.5, 0.35], [0.7, 0.6], [0.9, 0.55]];
  const flip = seed % 2 ? 1 : -1;
  const path = () => {
    ctx.beginPath();
    points.forEach(([fx, fy], index) => {
      const px = x + fx * tileSize;
      const py = y + (flip > 0 ? fy : 1 - fy) * tileSize;
      if (index) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
  };
  ctx.save();
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(170, 80, 255, ${0.35 * glow})`;
  ctx.lineWidth = Math.max(3, tileSize * 0.22);
  path();
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "#0a0410";
  ctx.lineWidth = Math.max(2, tileSize * 0.1);
  path();
  ctx.stroke();
  ctx.strokeStyle = `rgba(220, 170, 255, ${glow})`;
  ctx.lineWidth = Math.max(1, tileSize * 0.035);
  path();
  ctx.stroke();
  ctx.restore();
}

// Crumbled arena floor (the Overlord's second phase): a starry void with a burning violet rim.
export function drawVoidTile(ctx, x, y, tileSize, seed, visible) {
  const now = performance.now();
  const glow = reduceMotion() ? 0.7 : 0.55 + Math.sin(now / 380 + seed) * 0.2;
  ctx.save();
  ctx.fillStyle = "#06020c";
  ctx.fillRect(x, y, tileSize, tileSize);
  const pixel = Math.max(1, Math.round(tileSize / 16));
  for (let index = 0; index < 4; index += 1) {
    const sx = (seed * (index + 3) * 7) % 14 + 1;
    const sy = (seed * (index + 5) * 11) % 14 + 1;
    const twinkle = reduceMotion() ? 0.6 : 0.4 + 0.6 * Math.abs(Math.sin(now / 600 + seed + index));
    ctx.fillStyle = `rgba(210, 170, 255, ${twinkle})`;
    ctx.fillRect(Math.floor(x + sx * pixel), Math.floor(y + sy * pixel), pixel, pixel);
  }
  if (visible) {
    ctx.strokeStyle = `rgba(170, 80, 255, ${glow})`;
    ctx.lineWidth = Math.max(1, tileSize * 0.06);
    ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, tileSize - ctx.lineWidth, tileSize - ctx.lineWidth);
  }
  ctx.restore();
}

// Patches' stitched seams: a dark red wound line with pale cross-stitches.
export function drawSeam(ctx, orientation, x, y, tileSize) {
  const pixel = tileSize / 16;
  ctx.save();
  ctx.fillStyle = "rgba(90, 20, 24, 0.85)";
  const along = (offset, across, length, thickness, color) => {
    ctx.fillStyle = color;
    if (orientation === "h") ctx.fillRect(x + offset * pixel, y + across * pixel, length * pixel, thickness * pixel);
    else ctx.fillRect(x + across * pixel, y + offset * pixel, thickness * pixel, length * pixel);
  };
  along(0, 7, 16, 2, "rgba(90, 20, 24, 0.85)");
  // Cross-stitches over the wound.
  ctx.strokeStyle = "rgba(222, 210, 180, 0.9)";
  ctx.lineWidth = Math.max(1, pixel);
  for (const at of [3, 11]) {
    const point = (offset, across) => (orientation === "h" ? [x + offset * pixel, y + across * pixel] : [x + across * pixel, y + offset * pixel]);
    ctx.beginPath();
    ctx.moveTo(...point(at - 2, 5));
    ctx.lineTo(...point(at + 2, 11));
    ctx.moveTo(...point(at + 2, 5));
    ctx.lineTo(...point(at - 2, 11));
    ctx.stroke();
  }
  ctx.restore();
}

// A meat hook on a chain hanging from the top wall down over the first floor row, swaying gently.
export function drawHook(ctx, x, y, tileSize, seed) {
  const now = performance.now();
  const sway = reduceMotion() ? 0 : Math.sin(now / 900 + seed) * tileSize * 0.04;
  const cx = x + tileSize / 2;
  const top = y + tileSize * 0.35;
  const bottom = y + tileSize * 1.55;
  const link = Math.max(2, tileSize * 0.09);
  ctx.save();
  ctx.strokeStyle = "#5e5650";
  ctx.lineWidth = Math.max(1, tileSize * 0.045);
  for (let yy = top, index = 0; yy < bottom; yy += link * 1.4, index += 1) {
    const t = (yy - top) / (bottom - top);
    const lx = cx + sway * t;
    if (index % 2) ctx.strokeRect(lx - link * 0.25, yy, link * 0.5, link);
    else ctx.strokeRect(lx - link * 0.5, yy, link, link);
  }
  const hx = cx + sway;
  ctx.strokeStyle = "#b8bec4";
  ctx.lineWidth = Math.max(1.5, tileSize * 0.07);
  ctx.beginPath();
  ctx.moveTo(hx, bottom);
  ctx.lineTo(hx, bottom + tileSize * 0.12);
  ctx.arc(hx - tileSize * 0.1, bottom + tileSize * 0.12, tileSize * 0.1, 0, Math.PI * 0.95);
  ctx.stroke();
  ctx.fillStyle = "#7a1c1c";
  ctx.fillRect(hx - tileSize * 0.03, bottom + tileSize * 0.02, tileSize * 0.06, tileSize * 0.05);
  ctx.restore();
}

// A wall brazier. lit: 0 (cold) .. 1 (fully lit); fire: an ARENA_FIRE entry.
export function drawBrazier(ctx, x, y, tileSize, lit, fire, seed) {
  paint(ctx, BRAZIER.grid, BRAZIER.palette, x, y, tileSize);
  const cx = x + tileSize / 2;
  const base = y + tileSize * 0.4;
  const now = performance.now();
  if (lit <= 0) {
    // Cold: a faint ember in the bowl.
    ctx.fillStyle = "rgba(160, 60, 20, 0.6)";
    ctx.fillRect(cx - tileSize * 0.06, base, tileSize * 0.12, tileSize * 0.05);
    return;
  }
  const flicker = reduceMotion() ? 1 : 1 + Math.sin(now / 90 + seed * 3) * 0.12 + Math.sin(now / 37 + seed) * 0.06;
  const height = tileSize * 0.55 * lit * flicker;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(cx, base - height * 0.4, 0, cx, base - height * 0.4, tileSize * 0.9);
  glow.addColorStop(0, `rgba(${fire.light}, ${0.45 * lit})`);
  glow.addColorStop(1, `rgba(${fire.light}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(cx - tileSize, base - tileSize * 1.3, tileSize * 2, tileSize * 2);
  ctx.globalCompositeOperation = "source-over";
  for (const [color, scale] of [[fire.outer, 1], [fire.mid, 0.72], [fire.core, 0.4]]) {
    const w = tileSize * 0.2 * scale;
    const h = height * scale;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - w, base);
    ctx.quadraticCurveTo(cx - w * 1.1, base - h * 0.55, cx, base - h);
    ctx.quadraticCurveTo(cx + w * 1.1, base - h * 0.55, cx + w, base);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// Iron bars across an arena entrance. drop: 0 (raised out of sight) .. 1 (down, sealing the tile).
export function drawGateBars(ctx, x, y, tileSize, drop) {
  if (drop <= 0) return;
  const offset = -tileSize * (1 - drop);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y - tileSize * 0.6, tileSize, tileSize * 1.6);
  ctx.clip();
  const top = y - tileSize * 0.6 + offset;
  const height = tileSize * 1.55;
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(x, y + offset, tileSize, tileSize);
  for (let index = 0; index < 4; index += 1) {
    const bx = x + tileSize * (0.14 + index * 0.24);
    ctx.fillStyle = "#1a1714";
    ctx.fillRect(bx - tileSize * 0.05, top, tileSize * 0.12, height);
    ctx.fillStyle = "#6a625a";
    ctx.fillRect(bx - tileSize * 0.03, top, tileSize * 0.06, height);
    ctx.fillStyle = "#9a9088";
    ctx.fillRect(bx - tileSize * 0.03, top, tileSize * 0.02, height);
    // Spiked foot.
    ctx.fillStyle = "#6a625a";
    ctx.beginPath();
    ctx.moveTo(bx - tileSize * 0.05, top + height);
    ctx.lineTo(bx + tileSize * 0.05, top + height);
    ctx.lineTo(bx, top + height + tileSize * 0.08);
    ctx.fill();
  }
  for (const across of [0.28, 0.72]) {
    ctx.fillStyle = "#1a1714";
    ctx.fillRect(x, top + height * across - tileSize * 0.05, tileSize, tileSize * 0.1);
    ctx.fillStyle = "#6a625a";
    ctx.fillRect(x, top + height * across - tileSize * 0.03, tileSize, tileSize * 0.05);
  }
  ctx.restore();
}
