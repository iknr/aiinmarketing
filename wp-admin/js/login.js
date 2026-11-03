/*! wp-admin login screen behaviour.
 *
 * This is a placeholder login. No credentials are ever sent anywhere:
 * every attempt ends in the standard "incorrect" error and the password field is cleared.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var loginForm = $('loginform');
  var lostForm = $('lostpasswordform');
  var error = $('login_error');
  var message = $('login_message');
  var navLost = $('nav-lost');
  var navLogin = $('nav-login');

  // wordpress_test_cookie is set by the real wp-login.php; kept for parity
  try { document.cookie = 'wordpress_test_cookie=WP%20Cookie%20check; path=/; SameSite=Lax'; } catch (e) { /* ignore */ }

  function show(el, html) {
    el.innerHTML = html || '';
    el.hidden = !html;
  }

  function setView(action) {
    var lost = action === 'lostpassword';
    loginForm.hidden = lost;
    lostForm.hidden = !lost;
    navLost.hidden = lost;
    navLogin.hidden = !lost;
    show(error, '');
    show(message, lost ? 'Please enter your username or email address. You will receive an email message with instructions on how to reset your password.' : '');
    document.body.className = document.body.className.replace(/login-action-\w+/, 'login-action-' + (lost ? 'lostpassword' : 'login'));
    document.title = (lost ? 'Lost Password' : 'Log In') + ' ‹ AIM — WordPress';
    (lost ? $('lost_user_login') : $('user_login')).focus();
  }

  function currentAction() {
    return new URLSearchParams(location.search).get('action') === 'lostpassword' ? 'lostpassword' : 'login';
  }

  function go(e, action) {
    e.preventDefault();
    history.pushState({}, '', action === 'lostpassword' ? '/wp-login.php?action=lostpassword' : '/wp-login.php');
    setView(action);
  }

  navLost.addEventListener('click', function (e) { go(e, 'lostpassword'); });
  navLogin.addEventListener('click', function (e) { go(e, 'login'); });
  window.addEventListener('popstate', function () { setView(currentAction()); });

  /* show / hide password */
  var eye = document.querySelector('.wp-hide-pw');
  eye.addEventListener('click', function () {
    var input = $('user_pass');
    var visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    eye.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
    input.focus();
  });

  /* login attempt */
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var user = $('user_login');
    var pass = $('user_pass');
    var submit = $('wp-submit');

    if (!user.value.trim()) {
      show(error, '<strong>Error:</strong> The username field is empty.');
      return user.focus();
    }
    if (!pass.value) {
      show(error, '<strong>Error:</strong> The password field is empty.');
      return pass.focus();
    }

    submit.disabled = true;
    setTimeout(function () {
      show(error, '<strong>Error:</strong> The username or password you entered is incorrect. <a href="/wp-login.php?action=lostpassword">Lost your password?</a>');
      error.querySelector('a').addEventListener('click', function (ev) { go(ev, 'lostpassword'); });
      pass.value = '';
      pass.type = 'password';
      submit.disabled = false;
      pass.focus();
    }, 700);
  });

  /* lost password */
  lostForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!$('lost_user_login').value.trim()) {
      show(error, '<strong>Error:</strong> Please enter a username or email address.');
      return;
    }
    show(error, '');
    show(message, 'Check your email for the confirmation link, then visit the <a href="/wp-login.php">login page</a>.');
    lostForm.hidden = true;
    message.querySelector('a').addEventListener('click', function (ev) { go(ev, 'login'); });
  });

  setView(currentAction());
})();
