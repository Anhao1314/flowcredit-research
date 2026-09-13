import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildControlWorkspace,controlAvailability} from '../grounding/controls.js';

export const now='2026-09-13T12:00:00Z';
export const availability=controlAvailability;
export const python=process.env.FC_GROUNDING_PYTHON??process.env.FC_RETRIEVAL_PYTHON??fileURLToPath(new URL('../../../fc-agent/tools/retrieval-python/bin/python',import.meta.url));

export async function fixture(fn){
 const folder=mkdtempSync(join(tmpdir(),'fc-grounding-'));
 const workspace=buildControlWorkspace(folder,{python,clock:()=>now});
 try{
  return await fn({folder,pdf:resolve(folder,workspace.file),source:workspace.source,built:workspace.built,registry:workspace.registry,index:workspace.index});
 }finally{workspace.close();rmSync(folder,{recursive:true,force:true});}
}
export const tableSpans=(registry,rowLabel)=>registry.list({spanType:'table'}).filter(span=>span.rowLabel===rowLabel);
