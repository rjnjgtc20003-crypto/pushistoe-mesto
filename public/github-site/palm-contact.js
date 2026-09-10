import * as THREE from 'https://esm.sh/three@0.180.0';

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

function updateSkinFrame(hand) {
  hand.parent.updateWorldMatrix(true,false);
  hand.updateMatrixWorld(true);
  const mesh=hand.userData.model.userData.mesh;
  toRig.copy(hand.parent.matrixWorld).invert().multiply(mesh.matrixWorld);
  return mesh;
}

function readSkinPoint(mesh,index,target) {
  target.fromBufferAttribute(mesh.geometry.attributes.position,index);
  mesh.applyBoneTransform(index,target);
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
export function placePalm(hand, target, outward, center, facing) {
  hand.position.set(0,0,0);
  hand.quaternion.identity();
  readPalmFrame(hand,center,facing);
  inward.copy(outward).negate();
  correction.setFromUnitVectors(facing,inward);
  hand.quaternion.copy(correction);
  readPalmFrame(hand,center,facing);
  hand.position.copy(target).sub(center);
  readPalmFrame(hand,center,facing);
}

// Keep ALL sampled palmar skin outside the soft body's support ellipsoid.
// The exact ray/ellipsoid exit distance accounts for hand width and finger pose.
// A small smooth maximum avoids a jerk when the supporting skin sample changes.
export function supportPalm(hand,bodyCenter,radii,outward,center,facing) {
  const mesh=updateSkinFrame(hand);
  supportRadii.copy(radii).addScalar(0.035);
  supportDirection.copy(outward).divide(supportRadii);
  const a=supportDirection.lengthSq();
  let lift=0;
  for(const index of hand.userData.model.userData.contactSamples) {
    readSkinPoint(mesh,index,supportPoint).sub(bodyCenter).divide(supportRadii);
    const b=supportPoint.dot(supportDirection),c=supportPoint.lengthSq()-1;
    const discriminant=b*b-a*c;
    if(discriminant<=0||b<=0)continue;
    const exit=(-b+Math.sqrt(discriminant))/a;
    const softness=0.018;
    lift=Math.max(lift,exit)+softness*Math.log1p(Math.exp(-Math.abs(lift-exit)/softness));
  }
  hand.position.addScaledVector(outward,lift);
  hand.userData.supportOffset=lift;
  readPalmFrame(hand,center,facing);
  return lift;
}

// Retarget archived pat/squeeze keys around palmar skin, not the mesh origin.
export function resizeAtPalm(hand,scale) {
  readPalmFrame(hand,savedCenter,resizeFacing);
  const x=hand.userData.mirrored?-scale:scale;
  hand.scale.set(x,scale,scale);
  readPalmFrame(hand,supportPoint,resizeFacing);
  hand.position.add(savedCenter.sub(supportPoint));
}
