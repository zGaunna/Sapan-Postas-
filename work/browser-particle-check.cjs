"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");

module.exports = async function checkParticleBatching(page) {
  const report = await page.evaluate(async () => {
    const colors = ["#8ce9de", "#cfe8d9", "#ffc36b", "#ffdc92", "#70e0ca", "#ff917e", "#8bbdc9", "#ee967e"];
    const a = new globalThis.MotionFX(), b = new globalThis.MotionFX();
    for (const fx of [a, b]) {
      for (let n = 0; n < 10; n++) for (const kind of ["attach", "boost", "water"]) fx.burst(kind, 600, 400, 350, -200);
      fx.update(.05, null); fx.rings.length = 0;
      for (let i = 0; i < fx.particles.live; i++) fx.particles.age[i] = fx.particles.life[i] * (i % 16) / 16;
    }
    const make = read => { const c = document.createElement("canvas"); c.width = 1280; c.height = 720; return c.getContext("2d", { willReadFrequently: read }); };
    const left = make(true), right = make(true), ctx = make(false);
    a.draw(left, 0); b.draw(right, 0);
    const pixelsA = left.getImageData(0, 0, 1280, 720).data, pixelsB = right.getImageData(0, 0, 1280, 720).data;
    let differences = 0;
    for (let i = 0; i < pixelsA.length; i++) if (pixelsA[i] !== pixelsB[i]) differences++;
    const direct = () => {
      const pool = a.particles;
      ctx.save(); ctx.lineCap = "round";
      for (let i = 0; i < pool.live; i++) {
        ctx.globalAlpha = (1 - pool.age[i] / pool.life[i]) ** 1.5;
        ctx.strokeStyle = colors[pool.color[i]]; ctx.lineWidth = pool.size[i];
        ctx.beginPath(); ctx.moveTo(pool.px[i], pool.py[i]); ctx.lineTo(pool.x[i] + .3, pool.y[i]); ctx.stroke();
      }
      ctx.restore();
    };
    let strokes = 0; const stroke = ctx.stroke.bind(ctx);
    ctx.stroke = () => { strokes++; stroke(); };
    direct(); const directStrokes = strokes; strokes = 0;
    const before = JSON.stringify(a);
    ctx.globalAlpha = .31; ctx.lineWidth = 7; ctx.strokeStyle = "#123456";
    a.draw(ctx, 0); const batchStrokes = strokes;
    const restored = ctx.globalAlpha === .31 && ctx.lineWidth === 7 && ctx.strokeStyle === "#123456";
    ctx.stroke = stroke; ctx.globalAlpha = 1;
    const samples = { direct: [], batched: [] };
    for (let frame = 0; frame < 180; frame++) {
      await new Promise(resolve => window.__nativeRAF(resolve));
      for (const mode of frame % 2 ? ["direct", "batched"] : ["batched", "direct"]) {
        ctx.clearRect(0, 0, 1280, 720);
        const start = performance.now();
        if (mode === "direct") direct(); else a.draw(ctx, 0);
        if (frame >= 30) samples[mode].push(performance.now() - start);
      }
    }
    const quantile = (values, p) => [...values].sort((x, y) => x - y)[Math.floor(values.length * p)];
    return { live: a.particles.live, directStrokes, batchStrokes, sameSeedPixelDifferences: differences,
      restored, pure: before === JSON.stringify(a),
      direct: { p95: quantile(samples.direct, .95), p99: quantile(samples.direct, .99) },
      batched: { p95: quantile(samples.batched, .95), p99: quantile(samples.batched, .99) } };
  });
  assert.equal(report.directStrokes, 220);
  assert.ok(report.batchStrokes > 0 && report.batchStrokes <= 12);
  assert.equal(report.sameSeedPixelDifferences, 0);
  assert.equal(report.restored, true); assert.equal(report.pure, true);
  fs.writeFileSync(path.join(__dirname, "evidence/particle-pool-report.json"), JSON.stringify(report, null, 2));
  console.log("Particle browser checks passed: same-seed pixels, 220 particles, color/alpha batching, pure drawing and restored Canvas state.");
  console.log(JSON.stringify(report));
};
