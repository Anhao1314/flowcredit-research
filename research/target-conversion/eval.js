export const failureKinds=['TARGET_MISMATCH','INTERPRETATION_ERROR','COMPOUND_LITERAL_ERROR','CATEGORY_ERROR','PARSER_ERROR','VALIDATOR_REJECT','SUPPORT_AMBIGUOUS','UNKNOWN','RETRIEVAL_MISS','RANKING_MISS','INVALID_SELECTION_HANDLE','PROVIDER_TIMEOUT','PROVIDER_ERROR'];
export function decide({metrics,safety,gate}){
 const checks=Object.fromEntries(Object.entries(gate.safety).map(([k,v])=>[k,{actual:safety[k],expected:v,passed:safety[k]===v}]));
 checks.strict={actual:metrics.strictTargetConversion,expected:gate.capability.minimumStrictTargetConversions,passed:metrics.strictTargetConversion>=gate.capability.minimumStrictTargetConversions};
 checks.conditional={actual:metrics.strictGivenTop3.rate,expected:gate.capability.minimumConditionalTargetConversion,passed:metrics.strictGivenTop3.rate>=gate.capability.minimumConditionalTargetConversion};
 checks.wrongTarget={actual:metrics.validButWrongTargetCandidates,expected:gate.capability.maximumValidButWrongTargetCandidates,passed:metrics.validButWrongTargetCandidates<=gate.capability.maximumValidButWrongTargetCandidates};
 checks.complete={actual:metrics.cases,expected:16,passed:metrics.cases===16};
 const passed=Object.values(checks).every(c=>c.passed);return {decision:passed?'EVIDENCE ACQUISITION READY':'STAY ON TARGET CONVERSION',passed,checks};
}
