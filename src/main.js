import { Game } from "./game.js";
import { Renderer } from "./render.js";
import { getActorSpriteFrame, loadAssets } from "./assets.js";
import { SPELLS, ITEMS, CLASSES, BOONS } from "./data.js";

const game = new Game();
const renderer = new Renderer(game);
game.attachRenderer(renderer);

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

function syncScreens() {
  Object.values(screens).forEach((screen) => screen.classList.remove("visible"));
  if (game.state.mode === "menu") screens.menu.classList.add("visible");
  else if (game.state.mode === "class") screens.class.classList.add("visible");
  else if (game.state.mode === "scores") screens.scores.classList.add("visible");
  else screens.game.classList.add("visible");
  renderer.render();
}

function syncMobileControls() {
  if (!mobileControls) return;
  const mobileHud = document.getElementById("mobile-hud");
  const inGame = game.state.mode === "in_game";

  mobileControls.classList.toggle("hidden", !inGame);
  mobileControls.classList.toggle("visible", inGame);
  if (mobileHud) {
    mobileHud.classList.toggle("hidden", !inGame);
    mobileHud.classList.toggle("visible", inGame);
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
    mobileLog.innerHTML = recent.map((entry) => `<div>${entry}</div>`).join("");
  }

  // Quick slot labels
  const slots = player.quickSlots;
  if (slots) {
    const qsBtns = mobileControls.querySelectorAll(".mobile-menu-qs");
    qsBtns.forEach((btn, i) => {
      const entry = slots[i];
      const label = entry ? (SPELLS[entry]?.name ?? ITEMS[entry]?.name ?? entry) : "Empty";
      btn.textContent = label;
    });
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
  renderer.render();
  window.requestAnimationFrame(frame);
}

document.getElementById("new-run-button").addEventListener("click", () => {
  game.setMode("class");
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

document.getElementById("quick-slot-1").addEventListener("click", () => { game.useQuickSlot(0); refresh(); });
document.getElementById("quick-slot-2").addEventListener("click", () => { game.useQuickSlot(1); refresh(); });
document.getElementById("quick-slot-3").addEventListener("click", () => { game.useQuickSlot(2); refresh(); });
document.getElementById("overlay-close-button").addEventListener("click", () => {
  game.closeOverlay();
  refresh();
});

document.getElementById("overlay-content").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const payload = { ...button.dataset };
  if (payload.action === "save-score") {
    const input = document.getElementById("score-name-input");
    payload.playerName = input?.value ?? "";
  }
  game.handleOverlayAction(button.dataset.action, payload);
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

document.body.addEventListener("mousemove", (event) => {
  if (!tooltip || tooltip.classList.contains("hidden")) return;
  tooltip.style.left = `${Math.min(window.innerWidth - 280, event.clientX + 14)}px`;
  tooltip.style.top = `${Math.min(window.innerHeight - 120, event.clientY + 14)}px`;
});

document.body.addEventListener("mouseout", (event) => {
  const target = event.target.closest("[data-tooltip]");
  if (!target || !tooltip) return;
  tooltip.classList.add("hidden");
});

window.addEventListener("keydown", (event) => {
  if (game.state.mode !== "in_game") return;
  if (game.state.ui.overlay) {
    if (event.key === "Escape") {
      game.closeOverlay();
      refresh();
    }
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
  } else if (key === "1") {
    game.useQuickSlot(0);
  } else if (key === "2") {
    game.useQuickSlot(1);
  } else if (key === "3") {
    game.useQuickSlot(2);
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
      else if (action === "quick1") game.useQuickSlot(0);
      else if (action === "quick2") game.useQuickSlot(1);
      else if (action === "quick3") game.useQuickSlot(2);
      refresh();
    }, { passive: false });
  }

  document.getElementById("game-screen").addEventListener("touchmove", (e) => {
    e.preventDefault();
  }, { passive: false });
}

loadAssets().then((assets) => {
  loadedAssets = assets;
  renderer.setAssets(assets);
  syncClassPortraits(0);
  refresh();
  window.requestAnimationFrame(frame);
});

window.dungeon30Debug = {
  game,
  refresh,
  jumpToFloor,
};
