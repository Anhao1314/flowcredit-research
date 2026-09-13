/* One portable report for browser and local-agent assessments. */
(function () {
  "use strict";
  var App = window.App, ui = App.ui;
  function customReport(host, draft) {
    function snapshotFileName() {
      return "flowcredit-report-" + new Date().toISOString().slice(0, 10) + "-" + String(draft.draftId || "draft").slice(0, 8) + ".json";
    }
    function downloadJson(payload) {
      try {
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        var url = URL.createObjectURL(blob), link = document.createElement("a");
        link.href = url; link.download = snapshotFileName();
        document.body.appendChild(link); link.click(); link.remove();
        if (App.fn && App.fn.timeout) App.fn.timeout(function () { URL.revokeObjectURL(url); }, 0);
        else URL.revokeObjectURL(url);
      } catch (error) { ui.toast("The JSON snapshot could not be downloaded.", "warn"); }
    }
    var run = draft.result, m = run.tokenMetrics || {}, eq = run.evidenceQuality || {};
    function shown(value, suffix) { return value == null ? "Not computable" : ui.esc(value) + (suffix || ""); }
    function listScores(items) { return (items || []).map(function (item) { return '<li><span>' + ui.esc(String(item.name || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ')) + (item.score == null && item.reason ? '<small class="fc-score-reason">' + ui.esc(item.reason) + '</small>' : '') + '</span><b class="num">' + shown(item.score) + '</b></li>'; }).join(''); }
    function actionList(items) { return (items || []).map(function (item) { return '<li><b>P' + ui.esc(item.priority) + ' · ' + ui.esc(String(item.category || '').replace(/[-_]/g, ' ')) + '</b><span>' + ui.esc(item.message) + '</span></li>'; }).join(''); }
    var veto = run.vetoApplied === true, tone = veto ? "red" : run.decisionStatus === "enhanced-review" || run.decisionStatus === "insufficient-evidence" ? "amber" : "green";
    var coverage = run.evidenceCoverage || draft.evidenceCoverage;
    host.innerHTML = '<div class="v-page custom-report">' + ui.pageHead('03 / REPORT', draft.input.label || 'Custom operator', 'A Token-adjusted risk screen based only on the facts supplied in this session.') +
      '<nav class="report-section-nav v-action-row" aria-label="Report sections">' + ['Decision','Token metering','Activity','Business risk','Evidence','Limitations'].map(function (name,index) { return '<a class="btn btn-ghost" data-report-section="' + (index+1) + '" href="#report-section-' + (index+1) + '">' + name + '</a>'; }).join('') + '</nav>' +
      '<section class="v-panel" id="report-section-1" tabindex="-1"><div class="v-section-head"><div><p class="v-eyebrow">1 · EXECUTIVE DECISION</p><h2>' + ui.esc(String(run.decisionStatus || 'not rated').replace(/-/g, ' ')) + '</h2></div>' + ui.tag(String(run.grade || 'NOT RATED').toUpperCase(), tone) + '</div><div class="v-metrics">' + ui.metric('TAI', shown(run.tai), run.tokenActivityBand || 'Not computable') + ui.metric('CCI', shown(run.cci), 'Experimental risk rules') + ui.metric('Risk grade', shown(run.grade), 'Manual decision only') + ui.metric('Evidence', String(run.evidenceStrength || 'not-rated'), run.tokenMeteringStatus || 'not-computable') + '</div><p>' + ui.esc(run.trace || 'No explanatory summary is available.') + '</p></section>' +
      '<section class="v-panel" id="report-section-2" tabindex="-1"><div class="v-section-head"><div><p class="v-eyebrow">2 · TOKEN METERING</p><h2>Raw to valid business activity</h2></div></div><dl class="v-records"><div><dt>Reported raw</dt><dd class="num">' + shown(m.reportedRawTokensM, 'M') + '</dd></div><div><dt>Metered</dt><dd class="num">' + shown(m.meteredRawTokensM, 'M') + '</dd></div><div><dt>Normalized</dt><dd class="num">' + shown(m.normalizedTokensM, 'M') + '</dd></div><div><dt>Valid NT</dt><dd class="num">' + shown(m.validNT_M, 'M') + '</dd></div><div><dt>Revenue / Valid NT</dt><dd class="num">' + shown(m.revenuePerValidNTM) + '</dd></div></dl></section>' +
      '<section class="v-panel" id="report-section-3" tabindex="-1"><div class="v-section-head"><div><p class="v-eyebrow">3 · TAI COMPOSITION</p><h2>Activity coherence</h2></div></div><ul class="intake-score-list">' + listScores(run.tokenComponents) + '</ul></section>' +
      '<section class="v-panel" id="report-section-4" tabindex="-1"><div class="v-section-head"><div><p class="v-eyebrow">4 · CREDIT-RISK SCREEN</p><h2>Repayment and operating dimensions</h2></div></div><ul class="intake-score-list">' + listScores(run.anchors) + '</ul><p class="v-caption">TAI contributes 40%. PD, expected loss, a numeric limit and automatic approval are not produced.</p></section>' +
      '<section class="v-panel" id="report-section-5" tabindex="-1"><div class="v-section-head"><div><p class="v-eyebrow">5 · EVIDENCE AND INTEGRITY</p><h2>' + (veto ? 'Confirmed integrity Veto' : 'No confirmed Veto') + '</h2></div>' + ui.tag(veto ? 'CONFIRMED VETO' : 'NO CONFIRMED VETO', veto ? 'red' : 'green') + '</div><p>EQS: <b class="num">' + shown(eq.score) + '</b> · ' + ui.esc(run.evidenceStrength || 'not-rated') + '</p>' + (coverage ? '<div class="fc-coverage-summary"><span><b class="num">' + ui.esc(coverage.covered) + '</b><small>Covered</small></span><span><b class="num">' + ui.esc(coverage.missingEvidence) + '</b><small>Needs evidence</small></span><span><b class="num">' + ui.esc(coverage.missingData) + '</b><small>Missing data</small></span><span><b class="num">' + ui.esc(coverage.serverDerived) + '</b><small>Server-derived</small></span></div><p class="v-caption">' + ui.esc(coverage.covered) + ' of ' + ui.esc(coverage.total) + ' decision fields have field-level evidence.</p>' : '') + '<ul class="intake-issues">' + (run.integritySignals || []).concat(run.confirmedIntegrityEvents || []).map(function (item) { return '<li>' + ui.esc(item.message || item.code || String(item)) + '</li>'; }).join('') + '</ul></section>' +
      '<section class="v-panel" id="report-section-6" tabindex="-1"><div class="v-section-head"><div><p class="v-eyebrow">6 · METHODOLOGY AND LIMITATIONS</p><h2>What this result does not claim</h2></div></div><div class="fc-report-actions"><h3>What to provide next</h3>' + ((run.requiredActions || []).length ? '<ol class="intake-action-list">' + actionList(run.requiredActions) + '</ol>' : '<p>No additional input is required by the current deterministic screen.</p>') + '</div><ul class="intake-issues">' + (run.limitations || []).map(function (item) { return '<li>' + ui.esc(item) + '</li>'; }).join('') + '</ul><h3>D. Limitations and disclaimer</h3><p class="v-caption">This is a conservative risk screen, not a statutory audit, lending decision or financial advice. TAI measures activity coherence, not revenue or creditworthiness.</p></section>' +
      '<details class="v-details" id="report-consistency"><summary>Local consistency check <span>Optional · does not verify source authenticity</span></summary><div class="v-details-body"><p>This mock-hash proof checks only internal consistency of supplied records. It is not a cryptographic attestation or a blockchain transaction.</p><button class="btn btn-ghost" id="anchor-btn" type="button"><span id="anchor-btn-label">' + (draft.proof ? 'Create another local proof' : 'Create local proof') + '</span></button>' + (draft.proof ? '<p class="num intake-proof">' + ui.esc(draft.proof.root) + '</p><button class="btn" id="verify-btn" type="button">Check stored paths</button>' : '') + '<div id="chain-log" role="status" aria-live="polite"></div></div></details>' +
      '<details class="v-details" id="report-scenario"><summary>Scenario appendix <span>Preset illustration · not a forecast</span></summary><div class="v-details-body"><p>This historical scenario uses fixed demonstration values. It does not change this assessment, simulate your supplied business or monitor live activity.</p><dl class="v-records">' + App.fn.stressFrames.phases.map(function (phase) { return '<div><dt>' + ui.esc(phase.key) + '</dt><dd class="num">Illustrative HF ' + ui.esc(phase.hf) + ' · illustrative limit ' + ui.esc(phase.credit) + '</dd></div>'; }).join('') + '</dl></div></details>' +
      '<div class="v-action-row"><a class="btn" href="#/ingest">Edit input</a><a class="btn" href="#/audit">Ask about this result</a><button class="btn" id="report-print" type="button">Print / Save PDF</button><button class="btn" id="report-export" type="button">Download JSON</button></div></div>';
    host.querySelectorAll('[data-report-section]').forEach(function (link) { link.addEventListener('click', function (event) { event.preventDefault(); var section = host.querySelector('#report-section-' + link.getAttribute('data-report-section')); section.focus({preventScroll:true}); section.scrollIntoView({block:'start'}); }); });
    host.querySelector('#anchor-btn').addEventListener('click', function () { FC_INTAKE.proof(); });
    var verifyButton = host.querySelector('#verify-btn');
    if (verifyButton) verifyButton.addEventListener('click', function () {
      var proof = draft.proof;
      var valid = proof && Array.isArray(proof.levels) && Array.isArray(proof.levels[0]) && proof.levels[0].length === 4 && proof.levels[0].every(function (leaf, index) { return App.fn.verifyProof(leaf, App.fn.merkleProof(proof.levels, index).path, proof.root); });
      host.querySelector('#chain-log').textContent = valid ? 'All four stored paths match. Source authenticity is not verified.' : 'The stored proof does not match.';
    });
    var printButton = host.querySelector('#report-print');
    if (printButton) printButton.addEventListener('click', function () { document.body.classList.remove('report-overlay-open'); window.print(); });
    var exportButton = host.querySelector('#report-export');
    if (exportButton) exportButton.addEventListener('click', function () {
      if (!window.FC_INTAKE || typeof FC_INTAKE.snapshot !== 'function') { ui.toast('The JSON snapshot is unavailable in this browser.', 'warn'); return; }
      var payload = FC_INTAKE.snapshot(draft.draftId);
      if (!payload) { ui.toast('There is no saved assessment to export.', 'warn'); return; }
      downloadJson(payload);
    });
  }
  function render(host) {
    var draft = window.FC_INTAKE && FC_INTAKE.active();
    if (draft && draft.status === 'complete' && draft.result) { customReport(host, draft); return; }
    host.innerHTML = '<div class="v-page">' + ui.pageHead('03 / REPORT', 'A report you can take with you.', 'Complete an assessment before printing or exporting it.') + ui.pending('No completed assessment', 'Explore a worked example or run an assessment with your facts.', '#/workspace', 'Open workspace') + '</div>';
  }
  App.views = App.views || {};
  App.views.report = { render: render };
  App.report = { open: function () { App.nav('#/report'); }, close: function () {}, isOpen: function () { return false; } };
})();
