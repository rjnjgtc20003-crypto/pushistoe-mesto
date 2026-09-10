// Shared, bounded cheek deformation for the core, fur roots and palm support.
// Coordinates are on the unit ellipsoid; +Z is the character's front.
export function cheekWeight(x,y,z){
  return Math.exp(-(((Math.abs(x)-.82)/.27)**2+((y+.22)/.36)**2+((z-Math.sqrt(.2792))/.32)**2));
}
export function cheekScale(x,y,z,amount){return 1-.115*amount*cheekWeight(x,y,z);}
export function cheekSurface(point,radii,amount){
  const q=point.map((v,i)=>v/radii[i]),len=Math.hypot(...q);q.forEach((v,i)=>q[i]=v/len);
  const weight=cheekWeight(...q),scale=1-.115*amount*weight;
  const g=[-2*weight*(Math.abs(q[0])-.82)*Math.sign(q[0])/.27**2,
    -2*weight*(q[1]+.22)/.36**2,-2*weight*(q[2]-Math.sqrt(.2792))/.32**2];
  const radial=g.reduce((s,v,i)=>s+v*q[i],0);
  const gradient=g.map((v,i)=>(v-q[i]*radial)/radii[i]);
  const n=q.map((v,i)=>v/radii[i]),nl=Math.hypot(...n);n.forEach((v,i)=>n[i]=v/nl);
  const pdot=point.reduce((s,v,i)=>s+v*n[i],0);
  const normal=n.map((v,i)=>v+gradient[i]*(.115*amount*pdot/scale)),normalLength=Math.hypot(...normal);
  return {position:point.map(v=>v*scale),normal:normal.map(v=>v/normalLength),scale,
    normalShift:gradient.map(v=>v*.115*pdot),dent:.115*weight};
}
export const cheekShader=/* glsl */`
uniform float uCheeks;
uniform vec3 uShapeRadii;
float cheekWeight(vec3 q){
  vec3 d=vec3((abs(q.x)-.82)/.27,(q.y+.22)/.36,(q.z-sqrt(.2792))/.32);
  return exp(-dot(d,d));
}
vec3 cheekNormal(vec3 p){
  vec3 q=normalize(p/uShapeRadii),n=normalize(q/uShapeRadii);
  float w=cheekWeight(q),s=1.0-.115*uCheeks*w;
  vec3 g=-2.0*w*vec3((abs(q.x)-.82)*sign(q.x)/(.27*.27),(q.y+.22)/(.36*.36),(q.z-sqrt(.2792))/(.32*.32));
  g=(g-q*dot(g,q))/uShapeRadii;
  return normalize(n+g*(.115*uCheeks*dot(p,n)/s));
}
`;
