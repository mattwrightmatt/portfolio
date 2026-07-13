/* Coffee origin globe — an interactive orthographic world (borders, country +
   ocean labels, subtle land shading) drawn from bundled Natural Earth data with
   d3-geo and styled by the page's CSS. d3 + topojson + the world file load once
   (preloaded on page idle so switching to Map feels instant). Pins sit at each
   coffee's approximate growing region; coffees sharing a region cluster into a
   numbered marker. Tapping a marker calls window.openCoffeePanel(cards). */
(function () {
	'use strict';

	// Fallback coordinate per origin country [lng, lat].
	var COUNTRY = {
		'Ethiopia': [38.7, 6.5], 'Colombia': [-75.5, 3.6], 'Kenya': [37.6, -0.4],
		'Brazil': [-45.5, -21.2], 'Guatemala': [-90.8, 14.7], 'Costa Rica': [-84.0, 9.65],
		'Peru': [-78.6, -6.0], 'Mexico': [-92.4, 15.5], 'Honduras': [-87.8, 14.9],
		'Indonesia': [99.0, 2.5], 'India': [75.7, 13.1], 'Myanmar': [96.6, 21.4],
		'Burundi': [29.9, -3.2]
	};
	// Region substrings matched against a coffee's "Origin:" line (specific first).
	var REGIONS = [
		['hambela', [38.6, 5.9]], ['uraga', [38.55, 5.75]], ['shantawene', [38.35, 6.3]],
		['worka sakaro', [38.2, 6.02]], ['west guji', [38.15, 5.85]], ['idido', [38.2, 6.25]],
		['yirgacheffe', [38.2, 6.16]], ['gedeb', [38.2, 6.02]], ['bensa', [38.9, 6.4]],
		['sidama', [38.5, 6.7]], ['guji', [38.9, 5.85]],
		['kirinyaga', [37.3, -0.5]], ['nyeri', [36.95, -0.42]],
		['bruselas', [-76.0, 1.9]], ['san sebastián de la plata', [-75.95, 2.0]],
		['buesaco', [-77.15, 1.38]], ['nariño', [-77.3, 1.6]], ['narino', [-77.3, 1.6]],
		['huila', [-75.9, 2.4]], ['tolima', [-75.4, 4.2]], ['anserma', [-75.8, 5.25]],
		['tarrazú', [-84.0, 9.65]], ['tarrazu', [-84.0, 9.65]],
		['san ignacio', [-79.0, -5.15]], ['cajamarca', [-78.8, -5.7]], ['jaén', [-78.8, -5.7]], ['jaen', [-78.8, -5.7]],
		['cosautlán', [-96.98, 19.33]], ['cosautlan', [-96.98, 19.33]], ['veracruz', [-96.98, 19.33]], ['chiapas', [-92.4, 15.4]],
		['copán', [-88.9, 14.85]], ['copan', [-88.9, 14.85]], ['santa bárbara', [-88.2, 15.0]], ['santa barbara', [-88.2, 15.0]],
		['barillas', [-90.5, 14.5]], ['chimaltenango', [-90.8, 14.75]], ['jilotepeque', [-90.8, 14.75]],
		['carmo de minas', [-45.13, -22.12]], ['mantiqueira', [-45.13, -22.12]], ['palmital', [-45.13, -22.12]],
		['cerrado', [-47.0, -19.0]], ['minas', [-45.5, -21.5]],
		['chikmagalur', [75.75, 13.3]], ['hulikere', [75.75, 13.3]], ['karnataka', [75.75, 13.3]],
		['lintong', [98.9, 2.35]], ['toba', [98.9, 2.6]], ['sumatra', [99.0, 2.5]],
		['kayanza', [29.6, -2.9]]
	];

	function coordFor(card) {
		var origin = '', d = card.querySelector('.coffee-details');
		if (d) {
			var divs = d.querySelectorAll('div');
			for (var i = 0; i < divs.length; i++) {
				if (/^Origin:/.test(divs[i].textContent)) { origin = divs[i].textContent; break; }
			}
		}
		var lo = origin.toLowerCase();
		for (var r = 0; r < REGIONS.length; r++) { if (lo.indexOf(REGIONS[r][0]) > -1) return REGIONS[r][1]; }
		var country = (card.dataset.origin || '').split('|')[0].trim();
		return COUNTRY[country] || null;
	}

	var depsPromise = null;
	function loadDeps() {
		if (depsPromise) return depsPromise;
		function s(src) {
			return new Promise(function (res, rej) {
				var e = document.createElement('script'); e.src = src; e.onload = res;
				e.onerror = function () { rej(new Error('load ' + src)); }; document.head.appendChild(e);
			});
		}
		depsPromise = s('js/d3.min.js').then(function () { return s('js/topojson-client.min.js'); })
			.then(function () { return fetch('data/countries-110m.json').then(function (r) { return r.json(); }); })
			.then(function (w) { return { d3: window.d3, topojson: window.topojson, world: w }; });
		return depsPromise;
	}

	var S = { built: false };

	function build(canvas, m) {
		var d3 = m.d3, topojson = m.topojson, world = m.world;
		var countries = topojson.feature(world, world.objects.countries).features;
		var borders = topojson.mesh(world, world.objects.countries, function (a, b) { return a !== b; });
		countries.forEach(function (f) { f._c = d3.geoCentroid(f); }); // cache centroids

		// Which countries have coffees (for label preference when zoomed out).
		var coffeeCountry = {};
		document.querySelectorAll('.coffee').forEach(function (c) {
			(c.dataset.origin || '').split('|').forEach(function (o) { if (o) coffeeCountry[o.trim()] = true; });
		});

		// Cluster coffees that share a growing region.
		var groups = {};
		document.querySelectorAll('.coffee').forEach(function (card) {
			var c = coordFor(card); if (!c) return;
			var key = c[0].toFixed(2) + ',' + c[1].toFixed(2);
			(groups[key] = groups[key] || { coord: c, cards: [] }).cards.push(card);
		});
		var markers = Object.keys(groups).map(function (k) { return groups[k]; });

		var svg = d3.select(canvas).append('svg').attr('class', 'coffee-map');
		var defs = svg.append('defs');
		var shade = defs.append('radialGradient').attr('id', 'globeShade').attr('cx', '50%').attr('cy', '42%').attr('r', '60%');
		shade.append('stop').attr('offset', '55%').attr('stop-color', 'var(--color-primary)').attr('stop-opacity', 0);
		shade.append('stop').attr('offset', '100%').attr('stop-color', 'var(--color-primary)').attr('stop-opacity', 0.14);

		var sphere = svg.append('circle').attr('class', 'map-sphere');
		var gLand = svg.append('g').attr('class', 'map-lands');
		var borderPath = svg.append('path').attr('class', 'map-border');
		var globeShade = svg.append('circle').attr('fill', 'url(#globeShade)').style('pointer-events', 'none');
		var gLabels = svg.append('g');
		var gMarkers = svg.append('g');

		var projection = d3.geoOrthographic().rotate([-12, -6]);
		var path = d3.geoPath(projection);
		var rotation = [-12, -6], baseScale = 1, zoomK = 1;

		gLand.selectAll('path').data(countries).join('path').attr('class', 'map-land').attr('vector-effect', 'non-scaling-stroke');
		var labelSel = gLabels.selectAll('text').data(countries).join('text').attr('class', 'map-country-label').text(function (f) { return f.properties.name; });

		var markerSel = gMarkers.selectAll('g').data(markers).join('g').attr('class', 'map-marker')
			.on('click', function (event, d) { event.stopPropagation(); if (window.openCoffeePanel) window.openCoffeePanel(d.cards); });
		markerSel.each(function (d) {
			var g = d3.select(this), n = d.cards.length;
			g.append('circle').attr('class', 'map-pin-hit').attr('r', 15);
			g.append('circle').attr('class', n > 1 ? 'map-cluster' : 'map-pin').attr('r', n > 1 ? 9 : 5);
			if (n > 1) g.append('text').attr('class', 'map-cluster-count').attr('text-anchor', 'middle')
				.attr('dominant-baseline', 'central').style('font-size', (n > 9 ? 8 : 10) + 'px').text(n);
		});

		function front(coord) { return d3.geoDistance(coord, [-rotation[0], -rotation[1]]) < Math.PI / 2 - 0.02; }

		function render() {
			var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
			baseScale = Math.min(w, h) / 2 - 4;
			var scale = baseScale * zoomK, cx = w / 2, cy = h / 2;
			svg.attr('width', w).attr('height', h);
			projection.scale(scale).translate([cx, cy]).rotate(rotation);
			sphere.attr('cx', cx).attr('cy', cy).attr('r', scale);
			globeShade.attr('cx', cx).attr('cy', cy).attr('r', scale);
			gLand.selectAll('path').attr('d', path);
			borderPath.attr('d', path(borders));
			var z = zoomK;
			labelSel.each(function (f) {
				var el = d3.select(this);
				var vis = front(f._c) && (z >= 2.6 || (z >= 1.5 && coffeeCountry[f.properties.name]));
				if (!vis) { el.style('display', 'none'); return; }
				var p = projection(f._c);
				el.style('display', null).attr('x', p[0]).attr('y', p[1]);
			});
			markerSel.each(function (d) {
				var el = d3.select(this);
				if (!front(d.coord)) { el.style('display', 'none'); return; }
				var p = projection(d.coord);
				el.style('display', S.filterHidden && S.filterHidden(d) ? 'none' : null)
					.attr('transform', 'translate(' + p[0] + ',' + p[1] + ')');
			});
		}

		svg.call(d3.drag().on('drag', function (event) {
			var k = 74 / (baseScale * zoomK);
			rotation[0] += event.dx * k;
			rotation[1] = Math.max(-90, Math.min(90, rotation[1] - event.dy * k));
			render();
		}));
		// Wheel (desktop) and two-finger pinch (touch) both drive d3.zoom's scale.
		var zoom = d3.zoom().scaleExtent([0.7, 6])
			.filter(function (e) { return e.type === 'wheel' || (e.touches && e.touches.length > 1); })
			.on('zoom', function (event) { zoomK = event.transform.k; render(); });
		svg.call(zoom).on('dblclick.zoom', null);

		// On-screen +/− controls so zoom works with a single tap on any device
		// (mobile pinch can be finicky). scaleBy runs through the same zoom
		// behavior, keeping its internal transform in sync with pinch/wheel.
		function zoomBy(f) { svg.transition().duration(180).call(zoom.scaleBy, f); }
		var controls = d3.select(canvas).append('div').attr('class', 'map-zoom');
		controls.append('button').attr('type', 'button').attr('class', 'map-zoom-btn')
			.attr('aria-label', 'Zoom in').text('+').on('click', function () { zoomBy(1.6); });
		controls.append('button').attr('type', 'button').attr('class', 'map-zoom-btn')
			.attr('aria-label', 'Zoom out').html('&minus;').on('click', function () { zoomBy(1 / 1.6); });

		S.filterHidden = function (d) { return !d.cards.some(function (c) { return c.style.display !== 'none'; }); };
		S.render = render;
		S.syncFilter = function () { markerSel.style('display', function (d) { return S.filterHidden(d) ? 'none' : null; }); render(); };
		S.built = true;
		render();
	}

	window.CoffeeMap = {
		preload: function () { return loadDeps(); },
		open: function (canvas) {
			return loadDeps().then(function (m) {
				if (!S.built) build(canvas, m);
				S.render(); S.syncFilter();
			}).catch(function (err) { canvas.innerHTML = '<p class="map-error">Couldn’t load the map.</p>'; throw err; });
		},
		resize: function () { if (S.built) S.render(); },
		syncFilter: function () { if (S.built && S.syncFilter) S.syncFilter(); }
	};
})();
