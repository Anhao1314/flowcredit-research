import test from 'node:test';
import assert from 'node:assert/strict';
import {searchSpansLexical,bm25Rows,tokenize,lexicalPolicy} from '../local-retrieval/lexical.js';
import {rankSpansSemantic,fuseSpanRankings,defaultMinSimilarity} from '../local-retrieval/search.js';
import {fuse,rrfK} from '../retrieval/fusion.js';

const rows=[
 {spanId:'SPAN-1',spanHash:'sha256:1',text:'Revenue from United States customers was $ 4,801 million.'},
 {spanId:'SPAN-2',spanHash:'sha256:2',text:'Cost of revenue was $ 879 million for the three months ended June 30, 2026.'},
 {spanId:'SPAN-3',spanHash:'sha256:3',text:'Table of Contents'},
 {spanId:'SPAN-4',spanHash:'sha256:4',text:'We had no material off-balance-sheet arrangements during the period.'}
];
test('span BM25 reuses the audited v0.3 policy and ranks exact term matches first',()=>{
 const results=searchSpansLexical(rows,'revenue united states',{limit:5});
 assert.equal(results[0].spanId,'SPAN-1');
 assert.equal(results[0].rank,1);
 assert.equal(lexicalPolicy.minQueryCoverage,0.6);
 assert.ok(results.every(row=>row.queryCoverage>=lexicalPolicy.minQueryCoverage));
});
test('a query with no covered terms abstains instead of returning noise',()=>{
 assert.deepEqual(searchSpansLexical(rows,'quantum unicorn founding story',{limit:5}),[]);
 assert.deepEqual(searchSpansLexical(rows,'',{limit:5}),[]);
});
test('the tokenizer drops stopwords and the company name like v0.3',()=>{
 assert.deepEqual(tokenize('CoreWeave reported revenue for the company'),['revenue']);
 assert.equal(bm25Rows(rows).avg,rows.reduce((total,row)=>total+tokenize(row.text).length,0)/rows.length);
});
test('semantic ranking applies the v0.3 similarity floor and reports missing vectors',()=>{
 const index={get:(spanId,spanHash)=>spanId==='SPAN-1'?{spanHash,embeddingModel:'m',embeddingModelDigest:'d',dimension:3,vector:[1,0,0]}:null};
 const metadata={model:'m',modelVersion:'d',dimension:3};
 const ranked=rankSpansSemantic({rows:[{spanId:'SPAN-1',spanHash:'sha256:1'},{spanId:'SPAN-2',spanHash:'sha256:2'}],queryVector:[1,0,0],index,metadata,limit:5});
 assert.equal(defaultMinSimilarity,0.3);
 assert.equal(ranked.rows.length,1);
 assert.equal(ranked.rows[0].spanId,'SPAN-1');
 assert.equal(ranked.missing,1);
});
test('a stale vector is skipped, never scored as if it were current',()=>{
 const index={get:()=>({spanHash:'sha256:old',embeddingModel:'m',embeddingModelDigest:'d',dimension:3,vector:[1,0,0]})};
 const ranked=rankSpansSemantic({rows:[{spanId:'SPAN-1',spanHash:'sha256:new'}],queryVector:[1,0,0],index,metadata:{model:'m',modelVersion:'d',dimension:3},limit:5});
 assert.deepEqual(ranked.rows,[]);
 assert.equal(ranked.stale,1);
});
test('span fusion reproduces the v0.3 RRF arithmetic exactly',()=>{
 const lexical=[{spanId:'SPAN-1',rank:1,score:3},{spanId:'SPAN-2',rank:2,score:2}];
 const semantic=[{spanId:'SPAN-2',rank:1,score:0.9},{spanId:'SPAN-3',rank:2,score:0.8}];
 const fused=fuseSpanRankings(lexical,semantic,{limit:5});
 const reference=fuse(lexical.map(row=>({chunkId:row.spanId,rank:row.rank})),semantic.map(row=>({chunkId:row.spanId,rank:row.rank})),{limit:5});
 assert.equal(rrfK,60);
 assert.equal(fused.find(row=>row.spanId==='SPAN-2').hybridScore,1/(rrfK+2)+1/(rrfK+1));
 assert.deepEqual(fused.map(row=>[row.spanId,row.hybridScore]),reference.map(row=>[row.chunkId,row.hybridScore]));
 assert.deepEqual(fused.map(row=>row.spanId),['SPAN-2','SPAN-1','SPAN-3']);
 assert.deepEqual(fuseSpanRankings(lexical,semantic,{limit:5}),fused);
});
test('fusion rejects duplicate ranks from the same method',()=>{
 assert.throws(()=>fuseSpanRankings([{spanId:'a',rank:1,score:1},{spanId:'a',rank:2,score:1}],[],{limit:5}),/Duplicate fusion result/);
});
