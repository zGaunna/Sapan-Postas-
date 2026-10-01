"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async function checkStaticLayers(page) {
  const source = fs.readFileSync(path.join(__dirname, "..", "harbor-world.js"), "utf8");
  const cacheCall = "const layers = getStaticLayers(ctx, cam, focus);";
  assert(source.includes(cacheCall), "Static comparison must disable exactly the cache call");
  await page.addScriptTag({ content: source.replace(cacheCall, "const layers = null;")
    .replace("globalThis.HarborWorld =", "globalThis.HarborWorldDirect =") });
  // Integer blits and palette quantization intentionally change whole-frame pixels.
  // Compare the unaffected foreground independently, with the same empty base on both sides.
  const prefix = /ctx\.beginPath\(\); ctx\.rect\(0, 0, W, H\); ctx\.clip\(\);[\s\S]*?const water = ctx\.createLinearGradient\(0, 553, 0, H\);/;
  assert.match(source, prefix);
  const foregroundSource = source.replace(prefix, "ctx.clearRect(0, 0, W, H); ctx.globalAlpha = 1; const moonX = 1030 - cam * .008; const water = ctx.createLinearGradient(0, 553, 0, H);");
  await page.addScriptTag({ content: foregroundSource.replace(cacheCall, "const layers = null;")
    .replace("globalThis.HarborWorld =", "globalThis.HarborForegroundDirect =") });
  await page.addScriptTag({ content: foregroundSource.replace("globalThis.HarborWorld =", "globalThis.HarborForegroundCached =") });
  const report = await page.evaluate(async () => {
    const createElement = document.createElement.bind(document);
    const makeCanvas = () => {
      const c = createElement("canvas"); c.width = 1280; c.height = 720;
      return c;
    };
    const probe = makeCanvas().getContext("2d", { alpha: false });
    // Warm the independent glow cache before counting only static layer allocations.
    const warm = makeCanvas().getContext("2d");
    for (const focus of [1460, 4700, 8200, 13400, 16600]) globalThis.HarborWorld.drawBackground(warm, focus - 460, 0, focus);
    const created = [], blits = [];
    const nativeDrawImage = probe.drawImage.bind(probe);
    probe.drawImage = (...args) => { blits.push(args.slice(1)); nativeDrawImage(...args); };
    document.createElement = (...args) => {
      const c = createElement(...args);
      if (args[0] === "canvas") {
        const ctx = c.getContext("2d"), count = { c, gradients: 0, glows: 0, clears: 0 };
        for (const [name, counter] of [["createLinearGradient", "gradients"], ["createRadialGradient", "glows"], ["clearRect", "clears"]]) {
          const native = ctx[name].bind(ctx);
          ctx[name] = (...values) => { count[counter]++; return native(...values); };
        }
        created.push(count);
      }
      return c;
    };
    const counts = () => created.map(c => [c.gradients, c.glows, c.clears]);
    const snapshots = {};
    try {
      globalThis.HarborWorld.drawBackground(probe, 1000, 0, 1460);
      snapshots.cold = counts();
      for (let i = 1; i <= 120; i++) globalThis.HarborWorld.drawBackground(probe, 1000 + i * .1, i / 60, 1460);
      snapshots.warm = counts();
      globalThis.HarborWorld.drawBackground(probe, 1000, 0, 3600);
      snapshots.palette = counts();
      globalThis.HarborWorld.drawBackground(probe, 1000, 1, 3600.01);
      snapshots.sameBin = counts();
      globalThis.HarborWorld.drawBackground(probe, 1000, 1, 3630);
      snapshots.nextBin = counts();
      globalThis.HarborWorld.drawBackground(probe, 2048 / .22 - .01, 1, 3630);
      snapshots.beforeChunk = counts();
      globalThis.HarborWorld.drawBackground(probe, 2048 / .22 + .01, 1, 3630);
      snapshots.afterChunk = counts();
      globalThis.HarborWorld.drawBackground(probe, -500, 1, 3630);
      snapshots.backward = counts();
    } finally { document.createElement = createElement; }
    // Pin the readback backend; repeated getImageData otherwise changes Canvas acceleration.
    const contexts = [makeCanvas().getContext("2d", { alpha: false, willReadFrequently: true }),
      makeCanvas().getContext("2d", { alpha: false, willReadFrequently: true })];
    const timingContexts = [makeCanvas().getContext("2d", { alpha: false }), makeCanvas().getContext("2d", { alpha: false })];
    const foregroundContexts = [makeCanvas().getContext("2d", { alpha: false, willReadFrequently: true }),
      makeCanvas().getContext("2d", { alpha: false, willReadFrequently: true })];
    const worlds = [globalThis.HarborWorldDirect, globalThis.HarborWorld];
    const traces = worlds.map(world => {
      const ctx = makeCanvas().getContext("2d", { alpha: false }), trace = [], gradients = new WeakMap();
      let active = false;
      for (const method of ["createLinearGradient", "createRadialGradient"]) {
        const native = ctx[method].bind(ctx);
        ctx[method] = (...args) => {
          const gradient = native(...args), stops = [];
          gradients.set(gradient, [method, args, stops]);
          const add = gradient.addColorStop.bind(gradient);
          gradient.addColorStop = (...stop) => { stops.push(stop); add(...stop); };
          return gradient;
        };
      }
      for (const method of ["fillRect", "beginPath", "moveTo", "lineTo", "closePath", "ellipse", "fill", "stroke", "save", "restore", "translate", "rotate", "scale"]) {
        const native = ctx[method].bind(ctx);
        ctx[method] = (...args) => {
          if (method === "fillRect" && args[1] === 553 && args[2] === 1280) active = true;
          if (active) trace.push([method, args.map(v => typeof v === "object" ? "path" : v),
            gradients.get(ctx.fillStyle) || ctx.fillStyle, ctx.strokeStyle, ctx.lineWidth, ctx.globalAlpha, ctx.lineJoin, ctx.lineCap]);
          return native(...args);
        };
      }
      world.drawBackground(ctx, 4700 - 460, 47.25, 4700);
      return trace;
    });
    const traceDifferences = [];
    for (let i = 0; i < Math.max(traces[0].length, traces[1].length); i++) {
      if (JSON.stringify(traces[0][i]) !== JSON.stringify(traces[1][i]) && traceDifferences.length < 5) traceDifferences.push({ i, before: traces[0][i], after: traces[1][i] });
    }
    const quant = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(a.length * p)];
    const scenes = [];
    let changedPixels = 0, changedPixelsInWater = 0, maxWaterChannelDifference = 0;
    let foregroundPixelDifferences = 0;
    let maxWaterExample = null;
    for (const focus of [1600, 4700, 8200, 13400, 16600]) {
      for (const t of [0, 12, 47.25]) {
        globalThis.HarborForegroundDirect.drawBackground(foregroundContexts[0], focus - 460, t, focus);
        globalThis.HarborForegroundCached.drawBackground(foregroundContexts[1], focus - 460, t, focus);
        const frontA = foregroundContexts[0].getImageData(0, 0, 1280, 720).data;
        const frontB = foregroundContexts[1].getImageData(0, 0, 1280, 720).data;
        for (let i = 0; i < frontA.length; i++) if (frontA[i] !== frontB[i]) foregroundPixelDifferences++;
        worlds.forEach((world, i) => world.drawBackground(contexts[i], focus - 460, t, focus));
        const a = contexts[0].getImageData(0, 0, 1280, 720).data;
        const b = contexts[1].getImageData(0, 0, 1280, 720).data;
        for (let i = 0; i < a.length; i += 4) {
          if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) {
            changedPixels++;
            if (Math.floor(i / 4 / 1280) >= 553) {
              changedPixelsInWater++;
              for (let c = 0; c < 3; c++) if (Math.abs(a[i + c] - b[i + c]) > maxWaterChannelDifference) {
                maxWaterChannelDifference = Math.abs(a[i + c] - b[i + c]);
                maxWaterExample = { focus, t, x: i / 4 % 1280, y: Math.floor(i / 4 / 1280), before: Array.from(a.slice(i, i + 4)), after: Array.from(b.slice(i, i + 4)) };
              }
            }
          }
        }
      }
      const costs = [[], []];
      for (let frame = 0; frame < 150; frame++) {
        await new Promise(resolve => window.__nativeRAF(resolve));
        for (const i of frame % 2 ? [1, 0] : [0, 1]) {
          const start = performance.now();
          worlds[i].drawBackground(timingContexts[i], focus - 460 + frame * .5, frame / 60, focus);
          if (frame >= 30) costs[i].push(performance.now() - start);
        }
      }
      scenes.push({ focus, beforeP95: quant(costs[0], .95), beforeP99: quant(costs[0], .99),
        afterP95: quant(costs[1], .95), afterP99: quant(costs[1], .99) });
    }
    // Include invalidations in a transition workload, not only warm-cache samples.
    const transition = [[], []];
    const transitionFrames = [];
    for (let frame = 0; frame < 180; frame++) {
      await new Promise(resolve => window.__nativeRAF(resolve));
      const focus = 3150 + frame * 5;
      for (const i of frame % 2 ? [1, 0] : [0, 1]) {
        const start = performance.now(); worlds[i].drawBackground(timingContexts[i], focus - 460, frame / 60, focus);
        transition[i].push(performance.now() - start);
      }
      transitionFrames.push({ frame, focus, before: transition[0][frame], after: transition[1][frame] });
    }
    const sample = focus => {
      worlds.forEach((world, i) => world.drawBackground(contexts[i], focus - 460, 12, focus));
      return contexts.map(ctx => ctx.canvas.toDataURL());
    };
    return { allocations: created.length, sizes: created.map(c => [c.c.width, c.c.height]), snapshots, traceDifferences, foregroundPixelDifferences,
      integerBlits: blits.every(values => values.every(Number.isInteger)), changedPixels, changedPixelsInWater, maxWaterChannelDifference, maxWaterExample, scenes,
      transition: { beforeP95: quant(transition[0], .95), beforeP99: quant(transition[0], .99),
        afterP95: quant(transition[1], .95), afterP99: quant(transition[1], .99),
        slowestCachedFrames: transitionFrames.sort((a, b) => b.after - a.after).slice(0, 5) }, previews: sample(8200) };
  });
  const previews = report.previews; delete report.previews;
  for (let i = 0; i < 2; i++) fs.writeFileSync(path.join(__dirname, "evidence", `static-${i ? "cached" : "direct"}.png`), Buffer.from(previews[i].split(",")[1], "base64"));
  fs.writeFileSync(path.join(__dirname, "evidence", "static-layer-report.json"), JSON.stringify(report, null, 2));
  assert.equal(report.allocations, 3, "Layers must reuse the same three canvases");
  assert.deepEqual(report.sizes, [[1280, 720], [216, 216], [4096, 180]]);
  assert.deepEqual(report.snapshots.cold, [[1, 0, 0], [0, 0, 1], [0, 0, 1]]);
  assert.deepEqual(report.snapshots.warm, report.snapshots.cold, "Animation and camera drift must not repaint static layers");
  assert.deepEqual(report.snapshots.sameBin, report.snapshots.palette, "A 1/32 palette bin must reuse its layers");
  assert.equal(report.snapshots.nextBin[0][0], report.snapshots.palette[0][0] + 1);
  assert.equal(report.snapshots.afterChunk[2][2], report.snapshots.beforeChunk[2][2] + 1);
  assert.equal(report.snapshots.backward[2][2], report.snapshots.afterChunk[2][2] + 1);
  assert.equal(report.integerBlits, true);
  assert.deepEqual(report.traceDifferences, [], "Foreground commands must remain identical after caching the earlier layers");
  assert.equal(report.foregroundPixelDifferences, 0, "The isolated water and foreground must remain pixel-identical");
  console.log("Static-layer checks passed: three reused canvases, quantized palette, chunk invalidation, backward travel, integer blits and unchanged foreground geometry.");
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
