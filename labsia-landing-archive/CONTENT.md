# 📝 CONTENT.md · Datos editables del landing

> **Producto real (per DOC 10/11/18/19/27):** plataforma SaaS multi-tenant de gestión de leads con WhatsApp Business + IA. NO es un generador de landings.
>
> **Cómo usar:** los strings están sincronizados con `index.html`. Cuando edites algo, busca el marcador `[CONTENT-XX]` en el HTML.

---

## 🎯 [CONTENT-01] Hero

| Campo | Valor actual | ¿Real o placeholder? |
|---|---|---|
| Eyebrow | `GESTIÓN DE LEADS · WHATSAPP + IA` | ✅ Real |
| Título L1 | `Cada mensaje,` | ✅ Real |
| Título L2 | `una <gradient>venta cerrada</gradient>.` | ✅ Real |
| Subtítulo | `Captura, clasifica, responde y da seguimiento a tus leads de WhatsApp con IA. Tu equipo deja de chatear — empieza a cerrar.` | ✅ Real |
| CTA primario | `Agenda una demo →` | ✅ Real |
| CTA secundario | `Ver cómo funciona` | ✅ Real |

---

## 🔄 [CONTENT-02] Cómo Funciona — 3 pasos

Flujo real per DOC 10 (`upsertLead` con dedup atómico) + DOC 18 (clasificación IA + plantillas Meta) + DOC 19 (dashboard Kanban).

### Paso 01 · Captura
- `Llega el lead, sin que muevas un dedo.`
- WhatsApp Business API + form + Instagram + email → un mismo embudo + dedup atómico

### Paso 02 · IA responde
- `La IA contesta primero. En segundos.`
- GPT-4o-mini · clasificación + alto-ticket + plantilla pre-aprobada

### Paso 03 · Tu equipo cierra
- `Kanban limpio. QuickReply de un clic.`
- 5 columnas (nuevo · en_gestión · sin_respuesta · ganado · perdido) + métricas en vivo

✅ Todos los pasos alineados al producto real.

---

## 🛠️ [CONTENT-03] Stack (6 cards) · per DOC 27

| # | Tag | Nombre real | Justificación |
|---|---|---|---|
| 1 | CANAL · OFICIAL | Meta WhatsApp Business API | DOC 27 §4 "Meta WhatsApp" |
| 2 | INTELIGENCIA | OpenAI · GPT-4o-mini | DOC 18 `classifyMessage` |
| 3 | DATOS · MULTI-TENANT | PostgreSQL + RLS | DOC 10 + DOC 18 (Drizzle + RLS) |
| 4 | ORQUESTACIÓN | BullMQ + Redis | DOC 10/18 `followupQueue` |
| 5 | PAGOS · CFDI | Stripe MXN | DOC 27 §"STRIPE · modo LIVE" |
| 6 | INFRA · GLOBAL | Vercel + Railway | DOC 27 §"infraestructura" |

✅ Todos production-grade y verificables. Si cambias el stack, actualiza este bloque.

---

## ⏱️ [CONTENT-04] Anatomía de un Lead (timeline)

Reemplaza el viejo "24h" del generador de landings con los tiempos REALES del flujo.

| Hito | Cuándo | Tech tag |
|---|---|---|
| Mensaje entra | 00:00 | `webhook.verifyHmac` |
| Deduplicación | 00:01 | `leads.service · upsertLead` |
| IA clasifica + responde | 00:03 | `classifier.service` |
| Operador notificado | 02:00 (si alto-ticket) | `operadores.notify` |
| Follow-up A6 | 05:00 (si lead silencia) | `followupQueue · A6` |
| Follow-up B1 | 24:00 (reactivación) | `followupQueue · B1` |

> Falta validar tiempos exactos con el equipo de producto. Pueden ajustarse en `index.html` sin tocar JS.

---

## 🏷️ [CONTENT-05] Sectores donde funciona (5 cards)

Reemplaza la galería de "landings de demo del Web24h" — eso era OTRO producto, no aplica acá.

| Sector | Volumen típico | Insight |
|---|---|---|
| Clínicas dentales/dermatológicas | 80-200 leads/mes | Alto-ticket detectado |
| Estudios de fotografía | 40-120 leads/mes | Booking automático |
| Veterinarias 24h | 100-300 mensajes/mes | Urgencias clasificadas |
| Restaurantes con reserva | 200-500 leads/mes | Confirmación auto |
| Academias / cursos | 60-180 leads/mes | Nurturing por cohorte |

> ⚠️ Volúmenes son estimados ilustrativos · confirmar con datos reales de beta cuando los tengas.

---

## 📊 [CONTENT-06] Comparativa (actualizada)

| Competencia | Por qué la incluí |
|---|---|
| **LabsIA** (featured) | — |
| Whaticket / Trengo | Competidor directo en LATAM para WhatsApp |
| HubSpot Service Hub | Referencia enterprise · benchmarking |
| Operador manual | Para PyMEs que aún no usan ninguna herramienta |

Criterios alineados al diferencial real: WhatsApp Business oficial, RLS, dedup atómico, follow-ups sin código, CFDI, soporte español, runbook público.

---

## 💬 [CONTENT-07] Testimonios · BETA PRIVADA ✅ DEFINIDO

**Decisión:** mientras estamos en beta privada, NO publicamos quotes de clientes con nombre/sector. Reemplazado el placeholder por 3 cards de **capacidades verificables** + disclaimer "Beta privada activa".

**Stats row (4 numeros técnicos defendibles):**
- `3` segundos · respuesta IA
- `99.9` % uptime objetivo · SLA Enterprise
- `24/7` follow-ups automáticos (jobs A6/B1/B2)
- `0` leads duplicados (constraint Postgres unique parcial DOC 10)

**Las 3 cards técnicas (en lugar de quotes humanos):**

| # | Claim | Doc respaldo |
|---|---|---|
| 1 | WhatsApp Business API oficial · palomita azul Meta · templates aprobados · quality rating monitoreado | DOC 27 |
| 2 | Multi-tenant con RLS · cada tenant aislado por `app.tenant_id` · backups diarios a R2 · CFDI 4.0 | DOC 10 + DOC 18 |
| 3 | Circuit breaker + reintento auto · BullMQ + Redis encola si Meta cae · ningún mensaje se pierde | DOC 21 (`circuit-breaker.ts`) |

**Disclaimer al pie de la sección:** "Beta privada activa. Programa abierto solo a equipos pre-aprobados. Testimonios con nombre y métricas reales se publicarán al lanzamiento público."

✅ Sustituye placeholders por información que ya es verdad técnica. Sin riesgo legal de testimonios inventados.

---

## ❓ [CONTENT-08] FAQ (9 preguntas REALES)

Reemplazadas las del Web24h. Estas son las que un comprador B2B serio preguntará:

1. ¿WhatsApp Business API oficial o scraper? → **Oficial, palomita azul**
2. ¿Aislamiento de datos? → **RLS a nivel Postgres**
3. ¿Qué pasa si Meta cae? → **Circuit breaker + BullMQ**
4. ¿Quién es dueño de los datos? → **Tú · exportable cuando quieras**
5. ¿Onboarding? → **5-7 días (verificación Meta es el cuello de botella)**
6. ¿Multi-operador? → **JWT + disponibilidad + auditoría**
7. ¿Límite de mensajes? → **Lo pone Meta tier, no nosotros**
8. ¿Cancelar cuándo quiera? → **Mes a mes, sin contrato forzado**
9. ¿Facturación pesos o dólares? → **MXN + CFDI 4.0**

✅ Cada respuesta está respaldada por docs internos (10, 18, 27).

---

## 💰 [CONTENT-09] Pricing ✅ DEFINIDO (Stripe LIVE)

**Decisión final:** 3 planes con price IDs reales en Stripe + política trial 7d con tarjeta requerida (D-Trial-001).

| Plan | Precio | Stripe price_id | Trial | Tarjeta |
|---|---|---|---|---|
| **Starter** | $8,000 MXN/mes · IVA incluido | `price_1TYUioDzPfwnCxZf2esg9cdy` | 7 días | Requerida al iniciar |
| **Growth** (recomendado) | $18,000 MXN/mes · IVA incluido | `price_1TYUipDzPfwnCxZf2eB20w5T` | 7 días | Requerida al iniciar |
| **Enterprise** | Cotización · sin precio público | (sin price, on demand) | — | Contractual |

**Política trial (D-Trial-001 · CONTINUIDAD v2.5):**
- Tarjeta requerida al iniciar trial (mitigación de fraude MX)
- 7 días sin cobro durante el trial
- Día 8: cobro automático
- Si la tarjeta falla al cobrar: Stripe cancela sub automática (`trial_settings.end_behavior.missing_payment_method='cancel'`)
- Cancela antes del día 7: sin cargo

**Features por plan:**

| Feature | Starter | Growth | Enterprise |
|---|---|---|---|
| Canales (WhatsApp/IG/form) | 1 | 3 | Ilimitados |
| Operadores | 1 | 3 (con round-robin) | Ilimitados |
| Leads/mes | 500 | 5,000 | Ilimitados |
| Modo campaña + resumen 15min | — | ✓ | ✓ |
| Dashboard Kanban + métricas | ✓ | ✓ | ✓ |
| IA clasificadora GPT-4o-mini | ✓ | ✓ | ✓ |
| Follow-ups A6 automáticos | ✓ | ✓ | ✓ |
| CFDI 4.0 mexicana | ✓ | ✓ | ✓ |
| Soporte WhatsApp directo | — | ✓ | ✓ |
| Capacitación incluida | — | ✓ | ✓ |
| SLA 99.9% contractual | — | — | ✓ |
| On-call dedicado | — | — | ✓ |
| Integración CRM | — | — | ✓ |

✅ Implementado en `labsia-landing/index.html` sección `#pricing` con 3 plan-cards. Webhook endpoint Stripe V2: `we_1TYUkKDzPfwnCxZfWpD71TfS`.

---

## 🎬 [CONTENT-10] CTA Final

- Título: `Tu próximo lead llega en 5 minutos.`
- Subtítulo: `¿Tu equipo está listo? Agenda una demo de 20 minutos y te mostramos el dashboard con datos en vivo.`
- Botón: `Agenda demo →`

✅ Coherente con el pricing "agenda demo".

---

## 📞 [CONTENT-11] Datos de contacto — ⚠️ PENDIENTE CONFIRMAR

| Dato | Sugerencia | Tu valor real |
|---|---|---|
| Dominio principal | `labsia.mx` | _________ |
| Subdominio dashboard | `dashboard.labsia.mx` (DOC 27) | _________ |
| Subdominio API | `api.labsia.mx` (DOC 27) | _________ |
| Status page | `status.labsia.mx` (DOC 27) | _________ |
| Email comercial | `hola@labsia.mx` | _________ |
| Email transaccional | `noreply@labsia.mx` (DOC 27) | _________ |
| WhatsApp directo | (para "soporte WhatsApp" del FAQ) | _________ |
| Razón social + RFC | (para footer + CFDI) | _________ |

Las URLs de Términos / Privacidad / Status en el footer son `href="#"` placeholder. Reemplazar cuando esos documentos existan.

---

## ✅ Resumen — qué falta antes de lanzar al público

- [ ] **Decidir modelo de pricing** (Opción A/B/C/D arriba) y reemplazar "Demo" si aplica
- [ ] **Confirmar dominio + correos** para footer + meta tags + canonical
- [ ] **Validar tiempos del timeline** (00:00, 00:01, 00:03, 02:00, 05:00, 24:00) con el equipo
- [ ] **Cuando haya casos reales públicos**, reemplazar testimonios de beta con identidades reales
- [ ] **Volúmenes de sectores**: confirmar rangos reales contra data de beta
- [ ] **Publicar Términos / Privacidad / Status page** y enlazar en footer
- [ ] **Tracking analytics** (Plausible / Google Analytics) si lo quieren
- [ ] **OG image** + meta tags sociales (Twitter/LinkedIn) — pendientes en `<head>`

---

*CONTENT.md v2.0 — alineado al producto real (gestión de leads WhatsApp + IA)*
