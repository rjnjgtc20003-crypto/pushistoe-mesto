// Contact is measured on the final skin, independently of the fur renderer.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../outputs/three.module.js';
import {createStrokeSampler} from '../public/github-site/stroke-motion.js';
async function local(file){
  const code=fs.readFileSync(`public/github-site/${file}`,'utf8')
    .replaceAll('./body-shape.js',new URL('../public/github-site/body-shape.js',import.meta.url).href)
    .replaceAll('./hand-poses.js',new URL('../public/github-site/hand-poses.js',import.meta.url).href)
    .replaceAll('https://esm.sh/three@0.180.0',new URL('../outputs/three.module.js',import.meta.url).href);
  return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
const {createHandMesh,articulateHand,HAND_SCALE}=await local('hand-rig.js');
const {placePalm,supportPalm}=await local('palm-contact.js');
const data=JSON.parse(fs.readFileSync('public/github-site/assets/hand-rig.json'));
function fixture(){
  const root=new THREE.Group(),hand=new THREE.Group(),pre=new THREE.Group();root.add(hand);hand.add(pre);
  const model=createHandMesh(data,new THREE.MeshStandardMaterial());pre.add(model);hand.userData.model=model;
  hand.scale.setScalar(HAND_SCALE);
  pre.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI*.46)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2));
  return {hand,model};
}
const bodyCenter=new THREE.Vector3(0,-.05,0),target=new THREE.Vector3(),outward=new THREE.Vector3();
const center=new THREE.Vector3(),facing=new THREE.Vector3(),along=new THREE.Vector3(),v=new THREE.Vector3();
function fitted(radiusScale,fps){
  const {hand,model}=fixture(),radii=new THREE.Vector3(.88,.82,.76).multiplyScalar(radiusScale);
  const s=createStrokeSampler(...radii.toArray())(1.5);
  for(let i=0;i<=fps;i++){
    articulateHand(model,'pet',1,s.progress,0,1/fps,i===0);
    target.fromArray(s.palm).add(bodyCenter);outward.fromArray(s.normal);along.fromArray(s.fingerDirection);
    placePalm(hand,target,outward,center,facing,along);
    supportPalm(hand,bodyCenter,radii,outward,center,facing,1/fps);
  }
  const gaps={};
  for(const [name,indices] of Object.entries(model.userData.digitSamples)){
    gaps[name]=Math.min(...indices.map(i=>{
      model.userData.mesh.getVertexPosition(i,v);model.userData.mesh.localToWorld(v);v.sub(bodyCenter);
      const len=v.clone().divide(radii).length();return v.length()*(1-1/len);
    }));
    assert.ok(gaps[name]>=0&&gaps[name]<.04,`${name} fails contact on body scale ${radiusScale}: ${gaps[name]}`);
  }
  const angles=model.userData.contactChains.map(({bones})=>bones.map(b=>b.userData.contactFlex));
  // Returning to a free pose clears every contact correction; hands must not
  // retain a fitted/gripping pose after the contact source has gone away.
  articulateHand(model,'pet',0,0,0,1/60,true);
  for(const bone of model.userData.bones)assert.equal(bone.userData.contactFlex,bone.userData.angles.x);
  return {radiusScale,fps,palm:center.toArray(),angles,gaps};
}
const rates=[30,60,120].map(fps=>fitted(1,fps));
for(const sample of rates.slice(1)){
  assert.ok(Math.hypot(...sample.palm.map((v,i)=>v-rates[0].palm[i]))<.0002,'Frame-rate-dependent contact position');
  for(let i=0;i<sample.angles.length;i++)for(let j=0;j<3;j++)
    assert.ok(Math.abs(sample.angles[i][j]-rates[0].angles[i][j])<.001,'Frame-rate-dependent finger conformity');
}
const small=fitted(.9,60),large=fitted(1.1,60);
assert.ok(Math.abs(small.angles[0][0]-large.angles[0][0])>THREE.MathUtils.degToRad(1),'Pose is hardcoded instead of following surface curvature');
const {model}=fixture();articulateHand(model,'squeeze',1,.5,0,1/60,true);
const bones=Object.fromEntries(model.userData.bones.map(b=>[b.name,b]));
assert.ok(bones.little_palm.userData.angles.length()>bones.ring_palm.userData.angles.length());
assert.ok(bones.ring_palm.userData.angles.length()>bones.middle_palm.userData.angles.length());
assert.ok(bones.little_palm.userData.angles.length()>THREE.MathUtils.degToRad(7),'Palm arch is frozen');
assert.ok(bones.wrist.userData.angles.x>THREE.MathUtils.degToRad(25),'Wrist fails to bend during squeeze');
assert.ok(bones.little_palm.position.y<.08&&bones.ring_palm.position.y<.10,'Palm bends at the distal metacarpal instead of near the carpus');
fs.mkdirSync('outputs/body-contact',{recursive:true});
fs.writeFileSync('outputs/body-contact/finger-conformity.json',JSON.stringify({rates,small,large},null,2));
console.log('PASS: body-only skin contact; fingers adapt to curvature; equivalent 30/60/120 Hz support; free-pose reset; cupped palm and wrist.');
