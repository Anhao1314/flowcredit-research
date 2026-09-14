import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {digest} from '../../research/src/identity.js';
import {conformanceReport,historicalSnapshot,isSemantic,readGate,readMaintenance,fileHash} from '../../research/claim-revision/conformance.js';

const gate=readGate(),maintenance=readMaintenance(),registered=gate.frozenHashes,hash=value=>'sha256:'+value.repeat(64).slice(0,64);
const withDrift=(overrides,contents)=>conformanceReport({current:{...registered,...overrides},contents});

test('historical snapshot replays from the registered commit, byte for byte',()=>{
 const snapshot=historicalSnapshot(registered,{commit:maintenance.parentPhaseGate.frozenSourceCommit});
 assert.equal(snapshot.paths,maintenance.parentPhaseGate.frozenPaths);
 assert.equal(snapshot.verified,snapshot.paths);
 assert.deepEqual(snapshot.mismatches,[]);
 assert.equal(digest(registered),maintenance.parentPhaseGate.frozenSetDigest);
 assert.equal(digest(gate),maintenance.parentPhaseGate.gateHash);
});

test('live tree is semantically conformant while repository drift stays observable',()=>{
 const probePath='README.md',probe=new URL('../../'+probePath,import.meta.url);
 assert.ok(registered[probePath],'drift probe must be a registered repository path');
 const original=readFileSync(probe);
 try{
  writeFileSync(probe,Buffer.concat([original,Buffer.from('\n<!-- conformance-drift-probe -->\n')]));
  const report=conformanceReport(),recomputed=Object.keys(registered).filter(path=>fileHash(path)!==registered[path]).sort();
  assert.equal(report.status,'CONFORMANT');
  assert.deepEqual(report.semanticDrift,[]);
  assert.ok(report.semanticBindings.every(entry=>entry.ok));
  assert.ok(report.repositoryDrift.some(entry=>entry.path===probePath),'live non-semantic drift must be reported, not silently tolerated');
  assert.ok(report.repositoryDrift.every(entry=>entry.semanticClass==='REPOSITORY_NON_SEMANTIC'));
  assert.deepEqual([...report.semanticDrift,...report.repositoryDrift].map(entry=>entry.path).sort(),recomputed);
 }finally{
  writeFileSync(probe,original);
 }
 assert.deepEqual(readFileSync(probe),original,'drift probe must be restored byte for byte');
});

test('active scope admits every semantic input and excludes presentation and test surfaces',()=>{
 const rules=maintenance.activeConformancePolicy.scopeRules;
 const semantic=['research/prompts/claim-impact-v012.txt','research/eval/claim-revision/locked-set.json','research/eval/claim-revision/development.json','research/eval/claim-revision/phase-gate.json','research/eval/claim-revision/results.json','research/src/identity.js','research/memory/store.js','research/retrieval/index.js','research/analyst/layer.js','research/analyst-real/provider.js','research/admission/layer.js','research/local-model/provider.js','agent/package.json','agent/package-lock.json',...Object.keys(gate.codeHashes).map(name=>'research/claim-revision/'+name)];
 for(const path of semantic)assert.ok(isSemantic(path,rules),path+' must be inside the active scope');
 const nonSemantic=['README.md','.gitignore','CHANGELOG.md','docs/public/status.md','docs/design/session-2.1a-core-proposition-audit.md','research/claim-revision-test/artifacts.test.js','agent/test/claim-revision-proposal.test.js','research/claim-reasoning-spike/RESULTS.md','research/retrieval-test/layer.test.js'];
 for(const path of nonSemantic)assert.ok(!isSemantic(path,rules),path+' must stay outside the active scope');
 assert.equal(conformanceReport().scope.closureUncovered.length,0);
 assert.ok(conformanceReport().scope.codeEntryPointsCovered);
});

test('M1 README-only change stays conformant and is reported as repository drift',()=>{
 const report=withDrift({'README.md':hash('a')});
 assert.equal(report.status,'CONFORMANT');
 assert.deepEqual(report.repositoryDrift.map(entry=>entry.path),['README.md']);
 assert.deepEqual(report.semanticDrift,[]);
});

test('M2 .gitignore-only change stays conformant and is reported as repository drift',()=>{
 const report=withDrift({'.gitignore':hash('b')});
 assert.equal(report.status,'CONFORMANT');
 assert.deepEqual(report.repositoryDrift.map(entry=>entry.path),['.gitignore']);
});

test('M3 pipeline implementation change fails conformance',()=>{
 const report=conformanceReport({contents:{'research/claim-revision/layer.js':'export const mutated=true;\n'}});
 assert.equal(report.status,'CONTENT_BINDING_MISMATCH');
 assert.deepEqual(report.semanticBindings.filter(entry=>!entry.ok).map(entry=>entry.path),['research/claim-revision/layer.js']);
});

test('M4 evaluation fixture change fails conformance',()=>{
 const suite=JSON.parse(readFileSync(new URL('../../research/eval/claim-revision/locked-set.json',import.meta.url),'utf8'));
 const report=conformanceReport({contents:{'research/eval/claim-revision/locked-set.json':JSON.stringify({...suite,cases:suite.cases.slice(0,-1)},null,2)}});
 assert.equal(report.status,'CONTENT_BINDING_MISMATCH');
 assert.deepEqual(report.semanticBindings.filter(entry=>!entry.ok).map(entry=>entry.binding),['lockedSetHash']);
});

test('M5 model prompt change fails conformance',()=>{
 const report=conformanceReport({contents:{'research/prompts/claim-impact-v012.txt':'classify the claim\n'}});
 assert.equal(report.status,'CONTENT_BINDING_MISMATCH');
 assert.deepEqual(report.semanticBindings.filter(entry=>!entry.ok).map(entry=>entry.binding),['promptHash']);
});

test('M5 dependency input change fails conformance',()=>{
 const report=withDrift({'research/src/identity.js':hash('c'),'research/memory/store.js':hash('d')});
 assert.equal(report.status,'SEMANTIC_DRIFT');
 assert.deepEqual(report.semanticDrift.map(entry=>entry.path).sort(),['research/memory/store.js','research/src/identity.js']);
 assert.deepEqual(report.repositoryDrift,[]);
});

test('M6 unrelated public documentation change stays conformant',()=>{
 const report=withDrift({'docs/research-memory-core-v0.2.md':hash('e'),'agent/README.md':hash('f')});
 assert.equal(report.status,'CONFORMANT');
 assert.deepEqual(report.repositoryDrift.map(entry=>entry.path).sort(),['agent/README.md','docs/research-memory-core-v0.2.md']);
});

test('gate and results stay bound to the historical phase gate',()=>{
 const report=conformanceReport(),results=JSON.parse(readFileSync(new URL('../../research/eval/claim-revision/results.json',import.meta.url),'utf8'));
 assert.equal(report.historical.parentGateOk,true);
 assert.equal(report.historical.bindingOk,true);
 assert.equal(results.binding.gateHash,maintenance.parentPhaseGate.gateHash);
});

test('a missing semantic binding file fails conformance instead of crashing the check',()=>{
 const report=conformanceReport({contents:{'research/prompts/claim-impact-v012.txt':null,'research/claim-revision/eval.js':null}});
 assert.equal(report.status,'CONTENT_BINDING_MISMATCH');
 assert.deepEqual(report.semanticBindings.filter(entry=>!entry.ok).map(entry=>entry.path).sort(),['research/claim-revision/eval.js','research/prompts/claim-impact-v012.txt']);
});

test('a corrupt fixture document fails conformance instead of crashing the check',()=>{
 const report=conformanceReport({contents:{'research/eval/claim-revision/locked-set.json':'{ not json'}});
 assert.equal(report.status,'CONTENT_BINDING_MISMATCH');
 assert.deepEqual(report.semanticBindings.filter(entry=>!entry.ok).map(entry=>entry.binding),['lockedSetHash']);
});
