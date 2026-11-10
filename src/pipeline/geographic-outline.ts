type Position=number[];
export type GeographicGeometry={type:'Polygon';coordinates:Position[][]}|{type:'MultiPolygon';coordinates:Position[][][]};

// Lambert cylindrical equal-area projection. One projection/scale for all
// vertices, including holes and detached islands; never stretch x/y to fit.
export function geographicOutline(geometry:GeographicGeometry,color:string){
  if(!/^#[a-fA-F0-9]{6}$/.test(color))throw new Error('Use a hexadecimal outline color.');
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  const points=polygons.flat(2);
  if(!points.length||points.some(p=>p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[1])>90))throw new Error('Invalid geographic coordinates.');
  const longitudes=points.map(p=>p[0]);
  if(Math.max(...longitudes)-Math.min(...longitudes)>180)throw new Error('Split/unwrap antimeridian geometry before projecting.');
  const center=(Math.min(...longitudes)+Math.max(...longitudes))/2;
  const latitudes=points.map(p=>p[1]);
  const parallel=(Math.min(...latitudes)+Math.max(...latitudes))/2;
  const cosine=Math.cos(parallel*Math.PI/180);
  if(cosine<1e-8)throw new Error('Use a polar equal-area projection at the poles.');
  const project=([lon,lat]:Position)=>[(lon-center)*Math.PI/180*cosine,-Math.sin(lat*Math.PI/180)/cosine];
  const projected=points.map(project),xs=projected.map(p=>p[0]),ys=projected.map(p=>p[1]);
  const minX=Math.min(...xs),minY=Math.min(...ys),w=Math.max(...xs)-minX,h=Math.max(...ys)-minY;
  if(w<=0||h<=0)throw new Error('Geographic outline has no area.');
  const scale=920/Math.max(w,h),width=Math.ceil(w*scale+80),height=Math.ceil(h*scale+80);
  const path=polygons.map(rings=>rings.map(ring=>ring.map((p,i)=>{const [x,y]=project(p);return `${i?'L':'M'}${(40+(x-minX)*scale).toFixed(3)},${(40+(y-minY)*scale).toFixed(3)}`;}).join(' ')+'Z').join(' ')).join(' ');
  return {width,height,path,scale,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="land" x2=".8" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#335D62"/></linearGradient></defs><path d="${path}" fill="url(#land)" fill-rule="evenodd"/></svg>`};
}
