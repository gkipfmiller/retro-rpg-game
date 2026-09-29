// The Fungal Depths (Floors 11-15), drawn as pixel art (16 source pixels per tile): moss, pale
// mycelium threads and small glowing mushroom clusters on the floor; glowing shelf fungi and hanging
// roots on the walls. Mushrooms glow cyan, violet or (rarely) amber, and the shelf fungi light the
// room around them. Cosmetic only.

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Paints a grid of palette keys ("." is transparent) at 1 source pixel = tileSize / 16.
function paint(ctx, grid, palette, x, y, tileSize, flip = false) {
  const pixel = tileSize / 16;
  grid.forEach((row, gy) => {
    [...row].forEach((key, gx) => {
      const color = palette[key];
      if (!color) return;
      const sx = flip ? 15 - gx : gx;
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x + sx * pixel), Math.floor(y + gy * pixel), Math.ceil(pixel), Math.ceil(pixel));
    });
  });
}

// Cap colours by glow: dark rim, body, highlight, and the light itself (RGB, for glows).
export const FUNGAL_GLOWS = {
  cyan: { c: "#1d6a6c", C: "#3cbfb4", L: "#a4f7e8", s: "#e6fffa", light: "110, 245, 225" },
  violet: { c: "#5a2677", C: "#a654d0", L: "#eaa6ff", s: "#fbe6ff", light: "205, 120, 255" },
  amber: { c: "#6e4a1a", C: "#d09a3c", L: "#ffd98a", s: "#fff4d8", light: "255, 200, 110" },
};
const STEM = { t: "#d4ccb2", T: "#8a826a" };

export function pickFungalGlow(hash) {
  const roll = hash % 10;
  return roll < 5 ? "cyan" : roll < 9 ? "violet" : "amber";
}

// Floor mushroom clusters: two layouts, mirrored by hash for variety.
const SHROOM_CLUSTERS = [
  [
    "................", "................", "................", "................",
    "................", "................", "................", "........cCCc....",
    ".......cCLLCc...", ".......CCsCCC...", "....ccc..tT.....", "...cCLCc.tT..cc.",
    ".....tT..tT..LC.", ".....tT..tT..T..", "....TtT.TtTT.T..", "................",
  ],
  [
    "................", "................", "................", "................",
    "................", "................", "................", "................",
    "................", "..cCCc..........", ".cCLsCc....cCc..", "..CCCC....cLCCc.",
    "...tT......tT...", "...tT..cc..tT...", "..TtT..tT.TttT..", "................",
  ],
];

const MOSS = { m: "#243a22", M: "#35552c", g: "#4d7a3a" };
const MYCELIUM = { w: "#aebfa6", d: "#6f8068" };

// Draws one Fungal Depths floor detail: "moss", "mycelium" or "shrooms".
export function drawFungalFloorDetail(ctx, kind, px, py, tileSize, hash) {
  const pixel = tileSize / 16;
  const dot = (gx, gy, color, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(px + gx * pixel), Math.round(py + gy * pixel), Math.ceil(w * pixel), Math.ceil(h * pixel));
  };
  if (kind === "moss") {
    // A soft irregular patch: a dark base, a lighter body, and a few bright tufts.
    const ox = 2 + (hash % 5);
    const oy = 3 + ((hash >>> 3) % 6);
    dot(ox + 1, oy, MOSS.m, 5, 1);
    dot(ox, oy + 1, MOSS.m, 8, 3);
    dot(ox + 2, oy + 4, MOSS.m, 4, 1);
    dot(ox + 1, oy + 1, MOSS.M, 5, 2);
    dot(ox + 3, oy + 3, MOSS.M, 3, 1);
    dot(ox + 2, oy + 1, MOSS.g);
    dot(ox + 5, oy + 2, MOSS.g);
    dot(ox + 3, oy, MOSS.g);
  } else if (kind === "mycelium") {
    // Pale threads branching across the stone.
    let gx = 1;
    let gy = 4 + (hash % 8);
    for (let step = 0; step < 13; step += 1) {
      dot(gx, gy, step % 4 === 3 ? MYCELIUM.w : MYCELIUM.d);
      if (step % 4 === 1) dot(gx, gy + ((hash >>> step) & 1 ? 1 : -1), MYCELIUM.d);
      gx += 1;
      gy += ((hash >>> (step + 4)) & 3) === 0 ? 1 : ((hash >>> (step + 4)) & 3) === 1 ? -1 : 0;
      gy = Math.max(2, Math.min(13, gy));
    }
    dot(gx - 1, gy, MYCELIUM.w);
  } else if (kind === "shrooms") {
    const glow = FUNGAL_GLOWS[pickFungalGlow(hash)];
    paint(ctx, SHROOM_CLUSTERS[hash % SHROOM_CLUSTERS.length], { ...glow, ...STEM }, px, py, tileSize, (hash >>> 5) % 2 === 1);
  }
}

// ── Walls ──
// Only wall faces with open floor below grow anything: glowing shelf fungi (which light the room)
// or hanging roots. Returns { kind, glow } or null.
export function getFungalWallFeature(map, x, y, hash) {
  const tile = map[y]?.[x];
  const below = map[y + 1]?.[x];
  if (tile?.type !== "wall" || below?.type !== "floor") return null;
  // Keep the pieces apart: nothing directly beside another feature's tile.
  const roll = hash % 100;
  if (roll < 9) return { kind: "shelf", glow: pickFungalGlow(hash >>> 7) };
  if (roll < 22) return { kind: "roots" };
  return null;
}

// Shelf fungi stacked on the lower face of the wall, jutting a little into the room.
const SHELF = [
  "................", "................", "................", "................",
  "................", "................", "................", "..........cCCc..",
  "........cCLLLCc.", ".........TTTTT..", "...cCCc.........", ".cCLLsCCc.......",
  "..TTTTTT....cCc.", "...........cLCCc", "............TTT.", "................",
];

const ROOTS = [
  { x: 3, length: 5 }, { x: 6, length: 8 }, { x: 7, length: 4 }, { x: 11, length: 7 }, { x: 13, length: 3 },
];

export function drawFungalWallFeature(ctx, feature, px, py, tileSize, hash, visible) {
  const pixel = tileSize / 16;
  ctx.save();
  if (!visible) ctx.globalAlpha = 0.38;
  if (feature.kind === "shelf") {
    paint(ctx, SHELF, { ...FUNGAL_GLOWS[feature.glow], ...STEM, T: "#5d5646" }, px, py + pixel * 2, tileSize, hash % 2 === 1);
  } else if (feature.kind === "roots") {
    // Roots creep out of the wall's base and dangle over the floor below, tipped with moss.
    const now = reduceMotion() ? 0 : performance.now();
    const picks = ROOTS.filter((_, index) => ((hash >>> index) & 1) === 1 || index === hash % ROOTS.length);
    for (const root of picks) {
      const sway = Math.round(Math.sin(now / 1400 + root.x + hash) * 0.6);
      const top = py + tileSize - pixel * 3;
      ctx.fillStyle = "#3a2c1e";
      ctx.fillRect(Math.floor(px + root.x * pixel), Math.floor(top), Math.ceil(pixel), Math.ceil(root.length * pixel));
      ctx.fillStyle = "#5c4630";
      ctx.fillRect(Math.floor(px + root.x * pixel), Math.floor(top), Math.ceil(pixel), Math.ceil(pixel * 2));
      ctx.fillStyle = MOSS.g;
      ctx.fillRect(Math.floor(px + (root.x + sway) * pixel), Math.floor(top + root.length * pixel), Math.ceil(pixel), Math.ceil(pixel));
    }
  }
  ctx.restore();
}

// The emissive part of a shelf fungus or mushroom cluster, drawn over the lighting.
export function drawFungalGlow(ctx, glowName, cx, cy, radius, hash, strength = 1) {
  const glow = FUNGAL_GLOWS[glowName];
  if (!glow) return;
  const now = reduceMotion() ? 0 : performance.now();
  const pulse = 0.8 + Math.sin(now / 900 + (hash % 97)) * 0.2;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, `rgba(${glow.light}, ${(0.22 * pulse * strength).toFixed(3)})`);
  gradient.addColorStop(1, `rgba(${glow.light}, 0)`);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = gradient;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
}
