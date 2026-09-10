import * as THREE from 'https://esm.sh/three@0.180.0';
import { createHandMesh, articulateHand, HAND_SCALE } from './hand-rig.js';
import { placePalm, supportPalm, readContactSurface } from './palm-contact.js';
import { createStrokeSampler, STROKE_DURATION } from './stroke-motion.js';
import { FurResponseField } from './fur-response.js';
import { sampleContactGesture } from './contact-gestures.js';

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

const interactionRig = new THREE.Group();
interactionRig.rotation.order = 'YXZ';
scene.add(interactionRig);

const creature = new THREE.Group();
creature.position.y = -0.05;
interactionRig.add(creature);

const radii = new THREE.Vector3(0.88, 0.82, 0.76);
const blackBody = new THREE.Color(0x10090d);
const redBody = new THREE.Color(0x7c071d);
const cherryBody = new THREE.Color(0x4b0717);
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
const hairLeans = [];
const hairShades = [];
const hairPattern = [];
const golden = Math.PI * (3 - Math.sqrt(5));
const lowPowerDevice = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
  || (navigator.deviceMemory && navigator.deviceMemory <= 4);
const hairCount = lowPowerDevice ? 28000 : 36000;

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
  hairLengths.push(undercoat ? 0.78 + 0.2 * wave : 1.08 + 0.34 * wave);
  hairWidths.push((undercoat ? 0.82 : 0.68) + 0.2 * (0.5 + 0.5 * Math.cos(i * 7.31)));
  hairLeans.push(0.34 + 0.66 * (hashB - Math.floor(hashB)));
  hairShades.push(0.5 + 0.5 * Math.sin(i * 5.173 + y * 2.9));
  hairPattern.push(THREE.MathUtils.smoothstep(redPattern, 0.34, 0.7));
}

const baseHair = new THREE.ConeGeometry(0.0026, 0.34, 3, 7, false);
baseHair.translate(0, 0.17, 0);
// More samples near the curved root, with no additional radial faces.
for(let i=0;i<baseHair.attributes.position.count;i++){
  const a=baseHair.attributes.position.getY(i)/.34;
  baseHair.attributes.position.setY(i,.34*Math.pow(Math.max(0,a),1.35));
}
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
furGeometry.setAttribute('aLean', new THREE.InstancedBufferAttribute(new Float32Array(hairLeans), 1));
furGeometry.setAttribute('aShade', new THREE.InstancedBufferAttribute(new Float32Array(hairShades), 1));
const hairRedAttribute = new THREE.InstancedBufferAttribute(new Float32Array(hairPattern), 1);
hairRedAttribute.setUsage(THREE.DynamicDrawUsage);
furGeometry.setAttribute('aRed', hairRedAttribute);
furGeometry.instanceCount = hairCount;
furGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.45);

const furResponse=new FurResponseField(radii.toArray());
function createCombTexture(){
  const texture=new THREE.DataTexture(new Uint16Array(furResponse.count*4),furResponse.width,furResponse.height,THREE.RGBAFormat,THREE.HalfFloatType);
  texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.wrapS=THREE.RepeatWrapping;
  texture.needsUpdate=true;
  return texture;
}
const combTexture=createCombTexture(),combContactTexture=createCombTexture();
function uploadCombField(){
  for(let i=0;i<furResponse.bend.length;i++){
    combTexture.image.data[i]=THREE.DataUtils.toHalfFloat(furResponse.bend[i]);
    combContactTexture.image.data[i]=THREE.DataUtils.toHalfFloat(furResponse.contact[i]);
  }
  combTexture.needsUpdate=combContactTexture.needsUpdate=true;
}
uploadCombField();

const furMaterial = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: {
    uTime: { value: 0 },
    uReducedMotion: { value: prefersReducedMotion ? 1 : 0 },
    uBodyRadii: { value: radii.clone() },
    uGradientMode: { value: 0 },
    uComb: { value: combTexture },
    uCombContact: { value: combContactTexture },
  },
  vertexShader: `
    uniform float uTime;
    uniform float uReducedMotion;
    uniform vec3 uBodyRadii;
    uniform float uGradientMode;
    uniform sampler2D uComb;
    uniform sampler2D uCombContact;
    attribute vec3 aOffset;
    attribute vec3 aNormal;
    attribute float aPhase;
    attribute float aLength;
    attribute float aWidth;
    attribute float aLean;
    attribute float aShade;
    attribute float aRed;
    varying float vRed;
    varying float vLight;
    varying float vAlong;
    varying float vShade;
    varying float vRim;

    void main() {
      vec3 n = normalize(aNormal);
      vec3 helper = abs(n.y) < 0.88 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      vec3 tangent = normalize(cross(n, helper));
      vec3 bitangent = normalize(cross(n, tangent));
      float along = clamp(position.y / 0.34, 0.0, 1.0);
      float tip = along * along;
      float motion = 1.0 - uReducedMotion;
      float sway = sin(uTime * 1.18 + aPhase) * 0.021 * tip * motion;
      float crossSway = cos(uTime * 0.91 + aPhase * 0.67) * 0.013 * tip * motion;
      float longHair = smoothstep(0.72, 1.04, aLength);
      vec3 p = aOffset + n * position.y * aLength;
      p += tangent * (position.x * aWidth + sway);
      p += bitangent * (position.z * aWidth + crossSway);
      p += (tangent * sin(aPhase) + bitangent * cos(aPhase)) * aLean * tip * aLength * 0.035;
      vec3 unitRoot=normalize(aOffset/uBodyRadii);
      vec2 combUv=vec2(atan(unitRoot.z,unitRoot.x)/6.28318530718+0.5,acos(clamp(unitRoot.y,-1.0,1.0))/3.14159265359);
      vec4 comb=texture2D(uComb,combUv);
      vec3 lean=comb.xyz-n*dot(comb.xyz,n);
      float angle=length(lean)*mix(0.86,1.0,longHair);
      if(angle>0.0001){
        vec3 combDirection=normalize(lean);
        float turn=0.2;
        float a=angle*min(along,turn)/turn;
        float tail=max(0.0,along-turn);
        float normalLength=turn*sin(a)/angle+tail*cos(angle);
        float tangentLength=turn*(1.0-cos(a))/angle+tail*sin(angle);
        p+=aLength*0.34*(n*(normalLength-along)+combDirection*tangentLength);
      }
      // Conservative local contact plane interpolated from posed skin samples.
      // It only guards current contact; the comb field retains the released bend.
      vec4 coatSupport=texture2D(uCombContact,combUv);
      vec3 coatNormal=normalize(coatSupport.xyz);
      p-=coatNormal*max(0.0,dot(p,coatNormal)-coatSupport.w);
      // Body and roots use the same soft ellipsoid transform. A second,
      // shader-only cheek dent would detach the coat from its support surface.
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      vRed = aRed;
      vAlong = along;
      vShade = aShade;
      vec3 worldRoot = (modelMatrix * vec4(aOffset, 1.0)).xyz;
      vRim = 1.0 - abs(dot(n, normalize(cameraPosition - worldRoot)));
      vLight = 0.52 + 0.48 * max(0.0, dot(n, normalize(vec3(-0.7, 0.8, 1.0))));
    }
  `,
  fragmentShader: `
    uniform float uGradientMode;
    varying float vRed;
    varying float vLight;
    varying float vAlong;
    varying float vShade;
    varying float vRim;

    void main() {
      vec3 blackFur = vec3(0.022, 0.006, 0.012);
      vec3 redFur = mix(vec3(0.48, 0.008, 0.055), vec3(0.23, 0.006, 0.038), uGradientMode);
      vec3 redSheen = mix(vec3(0.085, 0.01, 0.02), vec3(0.038, 0.005, 0.012), uGradientMode);
      vec3 color = mix(blackFur, redFur, vRed) * vLight;
      color *= mix(0.7, 1.06, smoothstep(0.03, 0.7, vAlong));
      color *= mix(0.92, 1.08, vShade);
      color += mix(vec3(0.012, 0.008, 0.011), redSheen, vRed)
        * pow(vRim, 2.4) * (0.18 + 0.34 * vAlong);
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
  const selectedRedBody = mode === 3 ? cherryBody : redBody;

  furMaterial.uniforms.uGradientMode.value = mode === 3 ? 1 : 0;

  for (let i = 0; i < hairCount; i += 1) {
    const x = hairOffsets[i * 3];
    const y = hairOffsets[i * 3 + 1];
    const verticalGradient = THREE.MathUtils.smoothstep(y / radii.y, -0.92, 0.92);
    hairColors[i] = mode === 1 ? hairPattern[i] : mode === 2 ? (x < 0 ? 1 : 0) : verticalGradient;
  }
  hairRedAttribute.needsUpdate = true;

  for (let i = 0; i < bodyPositions.count; i += 1) {
    const x = bodyPositions.getX(i);
    const y = bodyPositions.getY(i);
    const redness = mode === 1 ? 0 : mode === 2 ? (x < 0 ? 1 : 0) : THREE.MathUtils.smoothstep(y, -0.92, 0.92);
    color.copy(blackBody).lerp(selectedRedBody, redness);
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

const browGroup = new THREE.Group();
creature.add(browGroup);
const browUnderlayMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x080307,
  roughness: 0.7,
  clearcoat: 0.08,
});
const browMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x050204,
  roughness: 0.56,
  clearcoat: 0.16,
  clearcoatRoughness: 0.58,
  emissive: 0x120208,
  emissiveIntensity: 0.14,
});
const browHairGeometry = new THREE.ConeGeometry(0.0054, 0.066, 5, 2, false);
browHairGeometry.translate(0, 0.033, 0);
const browUp = new THREE.Vector3(0, 1, 0);
const browMatrix = new THREE.Matrix4();
const browQuaternion = new THREE.Quaternion();
const browScale = new THREE.Vector3();

function browRandom(index, seed) {
  const value = Math.sin((index + seed * 41.7) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function makeBrow(points, seed) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const underlay = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.011, 6, false), browUnderlayMaterial);
  underlay.position.z = -0.004;
  browGroup.add(underlay);

  const hairTotal = 38;
  const hairs = new THREE.InstancedMesh(browHairGeometry, browMaterial, hairTotal);
  for (let index = 0; index < hairTotal; index += 1) {
    const t = (index + 0.25) / hairTotal;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const lift = (browRandom(index, seed) - 0.5) * 0.19;
    const direction = tangent.clone().addScaledVector(browUp, lift).normalize();
    point.x += (browRandom(index + 73, seed) - 0.5) * 0.018;
    point.y += (browRandom(index + 151, seed) - 0.5) * 0.014;
    point.z += (browRandom(index + 227, seed) - 0.5) * 0.012;
    browQuaternion.setFromUnitVectors(browUp, direction);
    browScale.set(0.82 + browRandom(index + 19, seed) * 0.38, 0.76 + browRandom(index + 37, seed) * 0.5, 1);
    browMatrix.compose(point, browQuaternion, browScale);
    hairs.setMatrixAt(index, browMatrix);
  }
  hairs.instanceMatrix.needsUpdate = true;
  browGroup.add(hairs);
}

makeBrow([
  new THREE.Vector3(-0.52, 0.48, 1.278),
  new THREE.Vector3(-0.36, 0.53, 1.296),
  new THREE.Vector3(-0.13, 0.59, 1.282),
], 1);
makeBrow([
  new THREE.Vector3(0.52, 0.48, 1.278),
  new THREE.Vector3(0.36, 0.53, 1.296),
  new THREE.Vector3(0.13, 0.59, 1.282),
], 2);

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
  color: 0xe8b39b,
  roughness: 0.62,
  clearcoat: 0.1,
  clearcoatRoughness: 0.76,
  sheen: 0.16,
  sheenColor: new THREE.Color(0xffd8c9),
  sheenRoughness: 0.82,
});
function createHand(source, mirrored = false) {
  const hand = new THREE.Group();
  const wristPivot = new THREE.Group();
  const handPose = new THREE.Group();
  const model = createHandMesh(source, skinMaterial.clone());
  model.userData.mesh.material.transparent = true;
  handPose.add(model);
  const wristToRight = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const palmToSide = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI * 0.46);
  handPose.quaternion.copy(palmToSide).multiply(wristToRight);
  wristPivot.add(handPose);
  hand.add(wristPivot);
  hand.scale.set(mirrored ? -HAND_SCALE : HAND_SCALE, HAND_SCALE, HAND_SCALE);
  hand.userData.model = model;
  hand.userData.wristPivot = wristPivot;
  hand.userData.mirrored = mirrored;
  hand.visible = false;
  interactionRig.add(hand);
  return hand;
}

function poseHand(hand, pressure, phase = 0, stroke = 0, snap = false) {
  articulateHand(hand.userData.model, actionState?.id ?? 'pet', pressure,
    phase, stroke, handFrameDelta, snap);
}

function setActionButton(id) {
  actionButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.action === id)));
}

function playAction(id) {
  const animation = animations.get(id);
  if (!animation || !leftHand || !rightHand || actionState?.id === id) return;
  // Keep released fur memory when changing gestures; each palm owns its contact.
  actionState = { id, animation, startedAt: clock.getElapsedTime() };
  poseHand(leftHand, 0, 0, 0, true);
  poseHand(rightHand, 0, 0, 0, true);
  leftHand.userData.supportOffset=rightHand.userData.supportOffset=0;
  leftHand.userData.model.userData.mesh.material.opacity = id === 'pet' ? 0 : 1;
  rightHand.userData.model.userData.mesh.material.opacity = 1;
  leftHand.visible = true;
  rightHand.visible = id === 'squeeze';
  setActionButton(id);
  navigator.vibrate?.(id === 'squeeze' ? [8, 28, 8] : 9);
}

actionButtons.forEach((button) => button.addEventListener('click', () => playAction(button.dataset.action)));

async function loadHandsAndAnimations() {
  const [source, pet, headPat, squeeze] = await Promise.all([
    fetch('./assets/hand-rig.json').then((response) => {
      if (!response.ok) throw new Error('Hand rig could not be loaded');
      return response.json();
    }),
    fetch('./assets/pet.json').then((response) => response.json()),
    fetch('./assets/head-pat.json').then((response) => response.json()),
    fetch('./assets/squeeze.json').then((response) => response.json()),
  ]);
  leftHand = createHand(source, false);
  rightHand = createHand(source, true);
  animations.set('pet', pet);
  animations.set('head-pat', headPat);
  animations.set('squeeze', squeeze);
  // Compile before enabling the buttons. A real offscreen draw also uploads
  // geometry and bone textures; compilation alone does not warm those resources.
  await Promise.all([
    renderer.compileAsync(leftHand,camera,scene),
    renderer.compileAsync(rightHand,camera,scene),
  ]);
  const warmTarget=new THREE.WebGLRenderTarget(32,32);
  const previousTarget=renderer.getRenderTarget();
  leftHand.visible=true;
  rightHand.visible=true;
  renderer.setRenderTarget(warmTarget);
  renderer.render(scene,camera);
  renderer.setRenderTarget(previousTarget);
  leftHand.visible=false;
  rightHand.visible=false;
  warmTarget.dispose();
  // Warm the canvas-output shader variant too, with a tiny scissored draw.
  renderer.setScissor(0,0,1,1);
  renderer.setScissorTest(true);
  leftHand.visible=true;
  rightHand.visible=true;
  renderer.render(scene,camera);
  renderer.setScissorTest(false);
  leftHand.visible=false;
  rightHand.visible=false;
  renderer.render(scene,camera);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  actionButtons.forEach((button) => { button.disabled = false; });
}

loadHandsAndAnimations().catch((error) => console.error('Не удалось загрузить анимации', error));

const palmFacing = new THREE.Vector3();
const strokePalmTarget = new THREE.Vector3();
const strokeNormal = new THREE.Vector3();
const strokePalmCenter = new THREE.Vector3();
const scaledBodyRadii = new THREE.Vector3();
const samplePalmStroke = createStrokeSampler(radii.x,radii.y,radii.z);
const contactPalms=[];
const contactNormal=new THREE.Vector3();

// Sample the same morph + skinned surface the renderer draws. Keep each hand's
// normal, footprint and spread direction separate; do not merge opposing palms.
function collectPalmContact(hand,direction,spread=false) {
  const count=hand.userData.model.userData.furSamples.length;
  const contact=hand.userData.coatContact??={
    points:new Float32Array(count*3),normal:[0,1,0],direction:[1,0,0],center:[0,0,0],
  };
  readContactSurface(hand,contact.points);
  for(let i=0;i<contact.points.length;i+=3){
    contact.points[i]=(contact.points[i]-creature.position.x)/creature.scale.x;
    contact.points[i+1]=(contact.points[i+1]-creature.position.y)/creature.scale.y;
    contact.points[i+2]=(contact.points[i+2]-creature.position.z)/creature.scale.z;
  }
  contactNormal.copy(palmFacing).negate().multiply(creature.scale).normalize().toArray(contact.normal);
  contactNormal.copy(strokePalmCenter).sub(creature.position).divide(creature.scale).toArray(contact.center);
  for(let i=0;i<3;i++)contact.direction[i]=direction[i];
  contact.spread=spread;
  contactPalms.push(contact);
}

function positionContactPalm(hand,target,normal,pressure,phase,direction,spread) {
  hand.scale.set(hand.userData.mirrored?-HAND_SCALE:HAND_SCALE,HAND_SCALE,HAND_SCALE);
  poseHand(hand,pressure,phase);
  strokePalmTarget.fromArray(target).multiply(creature.scale).add(creature.position);
  strokeNormal.fromArray(normal).divide(creature.scale).normalize();
  placePalm(hand,strokePalmTarget,strokeNormal,strokePalmCenter,palmFacing);
  scaledBodyRadii.copy(radii).multiply(creature.scale);
  supportPalm(hand,creature.position,scaledBodyRadii,strokeNormal,strokePalmCenter,palmFacing,handFrameDelta);
  collectPalmContact(hand,direction,spread);
}

let handFrameDelta = 1 / 60;
let previousHandTime = 0;
function updateAction(time) {
  handFrameDelta=Math.min(.05,Math.max(0,time-previousHandTime));
  previousHandTime=time;
  let squeezeAmount=0,cheekSqueeze=0,headPatAmount=0;
  contactPalms.length=0;
  if(actionState){
    const {id,startedAt}=actionState,elapsed=Math.max(0,time-startedAt);
    let duration;
    if(id==='pet'){
      const stroke=samplePalmStroke(elapsed);
      duration=STROKE_DURATION;
      updateCreatureForm(time,{squeezeAmount:0,headPatAmount:0});
      positionContactPalm(leftHand,stroke.palm,stroke.orientation,stroke.pressure,stroke.progress,stroke.tangent,false);
      leftHand.userData.model.userData.mesh.material.opacity=stroke.opacity;
    }else{
      const gesture=sampleContactGesture(id,elapsed,radii.toArray());
      duration=gesture.duration;
      squeezeAmount=gesture.squeeze;
      cheekSqueeze=id==='squeeze'?gesture.pressure:0;
      headPatAmount=gesture.pat;
      updateCreatureForm(time,{squeezeAmount,headPatAmount});
      gesture.palms.forEach((p,i)=>{
        const hand=i===0?leftHand:rightHand;
        const target=p.root.map((v,k)=>v+p.normal[k]*p.clearance);
        positionContactPalm(hand,target,p.normal,gesture.pressure,elapsed/duration,p.direction,true);
        hand.userData.model.userData.mesh.material.opacity=gesture.opacity;
      });
    }
    if(elapsed>=duration){
      leftHand.visible=rightHand.visible=false;
      actionState=null;setActionButton(null);
      squeezeAmount=cheekSqueeze=headPatAmount=0;
      contactPalms.length=0;
    }
  }
  if(furResponse.updateContacts(handFrameDelta,contactPalms))uploadCombField();
  return {squeezeAmount,cheekSqueeze,headPatAmount};
}

const pointer = new THREE.Vector2();
const targetPointer = new THREE.Vector2();
const activePointers = new Map();
let dragPointerId = null;
let lastDragX = 0;
let lastDragY = 0;
let lastPinchDistance = 0;
let targetRigRotationX = 0;
let targetRigRotationY = 0;
let rigVelocityX = 0;
let rigVelocityY = 0;
let targetCameraZ = camera.position.z;

function setPointer(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  targetPointer.x = THREE.MathUtils.clamp(((clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
  targetPointer.y = THREE.MathUtils.clamp(-(((clientY - rect.top) / rect.height) * 2 - 1), -1, 1);
}

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture(event.pointerId);
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  canvas.classList.add('is-dragging');
  setPointer(event.clientX, event.clientY);
  if (activePointers.size === 1) {
    dragPointerId = event.pointerId;
    lastDragX = event.clientX;
    lastDragY = event.clientY;
  } else {
    const [first, second] = [...activePointers.values()];
    lastPinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
  }
});

canvas.addEventListener('pointermove', (event) => {
  setPointer(event.clientX, event.clientY);
  if (!activePointers.has(event.pointerId)) return;
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (activePointers.size === 1 && dragPointerId === event.pointerId) {
    const deltaX = event.clientX - lastDragX;
    const deltaY = event.clientY - lastDragY;
    targetRigRotationY += deltaX * 0.009;
    targetRigRotationX = THREE.MathUtils.clamp(targetRigRotationX + deltaY * 0.007, -0.72, 0.72);
    rigVelocityY = prefersReducedMotion ? 0 : deltaX * 0.0018;
    rigVelocityX = prefersReducedMotion ? 0 : deltaY * 0.0014;
    lastDragX = event.clientX;
    lastDragY = event.clientY;
  } else if (activePointers.size >= 2) {
    const [first, second] = [...activePointers.values()];
    const pinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
    if (lastPinchDistance > 0) {
      targetCameraZ = THREE.MathUtils.clamp(targetCameraZ - (pinchDistance - lastPinchDistance) * 0.012, 6.5, 9.6);
    }
    lastPinchDistance = pinchDistance;
  }
});

function finishPointer(event) {
  activePointers.delete(event.pointerId);
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);

  if (activePointers.size === 0) {
    dragPointerId = null;
    lastPinchDistance = 0;
    canvas.classList.remove('is-dragging');
    if (event.pointerType === 'touch') targetPointer.set(0, 0);
    return;
  }

  if (activePointers.size === 1) {
    const [remainingId, remaining] = [...activePointers.entries()][0];
    dragPointerId = remainingId;
    lastDragX = remaining.x;
    lastDragY = remaining.y;
    lastPinchDistance = 0;
  }
}

canvas.addEventListener('pointerup', finishPointer);
canvas.addEventListener('pointercancel', finishPointer);
canvas.addEventListener('pointerleave', () => {
  if (activePointers.size === 0) targetPointer.set(0, 0);
});

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
  // Keep a useful horizontal viewing angle for the larger hand on portrait phones.
  camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(31)/2)*Math.max(1,0.95/camera.aspect)));
  camera.updateProjectionMatrix();
}

addEventListener('resize', resize, { passive: true });
resize();

const clock = new THREE.Clock();

function updateCreatureForm(time,deformation) {
  const breathe = prefersReducedMotion ? 1 : 1 + Math.sin(time * 1.35) * 0.012;
  const squeezeX = 1 - deformation.squeezeAmount;
  const squeezeY = 1 + deformation.squeezeAmount * 0.72 - deformation.headPatAmount;
  const squeezeZ = 1 + deformation.squeezeAmount * 0.35 + deformation.headPatAmount * 0.45;
  creature.scale.set(squeezeX / breathe, squeezeY * breathe, squeezeZ / breathe);
  creature.position.y = -0.05 - deformation.headPatAmount * 0.22 + (prefersReducedMotion ? 0 : Math.sin(time * 1.35) * 0.012);
}

function animate() {
  const time = clock.getElapsedTime();
  const deformation = updateAction(time);
  pointer.lerp(targetPointer, 0.075);
  const blink = blinkAmount(time);

  eyeGroups.forEach((eye, index) => {
    eye.position.x = eye.userData.baseX * (1 - deformation.cheekSqueeze * 0.1) + pointer.x * 0.012;
    eye.position.y = eye.userData.baseY + deformation.cheekSqueeze * 0.022 + pointer.y * 0.01;
    eyeContents[index].scale.x = 1 - deformation.cheekSqueeze * 0.055;
    eyeContents[index].scale.y = Math.max(0.055, (1 - blink * 0.945) * (1 + deformation.cheekSqueeze * 0.075));
  });

  browGroup.scale.x = 1 - deformation.cheekSqueeze * 0.09;
  browGroup.scale.y = 1 + deformation.cheekSqueeze * 0.025;
  mouth.scale.x = 1 - deformation.cheekSqueeze * 0.24;
  mouth.scale.y = 1 + deformation.cheekSqueeze * 0.1;
  mouth.position.y = -0.19 + deformation.cheekSqueeze * 0.012;

  if (activePointers.size === 0 && !prefersReducedMotion) {
    targetRigRotationX = THREE.MathUtils.clamp(targetRigRotationX + rigVelocityX, -0.72, 0.72);
    targetRigRotationY += rigVelocityY;
    rigVelocityX *= 0.91;
    rigVelocityY *= 0.91;
  }
  interactionRig.rotation.x += (targetRigRotationX - interactionRig.rotation.x) * 0.14;
  interactionRig.rotation.y += (targetRigRotationY - interactionRig.rotation.y) * 0.14;
  camera.position.z += (targetCameraZ - camera.position.z) * 0.14;
  camera.lookAt(0, 0, 0);
  updateCreatureForm(time,deformation);

  furMaterial.uniforms.uTime.value = time;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
