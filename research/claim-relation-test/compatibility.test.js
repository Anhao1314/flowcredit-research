import test from 'node:test';
import assert from 'node:assert/strict';
import {compatibilityAssessment} from '../claim-relation/compatibility.js';
import {frozenPaths} from '../claim-relation/contract.js';
import {readPair} from '../claim-relation/legacy-read.js';
import {contractCases,frozenBasis,frozenBasisSha256,publicPairs,publishedFixture,sources} from './regression-fixture.js';

const asOf='2026-03-01T12:00:00.000Z';
const {document:fixture,sha256:fixtureSha256}=publishedFixture('compatibility-regression-59.json');

function pair(claimStatement,evidenceStatement,{recorded=null,reading=null}={}){
 const relationInput={evidence:{evidenceId:'EVIDENCE-pair'},claim:{claimId:'CLAIM-pair',revisionId:'CLAIM-pair:v1'},asOf,evidenceSide:{semantics:{state:'NOT_MATERIALIZED'}},claimSide:{semantics:{state:'NOT_MATERIALIZED'}}};
 const material={evidenceId:'EVIDENCE-pair',claimId:'CLAIM-pair',revisionId:'CLAIM-pair:v1',asOf,claim:{statement:claimStatement},evidence:{statement:evidenceStatement,...(recorded??{})}};
 return {relationInput,material,assessment:compatibilityAssessment(relationInput,material,reading?{reading}:{})};
}
const legacyAssessment=(claimStatement,evidenceStatement,recorded=null)=>pair(claimStatement,evidenceStatement).assessment;
const keysOf=value=>{const out=[];const walk=item=>{if(Array.isArray(item))for(const entry of item)walk(entry);else if(item&&typeof item==='object')for(const [key,entry] of Object.entries(item)){out.push(key);walk(entry);}};walk(value);return out;};

test('the three frozen dispositions are produced by the derivation rule (CM-15.3)',()=>{
 assert.equal(legacyAssessment('December tool revenue was greater than 40 USD.','December tool revenue was 57 USD.').disposition,'COMMENSURABLE');
 assert.equal(legacyAssessment('December tool revenue was greater than 40 USD.','December tool margin was 12 percent.').disposition,'NOT_COMMENSURABLE');
 assert.equal(legacyAssessment('December tool revenue was greater than 40 USD.','Tool revenue is described favorably, but no amount or reporting period is given.').disposition,'INDETERMINATE');
});

test('kind rule limbs: (a) non-quantity statements, (b) incompatible measurement kinds, (c) unit families',()=>{
 const limbA=legacyAssessment('The published December tool revenue was greater than 40 USD.','The tool revenue reporting team moved to another office.');
 assert.equal(limbA.disposition,'NOT_COMMENSURABLE');
 assert.deepEqual(limbA.findings.map(finding=>finding.paths),[[ 'CP.predicate' ]]);
 assert.equal(legacyAssessment('December tool revenue was greater than 40 USD.','Tool revenue is reported under the industrial segment heading.').disposition,'NOT_COMMENSURABLE');
 const limbB=legacyAssessment('December tool revenue was greater than 40 million USD.','December tool headcount was 57 people.');
 assert.equal(limbB.disposition,'NOT_COMMENSURABLE');
 assert.deepEqual(limbB.findings.map(finding=>finding.paths),[['CP.predicate','QF.unit']]);
 // CM-19.3: a rate claim informed by a multi-period amount series is NOT a kind mismatch.
 assert.equal(legacyAssessment('Tool revenue increased by more than 10 percent from 2025 to 2026.','Table: 2025 tool revenue 100 USD; 2026 tool revenue 106 USD.').disposition,'COMMENSURABLE');
 // CM-19.3/CM-20.2: differences of instance, form, modality and non-quantity pairs are not obstacles.
 assert.equal(legacyAssessment('December tool revenue was greater than 40 USD.','February tool revenue was 57 USD.').disposition,'COMMENSURABLE');
 assert.equal(legacyAssessment('Early indications suggest December tool revenue may exceed 40 USD.','December tool revenue was greater than 40 USD.').disposition,'COMMENSURABLE');
 assert.equal(legacyAssessment('All three segments grew in December.','All three segments reported growth in December.').disposition,'COMMENSURABLE');
 assert.equal(legacyAssessment('Tool revenue expansion is broadly maintained across the company.','In February a smaller unit declined, although the major units still grew.').disposition,'COMMENSURABLE');
 assert.equal(legacyAssessment('December tool revenue was greater than 40000 USD.','December tool revenue was 57 thousand USD.').disposition,'COMMENSURABLE');
});

test('readability questions produce insufficiency findings and never a conflict (CM-18.3/CM-21.2/CM-22.2/CM-31.1)',()=>{
 const referent=legacyAssessment('December tool revenue was greater than 40 USD.','The December figure was 57 USD.');
 assert.equal(referent.disposition,'INDETERMINATE');
 assert.deepEqual(referent.findings.map(finding=>finding.paths),[['CP.subject']]);
 const predicate=legacyAssessment('December tool revenue was greater than 40 USD.','December table row: 57 USD.');
 assert.equal(predicate.disposition,'INDETERMINATE');
 assert.deepEqual(predicate.findings.map(finding=>finding.paths),[['CP.predicate']]);
 const columns=legacyAssessment('The December table shows tool revenue above 40 USD.','December table columns: headcount, region, office.');
 assert.equal(columns.disposition,'INDETERMINATE');
 assert.deepEqual(columns.findings.map(finding=>finding.paths),[['CP.predicate']]);
 const value=legacyAssessment('December tool revenue was greater than 40 USD.','December tool revenue was ...');
 assert.equal(value.disposition,'INDETERMINATE');
 assert.deepEqual(value.findings.map(finding=>finding.paths),[['CP.objectValue']]);
 const unit=legacyAssessment('December tool revenue was greater than 40 USD.','December tool revenue was 57.');
 assert.equal(unit.disposition,'INDETERMINATE');
 assert.deepEqual(unit.findings.map(finding=>finding.paths),[['QF.unit']]);
 assert.equal(legacyAssessment('December tool revenue was greater than 40 million USD.','December tool revenue was 57 million, on the reported scale.').disposition,'INDETERMINATE');
 const timeline=legacyAssessment('Tool revenue was greater than 40 USD in December.','Tool revenue was 57 USD.');
 assert.equal(timeline.disposition,'INDETERMINATE');
 assert.deepEqual(timeline.findings.map(finding=>finding.paths),[['QF.temporal']]);
 for(const assessment of [referent,predicate,columns,value,unit,timeline])assert.ok(assessment.findings.length>=1);
});

test('findings are blockers only: minimal frozen paths with verified literal bases (CM-17.x, CM-40.1)',()=>{
 const assessment=legacyAssessment('December tool revenue was greater than 40 USD.','December tool margin was 12 percent.');
 for(const finding of assessment.findings){
  assert.deepEqual(Object.keys(finding),['paths','basis']);
  for(const path of finding.paths)assert.ok(frozenPaths.includes(path),path);
  for(const entry of finding.basis){
   assert.ok(['claim','evidence'].includes(entry.side));
   assert.ok(entry.literal!==undefined||entry.absent!==undefined);
  }
 }
 assert.equal(legacyAssessment('December tool revenue was greater than 40 USD.','December tool revenue was 57 USD.').findings.length,0);
 // CM-15.3.1: a known incompatibility is recorded without the insufficiencies.
 const dominant=legacyAssessment('The published December tool revenue was greater than 40 USD.','The tool revenue reporting team moved to another office.');
 assert.equal(dominant.findings.length,1);
 assert.deepEqual(dominant.findings[0].paths,['CP.predicate']);
});

test('a basis that is not present in the pinned record is a defect, not a warning (CM-17.3.2)',()=>{
 const claimStatement='December tool revenue was greater than 40 USD.',evidenceStatement='December tool revenue was 57 USD.';
 const reading=readPair({claim:{statement:claimStatement},evidence:{statement:evidenceStatement}});
 const fabricated={...reading,evidence:{...reading.evidence,predicate:{readable:false,basis:'a column that is not in the record',reason:'table_columns_without_claimed_column'}}};
 assert.throws(()=>pair(claimStatement,evidenceStatement,{reading:fabricated}),/FINDING_BASIS_INVALID/);
});

test('the assessment carries no score, confidence, severity, impact or Relation label (CM-14.4/14.5)',()=>{
 const assessment=legacyAssessment('December tool revenue was greater than 40 USD.','December tool margin was 12 percent.');
 assert.deepEqual(Object.keys(assessment),['relationInput','disposition','findings']);
 const allowed=new Set(['relationInput','evidence','evidenceId','claim','claimId','revisionId','asOf','evidenceSide','claimSide','semantics','state','disposition','findings','paths','basis','side','literal','absent']);
 for(const key of keysOf(assessment))assert.ok(allowed.has(key),`unexpected assessment member ${key}`);
 const serialized=JSON.stringify({disposition:assessment.disposition,findings:assessment.findings}).toLowerCase();
 for(const forbidden of ['confidence','score','severity','impact','support','counter','neutral','ambiguous','engine','model','provider'])assert.ok(!serialized.includes(forbidden),forbidden);
});

test('the assessment binds the exact RelationInput by reference (CM-14.7)',()=>{
 const built=pair('December tool revenue was greater than 40 USD.','December tool revenue was 57 USD.');
 assert.equal(built.assessment.relationInput,built.relationInput);
 assert.ok(Object.isFrozen(built.assessment));
 // No copied pair tuple is introduced into the assessment (no new pair identifier).
 assert.equal(built.assessment.evidenceId,undefined);
 assert.equal(built.assessment.claimId,undefined);
 assert.equal(built.assessment.asOf,undefined);
 const other={...built.material,evidenceId:'EVIDENCE-other'};
 assert.throws(()=>compatibilityAssessment(built.relationInput,other),/MATERIAL_PAIR_MISMATCH/);
});

test('the published fixture is re-derived from public sources and pinned (session 2.7B section 5)',()=>{
 // The frozen basis is development material. Its provenance stays visible in the published
 // document, but the test path re-derives every column that has a tracked source instead of
 // reading docs/audit, which no clean checkout carries.
 assert.equal(fixture.provenance.displacementsPath,frozenBasis.displacements);
 assert.equal(fixture.provenance.matrixPath,frozenBasis.matrix);
 assert.equal(fixture.provenance.sha256.displacements,frozenBasisSha256.displacements);
 assert.equal(fixture.provenance.sha256.matrix,frozenBasisSha256.matrix);
 assert.equal(fixture.provenance.relationPairsPath,sources.relationPairs);
 assert.match(fixtureSha256,/^sha256:[0-9a-f]{64}$/);
 // Case identity, order, 2.6A bucket and disposition are re-derived from the frozen contract.
 const rows=contractCases();
 assert.equal(rows.length,59);
 assert.deepEqual(fixture.cases.map(item=>item.caseId),rows.map(row=>row.caseId));
 assert.deepEqual(fixture.cases.map(item=>[item.family,item.bucket2_6a,item.expectedDisposition]),rows.map(row=>[row.caseId.split('-')[0],row.bucket2_6a,row.disposition]));
 const counts=rows.reduce((out,row)=>(out[row.disposition]=(out[row.disposition]??0)+1,out),{});
 assert.deepEqual(counts,{COMMENSURABLE:40,NOT_COMMENSURABLE:7,INDETERMINATE:11,NO_ASSESSMENT:1});
 assert.deepEqual(fixture.aggregate.derived,{COMMENSURABLE:40,NOT_COMMENSURABLE:7,INDETERMINATE:11,NO_ASSESSMENT:1});
 assert.equal(fixture.aggregate.match,true);
 // Claim and evidence statement are re-derived from the tracked pair sources. The recorded
 // tuples and the archived evidence counts have no public source: the document carries them,
 // and each tuple must still agree with the statement it was recorded from.
 const pairs=publicPairs();
 for(const item of fixture.cases){
  const pair=pairs.get(item.caseId);
  assert.ok(pair,item.caseId);
  assert.equal(item.claim,pair.claim,item.caseId);
  assert.equal(item.evidence.statement,pair.evidence,item.caseId);
  const recorded=item.evidence.recorded;
  if(recorded===null){assert.equal(item.family,'DEV',item.caseId);continue;}
  assert.equal(recorded.metric,'synthetic_revenue',item.caseId);
  if(typeof recorded.normalizedValue==='number')assert.ok(item.evidence.statement.includes(String(recorded.normalizedValue)),item.caseId);
  else{assert.equal(recorded.unit,'quoted_text',item.caseId);assert.equal(recorded.normalizedValue,item.evidence.statement,item.caseId);}
 }
 // LOCK-10 alone is a multi-evidence bundle: it is the only published case with no pair input.
 assert.deepEqual(fixture.cases.filter(item=>item.pairShape==='bundle').map(item=>item.caseId),['LOCK-10']);
});

test('the frozen 59-case Compatibility regression is reproduced exactly (session 2.7B section 15)',()=>{
 const counts={COMMENSURABLE:0,NOT_COMMENSURABLE:0,INDETERMINATE:0,NO_ASSESSMENT:0};
 for(const [index,item] of fixture.cases.entries()){
  // A two-evidence bundle never becomes a pair input (E5/RI-18.1): no assessment.
  if(item.pairShape==='bundle'){counts.NO_ASSESSMENT++;continue;}
  const relationInput={evidence:{evidenceId:`EVIDENCE-${index}`},claim:{claimId:`CLAIM-${index}`,revisionId:`CLAIM-${index}:v1`},asOf,evidenceSide:{semantics:{state:'NOT_MATERIALIZED'}},claimSide:{semantics:{state:'NOT_MATERIALIZED'}}};
  const material={evidenceId:`EVIDENCE-${index}`,claimId:`CLAIM-${index}`,revisionId:`CLAIM-${index}:v1`,asOf,claim:{statement:item.claim},evidence:item.evidence.recorded?{statement:item.evidence.statement,...item.evidence.recorded}:{statement:item.evidence.statement}};
  const assessment=compatibilityAssessment(relationInput,material);
  assert.equal(assessment.disposition,item.expectedDisposition,`${item.caseId} (${item.derivationBasis})`);
  counts[assessment.disposition]++;
 }
 assert.deepEqual(counts,{COMMENSURABLE:40,NOT_COMMENSURABLE:7,INDETERMINATE:11,NO_ASSESSMENT:1});
});

test('legacy reading is deterministic and abstains instead of guessing',()=>{
 const first=readPair({claim:{statement:'December tool revenue was greater than 40 USD.'},evidence:{statement:'December tool revenue was 57 USD.'}});
 const second=readPair({claim:{statement:'December tool revenue was greater than 40 USD.'},evidence:{statement:'December tool revenue was 57 USD.'}});
 assert.deepEqual(first,second);
 const unreadable=readPair({claim:{statement:'December tool revenue was greater than 40 USD.'},evidence:{statement:'The December figure was 57 USD.'}});
 assert.equal(unreadable.evidence.referent.readable,false);
 assert.equal(unreadable.evidence.quantity.family,'currency');
});
