import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RetrievalIndex,defaultIndex} from '../retrieval/index.js';
import {ProposalStore,defaultProposals} from '../analyst/store.js';
import {EvidenceAnalyst} from '../analyst/layer.js';
import {testProvider,parseOutput} from '../analyst/contract.js';
import {buildGold,goldMockProvider} from '../analyst/gold.js';
import {evaluateExtraction} from '../analyst/eval.js';
export async function runAnalystCli(args){
 const [command,target,...rest]=args,allowed={'analyze-chunk':['index','proposals-db','subject','as-of','time-mode','provider','response-file'],analyze:['index','proposals-db','as-of','time-mode','limit','provider','response-file'],proposals:['index','proposals-db'],proposal:['index','proposals-db'],promote:['index','proposals-db'],'extraction-eval':['index','proposals-db','provider','as-of','time-mode','mode']};
 if(!Object.hasOwn(allowed,command) || !target || target.startsWith('--'))throw new Error('Usage: analyst.js analyze-chunk|analyze|proposals|proposal|promote|extraction-eval TARGET [query] [options]');
 let query;if(command==='analyze'){query=rest.shift();if(!query || query.startsWith('--'))throw new Error('analyze requires quoted query');}
 const options={};for(let i=0;i<rest.length;i+=2){const key=rest[i]?.slice(2);if(!rest[i]?.startsWith('--') || !allowed[command].includes(key) || options[key]!==undefined || !rest[i+1] || rest[i+1].startsWith('--'))throw new Error('Invalid/missing/duplicate option');options[key]=rest[i+1];}
 if(command==='analyze-chunk' && !options.subject)throw new Error('Direct chunk requires explicit --subject');
 const selection=options.provider??'unavailable';if(!['unavailable','mock-empty','mock-file','mock-gold'].includes(selection) || selection==='mock-gold' && command!=='extraction-eval' || selection==='mock-file' && !options['response-file'] || options['response-file'] && selection!=='mock-file')throw new Error('Explicit supported provider/test fixture required; real provider unavailable');
 if(options.limit && !/^[1-9]\d*$/.test(options.limit))throw new Error('Invalid limit');
 const indexPath=options.index??process.env.FC_RETRIEVAL_INDEX??defaultIndex,storePath=options['proposals-db']??process.env.FC_RESEARCH_PROPOSALS_DB??defaultProposals;
 if(!existsSync(indexPath))throw new Error('Existing Retrieval index required; index explicitly first');
 if(['proposal','proposals','promote'].includes(command) && !existsSync(storePath))throw new Error('Proposal store missing; analyze explicitly first');
 const index=new RetrievalIndex(indexPath);let store;
 try{
  store=new ProposalStore(storePath);
  const provider=selection==='unavailable'?null:selection==='mock-gold'?goldMockProvider(buildGold(index)):selection==='mock-file'?testProvider(parseOutput(readFileSync(options['response-file'],'utf8'))):testProvider([]);
  const analyst=new EvidenceAnalyst(index,store,{provider});
  if(command==='proposals')return analyst.proposals(target);
  if(command==='proposal')return analyst.proposal(target);
  if(command==='promote')return analyst.promoteProposalToCandidate(target);
  const context={subjectId:options.subject??target,asOf:options['as-of'],timeMode:options['time-mode']??'audit',limit:options.limit?Number(options.limit):5};
  if(command==='analyze-chunk')return await analyst.analyzeChunk(target,context);
  if(command==='analyze')return await analyst.analyze(query,context);
  if(target!=='coreweave')throw new Error('Only reviewed CoreWeave gold available');
  return await evaluateExtraction(analyst,buildGold(index),{asOf:options['as-of']??'2026-09-13',timeMode:options['time-mode']??'replay',mode:options.mode??'direct_chunk'});
 }finally{store?.close();index.close();}
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await runAnalystCli(process.argv.slice(2)),null,2));}catch(error){console.error(error.message);process.exitCode=1;}
}
