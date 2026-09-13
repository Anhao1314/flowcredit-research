/* ============================================================
   app.js — product shell, top navigation, hash routing, boot.
   Route switching cancels every pending handle first; a stress
   run mid-flight returns to idle while terminal states survive.
   ============================================================ */
(function () {
  var App = window.App = window.App || {};
  var TABS = [
    { hash: "#/ingest", key: "ingest", label: "New Assessment", sub: "01", icon: "db" },
    { hash: "#/audit", key: "audit", label: "Assessment", sub: "02", icon: "pulse" },
    { hash: "#/report", key: "report", label: "Report", sub: "03", icon: "shield" }
  ];
  var rootEl = null;
  var mainEl = null;
  var booted = false;

  function routeKey(hash) {
    var m = String(hash || "").match(/^#\/(landing|workspace|ingest|audit|report)$/);
    return m ? m[1] : "landing";
  }
  function currentRoute() {
    return routeKey(location.hash);
  }
  function nav(hash) {
    if (location.hash === hash) { renderCurrent(); return; }
    location.hash = hash; // fires hashchange → applyRoute
  }

  /* ---------- deep-link intent (consumed once after a view renders) ---------- */
  var NAV_INTENTS = {
    ingest: { anchor: { sel: "#anchor-btn", toast: "Anchor four signed sources — fresh nonce per anchor" } },
    audit: { l0: { idx: 0 }, l1: { idx: 1 }, l2: { idx: 2 }, l3: { idx: 3 }, l4: { idx: 4 } },
    report: {
      proof: { sel: "#verify-btn" },
      stress: { sel: "#stress-btn", toast: "Run stress — the facility responds to the shock" }
    }
  };
  var intent = null;

  function intentTarget(page, block) {
    var m = NAV_INTENTS[page];
    if (!m || block == null) { return null; }
    return m[block] || null;
  }
  function motionOK() {
    try {
      return !!(window.matchMedia && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) { return true; }
  }
  function closestEl(el, cls) {
    while (el && el.nodeType === 1) {
      if (el.classList && el.classList.contains(cls)) { return el; }
      el = el.parentNode;
    }
    return null;
  }
  function auditToastFor(idx) {
    var s = App.state.auditStage;
    if (s === -1) { return "Pipeline idle — press Run Assessment"; }
    if (s < idx) { return "Stage L" + idx + " unlocks as the assessment runs — press Run Assessment"; }
    return "Assessment reached L" + Math.min(s, 4) + " — numbers are live below";
  }
  function navTo(hash, it) {
    intent = it || null;
    nav(hash);
  }
  function revealOnce() {
    var it = intent;
    intent = null;
    if (!it || !mainEl) { return; }
    var route = currentRoute();
    var target = intentTarget(route, it.block);
    if (!target) { return; }
    var el = null;
    if (typeof target.idx === "number") {
      var nodes = mainEl.querySelectorAll(".card.block");
      el = nodes[target.idx] || null;
    } else if (target.sel) {
      el = mainEl.querySelector(target.sel);
    }
    if (!el) { return; }
    var holder = el;
    if (target.sel === "#verify-btn") { holder = closestEl(el, "proof-row") || el; }
    else if (!(typeof target.idx === "number")) { holder = closestEl(el, "card") || el; }
    var det = holder.querySelector ? holder.querySelector("details.how") : null;
    if (det && !det.open) { det.open = true; }
    var toast = target.toast || "";
    if (route === "audit" && typeof target.idx === "number") { toast = auditToastFor(target.idx); }
    else if (route === "report" && it.block === "proof") {
      toast = App.state.anchor ? "Inspect local demo proof — root matches P1 anchor" : "Anchor data in P1 first";
    }
    if (holder.classList) {
      holder.classList.add("hp-hint");
      App.fn.timeout(function () {
        if (holder.classList) { holder.classList.remove("hp-hint"); }
      }, 1600);
    }
    if (toast && App.ui) { App.ui.toast(toast); }
    if (holder.scrollIntoView) {
      holder.scrollIntoView({ behavior: motionOK() ? "smooth" : "auto", block: "start" });
    }
  }

  function buildShell() {
    var u = App.ui;
    rootEl.innerHTML = '<div class="shell"><a class="v-skip" href="#view-main">Skip to content</a>' +
      '<header class="v-topbar"><div class="v-top-inner"><a class="v-brand" href="#/landing" aria-label="FlowCredit home">' + u.icon('layers', 26) + '<span>FlowCredit</span></a>' + u.tag('DEMO') +
      '<nav class="v-top-links" aria-label="Main navigation"><a href="#/workspace" data-top="workspace">Workspace</a></nav>' +
      '<span class="v-service" id="v-ai-service">' + u.icon('cpu', 15) + '<span>Assessment ready in this browser</span></span></div></header>' +
      '<div class="v-context"><div class="v-case-control"><label for="v-case-select">Current case</label><select id="v-case-select" aria-describedby="v-case-note">' +
      SUBJECT_ORDER.map(function (k) { return '<option value="' + k + '">' + u.esc(SUBJECTS[k].label) + '</option>'; }).join('') + '</select><span id="v-case-note">Switching cases resets the current demo run.</span></div>' +
      '<nav class="v-workflow" aria-label="Assessment workflow">' + TABS.map(function (t) { return '<a href="' + t.hash + '" data-route="' + t.key + '"><span class="v-step-number">' + t.sub + '</span><span>' + t.label + '<small data-progress="' + t.key + '"></small></span>' + u.icon('check', 16) + '</a>'; }).join('') + '</nav></div>' +
      '<main class="content" id="view-main" tabindex="-1"></main>' +
      '<footer class="foot"><a class="v-brand" href="#/landing">FlowCredit<span> / Risk intelligence</span></a><p>Supplied evidence · Local drafts · No custody or lending</p><p>Risk analytics, not a statutory audit. Not financial advice. Experimental rules.</p></footer></div>';
    mainEl = rootEl.querySelector('#view-main');
    rootEl.querySelector('.v-skip').addEventListener('click', function (e) { e.preventDefault(); mainEl.focus(); });
    rootEl.querySelector('#v-case-select').addEventListener('change', function () { App.act.switchSubject(this.value); });
    window.addEventListener('fc:live', function (event) { var el = document.getElementById('v-ai-service'), service = event.fcDetail && event.fcDetail.serviceStatus || window.FC_SERVICE_STATUS || {}; if (el) el.innerHTML = u.icon('cpu', 15) + '<span>Risk engine ready · AI extraction ' + (service.aiExtraction === 'ready' ? 'available' : service.aiExtraction) + '</span>'; });
  }

  function highlightFlow() {
    var route = currentRoute(), st = App.state;
    document.body.setAttribute('data-route', route);
    var context = rootEl.querySelector('.v-context');
    context.hidden = route === 'landing' || route === 'workspace';
    var sel = rootEl.querySelector('#v-case-select');
    var customDraft = window.FC_INTAKE && FC_INTAKE.active ? FC_INTAKE.active() : null;
    var caseControl = rootEl.querySelector('.v-case-control');
    if (caseControl) caseControl.hidden = true;
    sel.value = st.subject; sel.disabled = st.running;
    var done = st.auditStage === 4 && !st.running;
    var customDone = !!(customDraft && customDraft.status === 'complete' && customDraft.result);
    var progress = customDraft
      ? {ingest: customDone ? 'Input confirmed' : customDraft.status === 'running' ? 'Assessing…' : 'Draft in progress', audit: customDone ? 'Complete' : 'Not started', report: customDone ? 'Ready to explore' : 'Assessment required'}
      : {ingest: 'Start with supplied facts', audit: 'Not started', report: 'Assessment required'};
    var links = rootEl.querySelectorAll('.v-workflow a');
    for (var i=0; i<links.length; i++) {
      var key = links[i].getAttribute('data-route');
      links[i].classList.toggle('on', key === route);
      links[i].classList.toggle('complete', customDone);
      if (key === route) links[i].setAttribute('aria-current','step'); else links[i].removeAttribute('aria-current');
      links[i].querySelector('small').textContent = progress[key];
    }
    var tops = rootEl.querySelectorAll('[data-top]');
    for (var j=0;j<tops.length;j++) { if (tops[j].getAttribute('data-top') === route) tops[j].setAttribute('aria-current','page'); else tops[j].removeAttribute('aria-current'); }
  }
  function paintFlow() { if (rootEl) highlightFlow(); }
  App.flow = {
    snapshot: function (subject) {
      function stg(s2, txt) { return { s: s2, txt: txt }; }
      var st = App.state || {};
      var runs = (window.AI_LEDGER && AI_LEDGER.runs) || {};
      var anchored = !!st.anchored;
      var stageNum = (typeof st.auditStage === "number") ? st.auditStage : -1;
      var rulesDone = stageNum >= 4;
      var rulesRun = stageNum >= 0;
      var aiRun = !!(runs[subject] && runs[subject].verdict);
      var root = !!(st.anchor && st.anchor.root);
      return {
        attest: stg(anchored ? "g" : "0", anchored ? "local demo proof created" : "pending · create evidence proof"),
        score: {
          rules: stg(rulesDone ? "g" : rulesRun ? "y" : "0", rulesDone ? "L0–L5 complete" : rulesRun ? "assessment in progress" : "not started"),
          ai: stg(aiRun ? "g" : "0", aiRun ? "LLM verdict present" : "no LLM run yet")
        },
        decide: stg(rulesDone && aiRun ? "g" : (rulesRun || aiRun) ? "y" : "0",
          rulesDone && aiRun ? "rule and AI assessments available" : (rulesRun || aiRun) ? "waiting on one engine" : "not started"),
        anchor: stg(root ? "g" : "0", root ? "local demo root created" : "not anchored"),
        monitor: stg(st.stress === "recover" ? "g" : "0", st.stress === "recover" ? "scenario complete" : "scenario not complete")
      };
    },
    refresh: function () { paintFlow(); }
  };

  function highlightTabs() {
    var route = currentRoute();
    var links = rootEl.querySelectorAll(".nav-tab");
    for (var i = 0; i < links.length; i++) {
      var on = links[i].getAttribute("data-route") === route;
      links[i].classList.toggle("on", on);
      if (on) { links[i].setAttribute("aria-current", "page"); } else { links[i].removeAttribute("aria-current"); }
    }
  }

  // Landing is the marketing front door: hide app chrome while on #/landing.
  function syncShell() {
    if (!rootEl) { return; }
    var shell = rootEl.querySelector(".shell");
    if (!shell) { return; }
    shell.classList.toggle("is-landing", currentRoute() === "landing");
  }

  var lastView = '', lastSubject = '';
  function renderCurrent() {
    if (!mainEl || !booted) return;
    var route = currentRoute(), same = lastView === route && lastSubject === App.state.subject;
    var focused = document.activeElement, focusedId = focused && focused.id;
    var open = same ? Array.prototype.map.call(mainEl.querySelectorAll('details[open][id]'), function(n){return n.id;}) : [];
    syncShell();
    (App.views[route] || App.views.ingest).render(mainEl);
    open.forEach(function(id){var el=document.getElementById(id);if(el)el.open=true;});
    highlightTabs(); highlightFlow();
    if (same && focusedId) { var next=document.getElementById(focusedId);if(next && !next.disabled)next.focus({preventScroll:true}); }
    if (lastView && !same) { window.scrollTo(0,0); mainEl.focus({preventScroll:true}); }
    lastView=route;lastSubject=App.state.subject;
    revealOnce();
  }

  // Route changes: cancel every pending handle first (no cross-page
  // callback pollution). In-flight stress returns to idle; terminal
  // states (idle / recover) are preserved by state.
  function applyRoute() {
    var route = currentRoute();
    syncShell();
    var changed = route !== (App.state.route || "#/landing").slice(2);
    var flight = App.fn.stressFlying();
    App.fn.clearTimers();
    var patch = { route: "#/" + route, running: false };
    if (changed && flight) { patch.stress = "idle"; }
    App.setState(patch); // subscriber re-renders the current view
  }

  function boot() {
    if (booted) { return; }
    booted = true;
    rootEl = document.getElementById("app");
    var bootMsg = document.getElementById("boot-msg");
    if (bootMsg && bootMsg.parentNode) { bootMsg.parentNode.removeChild(bootMsg); }
    buildShell();
    window.addEventListener("hashchange", applyRoute);
    if (!location.hash || !/^#\/(landing|workspace|ingest|audit|report)$/.test(location.hash)) {
      try { history.replaceState(null, "", "#/landing"); } catch (e) { location.hash = "#/landing"; }
    }
    App.nav = nav;
    App.navTo = navTo;
    App.applyRoute = applyRoute;
    App.renderCurrent = renderCurrent;
    App.onChange(function () { if (booted) { renderCurrent(); } });
    applyRoute();
  }

  // node-testable pure export; app.js loads headlessly for route assertions
  App.fn.routeKey = routeKey;
  App.fn.intentTarget = intentTarget;
  if (typeof document === "undefined") { return; } // node: stop before DOM wiring

  window.addEventListener("error", function () {
    if (App.ui) { App.ui.toast("Unexpected error — see console", "err"); }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
