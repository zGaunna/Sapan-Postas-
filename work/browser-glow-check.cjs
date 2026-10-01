"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async function checkGlowSprites(page) {
  const source = fs.readFileSync(path.join(__dirname, "..", "harbor-world.js"), "utf8");
  await page.addScriptTag({ content: source.replace("globalThis.HarborWorld =", "globalThis.HarborGlowTest =") });
  await page.addScriptTag({ content: source.replace("const sprite = glowSprite(radius, tint.color);", "const sprite = null;")
    .replace("globalThis.HarborWorld =", "globalThis.HarborGlowDirect =") });
  const report = await page.evaluate(async () => {
    const createElement = document.createElement.bind(document);
    const canvas = createElement("canvas"); canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext("2d");
    const counts = { canvases: 0, gradients: 0 };
    document.createElement = (...args) => {
      const image = createElement(...args);
      if (args[0] === "canvas") {
        counts.canvases++;
        const paint = image.getContext("2d"), radial = paint.createRadialGradient.bind(paint);
        paint.createRadialGradient = (...values) => { counts.gradients++; return radial(...values); };
      }
      return image;
    };
    const world = globalThis.HarborGlowTest, snapshots = {};
    const state = () => ({ alpha: ctx.globalAlpha, composite: ctx.globalCompositeOperation,
      fill: ctx.fillStyle, stroke: ctx.strokeStyle, dash: ctx.getLineDash(), transform: Array.from(ctx.getTransform().toFloat64Array()) });
    ctx.globalAlpha = .37; ctx.globalCompositeOperation = "multiply"; ctx.setLineDash([3, 7]); ctx.translate(2, 5);
    const before = state(), blits = [], drawImage = ctx.drawImage.bind(ctx);
    ctx.drawImage = (...args) => { blits.push({ x: args[1], y: args[2], alpha: ctx.globalAlpha, composite: ctx.globalCompositeOperation }); drawImage(...args); };
    try {
      for (let i = 0; i < 240; i++) world.drawGlow(ctx, 80.75, 90.25, 18, `rgba(85,214,207,${.1 + i / 1000})`, true);
      snapshots.animated = { ...counts };
      snapshots.statePreserved = JSON.stringify(before) === JSON.stringify(state());
      snapshots.firstBlit = blits[0];
      for (let i = 0; i < 40; i++) world.drawGlow(ctx, 80, 90, 18, `rgb(${i},1,2)`);
      snapshots.full = { ...counts };
      world.drawGlow(ctx, 80, 90, 18, "rgb(39,1,2)"); snapshots.recent = { ...counts };
      world.drawGlow(ctx, 80, 90, 18, "rgb(0,1,2)"); snapshots.evicted = { ...counts };
      const fx = new globalThis.MotionFX(); fx.flash = .2;
      const fxBefore = JSON.stringify(fx);
      for (let i = 0; i < 120; i++) fx.drawFlash(ctx, 1280, 720);
      snapshots.flash = { ...counts }; snapshots.flashPure = fxBefore === JSON.stringify(fx);
      fx.flashColor = "255,211,131"; fx.drawFlash(ctx, 1280, 720);
      snapshots.secondFlash = { ...counts };
      fx.drawFlash(ctx, 1024, 600); snapshots.resized = { ...counts };
      fx.reduced = true; fx.drawFlash(ctx, 900, 500); snapshots.reduced = { ...counts };
    } finally { document.createElement = createElement; ctx.drawImage = drawImage; }
    ctx.resetTransform(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    const quantile = (values, p) => values.sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))];
    const timings = [];
    for (const focus of [1460, 4700, 8200, 13400, 16600]) {
      const samples = { direct: [], sprite: [] };
      for (let i = 0; i < 180; i++) {
        await new Promise(resolve => window.__nativeRAF(resolve));
        // Alternate order to reduce bias from warm-up and browser scheduling.
        for (const mode of i % 2 ? ["sprite", "direct"] : ["direct", "sprite"]) {
          const renderer = mode === "sprite" ? world : globalThis.HarborGlowDirect;
          const start = performance.now(); renderer.drawBackground(ctx, focus - 460, i / 60, focus);
          const elapsed = performance.now() - start;
          if (i >= 30) samples[mode].push(elapsed);
        }
      }
      timings.push({ focus, direct: { p95: quantile(samples.direct, .95), p99: quantile(samples.direct, .99) },
        sprite: { p95: quantile(samples.sprite, .95), p99: quantile(samples.sprite, .99) } });
    }
    return { snapshots, timings };
  });
  const s = report.snapshots;
  assert.deepEqual(s.animated, { canvases: 1, gradients: 1 });
  assert.equal(s.statePreserved, true);
  assert.deepEqual(s.firstBlit, { x: 62, y: 72, alpha: .037, composite: "lighter" });
  assert.deepEqual(s.recent, s.full);
  assert.equal(s.evicted.gradients, s.full.gradients + 1);
  assert.equal(s.flash.gradients, s.evicted.gradients + 1);
  assert.equal(s.flashPure, true);
  assert.equal(s.secondFlash.gradients, s.flash.gradients + 1);
  assert.equal(s.resized.gradients, s.secondFlash.gradients + 1);
  assert.deepEqual(s.reduced, s.resized);
  fs.mkdirSync(path.join(__dirname, "evidence"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "evidence", "glow-sprite-report.json"), JSON.stringify(report, null, 2));
  console.log("Glow-sprite checks passed: animated alpha reuse, bounded eviction, additive draw, restored Canvas state, pure flash, resize and reduced motion.");
  console.log(JSON.stringify(report.timings));
};
