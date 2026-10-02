// Real-page regression tests (fixtures exported with copy(__HF.fixture()) from the Scale site).
// Run: PW_CHROMIUM=/path/to/chromium node tests/pages.test.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const here = p => fileURLToPath(new URL(p, import.meta.url));

// [text prefix, expected tag] — first row whose text starts with the prefix
const EXPECT = {
  Home: [
    ['Scale Growth With', 'h1'], ['What We Do', 'h2'], ['Digital Strategy', 'h3'], ['Social Media Marketing', 'h3'],
    ['Email & Automation', 'h3'], ['Results That Speak', 'h2'], ['2.8x Engagement Growth', 'h3'],
    ['View case study', 'p'], ['What Sets Us Apart', 'h2'], ['1. Strategic Planning', 'h3'],
    ['Frequently Asked Questions', 'h2'], ['What makes Scale different', 'h3'], ['Do you offer ongoing support', 'h3'],
    ['What Our Clients Say', 'h2'], ['The Scale Blog', 'h2'], ['Ready to Scale', 'h2'],
  ],
  About: [
    ['About Scale', 'h1'], ['Strategy, design, and performance', 'p'], ['Mission', 'h2'], ['To empower brands', 'p'],
    ['Our Impact in Numbers', 'h2'], ['200+', 'p'], ['Successful Campaigns', 'p'], ['3x', 'p'], ['Average ROI Delivered', 'p'],
    ['Our Core Values', 'h2'], ['Collaboration', 'h3'], ['We work as one team', 'p'],
    ['Our Process', 'h2'], ['Discover', 'h3'], ['01', 'p'], ['Ready to Scale', 'h2'],
  ],
  Services: [['Services Built to Perform', 'h1'], ['Helping brands grow', 'p'], ['Our Services', 'h2'], ['Ready to Scale', 'h2']],
  Work: [['Work That Scales Brands', 'h1'], ['Every project we craft', 'p'], ['Case Study', 'h2'], ['4x Increase in Reader Retention', 'h3'], ['Ready to Scale', 'h2']],
  Contact: [
    ['Let’s Scale', 'h1'], ['Whether you’re ready', 'p'], ['Your Growth Starts Here', 'h2'], ['Contact Information', 'h2'],
    ['Email', 'h3'], ['hello@example.com', 'p'], ['Phone', 'h3'], ['+880 123 456 789', 'p'], ['Office', 'h3'], ['Scale Studio, Creative Avenue', 'p'],
  ],
  Blogs: [['Blog for Bold Marketers', 'h1'], ['Stories, strategies, and ideas', 'p'], ['The Scale Blog', 'h2'], ['Ready to Scale', 'h2']],
};

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
let failures = 0;
for (const [page, expects] of Object.entries(EXPECT)) {
  const p = await browser.newPage();
  await p.goto('file://' + here(`./fixtures/${page}.html`)); await p.waitForTimeout(600);
  await p.addScriptTag({ path: here('../core.js') });
  const r = await p.evaluate(() => window.__HF.run());
  const fails = [];
  const skipIssues = r.issues.filter(i => /skips|visible H1/.test(i));
  if (skipIssues.length) fails.push('outline issues: ' + skipIssues.join(' | '));
  for (const [prefix, tag] of expects) {
    const row = r.rows.find(x => x.text.startsWith(prefix));
    if (!row) { fails.push(`missing row “${prefix}”`); continue; }
    if (row.suggested !== tag) fails.push(`“${prefix}” → ${row.suggested} (expected ${tag}) — ${row.reason}`);
  }
  // no heading may be suggested for a 8+ word non-question sentence
  for (const x of r.rows) if (/^h/.test(x.suggested) && x.text.split(' ').length > 12 && !x.text.endsWith('?')) fails.push(`long text as heading: “${x.text.slice(0, 40)}”`);
  console.log(`${fails.length ? '✗' : '✓'} ${page} (${r.rows.length} texts)`);
  fails.forEach(f => console.log('   - ' + f));
  failures += fails.length;
  await p.close();
}
await browser.close();
assert.equal(failures, 0, `${failures} page expectation(s) failed`);
console.log('✓ all real-page tests passed');
