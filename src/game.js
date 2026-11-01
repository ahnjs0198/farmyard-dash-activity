// Farmyard Dash: monochrome pixel runner. A 300x100 world drawn at 3x.
// createGame(canvas, { onOver(score, ms) }) returns { setHi(n) }.

export function createGame(cv, { onOver = () => {} } = {}) {
  const ctx = cv.getContext("2d");
  const S = 3, W = 300, H = 100, GY = 82;
  ctx.imageSmoothingEnabled = false;
  let hi = 0;
  try { hi = +localStorage.getItem("fd-hi") || 0; } catch (e) {}
  const pad = (n) => String(Math.floor(n)).padStart(5, "0");

  let C = {};
  const readC = () => {
    const cs = getComputedStyle(document.documentElement);
    C = { bg: cs.getPropertyValue("--stage").trim(), ink: cs.getPropertyValue("--ink").trim(), far: cs.getPropertyValue("--far").trim() };
  };
  readC();
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", readC);
  new MutationObserver(readC).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  const strip = [];
  for (let x = 0; x < 600; x += 2) {
    const r = Math.random();
    if (r < 0.06) strip.push([x, GY - 1, 2 + Math.floor(Math.random() * 3), 1]);
    else if (r < 0.3) strip.push([x, GY + 2 + Math.floor(Math.random() * 5), 1 + (Math.random() < 0.3 ? 1 : 0), 1]);
  }
  const stars = Array.from({ length: 14 }, () => ({ x: Math.floor(Math.random() * W), y: 5 + Math.floor(Math.random() * 40) }));

  let state = "ready", pig, obs, clouds, speed, score, spawnT, t, held, flash, bgX, hitBy, night, nightAt, startAt;
  function reset() {
    pig = { x: 14, y: GY, vy: 0, on: true };
    obs = []; speed = 2.2; score = 0; spawnT = 50; t = 0; flash = 0; bgX = 0; hitBy = ""; night = false; nightAt = 700;
    cv.classList.remove("night");
    clouds = Array.from({ length: 3 }, (_, i) => ({ x: i * 110 + 60, y: 12 + Math.floor(Math.random() * 20) }));
  }
  reset();

  function jump() {
    if (state !== "run") {
      if (state === "over" && t < 25) return;
      reset(); state = "run"; startAt = performance.now();
    }
    if (pig.on) { pig.vy = -4.5; pig.on = false; }
  }
  const down = () => { held = true; jump(); }, up = () => { held = false; };
  cv.addEventListener("pointerdown", (e) => { e.preventDefault(); cv.focus({ focusVisible: false }); down(); });
  addEventListener("pointerup", up);
  addEventListener("pointercancel", up);
  const K = ["Space", "ArrowUp", "KeyW"];
  addEventListener("keydown", (e) => { if (K.includes(e.code)) { e.preventDefault(); if (!e.repeat) down(); } });
  addEventListener("keyup", (e) => { if (K.includes(e.code)) up(); });

  function spawn() {
    const r = Math.random(), s = Math.random() * 10;
    if (score > 150 && r < 0.22) {
      obs.push({ k: "goose", x: W + 6 + speed * 22, y: GY - 30, w: 17, h: 8, s });
      spawnT = Math.max(70, (95 + Math.random() * 50) * (2.2 / speed)); return;
    }
    if (r < 0.5) obs.push({ k: "sheep", x: W + 6, y: GY - 14, w: 18, h: 14, s });
    else if (r < 0.75) { const n = score > 300 && Math.random() < 0.5 ? 3 : 2; obs.push({ k: "hens", x: W + 6, y: GY - 8, w: n * 9 - 2, h: 8, n, s }); }
    else { const tall = score > 250 && Math.random() < 0.4; obs.push({ k: "hay", x: W + 6, y: GY - (tall ? 20 : 10), w: 13, h: tall ? 20 : 10, tall, s }); }
    spawnT = Math.max(40, (70 + Math.random() * 60) * (2.2 / speed));
  }
  const hit = (p, o) => { const L = p.x + 4, R = p.x + 21, T = p.y - 12, B = p.y; return L < o.x + o.w - 1 && R > o.x + 1 && T < o.y + o.h - 1 && B > o.y + 1; };

  function step() {
    t++;
    if (state === "run") {
      speed = Math.min(5, 2.2 + score / 650);
      score += speed * 0.18; bgX += speed;
      pig.vy += held && pig.vy < 0 ? 0.18 : 0.32; pig.y += pig.vy;
      if (pig.y >= GY) { pig.y = GY; pig.vy = 0; pig.on = true; }
      if (--spawnT <= 0) spawn();
      for (const o of obs) o.x -= speed * (o.k === "goose" ? 1.12 : 1);
      obs = obs.filter((o) => o.x + o.w > -10);
      for (const c of clouds) { c.x -= speed * 0.15; if (c.x < -20) { c.x = W + Math.random() * 80; c.y = 12 + Math.floor(Math.random() * 20); } }
      if (Math.floor(score) % 100 === 0 && Math.floor(score) > 0 && flash <= 0) flash = 60;
      if (flash > 0) flash--;
      if (score >= nightAt) { night = !night; cv.classList.toggle("night", night); nightAt += night ? 250 : 450; }
      for (const o of obs) if (hit(pig, o)) {
        state = "over"; t = 0; hitBy = o.k;
        const final = Math.floor(score);
        if (final > hi) { hi = final; try { localStorage.setItem("fd-hi", hi); } catch (e) {} }
        onOver(final, Math.round(performance.now() - startAt));
        break;
      }
    }
    draw();
    requestAnimationFrame(step);
  }

  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x) * S, Math.round(y) * S, w * S, h * S); };
  const mod = (a, n) => ((a % n) + n) % n;

  function barn(x) { const F = C.far, B = C.bg;
    r(x, GY - 22, 40, 22, F); r(x - 2, GY - 24, 44, 2, F); r(x + 2, GY - 27, 36, 3, F); r(x + 6, GY - 30, 28, 3, F);
    r(x + 13, GY - 14, 14, 14, B); r(x + 19, GY - 14, 2, 14, F); r(x + 13, GY - 8, 14, 1, F); r(x + 17, GY - 21, 6, 4, B);
    r(x + 46, GY - 34, 10, 34, F); r(x + 47, GY - 36, 8, 2, F); r(x + 49, GY - 37, 4, 1, F); r(x + 46, GY - 26, 10, 1, B); r(x + 46, GY - 16, 10, 1, B);
  }
  function windmill(x) { const F = C.far;
    r(x - 1, GY - 28, 3, 28, F); r(x - 2, GY - 14, 5, 14, F); r(x - 1, GY - 31, 3, 3, F);
    if (Math.floor(t / 12) % 2) { r(x - 9, GY - 30, 19, 1, F); r(x, GY - 39, 1, 19, F); }
    else for (let i = -7; i <= 7; i++) { r(x + i, GY - 30 + i, 1, 1, F); r(x + i, GY - 30 - i, 1, 1, F); }
  }
  function tree(x) { const F = C.far; r(x, GY - 10, 2, 10, F); r(x - 5, GY - 20, 12, 8, F); r(x - 3, GY - 22, 8, 2, F); r(x - 3, GY - 12, 8, 2, F); }
  function fence() { const F = C.far, off = mod(Math.floor(bgX * 0.6), 18);
    r(0, GY - 6, W, 1, F); r(0, GY - 3, W, 1, F); for (let x = -off; x < W + 18; x += 18) r(x, GY - 8, 2, 8, F); }
  function cloud(c) { const F = C.far; r(c.x + 4, c.y, 6, 1, F); r(c.x + 2, c.y + 1, 2, 1, F); r(c.x + 10, c.y + 1, 2, 1, F); r(c.x, c.y + 2, 2, 1, F); r(c.x + 12, c.y + 2, 3, 1, F); r(c.x, c.y + 3, 15, 1, F); }

  function drawPig(x, y, dead) { const I = C.ink, B = C.bg, top = Math.round(y) - 13, air = !pig.on, run = state === "run" && !air, ph = Math.floor(t / 5) % 2;
    r(x, top + 2, 1, 1, I); r(x + 1, top + 3, 2, 1, I);
    r(x + 3, top + 3, 13, 7, I); r(x + 4, top + 2, 11, 1, I); r(x + 4, top + 10, 11, 1, I);
    r(x + 14, top + 1, 6, 8, I); r(x + 15, top, 4, 1, I);
    r(x + 15, top - 1, 1, 1, I); r(x + 18, top - 1, 1, 1, I);
    r(x + 20, top + 3, 2, 4, I); r(x + 21, top + 4, 1, 1, B);
    if (dead) { r(x + 16, top + 2, 3, 3, B); r(x + 17, top + 3, 1, 1, I); } else r(x + 17, top + 2, 1, 2, B);
    const L = (lx, h) => r(x + lx, top + 11, 2, h, I);
    if (air || !run) { L(5, 2); L(8, 2); L(12, 2); L(15, 2); }
    else if (ph) { L(5, 2); L(8, 1); L(12, 2); L(15, 1); }
    else { L(5, 1); L(8, 2); L(12, 1); L(15, 2); }
  }
  function drawSheep(o) { const I = C.ink, B = C.bg, x = o.x, top = o.y, b = Math.floor((t + o.s * 10) / 16) % 2;
    r(x + 4, top + 2 + b, 13, 8, I); r(x + 5, top + 1 + b, 4, 1, I); r(x + 10, top + b, 5, 2, I); r(x + 3, top + 4 + b, 1, 5, I); r(x + 17, top + 3 + b, 1, 6, I); r(x + 5, top + 10 + b, 11, 1, I);
    r(x + 7, top + 4 + b, 1, 1, B); r(x + 12, top + 3 + b, 1, 1, B); r(x + 14, top + 7 + b, 1, 1, B); r(x + 9, top + 7 + b, 1, 1, B);
    r(x, top + 3 + b, 4, 5, I); r(x + 1, top + 2 + b, 3, 1, I); r(x + 1, top + 4 + b, 1, 1, B);
    r(x + 6, top + 11, 2, 3, I); r(x + 14, top + 11, 2, 3, I);
  }
  function drawHens(o) { const I = C.ink, B = C.bg;
    for (let i = 0; i < o.n; i++) { const x = o.x + i * 9, top = o.y, peck = Math.floor((t + o.s * 10 + i * 13) / 12) % 3 === 0;
      r(x + 2, top + 3, 5, 3, I); r(x + 6, top + 1, 1, 3, I); r(x + 5, top + 2, 1, 1, I);
      if (peck) { r(x, top + 3, 2, 2, I); r(x - 1, top + 4, 1, 1, I); } else { r(x + 1, top, 2, 3, I); r(x, top + 1, 1, 1, I); r(x + 1, top - 1, 1, 1, I); r(x + 1, top + 1, 1, 1, B); }
      r(x + 3, top + 6, 1, 2, I); r(x + 5, top + 6, 1, 2, I);
    }
  }
  function drawHay(o) { const I = C.ink, B = C.bg;
    const one = (x, y) => { r(x, y, 13, 10, I); r(x + 3, y + 1, 1, 8, B); r(x + 9, y + 1, 1, 8, B); r(x + 5, y + 3, 2, 1, B); r(x + 6, y + 6, 2, 1, B); r(x + 11, y + 4, 1, 1, B); r(x + 1, y + 6, 1, 1, B); };
    if (o.tall) { one(o.x, o.y + 10); one(o.x + 1, o.y); } else one(o.x, o.y);
  }
  function drawGoose(o) { const I = C.ink, B = C.bg, x = o.x, top = o.y + 2, upw = Math.floor((t + o.s * 10) / 8) % 2;
    r(x + 4, top + 3, 10, 3, I); r(x + 5, top + 6, 8, 1, I); r(x + 14, top + 2, 2, 2, I);
    r(x + 2, top + 1, 2, 3, I); r(x, top, 3, 2, I); r(x - 2, top + 1, 2, 1, I); r(x + 1, top, 1, 1, B);
    if (upw) { r(x + 7, top, 5, 3, I); r(x + 8, top - 2, 4, 2, I); r(x + 9, top - 3, 2, 1, I); } else { r(x + 7, top + 6, 5, 2, I); r(x + 8, top + 8, 4, 1, I); }
  }
  const DRAW = { sheep: drawSheep, hens: drawHens, hay: drawHay, goose: drawGoose };

  function text(s, x, y, size, align) {
    ctx.font = `${size * S}px "Press Start 2P", monospace`; ctx.textAlign = align; ctx.textBaseline = "top"; ctx.fillStyle = C.ink;
    ctx.fillText(s, x * S, y * S);
  }
  function restartIcon(cx, cy) { const I = C.ink;
    r(cx - 5, cy - 4, 3, 9, I); r(cx - 3, cy - 6, 7, 3, I); r(cx + 4, cy - 6, 3, 3, I); r(cx + 2, cy + 3, 4, 3, I); r(cx - 3, cy + 3, 7, 3, I); r(cx + 5, cy - 1, 2, 3, I);
    r(cx + 1, cy - 9, 1, 7, I); r(cx + 2, cy - 8, 1, 5, I); r(cx + 3, cy - 7, 1, 3, I);
  }

  function draw() {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W * S, H * S);
    if (night) { for (const s of stars) if ((t + s.x * 7) % 120 < 100) r(s.x, s.y, 1, 1, C.ink);
      r(250, 10, 6, 10, C.ink); r(249, 12, 1, 6, C.ink); r(252, 11, 4, 8, C.bg); }
    for (const c of clouds) cloud(c);
    const span = 320, off = mod(Math.floor(bgX * 0.3), span);
    for (let k = -1; k < 2; k++) { const b = k * span - off; barn(b + 40); windmill(b + 170); tree(b + 250); }
    fence();
    r(0, GY, W, 1, C.ink);
    const go = mod(Math.floor(bgX), 600);
    for (const [x, y, w, h] of strip) { const X = mod(x - go, 600); if (X < W + 4) r(X, y, w, h, C.ink); }
    for (const o of obs) DRAW[o.k](o);
    drawPig(pig.x, pig.y, state === "over");
    const blink = flash > 0 && Math.floor(flash / 8) % 2;
    text((hi ? "HI " + pad(hi) + "  " : "") + (blink ? "     " : pad(score)), W - 4, 4, 5, "right");
    if (state === "ready") text("TAP TO START", W / 2, 30, 6, "center");
    if (state === "over") {
      text("G A M E  O V E R", W / 2, 26, 6, "center");
      restartIcon(W / 2, 48);
      text({ sheep: "baaa!", hens: "bawk!", hay: "thud!", goose: "honk!" }[hitBy] || "", pig.x + 24, GY - 26, 4, "left");
    }
  }
  requestAnimationFrame(step);

  return { setHi(n) { if (n > hi) hi = n; } };
}
