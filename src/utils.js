export function createRng(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick(list) {
      return list[this.int(0, list.length - 1)];
    },
    chance(probability) {
      return this.next() < probability;
    },
    shuffle(list) {
      const copy = [...list];
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(this.next() * (index + 1));
        [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
      }
      return copy;
    },
  };
}

export function hashSeed(...parts) {
  let hash = 2166136261;
  for (const part of parts) {
    const text = String(part);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }
  return hash >>> 0;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function toKey(x, y) {
  return `${x},${y}`;
}

export function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function deepClone(value) {
  return structuredClone(value);
}
