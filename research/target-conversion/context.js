import {RetrievalIndex,defaultIndex} from '../retrieval/index.js';
import {buildGrounding} from '../grounding/grounding.js';
import {SpanRegistry} from '../grounding/registry.js';
import {SentenceSpanIndex} from '../evidence-support/sentences.js';
import {TableIndex} from '../evidence-support/support.js';
import {supportCases,annotateGold} from '../evidence-support/eval.js';
export function contextFor(){const index=new RetrievalIndex(defaultIndex),registry=new SpanRegistry(buildGrounding({})),sentences=new SentenceSpanIndex(registry),tables=new TableIndex(registry),cases=supportCases(registry,index),annotation=annotateGold(registry,sentences,cases);return {index,registry,sentences,tables,cases,annotation};}
