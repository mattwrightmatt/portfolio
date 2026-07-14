/* Session colour theme — on each page load, randoma11y generates one accessible
   two-colour pair [background, foreground]. That single pair drives the whole
   site's --color-primary / --color-subdued, swapping roles between light and
   dark mode:
     light:  --color-primary = background,  --color-subdued = foreground
     dark:   --color-primary = foreground,  --color-subdued = background
   Runs synchronously in <head> (before first paint) so there's no flash; the
   CSS defaults stay as a fallback if this fails. */
(function () {
	'use strict';
	if (!window.randoma11y) return;
	var pair;
	try {
		// WCAG 2.1 ratio (symmetric) so both light and dark stay legible after the swap.
		pair = window.randoma11y({ algorithm: 'WCAG21', threshold: 4.5 });
	} catch (e) { return; }
	if (!pair || !pair.colors) return;
	// Treat the darker of the accessible pair as the "background" anchor: it becomes
	// the page background in dark mode (and the ink in light mode), so light mode
	// always reads light and dark mode dark.
	function lum(hex) {
		var h = hex.replace('#', '');
		if (h.length === 3) h = h.replace(/./g, '$&$&');
		return 0.2126 * parseInt(h.slice(0, 2), 16) + 0.7152 * parseInt(h.slice(2, 4), 16) + 0.0722 * parseInt(h.slice(4, 6), 16);
	}
	var a = pair.colors[0], b = pair.colors[1];
	var background = lum(a) <= lum(b) ? a : b;   // darker
	var foreground = background === a ? b : a;   // lighter
	var root = document.documentElement;
	function apply(dark) {
		root.style.setProperty('--color-primary', dark ? foreground : background);
		root.style.setProperty('--color-subdued', dark ? background : foreground);
	}
	var mq = window.matchMedia('(prefers-color-scheme: dark)');
	apply(mq.matches);
	if (mq.addEventListener) { mq.addEventListener('change', function (e) { apply(e.matches); }); }
	else if (mq.addListener) { mq.addListener(function (e) { apply(e.matches); }); }
})();
