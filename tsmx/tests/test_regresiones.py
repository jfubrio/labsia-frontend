"""Una prueba por cada error encontrado en la revisión de código del 2026-10-11."""
import contextlib
import io
import os

from tsmx import cli, contenido, economia, importar, respaldo
from tsmx.db import conectar
from tsmx.errores import EstadoInvalido

from .base import Caso
from .test_importar import CAB_VIDEOS, fila_video


class TestRegresiones(Caso):
    def test_fila_que_rompe_restriccion_se_rechaza_sin_tumbar_la_importacion(self):
        cab = ["tiktok_product_id", "nombre", "estado", "comision_pct", "candidato_num"]
        r = importar.productos(self.con, "juan", self.csv("p.csv", cab, [
            {"tiktok_product_id": "1", "nombre": "a", "estado": "en_validacion", "comision_pct": "150"},
            {"tiktok_product_id": "2", "nombre": "b", "estado": "en_validacion", "candidato_num": "99"},
            {"tiktok_product_id": "3", "nombre": "c", "estado": "en_validacion"},
        ]))
        self.assertEqual((r.ok, r.rechazadas), (1, 2))
        self.assertEqual(self.con.execute("SELECT estado FROM importaciones").fetchone()[0], "completa")

    def test_no_disponible_en_campo_obligatorio_se_rechaza(self):
        cab = ["clave_externa", "fecha", "concepto", "categoria", "monto_mxn"]
        r = importar.costos(self.con, "juan", self.csv("k.csv", cab, [
            {"clave_externa": "K1", "fecha": "2026-11-01", "concepto": "x", "categoria": "no disponible", "monto_mxn": "1"}]))
        self.assertEqual(r.rechazadas, 1)

    def test_numero_mal_formado_se_rechaza(self):
        contenido.crear(self.con, "juan", "G01", "x", "x", 1, "P1")
        contenido.solicitar_revision(self.con, "juan", "G01"); contenido.aprobar(self.con, "juan", "G01")
        r = importar.videos(self.con, "juan", self.csv("v.csv", CAB_VIDEOS, [
            fila_video("G01", "https://t/1", "2026-11-08", vistas="1.234.567")]))
        self.assertEqual(r.rechazadas, 1)
        self.assertIn("no es un número", r.errores[0])

    def test_reimportar_plan_con_guion_publicado_sin_cambios_es_duplicado(self):
        p = self.dir / "plan.md"
        p.write_text("### G01 · Uno\n| Candidato · pilar | 2 Pelo · P2 X |\ntexto\n", encoding="utf-8")
        importar.plan(self.con, "juan", p)
        contenido.solicitar_revision(self.con, "juan", "G01"); contenido.aprobar(self.con, "juan", "G01")
        contenido.publicar(self.con, "juan", "G01", "https://t/1")
        p.write_text(p.read_text(encoding="utf-8") + "\n### G02 · Dos\n| Candidato · pilar | 1 Cocina · P3 X |\notro\n", encoding="utf-8")
        r = importar.plan(self.con, "juan", p)
        self.assertEqual((r.ok, r.duplicadas, r.rechazadas), (1, 1, 0))

    def test_cambio_de_rfc_en_mismo_estado_es_conflicto(self):
        d = {"clave_externa": "X", "estado": "estimada", "monto_bruto_mxn": 116.0, "rfc_valido": False}
        economia.registrar_comision(self.con, "juan", d, "prueba")
        with self.assertRaises(EstadoInvalido):
            economia.registrar_comision(self.con, "juan", dict(d, rfc_valido=True), "prueba")

    def test_avanzar_estado_completa_candidato_sin_borrar_lo_existente(self):
        base = {"clave_externa": "X", "monto_bruto_mxn": 116.0, "rfc_valido": True}
        economia.registrar_comision(self.con, "juan", dict(base, estado="estimada", fecha_pedido="2026-11-01"), "prueba")
        economia.registrar_comision(self.con, "juan", dict(base, estado="liquidada", candidato_num=3), "prueba")
        fila = self.con.execute("SELECT candidato_num, fecha_pedido FROM comisiones").fetchone()
        self.assertEqual((fila["candidato_num"], fila["fecha_pedido"]), (3, "2026-11-01"))

    def test_restaurar_sobre_la_base_activa_conserva_la_auditoria(self):
        a = respaldo.crear(self.con, "juan", self.dir / "resp")
        respaldo.restaurar(self.con, "juan", a, self.ruta, forzar=True)
        self.con.close()
        self.con = conectar(self.ruta)
        acciones = [r[0] for r in self.con.execute("SELECT accion FROM auditoria")]
        self.assertIn("respaldo_restaurado", acciones)

    def test_init_sobre_base_existente_usa_el_propietario(self):
        salida = io.StringIO()
        with contextlib.redirect_stdout(salida):
            codigo = cli.main(["--db", str(self.ruta), "init", "--id", "otro", "--nombre", "Otro"])
        self.assertEqual(codigo, 0)
        self.assertIn("Se usa 'juan'", salida.getvalue())
