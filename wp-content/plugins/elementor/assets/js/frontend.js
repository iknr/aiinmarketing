/*! Elementor frontend (page 622): nav toggle, popup triggers, form handling. */
(function () {
  'use strict';

  var POPUP_APPLY = '519';
  var POPUP_SYLLABUS = '522';
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- footer year ---------- */
  var year = $('#yr');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- mobile navigation ---------- */
  var toggle = $('[data-elementor-nav-toggle]');
  var nav = $('.am-navlinks');
  function setNav(open) {
    if (!toggle || !nav) return;
    nav.classList.toggle('am-open', open);
    toggle.classList.toggle('am-on', open);
    toggle.setAttribute('aria-expanded', String(open));
  }
  if (toggle) toggle.addEventListener('click', function () { setNav(!nav.classList.contains('am-open')); });
  if (nav) nav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });

  /* ---------- popups: links like #elementor-action:action=popup:open&settings=<base64> ---------- */
  var modal = $('#elementor-popup-modal-' + POPUP_APPLY);

  function popupIdFrom(href) {
    var m = /settings=([^&]+)/.exec(href);
    if (!m) return null;
    try { return String(JSON.parse(atob(decodeURIComponent(m[1]))).id); } catch (err) { return null; }
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#elementor-action:"]');
    if (!link) return;
    e.preventDefault();
    setNav(false);
    var id = popupIdFrom(link.getAttribute('href'));
    if (id === POPUP_SYLLABUS) {
      var target = $('#syllabus');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (modal && typeof modal.showModal === 'function') {
      modal.showModal();
      var first = $('input', modal);
      if (first) first.focus();
    }
  });

  if (modal) {
    modal.addEventListener('click', function (e) {
      // click on the backdrop (the <dialog> itself) or the close button
      if (e.target === modal || e.target.closest('[data-elementor-popup-close]')) modal.close();
    });
  }

  /* ---------- forms ---------- */
  function setMessage(form, text, kind) {
    var box = $('.elementor-message', form);
    if (!box) return;
    box.hidden = !text;
    box.textContent = text || '';
    box.className = 'elementor-message' + (kind ? ' elementor-message-' + kind : '');
  }

  function validate(form) {
    var name = $('[name="form_fields[name]"]', form).value.trim();
    var phone = $('[name="form_fields[phone]"]', form).value.replace(/\D/g, '');
    var email = $('[name="form_fields[email]"]', form).value.trim();
    var stage = $('[name="form_fields[stage]"]', form);

    if (name.length < 2) return 'Please enter your full name.';
    if (phone.length === 12 && phone.indexOf('91') === 0) phone = phone.slice(2);
    if (!/^[6-9]\d{9}$/.test(phone)) return 'Please enter a valid 10-digit mobile number.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return 'Please enter a valid email address.';
    if (stage && !stage.value) return 'Please tell us where you are right now.';
    return '';
  }

  $$('form.elementor-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var problem = validate(form);
      if (problem) return setMessage(form, problem, 'danger');

      setMessage(form, '');
      form.classList.add('elementor-form-submitting');
      var body = new URLSearchParams(new FormData(form));
      body.set('action', 'elementor_pro_forms_send_form');
      body.set('referer', location.href);

      fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      })
        .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, json: j }; }); })
        .then(function (r) {
          if (!r.ok || !r.json.success) throw new Error((r.json.data && r.json.data.message) || 'error');
          form.reset();
          setMessage(form, r.json.data.message || 'Your submission was successful.', 'success');
        })
        .catch(function () {
          setMessage(form, 'Your submission failed because of an error. Please try again or call us.', 'danger');
        })
        .then(function () { form.classList.remove('elementor-form-submitting'); });
    });
  });
})();
