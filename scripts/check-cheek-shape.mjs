import assert from 'node:assert/strict';
import {cheekScale,cheekSurface} from '../public/github-site/body-shape.js';
import {FurResponseField} from '../public/github-site/fur-response.js';
const radii=[.88,.82,.76],unit=[.82,-.22,Math.sqrt(.2792)];
assert.ok(cheekScale(...unit,1)<.89,'Cheeks do not compress');
assert.ok(cheekScale(0,1,0,1)>.999,'Cheek press squashes the crown');
assert.ok(cheekScale(0,0,-1,1)>.999,'Cheek press squashes the back');
assert.equal(cheekScale(...unit,1),cheekScale(-unit[0],unit[1],unit[2],1));
const field=new FurResponseField(radii);
for(const amount of [0,.1,.5,1,.7,0]){
  field.setShape(amount);
  for(let i=0;i<field.count;i++){
    const point=Array.from(field.baseRoots.subarray(i*3,i*3+3));
    const exact=cheekSurface(point,radii,amount);
    for(let k=0;k<3;k++){
      assert.ok(Math.abs(exact.position[k]-field.roots[i*3+k])<1e-6,'Fur roots detach from shaped body');
      assert.ok(Math.abs(exact.normal[k]-field.normals[i*3+k])<1e-6,'Wrong shaped fur normal');
    }
    assert.ok(Math.abs(exact.scale-field.shape[i*4+3])<1e-6);
  }
}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normalize=a=>a.map(v=>v/Math.hypot(...a));
// Geometric normal from independently sampled surface tangents.
for(const u of [unit,[.66,-.32,.68],[-.79,-.3,.52]]){
  const q=normalize(u),n=normalize(q.map((v,i)=>v/radii[i]));
  const t=normalize(cross(q,[0,1,0])),b=normalize(cross(q,t));
  const at=(d,sign)=>{
    const p=normalize(q.map((v,i)=>v+sign*1e-5*d[i])).map((v,i)=>v*radii[i]);
    return cheekSurface(p,radii,1).position;
  };
  const derivative=d=>{const a=at(d,1),b=at(d,-1);return a.map((v,i)=>v-b[i]);};
  const numerical=normalize(cross(derivative(t),derivative(b)));
  const exact=cheekSurface(q.map((v,i)=>v*radii[i]),radii,1).normal;
  assert.ok(dot(numerical,exact)>.99999&&dot(exact,n)>0,'Incorrect analytic cheek normal');
}
console.log('PASS: localized symmetric cheeks; unchanged crown/back; analytic normals; exact field/root agreement; full recovery.');
