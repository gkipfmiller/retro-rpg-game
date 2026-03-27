import { BOSS_REWARDS, CLASSES, ENEMIES, ITEMS, SKILL_TREES, SPELLS, STATUS_DEFINITIONS, TRAPS } from "./data.js";
import { generateFloor, getDropForEnemy } from "./generator.js";
import { clamp, createRng, deepClone, hashSeed, manhattan, toKey } from "./utils.js";

const XP_THRESHOLDS = {
  1: 0,
  2: 80,
  3: 220,
  4: 500,
  5: 1050,
  6: 1800,
  7: 2700,
  8: 3900,
  9: 5300,
  10: 7000,
};

function occupiedByEnemy(floor, x, y) {
  return floor.enemies.find((enemy) => enemy.x === x && enemy.y === y);
}

function lineBetween(a, b) {
  const cells = [];
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - x);
  const dy = Math.abs(b.y - y);
  const sx = x < b.x ? 1 : -1;
  const sy = y < b.y ? 1 : -1;
  let err = dx - dy;

  while (!(x === b.x && y === b.y)) {
    cells.push({ x, y });
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  cells.push({ x: b.x, y: b.y });
  return cells;
}

function hasLineOfSight(map, a, b) {
  const cells = lineBetween(a, b);
  for (let index = 1; index < cells.length - 1; index += 1) {
    const cell = cells[index];
    if (map[cell.y]?.[cell.x]?.type === "wall") {
      return false;
    }
  }
  return true;
}

function pathfind(map, start, end, blockers = new Set()) {
  const queue = [start];
  const cameFrom = new Map();
  const visited = new Set([toKey(start.x, start.y)]);

  while (queue.length) {
    const current = queue.shift();
    if (current.x === end.x && current.y === end.y) {
      const path = [current];
      let cursor = current;
      while (cameFrom.has(toKey(cursor.x, cursor.y))) {
        cursor = cameFrom.get(toKey(cursor.x, cursor.y));
        path.push(cursor);
      }
      return path.reverse();
    }

    for (const delta of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const next = { x: current.x + delta.x, y: current.y + delta.y };
      const key = toKey(next.x, next.y);
      if (visited.has(key)) continue;
      const tile = map[next.y]?.[next.x];
      if (!tile || tile.type !== "floor") continue;
      if (blockers.has(key) && !(next.x === end.x && next.y === end.y)) continue;
      visited.add(key);
      cameFrom.set(key, current);
      queue.push(next);
    }
  }

  return null;
}

export class Game {
  constructor() {
    this.state = {
      mode: "menu",
      run: null,
      ui: { overlay: null, selectedId: null },
      logs: ["Begin a new run to enter the dungeon."],
    };
    this.renderer = null;
  }

  attachRenderer(renderer) {
    this.renderer = renderer;
  }

  setMode(mode) {
    this.state.mode = mode;
  }

  log(message) {
    this.state.logs.push(message);
  }

  getXpForLevel(level) {
    return XP_THRESHOLDS[level] ?? XP_THRESHOLDS[10];
  }

  createPlayer(classId) {
    const definition = CLASSES[classId];
    const inventory = [];
    const player = {
      classId,
      level: 1,
      xp: 0,
      gold: 0,
      skillPoints: 0,
      baseStats: deepClone(definition.startingStats),
      hp: 1,
      mana: 1,
      equipment: { weapon: null, armor: null, accessory: null },
      inventory,
      learnedSpells: [],
      unlockedSkills: [],
      quickSlots: [...definition.quickSlots],
      x: 0,
      y: 0,
      floorFlags: {},
      statuses: [],
      turnFlags: {},
      lastAction: "none",
    };

    for (const itemId of definition.startingItems) {
      const item = ITEMS[itemId];
      if (item.slot) {
        player.equipment[item.slot] = itemId;
        continue;
      }
      if (item.category === "tome" && item.spellId && !player.learnedSpells.includes(item.spellId)) {
        player.learnedSpells.push(item.spellId);
        continue;
      }
      inventory.push({ id: `inv-${inventory.length}-${itemId}`, itemId });
    }

    for (const abilityId of definition.abilities) {
      if (!player.learnedSpells.includes(abilityId)) {
        player.learnedSpells.push(abilityId);
      }
    }

    const derived = this.getDerivedStats(player);
    player.hp = derived.maxHp;
    player.mana = derived.maxMana;
    return player;
  }

  startRun(classId) {
    const runSeed = hashSeed(classId, Date.now());
    const player = this.createPlayer(classId);
    const floorData = generateFloor(runSeed, 1, classId);
    player.x = floorData.spawn.x;
    player.y = floorData.spawn.y;

    this.state.run = {
      runSeed,
      floorNumber: 1,
      turn: 0,
      player,
      currentFloor: floorData,
      runStats: { kills: 0 },
      currentTargetId: null,
    };
    this.updateVisibility();
    this.state.logs = [`${CLASSES[classId].name} enters Floor 1.`];
    this.state.ui.overlay = null;
    this.state.mode = "in_game";
    this.renderer?.showTransition("Floor 1");
  }

  getDerivedStats(player) {
    const equipmentItems = Object.values(player.equipment)
      .filter(Boolean)
      .map((itemId) => ITEMS[itemId]);
    const skillBonuses = player.unlockedSkills
      .map((skillId) => this.findSkill(skillId)?.effect ?? null)
      .filter(Boolean);

    const stats = {
      strength: player.baseStats.strength,
      dexterity: player.baseStats.dexterity,
      vitality: player.baseStats.vitality,
      intelligence: player.baseStats.intelligence,
      maxHpFlat: 0,
      maxManaFlat: 0,
      defenseFlat: 0,
      accuracyFlat: 0,
      evasionFlat: 0,
      magicPowerFlat: 0,
      meleeDamagePct: 0,
      spellDamagePct: 0,
      critBonus: 0,
      utilityDiscount: 0,
      trapReductionPct: 0,
      waitDefense: 0,
      lowHpDamagePct: 0,
      executioner: 0,
      freeCastChance: 0,
      firstSpellPct: 0,
      reactiveWard: 0,
      archmageBarrier: 0,
    };

    for (const item of equipmentItems) {
      if (item.defense) stats.defenseFlat += item.defense;
      if (item.accuracy) stats.accuracyFlat += item.accuracy;
      if (item.evasion) stats.evasionFlat += item.evasion;
      if (item.magicPower) stats.magicPowerFlat += item.magicPower;
      if (item.bonus) {
        for (const [key, value] of Object.entries(item.bonus)) {
          stats[key] = (stats[key] ?? 0) + value;
        }
      }
    }

    for (const bonus of skillBonuses) {
      stats[bonus.stat] = (stats[bonus.stat] ?? 0) + bonus.value;
    }

    const maxHp = 14 + stats.vitality * 3 + (player.level - 1) * CLASSES[player.classId].hpGrowth + stats.maxHpFlat;
    const maxMana = 2 + stats.intelligence * 2 + (player.level - 1) * CLASSES[player.classId].manaGrowth + stats.maxManaFlat;

    return {
      ...stats,
      maxHp,
      maxMana,
      defense: stats.defenseFlat,
      accuracy: 85 + stats.dexterity + stats.accuracyFlat,
      evasion: Math.floor(stats.dexterity / 2) + stats.evasionFlat,
      meleeBonus: Math.floor(stats.strength / 2),
      spellBonus: Math.floor(stats.intelligence / 2) + stats.magicPowerFlat,
    };
  }

  findSkill(skillId) {
    for (const branch of SKILL_TREES[this.state.run.player.classId]) {
      const skill = branch.skills.find((entry) => entry.id === skillId);
      if (skill) return skill;
    }
    return null;
  }

  getCurrentTarget() {
    const { run } = this.state;
    return run?.currentFloor.enemies.find((enemy) => enemy.id === run.currentTargetId) ?? null;
  }

  getTrapAt(x, y) {
    return this.state.run?.currentFloor.traps.find((trap) => trap.x === x && trap.y === y) ?? null;
  }

  getShrineAt(x, y) {
    const shrine = this.state.run?.currentFloor.shrine;
    return shrine && shrine.x === x && shrine.y === y ? shrine : null;
  }

  getEnemyCombatStats(enemy) {
    const template = ENEMIES[enemy.templateId];
    const sundered = this.getStatusValue(enemy, "sundered");
    const chilled = this.hasStatus(enemy, "chilled");
    const weakened = this.hasStatus(enemy, "weakened");
    const eliteDamageBonus = enemy.elite ? 1 : 0;
    const phaseAccuracyBonus = enemy.templateId === "abyssal_overlord" && enemy.phaseTwo ? 3 : 0;
    const phaseDefenseBonus = enemy.templateId === "abyssal_overlord" && enemy.phaseTwo ? 1 : 0;
    const phaseDamageBonus = enemy.templateId === "abyssal_overlord" && enemy.phaseTwo ? 1 : 0;
    return {
      ...template,
      accuracy: template.accuracy + (enemy.elite ? 3 : 0) + phaseAccuracyBonus - (chilled ? 6 : 0),
      defense: Math.max(0, template.defense + (enemy.elite ? 1 : 0) + phaseDefenseBonus - sundered),
      damage: weakened
        ? [Math.max(1, (template.damage[0] + eliteDamageBonus + phaseDamageBonus) - 2), Math.max(1, (template.damage[1] + eliteDamageBonus + phaseDamageBonus) - 2)]
        : enemy.elite || phaseDamageBonus
          ? [template.damage[0] + eliteDamageBonus + phaseDamageBonus, template.damage[1] + eliteDamageBonus + phaseDamageBonus]
          : template.damage,
      range: (template.range ?? 1) + (enemy.elite && template.behavior === "caster" ? 1 : 0) + (enemy.templateId === "abyssal_overlord" && enemy.phaseTwo ? 1 : 0),
      xp: template.xp + (enemy.elite ? Math.floor(template.xp * 0.45) : 0),
    };
  }

  summonEnemy(templateId, x, y, flags = {}) {
    const template = ENEMIES[templateId];
    const enemy = {
      id: `enemy-summon-${templateId}-${this.state.run.turn}-${Math.random().toString(36).slice(2, 7)}`,
      templateId,
      name: template.name,
      x,
      y,
      hp: template.hp,
      maxHp: template.hp,
      alerted: true,
      lastKnownPlayerPosition: { x: this.state.run.player.x, y: this.state.run.player.y },
      statuses: [],
      elite: false,
      turnCounter: 0,
      floorNumber: this.state.run.floorNumber,
      ...flags,
    };
    this.state.run.currentFloor.enemies.push(enemy);
    this.state.run.currentFloor.map[y][x].occupant = enemy.id;
    return enemy;
  }

  hasStatus(entity, statusId) {
    return entity.statuses?.some((status) => status.id === statusId) ?? false;
  }

  getStatusValue(entity, statusId) {
    return entity.statuses?.find((status) => status.id === statusId)?.value ?? 0;
  }

  upsertStatus(entity, status) {
    entity.statuses = entity.statuses ?? [];
    const existing = entity.statuses.find((entry) => entry.id === status.id);
    if (existing) {
      existing.turns = Math.max(existing.turns, status.turns);
      existing.value = Math.max(existing.value ?? 0, status.value ?? 0);
      return;
    }
    entity.statuses.push(status);
  }

  getPlayerCombatSnapshot() {
    const player = this.state.run.player;
    const derived = this.getDerivedStats(player);
    const hexed = this.hasStatus(player, "hexed");
    const chilled = this.hasStatus(player, "chilled");
    const manaShieldActive = derived.manaShieldDefense && player.mana / Math.max(1, derived.maxMana) >= 0.5;
    return {
      ...derived,
      defense: Math.max(0, derived.defense + (manaShieldActive ? derived.manaShieldDefense : 0) - (hexed ? 2 : 0)),
      accuracy: derived.accuracy - (chilled ? 6 : 0),
    };
  }

  getControlDurationBonus(player = this.state.run.player) {
    return this.getDerivedStats(player).controlDuration ?? 0;
  }

  isEncounterActive() {
    return this.state.run.currentFloor.enemies.some((enemy) => enemy.alerted);
  }

  movePlayer(dx, dy) {
    if (this.state.ui.overlay) return;
    const { run } = this.state;
    const targetX = run.player.x + dx;
    const targetY = run.player.y + dy;
    const tile = run.currentFloor.map[targetY]?.[targetX];
    if (!tile || tile.type !== "floor") return;

    const enemy = occupiedByEnemy(run.currentFloor, targetX, targetY);
    if (enemy) {
      this.performPlayerAttack(enemy, { type: "melee" });
      return;
    }

    run.player.x = targetX;
    run.player.y = targetY;
    run.player.lastAction = "move";
    this.pickUpItems();
    this.checkTrap();
    this.endPlayerTurn();
  }

  pickUpItems() {
    const tile = this.state.run.currentFloor.map[this.state.run.player.y][this.state.run.player.x];
    if (!tile.itemIds.length) return;
    for (const itemId of tile.itemIds) {
      this.state.run.player.inventory.push({ id: `inv-${Date.now()}-${itemId}-${Math.random()}`, itemId });
      this.log(`Picked up ${ITEMS[itemId].name}.`);
    }
    tile.itemIds = [];
  }

  checkTrap() {
    const trap = this.getTrapAt(this.state.run.player.x, this.state.run.player.y);
    if (!trap) return;
    const template = TRAPS[trap.templateId];
    trap.revealed = true;
    const derived = this.getDerivedStats(this.state.run.player);
    const reduction = derived.trapReductionPct ? 1 - derived.trapReductionPct / 100 : 1;
    const rng = createRng(hashSeed(this.state.run.turn, trap.id, "trap"));
    const rawDamage = Math.floor((rng.int(template.damage[0], template.damage[1]) - Math.floor(derived.defense / 2)) * reduction);
    const damage = template.damage[1] === 0 ? 0 : Math.max(1, rawDamage);
    if (damage > 0) {
      this.state.run.player.hp = Math.max(0, this.state.run.player.hp - damage);
      this.log(`${template.name} hits you for ${damage} damage.`);
    } else {
      this.log(`${template.name} is triggered.`);
    }
    if (template.status) {
      this.upsertStatus(this.state.run.player, { id: template.status, turns: 2, value: 1 });
      this.log(`${STATUS_DEFINITIONS[template.status]?.name ?? template.status} takes hold.`);
    }
    if (template.alerts) {
      for (const enemy of this.state.run.currentFloor.enemies) {
        if (manhattan(enemy, this.state.run.player) <= 8) {
          enemy.alerted = true;
          enemy.lastKnownPlayerPosition = { x: this.state.run.player.x, y: this.state.run.player.y };
        }
      }
      this.log("The alarm echoes through the halls.");
    }
    if (this.state.run.player.hp <= 0) this.handleDeath(`Killed by ${template.name}.`);
  }

  formatItemStats(itemId) {
    const item = ITEMS[itemId];
    if (!item) return "";
    const parts = [];
    if (item.damage) parts.push(`DMG ${item.damage[0]}-${item.damage[1]}`);
    if (typeof item.defense === "number") parts.push(`DEF ${item.defense}`);
    if (item.magicPower) parts.push(`MAG ${item.magicPower}`);
    if (item.accuracy) parts.push(`ACC ${item.accuracy > 0 ? `+${item.accuracy}` : item.accuracy}`);
    if (item.evasion) parts.push(`EVA ${item.evasion > 0 ? `+${item.evasion}` : item.evasion}`);
    if (item.bonus) {
      for (const [key, value] of Object.entries(item.bonus)) {
        if (key === "maxHpFlat") parts.push(`HP +${value}`);
        if (key === "maxManaFlat") parts.push(`Mana +${value}`);
        if (key === "magicPowerFlat") parts.push(`MAG +${value}`);
        if (key === "intelligenceFlat") parts.push(`INT +${value}`);
        if (key === "spellDamagePct") parts.push(`Spell +${value}%`);
      }
    }
    if (item.effect?.type === "heal") parts.push(`Heal ${item.effect.value}`);
    if (item.effect?.type === "mana") parts.push(`Mana ${item.effect.value}`);
    if (item.category === "tome") parts.push(`Learn ${SPELLS[item.spellId]?.name ?? item.spellId}`);
    if (item.enchantment?.type === "onHitBonusDamage") parts.push(`Enchant +${item.enchantment.value} hit`);
    if (item.enchantment?.type === "lifesteal") parts.push(`Enchant lifesteal ${item.enchantment.value}`);
    if (item.enchantment?.type === "sunderChance") parts.push(`Enchant ${Math.round(item.enchantment.chance * 100)}% sunder`);
    if (item.enchantment?.type === "spellBonusDamage") parts.push(`Enchant +${item.enchantment.value} spell`);
    if (item.enchantment?.type === "manaRefundChance") parts.push(`Enchant ${Math.round(item.enchantment.chance * 100)}% refund`);
    return parts.join(" | ");
  }

  getItemRarity(itemId) {
    const item = ITEMS[itemId];
    if (!item) return "common";
    return item.rarity ?? (item.value >= 60 ? "rare" : item.value >= 28 ? "uncommon" : "common");
  }

  getItemBadges(itemId) {
    const item = ITEMS[itemId];
    if (!item) return [];
    const badges = [
      { label: this.getItemRarity(itemId), tone: this.getItemRarity(itemId) },
      { label: item.category, tone: "muted" },
    ];
    if (item.classBias) {
      badges.push({ label: `${item.classBias} fit`, tone: item.classBias });
    }
    if (item.slot) {
      badges.push({ label: item.slot, tone: "muted" });
    }
    return badges;
  }

  getComparisonRows(itemId) {
    const item = ITEMS[itemId];
    if (!item?.slot) return [];
    const equippedId = this.state.run.player.equipment[item.slot];
    const equipped = equippedId ? ITEMS[equippedId] : null;
    if (!equipped) return [];

    const rows = [];
    const pushRow = (label, candidate, current) => {
      if ((candidate ?? 0) === (current ?? 0)) return;
      rows.push({
        label,
        candidate: candidate ?? 0,
        current: current ?? 0,
        delta: (candidate ?? 0) - (current ?? 0),
      });
    };

    if (item.damage || equipped.damage) {
      const candidate = item.damage ? (item.damage[0] + item.damage[1]) / 2 : 0;
      const current = equipped.damage ? (equipped.damage[0] + equipped.damage[1]) / 2 : 0;
      pushRow("Avg DMG", candidate, current);
    }
    pushRow("Defense", item.defense ?? 0, equipped.defense ?? 0);
    pushRow("Magic", item.magicPower ?? 0, equipped.magicPower ?? 0);
    pushRow("Accuracy", item.accuracy ?? 0, equipped.accuracy ?? 0);
    pushRow("Evasion", item.evasion ?? 0, equipped.evasion ?? 0);
    pushRow("HP", item.bonus?.maxHpFlat ?? 0, equipped.bonus?.maxHpFlat ?? 0);
    pushRow("Mana", item.bonus?.maxManaFlat ?? 0, equipped.bonus?.maxManaFlat ?? 0);
    pushRow("INT", item.bonus?.intelligenceFlat ?? 0, equipped.bonus?.intelligenceFlat ?? 0);
    pushRow("Spell %", item.bonus?.spellDamagePct ?? 0, equipped.bonus?.spellDamagePct ?? 0);
    pushRow("Spell Acc", item.bonus?.spellAccuracyFlat ?? 0, equipped.bonus?.spellAccuracyFlat ?? 0);
    return rows;
  }

  compareItemToEquipped(itemId) {
    const item = ITEMS[itemId];
    if (!item?.slot) return "";
    const equippedId = this.state.run.player.equipment[item.slot];
    if (!equippedId) return "Open slot.";
    const rows = this.getComparisonRows(itemId);
    return rows.length
      ? rows
        .slice(0, 3)
        .map((row) => `${row.label} ${row.delta > 0 ? `+${row.delta}` : row.delta}`)
        .join(" | ")
      : "Sidegrade.";
  }

  renderItemBadgeRow(itemId) {
    return this.getItemBadges(itemId)
      .map((badge) => `<span class="item-badge ${badge.tone}">${badge.label}</span>`)
      .join("");
  }

  renderStatsChipRow(itemId) {
    const parts = this.formatItemStats(itemId)
      .split(" | ")
      .filter(Boolean);
    if (!parts.length) return `<div class="chip-row"><span class="stat-chip muted">No direct stats</span></div>`;
    return `<div class="chip-row">${parts.map((part) => `<span class="stat-chip">${part}</span>`).join("")}</div>`;
  }

  renderComparisonTable(itemId) {
    const item = ITEMS[itemId];
    if (!item?.slot) return `<p class="muted">No equipment comparison for this item type.</p>`;
    const equippedId = this.state.run.player.equipment[item.slot];
    if (!equippedId) {
      return `
        <div class="compare-equipped-card">
          <span class="section-kicker">Equipped ${item.slot}</span>
          <strong>Empty slot</strong>
          <p class="muted">Any stats on this item will be a direct gain.</p>
        </div>
      `;
    }

    const equipped = ITEMS[equippedId];
    const rows = this.getComparisonRows(itemId);
    const tableRows = rows.length
      ? rows.map((row) => `
          <div class="compare-row">
            <span>${row.label}</span>
            <span>${row.current > 0 ? `+${row.current}` : row.current}</span>
            <span>${row.candidate > 0 ? `+${row.candidate}` : row.candidate}</span>
            <span class="${row.delta > 0 ? "positive" : "negative"}">${row.delta > 0 ? `+${row.delta}` : row.delta}</span>
          </div>
        `).join("")
      : `<p class="muted">This is effectively a sidegrade to your equipped ${item.slot}.</p>`;

    return `
      <div class="compare-equipped-card">
        <span class="section-kicker">Equipped ${item.slot}</span>
        <strong>${equipped.name}</strong>
        ${this.renderStatsChipRow(equippedId)}
      </div>
      <div class="compare-table">
        <div class="compare-row compare-head">
          <span>Stat</span>
          <span>Current</span>
          <span>New</span>
          <span>Delta</span>
        </div>
        ${tableRows}
      </div>
    `;
  }

  renderItemDetail(itemId, options = {}) {
    const item = ITEMS[itemId];
    if (!item) return "<p class=\"muted\">No item selected.</p>";
    const {
      action,
      actionLabel,
      actionDisabled = false,
      actionIndex = null,
      priceLabel = null,
      footer = "",
    } = options;

    const enchantmentLine = item.enchantment ? `<p class="positive">${item.description ?? this.getEnchantmentDescription(item)}</p>` : `<p class="muted">${item.description ?? "A dungeon-find worth considering."}</p>`;

    return `
      <div class="detail-card">
        <div class="detail-header">
          <div>
            <div class="item-badge-row">${this.renderItemBadgeRow(itemId)}</div>
            <h3>${item.name}</h3>
          </div>
          ${priceLabel ? `<div class="detail-price">${priceLabel}</div>` : ""}
        </div>
        ${this.renderStatsChipRow(itemId)}
        ${enchantmentLine}
        ${this.renderComparisonTable(itemId)}
        ${footer}
        ${action ? `<div class="detail-actions"><button class="primary" data-action="${action}" ${actionIndex !== null ? `data-index="${actionIndex}"` : ""} ${actionDisabled ? "disabled" : ""}>${actionLabel}</button></div>` : ""}
      </div>
    `;
  }

  getEnchantmentDescription(item) {
    if (!item?.enchantment) return "";
    switch (item.enchantment.type) {
      case "onHitBonusDamage":
        return `Enchantment: each hit deals ${item.enchantment.value} bonus damage.`;
      case "lifesteal":
        return `Enchantment: recover ${item.enchantment.value} HP on each melee hit.`;
      case "sunderChance":
        return `Enchantment: melee hits have a ${Math.round(item.enchantment.chance * 100)}% chance to Sunder enemies.`;
      case "spellBonusDamage":
        return `Enchantment: spells deal ${item.enchantment.value} bonus damage.`;
      case "manaRefundChance":
        return `Enchantment: spell hits have a ${Math.round(item.enchantment.chance * 100)}% chance to refund ${item.enchantment.value} mana.`;
      default:
        return "";
    }
  }

  getInventoryStacks() {
    const stacks = [];
    const indexByItemId = new Map();
    for (const [index, entry] of this.state.run.player.inventory.entries()) {
      const existingIndex = indexByItemId.get(entry.itemId);
      if (existingIndex !== undefined) {
        stacks[existingIndex].count += 1;
        stacks[existingIndex].indices.push(index);
        continue;
      }
      indexByItemId.set(entry.itemId, stacks.length);
      stacks.push({
        itemId: entry.itemId,
        count: 1,
        indices: [index],
      });
    }
    return stacks;
  }

  getInventoryStacksWithSellValue() {
    return this.getInventoryStacks().map((stack) => ({
      ...stack,
      sellValue: Math.max(1, Math.floor((ITEMS[stack.itemId]?.value ?? 0) * 0.45)),
    }));
  }

  performPlayerAttack(enemy, mode) {
    const player = this.state.run.player;
    const derived = this.getPlayerCombatSnapshot();
    const weapon = ITEMS[player.equipment.weapon];
    const enemyStats = this.getEnemyCombatStats(enemy);
    const rng = createRng(hashSeed(this.state.run.turn, enemy.id, mode.type));
    const enchantment = weapon?.enchantment ?? null;
    const hitChance = clamp((mode.type === "spell" ? 90 + (derived.spellAccuracyFlat ?? 0) : derived.accuracy) - (enemyStats.evasion ?? 0), 10, 95);
    if (!rng.chance(hitChance / 100)) {
      this.log(`You miss ${enemy.name}.`);
      this.endPlayerTurn();
      return;
    }

    let damage = 0;
    if (mode.type === "melee" || mode.type === "ability") {
      const momentumBonus = player.turnFlags.killMomentum ?? 0;
      const movedIntoPressureBonus = player.lastAction === "move" && derived.advanceDamagePct ? derived.advanceDamagePct / 100 : 0;
      const base = rng.int(weapon?.damage?.[0] ?? 1, weapon?.damage?.[1] ?? 2) + derived.meleeBonus + momentumBonus;
      damage = Math.max(1, Math.floor(base * (1 + derived.meleeDamagePct / 100)) - enemyStats.defense);
      damage = Math.max(1, Math.floor(damage * (1 + movedIntoPressureBonus)));
      if (mode.abilityId === "power_strike") damage += 3;
      if (mode.abilityId === "guard_break") damage += 1;
      if (enchantment?.type === "onHitBonusDamage") damage += enchantment.value;
      if (enemy.hp / enemy.maxHp <= 0.35 && derived.executioner) damage += Math.floor(damage * (derived.executioner / 100));
      if (player.hp / derived.maxHp <= 0.3 && derived.lowHpDamagePct) damage += Math.floor(damage * (derived.lowHpDamagePct / 100));
      if (momentumBonus) {
        player.turnFlags.killMomentum = 0;
      }
    } else if (mode.type === "spell") {
      const spell = SPELLS[mode.spellId];
      const firstSpellBonus = !enemy.firstSpellHitTaken && derived.firstSpellPct ? derived.firstSpellPct / 100 : 0;
      const base = rng.int(spell.damage[0], spell.damage[1]) + derived.spellBonus;
      damage = Math.max(1, Math.floor(base * (1 + derived.spellDamagePct / 100 + firstSpellBonus)) - enemyStats.defense);
      if (derived.evocationBonus && (enemy.hp / enemy.maxHp >= 0.75 || enemy.hp / enemy.maxHp <= 0.25)) {
        damage += Math.floor(damage * (derived.evocationBonus / 100));
      }
      if (derived.frailtyCurse && (this.hasStatus(enemy, "chilled") || this.hasStatus(enemy, "weakened"))) {
        damage += Math.floor(damage * (derived.frailtyCurse / 100));
      }
      if (enchantment?.type === "spellBonusDamage") {
        damage += enchantment.value;
      }
      enemy.firstSpellHitTaken = true;
    }

    enemy.hp -= damage;
    this.log(`You hit ${enemy.name} for ${damage} damage.`);
    if (mode.abilityId === "guard_break") {
      this.upsertStatus(enemy, { id: "sundered", turns: 3, value: 2 });
      this.log(`${enemy.name} is sundered.`);
    }
    if (mode.spellId === "frost_shard") {
      this.upsertStatus(enemy, { id: "chilled", turns: 2 + this.getControlDurationBonus(player), value: 1 });
      this.log(`${enemy.name} is chilled.`);
    }
    if (mode.spellId === "arcane_burst") {
      this.upsertStatus(enemy, { id: "weakened", turns: 2 + this.getControlDurationBonus(player), value: 1 });
      this.log(`${enemy.name} is weakened by the burst.`);
    }
    if (derived.weakenOnHit && mode.type !== "spell") {
      this.upsertStatus(enemy, { id: "weakened", turns: 1 + derived.weakenOnHit, value: 1 });
      this.log(`${enemy.name} is weakened.`);
    }
    if (mode.type !== "spell" && enchantment?.type === "lifesteal") {
      player.hp = Math.min(derived.maxHp, player.hp + enchantment.value);
      this.log(`${weapon.name} restores ${enchantment.value} HP.`);
    }
    if (mode.type !== "spell" && enchantment?.type === "sunderChance" && rng.chance(enchantment.chance)) {
      this.upsertStatus(enemy, { id: "sundered", turns: enchantment.turns, value: enchantment.value });
      this.log(`${weapon.name} tears through ${enemy.name}'s guard.`);
    }
    if (mode.type === "spell" && enchantment?.type === "manaRefundChance" && rng.chance(enchantment.chance)) {
      player.mana = Math.min(derived.maxMana, player.mana + enchantment.value);
      this.log(`${weapon.name} refunds ${enchantment.value} mana.`);
    }
    if (mode.abilityId === "power_strike" && derived.cleave) {
      const splashDamage = Math.max(1, Math.floor(damage * derived.cleave));
      const adjacentEnemies = this.state.run.currentFloor.enemies.filter((candidate) => candidate.id !== enemy.id && manhattan(candidate, enemy) === 1);
      for (const adjacent of adjacentEnemies.slice(0, 2)) {
        adjacent.hp -= splashDamage;
        this.log(`${adjacent.name} takes ${splashDamage} cleave damage.`);
        if (adjacent.hp <= 0) this.killEnemy(adjacent);
      }
    }
    this.state.run.currentTargetId = enemy.id;
    if (enemy.hp <= 0) this.killEnemy(enemy);
    this.endPlayerTurn();
  }

  killEnemy(enemy) {
    const floor = this.state.run.currentFloor;
    floor.map[enemy.y][enemy.x].occupant = null;
    floor.enemies = floor.enemies.filter((entry) => entry.id !== enemy.id);
    const enemyStats = this.getEnemyCombatStats(enemy);
    this.log(`${enemy.name} falls.`);
    this.state.run.runStats.kills += 1;
    const playerSnapshot = this.getPlayerCombatSnapshot();
    if (playerSnapshot.killMomentum) {
      this.state.run.player.turnFlags.killMomentum = playerSnapshot.killMomentum;
    }
    this.gainXp(enemyStats.xp);
    const rng = createRng(hashSeed(this.state.run.turn, enemy.id, "drop"));
    const drop = getDropForEnemy(enemy, rng, this.state.run.player.classId);
    this.state.run.player.gold += drop.gold;
    if (drop.gold) this.log(`You gather ${drop.gold} gold.`);
    for (const itemId of drop.items) {
      floor.map[enemy.y][enemy.x].itemIds.push(itemId);
      this.log(`${ITEMS[itemId].name} drops to the floor.`);
    }
  }

  gainXp(amount) {
    const player = this.state.run.player;
    if (player.level >= 10) return;
    player.xp += amount;
    while (player.level < 10 && player.xp >= this.getXpForLevel(player.level + 1)) {
      player.level += 1;
      player.skillPoints += 1;
      player.baseStats.strength += player.classId === "warrior" ? 1 : 0;
      player.baseStats.vitality += player.classId === "warrior" ? 1 : player.level % 3 === 0 ? 1 : 0;
      player.baseStats.dexterity += player.level % 2 === 0 ? 1 : 0;
      player.baseStats.intelligence += player.classId === "wizard" ? 1 : 0;
      const derived = this.getDerivedStats(player);
      player.hp = derived.maxHp;
      player.mana = derived.maxMana;
      this.log(`Level ${player.level}. You gain a skill point.`);
    }
  }

  useQuickSlot(index) {
    const entry = this.state.run?.player.quickSlots[index];
    if (!entry) return;
    if (SPELLS[entry]) {
      this.castAbility(entry);
      return;
    }
    this.useItemById(entry);
  }

  castAbility(spellId) {
    if (this.state.ui.overlay) return;
    const player = this.state.run.player;
    const derived = this.getPlayerCombatSnapshot();
    const spell = SPELLS[spellId];
    const utilitySpell = spellId === "arcane_shield" || spellId === "blink";
    const utilityDiscount = utilitySpell ? derived.utilityDiscount : 0;
    const freeUtility = utilitySpell && derived.freeUtility && !player.turnFlags.freeUtilityUsed;
    const cost = freeUtility ? 0 : Math.max(0, spell.cost - utilityDiscount);
    if (player.mana < cost) {
      this.log("Not enough mana.");
      return;
    }

    if (spellId === "arcane_shield") {
      player.mana -= cost;
      if (freeUtility) player.turnFlags.freeUtilityUsed = true;
      player.statuses = player.statuses.filter((status) => status.id !== "arcane_shield");
      player.statuses.push({ id: "arcane_shield", turns: 3 });
      this.log("Arcane Shield surrounds you.");
      this.endPlayerTurn();
      return;
    }

    if (spellId === "power_strike" || spellId === "guard_break") {
      const range = derived.chargeRange && spellId === "power_strike" ? derived.chargeRange : (spell.range ?? 1);
      const target = this.state.run.currentFloor.enemies
        .find((enemy) => manhattan(player, enemy) <= range);
      if (!target) {
        this.log("No enemy in range.");
        return;
      }
      player.mana -= cost;
      this.performPlayerAttack(target, { type: "ability", abilityId: spellId });
      return;
    }

    if (spellId === "blink") {
      const destination = this.findBlinkDestination();
      if (!destination) {
        this.log("Blink fizzles. No safe destination.");
        return;
      }
      player.mana -= cost;
      if (freeUtility) player.turnFlags.freeUtilityUsed = true;
      player.x = destination.x;
      player.y = destination.y;
      this.log("You blink through the dark.");
      this.pickUpItems();
      this.checkTrap();
      this.endPlayerTurn();
      return;
    }

    const target = this.findNearestVisibleEnemy(spell.range);
    if (!target) {
      this.log("No visible target in range.");
      return;
    }

    const shouldSpendMana = !(spell.type === "spell" && derived.freeCastChance && createRng(hashSeed(this.state.run.turn, spellId)).chance(derived.freeCastChance));
    if (shouldSpendMana) {
      player.mana -= cost;
    }
    this.performPlayerAttack(target, { type: "spell", spellId });
  }

  findBlinkDestination() {
    const { player, currentFloor } = this.state.run;
    const candidates = [];
    const range = 4 + (this.getDerivedStats(player).blinkRange ?? 0);
    for (let y = Math.max(0, player.y - range); y <= Math.min(currentFloor.height - 1, player.y + range); y += 1) {
      for (let x = Math.max(0, player.x - range); x <= Math.min(currentFloor.width - 1, player.x + range); x += 1) {
        const tile = currentFloor.map[y]?.[x];
        if (!tile || tile.type !== "floor" || tile.occupant || tile.vendor) continue;
        if (manhattan(player, { x, y }) >= 2 && manhattan(player, { x, y }) <= range) {
          candidates.push({ x, y });
        }
      }
    }
    if (!candidates.length) return null;
    const unsafe = currentFloor.enemies
      .map((enemy) => ({ candidate: null, distance: 0 }));
    return candidates.sort((a, b) => {
      const dangerA = currentFloor.enemies.reduce((sum, enemy) => sum + Math.max(0, 7 - manhattan(a, enemy)), 0);
      const dangerB = currentFloor.enemies.reduce((sum, enemy) => sum + Math.max(0, 7 - manhattan(b, enemy)), 0);
      return dangerA - dangerB;
    })[0];
  }

  findNearestVisibleEnemy(range) {
    const { player } = this.state.run;
    const visibleEnemies = this.state.run.currentFloor.enemies
      .filter((enemy) => manhattan(player, enemy) <= range && hasLineOfSight(this.state.run.currentFloor.map, player, enemy))
      .sort((a, b) => manhattan(player, a) - manhattan(player, b));
    return visibleEnemies[0] ?? null;
  }

  useItemById(itemId) {
    const player = this.state.run.player;
    const index = player.inventory.findIndex((entry) => entry.itemId === itemId);
    if (index === -1) {
      this.log("Item not in inventory.");
      return;
    }

    const item = ITEMS[itemId];
    if (item.category === "consumable") {
      if (item.effect.type === "heal") {
        const derived = this.getDerivedStats(player);
        player.hp = Math.min(derived.maxHp, player.hp + item.effect.value);
        this.log(`You recover ${item.effect.value} HP.`);
      } else if (item.effect.type === "mana") {
        const derived = this.getDerivedStats(player);
        player.mana = Math.min(derived.maxMana, player.mana + item.effect.value);
        this.log(`You recover ${item.effect.value} mana.`);
      } else if (item.effect.type === "escape") {
        const room = this.state.run.currentFloor.rooms[0];
        player.x = room.center.x;
        player.y = room.center.y;
        this.log("The scroll tears space and drags you to safety.");
      }
      player.inventory.splice(index, 1);
      this.endPlayerTurn();
      return;
    }

    if (item.category === "tome") {
      if (!player.learnedSpells.includes(item.spellId)) {
        player.learnedSpells.push(item.spellId);
        this.log(`Learned ${SPELLS[item.spellId].name}.`);
        const firstEmptySlot = player.quickSlots.findIndex((entry) => entry === null);
        if (firstEmptySlot !== -1) {
          player.quickSlots[firstEmptySlot] = item.spellId;
          this.log(`${SPELLS[item.spellId].name} was placed into quick slot ${firstEmptySlot + 1}.`);
        }
      }
      player.inventory.splice(index, 1);
      this.openInventory();
      return;
    }
  }

  interact() {
    const { player, currentFloor } = this.state.run;
    const tile = currentFloor.map[player.y][player.x];
    if (tile.stairs) {
      this.descend();
      return;
    }

    const chest = currentFloor.chests.find((entry) => entry.x === player.x && entry.y === player.y);
    if (chest && !chest.opened) {
      chest.opened = true;
      currentFloor.map[player.y][player.x].chestId = null;
      player.gold += chest.gold;
      this.log(`Chest opened. You collect ${chest.gold} gold.`);
      for (const itemId of chest.loot) {
        player.inventory.push({ id: `inv-${Date.now()}-${itemId}-${Math.random()}`, itemId });
        this.log(`Found ${ITEMS[itemId].name}.`);
      }
      return;
    }

    if (tile.vendor) {
      this.openVendor();
      return;
    }

    const shrine = this.getShrineAt(player.x, player.y);
    if (shrine && !shrine.used) {
      shrine.used = true;
      if (shrine.mode === "healing") {
        const derived = this.getDerivedStats(player);
        const amount = Math.floor(derived.maxHp * 0.45);
        player.hp = Math.min(derived.maxHp, player.hp + amount);
        this.log(`The shrine restores ${amount} HP.`);
      } else {
        const derived = this.getDerivedStats(player);
        const amount = Math.floor(derived.maxMana * 0.45);
        player.mana = Math.min(derived.maxMana, player.mana + amount);
        this.log(`The shrine restores ${amount} mana.`);
      }
      return;
    }
  }

  descend() {
    if (this.state.run.currentFloor.enemies.some((enemy) => ENEMIES[enemy.templateId]?.behavior === "boss")) {
      this.log("A boss blocks the way.");
      return;
    }
    const nextFloor = this.state.run.floorNumber + 1;
    if (nextFloor > 30) {
      this.handleVictory();
      return;
    }
    this.state.run.floorNumber = nextFloor;
    this.state.run.player.floorFlags = {};
    this.state.run.currentFloor = generateFloor(this.state.run.runSeed, nextFloor, this.state.run.player.classId);
    this.state.run.player.x = this.state.run.currentFloor.spawn.x;
    this.state.run.player.y = this.state.run.currentFloor.spawn.y;
    this.updateVisibility();
    this.log(`You descend to Floor ${nextFloor}.`);
    this.renderer?.showTransition(nextFloor === 30 ? "Floor 30 - Abyssal Throne" : `Floor ${nextFloor}`);
  }

  openInventory(selectedIndex = 0) {
    const stacks = this.getInventoryStacks();
    const safeIndex = stacks.length ? clamp(selectedIndex, 0, stacks.length - 1) : -1;
    const selectedStack = safeIndex >= 0 ? stacks[safeIndex] : null;
    const list = stacks.map((stack, index) => {
      const item = ITEMS[stack.itemId];
      const compare = this.compareItemToEquipped(stack.itemId);
      return `
        <button class="list-card compare-entry ${index === safeIndex ? "selected" : ""}" data-action="inventory-select" data-index="${index}">
          <div class="entry-topline">
            <strong>${item.name}${stack.count > 1 ? ` x${stack.count}` : ""}</strong>
            <span class="item-badge ${this.getItemRarity(stack.itemId)}">${this.getItemRarity(stack.itemId)}</span>
          </div>
          <p class="muted">${item.category}${item.slot ? ` • ${item.slot}` : ""}</p>
          <p class="muted">${this.formatItemStats(stack.itemId)}</p>
          ${compare ? `<p class="compare-summary ${compare === "Sidegrade." || compare === "Open slot." ? "muted" : ""}">${compare}</p>` : ""}
        </button>
      `;
    }).join("");

    const detail = selectedStack
      ? this.renderItemDetail(selectedStack.itemId, {
        action: "inventory-use",
        actionLabel: ITEMS[selectedStack.itemId].slot ? "Equip" : ITEMS[selectedStack.itemId].category === "tome" ? "Read Tome" : "Use Item",
        actionIndex: safeIndex,
        footer: selectedStack.count > 1 ? `<p class="muted">Stack size: ${selectedStack.count}</p>` : "",
      })
      : "<p>No items.</p>";

    this.state.ui.overlay = {
      type: "inventory",
      title: "Inventory",
      selectedIndex: safeIndex,
      html: stacks.length ? `
        <div class="compare-layout">
          <div class="compare-list">
            <div class="compare-list-header">
              <h3>Pack</h3>
              <span class="muted">${stacks.length} stack${stacks.length === 1 ? "" : "s"} • ${this.state.run.player.inventory.length} item${this.state.run.player.inventory.length === 1 ? "" : "s"}</span>
            </div>
            ${list}
          </div>
          <div class="compare-detail-pane">
            ${detail}
          </div>
        </div>
      ` : "<p>No items.</p>",
    };
  }

  openCharacter() {
    const player = this.state.run.player;
    const derived = this.getDerivedStats(player);
    this.state.ui.overlay = {
      type: "character",
      title: "Character",
      html: `
        <div class="stat-list">
          <div>Class: <strong>${CLASSES[player.classId].name}</strong></div>
          <div>Level: <strong>${player.level}</strong></div>
          <div>Strength: <strong>${derived.strength}</strong></div>
          <div>Dexterity: <strong>${derived.dexterity}</strong></div>
          <div>Vitality: <strong>${derived.vitality}</strong></div>
          <div>Intelligence: <strong>${derived.intelligence}</strong></div>
          <div>Defense: <strong>${derived.defense}</strong></div>
          <div>Melee Bonus: <strong>${derived.meleeBonus}</strong></div>
          <div>Spell Bonus: <strong>${derived.spellBonus}</strong></div>
          <div>Gold: <strong>${player.gold}</strong></div>
        </div>
        <p><button data-action="open-loadout">Manage Quick Slots</button></p>
      `,
    };
  }

  openLoadout() {
    const { player } = this.state.run;
    const learnedSpells = player.learnedSpells
      .filter((spellId) => SPELLS[spellId])
      .map((spellId) => ({
        id: spellId,
        label: `${SPELLS[spellId].name} (${SPELLS[spellId].cost} mana)`,
      }));
    const consumables = [...new Set(player.inventory
      .map((entry) => entry.itemId)
      .filter((itemId) => ITEMS[itemId]?.category === "consumable"))]
      .map((itemId) => ({
        id: itemId,
        label: `${ITEMS[itemId].name} x${player.inventory.filter((entry) => entry.itemId === itemId).length}`,
      }));
    const options = [...learnedSpells, ...consumables];
    const html = `
      <div class="overlay-grid">
        <div>
          <h3>Quick Slots</h3>
          ${player.quickSlots.map((entry, index) => `
            <div class="list-card">
              <strong>Slot ${index + 1}</strong>
              <p class="muted">${entry ? (SPELLS[entry]?.name ?? ITEMS[entry]?.name ?? entry) : "Empty"}</p>
              <button data-action="clear-slot" data-slot-index="${index}" ${entry ? "" : "disabled"}>Clear</button>
            </div>
          `).join("")}
        </div>
        <div>
          <h3>Assignable</h3>
          ${options.map((option) => `
            <div class="list-card">
              <strong>${option.label}</strong>
              <div class="loadout-assign-row">
                <button data-action="assign-slot" data-slot-index="0" data-entry-id="${option.id}">Slot 1</button>
                <button data-action="assign-slot" data-slot-index="1" data-entry-id="${option.id}">Slot 2</button>
                <button data-action="assign-slot" data-slot-index="2" data-entry-id="${option.id}">Slot 3</button>
              </div>
            </div>
          `).join("") || "<p>No learned spells or consumables available.</p>"}
        </div>
      </div>
    `;
    this.state.ui.overlay = { type: "loadout", title: "Quick Slot Loadout", html };
  }

  assignQuickSlot(slotIndex, entryId) {
    const player = this.state.run.player;
    if (!(entryId in SPELLS) && !(entryId in ITEMS)) return;
    player.quickSlots[slotIndex] = entryId;
    this.log(`Assigned ${SPELLS[entryId]?.name ?? ITEMS[entryId]?.name} to slot ${slotIndex + 1}.`);
    this.openLoadout();
  }

  clearQuickSlot(slotIndex) {
    this.state.run.player.quickSlots[slotIndex] = null;
    this.openLoadout();
  }

  openSkills() {
    const branches = SKILL_TREES[this.state.run.player.classId];
    const html = `
      <p>Unspent Skill Points: <strong>${this.state.run.player.skillPoints}</strong></p>
      <div class="overlay-grid">
        ${branches.map((branch) => `
          <div>
            <h3>${branch.name}</h3>
            ${branch.skills.map((skill, index) => {
              const unlocked = this.state.run.player.unlockedSkills.includes(skill.id);
              const previousId = index > 0 ? branch.skills[index - 1].id : null;
              const available = !unlocked && this.state.run.player.skillPoints > 0 && (!previousId || this.state.run.player.unlockedSkills.includes(previousId));
              return `
                <div class="list-card ${unlocked ? "selected" : ""}">
                  <strong>${skill.name}</strong>
                  <p class="muted">${skill.description}</p>
                  <button ${available ? "" : "disabled"} data-action="buy-skill" data-skill-id="${skill.id}">
                    ${unlocked ? "Unlocked" : available ? "Unlock" : "Locked"}
                  </button>
                </div>
              `;
            }).join("")}
          </div>
        `).join("")}
      </div>
    `;
    this.state.ui.overlay = { type: "skills", title: "Skill Tree", html };
  }

  buySkill(skillId) {
    const player = this.state.run.player;
    if (player.skillPoints < 1 || player.unlockedSkills.includes(skillId)) return;
    const branches = SKILL_TREES[player.classId];
    for (const branch of branches) {
      const index = branch.skills.findIndex((entry) => entry.id === skillId);
      if (index === -1) continue;
      if (index > 0 && !player.unlockedSkills.includes(branch.skills[index - 1].id)) return;
      player.unlockedSkills.push(skillId);
      player.skillPoints -= 1;
      const derived = this.getDerivedStats(player);
      player.hp = Math.min(derived.maxHp, player.hp + 2);
      player.mana = Math.min(derived.maxMana, player.mana + 2);
      this.log(`Unlocked ${branch.skills[index].name}.`);
      this.openSkills();
      return;
    }
  }

  equipInventoryIndex(index) {
    const stack = this.getInventoryStacks()[index];
    const entryIndex = stack?.indices[0];
    const entry = entryIndex !== undefined ? this.state.run.player.inventory[entryIndex] : null;
    if (!entry) return;
    const item = ITEMS[entry.itemId];
    if (!item.slot) {
      this.useItemById(entry.itemId);
      this.openInventory();
      return;
    }

    const player = this.state.run.player;
    const previous = player.equipment[item.slot];
    player.equipment[item.slot] = entry.itemId;
    if (previous) {
      const previousEntry = player.inventory.find((inventoryItem) => inventoryItem.itemId === previous);
      if (!previousEntry) {
        player.inventory.push({ id: `inv-${Date.now()}-${previous}`, itemId: previous });
      }
    }
    player.inventory.splice(entryIndex, 1);
    const derived = this.getDerivedStats(player);
    player.hp = Math.min(player.hp, derived.maxHp);
    player.mana = Math.min(player.mana, derived.maxMana);
    this.log(`Equipped ${item.name}.`);
    this.openInventory(Math.max(0, Math.min(index, this.getInventoryStacks().length - 1)));
  }

  openVendor(selectedIndex = 0) {
    const vendor = this.state.run.currentFloor.vendor;
    if (!vendor) return;
    const safeIndex = vendor.stock.length ? clamp(selectedIndex, 0, vendor.stock.length - 1) : -1;
    const selectedItemId = safeIndex >= 0 ? vendor.stock[safeIndex] : null;
    const vendorList = vendor.stock.map((itemId, index) => `
      <button class="list-card compare-entry ${index === safeIndex ? "selected" : ""}" data-action="vendor-select" data-index="${index}">
        <div class="entry-topline">
          <strong>${ITEMS[itemId].name}</strong>
          <span class="item-badge ${this.getItemRarity(itemId)}">${ITEMS[itemId].value}g</span>
        </div>
        <p class="muted">${ITEMS[itemId].category}${ITEMS[itemId].slot ? ` • ${ITEMS[itemId].slot}` : ""}</p>
        <p class="muted">${this.formatItemStats(itemId)}</p>
        <p class="compare-summary">${this.compareItemToEquipped(itemId)}</p>
      </button>
    `).join("");

    const sellStacks = this.getInventoryStacksWithSellValue();
    const sellable = sellStacks
      .map((stack, index) => `
        <div class="sell-row">
          <div>
            <strong>${ITEMS[stack.itemId].name}${stack.count > 1 ? ` x${stack.count}` : ""}</strong>
            <p class="muted">${stack.sellValue}g each${stack.count > 1 ? ` • ${stack.sellValue * stack.count}g total` : ""}</p>
          </div>
          <button data-action="vendor-sell" data-index="${index}">Sell</button>
        </div>
      `)
      .join("");

    const detail = selectedItemId
      ? this.renderItemDetail(selectedItemId, {
        action: "vendor-buy",
        actionLabel: "Buy",
        actionIndex: safeIndex,
        actionDisabled: this.state.run.player.gold < ITEMS[selectedItemId].value,
        priceLabel: `${ITEMS[selectedItemId].value}g`,
        footer: this.state.run.player.gold < ITEMS[selectedItemId].value
          ? `<p class="negative">You need ${ITEMS[selectedItemId].value - this.state.run.player.gold} more gold.</p>`
          : `<p class="positive">You can afford this item.</p>`,
      })
      : "<p>No items for sale.</p>";

    const html = `
      <div class="vendor-topline">
        <span>Your gold</span>
        <strong>${this.state.run.player.gold}g</strong>
      </div>
      <div class="compare-layout">
        <div class="compare-list">
          <div class="compare-list-header">
            <h3>Vendor Stock</h3>
            <span class="muted">${vendor.stock.length} item${vendor.stock.length === 1 ? "" : "s"}</span>
          </div>
          ${vendorList || "<p>No items for sale.</p>"}
        </div>
        <div class="compare-detail-pane">
          ${detail}
          <div class="detail-card sell-card">
            <div class="detail-header">
              <div>
                <span class="section-kicker">Sell</span>
                <h3>Your Pack</h3>
              </div>
            </div>
            ${sellable || "<p class=\"muted\">Nothing to sell.</p>"}
          </div>
        </div>
      </div>
    `;
    this.state.ui.overlay = { type: "vendor", title: "Vendor", selectedIndex: safeIndex, html };
  }

  vendorBuy(index) {
    const vendor = this.state.run.currentFloor.vendor;
    const itemId = vendor?.stock[index];
    if (!itemId) return;
    const item = ITEMS[itemId];
    if (this.state.run.player.gold < item.value) return;
    this.state.run.player.gold -= item.value;
    this.state.run.player.inventory.push({ id: `inv-${Date.now()}-${itemId}`, itemId });
    vendor.stock.splice(index, 1);
    this.log(`Bought ${item.name}.`);
    this.openVendor(index);
  }

  vendorSell(index) {
    const stack = this.getInventoryStacksWithSellValue()[index];
    const entryIndex = stack?.indices[0];
    const entry = entryIndex !== undefined ? this.state.run.player.inventory[entryIndex] : null;
    if (!entry) return;
    const item = ITEMS[entry.itemId];
    const value = Math.max(1, Math.floor(item.value * 0.45));
    this.state.run.player.gold += value;
    this.state.run.player.inventory.splice(entryIndex, 1);
    this.log(`Sold ${item.name} for ${value} gold.`);
    this.openVendor(this.state.ui.overlay?.selectedIndex ?? 0);
  }

  updateVisibility() {
    const { player, currentFloor } = this.state.run;
    const sight = 7 + (this.getDerivedStats(player).trapSense ?? 0);
    for (const row of currentFloor.map) {
      for (const tile of row) {
        tile.visible = false;
      }
    }

    for (let y = player.y - sight; y <= player.y + sight; y += 1) {
      for (let x = player.x - sight; x <= player.x + sight; x += 1) {
        const tile = currentFloor.map[y]?.[x];
        if (!tile) continue;
        if (manhattan(player, { x, y }) <= sight && hasLineOfSight(currentFloor.map, player, { x, y })) {
          tile.visible = true;
          tile.explored = true;
          const trap = this.getTrapAt(x, y);
          if (trap && manhattan(player, trap) <= 2 + (this.getDerivedStats(player).trapSense ?? 0)) {
            trap.revealed = true;
          }
        }
      }
    }
  }

  endPlayerTurn() {
    if (!this.state.run || this.state.mode !== "in_game") return;
    this.state.run.turn += 1;
    this.takeEnemyTurns();
    this.processStatuses();
    if (!this.isEncounterActive()) {
      this.state.run.player.turnFlags.freeUtilityUsed = false;
    }
    this.updateVisibility();
    if (this.state.run.player.hp <= 0) return;
    if (this.state.run.floorNumber === 10 && !this.state.run.currentFloor.enemies.length) {
      this.log("The Bone Captain is defeated. The deeper halls open.");
    }
  }

  processStatuses() {
    const player = this.state.run.player;
    const previousPlayerStatuses = [...player.statuses];
    player.statuses = player.statuses
      .map((status) => ({ ...status, turns: status.turns - 1 }))
      .filter((status) => status.turns > 0);
    for (const status of previousPlayerStatuses) {
      if (!player.statuses.some((entry) => entry.id === status.id)) {
        this.log(`${STATUS_DEFINITIONS[status.id]?.name ?? status.id} fades from you.`);
      }
    }
    for (const enemy of this.state.run.currentFloor.enemies) {
      const previousStatuses = [...enemy.statuses];
      enemy.statuses = enemy.statuses
        .map((status) => ({ ...status, turns: status.turns - 1 }))
        .filter((status) => status.turns > 0);
      if (this.state.run.currentTargetId === enemy.id) {
        for (const status of previousStatuses) {
          if (!enemy.statuses.some((entry) => entry.id === status.id)) {
            this.log(`${STATUS_DEFINITIONS[status.id]?.name ?? status.id} fades from ${enemy.name}.`);
          }
        }
      }
    }
  }

  takeEnemyTurns() {
    const { currentFloor, player } = this.state.run;
    for (const enemy of [...currentFloor.enemies]) {
      enemy.turnCounter += 1;
      const template = this.getEnemyCombatStats(enemy);
      const distance = manhattan(enemy, player);
      const detectionRange = template.behavior === "caster" ? (template.range ?? 6) : 7;
      const canSee = hasLineOfSight(currentFloor.map, enemy, player) && distance <= detectionRange;
      if (canSee) {
        enemy.alerted = true;
        enemy.lastKnownPlayerPosition = { x: player.x, y: player.y };
      }
      if (!enemy.alerted) continue;

      if (enemy.templateId === "abyssal_overlord" && !enemy.phaseTwo && enemy.hp <= enemy.maxHp / 2) {
        enemy.phaseTwo = true;
        this.log("The Abyssal Overlord erupts in shadowflame.");
        let summons = 0;
        while (summons < 2) {
          const summonTile = this.findAdjacentOpen(enemy.x, enemy.y);
          if (!summonTile) break;
          this.summonEnemy("infernal_imp", summonTile.x, summonTile.y);
          summons += 1;
        }
        if (summons) {
          this.log(`The Overlord tears open the void and summons ${summons} Infernal Imp${summons === 1 ? "" : "s"}.`);
        }
        continue;
      }

      if (enemy.templateId === "abyssal_overlord" && canSee && enemy.turnCounter % 3 === 2) {
        if (distance === 1) {
          this.log("The Abyssal Overlord draws back for a sweeping cleave.");
        } else if (distance <= (template.range ?? 6) + 1) {
          this.log("The Abyssal Overlord gathers abyssal fire.");
        }
      }

      if (enemy.templateId === "abyssal_overlord" && distance > 1 && canSee && distance <= (template.range ?? 6) && enemy.turnCounter % 3 === 0) {
        this.enemyAttack(enemy, "abyssal_bolt");
        if (player.hp <= 0) return;
        continue;
      }

      if (template.behavior === "boss" && distance === 1 && enemy.turnCounter % 3 === 0) {
        this.enemyAttack(enemy, "cleave");
        if (player.hp <= 0) return;
        continue;
      }

      if ((template.behavior === "melee" || template.behavior === "skirmisher" || template.behavior === "blocker" || template.behavior === "boss") && distance === 1) {
        this.enemyAttack(enemy);
        if (player.hp <= 0) return;
        continue;
      }

      if (template.behavior === "caster") {
        const preferredMinRange = enemy.templateId === "shaman" ? 4 : enemy.templateId === "infernal_imp" ? 2 : enemy.templateId === "cultist" ? 2 : 3;
        const castMinRange = enemy.templateId === "infernal_imp" || enemy.templateId === "cultist" ? 2 : 3;
        if (canSee && distance >= castMinRange && distance <= template.range) {
          this.enemyAttack(enemy, "spell");
          if (player.hp <= 0) return;
          continue;
        }
        if (distance < preferredMinRange) {
          const shouldRetreat = enemy.templateId === "cultist"
            ? distance === 1
            : true;
          if (!shouldRetreat && canSee && distance <= template.range) {
            this.enemyAttack(enemy, "spell");
            if (player.hp <= 0) return;
            continue;
          }
          const retreat = this.findRetreatTile(enemy);
          if (retreat) {
            currentFloor.map[enemy.y][enemy.x].occupant = null;
            enemy.x = retreat.x;
            enemy.y = retreat.y;
            currentFloor.map[enemy.y][enemy.x].occupant = enemy.id;
            continue;
          }
        }
      }

      if (enemy.templateId === "bone_captain" && template.behavior === "boss" && !enemy.summonUsed && enemy.hp <= enemy.maxHp / 2 && currentFloor.enemies.length < 3) {
        const summonTile = this.findAdjacentOpen(enemy.x, enemy.y);
        if (summonTile) {
          this.summonEnemy("skeleton", summonTile.x, summonTile.y);
          enemy.summonUsed = true;
          this.log("Bone Captain summons a Skeleton.");
          continue;
        }
      }

      const target = enemy.lastKnownPlayerPosition ?? player;
      const occupiedKeys = new Set(currentFloor.enemies.filter((entry) => entry.id !== enemy.id).map((entry) => toKey(entry.x, entry.y)));
      const path = pathfind(currentFloor.map, enemy, target, occupiedKeys);
      if (path && path.length > 1) {
        currentFloor.map[enemy.y][enemy.x].occupant = null;
        enemy.x = path[1].x;
        enemy.y = path[1].y;
        currentFloor.map[enemy.y][enemy.x].occupant = enemy.id;
      }
    }
  }

  findAdjacentOpen(x, y) {
    for (const delta of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const tile = this.state.run.currentFloor.map[y + delta.y]?.[x + delta.x];
      if (tile && tile.type === "floor" && !tile.occupant && !tile.vendor && !tile.stairs) {
        return { x: x + delta.x, y: y + delta.y };
      }
    }
    return null;
  }

  findRetreatTile(enemy) {
    const { player, currentFloor } = this.state.run;
    const candidates = [
      { x: enemy.x + 1, y: enemy.y },
      { x: enemy.x - 1, y: enemy.y },
      { x: enemy.x, y: enemy.y + 1 },
      { x: enemy.x, y: enemy.y - 1 },
    ]
      .filter((point) => {
        const tile = currentFloor.map[point.y]?.[point.x];
        return tile && tile.type === "floor" && !tile.occupant;
      })
      .sort((a, b) => manhattan(b, player) - manhattan(a, player));
    return candidates[0] ?? null;
  }

  enemyAttack(enemy, mode = "melee") {
    const player = this.state.run.player;
    const template = this.getEnemyCombatStats(enemy);
    const derived = this.getPlayerCombatSnapshot();
    const rng = createRng(hashSeed(this.state.run.turn, enemy.id, mode));
    const hitChance = clamp(template.accuracy - derived.evasion, 10, 95);
    if (!rng.chance(hitChance / 100)) {
      this.log(`${enemy.name} misses you.`);
      return;
    }

    let defense = derived.defense;
    if (player.statuses.some((status) => status.id === "arcane_shield")) defense += 2;
    if (player.lastAction === "wait" && derived.waitDefense) defense += derived.waitDefense;

    let damage = Math.max(1, rng.int(template.damage[0], template.damage[1]) - defense);
    if (mode === "cleave") damage += 3;
    if (mode === "abyssal_bolt") damage += 1;

    if (!player.floorFlags.firstHitTaken && derived.firstHitReduction) {
      damage = Math.max(1, Math.floor(damage * (1 - derived.firstHitReduction)));
      player.floorFlags.firstHitTaken = true;
    }
    if (!player.floorFlags.reactiveWardUsed && derived.reactiveWard) {
      player.floorFlags.reactiveWardUsed = true;
      player.hp = Math.min(derived.maxHp, player.hp + derived.reactiveWard);
      this.log("Reactive Ward softens the impact.");
    }
    if (!player.floorFlags.archmageBarrierUsed && derived.archmageBarrier && player.hp / derived.maxHp <= 0.3) {
      damage = Math.max(1, Math.floor(damage * (1 - derived.archmageBarrier)));
      player.floorFlags.archmageBarrierUsed = true;
    }

    player.hp -= damage;
    if (mode === "spell" || mode === "abyssal_bolt") {
      const spellName = mode === "abyssal_bolt"
        ? "Abyssal Bolt"
        : enemy.templateId === "shaman"
          ? "Hexfire"
          : enemy.templateId === "cultist"
            ? "Shadow Bolt"
            : enemy.templateId === "infernal_imp"
              ? "Cinder Hex"
              : "Spell";
      this.log(`${enemy.name} casts ${spellName} for ${damage} damage.`);
    } else {
      this.log(`${enemy.name} hits you for ${damage} damage.`);
    }
    if (mode === "spell" && enemy.templateId === "shaman" && rng.chance(0.5)) {
      this.upsertStatus(player, { id: "hexed", turns: 2, value: 1 });
      this.log("You are hexed.");
    }
    if (mode === "spell" && enemy.templateId === "cultist" && rng.chance(0.35)) {
      this.upsertStatus(player, { id: "weakened", turns: 2, value: 1 });
      this.log("Shadow clings to you. You are weakened.");
    }
    if (mode === "spell" && enemy.templateId === "infernal_imp" && rng.chance(0.4)) {
      this.upsertStatus(player, { id: "chilled", turns: 2, value: 1 });
      this.log("Scorching cinders blind and chill you.");
    }
    if (mode === "abyssal_bolt") {
      if (rng.chance(enemy.phaseTwo ? 0.6 : 0.4)) {
        this.upsertStatus(player, { id: "hexed", turns: 2, value: 1 });
        this.log("Abyssal fire hexes you.");
      }
      if (enemy.phaseTwo && rng.chance(0.35)) {
        this.upsertStatus(player, { id: "weakened", turns: 2, value: 1 });
        this.log("Your strength buckles under the void's pressure.");
      }
    }
    if (mode === "cleave" && enemy.templateId === "abyssal_overlord" && rng.chance(0.5)) {
      this.upsertStatus(player, { id: "weakened", turns: 2, value: 1 });
      this.log("The Overlord's cleave leaves you reeling.");
    }
    this.state.run.currentTargetId = enemy.id;
    if (player.hp <= 0) this.handleDeath(`Slain by ${enemy.name}.`);
  }

  handleDeath(message) {
    this.log(message);
    this.state.mode = "in_game";
    this.state.ui.overlay = {
      type: "death",
      dismissible: false,
      title: "You Died",
      html: `
        <p>${message}</p>
        <p>Floor reached: <strong>${this.state.run.floorNumber}</strong></p>
        <p>Level reached: <strong>${this.state.run.player.level}</strong></p>
        <p>Enemies defeated: <strong>${this.state.run.runStats.kills}</strong></p>
        <p>Every run resets from Floor 1.</p>
        <button data-action="new-run-from-death">Start New Run</button>
        <button data-action="main-menu">Main Menu</button>
      `,
    };
  }

  handleVictory() {
    const { player, floorNumber, runStats, turn } = this.state.run;
    const unlockedSkills = player.unlockedSkills.length;
    const learnedSpells = player.learnedSpells.filter((spellId) => SPELLS[spellId]).length;
    const victoryHeadline = floorNumber >= 30
      ? "The Abyssal Overlord is slain. The dungeon finally falls silent."
      : `You reached Floor ${floorNumber} and cleared the current Milestone 2 build.`;
    const victoryFooter = floorNumber >= 30
      ? "One run. No checkpoints. Full clear."
      : "The full Floor 30 final-boss run is still reserved for Milestone 3.";
    this.state.ui.overlay = {
      type: "victory",
      dismissible: false,
      title: floorNumber >= 30 ? "Dungeon Cleared" : "Milestone 2 Clear",
      html: `
        <p>${victoryHeadline}</p>
        <div class="detail-list">
          <div>Class: <strong>${CLASSES[player.classId].name}</strong></div>
          <div>Level: <strong>${player.level}</strong></div>
          <div>Enemies defeated: <strong>${runStats.kills}</strong></div>
          <div>Gold carried: <strong>${player.gold}</strong></div>
          <div>Skills unlocked: <strong>${unlockedSkills}</strong></div>
          <div>Spells learned: <strong>${learnedSpells}</strong></div>
          <div>Turns taken: <strong>${turn}</strong></div>
          <div>Max floor reached: <strong>${floorNumber}</strong></div>
        </div>
        <p>${victoryFooter}</p>
        <button data-action="new-run-from-death">Start New Run</button>
        <button data-action="main-menu">Main Menu</button>
      `,
    };
  }

  closeOverlay() {
    if (this.state.ui.overlay && this.state.ui.overlay.dismissible === false) return;
    this.state.ui.overlay = null;
  }

  handleOverlayAction(action, payload) {
    switch (action) {
      case "inventory-use":
        this.equipInventoryIndex(Number(payload.index));
        break;
      case "inventory-select":
        this.openInventory(Number(payload.index));
        break;
      case "open-loadout":
        this.openLoadout();
        break;
      case "buy-skill":
        this.buySkill(payload.skillId);
        break;
      case "assign-slot":
        this.assignQuickSlot(Number(payload.slotIndex), payload.entryId);
        break;
      case "clear-slot":
        this.clearQuickSlot(Number(payload.slotIndex));
        break;
      case "vendor-buy":
        this.vendorBuy(Number(payload.index));
        break;
      case "vendor-select":
        this.openVendor(Number(payload.index));
        break;
      case "vendor-sell":
        this.vendorSell(Number(payload.index));
        break;
      case "new-run-from-death":
        this.state.mode = "class";
        this.state.ui.overlay = null;
        break;
      case "main-menu":
        this.state.mode = "menu";
        this.state.run = null;
        this.state.ui.overlay = null;
        this.state.logs = ["Begin a new run to enter the dungeon."];
        break;
      default:
        break;
    }
  }
}
