// Fixture evaluation only: reports actual calls/outputs, not a model capability claim.
export async function evaluateNegatives(analyst,cases,{asOf,timeMode='replay'}={}){
 let positives=0,returned=0;const rows=[];
 for(const item of cases){const r=await analyst.analyzeChunk(item.chunkId,{subjectId:item.subjectId,asOf,timeMode});if(r.status==='unavailable')return {status:'unavailable',reason:'Real model unavailable'};const fp=r.proposals.length>0;if(fp)positives++;returned+=r.proposals.length;rows.push({id:item.id,inputChunkIds:r.inputChunkIds,returned:r.proposals.length,abstained:r.status==='abstained',provider:r.provider,promptVersion:r.run?.promptVersion});}
 return {status:rows[0]?.provider?.kind==='test'?'mock_evaluation_not_real_model':'real_model_evaluation',negativeChunks:cases.length,falsePositiveRate:cases.length?positives/cases.length:null,returnedProposals:returned,rows};
}
