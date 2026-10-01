const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright');
const {launchBrave}=require('./browser-launch.cjs');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const url = process.env.GAME_URL || 'http://127.0.0.1:8765';
(async()=>{
  const browser=await launchBrave(chromium);
  try {
    const page=await browser.newPage({viewport:{width:1920,height:1080}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.requestAnimationFrame=callback=>{window.__meterFrame=callback;return 1;};
    });
    const fileURL=pathToFileURL(path.join(__dirname,'..','index.html')).href;
    for(const base of [url+'/index.html',fileURL]) {
      await page.goto(base+'?performance');
      assert.equal(await page.locator('#perf-readout').isVisible(),false);
      await page.goto(base+'?perf');
      assert.equal(await page.locator('#perf-readout').isVisible(),true);
      const readings=await page.evaluate(()=>{
        let ts=0;
        window.__meterFrame(ts);
        const empty=document.querySelector('#perf-readout').textContent;
        for(let i=1;i<=240;i++) window.__meterFrame(ts+=1000+i);
        const filled=document.querySelector('#perf-readout').textContent;
        for(let i=0;i<240;i++) window.__meterFrame(ts+=1000);
        const rolled=document.querySelector('#perf-readout').textContent;
        window.__meterFrame(ts+=10);
        const throttled=document.querySelector('#perf-readout').textContent;
        for(let i=0;i<4;i++) window.__meterFrame(ts+10000*(i+1));
        return {empty,filled,rolled,throttled,spike:document.querySelector('#perf-readout').textContent};
      });
      assert.match(readings.empty,/p95 0\.0 ms · p99 0\.0 ms/);
      assert.match(readings.filled,/p95 1229\.0 ms · p99 1238\.0 ms/);
      assert.match(readings.rolled,/p95 1000\.0 ms · p99 1000\.0 ms/);
      assert.equal(readings.throttled,readings.rolled);
      assert.match(readings.spike,/p95 1000\.0 ms · p99 10000\.0 ms/);
    }
    assert.deepEqual(errors,[]);
    console.log('Frame-meter checks passed: opt-in, exact percentiles, zero timestamp, rolling 240 frames, throttled readout, HTTP and file://.');
    await page.close();
    const perfPage=await browser.newPage({viewport:{width:1920,height:1080}});
    await perfPage.goto(url + '/work/browser-playtest.html');
    await require('./browser-water-check.cjs')(perfPage);
    await require('./browser-static-check.cjs')(perfPage);
    await require('./browser-glow-check.cjs')(perfPage);
    await require('./browser-particle-check.cjs')(perfPage);
    await require('./browser-ui-check.cjs')(perfPage);
    const report=await perfPage.evaluate(async()=>{
      const g=window.__playtest,report=[];
      const quant=(a,p)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))];
      for(const [district,x] of [['rihtim',1000],['pazar',4600],['vinc',9000],['dalgakiran',14000],['fener',16600]]) {
        g.resetRun(0);
        const costs=[],intervals=[]; let last=0;
        for(let i=0;i<120;i++) {
          const ts=await new Promise(resolve=>window.__nativeRAF(resolve));
          if(last&&i>20) intervals.push(ts-last); last=ts;
          g.player.x=x+i*2; g.player.y=410; g.setCamera(g.player.x-460);
          const start=performance.now(); g.draw(ts/1000);
          if(i>20) costs.push(performance.now()-start);
        }
        report.push({district,drawMedian:quant(costs,.5),drawP95:quant(costs,.95),drawP99:quant(costs,.99),drawMax:Math.max(...costs),rafMedian:quant(intervals,.5),rafP95:quant(intervals,.95),rafP99:quant(intervals,.99)});
      }
      return report;
    });
    fs.writeFileSync(path.join(__dirname,'evidence','performance-report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
