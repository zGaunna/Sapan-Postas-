const assert = require("node:assert/strict");
const { game, context, element, drawCalls } = require("./check-game.cjs");

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
