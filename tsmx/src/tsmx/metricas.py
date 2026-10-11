"""Indicadores de la fase de audiencia (13_ESTRATEGIA_AUDIENCIA.md §6–7).

Ordena por intención de compra por cada 1,000 vistas, nunca por vistas.
Usa la lectura más reciente de cada publicación.
"""

CONSULTA = """
WITH ultima AS (
  SELECT m.*, (m.vistas IS NOT NULL AND m.seguidores_ganados IS NOT NULL
               AND m.comentarios_intencion_compra IS NOT NULL) AS completo
  FROM metricas_video m
  JOIN (SELECT publicacion_id, MAX(fecha_lectura) f FROM metricas_video GROUP BY publicacion_id) u
    ON u.publicacion_id = m.publicacion_id AND u.f = m.fecha_lectura
)
SELECT {grupo} AS grupo, COUNT(*) AS videos,
       SUM(u.completo) AS con_datos,
       SUM(CASE WHEN u.completo THEN u.vistas END) AS vistas,
       SUM(CASE WHEN u.completo THEN u.seguidores_ganados END) AS seguidores,
       SUM(CASE WHEN u.completo THEN u.comentarios_intencion_compra END) AS intencion
FROM ultima u
JOIN publicaciones p ON p.id = u.publicacion_id
JOIN contenidos c ON c.id = p.contenido_id
GROUP BY {grupo}
"""


def indicadores(con, por="candidato", minimo=5) -> list[dict]:
    grupo = {"candidato": "c.candidato_num", "pilar": "c.pilar"}[por]
    res = []
    for r in con.execute(CONSULTA.format(grupo=grupo)):
        x = dict(r)
        v = x["vistas"] or 0
        x["seguidores_por_mil"] = round(x["seguidores"] / v * 1000, 2) if v else None
        x["intencion_por_mil"] = round(x["intencion"] / v * 1000, 2) if v else None
        x["suficiente"] = x["con_datos"] >= minimo
        res.append(x)
    listos = sorted([x for x in res if x["suficiente"]], key=lambda x: -(x["intencion_por_mil"] or 0))
    for i, x in enumerate(listos, 1):
        x["orden"] = i
    resto = [dict(x, orden=None) for x in res if not x["suficiente"]]
    return listos + resto
