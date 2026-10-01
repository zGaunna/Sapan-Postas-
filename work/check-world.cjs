"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "harbor-world.js"), "utf8");
// Deliberately no document, window, game, storage, assets, or timers in this realm.
const sandbox = { Path2D: require("./path2d-stub.cjs") };
vm.runInNewContext(source, sandbox, { filename: "harbor-world.js", timeout: 1000 });
const world = sandbox.HarborWorld;
assert.deepEqual(Object.keys(world).sort(), ["districts", "docks", "districtAt", "drawBackground", "drawDock", "drawNPC", "drawMap", "drawGlow"].sort());
const plain = value => JSON.parse(JSON.stringify(value));
const expectedDistricts = [
  ["rihtim", 0, 3600], ["pazar", 3600, 5900], ["vinc", 5900, 11200],
  ["dalgakiran", 11200, 15300], ["fener", 15300, 17400]
];
assert.deepEqual(plain(world.districts.map(d => [d.id, d.from, d.to])), expectedDistricts);
assert.deepEqual(plain(world.docks), [
  { id: "rihtim", name: "Eski Rıhtım", x: 150, left: 40, right: 900, floor: 540 },
  { id: "vinc", name: "Vinç Avlusu", x: 5900, left: 5510, right: 6300, floor: 500 },
  { id: "dalgakiran", name: "Dalgakıran", x: 11200, left: 10810, right: 11620, floor: 500 },
  { id: "fener", name: "Fener İskelesi", x: 17400, left: 16960, right: 17870, floor: 480 }
]);
for (const value of [world, world.districts, world.docks, ...world.docks, ...world.districts, ...world.districts.map(d => d.palette)]) {
  assert(Object.isFrozen(value), "API, records and palettes must be immutable");
}
assert.throws(() => { world.docks[0].floor = 1; }, TypeError);
assert.throws(() => { world.districts[0].palette.sky = "red"; }, TypeError);
for (const [id, from, to] of expectedDistricts) {
  assert.equal(world.districtAt(from).id, id);
  assert.equal(world.districtAt(to - .001).id, id);
  const district = world.districtAt(from);
  assert(district.name && district.description && district.color && Object.keys(district.palette).length >= 4);
}
assert.equal(world.districtAt(-Number.MAX_VALUE), world.districts[0]);
assert.equal(world.districtAt(Number.MAX_VALUE), world.districts[4]);
assert.equal(world.districtAt(17400), world.districts[4]);
for (const invalid of [NaN, Infinity, -Infinity, undefined, null, "3600", {}, 1n]) assert.equal(world.districtAt(invalid), null);

// Canvas recorder enforces finite geometry, positive radii, valid gradients and
// balanced state. It also catches leaked paint/dash/transform state between calls.
function canvas() {
  const calls = [], stack = [], state = { globalAlpha: .73, fillStyle: "sentinel", strokeStyle: "sentinel", lineWidth: 4,
    lineJoin: "miter", lineCap: "butt", textAlign: "right", font: "13px serif", globalCompositeOperation: "multiply", dash: [3, 2], transform: [1, 0, 0, 1, 12, 34] };
  const ctx = {};
  for (const key of Object.keys(state)) Object.defineProperty(ctx, key, {
    get: () => state[key], set: value => { if (typeof value === "number") assert(Number.isFinite(value), key); state[key] = value; }
  });
  const record = (method, args) => {
    for (const value of args) if (value instanceof sandbox.Path2D) {
      for (const command of value.commands) assert(command.slice(1).every(Number.isFinite), "Path2D has nonfinite geometry");
      assert.equal(state.lineWidth, 1);
      assert(["rgba(133,174,187,.13)", "rgba(160,188,198,.20)"].includes(state.strokeStyle));
    }
    for (const value of args) if (typeof value === "number") assert(Number.isFinite(value), `${method} has nonfinite geometry`);
    calls.push([method, ...args]);
    assert(calls.length < 24000, "draw loop exceeds bounded viewport budget");
  };
  for (const method of ["beginPath", "closePath", "moveTo", "lineTo", "fillRect", "rect", "fill", "stroke", "clip", "quadraticCurveTo"]) {
    ctx[method] = (...args) => record(method, args);
  }
  ctx.ellipse = (...args) => { assert(args[2] >= 0 && args[3] >= 0); record("ellipse", args); };
  ctx.translate = (...args) => { record("translate", args); state.transform = ["translated", ...args]; };
  ctx.rotate = (...args) => { record("rotate", args); state.transform = ["rotated", ...args]; };
  ctx.scale = (...args) => { record("scale", args); state.transform = ["scaled", ...args]; };
  ctx.save = () => { stack.push({ ...state, dash: [...state.dash], transform: [...state.transform] }); record("save", []); };
  ctx.restore = () => { assert(stack.length, "unmatched restore"); Object.assign(state, stack.pop()); record("restore", []); };
  ctx.setLineDash = value => { assert(value.every(Number.isFinite)); state.dash = [...value]; record("setLineDash", value); };
  ctx.fillText = (...args) => record("fillText", args);
  ctx.measureText = text => ({ width: text.length * 7 });
  for (const method of ["createLinearGradient", "createRadialGradient"]) {
    ctx[method] = (...args) => {
      record(method, args);
      return { addColorStop: (stop, color) => {
        assert(stop >= 0 && stop <= 1 && typeof color === "string");
        assert(!/NaN|Infinity|undefined/.test(color)); record("colorStop", [stop, color]);
      } };
    };
  }
  const initial = { ...state, dash: [...state.dash], transform: [...state.transform] };
  return { ctx, calls, check() { assert.equal(stack.length, 0); assert.deepEqual(state, initial); } };
}
const snapshot = JSON.stringify(plain([world.districts, world.docks]));
function render(fn) { const c = canvas(); fn(c.ctx); c.check(); return c.calls; }
render(ctx => world.drawGlow(ctx, 10, 20, 18, "rgba(85,214,207,.55)", true));
for (const radius of [0, -1, Infinity, NaN, 257]) assert.equal(render(ctx => world.drawGlow(ctx, 0, 0, radius)).length, 0);
let maxBackground = 0;
const signatures = new Set();
for (const focus of [1600, 4700, 8200, 13400, 16600]) {
  const calls = render(ctx => world.drawBackground(ctx, focus - 460, 12, focus));
  const paths = calls.filter(call => call[0] === "stroke" && call[1] instanceof sandbox.Path2D);
  assert.equal(paths.length, 2, "Water must use exactly two strokes");
  const expected = [[], []];
  const mod = (x, n) => ((x % n) + n) % n;
  const noise = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let row = 0; row < 9; row++) for (let i = 0; i < 29; i++) {
    const y = 562 + row * 19;
    const x = mod(i * 49 - (focus - 460) * (.35 + row * .02) + Math.sin(12 + row) * 7, 1350) - 35;
    expected[row % 3 ? 0 : 1].push(["moveTo", x, y + Math.sin(12 * .9 + i + row) * 2], ["lineTo", x + 10 + noise(i + row) * 23, y]);
  }
  assert.deepEqual(paths.map(call => call[1].commands), expected, "All 261 segments must preserve the original coordinates and grouping");
  maxBackground = Math.max(maxBackground, calls.length);
  signatures.add(JSON.stringify(calls.filter(c => ["fillRect", "lineTo", "ellipse"].includes(c[0]))));
  assert(calls.some(c => c[0] === "fillRect" && c[1] === 0 && c[2] === 0 && c[3] === 1280 && c[4] === 720));
}
assert.equal(signatures.size, 5, "districts must have distinct geometry");
for (const cam of [-Number.MAX_VALUE, -500, 0, 3599, 5899, 11199, 15299, 17400, Number.MAX_VALUE, NaN, Infinity]) {
  const calls = render(ctx => world.drawBackground(ctx, cam, Infinity));
  assert(calls.length < 18000, "background work must remain bounded at extreme cameras");
}
for (const x of [3600, 5900, 11200, 15300]) {
  const gradientAt = focus => render(ctx => world.drawBackground(ctx, focus - 460, 0, focus))
    .filter(c => c[0] === "colorStop").slice(0, 3).map(c => c[2]);
  const rgb = color => color.match(/\d+/g).map(Number);
  const before = gradientAt(x - .01), after = gradientAt(x + .01);
  for (let i = 0; i < 3; i++) {
    const a = rgb(before[i]), b = rgb(after[i]);
    assert(a.every((v, channel) => Math.abs(v - b[channel]) <= 1), "palette must be continuous at district boundaries");
  }
}
for (const dock of world.docks) {
  const cam = dock.left - 100;
  const full = render(ctx => world.drawDock(ctx, dock, cam, 7));
  const compact = render(ctx => world.drawDock(ctx, dock, cam, 7, false));
  assert(full.length > compact.length);
  assert(compact.some(c => c[0] === "fillRect" && c[1] === 100 && c[2] === dock.floor && c[3] === dock.right - dock.left && c[4] === 11),
    "floor must cover exact dock left..right interval");
  const offscreen = dock.id === "fener" ? 0 : 17400;
  assert.equal(render(ctx => world.drawDock(ctx, dock, offscreen, 0)).length, 0);
  for (const extreme of [-Number.MAX_VALUE, Number.MAX_VALUE]) {
    assert.equal(render(ctx => world.drawDock(ctx, dock, extreme, 0)).length, 0);
  }
  render(ctx => world.drawDock(ctx, dock, cam, NaN));
}
assert.equal(render(ctx => world.drawDock(ctx, { left: NaN, right: 10, floor: 10, x: 1 }, 0, 0)).length, 0);
const profiles = new Set();
for (const look of ["postaci", "balikci", "tamirci", "fenerci", "cayci"]) {
  const npc = Object.freeze({ id: "test", name: "Emine abla", role: "Postahane", x: 380, y: 512, color: "#ab7765", look });
  const idle = render(ctx => world.drawNPC(ctx, npc, 0, 1));
  const active = render(ctx => world.drawNPC(ctx, npc, 0, 1, true));
  assert(!idle.some(c => c[0] === "fillText"), "NPC labels only when active");
  assert.equal(active.filter(c => c[0] === "fillText").length, 2);
  assert.equal(render(ctx => world.drawNPC(ctx, npc, 17400, 0)).length, 0);
  assert.equal(render(ctx => world.drawNPC(ctx, npc, Number.MAX_VALUE, 0)).length, 0);
  assert.notDeepEqual(idle, render(ctx => world.drawNPC(ctx, npc, 0, 2)), "NPC breathing animates");
  render(ctx => world.drawNPC(ctx, npc, NaN, Infinity, true));
  profiles.add(JSON.stringify(idle));
}
assert.equal(profiles.size, 5);
assert.equal(render(ctx => world.drawNPC(ctx, { x: 30, y: NaN }, 0, 0)).length, 0);
for (const currentX of [-100, 0, 3600, 5900, 11200, 17400, Number.MAX_VALUE, NaN]) {
  const calls = render(ctx => world.drawMap(ctx, currentX, Object.freeze(["rihtim", "vinc"])));
  const labels = calls.filter(c => c[0] === "fillText").map(c => c[1]);
  for (const dock of world.docks) assert(labels.includes(dock.name));
  for (const d of world.districts) assert(labels.includes(d.name.toLocaleUpperCase("tr-TR")));
  assert(labels.includes("BURADASIN"));
}
render(ctx => world.drawMap(ctx, 500, null));
assert.equal(JSON.stringify(plain([world.districts, world.docks])), snapshot, "drawing must not mutate world data");
console.log(`HarborWorld checks passed: exact boundaries/docks, deep immutability, finite pure rendering, five region geometries, culling, dock floors, five NPC profiles, map, Canvas state. Peak sampled background: ${maxBackground} calls.`);
