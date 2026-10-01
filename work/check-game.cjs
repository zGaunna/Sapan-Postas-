const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const gamePath = path.join(__dirname, "..", "game.js");
const original = fs.readFileSync(gamePath, "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const referencedIds = [...original.matchAll(/querySelector\(["']#([^"']+)["']\)/g)].map(match => match[1]);
for (const id of referencedIds) {
  assert.ok(html.includes(`id="${id}"`), `Missing HTML node #${id}`);
}
assert.equal((html.match(/data-practice-start="[012]"/g) || []).length, 3);
const nodes = new Map();
function element(id) {
  if (!nodes.has(id)) {
    const listeners = new Map();
    nodes.set(id, {
      id, listeners, hidden: false, style: {}, children: [], dataset: {},
      classList: { add() {}, remove() {}, toggle() {} },
      setAttribute() {},
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(listener);
      },
      click() { for (const listener of listeners.get("click") || []) listener({}); },
    });
  }
  return nodes.get(id);
}
const canvas = element("#game");
const drawCalls = [];
canvas.getContext = () => new Proxy({}, {
  get(target, key) {
    if (key === "createLinearGradient" || key === "createRadialGradient") return () => ({ addColorStop() {} });
    return target[key] ?? ((...args) => drawCalls.push({ key, args }));
  },
  set(target, key, value) { target[key] = value; return true; },
});
canvas.getBoundingClientRect = () => ({ width: 1280, height: 720 });
element("#map-chart").getContext = canvas.getContext;
element("#lives").children = [element("life1"), element("life2"), element("life3")];
const practiceButtons = [0, 1, 2].map(index => {
  const button = element(`practice-${index}`);
  button.dataset.practiceStart = String(index);
  return button;
});
const windowListeners = new Map();
function dispatchKey(code) {
  for (const listener of windowListeners.get("keydown") || []) listener({ code, repeat: false, preventDefault() {} });
}
function dispatchKeyUp(code) {
  for (const listener of windowListeners.get("keyup") || []) listener({ code });
}
const storage = new Map([["sapan-postasi-best", "123"], ["sapan-postasi-tutorial", "done"]]);
const context = {
  Path2D: require("./path2d-stub.cjs"),
  __gameOptions: { testRun: true, debug: true, beforeStep: () => context.__beforeFrameStep?.() },
  document: {
    querySelector: selector => element(selector),
    querySelectorAll: selector => selector === "[data-practice-start]" ? practiceButtons : [],
    addEventListener() {},
  },
  window: {
    addEventListener(type, listener) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(listener);
    },
  },
  navigator: { maxTouchPoints: 0 },
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  },
  requestAnimationFrame() {},
};
vm.createContext(context);
for (const name of ["courier.js", "motion.js", "harbor-world.js", "harbor-social.js", "voyage-log.js", "level-data.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", name), "utf8"), context, { filename: name });
}
vm.runInContext(original, context, { filename: gamePath });
const game = context.SapanGame.create(context.__gameOptions);
context.__gameDebug = game;

assert.equal(game.anchors.length, 27);
const expectedHeights = [305, 265, 370, 295, 405, 300, 345, 250, 390, 310, 420, 285, 360];
assert.deepEqual(Array.from(game.anchors, ({ id, x, y, type }) => ({ id, x, y, type })),
  Array.from({ length: 27 }, (_, id) => ({ id, x: 440 + id * 650,
    y: expectedHeights[id % expectedHeights.length],
    type: [6, 10, 18].includes(id) ? "fragile" : [13, 24].includes(id) ? "winch" : "normal" })));
assert.ok(html.indexOf('src="level-data.js"') < html.indexOf('src="game.js"'));
assert.ok(Object.isFrozen(context.LevelData));
for (const key of ["anchorHeights", "fragileAnchorIds", "winchAnchorIds", "anchors"]) {
  assert.ok(Object.isFrozen(context.LevelData[key]));
}
for (const anchor of context.LevelData.anchors) {
  assert.ok(Object.isFrozen(anchor));
  assert.notEqual(game.anchors[anchor.id], anchor, "Runtime wear must not mutate level definitions");
}
assert.deepEqual(Array.from(game.anchors.slice(0, 6), anchor => anchor.type), Array(6).fill("normal"));
assert.equal(game.anchors[6].type, "fragile");
assert.equal(game.anchors[13].type, "winch");

element("#start-button").click();
assert.equal(game.state(), "playing");
assert.equal(game.practiceIndex(), -1);
assert.equal(game.nearestAnchor().anchor.id, 0);

practiceButtons[1].click();
assert.equal(game.practiceIndex(), 1);
assert.equal(game.player.x, 5900);
assert.equal(game.nearestAnchor().anchor.id, 9);
assert.equal(game.sealCount(), 1);
assert.equal(game.remaining(), 115);
game.takeHit();
assert.equal(game.lives(), 3, "Practice must allow unlimited retries");
game.player.x = 6250;
dispatchKey("KeyR");
assert.equal(game.player.x, 5900, "R must retry from the current practice checkpoint");
for (let step = 0; step < 100; step += 1) game.update(0.02);
assert.equal(game.remaining(), 115, "Practice must not consume the shift clock");
game.finishRun(true);
assert.equal(storage.get("sapan-postasi-best"), "123", "Practice must not overwrite the ranked record");

practiceButtons[2].click();
assert.equal(game.player.x, 11200);
assert.equal(game.nearestAnchor().anchor.id, 17, "Late practice must start within reach of a fresh ring");

game.resetRun(0);
game.player.x = game.anchors[6].x - 100;
game.player.y = game.anchors[6].y + 150;
game.player.vx = 0;
game.player.vy = 0;
game.beginTether();
assert.equal(game.tetherAnchor().id, 6);
for (let step = 0; step < 80; step += 1) game.update(0.02);
assert.equal(game.tetherAnchor(), null, "Fragile ring must release after 1.55 seconds");
assert.equal(game.anchors[6].visited, true, "Broken ring must be consumed");
assert.equal(game.lives(), 3, "Ring break itself must not remove a life");

game.resetRun(0);
game.player.x = game.anchors[6].x - 100;
game.player.y = game.anchors[6].y + 150;
game.beginTether();
game.updateSpecialRing(0.6);
game.pauseGame();
game.releaseTether();
assert.equal(game.anchors[6].visited, false, "Pausing must not consume the ring");
game.resumeGame();
game.beginTether();
assert.ok(game.tetherTime() >= 0.6, "Pausing must preserve fragile wear");
game.updateSpecialRing(0.96);
assert.equal(game.tetherAnchor(), null, "A paused fragile ring must still break at its total limit");

game.resetRun(0);
game.player.x = game.anchors[13].x - 100;
game.player.y = game.anchors[13].y + 150;
game.player.vx = 0;
game.player.vy = 0;
game.beginTether();
assert.equal(game.tetherAnchor().id, 13);
const startLength = game.ropeLength();
game.update(0.02);
assert.ok(game.ropeLength() < startLength, "Winch must shorten the rope automatically");
game.keys.add("KeyS");
const lengthBeforeCounter = game.ropeLength();
game.update(0.02);
assert.ok(game.ropeLength() > lengthBeforeCounter, "S must counter the winch");
assert.match(element("#hint").innerHTML, /S<\/kbd> ile diren/);
element("#touch-controls").hidden = false;
game.updateHud(true);
assert.match(element("#hint").innerHTML, /↓ ile diren/);
assert.doesNotMatch(element("#hint").innerHTML, /başlangıca dön: dur/);
element("#touch-controls").hidden = true;

game.resetRun(-1);
game.finishRun(true);
assert.ok(Number(storage.get("sapan-postasi-best")) > 123, "Normal shift must save a new record");
console.log("Game logic checks passed: modes, retries, timer, special rings, record isolation.");

// Compare Sonnet's prediction with the actual release and update path, not a second physics copy.
for (const clean of [false, true]) {
  for (const steer of [-1, 0, 1]) {
    for (const vx of [200, 500]) {
      game.resetRun(0);
      Object.assign(game.player, { x: clean ? 440 : 340, y: clean ? 400 : 250, vx, vy: -100 });
      game.beginTether();
      assert.ok(game.tetherAnchor());
      assert.equal(game.isCleanRelease(game.tetherAnchor()), clean);
      if (steer < 0) game.keys.add("KeyA");
      if (steer > 0) game.keys.add("KeyD");
      const snapshot = Object.freeze({
        player: Object.freeze({ ...game.player }), steer, boostTime: game.boostTime(),
        checkpointX: game.checkpointX(), cleanRelease: clean,
        releaseQuality: game.releaseQuality(game.tetherAnchor()),
      });
      const before = JSON.stringify(snapshot);
      const prediction = game.predictReleasePath(snapshot);
      assert.equal(JSON.stringify(snapshot), before, "Prediction must not mutate input");
      assert.equal(JSON.stringify(game.predictReleasePath(snapshot)), JSON.stringify(prediction));
      assert.equal(prediction.points.length, 11);
      assert.equal(prediction.outcome, "flight");
      game.releaseTether();
      for (let point = 1; point < prediction.points.length; point++) {
        for (let step = 0; step < 12; step++) game.update(1 / 120);
        assert.ok(Math.abs(game.player.x - prediction.points[point].x) < 1e-8, `X parity: clean=${clean}, steer=${steer}, vx=${vx}`);
        assert.ok(Math.abs(game.player.y - prediction.points[point].y) < 1e-8, `Y parity: clean=${clean}, steer=${steer}, vx=${vx}`);
      }
    }
  }
}
const predict = (overrides = {}) => game.predictReleasePath({
  player: { x: 440, y: 300, vx: 200, vy: 0 }, steer: 0,
  boostTime: 0, checkpointX: 150, cleanRelease: false, releaseQuality: 1, ...overrides,
});
assert.equal(predict({ player: { x: 440, y: 700, vx: 200, vy: 500 } }).outcome, "water");
assert.equal(predict({ player: { x: 440, y: -105, vx: 200, vy: -500 } }).outcome, "ceiling");
assert.equal(predict({ player: { x: -29, y: 300, vx: -100, vy: 0 } }).outcome, "backtrack");
assert.ok(predict({ cleanRelease: true }).points[1].x - predict().points[1].x > 9);
const firstClamp = predict({ player: { x: 0, y: 300, vx: 500, vy: 0 }, steer: -1, checkpointX: -1000 });
assert.ok(Math.abs(firstClamp.points[1].x - 30.47655) < 0.01, "Non-clean release must clamp during first update");

game.resetRun(-1);
assert.equal(element("#preview-toggle").hidden, true);
game.togglePreview();
assert.equal(game.previewOn(), true, "Normal runs must not toggle training help");
game.resetRun(0);
assert.equal(element("#preview-toggle").hidden, false);
game.beginTether();
const worldBefore = JSON.stringify({ player: game.player, anchors: game.anchors });
game.drawReleasePreview();
assert.ok(drawCalls.some(call => call.key === "arc"), "Attached training must draw trajectory dots");
assert.equal(JSON.stringify({ player: game.player, anchors: game.anchors }), worldBefore);
drawCalls.length = 0;
dispatchKey("KeyG");
assert.equal(game.previewOn(), false);
game.drawReleasePreview();
assert.equal(drawCalls.length, 0);
element("#preview-toggle").click();
assert.equal(game.previewOn(), true);
game.pauseGame();
assert.equal(element("#preview-toggle").hidden, true);
game.drawReleasePreview();
assert.equal(drawCalls.length, 0, "Paused game must hide trajectory");
game.resumeGame();
assert.equal(element("#preview-toggle").hidden, false);
game.resetRun(-1);
game.beginTether();
game.drawReleasePreview();
assert.equal(drawCalls.length, 0, "Normal runs must never draw training aid");
console.log("Preview checks passed: 12 real-flight parity scenarios, purity, boost, limits, drawing, G/button, pause, normal-run isolation.");

for (const [input, expected] of [[0, "0:00.00"], [0.29, "0:00.29"], [59.999, "0:59.99"], [60, "1:00.00"], [3599.999, "59:59.99"]]) {
  assert.equal(game.formatRunTime(input), expected);
}
for (const input of [-1, NaN, Infinity, "5", null]) assert.equal(game.formatRunTime(input), "—");
for (const raw of ["0", "-3", "NaN", "Infinity", "1e3", " 12.5", "12abc", "[12]", '{"t":12}', "", null]) {
  assert.equal(game.readBestRunTime({ getItem: () => raw }), null);
}
assert.equal(game.readBestRunTime({ getItem() { throw new Error("blocked"); } }), null);
assert.equal(game.readBestRunTime(null), null);
assert.equal(game.readBestRunTime({ getItem: () => "12.5" }), 12.5);
let savedTime = "60";
const timeStorage = { getItem: () => savedTime, setItem: (key, value) => { savedTime = value; } };
for (const candidate of [60, 61, 0, -5, NaN, Infinity, "50"]) {
  assert.equal(game.saveBestRunTime(timeStorage, candidate).improved, false);
  assert.equal(savedTime, "60");
}
assert.equal(game.saveBestRunTime(timeStorage, 59.5).improved, true);
assert.equal(Number(savedTime), 59.5);
const blockedWrite = { getItem: () => "60", setItem() { throw new Error("blocked"); } };
const failedSave = game.saveBestRunTime(blockedWrite, 55);
assert.equal(failedSave.bestTime, 60);
assert.equal(failedSave.improved, false);
assert.equal(failedSave.saved, false);
assert.equal(game.saveBestRunTime(timeStorage, 1e-9).improved, false);

storage.set("sapan-postasi-best-time", "60");
game.resetRun(0);
game.update(0.1);
game.finishRun(true);
assert.equal(storage.get("sapan-postasi-best-time"), "60", "Practice must not write fastest-time record");
game.resetRun(-1);
game.update(0.1);
game.finishRun(false, "timeout");
assert.equal(storage.get("sapan-postasi-best-time"), "60", "Incomplete run must not write fastest-time record");
assert.match(element("#result-copy").textContent, /süresi doldu/);

game.resetRun(-1);
for (const x of [5901, 11201, 17401]) {
  Object.assign(game.player, { x, y: 200, vx: 0, vy: 0 });
  game.update(0.1);
}
assert.equal(game.state(), "won");
assert.equal(game.splitTimes().length, 3);
assert.ok(Math.abs(game.runTime() - 0.3) < 1e-10);
assert.ok(Math.abs(Number(storage.get("sapan-postasi-best-time")) - 0.3) < 1e-10);
assert.equal(element("#new-time-best").hidden, false);
let splitSum = 0;
let lastSplit = 0;
for (const split of game.splitTimes()) { splitSum += split.at - lastSplit; lastSplit = split.at; }
assert.ok(Math.abs(splitSum - game.runTime()) < 1e-10);
assert.match(element("#result-splits").innerHTML, /Orta iskele/);

game.resetRun(-1);
const oldRect = canvas.getBoundingClientRect;
canvas.getBoundingClientRect = () => ({ width: 0, height: 0 });
game.frame(1000);
game.frame(1010);
const beforePause = game.runTime();
game.pauseGame();
game.frame(2000);
assert.equal(game.runTime(), beforePause);
game.resumeGame();
game.frame(5000);
assert.equal(game.runTime(), beforePause, "Resume must reset frame baseline");
game.frame(5010);
assert.ok(Math.abs(game.runTime() - beforePause - 1 / 120) < 1e-10);
canvas.getBoundingClientRect = oldRect;
storage.delete("sapan-postasi-tutorial");
game.resetRun(-1);
game.update(0.1);
assert.equal(game.runTime(), 0, "Tutorial must not count toward run time");
game.completeTutorial();
game.update(0.1);
assert.ok(game.runTime() > 0);
console.log("Timing checks passed: formatting, corrupt/blocked storage, record isolation, splits, pause, tutorial.");

for (const [reason, x, y] of [["hazard", 3200, 470], ["water", 500, 710], ["ceiling", 500, -115], ["backtrack", -35, 400]]) {
  game.resetRun(0);
  Object.assign(game.player, { x, y, vx: 0, vy: 0 });
  game.update(0.001);
  assert.equal(game.stats().hits, 1);
  assert.equal(game.stats().hitLog[0].reason, reason);
  assert.equal(game.stats().hitLog[0].segment, 0);
  assert.equal(game.stats().segments[0], 1);
}
game.resetRun(1);
game.takeHit("hazard");
assert.equal(game.stats().segments[1], 1);
const beforeRetry = game.stats().hits;
dispatchKey("KeyR");
assert.equal(game.stats().hits, beforeRetry, "Manual training retry is not a fall or collision");
game.resetRun(0);
Object.assign(game.player, { x: game.anchors[6].x - 100, y: game.anchors[6].y + 150 });
game.beginTether();
game.updateSpecialRing(1.56);
assert.equal(game.stats().ringBreaks, 1);
assert.equal(game.stats().hits, 0, "Fragile-ring break alone must not be counted as a hit");
console.log("Run-stat checks passed: water/hazard/ceiling/backtrack, segments, manual retries, fragile-ring separation.");

for (const start of [-1, 0, 1, 2]) {
  game.resetRun(start);
  game.keys.add("KeyD");
  game.takeHit("water");
  assert.equal(game.recoveryReady(), true);
  const saved = JSON.stringify({ player: game.player, time: game.runTime(), elapsed: game.elapsed(),
    remaining: game.remaining(), invulnerable: game.invulnerable(), stats: game.stats() });
  const buoy = { moving: true, x: 8120, y: 405, phase: 0 };
  const buoyY = game.hazardPosition(buoy).y;
  for (let step = 0; step < 1200; step++) game.update(1 / 120);
  assert.equal(JSON.stringify({ player: game.player, time: game.runTime(), elapsed: game.elapsed(),
    remaining: game.remaining(), invulnerable: game.invulnerable(), stats: game.stats() }), saved);
  assert.equal(game.hazardPosition(buoy).y, buoyY);
  game.takeHit("water");
  assert.equal(game.stats().hits, 1, "Waiting must not repeat damage");
  dispatchKey("KeyD");
  assert.equal(game.recoveryReady(), true, "Held input from before rescue must not resume");
  game.pauseGame();
  dispatchKey("KeyA");
  dispatchKey("Space");
  assert.equal(game.recoveryReady(), true, "Paused controls must not leave recovery");
  assert.equal(game.keys.size, 0, "Paused controls must not queue movement");
  const beforeRelease = JSON.stringify({ player: game.player, stats: game.stats() });
  dispatchKeyUp("Space");
  assert.equal(JSON.stringify({ player: game.player, stats: game.stats() }), beforeRelease, "Releasing Space without a rope must be a no-op");
  game.resumeGame();
  assert.equal(game.recoveryReady(), true);
  dispatchKeyUp("KeyD");
  dispatchKey("KeyD");
  assert.equal(game.recoveryReady(), false);
  assert.equal(game.invulnerable(), 2.1);
  for (let step = 0; step < 120; step++) game.update(1 / 120);
  assert.equal(game.stats().hits, 1, "Checkpoint launch must remain safe for the first second");
}
game.resetRun(0);
game.takeHit("water");
const pointerEvent = { button: 0, pointerId: 101, pointerType: "mouse", clientY: 430, currentTarget: canvas };
for (const listener of canvas.listeners.get("pointerdown")) listener(pointerEvent);
assert.equal(game.recoveryReady(), false);
assert.ok(game.tetherAnchor(), "New pointer input must resume and attach");
game.releaseTether({ award: false });
Object.assign(game.player, { x: 500, y: 710, vx: 0, vy: 0 });
game.update(0.001);
assert.equal(game.recoveryReady(), true, "Water must recover even during hazard immunity");
assert.equal(game.stats().hits, 2);
game.resetRun(-1);
for (let hit = 0; hit < 3; hit++) { game.startRecovery(); game.takeHit("water"); }
assert.equal(game.state(), "lost");
assert.equal(game.lives(), 0);
assert.equal(game.recoveryReady(), false, "Final life must end run rather than wait");
assert.equal(element("#final-hits").textContent, "3");
console.log("Recovery checks passed: all starts, held-input edges, 10-second freeze, pause, pointer, immunity boundaries, final life.");

module.exports = { game, context, element, dispatchKey, dispatchKeyUp, drawCalls };
