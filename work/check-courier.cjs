const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "courier.js"), "utf8");
const context = vm.createContext({});
vm.runInContext(source, context, { filename: "courier.js" });
assert.equal(typeof context.CourierRig, "function", "Classic script must publish CourierRig");
const rig = new context.CourierRig();

function finiteTree(value, label = "rig") {
  if (typeof value === "number") assert.ok(Number.isFinite(value), `${label} must be finite`);
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) finiteTree(child, `${label}.${key}`);
  }
}

class StubContext {
  constructor() {
    this.matrix = [1, 0, 0, 1, 0, 0];
    this.stack = [];
    this.gloveMarks = [];
    this.fillStyle = "";
  }
  check(...values) { values.forEach(v => assert.ok(Number.isFinite(v), `Canvas argument ${v} must be finite`)); }
  save() { this.stack.push({ matrix: [...this.matrix], fillStyle: this.fillStyle }); }
  restore() {
    const state = this.stack.pop();
    assert.ok(state, "Canvas restore needs a save");
    this.matrix = state.matrix;
    this.fillStyle = state.fillStyle;
  }
  translate(x, y) { this.check(x, y); this.multiply([1, 0, 0, 1, x, y]); }
  rotate(a) { this.check(a); this.multiply([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]); }
  scale(x, y) { this.check(x, y); this.multiply([x, 0, 0, y, 0, 0]); }
  multiply([a, b, c, d, e, f]) {
    const [A, B, C, D, E, F] = this.matrix;
    this.matrix = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d,
      A * e + C * f + E, B * e + D * f + F];
    this.check(...this.matrix);
  }
  transformPoint(x, y) {
    const [a, b, c, d, e, f] = this.matrix;
    return { x: a * x + c * y + e, y: b * x + d * y + f };
  }
  beginPath() { this.lastEllipse = null; }
  moveTo(x, y) { this.check(x, y); }
  lineTo(x, y) { this.check(x, y); }
  closePath() {}
  ellipse(x, y, rx, ry, rotation, start, end) {
    this.check(x, y, rx, ry, rotation, start, end);
    this.lastEllipse = this.transformPoint(x, y);
  }
  fill() { if (this.fillStyle === "#594536" && this.lastEllipse) this.gloveMarks.push(this.lastEllipse); }
  stroke() {}
  set lineWidth(v) { this.check(v); }
}

function checkDraw(label) {
  const before = JSON.stringify(rig);
  const canvas = new StubContext();
  rig.draw(canvas, 210, 154);
  assert.equal(JSON.stringify(rig), before, `${label}: draw must not advance simulation`);
  assert.equal(canvas.stack.length, 0, `${label}: draw must balance canvas state`);
  assert.ok(canvas.gloveMarks.length >= 2, `${label}: separate far and near gloves must render`);
  const tip = canvas.gloveMarks.at(-1);
  const endpoint = rig.attachment(210, 154);
  assert.ok(Math.hypot(tip.x - endpoint.x, tip.y - endpoint.y) < 0.001,
    `${label}: rope endpoint must coincide with rendered gripping glove`);
  finiteTree(endpoint, `${label}.attachment`);
  finiteTree(rig.snapshot(), `${label}.snapshot`);
  finiteTree(rig, `${label}.state`);
}

checkDraw("initial");
const neutral = rig.snapshot();
rig.event("release");
assert.ok(rig.snapshot().gripY < neutral.gripY, "Release should lift the leading hand");
rig.reset();
rig.event("seal");
assert.ok(rig.snapshot().farHandY < neutral.farHandY, "Seal should lift the far hand");
rig.reset();
rig.event("checkpoint");
assert.ok(rig.snapshot().bodyBob < neutral.bodyBob, "Checkpoint should lift the torso");
rig.reset();
rig.event("recover");
assert.ok(rig.snapshot().bodyBob > neutral.bodyBob, "Recovery should settle the torso");
rig.reset();
rig.event("boost");
rig.update(1 / 120, { vx: 340 });
assert.ok(rig.snapshot().tuck > 0, "Boost event should begin a tuck");
rig.reset();
rig.event("hurt");
rig.update(1 / 120, { vy: 0 });
assert.ok(rig.snapshot().brace > 0, "Hurt event should begin a brace");
rig.reset();
const idle = rig.snapshot();
for (let i = 0; i < 180; i++) rig.update(1 / 120, { menu: true });
assert.notEqual(rig.snapshot().scarfY, idle.scarfY, "Idle cloth must respond to breathing");
checkDraw("idle");

for (let i = 0; i < 45; i++) rig.update(1 / 120, { vx: 80, vy: -40, anchorDX: 92, anchorDY: -68 });
assert.ok(rig.snapshot().reach > 0.5, "Courier should reach toward a nearby ring before attaching");
checkDraw("reach");

rig.event("attach");
for (let i = 0; i < 120; i++) rig.update(1 / 120, {
  vx: 320, vy: -170, ax: 900, ay: 700, attached: true,
  anchorDX: i % 2 ? 140 : -140, anchorDY: -180, taut: true, reel: i % 3 - 1
});
assert.ok(rig.snapshot().reach > 0.999, "Attached hand should reach its aim");
assert.ok(Math.abs(rig.snapshot().lean) < 0.67, "Attached swing must remain head-up");
checkDraw("attached swing");

function settledPose(input) {
  const sample = new context.CourierRig();
  for (let i = 0; i < 90; i++) sample.update(1 / 120, input);
  return sample.snapshot();
}
const hanging = settledPose({ attached: true, taut: true, anchorDY: -200 });
const sweeping = settledPose({ attached: true, taut: true, anchorDY: -200, vx: 520 });
assert.ok(sweeping.nearFootX - sweeping.farFootX > hanging.nearFootX - hanging.farFootX + 8,
  "Tangent speed must visibly split and trail the legs");
const pulling = settledPose({ attached: true, taut: true, anchorDY: -200, vx: 520, reel: -1 });
assert.ok(Math.hypot(pulling.farHandX - pulling.gripX, pulling.farHandY - pulling.gripY) < 9,
  `Reeling in must bring the second glove to the rope: ${JSON.stringify(pulling)}`);
assert.ok(pulling.gripY > sweeping.gripY + 3,
  "Pulling must draw the gripping hand closer to the shoulder");
const picturedThrow = settledPose({ vx: 400, vy: -150, boost: 1 });
const picturedFall = settledPose({ vx: 210, vy: 590 });
assert.ok(picturedThrow.lean > 0.97 && picturedThrow.lean < 1.4,
  "Pose-sheet clean throw must be visibly head-forward");
assert.ok(picturedFall.lean < -0.12 && picturedFall.lean > -0.45,
  "Pose-sheet slow fall must lean back");
assert.ok(picturedFall.nearFootX - picturedFall.farFootX > 22,
  "Pose-sheet fall must spread its boots");

rig.reset({ grounded: true });
const walkSamples = [];
for (let i = 0; i < 180; i++) {
  rig.update(1 / 120, { grounded: true, vx: 120 });
  if (i >= 60) walkSamples.push(rig.snapshot());
}
assert.ok(walkSamples.at(-1).walk > 0.99, "Grounded speed must produce a full walk");
assert.ok(Math.max(...walkSamples.map(p => p.nearFootX))
  - Math.min(...walkSamples.map(p => p.nearFootX)) > 10,
  "Walking boot must travel through a meaningful stride");
assert.ok(Math.max(...walkSamples.map(p => p.nearFootY))
  - Math.min(...walkSamples.map(p => p.nearFootY)) > 3.5,
  "Swinging boot must lift clear of the ground");
for (const pose of walkSamples) {
  assert.ok(Math.abs(Math.max(pose.nearFootY, pose.farFootY) - 25.5) < 0.35,
    "One boot must stay planted at local ground height through each step");
  const height = Math.max(pose.nearFootY, pose.farFootY) + 2.2 + 31.2 - pose.bodyBob;
  assert.ok(height >= 53 && height <= 60, "Walking silhouette must stay within 53-60px");
  assert.equal(pose.flight + pose.tuck + pose.brace + pose.reach, 0,
    "Grounded walk must not retain air or rope poses");
}
checkDraw("grounded walk");
for (let i = 0; i < 8; i++) rig.update(1 / 120, { grounded: true, vx: -120 });
assert.equal(rig.snapshot().facing, -1, "Walking reversal must turn promptly");
checkDraw("walk reversal");
for (let i = 0; i < 90; i++) rig.update(1 / 120, { grounded: true, vx: 0 });
assert.ok(rig.snapshot().walk < 0.001, "Stopped courier must blend back to idle legs");
checkDraw("grounded stop");
rig.reset({ grounded: true });
for (let i = 0; i < 90; i++) rig.update(1 / 120, { grounded: true, vx: 0, moveSpeed: 120 });
assert.ok(rig.snapshot().walk > 0.99, "Optional moveSpeed must drive steps without vx");
checkDraw("moveSpeed walk");

rig.reset({ grounded: true });
const talkingSamples = [];
for (let i = 0; i < 180; i++) {
  rig.update(1 / 120, { grounded: true, talking: true, vx: 0 });
  if (i > 60) talkingSamples.push(rig.snapshot());
}
assert.ok(talkingSamples.at(-1).talk > 0.99, "Talking must have its own pose");
assert.ok(Math.max(...talkingSamples.map(p => Math.abs(p.headX))) > 0.5,
  "Listening head motion must differ from idle");
assert.ok(Math.max(...talkingSamples.map(p => p.gesture)) > 0.5,
  "Talking should include an occasional restrained hand gesture");
checkDraw("talking");

rig.reset({ grounded: true });
for (let i = 0; i < 60; i++) rig.update(1 / 120, { grounded: true, vx: 150 });
rig.event("release");
for (let i = 0; i < 90; i++) rig.update(1 / 120, { vx: 600, vy: -200, boost: 1 });
assert.ok(rig.snapshot().flight > 0.8 && rig.snapshot().lean > 0.97,
  "Walking to air must reach the existing head-first flight pose");
checkDraw("walk to air");

rig.event("release", 1.5).event("boost");
for (let i = 0; i < 90; i++) rig.update(1 / 120, { vx: 860, vy: -270, ax: 1600, boost: 1 });
assert.ok(rig.snapshot().tuck > 0.9, "Fast boosted flight should tuck the legs");
assert.ok(rig.snapshot().lean > 0.97 && rig.snapshot().lean < 1.4,
  "Clean throw should lean head-first roughly 55-80 degrees");
checkDraw("boosted flight");

rig.event("hurt");
for (let i = 0; i < 60; i++) rig.update(1 / 120, { vx: -70, vy: 750, ay: 1300 });
assert.ok(rig.snapshot().brace > 0.7, "Fast descent should brace");
assert.ok(rig.snapshot().lean < 0 && rig.snapshot().lean > -0.45,
  "Slow horizontal fall should lean slightly back instead of nose-diving");
assert.ok(rig.snapshot().nearFootX - rig.snapshot().farFootX > 22,
  "Falling boots should spread apart");
checkDraw("fall");

rig.reset();
for (let i = 0; i < 36; i++) rig.update(1 / 120, { vx: i % 2 ? -500 : 500 });
assert.equal(rig.snapshot().facing, 1, "Rapid sign noise must not flip the face every tick");
for (let i = 0; i < 90; i++) rig.update(1 / 120, { vx: -900, vy: -100, boost: 1 });
assert.equal(rig.snapshot().facing, -1, "Sustained reversal should change facing");
assert.ok(rig.snapshot().lean < -0.97, "Leftward flight should lean head-first to the left");
checkDraw("reverse flight");

rig.event("recover").event("seal").event("checkpoint");
rig.update(0.1, { waiting: true, vx: Number.POSITIVE_INFINITY, vy: NaN,
  ax: -1e12, anchorDX: Number.NEGATIVE_INFINITY });
checkDraw("recovery frame");

for (let i = 0; i < 2400; i++) {
  const direction = i % 360 < 180 ? 1 : -1;
  rig.update(1 / 120, { vx: direction * 1e9, vy: Math.sin(i / 12) * 1e9,
    ax: -direction * 1e12, ay: 1e12, steer: direction * 20, reel: -direction * 20,
    attached: i % 200 < 90, taut: true,
    anchorDX: direction * 1e12, anchorDY: -1e12 });
  if (i % 240 === 0) checkDraw(`extreme frame ${i}`);
}
checkDraw("extreme end");
assert.ok(Math.hypot(rig.snapshot().scarfX + 7, rig.snapshot().scarfY + 11) < 35,
  "Scarf must remain bounded near neck");

rig.reset({ menu: true });
const reset = rig.snapshot();
assert.equal(reset.eventAttach + reset.eventRelease + reset.eventBoost + reset.eventHurt
  + reset.eventRecover + reset.eventSeal + reset.eventCheckpoint, 0,
  "Reset must clear event impulses");
assert.equal(reset.lean, 0, "Reset must clear spring pose");
assert.equal(reset.tuck, 0, "Reset must clear flight pose");
assert.equal(reset.scarfX, -29, "Reset must replace trailing cloth state");
checkDraw("reset");

console.log("Courier checks passed: grounded stride/contact/reversal, talking, walk-to-air, grip alignment, idle/reach/swing/boost/fall, extreme finite state, pure draw and reset.");
