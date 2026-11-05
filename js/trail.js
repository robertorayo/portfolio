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
    let startY = 0, endY = 0, finaleY = Infinity;
    let hud = null;

    const sectionDefs = [
        { pill: '#sobre-mi .section-tag', title: '#sobre-mi .section-heading' },
        { pill: '#proyecto .spotlight-pill', title: '#proyecto .section-title' },
        { pill: '#habilidades .section-tag', title: '#habilidades .section-heading' },
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
                    rects.push({ x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height });
                }
            }
            root.querySelectorAll('.section-tag, .spotlight-pill, .hero-badge, .marquee-strip-wrapper').forEach((el) => {
                if (el.closest('.glass-card')) return;
                const r = absRect(el);
                rects.push({ x: r.L, y: r.T, w: r.R - r.L, h: r.B - r.T });
            });
        }
        // Obstáculos para colocar el indicador de progreso donde menos estorbe
        obstacles = rects.slice();
        document.querySelectorAll('.glass-card').forEach((el) => {
            if (el.closest('.navbar-wrapper')) return;
            const r = absRect(el);
            obstacles.push({ x: r.L, y: r.T, w: r.R - r.L, h: r.B - r.T });
        });
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
                if (wp.station === 3) finaleY = T;
            }
            pts = [{ x: CX, y: B }];
        });
        flush();

        startY = segments.length ? segments[0].y0 : 0;
        endY = segments.length ? segments[segments.length - 1].y1 : docH;

        const wrapper = document.querySelector('.page-wrapper');
        buildMask(width, wrapper ? wrapper.scrollHeight : docH);

        document.documentElement.classList.remove('trek-measuring');
    }

    /* ---------- HUD de progreso ---------- */
    const HUD_W = 100, HUD_H = 30;
    function buildHud() {
        if (!hudG) return;
        hudG.innerHTML = '';
        const line = mk('line', { y1: 0, y2: 0, class: 'trek-hud-line' }, hudG);
        const box = mk('rect', { y: -11, width: 54, height: 22, rx: 11, class: 'trek-hud-box' }, hudG);
        const pct = mk('text', { y: 3.6, class: 'trek-hud-pct' }, hudG);
        hud = { line, box, pct, last: '', side: '', seg: -1 };
        setHudSide('R');
    }
    function setHudSide(side) {
        if (!hud || hud.side === side) return;
        hud.side = side;
        const k = side === 'R' ? 1 : -1;
        hud.line.setAttribute('x1', 14 * k); hud.line.setAttribute('x2', 40 * k);
        hud.box.setAttribute('x', side === 'R' ? 40 : -94);
        hud.pct.setAttribute('x', side === 'R' ? 52 : -82);
    }
    // Área de solapamiento del indicador con texto, tarjetas, etc. (menor = mejor)
    function hudOverlap(side, x, y) {
        const L = side === 'R' ? x + 8 : x - 8 - HUD_W, R = L + HUD_W, T = y - HUD_H / 2, B = y + HUD_H / 2;
        let s = (L < 8 || R > pageW - 8) ? 1e5 : 0;
        for (let i = 0; i < obstacles.length; i++) {
            const o = obstacles[i];
            if (o.y > B || o.y + o.h < T) continue;
            const ox = Math.min(R, o.x + o.w) - Math.max(L, o.x);
            if (ox <= 0) continue;
            const oy = Math.min(B, o.y + o.h) - Math.max(T, o.y);
            if (oy > 0) s += ox * oy;
        }
        return s;
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

    function update() {
        if (!segments.length) return;
        const t = getTravelY();
        let headL = null, headR = null, act = 0;

        segments.forEach((seg, si) => {
            const before = t <= seg.y0, after = t >= seg.y1;
            if (!before) act = si;
            const past = after ? t - seg.y1 : 0;
            if (seg.type === 'curve') {
                const dist = before ? 0 : after ? seg.track.len : distAtY(seg.track, t);
                setProgress(seg.track, dist, before ? 0 : dist + past);
                if (!before) { headL = seg.track.core.getPointAtLength(dist); headR = null; }
            } else {
                const ratio = before ? 0 : after ? 1 : (t - seg.y0) / (seg.y1 - seg.y0);
                const dL = ratio * seg.L.len, dR = ratio * seg.R.len;
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

        // Indicador de progreso: se coloca por el lado donde menos estorba
        if (hud && window.innerWidth > 900) {
            const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
            const pct = String(Math.round(clamp(window.scrollY / max, 0, 1) * 100)).padStart(2, '0') + '%';
            if (pct !== hud.last) { hud.pct.textContent = pct; hud.last = pct; }
            const seg = segments[act];
            if (hud.seg !== act) { hud.seg = act; setHudSide(seg.pref); }
            const pL = headL, pR = headR || headL;
            const sL = hudOverlap('L', pL.x, pL.y), sR = hudOverlap('R', pR.x, pR.y);
            const cur = hud.side === 'L' ? sL : sR, other = hud.side === 'L' ? sR : sL;
            if (other + 500 < cur) setHudSide(hud.side === 'L' ? 'R' : 'L');
            const p = hud.side === 'L' ? pL : pR;
            hudG.setAttribute('transform', `translate(${p.x}, ${p.y})`);
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
    window.addEventListener('scroll', update, { passive: true });
    document.addEventListener('stack:changed', rebuild);
})();
