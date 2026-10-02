<div align="center">

<img src="brand/logo.svg" alt="" width="104">

# H(x) &nbsp;·&nbsp; `f(page) = clarity`

**A Chrome extension for the [Kirki](https://kirki.io) page builder.**
Scan a page, get a correct H1–H6 outline across every breakpoint, apply it on Save.

![Chrome MV3](https://img.shields.io/badge/Chrome-MV3_side_panel-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![Tests](https://img.shields.io/badge/tests-Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white)
![Version](https://img.shields.io/badge/version-1.3.0-555?style=flat-square)

<img src="docs/screenshots/outline-dark.png" alt="The H(x) side panel showing a page outline with the suggested tag changes" width="320">

</div>

---

Heading levels decide how a page reads to search engines and to screen readers, and in a visual builder they drift out of order as the page grows. H(x) reads the **rendered** structure on all four canvases and proposes the outline the page should have had. Nothing is written until you review it and click Save in Kirki.

### At a glance

|  |  |
|---|---|
| **Review first** | Every suggested change is a row you can retag, untick or skip |
| **All breakpoints** | Desktop, tablet, landscape and mobile merged into one tag per element |
| **Safe write** | A one-shot hook rewrites the tag inside Kirki's own save request, then removes itself |
| **Rich text aware** | A heading with styled `<span>`s stays a single block |
| **Live checks** | Outline preview and problem list update as you edit, with no extra page calls |
| **Themes** | Light, dark and auto |

### Screenshots

| Outline | Changes | Start |
|---|---|---|
| <img src="docs/screenshots/outline-dark.png" alt="Outline tab" width="250"> | <img src="docs/screenshots/changes-light.png" alt="Changes tab" width="250"> | <img src="docs/screenshots/start-light.png" alt="Empty state" width="250"> |
| The whole page structure per breakpoint. Struck-through tags are the current ones, violet is what H(x) suggests — `P → H3`, `H2 → P`. | Only the rows that change, in reading order, so you can check each fix in context. CMS items and components are labelled. | Before a scan: what the three steps do, and nothing is touched until you say so. |

Dark and light follow your system theme.

## Contents
[Install](#install-unpacked) · [Use](#use) · [How it works](#how-it-works) · [Tests](#tests) · [Rich text](#rich-text) · [How levels are decided](#how-levels-are-decided) · [Known limits](#known-limits) · [Brand](#brand)

## Install (unpacked)
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Pin the extension. Clicking its icon opens the side panel.

`localhost` is allowed by default. For a live domain, Chrome asks for access to that site the first time you click Scan there.

## Version
**1.3.0**. 1.0.0 was the foundation (scan, suggest, apply on Save), 1.1.0 added the analysis fixes and improvements, 1.2.0 brought the redesigned panel (Outline/Changes, skip, themes, ⋮ menu, faster scan), and 1.3.0 is the current release. The number changes only when you decide on a new release, not with every test build.

## Use
1. Open a page in the Kirki editor and click **Scan page**.
2. Review the rows:
   - Click a row's text to highlight that element on the canvas.
   - Change the tag with the dropdown.
   - Untick rows you don't want changed.
   - **Vis** shows which breakpoints the element is visible on: D = desktop, T = tablet, L = landscape, M = mobile.
   - **Checks** and **Outline preview** update as you edit.
3. Click **Apply N changes**, then click **Save** in Kirki. If Save is greyed out, make a tiny edit first.
4. When the panel says "✓ saved", click **Reload editor**, then scan again to confirm.

## How it works
- `core.js` runs in the editor page (MAIN world). It reads the four canvas iframes (`iframe-md`, `iframe-tablet`, `iframe-mobileLandscape`, `iframe-mobile`) using the `data-kirki` element ids, builds an outline for each breakpoint, and merges them into one tag per element.
- **Apply** installs a one-time hook on `XMLHttpRequest`. On the next `POST /wp-json/kirki/v1/pages/<id>/blocks`, it sets `blocks[id].properties.tag` in the payload and then removes itself.
- `sidepanel.*` provides the UI. It calls `window.__HF.run / arm / waitForSave / disarm / show` through `chrome.scripting`. `core.js` is injected only when the page doesn't already have the current version. The checks and outline are computed inside the panel from the cached scan, so ticking rows doesn't call the page.
- The save hook is one-shot: it removes itself after the first save it rewrites, and `waitForSave()` resolves at that moment, so the panel doesn't need to poll.
- Your two option switches are remembered (`chrome.storage.local`), and changing one after a scan re-scans automatically.

## Tests
```
npm i
npx playwright install chromium   # or set PW_CHROMIUM=/path/to/chromium
npm test
```
- `tests/core.test.mjs`: hand-built layouts (one per bug we fixed).
- `tests/pages.test.mjs`: **real pages** (Home, About, Services, Work, Contact, Blogs) in `tests/fixtures/`, exported with `copy(__HF.fixture())`. To add a page, save the export as `tests/fixtures/<Name>.html`, split into the 4 canvases the same way, and add expectations to `EXPECT`.

## Rich text
Headings that contain styled `<span>`s (a different colour or font for some words) are treated as **one** text block. The spans are never listed or retagged, the row shows the full sentence, and only the parent's tag changes.

## How levels are decided
Levels follow the page **structure**, not just font size. A heading owns the container it opens (a card, a group, or the whole section), and the headings inside that container sit one level below it. Cards that look the same are siblings. CMS items are handled as a single template.

## Sending a real page for tests
After a scan, run `copy(__HF.fixture())` in the editor's DevTools console and paste the result into a file. It contains the canvases' HTML with font sizes and visibility, and no images or scripts.

## Known limits
- The editor only shows the new tags after a reload, because Kirki's in-memory state is not updated.
- Global Header/Footer symbols are skipped.
- The rules are based on font size. Unusual designs may need manual overrides in the panel.

## Brand
- `brand/logo.svg`: app icon (512 px PNG: `brand/logo-512.png`)
- `brand/logo-small.svg`: simplified mark for 16 px
- `brand/wordmark.svg`: logo, name and tagline
- Colors: violet `#5641F4` (icon background and light-mode accent), `#8B7BFF` (dark-mode accent), white glyph
- Name: **H(x)**, said "H of x". Use `hx` in URLs and handles.
