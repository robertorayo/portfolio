# CLAUDE.md — Portfolio

Portfolio web personal de una sola página. Producción: <https://portfolio-eight-psi-g07adxw176.vercel.app>
Repo: `robertorayo/portfolio` · Las preferencias generales (idioma, modo de trabajo, seguridad, Git) están en el `CLAUDE.md` global.

## Stack
- **HTML + CSS + JavaScript vanilla**, sin framework, sin `package.json` y sin paso de compilación.
- Librerías locales en `vendor/` (no se usa CDN): Three.js r128, GSAP, Font Awesome y fuentes (Outfit, Plus Jakarta Sans, JetBrains Mono).
- No añadas npm, bundlers ni frameworks sin preguntar antes. Si hace falta una librería nueva, va en `vendor/`, no por CDN.

## Estructura
```
index.html     estructura, contenido, SEO (meta, Open Graph, JSON-LD)
styles.css     todos los estilos (variables en :root)
js/hero.js     carrusel 3D del inicio (Three.js): rueda, panel táctil, inercia, ajuste
js/trail.js    línea de trayectoria al hacer scroll (SVG, estaciones, % de avance)
js/main.js     scrollbar flotante, tilt, botones magnéticos, reveal, nav activa, explorador de stack, copiar email
vendor/        librerías y fuentes incluidas en el repo
*.png, *.jpg   imágenes (og-image, previews de proyectos, logos)
```
Secciones de `index.html`: `#inicio` (hero), `#proyecto`, `#habilidades`, `#contacto`.

## Ejecutar en local
Servidor estático (configurado en `.claude/launch.json`):
```
python -m http.server 5173
```
y abrir `http://localhost:5173`.

## Convenciones de código
- Cada archivo JS es una IIFE con `'use strict'`; sin módulos ES ni globals nuevas.
- Comentarios en español, con cabecera de bloque `/* ==== ... ==== */` al inicio de cada archivo/sección.
- Comprueba que los elementos existen antes de usarlos (`if (!el) return;`).
- Listeners de `scroll`/`resize` con `{ passive: true }` y trabajo visual dentro de `requestAnimationFrame`.
- Respeta siempre `prefers-reduced-motion` y limita los efectos de puntero (tilt, magnéticos) a `(hover: hover) and (pointer: fine)`.
- Mantén la accesibilidad: roles ARIA en las pestañas, navegación por teclado, `aria-label` en secciones.
- **Diseño monocromático** (negro, grafito, plata, blanco): usa las variables de `:root` (`--bg-*`, `--text-*`, `--border-*`, `--font-*`, `--ease`); no metas colores sueltos.
- Puntos de corte usados: 1240, 1100, 1020, 900, 860, 760 y 560 px. Reutilízalos antes de crear nuevos.

## Caché de recursos
`index.html` carga CSS y JS con `?v=N` (ahora `v=41`). **Si cambias `styles.css` o cualquier `js/*.js`, sube el número en las 4 referencias** para que Vercel/el navegador no sirvan la versión vieja.

## Criterios de contenido
- Contenido **técnico y honesto**: no afirmar funcionalidades que el código de los proyectos no respalde.
- Sin datos personales ni búsqueda de empleo (solo en Contacto), sin menciones a IA/Claude y sin planes de futuro ("pendiente", "siguiente paso").
- Textos en español de España.

## Verificación antes de terminar
No hay build, lint ni tests automatizados. En su lugar:
1. Abrir en el navegador y revisar que **la consola no tenga errores**.
2. Comprobar escritorio y móvil (al menos 1440, 1024, 768 y 375 px de ancho) y con `prefers-reduced-motion` activo.
3. Probar el carrusel con rueda, arrastre y panel táctil, la línea de scroll y las pestañas del stack con teclado.
4. Si cambias contenido o estructura, actualizar el `README.md`.
5. Si la página cambia de forma visible, revisar `og-image.png` y los metadatos SEO.

## Seguridad
- Sitio estático: vigila sobre todo XSS (nada de `innerHTML` con datos externos), enlaces externos con `rel="noopener noreferrer"` y no exponer emails/datos más allá de lo previsto.
- Valora cabeceras de seguridad (CSP, etc.) mediante `vercel.json` si se plantea.

## Git y despliegue
- Ramas: `develop` (trabajo diario) y `main` (producción en Vercel). Cualquier otra rama genera una preview.
- Commit y push a **`develop`**. Pasar a `main` solo cuando yo lo pida.
