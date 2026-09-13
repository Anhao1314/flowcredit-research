/* FlowCredit v0.3.1 task-first assessment intake. */
(function () {
  "use strict";
  var App = window.App, ui = App.ui, modeByDraft = {}, FILE_LIMIT = 65536, epoch = 0;
  App.fn.addClearHook(function () { epoch++; });

  var LABELS = { label: 'Business name', subjectId: 'Internal reference', periodStart: 'Period start', periodEnd: 'Period end', modelTier: 'Model class', inputTokensM: 'Input Tokens (M)', outputTokensM: 'Output Tokens (M)', rawTokensM: 'Reported Raw Tokens (M)', validRatePct: 'Claimed valid rate (%)', gpuModel: 'GPU category', gpuHours: 'GPU-hours', revenueUsd: 'Revenue (USD)', computeSpendUsd: 'Compute spend (USD)', repaymentRatePct: 'Collection rate (%)', overdue30Pct: '30-day overdue rate (%)', payingCustomers: 'Paying customers', top5ConcentrationPct: 'Top-5 concentration (%)', customerHHI: 'Customer concentration index', relatedPartyRevenuePct: 'Related-party revenue (%)', monthlySeries: 'Monthly history', operatingHistoryDays: 'Operating history (days)', dataCoveragePct: 'Data coverage (%)', R: 'Declared activity series', C: 'Cross-check activity series', evidence: 'Evidence records', taskType: 'Task type', normalizationProfileId: 'Rule-defined normalization profile', peerProfileId: 'Rule-defined comparison profile', monthlyRevenueUsd: 'Monthly revenue', monthlyComputeSpendUsd: 'Monthly compute spend', tokenBucketsM: 'Token classification buckets' };
  function labelFor(key) { return LABELS[key] || key; }
  function consentHtml(id, checked, text) { return '<label class="intake-consent"><input id="' + id + '" type="checkbox"' + (checked ? ' checked' : '') + '><span>' + esc(text) + '</span></label>'; }
  function esc(value) { return ui.esc(value == null ? "" : value); }
  function value(input, key) { return input && input[key] != null ? input[key] : ""; }
  function field(key, label, input, options) {
    options = options || {};
    var type = options.type || "text", kind = options.kind || (type === "number" ? "number" : "text");
    var minmax = type === "number" ? ' min="' + (options.min == null ? 0 : options.min) + '"' + (options.max == null ? "" : ' max="' + options.max + '"') + ' step="' + (options.step || "any") + '"' : "";
    return '<label class="intake-field"><span>' + esc(label) + (options.optional ? ' <small>Optional</small>' : '') + '</span><input id="intake-field-' + key + '" type="' + type + '" data-field="' + key + '" data-kind="' + kind + '" value="' + esc(value(input, key)) + '"' + minmax + (options.placeholder ? ' placeholder="' + esc(options.placeholder) + '"' : '') + '><em data-error-for="' + key + '"></em></label>';
  }
  function selectField(key, label, input, choices) {
    return '<label class="intake-field"><span>' + esc(label) + '</span><select id="intake-field-' + key + '" data-field="' + key + '">' + choices.map(function (item) { return '<option value="' + esc(item[0]) + '"' + (value(input, key) === item[0] ? " selected" : "") + '>' + esc(item[1]) + '</option>'; }).join("") + '</select><em data-error-for="' + key + '"></em></label>';
  }
  function modeHtml(draft, mode) {
    if (mode === "description") return '<section class="v-panel intake-source"><div class="v-section-head"><div><p class="v-eyebrow">DESCRIBE A CASE</p><h2>Start with what you know.</h2></div></div>' +
      '<label class="intake-field intake-wide"><span>Business and assessment context</span><textarea id="intake-description" rows="7" maxlength="10000" placeholder="Assess an AI inference provider using its last six months of Token usage, GPU activity, revenue and repayment data.">' + esc(draft.rawText || "") + '</textarea></label>' +
      consentHtml('intake-extract-consent', draft.extractionConsent, 'Send this text to DeepSeek to organize it into a draft. The model cannot score the case.') +
      '<div class="v-action-row"><button class="btn btn-primary" id="intake-extract" type="button"' + (draft.status === "extracting" || !caps().modelAvailable ? " disabled" : "") + '>' + (draft.status === "extracting" ? "Organizing…" : draft.lastError ? "Retry extraction" : "Organize into draft") + '</button><button class="btn" data-mode="json" type="button">Advanced JSON</button><button class="btn" data-mode="manual" type="button">Enter manually</button></div><div id="intake-source-status" class="' + (draft.lastError ? 'intake-status bad' : '') + '" role="status" aria-live="polite">' + esc(draft.lastError || caps().reason) + '</div></section>';
    if (mode === "json") return '<section class="v-panel intake-source"><div class="v-section-head"><div><p class="v-eyebrow">IMPORT JSON</p><h2>Bring structured data into this browser.</h2></div><span class="v-muted">64 KB maximum</span></div>' +
      '<label class="intake-field intake-wide"><span>JSON object <small>64 KB maximum</small></span><textarea id="intake-json" rows="8" maxlength="65536" placeholder="{ &quot;label&quot;: &quot;Example operator&quot;, &quot;inputTokensM&quot;: 64 }">' + esc(draft.jsonText == null ? JSON.stringify(FC_INTAKE.editableInput(draft), null, 2) : draft.jsonText) + '</textarea></label>' +
      '<div class="v-action-row"><button class="btn btn-primary" id="intake-parse-json" type="button">Review JSON</button><label class="btn intake-file">Open .json<input type="file" id="intake-file" accept="application/json,.json"></label><button class="btn" data-mode="manual" type="button">Enter manually</button></div><div id="intake-source-status" role="status" aria-live="polite"></div></section>';
    return "";
  }
  function formHtml(draft) {
    var d = draft.input || {}, errors = draft.errors || [];
    function openFor(keys) { return errors.some(function (item) { return keys.indexOf(item.field) >= 0; }) ? ' open' : ''; }
    return '<form id="intake-form" novalidate><section class="v-panel intake-form-section"><div class="v-section-head"><div><p class="v-eyebrow">START WITH NINE FACTS</p><h2>Who, when and how much?</h2></div></div><p>A limited assessment is available with basic operating facts. Missing dimensions stay Not computable. Use a single month or a rolling 27–31 day window. Tokens are in millions; monetary values are USD.</p><div class="intake-fields">' +
      field('label', LABELS.label, d) + field('periodStart', LABELS.periodStart, d, {type:'date'}) + field('periodEnd', LABELS.periodEnd, d, {type:'date'}) + field('inputTokensM', LABELS.inputTokensM, d, {type:'number'}) + field('outputTokensM', LABELS.outputTokensM, d, {type:'number'}) + selectField('gpuModel', LABELS.gpuModel, d, [['','Choose a category'],['h100-equivalent','H100 equivalent'],['mixed','Mixed / general']]) + field('gpuHours', LABELS.gpuHours, d, {type:'number'}) + field('revenueUsd', LABELS.revenueUsd, d, {type:'number'}) + field('computeSpendUsd', LABELS.computeSpendUsd, d, {type:'number'}) + '</div></section>' +
      '<details class="v-details intake-advanced" id="intake-token-details"' + openFor(['subjectId','modelTier','rawTokensM','validRatePct','tokenBucketsM']) + '><summary>Token reconciliation and reference <span>Improve activity confidence</span></summary><div class="v-details-body intake-fields">' + field('subjectId', LABELS.subjectId,d,{optional:true}) + selectField('modelTier',LABELS.modelTier,d,[['flagship','Flagship'],['general','General']]) + field('rawTokensM',LABELS.rawTokensM,d,{type:'number',optional:true}) + field('validRatePct',LABELS.validRatePct,d,{type:'number',max:100,optional:true}) + ['valid','idle','duplicate','pulse','unclassified'].map(function (key) { var seed={}; seed['bucket_'+key]=d.tokenBucketsM && d.tokenBucketsM[key]; return field('bucket_'+key,key+' Tokens (M)',seed,{type:'number',optional:true}); }).join('') + '</div></details>' +
      '<details class="v-details intake-advanced" id="intake-credit-details"' + openFor(['repaymentRatePct','overdue30Pct','payingCustomers','top5ConcentrationPct','customerHHI','relatedPartyRevenuePct']) + '><summary>Collections and customers <span>Improve business-risk coverage</span></summary><div class="v-details-body intake-fields">' + ['repaymentRatePct','overdue30Pct','payingCustomers','top5ConcentrationPct','customerHHI','relatedPartyRevenuePct'].map(function (key) { return field(key,LABELS[key],d,{type:'number',max:key==='customerHHI'?10000:key==='payingCustomers'?null:100,optional:true}); }).join('') + '</div></details>' +
      '<details class="v-details intake-advanced" id="intake-history-details"' + openFor(['R','C','monthlySeries','operatingHistoryDays','dataCoveragePct']) + '><summary>History and cross-check <span>Six periods for a complete screen</span></summary><div class="v-details-body intake-fields">' + field('operatingHistoryDays',LABELS.operatingHistoryDays,d,{type:'number'}) + field('dataCoveragePct',LABELS.dataCoveragePct,d,{type:'number',max:100}) + rowsHtml('monthlySeries', d) + rowsHtml('crosscheck', d) + '</div></details>' +
      '<details class="v-details intake-advanced" id="intake-evidence-details"' + openFor(['evidence']) + '><summary>Evidence metadata <span>No source files uploaded</span></summary><div class="v-details-body"><p>These are supplied verification claims, not independent source checks.</p>' + rowsHtml('evidence', d) + '</div></details></form>';
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
      '<details class="v-details" id="intake-method-details"><summary>Evidence dictionary and local proof <span>Method details</span></summary><div class="v-details-body"><p>Evidence records identify a field, source domain, verification method, observation period, coverage and reference hash. Billing, GPU telemetry, bank or treasury, customer contracts, identity graphs and self-report remain distinct sources.</p><p>A local proof fingerprints the normalized Token, Compute, Business/Credit and Evidence groups with a fresh timestamp and nonce. It stays in this browser, makes no network claim and never changes the risk score.</p></div></details>' +
      (caps().modelAvailable ? consentHtml('intake-review-consent', draft.explanationConsent, 'Authorize AI explanation: send validated facts and this result to DeepSeek.') : '<p class="v-caption">' + esc(caps().reason) + '</p>') +
      '<div class="v-action-row"><button class="btn btn-primary" id="intake-run" type="button"' + (errors.length || draft.status === "running" ? " disabled" : "") + '>' + (draft.status === "running" ? "Assessing…" : "Run assessment") + '</button></div>' +
      (!window.FC_LIVE ? '<p class="intake-offline"><b>Deterministic assessment runs in your browser.</b> Only AI text extraction and explanation need the local agent.</p>' : '') +
      '<div id="intake-run-status" class="' + (draft.lastError ? 'intake-status bad' : '') + '" role="status" aria-live="polite">' + esc(draft.lastError || '') + '</div></aside>';
  }
  function draftHtml(draft) {
    var mode = modeByDraft[draft.draftId] || (draft.source === "description" ? "review" : draft.source === "json" ? "review" : "manual");
    return '<div class="v-page intake-page">' + ui.pageHead('NEW ASSESSMENT', 'Review the facts before they become a result.', 'Nothing is scored until you confirm and run the deterministic assessment.') +
      '<div class="intake-topline"><strong>' + esc(draft.input.label || 'Untitled assessment') + '</strong><span id="intake-save-status" role="status">' + esc(FC_INTAKE.saveStatus()) + '</span><button class="btn btn-ghost" id="intake-fill-example" type="button">Fill example</button><button class="btn btn-ghost" id="intake-back" type="button">← Workspace</button><span class="spacer"></span><span class="v-muted">' + (draft.source === "example" ? "Synthetic data" : "") + '</span></div>' +
      '<nav class="intake-mode-tabs" aria-label="Input method"><button type="button" data-mode="description"' + (mode === "description" ? ' aria-current="page"' : '') + '>AI assisted input</button><button type="button" data-mode="json"' + (mode === "json" ? ' aria-current="page"' : '') + '>Advanced JSON</button><button type="button" data-mode="manual"' + (mode === "manual" || mode === "review" ? ' aria-current="page"' : '') + '>Guided form</button></nav>' + modeHtml(draft, mode) +
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
    var input = FC_INTAKE.editableInput(draft), buckets = {};
    Array.prototype.forEach.call(host.querySelectorAll("#intake-form [data-field]"), function (el) {
      var key = el.getAttribute("data-field"), parsed = parseValue(el);
      if (key.indexOf("bucket_") === 0) { if (parsed != null) buckets[key.slice(7)] = parsed; }
      else if (parsed == null) delete input[key]; else input[key] = parsed;
    });
    if (!host.querySelector("#intake-form")) return draft;
    collectRows(host, input);
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

  function caps() { return FC_INTAKE.capabilities(window.FC_SERVICE_CONFIG); }
  function current(draft) { return FC_INTAKE.active() === draft && App.state.route === "#/ingest"; }
  function evidenceChoice(key,current) {
    var values=key === 'sourceDomain' ? ['billing','gpu_telemetry','bank_treasury','customer_contract','identity_graph','self_report'] : ['self_reported','uploaded_document','counterparty_confirmed','system_api','cryptographic','cross_verified'];
    var names={billing:'Billing',gpu_telemetry:'GPU telemetry',bank_treasury:'Bank / treasury',customer_contract:'Customer contract',identity_graph:'Identity graph',self_report:'Self-report',self_reported:'Self-reported',uploaded_document:'Uploaded document',counterparty_confirmed:'Counterparty confirmed',system_api:'System API',cryptographic:'Cryptographic',cross_verified:'Cross-verified'};
    if(current && values.indexOf(current)<0)values.unshift(current);
    return '<select data-cell="'+key+'"><option value="">Choose a '+(key === 'sourceDomain' ? 'source' : 'method')+'</option>'+values.map(function (value) { return '<option value="'+esc(value)+'"'+(value === current ? ' selected' : '')+'>'+esc(names[value] || value)+'</option>'; }).join('')+'</select>';
  }
  function rowFields(kind) { return kind === "monthlySeries" ? [["period","Month (YYYY-MM)","text"],["rawTokensM","Raw Tokens (M)","number"],["validRatePct","Valid (%)","number"],["revenueUsd","Revenue (USD)","number"],["computeSpendUsd","Compute (USD)","number"]] : kind === "crosscheck" ? [["R","Declared (R)","number"],["C","Cross-check (C)","number"]] : [["field","Field","text"],["sourceDomain","Source domain","text"],["verification","Verification method","text"],["observedAt","Observed on","date"],["coveragePct","Coverage (%)","number"],["referenceHash","Reference summary","text"]]; }
  function rowsHtml(kind, input) {
    var rows = kind === "crosscheck" ? Array.from({length:Math.max((input.R || []).length,(input.C || []).length)},function (_,i) { return {R:input.R && input.R[i],C:input.C && input.C[i]}; }) : Array.isArray(input[kind]) ? input[kind] : [];
    return '<div class="intake-wide intake-rows" data-rows="' + kind + '"' + (kind === 'monthlySeries' ? ' role="table" aria-label="Monthly history"' : '') + '><h3>' + (kind === "crosscheck" ? "Activity cross-check" : labelFor(kind)) + '</h3>' + rows.map(function (row,index) { return '<div class="intake-record" data-row="' + index + '"' + (kind === 'monthlySeries' ? ' role="row"' : '') + '>' + rowFields(kind).map(function (spec) { return '<label class="intake-field"' + (kind === 'monthlySeries' ? ' role="cell"' : '') + '><span>' + esc(spec[1]) + '</span>' + (kind === "evidence" && ["sourceDomain","verification"].indexOf(spec[0])>=0 ? evidenceChoice(spec[0],row[spec[0]]) : kind === "evidence" && spec[0] === "field" ? '<select data-cell="field" id="intake-' + kind + '-' + index + '-field"><option value="">Choose a field</option>' + FC_INTAKE.evidenceCoverage({}).fields.map(function (item) { return '<option value="' + item.field + '"' + (row.field === item.field ? ' selected' : '') + '>' + esc(labelFor(item.field)) + '</option>'; }).join('') + '</select>' : '<input id="intake-' + kind + '-' + index + '-' + spec[0] + '" data-cell="' + spec[0] + '" data-kind="' + (spec[2] === "number" ? 'number' : 'text') + '" type="' + spec[2] + '"' + (spec[2] === "number" ? ' step="any"' : '') + ' value="' + esc(row[spec[0]] == null ? '' : spec[0] === "observedAt" ? String(row[spec[0]]).slice(0,10) : row[spec[0]]) + '">') + '</label>'; }).join('') + '<button class="btn btn-ghost" type="button" data-remove-row="' + kind + ':' + index + '">Remove row ' + (index+1) + '</button></div>'; }).join('') + '<button class="btn" type="button" id="intake-add-' + kind + '" data-add-row="' + kind + '">Add ' + (kind === "monthlySeries" ? "month" : kind === "evidence" ? "evidence record" : "pair") + '</button></div>';
  }
  function collectRows(host,input) {
    host.querySelectorAll('[data-rows]').forEach(function (group) { var kind = group.getAttribute('data-rows'), old = input[kind] || [], rows = []; group.querySelectorAll('[data-row]').forEach(function (row) { var index = Number(row.getAttribute('data-row')), item = Object.assign({}, old[index] || {}); row.querySelectorAll('[data-cell]').forEach(function (cell) { var key=cell.getAttribute('data-cell'), parsed=parseValue(cell); if (key === 'observedAt' && old[index] && parsed === String(old[index][key] || '').slice(0,10)) return; if (parsed == null) delete item[key]; else item[key]=parsed; }); rows.push(item); }); if (kind === 'crosscheck') { input.R=rows.map(function (row) { return row.R == null ? null : row.R; }); input.C=rows.map(function (row) { return row.C == null ? null : row.C; }); } else input[kind]=rows; });
  }
  function saveMode(host,draft) {
    var json=host.querySelector('#intake-json');
    if (json) { draft.jsonText=json.value; try { var parsed=JSON.parse(json.value); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Use one JSON object.'); FC_INTAKE.update(parsed,{source:draft.source,silent:true}); delete draft.jsonText; } catch (error) { status(host,'Invalid JSON. Correct it before switching; your input has been retained.',true); return false; } }
    else if (host.querySelector('#intake-form')) collect(host,draft);
    else { var text=host.querySelector('#intake-description'); if(text) { draft.rawText=text.value; FC_INTAKE.commit(draft,false); } }
    return true;
  }
  function applyIntent(host) {
    var target=FC_INTAKE.takeIntent(); if (!target) return;
    var key=target.fields[0], control=key && host.querySelector('[data-field="'+key+'"]'), group;
    if (target.evidence) group=host.querySelector('#intake-evidence-details');
    else if (['monthlySeries','R','C','monthlyRevenueUsd','monthlyComputeSpendUsd'].indexOf(key)>=0) group=host.querySelector('#intake-history-details');
    else if (control && control.closest) group=control.closest('details');
    if (!control && !group) group=host.querySelector('#intake-method-details');
    if (group) { group.open=true; if (!control || target.evidence) control=group.querySelector('input,select,textarea,button,summary'); }
    if (control) { control.scrollIntoView({block:'center'}); control.focus({preventScroll:true}); }
  }

  function bind(host, draft) {
    var renderedEpoch = epoch;
    function stillCurrent() { return current(draft) && epoch === renderedEpoch; }
    host.querySelectorAll("[data-add-row],[data-remove-row]").forEach(function (button) { button.addEventListener("click", function () { collect(host,draft); var input=FC_INTAKE.editableInput(draft), remove=button.getAttribute("data-remove-row"), kind=remove ? remove.split(":")[0] : button.getAttribute("data-add-row"), index=remove ? Number(remove.split(":")[1]) : -1; if(kind === "crosscheck") { ["R","C"].forEach(function (key) { var rows=Array.isArray(input[key]) ? input[key] : []; if(remove) rows.splice(index,1); else rows.push(null); input[key]=rows; }); } else { var rows=Array.isArray(input[kind]) ? input[kind] : []; if(remove) rows.splice(index,1); else rows.push({}); input[kind]=rows; } FC_INTAKE.update(input,{source:draft.source,silent:true}); App.renderCurrent(); }); });
    if (!draft) return;
    var jsonEditor=host.querySelector('#intake-json'); if(jsonEditor) jsonEditor.addEventListener('input',function () { draft.jsonText=jsonEditor.value; FC_INTAKE.commit(draft,false); var saved=host.querySelector("#intake-save-status"); if(saved) saved.textContent=FC_INTAKE.saveStatus(); });
    var descriptionEditor=host.querySelector('#intake-description'); if(descriptionEditor) descriptionEditor.addEventListener('input',function () { draft.rawText=descriptionEditor.value; FC_INTAKE.commit(draft,false); var saved=host.querySelector("#intake-save-status"); if(saved) saved.textContent=FC_INTAKE.saveStatus(); });
    Array.prototype.forEach.call(host.querySelectorAll("[data-mode]"), function (button) { button.addEventListener("click", function () { if (!saveMode(host, draft)) return; modeByDraft[draft.draftId] = button.getAttribute("data-mode"); App.renderCurrent(); }); });
    var fill = host.querySelector('#intake-fill-example');
    if (fill) fill.addEventListener('click', function () {
      if (Object.keys(draft.input || {}).some(function (key) { return ['modelTier','taskType','gpuModel'].indexOf(key) < 0 && draft.input[key] != null; }) && !window.confirm('Replace this draft with synthetic example facts?')) return;
      FC_INTAKE.update(FC_EXAMPLE.draft, { source: 'example', silent: true }); modeByDraft[draft.draftId] = 'review'; App.renderCurrent();
    });
    var back = host.querySelector("#intake-back"); if (back) back.addEventListener("click", function () { if (!saveMode(host, draft)) return; FC_INTAKE.deactivate(); App.nav("#/workspace"); });
    var form = host.querySelector("#intake-form"); if (form) form.addEventListener("change", function () { draft = collect(host, draft); App.renderCurrent(); });
    var extract = host.querySelector("#intake-extract"); if (extract) extract.addEventListener("click", function () {
      var text = host.querySelector("#intake-description").value.trim(), consent = host.querySelector("#intake-extract-consent").checked;
      draft.rawText = text; draft.extractionConsent = consent; draft.lastError = null; FC_INTAKE.commit(draft, false);
      if (!consent) { status(host, "Confirm before sending this text to DeepSeek.", true); return; }
      if (!text) { status(host, "Describe the business and supplied data first.", true); return; }
      if (!caps().modelAvailable || !window.FC_AI || !FC_AI.extractDraft) { status(host, "AI text extraction needs the local agent. Your text remains in this browser.", true); return; }
      draft.status = "extracting"; FC_INTAKE.commit(draft, true);
      FC_AI.extractDraft(draft.draftId, text).then(function (payload) { if (!stillCurrent()) return; modeByDraft[draft.draftId] = "review"; FC_INTAKE.setExtracted(payload); }, function (error) { if (!stillCurrent()) return; draft.status = "draft"; draft.lastError = error.status === 504 || error.name === "AbortError" ? "AI extraction timed out. Retry or continue with JSON or manual entry." : error.status === 429 ? "AI extraction is busy. Retry shortly or continue without it." : "AI extraction is unavailable. Your text remains in this browser."; FC_INTAKE.commit(draft, true); });
    });
    function importJson(text) {
      try { var bytes = typeof Blob !== "undefined" ? new Blob([text]).size : unescape(encodeURIComponent(text)).length; if (bytes > FILE_LIMIT) throw new Error("Use JSON no larger than 64 KB."); var parsed = JSON.parse(text); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Use one JSON object."); draft.jsonText = text; draft = FC_INTAKE.update(parsed, { source: draft.source === "example" ? "example" : "json", silent: true }); delete draft.jsonText; modeByDraft[draft.draftId] = "review"; App.renderCurrent(); }
      catch (error) { draft.jsonText = text; status(host, error.message || "Enter valid JSON.", true); }
    }
    var parse = host.querySelector("#intake-parse-json"); if (parse) parse.addEventListener("click", function () { importJson(host.querySelector("#intake-json").value); });
    var file = host.querySelector("#intake-file"); if (file) file.addEventListener("change", function () {
      var selected = file.files && file.files[0]; if (!selected) return;
      if (selected.size > FILE_LIMIT) { status(host, "Choose a JSON file no larger than 64 KB.", true); return; }
      if (!/\.json$/i.test(selected.name) && selected.type !== "application/json") { status(host, "Choose a .json file.", true); return; }
      var reader = new FileReader(); reader.onload = function () { if (!stillCurrent()) return; importJson(String(reader.result || "")); }; reader.onerror = function () { status(host, "The file could not be read.", true); }; reader.readAsText(selected);
    });
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
      draft = collect(host, draft); draft.explanationConsent = caps().modelAvailable && !!(host.querySelector("#intake-review-consent") && host.querySelector("#intake-review-consent").checked);
      if (draft.errors.length) { App.renderCurrent(); return; }
      if (!(caps().canAssess && window.FC_AI && FC_AI.assessDraft)) { runLocal(); return; }
      draft.status = "running"; draft.lastError = null; FC_INTAKE.commit(draft, true);
      FC_AI.assessDraft(draft).then(function (result) { if (!stillCurrent()) return; FC_INTAKE.setResult(result); App.nav("#/audit"); }, function (error) {
        if (!stillCurrent()) return;
        if (error.data && error.data.fieldErrors) { FC_INTAKE.applyServerValidation(error.data); App.renderCurrent(); return; }
        /* The sidecar is an enhancement: fall back to the in-browser deterministic engine instead of a dead end. */
        var fallback = window.FC_RISK_RUN ? FC_RISK_RUN(draft.input, draft.draftId) : null;
        if (fallback && fallback.ok) { draft.status = "review"; draft.lastError = null; FC_INTAKE.commit(draft, false); FC_INTAKE.setResult(fallback.result); App.nav("#/audit"); return; }
        draft.status = "review"; draft.lastError = error.status === 504 || error.name === "AbortError" ? "Assessment timed out. Your draft is ready to retry." : error.status === 429 ? "The risk engine is busy. Retry shortly." : "Assessment service unavailable. Your draft was preserved."; FC_INTAKE.commit(draft, false); App.renderCurrent();
      });
    });
  }
  function render(host) { var draft = FC_INTAKE.active() || FC_INTAKE.create({}, "manual"); if (FC_INTAKE.hasIntent()) modeByDraft[draft.draftId] = "manual"; host.innerHTML = draftHtml(draft); if (draft) showFieldErrors(host, draft); bind(host, draft); App.fn.timeout(function () { if (current(draft)) applyIntent(host); }, 0); }
  App.fieldLabel = labelFor; App.consentHtml = consentHtml;
  App.views = App.views || {}; App.views.ingest = { render: render };
})();
