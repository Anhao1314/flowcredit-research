import {tokenize,lexicalPolicy,lexicalVersion} from '../retrieval/lexical.js';

// BM25 over SourceSupports. The scoring policy, tokenizer and thresholds are the
// audited v0.3 policy imported unchanged; only the retrieval unit changes: the
// candidates are v0.8/v0.9 spans instead of v0.3 chunks.
export {tokenize,lexicalPolicy,lexicalVersion};
export const spanLexicalVersion='span-bm25/v1';
export function bm25Rows(rows){
 const corpus=rows.map(row=>{
  const tokens=tokenize(row.text),tf=new Map();
  for(const token of tokens)tf.set(token,(tf.get(token)??0)+1);
  return {row,tf,length:tokens.length};
 });
 return {corpus,avg:corpus.reduce((total,entry)=>total+entry.length,0)/corpus.length||1};
}
export function searchSpansLexical(rows,query,{limit=5,policy=lexicalPolicy}={}){
 const terms=[...new Set(tokenize(query))];
 if(!terms.length||!rows.length)return [];
 const {corpus,avg}=bm25Rows(rows);
 const documentFrequency=new Map(terms.map(term=>[term,corpus.filter(entry=>entry.tf.has(term)).length]));
 return corpus.map(entry=>{
  const matched=terms.filter(term=>entry.tf.has(term)),coverage=matched.length/terms.length;
  let score=0;
  for(const term of matched){
   const frequency=entry.tf.get(term),idf=Math.log(1+(corpus.length-documentFrequency.get(term)+0.5)/(documentFrequency.get(term)+0.5));
   score+=idf*frequency*(policy.k1+1)/(frequency+policy.k1*(1-policy.b+policy.b*entry.length/avg));
  }
  return {spanId:entry.row.spanId,score,queryCoverage:coverage};
 }).filter(row=>row.queryCoverage>=policy.minQueryCoverage&&row.score>=policy.minScore)
  .sort((a,b)=>b.score-a.score||a.spanId.localeCompare(b.spanId))
  .slice(0,limit).map((row,index)=>({...row,rank:index+1}));
}
