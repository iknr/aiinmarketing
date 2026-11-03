/*! AIM event helper: pushes conversion events to the GTM dataLayer.
 *  Events: lead_submit (apply / contact forms), guide_download (free guides), apply_click, buy_click (Amazon). */
(function () {
  'use strict';
  window.dataLayer = window.dataLayer || [];
  var push = function (o) { window.dataLayer.push(o); };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('#elementor-action') === 0) push({ event: 'apply_click', link_text: (a.textContent || '').trim().slice(0, 60), page_path: location.pathname });
    else if (/amazon\./i.test(href)) push({ event: 'buy_click', link_url: href, page_path: location.pathname });
  }, true);
  function watch(node) {
    if (!node || node.__aimWatched) return;
    node.__aimWatched = true;
    new MutationObserver(function () {
      var form = node.closest('form');
      var ok = node.classList.contains('elementor-message-success') || node.classList.contains('ok');
      if (!form || !ok || node.__aimFired === node.textContent) return;
      node.__aimFired = node.textContent;
      var src = form.querySelector('[name="form_fields[source]"]');
      var name = (form.querySelector('[name="form_name"]') || {}).value || form.getAttribute('name') || '';
      if (form.classList.contains('aim-magnet-form')) push({ event: 'guide_download', guide: src ? src.value : name, page_path: location.pathname });
      else push({ event: 'lead_submit', form_name: name, page_path: location.pathname });
    }).observe(node, { attributes: true, attributeFilter: ['class'], childList: true, characterData: true, subtree: true });
  }
  function scan() { document.querySelectorAll('form .elementor-message, form .aimp-msg').forEach(watch); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
})();
