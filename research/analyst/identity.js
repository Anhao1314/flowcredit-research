import {digest} from '../src/identity.js';
export function proposalIdentity(item,provenance,chunkHashes,validationStatus){
 const {statement,quotedText,periodBasis,periodStatus,...fact}=item;
 return {fact,provenance,chunkHashes,support:validationStatus==='validated'?null:{statement,quotedText,periodBasis,periodStatus}};
}
export function storedSemanticKey(p){
 const fields=['subjectId','sourceIds','chunkIds','researchField','category','metric','scope','factType','rawValue','proposedNormalizedValue','rawUnit','unit','normalization','observedAt','periodStart','periodEnd','modelProvider','modelName','modelVersion','providerKind','temperature','promptVersion','promptHash','validationVersion','validatorHash'];
 return digest({fact:Object.fromEntries(fields.map(k=>[k,p[k]??null])),support:p.validationStatus==='validated'?null:{statement:p.statement,quotedText:p.quotedText,periodBasis:p.periodBasis,periodStatus:p.periodStatus}});
}
