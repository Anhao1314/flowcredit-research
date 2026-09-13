import {readFileSync} from 'node:fs';
import {digest,stableId} from '../src/identity.js';
import {normalizeSource} from '../src/normalize-source.js';
import {RetrievalLayer,cutoffVisible} from '../retrieval/layer.js';
import {mapCandidate} from '../admission/mapping.js';
import {instant} from '../memory/time.js';
export const validationVersion='evidence-analyst-validation/v1';
export const validatorHash=digest(readFileSync(new URL('./validation.js',import.meta.url),'utf8'));
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
export function probeCandidate(chunk,document,{asOf,timeMode}){
 const payload={queryId:'QUERY-analyst-validation',subjectId:chunk.subjectId,sourceId:chunk.sourceId,chunkId:chunk.id,quotedText:chunk.text,locator:chunk.locator,retrievalMethod:'lexical',retrievalRank:1,availableAt:chunk.availableAt,asOf,timeMode,contentHash:chunk.contentHash,documentHash:document.contentHash,proposedCategory:null,proposedRawValue:null};
 return {id:stableId('CANDIDATE',payload),...payload,createdAt:chunk.createdAt,validationStatus:'valid'};
}
export function freshChunk(index,chunkId,context,validator=new RetrievalLayer(index)){
 const chunk=index.get('chunk',chunkId),document=chunk?index.get('document',chunk.documentId):null;
 if(!chunk || !document)throw new Error('Chunk/Document missing');
 const validation=validator.validateCandidate(probeCandidate(chunk,document,context));
 return {chunk,document,validation};
}
function dateIn(text,date){if(!date)return false;const [y,m,d]=date.split('-');return text.includes(date) || new RegExp(`\\b${months[Number(m)-1]}\\s+${Number(d)},?\\s+${y}\\b`,'i').test(text);}
function rawTokens(text){return (text.match(/\(?[-−]?\d[\d,]*(?:\.\d+)?\)?/g)??[]).map(s=>Number(s.replace(/[(),−-]/g,''))*(s.startsWith('(') || /^[-−]/.test(s)?-1:1));}
function unitSupported(text,unit){
 if(unit==='USD_millions')return /(?:\$|\bUSD\b|\bdollars?\b)/i.test(text) && /\bmillions?\b/i.test(text) && !/\bbillions?\b/i.test(text);
 if(unit==='USD_billions')return /(?:\$|\bUSD\b|\bdollars?\b)/i.test(text) && /\bbillions?\b/i.test(text) && !/\bmillions?\b/i.test(text);
 if(unit==='USD')return /(?:\$|\bUSD\b|\bdollars?\b)/i.test(text) && !/\b(?:million|billion)s?\b/i.test(text);
 if(unit==='percent')return /%|\bpercent(?:age)?\b/i.test(text);
 if(unit==='text' || unit==='quoted_text')return true;
 return false;
}
export function proposalFact(proposal){return {researchField:proposal.researchField,category:proposal.category,metric:proposal.metric,scope:proposal.scope,rawValue:proposal.rawValue,rawUnit:proposal.rawUnit,unit:proposal.unit,normalization:proposal.normalization,periodStart:proposal.periodStart,periodEnd:proposal.periodEnd,observedAt:proposal.observedAt,confidence:0.5};}
export function validateProposal(index,item,input,validator=new RetrievalLayer(index)){
 const findings=[];const add=c=>{if(!findings.includes(c))findings.push(c);};
 if(item.subjectId!==input.data.subjectId)add('wrong_subject');
 const sent=input.data.chunks.find(c=>c.id===item.chunkIds[0]);
 if(!sent || item.sourceIds[0]!==sent?.source.id)add('unsupported_source');
 if(!sent)return {validationStatus:'invalid',validationFindings:findings,normalizedValue:null};
 const chunk=index.get('chunk',sent.id),document=chunk?index.get('document',chunk.documentId):null;
 if(!chunk || !document){add('missing_chunk');return {validationStatus:'invalid',validationFindings:findings,normalizedValue:null};}
 if(digest(chunk.text)!==sent.contentHash || digest(chunk.locator)!==digest(sent.locator) || document.contentHash!==sent.documentHash || normalizeSource(document.source).id!==sent.source.id)add('input_changed');
 try{if(!cutoffVisible(chunk,input.data.asOf,input.data.timeMode) || !cutoffVisible(document,input.data.asOf,input.data.timeMode))add('temporal_cutoff');const v=freshChunk(index,chunk.id,input.data,validator).validation;if(v.validationStatus!=='valid')add('citation_invalid');}catch{add('citation_invalid');}
 if(!chunk.text.includes(item.quotedText))add('invalid_quote');
 if(item.statement!==item.quotedText)add('statement_not_exact');
 if(item.factType!=='explicit')add('not_admissible');
 if(!document.source.isPrimarySource)add('source_not_primary');
 const q=item.quotedText;
 if(item.scope==='ai_inference_api' && !/AI inference API/i.test(q))add('scope_not_supported');
 if(/buy|sell|accepted|risk_grade|risk_score|thesis|target_price/i.test(item.metric+' '+item.researchField))add('forbidden_judgment');
 if(/ignore (?:all )?(?:previous|prior) instructions|output\s+ACCEPTED|return\s+BUY|send secrets|mark .*low risk/i.test(q))add('instruction_like_content');
 if(/\b(?:expect(?:s|ed)?|guidance|forecast|project(?:s|ed)?|anticipate(?:s|d)?)\b/i.test(q) && item.category!=='guidance')add('guidance_misclassified');
 if(/\b(?:high|low|severe)\s+(?:financial\s+)?risk\b|\b(?:BUY|SELL|ACCEPTED)\b/.test(item.statement))add('forbidden_judgment');
 const categoryWords={revenue:/\brevenue\b/i,growth:/growth|increase/i,revenue_concentration:/revenue/i,customer_concentration:/customer|concentration/i,top_customer_concentration:/customer|concentration/i,debt:/debt|borrow|loan/i,cash:/cash/i,cash_flow:/cash.*flow|operating activities/i,capex:/capital|capex|property|equipment/i,backlog_rpo:/backlog|performance obligation/i,guidance:/expect|guidance|forecast|project|anticipate/i,liquidity:/cash|liquidity|assets|liabilities/i,operating_history:/founded|established|incorporated|operations/i,compute_spend:/cost of revenue|technology|infrastructure|compute/i,risk_factors:/risk|depend|sensitivity|fluctuation/i,integrity_legal_reporting:/control|litigation|lawsuit|legal/i};
 if(!categoryWords[item.category]?.test(q))add('category_unsupported');
 const numeric=typeof item.rawValue==='number';
 if(numeric){
  if(/\b(?:not|never|no)\b/i.test(q))add('negated_numeric_not_admissible');
  if(!rawTokens(q).includes(item.rawValue))add('unsupported_numeric');
  // Conservative: reject excerpts combining multiple monetary/percentage facts.
  const amounts=q.match(/(?:\$|USD\s*)[-−]?[\d,.]+(?:\s*(?:million|billion)s?)?|[-−]?[\d,.]+\s*(?:%|percent|million|billion)s?/gi)??[];
  if(amounts.length>1)add('ambiguous_value_binding');
  if(['USD','USD_millions','USD_billions','percent'].includes(item.rawUnit) && !amounts.some(a=>rawTokens(a).includes(item.rawValue)))add('numeric_unit_binding_invalid');
  if(['growth','customer_concentration','top_customer_concentration'].includes(item.category) && item.rawUnit!=='percent')add('category_unit_mismatch');
  if(['revenue','debt','cash','cash_flow','capex','liquidity','compute_spend'].includes(item.category) && !['USD','USD_millions','USD_billions'].includes(item.rawUnit))add('category_unit_mismatch');
 }else if(typeof item.rawValue!=='string' || !q.includes(item.rawValue))add('unsupported_literal');
 if(!unitSupported(q,item.rawUnit) || item.unit==='unknown')add('unknown_or_unsupported_unit');
 if(item.periodStatus==='unknown' || !item.observedAt || item.periodBasis==='unknown')add('unknown_period');
 else {
  if(item.observedAt>document.source.documentDate || item.periodEnd && item.periodEnd>item.observedAt || item.periodStart && item.periodEnd && item.periodStart>item.periodEnd)add('wrong_period');
  const metadataDate=item.periodBasis==='source_metadata' && item.observedAt===document.source.documentDate && !item.periodStart && !item.periodEnd;
  if(!dateIn(q,item.observedAt) && !metadataDate)add('period_not_supported');
  if(item.periodEnd && !dateIn(q,item.periodEnd))add('period_not_supported');
  if(item.periodStart && !dateIn(q,item.periodStart)){
   const end=item.periodEnd;if(!end || !dateIn(q,end))add('period_not_supported');
   else {const quarter=/three months ended/i.test(q),annual=/year ended/i.test(q);const y=end.slice(0,4),m=Number(end.slice(5,7)),expected=quarter?`${y}-${String(m-2).padStart(2,'0')}-01`:annual && end.endsWith('12-31')?`${y}-01-01`:null;if(item.periodStart!==expected)add('period_not_supported');}
  }
  const years=[...q.matchAll(/\b20\d{2}\b/g)].map(m=>m[0]);if(new Set(years).size>1)add('ambiguous_period_binding');
 }
 let normalizedValue=null;
 try{
  if(!['identity','usd_millions_to_usd','usd_billions_to_usd'].includes(item.normalization))add('unsupported_normalization');
  else if(item.observedAt){const evidence=mapCandidate({quotedText:q,locator:chunk.locator},chunk,document.source,proposalFact(item),instant(input.data.generatedAt));normalizedValue=evidence.normalizedValue;if(digest(normalizedValue)!==digest(item.proposedNormalizedValue))add('normalization_mismatch');}
 }catch{add('unsupported_normalization');}
 return {validationStatus:findings.length?'invalid':'validated',validationFindings:findings,normalizedValue};
}
