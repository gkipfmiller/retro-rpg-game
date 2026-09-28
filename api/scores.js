// Shared leaderboard (Vercel serverless function).
//   GET  /api/scores?limit=20                   -> the top scores, best first
//   GET  /api/scores?limit=20&daily=YYYY-MM-DD  -> the top scores for that day's Daily Descent
//   POST /api/scores  -> record a run: { name, className, result, cause, floor, level, kills, gold, turns, daily? }
//
// Talks to Supabase with the service-role key, which never reaches the browser (see _supabase.js).
//
// The server recomputes each score from the run's numbers and checks every field's range, so a
// tampered request can't post an impossible score. It can't prove a run really happened; that
// would need the server to replay runs.

import { CLASS_NAMES, DAILY_DATE_PATTERN, RUN_RESULTS, calculateScore, checkPlayerName, isRecentDailyDate, normalizePlayerName } from "../src/scoreRules.js";
import { isInt, readJsonBody, requireConfig, supabaseError, supabaseHeaders } from "./_supabase.js";

const MAX_LIMIT = 50;
const COLUMNS = "name,score,floor,level,kills,gold,turns,class_name,cause,result,recorded_at,daily_date";

// Database rows use snake_case; the game uses camelCase.
function toEntry(row) {
  return {
    name: row.name,
    score: row.score,
    floor: row.floor,
    level: row.level,
    kills: row.kills,
    gold: row.gold,
    turns: row.turns,
    className: row.class_name,
    cause: row.cause,
    result: row.result,
    recordedAt: row.recorded_at,
    daily: row.daily_date ?? null,
  };
}

// Returns { error } or { row } ready to insert.
function validateRun(body) {
  if (!body || typeof body !== "object") return { error: "Missing run data." };
  const name = normalizePlayerName(body.name);
  const nameProblem = checkPlayerName(name);
  if (nameProblem) return { error: nameProblem };
  const { className, result, floor, level, kills, gold, turns } = body;
  if (!CLASS_NAMES.includes(className)) return { error: "Unknown class." };
  if (!RUN_RESULTS.includes(result)) return { error: "Unknown result." };
  if (!isInt(floor, 0, 30) || (result === "victory" && floor !== 30)) return { error: "Invalid floor." };
  if (!isInt(level, 1, 10)) return { error: "Invalid level." };
  if (!isInt(kills, 0, 3000)) return { error: "Invalid kill count." };
  if (!isInt(gold, 0, 50000)) return { error: "Invalid gold." };
  if (!isInt(turns, 0, 500000)) return { error: "Invalid turn count." };
  // Daily scores are only taken while that day's dungeon is current.
  const daily = body.daily ?? null;
  if (daily !== null && !isRecentDailyDate(daily)) return { error: "That Daily Descent has closed." };
  const cause = String(body.cause ?? "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 120);
  return {
    row: {
      name,
      score: calculateScore({ floor, level, kills, gold, result }),
      floor,
      level,
      kills,
      gold,
      turns,
      class_name: className,
      cause,
      result,
      daily_date: daily,
    },
  };
}

export default async function handler(req, res) {
  const config = requireConfig(res);
  if (!config) return;

  if (req.method === "GET") {
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(req.query?.limit, 10) || 20));
    const daily = req.query?.daily;
    if (daily !== undefined && !DAILY_DATE_PATTERN.test(daily)) {
      res.status(400).json({ error: "Invalid daily date." });
      return;
    }
    const filter = daily ? `&daily_date=eq.${daily}` : "";
    const query = `select=${COLUMNS}${filter}&order=score.desc,floor.desc,kills.desc,recorded_at.asc&limit=${limit}`;
    const response = await fetch(`${config.url}/rest/v1/scores?${query}`, { headers: supabaseHeaders(config.key) });
    if (!response.ok) {
      res.status(502).json({ error: "Couldn't load the leaderboard.", supabase: await supabaseError(response) });
      return;
    }
    const rows = await response.json();
    // A short shared cache keeps a busy leaderboard cheap without going stale for long.
    res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");
    res.status(200).json(rows.map(toEntry));
    return;
  }

  if (req.method === "POST") {
    const { error, row } = validateRun(readJsonBody(req));
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const response = await fetch(`${config.url}/rest/v1/scores`, {
      method: "POST",
      headers: supabaseHeaders(config.key, { Prefer: "return=minimal" }),
      body: JSON.stringify(row),
    });
    if (!response.ok) {
      res.status(502).json({ error: "Couldn't save the score.", supabase: await supabaseError(response) });
      return;
    }
    res.status(201).json({ ok: true, entry: toEntry({ ...row, recorded_at: new Date().toISOString() }) });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "Method not allowed." });
}
