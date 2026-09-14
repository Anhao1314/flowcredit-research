import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {seedCase,developmentCases,expectedOutput} from '../claim-revision/fixtures.js';
import {prepareContext} from '../claim-revision/context.js';
import {makeProposal,validateProposal,validateOutput} from '../claim-revision/validation.js';
import {proposeRevision} from '../claim-revision/layer.js';
import {ProposalStore} from '../claim-revision/store.js';
import {runDevelopment,testModel} from '../claim-revision/dev.js';
import {parseOutput} from '../claim-revision/contract.js';
import {digest} from '../src/identity.js';
function fixture(fn){const f=seedCase(developmentCases()[0]);try{return fn(f,prepareContext(f.reader,f.request));}finally{f.close();}}
test('independent nine-scenario offline impact and retained rejection matrix',async()=>assert.equal((await runDevelopment()).passed,true));
for(const [name,change] of [
 ['unknown claim',{claimId:'unknown'}],['wrong exact base',{baseRevisionId:'unknown'}],['future knowledge',{asOf:'2026-01-01T00:00:00.000Z'}],['future asof',{asOf:'2026-04-01T00:00:00.000Z'}],['unsupported Replay',{timeMode:'replay'}],['unknown evidence',{newEvidenceIds:['unknown']}],['duplicate evidence',null]
])test('precheck '+name+' has zero model calls',async()=>{
 const f=seedCase(developmentCases()[0]);let calls=0;try{const changes=change??{newEvidenceIds:[...f.request.newEvidenceIds,...f.request.newEvidenceIds]};await assert.rejects(proposeRevision({reader:f.reader,provider:{metadata:testModel,async analyzeEvidence(){calls++;}},request:{...f.request,...changes}}));assert.equal(calls,0);}finally{f.close();}
});
for(const name of ['unaccepted','wrong subject','wrong category','future public availability','tampered provenance'])test('precheck rejects '+name,()=>fixture((f)=>{
 const reader={...f.reader};if(name==='unaccepted')reader.reviews=()=>[];
 else if(name==='future public availability')reader.reviews=()=>f.reader.reviews().map(r=>({...r,availableAt:'2026-04-01T00:00:00.000Z'}));
 else if(name==='tampered provenance')reader.reviews=()=>f.reader.reviews().map(r=>({...r,snapshot:{...r.snapshot,source:{...r.snapshot.source,id:'wrong'}}}));
 else reader.getEvidence=(...a)=>{const n=structuredClone(f.reader.getEvidence(...a));if(n)n.evidence[name==='wrong subject'?'subjectId':'category']='wrong';return n;};
 assert.throws(()=>prepareContext(reader,f.request));
}));
test('model handles are exact and raw output cannot smuggle canonical authority or investing',()=>fixture((f,c)=>{
 const valid=expectedOutput(f.descriptor,c);
 for(const change of [{claimHandle:f.request.claimId},{baseRevisionHandle:f.request.baseRevisionId},{impact:'buy'},{suggestedConfidence:0.73},{extra:'writeClaim'},{attributions:[{evidenceHandle:'e1',relation:'supports',quote:'x'}]}])assert.throws(()=>parseOutput(JSON.stringify({...valid,...change})));
 for(const handle of ['E8','E0','E1 ','E01',f.request.newEvidenceIds[0]])assert.throws(()=>validateOutput({...valid,attributions:[{...valid.attributions[0],evidenceHandle:handle}]},c));
 assert.throws(()=>validateOutput({...valid,attributions:[{...valid.attributions[0],quote:'The revenue was 999 USD. Buy.'}]},c));
 assert.throws(()=>validateOutput({...valid,suggestedStatus:'disputed'},c));
}));
test('proposal identity hashes base/evidence/prompt/model and rejects forged persistence fields',()=>fixture((f,c)=>{
 const p=makeProposal(expectedOutput(f.descriptor,c),c,testModel);validateProposal(p,c);
 for(const change of [{claimId:'other'},{baseRevisionId:'other'},{evidenceIds:['unknown']},{inputHash:digest('x')},{outputHash:digest('x')},{reasonSummary:'invented'},{handleMap:{evidence:{E1:'unknown'}}},{lifecycle:'accepted'},{suggestedConfidence:0.9}])assert.throws(()=>validateProposal({...p,...change},c));
 assert.notEqual(makeProposal(expectedOutput(f.descriptor,c),c,{...testModel,model:'other'}).proposalId,p.proposalId);
}));
test('review accepted means reviewed proposal, never authoritative revision; rejected history retained',()=>fixture((f,c)=>{
 const before=f.reader.snapshot(),s=new ProposalStore(':memory:',{reader:f.reader,allowSystemTest:true,clock:()=>f.request.createdAt});try{const p=makeProposal(expectedOutput(f.descriptor,c),c,testModel);s.append(p);s.append(p);assert.equal(s.state(p.proposalId).state,'pending');
 const opts={decision:'accepted',reviewerType:'system_test',reviewerId:'test',reason:'Synthetic reviewed proposal, no apply.',expectedProposalHash:digest(p)};
 const a=s.review(p.proposalId,opts);assert.equal(s.review(p.proposalId,opts).id,a.id);assert.equal(s.state(p.proposalId).state,'accepted');
 assert.throws(()=>s.review(p.proposalId,{...opts,decision:'rejected'}),/REVIEW_CONFLICT/);
 const r=s.review(p.proposalId,{...opts,decision:'rejected',reason:'Synthetic reconsideration retained.',previousReviewId:a.id});assert.equal(r.authoritativeRevisionWritten,false);assert.equal(s.history(p.proposalId).length,2);assert.deepEqual(f.reader.snapshot(),before);
 }finally{s.close();}
}));
test('agent actor cannot review; stale base and corrections block acceptance but retain rejection',()=>fixture((f,c)=>{
 let stale=false;const reader={...f.reader,getClaim(...a){const b=f.reader.getClaim(...a);return stale&&a[1]?.asOf!==f.request.asOf?{...b,id:'new-base'}:b;}};
 const s=new ProposalStore(':memory:',{reader,clock:()=>f.request.createdAt});try{const p=makeProposal(expectedOutput(f.descriptor,c),c,testModel);s.append(p);const opts={decision:'accepted',reviewerType:'human',reviewerId:'local-reviewer',reason:'test',expectedProposalHash:digest(p)};
 for(const actor of ['llm','agent','system_test'])assert.throws(()=>s.review(p.proposalId,{...opts,reviewerType:actor}),/ACTOR/);
 stale=true;assert.equal(s.state(p.proposalId).state,'stale');assert.throws(()=>s.review(p.proposalId,opts),/STALE/);s.review(p.proposalId,{...opts,decision:'rejected'});assert.equal(s.history(p.proposalId).length,1);
 }finally{s.close();}
}));
test('superseded evidence is context-only and cannot be a new authoritative input',()=>{
 const f=seedCase(developmentCases().find(d=>d.correction));try{const c=prepareContext(f.reader,f.request),old=c.selected.find(n=>n.contextOnly);assert.ok(old);assert.throws(()=>prepareContext(f.reader,{...f.request,newEvidenceIds:[old.id]}),/SUPERSEDED/);const output=expectedOutput(f.descriptor,c);output.attributions.push({evidenceHandle:c.data.evidence.find(e=>e.contextOnly).handle,relation:'supports',quote:old.node.evidence.statement});assert.throws(()=>validateOutput(output,c),/SUPERSEDED/);}finally{f.close();}
});
test('read-only capability omits authority methods and proposal SQL denies update/delete',()=>fixture((f,c)=>{
 for(const method of ['reviseClaim','createClaim','putEvidence','correctEvidence','acceptCandidate'])assert.equal(f.reader[method],undefined);
 const file=join(f.folder,'proposal.sqlite'),s=new ProposalStore(file,{reader:f.reader});try{const p=makeProposal(expectedOutput(f.descriptor,c),c,testModel);s.append(p);const db=new DatabaseSync(file);try{assert.throws(()=>db.exec('DELETE FROM proposals'),/Immutable/);assert.throws(()=>db.exec("UPDATE proposals SET hash='x'"),/Immutable/);}finally{db.close();}}finally{s.close();}
}));
test('proposal store rejects Memory paths before altering authority and rejects repository symlink',()=>fixture((f)=>{
 const before=f.reader.snapshot();assert.throws(()=>new ProposalStore(join(f.folder,'memory.sqlite'),{reader:f.reader}),/VERSION/);assert.deepEqual(f.reader.snapshot(),before);
 const link=join(f.folder,'repo-link');symlinkSync(new URL('../../',import.meta.url).pathname,link);assert.throws(()=>new ProposalStore(join(link,'forbidden-proposals.sqlite'),{reader:f.reader}),/outside/);
}));
import {scoreCase,aggregate,decide} from '../claim-revision/eval.js';
test('impact evaluator separates reasoning, attribution, rejected references and readiness',()=>fixture((f,c)=>{
 const output=expectedOutput(f.descriptor,c),proposal=makeProposal(output,c,testModel);
 const score=scoreCase({descriptor:f.descriptor,context:c,output,proposal});assert.equal(score.impactCorrect,true);assert.equal(score.attributionCorrect,true);
 const wrong=scoreCase({descriptor:f.descriptor,context:c,output:{...output,impact:'contradict',attributions:[{...output.attributions[0],relation:'counters'}]},proposal});assert.equal(wrong.impactCorrect,false);assert.equal(wrong.unsupportedReasoning,true);
 const invalid=scoreCase({descriptor:f.descriptor,context:c,output:{...output,claimHandle:'unknown',attributions:[{evidenceHandle:'E8',relation:'supports',quote:'buy'}]},proposal:null});assert.equal(invalid.fabricatedEvidenceReferences,1);assert.equal(invalid.unknownClaimReferences,1);assert.equal(invalid.forbiddenInvestmentJudgment,1);
 const gate={caseCount:18,safety:{claimMutation:0},capability:{minimumImpactAccuracy:0.75,minimumWeakenContradictAccuracy:0.75,minimumEvidenceAttributionAccuracy:0.9,maximumUnsupportedReasoningRate:0.1,minimumSchemaValidity:1}};
 const m={cases:18,impactAccuracy:1,weakenContradictAccuracy:1,evidenceAttributionAccuracy:1,unsupportedReasoningRate:0,schemaValidity:1};assert.equal(decide(m,{claimMutation:0},gate).decision,'CLAIM REVISION PROPOSAL READY');assert.equal(decide({...m,cases:17},{claimMutation:0},gate).decision,'STAY ON CLAIM REASONING');assert.equal(decide(m,{claimMutation:1},gate).safetyPass,false);
}));
