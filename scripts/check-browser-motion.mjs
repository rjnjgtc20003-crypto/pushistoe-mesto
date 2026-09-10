// Headless-only diagnostics. Uses an isolated Chrome profile, never desktop input.
// Test instrumentation is served in memory; production files are unchanged.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const out=path.resolve(process.env.MOTION_REPORT_DIR??'outputs/browser-motion');
await fs.mkdir(out,{recursive:true});
const root=path.resolve(process.env.MOTION_SITE_ROOT??'public/github-site');
const source=await fs.readFile(path.join(root,'scene.js'),'utf8');
const sha=text=>createHash('sha256').update(text).digest('hex');
const rows=[];
const errors=[];
const mime={'.js':'text/javascript','.html':'text/html','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'};
const injected=source.replace('function animate() {',`function animate() {
  const diagnosticStart=performance.now();`)
  .replace('  requestAnimationFrame(animate);',`  if(window.__recordFrames) window.__recordFrames.push({
    now:diagnosticStart,cpu:performance.now()-diagnosticStart,
    action:actionState?.id??null,
    supportOffset:leftHand?.userData.supportOffset,
    position:leftHand?.position.toArray(),quaternion:leftHand?.quaternion.toArray(),
    triangles:renderer.info.render.triangles,calls:renderer.info.render.calls
  });
  requestAnimationFrame(animate);`)+`
const naturalTime=clock.getElapsedTime.bind(clock);
clock.getElapsedTime=()=>window.__fixedTime??naturalTime();
window.__sceneTest={
  ready:()=>!actionButtons[0].disabled,
  fur:(visible)=>{furCloud.visible=visible;},
  density:(count)=>{furGeometry.instanceCount=count;},
  info:()=>({hairCount,verticesPerHair:baseHair.attributes.position.count,
    trianglesPerHair:baseHair.index.count/3,pixelRatio:renderer.getPixelRatio(),
    handScale:leftHand.scale.x,contactSamples:leftHand.userData.model.userData.contactSamples?.length}),
  play:playAction,
  rotate:(x,y)=>{targetRigRotationX=x;targetRigRotationY=y;interactionRig.rotation.set(x,y,0);rigVelocityX=rigVelocityY=0;},
  at:(seconds)=>{
    window.__fixedTime=0;previousHandTime=0;actionState=null;blinkStarted=-1;nextBlink=999;playAction('pet');
    if(typeof furResponse!=='undefined')furResponse.reset();
    for(let t=1/120;t<seconds;t+=1/120)updateAction(t);
    window.__fixedTime=seconds;
  },
};`;
const server=http.createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
    const filename=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!filename.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
    const content=filename===path.join(root,'scene.js')?injected:await fs.readFile(filename);
    res.writeHead(200,{'Content-Type':mime[path.extname(filename)]??'application/octet-stream','Cache-Control':'no-store'}).end(content);
  } catch {res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const local=`http://127.0.0.1:${server.address().port}/`;
let browser;
function summarize(frames) {
  const gaps=frames.slice(1).map((f,i)=>f.now-frames[i].now).sort((a,b)=>a-b);
  const costs=frames.map(f=>f.cpu).sort((a,b)=>a-b);
  const p=(a,x)=>a[Math.min(a.length-1,Math.floor(a.length*x))]??0;
  const duration=frames.at(-1).now-frames[0].now;
  return {frames:frames.length,averageFps:(frames.length-1)*1000/duration,
    frameMsP50:p(gaps,.5),frameMsP95:p(gaps,.95),maxGapMs:p(gaps,1),
    gapsOver25ms:gaps.filter(x=>x>25).length,gapsOver50ms:gaps.filter(x=>x>50).length,
    callbackMsP50:p(costs,.5),callbackMsP95:p(costs,.95),triangles:frames.at(-1).triangles};
}
async function collect(page,label,action,ms=5000,localTest=true) {
  await page.evaluate(({action,localTest})=>{
    window.__recordFrames=[];
    if(action) {
      if(localTest)window.__sceneTest.play(action);
      else document.querySelector('[data-action="'+action+'"]').click();
    }
  },{action,localTest});
  await page.waitForTimeout(ms);
  const frames=await page.evaluate(()=>{const data=window.__recordFrames;window.__recordFrames=null;return data;});
  const summary={label,...summarize(frames)};
  rows.push(summary);console.log(JSON.stringify(summary));
  await fs.writeFile(path.join(out,`${label}.json`),JSON.stringify({summary,frames},null,2));
}
try {
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1});
  const page=await context.newPage();
  page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR:',e.message);});
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  // Wrap only the app's animation callback, not Playwright's own polling frames.
  await page.addInitScript(()=>{
    // Haptics need user activation; they are not part of a timing benchmark.
    navigator.vibrate=()=>false;
    const nativeRAF=requestAnimationFrame.bind(window);
    window.requestAnimationFrame=callback=>nativeRAF(timestamp=>{
      if(callback.name!=='animate'||location.hostname==='127.0.0.1')return callback(timestamp);
      const start=performance.now();callback(timestamp);
      if(window.__recordFrames)window.__recordFrames.push({now:start,cpu:performance.now()-start});
    });
  });
  const live='https://rjnjgtc20003-crypto.github.io/pushistoe-mesto/';
  await page.goto(live,{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>!document.querySelector('[data-action="pet"]').disabled,{timeout:30000});
  const liveSource=await context.request.get(live+'scene.js');
  const liveText=await liveSource.text();
  const glInfo=await page.evaluate(()=>{
    const gl=document.querySelector('canvas').getContext('webgl2');
    const ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
      userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory};
  });
  const environment={...glInfo,sourceMatchesPublished:sha(source)===sha(liveText),
    localHash:sha(source),liveHash:sha(liveText),cacheControl:liveSource.headers()['cache-control']};
  console.log(JSON.stringify(environment));
  await collect(page,'published-idle',null,3500,false);
  await collect(page,'published-pet-first','pet',5000,false);
  await collect(page,'published-pet-warm','pet',5000,false);
  await page.screenshot({path:path.join(out,'published-idle.png')});
  await page.goto(local,{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>window.__sceneTest?.ready());
  environment.scene=await page.evaluate(()=>window.__sceneTest.info());
  await collect(page,'local-full-fur','pet');
  await collect(page,'local-pet-warm','pet');
  await collect(page,'local-head-pat','head-pat');
  await collect(page,'local-squeeze','squeeze');
  await page.evaluate(()=>window.__sceneTest.fur(false));
  await collect(page,'local-without-fur','pet');
  await page.evaluate(()=>{window.__sceneTest.fur(true);window.__sceneTest.density(18000);});
  await collect(page,'local-half-fur','pet');
  await page.evaluate(()=>window.__sceneTest.density(window.__sceneTest.info().hairCount));
  for(const seconds of [.2,.65,.8,1.15,1.7,2.3,2.9,3.45,3.9,4.3]) {
    await page.evaluate(t=>window.__sceneTest.at(t),seconds);
    await page.waitForTimeout(120);
    await page.screenshot({path:path.join(out,`stroke-${seconds.toFixed(2)}.png`)});
  }
  await page.evaluate(()=>{window.__fixedTime=undefined;});
  for(const angle of [-1,1,2.2]) {
    await page.evaluate(angle=>{window.__sceneTest.rotate(.2,angle);window.__sceneTest.at(2.3);},angle);
    await page.waitForTimeout(120);
    await page.screenshot({path:path.join(out,`stroke-rotated-${angle}.png`)});
  }
  await page.evaluate(()=>{window.__sceneTest.rotate(0,0);window.__fixedTime=undefined;});
  await page.setViewportSize({width:390,height:844});
  await collect(page,'mobile-viewport','pet');
  await page.screenshot({path:path.join(out,'mobile-idle.png')});
  // Phone-sized render buffer, still using the desktop GPU: not a phone benchmark.
  const phoneContext=await browser.newContext({viewport:{width:390,height:844},
    deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const phone=await phoneContext.newPage();
  await phone.goto(local,{waitUntil:'networkidle',timeout:60000});
  await phone.waitForFunction(()=>window.__sceneTest?.ready());
  await collect(phone,'mobile-dpr3-first','pet');
  await collect(phone,'mobile-dpr3-warm','pet');
  await phone.screenshot({path:path.join(out,'mobile-dpr3-idle.png')});
  await phone.evaluate(()=>window.__sceneTest.at(2.3));
  await phone.waitForTimeout(120);
  await phone.screenshot({path:path.join(out,'mobile-dpr3-pet.png')});
  await phoneContext.close();
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({environment,rows,errors},null,2));
  console.log('Report:',path.join(out,'report.json'));
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
