# Portfolio

Mi portfolio web: una página única con un carrusel 3D en el inicio, una línea de scroll que enlaza las secciones y un explorador de tecnologías por áreas.

**Web:** <https://portfolio-eight-psi-g07adxw176.vercel.app>

## Qué incluye

- **Carrusel 3D** en Three.js con gestos de rueda y panel táctil: bloqueo de eje, suavizado y ajuste al elemento más cercano al soltar.
- **Línea de scroll** que recorre el proyecto, las tecnologías y el contacto, con el porcentaje de avance.
- **Explorador de stack** con pestañas navegables por teclado.
- **Animaciones** con GSAP, inclinación 3D de tarjetas y botones magnéticos solo en dispositivos con puntero fino.
- **Accesibilidad y rendimiento:** respeta `prefers-reduced-motion`, roles ARIA en las pestañas y carga sin dependencias externas.

## Tecnología

HTML, CSS y JavaScript sin framework ni paso de compilación. Three.js (r128), GSAP y Font Awesome se sirven desde la carpeta `vendor/`, sin CDN.

```
index.html     estructura y contenido
styles.css     estilos
js/hero.js     carrusel 3D (Three.js)
js/trail.js    línea de scroll
js/main.js     interacciones generales y explorador de stack
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
