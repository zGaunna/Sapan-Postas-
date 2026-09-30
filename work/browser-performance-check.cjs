const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright');
const url = process.env.GAME_URL || 'http://127.0.0.1:8765';
(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1920,height:1080}});
    await page.goto(url + '/work/browser-playtest.html');
    const report=await page.evaluate(async()=>{
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
        report.push({district,drawMedian:quant(costs,.5),drawP95:quant(costs,.95),drawMax:Math.max(...costs),rafMedian:quant(intervals,.5),rafP95:quant(intervals,.95)});
      }
      return report;
    });
    fs.writeFileSync(path.join(__dirname,'evidence','performance-report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
