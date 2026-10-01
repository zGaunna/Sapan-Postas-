const assert = require("node:assert/strict");
const { runRoute } = require("./playtest-route.cjs");
const { game, context, element, dispatchKey } = require("./check-game.cjs");
const canvas = element("#game");
canvas.getBoundingClientRect = () => ({ width: 0, height: 0 });

function snapshot() {
  return JSON.stringify({ player: game.player, state: game.state(), time: game.runTime(),
    seals: game.sealCount(), sealFlags: game.seals.map(seal => ({ id: seal.id, collected: seal.collected,
      missedNotified: seal.missedNotified })), stats: game.stats(), splits: game.splitTimes() });
}

function replayFrames(recording, frameRate) {
  game.resetRun(-1);
  let tick = 0;
  context.__beforeFrameStep = () => {
    const input = recording.inputs[tick++];
    assert.ok(input, "Rendered replay must not consume extra physics inputs");
    game.keys.clear();
    for (const key of input.keys) game.keys.add(key);
    if (input.action === "begin") game.beginTether();
    if (input.action === "release") game.releaseTether();
    assert.equal(JSON.stringify(game.visualRope), input.visualRope,
      `Visual rope must match the recorded fixed step ${tick} at ${frameRate} render Hz`);
    assert.equal(JSON.stringify(game.squash), input.squash,
      `Squash spring must match the recorded fixed step ${tick} at ${frameRate} render Hz`);
  };
  game.frame(1000);
  for (let frame = 1; frame <= frameRate * 140 && game.state() === "playing"; frame++) {
    if (game.recoveryReady()) dispatchKey("Space");
    game.frame(1000 + frame * 1000 / frameRate);
  }
  delete context.__beforeFrameStep;
  assert.equal(tick, recording.inputs.length, "Replay must execute the recorded physics steps exactly once");
  assert.equal(game.state(), "won");
  const result = snapshot();
  game.frame(200000);
  assert.equal(snapshot(), result, "Completed run must not continue simulating");
  return result;
}

const recording = runRoute({ reelTo: 150, releaseOffset: -30, captureInputs: true });
const expected = snapshot();
const expectedVisualRope = JSON.stringify(game.visualRope);
for (const frameRate of [30, 60, 120, 144, 180]) {
  assert.equal(replayFrames(recording, frameRate), expected,
    `Same recorded inputs must produce identical full-route physics at ${frameRate} render Hz`);
  assert.equal(JSON.stringify(game.visualRope), expectedVisualRope,
    `Same recorded inputs must produce identical visual rope at ${frameRate} render Hz`);
}

game.resetRun(0);
game.frame(1000);
game.frame(2000);
assert.ok(game.runTime() > 0 && game.runTime() <= 0.035, "Stall must not cause an unbounded simulation jump");
game.takeHit("water");
const rescued = snapshot();
game.frame(12000);
assert.equal(snapshot(), rescued, "Rescue waiting must discard accumulated frame time");
game.startRecovery();
game.frame(20000);
assert.equal(game.runTime(), JSON.parse(rescued).time, "Recovery launch must reset clock baseline");
game.frame(20010);
assert.ok(Math.abs(game.runTime() - JSON.parse(rescued).time - 1 / 120) < 1e-9);
console.log("Frame-loop checks passed: full recorded route identical at 30/60/120/144/180 render Hz, stalls, rescue reset, terminal stop.");
module.exports = { replayFrames, snapshot };

// Constant-target damping must converge identically regardless of subdivision.
for (const target of [0, 400, 1200]) {
  const expectedCamera = target + (800 - target) * Math.exp(-5);
  for (const hz of [30, 60, 144, 240]) {
    let camera = 800;
    for (let i = 0; i < hz; i++) camera = game.damp(camera, target, 5, 1 / hz);
    assert.ok(Math.abs(camera - expectedCamera) < 1e-9, `Camera convergence at ${hz} Hz`);
  }
}
assert.equal(game.damp(100, 800, 5, 0), 100);
assert.equal(game.cameraTarget(2000, 0, .36), 1539.2);
assert.equal(game.cameraTarget(2000, 500, .36), 1619.2);
assert.equal(game.cameraTarget(2000, -500, .36), 1479.2);
assert.equal(game.cameraTarget(2000, 2000, .36), 1679.2);
assert.equal(game.cameraTarget(0, -500, .36), 0);
game.resetRun(0); game.setCamera(800);
game.update(1 / 120);
assert.ok(Math.abs(game.cameraX() - game.damp(800, game.cameraTarget(game.player.x, game.player.vx, .36), 5, 1 / 120)) < 1e-9);
game.enterHarbor("rihtim"); game.setCamera(800);
game.updateSocial(1 / 120);
assert.ok(Math.abs(game.cameraX() - game.damp(800, game.cameraTarget(game.player.x, game.player.vx, .45), 5, 1 / 120)) < 1e-9);
console.log("Camera checks passed: 30/60/144/240 Hz convergence, zero dt, look-ahead limits, route and harbor integration.");
