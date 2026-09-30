const assert = require('node:assert/strict');
const { game, context, dispatchKey, dispatchKeyUp, element } = require('./check-game.cjs');
const records = () => ['sapan-postasi-best','sapan-postasi-best-time','sapan-postasi-best-time-full','sapan-postasi-voyages-v1'].map(k=>context.localStorage.getItem(k));
const before = records();
for (const id of [1,2,3]) {
  assert.equal(game.startSealPractice(id), true);
  const spawn = JSON.stringify(game.player);
  for(let i=0;i<1200;i++) game.update(1/120);
  assert.equal(JSON.stringify(game.player), spawn, 'Target lesson waits for a fresh input');
  assert.equal(game.runTime(),0);
  assert.equal(game.sealCount(),0,'Other seals must not be pre-awarded');
  game.startRecovery(); game.update(1/120); game.takeHit('water');
  assert.equal(JSON.stringify(game.player), spawn, 'A fall resets the exact training approach');
  assert.equal(game.lives(),3);
  game.restartCurrentRun();
  assert.equal(game.targetPractice().id,id);
  dispatchKey('KeyD'); dispatchKeyUp('KeyD');
  const reelTo = id===2?220:118;
  const releaseOffset = id===2?40:0;
  for(let i=0;i<120*8 && game.state()==='playing';i++) {
    game.keys.clear(); game.keys.add('KeyD');
    const ring=game.tetherAnchor();
    if(!ring) game.beginTether();
    else {
      if(game.ropeLength()>reelTo) game.keys.add('KeyW');
      if(game.player.y>ring.y && game.player.x-ring.x>=releaseOffset && game.player.vx>140) game.releaseTether();
    }
    game.update(1/120);
  }
  assert.equal(game.state(),'won',`Target ${id} must be reachable through real controls`);
  assert.equal(game.stats().hits,0);
  assert.equal(game.sealCount(),1);
  assert.equal(game.seals.filter(s=>s.collected).length,1);
  assert.match(element('#result-title').textContent,new RegExp(`${id}\\. mührü aldın`));
  assert.deepEqual(records(),before,'Target lessons must not write ordinary records or history');
  element('#replay-button').click();
  assert.equal(game.targetPractice().id,id);
  assert.equal(game.recoveryReady(),true);
}
assert.equal(game.startSealPractice(9),false);
game.startSealPractice(2); game.startRecovery();
const targetStart=game.targetPractice().x;
game.player.x=11201; game.player.y=400; game.update(0);
assert.equal(game.state(),'lost','Missing the target must end the lesson without a false success');
assert.equal(game.sealCount(),0);
assert.doesNotMatch(element('#result-title').textContent,/aldın/);
dispatchKey('KeyR'); dispatchKeyUp('KeyR');
assert.equal(game.player.x,targetStart,'R always returns to the selected target approach');
assert.equal(game.checkpointX(),targetStart);
game.startRecovery(); game.finishRun(true);
assert.equal(game.state(),'lost','Even direct finish requests cannot claim an uncollected target');
game.resetRun(-1);
assert.equal(game.targetPractice(),null);
console.log('Target training passed: three actual control routes, frozen start, exact retry, focused collection, replay and record isolation.');
