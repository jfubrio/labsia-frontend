"""La línea de comandos de punta a punta, como la usaría el propietario."""

import contextlib
import io
import json

from tsmx import cli

from .base import DOCS, Caso
from .test_importar import CAB_VIDEOS, fila_video


class TestCLI(Caso):
    def tsmx(self, *args, usuario="juan"):
        out, err = io.StringIO(), io.StringIO()
        pre = ["--db", str(self.ruta)] + (["--usuario", usuario] if usuario else [])
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            codigo = cli.main(pre + list(args))
        return codigo, out.getvalue(), err.getvalue()

    def test_sin_usuario_y_usuario_inexistente(self):
        codigo, _, err = self.tsmx("contenido", "listar", usuario=None)
        self.assertEqual(codigo, 2)
        self.assertIn("--usuario", err)
        codigo, _, err = self.tsmx("contenido", "listar", usuario="nadie")
        self.assertEqual(codigo, 2)
        self.assertIn("no existe", err)

    def test_usuarios(self):
        self.assertEqual(self.tsmx("usuario", "agregar", "ana", "Ana", "lector")[0], 0)
        codigo, out, _ = self.tsmx("usuario", "listar")
        self.assertIn("ana", out)
        self.assertEqual(self.tsmx("usuario", "desactivar", "ana")[0], 0)
        codigo, _, err = self.tsmx("usuario", "agregar", "x", "X", "lector", usuario="ed")
        self.assertEqual(codigo, 2)
        self.assertIn("no permite", err)

    def test_candidatos(self):
        self.assertEqual(self.tsmx("candidatos", "sembrar")[0], 0)
        _, out, _ = self.tsmx("candidatos", "listar")
        self.assertIn("Organización de cocinas pequeñas", out)

    def test_flujo_de_contenido_completo(self):
        plan = DOCS / "audiencia" / "plan_semanas_01_02.md"
        codigo, out, _ = self.tsmx("importar", "plan", str(plan))
        self.assertEqual(codigo, 0)
        self.assertIn("10 importadas", out)
        _, out, _ = self.tsmx("contenido", "listar", "--estado", "borrador")
        self.assertIn("G10", out)
        self.assertEqual(self.tsmx("contenido", "revision", "G01")[0], 0)
        self.assertEqual(self.tsmx("contenido", "rechazar", "G01", "--comentario", "falta dato")[0], 0)
        self.tsmx("contenido", "revision", "G01")
        self.assertEqual(self.tsmx("contenido", "aprobar", "G01", "--comentario", "ok")[0], 0)
        _, out, _ = self.tsmx("contenido", "ver", "G01")
        self.assertIn("Aprobación vigente: sí", out)
        nuevo = self.dir / "g02.md"
        nuevo.write_text("cuerpo nuevo de G02", encoding="utf-8")
        _, out, _ = self.tsmx("contenido", "editar", "G02", "--archivo", str(nuevo))
        self.assertIn("Versión 2", out)
        _, out, _ = self.tsmx("contenido", "editar", "G02", "--archivo", str(nuevo))
        self.assertIn("Sin cambios", out)
        codigo, _, err = self.tsmx("contenido", "publicar", "G02", "--url", "https://t/2")
        self.assertEqual(codigo, 2)
        self.assertIn("aprobación vigente", err)
        self.assertEqual(self.tsmx("contenido", "publicar", "G01", "--url", "https://t/1", "--fecha", "2026-11-02")[0], 0)
        self.assertEqual(self.tsmx("contenido", "archivar", "G03", "--motivo", "duplicado")[0], 0)
        _, out, _ = self.tsmx("auditoria", "--entidad", "contenido", "--id", "G01")
        self.assertIn("contenido_publicado", out)

    def test_importar_con_rechazos_sale_con_1(self):
        self.tsmx("importar", "plan", str(DOCS / "audiencia" / "plan_semanas_01_02.md"))
        self.tsmx("contenido", "revision", "G01")
        self.tsmx("contenido", "aprobar", "G01")
        p = self.csv(
            "v.csv",
            CAB_VIDEOS,
            [fila_video("G01", "https://t/1", "2026-11-08"), fila_video("G02", "https://t/2", "2026-11-08", seg="")],
        )
        codigo, out, _ = self.tsmx("importar", "videos", str(p))
        self.assertEqual(codigo, 1)
        self.assertIn("fila 3", out)
        _, out, _ = self.tsmx("metricas", "--min", "1")
        self.assertIn("Orden por intención", out)
        _, out, _ = self.tsmx("metricas", "--por", "pilar", "--min", "1")
        self.assertIn("P2", out)

    def test_economia_respaldo_reporte_y_tiktok(self):
        cab = ["clave_externa", "estado", "monto_bruto_mxn", "fecha_estado", "rfc_valido", "candidato_num"]
        p = self.csv(
            "c.csv",
            cab,
            [
                {
                    "clave_externa": "O1",
                    "estado": "liquidada",
                    "monto_bruto_mxn": "116",
                    "fecha_estado": "2026-11-20",
                    "rfc_valido": "sí",
                    "candidato_num": "2",
                }
            ],
        )
        self.assertEqual(self.tsmx("importar", "comisiones", str(p))[0], 0)
        _, out, _ = self.tsmx("economia")
        self.assertIn("105.5", out)
        self.assertIn("TOTAL", out)

        codigo, out, _ = self.tsmx("respaldo", "crear", "--dir", str(self.dir / "resp"))
        self.assertEqual(codigo, 0)
        archivo = next((self.dir / "resp").glob("*.db"))
        codigo, out, _ = self.tsmx("respaldo", "verificar", str(archivo))
        self.assertEqual((codigo, json.loads(out)["valido"]), (0, True))
        codigo, out, _ = self.tsmx("respaldo", "restaurar", str(archivo), "--destino", str(self.dir / "r.db"))
        self.assertEqual(codigo, 0)
        with open(archivo, "r+b") as fh:
            fh.seek(100)
            fh.write(b"\xff\xff\xff\xff")
        self.assertEqual(self.tsmx("respaldo", "verificar", str(archivo))[0], 1)

        salida = self.dir / "r.html"
        self.assertEqual(self.tsmx("reporte", "--salida", str(salida))[0], 0)
        self.assertIn("<h2>Economía</h2>", salida.read_text(encoding="utf-8"))
        _, out, _ = self.tsmx("tiktok")
        self.assertIn("endpoints_verificados", out)

    def test_lector_no_ve_lo_que_no_debe_hacer(self):
        codigo, _, err = self.tsmx("respaldo", "crear", "--dir", str(self.dir / "x"), usuario="lec")
        self.assertEqual(codigo, 2)
        self.assertEqual(self.tsmx("economia", usuario="lec")[0], 0)  # leer sí
