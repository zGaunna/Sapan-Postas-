const assert = require("node:assert/strict");
const { game, context, element } = require("./check-game.cjs");

const events = [];
const receivedContexts = [];
let machine;
const menu = {
  enter(context) { events.push(["menu.enter", machine.current === menu, context.kind]); },
  update(dt, phase) { events.push(["menu.update", dt, phase]); },
  draw(time) { events.push(["menu.draw", time]); },
  exit(context) { events.push(["menu.exit", machine.current === menu, context.kind]); receivedContexts.push(context); },
};
const playing = {
  enter(context) { events.push(["playing.enter", machine.current === playing, context.kind]); receivedContexts.push(context); },
  update(dt, phase) { events.push(["playing.update", dt, phase]); },
  draw(time) { events.push(["playing.draw", time]); },
  exit(context) { events.push(["playing.exit", machine.current === playing, context.kind]); receivedContexts.push(context); },
};
machine = game.createStateMachine({ menu, playing }, menu);
assert.strictEqual(machine.current, menu);
assert.equal(machine.is(menu), true);
assert.equal(machine.is(playing), false);
assert.equal(machine.in([playing, menu]), true);
assert.equal(machine.in([playing]), false);
machine.start();
machine.update(1 / 120, "fixed");
machine.draw(2.5);
assert.deepEqual(events, [
  ["menu.enter", true, "startup"],
  ["menu.update", 1 / 120, "fixed"],
  ["menu.draw", 2.5],
]);

events.length = 0;
const contextForTransition = { kind: "example" };
machine.transition(playing, contextForTransition);
machine.update(0.025, "idle");
machine.draw(3.25);
assert.deepEqual(events, [
  ["menu.exit", true, "example"],
  ["playing.enter", true, "example"],
  ["playing.update", 0.025, "idle"],
  ["playing.draw", 3.25],
]);
assert.strictEqual(receivedContexts[0], contextForTransition, "Exit must receive the supplied context");
assert.strictEqual(receivedContexts[1], contextForTransition, "Enter must receive the same context");
assert.strictEqual(machine.current, playing);
assert.equal(machine.is(playing), true);
assert.equal(machine.in([menu, playing]), true);
assert.equal(machine.in([menu]), false);

events.length = 0;
assert.throws(() => machine.transition({ id: "unknown" }), /Unknown game state/);
assert.deepEqual(events, [], "Invalid targets must be rejected before exit");
assert.strictEqual(machine.current, playing, "Invalid targets must preserve the current state");
machine.transition(playing, { kind: "again" });
assert.deepEqual(events, [
  ["playing.exit", true, "again"],
  ["playing.enter", true, "again"],
], "Transitioning to the current state must re-enter it");
assert.strictEqual(receivedContexts[2], receivedContexts[3], "Same-state hooks must share the transition context");

const definitions = game.stateDefinitions();
assert.equal(Object.isFrozen(definitions), true);
assert.deepEqual(Object.keys(definitions), ["menu", "playing", "exploring", "paused", "map", "history", "won", "lost"]);
for (const id of Object.keys(definitions)) {
  const state = definitions[id];
  assert.equal(Object.isFrozen(state), true, `${id} definition must be frozen`);
  assert.equal(state.id, id);
  for (const hook of ["enter", "update", "draw", "exit", "canStep"]) {
    assert.equal(typeof state[hook], "function", `${id}.${hook} must exist`);
  }
  assert.equal(typeof state.animate, "boolean", `${id}.animate must be a boolean`);
}

game.resetRun(-1);
game.finishRun(false, "timeout");
assert.equal(game.state(), "lost");
element("#result-menu-button").click();
assert.equal(game.state(), "menu");
assert.equal(element("#start-screen").hidden, false);
assert.equal(element("#result-screen").hidden, true);

game.toggleMap();
assert.equal(game.state(), "map");
assert.equal(element("#harbor-map").hidden, false);
game.toggleMap();
assert.equal(game.state(), "menu");
assert.equal(element("#harbor-map").hidden, true);
game.toggleLog();
assert.equal(game.state(), "history");
assert.equal(element("#voyage-log").hidden, false);
game.toggleLog();
assert.equal(game.state(), "menu");
assert.equal(element("#voyage-log").hidden, true);

game.resetRun(-1);
game.completeTutorial();
assert.equal(game.state(), "playing");
game.frame(1000);
game.frame(1010);
const flightTime = game.runTime();
game.pauseGame();
assert.equal(game.state(), "paused");
assert.equal(element("#pause-screen").hidden, false);
game.frame(2000);
assert.equal(game.runTime(), flightTime, "Flight clock must stop while paused");
game.resumeGame();
assert.equal(game.state(), "playing");
game.frame(5000);
assert.equal(game.runTime(), flightTime, "Resuming must reset the frame clock");
game.frame(5010);
assert.ok(game.runTime() > flightTime, "Flight clock must advance after resume");

const beforeMap = game.runTime();
game.toggleMap();
assert.equal(game.state(), "map");
game.frame(6000);
assert.equal(game.runTime(), beforeMap, "Flight clock must stop under the map");
game.toggleMap();
assert.equal(game.state(), "playing");
game.frame(7000);
assert.equal(game.runTime(), beforeMap, "Closing the map must reset the frame clock");

assert.equal(game.enterHarbor("rihtim"), true);
assert.equal(game.state(), "exploring");
assert.equal(element("#social-hud").hidden, false);
const harborTime = game.runTime();
const harborX = game.player.x;
game.pauseGame();
assert.equal(game.state(), "paused");
game.frame(8000);
assert.equal(game.runTime(), harborTime, "Flight clock must stay frozen in harbor pause");
assert.equal(game.player.x, harborX, "Harbor movement must stop while paused");
game.resumeGame();
assert.equal(game.state(), "exploring");
game.toggleMap();
assert.equal(game.state(), "map");
game.toggleMap();
assert.equal(game.state(), "exploring");
game.toggleLog();
assert.equal(game.state(), "history");
game.toggleLog();
assert.equal(game.state(), "exploring");
game.leaveHarbor();
assert.equal(game.state(), "playing");
assert.equal(game.runTime(), harborTime, "Harbor visit must preserve the flight clock");

game.resetRun(-1);
game.finishRun(true);
assert.equal(game.state(), "won");
assert.equal(element("#result-screen").hidden, false);
assert.equal(element("#result-kicker").textContent, "FENERE VARDIN");
assert.equal(element("#result-title").textContent, "Fener sönmeden yetiştin.");
assert.match(element("#result-copy").textContent, /0\/3 mühür topladın/);
const winOutput = ["#result-kicker", "#result-title", "#result-copy", "#final-score"]
  .map(selector => element(selector).textContent);
game.toggleLog();
assert.equal(game.state(), "history");
game.toggleLog();
assert.equal(game.state(), "won");
assert.equal(element("#result-screen").hidden, false);
assert.deepEqual(["#result-kicker", "#result-title", "#result-copy", "#final-score"]
  .map(selector => element(selector).textContent), winOutput);

game.resetRun(-1);
game.finishRun(false, "timeout");
assert.equal(game.state(), "lost");
assert.equal(element("#result-screen").hidden, false);
assert.equal(element("#result-kicker").textContent, "VARDİYA BİTTİ");
assert.equal(element("#result-title").textContent, "Bu gece olmadı.");
assert.match(element("#result-copy").textContent, /^Vardiya süresi doldu\./);
const lossOutput = ["#result-kicker", "#result-title", "#result-copy", "#final-score"]
  .map(selector => element(selector).textContent);
game.toggleLog();
game.toggleLog();
assert.equal(game.state(), "lost");
assert.deepEqual(["#result-kicker", "#result-title", "#result-copy", "#final-score"]
  .map(selector => element(selector).textContent), lossOutput);

assert.equal(element("#sound-toggle").title, "Sesi aç", "Harness starts with sound off");
let oscillatorStarts = 0;
let resumes = 0;
class FakeAudioContext {
  constructor() {
    this.state = "suspended";
    this.currentTime = 0;
    this.destination = {};
  }
  resume() { resumes += 1; this.state = "running"; }
  createOscillator() {
    return { frequency: { setValueAtTime() {} }, connect() {},
      start() { oscillatorStarts += 1; }, stop() {} };
  }
  createGain() {
    return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
  }
}
context.AudioContext = FakeAudioContext;
element("#sound-toggle").click();
assert.equal(oscillatorStarts, 1, "Enabling sound plays one confirmation tone");
game.resetRun(-1);
assert.equal(oscillatorStarts, 2, "Starting a run plays one tone");
game.finishRun(true);
assert.equal(oscillatorStarts, 4, "Finishing a run plays two win tones");
assert.equal(resumes, 1, "Suspended audio must resume once");
game.finishRun(true);
assert.equal(oscillatorStarts, 4, "A terminal run must not play its result twice");
assert.equal(resumes, 1);

console.log("State-machine checks passed: lifecycle, frozen registry, transitions, overlays, clocks, and audio.");
