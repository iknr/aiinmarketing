/*! AIM engagement layer.
 *  - A short note from the AIM team (bottom-right on desktop, above the Apply bar on mobile).
 *    On desktop it opens once per visit, after 45 seconds or once the visitor has scrolled
 *    half the page. It can be closed at any time, and a small launcher button brings it back
 *    (on phones the launcher shows only after the hero).
 *  - "Wait a minute" popup (#523): opens once per visit, after 30 seconds on the page and
 *    once the visitor has scrolled 60% of it. Never together with the note.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var t0 = Date.now();
  function seen(k) { try { return sessionStorage.getItem('aim_seen_' + k) === '1'; } catch (e) { return false; } }
  function mark(k) { try { sessionStorage.setItem('aim_seen_' + k, '1'); } catch (e) { /* storage blocked: still once per page view */ } }

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
    'The program is ₹5,999 without tool access, or ₹9,999 with tool access. The training, 4 specialisations and agency internship are the same in both plans. You pay only after your onboarding call, once your questions are answered, and a 7-day money-back guarantee applies.',
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

    // always available; opens by itself once per visit, on desktop only, and never early
    showLauncher(true);
    var autoNote = function () {
      if (seen('note') || anyDialogOpen() || window.innerWidth <= 820) return;
      mark('note');
      openNote();
    };
    setTimeout(autoNote, 45000);
    window.addEventListener('scroll', function onNoteScroll() {
      if (scrolledPast(0.5)) { window.removeEventListener('scroll', onNoteScroll); autoNote(); }
    }, { passive: true });
  }

  // phones: reveal the launcher once the visitor is past the hero
  window.addEventListener('scroll', function () {
    var past = (window.pageYOffset || document.documentElement.scrollTop) > window.innerHeight * 1.2;
    document.documentElement.classList.toggle('aim-past-hero', past);
  }, { passive: true });

  /* ======================================================== "Wait a minute" popup */
  var waitShown = false;

  function scrolledPast(fraction) {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    return max > 0 && (window.pageYOffset || doc.scrollTop) / max >= fraction;
  }

  function showWait() {
    if (!wait || waitShown || seen('wait') || anyDialogOpen() || (note && noteOpen()) || typeof wait.showModal !== 'function') return;
    waitShown = true;
    mark('wait');
    window.removeEventListener('scroll', onScroll);
    if (note && noteOpen()) closeNote(true); // never stack the popup on top of the note
    wait.showModal();
  }

  function onScroll() { if (scrolledPast(0.6) && Date.now() - t0 >= 30000) showWait(); }

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
    setTimeout(onScroll, 30500); // the visitor may have scrolled first and then stayed
  }
})();
