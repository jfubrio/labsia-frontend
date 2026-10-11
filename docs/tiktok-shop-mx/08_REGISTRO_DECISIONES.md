# 08 · Registro de decisiones (T00)

**Estado del ticket T00:** hecho en lo documental; con pendientes explícitos que solo el propietario puede cerrar.
**Fecha:** 2026-10-11.
**Redactado por:** agente automatizado en sesión de Claude Code, a partir de la especificación entregada por el propietario.

Convención: cada entrada indica si es **hecho** (consta en la especificación o se observó), **inferencia** (deducción del agente) o **propuesta** (requiere decisión del propietario).

---

## 1. Alcance

| Elemento | Definición | Tipo |
|---|---|---|
| Proyecto | TikTok Shop México mediante creadores afiliados, sin inventario propio. | hecho |
| Modelo de ingreso | Comisiones de afiliado por ventas atribuidas a contenido propio. Se mide **comisión liquidada menos costos**. | hecho |
| Métrica que NO valida | Vistas, likes, seguidores. Solo sirven como señales intermedias. | hecho |
| Segmentación | Por problema de compra, audiencia y profundidad del contenido. No por supuesta inteligencia del público. | hecho |
| Fase actual | T00–T02: documentación, verificación de requisitos e investigación. Sin cuentas nuevas, sin publicación, sin gasto. | hecho |
| Fuera de alcance ahora | T03 en adelante (validación de productos, MVP, automatizaciones, piloto). | hecho |
| Relación con LABSIA | Ninguna. Convive en el mismo repositorio por conveniencia; los archivos de LABSIA no se tocan. | hecho |

## 2. Responsables

| Rol | Persona | Estado |
|---|---|---|
| Propietario y decisor | Juan Fuentes | hecho |
| Ejecución de T00–T02 (documentación e investigación) | Agente automatizado (esta sesión) | hecho |
| Titular de la(s) cuenta(s) TikTok que se usarán | **Pendiente** (ver §5) | pendiente |
| Creación de contenido original | **Pendiente** | pendiente |
| Revisión y aprobación de contenido | **Pendiente** | pendiente |
| Contabilidad y fiscal (RFC, facturación, retenciones) | **Pendiente** | pendiente |
| Desarrollo del MVP interno (T04–T08) | **Pendiente**; no aplica hasta aprobar T02 | pendiente |

## 3. Restricciones

| Restricción | Origen | Tipo |
|---|---|---|
| No abrir cuentas, publicar contenido, contratar servicios ni gastar dinero en T00–T02. | Especificación | hecho |
| No solicitar ni guardar contraseñas, tokens o credenciales en el repositorio. | Especificación | hecho |
| Datos desconocidos se registran como "no disponible", nunca como cero. | Especificación | hecho |
| No inferir ventas, comisiones ni rentabilidad a partir de vistas. | Especificación | hecho |
| Permisos que exigen comprobarse dentro de una cuenta quedan "no verificados" sin acceso autenticado. | Especificación | hecho |
| El agente no dispone de sesión autenticada en TikTok, TikTok Shop Seller Center ni Affiliate Center. | Observado en la sesión | hecho |
| Las búsquedas web del agente no reproducen el feed personalizado de TikTok México ni su buscador interno con sesión. | Observado en la sesión | hecho |
| Sin inventario propio: toda oferta depende de vendedores terceros del catálogo afiliado y de sus políticas. | Especificación | hecho |

## 4. Decisiones tomadas

| ID | Decisión | Justificación | Fecha | Tipo |
|---|---|---|---|---|
| D-01 | La documentación del proyecto vive en `docs/tiktok-shop-mx/` dentro de este repositorio. | Instrucción del propietario. | 2026-10-11 | hecho |
| D-02 | Se investigan seis candidatos como hipótesis; ninguno se declara validado ni de baja competencia hasta comparar resultados. | Instrucción del propietario; evita sesgo de selección prematura. | 2026-10-11 | hecho |
| D-03 | La evaluación usa la rúbrica de cinco dimensiones de `03_INVESTIGACION_NICHOS.md`; puntuación incompleta si falta evidencia. | Instrucción del propietario. | 2026-10-11 | hecho |
| D-04 | T02 ronda 1 se entrega como **preliminar**; la ronda 2 (otro día) queda pendiente. | La sesión solo cubre un día de observación. | 2026-10-11 | hecho |
| D-05 | Los criterios "Economía del afiliado" y "Calidad operativa del vendedor" no se puntúan con datos externos (Amazon, Mercado Libre). | Esas ofertas no demuestran elegibilidad ni comisión en TikTok Shop. | 2026-10-11 | hecho |

## 5. Decisiones pendientes (requieren al propietario)

| ID | Pendiente | Por qué importa | Qué se necesita | Bloquea |
|---|---|---|---|---|
| P-01 | **Presupuesto** disponible para el piloto (muestras, utilería, software, posible pauta). | Define si la economía del afiliado puede cubrir costos; sin tope no se puede calcular margen. | Monto en MXN y periodo. | T03, T09 |
| P-02 | **Horas disponibles** por semana del propietario y de cualquier colaborador. | Determina cuántos productos y videos pueden probarse de forma comparable. | Horas/semana por persona. | T03, T09 |
| P-03 | **Responsables** por rol (titular de cuenta, creación, aprobación, fiscal). | Sin responsables no hay trazabilidad ni aprobación válida (T06). | Nombres y rol. | T03, T06 |
| P-04 | **Cuentas existentes**: ¿hay cuentas TikTok en México, con qué seguidores, antigüedad, región configurada y si ya tienen acceso a TikTok Shop / Affiliate? | Los requisitos públicos (T01) solo se confirman dentro de la cuenta. | Inventario de cuentas (sin credenciales): @usuario, seguidores, región, fecha de creación, estado de TikTok Shop. | T01 (cierre), T03 |
| P-05 | **Disponibilidad de muestras**: ¿se comprarán productos para demostración, se solicitarán muestras al vendedor o ambas? | Afecta costos, tiempos y la facilidad de demostración original. | Política de muestras y tope de gasto. | T03, T09 |
| P-06 | Datos fiscales: ¿el propietario tiene RFC activo y puede facturar/recibir pagos de plataforma en México? | Condición para liquidación de comisiones. Se registra como pendiente; no se guardan datos fiscales en el repo. | Confirmación sí/no. | T03, T07 |
| P-07 | Criterio de parada del piloto (T10): umbral de comisión liquidada menos costos y plazo. | Sin criterio previo, la evaluación se sesga a posteriori. | Umbral y plazo. | T09, T10 |
| P-08 | ¿Se registrará una aplicación pública de creador en TikTok Shop Partner Center para usar la Affiliate Creator API? | Es la única vía conforme a términos para importar comisiones (T05, T07); la alternativa es exportación manual desde la app. Implica abrir una cuenta de desarrollador. | Decisión sí/no y quién la registra. | T04, T05, T07 |

## 6. Supuestos de trabajo (inferencias, revisables)

| ID | Supuesto | Riesgo si es falso |
|---|---|---|
| S-01 | TikTok Shop opera en México con programa de afiliados abierto a creadores que cumplan requisitos públicos (ver `09_REQUISITOS_AFILIACION_MX.md`). | Todo el proyecto se detiene. |
| S-02 | El propietario dispone de al menos una cuenta TikTok con región México o puede cumplir los requisitos en plazo razonable. | T03 no puede empezar. |
| S-03 | Los seis candidatos tienen productos físicos de bajo ticket con vendedores en el catálogo MX. | Habrá que redefinir candidatos tras T02/T03. |

## 7. Bitácora

| Fecha | Evento |
|---|---|
| 2026-10-11 | Se crea `docs/tiktok-shop-mx/` con 00, 03, 07, 08, 09, 10, 11 y seis fichas de investigación. Se ejecutan T00 (hecho), T01 y T02 ronda 1 (preliminares). |
| 2026-10-11 | Limitación registrada: la política de red del entorno de ejecución bloqueó `*.tiktok.com`, `mercadolibre.com.mx`, `amazon.com.mx` y la mayoría de dominios (403 del proxy). Solo funcionó la búsqueda web. Ronda 2 de T02 y cierre de T01 requieren un entorno con esos dominios permitidos o trabajo manual del propietario. |
| 2026-10-11 | Se añade P-08 (abajo) tras la revisión de herramientas. |
