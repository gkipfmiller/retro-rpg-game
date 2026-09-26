// Runs the real game logic in Node for the balance simulator. The game only touches the browser
// through window.localStorage (saves, high scores, boss memory), so an in-memory stub is enough.
// The renderer and sound player stay unattached; the game calls them with optional chaining.

const memoryStorage = new Map();
globalThis.window = globalThis.window ?? {
  localStorage: {
    getItem: (key) => (memoryStorage.has(key) ? memoryStorage.get(key) : null),
    setItem: (key, value) => memoryStorage.set(key, String(value)),
    removeItem: (key) => memoryStorage.delete(key),
  },
};

const { Game } = await import("../../src/game.js");
const data = await import("../../src/data.js");
const utils = await import("../../src/utils.js");

// Starts a run with a fixed seed. The game derives its run seed from the clock, so the clock is
// pinned for that one call; everything after that (floors, combat rolls) follows from the seed.
export function startSeededRun(classId, seed) {
  const game = new Game();
  const realNow = Date.now;
  Date.now = () => seed;
  try {
    game.startRun(classId);
  } finally {
    Date.now = realNow;
  }
  // Boss memory persists across runs in the real game; simulated runs must not influence each other.
  memoryStorage.clear();
  return game;
}

export { Game, data, utils };
