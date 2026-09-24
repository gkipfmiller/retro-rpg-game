import { Game } from "./game.js";
import { Renderer } from "./render.js";
import { SoundPlayer } from "./sound.js";
import { getActorSpriteFrame, getItemSprite, loadAssets } from "./assets.js";
import { MenuScene } from "./menuScene.js";
import { SPELLS, ITEMS, CLASSES, BOONS, QUICK_SLOT_COUNT } from "./data.js";
import { loadSettings, renderSettingsControls, saveSettings } from "./settings.js";
import { logText } from "./log.js";

const game = new Game();
const renderer = new Renderer(game);
const soundPlayer = new SoundPlayer();
game.attachRenderer(renderer);
game.attachSoundPlayer(soundPlayer);

const settings = loadSettings();

function applySettings() {
  soundPlayer.setMasterVolume(settings.muted ? 0 : settings.volume);
  renderer.showMinimap = settings.minimap;
  renderer.logFilter = settings.logFilter;
}

// Keeps every copy of the settings controls (menu card and in-game panel) in step with the stored values.
function syncSettingsControls() {
  for (const input of document.querySelectorAll("[data-setting]")) {
    const name = input.dataset.setting;
    if (input.type === "checkbox") input.checked = Boolean(settings[name]);
    if (name === "volume") {
      input.value = String(Math.round(settings.volume * 100));
      input.disabled = settings.muted;
    }
  }
  for (const output of document.querySelectorAll('[data-setting-output="volume"]')) {
    output.textContent = `${Math.round(settings.volume * 100)}%`;
  }
}

function updateSetting(name, value) {
  settings[name] = value;
  saveSettings(settings);
  applySettings();
  syncSettingsControls();
}

function openSettingsOverlay() {
  game.state.ui.overlay = {
    type: "settings",
    title: "Settings",
    html: `<div class="settings-card">${renderSettingsControls(settings)}</div>`,
  };
}

applySettings();

const menuScene = new MenuScene(document.getElementById("menu-backdrop"));

const screens = {
  menu: document.getElementById("menu-screen"),
  class: document.getElementById("class-screen"),
  scores: document.getElementById("scores-screen"),
  game: document.getElementById("game-screen"),
};
const tooltip = document.getElementById("ui-tooltip");
const mobileControls = document.getElementById("mobile-controls");
let loadedAssets = null;

const classSpriteTargets = [
  { id: "class-sprite-warrior", actorId: "warrior" },
  { id: "class-sprite-wizard", actorId: "wizard" },
  { id: "class-sprite-ranger", actorId: "ranger" },
];

function syncClassPortraits(frameIndex = 0) {
  if (!loadedAssets) return;
  for (const target of classSpriteTargets) {
    const image = document.getElementById(target.id);
    const fallback = image?.parentElement?.querySelector(".class-icon-fallback");
    const spritePath = getActorSpriteFrame(loadedAssets.manifest, target.actorId, frameIndex);
    if (image && spritePath && loadedAssets.images[spritePath]) {
      if (image.src !== new URL(spritePath, window.location.href).href) {
        image.src = spritePath;
      }
      image.classList.remove("hidden");
      fallback?.classList.add("hidden");
    }
  }
}

// Fills each class card with its level-1 numbers, straight from the class data.
function renderClassStats() {
  const attributeNames = { strength: "STR", dexterity: "DEX", vitality: "VIT", intelligence: "INT" };
  const maxPips = 8;
  for (const slot of document.querySelectorAll("[data-class-stats]")) {
    const classDef = CLASSES[slot.dataset.classStats];
    const stats = classDef.startingStats;
    // Same formulas as getDerivedStats at level 1 with no gear bonuses.
    const hp = 14 + stats.vitality * 3;
    const mana = 2 + stats.intelligence * 2;
    const attributes = Object.entries(attributeNames).map(([key, label]) => `
      <span class="attr-row">
        <span class="attr-name">${label}</span>
        <span class="attr-pips">${Array.from({ length: maxPips }, (_, index) => `<span class="attr-pip${index < stats[key] ? " filled" : ""}"></span>`).join("")}</span>
        <span class="attr-value">${stats[key]}</span>
      </span>`).join("");
    const kit = classDef.startingItems.map((itemId) => {
      const icon = loadedAssets ? getItemSprite(loadedAssets.manifest, itemId) : null;
      const tooltip = game.escapeTooltip(game.getItemTooltip(itemId));
      return icon ? `<img class="kit-icon" src="${icon}" alt="${ITEMS[itemId].name}" data-tooltip="${tooltip}">` : "";
    }).join("");
    const abilities = classDef.abilities
      .map((spellId) => `<span class="ability-chip" data-tooltip="${game.escapeTooltip(game.getSpellTooltip(spellId))}">${SPELLS[spellId]?.name ?? spellId}</span>`)
      .join("");
    slot.innerHTML = `
      <span class="class-vitals">
        <span class="vital vital-hp"><img src="${loadedAssets?.manifest.uiIcons.heart ?? ""}" alt="">${hp} HP</span>
        <span class="vital vital-mana"><img src="${loadedAssets?.manifest.uiIcons.mana ?? ""}" alt="">${mana} Mana</span>
        <span class="vital vital-growth">+${classDef.hpGrowth} HP / +${classDef.manaGrowth} MP per level</span>
      </span>
      <span class="attr-rows">${attributes}</span>
      <span class="class-kit"><span class="kit-label">Starts with</span>${kit}${abilities}</span>
    `;
  }
}

function formatSavedAgo(savedAt) {
  if (!savedAt) return "";
  const minutes = Math.round((Date.now() - savedAt) / 60000);
  if (minutes < 1) return "saved just now";
  if (minutes < 60) return `saved ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `saved ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `saved ${days} day${days === 1 ? "" : "s"} ago`;
}

// The main menu's summary of the saved run: who, where, how healthy, and when it was saved.
function renderContinueCard() {
  const card = document.getElementById("continue-card");
  const save = game.getSaveSummary();
  card.classList.toggle("hidden", !save);
  document.getElementById("new-run-confirm").classList.add("hidden");
  // With a run to resume, Continue is the main action and New Run steps back.
  document.getElementById("new-run-button").classList.toggle("primary", !save);
  if (!save) return;
  card.dataset.actorId = save.classId;
  document.getElementById("continue-name").textContent = save.heroName;
  document.getElementById("continue-detail").textContent = [`${save.className} · Level ${save.level}`, save.boonName].filter(Boolean).join(" · ");
  document.getElementById("continue-where").textContent = save.floor === 0 ? "The Sage's Chamber" : `Floor ${save.floor}${save.band ? ` · ${save.band}` : ""}`;
  const hpBar = document.getElementById("continue-hp-bar");
  hpBar.style.width = save.maxHp ? `${Math.max(0, Math.min(100, (save.hp / save.maxHp) * 100))}%` : "100%";
  document.getElementById("continue-hp-text").textContent = save.maxHp ? `${save.hp}/${save.maxHp} HP` : `${save.hp} HP`;
  document.getElementById("continue-meta").textContent = [`${save.kills} kills`, `${save.gold}g`, formatSavedAgo(save.savedAt)].filter(Boolean).join(" · ");
  syncContinuePortrait(0);
}

function syncContinuePortrait(frameIndex) {
  const card = document.getElementById("continue-card");
  const image = document.getElementById("continue-sprite");
  if (!loadedAssets || !card.dataset.actorId) return;
  const path = getActorSpriteFrame(loadedAssets.manifest, card.dataset.actorId, frameIndex);
  if (path && image.getAttribute("src") !== path) image.setAttribute("src", path);
}

function syncScreens() {
  Object.values(screens).forEach((screen) => screen.classList.remove("visible"));
  if (game.state.mode === "menu") screens.menu.classList.add("visible");
  else if (game.state.mode === "class") screens.class.classList.add("visible");
  else if (game.state.mode === "scores") screens.scores.classList.add("visible");
  else screens.game.classList.add("visible");
  menuScene.setActive(game.state.mode !== "in_game");
  if (game.state.mode === "menu") renderContinueCard();
  renderer.render();
}

function syncMobileControls() {
  if (!mobileControls) return;
  const mobileHud = document.getElementById("mobile-hud");
  const inGame = game.state.mode === "in_game";

  const overlayOpen = inGame && !!game.state.ui?.overlay;
  const showControls = inGame && !overlayOpen;

  mobileControls.classList.toggle("hidden", !showControls);
  mobileControls.classList.toggle("visible", showControls);
  if (mobileHud) {
    mobileHud.classList.toggle("hidden", !showControls);
    mobileHud.classList.toggle("visible", showControls);
  }

  if (!inGame) return;

  const run = game.state.run;
  const player = run?.player;
  if (!player) return;

  const derived = game.getDerivedStats(player);

  // Mobile HUD
  if (mobileHud) {
    document.getElementById("mobile-hud-class").textContent = CLASSES[player.classId]?.name ?? "";
    document.getElementById("mobile-hud-floor").textContent = run.floorNumber === 0 ? "Prelude" : `Fl ${run.floorNumber}`;
    document.getElementById("mobile-hud-level").textContent = `Lv ${player.level}`;
    document.getElementById("mobile-hud-gold").textContent = `${player.gold}g`;

    document.getElementById("mobile-hp-bar").style.width = `${(player.hp / derived.maxHp) * 100}%`;
    document.getElementById("mobile-hp-text").textContent = `${player.hp}/${derived.maxHp}`;
    document.getElementById("mobile-mana-bar").style.width = `${(player.mana / derived.maxMana) * 100}%`;
    document.getElementById("mobile-mana-text").textContent = `${player.mana}/${derived.maxMana}`;

    const weapon = player.equipment.weapon ? ITEMS[player.equipment.weapon] : null;
    const armor = player.equipment.armor ? ITEMS[player.equipment.armor] : null;
    const boon = BOONS[player.boonId];
    document.getElementById("mobile-hud-weapon").textContent = weapon ? weapon.name : "No weapon";
    document.getElementById("mobile-hud-armor").textContent = armor ? armor.name : "No armor";
    document.getElementById("mobile-hud-boon").textContent = boon ? boon.name : "";
  }

  // Mobile log
  const mobileLog = document.getElementById("mobile-log");
  if (mobileLog) {
    const recent = game.state.logs.slice(-3);
    mobileLog.innerHTML = recent.map((entry) => `<div>${logText(entry)}</div>`).join("");
  }
}

function refresh() {
  if (game.state.mode === "scores") {
    document.getElementById("high-scores-content").innerHTML = game.renderHighScoreList(12);
  }
  syncScreens();
  renderer.render();
  syncMobileControls();
}

function jumpToFloor(floorNumber, options = {}) {
  const targetFloor = Math.max(1, Math.min(30, Number(floorNumber) || 1));
  const { classId = "warrior", boonId = null } = options;

  if (!game.state.run || game.state.mode !== "in_game") {
    game.startRun(classId);
  }

  const run = game.state.run;
  if (run.floorNumber === 0) {
    const availableChoices = run.currentFloor.sage?.choices ?? [];
    const selectedBoonId = (boonId && availableChoices.includes(boonId))
      ? boonId
      : availableChoices[0];
    if (selectedBoonId) {
      game.chooseBoon(selectedBoonId);
      game.closeOverlay();
    }
  }

  while (game.state.run.floorNumber < targetFloor) {
    game.state.run.currentFloor.enemies = [];
    game.descend();
  }

  refresh();
  return {
    floorNumber: game.state.run.floorNumber,
    classId: game.state.run.player.classId,
    boonId: game.state.run.player.boonId,
  };
}

function frame() {
  if (game.state.mode === "class") {
    syncClassPortraits(Math.floor(performance.now() / 220));
  }
  if (game.state.mode === "menu") {
    syncContinuePortrait(Math.floor(performance.now() / 220));
  }
  renderer.render();
  // Re-check every frame: enemies move under a still cursor, and the camera glides after each step.
  if (mapHoverPoint || mapHoverText) updateMapHover();
  window.requestAnimationFrame(frame);
}

document.getElementById("continue-run-button").addEventListener("click", () => {
  if (game.loadSavedRun()) refresh();
});

// Starting over replaces the saved run, so with a save present it asks once first.
document.getElementById("new-run-button").addEventListener("click", () => {
  const save = game.getSaveSummary();
  if (save) {
    document.getElementById("new-run-confirm-text").textContent = `Starting a new run abandons ${save.heroName}'s run on ${save.floor === 0 ? "the Sage's Chamber" : `Floor ${save.floor}`}.`;
    document.getElementById("new-run-confirm").classList.remove("hidden");
    document.getElementById("new-run-confirm-no").focus();
    return;
  }
  game.setMode("class");
  refresh();
});

document.getElementById("new-run-confirm-yes").addEventListener("click", () => {
  game.clearSave();
  game.setMode("class");
  refresh();
});

document.getElementById("new-run-confirm-no").addEventListener("click", () => {
  document.getElementById("new-run-confirm").classList.add("hidden");
  document.getElementById("continue-run-button").focus();
});

document.getElementById("hud-new-items").addEventListener("click", () => {
  game.openInventory();
  refresh();
});

document.getElementById("class-back-button").addEventListener("click", () => {
  game.setMode("menu");
  refresh();
});

document.getElementById("scores-back-button").addEventListener("click", () => {
  game.setMode("menu");
  refresh();
});

document.getElementById("how-to-play-button").addEventListener("click", () => {
  document.getElementById("how-to-play").classList.toggle("hidden");
});

document.getElementById("settings-button").addEventListener("click", () => {
  const card = document.getElementById("menu-settings");
  const opening = card.classList.contains("hidden");
  if (opening) card.innerHTML = renderSettingsControls(settings);
  card.classList.toggle("hidden", !opening);
});

document.addEventListener("input", (event) => {
  const input = event.target.closest?.('[data-setting="volume"]');
  if (input) updateSetting("volume", Number(input.value) / 100);
});

document.addEventListener("change", (event) => {
  const input = event.target.closest?.("[data-setting]");
  if (!input) return;
  if (input.type === "checkbox") updateSetting(input.dataset.setting, input.checked);
  // Play a sample so the player can hear the new level.
  if (input.dataset.setting === "volume" || (input.dataset.setting === "muted" && !input.checked)) soundPlayer.play("ui_confirm");
  refresh();
});

for (const chip of document.querySelectorAll("[data-log-filter]")) {
  chip.addEventListener("click", () => {
    updateSetting("logFilter", chip.dataset.logFilter);
    // Hand focus back so Space and Enter keep driving the game, not the chip.
    chip.blur();
    refresh();
  });
}

document.getElementById("hud-skill-points").addEventListener("click", () => {
  game.openSkills();
  refresh();
});

document.getElementById("high-scores-button").addEventListener("click", () => {
  game.openHighScores();
  refresh();
});

for (const card of document.querySelectorAll(".class-card")) {
  card.addEventListener("click", () => {
    game.startRun(card.dataset.classId);
    refresh();
  });
}

for (let index = 0; index < QUICK_SLOT_COUNT; index += 1) {
  document.getElementById(`quick-slot-${index + 1}`)?.addEventListener("click", () => { game.useQuickSlot(index); refresh(); });
}
document.getElementById("overlay-close-button").addEventListener("click", () => {
  game.closeOverlay();
  refresh();
});

// A second click on the same inventory item within this window counts as a double-click. (The first
// click re-renders the overlay, so the browser's own dblclick event can't be relied on.)
const DOUBLE_CLICK_MS = 400;
let lastInventoryClick = null;

document.getElementById("overlay-content").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const payload = { ...button.dataset };
  if (payload.action === "inventory-select" && event.detail > 0) {
    const now = performance.now();
    const isDouble = lastInventoryClick?.index === payload.index && now - lastInventoryClick.time < DOUBLE_CLICK_MS;
    lastInventoryClick = isDouble ? null : { index: payload.index, time: now };
    if (isDouble) payload.action = "inventory-use";
  }
  // Remember which control was used so focus lands back on it after the overlay re-renders.
  renderer.pendingOverlayFocus = { ...button.dataset };
  if (payload.action === "save-score") {
    const input = document.getElementById("score-name-input");
    payload.playerName = input?.value ?? "";
  }
  game.handleOverlayAction(payload.action, payload);
  refresh();
});

document.body.addEventListener("mouseover", (event) => {
  const target = event.target.closest("[data-tooltip]");
  if (!target || !tooltip) return;
  const text = target.dataset.tooltip;
  if (!text) return;
  tooltip.textContent = text;
  tooltip.classList.remove("hidden");
});

// Keeps the tooltip beside the cursor but flips it to the other side near the window edges.
function positionTooltip(clientX, clientY) {
  const width = tooltip.offsetWidth || 260;
  const height = tooltip.offsetHeight || 100;
  const left = clientX + 14 + width > window.innerWidth ? clientX - 14 - width : clientX + 14;
  const top = clientY + 14 + height > window.innerHeight ? clientY - 14 - height : clientY + 14;
  tooltip.style.left = `${Math.max(4, left)}px`;
  tooltip.style.top = `${Math.max(4, top)}px`;
}

document.body.addEventListener("mousemove", (event) => {
  if (!tooltip || tooltip.classList.contains("hidden")) return;
  positionTooltip(event.clientX, event.clientY);
});

document.body.addEventListener("mouseout", (event) => {
  const target = event.target.closest("[data-tooltip]");
  if (!target || !tooltip) return;
  tooltip.classList.add("hidden");
});

// ── Map hover ──
// The tooltip describes the tile under the mouse.
const gameCanvas = document.getElementById("game-canvas");
let mapHoverPoint = null;
let mapHoverText = null;

function updateMapHover() {
  const inGame = game.state.mode === "in_game" && game.state.run && !game.state.ui.overlay;
  const tile = inGame && mapHoverPoint ? renderer.tileAtClientPoint(mapHoverPoint.x, mapHoverPoint.y) : null;
  renderer.hoverTile = tile;
  const text = tile ? game.describeTile(tile.x, tile.y) : null;
  if (text === mapHoverText) return;
  mapHoverText = text;
  if (!tooltip) return;
  if (text) {
    tooltip.textContent = text;
    tooltip.classList.remove("hidden");
    positionTooltip(mapHoverPoint.x, mapHoverPoint.y);
  } else {
    tooltip.classList.add("hidden");
  }
}

gameCanvas.addEventListener("mousemove", (event) => {
  mapHoverPoint = { x: event.clientX, y: event.clientY };
  updateMapHover();
});

gameCanvas.addEventListener("mouseleave", () => {
  mapHoverPoint = null;
  updateMapHover();
});

const ARROW_DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

function isShown(element) {
  return element.offsetParent !== null || element.getClientRects().length > 0;
}

// Moves focus to the nearest control in the arrow's direction (spatial navigation), so grids,
// lists and card rows all work without per-screen wiring.
function moveOverlayFocus(direction) {
  const content = document.getElementById("overlay-content");
  const candidates = [
    ...content.querySelectorAll("button:not([disabled]), input:not([disabled])"),
    document.getElementById("overlay-close-button"),
  ].filter((element) => element && !element.disabled && !element.classList.contains("hidden") && isShown(element));
  const active = document.activeElement;
  if (!candidates.includes(active)) {
    (content.querySelector(".inventory-tile.selected, .equip-slot.selected") ?? candidates[0])?.focus();
    return;
  }
  const from = active.getBoundingClientRect();
  const fromX = from.left + from.width / 2;
  const fromY = from.top + from.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    if (candidate === active) continue;
    const rect = candidate.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - fromX;
    const dy = rect.top + rect.height / 2 - fromY;
    const along = dx * direction.x + dy * direction.y;
    if (along <= 4) continue;
    const across = Math.abs(dx * direction.y) + Math.abs(dy * direction.x);
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  if (!best) return;
  best.focus();
  best.scrollIntoView({ block: "nearest", inline: "nearest" });
  // Moving across item tiles selects them so the detail pane follows the focus.
  if (["inventory-select", "inventory-select-equipped", "vendor-select"].includes(best.dataset.action)) best.click();
}

function handleOverlayKey(event) {
  const active = document.activeElement;
  if (event.key === "Escape") {
    game.closeOverlay();
    refresh();
    return;
  }
  if ((event.key === "o" || event.key === "O") && game.state.ui.overlay?.type === "settings") {
    game.closeOverlay();
    refresh();
    return;
  }
  // In the loadout, a number key puts the hovered (or focused) entry into that slot.
  if (game.state.ui.overlay?.type === "loadout" && /^[1-9]$/.test(event.key) && Number(event.key) <= QUICK_SLOT_COUNT) {
    const entry = document.querySelector("#overlay-content .loadout-entry:hover") ?? active?.closest?.(".loadout-entry");
    if (entry) {
      event.preventDefault();
      renderer.pendingOverlayFocus = { action: "assign-slot", slotIndex: String(Number(event.key) - 1), entryId: entry.dataset.entryId };
      game.assignQuickSlot(Number(event.key) - 1, entry.dataset.entryId);
      refresh();
    }
    return;
  }
  if (ARROW_DIRECTIONS[event.key]) {
    // Sliders and text fields keep their own arrow-key behaviour.
    if (active?.matches?.('input[type="range"], input[type="text"]') && (event.key === "ArrowLeft" || event.key === "ArrowRight")) return;
    event.preventDefault();
    moveOverlayFocus(ARROW_DIRECTIONS[event.key]);
    return;
  }
  if (event.key === "Enter") {
    if (active?.id === "score-name-input") {
      event.preventDefault();
      document.querySelector('#overlay-content button[data-action="save-score"]')?.click();
      return;
    }
    // Enter on the already-selected item runs its main action (Use, Equip, Buy).
    if (active?.matches?.(".inventory-tile.selected, .equip-slot.selected")) {
      const primary = document.querySelector("#overlay-content .detail-actions button.primary:not([disabled])");
      if (primary) {
        event.preventDefault();
        primary.click();
      }
    }
    // Otherwise Enter activates the focused button natively.
  }
}

window.addEventListener("keydown", (event) => {
  if (game.state.mode !== "in_game") return;
  if (game.state.ui.overlay) {
    handleOverlayKey(event);
    return;
  }

  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "enter"].includes(key)) {
    event.preventDefault();
  }
  if (key === "arrowup" || key === "w") game.movePlayer(0, -1);
  else if (key === "arrowdown" || key === "s") game.movePlayer(0, 1);
  else if (key === "arrowleft" || key === "a") game.movePlayer(-1, 0);
  else if (key === "arrowright" || key === "d") game.movePlayer(1, 0);
  else if (key === " ") {
    game.state.run.player.lastAction = "wait";
    game.log("You wait and listen.");
    game.endPlayerTurn();
  } else if (key === "enter") {
    game.interact();
  } else if (key === "i") {
    game.openInventory();
  } else if (key === "c") {
    game.openCharacter();
  } else if (key === "k") {
    game.openSkills();
  } else if (key === "f") {
    game.fireRangedWeapon();
  } else if (key === "m") {
    updateSetting("minimap", !settings.minimap);
  } else if (key === "o") {
    openSettingsOverlay();
  } else if (/^[1-9]$/.test(key) && Number(key) <= QUICK_SLOT_COUNT) {
    game.useQuickSlot(Number(key) - 1);
  }
  refresh();
});

// ── Mobile Touch Controls ──

if (mobileControls) {
  for (const btn of mobileControls.querySelectorAll(".dpad-btn")) {
    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (game.state.mode !== "in_game" || game.state.ui.overlay) return;
      const dir = btn.dataset.dir;
      if (dir === "up") game.movePlayer(0, -1);
      else if (dir === "down") game.movePlayer(0, 1);
      else if (dir === "left") game.movePlayer(-1, 0);
      else if (dir === "right") game.movePlayer(1, 0);
      else if (dir === "wait") {
        game.state.run.player.lastAction = "wait";
        game.log("You wait and listen.");
        game.endPlayerTurn();
      }
      refresh();
    }, { passive: false });
  }

  for (const btn of mobileControls.querySelectorAll(".action-btn")) {
    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (game.state.mode !== "in_game") return;
      const action = btn.dataset.action;
      if (action === "fire") {
        if (!game.state.ui.overlay) game.fireRangedWeapon();
      } else if (action === "interact") {
        if (!game.state.ui.overlay) game.interact();
      } else if (action === "close") {
        if (game.state.ui.overlay) game.closeOverlay();
      }
      refresh();
    }, { passive: false });
  }

  for (const btn of mobileControls.querySelectorAll(".mobile-menu-btn")) {
    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (game.state.mode !== "in_game") return;
      const action = btn.dataset.action;
      if (game.state.ui.overlay && action !== "close") {
        game.closeOverlay();
      }
      if (action === "inventory") game.openInventory();
      else if (action === "character") game.openCharacter();
      else if (action === "skills") game.openSkills();
      else if (action === "map") updateSetting("minimap", !settings.minimap);
      else if (action === "settings") openSettingsOverlay();
      refresh();
    }, { passive: false });
  }

  for (const btn of mobileControls.querySelectorAll(".mobile-qs")) {
    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (game.state.mode !== "in_game" || game.state.ui.overlay) return;
      game.useQuickSlot(Number(btn.dataset.slot));
      refresh();
    }, { passive: false });
  }

  document.getElementById("game-screen").addEventListener("touchmove", (e) => {
    if (e.target.closest(".overlay, .overlay-panel, .npc-dialog")) return;
    e.preventDefault();
  }, { passive: false });
}

loadAssets().then((assets) => {
  loadedAssets = assets;
  renderer.setAssets(assets);
  syncClassPortraits(0);
  renderClassStats();
  refresh();
  window.requestAnimationFrame(frame);
});

window.dungeon30Debug = {
  game,
  refresh,
  jumpToFloor,
};
