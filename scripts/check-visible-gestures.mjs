// Screen-space staging is different from a symmetric palm-centre trajectory.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../outputs/three.module.js';
import {createStrokeSampler,STROKE_DURATION,PASS_DURATION,RETURN_DURATION} from '../public/github-site/stroke-motion.js';
async function local(file){
  const code=fs.readFileSync(`public/github-site/${file}`,'utf8')
    .replaceAll('./body-shape.js',new URL('../public/github-site/body-shape.js',import.meta.url).href)
    .replaceAll('https://esm.sh/three@0.180.0',new URL('../outputs/three.module.js',import.meta.url).href)
    .replaceAll('./hand-poses.js',new URL('../public/github-site/hand-poses.js',import.meta.url).href);
  return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
const {createHandMesh,articulateHand,HAND_SCALE}=await local('hand-rig.js');
const {placePalm,supportPalm,readPalmFrame}=await local('palm-contact.js');
const rig=new THREE.Group(),hand=new THREE.Group(),pre=new THREE.Group();rig.add(hand);hand.add(pre);
const data=JSON.parse(fs.readFileSync('public/github-site/assets/hand-rig.json'));
const model=createHandMesh(data,new THREE.MeshStandardMaterial());pre.add(model);hand.userData.model=model;hand.scale.setScalar(HAND_SCALE);
pre.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI*.46).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2));
const mesh=model.userData.mesh,radii=new THREE.Vector3(.88,.82,.76),bodyCenter=new THREE.Vector3(0,-.05,0);
const target=new THREE.Vector3(),normal=new THREE.Vector3(),along=new THREE.Vector3(),center=new THREE.Vector3(),facing=new THREE.Vector3(),v=new THREE.Vector3();
const camera=new THREE.PerspectiveCamera(31,1050/900,.1,50);camera.position.set(-.068,1.109,7.922);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
const origin=bodyCenter.clone().project(camera),sample=createStrokeSampler(...radii.toArray());
const records=[],dt=1/120;let minimum=Infinity,maxSpeed=0,maxAcceleration=0,maxAngular=0,previous=null,velocity=null,airMinimum=Infinity;
const bones=new Map();
for(let step=0;step<=Math.round(STROKE_DURATION/dt);step++){
  const t=step*dt,s=sample(t);
  articulateHand(model,'pet',s.pressure,s.progress,s.liftPose,dt,step===0);
  target.fromArray(s.palm).add(bodyCenter);normal.fromArray(s.normal);along.fromArray(s.fingerDirection);
  placePalm(hand,target,normal,center,facing,along);
  supportPalm(hand,bodyCenter,radii,normal,center,facing,dt);
  if(previous){
    const vel=hand.position.clone().sub(previous.position).divideScalar(dt);
    maxSpeed=Math.max(maxSpeed,vel.length());
    if(velocity)maxAcceleration=Math.max(maxAcceleration,vel.distanceTo(velocity)/dt);
    maxAngular=Math.max(maxAngular,hand.quaternion.angleTo(previous.quaternion)/dt);velocity=vel;
    if(!s.returning&&!previous.returning&&s.pass===previous.pass)assert.ok(center.x>=previous.x-1e-6,'Contact pass reverses');
  }
  previous={position:hand.position.clone(),quaternion:hand.quaternion.clone(),x:center.x,pass:s.pass,returning:s.returning};
  for(const b of model.userData.bones){
    const angle=b.userData.contactFlex??b.userData.angles.x;
    const range=bones.get(b.name)??[Infinity,-Infinity];range[0]=Math.min(range[0],angle);range[1]=Math.max(range[1],angle);bones.set(b.name,range);
    if(b.name.endsWith('_pip'))assert.ok(angle<THREE.MathUtils.degToRad(12.01),'Finger hooks instead of conforming');
    if(b.name.endsWith('_dip'))assert.ok(angle<THREE.MathUtils.degToRad(8.01),'Fingertip hooks instead of conforming');
  }
  if(step%6!==0)continue;
  let minX=Infinity,maxX=-Infinity,topPx=Infinity;const tip=new THREE.Vector3(),cuff=new THREE.Vector3();let tipN=0,cuffN=0;
  for(let i=0;i<data.positions.length/3;i++){
    mesh.getVertexPosition(i,v);mesh.localToWorld(v);
    minimum=Math.min(minimum,v.clone().sub(bodyCenter).divide(radii).length());
    if(s.returning&&s.progress>.03&&s.progress<.97){
      const relative=v.clone().sub(bodyCenter),len=relative.clone().divide(radii).length();
      airMinimum=Math.min(airMinimum,relative.length()*(1-1/len));
    }
    const screen=v.clone().project(camera).sub(origin);minX=Math.min(minX,screen.x);maxX=Math.max(maxX,screen.x);
    topPx=Math.min(topPx,(1-screen.y-origin.y)*450);
    if(data.positions[i*3+1]>-1.29){tip.add(screen);tipN++;}
    if(data.positions[i*3+1]<-2.16){cuff.add(screen);cuffN++;}
  }
  tip.divideScalar(tipN);cuff.divideScalar(cuffN);
  const angle=p=>THREE.MathUtils.radToDeg(Math.atan2(p.y*900,p.x*1050));
  if(s.returning)assert.ok(topPx>80,`Returning hand overlaps the top controls at ${t}s: ${topPx}px`);
  records.push({t,pass:s.pass,returning:s.returning,pressure:s.pressure,palm:center.toArray(),minX,maxX,topPx,tipAngle:angle(tip),cuffAngle:angle(cuff),tip:tip.toArray(),cuff:cuff.toArray()});
}
const selected=records.filter(r=>[0,.15,.25,.3,.55,2.35,2.6,2.65,2.75,2.9,4.25,4.8,6.6,7.15].some(t=>Math.abs(r.t-t)<.001));
console.log(JSON.stringify({minimum,airMinimum,maxSpeed,maxAcceleration,maxAngular,fingerRangesDegrees:Object.fromEntries([...bones].filter(([n])=>/_(mcp|pip|dip)$/.test(n)).map(([n,r])=>[n,(r[1]-r[0])*180/Math.PI])),selected},null,2));
fs.mkdirSync('outputs/gesture-staging',{recursive:true});fs.writeFileSync('outputs/gesture-staging/visible-motion.json',JSON.stringify({records,minimum,airMinimum,maxSpeed,maxAcceleration,maxAngular},null,2));
assert.ok(minimum>.995,'Hand intersects the core');
assert.ok(airMinimum>.48,'Curled fingertips brush the fur on the return');
assert.ok(maxSpeed<2.6&&maxAcceleration<15&&maxAngular<2.3,'Abrupt rig motion');
for(const start of [0,PASS_DURATION+RETURN_DURATION]){
  for(const [a,b] of [[.15,2.75],[.3,2.6],[.55,2.35]]){
    const first=records.find(r=>Math.abs(r.t-start-a)<.001),last=records.find(r=>Math.abs(r.t-start-b)<.001);
    assert.ok(Math.abs(first.tipAngle+last.cuffAngle-180)<3,'Visible fingertip/cuff angular extents are asymmetric');
  }
}
for(const name of ['index_dip','middle_dip','ring_dip','little_dip']){
  // Measure the final contact-fitted joints, not only their free-pose targets.
  // Conformity limits the middle/ring DIP excursion to about 2.8 degrees.
  const range=bones.get(name);assert.ok((range[1]-range[0])*180/Math.PI>2.5,'A distal finger joint is frozen');
}
console.log('PASS: projected fingertip/cuff symmetry in both passes; changing distal joints; whole-mesh body clearance; airborne return.');
