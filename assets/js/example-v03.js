/* FlowCredit worked example plus the browser-side deterministic runner.

   The draft below is the front-end copy of agent/contracts/finch-test-input.json,
   the same fixture the contract and equivalence tests use. It exists so a visitor
   can see a finished v0.2.1 result without a local agent. Every number comes from
   that fixture; the frozen demo baselines are never repeated here.

   window.FC_RISK_RUN(draftInput, draftId) is pure: it touches no DOM, returns a
   payload the intake controller can consume, and reports invalid input instead of
   throwing. Scoring stays in assets/js/risk-engine-v021.js, which is generated
   from agent/src. */
(function () {
  "use strict";

  var EXAMPLE_DRAFT = {
    subjectId: "finch-contract-operator-01",
    label: "Contract Reference AI Operator",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    assessmentAsOf: "2026-09-01T00:00:00Z",
    modelTier: "flagship",
    taskType: "inference",
    rawTokensM: 80,
    inputTokensM: 64,
    outputTokensM: 16,
    validRatePct: 94,
    tokenBucketsM: { valid: 75.2, idle: 1.6, duplicate: 1.6, pulse: 0.8, unclassified: 0.8 },
    gpuHours: 4200,
    gpuModel: "h100-equivalent",
    revenueUsd: 100000,
    computeSpendUsd: 58000,
    repaymentRatePct: 96,
    overdue30Pct: 2,
    payingCustomers: 168,
    top5ConcentrationPct: 36,
    relatedPartyRevenuePct: 8,
    monthlySeries: [
      { period: "2026-03", rawTokensM: 72, validRatePct: 92, revenueUsd: 94000, computeSpendUsd: 55000 },
      { period: "2026-04", rawTokensM: 75, validRatePct: 93, revenueUsd: 96000, computeSpendUsd: 56000 },
      { period: "2026-05", rawTokensM: 77, validRatePct: 93, revenueUsd: 97000, computeSpendUsd: 56500 },
      { period: "2026-06", rawTokensM: 79, validRatePct: 94, revenueUsd: 99000, computeSpendUsd: 57500 },
      { period: "2026-07", rawTokensM: 81, validRatePct: 94, revenueUsd: 101000, computeSpendUsd: 59000 },
      { period: "2026-08", rawTokensM: 80, validRatePct: 94, revenueUsd: 100000, computeSpendUsd: 58000 }
    ],
    operatingHistoryDays: 720,
    dataCoveragePct: 100,
    R: [64, 65, 63, 67, 68, 66, 70, 71],
    C: [62, 63, 62, 65, 66, 65, 68, 69],
    loopWashRatePct: 2,
    currentExposure: 20000,
    evidence: [
      { fields: ["periodStart", "periodEnd", "inputTokensM", "outputTokensM", "validRatePct", "revenueUsd", "computeSpendUsd", "monthlySeries"], sourceDomain: "billing", verification: "system_api", observedAt: "2026-09-01T00:00:00Z", coveragePct: 100, referenceHash: "sha256:2f083fd14111819f0f35e9af881a51c4ef09f1ae7c7b2f82391a94f5e3641e23" },
      { fields: ["gpuHours", "gpuModel", "R", "C", "dataCoveragePct"], sourceDomain: "gpu_telemetry", verification: "system_api", observedAt: "2026-09-01T00:00:00Z", coveragePct: 100, referenceHash: "sha256:bb88b0840f232612a0e3f21262b51ac0276588dbe90b77e6f101dc3955711508" },
      { fields: ["repaymentRatePct", "overdue30Pct", "payingCustomers", "top5ConcentrationPct", "operatingHistoryDays"], sourceDomain: "bank_treasury", verification: "system_api", observedAt: "2026-09-01T00:00:00Z", coveragePct: 100, referenceHash: "sha256:f77056f01a934111be6e16b47fb2826ce4e7780ed13a2afad7cb8d3d297808c7" }
    ]
  };

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value == null ? {} : value)); }
    catch (error) { return {}; }
  }

  function unavailable(reason) {
    return { ok: false, unavailable: true, error: reason, fieldErrors: [], missingByGroup: {}, warnings: [] };
  }

  /* Runs the deterministic v0.2.1 engine in this tab and shapes the result like the
     sidecar payload the intake controller already renders. Never throws. */
  function run(draftInput, draftId) {
    var engine = window.FC_RISK;
    if (!engine || typeof engine.assessDraft !== "function" || typeof engine.coverage !== "function" || typeof engine.requiredActions !== "function") {
      return unavailable("The deterministic risk engine is not loaded in this browser.");
    }
    var assessment;
    try { assessment = engine.assessDraft(clone(draftInput)); }
    catch (error) { return unavailable("The deterministic assessment could not run on this input."); }
    var validation = assessment && assessment.validation || {};
    var fieldErrors = validation.errors || [];
    if (fieldErrors.length) {
      return {
        ok: false, fieldErrors: fieldErrors,
        missingByGroup: validation.missingByGroup || {}, warnings: validation.warnings || []
      };
    }
    var result = assessment.result || {};
    var coverage = engine.coverage(clone(draftInput));
    var payload = Object.assign({}, result, {
      draftId: draftId || result.draftId || null,
      productVersion: engine.productVersion,
      ruleVersion: result.ruleVersion || engine.ruleVersion,
      model: null, modelAnalysis: null, modelReview: null, sessionId: null,
      harnessStatus: "local-deterministic",
      readinessStatus: validation.readinessStatus || null,
      missingByGroup: validation.missingByGroup || {},
      evidenceCoverage: coverage,
      requiredActions: engine.requiredActions(validation, result, coverage),
      validation: { authoritative: "deterministic-v0.2.1", modelConflicts: [], ignoredInputs: validation.ignoredInputs || [] }
    });
    return { ok: true, result: payload, validation: validation };
  }

  window.FC_EXAMPLE = Object.freeze({ draft: EXAMPLE_DRAFT, source: "agent/contracts/finch-test-input.json" });
  window.FC_RISK_RUN = run;
})();
