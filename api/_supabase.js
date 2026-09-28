// Supabase helpers shared by the API functions. (Vercel doesn't turn files starting with "_" into
// endpoints.) Needs these Vercel environment variables, set by this project's Supabase integration:
//   D30_SUPABASE_URL                  e.g. https://abcd1234.supabase.co
//   D30_SUPABASE_SERVICE_ROLE_KEY     the project's service_role secret
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY also work.)
// The tables and their security settings are in tools/supabase/scores.sql.

export function supabaseConfig() {
  // This project's Vercel integration uses a "D30_" prefix; the plain names are a fallback.
  const url = process.env.D30_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.D30_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.trim().replace(/\/$/, ""), key: key.trim() };
}

// Legacy Supabase keys are JWTs ("eyJ...") and go in both headers. Newer secret keys ("sb_secret_...")
// are not JWTs and must only be sent as apikey; Supabase rejects them as a Bearer token.
export function supabaseHeaders(key, extra = {}) {
  const headers = { apikey: key, "Content-Type": "application/json", ...extra };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

// Supabase's own explanation of a failed request (never includes the key), to make setup problems
// visible in the response and in the Vercel function logs.
export async function supabaseError(response) {
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

// The config, or null after answering with the reason it's unusable.
export function requireConfig(res) {
  const config = supabaseConfig();
  if (!config) {
    res.status(503).json({ error: "The leaderboard isn't configured." });
    return null;
  }
  if (!/^https:\/\//.test(config.url)) {
    // A common mix-up: the Postgres connection string instead of the project's https API URL.
    res.status(503).json({ error: "D30_SUPABASE_URL must be the project's https URL (e.g. https://abcd1234.supabase.co)." });
    return null;
  }
  return config;
}

export function readJsonBody(req) {
  if (typeof req.body !== "string") return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return null;
  }
}

export const isInt = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
