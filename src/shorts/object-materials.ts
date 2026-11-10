// Surface coordinates rotate on a sphere; these are reusable material models,
// not flat ball drawings or generated product photographs.
export const materialProfiles = {
  plain: {shine:.16, gloss:38, tilt:0}, felt: {shine:.025, gloss:8, tilt:.6},
  seam: {shine:.2, gloss:27, tilt:-.3}, panels: {shine:.12, gloss:24, tilt:.22},
  golf: {shine:.13, gloss:38, tilt:.15},
  baseball: {shine:.04, gloss:14, tilt:.4},
  basketball: {shine:.045, gloss:12, tilt:-.25},
} as const;
export type ObjectMaterial = keyof typeof materialProfiles;
type Vec = [number,number,number];
const dot=(a:Vec,b:Vec)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a:Vec,b:Vec):Vec=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a:Vec,b:Vec):Vec=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(a:Vec):Vec=>{const r=Math.hypot(...a);return a.map(n=>n/r) as Vec;};

// Construct 12 pentagons and 20 hexagons by truncating an icosahedron.
export function footballPanels() {
  const phi=(1+Math.sqrt(5))/2, vertices:Vec[]=[];
  for(const a of [-1,1])for(const b of [-phi,phi])vertices.push([0,a,b],[a,b,0],[b,0,a]);
  const adjacent=(i:number,j:number)=>Math.abs(Math.hypot(...sub(vertices[i],vertices[j]))-2)<1e-7;
  const cut=(i:number,j:number)=>unit(vertices[i].map((v,k)=>(2*v+vertices[j][k])/3) as Vec);
  const faces:{normal:Vec;plane:number;black:boolean}[]=[];
  vertices.forEach((vertex,i)=>{const j=vertices.findIndex((_,j)=>adjacent(i,j));const normal=unit(vertex);faces.push({normal,plane:dot(normal,cut(i,j)),black:true});});
  for(let i=0;i<12;i++)for(let j=i+1;j<12;j++)for(let k=j+1;k<12;k++){
    if(!adjacent(i,j)||!adjacent(j,k)||!adjacent(k,i))continue;
    let normal=unit(cross(sub(vertices[j],vertices[i]),sub(vertices[k],vertices[i])));
    if(dot(normal,vertices[i])<0)normal=normal.map(v=>-v) as Vec;
    faces.push({normal,plane:dot(normal,cut(i,j)),black:false});
  }
  return faces;
}
const panels=footballPanels(), cache=new Map<string,ImageData>();
// Staggered spherical rows avoid stretching a flat dot grid at the poles.
// Dimple counts/patterns vary by manufacturer; this is a generic golf ball.
export function golfDimple(latitude:number,longitude:number) {
  let distance=Infinity;
  const row=Math.floor(latitude/Math.PI*18);
  for(let r=Math.max(0,row-1);r<=Math.min(17,row+1);r++){
    const lat=(r+.5)/18*Math.PI, count=Math.max(3,Math.round(36*Math.sin(lat)));
    const spacing=2*Math.PI/count, offset=(r%2)*spacing/2;
    const col=Math.round((longitude-offset)/spacing),lon=col*spacing+offset;
    const cosine=Math.cos(latitude)*Math.cos(lat)+Math.sin(latitude)*Math.sin(lat)*Math.cos(longitude-lon);
    distance=Math.min(distance,Math.acos(Math.max(-1,Math.min(1,cosine))));
  }
  const radius=.072;
  return distance<radius ? (1-(distance/radius)**2)**2 : 0;
}
export function proceduralMap(material:ObjectMaterial,color:string) {
  const key=`${material}-${color}`;if(cache.has(key))return cache.get(key)!;
  const width=1024,height=512, map=new ImageData(width,height);
  const base=[1,3,5].map(offset=>parseInt(color.slice(offset,offset+2),16));
  const longitude=Array.from({length:width},(_,x)=>{const a=(x/width-.5)*Math.PI*2;return {a,s:Math.sin(a),c:Math.cos(a)};});
  for(let y=0;y<height;y++){
    const latitude=y/height*Math.PI, sy=Math.cos(latitude), ring=Math.sin(latitude);
    for(let x=0;x<width;x++){
      const lon=longitude[x], nx=lon.s*ring, nz=lon.c*ring, index=(y*width+x)*4;
      let seed=Math.imul(x+1,374761393)^Math.imul(y+1,668265263);seed=Math.imul(seed^(seed>>>13),1274126177);
      const noise=((seed^(seed>>>16))>>>0)/4294967296-.5;
      let rgb=[...base], grain=noise*(material==='felt'?24:material==='seam'?26:9),height=128;
      if(material==='golf'){
        height=128-100*golfDimple(latitude,lon.a);
        grain=noise*2;
      }
      if(material==='baseball'){
        // One continuous curved seam separates the two leather covers.
        const curve=Math.PI/2+.82*Math.sin(2*lon.a);
        const slope=1.64*Math.cos(2*lon.a);
        const distance=(latitude-curve)/Math.sqrt(1+slope*slope);
        if(Math.abs(distance)<.009)grain-=55;
        const phase=(((lon.a+Math.PI)/(.038*Math.PI))%1+1)%1;
        const stitchDistance=Math.abs(Math.abs(distance)-(.018+phase*.032));
        if(stitchDistance<.006&&phase<.74){rgb=[164,31,35];grain=noise*12;}
        else if(Math.abs(distance)<.06)grain-=8;
        grain+=noise*9;
      }
      if(material==='basketball'){
        // Three great-circle channels form an idealized eight-panel ball.
        const distance=Math.min(Math.abs(sy),Math.abs(nx),Math.abs(nz));
        grain=noise*25+Math.sin(lon.a*220)*Math.sin(latitude*220)*5;
        if(distance<.019){rgb=[28,24,21];grain=noise*5;}
        else if(distance<.029)grain-=26*(1-(distance-.019)/.01);
      }
      if(material==='felt'){
        const distance=Math.abs(latitude-(Math.PI/2+.65*Math.sin(2*lon.a)));
        if(distance<.026){rgb=[241,238,209];grain=noise*10;}
        else if(distance<.04)grain-=24*(1-(distance-.026)/.014);
      }
      if(material==='seam'){
        const d=Math.asin(nx), around=Math.atan2(sy,nz);
        if(Math.abs(d)<.009)grain-=48;
        if(Math.abs(d)<.023&&Math.abs(d)>.012)grain+=18;
        for(const row of [-.085,-.058,-.032,.032,.058,.085]){
          const stitch=((around/.065+(row>0?.35:0))%1+1)%1;
          if(Math.abs(d-row)<.006&&stitch<.62){rgb=[222,209,178];grain=noise*10;}
        }
      }
      if(material==='panels'){
        let best=Infinity, second=Infinity, black=false;
        for(const face of panels){
          const direction=face.normal[0]*nx+face.normal[1]*sy+face.normal[2]*nz;if(direction<=0)continue;
          const distance=face.plane/direction;
          if(distance<best){second=best;best=distance;black=face.black;}else if(distance<second)second=distance;
        }
        const boundary=(second-best)/best;
        rgb=boundary<.003 ? [44,46,47] : black ? [24,29,33] : [228,227,220];
        if(boundary<.009)grain-=12*(1-boundary/.009);
      }
      for(let c=0;c<3;c++)map.data[index+c]=rgb[c]+grain;
      // Alpha is a private height channel; the sphere projector outputs opaque pixels.
      map.data[index+3]=height;
    }
  }
  cache.set(key,map);return map;
}
