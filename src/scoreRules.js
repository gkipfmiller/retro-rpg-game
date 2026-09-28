// High-score rules shared by the game (src/game.js) and the leaderboard API (api/scores.js), so the
// server checks a run exactly the way the game scores it.

export const BLOCKED_NAME_TERMS = [
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "fag", "faggot", "slut",
  "whore", "asshole", "motherfucker", "dick", "cock", "pussy", "penis", "vagina",
  "rape", "rapist", "cum", "jizz", "tits",
];

export const CLASS_NAMES = ["Warrior", "Sorceress", "Ranger"];
export const RUN_RESULTS = ["death", "victory"];
export const NAME_MAX_LENGTH = 18;

// Trim, collapse whitespace, drop control characters, and cap the length.
export function normalizePlayerName(name) {
  return String(name ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, NAME_MAX_LENGTH);
}

export function containsBlockedNameTerm(name) {
  const normalized = String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
  return BLOCKED_NAME_TERMS.some((term) => normalized.includes(term));
}

// "" when the name is fine, otherwise the message to show.
export function checkPlayerName(name) {
  if (name.length < 2) return "Enter a name with at least 2 characters.";
  if (containsBlockedNameTerm(name)) return "That name is not allowed. Choose something else.";
  return "";
}

export function calculateScore({ floor, level, kills, gold, result }) {
  return (floor * 120) + (level * 90) + (kills * 12) + gold + (result === "victory" ? 1500 : 0);
}
