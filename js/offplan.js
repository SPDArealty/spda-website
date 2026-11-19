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

  /* ---------------- List page ---------------- */
  var grid = document.getElementById('op-grid');
  if (grid) {
    var all = [], shown = 0, PAGE = 24, current = [];
    var f = {
      q: document.getElementById('op-q'), area: document.getElementById('op-area'), dev: document.getElementById('op-dev'),
      beds: document.getElementById('op-beds'), max: document.getElementById('op-max'), sort: document.getElementById('op-sort')
    };
    var count = document.getElementById('op-count'), more = document.getElementById('op-more');

    function card(p) {
      return '<a class="op-card" href="/off-plan/project/?id=' + encodeURIComponent(p.f) + '">' +
        '<figure>' + img(p.img, '') + '</figure>' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<p class="op-where">' + esc(p.dev) + ' · ' + esc(p.area) + '</p>' +
        '<p class="op-price"><strong>From ' + aed(p.price) + '</strong><span>' + usd(p.price) + '</span></p>' +
        '<p class="op-meta">' + (beds(p.beds) ? '<span>' + beds(p.beds) + '</span>' : '') +
        '<span>Handover ' + month(p.ho) + '</span>' + (p.plan ? '<span class="mono">' + p.plan.filter(Boolean).join('/') + '</span>' : '') + '</p></a>';
    }
    function apply() {
      var q = f.q.value.trim().toLowerCase(), a = f.area.value, d = f.dev.value, b = f.beds.value, m = +f.max.value || 0;
      current = all.filter(function (p) {
        if (q && (p.name + ' ' + p.dev + ' ' + p.area).toLowerCase().indexOf(q) < 0) return false;
        if (a && p.area !== a) return false;
        if (d && p.dev !== d) return false;
        if (m && p.price > m) return false;
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
      var uniq = function (k) { var o = {}; all.forEach(function (p) { if (p[k]) o[p[k]] = 1; }); return Object.keys(o).sort(); };
      options(f.area, uniq('area')); options(f.dev, uniq('dev'));
      var params = new URLSearchParams(location.search);
      ['q','area','dev','beds','max','sort'].forEach(function (k) { if (params.get(k)) f[k].value = params.get(k); });
      document.getElementById('op-synced').textContent = 'Data updated ' + new Date(data.synced).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      apply();
    }).catch(function () { count.textContent = 'The project list could not be loaded. Please try again later.'; });
    Object.keys(f).forEach(function (k) { f[k].addEventListener(k === 'q' ? 'input' : 'change', apply); });
    more.addEventListener('click', render);
  }

  /* ---------------- Project page ---------------- */
  var page = document.getElementById('op-project');
  if (page) {
    var id = new URLSearchParams(location.search).get('id') || '';
    if (!/^[A-Za-z0-9_-]+$/.test(id)) { page.innerHTML = '<p class="op-empty">Project not found. <a href="/off-plan/">See all projects</a>.</p>'; return; }
    fetch('/data/offplan/p/' + id + '.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (p) {
      document.title = p.name + ' by ' + p.dev + ' | Off-plan in ' + p.area + ' | SPDA Real Estate';
      var where = p.area + (p.sub && p.sub !== p.area ? ', ' + p.sub : '');
      var form = '/?project=' + encodeURIComponent(p.name + ' by ' + p.dev) + '#contact';
      var cta = document.getElementById('op-cta'); if (cta) cta.href = form;
      var wa = 'https://wa.me/971586392188?text=' + encodeURIComponent('Hello SPDA, I would like details on ' + p.name + ' by ' + p.dev + '.');
      var html = '<div class="op-head"><p class="eyebrow v"><a href="/off-plan/">Off-plan projects</a></p>' +
        '<h1>' + esc(p.name) + '</h1><p class="lead">' + esc(p.dev) + ' · ' + esc(where) + '</p>' +
        '<div class="actions"><a class="btn ink" href="' + form + '">Ask about this project</a><a class="btn" href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a></div></div>';
      if (p.img && p.img.length) html += '<div class="op-gallery">' + p.img.slice(0, 3).map(function (s, i) { return '<figure>' + img(s, i ? '' : p.name + ' by ' + p.dev, !i) + '</figure>'; }).join('') + '</div>';
      var size = p.size && p.size[0] ? full(p.size[0]) + (p.size[1] && p.size[1] !== p.size[0] ? ' to ' + full(p.size[1]) : '') + ' sq ft' : '–';
      html += '<dl class="op-facts">' +
        '<div><dt>Starting price</dt><dd>AED ' + full(p.price) + '<small>about USD ' + full(p.price / USD) + '</small></dd></div>' +
        '<div><dt>Handover</dt><dd>' + month(p.ho) + '</dd></div>' +
        '<div><dt>Homes</dt><dd>' + (beds(p.beds) || '–') + '<small>' + esc(types(p.types)) + '</small></dd></div>' +
        '<div><dt>Sizes</dt><dd>' + size + '</dd></div></dl>';
      if (p.plan) {
        var parts = p.plan.filter(function (x) { return x > 0; });
        html += '<section class="op-plan"><h2 class="eyebrow">Payment plan</h2><p>' + parts.map(function (x) { return x + '%'; }).join(', ') + ' in order of payment, a total of 100% of the price.</p>' +
          '<div class="op-bar" role="img" aria-label="Payment plan ' + parts.join(', ') + ' percent">' + parts.map(function (x) { return '<span style="flex:' + x + '">' + x + '%</span>'; }).join('') + '</div></section>';
      }
      // Group the developer's floor plans by home type: size range, lowest price, one plan image.
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
        html += '<section class="sec" style="padding-bottom:0"><div class="sec-head"><h2>Layouts and prices</h2><p><span>Starting figures per home type. They change with the floor and the view.</span></p></div>' +
          '<table class="op-table"><thead><tr><th>Home type</th><th>Size</th><th>From</th><th>Floor plan</th></tr></thead><tbody>' +
          order.map(function (k) {
            var g = groups[k], lo = Math.min.apply(null, g.sizes), hi = Math.max.apply(null, g.sizes), pr = Math.min.apply(null, g.prices);
            var size = g.sizes.length ? full(lo) + (hi > lo ? ' to ' + full(hi) : '') + ' sq ft' : '–';
            return '<tr><td>' + esc(k) + '</td><td>' + size + '</td><td>' +
              (g.prices.length ? 'AED ' + full(pr) + '<small>about USD ' + full(pr / USD) + '</small>' : 'On request') + '</td><td>' +
              (g.img ? '<a href="' + esc(g.img) + '" target="_blank" rel="noopener">View</a>' : '–') + '</td></tr>';
          }).join('') + '</tbody></table></section>';
      }
      if (p.amenities && p.amenities.length) html += '<section class="sec" style="padding-bottom:0"><div class="sec-head"><h2>Amenities</h2><p><span>As listed by the developer.</span></p></div><ul class="op-amen">' + p.amenities.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></section>';
      if (p.brochure) html += '<p style="margin-top:32px"><a class="btn" href="' + esc(p.brochure) + '" target="_blank" rel="noopener">Developer brochure (PDF)</a></p>';
      var upd = p.upd ? new Date(p.upd).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '';
      html += '<p class="cap src">Developer figures via BlackDrive' + (upd ? ', last changed ' + upd : '') + '. Prices and availability change. We confirm both with the developer before you reserve.</p>';
      page.innerHTML = html;
    }).catch(function () { page.innerHTML = '<p class="op-empty">Project not found. <a href="/off-plan/">See all projects</a>.</p>'; });
  }
})();
