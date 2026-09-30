const assert = require('node:assert/strict');
require('./check-target.cjs');
const { game, element } = require('./check-game.cjs');

for (const id of [1, 2, 3]) {
  game.startSealPractice(id);
  game.draw(0);
  assert.equal((element('#map-segments').innerHTML.match(/<span /g) || []).length, 5);
  assert.match(element('#map-next').textContent, new RegExp(`${id}\\. mühür`));
  assert.match(element('#map-landmarks').innerHTML, /map-seal is-waiting is-target/);
  const target = game.seals.find(seal => seal.id === id);
  target.collected = true;
  game.finishRun(true);
  assert.equal(element('#normal-shift-button').hidden, false);
  element('#normal-shift-button').click();
  assert.equal(game.targetPractice(), null);
  assert.equal(game.practiceIndex(), -1);
}
game.finishRun(false);
assert.equal(element('#normal-shift-button').hidden, true);
console.log('Desktop features preserved: five district markers, targeted seal and return to normal shift.');
