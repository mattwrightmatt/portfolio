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

		// Base points — coffees at the same growing region always share one marker
		// (they project to the same spot and can never be pulled apart). These are
		// then clustered by on-screen proximity every render (see render()), so
		// they split into pins as you zoom in and re-merge as you zoom out.
		var groups = {};
		document.querySelectorAll('.coffee').forEach(function (card) {
			var c = coordFor(card); if (!c) return;
			var key = c[0].toFixed(2) + ',' + c[1].toFixed(2);
			(groups[key] = groups[key] || { coord: c, cards: [] }).cards.push(card);
		});
		var points = Object.keys(groups).map(function (k) { return groups[k]; });

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
		// cx/cy: canvas centre; ox/oy: globe-centre offset so zoom can move the
		// pinched/pointed spot toward the middle (zoom-to-focal-point).
		var rotation = [-12, -6], baseScale = 1, zoomK = 1, cx = 0, cy = 0, ox = 0, oy = 0;

		gLand.selectAll('path').data(countries).join('path').attr('class', 'map-land').attr('vector-effect', 'non-scaling-stroke');
		var labelSel = gLabels.selectAll('text').data(countries).join('text').attr('class', 'map-country-label').text(function (f) { return f.properties.name; });

		function front(coord) { return d3.geoDistance(coord, [-rotation[0], -rotation[1]]) < Math.PI / 2 - 0.02; }
		function shown(card) { return card.style.display !== 'none'; }

		// Smallest gap (px) between two marker centres for them to stay separate;
		// closer than this and they merge into one cluster so nothing overlaps.
		var CLUSTER_GAP = 34;
		// Teardrop pin (rounded top, pointy bottom) with its tip at the anchor.
		var TEARDROP = 'M0,0 C-4.4,-8 -8,-11.5 -8,-18 a8,8 0 1,1 16,0 C8,-11.5 4.4,-8 0,0 Z';

		function sameCoord(a, b) { return a[0] === b[0] && a[1] === b[1]; }
		function clusterGeo(c) {
			var lon = 0, lat = 0;
			c.pts.forEach(function (v) { lon += v.coord[0]; lat += v.coord[1]; });
			return [lon / c.pts.length, lat / c.pts.length];
		}
		// Agglomerative clustering: start one cluster per screen point, then merge
		// the closest pair while they'd overlap. On termination every cluster is at
		// least CLUSTER_GAP from the rest, so nothing overlaps. Zooming spreads the
		// points apart → clusters split.
		function agglomerate(pts) {
			var clusters = pts.map(function (v) { return { x: v.x, y: v.y, n: v.cards ? v.cards.length : 1, pts: [v] }; });
			var merging = true;
			while (merging && clusters.length > 1) {
				merging = false;
				var bi = -1, bj = -1, bd = CLUSTER_GAP;
				for (var i = 0; i < clusters.length; i++) {
					for (var j = i + 1; j < clusters.length; j++) {
						var d = Math.hypot(clusters[i].x - clusters[j].x, clusters[i].y - clusters[j].y);
						if (d < bd) { bd = d; bi = i; bj = j; }
					}
				}
				if (bi > -1) {
					var a = clusters[bi], b = clusters[bj], na = a.n, nb = b.n;
					a.x = (a.x * na + b.x * nb) / (na + nb);
					a.y = (a.y * na + b.y * nb) / (na + nb);
					a.n = na + nb; a.pts = a.pts.concat(b.pts);
					clusters.splice(bj, 1);
					merging = true;
				}
			}
			return clusters;
		}
		// Zoom at which a cluster's points first break into 2+ markers — centred on
		// the cluster so tapping jumps straight to where it branches.
		function branchZoom(members, g) {
			var proj = d3.geoOrthographic().rotate([-g[0], -g[1]]).translate([0, 0]);
			for (var zt = zoomK * 1.2; zt < MAX_Z; zt *= 1.2) {
				proj.scale(baseScale * zt);
				var pts = members.map(function (m) { var p = proj(m.coord); return { x: p[0], y: p[1] }; });
				if (agglomerate(pts).length > 1) return Math.min(MAX_Z, zt * 1.15);
			}
			return MAX_Z;
		}

		function drawMarkers() {
			// Project every front-facing base point (only its currently-visible cards).
			var vis = [];
			points.forEach(function (pt) {
				if (!front(pt.coord)) return;
				var cards = pt.cards.filter(shown);
				if (!cards.length) return;
				var p = projection(pt.coord);
				vis.push({ x: p[0], y: p[1], coord: pt.coord, cards: cards });
			});
			var clusters = agglomerate(vis);
			var selCards = S.selectedCards;
			var sel = gMarkers.selectAll('g.map-marker').data(clusters);
			sel.exit().remove();
			var ent = sel.enter().append('g').attr('class', 'map-marker');
			ent.append('circle').attr('class', 'map-pin-hit').attr('r', 16);
			ent.append('path').attr('class', 'map-pin-teardrop').attr('d', TEARDROP);
			ent.append('circle').attr('class', 'map-dot');
			ent.append('text').attr('class', 'map-cluster-count').attr('text-anchor', 'middle').attr('dominant-baseline', 'central');
			ent.on('click', function (event, c) { event.stopPropagation(); tapCluster(c); });
			ent.merge(sel).attr('transform', function (c) { return 'translate(' + c.x + ',' + c.y + ')'; })
				.each(function (c) {
					var g = d3.select(this), multi = c.n > 1;
					var isSel = selCards && c.pts.some(function (v) { return v.cards.some(function (cd) { return selCards.indexOf(cd) > -1; }); });
					var teardrop = isSel && !multi;
					g.select('.map-pin-teardrop').style('display', teardrop ? null : 'none');
					g.select('.map-dot').style('display', teardrop ? 'none' : null)
						.attr('class', 'map-dot ' + (multi ? 'map-cluster' : 'map-pin')).attr('r', multi ? 9 : 5);
					var txt = g.select('.map-cluster-count');
					if (multi) txt.style('display', null).style('font-size', (c.n > 9 ? 8 : 10) + 'px').text(c.n);
					else txt.style('display', 'none');
				});
		}

		function render() {
			var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
			// Centre the globe horizontally on the page and vertically within the
			// area below the filters (inset set from the page); size it to fit there.
			var inset = S.topInset || 0;
			baseScale = Math.min(w, h - inset) / 2 - 4;
			var scale = baseScale * zoomK;
			cx = w / 2; cy = inset + (h - inset) / 2;
			var gx = cx + ox, gy = cy + oy;
			svg.attr('width', w).attr('height', h);
			projection.scale(scale).translate([gx, gy]).rotate(rotation);
			sphere.attr('cx', gx).attr('cy', gy).attr('r', scale);
			globeShade.attr('cx', gx).attr('cy', gy).attr('r', scale);
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
			drawMarkers();
		}

		// One d3.zoom drives both rotation and scale, so touch gestures never have
		// to fight two competing behaviors (the old drag + zoom split let pinch get
		// swallowed by the drag). A single-pointer drag rotates the globe (the pan
		// translation is read as a rotation delta). Wheel and two-finger pinch
		// change the scale and zoom toward the cursor / pinch centroid: the globe
		// centre is nudged so the point under the gesture stays put. Programmatic
		// (button) zooms have no focal point, so they zoom about the middle.
		var tx = 0, ty = 0;
		// Drag inertia: track the latest rotational velocity (deg/ms) so the globe
		// keeps spinning briefly after you let go, easing to a stop.
		var vLon = 0, vLat = 0, moveT = 0, spinRAF = null, wasDrag = false;
		function stopSpin() { if (spinRAF) { cancelAnimationFrame(spinRAF); spinRAF = null; } }
		function spin(prev) {
			var now = performance.now(), dt = Math.min(now - prev, 50);
			rotation[0] += vLon * dt;
			rotation[1] = Math.max(-90, Math.min(90, rotation[1] + vLat * dt));
			var decay = Math.exp(-dt / 300); // eases to a stop in roughly a second
			vLon *= decay; vLat *= decay;
			render();
			if (Math.abs(vLon) > 0.003 || Math.abs(vLat) > 0.003) {
				spinRAF = requestAnimationFrame(function () { spin(now); });
			} else { spinRAF = null; }
		}
		// Idle auto-rotation: after a few seconds with no interaction, drift east
			// at ~1 rpm (the way the Earth turns) until the next gesture.
			var idleRAF = null, idleTimer = null, idleStopped = false, idleT = 0;
			function idleStep() {
				if (idleStopped || !canvas.clientWidth) { idleRAF = null; return; }  // stopped for good / map hidden
				var now = performance.now();
				rotation[0] += 0.006 * (now - idleT);  // 0.006 deg/ms = 360°/60s = 1 rpm
				idleT = now;
				render();
				idleRAF = requestAnimationFrame(idleStep);
			}
			function startIdle() { if (idleStopped || idleRAF) return; idleT = performance.now(); idleRAF = requestAnimationFrame(idleStep); }
			function stopIdle() { if (idleRAF) { cancelAnimationFrame(idleRAF); idleRAF = null; } }
			// The first real interaction kills idle spin permanently (until reload).
			function killIdle() { idleStopped = true; if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; } stopIdle(); }
			// Schedule the initial spin (a no-op once killed).
			function bumpIdle() {
				if (idleStopped) return;
				if (idleTimer) clearTimeout(idleTimer);
				idleTimer = setTimeout(startIdle, 2500);
			}

			var MAX_Z = 64;
		var zoom = d3.zoom().scaleExtent([0.7, MAX_Z])
			.on('start', function (event) {
				stopSpin(); killIdle(); vLon = vLat = 0; wasDrag = false;
				moveT = performance.now(); tx = event.transform.x; ty = event.transform.y;
			})
			.on('end', function () {
				bumpIdle();
					// Spin on release only if the flick was recent (not a hold-then-lift).
				if (wasDrag && performance.now() - moveT < 90 && (Math.abs(vLon) > 0.003 || Math.abs(vLat) > 0.003)) {
					spinRAF = requestAnimationFrame(function () { spin(performance.now()); });
				}
			})
			.on('zoom', function (event) {
				var t = event.transform, se = event.sourceEvent;
				var drag = se && se.type !== 'wheel' && !(se.touches && se.touches.length > 1);
				if (drag) {
					var kf = 74 / (baseScale * zoomK);
					var dLon = (t.x - tx) * kf, dLat = -(t.y - ty) * kf;
					rotation[0] += dLon;
					rotation[1] = Math.max(-90, Math.min(90, rotation[1] + dLat));
					var now = performance.now(), dt = now - moveT;
					if (dt > 0) {
						// Blend toward the instantaneous velocity so a flick reads cleanly.
						var f = Math.min(dt / 40, 1), cap = 0.15;
						vLon += (dLon / dt - vLon) * f;
						vLat += (dLat / dt - vLat) * f;
						vLon = Math.max(-cap, Math.min(cap, vLon));
						vLat = Math.max(-cap, Math.min(cap, vLat));
						moveT = now;
					}
					wasDrag = true;
				} else {
					var r = t.k / zoomK;
					// Zoom IN toward the cursor / pinch centroid; zoom OUT toward the
					// centre so the globe always eases back to centred (no drift).
					var fx = cx, fy = cy, pts = (r > 1 && se) ? d3.pointers(se, canvas) : [];
					if (pts.length) {
						fx = 0; fy = 0;
						pts.forEach(function (q) { fx += q[0]; fy += q[1]; });
						fx /= pts.length; fy /= pts.length;
					}
					// Keep the focal point fixed as scale changes by r (rotation held).
					ox = fx + r * (cx + ox - fx) - cx;
					oy = fy + r * (cy + oy - fy) - cy;
					zoomK = t.k;
					// Bound the offset so the globe stays in view and re-centres on
					// zoom-out (never negative, or it would shove the globe sideways).
					var m = baseScale * Math.max(0, zoomK - 1);
					ox = Math.max(-m, Math.min(m, ox));
					oy = Math.max(-m, Math.min(m, oy));
				}
				tx = t.x; ty = t.y;
				render();
			});
		svg.call(zoom).on('dblclick.zoom', null);

		// On-screen +/− controls so zoom works with a single tap on any device.
		// scaleBy runs through the same behavior (its sourceEvent is null, so it
		// only changes scale), keeping the transform in sync with pinch/wheel.
		function zoomBy(f) { svg.transition().duration(180).call(zoom.scaleBy, f); }
		var controls = d3.select(canvas).append('div').attr('class', 'map-zoom');
		controls.append('button').attr('type', 'button').attr('class', 'map-zoom-btn')
			.attr('aria-label', 'Zoom in').text('+').on('click', function () { zoomBy(1.6); });
		controls.append('button').attr('type', 'button').attr('class', 'map-zoom-btn')
			.attr('aria-label', 'Zoom out').html('&minus;').on('click', function () { zoomBy(1 / 1.6); });

		// Smoothly fly to a rotation / zoom / offset (used to drill into a cluster).
		// Keeps d3.zoom's stored scale in sync at the end.
		var animRAF = null;
		function syncZoom() { svg.node().__zoom = d3.zoomIdentity.scale(zoomK); }
		function animateTo(rot, zK, oX, oY, ms) {
			stopSpin(); killIdle(); if (animRAF) cancelAnimationFrame(animRAF);
			var r0 = rotation.slice(), z0 = zoomK, x0 = ox, y0 = oy, t0 = performance.now();
			var dLon = (((rot[0] - r0[0]) % 360) + 540) % 360 - 180, dLat = rot[1] - r0[1];
			function stepA() {
				var p = Math.min((performance.now() - t0) / ms, 1);
				var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
				rotation[0] = r0[0] + dLon * e;
				rotation[1] = Math.max(-90, Math.min(90, r0[1] + dLat * e));
				zoomK = z0 + (zK - z0) * e;
				ox = x0 + (oX - x0) * e; oy = y0 + (oY - y0) * e;
				render();
				if (p < 1) animRAF = requestAnimationFrame(stepA);
				else { animRAF = null; syncZoom(); }
			}
			animRAF = requestAnimationFrame(stepA);
		}

		// Tapping a marker: a leaf — a single coffee, or a cluster that can't split
		// (all its coffees share one spot, or we're already at max zoom) — opens its
		// coffee(s) in a modal. Any other cluster flies in and zooms on itself so it
		// breaks apart, so repeated taps drill down until a leaf is reached.
		function tapCluster(c) {
			var identical = c.pts.every(function (v) { return sameCoord(v.coord, c.pts[0].coord); });
			if (c.n === 1 || identical || zoomK >= MAX_Z - 0.5) {
				var cards = [];
				c.pts.forEach(function (v) { v.cards.forEach(function (cd) { cards.push(cd); }); });
				S.selectedCards = cards;
				killIdle();
				render();
				if (window.openCoffeePanel) window.openCoffeePanel(cards);
			} else {
				var g = clusterGeo(c);
				animateTo([-g[0], -g[1]], branchZoom(c.pts, g), 0, 0, 520);
			}
		}

		S.render = render;
		S.syncFilter = function () { render(); };
		S.deselect = function () { S.selectedCards = null; render(); };
		S.bumpIdle = bumpIdle;
		S.stopIdle = stopIdle;
		S.built = true;
		render();
		bumpIdle();
	}

	window.CoffeeMap = {
		preload: function () { return loadDeps(); },
		open: function (canvas) {
			return loadDeps().then(function (m) {
				if (!S.built) build(canvas, m);
				S.render(); S.syncFilter(); if (S.bumpIdle) S.bumpIdle();
			}).catch(function (err) { canvas.innerHTML = '<p class="map-error">Couldn’t load the map.</p>'; throw err; });
		},
		resize: function () { if (S.built) S.render(); },
		syncFilter: function () { if (S.built && S.syncFilter) S.syncFilter(); },
		deselect: function () { if (S.built && S.deselect) S.deselect(); },
		setInset: function (px) { S.topInset = px; if (S.built) S.render(); },
		stopIdle: function () { if (S.built && S.stopIdle) S.stopIdle(); }
	};
})();
