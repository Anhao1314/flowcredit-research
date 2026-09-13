/* One deterministic assessment view for browser and local-agent results. */
(function () {
  "use strict";
  var App = window.App, ui = App.ui;
  function renderCustom(host, draft) {
    var run = draft.result;
    host.innerHTML = '<div class="v-page custom-assessment">' + ui.pageHead('02 / ASSESSMENT', draft.input.label || 'Custom operator', 'A deterministic result from your confirmed facts.') +
      '<div class="intake-topline"><a class="btn" href="#/ingest">← Edit input</a><span class="spacer"></span><a class="btn btn-primary" href="#/report">Open report →</a></div>' +
      (App.liveResultHtml ? App.liveResultHtml(run, draft.draftId) : '<section class="v-panel"><h2>Assessment complete</h2><p>' + ui.esc(run.trace || '') + '</p></section>') +
      '<section class="v-panel fc-ai-review"><div class="v-section-head"><div><p class="v-eyebrow">AI EXPLANATION</p><h2>Ask about this result.</h2></div><span class="v-muted">Current session only</span></div>' +
      App.consentHtml('custom-ask-consent', draft.explanationConsent, 'Send this question and the assessment facts to DeepSeek.') +
      '<div class="ask-row"><input id="custom-ask-input" maxlength="500" aria-label="Question about this assessment" placeholder="What prevents a complete TAI or CCI?"><button class="btn btn-primary" id="custom-ask" type="button">Ask</button></div><div id="custom-ask-output" class="ask-output" role="status" aria-live="polite"></div></section></div>';
    var button = host.querySelector('#custom-ask');
    if (button) button.addEventListener('click', function () {
      var consent = host.querySelector('#custom-ask-consent').checked, input = host.querySelector('#custom-ask-input'), output = host.querySelector('#custom-ask-output');
      draft.explanationConsent = consent;
      FC_INTAKE.commit(draft, false);
      if (!consent) { output.textContent = 'Confirm before sending assessment facts to DeepSeek.'; return; }
      if (!input.value.trim()) { output.textContent = 'Enter a question first.'; return; }
      if (!draft.sessionId || !window.FC_AI || !FC_AI.askDraft) { output.textContent = 'AI explanation needs the local agent.'; return; }
      button.disabled = true; output.textContent = 'Reviewing the current assessment…';
      FC_AI.askDraft(draft.sessionId, input.value.trim()).then(function (response) {
        if (FC_INTAKE.active() !== draft || App.state.route !== '#/audit') return;
        output.innerHTML = '<p>' + ui.esc(response.answer) + '</p><p class="v-caption">Evidence ' + ui.esc((response.citations || []).join(', ') || 'not cited') + '</p>';
      }, function (error) { if (FC_INTAKE.active() !== draft || App.state.route !== '#/audit') return; output.textContent = error.status === 504 || error.name === 'AbortError' ? 'AI explanation timed out. The assessment remains available.' : error.status === 429 ? 'AI explanation is busy. Retry shortly.' : 'AI explanation is unavailable. The assessment remains available.'; }).then(function () { button.disabled = false; });
    });
  }
  function render(host) {
    var draft = window.FC_INTAKE && FC_INTAKE.active();
    if (draft && draft.status === 'complete' && draft.result) { renderCustom(host, draft); return; }
    host.innerHTML = '<div class="v-page">' + ui.pageHead('02 / ASSESSMENT', 'Confirm the facts, then assess.', 'The same rules run in this browser and through the local agent.') + ui.pending('No completed assessment', 'Explore a worked example or enter your own facts.', '#/workspace', 'Open workspace') + '</div>';
  }
  App.views = App.views || {};
  App.views.audit = { render: render };
})();
