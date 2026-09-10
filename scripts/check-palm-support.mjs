// Read-only measurements of the posed palmar surface, not just its rig origin.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../outputs/three.module.js';
import {createStrokeSampler} from '../public/github-site/stroke-motion.js';
async function localModule(file) {
  const code=fs.readFileSync(new URL(`../public/github-site/${file}`,import.meta.url),'utf8')
    .replaceAll('https://esm.sh/three@0.180.0',new URL('../outputs/three.module.js',import.meta.url).href)
    .replaceAll('./hand-poses.js',new URL('../public/github-site/hand-poses.js',import.meta.url).href);
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
const {createHandMesh,articulateHand,HAND_SCALE}=await localModule('hand-rig.js');
const {placePalm,supportPalm,readPalmFrame}=await localModule('palm-contact.js');
const data=JSON.parse(fs.readFileSync('public/github-site/assets/hand-rig.json'));
const rig=new THREE.Group(),hand=new THREE.Group(),pre=new THREE.Group();rig.add(hand);hand.add(pre);
const model=createHandMesh(data,new THREE.MeshStandardMaterial());pre.add(model);hand.userData.model=model;
hand.scale.setScalar(HAND_SCALE);
pre.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI*.46)
  .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2));
const target=new THREE.Vector3(),outward=new THREE.Vector3(),center=new THREE.Vector3(),facing=new THREE.Vector3();
const bodyCenter=new THREE.Vector3(0,-.05,0),radii=new THREE.Vector3(.88,.82,.76),supportNormal=new THREE.Vector3();
const sampler=createStrokeSampler(...radii.toArray()),mesh=model.userData.mesh;
const ids=[];
for(let i=0;i<data.positions.length/3;i++) {
  const [x,y]=data.positions.slice(i*3,i*3+2);
  if(data.normals[i*3+2]<.4||y< -1.97)continue;
  const weights=data.skinWeight.slice(i*4,i*4+4),j=weights.indexOf(Math.max(...weights));
  const bone=data.bones[data.skinIndex[i*4+j]].name;
  const zone=y> -1.54?bone.split('_')[0]:x>-.77?'thumb':y< -1.82?'heel':y> -1.67?'knuckles':'palm';
  ids.push({i,zone,rest:[x,y,data.positions[i*3+2]]});
}
const rows=[];
for(let step=0;step<=552;step++) {
  const t=step/120,s=sampler(t);
  articulateHand(model,'pet',s.pressure,s.progress,0,1/120,step===0);
  target.fromArray(s.palm).add(bodyCenter);outward.fromArray(s.orientation);supportNormal.fromArray(s.normal);
  placePalm(hand,target,outward,center,facing);
  supportPalm(hand,bodyCenter,radii,supportNormal,center,facing,1/120);
  if(step%60!==0&&step!==276)continue;
  readPalmFrame(hand,center,facing);
  const groups={},vertices=[],norm=new THREE.Vector3();
  for(const {i,zone,rest} of ids) {
    const point=mesh.getVertexPosition(i,new THREE.Vector3());
    mesh.localToWorld(point);
    norm.copy(point).sub(bodyCenter).divide(radii);
    const gap=(norm.length()-1)*point.distanceTo(bodyCenter)/norm.length();
    (groups[zone]??=[]).push(gap);
    vertices.push({point:point.toArray(),gap,zone,rest});
  }
  const gaps=Object.fromEntries(Object.entries(groups).map(([k,v])=>{
    v.sort((a,b)=>a-b);return[k,{min:+v[0].toFixed(4),median:+v[Math.floor(v.length/2)].toFixed(4),near:v.filter(x=>x<.10).length/v.length}];
  }));
  // Artistic regression tolerances in scene units, not biological standards.
  // Unlike the clearance test, these FAIL when only fingers support the hand.
  if(t>=1.3&&t<=3.45){
    assert.ok(gaps.palm.median<.08,`Palm floats at ${t}s: ${gaps.palm.median}`);
    assert.ok(gaps.palm.near>.72,`Insufficient broad palm support at ${t}s`);
    assert.ok(gaps.heel.min<.055,`Palm heel lost support at ${t}s`);
    assert.ok(gaps.knuckles.min<.075,`Knuckle pads lost support at ${t}s`);
  }
  rows.push({t,support:hand.userData.supportOffset,palm:center.toArray(),gaps,vertices});
  console.log(JSON.stringify({t,support:+hand.userData.supportOffset.toFixed(4),gaps}));
}
fs.mkdirSync('outputs/palm-support',{recursive:true});
fs.writeFileSync(`outputs/palm-support/${process.env.CONTACT_REPORT??'baseline'}.json`,JSON.stringify(rows));
