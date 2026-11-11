import {researchFromCompletion} from '../../src/pipeline/research';
import type {ComparisonDependencies} from '../../src/pipeline/comparison-ideas';
import type {GroqClient} from '../../src/pipeline/groq';
// Adapter for pre-existing editorial unit fixtures; never used by the production
// controller. Bounded network retrieval is exercised separately.
export const mockResearch=(client:Pick<GroqClient,'chat'>):NonNullable<ComparisonDependencies['research']>=>async(options,concept)=>researchFromCompletion(options.topic,'test',await client.chat({model:'test',tools:[{type:'browser_search'}],tool_choice:'required',temperature:0,reasoning_effort:'low',max_completion_tokens:4000,messages:[{role:'system',content:'Synthetic research fixture'},{role:'user',content:JSON.stringify({selectedConcept:concept})}]}));
