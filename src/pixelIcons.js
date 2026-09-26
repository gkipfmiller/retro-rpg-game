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
  mana_barrier: {
    palette: { a: "#5aa8ff", b: "#d8ecff", k: "#10213d" },
    grid: [
      "..kkkk..",
      ".kbbbbk.",
      "kb.aa.bk",
      "kbaaaabk",
      "kbaaaabk",
      "kb.aa.bk",
      ".kbbbbk.",
      "..kkkk..",
    ],
  },
  burning: {
    palette: { r: "#e8452c", o: "#ff9a3c", y: "#ffe07a", k: "#2a0e06" },
    grid: [
      "...r....",
      "..rr..r.",
      ".rorr.r.",
      ".roorrr.",
      "rooyoorr",
      "royyyor.",
      ".ryyyr..",
      "..kkk...",
    ],
  },
  frozen: {
    palette: { a: "#9fe6ff", b: "#ffffff", d: "#3a8fc0", k: "#0e2a3a" },
    grid: [
      "kkkkkkkk",
      "kbbaaadk",
      "kbaaaadk",
      "kaabaadk",
      "kaaaabdk",
      "kaaaaadk",
      "kddddddk",
      "kkkkkkkk",
    ],
  },
};

// One icon per spell or ability, used on the hotbar, loadout, and class cards.
const STEEL = { w: "#eef3f6", s: "#9aa6b2", k: "#2a2f36" };
const SPELL_ICONS = {
  power_strike: {
    palette: { ...STEEL, o: "#f29a2e", g: "#d7a54d", h: "#7a4a22" },
    grid: ["...w....", "..wsw...", "..wsw...", "o.wsw.o.", ".owswo..", "..ggg...", "...h....", "...h...."],
  },
  guard_break: {
    palette: { ...STEEL, r: "#e0574b" },
    grid: [".kkkkkk.", "kssr.ssk", "kss.sssk", "ksss.ssk", "kss.sssk", ".kss.sk.", "..kssk..", "...kk..."],
  },
  magic_missile: {
    palette: { p: "#b06cff", v: "#d8b4ff", w: "#ffffff" },
    grid: [".....pp.", "....pwvp", "....pvvp", "...p.pp.", "..p.....", ".p......", "p.......", "........"],
  },
  arcane_shield: {
    palette: { a: "#7fb6ff", b: "#e2f0ff", k: "#13233d" },
    grid: ["...kk...", "..kbak..", ".kbaaak.", "kbaaaaak", "kaaaaaak", ".kaaaak.", "..kaak..", "...kk..."],
  },
  frost_shard: {
    palette: { w: "#ffffff", b: "#8fdcff", d: "#3a8fc0" },
    grid: ["...wb...", "..wbbb..", "..wbbd..", ".wbbbbd.", "..bbbd..", "..bbdd..", "...bd...", "...d...."],
  },
  blink: {
    palette: { c: "#5fe0e0", w: "#e8ffff" },
    grid: ["..cccc..", ".c....c.", "c..cc..c", "c.c.wc.c", "c.cw.c.c", "c..cc..c", ".c....c.", "..cccc.."],
  },
  chain_bolt: {
    palette: { y: "#ffd86a", w: "#fff6d0" },
    grid: ["....yyw.", "...yy...", "..yy....", ".ywyyy..", "....yy..", "...yy...", "..yy....", ".y......"],
  },
  arcane_pulse: {
    palette: { m: "#e070d0", w: "#ffffff" },
    grid: ["m..m..m.", ".m.m.m..", "..mmm...", "mmmwmmm.", "..mmm...", ".m.m.m..", "m..m..m.", "........"],
  },
  ice_shatter: {
    palette: { w: "#ffffff", b: "#8fdcff", d: "#3a8fc0" },
    grid: ["..wb.b..", ".wbb.bd.", ".bbb.bd.", "........", ".bb.bbd.", ".bb.bd..", "..b.d...", "........"],
  },
  frailty_hex: {
    palette: { g: "#a6d86a", k: "#1c2a10" },
    grid: ["..gggg..", ".gggggg.", ".gkggkg.", ".gkggkg.", ".gggggg.", "..g..g..", "..gggg..", "........"],
  },
  arcane_burst: {
    palette: { o: "#f07a2a", y: "#ffc85a", w: "#fff4d0" },
    grid: ["...o....", "o..o..o.", ".o.y.o..", "..yyy...", "ooywyoo.", "..yyy...", ".o.y.o..", "o..o..o."],
  },
  arcane_spark: {
    palette: { p: "#c79bff", w: "#ffffff", d: "#7a4ad0" },
    grid: ["........", "...p....", "...pp...", ".ppwwp..", "..pwwpp.", "...pp...", "....p...", "..d...d."],
  },
  fireball: {
    palette: { r: "#d8401f", o: "#ff8a2a", y: "#ffd25a", w: "#fff6d8" },
    grid: ["....r...", "..r.rr..", ".rroorr.", "rooyyoor", "royywyor", "rooyyoor", ".rroorr.", "..rrrr.."],
  },
  frost_nova: {
    palette: { w: "#ffffff", b: "#8fdcff", d: "#3a8fc0" },
    grid: ["b..d..b.", ".b.d.b..", "..bwb...", "ddwwwdd.", "..bwb...", ".b.d.b..", "b..d..b.", "........"],
  },
  summon_spire: {
    palette: { p: "#b06cff", v: "#e2c8ff", w: "#ffffff", s: "#5b5470", k: "#2a2438" },
    grid: ["...w....", "..pvp...", "...p....", "..svs...", "..sps...", "..sps...", ".sssss..", "kkkkkkk."],
  },
  aimed_shot: {
    palette: { s: "#dfe6ea", h: "#a0703a", f: "#e05a4b" },
    grid: ["........", ".....s..", "f....ss.", "fhhhhsss", "f....ss.", ".....s..", "........", "........"],
  },
  evasive_step: {
    palette: { b: "#a86c34", d: "#5e3a1a", l: "#cfe8ff" },
    grid: ["....bbb.", "....bbb.", "ll..bbb.", "....bbbb", "lll.bbbb", "...bbbbb", "ll.ddddd", "........"],
  },
};

// One icon per skill-tree branch.
const BRANCH_ICONS = {
  weapon_mastery: SPELL_ICONS.power_strike,
  iron_guard: {
    palette: { ...STEEL, g: "#d7a54d" },
    grid: ["kkkkkkk.", "ksssssk.", "kssgssk.", "ksgggsk.", "kssgssk.", ".ksssk..", "..ksk...", "...k...."],
  },
  vanguard_tactics: {
    palette: { p: "#8a5a2b", r: "#c8453a", y: "#f2c46b" },
    grid: ["p.......", "prrrrr..", "prryrr..", "prrrrr..", "prr.rr..", "pr...r..", "p.......", "p......."],
  },
  elemental_power: {
    palette: { o: "#f07a2a", y: "#ffc85a", w: "#fff4d0" },
    grid: ["...o....", "...oo...", "..oyo...", ".oyyoo..", ".oywyo..", ".oywyo..", "..oyo...", "........"],
  },
  mystic_ward: SPELL_ICONS.arcane_shield,
  control_insight: {
    palette: { k: "#1c2330", w: "#e8eef2", b: "#4aa0e0" },
    grid: ["........", "..kkkk..", ".kwwwwk.", "kwwbbwwk", "kwwbkwwk", ".kwwwwk.", "..kkkk..", "........"],
  },
  deadshot: {
    palette: { r: "#e0574b" },
    grid: ["..rrr...", ".r.r.r..", "r..r..r.", "rrr.rrr.", "r..r..r.", ".r.r.r..", "..rrr...", "........"],
  },
  windrunner: {
    palette: { w: "#cfe8ff" },
    grid: ["........", "wwwww...", ".....w..", "wwwww...", "........", "..wwwwww", ".w......", "..wwww.."],
  },
  pathfinder: {
    palette: { k: "#2a1f14", d: "#6b5033", r: "#e0574b", w: "#eef3f6" },
    grid: ["..kkkk..", ".kddrdk.", "kdddrddk", "kddrrddk", "kddwwddk", "kdddwddk", ".kddwdk.", "..kkkk.."],
  },
};

// The Arcane Spire on the map (16x16): a stone pillar with a floating crystal. Frame 1 brightens the
// crystal for a slow pulse.
const SPIRE_PALETTE = { w: "#ffffff", v: "#e2c8ff", p: "#b06cff", d: "#6a3bb0", s: "#8a84a0", t: "#5b5470", k: "#221d30" };
const SPIRE_FRAMES = [
  [
    "................",
    ".......pp.......",
    "......pvvp......",
    ".....pvwvpd.....",
    "......pvpd......",
    ".......pd.......",
    "................",
    "......kkkk......",
    "......kstk......",
    "......kspk......",
    "......kstk......",
    ".....kkspkk.....",
    ".....ksstttk....",
    "....ksssttttk...",
    "....kkkkkkkkk...",
    "................",
  ],
  [
    ".......ww.......",
    "......wvvw......",
    ".....wvwwvw.....",
    ".....vwwwvp.....",
    "......vwvp......",
    ".......vp.......",
    "................",
    "......kkkk......",
    "......kstk......",
    "......kvtk......",
    "......kstk......",
    ".....kkspkk.....",
    ".....ksstttk....",
    "....ksssttttk...",
    "....kkkkkkkkk...",
    "................",
  ],
];

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

function cachedUrl(key, spec) {
  if (!spec || typeof document === "undefined") return null;
  if (!urlCache.has(key)) urlCache.set(key, drawIcon(spec).toDataURL());
  return urlCache.get(key);
}

export function getSpellIconUrl(spellId) {
  return cachedUrl(`spell:${spellId}`, SPELL_ICONS[spellId]);
}

export function getBranchIconUrl(branchId) {
  return cachedUrl(`branch:${branchId}`, BRANCH_ICONS[branchId]);
}

// An 8x8 canvas for drawing onto the map (scale it up with smoothing off), or null for unknown statuses.
export function getStatusIconCanvas(statusId) {
  const spec = STATUS_ICONS[statusId];
  if (!spec || typeof document === "undefined") return null;
  if (!canvasCache.has(statusId)) canvasCache.set(statusId, drawIcon(spec));
  return canvasCache.get(statusId);
}

// The spire's map sprite for animation frame 0 or 1 (scale it up with smoothing off).
export function getSpireCanvas(frame = 0) {
  if (typeof document === "undefined") return null;
  const key = `spire:${frame % SPIRE_FRAMES.length}`;
  if (!canvasCache.has(key)) canvasCache.set(key, drawIcon({ palette: SPIRE_PALETTE, grid: SPIRE_FRAMES[frame % SPIRE_FRAMES.length] }));
  return canvasCache.get(key);
}

// A data URL for <img> tags in the HUD.
export function getStatusIconUrl(statusId) {
  if (!urlCache.has(statusId)) {
    const canvas = getStatusIconCanvas(statusId);
    urlCache.set(statusId, canvas ? canvas.toDataURL() : null);
  }
  return urlCache.get(statusId);
}
