"""Scripts de las skills (.claude/skills/*/scripts), ejecutados como procesos sobre copias de los documentos."""

import csv
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SKILLS = RAIZ / ".claude" / "skills"
DOCS = RAIZ / "docs" / "tiktok-shop-mx"


class ConCopia(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.raiz = Path(self.tmp.name)
        self.docs = self.raiz / "docs" / "tiktok-shop-mx"
        shutil.copytree(DOCS, self.docs)

    def tearDown(self):
        self.tmp.cleanup()

    def correr(self, script, *args):
        return subprocess.run(
            [sys.executable, "-I", str(SKILLS / script), *args],
            check=False,
            cwd=self.raiz,
            capture_output=True,
            text=True,
            timeout=60,
        )


class TestMatriz(ConCopia):
    S = "tsmx-matriz/scripts/matriz.py"

    def test_puntuaciones_de_las_fichas_reales(self):
        r = self.correr(self.S, "--json")
        self.assertEqual(r.returncode, 0, r.stderr)
        fichas = json.loads(r.stdout)
        self.assertEqual([f["numero"] for f in fichas], [1, 2, 3, 4, 5, 6])
        self.assertEqual([f["parcial"] for f in fichas], [0.32, 0.39, 0.35, 0.39, 0.34, 0.39])
        self.assertTrue(all(not f["completa"] and f["peso_cubierto"] == 0.6 for f in fichas))

    def test_write_es_idempotente(self):
        matriz = self.docs / "10_MATRIZ_NICHOS.md"
        self.assertEqual(self.correr(self.S, "--write").returncode, 0)
        primera = matriz.read_text(encoding="utf-8")
        self.correr(self.S, "--write")
        self.assertEqual(matriz.read_text(encoding="utf-8"), primera)
        self.assertEqual(primera, (DOCS / "10_MATRIZ_NICHOS.md").read_text(encoding="utf-8"))

    def test_nota_fuera_de_rango_bloquea_la_escritura(self):
        ficha = next((self.docs / "investigacion").glob("01_*.md"))
        texto = ficha.read_text(encoding="utf-8").replace(
            "| Demanda observable | 25 % | 3 |", "| Demanda observable | 25 % | 7 |"
        )
        ficha.write_text(texto, encoding="utf-8")
        r = self.correr(self.S, "--write")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("fuera de rango", r.stderr)


class TestBacklog(ConCopia):
    S = "tsmx-backlog/scripts/backlog.py"

    def test_cambio_de_estado_registrado(self):
        r = self.correr(self.S, "T03", "bloqueado", "--motivo", "falta cuenta", "--fecha", "2026-12-01")
        self.assertEqual(r.returncode, 0, r.stderr)
        texto = (self.docs / "07_BACKLOG_DESARROLLADOR.md").read_text(encoding="utf-8")
        self.assertIn("| 2026-12-01 | T03 | pendiente | bloqueado | falta cuenta |", texto)
        self.assertIn("T03  bloqueado", self.correr(self.S, "--listar").stdout)

    def test_errores_de_uso(self):
        self.assertNotEqual(self.correr(self.S, "T03", "listo", "--motivo", "x").returncode, 0)
        self.assertNotEqual(self.correr(self.S, "T03", "hecho").returncode, 0)
        self.assertNotEqual(self.correr(self.S, "T99", "hecho", "--motivo", "x").returncode, 0)

    def test_lista_incluye_tickets_con_letra(self):
        self.assertIn("T02B", self.correr(self.S, "--listar").stdout)


class TestRonda2(ConCopia):
    S = "tsmx-ficha-nicho/scripts/ronda2.py"

    def test_plantillas_y_resumen(self):
        shutil.rmtree(self.docs / "investigacion" / "ronda2")
        r = self.correr(self.S, "plantilla")
        self.assertEqual(r.returncode, 0, r.stderr)
        for nombre, filas in (("captura_busquedas.csv", 300), ("revisita_urls_r1.csv", 282), ("tienda_busquedas.csv", 60)):
            self.assertIn(f"{nombre}: {filas} filas", r.stdout)
        self.assertIn("no se sobrescribe", self.correr(self.S, "plantilla").stderr)

        captura = self.docs / "investigacion" / "ronda2" / "captura_busquedas.csv"
        with captura.open(encoding="utf-8") as fh:
            filas = list(csv.DictReader(fh))
        filas[0].update(
            fecha_obs="2026-10-14",
            url="https://www.tiktok.com/@nuevo_mx/video/1",
            formato="video corto",
            creador="@nuevo_mx",
            fecha_pub="no disponible",
            vistas="1 mil",
            likes="10",
            comentarios="2",
            preguntas_compra="¿cabe en 60 cm?",
        )
        with captura.open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(filas[0]))
            w.writeheader()
            w.writerows(filas)
        r = self.correr(self.S, "resumen", "--candidato", "1")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("nuevos respecto a ronda 1: 1 (@nuevo_mx)", r.stdout)
        self.assertIn("¿cabe en 60 cm?", r.stdout)


class TestAudiencia(ConCopia):
    S = "tsmx-audiencia/scripts/audiencia.py"

    def test_registro_vacio_y_orden(self):
        self.assertIn("vacío", self.correr(self.S).stdout)
        reg = self.docs / "audiencia" / "registro_videos.csv"
        cab = reg.read_text(encoding="utf-8").strip().split(",")
        with reg.open("a", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=cab)
            for i, (cand, vistas, intencion) in enumerate([("1", "100 mil", "10")] * 5 + [("2", "10 mil", "10")] * 5):
                w.writerow(
                    {
                        **dict.fromkeys(cab, "no disponible"),
                        "video_id": f"v{i}",
                        "fecha_pub": "2026-11-01",
                        "url": f"https://t/{i}",
                        "candidato_num": cand,
                        "pilar": "P1",
                        "fecha_lectura": "2026-11-08",
                        "vistas": vistas,
                        "seguidores_ganados": "5",
                        "comentarios_intencion_compra": intencion,
                    }
                )
        r = self.correr(self.S)
        self.assertEqual(r.returncode, 0, r.stderr)
        filas = [linea for linea in r.stdout.splitlines() if linea.startswith("| 1 ") or linea.startswith("| 2 ")]
        self.assertTrue(filas[0].startswith("| 2 "), r.stdout)  # menos vistas, más intención por mil
