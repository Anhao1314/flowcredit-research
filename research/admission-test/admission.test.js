import test from 'node:test';import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';import {join} from 'node:path';import {DatabaseSync} from 'node:sqlite';
import {AdmissionLayer,candidateHash} from '../admission/layer.js';import {factOf} from '../admission/mapping.js';
import {extractEvidence,evidencePayload} from '../src/extract-evidence.js';import {digest,stableId} from '../src/identity.js';
import {openMemory} from '../memory/open.js';import {assertAdmission,rejectionReasons} from '../admission/validation.js';
import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {runAdmissionCli} from '../src/admission.js';import {fixture,now,replay,numericFact} from './fixtures.js';

test('explicit valid review creates formal v0.1 quotation Evidence, no Claims',()=>fixture(({admission,memory,candidate,request})=>{
 const before=memory.counts(),r=admission.acceptCandidate(candidate.id,request);assert.equal(r.outcome,'accepted');const e=memory.getEvidence(r.evidenceId);assert.equal(e.evidence.statement,candidate.quotedText);assert.equal(e.source.source.id,candidate.sourceId);assert.equal(memory.counts().identity,before.identity);assert.equal(memory.counts().revision,before.revision);assertAdmission('review',r.review);
}));
test('same Candidate accept is idempotent with one Review and one Evidence',()=>fixture(({admission,memory,candidate,request})=>{
 const first=admission.acceptCandidate(candidate.id,request),again=admission.acceptCandidate(candidate.id,request);assert.equal(again.evidenceId,first.evidenceId);assert.equal(again.review.id,first.review.id);assert.equal(again.idempotent,true);assert.equal(memory.counts().evidence,1);assert.equal(admission.reviewHistory(candidate.id).reviews.length,1);
}));
test('human actor supported; system_test requires explicit test capability',()=>fixture(({index,memory,candidate,request,clock})=>{
 const layer=new AdmissionLayer(index,memory,{clock});assert.throws(()=>layer.acceptCandidate(candidate.id,request),/reviewer_forbidden/);const r=layer.acceptCandidate(candidate.id,{...request,reviewerType:'human',reviewerId:'local-test-human'});assert.equal(r.review.reviewerType,'human');
}));
for(const actor of ['agent','llm','policy','unknown'])test(actor+' has no Admission authority',()=>fixture(({admission,candidate,request})=>assert.throws(()=>admission.acceptCandidate(candidate.id,{...request,reviewerType:actor}),/reviewer_forbidden/)));
test('explicit hash and human metadata required; quote edits/unknown fields rejected',()=>fixture(({admission,candidate,request})=>{
 for(const changes of [{candidateHash:undefined},{reviewerId:''},{note:''},{subjectId:''},{quotedText:'edit'},{fact:{...numericFact,statement:'edit'}}])assert.throws(()=>admission.acceptCandidate(candidate.id,{...request,...changes}));
}));
test('changed expected Candidate hash is stale and writes nothing',()=>fixture(({admission,candidate,request,memory})=>{
 assert.throws(()=>admission.acceptCandidate(candidate.id,{...request,candidateHash:'sha256:'+'a'.repeat(64)}),/stale_candidate/);assert.equal(memory.counts().evidence,0);assert.equal(admission.reviewHistory(candidate.id).reviews.length,0);
}));
test('raw Source changed after Candidate creation fails acceptance',()=>fixture(({admission,candidate,request,memory,a})=>{
 writeFileSync(a.filename,'<p>changed 999</p>');assert.throws(()=>admission.acceptCandidate(candidate.id,request),/stale_candidate/);assert.equal(memory.counts().source,0);assert.equal(admission.reviewHistory(candidate.id).reviews.length,0);
}));
test('wrong review subject rejects without changing accepted Memory',()=>fixture(({admission,candidate,request,memory})=>{
 assert.throws(()=>admission.acceptCandidate(candidate.id,{...request,subjectId:'other'}),/wrong_subject/);assert.equal(memory.counts().evidence,0);
}));
test('technically valid citation can be rejected for wrong period',()=>fixture(({admission,candidate,request,memory})=>{
 const r=admission.rejectCandidate(candidate.id,{...request,reasonCode:'wrong_period',note:'Synthetic cited passage does not describe requested period.'});assert.equal(r.review.validationSnapshot.validationStatus,'valid');assert.equal(r.review.reasonCode,'wrong_period');assert.equal(r.outcome,'rejected');assert.equal(memory.counts().evidence,0);assert.equal(admission.stats('synthetic').rejected,1);
}));
test('stale Candidate remains queryable as negative research history',()=>fixture(({admission,candidate,request,a})=>{
 writeFileSync(a.filename,'<p>changed</p>');const r=admission.rejectCandidate(candidate.id,{...request,reasonCode:'stale_candidate'});assert.equal(r.review.validationSnapshot.validationStatus,'invalid');const h=admission.reviewHistory(candidate.id);assert.equal(h.candidate.quotedText,candidate.quotedText);assert.equal(h.reviews[0].snapshot.source.id,candidate.sourceId);
}));
for(const reasonCode of rejectionReasons)test('structured rejection reason '+reasonCode,()=>fixture(({admission,candidate,request})=>assert.equal(admission.rejectCandidate(candidate.id,{...request,reasonCode}).review.reasonCode,reasonCode)));
test('reject cannot map Evidence or use arbitrary reasons',()=>fixture(({admission,candidate,request})=>{
 assert.throws(()=>admission.rejectCandidate(candidate.id,{...request,reasonCode:'bad candidate'}),/invalid_reason/);assert.throws(()=>admission.rejectCandidate(candidate.id,{...request,reasonCode:'wrong_unit',fact:numericFact}),/invalid_request/);
}));
test('re-review appends linked event and requires explicit latest Review ID',()=>fixture(({admission,candidate,request,memory,setTime})=>{
 const r=admission.rejectCandidate(candidate.id,{...request,reasonCode:'insufficient_context'});setTime('2026-09-14T12:00:00Z');assert.throws(()=>admission.acceptCandidate(candidate.id,request),/review_conflict/);const accepted=admission.acceptCandidate(candidate.id,{...request,supersedesReviewId:r.review.id});assert.equal(accepted.review.version,2);assert.equal(accepted.review.previousReviewId,r.review.id);assert.equal(admission.reviewHistory(candidate.id).reviews[0].decision,'rejected');assert.equal(memory.counts().evidence,1);
}));
test('later rejection never deletes previous acceptance or Evidence',()=>fixture(({admission,candidate,request,memory,setTime})=>{
 const a=admission.acceptCandidate(candidate.id,request);setTime('2026-09-14T12:00:00Z');admission.rejectCandidate(candidate.id,{...request,reasonCode:'wrong_period',supersedesReviewId:a.review.id});assert.equal(memory.counts().evidence,1);assert.equal(admission.reviewHistory(candidate.id).reviews.length,2);assert.equal(admission.stats('synthetic').rejected,1);
}));
test('different query Candidates for same passage/fact reuse Evidence',()=>fixture(({admission,candidate,request,layer,index,memory})=>{
 const first=admission.acceptCandidate(candidate.id,{...request,fact:numericFact});const next=layer.createCandidate(candidate.chunkId,{...replay,query:'revenue cash flow',mode:'lexical',quotedText:candidate.quotedText});assert.notEqual(next.id,candidate.id);const c=index.get('candidate',next.id);const r=admission.acceptCandidate(c.id,{...request,candidateHash:candidateHash(c),fact:{...numericFact,confidence:0.8}});assert.equal(r.outcome,'already_accepted');assert.equal(r.evidenceId,first.evidenceId);assert.equal(memory.counts().evidence,1);
}));
test('existing manually accepted fact is matched without rewriting its paraphrase',()=>fixture(({admission,memory,candidate,request,a})=>{
 const e=extractEvidence([a.source],[{sourceKey:a.source.metadata.documentKey,...numericFact,statement:'Existing reviewed paraphrase',section:'Original manual section',page:null,location:'Original reviewed locator'}],now)[0];memory.putSource(a.source);memory.putEvidence(e);const r=admission.acceptCandidate(candidate.id,{...request,fact:factOf(e),existingEvidenceId:e.id,reasonCode:'verified_existing_evidence'});assert.equal(r.outcome,'already_accepted');assert.equal(r.evidenceId,e.id);assert.equal(memory.counts().evidence,1);assert.equal(memory.getEvidence(e.id).evidence.statement,'Existing reviewed paraphrase');
}));
test('existing ID cannot force a wrong metric/period/source match',()=>fixture(({admission,candidate,request,memory,a})=>{
 const e=extractEvidence([a.source],[{sourceKey:a.source.metadata.documentKey,...numericFact,statement:'Original',section:'Manual',page:null,location:'Manual'}],now)[0];memory.putSource(a.source);memory.putEvidence(e);for(const fact of [{...numericFact,metric:'wrong'},{...numericFact,periodEnd:'2025-12-30',observedAt:'2025-12-30'}])assert.throws(()=>admission.acceptCandidate(candidate.id,{...request,fact,existingEvidenceId:e.id}),/existing_evidence_mismatch/);
}));
test('explicit numeric normalization is verified and unsupported conversion rejects',()=>fixture(({admission,candidate,request,memory})=>{
 const fact={...numericFact,rawUnit:'USD_millions',normalization:'usd_millions_to_usd'};const r=admission.acceptCandidate(candidate.id,{...request,fact});assert.equal(memory.getEvidence(r.evidenceId).evidence.normalizedValue,100000000);
}));
test('unsupported normalization, fabricated value and contradictory period fail closed',()=>fixture(({admission,candidate,request,memory})=>{
 for(const fact of [{...numericFact,normalization:'fake'},{...numericFact,rawValue:12345},{...numericFact,periodEnd:'2026-01-01',observedAt:'2025-12-31'},{...numericFact,rawUnit:'USD_millions',unit:'percent'}])assert.throws(()=>admission.acceptCandidate(candidate.id,{...request,fact}));assert.equal(memory.counts().evidence,0);
}));
test('four knowledge times remain distinct and as-of does not backdate admission',()=>fixture(({admission,memory,candidate,request,setTime})=>{
 setTime('2026-09-14T12:00:00Z');const r=admission.acceptCandidate(candidate.id,request);assert.equal(r.review.availableAt,candidate.availableAt);assert.equal(r.review.candidateCreatedAt,candidate.createdAt);assert.equal(r.review.reviewedAt,'2026-09-14T12:00:00.000Z');assert.equal(r.review.acceptedAt,r.review.recordedAt);assert.equal(memory.getEvidence(r.evidenceId,{asOf:now}),null);assert.equal(admission.reviewHistory(candidate.id,{asOf:now}).reviews.length,0);
}));
test('review before Candidate creation cannot leak future data',()=>fixture(({admission,candidate,request,setTime})=>{
 setTime('2026-07-01T12:00:00Z');assert.throws(()=>admission.acceptCandidate(candidate.id,request),/temporal_invalid/);
}));
test('deep provenance retains immutable Review/Candidate/Chunk/Document/Source',()=>fixture(({admission,candidate,request})=>{
 const r=admission.acceptCandidate(candidate.id,request),p=admission.deepProvenance(r.evidenceId);assert.equal(p.admissions[0].review.id,r.review.id);assert.equal(p.admissions[0].candidate.id,candidate.id);assert.equal(p.admissions[0].chunk.id,candidate.chunkId);assert.equal(p.admissions[0].source.id,candidate.sourceId);assert.equal(p.admissions[0].document.sourceId,candidate.sourceId);
}));
test('Review and fact-link SQL UPDATE/DELETE are blocked',()=>fixture(({admission,candidate,request,folder})=>{
 admission.acceptCandidate(candidate.id,request);const db=new DatabaseSync(join(folder,'memory.sqlite'));try{assert.throws(()=>db.exec("UPDATE admission_reviews SET payload='{}'"),/Immutable/);assert.throws(()=>db.exec('DELETE FROM admission_reviews'),/Immutable/);assert.throws(()=>db.exec('DELETE FROM admission_fact_links'),/Immutable/);assert.equal(db.prepare('PRAGMA user_version').get().user_version,2);}finally{db.close();}
}));
test('Review append and Evidence rollback share one transaction on append failure',()=>fixture(({index,memory,candidate,request,clock})=>{
 const real=memory.backend.admissionRecords.bind(memory.backend);memory.backend.admissionRecords=()=>({...real(),append:()=>{throw new Error('Simulated durable review failure');}});const layer=new AdmissionLayer(index,memory,{clock,allowSystemTest:true});assert.throws(()=>layer.acceptCandidate(candidate.id,request),/durable review failure/);assert.equal(memory.counts().source,0);assert.equal(memory.counts().evidence,0);
}));
test('accepted Evidence can be corrected while Admission history remains intact',()=>fixture(({admission,memory,candidate,request,a,setTime})=>{
 const r=admission.acceptCandidate(candidate.id,{...request,fact:numericFact}),old=memory.getEvidence(r.evidenceId).evidence;setTime('2026-09-14T12:00:00Z');const next=extractEvidence([a.source],[{sourceKey:a.source.metadata.documentKey,...numericFact,rawUnit:'USD_millions',normalization:'usd_millions_to_usd',statement:'Explicit synthetic unit correction',section:old.section,page:old.page,location:old.location}],'2026-09-14T12:00:00Z')[0];memory.correctEvidence(old.id,next,{correctionReason:'unit_extraction_error',note:'Synthetic correction after original review.'});assert.equal(admission.deepProvenance(old.id).admissions[0].review.id,r.review.id);assert.equal(admission.deepProvenance(old.id).corrections.length,1);assert.equal(admission.deepProvenance(next.id).supersessionAdmissions[0].review.id,r.review.id);assert.equal(memory.counts().revision,0);
}));
test('queue filters state/query/source/date/method/validation and reports workflow counts',()=>fixture(({admission,candidate,request})=>{
 assert.equal(admission.listCandidates('synthetic',{queryId:candidate.queryId,sourceId:candidate.sourceId,retrievalMethod:'lexical',validationState:'valid',state:'pending'}).length,1);assert.equal(admission.listCandidates('other').length,0);admission.rejectCandidate(candidate.id,{...request,reasonCode:'not_material'});assert.equal(admission.listCandidates('synthetic',{state:'pending'}).length,0);assert.deepEqual(admission.stats('synthetic'),{pending:0,accepted:0,rejected:1,stale:0});
}));
test('pending invalid raw content is stale workflow, not a quality score',()=>fixture(({admission,a})=>{writeFileSync(a.filename,'<p>changed</p>');assert.equal(admission.stats('synthetic').stale,1);}));
test('completed review persists after reopen and supports original Memory API',()=>fixture(({admission,candidate,request,folder,index,clock})=>{
 const r=admission.acceptCandidate(candidate.id,request),m=openMemory({filename:join(folder,'memory.sqlite'),clock});try{const layer=new AdmissionLayer(index,m,{clock});assert.equal(layer.reviewHistory(candidate.id).reviews[0].id,r.review.id);assert.equal(m.getEvidence(r.evidenceId).source.source.id,candidate.sourceId);}finally{m.close();}
}));
test('CLI requires human authority and rejects batch/unknown/quote editing options',()=>{
 for(const args of [['accept','C'],['accept','C','--reviewer','system_test'],['accept','C','--quote','edit'],['accept-all','synthetic'],['reject','C','--bad','x']])assert.throws(()=>runAdmissionCli(args));
});
test('final TOCTOU validation rolls back Evidence when raw bytes change during admission',()=>fixture(({admission,memory,candidate,request,a})=>{
 const put=memory.putEvidence.bind(memory);memory.putEvidence=e=>{const row=put(e);writeFileSync(a.filename,'<p>changed during reviewed write</p>');return row;};assert.throws(()=>admission.acceptCandidate(candidate.id,request),/stale_candidate/);assert.equal(memory.counts().evidence,0);assert.equal(memory.counts().source,0);assert.equal(admission.reviewHistory(candidate.id).reviews.length,0);
}));
test('Candidate payload mutation is caught even if storage facade hides hash corruption',()=>fixture(({index,memory,candidate,request,clock})=>{
 const get=index.get.bind(index);index.get=(kind,id)=>{const value=get(kind,id);return kind==='candidate' && id===candidate.id?{...value,quotedText:'edited quote'}:value;};const layer=new AdmissionLayer(index,memory,{clock,allowSystemTest:true});assert.throws(()=>layer.acceptCandidate(candidate.id,request),/stale_candidate/);assert.equal(memory.counts().evidence,0);
}));
test('invalid locator/quote cannot be accepted with a recomputed candidate hash',()=>fixture(({index,memory,candidate,request,clock})=>{
 const get=index.get.bind(index),fake={...candidate,locator:{invalid:true}};index.get=(kind,id)=>kind==='candidate' && id===candidate.id?fake:get(kind,id);const layer=new AdmissionLayer(index,memory,{clock,allowSystemTest:true});assert.throws(()=>layer.acceptCandidate(candidate.id,{...request,candidateHash:candidateHash(fake)}),/stale_candidate|citation_invalid/);assert.equal(memory.counts().evidence,0);
}));
test('same Candidate cannot silently change mapping after accepted review',()=>fixture(({admission,candidate,request})=>{
 admission.acceptCandidate(candidate.id,{...request,fact:numericFact});assert.throws(()=>admission.acceptCandidate(candidate.id,{...request,fact:{...numericFact,confidence:0.8}}),/review_conflict/);
}));
test('clock regression after a rejection fails without appending review',()=>fixture(({admission,candidate,request,setTime})=>{
 setTime('2026-09-14T12:00:00Z');const r=admission.rejectCandidate(candidate.id,{...request,reasonCode:'other'});setTime('2026-09-13T13:00:00Z');assert.throws(()=>admission.rejectCandidate(candidate.id,{...request,reasonCode:'wrong_unit',supersedesReviewId:r.review.id}),/clock/);assert.equal(admission.reviewHistory(candidate.id).reviews.length,1);
}));
test('explicit re-review cannot remap an accepted Candidate to a different fact',()=>fixture(({admission,candidate,request})=>{
 const r=admission.acceptCandidate(candidate.id,{...request,fact:numericFact});assert.throws(()=>admission.acceptCandidate(candidate.id,{...request,supersedesReviewId:r.review.id,fact:{...numericFact,metric:'other_metric'}}),/mapping_conflict/);
}));
test('historical queue never projects a later raw-file failure into old workflow state',()=>fixture(({admission,candidate,a})=>{
 writeFileSync(a.filename,'<p>later changed</p>');assert.equal(admission.listCandidates('synthetic',{asOf:now})[0].state,'pending');assert.equal(admission.listCandidates('synthetic')[0].state,'stale');
}));
test('unknown public availability may be admitted in Audit and remains unknown in lineage',()=>fixture(({admission,index,layer,add,memory,request})=>{
 const doc=add('unknown-admission','<p>unknown admission revenue 42</p>',{availableAt:null}),c=layer.createCandidate(index.list('chunk').find(x=>x.documentId===doc.id).id,{query:'unknown admission revenue',subjectId:'synthetic',asOf:now,timeMode:'audit',mode:'lexical'});const r=admission.acceptCandidate(c.id,{...request,candidateHash:candidateHash(index.get('candidate',c.id))});assert.equal(r.review.availableAt,null);assert.equal(memory.getEvidence(r.evidenceId).source.source.id,doc.sourceId);assert.equal(layer.search('unknown admission revenue',{...replay,asOf:now}).results.length,0);
}));
test('Record clock and actual Memory clock can differ without backdating acceptance',()=>fixture(({index,memory,candidate,request})=>{
 let tick=Date.parse(now);const clock=()=>new Date(tick++).toISOString();memory.clock=clock;const layer=new AdmissionLayer(index,memory,{clock,allowSystemTest:true});const r=layer.acceptCandidate(candidate.id,request);assert.ok(r.review.reviewedAt<=r.review.evidenceMemoryCreatedAt);assert.ok(r.review.evidenceMemoryCreatedAt<=r.review.acceptedAt);assert.equal(layer.reviewHistory(candidate.id,{asOf:r.review.reviewedAt}).reviews.length,0);
}));
test('rejection retry is idempotent and old retry cannot override a later event',()=>fixture(({admission,candidate,request,setTime})=>{
 const options={...request,reasonCode:'wrong_unit'},r=admission.rejectCandidate(candidate.id,options);assert.equal(admission.rejectCandidate(candidate.id,options).review.id,r.review.id);setTime('2026-09-14T12:00:00Z');admission.rejectCandidate(candidate.id,{...request,reasonCode:'other',supersedesReviewId:r.review.id});assert.throws(()=>admission.rejectCandidate(candidate.id,options),/review_conflict/);
}));
test('same normalized fact across different Candidates keeps first Evidence confidence',()=>fixture(({admission,candidate,request,index,layer,memory})=>{
 const r=admission.acceptCandidate(candidate.id,{...request,fact:numericFact}),c=layer.createCandidate(candidate.chunkId,{...replay,query:'cash flow 100',mode:'lexical'}),next=admission.acceptCandidate(c.id,{...request,candidateHash:candidateHash(index.get('candidate',c.id)),fact:{...numericFact,confidence:0.5}});assert.equal(next.evidenceId,r.evidenceId);assert.equal(memory.getEvidence(r.evidenceId).evidence.confidence,0.9);
}));
test('concurrent explicit test admissions serialize to one Evidence and one Review',()=>fixture(({folder,candidate,request,admission,memory})=>{
 const root=fileURLToPath(new URL('../../',import.meta.url)),code=`import {RetrievalIndex} from ${JSON.stringify(root+'research/retrieval/index.js')};import {openMemory} from ${JSON.stringify(root+'research/memory/open.js')};import {AdmissionLayer} from ${JSON.stringify(root+'research/admission/layer.js')};const index=new RetrievalIndex(process.argv[1]),memory=openMemory({filename:process.argv[2],clock:()=>${JSON.stringify(now)}});try{const layer=new AdmissionLayer(index,memory,{clock:()=>${JSON.stringify(now)},allowSystemTest:true});const r=layer.acceptCandidate(${JSON.stringify(candidate.id)},${JSON.stringify(request)});console.log(JSON.stringify({evidenceId:r.evidenceId,reviewId:r.review.id}));}finally{memory.close();index.close();}`;
 const python=process.env.FC_RETRIEVAL_PYTHON??root+'../fc-agent/tools/retrieval-python/bin/python',runner="import subprocess,sys,json; cmd=[sys.argv[1],'--input-type=module','-e',sys.argv[2],sys.argv[3],sys.argv[4]]; ps=[subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True) for _ in range(2)]; outs=[p.communicate() for p in ps]; assert all(p.returncode==0 for p in ps),outs; print(json.dumps([json.loads(o[0]) for o in outs]))";
 const result=spawnSync(python,['-c',runner,process.execPath,code,join(folder,'index.sqlite'),join(folder,'memory.sqlite')],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.stderr);const rows=JSON.parse(result.stdout);assert.deepEqual(rows[0],rows[1]);assert.equal(memory.counts().evidence,1);assert.equal(admission.reviewHistory(candidate.id).reviews.length,1);
}));
test('CLI human-labelled fixture roundtrip is explicit, with no system_test switch',()=>fixture(({folder,candidate,request})=>{
 const cli=fileURLToPath(new URL('../src/admission.js',import.meta.url)),paths=['--index',join(folder,'index.sqlite'),'--db',join(folder,'memory.sqlite')];
 const run=(...args)=>{const result=spawnSync(process.execPath,[cli,...args,...paths],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);};
 const accepted=run('accept',candidate.id,'--subject','synthetic','--candidate-hash',request.candidateHash,'--reviewer','human','--reviewer-id','unit-fixture-human-label','--reason','verified_primary_source','--note','Explicit unit CLI fixture; not an actual person review.');assert.equal(accepted.outcome,'accepted');assert.equal(run('review-history',candidate.id).reviews.length,1);assert.equal(run('deep-provenance',accepted.evidenceId).admissions[0].candidate.id,candidate.id);
}));
