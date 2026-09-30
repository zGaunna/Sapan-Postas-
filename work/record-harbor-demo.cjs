const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright');
(async()=>{
 const out=path.join(__dirname,'evidence'),browser=await chromium.launch({headless:true});fs.mkdirSync(out,{recursive:true});
 const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:out,size:{width:1280,height:720}}});
 const page=await context.newPage(),video=page.video();
 try{
  await page.goto('http://127.0.0.1:8765/');
  await page.addStyleTag({content:'.topbar,.bottomline{display:none}.app-shell{width:100%;padding:0}.game-frame{width:1280px;height:720px;max-height:none;border:0;border-radius:0}'});
  await page.locator('#explore-button').click();
  await page.keyboard.down('KeyD');await page.waitForTimeout(700);await page.keyboard.up('KeyD');await page.keyboard.press('KeyE');
  await page.waitForTimeout(1700);await page.keyboard.press('Digit1');await page.waitForTimeout(1900);await page.keyboard.press('Escape');
  await page.keyboard.press('KeyM');await page.waitForTimeout(1300);await page.locator('[data-dock="vinc"]').click();
  await page.keyboard.down('KeyA');await page.waitForTimeout(240);await page.keyboard.up('KeyA');await page.keyboard.press('KeyE');await page.waitForTimeout(1800);
  await page.keyboard.press('Digit2');await page.waitForTimeout(1700);await page.keyboard.press('Escape');await page.keyboard.press('KeyM');
  await page.locator('[data-dock="dalgakiran"]').click();await page.keyboard.down('KeyA');await page.waitForTimeout(250);await page.keyboard.up('KeyA');await page.keyboard.press('KeyE');await page.waitForTimeout(1800);
  await page.keyboard.press('Escape');await page.keyboard.press('KeyM');await page.locator('[data-dock="fener"]').click();
  await page.keyboard.down('KeyD');await page.waitForTimeout(1100);await page.keyboard.up('KeyD');await page.keyboard.press('KeyE');await page.waitForTimeout(2200);
 }finally{
  await context.close();
  try {await video.saveAs(path.join(out,'liman-demo.webm'));} finally {await browser.close();}
 }
 console.log(path.join(out,'liman-demo.webm'));
})().catch(e=>{console.error(e);process.exitCode=1;});
