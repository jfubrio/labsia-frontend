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
| Titular de la(s) cuenta(s) TikTok que se usarán | Juan Idelfonso Fuentes (D-10) | hecho |
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
| D-06 | La ronda 2 de T02 la ejecuta **un agente en un entorno con red abierta** (responde P-09). | Respuesta del propietario el 2026-10-11. Requiere que el propietario amplíe la política de red del entorno para permitir al menos `tiktok.com`, `mercadolibre.com.mx` y `amazon.com.mx`. Guía: `12_GUIA_RONDA2.md` §4. | 2026-10-11 | hecho |
| D-07 | **No existe todavía una cuenta de TikTok** para el proyecto (responde P-04). | Respuesta del propietario el 2026-10-11. Crear la cuenta es abrir una cuenta y requiere autorización explícita (P-10). | 2026-10-11 | hecho |
| D-08 | **No invertir dinero antes de ejecutar una estrategia orgánica de seguidores y alcance** con contenido de alto potencial de difusión, orientada a aumentar exposición y ventas indirectas (respuesta a P-01). | Respuesta del propietario el 2026-10-11. El monto del presupuesto queda pendiente para después de esa fase. Estrategia propuesta en `13_ESTRATEGIA_AUDIENCIA.md`. | 2026-10-11 | hecho |
| D-09 | El propietario dispone de **más de 10 horas por semana** (responde P-02). | Respuesta del propietario el 2026-10-11. Permite producción por lotes y comparar varios pilares de contenido en paralelo. | 2026-10-11 | hecho |
| D-10 | **Se autoriza crear la cuenta de TikTok México del proyecto.** Titular: **Juan Idelfonso Fuentes**, con su correo personal de Gmail (responde P-10). | Autorización escrita del propietario el 2026-10-11. El correo y cualquier dato de acceso se guardan fuera del repositorio. La creación la hace el titular desde su teléfono, porque exige verificar correo o teléfono y luego identidad; el agente no tiene acceso a `tiktok.com` y no crea cuentas a nombre de terceros. Guía: `14_ALTA_CUENTA_TIKTOK.md`. | 2026-10-11 | hecho |
| D-11 | **Construir ahora todo el software del MVP interno (T04 a T08) sin conectarlo a servicios externos; la conexión se hace al final.** | Instrucción del propietario el 2026-10-11 ("terminar todo lo que requiera código y al final conectamos"). Cambia el orden de `00_LEER_PRIMERO.md`, que pedía validar productos y economía (T03) antes de automatizar. Mitigación: modelo de datos con importadores por CSV y adaptadores aislados, para que los datos reales de T03 se incorporen sin rediseño. Sin gasto: Python estándar y SQLite. | 2026-10-11 | hecho |

## 5. Decisiones pendientes (requieren al propietario)

| ID | Pendiente | Por qué importa | Qué se necesita | Bloquea |
|---|---|---|---|---|
| P-01 | **Presupuesto** disponible para el piloto (muestras, utilería, software, posible pauta). | Define si la economía del afiliado puede cubrir costos; sin tope no se puede calcular margen. | Monto en MXN y periodo. | T03, T09 Respondido parcialmente por D-08 (2026-10-11): sin inversión antes de la fase de audiencia; monto pendiente. |
| P-02 | **Horas disponibles** por semana del propietario y de cualquier colaborador. | Determina cuántos productos y videos pueden probarse de forma comparable. | Horas/semana por persona. | T03, T09 Cerrado por D-09 (2026-10-11). |
| P-03 | **Responsables** por rol (titular de cuenta, creación, aprobación, fiscal). | Sin responsables no hay trazabilidad ni aprobación válida (T06). | Nombres y rol. | T03, T06 Parcial: titular de la cuenta definido por D-10; faltan creación, aprobación y fiscal. |
| P-04 | **Cuentas existentes**: ¿hay cuentas TikTok en México, con qué seguidores, antigüedad, región configurada y si ya tienen acceso a TikTok Shop / Affiliate? | Los requisitos públicos (T01) solo se confirman dentro de la cuenta. | Inventario de cuentas (sin credenciales): @usuario, seguidores, región, fecha de creación, estado de TikTok Shop. | T01 (cierre), T03 Cerrado por D-07 (2026-10-11): no hay cuenta. Abre P-10. |
| P-05 | **Disponibilidad de muestras**: ¿se comprarán productos para demostración, se solicitarán muestras al vendedor o ambas? | Afecta costos, tiempos y la facilidad de demostración original. | Política de muestras y tope de gasto. | T03, T09 |
| P-06 | Datos fiscales: ¿el propietario tiene RFC activo y puede facturar/recibir pagos de plataforma en México? | Condición para liquidación de comisiones. Se registra como pendiente; no se guardan datos fiscales en el repo. | Confirmación sí/no. | T03, T07 |
| P-07 | Criterio de parada del piloto (T10): umbral de comisión liquidada menos costos y plazo. | Sin criterio previo, la evaluación se sesga a posteriori. | Umbral y plazo. | T09, T10 |
| P-08 | ¿Se registrará una aplicación pública de creador en TikTok Shop Partner Center para usar la Affiliate Creator API? | Es la única vía conforme a términos para importar comisiones (T05, T07); la alternativa es exportación manual desde la app. Implica abrir una cuenta de desarrollador. | Decisión sí/no y quién la registra. | T04, T05, T07 |
| P-09 | **Modalidad de la ronda 2 de T02**: ¿la hace el propietario a mano en la app de TikTok o la corre un agente en un entorno con la red abierta (dominios de TikTok, Mercado Libre y Amazon permitidos)? | La ronda 1 fue preliminar (D-04) y la política de red del entorno actual bloquea los dominios necesarios (ver bitácora 2026-10-11). Sin definir quién la ejecuta y dónde, no hay segunda observación ni se puede cerrar T02. | Elegir una opción: "manual (propietario)" o "agente con red abierta"; si es la segunda, confirmar que existe ese entorno. | T02 (ronda 2) Cerrado por D-06 (2026-10-11). Queda la acción de red del propietario (P-11). |
| P-10 | **Autorizar la creación de la cuenta de TikTok** con región México y definir su titular (persona que verificará identidad y RFC). | Sin cuenta no se puede ejecutar `13_ESTRATEGIA_AUDIENCIA.md`, cerrar T01 ni iniciar T03. Crear la cuenta y publicar son acciones fuera del alcance de T00–T02. | Sí/no, titular y fecha. | T01 (cierre), T02B (ejecución), T03 Cerrado por D-10 (2026-10-11). |
| P-11 | **Ampliar la política de red del entorno** de ejecución para permitir `tiktok.com`, `mercadolibre.com.mx` y `amazon.com.mx`. | Condición de D-06. Sin ella la ronda 2 y el cierre de T01 siguen bloqueados. Se cambia en la configuración del entorno (menú del entorno en la barra de título, Editar, Network access). | Confirmación de que el cambio está hecho. | T01 (cierre), T02 (ronda 2) |
| P-12 | **Aprobar la estrategia de audiencia** (`13_ESTRATEGIA_AUDIENCIA.md`): posicionamiento de la cuenta, pilares, cadencia y reglas de decisión. | Es la fase previa a cualquier inversión según D-08. Publicar sin estrategia aprobada rompe la trazabilidad que exige T06. | Aprobación o cambios. | T02B |
| P-13 | ¿Solicitar el programa de afiliados **desde el inicio** (la fuente oficial MX permite entrar con menos de 2,000 seguidores en el programa piloto) o **después** de la fase de audiencia? | Cambia cuándo se pueden obtener datos de catálogo y comisión (T03). Solicitar no implica gasto, pero sí verificación de identidad y RFC. | Elegir "desde el inicio" o "después". | T03 |

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
| 2026-10-11 | Se crean siete skills de proyecto en `.claude/skills/` (ver `00_LEER_PRIMERO.md`). La tabla de `10_MATRIZ_NICHOS.md` pasa a generarse con script. |
| 2026-10-11 | Bloqueo registrado: se añade P-09 (modalidad de la ronda 2 de T02: manual del propietario vs. agente con red abierta). La ronda 2 de T02 queda bloqueada hasta que el propietario decida. |
| 2026-10-11 | Kit de la ronda 2 listo: `12_GUIA_RONDA2.md` y tres plantillas CSV en `investigacion/ronda2/` generadas desde las fichas. Sirve para cualquier respuesta a P-09. |
| 2026-10-11 | El propietario responde P-01, P-02, P-04 y P-09 (D-06 a D-09). Nueva prioridad: estrategia orgánica de audiencia antes de invertir. Se crea `13_ESTRATEGIA_AUDIENCIA.md` y el ticket T02B. Nuevos pendientes P-10 a P-13. |
| 2026-10-11 | D-10: se autoriza la cuenta de TikTok México con Juan Idelfonso Fuentes como titular. Pendiente que el titular la cree siguiendo `14_ALTA_CUENTA_TIKTOK.md` y registre aquí @usuario, fecha y región, sin contraseña. |
| 2026-10-11 | Plan de contenido de las semanas 1 y 2 listo en `audiencia/plan_semanas_01_02.md`: diez guiones, cada uno ligado a una pregunta observada en T02 y solo con objetos de casa. Se grabará cuando exista la cuenta; la estrategia sigue pendiente de aprobación formal (P-12). |
| 2026-10-11 | D-11: se inicia la construcción del MVP interno (T04 a T08) en `tsmx/`, sin conexiones externas. |
