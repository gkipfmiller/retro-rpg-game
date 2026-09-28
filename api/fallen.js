// Fallen adventurers (Vercel serverless function): where delvers died, so other players find their
// remains.
//   GET  /api/fallen?floor=7                    -> recent deaths on Floor 7 (from any run)
//   GET  /api/fallen?floor=7&daily=YYYY-MM-DD   -> deaths on Floor 7 of that day's Daily Descent
//   POST /api/fallen  -> record a death: { name, className, level, floor, x, y, cause, daily? }
//
// Positions only mean something inside the same dungeon, so the game places daily remains exactly
// where they fell and scatters the rest around the floor (see Game.placeFallenRemains).

import { CLASS_NAMES, DAILY_DATE_PATTERN, checkPlayerName, isRecentDailyDate, normalizePlayerName } from "../src/scoreRules.js";
import { isInt, readJsonBody, requireConfig, supabaseError, supabaseHeaders } from "./_supabase.js";

const COLUMNS = "id,name,class_name,level,floor,x,y,cause,daily_date,recorded_at";
const RECENT_LIMIT = 12;
const DAILY_LIMIT = 6;

function toEntry(row) {
  return {
    id: row.id,
    name: row.name,
    className: row.class_name,
    level: row.level,
    floor: row.floor,
    x: row.x,
    y: row.y,
    cause: row.cause,
    daily: row.daily_date ?? null,
    recordedAt: row.recorded_at,
  };
}

function validateDeath(body) {
  if (!body || typeof body !== "object") return { error: "Missing death data." };
  // The name is optional (a delver who never saved a score falls nameless), but it's checked like
  // any leaderboard name when present.
  const name = normalizePlayerName(body.name);
  if (name) {
    const nameProblem = checkPlayerName(name);
    if (nameProblem) return { error: nameProblem };
  }
  const { className, level, floor, x, y } = body;
  if (!CLASS_NAMES.includes(className)) return { error: "Unknown class." };
  if (!isInt(level, 1, 10)) return { error: "Invalid level." };
  if (!isInt(floor, 1, 30)) return { error: "Invalid floor." };
  if (!isInt(x, 0, 255) || !isInt(y, 0, 255)) return { error: "Invalid position." };
  const daily = body.daily ?? null;
  if (daily !== null && !isRecentDailyDate(daily)) return { error: "That Daily Descent has closed." };
  const cause = String(body.cause ?? "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 120);
  return { row: { name, class_name: className, level, floor, x, y, cause, daily_date: daily } };
}

export default async function handler(req, res) {
  const config = requireConfig(res);
  if (!config) return;

  if (req.method === "GET") {
    const floor = Number.parseInt(req.query?.floor, 10);
    const daily = req.query?.daily;
    if (!isInt(floor, 1, 30)) {
      res.status(400).json({ error: "Invalid floor." });
      return;
    }
    if (daily !== undefined && !DAILY_DATE_PATTERN.test(daily)) {
      res.status(400).json({ error: "Invalid daily date." });
      return;
    }
    const filter = daily ? `&daily_date=eq.${daily}` : "";
    const query = `select=${COLUMNS}&floor=eq.${floor}${filter}&order=recorded_at.desc&limit=${daily ? DAILY_LIMIT : RECENT_LIMIT}`;
    const response = await fetch(`${config.url}/rest/v1/fallen?${query}`, { headers: supabaseHeaders(config.key) });
    if (!response.ok) {
      res.status(502).json({ error: "Couldn't find the fallen.", supabase: await supabaseError(response) });
      return;
    }
    const rows = await response.json();
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    res.status(200).json(rows.map(toEntry));
    return;
  }

  if (req.method === "POST") {
    const { error, row } = validateDeath(readJsonBody(req));
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const response = await fetch(`${config.url}/rest/v1/fallen`, {
      method: "POST",
      headers: supabaseHeaders(config.key, { Prefer: "return=minimal" }),
      body: JSON.stringify(row),
    });
    if (!response.ok) {
      res.status(502).json({ error: "Couldn't record the death.", supabase: await supabaseError(response) });
      return;
    }
    res.status(201).json({ ok: true });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed." });
}
