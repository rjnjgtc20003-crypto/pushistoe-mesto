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

// All results are in the common interaction rig, so rotating the scene doesn't
// change hand-to-creature contact. Bone deformation is included in every sample.
export function readPalmFrame(hand, center, facing) {
  hand.parent.updateWorldMatrix(true,false);
  // SkinnedMesh refreshes its inverse bind transform in updateMatrixWorld.
  hand.updateMatrixWorld(true);
  const model=hand.userData.model;
  const mesh=model.userData.mesh;
  for(let i=0;i<points.length;i++) {
    const index=model.userData.palmSamples[i];
    points[i].fromBufferAttribute(mesh.geometry.attributes.position,index);
    mesh.applyBoneTransform(index,points[i]);
    mesh.localToWorld(points[i]);
    hand.parent.worldToLocal(points[i]);
  }
  center.copy(points[0]).multiplyScalar(2);
  for(let i=1;i<points.length;i++)center.add(points[i]);
  center.multiplyScalar(1/6);
  across.subVectors(points[2],points[1]);
  along.subVectors(points[3],points[4]);
  facing.crossVectors(across,along).normalize();
  if(hand.userData.mirrored)facing.negate();
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
