import * as THREE from 'https://esm.sh/three@0.180.0';
import { handPose, jointResponse } from './hand-poses.js';

export const HAND_SCALE = 1.55;
export const AUTHORED_HAND_SCALE = 1.24;

export function createHandMesh(data, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(data.skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(data.skinWeight, 4));
  geometry.setIndex(data.indices);
  geometry.computeBoundingBox();
  const mesh = new THREE.SkinnedMesh(geometry, material);
  const bones = data.bones.map((info) => {
    const bone = new THREE.Bone();
    bone.name = info.name;
    bone.position.fromArray(info.position);
    bone.quaternion.fromArray(info.quaternion);
    bone.userData.rest = bone.quaternion.clone();
    bone.userData.angles = new THREE.Vector3();
    return bone;
  });
  data.bones.forEach((info, i) => {
    if (info.parent < 0) mesh.add(bones[i]);
    else bones[info.parent].add(bones[i]);
  });
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.normalizeSkinWeights();
  // The hand is tiny relative to the scene; avoid stale rest-pose culling.
  mesh.frustumCulled = false;
  const model = new THREE.Group();
  model.add(mesh);
  model.position.sub(geometry.boundingBox.getCenter(new THREE.Vector3()));
  model.userData.mesh = mesh;
  model.userData.bones = bones;
  // Sample the actual palmar skin, not the model origin or finger endpoints.
  model.userData.palmSamples = [[-.94,-1.78],[-1.04,-1.78],[-.84,-1.78],[-.94,-1.66],[-.94,-1.88]].map(([x,y]) => {
    let best = -1;
    let distance = Infinity;
    for (let i=0;i<data.positions.length/3;i++) {
      if (data.normals[i*3+2] < 0.45) continue;
      const d=(data.positions[i*3]-x)**2+(data.positions[i*3+1]-y)**2;
      if (d<distance) { distance=d; best=i; }
    }
    if (best < 0) throw new Error('Missing palmar surface');
    return best;
  });
  // Broad palmar contact: a spatial sample of heel, both palm edges, thumb and
  // finger pads. Keep the palmar-most vertex per cell, not just the centre point.
  const pads=new Map();
  for(let i=0;i<data.positions.length/3;i++) {
    const x=data.positions[i*3],y=data.positions[i*3+1],z=data.positions[i*3+2];
    if(data.normals[i*3+2]<0.25||y< -2.04)continue;
    const cell=`${Math.round(x/0.055)},${Math.round(y/0.055)}`;
    const old=pads.get(cell);
    if(old===undefined||z>data.positions[old*3+2])pads.set(cell,i);
  }
  model.userData.contactSamples=[...pads.values()];
  // Fur can reach the wrist and sides even when they do not support the body.
  // Keep this coverage separate from the load-bearing palm contact samples.
  const coatPads=new Map();
  for(let i=0;i<data.positions.length/3;i++){
    if(data.normals[i*3+2]<.1)continue;
    const x=data.positions[i*3],y=data.positions[i*3+1],z=data.positions[i*3+2];
    const key=`${Math.round(x/.045)},${Math.round(y/.045)}`;
    const old=coatPads.get(key);
    if(old===undefined||z>data.positions[old*3+2])coatPads.set(key,i);
  }
  model.userData.furSamples=[...coatPads.values()];
  return model;
}

const rotation = new THREE.Euler();
const deltaRotation = new THREE.Quaternion();
export function articulateHand(model, gesture, pressure, phase, stroke, dt, snap = false) {
  const pose = handPose(gesture, pressure, phase, stroke);
  for (const bone of model.userData.bones) {
    const target = pose[bone.name] ?? [0, 0, 0];
    const a = snap ? 1 : 1 - Math.exp(-jointResponse(bone.name) * Math.min(dt, 0.05));
    const angles = bone.userData.angles;
    angles.x += (THREE.MathUtils.degToRad(target[0]) - angles.x) * a;
    angles.y += (THREE.MathUtils.degToRad(target[1]) - angles.y) * a;
    angles.z += (THREE.MathUtils.degToRad(target[2]) - angles.z) * a;
    rotation.set(angles.x, angles.y, angles.z, 'XYZ');
    deltaRotation.setFromEuler(rotation);
    bone.quaternion.copy(bone.userData.rest).multiply(deltaRotation);
  }
}
