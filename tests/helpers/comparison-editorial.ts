import {comparisonIdeasSchema,comparisonEditorialSchema} from '../../src/shorts/comparison-editorial';

export const ideaFixture=()=>comparisonIdeasSchema.parse({schemaVersion:1,selectedId:'familiar-ladder',selectionReason:'The familiar anchor makes this synthetic progression understandable before its largest-object payoff.',concepts:[
  {id:'familiar-ladder',title:'A familiar reference to the extreme',viewerQuestion:'How does a familiar object compare with the largest example?',strategy:'familiar-to-extreme'},
  {id:'surprising-neighbors',title:'Unexpected neighbors on one scale',viewerQuestion:'Which of these familiar objects are unexpectedly close in size?',strategy:'unexpected-neighbors'},
  {id:'hidden-differences',title:'Small differences with a clear purpose',viewerQuestion:'Which subtle differences become clear when these objects share a scale?',strategy:'hidden-differences'},
].map(c=>({...c,audiencePromise:'Use one recognizable reference to make the full synthetic scale progression understandable.',scope:'within-request',scopeReason:'Keep the supplied synthetic objects and height metric; do not expand into unrelated categories.',selectionRule:'Include a useful opening reference, two meaningful bridges, and a final largest-object payoff.',metric:'height',unit:'m',measurementBasis:'Complete object height from the shared ground baseline, without any excluded platform.',visualApproach:'grounded-cutouts',background:{environment:'architecture',reason:'A shared architectural setting connects the complete height-comparison episode.'},candidates:['Reference 0','Reference 1','Reference 2','Reference 3'],openingCandidate:'Reference 0',payoffCandidate:'Reference 3',openingIdea:'Begin with the recognizable smallest reference before revealing larger examples.',payoffIdea:'Finish on the largest supported example and show the full true-scale lineup.',feasibilityNotes:['Use supported orthographic cutouts; source and prepare every asset before rendering.']}))});

export const editorialFixture=(data:{items:{id:string;label?:string}[];sources:{id:string}[]})=>comparisonEditorialSchema.parse({
  conceptId:'familiar-ladder',strategy:'familiar-to-extreme',viewerQuestion:ideaFixture().concepts[0].viewerQuestion,
  throughline:'Use a recognizable anchor and two meaningful intermediate steps to make the largest example relatable.',selectionRule:'Every selected object supplies familiarity, a clear bridge, a useful contrast or the final payoff.',
  opening:{itemId:data.items[0].id,reason:'This recognizable opening establishes the smallest object as the starting reference.'},
  familiarAnchor:{itemId:data.items[0].id,reason:'The opening reference lets viewers relate unfamiliar sizes to something recognizable.'},
  surprisingPair:{smallerId:data.items[1].id,largerId:data.items[2].id,reason:'This neighboring pair changes the perceived scale and gives the transition a specific purpose.'},
  payoff:{itemId:data.items.at(-1)!.id,reason:'The final largest object resolves the starting question on the same measurement scale.'},
  items:data.items.map((item,i)=>({itemId:item.id,role:i===data.items.length-1?'payoff':i===0?'anchor':'bridge',reason:`Selection ${i+1} gives this synthetic progression its ${i===0?'recognizable opening':i===data.items.length-1?'largest-object payoff':`intermediate reference at step ${i+1}`}.`})),
  omittedCandidates:[],conceptAdjustments:(['opening','payoff'] as const).flatMap(role=>{
    const item=role==='opening'?data.items[0]:data.items.at(-1)!,proposed=role==='opening'?'Reference 0':'Reference 3';
    return item.label===proposed?[]:[{role,originalCandidate:proposed,replacementItemId:item.id,reason:'The synthetic fixture uses a different display label for the same planned comparison role.'}];
  }),claim:{kind:'curated',scope:'Curated synthetic examples, not a complete ranking or a claim about world records.',sourceIds:[data.sources[0].id]},
});
