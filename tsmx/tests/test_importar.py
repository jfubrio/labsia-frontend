from tsmx import contenido, importar
from tsmx.errores import ErrorTSMX, PermisoDenegado

from .base import DOCS, Caso

CAB_VIDEOS = [
    "video_id",
    "fecha_pub",
    "url",
    "candidato_num",
    "pilar",
    "divulgacion_comercial",
    "fecha_lectura",
    "vistas",
    "tiempo_medio_s",
    "pct_completo",
    "likes",
    "comentarios",
    "compartidos",
    "guardados",
    "visitas_perfil",
    "seguidores_ganados",
    "comentarios_intencion_compra",
    "comentarios_objecion",
]


def fila_video(cid, url, lectura, vistas="12.3 mil", seg="40", intencion="5", **extra):
    base = {
        "video_id": cid,
        "url": url,
        "fecha_lectura": lectura,
        "fecha_pub": "2026-11-01",
        "vistas": vistas,
        "seguidores_ganados": seg,
        "comentarios_intencion_compra": intencion,
        "likes": "no disponible",
    }
    base.update(extra)
    return base


class TestImportarPlan(Caso):
    def test_plan_real_e_idempotencia(self):
        plan = DOCS / "audiencia" / "plan_semanas_01_02.md"
        r = importar.plan(self.con, "juan", plan)
        self.assertEqual((r.ok, r.rechazadas), (10, 0))
        g = contenido.obtener(self.con, "G10")
        self.assertEqual((g["candidato_num"], g["pilar"]), (5, "P1"))
        self.assertTrue(importar.plan(self.con, "juan", plan).ya_importado)

    def test_plan_editado_crea_version_e_invalida(self):
        p = self.dir / "plan.md"
        p.write_text("### G01 · Uno\n| Candidato · pilar | 2 Pelo · P2 X |\ntexto A\n", encoding="utf-8")
        importar.plan(self.con, "juan", p)
        contenido.solicitar_revision(self.con, "juan", "G01")
        contenido.aprobar(self.con, "juan", "G01")
        p.write_text("### G01 · Uno\n| Candidato · pilar | 2 Pelo · P2 X |\ntexto B\n", encoding="utf-8")
        r = importar.plan(self.con, "juan", p)
        self.assertEqual(r.ok, 1)
        self.assertEqual(contenido.obtener(self.con, "G01")["version_actual"], 2)
        self.assertIsNone(contenido.aprobacion_vigente(self.con, "G01"))


class TestImportarVideos(Caso):
    def setUp(self):
        super().setUp()
        for cid, cand in (("G01", 2), ("G02", 1)):
            contenido.crear(self.con, "juan", cid, cid, f"c {cid}", cand, "P1")
            contenido.solicitar_revision(self.con, "juan", cid)
            contenido.aprobar(self.con, "juan", cid)

    def test_valida_ausentes_y_numeros(self):
        p = self.csv(
            "v.csv",
            CAB_VIDEOS,
            [
                fila_video("G01", "https://t/1", "2026-11-08"),
                fila_video("G02", "https://t/2", "2026-11-08", seg=""),  # obligatorio vacío
                fila_video("G02", "https://t/2", "2026-11-08", vistas="muchas"),  # número inválido
                fila_video("G02", "nota", "2026-11-08"),  # url inválida
            ],
        )
        r = importar.videos(self.con, "ed", p)
        self.assertEqual((r.ok, r.rechazadas), (1, 3))
        m = self.con.execute("SELECT vistas, likes FROM metricas_video").fetchone()
        self.assertEqual(m["vistas"], 12300)
        self.assertIsNone(m["likes"])  # "no disponible" -> NULL, no 0
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM publicaciones").fetchone()[0], 1)

    def test_duplicados_y_conflictos(self):
        p1 = self.csv("a.csv", CAB_VIDEOS, [fila_video("G01", "https://t/1", "2026-11-08")])
        importar.videos(self.con, "ed", p1)
        p2 = self.csv(
            "b.csv",
            CAB_VIDEOS,
            [
                fila_video("G01", "https://t/1", "2026-11-08", notas="x"),
                fila_video("G01", "https://t/1", "2026-11-08", vistas="99"),
                fila_video("G01", "https://t/1", "2026-11-15", vistas="20 mil"),
            ],
        )
        r = importar.videos(self.con, "ed", p2)
        self.assertEqual((r.ok, r.duplicadas, r.rechazadas), (1, 1, 1))
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM metricas_video").fetchone()[0], 2)

    def test_publicacion_sin_aprobacion_rechazada_y_atomica(self):
        contenido.crear(self.con, "juan", "G03", "G03", "c", 3, "P1")
        p = self.csv("c.csv", CAB_VIDEOS, [fila_video("G03", "https://t/3", "2026-11-08")])
        r = importar.videos(self.con, "ed", p)
        self.assertEqual(r.rechazadas, 1)
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM publicaciones WHERE url='https://t/3'").fetchone()[0], 0)

    def test_lector_no_importa(self):
        p = self.csv("d.csv", CAB_VIDEOS, [fila_video("G01", "https://t/1", "2026-11-08")])
        with self.assertRaises(PermisoDenegado):
            importar.videos(self.con, "lec", p)

    def test_columnas_faltantes(self):
        p = self.csv("e.csv", ["video_id", "url"], [{"video_id": "G01", "url": "https://t/1"}])
        with self.assertRaises(ErrorTSMX):
            importar.videos(self.con, "ed", p)
        estado = self.con.execute("SELECT estado FROM importaciones").fetchone()[0]
        self.assertEqual(estado, "fallida")
