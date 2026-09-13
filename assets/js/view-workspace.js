/* FlowCredit v0.3.1 task-first workspace with drafts kept in this browser. */
(function () {
  "use strict";
  var App = window.App;
  var FILE_LIMIT = 65536;
  function render(host) {
    var u = App.ui, drafts = window.FC_INTAKE ? FC_INTAKE.list() : [], live = window.FC_LIVE === true;
    function metric(draft) {
      if (!draft.result) return Object.keys(draft.missingByGroup || {}).length ? "Limited data" : "Draft";
      return "TAI " + (draft.result.tai == null ? "—" : draft.result.tai) + " · CCI " + (draft.result.cci == null ? "—" : draft.result.cci) + " · " + (draft.result.grade || "Not rated");
    }
    host.innerHTML = '<div class="v-page workspace-v03">' + u.pageHead('WORKSPACE', 'Assess the operating credibility of an AI business.', 'See an example report, replace the facts with your own, then take the result with you.') +
      '<section class="v-panel workspace-primary"><div><p class="v-eyebrow">SUPPLIED EVIDENCE</p><h2>Start with the business, not the model.</h2><p>One guided task turns supplied operating evidence into TAI, CCI and a manual-review decision.</p><div class="fc-runtime-line">' + (live ? u.tag('RISK ENGINE READY', 'green') + '<span>AI extraction ' + u.esc(window.FC_SERVICE_STATUS && FC_SERVICE_STATUS.aiExtraction || 'unavailable') + '</span>' : u.tag('DETERMINISTIC ENGINE READY', 'green') + '<span>Runs in this browser.</span>') + '</div></div>' +
      '<div class="workspace-actions"><button class="btn" id="workspace-example" type="button">Explore a worked example →</button><button class="btn btn-primary" id="workspace-new" type="button">New assessment</button><label class="btn intake-file">Import assessment JSON<input type="file" id="workspace-import" accept="application/json,.json"></label></div></section>' +
      '<section><div class="v-section-head"><div><p class="v-eyebrow">THIS BROWSER</p><h2>Recent assessments</h2></div>' + (drafts.length ? '<button class="btn btn-ghost" id="workspace-clear" type="button">Clear all saved drafts</button>' : '<span class="v-muted">Up to 5 drafts</span>') + '</div>' +
      (drafts.length ? '<div class="workspace-drafts">' + drafts.map(function (draft) { return '<article class="v-panel workspace-draft"><div><span class="status-chip">' + u.esc(String(draft.status || 'draft').toUpperCase()) + '</span><h3>' + u.esc(draft.input && draft.input.label || 'Untitled assessment') + '</h3><p class="num">' + u.esc(metric(draft)) + '</p><small>' + u.esc(new Date(draft.updatedAt).toLocaleString()) + '</small></div><div class="v-action-row"><button class="btn" type="button" data-open-draft="' + u.esc(draft.draftId) + '">' + (draft.status === 'complete' ? 'Open result' : 'Continue') + '</button><button class="btn btn-ghost" type="button" data-delete-draft="' + u.esc(draft.draftId) + '">Remove</button></div></article>'; }).join('') + '</div>' : '<div class="v-panel workspace-empty"><h3>No assessment in this browser</h3><p>Your drafts and results appear here without being written to the repository or a database. ' + u.esc(FC_INTAKE.saveStatus()) + '.</p></div>') + '</section>' +
      (FC_INTAKE.canUndo() ? '<div class="v-notice workspace-undo" role="status">Assessment removed. <button class="btn" id="workspace-undo" type="button">Undo</button></div>' : '') + '</div>';
    var undo=host.querySelector('#workspace-undo'); if(undo) undo.addEventListener('click',function () { FC_INTAKE.undo(); });
    host.querySelector('#workspace-new').addEventListener('click', function () { FC_INTAKE.create({}, "manual"); App.nav('#/ingest'); });
    host.querySelector('#workspace-example').addEventListener('click', function () {
      if (!window.FC_EXAMPLE || !window.FC_EXAMPLE.draft || !window.FC_RISK_RUN || !window.FC_INTAKE) { u.toast('The worked example is unavailable in this browser.', 'warn'); return; }
      var draft = FC_INTAKE.create(FC_EXAMPLE.draft, 'example');
      var outcome = FC_RISK_RUN(draft.input, draft.draftId);
      if (!outcome || !outcome.ok) { u.toast(outcome && outcome.error || 'The worked example could not be scored in this browser.', 'warn'); return; }
      FC_INTAKE.setResult(outcome.result);
      App.nav('#/audit');
    });
    var clear = host.querySelector('#workspace-clear'); if (clear) clear.addEventListener('click', function () { if (window.confirm('Clear every draft and result saved in this browser?')) FC_INTAKE.clear(); });
    var importInput = host.querySelector('#workspace-import');
    if (importInput) importInput.addEventListener('change', function () {
      var selected = importInput.files && importInput.files[0];
      importInput.value = '';
      if (!selected) return;
      if (selected.size > FILE_LIMIT) { u.toast('Choose a JSON file no larger than 64 KB.', 'warn'); return; }
      if (!/\.json$/i.test(selected.name) && selected.type !== 'application/json') { u.toast('Choose a .json file.', 'warn'); return; }
      if (!window.FC_INTAKE || typeof FC_INTAKE.restore !== 'function') { u.toast('Assessment import is unavailable in this browser.', 'warn'); return; }
      var reader = new FileReader();
      reader.onload = function () {
        if (App.state.route !== "#/workspace") return;
        var payload;
        try { payload = JSON.parse(String(reader.result || '')); }
        catch (error) { u.toast('That file is not a FlowCredit JSON snapshot.', 'warn'); return; }
        var outcome = FC_INTAKE.restore(payload, { source: 'import' });
        if (!outcome.ok) { u.toast(outcome.error || 'The snapshot was not loaded.', 'warn'); return; }
        u.toast('Assessment imported');
        App.nav(outcome.draft.status === 'complete' ? '#/audit' : '#/ingest');
      };
      reader.onerror = function () { u.toast('The file could not be read.', 'warn'); };
      reader.readAsText(selected);
    });
    Array.prototype.forEach.call(host.querySelectorAll('[data-open-draft]'), function (button) { button.addEventListener('click', function () { var draft = FC_INTAKE.choose(button.getAttribute('data-open-draft')); App.nav(draft && draft.status === 'complete' ? '#/audit' : '#/ingest'); }); });
    Array.prototype.forEach.call(host.querySelectorAll('[data-delete-draft]'), function (button) { button.addEventListener('click', function () { FC_INTAKE.remove(button.getAttribute('data-delete-draft')); }); });
  }
  App.views.workspace = { render: render };
})();
