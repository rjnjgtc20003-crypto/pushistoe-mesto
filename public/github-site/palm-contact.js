import * as THREE from 'https://esm.sh/three@0.180.0';
import {cheekScale} from './body-shape.js';

const points = Array.from({length:5},()=>new THREE.Vector3());
const across = new THREE.Vector3();
const along = new THREE.Vector3();
const inward = new THREE.Vector3();
const offset = new THREE.Vector3();
const surface = new THREE.Vector3();
const normal = new THREE.Vector3();
const correction = new THREE.Quaternion();
const partial = new THREE.Quaternion();
const toRig = new THREE.Matrix4();
const supportPoint = new THREE.Vector3();
const supportDirection = new THREE.Vector3();
const supportRadii = new THREE.Vector3();
const savedCenter = new THREE.Vector3();
const resizeFacing = new THREE.Vector3();
const desiredAlong = new THREE.Vector3();
const twistCross = new THREE.Vector3();
const rayPoint = new THREE.Vector3();
const flexRotation = new THREE.Euler();
const flexQuaternion = new THREE.Quaternion();

function setFlex(bone,angle){
  const a=bone.userData.angles;
  flexRotation.set(angle,a.y,a.z,'XYZ');
  bone.quaternion.copy(bone.userData.rest).multiply(flexQuaternion.setFromEuler(flexRotation));
}

function bodyGap(point,bodyCenter,radii,cheeks){
  const x=(point.x-bodyCenter.x)/radii.x,y=(point.y-bodyCenter.y)/radii.y,z=(point.z-bodyCenter.z)/radii.z;
  const l=Math.hypot(x,y,z);
  return point.distanceTo(bodyCenter)*(1-(cheeks?cheekScale(x/l,y/l,z/l,cheeks):1)/l);
}

// Fit each finger to the body AFTER establishing broad palm support. A finger
// must not act as a prop that lifts the entire palm back into the outer coat.
// One bounded synergy per digit bends mainly at MCP, gently at PIP/DIP: this
// follows a convex surface without solving a hooked fingertip grasp.
function conformDigits(hand,bodyCenter,radii,cheeks){
  const model=hand.userData.model,p=model.userData.contactPressure??0;
  if(p<1e-5)return;
  for(const {indices,bones:chain,maximum} of model.userData.contactChains){
    const poseAt=u=>{for(let j=0;j<chain.length;j++)setFlex(chain[j],maximum[j]*u);};
    const gap=()=>{
      const mesh=updateSkinFrame(hand);let min=Infinity;
      for(const index of indices){
        readSkinPoint(mesh,index,supportPoint);
        min=Math.min(min,bodyGap(supportPoint,bodyCenter,radii,cheeks));
      }
      return min;
    };
    let lo=0,hi=1;
    poseAt(hi);
    if(gap()<.014){
      for(let i=0;i<12;i++){
        const mid=(lo+hi)/2;poseAt(mid);
        if(gap()<.014)hi=mid;else lo=mid;
      }
    }else lo=1;
    for(let j=0;j<chain.length;j++){
      const angle=chain[j].userData.angles.x*(1-p)+maximum[j]*lo*p;
      setFlex(chain[j],angle);chain[j].userData.contactFlex=angle;
    }
  }
  updateSkinFrame(hand);
}

function updateSkinFrame(hand) {
  hand.parent.updateWorldMatrix(true,false);
  hand.updateMatrixWorld(true);
  const mesh=hand.userData.model.userData.mesh;
  toRig.copy(hand.parent.matrixWorld).invert().multiply(mesh.matrixWorld);
  return mesh;
}

function readSkinPoint(mesh,index,target) {
  // getVertexPosition includes BOTH the pad corrective and skeletal skinning.
  mesh.getVertexPosition(index,target);
  return target.applyMatrix4(toRig);
}

// All results are in the common interaction rig, so rotating the scene doesn't
// change hand-to-creature contact. Bone deformation is included in every sample.
export function readPalmFrame(hand, center, facing) {
  // SkinnedMesh refreshes its inverse bind transform in updateMatrixWorld.
  const mesh=updateSkinFrame(hand);
  const model=hand.userData.model;
  for(let i=0;i<points.length;i++) {
    const index=model.userData.palmSamples[i];
    readSkinPoint(mesh,index,points[i]);
  }
  center.copy(points[0]).multiplyScalar(2);
  for(let i=1;i<points.length;i++)center.add(points[i]);
  center.multiplyScalar(1/6);
  across.subVectors(points[2],points[1]);
  along.subVectors(points[3],points[4]);
  facing.crossVectors(across,along).normalize();
  if(hand.userData.mirrored)facing.negate();
  hand.userData.palmAlong??=new THREE.Vector3();
  hand.userData.palmAlong.copy(along).addScaledVector(facing,-along.dot(facing)).normalize();
}

export function fitPalmToHead(hand, bodyCenter, radii, amount, contact, facing) {
  // Authored position selects the stroke along the head; palmar skin sets height.
  offset.copy(hand.position).sub(bodyCenter);
  const length=Math.sqrt((offset.x/radii.x)**2+(offset.y/radii.y)**2+(offset.z/radii.z)**2);
  surface.copy(offset).multiplyScalar(1/Math.max(length,1e-6));
  normal.set(surface.x/(radii.x*radii.x),surface.y/(radii.y*radii.y),surface.z/(radii.z*radii.z)).normalize();
  surface.add(bodyCenter).addScaledVector(normal,0.065);
  readPalmFrame(hand,contact,facing);
  inward.copy(normal).negate();
  correction.setFromUnitVectors(facing,inward);
  partial.identity().slerp(correction,amount);
  hand.quaternion.premultiply(partial);
  readPalmFrame(hand,contact,facing);
  offset.copy(surface).sub(contact).multiplyScalar(amount);
  hand.position.add(offset);
  readPalmFrame(hand,contact,facing);
  // Fur responds under the palm's actual position, projected onto its roots.
  contact.sub(bodyCenter);
  const rootLength=Math.sqrt((contact.x/radii.x)**2+(contact.y/radii.y)**2+(contact.z/radii.z)**2);
  contact.multiplyScalar(1/Math.max(rootLength,1e-6));
}

export function palmClearance(hand, bodyCenter, radii, contact, facing) {
  readPalmFrame(hand,contact,facing);
  offset.copy(contact).sub(bodyCenter);
  const length=Math.sqrt((offset.x/radii.x)**2+(offset.y/radii.y)**2+(offset.z/radii.z)**2);
  surface.copy(offset).multiplyScalar(1/Math.max(length,1e-6));
  return offset.distanceTo(surface);
}

// Place an already articulated hand on a prescribed, continuous palm path.
// Translation and orientation share the same surface frame at every instant.
export function placePalm(hand, target, outward, center, facing, fingerDirection = null) {
  hand.position.set(0,0,0);
  hand.quaternion.identity();
  readPalmFrame(hand,center,facing);
  inward.copy(outward).negate();
  correction.setFromUnitVectors(facing,inward);
  hand.quaternion.copy(correction);
  readPalmFrame(hand,center,facing);
  if(fingerDirection){
    // Normal alone leaves twist unconstrained. Aim the longitudinal palm axis
    // as well, so the wrist can approach from the viewer rather than below.
    desiredAlong.copy(fingerDirection).addScaledVector(outward,-fingerDirection.dot(outward));
    if(desiredAlong.lengthSq()>1e-8){
      desiredAlong.normalize();
      const current=hand.userData.palmAlong;
      const angle=Math.atan2(twistCross.crossVectors(current,desiredAlong).dot(outward),current.dot(desiredAlong));
      correction.setFromAxisAngle(outward,angle);
      hand.quaternion.premultiply(correction);
      readPalmFrame(hand,center,facing);
    }
  }
  hand.position.copy(target).sub(center);
  readPalmFrame(hand,center,facing);
}

// Keep ALL sampled palmar skin outside the soft body's support ellipsoid.
// The exact ray/ellipsoid exit distance accounts for hand width and finger pose.
// A small smooth maximum avoids a jerk when the supporting skin sample changes.
function requiredSupport(hand,bodyCenter,radii,outward,cheeks,samples,margin,activation){
  const mesh=updateSkinFrame(hand);
  supportRadii.copy(radii).addScalar(margin);
  supportDirection.copy(outward).divide(supportRadii);
  const a=supportDirection.lengthSq();
  let lift=-1;
  hand.userData.supportVertex=null;
  for(const index of samples) {
    readSkinPoint(mesh,index,supportPoint).sub(bodyCenter).divide(supportRadii);
    const b=supportPoint.dot(supportDirection),c=supportPoint.lengthSq()-1;
    const discriminant=b*b-a*c;
    if(discriminant<=0||b<=0)continue;
    let exit=(-b+Math.sqrt(discriminant))/a;
    if(cheeks>0){
      // Keep the SIGNED exit for skin just outside a deformed cheek, too.
      // Dropping these samples made the soft contact activate discontinuously.
      let lo=-b/a,hi=exit;
      rayPoint.copy(supportPoint).addScaledVector(supportDirection,lo);
      const closest=rayPoint.length();
      if(closest>=cheekScale(rayPoint.x/closest,rayPoint.y/closest,rayPoint.z/closest,cheeks))continue;
      for(let step=0;step<18;step++){
        const mid=(lo+hi)/2;
        rayPoint.copy(supportPoint).addScaledVector(supportDirection,mid);
        const l=rayPoint.length();
        if(l>=cheekScale(rayPoint.x/l,rayPoint.y/l,rayPoint.z/l,cheeks))hi=mid;else lo=mid;
      }
      exit=hi;
    }
    if(exit>lift)hand.userData.supportVertex=index;
    // Compact smooth maximum: distant/non-contacting samples add NO lift.
    // Log-sum-exp accumulated a visible air gap from the sample count alone.
    const softness=0.003;
    const blend=Math.max(0,softness-Math.abs(lift-exit))/softness;
    lift=Math.max(lift,exit)+blend*blend*softness*.25;
  }
  // Ease into support BEFORE the constraint becomes active. A hard max(0,x)
  // starts with an abrupt stop even when the incoming path is C2 continuous.
  const blend=Math.max(0,activation-Math.abs(lift))/activation;
  return Math.max(0,lift)+blend*blend*activation*.25;
}

export function supportPalm(hand,bodyCenter,radii,outward,center,facing,dt,cheeks=0) {
  const model=hand.userData.model,contact=model.userData.contactPressure>0;
  const squeeze=model.userData.contactGesture==='squeeze';
  let lift=requiredSupport(hand,bodyCenter,radii,outward,cheeks,contact?model.userData.palmSupport:model.userData.contactSamples,.012,squeeze?.04:.025);
  hand.userData.palmSupportVertex=hand.userData.supportVertex;
  hand.position.addScaledVector(outward,lift);
  if(contact){
    conformDigits(hand,bodyCenter,radii,cheeks);
    const guard=requiredSupport(hand,bodyCenter,radii,outward,cheeks,model.userData.contactSamples,.006,squeeze?.018:.012);
    hand.userData.guardSupportVertex=hand.userData.supportVertex;
    hand.position.addScaledVector(outward,guard);lift+=guard;
  }
  if(dt!==undefined){
    const previous=hand.userData.supportOffset??0;
    const relaxed=previous+(lift-previous)*(1-Math.exp(-Math.min(dt,.05)/.07));
    const filtered=Math.max(0,lift-.004,relaxed);
    hand.position.addScaledVector(outward,filtered-lift);lift=filtered;
  }
  hand.userData.supportOffset=lift;
  readPalmFrame(hand,center,facing);
  return lift;
}

// Palmar skin positions in the common interaction rig, including articulation.
// Reuse the caller's buffer so contact does not allocate every animation frame.
export function readContactSurface(hand,target) {
  const mesh=updateSkinFrame(hand);
  const samples=hand.userData.model.userData.furSamples;
  for(let i=0;i<samples.length;i++){
    readSkinPoint(mesh,samples[i],supportPoint);
    supportPoint.toArray(target,i*3);
  }
  return target;
}

// Retarget archived pat/squeeze keys around palmar skin, not the mesh origin.
export function resizeAtPalm(hand,scale) {
  readPalmFrame(hand,savedCenter,resizeFacing);
  const x=hand.userData.mirrored?-scale:scale;
  hand.scale.set(x,scale,scale);
  readPalmFrame(hand,supportPoint,resizeFacing);
  hand.position.add(savedCenter.sub(supportPoint));
}
