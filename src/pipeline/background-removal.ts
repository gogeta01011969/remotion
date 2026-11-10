import path from 'node:path';
export function cutoutBackend(requested:string,platform=process.platform){
  if(!['auto','vision','rembg'].includes(requested))throw new Error('Choose auto, vision or rembg for background removal.');
  const backend=requested==='auto'?(platform==='darwin'?'vision':'rembg'):requested;
  if(backend==='vision'&&platform!=='darwin')throw new Error('Vision requires macOS; use rembg on Linux.');
  return backend as 'vision'|'rembg';
}
export function cutoutMethod(backend:'vision'|'rembg',model:string){
  if(!['isnet-general-use','u2net'].includes(model))throw new Error('Only local isnet-general-use and u2net cutout models are supported.');
  return backend==='vision'?'macOS Vision foreground extraction':`rembg-2.0.87/${model}/CPU`;
}
export function removalCommand(root:string,python:string,batchPath:string,model:string){
  cutoutMethod('rembg',model);
  return {command:python,args:[path.join(root,'scripts/remove-image-background.py'),'--batch',batchPath,'--model',model]};
}
