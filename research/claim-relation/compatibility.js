// Compatibility runtime: the PUBLISHED Compatibility v1 rule layer.
// References: docs/contracts/compatibility-v1.md (CM-*).
//
// The runtime decides exactly one question (CM-3.1): given one valid frozen
// RelationInput, can the two proposition sides be meaningfully compared for a
// directional Relation judgment? It never decides what the relation is.
//
// Blocking surface (CM-30.1): one kind rule (CM-19.1) plus two readability
// questions (CM-18.3 referent, CM-22.2 timeline) and the unit-readability limb of
// CM-21.2/CM-31.3. Findings are blockers only (CM-17.1) and every one of them
// carries a literal basis read from the pinned records (CM-14.3, CM-17.3).
//
// No score, no confidence, no severity, no dimension ontology, no Relation label.

import {assertRelationInput,deepFreeze,fail,pairIdentity} from './contract.js';
import {readPair} from './legacy-read.js';

const sameIdentity=(left,right)=>left.evidenceId===right.evidenceId&&left.claimId===right.claimId&&left.revisionId===right.revisionId&&left.asOf===right.asOf;
const periodCount=side=>side.timeline.months.length+side.timeline.years.length;
// CM-22.4: the claim's timeline is load-bearing when the claim is explicitly dated
// or latest-referenced; a universal/ongoing claim is not (CM-22.2).
const claimTimelineLoadBearing=claim=>periodCount(claim)>0||claim.timeline.latestReferenced===true;
// CM-34.4: a kind-incompatibility finding requires readable semantics on both sides.
const readableSide=side=>side.referent.readable&&side.predicate.readable&&side.value.readable;

function basisEntry(side,literal){return Object.freeze({side,literal});}
function absentEntry(side,absent){return Object.freeze({side,absent});}
function finding(paths,entries){return Object.freeze({paths:Object.freeze([...paths]),basis:Object.freeze([...entries])});}

// CM-19.1/CM-19.2 kind rule: readable kinds that cannot share a scale for a
// directional reading. Limb (a) is a value claim against a statement that asserts
// nothing of the claim's kind; limbs (b)/(c) are quantities of incompatible
// measurement kinds or non-convertible unit families.
function kindIncompatibility({claim,evidence}){
 if(!readableSide(claim)||!readableSide(evidence))return null;
 for(const [valueSide,otherSide] of [[claim,evidence],[evidence,claim]]){
  if(valueSide.assertion.kind!=='quantity'||!valueSide.quantity)continue;
  if(otherSide.assertion.kind==='statement'&&otherSide.assertion.family)return finding(['CP.predicate'],[basisEntry(otherSide.side,otherSide.assertion.basis),basisEntry(valueSide.side,valueSide.quantity.literal)]);
 }
 const quantities=[claim.quantity,evidence.quantity];
 if(claim.assertion.kind!=='quantity'||evidence.assertion.kind!=='quantity'||quantities.some(item=>!item||!item.family))return null;
 if(claim.quantity.family===evidence.quantity.family)return null;
 // CM-19.3: a rate/direction claim informed by a multi-period series of amounts is
 // not a kind mismatch (DEV-040: two-period percent series; arithmetic is
 // Relation's); the series determines the claimed rate.
 if(periodCount(claim)>=2&&evidence.quantityCount>=2)return null;
 return finding(['CP.predicate','QF.unit'],[basisEntry('claim',claim.quantity.literal),basisEntry('evidence',evidence.quantity.literal)]);
}

// CM-31.1 readability questions. One finding per unreadable load-bearing path; the
// minimal set is used, so an unreadable referent subsumes that side's predicate and
// value (CM-17.2.1, CM-18.3).
function readabilityFindings({claim,evidence}){
 const findings=[];
 for(const side of [claim,evidence]){
  if(!side.referent.readable){findings.push(finding(['CP.subject'],[basisEntry(side.side,side.referent.basis),absentEntry(side.side,'referent')]));continue;}
  if(!side.predicate.readable)findings.push(finding(['CP.predicate'],[basisEntry(side.side,side.predicate.basis),absentEntry(side.side,'predicate')]));
  if(!side.value.readable)findings.push(finding(['CP.objectValue'],[basisEntry(side.side,side.value.basis),absentEntry(side.side,'value')]));
 }
 // CM-21.2/CM-21.3: the unit is load-bearing only when both sides state
 // quantities, and an absent family is then insufficiency, never a conflict.
 if(claim.assertion.kind==='quantity'&&evidence.assertion.kind==='quantity'){
  for(const side of [claim,evidence])if(side.quantity&&!side.quantity.family)findings.push(finding(['QF.unit'],[basisEntry(side.side,side.quantity.literal),absentEntry(side.side,'unit')]));
 }
 // CM-22.2: a dated or latest-referenced claim cannot be compared against a side
 // with no readable timeline.
 if(claimTimelineLoadBearing(claim)&&!evidence.timeline.readable){
  // CM-40.1: an unreadable-path finding names what is absent; when the record
  // states the absence itself, that literal is cited too.
  const stated=evidence.timeline.reason==='period_absent'?[basisEntry('evidence',evidence.timeline.basis)]:[];
  findings.push(finding(['QF.temporal'],[...stated,absentEntry('evidence','period')]));
 }
 return findings;
}

function literalPresent(text,literal){return String(text??'').toLowerCase().replace(/\s+/g,' ').includes(String(literal).toLowerCase().replace(/\s+/g,' '));}
function recordedFieldValues(record){return [record.metric,record.normalizedValue,record.unit,record.periodStart,record.periodEnd].filter(value=>value!==null&&value!==undefined).map(value=>String(value).toLowerCase());}
// CM-17.3: a basis is a recorded field value or literal statement content. A basis
// that is neither is a defect, not a warning: the assessment must not be produced.
const absentOf={referent:side=>!side.referent.readable,predicate:side=>!side.predicate.readable,value:side=>!side.value.readable,unit:side=>Boolean(side.quantity)&&!side.quantity.family,period:side=>!side.timeline.readable};
function verifyBasis(findings,material,sides){
 for(const item of findings)for(const entry of item.basis){
  const record=entry.side==='claim'?material.claim:material.evidence;
  if(entry.absent!==undefined){
   if(!absentOf[entry.absent](entry.side==='claim'?sides.claim:sides.evidence))fail(`FINDING_BASIS_INVALID: ${entry.side} ${entry.absent} is not absent from the reading`);
   continue;
  }
  if(literalPresent(record.statement,entry.literal))continue;
  if(recordedFieldValues(record).some(value=>value===String(entry.literal).toLowerCase()))continue;
  fail(`FINDING_BASIS_INVALID: ${entry.side} basis is not present in the pinned record`);
 }
}

// CM-15.3 derivation rule: conflict dominates insufficiency.
function deriveDisposition(kind,findings){
 if(kind)return 'NOT_COMMENSURABLE';
 if(findings.length)return 'INDETERMINATE';
 return 'COMMENSURABLE';
}

export function compatibilityAssessment(relationInput,material,{reading=null}={}){
 assertRelationInput(relationInput);
 if(!material||!material.claim||!material.evidence)fail('MATERIAL_MISSING');
 if(!sameIdentity(pairIdentity(relationInput),{evidenceId:material.evidenceId,claimId:material.claimId,revisionId:material.revisionId,asOf:material.asOf}))fail('MATERIAL_PAIR_MISMATCH');
 const sides=reading??readPair({claim:material.claim,evidence:material.evidence});
 if(String(sides.claim.statement)!==String(material.claim.statement)||String(sides.evidence.statement)!==String(material.evidence.statement))fail('READING_MISMATCH');
 const kind=kindIncompatibility(sides);
 // CM-15.3.1: when a known incompatibility exists, insufficiencies are not recorded.
 const findings=kind?[kind]:readabilityFindings(sides);
 verifyBasis(findings,material,sides);
 const disposition=deriveDisposition(kind,findings);
 // CM-14.7: the assessment binds the exact RelationInput by reference; it copies
 // no pair tuple and introduces no new pair identifier.
 return deepFreeze({relationInput,disposition,findings});
}
