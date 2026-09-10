// Artist-tuned gentle gestures, informed by coordinated finger flexion and thumb
// opposition. Degrees here are animation choices, not measured motion capture.
const fingers = ['index', 'middle', 'ring', 'little'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function handPose(gesture, pressure, phase = 0, stroke = 0) {
  const p = clamp(pressure, 0, 1);
  const squeeze = gesture === 'squeeze';
  const pat = gesture === 'head-pat';
  const pose = {};
  fingers.forEach((finger, i) => {
    // Broad palm contact: most conformity comes from the knuckles and palm,
    // with almost straight distal fingers instead of a hooked grasp.
    const wrap = [0.94, 1, 1.04, 1.08][i];
    const pip = (4 + i * 0.7) + p * (squeeze ? 9 : pat ? -1 : 4) * wrap;
    const mcp = (5 + i * 0.8) + p * (squeeze ? 12 : pat ? 3 : 7) * wrap;
    const follow = pat ? 0 : Math.sin(phase * Math.PI * 2 - i * 0.22) * p * 0.6;
    pose[`${finger}_mcp`] = [mcp + follow, 0, [1,0,-1,-2][i] * p];
    pose[`${finger}_pip`] = [pip + follow, 0, 0];
    pose[`${finger}_dip`] = [clamp(pip * 0.64, 0, 42), 0, 0];
    pose[`${finger}_palm`] = [0, [-1,0,3,5][i] * p * (squeeze ? 1 : 0.45), 0];
  });
  // Thumb CMC combines flexion, opposition and axial rotation. It has MCP/IP,
  // not the three identical hinge segments used by the other fingers.
  pose.thumb_cmc = [4 + p * (squeeze ? 8 : 3), -p * (squeeze ? 7 : 3), -p * (squeeze ? 4 : 2)];
  pose.thumb_mcp = [3 + p * (squeeze ? 6 : 2), 0, 0];
  pose.thumb_ip = [2 + p * (squeeze ? 4 : 1), 0, 0];
  pose.wrist = [pat ? -8 + p * 11 : -6 + p * 8, 0, clamp(stroke, -1, 1) * 4];
  pose.forearm = [0, 0, 0];
  if (gesture === 'pet') {
    // Small coordinated changes during the pass, not a fixed pose or a grasp.
    const progress=clamp(phase,0,1);
    const carry=1-.65*clamp(stroke,0,1);
    fingers.forEach((finger,i)=> {
      // A loose airborne hand opens onto the coat. Contact poses vary gently
      // per finger through the pass; distal joints are no longer frozen.
      const follow=Math.sin(Math.PI*clamp(progress-i*.045,0,1));
      const contactMcp=1.1+i*.2+[2.8,2.2,.8,-.5][i]*follow;
      const contactPip=.7+[1.6,1.4,.6,.3][i]*follow;
      const contactDip=.4+[.9,.8,.4,.2][i]*follow;
      pose[`${finger}_mcp`] = [(10+i*.7)*carry*(1-p)+p*contactMcp,0,[2,0,-1,-2][i]*(1-.65*p)];
      pose[`${finger}_pip`] = [(7+i*.3)*carry*(1-p)+p*contactPip,0,0];
      pose[`${finger}_dip`] = [(4+i*.2)*carry*(1-p)+p*contactDip,0,0];
      pose[`${finger}_palm`] = [0,[0,.4,1,1.5][i]*p,0];
    });
    pose.thumb_cmc = [7*(1-p)+p*(3+2*Math.sin(Math.PI*progress)),-3*p,-p];
    pose.thumb_mcp = [4*(1-p)+p*(1.5+progress),0,0];
    pose.thumb_ip = [3-2*p,0,0];
    pose.wrist = [(-14+24*progress)*(1-p)+p*(-7+29*progress),0,2*p*Math.sin(Math.PI*progress)];
  }
  if(pat||squeeze){
    fingers.forEach((finger,i)=>{
      pose[`${finger}_mcp`]=[2+i*.3+p*1.4,0,[1,0,-.5,-1][i]*p];
      pose[`${finger}_pip`]=[1.5+i*.2+p*.4,0,0];
      pose[`${finger}_dip`]=[.7+i*.1,0,0];
      pose[`${finger}_palm`]=[0,[0,.4,1,1.5][i]*p,0];
    });
    pose.thumb_cmc=[3+p*(squeeze?3:2),-3*p,-p];
    pose.thumb_mcp=[2+p,0,0];pose.thumb_ip=[1,0,0];
    pose.wrist=[squeeze?12+12*p:-7+4*p,0,0];
  }
  return pose;
}

export function jointResponse(name) {
  // Small, time-based offsets produce overlap without frame-rate dependency.
  if (name === 'wrist') return 14;
  if (name.startsWith('thumb')) return 12;
  const side = name.startsWith('little') ? 2 : name.startsWith('ring') ? 1 : 0;
  return (name.endsWith('_dip') ? 12 : name.endsWith('_pip') ? 15 : 19) - side;
}
