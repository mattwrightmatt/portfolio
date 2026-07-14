/* Session colour theme — one accessible two-colour pair [background, foreground]
   drives the whole site's --color-primary / --color-subdued, swapping roles
   between light and dark mode:
     light:  --color-primary = background,  --color-subdued = foreground
     dark:   --color-primary = foreground,  --color-subdued = background
   The pair is generated once per visit (randoma11y) and cached in sessionStorage,
   so it stays the same while navigating between pages and only changes on a fresh
   visit (new tab/session). Runs synchronously in <head> (before first paint) so
   there's no flash; the CSS defaults stay as a fallback if this fails. */
(function () {
	'use strict';
	var KEY = 'site-theme';
	function lum(hex) {
		var h = hex.replace('#', '');
		if (h.length === 3) h = h.replace(/./g, '$&$&');
		return 0.2126 * parseInt(h.slice(0, 2), 16) + 0.7152 * parseInt(h.slice(2, 4), 16) + 0.0722 * parseInt(h.slice(4, 6), 16);
	}

	// Reuse this visit's colours if we already picked them on an earlier page.
	var background, foreground;
	try {
		var saved = JSON.parse(sessionStorage.getItem(KEY));
		if (saved && saved.length === 2) { background = saved[0]; foreground = saved[1]; }
	} catch (e) { /* ignore */ }

	// Otherwise generate a fresh accessible pair and remember it for this visit.
	if (!background) {
		if (!window.randoma11y) return;
		var pair;
		try {
			// WCAG 2.1 ratio (symmetric) at AAA (7:1) — extra headroom since the UI
			// leans on primary at reduced opacity in lots of places.
			pair = window.randoma11y({ algorithm: 'WCAG21', threshold: 7 });
		} catch (e) { return; }
		if (!pair || !pair.colors) return;
		// The darker of the pair is the "background" anchor: it's the page
		// background in dark mode (and the ink in light mode), so light mode always
		// reads light and dark mode dark.
		var a = pair.colors[0], b = pair.colors[1];
		background = lum(a) <= lum(b) ? a : b;   // darker
		foreground = background === a ? b : a;   // lighter
		try { sessionStorage.setItem(KEY, JSON.stringify([background, foreground])); } catch (e) { /* ignore */ }
	}

	var root = document.documentElement;
	// Keep the browser chrome (iOS Safari's top bar etc.) in sync with the page
	// background. Without this, viewport-fit=cover pages don't tint it to match.
	var themeMeta = document.querySelector('meta[name="theme-color"]');
	if (!themeMeta) {
		themeMeta = document.createElement('meta');
		themeMeta.setAttribute('name', 'theme-color');
		document.head.appendChild(themeMeta);
	}
	function apply(dark) {
		var subdued = dark ? background : foreground;
		root.style.setProperty('--color-primary', dark ? foreground : background);
		root.style.setProperty('--color-subdued', subdued);
		themeMeta.setAttribute('content', subdued);
	}
	var mq = window.matchMedia('(prefers-color-scheme: dark)');
	apply(mq.matches);
	if (mq.addEventListener) { mq.addEventListener('change', function (e) { apply(e.matches); }); }
	else if (mq.addListener) { mq.addListener(function (e) { apply(e.matches); }); }
})();
