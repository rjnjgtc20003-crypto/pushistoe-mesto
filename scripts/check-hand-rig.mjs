import assert from 'node:assert/strict';
import fs from 'node:fs';
import { handPose } from '../public/github-site/hand-poses.js';

const rig = JSON.parse(fs.readFileSync(new URL('../public/github-site/assets/hand-rig.json', import.meta.url)));
const n = rig.positions.length / 3;
assert.equal(rig.skinWeight.length, n * 4);
assert.equal(rig.skinIndex.length, n * 4);
assert.equal(rig.normals.length, n * 3);
assert.equal(rig.bones.length, 21);
for (let i = 0; i < n; i++) {
  const weights = rig.skinWeight.slice(i * 4, i * 4 + 4);
  assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0) - 1) < 1e-5);
  for (let j=0;j<4;j++) assert.ok(rig.skinIndex[i*4+j] < rig.bones.length);
}
for (const index of rig.indices) assert.ok(index < n);
rig.bones.forEach((bone,i) => assert.ok(bone.parent < i));
const samples = [
  {label:'Relaxed', gesture:'pet', pressure:0},
  {label:'Stroke', gesture:'pet', pressure:0.85},
  {label:'Pat', gesture:'head-pat', pressure:1},
  {label:'Squeeze', gesture:'squeeze', pressure:1},
].map(sample => ({...sample, pose:handPose(sample.gesture,sample.pressure,0.4,0)}));
for (const sample of samples) {
  for (const [name,angles] of Object.entries(sample.pose)) {
    assert.ok(rig.bones.some(b=>b.name===name));
    assert.ok(angles.every(Number.isFinite));
    if(name.endsWith('_pip')) assert.ok(angles[0]>=0 && angles[0]<95);
    if(name.endsWith('_dip')) assert.ok(angles[0]>=0 && angles[0]<=65);
  }
}
fs.mkdirSync(new URL('../outputs/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../outputs/hand-pose-samples.json',import.meta.url),JSON.stringify(samples));
console.log(`PASS: ${n} weighted vertices; 21-joint hierarchy; four distinct bounded poses`);
