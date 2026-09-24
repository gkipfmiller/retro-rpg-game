// Tiny pixel-art icons drawn from character grids, so status effects read at a glance in the HUD
// and over actors on the map. Each grid is 8x8; "." is transparent, other characters index the palette.

const STATUS_ICONS = {
  chilled: {
    palette: { a: "#8fdcff", b: "#e6fbff", k: "#123447" },
    grid: [
      "...b....",
      ".b.a.b..",
      "..bab...",
      "baaaaab.",
      "..bab...",
      ".b.a.b..",
      "...b....",
      "........",
    ],
  },
  sundered: {
    palette: { a: "#c9b18a", b: "#fff0c8", k: "#3b2a1a" },
    grid: [
      ".kkkkkk.",
      "kbab.aak",
      "kaa.aaak",
      "kaaa.aak",
      "kaa.aaak",
      ".kaa.ak.",
      "..kaak..",
      "...kk...",
    ],
  },
  weakened: {
    palette: { a: "#e0833f", b: "#ffc58f", k: "#2a140a" },
    grid: [
      "..kbak..",
      "..kaak..",
      "..kaak..",
      "kkkaakkk",
      ".kaaaak.",
      "..kaak..",
      "...kk...",
      "........",
    ],
  },
  hexed: {
    palette: { a: "#b06cff", b: "#f1e2ff", c: "#2a0d3d", k: "#1c0e24" },
    grid: [
      "........",
      "..kkkk..",
      ".kbbbbk.",
      "kbbaabbk",
      "kbacabbk",
      ".kbbbbk.",
      "..kkkk..",
      "........",
    ],
  },
  poisoned: {
    palette: { a: "#62c05a", b: "#c9f7a8", k: "#13280f" },
    grid: [
      "...k....",
      "..kak...",
      "..kak...",
      ".kaabk..",
      "kaaabak.",
      "kaaaaak.",
      ".kaaak..",
      "..kkk...",
    ],
  },
  arcane_shield: {
    palette: { a: "#7fb6ff", b: "#e2f0ff", k: "#13233d" },
    grid: [
      "...kk...",
      "..kbak..",
      ".kbaaak.",
      "kbaaaaak",
      "kaaaaaak",
      ".kaaaak.",
      "..kaak..",
      "...kk...",
    ],
  },
};

const canvasCache = new Map();
const urlCache = new Map();

function drawIcon(spec) {
  const size = spec.grid.length;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  spec.grid.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      const color = spec.palette[cell];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

// An 8x8 canvas for drawing onto the map (scale it up with smoothing off), or null for unknown statuses.
export function getStatusIconCanvas(statusId) {
  const spec = STATUS_ICONS[statusId];
  if (!spec || typeof document === "undefined") return null;
  if (!canvasCache.has(statusId)) canvasCache.set(statusId, drawIcon(spec));
  return canvasCache.get(statusId);
}

// A data URL for <img> tags in the HUD.
export function getStatusIconUrl(statusId) {
  if (!urlCache.has(statusId)) {
    const canvas = getStatusIconCanvas(statusId);
    urlCache.set(statusId, canvas ? canvas.toDataURL() : null);
  }
  return urlCache.get(statusId);
}
