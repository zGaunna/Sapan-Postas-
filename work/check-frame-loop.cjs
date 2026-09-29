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
for (const frameRate of [30, 60, 120, 144, 180]) {
  assert.equal(replayFrames(recording, frameRate), expected,
    `Same recorded inputs must produce identical full-route physics at ${frameRate} render Hz`);
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
