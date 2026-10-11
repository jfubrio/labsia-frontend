"""Reporte HTML estático para leer el estado del proyecto sin abrir la base."""

import html

from . import auditoria, contenido, economia, metricas
from .db import ahora

CSS = """
:root{--bg:#fafaf9;--fg:#1c1917;--muted:#57534e;--line:#e7e5e4;--card:#fff;--ok:#166534;--warn:#9a3412}
@media (prefers-color-scheme:dark){:root{--bg:#1c1917;--fg:#f5f5f4;--muted:#a8a29e;--line:#44403c;--card:#292524;--ok:#86efac;--warn:#fdba74}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px}
p.meta{color:var(--muted);margin:0 0 16px}
.tabla{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:8px}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}
th{font-weight:600;color:var(--muted)}td.n{text-align:right}
.aviso{color:var(--warn)}.ok{color:var(--ok)}
"""


def _tabla(cols, filas):
    cab = "".join(f"<th>{html.escape(c)}</th>" for c, _ in cols)
    cuerpo = ""
    for f in filas:
        celdas = ""
        for _, k in cols:
            v = f.get(k)
            v = "no disponible" if v is None else v
            clase = ' class="n"' if isinstance(v, (int, float)) else ""
            celdas += f"<td{clase}>{html.escape(str(v))}</td>"
        cuerpo += f"<tr>{celdas}</tr>"
    if not filas:
        cuerpo = f'<tr><td colspan="{len(cols)}">Sin datos todavía.</td></tr>'
    return f'<div class="tabla"><table><thead><tr>{cab}</tr></thead><tbody>{cuerpo}</tbody></table></div>'


def generar(con) -> str:
    cont = contenido.listar(con)
    ind = metricas.indicadores(con)
    eco = economia.resumen(con)
    aud = auditoria.listar(con, 30)
    partes = [
        f"<h1>TikTok Shop MX · estado interno</h1><p class='meta'>Generado {html.escape(ahora())}. "
        "Las vistas no validan el negocio: el resultado cuenta solo comisiones liquidadas menos costos.</p>"
    ]
    partes.append(
        "<h2>Contenido</h2>"
        + _tabla(
            [
                ("ID", "id"),
                ("Candidato", "candidato_num"),
                ("Pilar", "pilar"),
                ("Título", "titulo"),
                ("Estado", "estado"),
                ("Versión", "version_actual"),
                ("Publicaciones", "publicaciones"),
            ],
            cont,
        )
    )
    partes.append(
        "<h2>Audiencia por candidato</h2><p class='meta'>Orden por intención de compra por cada 1,000 vistas; "
        "solo se ordenan candidatos con 5 o más videos con datos.</p>"
        + _tabla(
            [
                ("Candidato", "grupo"),
                ("Videos", "videos"),
                ("Con datos", "con_datos"),
                ("Vistas", "vistas"),
                ("Seguidores / 1,000", "seguidores_por_mil"),
                ("Intención / 1,000", "intencion_por_mil"),
                ("Orden", "orden"),
            ],
            ind,
        )
    )
    filas = eco["filas"] + ([eco["total"]] if eco["total"] else [])
    partes.append(
        "<h2>Economía</h2><p class='meta'>Estimadas y aprobadas no son ingreso. "
        f"Parámetros fiscales: {html.escape(eco['parametros']['fuente'])}.</p>"
        + _tabla(
            [
                ("Candidato", "candidato"),
                ("Estimadas", "estimada_n"),
                ("Neto estimado", "estimada_neto"),
                ("Aprobadas", "aprobada_n"),
                ("Neto aprobado", "aprobada_neto"),
                ("Liquidadas", "liquidada_n"),
                ("Neto liquidado", "liquidada_neto"),
                ("Canceladas", "cancelada_n"),
                ("Costos", "costos"),
                ("Resultado liquidado", "resultado_liquidado"),
            ],
            filas,
        )
    )
    partes.append(
        "<h2>Últimas acciones</h2>"
        + _tabla(
            [("Fecha", "ts"), ("Usuario", "usuario"), ("Acción", "accion"), ("Entidad", "entidad"), ("ID", "entidad_id")], aud
        )
    )
    return (
        "<!doctype html><html lang='es'><head><meta charset='utf-8'><meta name='viewport' "
        "content='width=device-width,initial-scale=1'><title>TikTok Shop MX</title>"
        f"<style>{CSS}</style></head><body><main>{''.join(partes)}</main></body></html>"
    )
