/* Free guide forms: validate, post to the form endpoint, then hand over the download. */
(function () {
  'use strict';
  document.querySelectorAll('form.aim-magnet-form').forEach(function (form) {
    var msg = form.querySelector('.aimp-msg');
    var btn = form.querySelector('button');
    function say(t, ok) { msg.hidden = false; msg.className = 'aimp-msg' + (ok ? ' ok' : ''); if (typeof t === 'string') msg.textContent = t; }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = function (n) { return form.querySelector('[name="form_fields[' + n + ']"]').value.trim(); };
      var phone = f('phone').replace(/\D/g, '');
      if (phone.length === 12 && phone.indexOf('91') === 0) phone = phone.slice(2);
      if (f('name').length < 2) return say('Please enter your name.');
      if (!/^[6-9]\d{9}$/.test(phone)) return say('Please enter a valid 10-digit mobile number.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f('email'))) return say('Please enter a valid email address.');
      btn.disabled = true; msg.hidden = true;
      var body = new URLSearchParams(new FormData(form));
      body.set('action', 'elementor_pro_forms_send_form'); body.set('referer', location.href);
      fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })
        .then(function (r) { return r.json().then(function (j) { return r.ok && j.success; }); })
        .then(function (ok) {
          if (!ok) throw new Error('x');
          var url = form.getAttribute('data-file');
          form.reset();
          msg.hidden = false; msg.className = 'aimp-msg ok';
          msg.innerHTML = 'Thank you. <a href="' + url + '" download target="_blank" rel="noopener">Download your guide</a>';
          window.open(url, '_blank', 'noopener');
        })
        .catch(function () { say('Something went wrong. Please try again in a moment.'); })
        .then(function () { btn.disabled = false; });
    });
  });
})();
