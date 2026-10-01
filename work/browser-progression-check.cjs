const assert = require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright');
const url = process.env.GAME_URL || 'http://127.0.0.1:8765';
const out=path.join(__dirname,'evidence'); fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(url + '/');
    await page.locator('#start-screen [data-seal-practice="2"]').click();
    await page.waitForTimeout(150);
    assert.match(await page.locator('.route-label').textContent(),/2\. MÜHÜRÜ ÇALIŞ/);
    await page.keyboard.press('Escape');
    await page.locator('#restart-button').click();
    assert.match(await page.locator('.route-label').textContent(),/2\. MÜHÜRÜ ÇALIŞ/);
    await page.keyboard.press('Escape'); await page.locator('#menu-button').click();
    await page.locator('#sound-toggle').click(); await page.locator('#motion-toggle').click();
    await page.reload();
    assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#motion-toggle').getAttribute('aria-pressed'),'false');
    await page.locator('#log-toggle').click();
    assert.equal(await page.locator('#log-empty').isVisible(),true);
    await page.keyboard.press('Escape');

    await page.goto(url + '/work/browser-playtest.html');
    const lengths=await page.evaluate(()=>{
      const g=window.__playtest; window.__gameOptions.testRun=false;
      g.resetRun(-1); g.player.x=17401; g.update(1/120);
      const first=VoyageLog.list().length;
      g.update(1/120); const duplicate=VoyageLog.list().length;
      g.resetRun(0); g.player.x=17401; g.update(1/120);
      const training=VoyageLog.list().length;
      return {first,duplicate,training};
    });
    assert.deepEqual(lengths,{first:1,duplicate:1,training:1});
    await page.locator('#log-toggle').click();
    assert.equal(await page.locator('#log-rows tr').count(),1);
    assert.match(await page.locator('#log-rows').textContent(),/Fenere vardın/);
    await page.screenshot({path:path.join(out,'voyage-log.png')});
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{const g=window.__playtest;g.resetRun(-1);g.player.x=17401;g.update(1/120);});
    assert.equal(await page.locator('#result-practice').isVisible(),true);
    await page.locator('#result-practice [data-seal-practice="3"]').click();
    assert.equal(await page.evaluate(()=>window.__playtest.targetPractice().id),3);
    await page.evaluate(()=>window.__playtest.draw(0));
    const hudClear = await page.evaluate(() => {
      const box = selector => document.querySelector(selector).getBoundingClientRect();
      const label = box('.route-label'), seal = box('.map-seal');
      const center = box('.hud-center'), district = box('#district-name'), combo = box('#combo');
      return label.bottom <= seal.top && center.bottom <= district.top && district.bottom <= combo.top;
    });
    assert.equal(hudClear, true, 'Route markers, timing, district and target cue must remain separate');
    await page.screenshot({path:path.join(out,'target-training.png')});
    await page.evaluate(()=>{const g=window.__playtest;g.startRecovery();g.player.x=14301;g.update(0);});
    assert.match(await page.locator('#result-title').textContent(),/Mühür geride kaldı/);
    await page.locator('#replay-button').click();
    assert.equal(await page.evaluate(()=>window.__playtest.player.x),13940);
    const ropeBefore=await page.evaluate(()=>{
      const g=window.__playtest;g.resetRun(0);g.beginTether();
      Object.assign(g.player,{x:532,y:500,vx:200,vy:180});g.setCamera(72);g.draw(.1);
      return JSON.stringify({player:g.player,ring:g.tetherAnchor().id,length:g.ropeLength(),time:g.runTime()});
    });
    await page.keyboard.press('KeyM'); await page.keyboard.press('Space');
    await page.locator('[data-dock="vinc"]').click(); await page.locator('#harbor-leave-button').click();
    const ropeAfter=await page.evaluate(()=>{const g=window.__playtest;return JSON.stringify({player:g.player,ring:g.tetherAnchor()?.id,length:g.ropeLength(),time:g.runTime()});});
    assert.equal(ropeAfter,ropeBefore,'Real map/harbor controls must preserve the held rope');
    assert.equal(await page.evaluate(()=>{const g=window.__playtest;for(let i=0;i<42;i++)g.update(1/120);return g.recoveryReady();}),false);

    await page.setViewportSize({width:1024,height:600});
    await page.goto(url + '/work/browser-playtest.html');
    await page.locator('#explore-button').click();
    await page.evaluate(()=>{const g=window.__playtest;g.player.x=270;g.updateSocial(0);g.openConversation();g.frame(1000);});
    const contained=await page.evaluate(()=>{
      const frame=document.querySelector('.game-frame').getBoundingClientRect();
      const box=document.querySelector('#dialogue').getBoundingClientRect();
      return box.top>=frame.top&&box.bottom<=frame.bottom&&box.left>=frame.left&&box.right<=frame.right;
    });
    assert.equal(contained,true,'Dialogue must fit a short desktop window');
    await page.screenshot({path:path.join(out,'short-pc-conversation.png')});
    await page.keyboard.press('Escape'); await page.keyboard.press('KeyM');
    await page.locator('[data-dock="fener"]').click();
    assert.equal(await page.locator('#social-place').textContent(),'Fener İskelesi');

    // Use native storage and a fresh origin session before any game script reads it.
    const hostileContext = await browser.newContext();
    const hostilePage = await hostileContext.newPage();
    hostilePage.on('pageerror', e => errors.push(e.message));
    const payload = `<img src=x onerror=globalThis.__injected=1>`;
    const hostileText = `${payload}&<>"'`;
    await hostilePage.addInitScript(({ payload, hostileText }) => {
      window.requestAnimationFrame = () => 0;
      const row = { at: '2026-10-01T00:00:00.000Z', won: false, seals: 2, score: 1200,
        time: 10, hits: 1, cleanThrows: 4, splits: [5, 10], reason: payload };
      localStorage.setItem('sapan-postasi-voyages-v1', JSON.stringify({ version: 1,
        runs: [row, { ...row, at: hostileText }, { ...row, score: hostileText }] }));
      localStorage.setItem('sapan-postasi-sohbet-v1', JSON.stringify([hostileText, 'emine']));
    }, { payload, hostileText });
    await hostilePage.goto(url + '/');
    await hostilePage.evaluate(() => {
      const g = window.__hostileGame = SapanGame.create({ debug: true, testRun: true });
      g.toggleLog();
    });
    assert.equal(await hostilePage.locator('#log-rows tr').count(), 1);
    assert.match(await hostilePage.locator('#log-rows').textContent(), /Yarım kaldı/);
    await hostilePage.evaluate(hostileText => {
      const g = window.__hostileGame;
      g.toggleLog(); g.resetRun(-1); g.update(.1);
      g.splitTimes().push({ name: hostileText, at: g.runTime() }); g.finishRun(false);
    }, hostileText);
    assert.equal(await hostilePage.locator('#result-splits li span').textContent(), hostileText);
    await hostilePage.evaluate(hostileText => {
      const g = window.__hostileGame;
      const node = HarborSocial.getNode('okan'); node.choices[0].text = hostileText;
      g.enterHarbor('vinc'); g.player.x = 5720; g.openConversation();
    }, hostileText);
    assert.equal(await hostilePage.locator('#dialogue-choices button').first().textContent(), `1${hostileText}`);
    assert.equal(await hostilePage.locator('#log-rows img, #result-splits img, #dialogue-choices img').count(), 0);
    await hostilePage.waitForTimeout(100);
    assert.equal(await hostilePage.evaluate(() => globalThis.__injected), undefined);
    await hostilePage.locator('#dialogue-choices button').first().click();
    assert.equal(await hostilePage.evaluate(() => window.__hostileGame.conversation().node), 'eldiven');
    await hostileContext.close();

    await context.setOffline(true);
    const file='file:///'+path.resolve(__dirname,'..','index.html').replaceAll('\\','/');
    await page.goto(file);
    await page.locator('#explore-button').click(); await page.keyboard.down('KeyD');
    await page.waitForTimeout(650); await page.keyboard.up('KeyD'); await page.keyboard.press('KeyE');
    assert.equal(await page.locator('#dialogue-name').textContent(),'Emine abla');
    assert.equal(await page.locator('#dialogue').isVisible(),true);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({errors,lengths,settingsReload:true,shortPc:true,hostileStorage:true,offlineFile:true,screenshots:out},null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
