// Combat log entries are { text, turn }. Older saves stored plain strings, so every reader goes
// through logText() / normalizeLogs().

export const MAX_LOG_ENTRIES = 300;

// Checked in order; the first match decides the line's colour and which filter shows it.
const LOG_KINDS = [
  { kind: "miss", pattern: /^You miss |misses you\.$/ },
  { kind: "taken", pattern: /hits you for|casts .+ for \d+ damage|^Poisoned deals|is triggered\.$/ },
  { kind: "kill", pattern: / falls\.$|is defeated|collapses\.|^Patches collapses/ },
  { kind: "dealt", pattern: /^You (critically strike|hit) |takes \d+ (cleave|poison) damage|phantom arrow strikes|^Chain Bolt arcs/ },
  { kind: "heal", pattern: /restores \d+ (HP|mana)|^You recover |Relentless Step|softens the impact|refunds \d+ mana/ },
  { kind: "status", pattern: / is (chilled|hexed|poisoned|sundered|weakened)|^You are (hexed|weakened)|fades from|takes hold|inflicts|repels|shatters|sundered\.$|reeling|chill you|buckles|hexes you|tears through/ },
  { kind: "loot", pattern: /^(Found|Picked up|Bought|Sold|You gather|You uncover|Learned) |opened\. You collect|drops to the floor|unlocks /i },
  { kind: "level", pattern: /^Level \d+\.|^Unlocked |grants |^You descend/ },
];

export const LOG_FILTERS = {
  all: { label: "All", kinds: null },
  combat: { label: "Combat", kinds: ["miss", "taken", "kill", "dealt", "heal", "status"] },
  loot: { label: "Loot", kinds: ["loot", "level"] },
};

export function logText(entry) {
  return typeof entry === "string" ? entry : entry?.text ?? "";
}

export function normalizeLogs(entries = []) {
  return entries.map((entry) => (typeof entry === "string" ? { text: entry, turn: 0 } : entry));
}

export function classifyLog(text) {
  return LOG_KINDS.find((entry) => entry.pattern.test(text))?.kind ?? "info";
}

// Collapses runs of identical consecutive lines into one line with a count.
export function mergeLogEntries(entries) {
  const merged = [];
  for (const entry of entries) {
    const text = logText(entry);
    const last = merged[merged.length - 1];
    if (last && last.text === text) {
      last.count += 1;
      last.turn = entry.turn ?? last.turn;
      continue;
    }
    merged.push({ text, turn: entry.turn ?? 0, count: 1, kind: classifyLog(text) });
  }
  return merged;
}
