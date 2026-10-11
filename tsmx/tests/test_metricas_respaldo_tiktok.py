import hashlib
import hmac
import shutil

from tsmx import contenido, metricas, reporte, respaldo
from tsmx.adaptadores.tiktok_shop import ClienteTikTokShop, firmar
from tsmx.db import conectar
from tsmx.errores import ConexionPendiente, ErrorTSMX, PermisoDenegado

from .base import Caso


class TestMetricas(Caso):
    def test_orden_por_intencion_no_por_vistas(self):
        n = 0
        for cand, vistas, intencion in ((1, 100000, 10), (2, 10000, 10)):
            for k in range(5):
                n += 1
                cid = f"G{n:02d}"
                contenido.crear(self.con, "juan", cid, cid, cid, cand, "P1")
                contenido.publicar(self.con, "juan", cid, f"https://t/{n}", permitir_sin_aprobacion=True)
                self.con.execute("INSERT INTO metricas_video (publicacion_id, fecha_lectura, vistas, seguidores_ganados, "
                                 "comentarios_intencion_compra) VALUES (?,?,?,?,?)", (n, "2026-11-08", vistas, 10, intencion))
        filas = metricas.indicadores(self.con)
        self.assertEqual([f["grupo"] for f in filas], [2, 1])  # menos vistas pero más intención por mil
        self.assertIn("Audiencia", reporte.generar(self.con))

    def test_grupos_con_pocos_videos_no_se_ordenan(self):
        contenido.crear(self.con, "juan", "G01", "x", "x", 4, "P1")
        contenido.publicar(self.con, "juan", "G01", "https://t/1", permitir_sin_aprobacion=True)
        self.con.execute("INSERT INTO metricas_video (publicacion_id, fecha_lectura, vistas, seguidores_ganados, "
                         "comentarios_intencion_compra) VALUES (1,'2026-11-08',100,1,1)")
        self.assertIsNone(metricas.indicadores(self.con)[0]["orden"])


class TestRespaldo(Caso):
    def test_crear_verificar_restaurar(self):
        contenido.crear(self.con, "juan", "G01", "x", "x", 1, "P1")
        a = respaldo.crear(self.con, "juan", self.dir / "resp")
        rep = respaldo.verificar(a)
        self.assertTrue(rep["valido"], rep["problemas"])
        destino = self.dir / "restaurada.db"
        out = respaldo.restaurar(self.con, "juan", a, destino)
        c = conectar(destino)
        self.assertEqual(c.execute("SELECT COUNT(*) FROM contenidos").fetchone()[0], 1)
        self.assertEqual(c.execute("PRAGMA integrity_check").fetchone()[0], "ok")
        c.close()
        self.assertIsNone(out["copia_previa"])

    def test_detecta_alteracion(self):
        a = respaldo.crear(self.con, "juan", self.dir / "resp")
        with open(a, "r+b") as fh:
            fh.seek(200); fh.write(b"\x00\xff\x00\xff")
        self.assertFalse(respaldo.verificar(a)["valido"])
        with self.assertRaises(ErrorTSMX):
            respaldo.restaurar(self.con, "juan", a, self.dir / "x.db")

    def test_restaurar_sobre_existente_exige_forzar_y_guarda_copia(self):
        a = respaldo.crear(self.con, "juan", self.dir / "resp")
        destino = self.dir / "viva.db"
        shutil.copy2(self.ruta, destino)
        with self.assertRaises(ErrorTSMX):
            respaldo.restaurar(self.con, "juan", a, destino)
        out = respaldo.restaurar(self.con, "juan", a, destino, forzar=True)
        self.assertTrue(out["copia_previa"])

    def test_permisos_de_respaldo(self):
        with self.assertRaises(PermisoDenegado):
            respaldo.crear(self.con, "ed", self.dir / "resp")
        a = respaldo.crear(self.con, "juan", self.dir / "resp")
        with self.assertRaises(PermisoDenegado):
            respaldo.restaurar(self.con, "rev", a, self.dir / "y.db")


class TestFirmaTikTok(Caso):
    def test_firma_sigue_los_pasos_oficiales(self):
        q = {"timestamp": "1700000000", "app_key": "abc", "sign": "ignorar", "access_token": "ignorar", "b": "2"}
        cuerpo = '{"x":1}'
        esperado_cadena = "s3cr3t" + "/ruta" + "app_keyabc" + "b2" + "timestamp1700000000" + cuerpo + "s3cr3t"
        esperado = hmac.new(b"s3cr3t", esperado_cadena.encode(), hashlib.sha256).hexdigest()
        self.assertEqual(firmar("/ruta", q, cuerpo, "s3cr3t"), esperado)
        self.assertEqual(firmar("/ruta", q, cuerpo.encode(), "s3cr3t"), esperado)

    def test_multipart_no_firma_cuerpo(self):
        q = {"app_key": "abc"}
        self.assertEqual(firmar("/r", q, "BINARIO", "s", "multipart/form-data; boundary=x"), firmar("/r", q, None, "s"))

    def test_sin_conexion_no_adivina(self):
        c = ClienteTikTokShop(app_key="k", app_secret="SECRETO-XYZ", access_token="TOKEN-XYZ")
        with self.assertRaises(ConexionPendiente):
            c.ordenes_afiliado()  # endpoint no verificado: no se inventa la ruta
        self.assertNotIn("SECRETO-XYZ", repr(c))
        self.assertNotIn("TOKEN-XYZ", repr(c))

    def test_url_autorizacion_creador(self):
        url = ClienteTikTokShop(app_key="k").url_autorizacion_creador("st")
        self.assertTrue(url.startswith("https://shop.tiktok.com/alliance/creator/auth?"))
        self.assertIn("app_key=k", url)
        self.assertIn("state=st", url)
        with self.assertRaises(ValueError):
            ClienteTikTokShop(app_key="k").url_autorizacion_creador("")

    def test_sin_app_key_pide_conexion(self):
        c = ClienteTikTokShop(app_key="k")
        c.app_key = None
        with self.assertRaises(ConexionPendiente):
            c.url_autorizacion_creador("st")
