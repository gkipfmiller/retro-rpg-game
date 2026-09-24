// Torch-lit dungeon diorama drawn behind the main menu, class select and high scores.
// The room is laid out on a small 16px-tile grid, rendered at native resolution to an offscreen
// canvas, then scaled up by a whole number to cover the window so pixels stay crisp.

const FRAMES = "./RPG Art Assets/frames";
const TILE = 16;
const COLS = 26;
const ROWS = 15;
const WIDTH = COLS * TILE;
const HEIGHT = ROWS * TILE;
const ACTOR_FRAME_MS = 220;
const FOUNTAIN_FRAME_MS = 170;
const MAX_EMBERS = 70;

const frameList = (prefix, count) => Array.from({ length: count }, (_, index) => `${FRAMES}/${prefix}${index}.png`);

const SPRITES = {
  wallTop: `${FRAMES}/wall_top_mid.png`,
  wallMid: `${FRAMES}/wall_mid.png`,
  wallHole: `${FRAMES}/wall_hole_1.png`,
  bannerRed: `${FRAMES}/wall_banner_red.png`,
  bannerBlue: `${FRAMES}/wall_banner_blue.png`,
  bannerYellow: `${FRAMES}/wall_banner_yellow.png`,
  fountainTop: `${FRAMES}/wall_fountain_top_1.png`,
  column: `${FRAMES}/column.png`,
  crate: `${FRAMES}/crate.png`,
  skull: `${FRAMES}/skull.png`,
  chest: `${FRAMES}/chest_empty_open_anim_f0.png`,
  floors: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${FRAMES}/floor_${n}.png`),
  fountainMid: frameList("wall_fountain_mid_red_anim_f", 3),
  fountainBasin: frameList("wall_fountain_basin_red_anim_f", 3),
  warrior: frameList("knight_m_idle_anim_f", 4),
  wizard: frameList("wizzard_f_idle_anim_f", 4),
  ranger: frameList("archer_m_idle_anim_f", 4),
};

// Fixed layout (tile coordinates). The fountain and the three delvers sit right of centre so the
// menu panel on the left doesn't cover them.
const FOUNTAIN_X = 17;
const DELVERS = [
  { sprite: "warrior", x: 15, y: 7, phase: 0 },
  { sprite: "wizard", x: 17, y: 7, phase: 1 },
  { sprite: "ranger", x: 19, y: 7, phase: 2 },
];
const BANNERS = [
  { sprite: "bannerRed", x: 6 },
  { sprite: "bannerBlue", x: 10 },
  { sprite: "bannerYellow", x: 24 },
];
const TORCHES = [{ x: 13 }, { x: 21 }, { x: 3 }];
const PROPS = [
  { sprite: "crate", x: 2, y: 4 },
  { sprite: "crate", x: 3, y: 4 },
  { sprite: "crate", x: 24, y: 12 },
  { sprite: "skull", x: 7, y: 10 },
  { sprite: "skull", x: 14, y: 11 },
  { sprite: "skull", x: 22, y: 11 },
  { sprite: "chest", x: 21, y: 5 },
];
const COLUMNS = [{ x: 12, y: 5 }, { x: 22, y: 8 }, { x: 12, y: 12 }, { x: 20, y: 13 }];

// Deterministic floor pattern: mostly plain stone with a few cracked variants.
function floorIndex(x, y) {
  const hash = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
  if (hash < 0.72) return 0;
  return 1 + Math.floor(((hash - 0.72) / 0.28) * 7);
}

export class MenuScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.buffer = document.createElement("canvas");
    this.buffer.width = WIDTH;
    this.buffer.height = HEIGHT;
    this.bufferCtx = this.buffer.getContext("2d");
    this.darkness = document.createElement("canvas");
    this.darkness.width = WIDTH;
    this.darkness.height = HEIGHT;
    this.darknessCtx = this.darkness.getContext("2d");
    this.images = {};
    this.embers = [];
    this.active = false;
    this.loaded = false;
    this.lastTime = 0;
    this.reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    this.tick = this.tick.bind(this);
    window.addEventListener("resize", () => this.drawFrame(performance.now()));
    this.load();
  }

  load() {
    const paths = Object.values(SPRITES).flat();
    let remaining = paths.length;
    for (const path of paths) {
      const image = new Image();
      image.onload = image.onerror = () => {
        remaining -= 1;
        if (remaining === 0) {
          this.loaded = true;
          this.drawFrame(performance.now());
        }
      };
      image.src = path;
      this.images[path] = image;
    }
  }

  setActive(active) {
    if (active === this.active) return;
    this.active = active;
    this.canvas.classList.toggle("hidden", !active);
    if (active) {
      this.lastTime = performance.now();
      window.requestAnimationFrame(this.tick);
    }
  }

  tick(now) {
    if (!this.active) return;
    this.drawFrame(now);
    // Reduced motion gets one still frame (redrawn on resize) instead of a loop.
    if (!this.reduceMotion?.matches) window.requestAnimationFrame(this.tick);
  }

  image(path) {
    const image = this.images[path];
    return image?.complete && image.naturalWidth ? image : null;
  }

  draw(path, x, y) {
    const image = this.image(path);
    if (image) this.bufferCtx.drawImage(image, Math.round(x), Math.round(y));
  }

  // Draws an image with its bottom edge on the bottom of tile (tx, ty).
  drawStanding(path, tx, ty) {
    const image = this.image(path);
    if (image) this.bufferCtx.drawImage(image, tx * TILE, (ty + 1) * TILE - image.naturalHeight);
  }

  drawFrame(now) {
    if (!this.loaded || !this.active) return;
    const dt = Math.min(100, now - this.lastTime);
    this.lastTime = now;
    const ctx = this.bufferCtx;
    const actorFrame = Math.floor(now / ACTOR_FRAME_MS);
    const fountainFrame = Math.floor(now / FOUNTAIN_FRAME_MS) % 3;

    ctx.fillStyle = "#0b0908";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Back wall: a row of wall tops, then the wall face with banners, a crack and the fountain.
    for (let x = 0; x < COLS; x += 1) {
      this.draw(x === FOUNTAIN_X ? SPRITES.fountainTop : SPRITES.wallTop, x * TILE, 0);
      this.draw(x === FOUNTAIN_X ? SPRITES.fountainMid[fountainFrame] : SPRITES.wallMid, x * TILE, TILE);
    }
    for (const banner of BANNERS) this.draw(SPRITES[banner.sprite], banner.x * TILE, TILE);
    this.draw(SPRITES.wallHole, 8 * TILE, TILE);

    for (let y = 2; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        this.draw(x === FOUNTAIN_X && y === 2 ? SPRITES.fountainBasin[fountainFrame] : SPRITES.floors[floorIndex(x, y)], x * TILE, y * TILE);
      }
    }

    for (const torch of TORCHES) this.drawTorch(torch.x, now);

    // Props and actors, back to front.
    const standing = [
      ...PROPS.map((prop) => ({ ...prop, path: SPRITES[prop.sprite] })),
      ...COLUMNS.map((column) => ({ ...column, path: SPRITES.column })),
      ...DELVERS.map((delver) => ({ ...delver, path: SPRITES[delver.sprite][(actorFrame + delver.phase) % 4] })),
    ].sort((a, b) => a.y - b.y);
    for (const entry of standing) {
      // Shadow under actors and props so they sit on the floor.
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(entry.x * TILE + 3, (entry.y + 1) * TILE - 2, TILE - 6, 2);
      this.drawStanding(entry.path, entry.x, entry.y);
    }

    this.updateEmbers(dt, now);
    this.drawLighting(now);
    this.drawEmbers();
    this.present();
  }

  // A small iron sconce with a flickering three-colour flame, on the wall face.
  drawTorch(tx, now) {
    const ctx = this.bufferCtx;
    const x = tx * TILE + 7;
    const y = TILE + 5;
    ctx.fillStyle = "#2a1f18";
    ctx.fillRect(x - 1, y + 3, 4, 2);
    ctx.fillRect(x, y + 5, 2, 3);
    const flicker = Math.sin(now / 90 + tx) > 0 ? 1 : 0;
    ctx.fillStyle = "#c2451e";
    ctx.fillRect(x - 1, y - 1 - flicker, 4, 4 + flicker);
    ctx.fillStyle = "#f29a2e";
    ctx.fillRect(x, y - 2 - flicker, 2, 4 + flicker);
    ctx.fillStyle = "#ffe7a3";
    ctx.fillRect(x, y, 2, 2);
  }

  lightSources(now) {
    const flicker = (seed, amount) => 1 + Math.sin(now / 110 + seed) * amount + Math.sin(now / 47 + seed * 3) * amount * 0.5;
    return [
      ...TORCHES.map((torch, index) => ({ x: torch.x * TILE + 8, y: TILE + 6, radius: 62 * flicker(index, 0.05), color: "rgba(255, 150, 60, 0.16)" })),
      { x: FOUNTAIN_X * TILE + 8, y: 2 * TILE + 8, radius: 88 * flicker(7, 0.04), color: "rgba(255, 80, 40, 0.18)" },
      { x: 17 * TILE + 8, y: 7 * TILE + 4, radius: 100 * flicker(11, 0.02), color: "rgba(255, 190, 120, 0.08)" },
    ];
  }

  // Everything starts dark; each light source cuts a soft hole in the darkness and adds a warm tint.
  drawLighting(now) {
    const dark = this.darknessCtx;
    const lights = this.lightSources(now);
    dark.globalCompositeOperation = "source-over";
    dark.clearRect(0, 0, WIDTH, HEIGHT);
    dark.fillStyle = "rgba(6, 4, 3, 0.9)";
    dark.fillRect(0, 0, WIDTH, HEIGHT);
    dark.globalCompositeOperation = "destination-out";
    for (const light of lights) {
      const gradient = dark.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius);
      gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
      gradient.addColorStop(0.55, "rgba(0, 0, 0, 0.7)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      dark.fillStyle = gradient;
      dark.fillRect(light.x - light.radius, light.y - light.radius, light.radius * 2, light.radius * 2);
    }
    const ctx = this.bufferCtx;
    ctx.drawImage(this.darkness, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const light of lights) {
      const gradient = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius);
      gradient.addColorStop(0, light.color);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(light.x - light.radius, light.y - light.radius, light.radius * 2, light.radius * 2);
    }
    ctx.restore();
  }

  updateEmbers(dt, now) {
    if (!this.reduceMotion?.matches && this.embers.length < MAX_EMBERS && Math.random() < dt / 60) {
      const sources = [...TORCHES.map((torch) => ({ x: torch.x * TILE + 8, y: TILE + 4 })), { x: FOUNTAIN_X * TILE + 8, y: 2 * TILE + 6 }];
      const source = sources[Math.floor(Math.random() * sources.length)];
      this.embers.push({ x: source.x + (Math.random() - 0.5) * 6, y: source.y, life: 0, maxLife: 2200 + Math.random() * 2600, drift: Math.random() * Math.PI * 2 });
    }
    for (const ember of this.embers) {
      ember.life += dt;
      ember.y -= dt * 0.012;
      ember.x += Math.sin(now / 600 + ember.drift) * dt * 0.006;
    }
    this.embers = this.embers.filter((ember) => ember.life < ember.maxLife && ember.y > -2);
  }

  drawEmbers() {
    const ctx = this.bufferCtx;
    for (const ember of this.embers) {
      const fade = 1 - ember.life / ember.maxLife;
      ctx.fillStyle = `rgba(255, ${Math.round(140 + fade * 90)}, 70, ${fade.toFixed(2)})`;
      ctx.fillRect(Math.round(ember.x), Math.round(ember.y), 1, 1);
    }
  }

  // Scales the room by the smallest whole number that covers the window, centred, with a vignette.
  present() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * dpr);
    const height = Math.round(window.innerHeight * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const scale = Math.max(1, Math.ceil(Math.max(width / WIDTH, height / HEIGHT)));
    const drawWidth = WIDTH * scale;
    const drawHeight = HEIGHT * scale;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buffer, Math.round((width - drawWidth) / 2), Math.round((height - drawHeight) / 2), drawWidth, drawHeight);
    const vignette = ctx.createRadialGradient(width * 0.6, height * 0.45, Math.min(width, height) * 0.25, width * 0.5, height * 0.5, Math.max(width, height) * 0.75);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.75)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }
}
