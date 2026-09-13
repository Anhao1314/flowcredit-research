/* Deterministic result presentation shared by online and offline assessments. */
(function () {
  "use strict";
  var App = window.App, u = App.ui;
  function value(number, suffix) {
    return number == null ? "Not computable" : u.esc(number) + (suffix || "");
  }
  function words(text) { return String(text || "not rated").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " "); }
  function itemText(item) {
    return typeof item === "string" ? item : item && (item.message || item.note || item.name || item.code) || "Unspecified finding";
  }
  function scoreRows(items, weights) {
    return (items || []).map(function (item) {
      var score = Number(item.score), computable = item.score != null && isFinite(score), width = computable ? Math.max(0, Math.min(100, score)) : 0;
      return '<div class="fc-score-row"><div class="fc-score-head"><span>' + u.esc(words(item.name)) +
        (weights && weights[item.name] ? '<small> · ' + weights[item.name] + '</small>' : '') +
        '</span><b class="num">' + (computable ? u.esc(item.score) : "Not computable") +
        '</b></div><span class="fc-score-track"><span class="fc-score-fill fc-state-' + u.esc(item.state || "y") + '" style="width:' + width + '%"></span></span>' + (!computable && item.reason ? '<small class="fc-score-reason">' + u.esc(item.reason) + '</small>' : '') + '</div>';
    }).join("");
  }
  function coverageHtml(coverage) {
    if (!coverage) return '<p class="v-caption">Field-level evidence coverage is unavailable for this result.</p>';
    return '<div class="fc-coverage-summary" aria-label="Evidence coverage summary">' +
      '<span><b class="num">' + u.esc(coverage.covered) + '</b><small>Covered</small></span>' +
      '<span><b class="num">' + u.esc(coverage.missingEvidence) + '</b><small>Needs evidence</small></span>' +
      '<span><b class="num">' + u.esc(coverage.missingData) + '</b><small>Missing data</small></span>' +
      '<span><b class="num">' + u.esc(coverage.serverDerived) + '</b><small>Server-derived</small></span></div>' +
      '<p class="v-caption">Coverage is measured across ' + u.esc(coverage.total) + ' decision fields; evidence quality also considers provenance, recency, consistency and source independence.</p>';
  }
  function actionsHtml(actions) {
    var items = actions || [];
    return '<section class="fc-result-section fc-next-actions"><div class="v-section-head"><h3>What to provide next</h3><span class="v-muted">Prioritized completion path</span></div>' +
      (items.length ? '<ol>' + items.map(function (item) { return '<li><span class="num">P' + u.esc(item.priority) + '</span><div><b>' + u.esc(words(item.category)) + '</b><p>' + u.esc(item.message) + '</p>' + (item.fields && item.fields.length ? '<small>' + u.esc(item.fields.map(App.fieldLabel).join(' · ')) + '</small>' : '') + '</div></li>'; }).join('') + '</ol>' : '<p>No additional input is required by the current deterministic screen.</p>') + '</section>';
  }
  function tokenChain(run) {
    var m = run.tokenMetrics || {}, correlation = m.tokenRevenueCorrelation;
    var nodes = [
      ["Reported raw", value(m.reportedRawTokensM, "M"), "Applicant billing total"],
      ["Metered", value(m.meteredRawTokensM, "M"), "Input + output reconciled"],
      ["Normalized", value(m.normalizedTokensM, "M"), "Rule-defined model and task weights"],
      ["Valid NT", value(m.validNT_M, "M"), m.validRatePct == null ? "Validity not computable" : m.validRatePct + "% classified valid"],
      ["Business linkage", value(m.revenuePerValidNTM, " USD/M"), correlation == null ? "Correlation not computable" : "Token–revenue correlation " + correlation],
      ["TAI", value(run.tai), words(run.tokenActivityBand)]
    ];
    return '<div class="fc-token-chain" aria-label="Token metering chain">' + nodes.map(function (node, index) {
      return '<div class="fc-token-node"><span class="fc-token-step num">0' + (index + 1) + '</span><small>' + u.esc(node[0]) + '</small><b class="num">' + node[1] + '</b><p>' + u.esc(node[2]) + '</p></div>' +
        (index < nodes.length - 1 ? '<span class="fc-token-arrow" aria-hidden="true">→</span>' : '');
    }).join("") + '</div>';
  }
  function liveHtml(run, key) {
    var veto = run.vetoApplied === true || run.verdict === "reject";
    var tone = veto ? "red" : run.decisionStatus === "simulation-only" || run.decisionStatus === "enhanced-review" || run.decisionStatus === "insufficient-evidence" ? "amber" : "green";
    var eq = run.evidenceQuality || {}, signals = run.integritySignals || [], confirmed = run.confirmedIntegrityEvents || [];
    var weights = { ai_token_activity: "40%", repayment_quality: "25%", customer_resilience: "15%", unit_economics: "10%", operating_continuity: "10%" };
    var evidenceValue = run.evidenceStrength === "simulated" ? "Simulated" : eq.score == null ? words(run.evidenceStrength) : eq.score + " / 100";
    return '<section class="v-panel ai-card ai-card-report fc-live-screen" data-subject="' + u.esc(key) + '">' +
      '<div class="v-section-head"><div><p class="v-eyebrow">DETERMINISTIC ASSESSMENT</p><h2>Token-adjusted risk screen</h2></div>' +
      u.tag(words(run.decisionStatus).toUpperCase(), tone) + '</div>' +
      '<p class="fc-live-provenance">Experimental rules · ' + (run.model ? 'Optional explanation by ' + u.esc(run.model) : 'Runs in this browser') + '</p>' +
      '<div class="fc-decision-line"><div><small>Decision status</small><strong>' + u.esc(words(run.decisionStatus)) + '</strong>' +
      (run.simulatedDecisionStatus ? '<span>Scenario outcome: ' + u.esc(words(run.simulatedDecisionStatus)) + '</span>' : '') + '</div>' +
      '<div class="fc-integrity-state ' + (veto ? 'is-veto' : '') + '"><small>Integrity</small><strong>' + (veto ? 'Confirmed Veto' : 'No confirmed Veto') + '</strong></div></div>' +
      '<div class="v-metrics fc-primary-metrics">' +
      u.metric("AI Token Activity Index", value(run.tai), "TAI / 100 · " + words(run.tokenActivityBand)) +
      u.metric("Credibility index", value(run.cci), "CCI / 1,000 · 40% TAI") +
      u.metric("Risk grade", value(run.grade), "Manual-review screen") +
      u.metric("Evidence", evidenceValue, words(run.tokenMeteringStatus) + " metering") + '</div>' +
      '<section class="fc-result-section"><div class="v-section-head"><h3>Token metering chain</h3><span class="v-muted">Rule-defined conversion</span></div>' + tokenChain(run) + '</section>' +
      '<div class="fc-result-grid"><section class="fc-result-section"><div class="v-section-head"><h3>TAI composition</h3><span class="v-muted">Activity coherence</span></div>' +
      scoreRows(run.tokenComponents) + '</section><section class="fc-result-section"><div class="v-section-head"><h3>CCI composition</h3><span class="v-muted">40 / 25 / 15 / 10 / 10</span></div>' +
      scoreRows(run.anchors, weights) + '</section></div>' +
      '<div class="fc-result-grid"><section class="fc-result-section fc-evidence"><div class="v-section-head"><h3>Evidence quality</h3>' + u.tag(String(run.evidenceStrength || "not-rated").toUpperCase(), run.evidenceStrength === "high" ? "green" : "neutral") + '</div>' +
      '<p><b>' + u.esc(evidenceValue) + '</b> · ' + u.esc(run.evidenceStrength === "simulated" ? "Source independence not rated for simulations" : eq.independentDomains == null ? "Source count not rated" : eq.independentDomains + " independent non-self domains") + '</p>' +
      '<p class="v-caption">' + u.esc((eq.caps || []).join(" · ") || "No evidence-quality cap recorded") + '</p>' + coverageHtml(run.evidenceCoverage) + '</section>' +
      '<section class="fc-result-section fc-integrity"><div class="v-section-head"><h3>Integrity findings</h3>' + u.tag(veto ? "CONFIRMED VETO" : "NO CONFIRMED VETO", veto ? "red" : "green") + '</div>' +
      (signals.length ? '<ul>' + signals.map(function (x) { return '<li><b>Signal</b> · ' + u.esc(itemText(x)) + '</li>'; }).join("") + '</ul>' : '<p>No ordinary integrity signal recorded.</p>') +
      (confirmed.length ? '<ul class="fc-confirmed-list">' + confirmed.map(function (x) { return '<li><b>Confirmed</b> · ' + u.esc(itemText(x)) + '</li>'; }).join("") + '</ul>' : '') + '</section></div>' + actionsHtml(run.requiredActions) +
      '<section class="fc-ai-review"><div class="v-section-head"><h3>Assessment explanation</h3><span class="v-muted">Does not change scores</span></div><p class="ai-trace">' + u.esc(run.trace || "No explanation available.") + '</p>' +
      '<p class="v-caption v-hash">Facts snapshot ' + u.esc(run.factsSha256 || "unavailable") + '</p></section>' +
      '<details class="v-details fc-limitations"><summary>Method limits and evidence references</summary><div class="v-details-body"><ul>' +
      (run.limitations || []).map(function (x) { return '<li>' + u.esc(x) + '</li>'; }).join("") +
      '</ul><p class="v-caption">TAI measures activity coherence. It is not revenue, a credit limit or a probability of default.</p></div></details></section>';
  }
  App.liveResultHtml = liveHtml;
})();
