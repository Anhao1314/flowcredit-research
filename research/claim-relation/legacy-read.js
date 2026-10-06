// Legacy evaluation path (CM-32.3): read authoritative recorded field values and
// semantics explicitly stated in the recorded statement text, without promoting
// anything into frozen slot names (CM-32.3.2a, RI-9.2, RI-25.3).
//
// This module is a migration bridge (CM-32.2.4), not a semantic layer:
//   - it only reads what the pinned record states;
//   - it abstains (marks a path unreadable) instead of guessing (CM-32.4.1);
//   - every readable fact carries a literal basis drawn from the record, so the
//     assessment can be re-derived and audited (CM-17.3, CM-40.3).
// It replaces nothing: when real semantic projections exist (RI-9.x), materialized
// sides resolve from them and this bridge is no longer needed.

const MONTHS=Object.freeze(['january','february','march','april','may','june','july','august','september','october','november','december']);
const SCALES=Object.freeze({thousand:1e3,k:1e3,million:1e6,m:1e6,billion:1e9,bn:1e9});
// CM-21.x unit families and CM-19.2b measurement kinds.
const FAMILY_TOKENS=Object.freeze([
 ['currency',/\b(?:usd|dollars?|us\$)\b|\$/i],
 ['percent',/\bpercent\b|%/i],
 ['count',/\b(?:people|persons?|employees?|headcount|staff)\b/i]
]);
const KIND_OF_FAMILY=Object.freeze({currency:'amount',percent:'ratio',count:'count'});
// CM-19.2a family: office/administrative statements and reporting-classification
// statements. Interim legacy vocabulary (CM-32.2.4); CM-19.2a names the family,
// not this token list.
const ADMINISTRATIVE_MARKERS=Object.freeze([
 ['administrative',/\b(?:office address|changed its office|another office|office)\b/],
 ['reporting_classification',/\b(?:segment heading|reported under|reporting (?:department|team))\b/]
]);
// Explicit statements of absence (CM-32.3.1b): the record itself says the value or
// the period is not given. Reading this is not inference.
const ABSENT_AMOUNT=/\bno amount\b/;
const ABSENT_PERIOD=/\bno (?:reporting )?period\b/;
const TRUNCATED=/\.\.\.|\u2026/;
// CM-18.3: an unresolved referent is unreadable; it MUST NOT be resolved from
// context or plausibility. Only statements with no named metric qualify.
const ANAPHOR_PHRASE=/the (?:figure|value|number|amount|total)/i;
const ANAPHOR_HEAD=/\b(?:figure|value|number|amount|total)\b/;
const LATEST_REFERENCE=/\b(?:latest|newest|most recent)\b/;
const DIRECTION=/\b(?:grew|grow|growth|rose|rise|rising|increased|increase|increased|expanded|expansion|declined|decline|decreased|decrease|contracted|higher|lower|fell|maintained|sustained)\b/;
// Tokens that carry no metric/referent semantics when testing whether an anaphoric
// subject was ever named. Nothing here classifies a metric.
const NON_REFERENT=new Set(['the','a','an','was','were','is','are','be','been','of','in','on','for','to','and','or','that','this','it','its','as','at','by','with','from','than','then','above','below','over','under','exactly','about','approximately','reported','reports','states','stated','figure','value','number','amount','total','usd','dollar','dollars','percent','table','row','rows','column','columns','reported','scale',...MONTHS]);
// Table-form readability (CM-31.1: claimed column absent; row without a header).
const TABLE_COLUMNS=/\btable\b[^.;]*\bcolumns?\s*:/;
const TABLE_ROW_WITHOUT_LABEL=/\brows?\s*:/;

export function normalize(text){return String(text??'').toLowerCase().replace(/[\u2010-\u2015]/g,'-').replace(/\s+/g,' ').trim();}

function familyOfUnitField(unit){
 const value=normalize(unit);
 if(!value||value==='quoted_text')return null;
 for(const [family,pattern] of FAMILY_TOKENS)if(pattern.test(value))return family;
 return null;
}

// Quantities explicitly stated in the text: number, optional scale word, optional
// unit-family token. A bare four-digit year is a period, never a quantity.
export function quantities(statement){
 const raw=String(statement??''),out=[];
 // Scan the recorded statement itself so every literal basis is a raw substring
 // of the pinned record (CM-17.3).
 const pattern=/(\d+(?:\.\d+)?)\s*(thousand|million|billion|k|m|bn)?/gi;
 let match;
 while((match=pattern.exec(raw))!==null){
  const [full,digits,scaleWord]=match;
  if(!scaleWord&&/^(?:19|20)\d{2}$/.test(digits))continue;
  const tail=raw.slice(match.index+full.length,match.index+full.length+18);
  let family=null,familyToken='';
  for(const [name,familyPattern] of FAMILY_TOKENS){const found=familyPattern.exec(tail);if(found){family=name;familyToken=found[0];break;}}
  const literal=familyToken?`${full} ${familyToken}`.replace(/\s+/g,' ').trim():full.trim();
  out.push(Object.freeze({value:Number(digits),scale:scaleWord??null,family,kind:family?KIND_OF_FAMILY[family]:null,literal,index:match.index}));
 }
 return out;
}

// Content tokens that are neither temporal, numeric, unit-shaped nor function words.
export function referentTokens(statement){
 return (normalize(statement).match(/[a-z][a-z-]*/g)??[]).filter(token=>!NON_REFERENT.has(token)&&!/^(?:19|20)\d{2}$/.test(token));
}

export function periodTokens(statement){
 const text=normalize(statement);
 const months=MONTHS.filter(name=>new RegExp(`\\b${name}\\b`).test(text));
 const years=[...new Set(text.match(/\b(?:19|20)\d{2}\b/g)??[])];
 return Object.freeze({months:Object.freeze(months),years:Object.freeze(years)});
}

// One side's recorded material, as pinned by the RelationInput (RI-13.1).
export function sideRecord(role,record){
 return Object.freeze({
  role,
  statement:String(record.statement??''),
  metric:record.metric??null,
  normalizedValue:record.normalizedValue??null,
  unit:record.unit??null,
  periodStart:record.periodStart??null,
  periodEnd:record.periodEnd??null,
  observedAt:record.observedAt??null,
  recordedAt:record.recordedAt??null,
  effectiveAt:record.effectiveAt??null
 });
}

// Produce the per-side reading facts the Compatibility runtime consumes. Every
// readable fact carries the literal basis it was read from; every unreadable fact
// names the path that could not be read and the literal that states its absence.
export function readSide(role,record){
 const source=sideRecord(role,record);
 const text=normalize(source.statement);
 const recordedFamily=familyOfUnitField(source.unit);
 const found=quantities(source.statement);
 const periods=periodTokens(source.statement);
 const tableColumns=TABLE_COLUMNS.test(text);
 const tableRowUnlabelled=TABLE_ROW_WITHOUT_LABEL.test(text);
 const administrative=ADMINISTRATIVE_MARKERS.map(([family,pattern])=>pattern.test(text)?family:null).find(Boolean)??null;
 const quantity=found[0]??null;
 const resolvedQuantity=quantity&&quantity.family===null&&recordedFamily?Object.freeze({...quantity,family:recordedFamily,kind:KIND_OF_FAMILY[recordedFamily]}):quantity;

 // CM-18.3 referent readability: an anaphoric subject stays unresolved unless the
 // side names something other than the anaphor itself; no referent is manufactured
 // from context or plausibility (CM-18.3, CM-18.5).
 const anaphorHead=(text.match(ANAPHOR_HEAD)??[])[0]??null;
 const anaphoric=Boolean(anaphorHead)&&referentTokens(source.statement).length===0;
 const referent=Object.freeze(anaphoric
  ?{readable:false,basis:(String(source.statement).match(ANAPHOR_PHRASE)??[anaphorHead])[0],reason:'referent_unresolved'}
  :{readable:true,basis:null,reason:null});

 // CM-31.1 readability of the predicate: the table forms that carry no readable
 // predicate (column listing without the claimed column; row without a header).
 const predicate=Object.freeze(tableColumns
  ?{readable:false,basis:(text.match(TABLE_COLUMNS)??['columns'])[0],reason:'table_columns_without_claimed_column'}
  :tableRowUnlabelled
   ?{readable:false,basis:(text.match(TABLE_ROW_WITHOUT_LABEL)??['row:'])[0],reason:'row_without_header'}
   :{readable:true,basis:null,reason:null});

 // CM-31.1 value-form readability (truncated statement; absence explicitly stated).
 const absentAmount=ABSENT_AMOUNT.test(text),truncated=TRUNCATED.test(text);
 const value=Object.freeze(absentAmount
  ?{readable:false,basis:(text.match(ABSENT_AMOUNT)??['no amount'])[0],reason:'value_absent'}
  :truncated
   ?{readable:false,basis:(String(source.statement).match(TRUNCATED)??['...'])[0],reason:'value_truncated'}
   :{readable:true,basis:null,reason:null});

 // CM-19.2a/CM-19.3 classification of what the side asserts.
 const kind=resolvedQuantity?'quantity':administrative?'statement':DIRECTION.test(text)?'direction':'statement';
 const assertion=Object.freeze({kind,family:kind==='statement'?administrative:null,basis:resolvedQuantity?resolvedQuantity.literal:administrative?(text.match(ADMINISTRATIVE_MARKERS.find(([name])=>name===administrative)[1])??[administrative])[0]:null});

 // CM-22.2 timeline readability: explicit months/years, or latest-referenced wording.
 const absentPeriod=ABSENT_PERIOD.test(text);
 const timeline=Object.freeze({
  readable:!absentPeriod&&(periods.months.length>0||periods.years.length>0),
  months:periods.months,
  years:periods.years,
  latestReferenced:LATEST_REFERENCE.test(text),
  basis:absentPeriod?(text.match(ABSENT_PERIOD)??['no period'])[0]:(periods.months[0]??periods.years[0]??null),
  reason:absentPeriod?'period_absent':periods.months.length||periods.years.length?null:'period_unstated'
 });
 // CM-21.2/CM-21.3 unit readability: the comparison depends on the unit when both
 // sides state quantities; an unresolved family is then insufficiency, not conflict.
 const unit=Object.freeze({family:resolvedQuantity?resolvedQuantity.family:null,scale:resolvedQuantity?resolvedQuantity.scale:null,basis:resolvedQuantity?resolvedQuantity.literal:null});

 return Object.freeze({side:role,statement:source.statement,recorded:source,predicate,assertion,quantity:resolvedQuantity,quantityCount:found.length,value,referent,timeline,unit,administrative});
}

export function readPair({claim,evidence}){
 return Object.freeze({claim:readSide('claim',claim),evidence:readSide('evidence',evidence)});
}
