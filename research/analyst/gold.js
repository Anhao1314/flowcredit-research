import {readJson} from '../src/schema.js';
import {normalizeSources} from '../src/normalize-source.js';
import {extractEvidence} from '../src/extract-evidence.js';
import {digest} from '../src/identity.js';
const sourcesInput=readJson(new URL('../fixtures/coreweave/sources.json',import.meta.url)),observations=readJson(new URL('../fixtures/coreweave/observations.json',import.meta.url));
export function buildGold(index){
 const sources=normalizeSources(sourcesInput),evidence=extractEvidence(sources,observations.observations,observations.asOf),chunks=index.list('chunk');
 const rows=evidence.map(e=>{
  const onPage=chunks.filter(c=>c.sourceId===e.sourceId && c.page===e.page),literal=typeof e.rawValue==='number'?new RegExp(`(?:^|[^\\d])${String(e.rawValue).replace('.', '\\.').replace(/\B(?=(\d{3})+(?!\d))/g,',?')}(?:[^\\d]|$)`):null;
  const chunk=onPage.find(c=>literal?.test(c.text) || typeof e.rawValue==='string' && c.text.includes(e.rawValue))??onPage[0];
  return {evidenceId:e.id,sourceId:e.sourceId,page:e.page,expected:e,chunkId:chunk?.id??null,status:!onPage.length?'original_source_not_indexed':typeof e.rawValue==='boolean' || typeof e.rawValue==='string' && !chunk?.text.includes(e.rawValue)?'unsupported_literal_mapping':'available_literal_context',query:e.metric.replaceAll('_',' ')+' '+(e.periodEnd?.slice(0,4)??'')};
 });
 return {version:'flowcredit.extraction_gold/v0.5',subjectId:'coreweave',goldEvidenceCount:32,goldHash:digest(evidence),indexedGoldCount:rows.filter(r=>r.chunkId).length,literalGoldCount:rows.filter(r=>r.status==='available_literal_context').length,rows};
}
// This oracle fixture has gold observations preloaded outside provider input.
// It tests pipeline contracts, NOT a model's ability to discover/extract facts.
export function goldMockProvider(gold){
 return {metadata:{kind:'test',provider:'deterministic-test',model:'gold-replay-oracle',modelVersion:'v1',temperature:0},async analyzeEvidence(input){
  return JSON.stringify(gold.rows.filter(r=>r.status==='available_literal_context' && input.data.chunks.some(c=>c.id===r.chunkId)).map(r=>{
   const e=r.expected,c=input.data.chunks.find(c=>c.id===r.chunkId);
   return {subjectId:e.subjectId,sourceIds:[e.sourceId],chunkIds:[c.id],statement:c.text,quotedText:c.text,researchField:e.researchField,category:e.category,metric:e.metric,scope:e.scope,factType:'explicit',rawValue:e.rawValue,proposedNormalizedValue:e.normalizedValue,rawUnit:e.rawUnit,unit:e.unit,normalization:e.normalization,observedAt:e.observedAt,periodStart:e.periodStart,periodEnd:e.periodEnd,periodStatus:'known',periodBasis:'quote'};
  }));
 }};
}
