import {readFileSync} from 'node:fs';

export const LABELS=Object.freeze(['SUPPORTS','COUNTERS','NEUTRAL','AMBIGUOUS']);
export const STATUSES=Object.freeze(['RESOLVED','ABSTAINED']);
export const CHALLENGES=Object.freeze([
 'numeric_series','numeric_threshold','second_order','direction_text','hard_negative',
 'missing_comparison','temporal_order','semantic_state','second_order_missing',
 'mix_inference','causal_attribution','causal_hard_negative','causal_insufficiency'
]);

const isObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const fail=message=>{throw new Error('BENCHMARK_INVALID: '+message);};

export function validateBenchmark(doc){
 if(!isObject(doc))fail('document');
 if(typeof doc.version!=='string'||!doc.version.startsWith('flowcredit.relation_benchmark/'))fail('version');
 if(doc.status!=='PILOT_SINGLE_REVIEW_NOT_PUBLICATION_GOLD'&&doc.status!=='LOCKED_DOUBLE_REVIEW')fail('status');
 if(!Array.isArray(doc.sources)||doc.sources.length<1)fail('sources');
 if(!Array.isArray(doc.cases)||doc.cases.length<1)fail('cases');
 const sourceIds=new Set();
 for(const source of doc.sources){
  for(const key of ['sourceId','issuer','form','periodEnd','accession','url','evidenceMode'])if(typeof source[key]!=='string'||!source[key])fail('source '+key);
  if(sourceIds.has(source.sourceId))fail('duplicate sourceId '+source.sourceId);
  sourceIds.add(source.sourceId);
  if(source.evidenceMode!=='paraphrased_facts')fail('source evidenceMode');
  if(!/^https:\/\/www\.sec\.gov\//.test(source.url))fail('pilot source must be SEC');
 }
 const ids=new Set();
 for(const item of doc.cases){
  if(ids.has(item.caseId))fail('duplicate caseId '+item.caseId);
  ids.add(item.caseId);
  if(!sourceIds.has(item.sourceId))fail('unknown sourceId '+item.sourceId);
  if(!CHALLENGES.includes(item.challenge))fail('unknown challenge '+item.challenge);
  for(const side of ['claim','evidence'])if(!isObject(item[side])||typeof item[side].statement!=='string'||!item[side].statement.trim())fail(item.caseId+' '+side);
  if(typeof item.asOf!=='string'||Number.isNaN(Date.parse(item.asOf)))fail(item.caseId+' asOf');
  if(!isObject(item.expected)||!STATUSES.includes(item.expected.processingStatus)||!LABELS.includes(item.expected.relation))fail(item.caseId+' expected');
  if(item.expected.relation==='AMBIGUOUS'&&item.expected.processingStatus!=='ABSTAINED')fail(item.caseId+' ambiguous status');
  if(item.expected.relation!=='AMBIGUOUS'&&item.expected.processingStatus!=='RESOLVED')fail(item.caseId+' resolved status');
  if(!isObject(item.annotation)||!['pilot-single-review','locked-double-review'].includes(item.annotation.tier))fail(item.caseId+' annotation tier');
  if(typeof item.annotation.basis!=='string'||!item.annotation.basis.trim())fail(item.caseId+' annotation basis');
  if(typeof item.annotation.locator!=='string'||!item.annotation.locator.trim())fail(item.caseId+' locator');
 }
 return doc;
}

export function loadBenchmark(pathOrUrl){
 const text=readFileSync(pathOrUrl,'utf8');
 return validateBenchmark(JSON.parse(text));
}
