import { Game } from "./game.js";
import { Renderer } from "./render.js";
import { getActorSpriteFrame, loadAssets } from "./assets.js";

const game = new Game();
const renderer = new Renderer(game);
game.attachRenderer(renderer);

const screens = {
  menu: document.getElementById("menu-screen"),
  class: document.getElementById("class-screen"),
  game: document.getElementById("game-screen"),
};
const tooltip = document.getElementById("ui-tooltip");
let loadedAssets = null;

const classSpriteTargets = [
  { id: "class-sprite-warrior", actorId: "warrior" },
  { id: "class-sprite-wizard", actorId: "wizard" },
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
  else screens.game.classList.add("visible");
  renderer.render();
}

function refresh() {
  syncScreens();
  renderer.render();
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

document.getElementById("how-to-play-button").addEventListener("click", () => {
  document.getElementById("how-to-play").classList.toggle("hidden");
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
  game.handleOverlayAction(button.dataset.action, button.dataset);
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
  } else if (key === "1") {
    game.useQuickSlot(0);
  } else if (key === "2") {
    game.useQuickSlot(1);
  } else if (key === "3") {
    game.useQuickSlot(2);
  }
  refresh();
});

loadAssets().then((assets) => {
  loadedAssets = assets;
  renderer.setAssets(assets);
  syncClassPortraits(0);
  refresh();
  window.requestAnimationFrame(frame);
});
