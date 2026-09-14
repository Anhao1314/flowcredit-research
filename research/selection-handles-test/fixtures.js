// GOLD-08 replay material, recorded from the v0.11 locked run before this phase
// existed. The v0.11 artifacts are not rewritten and the typo is not "fixed" in
// the model's output: the raw response is kept here so the interface that
// produced it stays testable.
export const gold08={
 caseId:'GOLD-08',
 subjectId:'coreweave',
 page:77,
 session:'session-1789360831087',
 runId:'SUPPORT-1789363345627',
 goldHash:'sha256:c5d78e91272e6b97de36e502a5f5f06b85fa27e20280e8087244f4235a2ae739',
 retrieval:{mode:'hybrid',limit:8},
 candidateCount:52,
 // Frozen retrieval order of the offered Top-8, exactly as the v0.11 receipt
 // recorded it (rank, id, span type).
 offeredSpanIds:[
  'SPAN-ab6a4f2666baf76a412ce7ef',
  'SPAN-d0893e5060fefc32ce53ab25',
  'SPAN-690dd2e0535bfd8b70733765',
  'SPAN-0c00fb823a48bbd7d3ddb6ae',
  'SPAN-c83b19906c4d3d637fdc5537',
  'SPAN-62e029512b0f5661dc59a0be',
  'SPAN-e01cd2a68842fefdfdf652ce',
  'SPAN-240b92c16fd8c32c14f80c98'
 ],
 offeredSpanTypes:['text','text','text','text','table','table','table','table'],
 // The v0.11 response verbatim. The third proposal contains
 // SPAN-e01cd2a68842fefdfdfdf652ce where the offered id is
 // SPAN-e01cd2a68842fefdfdf652ce: one duplicated character group.
 typoResponse:'[{"spanIds":["SPAN-ab6a4f2666baf76a412ce7ef","SPAN-690dd2e0535bfd8b70733765","SPAN-c83b19906c4d3d637fdc5537"],"factKind":"financial_metric"},{"spanIds":["SPAN-ab6a4f2666baf76a412ce7ef","SPAN-690dd2e0535bfd8b70733765","SPAN-62e029512b0f5661dc59a0be"],"factKind":"financial_metric"},{"spanIds":["SPAN-ab6a4f2666baf76a412ce7ef","SPAN-690dd2e0535bfd8b70733765","SPAN-e01cd2a68842fefdfdfdf652ce"],"factKind":"financial_metric"},{"spanIds":["SPAN-ab6a4f2666baf76a412ce7ef","SPAN-690dd2e0535bfd8b70733765","SPAN-240b92c16fd8c32c14f80c98"],"factKind":"financial_metric"}]',
 typoSpanId:'SPAN-e01cd2a68842fefdfdfdf652ce',
 canonicalSpanIdOfTypo:'SPAN-e01cd2a68842fefdfdf652ce',
 expectedHandleOfTypo:'S7'
};
// Synthetic span bodies for the interface tests: the fixture proves what the
// model-facing text looks like, not what the filing said.
export function syntheticSupports({offeredSpanIds=gold08.offeredSpanIds,offeredSpanTypes=gold08.offeredSpanTypes}={}){
 return offeredSpanIds.map((spanId,index)=>offeredSpanTypes[index]==='table'
  ?{type:'table',spanId,tableTitle:'Synthetic table',rowLabel:'Synthetic row',headerPath:['FY2025'],cellText:'1,234',unitContext:{match:'USD millions'}}
 :{type:'text',spanId,text:'Synthetic sentence number '+Number(index+1)+' for the interface test'});
}
