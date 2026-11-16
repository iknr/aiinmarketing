/*! AIM assistant (1.1.0): a pre-written question flow on every page. The visitor taps a question and gets a short fixed answer.
 *  Optional: when /api/chat reports enabled (GEMINI_API_KEY set on Vercel) a typing box appears and Gemini answers from the site facts.
 *  If the endpoint is off, unreachable or fails at any point, the typing box disappears and the pre-written flow carries on. Everything it says comes from the site's own text
 *  (fees, schedule, modules, internship, refund). It does not discuss placements or jobs: the team handles that on a call.
 *  Edit the NODES object below to change the content. Events pushed to dataLayer (no personal data): chat_open, chat_choice.
 */
(function () {
  'use strict';
  if (window.__aimChat) return;
  window.__aimChat = true;

  var HOME = location.pathname === '/' || location.pathname === '/index.html';
  var APPLY_HREF = HOME ? '#elementor-action:action=popup:open&settings=eyJpZCI6IjUxOSIsInRvZ2dsZSI6ZmFsc2V9' : '/#bonus';
  var SYLLABUS_HREF = HOME ? '#syllabus' : '/#syllabus';
  var WA = 'https://wa.me/919611628535?text=' + encodeURIComponent('Hi, I have a question about the AIM course.');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------------ content
  var MENU = [
    { label: 'What does it cost?', to: 'fees' },
    { label: 'What will I learn?', to: 'learn' },
    { label: 'When are the classes?', to: 'classes' },
    { label: 'Tell me about the internship', to: 'internship' },
    { label: 'Is it right for me?', to: 'fit' },
    { label: 'Payment and refund', to: 'payment' },
    { label: 'Talk to the team', to: 'team' }
  ];
  var BACK = { label: 'Back to the menu', to: 'menu' };
  var APPLY = { label: 'Apply now', href: APPLY_HREF, primary: true, apply: true };
  var TEAM = { label: 'Talk to the team', to: 'team' };

  var NODES = {
    menu: { say: ['What would you like to know?'], options: MENU },
    fees: {
      say: ['There are two plans. The training is the same in both.',
        '₹5,999 without tool access, or ₹9,999 with tool access.',
        'Both include all 9 modules and the 4 specialisations, the 1-month agency internship with a certificate, a portfolio site with domain and hosting, and a CV rewrite with 3 mock interviews. There are no other add-ons.'],
      options: [{ label: 'What is tool access?', to: 'tools' }, { label: 'Payment and refund', to: 'payment' }, APPLY, BACK]
    },
    tools: {
      say: ['The ₹9,999 plan adds access to Claude, Semrush, Gemini Pro, Google AI Pro, Ahrefs, SpyFu, Ubersuggest and Canva.',
        'The ₹5,999 plan has no tool access. You still learn the same way, inside the real platforms where you have access. The exact access dates are confirmed on your onboarding call.'],
      options: [{ label: 'What does it cost?', to: 'fees' }, APPLY, BACK]
    },
    learn: {
      say: ['Nine modules with AI built into every one. You learn the full digital marketing stack: websites, SEO, social, ads and media planning.',
        'You work inside the real tools yourself, such as WordPress MCP, Claude and Claude Code on the command line, MCPs for ads, CRO automations and chatbots.',
        'All 4 specialisations are included for every student: AI Generalist, Marktech, Branding and Content, and Performance and Growth.'],
      options: [{ label: 'See the 12-week syllabus', href: SYLLABUS_HREF }, { label: 'When are the classes?', to: 'classes' }, BACK]
    },
    classes: {
      say: ['Live online, Monday to Friday, 9 to 11 pm IST. Weekends are for doubt clearing, project reviews and interview prep.',
        'You need a laptop and about 2 hours a day. Classes run in the evening, so you can keep your job or studies.'],
      options: [{ label: 'Tell me about the internship', to: 'internship' }, { label: 'What does it cost?', to: 'fees' }, BACK]
    },
    internship: {
      say: ['After the live training you spend 1 month at a partner agency, working on real client projects.',
        'We match you with an agency based on your projects and the area you did best in. The agency gives you the internship certificate, and you keep the projects for your portfolio as far as the agency allows.'],
      options: [{ label: 'What will I learn?', to: 'learn' }, APPLY, BACK]
    },
    fit: {
      say: ['Freelancers, people who want to work in or build agencies, and job seekers all take the same program, at the same fee.',
        'You do not need to know coding or marketing already. You start from building a website, describe what you want in plain language, and learn to check what AI gives you.'],
      options: [{ label: 'What will I learn?', to: 'learn' }, { label: 'When are the classes?', to: 'classes' }, TEAM, BACK]
    },
    payment: {
      say: ['You pay only after your onboarding call, once your questions are answered.',
        'There is a 7-day money-back guarantee. If AIM is not right for you, tell us within 7 days of your first live class and we will refund your program fee.'],
      options: [{ label: 'What does it cost?', to: 'fees' }, APPLY, BACK]
    },
    team: {
      say: ['The team can answer anything this chat cannot, such as batch dates or your own situation. Call, message or write to us.'],
      options: [
        { label: 'WhatsApp +91 96116 28535', href: WA, external: true, primary: true },
        { label: 'Call +91 83406 47293', href: 'tel:+918340647293' },
        { label: 'Email contact@adsmentor.in', href: 'mailto:contact@adsmentor.in' },
        BACK
      ]
    }
  };

  function greeting() {
    var h1 = document.querySelector('h1');
    var m = h1 && /course in ([^:]+):/.exec(h1.textContent || '');
    if (m && /\/digital-marketing-course\//.test(location.pathname)) {
      return ['Hi, I am the AIM assistant. You are looking at the ' + m[1].trim() + ' page. The course is live online, so you can join from anywhere.', 'What would you like to know?'];
    }
    return ['Hi, I am the AIM assistant. I answer common questions about the program.', 'What would you like to know?'];
  }

  // ------------------------------------------------------------------ dom
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function push(o) { try { (window.dataLayer = window.dataLayer || []).push(o); } catch (e) { /* ignore */ } }

  var launcher = el('button', 'aimc-launcher');
  launcher.type = 'button';
  launcher.setAttribute('aria-label', 'Open the AIM assistant');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'aimc-panel');
  launcher.innerHTML = '<span class="aimc-av" aria-hidden="true">AIM</span><span class="aimc-ltext">Ask AIM</span>';

  var panel = el('div', 'aimc-panel');
  panel.id = 'aimc-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'AIM assistant');
  panel.hidden = true;
  panel.innerHTML =
    '<div class="aimc-head"><span class="aimc-av" aria-hidden="true">AIM</span>' +
    '<div class="aimc-title"><b>AIM assistant</b><small>Pre-written answers. The team handles the rest.</small></div>' +
    '<button type="button" class="aimc-x" aria-label="Close the assistant">&times;</button></div>' +
    '<div class="aimc-log" role="log" aria-live="polite" tabindex="0"></div>' +
    '<div class="aimc-opts" role="group" aria-label="Choose a question"></div>' +
    '<form class="aimc-form" hidden><input class="aimc-in" type="text" maxlength="400" autocomplete="off" placeholder="Type your question" aria-label="Type your question">' +
    '<button class="aimc-send" type="submit">Send</button>' +
    '<p class="aimc-note">AI answers can be wrong. Please do not type phone numbers or emails. The team confirms everything on your onboarding call.</p></form>';

  document.body.appendChild(launcher);
  document.body.appendChild(panel);
  if (HOME) document.documentElement.classList.add('aimc-home');

  var log = panel.querySelector('.aimc-log');
  var opts = panel.querySelector('.aimc-opts');
  var form = panel.querySelector('.aimc-form');
  var input = panel.querySelector('.aimc-in');
  var sendBtn = panel.querySelector('.aimc-send');
  var aiOn = false, aiChecked = false, history = [];
  var started = false, busy = false, timers = [];

  function later(fn, ms) { timers.push(setTimeout(fn, reduce ? 0 : ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function scrollLog() { log.scrollTop = log.scrollHeight; }

  function addBubble(text, who) {
    var b = el('div', 'aimc-msg aimc-' + who, text);
    log.appendChild(b);
    scrollLog();
    return b;
  }

  function showOptions(list) {
    opts.innerHTML = '';
    list.forEach(function (o) {
      var node;
      if (o.href) {
        node = el('a', 'aimc-btn' + (o.primary ? ' aimc-primary' : ''), o.label);
        node.href = o.href;
        if (o.external) { node.target = '_blank'; node.rel = 'noopener'; }
        node.addEventListener('click', function () {
          push({ event: 'chat_choice', chat_choice: o.apply ? 'apply' : o.label.slice(0, 40), page_path: location.pathname });
          if (o.href.charAt(0) === '#' && o.href.indexOf('#elementor-action') !== 0) {
            var t = document.querySelector(o.href);
            if (t) { t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
          }
          if (window.innerWidth <= 820) closePanel();
        });
      } else {
        node = el('button', 'aimc-btn', o.label);
        node.type = 'button';
        node.addEventListener('click', function () { choose(o); });
      }
      opts.appendChild(node);
    });
    scrollLog();
  }

  function say(lines, then) {
    busy = true;
    opts.innerHTML = '';
    var i = 0;
    (function next() {
      if (i >= lines.length) { busy = false; then(); return; }
      var typing = addBubble('…', 'bot');
      typing.classList.add('aimc-typing');
      var line = lines[i++];
      later(function () {
        typing.textContent = line;
        typing.classList.remove('aimc-typing');
        scrollLog();
        next();
      }, 380 + Math.min(line.length, 140) * 6);
    })();
  }

  function go(id) {
    var n = NODES[id];
    say(n.say, function () { showOptions(n.options); });
  }

  function choose(o) {
    if (busy) return;
    push({ event: 'chat_choice', chat_choice: o.to, page_path: location.pathname });
    addBubble(o.label, 'me');
    go(o.to);
  }

  function start() {
    started = true;
    log.innerHTML = '';
    say(greeting(), function () { showOptions(MENU); });
  }

    // ------------------------------------------------------------------ optional AI mode
  function timedFetch(url, init, ms) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
    var o = init || {};
    if (ctl) o.signal = ctl.signal;
    return fetch(url, o).then(function (r) { clearTimeout(timer); return r; }, function (e) { clearTimeout(timer); throw e; });
  }

  function aiOff() { aiOn = false; form.hidden = true; }

  function probeAi() {
    if (aiChecked) return;
    aiChecked = true;
    if (typeof fetch !== 'function') return;
    timedFetch('/api/chat', { method: 'GET', cache: 'no-store' }, 2500)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && d.enabled === true) { aiOn = true; form.hidden = false; } })
      .catch(function () { /* stay on the pre-written flow */ });
  }

  var AFTER_AI = [{ label: 'Apply now', href: APPLY_HREF, primary: true, apply: true }, TEAM, { label: 'Back to the menu', to: 'menu' }];

  function askAi(text) {
    if (busy || !aiOn) return;
    var q = text.replace(/\s+/g, ' ').trim().slice(0, 400);
    if (!q) return;
    input.value = '';
    addBubble(q, 'me');
    history.push({ role: 'user', content: q });
    push({ event: 'chat_choice', chat_choice: 'typed_question', page_path: location.pathname });
    busy = true; opts.innerHTML = ''; input.disabled = true; sendBtn.disabled = true;
    var typing = addBubble('\u2026', 'bot');
    typing.classList.add('aimc-typing');
    function done() { busy = false; input.disabled = false; sendBtn.disabled = false; }
    function fallBack() {
      typing.classList.remove('aimc-typing');
      typing.textContent = 'I cannot reach the assistant right now. Please pick a question below, or talk to the team.';
      aiOff(); done(); showOptions(MENU);
    }
    timedFetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: history.slice(-8) }) }, 12000)
      .then(function (r) { if (!r.ok) throw new Error('status'); return r.json(); })
      .then(function (d) {
        if (!d || typeof d.reply !== 'string' || !d.reply) throw new Error('empty');
        typing.classList.remove('aimc-typing');
        typing.textContent = d.reply;
        history.push({ role: 'assistant', content: d.reply });
        done(); scrollLog();
        showOptions(d.handoff ? [NODES.team.options[0], NODES.team.options[1], NODES.team.options[2], BACK] : AFTER_AI);
      })
      .catch(fallBack);
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); askAi(input.value); });

  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    launcher.hidden = true;
    panel.classList.remove('is-out');
    panel.classList.add('is-in');
    push({ event: 'chat_open', page_path: location.pathname });
    if (!started) start();
    probeAi();
    setTimeout(function () { var b = opts.querySelector('.aimc-btn'); (b || panel.querySelector('.aimc-x')).focus(); }, 60);
  }

  function closePanel() {
    clearTimers(); busy = false;
    panel.hidden = true;
    launcher.hidden = false;
    launcher.setAttribute('aria-expanded', 'false');
    if (started && !opts.children.length) { started = false; history = []; log.innerHTML = ''; } // closed mid-answer: restart next time
    launcher.focus({ preventScroll: true });
  }

  launcher.addEventListener('click', openPanel);
  panel.querySelector('.aimc-x').addEventListener('click', closePanel);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) closePanel(); });
})();
