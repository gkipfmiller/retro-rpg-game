import { CLASSES, ENEMIES, ITEMS, SPELLS, STATUS_DEFINITIONS, TRAPS } from "./data.js";
import {
  getActorSprite,
  getActorSpriteFrame,
  getEnemySpriteId,
  getFloorSprite,
  getItemSprite,
  getPickupSpriteId,
  getTrapPickupSpriteId,
  getTrapSprite,
  getVendorSpriteId,
  getWallSprite,
} from "./assets.js";
import { clamp } from "./utils.js";
import { LOG_FILTERS, logText, mergeLogEntries } from "./log.js";
import { getSpellIconUrl, getStatusIconCanvas, getStatusIconUrl } from "./pixelIcons.js";

const COLORS = {
  wall: "#26303d",
  floor: "#13181f",
  explored: "#1b242d",
  player: "#d7a54d",
  enemy: "#d16464",
  elite: "#e28f43",
  boss: "#f0d37a",
  stairs: "#89d185",
  item: "#7cc1ff",
  vendor: "#d8b4fe",
  chest: "#b47b32",
  trap: "#cf5f5f",
  health: "#cf5f5f",
};

// Camera: tiles render at a whole-number multiple of the 16px source art, the largest multiple that still
// fits at least this many tiles across (fewer on phone-width canvases so tiles stay readable).
// The canvas backing store matches its on-screen size so pixels stay crisp.
const SOURCE_TILE_PX = 16;
const MIN_VIEW_TILES_WIDE = 22;
const MIN_VIEW_TILES_WIDE_NARROW = 15;
const NARROW_CANVAS_CSS_PX = 640;
const CANVAS_ASPECT = 3 / 4;
const CAMERA_FOLLOW_MS = 90;
// How long the Grey Witness takes to dissolve after granting a boon.
const SAGE_FADE_MS = 1800;
const BOSS_INTRO_MS = 3400;
const FLOOR_CARD_MS = 1900;

// Torch lighting is cosmetic: it darkens and tints the edges of the view a little but never hides
// anything the fog of war shows. Each band's shadows take on its own colour (RGB).
const LIGHT_TINTS = {
  sage: "10, 8, 20",
  crypt: "6, 8, 14",
  ember_halls: "20, 6, 2",
  fungal_depths: "3, 14, 6",
  sunken_vault: "2, 14, 9",
  necropolis: "16, 3, 14",
  stitchworks: "16, 10, 3",
  void_deep: "8, 5, 22",
  obsidian_reach: "20, 4, 6",
  abyssal_throne: "16, 3, 20",
};
const LIGHT_OUTER_DARKNESS = 0.38;

// Endgame floor details, drawn as pixel art on a share of floor tiles (hash-picked, so each floor's
// layout is stable). Chance is out of 1000 per tile.
const FLOOR_DETAILS = {
  void_deep: [{ kind: "stars", chance: 120 }, { kind: "rift", chance: 25 }],
  obsidian_reach: [{ kind: "crack", chance: 90 }, { kind: "vent", chance: 25 }],
  abyssal_throne: [{ kind: "gilt", chance: 70 }],
};

// Sprites cut from the sewer item sheet (x, y, width, height in source pixels); lists are animation frames.
const SEWER_SPRITES = {
  torch: [[144, 32, 16, 32], [160, 32, 16, 32], [176, 32, 16, 32], [192, 32, 16, 32], [208, 32, 16, 32]],
  web: [[144, 112, 16, 16]],
  webCorner: [[160, 112, 16, 16]],
  pillar: [[0, 144, 16, 48]],
  pillar_slime: [[16, 144, 16, 48]],
  crate_small: [[64, 144, 16, 16]],
  crate_large: [[32, 128, 32, 32]],
  cauldron: [[32, 160, 32, 32], [64, 160, 32, 32], [96, 160, 32, 32]],
  rocks: [[144, 0, 32, 16]],
};
const SEWER_FRAME_MS = { torch: 120, cauldron: 420 };

// Sewer floor decor from the sewer floor atlas (column, row), by kind. Drain eyes blink between two frames.
const SEWER_FLOOR_DECOR = [
  { kind: "grate", chance: 16, coords: [[1, 4]] },
  { kind: "manhole", chance: 10, coords: [[4, 2]] },
  { kind: "rivets", chance: 28, coords: [[1, 0], [2, 0]] },
  { kind: "eyes", chance: 12, coords: [[3, 0], [4, 0]] },
  { kind: "cracks", chance: 20, coords: [[3, 4], [4, 4]] },
  { kind: "drain", chance: 6, coords: [[5, 0]] },
];

// Drifting motes over visible floor, per band. Speeds are in tiles per second. A band can list several
// layers (the sewer has falling drips and a slow mist).
const MOTE_STYLES = {
  sunken_vault: [
    { count: 16, colors: ["#9fd6c8", "#cdeee4"], vx: [0, 0], vy: [2.4, 3.4], life: [450, 850], twinkle: false, height: 2 },
    { count: 14, colors: ["#7fbf9a", "#9fd0b0"], vx: [-0.12, 0.12], vy: [-0.04, 0.04], life: [5000, 9000], twinkle: false, size: 3, alpha: 0.16 },
  ],
  void_deep: { count: 34, colors: ["#b9a8ff", "#e6ddff", "#7f6ad8"], vx: [-0.12, 0.12], vy: [-0.22, -0.04], life: [3000, 6500], twinkle: true },
  obsidian_reach: { count: 42, colors: ["#ffb070", "#ff7a3a", "#ffd79a"], vx: [-0.18, 0.18], vy: [-0.9, -0.35], life: [1400, 3200], twinkle: false },
  abyssal_throne: { count: 30, colors: ["#f2c46b", "#fff0c2", "#c89a3c"], vx: [-0.08, 0.08], vy: [0.04, 0.18], life: [4000, 7500], twinkle: true },
};
const LIGHT_RADIUS_TILES = 8.5;
const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, boss: 3 };
// Glow under each boss's reward chest, matching its palette.
const CHEST_AURAS = {
  bone: "rgba(214, 222, 170, 0.26)",
  crimson: "rgba(200, 60, 50, 0.28)",
  void: "rgba(160, 100, 255, 0.3)",
};

// Screen flashes: low HP (critical) and boss moments. Summons flash (necro for Super Skeletor, void
// for the Overlord), as do the Overlord's phase change (void), Patches' slam, and every boss defeat (seal).
const FLASH_VARIANTS = ["critical", "necro", "slam", "void", "seal"];

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const MINIMAP_COLORS = {
  panel: "rgba(8, 10, 13, 0.78)",
  border: "rgba(215, 165, 77, 0.55)",
  wall: "#2c313b",
  floor: "#4a505c",
  floorVisible: "#737b8c",
  stairs: "#89d185",
  vendor: "#d8b4fe",
  shrine: "#79e1c9",
  chest: "#d7a54d",
  enemy: "#e05555",
  boss: "#f0d37a",
  player: "#ffffff",
  viewport: "rgba(240, 234, 214, 0.7)",
};

// Actors draw at their native pixel proportions (16 source px = 1 tile), times this scale.
const ACTOR_SCALES = {
  bone_captain: 1.4,
  sewer_bat: 0.7,
  sludge_crawler: 0.7,
  drain_tentacle: 0.6,
};

const FLOOR_THEMES = {
  sage: {
    floorVisible: "#1c1824",
    floorFog: "#17131d",
    wallVisible: "#2d3144",
    wallFog: "#1d2230",
    floorOverlayVisible: "rgba(128, 106, 168, 0.16)",
    floorOverlayFog: "rgba(88, 72, 120, 0.14)",
    wallOverlayVisible: "rgba(124, 132, 196, 0.12)",
    wallOverlayFog: "rgba(86, 92, 136, 0.12)",
  },
  crypt: {
    floorVisible: "#141a20",
    floorFog: "#11161b",
    wallVisible: "#27303b",
    wallFog: "#1a2129",
    floorOverlayVisible: "rgba(82, 102, 126, 0.1)",
    floorOverlayFog: "rgba(58, 74, 94, 0.12)",
    wallOverlayVisible: "rgba(112, 130, 150, 0.08)",
    wallOverlayFog: "rgba(74, 88, 106, 0.1)",
  },
  ember_halls: {
    floorVisible: "#1d1615",
    floorFog: "#181112",
    wallVisible: "#352421",
    wallFog: "#251917",
    floorOverlayVisible: "rgba(184, 96, 62, 0.14)",
    floorOverlayFog: "rgba(120, 66, 46, 0.14)",
    wallOverlayVisible: "rgba(154, 90, 58, 0.12)",
    wallOverlayFog: "rgba(98, 56, 38, 0.12)",
  },
  fungal_depths: {
    floorVisible: "#141d17",
    floorFog: "#101812",
    wallVisible: "#223026",
    wallFog: "#17211a",
    floorOverlayVisible: "rgba(86, 154, 90, 0.14)",
    floorOverlayFog: "rgba(58, 108, 62, 0.14)",
    wallOverlayVisible: "rgba(94, 142, 102, 0.12)",
    wallOverlayFog: "rgba(60, 96, 68, 0.12)",
  },
  sunken_vault: {
    floorVisible: "#141a1f",
    floorFog: "#10151a",
    wallVisible: "#20313a",
    wallFog: "#18242c",
    floorOverlayVisible: "rgba(58, 116, 128, 0.08)",
    floorOverlayFog: "rgba(42, 82, 92, 0.1)",
    wallOverlayVisible: "rgba(82, 132, 146, 0.06)",
    wallOverlayFog: "rgba(52, 84, 96, 0.08)",
  },
  necropolis: {
    floorVisible: "#1f151d",
    floorFog: "#171018",
    wallVisible: "#342433",
    wallFog: "#241a24",
    floorOverlayVisible: "rgba(158, 74, 118, 0.14)",
    floorOverlayFog: "rgba(102, 50, 78, 0.14)",
    wallOverlayVisible: "rgba(130, 86, 126, 0.1)",
    wallOverlayFog: "rgba(84, 58, 82, 0.12)",
  },
  stitchworks: {
    floorVisible: "#231c15",
    floorFog: "#19140f",
    wallVisible: "#3b2d24",
    wallFog: "#2a2018",
    floorOverlayVisible: "rgba(168, 122, 66, 0.15)",
    floorOverlayFog: "rgba(112, 80, 42, 0.14)",
    wallOverlayVisible: "rgba(142, 106, 68, 0.12)",
    wallOverlayFog: "rgba(90, 68, 44, 0.12)",
  },
  // The atlas themes below are coloured by their recoloured atlases, so their overlays stay light.
  void_deep: {
    floorVisible: "#0e0c18",
    floorFog: "#0a0912",
    wallVisible: "#1d1838",
    wallFog: "#15122a",
    floorOverlayVisible: "rgba(92, 78, 172, 0.06)",
    floorOverlayFog: "rgba(64, 54, 118, 0.1)",
    wallOverlayVisible: "rgba(88, 84, 170, 0.04)",
    wallOverlayFog: "rgba(58, 58, 110, 0.08)",
  },
  obsidian_reach: {
    floorVisible: "#120709",
    floorFog: "#0c0506",
    wallVisible: "#22101a",
    wallFog: "#180b12",
    floorOverlayVisible: "rgba(160, 50, 40, 0.05)",
    floorOverlayFog: "rgba(90, 30, 30, 0.1)",
    wallOverlayVisible: "rgba(200, 80, 50, 0.04)",
    wallOverlayFog: "rgba(90, 30, 30, 0.08)",
  },
  abyssal_throne: {
    floorVisible: "#0d0a10",
    floorFog: "#09070b",
    wallVisible: "#1a1520",
    wallFog: "#120e16",
    floorOverlayVisible: "rgba(242, 196, 107, 0.03)",
    floorOverlayFog: "rgba(60, 40, 60, 0.1)",
    wallOverlayVisible: "rgba(242, 196, 107, 0.03)",
    wallOverlayFog: "rgba(60, 40, 60, 0.08)",
  },
};

function drawText(ctx, text, x, y, color = "#f0ead6", size = 14) {
  ctx.fillStyle = color;
  ctx.font = `${size}px monospace`;
  ctx.fillText(text, x, y);
}

function formatStatuses(statuses = []) {
  if (!statuses.length) return "none";
  return statuses.map((status) => STATUS_DEFINITIONS[status.id]?.name ?? status.id).join(", ");
}

// Matches each status's pixel icon (see pixelIcons.js).
function getStatusColor(statusId) {
  switch (statusId) {
    case "chilled":
      return "#76c7ff";
    case "poisoned":
      return "#7fd36b";
    case "sundered":
      return "#d9b27a";
    case "weakened":
      return "#e0833f";
    case "hexed":
      return "#b06cff";
    case "arcane_shield":
      return "#7fb6ff";
    default:
      return "#d7a54d";
  }
}

function getTrapColor(trapId) {
  switch (trapId) {
    case "spikes":
      return "#b8c6d8";
    case "darts":
      return "#d7a54d";
    case "fire":
      return "#ff7a47";
    case "curse":
      return "#b48cff";
    case "alarm":
      return "#f0d37a";
    default:
      return "#cf5f5f";
  }
}

function hashPoint(x, y, seed = 0) {
  return Math.abs(((x + 11) * 92821) ^ ((y + 17) * 68917) ^ seed) >>> 0;
}

// Themes whose walls and floors come from an autotiled atlas (the sewer set, recoloured per band;
// see THEME_ATLAS_RAMPS in assets.js). Everything else uses the standard wall sprites.
const ATLAS_THEMES = new Set(["sunken_vault", "void_deep", "obsidian_reach", "abyssal_throne"]);

function getThemeFloorAtlasCoord(theme, x, y) {
  if (!ATLAS_THEMES.has(theme)) return null;
  const sewerFloorTiles = [
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
  ];
  return sewerFloorTiles[(x * 5 + y * 7) % sewerFloorTiles.length];
}

function getThemeWallAtlasCoord(theme, map, x, y, options = {}) {
  if (!ATLAS_THEMES.has(theme)) return null;
  const getTile = (tx, ty) => map[ty]?.[tx] ?? null;
  // Autotiling must be fog-independent so a wall's atlas tile never changes as
  // fog of war is revealed (the standard getWallSprite path works the same way).
  // A wall is only ever revealed if it neighbours a floor tile (line of sight
  // can never reach a wall walled off from every floor); walls with no floor
  // neighbour stay unexplored forever, which is exactly what "void" represents.
  const hasAdjacentFloor = (tx, ty) => {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        if (getTile(tx + dx, ty + dy)?.type === "floor") return true;
      }
    }
    return false;
  };
  const isVisibleWall = (tx, ty) => {
    const tile = getTile(tx, ty);
    if (!tile || tile.type !== "wall") return false;
    return hasAdjacentFloor(tx, ty);
  };
  const isFloor = (tx, ty) => {
    const tile = getTile(tx, ty);
    return Boolean(tile && tile.type === "floor");
  };
  const isVoid = (tx, ty) => {
    const tile = getTile(tx, ty);
    if (!tile) return true;
    if (tile.type === "wall") return !hasAdjacentFloor(tx, ty);
    return false;
  };

  const northWall = isVisibleWall(x, y - 1);
  const southWall = isVisibleWall(x, y + 1);
  const westWall = isVisibleWall(x - 1, y);
  const eastWall = isVisibleWall(x + 1, y);
  const northFloor = isFloor(x, y - 1);
  const southFloor = isFloor(x, y + 1);
  const westFloor = isFloor(x - 1, y);
  const eastFloor = isFloor(x + 1, y);
  const northVoid = isVoid(x, y - 1);
  const southVoid = isVoid(x, y + 1);
  const westVoid = isVoid(x - 1, y);
  const eastVoid = isVoid(x + 1, y);
  // A wall directly below a north-wall corner is a real vertical stub only when
  // it keeps going down (wall/void two rows below). If floor sits two rows down,
  // the wall below is instead the bottom of a 2-tall horizontal wall block, and
  // the corner must stay a plain corner rather than drop a stub column.
  const stubDropsBelow = southWall && !isFloor(x, y + 2);

  if (southFloor) {
    if (westFloor && !eastFloor) {
      if (eastVoid) return [11, 0];
      return eastWall ? [1, 2] : [11, 0];
    }
    if (eastFloor && !westFloor) {
      if (westVoid) return [1, 0];
      return westWall ? [3, 2] : [1, 0];
    }
    if (westVoid && eastVoid) return [9, 0];
    if (westVoid) return [11, 0];
    if (eastVoid) return [1, 0];
    if (!westWall && eastWall) return southWall ? [5, 0] : [1, 0];
    if (!eastWall && westWall) return southWall ? [6, 0] : [11, 0];
    // A free-standing vertical wall (floor on both sides) that terminates here
    // heading south needs the tapered pillar bottom [0,2], not a horizontal E/W
    // wall tile. ([0,3] is the pillar *foot* and splays into a wide horizontal
    // base that still reads as a sideways wall.) Guard on !northFloor so a lone
    // tile with floor on all four sides keeps its old fallback.
    if (westFloor && eastFloor && !northFloor) return [0, 2];
    return [2, 2];
  }

  if (northFloor) {
    // Top corner where a horizontal wall runs off to one side. When a wall also
    // sits directly below, the corner must connect down into it, so use the
    // corner pieces that carry both the side rail and the centre column:
    // [1,0] (connects east + south) on the left, [3,0] (west + south) on the
    // right. This joins a 2-tall wall end to its bottom corner [1,2]/[3,2] and a
    // dropped stub to the vertical wall below. Only a lone tile with void below
    // (no south wall) keeps the side-only end caps [1,3]/[3,3].
    if (westFloor && !eastFloor) {
      if (eastVoid) return [11, 3];
      return eastWall ? (southWall ? [1, 0] : [1, 3]) : (southWall ? [7, 3] : [11, 3]);
    }
    if (eastFloor && !westFloor) {
      if (westVoid) return [8, 3];
      return westWall ? (southWall ? [3, 0] : [3, 3]) : (stubDropsBelow ? [11, 0] : [1, 3]);
    }
    if (westVoid && eastVoid) return [9, 3];
    if (westVoid) return [8, 3];
    if (eastVoid) return [11, 3];
    const southVisible = southWall && !southVoid;
    if (!westWall && eastWall) return southVisible ? [4, 3] : [1, 3];
    if (!eastWall && westWall) return southVisible ? [4, 3] : [11, 3];
    // A free-standing vertical wall (floor on both sides) terminating here
    // heading north needs the pillar top cap [0,0], not a horizontal E/W wall.
    if (westFloor && eastFloor) return [0, 0];
    return [2, 3];
  }

  if (westFloor && eastFloor) {
    if (!northWall && southWall) return [8, 0];
    if (northWall && southWall) {
      const northAlsoColumn = isFloor(x - 1, y - 1) && isFloor(x + 1, y - 1);
      return northAlsoColumn ? [8, 1] : [8, 0];
    }
    if (northWall && !southWall) return [8, 2];
    return [8, 1];
  }

  if (eastFloor && !westFloor) {
    if (northVoid && southVoid) return [8, 1];
    if (northVoid) return [8, 0];
    if (southVoid) return [8, 3];
    // Vertical wall with floor to the east. When a horizontal wall also joins
    // from the west it must connect into it ([3,1], connects west); otherwise
    // it is a plain floor-facing column [8,1].
    return southWall ? (northWall ? (westWall ? [3, 1] : [8, 1]) : [5, 0]) : [1, 0];
  }
  if (westFloor && !eastFloor) {
    if (northVoid && southVoid) return [8, 1];
    if (northVoid) return [11, 0];
    if (southVoid) return [11, 3];
    // Mirror of the eastFloor case: connect into a horizontal wall joining from
    // the east ([1,1], connects east) when one is present.
    return southWall ? (northWall ? (eastWall ? [1, 1] : [8, 1]) : [6, 0]) : [11, 0];
  }

  if (northVoid || southVoid || westVoid || eastVoid) {
    if (northVoid && westVoid) return [8, 0];
    if (northVoid && eastVoid) return [11, 0];
    if (southVoid && westVoid) return [8, 3];
    if (southVoid && eastVoid) return [11, 3];
    if (northVoid) return [9, 0];
    if (southVoid) return [9, 3];
    // Void on one side only: the other three sides are walls, so this is a
    // vertical wall with a horizontal wall branching off. Use the T-junction
    // pieces that carry the horizontal rail into the wall ([1,1] connects east,
    // [3,1] connects west) instead of the plain column [8,1]/[11,1], which would
    // leave the branch disconnected. Void on both sides is a free-standing
    // vertical wall and keeps the centred column [8,1].
    if (westVoid && eastVoid) return [8, 1];
    if (westVoid) return [1, 1];
    if (eastVoid) return [3, 1];
  }

  const seFloor = isFloor(x + 1, y + 1);
  const swFloor = isFloor(x - 1, y + 1);
  const neFloor = isFloor(x + 1, y - 1);
  const nwFloor = isFloor(x - 1, y - 1);
  if (!(seFloor || swFloor || neFloor || nwFloor)) return null;

  return [2, 0];
}

// A green-flame torch on a south-facing wall (a wall with floor below it), spaced along a diagonal
// pattern so torches never bunch up.
function getSewerWallFeature(map, x, y, seed) {
  const tile = map[y]?.[x];
  const below = map[y + 1]?.[x];
  if (!tile || tile.type !== "wall" || !below || below.type !== "floor" || below.stairs) return null;
  const roll = hashPoint(x, y, seed ^ 0x3c71) % 100;
  if ((x + y * 3) % 5 === 0 && roll < 55) return "torch";
  return null;
}

// A cobweb in a room corner: a floor tile with walls to its north and to one side.
function getSewerCobweb(map, x, y, seed) {
  const isWall = (tx, ty) => map[ty]?.[tx]?.type === "wall";
  if (!isWall(x, y - 1)) return null;
  if (hashPoint(x, y, seed ^ 0x77e1) % 100 >= 35) return null;
  if (isWall(x - 1, y)) return "left";
  if (isWall(x + 1, y)) return "right";
  return null;
}

function getSewerFloorDecor(x, y, seed) {
  const roll = hashPoint(x, y, seed ^ 0x2d45) % 1000;
  let threshold = 0;
  for (const decor of SEWER_FLOOR_DECOR) {
    threshold += decor.chance;
    if (roll < threshold) return { kind: decor.kind, coords: decor.coords, hash: hashPoint(x, y, seed) };
  }
  return null;
}

// Which endgame floor detail (if any) sits on this tile. Tiles holding stairs, chests, items, vendors
// or shrines stay clear so the detail never competes with something you can interact with.
function getFloorDetail(theme, tile, x, y, seed) {
  const styles = FLOOR_DETAILS[theme];
  if (!styles || tile.stairs || tile.chestId || tile.vendor || tile.shrineId || tile.itemIds?.length) return null;
  const roll = hashPoint(x, y, seed ^ 0x5bd1) % 1000;
  let threshold = 0;
  for (const style of styles) {
    threshold += style.chance;
    if (roll < threshold) return { kind: style.kind, hash: hashPoint(x, y, seed ^ 0x1f3a) };
  }
  return null;
}

function getSewerDecorAtlasCoord(kind, x, y) {
  const variants = {
    drain: [[0, 4], [1, 4], [2, 4]],
    // These cells are cracked stone; the neighbouring cells in that row are empty.
    puddle: [[3, 4], [4, 4]],
  };
  const pool = variants[kind];
  if (!pool?.length) return null;
  return pool[(x * 5 + y * 3) % pool.length];
}

function getWallPropPath(manifest, theme, map, x, y) {
  const tile = map[y]?.[x];
  const below = map[y + 1]?.[x];
  if (!tile || tile.type !== "wall" || !below || below.type !== "floor") return null;
  const roll = hashPoint(x, y, theme.length) % 100;
  switch (theme) {
    case "crypt":
      return null;
    case "ember_halls":
      return null;
    case "fungal_depths":
      if (roll < 8) return manifest.props.wallGoo;
      return null;
    case "sunken_vault":
      return null;
    case "necropolis":
      if (roll < 6) return manifest.props.columnWall;
      return null;
    case "stitchworks":
      if (roll < 6) return manifest.props.shrineRedMid;
      return null;
    case "void_deep":
      return null;
    default:
      return null;
  }
}

function getFloorPropPath(manifest, theme, map, x, y, options = {}) {
  const { floorNumber = 0, inBossRoom = false } = options;
  const tile = map[y]?.[x];
  if (!tile || tile.type !== "floor" || tile.stairs || tile.vendor || tile.shrineId || tile.chestId || tile.itemIds?.length || tile.occupant) {
    return null;
  }
  const roll = hashPoint(x, y, theme.length + floorNumber * 13) % 100;
  if (theme === "sunken_vault") {
    return null;
  }
  if (floorNumber === 20 && inBossRoom) {
    return null;
  }
  if (theme === "fungal_depths") {
    if (tile.hole) return manifest.props.floorHole;
    if (roll < 4) return manifest.props.floorGoo;
  }
  return null;
}

function getFloorDecorSpec(manifest, currentFloor, x, y, options = {}) {
  const { floorNumber = 0, inBossRoom = false, roomType = "normal" } = options;
  const tile = currentFloor.map[y]?.[x];
  if (!tile || tile.type !== "floor" || tile.stairs || tile.vendor || tile.shrineId || tile.chestId || tile.itemIds?.length || tile.occupant) {
    return null;
  }
  const roll = hashPoint(x, y, floorNumber * 31 + roomType.length) % 100;
  if (floorNumber === 20 && inBossRoom) {
    if (roll < 8) return { atlas: manifest.themeAtlases.sunkenVaultFloor, coord: getSewerDecorAtlasCoord("puddle", x, y) };
  }
  return null;
}

function renderStatusBadges(statuses = []) {
  if (!statuses.length) return `<span class="status-badge muted-badge">None</span>`;
  return statuses.map((status) => {
    const def = STATUS_DEFINITIONS[status.id];
    const tooltip = [def?.name ?? status.id, def?.description ?? "No description available.", status.turns ? `Turns remaining: ${status.turns}` : ""]
      .filter(Boolean)
      .join("&#10;");
    const iconUrl = getStatusIconUrl(status.id);
    const icon = iconUrl
      ? `<img class="status-icon" src="${iconUrl}" alt="">`
      : `<span class="status-icon status-icon-letter">${def?.icon ?? "?"}</span>`;
    return `<span class="status-badge" style="--badge-color:${getStatusColor(status.id)}" data-tooltip="${tooltip}">${icon}${def?.name ?? status.id}${status.turns ? `<span class="status-turns">${status.turns}</span>` : ""}</span>`;
  }).join("");
}

function renderOptionalStatusBadges(statuses = []) {
  if (!statuses.length) return "";
  return `<div class="status-badge-row">${renderStatusBadges(statuses)}</div>`;
}

function formatEntryTooltip(entryId) {
  if (SPELLS[entryId]) {
    const spell = SPELLS[entryId];
    const parts = [spell.name, spell.description];
    if (typeof spell.cost === "number") parts.push(`Cost: ${spell.cost} mana`);
    if (typeof spell.range === "number") parts.push(`Range: ${spell.range === 0 ? "Self" : spell.range}`);
    if (spell.damage) parts.push(`Damage: ${spell.damage[0]}-${spell.damage[1]}`);
    return parts.join("\n");
  }

  if (ITEMS[entryId]) {
    const item = ITEMS[entryId];
    const parts = [item.name];
    if (item.effect?.type === "heal") parts.push(`Restores ${item.effect.value} HP`);
    else if (item.effect?.type === "mana") parts.push(`Restores ${item.effect.value} mana`);
    else if (item.effect?.type === "escape") parts.push("Teleports you to the floor's start room");
    else if (item.category === "tome" && item.spellId) parts.push(`Teaches ${SPELLS[item.spellId]?.name ?? item.spellId}`);
    else if (item.description) parts.push(item.description);
    return parts.join("\n");
  }

  return "";
}

function escapeTooltip(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "&#10;");
}

function getProjectileAppearance(projectile) {
  switch (projectile.kind) {
    case "magic_missile":
      return { color: "#8bc6ff", trail: "#d6eeff", radius: 0.16 };
    case "frost_shard":
      return { color: "#8ff3ff", trail: "#d7fbff", radius: 0.18 };
    case "chain_bolt":
      return { color: "#ffd86a", trail: "#fff2b6", radius: 0.17 };
    case "ice_shatter":
      return { color: "#b9ecff", trail: "#eefcff", radius: 0.18 };
    case "frailty_hex":
      return { color: "#c58cff", trail: "#edd6ff", radius: 0.18 };
    case "arcane_burst":
      return { color: "#c78cff", trail: "#f0d2ff", radius: 0.2 };
    case "shadow_bolt":
      return { color: "#8e7cff", trail: "#d4c8ff", radius: 0.16 };
    case "hexfire":
      return { color: "#ff7b9c", trail: "#ffd0da", radius: 0.18 };
    case "cinder_hex":
      return { color: "#ff9b54", trail: "#ffe1b8", radius: 0.17 };
    case "abyssal_bolt":
      return { color: "#ff5f86", trail: "#ffd1dc", radius: 0.2 };
    case "arrow":
      return { color: "#d4a853", trail: "#8b6914", radius: 0.1 };
    default:
      return { color: "#d7a54d", trail: "#fff1c2", radius: 0.16 };
  }
}

export class Renderer {
  constructor(game) {
    this.game = game;
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.logElement = document.getElementById("combat-log");
    this.overlay = document.getElementById("overlay");
    this.overlayTitle = document.getElementById("overlay-title");
    this.overlayContent = document.getElementById("overlay-content");
    this.npcDialog = document.getElementById("npc-dialog");
    this.npcDialogSpeaker = document.getElementById("npc-dialog-speaker");
    this.npcDialogText = document.getElementById("npc-dialog-text");
    this.criticalFlash = document.getElementById("critical-flash");
    this.assets = null;
    this.lastOverlaySignature = null;
    this.wasCriticalHp = false;
    this.projectiles = [];
    this.damagePopups = [];
    this.camera = null;
    this.minimapCanvas = document.createElement("canvas");
    this.minimapKey = null;
    // Set from the player's settings by main.js.
    this.showMinimap = true;
    // Where keyboard focus should land the next time the overlay is redrawn (set by main.js).
    this.pendingOverlayFocus = null;
    this.logFilter = "all";
    this.logKey = null;
    // Cosmetic torch lighting (a setting, applied by main.js).
    this.lighting = true;
    // Map tile under the mouse (set by main.js) and the geometry of the last drawn frame.
    this.hoverTile = null;
    this.mapView = null;
    // Drifting motes for the current floor's band (see MOTE_STYLES).
    this.motes = [];
  }

  // Keeps the canvas backing store equal to its displayed size (in device pixels) so every
  // source pixel maps to a whole number of screen pixels.
  syncCanvasSize() {
    const displayWidth = this.canvas.clientWidth;
    if (!displayWidth) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(displayWidth * dpr);
    const height = Math.round(width * CANVAS_ASPECT);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  // Returns the camera centre in tile coordinates, easing toward the player and clamped to the map.
  updateCamera(currentFloor, player, tileSize) {
    const viewWide = this.canvas.width / tileSize;
    const viewTall = this.canvas.height / tileSize;
    const axisTarget = (playerPos, mapSize, viewSize) => (mapSize <= viewSize
      ? mapSize / 2
      : clamp(playerPos + 0.5, viewSize / 2, mapSize - viewSize / 2));
    const target = {
      x: axisTarget(player.x, currentFloor.width, viewWide),
      y: axisTarget(player.y, currentFloor.height, viewTall),
    };
    const now = performance.now();
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!this.camera || this.camera.floor !== currentFloor || this.camera.tileSize !== tileSize || reduceMotion) {
      this.camera = { ...target, floor: currentFloor, tileSize, time: now };
      return this.camera;
    }
    const ease = 1 - Math.exp(-(now - this.camera.time) / CAMERA_FOLLOW_MS);
    this.camera.x += (target.x - this.camera.x) * ease;
    this.camera.y += (target.y - this.camera.y) * ease;
    if (Math.abs(target.x - this.camera.x) < 0.01) this.camera.x = target.x;
    if (Math.abs(target.y - this.camera.y) < 0.01) this.camera.y = target.y;
    this.camera.time = now;
    return this.camera;
  }

  setAssets(assets) {
    this.assets = assets;
  }

  render() {
    const { state } = this.game;
    if (state.mode !== "in_game") return;

    this.renderMap();
    this.renderHud();
    this.renderLog();
    this.renderToasts();
    this.renderBossUi();
    this.renderOverlay();
    this.animateOverlayActors();
    this.renderNpcDialog();
  }

  // Overlay portraits marked data-animate-actor play the actor's idle frames, like on the map.
  animateOverlayActors() {
    if (!this.assets || this.overlay.classList.contains("hidden")) return;
    const frame = Math.floor(performance.now() / 220);
    for (const image of this.overlayContent.querySelectorAll("img[data-animate-actor]")) {
      const path = getActorSpriteFrame(this.assets.manifest, image.dataset.animateActor, frame);
      if (path && image.getAttribute("src") !== path) image.setAttribute("src", path);
    }
  }

  renderMap() {
    const { ctx } = this;
    const { currentFloor, player, floorNumber, runSeed } = this.game.state.run;
    const floorTileSeed = ((runSeed ?? 0) + floorNumber * 7919) | 0;
    const floorTheme = FLOOR_THEMES[currentFloor.theme] ?? FLOOR_THEMES.crypt;
    const bossRoom = currentFloor.rooms?.find((room) => room.type === "boss") ?? null;
    const inBossRoom = (x, y) => bossRoom
      && x >= bossRoom.x
      && x < bossRoom.x + bossRoom.width
      && y >= bossRoom.y
      && y < bossRoom.y + bossRoom.height;
    const getRoomTypeAt = (x, y) => currentFloor.rooms?.find((room) =>
      x >= room.x
      && x < room.x + room.width
      && y >= room.y
      && y < room.y + room.height
    )?.type ?? "normal";
    this.syncCanvasSize();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const animationFrame = Math.floor(performance.now() / 220);
    const minTilesWide = this.canvas.clientWidth < NARROW_CANVAS_CSS_PX ? MIN_VIEW_TILES_WIDE_NARROW : MIN_VIEW_TILES_WIDE;
    const pixelScale = Math.max(1, Math.floor(this.canvas.width / (SOURCE_TILE_PX * minTilesWide)));
    const tileSize = SOURCE_TILE_PX * pixelScale;
    const camera = this.updateCamera(currentFloor, player, tileSize);
    const offsetX = Math.round(this.canvas.width / 2 - camera.x * tileSize);
    const offsetY = Math.round(this.canvas.height / 2 - camera.y * tileSize);
    // Only walk tiles on screen; extra rows below catch tall sprites whose feet are just off-screen.
    const firstX = Math.max(0, Math.floor(-offsetX / tileSize) - 1);
    const lastX = Math.min(currentFloor.width - 1, Math.ceil((this.canvas.width - offsetX) / tileSize) + 1);
    const firstY = Math.max(0, Math.floor(-offsetY / tileSize) - 1);
    const lastY = Math.min(currentFloor.height - 1, Math.ceil((this.canvas.height - offsetY) / tileSize) + 3);

    // Rare floor loot gets sparkles drawn after the lighting, so they stay bright.
    const sparkleTiles = [];
    // Floor details that glow (void rifts, ember cracks, gilt glints) get a second pass after the lighting.
    const glowingDetails = [];
    // Sewer props and wall torches, drawn after all tiles (top row first); torches also light the map.
    const sewerSheet = currentFloor.theme === "sunken_vault" ? this.assets?.images[this.assets.manifest.themeAtlases.sewerItems] : null;
    const sewerFloorAtlas = sewerSheet ? this.assets.images[this.assets.manifest.themeAtlases.sunkenVaultFloor] : null;
    const sewerStanding = [];
    const torchLights = [];
    const chestsById = new Map((currentFloor.chests ?? []).map((chest) => [chest.id, chest]));
    const bossAlive = currentFloor.enemies.some((enemy) => ENEMIES[enemy.templateId]?.behavior === "boss");
    for (let y = firstY; y <= lastY; y += 1) {
      for (let x = firstX; x <= lastX; x += 1) {
        const tile = currentFloor.map[y][x];
        const px = offsetX + x * tileSize;
        const py = offsetY + y * tileSize;

        if (!tile.explored && !tile.visible) {
          ctx.fillStyle = "#05070a";
          ctx.fillRect(px, py, tileSize, tileSize);
          continue;
        }

        const floorAtlasCoord = getThemeFloorAtlasCoord(currentFloor.theme, x, y);
        const atlasSet = this.assets?.manifest.themeAtlasSets?.[currentFloor.theme];
        const floorAtlas = floorAtlasCoord && atlasSet ? this.assets.images[atlasSet.floor] : null;
        const floorSprite = floorAtlas ? null : this.assets?.images[getFloorSprite(this.assets.manifest, x, y, floorTileSeed)];
        const wallAtlasCoord = getThemeWallAtlasCoord(currentFloor.theme, currentFloor.map, x, y, { useExploredMask: true });
        const wallAtlas = wallAtlasCoord && atlasSet ? this.assets.images[atlasSet.walls] : null;
        const wallSpritePath = this.assets
          ? getWallSprite(this.assets.manifest, currentFloor.map, x, y)
          : null;
        const useThemeWalls = ATLAS_THEMES.has(currentFloor.theme);
        const wallSprite = wallAtlas ? null : (!useThemeWalls && wallSpritePath) ? this.assets?.images[wallSpritePath] : null;
        // Partly transparent wall pieces (caps, side edges, outer corners) sit over black void, so the
        // coloured wall backdrop would show through them as a solid block.
        const skipWallBackdrop = (tile.type === "wall" && wallAtlas)
          || (tile.type === "wall" && !wallAtlas && wallSpritePath && this.assets?.manifest.transparentWallSprites?.has(wallSpritePath));
        const wallPropPath = this.assets ? getWallPropPath(this.assets.manifest, currentFloor.theme, currentFloor.map, x, y) : null;
        const wallProp = wallPropPath ? this.assets?.images[wallPropPath] : null;
        const roomType = getRoomTypeAt(x, y);
        const floorPropPath = this.assets
          ? getFloorPropPath(this.assets.manifest, currentFloor.theme, currentFloor.map, x, y, { floorNumber, inBossRoom: inBossRoom(x, y) })
          : null;
        const floorProp = floorPropPath ? this.assets?.images[floorPropPath] : null;
        const floorDecorSpec = this.assets
          ? getFloorDecorSpec(this.assets.manifest, currentFloor, x, y, { floorNumber, inBossRoom: inBossRoom(x, y), roomType })
          : null;
        const floorDecorAtlas = floorDecorSpec?.atlas ? this.assets?.images[floorDecorSpec.atlas] : null;
        if (!skipWallBackdrop) {
          ctx.fillStyle = tile.type === "wall"
            ? (tile.visible ? floorTheme.wallVisible : floorTheme.wallFog)
            : (tile.visible ? floorTheme.floorVisible : floorTheme.floorFog);
          ctx.fillRect(px, py, tileSize, tileSize);
        }
        if (tile.type === "floor" && floorAtlas && floorAtlasCoord) {
          ctx.save();
          if (!tile.visible) {
            ctx.globalAlpha = 0.32;
          }
          this.drawAtlasTile(floorAtlas, floorAtlasCoord, px, py, tileSize);
          ctx.restore();
          ctx.save();
          ctx.fillStyle = tile.visible ? floorTheme.floorOverlayVisible : floorTheme.floorOverlayFog;
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.restore();
        } else if (tile.type === "floor" && floorSprite) {
          ctx.save();
          if (!tile.visible) {
            ctx.globalAlpha = 0.32;
          }
          ctx.drawImage(floorSprite, px, py, tileSize, tileSize);
          ctx.restore();
          ctx.save();
          ctx.fillStyle = tile.visible ? floorTheme.floorOverlayVisible : floorTheme.floorOverlayFog;
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.restore();
        } else if (tile.type === "wall" && wallAtlas && wallAtlasCoord) {
          ctx.save();
          if (!tile.visible) {
            ctx.globalAlpha = 0.38;
          }
          this.drawAtlasTile(wallAtlas, wallAtlasCoord, px, py, tileSize);
          ctx.restore();
          ctx.save();
          ctx.fillStyle = tile.visible ? floorTheme.wallOverlayVisible : floorTheme.wallOverlayFog;
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.restore();
        } else if (tile.type === "wall" && wallSprite) {
          ctx.save();
          if (!tile.visible) {
            ctx.globalAlpha = 0.38;
          }
          ctx.drawImage(wallSprite, px, py, tileSize, tileSize);
          ctx.restore();
          ctx.save();
          ctx.fillStyle = tile.visible ? floorTheme.wallOverlayVisible : floorTheme.wallOverlayFog;
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.restore();
          if (tile.visible && wallProp) {
            this.drawSprite(wallProp, px, py, tileSize, tileSize, 1.15);
          }
        }

        if ((floorNumber === 10 || floorNumber === 20) && tile.type === "floor" && inBossRoom(x, y)) {
          ctx.save();
          ctx.fillStyle = floorNumber === 10
            ? (tile.visible ? "rgba(88, 24, 36, 0.26)" : "rgba(52, 16, 24, 0.18)")
            : (tile.visible ? "rgba(52, 76, 64, 0.22)" : "rgba(24, 40, 32, 0.16)");
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.restore();
          if (tile.visible && tile.graveCircle) {
            const cx = px + tileSize / 2;
            const cy = py + tileSize / 2;
            const radius = tileSize * 0.26;
            ctx.save();
            ctx.strokeStyle = "rgba(210, 110, 140, 0.92)";
            ctx.lineWidth = Math.max(1, Math.floor(tileSize * 0.06));
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 0.42, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = "rgba(245, 196, 124, 0.95)";
            ctx.fillRect(Math.floor(cx - tileSize * 0.05), Math.floor(cy - tileSize * 0.05), Math.max(2, Math.floor(tileSize * 0.1)), Math.max(2, Math.floor(tileSize * 0.1)));
            ctx.restore();
          }
          if (tile.visible && tile.patchMarker) {
            const cx = px + tileSize / 2;
            const cy = py + tileSize / 2;
            ctx.save();
            ctx.strokeStyle = "rgba(146, 182, 132, 0.92)";
            ctx.lineWidth = Math.max(1, Math.floor(tileSize * 0.06));
            ctx.strokeRect(
              Math.floor(cx - tileSize * 0.18),
              Math.floor(cy - tileSize * 0.18),
              Math.floor(tileSize * 0.36),
              Math.floor(tileSize * 0.36)
            );
            ctx.strokeStyle = "rgba(198, 222, 154, 0.92)";
            ctx.beginPath();
            ctx.moveTo(cx - tileSize * 0.16, cy - tileSize * 0.16);
            ctx.lineTo(cx + tileSize * 0.16, cy + tileSize * 0.16);
            ctx.moveTo(cx + tileSize * 0.16, cy - tileSize * 0.16);
            ctx.lineTo(cx - tileSize * 0.16, cy + tileSize * 0.16);
            ctx.stroke();
            ctx.restore();
          }
        }

        if (sewerSheet) this.collectSewerDecor(currentFloor, tile, x, y, px, py, tileSize, floorTileSeed, sewerFloorAtlas, sewerStanding, torchLights, glowingDetails);

        const floorDetail = tile.type === "floor" ? getFloorDetail(currentFloor.theme, tile, x, y, floorTileSeed) : null;
        if (floorDetail) {
          this.drawFloorDetail(floorDetail, px, py, tileSize, tile.visible);
          if (tile.visible) glowingDetails.push({ detail: floorDetail, px, py });
        }

        if (tile.visible && floorProp) {
          const scale = floorPropPath === this.assets.manifest.props.floorColumn ? 1.1 : 1;
          this.drawSprite(floorProp, px, py, tileSize, tileSize, scale);
        }

        if (tile.visible && floorDecorAtlas && floorDecorSpec?.coord) {
          this.drawAtlasTile(floorDecorAtlas, floorDecorSpec.coord, px, py, tileSize);
        }

        if (tile.visible) {
          const stairsSprite = this.assets?.images[currentFloor.theme === "sunken_vault" ? this.assets.manifest.ladder : this.assets.manifest.stairs];
          const vendorSpritePath = this.assets ? getActorSpriteFrame(this.assets.manifest, getVendorSpriteId(this.assets.manifest, currentFloor.vendor), animationFrame) : null;
          const vendorSprite = vendorSpritePath ? this.assets?.images[vendorSpritePath] : null;
          const sage = currentFloor.sage;
          const sageFade = sage?.vanished ? 1 - (Date.now() - (sage.vanishedAt ?? 0)) / SAGE_FADE_MS : 1;
          const sageSpritePath = (sage && sageFade > 0 && sage.x === x && sage.y === y && this.assets)
            ? getActorSpriteFrame(this.assets.manifest, sage.actorId ?? "sage", animationFrame)
            : null;
          const sageSprite = sageSpritePath ? this.assets?.images[sageSpritePath] : null;
          const chest = tile.chestId ? chestsById.get(tile.chestId) : null;
          const chestPath = tile.chestId ? (this.assets?.manifest.chestVariants?.[chest?.variant] ?? this.assets?.manifest.chestClosed) : null;
          const chestSprite = chestPath ? this.assets?.images[chestPath] : null;
          const pickupSpritePath = tile.itemIds.length ? getItemSprite(this.assets?.manifest, getPickupSpriteId(tile.itemIds)) : null;
          const pickupSprite = pickupSpritePath ? this.assets?.images[pickupSpritePath] : null;
          if (tile.stairs) {
            ctx.save();
            ctx.fillStyle = currentFloor.theme === "sunken_vault"
              ? "rgba(74, 124, 102, 0.22)"
              : floorNumber === 20
                ? "rgba(88, 122, 96, 0.2)"
                : "rgba(137, 209, 133, 0.16)";
            ctx.fillRect(
              px + Math.floor(tileSize * 0.12),
              py + Math.floor(tileSize * 0.12),
              Math.floor(tileSize * 0.76),
              Math.floor(tileSize * 0.76)
            );
            ctx.restore();
          }
          if (tile.stairs && stairsSprite) ctx.drawImage(stairsSprite, px, py, tileSize, tileSize);
          if (tile.stairs && bossAlive) this.drawSealedStairs(px, py, tileSize);
          if (tile.shrineId) this.drawShrineStructure(currentFloor.theme, tile, px, py, tileSize);
          if (tile.vendor && vendorSprite) this.drawActor(vendorSprite, px, py, tileSize);
          if (sageSprite && sageFade >= 1) this.drawActor(sageSprite, px, py, tileSize);
          else if (sageSprite) this.drawFadingActor(sageSprite, px, py, tileSize, sageFade);
          const chestAura = chest?.variant ? CHEST_AURAS[chest.variant] : currentFloor.theme === "sunken_vault" ? "rgba(58, 108, 98, 0.22)" : null;
          if (tile.chestId && chestAura) {
            ctx.save();
            ctx.fillStyle = chestAura;
            ctx.beginPath();
            ctx.arc(px + tileSize / 2, py + tileSize * 0.72, tileSize * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          if (tile.chestId && chestSprite) this.drawSprite(chestSprite, px, py, tileSize, tileSize, 1.2);
          if (tile.itemIds.length && pickupSprite) {
            const lootRarity = this.getTileLootRarity(tile.itemIds);
            if (lootRarity !== "common") this.drawLootGlow(px, py, tileSize, lootRarity);
            this.drawSprite(pickupSprite, px, py, tileSize, tileSize, 1.1);
            if (RARITY_RANK[lootRarity] >= RARITY_RANK.rare) sparkleTiles.push({ px, py, rarity: lootRarity });
          }
        }

        const trap = this.game.getTrapAt(x, y);
        if (tile.visible && trap?.revealed) {
          const trapSpritePath = getTrapSprite(this.assets?.manifest, getTrapPickupSpriteId(trap));
          const trapSprite = trapSpritePath ? this.assets?.images[trapSpritePath] : null;
          ctx.save();
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = getTrapColor(trap.templateId);
          ctx.fillRect(px + Math.floor(tileSize * 0.12), py + Math.floor(tileSize * 0.12), Math.floor(tileSize * 0.76), Math.floor(tileSize * 0.76));
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = getTrapColor(trap.templateId);
          ctx.lineWidth = Math.max(1, Math.floor(tileSize * 0.06));
          ctx.strokeRect(px + Math.floor(tileSize * 0.14), py + Math.floor(tileSize * 0.14), Math.floor(tileSize * 0.72), Math.floor(tileSize * 0.72));
          ctx.restore();
          if (trapSprite) this.drawSprite(trapSprite, px, py, tileSize, tileSize, 1.1);
          else drawText(ctx, TRAPS[trap.templateId].glyph, px + Math.floor(tileSize * 0.24), py + Math.floor(tileSize * 0.72), COLORS.trap, Math.max(11, tileSize - 5));
        }
      }
    }

    for (const standing of sewerStanding.sort((a, b) => a.y - b.y)) {
      this.drawSewerSprite(sewerSheet, standing, tileSize);
    }

    for (const enemy of currentFloor.enemies) {
      if (enemy.disguised) continue;
      const tile = currentFloor.map[enemy.y][enemy.x];
      if (!tile.visible) continue;
      const spritePath = this.assets ? getActorSpriteFrame(this.assets.manifest, getEnemySpriteId(this.assets.manifest, enemy), animationFrame) : null;
      const sprite = spritePath ? this.assets?.images[spritePath] : null;
      if (sprite) {
        this.drawActor(sprite, offsetX + enemy.x * tileSize, offsetY + enemy.y * tileSize, tileSize, ACTOR_SCALES[enemy.templateId] ?? 1);
        this.drawStatusPips(offsetX + enemy.x * tileSize, offsetY + enemy.y * tileSize, tileSize, enemy.statuses);
      } else {
        const template = ENEMIES[enemy.templateId];
        drawText(
          ctx,
          template.glyph,
          offsetX + enemy.x * tileSize + Math.floor(tileSize * 0.28),
          offsetY + enemy.y * tileSize + Math.floor(tileSize * 0.72),
          template.behavior === "boss" ? COLORS.boss : enemy.elite ? COLORS.elite : COLORS.enemy,
          Math.max(11, tileSize - 5)
        );
      }
    }

    const playerSpritePath = this.assets ? getActorSpriteFrame(this.assets.manifest, player.classId, animationFrame) : null;
    const playerSprite = playerSpritePath ? this.assets?.images[playerSpritePath] : null;
    if (playerSprite) {
      this.drawActor(playerSprite, offsetX + player.x * tileSize, offsetY + player.y * tileSize, tileSize);
      this.drawStatusPips(offsetX + player.x * tileSize, offsetY + player.y * tileSize, tileSize, player.statuses);
    } else {
      drawText(
        ctx,
        "@",
        offsetX + player.x * tileSize + Math.floor(tileSize * 0.28),
        offsetY + player.y * tileSize + Math.floor(tileSize * 0.72),
        COLORS.player,
        Math.max(11, tileSize - 5)
      );
    }

    if (this.lighting) this.drawLighting(currentFloor, player, offsetX, offsetY, tileSize, torchLights);
    for (const sparkle of sparkleTiles) this.drawLootSparkles(sparkle.px, sparkle.py, tileSize, sparkle.rarity);
    for (const glowing of glowingDetails) this.drawFloorDetailGlow(glowing.detail, glowing.px, glowing.py, tileSize);
    this.updateAndDrawMotes(currentFloor, offsetX, offsetY, tileSize);
    this.drawTelegraphs(currentFloor, player, offsetX, offsetY, tileSize);

    // Health bars go on top of every actor so a taller sprite standing below can't hide them.
    for (const enemy of currentFloor.enemies) {
      if (enemy.disguised || !currentFloor.map[enemy.y][enemy.x].visible) continue;
      this.drawHealthBar(offsetX + enemy.x * tileSize, offsetY + enemy.y * tileSize, tileSize, enemy);
    }

    this.mapView = { offsetX, offsetY, tileSize, floor: currentFloor };
    this.drawHoverOutline(currentFloor, offsetX, offsetY, tileSize);
    this.renderProjectiles(tileSize, offsetX, offsetY);
    this.renderDamagePopups(tileSize, offsetX, offsetY);
    this.minimapRect = null;
    if (this.showMinimap) this.renderMinimap(tileSize, offsetX, offsetY);
  }

  // Redraws the 1px-per-tile minimap only when the turn, floor, or player position changes.
  buildMinimap(run) {
    const { currentFloor, player } = run;
    const key = `${run.floorNumber}|${run.turn}|${player.x},${player.y}|${currentFloor.enemies.length}`;
    if (this.minimapKey === key && this.minimapFloor === currentFloor) return;
    this.minimapKey = key;
    this.minimapFloor = currentFloor;
    const mini = this.minimapCanvas;
    mini.width = currentFloor.width;
    mini.height = currentFloor.height;
    const mctx = mini.getContext("2d");
    mctx.clearRect(0, 0, mini.width, mini.height);
    const plot = (x, y, color) => {
      mctx.fillStyle = color;
      mctx.fillRect(x, y, 1, 1);
    };
    for (let y = 0; y < currentFloor.height; y += 1) {
      for (let x = 0; x < currentFloor.width; x += 1) {
        const tile = currentFloor.map[y][x];
        if (!tile.explored && !tile.visible) continue;
        if (tile.type === "wall") plot(x, y, MINIMAP_COLORS.wall);
        else if (tile.stairs) plot(x, y, MINIMAP_COLORS.stairs);
        else if (tile.vendor) plot(x, y, MINIMAP_COLORS.vendor);
        else if (tile.shrineId) plot(x, y, MINIMAP_COLORS.shrine);
        else if (tile.chestId) plot(x, y, MINIMAP_COLORS.chest);
        else plot(x, y, tile.visible ? MINIMAP_COLORS.floorVisible : MINIMAP_COLORS.floor);
      }
    }
    for (const enemy of currentFloor.enemies) {
      if (enemy.disguised || !currentFloor.map[enemy.y]?.[enemy.x]?.visible) continue;
      plot(enemy.x, enemy.y, ENEMIES[enemy.templateId]?.behavior === "boss" ? MINIMAP_COLORS.boss : MINIMAP_COLORS.enemy);
    }
    plot(player.x, player.y, MINIMAP_COLORS.player);
  }

  renderMinimap(tileSize, offsetX, offsetY) {
    const { run } = this.game.state;
    const { currentFloor } = run;
    this.buildMinimap(run);
    const { ctx } = this;
    const maxWidth = this.canvas.width * 0.24;
    const maxHeight = this.canvas.height * 0.28;
    const cell = Math.max(1, Math.floor(Math.min(maxWidth / currentFloor.width, maxHeight / currentFloor.height)));
    const width = currentFloor.width * cell;
    const height = currentFloor.height * cell;
    const pad = Math.max(4, Math.round(tileSize / 8));
    const x = this.canvas.width - width - pad * 3;
    const y = pad * 2;
    this.minimapRect = { x: x - pad, y: y - pad, width: width + pad * 2, height: height + pad * 2 };
    ctx.save();
    ctx.fillStyle = MINIMAP_COLORS.panel;
    ctx.fillRect(x - pad, y - pad, width + pad * 2, height + pad * 2);
    ctx.strokeStyle = MINIMAP_COLORS.border;
    ctx.lineWidth = Math.max(1, Math.round(tileSize / 32));
    ctx.strokeRect(x - pad + 0.5, y - pad + 0.5, width + pad * 2 - 1, height + pad * 2 - 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.minimapCanvas, x, y, width, height);
    // Outline of what the main view currently shows.
    const viewX = clamp(-offsetX / tileSize, 0, currentFloor.width);
    const viewY = clamp(-offsetY / tileSize, 0, currentFloor.height);
    const viewRight = clamp((this.canvas.width - offsetX) / tileSize, 0, currentFloor.width);
    const viewBottom = clamp((this.canvas.height - offsetY) / tileSize, 0, currentFloor.height);
    ctx.strokeStyle = MINIMAP_COLORS.viewport;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.round(x + viewX * cell) + 0.5,
      Math.round(y + viewY * cell) + 0.5,
      Math.max(1, Math.round((viewRight - viewX) * cell) - 1),
      Math.max(1, Math.round((viewBottom - viewY) * cell) - 1)
    );
    ctx.restore();
  }

  drawSprite(image, x, y, tileSize, baseTileSize, heightMultiplier = 1) {
    const width = tileSize;
    const height = Math.max(tileSize, Math.floor(tileSize * heightMultiplier));
    const offsetY = y + tileSize - height;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(image, x, offsetY, width, height);
  }

  // Draws an actor bottom-aligned and horizontally centred on its tile, keeping the sprite's aspect ratio.
  drawActor(image, x, y, tileSize, scale = 1) {
    const width = Math.round((image.naturalWidth || image.width) / 16 * tileSize * scale);
    const height = Math.round((image.naturalHeight || image.height) / 16 * tileSize * scale);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(image, x + Math.round((tileSize - width) / 2), y + tileSize - height, width, height);
  }

  drawAtlasTile(image, coord, x, y, tileSize, sourceTileSize = 16) {
    if (!image || !coord) return;
    const [tileX, tileY] = coord;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(
      image,
      tileX * sourceTileSize,
      tileY * sourceTileSize,
      sourceTileSize,
      sourceTileSize,
      x,
      y,
      tileSize,
      tileSize
    );
  }

  drawShrineStructure(theme, tile, x, y, tileSize) {
    const useRed = theme === "ember_halls" || theme === "stitchworks" || theme === "necropolis";
    const top = this.assets?.images[useRed ? this.assets.manifest.props.shrineRedTop : this.assets.manifest.props.shrineBlueTop];
    const mid = this.assets?.images[useRed ? this.assets.manifest.props.shrineRedMid : this.assets.manifest.props.shrineBlueMid];
    const basin = this.assets?.images[useRed ? this.assets.manifest.props.shrineRedBasin : this.assets.manifest.props.shrineBlueBasin];
    this.ctx.save();
    this.ctx.fillStyle = useRed ? "rgba(184, 88, 68, 0.22)" : "rgba(88, 154, 196, 0.2)";
    this.ctx.beginPath();
    this.ctx.arc(x + tileSize / 2, y + tileSize * 0.68, tileSize * 0.32, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
    if (basin) this.drawSprite(basin, x, y, tileSize, tileSize, 1.2);
    if (mid) this.drawSprite(mid, x, y - Math.floor(tileSize * 0.35), tileSize, tileSize, 1.25);
    if (top) this.drawSprite(top, x, y - tileSize, tileSize, tileSize, 1.2);
  }

  getTileLootRarity(itemIds) {
    let best = "common";
    for (const itemId of itemIds) {
      // Vault keys matter more than their price suggests.
      const rarity = ITEMS[itemId]?.category === "quest" ? "rare" : this.game.getItemRarity(itemId);
      if (RARITY_RANK[rarity] > RARITY_RANK[best]) best = rarity;
    }
    return best;
  }

  // A soft pool of light under uncommon-or-better floor loot; boss items also get a faint beam.
  drawLootGlow(px, py, tileSize, rarity) {
    const { ctx } = this;
    const pulse = reduceMotion() ? 1 : 0.8 + Math.sin(performance.now() / 320) * 0.2;
    const color = rarity === "uncommon" ? "120, 210, 120" : "242, 196, 107";
    const strength = (rarity === "uncommon" ? 0.38 : rarity === "rare" ? 0.65 : 0.8) * pulse;
    const cx = px + tileSize / 2;
    const cy = py + tileSize * 0.7;
    ctx.save();
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, tileSize * 0.85);
    glow.addColorStop(0, `rgba(${color}, ${strength.toFixed(3)})`);
    glow.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(px - tileSize * 0.25, py - tileSize * 0.1, tileSize * 1.5, tileSize * 1.3);
    if (rarity === "boss") {
      const beam = ctx.createLinearGradient(0, py - tileSize * 1.6, 0, cy);
      beam.addColorStop(0, `rgba(${color}, 0)`);
      beam.addColorStop(1, `rgba(${color}, ${(0.55 * pulse).toFixed(3)})`);
      ctx.fillStyle = beam;
      ctx.fillRect(cx - tileSize * 0.14, py - tileSize * 1.6, tileSize * 0.28, cy - (py - tileSize * 1.6));
    }
    ctx.restore();
  }

  // Three little four-point glints that blink in turn around rare loot.
  drawLootSparkles(px, py, tileSize, rarity) {
    const { ctx } = this;
    const pixel = Math.max(1, Math.floor(tileSize / 16));
    const time = reduceMotion() ? 0 : performance.now();
    const spots = [[0.2, 0.25], [0.78, 0.4], [0.45, 0.05]];
    ctx.save();
    ctx.fillStyle = rarity === "boss" ? "#fff2c2" : "#ffe7a3";
    spots.forEach(([sx, sy], index) => {
      const phase = ((time / 700) + index / spots.length) % 1;
      if (!reduceMotion() && phase > 0.55) return;
      const size = phase < 0.25 ? 2 : 1;
      const x = Math.round(px + sx * tileSize);
      const y = Math.round(py + sy * tileSize);
      ctx.fillRect(x, y - pixel * size, pixel, pixel * (size * 2 + 1));
      ctx.fillRect(x - pixel * size, y, pixel * (size * 2 + 1), pixel);
    });
    ctx.restore();
  }

  // Cosmetic torchlight: a band-tinted shadow that deepens toward the screen edges, a warm flickering
  // glow around the player, and small glows at shrines and stairs. Fully visible tiles stay readable.
  drawLighting(currentFloor, player, offsetX, offsetY, tileSize, extraLights = []) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (!this.lightCanvas) this.lightCanvas = document.createElement("canvas");
    const light = this.lightCanvas;
    if (light.width !== width || light.height !== height) {
      light.width = width;
      light.height = height;
    }
    const now = performance.now();
    const flicker = reduceMotion() ? 1 : 1 + Math.sin(now / 130) * 0.02 + Math.sin(now / 53) * 0.012;
    const tint = LIGHT_TINTS[currentFloor.theme] ?? LIGHT_TINTS.crypt;
    const lctx = light.getContext("2d");
    const centre = (x, y) => ({ x: offsetX + (x + 0.5) * tileSize, y: offsetY + (y + 0.5) * tileSize });
    const cut = (point, radius, stops) => {
      const gradient = lctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      for (const [offset, alpha] of stops) gradient.addColorStop(offset, `rgba(0, 0, 0, ${alpha})`);
      lctx.fillStyle = gradient;
      lctx.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
    };

    lctx.globalCompositeOperation = "source-over";
    lctx.clearRect(0, 0, width, height);
    lctx.fillStyle = `rgba(${tint}, ${LIGHT_OUTER_DARKNESS})`;
    lctx.fillRect(0, 0, width, height);
    lctx.globalCompositeOperation = "destination-out";
    const playerPoint = centre(player.x, player.y);
    const radius = tileSize * LIGHT_RADIUS_TILES * flicker;
    cut(playerPoint, radius, [[0, 1], [0.5, 0.9], [0.8, 0.55], [1, 0]]);

    const glows = extraLights.map((light) => ({ point: centre(light.x, light.y), radius: tileSize * light.radius, color: light.color, strength: light.strength }));
    const shrine = currentFloor.shrine;
    if (shrine && currentFloor.map[shrine.y]?.[shrine.x]?.explored) {
      glows.push({ point: centre(shrine.x, shrine.y), radius: tileSize * 2.6, color: shrine.mode === "healing" ? "255, 90, 70" : "90, 150, 255", strength: shrine.used ? 0.06 : 0.16 });
    }
    currentFloor.map.forEach((row, y) => row.forEach((tile, x) => {
      if (tile.stairs && tile.explored) glows.push({ point: centre(x, y), radius: tileSize * 1.8, color: "140, 220, 140", strength: 0.1 });
    }));
    for (const glow of glows) cut(glow.point, glow.radius, [[0, 0.8], [1, 0]]);

    const ctx = this.ctx;
    ctx.drawImage(light, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const warm = ctx.createRadialGradient(playerPoint.x, playerPoint.y, 0, playerPoint.x, playerPoint.y, radius * 0.55);
    warm.addColorStop(0, "rgba(255, 170, 90, 0.1)");
    warm.addColorStop(1, "rgba(255, 170, 90, 0)");
    ctx.fillStyle = warm;
    ctx.fillRect(playerPoint.x - radius, playerPoint.y - radius, radius * 2, radius * 2);
    for (const glow of glows) {
      const gradient = ctx.createRadialGradient(glow.point.x, glow.point.y, 0, glow.point.x, glow.point.y, glow.radius);
      gradient.addColorStop(0, `rgba(${glow.color}, ${glow.strength})`);
      gradient.addColorStop(1, `rgba(${glow.color}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(glow.point.x - glow.radius, glow.point.y - glow.radius, glow.radius * 2, glow.radius * 2);
    }
    ctx.restore();
  }

  // The whole explored floor, scaled to fill the full-map overlay.
  drawFullMap() {
    const canvas = document.getElementById("full-map-canvas");
    const run = this.game.state.run;
    if (!canvas || !run) return;
    const { currentFloor, player } = run;
    const frame = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const cell = Math.max(2, Math.floor(Math.min((frame.clientWidth * dpr) / currentFloor.width, (frame.clientHeight * dpr) / currentFloor.height)));
    canvas.width = currentFloor.width * cell;
    canvas.height = currentFloor.height * cell;
    canvas.style.width = `${canvas.width / dpr}px`;
    canvas.style.height = `${canvas.height / dpr}px`;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#07060a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const dot = (x, y, color, scale = 0.7) => {
      const size = Math.max(2, Math.round(cell * scale));
      ctx.fillStyle = color;
      ctx.fillRect(x * cell + Math.floor((cell - size) / 2), y * cell + Math.floor((cell - size) / 2), size, size);
    };
    currentFloor.map.forEach((row, y) => row.forEach((tile, x) => {
      if (!tile.explored && !tile.visible) return;
      ctx.fillStyle = tile.type === "wall" ? MINIMAP_COLORS.wall : tile.visible ? MINIMAP_COLORS.floorVisible : MINIMAP_COLORS.floor;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }));
    currentFloor.map.forEach((row, y) => row.forEach((tile, x) => {
      if (!tile.explored && !tile.visible) return;
      if (tile.stairs) dot(x, y, MINIMAP_COLORS.stairs, 0.9);
      if (tile.vendor) dot(x, y, MINIMAP_COLORS.vendor, 0.9);
      if (tile.chestId) dot(x, y, MINIMAP_COLORS.chest, 0.8);
      if (tile.itemIds?.length) dot(x, y, RARITY_RANK[this.getTileLootRarity(tile.itemIds)] >= RARITY_RANK.rare ? "#f2c46b" : "#7cc1ff", 0.5);
    }));
    const shrine = currentFloor.shrine;
    if (shrine && currentFloor.map[shrine.y]?.[shrine.x]?.explored) dot(shrine.x, shrine.y, MINIMAP_COLORS.shrine, 0.9);
    for (const enemy of currentFloor.enemies) {
      if (enemy.disguised || !currentFloor.map[enemy.y][enemy.x].visible) continue;
      dot(enemy.x, enemy.y, ENEMIES[enemy.templateId]?.behavior === "boss" ? MINIMAP_COLORS.boss : MINIMAP_COLORS.enemy, 0.8);
    }
    dot(player.x, player.y, MINIMAP_COLORS.player, 1.1);
  }

  // Boss name-plate introduction (fades on its own) and the boss HP bar along the bottom of the map.
  renderBossUi() {
    const { run, ui } = this.game.state;
    const stage = document.querySelector(".map-stage");
    const bar = document.getElementById("boss-bar");
    const intro = document.getElementById("boss-intro");
    if (!run || !bar || !intro) return;
    const boss = run.currentFloor.enemies.find((enemy) => ENEMIES[enemy.templateId]?.behavior === "boss"
      && enemy.hp > 0 && run.player.floorFlags?.[`${enemy.templateId}Seen`]);
    bar.classList.toggle("hidden", !boss);
    stage?.classList.toggle("has-boss-bar", Boolean(boss));
    if (boss) {
      const ratio = clamp(boss.hp / boss.maxHp, 0, 1);
      document.getElementById("boss-bar-name").textContent = boss.name;
      document.getElementById("boss-bar-hp").textContent = `${Math.max(0, boss.hp)} / ${boss.maxHp}`;
      document.getElementById("boss-bar-fill").style.width = `${ratio * 100}%`;
      document.getElementById("boss-bar-trail").style.width = `${ratio * 100}%`;
      const isOverlord = boss.templateId === "abyssal_overlord";
      document.getElementById("boss-bar-marker").classList.toggle("hidden", !isOverlord || boss.phaseTwo);
      document.getElementById("boss-bar-phase").textContent = isOverlord ? (boss.phaseTwo ? "Phase 2" : "Phase 1") : "";
      bar.classList.toggle("enraged", Boolean(boss.phaseTwo));
    }

    const introState = ui.bossIntro;
    const elapsed = introState ? Date.now() - introState.startedAt : Infinity;
    if (elapsed > BOSS_INTRO_MS) {
      if (introState) ui.bossIntro = null;
      intro.classList.add("hidden");
      return;
    }
    if (intro.dataset.for !== introState.startedAt.toString()) {
      intro.dataset.for = introState.startedAt.toString();
      document.getElementById("boss-intro-kicker").textContent = introState.kicker ?? "A guardian stirs";
      document.getElementById("boss-intro-name").textContent = introState.name;
      document.getElementById("boss-intro-title").textContent = introState.title;
      intro.classList.toggle("phase", Boolean(introState.phase));
      // Re-run the entrance animation for a second plate (the phase change) in the same fight.
      intro.classList.add("hidden");
      void intro.offsetWidth;
    }
    const spritePath = this.assets ? getActorSpriteFrame(this.assets.manifest, introState.templateId, Math.floor(performance.now() / 220)) : null;
    const sprite = document.getElementById("boss-intro-sprite");
    if (spritePath && sprite.getAttribute("src") !== spritePath) sprite.setAttribute("src", spritePath);
    intro.classList.remove("hidden");
    intro.classList.toggle("leaving", elapsed > BOSS_INTRO_MS - 500);
  }

  // A brief card over the map naming the floor and its band; it never blocks input.
  showFloorCard(card) {
    const element = document.getElementById("floor-card");
    if (!element) return;
    document.getElementById("floor-card-kicker").textContent = card.kicker;
    document.getElementById("floor-card-title").textContent = card.title;
    document.getElementById("floor-card-subtitle").textContent = card.subtitle ?? "";
    element.classList.toggle("boss-floor", Boolean(card.boss));
    // Restart the animation even if a card is already showing.
    element.classList.remove("showing");
    element.classList.remove("hidden");
    void element.offsetWidth;
    element.classList.add("showing");
    window.clearTimeout(this.floorCardTimer);
    this.floorCardTimer = window.setTimeout(() => {
      element.classList.remove("showing");
      element.classList.add("hidden");
    }, FLOOR_CARD_MS);
  }

  // An actor dissolving away: fading and lifting slightly, shedding grey motes that drift upward.
  drawFadingActor(image, x, y, tileSize, remaining) {
    const { ctx } = this;
    const progress = 1 - remaining;
    ctx.save();
    ctx.globalAlpha = Math.max(0, remaining);
    this.drawActor(image, x, y - Math.round(progress * tileSize * 0.25), tileSize);
    ctx.restore();
    const mote = Math.max(1, Math.floor(tileSize / 16));
    ctx.save();
    for (let index = 0; index < 10; index += 1) {
      const seedX = ((index * 37) % 11) / 10;
      const rise = (progress * 1.6 + index * 0.13) % 1;
      ctx.globalAlpha = Math.max(0, remaining) * (1 - rise);
      ctx.fillStyle = index % 3 === 0 ? "#e9e2f7" : "#9d93b8";
      ctx.fillRect(
        Math.round(x + seedX * tileSize),
        Math.round(y + tileSize * 0.8 - rise * tileSize * 1.6),
        mote,
        mote,
      );
    }
    ctx.restore();
  }

  // Sewer tile dressing: floor decor and corner cobwebs are drawn now; props and wall features are queued
  // for the standing pass; torches register a light and a flame glow.
  collectSewerDecor(currentFloor, tile, x, y, px, py, tileSize, seed, floorAtlas, standing, torchLights, glowing) {
    if (!tile.explored && !tile.visible) return;
    const { map } = currentFloor;
    const { ctx } = this;
    if (tile.type === "floor") {
      const busy = tile.stairs || tile.chestId || tile.vendor || tile.shrineId || tile.itemIds?.length || tile.prop;
      const decor = busy ? null : getSewerFloorDecor(x, y, seed);
      if (decor && floorAtlas) {
        const frame = decor.kind === "eyes" && !reduceMotion() ? Math.floor(performance.now() / 700 + (decor.hash % 7)) : decor.hash;
        ctx.save();
        if (!tile.visible) ctx.globalAlpha = 0.32;
        this.drawAtlasTile(floorAtlas, decor.coords[frame % decor.coords.length], px, py, tileSize);
        ctx.restore();
        if (decor.kind === "eyes" && tile.visible) glowing.push({ detail: { kind: "eyes", hash: decor.hash }, px, py });
      }
      const web = getSewerCobweb(map, x, y, seed);
      if (web) standing.push({ kind: "webCorner", flip: web === "left", x, y, px, py, visible: tile.visible, layer: "floor" });
      if (tile.prop && tile.prop !== "extends") standing.push({ kind: tile.prop, x, y, px, py, visible: tile.visible });
      return;
    }
    const feature = getSewerWallFeature(map, x, y, seed);
    if (!feature) return;
    standing.push({ kind: feature, x, y, px, py, visible: tile.visible, wall: true });
    if (feature === "torch") {
      torchLights.push({ x, y: y + 0.5, radius: 3.2, color: "110, 235, 110", strength: 0.18 });
      if (tile.visible) glowing.push({ detail: { kind: "torch", hash: hashPoint(x, y) }, px, py: py - tileSize * 0.9 });
    }
  }

  // One sewer sprite at native pixel scale. Props stand on their tile; torches rise above the wall.
  drawSewerSprite(sheet, entry, tileSize) {
    const frames = SEWER_SPRITES[entry.kind];
    if (!sheet || !frames) return;
    const frameMs = SEWER_FRAME_MS[entry.kind];
    const frameIndex = frameMs && !reduceMotion() ? Math.floor(performance.now() / frameMs + (entry.x * 3 + entry.y)) % frames.length : 0;
    const [sx, sy, sw, sh] = frames[frameIndex];
    const scale = tileSize / 16;
    const width = sw * scale;
    const height = sh * scale;
    let dx = entry.px;
    let dy = entry.py + tileSize - height;
    if (entry.kind === "webCorner") dy = entry.py;
    const { ctx } = this;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (!entry.visible) ctx.globalAlpha = 0.38;
    if (entry.flip) {
      ctx.translate(dx + width, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, sx, sy, sw, sh, 0, 0, width, height);
    } else {
      ctx.drawImage(sheet, sx, sy, sw, sh, Math.round(dx), Math.round(dy), width, height);
    }
    ctx.restore();
  }

  // Pixel-art floor details on the 16px source grid (scaled to the tile). Fogged tiles draw dimmed.
  drawFloorDetail(detail, px, py, tileSize, visible) {
    const { ctx } = this;
    const pixel = tileSize / 16;
    const dot = (gx, gy, color, w = 1, h = 1) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(px + gx * pixel), Math.round(py + gy * pixel), Math.ceil(w * pixel), Math.ceil(h * pixel));
    };
    const h = detail.hash;
    ctx.save();
    if (!visible) ctx.globalAlpha = 0.35;
    if (detail.kind === "stars") {
      // Two or three pale specks scattered across the stone.
      const count = 2 + (h % 2);
      for (let index = 0; index < count; index += 1) {
        const gx = 2 + ((h >>> (index * 4)) % 12);
        const gy = 2 + ((h >>> (index * 4 + 2)) % 12);
        dot(gx, gy, index === 0 ? "#e6ddff" : "#9d8be0");
      }
    } else if (detail.kind === "rift") {
      // A small tear in the floor: a dark oval with a violet rim.
      dot(5, 6, "#6a4fc0", 6, 1);
      dot(4, 7, "#6a4fc0", 1, 3);
      dot(11, 7, "#6a4fc0", 1, 3);
      dot(5, 10, "#6a4fc0", 6, 1);
      dot(5, 7, "#05030a", 6, 3);
    } else if (detail.kind === "crack") {
      // A zigzag crack with a molten seam.
      let gx = 2 + (h % 3);
      let gy = 3 + ((h >>> 3) % 9);
      for (let step = 0; step < 7; step += 1) {
        dot(gx, gy, "#1a0806", 2, 2);
        dot(gx, gy, "#ff7a3a");
        gx += 2;
        gy += ((h >>> (step + 5)) & 1) ? 1 : -1;
        gy = Math.max(2, Math.min(13, gy));
      }
    } else if (detail.kind === "vent") {
      // A glowing fissure: a small dark pit with an ember core.
      dot(6, 6, "#1a0806", 4, 4);
      dot(7, 7, "#b0402c", 2, 2);
      dot(7, 7, "#ffb070");
    } else if (detail.kind === "gilt") {
      // Flat gold filigree set into the stone: corner brackets and a small diamond, kept dark and
      // angular so it reads as floor inlay rather than a coin to pick up.
      const inlay = "#7a5a2a";
      const shine = "#b08a45";
      dot(2, 2, inlay, 4, 1);
      dot(2, 3, inlay, 1, 3);
      dot(10, 13, inlay, 4, 1);
      dot(13, 10, inlay, 1, 3);
      dot(7, 6, inlay, 2, 1);
      dot(6, 7, inlay, 1, 2);
      dot(9, 7, inlay, 1, 2);
      dot(7, 9, inlay, 2, 1);
      dot(7, 7, shine, 2, 2);
    }
    ctx.restore();
  }

  // The emissive part of a detail, drawn over the lighting so it reads as light, not paint.
  drawFloorDetailGlow(detail, px, py, tileSize) {
    const { ctx } = this;
    const now = reduceMotion() ? 0 : performance.now();
    const phase = (detail.hash % 1000) / 1000;
    const cx = px + tileSize / 2;
    const cy = py + tileSize / 2;
    const glow = (color, radius, alpha) => {
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, `rgba(${color}, ${alpha.toFixed(3)})`);
      gradient.addColorStop(1, `rgba(${color}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    };
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (detail.kind === "rift") glow("120, 80, 230", tileSize * 0.7, 0.16 + Math.sin(now / 700 + phase * 6) * 0.05);
    if (detail.kind === "crack") glow("255, 110, 50", tileSize * 0.6, 0.12 + Math.sin(now / 380 + phase * 6) * 0.05);
    if (detail.kind === "vent") glow("255, 130, 60", tileSize * 0.8, 0.22 + Math.sin(now / 260 + phase * 6) * 0.08);
    if (detail.kind === "gilt") glow("242, 196, 107", tileSize * 0.35, 0.05);
    if (detail.kind === "torch") glow("120, 240, 110", tileSize * 0.75, 0.2 + Math.sin(now / 90 + phase * 6) * 0.04);
    if (detail.kind === "eyes") glow("120, 240, 110", tileSize * 0.45, 0.1 + Math.sin(now / 700 + phase * 6) * 0.05);
    if (detail.kind === "stars" && !reduceMotion()) {
      // Now and then one speck glints.
      const cycle = ((now / 2400) + phase) % 1;
      if (cycle < 0.12) glow("220, 210, 255", tileSize * 0.3, 0.25 * (1 - cycle / 0.12));
    }
    ctx.restore();
  }

  // Motes drift over visible floor in the band's style; they're spawned in view and fade in and out.
  // A band's style may be one layer or a list of layers (e.g. sewer drips plus mist).
  updateAndDrawMotes(currentFloor, offsetX, offsetY, tileSize) {
    const style = MOTE_STYLES[currentFloor.theme];
    const now = performance.now();
    const dt = Math.min(60, now - (this.moteTime ?? now));
    this.moteTime = now;
    if (!style || reduceMotion()) {
      this.motes = [];
      return;
    }
    if (this.motesFloor !== currentFloor) {
      this.motes = [];
      this.motesFloor = currentFloor;
    }
    const layers = Array.isArray(style) ? style : [style];
    const random = (range) => range[0] + Math.random() * (range[1] - range[0]);
    const viewLeft = -offsetX / tileSize;
    const viewTop = -offsetY / tileSize;
    const viewWidth = this.canvas.width / tileSize;
    const viewHeight = this.canvas.height / tileSize;
    layers.forEach((layer, layerIndex) => {
      const current = this.motes.filter((mote) => mote.layer === layerIndex).length;
      // Top up gradually so motes don't all appear at once.
      for (let attempt = 0, added = 0; attempt < 3 && current + added < layer.count; attempt += 1) {
        const x = viewLeft + Math.random() * viewWidth;
        const y = viewTop + Math.random() * viewHeight;
        const tile = currentFloor.map[Math.floor(y)]?.[Math.floor(x)];
        if (!tile?.visible || tile.type !== "floor") continue;
        added += 1;
        this.motes.push({
          layer: layerIndex,
          x, y,
          vx: random(layer.vx),
          vy: random(layer.vy),
          age: 0,
          life: random(layer.life),
          color: layer.colors[Math.floor(Math.random() * layer.colors.length)],
          phase: Math.random() * Math.PI * 2,
        });
      }
    });
    const { ctx } = this;
    const pixel = Math.max(1, Math.round(tileSize / 16));
    ctx.save();
    this.motes = this.motes.filter((mote) => {
      const layer = layers[mote.layer];
      if (!layer) return false;
      mote.age += dt;
      mote.x += (mote.vx * dt) / 1000;
      mote.y += (mote.vy * dt) / 1000;
      if (mote.age >= mote.life) return false;
      const progress = mote.age / mote.life;
      let alpha = Math.sin(Math.PI * progress) * (layer.alpha ?? 0.85);
      if (layer.twinkle) alpha *= 0.6 + Math.sin(now / 240 + mote.phase) * 0.4;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = mote.color;
      const width = pixel * (layer.size ?? 1);
      const height = pixel * (layer.height ?? layer.size ?? 1);
      ctx.fillRect(Math.round(offsetX + mote.x * tileSize), Math.round(offsetY + mote.y * tileSize), width, height);
      return true;
    });
    ctx.restore();
  }

  // Where a warned boss attack will land next turn: red tiles within the boss's reach for melee,
  // a target over the player (with a faint line from the boss) for bolts. Drawn above the lighting.
  drawTelegraphs(currentFloor, player, offsetX, offsetY, tileSize) {
    const { ctx } = this;
    const pulse = reduceMotion() ? 0.75 : 0.6 + Math.sin(performance.now() / 160) * 0.25;
    const line = Math.max(1, Math.floor(tileSize / 16));
    for (const enemy of currentFloor.enemies) {
      const telegraph = enemy.telegraph;
      if (!telegraph || telegraph.landsOnTurn <= enemy.turnCounter) continue;
      if (!currentFloor.map[enemy.y]?.[enemy.x]?.visible) continue;
      ctx.save();
      if (telegraph.kind === "melee") {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const tile = currentFloor.map[enemy.y + dy]?.[enemy.x + dx];
          if (!tile || tile.type !== "floor") continue;
          const px = offsetX + (enemy.x + dx) * tileSize;
          const py = offsetY + (enemy.y + dy) * tileSize;
          ctx.fillStyle = `rgba(224, 60, 45, ${(0.28 * pulse).toFixed(3)})`;
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.strokeStyle = `rgba(255, 110, 90, ${(0.9 * pulse).toFixed(3)})`;
          ctx.lineWidth = line;
          ctx.strokeRect(px + line / 2 + line, py + line / 2 + line, tileSize - line * 3, tileSize - line * 3);
        }
      } else {
        const cx = offsetX + (player.x + 0.5) * tileSize;
        const cy = offsetY + (player.y + 0.5) * tileSize;
        const ex = offsetX + (enemy.x + 0.5) * tileSize;
        const ey = offsetY + (enemy.y + 0.5) * tileSize;
        ctx.strokeStyle = `rgba(255, 110, 90, ${(0.35 * pulse).toFixed(3)})`;
        ctx.lineWidth = line;
        ctx.setLineDash([line * 3, line * 3]);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.setLineDash([]);
        // Corner brackets around the player's tile, plus a centre dot.
        const half = tileSize / 2;
        const arm = Math.round(tileSize * 0.28);
        ctx.strokeStyle = `rgba(255, 90, 70, ${pulse.toFixed(3)})`;
        ctx.lineWidth = line * 2;
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const x = cx + sx * half;
          const y = cy + sy * half;
          ctx.beginPath();
          ctx.moveTo(x - sx * arm, y);
          ctx.lineTo(x, y);
          ctx.lineTo(x, y - sy * arm);
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(255, 90, 70, ${pulse.toFixed(3)})`;
        ctx.fillRect(Math.round(cx - line), Math.round(cy - line), line * 2, line * 2);
      }
      ctx.restore();
    }
  }

  // A short jolt of the map for big moments (skipped under reduced motion).
  shake() {
    const stage = document.querySelector(".map-stage");
    if (!stage || reduceMotion()) return;
    stage.classList.remove("shaking");
    void stage.offsetWidth;
    stage.classList.add("shaking");
    window.clearTimeout(this.shakeTimer);
    this.shakeTimer = window.setTimeout(() => stage.classList.remove("shaking"), 500);
  }

  // Stairs sealed by a living boss: darkened, barred with iron, and pulsing with a red ward.
  drawSealedStairs(px, py, tileSize) {
    const { ctx } = this;
    const pixel = Math.max(1, Math.floor(tileSize / 16));
    const pulse = reduceMotion() ? 0.5 : 0.5 + Math.sin(performance.now() / 420) * 0.25;
    ctx.save();
    ctx.fillStyle = "rgba(6, 4, 4, 0.55)";
    ctx.fillRect(px, py, tileSize, tileSize);
    const ward = ctx.createRadialGradient(px + tileSize / 2, py + tileSize / 2, 0, px + tileSize / 2, py + tileSize / 2, tileSize * 0.7);
    ward.addColorStop(0, `rgba(224, 70, 55, ${(0.35 * pulse).toFixed(3)})`);
    ward.addColorStop(1, "rgba(224, 70, 55, 0)");
    ctx.fillStyle = ward;
    ctx.fillRect(px - tileSize * 0.2, py - tileSize * 0.2, tileSize * 1.4, tileSize * 1.4);
    // Four iron bars and two crossbands, each with a one-pixel highlight.
    for (let bar = 0; bar < 4; bar += 1) {
      const x = px + Math.round(tileSize * (0.16 + bar * 0.22));
      ctx.fillStyle = "#1c1f24";
      ctx.fillRect(x, py + pixel, pixel * 2, tileSize - pixel * 2);
      ctx.fillStyle = "#5b636e";
      ctx.fillRect(x, py + pixel, pixel, tileSize - pixel * 2);
    }
    for (const band of [0.28, 0.68]) {
      const y = py + Math.round(tileSize * band);
      ctx.fillStyle = "#1c1f24";
      ctx.fillRect(px + pixel, y, tileSize - pixel * 2, pixel * 2);
      ctx.fillStyle = "#5b636e";
      ctx.fillRect(px + pixel, y, tileSize - pixel * 2, pixel);
    }
    ctx.restore();
  }

  // A thin bar along the bottom of the tile, only once an enemy has taken damage.
  drawHealthBar(x, y, tileSize, enemy) {
    if (enemy.hp >= enemy.maxHp || enemy.hp <= 0) return;
    const height = Math.max(3, Math.floor(tileSize * 0.12));
    const inset = Math.floor(tileSize * 0.1);
    const width = tileSize - inset * 2;
    const top = y + tileSize - height - 1;
    const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);
    this.ctx.fillStyle = "rgba(8, 10, 13, 0.85)";
    this.ctx.fillRect(x + inset - 1, top - 1, width + 2, height + 2);
    this.ctx.fillStyle = ratio > 0.5 ? "#d16464" : ratio > 0.25 ? "#e0833f" : "#ff4d4d";
    this.ctx.fillRect(x + inset, top, Math.max(1, Math.round(width * ratio)), height);
  }

  drawHoverOutline(currentFloor, offsetX, offsetY, tileSize) {
    const hover = this.hoverTile;
    const tile = hover ? currentFloor.map[hover.y]?.[hover.x] : null;
    if (!tile || (!tile.explored && !tile.visible)) return;
    const line = Math.max(1, Math.floor(tileSize / 16));
    this.ctx.save();
    this.ctx.strokeStyle = "rgba(240, 234, 214, 0.75)";
    this.ctx.lineWidth = line;
    this.ctx.strokeRect(offsetX + hover.x * tileSize + line / 2, offsetY + hover.y * tileSize + line / 2, tileSize - line, tileSize - line);
    this.ctx.restore();
  }

  // Converts a mouse position to the map tile under it, using the last drawn camera.
  tileAtClientPoint(clientX, clientY) {
    if (!this.mapView) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width) return null;
    const scale = this.canvas.width / rect.width;
    const { offsetX, offsetY, tileSize, floor } = this.mapView;
    const canvasX = (clientX - rect.left) * scale;
    const canvasY = (clientY - rect.top) * scale;
    const minimap = this.minimapRect;
    if (minimap && canvasX >= minimap.x && canvasX < minimap.x + minimap.width && canvasY >= minimap.y && canvasY < minimap.y + minimap.height) return null;
    const x = Math.floor((canvasX - offsetX) / tileSize);
    const y = Math.floor((canvasY - offsetY) / tileSize);
    if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) return null;
    return { x, y };
  }

  // Up to three status icons in a row above the actor's tile, on a dark backing so they read on any floor.
  drawStatusPips(x, y, tileSize, statuses = []) {
    if (!statuses?.length) return;
    const scale = Math.max(1, Math.round(tileSize / 32));
    const size = 8 * scale;
    const gap = scale;
    const { ctx } = this;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    statuses.slice(0, 3).forEach((status, index) => {
      const left = x + 1 + index * (size + gap);
      const top = y - size - 3;
      ctx.fillStyle = "rgba(8, 6, 5, 0.75)";
      ctx.fillRect(left - 1, top - 1, size + 2, size + 2);
      const icon = getStatusIconCanvas(status.id);
      if (icon) {
        ctx.drawImage(icon, left, top, size, size);
      } else {
        ctx.fillStyle = getStatusColor(status.id);
        ctx.fillRect(left, top, size, size);
      }
    });
    ctx.restore();
  }

  queueProjectile(projectile) {
    this.projectiles.push({
      ...projectile,
      createdAt: performance.now(),
      duration: projectile.duration ?? 320,
    });
  }

  renderProjectiles(tileSize, offsetX, offsetY) {
    if (!this.projectiles.length) return;
    const now = performance.now();
    this.projectiles = this.projectiles.filter((projectile) => now - projectile.createdAt < projectile.duration);

    for (const projectile of this.projectiles) {
      const progress = clamp((now - projectile.createdAt) / projectile.duration, 0, 1);
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - ((-2 * progress + 2) ** 2) / 2;
      const startX = offsetX + (projectile.from.x + 0.5) * tileSize;
      const startY = offsetY + (projectile.from.y + 0.5) * tileSize;
      const endX = offsetX + (projectile.to.x + 0.5) * tileSize;
      const endY = offsetY + (projectile.to.y + 0.5) * tileSize;
      const x = startX + (endX - startX) * eased;
      const y = startY + (endY - startY) * eased;
      const appearance = getProjectileAppearance(projectile);
      const radius = Math.max(4, tileSize * appearance.radius);

      this.ctx.save();
      this.ctx.globalAlpha = 0.3;
      this.ctx.strokeStyle = appearance.trail;
      this.ctx.lineWidth = Math.max(2, tileSize * 0.08);
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
      this.ctx.fillStyle = appearance.color;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = appearance.trail;
      this.ctx.beginPath();
      this.ctx.arc(x, y, Math.max(2, radius * 0.45), 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  queueDamagePopup({ x, y, damage, type = "enemy", critical = false }) {
    this.damagePopups.push({
      x, y, damage, type, critical,
      createdAt: performance.now(),
      duration: 800,
      offsetX: (Math.random() - 0.5) * 0.4,
    });
  }

  renderDamagePopups(tileSize, offsetX, offsetY) {
    if (!this.damagePopups.length) return;
    const now = performance.now();
    this.damagePopups = this.damagePopups.filter((p) => now - p.createdAt < p.duration);
    for (const popup of this.damagePopups) {
      const progress = (now - popup.createdAt) / popup.duration;
      const alpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
      const rise = progress * tileSize * 1.2;
      const px = offsetX + (popup.x + 0.5 + popup.offsetX) * tileSize;
      const py = offsetY + (popup.y + 0.2) * tileSize - rise;
      const fontSize = popup.critical ? Math.max(13, tileSize * 0.7) : Math.max(11, tileSize * 0.55);
      const text = `${popup.damage}`;
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.font = `bold ${Math.floor(fontSize)}px monospace`;
      this.ctx.textAlign = "center";
      this.ctx.lineWidth = 3;
      this.ctx.strokeStyle = "rgba(0,0,0,0.7)";
      this.ctx.strokeText(text, px, py);
      if (popup.type === "player") {
        this.ctx.fillStyle = popup.critical ? "#ff4444" : "#ff8844";
      } else if (popup.type === "heal") {
        this.ctx.fillStyle = "#44ff66";
      } else {
        this.ctx.fillStyle = popup.critical ? "#ffff44" : "#ffffff";
      }
      this.ctx.fillText(text, px, py);
      this.ctx.restore();
    }
  }

  renderHud() {
    const { run } = this.game.state;
    const { player } = run;
    const derived = this.game.getDerivedStats(player);
    const animationFrame = Math.floor(performance.now() / 220);
    const xpNeeded = this.game.getXpForLevel(player.level + 1);
    const xpCurrent = player.level === 10 ? xpNeeded : player.xp;
    const xpProgress = player.level === 10 ? 1 : clamp(xpCurrent / xpNeeded, 0, 1);
    const hpRatio = derived.maxHp ? player.hp / derived.maxHp : 0;
    const isCriticalHp = hpRatio > 0 && hpRatio <= 0.2;

    document.getElementById("hud-class").textContent = CLASSES[player.classId].name;
    document.getElementById("hud-floor").textContent = run.floorNumber === 0 ? "Prelude" : `Floor ${run.floorNumber}`;
    document.getElementById("hud-level").textContent = `Level ${player.level}`;
    const skillAlert = document.getElementById("hud-skill-points");
    if (skillAlert) {
      const points = player.skillPoints ?? 0;
      skillAlert.classList.toggle("hidden", points <= 0);
      const alertText = `${points} skill point${points === 1 ? "" : "s"} to spend (K)`;
      if (points > 0 && skillAlert.textContent !== alertText) skillAlert.textContent = alertText;
    }
    document.getElementById("hud-gold").textContent = `${player.gold}g`;
    document.getElementById("hud-hp-text").textContent = `${player.hp}/${derived.maxHp}`;
    document.getElementById("hud-mana-text").textContent = `${player.mana}/${derived.maxMana}`;
    document.getElementById("hud-xp-text").textContent = player.level === 10 ? "Max level" : `${player.xp}/${xpNeeded}`;

    const hpBar = document.getElementById("hud-hp-bar");
    const hpGroup = document.getElementById("hud-hp-group");
    hpBar.style.width = `${(player.hp / derived.maxHp) * 100}%`;
    document.getElementById("hud-mana-bar").style.width = `${(player.mana / derived.maxMana) * 100}%`;
    // The pale trail catches up after a moment, so a big hit shows how much it took.
    document.getElementById("hud-hp-trail").style.width = hpBar.style.width;
    document.getElementById("hud-xp-bar").style.width = `${xpProgress * 100}%`;
    hpBar.classList.toggle("critical", isCriticalHp);
    hpGroup.classList.toggle("critical", isCriticalHp);
    if (isCriticalHp && !this.wasCriticalHp) {
      this.triggerCriticalFlash();
    }
    this.wasCriticalHp = isCriticalHp;

    const weaponLine = document.getElementById("hud-weapon");
    const armorLine = document.getElementById("hud-armor");
    const handsLine = document.getElementById("hud-hands");
    const accessoryLine = document.getElementById("hud-accessory");
    const boonLine = document.getElementById("hud-boon");
    const strengthLine = document.getElementById("hud-strength");
    const dexterityLine = document.getElementById("hud-dexterity");
    const vitalityLine = document.getElementById("hud-vitality");
    const intelligenceLine = document.getElementById("hud-intelligence");
    const defenseLine = document.getElementById("hud-defense");

    const equippedWeapon = player.equipment.weapon ? ITEMS[player.equipment.weapon] : null;
    const equippedArmor = player.equipment.armor ? ITEMS[player.equipment.armor] : null;
    const equippedHands = player.equipment.hands ? ITEMS[player.equipment.hands] : null;
    const equippedAccessory = player.equipment.accessory ? ITEMS[player.equipment.accessory] : null;
    const boon = this.game.getBoonDefinition(player.boonId);
    const applyEquipmentRarity = (element, item) => {
      element.classList.remove("rarity-common", "rarity-uncommon", "rarity-rare", "rarity-boss");
      if (item) {
        element.classList.add(`rarity-${this.game.getItemRarity(item.id)}`);
      }
    };

    weaponLine.textContent = `Weapon: ${equippedWeapon ? equippedWeapon.name : "None"}`;
    armorLine.textContent = `Armor: ${equippedArmor ? equippedArmor.name : "None"}`;
    handsLine.textContent = `Hands: ${equippedHands ? equippedHands.name : "None"}`;
    accessoryLine.textContent = `Accessory: ${equippedAccessory ? equippedAccessory.name : "None"}`;
    boonLine.textContent = boon ? boon.name : "None";
    applyEquipmentRarity(weaponLine, equippedWeapon);
    applyEquipmentRarity(armorLine, equippedArmor);
    applyEquipmentRarity(handsLine, equippedHands);
    applyEquipmentRarity(accessoryLine, equippedAccessory);
    strengthLine.textContent = `Strength: ${derived.strength}`;
    dexterityLine.textContent = `Dexterity: ${derived.dexterity}`;
    vitalityLine.textContent = `Vitality: ${derived.vitality}`;
    intelligenceLine.textContent = `Intelligence: ${derived.intelligence}`;
    defenseLine.textContent = `Defense: ${derived.defense}`;

    weaponLine.dataset.tooltip = (
      equippedWeapon
        ? `${equippedWeapon.name}\nMain weapon. Improves melee or spell output depending on the item.\n${formatEntryTooltip(equippedWeapon.id)}`
        : "Weapon slot\nNo weapon equipped."
    );
    armorLine.dataset.tooltip = (
      equippedArmor
        ? `${equippedArmor.name}\nArmor reduces incoming damage and may grant bonus stats.\n${formatEntryTooltip(equippedArmor.id)}`
        : "Armor slot\nNo armor equipped."
    );
    handsLine.dataset.tooltip = (
      equippedHands
        ? `${equippedHands.name}\nHands slot for gloves, wraps, and gauntlets with tactical status effects or wards.\n${formatEntryTooltip(equippedHands.id)}`
        : "Hands slot\nNo hands item equipped."
    );
    accessoryLine.dataset.tooltip = (
      equippedAccessory
        ? `${equippedAccessory.name}\nAccessory slot for passive stat bonuses.\n${formatEntryTooltip(equippedAccessory.id)}`
        : "Accessory slot\nNo accessory equipped."
    );
    boonLine.dataset.tooltip = boon
      ? `${boon.name}\n${boon.description}\n${boon.summary}`
      : "Boon\nNo boon chosen yet.";
    strengthLine.dataset.tooltip = "Strength\nImproves melee damage.";
    dexterityLine.dataset.tooltip = "Dexterity\nImproves accuracy and helps with evasion.";
    vitalityLine.dataset.tooltip = "Vitality\nRaises maximum HP.";
    intelligenceLine.dataset.tooltip = "Intelligence\nImproves spell damage and maximum mana.";
    defenseLine.dataset.tooltip = "Defense\nReduces incoming damage from enemy attacks.";
    const powerLine = document.getElementById("hud-power");
    powerLine.textContent = `Power: ${derived.meleeBonus}/${derived.spellBonus}`;
    // Rewritten only on change so a hovered badge keeps its tooltip.
    const statusMarkup = player.statuses.length ? renderStatusBadges(player.statuses) : "";
    for (const statusRow of [document.getElementById("hud-statuses"), document.getElementById("mobile-hud-statuses")]) {
      if (!statusRow || statusRow.dataset.markup === statusMarkup) continue;
      statusRow.innerHTML = statusMarkup;
      statusRow.dataset.markup = statusMarkup;
      statusRow.classList.toggle("hidden", !statusMarkup);
    }
    powerLine.dataset.tooltip = "Power\nFirst value is melee power.\nSecond value is spell power.";

    // Desktop hotbar and the touch quick-slot row share the same slot rendering.
    player.quickSlots.forEach((entry, index) => {
      this.renderQuickSlotButton(document.getElementById(`quick-slot-${index + 1}`), index);
      this.renderQuickSlotButton(document.getElementById(`mobile-qs-${index + 1}`), index);
    });

    const newItems = this.game.getNewItemCount();
    const newItemsButton = document.getElementById("hud-new-items");
    if (newItemsButton) {
      newItemsButton.classList.toggle("hidden", newItems === 0);
      newItemsButton.textContent = `${newItems} new item${newItems === 1 ? "" : "s"} in your pack (I)`;
    }
    const mobileInventoryBadge = document.getElementById("mobile-inv-badge");
    if (mobileInventoryBadge) {
      mobileInventoryBadge.textContent = String(newItems);
      mobileInventoryBadge.classList.toggle("hidden", newItems === 0);
    }
    const mobileSkillBadge = document.getElementById("mobile-skill-badge");
    if (mobileSkillBadge) {
      mobileSkillBadge.textContent = String(player.skillPoints);
      mobileSkillBadge.classList.toggle("hidden", !player.skillPoints);
    }

    const panel = document.getElementById("target-panel");
    const { enemy: target, nearest } = this.game.getPanelTarget();
    const markup = this.renderTargetPanel(target, nearest);
    // Only rewrite when something changed, so a hovered row keeps its tooltip; the sprite animates in place.
    if (markup !== this.lastTargetMarkup) {
      panel.innerHTML = markup;
      this.lastTargetMarkup = markup;
    }
    const sprite = panel.querySelector(".target-sprite");
    const spritePath = target && this.assets ? getActorSpriteFrame(this.assets.manifest, getEnemySpriteId(this.assets.manifest, target), animationFrame) : null;
    if (sprite && spritePath && sprite.getAttribute("src") !== spritePath) sprite.setAttribute("src", spritePath);
  }

  // One quick-slot button: key, icon, name, and mana cost or remaining count; dimmed (with the
  // reason in its tooltip) when it can't be used right now. Still clickable, so the log explains why.
  renderQuickSlotButton(button, index) {
    if (!button) return;
    const slot = this.game.getQuickSlotState(index);
    let markup;
    if (!slot.entryId) {
      markup = `<span class="slot-key">${index + 1}</span><span class="slot-label muted">Empty</span>`;
    } else {
      const entry = slot.entryId;
      const label = SPELLS[entry]?.name ?? ITEMS[entry]?.name ?? entry;
      const iconPath = ITEMS[entry] ? getItemSprite(this.assets?.manifest, entry) : null;
      const icon = iconPath
        ? `<img src="${iconPath}" alt="" class="slot-icon">`
        : SPELLS[entry] && getSpellIconUrl(entry) ? `<img src="${getSpellIconUrl(entry)}" alt="" class="slot-icon">` : "";
      const meta = slot.isSpell
        ? (slot.free ? `<span class="slot-meta free">Free</span>` : slot.cost ? `<span class="slot-meta mana">${slot.cost} MP</span>` : "")
        : `<span class="slot-meta count">&times;${slot.count}</span>`;
      markup = `<span class="slot-key">${index + 1}</span>${icon}<span class="slot-label">${label}</span>${meta}`;
    }
    // Only rewrite when it changes, so a click in progress isn't interrupted by the per-frame render.
    if (button.dataset.markup !== markup) {
      button.innerHTML = markup;
      button.dataset.markup = markup;
    }
    button.disabled = !slot.entryId;
    button.classList.toggle("unusable", Boolean(slot.entryId) && !slot.usable);
    if (slot.entryId) {
      button.dataset.tooltip = `${formatEntryTooltip(slot.entryId)}${slot.reason ? `\n${slot.reason}` : ""}`;
    } else {
      button.removeAttribute("data-tooltip");
    }
  }

  // Pickup, gold, warning and floor-summary notices stacked over the top-left of the map.
  renderToasts() {
    const stack = document.getElementById("toast-stack");
    if (!stack) return;
    const now = Date.now();
    const toasts = (this.game.state.ui.toasts ?? []).filter((toast) => toast.until > now);
    this.game.state.ui.toasts = toasts;
    // Keyed update: existing notices keep their element (so the entrance animation plays once),
    // content changes in place (merged gold), and expired ones are removed.
    const alive = new Set();
    for (const toast of toasts) {
      alive.add(toast.id);
      let element = stack.querySelector(`[data-id="${toast.id}"]`);
      if (!element) {
        element = document.createElement("div");
        element.dataset.id = toast.id;
        stack.appendChild(element);
      }
      const inner = this.renderToastContent(toast);
      if (element.dataset.markup !== inner) {
        element.innerHTML = inner;
        element.dataset.markup = inner;
      }
      const rarity = toast.kind === "item" ? ` rarity-${this.game.getItemRarity(toast.itemId)}` : "";
      element.className = `toast toast--${toast.kind}${rarity}${toast.until - now < 350 ? " leaving" : ""}`;
    }
    for (const element of [...stack.children]) {
      if (!alive.has(element.dataset.id)) element.remove();
    }
  }

  renderToastContent(toast) {
    if (toast.kind === "gold") {
      const coin = this.assets?.manifest.coin;
      return `${coin ? `<img class="toast-icon" src="${coin}" alt="">` : ""}<strong>+${toast.amount} gold</strong>`;
    }
    if (toast.kind === "item") {
      const item = ITEMS[toast.itemId];
      const icon = getItemSprite(this.assets?.manifest, toast.itemId);
      return `${icon ? `<img class="toast-icon" src="${icon}" alt="">` : ""}<span class="toast-verb">${toast.verb}</span><strong>${item?.name ?? toast.itemId}</strong>`;
    }
    if (toast.kind === "warning") return toast.text;
    if (toast.kind === "floor") {
      const summary = toast.summary;
      const stat = (value, label) => `<span><strong>${value}</strong> ${label}</span>`;
      return `
        <span class="toast-title">Floor ${summary.floor} complete</span>
        <span class="toast-stats">
          ${stat(summary.kills, summary.kills === 1 ? "kill" : "kills")}
          ${stat(summary.items, summary.items === 1 ? "item" : "items")}
          ${stat(`+${summary.gold}`, "gold")}
          ${stat(`${summary.explored}%`, "explored")}
          ${stat(summary.turns, "turns")}
        </span>`;
    }
    return "";
  }

  renderTargetPanel(target, nearest) {
    if (!target) return `<p class="muted">No enemies in sight.</p>`;
    const intel = this.game.getEnemyIntel(target);
    const spriteMarkup = this.assets ? `<img alt="" class="target-sprite">` : "";
    const range = ([low, high]) => (low === high ? `${low}` : `${low}–${high}`);
    const hpPct = Math.round((intel.hp / intel.maxHp) * 100);
    const rankClass = intel.rank.startsWith("Final") || intel.rank === "Boss" ? "boss" : intel.rank === "Elite" ? "elite" : "";
    const attackRow = (label, entry, tooltip) => `
      <div class="${entry.inRange ? "" : "out-of-range"}" data-tooltip="${escapeTooltip(`${tooltip}${entry.inRange ? "" : "\nOut of range right now."}`)}">
        <dt>${label}</dt><dd>${entry.hitChance}% · ${range(entry.damage)}</dd>
      </div>`;
    return `
      <div class="target-head">
        ${spriteMarkup}
        <div class="target-title">
          <span class="target-rank ${rankClass}">${intel.rank}${nearest ? " · nearest" : ""}</span>
          <strong>${intel.name}</strong>
          <span class="muted">${intel.distance} tile${intel.distance === 1 ? "" : "s"} away</span>
        </div>
      </div>
      <div class="target-hp" data-tooltip="${escapeTooltip(`${intel.name}\n${intel.hp} of ${intel.maxHp} HP left.`)}">
        <div class="meter"><div class="meter-fill hp" style="width:${hpPct}%"></div></div>
        <span>${intel.hp}/${intel.maxHp}</span>
      </div>
      <p class="target-behavior">${intel.behavior}</p>
      <dl class="target-stats">
        <div class="target-stats-head" aria-hidden="true"><dt></dt><dd>hit · dmg</dd></div>
        <div class="threat" data-tooltip="${escapeTooltip(`Its attacks\nChance to hit you and damage after your defense.\nReach: ${intel.threat.range} tile${intel.threat.range === 1 ? "" : "s"}.`)}">
          <dt>Hits you</dt><dd>${intel.threat.hitChance}% · ${range(intel.threat.damage)}</dd>
        </div>
        ${attackRow(intel.attack.label, intel.attack, "Your weapon\nChance to hit and damage after its defense (before crits).")}
        ${intel.spell ? attackRow(intel.spell.label, intel.spell, "Your spell\nChance to hit and damage after its defense (before crits).") : ""}
        <div data-tooltip="${escapeTooltip("Defenses\nDefense is subtracted from your damage.\nEvasion lowers your chance to hit.")}">
          <dt>Defense</dt><dd>DEF ${intel.defense} · EVA ${intel.evasion}</dd>
        </div>
      </dl>
      ${renderOptionalStatusBadges(intel.statuses)}
    `;
  }

  // Rebuilt only when the log or filter changes, so the player can scroll back through history.
  // Lines from before the latest action are dimmed; it sticks to the bottom unless scrolled up.
  renderLog() {
    const { logs, run } = this.game.state;
    const currentTurn = run?.turn ?? 0;
    const key = `${logs.length}|${logText(logs[logs.length - 1])}|${currentTurn}|${this.logFilter}`;
    if (key === this.logKey) return;
    this.logKey = key;
    for (const chip of document.querySelectorAll("[data-log-filter]")) {
      chip.classList.toggle("active", chip.dataset.logFilter === this.logFilter);
      chip.setAttribute("aria-pressed", String(chip.dataset.logFilter === this.logFilter));
    }
    const kinds = LOG_FILTERS[this.logFilter]?.kinds ?? null;
    const log = this.logElement;
    const pinnedToBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
    const lines = mergeLogEntries(logs)
      .filter((entry) => !kinds || kinds.includes(entry.kind))
      .map((entry) => {
        const fresh = entry.turn >= currentTurn - 1;
        const count = entry.count > 1 ? ` <span class="log-count">&times;${entry.count}</span>` : "";
        return `<div class="log-line log-${entry.kind}${fresh ? "" : " log-old"}">${entry.text}${count}</div>`;
      });
    log.innerHTML = lines.join("") || `<div class="log-line log-old">Nothing yet.</div>`;
    if (pinnedToBottom) log.scrollTop = log.scrollHeight;
  }

  renderOverlay() {
    const { overlay } = this.game.state.ui;
    if (!overlay) {
      this.overlay.classList.add("hidden");
      this.lastOverlaySignature = null;
      this.lastOverlayType = null;
      this.pendingOverlayFocus = null;
      return;
    }

    this.overlay.classList.remove("hidden");
    const closeButton = document.getElementById("overlay-close-button");
    if (closeButton) {
      closeButton.disabled = overlay.dismissible === false;
      closeButton.classList.toggle("hidden", overlay.dismissible === false);
    }
    const signature = `${overlay.type ?? "overlay"}::${overlay.title}::${overlay.html}`;
    if (this.lastOverlaySignature !== signature) {
      const wasOpenType = this.lastOverlayType;
      this.overlayTitle.textContent = overlay.title;
      this.overlayContent.innerHTML = overlay.html;
      // A variant restyles the whole overlay (e.g. the full-screen death and victory cards).
      this.overlay.className = `overlay overlay--${overlay.type ?? "panel"} ${overlay.variant ?? ""}`.trim();
      if (overlay.type === "map") this.drawFullMap();
      this.lastOverlaySignature = signature;
      this.lastOverlayType = overlay.type;
      this.restoreOverlayFocus(wasOpenType !== overlay.type);
    }
  }

  // After the overlay HTML is replaced, put focus back on the control the player was using
  // (so arrow-key navigation survives re-renders), or on a sensible default when it first opens.
  restoreOverlayFocus(justOpened) {
    const content = this.overlayContent;
    const pending = this.pendingOverlayFocus;
    this.pendingOverlayFocus = null;
    let target = null;
    if (pending) {
      // pending is the used button's dataset; find the redrawn button with the same data.
      target = [...content.querySelectorAll(`[data-action="${pending.action}"]`)]
        .find((element) => Object.entries(pending).every(([key, value]) => key === "tooltip" || element.dataset[key] === value)) ?? null;
    }
    // A confirm prompt that just appeared takes focus, so Enter answers it.
    const confirmButton = content.querySelector('[data-action="vendor-sell-confirm"], [data-action="vendor-sell-junk-confirm"]');
    if (confirmButton && pending?.action !== confirmButton.dataset.action) target = confirmButton;
    if (!target && (pending || justOpened)) {
      // Checked in priority order (a single selector list would just return the first in page order).
      const fallbacks = [".inventory-tile.selected", ".equip-slot.selected", ".skill-card.available button", "input:not([disabled])", "button:not([disabled])"];
      for (const selector of fallbacks) {
        target = content.querySelector(selector);
        if (target) break;
      }
    }
    target?.focus({ preventScroll: false });
  }

  renderNpcDialog() {
    const { ui } = this.game.state;
    if (!this.npcDialog) return;
    // When a line expires, the next queued line from the same conversation takes its place.
    if (ui.npcDialog && Date.now() > ui.npcDialog.until && ui.npcDialogQueue?.length) {
      const next = ui.npcDialogQueue.shift();
      ui.npcDialog = { speaker: next.speaker, text: next.text, until: Date.now() + next.duration };
    }
    const dialog = ui.npcDialog;
    if (!dialog || Date.now() > dialog.until) {
      if (dialog && Date.now() > dialog.until) {
        ui.npcDialog = null;
      }
      this.npcDialog.classList.add("hidden");
      return;
    }
    // No speaker means narration: no name plate, set in italics.
    this.npcDialogSpeaker.textContent = dialog.speaker ?? "";
    this.npcDialogSpeaker.classList.toggle("hidden", !dialog.speaker);
    this.npcDialog.classList.toggle("narration", !dialog.speaker);
    this.npcDialogText.textContent = dialog.text;
    this.npcDialog.classList.remove("hidden");
  }

  triggerFlash(variant = "critical") {
    if (!this.criticalFlash) return;
    this.criticalFlash.classList.remove(...FLASH_VARIANTS);
    this.criticalFlash.classList.add(variant);
    this.criticalFlash.classList.remove("hidden");
    this.criticalFlash.classList.remove("active");
    void this.criticalFlash.offsetWidth;
    this.criticalFlash.classList.add("active");
    window.setTimeout(() => {
      this.criticalFlash?.classList.remove("active");
      this.criticalFlash?.classList.remove(...FLASH_VARIANTS);
      this.criticalFlash?.classList.add("hidden");
    }, 380);
  }

  triggerCriticalFlash() {
    this.triggerFlash("critical");
  }

  triggerNecroFlash() {
    this.triggerFlash("necro");
  }

  triggerSlamFlash() {
    this.triggerFlash("slam");
  }
}
