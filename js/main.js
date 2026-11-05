/* Interacciones generales: scrollbar flotante, tilt, botones magnéticos, reveal, nav activa, reloj, terminal y copiar email. */
(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    /* 1. Línea de scroll flotante */
    (function floatingScrollbar() {
        const fsb = document.getElementById('fsb');
        const thumb = document.getElementById('fsb-thumb');
        if (!fsb || !thumb || !finePointer) return;
        const doc = document.documentElement, PAD = 4;
        let hideTimer = 0, raf = 0, drag = null;

        const geo = () => {
            const vh = window.innerHeight, total = doc.scrollHeight;
            const th = Math.max(38, (vh * vh) / total);
            return { vh, max: total - vh, th, run: vh - th - PAD * 2 };
        };
        const update = () => {
            raf = 0;
            const g = geo();
            fsb.classList.toggle('is-none', g.max <= 4);
            if (g.max <= 4) return;
            thumb.style.height = g.th + 'px';
            thumb.style.transform = `translateY(${PAD + (window.scrollY / g.max) * g.run}px)`;
        };
        const req = () => { if (!raf) raf = requestAnimationFrame(update); };
        const show = () => {
            fsb.classList.add('is-on');
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => { if (!drag && !fsb.matches(':hover')) fsb.classList.remove('is-on'); }, 850);
        };
        window.addEventListener('scroll', () => { req(); show(); }, { passive: true });
        window.addEventListener('resize', req, { passive: true });
        new ResizeObserver(req).observe(document.body);

        thumb.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault(); e.stopPropagation();
            thumb.setPointerCapture(e.pointerId);
            drag = { y: e.clientY, s: window.scrollY };
            fsb.classList.add('is-drag', 'is-on');
        });
        thumb.addEventListener('pointermove', (e) => {
            if (!drag) return;
            const g = geo();
            window.scrollTo(0, drag.s + (e.clientY - drag.y) * (g.max / g.run));
        });
        const end = () => { if (!drag) return; drag = null; fsb.classList.remove('is-drag'); show(); };
        thumb.addEventListener('pointerup', end);
        thumb.addEventListener('pointercancel', end);
        fsb.addEventListener('pointerdown', (e) => {
            if (e.target !== fsb || e.button !== 0) return;
            const r = thumb.getBoundingClientRect();
            window.scrollBy({ top: (e.clientY < r.top ? -1 : 1) * window.innerHeight * 0.85, behavior: 'smooth' });
        });
        fsb.addEventListener('pointerenter', () => { fsb.classList.add('is-on'); clearTimeout(hideTimer); });
        fsb.addEventListener('pointerleave', show);
        update();
    })();

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

    /* 8. Explorador de stack */
    (function stackExplorer() {
        const tabsEl = document.getElementById('stack-tabs');
        const tilesEl = document.getElementById('stack-tiles');
        if (!tabsEl || !tilesEl) return;
        const numEl = document.getElementById('stack-num'), titleEl = document.getElementById('stack-title'), descEl = document.getElementById('stack-desc');
        const panel = document.getElementById('stack-panel');
        const DATA = [
            {
                name: 'Frontend', title: 'Frontend y experiencia', desc: 'Interfaces rápidas, accesibles y con carácter, de la maqueta al detalle de animación.',
                tiles: [
                    ['fab fa-react', 'React 18', 'Componentes, hooks y estado'], ['fab fa-js', 'TypeScript', 'Tipado de extremo a extremo'],
                    ['fab fa-html5', 'HTML5 semántico', 'Accesibilidad desde la base'], ['fab fa-css3-alt', 'CSS moderno', 'Grid, variables y animación'],
                    ['fas fa-brush', 'Tailwind CSS', 'Utilidades y sistemas de diseño'], ['fas fa-bolt', 'Vite', 'Build rápido y HMR'],
                    ['fas fa-cube', 'Three.js', 'Escenas WebGL interactivas'], ['fas fa-wave-square', 'GSAP', 'Micro-interacciones fluidas'],
                    ['fas fa-cubes', 'Zustand', 'Estado global ligero']
                ]
            },
            {
                name: 'Backend y datos', title: 'Backend y datos', desc: 'Modelos relacionales sólidos, APIs claras y seguridad aplicada en la propia base de datos.',
                tiles: [
                    ['fas fa-database', 'PostgreSQL', 'Modelado 3FN y SQL'], ['fas fa-bolt', 'Supabase', 'Auth, BaaS y tiempo real'],
                    ['fab fa-node-js', 'Node.js', 'Servicios y APIs'], ['fas fa-plug', 'APIs REST', 'Diseño e integraciones'],
                    ['fas fa-code', 'JSONB', 'Atributos dinámicos'], ['fas fa-shield-halved', 'RLS y RBAC', 'Aislamiento por rol'],
                    ['fas fa-key', 'Autenticación', 'Sesiones y permisos']
                ]
            },
            {
                name: 'IA y agentes', title: 'IA y agentes', desc: 'Desarrollo asistido por agentes y modelos integrados en producto, siempre con revisión humana.',
                tiles: [
                    ['fas fa-robot', 'Claude Code', 'Desarrollo agéntico en terminal'], ['fas fa-plug-circle-bolt', 'MCP', 'Agentes conectados a herramientas'],
                    ['fas fa-wand-magic-sparkles', 'Prompting', 'Contexto e instrucciones precisas'], ['fas fa-microchip', 'APIs de LLM', 'Modelos dentro del producto'],
                    ['fas fa-code-compare', 'Revisión de código', 'Verificación del código generado'], ['fas fa-gears', 'Automatización', 'Flujos repetibles de desarrollo']
                ]
            },
            {
                name: 'Herramientas', title: 'Herramientas y entrega', desc: 'Control de versiones, previews por rama y despliegue continuo para publicar con confianza.',
                tiles: [
                    ['fab fa-git-alt', 'Git', 'Ramas, commits y revisión'], ['fab fa-github', 'GitHub', 'Repos, PRs y Actions'],
                    ['fas fa-cloud-arrow-up', 'Vercel', 'Previews por rama y CI/CD'], ['fas fa-terminal', 'Terminal', 'Flujo diario en consola'],
                    ['fas fa-screwdriver-wrench', 'DevTools', 'Depuración y rendimiento'], ['fas fa-chart-line', 'Recharts', 'Visualización de datos'],
                    ['fas fa-file-pdf', 'jsPDF', 'Documentos en el cliente']
                ]
            }
        ];
        const pad = (n) => String(n).padStart(2, '0');
        let current = -1;

        DATA.forEach((d, i) => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'stack-tab'; b.setAttribute('role', 'tab'); b.id = 'stack-tab-' + i;
            b.innerHTML = `<b>${pad(i + 1)}</b><span>${d.name}<small>${d.tiles.length} TECNOLOGÍAS</small></span>`;
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

    /* 7. Terminal ilustrativa: se "teclea" al entrar en pantalla */
    (function terminal() {
        const host = document.getElementById('terminal-body');
        const wrap = document.getElementById('terminal');
        if (!host || !wrap) return;
        const LINES = [
            { t: 'cmd', s: '$ claude' },
            { t: 'you', s: '> Añade RLS por rol a la tabla "quotes"' },
            { t: 'out', s: '● Leyendo esquema vía MCP (supabase)…' },
            { t: 'out', s: '● Plan: 1 migración · 3 políticas · tests' },
            { t: 'out', s: '● Aplicando migración… ✓' },
            { t: 'out', s: '● Revisando el diff… 0 incidencias' },
            { t: 'ok', s: '✓ Listo para tu revisión' }
        ];
        const render = (n, partial) => {
            host.innerHTML = LINES.slice(0, n).map((l) => `<span class="tl tl-${l.t}">${l.s}</span>`).join('\n') +
                (partial !== undefined ? `\n<span class="tl tl-${LINES[n].t}">${partial}<i class="caret"></i></span>` : '<i class="caret"></i>');
        };
        const full = () => render(LINES.length);
        if (reduceMotion) { full(); return; }
        let started = false;
        const run = async () => {
            if (started) return; started = true;
            const wait = (ms) => new Promise((r) => setTimeout(r, ms));
            for (let i = 0; i < LINES.length; i++) {
                const s = LINES[i].s, speed = LINES[i].t === 'out' || LINES[i].t === 'ok' ? 12 : 30;
                for (let c = 1; c <= s.length; c += (speed < 20 ? 2 : 1)) { render(i, s.slice(0, c)); await wait(speed); }
                render(i + 1);
                await wait(LINES[i].t === 'you' ? 520 : 260);
            }
        };
        render(0, '');
        new IntersectionObserver((en, io) => { if (en[0].isIntersecting) { run(); io.disconnect(); } }, { threshold: 0.4 }).observe(wrap);
    })();
})();
