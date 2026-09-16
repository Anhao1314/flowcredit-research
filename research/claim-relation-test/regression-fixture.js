// Builds and re-derives the two 2.7B regression fixtures.
//
// The published documents in this directory are the record that every test run
// consumes: no test reads docs/audit (session 2.7B section 5).
//
// Public sources (tracked; present in a clean checkout):
//   docs/contracts/compatibility-v1.md            section 41.5, the 59-case disposition table
//   research/claim-reasoning-spike/dev-set.json   the 41 frozen Relation pairs
//   research/eval/claim-revision/locked-set.json  the 18 frozen LOCK pair contents
//
// Frozen basis (development material; never read on the test path):
//   docs/audit/session-2.6b3-compatibility-freeze-regression.json  59 frozen dispositions
//   docs/audit/session-2.6a-compatibility-case-matrix.json         59 archived pair contents
//
// Mapping. One published case is one frozen pair: case identity, order, 2.6A bucket and
// disposition are re-derived from the contract table; the claim and the evidence statement
// come from the dev-set (DEV-*) or from the locked-set's first fresh statement (LOCK-*). The
// contract's OUT disposition is published as NO_ASSESSMENT: LOCK-10 is the one case whose
// frozen shape is a multi-evidence bundle, so no pair input exists and CM-9.x produces no
// assessment. The recorded field tuples and the archived evidence counts have no public
// source; the published document carries them and the pins below protect them.
//
// Public fixture drift is detected on every run by three independent means:
//   1. re-derivation      - the contract table, the dev-set and the locked-set are re-read and
//                           compared case by case (buildGateFixture() and the compatibility
//                           assertions in compatibility.test.js);
//   2. the sha256 pins    - any edit to a published document fails the suite unless the pin is
//                           deliberately updated in the same change;
//   3. runtime agreement  - the 59 dispositions and the 29/12 gate split are asserted against
//                           the runtime, so gold and behaviour cannot drift apart.
// rederiveFromFrozenBasis() reproduces both documents from the frozen basis. It is the
// freeze-time tool (session 2.6B-3) and needs the local audit material; it is deliberately not
// on the test path.

import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {fail} from '../claim-relation/contract.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const read=path=>JSON.parse(readFileSync(root+path,'utf8'));
const source=path=>readFileSync(root+path,'utf8');
export const sha256=path=>'sha256:'+createHash('sha256').update(readFileSync(root+path)).digest('hex');

export const sources=Object.freeze({
 contract:'docs/contracts/compatibility-v1.md',
 relationPairs:'research/claim-reasoning-spike/dev-set.json',
 lockedPairContents:'research/eval/claim-revision/locked-set.json'
});
export const frozenBasis=Object.freeze({
 displacements:'docs/audit/session-2.6b3-compatibility-freeze-regression.json',
 matrix:'docs/audit/session-2.6a-compatibility-case-matrix.json'
});
// Hashes the published documents record for the frozen basis.
export const frozenBasisSha256=Object.freeze({
 displacements:'sha256:5d0191a432f6ea49129a2e9045dec9dc919e03e5dc2278626a42743863562480',
 matrix:'sha256:8ccd81915d92da593a8ed5f95b27d7bc488df95182afeff2c815cc3c3afb22d9'
});
// The audited bytes of each published document.
export const published=Object.freeze({
 'compatibility-regression-59.json':Object.freeze({path:'research/claim-relation-test/compatibility-regression-59.json',sha256:'sha256:e9e5433f94514ad4a9daff45bd885e93a91d9aa929747d391d8e34322629cf32'}),
 'gate-regression-41.json':Object.freeze({path:'research/claim-relation-test/gate-regression-41.json',sha256:'sha256:ce751a9dd181b0c4dfc1fd074487961c8caef35fc55e1d48106c8a85430dab99'})
});

// Reads a published document and refuses to serve one whose bytes drifted from the pin.
export function publishedFixture(name){
 const entry=published[name];
 if(!entry)fail(`UNKNOWN_PUBLISHED_FIXTURE: ${name}`);
 const digest=sha256(entry.path);
 if(digest!==entry.sha256)fail(`PUBLISHED_FIXTURE_DRIFT: ${entry.path} hashes to ${digest}, pinned ${entry.sha256}`);
 return {path:entry.path,sha256:digest,document:read(entry.path)};
}

// Section 41.5 of the frozen contract: the 59 reviewed cases in order, with the 2.6A
// bucket and the disposition the contract binds.
const contractHeader='| Case | 2.6A bucket | Disposition | Finding |';
export function contractCases(){
 const lines=source(sources.contract).split('\n'),start=lines.indexOf(contractHeader);
 if(start<0)fail('CONTRACT_TABLE_MISSING: the 41.5 disposition table is not in the frozen contract');
 const rows=[];
 for(const line of lines.slice(start+1)){
  if(!line.startsWith('|'))break;
  const cells=line.split('|').map(cell=>cell.trim()).filter(Boolean);
  if(cells.every(cell=>/^-+$/.test(cell)))continue;
  if(cells.length!==4)fail(`CONTRACT_TABLE_INVALID: ${line}`);
  rows.push({caseId:cells[0],bucket2_6a:cells[1],disposition:cells[2]==='OUT'?'NO_ASSESSMENT':cells[2],finding:cells[3]});
 }
 if(!rows.length)fail('CONTRACT_TABLE_EMPTY');
 return rows;
}

// The pair side every published case must carry, re-derived from its tracked source.
export function publicPairs(){
 const dev=new Map(read(sources.relationPairs).pairs.map(pair=>[pair.id,{claim:pair.claim,evidence:pair.evidence}]));
 const locked=new Map(read(sources.lockedPairContents).cases.map(item=>[item.name,{claim:item.claim,evidence:item.fresh[0]}]));
 return {dev,locked,get(caseId){return dev.get(caseId)??locked.get(caseId)??null;}};
}

// The gate document, re-derived from public sources alone: the pairs from the tracked
// dev-set, the frozen dispositions from the contract table.
export function buildGateFixture(){
 const devSet=read(sources.relationPairs);
 const rows=new Map(contractCases().map(row=>[row.caseId,row]));
 const cases=devSet.pairs.map(pair=>{
  const row=rows.get(pair.id);
  if(!row)fail(`GATE_FIXTURE_UNKNOWN_PAIR: ${pair.id}`);
  return {caseId:pair.id,claim:pair.claim,evidence:pair.evidence,expectedDisposition:row.disposition,expectedGate:row.disposition==='COMMENSURABLE'?'PERMITTED':'REFUSED'};
 });
 return {
  version:'claim-relation-gate-regression/v1',
  provenance:{relationPairsPath:sources.relationPairs,relationPairsSha256:sha256(sources.relationPairs),dispositionsPath:frozenBasis.displacements,dispositionsSha256:frozenBasisSha256.displacements,note:'The 41 frozen Relation spike pairs are used only as a gate-regression dataset; no Relation engine runs in session 2.7B.'},
  expected:{pairs:cases.length,permitted:cases.filter(item=>item.expectedGate==='PERMITTED').length,refused:cases.filter(item=>item.expectedGate==='REFUSED').length},
  cases
 };
}

// Freeze-time tool: rebuilds both published documents from the frozen basis. Never
// reached from a test run, and never silent when the basis is not on disk.
export function rederiveFromFrozenBasis(){
 for(const path of Object.values(frozenBasis))if(!existsSync(root+path))fail(`FROZEN_BASIS_ABSENT: ${path} (freeze-time tool; test runs consume the published documents)`);
 return {compatibility:compatibilityFromBasis(),gate:gateFromBasis()};
}

const RECORDED_FIELDS=['metric','normalizedValue','unit','periodStart','periodEnd','observedAt'];
const recordedOf=record=>record?Object.fromEntries(RECORDED_FIELDS.map(field=>[field,record[field]??null])):null;

function compatibilityFromBasis(){
 const regression=read(frozenBasis.displacements),matrix=read(frozenBasis.matrix);
 const contents=new Map(matrix.cases.map(item=>[item.caseId,item]));
 const cases=regression.cases.map(entry=>{
  const content=contents.get(entry.caseId);
  const bundle=Array.isArray(content.evidence);
  const side=bundle?content.evidence[0]:null;
  return {
   caseId:entry.caseId,
   family:entry.family,
   bucket2_6a:entry.bucket2_6a,
   expectedDisposition:entry.contractDisposition,
   derivationBasis:entry.derivationBasis,
   evidenceRecords:bundle?content.evidence.length:1,
   pairShape:content.caseId==='LOCK-10'?'bundle':'single',
   claim:content.claim,
   evidence:{statement:bundle?side.statement:content.evidence,recorded:recordedOf(side)}
  };
 });
 return {
  version:'claim-relation-compatibility-regression/v1',
  provenance:{displacementsPath:frozenBasis.displacements,matrixPath:frozenBasis.matrix,relationPairsPath:sources.relationPairs,sha256:{displacements:frozenBasisSha256.displacements,matrix:frozenBasisSha256.matrix,relationPairs:sha256(sources.relationPairs)},note:'Frozen 2.6B-3 dispositions over the archived 2.6A case contents. Gold labels are read-only; no label may be edited to make a runtime pass.'},
  aggregate:regression.aggregate,
  cases
 };
}

function gateFromBasis(){
 const devSet=read(sources.relationPairs),regression=read(frozenBasis.displacements);
 const disposition=new Map(regression.cases.map(entry=>[entry.caseId,entry.contractDisposition]));
 const cases=devSet.pairs.map(pair=>({caseId:pair.id,claim:pair.claim,evidence:pair.evidence,expectedDisposition:disposition.get(pair.id),expectedGate:disposition.get(pair.id)==='COMMENSURABLE'?'PERMITTED':'REFUSED'}));
 return {
  version:'claim-relation-gate-regression/v1',
  provenance:{relationPairsPath:sources.relationPairs,relationPairsSha256:sha256(sources.relationPairs),dispositionsPath:frozenBasis.displacements,dispositionsSha256:frozenBasisSha256.displacements,note:'The 41 frozen Relation spike pairs are used only as a gate-regression dataset; no Relation engine runs in session 2.7B.'},
  expected:{pairs:cases.length,permitted:cases.filter(item=>item.expectedGate==='PERMITTED').length,refused:cases.filter(item=>item.expectedGate==='REFUSED').length},
  cases
 };
}
