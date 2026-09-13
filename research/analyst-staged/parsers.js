const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function parseUnit(text){
 if(typeof text!=='string')return {status:'unknown'};const t=text.trim();
 if(/^(?:%|percent)$/i.test(t))return {status:'known',rawUnit:'percent',unit:'percent',scale:1,normalization:'identity'};
 if(/^(?:days?|customers?)$/i.test(t))return {status:'known',rawUnit:t.toLowerCase().startsWith('day')?'days':'customers',unit:t.toLowerCase().startsWith('day')?'days':'customers',scale:1,normalization:'identity'};
 if(/^(?:(?:USD|\$|dollars?)\s*)?(?:million|billion)s?(?:\s*(?:USD|dollars?))?$/i.test(t)){const billion=/billion/i.test(t);return {status:'known',rawUnit:billion?'USD_billions':'USD_millions',unit:'USD',scale:billion?1e9:1e6,normalization:billion?'usd_billions_to_usd':'usd_millions_to_usd',currencyExplicit:/USD|\$|dollar/i.test(t)};}
 if(/^(?:USD|\$|dollars?)$/i.test(t))return {status:'known',rawUnit:'USD',unit:'USD',scale:1,normalization:'identity',currencyExplicit:true};
 return {status:'unknown'};
}
function decimal(text,scale){let t=text.replaceAll(',','').replace('−','-'),negative=false;if(t.startsWith('(')&&t.endsWith(')')){negative=true;t=t.slice(1,-1);}if(t.startsWith('-')){negative=true;t=t.slice(1);}const [whole,frac='']=t.split('.');if(frac.length>9)return null;const denominator=10n**BigInt(frac.length),coefficient=BigInt(whole+frac)*(negative?-1n:1n),scaled=coefficient*BigInt(scale);if(scaled%denominator!==0n&&scale!==1)return null;if(scaled>BigInt(Number.MAX_SAFE_INTEGER)*denominator||scaled< -BigInt(Number.MAX_SAFE_INTEGER)*denominator)return null;if(scaled%denominator===0n)return Number(scaled/denominator);if(coefficient>BigInt(Number.MAX_SAFE_INTEGER)||coefficient< -BigInt(Number.MAX_SAFE_INTEGER))return null;return Number(scaled)/Number(denominator);}
export function parseNumeric(rawValueText,rawUnitText,{quote=rawValueText}={}){
 const unsupported=reason=>({status:'unsupported',reason,rawValueText,rawUnitText});
 if(typeof rawValueText!=='string'||typeof quote!=='string'||!quote.includes(rawValueText)||rawUnitText!==null&&(!rawUnitText||!quote.includes(rawUnitText)))return unsupported('raw_text_not_exact');
 const t=rawValueText.trim(),m=/^(?:(?:USD|\$)\s*)?(\(?[-−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\)?)(?:\s*(million|billion|percent|%|days?|customers?)(?:\s*USD)?)?$/i.exec(t);
 if(!m||m[1].startsWith('(')!==m[1].endsWith(')'))return unsupported('numeric_syntax');
 let unit=parseUnit(rawUnitText??m[2]??(/USD|\$/.test(t)?'USD':null));if(unit.status!=='known')return unsupported('unit_unknown');
 if(m[2]){const own=parseUnit(m[2]);if(own.status==='known'&&own.rawUnit!==unit.rawUnit){if(unit.rawUnit==='USD'&&own.unit==='USD'&&own.scale>1)unit={...own,currencyExplicit:true};else return unsupported('unit_conflict');}}
 const token=escape(m[1]);
 const scale=unit.scale===1e9?'billions?':unit.scale===1e6?'millions?':'';
 const bound=unit.unit==='USD'?new RegExp('(?:(?:\\$|\\bUSD\\b)\\s*'+token+'\\s*'+scale+'\\b|'+token+'\\s*'+scale+'\\s*(?:USD|dollars?)\\b)','i'):new RegExp(token+'\\s*(?:'+(unit.unit==='percent'?'%|percent':unit.unit)+')','i');
 // Currency/scale must be bound to this literal, not an unrelated number elsewhere in quote.
 let supported;if(unit.unit==='USD'&&unit.scale===1)supported=new RegExp('(?:\\$|\\bUSD\\b)\\s*'+token+'(?![\\d,.])|'+token+'\\s*(?:USD|dollars?)\\b','i').test(quote);else if(unit.unit==='percent')supported=new RegExp(token+'\\s*(?:%|percent\\b)','i').test(quote);else if(unit.unit==='days'||unit.unit==='customers')supported=new RegExp(token+'\\s*'+unit.unit+'\\b','i').test(quote);else supported=bound.test(quote);
 if(!supported)return unsupported('numeric_unit_binding');
 const numericValue=decimal(m[1],1),normalizedValue=decimal(m[1],unit.scale);if(numericValue===null||normalizedValue===null||!Number.isFinite(numericValue)||!Number.isFinite(normalizedValue))return unsupported('numeric_precision');
 return {status:'known',numericValue,normalizedValue,...unit,rawValueText,rawUnitText};
}
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const natural=new RegExp('('+months.join('|')+')\\s+(\\d{1,2}),?\\s+(20\\d{2})','i');
const pad=n=>String(n).padStart(2,'0');
function date(year,month,day){const s=year+'-'+pad(month)+'-'+pad(day),d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:null;}
export function parsePeriod(text){
 const unknown=reason=>({status:'unknown',reason,periodText:text,start:null,end:null,observedAt:null});if(typeof text!=='string')return unknown('period_missing');
 const t=text.trim().replace(/^(?:for\s+(?:the\s+)?|the\s+)/i,''),dates=[...t.matchAll(new RegExp(natural.source,'gi'))];if(dates.length>1)return unknown('multiple_dates');
 const m=natural.exec(t);if(m){const end=date(m[3],months.findIndex(x=>x.toLowerCase()===m[1].toLowerCase())+1,Number(m[2]));if(!end)return unknown('invalid_date');const duration=/^(three|six|year)\s+months?\s+ended\s+/i.exec(t)||/^year\s+ended\s+/i.exec(t);let start=null,basis='as_of';
  if(duration){basis=/^year/i.test(t)?'calendar_year':/^six/i.test(t)?'six_months':'three_months';const count=basis==='calendar_year'?12:basis==='six_months'?6:3;const [y,mon,day]=end.split('-').map(Number);const last=new Date(Date.UTC(y,mon,0)).getUTCDate();if(day!==last)return unknown('non_month_end_window');const startDate=new Date(Date.UTC(y,mon-count,1));start=startDate.toISOString().slice(0,10);}
  else if(!/^as\s+of\s+/i.test(t))return unknown('ambiguous_period_phrase');
  return {status:'known',periodText:text,start,end,observedAt:end,basis};
 }
 const q=/^(calendar\s+)?Q([1-4])\s+(20\d{2})$/i.exec(t),fy=/^FY\s*(20\d{2})$/i.exec(t);if(q){if(!q[1])return unknown('fiscal_calendar_not_established');const mon=Number(q[2])*3;return {status:'known',periodText:text,start:date(q[3],mon-2,1),end:date(q[3],mon,new Date(Date.UTC(Number(q[3]),mon,0)).getUTCDate()),observedAt:date(q[3],mon,new Date(Date.UTC(Number(q[3]),mon,0)).getUTCDate()),basis:'explicit_calendar_quarter'};}
 if(fy)return unknown('fiscal_year_calendar_not_established');
 return unknown('ambiguous_or_unsupported_period');
}
