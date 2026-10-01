"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async function checkWater(page) {
  // Isolate water batching from separately tested offscreen compositing and palette rounding.
  const source = fs.readFileSync(path.join(__dirname, "..", "harbor-world.js"), "utf8")
    .replace("const layers = getStaticLayers(ctx, cam, focus);", "const layers = null;")
    .replace("const sprite = glowSprite(radius, tint.color);", "const sprite = null;");
  // Preserve the previous water renderer for bounded pixel differences and paired timings.
  const oldWater = `for (let row = 0; row < 9; row++) {
    const y = 562 + row * 19;
    for (let i = 0; i < 29; i++) {
      const x = mod(i * 49 - cam * (.35 + row * .02) + Math.sin(t + row) * 7, W + 70) - 35;
      line(ctx, x, y + Math.sin(t * .9 + i + row) * 2, x + 10 + noise(i + row) * 23, y,
        row % 3 ? "rgba(133,174,187,.13)" : "rgba(160,188,198,.20)");
    }
  }`;
  const waterBlock = /const waterSoft = new Path2D\(\), waterBright = new Path2D\(\);[\s\S]*?ctx\.stroke\(waterBright\);/;
  assert.match(source, waterBlock, "Water comparison must find the batched renderer");
  await page.addScriptTag({ content: source.replace(waterBlock, oldWater).replace("globalThis.HarborWorld =", "globalThis.HarborWorldBefore =") });
  await page.addScriptTag({ content: source.replace("globalThis.HarborWorld =", "globalThis.HarborWorldWater =") });
  const report = await page.evaluate(async () => {
    const before = document.createElement("canvas"), after = document.createElement("canvas");
    before.width = after.width = 1280; before.height = after.height = 720;
    const contexts = [before.getContext("2d", { alpha: false }), after.getContext("2d", { alpha: false })];
    const worlds = [globalThis.HarborWorldBefore, globalThis.HarborWorldWater];
    const counts = [0, 0];
    contexts.forEach((ctx, i) => {
      const stroke = ctx.stroke.bind(ctx);
      ctx.stroke = (...args) => {
        if (["rgba(133, 174, 187, 0.13)", "rgba(160, 188, 198, 0.2)"].includes(ctx.strokeStyle)) counts[i]++;
        stroke(...args);
      };
    });
    const quant = (samples, p) => [...samples].sort((a, b) => a - b)[Math.floor(samples.length * p)];
    const scenes = [];
    let changedPixels = 0;
    let maxChannelDifference = 0;
    let changedPixelsOutsideWater = 0;
    const examples = [];
    for (const focus of [1600, 4700, 8200, 13400, 16600]) {
      for (const time of [0, 12, 47.25]) {
        worlds.forEach((world, i) => world.drawBackground(contexts[i], focus - 460, time, focus));
        const a = contexts[0].getImageData(0, 0, 1280, 720).data;
        const b = contexts[1].getImageData(0, 0, 1280, 720).data;
        for (let i = 0; i < a.length; i += 4) {
          if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) {
            changedPixels++;
            const y = Math.floor(i / 4 / 1280);
            if (y < 560 || y > 716) changedPixelsOutsideWater++;
            for (let c = 0; c < 4; c++) maxChannelDifference = Math.max(maxChannelDifference, Math.abs(a[i + c] - b[i + c]));
            if (examples.length < 5) examples.push({ focus, time, x: i / 4 % 1280, y: Math.floor(i / 4 / 1280), before: Array.from(a.slice(i, i + 4)), after: Array.from(b.slice(i, i + 4)) });
          }
        }
      }
      const costs = [[], []];
      for (let frame = 0; frame < 150; frame++) {
        await new Promise(resolve => window.__nativeRAF(resolve));
        for (const i of frame % 2 ? [1, 0] : [0, 1]) {
          const start = performance.now();
          worlds[i].drawBackground(contexts[i], focus - 460 + frame * .5, frame / 60, focus);
          if (frame >= 30) costs[i].push(performance.now() - start);
        }
      }
      scenes.push({ focus, beforeP95: quant(costs[0], .95), beforeP99: quant(costs[0], .99),
        afterP95: quant(costs[1], .95), afterP99: quant(costs[1], .99) });
    }
    return { changedPixels, changedPixelsOutsideWater, maxChannelDifference, examples, comparedFrames: 15, waterStrokesPerFrame: counts.map(count => count / (5 * 153)), scenes };
  });
  fs.writeFileSync(path.join(__dirname, "evidence", "water-batching-report.json"), JSON.stringify(report, null, 2));
  // The owner accepted the measured 234-pixel, 9/255-channel difference on these scenes.
  // Keep explicit bounds and require exact geometry separately in check-world.
  assert.equal(report.changedPixelsOutsideWater, 0, "Pixels outside the water must remain identical");
  assert(report.changedPixels <= 234, "Pixel differences must stay within the accepted sample");
  assert(report.maxChannelDifference <= 9, "Color differences must stay within the accepted 9/255 bound");
  assert.deepEqual(report.waterStrokesPerFrame, [261, 2]);
  console.log("Water batching checks passed: bounded accepted pixel differences, water strokes 261 -> 2.");
  console.log(JSON.stringify(report, null, 2));
};

if (require.main === module) {
  (async () => {
    const { chromium } = require("playwright");
    const { launchBrave } = require("./browser-launch.cjs");
    const { pathToFileURL } = require("node:url");
    const browser = await launchBrave(chromium);
    try {
      const page = await browser.newPage();
      await page.addInitScript(() => {
        window.__nativeRAF = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = () => 0;
      });
      await page.goto(pathToFileURL(path.join(__dirname, "..", "index.html")).href);
      await module.exports(page);
    } finally { await browser.close(); }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
