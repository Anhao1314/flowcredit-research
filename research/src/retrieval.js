import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RetrievalIndex,defaultIndex } from '../retrieval/index.js';
import { RetrievalLayer } from '../retrieval/layer.js';
import { indexCoreweave } from '../retrieval/corpus.js';
import { evaluate } from '../retrieval/eval.js';
import { lookupAccepted } from '../retrieval/memory-lookup.js';
export function runRetrievalCli(args) {
  const [command,target,...rest]=args,allowed={index:['index','raw-dir'],search:['index','mode','as-of','time-mode','limit','memory-db'],candidate:['index','query','subject','mode','as-of','time-mode'],eval:['index']};
  if(!allowed[command] || !target || target.startsWith('--'))throw new Error('Usage: retrieval.js index|search|candidate|eval TARGET [query] [options]');
  let query;if(command==='search'){query=rest.shift();if(!query || query.startsWith('--'))throw new Error('search requires quoted query');}
  const options={};
  for(let i=0;i<rest.length;i+=2){const key=rest[i]?.slice(2);if(!rest[i]?.startsWith('--') || !allowed[command].includes(key) || options[key]!==undefined || !rest[i+1] || rest[i+1].startsWith('--'))throw new Error('Invalid/missing/duplicate option');options[key]=rest[i+1];}
  if(command!=='candidate' && target!=='coreweave')throw new Error('Unknown reviewed corpus');
  if(command==='candidate' && (!options.query || !options.subject))throw new Error('candidate requires --query and --subject');
  if(options.limit && !/^[1-9]\d*$/.test(options.limit))throw new Error('Invalid limit');
  const filename=options.index??process.env.FC_RETRIEVAL_INDEX??defaultIndex;
  if(command!=='index' && !existsSync(filename))throw new Error('Index missing; index corpus first');
  const index=new RetrievalIndex(filename),layer=new RetrievalLayer(index);
  try {
    if(command==='index')return indexCoreweave(index,{rawDir:options['raw-dir']});
    if(command==='eval')return evaluate(layer);
    const context={subjectId:options.subject??target,asOf:options['as-of'],timeMode:options['time-mode']??'audit',mode:options.mode??'hybrid',limit:options.limit?Number(options.limit):5};
    if(command==='candidate')return layer.createCandidate(target,{...context,query:options.query});
    const result=layer.search(query,context);
    if(options['memory-db'])result.acceptedMemory=lookupAccepted(options['memory-db'],target,{asOf:result.asOf});
    return result;
  }finally{index.close();}
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(runRetrievalCli(process.argv.slice(2)),null,2));}catch(error){console.error(error.message);process.exitCode=1;}
}
