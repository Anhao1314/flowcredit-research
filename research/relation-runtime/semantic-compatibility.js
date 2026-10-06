// CompatibilityAssessment over explicit SemanticFrames.
//
// Same frozen CompatibilityAssessment output shape; different input reading path.
// This path consumes recorded structured fields instead of reconstructing them
// from prose with the legacy reader.
import {assertRelationInput,deepFreeze} from '../claim-relation/contract.js';
import {assertSemanticFrame} from '../semantic-frame/project.js';

const family=unit=>{
 const value=String(unit??'').toLowerCase();
 if(value==='percent'||value==='%')return 'percent';
 if(value==='usd'||value.includes('dollar'))return 'currency';
 if(value==='count'||value==='people')return 'count';
 return value?value:null;
};
const basis=(side,literal)=>({side,literal:String(literal)});
const absent=(side,kind)=>({side,absent:kind});
const finding=(paths,basisEntries)=>deepFreeze({paths:[...paths],basis:[...basisEntries]});

export function semanticCompatibilityAssessment(relationInput,{claimFrame,evidenceFrame}){
 assertRelationInput(relationInput);
 assertSemanticFrame(claimFrame);
 assertSemanticFrame(evidenceFrame);

 if(claimFrame.subjectId!==evidenceFrame.subjectId){
  return deepFreeze({relationInput,disposition:'NOT_COMMENSURABLE',findings:[
   finding(['CP.subject'],[
    basis('claim',claimFrame.subjectId),
    basis('evidence',evidenceFrame.subjectId)
   ])
  ]});
 }

 if(claimFrame.proposition.assertionType==='QUANTITY_PREDICATE'){
  if(evidenceFrame.proposition.assertionType!=='NUMERIC_OBSERVATION'){
   return deepFreeze({relationInput,disposition:'NOT_COMMENSURABLE',findings:[
    finding(['CP.predicate'],[
     basis('claim',claimFrame.proposition.assertionType),
     basis('evidence',evidenceFrame.proposition.assertionType)
    ])
   ]});
  }
  const claimUnit=family(claimFrame.qualifiers.unit);
  const evidenceUnit=family(evidenceFrame.qualifiers.unit);
  if(!claimUnit||!evidenceUnit){
   const entries=[];
   if(!claimUnit)entries.push(absent('claim','unit'));
   if(!evidenceUnit)entries.push(absent('evidence','unit'));
   return deepFreeze({relationInput,disposition:'INDETERMINATE',findings:[finding(['QF.unit'],entries)]});
  }
  if(claimUnit!==evidenceUnit){
   return deepFreeze({relationInput,disposition:'NOT_COMMENSURABLE',findings:[
    finding(['QF.unit'],[
     basis('claim',claimFrame.qualifiers.unit),
     basis('evidence',evidenceFrame.qualifiers.unit)
    ])
   ]});
  }
 }

 return deepFreeze({relationInput,disposition:'COMMENSURABLE',findings:[]});
}
