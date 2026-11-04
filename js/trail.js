/* Línea de trayectoria interactiva al scroll: curvas entre secciones, división por los bordes de cada tarjeta y máscara bajo el texto. */
(function () {
'use strict';
            // 2. Trek Scroll Journey Trail Engine
            //    - Curvas entre estaciones (cabeceras de sección)
            //    - División por los bordes de CADA tarjeta que atraviesa el haz
            //    - Máscara SVG que atenúa el haz cuando pasa por detrás de texto
            const trailSvg = document.getElementById('trek-trail-svg');
            const guidesG = document.getElementById('trek-guides');
            const glowsG = document.getElementById('trek-glows');
            const coresG = document.getElementById('trek-cores');
            const nodesGroup = document.getElementById('trek-nodes-group');
            const cometHead1 = document.getElementById('trek-comet-head-1');
            const cometHead2 = document.getElementById('trek-comet-head-2');
            const textMask = document.getElementById('trekTextMask');
            const maskBase = document.getElementById('trek-mask-base');
            const maskOuterG = document.getElementById('trek-mask-outer');
            const maskInnerG = document.getElementById('trek-mask-inner');

            if (trailSvg && guidesG && glowsG && coresG && cometHead1 && cometHead2) {
                const SVGNS = 'http://www.w3.org/2000/svg';
                const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
                let segments = [];
                let stations = [];
                let startY = 0, endY = 0, finaleY = Infinity;

                const sectionDefs = [
                    { pill: '#sobre-mi .section-tag', title: '#sobre-mi .section-heading' },
                    { pill: '#proyecto .spotlight-pill', title: '#proyecto .section-title' },
                    { pill: '#habilidades .section-tag', title: '#habilidades .section-heading' },
                    { pill: '#contacto .section-tag', title: '#contacto .contact-title' }
                ].map(d => ({ pill: document.querySelector(d.pill), title: document.querySelector(d.title) }));

                // Rectángulo en coordenadas de documento
                const absRect = (el) => {
                    const r = el.getBoundingClientRect();
                    return { L: r.left + window.scrollX, R: r.right + window.scrollX, T: r.top + window.scrollY, B: r.bottom + window.scrollY };
                };

                function makeCurve(pts) {
                    let d = `M ${pts[0].x} ${pts[0].y}`;
                    for (let i = 0; i < pts.length - 1; i++) {
                        const p0 = pts[i], p1 = pts[i + 1];
                        const my = p0.y + (p1.y - p0.y) * 0.5;
                        d += ` C ${p0.x} ${my}, ${p1.x} ${my}, ${p1.x} ${p1.y}`;
                    }
                    return d;
                }

                function setProgress(track, dist) {
                    const off = dist <= 0 ? track.len + 2 : Math.max(0, track.len - dist);
                    track.core.style.strokeDashoffset = off;
                    track.glow.style.strokeDashoffset = off;
                }

                function makeTrack(d) {
                    const mk = (cls, parent, glow) => {
                        const p = document.createElementNS(SVGNS, 'path');
                        p.setAttribute('class', cls);
                        p.setAttribute('d', d);
                        if (glow) p.setAttribute('filter', 'url(#trekGlowFilter)');
                        parent.appendChild(p);
                        return p;
                    };
                    mk('trek-path-guide', guidesG);
                    const glow = mk('trek-path-glow', glowsG, true);
                    const core = mk('trek-path-core', coresG);
                    const len = core.getTotalLength();
                    [glow, core].forEach(p => { p.style.strokeDasharray = `${len} ${len + 4}`; });
                    const track = { core, glow, len };
                    setProgress(track, 0);
                    return track;
                }

                // Una tarjeta por fila del grid (la del lado indicado): en escritorio 1, en móvil todas
                function pickCards(grid, side) {
                    if (!grid) return [];
                    const rows = new Map();
                    Array.from(grid.children).forEach(el => {
                        const r = absRect(el);
                        const key = Math.round(r.T / 10);
                        const cur = rows.get(key);
                        if (!cur || (side === 'right' ? r.R > cur.r.R : r.L < cur.r.L)) rows.set(key, { el, r });
                    });
                    return Array.from(rows.values()).sort((a, b) => a.r.T - b.r.T).map(v => ({ kind: 'card', el: v.el }));
                }

                function stationPoint(sectionIdx, isMobile) {
                    const pill = sectionDefs[sectionIdx].pill;
                    if (!pill) return null;
                    const r = absRect(pill);
                    return {
                        kind: 'pt',
                        x: isMobile ? 14 : Math.max(40, r.L - 28),
                        y: (r.T + r.B) / 2,
                        station: sectionIdx
                    };
                }

                // Atenúa el haz bajo cualquier texto que no esté dentro de una tarjeta opaca
                function buildMask(W, H) {
                    if (!textMask || !maskBase) return;
                    [textMask, maskBase].forEach(n => { n.setAttribute('width', W); n.setAttribute('height', H); });
                    maskOuterG.innerHTML = '';
                    maskInnerG.innerHTML = '';
                    const rects = [];
                    const root = document.querySelector('.main-content');
                    if (root) {
                        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
                            acceptNode: (n) => {
                                if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                                const p = n.parentElement;
                                if (!p || p.closest('.glass-card, .marquee-strip-wrapper')) return NodeFilter.FILTER_REJECT;
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
                        // Pastillas e insignias completas (incluyen iconos) y la cinta marquee
                        root.querySelectorAll('.section-tag, .spotlight-pill, .hero-badge, .marquee-strip-wrapper').forEach(el => {
                            if (el.closest('.glass-card')) return;
                            const r = absRect(el);
                            rects.push({ x: r.L, y: r.T, w: r.R - r.L, h: r.B - r.T });
                        });
                    }
                    const addRect = (g, r, pad, rx, fill) => {
                        const n = document.createElementNS(SVGNS, 'rect');
                        n.setAttribute('x', r.x - pad);
                        n.setAttribute('y', r.y - pad);
                        n.setAttribute('width', r.w + pad * 2);
                        n.setAttribute('height', r.h + pad * 2);
                        n.setAttribute('rx', rx);
                        n.setAttribute('fill', fill);
                        g.appendChild(n);
                    };
                    // Borde suave (~60%) y núcleo (~15%) para un fundido sin filtros costosos
                    rects.forEach(r => addRect(maskOuterG, r, 16, 18, '#9a9a9a'));
                    rects.forEach(r => addRect(maskInnerG, r, 5, 8, '#262626'));
                }

                function buildTrail() {
                    // Medir sin las transformaciones de reveal / tilt / GSAP (causaban el descuadre)
                    document.documentElement.classList.add('trek-measuring');

                    const width = document.documentElement.clientWidth;
                    const isMobile = width <= 800;
                    const docH = document.documentElement.scrollHeight;

                    guidesG.innerHTML = '';
                    glowsG.innerHTML = '';
                    coresG.innerHTML = '';
                    nodesGroup.innerHTML = '';
                    segments = [];
                    stations = [];
                    finaleY = Infinity;

                    const heroSec = document.getElementById('inicio');
                    const footer = document.querySelector('.footer');
                    const contactBanner = document.querySelector('.contact-banner');
                    const startPt = { kind: 'pt', x: width * 0.5, y: heroSec ? absRect(heroSec).B + 90 : 900 };
                    const endPt = { kind: 'pt', x: width * 0.5, y: footer ? absRect(footer).T - 36 : docH - 60 };

                    const waypoints = [
                        startPt,
                        stationPoint(0, isMobile),
                        ...pickCards(document.querySelector('.profile-grid'), 'right'),
                        stationPoint(1, isMobile),
                        ...['project-card', 'project-shenron']
                            .map(id => document.getElementById(id)).filter(Boolean)
                            .map(el => ({ kind: 'card', el })),
                        stationPoint(2, isMobile),
                        ...pickCards(document.querySelector('.skills-grid'), 'right'),
                        contactBanner ? { kind: 'card', el: contactBanner, station: 3 } : null,
                        endPt
                    ].filter(Boolean);

                    const addStation = (x, y, idx) => {
                        const c = document.createElementNS(SVGNS, 'circle');
                        c.setAttribute('cx', x);
                        c.setAttribute('cy', y);
                        c.setAttribute('r', '7');
                        c.setAttribute('class', 'trek-node');
                        nodesGroup.appendChild(c);
                        stations.push({ el: c, y, idx });
                    };

                    let pts = [];
                    const flushCurve = () => {
                        if (pts.length >= 2) {
                            segments.push({ type: 'curve', track: makeTrack(makeCurve(pts)), y0: pts[0].y, y1: pts[pts.length - 1].y });
                        }
                        pts = [];
                    };
                    const pushPt = (p) => {
                        const last = pts[pts.length - 1];
                        if (last && p.y <= last.y + 8) return false; // mantener el recorrido monótono en Y
                        pts.push(p);
                        return true;
                    };

                    waypoints.forEach(wp => {
                        if (wp.kind === 'pt') {
                            if (pushPt(wp) && wp.station !== undefined) addStation(wp.x, wp.y, wp.station);
                            return;
                        }
                        // Tarjeta: el haz entra por el centro superior y se divide por ambos bordes
                        const r = absRect(wp.el);
                        const o = 1.5; // ligeramente por fuera del borde para que el núcleo se vea
                        const L = r.L - o, R = r.R + o, T = r.T - o, B = r.B + o;
                        const CX = (L + R) / 2;
                        const cssRad = parseFloat(getComputedStyle(wp.el).borderTopLeftRadius) || 20;
                        const rad = Math.max(1, Math.min(cssRad + o, (R - L) / 2 - 1, (B - T) / 2 - 1));

                        pushPt({ x: CX, y: T });
                        flushCurve();
                        const dL = `M ${CX} ${T} H ${L + rad} A ${rad} ${rad} 0 0 0 ${L} ${T + rad} V ${B - rad} A ${rad} ${rad} 0 0 0 ${L + rad} ${B} H ${CX}`;
                        const dR = `M ${CX} ${T} H ${R - rad} A ${rad} ${rad} 0 0 1 ${R} ${T + rad} V ${B - rad} A ${rad} ${rad} 0 0 1 ${R - rad} ${B} H ${CX}`;
                        segments.push({ type: 'split', L: makeTrack(dL), R: makeTrack(dR), y0: T, y1: B });
                        if (wp.station !== undefined) {
                            addStation(CX, T, wp.station);
                            if (wp.station === 3) finaleY = T;
                        }
                        pts = [{ x: CX, y: B }];
                    });
                    flushCurve();

                    startY = segments.length ? segments[0].y0 : 0;
                    endY = segments.length ? segments[segments.length - 1].y1 : docH;

                    const wrapper = document.querySelector('.page-wrapper');
                    buildMask(width, wrapper ? wrapper.scrollHeight : docH);

                    document.documentElement.classList.remove('trek-measuring');
                }

                // Posición objetivo del haz: 55% del viewport, acelerando al final para llegar justo al último punto
                function getTravelY() {
                    const vh = window.innerHeight;
                    const s = window.scrollY;
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

                function updateTrail() {
                    if (!segments.length) return;
                    const t = getTravelY();
                    let headL = null, headR = null;

                    segments.forEach(seg => {
                        const before = t <= seg.y0;
                        const after = t >= seg.y1;
                        if (seg.type === 'curve') {
                            const dist = before ? 0 : after ? seg.track.len : distAtY(seg.track, t);
                            setProgress(seg.track, dist);
                            if (!before) {
                                headL = seg.track.core.getPointAtLength(dist);
                                headR = null;
                            }
                        } else {
                            const ratio = before ? 0 : after ? 1 : (t - seg.y0) / (seg.y1 - seg.y0);
                            const dL = ratio * seg.L.len, dR = ratio * seg.R.len;
                            setProgress(seg.L, dL);
                            setProgress(seg.R, dR);
                            if (!before) {
                                headL = seg.L.core.getPointAtLength(dL);
                                headR = after ? null : seg.R.core.getPointAtLength(dR);
                            }
                        }
                    });

                    if (!headL) {
                        const first = segments[0];
                        headL = (first.type === 'curve' ? first.track : first.L).core.getPointAtLength(0);
                    }
                    const cometY = headL.y;
                    cometHead1.setAttribute('transform', `translate(${headL.x}, ${headL.y})`);
                    if (headR) {
                        cometHead2.style.display = '';
                        cometHead2.setAttribute('transform', `translate(${headR.x}, ${headR.y})`);
                    } else {
                        cometHead2.style.display = 'none';
                    }

                    // Estaciones alcanzadas y sección activa: solo cuando el cometa llega a la altura del título
                    let activeIdx = -1;
                    stations.forEach(st => {
                        const reached = cometY >= st.y - 2;
                        st.el.classList.toggle('is-reached', reached);
                        if (reached) activeIdx = st.idx;
                    });
                    sectionDefs.forEach((s, i) => {
                        const on = i === activeIdx;
                        if (s.pill) s.pill.classList.toggle('is-active-section', on);
                        if (s.title) s.title.classList.toggle('is-active-title', on);
                    });

                    // Final: el haz llega detrás de la tarjeta de contacto → se ilumina y el resto se atenúa
                    document.body.classList.toggle('trek-finale', cometY >= finaleY - 2);
                }

                let rebuildRaf = 0;
                const rebuild = () => {
                    if (rebuildRaf) return;
                    rebuildRaf = requestAnimationFrame(() => {
                        rebuildRaf = 0;
                        buildTrail();
                        updateTrail();
                    });
                };

                rebuild();
                window.addEventListener('load', rebuild);
                if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);
                window.addEventListener('resize', rebuild, { passive: true });
                new ResizeObserver(rebuild).observe(document.body);
                window.addEventListener('scroll', updateTrail, { passive: true });
            }

})();
