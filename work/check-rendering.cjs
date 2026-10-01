const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { context, element } = require("./check-game.cjs");

const hostile = `<img src=x onerror=globalThis.__injected=1>`;
const text = `${hostile}&<>"'`;
const encoded = "&lt;img src=x onerror=globalThis.__injected=1&gt;&amp;&lt;&gt;&quot;&#39;";
const row = { at: "2026-10-01T00:00:00.000Z", won: false, seals: 2, score: 1200,
  time: 10, hits: 1, cleanThrows: 4, splits: [5, 10], reason: hostile };
const store = new Map([
  ["sapan-postasi-voyages-v1", JSON.stringify({ version: 1, runs: [row,
    ...["at", "seals", "score", "time", "hits", "cleanThrows", "splits"].map(field => ({ ...row, [field]: text }))] })],
  ["sapan-postasi-sohbet-v1", JSON.stringify([hostile, "emine", text])],
  ...["best", "best-time", "best-time-full", "motion", "sound", "tutorial"]
    .map(key => [`sapan-postasi-${key}`, text])
]);
context.localStorage = {
  getItem: key => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
};
for (const name of ["harbor-social.js", "voyage-log.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", name), "utf8"), context, { filename: name });
}
const game = context.SapanGame.create({ debug: true, testRun: true });
assert.equal(context.VoyageLog.list().length, 1, "Hostile typed log fields must be rejected on load");
assert.equal(context.VoyageLog.list()[0].reason, hostile, "Allowed reason text must survive validation safely");
assert.deepEqual(Array.from(context.HarborSocial.contacts()), ["emine"]);
game.toggleLog();
const log = element("#log-rows").innerHTML;
assert.equal((log.match(/<tr>/g) || []).length, 1);
assert.match(log, /Yarım kaldı/);
assert.match(log, /<td>2\/3<\/td>/);
assert.ok(!log.includes(hostile), "Reason text must not become log markup");
assert.equal(element("#best-start").textContent, "00000", "Hostile score text must not be coerced into a record");
game.toggleLog();

// Exercise the real renderers with text beyond today's fixed content.
game.resetRun(-1);
game.update(0.1);
game.splitTimes().push({ name: text, at: game.runTime() });
game.finishRun(false);
assert.ok(element("#result-splits").innerHTML.includes(`<span>${encoded}</span>`));
assert.ok(!element("#result-splits").innerHTML.includes("<img"));

game.enterHarbor("vinc");
game.player.x = 5720;
const node = context.HarborSocial.getNode("okan");
node.choices[0].text = text;
node.person.name = text;
node.person.role = text;
game.openConversation();
assert.equal(element("#dialogue-name").textContent, text);
assert.equal(element("#dialogue-role").textContent, text);
assert.ok(element("#dialogue-choices").innerHTML.includes(`<kbd>1</kbd>${encoded}</button>`));
assert.ok(!element("#dialogue-choices").innerHTML.includes("<img"));
const next = node.choices[0].next;
game.chooseConversation(0);
assert.equal(game.conversation().node, next, "Escaping must preserve answer navigation");

context.HarborWorld = { ...context.HarborWorld,
  districts: context.HarborWorld.districts.map((district, i) => ({ ...district, name: i === 0 ? text : district.name })) };
element("#map-segments").innerHTML = "";
game.seals[0].id = text;
game.anchors[6].type = text;
game.updateHud(true);
assert.ok(element("#map-segments").innerHTML.includes(`title="${encoded}"`));
assert.ok(element("#map-landmarks").innerHTML.includes(`title="${encoded}. mühür"`));
assert.ok(element("#map-landmarks").innerHTML.includes(`is-${encoded}`));
assert.ok(element("#seal-marks").innerHTML.includes(`>${encoded}</li>`));
assert.equal(context.__injected, undefined);
console.log("Rendering checks passed: hostile localStorage, escaped splits/choices, literal dialogue text, attributes, and answer navigation.");
