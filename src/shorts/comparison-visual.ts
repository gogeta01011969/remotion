import {z} from 'zod';

export const localAssetPath=z.string().max(240).regex(/^[a-zA-Z0-9][a-zA-Z0-9_./-]*\.(png|webp|jpg|jpeg)$/i).refine(s=>!s.split('/').some(p=>p==='..'||p==='.'),'Use a relative local raster asset path without traversal.');
export const boundsSchema=z.object({x:z.number().nonnegative(),y:z.number().nonnegative(),width:z.number().positive(),height:z.number().positive()}).strict();
const provenance={attribution:z.string().min(1).max(1000),referenceUrls:z.array(z.string().url()).min(1).max(8)};
const calibration=z.object({pixelWidth:z.number().int().positive(),pixelHeight:z.number().int().positive(),bounds:boundsSchema,coverage:z.number().positive().max(1),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict().superRefine((c,ctx)=>{
  if(c.bounds.x+c.bounds.width>c.pixelWidth||c.bounds.y+c.bounds.height>c.pixelHeight||c.pixelWidth*c.pixelHeight>16777216)ctx.addIssue({code:'custom',message:'Calibration bounds must fit the decoded image.'});
});
const generation=z.object({prompt:z.string().min(10).max(2000)}).strict().optional();
export const comparisonVisualSchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('cutout'),src:localAssetPath,view:z.enum(['front','side','top','orthographic']),...provenance,generation,calibration:calibration.optional(),
    // Required for volume comparisons of irregular objects. Ratios refer to
    // the occupied bounding box, not the full padded source image.
    volumeProfile:z.object({depthToHeight:z.number().positive().max(1000),solidFraction:z.number().positive().max(1)}).strict().optional(),
    projection:z.enum(['equal-area','orthographic']).optional(),
  }).strict(),
  z.object({kind:z.literal('sphere'),texture:localAssetPath,emissive:z.boolean().default(false),...provenance,generation,calibration:calibration.optional()}).strict(),
  z.object({kind:z.literal('box'),widthToHeight:z.number().positive().max(1000),depthToHeight:z.number().positive().max(1000),projection:z.enum(['front','isometric']).optional()}).strict(),
]);
export type ComparisonVisual=z.infer<typeof comparisonVisualSchema>;
