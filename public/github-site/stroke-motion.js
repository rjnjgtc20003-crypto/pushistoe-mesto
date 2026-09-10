// Two left-to-right passes; the return is an airborne movement, not a backstroke.
export const PASS_DURATION=2.9;
export const RETURN_DURATION=1.65;
export const STROKE_DURATION=2*PASS_DURATION+RETURN_DURATION;
export const CONTACT_IN=.55;
export const CONTACT_OUT=PASS_DURATION-.55;
// Artist-calibrated for the VISIBLE fingertip/cuff extents, not a symmetric
// palm-centre arc and not the user's illustrative degree numbers.
export const START_ANGLE=-.05;
export const END_ANGLE=.405;
const DEPTH=.12;
const clamp=x=>Math.max(0,Math.min(1,x));
export const easeStroke=x=>{const t=clamp(x);return t*t*t*(10+t*(-15+6*t));};
function travelProgress(t){
  const u=clamp(t/PASS_DURATION),ramp=.18;
  const integral=x=>x**4*(2.5-3*x+x*x);
  if(u<ramp)return ramp*integral(u/ramp)/(1-ramp);
  if(u>1-ramp)return 1-ramp*integral((1-u)/ramp)/(1-ramp);
  return (u-ramp/2)/(1-ramp);
}
export function createStrokeSampler(rx,ry,rz){
  const count=256,arc=[0];
  const point=angle=>[rx*Math.sin(angle)*Math.cos(DEPTH),ry*Math.cos(angle)*Math.cos(DEPTH),rz*Math.sin(DEPTH)];
  let previous=point(START_ANGLE);
  for(let i=1;i<=count;i++){
    const next=point(START_ANGLE+(END_ANGLE-START_ANGLE)*i/count);
    arc.push(arc.at(-1)+Math.hypot(...next.map((v,k)=>v-previous[k])));previous=next;
  }
  return seconds=>{
    const t=Math.max(0,Math.min(STROKE_DURATION,seconds));
    const returning=t>PASS_DURATION&&t<PASS_DURATION+RETURN_DURATION;
    const pass=t>=PASS_DURATION+RETURN_DURATION?1:0;
    const local=pass?t-PASS_DURATION-RETURN_DURATION:t;
    const u=(t-PASS_DURATION)/RETURN_DURATION;
    const progress=returning?1-easeStroke((u-.28)/.44):travelProgress(local);
    const distance=progress*arc[count];let low=0,high=count;
    while(high-low>1){const mid=(low+high)>>1;if(arc[mid]<distance)low=mid;else high=mid;}
    const f=(distance-arc[low])/(arc[high]-arc[low]);
    const angle=START_ANGLE+(END_ANGLE-START_ANGLE)*(low+f)/count;
    const root=point(angle),normal=root.map((v,k)=>v/([rx,ry,rz][k]**2));
    const length=Math.hypot(...normal);normal.forEach((v,k)=>normal[k]=v/length);
    const pressure=returning?0:easeStroke(local/CONTACT_IN)*(1-easeStroke((local-CONTACT_OUT)/(PASS_DURATION-CONTACT_OUT)));
    // The load-bearing surface is the body, not the tips of its long coat.
    const clearance=.017+.218*(1-pressure);
    const liftPose=returning?64*u**3*(1-u)**3:0;
    const lift=.48*liftPose;
    const palm=root.map((v,k)=>v+normal[k]*clearance);palm[1]+=lift;
    const tangent=[rx*Math.cos(angle),-ry*Math.sin(angle),0];
    return {root,normal,orientation:normal.slice(),palm,tangent,
      fingerDirection:[-tangent[0],-tangent[1],-.025],pressure,progress,pass,returning,liftPose,
      opacity:easeStroke(t/.22)*(1-easeStroke((t-STROKE_DURATION+.25)/.25))};
  };
}
