export const rrfK=60;
export function fuse(lexical,semantic,{limit=5,k=rrfK}={}) {
  if(!Number.isFinite(k) || k<=0)throw new Error('RRF k must be positive');
  const map=new Map();
  for(const [method,rows] of [['lexical',lexical],['semantic',semantic]])for(const row of rows){
    if(!Number.isInteger(row.rank) || row.rank<1)throw new Error('Invalid retrieval rank');
    const value=map.get(row.chunkId)??{chunkId:row.chunkId,lexicalRank:null,semanticRank:null,hybridScore:0};
    if(value[method+'Rank']!==null)throw new Error('Duplicate fusion result');
    value[method+'Rank']=row.rank;value.hybridScore+=1/(k+row.rank);map.set(row.chunkId,value);
  }
  return [...map.values()].sort((a,b)=>b.hybridScore-a.hybridScore || a.chunkId.localeCompare(b.chunkId)).slice(0,limit).map((row,i)=>({...row,finalRank:i+1}));
}
