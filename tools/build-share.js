// Builds one share page + one 1200x630 link-card image per video in media/index.html.
// Run from the repo root: NODE_PATH=$(npm root -g) node tools/build-share.js <fonts-dir>
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const fonts = process.argv[2];
const html = fs.readFileSync('media/index.html', 'utf8');
const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const cards = [...html.matchAll(/<article class="vid" id="v-([a-z0-9-]+)">[\s\S]*?poster="([^"]+)"[\s\S]*?<p class="eyebrow">(.*?)<\/p><h4>(.*?)<\/h4>\s*<p class="vid-price">(.*?) <span>(.*?)<\/span>/g)]
  .map(m => ({ slug: m[1], poster: m[2], eyebrow: m[3].replace(/&amp;/g, '&'), title: m[4].replace(/&amp;/g, '&'), aed: m[5], usd: m[6] }));
const wm = fs.readFileSync('images/spda-wordmark-bone.svg', 'utf8');
const b64 = f => fs.readFileSync(f).toString('base64');
const font = `@font-face{font-family:N;font-weight:700;src:url(data:font/otf;base64,${b64(fonts + '/NimbusSanL-Bol.otf')})}@font-face{font-family:N;font-weight:400;src:url(data:font/otf;base64,${b64(fonts + '/NimbusSanL-Reg.otf')})}`;
const base = `${font}*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;background:#131313;color:#F2EDE7;font-family:N,sans-serif;position:relative;overflow:hidden}`;
(async () => {
  const br = await chromium.launch(); const pg = await br.newPage({ viewport: { width: 1200, height: 630 } });
  for (const c of cards) {
    const img = 'data:image/jpeg;base64,' + b64(c.poster.replace(/^\//, ''));
    await pg.setContent(`<style>${base}
.l{position:absolute;left:72px;top:64px;width:640px}.mk{width:150px}.mk svg{width:100%;height:auto;display:block}
.e{position:absolute;left:72px;top:230px;width:640px;font-size:20px;letter-spacing:.14em;text-transform:uppercase;color:#C9B8A3}
.t{position:absolute;left:72px;top:276px;width:640px;font-size:56px;line-height:1.08;font-weight:700}
.p{position:absolute;left:72px;bottom:64px;font-size:32px;font-weight:700}.p span{font-weight:400;color:#C9B8A3;margin-left:14px;font-size:26px}
.bar{position:absolute;left:72px;bottom:130px;width:56px;height:4px;background:#D94F2B}
.f{position:absolute;right:0;top:0;width:354px;height:630px;background:url(${img}) center/cover}
</style><div class="l"><div class="mk">${wm}</div></div><div class="e">${c.eyebrow.replace(/ · /g, '  /  ')}</div><div class="t">${c.title}</div><div class="bar"></div><div class="p">${c.aed}<span>${c.usd}</span></div><div class="f"></div>`);
    fs.mkdirSync(`media/${c.slug}`, { recursive: true });
    await pg.screenshot({ path: `media/${c.slug}/share.jpg`, type: 'jpeg', quality: 88 });
    const url = `https://spdarealty.com/media/${c.slug}/`;
    const desc = `${c.eyebrow.replace(/&amp;/g, '&')}. ${c.aed.replace(/&amp;/g, '&')} (${c.usd}). A film by SPDA Real Estate, Dubai.`;
    const ttl = `${c.title} | SPDA Real Estate`;
    fs.writeFileSync(`media/${c.slug}/index.html`, `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ttl)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="https://spdarealty.com/media/#v-${c.slug}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="video.other">
<meta property="og:site_name" content="SPDA Real Estate">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(ttl)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${url}share.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(c.title)}, a film by SPDA Real Estate">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#131313">
<meta http-equiv="refresh" content="0; url=/media/#v-${c.slug}">
<script>location.replace('/media/#v-${c.slug}');</script>
</head>
<body style="background:#131313;color:#F2EDE7;font-family:sans-serif;padding:24px">
<p><a style="color:#F2EDE7" href="/media/#v-${c.slug}">${esc(c.title)}: open the film</a></p>
<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "e35a08c1fe7442f98a70d6d2c591d5ac"}'></script><!-- End Cloudflare Web Analytics -->
</body>
</html>
`);
    console.log(c.slug);
  }
  // site-wide card: SPDA letters only
  await pg.setContent(`<style>${base}.c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}.mk{width:520px}.mk svg{width:100%;height:auto;display:block}.bar{display:none}.u{position:absolute;bottom:48px;width:100%;text-align:center;font-size:20px;letter-spacing:.2em;color:#C9B8A3}</style><div class="c"><div class="mk">${wm}</div><div class="bar"></div></div><div class="u">SPDAREALTY.COM</div>`);
  await pg.screenshot({ path: 'og-image.jpg', type: 'jpeg', quality: 90 });
  await br.close();
})();
