// A bot that plays complete runs of the real game through the same actions a player uses: moving and
// bumping to attack, casting from its spells, firing, drinking potions, equipping gear, shopping,
// spending skill points, choosing a boon, using shrines, and taking the stairs.
//
// Two profiles bracket player skill:
//   competent - uses abilities well, heals at 45% HP, uses shrines, explores each floor fully,
//               shops for potions and gear upgrades, and weighs gear trade-offs.
//   careless  - basic attacks only, heals late (25%), heads for the stairs once it has seen them,
//               equips only clear upgrades, and buys a couple of potions.

import { startSeededRun, data, utils } from "./headless.js";

const { ITEMS, SPELLS, ENEMIES, SKILL_TREES } = data;
const { isBlockedFloor } = utils;

export const PROFILES = {
  competent: {
    healAt: 0.45,
    manaPotionAt: true,
    // Sorceress picks spells by value per mana, finishes weak foes with the staff, and drinks only
    // when she can't cast anything. Set false for the old "biggest spell first" behaviour.
    manaAware: true,
    manaPotionTarget: 5,
    useAbilities: true,
    useShrines: true,
    exploreFully: true,
    shopping: "smart",
    potionTarget: 4,
    gearChoice: "score",
  },
  careless: {
    healAt: 0.25,
    manaPotionAt: false,
    useAbilities: false,
    useShrines: false,
    exploreFully: false,
    shopping: "potions",
    potionTarget: 2,
    gearChoice: "arrows",
  },
};

const FLOOR_TURN_CAP = 3000;
const RUN_TURN_CAP = 70000;
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Small seeded PRNG for the bot's own choices (boon picks, careless skill picks).
function makeRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function playRun({ classId, profile = "competent", seed, skillStrategy = "balanced", boonId = null }) {
  const settings = PROFILES[profile];
  const game = startSeededRun(classId, seed);
  const random = makeRandom(seed ^ 0x9e3779b9);
  const run = () => game.state.run;
  const player = () => game.state.run.player;
  const floor = () => game.state.run.currentFloor;

  const record = {
    classId, profile, seed, skillStrategy,
    boon: null,
    result: "death",
    floorReached: 0,
    cause: null,
    killerTemplate: null,
    turns: 0,
    level: 1,
    kills: 0,
    floors: [],
    acquired: [],
    equipped: [],
    bought: [],
    potionsUsed: { heal: 0, mana: 0, escape: 0 },
    skills: [],
    stuckReason: null,
    shrinesUsed: 0,
    endEquipment: null,
  };

  // Track every item that enters the pack, and from where.
  const originalAdd = game.addToInventory.bind(game);
  game.addToInventory = (itemId, options = {}) => {
    originalAdd(itemId, options);
    if (!options.quiet) record.acquired.push({ itemId, floor: run().floorNumber, verb: options.verb ?? "Picked up" });
  };

  let floorTurnStart = 0;
  let lastFloor = -1;
  let exploreTarget = null;
  // Exploration targets given up on (tile key -> turn), and recent positions for spotting pacing.
  const abandonedTargets = new Map();
  const recentPositions = [];
  // Recent decisions, attached to the record if the run gets stuck (explains loops).
  const decisions = [];
  const note = (what) => {
    decisions.push(`${run().turn}:${player().x},${player().y} ${what}`);
    if (decisions.length > 30) decisions.shift();
  };

  // ── Map helpers ──
  const tileAt = (x, y) => floor().map[y]?.[x];
  const enemyAt = (x, y) => floor().enemies.find((enemy) => enemy.x === x && enemy.y === y);
  const walkable = (tile) => tile && tile.type === "floor" && !isBlockedFloor(tile);

  // Breadth-first path to the nearest tile satisfying isGoal. Enemies block the way except on a goal tile.
  function pathTo(isGoal, { maxNodes = 6000, throughEnemies = false } = {}) {
    const start = { x: player().x, y: player().y };
    if (isGoal(start.x, start.y)) return [start];
    const key = (x, y) => y * 1000 + x;
    const cameFrom = new Map([[key(start.x, start.y), null]]);
    const queue = [start];
    let head = 0;
    while (head < queue.length && cameFrom.size < maxNodes) {
      const current = queue[head++];
      for (const [dx, dy] of DIRECTIONS) {
        const x = current.x + dx;
        const y = current.y + dy;
        if (cameFrom.has(key(x, y))) continue;
        const tile = tileAt(x, y);
        if (!walkable(tile)) continue;
        const goal = isGoal(x, y);
        if (!goal && !throughEnemies && enemyAt(x, y)) continue;
        cameFrom.set(key(x, y), current);
        const node = { x, y };
        if (goal) {
          const path = [node];
          let back = current;
          while (back) {
            path.unshift(back);
            back = cameFrom.get(key(back.x, back.y));
          }
          return path;
        }
        queue.push(node);
      }
    }
    return null;
  }

  // Advance one step along a path (bumping attacks an enemy standing on the next tile).
  function stepAlong(path) {
    if (!path || path.length < 2) return false;
    const next = path[1];
    const before = actionStamp();
    game.movePlayer(next.x - player().x, next.y - player().y);
    return acted(before);
  }

  const actionStamp = () => `${run()?.turn}|${player()?.x},${player()?.y}|${run()?.floorNumber}|${game.state.ui.overlay?.type ?? ""}`;
  const acted = (before) => actionStamp() !== before;

  function wait() {
    player().lastAction = "wait";
    game.endPlayerTurn();
  }

  function closeOverlays() {
    let guard = 0;
    while (game.state.ui.overlay && game.state.ui.overlay.dismissible !== false && guard < 5) {
      game.closeOverlay();
      guard += 1;
    }
  }

  // ── Power score: how strong the current kit makes this class (used to judge gear) ──
  function powerScore(equipment = player().equipment) {
    const p = player();
    const saved = p.equipment;
    p.equipment = equipment;
    const derived = game.getDerivedStats(p);
    p.equipment = saved;
    const weapon = ITEMS[equipment.weapon];
    const weaponAvg = weapon?.damage ? (weapon.damage[0] + weapon.damage[1]) / 2 : 1.5;
    const enchant = weapon?.enchantment?.type === "onHitBonusDamage" ? weapon.enchantment.value : 0;
    const hit = Math.min(95, derived.accuracy - 4) / 100;
    let offense;
    if (p.classId === "wizard") {
      const spells = p.learnedSpells.map((id) => SPELLS[id]).filter((spell) => spell?.damage);
      const best = Math.max(0, ...spells.map((spell) => (spell.damage[0] + spell.damage[1]) / 2));
      const spellEnchant = weapon?.enchantment?.type === "spellBonusDamage" ? weapon.enchantment.value : 0;
      offense = ((best + derived.spellBonus) * (1 + derived.spellDamagePct / 100) + spellEnchant) * Math.min(1, 0.55 + derived.maxMana / 45)
        + 0.2 * (weaponAvg + derived.meleeBonus);
    } else if (weapon?.range) {
      offense = ((weaponAvg + derived.rangedBonus) * (1 + (derived.rangedDamagePct ?? 0) / 100) + enchant) * hit;
    } else {
      offense = ((weaponAvg + derived.meleeBonus) * (1 + derived.meleeDamagePct / 100) + enchant) * hit;
    }
    const effectiveHp = derived.maxHp * (1 + derived.defense * 0.14) * (1 + derived.evasion / 60);
    return offense * Math.pow(effectiveHp, 0.8);
  }

  function gearGain(itemId) {
    const item = ITEMS[itemId];
    if (!item?.slot) return 0;
    const current = powerScore();
    const trial = { ...player().equipment, [item.slot]: itemId };
    return powerScore(trial) / Math.max(0.001, current) - 1;
  }

  // ── Housekeeping: free actions taken before deciding a move ──
  function spendSkillPoints() {
    const p = player();
    const branches = SKILL_TREES[p.classId];
    let guard = 0;
    while (p.skillPoints > 0 && guard < 20) {
      guard += 1;
      const options = branches
        .map((branch) => ({ branch, next: branch.skills.find((skill) => !p.unlockedSkills.includes(skill.id)) }))
        .filter((entry) => entry.next);
      if (!options.length) break;
      let choice;
      if (profile === "careless") {
        choice = options[Math.floor(random() * options.length)];
      } else {
        const focus = skillStrategy.startsWith("focus:") ? skillStrategy.slice(6) : null;
        choice = options.find((entry) => entry.branch.id === focus)
          ?? options.sort((a, b) => a.branch.skills.indexOf(a.next) - b.branch.skills.indexOf(b.next))[0];
      }
      game.buySkill(choice.next.id);
      record.skills.push({ skill: choice.next.id, branch: choice.branch.id, level: p.level });
    }
    closeOverlays();
  }

  function readTomes() {
    for (const entry of [...player().inventory]) {
      if (ITEMS[entry.itemId]?.category === "tome") {
        game.useItemById(entry.itemId);
        closeOverlays();
      }
    }
  }

  function equipUpgrades() {
    let guard = 0;
    while (guard < 8) {
      guard += 1;
      const stacks = game.getInventoryStacks();
      let best = null;
      stacks.forEach((stack, index) => {
        const item = ITEMS[stack.itemId];
        if (!item?.slot) return;
        if (settings.gearChoice === "arrows") {
          if (game.getGearVerdict(stack.itemId) === "upgrade" && !best) best = { index, gain: 1 };
          return;
        }
        const gain = gearGain(stack.itemId);
        if (gain > 0.02 && (!best || gain > best.gain)) best = { index, gain };
      });
      if (!best) break;
      const itemId = stacks[best.index].itemId;
      game.equipInventoryIndex(best.index);
      record.equipped.push({ itemId, floor: run().floorNumber });
      closeOverlays();
    }
  }

  function potionIds(kind) {
    return player().inventory.map((entry) => entry.itemId).filter((itemId) => ITEMS[itemId]?.effect?.type === kind);
  }

  function drink(kind) {
    const options = potionIds(kind);
    if (!options.length) return false;
    // Drink the smallest potion that covers what's missing, else the biggest one.
    const p = player();
    const derived = game.getDerivedStats(p);
    const missing = kind === "heal" ? derived.maxHp - p.hp : derived.maxMana - p.mana;
    const sorted = [...new Set(options)].sort((a, b) => ITEMS[a].effect.value - ITEMS[b].effect.value);
    const choice = sorted.find((itemId) => ITEMS[itemId].effect.value >= missing) ?? sorted[sorted.length - 1];
    game.useItemById(choice);
    closeOverlays();
    record.potionsUsed[kind === "heal" ? "heal" : "mana"] += 1;
    return true;
  }

  // ── Shopping ──
  function shop() {
    const vendor = floor().vendor;
    if (!vendor) return;
    game.openVendor(0);
    if (settings.shopping === "smart") {
      game.vendorSellJunk(false);
      if (game.state.ui.vendorConfirm) game.vendorSellJunk(true);
    }
    const buy = (predicate) => {
      const stacks = game.getVendorStacks();
      const index = stacks.findIndex((stack) => predicate(stack.itemId));
      if (index < 0) return false;
      const itemId = stacks[index].itemId;
      if (player().gold < game.getVendorBuyPrice(itemId)) return false;
      game.vendorBuy(index);
      record.bought.push({ itemId, floor: run().floorNumber, price: game.getVendorBuyPrice(itemId) });
      return true;
    };
    // Stock up on one kind of potion, greater ones first.
    const stockUp = (kind, target) => {
      for (let guard = 0; potionIds(kind).length < target && guard < 8; guard += 1) {
        if (!buy((itemId) => ITEMS[itemId]?.effect?.type === kind && ITEMS[itemId].id.startsWith("greater_")) && !buy((itemId) => ITEMS[itemId]?.effect?.type === kind)) break;
      }
    };
    // Mana is the Sorceress's weapon, so a smart shopper buys it before healing.
    const manaFirst = settings.shopping === "smart" && player().classId === "wizard";
    if (manaFirst) stockUp("mana", settings.manaPotionTarget ?? 3);
    stockUp("heal", settings.potionTarget);
    if (settings.shopping === "smart") {
      // Best affordable gear upgrade by gain per gold.
      const stacks = game.getVendorStacks();
      const candidates = stacks
        .map((stack) => ({ itemId: stack.itemId, gain: gearGain(stack.itemId), price: game.getVendorBuyPrice(stack.itemId) }))
        .filter((entry) => entry.gain > 0.05 && entry.price <= player().gold)
        .sort((a, b) => b.gain / b.price - a.gain / a.price);
      if (candidates.length) buy((itemId) => itemId === candidates[0].itemId);
    }
    closeOverlays();
  }

  // ── Combat ──
  // Enemies worth fighting now: alerted (or very close) ones in view, plus any seen in the last few
  // turns. Remembering them stops the bot flip-flopping when a foe drops in and out of sight.
  const lastSeen = new Map();
  function threats() {
    const p = player();
    const now = run().turn;
    return floor().enemies.filter((enemy) => {
      if (enemy.disguised || enemy.hp <= 0) return false;
      const inView = tileAt(enemy.x, enemy.y)?.visible && (enemy.alerted || manhattan(enemy, p) <= 3);
      if (inView) lastSeen.set(enemy.id, now);
      return inView || now - (lastSeen.get(enemy.id) ?? -Infinity) <= 8;
    });
  }

  const spellAvg = (spell) => (spell.damage ? (spell.damage[0] + spell.damage[1]) / 2 : 0);

  function tryCast(spellId) {
    if (!player().learnedSpells.includes(spellId) && !player().quickSlots.includes(spellId)) return false;
    const { cost } = game.getSpellCost(spellId);
    if (player().mana < cost) return false;
    const before = actionStamp();
    game.castAbility(spellId);
    return acted(before);
  }

  // ── Mana-aware Sorceress ──
  // Damage estimates use the game's own formulas against the enemy each spell would actually hit.
  // A turn is priced at about 2 mana (what the enemies take off you while you act), so overkill and
  // expensive spells on weak targets score badly.
  const TURN_MANA_WEIGHT = 2;

  function spellEstimate(spell, enemy, snapshot) {
    const { defense } = game.getEnemyCombatStats(enemy);
    const flat = spell.cantrip ? 0 : snapshot.spellBonus;
    const roll = (value) => Math.max(1, Math.floor((value + flat) * (1 + snapshot.spellDamagePct / 100)) - defense);
    return { min: roll(spell.damage[0]), avg: roll(spellAvg(spell)) };
  }

  function staffMinDamage(enemy, snapshot) {
    const weapon = ITEMS[player().equipment.weapon];
    const { defense } = game.getEnemyCombatStats(enemy);
    return Math.max(1, Math.floor(((weapon?.damage?.[0] ?? 1) + snapshot.meleeBonus) * (1 + snapshot.meleeDamagePct / 100)) - defense);
  }

  const isBoss = (enemy) => ENEMIES[enemy.templateId]?.behavior === "boss";
  const knows = (spellId) => player().learnedSpells.includes(spellId);

  function wizardTurn(usable, adjacent, enemies, hpRatio) {
    const p = player();
    const snapshot = game.getPlayerCombatSnapshot();
    const castCost = (spellId) => game.getSpellCost(spellId).cost;

    // Frost Nova: freeze a crowd at her side, or buy a turn when a melee fight is going badly.
    const freezable = adjacent.filter((enemy) => !isBoss(enemy) && !game.hasStatus(enemy, "frozen"));
    if (knows("frost_nova") && (freezable.length >= 2 || (freezable.length && hpRatio < 0.5)) && p.mana >= castCost("frost_nova") + 3 && tryCast("frost_nova")) return true;

    // Summon Spire for a real fight: a boss, or enough enemy HP in play to be worth 5 free bolts.
    const fightHp = enemies.reduce((sum, enemy) => sum + enemy.hp, 0);
    if (knows("summon_spire") && !game.getSpire() && (enemies.some(isBoss) || fightHp >= 30) && p.mana >= castCost("summon_spire") + 3 && tryCast("summon_spire")) return true;

    // The staff is free: finish anything next to her that it reliably kills.
    const staffTarget = adjacent.find((enemy) => staffMinDamage(enemy, snapshot) >= enemy.hp);
    if (staffTarget) {
      note(`staff finish ${staffTarget.templateId}`);
      const before = actionStamp();
      game.movePlayer(staffTarget.x - p.x, staffTarget.y - p.y);
      if (acted(before)) return true;
    }

    const options = usable.map((spell) => {
      const target = game.findNearestVisibleEnemy(spell.range);
      if (!target) return null;
      if (spell.id === "ice_shatter" && !game.hasStatus(target, "chilled")) return null;
      const { cost } = game.getSpellCost(spell.id);
      const estimate = spellEstimate(spell, target, snapshot);
      const kills = estimate.min >= target.hp;
      let damageValue = Math.min(estimate.avg, target.hp);
      if (spell.radius) {
        // Area spells count everything caught in the blast, plus the burn on whatever survives it.
        const caught = floor().enemies.filter((enemy) => !enemy.disguised && Math.max(Math.abs(enemy.x - target.x), Math.abs(enemy.y - target.y)) <= spell.radius);
        damageValue = caught.reduce((sum, enemy) => {
          const hit = Math.min(spellEstimate(spell, enemy, snapshot).avg, enemy.hp);
          const burn = spell.burn ? Math.min(spell.burn.value * spell.burn.turns, Math.max(0, enemy.hp - hit)) : 0;
          return sum + hit + burn;
        }, 0);
      }
      const value = (damageValue + (kills ? 3 : 0)) / (cost + TURN_MANA_WEIGHT);
      return { spell, cost, target, kills, value, estimate };
    }).filter(Boolean).sort((a, b) => b.value - a.value);
    if (!options.length) return false;
    const preferred = options[0];

    if (p.mana >= preferred.cost) {
      // Shield only for a real melee fight: something adjacent that this cast won't finish, with mana to spare.
      const shieldCost = game.getSpellCost("arcane_shield").cost;
      const lastingMelee = adjacent.some((enemy) => enemy !== preferred.target || !preferred.kills);
      const shielded = game.hasStatus(p, "arcane_shield") || game.hasStatus(p, "mana_barrier");
      if (adjacent.length && lastingMelee && !shielded && p.mana >= shieldCost + preferred.cost * 2 && tryCast("arcane_shield")) return true;
      if (tryCast(preferred.spell.id)) return true;
    }
    // Can't afford the preferred spell: spend what's left on the best paid spell she can still cast.
    const affordable = options.find((option) => option.cost > 0 && option.cost <= p.mana);
    if (affordable && tryCast(affordable.spell.id)) return true;
    // Only the free Spark left. Use it when it finishes the target within two casts; otherwise a
    // mana potion is worth drinking, and Spark is the fallback once those run out.
    const spark = options.find((option) => option.spell.cantrip);
    const sparkWillDo = spark && spark.estimate.avg * 2 >= spark.target.hp;
    if (sparkWillDo && tryCast(spark.spell.id)) return true;
    if (settings.manaPotionAt && potionIds("mana").length && drink("mana")) return true;
    if (spark && tryCast(spark.spell.id)) return true;
    return false;
  }

  function fight(enemies) {
    const p = player();
    const derived = game.getDerivedStats(p);
    const nearest = [...enemies].sort((a, b) => manhattan(a, p) - manhattan(b, p))[0];
    const distance = manhattan(nearest, p);
    const adjacent = enemies.filter((enemy) => manhattan(enemy, p) === 1);
    const weapon = ITEMS[p.equipment.weapon];
    const hpRatio = p.hp / derived.maxHp;

    if (p.classId === "wizard") {
      if (settings.useAbilities && adjacent.length && hpRatio < 0.4 && tryCast("blink")) return true;
      if (settings.useAbilities && adjacent.length >= 2 && tryCast("arcane_pulse")) return true;
      const known = p.learnedSpells.map((id) => SPELLS[id]).filter((spell) => spell?.damage && spell.range && spell.id !== "arcane_pulse");
      const usable = settings.useAbilities ? known : known.filter((spell) => spell.id === "magic_missile" || spell.id === "arcane_spark");
      if (!settings.manaAware) {
        if (settings.useAbilities && adjacent.length && !game.hasStatus(p, "arcane_shield") && p.mana >= 10 && tryCast("arcane_shield")) return true;
        const ordered = usable
          .filter((spell) => spell.id !== "ice_shatter" || game.hasStatus(nearest, "chilled"))
          .sort((a, b) => spellAvg(b) - spellAvg(a));
        for (const spell of ordered) {
          if (spell.range >= distance && tryCast(spell.id)) return true;
        }
        if (settings.manaPotionAt && p.mana < 4 && potionIds("mana").length && drink("mana")) return true;
      } else if (wizardTurn(usable, adjacent, enemies, hpRatio)) {
        return true;
      }
    } else if (weapon?.range) {
      if (settings.useAbilities && adjacent.length && hpRatio < 0.55 && tryCast("evasive_step")) return true;
      if (distance <= weapon.range) {
        if (settings.useAbilities && tryCast("aimed_shot")) return true;
        const before = actionStamp();
        game.fireRangedWeapon();
        if (acted(before)) return true;
      }
    } else if (adjacent.length && settings.useAbilities) {
      const target = adjacent[0];
      const stats = game.getEnemyCombatStats(target);
      if (stats.defense >= 3 && !game.hasStatus(target, "sundered") && tryCast("guard_break")) return true;
      if (tryCast("power_strike")) return true;
    }

    // Otherwise close in: bump-attack if adjacent, or step toward the nearest reachable threat. A foe
    // only reachable the long way round isn't chased; exploring brings the bot to it more directly.
    const path = pathTo((x, y) => enemies.some((enemy) => enemy.x === x && enemy.y === y));
    if (path && path.length - 1 <= 15 && stepAlong(path)) return true;
    return false;
  }

  // ── Exploration goals when no threat is in sight ──
  function openableChest(chest) {
    const tile = tileAt(chest.x, chest.y);
    if (chest.opened || !tile?.explored) return false;
    if (chest.locked && !game.hasVaultKey(chest.keyItemId)) return false;
    const bossAlive = floor().enemies.some((enemy) => ENEMIES[enemy.templateId]?.behavior === "boss");
    if (chest.bossReward && bossAlive) return false;
    return true;
  }

  function nextGoalAction() {
    const p = player();
    const f = floor();
    const derived = game.getDerivedStats(p);

    // The Grey Witness on the prelude floor.
    if (f.sage && !f.sage.vanished) {
      if (manhattan(p, f.sage) <= 1) {
        game.interact();
        return true;
      }
      return stepAlong(pathTo((x, y) => manhattan({ x, y }, f.sage) === 1));
    }

    // Loose items and openable chests (a mimic's chest looks the same until it wakes).
    const lootPath = pathTo((x, y) => {
      const tile = tileAt(x, y);
      if (!tile?.explored) return false;
      if (tile.itemIds?.length) return true;
      // A still-disguised mimic reads as a chest; once it's dead the marker means nothing.
      if (tile.chestId?.startsWith("mimic-")) return Boolean(enemyAt(x, y));
      const chest = tile.chestId && !tile.botSkip ? f.chests.find((entry) => entry.id === tile.chestId) : null;
      return Boolean(chest && openableChest(chest));
    });
    if (lootPath) {
      const goal = lootPath[lootPath.length - 1];
      note(`loot ${goal.x},${goal.y}`);
      if (lootPath.length === 1) {
        const here = tileAt(p.x, p.y);
        const floorBefore = run().floorNumber;
        if (here.itemIds?.length) game.pickUpItems();
        else game.interact();
        closeOverlays();
        // Standing on a chest that can't be opened after all: stop treating it as a goal.
        if (here.chestId && run().floorNumber === floorBefore && tileAt(p.x, p.y)?.chestId === here.chestId) here.botSkip = true;
        return true;
      }
      if (stepAlong(lootPath)) return true;
    }

    // Shrines.
    const shrine = f.shrine;
    const wantsShrine = shrine && !shrine.used && tileAt(shrine.x, shrine.y)?.explored
      && (settings.useShrines ? (p.hp / derived.maxHp < 0.75 || (shrine.mode === "mana" && p.mana / derived.maxMana < 0.5)) : p.hp / derived.maxHp < 0.5)
      && (shrine.mode === "healing" || p.classId === "wizard" || !settings.useShrines);
    if (wantsShrine) {
      note("shrine");
      if (manhattan(p, shrine) <= 1) {
        game.interact();
        record.shrinesUsed += 1;
        return true;
      }
      const shrinePath = pathTo((x, y) => manhattan({ x, y }, shrine) === 1);
      if (shrinePath && stepAlong(shrinePath)) return true;
    }

    // Vendors.
    const vendor = f.vendor;
    if (vendor && !vendor.visited && tileAt(vendor.x, vendor.y)?.explored) {
      note("vendor");
      if (p.x === vendor.x && p.y === vendor.y) {
        shop();
        vendor.visited = true;
        return true;
      }
      const vendorPath = pathTo((x, y) => x === vendor.x && y === vendor.y);
      if (vendorPath && stepAlong(vendorPath)) return true;
    }

    // A living boss: go find it (entering its arena wakes it).
    const boss = f.enemies.find((enemy) => ENEMIES[enemy.templateId]?.behavior === "boss");
    const stairsKnown = f.map.some((row) => row.some((tile) => tile.stairs && tile.explored));
    const exploring = settings.exploreFully || !stairsKnown;

    if (exploring || boss) {
      const isFrontier = (x, y) => {
        const tile = tileAt(x, y);
        if (!tile?.explored) return false;
        return DIRECTIONS.some(([dx, dy]) => {
          const next = tileAt(x + dx, y + dy);
          return next && !next.explored && next.type === "floor";
        });
      };
      // Stick with the current exploration target until it's reached or no longer unexplored, so two
      // equally near targets can't keep trading places; attack through anything blocking the way.
      const abandoned = (x, y) => run().turn - (abandonedTargets.get(`${f.width}|${x},${y}`) ?? -Infinity) < 150;
      // Pacing between two tiles for 8 turns means this target can't be reached cleanly: drop it for now.
      const pacing = recentPositions.length >= 8 && new Set(recentPositions.slice(-8)).size <= 2;
      if (pacing && exploreTarget) {
        abandonedTargets.set(`${f.width}|${exploreTarget.x},${exploreTarget.y}`, run().turn);
        exploreTarget = null;
        recentPositions.length = 0;
      }
      if (!exploreTarget || exploreTarget.floor !== f || !isFrontier(exploreTarget.x, exploreTarget.y) || abandoned(exploreTarget.x, exploreTarget.y)) {
        const nearest = pathTo((x, y) => isFrontier(x, y) && !abandoned(x, y));
        exploreTarget = nearest ? { ...nearest[nearest.length - 1], floor: f } : null;
      }
      if (exploreTarget) {
        const target = exploreTarget;
        note(`frontier ${target.x},${target.y}`);
        const route = pathTo((x, y) => x === target.x && y === target.y) ?? pathTo((x, y) => x === target.x && y === target.y, { throughEnemies: true });
        if (route && stepAlong(route)) return true;
        exploreTarget = null;
      }
    }
    if (boss) {
      const bossPath = pathTo((x, y) => manhattan({ x, y }, boss) === 1);
      if (bossPath && stepAlong(bossPath)) return true;
    }

    // Last resort: something is standing in the only way forward (an unalerted enemy in a corridor, a
    // rooted lurker). Path through it; stepping into it attacks.
    if (!stairsKnown || boss) {
      const blocked = pathTo((x, y) => {
        const tile = tileAt(x, y);
        return tile?.explored && DIRECTIONS.some(([dx, dy]) => {
          const next = tileAt(x + dx, y + dy);
          return next && !next.explored && next.type === "floor";
        });
      }, { throughEnemies: true });
      if (blocked && stepAlong(blocked)) return true;
    }

    // Take the stairs (the first Enter may only warn about loot left behind).
    const stairsPath = pathTo((x, y) => tileAt(x, y)?.stairs && tileAt(x, y)?.explored);
    if (stairsPath) {
      note("stairs");
      if (stairsPath.length === 1) {
        const floorBefore = run().floorNumber;
        game.interact();
        if (run() && run().floorNumber === floorBefore && game.state.mode === "in_game") game.interact();
        closeOverlays();
        return true;
      }
      if (stepAlong(stairsPath)) return true;
    }
    const forced = pathTo((x, y) => tileAt(x, y)?.stairs && tileAt(x, y)?.explored, { throughEnemies: true });
    if (forced && stepAlong(forced)) return true;
    return false;
  }

  function snapshotFloor() {
    const p = player();
    const derived = game.getDerivedStats(p);
    record.floors.push({
      floor: run().floorNumber,
      turn: run().turn,
      level: p.level,
      hp: p.hp,
      maxHp: derived.maxHp,
      gold: p.gold,
      healPotions: potionIds("heal").length,
      power: Math.round(powerScore() * 10) / 10,
      kills: run().runStats.kills,
    });
  }

  // ── Main loop ──
  let idleTurns = 0;
  for (let step = 0; step < RUN_TURN_CAP * 3; step += 1) {
    if (game.state.mode !== "in_game" || !run()) break;
    const r = run();
    if (r.endInfo || r.player.hp <= 0) break;

    if (r.floorNumber !== lastFloor) {
      lastFloor = r.floorNumber;
      floorTurnStart = r.turn;
      snapshotFloor();
    }

    const overlay = game.state.ui.overlay;
    if (overlay?.type === "boon-choice") {
      const choices = r.currentFloor.sage.choices;
      const pick = boonId && choices.includes(boonId) ? boonId : choices[Math.floor(random() * choices.length)];
      game.chooseBoon(pick);
      record.boon = pick;
      closeOverlays();
      continue;
    }
    if (overlay) {
      if (overlay.dismissible === false) break;
      closeOverlays();
    }

    if (r.turn - floorTurnStart > FLOOR_TURN_CAP) {
      record.result = "stuck";
      record.stuckReason = `over ${FLOOR_TURN_CAP} turns on floor ${r.floorNumber}`;
      break;
    }
    if (r.turn > RUN_TURN_CAP) {
      record.result = "stuck";
      record.stuckReason = "run turn cap";
      break;
    }

    recentPositions.push(`${r.player.x},${r.player.y}`);
    if (recentPositions.length > 12) recentPositions.shift();

    spendSkillPoints();
    readTomes();
    equipUpgrades();

    const p = r.player;
    const derived = game.getDerivedStats(p);
    const danger = threats();
    const hpRatio = p.hp / derived.maxHp;

    if (hpRatio < settings.healAt && (danger.length || hpRatio < 0.3) && drink("heal")) continue;

    let didSomething = false;
    if (danger.length) {
      note(`fight ${danger.map((enemy) => enemy.name).join("+")}`);
      didSomething = fight(danger);
    }
    if (!didSomething) didSomething = nextGoalAction();
    if (!didSomething) {
      wait();
      idleTurns += 1;
    } else {
      idleTurns = 0;
    }
    if (idleTurns > 400) {
      record.result = "stuck";
      record.stuckReason = `nothing to do on floor ${r.floorNumber}`;
      break;
    }
  }

  if (record.result === "stuck") record.decisions = decisions;
  const r = run();
  if (r?.endInfo) {
    record.result = r.endInfo.result;
    record.cause = r.endInfo.cause;
    record.killerTemplate = r.endInfo.source?.templateId ?? r.endInfo.source?.kind ?? null;
  } else if (record.result === "death" && r?.player.hp > 0) {
    record.result = "stuck";
    record.stuckReason = record.stuckReason ?? "loop ended";
  }
  if (r) {
    record.floorReached = r.floorNumber;
    record.turns = r.turn;
    record.level = r.player.level;
    record.kills = r.runStats.kills;
    record.endEquipment = { ...r.player.equipment };
    record.damageDealt = r.runStats.damageDealt ?? 0;
    record.damageTaken = r.runStats.damageTaken ?? 0;
  }
  return record;
}
