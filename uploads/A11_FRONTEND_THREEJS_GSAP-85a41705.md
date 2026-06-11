# LABSIA — ARQUITECTURA FRONTEND
## Landing page con Three.js + GSAP ScrollTrigger

**Stack:** HTML5 + CSS3 + Vanilla JS (sin framework — máximo control de animaciones)
**Librerías:** Three.js r128, GSAP 3.12 + ScrollTrigger, Google Fonts
**Entregable:** `index.html` + `css/` + `js/` desplegable en Vercel / Cloudflare Pages

---

## DECISIÓN DE STACK

Se eligió Vanilla JS sobre Next.js por una razón simple:
Three.js + GSAP necesitan control total del ciclo de vida del DOM y el RAF (requestAnimationFrame).
Un framework introduce overhead de hidratación que produce jank visible en animaciones complejas.

Si el dashboard (DOC 19) es Next.js, el landing vive en un repo separado.

---

## ESTRUCTURA DE CARPETAS

```
labsia-landing/
├── index.html
├── css/
│   ├── reset.css          ← Normalize + box-sizing
│   ├── tokens.css         ← Variables CSS (colores, tipografía, espaciado)
│   ├── layout.css         ← Grid, secciones, nav, footer
│   ├── components.css     ← Botones, cards, badges, phone mock
│   └── animations.css     ← Clases de estado para animaciones CSS puras
├── js/
│   ├── main.js            ← Entry point. Importa y coordina todo
│   ├── scene.js           ← Three.js: partículas + líneas + cámara
│   ├── scroll.js          ← GSAP ScrollTrigger: todas las animaciones de scroll
│   ├── hero.js            ← Animación de entrada del hero
│   ├── chat.js            ← Simulación de chat en el phone mock
│   ├── counters.js        ← Contadores de stats animados
│   └── cursor.js          ← Cursor personalizado
├── assets/
│   └── fonts/             ← Self-hosted si no hay CDN (opcional)
└── vercel.json            ← Config de deploy (headers de cache)
```

---

## TOKENS DE DISEÑO — `css/tokens.css`

```css
:root {
  /* Colores */
  --bg:         #04040A;      /* Fondo principal */
  --surface:    #0C0C16;      /* Cards, secciones alternadas */
  --border:     #1A1A2E;      /* Bordes sutiles */
  --text:       #E8E6DF;      /* Texto primario */
  --muted:      #6B6B7E;      /* Texto secundario */
  --teal:       #00D9A0;      /* Acento principal */
  --teal-dim:   #00D9A018;    /* Fondo acento */
  --orange:     #FF5E3A;      /* Acento de alerta / urgencia */

  /* Tipografía */
  --font-display: 'Syne', sans-serif;
  --font-mono:    'Space Mono', monospace;

  /* Espaciado base */
  --section-pad:  160px;
  --container:    1200px;
  --gap:          2px;        /* Gap entre cards (tight grid) */

  /* Animación */
  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.87, 0, 0.13, 1);
}
```

**Tipografías (Google Fonts — cargar en `<head>`):**
```html
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
```

---

## CDN — `<head>` del index.html

```html
<!-- Three.js -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>

<!-- GSAP core -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>

<!-- ScrollTrigger plugin -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"></script>
```

Todos los dominios están en la whitelist de red del proyecto.

---

## SECCIONES Y COMPONENTES

### Mapa de secciones

```
<nav>                          ← Fijo. Scroll → fondo + blur
<section id="hero">            ← 100vh. Canvas Three.js detrás. Texto animado.
<section id="problema">        ← 3 cards con stats. Fade up on scroll.
<section id="como">            ← 2 cols: pasos (izq) + phone mock (der, sticky)
<section id="features">        ← Grid 3x2. Cards reveal en cascada.
<section id="planes">          ← 3 planes de precio. Slide up.
<section id="cta">             ← CTA final. Texto grande + botón.
<footer>                       ← Links y copyright.
```

---

## THREE.JS — `js/scene.js`

### Qué renderiza

Una red de partículas flotantes que representan leads/mensajes en movimiento. Las partículas más cercanas se conectan con líneas translúcidas. El grupo rota lentamente. El mouse inclina la cámara levemente.

### Implementación

```javascript
// js/scene.js
export function initScene(canvasEl) {

  const W = window.innerWidth
  const H = window.innerHeight

  // 1. SETUP BASE
  const scene    = new THREE.Scene()
  const camera   = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000)
  const renderer = new THREE.WebGLRenderer({
    canvas:    canvasEl,
    antialias: true,
    alpha:     true,          // fondo transparente — el CSS controla el color
  })
  renderer.setSize(W, H)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  camera.position.z = 30

  // 2. PARTÍCULAS
  const PARTICLE_COUNT = 500
  const positions = new Float32Array(PARTICLE_COUNT * 3)
  const colorsArr = new Float32Array(PARTICLE_COUNT * 3)

  const COLOR_TEAL   = new THREE.Color('#00D9A0')
  const COLOR_ORANGE = new THREE.Color('#FF5E3A')
  const COLOR_WHITE  = new THREE.Color('#E8E6DF')

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Distribución esférica uniforme
    const r     = 12 + Math.random() * 8
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(2 * Math.random() - 1)

    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)

    // 70% teal, 20% white, 10% orange
    const rand = Math.random()
    const col  = rand < 0.70 ? COLOR_TEAL : rand < 0.90 ? COLOR_WHITE : COLOR_ORANGE
    colorsArr[i * 3]     = col.r
    colorsArr[i * 3 + 1] = col.g
    colorsArr[i * 3 + 2] = col.b
  }

  const particleGeo = new THREE.BufferGeometry()
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  particleGeo.setAttribute('color',    new THREE.BufferAttribute(colorsArr, 3))

  const particleMat = new THREE.PointsMaterial({
    size:         0.15,
    vertexColors: true,
    transparent:  true,
    opacity:      0.8,
    sizeAttenuation: true,
  })

  const particles = new THREE.Points(particleGeo, particleMat)

  // 3. LÍNEAS DE CONEXIÓN
  // Se calculan una vez al inicio. El grupo rota junto con las partículas.
  const linePositions = []
  const MAX_CONNECTIONS = 200
  const CONNECT_DIST   = 4.5
  let   connections    = 0

  for (let i = 0; i < PARTICLE_COUNT && connections < MAX_CONNECTIONS; i++) {
    for (let j = i + 1; j < PARTICLE_COUNT && connections < MAX_CONNECTIONS; j++) {
      const dx = positions[i*3]   - positions[j*3]
      const dy = positions[i*3+1] - positions[j*3+1]
      const dz = positions[i*3+2] - positions[j*3+2]
      if (Math.sqrt(dx*dx + dy*dy + dz*dz) < CONNECT_DIST) {
        linePositions.push(
          positions[i*3], positions[i*3+1], positions[i*3+2],
          positions[j*3], positions[j*3+1], positions[j*3+2]
        )
        connections++
      }
    }
  }

  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3))

  const lineMat  = new THREE.LineBasicMaterial({ color: 0x00D9A0, transparent: true, opacity: 0.08 })
  const lines    = new THREE.LineSegments(lineGeo, lineMat)

  // 4. GRUPO — rota todo junto
  const group = new THREE.Group()
  group.add(particles)
  group.add(lines)
  scene.add(group)

  // 5. MOUSE — inclina el grupo suavemente
  let mouseX = 0
  let mouseY = 0
  let targetX = 0
  let targetY = 0

  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth  - 0.5) * 0.3
    mouseY = (e.clientY / window.innerHeight - 0.5) * 0.3
  })

  // 6. RESIZE
  window.addEventListener('resize', () => {
    const w = window.innerWidth
    const h = window.innerHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  })

  // 7. LOOP DE ANIMACIÓN
  let frameId
  const clock = new THREE.Clock()

  function animate() {
    frameId = requestAnimationFrame(animate)
    const t = clock.getElapsedTime()

    // Rotación lenta constante
    group.rotation.y = t * 0.04
    group.rotation.x = t * 0.015

    // Lerp hacia el mouse
    targetX += (mouseX - targetX) * 0.03
    targetY += (mouseY - targetY) * 0.03
    group.rotation.x += targetY
    group.rotation.y += targetX

    renderer.render(scene, camera)
  }

  animate()

  // 8. FADE IN inicial con GSAP (se llama desde hero.js)
  return {
    particles,
    lines,
    group,
    destroy: () => {
      cancelAnimationFrame(frameId)
      renderer.dispose()
    }
  }
}
```

**Reglas de performance:**
- `PixelRatio` máximo 2 (evita resoluciones 3x en móvil)
- Líneas calculadas una vez, no en cada frame
- Si `window.innerWidth < 768`: reducir `PARTICLE_COUNT` a 200

---

## GSAP — `js/scroll.js`

### Registro del plugin

```javascript
// js/scroll.js
import { initCounters } from './counters.js'
import { initChat } from './chat.js'

export function initScrollAnimations() {
  gsap.registerPlugin(ScrollTrigger)

  // ── NAVBAR — fondo al hacer scroll ──
  ScrollTrigger.create({
    start: '80px top',
    onEnter:      () => document.getElementById('nav').classList.add('scrolled'),
    onLeaveBack:  () => document.getElementById('nav').classList.remove('scrolled'),
  })

  // ── PROBLEMA — cards en cascada ──
  gsap.utils.toArray('.problema-card').forEach((card, i) => {
    gsap.to(card, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: 'power3.out',
      delay: i * 0.12,
      scrollTrigger: {
        trigger: card,
        start: 'top 85%',
      }
    })
  })

  // ── CÓMO FUNCIONA — pasos slide desde izquierda ──
  gsap.utils.toArray('.step').forEach((step, i) => {
    gsap.to(step, {
      opacity: 1,
      x: 0,
      duration: 0.6,
      ease: 'power2.out',
      delay: i * 0.1,
      scrollTrigger: {
        trigger: step,
        start: 'top 88%',
      }
    })
  })

  // ── PHONE MOCK — aparece y baja suavemente ──
  gsap.to('#phoneMock', {
    opacity: 1,
    y: 0,
    duration: 0.8,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#phoneMock',
      start: 'top 80%',
      onEnter: () => initChat(),    // activa la simulación de chat
    }
  })

  // ── FEATURES — grid en cascada ──
  gsap.utils.toArray('.feature-card').forEach((card, i) => {
    gsap.to(card, {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: 'power2.out',
      delay: i * 0.08,
      scrollTrigger: {
        trigger: card,
        start: 'top 88%',
      }
    })
  })

  // ── PLANES — slide up ──
  gsap.utils.toArray('.plan-card').forEach((card, i) => {
    gsap.to(card, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: 'power3.out',
      delay: i * 0.15,
      scrollTrigger: {
        trigger: card,
        start: 'top 85%',
      }
    })
  })

  // ── CTA FINAL ──
  gsap.to('#cta', {
    opacity: 1,
    y: 0,
    duration: 0.8,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#cta',
      start: 'top 80%',
    }
  })

  // ── STATS — counters ──
  ScrollTrigger.create({
    trigger: '.hero-stats',
    start: 'top 85%',
    onEnter: () => initCounters(),
  })
}
```

---

## ANIMACIÓN DEL HERO — `js/hero.js`

Secuencia de entrada. Se ejecuta sin scroll trigger — corre al cargar la página.

```javascript
// js/hero.js
export function animateHero() {

  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } })

  // 1. Tag superior
  tl.to('.hero-tag', {
    opacity: 1,
    duration: 0.6,
  }, 0.3)

  // 2. Líneas del H1 — cada span.line-inner sube desde abajo
  tl.to('.hero-h1 .line-inner', {
    y: '0%',
    duration: 0.9,
    stagger: 0.08,
  }, 0.5)
  // Hacer visible el h1 (estaba opacity:0)
  tl.set('.hero-h1', { opacity: 1 }, 0.5)

  // 3. Subtítulo
  tl.to('.hero-sub', {
    opacity: 1,
    y: 0,
    duration: 0.7,
  }, 1.0)

  // 4. CTAs
  tl.to('.hero-ctas', {
    opacity: 1,
    y: 0,
    duration: 0.6,
  }, 1.2)

  // 5. Stats
  tl.to('.hero-stats', {
    opacity: 1,
    duration: 0.6,
  }, 1.4)
}
```

**CSS de soporte — estado inicial de los elementos del hero:**
```css
.hero-tag         { opacity: 0; }
.hero-h1          { opacity: 0; }
.hero-h1 .line    { overflow: hidden; }
.hero-h1 .line-inner { transform: translateY(100%); }
.hero-sub         { opacity: 0; transform: translateY(20px); }
.hero-ctas        { opacity: 0; transform: translateY(20px); }
.hero-stats       { opacity: 0; }
```

---

## SIMULACIÓN DE CHAT — `js/chat.js`

Se activa cuando el phone mock entra en viewport. Simula una conversación real.

```javascript
// js/chat.js
const MESSAGES = [
  { dir: 'incoming', text: 'Hola, ¿cuánto cuesta una limpieza dental?', delay: 0 },
  { dir: 'typing',   text: '',                                            delay: 800 },
  { dir: 'outgoing', text: '¡Hola! Nuestras limpiezas están desde $650. ¿Te gustaría agendar una cita esta semana? 😊', delay: 2200 },
  { dir: 'incoming', text: 'Sí, el jueves estaría bien', delay: 3800 },
  { dir: 'typing',   text: '',                            delay: 4400 },
  { dir: 'outgoing', text: 'Perfecto. Te confirmo el jueves a las 10:30am con la Dra. Ramírez. ¿Te funciona? ✅', delay: 5600 },
  { dir: 'incoming', text: '¡Sí! Muchas gracias 🙌', delay: 7000 },
]

export function initChat() {
  const area = document.getElementById('chatArea')
  if (!area || area.dataset.started) return
  area.dataset.started = 'true'

  MESSAGES.forEach(({ dir, text, delay }) => {
    setTimeout(() => {
      if (dir === 'typing') {
        const typing = document.createElement('div')
        typing.className = 'chat-bubble incoming typing-wrap'
        typing.innerHTML = `
          <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>`
        area.appendChild(typing)
        gsap.fromTo(typing, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3 })
      } else {
        // Remover typing si existe
        area.querySelector('.typing-wrap')?.remove()

        const bubble = document.createElement('div')
        bubble.className = `chat-bubble ${dir}`
        bubble.innerHTML = `<div class="bubble">${text}</div>`
        area.appendChild(bubble)
        gsap.fromTo(bubble, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35 })
        area.scrollTop = area.scrollHeight
      }
    }, delay)
  })
}
```

---

## CONTADORES ANIMADOS — `js/counters.js`

```javascript
// js/counters.js
export function initCounters() {
  document.querySelectorAll('.count').forEach(el => {
    const target = parseInt(el.dataset.target, 10)
    gsap.to({ val: 0 }, {
      val: target,
      duration: 1.8,
      ease: 'power2.out',
      onUpdate() {
        el.textContent = Math.round(this.targets()[0].val)
      }
    })
  })
}
```

---

## CURSOR PERSONALIZADO — `js/cursor.js`

```javascript
// js/cursor.js
export function initCursor() {
  const dot  = document.getElementById('cursor')
  const ring = document.getElementById('cursorRing')

  let ringX = 0, ringY = 0
  let dotX  = 0, dotY  = 0

  document.addEventListener('mousemove', (e) => {
    dotX  = e.clientX
    dotY  = e.clientY
    gsap.to(dot,  { x: dotX,  y: dotY,  duration: 0.1 })
    gsap.to(ring, { x: dotX,  y: dotY,  duration: 0.25 })
  })

  // Crecer en hover de links/botones
  document.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('mouseenter', () => {
      gsap.to(ring, { scale: 2, opacity: 0.3, duration: 0.3 })
    })
    el.addEventListener('mouseleave', () => {
      gsap.to(ring, { scale: 1, opacity: 0.5, duration: 0.3 })
    })
  })
}
```

---

## ENTRY POINT — `js/main.js`

```javascript
// js/main.js
import { initScene }            from './scene.js'
import { animateHero }          from './hero.js'
import { initScrollAnimations } from './scroll.js'
import { initCursor }           from './cursor.js'

document.addEventListener('DOMContentLoaded', () => {

  // Three.js — canvas fijo
  const canvas = document.getElementById('canvas')
  initScene(canvas)

  // Cursor custom
  initCursor()

  // Hero: secuencia de entrada
  animateHero()

  // Scroll: todas las animaciones de secciones
  initScrollAnimations()
})
```

> Si se usa sin bundler (script tags directos), agregar `type="module"` en cada `<script>`.

---

## RESPONSIVE — BREAKPOINTS

| Breakpoint | Cambio |
|---|---|
| `< 768px` | Grid de 3 cols → 1 col. Nav links ocultos. Padding reducido. |
| `< 768px` | Three.js: `PARTICLE_COUNT = 200`, `MAX_CONNECTIONS = 80` |
| `< 768px` | Phone mock oculto en sección "Cómo funciona" |
| `768px–1024px` | Grid 2 cols para features. Plans en scroll horizontal. |
| `> 1200px` | `max-width: 1200px` centrado en todas las secciones |

---

## PERFORMANCE — CHECKLIST

```
□ Canvas Three.js en `position: fixed` — no re-layout en scroll
□ `will-change: transform` en elementos que GSAP anima
□ Fuentes con `display=swap` — no bloquea render
□ Imágenes (si se agregan): WebP + lazy loading
□ ScrollTrigger.refresh() después de cualquier cambio de altura dinámico
□ `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` — evita 3x en retina
□ `cancelAnimationFrame` al salir de la página (visibilitychange)
□ GSAP `matchMedia` para desactivar animaciones complejas en móvil
```

---

## DESACTIVAR ANIMACIONES EN MÓVIL — GSAP matchMedia

```javascript
// En scroll.js — envolver las animaciones de scroll
const mm = gsap.matchMedia()

mm.add('(min-width: 769px)', () => {
  // Animaciones de desktop (ScrollTrigger completo)
  initScrollAnimations()
})

mm.add('(max-width: 768px)', () => {
  // Versión reducida — solo fade simple sin trigger complejo
  gsap.utils.toArray('[data-animate]').forEach(el => {
    gsap.to(el, { opacity: 1, y: 0, duration: 0.5,
      scrollTrigger: { trigger: el, start: 'top 90%' }
    })
  })
})
```

---

## DEPLOY — `vercel.json`

```json
{
  "headers": [
    {
      "source": "/js/(.*)\\.js",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/css/(.*)\\.css",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/index.html",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }]
    }
  ]
}
```

---

## ORDEN DE IMPLEMENTACIÓN RECOMENDADO

```
Día 1 — Base
  □ index.html estructura completa (HTML + CSS tokens + layout)
  □ scene.js: Three.js funcionando con partículas
  □ Verificar canvas + fondo + fps > 55

Día 2 — Animaciones hero + scroll
  □ hero.js: secuencia de entrada
  □ scroll.js: ScrollTrigger en todas las secciones
  □ cursor.js

Día 3 — Componentes dinámicos + pulido
  □ chat.js: simulación de conversación
  □ counters.js: stats animados
  □ Responsive: mobile < 768px
  □ Performance: PixelRatio, matchMedia

Día 4 — Deploy
  □ vercel.json + headers de cache
  □ Prueba en 3G simulado (Chrome DevTools)
  □ Lighthouse: objetivo > 85 en Performance
```

---

## MÉTRICAS DE ACEPTACIÓN

| Métrica | Objetivo |
|---|---|
| FPS Three.js (desktop) | > 55 fps sostenido |
| FPS Three.js (mobile) | > 30 fps |
| Lighthouse Performance | > 85 |
| LCP (Largest Contentful Paint) | < 2.5s |
| CLS (Cumulative Layout Shift) | < 0.1 |
| Tiempo hasta primera animación visible | < 0.5s tras load |

---

*Frontend Architecture v1.0 — labsia.mx landing*
*Three.js r128 + GSAP 3.12 + ScrollTrigger*
