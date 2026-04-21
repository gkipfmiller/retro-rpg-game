import { ENEMIES, ITEMS, TRAPS } from "./data.js";

const BASE = "./RPG Art Assets/frames";
const EXTRACTED = "./RPG Art Assets/extracted";

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

function frameSet(prefix, count = 4) {
  return Array.from({ length: count }, (_, index) => `${BASE}/${prefix}${index}.png`);
}

const assetManifest = {
  floorTiles: FLOOR_FRAMES.map((file) => `${BASE}/${file}`),
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
  actors: {
    warrior: frameSet("knight_m_idle_anim_f"),
    wizard: frameSet("wizzard_m_idle_anim_f"),
    sage: frameSet("wizzard_m_idle_anim_f"),
    rat: frameSet("tiny_slug_anim_f"),
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
    void_stalker: frameSet("lizard_m_run_anim_f"),
    doom_ogre: frameSet("ogre_run_anim_f"),
    abyssal_overlord: frameSet("big_demon_run_anim_f"),
    bone_captain: frameSet("necromancer_anim_f"),
    patches: frameSet("big_zombie_run_anim_f"),
    vendor: frameSet("dwarf_m_idle_anim_f"),
  },
  items: {
    rusty_sword: `${BASE}/weapon_rusty_sword.png`,
    militia_sword: `${BASE}/weapon_regular_sword.png`,
    woodcutter_axe: `${BASE}/weapon_axe.png`,
    iron_sword: `${BASE}/weapon_regular_sword.png`,
    raider_axe: `${BASE}/weapon_axe.png`,
    legion_spear: `${BASE}/weapon_spear.png`,
    butcher_cleaver: `${BASE}/weapon_cleaver.png`,
    flame_touched_sword: `${BASE}/weapon_red_gem_sword.png`,
    vampire_axe: `${BASE}/weapon_waraxe.png`,
    steel_greatsword: `${BASE}/weapon_lavish_sword.png`,
    war_hammer: `${BASE}/weapon_big_hammer.png`,
    sundering_hammer: `${BASE}/weapon_hammer.png`,
    sunfire_blade: `${BASE}/weapon_lavish_sword.png`,
    soulreaver_axe: `${BASE}/weapon_waraxe.png`,
    captains_blade: `${BASE}/weapon_knight_sword.png`,
    apprentice_staff: `${BASE}/weapon_green_magic_staff.png`,
    hedge_wand: `${BASE}/weapon_red_magic_staff.png`,
    ash_staff: `${BASE}/weapon_green_magic_staff.png`,
    oak_staff: `${BASE}/weapon_green_magic_staff.png`,
    crystal_wand: `${BASE}/weapon_red_magic_staff.png`,
    ember_rod: `${BASE}/weapon_red_magic_staff.png`,
    moon_staff: `${BASE}/weapon_green_magic_staff.png`,
    runic_staff: `${BASE}/weapon_green_magic_staff.png`,
    elder_staff: `${BASE}/weapon_green_magic_staff.png`,
    sage_wand: `${BASE}/weapon_red_magic_staff.png`,
    storm_wand: `${BASE}/weapon_red_magic_staff.png`,
    voidglass_staff: `${BASE}/weapon_green_magic_staff.png`,
    astral_wand: `${BASE}/weapon_red_magic_staff.png`,
    ember_staff: `${BASE}/weapon_red_magic_staff.png`,
    padded_jerkin: `${EXTRACTED}/armor_leather.png`,
    leather_armor: `${EXTRACTED}/armor_leather.png`,
    scout_leathers: `${EXTRACTED}/armor_leather.png`,
    iron_cuirass: `${EXTRACTED}/armor_mail.png`,
    chain_armor: `${EXTRACTED}/armor_mail.png`,
    bastion_mail: `${EXTRACTED}/armor_mail.png`,
    guardian_plate: `${EXTRACTED}/armor_plate.png`,
    emberguard_cuirass: `${EXTRACTED}/armor_plate.png`,
    vanguard_warplate: `${EXTRACTED}/armor_plate.png`,
    abyssal_plate: `${EXTRACTED}/armor_plate.png`,
    bulwark_armor: `${EXTRACTED}/armor_plate.png`,
    cloth_robe: `${EXTRACTED}/robe_plain.png`,
    apprentice_robes: `${EXTRACTED}/robe_apprentice.png`,
    dusk_robe: `${EXTRACTED}/robe_dusk.png`,
    enchanted_robe: `${EXTRACTED}/robe_enchanted.png`,
    runespun_robe: `${EXTRACTED}/robe_runespun.png`,
    archmage_robe: `${EXTRACTED}/robe_spellweave.png`,
    spellweave_mantle: `${EXTRACTED}/robe_spellweave.png`,
    hexwoven_robe: `${EXTRACTED}/robe_hexwoven.png`,
    starweave_robe: `${EXTRACTED}/robe_starweave.png`,
    robe_of_the_adept: `${EXTRACTED}/robe_adept.png`,
    gauntlets_of_rime: `${EXTRACTED}/hands_rime.png`,
    hexward_gloves: `${EXTRACTED}/hands_hexward.png`,
    gravedust_mitts: `${EXTRACTED}/hands_gravedust.png`,
    runed_handwraps: `${EXTRACTED}/hands_runed.png`,
    sundergrip_gauntlets: `${EXTRACTED}/hands_sundergrip.png`,
    spellcatcher_gloves: `${EXTRACTED}/hands_spellcatcher.png`,
    cinderwraps: `${EXTRACTED}/hands_cinder.png`,
    wardens_grips: `${EXTRACTED}/hands_warden.png`,
    ring_of_precision: `${EXTRACTED}/ring_red.png`,
    ring_of_resolve: `${EXTRACTED}/ring_green.png`,
    amulet_of_vitality: `${EXTRACTED}/amulet_green.png`,
    seal_of_clarity: `${EXTRACTED}/ring_blue.png`,
    charm_of_focus: `${EXTRACTED}/amulet_focus.png`,
    wardens_loop: `${EXTRACTED}/ring_dark.png`,
    spark_charm: `${EXTRACTED}/amulet_spark.png`,
    sigil_of_fortune: `${EXTRACTED}/ring_gold.png`,
    talisman_of_vigor: `${EXTRACTED}/amulet_pink.png`,
    arcseal_pendant: `${EXTRACTED}/amulet_dark.png`,
    warbrand_token: `${EXTRACTED}/ring_orange.png`,
    mirror_sigil: `${EXTRACTED}/ring_white.png`,
    charm_of_guarding: `${EXTRACTED}/amulet_white.png`,
    chain_of_insight: `${EXTRACTED}/amulet_chain.png`,
    void_heart: `${EXTRACTED}/amulet_skull.png`,
    healing_potion: `${BASE}/flask_red.png`,
    greater_healing_potion: `${BASE}/flask_big_red.png`,
    mana_potion: `${BASE}/flask_blue.png`,
    greater_mana_potion: `${BASE}/flask_big_blue.png`,
    scroll_of_escape: `${EXTRACTED}/scroll_purple.png`,
    crypt_vault_key: `${EXTRACTED}/amulet_darkgem.png`,
    sunken_vault_key: `${EXTRACTED}/amulet_white.png`,
    void_vault_key: `${EXTRACTED}/amulet_crimson.png`,
    magic_missile_tome: `${EXTRACTED}/tome_red.png`,
    arcane_shield_tome: `${EXTRACTED}/tome_grey.png`,
    frost_shard_tome: `${EXTRACTED}/tome_grey.png`,
    blink_tome: `${EXTRACTED}/tome_red.png`,
    arcane_burst_tome: `${EXTRACTED}/tome_gold.png`,
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
  collectPaths(assetManifest.walls);
  collectPaths(assetManifest.stairs);
  collectPaths(assetManifest.ladder);
  collectPaths(assetManifest.chestClosed);
  collectPaths(assetManifest.chestOpen);
  collectPaths(assetManifest.coin);
  collectPaths(assetManifest.hearts);
  collectPaths(assetManifest.traps);
  collectPaths(assetManifest.actors);
  collectPaths(assetManifest.items);

  const loaded = await Promise.all([...paths].map(createImage));
  const images = Object.fromEntries(loaded.map(({ path, image }) => [path, image]));

  return {
    manifest: assetManifest,
    images,
  };
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

export function getFloorSprite(manifest, x, y) {
  const tiles = manifest.floorTiles;
  return tiles[(x + y) % tiles.length];
}

export function getWallSprite(manifest, map, x, y, options = {}) {
  const { useExploredMask = false } = options;
  const getTile = (tx, ty) => map[ty]?.[tx] ?? null;
  const isVisibleWall = (tx, ty) => {
    const tile = getTile(tx, ty);
    if (!tile || tile.type !== "wall") return false;
    if (!useExploredMask) return true;
    return tile.explored || tile.visible;
  };
  const isFloor = (tx, ty) => getTile(tx, ty)?.type === "floor";

  const northWall = isVisibleWall(x, y - 1);
  const southWall = isVisibleWall(x, y + 1);
  const westWall = isVisibleWall(x - 1, y);
  const eastWall = isVisibleWall(x + 1, y);
  const northFloor = isFloor(x, y - 1);
  const southFloor = isFloor(x, y + 1);
  const westFloor = isFloor(x - 1, y);
  const eastFloor = isFloor(x + 1, y);

  if (southFloor) {
    if (westFloor && !eastFloor) return manifest.walls.topRight;
    if (eastFloor && !westFloor) return manifest.walls.topLeft;
    if (westFloor && eastFloor) return manifest.walls.top;
    if (!westWall && eastWall) return manifest.walls.topLeft;
    if (!eastWall && westWall) return manifest.walls.topRight;
    return manifest.walls.top;
  }

  if (eastFloor && !westFloor) {
    return southWall ? manifest.walls.left : manifest.walls.outerLeft;
  }
  if (westFloor && !eastFloor) {
    return southWall ? manifest.walls.right : manifest.walls.outerRight;
  }

  if (!southWall && westWall && !eastWall) return manifest.walls.edgeBottomRight;
  if (!southWall && eastWall && !westWall) return manifest.walls.edgeBottomLeft;
  if (!northWall && !westWall && eastWall) return manifest.walls.edgeTopLeft;
  if (!northWall && !eastWall && westWall) return manifest.walls.edgeTopRight;
  if (!northWall && !westWall && !eastWall) return manifest.walls.top;
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
