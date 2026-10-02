# How H(x) works

## Scanning
`core.js` runs in the editor page (MAIN world). It reads the four canvas iframes (`iframe-md`, `iframe-tablet`, `iframe-mobileLandscape`, `iframe-mobile`) using the `data-kirki` element ids, builds an outline for each breakpoint, and merges them into one tag per element.

## Writing
**Apply** installs a one-time hook on `XMLHttpRequest`. On the next `POST /wp-json/kirki/v1/pages/<id>/blocks` it sets `blocks[id].properties.tag` in the payload, then removes itself. `waitForSave()` resolves at that moment, so the panel never polls.

## The panel
`sidepanel.*` calls `window.__HF.run / arm / waitForSave / disarm / show` through `chrome.scripting`. `core.js` is injected only when the page doesn't already have the current version. Checks and the outline are computed inside the panel from the cached scan, so ticking rows doesn't call the page. Option switches live in `chrome.storage.local`.

## How levels are decided
Levels follow the page **structure**, not just font size. A heading owns the container it opens (a card, a group, or the whole section), and the headings inside that container sit one level below it. Cards that look the same are siblings. CMS items are handled as a single template.

## Rich text
Headings that contain styled `<span>`s (a different colour or font for some words) are treated as **one** text block. The spans are never listed or retagged, the row shows the full sentence, and only the parent's tag changes.
