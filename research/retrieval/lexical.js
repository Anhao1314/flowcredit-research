export const lexicalVersion='bm25/v1';
export const lexicalPolicy={k1:1.2,b:0.75,minQueryCoverage:0.6,minScore:0.05};
const stop=new Set('a an and are as at be by did do does for from how in is it of on or reported reports the to was were what when which with company coreweave'.split(' '));
export function tokenize(text){return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu)??[]).filter(token=>!stop.has(token));}
export function searchLexical(chunks,query,{limit=5}={}) {
  const terms=[...new Set(tokenize(query))];if(!terms.length || !chunks.length)return [];
  const corpus=chunks.map(chunk=>{const tokens=tokenize(chunk.text),tf=new Map();for(const t of tokens)tf.set(t,(tf.get(t)??0)+1);return {chunk,tf,length:tokens.length};});
  const avg=corpus.reduce((n,row)=>n+row.length,0)/corpus.length || 1;
  const df=new Map(terms.map(t=>[t,corpus.filter(row=>row.tf.has(t)).length]));
  return corpus.map(row=>{
    const matched=terms.filter(t=>row.tf.has(t)),coverage=matched.length/terms.length;
    let score=0;
    for(const t of matched){const f=row.tf.get(t),idf=Math.log(1+(corpus.length-df.get(t)+0.5)/(df.get(t)+0.5));score+=idf*f*(lexicalPolicy.k1+1)/(f+lexicalPolicy.k1*(1-lexicalPolicy.b+lexicalPolicy.b*row.length/avg));}
    return {chunkId:row.chunk.id,score,queryCoverage:coverage};
  }).filter(row=>row.queryCoverage>=lexicalPolicy.minQueryCoverage && row.score>=lexicalPolicy.minScore).sort((a,b)=>b.score-a.score || a.chunkId.localeCompare(b.chunkId)).slice(0,limit).map((row,i)=>({...row,rank:i+1}));
}
