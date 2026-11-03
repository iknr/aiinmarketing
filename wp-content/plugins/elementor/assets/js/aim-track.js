/*! AIM event helper: pushes conversion events to the GTM dataLayer.
 *  Also captures campaign attribution (utm_*, click ids, referrer host, landing path) and adds it to form submissions.
 *  Events: lead_submit (apply / contact forms), guide_download (free guides), apply_click, buy_click (Amazon), track_click (three-track links). */
(function () {
  'use strict';
  window.dataLayer = window.dataLayer || [];
  var push = function (o) { window.dataLayer.push(o); };

  // ---- Attribution: first touch (localStorage 'aim_attr_first', 30 days), last touch (sessionStorage 'aim_attr_last').
  // Every storage access is wrapped; with storage blocked the current page's own data is still used.
  var UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  var CLICK = ['gclid', 'fbclid', 'msclkid'];
  var OWN = ['aiinmarketing.in', 'www.aiinmarketing.in'];
  var TTL = 30 * 24 * 60 * 60 * 1000;
  function clean(v) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '').trim().slice(0, 120); }
  function store(kind) { try { return window[kind]; } catch (e) { return null; } }
  function read(kind, key) { try { var s = store(kind); var v = s && s.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function write(kind, key, obj) { try { var s = store(kind); if (s) s.setItem(key, JSON.stringify(obj)); } catch (e) { /* storage blocked */ } }
  function hasCampaign(a) {
    if (!a) return false;
    for (var i = 0; i < UTM.length; i++) if (a[UTM[i]]) return true;
    for (var j = 0; j < CLICK.length; j++) if (a[CLICK[j]]) return true;
    return false;
  }
  function current() {
    var a = { landing_path: clean(location.pathname), t: Date.now() };
    try {
      var q = new URLSearchParams(location.search);
      UTM.concat(CLICK).forEach(function (k) { var v = clean(q.get(k)); if (v) a[k] = v; });
    } catch (e) { /* no URLSearchParams */ }
    try {
      var h = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : '';
      a.referrer_host = h && OWN.indexOf(h) < 0 ? clean(h) : '';
    } catch (e) { a.referrer_host = ''; }
    return a;
  }
  var cur = current();
  var first = read('localStorage', 'aim_attr_first');
  if (first && !(first.t && Date.now() - first.t < TTL)) first = null;
  if (!first) { first = cur; write('localStorage', 'aim_attr_first', first); }
  var last = read('sessionStorage', 'aim_attr_last');
  if (hasCampaign(cur) || !last) { last = cur; write('sessionStorage', 'aim_attr_last', last); }
  if (hasCampaign(last)) {
    var sent = false;
    try { sent = store('sessionStorage').getItem('aim_attr_sent') === '1'; } catch (e) { /* ignore */ }
    if (!sent) {
      try { store('sessionStorage').setItem('aim_attr_sent', '1'); } catch (e) { /* ignore */ }
      push({ event: 'attribution_set', utm_source: last.utm_source || '', utm_medium: last.utm_medium || '', utm_campaign: last.utm_campaign || '' });
    }
  }
  function pick() {
    var src = hasCampaign(last) ? last : first || cur;
    var kind = hasCampaign(last) ? 'last' : hasCampaign(first) ? 'first' : 'direct';
    if (kind === 'first') src = first;
    var click = '';
    for (var i = 0; i < CLICK.length; i++) if (!click && src[CLICK[i]]) click = CLICK[i] + ':' + src[CLICK[i]];
    var f = {
      utm_source: src.utm_source || '', utm_medium: src.utm_medium || '', utm_campaign: src.utm_campaign || '',
      utm_term: src.utm_term || '', utm_content: src.utm_content || '', click_id: click,
      referrer_host: (first && first.referrer_host) || src.referrer_host || cur.referrer_host || '',
      landing_path: (first && first.landing_path) || src.landing_path || cur.landing_path || '',
      attribution: kind
    };
    if (kind === 'last') f.referrer_host = src.referrer_host || f.referrer_host;
    return f;
  }
  function isLeadForm(f) {
    if (!f || f.nodeName !== 'FORM') return false;
    var act = String(f.getAttribute('action') || '');
    var cls = String(f.className || '');
    return act.indexOf('admin-ajax.php') > -1 || cls.indexOf('elementor-form') > -1 || cls.indexOf('aim-magnet-form') > -1;
  }
  document.addEventListener('submit', function (e) {
    try {
      var form = e.target;
      if (!isLeadForm(form)) return;
      var vals = pick();
      Object.keys(vals).forEach(function (k) {
        var name = 'form_fields[' + k + ']';
        var inp = null, all = form.elements;
        for (var i = 0; i < all.length; i++) if (all[i].name === name) { inp = all[i]; break; }
        if (!inp) { inp = document.createElement('input'); inp.type = 'hidden'; inp.name = name; form.appendChild(inp); }
        inp.value = vals[k];
      });
    } catch (err) { /* never block a submission */ }
  }, true);
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var tk = a.getAttribute('data-track');
    if (tk) push({ event: 'track_click', track: tk, location: a.getAttribute('data-track-loc') || '', page_path: location.pathname });
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
