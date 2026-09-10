import {cheekScale} from './body-shape.js';
// Retargeted palm paths. The authored files remain the immutable gesture source;
// these meaningful approach/contact/release beats remove frame-to-frame jitter.
const clamp=x=>Math.max(0,Math.min(1,x));
export const gentleEase=x=>{const t=clamp(x);return t*t*t*(10+t*(-15+6*t));};
function beats(keys,t){
  if(t<=keys[0][0])return keys[0][1];
  for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){
    const [a,x]=keys[i-1],[b,y]=keys[i];return x+(y-x)*gentleEase((t-a)/(b-a));
  }
  return keys.at(-1)[1];
}
export const CONTACT_DURATIONS={'head-pat':3.1,squeeze:4.1};
export function sampleContactGesture(id,t,radii=[.88,.82,.76]){
  const duration=CONTACT_DURATIONS[id];
  const opacity=gentleEase(t/.25)*(1-gentleEase((t-duration+.3)/.3));
  if(id==='head-pat'){
    // Three gentle contacts, without the tiny accidental bounces of the editor.
    const clearance=beats([[0,.60],[.65,.021],[1,.20],[1.35,.021],[1.72,.20],[2.1,.021],[2.38,.021],[3.1,.60]],t);
    const pressure=gentleEase((.24-clearance)/.219);
    const u=[.115,Math.sqrt(1-.115**2-.13**2),.13];
    const normal=u.map((v,i)=>v/radii[i]),len=Math.hypot(...normal);
    normal.forEach((v,i)=>normal[i]=v/len);
    const root=u.map((v,i)=>v*radii[i]);
    return {duration,opacity,pressure,squeeze:0,pat:pressure*.018,
      palms:[{root,normal,clearance,direction:[1,0,0],fingerDirection:[-1,0,-.025]}]};
  }
  const approach=gentleEase(t/.95)*(1-gentleEase((t-3.25)/.85));
  const pressure=beats([[0,0],[.35,0],[1,.92],[1.6,.12],[2.15,.94],[2.7,.14],[3.15,1],[3.4,.9],[4.1,0]],t);
  // Release the cheeks without throwing the hands out to the sides. The
  // short approach/release follows the viewer-facing wrists, not a wide arc.
  const clearance=.025+(1-approach)*.20+(1-pressure)*approach*.045;
  // Do not squash the body during approach or after the palms leave its coat.
  const contactPressure=pressure*approach;
  const palms=[1,-1].map(side=>{
    const u=[side*.82,-.22,Math.sqrt(1-.82**2-.22**2)];
    const normal=u.map((v,i)=>v/radii[i]),len=Math.hypot(...normal);
    normal.forEach((v,i)=>normal[i]=v/len);
    const approachOffset=[0,0,(1-approach)*.12];
    const scale=cheekScale(...u,contactPressure);
    return {root:u.map((v,i)=>v*radii[i]*scale),normal,clearance,approachOffset,
      direction:[0,-1,0],fingerDirection:[-side*.3,.2,-1]};
  });
  return {duration,opacity,pressure:contactPressure,squeeze:contactPressure*.025,pat:0,palms};
}
