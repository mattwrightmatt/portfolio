/* Coffee card component behaviour.

   The favorite marquee banner is a binary, data-driven option: a card marked
   data-fav="true" gets a scrolling "one of my favorites from <year>" ribbon,
   where <year> comes from the card's own data-year. Keeping it in JS (rather
   than pasting the repeated banner markup into every favorite) means a favorite
   is just an attribute flip, and the year can never fall out of sync with the
   card. The map modal clones list cards after this has run, so clones already
   carry their banner.

   Cards also carry data-year and data-position (position within the year, 1 =
   newest at the top) — not displayed, but a stable record of the current
   newest-to-oldest ordering for future sorting. */
(function (global) {
	'use strict';

	// Build a .fav-marquee element for a given year (year optional). The track
	// holds two identical groups so the CSS translateX(-50%) loop is seamless;
	// the second group is aria-hidden so screen readers read the label once.
	function buildMarquee(year) {
		var text = 'one of my favorites' + (year ? ' from ' + year : '');
		var wrap = document.createElement('div');
		wrap.className = 'fav-marquee';
		wrap.setAttribute('role', 'img');
		wrap.setAttribute('aria-label', text.charAt(0).toUpperCase() + text.slice(1));
		var track = document.createElement('div');
		track.className = 'fav-marquee-track';
		for (var g = 0; g < 2; g++) {
			var group = document.createElement('span');
			group.className = 'fav-marquee-group';
			if (g === 1) group.setAttribute('aria-hidden', 'true');
			for (var i = 0; i < 6; i++) {
				var item = document.createElement('span');
				item.className = 'fav-marquee-item';
				item.textContent = text;
				group.appendChild(item);
			}
			track.appendChild(group);
		}
		wrap.appendChild(track);
		return wrap;
	}

	// Add or remove a card's banner to match its data-fav flag.
	function applyFav(card) {
		var existing = card.querySelector(':scope > .fav-marquee');
		if (card.getAttribute('data-fav') === 'true') {
			if (!existing) card.insertBefore(buildMarquee(card.getAttribute('data-year') || ''), card.firstChild);
			else existing.replaceWith(buildMarquee(card.getAttribute('data-year') || '')); // keep year in sync
		} else if (existing) {
			existing.remove();
		}
	}

	function applyAll(root) {
		(root || document).querySelectorAll('.card.coffee').forEach(applyFav);
	}

	global.CoffeeCard = { buildMarquee: buildMarquee, applyFav: applyFav, applyAll: applyAll };

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', function () { applyAll(document); });
	} else {
		applyAll(document);
	}
})(window);
