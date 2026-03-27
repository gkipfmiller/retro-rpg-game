import { BOSS_REWARDS, CHEST_TABLE, ENEMIES, FINAL_BOSS_REWARDS, FLOOR_CONFIGS, FLOOR_ENCOUNTERS, ITEMS, ROOM_ENCOUNTERS, TRAPS } from "./data.js";
import { createRng, hashSeed, toKey } from "./utils.js";

function makeTile(type = "wall") {
  return {
    type,
    explored: false,
    visible: false,
    trapId: null,
    occupant: null,
    itemIds: [],
    chestId: null,
    vendor: false,
    shrineId: null,
    stairs: false,
  };
}

function createMap(width, height) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => makeTile()));
}

function carveRoom(map, room) {
  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      map[y][x].type = "floor";
    }
  }
}

function carveCorridor(map, start, end) {
  let x = start.x;
  let y = start.y;

  while (x !== end.x) {
    map[y][x].type = "floor";
    x += x < end.x ? 1 : -1;
  }
  while (y !== end.y) {
    map[y][x].type = "floor";
    y += y < end.y ? 1 : -1;
  }
  map[y][x].type = "floor";
}

function overlaps(room, rooms) {
  return rooms.some((other) =>
    room.x <= other.x + other.width &&
    room.x + room.width >= other.x &&
    room.y <= other.y + other.height &&
    room.y + room.height >= other.y
  );
}

function roomCenter(room) {
  return {
    x: Math.floor(room.x + room.width / 2),
    y: Math.floor(room.y + room.height / 2),
  };
}

function inBounds(map, x, y) {
  return y >= 0 && y < map.length && x >= 0 && x < map[0].length;
}

function isWalkable(tile) {
  return tile && tile.type === "floor";
}

function floodFill(map, start) {
  const queue = [start];
  const seen = new Set([toKey(start.x, start.y)]);

  while (queue.length) {
    const current = queue.shift();
    const deltas = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    for (const delta of deltas) {
      const nextX = current.x + delta.x;
      const nextY = current.y + delta.y;
      if (!inBounds(map, nextX, nextY) || !isWalkable(map[nextY][nextX])) {
        continue;
      }
      const key = toKey(nextX, nextY);
      if (!seen.has(key)) {
        seen.add(key);
        queue.push({ x: nextX, y: nextY });
      }
    }
  }

  return seen;
}

function buildRooms(map, rng, config) {
  const rooms = [];
  const roomTarget = rng.int(config.rooms[0], config.rooms[1]);
  let attempts = 0;

  while (rooms.length < roomTarget && attempts < roomTarget * 18) {
    const width = rng.int(5, 8);
    const height = rng.int(5, 7);
    const x = rng.int(1, config.width - width - 2);
    const y = rng.int(1, config.height - height - 2);
    const room = { id: rooms.length, x, y, width, height, center: null, type: "normal" };
    if (!overlaps({ ...room, x: x - 1, y: y - 1, width: width + 2, height: height + 2 }, rooms)) {
      room.center = roomCenter(room);
      rooms.push(room);
      carveRoom(map, room);
    }
    attempts += 1;
  }

  for (let index = 1; index < rooms.length; index += 1) {
    carveCorridor(map, rooms[index - 1].center, rooms[index].center);
  }

  for (let loop = 0; loop < 2; loop += 1) {
    if (rooms.length > 2 && rng.chance(0.45)) {
      const a = rng.pick(rooms);
      const b = rng.pick(rooms.filter((room) => room.id !== a.id));
      carveCorridor(map, a.center, b.center);
    }
  }

  return rooms;
}

function chooseEncounterPool(floorNumber) {
  if (floorNumber <= 2) return FLOOR_ENCOUNTERS.early;
  if (floorNumber <= 4) return [...FLOOR_ENCOUNTERS.early, ...FLOOR_ENCOUNTERS.mid];
  if (floorNumber <= 10) return [...FLOOR_ENCOUNTERS.mid, ...FLOOR_ENCOUNTERS.late];
  if (floorNumber <= 15) return [...FLOOR_ENCOUNTERS.late, ...FLOOR_ENCOUNTERS.deep];
  if (floorNumber <= 20) return [...FLOOR_ENCOUNTERS.deep, ...FLOOR_ENCOUNTERS.abyssal];
  return [...FLOOR_ENCOUNTERS.abyssal, ...FLOOR_ENCOUNTERS.endgame];
}

function getEncounterBand(floorNumber) {
  if (floorNumber <= 10) return "late";
  if (floorNumber <= 15) return "deep";
  if (floorNumber <= 20) return "abyssal";
  return "endgame";
}

function findOpenTilesInRoom(room, map) {
  const positions = [];
  for (let y = room.y + 1; y < room.y + room.height - 1; y += 1) {
    for (let x = room.x + 1; x < room.x + room.width - 1; x += 1) {
      const tile = map[y][x];
      if (tile.type === "floor" && !tile.occupant && !tile.chestId && !tile.vendor && !tile.stairs) {
        positions.push({ x, y });
      }
    }
  }
  return positions;
}

function putItem(map, x, y, itemId) {
  map[y][x].itemIds.push(itemId);
}

function assignRoomTypes(rooms, rng, floorNumber) {
  const candidates = rooms.slice(1, -1);
  if (!candidates.length) return;
  const takeNormalRoom = () => {
    const pool = candidates.filter((room) => room.type === "normal");
    if (!pool.length) return null;
    const picked = rng.pick(pool);
    return picked;
  };

  if (floorNumber >= 4) {
    const treasureRoom = takeNormalRoom();
    if (treasureRoom) treasureRoom.type = "treasure";
  }

  if (floorNumber >= 6) {
    const trapRoom = takeNormalRoom();
    if (trapRoom) trapRoom.type = "trap";
  }

  if (floorNumber >= 7) {
    const eliteChance = floorNumber >= 14 ? 0.6 : 0.35;
    const eliteRoom = takeNormalRoom();
    if (eliteRoom && rng.chance(eliteChance)) eliteRoom.type = "elite";
  }

  if (floorNumber >= 11) {
    const shrineRoom = takeNormalRoom();
    if (shrineRoom && rng.chance(floorNumber >= 16 ? 0.65 : 0.45)) shrineRoom.type = "shrine";
  }

  if (floorNumber >= 16) {
    const extraTrap = takeNormalRoom();
    if (extraTrap && rng.chance(0.4)) extraTrap.type = "trap";
    const extraElite = takeNormalRoom();
    if (extraElite && rng.chance(0.35)) extraElite.type = "elite";
  }
}

function chooseEncounterForRoom(room, rng, floorNumber) {
  const band = getEncounterBand(floorNumber);
  const themedPool = ROOM_ENCOUNTERS[room.type]?.[band];
  if (themedPool?.length) return rng.pick(themedPool);
  return rng.pick(chooseEncounterPool(floorNumber));
}

function spawnEncounter(map, room, rng, floorNumber, state) {
  const encounter = chooseEncounterForRoom(room, rng, floorNumber);
  const openTiles = rng.shuffle(findOpenTilesInRoom(room, map));
  const enemies = [];
  const config = FLOOR_CONFIGS[floorNumber] ?? {};

  for (let index = 0; index < encounter.length && index < openTiles.length; index += 1) {
    const templateId = encounter[index];
    const tile = openTiles[index];
    const template = ENEMIES[templateId];
    const elite = room.type === "elite"
      ? true
      : Boolean(config.eliteChance && floorNumber >= 7 && rng.chance(config.eliteChance * (floorNumber >= 16 ? 0.35 : 0.22)));
    const hp = elite ? Math.floor(template.hp * 1.35) : template.hp;
    const enemy = {
      id: `enemy-${state.enemyId += 1}`,
      templateId,
      name: elite ? `Elite ${template.name}` : template.name,
      x: tile.x,
      y: tile.y,
      hp,
      maxHp: hp,
      alerted: false,
      lastKnownPlayerPosition: null,
      statuses: [],
      elite,
      turnCounter: 0,
      firstSpellUsed: false,
      floorNumber,
    };
    map[tile.y][tile.x].occupant = enemy.id;
    enemies.push(enemy);
  }

  return enemies;
}

function reserveVendorRoom(rooms, rng, floorNumber) {
  if (floorNumber === 1 || floorNumber === 10) return null;
  const config = FLOOR_CONFIGS[floorNumber];
  if (!rng.chance(config.vendorChance ?? 0)) return null;
  const pool = rooms
    .slice(2, Math.max(3, rooms.length - 1))
    .filter((room) => room.type === "normal");
  if (!pool.length) return null;
  const room = rng.pick(pool);
  room.type = "vendor";
  return room;
}

function placeTraps(map, rooms, rng, floorNumber, trapCount) {
  const trapIds = floorNumber >= 13
    ? ["spikes", "darts", "fire", "curse", "alarm"]
    : floorNumber >= 5
      ? ["spikes", "darts", "fire"]
      : floorNumber >= 3
        ? ["spikes", "darts"]
        : ["spikes"];
  const corridorTiles = [];
  const trapRoomTiles = [];

  for (let y = 1; y < map.length - 1; y += 1) {
    for (let x = 1; x < map[0].length - 1; x += 1) {
      const tile = map[y][x];
      if (tile.type !== "floor" || tile.occupant || tile.stairs || tile.vendor || tile.shrineId) continue;
      const room = rooms.find((candidate) => x >= candidate.x && x < candidate.x + candidate.width && y >= candidate.y && y < candidate.y + candidate.height);
      const roomTile = Boolean(room);
      if (!roomTile || rng.chance(0.32)) {
        corridorTiles.push({ x, y });
      }
      if (room?.type === "trap" && rng.chance(0.55)) {
        trapRoomTiles.push({ x, y });
      }
    }
  }

  const traps = [];
  const chosenTiles = [
    ...rng.shuffle(trapRoomTiles).slice(0, Math.max(1, Math.floor(trapCount / 2))),
    ...rng.shuffle(corridorTiles),
  ];
  const uniqueTiles = [];
  const seen = new Set();
  for (const tile of chosenTiles) {
    const key = `${tile.x},${tile.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueTiles.push(tile);
    }
  }

  for (const tile of uniqueTiles.slice(0, trapCount)) {
    const trapId = rng.pick(trapIds);
    map[tile.y][tile.x].trapId = `trap-${tile.x}-${tile.y}`;
    traps.push({
      id: map[tile.y][tile.x].trapId,
      templateId: trapId,
      x: tile.x,
      y: tile.y,
      revealed: false,
    });
  }

  return traps;
}

function getClassLootPools(playerClass, floorNumber) {
  const sharedCommon = ["healing_potion", "mana_potion"];
  const sharedMid = ["greater_healing_potion", "greater_mana_potion", "ring_of_precision", "amulet_of_vitality", "charm_of_focus"];
  const warriorCore = ["iron_sword", "raider_axe", "chain_armor"];
  const wizardCore = ["oak_staff", "crystal_wand", "enchanted_robe"];
  const warriorDeep = ["steel_greatsword", "war_hammer", "flame_touched_sword", "vampire_axe", "sundering_hammer", "guardian_plate", "sigil_of_fortune"];
  const wizardDeep = ["elder_staff", "storm_wand", "runic_staff", "sage_wand", "archmage_robe", "sigil_of_fortune"];
  const warriorEndgame = ["sunfire_blade", "soulreaver_axe", "abyssal_plate", "void_heart"];
  const wizardEndgame = ["voidglass_staff", "astral_wand", "starweave_robe", "void_heart"];
  const warriorTomes = ["arcane_shield_tome"];
  const wizardTomes = ["frost_shard_tome", "blink_tome", "arcane_burst_tome"];

  const classCore = playerClass === "warrior" ? warriorCore : wizardCore;
  const offClassCore = playerClass === "warrior" ? wizardCore : warriorCore;
  const classDeep = playerClass === "warrior" ? warriorDeep : wizardDeep;
  const classEndgame = playerClass === "warrior" ? warriorEndgame : wizardEndgame;
  const classTomes = playerClass === "warrior" ? warriorTomes : wizardTomes;

  return {
    common: [...sharedCommon, ...classCore, ...classTomes],
    extra: floorNumber >= 7 ? [...sharedMid, ...classCore, ...offClassCore.slice(0, 1), ...classTomes] : [],
    deep: floorNumber >= 12 ? [...classDeep, ...classTomes, ...sharedMid.slice(0, 3)] : [],
    endgame: floorNumber >= 21 ? [...classEndgame, ...classDeep.slice(0, 3), ...sharedMid] : [],
  };
}

function placeLoot(map, rooms, rng, floorNumber, playerClass) {
  const chests = [];
  const looseItems = [];
  const lootPools = getClassLootPools(playerClass, floorNumber);
  const treasureRooms = rooms.filter((room) => room.type === "treasure");
  const selectedTreasureRooms = treasureRooms.length
    ? treasureRooms
    : rng.shuffle(rooms.filter((room, index) => index > 1)).slice(0, floorNumber >= 5 ? 2 : 1);

  for (const room of selectedTreasureRooms) {
    const openTiles = findOpenTilesInRoom(room, map);
    const tile = rng.pick(openTiles);
    const chestId = `chest-${room.id}`;
    map[tile.y][tile.x].chestId = chestId;
    chests.push({
      id: chestId,
      x: tile.x,
      y: tile.y,
      opened: false,
      loot: [
        rng.pick([...CHEST_TABLE.common, ...lootPools.common]),
        ...(floorNumber >= 6 && rng.chance(floorNumber >= 11 ? 0.65 : 0.4) ? [rng.pick([...CHEST_TABLE.rare, ...lootPools.extra])] : []),
        ...(floorNumber >= 12 && rng.chance(floorNumber >= 16 ? 0.7 : 0.55) ? [rng.pick([...CHEST_TABLE.deep, ...lootPools.deep])] : []),
        ...(floorNumber >= 21 && rng.chance(0.72) ? [rng.pick([...CHEST_TABLE.endgame, ...lootPools.endgame])] : []),
      ],
      gold: rng.int(10 + floorNumber, floorNumber >= 21 ? 34 + floorNumber * 2 : 24 + floorNumber * 2),
    });
  }

  const floorDrops = rng.int(floorNumber >= 21 ? 4 : floorNumber >= 11 ? 3 : 2, floorNumber >= 21 ? 6 : floorNumber >= 12 ? 5 : floorNumber >= 6 ? 4 : 3);
  const availableRooms = rng.shuffle(rooms.slice(2));

  for (let index = 0; index < floorDrops && index < availableRooms.length; index += 1) {
    const room = availableRooms[index];
    const openTiles = findOpenTilesInRoom(room, map);
    if (!openTiles.length) continue;
    const tile = rng.pick(openTiles);
    const roomPool = room.type === "treasure"
      ? [...lootPools.common, ...lootPools.extra, ...lootPools.deep, ...lootPools.endgame]
      : room.type === "elite"
        ? [...lootPools.extra, ...lootPools.deep, ...lootPools.endgame]
        : floorNumber >= 21
          ? [...lootPools.common, ...lootPools.extra, ...lootPools.deep]
          : [...lootPools.common, ...lootPools.extra];
    const itemId = rng.pick(roomPool);
    putItem(map, tile.x, tile.y, itemId);
    looseItems.push({ x: tile.x, y: tile.y, itemId });
  }

  return { chests, looseItems };
}

function placeVendor(map, room, rng, floorNumber) {
  if (!room) return null;
  const openTiles = findOpenTilesInRoom(room, map);
  if (!openTiles.length) return null;
  const tile = rng.pick(openTiles);
  map[tile.y][tile.x].vendor = true;

  const stockPool = [
    "healing_potion",
    "mana_potion",
    "greater_healing_potion",
    "greater_mana_potion",
    "ring_of_precision",
    "scroll_of_escape",
    "frost_shard_tome",
    "blink_tome",
    "arcane_burst_tome",
    ...(floorNumber >= 21
      ? ["steel_greatsword", "war_hammer", "flame_touched_sword", "vampire_axe", "sundering_hammer", "sunfire_blade", "soulreaver_axe", "elder_staff", "storm_wand", "runic_staff", "sage_wand", "voidglass_staff", "astral_wand", "guardian_plate", "abyssal_plate", "archmage_robe", "starweave_robe", "sigil_of_fortune", "void_heart", "chain_armor", "enchanted_robe", "crystal_wand"]
      : floorNumber >= 11
        ? ["steel_greatsword", "war_hammer", "flame_touched_sword", "vampire_axe", "sundering_hammer", "elder_staff", "storm_wand", "runic_staff", "sage_wand", "guardian_plate", "archmage_robe", "sigil_of_fortune", "chain_armor", "enchanted_robe", "crystal_wand"]
        : ["iron_sword", "raider_axe", "oak_staff"]),
  ];
  return {
    id: `vendor-${floorNumber}`,
    x: tile.x,
    y: tile.y,
    stock: rng.shuffle(stockPool).slice(0, floorNumber >= 21 ? 7 : floorNumber >= 14 ? 6 : 5),
  };
}

function placeShrine(map, rooms, rng, floorNumber) {
  if (floorNumber < 11) return null;
  const room = rooms.find((candidate) => candidate.type === "shrine");
  if (!room) return null;
  const openTiles = findOpenTilesInRoom(room, map);
  if (!openTiles.length) return null;
  const tile = rng.pick(openTiles);
  const shrineId = `shrine-${floorNumber}-${room.id}`;
  map[tile.y][tile.x].shrineId = shrineId;
  return {
    id: shrineId,
    x: tile.x,
    y: tile.y,
    used: false,
    mode: rng.chance(0.5) ? "healing" : "mana",
  };
}

export function generateBossFloor(runSeed, floorNumber, playerClass) {
  const rng = createRng(hashSeed(runSeed, floorNumber, "boss"));
  const width = 34;
  const height = 22;
  const map = createMap(width, height);

  const entry = { id: 0, x: 2, y: 7, width: 7, height: 8, center: { x: 5, y: 11 }, type: "start" };
  const corridor = { id: 1, x: 9, y: 10, width: 7, height: 3, center: { x: 12, y: 11 }, type: "normal" };
  const arena = { id: 2, x: 16, y: 4, width: 14, height: 14, center: { x: 23, y: 11 }, type: "boss" };

  for (const room of [entry, corridor, arena]) {
    carveRoom(map, room);
  }
  carveCorridor(map, entry.center, corridor.center);
  carveCorridor(map, corridor.center, arena.center);

  const spawn = { ...entry.center };
  const exit = { x: 27, y: 11 };
  map[exit.y][exit.x].stairs = true;

  const boss = {
    id: "enemy-boss",
    templateId: "bone_captain",
    name: ENEMIES.bone_captain.name,
    x: arena.center.x,
    y: arena.center.y,
    hp: ENEMIES.bone_captain.hp,
    maxHp: ENEMIES.bone_captain.hp,
    alerted: true,
    lastKnownPlayerPosition: { ...spawn },
    statuses: [],
    elite: false,
    turnCounter: 0,
    summonUsed: false,
  };
  map[boss.y][boss.x].occupant = boss.id;

  const rewardItem = rng.pick([...BOSS_REWARDS[playerClass], ...BOSS_REWARDS.neutral]);
  const chests = [
    {
      id: "boss-reward",
      x: 28,
      y: 11,
      opened: false,
      loot: [rewardItem],
      gold: rng.int(20, 35),
    },
  ];
  map[11][28].chestId = "boss-reward";

  return {
    width,
    height,
    map,
    rooms: [entry, corridor, arena],
    spawn,
    exit,
    enemies: [boss],
    traps: [],
    chests,
    looseItems: [],
    vendor: null,
  };
}

export function generateFinalBossFloor(runSeed, floorNumber, playerClass) {
  const rng = createRng(hashSeed(runSeed, floorNumber, "final-boss"));
  const width = 38;
  const height = 24;
  const map = createMap(width, height);

  const entry = { id: 0, x: 2, y: 8, width: 7, height: 8, center: { x: 5, y: 12 }, type: "start" };
  const antechamber = { id: 1, x: 10, y: 7, width: 9, height: 10, center: { x: 14, y: 12 }, type: "normal" };
  const arena = { id: 2, x: 20, y: 4, width: 15, height: 16, center: { x: 27, y: 12 }, type: "boss" };

  for (const room of [entry, antechamber, arena]) {
    carveRoom(map, room);
  }
  carveCorridor(map, entry.center, antechamber.center);
  carveCorridor(map, antechamber.center, arena.center);

  const spawn = { ...entry.center };
  const exit = { x: 32, y: 12 };
  map[exit.y][exit.x].stairs = true;

  const sentries = [
    {
      id: "enemy-final-sentry-1",
      templateId: "void_stalker",
      name: ENEMIES.void_stalker.name,
      x: antechamber.center.x - 2,
      y: antechamber.center.y,
      hp: ENEMIES.void_stalker.hp,
      maxHp: ENEMIES.void_stalker.hp,
      alerted: true,
      lastKnownPlayerPosition: { ...spawn },
      statuses: [],
      elite: false,
      turnCounter: 0,
      floorNumber,
    },
    {
      id: "enemy-final-sentry-2",
      templateId: "infernal_imp",
      name: ENEMIES.infernal_imp.name,
      x: antechamber.center.x + 2,
      y: antechamber.center.y,
      hp: ENEMIES.infernal_imp.hp,
      maxHp: ENEMIES.infernal_imp.hp,
      alerted: true,
      lastKnownPlayerPosition: { ...spawn },
      statuses: [],
      elite: false,
      turnCounter: 0,
      floorNumber,
    },
  ];
  for (const sentry of sentries) {
    map[sentry.y][sentry.x].occupant = sentry.id;
  }

  const boss = {
    id: "enemy-final-boss",
    templateId: "abyssal_overlord",
    name: ENEMIES.abyssal_overlord.name,
    x: arena.center.x,
    y: arena.center.y,
    hp: ENEMIES.abyssal_overlord.hp,
    maxHp: ENEMIES.abyssal_overlord.hp,
    alerted: true,
    lastKnownPlayerPosition: { ...spawn },
    statuses: [],
    elite: false,
    turnCounter: 0,
    summonUsed: false,
    phaseTwo: false,
    floorNumber,
  };
  map[boss.y][boss.x].occupant = boss.id;

  const rewardItem = rng.pick([...FINAL_BOSS_REWARDS[playerClass], ...FINAL_BOSS_REWARDS.neutral]);
  const rewardChest = {
    id: "final-boss-reward",
    x: 31,
    y: 12,
    opened: false,
    loot: [rewardItem, rng.pick(CHEST_TABLE.endgame)],
    gold: rng.int(80, 120),
  };
  map[rewardChest.y][rewardChest.x].chestId = rewardChest.id;

  return {
    width,
    height,
    map,
    rooms: [entry, antechamber, arena],
    spawn,
    exit,
    enemies: [...sentries, boss],
    traps: [],
    chests: [rewardChest],
    looseItems: [],
    vendor: null,
    shrine: null,
  };
}

export function generateFloor(runSeed, floorNumber, playerClass) {
  if (floorNumber === 10) {
    return generateBossFloor(runSeed, floorNumber, playerClass);
  }
  if (floorNumber === 30) {
    return generateFinalBossFloor(runSeed, floorNumber, playerClass);
  }

  const config = FLOOR_CONFIGS[floorNumber];
  const rng = createRng(hashSeed(runSeed, floorNumber));

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const map = createMap(config.width, config.height);
    const rooms = buildRooms(map, rng, config);
    if (rooms.length < config.rooms[0]) continue;

    const spawn = { ...rooms[0].center };
    const exitRoom = rooms[rooms.length - 1];
    const exit = { ...exitRoom.center };
    map[exit.y][exit.x].stairs = true;
    assignRoomTypes(rooms, rng, floorNumber);
    const vendorRoom = reserveVendorRoom(rooms, rng, floorNumber);
    const shrine = placeShrine(map, rooms, rng, floorNumber);

    const reachable = floodFill(map, spawn);
    if (!reachable.has(toKey(exit.x, exit.y))) continue;

    const state = { enemyId: 0 };
    const encounterCount = rng.int(config.enemies[0], config.enemies[1]);
    const specialRooms = rng.shuffle(rooms.slice(1, -1).filter((room) => ["elite", "trap", "treasure"].includes(room.type)));
    const normalRooms = rng.shuffle(rooms.slice(1, -1).filter((room) => room.type === "normal"));
    const eligibleRooms = [...specialRooms, ...normalRooms].slice(0, encounterCount);
    const enemies = [];
    for (const room of eligibleRooms) {
      enemies.push(...spawnEncounter(map, room, rng, floorNumber, state));
    }

    const trapCount = rng.int(config.traps[0], config.traps[1]);
    const traps = placeTraps(map, rooms, rng, floorNumber, trapCount);
    const { chests, looseItems } = placeLoot(map, rooms, rng, floorNumber, playerClass);
    const vendor = placeVendor(map, vendorRoom, rng, floorNumber);

    const startOpenTiles = findOpenTilesInRoom(rooms[0], map);
    for (const tile of startOpenTiles.slice(0, 2)) {
      if (!map[tile.y][tile.x].itemIds.length && rng.chance(0.4)) {
        putItem(map, tile.x, tile.y, rng.pick(["healing_potion", "mana_potion"]));
      }
    }

    return {
      width: config.width,
      height: config.height,
      map,
      rooms,
      spawn,
      exit,
      enemies,
      traps,
      chests,
      looseItems,
      vendor,
      shrine,
    };
  }

  throw new Error(`Could not generate floor ${floorNumber}`);
}

export function getDropForEnemy(enemy, rng, playerClass) {
  const template = ENEMIES[enemy.templateId];
  const drops = [];
  const deepBiasPool = playerClass === "warrior"
    ? ["steel_greatsword", "war_hammer", "flame_touched_sword", "vampire_axe", "sundering_hammer", "guardian_plate", "greater_healing_potion"]
    : ["elder_staff", "storm_wand", "runic_staff", "sage_wand", "archmage_robe", "greater_mana_potion", "frost_shard_tome", "blink_tome", "arcane_burst_tome"];
  const endgameBiasPool = playerClass === "warrior"
    ? ["sunfire_blade", "soulreaver_axe", "abyssal_plate", "void_heart", "greater_healing_potion"]
    : ["voidglass_staff", "astral_wand", "starweave_robe", "void_heart", "greater_mana_potion", "arcane_burst_tome"];

  if (rng.chance((enemy.floorNumber ?? 1) >= 11 ? 0.42 : 0.65)) {
    const biasPool = playerClass === "warrior"
      ? ["iron_sword", "raider_axe", "chain_armor", "healing_potion"]
      : ["oak_staff", "crystal_wand", "enchanted_robe", "mana_potion"];
    const midGame = (enemy.floorNumber ?? 1) >= 11;
    const endgame = (enemy.floorNumber ?? 1) >= 21;
    if (rng.chance(endgame ? 0.22 : midGame ? 0.16 : 0.18)) {
      drops.push(rng.pick(endgame ? [...biasPool, ...deepBiasPool, ...endgameBiasPool] : midGame ? [...biasPool, ...deepBiasPool] : biasPool));
    } else if (rng.chance(midGame ? 0.14 : 0.24)) {
      drops.push(rng.pick(midGame ? ["greater_healing_potion", "greater_mana_potion", "healing_potion", "mana_potion"] : ["healing_potion", "mana_potion"]));
    }
  }

  return {
    gold: rng.int(template.gold[0], template.gold[1]) + Math.max(0, (enemy.floorNumber ?? 1) - 1) + ((enemy.floorNumber ?? 1) >= 21 ? 6 : 0),
    items: drops.filter((itemId) => ITEMS[itemId]),
  };
}
