const assert = require("node:assert/strict");
const { game, context, element, drawCalls } = require("./check-game.cjs");
const particleReference = require("./fixtures/particles-reference.json");

game.resetRun(0);
game.frame(1000);
game.frame(1000 + 1000 / 180);
assert.equal(game.player.x, 165, "A partial physics step must not simulate early");
game.frame(1000 + 2000 / 180);
assert.ok(game.rendered.x > game.previous.x && game.rendered.x < game.player.x,
  "180Hz rendering must interpolate between physics snapshots");
assert.ok(Math.abs(game.renderAlpha() - 1/3) < 1e-8);
const pose = JSON.stringify(game.courier.snapshot());
const fx = JSON.stringify(game.effects);
game.draw(game.visualTime()); game.draw(game.visualTime());
assert.equal(JSON.stringify(game.courier.snapshot()), pose, "Drawing must not advance animation");
assert.equal(JSON.stringify(game.effects), fx, "Drawing must not mutate effects");

game.pauseGame();
const paused = JSON.stringify({ pose: game.courier.snapshot(), fx: game.effects, clock: game.visualTime() });
game.frame(1100); game.frame(1300);
assert.equal(JSON.stringify({ pose: game.courier.snapshot(), fx: game.effects, clock: game.visualTime() }), paused,
  "Pause freezes character, particles, cloth and scenery clocks");
game.resumeGame(); game.frame(2000); game.frame(2020);
assert.ok(game.visualTime() > JSON.parse(paused).clock);

game.beginTether(); game.update(1/120);
game.takeHit("water");
assert.equal(game.effects.trail.length, 0, "Rescue must clear cross-world speed trails");
assert.equal(game.previous.x, game.player.x, "Rescue must reset interpolation immediately");
assert.equal(game.previous.y, game.player.y);
game.frame(2200); game.frame(2230);
assert.equal(game.rendered.x, game.player.x, "Recovery waiting must render at the safe position");
assert.equal(game.courier.input.waiting, true);
game.startRecovery();
assert.equal(game.courier.pulses.recover, 1);

game.resetRun(0);
Object.assign(game.player, { x: 350, y: 435, vx: 100, vy: 0 });
for (let i = 0; i < 10; i++) game.update(1/120);
assert.equal(game.courier.input.attached, false);
assert.ok(game.courier.reach > 0.2, "Approaching a ring must animate reaching before Space is held");

const effects = new context.MotionFX();
for (let i = 0; i < 100; i++) effects.burst("boost", 200, 400, 350, -200);
assert.ok(effects.particles.length <= 220 && effects.rings.length <= 16, "Effects stay bounded");
for (let i = 0; i < 480; i++) effects.update(1/120, null);
assert.equal(effects.particles.length, 0); assert.equal(effects.rings.length, 0);
effects.burst("hurt", 200, 400); effects.reduced = true;
assert.equal(effects.offset().x, 0); assert.equal(effects.offset().y, 0);
effects.reset(); assert.equal(effects.trail.length, 0); assert.equal(effects.flash, 0);
assert.equal(effects.trauma.t, 0); assert.equal(effects.trauma.clock, 0);

const small = new context.MotionFX(), large = new context.MotionFX();
small.burst("attach", 0, 0); large.burst("hurt", 0, 0);
assert.equal(small.trauma.t, .12); assert.equal(large.trauma.t, .5);
assert.ok(Math.abs(large.offset().x / small.offset().x - (.5 / .12) ** 2) < 1e-9,
  "Large hits amplify shake quadratically at the same phase");
small.burst("release", 0, 0); assert.equal(small.trauma.t, .24, "Trauma accumulates between events");
for (let i = 0; i < 10; i++) large.burst("hurt", 0, 0);
assert.equal(large.trauma.t, 1, "Repeated events cannot exceed full trauma");
const reference = new context.MotionFX(); reference.trauma.add(1); reference.update(.25, null);
const halfSecond = new context.MotionFX(); halfSecond.trauma.add(1); halfSecond.update(.5, null);
for (const hz of [30, 60, 144, 240]) {
  const probe = new context.MotionFX(); probe.trauma.add(1);
  for (let i = 0; i < hz / 2; i++) probe.update(1 / hz, null);
  assert.ok(Math.abs(probe.trauma.t - .2) < 1e-9, `Decay at ${hz} Hz`);
  const offsetBefore = JSON.stringify(probe), offset = probe.offset();
  assert.ok(Math.abs(offset.x - halfSecond.offset().x) < 1e-9 && Math.abs(offset.y - halfSecond.offset().y) < 1e-9,
    `Shake phase and amplitude match after half a second at ${hz} Hz`);
  assert.ok(Math.abs(offset.x) <= 14 * probe.trauma.t ** 2);
  assert.ok(Math.abs(offset.y) <= 8.4 * probe.trauma.t ** 2);
  assert.equal(JSON.stringify(probe), offsetBefore, "Reading offsets is pure");
  probe.update(1, null); assert.equal(probe.trauma.t, 0);
  assert.equal(probe.offset().x, 0); assert.equal(probe.offset().y, 0);
}
assert.ok(Math.abs(reference.trauma.t - .6) < 1e-9);
const invalidBefore = JSON.stringify(reference);
reference.update(0, null); reference.update(-1, null);
reference.trauma.add(NaN); reference.trauma.add(Infinity);
assert.equal(JSON.stringify(reference), invalidBefore);
reference.reduced = true;
assert.equal(reference.offset().x, 0); assert.equal(reference.offset().y, 0);
reference.update(.25, null); assert.ok(Math.abs(reference.trauma.t - .2) < 1e-9);
reference.reduced = false; reference.update(.125, null);
assert.ok(reference.trauma.t < 1e-9, "Trauma keeps decaying while reduced motion hides shake");

game.resetRun(0);
const player = JSON.stringify(game.player);
element("#motion-toggle").click();
assert.equal(game.effects.reduced, true);
assert.equal(JSON.stringify(game.player), player, "Motion preference cannot affect physics");
game.resetRun(0); assert.equal(game.effects.reduced, true, "Motion preference persists across retries");
assert.equal(element("#touch-controls").hidden, true);
element("#motion-toggle").click();

assert.ok(drawCalls.length > 0);
assert.ok(drawCalls.some(call => call.key === "clip"), "Rendering must clip scenery to the centred playfield");
for (const call of drawCalls) for (const arg of call.args) {
  if (typeof arg === "number") assert.ok(Number.isFinite(arg), `Nonfinite canvas argument in ${call.key}`);
}
console.log("Motion checks passed: real interpolation, pure drawing, pause freeze, recovery reset, bounded effects, reduced motion and PC controls.");
console.log("Trauma checks passed: accumulation, saturation, quadratic strength, 30/60/144/240 Hz decay and phase, offset bounds, reset and reduced motion.");

const particleColors = ["#8ce9de", "#cfe8d9", "#ffc36b", "#ffdc92", "#70e0ca", "#ff917e", "#8bbdc9", "#ee967e"];
for (const fixture of particleReference) {
  const fx = new context.MotionFX(); fx.burst(fixture.kind, 16600, 450, 350, -200);
  assert.equal(fx.seed, fixture.seed, `Preserved random stream: ${fixture.kind}`);
  assert.equal(fx.particles.live, fixture.count);
  for (const [i, expected] of fixture.initial.entries()) {
    for (const [key, value] of Object.entries(expected)) {
      if (key === "color") assert.equal(particleColors[fx.particles.color[i]], value);
      else assert.equal(fx.particles[key][i], Math.fround(value), `Initial ${fixture.kind}.${key}`);
    }
  }
  for (let i = 0; i < 20; i++) fx.update(1 / 120, null);
  for (const [i, expected] of fixture.after.entries()) for (const [key, value] of Object.entries(expected)) {
    if (key !== "color") assert.ok(Math.abs(fx.particles[key][i] - value) < .03, `Float32 drift: ${fixture.kind}.${key}`);
  }
}
const pool = new effects.particles.constructor(3);
const buffer = pool.x;
pool.spawn(1, 1, 0, 0, .01, 1, 60, 1);
pool.spawn(2, 2, 0, 0, 1, 2, 310, 6);
pool.spawn(3, 3, 0, 0, 1, 3, 60, 2);
pool.update(.02);
assert.equal(pool.live, 2);
assert.equal(pool.order[0], 2, "Expired slot receives the last live particle");
assert.equal(pool.color[0], 2); assert.equal(pool.size[0], 3);
pool.spawn(4, 4, 0, 0, 1, 4, 60, 4); pool.spawn(5, 5, 0, 0, 1, 5, 60, 5);
assert.deepEqual(Array.from(pool.order).sort(), [2, 3, 4], "Overflow preserves the newest particles after swap removal");
pool.clear(); assert.equal(pool.live, 0); assert.equal(pool.x, buffer);

const a = new context.MotionFX(), b = new context.MotionFX();
for (const fx of [a, b]) {
  for (const kind of ["attach", "boost", "water"]) fx.burst(kind, 200, 400, 350, -200);
  fx.update(.15, null); fx.rings.length = 0;
}
const start = drawCalls.length; a.draw(element("#game").getContext("2d"), 50);
const first = drawCalls.slice(start), secondStart = drawCalls.length;
b.draw(element("#game").getContext("2d"), 50);
assert.equal(JSON.stringify(first), JSON.stringify(drawCalls.slice(secondStart)), "Same seed produces identical batched drawing commands");
assert.equal(first.filter(call => call.key === "lineTo").length, a.particles.live, "Every live particle is drawn once");
assert.ok(first.filter(call => call.key === "stroke").length <= 12, "Three colors use at most four alpha buckets each");
const reuse = a.particles, array = a.particles.x;
a.reset(); assert.equal(a.particles, reuse); assert.equal(a.particles.x, array); assert.equal(a.particles.live, 0);
console.log("Particle-pool checks passed: legacy random fixtures, Float32 drift, swap removal, newest-first overflow, reused buffers and deterministic color/alpha batching.");

const rope = new context.MotionFX.VerletRope(); rope.reset(0, 0, 300, 0);
for (let i = 0; i < 600; i++) rope.step(1 / 120, 0, 0, 300, 0, 330);
assert.equal(rope.x[0], 0); assert.equal(rope.y[0], 0);
assert.equal(rope.x[12], 300); assert.equal(rope.y[12], 0);
let segmentError = 0;
for (let i = 0; i < 12; i++) segmentError = Math.max(segmentError, Math.abs(Math.hypot(rope.x[i + 1] - rope.x[i], rope.y[i + 1] - rope.y[i]) - 27.5));
assert.ok(segmentError < .09, `Settled segment error ${segmentError}`);
assert.ok(rope.y[6] > 60 && rope.y[6] < 63, "330px rope across 300px sags about 61px");
const referenceRope = new context.MotionFX.VerletRope(); referenceRope.reset(0, 0, 300, 0);
for (let i = 0; i < 600; i++) referenceRope.step(1 / 120, 0, 0, 300, 0, 330);
rope.kick(60, 1 / 120);
rope.step(1 / 120, 0, 0, 300, 0, 330); referenceRope.step(1 / 120, 0, 0, 300, 0, 330);
assert.ok(rope.x[6] > referenceRope.x[6], "Lateral release impulse moves interior points");
assert.equal(rope.x[0], 0); assert.equal(rope.x[12], 300);
rope.step(1 / 120, 16600.3, 400.2, 16900.7, 450.9, 250);
assert.equal(rope.x[0], Math.fround(16600.3)); assert.equal(rope.y[12], Math.fround(450.9));
for (const key of ["x", "y", "px", "py"]) assert.ok(Array.from(rope[key]).every(Number.isFinite));

game.resetRun(0); game.beginTether(); game.update(1 / 120); game.syncVisualPosition();
const attached = game.tetherAnchor(), hand = game.visualHand(game.player.x, game.player.y);
assert.equal(game.visualRopeState().anchorId, attached.id);
assert.equal(game.visualRope.x[0], Math.fround(hand.x));
assert.equal(game.visualRope.y[12], Math.fround(attached.y));
const ropeBefore = JSON.stringify(game.visualRope), drawStart = drawCalls.length;
game.drawRope(game.nearestAnchor());
assert.equal(JSON.stringify(game.visualRope), ropeBefore, "Drawing cannot advance Verlet simulation");
const curves = drawCalls.slice(drawStart).filter(call => call.key === "quadraticCurveTo");
assert.equal(curves.length, 11);
assert.equal(curves.at(-1).args[2], attached.x - game.cameraX());
game.pauseGame(); const frozenRope = JSON.stringify(game.visualRope);
game.frame(30000); game.frame(40000);
assert.equal(JSON.stringify(game.visualRope), frozenRope, "Pause freezes the visual rope");
game.resumeGame(); game.releaseTether({ award: false });
assert.ok(game.visualRopeState().release > 0, "Release remains visible briefly");
for (let i = 0; i < 21; i++) game.update(1 / 120);
assert.equal(game.visualRopeState().anchorId, null);
game.resetRun(0); game.beginTether();
element("#motion-toggle").click();
const reducedStart = drawCalls.length; game.drawRope(game.nearestAnchor());
assert.equal(drawCalls.slice(reducedStart).filter(call => call.key === "quadraticCurveTo").length, 1,
  "Reduced motion retains the original Bezier rope");
element("#motion-toggle").click(); game.update(1 / 120);
assert.equal(game.visualRopeState().anchorId, game.tetherAnchor().id);
game.takeHit("water"); assert.equal(game.visualRopeState().anchorId, null);
console.log(`Verlet-rope checks passed: fixed ends, segment error ${segmentError.toFixed(4)}px, ~61px sag, impulse, pure smoothing, pause, release fade, recovery and reduced-motion Bezier.`);

const spring = new context.MotionFX.Spring(); spring.kick(3); spring.update(1 / 120);
assert.ok(spring.x > 0 && spring.v < 3);
for (let i = 0; i < 479; i++) spring.update(1 / 120);
assert.ok(Math.abs(spring.x) < 1e-12 && Math.abs(spring.v) < 1e-12, "Spring settles without affecting physics");
spring.reset(); spring.kick(-2); spring.update(1 / 120); assert.ok(spring.x < 0);
const springReference = new context.MotionFX.Spring(); springReference.kick(3);
for (let i = 0; i < 120; i++) springReference.update(1 / 120);
for (const hz of [30, 60, 120, 144, 180, 240]) {
  game.resetRun(0); game.squash.kick(3); const body = JSON.stringify(game.player);
  for (let i = 0; i < hz; i++) game.updateSquash(1 / hz);
  assert.equal(JSON.stringify(game.squash), JSON.stringify(springReference), `Fixed spring at ${hz} render Hz`);
  assert.equal(JSON.stringify(game.player), body);
}
game.resetRun(0); game.beginTether(); assert.equal(game.squash.v, -2);
game.update(1 / 120); assert.ok(game.squash.x < 0);
const rawHand = game.courier.attachment(game.player.x, game.player.y), scaledHand = game.visualHand(game.player.x, game.player.y);
assert.equal(scaledHand.x, game.player.x + (rawHand.x - game.player.x) * (1 - game.squashValue() * .6));
assert.equal(scaledHand.y, game.player.y + (rawHand.y - game.player.y) * (1 + game.squashValue()));
const preDraw = JSON.stringify({ spring: game.squash, player: game.player, rig: game.courier.snapshot() });
game.drawPlayer(); game.drawPlayer();
assert.equal(JSON.stringify({ spring: game.squash, player: game.player, rig: game.courier.snapshot() }), preDraw);
game.pauseGame(); const pausedSpring = JSON.stringify(game.squash); game.frame(50000); game.frame(60000);
assert.equal(JSON.stringify(game.squash), pausedSpring);
game.resumeGame(); const releaseVelocity = game.squash.v; game.releaseTether();
assert.equal(game.squash.v, releaseVelocity + 3);
game.resetRun(0); game.takeHit("water"); assert.equal(game.squash.v, -3);
game.startRecovery(); assert.equal(game.squash.x, 0); assert.equal(game.squash.v, 0);
game.resetRun(0); game.takeHit("hazard"); assert.equal(game.squash.v, -3);
game.squash.x = 10; assert.equal(game.squashValue(), .2);
game.squash.x = -10; assert.equal(game.squashValue(), -.2);
element("#motion-toggle").click(); game.resetRun(0); game.beginTether(); game.update(1 / 120);
assert.equal(game.squash.x, 0); assert.equal(game.squash.v, 0); assert.equal(game.squashValue(), 0);
element("#motion-toggle").click();
console.log("Squash/stretch checks passed: impulses, decay, 30–240 Hz fixed stepping, scaled grip, pure drawing, pause, recovery reset and reduced motion.");
