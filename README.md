# Portfolio

Mi portfolio web: una página única centrada en mis proyectos, con un carrusel 3D en el inicio, una línea de scroll que enlaza las secciones y un explorador de tecnologías por áreas.

**Web:** <https://roberto-borrallo.vercel.app>

## Qué incluye

- **Proyectos en bandas alternas:** captura grande a un lado y lo esencial al otro (descripción, tecnologías, demo y código), los puntos clave debajo y los datos, decisiones y ejemplos en un desplegable.
- **Carrusel 3D** en Three.js con gestos de rueda y panel táctil: bloqueo de eje, suavizado y ajuste al elemento más cercano al soltar.
- **Línea de scroll** que recorre los proyectos, las tecnologías y el contacto, con el porcentaje de avance.
- **Explorador de stack** con pestañas navegables por teclado.
- **Animaciones** con GSAP, inclinación 3D de las capturas de los proyectos y botones magnéticos solo en dispositivos con puntero fino.
- **Cristal líquido** en la barra de navegación, los botones, las etiquetas y la pastilla «Ver demo» de las capturas: cada elemento genera en un canvas un mapa de desplazamiento a su medida, y un filtro SVG en `backdrop-filter` curva el fondo en el borde, como una lente. Solo los navegadores basados en Chromium pintan ese filtro; Safari y Firefox muestran un desenfoque normal.
- **Accesibilidad y rendimiento:** respeta `prefers-reduced-motion` y `prefers-reduced-transparency`, roles ARIA en las pestañas y carga sin dependencias externas.

## Tecnología

HTML, CSS y JavaScript sin framework ni paso de compilación. Three.js (r128), GSAP y Font Awesome se sirven desde la carpeta `vendor/`, sin CDN.

```
index.html     estructura y contenido
styles.css     estilos
js/hero.js     carrusel 3D (Three.js)
js/trail.js    línea de scroll
js/main.js     interacciones generales, cristal líquido y explorador de stack
vendor/        librerías incluidas en el repositorio
```

## Ejecutar en local

Basta con un servidor estático:

```bash
python -m http.server 5173
```

Y abrir `http://localhost:5173`.

## Despliegue

Vercel: `main` es producción y el resto de ramas generan una vista previa.
