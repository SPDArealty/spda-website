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


/* ---------- Media: custom video controls (play, seek, sound, full screen, Instagram link) ---------- */
(function () {
  var P = '<svg viewBox="0 0 24 24" aria-hidden="true">';
  var icons = {
    play: P + '<path class="v-i-play" d="M7 4.5v15l13-7.5z"/><path class="v-i-pause" d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    mute: P + '<path d="M3 9v6h4l5 4V5L7 9z"/><path class="v-i-vol" d="M15.5 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM18.4 5.6a9 9 0 0 1 0 12.8L17 17a7 7 0 0 0 0-10z"/><path class="v-i-mute" d="M15 9.4 16.4 8l2.1 2.1L20.6 8 22 9.4 19.9 11.5 22 13.6 20.6 15l-2.1-2.1L16.4 15 15 13.6l2.1-2.1z"/></svg>',
    share: P + '<path d="M18 16a3 3 0 0 0-2.4 1.2l-7-3.5a3 3 0 0 0 0-1.4l7-3.5A3 3 0 1 0 15 7a3 3 0 0 0 .1.7l-7 3.5a3 3 0 1 0 0 3.6l7 3.5A3 3 0 1 0 18 16z"/></svg>',
    full: P + '<path d="M4 4h6v2H6v4H4zM14 4h6v6h-2V6h-4zM4 14h2v4h4v2H4zM18 14h2v6h-6v-2h4z"/></svg>'
  };
  document.querySelectorAll('.vid-frame video').forEach(function (v) {
    var frame = v.parentNode, ig = v.getAttribute('data-ig');
    v.removeAttribute('controls');
    var bar = document.createElement('div');
    bar.className = 'vctl';
    bar.innerHTML =
      '<button type="button" class="v-play" aria-label="Play or pause">' + icons.play + '</button>' +
      '<input class="v-seek" type="range" min="0" max="1000" value="0" aria-label="Seek">' +
      '<span class="v-time" aria-label="Time">0:00 / 0:00</span>' +
      '<button type="button" class="v-mute" aria-label="Sound on or off">' + icons.mute + '</button>' +
      '<button type="button" class="v-full" aria-label="Full screen">' + icons.full + '</button>' +
      '<button type="button" class="v-share" aria-label="Share this video">' + icons.share + '</button>' +
      (ig ? '<a class="v-ig" href="' + ig + '" target="_blank" rel="noopener" aria-label="View this video on Instagram"><span class="ico ico-instagram" aria-hidden="true"></span></a>' : '');
    frame.appendChild(bar);
    var seek = bar.querySelector('.v-seek');
    function sync() { frame.classList.toggle('playing', !v.paused); frame.classList.toggle('muted', v.muted); }
    function toggle() { if (v.paused) { v.play(); } else { v.pause(); } }
    bar.querySelector('.v-play').addEventListener('click', toggle);
    v.addEventListener('click', toggle);
    bar.querySelector('.v-mute').addEventListener('click', function () { v.muted = !v.muted; sync(); });
    bar.querySelector('.v-full').addEventListener('click', function () {
      if (v.webkitEnterFullscreen && !frame.requestFullscreen) { v.webkitEnterFullscreen(); }
      else if (frame.requestFullscreen) { frame.requestFullscreen(); }
    });
    bar.querySelector('.v-share').addEventListener('click', function () {
      var art = frame.closest('.vid'), title = (art.querySelector('h4') || {}).textContent || 'SPDA Real Estate';
      var url = location.origin + location.pathname + '#' + art.id;
      function toast(msg) {
        var t = frame.querySelector('.v-toast');
        if (!t) { t = document.createElement('div'); t.className = 'v-toast'; t.setAttribute('role', 'status'); frame.appendChild(t); }
        t.textContent = msg; t.classList.add('on'); setTimeout(function () { t.classList.remove('on'); }, 1800);
      }
      if (navigator.share) {
        navigator.share({ title: title, text: title + ' | SPDA Real Estate', url: url }).catch(function () {});
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { toast('Link copied'); }, function () { toast(url); });
      } else { toast(url); }
    });
    var timeEl = bar.querySelector('.v-time');
    function fmt(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2); }
    function showTime() { timeEl.textContent = fmt(v.currentTime) + ' / ' + fmt(v.duration); }
    v.addEventListener('loadedmetadata', showTime);
    v.addEventListener('timeupdate', showTime);
    showTime();
    v.addEventListener('timeupdate', function () {
      var p = v.duration ? v.currentTime / v.duration * 100 : 0;
      seek.value = p * 10; seek.style.setProperty('--p', p + '%');
    });
    seek.addEventListener('input', function () { if (v.duration) v.currentTime = seek.value / 1000 * v.duration; });
    ['play', 'pause', 'volumechange', 'ended'].forEach(function (e) { v.addEventListener(e, sync); });
    v.addEventListener('play', function () {
      document.querySelectorAll('.vid-frame video').forEach(function (o) { if (o !== v) o.pause(); });
    });
    sync();
  });
})();
