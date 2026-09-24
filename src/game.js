import { BAND_NAMES, BOONS, BOSS_REWARDS, BOSS_TITLES, CHEST_TABLE, CLASSES, ENEMIES, ITEMS, QUICK_SLOT_COUNT, SKILL_TREES, SPELLS, STATUS_DEFINITIONS, TRAPS } from "./data.js";
import { attachVaultFeaturesToFloor, generateFloor, getDropForEnemy } from "./generator.js";
import { getActorSpriteFrame, getEnemySpriteId, getItemSprite } from "./assets.js";
import { getBranchIconUrl, getSpellIconUrl, getStatusIconUrl } from "./pixelIcons.js";
import { clamp, createRng, deepClone, hashSeed, isBlockedFloor, manhattan, toKey } from "./utils.js";
import { MAX_LOG_ENTRIES, logText, normalizeLogs } from "./log.js";

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
      if (!tile || tile.type !== "floor" || isBlockedFloor(tile)) continue;
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
      logs: normalizeLogs(["Begin a new run to enter the dungeon."]),
    };
    this.renderer = null;
    this.highScoreStorageKey = "dungeon30_high_scores";
    this.saveStorageKey = "dungeon30_save";
    this.bossMemoryStorageKey = "dungeon30_boss_memory";
    this.blockedNameTerms = [
      "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "fag", "faggot", "slut",
      "whore", "asshole", "motherfucker", "dick", "cock", "pussy", "penis", "vagina",
      "rape", "rapist", "cum", "jizz", "tits",
    ];
  }

  attachRenderer(renderer) {
    this.renderer = renderer;
  }

  attachSoundPlayer(soundPlayer) {
    this.soundPlayer = soundPlayer;
  }

  setMode(mode) {
    this.state.mode = mode;
  }

  // What the floor-transition card shows: a small kicker, the big title, and the band beneath.
  getFloorCard(floorNumber) {
    const band = BAND_NAMES[this.state.run?.currentFloor?.theme] ?? "";
    const bossFloors = {
      10: "Super Skeletor's Lair",
      20: "The Stitching Pit",
      30: "The Abyssal Throne",
    };
    if (floorNumber === 0) return { kicker: "Prelude", title: "The Sage Waits", subtitle: "Choose a gift before the descent", boss: false };
    if (bossFloors[floorNumber]) return { kicker: `Floor ${floorNumber}`, title: bossFloors[floorNumber], subtitle: band, boss: true };
    return { kicker: `${floorNumber} of 30`, title: `Floor ${floorNumber}`, subtitle: band, boss: false };
  }

  getBossFloorEntryLine(floorNumber) {
    const lines = {
      10: "The air turns cold. Bone and gravefire wait below the first seal.",
      20: "The walls tighten with stitches and old pain. Something flesh-bound waits ahead.",
      30: "The throne waits below. Whether you come as executioner or successor is no longer clear.",
    };
    return lines[floorNumber] ?? null;
  }

  // lastOutcome is how your previous meeting with this boss ended (in any earlier run): "killed" if it
  // killed you, "defeated" if you beat it. Each has its own line; first meetings use the default.
  getBossSightLine(templateId, lastOutcome = null) {
    const rematchLines = {
      killed: {
        bone_captain: "Super Skeletor's sockets narrow. He has buried you once already, and the grave remembers its guests.",
        patches: "Patches grins through a mouthful of stitches. A few of them look familiar. They came from you.",
        abyssal_overlord: "The Abyssal Overlord does not rise this time. It simply waits, as it did before, for you to kneel.",
      },
      defeated: {
        bone_captain: "Super Skeletor rises again, bones knitting back together. He remembers the last delver who broke him.",
        patches: "Patches has been sewn back together, badly. The newest seams run exactly where you cut.",
        abyssal_overlord: "The Abyssal Overlord sits the throne again. Whatever you ended last time, the dungeon has already replaced.",
      },
    };
    if (lastOutcome && rematchLines[lastOutcome]?.[templateId]) return rematchLines[lastOutcome][templateId];
    const lines = {
      bone_captain: "Super Skeletor turns, as if he had been expecting someone worthy to descend this far.",
      patches: "Patches lurches forward from the stitched dark, guarding the next threshold like a butchered sentinel.",
      abyssal_overlord: "The Abyssal Overlord rises before the throne. For a moment, it is unclear whether it bars your path or judges your claim.",
    };
    return lines[templateId] ?? null;
  }

  // How each boss's last encounter ended, kept per browser across runs (separate from the run save).
  getBossMemory() {
    try {
      return JSON.parse(window.localStorage.getItem(this.bossMemoryStorageKey) ?? "{}") ?? {};
    } catch {
      return {};
    }
  }

  recordBossOutcome(templateId, outcome) {
    const memory = this.getBossMemory();
    const entry = memory[templateId] ?? { kills: 0, defeats: 0 };
    if (outcome === "killed") entry.kills += 1;
    if (outcome === "defeated") entry.defeats += 1;
    entry.lastOutcome = outcome;
    memory[templateId] = entry;
    try {
      window.localStorage.setItem(this.bossMemoryStorageKey, JSON.stringify(memory));
    } catch {
      // Storage unavailable; the boss simply won't remember.
    }
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

  // What the Grey Witness says as they fade after granting a boon: the gift's weight, the throne's
  // ledger, and a farewell. One of several sequences, fixed per run.
  getSageBurdenLines(runSeed, boon) {
    const sequences = [
      [
        `It is done. ${boon.name} is yours now, and so is its weight.`,
        "Every gift taken here is a debt owed below. The throne keeps the ledger.",
        "Thirty floors, delver. Many have carried their burden down. None have carried it back up.",
      ],
      [
        `${boon.name}. Carry it well; it grows heavier with every floor.`,
        "I have watched a hundred delvers take a gift from these hands. I have watched the throne take them back.",
        "Something below has waited a long time for an heir. Do not let it choose you.",
      ],
      [
        `So you choose ${boon.name}. They all choose, in the end.`,
        "This dungeon was dug for one purpose: to deliver someone to the throne. Conqueror or offering, it does not care which.",
        "When the torches gutter and the halls go quiet, remember whose gift you carry. I will remember you.",
      ],
    ];
    const sequence = sequences[hashSeed(runSeed, "sage-burden") % sequences.length];
    return [...sequence, this.getSageFarewellLine(runSeed, boon.id)];
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
    this.notify({ kind: "item", itemId, verb: "Found" });
    this.showNpcDialog(null, `${ITEMS[itemId].name} found. Somewhere below, ${vault.label.toLowerCase()} can now be opened.`, 2600);
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
    const manifest = this.renderer?.assets?.manifest;
    const categoryLabels = { offense: "Offense", defense: "Defense", sustain: "Sustain", arcane: "Arcane", fortune: "Fortune" };
    const choices = sage.choices
      .map((boonId) => {
        const boon = BOONS[boonId];
        const icon = manifest?.boonIcons?.[boon.id];
        return `
          <button class="boon-card boon--${boon.category ?? "fortune"}" data-action="choose-boon" data-boon-id="${boon.id}">
            <span class="boon-icon-frame">${icon ? `<img class="boon-icon" src="${icon}" alt="">` : ""}</span>
            <span class="boon-category">${categoryLabels[boon.category] ?? "Gift"}</span>
            <strong class="boon-name">${boon.name}</strong>
            <span class="boon-summary">${boon.summary}</span>
            <span class="boon-flavor">${boon.description}</span>
          </button>
        `;
      })
      .join("");
    const sagePortrait = manifest ? getActorSpriteFrame(manifest, sage.actorId ?? "sage", 0) : null;
    this.state.ui.overlay = {
      type: "boon-choice",
      variant: "boon-choice",
      dismissible: false,
      title: "Choose a Gift",
      html: `
        <div class="sage-intro">
          ${sagePortrait ? `<span class="sage-portrait-frame"><img class="sage-portrait" src="${sagePortrait}" data-animate-actor="${sage.actorId ?? "sage"}" alt=""></span>` : ""}
          <div class="sage-speech">
            <span class="sage-speaker">${this.sageName}</span>
            <p>"Three gifts, delver. Take one, and carry its burden below."</p>
          </div>
        </div>
        <div class="boon-grid">
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
    if (sage) sage.vanishedAt = Date.now();
    this.log(`${this.sageName} grants ${boon.name}.`);
    // No modal: the sage speaks while fading, and the player can move straight away.
    const lines = this.getSageBurdenLines(run.runSeed, boon);
    this.showNpcDialogSequence(this.sageName, lines);
    for (const line of lines) this.log(`${this.sageName}: "${line}"`);
    this.log(`${this.sageName} fades, revealing the stairs to Floor 1.`);
    this.state.ui.overlay = null;
    this.saveRun();
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
    this.state.logs.push({ text: message, turn: this.state.run?.turn ?? 0 });
    if (this.state.logs.length > MAX_LOG_ENTRIES) this.state.logs.splice(0, this.state.logs.length - MAX_LOG_ENTRIES);
  }

  resetLogs(...messages) {
    this.state.logs = [];
    for (const message of messages) this.log(message);
  }

  lastLogText() {
    return logText(this.lastLogText());
  }

  // Short-lived notices over the map (pickups, gold, floor summaries). Not saved.
  // Gold notices merge while one is still showing, so a run of kills reads "+23 gold", not five lines.
  notify(toast) {
    const now = Date.now();
    const toasts = (this.state.ui.toasts ?? []).filter((entry) => entry.until > now);
    const duration = toast.duration ?? 2600;
    const open = toasts.find((entry) => entry.kind === "gold" && toast.kind === "gold");
    if (open) {
      open.amount += toast.amount;
      open.until = now + duration;
    } else {
      toasts.push({ ...toast, id: `${now}-${Math.random().toString(36).slice(2, 7)}`, until: now + duration });
    }
    // Keep the newest few so a big chest can't bury the map.
    this.state.ui.toasts = toasts.slice(-5);
  }

  // Adds an item to the pack. Found items are marked new (a dot in the inventory until it's closed)
  // and announced, unless quiet is set (starting kit, unequipped gear).
  addToInventory(itemId, { quiet = false, verb = "Picked up" } = {}) {
    const player = this.state.run.player;
    player.inventory.push({ id: `inv-${Date.now()}-${itemId}-${Math.random().toString(36).slice(2, 7)}`, itemId, isNew: !quiet });
    if (quiet) return;
    this.state.run.runStats.itemsFound = (this.state.run.runStats.itemsFound ?? 0) + 1;
    this.notify({ kind: "item", itemId, verb });
  }

  addGold(amount) {
    if (!(amount > 0)) return;
    this.state.run.player.gold += amount;
    this.state.run.runStats.goldFound = (this.state.run.runStats.goldFound ?? 0) + amount;
    this.notify({ kind: "gold", amount });
  }

  getNewItemCount() {
    return this.state.run?.player.inventory.filter((entry) => entry.isNew).length ?? 0;
  }

  // Several lines in a row from one speaker, each shown long enough to read.
  showNpcDialogSequence(speaker, lines) {
    const [first, ...rest] = lines;
    this.showNpcDialog(speaker, first, this.getDialogDuration(first));
    this.state.ui.npcDialogQueue = rest.map((text) => ({ speaker, text, duration: this.getDialogDuration(text) }));
  }

  getDialogDuration(text) {
    return clamp(1800 + text.length * 45, 2600, 6500);
  }

  showNpcDialog(speaker, text, duration = 2600) {
    this.state.ui.npcDialogQueue = [];
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

  hasSave() {
    return !!window.localStorage.getItem(this.saveStorageKey);
  }

  saveRun() {
    if (!this.state.run || this.state.mode !== "in_game") return;
    const run = deepClone(this.state.run);
    run.player.turnFlags = {};
    run.currentTargetId = null;
    try {
      const derived = this.getDerivedStats(this.state.run.player);
      window.localStorage.setItem(this.saveStorageKey, JSON.stringify({
        version: 1,
        run,
        logs: this.state.logs.slice(-30),
        // Read by the main menu's Continue card without loading the whole run.
        meta: { savedAt: Date.now(), maxHp: derived.maxHp, maxMana: derived.maxMana },
      }));
    } catch {
      // Storage full or unavailable — run continues unaffected.
    }
  }

  // A light summary of the saved run for the Continue card, or null when there's no usable save.
  getSaveSummary() {
    try {
      const payload = JSON.parse(window.localStorage.getItem(this.saveStorageKey) ?? "null");
      const run = payload?.run;
      if (payload?.version !== 1 || !run?.player) return null;
      const { player } = run;
      return {
        classId: player.classId,
        heroName: CLASSES[player.classId]?.heroName ?? "",
        className: CLASSES[player.classId]?.name ?? player.classId,
        level: player.level,
        floor: run.floorNumber,
        band: BAND_NAMES[run.currentFloor?.theme] ?? "",
        boonName: BOONS[player.boonId]?.name ?? null,
        gold: player.gold,
        hp: player.hp,
        maxHp: payload.meta?.maxHp ?? null,
        kills: run.runStats?.kills ?? 0,
        turn: run.turn,
        savedAt: payload.meta?.savedAt ?? null,
      };
    } catch {
      return null;
    }
  }

  loadSavedRun() {
    try {
      const raw = window.localStorage.getItem(this.saveStorageKey);
      if (!raw) return false;
      const payload = JSON.parse(raw);
      if (payload.version !== 1 || !payload.run) return false;
      this.state.run = payload.run;
      // Saves from before the hotbar grew to six slots have three.
      this.state.run.player.quickSlots = this.padQuickSlots(this.state.run.player.quickSlots);
      this.state.logs = normalizeLogs(payload.logs ?? []);
      this.state.mode = "in_game";
      this.state.ui = { overlay: null, selectedId: null, npcDialog: null };
      this.updateVisibility();
      this.renderer?.showFloorCard(this.getFloorCard(this.state.run.floorNumber));
      return true;
    } catch {
      return false;
    }
  }

  clearSave() {
    window.localStorage.removeItem(this.saveStorageKey);
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
      quickSlots: this.padQuickSlots(definition.quickSlots),
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
      runStats: { kills: 0, damageDealt: 0, damageTaken: 0, goldFound: 0, itemsFound: 0 },
      currentTargetId: null,
    };
    this.markFloorStart();
    this.updateVisibility();
    this.resetLogs(
      `${this.sageName} waits before the first descent.`,
      "Approach the sage and press Enter to choose a boon.",
    );
    this.state.ui.overlay = null;
    this.state.mode = "in_game";
    this.renderer?.showFloorCard(this.getFloorCard(0));
  }

  recordDamage(direction, amount) {
    const stats = this.state.run?.runStats;
    if (!stats || !(amount > 0)) return;
    const key = direction === "dealt" ? "damageDealt" : "damageTaken";
    stats[key] = (stats[key] ?? 0) + amount;
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

  // Plain-text tooltip for the map tile under the mouse, or null when there's nothing worth saying.
  // Enemies only show while in view; fixtures (chests, stairs, shrines) are remembered once explored.
  describeTile(x, y) {
    const { run } = this.state;
    const tile = run?.currentFloor.map[y]?.[x];
    if (!tile || (!tile.explored && !tile.visible)) return null;
    const { currentFloor } = run;
    const range = ([low, high]) => (low === high ? `${low}` : `${low}–${high}`);
    const sections = [];

    const enemy = tile.visible
      ? currentFloor.enemies.find((entry) => entry.x === x && entry.y === y && !entry.disguised && entry.hp > 0)
      : null;
    if (enemy) {
      const intel = this.getEnemyIntel(enemy);
      const lines = [
        `${intel.name}${intel.rank === "Enemy" ? "" : ` (${intel.rank})`}`,
        `HP ${intel.hp}/${intel.maxHp} · ${intel.behavior}`,
        `Hits you: ${intel.threat.hitChance}% for ${range(intel.threat.damage)}`,
        `${intel.attack.label}: ${intel.attack.hitChance}% for ${range(intel.attack.damage)}${intel.attack.inRange ? "" : " (out of range)"}`,
      ];
      if (intel.spell) lines.push(`${intel.spell.label}: ${intel.spell.hitChance}% for ${range(intel.spell.damage)}${intel.spell.inRange ? "" : " (out of range)"}`);
      if (intel.statuses.length) {
        lines.push(`Status: ${intel.statuses.map((status) => `${STATUS_DEFINITIONS[status.id]?.name ?? status.id}${status.turns ? ` (${status.turns})` : ""}`).join(", ")}`);
      }
      sections.push(lines.join("\n"));
    }

    if (tile.stairs) {
      const bossAlive = currentFloor.enemies.some((entry) => ENEMIES[entry.templateId]?.behavior === "boss");
      const next = run.floorNumber + 1;
      sections.push(`${currentFloor.theme === "sunken_vault" ? "Ladder" : "Stairs"} down${next <= 30 ? ` to Floor ${next}` : ""}\n${bossAlive ? "Sealed until the boss falls." : "Stand on it and press Enter."}`);
    }

    if (tile.chestId) {
      const chest = currentFloor.chests.find((entry) => entry.id === tile.chestId);
      const lines = [chest?.label ?? "Chest"];
      if (chest?.locked) {
        const keyName = ITEMS[chest.keyItemId]?.name ?? "a matching key";
        lines.push(this.hasVaultKey(chest.keyItemId) ? `Locked. You carry the ${keyName}.` : `Locked. Needs the ${keyName}.`);
      }
      lines.push("Stand on it and press Enter to open.");
      sections.push(lines.join("\n"));
    }

    if (tile.visible && tile.itemIds.length) {
      const names = tile.itemIds.map((itemId) => ITEMS[itemId]?.name ?? itemId);
      sections.push(`On the floor: ${names.join(", ")}\nWalk over it to pick up.`);
    }

    if (tile.vendor && currentFloor.vendor) {
      sections.push(`${currentFloor.vendor.name ?? "Vendor"}\nMerchant. Stand here and press Enter to trade.`);
    }

    const sage = currentFloor.sage;
    if (sage && !sage.vanished && sage.x === x && sage.y === y) {
      sections.push(`${this.sageName}\nStand beside the sage and press Enter.`);
    }

    const shrine = this.getShrineAt(x, y);
    if (shrine) {
      const restores = shrine.mode === "healing" ? "HP" : "mana";
      sections.push(`Shrine of ${shrine.mode === "healing" ? "Healing" : "Clarity"}\n${shrine.used ? "Spent." : `Restores 45% of your ${restores}. Stand beside it and press Enter.`}`);
    }

    const propNames = {
      pillar: "Stone pillar",
      pillar_slime: "Slime-streaked pillar",
      crate_small: "Crate",
      crate_large: "Heavy crate",
      cauldron: "Sludge cauldron",
      rocks: "Mossy rubble",
    };
    // The right half of a two-tile prop describes the prop to its left.
    const propKind = tile.prop === "extends" ? currentFloor.map[y]?.[x - 1]?.prop : tile.prop;
    if (propNames[propKind]) sections.push(`${propNames[propKind]}\nBlocks the way.`);

    const trap = tile.visible ? this.getTrapAt(x, y) : null;
    if (trap?.revealed) {
      const template = TRAPS[trap.templateId];
      const lines = [template.name];
      if (template.damage[1] > 0) lines.push(`Deals ${range(template.damage)} damage.`);
      if (template.status) lines.push(`Inflicts ${STATUS_DEFINITIONS[template.status]?.name ?? template.status}.`);
      if (template.alerts) lines.push("Alerts nearby enemies.");
      sections.push(lines.join("\n"));
    }

    return sections.length ? sections.join("\n\n") : null;
  }

  // The enemy the target panel describes: the last one you fought if it's still in view, otherwise
  // the nearest visible one (what your next attack would likely hit).
  getPanelTarget() {
    const { run } = this.state;
    if (!run) return { enemy: null, nearest: false };
    const isShown = (enemy) => enemy && !enemy.disguised && enemy.hp > 0 && run.currentFloor.map[enemy.y]?.[enemy.x]?.visible;
    const current = this.getCurrentTarget();
    if (isShown(current)) return { enemy: current, nearest: false };
    const nearest = run.currentFloor.enemies
      .filter(isShown)
      .sort((a, b) => manhattan(run.player, a) - manhattan(run.player, b))[0] ?? null;
    return { enemy: nearest, nearest: Boolean(nearest) };
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
    const hexedPenalty = this.hasStatus(enemy, "hexed") ? 2 : 0;
    const chilled = this.hasStatus(enemy, "chilled");
    const weakened = this.hasStatus(enemy, "weakened");
    const eliteDamageBonus = enemy.elite ? 1 : 0;
    const phaseAccuracyBonus = enemy.templateId === "abyssal_overlord" && enemy.phaseTwo ? 4 : 0;
    const phaseDefenseBonus = enemy.templateId === "abyssal_overlord" && enemy.phaseTwo ? 2 : 0;
    const phaseDamageBonus = enemy.templateId === "abyssal_overlord" && enemy.phaseTwo ? 2 : 0;
    return {
      ...template,
      accuracy: template.accuracy + (enemy.elite ? 3 : 0) + phaseAccuracyBonus - (chilled ? 6 : 0),
      defense: Math.max(0, template.defense + (enemy.elite ? 1 : 0) + phaseDefenseBonus - sundered - hexedPenalty),
      damage: weakened
        ? [Math.max(1, (template.damage[0] + eliteDamageBonus + phaseDamageBonus) - 2), Math.max(1, (template.damage[1] + eliteDamageBonus + phaseDamageBonus) - 2)]
        : enemy.elite || phaseDamageBonus
          ? [template.damage[0] + eliteDamageBonus + phaseDamageBonus, template.damage[1] + eliteDamageBonus + phaseDamageBonus]
          : template.damage,
      range: (template.range ?? 1) + (enemy.elite && template.behavior === "caster" ? 1 : 0) + (enemy.templateId === "abyssal_overlord" && enemy.phaseTwo ? 1 : 0),
      xp: template.xp + (enemy.elite ? Math.floor(template.xp * 0.45) : 0),
    };
  }

  // Everything the target panel and map hover show about an enemy: its threat to you, and your odds
  // against it. Damage ranges mirror performPlayerAttack/enemyAttack before crits and one-off bonuses.
  getEnemyIntel(enemy) {
    const player = this.state.run.player;
    const template = ENEMIES[enemy.templateId];
    const stats = this.getEnemyCombatStats(enemy);
    const derived = this.getPlayerCombatSnapshot();
    const weapon = ITEMS[player.equipment.weapon];
    const evasion = stats.evasion ?? 0;
    const distance = manhattan(player, enemy);

    const ranged = Boolean(weapon?.range);
    const bonus = ranged ? derived.rangedBonus : derived.meleeBonus;
    const damagePct = (ranged ? derived.rangedDamagePct : derived.meleeDamagePct) ?? 0;
    const enchantBonus = weapon?.enchantment?.type === "onHitBonusDamage" ? weapon.enchantment.value : 0;
    const weaponHit = (roll) => Math.max(1, Math.floor((roll + bonus) * (1 + damagePct / 100)) - stats.defense) + enchantBonus;
    const weaponRoll = weapon?.damage ?? [1, 2];

    const spellId = [...player.quickSlots, ...player.learnedSpells]
      .find((entryId) => SPELLS[entryId]?.type === "spell" && SPELLS[entryId].damage);
    const spell = spellId ? SPELLS[spellId] : null;
    const spellEnchant = weapon?.enchantment?.type === "spellBonusDamage" ? weapon.enchantment.value : 0;
    const spellHit = (roll) => Math.max(1, Math.floor((roll + derived.spellBonus) * (1 + derived.spellDamagePct / 100)) - stats.defense) + spellEnchant;

    let playerDefense = derived.defense;
    if (this.hasStatus(player, "arcane_shield")) playerDefense += 2;
    const range = stats.range ?? 1;
    const behaviorLabels = {
      melee: "Melee: closes in to strike",
      skirmisher: "Skirmisher: fast and evasive",
      blocker: "Blocker: tough, holds the line",
      caster: `Caster: attacks from range ${range}`,
      lurker: `Lurker: stays put, strikes within ${range}`,
      boss: range > 1 ? `Boss: melee and range ${range}` : "Boss: heavy melee",
    };

    return {
      name: enemy.name,
      rank: enemy.templateId === "abyssal_overlord"
        ? `Final Boss${enemy.phaseTwo ? " • Phase 2" : " • Phase 1"}`
        : template.behavior === "boss" ? "Boss" : enemy.elite ? "Elite" : "Enemy",
      behavior: behaviorLabels[template.behavior] ?? template.behavior,
      hp: Math.max(0, enemy.hp),
      maxHp: enemy.maxHp,
      defense: stats.defense,
      evasion,
      distance,
      statuses: enemy.statuses ?? [],
      threat: {
        hitChance: clamp(stats.accuracy - derived.evasion, 10, 95),
        damage: [Math.max(1, stats.damage[0] - playerDefense), Math.max(1, stats.damage[1] - playerDefense)],
        range,
      },
      attack: {
        label: ranged ? `${weapon.name} (F)` : weapon?.name ?? "Unarmed",
        hitChance: clamp(derived.accuracy - evasion, 10, 95),
        damage: [weaponHit(weaponRoll[0]), weaponHit(weaponRoll[1])],
        inRange: ranged ? distance <= weapon.range : distance <= 1,
      },
      spell: spell ? {
        label: spell.name,
        hitChance: clamp(90 + (derived.spellAccuracyFlat ?? 0) - evasion, 10, 95),
        damage: [spellHit(spell.damage[0]), spellHit(spell.damage[1])],
        inRange: distance <= spell.range,
      } : null,
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
        const boonRng = createRng(hashSeed(this.state.run.runSeed, this.state.run.turn, status.id, "ward-of-ash"));
        if (boonRng.chance(0.6)) {
          this.log(`Ward of Ash repels ${STATUS_DEFINITIONS[status.id]?.name ?? status.id}.`);
          return;
        }
      }
      const hands = this.getHandsItem(entity);
      const effect = hands?.handsEffect;
      if (effect?.type === "ignoreSpellStatusChance" && status.source === "enemySpell") {
        const rng = createRng(hashSeed(this.state.run.runSeed, this.state.run.turn, status.id, hands.id));
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
    if (tile.type !== "floor" || isBlockedFloor(tile)) {
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
      this.addToInventory(itemId);
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
    const rng = createRng(hashSeed(this.state.run.runSeed, this.state.run.turn, trap.id, "trap"));
    const rawDamage = Math.floor((rng.int(template.damage[0], template.damage[1]) - Math.floor(derived.defense / 2)) * reduction);
    const damage = template.damage[1] === 0 ? 0 : Math.max(1, rawDamage);
    if (damage > 0) {
      this.state.run.player.hp = Math.max(0, this.state.run.player.hp - damage);
      this.recordDamage("taken", damage);
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
    if (this.state.run.player.hp <= 0) this.handleDeath(`Killed by ${template.name}.`, { kind: "trap", name: template.name, trapId: trap.templateId });
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
      badges.push({ label: `${CLASSES[item.classBias]?.name ?? item.classBias} gear`, tone: item.classBias });
    }
    if (item.slot && item.slot !== item.category) {
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

  // How a piece of gear stacks up against what's equipped in its slot:
  // "upgrade" (better or equal everywhere, or the slot is empty), "downgrade", "mixed", "equal",
  // or "duplicate" (a copy of the equipped item). Null for items that don't equip.
  // Enchantments and hands effects can't be weighed against stats, so a difference there counts both ways.
  getGearVerdict(itemId) {
    const item = ITEMS[itemId];
    if (!item?.slot) return null;
    const equippedId = this.state.run.player.equipment[item.slot];
    if (!equippedId) return "upgrade";
    if (equippedId === itemId) return "duplicate";
    const equipped = ITEMS[equippedId];
    const rows = this.getComparisonRows(itemId);
    const extra = (entry) => JSON.stringify(entry.enchantment ?? entry.handsEffect ?? null);
    const extrasDiffer = extra(item) !== extra(equipped);
    const gains = rows.some((row) => row.delta > 0) || (extrasDiffer && extra(item) !== "null");
    const losses = rows.some((row) => row.delta < 0) || (extrasDiffer && extra(equipped) !== "null");
    if (gains && losses) return "mixed";
    if (gains) return "upgrade";
    if (losses) return "downgrade";
    return "equal";
  }

  isOffClassItem(itemId) {
    const bias = ITEMS[itemId]?.classBias;
    return Boolean(bias && bias !== this.state.run.player.classId);
  }

  // Gear the "Sell junk" button offers: strictly worse than equipped, a spare copy of it, or made for
  // another class. Consumables, tomes and keys never count.
  isJunkItem(itemId) {
    if (!ITEMS[itemId]?.slot) return false;
    const verdict = this.getGearVerdict(itemId);
    return this.isOffClassItem(itemId) || verdict === "downgrade" || verdict === "duplicate";
  }

  renderGearVerdict(itemId) {
    const verdict = this.getGearVerdict(itemId);
    const marks = {
      upgrade: ["up", "&#9650;", "Upgrade over your equipped gear"],
      downgrade: ["down", "&#9660;", "Worse than your equipped gear"],
      mixed: ["mixed", "&#9670;", "Trade-off: better in some stats, worse in others"],
    };
    const mark = marks[verdict];
    if (!mark) return "";
    return `<span class="gear-verdict ${mark[0]}" aria-label="${mark[2]}">${mark[1]}</span>`;
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
      parts.push(`Type: ${item.category}${item.slot && item.slot !== item.category ? ` (${item.slot})` : ""}`);
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
    if (!item?.slot) return "";
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
      actionAttrs = "",
      priceLabel = null,
      footer = "",
      showComparison = true,
    } = options;
    const offClassLine = this.isOffClassItem(itemId)
      ? `<p class="negative">Made for the ${CLASSES[item.classBias]?.name ?? item.classBias}.</p>`
      : "";

    const enchantmentLine = item.enchantment
      ? `<p class="positive">${item.description ?? this.getEnchantmentDescription(item)}</p>`
      : item.description ? `<p class="muted">${item.description}</p>` : "";

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
        ${offClassLine}
        ${showComparison ? this.renderComparisonTable(itemId) : ""}
        ${footer}
        ${action ? `<div class="detail-actions"><button class="primary" data-action="${action}" ${actionIndex !== null ? `data-index="${actionIndex}"` : ""} ${actionAttrs} ${actionDisabled ? "disabled" : ""}>${actionLabel}</button></div>` : ""}
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
      sellValue: this.getSellValue(stack.itemId),
    }));
  }

  getVendorBuyPrice(itemId) {
    const item = ITEMS[itemId];
    if (!item) return 0;
    const rarity = this.getItemRarity(itemId);
    const multiplier = rarity === "boss" ? 1.75 : rarity === "rare" ? 1.4 : rarity === "uncommon" ? 1.15 : 1;
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
    const rng = createRng(hashSeed(this.state.run.runSeed, this.state.run.turn, enemy.id, mode.type));
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
      this.soundPlayer?.play('miss');
      this.log(`You miss ${enemy.name}.`);
      if (endTurn) this.endPlayerTurn();
      return { hit: false, damage: 0, killed: false, targetId: enemy.id };
    }

    let damage = 0;
    if (mode.type === "melee" || mode.type === "ability") {
      this.soundPlayer?.play('melee_swing');
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
      this.soundPlayer?.play('ranged_attack');
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
    this.recordDamage("dealt", damage);
    // A guard struck from outside its room comes for you instead of standing there.
    this.wakeGuard(enemy);
    this.soundPlayer?.play('player_hit_enemy');
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
        this.recordDamage("dealt", splashDamage);
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
          this.recordDamage("dealt", phantomDamage);
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
    // Already removed (e.g. a summon that crumbled when its master fell earlier this action).
    if (!floor.enemies.includes(enemy)) return;
    floor.map[enemy.y][enemy.x].occupant = null;
    floor.enemies = floor.enemies.filter((entry) => entry.id !== enemy.id);
    this.soundPlayer?.play('enemy_death');
    const enemyStats = this.getEnemyCombatStats(enemy);
    this.log(`${enemy.name} falls.`);
    this.state.run.runStats.kills += 1;
    this.dismissSummons(enemy);
    const defeatLine = this.getBossDefeatLine(enemy.templateId);
    if (defeatLine) this.log(defeatLine);
    if (ENEMIES[enemy.templateId]?.behavior === "boss") {
      this.renderer?.triggerFlash("seal");
      this.recordBossOutcome(enemy.templateId, "defeated");
    }
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
    const rng = createRng(hashSeed(this.state.run.runSeed, this.state.run.turn, enemy.id, "drop"));
    const drop = getDropForEnemy(enemy, rng, this.state.run.player.classId);
    this.addGold(drop.gold);
    if (drop.gold) this.log(`You gather ${drop.gold} gold.`);
    for (const itemId of drop.items) {
      floor.map[enemy.y][enemy.x].itemIds.push(itemId);
      this.log(`${ITEMS[itemId].name} drops to the floor.`);
    }
  }

  // A summoner's minions don't outlive it: they vanish without XP or drops.
  dismissSummons(master) {
    const floor = this.state.run.currentFloor;
    const summons = floor.enemies.filter((entry) => entry.summonedBy === master.id);
    if (!summons.length) return;
    for (const summon of summons) floor.map[summon.y][summon.x].occupant = null;
    floor.enemies = floor.enemies.filter((entry) => entry.summonedBy !== master.id);
    const kind = summons[0].templateId;
    this.log(kind === "skeleton"
      ? `${summons.length === 1 ? "The last skeleton crumbles" : "The skeletons crumble"} to dust.`
      : kind === "infernal_imp"
        ? `${summons.length === 1 ? "The imp is" : "The imps are"} dragged back into the void.`
        : `${master.name}'s servants fade.`);
  }

  getBossDefeatLine(templateId) {
    const lines = {
      bone_captain: "Super Skeletor is defeated. The first seal breaks, and the deeper halls open.",
      patches: "Patches collapses. The second threshold is broken, and the abyss opens below.",
    };
    return lines[templateId] ?? null;
  }

  gainXp(amount) {
    const player = this.state.run.player;
    if (player.level >= 10) return;
    const bonusXp = player.boonId === "grave_insight" ? Math.floor(amount * 0.2) : 0;
    player.xp += amount + bonusXp;
    while (player.level < 10 && player.xp >= this.getXpForLevel(player.level + 1)) {
      player.level += 1;
      this.soundPlayer?.play('level_up');
      player.skillPoints += 1;
      player.baseStats.strength += player.classId === "warrior" ? 1 : 0;
      player.baseStats.vitality += player.classId === "warrior" ? 1 : player.level % 3 === 0 ? 1 : 0;
      player.baseStats.dexterity += player.classId === "ranger" ? 1 : player.level % 2 === 0 ? 1 : 0;
      player.baseStats.intelligence += player.classId === "wizard" ? 1 : 0;
      const derived = this.getDerivedStats(player);
      player.hp = derived.maxHp;
      player.mana = derived.maxMana;
      this.log(`Level ${player.level}. You gain a skill point. Press K to spend it.`);
    }
  }

  padQuickSlots(slots = []) {
    return Array.from({ length: QUICK_SLOT_COUNT }, (_, index) => slots[index] ?? null);
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

  // What casting would cost right now, after discounts and free casts (Sage's Echo, free utility).
  getSpellCost(spellId) {
    const player = this.state.run.player;
    const derived = this.getPlayerCombatSnapshot();
    const spell = SPELLS[spellId];
    const sageEchoCount = player.boonState?.sageEchoCount ?? 0;
    const sageEchoFree = spell.type === "spell" && player.boonId === "sages_echo" && (sageEchoCount + 1) % 3 === 0;
    const utilitySpell = spellId === "arcane_shield" || spellId === "blink";
    const utilityDiscount = utilitySpell ? derived.utilityDiscount : 0;
    const freeUtility = utilitySpell && derived.freeUtility && !player.turnFlags.freeUtilityUsed;
    const free = freeUtility || sageEchoFree;
    return { cost: free ? 0 : Math.max(0, spell.cost - utilityDiscount), free, freeUtility, sageEchoCount };
  }

  // Everything the hotbar needs to draw one slot: what's in it, its cost or count, and whether it
  // can be used right now (with the reason when it can't).
  getQuickSlotState(index) {
    const player = this.state.run.player;
    const entryId = player.quickSlots[index];
    if (!entryId) return { entryId: null, usable: false };
    if (SPELLS[entryId]) {
      const { cost, free } = this.getSpellCost(entryId);
      const needsBow = entryId === "aimed_shot" && !ITEMS[player.equipment.weapon]?.range;
      const reason = needsBow ? "Needs a ranged weapon" : player.mana < cost ? `Needs ${cost} mana` : null;
      return { entryId, isSpell: true, cost, free, usable: !reason, reason };
    }
    const count = player.inventory.filter((entry) => entry.itemId === entryId).length;
    return { entryId, isSpell: false, count, usable: count > 0, reason: count > 0 ? null : "None left" };
  }

  castAbility(spellId) {
    if (this.state.ui.overlay) return;
    const player = this.state.run.player;
    const derived = this.getPlayerCombatSnapshot();
    const spell = SPELLS[spellId];
    const { cost, freeUtility, sageEchoCount } = this.getSpellCost(spellId);
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

    const shouldSpendMana = !(spell.type === "spell" && derived.freeCastChance && createRng(hashSeed(this.state.run.runSeed, this.state.run.turn, spellId)).chance(derived.freeCastChance));
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
        // Never land on a shrine, hole, or prop.
        if (!tile || tile.type !== "floor" || tile.occupant || tile.vendor || isBlockedFloor(tile)) continue;
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
        // Never land on a shrine, hole, or prop.
        if (!tile || tile.type !== "floor" || tile.occupant || tile.vendor || isBlockedFloor(tile)) continue;
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
        this.soundPlayer?.play('heal');
        const derived = this.getDerivedStats(player);
        player.hp = Math.min(derived.maxHp, player.hp + item.effect.value);
        this.log(`You recover ${item.effect.value} HP.`);
      } else if (item.effect.type === "mana") {
        this.soundPlayer?.play('use_item');
        const derived = this.getDerivedStats(player);
        player.mana = Math.min(derived.maxMana, player.mana + item.effect.value);
        this.log(`You recover ${item.effect.value} mana.`);
      } else if (item.effect.type === "escape") {
        this.soundPlayer?.play('use_item');
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
      this.soundPlayer?.play('use_item');
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
      const leftBehind = this.getLeftBehind();
      if (leftBehind.length && !currentFloor.leaveWarned) {
        // One reminder per floor; pressing Enter again descends.
        currentFloor.leaveWarned = true;
        const text = `${leftBehind.join(" and ")}. Press Enter again to descend.`;
        this.notify({ kind: "warning", text, duration: 3200 });
        this.log(`Left behind: ${leftBehind.join(" and ")}.`);
        return;
      }
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
      this.soundPlayer?.play('chest_open');
      if (chest.vaultId) {
        const vault = this.state.run.vaultPlan.find((entry) => entry.id === chest.vaultId);
        if (vault) vault.opened = true;
      }
      currentFloor.map[player.y][player.x].chestId = null;
      this.addGold(chest.gold);
      this.log(`${chest.label ?? "Chest"} opened. You collect ${chest.gold} gold.`);
      for (const itemId of chest.loot) {
        this.addToInventory(itemId, { verb: "Found" });
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

  // Loot you've actually seen on this floor but not taken: explored, unopened chests you can open,
  // and a vendor you walked past. Hidden or locked things aren't mentioned, so nothing is spoiled.
  getLeftBehind() {
    const { currentFloor } = this.state.run;
    const chests = (currentFloor.chests ?? []).filter((chest) => !chest.opened
      && currentFloor.map[chest.y]?.[chest.x]?.explored
      && (!chest.locked || this.hasVaultKey(chest.keyItemId)));
    const notes = [];
    if (chests.length) notes.push(`${chests.length} unopened chest${chests.length === 1 ? "" : "s"}`);
    const vendor = currentFloor.vendor;
    if (vendor && !vendor.visited && currentFloor.map[vendor.y]?.[vendor.x]?.explored) notes.push(`${vendor.name ?? "a vendor"} not visited`);
    return notes;
  }

  // Snapshot of run totals when a floor starts, so the floor summary can show what changed.
  markFloorStart() {
    const run = this.state.run;
    run.floorStart = {
      kills: run.runStats.kills,
      goldFound: run.runStats.goldFound ?? 0,
      itemsFound: run.runStats.itemsFound ?? 0,
      turn: run.turn,
    };
  }

  getFloorSummary() {
    const run = this.state.run;
    const start = run.floorStart ?? { kills: 0, goldFound: 0, itemsFound: 0, turn: 0 };
    let floorTiles = 0;
    let exploredTiles = 0;
    for (const row of run.currentFloor.map) {
      for (const tile of row) {
        if (tile.type !== "floor") continue;
        floorTiles += 1;
        if (tile.explored) exploredTiles += 1;
      }
    }
    return {
      floor: run.floorNumber,
      kills: run.runStats.kills - start.kills,
      gold: (run.runStats.goldFound ?? 0) - start.goldFound,
      items: (run.runStats.itemsFound ?? 0) - start.itemsFound,
      turns: run.turn - start.turn,
      explored: floorTiles ? Math.round((exploredTiles / floorTiles) * 100) : 0,
    };
  }

  descend() {
    if (this.state.run.currentFloor.enemies.some((enemy) => ENEMIES[enemy.templateId]?.behavior === "boss")) {
      this.log("A boss blocks the way.");
      return;
    }
    // A glanceable recap of the floor just left; it fades on its own and never blocks play.
    if (this.state.run.floorNumber > 0) {
      const summary = this.getFloorSummary();
      this.notify({ kind: "floor", summary, duration: 4200 });
      this.log(`Floor ${summary.floor}: ${summary.kills} kills, ${summary.items} items, ${summary.gold} gold, ${summary.explored}% explored in ${summary.turns} turns.`);
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
    this.markFloorStart();
    this.soundPlayer?.play('stairs');
    this.log(`You descend to Floor ${nextFloor}.`);
    this.renderer?.showFloorCard(this.getFloorCard(nextFloor));
    const bossEntryLine = this.getBossFloorEntryLine(nextFloor);
    if (bossEntryLine) {
      // Floor-entry lines are narration, not the Grey Witness (who is gone by Floor 1).
      this.showNpcDialog(null, bossEntryLine, 3400);
      this.log(bossEntryLine);
    }
    this.saveRun();
  }

  getInventoryView() {
    this.state.ui.inventoryView = this.state.ui.inventoryView ?? { filter: "all", sort: "recent" };
    return this.state.ui.inventoryView;
  }

  // Filters and orders stacks for display. Each keeps its index in getInventoryStacks(), which is what
  // the inventory actions use, so sorting never changes what a button acts on.
  getVisibleInventoryStacks(view) {
    const typeOrder = ["weapon", "armor", "hands", "accessory", "consumable", "tome", "quest"];
    const rarityOrder = ["boss", "rare", "uncommon", "common"];
    const typeRank = (item) => {
      const rank = typeOrder.indexOf(item.slot ?? item.category);
      return rank === -1 ? typeOrder.length : rank;
    };
    const matches = {
      all: () => true,
      gear: (item) => Boolean(item.slot),
      consumable: (item) => item.category === "consumable",
      other: (item) => !item.slot && item.category !== "consumable",
    };
    const visible = this.getInventoryStacks()
      .map((stack, index) => ({ ...stack, index, item: ITEMS[stack.itemId] }))
      .filter((stack) => (matches[view.filter] ?? matches.all)(stack.item));
    if (view.sort === "rarity") {
      visible.sort((a, b) => rarityOrder.indexOf(this.getItemRarity(a.itemId)) - rarityOrder.indexOf(this.getItemRarity(b.itemId))
        || typeRank(a.item) - typeRank(b.item)
        || a.item.name.localeCompare(b.item.name));
    } else if (view.sort === "type") {
      visible.sort((a, b) => typeRank(a.item) - typeRank(b.item)
        || rarityOrder.indexOf(this.getItemRarity(a.itemId)) - rarityOrder.indexOf(this.getItemRarity(b.itemId))
        || a.item.name.localeCompare(b.item.name));
    }
    return visible;
  }

  // selectedIndex is a stack index from getInventoryStacks(); equippedSlot selects an equipped item instead.
  openInventory(selectedIndex = 0, equippedSlot = null) {
    const player = this.state.run.player;
    const view = this.getInventoryView();
    const stacks = this.getInventoryStacks();
    const visible = this.getVisibleInventoryStacks(view);
    const selectedEquippedId = equippedSlot ? player.equipment[equippedSlot] : null;
    const selectedStack = selectedEquippedId
      ? null
      : visible.find((stack) => stack.index === selectedIndex) ?? visible[0] ?? null;
    const safeIndex = selectedStack ? selectedStack.index : -1;

    const slotNames = { weapon: "Weapon", armor: "Armor", hands: "Hands", accessory: "Accessory" };
    const equippedStrip = Object.entries(slotNames).map(([slot, label]) => {
      const itemId = player.equipment[slot];
      if (!itemId) {
        return `<div class="equip-slot empty"><span class="equip-slot-label">${label}</span><span class="muted">Empty</span></div>`;
      }
      return `
        <button
          class="equip-slot ${this.getItemRarity(itemId)} ${selectedEquippedId && slot === equippedSlot ? "selected" : ""}"
          data-action="inventory-select-equipped"
          data-slot="${slot}"
          data-tooltip="${this.escapeTooltip(this.getItemTooltip(itemId))}"
        >
          ${this.renderItemIcon(itemId, "equip-slot-icon")}
          <span class="equip-slot-text">
            <span class="equip-slot-label">${label}</span>
            <span class="equip-slot-name">${ITEMS[itemId].name}</span>
          </span>
        </button>
      `;
    }).join("");

    const filters = { all: "All", gear: "Gear", consumable: "Consumables", other: "Other" };
    const sorts = { recent: "Recent", rarity: "Rarity", type: "Type" };
    const toolbar = `
      <div class="inventory-toolbar">
        <div class="segmented" role="group" aria-label="Show">
          ${Object.entries(filters).map(([id, label]) => `<button class="${view.filter === id ? "active" : ""}" data-action="inventory-filter" data-filter="${id}" aria-pressed="${view.filter === id}">${label}</button>`).join("")}
        </div>
        <div class="segmented" role="group" aria-label="Sort by">
          <span class="muted">Sort</span>
          ${Object.entries(sorts).map(([id, label]) => `<button class="${view.sort === id ? "active" : ""}" data-action="inventory-sort" data-sort="${id}" aria-pressed="${view.sort === id}">${label}</button>`).join("")}
        </div>
      </div>
    `;

    const list = visible.map((stack) => `
        <button
          class="inventory-tile ${stack.index === safeIndex ? "selected" : ""} ${this.getItemRarity(stack.itemId)} ${this.isOffClassItem(stack.itemId) ? "off-class" : ""}"
          data-action="inventory-select"
          data-index="${stack.index}"
          data-tooltip="${this.escapeTooltip(this.getItemTooltip(stack.itemId, { stackCount: stack.count, includeCompare: true, includeValue: true }))}"
        >
          ${this.renderGearVerdict(stack.itemId)}
          ${stack.indices.some((index) => player.inventory[index]?.isNew) ? `<span class="new-dot" aria-label="New"></span>` : ""}
          ${this.renderItemIcon(stack.itemId)}
          ${stack.count > 1 ? `<span class="inventory-stack-count">x${stack.count}</span>` : ""}
          <span class="inventory-tile-name">${stack.item.name}</span>
        </button>
      `).join("");

    let detail = `<p class="muted">Nothing here.</p>`;
    if (selectedEquippedId) {
      detail = this.renderItemDetail(selectedEquippedId, {
        action: "inventory-unequip",
        actionLabel: "Unequip",
        actionAttrs: `data-slot="${equippedSlot}"`,
        showComparison: false,
        footer: `<p class="muted">Equipped in your ${equippedSlot} slot. Unequipping moves it to your pack.</p>`,
      });
    } else if (selectedStack) {
      const item = selectedStack.item;
      // Keys and similar items have no action; they work automatically.
      const usable = Boolean(item.slot || item.category === "tome" || item.effect);
      detail = this.renderItemDetail(selectedStack.itemId, {
        action: usable ? "inventory-use" : null,
        actionLabel: item.slot ? "Equip" : item.category === "tome" ? "Read Tome" : "Use Item",
        actionIndex: safeIndex,
        footer: `${selectedStack.count > 1 ? `<p class="muted">Stack size: ${selectedStack.count}</p>` : ""}${usable ? `<p class="muted detail-hint">Double-click an item, or press Enter, to ${item.slot ? "equip" : "use"} it.</p>` : ""}`,
      });
    }

    const emptyMessage = stacks.length ? "Nothing matches this filter." : "Your pack is empty.";
    this.state.ui.overlay = {
      type: "inventory",
      title: "Inventory",
      selectedIndex: safeIndex,
      html: `
        <div class="equip-strip">${equippedStrip}</div>
        <div class="compare-layout">
          <div class="compare-list">
            <div class="compare-list-header">
              <h3>Pack</h3>
              <span class="muted">${player.inventory.length} item${player.inventory.length === 1 ? "" : "s"}</span>
            </div>
            ${toolbar}
            <div class="inventory-grid">
              ${list || `<p class="muted">${emptyMessage}</p>`}
            </div>
          </div>
          <div class="compare-detail-pane">
            ${detail}
          </div>
        </div>
      `,
    };
  }

  unequipSlot(slot) {
    const player = this.state.run.player;
    const itemId = player.equipment[slot];
    if (!itemId) return;
    const previousDerived = this.getDerivedStats(player);
    player.equipment[slot] = null;
    this.addToInventory(itemId, { quiet: true });
    this.applyResourceCapDelta(player, previousDerived, this.getDerivedStats(player));
    this.soundPlayer?.play('equip_item');
    this.log(`Unequipped ${ITEMS[itemId].name}.`);
    const nextIndex = this.getStackIndexByItemId(this.getInventoryStacks(), itemId, 0);
    this.openInventory(nextIndex);
  }

  openCharacter() {
    const player = this.state.run.player;
    const run = this.state.run;
    // The snapshot includes temporary effects (Hexed, Chilled, Mana Shield), matching what combat uses.
    const combat = this.getPlayerCombatSnapshot();
    const boon = this.getBoonDefinition(player.boonId);
    const weapon = ITEMS[player.equipment.weapon];
    const range = ([low, high]) => (low === high ? `${low}` : `${low}–${high}`);
    const row = (label, value, tooltip = "") => `
      <div class="sheet-row"${tooltip ? ` data-tooltip="${this.escapeTooltip(tooltip)}"` : ""}>
        <span>${label}</span><strong>${value}</strong>
      </div>`;

    const ranged = Boolean(weapon?.range);
    const bonus = ranged ? combat.rangedBonus : combat.meleeBonus;
    const damagePct = (ranged ? combat.rangedDamagePct : combat.meleeDamagePct) ?? 0;
    const enchantBonus = weapon?.enchantment?.type === "onHitBonusDamage" ? weapon.enchantment.value : 0;
    const weaponRoll = weapon?.damage ?? [1, 2];
    const weaponDamage = weaponRoll.map((roll) => Math.floor((roll + bonus) * (1 + damagePct / 100)) + enchantBonus);
    const critChance = clamp(5 + (combat.critBonus ?? 0), 5, 45);
    const spellId = [...player.quickSlots, ...player.learnedSpells].find((entryId) => SPELLS[entryId]?.type === "spell" && SPELLS[entryId].damage);
    const spell = spellId ? SPELLS[spellId] : null;
    const spellEnchant = weapon?.enchantment?.type === "spellBonusDamage" ? weapon.enchantment.value : 0;
    const spellDamage = spell?.damage.map((roll) => Math.floor((roll + combat.spellBonus) * (1 + combat.spellDamagePct / 100)) + spellEnchant);
    const xpNeeded = this.getXpForLevel(player.level + 1);

    const offense = [
      row(ranged ? "Ranged damage" : "Melee damage", range(weaponDamage), `${weapon?.name ?? "Unarmed"}\nDamage per hit before the enemy's defense and crits.\nWeapon ${range(weaponRoll)}, +${bonus} from ${ranged ? "Dexterity" : "Strength"}${damagePct ? `, +${damagePct}% from gear and skills` : ""}${enchantBonus ? `, +${enchantBonus} enchantment` : ""}.`),
      row("Accuracy", `${Math.min(95, combat.accuracy)}%`, "Accuracy\nWeapon hit chance before the enemy's evasion (capped at 95%).\n85 base + Dexterity + gear."),
      row("Critical chance", `${critChance}%`, "Critical hits\nDeal 1.5× damage. 5% base, capped at 45%."),
      spell ? row(`${spell.name} damage`, range(spellDamage), `${spell.name}\nDamage per hit before the enemy's defense and crits.\nSpell ${range(spell.damage)}, +${combat.spellBonus} spell power${combat.spellDamagePct ? `, +${combat.spellDamagePct}% spell damage` : ""}.`) : "",
      // Spell numbers only matter once you have a damaging spell.
      spell ? row("Spell power", `+${combat.spellBonus}`, "Spell power\nAdded to every spell's damage roll.\nIntelligence ÷ 2 + gear + class.") : "",
      spell && combat.spellDamagePct ? row("Spell damage", `+${combat.spellDamagePct}%`, "Spell damage\nMultiplies spell damage after spell power.") : "",
      spell ? row("Spell accuracy", `${Math.min(95, 90 + (combat.spellAccuracyFlat ?? 0))}%`, "Spell accuracy\nSpell hit chance before the enemy's evasion (capped at 95%).") : "",
    ].join("");

    const defense = [
      row("Max HP", combat.maxHp, `Max HP\n14 base + 3 per Vitality + ${CLASSES[player.classId].hpGrowth} per level + gear.`),
      row("Max mana", combat.maxMana, `Max mana\n2 base + 2 per Intelligence + ${CLASSES[player.classId].manaGrowth} per level + gear.`),
      row("Defense", combat.defense, "Defense\nSubtracted from every hit you take (minimum 1 damage)."),
      row("Evasion", combat.evasion, "Evasion\nSubtracted from each enemy's chance to hit you.\nDexterity ÷ 2 + gear."),
    ].join("");

    const attributes = [
      row("Strength", combat.strength, `Strength\n+${combat.meleeBonus} melee damage (1 per 3 Strength).`),
      row("Dexterity", combat.dexterity, `Dexterity\n+${combat.dexterity} accuracy, +${Math.floor(combat.dexterity / 2)} evasion, +${combat.rangedBonus} ranged damage.`),
      row("Vitality", combat.vitality, `Vitality\n+${combat.vitality * 3} max HP (3 per point).`),
      row("Intelligence", combat.intelligence, `Intelligence\n+${combat.intelligence * 2} max mana and +${Math.floor(combat.intelligence / 2)} spell power.`),
    ].join("");

    const gearEffects = Object.values(player.equipment)
      .filter(Boolean)
      .map((itemId) => ITEMS[itemId])
      .filter((item) => item.enchantment || item.handsEffect)
      .map((item) => `<li><strong>${item.name}</strong> <span class="muted">${item.description ?? this.getEnchantmentDescription(item)}</span></li>`);
    const skills = player.unlockedSkills
      .map((skillId) => this.findSkill(skillId))
      .filter(Boolean)
      .map((skill) => `<li><strong>${skill.name}</strong> <span class="muted">${skill.description}</span></li>`);
    const activeStatuses = player.statuses.filter((status) => ["hexed", "chilled", "arcane_shield"].includes(status.id));

    this.state.ui.overlay = {
      type: "character",
      title: "Character",
      html: `
        <div class="sheet-summary">
          <div>
            <span class="section-kicker">${CLASSES[player.classId].name} · Level ${player.level}</span>
            <h3>${boon ? boon.name : "No boon yet"}</h3>
            ${boon ? `<p class="muted">${boon.summary}</p>` : ""}
          </div>
          <div class="sheet-run">
            ${row("XP", player.level >= 10 ? "Max level" : `${player.xp}/${xpNeeded}`)}
            ${row("Gold", `${player.gold}g`)}
            ${row("Floor", run.floorNumber === 0 ? "Prelude" : run.floorNumber)}
            ${row("Kills", run.runStats.kills)}
          </div>
        </div>
        ${activeStatuses.length ? `<p class="muted sheet-note">Numbers include your current ${activeStatuses.map((status) => STATUS_DEFINITIONS[status.id]?.name ?? status.id).join(" and ")}.</p>` : ""}
        <div class="sheet-grid">
          <section><h4>Offense</h4>${offense}</section>
          <section><h4>Defense</h4>${defense}</section>
          <section><h4>Attributes</h4>${attributes}</section>
        </div>
        <div class="sheet-grid sheet-sources">
          <section>
            <h4>Skills <span class="muted">(${skills.length})</span></h4>
            ${skills.length ? `<ul>${skills.join("")}</ul>` : `<p class="muted">None yet. ${player.skillPoints ? "Press K to spend your skill points." : "Level up to earn skill points."}</p>`}
          </section>
          <section>
            <h4>Gear effects</h4>
            ${gearEffects.length ? `<ul>${gearEffects.join("")}</ul>` : `<p class="muted">No enchanted gear equipped.</p>`}
          </section>
        </div>
        <p><button data-action="open-loadout">Manage Quick Slots</button></p>
      `,
    };
  }

  // Full-screen map of the explored floor; the renderer draws it into the overlay's canvas.
  openFullMap() {
    const run = this.state.run;
    const legend = [
      ["you", "You"],
      ["stairs", "Stairs"],
      ["enemy", "Enemy in view"],
      ["boss", "Boss"],
      ["chest", "Unopened chest"],
      ["loot", "Item"],
      ["vendor", "Vendor"],
      ["shrine", "Shrine"],
    ];
    const summary = this.getFloorSummary();
    this.state.ui.overlay = {
      type: "map",
      variant: "map-view",
      title: run.floorNumber === 0 ? "The Sage's Chamber" : `Floor ${run.floorNumber} · ${BAND_NAMES[run.currentFloor.theme] ?? ""}`,
      html: `
        <div class="full-map-frame"><canvas id="full-map-canvas" class="full-map-canvas"></canvas></div>
        <div class="full-map-footer">
          <div class="full-map-legend">${legend.map(([key, label]) => `<span class="legend-item"><span class="legend-swatch legend-${key}"></span>${label}</span>`).join("")}</div>
          <span class="muted">${summary.explored}% explored · Tab or Esc to close</span>
        </div>
      `,
    };
  }

  openLoadout() {
    const { player } = this.state.run;
    const learnedSpells = [...new Set(player.learnedSpells)]
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
    const entryName = (entryId) => SPELLS[entryId]?.name ?? ITEMS[entryId]?.name ?? entryId;
    const entryIcon = (entryId) => (ITEMS[entryId]
      ? this.renderItemIcon(entryId, "loadout-icon")
      : `<img class="loadout-icon" src="${getSpellIconUrl(entryId) ?? ""}" alt="">`);
    const html = `
      <p class="muted loadout-hint">Click a number to put an entry in that slot, or hover an entry and press 1-${QUICK_SLOT_COUNT}.</p>
      <div class="overlay-grid">
        <div>
          <h3>Quick Slots</h3>
          <div class="loadout-slots">
            ${player.quickSlots.map((entry, index) => `
              <div class="loadout-slot ${entry ? "" : "empty"}">
                <span class="slot-key">${index + 1}</span>
                ${entry ? entryIcon(entry) : ""}
                <span class="loadout-slot-name ${entry ? "" : "muted"}">${entry ? entryName(entry) : "Empty"}</span>
                <button data-action="clear-slot" data-slot-index="${index}" ${entry ? "" : "disabled"} aria-label="Clear slot ${index + 1}">Clear</button>
              </div>
            `).join("")}
          </div>
        </div>
        <div>
          <h3>Assignable</h3>
          ${options.map((option) => `
            <div class="list-card loadout-entry" data-entry-id="${option.id}" data-tooltip="${this.escapeTooltip(SPELLS[option.id] ? this.getSpellTooltip(option.id) : this.getItemTooltip(option.id, { includeValue: true }))}">
              <div class="loadout-entry-name">${entryIcon(option.id)}<strong>${option.label}</strong></div>
              <div class="loadout-assign-row" role="group" aria-label="Assign ${entryName(option.id)} to a slot">
                ${player.quickSlots.map((entry, index) => `<button class="${entry === option.id ? "active" : ""}" data-action="assign-slot" data-slot-index="${index}" data-entry-id="${option.id}" aria-label="Slot ${index + 1}" aria-pressed="${entry === option.id}">${index + 1}</button>`).join("")}
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
    const player = this.state.run.player;
    const branches = SKILL_TREES[player.classId];
    const points = player.skillPoints;
    const html = `
      <p class="skill-points ${points ? "has-points" : ""}">${points
        ? `<strong>${points}</strong> skill point${points === 1 ? "" : "s"} to spend. Each branch unlocks top to bottom.`
        : "No skill points to spend. You earn one each level."}</p>
      <div class="skill-grid">
        ${branches.map((branch) => {
          const unlockedCount = branch.skills.filter((skill) => player.unlockedSkills.includes(skill.id)).length;
          const icon = getBranchIconUrl(branch.id);
          return `
          <div class="skill-branch">
            <div class="skill-branch-head">
              ${icon ? `<span class="skill-branch-icon"><img src="${icon}" alt=""></span>` : ""}
              <div>
                <h3>${branch.name}</h3>
                <span class="skill-branch-progress" aria-label="${unlockedCount} of ${branch.skills.length} unlocked">
                  ${branch.skills.map((_, index) => `<span class="skill-pip${index < unlockedCount ? " filled" : ""}"></span>`).join("")}
                  <span class="muted">${unlockedCount}/${branch.skills.length}</span>
                </span>
              </div>
            </div>
            ${branch.skills.map((skill, index) => {
              const unlocked = player.unlockedSkills.includes(skill.id);
              const previousId = index > 0 ? branch.skills[index - 1].id : null;
              const available = !unlocked && points > 0 && (!previousId || player.unlockedSkills.includes(previousId));
              const state = unlocked ? "unlocked" : available ? "available" : "locked";
              // The connector above a card lights up once the path reaches it.
              const reached = unlocked || (previousId && player.unlockedSkills.includes(previousId));
              return `
                <div class="skill-card ${state}${index > 0 ? " has-connector" : ""}${reached ? " reached" : ""}" data-tooltip="${this.escapeTooltip(this.getSkillTooltip(skill, branch.name, unlocked, available))}">
                  <span class="skill-tier" aria-hidden="true">${unlocked ? "&#10003;" : index + 1}</span>
                  <strong>${skill.name}</strong>
                  <p>${skill.description}</p>
                  ${unlocked ? "" : `<button ${available ? "" : "disabled"} data-action="buy-skill" data-skill-id="${skill.id}">${available ? "Unlock" : "Locked"}</button>`}
                </div>
              `;
            }).join("")}
          </div>
        `;
        }).join("")}
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
    this.soundPlayer?.play('equip_item');
    const previousDerived = this.getDerivedStats(player);
    const previous = player.equipment[item.slot];
    player.equipment[item.slot] = entry.itemId;
    if (previous) {
      this.addToInventory(previous, { quiet: true });
    }
    player.inventory.splice(entryIndex, 1);
    const derived = this.getDerivedStats(player);
    this.applyResourceCapDelta(player, previousDerived, derived);
    this.log(`Equipped ${item.name}.`);
    const nextStacks = this.getInventoryStacks();
    const nextIndex = this.getStackIndexByItemId(nextStacks, entry.itemId, index);
    this.openInventory(nextIndex >= 0 ? nextIndex : 0);
  }

  getSellValue(itemId) {
    return Math.max(1, Math.floor((ITEMS[itemId]?.value ?? 0) * 0.15));
  }

  // Every pack entry "Sell junk" would sell, with the total it would fetch.
  getJunkSale() {
    const entries = this.state.run.player.inventory.filter((entry) => this.isJunkItem(entry.itemId));
    const counts = new Map();
    for (const entry of entries) counts.set(entry.itemId, (counts.get(entry.itemId) ?? 0) + 1);
    return {
      count: entries.length,
      gold: entries.reduce((sum, entry) => sum + this.getSellValue(entry.itemId), 0),
      lines: [...counts].map(([itemId, count]) => ({ itemId, count })),
    };
  }

  openVendor(selectedIndex = 0) {
    const vendor = this.state.run.currentFloor.vendor;
    if (!vendor) return;
    vendor.visited = true;
    const player = this.state.run.player;
    const confirm = this.state.ui.vendorConfirm ?? null;
    const vendorStacks = this.getVendorStacks();
    const safeIndex = vendorStacks.length ? clamp(selectedIndex, 0, vendorStacks.length - 1) : -1;
    const selectedStack = safeIndex >= 0 ? vendorStacks[safeIndex] : null;
    const selectedItemId = selectedStack?.itemId ?? null;
    const vendorList = vendorStacks.map((stack, index) => `
      <button
        class="inventory-tile vendor-tile ${index === safeIndex ? "selected" : ""} ${this.getItemRarity(stack.itemId)} ${this.isOffClassItem(stack.itemId) ? "off-class" : ""} ${player.gold < this.getVendorBuyPrice(stack.itemId) ? "unaffordable" : ""}"
        data-action="vendor-select"
        data-index="${index}"
        data-tooltip="${this.escapeTooltip(this.getItemTooltip(stack.itemId, { stackCount: stack.count, includeCompare: true, includeValue: true }))}"
      >
        ${this.renderGearVerdict(stack.itemId)}
        <span class="inventory-tile-price">${this.getVendorBuyPrice(stack.itemId)}g</span>
        ${this.renderItemIcon(stack.itemId)}
        ${stack.count > 1 ? `<span class="inventory-stack-count">x${stack.count}</span>` : ""}
        <span class="inventory-tile-name">${ITEMS[stack.itemId].name}</span>
      </button>
    `).join("");

    // Quest keys can't be sold; the vault needs them.
    const sellStacks = this.getInventoryStacksWithSellValue()
      .map((stack, index) => ({ ...stack, index }))
      .filter((stack) => ITEMS[stack.itemId]?.category !== "quest");
    const sellable = sellStacks
      .map((stack) => {
        const item = ITEMS[stack.itemId];
        const confirming = confirm?.type === "sell" && confirm.index === stack.index;
        const junk = this.isJunkItem(stack.itemId);
        const actions = confirming
          ? `<span class="sell-confirm-text">Sell this ${this.getItemRarity(stack.itemId)} item?</span>
             <button class="primary" data-action="vendor-sell-confirm" data-index="${stack.index}">Sell</button>
             <button data-action="vendor-cancel">Keep</button>`
          : `<button data-action="vendor-sell" data-index="${stack.index}">Sell</button>`;
        return `
          <div class="sell-row ${this.getItemRarity(stack.itemId)} ${confirming ? "confirming" : ""}" data-tooltip="${this.escapeTooltip(this.getItemTooltip(stack.itemId, { stackCount: stack.count, includeCompare: true, includeValue: true, sellValue: stack.sellValue }))}">
            <div class="sell-row-item">
              ${this.renderItemIcon(stack.itemId, "sell-row-icon")}
              <div>
                <strong>${this.renderGearVerdict(stack.itemId)}${item.name}${stack.count > 1 ? ` x${stack.count}` : ""}</strong>
                <p class="muted">${stack.sellValue}g each${stack.count > 1 ? ` • ${stack.sellValue * stack.count}g total` : ""}${junk ? ` • <span class="junk-tag">junk</span>` : ""}</p>
              </div>
            </div>
            <div class="sell-row-actions">${actions}</div>
          </div>
        `;
      })
      .join("");

    const junk = this.getJunkSale();
    const junkPanel = confirm?.type === "junk" && junk.count
      ? `
        <div class="junk-confirm">
          <strong>Sell ${junk.count} item${junk.count === 1 ? "" : "s"} for ${junk.gold}g?</strong>
          <ul>${junk.lines.map((line) => `<li>${ITEMS[line.itemId].name}${line.count > 1 ? ` x${line.count}` : ""}</li>`).join("")}</ul>
          <p class="muted">Worse than what you have equipped, spare copies of it, or made for another class.</p>
          <div class="detail-actions">
            <button class="primary" data-action="vendor-sell-junk-confirm">Sell all</button>
            <button data-action="vendor-cancel">Cancel</button>
          </div>
        </div>
      `
      : "";

    const price = selectedItemId ? this.getVendorBuyPrice(selectedItemId) : 0;
    const detail = selectedItemId
      ? this.renderItemDetail(selectedItemId, {
        action: "vendor-buy",
        actionLabel: `Buy for ${price}g`,
        actionIndex: safeIndex,
        actionDisabled: player.gold < price,
        priceLabel: `${price}g<span class="detail-price-note">you have ${player.gold}g</span>`,
        footer: `${selectedStack?.count > 1 ? `<p class="muted">Vendor stack: ${selectedStack.count}</p>` : ""}${player.gold < price
          ? `<p class="negative">You need ${price - player.gold} more gold.</p>`
          : `<p class="muted">${player.gold - price}g left after buying.</p>`}`,
      })
      : "<p>No items for sale.</p>";

    const html = `
      <div class="vendor-topline">
        <span>Your gold</span>
        <strong>${player.gold}g</strong>
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
              <button data-action="vendor-sell-junk" ${junk.count ? "" : "disabled"} data-tooltip="${this.escapeTooltip("Sell junk\nSells gear that is worse than what you have equipped, spare copies of it, and gear made for another class. You'll see the list first.")}">
                Sell junk${junk.count ? ` (${junk.count} · ${junk.gold}g)` : ""}
              </button>
            </div>
            ${junkPanel}
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
    if (this.state.run.player.gold < price) {
      this.soundPlayer?.play('ui_denied');
      return;
    }
    this.state.run.player.gold -= price;
    this.addToInventory(itemId, { quiet: true });
    this.state.run.player.inventory[this.state.run.player.inventory.length - 1].isNew = true;
    vendor.stock.splice(stockIndex, 1);
    this.soundPlayer?.play('buy_sell');
    this.log(`Bought ${item.name}.`);
    const nextStacks = this.getVendorStacks();
    const nextIndex = this.getStackIndexByItemId(nextStacks, itemId, index);
    this.openVendor(nextIndex >= 0 ? nextIndex : 0);
  }

  // Rare and boss items ask once before selling (confirmed = true skips the question).
  vendorSell(index, confirmed = false) {
    const stack = this.getInventoryStacksWithSellValue()[index];
    const entryIndex = stack?.indices[0];
    const entry = entryIndex !== undefined ? this.state.run.player.inventory[entryIndex] : null;
    this.state.ui.vendorConfirm = null;
    if (!entry || ITEMS[entry.itemId]?.category === "quest") {
      this.openVendor(this.state.ui.overlay?.selectedIndex ?? 0);
      return;
    }
    const item = ITEMS[entry.itemId];
    const rarity = this.getItemRarity(entry.itemId);
    if (!confirmed && (rarity === "rare" || rarity === "boss")) {
      this.state.ui.vendorConfirm = { type: "sell", index };
      this.openVendor(this.state.ui.overlay?.selectedIndex ?? 0);
      return;
    }
    const value = this.getSellValue(entry.itemId);
    this.state.run.player.gold += value;
    this.state.run.player.inventory.splice(entryIndex, 1);
    this.soundPlayer?.play('buy_sell');
    this.log(`Sold ${item.name} for ${value} gold.`);
    this.openVendor(this.state.ui.overlay?.selectedIndex ?? 0);
  }

  vendorSellJunk(confirmed = false) {
    const sale = this.getJunkSale();
    this.state.ui.vendorConfirm = !confirmed && sale.count ? { type: "junk" } : null;
    if (confirmed && sale.count) {
      const player = this.state.run.player;
      player.inventory = player.inventory.filter((entry) => !this.isJunkItem(entry.itemId));
      player.gold += sale.gold;
      this.soundPlayer?.play('buy_sell');
      this.log(`Sold ${sale.count} junk item${sale.count === 1 ? "" : "s"} for ${sale.gold} gold.`);
    }
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
    // The player can die during their own action (e.g. a trap); enemies must not act on a corpse.
    if (this.state.run.player.hp <= 0) return;
    this.state.run.turn += 1;
    this.takeEnemyTurns();
    if (this.state.run.player.hp <= 0) return;
    this.processStatuses();
    if (!this.isEncounterActive()) {
      this.state.run.player.turnFlags.freeUtilityUsed = false;
    }
    this.updateVisibility();
    if (this.state.run.player.hp <= 0) return;
  }

  processStatuses() {
    const player = this.state.run.player;
    const previousPlayerStatuses = [...player.statuses];
    player.statuses = player.statuses
      .map((status) => {
        if (status.fresh) return { ...status, fresh: false };
        if (status.id === "poisoned") {
          player.hp = Math.max(0, player.hp - 1);
          this.recordDamage("taken", 1);
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
      this.handleDeath("Succumbed to poison.", { kind: "poison", name: "Poison" });
      return;
    }
    for (const enemy of [...this.state.run.currentFloor.enemies]) {
      // Skip anything removed earlier in this loop (a summon whose master just died).
      if (!this.state.run.currentFloor.enemies.includes(enemy)) continue;
      const previousStatuses = [...enemy.statuses];
      let poisonDamage = 0;
      enemy.statuses = enemy.statuses
        .map((status) => {
          if (status.fresh) return { ...status, fresh: false };
          if (status.id === "poisoned") poisonDamage += status.value ?? 1;
          return { ...status, turns: status.turns - 1 };
        })
        .filter((status) => status.turns > 0);
      if (poisonDamage > 0) {
        enemy.hp -= poisonDamage;
        this.recordDamage("dealt", poisonDamage);
        if (this.state.run.currentFloor.map[enemy.y]?.[enemy.x]?.visible) {
          this.renderer?.queueDamagePopup({ x: enemy.x, y: enemy.y, damage: poisonDamage, type: "enemy" });
          this.log(`${enemy.name} takes ${poisonDamage} poison damage.`);
        }
        if (enemy.hp <= 0) {
          this.killEnemy(enemy);
          continue;
        }
      }
      if (this.state.run.currentTargetId === enemy.id) {
        for (const status of previousStatuses) {
          if (!enemy.statuses.some((entry) => entry.id === status.id)) {
            this.log(`${STATUS_DEFINITIONS[status.id]?.name ?? status.id} fades from ${enemy.name}.`);
          }
        }
      }
    }
  }

  // Marks a boss attack due next turn, so the renderer can show where it lands: "melee" reddens the
  // tiles the boss can reach, "bolt" puts a target on the player. Expires once that turn has passed.
  setTelegraph(enemy, kind) {
    enemy.telegraph = { kind, landsOnTurn: enemy.turnCounter + 1 };
  }

  isInsideRoom(point, room) {
    return point.x >= room.x && point.x < room.x + room.width && point.y >= room.y && point.y < room.y + room.height;
  }

  wakeGuard(enemy) {
    if (!enemy.holdRoom || enemy.roomTriggered) return;
    const { player } = this.state.run;
    enemy.roomTriggered = true;
    enemy.alerted = true;
    enemy.lastKnownPlayerPosition = { x: player.x, y: player.y };
  }

  takeEnemyTurns() {
    const { currentFloor, player } = this.state.run;
    for (const enemy of [...currentFloor.enemies]) {
      if (enemy.disguised) continue;
      // Guards (bosses and the final sentries) hold their room until the player steps inside or
      // strikes them. Their attack rhythm starts from that moment, so every fight opens the same way.
      if (enemy.holdRoom && !enemy.roomTriggered) {
        if (!this.isInsideRoom(player, enemy.holdRoom)) continue;
        this.wakeGuard(enemy);
      }
      enemy.turnCounter += 1;
      const template = this.getEnemyCombatStats(enemy);
      const distance = manhattan(enemy, player);
      const detectionRange = template.behavior === "caster" ? (template.range ?? 6) : 7;
      const canSee = hasLineOfSight(currentFloor.map, enemy, player) && distance <= detectionRange;
      if (canSee) {
        enemy.alerted = true;
        enemy.lastKnownPlayerPosition = { x: player.x, y: player.y };
      }
      if ((canSee || enemy.roomTriggered) && ENEMIES[enemy.templateId]?.behavior === "boss") {
        const sightKey = `${enemy.templateId}Seen`;
        if (!player.floorFlags[sightKey]) {
          player.floorFlags[sightKey] = true;
          // Name-plate introduction over the map; the renderer fades it out on its own.
          const memory = this.getBossMemory()[enemy.templateId];
          this.state.ui.bossIntro = {
            templateId: enemy.templateId,
            name: enemy.name,
            kicker: memory?.lastOutcome ? "It remembers you" : "A guardian stirs",
            title: BOSS_TITLES[enemy.templateId] ?? "",
            startedAt: Date.now(),
          };
          const sightLine = this.getBossSightLine(enemy.templateId, memory?.lastOutcome);
          if (sightLine) {
            // Sight lines describe the boss in the third person, so they're narration too.
            this.showNpcDialog(null, sightLine, 3400);
            this.log(sightLine);
          }
        }
      }
      if (!enemy.alerted) continue;

      if (enemy.templateId === "abyssal_overlord" && !enemy.phaseTwo && enemy.hp <= enemy.maxHp / 2) {
        enemy.phaseTwo = true;
        this.log("The Abyssal Overlord erupts in shadowflame.");
        this.renderer?.triggerFlash("void");
        this.renderer?.shake();
        // A second name plate marks the turn in the fight.
        this.state.ui.bossIntro = { templateId: enemy.templateId, name: enemy.name, kicker: "The throne answers", title: "Phase two: shadowflame", phase: true, startedAt: Date.now() };
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
            this.renderer?.triggerFlash("void");
            continue;
          }
        }
      }

      if (enemy.templateId === "abyssal_overlord" && canSee && enemy.turnCounter % 3 === 2) {
        if (distance === 1) {
          this.log("The Abyssal Overlord draws back for a sweeping cleave.");
          this.setTelegraph(enemy, "melee");
        } else if (distance <= (template.range ?? 6) + 1) {
          this.log("The Abyssal Overlord gathers abyssal fire.");
          this.setTelegraph(enemy, "bolt");
        }
      }

      // Warnings fire one turn before the attack they name, matching the timings below:
      // gravefire and the boss cleave land on turns divisible by 3, Patches' smash on turns divisible by 4.
      const nextTurn = enemy.turnCounter + 1;
      if (enemy.templateId === "bone_captain" && canSee && nextTurn % 3 === 0) {
        if (distance === 1) {
          this.log("Super Skeletor raises a bony hand for a crushing strike.");
          this.setTelegraph(enemy, "melee");
        } else if (distance <= (template.range ?? 5)) {
          this.log("Super Skeletor gathers a bolt of gravefire.");
          this.setTelegraph(enemy, "bolt");
        }
      }

      if (enemy.templateId === "patches" && canSee && distance <= 2) {
        if (nextTurn % 4 === 0) {
          this.log("Patches lifts both fists for a brutal smash.");
          this.setTelegraph(enemy, "melee");
        } else if (nextTurn % 3 === 0) {
          this.log("Patches heaves back for a crushing blow.");
          this.setTelegraph(enemy, "melee");
        }
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

      // Lurkers are rooted in place and lash out at anything within reach.
      if (template.behavior === "lurker") {
        if (canSee && distance <= (template.range ?? 1)) {
          this.enemyAttack(enemy);
          if (player.hp <= 0) return;
        }
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
      if (tile && tile.type === "floor" && !tile.occupant && !tile.vendor && !tile.stairs && !isBlockedFloor(tile)) {
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
        return tile && tile.type === "floor" && !tile.occupant && !isBlockedFloor(tile);
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
    const rng = createRng(hashSeed(this.state.run.runSeed, this.state.run.turn, enemy.id, mode));
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
    this.recordDamage("taken", damage);
    this.soundPlayer?.play('enemy_hit_player');
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
    if (player.hp <= 0) this.handleDeath(`Slain by ${enemy.name}.`, { kind: "enemy", name: enemy.name, templateId: enemy.templateId, elite: enemy.elite });
  }

  // source: { kind: "enemy" | "trap" | "poison", name, templateId?, elite? } for the epitaph portrait.
  handleDeath(message, source = null) {
    if (this.state.run.deathMessage) return;
    this.state.run.deathMessage = message;
    this.soundPlayer?.play('player_death');
    this.clearSave();
    this.log(message);
    // Lingering effects shouldn't keep ticking or show on the fallen hero.
    this.state.run.player.statuses = [];
    this.state.run.endInfo = { result: "death", cause: message.replace(/^(Slain|Killed) by /, "").replace(/\.$/, ""), source };
    // Dying during a boss fight counts as a loss to that boss, however the final blow landed.
    const bossInFight = this.state.run.currentFloor.enemies.find((enemy) => ENEMIES[enemy.templateId]?.behavior === "boss"
      && this.state.run.player.floorFlags?.[`${enemy.templateId}Seen`]);
    if (bossInFight) this.recordBossOutcome(bossInFight.templateId, "killed");
    this.state.mode = "in_game";
    this.openRunEnd();
  }

  handleVictory() {
    this.clearSave();
    this.state.run.endInfo = { result: "victory", cause: "Dungeon Cleared", source: null };
    this.openRunEnd();
  }

  // Highest rarity, then highest value, across everything the hero carried at the end.
  getBestItemCarried(player) {
    const rarityRank = { boss: 4, rare: 3, uncommon: 2, common: 1 };
    const itemIds = [...Object.values(player.equipment).filter(Boolean), ...player.inventory.map((entry) => entry.itemId)]
      .filter((itemId) => ITEMS[itemId] && ITEMS[itemId].category !== "quest");
    return itemIds.sort((a, b) => (rarityRank[this.getItemRarity(b)] ?? 0) - (rarityRank[this.getItemRarity(a)] ?? 0)
      || (ITEMS[b].value ?? 0) - (ITEMS[a].value ?? 0))[0] ?? null;
  }

  getEpitaphLine(run) {
    const floor = run.floorNumber;
    const lines = floor >= 30
      ? ["The throne was near. It is always near.", "Whatever judged you there is not finished."]
      : floor >= 21
        ? ["The void does not remember names.", "Starless dark took the last of the light.", "Even the echoes stopped answering."]
        : floor === 20
          ? ["Patches stitched one more trophy to the wall.", "The second threshold held."]
          : floor >= 11
            ? ["The deep water closes over the name.", "The vaults keep their silence, and now yours.", "Somewhere below, the drains carried the rest."]
            : floor === 10
              ? ["Super Skeletor adds another bone to the pile.", "The first seal held."]
              : ["The crypt keeps what it takes.", "Only the torches saw the end.", "A short delve, and a long rest."];
    const rng = createRng(hashSeed(run.runSeed, floor, "epitaph"));
    return rng.pick(lines);
  }

  renderRunPortrait(run, source) {
    const manifest = this.renderer?.assets?.manifest;
    if (!manifest) return "";
    if (source?.kind === "enemy" && source.templateId) {
      const path = getActorSpriteFrame(manifest, getEnemySpriteId(manifest, { templateId: source.templateId, elite: source.elite }), 0);
      const actorId = getEnemySpriteId(manifest, { templateId: source.templateId, elite: source.elite });
      return path ? `<img class="run-end-portrait" src="${path}" data-animate-actor="${actorId}" alt="${source.name}">` : "";
    }
    if (source?.kind === "poison") {
      const url = getStatusIconUrl("poisoned");
      return url ? `<img class="run-end-portrait run-end-portrait--icon" src="${url}" alt="Poison">` : "";
    }
    if (source?.kind === "trap") {
      const path = manifest.traps?.[source.trapId] ?? manifest.traps?.spikes;
      return path ? `<img class="run-end-portrait run-end-portrait--icon" src="${path}" alt="${source.name}">` : "";
    }
    const heroPath = getActorSpriteFrame(manifest, run.player.classId, 0);
    return heroPath ? `<img class="run-end-portrait" src="${heroPath}" data-animate-actor="${run.player.classId}" alt="${CLASSES[run.player.classId].heroName}">` : "";
  }

  renderRunRecap(run, summary) {
    const { player, runStats } = run;
    const bestItemId = this.getBestItemCarried(player);
    const tile = (label, value) => `<div class="recap-stat"><span>${label}</span><strong>${value}</strong></div>`;
    const bestItem = bestItemId
      ? `
        <div class="recap-best ${this.getItemRarity(bestItemId)}" data-tooltip="${this.escapeTooltip(this.getItemTooltip(bestItemId))}">
          ${this.renderItemIcon(bestItemId, "recap-best-icon")}
          <div>
            <span class="section-kicker">Finest possession</span>
            <strong>${ITEMS[bestItemId].name}</strong>
            <span class="muted">${this.getItemRarity(bestItemId)}</span>
          </div>
        </div>`
      : "";
    return `
      <div class="recap-grid">
        ${tile("Floor", run.floorNumber)}
        ${tile("Level", player.level)}
        ${tile("Kills", runStats.kills)}
        ${tile("Turns", run.turn)}
        ${tile("Damage dealt", runStats.damageDealt ?? 0)}
        ${tile("Damage taken", runStats.damageTaken ?? 0)}
        ${tile("Gold", `${player.gold}g`)}
        ${tile("Score", summary.score)}
      </div>
      ${bestItem}
    `;
  }

  // Full-screen end-of-run card: a gravestone for deaths, the empty throne for victories.
  openRunEnd(options = {}) {
    const run = this.state.run;
    const info = run.endInfo ?? { result: "death", cause: "Unknown", source: null };
    const victory = info.result === "victory";
    const summary = this.buildRunSummary(run, info.cause, info.result);
    const classDef = CLASSES[run.player.classId];
    const boon = this.getBoonDefinition(run.player.boonId);
    const article = (name) => (/^[aeiou]/i.test(name) ? "an" : "a");
    const deathLine = info.source?.kind === "enemy"
      ? `Fell on Floor ${run.floorNumber} to ${info.source.templateId && ENEMIES[info.source.templateId]?.behavior === "boss" ? "" : `${article(info.source.name)} `}${info.source.elite ? "elite " : ""}${info.source.name}.`
      : info.source?.kind === "trap"
        ? `Fell on Floor ${run.floorNumber} to ${article(info.source.name)} ${info.source.name}.`
        : info.source?.kind === "poison"
          ? `Succumbed to poison on Floor ${run.floorNumber}.`
          : `Fell on Floor ${run.floorNumber}.`;

    const hero = `
      <div class="run-end-stone">
        <span class="run-end-kicker">${victory ? "The Abyssal Throne" : "Here lies"}</span>
        <div class="run-end-portrait-frame">${this.renderRunPortrait(run, victory ? null : info.source)}</div>
        <h2 class="run-end-name">${classDef.heroName}</h2>
        <p class="run-end-class">${classDef.name} · Level ${run.player.level}${boon ? ` · ${boon.name}` : ""}</p>
        <p class="run-end-line">${victory ? "The Abyssal Overlord is slain, and the throne below stands empty." : deathLine}</p>
        <p class="run-end-flavor">${victory ? "Whether you broke the dungeon's cycle or fulfilled its oldest demand remains unclear." : this.getEpitaphLine(run)}</p>
      </div>
    `;

    this.state.ui.overlay = {
      type: victory ? "victory" : "death",
      variant: victory ? "run-end run-end--victory" : "run-end run-end--death",
      dismissible: false,
      title: victory ? "Dungeon Cleared" : "You Died",
      html: `
        <div class="run-end-layout">
          ${hero}
          <div class="run-end-details">
            <h3 class="run-end-heading">Run recap</h3>
            ${this.renderRunRecap(run, summary)}
            ${this.renderScoreSaveSection(summary, { savedName: options.savedName ?? "", feedback: options.feedback ?? "", feedbackTone: options.feedback ? "negative" : "muted" })}
            <div class="run-end-actions">
              <button class="primary" data-action="new-run-from-death">Start New Run</button>
              <button data-action="main-menu">Main Menu</button>
            </div>
          </div>
        </div>
      `,
    };
  }

  closeOverlay() {
    if (this.state.ui.overlay && this.state.ui.overlay.dismissible === false) return;
    // Items count as seen once the inventory has been open.
    if (this.state.ui.overlay?.type === "inventory") {
      for (const entry of this.state.run?.player.inventory ?? []) delete entry.isNew;
    }
    this.soundPlayer?.play('ui_cancel');
    this.state.ui.overlay = null;
    this.state.ui.vendorConfirm = null;
  }

  handleOverlayAction(action, payload) {
    switch (action) {
      case "choose-boon":
        this.chooseBoon(payload.boonId);
        break;
      case "inventory-use":
        this.equipInventoryIndex(Number(payload.index));
        break;
      case "inventory-select":
        this.openInventory(Number(payload.index));
        break;
      case "inventory-select-equipped":
        this.openInventory(this.state.ui.overlay?.selectedIndex ?? 0, payload.slot);
        break;
      case "inventory-unequip":
        this.unequipSlot(payload.slot);
        break;
      case "inventory-filter":
        this.getInventoryView().filter = payload.filter;
        this.openInventory(this.state.ui.overlay?.selectedIndex ?? 0);
        break;
      case "inventory-sort":
        this.getInventoryView().sort = payload.sort;
        this.openInventory(this.state.ui.overlay?.selectedIndex ?? 0);
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
        this.state.ui.vendorConfirm = null;
        this.vendorBuy(Number(payload.index));
        break;
      case "vendor-select":
        this.state.ui.vendorConfirm = null;
        this.openVendor(Number(payload.index));
        break;
      case "vendor-sell":
        this.vendorSell(Number(payload.index));
        break;
      case "vendor-sell-confirm":
        this.vendorSell(Number(payload.index), true);
        break;
      case "vendor-sell-junk":
        this.vendorSellJunk();
        break;
      case "vendor-sell-junk-confirm":
        this.vendorSellJunk(true);
        break;
      case "vendor-cancel":
        this.state.ui.vendorConfirm = null;
        this.openVendor(this.state.ui.overlay?.selectedIndex ?? 0);
        break;
      case "new-run-from-death":
        this.state.mode = "class";
        this.state.ui.overlay = null;
        break;
      case "main-menu":
        this.state.mode = "menu";
        this.state.run = null;
        this.state.ui.overlay = null;
        this.resetLogs("Begin a new run to enter the dungeon.");
        break;
      case "save-score": {
        if (!this.state.run) break;
        if (this.state.run.scoreSaved) {
          this.state.mode = "scores";
          this.state.ui.overlay = null;
          this.state.run = null;
          this.resetLogs("Begin a new run to enter the dungeon.");
          break;
        }
        const endInfo = this.state.run.endInfo ?? { result: "death", cause: this.lastLogText() || "Unknown" };
        const summary = this.buildRunSummary(this.state.run, endInfo.cause, endInfo.result);
        const saveResult = this.saveHighScore(payload.playerName, summary);
        if (saveResult.ok) {
          this.state.run.scoreSaved = true;
          this.state.mode = "scores";
          this.state.ui.overlay = null;
          this.state.run = null;
          this.resetLogs("Begin a new run to enter the dungeon.");
        } else {
          this.openRunEnd({ feedback: saveResult.error, savedName: this.normalizePlayerName(payload.playerName) });
        }
        break;
      }
      default:
        break;
    }
  }
}
