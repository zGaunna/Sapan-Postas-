const assert = require("node:assert/strict");
const path = require("node:path");

module.exports = async function checkPanelMotion(page) {
  await page.goto((process.env.GAME_URL || "http://127.0.0.1:8765") + "/work/browser-playtest.html");
  const opening = await page.evaluate(() => {
    const g = window.__playtest, panel = document.querySelector("#pause-screen");
    g.resetRun(0);
    getComputedStyle(panel).display;
    g.pauseGame();
    const animations = panel.getAnimations();
    for (const animation of animations) { animation.pause(); animation.currentTime = 110; }
    return { properties: animations.map(animation => animation.transitionProperty), opacity: Number(getComputedStyle(panel).opacity) };
  });
  assert.ok(opening.properties.includes("opacity"));
  assert.ok(opening.properties.includes("transform"));
  assert.ok(opening.opacity > 0 && opening.opacity < 1);
  const closing = await page.evaluate(() => {
    const g = window.__playtest, panel = document.querySelector("#pause-screen");
    for (const animation of panel.getAnimations()) animation.finish();
    getComputedStyle(panel).opacity;
    g.resumeGame();
    const animations = panel.getAnimations();
    for (const animation of animations) { animation.pause(); animation.currentTime = 110; }
    const state = { display: getComputedStyle(panel).display, opacity: Number(getComputedStyle(panel).opacity), inert: panel.inert };
    for (const animation of animations) animation.finish();
    return state;
  });
  assert.equal(closing.display, "flex", "Discrete exit keeps the panel painted until transition completion");
  assert.ok(closing.opacity > 0 && closing.opacity < 1);
  assert.equal(closing.inert, true);
  await page.locator("#pause-screen").waitFor({ state: "hidden" });
  const result = await page.evaluate(() => {
    const g = window.__playtest;
    g.resetRun(0);
    for (let i = 0; i < 60; i++) g.update(1 / 120);
    g.seals[0].collected = true;
    g.splitTimes().push({ name: "Orta iskele", at: .2 }, { name: "Fener hattı", at: .4 });
    g.finishRun(false);
    const time = document.querySelector("#final-time");
    const count = document.querySelector("#final-time-count");
    const canonical = time.textContent;
    const initial = count.textContent;
    g.frame(1000);
    g.frame(1250);
    const middle = count.textContent;
    const unchanged = time.textContent;
    g.frame(1550);
    const finished = !time.classList.contains("is-counting") && count.hidden;
    const delays = [...document.querySelectorAll("#result-splits li")].map(node => getComputedStyle(node).animationDelay);
    const sealAnimation = getComputedStyle(document.querySelector("#result-seal-marks .is-collected")).animationName;
    g.resetRun(0);
    const closed = document.querySelector("#result-screen");
    const exit = { hidden: closed.hidden, inert: closed.inert, pointer: getComputedStyle(closed).pointerEvents };
    g.pauseGame();
    const panel = document.querySelector("#pause-screen");
    const duration = getComputedStyle(panel).transitionDuration;
    document.querySelector("#motion-toggle").click();
    const reduced = { duration: getComputedStyle(panel).transitionDuration,
      sealAnimation: getComputedStyle(document.querySelector("#result-seal-marks .is-collected")).animationName };
    g.resumeGame();
    for (let i = 0; i < 60; i++) g.update(1 / 120);
    g.finishRun(false);
    return { canonical, initial, middle, unchanged, finished, delays, sealAnimation, exit, duration, reduced,
      reducedCount: time.classList.contains("is-counting") };
  });
  assert.equal(result.initial, "0:00.00");
  assert.notEqual(result.middle, result.initial);
  assert.notEqual(result.middle, result.canonical);
  assert.equal(result.unchanged, result.canonical, "Accessible final time must stay exact during count-up");
  assert.equal(result.finished, true);
  assert.deepEqual(result.delays, ["0s", "0.045s"]);
  assert.equal(result.sealAnimation, "seal-pop");
  assert.deepEqual(result.exit, { hidden: true, inert: true, pointer: "none" });
  assert.match(result.duration, /0\.22s/);
  assert.equal(result.reduced.duration, "0s");
  assert.equal(result.reduced.sealAnimation, "none");
  assert.equal(result.reducedCount, false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => document.querySelector("#motion-toggle").click());
  assert.equal(await page.locator("#result-screen").evaluate(node => getComputedStyle(node).transitionDuration), "0s");
  await page.screenshot({ path: path.join(__dirname, "evidence", "result-ui-motion.png") });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  console.log("Panel motion checks passed: discrete transition, inert exit, exact accessible time, count-up, seal pop, manual and system reduced motion.");
};
