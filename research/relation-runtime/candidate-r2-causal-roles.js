// Minimal causal role binding for the isolated v0.2B-R2 candidate.
//
// This is deliberately not a general parser. It extracts driver/outcome roles only
// from a small set of explicit causal constructions, then aligns the two roles
// independently. The goal is to avoid treating "same financial words somewhere in
// the sentence" as evidence of the same causal proposition.
import {normalize} from '../claim-relation/legacy-read.js';

const STOP=new Set([
 'a','an','the','of','in','on','for','to','from','by','with','and','or','as','at',
 'was','were','is','are','be','been','being','that','this','its','their',
 'higher','lower','increased','increase','increasing','decreased','decrease',
 'growth','grew','decline','declined','expansion','expanded',
 'primarily','largely','mainly','partially','offset','offsets','year','years',
 'fiscal','percent','percentage','usd','million','billion'
]);

function canonicalToken(token){
 if(token==='revenues')return 'revenue';
 if(token==='profits')return 'profit';
 if(token==='costs')return 'cost';
 if(token==='sales')return 'sales';
 if(token.endsWith('s')&&token.length>4&&!token.endsWith('ss'))return token.slice(0,-1);
 return token;
}

export function causalRoleTokens(value){
 const text=normalize(value)
  .replace(/\b(?:19|20)\d{2}\b/g,' ')
  .replace(/\b\d+(?:\.\d+)?\b/g,' ');
 return [...new Set((text.match(/[a-z][a-z0-9-]*/g)??[])
  .map(canonicalToken)
  .filter(token=>!STOP.has(token))
  .filter(token=>!['driver','drove','drive','drives','driven','cause','caused','causes','contribute','contributed','contributes','reflected','reflects','reflecting'].includes(token)))];
}

function trimDriver(value){
 return normalize(value)
  .replace(/\b(?:and\s+)?partially offset by\b.*$/,'')
  .replace(/\b(?:and\s+)?offset by\b.*$/,'')
  .replace(/[.,;:]\s*$/,'')
  .trim();
}
function trimOutcome(value){
 return normalize(value)
  .replace(/^the\s+(?:increase|growth|decrease|decline|expansion)\s+in\s+/,'')
  .replace(/[.,;:]\s*$/,'')
  .trim();
}
function frame(driver,outcome,construction){
 const d=trimDriver(driver),o=trimOutcome(outcome);
 if(!d||!o)return null;
 return Object.freeze({
  driver:d,
  outcome:o,
  driverTokens:Object.freeze(causalRoleTokens(d)),
  outcomeTokens:Object.freeze(causalRoleTokens(o)),
  construction
 });
}

export function parseCausalRoles(statement){
 const text=normalize(statement);
 let match;

 // Active: "higher X drove/caused Y".
 match=text.match(/^(.+?)\s+\b(?:drove|drives|drive|caused|causes|cause|contributed to|contributes to)\b\s+(.+)$/);
 if(match)return frame(match[1],match[2],'ACTIVE_DRIVER_OUTCOME');

 // Copular research language: "higher X was a primary driver of Y".
 match=text.match(/^(.+?)\s+\b(?:was|were|is|are)\b\s+(?:a\s+|the\s+)?(?:primary|main|major)\s+driver\s+of\s+(.+)$/);
 if(match)return frame(match[1],match[2],'COPULAR_PRIMARY_DRIVER');

 // Passive filing language: "Y ..., driven by X".
 match=text.match(/^(.+?)\s*,?\s*(?:primarily\s+|largely\s+|mainly\s+)?driven\s+by\s+(.+)$/);
 if(match)return frame(match[2],match[1],'PASSIVE_DRIVEN_BY');

 // Filing attribution: "Y primarily/largely/mainly reflected X".
 match=text.match(/^(.+?)\s+\b(?:primarily|largely|mainly)\s+reflect(?:ed|s|ing)\b\s+(.+)$/);
 if(match)return frame(match[2],match[1],'REFLECTED_ATTRIBUTION');

 return null;
}

function roleMatch(left,right){
 const a=new Set(left),b=new Set(right);
 if(!a.size||!b.size)return false;
 let common=0;
 for(const token of a)if(b.has(token))common+=1;
 const smaller=Math.min(a.size,b.size);
 return common>=Math.max(1,Math.ceil(smaller*0.8));
}

export function compareCausalRoles(claimStatement,evidenceStatement){
 const claim=parseCausalRoles(claimStatement);
 const evidence=parseCausalRoles(evidenceStatement);
 if(!claim||!evidence)return null;

 const driverAligned=roleMatch(claim.driverTokens,evidence.driverTokens);
 const outcomeAligned=roleMatch(claim.outcomeTokens,evidence.outcomeTokens);
 const reversed=roleMatch(claim.driverTokens,evidence.outcomeTokens)&&roleMatch(claim.outcomeTokens,evidence.driverTokens);

 if(driverAligned&&outcomeAligned){
  return Object.freeze({
   relation:'SUPPORTS',
   rule:'RT_CAUSAL_ROLE_ALIGNED',
   detail:'driver and outcome roles align across explicit causal constructions',
   claim,evidence
  });
 }
 if(reversed){
  return Object.freeze({
   relation:'NEUTRAL',
   rule:'RT_CAUSAL_ROLES_REVERSED',
   detail:'the same concepts appear in reversed driver/outcome roles',
   claim,evidence
  });
 }
 return Object.freeze({
  relation:'NEUTRAL',
  rule:outcomeAligned?'RT_CAUSAL_DRIVER_MISMATCH':driverAligned?'RT_CAUSAL_OUTCOME_MISMATCH':'RT_CAUSAL_ROLE_MISMATCH',
  detail:'explicit causal constructions are readable but driver/outcome roles do not align',
  claim,evidence
 });
}
