# tsmx · MVP interno de TikTok Shop MX

Herramienta de línea de comandos para operar el proyecto documentado en `docs/tiktok-shop-mx/`. Cubre los tickets T04 a T08: modelo de datos, importación, contenido con aprobación, métricas y economía, permisos y respaldos.

Usa solo la biblioteca estándar de Python 3.11 o superior y SQLite. No tiene dependencias, no se conecta a ningún servicio y no cuesta nada. La conexión con TikTok Shop se hace al final (`docs/tiktok-shop-mx/15_ARQUITECTURA_MVP.md` §7).

## Inicio

```bash
cd tsmx
export PYTHONPATH=src              # o: pip install -e .  (crea el comando 'tsmx')
python3 -m tsmx init --id juan --nombre "Juan Idelfonso Fuentes"
export TSMX_USUARIO=juan
```

La base queda en `tsmx/data/tsmx.db`, fuera de git. Para otra ubicación usa `--db` o `TSMX_DB`.

## Flujo diario

| Paso | Comando |
|---|---|
| Cargar o actualizar guiones | `python3 -m tsmx importar plan ../docs/tiktok-shop-mx/audiencia/plan_semanas_01_02.md` |
| Ver guiones | `python3 -m tsmx contenido listar` |
| Pedir revisión y aprobar | `python3 -m tsmx contenido revision G01` y `python3 -m tsmx contenido aprobar G01` |
| Registrar métricas tras publicar | `python3 -m tsmx importar videos ../docs/tiktok-shop-mx/audiencia/registro_videos.csv` |
| Ver indicadores de audiencia | `python3 -m tsmx metricas` o `--por pilar` |
| Registrar costos y comisiones | `python3 -m tsmx importar costos costos.csv`, `importar comisiones comisiones.csv` |
| Ver economía | `python3 -m tsmx economia` |
| Reporte HTML | `python3 -m tsmx reporte --salida reporte.html` |
| Respaldar y verificar | `python3 -m tsmx respaldo crear`, `respaldo verificar ARCHIVO` |
| Auditoría | `python3 -m tsmx auditoria` |

Publicar un video en TikTok lo hace una persona en la app. La herramienta solo deja constancia y exige que la versión publicada tenga aprobación vigente.

## Reglas que el código hace cumplir

| Regla | Ticket | Dónde |
|---|---|---|
| Editar un contenido invalida sus aprobaciones; solo se publica la versión aprobada, comparando versión y hash | T06 | `contenido.py` |
| Un revisor no aprueba lo que escribió; el propietario sí puede y queda marcado | T06 | `contenido.py` |
| Contenido con producto exige divulgación comercial al publicar | T06 | `contenido.py` |
| Toda acción queda en una auditoría que no admite cambios ni borrados | T06, T08 | `schema.sql` |
| "no disponible" se guarda como vacío, nunca como cero; un obligatorio vacío rechaza la fila | T05 | `importar.py` |
| El mismo archivo no se importa dos veces; una fila igual es duplicada; una distinta con la misma clave es conflicto y no sobrescribe | T05 | `importar.py` |
| Comisiones estimadas, aprobadas y liquidadas por separado; transiciones válidas; el resultado solo cuenta liquidadas netas menos costos | T07 | `economia.py` |
| Indicadores ordenados por intención de compra por cada 1,000 vistas, nunca por vistas | T07 | `metricas.py` |
| Permisos por rol: propietario, editor, revisor, lector | T08 | `permisos.py` |
| Respaldo con manifiesto SHA-256 y conteos; la restauración se comprueba antes de reemplazar | T08 | `respaldo.py` |

## Formatos de importación

| Tipo | Columnas obligatorias | Opcionales |
|---|---|---|
| `plan` | Markdown con secciones `### G01 · Título` y la fila `Candidato · pilar` | — |
| `videos` | `video_id`, `url`, `fecha_lectura`, `vistas`, `seguidores_ganados`, `comentarios_intencion_compra` y las demás columnas de métricas | `fecha_pub`, `divulgacion_comercial` |
| `comisiones` | `clave_externa`, `estado`, `monto_bruto_mxn`, `fecha_estado`, `rfc_valido` | `fecha_pedido`, `guanajuato`, `producto_tiktok_id`, `url_video`, `candidato_num` |
| `costos` | `clave_externa`, `fecha`, `concepto`, `categoria`, `monto_mxn` | `candidato_num` |
| `productos` | `tiktok_product_id`, `nombre`, `estado` | `candidato_num`, `variante`, `vendedor`, `precio_mxn`, `comision_pct`, `evidencia` |

Fechas en AAAA-MM-DD. Números como aparecen en TikTok Studio ("12.3 mil" es válido). `rfc_valido` y `guanajuato` aceptan sí o no.

## Pruebas

```bash
cd tsmx && PYTHONPATH=src python3 -m unittest discover -s tests -t .
```

## Seguridad

- La base y los respaldos contienen datos del negocio y están en `.gitignore`. Guárdalos en Google Drive, no en el repositorio.
- Credenciales de TikTok solo por variables de entorno (`TIKTOK_APP_KEY`, `TIKTOK_APP_SECRET`, `TIKTOK_ACCESS_TOKEN`). El adaptador no las imprime.
