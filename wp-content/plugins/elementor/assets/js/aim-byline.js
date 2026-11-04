/* Author byline cards: tap / Enter / Space toggles the card, outside click, Escape and opening another card close it.
 * Hover and keyboard focus are handled in CSS (aim-blog.css). No personal data, no network. */
(function () {
  'use strict';
  var by = document.querySelector('.aimb-byline');
  if (!by) return;
  var btns = Array.prototype.slice.call(by.querySelectorAll('.aimb-bl-avbtn'));
  function closeAll(except) {
    btns.forEach(function (b) { if (b !== except) b.setAttribute('aria-expanded', 'false'); });
  }
  btns.forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      by.classList.remove('is-dismissed');
      var open = b.getAttribute('aria-expanded') === 'true';
      closeAll(b);
      b.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (open) by.classList.add('is-dismissed');
    });
  });
  document.addEventListener('click', function (e) {
    if (!by.contains(e.target)) closeAll(null);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    var any = by.querySelector('[aria-expanded="true"]') || by.matches(':hover') || by.querySelector(':focus-visible');
    closeAll(null);
    if (any) by.classList.add('is-dismissed');
  });
  ['mouseover', 'focusin'].forEach(function (t) {
    by.addEventListener(t, function () { by.classList.remove('is-dismissed'); });
  });
})();
