from tsmx import contenido
from tsmx.errores import EstadoInvalido, PermisoDenegado

from .base import Caso


class TestAprobacion(Caso):
    def preparar(self, autor="ed"):
        contenido.crear(self.con, autor, "G01", "Título", "cuerpo v1", 2, "P2")
        contenido.solicitar_revision(self.con, autor, "G01")

    def test_flujo_completo(self):
        self.preparar()
        contenido.aprobar(self.con, "rev", "G01", "ok")
        self.assertIsNotNone(contenido.aprobacion_vigente(self.con, "G01"))
        pid = contenido.publicar(self.con, "ed", "G01", "https://www.tiktok.com/@x/video/1", "2026-11-01")
        self.assertEqual(contenido.obtener(self.con, "G01")["estado"], "publicado")
        self.assertEqual(contenido.publicar(self.con, "ed", "G01", "https://www.tiktok.com/@x/video/1"), pid)

    def test_edicion_invalida_aprobacion(self):
        self.preparar()
        contenido.aprobar(self.con, "rev", "G01")
        v = contenido.editar(self.con, "ed", "G01", "cuerpo v2")
        self.assertEqual(v, 2)
        self.assertIsNone(contenido.aprobacion_vigente(self.con, "G01"))
        vigentes = self.con.execute("SELECT COUNT(*) FROM aprobaciones WHERE contenido_id='G01' AND vigente=1").fetchone()[0]
        self.assertEqual(vigentes, 0)
        self.assertEqual(contenido.obtener(self.con, "G01")["estado"], "borrador")
        with self.assertRaises(EstadoInvalido):
            contenido.publicar(self.con, "ed", "G01", "https://www.tiktok.com/@x/video/2")
        ultima = [r for r in self.con.execute("SELECT detalle FROM auditoria WHERE accion='contenido_editado'")][-1][0]
        self.assertIn('"aprobaciones_invalidadas": 1', ultima)

    def test_version_escrita_por_fuera_no_hereda_aprobacion(self):
        self.preparar()
        contenido.aprobar(self.con, "rev", "G01")
        self.con.execute("INSERT INTO contenido_versiones VALUES ('G01', 2, 'cambio directo', 'otrohash', 'ed', 't')")
        self.con.execute("UPDATE contenidos SET version_actual = 2 WHERE id = 'G01'")
        self.assertIsNone(contenido.aprobacion_vigente(self.con, "G01"))
        with self.assertRaises(EstadoInvalido):
            contenido.publicar(self.con, "ed", "G01", "https://t/x")

    def test_edicion_sin_cambios_no_crea_version(self):
        self.preparar()
        self.assertIsNone(contenido.editar(self.con, "ed", "G01", "cuerpo v1  \n"))

    def test_revisor_no_aprueba_lo_que_escribio(self):
        contenido.crear(self.con, "juan", "G02", "T", "c", 1, "P1")
        self.con.execute("UPDATE contenido_versiones SET autor = 'rev' WHERE contenido_id = 'G02'")
        contenido.solicitar_revision(self.con, "juan", "G02")
        with self.assertRaises(PermisoDenegado):
            contenido.aprobar(self.con, "rev", "G02")
        self.assertIn("autoaprobacion_denegada", self.acciones())

    def test_propietario_puede_autoaprobar_y_queda_marcado(self):
        self.preparar(autor="juan")
        contenido.aprobar(self.con, "juan", "G01")
        det = self.con.execute("SELECT detalle FROM auditoria WHERE accion='contenido_aprobado'").fetchone()[0]
        self.assertIn('"autoaprobacion": true', det)

    def test_editor_y_lector_no_aprueban(self):
        self.preparar()
        for u in ("ed", "lec"):
            with self.assertRaises(PermisoDenegado):
                contenido.aprobar(self.con, u, "G01")

    def test_rechazo_exige_comentario_y_vuelve_a_borrador(self):
        self.preparar()
        with self.assertRaises(EstadoInvalido):
            contenido.rechazar(self.con, "rev", "G01", "")
        contenido.rechazar(self.con, "rev", "G01", "falta el dato medido")
        self.assertEqual(contenido.obtener(self.con, "G01")["estado"], "borrador")

    def test_publicar_sin_aprobacion_solo_propietario_y_queda_marcado(self):
        contenido.crear(self.con, "ed", "G03", "T", "c", 3, "P1")
        with self.assertRaises(EstadoInvalido):
            contenido.publicar(self.con, "ed", "G03", "https://t/1", permitir_sin_aprobacion=True)
        contenido.publicar(self.con, "juan", "G03", "https://t/1", permitir_sin_aprobacion=True)
        self.assertEqual(self.con.execute("SELECT sin_aprobacion FROM publicaciones").fetchone()[0], 1)

    def test_contenido_con_producto_exige_divulgacion(self):
        self.con.execute("INSERT INTO productos (tiktok_product_id, nombre, creado_en) VALUES ('P1','x','t')")
        contenido.crear(self.con, "ed", "G04", "T", "c", 6, "P4", producto_id=1)
        contenido.solicitar_revision(self.con, "ed", "G04")
        contenido.aprobar(self.con, "rev", "G04")
        with self.assertRaises(EstadoInvalido):
            contenido.publicar(self.con, "ed", "G04", "https://t/4")
        contenido.publicar(self.con, "ed", "G04", "https://t/4", divulgacion="etiqueta de contenido comercial")

    def test_publicado_no_se_edita(self):
        self.preparar()
        contenido.aprobar(self.con, "rev", "G01")
        contenido.publicar(self.con, "ed", "G01", "https://t/9")
        with self.assertRaises(EstadoInvalido):
            contenido.editar(self.con, "ed", "G01", "otro")
