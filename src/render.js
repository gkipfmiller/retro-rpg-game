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

const FLOOR_THEMES = {
  sage: {
    floorVisible: "#1c1824",
    floorFog: "#17131d",
    wallVisible: "#2d3144",
    wallFog: "#1d2230",
    floorOverlayVisible: "rgba(128, 106, 168, 0.16)",
    floorOverlayFog: "rgba(88, 72, 120, 0.14)",
    wallOverlayVisible: "rgba(124, 132, 196, 0.12)",
    wallOverlayFog: "rgba(86, 92, 136, 0.12)",
  },
  crypt: {
    floorVisible: "#141a20",
    floorFog: "#11161b",
    wallVisible: "#27303b",
    wallFog: "#1a2129",
    floorOverlayVisible: "rgba(82, 102, 126, 0.1)",
    floorOverlayFog: "rgba(58, 74, 94, 0.12)",
    wallOverlayVisible: "rgba(112, 130, 150, 0.08)",
    wallOverlayFog: "rgba(74, 88, 106, 0.1)",
  },
  ember_halls: {
    floorVisible: "#1d1615",
    floorFog: "#181112",
    wallVisible: "#352421",
    wallFog: "#251917",
    floorOverlayVisible: "rgba(184, 96, 62, 0.14)",
    floorOverlayFog: "rgba(120, 66, 46, 0.14)",
    wallOverlayVisible: "rgba(154, 90, 58, 0.12)",
    wallOverlayFog: "rgba(98, 56, 38, 0.12)",
  },
  fungal_depths: {
    floorVisible: "#141d17",
    floorFog: "#101812",
    wallVisible: "#223026",
    wallFog: "#17211a",
    floorOverlayVisible: "rgba(86, 154, 90, 0.14)",
    floorOverlayFog: "rgba(58, 108, 62, 0.14)",
    wallOverlayVisible: "rgba(94, 142, 102, 0.12)",
    wallOverlayFog: "rgba(60, 96, 68, 0.12)",
  },
  sunken_vault: {
    floorVisible: "#141a1f",
    floorFog: "#10151a",
    wallVisible: "#20313a",
    wallFog: "#18242c",
    floorOverlayVisible: "rgba(58, 116, 128, 0.08)",
    floorOverlayFog: "rgba(42, 82, 92, 0.1)",
    wallOverlayVisible: "rgba(82, 132, 146, 0.06)",
    wallOverlayFog: "rgba(52, 84, 96, 0.08)",
  },
  necropolis: {
    floorVisible: "#1f151d",
    floorFog: "#171018",
    wallVisible: "#342433",
    wallFog: "#241a24",
    floorOverlayVisible: "rgba(158, 74, 118, 0.14)",
    floorOverlayFog: "rgba(102, 50, 78, 0.14)",
    wallOverlayVisible: "rgba(130, 86, 126, 0.1)",
    wallOverlayFog: "rgba(84, 58, 82, 0.12)",
  },
  stitchworks: {
    floorVisible: "#231c15",
    floorFog: "#19140f",
    wallVisible: "#3b2d24",
    wallFog: "#2a2018",
    floorOverlayVisible: "rgba(168, 122, 66, 0.15)",
    floorOverlayFog: "rgba(112, 80, 42, 0.14)",
    wallOverlayVisible: "rgba(142, 106, 68, 0.12)",
    wallOverlayFog: "rgba(90, 68, 44, 0.12)",
  },
  void_deep: {
    floorVisible: "#12131e",
    floorFog: "#0d0e16",
    wallVisible: "#242540",
    wallFog: "#17192a",
    floorOverlayVisible: "rgba(92, 78, 172, 0.16)",
    floorOverlayFog: "rgba(64, 54, 118, 0.16)",
    wallOverlayVisible: "rgba(88, 84, 170, 0.12)",
    wallOverlayFog: "rgba(58, 58, 110, 0.12)",
  },
  abyssal_throne: {
    floorVisible: "#17111d",
    floorFog: "#110d15",
    wallVisible: "#2a1d36",
    wallFog: "#1c1524",
    floorOverlayVisible: "rgba(146, 68, 118, 0.16)",
    floorOverlayFog: "rgba(96, 46, 78, 0.16)",
    wallOverlayVisible: "rgba(118, 72, 142, 0.12)",
    wallOverlayFog: "rgba(76, 46, 92, 0.12)",
  },
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
    case "poisoned":
      return "#7fd36b";
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

function getTrapColor(trapId) {
  switch (trapId) {
    case "spikes":
      return "#b8c6d8";
    case "darts":
      return "#d7a54d";
    case "fire":
      return "#ff7a47";
    case "curse":
      return "#b48cff";
    case "alarm":
      return "#f0d37a";
    default:
      return "#cf5f5f";
  }
}

function hashPoint(x, y, seed = 0) {
  return Math.abs(((x + 11) * 92821) ^ ((y + 17) * 68917) ^ seed) >>> 0;
}

function getThemeFloorAtlasCoord(theme, x, y) {
  if (theme !== "sunken_vault") return null;
  const sewerFloorTiles = [
    [0, 2],
    [1, 2],
    [2, 2],
    [3, 2],
  ];
  return sewerFloorTiles[(x * 5 + y * 7) % sewerFloorTiles.length];
}

function getThemeWallAtlasCoord(theme, map, x, y, options = {}) {
  if (theme !== "sunken_vault") return null;
  const { useExploredMask = false } = options;
  const getTile = (tx, ty) => map[ty]?.[tx] ?? null;
  const isVisibleWall = (tx, ty) => {
    const tile = getTile(tx, ty);
    if (!tile || tile.type !== "wall") return false;
    if (!useExploredMask) return true;
    return tile.explored || tile.visible;
  };
  const isFloor = (tx, ty) => {
    const tile = getTile(tx, ty);
    if (!tile || tile.type !== "floor") return false;
    if (!useExploredMask) return true;
    return tile.explored || tile.visible;
  };

  const northWall = isVisibleWall(x, y - 1);
  const southWall = isVisibleWall(x, y + 1);
  const westWall = isVisibleWall(x - 1, y);
  const eastWall = isVisibleWall(x + 1, y);
  const northFloor = isFloor(x, y - 1);
  const southFloor = isFloor(x, y + 1);
  const westFloor = isFloor(x - 1, y);
  const eastFloor = isFloor(x + 1, y);

  if (southFloor) {
    if (westFloor && !eastFloor) return eastWall ? [1, 2] : [11, 0];
    if (eastFloor && !westFloor) return westWall ? [3, 2] : [1, 0];
    if (!westWall && eastWall) return southWall ? [5, 0] : [1, 0];
    if (!eastWall && westWall) return southWall ? [6, 0] : [11, 0];
    return [2, 2];
  }

  if (northFloor) {
    if (westFloor && !eastFloor) {
      return eastWall ? (southWall ? [6, 3] : [1, 3]) : (southWall ? [7, 3] : [11, 3]);
    }
    if (eastFloor && !westFloor) {
      return westWall ? (southWall ? [5, 3] : [3, 3]) : (southWall ? [4, 3] : [1, 3]);
    }
    if (!westWall && eastWall) return southWall ? [5, 3] : [1, 3];
    if (!eastWall && westWall) return southWall ? [6, 3] : [11, 3];
    return [2, 3];
  }

  if (westFloor && eastFloor) {
    if (!northWall && southWall) return [8, 0];
    if (northWall && southWall) return [8, 1];
    if (northWall && !southWall) return [8, 2];
    return [8, 1];
  }

  if (eastFloor && !westFloor) {
    return southWall ? (northWall ? [8, 1] : [5, 0]) : [1, 0];
  }
  if (westFloor && !eastFloor) {
    return southWall ? (northWall ? [8, 1] : [6, 0]) : [11, 0];
  }

  const seFloor = isFloor(x + 1, y + 1);
  const swFloor = isFloor(x - 1, y + 1);
  const neFloor = isFloor(x + 1, y - 1);
  const nwFloor = isFloor(x - 1, y - 1);
  const diagCount = (seFloor ? 1 : 0) + (swFloor ? 1 : 0) + (neFloor ? 1 : 0) + (nwFloor ? 1 : 0);

  if (diagCount === 1) {
    if (seFloor) return [9, 0];
    if (swFloor) return [10, 0];
    if (neFloor) return [6, 1];
    if (nwFloor) return [5, 1];
  }
  if (diagCount > 1) return [2, 0];
  return null;
}

function getSewerDecorAtlasCoord(kind, x, y) {
  const variants = {
    drain: [[0, 4], [1, 4], [2, 4]],
    puddle: [[3, 4], [4, 4], [5, 4]],
    rubble: [[6, 4], [7, 4], [8, 4]],
  };
  const pool = variants[kind];
  if (!pool?.length) return null;
  return pool[(x * 5 + y * 3) % pool.length];
}

function getWallPropPath(manifest, theme, map, x, y) {
  const tile = map[y]?.[x];
  const below = map[y + 1]?.[x];
  if (!tile || tile.type !== "wall" || !below || below.type !== "floor") return null;
  const roll = hashPoint(x, y, theme.length) % 100;
  switch (theme) {
    case "crypt":
      return null;
    case "ember_halls":
      return null;
    case "fungal_depths":
      if (roll < 8) return manifest.props.wallGoo;
      return null;
    case "sunken_vault":
      return null;
    case "necropolis":
      if (roll < 6) return manifest.props.columnWall;
      return null;
    case "stitchworks":
      if (roll < 6) return manifest.props.shrineRedMid;
      return null;
    case "void_deep":
      return null;
    default:
      return null;
  }
}

function getFloorPropPath(manifest, theme, map, x, y, options = {}) {
  const { floorNumber = 0, inBossRoom = false } = options;
  const tile = map[y]?.[x];
  if (!tile || tile.type !== "floor" || tile.stairs || tile.vendor || tile.shrineId || tile.chestId || tile.itemIds?.length || tile.occupant) {
    return null;
  }
  const roll = hashPoint(x, y, theme.length + floorNumber * 13) % 100;
  if (theme === "sunken_vault") {
    return null;
  }
  if (floorNumber === 20 && inBossRoom) {
    return null;
  }
  if (theme === "fungal_depths") {
    if (tile.hole) return manifest.props.floorHole;
    if (roll < 4) return manifest.props.floorGoo;
  }
  return null;
}

function getFloorDecorSpec(manifest, currentFloor, x, y, options = {}) {
  const { floorNumber = 0, inBossRoom = false, roomType = "normal" } = options;
  const tile = currentFloor.map[y]?.[x];
  if (!tile || tile.type !== "floor" || tile.stairs || tile.vendor || tile.shrineId || tile.chestId || tile.itemIds?.length || tile.occupant) {
    return null;
  }
  const roll = hashPoint(x, y, floorNumber * 31 + roomType.length) % 100;
  if (currentFloor.theme === "sunken_vault") {
    if (roomType === "trap" && roll < 12) return { atlas: manifest.themeAtlases.sunkenVaultFloor, coord: getSewerDecorAtlasCoord("puddle", x, y) };
  }
  if (floorNumber === 20 && inBossRoom) {
    if (roll < 8) return { atlas: manifest.themeAtlases.sunkenVaultFloor, coord: getSewerDecorAtlasCoord("puddle", x, y) };
  }
  return null;
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

function renderOptionalStatusBadges(statuses = []) {
  if (!statuses.length) return "";
  return `<div class="status-badge-row">${renderStatusBadges(statuses)}</div>`;
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

function escapeTooltip(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "&#10;");
}

function getProjectileAppearance(projectile) {
  switch (projectile.kind) {
    case "magic_missile":
      return { color: "#8bc6ff", trail: "#d6eeff", radius: 0.16 };
    case "frost_shard":
      return { color: "#8ff3ff", trail: "#d7fbff", radius: 0.18 };
    case "chain_bolt":
      return { color: "#ffd86a", trail: "#fff2b6", radius: 0.17 };
    case "ice_shatter":
      return { color: "#b9ecff", trail: "#eefcff", radius: 0.18 };
    case "frailty_hex":
      return { color: "#c58cff", trail: "#edd6ff", radius: 0.18 };
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
    this.npcDialog = document.getElementById("npc-dialog");
    this.npcDialogSpeaker = document.getElementById("npc-dialog-speaker");
    this.npcDialogText = document.getElementById("npc-dialog-text");
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
    this.renderNpcDialog();
  }

  renderMap() {
    const { ctx } = this;
    const { currentFloor, player, floorNumber } = this.game.state.run;
    const floorTheme = FLOOR_THEMES[currentFloor.theme] ?? FLOOR_THEMES.crypt;
    const bossRoom = currentFloor.rooms?.find((room) => room.type === "boss") ?? null;
    const inBossRoom = (x, y) => bossRoom
      && x >= bossRoom.x
      && x < bossRoom.x + bossRoom.width
      && y >= bossRoom.y
      && y < bossRoom.y + bossRoom.height;
    const getRoomTypeAt = (x, y) => currentFloor.rooms?.find((room) =>
      x >= room.x
      && x < room.x + room.width
      && y >= room.y
      && y < room.y + room.height
    )?.type ?? "normal";
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

        const floorAtlasCoord = getThemeFloorAtlasCoord(currentFloor.theme, x, y);
        const floorAtlas = floorAtlasCoord ? this.assets?.images[this.assets.manifest.themeAtlases.sunkenVaultFloor] : null;
        const floorSprite = floorAtlas ? null : this.assets?.images[getFloorSprite(this.assets.manifest, x, y)];
        const wallAtlasCoord = getThemeWallAtlasCoord(currentFloor.theme, currentFloor.map, x, y);
        const wallAtlas = wallAtlasCoord ? this.assets?.images[this.assets.manifest.themeAtlases.sunkenVaultWalls] : null;
        const wallSpritePath = this.assets
          ? getWallSprite(this.assets.manifest, currentFloor.map, x, y)
          : null;
        const useThemeWalls = currentFloor.theme === "sunken_vault";
        const wallSprite = wallAtlas ? null : (!useThemeWalls && wallSpritePath) ? this.assets?.images[wallSpritePath] : null;
        const plainTopWallSprites = this.assets
          ? new Set([
            this.assets.manifest.walls.top,
            this.assets.manifest.walls.topLeft,
            this.assets.manifest.walls.topRight,
            this.assets.manifest.walls.edgeTopLeft,
            this.assets.manifest.walls.edgeTopRight,
          ])
          : null;
        const skipWallBackdrop = tile.type === "wall" && !wallAtlas && wallSpritePath && plainTopWallSprites?.has(wallSpritePath);
        const wallPropPath = this.assets ? getWallPropPath(this.assets.manifest, currentFloor.theme, currentFloor.map, x, y) : null;
        const wallProp = wallPropPath ? this.assets?.images[wallPropPath] : null;
        const roomType = getRoomTypeAt(x, y);
        const floorPropPath = this.assets
          ? getFloorPropPath(this.assets.manifest, currentFloor.theme, currentFloor.map, x, y, { floorNumber, inBossRoom: inBossRoom(x, y) })
          : null;
        const floorProp = floorPropPath ? this.assets?.images[floorPropPath] : null;
        const floorDecorSpec = this.assets
          ? getFloorDecorSpec(this.assets.manifest, currentFloor, x, y, { floorNumber, inBossRoom: inBossRoom(x, y), roomType })
          : null;
        const floorDecorAtlas = floorDecorSpec?.atlas ? this.assets?.images[floorDecorSpec.atlas] : null;
        if (!skipWallBackdrop) {
          ctx.fillStyle = tile.type === "wall"
            ? (tile.visible ? floorTheme.wallVisible : floorTheme.wallFog)
            : (tile.visible ? floorTheme.floorVisible : floorTheme.floorFog);
          ctx.fillRect(px, py, tileSize, tileSize);
        }
        if (tile.type === "floor" && floorAtlas && floorAtlasCoord) {
          ctx.save();
          if (!tile.visible) {
            ctx.globalAlpha = 0.32;
          }
          this.drawAtlasTile(floorAtlas, floorAtlasCoord, px, py, tileSize);
          ctx.restore();
          ctx.save();
          ctx.fillStyle = tile.visible ? floorTheme.floorOverlayVisible : floorTheme.floorOverlayFog;
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.restore();
        } else if (tile.type === "floor" && floorSprite) {
          ctx.save();
          if (!tile.visible) {
            ctx.globalAlpha = 0.32;
          }
          ctx.drawImage(floorSprite, px, py, tileSize, tileSize);
          ctx.restore();
          ctx.save();
          ctx.fillStyle = tile.visible ? floorTheme.floorOverlayVisible : floorTheme.floorOverlayFog;
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.restore();
        } else if (tile.type === "wall" && wallAtlas && wallAtlasCoord) {
          ctx.save();
          if (!tile.visible) {
            ctx.globalAlpha = 0.38;
          }
          this.drawAtlasTile(wallAtlas, wallAtlasCoord, px, py, tileSize);
          ctx.restore();
          ctx.save();
          ctx.fillStyle = tile.visible ? floorTheme.wallOverlayVisible : floorTheme.wallOverlayFog;
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.restore();
        } else if (tile.type === "wall" && wallSprite) {
          ctx.save();
          if (!tile.visible) {
            ctx.globalAlpha = 0.38;
          }
          ctx.drawImage(wallSprite, px, py, tileSize, tileSize);
          ctx.restore();
          ctx.save();
          ctx.fillStyle = tile.visible ? floorTheme.wallOverlayVisible : floorTheme.wallOverlayFog;
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.restore();
          if (tile.visible && wallProp) {
            this.drawSprite(wallProp, px, py, tileSize, tileSize, 1.15);
          }
        }

        if ((floorNumber === 10 || floorNumber === 20) && tile.type === "floor" && inBossRoom(x, y)) {
          ctx.save();
          ctx.fillStyle = floorNumber === 10
            ? (tile.visible ? "rgba(88, 24, 36, 0.26)" : "rgba(52, 16, 24, 0.18)")
            : (tile.visible ? "rgba(52, 76, 64, 0.22)" : "rgba(24, 40, 32, 0.16)");
          ctx.fillRect(px, py, tileSize, tileSize);
          ctx.restore();
          if (tile.visible && tile.graveCircle) {
            const cx = px + tileSize / 2;
            const cy = py + tileSize / 2;
            const radius = tileSize * 0.26;
            ctx.save();
            ctx.strokeStyle = "rgba(210, 110, 140, 0.92)";
            ctx.lineWidth = Math.max(1, Math.floor(tileSize * 0.06));
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, cy, radius * 0.42, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = "rgba(245, 196, 124, 0.95)";
            ctx.fillRect(Math.floor(cx - tileSize * 0.05), Math.floor(cy - tileSize * 0.05), Math.max(2, Math.floor(tileSize * 0.1)), Math.max(2, Math.floor(tileSize * 0.1)));
            ctx.restore();
          }
          if (tile.visible && tile.patchMarker) {
            const cx = px + tileSize / 2;
            const cy = py + tileSize / 2;
            ctx.save();
            ctx.strokeStyle = "rgba(146, 182, 132, 0.92)";
            ctx.lineWidth = Math.max(1, Math.floor(tileSize * 0.06));
            ctx.strokeRect(
              Math.floor(cx - tileSize * 0.18),
              Math.floor(cy - tileSize * 0.18),
              Math.floor(tileSize * 0.36),
              Math.floor(tileSize * 0.36)
            );
            ctx.strokeStyle = "rgba(198, 222, 154, 0.92)";
            ctx.beginPath();
            ctx.moveTo(cx - tileSize * 0.16, cy - tileSize * 0.16);
            ctx.lineTo(cx + tileSize * 0.16, cy + tileSize * 0.16);
            ctx.moveTo(cx + tileSize * 0.16, cy - tileSize * 0.16);
            ctx.lineTo(cx - tileSize * 0.16, cy + tileSize * 0.16);
            ctx.stroke();
            ctx.restore();
          }
        }

        if (tile.visible && floorProp) {
          const scale = floorPropPath === this.assets.manifest.props.floorColumn ? 1.1 : 1;
          this.drawSprite(floorProp, px, py, tileSize, tileSize, scale);
        }

        if (tile.visible && floorDecorAtlas && floorDecorSpec?.coord) {
          this.drawAtlasTile(floorDecorAtlas, floorDecorSpec.coord, px, py, tileSize);
        }

        if (tile.visible) {
          const stairsSprite = this.assets?.images[currentFloor.theme === "sunken_vault" ? this.assets.manifest.ladder : this.assets.manifest.stairs];
          const vendorSpritePath = this.assets ? getActorSpriteFrame(this.assets.manifest, "vendor", animationFrame) : null;
          const vendorSprite = vendorSpritePath ? this.assets?.images[vendorSpritePath] : null;
          const sage = currentFloor.sage;
          const sageSpritePath = (sage && !sage.vanished && sage.x === x && sage.y === y && this.assets)
            ? getActorSpriteFrame(this.assets.manifest, sage.actorId ?? "sage", animationFrame)
            : null;
          const sageSprite = sageSpritePath ? this.assets?.images[sageSpritePath] : null;
          const chestSprite = this.assets?.images[tile.chestId ? this.assets.manifest.chestClosed : ""];
          const pickupSpritePath = tile.itemIds.length ? getItemSprite(this.assets?.manifest, getPickupSpriteId(tile.itemIds)) : null;
          const pickupSprite = pickupSpritePath ? this.assets?.images[pickupSpritePath] : null;
          if (tile.stairs) {
            ctx.save();
            ctx.fillStyle = currentFloor.theme === "sunken_vault"
              ? "rgba(74, 124, 102, 0.22)"
              : floorNumber === 20
                ? "rgba(88, 122, 96, 0.2)"
                : "rgba(137, 209, 133, 0.16)";
            ctx.fillRect(
              px + Math.floor(tileSize * 0.12),
              py + Math.floor(tileSize * 0.12),
              Math.floor(tileSize * 0.76),
              Math.floor(tileSize * 0.76)
            );
            ctx.restore();
          }
          if (tile.stairs && stairsSprite) ctx.drawImage(stairsSprite, px, py, tileSize, tileSize);
          if (tile.shrineId) this.drawShrineStructure(currentFloor.theme, tile, px, py, tileSize);
          if (tile.vendor && vendorSprite) this.drawSprite(vendorSprite, px, py, tileSize, tileSize, 1.6);
          if (sageSprite) this.drawSprite(sageSprite, px, py, tileSize, tileSize, 1.7);
          if (tile.chestId && (currentFloor.theme === "sunken_vault" || floorNumber === 20)) {
            ctx.save();
            ctx.fillStyle = currentFloor.theme === "sunken_vault"
              ? "rgba(58, 108, 98, 0.22)"
              : "rgba(82, 118, 88, 0.2)";
            ctx.beginPath();
            ctx.arc(px + tileSize / 2, py + tileSize * 0.72, tileSize * 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          if (tile.chestId && chestSprite) this.drawSprite(chestSprite, px, py, tileSize, tileSize, 1.2);
          if (tile.itemIds.length && pickupSprite) this.drawSprite(pickupSprite, px, py, tileSize, tileSize, 1.1);
        }

        const trap = this.game.getTrapAt(x, y);
        if (tile.visible && trap?.revealed) {
          const trapSpritePath = getTrapSprite(this.assets?.manifest, getTrapPickupSpriteId(trap));
          const trapSprite = trapSpritePath ? this.assets?.images[trapSpritePath] : null;
          ctx.save();
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = getTrapColor(trap.templateId);
          ctx.fillRect(px + Math.floor(tileSize * 0.12), py + Math.floor(tileSize * 0.12), Math.floor(tileSize * 0.76), Math.floor(tileSize * 0.76));
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = getTrapColor(trap.templateId);
          ctx.lineWidth = Math.max(1, Math.floor(tileSize * 0.06));
          ctx.strokeRect(px + Math.floor(tileSize * 0.14), py + Math.floor(tileSize * 0.14), Math.floor(tileSize * 0.72), Math.floor(tileSize * 0.72));
          ctx.restore();
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
        const isBoss = ENEMIES[enemy.templateId]?.behavior === "boss";
        const scale = enemy.templateId === "abyssal_overlord" ? 1.45 : isBoss ? 1.55 : 1.45;
        this.drawSprite(sprite, offsetX + enemy.x * tileSize, offsetY + enemy.y * tileSize, tileSize, tileSize, scale);
        this.drawStatusPips(offsetX + enemy.x * tileSize, offsetY + enemy.y * tileSize, tileSize, enemy.statuses);
      } else {
        const template = ENEMIES[enemy.templateId];
        drawText(
          ctx,
          template.glyph,
          offsetX + enemy.x * tileSize + Math.floor(tileSize * 0.28),
          offsetY + enemy.y * tileSize + Math.floor(tileSize * 0.72),
          template.behavior === "boss" ? COLORS.boss : enemy.elite ? COLORS.elite : COLORS.enemy,
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

  drawAtlasTile(image, coord, x, y, tileSize, sourceTileSize = 16) {
    if (!image || !coord) return;
    const [tileX, tileY] = coord;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(
      image,
      tileX * sourceTileSize,
      tileY * sourceTileSize,
      sourceTileSize,
      sourceTileSize,
      x,
      y,
      tileSize,
      tileSize
    );
  }

  drawShrineStructure(theme, tile, x, y, tileSize) {
    const useRed = theme === "ember_halls" || theme === "stitchworks" || theme === "necropolis";
    const top = this.assets?.images[useRed ? this.assets.manifest.props.shrineRedTop : this.assets.manifest.props.shrineBlueTop];
    const mid = this.assets?.images[useRed ? this.assets.manifest.props.shrineRedMid : this.assets.manifest.props.shrineBlueMid];
    const basin = this.assets?.images[useRed ? this.assets.manifest.props.shrineRedBasin : this.assets.manifest.props.shrineBlueBasin];
    this.ctx.save();
    this.ctx.fillStyle = useRed ? "rgba(184, 88, 68, 0.22)" : "rgba(88, 154, 196, 0.2)";
    this.ctx.beginPath();
    this.ctx.arc(x + tileSize / 2, y + tileSize * 0.68, tileSize * 0.32, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
    if (basin) this.drawSprite(basin, x, y, tileSize, tileSize, 1.2);
    if (mid) this.drawSprite(mid, x, y - Math.floor(tileSize * 0.35), tileSize, tileSize, 1.25);
    if (top) this.drawSprite(top, x, y - tileSize, tileSize, tileSize, 1.2);
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
    document.getElementById("hud-floor").textContent = run.floorNumber === 0 ? "Prelude" : `Floor ${run.floorNumber}`;
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

    const weaponLine = document.getElementById("hud-weapon");
    const armorLine = document.getElementById("hud-armor");
    const handsLine = document.getElementById("hud-hands");
    const accessoryLine = document.getElementById("hud-accessory");
    const boonLine = document.getElementById("hud-boon");
    const strengthLine = document.getElementById("hud-strength");
    const dexterityLine = document.getElementById("hud-dexterity");
    const vitalityLine = document.getElementById("hud-vitality");
    const intelligenceLine = document.getElementById("hud-intelligence");
    const defenseLine = document.getElementById("hud-defense");

    const equippedWeapon = player.equipment.weapon ? ITEMS[player.equipment.weapon] : null;
    const equippedArmor = player.equipment.armor ? ITEMS[player.equipment.armor] : null;
    const equippedHands = player.equipment.hands ? ITEMS[player.equipment.hands] : null;
    const equippedAccessory = player.equipment.accessory ? ITEMS[player.equipment.accessory] : null;
    const boon = this.game.getBoonDefinition(player.boonId);
    const applyEquipmentRarity = (element, item) => {
      element.classList.remove("rarity-common", "rarity-uncommon", "rarity-rare", "rarity-boss");
      if (item) {
        element.classList.add(`rarity-${this.game.getItemRarity(item.id)}`);
      }
    };

    weaponLine.textContent = `Weapon: ${equippedWeapon ? equippedWeapon.name : "None"}`;
    armorLine.textContent = `Armor: ${equippedArmor ? equippedArmor.name : "None"}`;
    handsLine.textContent = `Hands: ${equippedHands ? equippedHands.name : "None"}`;
    accessoryLine.textContent = `Accessory: ${equippedAccessory ? equippedAccessory.name : "None"}`;
    boonLine.textContent = boon ? boon.name : "None";
    applyEquipmentRarity(weaponLine, equippedWeapon);
    applyEquipmentRarity(armorLine, equippedArmor);
    applyEquipmentRarity(handsLine, equippedHands);
    applyEquipmentRarity(accessoryLine, equippedAccessory);
    strengthLine.textContent = `Strength: ${derived.strength}`;
    dexterityLine.textContent = `Dexterity: ${derived.dexterity}`;
    vitalityLine.textContent = `Vitality: ${derived.vitality}`;
    intelligenceLine.textContent = `Intelligence: ${derived.intelligence}`;
    defenseLine.textContent = `Defense: ${derived.defense}`;

    weaponLine.dataset.tooltip = (
      equippedWeapon
        ? `${equippedWeapon.name}\nMain weapon. Improves melee or spell output depending on the item.\n${formatEntryTooltip(equippedWeapon.id)}`
        : "Weapon slot\nNo weapon equipped."
    );
    armorLine.dataset.tooltip = (
      equippedArmor
        ? `${equippedArmor.name}\nArmor reduces incoming damage and may grant bonus stats.\n${formatEntryTooltip(equippedArmor.id)}`
        : "Armor slot\nNo armor equipped."
    );
    handsLine.dataset.tooltip = (
      equippedHands
        ? `${equippedHands.name}\nHands slot for gloves, wraps, and gauntlets with tactical status effects or wards.\n${formatEntryTooltip(equippedHands.id)}`
        : "Hands slot\nNo hands item equipped."
    );
    accessoryLine.dataset.tooltip = (
      equippedAccessory
        ? `${equippedAccessory.name}\nAccessory slot for passive stat bonuses.\n${formatEntryTooltip(equippedAccessory.id)}`
        : "Accessory slot\nNo accessory equipped."
    );
    boonLine.dataset.tooltip = boon
      ? `${boon.name}\n${boon.description}\n${boon.summary}`
      : "Boon\nNo boon chosen yet.";
    strengthLine.dataset.tooltip = "Strength\nImproves melee damage.";
    dexterityLine.dataset.tooltip = "Dexterity\nImproves accuracy and helps with evasion.";
    vitalityLine.dataset.tooltip = "Vitality\nRaises maximum HP.";
    intelligenceLine.dataset.tooltip = "Intelligence\nImproves spell damage and maximum mana.";
    defenseLine.dataset.tooltip = "Defense\nReduces incoming damage from enemy attacks.";
    const powerLine = document.getElementById("hud-power");
    powerLine.innerHTML = `Power: ${derived.meleeBonus}/${derived.spellBonus}${renderOptionalStatusBadges(player.statuses)}`;
    powerLine.dataset.tooltip = "Power\nFirst value is melee power.\nSecond value is spell power.";

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
      button.innerHTML = `<span>${index + 1}.</span>${icon}<span>${label}</span>`;
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
        : ENEMIES[target.templateId]?.behavior === "boss"
          ? "Boss"
          : target.elite
            ? "Elite"
            : "Enemy";
      panel.innerHTML = `
        ${spriteMarkup}
        <p><strong>${target.name}</strong></p>
        <p>HP: ${target.hp}/${target.maxHp}</p>
        <p>${bossLabel}</p>
        ${renderOptionalStatusBadges(target.statuses)}
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

  renderNpcDialog() {
    const dialog = this.game.state.ui.npcDialog;
    if (!this.npcDialog) return;
    if (!dialog || Date.now() > dialog.until) {
      if (dialog && Date.now() > dialog.until) {
        this.game.state.ui.npcDialog = null;
      }
      this.npcDialog.classList.add("hidden");
      return;
    }
    this.npcDialogSpeaker.textContent = dialog.speaker;
    this.npcDialogText.textContent = dialog.text;
    this.npcDialog.classList.remove("hidden");
  }

  showTransition(text) {
    this.transitionBanner.textContent = text;
    this.transitionBanner.classList.remove("hidden");
    window.setTimeout(() => this.transitionBanner.classList.add("hidden"), 1300);
  }

  triggerFlash(variant = "critical") {
    if (!this.criticalFlash) return;
    this.criticalFlash.classList.remove("critical", "necro", "slam");
    this.criticalFlash.classList.add(variant);
    this.criticalFlash.classList.remove("hidden");
    this.criticalFlash.classList.remove("active");
    void this.criticalFlash.offsetWidth;
    this.criticalFlash.classList.add("active");
    window.setTimeout(() => {
      this.criticalFlash?.classList.remove("active");
      this.criticalFlash?.classList.remove("critical", "necro", "slam");
      this.criticalFlash?.classList.add("hidden");
    }, 380);
  }

  triggerCriticalFlash() {
    this.triggerFlash("critical");
  }

  triggerNecroFlash() {
    this.triggerFlash("necro");
  }

  triggerSlamFlash() {
    this.triggerFlash("slam");
  }
}
