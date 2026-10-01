const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.argv[2] || "playwright");
const { launchBrave } = require("./browser-launch.cjs");

(async () => {
  const output = path.join(__dirname, "evidence");
  fs.mkdirSync(output, { recursive: true });
  const browser = await launchBrave(chromium);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const url = process.env.GAME_URL || "http://127.0.0.1:8765";
  await page.goto(url);
  await page.waitForSelector("#start-button", { state: "visible" });
  assert.equal(await page.title(), "Sapan Postası");
  await page.screenshot({ path: path.join(output, "menu.png") });
  await page.locator('[data-practice-start="0"]').click();
  await page.keyboard.down("Space");
  await page.keyboard.down("d");
  await page.waitForTimeout(260);
  await page.screenshot({ path: path.join(output, "real-input.png") });
  await page.keyboard.up("Space"); await page.keyboard.up("d");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#pause-screen").isVisible(), true);
  const first = await page.locator("#game").evaluate(canvas => canvas.toDataURL());
  await page.waitForTimeout(180);
  assert.equal(await page.locator("#game").evaluate(canvas => canvas.toDataURL()), first, "Paused animation must freeze");
  await page.locator("#resume-button").click();
  await page.locator("#pause-screen").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#pause-screen").isVisible(), false);
  assert.equal(await page.locator("#touch-controls").isVisible(), false);

  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.locator("#fullscreen-toggle").click();
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  await page.waitForTimeout(100);
  const margin = await page.locator("#game").evaluate(canvas => {
    const ctx = canvas.getContext("2d");
    return Array.from(ctx.getImageData(80, Math.floor(canvas.height/2), 1, 1).data);
  });
  assert.deepEqual(margin, [6, 25, 35, 255], "Ultrawide fullscreen margins must remain clean");
  await page.screenshot({ path: path.join(output, "ultrawide.png") });
  await page.keyboard.press("f");
  await page.waitForFunction(() => !document.fullscreenElement);
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.goto(url + "/work/browser-playtest.html");
  await page.evaluate(() => window.__playtest.resetRun(0));
  const trauma = await page.evaluate(() => {
    const g = window.__playtest, canvas = document.querySelector("#game"), ctx = canvas.getContext("2d");
    const bodyBefore = JSON.stringify(g.player), translations = [], translate = ctx.translate.bind(ctx);
    ctx.translate = (x, y) => { translations.push([x, y]); translate(x, y); };
    g.effects.reset(); g.effects.burst("hurt", g.player.x, g.player.y);
    const active = g.effects.offset(), fxBefore = JSON.stringify(g.effects);
    try {
      g.draw(0); const activeApplied = translations.some(([x, y]) => x === active.x && y === active.y);
      const pure = fxBefore === JSON.stringify(g.effects);
      g.effects.reduced = true; translations.length = 0; g.draw(0);
      return { activeApplied, pure, reduced: g.effects.offset(), playerUnchanged: bodyBefore === JSON.stringify(g.player) };
    } finally { ctx.translate = translate; g.resetRun(0); }
  });
  assert.equal(trauma.activeApplied, true);
  assert.equal(trauma.pure, true);
  assert.deepEqual(trauma.reduced, { x: 0, y: 0 });
  assert.equal(trauma.playerUnchanged, true);
  const rope = await page.evaluate(() => {
    const g = window.__playtest, ctx = document.querySelector("#game").getContext("2d");
    g.resetRun(0); if (g.effects.reduced) document.querySelector("#motion-toggle").click();
    g.beginTether(); for (let i = 0; i < 30; i++) g.update(1 / 120);
    g.setCamera(0);
    const hand = g.visualHand(g.rendered.x, g.rendered.y, g.renderAlpha()), anchor = g.tetherAnchor();
    const moves = [], curves = [], moveTo = ctx.moveTo.bind(ctx), quadratic = ctx.quadraticCurveTo.bind(ctx);
    ctx.moveTo = (...args) => { moves.push(args); moveTo(...args); };
    ctx.quadraticCurveTo = (...args) => { curves.push(args); quadratic(...args); };
    const before = JSON.stringify({ player: g.player, rope: g.visualRope });
    try {
      g.drawRope(g.nearestAnchor());
      const pure = before === JSON.stringify({ player: g.player, rope: g.visualRope });
      const fullCurves = curves.length, start = moves[0], end = curves.at(-1).slice(2);
      document.querySelector("#motion-toggle").click(); curves.length = 0; g.drawRope(g.nearestAnchor());
      const reducedCurves = curves.length;
      document.querySelector("#motion-toggle").click(); g.update(1 / 120); g.draw(0);
      return { pure, fullCurves, reducedCurves, start, end, hand, anchor: { x: anchor.x, y: anchor.y } };
    } finally { ctx.moveTo = moveTo; ctx.quadraticCurveTo = quadratic; }
  });
  assert.equal(rope.pure, true); assert.equal(rope.fullCurves, 11); assert.equal(rope.reducedCurves, 1);
  assert.deepEqual(rope.start, [rope.hand.x, rope.hand.y]);
  assert.deepEqual(rope.end, [rope.anchor.x, rope.anchor.y]);
  await page.screenshot({ path: path.join(output, "rope-attached.png") });
  const release = await page.evaluate(() => {
    const g = window.__playtest; g.releaseTether({ award: false }); g.update(1 / 120); g.syncVisualPosition(); g.draw(0);
    return g.visualRopeState();
  });
  assert.ok(release.release > 0);
  await page.screenshot({ path: path.join(output, "rope-release.png") });
  const squash = await page.evaluate(() => {
    const g = window.__playtest, ctx = document.querySelector("#game").getContext("2d");
    g.resetRun(0); g.beginTether(); for (let i = 0; i < 8; i++) g.update(1 / 120); g.setCamera(0);
    const scales = [], scale = ctx.scale.bind(ctx), beforeTransform = ctx.getTransform().toFloat64Array();
    ctx.scale = (x, y) => { scales.push([x, y]); scale(x, y); };
    const before = JSON.stringify({ body: g.player, spring: g.squash, rig: g.courier.snapshot() });
    try {
      const s = g.squashValue(g.renderAlpha()); g.drawPlayer();
      const applied = scales.some(([x, y]) => x === 1 - s * .6 && y === 1 + s);
      const restored = JSON.stringify(Array.from(beforeTransform)) === JSON.stringify(Array.from(ctx.getTransform().toFloat64Array()));
      const pure = before === JSON.stringify({ body: g.player, spring: g.squash, rig: g.courier.snapshot() });
      document.querySelector("#motion-toggle").click(); scales.length = 0; g.drawPlayer();
      const reduced = scales.every(([x, y]) => x === 1 && y === 1);
      document.querySelector("#motion-toggle").click(); g.resetRun(0); g.beginTether();
      for (let i = 0; i < 8; i++) g.update(1 / 120);
      g.syncVisualPosition(); g.draw(0);
      return { applied, restored, pure, reduced, s };
    } finally { ctx.scale = scale; }
  });
  assert.ok(squash.s < 0); assert.equal(squash.applied, true); assert.equal(squash.restored, true);
  assert.equal(squash.pure, true); assert.equal(squash.reduced, true);
  await page.screenshot({ path: path.join(output, "courier-squash.png") });
  const route = await page.evaluate(() => {
    const g = window.__playtest;
    g.resetRun(-1);
    const policy = { 2: { reelTo: 150, offset: -30 }, 13: { reelTo: 220, offset: 70 }, 21: { reelTo: 145, offset: 40 } };
    const samples = []; const costs = [];
    for (let step = 0; step < 15000 && g.state() === "playing"; step++) {
      if (g.recoveryReady()) g.startRecovery();
      g.keys.clear(); g.keys.add("KeyD");
      const anchor = g.tetherAnchor();
      if (!anchor) g.beginTether();
      else {
        const p = policy[anchor.id] || { reelTo: 150, offset: -30 };
        if (g.ropeLength() > p.reelTo) g.keys.add("KeyW");
        if (g.player.y > anchor.y && g.player.x - anchor.x >= p.offset && g.player.vx > 140) g.releaseTether();
      }
      const start = performance.now();
      g.update(1 / 120); g.draw(step / 120);
      if (step > 300) costs.push(performance.now() - start);
      if (step % 120 === 0) samples.push({ x: g.player.x, y: g.player.y, state: g.state() });
    }
    costs.sort((a, b) => a - b);
    return { state: g.state(), seals: g.seals.filter(s => s.collected).length,
      seconds: g.runTime(), frames: costs.length, median: costs[Math.floor(costs.length * 0.5)],
      p95: costs[Math.floor(costs.length * 0.95)], max: costs.at(-1), samples };
  });
  assert.equal(route.state, "won"); assert.equal(route.seals, 3);
  await page.screenshot({ path: path.join(output, "delivery.png") });

  await page.evaluate(() => {
    const g = window.__playtest;
    g.resetRun(0); g.beginTether(); g.keys.add("KeyD"); g.keys.add("KeyW");
    for (let i = 0; i < 60; i++) g.update(1 / 120);
    g.draw(0.5);
  });
  await page.screenshot({ path: path.join(output, "swing.png") });
  await page.evaluate(() => {
    const g = window.__playtest;
    g.releaseTether();
    for (let i = 0; i < 15; i++) g.update(1 / 120);
    g.draw(0.625);
  });
  await page.screenshot({ path: path.join(output, "release.png") });

  await page.evaluate(() => {
    document.body.innerHTML = '<canvas id="poses" width="1560" height="700" style="width:1560px;height:700px"></canvas>';
    const ctx = document.querySelector("#poses").getContext("2d");
    ctx.fillStyle = "#0b2430"; ctx.fillRect(0, 0, 1560, 700);
    const poses = [
      { label: "BEKLEME", q: { waiting: true } },
      { label: "TUTUNMA", q: { vx: 260, vy: 80, attached: true, taut: true, anchorDX: 180, anchorDY: -200 } },
      { label: "İPİ TOPLAMA", q: { vx: 210, vy: -90, attached: true, taut: true, anchorDX: -80, anchorDY: -180, reel: -1 } },
      { label: "TEMİZ ATIŞ", q: { vx: 400, vy: -150, boost: 1 }, event: "boost" },
      { label: "DÜŞÜŞ", q: { vx: 210, vy: 590 } },
      { label: "YÖN DEĞİŞİMİ", q: { vx: -100, vy: -60, steer: -1 } }
    ];
    for (let i = 0; i < poses.length; i++) {
      const pose = poses[i], rig = new CourierRig(); rig.reset(pose.q);
      for (let j = 0; j < 90; j++) rig.update(1/120, pose.q);
      if (pose.event) { rig.event(pose.event); rig.update(1/120, pose.q); }
      const x = 130 + (i % 3) * 520, y = 185 + Math.floor(i/3) * 345;
      if (pose.q.attached) {
        const p = rig.attachment(x, y), local = rig.attachment(0, 0);
        ctx.strokeStyle = "#badacf"; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(x + local.x * 3.4, y + local.y * 3.4); ctx.lineTo(x + pose.q.anchorDX, y + pose.q.anchorDY); ctx.stroke();
      }
      rig.draw(ctx, x, y, 3.4);
      ctx.fillStyle = "#d2ded6"; ctx.font = "600 17px Segoe UI"; ctx.textAlign = "center";
      ctx.fillText(pose.label, x + 40, y + 115);
    }
  });
  await page.locator("#poses").screenshot({ path: path.join(output, "courier-poses.png") });
  assert.deepEqual(errors, [], "Browser must have no uncaught errors");
  fs.writeFileSync(path.join(output, "browser-report.json"), JSON.stringify({ errors, route }, null, 2));
  console.log(JSON.stringify({ errors, route: { ...route, samples: undefined }, screenshots: output }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
