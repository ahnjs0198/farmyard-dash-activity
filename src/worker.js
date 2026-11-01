// Farmyard Dash Activity backend.
// Static files in ./public are served by Workers Assets before this code runs;
// anything else (the /api routes, and /.proxy/* paths from Discord) lands here.

const DISCORD_API = "https://discord.com/api/v10";
const SCOPE_RE = /^(g|c):\d{5,25}$/;     // g:<guild id> or c:<channel id> (DMs)
const MAX_POINTS_PER_SEC = 56;            // the game tops out near 54 points per second
const MIN_SUBMIT_GAP_MS = 2500;           // one run cannot end faster than this

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    // Discord's proxy may forward "/.proxy/..." unchanged; treat it the same as the bare path.
    let path = url.pathname.startsWith("/.proxy/") ? url.pathname.slice(7) : url.pathname;

    if (!path.startsWith("/api/")) {
      const u = new URL(req.url);
      u.pathname = path;
      return env.ASSETS.fetch(new Request(u, req));
    }

    try {
      if (path === "/api/config" && req.method === "GET") return json({ clientId: env.DISCORD_CLIENT_ID });
      if (path === "/api/token" && req.method === "POST") return await token(req, env);
      if (path === "/api/leaderboard" && req.method === "GET") return await leaderboard(url, env);
      if (path === "/api/score" && req.method === "POST") return await submit(req, env);
      return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: "Server error. Try again in a moment." }, 500);
    }
  },
};

// Swap the one-time OAuth code from the Activity for an access token.
// The client secret never leaves the Worker.
async function token(req, env) {
  const { code } = await req.json().catch(() => ({}));
  if (typeof code !== "string" || !code) return json({ error: "Missing code" }, 400);
  const r = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) return json({ error: "Discord rejected the login code" }, 401);
  return json({ access_token: data.access_token });
}

async function top(env, scope, limit = 10) {
  const { results } = await env.DB.prepare(
    "SELECT user_id, name, best, plays FROM scores WHERE scope = ? ORDER BY best DESC, name ASC LIMIT ?"
  ).bind(scope, limit).all();
  return results;
}

async function leaderboard(url, env) {
  const scope = url.searchParams.get("scope") || "";
  if (!SCOPE_RE.test(scope)) return json({ error: "Bad scope" }, 400);
  return json({ top: await top(env, scope) });
}

// Record a finished run. The player is identified by asking Discord who owns the token,
// so nobody can post a score under someone else's name.
async function submit(req, env) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Sign in through Discord first" }, 401);
  const body = await req.json().catch(() => ({}));
  const scope = String(body.scope || "");
  const score = Math.floor(Number(body.score));
  const ms = Math.floor(Number(body.ms));
  if (!SCOPE_RE.test(scope)) return json({ error: "Bad scope" }, 400);
  if (!Number.isFinite(score) || score < 0 || !Number.isFinite(ms) || ms <= 0)
    return json({ error: "Bad score" }, 400);
  // Plausibility check: a run can only earn so many points per second.
  if (score > (ms / 1000) * MAX_POINTS_PER_SEC + 20 || score > 999999)
    return json({ error: "Score rejected" }, 422);

  const me = await fetch(`${DISCORD_API}/users/@me`, { headers: { authorization: auth } });
  if (!me.ok) return json({ error: "Your Discord session expired. Reopen the Activity." }, 401);
  const user = await me.json();
  const name = (user.global_name || user.username || "player").slice(0, 32);
  const now = Date.now();

  const prev = await env.DB.prepare("SELECT best, updated_at FROM scores WHERE scope = ? AND user_id = ?")
    .bind(scope, user.id).first();
  if (prev && now - prev.updated_at < MIN_SUBMIT_GAP_MS) return json({ error: "Too fast" }, 429);

  await env.DB.prepare(
    `INSERT INTO scores (scope, user_id, name, best, plays, updated_at) VALUES (?, ?, ?, ?, 1, ?)
     ON CONFLICT(scope, user_id) DO UPDATE SET
       best = MAX(best, excluded.best), name = excluded.name, plays = plays + 1, updated_at = excluded.updated_at`
  ).bind(scope, user.id, name, score, now).run();

  const best = Math.max(score, prev?.best ?? 0);
  const { above } = await env.DB.prepare("SELECT COUNT(*) AS above FROM scores WHERE scope = ? AND best > ?")
    .bind(scope, best).first();
  return json({ best, rank: above + 1, newBest: score > (prev?.best ?? -1), top: await top(env, scope) });
}
