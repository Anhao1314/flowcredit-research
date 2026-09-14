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
})();
