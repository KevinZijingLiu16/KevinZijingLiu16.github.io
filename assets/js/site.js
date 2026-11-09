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

  var W = 360, H = 250;
  canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext("2d");
  var ink = new Uint8Array(W * H);      // 1 = ink pixel
  var paper = new Uint8Array(W * H);    // 1 = page still there
  var particles = [];
  var running = false;
  var blasts = 0;
  var counter = document.getElementById("blast-count");

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
  var colors;
  function readColors() {
    colors = {
      paper: rgb(token("--surface", "#ffffff")),
      ink: rgb(token("--ink", "#1a1e26")),
      accent: rgb(token("--muted", "#5e5e5e")),
      rule: rgb(token("--rule", "#d5d9d2"))
    };
  }

  function layoutPage() {
    var off = document.createElement("canvas");
    off.width = W; off.height = H;
    var o = off.getContext("2d");
    o.fillStyle = "#000"; o.textBaseline = "alphabetic";
    var display = getComputedStyle(document.documentElement).getPropertyValue("--f-display");
    var body = getComputedStyle(document.documentElement).getPropertyValue("--f-body");
    o.font = "800 34px " + display;
    o.fillText("Kevin Liu", 22, 52);
    o.font = "600 13px " + body;
    o.fillText("Unity developer, gameplay programmer", 22, 74);
    o.font = "400 10.5px " + body;
    var lines = [
      "I build gameplay systems in C# and ship them.",
      "Lead programmer on Remains, out now on Steam.",
      "Solo developer of Paper Blast, where PDF pages",
      "become destructible terrain, like this one.",
      "Game Studies MA student in Jyväskylä, Finland.",
      "Clean architecture, SOLID, and tested code."
    ];
    lines.forEach(function (t, i) { o.fillText(t, 22, 104 + i * 18); });
    o.font = "italic 400 10px " + body;
    o.fillText("p. 1", W - 44, H - 14);
    var d = o.getImageData(0, 0, W, H).data;
    for (var i = 0; i < W * H; i++) {
      ink[i] = d[i * 4 + 3] > 120 ? 1 : 0;   // threshold to crisp pixels, like the game's ink mask
      paper[i] = 1;
    }
    // page margins: a thin rule along the left, as on lined paper
    for (var y = 0; y < H; y++) { ink[y * W + 12] = 2; }
    blasts = 0; updateCounter();
  }

  var img = ctx.createImageData(W, H);
  function draw() {
    var p = img.data, c;
    for (var i = 0; i < W * H; i++) {
      var k = i * 4;
      if (!paper[i]) { p[k + 3] = 0; continue; }
      c = ink[i] === 1 ? colors.ink : ink[i] === 2 ? colors.accent : colors.paper;
      p[k] = c[0]; p[k + 1] = c[1]; p[k + 2] = c[2]; p[k + 3] = ink[i] === 2 ? 110 : 255;
    }
    ctx.putImageData(img, 0, 0);
    for (var j = 0; j < particles.length; j++) {
      var q = particles[j];
      var col = q.hot ? colors.accent : colors.ink;
      ctx.fillStyle = "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + Math.max(0, q.life).toFixed(2) + ")";
      ctx.fillRect(q.x | 0, q.y | 0, q.s, q.s);
    }
  }

  function blast(cx, cy) {
    var r = 15 + Math.random() * 7;
    var r2 = r * r, debris = 0;
    for (var y = Math.max(0, (cy - r) | 0); y < Math.min(H, cy + r); y++) {
      for (var x = Math.max(0, (cx - r) | 0); x < Math.min(W, cx + r); x++) {
        var dx = x - cx, dy = y - cy, i = y * W + x;
        // ragged edge so craters look torn, not stamped
        if (dx * dx + dy * dy > r2 * (0.82 + Math.random() * 0.3) || !paper[i]) continue;
        if (ink[i] === 1 && !reduceMotion && debris < 260) {
          var a = Math.atan2(dy, dx), sp = 40 + Math.random() * 120;
          particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90, life: 1, s: 1 + (Math.random() < .3 ? 1 : 0), hot: false });
          debris++;
        }
        paper[i] = 0;
      }
    }
    if (!reduceMotion) {
      for (var n = 0; n < 26; n++) {
        var ang = Math.random() * Math.PI * 2, s = 60 + Math.random() * 160;
        particles.push({ x: cx, y: cy, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s - 40, life: .8, s: 2, hot: true });
      }
    }
    blasts++; updateCounter();
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
  }

  function updateCounter() {
    if (counter) counter.textContent = blasts === 0 ? "Click or tap the page to blast it." : blasts + (blasts === 1 ? " blast" : " blasts") + " so far.";
  }

  var last = 0;
  function tick(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (var i = particles.length - 1; i >= 0; i--) {
      var q = particles[i];
      q.vy += 420 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      q.life -= dt * (q.hot ? 2.2 : 0.9);
      if (q.life <= 0 || q.y > H + 4 || q.x < -4 || q.x > W + 4) particles.splice(i, 1);
    }
    draw();
    if (particles.length) requestAnimationFrame(tick); else running = false;
  }

  function toPage(e) {
    var r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H];
  }
  canvas.addEventListener("pointerdown", function (e) { var p = toPage(e); blast(p[0], p[1]); });
  canvas.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); blast(40 + Math.random() * (W - 80), 40 + Math.random() * (H - 80)); }
  });
  var reset = document.getElementById("blast-reset");
  if (reset) reset.addEventListener("click", function () { particles = []; layoutPage(); draw(); });

  readColors(); layoutPage(); draw();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { if (blasts === 0) { layoutPage(); draw(); } });
  }
  var mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
  function recolor() { readColors(); draw(); }
  if (mq && mq.addEventListener) mq.addEventListener("change", recolor);
  new MutationObserver(recolor).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
})();
