import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../outputs/three.module.js';
async function localModule(file) {
  const text=fs.readFileSync(new URL(`../public/github-site/${file}`,import.meta.url),'utf8')
    .replaceAll('./body-shape.js',new URL('../public/github-site/body-shape.js',import.meta.url).href)
    .replace('https://esm.sh/three@0.180.0',new URL('../outputs/three.module.js',import.meta.url).href)
    .replace('./hand-poses.js',new URL('../public/github-site/hand-poses.js',import.meta.url).href);
  return import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
}
const {createHandMesh,articulateHand}=await localModule('hand-rig.js');
const {fitPalmToHead,readPalmFrame}=await localModule('palm-contact.js');
const data=JSON.parse(fs.readFileSync('public/github-site/assets/hand-rig.json'));
const track=JSON.parse(fs.readFileSync('public/github-site/assets/pet.json'));
const bodyCenter=new THREE.Vector3(0,-.05,0),radii=new THREE.Vector3(.88,.82,.76);
const samples=[];
for(const frame of [3,8,13,18,24]) {
  const key=track.keyframes.find(k=>k.frame===frame);
  const rig=new THREE.Group(),hand=new THREE.Group(),pre=new THREE.Group();
  rig.add(hand);hand.add(pre);
  const model=createHandMesh(data,new THREE.MeshStandardMaterial());pre.add(model);
  hand.userData.model=model;
  hand.scale.setScalar(1.24);hand.position.fromArray(key.position);hand.quaternion.fromArray(key.quaternion).normalize();
  pre.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI*.46)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2));
  articulateHand(model,'pet',1,frame/30,0,1/60,true);
  const selected=hand.position.clone().sub(bodyCenter);
  selected.multiplyScalar(1/Math.sqrt((selected.x/radii.x)**2+(selected.y/radii.y)**2+(selected.z/radii.z)**2));
  const normal=new THREE.Vector3(selected.x/radii.x**2,selected.y/radii.y**2,selected.z/radii.z**2).normalize();
  const target=selected.add(bodyCenter).addScaledVector(normal,.065);
  const center=new THREE.Vector3(),facing=new THREE.Vector3();
  readPalmFrame(hand,center,facing);
  const before=center.distanceTo(target);
  fitPalmToHead(hand,bodyCenter,radii,1,center,facing);
  readPalmFrame(hand,center,facing);
  assert.ok(center.distanceTo(target)<1e-5,'Palm missed support point');
  assert.ok(facing.dot(normal)<-.999,'Palm is not tangent to head');
  rig.rotation.set(.4,.8,0);
  readPalmFrame(hand,center,facing);
  assert.ok(center.distanceTo(target)<1e-5,'Scene rotation changed contact');
  rig.rotation.set(0,0,0);rig.updateMatrixWorld(true);
  const mesh=model.userData.mesh,vertices=[];
  for(let i=0;i<mesh.geometry.attributes.position.count;i++) {
    const p=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);
    mesh.applyBoneTransform(i,p);mesh.localToWorld(p);vertices.push(p.toArray());
  }
  samples.push({frame,vertices});
  console.log(`frame ${frame}: palm placement corrected by ${before.toFixed(3)}; tangency and rotation checks passed`);
}
fs.writeFileSync('outputs/palm-contact-geometry.json',JSON.stringify({indices:data.indices,samples}));
