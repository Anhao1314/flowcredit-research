// Domain-general text extraction for the spike relation layer.
// Pure functions over claim/evidence strings. No dev-set, gold or case-id access.

export const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
const MULTIPLIERS={thousand:1e3,k:1e3,million:1e6,m:1e6,billion:1e9,bn:1e9};
const STOP=new Set(['the','a','an','was','were','is','are','be','been','of','in','on','for','to','and','or','that','this','it','its','as','at','by','with','from','than','then','greater','less','more','most','least','above','below','over','under','exceeds','exceed','exceeded','least','exactly','about','approximately','reported','reports','stated','states','came','line','earlier','later','new','newest','latest','disclosed','monthly','year','yearly','company','across','three','two','every','month','months','percent','usd','dollar','dollars','value','figure','number','amount','period','table','row','column','columns','shows','show','showed','grew','grow','growth','rose','rise','increased','increase','declined','decline','decreased','decrease','higher','lower','maintained','broadly','expansion','expanded','segment','segments','unit','units','division','divisions','subsidiary','group','peer','comparable','alone','final','audited','recap','reporting','reports']);

export function normalize(text){return String(text).toLowerCase().replace(/[\u2010-\u2015]/g,'-').trim();}

export function tokens(text){return normalize(text).match(/[a-z0-9][a-z0-9-]*/g)??[];}

// Content tokens: alphabetic tokens minus stopwords, numbers, months and years.
export function contentTokens(text){return tokens(text).filter(t=>!STOP.has(t)&&!MONTHS.includes(t)&&!/^(?:19|20)\d{2}$/.test(t));}

export function contentBigrams(text){const t=contentTokens(text);const out=[];for(let i=0;i+1<t.length;i++)out.push(t[i]+' '+t[i+1]);return out;}

// Quantities: number + optional multiplier + optional percent/currency marker.
export function quantities(text){
 const out=[];const re=/(?:usd\s*)?\$?\s*(\d+(?:\.\d+)?)\s*(thousand|million|billion|k|m|bn)?\s*(percent|%)?/g;let m;
 while((m=re.exec(normalize(text)))!==null){
  const raw=Number(m[1]);const mult=m[2]?MULTIPLIERS[m[2]]:1;
  const isPercent=Boolean(m[3]);
  // A bare four-digit year is a period, not a quantity.
  if(!m[2]&&!isPercent&&/^\d{4}$/.test(m[1])&&raw>=1900&&raw<=2099)continue;
  out.push({raw,mult,isPercent,value:isPercent?raw:raw*mult,span:[m.index,m.index+m[0].length],text:m[0].trim(),unit:isPercent?'percent':(m[2]?'scaled':'plain')});
}
 return out;
}

export function periods(text){
 const t=tokens(text);const months=t.filter(x=>MONTHS.includes(x));
 const years=t.filter(x=>/^(?:19|20)\d{2}$/.test(x));
 return {months:[...new Set(months)],years:[...new Set(years)]};
}

export function hasComparator(text){
 return /\b(greater than|more than|exceeds|exceeded|above|over|at least|less than|below|under|at most|fewer than|no more than|exactly|at the same level as)\b/.test(normalize(text));
}

// Returns the numeric predicate direction of a claim, if any.
export function comparator(text){
 const t=normalize(text);
 if(/\b(at least|no less than|not less than)\b/.test(t))return 'ge';
 if(/\b(at most|no more than|not more than)\b/.test(t))return 'le';
 if(/\bexactly\b/.test(t))return 'eq';
 if(/\b(greater than|more than|exceeds|exceeded|above|over)\b/.test(t))return 'gt';
 if(/\b(less than|below|under|fewer than)\b/.test(t))return 'lt';
 return null;
}

export function isLatestSeries(text){return /\b(latest|newest|most recent)\b/.test(normalize(text));}

export function isTrendClaim(text){return /\b(grew|grow|growth|rose|rise|increased|increase|expanded|expansion|higher)\b/.test(normalize(text));}

export function percentThreshold(text){
 const t=normalize(text);const m=t.match(/(?:by\s+)?(?:more than|at least|over|above)?\s*(\d+(?:\.\d+)?)\s*(?:percent|%)/);
 return m?Number(m[1]):null;
}

const HEDGES=/\b(may|might|suggests?|suggested|indications?|preliminary|estimate[sd]?|approximately|roughly|about|reported scale|on the reported scale|unclear|unconfirmed)\b/;
export function hedge(text){return HEDGES.test(normalize(text));}

export function truncated(text){return /\.\.\.|\u2026/.test(String(text));}

export function anaphoric(text){return /\b(the figure|the value|the number|the amount|it)\b/.test(normalize(text));}

// Explicit other-subject / wrong-scope markers, domain-general.
export function otherSubject(claimEvidencePair){
 const [claim,evidence]=claimEvidencePair.map(normalize);
 const others=['peer','competitor','a comparable company','an unrelated company','another company'];
 if(others.some(marker=>evidence.includes(marker)))return 'external_subject';
 if(/\b(subgroup|subsidiary|branch)\b/.test(evidence)&&/\b(group|consolidated|company)\b/.test(claim))return 'scope_narrower';
 return null;
}

// Claim metric bigram present in evidence?
export function metricOverlap(claim,evidence){
 const bigrams=contentBigrams(claim);const ev=new Set(contentBigrams(evidence));
 const hit=bigrams.find(b=>ev.has(b));
 if(hit)return hit;
 const ct=contentTokens(claim),et=new Set(contentTokens(evidence));
 const single=ct.find(t=>et.has(t)&&t.length>3);
 return single?null:hit;
}

export function sharesMetric(claim,evidence){return contentBigrams(claim).some(b=>new Set(contentBigrams(evidence)).has(b));}

export function compare(value,threshold,op){
 if(op==='gt')return value>threshold;
 if(op==='ge')return value>=threshold;
 if(op==='lt')return value<threshold;
 if(op==='le')return value<=threshold;
 if(op==='eq')return value===threshold;
 return null;
}
