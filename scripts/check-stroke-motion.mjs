import assert from 'node:assert/strict';
import {createStrokeSampler,STROKE_DURATION,PASS_DURATION,RETURN_DURATION,CONTACT_IN,CONTACT_OUT} from '../public/github-site/stroke-motion.js';
const sample=createStrokeSampler(.88,.82,.76),offset=PASS_DURATION+RETURN_DURATION;
let contactEntries=0,wasContact=false;
for(let t=0;t<=STROKE_DURATION;t+=1/240){
  const s=sample(t),contact=s.pressure>.99;
  if(contact&&!wasContact)contactEntries++;
  wasContact=contact;
  for(const key of ['root','normal','palm','tangent','fingerDirection'])assert.ok(s[key].every(Number.isFinite));
  assert.ok(s.pressure>=0&&s.pressure<=1);
  if(s.returning)assert.equal(s.pressure,0,'Return is an unintended backstroke');
}
assert.equal(contactEntries,2,'Expected two complete petting passes');
for(let t=0;t<=PASS_DURATION;t+=.01){
  const a=sample(t),b=sample(t+offset);
  assert.ok(Math.hypot(...a.palm.map((v,i)=>v-b.palm[i]))<1e-8,'Passes do not repeat the same path');
}
const joins=[0,CONTACT_IN,CONTACT_OUT,PASS_DURATION,offset,offset+CONTACT_IN,offset+CONTACT_OUT,STROKE_DURATION];
for(const t of joins){
  const h=1e-4,a=sample(t-h).palm,b=sample(t).palm,c=sample(t+h).palm;
  const left=b.map((v,i)=>(v-a[i])/h),right=c.map((v,i)=>(v-b[i])/h);
  assert.ok(Math.hypot(...right.map((v,i)=>v-left[i]))<.005,'Velocity discontinuity at '+t);
}
for(const start of [0,offset]){
  let last=-Infinity;
  for(let t=CONTACT_IN;t<=CONTACT_OUT;t+=.005){
    const x=sample(start+t).palm[0];assert.ok(x>last,'Stopped or reversed inside a contacting pass');last=x;
  }
}
const middle=sample(PASS_DURATION+RETURN_DURATION*.5);
assert.ok(middle.palm[1]>1.5&&middle.palm[1]<1.65,'Airborne return clearance/framing');
assert.equal(sample(0).opacity,0);assert.equal(sample(STROKE_DURATION).opacity,0);
console.log('PASS: two forward passes; identical repeated path; C1 joins; moving palm during contact; elevated return; transparent endpoints. Full skinned geometry is checked by check-visible-gestures.mjs.');
