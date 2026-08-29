import * as THREE from 'https://esm.sh/three@0.180.0';
import { OBJLoader } from 'https://esm.sh/three@0.180.0/examples/jsm/loaders/OBJLoader.js';

const canvas = document.querySelector('canvas');
const colorButtons = [...document.querySelectorAll('[data-color]')];
const actionButtons = [...document.querySelectorAll('[data-action]')];
const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 50);
camera.position.set(-0.068, 1.109, 7.922);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xffe5df, 0x17070c, 2.2));
const keyLight = new THREE.DirectionalLight(0xffd7cf, 4.7);
keyLight.position.set(-3.5, 4.5, 4.5);
scene.add(keyLight);
const redRim = new THREE.PointLight(0xd61034, 18, 8, 2);
redRim.position.set(3.1, 0.5, 1.5);
scene.add(redRim);
const coolRim = new THREE.PointLight(0x7d8ca8, 8, 7, 2);
coolRim.position.set(-2.8, -1.6, 0.4);
scene.add(coolRim);

const creature = new THREE.Group();
creature.position.y = -0.05;
scene.add(creature);

const radii = new THREE.Vector3(1.08, 1.02, 0.96);
const blackBody = new THREE.Color(0x10090d);
const redBody = new THREE.Color(0x7c071d);
const bodyGeometry = new THREE.SphereGeometry(1, 80, 56);
const bodyColors = new Float32Array(bodyGeometry.getAttribute('position').count * 3);
bodyGeometry.setAttribute('color', new THREE.BufferAttribute(bodyColors, 3));
const bodyMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  vertexColors: true,
  roughness: 0.9,
  metalness: 0,
  clearcoat: 0.08,
  clearcoatRoughness: 0.9,
});
const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
body.scale.copy(radii);
creature.add(body);

const hairOffsets = [];
const hairNormals = [];
const hairPhases = [];
const hairLengths = [];
const hairWidths = [];
const hairPattern = [];
const golden = Math.PI * (3 - Math.sqrt(5));
const hairCount = 30000;

for (let i = 0; i < hairCount; i += 1) {
  const y = 1 - (2 * (i + 0.5)) / hairCount;
  const ring = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = i * golden;
  const baseUnit = new THREE.Vector3(Math.cos(theta) * ring, y, Math.sin(theta) * ring);
  const baseSurface = new THREE.Vector3(baseUnit.x * radii.x, baseUnit.y * radii.y, baseUnit.z * radii.z);
  const baseNormal = new THREE.Vector3(
    baseSurface.x / (radii.x * radii.x),
    baseSurface.y / (radii.y * radii.y),
    baseSurface.z / (radii.z * radii.z),
  ).normalize();
  const helper = Math.abs(baseNormal.y) < 0.88 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const tangent = new THREE.Vector3().crossVectors(baseNormal, helper).normalize();
  const bitangent = new THREE.Vector3().crossVectors(baseNormal, tangent).normalize();
  const hashA = Math.sin(i * 127.1 + 13.7) * 43758.5453;
  const hashB = Math.sin(i * 311.7 + 91.3) * 24634.6345;
  const jitterA = (hashA - Math.floor(hashA) - 0.5) * 0.024;
  const jitterB = (hashB - Math.floor(hashB) - 0.5) * 0.024;
  const unit = baseUnit.clone().addScaledVector(tangent, jitterA).addScaledVector(bitangent, jitterB).normalize();
  const surface = new THREE.Vector3(unit.x * radii.x, unit.y * radii.y, unit.z * radii.z);
  const normal = new THREE.Vector3(
    surface.x / (radii.x * radii.x),
    surface.y / (radii.y * radii.y),
    surface.z / (radii.z * radii.z),
  ).normalize();
  const undercoat = i % 3 === 0;
  const wave = 0.5 + 0.5 * Math.sin(i * 12.9898);
  const redPattern = Math.sin(theta * 2.45 + y * 4.4) + Math.sin(theta * 5.5 - y * 2.7) * 0.26;

  hairOffsets.push(surface.x, surface.y, surface.z);
  hairNormals.push(normal.x, normal.y, normal.z);
  hairPhases.push(i * 0.217);
  hairLengths.push(undercoat ? 0.58 + 0.16 * wave : 0.92 + 0.3 * wave);
  hairWidths.push((undercoat ? 0.92 : 0.74) + 0.28 * (0.5 + 0.5 * Math.cos(i * 7.31)));
  hairPattern.push(THREE.MathUtils.smoothstep(redPattern, 0.34, 0.7));
}

const baseHair = new THREE.ConeGeometry(0.0036, 0.19, 4, 2, false);
baseHair.translate(0, 0.095, 0);
const furGeometry = new THREE.InstancedBufferGeometry();
furGeometry.index = baseHair.index;
furGeometry.setAttribute('position', baseHair.getAttribute('position'));
furGeometry.setAttribute('normal', baseHair.getAttribute('normal'));
furGeometry.setAttribute('uv', baseHair.getAttribute('uv'));
furGeometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(hairOffsets), 3));
furGeometry.setAttribute('aNormal', new THREE.InstancedBufferAttribute(new Float32Array(hairNormals), 3));
furGeometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(hairPhases), 1));
furGeometry.setAttribute('aLength', new THREE.InstancedBufferAttribute(new Float32Array(hairLengths), 1));
furGeometry.setAttribute('aWidth', new THREE.InstancedBufferAttribute(new Float32Array(hairWidths), 1));
const hairRedAttribute = new THREE.InstancedBufferAttribute(new Float32Array(hairPattern), 1);
hairRedAttribute.setUsage(THREE.DynamicDrawUsage);
furGeometry.setAttribute('aRed', hairRedAttribute);
furGeometry.instanceCount = hairCount;
furGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.45);

const furMaterial = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: {
    uTime: { value: 0 },
    uReducedMotion: { value: prefersReducedMotion ? 1 : 0 },
    uTouch0: { value: new THREE.Vector3(4, 4, 4) },
    uTouch1: { value: new THREE.Vector3(4, 4, 4) },
    uStrokeDir: { value: new THREE.Vector3(1, -0.08, 0).normalize() },
    uPressure: { value: 0 },
  },
  vertexShader: `
    uniform float uTime;
    uniform float uReducedMotion;
    uniform vec3 uTouch0;
    uniform vec3 uTouch1;
    uniform vec3 uStrokeDir;
    uniform float uPressure;
    attribute vec3 aOffset;
    attribute vec3 aNormal;
    attribute float aPhase;
    attribute float aLength;
    attribute float aWidth;
    attribute float aRed;
    varying float vRed;
    varying float vLight;
    varying float vAlong;

    void main() {
      vec3 n = normalize(aNormal);
      vec3 helper = abs(n.y) < 0.88 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      vec3 tangent = normalize(cross(n, helper));
      vec3 bitangent = normalize(cross(n, tangent));
      float along = clamp(position.y / 0.19, 0.0, 1.0);
      float tip = along * along;
      float motion = 1.0 - uReducedMotion;
      float sway = sin(uTime * 1.18 + aPhase) * 0.021 * tip * motion;
      float crossSway = cos(uTime * 0.91 + aPhase * 0.67) * 0.013 * tip * motion;
      float touch0 = 1.0 - smoothstep(0.13, 0.4, distance(aOffset, uTouch0));
      float touch1 = 1.0 - smoothstep(0.12, 0.37, distance(aOffset, uTouch1));
      float contact = max(touch0, touch1) * uPressure;
      float longHair = smoothstep(0.72, 1.04, aLength);
      float compressedLength = aLength * (1.0 - contact * mix(0.52, 0.72, longHair));
      vec3 brush = normalize(uStrokeDir + vec3(0.0001));
      vec3 strokeTangent = normalize(brush - n * dot(brush, n) + vec3(0.0001));
      vec3 p = aOffset;
      p += n * (position.y * compressedLength);
      p += tangent * (position.x * aWidth + sway * (1.0 - contact));
      p += bitangent * (position.z * aWidth + crossSway * (1.0 - contact));
      p += strokeTangent * contact * tip * mix(0.045, 0.12, longHair);
      p -= n * contact * tip * 0.035;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      vRed = aRed;
      vAlong = along;
      vLight = 0.52 + 0.48 * max(0.0, dot(n, normalize(vec3(-0.7, 0.8, 1.0))));
    }
  `,
  fragmentShader: `
    varying float vRed;
    varying float vLight;
    varying float vAlong;

    void main() {
      vec3 blackFur = vec3(0.022, 0.006, 0.012);
      vec3 redFur = vec3(0.48, 0.008, 0.055);
      vec3 color = mix(blackFur, redFur, vRed) * vLight;
      color += mix(vec3(0.008), vec3(0.09, 0.008, 0.018), vRed) * vAlong;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
});
const furCloud = new THREE.Mesh(furGeometry, furMaterial);
furCloud.frustumCulled = false;
creature.add(furCloud);

function applyColorMode(mode) {
  const hairColors = hairRedAttribute.array;
  const bodyPositions = bodyGeometry.getAttribute('position');
  const color = new THREE.Color();

  for (let i = 0; i < hairCount; i += 1) {
    const x = hairOffsets[i * 3];
    const y = hairOffsets[i * 3 + 1];
    hairColors[i] = mode === 1 ? hairPattern[i] : mode === 2 ? (x < 0 ? 1 : 0) : (y > 0 ? 1 : 0);
  }
  hairRedAttribute.needsUpdate = true;

  for (let i = 0; i < bodyPositions.count; i += 1) {
    const x = bodyPositions.getX(i);
    const y = bodyPositions.getY(i);
    const redness = mode === 1 ? 0 : mode === 2 ? (x < 0 ? 1 : 0) : (y > 0 ? 1 : 0);
    color.copy(blackBody).lerp(redBody, redness);
    bodyColors[i * 3] = color.r;
    bodyColors[i * 3 + 1] = color.g;
    bodyColors[i * 3 + 2] = color.b;
  }
  bodyGeometry.getAttribute('color').needsUpdate = true;

  colorButtons.forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.color) === mode)));
  navigator.vibrate?.(7);
}

colorButtons.forEach((button) => {
  button.addEventListener('click', () => applyColorMode(Number(button.dataset.color)));
});
applyColorMode(1);

const textureLoader = new THREE.TextureLoader();
const eyeGroups = [];
const eyeContents = [];
const eyePixelScale = 0.0062;
const eyeSourceOrigin = { x: 555.5, y: 382.5 };

function makeEyeLayer(source, bounds, z) {
  const anchor = new THREE.Group();
  const x = (bounds.x + bounds.w * 0.5 - eyeSourceOrigin.x) * eyePixelScale;
  const y = 0.14 - (bounds.y + bounds.h * 0.5 - eyeSourceOrigin.y) * eyePixelScale;
  anchor.position.set(x, y, z);
  anchor.userData.baseX = x;
  anchor.userData.baseY = y;
  creature.add(anchor);

  const content = new THREE.Group();
  anchor.add(content);
  const texture = textureLoader.load(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  const eye = new THREE.Mesh(
    new THREE.PlaneGeometry(bounds.w * eyePixelScale, bounds.h * eyePixelScale),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.02, depthWrite: false, toneMapped: false }),
  );
  content.add(eye);
  eyeGroups.push(anchor);
  eyeContents.push(content);
}

makeEyeLayer('./assets/eye2.png', { x: 475, y: 337, w: 161, h: 91 }, 1.251);
makeEyeLayer('./assets/eye1.png', { x: 549, y: 340, w: 87, h: 88 }, 1.253);

const browOutlineMaterial = new THREE.MeshBasicMaterial({ color: 0x5f1322, transparent: true, opacity: 0.78 });
const browMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x020103,
  roughness: 0.48,
  clearcoat: 0.42,
  clearcoatRoughness: 0.32,
});

function makeBrow(points) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const outline = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.033, 8, false), browOutlineMaterial);
  const brow = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.024, 8, false), browMaterial);
  outline.position.z = -0.006;
  creature.add(outline, brow);
}

makeBrow([
  new THREE.Vector3(-0.52, 0.48, 1.278),
  new THREE.Vector3(-0.36, 0.53, 1.296),
  new THREE.Vector3(-0.13, 0.59, 1.282),
]);
makeBrow([
  new THREE.Vector3(0.13, 0.59, 1.282),
  new THREE.Vector3(0.36, 0.53, 1.296),
  new THREE.Vector3(0.52, 0.48, 1.278),
]);

function makeMouthTexture() {
  const mouthCanvas = document.createElement('canvas');
  mouthCanvas.width = 256;
  mouthCanvas.height = 128;
  const context = mouthCanvas.getContext('2d');
  context.beginPath();
  context.moveTo(48, 91);
  context.quadraticCurveTo(128, 26, 208, 91);
  context.strokeStyle = '#e7a2ad';
  context.lineWidth = 17;
  context.lineCap = 'round';
  context.stroke();
  const texture = new THREE.CanvasTexture(mouthCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const mouth = new THREE.Mesh(
  new THREE.PlaneGeometry(0.19, 0.095),
  new THREE.MeshBasicMaterial({ map: makeMouthTexture(), transparent: true, depthWrite: false, toneMapped: false }),
);
mouth.position.set(0, -0.19, 1.258);
creature.add(mouth);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(1.65, 80),
  new THREE.MeshBasicMaterial({ color: 0x6c0a1d, transparent: true, opacity: 0.12, depthWrite: false }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -1.17, -0.08);
floor.scale.y = 0.35;
scene.add(floor);

const animations = new Map();
let leftHand = null;
let rightHand = null;
let actionState = null;
const skinMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xe4aa91,
  roughness: 0.68,
  clearcoat: 0.1,
  clearcoatRoughness: 0.78,
});

function createHand(source, mirrored = false) {
  const hand = new THREE.Group();
  const handPose = new THREE.Group();
  const model = source.clone(true);
  model.traverse((child) => {
    if (child.isMesh) {
      child.material = skinMaterial;
      child.geometry.computeVertexNormals();
    }
  });
  handPose.add(model);
  const wristToRight = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const palmToSide = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI * 0.46);
  handPose.quaternion.copy(palmToSide).multiply(wristToRight);
  hand.add(handPose);
  hand.scale.set(mirrored ? -1.05 : 1.05, 1.05, 1.05);
  hand.visible = false;
  scene.add(hand);
  return hand;
}

function sampleTrack(keyframes, frame, hand, side = null, smooth = false) {
  const before = [...keyframes].reverse().find((keyframe) => keyframe.frame <= frame) ?? keyframes[0];
  const after = keyframes.find((keyframe) => keyframe.frame >= frame) ?? keyframes.at(-1);
  const first = side ? before[side] : before;
  const second = side ? after[side] : after;
  let amount = before.frame === after.frame ? 0 : (frame - before.frame) / (after.frame - before.frame);
  if (smooth) amount = amount * amount * (3 - 2 * amount);
  const firstPosition = new THREE.Vector3().fromArray(first.position);
  const secondPosition = new THREE.Vector3().fromArray(second.position);
  const firstQuaternion = new THREE.Quaternion().fromArray(first.quaternion).normalize();
  const secondQuaternion = new THREE.Quaternion().fromArray(second.quaternion).normalize();
  hand.position.lerpVectors(firstPosition, secondPosition, amount);
  hand.quaternion.copy(firstQuaternion).slerp(secondQuaternion, amount);
}

function setActionButton(id) {
  actionButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.action === id)));
}

function playAction(id) {
  const animation = animations.get(id);
  if (!animation || !leftHand || !rightHand) return;
  actionState = { id, animation, startedAt: clock.getElapsedTime() };
  leftHand.visible = true;
  rightHand.visible = id === 'squeeze';
  setActionButton(id);
  navigator.vibrate?.(id === 'squeeze' ? [8, 28, 8] : 9);
}

actionButtons.forEach((button) => button.addEventListener('click', () => playAction(button.dataset.action)));

async function loadHandsAndAnimations() {
  const [handText, pet, headPat, squeeze] = await Promise.all([
    fetch('./assets/hand.obj').then((response) => response.text()),
    fetch('./assets/pet.json').then((response) => response.json()),
    fetch('./assets/head-pat.json').then((response) => response.json()),
    fetch('./assets/squeeze.json').then((response) => response.json()),
  ]);
  const source = new OBJLoader().parse(handText);
  const bounds = new THREE.Box3().setFromObject(source);
  source.position.sub(bounds.getCenter(new THREE.Vector3()));
  leftHand = createHand(source, false);
  rightHand = createHand(source, true);
  animations.set('pet', pet);
  animations.set('head-pat', headPat);
  animations.set('squeeze', squeeze);
  actionButtons.forEach((button) => { button.disabled = false; });
}

loadHandsAndAnimations().catch((error) => console.error('Не удалось загрузить анимации', error));

const localHandPosition = new THREE.Vector3();
const contactCenter = new THREE.Vector3();
const secondContact = new THREE.Vector3();
const previousContact = new THREE.Vector3();
const leftContact = new THREE.Vector3();
const rightContact = new THREE.Vector3();
const movement = new THREE.Vector3(1, -0.08, 0);
let hasPreviousContact = false;

function projectHandToFur(hand, target) {
  localHandPosition.copy(hand.position).sub(creature.position);
  const denominator = Math.sqrt(
    (localHandPosition.x * localHandPosition.x) / (radii.x * radii.x)
      + (localHandPosition.y * localHandPosition.y) / (radii.y * radii.y)
      + (localHandPosition.z * localHandPosition.z) / (radii.z * radii.z),
  );
  target.copy(localHandPosition).multiplyScalar(1 / Math.max(denominator, 0.0001));
  return localHandPosition.distanceTo(target);
}

function smoothStep(edge0, edge1, value) {
  const amount = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function updateAction(time) {
  let squeezeAmount = 0;
  let headPatAmount = 0;

  if (actionState) {
    const { id, animation, startedAt } = actionState;
    const elapsed = time - startedAt;
    const frame = Math.min(elapsed * animation.fps, animation.durationFrames - 1);
    const smooth = animation.interpolation?.position === 'smoothstep';

    if (id === 'squeeze') {
      sampleTrack(animation.keyframes, frame, leftHand, 'left', smooth);
      sampleTrack(animation.keyframes, frame, rightHand, 'right', smooth);
      const leftDistance = projectHandToFur(leftHand, leftContact);
      const rightDistance = projectHandToFur(rightHand, rightContact);
      const leftPressure = 1 - smoothStep(0.18, 0.62, leftDistance);
      const rightPressure = 1 - smoothStep(0.18, 0.62, rightDistance);
      squeezeAmount = Math.min(leftPressure, rightPressure) * 0.075;
      furMaterial.uniforms.uPressure.value = 0;
      hasPreviousContact = false;
    } else {
      sampleTrack(animation.keyframes, frame, leftHand, null, smooth);
      const distance = projectHandToFur(leftHand, contactCenter);
      const contactPressure = 1 - smoothStep(0.18, 0.58, distance);
      headPatAmount = id === 'head-pat' ? contactPressure * 0.03 : 0;
      if (hasPreviousContact) {
        movement.copy(contactCenter).sub(previousContact);
        if (movement.lengthSq() > 0.00001) movement.normalize();
      }
      secondContact.copy(contactCenter).addScaledVector(movement, -0.15);
      previousContact.copy(contactCenter);
      hasPreviousContact = true;
      furMaterial.uniforms.uTouch0.value.copy(contactCenter);
      furMaterial.uniforms.uTouch1.value.copy(secondContact);
      furMaterial.uniforms.uStrokeDir.value.copy(movement);
      furMaterial.uniforms.uPressure.value = contactPressure;
    }

    if (elapsed >= animation.durationSeconds) {
      leftHand.visible = false;
      rightHand.visible = false;
      actionState = null;
      setActionButton(null);
      furMaterial.uniforms.uPressure.value = 0;
      hasPreviousContact = false;
    }
  } else {
    furMaterial.uniforms.uPressure.value = 0;
  }

  return { squeezeAmount, headPatAmount };
}

const pointer = new THREE.Vector2();
const targetPointer = new THREE.Vector2();

function setPointer(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  targetPointer.x = THREE.MathUtils.clamp(((clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
  targetPointer.y = THREE.MathUtils.clamp(-(((clientY - rect.top) / rect.height) * 2 - 1), -1, 1);
}

canvas.addEventListener('pointermove', (event) => setPointer(event.clientX, event.clientY));
canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture(event.pointerId);
  setPointer(event.clientX, event.clientY);
});
canvas.addEventListener('pointerleave', () => targetPointer.set(0, 0));

let nextBlink = 2.1;
let blinkStarted = -1;

function blinkAmount(time) {
  if (blinkStarted < 0 && time > nextBlink) blinkStarted = time;
  if (blinkStarted < 0) return 0;
  const elapsed = time - blinkStarted;
  if (elapsed > 0.22) {
    blinkStarted = -1;
    nextBlink = time + 2.4 + Math.random() * 3.1;
    return 0;
  }
  return Math.sin((elapsed / 0.22) * Math.PI);
}

function resize() {
  const width = innerWidth;
  const height = innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

addEventListener('resize', resize, { passive: true });
resize();

const clock = new THREE.Clock();

function animate() {
  const time = clock.getElapsedTime();
  const deformation = updateAction(time);
  pointer.lerp(targetPointer, 0.075);
  const blink = blinkAmount(time);

  eyeGroups.forEach((eye, index) => {
    eye.position.x = eye.userData.baseX + pointer.x * 0.012;
    eye.position.y = eye.userData.baseY + pointer.y * 0.01;
    eyeContents[index].scale.y = Math.max(0.055, 1 - blink * 0.945);
  });

  creature.rotation.y = pointer.x * 0.075;
  creature.rotation.x = -pointer.y * 0.035;
  const breathe = prefersReducedMotion ? 1 : 1 + Math.sin(time * 1.35) * 0.012;
  const squeezeX = 1 - deformation.squeezeAmount;
  const squeezeY = 1 + deformation.squeezeAmount * 0.72 - deformation.headPatAmount;
  const squeezeZ = 1 + deformation.squeezeAmount * 0.35 + deformation.headPatAmount * 0.45;
  creature.scale.set(squeezeX / breathe, squeezeY * breathe, squeezeZ / breathe);
  creature.position.y = -0.05 - deformation.headPatAmount * 0.22 + (prefersReducedMotion ? 0 : Math.sin(time * 1.35) * 0.012);

  furMaterial.uniforms.uTime.value = time;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
