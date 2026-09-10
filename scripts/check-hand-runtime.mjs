// Uses the exact Three.js version served by the site, cached in ignored outputs/.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../outputs/three.module.js';
const source = fs.readFileSync(new URL('../public/github-site/hand-rig.js', import.meta.url),'utf8')
  .replace('https://esm.sh/three@0.180.0',new URL('../outputs/three.module.js',import.meta.url).href)
  .replace('./hand-poses.js',new URL('../public/github-site/hand-poses.js',import.meta.url).href);
const {createHandMesh,articulateHand}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const data=JSON.parse(fs.readFileSync(new URL('../public/github-site/assets/hand-rig.json',import.meta.url)));
const material=new THREE.MeshStandardMaterial();
const a=createHandMesh(data,material);const b=createHandMesh(data,material);
a.updateMatrixWorld(true);b.updateMatrixWorld(true);
const mesh=a.userData.mesh;const position=mesh.geometry.attributes.position;
let restError=0;
for(let i=0;i<position.count;i++) {
  const p=new THREE.Vector3().fromBufferAttribute(position,i);
  const q=mesh.getVertexPosition(i,new THREE.Vector3());
  restError=Math.max(restError,p.distanceTo(q));
}
assert.ok(restError<1e-5,`Broken rest bind: ${restError}`);
for(let i=0;i<60;i++) articulateHand(a,'squeeze',1,.4,0,1/60);
a.updateMatrixWorld(true);
let displacement=0;
for(let i=0;i<position.count;i++) {
  const p=new THREE.Vector3().fromBufferAttribute(position,i);
  const q=mesh.getVertexPosition(i,new THREE.Vector3());
  assert.ok(q.toArray().every(Number.isFinite));
  displacement=Math.max(displacement,p.distanceTo(q));
}
// Includes the deliberate wrist extension that aims the cuff toward the viewer.
assert.ok(displacement>.03 && displacement<.5,`Unexpected posed-hand motion: ${displacement}`);
for(const bone of a.userData.bones){
  if(bone.name.endsWith('_pip'))assert.ok(Math.abs(bone.userData.angles.x)<THREE.MathUtils.degToRad(5),'Squeeze curls into a grasp');
  if(bone.name.endsWith('_dip'))assert.ok(Math.abs(bone.userData.angles.x)<THREE.MathUtils.degToRad(3),'Hooked fingertips');
}
assert.ok(mesh.morphTargetInfluences[0]>.99,'Palmar pads do not soften under pressure');
assert.equal(b.userData.mesh.morphTargetInfluences[0],0,'Hands share pad deformation');
assert.ok(mesh.geometry.morphAttributes.position[0].array.some(v=>Math.abs(v)>.003),'Missing soft pad corrective');
assert.ok(b.userData.bones.every(bone=>bone.userData.angles.length()===0),'Skeletons share pose state');
const snapshots=[30,60,120].map(fps=>{
  const hand=createHandMesh(data,material);
  for(let i=0;i<fps;i++)articulateHand(hand,'squeeze',1,.4,0,1/fps);
  return hand.userData.bones.map(bone=>bone.userData.angles.toArray());
});
for(let s=1;s<snapshots.length;s++)for(let i=0;i<data.bones.length;i++)for(let j=0;j<3;j++)
  assert.ok(Math.abs(snapshots[0][i][j]-snapshots[s][i][j])<1e-8,'Frame-rate-dependent response');
console.log(`PASS: rest bind error ${restError.toExponential(2)}; max finger displacement ${displacement.toFixed(3)}; independent hands; equivalent 30/60/120 Hz motion`);
