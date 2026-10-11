/* SPDA Real Estate — site behaviour: mobile menu and enquiry form. */
(function () {
  /* ---------- Mobile menu ---------- */
  var header = document.querySelector('.top');
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('site-nav');
  if (header && btn && nav) {
    var label = btn.querySelector('.menu-label');
    function setOpen(open) {
      header.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (label) label.textContent = open ? 'Close' : 'Menu';
    }
    btn.addEventListener('click', function () { setOpen(!header.classList.contains('open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  /* ---------- Enquiry form ---------- */
  var ENDPOINT = 'https://formsubmit.co/ajax/info@spdarealty.com';
  var LIVE = /(^|\.)spdarealty\.com$/.test(location.hostname);
  var form = document.getElementById('enquiry-form');
  if (!form) return;
  var status = form.querySelector('.f-status');
  var submit = form.querySelector('button[type=submit]');

  var checks = {
    'f-first': function (v) { return v ? '' : 'Please enter your first name.'; },
    'f-last': function (v) { return v ? '' : 'Please enter your family name.'; },
    'f-phone': function (v) { return v.replace(/[^\d]/g, '').length >= 7 ? '' : 'Please enter a phone number with country code.'; },
    'f-email': function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Please enter a valid email address.'; },
    'f-msg': function (v) { return v.length >= 5 ? '' : 'Please tell us briefly what you are looking for.'; }
  };
  function check(id) {
    var el = document.getElementById(id), m = checks[id](el.value.trim());
    el.closest('.fld').classList.toggle('bad', !!m);
    el.setAttribute('aria-invalid', m ? 'true' : 'false');
    document.getElementById(id + '-msg').textContent = m;
    return !m;
  }
  Object.keys(checks).forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener('blur', function () { if (el.value.trim()) check(id); });
    el.addEventListener('input', function () { if (el.closest('.fld').classList.contains('bad')) check(id); });
  });

  function done(first, preview) {
    form.innerHTML = '<div class="f-done"><p class="eyebrow v">Enquiry sent</p><h3>Thank you, ' +
      first.replace(/[<>&"]/g, '') + '.</h3><p>A founder will reply to you directly by email or phone.' +
      (preview ? ' <em>(Preview only: nothing was sent.)</em>' : '') + '</p></div>';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = true, firstBad = null;
    Object.keys(checks).forEach(function (id) { if (!check(id)) { ok = false; firstBad = firstBad || id; } });
    if (!ok) { document.getElementById(firstBad).focus(); status.textContent = ''; return; }
    if (form.querySelector('.hp').value) return; /* spam bot */
    var data = {};
    Array.prototype.forEach.call(form.elements, function (el) { if (el.name && el.name !== '_honey') data[el.name] = el.value.trim(); });
    var first = data['First name'];
    if (!LIVE) { done(first, true); return; }
    submit.disabled = true; status.textContent = 'Sending…';
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.success === 'false' || j.success === false) throw new Error(); }); })
      .then(function () { done(first, false); })
      .catch(function () {
        submit.disabled = false;
        status.textContent = 'Your enquiry did not send. Please try again, or email info@spdarealty.com.';
      });
  });
})();
