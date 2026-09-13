/* Same-origin v0.2.1 session controller. Live results never update ai-ledger.js on disk. */
(function () {
  "use strict";
  if (window.__FC_LIVE_LOADED) return;
  window.__FC_LIVE_LOADED = true;

  var BASE = "/fc/ai/v0.2.1", V03_BASE = "/fc/ai/v0.3", MODEL_LABEL = "AI", controllers = [];

  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function later(fn, ms) { return App.fn.timeout(fn, ms); }
  function emit(name, detail) {
    try { var event = new Event(name); event.fcDetail = detail || {}; window.dispatchEvent(event); } catch (e) { /* optional session signal */ }
  }
  function removeController(ctrl) {
    var index = controllers.indexOf(ctrl);
    if (index >= 0) controllers.splice(index, 1);
  }
  function fetchTimeout(url, opts, ms) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var options = opts || {}, timer = null;
    if (ctrl) {
      controllers.push(ctrl); options.signal = ctrl.signal;
      timer = later(function () { ctrl.abort(); }, ms);
    }
    return fetch(url, options).then(function (response) {
      if (timer) clearTimeout(timer);
      if (ctrl) removeController(ctrl);
      return response;
    }, function (error) {
      if (timer) clearTimeout(timer);
      if (ctrl) removeController(ctrl);
      throw error;
    });
  }
  function requestJson(url, options, ms) {
    return fetchTimeout(url, options, ms).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) {
          var error = new Error(data && (typeof data.error === "string" ? data.error : data.error && data.error.message) || "Request failed");
          error.status = response.status; error.data = data; throw error;
        }
        return data;
      });
    });
  }
  function extractDraft(draftId, value) {
    return requestJson(V03_BASE + "/extract", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId: draftId, text: value, modelConsent: true })
    }, 60000);
  }
  function intakeConfig() { return requestJson(V03_BASE + "/config", { method: "GET" }, 3000); }
  function intakeSchema() { return requestJson(V03_BASE + "/schema", { method: "GET" }, 3000); }
  function assessDraft(draft) {
    return requestJson(V03_BASE + "/assess", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId: draft.draftId, draft: draft.input, modelConsent: draft.explanationConsent === true })
    }, 60000);
  }
  function askDraft(sessionId, question) {
    return requestJson(V03_BASE + "/ask", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId, question: question, modelConsent: true })
    }, 60000);
  }
  function boot() {
    if (window.location.protocol === 'file:') { window.FC_LIVE = false; return; }
    intakeConfig().then(function (config) {
      window.FC_LIVE = true;
      MODEL_LABEL = String(config.model || 'AI');
      window.FC_SERVICE_STATUS = { riskEngine: 'ready', aiExtraction: config.extractionStatus || 'unavailable' };
      window.FC_AI = { model: MODEL_LABEL, intakeConfig: intakeConfig, intakeSchema: intakeSchema, extractDraft: extractDraft, assessDraft: assessDraft, askDraft: askDraft };
      emit('fc:live', { serviceStatus: window.FC_SERVICE_STATUS });
      App.setState({});
    }).catch(function () { window.FC_LIVE = false; });
  }
  App.fn.addClearHook(function () {
    controllers.slice().forEach(function (ctrl) { try { ctrl.abort(); } catch (error) {} });
    controllers = [];
  });
  if (document.readyState === 'complete') later(boot, 0);
  else window.addEventListener('load', boot, { once: true });
})();
