# 15 · Arquitectura del MVP interno (T04)

**Estado:** implementado y probado sin conexiones externas; pendiente de aprobación del propietario y de conexión · **Fecha:** 2026-10-11 · **Origen:** D-11 · **Código:** `tsmx/`

## 1. Qué resuelve

**[HECHO]** Los criterios de aceptación de T04 a T08 en `07_BACKLOG_DESARROLLADOR.md`, con una prueba automática por regla. **[INFERENCIA]** Las necesidades observadas que justifican cada pieza:

| Necesidad observada | Pieza |
|---|---|
| La fase de audiencia (D-08) genera guiones, publicaciones y métricas que hay que comparar por candidato | Contenido versionado, importación de métricas, indicadores |
| El propietario publica a mano y quiere trazabilidad (T06) | Aprobación ligada a versión y hash, auditoría inalterable |
| Comisiones con estados distintos y retenciones según RFC (`09_...` [S-4], [S-8]) | Economía con máquina de estados y parámetros fiscales explícitos |
| Datos que hoy llegan por CSV y mañana por API | Importadores con la misma validación para ambos orígenes |
| Sin presupuesto (D-08) | Python estándar, SQLite, sin servicios |

## 2. Decisiones de diseño

| Decisión | Motivo | Cómo se revierte |
|---|---|---|
| Python estándar y SQLite | Cero costo, cero dependencias, un solo usuario hoy. Los scripts de las skills ya son Python. | El esquema es SQL estándar salvo dos disparadores; migrar a PostgreSQL (Supabase) es copiar el esquema y cambiar `db.py`. |
| Línea de comandos más reporte HTML estático | Un solo operador; un panel web no aporta antes del piloto. | `reporte.py` ya produce HTML; un panel en Vercel puede leer la misma base o su copia en Postgres. |
| CSV como formato de entrada universal | TikTok Studio y el Affiliate Center se leen a mano hasta conectar la API. | El adaptador de la API produce los mismos diccionarios que hoy produce el CSV. |
| Reglas en la capa de servicio, no en la interfaz | Cualquier interfaz futura hereda permisos, aprobación y auditoría. | — |

## 3. Módulos

```
tsmx/src/tsmx/
  schema.sql        tablas, restricciones y auditoría de solo inserción
  db.py             conexión, migración, transacciones anidables
  permisos.py       roles y comprobación por acción
  auditoria.py      registro de acciones
  candidatos.py     siembra desde las fichas de investigacion/
  contenido.py      versiones, revisión, aprobación, publicación
  importar.py       plan, videos, comisiones, costos, productos
  economia.py       retenciones, estados de comisión, costos, resumen
  metricas.py       indicadores por candidato y pilar
  respaldo.py       respaldo, verificación, restauración
  reporte.py        HTML estático
  adaptadores/tiktok_shop.py   firma oficial y cliente sin conectar
  cli.py            comandos
```

## 4. Esquema de datos

| Tabla | Clave natural para no duplicar | Notas |
|---|---|---|
| `usuarios` | `id` | Rol: propietario, editor, revisor, lector. |
| `candidatos` | `num` | Sembrados desde las fichas. |
| `contenidos` | `id` (G01…) | Estado: borrador, en_revision, aprobado, publicado, archivado. |
| `contenido_versiones` | (`contenido_id`, `version`) | Hash SHA-256 del cuerpo normalizado. |
| `aprobaciones` | — | Ligadas a versión y hash; `vigente` se apaga al editar. |
| `publicaciones` | `url` | `sin_aprobacion` marca excepciones del propietario. |
| `metricas_video` | (`publicacion_id`, `fecha_lectura`) | NULL = no disponible. |
| `productos` | `tiktok_product_id` | Un producto "apto" exige precio, comisión y evidencia. |
| `comisiones` | `clave_externa` | Estados y fechas por estado; retenciones y neto calculados. |
| `costos` | `clave_externa` | Categorías cerradas. |
| `importaciones` | (`tipo`, `sha256`) | Estado en curso, completa o fallida. |
| `auditoria` | — | Disparadores impiden modificar o borrar. |

## 5. Parámetros fiscales

**[HECHO]** Tomados de `09_REQUISITOS_AFILIACION_MX.md` [S-8]: retención del 50 % del IVA y 2.5 % de ISR con RFC válido; 100 % del IVA y 20 % de ISR sin RFC válido; 2.5 % adicional en Guanajuato desde 2026-04-01. La comisión bruta incluye IVA. **[INFERENCIA]** Hay una discrepancia con [S-7]; los parámetros están en un solo lugar (`economia.PARAMETROS`) para corregirlos sin tocar la lógica.

## 6. Pruebas

77 pruebas con `unittest`, con cobertura de ramas del 96 % del paquete medida con coverage.py. Incluyen ocho regresiones por errores hallados en una revisión de código, la línea de comandos completa, la petición firmada a TikTok sin red y los cuatro scripts de las skills sobre copias de los documentos. Cada regla crítica se verificó además con una mutación deliberada del código: invalidar aprobaciones, comparar versión y hash, excluir estimadas del resultado y ordenar por intención. En las cuatro, al menos una prueba falló. La integración continua corre ruff, formato y pruebas en Python 3.11 y 3.13.

## 7. Conexión al final (pendiente)

| Paso | Requiere | Decisión |
|---|---|---|
| 1. Crear la cuenta de TikTok México | Titular | D-10 |
| 2. Registrar una app pública de creador en TikTok Shop Partner Center y obtener `app_key` y `app_secret` | Cuenta de desarrollador | P-08 |
| 3. Comparar `firmar()` con el ejemplo oficial de Python de "Sign your API request" y una llamada de prueba | Credenciales | — |
| 4. Completar `ENDPOINTS` en `adaptadores/tiktok_shop.py` con rutas y versiones de la referencia oficial; confirmar `BASE_API` | Documentación oficial legible (P-11) | — |
| 5. Autorizar la cuenta del creador con `url_autorizacion_creador()` y guardar el token en variables de entorno | Titular | — |
| 6. Escribir el mapeo de órdenes de afiliado a `economia.registrar_comision` con `fuente="api"` | Respuesta real de la API | — |
| 7. Opcional: trasladar la base a Supabase (PostgreSQL) y el reporte a Vercel | Decisión de costo | P-01 |

Mientras tanto, todo funciona con CSV exportados a mano.
