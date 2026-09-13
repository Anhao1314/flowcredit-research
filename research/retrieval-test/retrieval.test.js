import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdtempSync,rmSync,symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseHtml,parseDocument,byteHash } from '../retrieval/parser.js';
import { chunkDocument,chunkPolicy } from '../retrieval/chunker.js';
import { searchLexical,tokenize } from '../retrieval/lexical.js';
import { DeterministicTestProvider,indexEmbeddings,validateProvider } from '../retrieval/semantic.js';
import { fuse } from '../retrieval/fusion.js';
import { RetrievalIndex } from '../retrieval/index.js';
import { RetrievalLayer } from '../retrieval/layer.js';
import { assertRetrieval } from '../retrieval/validation.js';
import { lookupAccepted } from '../retrieval/memory-lookup.js';
import { runRetrievalCli } from '../src/retrieval.js';
import { openMemory } from '../memory/open.js';
import { runAudit } from '../src/coverage.js';
import { fixture,replay,now } from './fixtures.js';
import { digest,stableId } from '../src/identity.js';

const query='customer concentration';
test('HTML faithful extraction is deterministic and preserves numbers/entities/table labels',()=>{
 const html='<h1>Results</h1><table><tr><th>Revenue</th><th>2026</th></tr><tr><td>$2,575 &amp; (49)</td><td>36%</td></tr></table><script>999 fake</script>';
 const a=parseHtml(html);assert.deepEqual(a,parseHtml(html));const text=a.units.map(u=>u.text).join('\n');for(const value of ['$2,575','(49)','36%','Revenue','2026','&'])assert.ok(text.includes(value));assert.ok(!text.includes('999'));assert.ok(a.units.every(u=>u.rawLocator.rawStart>=0 && u.rawLocator.rawEnd<=html.length));
});
test('empty/hidden-only HTML fails rather than fabricating text',()=>assert.throws(()=>parseHtml('<script>Revenue 999</script>'),/No visible/));
test('identical raw content generates stable Document/Chunk IDs',()=>fixture(({a})=>assert.deepEqual(chunkDocument(a),chunkDocument(structuredClone(a)))));
test('chunk raw locators and UTF-16 offsets resolve into exact parsed content',()=>fixture(({a})=>{for(const c of chunkDocument(a)){assert.equal(a.text.slice(c.charStart,c.charEnd),c.text);assert.deepEqual(c.locator.raw,a.units[c.locator.unitIndex].rawLocator);assert.equal(c.contentHash,digest(c.text));}}));
test('chunk maximum length, bounded overlap and section boundaries are explicit',()=>fixture(({add})=>{
 const doc=add('long','<h1>Results</h1><p>'+('Revenue labels 1,234 😀\n'.repeat(700))+'</p><h2>Debt</h2><p>Debt 2,000.</p>');
 const chunks=chunkDocument(doc);assert.ok(chunks.length>2);for(const c of chunks)assert.ok(c.text.length<=chunkPolicy.maxLength);for(let i=1;i<chunks.length;i++)if(chunks[i].locator.unitIndex===chunks[i-1].locator.unitIndex){assert.ok(chunks[i].charStart>chunks[i-1].charStart);assert.ok(chunks[i-1].charEnd-chunks[i].charStart<=chunkPolicy.overlap);assert.ok(!/^[\uDC00-\uDFFF]/.test(chunks[i].text));}
}));
test('changed raw content or parser/chunker/location yields different identity',()=>fixture(({a})=>{
 const b={...a,contentHash:'sha256:'+'f'.repeat(64)};assert.notEqual(chunkDocument(a)[0].id,chunkDocument(b)[0].id);
 const c={...a,parserVersion:'test/v2'};assert.notEqual(chunkDocument(a)[0].id,chunkDocument(c)[0].id);
}));
test('tampered parsed text and unit offsets reject chunk generation',()=>fixture(({a})=>{
 assert.throws(()=>chunkDocument({...a,text:a.text+'fake'}),/hash/);const b=structuredClone(a);b.units[0].charStart++;assert.throws(()=>chunkDocument(b),/offset/);
}));
test('raw Source hash mismatch and secondary Sources reject parsing',()=>fixture(({a})=>{
 const input={source:a.source,filename:a.filename,format:'html',retrievedAt:now,createdAt:now};assert.throws(()=>parseDocument({...input,source:{...a.source,contentHash:'sha256:'+'a'.repeat(64)}}),/hash/);assert.throws(()=>parseDocument({...input,source:{...a.source,isPrimarySource:false}}),/primary/);
}));
test('availability unknown is retained; no publication-date inference',()=>fixture(({add,layer})=>{
 const doc=add('unknown','<p>uniqueunknown revenue</p>',{availableAt:null});assert.equal(doc.availableAt,null);assert.equal(layer.search('uniqueunknown',{...replay}).results.length,0);assert.ok(layer.search('uniqueunknown',{subjectId:'synthetic',asOf:now,timeMode:'audit'}).results.length);
}));
test('invalid availability/time/scope fails parsing',()=>fixture(({a})=>{
 const input={source:a.source,filename:a.filename,format:'html',retrievedAt:now,createdAt:now};
 for(const availability of [{availableAt:'2026-02-30T00:00:00Z',basis:'x',scope:'entire_document',firstPage:1},{availableAt:'2027-01-01T00:00:00Z',basis:'x',scope:'entire_document',firstPage:1},{availableAt:null,basis:'x',scope:'bad',firstPage:1}])assert.throws(()=>parseDocument({...input,availability}));
 assert.throws(()=>parseDocument({...input,createdAt:'2026-01-01T00:00:00Z'}),/before/);
}));
test('lexical baseline recovers expected primary passage and score is not confidence',()=>fixture(({layer,a})=>{
 const r=layer.searchLexical(query,replay);assert.ok(r.results.length);assert.equal(r.results[0].chunk.sourceId,a.sourceId);assert.ok(r.results[0].score>0);assert.equal(r.results[0].confidence,undefined);
}));
test('lexical score uses only eligible corpus statistics, never future/other subjects',()=>fixture(({index,layer})=>{
 const r=layer.searchLexical(query,replay);const chunks=index.list('chunk').filter(c=>c.subjectId==='synthetic' && c.availableAt && c.availableAt<='2026-07-01T23:59:59.999Z');assert.deepEqual(r.results.map(({chunk,...row})=>({chunkId:row.chunkId,score:row.score,rank:row.rank,queryCoverage:row.queryCoverage})),searchLexical(chunks,query));
}));
test('lexical stopwords/empty unknown facts abstain deterministically',()=>fixture(({layer})=>{
 for(const q of ['the and is','quantum unicorn burn reconciliation'])assert.equal(layer.searchLexical(q,replay).status,'insufficient_evidence');assert.deepEqual(tokenize('Revenue, REVENUE 2,575'),['revenue','revenue','2','575']);
}));
test('minimum query coverage prevents a one-word incidental match',()=>fixture(({layer})=>assert.equal(layer.searchLexical('customer quantum unicorn reconciliation',replay).results.length,0)));
test('no provider reports semantic unavailable and hybrid lexical-only',()=>fixture(({layer})=>{
 assert.equal(layer.searchSemantic(query,replay).status,'semantic_unavailable');const hybrid=layer.searchHybrid(query,replay);assert.equal(hybrid.degraded,'lexical_only');assert.ok(hybrid.results.every(r=>r.semanticRank===null));
}));
test('semantic test provider recovers concept synonym without pretending real embeddings',()=>fixture(({index,layer,a})=>{
 indexEmbeddings(index,layer.provider);const r=layer.searchSemantic('sales',replay);assert.equal(r.semanticStatus,'test_provider');assert.ok(r.results.some(row=>row.chunk.sourceId===a.sourceId));assert.equal(r.embeddingMetadata.kind,'test');
},{provider:new DeterministicTestProvider()}));
test('embedding provider dimension/metadata and finite values are validated',()=>fixture(({index})=>{
 assert.throws(()=>validateProvider({embed:()=>[],metadata:{}}),/Invalid/);
 const p=new DeterministicTestProvider();p.embed=()=>[NaN];assert.throws(()=>indexEmbeddings(index,p),/dimension/);assert.equal(index.counts().embedding,0);
}));
test('embedding version change is isolated and repeats never duplicate records',()=>fixture(({index})=>{
 const p=new DeterministicTestProvider();const first=indexEmbeddings(index,p);assert.ok(first.inserted>0);assert.equal(indexEmbeddings(index,p).inserted,0);p.metadata={...p.metadata,embeddingVersion:'test/v2'};assert.equal(indexEmbeddings(index,p).inserted,first.inserted);assert.equal(index.counts().embedding,first.inserted*2);
}));
test('RRF formula and tie order are deterministic',()=>{
 const a=[{chunkId:'A',rank:1},{chunkId:'B',rank:2}],b=[{chunkId:'B',rank:1},{chunkId:'A',rank:2}];const rows=fuse(a,b);assert.equal(rows[0].chunkId,'A');assert.equal(rows[0].hybridScore,1/61+1/62);assert.deepEqual(rows,fuse(a,b));assert.throws(()=>fuse(a,b,{k:0}),/positive/);assert.throws(()=>fuse([...a,a[0]],[]),/Duplicate/);
});
test('hybrid test baseline carries both ranks deterministically',()=>fixture(({index,layer})=>{
 indexEmbeddings(index,layer.provider);assert.deepEqual(layer.searchHybrid(query,replay),layer.searchHybrid(query,replay));assert.ok(layer.searchHybrid(query,replay).results.some(r=>r.lexicalRank && r.semanticRank));
},{provider:new DeterministicTestProvider()}));
for(const mode of ['lexical','semantic','hybrid'])test(mode+' cutoff excludes future Source and wrong subject before scoring',()=>fixture(({index,layer,a,b,other})=>{
 indexEmbeddings(index,layer.provider);const result=layer.search(query,{...replay,mode});assert.ok(result.results.length);assert.ok(result.results.every(r=>r.chunk.sourceId===a.sourceId));assert.ok(!result.results.some(r=>[b.sourceId,other.sourceId].includes(r.chunk.sourceId)));const later=layer.search(query,{...replay,asOf:'2026-08-02',mode});assert.ok(later.results.some(r=>r.chunk.sourceId===b.sourceId));
},{provider:new DeterministicTestProvider()}));
test('candidate creation cannot bypass future cutoff or relevance abstention',()=>fixture(({index,layer,b})=>{
 const future=index.list('chunk').find(c=>c.documentId===b.id && c.text.includes('concentration'));assert.throws(()=>layer.createCandidate(future.id,{...replay,query}),/visible/);const past=layer.search(query,replay).results[0];assert.throws(()=>layer.createCandidate(past.chunkId,{...replay,query:'quantum unicorn'}),/visible/);
}));
test('Audit differs from Replay and requires raw retrieval AND indexing time',()=>fixture(({layer})=>{
 assert.ok(layer.search(query,replay).results.length);assert.equal(layer.search(query,{...replay,timeMode:'audit'}).results.length,0);assert.ok(layer.search(query,{...replay,timeMode:'audit',asOf:now}).results.length);
}));
test('exact cutoff and UTC date-only semantics do not round future availability down',()=>fixture(({layer,b})=>{
 const before=layer.search(query,{...replay,asOf:'2026-07-31T23:59:59.999Z'}),at=layer.search(query,{...replay,asOf:'2026-08-01T00:00:00Z'});assert.ok(!before.results.some(r=>r.chunk.sourceId===b.sourceId));assert.ok(at.results.some(r=>r.chunk.sourceId===b.sourceId));
}));
test('legal candidate validates quote, source, hash and reparsed original address',()=>fixture(({layer})=>{
 const r=layer.search(query,replay),c=layer.createCandidate(r.results[0].chunkId,{...replay,query});assert.equal(c.validationStatus,'valid');assert.deepEqual(layer.validateCandidate(c),{validationStatus:'valid',errors:[]});assert.equal(c.confidence,undefined);assert.equal(c.proposedRawValue,null);
}));
for(const [name,changes,reason] of [['quote',{quotedText:'invented 123'},'quote_not_in_chunk'],['locator',{locator:{fake:true}},'locator_mismatch'],['hash',{contentHash:'sha256:'+'a'.repeat(64)},'content_hash_mismatch'],['subject',{subjectId:'other'},'subject_source_mismatch'],['chunk',{chunkId:'CHUNK-missing'},'chunk_missing'],['time',{asOf:'2026-01-01T00:00:00Z'},'temporal_cutoff']])test('citation rejects illegal '+name,()=>fixture(({layer})=>{
 const c=layer.createCandidate(layer.search(query,replay).results[0].chunkId,{...replay,query});const v=layer.validateCandidate({...c,...changes});assert.equal(v.validationStatus,'invalid');assert.ok(v.errors.includes(reason));
}));
test('original raw bytes changed after indexing invalidates citation',()=>fixture(({layer,a})=>{
 const c=layer.createCandidate(layer.search(query,replay).results[0].chunkId,{...replay,query});writeFileSync(a.filename,'<p>tampered 999</p>');assert.ok(layer.validateCandidate(c).errors.includes('raw_source_hash_mismatch'));
}));
test('candidate repeats are idempotent and invalid quote is never persisted',()=>fixture(({layer,index})=>{
 const id=layer.search(query,replay).results[0].chunkId;const c=layer.createCandidate(id,{...replay,query});assert.equal(layer.createCandidate(id,{...replay,query}).id,c.id);assert.equal(index.counts().candidate,1);assert.equal(layer.createCandidate(id,{...replay,query,quotedText:'fabricated'}).validationStatus,'invalid');assert.equal(index.counts().candidate,1);
}));
test('index repeats preserve first knowledge time and reject availability conflict',()=>fixture(({index,a})=>{
 const before=index.counts();assert.equal(index.indexDocument({...a,retrievedAt:'2026-09-14T12:00:00.000Z',createdAt:'2026-09-14T12:00:00.000Z'}).inserted,false);assert.deepEqual(index.counts(),before);assert.equal(index.get('document',a.id).createdAt,a.createdAt);assert.throws(()=>index.indexDocument({...a,availableAt:'2026-05-01T00:00:00.000Z'}),/conflict/);
}));
test('index and candidates persist across independent reopening',()=>fixture(({folder,index,layer})=>{
 const c=layer.createCandidate(layer.search(query,replay).results[0].chunkId,{...replay,query}),second=new RetrievalIndex(join(folder,'index.sqlite'));try{assert.equal(second.get('candidate',c.id).validationStatus,'valid');assert.equal(second.counts().chunk,index.counts().chunk);}finally{second.close();}
}));
test('repository and symlinked repository index paths reject',()=>{
 const root=fileURLToPath(new URL('../../',import.meta.url)),folder=mkdtempSync(join(tmpdir(),'fc-retrieval-path-'));try{assert.throws(()=>new RetrievalIndex(join(root,'forbidden.sqlite')),/outside/);symlinkSync(root,join(folder,'repo'));assert.throws(()=>new RetrievalIndex(join(folder,'repo','forbidden.sqlite')),/outside/);}finally{rmSync(folder,{recursive:true,force:true});}
});
test('retrieval schemas reject official-Evidence fields and malformed object shapes',()=>fixture(({a})=>{
 assertRetrieval('document',a);assert.throws(()=>assertRetrieval('document',{...a,confidence:0.9}),/schema/);assert.throws(()=>assertRetrieval('chunk',{...chunkDocument(a)[0],charStart:-1}),/schema/);
}));
test('retrieval/candidate operations cannot mutate accepted Memory',()=>fixture(({folder,layer})=>{
 const filename=join(folder,'memory.sqlite'),m=openMemory({filename,clock:()=>now});m.ingest(runAudit('coreweave'));const before=m.counts();m.close();const bytes=byteHash(readFileSync(filename));const read=lookupAccepted(filename,'coreweave',{asOf:now});assert.equal(read.acceptedEvidence.length,32);assert.equal(read.claims.length,4);assert.equal(lookupAccepted(filename,'coreweave',{asOf:'2026-06-30'}).claims.length,0);layer.createCandidate(layer.search(query,replay).results[0].chunkId,{...replay,query});assert.equal(byteHash(readFileSync(filename)),bytes);const again=openMemory({filename,clock:()=>now});try{assert.deepEqual(again.counts(),before);}finally{again.close();}
}));
test('CLI rejects missing query/unknown flags/subject before opening index',()=>{
 for(const args of [['search','coreweave'],['search','unknown','revenue'],['index','coreweave','--bad','x'],['candidate','CHUNK-a'],['search','coreweave','x','--mode','lexical','--mode','hybrid']])assert.throws(()=>runRetrievalCli(args));
});
test('query context rejects malformed dates, empty query and invalid limits/modes',()=>fixture(({layer})=>{
 for(const options of [{...replay,asOf:'2026-02-30'},{...replay,timeMode:'latest'},{...replay,mode:'llm'},{...replay,limit:0}])assert.throws(()=>layer.search(query,options));assert.throws(()=>layer.search('',replay));
}));
test('PDF text layer parses twice identically, preserves page/number addresses, and rejects missing parser',()=>fixture(({folder,a})=>{
 const python=process.env.FC_RETRIEVAL_PYTHON??fileURLToPath(new URL('../../../fc-agent/tools/retrieval-python/bin/python',import.meta.url)),file=join(folder,'synthetic.pdf');
 const create=spawnSync(python,['-c',"import pymupdf,sys; d=pymupdf.open(); p=d.new_page(); p.insert_text((72,72),'Synthetic revenue table: 2,575 USD; (49); 36%'); d.save(sys.argv[1])",file],{encoding:'utf8'});assert.equal(create.status,0,create.stderr);
 const source={...a.source,contentHash:byteHash(readFileSync(file))};
 const input={source,filename:file,format:'pdf',availability:{availableAt:null,basis:'Synthetic only',scope:'entire_document',firstPage:1},retrievedAt:now,createdAt:now,python};
 const parsed=parseDocument(input);assert.deepEqual(parsed,parseDocument(input));assert.equal(parsed.units[0].page,1);for(const value of ['2,575','(49)','36%'])assert.ok(parsed.text.includes(value));assert.equal(chunkDocument(parsed)[0].page,1);assert.throws(()=>parseDocument({...input,python:join(folder,'missing')}),/unavailable/);
}));
test('PDF with no text layer fails explicitly and never activates OCR',()=>fixture(({folder,a})=>{
 const python=process.env.FC_RETRIEVAL_PYTHON??fileURLToPath(new URL('../../../fc-agent/tools/retrieval-python/bin/python',import.meta.url)),file=join(folder,'empty.pdf');
 const create=spawnSync(python,['-c','import pymupdf,sys; d=pymupdf.open(); d.new_page(); d.save(sys.argv[1])',file],{encoding:'utf8'});assert.equal(create.status,0,create.stderr);
 assert.throws(()=>parseDocument({source:{...a.source,contentHash:byteHash(readFileSync(file))},filename:file,format:'pdf',retrievedAt:now,createdAt:now,python}),/No usable text layer/);
}));
test('real eval ground truth preserves reviewed Evidence IDs and includes required categories/negatives',()=>{
 const rows=JSON.parse(readFileSync(new URL('../eval/coreweave/queries.json',import.meta.url))),accepted=runAudit('coreweave'),ids=new Set(accepted.evidence.map(e=>e.id));assert.ok(rows.length>=15 && rows.length<=25);assert.ok(rows.filter(r=>r.expectedEvidenceIds.length).length>=10);for(const row of rows)for(const id of row.expectedEvidenceIds)assert.ok(ids.has(id));assert.ok(rows.some(r=>!r.expected.length));for(const c of ['revenue','customer_concentration','top_customer_concentration','debt','cash_flow','capex','backlog_rpo','liquidity','compute_spend','operating_history','risk_factors'])assert.ok(rows.some(r=>r.category===c));
});
test('index creation schema rejects foreign Memory databases without modification',()=>fixture(({folder})=>{
 const filename=join(folder,'memory.sqlite'),m=openMemory({filename,clock:()=>now});m.ingest(runAudit('coreweave'));m.close();const before=byteHash(readFileSync(filename));assert.throws(()=>new RetrievalIndex(filename),/Not a v0.3/);assert.equal(byteHash(readFileSync(filename)),before);
}));
test('forged parsed text with recomputed hashes still fails original-source reparse',()=>fixture(({a,folder})=>{
 const index=new RetrievalIndex(join(folder,'forged.sqlite'));try{
  const doc=structuredClone(a);doc.text=doc.text.replace('100','999');doc.textHash=digest(doc.text);doc.units=doc.units.map(u=>({...u,text:u.text.replace('100','999')}));index.indexDocument(doc);
  const layer=new RetrievalLayer(index,{clock:()=>now}),result=layer.search(query,replay);const c=layer.createCandidate(result.results[0].chunkId,{...replay,query});assert.equal(c.validationStatus,'invalid');assert.ok(c.errors.includes('original_locator_text_mismatch'));assert.equal(index.counts().candidate,0);
 }finally{index.close();}
}));
test('invalid or forged Source identity rejects parser ingestion',()=>fixture(({a})=>assert.throws(()=>parseDocument({source:{...a.source,id:'SRC-forged'},filename:a.filename,format:'html',retrievedAt:now,createdAt:now}),/identity/)));
test('explicit CLI search and candidate roundtrip preserves lookup separation',()=>fixture(({folder,index,layer})=>{
 const filename=join(folder,'index.sqlite'),cli=fileURLToPath(new URL('../src/retrieval.js',import.meta.url)),r=spawnSync(process.execPath,[cli,'search','coreweave','quantum unicorn','--index',filename,'--as-of','2026-07-01','--time-mode','replay'],{encoding:'utf8',cwd:tmpdir()});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).status,'insufficient_evidence');
 const id=layer.search(query,replay).results[0].chunkId,c=spawnSync(process.execPath,[cli,'candidate',id,'--query',query,'--subject','synthetic','--index',filename,'--as-of','2026-07-01','--time-mode','replay'],{encoding:'utf8',cwd:tmpdir()});assert.equal(c.status,0,c.stderr);assert.equal(JSON.parse(c.stdout).validationStatus,'valid');assert.equal(index.counts().candidate,1);
}));
