/* Home: evidence-led product story, with no autoplay or external assets. */
(function () {
  var App = window.App;
  function render(host) {
    var u = App.ui;
    host.innerHTML = '<div class="v-home"><section class="v-hero"><div class="v-hero-copy"><p class="v-eyebrow">SUPPLIED EVIDENCE / AI BUSINESSES</p><h1>Know what holds up.<br><em>See what is missing.</em></h1><p class="v-hero-deck">Turn operating facts into a risk assessment you can take with you.</p><p class="v-hero-text">Organize supplied compute, usage and business evidence. Review inconsistencies and missing inputs, then print a report or export a restorable snapshot.</p><div class="v-hero-actions"><a class="btn btn-primary" href="#/workspace">Explore an assessment →</a><a class="v-text-link" href="#v-how" id="v-how-link">How it works ↓</a></div><p class="v-caption">Runs in your browser · No installation required · No custody or lending</p></div><div class="v-terminal"><div class="v-terminal-bar">' + u.icon('layers', 16) + ' FLOWCREDIT / EVIDENCE DESK</div><div class="v-terminal-body"><h2>One assessment. Clear next steps.</h2><div class="v-source-map">' + [['cpu','Compute'],['db','Usage'],['cash','Business'],['shield','Evidence']].map(function (item) { return '<div>' + u.icon(item[0],22) + '<span>' + item[1] + '</span></div>'; }).join('') + '</div><p>Supplied records are assessed by deterministic rules. Source authenticity is not independently verified.</p><p class="v-caption">The worked example uses synthetic test data.</p></div></div></section><section class="v-home-section" id="v-how"><div class="v-section-intro"><p class="v-eyebrow">EVIDENCE → RISK → ACTION</p><h2>From facts to a report.</h2></div><div class="v-three-grid">' + [['01','db','Confirm the facts','Start with a worked example or enter nine basic fields. Add history and evidence when available.'],['02','pulse','Review the assessment','One rule result explains activity coherence, risk signals and missing evidence. AI can assist with explanation only.'],['03','shield','Take the report with you','Print or save a PDF, export JSON, and restore the assessment in another browser.']].map(function (item) { return '<article class="v-process-card"><div><span class="num">' + item[0] + '</span>' + u.icon(item[1],24) + '</div><h3>' + item[2] + '</h3><p>' + item[3] + '</p></article>'; }).join('') + '</div></section><section class="v-home-section"><details class="v-details" id="v-method"><summary>Methodology and current limits</summary><div class="v-details-body"><h3>What runs here</h3><p>Deterministic assessment, missing-evidence guidance, local drafts and report export. Optional AI extraction and explanation require a local agent and separate consent.</p><h3>What remains unverified</h3><p>No live evidence connectors, calibrated default probability, numeric lending limit, automatic approval or continuous monitoring. Local mock-hash proofs check consistency only.</p><p class="v-caption">Experimental risk analytics, not a statutory audit or financial advice.</p></div></details></section></div>';
    host.querySelector("#v-how-link").addEventListener("click", function (e) {
      e.preventDefault();
      host
        .querySelector("#v-how")
        .scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
        });
    });
  }
  App.views = App.views || {};
  App.views.landing = { render: render };
})();
