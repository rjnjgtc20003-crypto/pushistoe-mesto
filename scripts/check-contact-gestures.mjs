import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../outputs/three.module.js';
import {sampleContactGesture,CONTACT_DURATIONS} from '../public/github-site/contact-gestures.js';
import {FurResponseField} from '../public/github-site/fur-response.js';
import {cheekScale} from '../public/github-site/body-shape.js';
async function localModule(file){
  const code=fs.readFileSync(new URL(`../public/github-site/${file}`,import.meta.url),'utf8')
    .replaceAll('./body-shape.js',new URL('../public/github-site/body-shape.js',import.meta.url).href)
    .replaceAll('https://esm.sh/three@0.180.0',new URL('../outputs/three.module.js',import.meta.url).href)
    .replaceAll('./hand-poses.js',new URL('../public/github-site/hand-poses.js',import.meta.url).href);
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
const {createHandMesh,articulateHand,HAND_SCALE}=await localModule('hand-rig.js');
const {placePalm,supportPalm,readPalmFrame,readContactSurface}=await localModule('palm-contact.js');
const data=JSON.parse(fs.readFileSync('public/github-site/assets/hand-rig.json'));
const radii=new THREE.Vector3(.88,.82,.76),rig=new THREE.Group();
function makeHand(mirrored){
  const hand=new THREE.Group(),pre=new THREE.Group(),model=createHandMesh(data,new THREE.MeshStandardMaterial());
  rig.add(hand);hand.add(pre);pre.add(model);
  pre.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI*.46)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2));
  hand.userData.model=model;hand.userData.mirrored=mirrored;
  hand.scale.set(mirrored?-HAND_SCALE:HAND_SCALE,HAND_SCALE,HAND_SCALE);
  return hand;
}
const hands=[makeHand(false),makeHand(true)];
const palmIds=[];
for(let i=0;i<data.positions.length/3;i++){
  const [x,y]=data.positions.slice(i*3,i*3+2);
  if(data.normals[i*3+2]>.4&&x<-.77&&y>=-1.82&&y<=-1.67)palmIds.push(i);
}
const target=new THREE.Vector3(),outward=new THREE.Vector3(),center=new THREE.Vector3(),facing=new THREE.Vector3(),v=new THREE.Vector3(),along=new THREE.Vector3();
const summaries=[];
const camera=new THREE.PerspectiveCamera(31,1050/900,.1,50);camera.position.set(-.068,1.109,7.922);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
for(const id of Object.keys(CONTACT_DURATIONS).filter(id=>!process.env.CONTACT_GESTURE||id===process.env.CONTACT_GESTURE)){
  hands.forEach(hand=>{hand.userData.supportOffset=0;});
  const duration=CONTACT_DURATIONS[id],dt=1/120,field=new FurResponseField(radii.toArray());
  let minimum=Infinity,maxMedian=0,maxSupport=0,maxSpeed=0,maxAcceleration=0,maxAngular=0,maxAsymmetry=0,accelerationTime=0;
  const previous=[],velocity=[];
  const rows=[],trace=[];
  for(let step=0;step<=Math.round(duration/dt);step++){
    const t=step*dt,g=sampleContactGesture(id,t),breathe=1+Math.sin(t*1.35)*.012;
    const scale=new THREE.Vector3((1-g.squeeze)/breathe,(1+g.squeeze*.72-g.pat)*breathe,(1+g.squeeze*.35+g.pat*.45)/breathe);
    const bodyCenter=new THREE.Vector3(0,-.05-g.pat*.22+Math.sin(t*1.35)*.012,0);
    const support=radii.clone().multiply(scale),contacts=[],palms=[];
    const cheeks=id==='squeeze'?g.pressure:0;field.setShape(cheeks);
    for(let h=0;h<g.palms.length;h++){
      const hand=hands[h],p=g.palms[h],model=hand.userData.model,mesh=model.userData.mesh;
      articulateHand(model,id,g.pressure,t/duration,0,dt,step===0);
      target.fromArray(p.root).addScaledVector(outward.fromArray(p.normal),p.clearance);
      if(p.approachOffset)target.add(v.fromArray(p.approachOffset));
      target.multiply(scale).add(bodyCenter);
      outward.divide(scale).normalize();
      along.fromArray(p.fingerDirection).multiply(scale).normalize();
      placePalm(hand,target,outward,center,facing,along);
      const totalSupport=supportPalm(hand,bodyCenter,support,outward,center,facing,dt,cheeks);
      maxSupport=Math.max(maxSupport,totalSupport);
      trace.push({t,hand:h,pressure:g.pressure,totalSupport,palmSupport:hand.userData.supportOffset,position:hand.position.toArray(),
        supportVertices:[hand.userData.palmSupportVertex,hand.userData.guardSupportVertex].map(i=>i===null?null:data.positions.slice(i*3,i*3+3)),
        flex:model.userData.bones.filter(b=>b.name.endsWith('_mcp')).map(b=>b.userData.contactFlex??b.userData.angles.x)});
      palms.push(center.clone());
      if(id==='squeeze'&&g.pressure>.9){
        const cuff=model.userData.bones.find(b=>b.name==='forearm').getWorldPosition(new THREE.Vector3()).sub(center).normalize();
        assert.ok(cuff.z>.55&&cuff.z>Math.abs(cuff.y),'Squeeze wrists point down instead of toward the viewer');
        assert.ok(center.y<bodyCenter.y-.1&&center.z>.3,'Palms squeeze temples instead of front/lower cheeks');
      }
      const skin=new Float32Array(model.userData.furSamples.length*3);
      readContactSurface(hand,skin);
      for(let i=0;i<skin.length;i+=3)v.fromArray(skin,i).sub(bodyCenter).divide(scale).toArray(skin,i);
      contacts.push({points:skin,normal:facing.clone().negate().multiply(scale).normalize().toArray(),
        center:center.clone().sub(bodyCenter).divide(scale).toArray(),direction:p.direction,spread:true});
      if(previous[h]){
        const speed=hand.position.distanceTo(previous[h].position)/dt;
        maxSpeed=Math.max(maxSpeed,speed);
        const vel=hand.position.clone().sub(previous[h].position).divideScalar(dt);
        if(velocity[h]&&vel.distanceTo(velocity[h])/dt>maxAcceleration){maxAcceleration=vel.distanceTo(velocity[h])/dt;accelerationTime=t;}
        velocity[h]=vel;
        maxAngular=Math.max(maxAngular,hand.quaternion.angleTo(previous[h].quaternion)/dt);
      }
      previous[h]={position:hand.position.clone(),quaternion:hand.quaternion.clone()};
      if(step%12===0){
        const saved=center.clone(),savedFacing=facing.clone();
        rig.rotation.set(.5,2.2,0);readPalmFrame(hand,center,facing);
        assert.ok(center.distanceTo(saved)<1e-5&&facing.dot(savedFacing)>.9999,'Contact depends on viewing angle');
        rig.rotation.set(0,0,0);rig.updateMatrixWorld(true);
        const gaps=[];let minScreenX=Infinity,maxScreenX=-Infinity;
        for(let i=0;i<mesh.geometry.attributes.position.count;i++){
          mesh.getVertexPosition(i,v);mesh.localToWorld(v);
          if(id==='head-pat'){const x=v.clone().project(camera).x;minScreenX=Math.min(minScreenX,x);maxScreenX=Math.max(maxScreenX,x);}
          v.sub(bodyCenter);
          const unit=v.clone().divide(support),length=unit.length();unit.divideScalar(length);
          const distance=v.length(),relative=length/cheekScale(unit.x,unit.y,unit.z,cheeks);
          minimum=Math.min(minimum,relative);
          if(palmIds.includes(i))gaps.push(distance*(relative-1)/relative);
        }
        gaps.sort((a,b)=>a-b);
        const median=gaps[Math.floor(gaps.length/2)];
        // At the press peak, not during first contact with the long outer coat.
        if(g.pressure>.9){
          if(id==='head-pat')assert.ok(Math.abs((minScreenX+maxScreenX)/2-bodyCenter.clone().project(camera).x)<.035,'Patting hand is visually off-centre');
          maxMedian=Math.max(maxMedian,median);
          assert.ok(median<.10,`${id}: palm is floating at ${t}s (${median}); support ${hand.userData.supportOffset}; hand ${h}; minimum ${gaps[0]}; supporting skin ${data.positions.slice(hand.userData.supportVertex*3,hand.userData.supportVertex*3+3)}`);
          assert.ok(gaps.filter(x=>x<.12).length/gaps.length>.7,'Only fingers touch');
          if(id==='head-pat'&&g.pressure>.999)assert.ok(median<.045,'Pat still stops above the compressed coat');
          if(id==='squeeze')assert.ok(median<.07,'Cupped palm floats above the cheek');
        }
        rows.push({t,hand:h,pressure:g.pressure,median,palm:saved.toArray()});
      }
      if(id==='squeeze'){
        assert.ok(Math.abs(center.x)<.93,'Squeeze hands withdraw too far sideways');
        if(t>=1&&t<=3.2)assert.ok(Math.abs(center.x)<.8,'Hands leave the cheeks between presses');
      }
    }
    if(palms.length===2)maxAsymmetry=Math.max(maxAsymmetry,Math.abs(palms[0].x+palms[1].x));
    if(step%2===0)field.updateContacts(1/60,contacts);
  }
  console.log(JSON.stringify({id,minimum,maxMedian,maxSupport,maxSpeed,maxAcceleration,maxAngular,maxAsymmetry,accelerationTime}));
  fs.mkdirSync('outputs/body-contact',{recursive:true});
  fs.writeFileSync(`outputs/body-contact/${id}-trace.json`,JSON.stringify(trace));
  assert.ok(minimum>.995,`${id}: hand entered body (${minimum})`);
  assert.ok(maxAsymmetry<.008,`Asymmetric squeezing (${maxAsymmetry})`);
  assert.ok(maxSpeed<2.2&&maxAcceleration<15&&maxAngular<1.6,`${id}: abrupt motion ${maxSpeed}, ${maxAcceleration} at ${accelerationTime}, ${maxAngular}`);
  assert.equal(sampleContactGesture(id,0).opacity,0);
  assert.equal(sampleContactGesture(id,duration).opacity,0);
  const report={id,minimum,maxMedian,maxSupport,maxSpeed,maxAcceleration,maxAngular,maxAsymmetry,rows};
  summaries.push(report);
}
fs.mkdirSync('outputs/contact-all',{recursive:true});
fs.writeFileSync('outputs/contact-all/contact-checks.json',JSON.stringify(summaries,null,2));
console.log('PASS: two gestures; actual morphed/skinned contact; entire-mesh body clearance; mirrored palms; camera invariance; smooth motion.');
