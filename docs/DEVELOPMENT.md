# Development

## Tests
```bash
npm i
npx playwright install chromium   # or set PW_CHROMIUM=/path/to/chromium
npm test
```
- `tests/core.test.mjs` — hand-built layouts, one per bug we fixed.
- `tests/pages.test.mjs` — **real pages** (Home, About, Services, Work, Contact, Blogs) in `tests/fixtures/`.

### Adding a real page to the fixtures
After a scan, run `copy(__HF.fixture())` in the editor's DevTools console and paste the result into `tests/fixtures/<Name>.html`. It contains the canvases' HTML with font sizes and visibility, and no images or scripts. Split it into the four canvases the same way as the existing fixtures and add expectations to `EXPECT`.

## Versioning
**1.3.0** is current. 1.0.0 was the foundation (scan, suggest, apply on Save), 1.1.0 added the analysis fixes, 1.2.0 brought the redesigned panel (Outline/Changes, skip, themes, ⋮ menu, faster scan). The number changes only on a release you decide on, not with every test build. Keep `manifest.json` and `package.json` in sync.

## Brand
- `brand/logo.svg` — app icon (512 px PNG: `brand/logo-512.png`)
- `brand/logo-small.svg` — simplified mark for 16 px
- `brand/wordmark.svg` — logo, name and tagline
- Colours: violet `#5641F4` (icon background, light-mode accent), `#8B7BFF` (dark-mode accent), white glyph
- Name: **H(x)**, said "H of x". Use `hx` in URLs and handles.
