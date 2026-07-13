/* Coffee origin map — a minimal world map (borders, country + water labels)
   drawn from bundled Natural Earth data with d3-geo, styled by the page's CSS.
   d3 + topojson + the world file are loaded lazily the first time Map view is
   opened, so Card-view visitors never download them. Pins mark the approximate
   origin of each coffee; tapping one opens that coffee's card as a modal
   (via window.openCoffeeModal, defined on the page). */
(function () {
	'use strict';

	// Approximate coffee-growing coordinates per country [lng, lat].
	var ORIGIN = {
		'Ethiopia': [38.5, 6.8], 'Colombia': [-75.6, 3.8], 'Kenya': [37.3, -0.5],
		'Brazil': [-46.3, -21.2], 'Guatemala': [-90.9, 14.7], 'Costa Rica': [-83.9, 9.6],
		'Peru': [-78.6, -6.1], 'Mexico': [-92.3, 15.6], 'Honduras': [-88.4, 14.9],
		'Indonesia': [99.0, 2.6], 'India': [75.7, 13.0], 'Myanmar': [96.6, 21.4],
		'Burundi': [29.7, -2.9]
	};
	// Major water bodies to label [lng, lat].
	var WATERS = [
		{ name: 'Pacific Ocean', at: [-150, 0] },
		{ name: 'Atlantic Ocean', at: [-33, 8] },
		{ name: 'Indian Ocean', at: [76, -28] },
		{ name: 'Pacific Ocean', at: [165, 8] }
	];

	var depsPromise = null;
	function loadDeps() {
		if (depsPromise) return depsPromise;
		function script(src) {
			return new Promise(function (res, rej) {
				var s = document.createElement('script');
				s.src = src;
				s.onload = res;
				s.onerror = function () { rej(new Error('Failed to load ' + src)); };
				document.head.appendChild(s);
			});
		}
		depsPromise = script('js/d3.min.js')
			.then(function () { return script('js/topojson-client.min.js'); })
			.then(function () { return fetch('data/countries-110m.json').then(function (r) { return r.json(); }); })
			.then(function (world) { return { d3: window.d3, topojson: window.topojson, world: world }; });
		return depsPromise;
	}

	var api = { built: false, render: null, syncFilter: null };

	function build(container) {
		return loadDeps().then(function (m) {
			var d3 = m.d3, topojson = m.topojson, world = m.world;
			var countries = topojson.feature(world, world.objects.countries);
			var borders = topojson.mesh(world, world.objects.countries, function (a, b) { return a !== b; });
			var byName = {};
			countries.features.forEach(function (f) { byName[f.properties.name] = f; });

			var svg = d3.select(container).append('svg').attr('class', 'coffee-map');
			var gZoom = svg.append('g').attr('class', 'map-zoom');
			var gLand = gZoom.append('g');
			var borderPath = gZoom.append('path').attr('class', 'map-border');
			var gWater = gZoom.append('g');
			var gCountry = gZoom.append('g');
			var gPins = gZoom.append('g');

			var projection = d3.geoNaturalEarth1();
			var path = d3.geoPath(projection);

			// Land
			gLand.selectAll('path').data(countries.features).join('path').attr('class', 'map-land');

			// Country labels (only the coffee-origin countries, to stay uncluttered)
			var labelCountries = Object.keys(ORIGIN).filter(function (n) { return byName[n]; });
			gCountry.selectAll('text').data(labelCountries).join('text')
				.attr('class', 'map-country-label').text(function (n) { return n; });

			// Water labels
			gWater.selectAll('text').data(WATERS).join('text')
				.attr('class', 'map-water-label').text(function (d) { return d.name; });

			// Pins — one per coffee that has a known origin country
			var perCountry = {};
			var pinData = [];
			document.querySelectorAll('.coffee').forEach(function (card) {
				var origin = (card.dataset.origin || '').split('|')[0].trim();
				var base = ORIGIN[origin];
				if (!base) return;
				var k = perCountry[origin] || 0;
				perCountry[origin] = k + 1;
				// sunflower spread so multiple pins from one country fan out
				var ang = k * 2.399963, rad = 0.6 * Math.sqrt(k);
				var lat = base[1] + rad * Math.sin(ang);
				var lng = base[0] + rad * Math.cos(ang) / Math.max(0.35, Math.cos(base[1] * Math.PI / 180));
				pinData.push({ card: card, coord: [lng, lat] });
			});

			var pinsFC = { type: 'FeatureCollection', features: pinData.map(function (d) {
				return { type: 'Feature', geometry: { type: 'Point', coordinates: d.coord } };
			}) };

			var pins = gPins.selectAll('g').data(pinData).join('g').attr('class', 'map-pin')
				.on('click', function (event, d) {
					event.stopPropagation();
					if (window.openCoffeeModal) window.openCoffeeModal(d.card);
				});
			pins.append('circle').attr('class', 'map-pin-hit').attr('r', 14); // touch target
			pins.append('circle').attr('class', 'map-pin-dot').attr('r', 5);

			var k = 1; // current zoom scale

			function place() {
				var w = container.clientWidth, h = container.clientHeight;
				if (!w || !h) return;
				svg.attr('width', w).attr('height', h).attr('viewBox', '0 0 ' + w + ' ' + h);
				projection.fitExtent([[14, 14], [w - 14, h - 14]], countries);
				gLand.selectAll('path').attr('d', path);
				borderPath.attr('d', path(borders));
				gCountry.selectAll('text').attr('transform', function (n) {
					var c = path.centroid(byName[n]); return 'translate(' + c[0] + ',' + c[1] + ')';
				});
				gWater.selectAll('text').attr('transform', function (d) {
					var p = projection(d.at); return 'translate(' + p[0] + ',' + p[1] + ')';
				});
				pins.attr('transform', function (d) {
					var p = projection(d.coord); return 'translate(' + p[0] + ',' + p[1] + ')';
				});
				// Frame the coffee belt: zoom so all origin pins fill the container
				// (still showing the whole world, just larger and less empty).
				if (pinData.length) {
					var pad = 36;
					var bb = path.bounds(pinsFC);
					var bw = bb[1][0] - bb[0][0], bh = bb[1][1] - bb[0][1];
					var k0 = Math.max(1, Math.min(6, 0.95 * Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh)));
					var cx = (bb[0][0] + bb[1][0]) / 2, cy = (bb[0][1] + bb[1][1]) / 2;
					svg.call(zoom.transform, d3.zoomIdentity.translate(w / 2 - k0 * cx, h / 2 - k0 * cy).scale(k0));
				} else {
					scaleOverlays();
				}
			}

			// Keep labels/pins a constant visual size regardless of zoom.
			function scaleOverlays() {
				gCountry.selectAll('text').style('font-size', (13 / k) + 'px');
				gWater.selectAll('text').style('font-size', (13 / k) + 'px');
				gPins.selectAll('.map-pin-dot').attr('r', 5 / k);
				gPins.selectAll('.map-pin-hit').attr('r', 14 / k);
			}

			var zoom = d3.zoom().scaleExtent([1, 12]).on('zoom', function (event) {
				gZoom.attr('transform', event.transform);
				k = event.transform.k;
				scaleOverlays();
			});
			svg.call(zoom).on('dblclick.zoom', null);

			api.render = place;
			api.syncFilter = function () {
				pins.style('display', function (d) {
					return d.card.style.display === 'none' ? 'none' : null;
				});
			};
			api.built = true;
			place();
			api.syncFilter();
		});
	}

	window.CoffeeMap = {
		open: function (container) {
			if (api.built) { api.render(); api.syncFilter(); return Promise.resolve(); }
			return build(container).catch(function (err) {
				container.innerHTML = '<p class="map-error">Couldn’t load the map.</p>';
				throw err;
			});
		},
		resize: function () { if (api.built && api.render) api.render(); },
		syncFilter: function () { if (api.built && api.syncFilter) api.syncFilter(); }
	};
})();
