import {writeFileSync} from 'node:fs';
import {z} from 'zod';
import {sizeDatasetSchema} from '../src/shorts/size-data';
import {briefSchema} from '../src/shorts/schema';

writeFileSync('shorts/brief.schema.json', JSON.stringify(z.toJSONSchema(briefSchema), null, 2) + '\n');
console.log('Exported shorts/brief.schema.json. Runtime validation also checks actor references and cue ordering.');

writeFileSync('comparisons/dataset.schema.json', JSON.stringify(z.toJSONSchema(sizeDatasetSchema), null, 2) + '\n');
console.log('Exported comparisons/dataset.schema.json.');
