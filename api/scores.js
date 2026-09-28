// Shared leaderboard (Vercel serverless function).
//   GET  /api/scores?limit=20  -> the top scores, best first
//   POST /api/scores           -> record a run: { name, className, result, cause, floor, level, kills, gold, turns }
//
// Talks to Supabase with the service-role key, which never reaches the browser. Needs these Vercel
// environment variables (set by this project's Supabase integration):
//   D30_SUPABASE_URL                  e.g. https://abcd1234.supabase.co
//   D30_SUPABASE_SERVICE_ROLE_KEY     the project's service_role secret
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY also work.)
// The table and its security settings are in tools/supabase/scores.sql.
//
// The server recomputes each score from the run's numbers and checks every field's range, so a
// tampered request can't post an impossible score. It can't prove a run really happened; that
// would need the server to replay runs.

import { CLASS_NAMES, RUN_RESULTS, calculateScore, checkPlayerName, normalizePlayerName } from "../src/scoreRules.js";

const MAX_LIMIT = 50;
const COLUMNS = "name,score,floor,level,kills,gold,turns,class_name,cause,result,recorded_at";

function supabaseConfig() {
  // This project's Vercel integration uses a "D30_" prefix; the plain names are a fallback.
  const url = process.env.D30_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.D30_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.trim().replace(/\/$/, ""), key: key.trim() };
}

// Legacy Supabase keys are JWTs ("eyJ...") and go in both headers. Newer secret keys ("sb_secret_...")
// are not JWTs and must only be sent as apikey; Supabase rejects them as a Bearer token.
function supabaseHeaders(key, extra = {}) {
  const headers = { apikey: key, "Content-Type": "application/json", ...extra };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

// Supabase's own explanation of a failed request (never includes the key), to make setup problems
// visible in the response and in the Vercel function logs.
async function supabaseError(response) {
  let detail = "";
  try {
    const body = await response.json();
    detail = [body.message, body.hint, body.code].filter(Boolean).join(" | ");
  } catch {
    detail = response.statusText;
  }
  console.error(`Supabase ${response.status}: ${detail}`);
  return { status: response.status, detail };
}

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
  };
}

const isInt = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

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
    },
  };
}

export default async function handler(req, res) {
  const config = supabaseConfig();
  if (!config) {
    res.status(503).json({ error: "The leaderboard isn't configured." });
    return;
  }
  if (!/^https:\/\//.test(config.url)) {
    // A common mix-up: the Postgres connection string instead of the project's https API URL.
    res.status(503).json({ error: "D30_SUPABASE_URL must be the project's https URL (e.g. https://abcd1234.supabase.co)." });
    return;
  }

  if (req.method === "GET") {
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(req.query?.limit, 10) || 20));
    const query = `select=${COLUMNS}&order=score.desc,floor.desc,kills.desc,recorded_at.asc&limit=${limit}`;
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
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = null;
      }
    }
    const { error, row } = validateRun(body);
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
