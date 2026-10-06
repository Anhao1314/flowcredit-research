// Candidate-only lexical reading repairs.
//
// The validated prose baseline intentionally remains byte-for-byte behaviorally
// comparable with archived experiments. v0.2A fixes generic tokenizer defects here
// so candidate experiments do not rewrite historical baseline measurements.
import {quantities as legacyQuantities,readPair} from '../claim-relation/legacy-read.js';

const DIRECTION=/\b(?:grew|grow|growth|rose|rise|rising|increased|increase|expanded|expansion|declined|decline|decreased|decrease|contracted|higher|lower|fell|maintained|sustained)\b/;
const FAMILY_TOKENS=Object.freeze([
 ['currency',/\b(?:usd|dollars?|us\$)\b|\$/i],
 ['percent',/\bpercent\b|%/i],
 ['count',/\b(?:people|persons?|employees?|headcount|staff)\b/i]
]);
const KIND_OF_FAMILY=Object.freeze({currency:'amount',percent:'ratio',count:'count'});

function embeddedIdentifier(statement,item){
 const raw=String(statement??'');
 const start=item.index;
 const literal=String(item.literal??'');
 const numeric=literal.match(/^\d+(?:\.\d+)?/)?.[0]??'';
 const end=start+numeric.length;
 const before=raw.slice(Math.max(0,start-2),start);
 const after=raw.slice(end,end+1);
 // H20, A100, Q2, 5G and hyphenated identifiers such as GPT-5.
 if(/[A-Za-z0-9]$/.test(before))return true;
 if(/[A-Za-z0-9]-$/.test(before))return true;
 if(/^[A-Za-z0-9]/.test(after))return true;
 return false;
}

export function candidateQuantities(statement){
 return legacyQuantities(statement).filter(item=>!embeddedIdentifier(statement,item));
}

function familyOfRecordedUnit(unit){
 const value=String(unit??'').toLowerCase();
 if(!value||value==='quoted_text')return null;
 for(const [family,pattern] of FAMILY_TOKENS)if(pattern.test(value))return family;
 return null;
}

function repairSide(side){
 const found=candidateQuantities(side.statement);
 const recordedFamily=familyOfRecordedUnit(side.recorded?.unit);
 const first=found[0]??null;
 const quantity=first&&first.family===null&&recordedFamily
  ?Object.freeze({...first,family:recordedFamily,kind:KIND_OF_FAMILY[recordedFamily]})
  :first;
 const kind=quantity?'quantity':side.administrative?'statement':DIRECTION.test(String(side.statement).toLowerCase())?'direction':'statement';
 const assertion=Object.freeze({
  kind,
  family:kind==='statement'?side.administrative:null,
  basis:quantity?quantity.literal:side.assertion?.basis??null
 });
 const unit=Object.freeze({
  family:quantity?quantity.family:null,
  scale:quantity?quantity.scale:null,
  basis:quantity?quantity.literal:null
 });
 return Object.freeze({...side,assertion,quantity,quantityCount:found.length,unit});
}

export function candidateReadPair({claim,evidence}){
 const base=readPair({claim,evidence});
 return Object.freeze({claim:repairSide(base.claim),evidence:repairSide(base.evidence)});
}
