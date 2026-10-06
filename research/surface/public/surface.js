// Minimal enhancement layer for FlowCredit Research Workbench UI-2.0.
// No fetch, no storage, no mutation. The server remains the source of truth.
(function () {
  'use strict';

  function focusSearch() {
    var input = document.getElementById('global-q');
    if (!input) return false;
    input.focus();
    input.select();
    return true;
  }

  document.addEventListener('keydown', function (event) {
    var target = event.target;
    var typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k') {
      event.preventDefault();
      focusSearch();
      return;
    }
    if (!typing && event.key === '/') {
      event.preventDefault();
      focusSearch();
    }
  });

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
      note.textContent = group.getAttribute('data-preview-note') || 'Preview only. No research record was changed.';
      note.hidden = false;
    }
  });
})();
