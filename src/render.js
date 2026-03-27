import { CLASSES, ENEMIES, ITEMS, SPELLS, STATUS_DEFINITIONS, TRAPS } from "./data.js";
import {
  getActorSprite,
  getActorSpriteFrame,
  getEntitySpriteId,
  getFloorSprite,
  getItemSprite,
  getPickupSpriteId,
  getTrapPickupSpriteId,
  getTrapSprite,
  getWallSprite,
} from "./assets.js";
import { clamp } from "./utils.js";

const COLORS = {
  wall: "#26303d",
  floor: "#13181f",
  explored: "#1b242d",
  player: "#d7a54d",
  enemy: "#d16464",
  elite: "#e28f43",
  boss: "#f0d37a",
  stairs: "#89d185",
  item: "#7cc1ff",
  vendor: "#d8b4fe",
  chest: "#b47b32",
  trap: "#cf5f5f",
  health: "#cf5f5f",
};

function drawText(ctx, text, x, y, color = "#f0ead6", size = 14) {
  ctx.fillStyle = color;
  ctx.font = `${size}px monospace`;
  ctx.fillText(text, x, y);
}

function formatStatuses(statuses = []) {
  if (!statuses.length) return "none";
  return statuses.map((status) => STATUS_DEFINITIONS[status.id]?.name ?? status.id).join(", ");
}

function getStatusColor(statusId) {
  switch (statusId) {
    case "chilled":
      return "#76c7ff";
    case "sundered":
      return "#f3a65a";
    case "weakened":
      return "#b48cff";
    case "hexed":
      return "#ef6fa8";
    case "arcane_shield":
      return "#79e1c9";
    default:
      return "#d7a54d";
  }
}

function renderStatusBadges(statuses = []) {
  if (!statuses.length) return `<span class="status-badge muted-badge">None</span>`;
  return statuses.map((status) => {
    const def = STATUS_DEFINITIONS[status.id];
    const tooltip = [def?.name ?? status.id, def?.description ?? "No description available.", status.turns ? `Turns remaining: ${status.turns}` : ""]
      .filter(Boolean)
      .join("&#10;");
    return `<span class="status-badge" style="--badge-color:${getStatusColor(status.id)}" data-tooltip="${tooltip}"><span class="status-icon">${def?.icon ?? "?"}</span>${def?.name ?? status.id}${status.turns ? ` ${status.turns}` : ""}</span>`;
  }).join("");
}

function formatEntryTooltip(entryId) {
  if (SPELLS[entryId]) {
    const spell = SPELLS[entryId];
    const parts = [spell.name, spell.description];
    if (typeof spell.cost === "number") parts.push(`Cost: ${spell.cost} mana`);
    if (typeof spell.range === "number") parts.push(`Range: ${spell.range === 0 ? "Self" : spell.range}`);
    if (spell.damage) parts.push(`Damage: ${spell.damage[0]}-${spell.damage[1]}`);
    return parts.join("\n");
  }

  if (ITEMS[entryId]) {
    const item = ITEMS[entryId];
    const parts = [item.name];
    if (item.effect?.type === "heal") parts.push(`Restores ${item.effect.value} HP`);
    else if (item.effect?.type === "mana") parts.push(`Restores ${item.effect.value} mana`);
    else if (item.effect?.type === "escape") parts.push("Teleports you to the floor's start room");
    else if (item.category === "tome" && item.spellId) parts.push(`Teaches ${SPELLS[item.spellId]?.name ?? item.spellId}`);
    else if (item.description) parts.push(item.description);
    return parts.join("\n");
  }

  return "";
}

function getProjectileAppearance(projectile) {
  switch (projectile.kind) {
    case "magic_missile":
      return { color: "#8bc6ff", trail: "#d6eeff", radius: 0.16 };
    case "frost_shard":
      return { color: "#8ff3ff", trail: "#d7fbff", radius: 0.18 };
    case "arcane_burst":
      return { color: "#c78cff", trail: "#f0d2ff", radius: 0.2 };
    case "shadow_bolt":
      return { color: "#8e7cff", trail: "#d4c8ff", radius: 0.16 };
    case "hexfire":
      return { color: "#ff7b9c", trail: "#ffd0da", radius: 0.18 };
    case "cinder_hex":
      return { color: "#ff9b54", trail: "#ffe1b8", radius: 0.17 };
    case "abyssal_bolt":
      return { color: "#ff5f86", trail: "#ffd1dc", radius: 0.2 };
    default:
      return { color: "#d7a54d", trail: "#fff1c2", radius: 0.16 };
  }
}

export class Renderer {
  constructor(game) {
    this.game = game;
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.logElement = document.getElementById("combat-log");
    this.overlay = document.getElementById("overlay");
    this.overlayTitle = document.getElementById("overlay-title");
    this.overlayContent = document.getElementById("overlay-content");
    this.transitionBanner = document.getElementById("transition-banner");
    this.criticalFlash = document.getElementById("critical-flash");
    this.assets = null;
    this.lastOverlaySignature = null;
    this.wasCriticalHp = false;
    this.projectiles = [];
  }

  setAssets(assets) {
    this.assets = assets;
  }

  render() {
    const { state } = this.game;
    if (state.mode !== "in_game") return;

    this.renderMap();
    this.renderHud();
    this.renderLog();
    this.renderOverlay();
  }

  renderMap() {
    const { ctx } = this;
    const { currentFloor, player } = this.game.state.run;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const animationFrame = Math.floor(performance.now() / 220);
    const tileSize = Math.floor(Math.min(this.canvas.width / currentFloor.width, this.canvas.height / currentFloor.height));
    const offsetX = Math.floor((this.canvas.width - currentFloor.width * tileSize) / 2);
    const offsetY = Math.floor((this.canvas.height - currentFloor.height * tileSize) / 2);

    for (let y = 0; y < currentFloor.height; y += 1) {
      for (let x = 0; x < currentFloor.width; x += 1) {
        const tile = currentFloor.map[y][x];
        const px = offsetX + x * tileSize;
        const py = offsetY + y * tileSize;

        if (!tile.explored && !tile.visible) {
          ctx.fillStyle = "#05070a";
          ctx.fillRect(px, py, tileSize, tileSize);
          continue;
        }

        const floorSprite = this.assets?.images[getFloorSprite(this.assets.manifest, x, y)];
        const wallSpritePath = this.assets
          ? getWallSprite(this.assets.manifest, currentFloor.map, x, y, { useExploredMask: !tile.visible })
          : null;
        const wallSprite = wallSpritePath ? this.assets?.images[wallSpritePath] : null;
        ctx.fillStyle = tile.type === "wall" ? (tile.visible ? COLORS.wall : "#1a2028") : tile.visible ? COLORS.floor : COLORS.explored;
        ctx.fillRect(px, py, tileSize, tileSize);
        if (tile.type === "floor" && floorSprite) {
          ctx.save();
          if (!tile.visible) {
            ctx.globalAlpha = 0.32;
          }
          ctx.drawImage(floorSprite, px, py, tileSize, tileSize);
          ctx.restore();
        } else if (tile.type === "wall" && wallSprite) {
          ctx.save();
          if (!tile.visible) {
            ctx.globalAlpha = 0.38;
          }
          ctx.drawImage(wallSprite, px, py, tileSize, tileSize);
          ctx.restore();
        }

        if (tile.visible) {
          const stairsSprite = this.assets?.images[this.assets.manifest.stairs];
          const shrineSprite = this.assets?.images[this.assets.manifest.shrine];
          const vendorSpritePath = this.assets ? getActorSpriteFrame(this.assets.manifest, "vendor", animationFrame) : null;
          const vendorSprite = vendorSpritePath ? this.assets?.images[vendorSpritePath] : null;
          const chestSprite = this.assets?.images[tile.chestId ? this.assets.manifest.chestClosed : ""];
          const pickupSpritePath = tile.itemIds.length ? getItemSprite(this.assets?.manifest, getPickupSpriteId(tile.itemIds)) : null;
          const pickupSprite = pickupSpritePath ? this.assets?.images[pickupSpritePath] : null;
          if (tile.stairs && stairsSprite) ctx.drawImage(stairsSprite, px, py, tileSize, tileSize);
          if (tile.shrineId && shrineSprite) this.drawSprite(shrineSprite, px, py, tileSize, tileSize, 1.2);
          if (tile.vendor && vendorSprite) this.drawSprite(vendorSprite, px, py, tileSize, tileSize, 1.6);
          if (tile.chestId && chestSprite) this.drawSprite(chestSprite, px, py, tileSize, tileSize, 1.2);
          if (tile.itemIds.length && pickupSprite) this.drawSprite(pickupSprite, px, py, tileSize, tileSize, 1.1);
        }

        const trap = this.game.getTrapAt(x, y);
        if (tile.visible && trap?.revealed) {
          const trapSpritePath = getTrapSprite(this.assets?.manifest, getTrapPickupSpriteId(trap));
          const trapSprite = trapSpritePath ? this.assets?.images[trapSpritePath] : null;
          if (trapSprite) this.drawSprite(trapSprite, px, py, tileSize, tileSize, 1.1);
          else drawText(ctx, TRAPS[trap.templateId].glyph, px + Math.floor(tileSize * 0.24), py + Math.floor(tileSize * 0.72), COLORS.trap, Math.max(11, tileSize - 5));
        }
      }
    }

    for (const enemy of currentFloor.enemies) {
      const tile = currentFloor.map[enemy.y][enemy.x];
      if (!tile.visible) continue;
      const spritePath = this.assets ? getActorSpriteFrame(this.assets.manifest, getEntitySpriteId(enemy), animationFrame) : null;
      const sprite = spritePath ? this.assets?.images[spritePath] : null;
      if (sprite) {
        this.drawSprite(sprite, offsetX + enemy.x * tileSize, offsetY + enemy.y * tileSize, tileSize, tileSize, enemy.templateId === "bone_captain" ? 2 : 1.45);
        this.drawStatusPips(offsetX + enemy.x * tileSize, offsetY + enemy.y * tileSize, tileSize, enemy.statuses);
      } else {
        const template = ENEMIES[enemy.templateId];
        drawText(
          ctx,
          template.glyph,
          offsetX + enemy.x * tileSize + Math.floor(tileSize * 0.28),
          offsetY + enemy.y * tileSize + Math.floor(tileSize * 0.72),
          enemy.templateId === "bone_captain" ? COLORS.boss : enemy.elite ? COLORS.elite : COLORS.enemy,
          Math.max(11, tileSize - 5)
        );
      }
    }

    const playerSpritePath = this.assets ? getActorSpriteFrame(this.assets.manifest, player.classId, animationFrame) : null;
    const playerSprite = playerSpritePath ? this.assets?.images[playerSpritePath] : null;
    if (playerSprite) {
      this.drawSprite(playerSprite, offsetX + player.x * tileSize, offsetY + player.y * tileSize, tileSize, tileSize, 1.75);
      this.drawStatusPips(offsetX + player.x * tileSize, offsetY + player.y * tileSize, tileSize, player.statuses);
    } else {
      drawText(
        ctx,
        "@",
        offsetX + player.x * tileSize + Math.floor(tileSize * 0.28),
        offsetY + player.y * tileSize + Math.floor(tileSize * 0.72),
        COLORS.player,
        Math.max(11, tileSize - 5)
      );
    }

    this.renderProjectiles(tileSize, offsetX, offsetY);
  }

  drawSprite(image, x, y, tileSize, baseTileSize, heightMultiplier = 1) {
    const width = tileSize;
    const height = Math.max(tileSize, Math.floor(tileSize * heightMultiplier));
    const offsetY = y + tileSize - height;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(image, x, offsetY, width, height);
  }

  drawStatusPips(x, y, tileSize, statuses = []) {
    if (!statuses?.length) return;
    const size = Math.max(4, Math.floor(tileSize * 0.18));
    statuses.slice(0, 3).forEach((status, index) => {
      this.ctx.fillStyle = getStatusColor(status.id);
      this.ctx.fillRect(x + index * (size + 2), y - size - 2, size, size);
      this.ctx.strokeStyle = "#0a0c10";
      this.ctx.strokeRect(x + index * (size + 2), y - size - 2, size, size);
    });
  }

  queueProjectile(projectile) {
    this.projectiles.push({
      ...projectile,
      createdAt: performance.now(),
      duration: projectile.duration ?? 320,
    });
  }

  renderProjectiles(tileSize, offsetX, offsetY) {
    if (!this.projectiles.length) return;
    const now = performance.now();
    this.projectiles = this.projectiles.filter((projectile) => now - projectile.createdAt < projectile.duration);

    for (const projectile of this.projectiles) {
      const progress = clamp((now - projectile.createdAt) / projectile.duration, 0, 1);
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - ((-2 * progress + 2) ** 2) / 2;
      const startX = offsetX + (projectile.from.x + 0.5) * tileSize;
      const startY = offsetY + (projectile.from.y + 0.5) * tileSize;
      const endX = offsetX + (projectile.to.x + 0.5) * tileSize;
      const endY = offsetY + (projectile.to.y + 0.5) * tileSize;
      const x = startX + (endX - startX) * eased;
      const y = startY + (endY - startY) * eased;
      const appearance = getProjectileAppearance(projectile);
      const radius = Math.max(4, tileSize * appearance.radius);

      this.ctx.save();
      this.ctx.globalAlpha = 0.3;
      this.ctx.strokeStyle = appearance.trail;
      this.ctx.lineWidth = Math.max(2, tileSize * 0.08);
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
      this.ctx.fillStyle = appearance.color;
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = appearance.trail;
      this.ctx.beginPath();
      this.ctx.arc(x, y, Math.max(2, radius * 0.45), 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  renderHud() {
    const { run } = this.game.state;
    const { player } = run;
    const derived = this.game.getDerivedStats(player);
    const animationFrame = Math.floor(performance.now() / 220);
    const xpNeeded = this.game.getXpForLevel(player.level + 1);
    const xpCurrent = player.level === 10 ? xpNeeded : player.xp;
    const xpProgress = player.level === 10 ? 1 : clamp(xpCurrent / xpNeeded, 0, 1);
    const hpRatio = derived.maxHp ? player.hp / derived.maxHp : 0;
    const isCriticalHp = hpRatio > 0 && hpRatio <= 0.2;

    document.getElementById("hud-class").textContent = CLASSES[player.classId].name;
    document.getElementById("hud-floor").textContent = `Floor ${run.floorNumber}`;
    document.getElementById("hud-level").textContent = `Level ${player.level}`;
    document.getElementById("hud-gold").textContent = `${player.gold}g`;
    document.getElementById("hud-hp-text").textContent = `${player.hp}/${derived.maxHp}`;
    document.getElementById("hud-mana-text").textContent = `${player.mana}/${derived.maxMana}`;
    document.getElementById("hud-xp-text").textContent = player.level === 10 ? "Max level" : `${player.xp}/${xpNeeded}`;

    const hpBar = document.getElementById("hud-hp-bar");
    const hpGroup = document.getElementById("hud-hp-group");
    hpBar.style.width = `${(player.hp / derived.maxHp) * 100}%`;
    document.getElementById("hud-mana-bar").style.width = `${(player.mana / derived.maxMana) * 100}%`;
    document.getElementById("hud-xp-bar").style.width = `${xpProgress * 100}%`;
    hpBar.classList.toggle("critical", isCriticalHp);
    hpGroup.classList.toggle("critical", isCriticalHp);
    if (isCriticalHp && !this.wasCriticalHp) {
      this.triggerCriticalFlash();
    }
    this.wasCriticalHp = isCriticalHp;

    document.getElementById("hud-weapon").textContent = `Weapon: ${player.equipment.weapon ? ITEMS[player.equipment.weapon].name : "None"}`;
    document.getElementById("hud-armor").textContent = `Armor: ${player.equipment.armor ? ITEMS[player.equipment.armor].name : "None"}`;
    document.getElementById("hud-accessory").textContent = `Accessory: ${player.equipment.accessory ? ITEMS[player.equipment.accessory].name : "None"}`;
    document.getElementById("hud-strength").textContent = `Strength: ${derived.strength}`;
    document.getElementById("hud-dexterity").textContent = `Dexterity: ${derived.dexterity}`;
    document.getElementById("hud-vitality").textContent = `Vitality: ${derived.vitality}`;
    document.getElementById("hud-intelligence").textContent = `Intelligence: ${derived.intelligence}`;
    document.getElementById("hud-defense").textContent = `Defense: ${derived.defense}`;
    const powerLine = document.getElementById("hud-power");
    powerLine.innerHTML = `Power: ${derived.meleeBonus}/${derived.spellBonus}<div class="status-badge-row">${renderStatusBadges(player.statuses)}</div>`;

    const quickButtons = [
      document.getElementById("quick-slot-1"),
      document.getElementById("quick-slot-2"),
      document.getElementById("quick-slot-3"),
    ];
    player.quickSlots.forEach((entry, index) => {
      const button = quickButtons[index];
      if (!entry) {
        button.textContent = `${index + 1}. Empty`;
        button.disabled = true;
        button.removeAttribute("data-tooltip");
        return;
      }
      const label = SPELLS[entry]?.name ?? ITEMS[entry]?.name ?? entry;
      const iconPath = ITEMS[entry] ? getItemSprite(this.assets?.manifest, entry) : null;
      const icon = iconPath ? `<img src="${iconPath}" alt="" class="slot-icon">` : "";
      button.innerHTML = `${icon}<span>${index + 1}. ${label}</span>`;
      button.disabled = false;
      button.dataset.tooltip = formatEntryTooltip(entry);
    });

    const target = this.game.getCurrentTarget();
    const panel = document.getElementById("target-panel");
    if (!target) {
      panel.innerHTML = "<p>No target</p>";
    } else {
      const spritePath = this.assets ? getActorSpriteFrame(this.assets.manifest, target.templateId, animationFrame) : null;
      const spriteMarkup = spritePath ? `<img src="${spritePath}" alt="${target.name}" class="target-sprite">` : "";
      const bossLabel = target.templateId === "abyssal_overlord"
        ? `Final Boss${target.phaseTwo ? " • Phase 2" : " • Phase 1"}`
        : target.templateId === "bone_captain"
          ? "Boss"
          : target.elite
            ? "Elite"
            : "Enemy";
      panel.innerHTML = `
        ${spriteMarkup}
        <p><strong>${target.name}</strong></p>
        <p>HP: ${target.hp}/${target.maxHp}</p>
        <p>${bossLabel}</p>
        <div class="status-badge-row">${renderStatusBadges(target.statuses)}</div>
      `;
    }
  }

  renderLog() {
    this.logElement.innerHTML = this.game.state.logs
      .slice(-12)
      .map((entry) => `<div>${entry}</div>`)
      .join("");
    this.logElement.scrollTop = this.logElement.scrollHeight;
  }

  renderOverlay() {
    const { overlay } = this.game.state.ui;
    if (!overlay) {
      this.overlay.classList.add("hidden");
      this.lastOverlaySignature = null;
      return;
    }

    this.overlay.classList.remove("hidden");
    const closeButton = document.getElementById("overlay-close-button");
    if (closeButton) {
      closeButton.disabled = overlay.dismissible === false;
      closeButton.classList.toggle("hidden", overlay.dismissible === false);
    }
    const signature = `${overlay.type ?? "overlay"}::${overlay.title}::${overlay.html}`;
    if (this.lastOverlaySignature !== signature) {
      this.overlayTitle.textContent = overlay.title;
      this.overlayContent.innerHTML = overlay.html;
      this.lastOverlaySignature = signature;
    }
  }

  showTransition(text) {
    this.transitionBanner.textContent = text;
    this.transitionBanner.classList.remove("hidden");
    window.setTimeout(() => this.transitionBanner.classList.add("hidden"), 1300);
  }

  triggerCriticalFlash() {
    if (!this.criticalFlash) return;
    this.criticalFlash.classList.remove("hidden");
    this.criticalFlash.classList.remove("active");
    void this.criticalFlash.offsetWidth;
    this.criticalFlash.classList.add("active");
    window.setTimeout(() => {
      this.criticalFlash?.classList.remove("active");
      this.criticalFlash?.classList.add("hidden");
    }, 380);
  }
}
