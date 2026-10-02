/* H(x) core — runs in the Kirki editor page (MAIN world).
 * Injected on demand by the side panel. Exposes window.__HF. All return values are JSON-serializable.
 */
(() => {
  const VERSION = '1.3.0+b2'; // build id: bump on every core change so the panel re-injects
  if (window.__HF?.version === VERSION) return;
  window.__HF?.disarm?.(); // replace an older copy cleanly
  const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  const TEXT_TYPES = ['heading', 'paragraph', 'text'];
  const BUTTON_TYPES = ['button', 'nav', 'navigation', 'form', 'input'];
  const SKIP_SECTION = /header|footer|nav/i;
  // Kirki canvases, base breakpoint first. Missing ones are ignored.
  const BREAKPOINTS = [
    ['desktop', 'iframe-md'], ['tablet', 'iframe-tablet'],
    ['landscape', 'iframe-mobileLandscape'], ['mobile', 'iframe-mobile'],
  ];

  // Text blocks: typed text elements, plus Kirki rich-text elements that only carry data-text_style.
  const TEXT_SEL = TEXT_TYPES.map(t => `[data-kirki_name="${t}" i]`).join(',') + ',[data-kirki][data-text_style]';
  const INLINE_OWNER_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P']);
  const kid = el => el?.getAttribute('data-kirki');
  // A Kirki symbol (component) instance: its contents can only be changed by opening the symbol,
  // so H of x flags problems inside one but never rewrites them.
  // Kirki marks component (symbol) instances in a few ways, depending on version and how the
  // symbol was made: a wrapper element, a symbol id, or "set as" header/footer.
  const SYMBOL_SEL = '[data-issymbolelement="true"], [data-kirki_name="symbol"], [data-kirki-symbol], [data-kirki-symbol_set_as], [data-kirki-symbol-el-prop-id]';
  function symbolOf(el) {
    const s = el.closest && el.closest(SYMBOL_SEL);
    if (!s) return null;
    const label = s.getAttribute('data-kirki-symbol_set_as') || s.getAttribute('aria-label') || s.id || '';
    return { id: kid(s) || s.getAttribute('data-kirki-symbol') || '', label };
  }
  const kname = el => (el?.getAttribute('data-kirki_name') || '').toLowerCase();
  const frames = () => BREAKPOINTS
    .map(([bp, id]) => ({ bp, doc: document.getElementById(id)?.contentDocument }))
    .filter(f => f.doc);

  function ancestors(el) {
    const out = [];
    for (let p = el.parentElement; p; p = p.parentElement) if (kid(p)) out.push(p);
    return out; // nearest first
  }
  function isVisible(el) {
    // Only display:none (Kirki's per-breakpoint hide) counts. opacity and visibility are ignored on
    // purpose: scroll-reveal animations keep off-screen sections at opacity 0 / visibility:hidden.
    if (el.checkVisibility) return el.checkVisibility();
    return el.getClientRects().length > 0;
  }
  function isTextBlock(el) {
    const n = kname(el);
    return TEXT_TYPES.includes(n) || (!n && el.hasAttribute('data-text_style'));
  }
  // A styled <span> (colour, font…) inside a heading/paragraph is part of that text, not its own element.
  function textOwner(el) {
    for (let p = el.parentElement; p && p !== el.ownerDocument.body; p = p.parentElement) {
      if (INLINE_OWNER_TAGS.has(p.tagName) || (kid(p) && isTextBlock(p))) return p;
    }
    return null;
  }
  // Visual size = the font size carrying most of the characters. Styled spans with a different
  // size count by their text length, so one big word can't turn a paragraph into a heading.
  // styleCache: per-scan Map(element -> font size) so shared parents are read once.
  function fontSizeOf(el, win, cache) {
    let v = cache.get(el);
    if (v === undefined) {
      const cs = win.getComputedStyle(el);
      v = cs.display === 'none' ? -1 : Math.round((parseFloat(cs.fontSize) || 0) * 10) / 10;
      cache.set(el, v);
    }
    return v;
  }
  function visualSize(el, win, cache) {
    const own = fontSizeOf(el, win, cache);
    if (!el.firstElementChild) return own;              // fast path: plain text, no spans
    const byChars = new Map();
    const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement;
      if (!p) continue;
      const len = n.textContent.replace(/\s+/g, '').length;
      if (!len) continue;
      const fs = fontSizeOf(p, win, cache);
      if (fs < 0) continue;
      byChars.set(fs, (byChars.get(fs) || 0) + len);
    }
    let best = own, bestLen = -1;
    for (const [fs, len] of byChars) if (len > bestLen || (len === bestLen && fs > best)) { best = fs; bestLen = len; }
    return best;
  }
  // Kirki CMS: <div data-kirki_name="collection"> … <div class="kirki-collection-item" data-kirki_name="item"> repeated.
  function collectionOf(el) {
    const item = el.closest('.kirki-collection-item, [data-kirki_name="item" i]');
    const col = el.closest('[data-kirki_name="collection" i]');
    return col || item ? { id: kid(col) || kid(item) || null, name: kname(col) || 'collection' } : null;
  }
  const cleanText = t => (t || '').replace(/\s+/g, ' ').trim();

  function styledParts(el) {
    return [...el.querySelectorAll('[data-kirki]')].filter(d => textOwner(d) === el).length;
  }

  function isButtonLabel(el, anc) {
    if (anc.some(a => BUTTON_TYPES.includes(kname(a))) || el.closest('button')) return true;
    // inside a link: only a label if it is (almost) the link's whole text; card links with title+text are fine
    const a = el.closest('a');
    if (!a) return false;
    const own = (el.textContent || '').trim().length, all = (a.textContent || '').trim().length;
    return all > 0 && own / all > 0.8;
  }

  // Build one record per element id, with per-breakpoint visibility and font size.
  function scan() {
    const fs_ = frames();
    if (!fs_.length) throw new Error('No Kirki canvas iframes found — is the editor open?');
    const items = new Map();
    const inlineIds = new Map();
    let order = 0;
    for (const { bp, doc } of fs_) {
      const seenHere = new Set();
      const win = doc.defaultView;
      const cache = new Map();
      doc.querySelectorAll(TEXT_SEL).forEach(el => {
        const id = kid(el);
        // skip styled spans inside a text block (structure is identical on every canvas → decide once per id)
        let inline = inlineIds.get(id);
        if (inline === undefined) inlineIds.set(id, (inline = !isTextBlock(el) || !!textOwner(el)));
        if (inline) return;
        const type = kname(el) || (/^H[1-6]$/.test(el.tagName) ? 'heading' : 'text');
        let it = items.get(id);
        if (seenHere.has(id)) {           // repeated id = collection/loop item
          if (it) {
            it.collection = true;
            if (bp === fs_[0].bp && it.instances.length < 50) it.instances.push(cleanText(el.textContent));
            if (!it.bp[bp]?.visible && isVisible(el)) it.bp[bp] = { visible: true, fs: visualSize(el, win, cache), el };
          }
          return;
        }
        const visible = isVisible(el);
        seenHere.add(id);
        if (!it) {
          // innerText keeps <br> as a space when the element is rendered
          const text = cleanText((isVisible(el) && cleanText(el.innerText)) || el.textContent);
          if (!text) return;
          const anc = ancestors(el);
          const top = anc.filter(a => !['body', 'root'].includes(kid(a)));
          const sec = top[top.length - 1] || el;
          it = {
            id, type, text, tag: el.tagName.toLowerCase(), order: order++,
            sectionId: kid(sec),
            sectionLabel: `${kname(sec)} ${sec.id || ''} ${sec.className || ''} ${sec.tagName}`,
            isLabel: isButtonLabel(el, anc), styled: styledParts(el), bp: {},
            cms: collectionOf(el), collection: !!collectionOf(el), instances: [text],
            look: [...el.classList].sort().join(' '),
            symbol: symbolOf(el),          // inside a Kirki symbol/component? (not editable from the page)
          };
          items.set(id, it);
        }
        // size only matters where the text is visible
        it.bp[bp] = { visible, fs: visible ? visualSize(el, win, cache) : null, el };
      });
    }
    const list = [...items.values()];
    const secOrder = [...new Set(list.map(i => i.sectionId))];
    list.forEach(i => (i.sectionIdx = secOrder.indexOf(i.sectionId)));
    return list;
  }

  const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] || 16; };

  // Outline for ONE breakpoint, using only elements visible there.
  function analyzeBp(all, bp) {
    const items = all.filter(i => i.bp[bp]?.visible);
    const fs = i => i.bp[bp].fs;
    const base = median(items.filter(i => i.type !== 'heading').map(fs));
    const res = new Map();
    const bySection = new Map();
    items.forEach(i => { if (!bySection.has(i.sectionIdx)) bySection.set(i.sectionIdx, []); bySection.get(i.sectionIdx).push(i); });

    let h1Used = false;
    for (const idx of [...bySection.keys()].sort((a, b) => a - b)) {
      const list = bySection.get(idx);
      const skip = SKIP_SECTION.test(list[0].sectionLabel);
      const cands = [];
      for (const i of list) {
        let why = null;
        if (skip) { res.set(i.id, { suggested: i.tag, reason: 'global header/footer — skipped', confidence: 'skip' }); continue; }
        const words = i.text.split(' ').length;
        const display = fs(i) >= base * 1.6;               // display-size text is a title even if long
        if (i.isLabel) why = 'button/link label';
        else if (/^(view|read|learn|see|get|book|explore|discover|shop|contact|start|download|try|join|sign)\b.{0,30}$/i.test(i.text) && words <= 4 && !display) why = 'call-to-action text';
        else if (/^(\d{1,2}[.)]?|[ivx]{1,4}[.)])$/i.test(i.text)) why = 'index number (01, 02…)';
        else if (/\S+@\S+\.\S+|https?:\/\/|^www\./i.test(i.text) || /^\+?[\d\s().-]{7,}$/.test(i.text)) why = 'contact detail (email/phone/URL)';
        else if ((i.text.match(/,/g) || []).length >= 2 && words <= 10 && !/[.!?]$/.test(i.text) && !display && /^[A-Z0-9]/.test(i.text) && /\d|street|st\.|road|avenue|ave|city|country|suite|floor/i.test(i.text)) why = 'address';
        else if (/^[\s$€£¥+~<>-]*\d[\d\s.,:]*\s*(%|[kKmMbB]\+?|\+|x)?\s*$/i.test(i.text) || /^\d+[\d.,]*\s*[kKmMbB]?\+/.test(i.text)) i._stat = true;
        else if (words > 20) why = 'long text';
        else if (words >= 8 && !/\?$/.test(i.text) && !display) why = 'sentence (subtitle/description)';
        else if (fs(i) < base * 1.25 && i.type !== 'heading') why = 'body-sized text';
        else if (fs(i) < base * 1.05) why = 'small text (label/eyebrow)';
        if (why) res.set(i.id, { suggested: HEADINGS.includes(i.tag) ? 'p' : i.tag, reason: why, confidence: 'high' });
        else { i._demoted = false; cands.push(i); }
      }
      if (!cands.length) continue;
      // ---- Structure-aware levels -------------------------------------------------------------
      // A heading "owns" the smallest-to-largest container in which it is the first heading
      // (its scope). Anything later inside that scope and visibly smaller is its child.
      // Same-size headings are siblings. CMS items are a hard boundary.
      const E = c => c.bp[bp].el;
      const doc0 = E(cands[0]).ownerDocument;
      const secEl = E(cands[0]).closest(`[data-kirki="${CSS.escape(cands[0].sectionId)}"]`) || doc0.body;
      cands.sort((x, y) => x.order - y.order);
      // index once per section: first candidate per ancestor, and per (ancestor, branch-signature) the branches holding a candidate
      const firstMap = new Map(), branchIdx = new Map();
      // ancestor chain per element, computed once; sig(B, el) is a slice of it
      const chains = new Map();
      const chainOf = el => {
        let c = chains.get(el);
        if (!c) {
          c = { nodes: [], names: [] };
          for (let n = el; n && n !== secEl.parentElement; n = n.parentElement) { c.nodes.push(n); c.names.push(kname(n) || n.tagName); }
          chains.set(el, c);
        }
        return c;
      };
      const sig = (B, el) => {
        const c = chainOf(el);
        const i = c.nodes.indexOf(B);
        return (i < 0 ? c.names : c.names.slice(0, i + 1)).join('<');
      };
      for (const x of cands) {
        for (let A = E(x).parentElement; A && secEl.contains(A); A = A.parentElement) {
          if (firstMap.has(A)) break;              // an earlier candidate already claimed this and every higher ancestor
          firstMap.set(A, x);
          if (A === secEl) break;
        }
      }
      // lazily built per ancestor: branch-signature -> [{B, x}]
      const repIndex = A => {
        let byKey = branchIdx.get(A);
        if (byKey) return byKey;
        branchIdx.set(A, (byKey = new Map()));
        for (const x of cands) {
          if (!A.contains(E(x))) continue;
          let B = E(x);
          while (B && B.parentElement !== A) B = B.parentElement;
          if (!B) continue;
          const key = sig(B, E(x));
          (byKey.get(key) ?? byKey.set(key, []).get(key)).push({ B, x });
        }
        return byKey;
      };
      const firstIn = A => firstMap.get(A);
      const scope = new Map();
      for (const c of cands) {
        let sc = E(c);
        for (let B = E(c), A = B.parentElement; A && secEl.contains(A); B = A, A = A.parentElement) {
          if (firstIn(A) !== c) break;
          // repeated structure: a sibling branch holds a heading in the same position (card grid,
          // list of items, component instances) → c's scope is its own branch, not the whole group
          const same = repIndex(A).get(sig(B, E(c))) || [];
          const repeated = same.some(({ B: D, x }) => D !== B && x !== c && Math.abs(fs(x) - fs(c)) <= fs(c) * 0.05);
          if (repeated) break;
          sc = A;
          if (A === secEl || A.matches('.kirki-collection-item, [data-kirki_name="item" i]')) break;
        }
        scope.set(c, sc);
      }
      const bigger = (p, c) => fs(p) > fs(c) * 1.05;
      const peer = (p, c) => p.look && p.look === c.look && Math.abs(fs(p) - fs(c)) <= fs(p) * 0.05;
      // section-wide scopes must be visibly bigger to own; card scopes own everything inside except look-alike peers
      const canOwn = (p, c) => scope.get(p) === secEl ? (bigger(p, c) || (c._stat && !p._stat)) : !peer(p, c);
      const parent = new Map(), level = new Map();
      const sectionIsFirst = !h1Used;
      let secRoot = null;
      cands.forEach((c, k) => {
        let owner = null;
        for (let j = k - 1; j >= 0; j--) {
          const p = cands[j];
          if (scope.get(p) !== E(p) && scope.get(p).contains(E(c)) && canOwn(p, c)) { owner = p; break; }
        }
        parent.set(c, owner);
        if (!owner && scope.get(c) === secEl) secRoot = secRoot || c;
      });
      for (const c of cands) {
        const owner = parent.get(c);
        let lv, reason;
        if (!owner) {
          lv = sectionIsFirst ? 1 : 2;
          reason = c === secRoot ? (lv === 1 ? 'page title (first section)' : 'section title')
            : lv === 1 ? 'top-level text in first section' : 'top-level heading in section';
        } else {
          lv = level.get(owner) + 1;
          const where = scope.get(owner) === secEl ? 'section' : 'card';
          reason = `under “${owner.text.slice(0, 28)}” (same ${where})`;
        }
        level.set(c, Math.min(lv, 6));
        let confidence = 'high';
        if (owner && scope.get(owner) === secEl && fs(owner) < fs(c) * 1.15) confidence = 'low';
        res.set(c.id, { suggested: 'h' + Math.min(lv, 6), reason, confidence });
      }
      // no real section title: several same-size top-level headings are peer cards
      const tops = cands.filter(c => !parent.get(c));
      const ref = secRoot || tops[0];
      if (ref && tops.some(c => c !== ref && Math.abs(fs(c) - fs(ref)) <= fs(ref) * 0.05)) {
        for (const c of tops) if (Math.abs(fs(c) - fs(ref)) <= fs(ref) * 0.05) {
          res.get(c.id).reason = `section has no title, so these cards become its H${level.get(c)}`;
        }
      }
      // stats (75%, $500K) are headings only inside a titled card; loose numbers stay text
      for (const c of cands) {
        if (!c._stat) continue;
        const owner = parent.get(c);
        if (!owner || scope.get(owner) === secEl) {
          res.set(c.id, { suggested: HEADINGS.includes(c.tag) ? 'p' : c.tag, reason: 'number/stat', confidence: 'high' });
          c._demoted = true;
        } else res.get(c.id).reason = `stat ${res.get(c.id).reason}`;
      }
      // labels under a loose stat ("200+" → "Successful Campaigns") are part of that figure, not headings
      for (const c of cands) {
        const owner = parent.get(c);
        if (owner?._demoted && !c._stat) {
          res.set(c.id, { suggested: HEADINGS.includes(c.tag) ? 'p' : c.tag, reason: `label of stat “${owner.text}”`, confidence: 'high' });
        }
      }
      if (!h1Used) {
        // exactly one H1: first one in DOM order
        let seen = false;
        cands.forEach(c => {
          const r = res.get(c.id);
          if (r.suggested !== 'h1') return;
          if (seen) { r.suggested = 'h2'; r.reason = 'extra H1 in same breakpoint → H2'; r.confidence = 'low'; }
          seen = true;
        });
        h1Used = seen || h1Used;
      }

      // Close gaps: levels inside a section must be consecutive, starting right under the page title.
      // e.g. a section with only card titles (no section title) gets H2 cards, not H3; H1 → H3 becomes H1 → H2.
      const secRes = cands.map(c => res.get(c.id)).filter(r => HEADINGS.includes(r.suggested));
      const hasH1 = secRes.some(r => r.suggested === 'h1');
      const lvBase = hasH1 ? 1 : 2;
      const used = [...new Set(secRes.map(r => +r.suggested[1]))].sort((a, b) => a - b);
      used.forEach((lv, i) => {
        const to = Math.min(lvBase + i, 6);
        if (to === lv) return;
        const note = !hasH1 && i === 0
          ? ` · section has no title, so these become its H${to}`
          : ` · moved H${lv}→H${to} so no level is skipped`;
        secRes.forEach(r => { if (+r.suggested[1] === lv) { r.suggested = 'h' + to; r.reason += note; } });
      });
    }
    return res;
  }

  // Merge per-breakpoint outlines into one tag per element (Kirki stores one tag).
  function analyze(items, { oneH1InSource = false } = {}) {
    const bps = frames().map(f => f.bp);
    // breakpoints with identical visibility and sizes give identical outlines: analyse each layout once
    const byLayout = new Map();
    const per = Object.fromEntries(bps.map(bp => {
      const key = items.map(i => (i.bp[bp]?.visible ? i.bp[bp].fs : '-')).join(',');
      if (!byLayout.has(key)) byLayout.set(key, analyzeBp(items, bp));
      return [bp, byLayout.get(key)];
    }));
    const plan = items.map(i => {
      const vis = bps.filter(bp => i.bp[bp]?.visible);
      const row = { ...i, visibleOn: vis };
      if (!vis.length) return { ...row, suggested: i.tag, reason: 'hidden on every breakpoint — left alone', confidence: 'skip' };
      const sugg = vis.map(bp => per[bp].get(i.id)).filter(Boolean);
      const primary = sugg[0];
      const distinct = [...new Set(sugg.map(s => s.suggested))];
      if (distinct.length === 1) {
        return { ...row, ...primary, confidence: sugg.some(s => s.confidence === 'low') ? 'low' : primary.confidence };
      }
      return {
        ...row, suggested: primary.suggested, confidence: 'low',
        reason: 'differs per breakpoint: ' + vis.map((bp, k) => `${bp}=${sugg[k]?.suggested}`).join(', '),
      };
    });

    // Responsive variants: different elements that are each H1 on disjoint breakpoints.
    const h1s = plan.filter(p => p.suggested === 'h1');
    if (h1s.length > 1) {
      h1s.forEach((p, k) => {
        if (k === 0) { p.reason += ` (+${h1s.length - 1} responsive H1 variant(s) in HTML)`; return; }
        if (oneH1InSource) { p.suggested = HEADINGS.includes(p.tag) && p.tag !== 'h1' ? p.tag : 'p'; p.reason = `responsive copy of H1 (${p.visibleOn.join('/')}) → not H1 (oneH1InSource)`; }
        else p.reason = `responsive H1 variant, visible on ${p.visibleOn.join('/')}`;
        p.confidence = 'low';
      });
    }
    plan.sort((a, b) => a.order - b.order);

    // Look-alike siblings: same section, same style classes, same type and size → same tag.
    // (e.g. three "✓ Experts…" list titles must all be H3 or all be p, not one H4 and two p.)
    const groups = new Map();
    for (const p of plan) {
      if (!p.look || p.confidence === 'skip') continue;
      const size = p.visibleOn.map(b => Math.round(p.bp[b].fs)).join('/');
      const key = `${p.sectionIdx}|${p.type}|${p.look}|${size}`;
      (groups.get(key) ?? groups.set(key, []).get(key)).push(p);
    }
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      const counts = new Map();
      g.forEach(p => counts.set(p.suggested, (counts.get(p.suggested) || 0) + 1));
      if (counts.size < 2) continue;
      const ranked = [...counts].sort((a, b) => b[1] - a[1]);
      const tie = ranked[0][1] === ranked[1][1];
      // tie-break: prefer the tag most of the group already has
      const pick = tie
        ? ranked.map(([t]) => t).sort((a, b) => g.filter(p => p.tag === b).length - g.filter(p => p.tag === a).length)[0]
        : ranked[0][0];
      for (const p of g) {
        if (p.suggested === pick) continue;
        p.reason += ` · matches ${g.length - 1} look-alike sibling${g.length > 2 ? 's' : ''} (${pick.toUpperCase()})`;
        p.suggested = pick;
        if (tie) p.confidence = 'low';
      }
    }

    // Page-wide guard: walk each breakpoint's outline in reading order and pull any heading that
    // skips a level up to (previous + 1). Rows we must not touch (header/footer, hidden) are reported
    // by the checks instead.
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (const bp of bps) {
        let prev = 0;
        for (const p of plan) {
          if (!p.visibleOn.includes(bp) || !HEADINGS.includes(p.suggested)) continue;
          const lv = +p.suggested[1];
          if (prev && lv > prev + 1 && p.confidence !== 'skip') {
            p.reason += ` · H${lv}→H${prev + 1} so the page doesn't skip a level`;
            p.suggested = 'h' + (prev + 1);
            changed = true;
          }
          prev = +p.suggested[1];
        }
      }
      if (!changed) break;
    }
    return { plan, bps };
  }

  // Check the final outline on each breakpoint: exactly one H1, no skipped levels.
  function validate(plan, bps) {
    const issues = [];
    for (const bp of bps) {
      const hs = plan.filter(p => p.visibleOn.includes(bp) && HEADINGS.includes(p.suggested));
      const h1 = hs.filter(p => p.suggested === 'h1').length;
      if (h1 !== 1) issues.push(`${bp}: ${h1} visible H1 (should be 1)`);
      let prev = 0;
      hs.forEach(p => {
        const l = +p.suggested[1];
        if (prev && l > prev + 1) issues.push(`${bp}: skips H${prev}→H${l} at "${p.text.slice(0, 40)}"`);
        prev = l;
      });
    }
    const srcH1 = plan.filter(p => p.suggested === 'h1').length;
    if (srcH1 > 1) issues.push(`HTML source has ${srcH1} H1 elements (hidden responsive copies). Turn on "One H1 in page source" to keep just one.`);
    return issues;
  }


  const HEADING_OPTS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div'];

  function run(opts = {}) {
    if (!frames().length) return { ok: false, error: 'No Kirki canvas found. Open a page in the Kirki editor.' };
    const { plan, bps } = analyze(scan(), opts);
    const issues = validate(plan, bps);
    const doc0 = frames()[0].doc;
    const sections = [...new Map(plan.map(p => [p.sectionIdx, p.sectionId])).entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([idx, id]) => {
        const el = id && doc0.querySelector(`[data-kirki="${CSS.escape(id)}"]`);
        const label = el && (el.getAttribute('aria-label') || (el.id && !/^k-|^dp/.test(el.id) ? el.id : ''));
        return { idx, id, label: label || '', skip: plan.some(p => p.sectionIdx === idx && p.confidence === 'skip' && /header|footer/.test(p.reason)) };
      });
    return {
      ok: true, bps, issues, pageId: pageId(), sections,
      status: status(),
      rows: plan.map(p => ({
        id: p.id, text: p.text.slice(0, 120), cms: !!p.cms, symbol: p.symbol || null,
        instances: p.instances.length > 1 ? p.instances.map(t => t.slice(0, 80)) : undefined,
        section: p.sectionIdx, sectionId: p.sectionId, visibleOn: p.visibleOn,
        current: p.tag, suggested: p.suggested, confidence: p.confidence,
        reason: p.reason + (p.styled ? ` · keeps ${p.styled} styled span${p.styled > 1 ? 's' : ''} inside` : ''),
        ...(opts.debug && {   // extra fields for tests and DevTools only
          type: p.type, collection: p.collection, styled: p.styled || 0, instancesAll: p.instances,
          sizes: Object.fromEntries(Object.entries(p.bp).filter(([, v]) => v.fs != null).map(([k, v]) => [k, v.fs])),
        }),
      })),
    };
  }

  // Validate an arbitrary final mapping (after user overrides) using the last scan.
  function check(finalTags) {
    const items = scan();
    const bps = frames().map(f => f.bp);
    const plan = items.map(i => ({ ...i, visibleOn: bps.filter(b => i.bp[b]?.visible), suggested: finalTags[i.id] ?? i.tag }));
    return validate(plan, bps);
  }

  function pageId() {
    const m = location.href.match(/[?&](?:post|post_id|page_id|id)=(\d+)/);
    return m ? +m[1] : null;
  }

  // ---- Save hook: rewrite tags inside POST /kirki/v1/pages/:id/blocks ----
  const state = { armed: null, lastRewrite: null, errors: [] };
  let waiters = [];
  const settle = () => { const w = waiters; waiters = []; w.forEach(fn => fn(status())); };
  const origOpen = XMLHttpRequest.prototype.open, origSend = XMLHttpRequest.prototype.send;
  const SAVE_RE = /\/kirki\/v1\/pages\/\d+\/blocks/;

  function arm(map) {
    map = Object.fromEntries(Object.entries(map || {}).filter(([, t]) => HEADING_OPTS.includes(t)).filter(([id]) => !inSymbol(id)));
    if (!Object.keys(map).length) return { ok: false, error: 'Nothing selected to apply.' };
    state.armed = map; state.lastRewrite = null; state.errors = [];
    XMLHttpRequest.prototype.open = function (m, url, ...rest) { this.__hfUrl = String(url); return origOpen.call(this, m, url, ...rest); };
    XMLHttpRequest.prototype.send = function (body) {
      try {
        if (state.armed && SAVE_RE.test(this.__hfUrl || '')) body = rewrite(body);
      } catch (e) { state.errors.push(String(e)); queueMicrotask(settle); console.error('[HF] rewrite failed, sending original', e); }
      return origSend.call(this, body);
    };
    return { ok: true, count: Object.keys(map).length };
  }
  function rewrite(body) {
    const setTags = json => {
      const data = JSON.parse(json);
      const applied = [], missing = [];
      for (const [id, tag] of Object.entries(state.armed)) {
        const b = data.blocks?.[id];
        if (!b?.properties) { missing.push(id); continue; }
        const old = b.properties.tag;
        b.properties.tag = old && old === old.toUpperCase() ? tag.toUpperCase() : tag;
        applied.push(id);
      }
      state.lastRewrite = { at: Date.now(), applied: applied.length, missing };
      queueMicrotask(() => { settle(); disarm(); }); // one-shot
      console.log(`[HF] Rewrote ${applied.length} tag(s) in save payload.`);
      return JSON.stringify(data);
    };
    if (body instanceof FormData) { body.set('data', setTags(body.get('data'))); return body; }
    if (typeof body === 'string') {
      const p = new URLSearchParams(body);
      if (p.has('data')) { p.set('data', setTags(p.get('data'))); return p.toString(); }
      if (body.trim().startsWith('{')) return setTags(body);
    }
    state.errors.push('Unknown save body type — not modified');
    return body;
  }
  // ---- Live apply: change the tags in the editor's own copy of the page (no reload, no Save click) ----
  // The editor keeps every element in one React state: { blocks: { <id>: { properties: { tag } } } }.
  let hookCache = null;
  function findBlocksHook(ids) {
    // Reuse the hook found last time while it still holds these ids (saves a full component scan).
    if (hookCache && ids.some(id => hookCache.state.blocks && hookCache.state.blocks[id])) return hookCache;
    const docs = [document, ...[...document.querySelectorAll('iframe')].map(f => { try { return f.contentDocument; } catch { return null; } }).filter(Boolean)];
    const roots = new Set();
    for (const d of docs) for (const el of d.querySelectorAll('*')) { const k = Object.keys(el).find(x => x.startsWith('__reactContainer')); if (k) roots.add(el[k]); }
    const stack = [...roots]; let n = 0;
    while (stack.length && n++ < 300000) {
      const f = stack.pop();
      if (f.child) stack.push(f.child); if (f.sibling) stack.push(f.sibling);
      let h = f.memoizedState, i = 0;
      while (h && typeof h === 'object' && 'memoizedState' in h && i++ < 120) {
        const st = h.memoizedState;
        if (st && typeof st === 'object' && st.blocks && typeof st.blocks === 'object' && h.queue && typeof h.queue.dispatch === 'function'
            && ids.some(id => st.blocks[id] && st.blocks[id].properties)) return (hookCache = { state: st, dispatch: h.queue.dispatch });
        h = h.next;
      }
    }
    return null;
  }

  // Resolves true when Kirki's own save of the page finishes within `ms`.
  function watchPageSave(ms) {
    return new Promise(resolve => {
      let done = false;
      const finish = v => { if (!done) { done = true; undo(); resolve(v); } };
      const oFetch = window.fetch;
      window.fetch = function (u) { const p = oFetch.apply(this, arguments); if (SAVE_RE.test(String((u && u.url) || u))) p.then(r => finish(!!r.ok), () => finish(false)); return p; };
      const oOpen = XMLHttpRequest.prototype.open, oSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (m, u) { this.__hfWatch = SAVE_RE.test(String(u)); return oOpen.apply(this, arguments); };
      XMLHttpRequest.prototype.send = function () { if (this.__hfWatch) this.addEventListener('loadend', () => finish(this.status >= 200 && this.status < 300)); return oSend.apply(this, arguments); };
      function undo() { window.fetch = oFetch; XMLHttpRequest.prototype.open = oOpen; XMLHttpRequest.prototype.send = oSend; }
      setTimeout(() => finish(false), ms);
    });
  }

  // Never touch anything inside a symbol, whatever the panel sends.
  function inSymbol(id) {
    for (const { doc } of frames()) { const el = doc.querySelector(`[data-kirki="${CSS.escape(id)}"]`); if (el && el.closest(SYMBOL_SEL)) return true; }
    return false;
  }

  async function applyLive(map) {
    map = Object.fromEntries(Object.entries(map || {}).filter(([, t]) => HEADING_OPTS.includes(t)).filter(([id]) => !inSymbol(id)));
    const ids = Object.keys(map);
    if (!ids.length) return { ok: false, error: 'Nothing selected to apply.' };
    const hook = findBlocksHook(ids);
    if (!hook) return { ok: false, error: 'live-unavailable' };
    const st = hook.state, blocks = { ...st.blocks };
    const applied = [], missing = [];
    for (const [id, tag] of Object.entries(map)) {
      const b = st.blocks[id];
      if (!b || !b.properties) { missing.push(id); continue; }
      const t = b.properties.tag && b.properties.tag === String(b.properties.tag).toUpperCase() ? tag.toUpperCase() : tag;
      b.properties.tag = t;                                    // in place, for any cache holding the old object
      blocks[id] = { ...b, properties: { ...b.properties, tag: t } };   // new objects, so React re-renders
      applied.push(id);
    }
    if (!applied.length) return { ok: false, error: 'live-unavailable' };
    const saved = watchPageSave(3000);
    const next = { ...st, blocks };
    hookCache = { state: next, dispatch: hook.dispatch };
    if (typeof st.flag === 'boolean') next.flag = !st.flag;
    hook.dispatch(next);
    state.lastRewrite = { at: Date.now(), applied: applied.length, missing, live: true };
    const kirkiSaved = await saved;
    return { ok: true, applied: applied.length, missing, savedBy: kirkiSaved ? 'kirki' : 'pending' };
  }

  function disarm() {
    state.armed = null;
    queueMicrotask(settle);
    XMLHttpRequest.prototype.open = origOpen; XMLHttpRequest.prototype.send = origSend;
    return { ok: true };
  }
  function status() {
    return { armed: state.armed ? Object.keys(state.armed).length : 0, lastRewrite: state.lastRewrite, errors: state.errors, hasCanvas: frames().length > 0 };
  }

  // Resolves when the armed Save happens (or on error/disarm/timeout) — no polling needed.
  function waitForSave(timeoutMs = 240000) {
    if (!state.armed || state.lastRewrite || state.errors.length) return Promise.resolve(status());
    return new Promise(res => {
      const t = setTimeout(() => { waiters = waiters.filter(w => w !== done); res({ ...status(), timeout: true }); }, timeoutMs);
      const done = st => { clearTimeout(t); res(st); };
      waiters.push(done);
    });
  }

  // Snapshot of the canvases for regression tests: copy(__HF.fixture()) in DevTools after a scan.
  function fixture() {
    const out = [];
    for (const { bp, doc } of frames()) {
      const clone = doc.body.cloneNode(true);
      const src = doc.body.querySelectorAll('*'), dst = clone.querySelectorAll('*');
      const win = doc.defaultView;
      src.forEach((el, i) => {
        const cs = win.getComputedStyle(el), d = dst[i];
        if (d.tagName === 'SCRIPT' || d.tagName === 'STYLE') { d.remove(); return; }
        d.setAttribute('style', `font-size:${cs.fontSize};${cs.display === 'none' ? 'display:none;' : ''}${cs.visibility === 'hidden' ? 'visibility:hidden;' : ''}`);
        if (d.tagName === 'IMG' || d.tagName === 'SVG') d.replaceChildren();
      });
      out.push(`<!-- ${bp} -->\n<template data-bp="${bp}">${clone.outerHTML}</template>`);
    }
    return out.join('\n');
  }

  // Flash an element on the first breakpoint where it is visible.
  // Highlight an element and bring it into view — inside its canvas iframe AND in the editor
  // around the iframe (the Kirki canvas is a tall, zoomed iframe inside a scrolling editor area).
  function scrollableParent(node) {
    for (let n = node.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll|overlay)/.test(cs.overflowY + cs.overflowX) && (n.scrollHeight > n.clientHeight + 2 || n.scrollWidth > n.clientWidth + 2)) return n;
    }
    return document.scrollingElement;
  }
  // The visible "window" of the canvas: nearest ancestor of the iframe that clips its content.
  function clipParent(node) {
    for (let n = node.parentElement; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') return n;
    }
    return null;
  }
  // Where the element's centre is on screen, and how far it is from the centre of the canvas window.
  function offsetFromCentre(frameEl, el) {
    const fr = frameEl.getBoundingClientRect();
    const sx = frameEl.offsetWidth ? fr.width / frameEl.offsetWidth : 1;    // editor zoom (e.g. 43%)
    const sy = frameEl.offsetHeight ? fr.height / frameEl.offsetHeight : 1;
    const er = el.getBoundingClientRect();                                  // iframe-local
    const cx = fr.left + (er.left + er.width / 2) * sx;
    const cy = fr.top + (er.top + er.height / 2) * sy;
    const clip = clipParent(frameEl);
    const vr = clip ? clip.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    const box = { left: Math.max(vr.left, 0), top: Math.max(vr.top, 0),
      right: Math.min(vr.left + vr.width, innerWidth), bottom: Math.min(vr.top + vr.height, innerHeight) };
    return {
      dx: cx - (box.left + box.right) / 2, dy: cy - (box.top + box.bottom) / 2,
      visible: cx > box.left + 20 && cx < box.right - 20 && cy > box.top + 30 && cy < box.bottom - 30,
      viewport: clip, box,
    };
  }
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  async function revealInEditor(frameEl, el) {
    let o = offsetFromCentre(frameEl, el);
    if (o.visible) return 'visible';
    // 1) real scroll containers (overflow:auto/scroll)
    const sc = scrollableParent(frameEl);
    if (sc && sc !== document.scrollingElement) {
      const before = [sc.scrollTop, sc.scrollLeft];
      sc.scrollBy({ top: o.dy, left: Math.abs(o.dx) > 40 ? o.dx : 0 });
      await frame(); await frame();
      o = offsetFromCentre(frameEl, el);
      if (o.visible || before[0] !== sc.scrollTop || before[1] !== sc.scrollLeft) { if (o.visible) return 'scrolled'; }
    }
    // 2) pan-style canvases (content moved with transforms, driven by the mouse wheel):
    //    send wheel events to the canvas area until the element is centred.
    const target = o.viewport || frameEl.parentElement;
    const r = target.getBoundingClientRect();
    const at = { clientX: Math.max(r.left + 10, Math.min(r.left + r.width / 2, innerWidth - 10)),
                 clientY: Math.max(r.top + 10, Math.min(r.top + r.height / 2, innerHeight - 10)) };
    const hit = document.elementFromPoint(at.clientX, at.clientY) || target;
    const wheelTarget = hit.tagName === 'IFRAME' ? hit.parentElement : hit;
    for (let i = 0; i < 40; i++) {
      o = offsetFromCentre(frameEl, el);
      if (Math.abs(o.dy) < 40 && Math.abs(o.dx) < 60) return 'panned';
      const step = v => Math.sign(v) * Math.min(Math.abs(v), 400);
      const ev = new WheelEvent('wheel', { bubbles: true, cancelable: true, composed: true, deltaMode: 0,
        deltaY: Math.abs(o.dy) >= 40 ? step(o.dy) : 0, deltaX: Math.abs(o.dx) >= 60 ? step(o.dx) : 0, ...at });
      wheelTarget.dispatchEvent(ev);
      await frame();
      const n = offsetFromCentre(frameEl, el);
      if (Math.abs(n.dy - o.dy) < 1 && Math.abs(n.dx - o.dx) < 1) {
        await frame(); await frame();                          // allow smoothed panning to catch up
        const m = offsetFromCentre(frameEl, el);
        if (Math.abs(m.dy - o.dy) < 1 && Math.abs(m.dx - o.dx) < 1) return 'stuck';
      }
    }
    return offsetFromCentre(frameEl, el).visible ? 'panned' : 'stuck';
  }
  // DevTools helper: __HF.debugScroll('<data-kirki id>') describes how the canvas can be moved.
  function debugScroll(id) {
    const f = frames()[0];
    const frameEl = document.getElementById('iframe-md');
    const el = f?.doc.querySelector(`[data-kirki="${CSS.escape(id)}"]`);
    if (!frameEl || !el) return 'not found';
    const chain = [];
    for (let n = frameEl.parentElement; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      chain.push({ tag: n.tagName, id: n.id, cls: String(n.className).slice(0, 60), overflow: cs.overflowX + '/' + cs.overflowY,
        transform: cs.transform === 'none' ? '' : cs.transform, scroll: [n.scrollTop, n.scrollHeight, n.clientHeight] });
    }
    return { offset: offsetFromCentre(frameEl, el), chain };
  }
  function show(id, index = 0, bp = null) {
    const list = frames();
    const ids = { desktop: 'iframe-md', tablet: 'iframe-tablet', landscape: 'iframe-mobileLandscape', mobile: 'iframe-mobile' };
    const ordered = bp ? [...list.filter(f => f.bp === bp), ...list.filter(f => f.bp !== bp)] : list;
    for (const { bp: b, doc } of ordered) {
      const all = [...doc.querySelectorAll(`[data-kirki="${CSS.escape(id)}"]`)];
      const el = (all[index] && isVisible(all[index])) ? all[index] : all.find(isVisible);
      if (!el) continue;
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });   // if the iframe itself scrolls
      const frameEl = document.getElementById(ids[b]);
      // native scrolling usually handles the editor too; if the element is still off-screen afterwards, scroll the editor area ourselves
      if (frameEl) setTimeout(() => revealInEditor(frameEl, el).then(r => { state.lastReveal = r; }), 650);
      const prev = el.style.outline;
      el.style.outline = '3px solid #ff2d95'; el.style.outlineOffset = '2px';
      setTimeout(() => { el.style.outline = prev; el.style.outlineOffset = ''; }, 2400);
      return true;
    }
    return false;
  }


  window.__HF = { version: VERSION, run, check, arm, applyLive, disarm, status, waitForSave, show, fixture, debugScroll, reveal: revealInEditor };
})();
