import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildControlWorkspace,defaultPython,injectionMarker,narrativeMarker} from '../evidence-support/controls.js';
export const python=process.env.FC_GROUNDING_PYTHON??defaultPython();
export const now='2026-09-14T00:00:00.000Z';
export {injectionMarker,narrativeMarker};
export async function fixture(fn){
 const folder=mkdtempSync(join(tmpdir(),'fc-support-test-'));
 const workspace=buildControlWorkspace(folder,{python,clock:()=>now});
 try{return await fn({folder,workspace,registry:workspace.registry,sentences:workspace.sentences,tables:workspace.tables,index:workspace.index,built:workspace.built});}
 finally{workspace.close();}
}
export function tableSpanFor(workspace,predicate){
 for(const table of workspace.tables.list())for(const span of table.cells.values())if(predicate(span))return {span,table};
 return null;
}
export function sentenceFor(workspace,predicate){
 for(const sentence of workspace.sentences.list())if(predicate(sentence))return sentence;
 return null;
}
