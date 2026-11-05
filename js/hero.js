/* ==========================================================================
   HERO · Carrusel 3D de capacidades (Three.js)
   Teselas brillantes sobre una rejilla esférica, arrastrables y con inercia.
   Inspirado en el lenguaje visual de carruseles WebGL, en blanco y negro.
   ========================================================================== */
(function () {
    'use strict';

    const CAPS = [
        {
            key: 'frontend', name: 'FRONTEND', title: 'Interfaces claras y adaptables',
            desc: 'Aplicaciones con React y TypeScript, diseño responsive y animaciones cuidadas. Las uso en DistribuTech Pro y en este portfolio.',
            chips: ['React', 'TypeScript', 'Tailwind', 'Vite']
        },
        {
            key: 'backend', name: 'BACKEND', title: 'Autenticación, servicios y Java',
            desc: 'Autenticación y consultas con Supabase en mis proyectos, y Java con JDBC, Hibernate y Maven en mi formación.',
            chips: ['Supabase', 'Auth', 'Java', 'JDBC']
        },
        {
            key: 'datos', name: 'DATOS', title: 'Bases de datos relacionales y SQL',
            desc: 'PostgreSQL, políticas RLS y atributos JSONB. También PL/SQL, MongoDB y Cassandra.',
            chips: ['PostgreSQL', 'SQL', 'JSONB', 'RLS']
        },
        {
            key: 'seguridad', name: 'SEGURIDAD', title: 'Permisos en la base de datos',
            desc: 'Roles de cliente, comercial y administrador con Row Level Security en PostgreSQL: los permisos se aplican en la propia base de datos.',
            chips: ['RBAC', 'RLS', 'Supabase Auth']
        },
        {
            key: 'cloud', name: 'DESPLIEGUE', title: 'Control de versiones y publicación',
            desc: 'Git y GitHub para el código, y Vercel para publicar con una vista previa por cada rama antes de fusionarla.',
            chips: ['Git', 'GitHub', 'Vercel']
        }
    ];
    const N = CAPS.length;

    const $ = (id) => document.getElementById(id);
    const stage = $('hero-stage');
    const canvas = $('hero-canvas');
    if (!stage || !canvas) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pad2 = (n) => String(n).padStart(2, '0');
    const mod = (n, m) => ((n % m) + m) % m;
    const wrap = (v) => mod(v + N / 2, N) - N / 2;          // [-N/2, N/2)
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

    /* ---------- Estado compartido ---------- */
    let pos = 0;           // posición continua del carrusel
    let target = 0;        // objetivo (entero)
    let activeIdx = 0;
    let lastInteraction = -1e9;
    const listeners = [];

    function setActive(i) {
        if (i === activeIdx) return;
        activeIdx = i;
        renderPanel();
        listeners.forEach((fn) => fn(i));
    }

    function goTo(i) {
        lastInteraction = performance.now();
        const base = Math.round(pos);
        target = base + wrap(i - base);
    }
    function step(dir) {
        lastInteraction = performance.now();
        target = Math.round(target) + dir;
    }

    /* ---------- Panel HTML (capacidad activa) ---------- */
    const panel = {
        root: $('cap-panel'), num: $('cap-num'), kicker: $('cap-kicker'), title: $('cap-title'),
        desc: $('cap-desc'), chips: $('cap-chips'), dots: $('cap-dots'),
        prev: $('cap-prev'), next: $('cap-next'),
        tagNum: $('tile-tag-num'), tagName: $('tile-tag-name'), tag: $('tile-tag')
    };

    function buildDots() {
        if (!panel.dots) return;
        panel.dots.innerHTML = '';
        CAPS.forEach((c, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'cap-dot';
            b.setAttribute('role', 'tab');
            b.setAttribute('aria-label', `${pad2(i + 1)} ${c.name}`);
            b.innerHTML = `<span>${pad2(i + 1)}</span>`;
            b.addEventListener('click', () => goTo(i));
            panel.dots.appendChild(b);
        });
    }

    let panelTimer = 0;
    function renderPanel() {
        const c = CAPS[activeIdx];
        if (!panel.root) return;
        panel.root.classList.add('is-swapping');
        clearTimeout(panelTimer);
        panelTimer = setTimeout(() => {
            panel.num.textContent = pad2(activeIdx + 1);
            panel.kicker.textContent = `${c.name} · ${pad2(activeIdx + 1)}/${pad2(N)}`;
            panel.title.textContent = c.title;
            panel.desc.textContent = c.desc;
            panel.chips.innerHTML = c.chips.map((t) => `<span class="cap-chip">${t}</span>`).join('');
            panel.root.classList.remove('is-swapping');
        }, panel.root.dataset.ready ? 160 : 0);
        panel.root.dataset.ready = '1';
        if (panel.dots) {
            [...panel.dots.children].forEach((d, i) => {
                const on = i === activeIdx;
                d.classList.toggle('is-active', on);
                d.setAttribute('aria-selected', on ? 'true' : 'false');
            });
        }
        if (panel.tagNum) panel.tagNum.textContent = pad2(activeIdx + 1);
        if (panel.tagName) panel.tagName.textContent = c.name;
        if (fallbackIcon) fallbackIcon.className = `stage-fallback-icon ${ICON_FA[c.key]}`;
    }

    const ICON_FA = {
        frontend: 'fas fa-code', backend: 'fas fa-server', datos: 'fas fa-database',        seguridad: 'fas fa-shield-halved', cloud: 'fas fa-cloud-arrow-up'
    };
    let fallbackIcon = null;

    buildDots();
    renderPanel();
    if (panel.prev) panel.prev.addEventListener('click', () => step(-1));
    if (panel.next) panel.next.addEventListener('click', () => step(1));

    document.addEventListener('keydown', (e) => {
        if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
        const r = stage.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        if (e.key === 'ArrowRight') step(1);
        else if (e.key === 'ArrowLeft') step(-1);
    });

    window.__hero = { goTo, step, get index() { return activeIdx; }, get pos() { return pos; }, CAPS };

    /* ---------- WebGL ---------- */
    if (!window.THREE) { enableFallback(); return; }
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (err) { enableFallback(); return; }

    function enableFallback() {
        stage.classList.add('no-webgl');
        fallbackIcon = document.createElement('i');
        fallbackIcon.className = `stage-fallback-icon ${ICON_FA[CAPS[activeIdx].key]}`;
        stage.appendChild(fallbackIcon);
        const loop = () => { setActive(mod(Math.round(target), N)); requestAnimationFrame(loop); };
        loop();
    }

    const DPR_MAX = 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_MAX));
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);

    /* ---------- Entorno para reflejos (softboxes) ---------- */
    (function buildEnv() {
        const c = document.createElement('canvas');
        c.width = 1024; c.height = 512;
        const g = c.getContext('2d');
        const bg = g.createLinearGradient(0, 0, 0, 512);
        bg.addColorStop(0, '#2b2f3a'); bg.addColorStop(0.5, '#0c0d11'); bg.addColorStop(1, '#050507');
        g.fillStyle = bg; g.fillRect(0, 0, 1024, 512);
        const box = (x, y, w, h, a) => {
            const gr = g.createLinearGradient(x, y, x + w, y + h);
            gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, `rgba(200,206,220,${a * 0.5})`);
            g.fillStyle = gr; g.fillRect(x, y, w, h);
        };
        box(120, 60, 300, 90, 1);      // softbox superior izq.
        box(620, 40, 260, 70, 0.95);   // softbox superior der.
        box(0, 250, 1024, 8, 0.5);     // línea de horizonte
        box(820, 170, 120, 220, 0.75); // panel lateral
        box(60, 190, 80, 200, 0.5);
        const tex = new THREE.CanvasTexture(c);
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.encoding = THREE.sRGBEncoding;
        const pm = new THREE.PMREMGenerator(renderer);
        scene.environment = pm.fromEquirectangular(tex).texture;
        tex.dispose(); pm.dispose();
    })();

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(4, 6, 8);
    scene.add(key);
    const rim = new THREE.PointLight(0xffffff, 1.2, 40);
    rim.position.set(-6, 2, 3);
    scene.add(rim);

    /* ---------- Textura de cara con icono ---------- */
    const ICONS = {
        frontend(g) {
            g.beginPath(); g.moveTo(200, 180); g.lineTo(122, 256); g.lineTo(200, 332);
            g.moveTo(312, 180); g.lineTo(390, 256); g.lineTo(312, 332);
            g.moveTo(284, 160); g.lineTo(228, 352); g.stroke();
        },
        backend(g) {
            [150, 240, 330].forEach((y) => {
                g.beginPath(); roundRect(g, 136, y - 30, 240, 62, 18); g.stroke();
                g.beginPath(); g.arc(184, y + 1, 7, 0, Math.PI * 2); g.fill();
                g.beginPath(); g.moveTo(222, y + 1); g.lineTo(334, y + 1); g.stroke();
            });
        },
        datos(g) {
            const cx = 256, rx = 112, ry = 38;
            g.beginPath(); g.ellipse(cx, 160, rx, ry, 0, 0, Math.PI * 2); g.stroke();
            g.beginPath(); g.moveTo(cx - rx, 160); g.lineTo(cx - rx, 352); g.ellipse(cx, 352, rx, ry, 0, Math.PI, 0, true);
            g.lineTo(cx + rx, 160); g.stroke();
            g.beginPath(); g.ellipse(cx, 224, rx, ry, 0, 0, Math.PI); g.stroke();
            g.beginPath(); g.ellipse(cx, 288, rx, ry, 0, 0, Math.PI); g.stroke();
        },
        ia(g) {
            const star = (cx, cy, r, w) => {
                g.beginPath(); g.moveTo(cx, cy - r);
                g.quadraticCurveTo(cx + w, cy - w, cx + r, cy);
                g.quadraticCurveTo(cx + w, cy + w, cx, cy + r);
                g.quadraticCurveTo(cx - w, cy + w, cx - r, cy);
                g.quadraticCurveTo(cx - w, cy - w, cx, cy - r);
                g.closePath(); g.stroke();
            };
            star(240, 270, 118, 26); star(366, 148, 44, 10);
        },
        mcp(g) {
            const pts = [[256, 256], [140, 156], [372, 156], [256, 380]];
            g.beginPath();
            for (let i = 1; i < 4; i++) { g.moveTo(pts[0][0], pts[0][1]); g.lineTo(pts[i][0], pts[i][1]); }
            g.stroke();
            pts.forEach(([x, y], i) => {
                g.save(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, i ? 34 : 42, 0, Math.PI * 2); g.fill(); g.restore();
                g.beginPath(); g.arc(x, y, i ? 34 : 42, 0, Math.PI * 2); g.stroke();
            });
        },
        seguridad(g) {
            g.beginPath(); g.moveTo(256, 120); g.lineTo(376, 164); g.lineTo(376, 270);
            g.quadraticCurveTo(376, 350, 256, 400); g.quadraticCurveTo(136, 350, 136, 270); g.lineTo(136, 164); g.closePath(); g.stroke();
            g.beginPath(); g.moveTo(204, 262); g.lineTo(244, 304); g.lineTo(316, 218); g.stroke();
        },
        cloud(g) {
            g.beginPath(); g.moveTo(160, 340);
            g.bezierCurveTo(100, 340, 98, 252, 164, 250); g.bezierCurveTo(168, 170, 280, 150, 312, 220);
            g.bezierCurveTo(390, 204, 416, 340, 350, 340); g.stroke();
            g.beginPath(); g.moveTo(256, 400); g.lineTo(256, 270); g.moveTo(212, 308); g.lineTo(256, 264); g.lineTo(300, 308); g.stroke();
        }
    };

    function roundRect(g, x, y, w, h, r) {
        g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }

    function makeFaceTexture(key) {
        const S = 512, c = document.createElement('canvas');
        c.width = c.height = S;
        const g = c.getContext('2d');
        g.save(); g.beginPath(); roundRect(g, 0, 0, S, S, 92); g.clip();
        const grad = g.createLinearGradient(S, 0, 0, S);
        grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.42, '#d5d9e1'); grad.addColorStop(1, '#6e7585');
        g.fillStyle = grad; g.fillRect(0, 0, S, S);
        const glow = g.createRadialGradient(S * 0.85, S * 0.1, 10, S * 0.85, S * 0.1, S * 0.9);
        glow.addColorStop(0, 'rgba(255,255,255,0.9)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = glow; g.fillRect(0, 0, S, S);
        g.restore();
        g.lineWidth = 24; g.lineCap = 'round'; g.lineJoin = 'round';
        g.strokeStyle = '#0a0c11'; g.fillStyle = '#0a0c11';
        g.shadowColor = 'rgba(255,255,255,0.5)'; g.shadowBlur = 0; g.shadowOffsetY = 3;
        ICONS[key](g);
        const t = new THREE.CanvasTexture(c);
        t.encoding = THREE.sRGBEncoding;
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        return t;
    }

    function makeSheenTexture() {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 256;
        const g = c.getContext('2d');
        g.save(); g.beginPath(); roundRect(g, 0, 0, 256, 256, 46); g.clip();
        const gr = g.createLinearGradient(0, 0, 256, 256);
        gr.addColorStop(0, 'rgba(255,255,255,0)');
        gr.addColorStop(0.42, 'rgba(255,255,255,0)');
        gr.addColorStop(0.5, 'rgba(255,255,255,0.65)');
        gr.addColorStop(0.58, 'rgba(255,255,255,0)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
        g.restore();
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        return t;
    }

    /* ---------- Teselas ---------- */
    const SIZE = 1.7, RAD = 0.3, DEPTH = 0.34, BEV = 0.07;
    const shape = new THREE.Shape();
    (function () {
        const h = SIZE / 2, r = RAD;
        shape.moveTo(-h + r, -h); shape.lineTo(h - r, -h); shape.quadraticCurveTo(h, -h, h, -h + r);
        shape.lineTo(h, h - r); shape.quadraticCurveTo(h, h, h - r, h); shape.lineTo(-h + r, h);
        shape.quadraticCurveTo(-h, h, -h, h - r); shape.lineTo(-h, -h + r); shape.quadraticCurveTo(-h, -h, -h + r, -h);
    })();
    const bodyGeo = new THREE.ExtrudeGeometry(shape, {
        depth: DEPTH, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 8, curveSegments: 28
    });
    bodyGeo.center();
    const FRONT_Z = DEPTH / 2 + BEV + 0.002;
    const faceGeo = new THREE.PlaneGeometry(SIZE + 0.02, SIZE + 0.02);
    const sheenTex = makeSheenTexture();

    const bodyMat = new THREE.MeshPhysicalMaterial({
        color: 0xc9ced8, metalness: 0.95, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.25
    });

    const tiles = CAPS.map((cap, i) => {
        const group = new THREE.Group();
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        const faceMat = new THREE.MeshBasicMaterial({ map: makeFaceTexture(cap.key), transparent: true, toneMapped: false });
        const face = new THREE.Mesh(faceGeo, faceMat);
        face.position.z = FRONT_Z;
        const sheenMat = new THREE.MeshBasicMaterial({
            map: sheenTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7, toneMapped: false
        });
        const sheen = new THREE.Mesh(faceGeo, sheenMat);
        sheen.position.z = FRONT_Z + 0.004;
        group.add(body, face, sheen);
        group.userData = { index: i, hover: 0, sheen, sheenMat };
        scene.add(group);
        return group;
    });

    /* Cubos decorativos flotantes */
    const cubeGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const cubes = [];
    for (let i = 0; i < 9; i++) {
        const m = new THREE.Mesh(cubeGeo, bodyMat);
        m.userData = {
            a: Math.random() * Math.PI * 2, r: 3.2 + Math.random() * 4.2, y: (Math.random() - 0.5) * 3.4,
            z: -2.5 + Math.random() * 6, s: 0.5 + Math.random() * 1.1, sp: 0.05 + Math.random() * 0.12
        };
        scene.add(m); cubes.push(m);
    }

    /* ---------- Rejilla esférica + cruces ---------- */
    const gridGroup = new THREE.Group();
    const GR = 24;
    (function buildGrid() {
        const verts = [], cols = [];
        const toXYZ = (lat, lon) => [GR * Math.cos(lat) * Math.sin(lon), GR * Math.sin(lat), -GR * Math.cos(lat) * Math.cos(lon)];
        const fade = (lat, lon) => Math.pow(Math.max(0, Math.cos(lat * 1.15) * Math.cos(lon * 0.9)), 1.5);
        const d2r = Math.PI / 180, stepDeg = 7;
        const push = (a, b) => {
            verts.push(...toXYZ(a[0], a[1]), ...toXYZ(b[0], b[1]));
            const fa = fade(a[0], a[1]) * 0.5, fb = fade(b[0], b[1]) * 0.5;
            cols.push(fa, fa, fa, fb, fb, fb);
        };
        for (let lat = -49; lat <= 49; lat += stepDeg) {
            for (let lon = -90; lon < 90; lon += 3) push([lat * d2r, lon * d2r], [lat * d2r, (lon + 3) * d2r]);
        }
        for (let lon = -91; lon <= 91; lon += stepDeg) {
            for (let lat = -56; lat < 56; lat += 3) push([lat * d2r, lon * d2r], [(lat + 3) * d2r, lon * d2r]);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        gridGroup.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 })));

        const crossCanvas = document.createElement('canvas');
        crossCanvas.width = crossCanvas.height = 64;
        const cg = crossCanvas.getContext('2d');
        cg.strokeStyle = '#fff'; cg.lineWidth = 5; cg.beginPath();
        cg.moveTo(32, 8); cg.lineTo(32, 56); cg.moveTo(8, 32); cg.lineTo(56, 32); cg.stroke();
        const crossTex = new THREE.CanvasTexture(crossCanvas);
        const pv = [], pc = [];
        for (let lat = -49; lat <= 49; lat += stepDeg * 2) {
            for (let lon = -84; lon <= 84; lon += stepDeg * 2) {
                const p = toXYZ(lat * d2r, lon * d2r), f = fade(lat * d2r, lon * d2r);
                if (f < 0.12) continue;
                pv.push(...p); pc.push(f, f, f);
            }
        }
        const pg = new THREE.BufferGeometry();
        pg.setAttribute('position', new THREE.Float32BufferAttribute(pv, 3));
        pg.setAttribute('color', new THREE.Float32BufferAttribute(pc, 3));
        gridGroup.add(new THREE.Points(pg, new THREE.PointsMaterial({
            size: 0.55, map: crossTex, transparent: true, vertexColors: true, depthWrite: false, opacity: 0.85, sizeAttenuation: true
        })));
        scene.add(gridGroup);
    })();

    /* ---------- Layout / resize ---------- */
    const RING_R = 6, RING_Z = -1.5, STEP = 0.55;
    const camTarget = new THREE.Vector3(0, 0, 0);
    const view = { w: 1, h: 1, shift: 0.13 };
    let camDist = 9;

    function resize() {
        const r = stage.getBoundingClientRect();
        const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
        view.w = w; view.h = h;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_MAX));
        renderer.setSize(w, h, false);
        const aspect = w / h;
        camera.aspect = aspect;
        const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const overlay = getComputedStyle(stage).position === 'absolute';   // escritorio: el texto se superpone al escenario
        const bottom = document.querySelector('.hero-bottom');
        if (overlay && bottom) {
            // Ajusta tamaño y posición de las teselas al hueco libre sobre el bloque de texto
            const navH = 76;
            const avail = Math.max(220, h - bottom.offsetHeight - navH);
            const tilePx = clamp(avail * 0.52, 150, 300);
            camDist = Math.max(8, (2.06 * h) / (2 * tanHalf * tilePx));
            view.shift = clamp(0.5 - (navH + avail * 0.5) / h, 0, 0.3);
        } else {
            camDist = Math.max(aspect > 1.3 ? 7.6 : 11, 3.6 / (tanHalf * aspect));
            view.shift = aspect < 0.9 ? 0.03 : 0.1;
        }
        camera.position.set(0, 0.1, RING_Z + RING_R + camDist);
        camera.setViewOffset(w, h, 0, h * view.shift, w, h);
        camera.updateProjectionMatrix();
        gridGroup.position.copy(camera.position);
    }
    new ResizeObserver(resize).observe(stage);
    const bottomEl = document.querySelector('.hero-bottom');
    if (bottomEl) new ResizeObserver(resize).observe(bottomEl);
    resize();

    /* ---------- Interacción ---------- */
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pointer = { x: 0, y: 0, inside: false, px: 0, py: 0 };
    let drag = null, velocity = 0, lastMoveT = 0, hoverIdx = -1;

    function pick(clientX, clientY) {
        const r = canvas.getBoundingClientRect();
        ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const hits = ray.intersectObjects(tiles.filter((t) => t.visible), true);
        if (!hits.length) return -1;
        let o = hits[0].object;
        while (o && o.userData.index === undefined) o = o.parent;
        return o ? o.userData.index : -1;
    }

    canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        canvas.setPointerCapture(e.pointerId);
        wheeling = false; wheelAxis = null; clearTimeout(wheelTimer);
        drag = { x: e.clientX, startX: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
        velocity = 0;
        lastInteraction = performance.now();
        stage.classList.add('is-dragging');
    });
    canvas.addEventListener('pointermove', (e) => {
        pointer.px = e.clientX; pointer.py = e.clientY; pointer.inside = true;
        const r = canvas.getBoundingClientRect();
        pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
        if (!drag) return;
        const dx = e.clientX - drag.x;
        drag.x = e.clientX;
        drag.moved += Math.abs(dx);
        const per = Math.max(120, view.w * 0.2);
        const dpos = -dx / per;
        pos += dpos; target = pos; velocity = velocity * 0.5 + dpos * 0.5; lastMoveT = performance.now();
        lastInteraction = performance.now();
    });
    const endDrag = (e) => {
        if (!drag) return;
        const wasClick = drag.moved < 6;
        stage.classList.remove('is-dragging');
        if (wasClick) {
            const idx = pick(e.clientX, e.clientY);
            if (idx >= 0) goTo(idx); else target = Math.round(pos);
        } else {
            const v = performance.now() - lastMoveT > 90 ? 0 : velocity;
            target = Math.round(pos + clamp(v * 7, -2, 2));
        }
        drag = null;
        lastInteraction = performance.now();
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', () => { pointer.inside = false; });
    /* Panel táctil y rueda horizontal: un gesto continuo, no una suma de saltos.
       - El eje se decide al empezar el gesto y se mantiene hasta que se detienen los eventos,
         así una diagonal con dos dedos no se escapa al scroll de la página.
       - La posición sigue al dedo con un suavizado y la inercia la pone el propio sistema.
       - Al terminar, el carrusel se ajusta a la ficha más cercana teniendo en cuenta la velocidad. */
    const WHEEL_GAP = 130;            // ms sin eventos para dar el gesto por terminado
    let wheeling = false, wheelAxis = null, wheelLast = 0, wheelTimer = 0;
    let wheelPos = 0, wheelStart = 0, wheelVel = 0;

    function endWheel() {
        if (!wheeling) return;
        wheeling = false; wheelAxis = null;
        const flick = clamp(wheelVel * 4, -0.6, 0.6);
        target = Math.round(clamp(wheelPos + flick, wheelStart - 3, wheelStart + 3));
        wheelVel = 0;
        lastInteraction = performance.now();
    }

    canvas.addEventListener('wheel', (e) => {
        const now = performance.now();
        if (now - wheelLast > WHEEL_GAP) wheelAxis = null;         // gesto nuevo
        wheelLast = now;
        const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);
        if (!wheelAxis) {
            if (ax < 0.5 && ay < 0.5) return;
            wheelAxis = (ax >= 1 && ax * 1.3 >= ay) ? 'x' : 'y';
            if (wheelAxis === 'x') {
                wheeling = true;
                wheelStart = wheelPos = pos; wheelVel = 0;
                target = pos;
            }
        }
        if (wheelAxis !== 'x') return;                              // vertical: scroll normal de la página
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
        const per = clamp(view.w * 0.2, 120, 260) * 0.9;            // algo más sensible que el arrastre
        const dpos = clamp((e.deltaX * unit) / per, -0.6, 0.6);
        wheelPos = clamp(wheelPos + dpos, wheelStart - 3, wheelStart + 3);
        wheelVel = wheelVel * 0.6 + dpos * 0.4;
        lastInteraction = now;
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(endWheel, WHEEL_GAP);
    }, { passive: false });

    /* ---------- Bucle ---------- */
    let visible = true, running = true, last = performance.now();
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { threshold: 0.02 }).observe(stage);
    document.addEventListener('visibilitychange', () => { running = !document.hidden; last = performance.now(); });

    const tmp = new THREE.Vector3();
    let autoTimer = 0;
    const camLook = new THREE.Vector3();

    function frame(now) {
        requestAnimationFrame(frame);
        if (!visible || !running) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const k = 1 - Math.pow(0.0008, dt);       // suavizado independiente del fps
        const t = now / 1000;

        if (wheeling) pos += (wheelPos - pos) * Math.min(1, k * 1.7);
        else if (!drag) pos += (target - pos) * k * 0.9;
        setActive(mod(Math.round(pos), N));

        // Autoplay suave
        if (!reduceMotion && !drag && !wheeling && now - lastInteraction > 7000) {
            autoTimer += dt;
            if (autoTimer > 4.2) { autoTimer = 0; target = Math.round(target) + 1; }
        } else autoTimer = 0;

        // Hover
        const hi = (pointer.inside && !drag) ? pick(pointer.px, pointer.py) : -1;
        if (hi !== hoverIdx) { hoverIdx = hi; canvas.style.cursor = hi >= 0 ? 'pointer' : (drag ? 'grabbing' : 'grab'); }

        // Cámara con paralaje
        camera.position.x += (pointer.x * 0.35 - camera.position.x) * k * 0.6;
        camera.position.y += ((0.1 - pointer.y * 0.18) - camera.position.y) * k * 0.6;
        camLook.set(0, 0, RING_Z + RING_R * 0.55);
        camera.lookAt(camLook);

        tiles.forEach((g, i) => {
            const off = wrap(i - pos), th = off * STEP, a = Math.abs(off);
            const vis = smooth(2.9, 2.3, a);                    // 1 → visible, 0 → oculto
            g.visible = vis > 0.01;
            if (!g.visible) return;
            const bob = reduceMotion ? 0 : Math.sin(t * 0.9 + i * 1.7) * 0.06;
            g.position.set(Math.sin(th) * RING_R, bob, RING_Z + Math.cos(th) * RING_R);
            const near = 1 - Math.min(1, a);
            g.userData.hover += ((hoverIdx === i ? 1 : 0) - g.userData.hover) * k * 1.2;
            const s = (0.82 + near * 0.22 + g.userData.hover * 0.05) * vis;
            g.scale.setScalar(Math.max(0.001, s));
            const tiltY = near * pointer.x * 0.22, tiltX = near * pointer.y * 0.16;
            g.rotation.set(tiltX + Math.sin(t * 0.7 + i) * 0.025 * (reduceMotion ? 0 : 1), th + tiltY, 0);
            // brillo que recorre la cara
            const ud = g.userData;
            ud.sheenMat.opacity = 0.35 + 0.5 * near + ud.hover * 0.25;
            ud.sheen.material.map.offset.set(-0.5 + ((th * 0.9 + t * 0.06) % 1.4), 0);
        });

        cubes.forEach((m, i) => {
            const u = m.userData, a = u.a + t * u.sp - pos * STEP * 0.5;
            m.position.set(Math.sin(a) * u.r, u.y + Math.sin(t * u.s + i) * 0.25, RING_Z + Math.cos(a) * u.r * 0.9 - 1);
            m.rotation.set(t * u.s * 0.6, t * u.s * 0.4, 0);
            m.visible = m.position.z < 5.5;
        });

        gridGroup.rotation.y = -pos * STEP * 0.32 + pointer.x * 0.03;
        gridGroup.rotation.x = pointer.y * 0.02;

        renderer.render(scene, camera);
        positionTag();
    }

    function positionTag() {
        const tag = panel.tag;
        if (!tag) return;
        const g = tiles[activeIdx];
        const settled = Math.abs(pos - Math.round(pos)) < 0.06 && !drag && !wheeling;
        tmp.set(SIZE * 0.5 + 0.16, SIZE * 0.5 - 0.1, 0.2);
        g.localToWorld(tmp);
        tmp.project(camera);
        const x = (tmp.x * 0.5 + 0.5) * view.w, y = (-tmp.y * 0.5 + 0.5) * view.h;
        tag.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        tag.classList.toggle('is-on', settled);
    }

    requestAnimationFrame(frame);
    stage.classList.add('is-ready');
})();
