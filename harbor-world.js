/* Sapan Postası: Canvas scenery, in a fixed 1280 x 720 logical viewport.
 * Positions are world pixels; NPC y is their centre (feet at y + 28).
 * Static images are cached per context; drawing never advances game state. */
(function () {
  "use strict";
  const W = 1280, H = 720, END = 17400, TAU = Math.PI * 2;
  const INK = "#192d38", WARM = "#f2ca8b";
  const PALETTE_STEPS = 32, SHORE_FACTOR = .22, SHORE_STEP = 290;
  const SHORE_TILE_WIDTH = 2048, SHORE_TOP = 360, SHORE_HEIGHT = 180;
  const MOON_RADIUS = 108;
  const staticLayers = new WeakMap();
  const glowCache = new Map();
  const GLOW_CACHE_LIMIT = 32;
  const districts = Object.freeze([
    { id: "rihtim", name: "Eski Rıhtım", from: 0, to: 3600, color: "#d3a278",
      description: "Sıcak depo pencereleri, eski postahane ve ağlarını toplayan balıkçılar.",
      palette: { sky: "#0b1c2c", haze: "#354954", water: "#142c38", accent: "#d3a278" } },
    { id: "pazar", name: "Balık Pazarı", from: 3600, to: 5900, color: "#97b3a0",
      description: "Çizgili tenteler, balık tezgâhları ve yan yana bağlanmış küçük tekneler.",
      palette: { sky: "#102333", haze: "#3b5559", water: "#183a42", accent: "#97b3a0" } },
    { id: "vinc", name: "Vinç Avlusu", from: 5900, to: 11200, color: "#d1aa6e",
      description: "Kafes vinçler, üst üste konteynerler ve gece açık tamir tezgâhı.",
      palette: { sky: "#101e30", haze: "#394951", water: "#142e3b", accent: "#d1aa6e" } },
    { id: "dalgakiran", name: "Dalgakıran", from: 11200, to: 15300, color: "#a1aeb5",
      description: "Gri taş setler, tuzlu köpük ve açık denize bakan iskele zili.",
      palette: { sky: "#152438", haze: "#4a5c6c", water: "#203d50", accent: "#a1aeb5" } },
    { id: "fener", name: "Fener Burnu", from: 15300, to: END, color: "#aebbd7",
      description: "Arduvaz mavisi kayalıklar ve limanı tarayan eski fenerin ışığı.",
      palette: { sky: "#18253e", haze: "#52657c", water: "#243c58", accent: "#aebbd7" } }
  ].map(d => Object.freeze({ ...d, palette: Object.freeze(d.palette) })));
  const docks = Object.freeze([
    { id: "rihtim", name: "Eski Rıhtım", x: 150, left: 40, right: 900, floor: 540 },
    { id: "vinc", name: "Vinç Avlusu", x: 5900, left: 5510, right: 6300, floor: 500 },
    { id: "dalgakiran", name: "Dalgakıran", x: 11200, left: 10810, right: 11620, floor: 500 },
    { id: "fener", name: "Fener İskelesi", x: 17400, left: 16960, right: 17870, floor: 480 }
  ].map(Object.freeze));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const finite = (x, fallback = 0) => Number.isFinite(x) ? x : fallback;
  const clock = t => finite(t) % 86400;
  const camera = x => clamp(finite(x), -W, 17870);
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const noise = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const mod = (x, n) => ((x % n) + n) % n;

  function districtAt(x) {
    if (!Number.isFinite(x)) return null;
    x = clamp(x, 0, END);
    return districts.find(d => x < d.to) || districts[4];
  }
  function blend(a, b, t) {
    const aa = parseInt(a.slice(1), 16), bb = parseInt(b.slice(1), 16);
    const channel = shift => Math.round(((aa >> shift) & 255) * (1 - t) + ((bb >> shift) & 255) * t);
    return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
  }
  function paletteAt(x, quantized = false) {
    const d = districtAt(x) || districts[0], p = { ...d.palette };
    for (let i = 1; i < districts.length; i++) {
      const boundary = districts[i].from;
      if (Math.abs(x - boundary) <= 420) {
        let t = smooth((x - boundary + 420) / 840);
        if (quantized) t = Math.round(t * PALETTE_STEPS) / PALETTE_STEPS;
        for (const key of Object.keys(p)) p[key] = blend(districts[i - 1].palette[key], districts[i].palette[key], t);
        break;
      }
    }
    return p;
  }
  function poly(ctx, points, fill, stroke = null, width = 1) {
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    if (fill) { ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function line(ctx, x1, y1, x2, y2, color, width = 1) {
    poly(ctx, [[x1, y1], [x2, y2]], null, color, width);
  }
  function box(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  function oval(ctx, x, y, rx, ry, color, outline = null) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fillStyle = color; ctx.fill();
    if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 1.2; ctx.stroke(); }
  }
  function text(ctx, value, x, y, size = 12, color = WARM, align = "center") {
    ctx.font = `600 ${size}px "Segoe UI", sans-serif`; ctx.textAlign = align;
    ctx.fillStyle = color; ctx.fillText(value, x, y);
  }
  function glow(ctx, x, y, radius, color = "rgba(248,198,119,.22)") {
    drawGlow(ctx, x, y, radius, color);
  }
  function glowTint(color) {
    const rgba = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(color);
    return rgba ? { color: `rgb(${rgba[1]},${rgba[2]},${rgba[3]})`, alpha: clamp(Number(rgba[4]), 0, 1) }
      : { color, alpha: 1 };
  }
  function glowSprite(radius, color) {
    if (!globalThis.document?.createElement) return null;
    const key = `${radius}|${color}`;
    let sprite = glowCache.get(key);
    if (!sprite) {
      const layer = makeLayer(Math.ceil(radius * 2), Math.ceil(radius * 2));
      if (!layer) return null;
      const gradient = layer.ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
      gradient.addColorStop(0, color); gradient.addColorStop(1, "rgba(0,0,0,0)");
      layer.ctx.fillStyle = gradient; layer.ctx.fillRect(0, 0, layer.image.width, layer.image.height);
      sprite = layer.image;
      if (glowCache.size >= GLOW_CACHE_LIMIT) glowCache.delete(glowCache.keys().next().value);
      glowCache.set(key, sprite);
    }
    return sprite;
  }
  function drawGlow(ctx, x, y, radius, color = "rgba(248,198,119,.22)", additive = false) {
    if (!ctx || ![x, y, radius].every(Number.isFinite) || radius <= 0 || radius > 256) return;
    const tint = glowTint(color);
    const sprite = glowSprite(radius, tint.color);
    ctx.save();
    if (additive) ctx.globalCompositeOperation = "lighter";
    if (sprite) {
      ctx.globalAlpha *= tint.alpha;
      ctx.drawImage(sprite, Math.floor(x - radius), Math.floor(y - radius));
    } else {
      // Geometry-only contexts do not have a Canvas image factory.
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, color); gradient.addColorStop(1, "rgba(248,198,119,0)");
      box(ctx, x - radius, y - radius, radius * 2, radius * 2, gradient);
    }
    ctx.restore();
  }
  function lamp(ctx, x, floor, time, height = 78) {
    const y = floor - height;
    glow(ctx, x, y + 4, 60, `rgba(248,198,119,${.17 + .015 * Math.sin(time * 2 + x)})`);
    line(ctx, x, floor, x, y - 10, "#273d44", 4);
    line(ctx, x - 7, y - 10, x + 7, y - 10, "#748184", 2);
    box(ctx, x - 6, y - 7, 12, 15, "#3b4547"); box(ctx, x - 3, y - 5, 6, 10, WARM);
    poly(ctx, [[x - 9, y - 8], [x, y - 15], [x + 9, y - 8]], "#405357", INK);
    oval(ctx, x, floor - 1, 15, 3, "rgba(224,180,119,.14)");
  }
  function warehouse(ctx, x, y, width, height, seed, warm = true) {
    const wall = warm ? "#4b4642" : "#344750";
    box(ctx, x, y - height, width, height, wall);
    poly(ctx, [[x - 5, y - height], [x + width * .5, y - height - 26], [x + width + 5, y - height]], "#26323b", "#68706c", 2);
    box(ctx, x + width - 10, y - height, 10, height, "#293b40");
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        const wx = x + 13 + col * ((width - 24) / 5), wy = y - height + 20 + row * 29;
        if (wy > y - 24) continue;
        const lit = noise(seed + row * 11 + col) > .3;
        box(ctx, wx, wy, 12, 17, "#192d36");
        box(ctx, wx + 2, wy + 2, 8, 12, lit ? "#b79462" : "#45606a");
        if (lit) box(ctx, wx + 2, wy + 2, 3, 12, "#ddbb81");
        line(ctx, wx + 6, wy, wx + 6, wy + 17, wall);
      }
    }
    box(ctx, x + width * .4, y - 31, width * .2, 31, "#21333b");
    line(ctx, x, y - 3, x + width, y - 3, "#807866", 3);
    line(ctx, x + 5, y - height + 8, x + width - 5, y - height + 8, "#766859");
  }
  function boat(ctx, x, y, time, seed, fishing = true) {
    y += Math.sin(time * .8 + seed) * 2;
    oval(ctx, x + 55, y + 13, 75, 4, "rgba(120,159,164,.13)");
    poly(ctx, [[x - 6, y], [x + 120, y], [x + 98, y + 20], [x + 20, y + 22]], "#293e47", "#79928d", 1.5);
    line(ctx, x + 3, y + 5, x + 112, y + 5, fishing ? "#bca584" : "#7789a0", 3);
    box(ctx, x + 43, y - 26, 32, 26, "#65817e"); box(ctx, x + 47, y - 22, 23, 12, "#203944");
    box(ctx, x + 48, y - 21, 9, 10, "#bcb181");
    line(ctx, x + 83, y, x + 83, y - 64, "#8c9c96", 2);
    line(ctx, x + 83, y - 59, x + 104, y - 12, "#647e82");
    line(ctx, x + 82, y - 47, x + 34, y - 10, "#627982");
    if (fishing) {
      for (let n = 0; n < 7; n++) line(ctx, x + 10 + n * 4, y - 13, x + 20 + n * 4, y - 2, "#7a8b84", .8);
      oval(ctx, x + 26, y - 9, 18, 6, "rgba(112,134,118,.4)");
      box(ctx, x + 54, y - 30, 7, 4, "#ccad73");
    }
  }
  function stall(ctx, x, y, seed) {
    const shade = seed % 2 ? "#aa7562" : "#72988f";
    line(ctx, x + 3, y, x + 3, y - 68, "#4e655e", 3);
    line(ctx, x + 111, y, x + 111, y - 68, "#4e655e", 3);
    poly(ctx, [[x - 8, y - 57], [x + 14, y - 77], [x + 99, y - 77], [x + 122, y - 57]], shade, INK);
    for (let i = 0; i < 6; i++) {
      poly(ctx, [[x + 14 + i * 14, y - 77], [x + 21 + i * 14, y - 77],
        [x + 10 + i * 19, y - 57], [x + i * 19, y - 57]], "#bcbca0");
      oval(ctx, x + 1 + i * 21, y - 56, 10, 3, shade);
    }
    box(ctx, x + 6, y - 26, 100, 26, "#445e5d");
    box(ctx, x + 2, y - 31, 109, 6, "#9eaa99");
    for (let i = 0; i < 5; i++) {
      const fx = x + 15 + i * 18;
      oval(ctx, fx, y - 34, 7, 2.5, "#b2c5bd");
      poly(ctx, [[fx - 7, y - 34], [fx - 11, y - 38], [fx - 11, y - 30]], "#89a4a0");
      oval(ctx, fx + 4, y - 34, .7, .7, INK);
    }
    line(ctx, x + 10, y - 10, x + 100, y - 10, "#79897c");
    glow(ctx, x + 56, y - 63, 30, "rgba(237,192,128,.16)");
    oval(ctx, x + 56, y - 63, 3, 4, WARM);
  }
  function crane(ctx, x, floor, height, seed) {
    const top = floor - height, steel = "#5f7378", dark = "#283e4b";
    poly(ctx, [[x - 19, floor], [x - 13, top], [x + 13, top], [x + 25, floor]], dark, steel, 2);
    for (let i = 0; i < 7; i++) {
      const y = top + i * height / 7;
      line(ctx, x - 12, y, x + 18, y + height / 7, steel);
      line(ctx, x + 14, y, x - 14, y + height / 7, steel);
    }
    poly(ctx, [[x - 65, top + 18], [x + 7, top - 31], [x + 206, top + 18]], dark, steel, 2);
    line(ctx, x - 65, top + 18, x + 206, top + 18, "#8a9081", 2);
    for (let i = 0; i < 8; i++) line(ctx, x - 56 + i * 32, top + 18, x - 40 + i * 26, top - 3, steel);
    box(ctx, x - 27, top + 15, 55, 27, "#596663"); box(ctx, x - 23, top + 18, 17, 14, "#91a7a2");
    line(ctx, x + 176, top + 20, x + 176, top + 112, "#7b8b8c", 1.5);
    line(ctx, x + 182, top + 20, x + 182, top + 112, "#7b8b8c", 1.5);
    poly(ctx, [[x + 169, top + 112], [x + 189, top + 112], [x + 183, top + 123], [x + 175, top + 123]], "#ad976e", INK);
    line(ctx, x + 179, top + 123, x + 184, top + 133, "#a0afa9", 2);
    oval(ctx, x + 7, top - 31, 2.5, 2.5, seed % 2 ? "#df9779" : "#e3c691");
  }
  function container(ctx, x, y, w, h, color) {
    box(ctx, x, y - h, w, h, color);
    box(ctx, x, y - h, w, 3, "#80928b"); box(ctx, x + w - 4, y - h, 4, h, "#243947");
    for (let i = 1; i < 10; i++) line(ctx, x + i * w / 10, y - h + 5, x + i * w / 10, y - 4, "rgba(15,34,43,.38)", 2);
    box(ctx, x + 10, y - h + 10, 17, 7, "rgba(206,199,166,.55)");
  }
  function rocks(ctx, x, y, seed, count = 8, size = 30) {
    for (let i = 0; i < count; i++) {
      const xx = x + i * size * .9, yy = y + noise(seed + i) * 16;
      poly(ctx, [[xx - size * .5, yy], [xx - size * .3, yy - size * .65], [xx + size * .15, yy - size],
        [xx + size * .6, yy - size * .53], [xx + size * .7, yy + 8]],
      i % 2 ? "#415763" : "#526873", "#2b424f", 1.3);
      line(ctx, xx - size * .3, yy - size * .65, xx + size * .15, yy - size, "#8a9da3", 1.5);
      line(ctx, xx + size * .15, yy - size, xx + size * .08, yy - 5, "#374e5d");
    }
  }
  function lighthouse(ctx, x, floor, time, scale = 1, beams = true) {
    ctx.save(); ctx.translate(x, floor); ctx.scale(scale, scale);
    if (beams) {
      const angle = -.16 + Math.sin(time * .15) * .22;
      ctx.save(); ctx.translate(0, -224); ctx.rotate(angle);
      const g = ctx.createLinearGradient(0, 0, 1000, 0);
      g.addColorStop(0, "rgba(244,229,178,.27)"); g.addColorStop(1, "rgba(204,219,232,0)");
      poly(ctx, [[0, -3], [1100, -90], [1100, 96], [0, 4]], g);
      ctx.rotate(Math.PI);
      poly(ctx, [[0, -3], [900, -68], [900, 75], [0, 4]], g);
      ctx.restore();
    }
    poly(ctx, [[-32, 0], [-19, -209], [19, -209], [33, 0]], "#a1aeb4", "#344a5c", 2);
    poly(ctx, [[5, 0], [8, -209], [19, -209], [33, 0]], "#6f8498");
    poly(ctx, [[-27, -45], [-25, -69], [25, -69], [27, -45]], "#4a657b");
    poly(ctx, [[-22, -138], [-21, -156], [21, -156], [22, -138]], "#4a657b");
    for (const y of [-27, -98, -182]) {
      box(ctx, -4, y - 13, 8, 13, "#263f53"); line(ctx, -4, y - 13, 4, y - 13, "#d5d4bc");
    }
    box(ctx, -25, -242, 50, 32, "#3f5668"); box(ctx, -20, -238, 40, 22, "#e0cf9c");
    for (const xx of [-15, 0, 15]) line(ctx, xx, -239, xx, -214, "#476176", 2);
    poly(ctx, [[-33, -244], [0, -265], [33, -244]], "#33485b", "#81929c", 1.5);
    box(ctx, -36, -211, 72, 6, "#5f7385");
    for (let i = 0; i < 9; i++) line(ctx, -35 + i * 9, -218, -35 + i * 9, -205, "#708691");
    line(ctx, -36, -218, 36, -218, "#708691");
    glow(ctx, 0, -226, 44, "rgba(244,214,153,.3)");
    box(ctx, -7, -24, 14, 24, "#344557");
    ctx.restore();
  }

  // Tile iteration starts at the visible world interval, never at the route start.
  // All three layers share a focal plane at screen x=460, preserving district identity.
  function tiles(ctx, cam, factor, step, margin, draw) {
    const offset = 460 * (1 - factor);
    const first = Math.floor((cam + (-margin - offset) / factor) / step);
    const last = Math.ceil((cam + (W + margin - offset) / factor) / step);
    for (let i = first; i <= last && i < first + 50; i++) {
      const world = i * step, screen = (world - cam) * factor + offset;
      const d = districtAt(world);
      if (d) draw(screen, i, d, world);
    }
  }
  function paintSky(ctx, p) {
    const sky = ctx.createLinearGradient(0, 0, 0, 568);
    sky.addColorStop(0, p.sky); sky.addColorStop(.7, p.haze); sky.addColorStop(1, p.sky);
    box(ctx, 0, 0, W, H, sky);
  }
  function paintMoon(ctx, x, y, p) {
    glow(ctx, x, y, MOON_RADIUS, "rgba(207,220,230,.10)");
    oval(ctx, x, y, 32, 32, "#d7d7c8"); oval(ctx, x - 12, y - 9, 29, 29, p.sky);
  }
  function paintFarShoreTile(ctx, x, seed, d) {
    if (d.id === "fener" || d.id === "dalgakiran") {
      poly(ctx, [[x - 40, 526], [x + 16, 463], [x + 102, 433 + noise(seed) * 35], [x + 210, 476], [x + 290, 526]], "#293f50");
    } else {
      for (let i = 0; i < 4; i++) {
        const h = 40 + noise(seed * 4 + i) * 92, xx = x + i * 58;
        box(ctx, xx, 513 - h, 48, h, "#263c48");
        poly(ctx, [[xx - 3, 513 - h], [xx + 24, 501 - h], [xx + 50, 513 - h]], "#233744");
        for (let k = 0; k < 3; k++) box(ctx, xx + 8 + k * 12, 529 - h, 3, 5, "rgba(202,181,128,.26)");
      }
    }
  }
  function makeLayer(width, height, opaque = false) {
    const image = document.createElement("canvas");
    image.width = width; image.height = height;
    const ctx = image.getContext("2d", { alpha: !opaque });
    return ctx ? { image, ctx } : null;
  }
  function paintShoreStrip(layer, origin) {
    const ctx = layer.ctx, offset = 460 * (1 - SHORE_FACTOR);
    ctx.clearRect(0, 0, layer.image.width, layer.image.height);
    ctx.save(); ctx.translate(-origin, -SHORE_TOP);
    const first = Math.floor((origin - offset - 340) / (SHORE_FACTOR * SHORE_STEP));
    const last = Math.ceil((origin + layer.image.width - offset + 340) / (SHORE_FACTOR * SHORE_STEP));
    for (let i = first; i <= last; i++) {
      const world = i * SHORE_STEP, d = districtAt(world);
      if (d) paintFarShoreTile(ctx, world * SHORE_FACTOR + offset, i, d);
    }
    ctx.restore();
  }
  function getStaticLayers(ctx, cam, focus) {
    // Headless geometry checks and contexts without an offscreen canvas keep the direct path.
    if (!globalThis.document?.createElement) return null;
    let layers = staticLayers.get(ctx);
    if (!layers) {
      const sky = makeLayer(W, H, true), moon = makeLayer(MOON_RADIUS * 2, MOON_RADIUS * 2);
      const shore = makeLayer(SHORE_TILE_WIDTH * 2, SHORE_HEIGHT);
      if (!sky || !moon || !shore) return null;
      layers = { sky, moon, shore, paletteKey: null, origin: null };
      staticLayers.set(ctx, layers);
    }
    const p = paletteAt(focus, true), key = `${p.sky}|${p.haze}`;
    if (layers.paletteKey !== key) {
      paintSky(layers.sky.ctx, p);
      layers.moon.ctx.clearRect(0, 0, MOON_RADIUS * 2, MOON_RADIUS * 2);
      paintMoon(layers.moon.ctx, MOON_RADIUS, MOON_RADIUS, p);
      layers.paletteKey = key;
    }
    const origin = Math.floor(cam * SHORE_FACTOR / SHORE_TILE_WIDTH) * SHORE_TILE_WIDTH;
    if (layers.origin !== origin) {
      paintShoreStrip(layers.shore, origin);
      layers.origin = origin;
    }
    return layers;
  }
  function drawBackground(ctx, cameraX, time, focusX = cameraX + 460) {
    if (!ctx) return;
    const cam = camera(cameraX), t = clock(time), focus = clamp(finite(focusX, cam + 460), 0, END);
    const p = paletteAt(focus);
    const layers = getStaticLayers(ctx, cam, focus);
    ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    if (layers) ctx.drawImage(layers.sky.image, 0, 0);
    else paintSky(ctx, p);
    for (let i = 0; i < 68; i++) {
      const x = mod(i * 173.7 - cam * .025, W), y = 25 + noise(i) * 230;
      ctx.globalAlpha = .18 + noise(i + 12) * .45 + Math.sin(t * .7 + i) * .06;
      oval(ctx, x, y, .55 + noise(i + 4) * .8, .55 + noise(i + 4) * .8, "#dfe6ed");
    }
    ctx.globalAlpha = 1;
    const moonX = 1030 - cam * .008;
    if (layers) ctx.drawImage(layers.moon.image, Math.floor(moonX - MOON_RADIUS), 113 - MOON_RADIUS);
    else paintMoon(ctx, moonX, 113, p);
    // Long, translucent banks of cloud move independently of the shoreline.
    for (let i = 0; i < 5; i++) {
      const x = mod(i * 347 - cam * .065 + t * 2, 1730) - 230;
      oval(ctx, x, 195 + i % 2 * 49, 170, 10, "rgba(143,162,180,.055)");
      oval(ctx, x + 87, 188 + i % 2 * 49, 89, 12, "rgba(143,162,180,.035)");
    }
    // Far shore: inland rooflines fade into hills toward the open sea.
    if (layers) ctx.drawImage(layers.shore.image, Math.floor(layers.origin - cam * SHORE_FACTOR), SHORE_TOP);
    else tiles(ctx, cam, SHORE_FACTOR, SHORE_STEP, 180, (x, seed, d) => paintFarShoreTile(ctx, x, seed, d));
    const water = ctx.createLinearGradient(0, 553, 0, H);
    water.addColorStop(0, p.water); water.addColorStop(1, "#0a1d2c");
    box(ctx, 0, 553, W, H - 553, water);
    tiles(ctx, cam, .55, 420, 230, (x, seed, d) => {
      if (d.id === "rihtim") {
        warehouse(ctx, x, 544, 154, 104 + noise(seed) * 38, seed);
        warehouse(ctx, x + 177, 544, 137, 84, seed + 4);
        line(ctx, x - 4, 546, x + 340, 546, "#6d756e", 4);
        boat(ctx, x + 221, 566, t, seed);
      } else if (d.id === "pazar") {
        warehouse(ctx, x + 13, 523, 237, 65, seed, false);
        stall(ctx, x + 4, 543, seed); stall(ctx, x + 148, 543, seed + 1);
        boat(ctx, x + 7, 565, t, seed); boat(ctx, x + 168, 578, t, seed + 1);
        line(ctx, x + 10, 473, x + 261, 461, "#4c6669");
        for (let i = 0; i < 7; i++) oval(ctx, x + 16 + i * 35, 474 - i * 1.6, 2, 3, WARM);
      } else if (d.id === "vinc") {
        crane(ctx, x + 80, 548, 185 + noise(seed) * 65, seed);
        container(ctx, x + 174, 548, 130, 43, "#526e74");
        container(ctx, x + 194, 505, 109, 36, "#8b6d58");
        container(ctx, x + 22, 549, 111, 34, "#4a6268");
        line(ctx, x - 20, 552, x + 333, 552, "#6b787a", 4);
        box(ctx, x + 329, 524, 8, 29, "#68746a"); glow(ctx, x + 333, 525, 25, "rgba(220,173,101,.15)");
      } else if (d.id === "dalgakiran") {
        rocks(ctx, x - 12, 553, seed, 11, 33);
        box(ctx, x + 26, 502, 43, 32, "#5b6c70");
        poly(ctx, [[x + 22, 502], [x + 46, 487], [x + 73, 502]], "#344b5c");
        line(ctx, x + 142, 531, x + 142, 491, "#9baba9", 2);
        poly(ctx, [[x + 142, 491], [x + 165, 494 + Math.sin(t * 2) * 3], [x + 142, 506]], "#bb8975");
      } else {
        rocks(ctx, x - 22, 554, seed, 9, 39);
        if (mod(seed, 3) === 0) warehouse(ctx, x + 70, 531, 88, 56, seed, false);
      }
    });
    // One geographically anchored lighthouse, visible before reaching its district.
    const lightX = (16930 - cam) * .55 + 207;
    if (lightX > -1050 && lightX < W + 1050) {
      ctx.save(); ctx.globalAlpha = .92; lighthouse(ctx, lightX, 531, t, .85); ctx.restore();
    }
    // Reflections break into perspective-shortened strips rather than solid columns.
    for (let row = 0; row < 20; row++) {
      const y = 563 + row * 7.5, spread = 7 + row * 3;
      const xx = moonX + Math.sin(t * .7 + row * 1.7) * spread;
      box(ctx, xx - spread, y, spread * 2, 1.2, `rgba(205,213,211,${.12 * (1 - row / 23)})`);
    }
    tiles(ctx, cam, .55, 420, 140, (x, seed, d) => {
      if (d.id === "dalgakiran" || d.id === "fener") return;
      for (let i = 0; i < 10; i++) {
        const y = 562 + i * 9, xx = x + 72 + Math.sin(t * 1.1 + seed + i) * (6 + i);
        box(ctx, xx, y, 14 + noise(seed + i) * 20, 1.5, `rgba(230,186,122,${.14 * (1 - i / 12)})`);
      }
    });
    // Water has bounded screen-space work even at extreme camera coordinates.
    const waterSoft = new Path2D(), waterBright = new Path2D();
    for (let row = 0; row < 9; row++) {
      const y = 562 + row * 19, path = row % 3 ? waterSoft : waterBright;
      for (let i = 0; i < 29; i++) {
        const x = mod(i * 49 - cam * (.35 + row * .02) + Math.sin(t + row) * 7, W + 70) - 35;
        path.moveTo(x, y + Math.sin(t * .9 + i + row) * 2);
        path.lineTo(x + 10 + noise(i + row) * 23, y);
      }
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(133,174,187,.13)"; ctx.stroke(waterSoft);
    ctx.strokeStyle = "rgba(160,188,198,.20)"; ctx.stroke(waterBright);
    tiles(ctx, cam, .84, 260, 130, (x, seed, d) => {
      if (d.id === "dalgakiran" || d.id === "fener") {
        rocks(ctx, x, 616, seed + 35, 7, 31);
        const pulse = .45 + .55 * Math.sin(t * 1.3 + seed);
        for (let i = 0; i < 8; i++) {
          const xx = x + i * 25, yy = 620 + Math.sin(t + i * .8) * 3;
          oval(ctx, xx, yy, 8 + pulse * 8, 1.5, `rgba(186,211,218,${.15 + pulse * .17})`);
          line(ctx, xx - 8, yy + 5, xx + 5, yy + 5, "rgba(150,189,203,.16)");
        }
      } else {
        box(ctx, x, 610, 170, 8, "#2b4149"); box(ctx, x + 9, 618, 11, 76, "#243943");
        box(ctx, x + 145, 618, 11, 87, "#243943"); line(ctx, x, 610, x + 170, 610, "#657773", 2);
        oval(ctx, x + 92, 626, 10, 13, "#20353e", "#70807a");
        line(ctx, x + 93, 611, x + 92, 615, "#927f60", 2);
      }
    });
    const fog = ctx.createLinearGradient(0, 473, 0, 604);
    fog.addColorStop(0, "rgba(174,190,201,0)"); fog.addColorStop(.5, "rgba(163,182,191,.075)");
    fog.addColorStop(1, "rgba(163,182,191,0)"); box(ctx, 0, 473, W, 131, fog);
    ctx.restore();
  }

  function crate(ctx, x, floor, size = 26) {
    box(ctx, x, floor - size, size, size, "#796a51");
    line(ctx, x + 2, floor - size + 2, x + size - 2, floor - 2, "#ab9270", 2);
    line(ctx, x + size - 2, floor - size + 2, x + 2, floor - 2, "#ab9270", 2);
    poly(ctx, [[x, floor], [x, floor - size], [x + size, floor - size], [x + size, floor], [x, floor]], null, "#38474a", 2);
  }
  function bench(ctx, x, floor, width = 76) {
    box(ctx, x + 4, floor - 37, width - 8, 13, "#81775f");
    line(ctx, x + 4, floor - 30, x + width - 4, floor - 30, "#aa9571");
    box(ctx, x, floor - 21, width, 6, "#a28b67");
    line(ctx, x + 10, floor - 35, x + 10, floor, "#35494a", 4);
    line(ctx, x + width - 10, floor - 35, x + width - 10, floor, "#35494a", 4);
  }
  function hut(ctx, x, floor, width, title, color = "#566766") {
    box(ctx, x, floor - 110, width, 110, color);
    poly(ctx, [[x - 9, floor - 108], [x + width / 2, floor - 140], [x + width + 9, floor - 108]], "#354750", "#8c8c77", 2);
    box(ctx, x + 14, floor - 77, 36, 35, "#283e48");
    box(ctx, x + 17, floor - 74, 30, 29, "#c7a775");
    line(ctx, x + 32, floor - 74, x + 32, floor - 45, "#5f655c", 2);
    line(ctx, x + 17, floor - 60, x + 47, floor - 60, "#5f655c", 2);
    box(ctx, x + width - 46, floor - 68, 29, 68, "#334348");
    box(ctx, x + width - 41, floor - 62, 19, 23, "#8d927a");
    oval(ctx, x + width - 24, floor - 29, 1.5, 1.5, WARM);
    box(ctx, x + 12, floor - 105, width - 24, 19, "#2b4249");
    text(ctx, title, x + width / 2, floor - 91, 10);
    for (let i = 0; i < 4; i++) line(ctx, x + 4, floor - 37 + i * 9, x + width - 50, floor - 37 + i * 9, "rgba(24,42,47,.3)");
    glow(ctx, x + 32, floor - 59, 64, "rgba(242,193,117,.09)");
  }
  function bell(ctx, x, floor, time) {
    line(ctx, x - 26, floor, x - 26, floor - 88, "#4f6265", 5);
    line(ctx, x - 26, floor - 86, x + 13, floor - 86, "#829089", 4);
    ctx.save(); ctx.translate(x, floor - 77); ctx.rotate(Math.sin(time * .65) * .015);
    poly(ctx, [[-9, 0], [-7, -12], [7, -12], [9, 0], [14, 8], [-14, 8]], "#b19d70", INK);
    oval(ctx, 0, 8, 14, 3, "#776b51", INK); oval(ctx, 0, 11, 2, 3, "#c6b084");
    line(ctx, 0, 13, 0, 51, "#b8ac89"); oval(ctx, 0, 53, 4, 4, "#897a5e", INK);
    ctx.restore();
  }
  function drawDock(ctx, dock, cameraX, time, detail = true) {
    if (!ctx || !dock || ![dock.left, dock.right, dock.floor, dock.x].every(Number.isFinite) || dock.right <= dock.left) return;
    const cam = finite(cameraX), left = dock.left - cam, right = dock.right - cam, floor = dock.floor, t = clock(time);
    if (right < -160 || left > W + 160 || floor < -200 || floor > H + 200) return;
    ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    const l = Math.max(-180, left), r = Math.min(W + 180, right);
    // The upper edge is exactly the walkable floor, including the two endpoints.
    box(ctx, l, floor, r - l, 11, "#9c8e70"); box(ctx, l, floor + 11, r - l, 13, "#4c544d");
    line(ctx, l, floor, r, floor, "#d7c49a", 2);
    line(ctx, l, floor + 20, r, floor + 20, "#293e45", 3);
    const start = Math.max(0, Math.floor((l - left) / 28));
    for (let i = start; i < start + 60 && left + i * 28 < r; i++) {
      const x = left + i * 28;
      line(ctx, x, floor + 1, x + 2, floor + 11, "#4d594f");
      if (detail) {
        line(ctx, x + 5, floor + 4, Math.min(x + 20, r), floor + 4, "#b2a17c", .8);
        oval(ctx, x + 6, floor + 8, .85, .85, "#4a4e44");
      }
    }
    const pierStart = Math.max(0, Math.floor((l - left) / 125));
    for (let i = pierStart; i < pierStart + 15 && left + i * 125 + 20 < r; i++) {
      const x = left + i * 125 + 20;
      box(ctx, x, floor + 24, 14, Math.max(32, 702 - floor - 24), "#30484d");
      box(ctx, x + 3, floor + 24, 3, Math.max(32, 702 - floor - 24), "#647368");
      line(ctx, x, floor + 62, x + 14, floor + 62, "#829184", 2);
      if (detail && i % 2 === 0) oval(ctx, x + 7, floor + 36, 11, 14, "#243a40", "#7d8775");
    }
    if (!detail) {
      lamp(ctx, clamp(dock.x - cam + 48, left + 16, right - 16), floor, t, 36);
      ctx.restore(); return;
    }
    // Scenery sits behind the clear floor. Interactable props use HarborSocial's world positions.
    const prop = (worldX, width, draw) => {
      const x = worldX - cam;
      if (x + width >= -130 && x - width <= W + 130) draw(x);
    };
    if (dock.id === "rihtim") {
      prop(195, 86, x => hut(ctx, x - 71, floor, 142, "POSTAHANE", "#766958"));
      prop(520, 38, x => {
        line(ctx, x - 23, floor, x - 23, floor - 72, "#59675c", 4);
        line(ctx, x + 23, floor, x + 23, floor - 72, "#59675c", 4);
        box(ctx, x - 32, floor - 86, 64, 52, "#6f7260");
        box(ctx, x - 27, floor - 81, 54, 42, "#b8ae8b");
        for (let i = 0; i < 3; i++) {
          box(ctx, x - 20 + i * 14, floor - 74 + i % 2 * 3, 11, 22, "#d7c9a4");
          line(ctx, x - 18 + i * 14, floor - 67, x - 11 + i * 14, floor - 67, "#827e66");
        }
      });
      prop(410, 48, x => bench(ctx, x - 35, floor));
      prop(811, 50, x => { crate(ctx, x - 20, floor, 30); crate(ctx, x + 11, floor, 22); });
      prop(684, 65, x => { boat(ctx, x - 60, floor + 43, t, 2); line(ctx, x - 42, floor + 30, x - 67, floor - 8, "#a09879"); });
      prop(82, 30, x => lamp(ctx, x, floor, t)); prop(610, 30, x => lamp(ctx, x, floor, t));
    } else if (dock.id === "vinc") {
      prop(5620, 100, x => {
        hut(ctx, x - 63, floor, 126, "TAMİRHANE", "#626d62");
        line(ctx, x - 72, floor - 114, x + 76, floor - 114, "#a29b72", 3);
      });
      prop(5920, 66, x => {
        box(ctx, x - 53, floor - 35, 106, 7, "#aa9371");
        line(ctx, x - 44, floor - 28, x - 44, floor, "#435657", 5);
        line(ctx, x + 44, floor - 28, x + 44, floor, "#435657", 5);
        oval(ctx, x - 18, floor - 45, 13, 13, "#8a8469", "#b7ac86");
        oval(ctx, x - 18, floor - 45, 5, 5, "#344852");
        line(ctx, x + 7, floor - 40, x + 28, floor - 43, "#b0b5a4", 3);
        oval(ctx, x + 30, floor - 43, 4, 4, "#b0b5a4");
      });
      prop(6223, 76, x => { hut(ctx, x - 55, floor, 110, "ÇAY OCAĞI", "#76655b");
        box(ctx, x - 68, floor - 44, 29, 6, "#af9772"); oval(ctx, x - 53, floor - 54, 7, 10, "#9baba1", INK); });
      prop(6023, 37, x => bench(ctx, x - 32, floor, 65));
      prop(5560, 25, x => crate(ctx, x, floor, 27));
      prop(5800, 30, x => lamp(ctx, x, floor, t)); prop(6285, 30, x => lamp(ctx, x, floor, t));
    } else if (dock.id === "dalgakiran") {
      prop(10905, 65, x => hut(ctx, x - 49, floor, 98, "İSKELE", "#626e72"));
      prop(11220, 40, x => bell(ctx, x, floor, t));
      prop(11110, 45, x => bench(ctx, x - 36, floor));
      prop(11537, 33, x => { crate(ctx, x, floor, 25); oval(ctx, x - 24, floor - 6, 16, 6, "#9c987b", INK);
        for (let i = 0; i < 3; i++) oval(ctx, x - 24, floor - 6, 12 - i * 3, 4 - i, "#6c776b", "#b1a882"); });
      prop(11472, 67, x => boat(ctx, x - 38, floor + 49, t, 5, false));
      prop(10830, 30, x => lamp(ctx, x, floor, t)); prop(11333, 30, x => lamp(ctx, x, floor, t));
    } else if (dock.id === "fener") {
      prop(17090, 90, x => {
        rocks(ctx, x - 62, floor, 9, 5, 29);
        for (let i = 0; i < 5; i++) {
          box(ctx, x - 47 + i * 18, floor - 8 - i * 8, 22, 8 + i * 8, "#657984");
          line(ctx, x - 47 + i * 18, floor - 8 - i * 8, x - 25 + i * 18, floor - 8 - i * 8, "#a0afb1", 1.5);
        }
        line(ctx, x - 42, floor - 24, x + 44, floor - 61, "#8a9999", 2);
        for (let i = 0; i < 4; i++) line(ctx, x - 42 + i * 28, floor - 24 - i * 12, x - 42 + i * 28, floor - 9 - i * 8, "#667b86", 2);
      });
      prop(17652, 75, x => hut(ctx, x - 65, floor, 130, "FENER EVİ", "#707e88"));
      prop(17250, 42, x => {
        box(ctx, x - 30, floor - 36, 60, 5, "#ac9d7d");
        line(ctx, x - 25, floor - 31, x - 25, floor, "#485a60", 4);
        line(ctx, x + 25, floor - 31, x + 25, floor, "#485a60", 4);
        poly(ctx, [[x - 14, floor - 39], [x, floor - 41], [x + 14, floor - 39], [x + 14, floor - 36], [x, floor - 38], [x - 14, floor - 36]], "#d5c9a7", INK);
        line(ctx, x, floor - 40, x, floor - 37, "#8f8b72");
      });
      prop(17390, 50, x => bench(ctx, x - 43, floor, 86));
      prop(17766, 30, x => bell(ctx, x, floor, t));
      prop(17184, 30, x => lamp(ctx, x, floor, t)); prop(17835, 30, x => lamp(ctx, x, floor, t));
    }
    ctx.restore();
  }

  function drawNPC(ctx, npc, cameraX, time, active = false) {
    if (!ctx || !npc || !Number.isFinite(npc.x) || !Number.isFinite(npc.y)) return;
    const x = npc.x - finite(cameraX), y = npc.y, t = clock(time);
    if (x < -100 || x > W + 100 || y < -100 || y > H + 100) return;
    const look = npc.look || "postaci", phase = noise(npc.x) * TAU;
    const breath = Math.sin(t * 2.1 + phase) * .55;
    const gesture = active ? Math.sin(t * 2.8 + phase) * 3 : Math.sin(t * .7 + phase) * .65;
    const coat = npc.color || "#b3aa8e", skin = look === "tamirci" ? "#d5a680" : "#e2b48f";
    ctx.save(); ctx.translate(x, y); ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.scale(npc.facing < 0 ? -1 : 1, 1);
    oval(ctx, 0, 28, 17, 3, "rgba(8,24,32,.28)");
    const limb = (points, width, color) => {
      poly(ctx, points, null, INK, width + 2.4); poly(ctx, points, null, color, width);
    };
    limb([[-4, 8], [-6, 17], [-7, 24]], 5.5, "#3b5962");
    limb([[4, 8], [6, 17], [7, 24]], 5.8, "#47666a");
    for (const foot of [-7, 7]) {
      poly(ctx, [[foot - 3, 21], [foot + 2, 21], [foot + 5, 25], [foot + 4, 28], [foot - 4, 28], [foot - 4, 24]], "#4d443d", INK);
      line(ctx, foot - 3, 26.5, foot + 4, 26.5, "#8f7c61");
    }
    limb([[-7, -8 + breath], [-12, 0], [-10, 9]], 5, coat);
    oval(ctx, -10, 10, 2.5, 3, skin, INK);
    poly(ctx, [[-6, -12 + breath], [5, -12 + breath], [9, -7 + breath], [8, 12], [1, 13],
      [-1, 10], [-8, 12], [-9, -6 + breath]], coat, INK, 1.3);
    poly(ctx, [[-7, -7], [-3, -9], [-3, 10], [-7, 11]], "rgba(25,44,51,.18)");
    line(ctx, 1, -7 + breath, 1, 10, "#6c6c5c");
    for (const yy of [-3, 3, 8]) oval(ctx, 3, yy, .8, .8, "#d3c19b");
    if (look === "balikci" || look === "tamirci") {
      poly(ctx, [[-5, -6], [5, -6], [7, 11], [-7, 11]], look === "balikci" ? "#536e65" : "#657276", INK);
      line(ctx, -5, -6, -4, -12 + breath, "#b9b299", 2);
      line(ctx, 5, -6, 4, -12 + breath, "#b9b299", 2);
      box(ctx, -4, 0, 8, 5, "#879087");
    } else if (look === "cayci") {
      poly(ctx, [[-5, -5], [5, -5], [9, 13], [-8, 13]], "#c2b99e", INK);
      line(ctx, -4, -5, -3, -12 + breath, "#c2b99e", 2);
      box(ctx, -3, 2, 7, 5, "#a79980");
    } else if (look === "postaci") {
      limb([[5, -10], [-7, 9]], 2, "#8a5f47");
      poly(ctx, [[-13, 3], [-5, 4], [-4, 15], [-13, 13]], "#956b50", INK);
      line(ctx, -12, 5, -6, 8, "#c09168");
      box(ctx, 3, -7, 4, 3, "#dccca4");
    }
    oval(ctx, 0, -20 + breath, 7, 7.8, skin, INK);
    oval(ctx, -6, -19 + breath, 1.6, 2.3, "#bd8b6c");
    poly(ctx, [[5, -21 + breath], [9, -19 + breath], [6, -17 + breath]], skin, INK);
    const blink = mod(t + phase, 4.1) < .12;
    if (blink) line(ctx, 3, -21 + breath, 5, -21 + breath, INK);
    else oval(ctx, 4, -21 + breath, .7, 1, INK);
    line(ctx, 1, -16 + breath, 4, -16.3 + breath, "#9c735e");
    if (look === "balikci" || look === "fenerci") {
      poly(ctx, [[-4, -16 + breath], [1, -15 + breath], [6, -17 + breath], [4, -12 + breath], [0, -10 + breath]],
        look === "fenerci" ? "#b9b7aa" : "#74695c", INK, .7);
    }
    if (look === "cayci") {
      poly(ctx, [[-8, -16 + breath], [-9, -27 + breath], [-4, -31 + breath], [5, -28 + breath], [7, -24 + breath], [-3, -24 + breath]], "#9c7987", INK);
      poly(ctx, [[-7, -22 + breath], [-2, -13 + breath], [-7, -8 + breath], [-10, -16 + breath]], "#b68e98", INK);
    } else {
      const cap = look === "tamirci" ? "#c3a36e" : look === "balikci" ? "#566e68" : look === "fenerci" ? "#53687c" : "#bd7459";
      poly(ctx, [[-7, -24 + breath], [-6, -29 + breath], [0, -31 + breath], [6, -28 + breath], [7, -24 + breath]], cap, INK);
      line(ctx, -6, -24 + breath, 10, -24 + breath, cap, 3);
      line(ctx, 2, -23 + breath, 10, -23 + breath, INK, .9);
      line(ctx, -4, -28 + breath, 3, -28 + breath, "rgba(235,216,174,.45)");
    }
    const handY = look === "cayci" || look === "tamirci" ? 0 + gesture : 6 + gesture;
    limb([[7, -7 + breath], [12, -1], [14, handY]], 5.2, coat);
    oval(ctx, 14, handY + 1, 2.8, 3, skin, INK);
    if (look === "tamirci") {
      line(ctx, 13, handY + 2, 19, handY - 10, "#a6b5ad", 2.5);
      poly(ctx, [[16, handY - 10], [16, handY - 15], [18, handY - 12], [22, handY - 12], [23, handY - 15], [23, handY - 10]], "#a6b5ad", INK);
    } else if (look === "cayci") {
      oval(ctx, 19, handY + 1, 11, 2, "#c0a179", INK);
      poly(ctx, [[17, handY - 9], [23, handY - 9], [21, handY - 4], [22, handY], [18, handY]], "#b78261", INK);
      line(ctx, 20, handY - 12, 19, handY - 16 - Math.sin(t * 2), "rgba(221,218,195,.35)");
    } else if (look === "fenerci") {
      line(ctx, 14, handY + 3, 15, handY + 7, "#9b947b");
      glow(ctx, 15, handY + 15, 22, "rgba(245,198,118,.13)");
      box(ctx, 11, handY + 8, 8, 14, "#4b585b"); box(ctx, 13, handY + 10, 4, 9, WARM);
    } else if (look === "balikci") {
      line(ctx, 15, handY + 4, 17, handY + 14, "#a49b7c");
      poly(ctx, [[11, handY + 13], [23, handY + 13], [21, handY + 22], [13, handY + 22]], "#647c7d", INK);
    } else box(ctx, 11, handY - 2, 10, 7, "#e3d0a3");
    ctx.restore();
    if (active) {
      ctx.save();
      const name = String(npc.name || ""), role = String(npc.role || "");
      ctx.font = '600 12px "Segoe UI", sans-serif';
      const width = clamp(Math.max(ctx.measureText(name).width, ctx.measureText(role).width) + 24, 70, 260);
      const labelX = clamp(x, width / 2 + 6, W - width / 2 - 6), labelY = Math.max(10, y - 83);
      box(ctx, labelX - width / 2, labelY, width, 39, "rgba(15,33,43,.94)");
      line(ctx, labelX - width / 2, labelY + 39, labelX + width / 2, labelY + 39, "#baaa82");
      text(ctx, name, labelX, labelY + 15, 12, "#e3d5b4");
      text(ctx, role, labelX, labelY + 30, 10, "#a6bab8");
      ctx.restore();
    }
  }

  function drawMap(ctx, currentX, visitedIds = []) {
    if (!ctx) return;
    const visited = new Set(Array.isArray(visitedIds) ? visitedIds : []);
    const mx = x => 120 + clamp(finite(x), 0, END) / END * 1040;
    const coastY = x => 318 + Math.sin(x / END * Math.PI * 2.1) * 29 + Math.cos(x / END * Math.PI * 5) * 10;
    ctx.save(); ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    box(ctx, 0, 0, W, H, "rgba(6,18,27,.91)");
    const paper = ctx.createLinearGradient(0, 48, 0, 675);
    paper.addColorStop(0, "#d9ceb0"); paper.addColorStop(1, "#bfb799");
    poly(ctx, [[53, 56], [375, 51], [711, 57], [1220, 52], [1228, 364], [1220, 668],
      [873, 662], [540, 671], [57, 665], [51, 357]], paper, "#766e58", 2);
    for (let i = 0; i < 110; i++) {
      const x = 62 + noise(i + 100) * 1148, y = 70 + noise(i + 700) * 576;
      line(ctx, x, y, x + 3 + noise(i) * 13, y + .4, "rgba(88,86,66,.075)");
    }
    line(ctx, 437, 60, 431, 660, "rgba(112,103,78,.12)");
    line(ctx, 845, 60, 852, 660, "rgba(112,103,78,.12)");
    text(ctx, "GECE POSTASI · LİMAN ROTASI", 106, 107, 25, "#344b52", "left");
    text(ctx, "Depolardan fener burnuna", 108, 135, 13, "#637267", "left");
    const coast = [[95, 389]];
    for (let i = 0; i <= 48; i++) { const world = END * i / 48; coast.push([mx(world), coastY(world)]); }
    coast.push([1193, 400], [1193, 582], [95, 582]);
    poly(ctx, coast, "#849c9e", "#526d74", 2);
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 15; col++) {
        const x = 124 + col * 71 + row % 2 * 18, y = 428 + row * 23;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 8, y - 3, x + 16, y);
        ctx.strokeStyle = "rgba(46,84,93,.25)"; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    for (let i = 0; i < districts.length; i++) {
      const d = districts[i], centre = (d.from + d.to) / 2, x = mx(centre), y = coastY(centre);
      const color = visited.has(d.id) ? "#536d62" : "#717365";
      text(ctx, d.name.toLocaleUpperCase("tr-TR"), x, 197 + i % 2 * 19, 13, color);
      line(ctx, mx(d.from) + 8, 231, mx(d.to) - 8, 231, color, 2);
      ctx.save(); ctx.translate(x - 37, y - 21); ctx.scale(.37, .37);
      if (d.id === "rihtim") warehouse(ctx, 0, 0, 144, 92, 2);
      if (d.id === "pazar") { stall(ctx, 0, 0, 1); boat(ctx, 103, 21, 0, 1); }
      if (d.id === "vinc") { crane(ctx, 34, 0, 135, 1); container(ctx, 97, 0, 100, 32, "#627d7a"); }
      if (d.id === "dalgakiran") { rocks(ctx, 0, 0, 2, 7, 25); bell(ctx, 74, -12, 0); }
      if (d.id === "fener") { rocks(ctx, 0, 0, 5, 5, 25); lighthouse(ctx, 96, -5, 0, .62, false); }
      ctx.restore();
    }
    const route = [];
    for (let i = 0; i <= 64; i++) { const world = END * i / 64; route.push([mx(world), coastY(world) + 29]); }
    poly(ctx, route, null, "#e4d5ad", 7);
    ctx.setLineDash([7, 5]); poly(ctx, route, null, "#8a6b4d", 2); ctx.setLineDash([]);
    for (let i = 0; i < docks.length; i++) {
      const dock = docks[i], x = mx(dock.x), y = coastY(dock.x) + 29;
      line(ctx, x, y + 10, x, 404, "#52696a", 1.3);
      oval(ctx, x, y, 9, 9, visited.has(dock.id) ? "#657e6c" : "#cabf9b", "#52645e");
      if (visited.has(dock.id)) poly(ctx, [[x - 4, y], [x - 1, y + 3], [x + 5, y - 4]], null, "#ede2bc", 2);
      else text(ctx, String(i + 1), x, y + 4, 10, "#52645e");
      const labelX = clamp(x, 167, 1106);
      text(ctx, dock.name, labelX, 611, 14, "#3b5457");
      text(ctx, `${(dock.x / 1000).toFixed(2).replace(".", ",")} km`, labelX, 631, 11, "#68766b");
      line(ctx, x, 584, labelX, 596, "#7e826c");
    }
    const here = clamp(finite(currentX), 0, END), xx = mx(here), yy = coastY(here) + 29;
    oval(ctx, xx, yy, 15, 15, "rgba(185,108,74,.14)", "#b87b58");
    poly(ctx, [[xx, yy - 11], [xx + 7, yy], [xx, yy + 7], [xx - 7, yy]], "#b66a48", "#f0d8ad", 1.5);
    const labelX = clamp(xx, 176, 1104);
    box(ctx, labelX - 52, yy + 18, 104, 22, "#d8ccaa");
    text(ctx, "BURADASIN", labelX, yy + 33, 10, "#7b523b");
    // Hand-inked compass and scale complete a usable chart without UI controls.
    const cx = 1135, cy = 116;
    poly(ctx, [[cx, cy - 28], [cx + 7, cy], [cx, cy + 21], [cx - 7, cy]], "#5b706e", "#4c6060");
    poly(ctx, [[cx - 21, cy], [cx, cy - 6], [cx + 21, cy], [cx, cy + 6]], "#ada98b", "#5b706e");
    text(ctx, "K", cx, cy - 34, 12, "#4c6060");
    text(ctx, "AÇIK DENİZ", 678, 523, 17, "rgba(42,76,87,.57)");
    line(ctx, 915, 553, 1094, 553, "#465f63", 2);
    for (let i = 0; i < 3; i++) line(ctx, 915 + i * 89.5, 548, 915 + i * 89.5, 558, "#465f63");
    text(ctx, "3 km", 1004, 573, 11, "#465f63");
    ctx.restore();
  }
  globalThis.HarborWorld = Object.freeze({ districts, docks, districtAt, drawBackground, drawDock, drawNPC, drawMap, drawGlow });
})();
