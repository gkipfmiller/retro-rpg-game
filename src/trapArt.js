// Trap art, drawn as pixel art on the 16px source grid (the spikes use the tileset's own animation).
// Each trap has an armed look, a firing animation (for a moment after it goes off), and, for traps that
// don't simply re-arm, a spent or cooling look:
//   spikes  retracted holes; spikes shoot up when it fires
//   darts   a stone pressure plate with a dart slit and green residue; pressed flat once spent
//   fire    an iron grate over glowing embers; a burst of flame; dim embers while cooling
//   curse   a violet rune circle; it flares, then leaves a burnt-out scorch
//   alarm   a tripwire with a bell; the bell shakes, then the wire hangs snapped
// Cosmetic only: trap rules live in Game.checkTrap.

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// How long a trap's firing animation plays (ms).
export const TRAP_FIRE_MS = 650;

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

const DART_PLATE = {
  armed: {
    palette: { k: "#1c1714", d: "#4a4038", s: "#6f6356", l: "#8e8171", h: "#231c18", g: "#5fbf4a", G: "#9be07a" },
    grid: [
      "................", "................", "..kkkkkkkkkkkk..", "..kllllllllllk..",
      "..klssssssssdk..", "..klshhhhhhsdk..", "..kls.g..g.sdk..", "..klshhhhhhsdk..",
      "..klssssssssdk..", "..klsG.ss.Gsdk..", "..klssssssssdk..", "..kdddddddddddk.",
      "..kkkkkkkkkkkk..", "................", "................", "................",
    ],
  },
  // Pressed flat: sunk into the floor, slit empty, no residue.
  spent: {
    palette: { k: "#15110f", d: "#2e2823", s: "#40382f", h: "#1a1512" },
    grid: [
      "................", "................", "................", "..kkkkkkkkkkkk..",
      "..kddddddddddk..", "..kdsssssssssk..", "..kdshhhhhhssk..", "..kdsssssssssk..",
      "..kdsssssssssk..", "..kdsssssssssk..", "..kdsssssssssk..", "..kkkkkkkkkkkk..",
      "................", "................", "................", "................",
    ],
  },
};

const FIRE_GRATE = {
  palette: { k: "#0d0a09", i: "#3b3633", I: "#5a524c", e: "#b8401c", E: "#ff8a3a" },
  grid: [
    "................", "................", "..kkkkkkkkkkkk..", "..kIiIiIiIiIik..",
    "..kieEeeEeeEeik..", "..kIiIiIiIiIik..", "..kieeEeeEeeeik..", "..kIiIiIiIiIik..",
    "..kiEeeEeeEeeik..", "..kIiIiIiIiIik..", "..kieeEeeeEeeik..", "..kIiIiIiIiIik..",
    "..kkkkkkkkkkkk..", "................", "................", "................",
  ],
};

const CURSE_RUNE = {
  armed: {
    palette: { v: "#8a4fd8", V: "#c79bff", d: "#3a2059" },
    grid: [
      "................", "................", ".....vvvvvv.....", "....v......v....",
      "...v..V..V..v...", "..v...dVVd...v..", "..v..V.dd.V..v..", "..v..V.dd.V..v..",
      "..v...dVVd...v..", "...v..V..V..v...", "....v......v....", ".....vvvvvv.....",
      "................", "................", "................", "................",
    ],
  },
  // Burnt out: a charred ring with no light left in it.
  spent: {
    palette: { c: "#241b1a", C: "#3a2d2a" },
    grid: [
      "................", "................", ".....cccccc.....", "....cCCCCCCc....",
      "...cCc.C...Cc...", "..cC...cc...Cc..", "..cC..c..C..Cc..", "..cC.C..c...Cc..",
      "..cC...cc...Cc..", "...cC.C...cCc...", "....cCCCCCCc....", ".....cccccc.....",
      "................", "................", "................", "................",
    ],
  },
};

const TRIPWIRE = {
  // Pegs at both ends, a taut wire, and a bell hanging from the right peg.
  armed: {
    palette: { p: "#5c4630", P: "#8a6a44", w: "#e8dcc0", c: "#6b5a3a", b: "#c8902e", B: "#f2d27a", k: "#3a2a12" },
    grid: [
      "................", "................", "................", "................",
      "................", "..P.........P...", "..p.........p...", "..pwwwwwwwwwpc..",
      "..p.........p.c.", "............bBb.", "...........bBBBb", "...........bBBBb",
      "...........kkkkk", ".............k..", "................", "................",
    ],
  },
  // Sprung: the wire snapped and hangs from each peg; the bell lies dull.
  spent: {
    palette: { p: "#4a3826", P: "#6f5536", w: "#8f887a", b: "#7a6232", B: "#8f7440", k: "#2a1e0e" },
    grid: [
      "................", "................", "................", "................",
      "................", "..P.........P...", "..p.........p...", "..pw........p...",
      "..p.w......wp...", "..p..w....w.....", "................", "...........kbbb.",
      "..........kbBBb.", "...........kbb..", "................", "................",
    ],
  },
};

// A dart streaking across the tile (firing darts).
function drawDart(ctx, x, y, tileSize, t) {
  const pixel = tileSize / 16;
  const dx = x + (-2 + t * 20) * pixel;
  const dy = y + 7 * pixel;
  ctx.fillStyle = "#6a5a40";
  ctx.fillRect(Math.floor(dx - 4 * pixel), Math.floor(dy), Math.ceil(4 * pixel), Math.ceil(pixel));
  ctx.fillStyle = "#9be07a";
  ctx.fillRect(Math.floor(dx), Math.floor(dy), Math.ceil(2 * pixel), Math.ceil(pixel));
}

// Tongues of flame licking up from the grate (firing fire): taller in the middle, flickering, white
// at the root and red at the tips.
const FLAME_SHAPE = [0.45, 0.7, 0.55, 0.9, 1, 0.8, 0.95, 0.6, 0.75, 0.5];
function drawFlameBurst(ctx, x, y, tileSize, t) {
  const pixel = tileSize / 16;
  const rise = Math.sin(Math.min(1, t) * Math.PI);
  const now = reduceMotion() ? 0 : performance.now();
  FLAME_SHAPE.forEach((shape, index) => {
    const col = 3 + index;
    const flicker = 0.8 + Math.sin(now / 60 + index * 1.9) * 0.2;
    const h = Math.round(13 * rise * shape * flicker);
    const edge = index === 0 || index === FLAME_SHAPE.length - 1;
    for (let row = 0; row < h; row += 1) {
      const heat = row / Math.max(1, h);
      ctx.fillStyle = heat < 0.3 && !edge ? "#fff4cc" : heat < 0.65 ? "#ffa640" : "#d8481e";
      ctx.fillRect(Math.floor(x + col * pixel), Math.floor(y + (12 - row) * pixel), Math.ceil(pixel), Math.ceil(pixel));
    }
  });
}

// Draws one trap. state: "armed" | "spent" | "cooling". firedFor: ms since it last fired (or null).
// spikeFrames: the four tileset spike frames (retracted -> fully out).
export function drawTrap(ctx, trapId, x, y, tileSize, { state = "armed", firedFor = null, spikeFrames = null, visible = true } = {}) {
  const firing = firedFor !== null && firedFor >= 0 && firedFor < TRAP_FIRE_MS;
  const t = firing ? firedFor / TRAP_FIRE_MS : 0;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (!visible) ctx.globalAlpha = 0.4;
  switch (trapId) {
    case "spikes": {
      // Up fast, hold, then sink back: frames 0 (retracted) -> 3 (out) -> 0.
      const frame = firing ? Math.min(3, Math.floor((t < 0.25 ? t / 0.25 : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3) * 3.99)) : 0;
      const image = spikeFrames?.[frame];
      if (image) ctx.drawImage(image, x, y, tileSize, tileSize);
      break;
    }
    case "darts": {
      const art = state === "spent" && !firing ? DART_PLATE.spent : DART_PLATE.armed;
      paint(ctx, art.grid, art.palette, x, y, tileSize);
      if (firing) drawDart(ctx, x, y, tileSize, t);
      break;
    }
    case "fire": {
      const cooling = state === "cooling" && !firing;
      if (cooling) ctx.globalAlpha *= 0.7;
      paint(ctx, FIRE_GRATE.grid, cooling ? { ...FIRE_GRATE.palette, e: "#4a2418", E: "#6e3420" } : FIRE_GRATE.palette, x, y, tileSize);
      ctx.globalAlpha = visible ? 1 : 0.4;
      if (firing) drawFlameBurst(ctx, x, y, tileSize, t);
      break;
    }
    case "curse": {
      const art = state === "spent" && !firing ? CURSE_RUNE.spent : CURSE_RUNE.armed;
      paint(ctx, art.grid, art.palette, x, y, tileSize);
      break;
    }
    case "alarm": {
      if (state === "spent" && !firing) {
        paint(ctx, TRIPWIRE.spent.grid, TRIPWIRE.spent.palette, x, y, tileSize);
      } else {
        // The bell shakes while it rings.
        const shake = firing && !reduceMotion() ? Math.round(Math.sin(firedFor / 28) * 1.5) * (tileSize / 16) : 0;
        ctx.translate(shake, 0);
        paint(ctx, TRIPWIRE.armed.grid, TRIPWIRE.armed.palette, x, y, tileSize);
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

// The light a trap gives off, drawn over the lighting: fire embers (and flame), the curse rune's pulse.
export function drawTrapGlow(ctx, trapId, x, y, tileSize, { state = "armed", firedFor = null } = {}) {
  const firing = firedFor !== null && firedFor >= 0 && firedFor < TRAP_FIRE_MS;
  const now = reduceMotion() ? 0 : performance.now();
  const glow = (color, cx, cy, radius, alpha) => {
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, `rgba(${color}, ${alpha.toFixed(3)})`);
    gradient.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  };
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const cx = x + tileSize / 2;
  const cy = y + tileSize / 2;
  if (trapId === "fire") {
    if (firing) glow("255, 140, 60", cx, cy - tileSize * 0.2, tileSize * 1.3, 0.45 * Math.sin((firedFor / TRAP_FIRE_MS) * Math.PI));
    else if (state !== "cooling") glow("255, 110, 50", cx, cy, tileSize * 0.55, 0.12 + Math.sin(now / 240 + x) * 0.04);
  }
  if (trapId === "curse") {
    if (firing) glow("190, 120, 255", cx, cy, tileSize * 1.2, 0.5 * (1 - firedFor / TRAP_FIRE_MS));
    else if (state !== "spent") glow("170, 100, 255", cx, cy, tileSize * 0.6, 0.1 + Math.sin(now / 700 + y) * 0.05);
  }
  ctx.restore();
}

// A still image of a trap for <img> tags (the death screen portrait). Cached per trap.
const iconCache = new Map();
export function getTrapIconDataUrl(trapId, spikeFrames = null) {
  if (iconCache.has(trapId)) return iconCache.get(trapId);
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d");
  // Spikes are shown sprung; the rest armed.
  if (trapId === "spikes" && spikeFrames?.[3]) ctx.drawImage(spikeFrames[3], 0, 0, 16, 16);
  else drawTrap(ctx, trapId, 0, 0, 16);
  const url = canvas.toDataURL();
  iconCache.set(trapId, url);
  return url;
}
