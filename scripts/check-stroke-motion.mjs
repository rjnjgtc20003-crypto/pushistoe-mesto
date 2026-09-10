import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../outputs/three.module.js';
import {createStrokeSampler,STROKE_DURATION,CONTACT_IN,CONTACT_OUT} from '../public/github-site/stroke-motion.js';
async function localModule(file) {
  const text=fs.readFileSync(new URL(`../public/github-site/${file}`,import.meta.url),'utf8')
    .replace('https://esm.sh/three@0.180.0',new URL('../outputs/three.module.js',import.meta.url).href)
    .replace('./hand-poses.js',new URL('../public/github-site/hand-poses.js',import.meta.url).href);
  return import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
}
const {createHandMesh,articulateHand,HAND_SCALE}=await localModule('hand-rig.js');
const {placePalm,supportPalm,readPalmFrame}=await localModule('palm-contact.js');
const data=JSON.parse(fs.readFileSync('public/github-site/assets/hand-rig.json'));
const sample=createStrokeSampler(.88,.82,.76);
const rig=new THREE.Group(),hand=new THREE.Group(),pre=new THREE.Group();rig.add(hand);hand.add(pre);
const model=createHandMesh(data,new THREE.MeshStandardMaterial());pre.add(model);hand.userData.model=model;
hand.scale.setScalar(HAND_SCALE);
pre.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI*.46)
  .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2));
const target=new THREE.Vector3(),outward=new THREE.Vector3(),center=new THREE.Vector3(),facing=new THREE.Vector3();
const bodyCenter=new THREE.Vector3(0,-.05,0),radii=new THREE.Vector3(.88,.82,.76),supportNormal=new THREE.Vector3();
const dt=1/120,samples=[];let previous=null,previousSpeed=0,maxSpeed=0,maxAngular=0,maxAcceleration=0;
let minBodyDistance=Infinity,maxSupport=0;
let maxVectorAcceleration=0;
const previousVelocity=new THREE.Vector3();
const diagnostics=[];
for(let frame=0;frame<=Math.round(STROKE_DURATION/dt);frame++) {
  const t=frame*dt,s=sample(t);
  articulateHand(model,'pet',s.pressure,s.progress,0,dt,frame===0);
  target.fromArray(s.palm);target.y-=.05;outward.fromArray(s.orientation);
  supportNormal.fromArray(s.normal);
  placePalm(hand,target,outward,center,facing);
  assert.ok(center.distanceTo(target)<1e-5);
  assert.ok(facing.dot(outward)<-.999);
  maxSupport=Math.max(maxSupport,supportPalm(hand,bodyCenter,radii,supportNormal,center,facing,dt));
  if(previous) {
    assert.ok(s.root[0]>=previous.rootX-1e-10,'Stroke reversed direction');
    const speed=hand.position.distanceTo(previous.position)/dt;
    const angular=hand.quaternion.angleTo(previous.quaternion)/dt;
    const velocity=hand.position.clone().sub(previous.position).divideScalar(dt);
    if(frame>1)maxVectorAcceleration=Math.max(maxVectorAcceleration,velocity.distanceTo(previousVelocity)/dt);
    previousVelocity.copy(velocity);
    if(t>.65&&t<3.95)assert.ok(speed>.12,`Near-stop in posed hand at ${t}: ${speed}`);
    assert.ok(center.x>=previous.centerX-1e-7,'Supported palm reversed direction');
    maxSpeed=Math.max(maxSpeed,speed);maxAngular=Math.max(maxAngular,angular);
    if(frame>1)maxAcceleration=Math.max(maxAcceleration,Math.abs(speed-previousSpeed)/dt);
    previousSpeed=speed;
    diagnostics.push({t,speed,angular,support:hand.userData.supportOffset});
  }
  previous={position:hand.position.clone(),quaternion:hand.quaternion.clone(),rootX:s.root[0],centerX:center.x};
  if(frame%60===0) {
    const expected=center.clone(),expectedFacing=facing.clone();
    rig.rotation.set(.35,.9,0);
    readPalmFrame(hand,center,facing);
    assert.ok(center.distanceTo(expected)<1e-5,'View rotation moved palm contact');
    assert.ok(facing.dot(expectedFacing)>.99999,'View rotation changed palm orientation');
    rig.rotation.set(0,0,0);rig.updateMatrixWorld(true);
  }
  if(frame%6===0) {
    const mesh=model.userData.mesh,vertices=[];
    for(let i=0;i<mesh.geometry.attributes.position.count;i++) {
      const p=mesh.getVertexPosition(i,new THREE.Vector3());
      mesh.localToWorld(p);vertices.push(p.toArray());
      minBodyDistance=Math.min(minBodyDistance,p.clone().sub(bodyCenter).divide(radii).length());
    }
    samples.push({time:t,vertices,opacity:s.opacity});
  }
}
// Check every phase join on both sides, including stationary pre/post states.
for(const t of [0,CONTACT_IN,CONTACT_OUT,STROKE_DURATION*.2,STROKE_DURATION*.8,STROKE_DURATION]) {
  const h=.0001,a=sample(t-h).palm,b=sample(t).palm,c=sample(t+h).palm;
  const left=b.map((v,i)=>(v-a[i])/h),right=c.map((v,i)=>(v-b[i])/h);
  assert.ok(Math.hypot(...right.map((v,i)=>v-left[i]))<.003,'Velocity discontinuity');
  if(t===0||t===STROKE_DURATION)assert.ok(Math.hypot(...left)<.001);
  else assert.ok(Math.hypot(...left)>.15,'Unintended stop inside stroke');
}
fs.writeFileSync('outputs/stroke-contact-diagnostics.json',JSON.stringify({minBodyDistance,maxSupport,maxVectorAcceleration,diagnostics},null,2));
assert.ok(maxSpeed<1.7,`Unexpected translational jump ${maxSpeed}`);
assert.ok(maxAngular<1.7,`Unexpected rotational jump ${maxAngular}`);
assert.ok(maxAcceleration<4,`Unexpected acceleration ${maxAcceleration}`);
assert.ok(maxVectorAcceleration<5,`Unexpected vector acceleration ${maxVectorAcceleration}`);
assert.ok(minBodyDistance>.99,`Hand penetrates body: ${minBodyDistance}`);
assert.equal(sample(0).opacity,0);assert.equal(sample(STROKE_DURATION).opacity,0);
fs.writeFileSync('outputs/stroke-motion-geometry.json',JSON.stringify({indices:data.indices,samples}));
console.log(`PASS: ${Math.round(STROKE_DURATION/dt)+1} continuous hand poses; no stops at contact/release; max speed ${maxSpeed.toFixed(3)}, angular ${maxAngular.toFixed(3)}, acceleration ${maxAcceleration.toFixed(3)}; minimum body-relative distance ${minBodyDistance.toFixed(3)}; max support ${maxSupport.toFixed(3)}; ${model.userData.contactSamples.length} contact samples`);
