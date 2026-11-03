/*! AIM engagement layer.
 *  - A short note from the AIM team that slides in at the bottom corner on every visit
 *    (bottom-right on desktop, above the Apply bar on mobile). It can be closed at any
 *    time, and a small launcher button brings it back.
 *  - "Wait a minute" popup (#523): opens once per page view, when the visitor has
 *    scrolled 25% of the page.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var apply = $('#elementor-popup-modal-519');
  var wait = $('#elementor-popup-modal-wait');
  var note = $('#aim-bot');
  var launcher = $('#aim-launcher');

  function anyDialogOpen() { return (apply && apply.open) || (wait && wait.open); }
  function noteOpen() { return note && !note.hidden; }
  function goTo(selector) {
    var t = $(selector);
    if (t) t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }
  function openApply() {
    if (apply && typeof apply.showModal === 'function' && !apply.open) apply.showModal();
  }

  /* ======================================================== Note from the AIM team */
  var LINES = [
    'Hi, welcome to AIM.',
    'Most marketing courses teach AI as one chapter at the end. We teach it in every module, so you finish able to do the work, not just talk about it.',
    'From week 1 you practise inside the real tools. Then you spend a month at a partner agency and leave with a portfolio and an internship certificate.',
    'The full program is ₹5,999, all-inclusive, with pro tools in month 2, plus the tool costs and ad spend for your portfolio covered. You pay only after your onboarding call, once your questions are answered.',
    'Would you like to see what is included?'
  ];

  var text = note && $('.aim-bot-bubble', note);
  var actions = note && $('.aim-bot-cta', note);
  var timers = [];
  var playing = false;
  var later = function (fn, ms) { timers.push(setTimeout(fn, ms)); };

  function showLauncher(on) { if (launcher) launcher.hidden = !on; }

  function stopNote() {
    playing = false;
    timers.forEach(clearTimeout);
    timers = [];
  }

  function closeNote(instant) {
    stopNote();
    if (instant || reduceMotion) {
      note.hidden = true;
      showLauncher(true);
      return;
    }
    note.classList.add('is-out');
    setTimeout(function () {
      note.hidden = true;
      showLauncher(true);
    }, 250);
  }

  function showLine(i) {
    if (!playing) return;
    var line = LINES[i];
    text.textContent = line;
    text.classList.remove('is-swap');
    void text.offsetWidth; // restart the fade
    text.classList.add('is-swap');
    if (i === LINES.length - 1) { actions.hidden = false; return; }
    later(function () { showLine(i + 1); }, 1400 + line.length * 26);
  }

  function openNote() {
    if (!note || noteOpen()) return;
    stopNote();
    playing = true;
    text.textContent = '';
    actions.hidden = true;
    showLauncher(false);
    note.hidden = false;
    note.classList.remove('is-out', 'is-in');
    void note.offsetWidth;
    note.classList.add('is-in');
    later(function () { showLine(0); }, reduceMotion ? 0 : 350);
  }

  if (note) {
    $('.aim-bot-x', note).addEventListener('click', function () { closeNote(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && noteOpen()) closeNote(false); });
    actions.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (!link) return;
      var href = link.getAttribute('href');
      // Apply links are handled by the global popup handler; anchors scroll smoothly
      if (href.indexOf('#elementor-action:') !== 0) { e.preventDefault(); goTo(href); }
      closeNote(false);
    });
    if (launcher) launcher.addEventListener('click', openNote);

    // always available, and opens by itself a few seconds into every visit
    showLauncher(true);
    setTimeout(function () { if (!anyDialogOpen()) openNote(); }, 4000);
  }

  /* ======================================================== "Wait a minute" popup */
  var waitShown = false;

  function scrolledPast(fraction) {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    return max > 0 && (window.pageYOffset || doc.scrollTop) / max >= fraction;
  }

  function showWait() {
    if (!wait || waitShown || anyDialogOpen() || typeof wait.showModal !== 'function') return;
    waitShown = true;
    window.removeEventListener('scroll', onScroll);
    if (note && noteOpen()) closeNote(true); // never stack the popup on top of the note
    wait.showModal();
  }

  function onScroll() { if (scrolledPast(0.25)) showWait(); }

  if (wait) {
    wait.addEventListener('click', function (e) {
      if (e.target === wait || e.target.closest('[data-aim-wait-close]')) wait.close();
    });
    var cta = $('[data-aim-wait-apply]', wait);
    if (cta) cta.addEventListener('click', function (e) {
      e.preventDefault();
      wait.close();
      openApply();
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // covers a page that loads already scrolled (anchor link, reload)
  }
})();
