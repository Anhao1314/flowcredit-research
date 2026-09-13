import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RetrievalIndex,defaultIndex} from '../retrieval/index.js';
import {openMemory,defaultDatabase} from '../memory/open.js';
import {AdmissionLayer} from '../admission/layer.js';
export function runAdmissionCli(args) {
  const [command,target,...flags]=args,allowed={candidates:['index','db','state','as-of','query-id','source-id','created-from','created-to','method','validation'],candidate:['index','db','as-of'],accept:['index','db','subject','candidate-hash','reviewer','reviewer-id','reason','note','fact-file','existing-evidence-id','supersedes'],reject:['index','db','subject','candidate-hash','reviewer','reviewer-id','reason','note','supersedes'],'review-history':['index','db','as-of'],'deep-provenance':['index','db','as-of'],stats:['index','db','as-of']};
  if(!Object.hasOwn(allowed,command) || !target || target.startsWith('--'))throw new Error('Usage: admission.js candidates|candidate|accept|reject|review-history|deep-provenance|stats TARGET [options]');
  const options={};for(let i=0;i<flags.length;i+=2){const key=flags[i]?.slice(2);if(!flags[i]?.startsWith('--') || !allowed[command].includes(key) || options[key]!==undefined || !flags[i+1] || flags[i+1].startsWith('--'))throw new Error('Invalid/missing/duplicate option');options[key]=flags[i+1];}
  const write=['accept','reject'].includes(command);
  if(write && (options.reviewer!=='human' || !options['reviewer-id'] || !options['candidate-hash'] || !options.subject || !options.reason || !options.note))throw new Error('Explicit human reviewer/ID, subject, Candidate hash, reason and note required; no test/agent CLI acceptance');
  const indexPath=options.index??process.env.FC_RETRIEVAL_INDEX??defaultIndex,dbPath=options.db??process.env.FC_RESEARCH_MEMORY_DB??defaultDatabase;
  if(!existsSync(indexPath) || !existsSync(dbPath))throw new Error('Existing Retrieval index and Memory database required; seed explicitly first');
  const index=new RetrievalIndex(indexPath);let memory;
  try {
    memory=openMemory({filename:dbPath});const layer=new AdmissionLayer(index,memory);
    if(write){const request={candidateHash:options['candidate-hash'],subjectId:options.subject,reviewerType:'human',reviewerId:options['reviewer-id'],reasonCode:options.reason,note:options.note};if(options.supersedes)request.supersedesReviewId=options.supersedes;if(options['fact-file'])request.fact=JSON.parse(readFileSync(options['fact-file'],'utf8'));if(options['existing-evidence-id'])request.existingEvidenceId=options['existing-evidence-id'];return command==='accept'?layer.acceptCandidate(target,request):layer.rejectCandidate(target,request);}
    if(command==='review-history' || command==='candidate')return layer.reviewHistory(target,{asOf:options['as-of']});
    if(command==='deep-provenance')return layer.deepProvenance(target,{asOf:options['as-of']});
    if(command==='stats')return layer.stats(target,{asOf:options['as-of']});
    return layer.listCandidates(target,{state:options.state??'pending',asOf:options['as-of'],queryId:options['query-id'],sourceId:options['source-id'],createdFrom:options['created-from'],createdTo:options['created-to'],retrievalMethod:options.method,validationState:options.validation});
  }finally{memory?.close();index.close();}
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(runAdmissionCli(process.argv.slice(2)),null,2));}catch(error){console.error(error.message);process.exitCode=1;}
}
