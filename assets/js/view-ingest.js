/* FlowCredit v0.3.1 task-first assessment intake. */
(function () {
  "use strict";
  var App = window.App, ui = App.ui, modeByDraft = {}, FILE_LIMIT = 65536;

  var LABELS = { label: 'Business name', subjectId: 'Internal reference', periodStart: 'Period start', periodEnd: 'Period end', modelTier: 'Model class', inputTokensM: 'Input Tokens (M)', outputTokensM: 'Output Tokens (M)', rawTokensM: 'Reported Raw Tokens (M)', validRatePct: 'Claimed valid rate (%)', gpuModel: 'GPU category', gpuHours: 'GPU-hours', revenueUsd: 'Revenue (USD)', computeSpendUsd: 'Compute spend (USD)', repaymentRatePct: 'Collection rate (%)', overdue30Pct: '30-day overdue rate (%)', payingCustomers: 'Paying customers', top5ConcentrationPct: 'Top-5 concentration (%)', customerHHI: 'Customer concentration index', relatedPartyRevenuePct: 'Related-party revenue (%)', monthlySeries: 'Monthly history', operatingHistoryDays: 'Operating history (days)', dataCoveragePct: 'Data coverage (%)', R: 'Declared activity series', C: 'Cross-check activity series', evidence: 'Evidence records', taskType: 'Task type', normalizationProfileId: 'Rule-defined normalization profile', peerProfileId: 'Rule-defined comparison profile', monthlyRevenueUsd: 'Monthly revenue', monthlyComputeSpendUsd: 'Monthly compute spend', tokenBucketsM: 'Token classification buckets' };
  function labelFor(key) { return LABELS[key] || key; }
  function consentHtml(id, checked, text) { return '<label class="intake-consent"><input id="' + id + '" type="checkbox"' + (checked ? ' checked' : '') + '><span>' + esc(text) + '</span></label>'; }
  function esc(value) { return ui.esc(value == null ? "" : value); }
  function value(input, key) { return input && input[key] != null ? input[key] : ""; }
  function field(key, label, input, options) {
    options = options || {};
    var type = options.type || "text", kind = options.kind || (type === "number" ? "number" : "text");
    var minmax = type === "number" ? ' min="' + (options.min == null ? 0 : options.min) + '"' + (options.max == null ? "" : ' max="' + options.max + '"') + ' step="' + (options.step || "any") + '"' : "";
    return '<label class="intake-field"><span>' + esc(label) + (options.optional ? ' <small>Optional</small>' : '') + '</span><input type="' + type + '" data-field="' + key + '" data-kind="' + kind + '" value="' + esc(value(input, key)) + '"' + minmax + (options.placeholder ? ' placeholder="' + esc(options.placeholder) + '"' : '') + '><em data-error-for="' + key + '"></em></label>';
  }
  function selectField(key, label, input, choices) {
    return '<label class="intake-field"><span>' + esc(label) + '</span><select data-field="' + key + '">' + choices.map(function (item) { return '<option value="' + esc(item[0]) + '"' + (value(input, key) === item[0] ? " selected" : "") + '>' + esc(item[1]) + '</option>'; }).join("") + '</select><em data-error-for="' + key + '"></em></label>';
  }
  function area(key, label, input, placeholder) {
    var current = value(input, key), text = typeof current === "string" ? current : current ? JSON.stringify(current, null, 2) : "";
    return '<label class="intake-field intake-wide"><span>' + esc(label) + '</span><textarea rows="4" data-field="' + key + '" data-kind="json" placeholder="' + esc(placeholder || "") + '">' + esc(text) + '</textarea><em data-error-for="' + key + '"></em></label>';
  }
  function seriesField(key, label, input) {
    var current = value(input, key), text = Array.isArray(current) ? current.join(", ") : current;
    return '<label class="intake-field"><span>' + esc(label) + '</span><input data-field="' + key + '" data-kind="series" value="' + esc(text) + '" placeholder="62, 63, 65, 66, 68, 69"><em data-error-for="' + key + '"></em></label>';
  }
  function entryHtml() {
    return '<div class="v-page intake-page">' + ui.pageHead('NEW ASSESSMENT', 'What would you like to assess?', 'Describe the business, import structured data, or enter the facts manually.') +
      '<section class="intake-hero v-panel"><div class="intake-entry-grid">' +
      '<button class="intake-entry" type="button" data-new-mode="description"><span>01</span><b>Describe a case</b><small>Let AI organize supplied facts into a draft.</small></button>' +
      '<button class="intake-entry" type="button" data-new-mode="json"><span>02</span><b>Import JSON</b><small>Paste or open a structured file in your browser.</small></button>' +
      '<button class="intake-entry" type="button" data-new-mode="manual"><span>03</span><b>Enter manually</b><small>Complete a guided operating-data form.</small></button></div>' +
      '<p class="v-caption">Drafts stay in this browser. The deterministic risk rules ship with this page; only AI text extraction and explanation use the local agent.</p></section>' +
      (!window.FC_LIVE ? '<div class="v-notice"><p><b>Deterministic assessment runs in your browser.</b> Only AI text extraction and explanation need the local agent.</p></div>' : '') + '</div>';
  }
  function modeHtml(draft, mode) {
    if (mode === "description") return '<section class="v-panel intake-source"><div class="v-section-head"><div><p class="v-eyebrow">DESCRIBE A CASE</p><h2>Start with what you know.</h2></div></div>' +
      '<label class="intake-field intake-wide"><span>Business and assessment context</span><textarea id="intake-description" rows="7" maxlength="10000" placeholder="Assess an AI inference provider using its last six months of Token usage, GPU activity, revenue and repayment data.">' + esc(draft.rawText || "") + '</textarea></label>' +
      consentHtml('intake-extract-consent', draft.extractionConsent, 'Send this text to DeepSeek to organize it into a draft. The model cannot score the case.') +
      '<div class="v-action-row"><button class="btn btn-primary" id="intake-extract" type="button"' + (draft.status === "extracting" ? " disabled" : "") + '>' + (draft.status === "extracting" ? "Organizing…" : draft.lastError ? "Retry extraction" : "Organize into draft") + '</button><button class="btn" data-mode="json" type="button">Import JSON</button><button class="btn" data-mode="manual" type="button">Enter manually</button></div><div id="intake-source-status" class="' + (draft.lastError ? 'intake-status bad' : '') + '" role="status" aria-live="polite">' + esc(draft.lastError || '') + '</div></section>';
    if (mode === "json") return '<section class="v-panel intake-source"><div class="v-section-head"><div><p class="v-eyebrow">IMPORT JSON</p><h2>Bring structured data into this browser.</h2></div><span class="v-muted">64 KB maximum</span></div>' +
      '<label class="intake-field intake-wide"><span>JSON object <small>64 KB maximum</small></span><textarea id="intake-json" rows="8" maxlength="65536" placeholder="{ &quot;label&quot;: &quot;Example operator&quot;, &quot;inputTokensM&quot;: 64 }"></textarea></label>' +
      '<div class="v-action-row"><button class="btn btn-primary" id="intake-parse-json" type="button">Review JSON</button><label class="btn intake-file">Open .json<input type="file" id="intake-file" accept="application/json,.json"></label><button class="btn" data-mode="manual" type="button">Enter manually</button></div><div id="intake-source-status" role="status" aria-live="polite"></div></section>';
    return "";
  }
  function formHtml(draft) {
    var d = draft.input || {}, errors = draft.errors || [];
    function openFor(keys) { return errors.some(function (item) { return keys.indexOf(item.field) >= 0; }) ? ' open' : ''; }
    return '<form id="intake-form" novalidate><section class="v-panel intake-form-section"><div class="v-section-head"><div><p class="v-eyebrow">START WITH NINE FACTS</p><h2>Who, when and how much?</h2></div></div><p>A limited assessment is available with basic operating facts. Missing dimensions stay Not computable; add supporting inputs below when available.</p><div class="intake-fields">' +
      field('label', LABELS.label, d) + field('periodStart', LABELS.periodStart, d, {type:'date'}) + field('periodEnd', LABELS.periodEnd, d, {type:'date'}) + field('inputTokensM', LABELS.inputTokensM, d, {type:'number'}) + field('outputTokensM', LABELS.outputTokensM, d, {type:'number'}) + selectField('gpuModel', LABELS.gpuModel, d, [['','Choose a category'],['h100-equivalent','H100 equivalent'],['mixed','Mixed / general']]) + field('gpuHours', LABELS.gpuHours, d, {type:'number'}) + field('revenueUsd', LABELS.revenueUsd, d, {type:'number'}) + field('computeSpendUsd', LABELS.computeSpendUsd, d, {type:'number'}) + '</div></section>' +
      '<details class="v-details intake-advanced" id="intake-token-details"' + openFor(['subjectId','modelTier','rawTokensM','validRatePct','tokenBucketsM']) + '><summary>Token reconciliation and reference <span>Improve activity confidence</span></summary><div class="v-details-body intake-fields">' + field('subjectId', LABELS.subjectId,d,{optional:true}) + selectField('modelTier',LABELS.modelTier,d,[['flagship','Flagship'],['general','General']]) + field('rawTokensM',LABELS.rawTokensM,d,{type:'number',optional:true}) + field('validRatePct',LABELS.validRatePct,d,{type:'number',max:100,optional:true}) + ['valid','idle','duplicate','pulse','unclassified'].map(function (key) { var seed={}; seed['bucket_'+key]=d.tokenBucketsM && d.tokenBucketsM[key]; return field('bucket_'+key,key+' Tokens (M)',seed,{type:'number',optional:true}); }).join('') + '</div></details>' +
      '<details class="v-details intake-advanced" id="intake-credit-details"' + openFor(['repaymentRatePct','overdue30Pct','payingCustomers','top5ConcentrationPct','customerHHI','relatedPartyRevenuePct']) + '><summary>Collections and customers <span>Improve business-risk coverage</span></summary><div class="v-details-body intake-fields">' + ['repaymentRatePct','overdue30Pct','payingCustomers','top5ConcentrationPct','customerHHI','relatedPartyRevenuePct'].map(function (key) { return field(key,LABELS[key],d,{type:'number',max:key==='customerHHI'?10000:key==='payingCustomers'?null:100,optional:true}); }).join('') + '</div></details>' +
      '<details class="v-details intake-advanced" id="intake-history-details"' + openFor(['R','C','monthlySeries','operatingHistoryDays','dataCoveragePct']) + '><summary>History and cross-check <span>Six periods for a complete screen</span></summary><div class="v-details-body intake-fields">' + field('operatingHistoryDays',LABELS.operatingHistoryDays,d,{type:'number'}) + field('dataCoveragePct',LABELS.dataCoveragePct,d,{type:'number',max:100}) + seriesField('R',LABELS.R,d) + seriesField('C',LABELS.C,d) + area('monthlySeries',LABELS.monthlySeries,d,'[{"period":"2026-03","rawTokensM":72,"validRatePct":92,"revenueUsd":94000,"computeSpendUsd":55000}]') + '</div></details>' +
      '<details class="v-details intake-advanced" id="intake-evidence-details"' + openFor(['evidence']) + '><summary>Evidence metadata <span>No source files uploaded</span></summary><div class="v-details-body"><p>These are supplied verification claims, not independent source checks.</p>' + area('evidence',LABELS.evidence,d,'[{"fields":["inputTokensM","outputTokensM"],"sourceDomain":"billing","verification":"self_report","coveragePct":100}]') + '</div></details></form>';
  }
  function coverageHtml(draft) {
    var coverage = draft.evidenceCoverage || (window.FC_INTAKE && FC_INTAKE.evidenceCoverage ? FC_INTAKE.evidenceCoverage(draft.input) : null);
    if (!coverage) return "";
    return '<details class="v-details intake-coverage"><summary>Evidence coverage <span>' + coverage.covered + ' covered · ' + coverage.missingEvidence + ' missing evidence · ' + coverage.missingData + ' missing data</span></summary><div class="v-details-body"><div class="intake-coverage-grid">' + coverage.fields.map(function (item) { return '<span class="intake-coverage-item is-' + esc(item.status) + '"><b>' + esc(labelFor(item.field)) + '</b><small>' + esc(item.status.replace(/-/g, " ")) + '</small></span>'; }).join("") + '</div><p class="v-caption">EQS evaluates all 24 decision fields. Independent sources alone do not create High evidence unless the supplied fields are covered.</p></div></details>';
  }
  function readinessHtml(draft) {
    var groups = draft.missingByGroup || {}, names = Object.keys(groups), errors = draft.errors || [];
    return '<aside class="v-panel intake-ready"><div class="v-section-head"><div><p class="v-eyebrow">READY CHECK</p><h2>' + (errors.length ? "Review invalid values" : names.length ? "Limited result available" : "Ready to assess") + '</h2></div>' + ui.tag(errors.length ? "NOT READY" : names.length ? "LIMITED" : "READY", errors.length ? "red" : names.length ? "amber" : "green") + '</div>' +
      (errors.length ? '<ul class="intake-issues">' + errors.map(function (item) { return '<li><b>' + esc(labelFor(item.field)) + '</b> · ' + esc(item.message) + '</li>'; }).join("") + '</ul>' : '') +
      (names.length ? '<p>A deterministic assessment can continue, but missing dimensions remain Not computable.</p><ul class="intake-issues">' + names.map(function (name) { return '<li><b>' + esc(name) + '</b> · ' + esc(groups[name].map(labelFor).join(", ")) + '</li>'; }).join("") + '</ul>' : '<p>All core groups are present. Evidence quality may still limit the decision.</p>') +
      (draft.ignoredInputs && draft.ignoredInputs.length ? '<p class="v-caption">Ignored untrusted inputs: ' + esc(draft.ignoredInputs.join(", ")) + '</p>' : '') +
      coverageHtml(draft) +
      '<details class="v-details"><summary>Evidence dictionary and local proof <span>Method details</span></summary><div class="v-details-body"><p>Evidence records identify a field, source domain, verification method, observation period, coverage and reference hash. Billing, GPU telemetry, bank or treasury, customer contracts, identity graphs and self-report remain distinct sources.</p><p>A local proof fingerprints the normalized Token, Compute, Business/Credit and Evidence groups with a fresh timestamp and nonce. It stays in this browser, makes no network claim and never changes the risk score.</p></div></details>' +
      consentHtml('intake-review-consent', draft.explanationConsent, 'Send validated facts and the deterministic result to DeepSeek for explanation.') +
      '<div class="v-action-row"><button class="btn btn-primary" id="intake-run" type="button"' + (errors.length || draft.status === "running" ? " disabled" : "") + '>' + (draft.status === "running" ? "Assessing…" : "Run assessment") + '</button></div>' +
      (!window.FC_LIVE ? '<p class="intake-offline"><b>Deterministic assessment runs in your browser.</b> Only AI text extraction and explanation need the local agent.</p>' : '') +
      '<div id="intake-run-status" class="' + (draft.lastError ? 'intake-status bad' : '') + '" role="status" aria-live="polite">' + esc(draft.lastError || '') + '</div></aside>';
  }
  function draftHtml(draft) {
    var mode = modeByDraft[draft.draftId] || (draft.source === "description" ? "review" : draft.source === "json" ? "review" : "manual");
    return '<div class="v-page intake-page">' + ui.pageHead('NEW ASSESSMENT', 'Review the facts before they become a result.', 'Nothing is scored until you confirm and run the deterministic assessment.') +
      '<div class="intake-topline"><button class="btn btn-ghost" id="intake-back" type="button">← New draft</button><span class="spacer"></span><span class="v-muted">Draft · ' + esc(draft.draftId.slice(0, 8)) + '</span></div>' +
      '<button class="btn btn-ghost" id="intake-fill-example" type="button">Fill with example facts</button><nav class="intake-mode-tabs" aria-label="Input method"><button type="button" data-mode="description"' + (mode === "description" ? ' aria-current="page"' : '') + '>Describe</button><button type="button" data-mode="json"' + (mode === "json" ? ' aria-current="page"' : '') + '>Import JSON</button><button type="button" data-mode="manual"' + (mode === "manual" || mode === "review" ? ' aria-current="page"' : '') + '>Manual review</button></nav>' + modeHtml(draft, mode) +
      ((mode === "manual" || mode === "review") ? '<div class="intake-layout"><div>' + formHtml(draft) + '</div>' + readinessHtml(draft) + '</div>' : '') + '</div>';
  }
  function parseValue(el) {
    var kind = el.getAttribute("data-kind"), raw = el.value.trim();
    if (!raw) return null;
    if (kind === "number") return Number(raw);
    if (kind === "series") return raw.split(",").map(function (item) { return Number(item.trim()); }).filter(function (item) { return isFinite(item); });
    if (kind === "json") { try { return JSON.parse(raw); } catch (e) { return raw; } }
    return raw;
  }
  function collect(host, draft) {
    var input = JSON.parse(JSON.stringify(draft.input || {})), buckets = {};
    Array.prototype.forEach.call(host.querySelectorAll("#intake-form [data-field]"), function (el) {
      var key = el.getAttribute("data-field"), parsed = parseValue(el);
      if (key.indexOf("bucket_") === 0) { if (parsed != null) buckets[key.slice(7)] = parsed; }
      else if (parsed == null) delete input[key]; else input[key] = parsed;
    });
    if (Object.keys(buckets).length) input.tokenBucketsM = buckets; else delete input.tokenBucketsM;
    return window.FC_INTAKE.update(input, { source: draft.source, silent: true });
  }
  function status(host, text, bad) { var el = host.querySelector("#intake-source-status") || host.querySelector("#intake-run-status"); if (el) { el.textContent = text || ""; el.className = bad ? "intake-status bad" : "intake-status"; } }
  function showFieldErrors(host, draft) {
    (draft.errors || []).forEach(function (item) {
      var message = host.querySelector('[data-error-for="' + item.field + '"]'), control = host.querySelector('[data-field="' + item.field + '"]');
      if (message) { message.textContent = item.message; message.id = "intake-error-" + item.field; }
      if (control) { control.setAttribute("aria-invalid", "true"); if (message) control.setAttribute("aria-describedby", message.id); }
    });
  }
  function bind(host, draft) {
    Array.prototype.forEach.call(host.querySelectorAll("[data-new-mode]"), function (button) { button.addEventListener("click", function () { var item = FC_INTAKE.create({}, button.getAttribute("data-new-mode")); modeByDraft[item.draftId] = button.getAttribute("data-new-mode"); App.renderCurrent(); }); });
    if (!draft) return;
    Array.prototype.forEach.call(host.querySelectorAll("[data-mode]"), function (button) { button.addEventListener("click", function () { modeByDraft[draft.draftId] = button.getAttribute("data-mode"); App.renderCurrent(); }); });
    var fill = host.querySelector('#intake-fill-example');
    if (fill) fill.addEventListener('click', function () {
      if (Object.keys(draft.input || {}).some(function (key) { return ['modelTier','taskType','gpuModel'].indexOf(key) < 0 && draft.input[key] != null; }) && !window.confirm('Replace this draft with synthetic example facts?')) return;
      FC_INTAKE.update(FC_EXAMPLE.draft, { source: 'example', silent: true }); modeByDraft[draft.draftId] = 'review'; App.renderCurrent();
    });
    var back = host.querySelector("#intake-back"); if (back) back.addEventListener("click", function () { FC_INTAKE.deactivate(); App.renderCurrent(); });
    var form = host.querySelector("#intake-form"); if (form) form.addEventListener("change", function () { draft = collect(host, draft); App.renderCurrent(); });
    var extract = host.querySelector("#intake-extract"); if (extract) extract.addEventListener("click", function () {
      var text = host.querySelector("#intake-description").value.trim(), consent = host.querySelector("#intake-extract-consent").checked;
      draft.rawText = text; draft.extractionConsent = consent; draft.lastError = null; FC_INTAKE.commit(draft, false);
      if (!consent) { status(host, "Confirm before sending this text to DeepSeek.", true); return; }
      if (!text) { status(host, "Describe the business and supplied data first.", true); return; }
      if (!window.FC_AI || !FC_AI.extractDraft) { status(host, "AI text extraction needs the local agent. Your text remains in this browser.", true); return; }
      draft.status = "extracting"; FC_INTAKE.commit(draft, true);
      FC_AI.extractDraft(draft.draftId, text).then(function (payload) { if (FC_INTAKE.active() !== draft) return; modeByDraft[draft.draftId] = "review"; FC_INTAKE.setExtracted(payload); }, function (error) { if (FC_INTAKE.active() !== draft) return; draft.status = "draft"; draft.lastError = error.status === 504 || error.name === "AbortError" ? "AI extraction timed out. Retry or continue with JSON or manual entry." : error.status === 429 ? "AI extraction is busy. Retry shortly or continue without it." : "AI extraction is unavailable. Your text remains in this browser."; FC_INTAKE.commit(draft, true); });
    });
    function importJson(text) {
      try { var bytes = typeof Blob !== "undefined" ? new Blob([text]).size : unescape(encodeURIComponent(text)).length; if (bytes > FILE_LIMIT) throw new Error("Use JSON no larger than 64 KB."); var parsed = JSON.parse(text); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Use one JSON object."); draft = FC_INTAKE.update(parsed, { source: "json", silent: true }); modeByDraft[draft.draftId] = "review"; App.renderCurrent(); }
      catch (error) { status(host, error.message || "Enter valid JSON.", true); }
    }
    var parse = host.querySelector("#intake-parse-json"); if (parse) parse.addEventListener("click", function () { importJson(host.querySelector("#intake-json").value); });
    var file = host.querySelector("#intake-file"); if (file) file.addEventListener("change", function () {
      var selected = file.files && file.files[0]; if (!selected) return;
      if (selected.size > FILE_LIMIT) { status(host, "Choose a JSON file no larger than 64 KB.", true); return; }
      if (!/\.json$/i.test(selected.name) && selected.type !== "application/json") { status(host, "Choose a .json file.", true); return; }
      var reader = new FileReader(); reader.onload = function () { importJson(String(reader.result || "")); }; reader.onerror = function () { status(host, "The file could not be read.", true); }; reader.readAsText(selected);
    });
    var proof = host.querySelector("#anchor-btn"); if (proof) proof.addEventListener("click", function () { collect(host, draft); FC_INTAKE.proof(); ui.toast("Local proof created"); });
    /* Deterministic v0.2.1 scoring also runs in this browser; the local agent only adds the AI explanation layer. */
    function runLocal() {
      var local = window.FC_RISK_RUN ? FC_RISK_RUN(draft.input, draft.draftId) : null;
      if (!local) { status(host, "The deterministic engine is unavailable in this browser. Your draft remains available here.", true); return; }
      if (local.ok) { draft.status = "review"; draft.lastError = null; FC_INTAKE.commit(draft, false); FC_INTAKE.setResult(local.result); App.nav("#/audit"); return; }
      if ((local.fieldErrors || []).length) FC_INTAKE.applyServerValidation({ fieldErrors: local.fieldErrors, missingByGroup: local.missingByGroup, warnings: local.warnings });
      else { draft.status = "review"; draft.lastError = local.error || "The deterministic assessment could not run. Your draft remains available here."; FC_INTAKE.commit(draft, false); }
      App.renderCurrent();
    }
    var run = host.querySelector("#intake-run"); if (run) run.addEventListener("click", function () {
      draft = collect(host, draft); draft.explanationConsent = !!host.querySelector("#intake-review-consent").checked;
      if (draft.errors.length) { App.renderCurrent(); return; }
      if (!(window.FC_LIVE && window.FC_AI && FC_AI.assessDraft)) { runLocal(); return; }
      draft.status = "running"; draft.lastError = null; FC_INTAKE.commit(draft, true);
      FC_AI.assessDraft(draft).then(function (result) { if (FC_INTAKE.active() !== draft) return; FC_INTAKE.setResult(result); App.nav("#/audit"); }, function (error) {
        if (FC_INTAKE.active() !== draft) return;
        if (error.data && error.data.fieldErrors) { FC_INTAKE.applyServerValidation(error.data); App.renderCurrent(); return; }
        /* The sidecar is an enhancement: fall back to the in-browser deterministic engine instead of a dead end. */
        var fallback = window.FC_RISK_RUN ? FC_RISK_RUN(draft.input, draft.draftId) : null;
        if (fallback && fallback.ok) { draft.status = "review"; draft.lastError = null; FC_INTAKE.commit(draft, false); FC_INTAKE.setResult(fallback.result); App.nav("#/audit"); return; }
        draft.status = "review"; draft.lastError = error.status === 504 || error.name === "AbortError" ? "Assessment timed out. Your draft is ready to retry." : error.status === 429 ? "The risk engine is busy. Retry shortly." : "Assessment service unavailable. Your draft was preserved."; FC_INTAKE.commit(draft, false); App.renderCurrent();
      });
    });
  }
  function render(host) { var draft = window.FC_INTAKE && FC_INTAKE.active(); host.innerHTML = draft ? draftHtml(draft) : entryHtml(); if (draft) showFieldErrors(host, draft); bind(host, draft); }
  App.fieldLabel = labelFor; App.consentHtml = consentHtml;
  App.views = App.views || {}; App.views.ingest = { render: render };
})();
