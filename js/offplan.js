/* SPDA Real Estate: off-plan projects list and project page.
   Data: /data/offplan/list.json and /data/offplan/p/<id>.json, refreshed by
   tools/offplan-sync.mjs from the BlackDrive Live API. No API key in the browser. */
(function () {
  var USD = 3.6725; // AED per USD, fixed peg
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function short(n) {
    if (n >= 1e6) return (Math.round(n / 1e4) / 100).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (n >= 1e3) return Math.round(n / 1e3) + 'K';
    return String(Math.round(n));
  }
  function aed(n) { return 'AED ' + short(n); }
  function usd(n) { return 'USD ' + short(n / USD); }
  function full(n) { return Math.round(n).toLocaleString('en-US'); }
  function sqm(n) { return full(n * 0.092903); }
  function month(d) { if (!d) return '–'; var p = d.split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0]; }
  function beds(b) {
    if (!b || (b[0] == null && b[1] == null)) return '';
    var lo = b[0] === 0 ? 'Studio' : b[0], hi = b[1];
    if (b[0] == null) return hi + ' bed';
    if (hi == null || hi === b[0]) return lo + (b[0] === 0 ? '' : ' bed');
    return lo + ' to ' + hi + ' bed';
  }
  function types(t) { return (t || []).map(function (x) { return x.charAt(0) + x.slice(1).toLowerCase() + 's'; }).join(', '); }
  function img(src, alt, eager) {
    return src ? '<img class="op-photo" src="' + esc(src) + '" alt="' + esc(alt) + '"' + (eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' referrerpolicy="no-referrer">' : '';
  }

  var STAGE = { ACTIVE: 'Active', CONSTRUCTION: 'Under construction' };
  function stage(s) { return STAGE[s] ? '<span class="op-stage' + (s === 'ACTIVE' ? ' on' : '') + '">' + STAGE[s] + '</span>' : ''; }

  function card(p) {
    return '<a class="op-card" href="/off-plan/project/?id=' + encodeURIComponent(p.f) + '"><span class="op-in">' +
      '<figure>' + img(p.img, '') + stage(p.stage) + '</figure>' +
      '<h3>' + esc(p.name) + '</h3>' +
      '<p class="op-where">' + esc(p.dev) + ' · ' + esc(p.area) + '</p>' +
      '<p class="op-price"><strong>From ' + aed(p.price) + '</strong><span>' + usd(p.price) + '</span></p>' +
      '<p class="op-meta">' + (beds(p.beds) ? '<span>' + beds(p.beds) + '</span>' : '') +
      '<span>Handover ' + month(p.ho) + '</span>' + (p.plan ? '<span class="mono">' + p.plan.filter(Boolean).join('/') + '</span>' : '') + '</p></span></a>';
  }

  /* ---------------- List page ---------------- */
  var grid = document.getElementById('op-grid');
  if (grid) {
    var all = [], shown = 0, PAGE = 24, current = [];
    var f = {
      q: document.getElementById('op-q'), area: document.getElementById('op-area'), dev: document.getElementById('op-dev'),
      beds: document.getElementById('op-beds'), max: document.getElementById('op-max'), status: document.getElementById('op-status'), sort: document.getElementById('op-sort')
    };
    var count = document.getElementById('op-count'), more = document.getElementById('op-more');

    function apply() {
      var q = f.q.value.trim().toLowerCase(), a = f.area.value, d = f.dev.value, b = f.beds.value, st = f.status.value, rg = f.max.value.split('-'), lo$ = +rg[0] || 0, hi$ = +rg[1] || 0;
      document.getElementById('op-reset').hidden = !(q || a || d || b !== '' || f.max.value || st);
      current = all.filter(function (p) {
        if (q && (p.name + ' ' + p.dev + ' ' + p.area).toLowerCase().indexOf(q) < 0) return false;
        if (a && p.area !== a) return false;
        if (d && p.dev !== d) return false;
        if (st && p.stage !== st) return false;
        if (lo$ && p.price < lo$) return false;
        if (hi$ && p.price > hi$) return false;
        if (b !== '') { var n = +b; if (!p.beds) return false; var lo = p.beds[0] == null ? p.beds[1] : p.beds[0], hi = p.beds[1] == null ? lo : p.beds[1]; if (n === 5 ? hi < 5 : (n < lo || n > hi)) return false; }
        return true;
      });
      var s = f.sort.value;
      current.sort(function (x, y) {
        if (s === 'price_asc') return x.price - y.price;
        if (s === 'price_desc') return y.price - x.price;
        if (s === 'handover') return x.ho < y.ho ? -1 : x.ho > y.ho ? 1 : 0;
        return (y.upd || '') < (x.upd || '') ? -1 : (y.upd || '') > (x.upd || '') ? 1 : 0;
      });
      shown = 0; grid.innerHTML = ''; render();
      bud.sync();
    }
    /* Budget: dual-handle ruler. Steps are finer where most projects sit. */
    function budget() {
      var STEPS = [0, 5e5, 7.5e5, 1e6, 1.25e6, 1.5e6, 1.75e6, 2e6, 2.25e6, 2.5e6, 2.75e6, 3e6, 3.5e6, 4e6, 4.5e6, 5e6, 6e6, 7e6, 8e6, 9e6, 1e7, 1.25e7, 1.5e7, 1.75e7, 2e7, 2.5e7, 3e7, 4e7, 5e7, 7.5e7, 1e8];
      var TOP = STEPS.length - 1, MAJOR = { 0: '0', 3: '1M', 7: '2M', 11: '3M', 15: '5M', 20: '10M', 24: '20M', 28: '50M', 30: '100M+' };
      var $ = function (id) { return document.getElementById(id); };
      var btn = $('op-bud-btn'), panel = $('op-bud'), form = panel.parentNode, label = btn.closest('label');
      var rMin = $('op-bud-min'), rMax = $('op-bud-max'), fill = $('op-bud-fill'), histEl = $('op-bud-hist'), done = $('op-bud-done');
      var pct = function (i) { return (i / TOP * 100) + '%'; };
      var lab = function (i, cur) { return i === TOP ? cur + ' ' + short(STEPS[TOP] / (cur === 'USD' ? USD : 1)) + '+' : cur + ' ' + short(STEPS[i] / (cur === 'USD' ? USD : 1)); };
      var snap = function (v) { var b = 0; STEPS.forEach(function (x, i) { if (Math.abs(x - v) < Math.abs(STEPS[b] - v)) b = i; }); return b; };
      $('op-bud-ticks').innerHTML = STEPS.map(function (x, i) {
        return '<span class="' + (MAJOR[i] ? 'mj' + (i === 28 ? ' m50' : '') : '') + '" style="left:' + pct(i) + '">' + (MAJOR[i] ? '<b>' + MAJOR[i] + '</b>' : '') + '</span>';
      }).join('');
      histEl.innerHTML = STEPS.slice(0, TOP).map(function (x, i) { return '<i style="left:' + pct(i) + ';width:calc(' + (100 / TOP) + '% - 2px)"></i>'; }).join('');
      var bars = histEl.children;

      function show() {
        var lo = +rMin.value, hi = +rMax.value;
        fill.style.left = pct(lo); fill.style.right = ((TOP - hi) / TOP * 100) + '%';
        $('op-bud-lo').textContent = lab(lo, 'AED'); $('op-bud-lo-usd').textContent = lab(lo, 'USD');
        $('op-bud-hi').textContent = lab(hi, 'AED'); $('op-bud-hi-usd').textContent = lab(hi, 'USD');
        for (var i = 0; i < bars.length; i++) bars[i].classList.toggle('on', i >= lo && i < hi);
        btn.textContent = lo === 0 && hi === TOP ? 'Any budget' : lo === 0 ? 'Up to ' + lab(hi, 'AED') : hi === TOP ? 'From ' + lab(lo, 'AED') : lab(lo, 'AED') + ' to ' + short(STEPS[hi]);
        btn.classList.toggle('set', !(lo === 0 && hi === TOP));
      }
      function commit() {
        var lo = +rMin.value, hi = +rMax.value;
        f.max.value = lo === 0 && hi === TOP ? '' : (lo ? STEPS[lo] : '0') + '-' + (hi === TOP ? '' : STEPS[hi]);
        apply();
      }
      function move(e) {
        var lo = +rMin.value, hi = +rMax.value;
        if (lo >= hi) { if (e.target === rMin) rMin.value = hi - 1; else rMax.value = lo + 1; }
        rMin.style.zIndex = +rMin.value > TOP - 3 ? 3 : 1; // keep the lower handle reachable at the top end
        show(); commit();
      }
      rMin.addEventListener('input', move); rMax.addEventListener('input', move);

      function place() { // right edge under the Budget segment, never past the bar
        var w = form.offsetWidth, pw = w < 600 ? w : Math.min(w, 560), b = parseFloat(getComputedStyle(form).borderLeftWidth) || 0;
        var left = Math.max(-b, Math.min(label.offsetLeft + label.offsetWidth - pw, w - b - pw));
        panel.style.top = (label.offsetTop + label.offsetHeight) + 'px';
        panel.style.left = (w < 600 ? -b : left) + 'px'; panel.style.width = w < 600 ? 'calc(100% + ' + 2 * b + 'px)' : pw + 'px';
      }
      function open(state) {
        panel.hidden = !state; btn.setAttribute('aria-expanded', state); label.classList.toggle('open', state);
        if (state) { place(); rMax.focus({ preventScroll: true }); }
      }
      btn.addEventListener('click', function () { open(panel.hidden); });
      done.addEventListener('click', function () { open(false); btn.focus(); });
      $('op-bud-clear').addEventListener('click', function () { rMin.value = 0; rMax.value = TOP; show(); commit(); });
      document.addEventListener('pointerdown', function (e) { if (!panel.hidden && !panel.contains(e.target) && !label.contains(e.target)) open(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { open(false); btn.focus(); } });
      window.addEventListener('resize', function () { if (!panel.hidden) place(); });

      return {
        load: function () { // read "lo-hi" from the hidden field (also old bracket links)
          var rg = (f.max.value || '').split('-');
          rMin.value = rg[0] ? snap(+rg[0]) : 0;
          rMax.value = rg[1] ? Math.max(snap(+rg[1]), +rMin.value + 1) : TOP;
          show();
        },
        hist: function () {
          var n = STEPS.slice(0, TOP).map(function () { return 0; });
          all.forEach(function (p) { if (!p.price) return; for (var i = TOP - 1; i >= 0; i--) if (p.price >= STEPS[i]) { n[i]++; break; } });
          var m = Math.max.apply(null, n) || 1;
          n.forEach(function (c, i) { bars[i].style.height = (c ? Math.max(6, Math.sqrt(c / m) * 100) : 0) + '%'; bars[i].title = c + ' projects'; });
        },
        sync: function () { done.textContent = current.length ? 'Show ' + current.length + ' projects' : 'No projects in this range'; }
      };
    }
    function render() {
      var next = current.slice(shown, shown + PAGE);
      grid.insertAdjacentHTML('beforeend', next.map(card).join(''));
      shown += next.length;
      count.textContent = current.length ? 'Showing ' + shown + ' of ' + current.length + ' projects' : '';
      more.hidden = shown >= current.length;
      document.getElementById('op-empty').hidden = current.length > 0;
    }
    function options(sel, values) {
      sel.insertAdjacentHTML('beforeend', values.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join(''));
    }
    fetch('/data/offplan/list.json').then(function (r) { return r.json(); }).then(function (data) {
      all = data.projects;
      bud.hist();
      var uniq = function (k) { var o = {}; all.forEach(function (p) { if (p[k]) o[p[k]] = 1; }); return Object.keys(o).sort(); };
      options(f.area, uniq('area')); options(f.dev, uniq('dev'));
      var params = new URLSearchParams(location.search);
      ['q','area','dev','beds','max','status','sort'].forEach(function (k) { if (params.get(k)) f[k].value = params.get(k); });
      bud.load();
      document.getElementById('op-synced').textContent = 'Data updated ' + new Date(data.synced).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      apply();
    }).catch(function () { count.textContent = 'The project list could not be loaded. Please try again later.'; });
    var bud = budget();
    Object.keys(f).forEach(function (k) { f[k].addEventListener(k === 'q' ? 'input' : 'change', apply); });
    more.addEventListener('click', render);
    document.getElementById('op-reset').addEventListener('click', function () { f.q.value = f.area.value = f.dev.value = f.beds.value = f.max.value = f.status.value = ''; bud.load(); apply(); });
  }

  /* ---------------- Project page ---------------- */
  var page = document.getElementById('op-project');
  if (page) {
    var STAGES = ['on booking', 'during construction', 'on handover', 'after handover'];
    var id = new URLSearchParams(location.search).get('id') || '';
    var notFound = function () { page.innerHTML = '<p class="op-empty">Project not found. <a href="/off-plan/">See all projects</a>.</p>'; };
    if (!/^[A-Za-z0-9_-]+$/.test(id)) { notFound(); return; }
    Promise.all([
      fetch('/data/offplan/p/' + id + '.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }),
      fetch('/data/offplan/list.json').then(function (r) { return r.json(); }).catch(function () { return { projects: [] }; })
    ]).then(function (res) { build(res[0], res[1].projects || []); }).catch(notFound);
  }

  function build(p, list) {
    document.title = p.name + ' by ' + p.dev + ' | Off-plan in ' + p.area + ' | SPDA Real Estate';
    var label = p.name + ' by ' + p.dev;
    var where = (p.sub && p.sub !== p.area ? p.sub + ', ' : '') + p.area;
    var form = '/?project=' + encodeURIComponent(label) + '#contact';
    var wa = 'https://wa.me/971586392188?text=' + encodeURIComponent('Hello SPDA, I would like details on ' + label + '.');
    var cta = document.getElementById('op-cta'); if (cta) cta.href = form;
    var imgs = p.img || [];
    var sameDev = list.filter(function (x) { return x.dev === p.dev && x.id !== p.id; });
    var html = '';

    // Head
    html += '<div class="op-head"><p class="eyebrow v"><a href="/off-plan/">Off-plan projects</a></p>' +
      '<h1>' + esc(p.name) + '</h1><p class="lead">' + esc(p.dev) + ' · ' + esc(where) + '</p>' +
      '<div class="actions"><a class="btn ink" href="' + form + '">Ask about this project</a><a class="btn" href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a></div></div>';

    // Gallery: one large and two small photos, arrows step through all photos
    if (imgs.length) {
      html += '<div class="op-gallery" id="op-gallery">' + [0, 1, 2].map(function (i) {
        return '<figure' + (i >= imgs.length ? ' hidden' : '') + '><button type="button" class="op-zoom" data-slot="' + i + '" aria-label="Open photo larger">' +
          '<img class="op-photo" alt="' + (i ? '' : esc(label)) + '"' + (i ? ' loading="lazy"' : ' fetchpriority="high"') + ' referrerpolicy="no-referrer"></button></figure>';
      }).join('') +
      (imgs.length > 1 ? '<button type="button" class="op-arrow prev" aria-label="Previous photo">&#8592;</button><button type="button" class="op-arrow next" aria-label="Next photo">&#8594;</button>' : '') +
      '<span class="op-counter mono" aria-live="polite"></span></div>';
    }

    // Two columns: content and the side card that follows the scroll
    html += '<div class="op-layout"><div class="op-main">';

    var rng = p.size && p.size[1] && p.size[1] !== p.size[0];
    var size = p.size && p.size[0] ? full(p.size[0]) + (rng ? ' to ' + full(p.size[1]) : '') + ' sq ft<small>' + sqm(p.size[0]) + (rng ? ' to ' + sqm(p.size[1]) : '') + ' sqm</small>' : '–';
    html += '<dl class="op-facts">' +
      '<div class="op-fact-price"><dt>Starting price</dt><dd>AED ' + full(p.price) + '<small>about USD ' + full(p.price / USD) + '</small></dd></div>' +
      '<div><dt>Handover</dt><dd>' + month(p.ho) + '</dd></div>' +
      '<div><dt>Homes</dt><dd>' + (beds(p.beds) || '–') + '<small>' + esc(types(p.types)) + '</small></dd></div>' +
      '<div><dt>Sizes</dt><dd>' + size + '</dd></div></dl>';

    // Payment plan with a label on each share
    if (p.plan) {
      var parts = p.plan.map(function (x, i) { return { pct: x, stage: STAGES[i] }; }).filter(function (x) { return x.pct > 0; });
      html += '<section class="op-plan" aria-labelledby="pp-h"><h2 class="eyebrow" id="pp-h">Payment plan</h2>' +
        '<div class="op-bar">' + parts.map(function (x) {
          return '<div style="flex:' + x.pct + '"><span>' + x.pct + '%</span><small>' + x.stage.charAt(0).toUpperCase() + x.stage.slice(1) + '</small></div>';
        }).join('') + '</div>' +
        '<p class="op-note">Developers sometimes change the plan during offers. We confirm the current plan with you.</p></section>';
    }

    // Why this project: a factual summary built from the project data
    var why = [];
    why.push('<strong>Location.</strong> ' + esc(where) + ', Dubai.');
    if (beds(p.beds) || p.types.length) why.push('<strong>Homes.</strong> ' + (beds(p.beds) ? beds(p.beds) + ' ' : '') + esc(types(p.types).toLowerCase() || 'homes') + (p.size && p.size[0] ? ', from ' + full(p.size[0]) + ' sq ft (' + sqm(p.size[0]) + ' sqm)' : '') + '.');
    why.push('<strong>Entry price.</strong> From AED ' + full(p.price) + ', about USD ' + full(p.price / USD) + '.');
    if (p.plan) {
      var before = p.plan[0] + p.plan[1], after = p.plan[2] + p.plan[3];
      why.push('<strong>Cash flow.</strong> ' + before + '% is paid before handover' + (after ? ' and ' + after + '% on or after handover.' : '.'));
    }
    if (p.ho) {
      var yrs = (new Date(p.ho) - new Date()) / 3.156e10;
      var ry = Math.max(1, Math.round(yrs));
      why.push('<strong>Timeline.</strong> Handover ' + month(p.ho) + (yrs >= 0.75 ? ', about ' + ry + ' year' + (ry > 1 ? 's' : '') + ' from now.' : ', within a year.'));
    }
    if (sameDev.length) why.push('<strong>Developer.</strong> ' + esc(p.dev) + ' has ' + (sameDev.length + 1) + ' projects on sale in Dubai on our list.');
    html += '<section class="op-sec" aria-labelledby="why-h"><div class="sec-head"><h2 id="why-h">Why this project</h2></div><ul class="op-why">' +
      why.map(function (w) { return '<li>' + w + '</li>'; }).join('') + '</ul></section>';

    // Layouts and prices grouped by home type
    var groups = {}, order = [];
    (p.units || []).forEach(function (u) {
      var k = u.type || u.layout || 'Other';
      if (!groups[k]) { groups[k] = { beds: u.beds, sizes: [], prices: [], img: null }; order.push(k); }
      var g = groups[k];
      if (u.sqft) g.sizes.push(u.sqft);
      if (u.price) g.prices.push(u.price);
      if (!g.img && u.img) g.img = u.img;
    });
    order.sort(function (a, b) { return (groups[a].beds == null ? 99 : groups[a].beds) - (groups[b].beds == null ? 99 : groups[b].beds); });
    if (order.length) {
      html += '<section class="op-sec" id="layouts" aria-labelledby="lp-h"><div class="sec-head"><h2 id="lp-h">Layouts and prices</h2></div>' +
        '<table class="op-table"><thead><tr><th>Home type</th><th>Size</th><th>From</th><th>Floor plan</th></tr></thead><tbody>' +
        order.map(function (k) {
          var g = groups[k], lo = Math.min.apply(null, g.sizes), hi = Math.max.apply(null, g.sizes), pr = Math.min.apply(null, g.prices);
          var sz = g.sizes.length ? full(lo) + (hi > lo ? ' to ' + full(hi) : '') + ' sq ft<small>' + sqm(lo) + (hi > lo ? ' to ' + sqm(hi) : '') + ' sqm</small>' : '–';
          return '<tr><td>' + esc(k) + '</td><td>' + sz + '</td><td>' +
            (g.prices.length ? 'AED ' + full(pr) + '<small>about USD ' + full(pr / USD) + '</small>' : 'On request') + '</td><td>' +
            (g.img ? '<a href="' + esc(g.img) + '" target="_blank" rel="noopener">View</a>' : '–') + '</td></tr>';
        }).join('') + '</tbody></table></section>';
    }

    if (p.amenities && p.amenities.length) html += '<section class="op-sec" aria-labelledby="am-h"><div class="sec-head"><h2 id="am-h">Amenities</h2></div><ul class="op-amen">' + p.amenities.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></section>';

    if (p.lat && p.lng) html += '<section class="op-sec" id="location" aria-labelledby="loc-h"><div class="sec-head"><h2 id="loc-h">Location</h2></div><div class="op-map" id="op-map" role="region" aria-label="Map of ' + esc(where) + '"></div></section>';

    var upd = p.upd ? new Date(p.upd).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '';
    html += '<p class="cap op-source">Developer figures via BlackDrive' + (upd ? ', updated ' + upd : '') + '. We confirm price and availability before you reserve.</p>';
    html += '</div>';

    // Side card
    html += '<aside class="op-side" aria-label="Enquire about ' + esc(p.name) + '"><div class="op-card-side">' +
      '<p class="eyebrow">Starting price</p><p class="op-side-price">AED ' + full(p.price) + '</p><p class="op-side-usd">about USD ' + full(p.price / USD) + '</p>' +
      '<a class="btn ink" href="' + form + '">Ask about this project</a>' +
      (p.brochure ? '<button type="button" class="btn op-brochure-btn">Download brochure</button>' : '') +
      '<p class="op-side-ho">Handover ' + month(p.ho) + '</p>' +
      '<nav class="op-side-links">' + (order.length ? '<a href="#layouts">Floor plans<small>Layouts, sizes and prices</small></a>' : '') +
      (p.lat ? '<a href="#location">Location<small>Map of ' + esc(p.area) + '</small></a>' : '') + '</nav>' +
      '<p class="op-side-dev"><span class="eyebrow">Developer</span>' + esc(p.dev) + '</p></div></aside>';
    html += '</div>';

    // Phone: a bar fixed to the bottom of the screen
    html += '<div class="op-mbar"><span><small>From</small>AED ' + short(p.price) + '</span><a class="btn ink btn-sm" href="' + form + '">Ask about this project</a></div>';

    // More from this developer
    if (sameDev.length) {
      var three = sameDev.slice(0, 3);
      html += '<section class="op-sec" aria-labelledby="more-h"><div class="sec-head"><h2 id="more-h">More from ' + esc(p.dev) + '</h2></div><div class="op-grid">' +
        three.map(card).join('') + '</div></section>';
    }

    // Brochure form
    if (p.brochure) {
      html += '<dialog class="op-dialog" id="op-brochure" aria-labelledby="br-h"><form method="dialog" class="op-dialog-x"><button aria-label="Close">&#10005;</button></form>' +
        '<div class="op-br-body"><p class="eyebrow v">Brochure</p><h2 id="br-h">' + esc(p.name) + '</h2><p>Leave your details and the developer brochure opens straight away. One of us may follow up.</p>' +
        '<form class="op-br-form" novalidate>' +
        '<label>Full name<input name="Name" autocomplete="name" required></label>' +
        '<label>Email<input name="email" type="email" autocomplete="email" required></label>' +
        '<label>Phone<input name="Phone" type="tel" autocomplete="tel" placeholder="+971 50 000 0000" required></label>' +
        '<input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<p class="op-br-msg" aria-live="polite"></p><button class="btn ink" type="submit">Download brochure</button></form></div></dialog>';
    }

    // Large photo view
    if (imgs.length) html += '<dialog class="op-light" id="op-light" aria-label="Photos of ' + esc(p.name) + '"><img alt="" referrerpolicy="no-referrer"><button type="button" class="op-arrow prev" aria-label="Previous photo">&#8592;</button><button type="button" class="op-arrow next" aria-label="Next photo">&#8594;</button><form method="dialog" class="op-dialog-x"><button aria-label="Close">&#10005;</button></form><span class="op-counter mono"></span></dialog>';

    page.innerHTML = html;
    initGallery(imgs);
    initBrochure(p, label);
    if (p.lat && p.lng) initMap(p.lat, p.lng, p.name);
  }

  function initGallery(imgs) {
    var g = document.getElementById('op-gallery'); if (!g) return;
    var start = 0, n = imgs.length;
    var slots = g.querySelectorAll('img'), counter = g.querySelector('.op-counter');
    function show() {
      for (var i = 0; i < 3; i++) if (i < n) slots[i].src = imgs[(start + i) % n];
      counter.textContent = n > 1 ? ((start % n) + 1) + ' / ' + n : '';
    }
    function step(d) { start = (start + d + n) % n; show(); }
    var prev = g.querySelector('.prev'), next = g.querySelector('.next');
    if (prev) { prev.onclick = function () { step(-1); }; next.onclick = function () { step(1); }; }
    show();
    // Large view
    var box = document.getElementById('op-light'), big = box.querySelector('img'), cur = 0, bc = box.querySelector('.op-counter');
    function open(i) { cur = (i + n) % n; big.src = imgs[cur]; bc.textContent = (cur + 1) + ' / ' + n; }
    g.addEventListener('click', function (e) {
      var b = e.target.closest('.op-zoom'); if (!b) return;
      open(start + (+b.dataset.slot)); box.showModal();
    });
    box.querySelector('.prev').onclick = function () { open(cur - 1); };
    box.querySelector('.next').onclick = function () { open(cur + 1); };
    if (n < 2) { box.querySelector('.prev').hidden = box.querySelector('.next').hidden = true; }
    box.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') open(cur - 1); if (e.key === 'ArrowRight') open(cur + 1); });
    box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
  }

  function initBrochure(p, label) {
    var dlg = document.getElementById('op-brochure'); if (!dlg) return;
    document.querySelectorAll('.op-brochure-btn').forEach(function (b) { b.addEventListener('click', function () { dlg.showModal(); }); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    var f = dlg.querySelector('.op-br-form'), msg = f.querySelector('.op-br-msg');
    var LIVE = /(^|\.)spdarealty\.com$/.test(location.hostname);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = f.Name.value.trim(), email = f.email.value.trim(), phone = f.Phone.value.trim();
      if (!name) { msg.textContent = 'Please enter your name.'; f.Name.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Please enter a valid email address.'; f.email.focus(); return; }
      if (phone.replace(/[^\d]/g, '').length < 7) { msg.textContent = 'Please enter a phone number with country code.'; f.Phone.focus(); return; }
      if (f._honey.value) return;
      function done(preview) {
        dlg.querySelector('.op-br-body').innerHTML = '<p class="eyebrow v">Thank you</p><h2>' + esc(name.split(' ')[0]) + ', your brochure is ready.</h2>' +
          '<p><a class="btn ink" href="' + esc(p.brochure) + '" target="_blank" rel="noopener">Open the brochure (PDF)</a></p>' +
          (preview ? '<p class="cap">Preview only: nothing was sent.</p>' : '');
      }
      if (!LIVE) { done(true); return; }
      msg.textContent = 'Sending';
      fetch('https://formsubmit.co/ajax/info@spdarealty.com', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ _subject: 'Brochure request: ' + label, _template: 'table', Project: label, Page: location.href, Name: name, email: email, Phone: phone })
      }).then(function (r) { if (!r.ok) throw 0; done(false); })
        .catch(function () { msg.textContent = 'This did not send. Please try again, or call +971 58 639 2188.'; });
    });
  }

  function initMap(lat, lng, name) {
    var el = document.getElementById('op-map'); if (!el) return;
    var f = document.createElement('iframe');
    f.src = 'https://maps.google.com/maps?q=' + lat + ',' + lng + '&z=14&hl=en&output=embed';
    f.title = 'Map: ' + name; f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
    el.appendChild(f);
  }
})();
