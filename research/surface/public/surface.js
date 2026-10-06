// Minimal local interactions for the Research Surface.
// No fetch, no storage, no network mutation. Refreshing restores defaults.
(function () {
  'use strict';

  // Review preview buttons start unselected in the SSR markup; make the
  // initial pressed state explicit for assistive technology.
  var initial = document.querySelectorAll('[data-preview-button]');
  for (var index = 0; index < initial.length; index += 1) {
    if (!initial[index].hasAttribute('aria-pressed')) initial[index].setAttribute('aria-pressed', 'false');
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-preview-button]');
    if (!button) return;
    var group = button.closest('.review-actions');
    if (!group) return;
    var note = group.parentElement ? group.parentElement.querySelector('.preview-note') : null;
    var buttons = group.querySelectorAll('[data-preview-button]');
    for (var buttonIndex = 0; buttonIndex < buttons.length; buttonIndex += 1) {
      var candidate = buttons[buttonIndex];
      var selected = candidate === button;
      candidate.classList.toggle('is-selected', selected);
      candidate.setAttribute('aria-pressed', selected ? 'true' : 'false');
    }
    if (note) {
      note.textContent = group.getAttribute('data-preview-note') || 'Preview only.';
      note.hidden = false;
    }
  });

  // Belief reasoning inspector is a local disclosure only. It switches between
  // server-rendered panels and never fetches, stores, scores, or mutates.
  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-reasoning-target]');
    if (!trigger) return;
    var targetId = trigger.getAttribute('data-reasoning-target');
    if (!targetId) return;
    var panel = document.getElementById(targetId);
    if (!panel) return;

    var triggers = document.querySelectorAll('[data-reasoning-target]');
    for (var triggerIndex = 0; triggerIndex < triggers.length; triggerIndex += 1) {
      var candidateTrigger = triggers[triggerIndex];
      candidateTrigger.setAttribute('aria-pressed', candidateTrigger === trigger ? 'true' : 'false');
    }

    var panels = document.querySelectorAll('[data-reasoning-panel]');
    for (var panelIndex = 0; panelIndex < panels.length; panelIndex += 1) {
      panels[panelIndex].hidden = panels[panelIndex] !== panel;
    }
  });

})();
