// One continuous palm stroke. The saved editor points are a reference only.
export const STROKE_DURATION = 4.6;
export const CONTACT_IN = 1.15;
export const CONTACT_OUT = 3.45;
const START_ANGLE = -0.82;
const END_ANGLE = 0.82;
const DEPTH = 0.12;
const clamp = (x) => Math.max(0,Math.min(1,x));
export const easeStroke = (x) => {
  const t=clamp(x);
  return t*t*t*(10+t*(-15+6*t));
};

// Integrate a smooth velocity ramp. The middle of the stroke has constant travel
// speed; only the very beginning/end stop. Lowering/lifting overlap this travel.
function travelProgress(t) {
  const u=clamp(t/STROKE_DURATION),ramp=0.2;
  const integral=x=>x**4*(2.5-3*x+x*x);
  if(u<ramp)return ramp*integral(u/ramp)/(1-ramp);
  if(u>1-ramp)return 1-ramp*integral((1-u)/ramp)/(1-ramp);
  return (u-ramp/2)/(1-ramp);
}

// The same surface curve is used throughout, with a smooth outward envelope.
// There are no joined line/arc segments and no stops at contact or release.
export function createStrokeSampler(rx,ry,rz) {
  const count=256,arc=[0];
  const point=(angle)=>[rx*Math.sin(angle)*Math.cos(DEPTH),ry*Math.cos(angle)*Math.cos(DEPTH),rz*Math.sin(DEPTH)];
  let previous=point(START_ANGLE);
  for(let i=1;i<=count;i++) {
    const next=point(START_ANGLE+(END_ANGLE-START_ANGLE)*i/count);
    arc.push(arc[i-1]+Math.hypot(next[0]-previous[0],next[1]-previous[1]));
    previous=next;
  }
  return (seconds)=> {
    const progress=travelProgress(seconds);
    const distance=progress*arc[count];
    let low=0,high=count;
    while(high-low>1) { const mid=(low+high)>>1; if(arc[mid]<distance)low=mid;else high=mid; }
    const fraction=(distance-arc[low])/(arc[high]-arc[low]);
    const angle=START_ANGLE+(END_ANGLE-START_ANGLE)*(low+fraction)/count;
    const root=point(angle);
    const n=[root[0]/(rx*rx),root[1]/(ry*ry),root[2]/(rz*rz)];
    const norm=Math.hypot(...n);const normal=n.map(v=>v/norm);
    const lower=easeStroke(seconds/CONTACT_IN);
    const lift=easeStroke((seconds-CONTACT_OUT)/(STROKE_DURATION-CONTACT_OUT));
    const clearance=0.045+0.48*(1-lower)+0.48*lift;
    const pressure=easeStroke((seconds-0.35)/0.8)*(1-easeStroke((seconds-CONTACT_OUT)/0.8));
    // Follow the contact surface, not a flatter arc that buries the trailing
    // fingertips and forces the collision guard to lift the entire palm.
    return {
      root,normal,orientation:normal.slice(),
      palm:root.map((v,i)=>v+normal[i]*clearance),
      tangent:[rx*Math.cos(angle),-ry*Math.sin(angle),0],
      pressure,
      opacity:easeStroke(seconds/0.2)*(1-easeStroke((seconds-STROKE_DURATION+0.25)/0.25)),
      progress,
    };
  };
}
