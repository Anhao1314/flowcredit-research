import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {digest} from '../src/identity.js';

export const conformanceVersion='claim-impact-conformance/v1';
const root=fileURLToPath(new URL('../../',import.meta.url));
export const maintenancePath=resolve(root,'research/eval/claim-revision/provenance-maintenance.json');
export const gatePath=resolve(root,'research/eval/claim-revision/phase-gate.json');
export const resultsPath=resolve(root,'research/eval/claim-revision/results.json');
const readJson=path=>JSON.parse(readFileSync(path,'utf8'));
export const readGate=()=>readJson(gatePath);
export const readResults=()=>readJson(resultsPath);
export const readMaintenance=path=>readJson(path??maintenancePath);
export const sha256Bytes=value=>'sha256:'+createHash('sha256').update(value).digest('hex');
export const fileHash=(path,{cwd=root}={})=>sha256Bytes(readFileSync(resolve(cwd,path)));

function ruleRegExp(pattern){
 const parts=pattern.split('/').map(segment=>segment==='**'?'\u0000':segment.replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'[^/]*'));
 return new RegExp('^'+parts.join('/').replace(/\u0000/g,'.*')+'$');
}
export function matchesRule(path,rule){return ruleRegExp(rule.pattern).test(path);}
export function semanticClassOf(path,rules){return rules.find(rule=>matchesRule(path,rule))?.class??null;}
export function isSemantic(path,rules){return semanticClassOf(path,rules)!==null;}

export function commitPaths(commit,{cwd=root}={}){
 return execFileSync('git',['ls-tree','-r','-z','--name-only',commit],{cwd,encoding:'utf8',maxBuffer:1<<30}).split('\0').filter(Boolean);
}
export function commitBlobHashes(commit,paths,{cwd=root}={}){
 const out=execFileSync('git',['cat-file','--batch'],{cwd,input:paths.map(path=>commit+':'+path).join('\n')+'\n',maxBuffer:1<<30});
 const hashes={};let offset=0;
 for(const path of paths){
  const newline=out.indexOf(0x0a,offset);
  if(newline<0){hashes[path]=null;continue;}
  const header=out.subarray(offset,newline).toString('utf8'),match=/^([0-9a-f]{40}) (\w+) (\d+)$/.exec(header);
  if(!match){hashes[path]=null;offset=newline+1;continue;}
  const size=Number(match[3]),start=newline+1;
  hashes[path]=sha256Bytes(out.subarray(start,start+size));
  offset=start+size+1;
 }
 return hashes;
}
export function historicalSnapshot(frozen,{commit,cwd=root}={}){
 const paths=Object.keys(frozen),blobs=commitBlobHashes(commit,paths,{cwd}),mismatches=[];
 for(const path of paths)if(blobs[path]!==frozen[path])mismatches.push({path,recorded:frozen[path],atCommit:blobs[path]??null,reason:blobs[path]===null?'absent-from-commit':'blob-mismatch'});
 return {commit,paths:paths.length,verified:paths.length-mismatches.length,mismatches};
}
export function currentHashes(paths,{cwd=root}={}){
 const hashes={};
 for(const path of paths){const full=resolve(cwd,path);hashes[path]=existsSync(full)&&statSync(full).isFile()?fileHash(path,{cwd}):null;}
 return hashes;
}
const importPattern=/(?:from|import)\s+["']([^"']+)["']|import\(["']([^"']+)["']\)/g;
function resolveSpecifier(from,specifier,{cwd=root}={}){
 if(!specifier.startsWith('.'))return null;
 const base=resolve(cwd,from,'..',specifier);
 for(const candidate of [base,base+'.js',base+'.mjs',join(base,'index.js')])if(existsSync(candidate)&&statSync(candidate).isFile())return relative(cwd,candidate);
 return null;
}
export function importClosure(entries,{cwd=root}={}){
 const seen=new Set(),stack=[...entries];
 while(stack.length){
  const file=stack.pop();
  if(seen.has(file)||!existsSync(resolve(cwd,file)))continue;
  seen.add(file);
  for(const match of readFileSync(resolve(cwd,file),'utf8').matchAll(importPattern)){
   const resolved=resolveSpecifier(file,match[1]??match[2],{cwd});
   if(resolved&&!seen.has(resolved))stack.push(resolved);
  }
 }
 return {files:[...seen].sort()};
}
export function scopeFiles(rules,{cwd=root,skip=['node_modules','.git','.cache']}={}){
 const found=[];
 const walk=directory=>{
  for(const entry of readdirSync(resolve(cwd,directory),{withFileTypes:true})){
   if(skip.includes(entry.name))continue;
   const path=directory?directory+'/'+entry.name:entry.name;
   if(entry.isDirectory())walk(path);
   else if(isSemantic(path,rules))found.push(path);
  }
 };
 const prefixes=[...new Set(rules.map(rule=>rule.pattern.split('/').slice(0,rule.pattern.includes('**')?rule.pattern.split('/').indexOf('**'):1).join('/')).filter(Boolean))];
 for(const prefix of prefixes){const full=resolve(cwd,prefix);if(existsSync(full)&&statSync(full).isDirectory()&&!isSemantic(prefix,rules))walk(prefix);else if(existsSync(full)&&statSync(full).isFile())found.push(prefix);}
 const explicit=rules.filter(rule=>rule.kind!=='directory').map(rule=>rule.pattern).filter(pattern=>!pattern.includes('*')&&existsSync(resolve(cwd,pattern)));
 return [...new Set([...found,...explicit])].filter(path=>isSemantic(path,rules)).sort();
}
export function conformanceReport({gate=readGate(),maintenance=readMaintenance(),current,contents,closure,cwd=root}={}){
 const rules=maintenance.activeConformancePolicy.scopeRules,frozen=gate.frozenHashes,paths=Object.keys(frozen);
 const observed=current??currentHashes(paths,{cwd});
 const text=path=>{
  if(contents&&Object.prototype.hasOwnProperty.call(contents,path))return contents[path];
  try{return readFileSync(resolve(cwd,path),'utf8');}catch{return null;}
 };
 const drift=paths.filter(path=>observed[path]!==frozen[path]).map(path=>({path,recorded:frozen[path],actual:observed[path]??null,reason:observed[path]===null?'missing':'modified',semanticClass:semanticClassOf(path,rules)??'REPOSITORY_NON_SEMANTIC'}));
 const semanticDrift=drift.filter(item=>item.semanticClass!=='REPOSITORY_NON_SEMANTIC');
 const repositoryDrift=drift.filter(item=>item.semanticClass==='REPOSITORY_NON_SEMANTIC');
 const frozenPathSet=new Set(paths);
 const inScopeFrozen=paths.filter(path=>isSemantic(path,rules));
 const additions=scopeFiles(rules,{cwd}).filter(path=>!frozenPathSet.has(path));
 const codeEntries=Object.keys(gate.codeHashes).map(name=>'research/claim-revision/'+name);
 const measured=closure??importClosure(codeEntries,{cwd});
 const uncovered=measured.files.filter(path=>!isSemantic(path,rules));
 const gateHash=digest(gate),binding=readJson(resolve(cwd,'research/eval/claim-revision/results.json')).binding;
 const parentGateOk=gateHash===maintenance.parentPhaseGate.gateHash,bindingOk=binding.gateHash===maintenance.parentPhaseGate.gateHash;
 const codesCovered=codeEntries.every(path=>isSemantic(path,rules));
 const semanticBindings=[
  ...Object.entries(gate.codeHashes).map(([name,hash])=>{const path='research/claim-revision/'+name,source=text(path);return {binding:'codeHashes',path,ok:source!==null&&digest(source)===hash};}),
  ...(maintenance.activeConformancePolicy.contentBindings??[]).filter(entry=>entry.binding!=='codeHashes').map(entry=>{
   const source=text(entry.path);
   if(source===null)return {binding:entry.binding,path:entry.path,ok:false};
   try{return {binding:entry.binding,path:entry.path,ok:digest(entry.encoding==='json'?JSON.parse(source):source)===gate[entry.binding]};}catch{return {binding:entry.binding,path:entry.path,ok:false};}
  })
 ];
 const bindingsOk=semanticBindings.every(entry=>entry.ok);
 const status=!parentGateOk?'HISTORICAL_GATE_MISMATCH':semanticDrift.length?'SEMANTIC_DRIFT':(!bindingsOk?'CONTENT_BINDING_MISMATCH':(!bindingOk?'RESULT_BINDING_MISMATCH':(!codesCovered||uncovered.length?'SCOPE_COVERAGE_GAP':'CONFORMANT')));
 return {schemaVersion:conformanceVersion,gateVersion:gate.version,policyModel:maintenance.activeConformancePolicy.model,rules:rules.length,status,historical:{commit:maintenance.parentPhaseGate.frozenSourceCommit,recordedPaths:paths.length,recordedSetDigest:digest(frozen),expectedSetDigest:maintenance.parentPhaseGate.frozenSetDigest,parentGateOk,bindingOk},scope:{inScopeFrozen:inScopeFrozen.length,additions,closureFiles:measured.files.length,closureUncovered:uncovered,codeEntryPointsCovered:codesCovered},semanticBindings,semanticDrift,repositoryDrift};
}
