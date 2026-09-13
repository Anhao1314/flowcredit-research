import { digest,canonical } from '../src/identity.js';
import { extractEvidence } from '../src/extract-evidence.js';
import { assertAdmission } from './validation.js';
export const factFields=['researchField','category','metric','scope','rawValue','rawUnit','unit','normalization','periodStart','periodEnd','observedAt','confidence'];
export function factOf(evidence){return Object.fromEntries(factFields.map(key=>[key,evidence[key]]));}
export function sameFact(a,b) {
  const semantic=value=>{const {confidence,...rest}=factOf(value);return rest;};
  return digest(semantic(a))===digest(semantic(b));
}
function rawPresent(quote,value) {
  if(typeof value==='number'){
    const matches=quote.match(/\(?[-−]?\d[\d,]*(?:\.\d+)?\)?/g)??[];
    return matches.some(token=>{
      const negative=token.startsWith('(') || /^[-−]/.test(token);
      const n=Number(token.replace(/[(),−-]/g,''))*(negative?-1:1);return n===value;
    });
  }
  if(typeof value==='string')return !!value.trim() && quote.includes(value);
  return false; // Boolean/structured facts require future explicit extraction policy.
}
export function mapCandidate(candidate,chunk,source,fact,at) {
  assertAdmission('fact',fact);
  if(!rawPresent(candidate.quotedText,fact.rawValue))throw new Error('Reviewed raw value is not exactly present in candidate quote');
  if(fact.periodEnd && fact.periodEnd>fact.observedAt || fact.periodStart && fact.periodEnd && fact.periodStart>fact.periodEnd)throw new Error('Reviewed period/observation mismatch');
  return extractEvidence([source],[{sourceKey:source.metadata.documentKey,...fact,statement:candidate.quotedText,section:chunk.section,page:chunk.page,location:JSON.stringify(canonical(candidate.locator))}],at)[0];
}
export function quotationFact(candidate,source) {
  return {researchField:'primary_quotation',category:'primary_quotation',metric:'quoted_primary_passage',scope:'consolidated_company',rawValue:candidate.quotedText,rawUnit:'quoted_text',unit:'quoted_text',normalization:'identity',periodStart:null,periodEnd:null,observedAt:source.documentDate,confidence:1};
}
export function admissionFactKey(candidate,evidence) {
  return digest({sourceId:candidate.sourceId,locator:candidate.locator,quotedText:candidate.quotedText,normalizedFact:{researchField:evidence.researchField,category:evidence.category,metric:evidence.metric,scope:evidence.scope,normalizedValue:evidence.normalizedValue,unit:evidence.unit,periodStart:evidence.periodStart,periodEnd:evidence.periodEnd,observedAt:evidence.observedAt}});
}
