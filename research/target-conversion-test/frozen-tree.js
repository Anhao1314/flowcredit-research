import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {digest} from '../src/identity.js';

const root=fileURLToPath(new URL('../../',import.meta.url));

// Reconstruct the historical frozen dependency set directly from the registered
// Git commit. This keeps old presentation assets reproducible without requiring
// those obsolete files to remain in the live working tree.
export function historicalFrozenHashes(commit='c2e4e18'){
 const paths=execFileSync('git',[
  'ls-tree','-r','--name-only',commit,
  'assets','agent/src','research/selector-ranking','research/selection-handles',
  'research/local-retrieval','research/local-model','research/evidence-support',
  'research/grounding','research/analyst-staged','research/admission','research/eval'
 ],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
 return Object.fromEntries(paths.map(path=>{
  const bytes=execFileSync('git',['show',commit+':'+path],{cwd:root,maxBuffer:16*1024*1024});
  return [path,digest(bytes.toString('utf8'))];
 }));
}
