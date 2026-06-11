# 🎨 ASSETS-VISUALES · Brief de producción LabsIA Landing

> **Versión:** v1.0 · 2026-05-18
> **Audiencia:** Tú (producción de assets) · yo (integración en HTML/CSS)
> **Modo de trabajo:** paralelo. Tú generas en herramientas externas (Midjourney/Sora/Veo/Runway/Nano Banana), yo integro cuando llegue cada asset.

---

## 1. Dirección visual macro

### Mood
- **Dark · technical · premium · 3D depth · neon-cyan accent**
- Lectura: "SaaS B2B serio para PyMEs mexicanas pero diseñado con el cuidado de un Linear / Vercel / Anthropic"

### Paleta exacta (ya en `css/tokens.css`)
```
--bg:           #000000   ← fondo principal (negro puro)
--bg-soft:      #0a0a0c   ← secciones alternas
--bg-card:      #0f0f12   ← cards
--accent:       #00f5d4   ← TEAL · acento principal (use sparingly)
--accent-2:     #7c3aed   ← PURPLE · acento secundario (gradients)
--fg:           #f5f5f7   ← texto primario
--fg-soft:      #a1a1a6   ← texto secundario
--border:       rgba(255,255,255,.08)
```

**Regla:** todos los assets DEBEN respetar esta paleta. Si vienen de Midjourney/Sora con colores fuera, post-procesar.

### Tipografía mostrada en assets
- Sans display + body: **Geist** (Vercel's typeface)
- Mono / código / números: **Geist Mono**
- No usar Inter, no usar sistema, no usar Roboto

### Referencias visuales (mostrarle a tu IA como style ref)
| Marca | Por qué la copiamos |
|---|---|
| linear.app | Hero con shader/gradient · spacing premium |
| vercel.com/home | 3D isometric renders en gradient bg negro |
| anthropic.com | Tipografía + tonos · cero stock photos |
| raycast.com | Iconos 3D estilizados con depth · neon glow |
| stripe.com (dark) | Estructura de planes + checkmarks · clean |

### Estilo prohibido (NO entregar nada de esto)
- Stock photos (gente sonriendo señalando laptops)
- Ilustraciones flat / corporativas 2D
- Mockups de iPhone con captura adentro · plano
- Photoshop básico (sombras genéricas, lens flares)
- Emojis grandes como hero

---

## 2. Sistema 3D priorizado · LO QUE MÁS VENDE

> **Importante:** el cliente B2B mexicano que paga $18k MXN/mes evalúa "se ve serio" en los primeros 2 segundos. El 3D depth es lo que separa SaaS premium de "otro CRM más". **PRIORIDAD MÁXIMA** a estos 6 elementos.

### 2.1 [HERO 3D · existente, reforzar] Three.js particle scene
- **Ubicación:** `js/scene.js` · canvas detrás del hero
- **Estado actual:** 8000 partículas + esfera núcleo + shader
- **Qué falta:** parallax al scroll · glow teal más intenso al hover · respuesta sutil al mouse
- **Acción tuya:** _ninguna, lo refino yo en CSS/JS_
- **Acción mía:** refinar shader cuando me lo confirmes

### 2.2 [3D HERO PRODUCT SHOT] Lead card flotante + isometric dashboard
- **Ubicación:** sección hero · lado derecho del título (o debajo en mobile)
- **Tamaño:** 1600×1200 PNG transparente + WebP fallback
- **Estilo:** isometric 3D, dark mode, glow teal en bordes, depth shadow
- **Output esperado:** una "card de lead" 3D flotando frente a un kanban dashboard 3D al fondo, ambos con depth real

**Prompt Midjourney v6:**
```
isometric 3D render of a SaaS CRM dashboard floating card, dark mode interface,
showing a lead conversation: "Pedro González · Botox · 3s response", with a
secondary kanban board floating in deep background, geometric depth, neon cyan
accent #00f5d4, purple secondary #7c3aed, pure black background, soft volumetric
glow, glass morphism, premium SaaS aesthetic like vercel.com or linear.app,
sharp typography Geist Mono, ultra detailed, octane render, no people --ar 16:9 --v 6 --style raw
```

**Prompt Nano Banana (más rápido):**
```
3D isometric SaaS dashboard card floating in dark space, lead profile shown,
neon teal #00f5d4 glow, premium B2B tech aesthetic, vercel.com style depth,
dark background, transparent edges, 4K
```

---

### 2.3 [3D STACK ICONS] 6 iconos 3D para sección `#stack`
- **Ubicación:** sección `#stack` · uno por card de las 6 tecnologías
- **Tamaño:** 256×256 PNG transparente cada uno · 6 archivos
- **Estilo:** iconos 3D estilizados (no realistas), glass + neon edge, todos coherentes en luz y ángulo

| # | Asset | Concepto 3D |
|---|---|---|
| 1 | `stack-whatsapp.png` | Burbuja de chat 3D verde-WhatsApp con glow teal |
| 2 | `stack-openai.png` | Esfera neural con conexiones glow purple |
| 3 | `stack-postgres.png` | Cubo de cristal con stripes turquesa (DB layers) |
| 4 | `stack-bullmq.png` | Cilindro/queue 3D con luces en cascada |
| 5 | `stack-stripe.png` | Tarjeta 3D flotante con strip morado/teal |
| 6 | `stack-vercel.png` | Triángulo 3D estilo Vercel con depth + glow |

**Prompt Midjourney (genérico, ajustar por icono):**
```
3D rendered icon of [SUBJECT], glass morphism, neon teal #00f5d4 edge glow,
dark transparent background, premium SaaS B2B aesthetic, isometric 35deg,
sharp depth, octane render, no text, centered, 4K --ar 1:1 --v 6 --style raw
```

Para cada icono reemplaza `[SUBJECT]`:
- 1: `a chat bubble with WhatsApp-style tail`
- 2: `a neural network sphere with glowing nodes`
- 3: `a glass database cube with horizontal striped layers`
- 4: `a glass cylinder representing a task queue with light particles falling through`
- 5: `a glass credit card with a magnetic stripe`
- 6: `a sharp triangular prism, Vercel-logo inspired`

---

### 2.4 [3D ARQUITECTURA] Diagrama isométrico del flujo
- **Ubicación:** **NUEVA sección** entre `#stack` y `#timeline` (o reemplazar `#how` step diagram)
- **Tamaño:** 2400×1400 PNG + interactivo SVG opcional
- **Output:** render isométrico mostrando:
  - **Tenant 1** (clínica clinic icon) → **API Gateway** (cylinder) → split en:
    - **PostgreSQL RLS** (cubo con candado teal)
    - **Redis** (queue cylinder rojo/teal)
    - **BullMQ Workers** (gears 3D)
  - Líneas glow conectando con flujo direccional
  - Al final: **Meta WhatsApp** (logo verde 3D) y cliente final (mobile phone 3D)

**Prompt Midjourney:**
```
isometric 3D architecture diagram of a SaaS backend, showing tenant clinic
isolation, API gateway cylinder, PostgreSQL database cube with RLS lock,
Redis queue, BullMQ worker gears, all connected with glowing teal #00f5d4
direction lines, flowing toward a WhatsApp logo and a mobile phone, premium
dark theme, geometric depth, glass morphism, vercel.com aesthetic, no labels,
no text, 35 degree isometric --ar 16:9 --v 6 --style raw
```

---

### 2.5 [3D NUMBERS] Step numbers `01 · 02 · 03` para `#how`
- **Ubicación:** sección `#how` · uno por paso
- **Tamaño:** 400×400 PNG transparente cada uno · 3 archivos
- **Estilo:** números grandes 3D estilo Apple Vision OS, glass + depth, neon edge teal

**Prompt:**
```
3D number "01" in Geist Mono font, glass morphism, transparent dark depth,
neon teal #00f5d4 inner glow, premium SaaS aesthetic, isometric tilt,
octane render, no background, centered, 4K --ar 1:1 --v 6 --style raw
```

Repetir cambiando `"01"` a `"02"` y `"03"`.

---

### 2.6 [3D ORB · HERO SECONDARY] Esfera/orb decorativo
- **Ubicación:** sección `#cta-final` o fondos de transición entre secciones
- **Tamaño:** 1200×1200 PNG transparente
- **Estilo:** orb gigante glass con núcleo glow teal+purple, partículas internas

**Prompt:**
```
massive 3D glass orb floating in pitch black void, internal swirling particles
glowing in #00f5d4 teal and #7c3aed purple, refractive glass surface, volumetric
light beams piercing through, hyperrealistic octane render, mystical premium
tech aesthetic, ultra detailed, ar 1:1 --v 6 --style raw
```

---

## 3. Videos & GIFs demo (priorizar en orden)

### 3.1 [VIDEO DEMO #1] Dashboard recibe lead + IA responde · loop 8s
- **Ubicación:** sección hero (debajo del CTA) o sección `#how` step 02
- **Formato:** MP4 H.264 1080p · WebM VP9 fallback · loop 8s · sin audio
- **Output esperado:** screen recording (real o renderizado) del dashboard:
  1. Llega un lead nuevo · card aparece con animación
  2. IA escribe respuesta · burbuja de chat aparece carácter por carácter
  3. Operador recibe notificación · badge se enciende
  4. Loop

**Opciones de producción:**
- **A:** screen recording REAL del dashboard funcionando (mejor opción · más auténtico)
- **B:** prompt Sora/Veo si no quieres mostrar la app real

**Prompt Sora (si vas opción B):**
```
8-second seamless loop screen recording of a dark mode CRM dashboard,
a new lead card slides in from the right with smooth animation,
AI typing indicator appears, then a chat bubble fills with placeholder text,
operator notification badge pulses cyan, premium UI like Linear or Vercel,
font Geist, accent color #00f5d4, ultra clean, no people, no audio
```

---

### 3.2 [GIF DEMO #2] Anatomy of a lead timeline
- **Ubicación:** sección `#timeline` (anatomía de un lead)
- **Formato:** WebP animado o SVG animado (preferir SVG por peso)
- **Output:** un lead representado como un dot teal viajando por una línea horizontal con 6 estaciones:
  `captura → IA responde → operador asigna → cita confirmada → recordatorio → ganado`
- Cada estación: ícono pequeño + label + dot pulsa al pasar

**Recomendación:** generar como **SVG animado** con `<animate>` o **Lottie JSON** (más controlable + responsive).

**Si usas After Effects + Lottie:**
- 1 archivo .json
- 6 keyframes
- 800×200 viewport
- Color stops: #00f5d4

**Si usas IA video:**
```
horizontal timeline animation, a glowing teal dot travels left to right
through 6 stations, each station lights up briefly with a small icon and label,
dark background, premium minimal aesthetic, 6 second loop
```

---

### 3.3 [VIDEO/GIF DEMO #3] Sectores carousel
- **Ubicación:** sección `#sectores`
- **Formato:** 6-8 mini-clips loop 4s cada uno · WebP
- **Output:** un clip por sector que muestre un caso de uso:

| Sector | Concepto del clip |
|---|---|
| Clínica estética | Card de cita "Botox · 14:00 hoy" + recordatorio enviado |
| Dental | "Limpieza dental · paciente confirma" loop |
| Spa | "Masaje 90min · recordatorio 24h" loop |
| Veterinaria 24h | "Emergencia · ruta directa a operador" alerta roja |
| Fotografía bodas | "Cotización paquete · IA responde precios" |
| Fitness studio | "Nueva clase · 15 inscritos" notification |
| Restaurante | "Reserva mesa · confirmación auto" |
| Retail boutique | "Stock disponible · cliente pregunta" |

**Prompt genérico:**
```
4-second seamless loop UI animation, dark mode mobile chat screen,
[SECTOR-SPECIFIC SCENE], neon teal #00f5d4 accents, premium SaaS aesthetic,
no audio, vertical 9:16 mobile-first
```

---

## 4. Iconos & glyphs (no-3D, líneas)

### 4.1 Iconos de features (lista de checks en pricing/cards)
- **Estado actual:** `<span class="check-bullet">✓</span>` (carácter unicode)
- **Mejora opcional:** SVG personalizado con stroke teal, 18×18

### 4.2 Logo LabsIA (favicon + topbar)
- **Estado actual:** `assets/favicon.svg` (dot teal sobre "labs.ia")
- **Acción:** auditar si vale renovar a algo más memorable

**Prompt si quieres rediseño del logo:**
```
minimal logo design "LabsIA", clean geometric mark + wordmark,
neon teal #00f5d4 dot accent, Geist Mono typography for wordmark,
dark mode optimized, premium B2B SaaS, similar quality to vercel/linear/stripe logos,
SVG vector ready, single color + accent
```

---

## 5. OG image (social sharing)

- **Ubicación:** `assets/og-image.png` (existente, auditar)
- **Tamaño:** 1200×630 PNG (estándar Facebook/Twitter/LinkedIn/WhatsApp)
- **Output:** Hero principal en formato social

**Prompt Midjourney:**
```
social media OG card 1200x630, "LabsIA · Cada mensaje, una venta cerrada"
title in Geist font, subtitle "WhatsApp + IA · México", dark background #000,
3D glass orb glowing teal #00f5d4 + purple #7c3aed bottom right corner,
premium B2B SaaS aesthetic like Stripe or Linear social cards,
high contrast, readable at thumbnail size --ar 1200:630 --v 6 --style raw
```

**Validación:** después de generar, probar en [opengraph.xyz](https://www.opengraph.xyz) que se vea bien en preview de WhatsApp, Twitter, LinkedIn.

---

## 6. Estructura de carpetas + naming

Todos los assets entregados van a:

```
C:\Users\juan\Documents\LABSIA\labsia-Frontend\labsia-landing\assets\
├── favicon.svg              ← existente
├── og-image.png             ← existente, regenerar
├── 3d/
│   ├── hero-product-shot.png       ← 2.2
│   ├── hero-product-shot.webp      ← 2.2 fallback
│   ├── stack-whatsapp.png          ← 2.3
│   ├── stack-openai.png            ← 2.3
│   ├── stack-postgres.png          ← 2.3
│   ├── stack-bullmq.png            ← 2.3
│   ├── stack-stripe.png            ← 2.3
│   ├── stack-vercel.png            ← 2.3
│   ├── architecture-diagram.png    ← 2.4
│   ├── number-01.png               ← 2.5
│   ├── number-02.png               ← 2.5
│   ├── number-03.png               ← 2.5
│   └── orb-decorative.png          ← 2.6
├── video/
│   ├── demo-dashboard.mp4          ← 3.1
│   ├── demo-dashboard.webm         ← 3.1
│   ├── sector-clinica.webp         ← 3.3
│   ├── sector-dental.webp          ← 3.3
│   ├── sector-spa.webp             ← 3.3
│   ├── sector-vet.webp             ← 3.3
│   ├── sector-foto.webp            ← 3.3
│   ├── sector-fitness.webp         ← 3.3
│   ├── sector-resto.webp           ← 3.3
│   └── sector-retail.webp          ← 3.3
└── lottie/
    └── timeline-lead.json          ← 3.2
```

**Naming:** lowercase + kebab-case · sin acentos · sin espacios · prefijo categoría (stack-, sector-, demo-).

---

## 7. Map de prompts por herramienta · qué usa cada cosa

| Herramienta | Usar para | Outputs en este brief |
|---|---|---|
| **Midjourney v6** | Renders 3D estáticos premium · iconos | 2.2 · 2.3 · 2.4 · 2.5 · 2.6 · 5 |
| **Nano Banana** | Edits rápidos + variaciones · alternativa a MJ | 2.3 stack icons (loop fácil) |
| **Sora / Veo 3** | Videos screen-recording-like generados | 3.1 · 3.3 |
| **Runway ML Gen-3** | Motion graphics + transiciones | 3.3 sectores |
| **After Effects + Lottie** | Animaciones livianas SVG/JSON web | 3.2 timeline |
| **Spline** | Modelos 3D interactivos embed en web | Alternativa a 2.2 si quieres scroll-interactive |
| **Blender** | Renders 3D si vas DIY (mucho tiempo) | Solo si tienes pipeline |

---

## 8. Prioridad de producción

> **Si solo puedes generar 3-4 cosas esta semana, hazlas en este orden:**

1. **2.2 Hero 3D product shot** ← el primer impacto visual del hero
2. **3.1 Video demo dashboard** ← el "lo veo funcionando" que cierra ventas
3. **2.3 6 stack icons 3D** ← sustituye el plain text de tecnologías
4. **5 OG image** ← cada compartida en WhatsApp/Twitter es publicidad

El resto puede entrar en iteraciones posteriores.

---

## 9. Acuerdo de integración

Cuando entregues cualquier asset:
1. Déjalo en su carpeta correspondiente bajo `assets/`
2. Avísame "ya está `stack-postgres.png` en assets/3d/"
3. Yo lo integro en el HTML/CSS dentro de 5-10min
4. Te paso URL local actualizada para que valides

---

## 10. Lo que YO hago en paralelo mientras tú produces visuales

- [ ] Wirear CTAs "Empezar trial" al backend (`POST /api/v1/billing/checkout`)
- [ ] Página `/onboarding/verificacion` (success_url post-Stripe)
- [ ] Página `/planes` (cancel_url Stripe)
- [ ] Self-host Three.js + GSAP (performance)
- [ ] Refinar shader del hero scene (más glow al scroll)
- [ ] Deploy preview a Vercel

---

*ASSETS-VISUALES.md v1.0 · 2026-05-18 · LabsIA Landing*
