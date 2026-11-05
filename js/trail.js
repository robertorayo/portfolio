/* ==========================================================================
   LÍNEA DE TRAYECTORIA AL SCROLL
   - Curvas entre estaciones (marcadas con data-trail-station)
   - Se divide por los bordes de las tarjetas marcadas con data-trail-card
   - Estela con degradado, chispas, ondas en cada estación e indicador de progreso
   - Máscara SVG que atenúa el haz cuando pasa por detrás de texto
   ========================================================================== */
(function () {
    'use strict';

    const SVGNS = 'http://www.w3.org/2000/svg';
    const $ = (id) => document.getElementById(id);
    const svg = $('trek-trail-svg');
    const guidesG = $('trek-guides'), glowsG = $('trek-glows'), coresG = $('trek-cores'), tailsG = $('trek-tails');
    const nodesG = $('trek-nodes-group'), partsG = $('trek-particles'), hudG = $('trek-hud');
    const head1 = $('trek-comet-head-1'), head2 = $('trek-comet-head-2');
    const textMask = $('trekTextMask'), maskBase = $('trek-mask-base'), maskOuter = $('trek-mask-outer'), maskInner = $('trek-mask-inner');
    if (!svg || !guidesG || !glowsG || !coresG || !tailsG || !head1 || !head2) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    // Estela: longitud (px), grosor, opacidad. De más larga y tenue a más corta y brillante.
    const TAILS = [
        { L: 520, w: 2.4, o: 0.5 },
        { L: 240, w: 3.2, o: 0.75 },
        { L: 110, w: 4.4, o: 0.92 },
        { L: 40, w: 6.2, o: 1 }
    ];

    let segments = [], stations = [];
    let obstacles = [], pageW = 1440;
    // Los obstáculos se agrupan por filas de 120 px para consultarlos rápido
    const OBS_ROW = 120;
    let obsRows = new Map(), obsStamp = 0;
    function indexObstacles() {
        obsRows = new Map();
        obstacles.forEach((o) => {
            o._s = 0;
            const a = Math.floor(o.y / OBS_ROW), b = Math.floor((o.y + o.h) / OBS_ROW);
            for (let r = a; r <= b; r++) { let l = obsRows.get(r); if (!l) { l = []; obsRows.set(r, l); } l.push(o); }
        });
    }
    function boxOverlap(L, T, R, B) {
        let sum = 0;
        obsStamp++;
        const a = Math.floor(T / OBS_ROW), b = Math.floor(B / OBS_ROW);
        for (let r = a; r <= b; r++) {
            const list = obsRows.get(r);
            if (!list) continue;
            for (let i = 0; i < list.length; i++) {
                const o = list[i];
                if (o._s === obsStamp) continue;
                o._s = obsStamp;
                const ox = Math.min(R, o.x + o.w) - Math.max(L, o.x);
                if (ox <= 0) continue;
                const oy = Math.min(B, o.y + o.h) - Math.max(T, o.y);
                if (oy > 0) sum += ox * oy * (o.k || 1.5);
            }
        }
        return sum;
    }
    let startY = 0, endY = 0, finaleY = Infinity;
    let hud = null;

    const sectionDefs = [
        { pill: '#proyecto .spotlight-pill', title: '#proyecto .section-title' },
        { pill: '#sobre-mi .section-tag', title: '#sobre-mi .section-heading' },
        { pill: '#habilidades .section-tag', title: '#habilidades .section-heading' },
        { pill: '#metodo .section-tag', title: '#metodo .section-heading' },
        { pill: '#contacto .section-tag', title: '#contacto .contact-title' }
    ].map((d) => ({ pill: document.querySelector(d.pill), title: document.querySelector(d.title) }));

    const absRect = (el) => {
        const r = el.getBoundingClientRect();
        return { L: r.left + window.scrollX, R: r.right + window.scrollX, T: r.top + window.scrollY, B: r.bottom + window.scrollY };
    };
    const mk = (tag, attrs, parent) => {
        const n = document.createElementNS(SVGNS, tag);
        Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k]));
        if (parent) parent.appendChild(n);
        return n;
    };

    function makeCurve(pts) {
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i], p1 = pts[i + 1], my = p0.y + (p1.y - p0.y) * 0.5;
            d += ` C ${p0.x} ${my}, ${p1.x} ${my}, ${p1.x} ${p1.y}`;
        }
        return d;
    }

    /* ---------- Pistas (guía + resplandor + núcleo + estela) ---------- */
    function makeTrack(d) {
        const glow = mk('path', { class: 'trek-path-glow', d, filter: 'url(#trekGlowFilter)' }, glowsG);
        const core = mk('path', { class: 'trek-path-core', d }, coresG);
        const len = core.getTotalLength();
        const tails = TAILS.map((t) => {
            const p = mk('path', { class: 'trek-tail', d }, tailsG);
            p.style.strokeWidth = t.w + 'px';
            p.style.opacity = '0';
            return p;
        });
        [glow, core].forEach((p) => { p.style.strokeDasharray = `${len} ${len + 4}`; });
        const track = { core, glow, tails, len, _k: '' };
        setProgress(track, 0, 0);
        return track;
    }

    function setProgress(track, dist, virt) {
        const key = dist.toFixed(1) + '|' + virt.toFixed(1);
        if (key === track._k) return;
        track._k = key;
        const off = dist <= 0 ? track.len + 2 : Math.max(0, track.len - dist);
        track.core.style.strokeDashoffset = off;
        track.glow.style.strokeDashoffset = off;
        const big = track.len * 2 + 10;
        TAILS.forEach((t, i) => {
            const p = track.tails[i];
            const start = Math.max(0, virt - t.L), end = Math.min(track.len, virt);
            const seg = end - start;
            if (seg < 0.6 || virt <= 0) { p.style.opacity = '0'; return; }
            p.style.strokeDasharray = `${seg} ${big}`;
            p.style.strokeDashoffset = `${-start}`;
            p.style.opacity = t.o;
        });
    }

    /* ---------- Waypoints desde el DOM ---------- */
    function collectWaypoints(width, isMobile) {
        const items = [];
        document.querySelectorAll('[data-trail-station]').forEach((el) => {
            const r = absRect(el);
            items.push({
                kind: 'pt', sortY: r.T,
                x: isMobile ? 14 : Math.max(40, r.L - 28),
                y: (r.T + r.B) / 2,
                station: parseInt(el.getAttribute('data-trail-station'), 10)
            });
        });
        document.querySelectorAll('[data-trail-card]').forEach((el) => {
            const v = el.getAttribute('data-trail-card');
            items.push({ kind: 'card', el, sortY: absRect(el).T, station: v === '' ? undefined : parseInt(v, 10) });
        });
        items.sort((a, b) => a.sortY - b.sortY);
        return items;
    }

    /* ---------- Máscara bajo texto ---------- */
    function buildMask(W, H) {
        if (!textMask || !maskBase) return;
        [textMask, maskBase].forEach((n) => { n.setAttribute('width', W); n.setAttribute('height', H); });
        maskOuter.innerHTML = ''; maskInner.innerHTML = '';
        const rects = [];
        const root = document.querySelector('.main-content');
        if (root) {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
                acceptNode: (n) => {
                    if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                    const p = n.parentElement;
                    if (!p || p.closest('.glass-card, .marquee-strip-wrapper, .hero-stage')) return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            });
            const range = document.createRange();
            while (walker.nextNode()) {
                range.selectNodeContents(walker.currentNode);
                for (const r of range.getClientRects()) {
                    if (r.width < 1 || r.height < 1) continue;
                    rects.push({ x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height, k: 1.5 });
                }
            }
            root.querySelectorAll('.section-tag, .spotlight-pill, .hero-badge, .marquee-strip-wrapper').forEach((el) => {
                if (el.closest('.glass-card')) return;
                const r = absRect(el);
                rects.push({ x: r.L, y: r.T, w: r.R - r.L, h: r.B - r.T, k: el.matches('.marquee-strip-wrapper') ? 5 : 10, g: el.matches('.marquee-strip-wrapper') ? 6 : 8 });
            });
        }
        // Obstáculos para colocar el indicador de progreso donde menos estorbe
        obstacles = rects.map((r) => Object.assign({}, r));
        document.querySelectorAll('.glass-card').forEach((el) => {
            if (el.closest('.navbar-wrapper')) return;
            const r = absRect(el);
            obstacles.push({ x: r.L, y: r.T, w: r.R - r.L, h: r.B - r.T, k: 10, g: 2 });
        });
        const foot = document.querySelector('.footer');
        if (foot) { const r = absRect(foot); obstacles.push({ x: r.L, y: r.T, w: r.R - r.L, h: r.B - r.T, k: 10, g: 12 }); }
        obstacles.forEach((o) => { const g = o.g || 0; if (g) { o.x -= g; o.y -= g; o.w += g * 2; o.h += g * 2; } });
        indexObstacles();
        const add = (g, r, pad, rx, fill) => mk('rect', { x: r.x - pad, y: r.y - pad, width: r.w + pad * 2, height: r.h + pad * 2, rx, fill }, g);
        rects.forEach((r) => add(maskOuter, r, 16, 18, '#9a9a9a'));
        rects.forEach((r) => add(maskInner, r, 5, 8, '#262626'));
    }

    /* ---------- Construcción ---------- */
    function buildTrail() {
        document.documentElement.classList.add('trek-measuring');

        const width = document.documentElement.clientWidth;
        pageW = width;
        const isMobile = width <= 800;
        const docH = document.documentElement.scrollHeight;

        [guidesG, glowsG, coresG, tailsG, nodesG].forEach((g) => { g.innerHTML = ''; });
        segments = []; stations = []; finaleY = Infinity;

        const heroSec = $('inicio');
        const footer = document.querySelector('.footer');
        const startPt = { kind: 'pt', x: width * 0.5, y: heroSec ? absRect(heroSec).B + 90 : 900 };
        const endPt = { kind: 'pt', x: width * 0.5, y: footer ? absRect(footer).T - 3 : docH - 60 };
        const waypoints = [startPt, ...collectWaypoints(width, isMobile), endPt];

        const addStation = (x, y, idx) => {
            const ripple = mk('circle', { cx: x, cy: y, r: 8, class: 'trek-ripple' }, nodesG);
            const ring = mk('circle', { cx: x, cy: y, r: 9, class: 'trek-node' }, nodesG);
            const dot = mk('circle', { cx: x, cy: y, r: 3.6, class: 'trek-node-dot' }, nodesG);
            stations.push({ ring, dot, ripple, y, idx, on: false });
        };

        let splitCount = 0;
        let pts = [];
        const flush = () => {
            if (pts.length >= 2) segments.push({ type: 'curve', track: makeTrack(makeCurve(pts)), y0: pts[0].y, y1: pts[pts.length - 1].y, pref: 'R' });
            pts = [];
        };
        const push = (p) => {
            const last = pts[pts.length - 1];
            if (last && p.y <= last.y + 8) return false;
            pts.push(p);
            return true;
        };

        waypoints.forEach((wp) => {
            if (wp.kind === 'pt') {
                if (push(wp) && wp.station !== undefined) addStation(wp.x, wp.y, wp.station);
                return;
            }
            const r = absRect(wp.el), o = 1.5;
            const L = r.L - o, R = r.R + o, T = r.T - o, B = r.B + o, CX = (L + R) / 2;
            const cssRad = parseFloat(getComputedStyle(wp.el).borderTopLeftRadius) || 20;
            const rad = Math.max(1, Math.min(cssRad + o, (R - L) / 2 - 1, (B - T) / 2 - 1));
            if (!push({ x: CX, y: T })) return;
            flush();
            const dL = `M ${CX} ${T} H ${L + rad} A ${rad} ${rad} 0 0 0 ${L} ${T + rad} V ${B - rad} A ${rad} ${rad} 0 0 0 ${L + rad} ${B} H ${CX}`;
            const dR = `M ${CX} ${T} H ${R - rad} A ${rad} ${rad} 0 0 1 ${R} ${T + rad} V ${B - rad} A ${rad} ${rad} 0 0 1 ${R - rad} ${B} H ${CX}`;
            segments.push({ type: 'split', L: makeTrack(dL), R: makeTrack(dR), y0: T, y1: B, pref: (splitCount++ % 2 === 0) ? 'R' : 'L' });
            if (wp.station !== undefined) {
                addStation(CX, T, wp.station);
                if (wp.station === 4) finaleY = T;
            }
            pts = [{ x: CX, y: B }];
        });
        flush();

        startY = segments.length ? segments[0].y0 : 0;
        endY = segments.length ? segments[segments.length - 1].y1 : docH;

        const wrapper = document.querySelector('.page-wrapper');
        buildMask(width, wrapper ? wrapper.scrollHeight : docH);
        planHud();

        document.documentElement.classList.remove('trek-measuring');
    }

    /* ---------- HUD de progreso ---------- */
    // La etiqueta del porcentaje orbita alrededor de la bola y se coloca en una de 4 posiciones diagonales
    const HUD_R = 74, HUD_BW = 54, HUD_BH = 22, PLAN_STEP = 16, SW_X = 24000, SW_Y = 14000, HUD_MS = 360;
    const HUD_LEAD_S = 0.2, HUD_LEAD_MAX = 200;   // anticipación: el cambio empieza antes, según la velocidad del scroll
    // [lado x, lado y]: -1 = izquierda/arriba, 1 = derecha/abajo. Las cuatro últimas (casi horizontales) solo se
    // usan cuando las diagonales quedarían tapadas, por ejemplo en el hueco estrecho entre dos tarjetas.
    const STATES = [[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, -0.26], [1, -0.26], [-1, 0.26], [1, 0.26]];
    const NS = STATES.length, HORIZ_BIAS = 1200;
    const stIdx = (sx, sy) => STATES.findIndex((q) => q[0] === sx && q[1] === sy);
    const stAngle = (i) => Math.atan2(STATES[i][1] * 0.5, STATES[i][0] * 0.866);   // ±30° respecto a la horizontal
    const stCenter = (i) => { const a = stAngle(i); return [HUD_R * Math.cos(a), HUD_R * Math.sin(a)]; };

    function buildHud() {
        if (!hudG) return;
        hudG.innerHTML = '';
        const line = mk('line', { class: 'trek-hud-line' }, hudG);
        const box = mk('rect', { width: HUD_BW, height: HUD_BH, rx: HUD_BH / 2, class: 'trek-hud-box' }, hudG);
        const pct = mk('text', { class: 'trek-hud-pct', 'text-anchor': 'middle' }, hudG);
        hud = { line, box, pct, last: '', init: false, ang: 0, from: 0, delta: 0, to: 0, t0: 0, raf: 0, p: { x: 0, y: 0 } };
    }

    // Dibuja la etiqueta en el ángulo actual: conector recto desde la bola hasta el borde de la etiqueta
    function renderHud() {
        if (!hud) return;
        const a = hud.ang, ca = Math.cos(a), sa = Math.sin(a);
        const cx = HUD_R * ca, cy = HUD_R * sa;
        const ex = Math.abs(ca) > 1e-6 ? (HUD_BW / 2) / Math.abs(ca) : 1e9;
        const ey = Math.abs(sa) > 1e-6 ? (HUD_BH / 2) / Math.abs(sa) : 1e9;
        const r0 = 11, r1 = HUD_R - Math.min(ex, ey);
        hud.line.setAttribute('x1', (r0 * ca).toFixed(2)); hud.line.setAttribute('y1', (r0 * sa).toFixed(2));
        hud.line.setAttribute('x2', (r1 * ca).toFixed(2)); hud.line.setAttribute('y2', (r1 * sa).toFixed(2));
        hud.box.setAttribute('x', (cx - HUD_BW / 2).toFixed(2)); hud.box.setAttribute('y', (cy - HUD_BH / 2).toFixed(2));
        hud.pct.setAttribute('x', cx.toFixed(2)); hud.pct.setAttribute('y', (cy + 3.6).toFixed(2));
        hudG.setAttribute('transform', `translate(${hud.p.x.toFixed(1)}, ${hud.p.y.toFixed(1)})`);
    }

    // Cambia de posición con un desplazamiento fluido en arco (la etiqueta nunca cruza la bola)
    function setHudTarget(i) {
        const to = stAngle(i);
        if (!hud.init) { hud.init = true; hud.ang = hud.to = to; return; }
        if (Math.abs(to - hud.to) < 1e-6) return;
        let d = to - hud.ang;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        hud.from = hud.ang; hud.delta = d; hud.to = to; hud.t0 = performance.now();
        if (!hud.raf) hud.raf = requestAnimationFrame(stepHud);
    }
    function stepHud(now) {
        const k = clamp((now - hud.t0) / HUD_MS, 0, 1);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        hud.ang = hud.from + hud.delta * e;
        renderHud();
        hud.raf = k < 1 ? requestAnimationFrame(stepHud) : 0;
    }

    // Coste de colocar la etiqueta en la posición i: solapamiento con texto y, sobre todo, con elementos opacos
    // (tarjetas, píldoras, footer) que la esconderían; también cuenta el conector.
    function hudOverlap(i, x, y) {
        const c = stCenter(i), hx = HUD_BW / 2 + 5, hy = HUD_BH / 2 + 5;
        const L = x + c[0] - hx, R = x + c[0] + hx, T = y + c[1] - hy, B = y + c[1] + hy;
        let sum = (L < 8 || R > pageW - 8) ? 1e5 : 0;
        if (Math.abs(STATES[i][1]) < 0.5) sum += HORIZ_BIAS;
        sum += boxOverlap(L, T, R, B);
        const a = stAngle(i), ca = Math.cos(a), sa = Math.sin(a);
        for (let r = 20; r <= 44; r += 12) sum += boxOverlap(x + r * ca - 4, y + r * sa - 4, x + r * ca + 4, y + r * sa + 4) * 1.5;
        return sum;
    }

    // Camino de mínimo coste entre las 4 posiciones, penalizando los cambios para que sea estable
    function viterbi(cost, pref, prev, sxFree) {
        const n = cost.length - 1;
        const dY = (p, q) => Math.abs(STATES[p][1] - STATES[q][1]) * SW_Y * 0.6;      // subir/bajar un nivel cuesta menos que dos
        const trans = (p, q) => p === q ? 0 : (STATES[p][0] !== STATES[q][0] ? SW_X : 0) + dY(p, q);
        // Continuidad con el tramo anterior: cambiar de posición al empezar también cuesta
        const start = (q) => (sxFree || STATES[prev][0] === STATES[q][0] ? 0 : SW_X) + dY(prev, q);
        let dp = cost[0].map((c, q) => c + start(q) + (q === pref ? 0 : 0.01));
        const back = [];
        for (let i = 1; i <= n; i++) {
            const nd = new Array(NS), bk = new Array(NS);
            for (let q = 0; q < NS; q++) {
                let best = Infinity, bp = 0;
                for (let p = 0; p < NS; p++) { const v = dp[p] + trans(p, q); if (v < best) { best = v; bp = p; } }
                nd[q] = best + cost[i][q]; bk[q] = bp;
            }
            dp = nd; back.push(bk);
        }
        let q = 0;
        for (let k = 1; k < NS; k++) if (dp[k] < dp[q] - 1) q = k;
        if (dp[pref] <= dp[q] + 1) q = pref;
        const total = dp[q], states = new Array(n + 1);
        for (let i = n; i >= 0; i--) { states[i] = q; if (i > 0) q = back[i - 1][q]; }
        return { states, total };
    }

    // Permanencia mínima: las rachas demasiado cortas se funden con la vecina que mejor encaje,
    // para que la etiqueta no cambie de sitio varias veces en pocos píxeles de scroll.
    const MIN_RUN = 12, MERGE_TOL = 30000;
    function smoothRuns(states, cost, prev) {
        for (let guard = 0; guard < 60; guard++) {
            const runs = [];
            let s0 = 0;
            for (let i = 1; i <= states.length; i++) {
                if (i === states.length || states[i] !== states[s0]) { runs.push([s0, i - 1, states[s0]]); s0 = i; }
            }
            let changed = false;
            for (let r = 0; r < runs.length && !changed; r++) {
                const a = runs[r][0], b = runs[r][1], st = runs[r][2];
                if (b - a + 1 >= MIN_RUN) continue;
                if (r === 0 && prev != null && st === prev) continue;
                const left = r > 0 ? runs[r - 1][2] : (prev != null ? prev : null);
                const right = r < runs.length - 1 ? runs[r + 1][2] : null;
                if (left === null && right === null) continue;
                const sum = (q) => { let t = 0; for (let i = a; i <= b; i++) t += cost[i][q]; return t; };
                const pick = left === null ? right : right === null ? left : (sum(left) <= sum(right) ? left : right);
                if (pick === st) continue;
                if (sum(pick) - sum(st) > MERGE_TOL) continue;     // esa racha corta evita que la etiqueta quede tapada: se conserva
                for (let i = a; i <= b; i++) states[i] = pick;
                changed = true;
            }
            if (!changed) break;
        }
    }

    // Planifica por adelantado la posición de la etiqueta en cada tramo
    function planHud() {
        const sample = (track) => {
            const n = Math.max(1, Math.ceil(track.len / PLAN_STEP)), pts = [];
            for (let i = 0; i <= n; i++) pts.push(track.core.getPointAtLength(Math.min(track.len, i * PLAN_STEP)));
            return pts;
        };
        let prev = stIdx(1, -1);                  // posición en la que terminó el tramo anterior
        segments.forEach((seg) => {
            if (seg.type === 'curve') {
                const cost = sample(seg.track).map((p) => STATES.map((_, i) => hudOverlap(i, p.x, p.y)));
                const r = viterbi(cost, prev, prev, false);
                smoothRuns(r.states, cost, prev);
                seg.plan = r.states;
                prev = r.states[r.states.length - 1];
            } else {
                // Tarjeta dividida: se elige la rama (izquierda o derecha) y, dentro de ella, la altura de la etiqueta.
                // Al elegir rama no se penaliza el lado, para que en empates alterne entre tarjetas.
                const run = (track, sx) => {
                    const cost = sample(track).map((p) => STATES.map((_, i) => STATES[i][0] === sx ? hudOverlap(i, p.x, p.y) : 1e12));
                    const r = viterbi(cost, stIdx(sx, STATES[prev][1]), prev, true);
                    smoothRuns(r.states, cost, null);
                    return r;
                };
                const rl = run(seg.L, -1), rr = run(seg.R, 1);
                const branch = Math.abs(rl.total - rr.total) < 400 ? seg.pref : (rl.total < rr.total ? 'L' : 'R');
                const states = branch === 'L' ? rl.states : rr.states;
                seg.plan = { branch, states };
                prev = states[states.length - 1];
            }
        });
    }

    /* ---------- Chispas ---------- */
    const parts = [];
    let partsRaf = 0, partsLast = 0;
    if (partsG && !reduceMotion) {
        for (let i = 0; i < 22; i++) {
            parts.push({ el: mk('circle', { r: 1.6, class: 'trek-spark', opacity: 0 }, partsG), x: 0, y: 0, vx: 0, vy: 0, life: 0 });
        }
    }
    function emit(x, y, strength) {
        if (!parts.length) return;
        const n = Math.min(3, Math.ceil(strength));
        for (let k = 0; k < n; k++) {
            const p = parts.find((q) => q.life <= 0);
            if (!p) return;
            p.x = x + (Math.random() - 0.5) * 6; p.y = y + (Math.random() - 0.5) * 6;
            const a = Math.random() * Math.PI * 2, s = 14 + Math.random() * 34;
            p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 6; p.life = 1;
        }
        if (!partsRaf) { partsLast = performance.now(); partsRaf = requestAnimationFrame(tickParts); }
    }
    function tickParts(now) {
        const dt = Math.min(0.05, (now - partsLast) / 1000); partsLast = now;
        let alive = false;
        parts.forEach((p) => {
            if (p.life <= 0) return;
            p.life -= dt * 1.5;
            if (p.life <= 0) { p.el.setAttribute('opacity', 0); return; }
            alive = true;
            p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97;
            p.el.setAttribute('cx', p.x.toFixed(1)); p.el.setAttribute('cy', p.y.toFixed(1));
            p.el.setAttribute('r', (0.5 + p.life * 1.6).toFixed(2));
            p.el.setAttribute('opacity', (p.life * 0.85).toFixed(2));
        });
        partsRaf = alive ? requestAnimationFrame(tickParts) : 0;
    }

    /* ---------- Recorrido ---------- */
    function getTravelY() {
        const vh = window.innerHeight, s = window.scrollY;
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
        let t = s + vh * 0.55;
        const ramp = clamp((s - (maxScroll - vh)) / vh, 0, 1);
        t += ramp * (endY - (maxScroll + vh * 0.55));
        return Math.max(startY, t);
    }

    function distAtY(track, y) {
        let lo = 0, hi = track.len;
        while (hi - lo > 0.75) {
            const mid = (lo + hi) * 0.5;
            if (track.core.getPointAtLength(mid).y < y) lo = mid; else hi = mid;
        }
        return lo;
    }

    let lastHeadY = null;
    let velY = 0, lastTY = null, lastTT = 0, settleTimer = 0;

    function update(settle) {
        if (!segments.length) return;
        const t = getTravelY();
        // Velocidad del recorrido (px/s) para anticipar los cambios de posición de la etiqueta
        if (settle) {
            velY = 0;
        } else {
            const nowT = performance.now();
            if (lastTY !== null) {
                const dtS = Math.max(8, nowT - lastTT) / 1000;
                velY = velY * 0.6 + ((t - lastTY) / dtS) * 0.4;
            }
            lastTY = t; lastTT = nowT;
            clearTimeout(settleTimer);
            settleTimer = setTimeout(() => update(true), 140);
        }
        const lead = clamp(velY * HUD_LEAD_S, -HUD_LEAD_MAX, HUD_LEAD_MAX);
        let headL = null, headR = null, act = 0;

        segments.forEach((seg, si) => {
            const before = t <= seg.y0, after = t >= seg.y1;
            if (!before) act = si;
            const past = after ? t - seg.y1 : 0;
            if (seg.type === 'curve') {
                const dist = before ? 0 : after ? seg.track.len : distAtY(seg.track, t);
                setProgress(seg.track, dist, before ? 0 : dist + past);
                if (!before) { headL = seg.track.core.getPointAtLength(dist); headR = null; seg.cur = dist; }
            } else {
                const ratio = before ? 0 : after ? 1 : (t - seg.y0) / (seg.y1 - seg.y0);
                const dL = ratio * seg.L.len, dR = ratio * seg.R.len;
                seg.ratio = ratio;
                setProgress(seg.L, dL, before ? 0 : dL + past);
                setProgress(seg.R, dR, before ? 0 : dR + past);
                if (!before) {
                    headL = seg.L.core.getPointAtLength(dL);
                    headR = after ? null : seg.R.core.getPointAtLength(dR);
                }
            }
        });

        if (!headL) {
            const f = segments[0];
            headL = (f.type === 'curve' ? f.track : f.L).core.getPointAtLength(0);
        }
        const cometY = headL.y;
        head1.setAttribute('transform', `translate(${headL.x}, ${headL.y})`);
        if (headR) { head2.style.display = ''; head2.setAttribute('transform', `translate(${headR.x}, ${headR.y})`); }
        else head2.style.display = 'none';

        // Chispas al avanzar
        if (lastHeadY !== null) {
            const dy = Math.abs(cometY - lastHeadY);
            if (dy > 1.5) { emit(headL.x, headL.y, dy / 14); if (headR) emit(headR.x, headR.y, dy / 20); }
        }
        lastHeadY = cometY;

        // Estaciones y sección activa
        let activeIdx = -1;
        stations.forEach((st) => {
            const reached = cometY >= st.y - 2;
            if (reached !== st.on) {
                st.on = reached;
                st.ring.classList.toggle('is-reached', reached);
                st.dot.classList.toggle('is-reached', reached);
                st.ripple.classList.remove('is-ping');
                if (reached) { void st.ripple.getBoundingClientRect(); st.ripple.classList.add('is-ping'); }
            }
            if (reached) activeIdx = st.idx;
        });
        sectionDefs.forEach((s, i) => {
            const on = i === activeIdx;
            if (s.pill) s.pill.classList.toggle('is-active-section', on);
            if (s.title) s.title.classList.toggle('is-active-title', on);
        });

        // Indicador de progreso: posición planificada por tramo y animada al cambiar
        if (hud && window.innerWidth > 900) {
            const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
            const pct = String(Math.round(clamp(window.scrollY / max, 0, 1) * 100)).padStart(2, '0') + '%';
            if (pct !== hud.last) { hud.pct.textContent = pct; hud.last = pct; }
            const seg = segments[act];
            let p = headL, si;
            if (seg.type === 'curve') {
                const k = seg.track.len / Math.max(1, seg.y1 - seg.y0);
                const dist = clamp((seg.cur || 0) + lead * k, 0, seg.track.len);
                si = seg.plan[clamp(Math.round(dist / PLAN_STEP), 0, seg.plan.length - 1)];
            } else {
                const tr = seg.plan.branch === 'L' ? seg.L : seg.R;
                const ra = clamp((seg.ratio || 0) + lead / Math.max(1, seg.y1 - seg.y0), 0, 1);
                si = seg.plan.states[clamp(Math.round(ra * tr.len / PLAN_STEP), 0, seg.plan.states.length - 1)];
                p = (seg.plan.branch === 'R' && headR) ? headR : headL;
            }
            hud.p = p;
            setHudTarget(si);
            renderHud();
            hudG.style.opacity = '1';
        } else if (hudG) hudG.style.opacity = '0';

        document.body.classList.toggle('trek-finale', cometY >= finaleY - 2);
        document.body.classList.toggle('trek-footer', cometY >= endY - 4);
    }

    let rebuildRaf = 0;
    const rebuild = () => {
        if (rebuildRaf) return;
        rebuildRaf = requestAnimationFrame(() => { rebuildRaf = 0; buildTrail(); lastHeadY = null; update(); });
    };

    buildHud();
    buildTrail();
    update();
    window.addEventListener('load', rebuild);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);
    window.addEventListener('resize', rebuild, { passive: true });
    new ResizeObserver(rebuild).observe(document.body);
    window.addEventListener('scroll', () => update(false), { passive: true });
    document.addEventListener('stack:changed', rebuild);
})();
