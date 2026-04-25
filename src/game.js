import { BOONS, BOSS_REWARDS, CHEST_TABLE, CLASSES, ENEMIES, ITEMS, SKILL_TREES, SPELLS, STATUS_DEFINITIONS, TRAPS } from "./data.js";
import { attachVaultFeaturesToFloor, generateFloor, getDropForEnemy } from "./generator.js";
import { getItemSprite } from "./assets.js";
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
  return floor.enemies.find((enemy) => enemy.x === x && enemy.y === y && !enemy.disguised);
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
      if (!tile || tile.type !== "floor" || tile.hole || tile.shrineId) continue;
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
    this.sageName = "The Grey Witness";
    this.state = {
      mode: "menu",
      run: null,
      ui: { overlay: null, selectedId: null, npcDialog: null },
      logs: ["Begin a new run to enter the dungeon."],
    };
    this.renderer = null;
    this.highScoreStorageKey = "dungeon30_high_scores";
    this.blockedNameTerms = [
      "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "fag", "faggot", "slut",
      "whore", "asshole", "motherfucker", "dick", "cock", "pussy", "penis", "vagina",
      "rape", "rapist", "cum", "jizz", "tits",
    ];
  }

  attachRenderer(renderer) {
    this.renderer = renderer;
  }

  setMode(mode) {
    this.state.mode = mode;
  }

  getFloorTransitionBanner(floorNumber) {
    const bossFloorTitles = {
      0: "The Sage Waits",
      10: "Floor 10 - Super Skeletor's Lair",
      20: "Floor 20 - The Stitching Pit",
      30: "Floor 30 - Abyssal Throne",
    };
    return bossFloorTitles[floorNumber] ?? `Floor ${floorNumber}`;
  }

  getBossFloorEntryLine(floorNumber) {
    const lines = {
      10: "The air turns cold. Bone and gravefire wait below the first seal.",
      20: "The walls tighten with stitches and old pain. Something flesh-bound waits ahead.",
      30: "The throne waits below. Whether you come as executioner or successor is no longer clear.",
    };
    return lines[floorNumber] ?? null;
  }

  getBossSightLine(templateId) {
    const lines = {
      bone_captain: "Super Skeletor turns, as if he had been expecting someone worthy to descend this far.",
      patches: "Patches lurches forward from the stitched dark, guarding the next threshold like a butchered sentinel.",
      abyssal_overlord: "The Abyssal Overlord rises before the throne. For a moment, it is unclear whether it bars your path or judges your claim.",
    };
    return lines[templateId] ?? null;
  }

  getBoonDefinition(boonId) {
    return BOONS[boonId] ?? null;
  }

  getNegativeStatusIds() {
    return ["chilled", "sundered", "weakened", "hexed", "poisoned"];
  }

  getBoonChoices(classId, runSeed) {
    const rng = createRng(hashSeed(runSeed, classId, "boons"));
    const pool = Object.keys(BOONS);
    const picks = [];
    while (pool.length && picks.length < 3) {
      picks.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    }
    return picks;
  }

  getSageFarewellLine(runSeed, boonId) {
    const lines = [
      "A gift, and a burden. Descend. The throne below is never empty for long.",
      "Choose well, delver. The dungeon remembers every debt and every heir.",
      "Good luck. You will need more than that before the throne takes notice.",
      "Take this blessing. Spend it before the dark spends you, or seats you.",
    ];
    return lines[hashSeed(runSeed, boonId, "sage-line") % lines.length];
  }

  createVaultPlan(runSeed) {
    const rng = createRng(hashSeed(runSeed, "vault-plan"));
    const bands = [
      { id: "crypt", label: "Crypt Vault", floorStart: 1, floorEnd: 9, keyItemId: "crypt_vault_key" },
      { id: "sunken", label: "Sunken Vault", floorStart: 11, floorEnd: 19, keyItemId: "sunken_vault_key" },
      { id: "void", label: "Void Vault", floorStart: 21, floorEnd: 29, keyItemId: "void_vault_key" },
    ];
    return bands.map((band) => {
      const vaultFloor = rng.int(band.floorStart, band.floorEnd);
      const keyFloor = rng.int(band.floorStart, vaultFloor);
      return {
        ...band,
        chestId: `vault-${band.id}`,
        vaultFloor,
        keyFloor,
        keyCollected: false,
        opened: false,
      };
    });
  }

  hasVaultKey(keyItemId) {
    return Boolean(this.state.run?.vaultPlan?.some((entry) => entry.keyItemId === keyItemId && entry.keyCollected));
  }

  collectVaultKey(itemId) {
    const vault = this.state.run?.vaultPlan?.find((entry) => entry.keyItemId === itemId);
    if (!vault || vault.keyCollected) return;
    vault.keyCollected = true;
    this.log(`You uncover the ${ITEMS[itemId].name}.`);
    this.showNpcDialog("Hidden Cache", `${ITEMS[itemId].name} found. Somewhere below, ${vault.label.toLowerCase()} can now be opened.`, 2600);
  }

  getVendorGreeting(vendor, runSeed, floorNumber) {
    const dialogueByArchetype = {
      wary_peddler: [
        "Coin first. Complaints later.",
        "Buy while the lantern still burns.",
        "First ten floors teach caution. I sell some.",
      ],
      roadside_chapman: [
        "You look half-dead. Good. Half-dead still pays.",
        "I've seen worse delvers. Not many lived longer.",
        "Spend now. Regret later.",
      ],
      lantern_trader: [
        "Keep your flame fed and the dark may blink first.",
        "Take what light you can carry.",
        "Down here, a potion is worth more than pride.",
      ],
      ragpicker_broker: [
        "Everything down here has an owner. Today it can be you.",
        "Deep floors reward the prepared and bury the rest.",
        "Buy quickly. These halls never stay quiet.",
      ],
      tunnel_apothecary: [
        "I sell cures, tonics, and one or two bad decisions.",
        "If the poison doesn't get you, the price might.",
        "These mixtures sting less than dying.",
      ],
      grave_merchant: [
        "The dead leave excellent inventory behind.",
        "If you survive, come back richer.",
        "The deeper halls always collect interest.",
      ],
      ash_dealer: [
        "Ash, steel, and nerve. That's all anyone brings this deep.",
        "Past this point, the dungeon stops bluffing.",
        "Spend like this is your last market. It may be.",
      ],
      void_huckster: [
        "The void strips fools first. Buy accordingly.",
        "I trade in certainties: pain, prices, and poor odds.",
        "Even the Overlord's halls have customers.",
      ],
      ember_factor: [
        "Embers die fast down here. So do bargains.",
        "Take what you need before the throne takes you.",
        "You've made it far enough to know cheap gear won't save you.",
      ],
    };
    const lines = dialogueByArchetype[vendor?.archetypeId] ?? [
      "Coin first. Complaints later.",
      "Buy quickly. These halls never stay quiet.",
      "If you're going deeper, spend like you mean to survive.",
    ];
    return lines[hashSeed(runSeed, floorNumber, vendor?.archetypeId ?? "vendor-line") % lines.length];
  }

  createSageChamber(runSeed, classId) {
    const width = 15;
    const height = 11;
    const map = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => ({
        type: x === 0 || y === 0 || x === width - 1 || y === height - 1 ? "wall" : "floor",
        visible: false,
        explored: false,
        secretDoor: false,
        occupant: null,
        itemIds: [],
        stairs: false,
        chestId: null,
        vendor: false,
        shrineId: null,
      }))
    );

    const room = { id: 0, x: 1, y: 1, width: 13, height: 9, center: { x: 7, y: 5 }, type: "sage" };
    return {
      floorNumber: 0,
      theme: "sage",
      seed: hashSeed(runSeed, "sage-chamber"),
      width,
      height,
      map,
      rooms: [room],
      enemies: [],
      traps: [],
      chests: [],
      vendor: null,
      shrine: null,
      spawn: { x: 7, y: 8 },
      exit: { x: 7, y: 2 },
      sage: {
        name: this.sageName,
        x: 7,
        y: 4,
        actorId: "sage",
        vanished: false,
        choices: this.getBoonChoices(classId, runSeed),
      },
    };
  }

  getChestBoonPool(floorNumber, playerClassId) {
    const tiers = [];
    tiers.push(...CHEST_TABLE.common);
    if (floorNumber >= 6) tiers.push(...CHEST_TABLE.rare);
    if (floorNumber >= 12) tiers.push(...CHEST_TABLE.deep);
    if (floorNumber >= 21) tiers.push(...CHEST_TABLE.endgame);
    const classPool = tiers.filter((itemId) => {
      const item = ITEMS[itemId];
      return item && (!item.classBias || item.classBias === playerClassId);
    });
    return classPool.length ? classPool : tiers;
  }

  applyBoonFloorAdjustments(floorData, floorNumber, player) {
    const boonId = player.boonId;
    if (!boonId || floorNumber < 1) return floorData;
    const rng = createRng(hashSeed(this.state.run?.runSeed ?? floorData.seed, floorNumber, boonId, "boon-floor"));

    if (boonId === "fortunes_ledger" && floorData.vendor) {
      const vendorPool = this.getChestBoonPool(floorNumber, player.classId)
        .filter((itemId) => !floorData.vendor.stock.includes(itemId) || rng.chance(0.35));
      for (let index = 0; index < 2; index += 1) {
        if (!vendorPool.length) break;
        floorData.vendor.stock.push(rng.pick(vendorPool));
      }
    }

    if (boonId === "treasure_sense" && floorData.chests?.length) {
      const chestPool = this.getChestBoonPool(floorNumber, player.classId);
      for (const chest of floorData.chests) {
        const candidates = chestPool.filter((itemId) => !chest.loot.includes(itemId));
        const extraItem = rng.pick(candidates.length ? candidates : chestPool);
        if (extraItem) {
          chest.loot.push(extraItem);
        }
      }
    }

    return floorData;
  }

  applyRunFloorAdjustments(floorData, floorNumber, player) {
    if (floorNumber < 1) return floorData;
    attachVaultFeaturesToFloor(
      floorData,
      this.state.run?.runSeed ?? floorData.seed,
      floorNumber,
      player.classId,
      this.state.run?.vaultPlan ?? []
    );
    return this.applyBoonFloorAdjustments(floorData, floorNumber, player);
  }

  openSageChoice() {
    const sage = this.state.run?.currentFloor?.sage;
    if (!sage || sage.vanished) return;
    const choices = sage.choices
      .map((boonId) => {
        const boon = BOONS[boonId];
        return `
          <button class="class-card boon-card" data-action="choose-boon" data-boon-id="${boon.id}">
            <span class="class-role">Sage's Gift</span>
            <strong class="class-name">${boon.name}</strong>
            <span class="class-flavor">${boon.description}</span>
            <span class="class-traits">${boon.summary}</span>
          </button>
        `;
      })
      .join("");
    this.state.ui.overlay = {
      type: "boon-choice",
      dismissible: false,
      title: this.sageName,
      html: `
        <p class="muted">${this.sageName} offers three gifts. Accept one and carry its burden below.</p>
        <div class="class-grid boon-grid">
          ${choices}
        </div>
      `,
    };
  }

  chooseBoon(boonId) {
    const run = this.state.run;
    const boon = BOONS[boonId];
    if (!run || !boon || run.player.boonId) return;
    run.player.boonId = boonId;
    run.player.boonState = { sageEchoCount: 0 };
    const sage = run.currentFloor.sage;
    if (sage) sage.vanished = true;
    const exitTile = run.currentFloor.map[run.currentFloor.exit.y]?.[run.currentFloor.exit.x];
    if (exitTile) exitTile.stairs = true;
    const derived = this.getDerivedStats(run.player);
    run.player.hp = Math.min(derived.maxHp, run.player.hp + (boonId === "stoneblood" ? 18 : 0));
    run.player.mana = Math.min(derived.maxMana, run.player.mana + (boonId === "deep_wells" ? 14 : 0));
    const farewell = this.getSageFarewellLine(run.runSeed, boonId);
    this.showNpcDialog(this.sageName, farewell, 3200);
    this.log(`${this.sageName} grants ${boon.name}.`);
    this.log(`${this.sageName} fades, revealing the stairs to Floor 1.`);
    this.state.ui.overlay = {
      type: "sage-farewell",
      dismissible: false,
      title: this.sageName,
      html: `
        <p>${boon.description}</p>
        <p><strong>${boon.summary}</strong></p>
        <p class="muted">${farewell}</p>
        <button class="primary" data-action="close-sage-message">Continue</button>
      `,
    };
  }

  triggerRelentlessStep() {
    const player = this.state.run.player;
    if (player.boonId !== "relentless_step" || player.floorFlags.relentlessStepUsed || player.hp <= 0) return;
    const derived = this.getDerivedStats(player);
    if (player.hp / Math.max(1, derived.maxHp) > 0.25) return;
    player.floorFlags.relentlessStepUsed = true;
    player.hp = Math.min(derived.maxHp, player.hp + 10);
    this.log("Relentless Step surges through you. You recover 10 HP.");
  }

  log(message) {
    this.state.logs.push(message);
  }

  showNpcDialog(speaker, text, duration = 2600) {
    this.state.ui.npcDialog = {
      speaker,
      text,
      until: Date.now() + duration,
    };
  }

  normalizePlayerName(name) {
    return String(name ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 18);
  }

  containsBlockedNameTerm(name) {
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return this.blockedNameTerms.some((term) => normalized.includes(term));
  }

  getHighScores() {
    try {
      const raw = window.localStorage.getItem(this.highScoreStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  setHighScores(entries) {
    try {
      window.localStorage.setItem(this.highScoreStorageKey, JSON.stringify(entries));
    } catch {
      // Ignore storage failures and keep the run playable.
    }
  }

  getStackIndexByItemId(stacks, itemId, fallbackIndex = 0) {
    const foundIndex = stacks.findIndex((stack) => stack.itemId === itemId);
    if (foundIndex !== -1) return foundIndex;
    if (!stacks.length) return -1;
    return clamp(fallbackIndex, 0, stacks.length - 1);
  }

  calculateRunScore(run, result) {
    const victoryBonus = result === "victory" ? 1500 : 0;
    return (run.floorNumber * 120)
      + (run.player.level * 90)
      + (run.runStats.kills * 12)
      + run.player.gold
      + victoryBonus;
  }

  renderHighScoreList(limit = 10) {
    const scores = this.getHighScores().slice(0, limit);
    if (!scores.length) {
      return "<p class=\"muted\">No delvers recorded yet.</p>";
    }
    return `
      <div class="scoreboard">
        ${scores.map((entry, index) => `
          <div class="score-row">
            <div>
              <strong>#${index + 1} ${entry.name}</strong>
              <p class="muted">${entry.result === "victory" ? "Dungeon Cleared" : `Killed by ${entry.cause}`}</p>
            </div>
            <div class="score-meta">
              <span>${entry.score} pts</span>
              <span>F${entry.floor}</span>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  buildRunSummary(run, cause, result) {
    return {
      score: this.calculateRunScore(run, result),
      floor: run.floorNumber,
      level: run.player.level,
      kills: run.runStats.kills,
      gold: run.player.gold,
      turns: run.turn,
      className: CLASSES[run.player.classId].name,
      cause,
      result,
    };
  }

  saveHighScore(playerName, summary) {
    const normalizedName = this.normalizePlayerName(playerName);
    if (normalizedName.length < 2) {
      return { ok: false, error: "Enter a name with at least 2 characters." };
    }
    if (this.containsBlockedNameTerm(normalizedName)) {
      return { ok: false, error: "That name is not allowed. Choose something else." };
    }
    const nextScores = [
      {
        name: normalizedName,
        score: summary.score,
        floor: summary.floor,
        level: summary.level,
        kills: summary.kills,
        gold: summary.gold,
        turns: summary.turns,
        className: summary.className,
        cause: summary.cause,
        result: summary.result,
        recordedAt: new Date().toISOString(),
      },
      ...this.getHighScores(),
    ]
      .sort((a, b) => b.score - a.score || b.floor - a.floor || b.kills - a.kills)
      .slice(0, 20);
    this.setHighScores(nextScores);
    return { ok: true, name: normalizedName };
  }

  renderScoreSaveSection(summary, options = {}) {
    const { feedback = "", feedbackTone = "muted", savedName = "" } = options;
    return `
      <div class="detail-card score-save-card">
        <div class="detail-header">
          <div>
            <span class="section-kicker">High Score</span>
            <h3>Record This Run</h3>
          </div>
          <div class="detail-price">${summary.score} pts</div>
        </div>
        <div class="detail-list">
          <div>Floor: <strong>${summary.floor}</strong></div>
          <div>Level: <strong>${summary.level}</strong></div>
          <div>Kills: <strong>${summary.kills}</strong></div>
          <div>Gold: <strong>${summary.gold}</strong></div>
          <div>Cause: <strong>${summary.cause}</strong></div>
          <div>Class: <strong>${summary.className}</strong></div>
        </div>
        <div class="score-save-row">
          <input id="score-name-input" class="score-name-input" type="text" maxlength="18" placeholder="Enter your name" value="${savedName ? this.escapeTooltip(savedName).replaceAll("&#10;", "") : ""}">
          <button class="primary" data-action="save-score">Save Score</button>
        </div>
        ${feedback ? `<p class="${feedbackTone}">${feedback}</p>` : `<p class="muted">Names with vulgar language are blocked.</p>`}
      </div>
      <div class="detail-card">
        <div class="detail-header">
          <div>
            <span class="section-kicker">Leaderboard</span>
            <h3>Top Delvers</h3>
          </div>
        </div>
        ${this.renderHighScoreList(8)}
      </div>
    `;
  }

  openHighScores() {
    this.state.mode = "scores";
    this.state.ui.overlay = null;
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
      equipment: { weapon: null, armor: null, hands: null, accessory: null },
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
      boonId: null,
      boonState: {},
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
    const floorData = this.createSageChamber(runSeed, classId);
    player.x = floorData.spawn.x;
    player.y = floorData.spawn.y;

    this.state.run = {
      runSeed,
      floorNumber: 0,
      turn: 0,
      player,
      vaultPlan: this.createVaultPlan(runSeed),
      currentFloor: floorData,
      runStats: { kills: 0 },
      currentTargetId: null,
    };
    this.updateVisibility();
    this.state.logs = [
      `${this.sageName} waits before the first descent.`,
      "Approach the sage and press Enter to choose a boon.",
    ];
    this.state.ui.overlay = null;
    this.state.mode = "in_game";
    this.renderer?.showTransition(this.getFloorTransitionBanner(0));
  }

  getDerivedStats(player) {
    const classDef = CLASSES[player.classId];
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
      rangedDamagePct: 0,
      spellDamagePct: classDef.spellDamageBonusPct ?? 0,
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

    switch (player.boonId) {
      case "vicious_star":
        stats.critBonus += 12;
        break;
      case "iron_remnant":
        stats.defenseFlat += 2;
        break;
      case "stoneblood":
        stats.maxHpFlat += 18;
        break;
      case "deep_wells":
        stats.maxManaFlat += 14;
        break;
      default:
        break;
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
      meleeBonus: Math.floor(stats.strength / 3),
      rangedBonus: Math.floor(stats.dexterity / 3),
      spellBonus: Math.floor(stats.intelligence / 2) + stats.magicPowerFlat + (classDef.spellPowerBonus ?? 0),
    };
  }

  applyResourceCapDelta(player, previousDerived, nextDerived) {
    const hpDelta = (nextDerived?.maxHp ?? 0) - (previousDerived?.maxHp ?? 0);
    const manaDelta = (nextDerived?.maxMana ?? 0) - (previousDerived?.maxMana ?? 0);
    player.hp = clamp(player.hp + hpDelta, 0, nextDerived.maxHp);
    player.mana = clamp(player.mana + manaDelta, 0, nextDerived.maxMana);
  }

  getHandsItem(player = this.state.run?.player) {
    const handsId = player?.equipment?.hands;
    return handsId ? ITEMS[handsId] : null;
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

  getAdjacentShrine(x, y) {
    const shrine = this.state.run?.currentFloor.shrine;
    if (!shrine) return null;
    if (Math.abs(shrine.x - x) + Math.abs(shrine.y - y) <= 1) return shrine;
    return null;
  }

  getEnemyCombatStats(enemy) {
    const template = ENEMIES[enemy.templateId];
    const sundered = this.getStatusValue(enemy, "sundered");
    const chilled = this.hasStatus(enemy, "chilled");
    const weakened = this.hasStatus(enemy, "weakened");
    const eliteDamageBonus = enemy.elite ? 1 : 0;
    const phaseAccuracyBonus = enemy.templateId === "abyssal_overlord" && enemy.phaseTwo ? 4 : 0;
    const phaseDefenseBonus = enemy.templateId === "abyssal_overlord" && enemy.phaseTwo ? 2 : 0;
    const phaseDamageBonus = enemy.templateId === "abyssal_overlord" && enemy.phaseTwo ? 2 : 0;
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
    if (entity === this.state.run?.player && status.id !== "arcane_shield") {
      if (this.getNegativeStatusIds().includes(status.id) && this.state.run.player.boonId === "ward_of_ash") {
        const boonRng = createRng(hashSeed(this.state.run.turn, status.id, "ward-of-ash"));
        if (boonRng.chance(0.6)) {
          this.log(`Ward of Ash repels ${STATUS_DEFINITIONS[status.id]?.name ?? status.id}.`);
          return;
        }
      }
      const hands = this.getHandsItem(entity);
      const effect = hands?.handsEffect;
      if (effect?.type === "ignoreSpellStatusChance" && status.source === "enemySpell") {
        const rng = createRng(hashSeed(this.state.run.turn, status.id, hands.id));
        if (rng.chance(effect.chance)) {
          this.log(`${hands.name} repels the incoming ${STATUS_DEFINITIONS[status.id]?.name ?? status.id}.`);
          return;
        }
      }
      if (effect?.type === "shortenStatus" && effect.statusId === status.id) {
        status.turns = Math.max(1, status.turns - effect.amount);
      }
      if (effect?.type === "shortenNegativeStatuses") {
        status.turns = Math.max(1, status.turns - effect.amount);
      }
    }
    entity.statuses = entity.statuses ?? [];
    const existing = entity.statuses.find((entry) => entry.id === status.id);
    if (existing) {
      existing.turns = Math.max(existing.turns, status.turns);
      existing.value = Math.max(existing.value ?? 0, status.value ?? 0);
      existing.fresh = true;
      return;
    }
    entity.statuses.push({ ...status, fresh: true });
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
    if (!tile) return;
    if (tile.type !== "floor" || tile.hole || tile.shrineId) {
      if (tile.secretDoor) {
        tile.secretDoor = false;
        tile.type = "floor";
        this.log("A hidden seam gives way. A secret passage opens.");
      } else {
        return;
      }
    }

    const enemy = occupiedByEnemy(run.currentFloor, targetX, targetY);
    if (enemy) {
      this.performPlayerAttack(enemy, { type: "melee" });
      return;
    }

    const sage = run.currentFloor.sage;
    if (sage && !sage.vanished && sage.x === targetX && sage.y === targetY) {
      this.showNpcDialog(this.sageName, "One gift. One burden. Step close and choose.", 2600);
      return;
    }

    const mimicNearby = run.currentFloor.enemies.find((e) => e.templateId === "mimic" && e.disguised && Math.abs(e.x - targetX) <= 1 && Math.abs(e.y - targetY) <= 1 && (e.x !== targetX || e.y !== targetY));
    if (mimicNearby) {
      run.player.x = targetX;
      run.player.y = targetY;
      run.player.lastAction = "move";
      mimicNearby.disguised = false;
      mimicNearby.alerted = true;
      mimicNearby.lastKnownPlayerPosition = { x: run.player.x, y: run.player.y };
      run.currentFloor.map[mimicNearby.y][mimicNearby.x].chestId = null;
      this.log("The chest shudders... then lunges. It was never treasure.");
      this.endPlayerTurn();
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
      if (ITEMS[itemId]?.category === "quest") {
        this.collectVaultKey(itemId);
        continue;
      }
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
      this.renderer?.queueDamagePopup({ x: this.state.run.player.x, y: this.state.run.player.y, damage, type: "player" });
      this.log(`${template.name} hits you for ${damage} damage.`);
    } else {
      this.log(`${template.name} is triggered.`);
    }
    if (template.status) {
      const statusTurns = template.status === "poisoned" ? 4 : 2;
      this.upsertStatus(this.state.run.player, { id: template.status, turns: statusTurns, value: 1 });
      this.log(`${STATUS_DEFINITIONS[template.status]?.name ?? template.status} takes hold.`);
    }
    if (template.alerts) {
      let newlyAlerted = 0;
      for (const enemy of this.state.run.currentFloor.enemies) {
        const wasAlerted = enemy.alerted;
        enemy.alerted = true;
        enemy.lastKnownPlayerPosition = { x: this.state.run.player.x, y: this.state.run.player.y };
        if (!wasAlerted) {
          newlyAlerted += 1;
        }
      }
      this.log(newlyAlerted
        ? `The alarm echoes through the halls. ${newlyAlerted} enem${newlyAlerted === 1 ? "y stirs" : "ies stir"}.`
        : "The alarm echoes through the halls.");
    }
    this.triggerRelentlessStep();
    if (this.state.run.player.hp <= 0) this.handleDeath(`Killed by ${template.name}.`);
  }

  formatItemStats(itemId) {
    const item = ITEMS[itemId];
    if (!item) return "";
    const parts = [];
    if (item.damage) parts.push(`DMG ${item.damage[0]}-${item.damage[1]}`);
    if (item.range) parts.push(`RNG ${item.range}`);
    if (typeof item.defense === "number") parts.push(`DEF ${item.defense}`);
    if (item.magicPower) parts.push(`MAG ${item.magicPower}`);
    if (item.accuracy) parts.push(`ACC ${item.accuracy > 0 ? `+${item.accuracy}` : item.accuracy}`);
    if (item.evasion) parts.push(`EVA ${item.evasion > 0 ? `+${item.evasion}` : item.evasion}`);
    if (item.bonus) {
      for (const [key, value] of Object.entries(item.bonus)) {
        if (key === "maxHpFlat") parts.push(`HP +${value}`);
        if (key === "maxManaFlat") parts.push(`Mana +${value}`);
        if (key === "defenseFlat") parts.push(`DEF +${value}`);
        if (key === "accuracyFlat") parts.push(`ACC +${value}`);
        if (key === "magicPowerFlat") parts.push(`MAG +${value}`);
        if (key === "intelligenceFlat") parts.push(`INT +${value}`);
        if (key === "controlDuration") parts.push(`Control +${value}`);
        if (key === "meleeDamagePct") parts.push(`Melee +${value}%`);
        if (key === "spellDamagePct") parts.push(`Spell +${value}%`);
        if (key === "rangedDamagePct") parts.push(`Ranged +${value}%`);
        if (key === "evasionFlat") parts.push(`EVA +${value}`);
      }
    }
    if (item.effect?.type === "heal") parts.push(`Heal ${item.effect.value}`);
    if (item.effect?.type === "mana") parts.push(`Mana ${item.effect.value}`);
    if (item.category === "tome") parts.push(`Learn ${SPELLS[item.spellId]?.name ?? item.spellId}`);
    if (item.enchantment?.type === "onHitBonusDamage") parts.push(`Enchant +${item.enchantment.value} hit`);
    if (item.enchantment?.type === "lifesteal") parts.push(`Enchant lifesteal ${item.enchantment.value}`);
    if (item.enchantment?.type === "healOnKill") parts.push(`Enchant heal ${item.enchantment.value} on kill`);
    if (item.enchantment?.type === "sunderChance") parts.push(`Enchant ${Math.round(item.enchantment.chance * 100)}% sunder`);
    if (item.enchantment?.type === "spellBonusDamage") parts.push(`Enchant +${item.enchantment.value} spell`);
    if (item.enchantment?.type === "manaRefundChance") parts.push(`Enchant ${Math.round(item.enchantment.chance * 100)}% refund`);
    if (item.enchantment?.type === "rangedPoisonProc") parts.push(`Enchant ${Math.round(item.enchantment.chance * 100)}% poison`);
    if (item.handsEffect?.type === "meleeStatusProc") parts.push(`${Math.round(item.handsEffect.chance * 100)}% ${item.handsEffect.statusId}`);
    if (item.handsEffect?.type === "spellStatusProc") parts.push(`${Math.round(item.handsEffect.chance * 100)}% ${item.handsEffect.statusId}`);
    if (item.handsEffect?.type === "rangedStatusProc") parts.push(`${Math.round(item.handsEffect.chance * 100)}% ${item.handsEffect.statusId}`);
    if (item.handsEffect?.type === "ignoreSpellStatusChance") parts.push(`${Math.round(item.handsEffect.chance * 100)}% ward`);
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
    pushRow("DEF+", item.bonus?.defenseFlat ?? 0, equipped.bonus?.defenseFlat ?? 0);
    pushRow("ACC+", item.bonus?.accuracyFlat ?? 0, equipped.bonus?.accuracyFlat ?? 0);
    pushRow("INT", item.bonus?.intelligenceFlat ?? 0, equipped.bonus?.intelligenceFlat ?? 0);
    pushRow("Melee %", item.bonus?.meleeDamagePct ?? 0, equipped.bonus?.meleeDamagePct ?? 0);
    pushRow("Spell %", item.bonus?.spellDamagePct ?? 0, equipped.bonus?.spellDamagePct ?? 0);
    pushRow("Spell Acc", item.bonus?.spellAccuracyFlat ?? 0, equipped.bonus?.spellAccuracyFlat ?? 0);
    pushRow("Range", item.range ?? 0, equipped.range ?? 0);
    pushRow("Ranged %", item.bonus?.rangedDamagePct ?? 0, equipped.bonus?.rangedDamagePct ?? 0);
    pushRow("EVA+", item.bonus?.evasionFlat ?? 0, equipped.bonus?.evasionFlat ?? 0);
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

  escapeTooltip(text) {
    return String(text ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\n", "&#10;");
  }

  getSpellTooltip(entryId) {
    const spell = SPELLS[entryId];
    if (!spell) return "";
    const parts = [spell.name, spell.description];
    if (typeof spell.cost === "number") parts.push(`Cost: ${spell.cost} mana`);
    if (typeof spell.range === "number") parts.push(`Range: ${spell.range === 0 ? "Self" : spell.range}`);
    if (spell.damage) parts.push(`Damage: ${spell.damage[0]}-${spell.damage[1]}`);
    return parts.join("\n");
  }

  getItemTooltip(itemId, options = {}) {
    const item = ITEMS[itemId];
    if (!item) return "";
    const parts = [item.name];
    if (options.stackCount > 1) {
      parts.push(`Stack: ${options.stackCount}`);
    }
    if (item.category) {
      parts.push(`Type: ${item.category}${item.slot ? ` (${item.slot})` : ""}`);
    }
    const stats = this.formatItemStats(itemId);
    if (stats) {
      parts.push(stats.replaceAll(" | ", "\n"));
    }
    if (item.enchantment) {
      parts.push(item.description ?? this.getEnchantmentDescription(item));
    } else if (item.effect?.type === "heal") {
      parts.push(`Restores ${item.effect.value} HP.`);
    } else if (item.effect?.type === "mana") {
      parts.push(`Restores ${item.effect.value} mana.`);
    } else if (item.effect?.type === "escape") {
      parts.push("Teleports you back to the floor's start room.");
    } else if (item.category === "tome" && item.spellId) {
      parts.push(`Teaches ${SPELLS[item.spellId]?.name ?? item.spellId}.`);
    } else if (item.description) {
      parts.push(item.description);
    }
    if (options.includeCompare) {
      const compare = this.compareItemToEquipped(itemId);
      if (compare) parts.push(`Compare: ${compare}`);
    }
    if (options.includeValue && typeof item.value === "number") {
      parts.push(`Value: ${item.value}g`);
    }
    if (options.sellValue) {
      parts.push(`Sell: ${options.sellValue}g each`);
    }
    return parts.join("\n");
  }

  getSkillTooltip(skill, branchName, unlocked, available) {
    const parts = [
      skill.name,
      branchName,
      skill.description,
      unlocked ? "Status: Unlocked" : available ? "Status: Ready to unlock" : "Status: Locked",
    ];
    return parts.join("\n");
  }

  renderItemIcon(itemId, className = "inventory-tile-icon") {
    const iconPath = this.renderer?.assets?.manifest ? getItemSprite(this.renderer.assets.manifest, itemId) : null;
    if (iconPath) {
      return `<img src="${iconPath}" alt="" class="${className}">`;
    }
    return `<span class="${className} inventory-tile-fallback">${ITEMS[itemId]?.name?.[0] ?? "?"}</span>`;
  }

  renderItemBadgeRow(itemId) {
    return this.getItemBadges(itemId)
      .map((badge) => `<span class="item-badge ${badge.tone}" data-tooltip="${this.escapeTooltip(`${ITEMS[itemId]?.name ?? "Item"}\n${badge.label}`)}">${badge.label}</span>`)
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
      case "healOnKill":
        return `Enchantment: killing an enemy restores ${item.enchantment.value} HP.`;
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

  maybeApplyHandsEffect(enemy, mode, rng) {
    const hands = this.getHandsItem();
    const effect = hands?.handsEffect;
    if (!effect) return;
    if (effect.type === "meleeStatusProc" && mode.type !== "spell" && rng.chance(effect.chance)) {
      this.upsertStatus(enemy, { id: effect.statusId, turns: effect.turns, value: effect.value });
      this.log(`${hands.name} inflicts ${STATUS_DEFINITIONS[effect.statusId]?.name ?? effect.statusId}.`);
    }
    if (effect.type === "spellStatusProc" && mode.type === "spell" && rng.chance(effect.chance)) {
      this.upsertStatus(enemy, { id: effect.statusId, turns: effect.turns, value: effect.value });
      this.log(`${hands.name} inflicts ${STATUS_DEFINITIONS[effect.statusId]?.name ?? effect.statusId}.`);
    }
    if (effect.type === "rangedStatusProc" && (mode.type === "ranged" || mode.type === "ranged_ability") && rng.chance(effect.chance)) {
      this.upsertStatus(enemy, { id: effect.statusId, turns: effect.turns, value: effect.value });
      this.log(`${hands.name} inflicts ${STATUS_DEFINITIONS[effect.statusId]?.name ?? effect.statusId}.`);
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
      sellValue: Math.max(1, Math.floor((ITEMS[stack.itemId]?.value ?? 0) * 0.25)),
    }));
  }

  getVendorBuyPrice(itemId) {
    const item = ITEMS[itemId];
    if (!item) return 0;
    const rarity = this.getItemRarity(itemId);
    const multiplier = rarity === "boss" ? 1.4 : rarity === "rare" ? 1.25 : 1;
    return Math.max(1, Math.floor(item.value * multiplier));
  }

  getVendorStacks() {
    const vendor = this.state.run.currentFloor.vendor;
    if (!vendor) return [];
    const stacks = [];
    const indexByItemId = new Map();
    for (const [index, itemId] of vendor.stock.entries()) {
      const existingIndex = indexByItemId.get(itemId);
      if (existingIndex !== undefined) {
        stacks[existingIndex].count += 1;
        stacks[existingIndex].indices.push(index);
        continue;
      }
      indexByItemId.set(itemId, stacks.length);
      stacks.push({
        itemId,
        count: 1,
        indices: [index],
      });
    }
    return stacks;
  }

  fireRangedWeapon() {
    if (this.state.ui.overlay) return;
    const player = this.state.run.player;
    const weapon = ITEMS[player.equipment.weapon];
    if (!weapon?.range) {
      this.log("You need a ranged weapon to fire.");
      return;
    }
    const target = this.findNearestVisibleEnemy(weapon.range);
    if (!target) {
      this.log("No target in range.");
      return;
    }
    player.lastAction = "attack";
    this.performPlayerAttack(target, { type: "ranged" });
  }

  performPlayerAttack(enemy, mode, options = {}) {
    const { endTurn = true, damageMultiplier = 1, projectileFrom = null } = options;
    const player = this.state.run.player;
    const derived = this.getPlayerCombatSnapshot();
    const weapon = ITEMS[player.equipment.weapon];
    const enemyStats = this.getEnemyCombatStats(enemy);
    const rng = createRng(hashSeed(this.state.run.turn, enemy.id, mode.type));
    const enchantment = weapon?.enchantment ?? null;
    const hitChance = clamp((mode.type === "spell" ? 90 + (derived.spellAccuracyFlat ?? 0) : derived.accuracy) - (enemyStats.evasion ?? 0), 10, 95);
    if (!rng.chance(hitChance / 100)) {
      if (mode.type === "spell") {
        this.renderer?.queueProjectile({
          kind: mode.spellId,
          from: projectileFrom ?? { x: player.x, y: player.y },
          to: { x: enemy.x, y: enemy.y },
        });
      }
      this.log(`You miss ${enemy.name}.`);
      if (endTurn) this.endPlayerTurn();
      return { hit: false, damage: 0, killed: false, targetId: enemy.id };
    }

    let damage = 0;
    if (mode.type === "melee" || mode.type === "ability") {
      const momentumBonus = player.turnFlags.killMomentum ?? 0;
      const boonBattleTrance = player.turnFlags.boonBattleTrance ?? 0;
      const movedIntoPressureBonus = player.lastAction === "move" && derived.advanceDamagePct ? derived.advanceDamagePct / 100 : 0;
      const base = rng.int(weapon?.damage?.[0] ?? 1, weapon?.damage?.[1] ?? 2) + derived.meleeBonus + momentumBonus + boonBattleTrance;
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
    } else if (mode.type === "ranged" || mode.type === "ranged_ability") {
      this.renderer?.queueProjectile({
        kind: "arrow",
        from: projectileFrom ?? { x: player.x, y: player.y },
        to: { x: enemy.x, y: enemy.y },
      });
      const momentumBonus = player.turnFlags.killMomentum ?? 0;
      const boonBattleTrance = player.turnFlags.boonBattleTrance ?? 0;
      const movedIntoPressureBonus = player.lastAction === "move" && derived.advanceDamagePct ? derived.advanceDamagePct / 100 : 0;
      const base = rng.int(weapon?.damage?.[0] ?? 1, weapon?.damage?.[1] ?? 2) + derived.rangedBonus + momentumBonus + boonBattleTrance;
      damage = Math.max(1, Math.floor(base * (1 + (derived.rangedDamagePct ?? 0) / 100)) - enemyStats.defense);
      damage = Math.max(1, Math.floor(damage * (1 + movedIntoPressureBonus)));
      if (mode.abilityId === "aimed_shot") {
        damage += 3;
        const armorPen = derived.aimedShotArmorPen ?? 0;
        if (armorPen) damage += Math.min(armorPen, enemyStats.defense);
      }
      if (enchantment?.type === "onHitBonusDamage") damage += enchantment.value;
      if (enemy.hp / enemy.maxHp <= 0.35 && derived.executioner) damage += Math.floor(damage * (derived.executioner / 100));
      if (player.hp / derived.maxHp <= 0.3 && derived.lowHpDamagePct) damage += Math.floor(damage * (derived.lowHpDamagePct / 100));
      if (momentumBonus) player.turnFlags.killMomentum = 0;
      if (derived.rangedPoisonChance || enchantment?.type === "rangedPoisonProc") {
        const poisonChance = (derived.rangedPoisonChance ?? 0) + (enchantment?.type === "rangedPoisonProc" ? enchantment.chance : 0);
        if (rng.chance(Math.min(poisonChance, 0.5))) {
          const turns = enchantment?.type === "rangedPoisonProc" ? enchantment.turns : 3;
          this.upsertStatus(enemy, { id: "poisoned", turns, value: 1 });
          this.log(`${enemy.name} is poisoned.`);
        }
      }
    } else if (mode.type === "spell") {
      const spell = SPELLS[mode.spellId];
      this.renderer?.queueProjectile({
        kind: mode.spellId,
        from: projectileFrom ?? { x: player.x, y: player.y },
        to: { x: enemy.x, y: enemy.y },
      });
      const firstSpellBonus = !enemy.firstSpellHitTaken && derived.firstSpellPct ? derived.firstSpellPct / 100 : 0;
      const base = rng.int(spell.damage[0], spell.damage[1]) + derived.spellBonus + (player.turnFlags.boonBattleTrance ?? 0);
      damage = Math.max(1, Math.floor(base * (1 + derived.spellDamagePct / 100 + firstSpellBonus)) - enemyStats.defense);
      if (derived.evocationBonus && (enemy.hp / enemy.maxHp >= 0.75 || enemy.hp / enemy.maxHp <= 0.25)) {
        damage += Math.floor(damage * (derived.evocationBonus / 100));
      }
      if (derived.frailtyCurse && (this.hasStatus(enemy, "chilled") || this.hasStatus(enemy, "weakened"))) {
        damage += Math.floor(damage * (derived.frailtyCurse / 100));
      }
      if (mode.spellId === "ice_shatter" && this.hasStatus(enemy, "chilled")) {
        damage += 4 + this.getControlDurationBonus(player);
      }
      if (enchantment?.type === "spellBonusDamage") {
        damage += enchantment.value;
      }
      enemy.firstSpellHitTaken = true;
    }

    const critChance = clamp(5 + (derived.critBonus ?? 0), 5, 45);
    const criticalHit = rng.chance(critChance / 100);
    if (criticalHit) {
      damage = Math.max(1, Math.floor(damage * 1.5));
    }
    damage = Math.max(1, Math.floor(damage * damageMultiplier));

    enemy.hp -= damage;
    this.renderer?.queueDamagePopup({ x: enemy.x, y: enemy.y, damage, type: "enemy", critical: criticalHit });
    this.log(`You ${criticalHit ? "critically strike" : "hit"} ${enemy.name} for ${damage} damage.`);
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
    if (mode.spellId === "ice_shatter" && this.hasStatus(enemy, "chilled")) {
      enemy.statuses = enemy.statuses.filter((status) => status.id !== "chilled");
      this.log(`${enemy.name}'s chill shatters violently.`);
    }
    if (mode.spellId === "frailty_hex") {
      this.upsertStatus(enemy, { id: "hexed", turns: 2 + this.getControlDurationBonus(player), value: 1 });
      this.upsertStatus(enemy, { id: "weakened", turns: 2, value: 1 });
      this.log(`${enemy.name} is hexed and weakened.`);
    }
    this.maybeApplyHandsEffect(enemy, mode, rng);
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
    if (player.turnFlags.boonBattleTrance) {
      player.turnFlags.boonBattleTrance = 0;
    }
    if (mode.abilityId === "power_strike" && derived.cleave) {
      const splashDamage = Math.max(1, Math.floor(damage * derived.cleave));
      const adjacentEnemies = this.state.run.currentFloor.enemies.filter((candidate) => candidate.id !== enemy.id && manhattan(candidate, enemy) === 1);
      for (const adjacent of adjacentEnemies.slice(0, 2)) {
        adjacent.hp -= splashDamage;
        this.renderer?.queueDamagePopup({ x: adjacent.x, y: adjacent.y, damage: splashDamage, type: "enemy" });
        this.log(`${adjacent.name} takes ${splashDamage} cleave damage.`);
        if (adjacent.hp <= 0) this.killEnemy(adjacent);
      }
    }
    if ((mode.type === "ranged" || mode.type === "ranged_ability") && player.boonId === "phantom_quiver") {
      if (!player.boonState.phantomCount) player.boonState.phantomCount = 0;
      player.boonState.phantomCount += 1;
      if (player.boonState.phantomCount >= 4) {
        player.boonState.phantomCount = 0;
        const phantomTarget = this.state.run.currentFloor.enemies.find(
          (e) => e.id !== enemy.id && e.hp > 0 && manhattan(e, player) <= (weapon?.range ?? 4) && hasLineOfSight(this.state.run.currentFloor.map, player, e)
        );
        if (phantomTarget) {
          const phantomDamage = Math.max(1, Math.floor(damage * 0.5));
          phantomTarget.hp -= phantomDamage;
          this.renderer?.queueProjectile({ kind: "arrow", from: { x: player.x, y: player.y }, to: { x: phantomTarget.x, y: phantomTarget.y } });
          this.renderer?.queueDamagePopup({ x: phantomTarget.x, y: phantomTarget.y, damage: phantomDamage, type: "enemy" });
          this.log(`A phantom arrow strikes ${phantomTarget.name} for ${phantomDamage} damage.`);
          if (phantomTarget.hp <= 0) this.killEnemy(phantomTarget);
        }
      }
    }
    this.state.run.currentTargetId = enemy.id;
    const killed = enemy.hp <= 0;
    if (killed) this.killEnemy(enemy);
    if (endTurn) this.endPlayerTurn();
    return { hit: true, damage, killed, targetId: enemy.id };
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
    if (this.state.run.player.boonId === "battle_trance") {
      this.state.run.player.turnFlags.boonBattleTrance = 2;
    }
    if (this.state.run.player.boonId === "crimson_hunger") {
      const derived = this.getDerivedStats(this.state.run.player);
      this.state.run.player.hp = Math.min(derived.maxHp, this.state.run.player.hp + 2);
      this.log("Crimson Hunger restores 2 HP.");
    }
    const weapon = ITEMS[this.state.run.player.equipment.weapon];
    if (weapon?.enchantment?.type === "healOnKill") {
      const derived = this.getDerivedStats(this.state.run.player);
      this.state.run.player.hp = Math.min(derived.maxHp, this.state.run.player.hp + weapon.enchantment.value);
      this.log(`${weapon.name} restores ${weapon.enchantment.value} HP on the kill.`);
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
    const bonusXp = player.boonId === "grave_insight" ? Math.floor(amount * 0.2) : 0;
    player.xp += amount + bonusXp;
    while (player.level < 10 && player.xp >= this.getXpForLevel(player.level + 1)) {
      player.level += 1;
      player.skillPoints += 1;
      player.baseStats.strength += player.classId === "warrior" ? 1 : 0;
      player.baseStats.vitality += player.classId === "warrior" ? 1 : player.level % 3 === 0 ? 1 : 0;
      player.baseStats.dexterity += player.classId === "ranger" ? 1 : player.level % 2 === 0 ? 1 : 0;
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
    const sageEchoCount = player.boonState.sageEchoCount ?? 0;
    const sageEchoFree = spell.type === "spell" && player.boonId === "sages_echo" && (sageEchoCount + 1) % 3 === 0;
    const utilitySpell = spellId === "arcane_shield" || spellId === "blink";
    const utilityDiscount = utilitySpell ? derived.utilityDiscount : 0;
    const freeUtility = utilitySpell && derived.freeUtility && !player.turnFlags.freeUtilityUsed;
    const cost = (freeUtility || sageEchoFree) ? 0 : Math.max(0, spell.cost - utilityDiscount);
    if (player.mana < cost) {
      this.log("Not enough mana.");
      return;
    }

    if (spellId === "arcane_shield") {
      player.lastAction = "spell";
      player.mana -= cost;
      if (freeUtility) player.turnFlags.freeUtilityUsed = true;
      player.statuses = player.statuses.filter((status) => status.id !== "arcane_shield");
      player.statuses.push({ id: "arcane_shield", turns: 3, fresh: true });
      if (player.boonId === "sages_echo") player.boonState.sageEchoCount = sageEchoCount + 1;
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
      player.lastAction = "attack";
      this.performPlayerAttack(target, { type: "ability", abilityId: spellId });
      return;
    }

    if (spellId === "blink") {
      const destination = this.findBlinkDestination();
      if (!destination) {
        this.log("Blink fizzles. No safe destination.");
        return;
      }
      player.lastAction = "spell";
      player.mana -= cost;
      if (freeUtility) player.turnFlags.freeUtilityUsed = true;
      if (spell.type === "spell" && player.boonId === "sages_echo") player.boonState.sageEchoCount = sageEchoCount + 1;
      player.x = destination.x;
      player.y = destination.y;
      this.log("You blink through the dark.");
      this.pickUpItems();
      this.checkTrap();
      this.endPlayerTurn();
      return;
    }

    if (spellId === "aimed_shot") {
      const weapon = ITEMS[player.equipment.weapon];
      const range = (spell.range ?? 5) + (derived.aimedShotRange ?? 0);
      const target = this.findNearestVisibleEnemy(range);
      if (!target) {
        this.log("No target in range.");
        return;
      }
      if (!weapon?.range) {
        this.log("You need a ranged weapon.");
        return;
      }
      player.mana -= cost;
      player.lastAction = "attack";
      this.performPlayerAttack(target, { type: "ranged_ability", abilityId: "aimed_shot" });
      return;
    }

    if (spellId === "evasive_step") {
      const destination = this.findEvasiveStepDestination();
      if (!destination) {
        this.log("No safe escape route.");
        return;
      }
      player.mana -= cost;
      player.lastAction = "move";
      player.x = destination.x;
      player.y = destination.y;
      this.log("You leap away from danger.");
      this.pickUpItems();
      this.checkTrap();
      this.endPlayerTurn();
      return;
    }

    if (spellId === "arcane_pulse") {
      const targets = this.findAdjacentEnemies(player, 1);
      if (!targets.length) {
        this.log("No adjacent enemies to strike.");
        return;
      }
      player.lastAction = "spell";
      player.mana -= cost;
      if (spell.type === "spell" && player.boonId === "sages_echo") player.boonState.sageEchoCount = sageEchoCount + 1;
      this.log("Arcane force erupts around you.");
      for (const target of [...targets]) {
        this.performPlayerAttack(target, { type: "spell", spellId }, { endTurn: false });
      }
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
    player.lastAction = "spell";
    if (spell.type === "spell" && player.boonId === "sages_echo") player.boonState.sageEchoCount = sageEchoCount + 1;
    if (spellId === "chain_bolt") {
      const firstTargetPoint = { x: target.x, y: target.y };
      const firstResult = this.performPlayerAttack(target, { type: "spell", spellId }, { endTurn: false });
      const remainingEnemies = this.state.run.currentFloor.enemies.filter((enemy) => enemy.id !== target.id);
      const chainedTarget = remainingEnemies
        .filter((enemy) => manhattan(enemy, firstTargetPoint) <= 2)
        .sort((a, b) => manhattan(a, firstTargetPoint) - manhattan(b, firstTargetPoint))[0];
      if (firstResult?.hit && chainedTarget) {
        const chainResult = this.performPlayerAttack(chainedTarget, { type: "spell", spellId }, { endTurn: false, damageMultiplier: 0.6, projectileFrom: firstTargetPoint });
        if (chainResult?.hit) {
          this.log(`Chain Bolt arcs into ${chainedTarget.name}.`);
        }
      }
      this.endPlayerTurn();
      return;
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

  findEvasiveStepDestination() {
    const { player, currentFloor } = this.state.run;
    const range = 2 + (this.getDerivedStats(player).evasiveStepRange ?? 0);
    const nearestEnemy = currentFloor.enemies
      .filter((e) => !e.disguised)
      .sort((a, b) => manhattan(player, a) - manhattan(player, b))[0];
    const candidates = [];
    for (let y = Math.max(0, player.y - range); y <= Math.min(currentFloor.height - 1, player.y + range); y += 1) {
      for (let x = Math.max(0, player.x - range); x <= Math.min(currentFloor.width - 1, player.x + range); x += 1) {
        const tile = currentFloor.map[y]?.[x];
        if (!tile || tile.type !== "floor" || tile.occupant || tile.vendor) continue;
        const dist = manhattan(player, { x, y });
        if (dist >= 2 && dist <= range) candidates.push({ x, y });
      }
    }
    if (!candidates.length) return null;
    if (!nearestEnemy) return candidates[0];
    return candidates.sort((a, b) => manhattan(b, nearestEnemy) - manhattan(a, nearestEnemy))[0];
  }

  findNearestVisibleEnemy(range) {
    const { player } = this.state.run;
    const visibleEnemies = this.state.run.currentFloor.enemies
      .filter((enemy) => manhattan(player, enemy) <= range && hasLineOfSight(this.state.run.currentFloor.map, player, enemy))
      .sort((a, b) => manhattan(player, a) - manhattan(player, b));
    return visibleEnemies[0] ?? null;
  }

  findVisibleEnemies(range) {
    const { player } = this.state.run;
    return this.state.run.currentFloor.enemies
      .filter((enemy) => manhattan(player, enemy) <= range && hasLineOfSight(this.state.run.currentFloor.map, player, enemy));
  }

  findAdjacentEnemies(point, distance = 1) {
    return this.state.run.currentFloor.enemies.filter((enemy) => manhattan(point, enemy) <= distance);
  }

  useItemById(itemId, options = {}) {
    const { reopenInventoryIndex = null } = options;
    const player = this.state.run.player;
    const index = player.inventory.findIndex((entry) => entry.itemId === itemId);
    if (index === -1) {
      this.log("Item not in inventory.");
      return;
    }

    const item = ITEMS[itemId];
    if (item.category === "consumable") {
      player.lastAction = "item";
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
      if (reopenInventoryIndex !== null) {
        const stacks = this.getInventoryStacks();
        const nextIndex = this.getStackIndexByItemId(stacks, itemId, reopenInventoryIndex);
        this.openInventory(nextIndex >= 0 ? nextIndex : 0);
      }
      this.endPlayerTurn();
      return;
    }

    if (item.category === "tome") {
      player.lastAction = "item";
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
      if (reopenInventoryIndex !== null) {
        const stacks = this.getInventoryStacks();
        const nextIndex = this.getStackIndexByItemId(stacks, itemId, reopenInventoryIndex);
        this.openInventory(nextIndex >= 0 ? nextIndex : 0);
      } else {
        this.openInventory();
      }
      return;
    }
  }

  interact() {
    const { player, currentFloor } = this.state.run;
    const tile = currentFloor.map[player.y][player.x];
    const bossAlive = currentFloor.enemies.some((enemy) => ENEMIES[enemy.templateId]?.behavior === "boss");
    const sage = currentFloor.sage;
    if (sage && !sage.vanished && manhattan(player, sage) <= 1) {
      this.showNpcDialog(this.sageName, "Choose, delver. The gift is yours. The claim may not be.", 3200);
      this.openSageChoice();
      return;
    }
    if (tile.stairs) {
      this.descend();
      return;
    }

    const chest = currentFloor.chests.find((entry) => entry.x === player.x && entry.y === player.y);
    if (chest && !chest.opened) {
      if (chest.locked && !this.hasVaultKey(chest.keyItemId)) {
        this.log(`${chest.label ?? "The vault"} is locked. You need the ${ITEMS[chest.keyItemId]?.name ?? "matching key"}.`);
        return;
      }
      if (bossAlive) {
        this.log("A boss still guards this reward.");
        return;
      }
      if (chest.locked) {
        this.log(`The ${ITEMS[chest.keyItemId]?.name ?? "key"} unlocks ${chest.label?.toLowerCase() ?? "the vault"}.`);
      }
      chest.opened = true;
      if (chest.vaultId) {
        const vault = this.state.run.vaultPlan.find((entry) => entry.id === chest.vaultId);
        if (vault) vault.opened = true;
      }
      currentFloor.map[player.y][player.x].chestId = null;
      player.gold += chest.gold;
      this.log(`${chest.label ?? "Chest"} opened. You collect ${chest.gold} gold.`);
      for (const itemId of chest.loot) {
        player.inventory.push({ id: `inv-${Date.now()}-${itemId}-${Math.random()}`, itemId });
        this.log(`Found ${ITEMS[itemId].name}.`);
      }
      return;
    }

    if (tile.vendor) {
      const vendor = this.state.run.currentFloor.vendor;
      this.showNpcDialog(vendor?.name ?? "Vendor", this.getVendorGreeting(vendor, this.state.run.runSeed, this.state.run.floorNumber), 2400);
      this.openVendor();
      return;
    }

    const shrine = this.getAdjacentShrine(player.x, player.y);
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
    this.state.run.currentFloor = this.applyRunFloorAdjustments(
      generateFloor(this.state.run.runSeed, nextFloor, this.state.run.player.classId),
      nextFloor,
      this.state.run.player
    );
    this.state.run.player.x = this.state.run.currentFloor.spawn.x;
    this.state.run.player.y = this.state.run.currentFloor.spawn.y;
    this.updateVisibility();
    this.log(`You descend to Floor ${nextFloor}.`);
    this.renderer?.showTransition(this.getFloorTransitionBanner(nextFloor));
    const bossEntryLine = this.getBossFloorEntryLine(nextFloor);
    if (bossEntryLine) {
      this.showNpcDialog(this.sageName, bossEntryLine, 3400);
      this.log(bossEntryLine);
    }
  }

  openInventory(selectedIndex = 0) {
    const stacks = this.getInventoryStacks();
    const safeIndex = stacks.length ? clamp(selectedIndex, 0, stacks.length - 1) : -1;
    const selectedStack = safeIndex >= 0 ? stacks[safeIndex] : null;
    const list = stacks.map((stack, index) => {
      const item = ITEMS[stack.itemId];
      return `
        <button
          class="inventory-tile ${index === safeIndex ? "selected" : ""} ${this.getItemRarity(stack.itemId)}"
          data-action="inventory-select"
          data-index="${index}"
          data-tooltip="${this.escapeTooltip(this.getItemTooltip(stack.itemId, { stackCount: stack.count, includeCompare: true, includeValue: true }))}"
        >
          <span class="inventory-tile-rarity">${this.getItemRarity(stack.itemId)}</span>
          ${this.renderItemIcon(stack.itemId)}
          ${stack.count > 1 ? `<span class="inventory-stack-count">x${stack.count}</span>` : ""}
          <span class="inventory-tile-name">${item.name}</span>
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
            <div class="inventory-grid">
              ${list}
            </div>
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
    const boon = this.getBoonDefinition(player.boonId);
    this.state.ui.overlay = {
      type: "character",
      title: "Character",
      html: `
        <div class="stat-list">
          <div>Class: <strong>${CLASSES[player.classId].name}</strong></div>
          <div>Boon: <strong>${boon?.name ?? "None"}</strong></div>
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
            <div class="list-card" data-tooltip="${this.escapeTooltip(SPELLS[option.id] ? this.getSpellTooltip(option.id) : this.getItemTooltip(option.id, { includeValue: true }))}">
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
                <div class="list-card ${unlocked ? "selected" : ""}" data-tooltip="${this.escapeTooltip(this.getSkillTooltip(skill, branch.name, unlocked, available))}">
                  <strong>${skill.name}</strong>
                  <p class="muted">${skill.description}</p>
                  <button ${available ? "" : "disabled"} data-action="buy-skill" data-skill-id="${skill.id}" data-tooltip="${this.escapeTooltip(this.getSkillTooltip(skill, branch.name, unlocked, available))}">
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
    const stacks = this.getInventoryStacks();
    const stack = stacks[index];
    const entryIndex = stack?.indices[0];
    const entry = entryIndex !== undefined ? this.state.run.player.inventory[entryIndex] : null;
    if (!entry) return;
    const item = ITEMS[entry.itemId];
    if (!item.slot) {
      this.useItemById(entry.itemId, { reopenInventoryIndex: index });
      return;
    }

    const player = this.state.run.player;
    const previousDerived = this.getDerivedStats(player);
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
    this.applyResourceCapDelta(player, previousDerived, derived);
    this.log(`Equipped ${item.name}.`);
    const nextStacks = this.getInventoryStacks();
    const nextIndex = this.getStackIndexByItemId(nextStacks, entry.itemId, index);
    this.openInventory(nextIndex >= 0 ? nextIndex : 0);
  }

  openVendor(selectedIndex = 0) {
    const vendor = this.state.run.currentFloor.vendor;
    if (!vendor) return;
    const vendorStacks = this.getVendorStacks();
    const safeIndex = vendorStacks.length ? clamp(selectedIndex, 0, vendorStacks.length - 1) : -1;
    const selectedStack = safeIndex >= 0 ? vendorStacks[safeIndex] : null;
    const selectedItemId = selectedStack?.itemId ?? null;
    const vendorList = vendorStacks.map((stack, index) => `
      <button
        class="inventory-tile vendor-tile ${index === safeIndex ? "selected" : ""} ${this.getItemRarity(stack.itemId)}"
        data-action="vendor-select"
        data-index="${index}"
        data-tooltip="${this.escapeTooltip(this.getItemTooltip(stack.itemId, { stackCount: stack.count, includeCompare: true, includeValue: true }))}"
      >
        <span class="inventory-tile-rarity">${this.getItemRarity(stack.itemId)}</span>
        <span class="inventory-tile-price">${this.getVendorBuyPrice(stack.itemId)}g</span>
        ${this.renderItemIcon(stack.itemId)}
        ${stack.count > 1 ? `<span class="inventory-stack-count">x${stack.count}</span>` : ""}
        <span class="inventory-tile-name">${ITEMS[stack.itemId].name}</span>
      </button>
    `).join("");

    const sellStacks = this.getInventoryStacksWithSellValue();
    const sellable = sellStacks
      .map((stack, index) => `
        <div class="sell-row" data-tooltip="${this.escapeTooltip(this.getItemTooltip(stack.itemId, { stackCount: stack.count, includeCompare: true, includeValue: true, sellValue: stack.sellValue }))}">
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
        actionDisabled: this.state.run.player.gold < this.getVendorBuyPrice(selectedItemId),
        priceLabel: `${this.getVendorBuyPrice(selectedItemId)}g`,
        footer: `${selectedStack?.count > 1 ? `<p class="muted">Vendor stack: ${selectedStack.count}</p>` : ""}${this.state.run.player.gold < this.getVendorBuyPrice(selectedItemId)
          ? `<p class="negative">You need ${this.getVendorBuyPrice(selectedItemId) - this.state.run.player.gold} more gold.</p>`
          : `<p class="positive">You can afford this item.</p>`}`,
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
              <span class="muted">${vendorStacks.length} stack${vendorStacks.length === 1 ? "" : "s"} • ${vendor.stock.length} item${vendor.stock.length === 1 ? "" : "s"}</span>
            </div>
            <div class="inventory-grid vendor-grid">
              ${vendorList || "<p>No items for sale.</p>"}
          </div>
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
    this.state.ui.overlay = { type: "vendor", title: vendor.title ?? "Vendor", selectedIndex: safeIndex, html };
  }

  vendorBuy(index) {
    const vendor = this.state.run.currentFloor.vendor;
    const stack = this.getVendorStacks()[index];
    const stockIndex = stack?.indices[0];
    const itemId = stockIndex !== undefined ? vendor?.stock[stockIndex] : null;
    if (!itemId) return;
    const item = ITEMS[itemId];
    const price = this.getVendorBuyPrice(itemId);
    if (this.state.run.player.gold < price) return;
    this.state.run.player.gold -= price;
    this.state.run.player.inventory.push({ id: `inv-${Date.now()}-${itemId}`, itemId });
    vendor.stock.splice(stockIndex, 1);
    this.log(`Bought ${item.name}.`);
    const nextStacks = this.getVendorStacks();
    const nextIndex = this.getStackIndexByItemId(nextStacks, itemId, index);
    this.openVendor(nextIndex >= 0 ? nextIndex : 0);
  }

  vendorSell(index) {
    const stack = this.getInventoryStacksWithSellValue()[index];
    const entryIndex = stack?.indices[0];
    const entry = entryIndex !== undefined ? this.state.run.player.inventory[entryIndex] : null;
    if (!entry) return;
    const item = ITEMS[entry.itemId];
    const value = Math.max(1, Math.floor(item.value * 0.25));
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
    if (this.state.run.floorNumber === 10 && !this.state.run.currentFloor.enemies.length && !this.state.run.player.floorFlags.boneCaptainDefeatedLogged) {
      this.state.run.player.floorFlags.boneCaptainDefeatedLogged = true;
      this.log("Super Skeletor is defeated. The first seal breaks, and the deeper halls open.");
    }
    if (this.state.run.floorNumber === 20 && !this.state.run.currentFloor.enemies.length && !this.state.run.player.floorFlags.patchesDefeatedLogged) {
      this.state.run.player.floorFlags.patchesDefeatedLogged = true;
      this.log("Patches collapses. The second threshold is broken, and the abyss opens below.");
    }
  }

  processStatuses() {
    const player = this.state.run.player;
    const previousPlayerStatuses = [...player.statuses];
    player.statuses = player.statuses
      .map((status) => {
        if (status.fresh) return { ...status, fresh: false };
        if (status.id === "poisoned") {
          player.hp = Math.max(0, player.hp - 1);
          this.renderer?.queueDamagePopup({ x: player.x, y: player.y, damage: 1, type: "player" });
          this.log("Poisoned deals 1 damage.");
          const turnLoss = player.lastAction === "wait" ? 2 : 1;
          return { ...status, turns: status.turns - turnLoss };
        }
        return { ...status, turns: status.turns - 1 };
      })
      .filter((status) => status.turns > 0);
    for (const status of previousPlayerStatuses) {
      if (!player.statuses.some((entry) => entry.id === status.id)) {
        this.log(`${STATUS_DEFINITIONS[status.id]?.name ?? status.id} fades from you.`);
      }
    }
    if (player.hp <= 0) {
      this.handleDeath("Succumbed to poison.");
      return;
    }
    for (const enemy of this.state.run.currentFloor.enemies) {
      const previousStatuses = [...enemy.statuses];
      enemy.statuses = enemy.statuses
        .map((status) => status.fresh ? { ...status, fresh: false } : { ...status, turns: status.turns - 1 })
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
      if (enemy.disguised) continue;
      enemy.turnCounter += 1;
      const template = this.getEnemyCombatStats(enemy);
      const distance = manhattan(enemy, player);
      const detectionRange = template.behavior === "caster" ? (template.range ?? 6) : 7;
      const canSee = hasLineOfSight(currentFloor.map, enemy, player) && distance <= detectionRange;
      if (canSee) {
        enemy.alerted = true;
        enemy.lastKnownPlayerPosition = { x: player.x, y: player.y };
      }
      if (canSee && ENEMIES[enemy.templateId]?.behavior === "boss") {
        const sightKey = `${enemy.templateId}Seen`;
        if (!player.floorFlags[sightKey]) {
          player.floorFlags[sightKey] = true;
          const sightLine = this.getBossSightLine(enemy.templateId);
          if (sightLine) {
            this.showNpcDialog(enemy.name, sightLine, 3400);
            this.log(sightLine);
          }
        }
      }
      if (!enemy.alerted) continue;

      if (enemy.templateId === "abyssal_overlord" && !enemy.phaseTwo && enemy.hp <= enemy.maxHp / 2) {
        enemy.phaseTwo = true;
        this.log("The Abyssal Overlord erupts in shadowflame.");
        let summons = 0;
        while (summons < 2) {
          const summonTile = this.findAdjacentOpen(enemy.x, enemy.y);
          if (!summonTile) break;
          this.summonEnemy("infernal_imp", summonTile.x, summonTile.y, { summonedBy: enemy.id });
          summons += 1;
        }
        if (summons) {
          this.log(`The Overlord tears open the void and summons ${summons} Infernal Imp${summons === 1 ? "" : "s"}.`);
        }
        continue;
      }

      if (enemy.templateId === "abyssal_overlord" && enemy.phaseTwo) {
        const activeImps = currentFloor.enemies.filter((candidate) => candidate.templateId === "infernal_imp" && candidate.summonedBy === enemy.id).length;
        if (canSee && activeImps < 2 && enemy.turnCounter % 4 === 1) {
          const summonTile = this.findAdjacentOpen(enemy.x, enemy.y);
          if (summonTile) {
            this.summonEnemy("infernal_imp", summonTile.x, summonTile.y, { summonedBy: enemy.id });
            this.log(`The Overlord rends the void and calls another Infernal Imp (${activeImps + 1}/2).`);
            continue;
          }
        }
      }

      if (enemy.templateId === "abyssal_overlord" && canSee && enemy.turnCounter % 3 === 2) {
        if (distance === 1) {
          this.log("The Abyssal Overlord draws back for a sweeping cleave.");
        } else if (distance <= (template.range ?? 6) + 1) {
          this.log("The Abyssal Overlord gathers abyssal fire.");
        }
      }

      if (enemy.templateId === "bone_captain" && canSee) {
        if (distance > 1 && distance <= (template.range ?? 5) && enemy.turnCounter % 3 === 2) {
          this.log("Super Skeletor hurls a bolt of gravefire.");
        } else if (distance === 1 && enemy.turnCounter % 4 === 0) {
          this.log("Super Skeletor raises a bony hand for a crushing strike.");
        }
      }

      if (enemy.templateId === "patches" && canSee && distance === 1 && enemy.turnCounter % 4 === 0) {
        this.log("Patches lifts both fists for a brutal smash.");
      }

      if (enemy.templateId === "abyssal_overlord" && distance > 1 && canSee && distance <= (template.range ?? 6) && enemy.turnCounter % 3 === 0) {
        this.enemyAttack(enemy, "abyssal_bolt");
        if (player.hp <= 0) return;
        continue;
      }

      if (enemy.templateId === "bone_captain") {
        const activeSkeletons = currentFloor.enemies.filter((candidate) => candidate.summonedBy === enemy.id).length;
        if (canSee && activeSkeletons < 2 && enemy.turnCounter % 3 === 1) {
          const summonTile = this.findAdjacentOpen(enemy.x, enemy.y);
          if (summonTile) {
            this.summonEnemy("skeleton", summonTile.x, summonTile.y, { summonedBy: enemy.id });
            this.log(`Super Skeletor summons a Skeleton (${activeSkeletons + 1}/2).`);
            this.renderer?.triggerNecroFlash();
            continue;
          }
        }
        if (distance > 1 && canSee && distance <= (template.range ?? 5) && enemy.turnCounter % 3 === 0) {
          this.enemyAttack(enemy, "spell");
          if (player.hp <= 0) return;
          continue;
        }
      }

      if (enemy.templateId === "patches" && distance === 1 && enemy.turnCounter % 4 === 0) {
        this.renderer?.triggerSlamFlash();
        this.enemyAttack(enemy, "slam");
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
        const preferredMinRange = enemy.templateId === "shaman" ? 4 : 2;
        const castMinRange = 1;
        if (canSee && distance >= castMinRange && distance <= template.range) {
          const shouldRetreat = distance === 1 && this.shouldCasterRetreat(enemy);
          if (!shouldRetreat) {
            this.enemyAttack(enemy, "spell");
            if (player.hp <= 0) return;
            continue;
          }
        }
        if (distance < preferredMinRange) {
          const shouldRetreat = distance === 1 && this.shouldCasterRetreat(enemy);
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
      if (tile && tile.type === "floor" && !tile.occupant && !tile.vendor && !tile.stairs && !tile.hole && !tile.shrineId) {
        return { x: x + delta.x, y: y + delta.y };
      }
    }
    return null;
  }

  findRetreatTile(enemy) {
    const { player, currentFloor } = this.state.run;
    const currentDistance = manhattan(enemy, player);
    const candidates = [
      { x: enemy.x + 1, y: enemy.y },
      { x: enemy.x - 1, y: enemy.y },
      { x: enemy.x, y: enemy.y + 1 },
      { x: enemy.x, y: enemy.y - 1 },
    ]
      .filter((point) => {
        const tile = currentFloor.map[point.y]?.[point.x];
        return tile && tile.type === "floor" && !tile.occupant && !tile.hole && !tile.shrineId;
      })
      .filter((point) => manhattan(point, player) > currentDistance)
      .sort((a, b) => manhattan(b, player) - manhattan(a, player));
    return candidates[0] ?? null;
  }

  shouldCasterRetreat(enemy) {
    if (enemy.templateId === "shaman") {
      return enemy.turnCounter % 3 === 0;
    }
    if (enemy.templateId === "infernal_imp") {
      return enemy.turnCounter % 4 === 0;
    }
    return enemy.turnCounter % 4 === 0;
  }

  enemyAttack(enemy, mode = "melee") {
    const player = this.state.run.player;
    const template = this.getEnemyCombatStats(enemy);
    const derived = this.getPlayerCombatSnapshot();
    const rng = createRng(hashSeed(this.state.run.turn, enemy.id, mode));
    const hitChance = clamp(template.accuracy - derived.evasion, 10, 95);
    if (mode === "spell" || mode === "abyssal_bolt") {
      const projectileKind = mode === "abyssal_bolt"
        ? "abyssal_bolt"
        : enemy.templateId === "shaman"
          ? "hexfire"
          : enemy.templateId === "cultist"
            ? "shadow_bolt"
            : enemy.templateId === "infernal_imp"
              ? "cinder_hex"
              : enemy.templateId === "bone_captain"
                ? "shadow_bolt"
              : "shadow_bolt";
      this.renderer?.queueProjectile({
        kind: projectileKind,
        from: { x: enemy.x, y: enemy.y },
        to: { x: player.x, y: player.y },
      });
    }
    if (!rng.chance(hitChance / 100)) {
      this.log(`${enemy.name} misses you.`);
      return;
    }

    let defense = derived.defense;
    if (player.statuses.some((status) => status.id === "arcane_shield")) defense += 2;
    if (player.lastAction === "wait" && derived.waitDefense) defense += derived.waitDefense;

    let damage = Math.max(1, rng.int(template.damage[0], template.damage[1]) - defense);
    if (mode === "cleave") damage += 3;
    if (mode === "slam") damage += 2;
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
    this.renderer?.queueDamagePopup({ x: player.x, y: player.y, damage, type: "player" });
    this.triggerRelentlessStep();
    if (mode === "spell" || mode === "abyssal_bolt") {
      const spellName = mode === "abyssal_bolt"
        ? "Abyssal Bolt"
        : enemy.templateId === "shaman"
          ? "Hexfire"
          : enemy.templateId === "cultist"
            ? "Shadow Bolt"
            : enemy.templateId === "infernal_imp"
              ? "Cinder Hex"
              : enemy.templateId === "bone_captain"
                ? "Grave Bolt"
              : "Spell";
      this.log(`${enemy.name} casts ${spellName} for ${damage} damage.`);
    } else {
      this.log(`${enemy.name} hits you for ${damage} damage.`);
    }
    if (mode === "slam" && enemy.templateId === "patches" && rng.chance(0.45)) {
      this.upsertStatus(player, { id: "sundered", turns: 2, value: 1 });
      this.log("The smash leaves your guard sundered.");
    }
    if (mode === "spell" && enemy.templateId === "shaman" && rng.chance(0.5)) {
      this.upsertStatus(player, { id: "hexed", turns: 2, value: 1, source: "enemySpell" });
      this.log("You are hexed.");
    }
    if (mode === "spell" && enemy.templateId === "cultist" && rng.chance(0.35)) {
      this.upsertStatus(player, { id: "weakened", turns: 2, value: 1, source: "enemySpell" });
      this.log("Shadow clings to you. You are weakened.");
    }
    if (mode === "spell" && enemy.templateId === "infernal_imp" && rng.chance(0.4)) {
      this.upsertStatus(player, { id: "chilled", turns: 2, value: 1, source: "enemySpell" });
      this.log("Scorching cinders blind and chill you.");
    }
    if (mode === "spell" && enemy.templateId === "bone_captain" && rng.chance(0.45)) {
      this.upsertStatus(player, { id: "weakened", turns: 2, value: 1, source: "enemySpell" });
      this.log("Gravefire drains your strength. You are weakened.");
    }
    if (mode === "abyssal_bolt") {
      if (rng.chance(enemy.phaseTwo ? 0.6 : 0.4)) {
        this.upsertStatus(player, { id: "hexed", turns: 2, value: 1, source: "enemySpell" });
        this.log("Abyssal fire hexes you.");
      }
      if (enemy.phaseTwo && rng.chance(0.35)) {
        this.upsertStatus(player, { id: "weakened", turns: 2, value: 1, source: "enemySpell" });
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
    const summary = this.buildRunSummary(this.state.run, message.replace(/^Slain by /, "").replace(/^Killed by /, ""), "death");
    const deathFlavor = this.state.run.floorNumber >= 30
      ? "<p class=\"muted\">The throne remains below, and whatever judged you there is not finished.</p>"
      : "";
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
        ${deathFlavor}
        ${this.renderScoreSaveSection(summary)}
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
      ? "The Abyssal Overlord is slain, and the throne below no longer stands empty."
      : `You reached Floor ${floorNumber} and cleared the current Milestone 2 build.`;
    const victoryFooter = floorNumber >= 30
      ? "Whether you broke the dungeon's cycle or fulfilled its oldest demand remains unclear."
      : "The full Floor 30 final-boss run is still reserved for Milestone 3.";
    const summary = this.buildRunSummary(this.state.run, floorNumber >= 30 ? "Dungeon Cleared" : `Reached Floor ${floorNumber}`, "victory");
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
        ${this.renderScoreSaveSection(summary)}
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
      case "choose-boon":
        this.chooseBoon(payload.boonId);
        break;
      case "close-sage-message":
        this.state.ui.overlay = null;
        break;
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
      case "save-score": {
        if (!this.state.run) break;
        if (this.state.run.scoreSaved) {
          this.state.mode = "scores";
          this.state.ui.overlay = null;
          this.state.run = null;
          this.state.logs = ["Begin a new run to enter the dungeon."];
          break;
        }
        const overlayType = this.state.ui.overlay?.type;
        const result = overlayType === "victory" ? "victory" : "death";
        const cause = result === "victory"
          ? (this.state.run.floorNumber >= 30 ? "Dungeon Cleared" : `Reached Floor ${this.state.run.floorNumber}`)
          : (this.state.logs[this.state.logs.length - 1] ?? "Unknown");
        const summary = this.buildRunSummary(this.state.run, cause.replace(/^Slain by /, "").replace(/^Killed by /, ""), result);
        const saveResult = this.saveHighScore(payload.playerName, summary);
        if (saveResult.ok) {
          this.state.run.scoreSaved = true;
          this.state.mode = "scores";
          this.state.ui.overlay = null;
          this.state.run = null;
          this.state.logs = ["Begin a new run to enter the dungeon."];
        } else {
          const message = result === "victory"
            ? (this.state.run.floorNumber >= 30
              ? "The Abyssal Overlord is slain, and the throne below no longer stands empty."
              : `You reached Floor ${this.state.run.floorNumber} and cleared the current Milestone 2 build.`)
            : this.state.logs[this.state.logs.length - 1];
          if (result === "victory") {
            const { player, floorNumber, runStats, turn } = this.state.run;
            const unlockedSkills = player.unlockedSkills.length;
            const learnedSpells = player.learnedSpells.filter((spellId) => SPELLS[spellId]).length;
            const victoryFooter = floorNumber >= 30
              ? "Whether you broke the dungeon's cycle or fulfilled its oldest demand remains unclear."
              : "The full Floor 30 final-boss run is still reserved for Milestone 3.";
            this.state.ui.overlay = {
              type: "victory",
              dismissible: false,
              title: floorNumber >= 30 ? "Dungeon Cleared" : "Milestone 2 Clear",
              html: `
                <p>${message}</p>
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
                ${this.renderScoreSaveSection(summary, { savedName: this.normalizePlayerName(payload.playerName), feedback: saveResult.error, feedbackTone: "negative" })}
                <button data-action="new-run-from-death">Start New Run</button>
                <button data-action="main-menu">Main Menu</button>
              `,
            };
          } else {
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
                ${this.renderScoreSaveSection(summary, { savedName: this.normalizePlayerName(payload.playerName), feedback: saveResult.error, feedbackTone: "negative" })}
                <button data-action="new-run-from-death">Start New Run</button>
                <button data-action="main-menu">Main Menu</button>
              `,
            };
          }
        }
        break;
      }
      default:
        break;
    }
  }
}
