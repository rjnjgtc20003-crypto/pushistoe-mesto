// One continuous palm stroke. The saved editor points are a reference only.
export const STROKE_DURATION = 4.2;
const APPROACH = 0.8;
const TRAVEL = 2.6;
const LIFT = 0.8;
const START_ANGLE = -0.56;
const END_ANGLE = 0.60;
const DEPTH = 0.12;
const clamp = (x) => Math.max(0,Math.min(1,x));
export const easeStroke = (x) => {
  const t=clamp(x);
  return t*t*t*(10+t*(-15+6*t));
};

// Invert an arc-length table, not screen-space keyframe intervals. There is no
// acceleration or angular-velocity jump when the phases meet (C2 time easing).
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
    const progress=easeStroke((seconds-APPROACH)/TRAVEL);
    const distance=progress*arc[count];
    let low=0,high=count;
    while(high-low>1) { const mid=(low+high)>>1; if(arc[mid]<distance)low=mid;else high=mid; }
    const fraction=(distance-arc[low])/(arc[high]-arc[low]);
    const angle=START_ANGLE+(END_ANGLE-START_ANGLE)*(low+fraction)/count;
    const root=point(angle);
    const n=[root[0]/(rx*rx),root[1]/(ry*ry),root[2]/(rz*rz)];
    const norm=Math.hypot(...n);const normal=n.map(v=>v/norm);
    const lower=easeStroke(seconds/APPROACH);
    const lift=easeStroke((seconds-APPROACH-TRAVEL)/LIFT);
    const clearance=0.065+0.62*(1-lower)+0.62*lift;
    const pressure=easeStroke((seconds-0.4)/0.4)*(1-easeStroke((seconds-APPROACH-TRAVEL)/0.45));
    return {
      root,normal,
      palm:root.map((v,i)=>v+normal[i]*clearance),
      tangent:[rx*Math.cos(angle),-ry*Math.sin(angle),0],
      pressure,
      opacity:easeStroke(seconds/0.2)*(1-easeStroke((seconds-STROKE_DURATION+0.25)/0.25)),
      progress,
    };
  };
}
