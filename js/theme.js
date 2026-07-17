/* Session colour theme — OFF by default.

   The site ships with its original static theme (the CSS defaults in index.css).
   A toggle on the home page opts this browsing session into a randoma11y theme:
   one accessible two-colour pair [background, foreground] that drives the whole
   site's --color-primary / --color-subdued, swapping roles between light and
   dark mode:
     light:  --color-primary = background,  --color-subdued = foreground
     dark:   --color-primary = foreground,  --color-subdued = background

   The choice is session-wide: both the on/off flag and the chosen pair live in
   sessionStorage, so once enabled it stays enabled (and identical) while
   navigating between pages, and applies before first paint on each page (no
   flash). It resets to the original default theme on a fresh visit ("launch"),
   and the toggle control itself only appears on the home page.

   Exposes window.siteTheme = { enable, disable, isEnabled } for that toggle. */
(function () {
	'use strict';
	var PAIR_KEY = 'site-theme';       // cached [background, foreground] for the session
	var ENABLED_KEY = 'site-theme-on'; // whether the randoma11y theme is enabled this session

	function lum(hex) {
		var h = hex.replace('#', '');
		if (h.length === 3) h = h.replace(/./g, '$&$&');
		return 0.2126 * parseInt(h.slice(0, 2), 16) + 0.7152 * parseInt(h.slice(2, 4), 16) + 0.0722 * parseInt(h.slice(4, 6), 16);
	}

	var root = document.documentElement;
	var background, foreground;

	// Keep the browser chrome (iOS Safari's top bar etc.) in sync with the page
	// background. Without this, viewport-fit=cover pages don't tint it to match.
	var themeMeta = document.querySelector('meta[name="theme-color"]');
	if (!themeMeta) {
		themeMeta = document.createElement('meta');
		themeMeta.setAttribute('name', 'theme-color');
		document.head.appendChild(themeMeta);
	}
	// Default the chrome tint to the CSS default background; the randoma11y theme
	// overrides it via apply() when enabled, and disable() restores it here.
	function setDefaultChrome() {
		var def = getComputedStyle(root).getPropertyValue('--color-subdued').trim();
		if (def) themeMeta.setAttribute('content', def);
		else themeMeta.removeAttribute('content');
	}

	var mq = window.matchMedia('(prefers-color-scheme: dark)');
	var mqBound = false;

	// Reuse this session's colours if we already picked them, otherwise generate a
	// fresh accessible pair and remember it. Returns false if unavailable.
	function ensurePair() {
		if (background) return true;
		try {
			var saved = JSON.parse(sessionStorage.getItem(PAIR_KEY));
			if (saved && saved.length === 2) { background = saved[0]; foreground = saved[1]; return true; }
		} catch (e) { /* ignore */ }

		if (!window.randoma11y) return false;
		var pair;
		try {
			// WCAG 2.1 ratio (symmetric) at AAA (7:1) — extra headroom since the UI
			// leans on primary at reduced opacity in lots of places.
			pair = window.randoma11y({ algorithm: 'WCAG21', threshold: 7 });
		} catch (e) { return false; }
		if (!pair || !pair.colors) return false;
		// The darker of the pair is the "background" anchor: it's the page
		// background in dark mode (and the ink in light mode), so light mode always
		// reads light and dark mode dark.
		var a = pair.colors[0], b = pair.colors[1];
		background = lum(a) <= lum(b) ? a : b;   // darker
		foreground = background === a ? b : a;   // lighter
		try { sessionStorage.setItem(PAIR_KEY, JSON.stringify([background, foreground])); } catch (e) { /* ignore */ }
		return true;
	}

	function apply(dark) {
		var subdued = dark ? background : foreground;
		root.style.setProperty('--color-primary', dark ? foreground : background);
		root.style.setProperty('--color-subdued', subdued);
		themeMeta.setAttribute('content', subdued);
	}

	function onChange(e) { apply(e.matches); }
	function bindMq() {
		if (mqBound) return;
		if (mq.addEventListener) mq.addEventListener('change', onChange);
		else if (mq.addListener) mq.addListener(onChange);
		mqBound = true;
	}
	function unbindMq() {
		if (!mqBound) return;
		if (mq.removeEventListener) mq.removeEventListener('change', onChange);
		else if (mq.removeListener) mq.removeListener(onChange);
		mqBound = false;
	}

	function enable() {
		if (!ensurePair()) return false;   // randoma11y unavailable → stay on default
		try { sessionStorage.setItem(ENABLED_KEY, '1'); } catch (e) { /* ignore */ }
		apply(mq.matches);
		bindMq();
		return true;
	}

	function disable() {
		try { sessionStorage.removeItem(ENABLED_KEY); } catch (e) { /* ignore */ }
		unbindMq();
		// Drop the overrides so the original CSS default theme takes over again.
		root.style.removeProperty('--color-primary');
		root.style.removeProperty('--color-subdued');
		setDefaultChrome();
	}

	function isEnabled() {
		try { return sessionStorage.getItem(ENABLED_KEY) === '1'; } catch (e) { return false; }
	}

	window.siteTheme = { enable: enable, disable: disable, isEnabled: isEnabled };

	// Apply immediately (before first paint) only if this session has opted in, so
	// the original default theme shows on launch and whenever the toggle is off.
	if (isEnabled() && ensurePair()) {
		apply(mq.matches);
		bindMq();
	} else {
		setDefaultChrome();
	}
})();
