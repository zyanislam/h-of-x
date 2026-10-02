# H(x) — User Guide

## 1. Install
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Pin the extension. Clicking its icon opens the side panel.

`localhost` is allowed by default. For a live domain, Chrome asks for access to that site the first time you click Scan there.

To update later: replace the files, then press ↻ on the H(x) card in `chrome://extensions`.

## 2. Use
1. Open a page in the Kirki editor and click **Scan page**.
2. Review the rows:
   - Click a row's text to highlight that element on the canvas.
   - Change the tag with the dropdown.
   - Untick rows you don't want changed.
   - **Vis** shows which breakpoints the element is visible on: D = desktop, T = tablet, L = landscape, M = mobile.
   - **Checks** and the **Outline preview** update as you edit.
3. Click **Apply N fixes**, then click **Save** in Kirki. If Save is greyed out, make a tiny edit first.
4. When the panel says "✓ saved", click **Reload editor**, then scan again to confirm.

Your two option switches are remembered, and changing one after a scan re-scans automatically.

## 3. Known limits
- The editor only shows the new tags after a reload, because Kirki's in-memory state is not updated.
- Global Header/Footer symbols are skipped.
- The rules are based on font size. Unusual designs may need manual overrides in the panel.

## 4. Troubleshooting
| Problem | Fix |
|---|---|
| Scan finds nothing | Make sure the Kirki editor page has finished loading, then scan again. |
| Save is greyed out in Kirki | Make a tiny edit (type a space and remove it) so Kirki marks the page dirty. |
| New tags not visible | Reload the editor — Kirki's in-memory state isn't updated by the write. |
| Chrome asks for site access | Allow it for that domain; only `localhost` is granted up front. |
| Panel is stale after changes | Press ↻ on the extension in `chrome://extensions` and reopen the panel. |
