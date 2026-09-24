import { ENEMIES, ITEMS, TRAPS } from "./data.js";

const BASE = "./RPG Art Assets/frames";
const EXTRACTED = "./RPG Art Assets/extracted";
const SEWER = "./RPG Art Assets/0x72_DungeonTilesetII_sewers_v0.3";

const FLOOR_FRAMES = [
  "floor_1.png",
  "floor_2.png",
  "floor_3.png",
  "floor_4.png",
  "floor_5.png",
  "floor_6.png",
  "floor_7.png",
  "floor_8.png",
];

const UNDEADS = "./RPG Art Assets/Assets/Undeads";

function frameSet(prefix, count = 4) {
  return Array.from({ length: count }, (_, index) => `${BASE}/${prefix}${index}.png`);
}

// Frame sets whose files are numbered from 1 instead of 0.
function frameSetFrom1(prefix, count) {
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}.png`);
}

// Actors built by palette-swapping another actor's frames once at load time.
// Palette fields: hue (0-1, replaces hue of saturated pixels), hueShift, satMul, valMul, minSat.
const ACTOR_RECOLORS = {
  bone_captain: { source: frameSet("necromancer_anim_f"), palette: { hue: 0.12, satMul: 0.35, valMul: 1.25 } },
  vendor_void_huckster: { source: frameSet("lizard_f_idle_anim_f"), palette: { hue: 0.75, valMul: 0.85 } },
  vendor_ember_factor: { source: frameSet("dwarf_m_idle_anim_f"), palette: { hueShift: 0.93, satMul: 1.2 } },
};

// Elites get a blood-red palette; enemies that are already red get gold instead so the swap still reads.
const ELITE_PALETTE = { hue: 0, satMul: 1.2 };
const ELITE_PALETTE_FOR_RED = { hue: 0.12, satMul: 1.2 };
const NO_ELITE_VARIANT = new Set(["mimic"]);
// Maroon sprites that miss the automatic red check but still need the gold elite palette.
const FORCE_GOLD_ELITE = new Set(["sewer_bat"]);

const assetManifest = {
  floorTiles: FLOOR_FRAMES.map((file) => `${BASE}/${file}`),
  themeAtlases: {
    sunkenVaultFloor: `${SEWER}/floor.png`,
    sunkenVaultWalls: `${SEWER}/atlas_walls_low-16x16.png`,
  },
  walls: {
    center: `${BASE}/wall_mid.png`,
    top: `${BASE}/wall_top_mid.png`,
    left: `${BASE}/wall_left.png`,
    right: `${BASE}/wall_right.png`,
    topLeft: `${BASE}/wall_top_left.png`,
    topRight: `${BASE}/wall_top_right.png`,
    edgeLeft: `${BASE}/wall_edge_left.png`,
    edgeRight: `${BASE}/wall_edge_right.png`,
    edgeTopLeft: `${BASE}/wall_edge_top_left.png`,
    edgeTopRight: `${BASE}/wall_edge_top_right.png`,
    edgeBottomLeft: `${BASE}/wall_edge_bottom_left.png`,
    edgeBottomRight: `${BASE}/wall_edge_bottom_right.png`,
    outerLeft: `${BASE}/wall_outer_mid_left.png`,
    outerRight: `${BASE}/wall_outer_mid_right.png`,
    outerTopLeft: `${BASE}/wall_outer_top_left.png`,
    outerTopRight: `${BASE}/wall_outer_top_right.png`,
  },
  stairs: `${BASE}/floor_stairs.png`,
  ladder: `${BASE}/floor_ladder.png`,
  chestClosed: `${BASE}/chest_empty_open_anim_f0.png`,
  chestOpen: `${BASE}/chest_full_open_anim_f2.png`,
  coin: `${BASE}/coin_anim_f2.png`,
  hearts: {
    full: `${BASE}/ui_heart_full.png`,
    half: `${BASE}/ui_heart_half.png`,
    empty: `${BASE}/ui_heart_empty.png`,
  },
  traps: {
    spikes: `${BASE}/floor_spikes_anim_f3.png`,
    darts: `${BASE}/bomb_f2.png`,
    fire: `${BASE}/bomb_f0.png`,
    curse: `${BASE}/skull.png`,
    alarm: `${BASE}/lever_right.png`,
  },
  shrine: `${BASE}/wall_fountain_basin_blue_anim_f1.png`,
  props: {
    wallGoo: `${BASE}/wall_goo.png`,
    floorGoo: `${BASE}/wall_goo_base.png`,
    floorHole: `${BASE}/hole.png`,
    floorColumn: `${BASE}/column.png`,
    wallHoles: [`${BASE}/wall_hole_1.png`, `${BASE}/wall_hole_2.png`],
    columnWall: `${BASE}/column_wall.png`,
    banners: {
      blue: `${BASE}/wall_banner_blue.png`,
      green: `${BASE}/wall_banner_green.png`,
      red: `${BASE}/wall_banner_red.png`,
      yellow: `${BASE}/wall_banner_yellow.png`,
    },
    shrineBlueTop: `${BASE}/wall_fountain_top_2.png`,
    shrineBlueMid: `${BASE}/wall_fountain_mid_blue_anim_f1.png`,
    shrineBlueBasin: `${BASE}/wall_fountain_basin_blue_anim_f1.png`,
    shrineRedTop: `${BASE}/wall_fountain_top_1.png`,
    shrineRedMid: `${BASE}/wall_fountain_mid_red_anim_f1.png`,
    shrineRedBasin: `${BASE}/wall_fountain_basin_red_anim_f1.png`,
  },
  actors: {
    warrior: frameSet("knight_m_idle_anim_f"),
    wizard: frameSet("wizzard_f_idle_anim_f"),
    ranger: frameSet("archer_m_idle_anim_f"),
    sage: frameSet("wizzard_m_idle_anim_f"),
    rat: frameSet("tiny_slug_anim_f"), // displayed as "Slug"
    goblin: frameSet("goblin_run_anim_f"),
    slime: frameSet("swampy_anim_f"),
    skeleton: frameSet("skelet_run_anim_f"),
    cultist: frameSet("necromancer_anim_f"),
    orc_brute: frameSet("orc_warrior_run_anim_f"),
    gloomblade: frameSet("masked_orc_run_anim_f"),
    dread_slime: frameSet("muddy_anim_f"),
    shaman: frameSet("orc_shaman_run_anim_f"),
    chort: frameSet("chort_run_anim_f"),
    infernal_imp: frameSet("imp_run_anim_f"),
    void_stalker: frameSet("wogol_run_anim_f"),
    doom_ogre: frameSet("ogre_run_anim_f"),
    abyssal_overlord: frameSet("big_demon_run_anim_f"),
    bone_captain: frameSet("necromancer_anim_f"), // replaced by the ACTOR_RECOLORS variant at load
    patches: frameSet("big_zombie_run_anim_f"),
    vendor: frameSet("dwarf_m_idle_anim_f"),
    vendor_wary_peddler: frameSet("dwarf_m_idle_anim_f"),
    vendor_roadside_chapman: frameSet("dwarf_f_idle_anim_f"),
    vendor_lantern_trader: frameSet("elf_m_idle_anim_f"),
    vendor_ragpicker_broker: frameSet("lizard_f_idle_anim_f"),
    vendor_tunnel_apothecary: frameSet("doc_idle_anim_f"),
    vendor_grave_merchant: frameSet("elf_f_idle_anim_f"),
    vendor_ash_dealer: frameSet("knight_f_idle_anim_f"),
    mimic: frameSet("chest_mimic_open_anim_f", 3),
    angel: frameSet("angel_idle_anim_f"),
    ice_zombie: frameSet("ice_zombie_anim_f"),
    pumpkin_golem: frameSet("pumpkin_dude_idle_anim_f"),
    cursed_pumpkin: frameSetFrom1(`${UNDEADS}/Zombie/zombie_run_anim/zombie_run_anim_f`, 4), // displayed as "Grave Husk"
    sewer_bat: frameSetFrom1(`${SEWER}/frames/bat_f`, 4),
    sludge_crawler: frameSetFrom1(`${SEWER}/frames/slugbot_walk_f`, 8),
    drain_tentacle: frameSetFrom1(`${SEWER}/frames/tentacle-f`, 8),
  },
  items: {
    rusty_sword: `${BASE}/weapon_rusty_sword.png`,
    militia_sword: `${BASE}/weapon_katana.png`,
    woodcutter_axe: `${BASE}/weapon_axe.png`,
    iron_sword: `${BASE}/weapon_regular_sword.png`,
    raider_axe: `${BASE}/weapon_throwing_axe.png`,
    legion_spear: `${BASE}/weapon_spear.png`,
    butcher_cleaver: `${BASE}/weapon_cleaver.png`,
    flame_touched_sword: `${BASE}/weapon_red_gem_sword.png`,
    vampire_axe: `${BASE}/weapon_double_axe.png`,
    steel_greatsword: `${BASE}/weapon_knight_sword.png`,
    war_hammer: `${BASE}/weapon_big_hammer.png`,
    sundering_hammer: `${BASE}/weapon_hammer.png`,
    sunfire_blade: `${BASE}/weapon_lavish_sword.png`,
    soulreaver_axe: `${BASE}/weapon_waraxe.png`,
    captains_blade: `${BASE}/weapon_golden_sword.png`,
    apprentice_staff: `${EXTRACTED}/staff_apprentice.png`,
    hedge_wand: `${EXTRACTED}/wand_hedge.png`,
    ash_staff: `${EXTRACTED}/staff_ash.png`,
    oak_staff: `${EXTRACTED}/staff_oak.png`,
    crystal_wand: `${EXTRACTED}/wand_crystal.png`,
    ember_rod: `${EXTRACTED}/rod_ember.png`,
    moon_staff: `${EXTRACTED}/staff_moon.png`,
    runic_staff: `${EXTRACTED}/staff_runic.png`,
    elder_staff: `${EXTRACTED}/staff_elder.png`,
    sage_wand: `${EXTRACTED}/wand_sage.png`,
    storm_wand: `${EXTRACTED}/wand_storm.png`,
    voidglass_staff: `${EXTRACTED}/staff_voidglass.png`,
    astral_wand: `${EXTRACTED}/wand_astral.png`,
    ember_staff: `${EXTRACTED}/staff_ember.png`,
    short_bow: `${EXTRACTED}/bow_short.png`,
    hunting_bow: `${EXTRACTED}/bow_hunting.png`,
    longbow: `${EXTRACTED}/bow_long.png`,
    composite_bow: `${EXTRACTED}/bow_composite.png`,
    recurve_bow: `${EXTRACTED}/bow_recurve.png`,
    venomstrike_bow: `${EXTRACTED}/bow_venomstrike.png`,
    galeforce_bow: `${EXTRACTED}/bow_galeforce.png`,
    voidpiercer_bow: `${EXTRACTED}/bow_voidpiercer.png`,
    stormstring_bow: `${EXTRACTED}/bow_stormstring.png`,
    hawk_bow: `${EXTRACTED}/bow_hawk.png`,
    padded_jerkin: `${EXTRACTED}/armor_padded_jerkin.png`,
    leather_armor: `${EXTRACTED}/armor_leather_vest.png`,
    scout_leathers: `${EXTRACTED}/armor_scout.png`,
    iron_cuirass: `${EXTRACTED}/armor_iron_cuirass.png`,
    chain_armor: `${EXTRACTED}/armor_chain.png`,
    bastion_mail: `${EXTRACTED}/armor_bastion.png`,
    guardian_plate: `${EXTRACTED}/armor_guardian.png`,
    emberguard_cuirass: `${EXTRACTED}/armor_emberguard.png`,
    vanguard_warplate: `${EXTRACTED}/armor_vanguard.png`,
    abyssal_plate: `${EXTRACTED}/armor_abyssal.png`,
    bulwark_armor: `${EXTRACTED}/armor_bulwark.png`,
    cloth_robe: `${EXTRACTED}/robe_plain.png`,
    apprentice_robes: `${EXTRACTED}/robe_apprentice.png`,
    dusk_robe: `${EXTRACTED}/robe_dusk.png`,
    enchanted_robe: `${EXTRACTED}/robe_enchanted.png`,
    runespun_robe: `${EXTRACTED}/robe_runespun.png`,
    archmage_robe: `${EXTRACTED}/robe_archmage.png`,
    spellweave_mantle: `${EXTRACTED}/robe_spellweave.png`,
    hexwoven_robe: `${EXTRACTED}/robe_hexwoven.png`,
    starweave_robe: `${EXTRACTED}/robe_starweave.png`,
    robe_of_the_adept: `${EXTRACTED}/robe_adept.png`,
    trackers_vest: `${EXTRACTED}/hood_tracker.png`,
    stalkers_hide: `${EXTRACTED}/hood_stalker.png`,
    windrunner_coat: `${EXTRACTED}/hood_windrunner.png`,
    shadowstep_mantle: `${EXTRACTED}/hood_shadowstep.png`,
    voidhide_armor: `${EXTRACTED}/armor_voidhide.png`,
    gauntlets_of_rime: `${EXTRACTED}/hands_rime.png`,
    hexward_gloves: `${EXTRACTED}/hands_hexward.png`,
    gravedust_mitts: `${EXTRACTED}/hands_gravedust.png`,
    runed_handwraps: `${EXTRACTED}/hands_runed.png`,
    sundergrip_gauntlets: `${EXTRACTED}/hands_sundergrip.png`,
    spellcatcher_gloves: `${EXTRACTED}/hands_spellcatcher.png`,
    cinderwraps: `${EXTRACTED}/hands_cinder.png`,
    wardens_grips: `${EXTRACTED}/hands_warden.png`,
    marksmans_bracers: `${EXTRACTED}/hands_marksman.png`,
    windgrip_gloves: `${EXTRACTED}/hands_windgrip.png`,
    ring_of_precision: `${EXTRACTED}/ring_red.png`,
    ring_of_resolve: `${EXTRACTED}/ring_green.png`,
    amulet_of_vitality: `${EXTRACTED}/amulet_green.png`,
    seal_of_clarity: `${EXTRACTED}/ring_blue.png`,
    charm_of_focus: `${EXTRACTED}/amulet_focus.png`,
    wardens_loop: `${EXTRACTED}/ring_warden.png`,
    spark_charm: `${EXTRACTED}/amulet_spark.png`,
    sigil_of_fortune: `${EXTRACTED}/ring_gold.png`,
    talisman_of_vigor: `${EXTRACTED}/amulet_pink.png`,
    arcseal_pendant: `${EXTRACTED}/amulet_arcseal.png`,
    warbrand_token: `${EXTRACTED}/ring_warbrand.png`,
    mirror_sigil: `${EXTRACTED}/ring_mirror.png`,
    charm_of_guarding: `${EXTRACTED}/amulet_white.png`,
    chain_of_insight: `${EXTRACTED}/amulet_chain.png`,
    void_heart: `${EXTRACTED}/amulet_skull.png`,
    healing_potion: `${BASE}/flask_red.png`,
    greater_healing_potion: `${BASE}/flask_big_red.png`,
    mana_potion: `${BASE}/flask_blue.png`,
    greater_mana_potion: `${BASE}/flask_big_blue.png`,
    scroll_of_escape: `${EXTRACTED}/scroll_escape_real.png`,
    crypt_vault_key: `${EXTRACTED}/key_crypt.png`,
    sunken_vault_key: `${EXTRACTED}/key_sunken.png`,
    void_vault_key: `${EXTRACTED}/key_void.png`,
    magic_missile_tome: `${EXTRACTED}/tome_arcane_violet.png`,
    arcane_shield_tome: `${EXTRACTED}/tome_ward_teal.png`,
    frost_shard_tome: `${EXTRACTED}/tome_frost_blue.png`,
    blink_tome: `${EXTRACTED}/tome_void_cyan.png`,
    chain_bolt_tome: `${EXTRACTED}/tome_storm_yellow.png`,
    arcane_pulse_tome: `${EXTRACTED}/tome_pulse_magenta.png`,
    ice_shatter_tome: `${EXTRACTED}/tome_deep_frost.png`,
    frailty_hex_tome: `${EXTRACTED}/tome_hex_green.png`,
    arcane_burst_tome: `${EXTRACTED}/tome_burst_orange.png`,
  },
};

function createImage(path) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ path, image });
    image.onerror = () => resolve({ path, image: null });
    image.src = path;
  });
}

export async function loadAssets() {
  const paths = new Set();
  const addPath = (path) => {
    if (path) paths.add(path);
  };

  const collectPaths = (value) => {
    if (!value) return;
    if (typeof value === "string") {
      addPath(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collectPaths);
      return;
    }
    Object.values(value).forEach(collectPaths);
  };

  collectPaths(assetManifest.floorTiles);
  collectPaths(assetManifest.themeAtlases);
  collectPaths(assetManifest.walls);
  collectPaths(assetManifest.stairs);
  collectPaths(assetManifest.ladder);
  collectPaths(assetManifest.chestClosed);
  collectPaths(assetManifest.chestOpen);
  collectPaths(assetManifest.coin);
  collectPaths(assetManifest.hearts);
  collectPaths(assetManifest.traps);
  collectPaths(assetManifest.props);
  collectPaths(assetManifest.actors);
  collectPaths(assetManifest.items);
  Object.values(ACTOR_RECOLORS).forEach((entry) => collectPaths(entry.source));

  const loaded = await Promise.all([...paths].map(createImage));
  const images = Object.fromEntries(loaded.map(({ path, image }) => [path, image]));

  await buildRecoloredActors(images);

  return {
    manifest: assetManifest,
    images,
  };
}

function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let hue = 0;
  if (delta) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue /= 6;
    if (hue < 0) hue += 1;
  }
  return [hue, max ? delta / max : 0, max];
}

function hsvToRgb(hue, sat, val) {
  const sector = Math.floor(hue * 6);
  const f = hue * 6 - sector;
  const p = val * (1 - sat);
  const q = val * (1 - f * sat);
  const t = val * (1 - (1 - f) * sat);
  switch (((sector % 6) + 6) % 6) {
    case 0: return [val, t, p];
    case 1: return [q, val, p];
    case 2: return [p, val, t];
    case 3: return [p, q, val];
    case 4: return [t, p, val];
    default: return [val, p, q];
  }
}

function readPixels(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  return { canvas, ctx, data: ctx.getImageData(0, 0, canvas.width, canvas.height) };
}

// Returns true when most saturated pixels are red, so a red elite palette would not stand out.
function isMostlyRed(image) {
  const { data } = readPixels(image);
  let red = 0;
  let saturated = 0;
  for (let index = 0; index < data.data.length; index += 4) {
    if (!data.data[index + 3]) continue;
    const [hue, sat] = rgbToHsv(data.data[index] / 255, data.data[index + 1] / 255, data.data[index + 2] / 255);
    if (sat < 0.25) continue;
    saturated += 1;
    if (hue < 0.05 || hue > 0.93) red += 1;
  }
  return saturated > 0 && red / saturated > 0.4;
}

function recolorImage(image, { hue = null, hueShift = null, satMul = 1, valMul = 1, minSat = 0.25 }) {
  const { canvas, ctx, data } = readPixels(image);
  const pixels = data.data;
  for (let index = 0; index < pixels.length; index += 4) {
    if (!pixels[index + 3]) continue;
    let [h, s, v] = rgbToHsv(pixels[index] / 255, pixels[index + 1] / 255, pixels[index + 2] / 255);
    if (s >= minSat) {
      if (hue !== null) h = hue;
      if (hueShift !== null) h = (h + hueShift) % 1;
      s = Math.min(1, s * satMul);
    }
    v = Math.min(1, v * valMul);
    const [r, g, b] = hsvToRgb(h, s, v);
    pixels[index] = Math.round(r * 255);
    pixels[index + 1] = Math.round(g * 255);
    pixels[index + 2] = Math.round(b * 255);
  }
  ctx.putImageData(data, 0, 0);
  // Data URLs double as image keys, so recolored frames also work in <img> tags (target panel, portraits).
  return canvas.toDataURL();
}

async function recolorFrames(images, framePaths, palette) {
  const keys = [];
  for (const path of framePaths) {
    const source = images[path];
    if (!source) return null;
    const key = recolorImage(source, palette);
    const { image } = await createImage(key);
    images[key] = image;
    keys.push(key);
  }
  return keys;
}

async function buildRecoloredActors(images) {
  for (const [actorId, entry] of Object.entries(ACTOR_RECOLORS)) {
    const frames = await recolorFrames(images, entry.source, entry.palette);
    if (frames) assetManifest.actors[actorId] = frames;
  }
  for (const [enemyId, template] of Object.entries(ENEMIES)) {
    if (template.behavior === "boss" || NO_ELITE_VARIANT.has(enemyId)) continue;
    const framePaths = assetManifest.actors[enemyId];
    const firstFrame = framePaths && images[framePaths[0]];
    if (!firstFrame) continue;
    const palette = FORCE_GOLD_ELITE.has(enemyId) || isMostlyRed(firstFrame) ? ELITE_PALETTE_FOR_RED : ELITE_PALETTE;
    const frames = await recolorFrames(images, framePaths, palette);
    if (frames) assetManifest.actors[`${enemyId}__elite`] = frames;
  }
}

export function getEnemySpriteId(manifest, enemy) {
  if (!enemy?.templateId) return null;
  const eliteId = `${enemy.templateId}__elite`;
  return enemy.elite && manifest?.actors?.[eliteId] ? eliteId : enemy.templateId;
}

export function getVendorSpriteId(manifest, vendor) {
  const archetypeId = vendor?.archetypeId ? `vendor_${vendor.archetypeId}` : null;
  return archetypeId && manifest?.actors?.[archetypeId] ? archetypeId : "vendor";
}

export function getActorSprite(manifest, actorId) {
  return manifest.actors[actorId] ?? null;
}

export function getItemSprite(manifest, itemId) {
  return manifest.items[itemId] ?? null;
}

export function getTrapSprite(manifest, trapId) {
  return manifest.traps[trapId] ?? null;
}

// Relative weights for floor_1..floor_8: mostly plain stone, light cracks occasionally, heavy breaks rarely.
const FLOOR_TILE_WEIGHTS = [72, 6, 5, 5, 4, 3, 3, 2];
const FLOOR_TILE_WEIGHT_TOTAL = FLOOR_TILE_WEIGHTS.reduce((sum, weight) => sum + weight, 0);

function hashTile(x, y, seed) {
  let hash = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return (hash ^ (hash >>> 16)) >>> 0;
}

// Picks a floor tile from a position hash so tiles scatter naturally instead of forming diagonal stripes.
// The seed makes each floor's layout of cracks different; the result is stable for a given tile.
export function getFloorSprite(manifest, x, y, seed = 0) {
  const tiles = manifest.floorTiles;
  let roll = hashTile(x, y, seed) % FLOOR_TILE_WEIGHT_TOTAL;
  for (let index = 0; index < tiles.length; index += 1) {
    roll -= FLOOR_TILE_WEIGHTS[index] ?? 0;
    if (roll < 0) return tiles[index];
  }
  return tiles[0];
}

export function getWallSprite(manifest, map, x, y, options = {}) {
  const { useExploredMask = false } = options;
  const getTile = (tx, ty) => map[ty]?.[tx] ?? null;
  const isVisibleWall = (tx, ty) => {
    const tile = getTile(tx, ty);
    if (!tile || tile.type !== "wall") return false;
    return true;
  };
  const isFloor = (tx, ty) => {
    const tile = getTile(tx, ty);
    if (!tile || tile.type !== "floor") return false;
    return tile.explored || tile.visible;
  };

  const northWall = isVisibleWall(x, y - 1);
  const southWall = isVisibleWall(x, y + 1);
  const westWall = isVisibleWall(x - 1, y);
  const eastWall = isVisibleWall(x + 1, y);
  const northFloor = isFloor(x, y - 1);
  const southFloor = isFloor(x, y + 1);
  const westFloor = isFloor(x - 1, y);
  const eastFloor = isFloor(x + 1, y);

  if (southFloor) {
    if (westFloor && !eastFloor) return manifest.walls.right;
    if (eastFloor && !westFloor) return manifest.walls.left;
    if (westFloor && eastFloor) return manifest.walls.center;
    if (!westWall && eastWall) return manifest.walls.left;
    if (!eastWall && westWall) return manifest.walls.right;
    return manifest.walls.center;
  }

  if (eastFloor && !westFloor) {
    return southWall ? manifest.walls.left : manifest.walls.outerLeft;
  }
  if (westFloor && !eastFloor) {
    return southWall ? manifest.walls.right : manifest.walls.outerRight;
  }

  if (!southWall && westWall && !eastWall) return manifest.walls.edgeBottomRight;
  if (!southWall && eastWall && !westWall) return manifest.walls.edgeBottomLeft;
  if (!northWall && !westWall && eastWall) return manifest.walls.left;
  if (!northWall && !eastWall && westWall) return manifest.walls.right;
  if (!northWall && !westWall && !eastWall) return manifest.walls.center;
  return manifest.walls.center;
}

export function getActorSpriteFrame(manifest, actorId, frameIndex = 0) {
  const entry = getActorSprite(manifest, actorId);
  if (!entry) return null;
  if (Array.isArray(entry)) {
    return entry[frameIndex % entry.length];
  }
  return entry;
}

export function getEntitySpriteId(entity) {
  if (!entity) return null;
  if (entity.templateId && ENEMIES[entity.templateId]) return entity.templateId;
  return entity.classId ?? null;
}

export function getPickupSpriteId(itemIds) {
  const itemId = itemIds?.[0];
  if (!itemId || !ITEMS[itemId]) return null;
  return itemId;
}

export function getTrapPickupSpriteId(trap) {
  if (!trap || !TRAPS[trap.templateId]) return null;
  return trap.templateId;
}
