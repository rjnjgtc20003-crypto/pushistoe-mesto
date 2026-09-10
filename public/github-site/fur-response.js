// A small persistent comb field, not a full strand/tendon simulator. The hand's
// deformed palmar skin supplies contact; time controls recovery, not contact.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const TURN=0.2;

// Unit-length centreline: turn near the root, then continue along the tangent.
// Unlike shortening the strand, this construction preserves its arc length.
export function bentStrand(along,angle) {
  if(Math.abs(angle)<1e-4)return [along,0];
  const s=Math.min(along,TURN),a=angle*s/TURN,tail=Math.max(0,along-TURN);
  return [TURN*Math.sin(a)/angle+tail*Math.cos(angle),
    TURN*(1-Math.cos(a))/angle+tail*Math.sin(angle)];
}

export class FurResponseField {
  constructor(radii,width=64,height=32) {
    this.width=width;this.height=height;this.count=width*height;
    this.roots=new Float32Array(this.count*3);
    this.normals=new Float32Array(this.count*3);
    this.bend=new Float32Array(this.count*4);
    this.contact=new Float32Array(this.count*4);
    this.activity=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=y*width+x,azimuth=((x+.5)/width-.5)*Math.PI*2,polar=(y+.5)/height*Math.PI;
      const u=[Math.cos(azimuth)*Math.sin(polar),Math.cos(polar),Math.sin(azimuth)*Math.sin(polar)];
      const n=u.map((v,k)=>v/radii[k]),len=Math.hypot(...n);
      for(let k=0;k<3;k++){this.roots[i*3+k]=u[k]*radii[k];this.normals[i*3+k]=n[k]/len;}
    }
    this.reset();
  }
  reset(){
    this.bend.fill(0);this.activity=0;
    for(let i=0;i<this.count;i++){
      let plane=.8;
      for(let k=0;k<3;k++){
        this.contact[i*4+k]=this.normals[i*3+k];
        plane+=this.roots[i*3+k]*this.normals[i*3+k];
      }
      this.contact[i*4+3]=plane;
    }
  }
  update(dt,skinPoints=null,stroke=[1,0,0],palmNormal=[0,1,0]) {
    // Retain the single-palm API for diagnostics and callers of the pet sampler.
    return this.updateContacts(dt,skinPoints?[{points:skinPoints,direction:stroke,normal:palmNormal}]:[]);
  }
  updateContacts(dt,contacts=[]) {
    if(dt<=0)return false;
    if(!contacts.length&&this.activity<1e-5)return false;
    const release=Math.exp(-Math.min(dt,.05)/.28),follow=1-Math.exp(-Math.min(dt,.05)/.045);
    for(const contact of contacts){
      const bounds=contact.bounds??=(new Float32Array(6));
      bounds.set([Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity]);
      for(let j=0;j<contact.points.length;j+=3)for(let k=0;k<3;k++){
        bounds[k]=Math.min(bounds[k],contact.points[j+k]-.55);
        bounds[k+3]=Math.max(bounds[k+3],contact.points[j+k]+.55);
      }
    }
    let activity=0;
    for(let i=0;i<this.count;i++){
      const r=i*3,b=i*4,x=this.roots[r],y=this.roots[r+1],z=this.roots[r+2];
      const nx=this.normals[r],ny=this.normals[r+1],nz=this.normals[r+2];
      let height=.8,influence=0,owner=null;
      for(const contact of contacts){
       const {points:skinPoints,normal:palmNormal,bounds}=contact;
       const cosine=nx*palmNormal[0]+ny*palmNormal[1]+nz*palmNormal[2];
       if(cosine>.18&&x>bounds[0]&&x<bounds[3]&&y>bounds[1]&&y<bounds[4]&&z>bounds[2]&&z<bounds[5]){
        for(let j=0;j<skinPoints.length;j+=3){
          const dx=skinPoints[j]-x,dy=skinPoints[j+1]-y,dz=skinPoints[j+2]-z;
          const h=(dx*palmNormal[0]+dy*palmNormal[1]+dz*palmNormal[2])/cosine;
          if(h<-.025||h>.5)continue;
          const lateral2=(dx-h*nx)**2+(dy-h*ny)**2+(dz-h*nz)**2;
          if(lateral2>.0324)continue;
          const w=1-smooth(.08,.18,Math.sqrt(lateral2));
          const effective=.50+(Math.max(.008,h-.03/cosine)-.50)*w;
          if(effective<height){height=effective;influence=w;owner=contact;}
        }
       }
      }
      let tx=0,ty=0,tz=0;
      if(influence>0){
        const stroke=owner.direction;
        const normalPart=stroke[0]*nx+stroke[1]*ny+stroke[2]*nz;
        tx=stroke[0]-normalPart*nx;ty=stroke[1]-normalPart*ny;tz=stroke[2]-normalPart*nz;
        // A pat pushes radially: lay the coat away from the pad centre instead
        // of treating vertical approach velocity as a tangential brush stroke.
        if(owner.spread){
          const dx=x-owner.center[0],dy=y-owner.center[1],dz=z-owner.center[2];
          const part=dx*nx+dy*ny+dz*nz;
          tx=dx-part*nx+tx*.08;ty=dy-part*ny+ty*.08;tz=dz-part*nz+tz*.08;
        }
        const tangentLength=Math.hypot(tx,ty,tz)||1;
        // Fit the long coat; shorter undercoat uses a smaller turn in the shader.
        const desired=clamp(height/.44,0,1);
        let lo=0,hi=1.67;
        for(let n=0;n<9;n++){const mid=(lo+hi)/2;if(bentStrand(1,mid)[0]>desired)lo=mid;else hi=mid;}
        const angle=(lo+hi)/2;
        tx*=angle/tangentLength;ty*=angle/tangentLength;tz*=angle/tangentLength;
      }
      const targets=[tx,ty,tz];
      for(let k=0;k<3;k++){
        const old=this.bend[b+k];
        this.bend[b+k]=influence>0?old+(targets[k]-old)*follow:old*release;
        if(Math.abs(this.bend[b+k])<1e-6)this.bend[b+k]=0;
        activity=Math.max(activity,Math.abs(this.bend[b+k]));
      }
      this.bend[b+3]=influence;
      // Use the skin's support-plane orientation, not the radial direction of
      // a nearby root: curved strands otherwise cross the actual palm plane.
      const cx=owner?owner.normal[0]:nx,cy=owner?owner.normal[1]:ny,cz=owner?owner.normal[2]:nz;
      this.contact[b]=cx;this.contact[b+1]=cy;this.contact[b+2]=cz;
      this.contact[b+3]=x*cx+y*cy+z*cz+height*(nx*cx+ny*cy+nz*cz);
    }
    this.activity=activity;
    return true;
  }
}
