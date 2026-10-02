// Run: node tests/core.test.mjs   (needs `npm i playwright`; uses system Chromium if PW_CHROMIUM is set)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const core = fileURLToPath(new URL('../core.js', import.meta.url));

const canvas = wide => `<body data-kirki="body">
<section data-kirki="s0" data-kirki_name="section">
  <p data-kirki="eyebrow" data-kirki_name="paragraph" style="font-size:14px">Trusted by 200+ brands</p>
  <h3 data-kirki="heroD" data-kirki_name="heading" style="font-size:72px" class="d">Scale Growth</h3>
  <h2 data-kirki="heroM" data-kirki_name="heading" style="font-size:40px" class="m">Scale Growth</h2>
  <p data-kirki="lead" data-kirki_name="paragraph" style="font-size:16px">We create bold campaigns</p>
  <div data-kirki="btn" data-kirki_name="button"><span data-kirki="btnT" data-kirki_name="text" style="font-size:16px">Get Started</span></div>
</section>
<section data-kirki="s1" data-kirki_name="section">
  <h2 data-kirki="what" data-kirki_name="heading" style="font-size:48px">What We Do</h2>
  <a href="#"><p data-kirki="card" data-kirki_name="paragraph" style="font-size:24px">Digital Strategy</p><p data-kirki="cardB" data-kirki_name="paragraph" style="font-size:16px">Crafting data-driven plans that drive growth</p></a>
  <a href="#"><p data-kirki="card" data-kirki_name="paragraph" style="font-size:24px">Social Media</p><p data-kirki="cardB" data-kirki_name="paragraph" style="font-size:16px">Building strong audience connections</p></a>
  <p data-kirki="stat" data-kirki_name="heading" style="font-size:40px">+65 %</p>
</section>
<section data-kirki="perks" data-kirki_name="section">
  <div><p data-kirki="n1" data-kirki_name="heading" style="font-size:40px">01</p><p data-kirki="k1" data-kirki_name="heading" style="font-size:22px">Stand out from the crowd</p><p data-kirki="kb1" data-kirki_name="paragraph" style="font-size:14px">Visibility is vital.</p></div>
  <div><p data-kirki="n2" data-kirki_name="heading" style="font-size:40px">02</p><p data-kirki="k2" data-kirki_name="heading" style="font-size:22px">Increase high conversion rate</p><p data-kirki="kb2" data-kirki_name="paragraph" style="font-size:14px">We find ways.</p></div>
</section>
<section data-kirki="brands" data-kirki_name="section">
  <p data-kirki="lbl" data-kirki_name="paragraph" style="font-size:13px">Brands We've Grown</p>
  <h4 data-kirki="exp" data-kirki_name="heading" style="font-size:18px">Experts in Your Industry</h4>
  <p data-kirki="expB" data-kirki_name="paragraph" style="font-size:12px">Stay informed.</p>
  <p data-kirki="exp2" data-kirki_name="heading" class="k-li k-title" style="font-size:20px">Long-Term Strategy Experts</p>
  <p data-kirki="exp3" data-kirki_name="heading" class="k-title k-li" style="font-size:20px">Channel Experts</p>
  <a href="#"><h4 data-kirki="exp4" data-kirki_name="heading" class="k-li k-title" style="font-size:20px">Growth Experts</h4></a>
</section>
<section data-kirki="wwd" data-kirki_name="section">
  <div data-kirki="wTop" data-kirki_name="div"><h2 data-kirki="wT" data-kirki_name="heading" style="font-size:44px">What We Do Here</h2><p data-kirki="wP" data-kirki_name="paragraph" style="font-size:14px">We help ambitious brands.</p></div>
  <div data-kirki="wBot" data-kirki_name="div"><div data-kirki="gc1" data-kirki_name="div" class="k-card k-first"><div data-kirki="gi1" data-kirki_name="image">img</div><div data-kirki="gt1" data-kirki_name="div"><h3 data-kirki="gh1" data-kirki_name="heading" class="k-h1" style="font-size:22px">Digital Strategy</h3><p data-kirki="gp1" data-kirki_name="paragraph" style="font-size:14px">Crafting plans.</p></div></div><div data-kirki="gc2" data-kirki_name="div" class="k-card"><div data-kirki="gi2" data-kirki_name="image">img</div><div data-kirki="gt2" data-kirki_name="div"><h3 data-kirki="gh2" data-kirki_name="heading" class="k-h2" style="font-size:22px">Social Media Marketing</h3><p data-kirki="gp2" data-kirki_name="paragraph" style="font-size:14px">Building connections.</p></div></div><div data-kirki="gc3" data-kirki_name="div" class="k-card k-x"><div data-kirki="gi3" data-kirki_name="image">img</div><div data-kirki="gt3" data-kirki_name="div"><h3 data-kirki="gh3" data-kirki_name="heading" class="k-h3" style="font-size:22px">Paid Advertising</h3><p data-kirki="gp3" data-kirki_name="paragraph" style="font-size:14px">High-impact ads.</p></div></div></div>
</section>
<section data-kirki="svc" data-kirki_name="section">
  <h2 data-kirki="svcT" data-kirki_name="heading" style="font-size:40px">How We Drive Revenue</h2>
  <div data-kirki="col" data-kirki_name="collection"><div data-kirki="items" data-kirki_name="items">
    <div class="kirki-collection-item" data-kirki="it" data-kirki_name="item"><h3 data-kirki="cmsT" data-kirki_name="heading" style="font-size:24px">SEO Optimisation</h3><p data-kirki="cmsB" data-kirki_name="paragraph" style="font-size:14px">We help your brand rank.</p></div>
    <div class="kirki-collection-item" data-kirki="it" data-kirki_name="item"><h3 data-kirki="cmsT" data-kirki_name="heading" style="font-size:24px">Performance Marketing</h3><p data-kirki="cmsB" data-kirki_name="paragraph" style="font-size:14px">Data-driven ads.</p></div>
    <div class="kirki-collection-item" data-kirki="it" data-kirki_name="item"><h3 data-kirki="cmsT" data-kirki_name="heading" style="font-size:24px">Social Media Growth</h3><p data-kirki="cmsB" data-kirki_name="paragraph" style="font-size:14px">Grow.</p></div>
  </div></div>
  <div data-kirki="harry" data-kirki_name="div"><div data-kirki="hL" data-kirki_name="div">img</div><div data-kirki="hR" data-kirki_name="div">
    <div data-kirki="hTop" data-kirki_name="div"><h4 data-kirki="harryT" data-kirki_name="heading" style="font-size:22px">Meet Harry</h4><p data-kirki="harryP" data-kirki_name="paragraph" style="font-size:13px">His business got a boom</p></div>
    <div data-kirki="hBot" data-kirki_name="div">
      <p data-kirki="st1" data-kirki_name="heading" class="k-stat" style="font-size:36px">75%</p><p data-kirki="sl1" data-kirki_name="paragraph" style="font-size:11px">Set up by webfx</p>
      <p data-kirki="st2" data-kirki_name="heading" class="k-stat" style="font-size:36px">$500K</p><p data-kirki="sl2" data-kirki_name="paragraph" style="font-size:11px">Built-in value</p>
    </div></div></div>
</section>
<section data-kirki="s2" data-kirki_name="section">
  <h1 data-kirki="rich" data-text_style="k-a" style="font-size:44px"><span style="visibility:visible">Unlock&nbsp;</span><span data-kirki="richSpan" data-text_style="k-b" style="color:#f60;font-size:52px">Revenue Growth</span><span>&nbsp;through Marketing</span></h1>
  <p data-kirki="para" data-kirki_name="paragraph" style="font-size:16px">Body with <span data-kirki="paraSpan" data-kirki_name="text" style="font-size:30px">big word</span> inside it</p>
</section>
<style>${wide ? '.m{display:none}' : '.d{display:none}'}</style></body>`;
const esc = s => s.replace(/"/g, '&quot;');
const page = `<iframe id="iframe-md" width="1200" srcdoc="${esc(canvas(true))}"></iframe>
<iframe id="iframe-mobile" width="400" srcdoc="${esc(canvas(false))}"></iframe>`;

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const p = await browser.newPage();
await p.setContent(page); await p.waitForTimeout(300);
await p.addScriptTag({ path: core });

const r = await p.evaluate(() => window.__HF.run({ debug: true }));
assert.equal(r.ok, true);
const by = Object.fromEntries(r.rows.map(x => [x.id, x]));
assert.deepEqual(r.bps, ['desktop', 'mobile']);
assert.deepEqual(by.heroD.visibleOn, ['desktop']);
assert.deepEqual(by.heroM.visibleOn, ['mobile']);
assert.equal(by.heroD.suggested, 'h1');
assert.equal(by.heroM.suggested, 'h1', 'responsive copy is H1 on its own breakpoint');
assert.equal(by.what.suggested, 'h2');
assert.equal(by.card.suggested, 'h3', 'card title inside link is a heading');
assert.equal(by.card.collection, true);
assert.equal(by.cardB.suggested, 'p');
assert.equal(by.btnT.suggested, 'span', 'button label untouched');
assert.equal(by.stat.suggested, 'p', 'stat heading demoted');
assert.equal(by.eyebrow.suggested, 'p');
assert.ok(r.issues.some(i => /2 H1/.test(i)), 'warns about 2 H1 in source');
// rich text: styled spans are part of their parent text block
assert.ok(!by.richSpan, 'styled span inside h1 is not its own row');
assert.ok(!by.paraSpan, 'styled span inside p is not its own row');
assert.equal(by.rich.text, 'Unlock Revenue Growth through Marketing');
assert.equal(by.rich.styled, 1);
assert.equal(by.rich.sizes.desktop, 44, 'visual size = size carrying most characters');
assert.equal(by.rich.suggested, 'h2', 'rich heading is the section title');
assert.match(by.rich.reason, /keeps 1 styled span/);
assert.equal(by.para.suggested, 'p');
// section with only card titles (numbers are p) → cards are H2, never H1 → H3
assert.equal(by.n1.suggested, 'p');
assert.equal(by.k1.suggested, 'h2');
assert.equal(by.k2.suggested, 'h2');
assert.match(by.k1.reason, /no title/);
assert.equal(by.exp4.suggested, by.exp2.suggested, 'look-alike siblings share one tag');
assert.equal(by.exp3.suggested, by.exp2.suggested);
assert.ok(/^h[2-4]$/.test(by.exp4.suggested), 'linked sibling follows the heading majority: ' + by.exp4.suggested);
assert.match(by.exp4.reason, /look-alike/);
assert.equal(by.cmsT.cms, true, 'CMS collection detected');
assert.deepEqual(by.cmsT.instances, ['SEO Optimisation', 'Performance Marketing', 'Social Media Growth']);
assert.equal(by.cmsT.suggested, 'h3');
assert.equal(by.cmsT.instances.length, 3, 'CMS template reports all 3 items');
assert.equal(r.rows.filter(x => x.id === 'cmsT').length, 1, 'one row for the template');
// sibling card after the collection: its title is a peer of the CMS titles, stats nest under it
assert.equal(by.svcT.suggested, 'h2');
// card grid under a section title, cards with different classes: all card titles are siblings (H3)
assert.equal(by.wT.suggested, 'h2');
for (const k of ['gh1', 'gh2', 'gh3']) assert.equal(by[k].suggested, 'h3', k + ' should be H3 sibling: ' + by[k].reason);
assert.equal(by.harryT.suggested, 'h3', 'Meet Harry card title → H3: ' + by.harryT.reason);
assert.equal(by.st1.suggested, 'h4', '75% → H4 under Meet Harry: ' + by.st1.reason);
assert.equal(by.st2.suggested, 'h4', '$500K → H4 under Meet Harry: ' + by.st2.reason);
assert.equal(by.harryP.suggested, 'p');
assert.notEqual(by.exp.suggested, 'h4', 'lone H4 after an H2 is fixed: ' + by.exp.suggested + ' ' + by.exp.reason);
assert.ok(!r.issues.some(i => /skips/.test(i)), 'no skipped levels anywhere: ' + r.issues.join(' | '));

const strict = await p.evaluate(() => window.__HF.run({ oneH1InSource: true, debug: true }));
const s = Object.fromEntries(strict.rows.map(x => [x.id, x]));
assert.equal(s.heroD.suggested, 'h1');
assert.notEqual(s.heroM.suggested, 'h1');
assert.ok(strict.issues.some(i => /mobile: 0 visible H1/.test(i)));

// check() with overrides
const iss = await p.evaluate(() => window.__HF.check({ heroD: 'h1', heroM: 'h1', what: 'h2', card: 'h4' }));
assert.ok(iss.some(i => /skips H2→H4/.test(i)));

// save hook rewrites the payload
await p.route('**/wp-json/kirki/v1/pages/75/blocks**', async route => {
  const body = new URLSearchParams(route.request().postData());
  const data = JSON.parse(body.get('data'));
  await route.fulfill({ json: { tags: Object.fromEntries(Object.entries(data.blocks).map(([k, v]) => [k, v.properties.tag])) } });
});
await p.route('http://hf.test/', r => r.fulfill({ contentType: 'text/html', body: page }));
await p.goto('http://hf.test/'); await p.addScriptTag({ path: core });
const out = await p.evaluate(async () => {
  window.__HF.arm({ heroD: 'h1', stat: 'p', bogus: 'script' });
  const waited = window.__HF.waitForSave(5000);
  const body = new URLSearchParams({ data: JSON.stringify({ blocks: {
    heroD: { properties: { tag: 'h3' } }, richSpan: { properties: { tag: 'span' } }, stat: { properties: { tag: 'H2' } }, other: { properties: { tag: 'div' } } } }) });
  const res = await new Promise(ok => {
    const x = new XMLHttpRequest();
    x.open('POST', '/wp-json/kirki/v1/pages/75/blocks?_method=post');
    x.onload = () => ok(JSON.parse(x.responseText));
    x.send(body.toString());
  });
  return { res, status: window.__HF.status(), waited: await waited };
});
assert.deepEqual(out.res.tags, { heroD: 'h1', richSpan: 'span', stat: 'P', other: 'div' });
assert.equal(out.status.lastRewrite.applied, 2);
assert.equal(out.waited.lastRewrite.applied, 2, 'waitForSave resolves on save');
assert.equal(out.status.armed, 0, 'hook is one-shot');
await p.evaluate(() => window.__HF.disarm());
// re-injecting the same version is a no-op
assert.equal(await p.evaluate(() => { const a = window.__HF; return a; }) !== null, true);

console.log('✓ all core tests passed');
await browser.close();
