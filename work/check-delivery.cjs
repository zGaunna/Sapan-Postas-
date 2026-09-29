const assert = require("node:assert/strict");
const { runRoute } = require("./playtest-route.cjs");
const { replayFrames, snapshot } = require("./check-frame-loop.cjs");
const { game, context, element } = require("./check-game.cjs");
const FULL_KEY = "sapan-postasi-best-time-full";
const policy = { 2: { reelTo: 150, releaseOffset: -30 },
  13: { reelTo: 220, releaseOffset: 70 }, 21: { reelTo: 145, releaseOffset: 40 } };
const play = (ringPolicy = policy, extra = {}) => runRoute({ reelTo: 150, releaseOffset: -30, ringPolicy, ...extra });

function collectByContact() {
  for (const seal of game.seals) {
    if (seal.collected) continue;
    Object.assign(game.player, { x: seal.x, y: seal.y, vx: 0, vy: 0 });
    game.update(0);
  }
}

game.resetRun(-1);
for (let tick = 0; tick < 360; tick++) game.update(1 / 120);
assert.equal(game.sealCount(), 0, "Idle flight must not automatically collect the teaching seal");
context.localStorage.setItem(FULL_KEY, "80");
const partial = runRoute({ reelTo: 150, releaseOffset: -30 });
assert.equal(partial.state, "won");
assert.equal(partial.seals, 1, "Natural route must teach first seal but require alternate routes for others");
assert.equal(context.localStorage.getItem(FULL_KEY), "80", "Partial arrival must not write delivery time");
assert.match(element("#result-copy").textContent, /1\/3/);
for (const practice of [0, 1, 2]) {
  game.resetRun(practice);
  collectByContact();
  game.update(0.1);
  game.finishRun(true);
  assert.equal(game.sealCount(), 3);
  assert.equal(context.localStorage.getItem(FULL_KEY), "80", "Practice with all seals must not write delivery time");
}
game.resetRun(-1);
collectByContact();
game.update(0.1);
game.finishRun(false, "timeout");
assert.equal(context.localStorage.getItem(FULL_KEY), "80", "Failed run with all seals must not write delivery time");

const recording = play(policy, { captureInputs: true });
assert.equal(recording.state, "won");
assert.equal(recording.seals, 3);
assert.ok(recording.seconds < 115);
assert.ok(Number(context.localStorage.getItem(FULL_KEY)) < 80);
assert.equal(element("#new-delivery-best").hidden, false);
assert.equal(element("#result-kicker").textContent, "TESLİMAT TAMAM");
const expected = snapshot();
for (const rate of [30, 60, 120, 144, 180]) assert.equal(replayFrames(recording, rate), expected);

const releaseTimes = [];
for (let releaseOffset = 40; releaseOffset <= 105; releaseOffset += 5) {
  const run = play({ ...policy, 13: { reelTo: 220, releaseOffset } });
  assert.equal(run.state, "won", `Motor-ring release offset ${releaseOffset} must complete`);
  assert.equal(run.seals, 3, `Motor-ring release offset ${releaseOffset} must deliver all seals`);
  releaseTimes.push(run.releaseLog.find(item => item.ring === 13).at);
}
assert.ok(releaseTimes.at(-1) - releaseTimes[0] >= 0.25, "Second seal needs a measurable release window, not one perfect tick");
for (const reelTo of [135, 145, 155]) for (const releaseOffset of [0, 30, 60, 90]) {
  const run = play({ ...policy, 21: { reelTo, releaseOffset } });
  assert.equal(run.state, "won");
  assert.equal(run.seals, 3);
}
let delayed = 0;
for (const a of [0, 1, 2, 3, 4]) for (const b of [0, 1, 2, 3, 4]) for (const c of [0, 1, 2, 3, 4]) {
  const run = play({ 2: { ...policy[2], delaySteps: a }, 13: { ...policy[13], delaySteps: b },
    21: { ...policy[21], delaySteps: c } });
  assert.equal(run.state, "won", `Release delays ${a}/${b}/${c} must complete`);
  assert.equal(run.seals, 3, `Release delays ${a}/${b}/${c} must retain full delivery`);
  delayed++;
}

const records = new Map([["fener", "40"], ["delivery", "70"]]);
const store = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
assert.equal(game.saveBestRunTime(store, 60, "delivery").improved, true);
assert.equal(records.get("fener"), "40");
assert.equal(game.saveBestRunTime(store, 65, "delivery").improved, false);
assert.equal(records.get("delivery"), "60.000000");
const blocked = { getItem: () => "60", setItem() { throw new Error("blocked"); } };
assert.equal(game.saveBestRunTime(blocked, 50, "delivery").bestTime, 60);
assert.equal(game.saveBestRunTime(blocked, 50, "delivery").saved, false);

game.resetRun(0);
const first = game.seals[0];
assert.equal(game.getSealStatus(first), "waiting");
game.setCamera(0);
assert.equal(game.getSealLocator().side, "right");
game.setCamera(first.x - 400);
assert.equal(game.getSealLocator(), null, "Visible seal must not show edge arrow");
game.setCamera(first.x + 100);
assert.equal(game.getSealLocator().side, "left");
Object.assign(game.player, { x: first.x + 61, y: 200, vx: 0, vy: 0 });
game.update(0);
assert.equal(game.getSealStatus(first), "missed");
assert.equal(first.missedNotified, true);
assert.match(element("#combo").textContent, /1. MÜHÜR GEÇİLDİ/);
element("#combo").textContent = "keep";
game.player.x = first.x + 20;
game.update(0);
assert.equal(game.getSealStatus(first), "missed", "Sliding back must not flicker the passed status");
assert.equal(element("#combo").textContent, "keep", "Passing the same seal must not repeat the notice");
game.takeHit("water");
assert.equal(first.missedNotified, false, "Rescue before missed seal allows a new attempt");
assert.equal(game.getSealStatus(first), "waiting");
const waiting = JSON.stringify(game.seals);
for (let tick = 0; tick < 1200; tick++) game.update(1 / 120);
assert.equal(JSON.stringify(game.seals), waiting);
game.startRecovery();
Object.assign(game.player, { x: first.x, y: first.y, vx: 0, vy: 0 });
game.update(0);
assert.equal(game.getSealStatus(first), "collected");
assert.equal(first.missedNotified, false, "Collection must run before passed notification");
game.takeHit("water");
assert.equal(first.collected, true, "Collected seals survive rescue");
game.startRecovery();
collectByContact();
assert.equal(game.getSealLocator(), null, "All collected seals must remove edge guidance");
game.resetRun(-1);
Object.assign(game.player, { x: 5901, y: 200, vx: 0, vy: 0 });
game.update(0);
assert.equal(first.missedNotified, true);
game.takeHit("water");
assert.equal(game.getSealStatus(first), "missed", "Seal behind saved checkpoint must remain marked as passed");
assert.equal(first.missedNotified, true, "Rescue after a seal must not reset its passed notice");
for (const checkpoint of [5900, 11200]) for (const seal of game.seals) {
  if (seal.x < checkpoint) assert.ok(checkpoint - seal.x > 216,
    "Passed seals behind saved checkpoints must be beyond the 180px backtrack plus 36px collection reach");
}
console.log("Delivery checks passed: 3/3 complete and exact render replay, 0.25s motor-ring window, multiple ropes, " + delayed + " real delay combinations, record isolation, seal feedback and rescue.");
