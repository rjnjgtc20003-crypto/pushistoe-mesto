// Isolated headless preview. No desktop input, browser profile or production UI.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const root=path.resolve('public/github-site'),out=path.resolve(process.env.CONTACT_PREVIEW??'outputs/palm-support/preview');
await fs.mkdir(out,{recursive:true});
const code=await fs.readFile(path.join(root,'scene.js'),'utf8');
const instrumented=code+`
const diagnosticNaturalTime=clock.getElapsedTime.bind(clock);
clock.getElapsedTime=()=>window.__testTime??diagnosticNaturalTime();
window.__contactPreview={
 ready:()=>!actionButtons[0].disabled,
 at:(seconds,rotation=[0,0],fur=true)=>{
  window.__testTime=0;previousHandTime=0;actionState=null;blinkStarted=-1;nextBlink=999;
  if(typeof furResponse!=='undefined')furResponse.reset();
  targetRigRotationX=rotation[0];targetRigRotationY=rotation[1];
  interactionRig.rotation.set(rotation[0],rotation[1],0);rigVelocityX=rigVelocityY=0;
  furCloud.visible=fur;playAction('pet');
  for(let t=0;t<seconds;t+=1/120)updateAction(t);
  window.__testTime=seconds;
 },
};`;
const mime={'.js':'text/javascript','.html':'text/html','.json':'application/json','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(url.pathname==='/favicon.ico'){res.writeHead(204).end();return;}
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const content=file===path.join(root,'scene.js')?instrumented:await fs.readFile(file);
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Cache-Control':'no-store'});
  res.end(content);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
const errors=[];
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1050,height:900},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Blocked call to navigator.vibrate'))errors.push(m.text());});
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__contactPreview?.ready());
 await page.locator('[data-action="pet"]').click();
 for(const fur of [false,true])for(const [label,angle] of [['front',[0,0]],['side',[.2,1]],['back',[.2,2.8]],['top',[.72,0]]]){
  await page.evaluate(({angle,fur})=>window.__contactPreview.at(2.3,angle,fur),{angle,fur});
  await page.waitForTimeout(60);
  await page.screenshot({path:path.join(out,`${fur?'fur':'bare'}-${label}.png`)});
 }
 for(const t of [.7,1.15,1.7,2.3,2.9,3.45,3.9,4.6,5.1]){
  await page.evaluate(t=>window.__contactPreview.at(t),t);await page.waitForTimeout(50);
  await page.screenshot({path:path.join(out,`pet-${t}.png`)});
 }
 console.log(JSON.stringify({out,errors}));
 if(errors.length)process.exitCode=1;
}finally{await browser?.close();await new Promise(r=>server.close(r));}
