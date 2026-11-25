/* Opens a lead-magnet form in a popup (<dialog>) from any button with data-aim-popup="<dialog id>".
 * The form inside is a normal form.aim-magnet-form, so aim-magnet.js still validates, posts the lead and shows the download link. */
(function () {
  'use strict';
  function wire(btn) {
    var dlg = document.getElementById(btn.getAttribute('data-aim-popup'));
    if (!dlg || typeof dlg.showModal !== 'function') { if (dlg) dlg.setAttribute('open', ''); return; }
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      dlg.showModal();
      var first = dlg.querySelector('input[type="text"],input[name="form_fields[name]"]');
      if (first) first.focus();
      try { (window.dataLayer = window.dataLayer || []).push({ event: 'guide_popup_open', guide: dlg.getAttribute('data-guide') || dlg.id, page_path: location.pathname }); } catch (x) {}
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    var x = dlg.querySelector('.aim-pop-x');
    if (x) x.addEventListener('click', function () { dlg.close(); });
  }
  document.querySelectorAll('[data-aim-popup]').forEach(wire);
})();
