import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../outputs/three.module.js';
import {createStrokeSampler,STROKE_DURATION} from '../public/github-site/stroke-motion.js';
async function localModule(file) {
  const text=fs.readFileSync(new URL(`../public/github-site/${file}`,import.meta.url),'utf8')
    .replace('https://esm.sh/three@0.180.0',new URL('../outputs/three.module.js',import.meta.url).href)
    .replace('./hand-poses.js',new URL('../public/github-site/hand-poses.js',import.meta.url).href);
  return import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
}
const {createHandMesh,articulateHand}=await localModule('hand-rig.js');
const {placePalm}=await localModule('palm-contact.js');
const data=JSON.parse(fs.readFileSync('public/github-site/assets/hand-rig.json'));
const sample=createStrokeSampler(.88,.82,.76);
const rig=new THREE.Group(),hand=new THREE.Group(),pre=new THREE.Group();rig.add(hand);hand.add(pre);
const model=createHandMesh(data,new THREE.MeshStandardMaterial());pre.add(model);hand.userData.model=model;
hand.scale.setScalar(1.24);
pre.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI*.46)
  .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2));
const target=new THREE.Vector3(),outward=new THREE.Vector3(),center=new THREE.Vector3(),facing=new THREE.Vector3();
const dt=1/120,samples=[];let previous=null,previousSpeed=0,maxSpeed=0,maxAngular=0,maxAcceleration=0;
for(let frame=0;frame<=Math.round(STROKE_DURATION/dt);frame++) {
  const t=frame*dt,s=sample(t);
  articulateHand(model,'pet',s.pressure,0,0,dt,frame===0);
  target.fromArray(s.palm);target.y-=.05;outward.fromArray(s.normal);
  placePalm(hand,target,outward,center,facing);
  assert.ok(center.distanceTo(target)<1e-5);
  assert.ok(facing.dot(outward)<-.999);
  if(previous) {
    assert.ok(s.root[0]>=previous.rootX-1e-10,'Stroke reversed direction');
    const speed=hand.position.distanceTo(previous.position)/dt;
    const angular=hand.quaternion.angleTo(previous.quaternion)/dt;
    maxSpeed=Math.max(maxSpeed,speed);maxAngular=Math.max(maxAngular,angular);
    if(frame>1)maxAcceleration=Math.max(maxAcceleration,Math.abs(speed-previousSpeed)/dt);
    previousSpeed=speed;
  }
  previous={position:hand.position.clone(),quaternion:hand.quaternion.clone(),rootX:s.root[0]};
  if(frame%6===0) {
    const mesh=model.userData.mesh,vertices=[];
    for(let i=0;i<mesh.geometry.attributes.position.count;i++) {
      const p=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i);
      mesh.applyBoneTransform(i,p);mesh.localToWorld(p);vertices.push(p.toArray());
    }
    samples.push({time:t,vertices,opacity:s.opacity});
  }
}
// Check every phase join on both sides, including stationary pre/post states.
for(const t of [0,.8,3.4,STROKE_DURATION]) {
  const h=.0001,a=sample(t-h).palm,b=sample(t).palm,c=sample(t+h).palm;
  assert.ok(Math.hypot(...c.map((v,i)=>(v-a[i])/(2*h)))<.001,'Velocity discontinuity at phase join');
  assert.ok(Math.hypot(...c.map((v,i)=>(v-2*b[i]+a[i])/(h*h)))<.03,'Acceleration discontinuity at phase join');
}
assert.ok(maxSpeed<1.7,`Unexpected translational jump ${maxSpeed}`);
assert.ok(maxAngular<1.7,`Unexpected rotational jump ${maxAngular}`);
assert.ok(maxAcceleration<7,`Unexpected acceleration ${maxAcceleration}`);
assert.equal(sample(0).opacity,0);assert.equal(sample(STROKE_DURATION).opacity,0);
fs.writeFileSync('outputs/stroke-motion-geometry.json',JSON.stringify({indices:data.indices,samples}));
console.log(`PASS: 505 continuous hand poses; no reversals; phase joins C2; maximum speed ${maxSpeed.toFixed(3)}, angular speed ${maxAngular.toFixed(3)}, acceleration ${maxAcceleration.toFixed(3)}`);
