/*! AIM event helper: pushes conversion events to the GTM dataLayer.
 *  Also captures campaign attribution (utm_*, click ids, referrer host, landing path) and adds it to form submissions,
 *  plus (phase 1) first and last touch in full, channel (ai-chat, paid-search, organic-search, social, ...), full form page URL and Clarity ids.
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
  function clean(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '').trim().slice(0, max || 120); }
  // Page URL without click ids (gclid/fbclid/msclkid) and without the #hash, so the full landing URL keeps its UTM tags.
  function urlNoClick(href, max) {
    try { var u = new URL(href); CLICK.forEach(function (k) { u.searchParams.delete(k); }); return clean(u.origin + u.pathname + u.search, max); } catch (e) { return ''; }
  }
  // Channel: AI chat tools (ChatGPT adds utm_source=chatgpt.com itself) are one channel, kept apart from search and social.
  var AI = /(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com|perplexity\.ai|gemini\.google\.com|claude\.ai|copilot\.microsoft\.com|phind\.com|you\.com)$/;
  var SEARCH = /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org|brave\.com)$/;
  var SOCIAL = /(^|\.)(linkedin\.com|lnkd\.in|facebook\.com|instagram\.com|t\.co|twitter\.com|x\.com|youtube\.com|reddit\.com|wa\.me|whatsapp\.com)$/;
  function channelOf(a) {
    if (!a) return 'direct';
    var s = a.utm_source || '', m = a.utm_medium || '', h = a.referrer_host || '';
    if (AI.test(s) || AI.test(h)) return 'ai-chat';
    if (a.gclid || a.msclkid || /^(cpc|ppc|paid-search|paidsearch|sem)$/.test(m)) return 'paid-search';
    if (a.fbclid || /^(paid|paid-social|paidsocial|cpm)$/.test(m)) return 'paid-social';
    if (m === 'email') return 'email';
    if (m === 'social' || SOCIAL.test(s) || SOCIAL.test(h)) return 'social';
    if (m === 'organic' || SEARCH.test(h)) return 'organic-search';
    if (h) return 'referral';
    return hasCampaign(a) ? 'other-campaign' : 'direct';
  }
  // One readable line per touch: channel, utm, referrer, full landing URL, date.
  function touchText(a) {
    if (!a) return '';
    var u = [a.utm_source, a.utm_medium, a.utm_campaign, a.utm_term, a.utm_content].map(function (v) { return v || '-'; }).join(' / ');
    var day = '-';
    try { if (a.t) day = new Date(a.t).toISOString().slice(0, 10); } catch (e) { /* ignore */ }
    return clean('channel: ' + channelOf(a) + '; utm: ' + u + '; referrer: ' + (a.referrer_url || a.referrer_host || '-') + '; landing: ' + (a.landing_url || a.landing_path || '-') + '; date: ' + day, 400);
  }
  // Microsoft Clarity ids (cookies _clck = user, _clsk = session, first segment), so a lead can be matched to its recording.
  function claId(name) {
    try {
      var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
      var v = m ? decodeURIComponent(m[1]).split('|')[0] : '';
      return /^[a-z0-9]{3,24}$/i.test(v) ? v.toLowerCase() : '';
    } catch (e) { return ''; }
  }
  // Clarity's own metadata call gives the same user and session ids the recordings list shows (cookies are only the fallback).
  var claMeta = { user: '', session: '' };
  function readMeta() {
    try {
      if (typeof window.clarity !== 'function') return;
      window.clarity('metadata', function (m) {
        try {
          if (m && /^[a-z0-9]{3,24}$/i.test(String(m.userId || ''))) claMeta.user = String(m.userId).toLowerCase();
          if (m && /^[a-z0-9]{3,24}$/i.test(String(m.sessionId || ''))) claMeta.session = String(m.sessionId).toLowerCase();
        } catch (e) { /* ignore */ }
      });
    } catch (e) { /* ignore */ }
  }
  // Tags the Clarity session (filterable under Custom tags) when Clarity is loaded; never throws.
  function tagClarity(vals, submitted) {
    try {
      if (typeof window.clarity !== 'function') return;
      window.clarity('set', 'channel', vals.channel || 'direct');
      window.clarity('set', 'attribution', vals.attribution || 'direct');
      if (submitted) { window.clarity('set', 'lead_form', 'yes'); window.clarity('event', 'lead_form_submit'); }
    } catch (e) { /* ignore */ }
  }
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
    var a = { landing_path: clean(location.pathname), landing_url: urlNoClick(location.href, 250), t: Date.now() };
    try {
      var q = new URLSearchParams(location.search);
      // UTM values are stored lowercase so "LinkedIn" and "linkedin" never split into two sources
      UTM.concat(CLICK).forEach(function (k) { var v = clean(q.get(k)); if (v && UTM.indexOf(k) > -1) v = v.toLowerCase(); if (v) a[k] = v; });
    } catch (e) { /* no URLSearchParams */ }
    try {
      var r = document.referrer ? new URL(document.referrer) : null;
      var h = r ? r.hostname.toLowerCase() : '';
      a.referrer_host = h && OWN.indexOf(h) < 0 ? clean(h) : '';
      a.referrer_url = a.referrer_host ? clean(r.origin + r.pathname, 160) : '';
    } catch (e) { a.referrer_host = ''; a.referrer_url = ''; }
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
    // Phase 1 extras: both touches in full, channel, full form page URL, Clarity ids (all optional on the server)
    f.channel = channelOf(src);
    f.first_touch = touchText(first || cur);
    f.last_touch = touchText(last);
    f.form_url = urlNoClick(location.href, 250);
    readMeta();
    f.clarity_user = claMeta.user || claId('_clck');
    f.clarity_session = claMeta.session || claId('_clsk');
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
      tagClarity(vals, true);
    } catch (err) { /* never block a submission */ }
  }, true);
  // Tag the Clarity session with the channel shortly after load (Clarity is loaded by GTM, so give it a moment).
  setTimeout(function () { try { readMeta(); tagClarity(pick(), false); } catch (e) { /* ignore */ } }, 3500);
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
