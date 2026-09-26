// Spell visuals: a distinct projectile for each spell, particle trails, impact bursts, area effects
// (explosions, novas, blinks), and status auras on actors (flames, frost, hex runes, shield bubbles).
// Purely cosmetic: nothing here reads or changes game rules. Positions are kept in tile units, so
// effects stay put when the camera moves.

const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const TAU = Math.PI * 2;
const MAX_PARTICLES = 420;

// How each projectile looks. shape: orb | spark | shard | lightning | rune | fire | arrow.
// trail: particles shed in flight. impact: the burst where it lands. glow is an "r, g, b" string.
const SPELL_STYLES = {
  magic_missile: { shape: "orb", color: "#a78bff", core: "#ffffff", glow: "150, 110, 255", size: 0.15, trail: "sparkle", impact: "burst" },
  arcane_spark: { shape: "spark", color: "#d9b8ff", core: "#ffffff", glow: "200, 160, 255", size: 0.14, trail: "sparkle", impact: "crackle", duration: 240 },
  spire_bolt: { shape: "orb", color: "#b06cff", core: "#f3e6ff", glow: "176, 108, 255", size: 0.12, trail: "sparkle", impact: "burst" },
  frost_shard: { shape: "shard", color: "#8fdcff", core: "#ffffff", glow: "140, 215, 255", size: 0.32, trail: "frost", impact: "shards" },
  ice_shatter: { shape: "shard", color: "#c9f1ff", core: "#ffffff", glow: "170, 230, 255", size: 0.36, trail: "frost", impact: "shatter" },
  frost_nova: { shape: "shard", color: "#bff0ff", core: "#ffffff", glow: "170, 230, 255", size: 0.16, trail: "frost", impact: "shards", duration: 200 },
  chain_bolt: { shape: "lightning", color: "#ffe27a", core: "#fffbe6", glow: "255, 220, 110", size: 0.1, impact: "sparks", duration: 260 },
  arcane_burst: { shape: "orb", color: "#e08cff", core: "#fff0ff", glow: "225, 130, 255", size: 0.24, trail: "sparkle", impact: "blast", pulse: true },
  arcane_pulse: { shape: "orb", color: "#e070d0", core: "#ffffff", glow: "224, 112, 208", size: 0.12, impact: "burst", duration: 180 },
  frailty_hex: { shape: "rune", color: "#a6d86a", core: "#e9ffd0", glow: "150, 210, 90", size: 0.22, trail: "wisp", impact: "runeRing" },
  fire_splash: { shape: "fire", color: "#ff9a3c", core: "#ffe9a8", glow: "255, 140, 50", size: 0.16, trail: "embers", impact: "sparks", duration: 170, glyph: false },
  fireball: { shape: "fire", color: "#ff8a2a", core: "#fff2c0", glow: "255, 140, 50", size: 0.3, trail: "embers", impact: "none", duration: 380 },
  shadow_bolt: { shape: "orb", color: "#8e7cff", core: "#1c1233", glow: "120, 100, 255", size: 0.17, trail: "smoke", impact: "burst" },
  hexfire: { shape: "rune", color: "#ff7b9c", core: "#ffe0e8", glow: "255, 110, 150", size: 0.2, trail: "wisp", impact: "runeRing" },
  cinder_hex: { shape: "fire", color: "#ff9b54", core: "#ffe1b8", glow: "255, 150, 80", size: 0.18, trail: "embers", impact: "sparks" },
  abyssal_bolt: { shape: "orb", color: "#ff4f7a", core: "#1a0610", glow: "255, 70, 120", size: 0.23, trail: "smoke", impact: "blast", pulse: true },
  // Arrows: plain shots arc with a ground shadow; Aimed Shot flies flat, fast, and bright.
  arrow: { shape: "arrow", color: "#d4a853", core: "#f3e3b8", glow: "240, 220, 170", size: 0.1, impact: "thunk", glyph: false, arc: true, duration: 300 },
  aimed_arrow: { shape: "arrow", color: "#fff2c8", core: "#ffffff", glow: "255, 240, 200", size: 0.12, trail: "streak", impact: "pierce", glyph: false, aimed: true, linear: true, duration: 190 },
  phantom_arrow: { shape: "arrow", color: "#9ff3ff", core: "#e8ffff", glow: "140, 240, 255", size: 0.1, trail: "ghost", impact: "ghostBurst", glyph: false, ghost: true, duration: 260 },
};

// Special bows tint the arrowhead and add their own trail and impact (on top of Aimed Shot's).
const BOW_STYLES = {
  venomstrike_bow: { tip: "#7fd36b", glow: "120, 210, 100", bowTrail: "venom", bowImpact: "venomSplat" },
  galeforce_bow: { tip: "#e6f7ff", glow: "220, 240, 255", bowTrail: "wind", bowImpact: "gust" },
  voidpiercer_bow: { tip: "#c08cff", glow: "150, 80, 255", bowTrail: "void", bowImpact: "voidBurst" },
  stormstring_bow: { tip: "#ffe27a", glow: "255, 220, 110", bowTrail: "crackle", bowImpact: "sparks" },
  hawk_bow: { tip: "#f0dcae", glow: "230, 200, 150", bowTrail: "feathers", bowImpact: "thunk" },
};
const DEFAULT_STYLE = { shape: "orb", color: "#d7a54d", core: "#fff1c2", glow: "215, 165, 77", size: 0.16, trail: "sparkle", impact: "burst" };

// Colours for area effects and auras, as "r, g, b".
const RGB = {
  arcane: "176, 120, 255",
  pulse: "224, 112, 208",
  frost: "160, 225, 255",
  fire: "255, 140, 50",
  shield: "127, 182, 255",
  barrier: "90, 168, 255",
  hex: "176, 108, 255",
  poison: "120, 210, 100",
};

const rgba = (rgb, alpha) => `rgba(${rgb}, ${alpha})`;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
const rand = (min, max) => min + Math.random() * (max - min);

export class SpellFx {
  constructor() {
    this.projectiles = [];
    this.effects = [];
    this.particles = [];
    this.now = performance.now();
    this.dt = 0;
    this.lastGlyph = new Map();
    this.tints = new WeakMap();
    // Set by the renderer: (actorId) => current {x, y} of an enemy or "player", or null. The game
    // resolves a turn instantly, so a target may already have stepped by the time its hit is drawn;
    // projectiles and bursts follow it there.
    this.locate = () => null;
    // Attack nudges and leaps in progress (see getMotion).
    this.motions = [];
  }

  // Once per frame, before anything spawns or draws.
  beginFrame() {
    const now = performance.now();
    this.dt = clamp((now - this.now) / 1000, 0, 0.1);
    this.now = now;
  }

  addProjectile(projectile) {
    let style = SPELL_STYLES[projectile.kind] ?? DEFAULT_STYLE;
    const bow = style.shape === "arrow" && !style.ghost ? BOW_STYLES[projectile.bow] : null;
    if (bow) style = { ...style, ...bow };
    const delay = projectile.delay ?? 0;
    const entry = {
      ...projectile,
      style,
      start: performance.now() + delay,
      duration: projectile.duration ?? style.duration ?? 320,
      seed: Math.random() * 1000,
      landed: false,
    };
    this.projectiles.push(entry);
    // A casting glyph under the caster, once per cast (novas and pulses fire several at once).
    // Delayed follow-ups (splashes, chain hops) get none unless the caster asks (enemy casts).
    if ((!delay || projectile.castGlyph) && style.glyph !== false) this.addGlyph(projectile.from, style, delay);
  }

  getDuration(kind) {
    return (SPELL_STYLES[kind] ?? DEFAULT_STYLE).duration ?? 320;
  }

  addGlyph(at, style, delay = 0) {
    const key = `${at.x},${at.y}`;
    if (this.now - (this.lastGlyph.get(key) ?? -1e9) < 120) return;
    this.lastGlyph.set(key, this.now);
    this.effects.push({ kind: "glyph", x: at.x, y: at.y, rgb: style.glow ?? DEFAULT_STYLE.glow, start: performance.now() + delay, duration: 380 });
  }

  // Area and cast effects queued by the game: explosion, nova, pulse, blink, column, shieldUp.
  addEffect(effect) {
    const start = performance.now() + (effect.delay ?? 0);
    const durations = { explosion: 620, nova: 520, pulse: 420, blink: 420, column: 700, shieldUp: 520, aimLine: 200, poisonSplash: 420, dust: 1, shadowPuff: 1 };
    this.effects.push({ ...effect, start, duration: effect.duration ?? durations[effect.kind] ?? 400, spawned: false });
  }

  isBusy() {
    return this.projectiles.length > 0 || this.effects.length > 0 || this.particles.length > 0;
  }

  // Light sources for the lighting layer (tile units), so spells light up the dark as they pass.
  getLights() {
    const lights = [];
    for (const projectile of this.projectiles) {
      const point = this.projectilePoint(projectile);
      // Plain arrows don't glow; aimed, ghost, and special-bow arrows do.
      const plainArrow = projectile.style.shape === "arrow" && !projectile.style.aimed && !projectile.style.ghost && !projectile.style.bowTrail;
      if (!point || plainArrow) continue;
      lights.push({ x: point.x - 0.5, y: point.y - 0.5, radius: 1.6 + projectile.style.size * 4, color: projectile.style.glow, strength: 0.22 });
    }
    for (const effect of this.effects) {
      const t = (this.now - effect.start) / effect.duration;
      if (t < 0 || t > 1) continue;
      if (effect.kind === "explosion") lights.push({ x: effect.x, y: effect.y, radius: 4.2 * (1 - t * 0.5), color: RGB.fire, strength: 0.5 * (1 - t) });
      if (effect.kind === "nova") lights.push({ x: effect.x, y: effect.y, radius: 3.4, color: RGB.frost, strength: 0.18 * (1 - t) });
      if (effect.kind === "pulse") lights.push({ x: effect.x, y: effect.y, radius: 3, color: RGB.pulse, strength: 0.28 * (1 - t) });
      if (effect.kind === "column") lights.push({ x: effect.x, y: effect.y, radius: 3, color: RGB.arcane, strength: 0.3 * (1 - t) });
    }
    return lights;
  }

  // Ground position, plus lift for arcing arrows (tile units) and the flight angle on screen.
  projectilePoint(projectile) {
    const t = (this.now - projectile.start) / projectile.duration;
    if (t < 0) return null;
    const { style } = projectile;
    const eased = style.linear ? clamp(t, 0, 1) : easeInOut(clamp(t, 0, 1));
    const dx = projectile.to.x - projectile.from.x;
    const dy = projectile.to.y - projectile.from.y;
    const height = style.arc ? Math.min(0.7, 0.15 + Math.hypot(dx, dy) * 0.09) : 0;
    const lift = 4 * height * eased * (1 - eased);
    const climb = 4 * height * (1 - 2 * eased);
    return {
      x: projectile.from.x + 0.5 + dx * eased,
      y: projectile.from.y + 0.5 + dy * eased,
      lift,
      angle: Math.atan2(dy - climb, dx),
      t,
    };
  }

  // ── Particles ──
  emit(particle) {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({ gravity: 0, drag: 0.9, shape: "dot", ...particle, age: 0 });
  }

  burst(x, y, count, { rgb, color, speed = [1.5, 3.5], life = [0.25, 0.5], size = [0.04, 0.08], gravity = 0, shape = "dot", inward = false }) {
    if (reduceMotion()) count = Math.ceil(count / 3);
    for (let index = 0; index < count; index += 1) {
      const angle = rand(0, TAU);
      const velocity = rand(speed[0], speed[1]);
      const lifetime = rand(life[0], life[1]);
      const start = inward ? { x: x + Math.cos(angle) * velocity * lifetime, y: y + Math.sin(angle) * velocity * lifetime } : { x, y };
      this.emit({
        x: start.x,
        y: start.y,
        vx: Math.cos(angle) * velocity * (inward ? -1 : 1),
        vy: Math.sin(angle) * velocity * (inward ? -1 : 1),
        life: lifetime,
        size: rand(size[0], size[1]),
        color: color ?? rgba(rgb, 1),
        gravity,
        shape,
        angle,
        drag: inward ? 1 : 0.9,
      });
    }
  }

  // ── Frame drawing (after actors and lighting) ──
  drawWorld(ctx, view) {
    this.drawEffects(ctx, view, "under");
    this.drawProjectiles(ctx, view);
    this.drawEffects(ctx, view, "over");
    this.drawParticles(ctx, view);
  }

  drawProjectiles(ctx, view) {
    const { offsetX, offsetY, tileSize } = view;
    const keep = [];
    for (const projectile of this.projectiles) {
      if (!projectile.landed) this.trackEnds(projectile);
      const point = this.projectilePoint(projectile);
      if (!point) {
        keep.push(projectile);
        continue;
      }
      const { style } = projectile;
      if (point.t >= 1 && !projectile.landed) {
        projectile.landed = true;
        if (!projectile.missed) this.impact(style, projectile.to.x + 0.5, projectile.to.y + 0.5, projectile);
      }
      const lingers = style.shape === "lightning" && point.t < 1.35;
      if (point.t >= 1 && !lingers) continue;
      keep.push(projectile);
      if (point.t < 1) this.shedTrail(projectile, point);
      const px = offsetX + point.x * tileSize;
      const py = offsetY + (point.y - point.lift) * tileSize;
      const angle = style.shape === "arrow" ? point.angle : Math.atan2(projectile.to.y - projectile.from.y, projectile.to.x - projectile.from.x);
      const radius = Math.max(3, tileSize * style.size);
      ctx.save();
      if (point.lift > 0.02) {
        // The arrow's shadow on the floor, under its arc.
        ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
        ctx.beginPath();
        ctx.ellipse(px, offsetY + (point.y + 0.3) * tileSize, tileSize * 0.16, tileSize * 0.05, 0, 0, TAU);
        ctx.fill();
      }
      switch (style.shape) {
        case "spark": this.drawSpark(ctx, px, py, radius, style, projectile); break;
        case "shard": this.drawShard(ctx, px, py, radius, angle, style); break;
        case "lightning": this.drawLightning(ctx, view, projectile, point.t, style); break;
        case "rune": this.drawRune(ctx, px, py, radius, style, projectile); break;
        case "fire": this.drawFire(ctx, px, py, radius, style, projectile); break;
        case "arrow": this.drawArrowShot(ctx, px, py, tileSize, angle, style); break;
        default: this.drawOrb(ctx, px, py, radius, style, projectile); break;
      }
      ctx.restore();
    }
    this.projectiles = keep;
  }

  // Launch point is fixed once the projectile starts; the landing point follows a moving target.
  trackEnds(projectile) {
    if (!projectile.launched && this.now >= projectile.start) {
      projectile.launched = true;
      const from = projectile.fromId ? this.locate(projectile.fromId) : null;
      if (from) projectile.from = from;
    }
    const to = projectile.targetId ? this.locate(projectile.targetId) : null;
    if (to) projectile.to = to;
  }

  glowAt(ctx, px, py, radius, rgb, alpha) {
    ctx.globalCompositeOperation = "lighter";
    const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
    gradient.addColorStop(0, rgba(rgb, alpha));
    gradient.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
    ctx.globalCompositeOperation = "source-over";
  }

  drawOrb(ctx, px, py, radius, style, projectile) {
    const pulse = style.pulse && !reduceMotion() ? 1 + Math.sin(this.now / 45 + projectile.seed) * 0.14 : 1;
    const r = radius * pulse;
    this.glowAt(ctx, px, py, r * 3, style.glow, 0.55);
    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = style.core;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.5, 0, TAU);
    ctx.fill();
  }

  drawSpark(ctx, px, py, radius, style, projectile) {
    this.glowAt(ctx, px, py, radius * 3.2, style.glow, 0.5);
    const spin = (this.now / 60 + projectile.seed) % TAU;
    ctx.translate(px, py);
    ctx.rotate(spin);
    ctx.fillStyle = style.color;
    ctx.beginPath();
    for (let index = 0; index < 8; index += 1) {
      const r = index % 2 === 0 ? radius * 1.6 : radius * 0.45;
      const a = (index / 8) * TAU;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = style.core;
    ctx.fillRect(-radius * 0.3, -radius * 0.3, radius * 0.6, radius * 0.6);
  }

  drawShard(ctx, px, py, radius, angle, style) {
    this.glowAt(ctx, px, py, radius * 2.4, style.glow, 0.45);
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.moveTo(radius * 1.3, 0);
    ctx.lineTo(-radius * 0.2, radius * 0.42);
    ctx.lineTo(-radius * 1.1, 0);
    ctx.lineTo(-radius * 0.2, -radius * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = style.core;
    ctx.lineWidth = Math.max(1, radius * 0.18);
    ctx.beginPath();
    ctx.moveTo(radius * 1.2, 0);
    ctx.lineTo(-radius * 0.6, -radius * 0.08);
    ctx.stroke();
  }

  drawLightning(ctx, view, projectile, t, style) {
    const { offsetX, offsetY, tileSize } = view;
    const head = clamp(t / 0.45, 0, 1);
    const fade = t < 1 ? 1 : clamp(1 - (t - 1) / 0.35, 0, 1);
    const sx = offsetX + (projectile.from.x + 0.5) * tileSize;
    const sy = offsetY + (projectile.from.y + 0.5) * tileSize;
    const ex = offsetX + (projectile.to.x + 0.5) * tileSize;
    const ey = offsetY + (projectile.to.y + 0.5) * tileSize;
    const length = Math.hypot(ex - sx, ey - sy);
    const segments = Math.max(3, Math.round(length / (tileSize * 0.35)));
    const nx = -(ey - sy) / (length || 1);
    const ny = (ex - sx) / (length || 1);
    // Re-jag every few frames so the bolt crackles.
    const flickerSeed = Math.floor(this.now / 45) + projectile.seed;
    const points = [];
    for (let index = 0; index <= segments; index += 1) {
      const along = (index / segments) * head;
      const jitter = index === 0 || index === segments ? 0 : Math.sin(flickerSeed * 12.9898 + index * 78.233) * tileSize * 0.22;
      points.push({ x: sx + (ex - sx) * along + nx * jitter, y: sy + (ey - sy) * along + ny * jitter });
    }
    const stroke = (color, width) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.beginPath();
      points.forEach((point, index) => (index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)));
      ctx.stroke();
    };
    ctx.globalCompositeOperation = "lighter";
    stroke(rgba(style.glow, 0.35 * fade), Math.max(4, tileSize * 0.3));
    ctx.globalCompositeOperation = "source-over";
    stroke(rgba("255, 226, 122", 0.95 * fade), Math.max(2, tileSize * 0.09));
    stroke(rgba("255, 255, 240", fade), Math.max(1, tileSize * 0.035));
    const tip = points[points.length - 1];
    this.glowAt(ctx, tip.x, tip.y, tileSize * 0.6, style.glow, 0.6 * fade);
  }

  drawRune(ctx, px, py, radius, style, projectile) {
    this.glowAt(ctx, px, py, radius * 2.6, style.glow, 0.45);
    const spin = (this.now / 160 + projectile.seed) % TAU;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = Math.max(1.5, radius * 0.2);
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = style.core;
    for (let index = 0; index < 3; index += 1) {
      const a = spin + (index / 3) * TAU;
      ctx.beginPath();
      ctx.arc(px + Math.cos(a) * radius, py + Math.sin(a) * radius, Math.max(1.5, radius * 0.22), 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.arc(px, py, radius * 0.38, 0, TAU);
    ctx.fill();
  }

  drawFire(ctx, px, py, radius, style, projectile) {
    this.glowAt(ctx, px, py, radius * 3, style.glow, 0.6);
    const wobble = (phase) => (reduceMotion() ? 0 : Math.sin(this.now / 38 + projectile.seed + phase) * radius * 0.12);
    const layers = [["#c8321c", 1.1], [style.color, 0.82], ["#ffd25a", 0.55], [style.core, 0.28]];
    layers.forEach(([color, scale], index) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px + wobble(index * 1.7), py + wobble(index * 2.3 + 1), radius * scale, 0, TAU);
      ctx.fill();
    });
  }

  // One arrow: shaft, head (tinted by special bows), fletching. Aimed arrows are longer and glow;
  // phantom arrows are translucent with two fading echoes behind them.
  drawArrowShot(ctx, px, py, tileSize, angle, style) {
    if (style.aimed || style.ghost || style.bowTrail) this.glowAt(ctx, px, py, tileSize * (style.aimed ? 0.5 : 0.35), style.glow, style.aimed ? 0.5 : 0.35);
    const echoes = style.ghost ? [[0.32, 0.18], [0.18, 0.34], [0, 0.7]] : [[0, 1]];
    for (const [back, alpha] of echoes) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(px - Math.cos(angle) * back * tileSize, py - Math.sin(angle) * back * tileSize);
      ctx.rotate(angle);
      this.drawArrowBody(ctx, tileSize, style);
      ctx.restore();
    }
  }

  drawArrowBody(ctx, tileSize, style) {
    const length = tileSize * (style.aimed ? 0.7 : 0.55);
    const half = length / 2;
    ctx.strokeStyle = style.ghost ? style.color : style.aimed ? "#c89a5a" : "#8a5a2b";
    ctx.lineWidth = Math.max(1.5, tileSize * 0.05);
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo(half, 0);
    ctx.stroke();
    ctx.fillStyle = style.ghost ? style.core : style.tip ?? (style.aimed ? "#ffffff" : "#dfe6ea");
    ctx.beginPath();
    ctx.moveTo(half + tileSize * 0.12, 0);
    ctx.lineTo(half - tileSize * 0.02, tileSize * 0.07);
    ctx.lineTo(half - tileSize * 0.02, -tileSize * 0.07);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = style.ghost ? style.core : style.tip && style.bowTrail ? style.tip : style.core;
    ctx.lineWidth = Math.max(1, tileSize * 0.035);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-half, 0);
      ctx.lineTo(-half - tileSize * 0.08, side * tileSize * 0.08);
      ctx.stroke();
    }
  }

  // Particles shed along the flight path: the projectile's own trail, a special bow's, and Windshot's.
  shedTrail(projectile, point) {
    const { style } = projectile;
    if (reduceMotion()) return;
    const trails = [style.trail, style.bowTrail, projectile.windshot ? "wind" : null].filter(Boolean);
    const rates = { sparkle: 60, frost: 55, embers: 90, smoke: 40, wisp: 45, streak: 80, wind: 45, venom: 40, void: 45, crackle: 55, feathers: 14, ghost: 50 };
    const angle = point.angle ?? Math.atan2(projectile.to.y - projectile.from.y, projectile.to.x - projectile.from.x);
    const back = { x: -Math.cos(angle), y: -Math.sin(angle) };
    const side = { x: -back.y, y: back.x };
    const y0 = point.y - (point.lift ?? 0);
    for (const trail of trails) {
      const expected = (rates[trail] ?? 40) * this.dt;
      const count = Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0);
      for (let index = 0; index < count; index += 1) {
        const jitter = () => rand(-0.08, 0.08);
        const base = { x: point.x + jitter(), y: y0 + jitter() };
        const drift = rand(-0.6, 0.6);
        switch (trail) {
          case "sparkle": this.emit({ ...base, vx: rand(-0.4, 0.4), vy: rand(-0.4, 0.4), life: rand(0.2, 0.4), size: rand(0.025, 0.05), color: Math.random() < 0.4 ? style.core : style.color, shape: "twinkle" }); break;
          case "frost": this.emit({ ...base, vx: rand(-0.3, 0.3), vy: rand(0.1, 0.6), life: rand(0.3, 0.5), size: rand(0.02, 0.045), color: Math.random() < 0.5 ? "#ffffff" : style.color }); break;
          case "embers": this.emit({ ...base, vx: rand(-0.5, 0.5), vy: rand(-0.9, -0.2), life: rand(0.25, 0.55), size: rand(0.03, 0.06), color: ["#ffd25a", "#ff8a2a", "#e8452c"][Math.floor(Math.random() * 3)], shape: "ember" }); break;
          case "smoke": this.emit({ ...base, vx: rand(-0.2, 0.2), vy: rand(-0.3, 0), life: rand(0.35, 0.6), size: rand(0.06, 0.11), color: rgba(style.glow, 0.5), shape: "smoke" }); break;
          case "wisp": this.emit({ ...base, vx: rand(-0.3, 0.3), vy: rand(-0.5, -0.1), life: rand(0.3, 0.5), size: rand(0.03, 0.05), color: style.color, shape: "twinkle" }); break;
          // Aimed Shot: bright speed lines streaming off the shaft.
          case "streak": this.emit({ ...base, vx: back.x * 3 + side.x * drift, vy: back.y * 3 + side.y * drift, life: rand(0.1, 0.2), size: rand(0.03, 0.05), color: "#fffbe8", shape: "streak", drag: 0.6 }); break;
          // Windshot and the Galeforce bow: pale gusts curling away to the sides.
          case "wind": this.emit({ ...base, vx: back.x * 1.2 + side.x * drift * 2.5, vy: back.y * 1.2 + side.y * drift * 2.5, life: rand(0.2, 0.35), size: rand(0.035, 0.06), color: "rgba(225, 245, 255, 0.8)", shape: "streak", drag: 0.7 }); break;
          case "venom": this.emit({ ...base, vx: rand(-0.2, 0.2), vy: rand(0, 0.3), life: rand(0.3, 0.5), size: rand(0.03, 0.05), color: Math.random() < 0.5 ? "#7fd36b" : "#b7f08f", gravity: 3 }); break;
          case "void": this.emit({ ...base, vx: rand(-0.2, 0.2), vy: rand(-0.2, 0.2), life: rand(0.3, 0.55), size: rand(0.05, 0.09), color: "rgba(110, 50, 190, 0.55)", shape: "smoke" }); break;
          case "crackle": this.emit({ ...base, vx: rand(-3, 3), vy: rand(-3, 3), life: rand(0.06, 0.14), size: rand(0.02, 0.035), color: "#fff3b0", shape: "streak" }); break;
          case "feathers": this.emit({ ...base, vx: back.x * 0.4 + rand(-0.3, 0.3), vy: rand(0, 0.4), life: rand(0.5, 0.8), size: rand(0.04, 0.06), color: Math.random() < 0.5 ? "#e8d8b8" : "#a0784a", shape: "shard", angle: rand(0, TAU), gravity: 0.6, drag: 0.8 }); break;
          case "ghost": this.emit({ ...base, vx: back.x * 0.6 + rand(-0.2, 0.2), vy: back.y * 0.6 + rand(-0.2, 0.2), life: rand(0.25, 0.4), size: rand(0.025, 0.045), color: "#bff8ff", shape: "twinkle" }); break;
          default: break;
        }
      }
    }
  }

  // Sprays count particles in a cone around angle (for impacts that carry through the target).
  burstCone(x, y, count, angle, spread, { color, speed = [2, 4], life = [0.12, 0.25], size = [0.02, 0.04], shape = "streak", gravity = 0 }) {
    if (reduceMotion()) count = Math.ceil(count / 3);
    for (let index = 0; index < count; index += 1) {
      const a = angle + rand(-spread, spread);
      const v = rand(speed[0], speed[1]);
      this.emit({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(life[0], life[1]), size: rand(size[0], size[1]), color, shape, gravity, angle: a });
    }
  }

  // x, y are tile centres (for particles); ring, flash, and rune effects take the tile itself.
  impact(style, x, y, projectile = null) {
    const kinds = [style.impact, style.bowImpact !== style.impact ? style.bowImpact : null, projectile?.piercing ? "armorCrack" : null].filter(Boolean);
    const angle = projectile ? Math.atan2(projectile.to.y - projectile.from.y, projectile.to.x - projectile.from.x) : 0;
    for (const kind of kinds) this.impactKind(kind, style, x, y, angle);
  }

  impactKind(kind, style, x, y, angle) {
    const rgb = style.glow ?? DEFAULT_STYLE.glow;
    const tx = x - 0.5;
    const ty = y - 0.5;
    switch (kind) {
      // A plain arrow thunks home: a few wood splinters kicked back toward the archer.
      case "thunk":
        this.burstCone(x, y, 5, angle + Math.PI, 0.9, { color: "#b08352", speed: [1, 2.2], life: [0.2, 0.35], size: [0.035, 0.055], shape: "shard", gravity: 3 });
        break;
      // Aimed Shot punches through: a white flash and sparks carrying on past the target.
      case "pierce":
        this.effects.push({ kind: "flash", x: tx, y: ty, rgb: "255, 245, 215", radius: 0.6, start: this.now, duration: 150 });
        this.burstCone(x, y, 12, angle, 0.35, { color: "#fffbe8", speed: [3, 6], life: [0.12, 0.24], size: [0.025, 0.045] });
        break;
      // Piercing Shot: the target's armour cracks, grey plates flying off.
      case "armorCrack":
        this.effects.push({ kind: "crack", x: tx, y: ty, start: this.now, duration: 320, angle });
        this.burst(x, y, 9, { color: "#aeb6bf", speed: [1.5, 3.2], life: [0.3, 0.5], size: [0.05, 0.08], gravity: 4, shape: "shard" });
        break;
      case "ghostBurst":
        this.effects.push({ kind: "ring", x: tx, y: ty, rgb, radius: 0.5, start: this.now, duration: 260 });
        this.burst(x, y, 8, { color: "#bff8ff", speed: [1, 2.4], life: [0.25, 0.45], size: [0.025, 0.045], shape: "twinkle" });
        break;
      case "venomSplat":
        this.effects.push({ kind: "ring", x: tx, y: ty, rgb: "120, 210, 100", radius: 0.45, start: this.now, duration: 240 });
        this.burst(x, y, 8, { color: "#7fd36b", speed: [1, 2.4], life: [0.3, 0.5], size: [0.03, 0.05], gravity: 4 });
        break;
      case "gust":
        this.burst(x, y, 10, { color: "rgba(225, 245, 255, 0.85)", speed: [2, 3.5], life: [0.18, 0.3], size: [0.03, 0.05], shape: "streak" });
        break;
      case "voidBurst":
        this.effects.push({ kind: "flash", x: tx, y: ty, rgb: "150, 80, 255", radius: 0.8, start: this.now, duration: 220 });
        this.effects.push({ kind: "ring", x: tx, y: ty, rgb: "150, 80, 255", radius: 0.7, start: this.now, duration: 300 });
        this.burst(x, y, 7, { color: "rgba(60, 20, 110, 0.6)", speed: [0.5, 1.4], life: [0.35, 0.6], size: [0.08, 0.13], shape: "smoke" });
        break;
      case "burst":
        this.effects.push({ kind: "ring", x: tx, y: ty, rgb, radius: 0.55, start: this.now, duration: 260 });
        this.burst(x, y, 8, { rgb, color: style.color, speed: [1, 2.6], life: [0.18, 0.35], size: [0.025, 0.05], shape: "twinkle" });
        break;
      case "crackle":
        this.effects.push({ kind: "flash", x: tx, y: ty, rgb, radius: 0.45, start: this.now, duration: 150 });
        this.burst(x, y, 6, { color: style.core, speed: [1.2, 2.4], life: [0.12, 0.25], size: [0.02, 0.04], shape: "twinkle" });
        break;
      case "shards":
        this.effects.push({ kind: "ring", x: tx, y: ty, rgb, radius: 0.5, start: this.now, duration: 240 });
        this.burst(x, y, 7, { color: style.color, speed: [1.5, 3], life: [0.25, 0.45], size: [0.05, 0.08], gravity: 3, shape: "shard" });
        break;
      case "shatter":
        this.effects.push({ kind: "flash", x: tx, y: ty, rgb: "220, 245, 255", radius: 0.9, start: this.now, duration: 200 });
        this.burst(x, y, 14, { color: "#ffffff", speed: [2, 4.2], life: [0.3, 0.55], size: [0.05, 0.1], gravity: 4, shape: "shard" });
        this.burst(x, y, 8, { color: style.color, speed: [1, 2.5], life: [0.3, 0.5], size: [0.04, 0.07], gravity: 3, shape: "shard" });
        break;
      case "sparks":
        this.effects.push({ kind: "flash", x: tx, y: ty, rgb, radius: 0.6, start: this.now, duration: 160 });
        this.burst(x, y, 10, { color: "#fff3b0", speed: [2.5, 5], life: [0.12, 0.28], size: [0.02, 0.04], shape: "streak" });
        break;
      case "blast":
        this.effects.push({ kind: "flash", x: tx, y: ty, rgb, radius: 0.95, start: this.now, duration: 240 });
        this.effects.push({ kind: "ring", x: tx, y: ty, rgb, radius: 0.85, start: this.now, duration: 320 });
        this.burst(x, y, 14, { color: style.color, speed: [1.5, 3.6], life: [0.25, 0.5], size: [0.03, 0.06], shape: "twinkle" });
        break;
      case "runeRing":
        this.effects.push({ kind: "rune", x: tx, y: ty, rgb, radius: 0.55, start: this.now, duration: 520 });
        this.burst(x, y, 6, { color: style.color, speed: [0.4, 1], life: [0.35, 0.6], size: [0.03, 0.05], shape: "twinkle" });
        break;
      default:
        break;
    }
  }

  // Spawns the particles for a queued area effect the moment it starts.
  spawnEffect(effect) {
    const cx = effect.x + 0.5;
    const cy = effect.y + 0.5;
    if (effect.kind === "explosion") {
      this.burst(cx, cy, 34, { color: "#ffb347", speed: [1.5, 4.5], life: [0.3, 0.7], size: [0.035, 0.075], gravity: -1, shape: "ember" });
      this.burst(cx, cy, 14, { color: "#ffe9a8", speed: [2.5, 5.5], life: [0.12, 0.25], size: [0.02, 0.04], shape: "streak" });
      // Smoke rises from the rim once the flash has passed, so it never smothers the blast.
      this.effects.push({ kind: "smokeLater", x: effect.x, y: effect.y, start: this.now + 220, duration: 1, spawned: false });
    } else if (effect.kind === "poisonSplash") {
      this.burst(cx, cy, 12, { color: "#7fd36b", speed: [1.2, 2.8], life: [0.3, 0.55], size: [0.035, 0.06], gravity: 4 });
      this.burst(cx, cy, 5, { color: "#c9f7a8", speed: [0.5, 1.2], life: [0.4, 0.6], size: [0.03, 0.05], shape: "twinkle" });
    } else if (effect.kind === "dust") {
      // Evasive Step take-off and landing.
      this.burst(cx, cy + 0.3, 9, { color: "rgba(170, 150, 120, 0.55)", speed: [0.6, 1.6], life: [0.3, 0.5], size: [0.06, 0.1], shape: "smoke" });
    } else if (effect.kind === "shadowPuff") {
      // Shadow Step: dark smoke instead of dust.
      this.burst(cx, cy + 0.1, 12, { color: "rgba(60, 40, 90, 0.6)", speed: [0.6, 1.8], life: [0.35, 0.6], size: [0.08, 0.13], shape: "smoke" });
      this.burst(cx, cy, 6, { color: "#b89cff", speed: [0.8, 1.6], life: [0.25, 0.4], size: [0.025, 0.04], shape: "twinkle" });
    } else if (effect.kind === "smokeLater") {
      for (let index = 0; index < (reduceMotion() ? 3 : 9); index += 1) {
        const angle = rand(0, TAU);
        const reach = rand(0.5, 1.2);
        this.emit({ x: cx + Math.cos(angle) * reach, y: cy + Math.sin(angle) * reach, vx: Math.cos(angle) * 0.3, vy: rand(-0.7, -0.3), life: rand(0.6, 0.9), size: rand(0.1, 0.18), color: "rgba(120, 100, 90, 0.35)", shape: "smoke", drag: 1 });
      }
    } else if (effect.kind === "nova") {
      this.addGlyph(effect, SPELL_STYLES.frost_nova);
      this.burst(cx, cy, 22, { color: "#dff6ff", speed: [2.5, 4.5], life: [0.3, 0.5], size: [0.05, 0.09], shape: "shard" });
      this.burst(cx, cy, 16, { color: "#9fe6ff", speed: [1, 2.5], life: [0.4, 0.7], size: [0.025, 0.05] });
    } else if (effect.kind === "pulse") {
      this.burst(cx, cy, 18, { color: "#f0b0ff", speed: [2, 4], life: [0.2, 0.4], size: [0.03, 0.05], shape: "twinkle" });
    } else if (effect.kind === "blink") {
      this.burst(effect.from.x + 0.5, effect.from.y + 0.5, 16, { color: "#8ff3f3", speed: [1, 2], life: [0.25, 0.4], size: [0.03, 0.05], shape: "twinkle", inward: true });
      this.burst(cx, cy, 18, { color: "#e8ffff", speed: [1.2, 3], life: [0.25, 0.45], size: [0.03, 0.05], shape: "twinkle" });
    } else if (effect.kind === "column") {
      for (let index = 0; index < (reduceMotion() ? 4 : 14); index += 1) {
        this.emit({ x: cx + rand(-0.25, 0.25), y: cy + rand(-0.1, 0.4), vx: rand(-0.1, 0.1), vy: rand(-2.4, -1), life: rand(0.4, 0.7), size: rand(0.03, 0.05), color: Math.random() < 0.5 ? "#e2c8ff" : "#b06cff", shape: "twinkle", drag: 1 });
      }
    } else if (effect.kind === "shieldUp") {
      this.burst(cx, cy, 14, { color: effect.barrier ? "#bfe0ff" : "#d8ecff", speed: [0.6, 1.4], life: [0.3, 0.5], size: [0.025, 0.045], shape: "twinkle" });
    }
  }

  drawEffects(ctx, view, layer) {
    const { offsetX, offsetY, tileSize } = view;
    const keep = [];
    for (const effect of this.effects) {
      const t = (this.now - effect.start) / effect.duration;
      if (t < 0) {
        keep.push(effect);
        continue;
      }
      if (t >= 1) continue;
      if (layer === "under") {
        keep.push(effect);
        if (!effect.spawned) {
          effect.spawned = true;
          const at = effect.targetId ? this.locate(effect.targetId) : null;
          if (at) Object.assign(effect, at);
          this.spawnEffect(effect);
        }
      }
      const px = offsetX + (effect.x + 0.5) * tileSize;
      const py = offsetY + (effect.y + 0.5) * tileSize;
      const under = effect.kind === "glyph" || effect.kind === "rune";
      // The aiming line follows its target as it steps.
      if (effect.kind === "aimLine" && effect.targetId) {
        const at = this.locate(effect.targetId);
        if (at) Object.assign(effect, at);
      }
      if ((layer === "under") !== under) continue;
      ctx.save();
      this.drawEffect(ctx, effect, t, px, py, tileSize, view);
      ctx.restore();
    }
    if (layer === "under") this.effects = keep;
  }

  drawEffect(ctx, effect, t, px, py, tileSize, view) {
    switch (effect.kind) {
      case "glyph": {
        // A small magic circle at the caster's feet.
        const alpha = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
        const r = tileSize * (0.42 + easeOut(t) * 0.1);
        const cy = py + tileSize * 0.3;
        ctx.translate(px, cy);
        ctx.scale(1, 0.45);
        ctx.rotate(t * 2);
        ctx.strokeStyle = rgba(effect.rgb, 0.8 * alpha);
        ctx.lineWidth = Math.max(1, tileSize * 0.05);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([tileSize * 0.08, tileSize * 0.07]);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.7, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        for (let index = 0; index < 6; index += 1) {
          const a = (index / 6) * TAU;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx.stroke();
        }
        break;
      }
      case "rune": {
        const alpha = 1 - t;
        const r = tileSize * effect.radius * (0.7 + easeOut(t) * 0.5);
        ctx.translate(px, py + tileSize * 0.25);
        ctx.scale(1, 0.5);
        ctx.rotate(-t * 3);
        ctx.strokeStyle = rgba(effect.rgb, 0.85 * alpha);
        ctx.lineWidth = Math.max(1.5, tileSize * 0.06);
        ctx.beginPath();
        for (let index = 0; index <= 5; index += 1) {
          const a = (index * 2 * TAU) / 5 - Math.PI / 2;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.05, 0, TAU);
        ctx.stroke();
        break;
      }
      case "ring": {
        const r = tileSize * effect.radius * (0.3 + easeOut(t) * 0.7);
        ctx.strokeStyle = rgba(effect.rgb, 0.8 * (1 - t));
        ctx.lineWidth = Math.max(1.5, tileSize * 0.07 * (1 - t) + 1);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, TAU);
        ctx.stroke();
        break;
      }
      case "flash":
        this.glowAt(ctx, px, py, tileSize * effect.radius * (0.6 + t * 0.6), effect.rgb, 0.9 * (1 - t));
        break;
      case "aimLine": {
        // Aimed Shot: a red sight line and a reticle closing onto the target, then the arrow looses.
        const from = { x: view.offsetX + (effect.from.x + 0.5) * tileSize, y: view.offsetY + (effect.from.y + 0.5) * tileSize };
        const alpha = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
        ctx.strokeStyle = `rgba(255, 90, 70, ${0.7 * alpha})`;
        ctx.lineWidth = Math.max(1, tileSize * 0.035);
        ctx.setLineDash([tileSize * 0.12, tileSize * 0.08]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.setLineDash([]);
        const r = tileSize * (0.55 - easeOut(clamp(t / 0.7, 0, 1)) * 0.25);
        ctx.strokeStyle = `rgba(255, 110, 90, ${0.95 * alpha})`;
        ctx.lineWidth = Math.max(1.5, tileSize * 0.05);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, TAU);
        ctx.stroke();
        for (let index = 0; index < 4; index += 1) {
          const a = (index / 4) * TAU;
          ctx.beginPath();
          ctx.moveTo(px + Math.cos(a) * r * 0.55, py + Math.sin(a) * r * 0.55);
          ctx.lineTo(px + Math.cos(a) * r * 1.3, py + Math.sin(a) * r * 1.3);
          ctx.stroke();
        }
        break;
      }
      case "poisonSplash": {
        const r = tileSize * (0.2 + easeOut(t) * 0.4);
        ctx.strokeStyle = `rgba(127, 211, 107, ${0.85 * (1 - t)})`;
        ctx.lineWidth = Math.max(1.5, tileSize * 0.06 * (1 - t) + 1);
        ctx.beginPath();
        ctx.ellipse(px, py + tileSize * 0.25, r, r * 0.45, 0, 0, TAU);
        ctx.stroke();
        break;
      }
      case "crack": {
        // Piercing Shot: jagged white fractures radiating from the hit.
        const alpha = 1 - t;
        ctx.strokeStyle = `rgba(235, 240, 245, ${0.9 * alpha})`;
        ctx.lineWidth = Math.max(1, tileSize * 0.04);
        const reach = tileSize * (0.2 + easeOut(clamp(t / 0.4, 0, 1)) * 0.3);
        for (let index = 0; index < 5; index += 1) {
          const a = effect.angle + Math.PI + (index - 2) * 0.55;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.cos(a + 0.25) * reach * 0.5, py + Math.sin(a + 0.25) * reach * 0.5);
          ctx.lineTo(px + Math.cos(a) * reach, py + Math.sin(a) * reach);
          ctx.stroke();
        }
        break;
      }
      case "explosion": {
        // Fireball: a white-hot flash, a rolling fireball filling the 3x3, and a shock ring.
        const reach = tileSize * 1.6;
        const grow = easeOut(clamp(t / 0.35, 0, 1));
        ctx.globalCompositeOperation = "lighter";
        const fire = ctx.createRadialGradient(px, py, 0, px, py, reach * (0.5 + grow * 0.6));
        fire.addColorStop(0, `rgba(255, 245, 210, ${0.95 * (1 - t)})`);
        fire.addColorStop(0.35, `rgba(255, 170, 60, ${0.8 * (1 - t)})`);
        fire.addColorStop(0.7, `rgba(230, 70, 30, ${0.45 * (1 - t)})`);
        fire.addColorStop(1, "rgba(200, 40, 20, 0)");
        ctx.fillStyle = fire;
        ctx.fillRect(px - reach * 1.2, py - reach * 1.2, reach * 2.4, reach * 2.4);
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = `rgba(255, 210, 120, ${0.7 * (1 - t)})`;
        ctx.lineWidth = Math.max(2, tileSize * 0.12 * (1 - t));
        ctx.beginPath();
        ctx.arc(px, py, reach * (0.35 + easeOut(t) * 0.75), 0, TAU);
        ctx.stroke();
        // Scorched 3x3 outline, fading.
        ctx.strokeStyle = `rgba(255, 120, 50, ${0.35 * (1 - t)})`;
        ctx.lineWidth = Math.max(1, tileSize * 0.04);
        ctx.strokeRect(px - tileSize * 1.5, py - tileSize * 1.5, tileSize * 3, tileSize * 3);
        break;
      }
      case "nova":
      case "pulse": {
        const rgb = effect.kind === "nova" ? RGB.frost : RGB.pulse;
        const reach = tileSize * (effect.kind === "nova" ? 1.7 : 1.45);
        const r = reach * easeOut(t);
        ctx.globalCompositeOperation = "lighter";
        const fill = ctx.createRadialGradient(px, py, r * 0.4, px, py, Math.max(1, r));
        fill.addColorStop(0, rgba(rgb, 0));
        fill.addColorStop(1, rgba(rgb, 0.3 * (1 - t)));
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1, r), 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = effect.kind === "nova" ? `rgba(235, 250, 255, ${1 - t})` : `rgba(250, 200, 255, ${1 - t})`;
        ctx.lineWidth = Math.max(2, tileSize * 0.09 * (1 - t) + 1);
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1, r), 0, TAU);
        ctx.stroke();
        if (effect.kind === "nova") {
          // Ice spikes around the rim.
          ctx.fillStyle = `rgba(220, 245, 255, ${0.85 * (1 - t)})`;
          for (let index = 0; index < 12; index += 1) {
            const a = (index / 12) * TAU;
            const base = r * 0.82;
            ctx.beginPath();
            ctx.moveTo(px + Math.cos(a) * (r + tileSize * 0.14), py + Math.sin(a) * (r + tileSize * 0.14));
            ctx.lineTo(px + Math.cos(a + 0.12) * base, py + Math.sin(a + 0.12) * base);
            ctx.lineTo(px + Math.cos(a - 0.12) * base, py + Math.sin(a - 0.12) * base);
            ctx.closePath();
            ctx.fill();
          }
        }
        break;
      }
      case "blink": {
        const from = { x: view.offsetX + (effect.from.x + 0.5) * tileSize, y: view.offsetY + (effect.from.y + 0.5) * tileSize };
        this.glowAt(ctx, from.x, from.y, tileSize * 0.8 * (1 - t), "95, 224, 224", 0.7 * (1 - t));
        this.glowAt(ctx, px, py, tileSize * 0.9 * clamp(t * 3, 0, 1), "232, 255, 255", 0.6 * (1 - t));
        ctx.strokeStyle = `rgba(143, 243, 243, ${0.25 * (1 - t)})`;
        ctx.setLineDash([tileSize * 0.1, tileSize * 0.12]);
        ctx.lineWidth = Math.max(1, tileSize * 0.05);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(px, py);
        ctx.stroke();
        break;
      }
      case "column": {
        // Summon Spire: a shaft of violet light that narrows as it fades.
        const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
        const width = tileSize * 0.7 * (1 - t * 0.6);
        const top = py - tileSize * 2.4;
        ctx.globalCompositeOperation = "lighter";
        const beam = ctx.createLinearGradient(px - width / 2, 0, px + width / 2, 0);
        beam.addColorStop(0, "rgba(176, 108, 255, 0)");
        beam.addColorStop(0.5, `rgba(226, 200, 255, ${0.75 * alpha})`);
        beam.addColorStop(1, "rgba(176, 108, 255, 0)");
        ctx.fillStyle = beam;
        ctx.fillRect(px - width / 2, top, width, py + tileSize * 0.5 - top);
        this.glowAt(ctx, px, py + tileSize * 0.3, tileSize * 0.9, RGB.arcane, 0.6 * alpha);
        break;
      }
      case "shieldUp": {
        const rgb = effect.barrier ? RGB.barrier : RGB.shield;
        const r = tileSize * (0.35 + easeOut(t) * 0.45);
        ctx.strokeStyle = rgba(rgb, 0.9 * (1 - t));
        ctx.lineWidth = Math.max(2, tileSize * 0.08 * (1 - t) + 1);
        ctx.beginPath();
        ctx.ellipse(px, py, r, r * 1.05, 0, 0, TAU);
        ctx.stroke();
        this.glowAt(ctx, px, py, r * 1.3, rgb, 0.4 * (1 - t));
        break;
      }
      default:
        break;
    }
  }

  drawParticles(ctx, view) {
    const { offsetX, offsetY, tileSize } = view;
    const dt = this.dt;
    const keep = [];
    for (const particle of this.particles) {
      particle.age += dt;
      if (particle.age >= particle.life) continue;
      particle.vy += particle.gravity * dt;
      const drag = particle.drag ** (dt * 10);
      particle.vx *= drag;
      particle.vy *= drag;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      keep.push(particle);
      const life = 1 - particle.age / particle.life;
      const px = offsetX + particle.x * tileSize;
      const py = offsetY + particle.y * tileSize;
      const size = Math.max(1, particle.size * tileSize);
      ctx.save();
      ctx.fillStyle = particle.color;
      switch (particle.shape) {
        case "smoke":
          ctx.globalAlpha = life * 0.7;
          ctx.beginPath();
          ctx.arc(px, py, size * (1.6 - life * 0.6), 0, TAU);
          ctx.fill();
          break;
        case "ember":
          ctx.globalAlpha = Math.min(1, life * 1.5);
          ctx.globalCompositeOperation = "lighter";
          ctx.fillRect(px - size / 2, py - size / 2, size, size);
          break;
        case "twinkle": {
          ctx.globalAlpha = life;
          const arm = size * 1.4;
          ctx.fillRect(px - arm, py - size * 0.25, arm * 2, size * 0.5);
          ctx.fillRect(px - size * 0.25, py - arm, size * 0.5, arm * 2);
          break;
        }
        case "shard":
          ctx.globalAlpha = life;
          ctx.translate(px, py);
          ctx.rotate(particle.angle ?? 0);
          ctx.beginPath();
          ctx.moveTo(size * 1.2, 0);
          ctx.lineTo(0, size * 0.4);
          ctx.lineTo(-size * 0.8, 0);
          ctx.lineTo(0, -size * 0.4);
          ctx.closePath();
          ctx.fill();
          break;
        case "streak":
          ctx.globalAlpha = life;
          ctx.strokeStyle = particle.color;
          ctx.lineWidth = Math.max(1, size * 0.6);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - particle.vx * tileSize * 0.04, py - particle.vy * tileSize * 0.04);
          ctx.stroke();
          break;
        default:
          ctx.globalAlpha = life;
          ctx.fillRect(px - size / 2, py - size / 2, size, size);
          break;
      }
      ctx.restore();
    }
    this.particles = keep;
  }

  // ── Actor motion: attack nudges and the Evasive Step leap ──
  // Offsets are cosmetic; the game has already moved the actor. Ids are enemy ids or "player".
  addNudge({ id, toward, kind = "lunge", delay = 0 }) {
    const at = this.locate(id);
    if (!at || !toward) return;
    const dx = toward.x - at.x;
    const dy = toward.y - at.y;
    const length = Math.hypot(dx, dy) || 1;
    this.motions = this.motions ?? [];
    this.motions.push({ id, kind, dirX: dx / length, dirY: dy / length, start: performance.now() + delay, duration: kind === "lunge" ? 190 : 170 });
  }

  addLeap({ from, to, shadow = false }) {
    const start = performance.now();
    const duration = 260;
    this.motions = this.motions ?? [];
    this.motions.push({ id: "player", kind: "leap", from, to, start, duration, shadow });
    this.addEffect({ kind: shadow ? "shadowPuff" : "dust", x: from.x, y: from.y });
    this.addEffect({ kind: shadow ? "shadowPuff" : "dust", x: to.x, y: to.y, delay: duration - 30 });
  }

  // { dx, dy } in tiles to draw an actor at, plus afterimages for a leap in progress.
  getMotion(id) {
    const result = { dx: 0, dy: 0, ghosts: [], ghostColor: null };
    if (!this.motions?.length) return result;
    this.motions = this.motions.filter((motion) => this.now - motion.start < motion.duration);
    for (const motion of this.motions) {
      if (motion.id !== id) continue;
      const t = (this.now - motion.start) / motion.duration;
      if (t < 0) continue;
      if (motion.kind === "leap") {
        const at = (time) => {
          const e = easeOut(clamp(time, 0, 1));
          return { dx: (motion.from.x - motion.to.x) * (1 - e), dy: (motion.from.y - motion.to.y) * (1 - e) - Math.sin(Math.PI * clamp(time, 0, 1)) * 0.45 };
        };
        const now = at(t);
        result.dx += now.dx;
        result.dy += now.dy;
        for (const [lag, alpha] of [[0.14, 0.35], [0.28, 0.18]]) {
          if (t - lag > 0) result.ghosts.push({ ...at(t - lag), alpha });
        }
        result.ghostColor = motion.shadow ? "#5b4a7a" : "#cfe8ff";
      } else {
        const push = Math.sin(Math.PI * t) * (motion.kind === "lunge" ? 0.28 : -0.12);
        result.dx += motion.dirX * push;
        result.dy += motion.dirY * push;
      }
    }
    return result;
  }

  // ── Markers ──
  // The enemy that F (or Aimed Shot) will hit: four gently pulsing corner brackets.
  drawTargetMarker(ctx, px, py, tileSize) {
    const pulse = reduceMotion() ? 0 : Math.sin(this.now / 300) * 0.04;
    const inset = tileSize * (0.02 - pulse);
    const arm = tileSize * 0.22;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 236, 190, 0.85)";
    ctx.lineWidth = Math.max(1.5, tileSize * 0.05);
    for (const [cx, cy, sx, sy] of [[px + inset, py + inset, 1, 1], [px + tileSize - inset, py + inset, -1, 1], [px + inset, py + tileSize - inset, 1, -1], [px + tileSize - inset, py + tileSize - inset, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + sy * arm);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + sx * arm, cy);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Deadeye: a slowly turning red crosshair on enemies low enough for the bonus damage.
  drawDeadeye(ctx, px, py, tileSize) {
    const cx = px + tileSize / 2;
    const cy = py + tileSize / 2;
    const r = tileSize * 0.3;
    const spin = reduceMotion() ? 0 : this.now / 1400;
    ctx.save();
    ctx.strokeStyle = "rgba(255, 80, 70, 0.9)";
    ctx.lineWidth = Math.max(1, tileSize * 0.04);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    for (let index = 0; index < 4; index += 1) {
      const a = spin + (index / 4) * TAU;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55);
      ctx.lineTo(cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Quick Nock momentum: a glowing arrow hovering at the Ranger's side until the next shot spends it.
  drawMomentum(ctx, rect, tileSize, classId) {
    const bob = reduceMotion() ? 0 : Math.sin(this.now / 280) * tileSize * 0.05;
    const x = rect.x + rect.width + tileSize * 0.05;
    const y = rect.y + rect.height * 0.45 + bob;
    ctx.save();
    this.glowAt(ctx, x, y, tileSize * 0.4, "255, 190, 90", 0.55);
    if (classId === "ranger") {
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 2);
      this.drawArrowBody(ctx, tileSize * 0.8, { color: "#ffcf7a", core: "#fff1c2", tip: "#ffd98a", bowTrail: true });
    } else {
      ctx.fillStyle = "#ffcf7a";
      ctx.beginPath();
      ctx.arc(x, y, tileSize * 0.07, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (Math.random() < 6 * this.dt && !reduceMotion()) {
      this.emit({ x: (x - rect.offsetX) / tileSize, y: (y - rect.offsetY) / tileSize, vx: rand(-0.2, 0.2), vy: rand(-0.8, -0.3), life: rand(0.3, 0.5), size: rand(0.02, 0.035), color: "#ffd98a", shape: "ember", drag: 1 });
    }
  }

  // ── Status auras on actors ──
  // Under the sprite: hex runes and a shield's back glow.
  drawAuraBehind(ctx, entity, px, py, tileSize) {
    const statuses = entity.statuses ?? [];
    if (!statuses.length) return;
    const has = (id) => statuses.some((status) => status.id === id);
    ctx.save();
    if (has("hexed")) {
      const spin = reduceMotion() ? 0 : this.now / 900;
      ctx.translate(px + tileSize / 2, py + tileSize * 0.88);
      ctx.scale(1, 0.38);
      ctx.rotate(spin);
      const r = tileSize * 0.42;
      ctx.strokeStyle = rgba(RGB.hex, 0.7);
      ctx.lineWidth = Math.max(1, tileSize * 0.05);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      for (let index = 0; index <= 5; index += 1) {
        const a = (index * 2 * TAU) / 5;
        ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // Over the sprite: frozen ice tint, flames, frost and poison motes, shield bubbles.
  drawAuraFront(ctx, entity, sprite, rect, tileSize) {
    const statuses = entity.statuses ?? [];
    if (!statuses.length) return;
    const find = (id) => statuses.find((status) => status.id === id);
    const cx = rect.x + rect.width / 2;
    const feet = rect.y + rect.height;
    const tileX = (cx - rect.offsetX) / tileSize;
    const tileY = (feet - rect.offsetY) / tileSize;
    const motion = !reduceMotion();
    const chance = (perSecond) => motion && Math.random() < perSecond * this.dt;

    if (find("frozen") && sprite) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.drawImage(this.getTint(sprite, "#9fe6ff"), rect.x, rect.y, rect.width, rect.height);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#ffffff";
      const pixel = Math.max(1, Math.round(tileSize / 16));
      for (const [fx, fy] of [[0.25, 0.3], [0.7, 0.5], [0.45, 0.75]]) ctx.fillRect(Math.round(rect.x + rect.width * fx), Math.round(rect.y + rect.height * fy), pixel, pixel);
      ctx.restore();
    } else if (find("chilled") && chance(3)) {
      this.emit({ x: tileX + rand(-0.3, 0.3), y: tileY - rand(0.6, 1), vx: rand(-0.1, 0.1), vy: rand(0.3, 0.6), life: rand(0.5, 0.8), size: rand(0.02, 0.035), color: "#dff6ff", drag: 1 });
    }

    if (find("burning")) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const flicker = motion ? Math.sin(this.now / 70 + cx) * 0.15 : 0;
      for (const [offset, height, color] of [[-0.18, 0.3, "255, 110, 40"], [0.04, 0.42, "255, 150, 60"], [0.2, 0.26, "255, 90, 30"]]) {
        const fx = cx + offset * tileSize;
        const h = tileSize * height * (1 + flicker);
        const gradient = ctx.createLinearGradient(0, feet, 0, feet - h);
        gradient.addColorStop(0, rgba(color, 0.85));
        gradient.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(fx - tileSize * 0.09, feet);
        ctx.quadraticCurveTo(fx - tileSize * 0.05, feet - h * 0.6, fx, feet - h);
        ctx.quadraticCurveTo(fx + tileSize * 0.05, feet - h * 0.6, fx + tileSize * 0.09, feet);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      if (chance(10)) this.emit({ x: tileX + rand(-0.25, 0.25), y: tileY - rand(0, 0.3), vx: rand(-0.2, 0.2), vy: rand(-1.2, -0.5), life: rand(0.3, 0.6), size: rand(0.025, 0.045), color: Math.random() < 0.5 ? "#ffd25a" : "#ff8a2a", shape: "ember", drag: 1 });
    }

    if (find("poisoned") && chance(2.5)) {
      this.emit({ x: tileX + rand(-0.25, 0.25), y: tileY - rand(0.2, 0.6), vx: 0, vy: rand(-0.5, -0.25), life: rand(0.5, 0.8), size: rand(0.03, 0.05), color: "#7fd36b", drag: 1 });
    }

    const barrier = find("mana_barrier");
    const shield = find("arcane_shield");
    if (barrier || shield) {
      const rgb = barrier ? RGB.barrier : RGB.shield;
      const strength = barrier ? clamp(0.45 + (barrier.value ?? 0) / 30, 0.45, 0.95) : 0.6;
      const shimmer = motion ? Math.sin(this.now / 260) * 0.08 : 0;
      const r = tileSize * 0.62;
      const cy = rect.y + rect.height - tileSize * 0.5;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const fill = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
      fill.addColorStop(0, rgba(rgb, 0));
      fill.addColorStop(1, rgba(rgb, 0.28 * strength));
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 1.08, 0, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = rgba(rgb, (0.55 + shimmer) * strength);
      ctx.lineWidth = Math.max(1, tileSize * 0.045);
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 1.08, 0, 0, TAU);
      ctx.stroke();
      // A glint that travels around the bubble.
      const a = motion ? this.now / 500 : 1;
      ctx.fillStyle = `rgba(235, 245, 255, ${0.8 * strength})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.08, Math.max(1.5, tileSize * 0.05), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // A sprite-shaped silhouette in one colour (cached per image and colour).
  getTint(image, color) {
    let byColor = this.tints.get(image);
    if (!byColor) {
      byColor = new Map();
      this.tints.set(image, byColor);
    }
    if (!byColor.has(color)) {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const tctx = canvas.getContext("2d");
      tctx.drawImage(image, 0, 0);
      tctx.globalCompositeOperation = "source-atop";
      tctx.fillStyle = color;
      tctx.fillRect(0, 0, canvas.width, canvas.height);
      byColor.set(color, canvas);
    }
    return byColor.get(color);
  }
}
