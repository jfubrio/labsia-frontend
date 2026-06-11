# LABSIA — Landing Frontend

Landing page con **Three.js + GSAP ScrollTrigger**, refactorizada desde un monolito `_preview-home.html` (1894 líneas) a una arquitectura modular limpia.

**Stack:** HTML5 + CSS3 + Vanilla JS (sin framework — máximo control de animaciones)
**Librerías:** Three.js r0.158, GSAP 3.12.5 + ScrollTrigger, **Geist + Geist Mono** (typeface oficial de Vercel — alineado con stack)
**Entregable:** `index.html` + `css/` + `js/` desplegable en Vercel / Cloudflare Pages

> 📝 **Contenido editable**: todos los strings, precios, URLs y datos placeholder viven en `CONTENT.md`. Empieza por ahí antes de tocar HTML.

---

## 📁 Estructura

```
labsia-landing/
├── index.html             ← HTML semántico, sólo estructura (cero <style> / <script> inline)
├── CONTENT.md             ← Datos editables centralizados (precios, copy, URLs)
├── README.md              ← Este archivo
├── sitemap.xml            ← Sitemap básico (1 URL — landing)
├── robots.txt             ← Indexación abierta
├── vercel.json            ← Headers de cache + security
├── assets/
│   ├── favicon.svg        ← Icono SVG (labs.ia con dot teal)
│   └── og-image.png       ← Social card 1200×630 (programática)
├── css/
│   ├── reset.css          ← Normalize + box-sizing + prefers-reduced-motion
│   ├── tokens.css         ← Variables CSS — fuente única de verdad
│   ├── layout.css         ← Body, topbar, hero, shells de sección, grids, footer
│   ├── components.css     ← Botones, cards, FAQ, skip-link, focus rings
│   └── animations.css     ← Keyframes + estados iniciales para GSAP
└── js/
    ├── main.js            ← Entry point
    ├── scene.js           ← Three.js: 8000 partículas + shader + esfera núcleo
    ├── hero.js            ← Timeline de entrada del hero
    ├── cursor.js          ← Magnetic buttons
    ├── how.js             ← "Cómo funciona" — pin de 3 pasos
    ├── timeline.js        ← "Anatomía de un lead" — horizontal scroll
    ├── gallery.js         ← Sectores — horizontal scroll
    ├── counters.js        ← Contadores numéricos animados
    ├── scroll.js          ← Coordinator: ScrollTrigger + reveals genéricos
    └── tweaks.js          ← Panel de tweaks (tipografía + paleta — protocolo edit mode)
```

**Cada `.js` es un IIFE que registra su API pública en `window.LABSIA.*`.**
No requiere bundler, no requiere `type="module"`. Funciona abriendo el archivo directo o vía servidor.

---

## 🎨 Design Tokens (`css/tokens.css`)

| Token              | Valor              | Uso                             |
|--------------------|--------------------|----------------------------------|
| `--bg`             | `#000000`          | Fondo principal                  |
| `--bg-soft`        | `#0a0a0c`          | Gradientes / secciones alternas  |
| `--bg-card`        | `#0f0f12`          | Cards                            |
| `--fg`             | `#f5f5f7`          | Texto primario                   |
| `--fg-soft`        | `#a1a1a6`          | Texto secundario                 |
| `--fg-faint`       | `#555555`          | Texto terciario / meta           |
| `--accent`         | `#00f5d4`          | Teal — acento principal          |
| `--accent-2`       | `#7c3aed`          | Purple — acento secundario       |
| `--accent-glow`    | `rgba(0,245,212,.5)` | Glow del cursor / hover         |
| `--border`         | `rgba(255,255,255,.08)` | Bordes sutiles              |
| `--font-display`   | `'Geist', sans`    | Todos los headings y body        |
| `--font-mono`      | `'Geist Mono'`     | Code, badges, números            |
| `--container`      | `1280px`           | Ancho máximo de contenido        |
| `--section-pad-y`  | `120px`            | Padding vertical de sección base |

Si necesitas un color o tamaño 2+ veces, **vive aquí**, no inline.

---

## 🗺️ Mapa de secciones

| ID            | Sección          | Animación principal                                       |
|---------------|------------------|------------------------------------------------------------|
| —             | `top-bar`        | Fixed, blur en fondo                                       |
| `.hero`       | Hero             | Canvas Three.js + timeline GSAP de entrada                 |
| `#how`        | Cómo funciona    | **Pin 300vh** · 3 pasos cambian según progress             |
| `#stack`      | Stack tecnológico| Cards reveal en cascada + spotlight radial al hover        |
| `#timeline`   | Timeline 24h     | **Pin horizontal** · scroll vertical → traslación X        |
| `#cases`      | Galería casos    | **Pin horizontal** · centrado en viewport                  |
| `#compare`    | Comparativa      | Tabla, filas reveal una a una                              |
| `#testimonials`| Testimonios     | Stats con contador animado + 3 cards stagger               |
| `#faq`        | FAQ              | `<details>` con plus → cross, items en cascada             |
| `#pricing`    | Pricing          | Card principal + features li-by-li + add-ons               |
| —             | CTA final        | Glow radial centrado                                       |
| —             | Footer           | —                                                          |

---

## 🧠 Three.js — qué renderiza (`js/scene.js`)

Una **esfera Fibonacci de 8000 partículas** (3000 en móvil) con un **shader custom** que añade una onda radial al tamaño del punto y un disco con alpha smooth en el fragment. Aditivo + sin depth-write → glow blend natural.

Encima, una **esfera núcleo pulsante** con shader fresnel que pulsa cada 2s y mezcla teal ↔ purple. Toda la escena rota lentamente con el clock y se inclina con el cursor (lerp 0.04).

**Performance:**
- `pixelRatio` capado a 2 (evita 3x en retina)
- `PARTICLE_COUNT = 3000` en móvil (vs 8000 desktop)
- `cancelAnimationFrame` cuando la pestaña pierde foco (`visibilitychange`)
- `depthWrite: false` en ambos materiales — sin Z-fighting de partículas

---

## 📜 GSAP — orquestación (`js/scroll.js` + módulos)

```
main.js
 └─ DOMContentLoaded
     ├─ initScene(canvas)          // crea window.__three
     ├─ initCursor()                // magnetic buttons
     ├─ animateHero()               // timeline de entrada
     └─ initScrollAnimations()
         ├─ ScrollTrigger.registerPlugin
         ├─ hero scroll → particles.rotation.y += π
         ├─ initHow()        ← 3-step pin
         ├─ initTimeline()   ← horizontal pin (24h)
         ├─ initGallery()    ← horizontal pin (cases)
         ├─ initCounters()   ← tween numérico
         └─ reveals genéricos: stack, compare, testimonials, faq, pricing
```

Cada módulo es **opcional**: si su `id`/elemento no existe en el DOM, el módulo hace early return sin tronar.

---

## 📱 Responsive · breakpoints

| Breakpoint     | Cambio                                                                |
|----------------|------------------------------------------------------------------------|
| `< 768px`      | Nav links ocultos · padding reducido · stack grid 3→2 cols · stats 4→2 |
| `< 768px`      | Three.js: `PARTICLE_COUNT = 3000` (vs 8000)                            |
| `< 768px`      | Timeline + Gallery: SIN pin horizontal · scroll natural                |
| `< 968px`      | How: grid 2→1 col · padding aumentado                                  |
| `< 968px`      | Testimonials grid 3→1 col                                              |
| `> 1280px`     | `max-width: 1280px` centrado en todas las secciones                    |

---

## ⚡ Performance · checklist

- ✅ Canvas Three.js en `position: absolute` dentro de `.hero` — no re-layout
- ✅ `will-change: transform, opacity` en CSS (no en JS) para cards animadas
- ✅ Fuentes con `display=swap` — no bloquea render
- ✅ `setPixelRatio(min(devicePixelRatio, 2))` — evita 3x en retina
- ✅ `cancelAnimationFrame` al perder foco de pestaña
- ✅ `prefers-reduced-motion` desactiva animaciones largas
- ✅ Imágenes con `loading="lazy"` + `aspect-ratio` definido — sin CLS
- ✅ ScrollTrigger usa `scrub: 1` con interpolación — más smooth que `scrub: true`

---

## 🚀 Deploy (`vercel.json`)

CSS y JS con cache inmutable de 1 año, HTML siempre revalida.
Suficiente — no hay routing, no hay edge functions.

```bash
# Local
npx serve labsia-landing/

# Vercel CLI
cd labsia-landing/
vercel deploy --prod
```

---

## 📈 Métricas objetivo

| Métrica                          | Objetivo                |
|----------------------------------|-------------------------|
| FPS Three.js (desktop)           | > 55 fps sostenido      |
| FPS Three.js (mobile)            | > 30 fps                |
| Lighthouse Performance           | > 85                    |
| LCP (Largest Contentful Paint)   | < 2.5s                  |
| CLS (Cumulative Layout Shift)    | < 0.1                   |
| Time to first animation          | < 0.5s                  |

---

## 🔧 Cómo añadir una sección nueva

1. **HTML** — agregar `<section>` en `index.html`
2. **Layout CSS** — shell + grid en `css/layout.css`
3. **Components CSS** — cards / botones específicos en `css/components.css`
4. **JS** (opcional) — si tiene animación compleja, crear `js/mi-seccion.js` con un IIFE que exporte `window.LABSIA.initMiSeccion()`. Para reveals simples, agregarlos directamente en `js/scroll.js`.
5. **Wire-up** — agregar `<script src="js/mi-seccion.js"></script>` antes de `main.js`, y la llamada `initMiSeccion()` en `scroll.js`.

---

*Arquitectura v1.0 — labsia.mx landing*
*Refactor monolito → modular · Three.js r0.158 + GSAP 3.12.5*
