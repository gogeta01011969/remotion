import {deflateSync} from 'node:zlib';

// Small deterministic RGBA fixture encoder; not an image-generation dependency.
export function fixturePng(width:number,height:number,pixel:(x:number,y:number)=>[number,number,number,number]){
  const crc=(data:Buffer)=>{let value=0xffffffff;for(const byte of data){value^=byte;for(let n=0;n<8;n++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;};
  const chunk=(name:string,data:Buffer)=>{const body=Buffer.concat([Buffer.from(name),data]),length=Buffer.alloc(4),sum=Buffer.alloc(4);length.writeUInt32BE(data.length);sum.writeUInt32BE(crc(body));return Buffer.concat([length,body,sum]);};
  const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  const scan=Buffer.alloc(height*(width*4+1));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)scan.set(pixel(x,y),y*(width*4+1)+1+x*4);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
}
