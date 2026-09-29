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
const source = original.replace(/\}\)\(\);\s*$/, `
  globalThis.__gameDebug = {
    resetRun, update, updateHud, updateSpecialRing, takeHit, beginTether, releaseTether, predictReleasePath, drawReleasePreview, togglePreview, isCleanRelease, releaseQuality,
    pauseGame, resumeGame, finishRun, nearestAnchor, player, anchors, seals, keys,
    state: () => state,
    practiceIndex: () => practiceIndex,
    remaining: () => remaining,
    lives: () => lives,
    sealCount: () => sealCount,
    tetherAnchor: () => tetherAnchor,
    tetherTime: () => tetherTime,
    ropeLength: () => ropeLength, previewOn: () => previewOn, boostTime: () => boostTime, checkpointX: () => checkpointX,
  };
})();`);
assert.notEqual(source, original, "Test instrumentation must be inserted into the game closure");

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
  get(target, key) { return target[key] ?? ((...args) => drawCalls.push({ key, args })); },
  set(target, key, value) { target[key] = value; return true; },
});
canvas.getBoundingClientRect = () => ({ width: 1280, height: 720 });
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
const storage = new Map([["sapan-postasi-best", "123"], ["sapan-postasi-tutorial", "done"]]);
const context = {
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
vm.runInNewContext(source, context, { filename: gamePath });
const game = context.__gameDebug;

assert.equal(game.anchors.length, 26);
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
        for (let step = 0; step < 6; step++) game.update(1 / 60);
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
assert.ok(Math.abs(firstClamp.points[1].x - 30.66) < 0.05, "Non-clean release must clamp during first update");

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
