// Entry point: connects to Discord when running as an Activity, then runs the game
// and posts each finished run to the server leaderboard.
// Opened in a normal browser (no frame_id in the URL) it runs offline with a local best.
import { DiscordSDK } from "@discord/embedded-app-sdk";
import { createGame } from "./game.js";

const inDiscord = new URLSearchParams(location.search).has("frame_id");
const API = inDiscord ? "/.proxy/api" : "/api";

const $status = document.getElementById("status");
const $scope = document.getElementById("scope");
const $list = document.getElementById("board");
const $empty = document.getElementById("empty");
const setStatus = (msg) => { $status.textContent = msg; };

let session = null; // { token, userId, scope }

async function api(path, opts = {}) {
  const r = await fetch(API + path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

function render(top) {
  $list.replaceChildren();
  $empty.hidden = top.length > 0;
  top.forEach((row, i) => {
    const li = document.createElement("li");
    if (session && row.user_id === session.userId) li.className = "me";
    const rank = document.createElement("span"); rank.className = "rank"; rank.textContent = String(i + 1).padStart(2, "0");
    const name = document.createElement("span"); name.className = "name"; name.textContent = row.name;
    const best = document.createElement("span"); best.className = "best"; best.textContent = String(row.best).padStart(5, "0");
    li.append(rank, name, best);
    $list.append(li);
  });
}

async function connect() {
  if (!inDiscord) {
    setStatus("Offline mode. Open this as a Discord Activity to join the server leaderboard.");
    $scope.textContent = "Not connected";
    return;
  }
  setStatus("Connecting to Discord…");
  const { clientId } = await api("/config");
  const sdk = new DiscordSDK(clientId);
  await sdk.ready();
  const { code } = await sdk.commands.authorize({
    client_id: clientId, response_type: "code", state: "", prompt: "none", scope: ["identify"],
  });
  const { access_token } = await api("/token", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }),
  });
  const auth = await sdk.commands.authenticate({ access_token });
  const scope = sdk.guildId ? `g:${sdk.guildId}` : `c:${sdk.channelId}`;
  session = { token: access_token, userId: auth.user.id, scope };
  const name = auth.user.global_name || auth.user.username;
  $scope.textContent = sdk.guildId ? "This server" : "This chat";
  setStatus(`Playing as ${name}`);
  const { top } = await api(`/leaderboard?scope=${encodeURIComponent(scope)}`);
  render(top);
  const mine = top.find((r) => r.user_id === session.userId);
  if (mine) game.setHi(mine.best);
}

async function submit(score, ms) {
  if (!session) return;
  try {
    const res = await api("/score", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.token}` },
      body: JSON.stringify({ scope: session.scope, score, ms }),
    });
    render(res.top);
    setStatus(res.newBest ? `New best: ${res.best} · rank #${res.rank}` : `Best ${res.best} · rank #${res.rank}`);
  } catch (e) {
    setStatus(`Score not saved: ${e.message}`);
  }
}

const game = createGame(document.getElementById("c"), { onOver: submit });
connect().catch((e) => {
  console.error(e);
  setStatus(`Couldn't connect to Discord (${e.message}). You can still play; scores stay on this device.`);
});
