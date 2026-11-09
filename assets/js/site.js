(function () {
  "use strict";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- YouTube click-to-load ---------- */
  document.querySelectorAll(".video[data-yt]").forEach(function (box) {
    var btn = box.querySelector("button");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var id = box.getAttribute("data-yt");
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0";
      f.title = btn.getAttribute("aria-label") || "Gameplay video";
      f.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
      f.allowFullscreen = true;
      box.innerHTML = "";
      box.appendChild(f);
    });
  });

  /* ---------- code highlighting (highlight.js loaded on case pages) ---------- */
  if (window.hljs) {
    document.querySelectorAll("pre code").forEach(function (el) { window.hljs.highlightElement(el); });
  }

  /* ---------- live GitHub repositories ---------- */
  var repoList = document.getElementById("repo-list");
  if (repoList && window.fetch) {
    var user = repoList.getAttribute("data-user");
    fetch("https://api.github.com/users/" + user + "/repos?sort=pushed&per_page=8")
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (repos) {
        if (!Array.isArray(repos) || !repos.length) return;
        var frag = document.createDocumentFragment();
        repos.forEach(function (repo) {
          var a = document.createElement("a");
          a.className = "repo"; a.href = repo.html_url; a.target = "_blank"; a.rel = "noopener";
          var name = document.createElement("strong"); name.textContent = repo.name;
          var meta = document.createElement("span");
          var d = new Date(repo.pushed_at);
          meta.textContent = (repo.language ? repo.language + ", " : "") + "updated " +
            d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
          a.appendChild(name); a.appendChild(meta);
          if (repo.description) {
            var desc = document.createElement("span"); desc.className = "desc"; desc.textContent = repo.description;
            a.appendChild(desc);
          }
          frag.appendChild(a);
        });
        repoList.innerHTML = "";
        repoList.appendChild(frag);
      })
      .catch(function () { /* keep the static fallback link */ });
  }

  /* ---------- the blastable page (a small nod to Paper Blast) ---------- */
  var canvas = document.getElementById("blast-canvas");
  if (!canvas || !canvas.getContext) return;
  var figure = canvas.closest(".blast");

  var W = 360, H = 250;                 // logical page size; all game-space coordinates use these
  var cssW = canvas.getBoundingClientRect().width || W;
  var SC = Math.max(2, Math.min(4, Math.ceil(cssW * (window.devicePixelRatio || 1) / W)));
  var BW = W * SC, BH = H * SC;         // backing pixels, so text renders sharp at any screen density
  canvas.width = BW; canvas.height = BH;
  var ctx = canvas.getContext("2d");
  var ink = new Uint8Array(BW * BH);    // 0 paper, 1 ink, 2 margin rule, 3 scorch
  var paper = new Uint8Array(BW * BH);  // 1 = page still there
  var pageCanvas = document.createElement("canvas");
  pageCanvas.width = BW; pageCanvas.height = BH;
  var pctx = pageCanvas.getContext("2d");
  var pageDirty = true;
  var particles = [];                   // ink debris, sparks, paper scraps
  var smoke = [], rings = [], flashes = [], glyphs = [];
  var shake = 0;
  var running = false, last = 0;
  var blasts = 0;
  var counter = document.getElementById("blast-count");
  var hover = { on: false, x: 0, y: 0 };
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function token(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function rgb(hex) {
    var c = document.createElement("canvas").getContext("2d");
    c.fillStyle = hex; c.fillRect(0, 0, 1, 1);
    var d = c.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function css(c, a) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + Math.max(0, Math.min(1, a)).toFixed(3) + ")"; }
  var colors;
  function readColors() {
    colors = {
      paper: rgb(token("--surface", "#ffffff")),
      ink: rgb(token("--ink", "#111111")),
      muted: rgb(token("--muted", "#5e5e5e")),
      rule: rgb(token("--rule", "#d6d6d4"))
    };
    colors.scorch = mix(colors.paper, colors.ink, 0.35);
    colors.smoke = mix(colors.paper, colors.muted, 0.7);
  }
  var bodyFont = "";
  function layoutPage() {
    var off = document.createElement("canvas");
    off.width = BW; off.height = BH;
    var o = off.getContext("2d");
    o.scale(SC, SC);
    o.fillStyle = "#000"; o.textBaseline = "alphabetic";
    var display = getComputedStyle(document.documentElement).getPropertyValue("--f-display");
    bodyFont = getComputedStyle(document.documentElement).getPropertyValue("--f-body");
    o.font = "800 34px " + display;
    o.fillText("Kevin Liu", 22, 52);
    o.font = "600 13px " + bodyFont;
    o.fillText("Unity developer, gameplay programmer", 22, 74);
    o.font = "400 10.5px " + bodyFont;
    var lines = [
      "I build gameplay systems in C# and ship them.",
      "Lead programmer on Remains, out now on Steam.",
      "Solo developer of Paper Blast, where PDF pages",
      "become destructible terrain, like this one.",
      "Game Studies Master's student in Jyväskylä, Finland.",
      "Clean architecture, SOLID, and tested code."
    ];
    lines.forEach(function (t, i) { o.fillText(t, 22, 104 + i * 18); });
    o.font = "italic 400 10px " + bodyFont;
    o.fillText("p. 1", W - 44, H - 14);
    var d = o.getImageData(0, 0, BW, BH).data;
    for (var i = 0; i < BW * BH; i++) {
      ink[i] = d[i * 4 + 3] > 90 ? 1 : 0;    // threshold to an ink mask, like the game does
      paper[i] = 1;
    }
    var mx = 12 * SC;
    for (var y = 0; y < BH; y++) for (var x = mx; x < mx + Math.max(1, SC >> 1); x++) ink[y * BW + x] = 2;
    pageDirty = true;
    blasts = 0; updateCounter();
  }

  var img = pctx.createImageData(BW, BH);
  function drawPage() {
    if (pageDirty) { renderPage(); pageDirty = false; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, BW, BH);
    ctx.drawImage(pageCanvas, 0, 0);
    ctx.setTransform(SC, 0, 0, SC, 0, 0);
  }
  function renderPage() {
    var p = img.data, c, a;
    for (var i = 0; i < BW * BH; i++) {
      var k = i * 4;
      if (!paper[i]) { p[k + 3] = 0; continue; }
      var t = ink[i];
      c = t === 1 ? colors.ink : t === 2 ? colors.muted : t === 3 ? colors.scorch : colors.paper;
      a = t === 2 ? 110 : 255;
      p[k] = c[0]; p[k + 1] = c[1]; p[k + 2] = c[2]; p[k + 3] = a;
    }
    pctx.putImageData(img, 0, 0);
  }

  // A 15 x 15 pixel bomb with a flickering fuse, drawn at the pointer.
  function drawBomb(x, y, now) {
    x = Math.round(x); y = Math.round(y);
    var R = 18;
    // dotted blast radius
    ctx.fillStyle = css(colors.muted, 0.8);
    for (var a = 0; a < Math.PI * 2; a += Math.PI / 16) {
      ctx.fillRect(Math.round(x + Math.cos(a + now / 900) * R), Math.round(y + Math.sin(a + now / 900) * R), 1, 1);
    }
    var bob = Math.round(Math.sin(now / 160));
    var bx = x, by = y + bob;
    // body
    ctx.fillStyle = css(colors.ink, 1);
    ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(bx - 2, by - 9, 4, 3);                 // cap
    ctx.fillStyle = css(colors.paper, 0.85);
    ctx.fillRect(bx - 3, by - 3, 2, 2);                 // highlight
    // fuse
    ctx.fillStyle = css(colors.muted, 1);
    ctx.fillRect(bx + 1, by - 11, 1, 2); ctx.fillRect(bx + 2, by - 12, 2, 1); ctx.fillRect(bx + 4, by - 13, 1, 1);
    // spark
    var f = (now / 70) | 0;
    ctx.fillStyle = css(colors.ink, 1);
    var sx = bx + 5, sy = by - 14;
    ctx.fillRect(sx, sy, 1, 1);
    if (f % 2) { ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3); }
    else { ctx.fillRect(sx - 1, sy - 1, 1, 1); ctx.fillRect(sx + 1, sy + 1, 1, 1); ctx.fillRect(sx + 1, sy - 1, 1, 1); }
  }

  function draw(now) {
    drawPage();
    var i, q;
    for (i = 0; i < smoke.length; i++) {
      q = smoke[i];
      ctx.fillStyle = css(colors.smoke, q.life * 0.55);
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
    }
    for (i = 0; i < rings.length; i++) {
      q = rings[i];
      ctx.strokeStyle = css(colors.ink, q.life * 0.9);
      ctx.lineWidth = 1 + q.life * 2.5;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.stroke();
    }
    for (i = 0; i < particles.length; i++) {
      q = particles[i];
      if (q.kind === "scrap") {
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
        ctx.fillStyle = css(colors.paper, q.life); ctx.fillRect(-q.s, -q.s * 0.6, q.s * 2, q.s * 1.2);
        ctx.strokeStyle = css(colors.ink, q.life * 0.8); ctx.lineWidth = 1; ctx.strokeRect(-q.s, -q.s * 0.6, q.s * 2, q.s * 1.2);
        ctx.restore();
      } else {
        ctx.fillStyle = css(q.kind === "spark" ? colors.ink : colors.ink, q.life);
        if (q.kind === "spark") {
          ctx.fillRect(q.x | 0, q.y | 0, 1, 1);
          ctx.fillRect((q.x - q.vx * 0.012) | 0, (q.y - q.vy * 0.012) | 0, 1, 1);
        } else ctx.fillRect(q.x | 0, q.y | 0, q.s, q.s);
      }
    }
    ctx.textBaseline = "middle"; ctx.textAlign = "center";
    for (i = 0; i < glyphs.length; i++) {
      q = glyphs[i];
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
      ctx.font = "700 " + q.size + "px " + bodyFont;
      ctx.fillStyle = css(colors.ink, Math.min(1, q.life * 1.5));
      ctx.fillText(q.ch, 0, 0);
      ctx.restore();
    }
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
    for (i = 0; i < flashes.length; i++) {
      q = flashes[i];
      var g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r);
      g.addColorStop(0, css(colors.paper, q.life));
      g.addColorStop(0.35, css(colors.paper, q.life * 0.7));
      g.addColorStop(1, css(colors.paper, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
      // inked starburst outline, comic style
      if (q.life > 0.55) {
        ctx.strokeStyle = css(colors.ink, (q.life - 0.55) * 2);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (var k = 0; k <= 16; k++) {
          var ang = k / 16 * Math.PI * 2, rr = (k % 2 ? 0.55 : 1) * q.r * 0.9;
          var px = q.x + Math.cos(ang + q.spin) * rr, py = q.y + Math.sin(ang + q.spin) * rr;
          if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
    }
    if (hover.on && finePointer) drawBomb(hover.x, hover.y, now);
  }

  var LETTERS = "PAPERBLASTabcdefghkmnrstuy#{};";
  function blast(cx, cy) {
    var r = 15 + Math.random() * 7;
    var bx0 = cx * SC, by0 = cy * SC, br = r * SC, pad = 5 * SC;
    var r2 = br * br, debris = 0, scorchR = (br + 4 * SC) * (br + 4 * SC);
    var keep = 1 / (SC * SC);                // one debris particle per logical pixel of ink
    // jagged outline: radius varies with angle, so craters look torn rather than stamped
    var lobes = [], nl = 18;
    for (var l = 0; l < nl; l++) lobes.push(0.84 + Math.random() * 0.26);
    for (var y = Math.max(0, (by0 - br - pad) | 0); y < Math.min(BH, by0 + br + pad); y++) {
      for (var x = Math.max(0, (bx0 - br - pad) | 0); x < Math.min(BW, bx0 + br + pad); x++) {
        var dx = x - bx0, dy = y - by0, i = y * BW + x, d2 = dx * dx + dy * dy;
        if (!paper[i]) continue;
        var t = (Math.atan2(dy, dx) / (Math.PI * 2) + 1) * nl, l0 = t | 0, f = t - l0;
        var edge = lobes[l0 % nl] * (1 - f) + lobes[(l0 + 1) % nl] * f;
        if (d2 > r2 * edge * edge) {
          // charred rim just outside the crater
          if (d2 < scorchR * edge * edge && ink[i] === 0 && Math.random() < 0.8) ink[i] = 3;
          continue;
        }
        if (ink[i] === 1 && !reduceMotion && debris < 240 && Math.random() < keep) {
          var a = Math.atan2(dy, dx), sp = 50 + Math.random() * 140;
          particles.push({ kind: "ink", x: x / SC, y: y / SC, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100, life: 1, s: 1 + (Math.random() < .3 ? 1 : 0) });
          debris++;
        }
        paper[i] = 0;
      }
    }
    pageDirty = true;
    blasts++; updateCounter();
    if (!reduceMotion) {
      var n;
      flashes.push({ x: cx, y: cy, r: r * 1.6, life: 1, spin: Math.random() * 3 });
      rings.push({ x: cx, y: cy, r: r * 0.6, max: r * 2.8, life: 1 });
      for (n = 0; n < 40; n++) {
        var ang = Math.random() * Math.PI * 2, s = 90 + Math.random() * 220;
        particles.push({ kind: "spark", x: cx, y: cy, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s - 60, life: 0.9, s: 1 });
      }
      for (n = 0; n < 7; n++) {
        var a2 = Math.random() * Math.PI * 2, s2 = 40 + Math.random() * 110;
        particles.push({ kind: "scrap", x: cx, y: cy, vx: Math.cos(a2) * s2, vy: Math.sin(a2) * s2 - 120, life: 1, s: 2 + Math.random() * 2.5, rot: Math.random() * 6, vr: (Math.random() - .5) * 14 });
      }
      for (n = 0; n < 10; n++) {
        smoke.push({ x: cx + (Math.random() - .5) * r, y: cy + (Math.random() - .5) * r, vx: (Math.random() - .5) * 30, vy: -10 - Math.random() * 25, r: 3 + Math.random() * 5, life: 1 });
      }
      for (n = 0; n < 3 + (Math.random() * 3 | 0); n++) {
        var a3 = -Math.PI / 2 + (Math.random() - .5) * 2.2, s3 = 110 + Math.random() * 120;
        glyphs.push({ ch: LETTERS[(Math.random() * LETTERS.length) | 0], x: cx, y: cy, vx: Math.cos(a3) * s3, vy: Math.sin(a3) * s3, rot: 0, vr: (Math.random() - .5) * 16, size: 9 + Math.random() * 7, life: 1 });
      }
      shake = 1;
    }
    start();
  }

  function updateCounter() {
    if (!counter) return;
    if (blasts > 0) counter.textContent = blasts + (blasts === 1 ? " blast" : " blasts") + " so far.";
    else counter.textContent = hover.on && finePointer ? "Bomb armed. Click to drop it." : "Click or tap the page to blast it.";
  }

  function start() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); } }
  function step(list, dt, fn) { for (var i = list.length - 1; i >= 0; i--) if (fn(list[i], dt) === false) list.splice(i, 1); }
  function tick(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    step(particles, dt, function (q) {
      q.vy += (q.kind === "scrap" ? 160 : 420) * dt;
      if (q.kind === "scrap") { q.vx *= 1 - 1.5 * dt; q.rot += q.vr * dt; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.life -= dt * (q.kind === "spark" ? 2.4 : q.kind === "scrap" ? 0.6 : 0.9);
      return !(q.life <= 0 || q.y > H + 8 || q.x < -8 || q.x > W + 8);
    });
    step(glyphs, dt, function (q) {
      q.vy += 380 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; q.life -= dt * 0.55;
      return !(q.life <= 0 || q.y > H + 20);
    });
    step(smoke, dt, function (q) { q.x += q.vx * dt; q.y += q.vy * dt; q.r += 14 * dt; q.life -= dt * 0.8; return q.life > 0; });
    step(rings, dt, function (q) { q.r += (q.max - q.r) * Math.min(1, dt * 9); q.life -= dt * 2.6; return q.life > 0; });
    step(flashes, dt, function (q) { q.life -= dt * 4.5; return q.life > 0; });
    if (figure) {
      if (shake > 0) {
        shake = Math.max(0, shake - dt * 4);
        var m = 5 * shake * shake;
        figure.style.setProperty("--sx", ((Math.random() - .5) * m).toFixed(2) + "px");
        figure.style.setProperty("--sy", ((Math.random() - .5) * m).toFixed(2) + "px");
      } else { figure.style.setProperty("--sx", "0px"); figure.style.setProperty("--sy", "0px"); }
    }
    draw(now);
    var busy = particles.length || glyphs.length || smoke.length || rings.length || flashes.length || shake > 0 || (hover.on && finePointer);
    if (busy) requestAnimationFrame(tick); else running = false;
  }

  function toPage(e) {
    var r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H];
  }
  canvas.addEventListener("pointerenter", function (e) {
    if (e.pointerType !== "mouse") return;
    var p = toPage(e); hover.on = true; hover.x = p[0]; hover.y = p[1];
    if (figure) figure.classList.add("armed");
    updateCounter(); start();
  });
  canvas.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    var p = toPage(e); hover.x = p[0]; hover.y = p[1]; hover.on = true;
    if (figure) figure.classList.add("armed");
    start();
  });
  canvas.addEventListener("pointerleave", function () {
    hover.on = false;
    if (figure) figure.classList.remove("armed");
    updateCounter(); start();
  });
  canvas.addEventListener("pointerdown", function (e) { var p = toPage(e); blast(p[0], p[1]); });
  canvas.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); blast(40 + Math.random() * (W - 80), 40 + Math.random() * (H - 80)); }
  });
  var reset = document.getElementById("blast-reset");
  if (reset) reset.addEventListener("click", function () {
    particles = []; smoke = []; rings = []; flashes = []; glyphs = [];
    layoutPage(); draw(performance.now()); start();
  });

  readColors(); layoutPage(); draw(performance.now());
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { if (blasts === 0) { layoutPage(); draw(performance.now()); } });
  }
  var mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
  function recolor() { readColors(); pageDirty = true; draw(performance.now()); }
  if (mq && mq.addEventListener) mq.addEventListener("change", recolor);
  new MutationObserver(recolor).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
