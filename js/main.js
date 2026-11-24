/* Interacciones generales: cristal líquido, tilt, botones magnéticos, reveal, nav activa, reloj, terminal y copiar email. */
(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    /* 2. Tilt 3D de tarjetas y botones magnéticos (solo puntero fino) */
    if (window.gsap && finePointer && !reduceMotion) {
        document.querySelectorAll('.tilt-card').forEach((card) => {
            card.addEventListener('mousemove', (e) => {
                const r = card.getBoundingClientRect();
                const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
                gsap.to(card, {
                    rotationX: (y / (r.height / 2)) * -1.6, rotationY: (x / (r.width / 2)) * 1.6, y: -3,
                    transformPerspective: 1100, duration: 0.4, ease: 'power1.out', overwrite: 'auto'
                });
            });
            card.addEventListener('mouseleave', () => {
                gsap.to(card, { rotationX: 0, rotationY: 0, y: 0, duration: 0.6, ease: 'power2.out', overwrite: 'auto' });
            });
        });
        document.querySelectorAll('.magnetic-btn').forEach((btn) => {
            btn.addEventListener('mousemove', (e) => {
                const r = btn.getBoundingClientRect();
                gsap.to(btn, {
                    x: (e.clientX - r.left - r.width / 2) * 0.26, y: (e.clientY - r.top - r.height / 2) * 0.26,
                    duration: 0.3, ease: 'power2.out', overwrite: 'auto'
                });
            });
            btn.addEventListener('mouseleave', () => {
                gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1.1, 0.38)', overwrite: 'auto' });
            });
        });
    }

    /* 3. Reveal al hacer scroll */
    const reveals = document.querySelectorAll('.reveal-fade');
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -50px 0px' });
        reveals.forEach((el) => io.observe(el));
    } else reveals.forEach((el) => el.classList.add('is-visible'));

    /* 4. Enlace activo del menú */
    (function navSpy() {
        const sections = document.querySelectorAll('section[id]');
        const links = document.querySelectorAll('.nav-link');
        const onScroll = () => {
            const pos = window.scrollY + window.innerHeight * 0.35;
            let cur = '';
            sections.forEach((s) => { if (pos >= s.offsetTop && pos < s.offsetTop + s.offsetHeight) cur = s.id; });
            links.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#' + cur));
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    })();

    /* 5. Reloj de Madrid */
    (function clock() {
        const el = document.getElementById('clock-display');
        if (!el) return;
        const tick = () => {
            el.textContent = new Date().toLocaleTimeString('es-ES', {
                timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        };
        tick();
        setInterval(tick, 1000);
    })();

    /* 6. Copiar email */
    (function copyEmail() {
        const btn = document.getElementById('btn-copy-email');
        const label = document.getElementById('copy-btn-text');
        if (!btn || !label) return;
        const email = 'robertobamym@gmail.com';
        btn.addEventListener('click', () => {
            const done = () => {
                btn.classList.add('copied'); label.textContent = '¡Copiado!';
                setTimeout(() => { btn.classList.remove('copied'); label.textContent = 'Copiar email'; }, 2500);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(email).then(done).catch(() => { label.textContent = email; });
            } else label.textContent = email;
        });
    })();

    /* 7. Cristal líquido (barra, pastilla y botones del inicio, «Ver demo» de las capturas)
       Un mapa de desplazamiento (R = X, G = Y, 128 = quieto) desplaza el fondo hacia dentro en el bisel
       del borde, como una lente. Solo Chromium pinta filtros SVG en backdrop-filter; Safari dice que sí en
       @supports pero no lo dibuja, así que se detecta el motor y el resto se queda con el estilo del CSS.
       Cada elemento .liquid-glass tiene su propio filtro, porque el mapa depende de su tamaño. */
    (function liquidGlass() {
        const els = document.querySelectorAll('.liquid-glass');
        // Marcas del motor; si vienen vacías (p. ej. con el agente de usuario sobrescrito), se mira el texto clásico.
        // En iOS todos los navegadores son WebKit aunque digan Chrome (CriOS) o Firefox (FxiOS)
        const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
        const ua = navigator.userAgent;
        const chromium = brands.length ? brands.some((b) => b.brand === 'Chromium')
            : /\bChrome\/\d/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
        if (!els.length || !chromium) return;
        if (window.matchMedia('(prefers-reduced-transparency: reduce)').matches) return;
        const NS = 'http://www.w3.org/2000/svg';
        const attrs = (el, o) => Object.keys(o).forEach((k) => el.setAttribute(k, o[k]));

        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'liquid-glass-defs');
        svg.setAttribute('aria-hidden', 'true');
        document.body.appendChild(svg);

        const makeFilter = (id) => {
            const filter = document.createElementNS(NS, 'filter');
            attrs(filter, { id, x: '0', y: '0', filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' });
            const blur = document.createElementNS(NS, 'feGaussianBlur');
            attrs(blur, { in: 'SourceGraphic', stdDeviation: '1.5', result: 'b' });
            const map = document.createElementNS(NS, 'feImage');
            attrs(map, { x: '0', y: '0', result: 'map', preserveAspectRatio: 'none' });
            const disp = document.createElementNS(NS, 'feDisplacementMap');
            attrs(disp, { in: 'b', in2: 'map', xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' });
            const sat = document.createElementNS(NS, 'feColorMatrix');
            attrs(sat, { in: 'd', type: 'saturate', values: '1.6' });
            filter.append(blur, map, disp, sat);
            svg.appendChild(filter);
            return { filter, map, disp };
        };

        // Distancia al borde de un rectángulo redondeado; en el bisel, empuje hacia dentro con perfil convexo
        const buildMap = (w, h, radius, BISEL) => {
            const cv = document.createElement('canvas');
            cv.width = w; cv.height = h;
            const ctx = cv.getContext('2d');
            const img = ctx.createImageData(w, h);
            const r = Math.min(radius, w / 2, h / 2);
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const px = x + 0.5 - w / 2, py = y + 0.5 - h / 2;
                    const qx = Math.abs(px) - (w / 2 - r), qy = Math.abs(py) - (h / 2 - r);
                    const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
                    const depth = r - Math.hypot(ox, oy) - Math.min(Math.max(qx, qy), 0);
                    let dx = 0, dy = 0;
                    if (depth >= 0 && depth < BISEL) {
                        let nx = 0, ny = 1;
                        if (qx > 0 && qy > 0) { const l = Math.hypot(ox, oy) || 1; nx = ox / l; ny = oy / l; }
                        else if (qx > qy) { nx = 1; ny = 0; }
                        const f = Math.pow(1 - depth / BISEL, 2.2);
                        dx = -nx * (Math.sign(px) || 1) * f;
                        dy = -ny * (Math.sign(py) || 1) * f;
                    }
                    const i = (y * w + x) * 4;
                    img.data[i] = 128 + dx * 127; img.data[i + 1] = 128 + dy * 127; img.data[i + 2] = 128; img.data[i + 3] = 255;
                }
            }
            ctx.putImageData(img, 0, 0);
            return cv.toDataURL();
        };

        const items = new Map();
        const update = (el) => {
            const it = items.get(el);
            const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
            const radius = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || h / 2, h / 2);
            const key = w + 'x' + h + 'r' + radius;
            if (!w || !h || key === it.key) return;
            it.key = key;
            // Bisel y fuerza proporcionales a la altura: la barra (57px) usa 20 y 60; una pastilla pequeña, menos
            const bisel = Math.min(20, h * 0.4), escala = Math.min(60, Math.round(h * 1.4));
            const url = buildMap(w, h, radius, bisel);
            // La clase solo se pone con el mapa ya decodificado: si no, el feImage vacío desplaza el fondo un fotograma
            const im = new Image();
            im.src = url;
            im.decode().then(() => {
                if (it.key !== key) return;
                attrs(it.filter, { width: String(w), height: String(h) });
                attrs(it.map, { width: String(w), height: String(h), href: url });
                it.disp.setAttribute('scale', String(escala));
                // Por variable y no inline, para que el CSS pueda anularlo (p. ej. con reduced-transparency)
                el.style.setProperty('--lg-filter', `url(#${it.id})`);
                el.classList.add('is-liquid');
            }).catch(() => { if (it.key === key) it.key = ''; });
        };
        // Mientras se redimensiona, el mapa anterior se estira; se rehace al parar (~120 ms)
        const ro = new ResizeObserver((entries) => {
            entries.forEach(({ target }) => {
                const it = items.get(target);
                clearTimeout(it.timer);
                it.timer = setTimeout(() => requestAnimationFrame(() => update(target)), it.key ? 120 : 0);
            });
        });
        els.forEach((el, i) => {
            const id = 'liquid-glass-' + i;
            items.set(el, Object.assign({ id, key: '', timer: 0 }, makeFilter(id)));
            ro.observe(el);
        });
    })();

    /* 8. Explorador de stack */
    (function stackExplorer() {
        const tabsEl = document.getElementById('stack-tabs');
        const tilesEl = document.getElementById('stack-tiles');
        if (!tabsEl || !tilesEl) return;
        const numEl = document.getElementById('stack-num'), titleEl = document.getElementById('stack-title'), descEl = document.getElementById('stack-desc');
        const panel = document.getElementById('stack-panel');
        const DATA = [
            {
                name: 'Frontend', title: 'Interfaces y visualización', desc: 'Aplicaciones con React y TypeScript, y experiencias visuales con canvas y WebGL.',
                tiles: [
                    ['fab fa-react', 'React 18', 'Componentes, hooks y rutas'], ['fab fa-js', 'TypeScript', 'Tipado en toda la aplicación'],
                    ['fas fa-bolt', 'Vite', 'Desarrollo y build'], ['fas fa-brush', 'Tailwind CSS', 'Diseño responsive'],
                    ['fas fa-cubes', 'Zustand', 'Estado de la aplicación'], ['fas fa-chart-line', 'Recharts', 'Gráficas e informes'],
                    ['fab fa-html5', 'HTML, CSS y JavaScript', 'Canvas y animación'], ['fas fa-cube', 'Three.js', 'Gráficos 3D con WebGL']
                ]
            },
            {
                name: 'Datos y backend', title: 'Bases de datos y servicios', desc: 'Modelado relacional con SQL, seguridad por filas, APIs en Node.js y Laravel y acceso a datos desde Java.',
                tiles: [
                    ['fas fa-database', 'PostgreSQL', 'Modelo relacional y JSONB'], ['fas fa-bolt', 'Supabase', 'Autenticación y roles'],
                    ['fas fa-shield-halved', 'Row Level Security', 'Permisos por fila'], ['fas fa-table', 'SQL y PL/SQL', 'Consultas y procedimientos'],
                    ['fab fa-node-js', 'Node.js y TypeScript', 'Bots y tiempo real'], ['fab fa-laravel', 'PHP y Laravel', 'APIs REST y migraciones'], ['fas fa-layer-group', 'JDBC e Hibernate', 'Acceso a datos y JPQL'], ['fas fa-leaf', 'MongoDB y Cassandra', 'Bases de datos NoSQL']
                ]
            },
            {
                name: 'Java y herramientas', title: 'Java, pruebas y despliegue', desc: 'Programación en Java, pruebas automáticas y publicación con control de versiones.',
                tiles: [
                    ['fab fa-java', 'Java', 'Programación orientada a objetos'], ['fas fa-box-open', 'Maven', 'Gestión de proyectos'],
                    ['fas fa-vial', 'JUnit 5 y Selenium', 'Pruebas unitarias y de interfaz'], ['fab fa-git-alt', 'Git y GitHub', 'Ramas y control de versiones'],
                    ['fas fa-cloud-arrow-up', 'Vercel', 'Despliegue con vista previa']
                ]
            }
        ];
        const pad = (n) => String(n).padStart(2, '0');
        let current = -1;

        DATA.forEach((d, i) => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'stack-tab'; b.setAttribute('role', 'tab'); b.id = 'stack-tab-' + i;
            b.innerHTML = `<b>${pad(i + 1)}</b><span>${d.name}<small>${d.tiles.length} ${d.unit || 'TECNOLOGÍAS'}</small></span>`;
            b.addEventListener('click', () => select(i));
            b.addEventListener('keydown', (e) => {
                const k = e.key;
                if (k === 'ArrowDown' || k === 'ArrowRight') { e.preventDefault(); select((i + 1) % DATA.length, true); }
                else if (k === 'ArrowUp' || k === 'ArrowLeft') { e.preventDefault(); select((i - 1 + DATA.length) % DATA.length, true); }
            });
            tabsEl.appendChild(b);
        });

        function select(i, focus) {
            if (i === current) return;
            current = i;
            const d = DATA[i];
            [...tabsEl.children].forEach((t, k) => {
                const on = k === i;
                t.classList.toggle('is-active', on);
                t.setAttribute('aria-selected', on ? 'true' : 'false');
                t.tabIndex = on ? 0 : -1;
                if (on && focus) t.focus();
            });
            panel.setAttribute('aria-labelledby', 'stack-tab-' + i);
            numEl.textContent = pad(i + 1);
            titleEl.textContent = d.title;
            descEl.textContent = d.desc;
            tilesEl.innerHTML = d.tiles.map((t, k) => `<div class="stack-tile" style="--i:${k}"><i class="${t[0]}"></i><strong>${t[1]}</strong><small>${t[2]}</small></div>`).join('');
            document.dispatchEvent(new Event('stack:changed'));
        }
        select(0);
    })();
})();
