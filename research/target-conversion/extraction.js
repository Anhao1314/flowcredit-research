import {parseNumeric} from '../analyst-staged/parsers.js';
import {normalizeSpace} from '../grounding/facts.js';
export const extractionVersion='exact-local-extraction/v1';
const anchors={consolidated_revenue:'Revenue',operating_cash_flow:'Operating cash flow',debt_balance:'Total debt',cash_balance:'Cash balance'};
// Only explicit named-clause associations. No respectively alignment, shared
// scales, guessed periods, or proximity heuristics. Final frozen validators run.
export function extractCompound(support,intent,fact){
 if(support.type!=='text'||!fact.rawValueText||!/\band\b/i.test(fact.rawValueText))return {fact,proof:null};
 const text=normalizeSpace(support.text),anchor=anchors[intent.targetMetricOrConcept];
 if(!anchor||/\brespectively\b/i.test(text))return {fact,proof:null,failure:'COMPOUND_LITERAL_ERROR'};
 const pattern=new RegExp('\\b('+anchor+')\\s+(?:was|of)\\s+((?:\\$\\s*|USD\\s+)?\\d+(?:,\\d{3})*(?:\\.\\d+)?\\s*(?:million|billion|%|percent))\\b','gi');
 const matches=[...text.matchAll(pattern)];if(matches.length!==1)return {fact,proof:null,failure:'SUPPORT_AMBIGUOUS'};
 const match=matches[0],literal=match[2];
 if(parseNumeric(literal,null,{quote:text}).status!=='known')return {fact,proof:null,failure:'COMPOUND_LITERAL_ERROR'};
 return {fact:{...fact,rawValueText:literal,rawUnitText:null},proof:{version:extractionVersion,sourceSupportId:support.spanId,sourceSupportHash:support.supportHash,semanticAnchor:match[1],exactSourceQuote:match[0],rawValueText:literal,offset:match.index}};
}
// Copy a unique verbatim source substring with identical non-whitespace tokens.
// This handles PDF line breaks; it never changes digits, words, units or dates.
export function bindSourceWhitespace(support,fact){
 if(support.type!=='text')return {fact,proof:[]};
 const text=normalizeSpace(support.text),next={...fact},proof=[];
 for(const field of ['rawValueText','rawUnitText','periodText']){
  const value=fact[field];if(typeof value!=='string'||text.includes(value))continue;
  const escaped=value.trim().split(/\s+/).map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');
  const matches=[...text.matchAll(new RegExp('(?<![\\p{L}\\p{N}])'+escaped+'(?![\\p{L}\\p{N}])','gu'))];
  if(matches.length!==1)continue;
  next[field]=matches[0][0];proof.push({version:extractionVersion,rule:'identical_tokens_unique_source_whitespace',field,proposedText:value,exactSourceText:next[field],offset:matches[0].index,sourceSupportId:support.spanId,sourceSupportHash:support.supportHash});
 }
 return {fact:next,proof};
}
export function namedLiteralMismatch(support,intent,fact){
 if(support.type!=='text'||!anchors[intent.targetMetricOrConcept])return false;
 const extracted=extractCompound(support,intent,{...fact,rawValueText:'explicit named-clause and check'});
 if(!extracted.proof)return false; // Unknown semantic associations stay with LLM.
 const target=parseNumeric(extracted.fact.rawValueText,null,{quote:normalizeSpace(support.text)}),proposed=parseNumeric(fact.rawValueText,fact.rawUnitText,{quote:normalizeSpace(support.text)});
 return target.status==='known'&&proposed.status==='known'&&(target.normalizedValue!==proposed.normalizedValue||target.rawUnit!==proposed.rawUnit);
}
