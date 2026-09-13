import {digest} from '../src/identity.js';
export const rendererVersion='span-render/v1';
export const rendererHash=digest(rendererVersion+'|deterministic span rendering');

function tableLines(span){
 const lines=['SPAN '+span.id,'TABLE: '+(span.locator.caption??'table row'),'ROW: '+(span.rowLabel||'(none)'),'COLUMN: '+span.headerPath.join(', '),'VALUE: '+span.cellText];
 if(span.unitContext)lines.push('UNIT CONTEXT: '+span.unitContext.match);
 return lines;
}
export function renderSpan(span){
 if(span.spanType==='table')return tableLines(span).join('\n');
 return ['SPAN '+span.id,'TEXT: '+span.text].join('\n');
}
export function renderContext(spans){
 return spans.map(renderSpan).join('\n\n');
}
export function spanPeriodText(span){
 if(span.spanType!=='table')return null;
 const joined=span.headerPath.join(', ');
 return joined.replace(/,\s*(\d{4})$/,(match,year)=>' '+year);
}
