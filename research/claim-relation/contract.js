// Frozen enums, frozen shape validation and shared constants for the 2.7B runtime
// boundary (Research Memory -> RelationInput -> Compatibility -> gate).
//
// Clause map:
//   RI-*  docs/contracts/relation-input-v1.md
//   CM-*  docs/contracts/compatibility-v1.md
//   ADR-* docs/adr/ADR-0.12.1-relation-semantics.md
// This module defines no semantics of its own: it only restates the frozen
// vocabulary so that a malformed artifact fails closed.

export const relationInputVersion='relation-input/v1';
export const assessmentModel='CompatibilityAssessment'; // CM-1.1 (approved name)

// RI-7.2 / RI-15.1: exactly two state values, no status vocabulary.
export const projectionStates=Object.freeze(['PRESENT','NOT_MATERIALIZED']);

// CM-15.1.1 / CM-15.1.2: exactly three values.
export const dispositions=Object.freeze(['COMMENSURABLE','NOT_COMMENSURABLE','INDETERMINATE']);

// CM-17.2: findings cite existing frozen semantic paths only.
export const frozenPaths=Object.freeze(['CP.subject','CP.predicate','CP.objectValue','CP.assertionType','CP.direction','CP.comparator','QF.temporal','QF.unit','QF.denominator','QF.basis','QF.actuality','QF.scope','QF.comparisonReference','QF.persistence','QF.valueQuality']);

// ADR section 4 / 4.5: the frozen processing-status and relation vocabulary. The
// 2.7B boundary produces only the NOT_EVALUATED + null cell; the other names are
// carried so tests can prove that no label leaks out of a refused pair.
export const processingStatuses=Object.freeze(['RESOLVED','ABSTAINED','NOT_EVALUATED','ERROR']);
export const relationLabels=Object.freeze(['SUPPORTS','COUNTERS','NEUTRAL','AMBIGUOUS']);

// Gate refusal stages. A refusal reason is structured for a future
// RelationReceipt (session 2.7B section 12) and carries no Relation label.
export const refusalStages=Object.freeze(['ELIGIBILITY','COMPATIBILITY','BINDING']);

// RI-14.3 / RI-18.1: representative forbidden members, rejected by shape.
export const forbiddenRelationInputMembers=Object.freeze(['impact','impactHint','compatibility','compatibilityScore','subjectRef','grounding','fieldProvenance','context','confidence','status','processingStatus','relation','provider','model','engine','hash','asOfHash','evidenceIds','bundle']);

export function fail(code){throw new Error(code);}
const isPlainObject=value=>Boolean(value)&&Object.getPrototypeOf(value)===Object.prototype;
const isoTime=/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const identifier=/^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export function deepFreeze(value){
 if(Array.isArray(value)){for(const item of value)deepFreeze(item);return Object.freeze(value);}
 if(isPlainObject(value)){for(const item of Object.values(value))deepFreeze(item);return Object.freeze(value);}
 return value;
}

function assertExactMembers(value,allowed,label){
 for(const key of Object.keys(value))if(!allowed.includes(key))fail(`${label}: unexpected member ${key}`);
 for(const key of allowed)if(!(key in value))fail(`${label}: missing member ${key}`);
}
function assertIdentifier(value,label){
 if(typeof value!=='string'||!identifier.test(value))fail(`${label}: malformed identifier`);
}
function assertProjectionState(value,label){
 if(!isPlainObject(value))fail(`${label}: malformed semantics`);
 assertExactMembers(value,value.state==='PRESENT'?['state','frameRef']:['state'],`${label} semantics`);
 if(!projectionStates.includes(value.state))fail(`${label}: unknown projection state`);
 // RI-8.1: PRESENT pins the presented projection by opaque reference; the
 // encoding is owned outside this contract and is never re-derived here.
 if(value.state==='PRESENT'&&(typeof value.frameRef!=='string'||!value.frameRef.trim()))fail(`${label}: PRESENT requires a bound frameRef`);
}

// Frozen RelationInput v1 shape (RI section 7). Extra members are refused, not ignored.
export function assertRelationInput(value){
 if(!isPlainObject(value))fail('RELATION_INPUT_INVALID: not an object');
 assertExactMembers(value,['evidence','claim','asOf','evidenceSide','claimSide'],'RELATION_INPUT_INVALID');
 if(!isPlainObject(value.evidence))fail('RELATION_INPUT_INVALID: evidence');
 assertExactMembers(value.evidence,['evidenceId'],'RELATION_INPUT_INVALID evidence');
 assertIdentifier(value.evidence.evidenceId,'RELATION_INPUT_INVALID evidence.evidenceId');
 if(!isPlainObject(value.claim))fail('RELATION_INPUT_INVALID: claim');
 assertExactMembers(value.claim,['claimId','revisionId'],'RELATION_INPUT_INVALID claim');
 assertIdentifier(value.claim.claimId,'RELATION_INPUT_INVALID claim.claimId');
 assertIdentifier(value.claim.revisionId,'RELATION_INPUT_INVALID claim.revisionId');
 // RI-12.1: asOf is required and explicit.
 if(typeof value.asOf!=='string'||!isoTime.test(value.asOf))fail('RELATION_INPUT_INVALID: asOf is required and must be an explicit ISO timestamp');
 if(!isPlainObject(value.evidenceSide)||!isPlainObject(value.claimSide))fail('RELATION_INPUT_INVALID: sides');
 assertExactMembers(value.evidenceSide,['semantics'],'RELATION_INPUT_INVALID evidenceSide');
 assertExactMembers(value.claimSide,['semantics'],'RELATION_INPUT_INVALID claimSide');
 assertProjectionState(value.evidenceSide.semantics,'evidenceSide');
 assertProjectionState(value.claimSide.semantics,'claimSide');
 return value;
}

// CM-14: the frozen model is exactly three members (input reference, disposition,
// findings). CM-14.5: nothing non-semantic is carried.
const findingMembers=['paths','basis'];
// CM-17.3: a basis is a recorded field value or explicit statement content. An
// unreadable-path finding additionally names what is absent (CM-40.1) using this
// fixed readability vocabulary; it is not a disposition or dimension enum.
export const absentKinds=Object.freeze(['referent','predicate','value','unit','period']);
export function assertCompatibilityAssessment(value){
 if(!isPlainObject(value))fail('ASSESSMENT_INVALID: not an object');
 assertExactMembers(value,['relationInput','disposition','findings'],'ASSESSMENT_INVALID');
 assertRelationInput(value.relationInput);
 if(!dispositions.includes(value.disposition))fail('ASSESSMENT_INVALID: unknown disposition');
 if(!Array.isArray(value.findings))fail('ASSESSMENT_INVALID: findings must be an array');
 for(const finding of value.findings){
  if(!isPlainObject(finding))fail('ASSESSMENT_INVALID: finding');
  assertExactMembers(finding,findingMembers,'ASSESSMENT_INVALID finding');
  if(!Array.isArray(finding.paths)||finding.paths.length<1)fail('ASSESSMENT_INVALID: finding paths');
  for(const path of finding.paths)if(!frozenPaths.includes(path))fail('ASSESSMENT_INVALID: path outside CM-17.2');
  if(!Array.isArray(finding.basis)||finding.basis.length<1)fail('ASSESSMENT_INVALID: finding basis is required (CM-14.3)');
  for(const entry of finding.basis){
   if(!isPlainObject(entry))fail('ASSESSMENT_INVALID: basis entry');
   assertExactMembers(entry,entry.absent===undefined?['side','literal']:['side','absent'],'ASSESSMENT_INVALID basis entry');
   if(!['claim','evidence'].includes(entry.side))fail('ASSESSMENT_INVALID: basis side');
   if(entry.absent!==undefined){if(!absentKinds.includes(entry.absent))fail('ASSESSMENT_INVALID: unknown absent kind');}
   else if(typeof entry.literal!=='string'||!entry.literal.length)fail('ASSESSMENT_INVALID: basis literal');
  }
 }
 // CM-17.1: findings record blockers only.
 if(value.disposition==='COMMENSURABLE'&&value.findings.length!==0)fail('ASSESSMENT_INVALID: a permitted assessment carries no findings');
 if(value.disposition!=='COMMENSURABLE'&&value.findings.length<1)fail('ASSESSMENT_INVALID: a refusal requires at least one finding');
 return value;
}

// Transient pair identity used for the gate's fail-closed binding cross-check.
// CM-14.7: the assessment binds the input by reference and stores no such tuple.
export function pairIdentity(relationInput){
 assertRelationInput(relationInput);
 return Object.freeze({evidenceId:relationInput.evidence.evidenceId,claimId:relationInput.claim.claimId,revisionId:relationInput.claim.revisionId,asOf:relationInput.asOf});
}
