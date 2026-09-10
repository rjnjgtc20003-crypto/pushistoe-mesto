import assert from 'node:assert/strict';
import {FurResponseField,bentStrand} from '../public/github-site/fur-response.js';
for(const angle of [0,.1,.7,1.3,1.65]){
  let length=0,previous=bentStrand(0,angle);
  for(let i=1;i<=2000;i++){
    const next=bentStrand(i/2000,angle);length+=Math.hypot(next[0]-previous[0],next[1]-previous[1]);previous=next;
  }
  assert.ok(Math.abs(length-1)<1e-5,`Comb shortened centreline at ${angle}: ${length}`);
}
const radii=[.88,.82,.76],points=[];
for(const x of [-.2,-.1,0,.1,.2])for(const z of [-.15,0,.15])points.push(x,.91,z);
const fields=[30,60,120].map(fps=>{
  const field=new FurResponseField(radii);
  for(let i=0;i<fps;i++)field.update(1/fps,points,[1,0,0]);
  return field;
});
assert.ok(fields[0].activity>1,'Real nearby skin did not bend the coat');
for(const field of fields.slice(1))for(let i=0;i<field.bend.length;i++)
  assert.ok(Math.abs(field.bend[i]-fields[0].bend[i])<1e-5,'Frame-rate dependent contact response');
const field=fields[0],peak=field.activity;
field.update(1/60,null);
assert.ok(field.activity>peak*.9&&field.activity<peak,'Release snapped or grew instead of decaying');
for(let i=0;i<180;i++)field.update(1/60,null);
assert.ok(field.activity<.0001,'Coat failed to recover');
field.reset();field.update(1/60,[0,2,0],[1,0,0]);
assert.equal(field.activity,0,'Coat bends under a hovering hand');
assert.ok(field.bend.every(Number.isFinite)&&field.contact.every(Number.isFinite));
assert.equal(field.update(0,points),false,'Frozen inspection changes the field');
console.log('PASS: centreline arc length; localized skin contact; 30/60/120 Hz equivalence; gradual release; no hovering-hand dent.');
const pads=[1,-1].map(side=>{
  const points=[];
  for(const y of [-.15,0,.15])for(const z of [-.15,0,.15])points.push(side*.95,y,z);
  return {points,normal:[side,0,0],center:[side*.95,0,0],direction:[0,-1,0],spread:true};
});
const combined=new FurResponseField(radii),reversed=new FurResponseField(radii);
for(let i=0;i<60;i++){
  combined.updateContacts(1/60,pads);reversed.updateContacts(1/60,[...pads].reverse());
}
let leftEnergy=0,rightEnergy=0;
for(let i=0;i<combined.count;i++){
  const energy=combined.bend[i*4]**2+combined.bend[i*4+1]**2+combined.bend[i*4+2]**2;
  if(combined.roots[i*3]<0)leftEnergy+=energy;else rightEnergy+=energy;
}
assert.ok(leftEnergy>1&&rightEnergy>1,'One palm lost its fur response');
assert.ok(Math.abs(leftEnergy-rightEnergy)/leftEnergy<.005,'Mirrored palms create unequal dents');
for(let i=0;i<combined.bend.length;i++)assert.equal(combined.bend[i],reversed.bend[i],'Contact order changes the fur');
const beforeSwitch=combined.bend.slice();combined.updateContacts(1/60,[pads[1]]);
let retained=0;
for(let i=0;i<combined.count;i++)if(combined.roots[i*3]>0){
  retained+=Math.abs(combined.bend[i*4])+Math.abs(combined.bend[i*4+1])+Math.abs(combined.bend[i*4+2]);
  assert.ok(Math.abs(combined.bend[i*4+1])<=Math.abs(beforeSwitch[i*4+1])+1e-6,'Released side grows');
}
assert.ok(retained>1,'Switching hands erased the fur memory');
console.log('PASS: independent two-palm contacts; mirrored response; order independence; retained release when switching hands.');
