const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.argv[2] || "playwright");

(async () => {
  const output = path.join(__dirname, "evidence");
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
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
