const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "harbor-map.js"), "utf8");
const sandbox = {};
vm.runInNewContext(source, sandbox, { filename: "harbor-map.js" });
const map = sandbox.HarborMap;

assert.ok(Object.isFrozen(map));
assert.equal(map.end, 17400);
assert.deepEqual(Array.from(map.checkpoints), [5900, 11200]);
assert.deepEqual(Array.from(map.practiceStarts), [150, 5900, 11200]);
assert.equal(map.districts.length, 3);
assert.ok(Object.isFrozen(map.districts));
assert.ok(map.districts.every(Object.isFrozen));
assert.deepEqual(Array.from(map.districts, ({ name, start, end, practiceX }) =>
  ({ name, start, end, practiceX })), [
  { name: "Eski Rıhtım", start: 0, end: 5900, practiceX: 150 },
  { name: "Vinç Avlusu", start: 5900, end: 11200, practiceX: 5900 },
  { name: "Fener Geçidi", start: 11200, end: 17400, practiceX: 11200 }
]);
for (const key of ["id", "name", "start", "end", "practiceX", "accent", "skyTop", "skyBottom", "waterTop"]) {
  assert.ok(map.districts.every(district => typeof district[key] === (key === "start" || key === "end" || key === "practiceX" ? "number" : "string")));
}

for (const [x, index] of [[-100, 0], [0, 0], [5899.999, 0], [5900, 1],
  [11199.999, 1], [11200, 2], [17400, 2], [99999, 2]]) {
  assert.equal(map.districtAt(x), map.districts[index], `districtAt(${x})`);
}
for (const x of [NaN, Infinity, -Infinity, undefined, null, "5900", {}]) {
  assert.equal(map.districtAt(x), null, `Invalid position ${String(x)}`);
}
for (let id = 1; id <= 3; id++) assert.equal(map.practiceForSeal(id), id - 1);
for (const id of [0, 4, -1, 1.5, NaN, Infinity, null, "2", {}]) {
  assert.equal(map.practiceForSeal(id), null, `Invalid seal ${String(id)}`);
}

function recordingContext() {
  const operations = [];
  const state = { fillStyle: "original", strokeStyle: "original", globalAlpha: 0.7,
    lineWidth: 7, font: "original", textAlign: "left" };
  const stack = [];
  const ctx = { operations, ...state };
  ctx.save = () => {
    stack.push(Object.fromEntries(Object.keys(state).map(key => [key, ctx[key]])));
    operations.push(["save"]);
  };
  ctx.restore = () => {
    Object.assign(ctx, stack.pop());
    operations.push(["restore"]);
  };
  for (const method of ["scale", "fillRect", "strokeRect", "beginPath", "moveTo", "lineTo", "closePath", "fill", "stroke", "fillText"]) {
    ctx[method] = (...args) => operations.push([method, ...args, ctx.fillStyle, ctx.globalAlpha]);
  }
  return { ctx, operations, state, stack };
}

function draw(cameraX, extras = {}) {
  const recording = recordingContext();
  const options = Object.freeze({ cameraX, width: 1280, height: 720, time: 4, motion: true, ...extras });
  const before = JSON.stringify(options);
  map.drawScenery(recording.ctx, options);
  assert.equal(JSON.stringify(options), before, "Draw must not mutate input options");
  assert.equal(recording.stack.length, 0, "Canvas save/restore must balance");
  for (const [key, value] of Object.entries(recording.state)) {
    assert.equal(recording.ctx[key], value, `Canvas ${key} must be restored`);
  }
  assert.ok(recording.operations.length < 500, "Visible draw work should stay bounded");
  return recording.operations;
}

const old = draw(250);
const yard = draw(7200);
const pass = draw(15300);
const firstGate = draw(5850);
const secondGate = draw(11150);
assert.ok(firstGate.some(op => op[0] === "fillText" && op[1] === "VİNÇ AVLUSU"), "First district gate drawn");
assert.ok(secondGate.some(op => op[0] === "fillText" && op[1] === "FENER GEÇİDİ"), "Second district gate drawn");
assert.ok(old.some(op => op[0] === "fillRect" && op[3] >= 50 && op[5] === "#18303a"), "Old pier warehouse drawn");
assert.ok(yard.some(op => op[0] === "fillRect" && op[5] === "#53646a"), "Crane gantry drawn");
assert.ok(yard.some(op => op[0] === "strokeRect"), "Container detail drawn");
assert.ok(pass.some(op => op[0] === "fillRect" && op[5] === "#d2d6cc") ||
  pass.some(op => op[0] === "fill" && op[1] === "#d2d6cc"), "Lighthouse drawn");
assert.ok(pass.some(op => op[0] === "fill" && op[1] === "rgba(247,206,131,.075)"), "Lighthouse cone drawn");
assert.ok(pass.some(op => op[0] === "fillRect" && op[5] === "#69808a"), "Breakwater drawn");
assert.deepEqual(draw(20000), [], "Offscreen world should emit no draw calls");
assert.deepEqual(draw(-100000), [], "Far-before-world view should emit no draw calls");
assert.deepEqual(draw(15300, { width: -1 }), [], "Invalid viewport should be ignored");

const still = draw(15300, { motion: false, time: 40 });
const stillAgain = draw(15300, { motion: false, time: -40 });
assert.deepEqual(still, stillAgain, "Motion disabled should be time independent");
console.log("Harbor map checks passed: districts, boundaries, practice mapping, immutability, scenery and culling.");
