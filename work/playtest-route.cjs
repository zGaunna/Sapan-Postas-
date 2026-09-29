const assert = require("node:assert/strict");
const { game, dispatchKey, element } = require("./check-game.cjs");

function runRoute({ reelTo, releaseOffset, start = -1, frameRate = 120, ringPolicy = {}, observe, captureInputs = false }) {
  game.resetRun(start);
  let grabs = 0;
  let releases = 0;
  let farthest = game.player.x;
  let steps = 0;
  let previousAnchor = null;
  const ringSplits = [];
  const inputs = [];
  const releaseLog = [];
  const dt = 1 / frameRate;
  let queuedRelease = null;
  for (; steps < frameRate * 140 && game.state() === "playing"; steps++) {
    if (game.recoveryReady()) dispatchKey("Space");
    game.keys.clear();
    game.keys.add("KeyD");
    const anchor = game.tetherAnchor();
    if (queuedRelease?.anchor !== anchor) queuedRelease = null;
    let action = null;
    if (!anchor) { game.beginTether(); action = "begin"; }
    else {
      const policy = ringPolicy[anchor.id] || { reelTo, releaseOffset };
      if (game.ropeLength() > policy.reelTo) game.keys.add("KeyW");
      const releaseThreshold = policy.releaseOffset + game.player.vx * dt * (policy.jitterSteps || 0);
      if (!queuedRelease && game.player.y > anchor.y && game.player.x - anchor.x >= releaseThreshold && game.player.vx > 140) {
        queuedRelease = { anchor, steps: policy.delaySteps || 0 };
      }
      if (queuedRelease && queuedRelease.steps-- <= 0) {
        releaseLog.push({ ring: anchor.id, at: +(steps * dt).toFixed(4), x: game.player.x,
          y: game.player.y, rope: game.ropeLength() });
        game.releaseTether();
        action = "release";
        releases++;
        queuedRelease = null;
      }
    }
    if (game.tetherAnchor() && game.tetherAnchor() !== previousAnchor) {
      grabs++;
      ringSplits.push({ ring: game.tetherAnchor().id, at: +(steps * dt).toFixed(3) });
    }
    previousAnchor = game.tetherAnchor();
    if (captureInputs) inputs.push({ keys: [...game.keys], action });
    game.update(dt);
    if (observe) observe(game);
    farthest = Math.max(farthest, game.player.x);
  }
  return { reelTo, releaseOffset, start, frameRate, state: game.state(), seconds: +(steps * dt).toFixed(2),
    farthest: Math.round(farthest), lives: game.lives(), seals: game.sealCount(), grabs, releases,
    hits: game.stats().hits, segments: [...game.stats().segments],
    hitLog: game.stats().hitLog.map(hit => ({ ...hit, x: Math.round(hit.x), y: Math.round(hit.y), at: +hit.at.toFixed(3) })), ringSplits,
    collected: game.seals.map(seal => seal.collected), releaseLog,
    ...(captureInputs ? { inputs } : {}) };
}

const results = [];
for (const reelTo of [118, 150, 185, 220, 260]) {
  for (const releaseOffset of [-70, -30, 0, 30, 70]) results.push(runRoute({ reelTo, releaseOffset }));
}
results.sort((a, b) => (b.state === "won") - (a.state === "won") || b.farthest - a.farthest || a.seconds - b.seconds);
console.log(JSON.stringify(results.slice(0, 3).map(({ ringSplits, releaseLog, ...result }) => result), null, 2));
const winningPolicy = { reelTo: 150, releaseOffset: -30 };
const frameResults = [30, 60, 120, 180].map(frameRate => {
  const run = runRoute({ ...winningPolicy, frameRate });
  assert.equal(run.state, "won", `Route must be completable at ${frameRate} Hz`);
  assert.ok(run.seconds < 115, "Route must fit normal shift");
  const displayedParts = [...element("#result-splits").innerHTML.matchAll(/<small>\+(\d+):(\d{2})\.(\d{2})<\/small>/g)];
  const displayedSum = displayedParts.reduce((sum, match) => sum + Number(match[1]) * 6000 + Number(match[2]) * 100 + Number(match[3]), 0);
  const total = element("#final-time").textContent.match(/^(\d+):(\d{2})\.(\d{2})$/);
  assert.equal(displayedSum, Number(total[1]) * 6000 + Number(total[2]) * 100 + Number(total[3]), "Displayed split parts must sum to displayed total");
  return { frameRate, state: run.state, farthest: run.farthest, seconds: run.seconds, hits: run.hits };
});
const firstRun = runRoute(winningPolicy);
const secondRun = runRoute(winningPolicy);
assert.equal(JSON.stringify(firstRun), JSON.stringify(secondRun), "Same input and dt must produce identical route trace");
console.log("Route checks passed: deterministic completion and 30/60/120/180 Hz physics-step stress probes.", JSON.stringify(frameResults));
module.exports = { runRoute, results };
