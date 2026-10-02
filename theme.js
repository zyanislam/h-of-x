// Applied before the stylesheet paints to avoid a flash of the wrong theme.
try { const t = localStorage.getItem('hx-theme'); if (t && t !== 'system') document.documentElement.setAttribute('data-theme', t); } catch {}
