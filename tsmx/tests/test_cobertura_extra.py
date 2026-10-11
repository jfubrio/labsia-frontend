"""Ramas que la revisión de cobertura encontró sin probar."""

import json
import urllib.parse
from unittest import mock

from tsmx import contenido, importar, reporte, respaldo
from tsmx.adaptadores import tiktok_shop
from tsmx.errores import ConexionPendiente, ErrorTSMX, EstadoInvalido, NoEncontrado

from .base import Caso
from .test_importar import CAB_VIDEOS, fila_video

CAB_COM = [
    "clave_externa",
    "estado",
    "monto_bruto_mxn",
    "fecha_estado",
    "rfc_valido",
    "guanajuato",
    "producto_tiktok_id",
    "url_video",
]


class TestImportarRamas(Caso):
    def test_archivo_corregido_tras_fallar_se_importa(self):
        p = self.csv("c.csv", ["clave_externa"], [{"clave_externa": "A"}])
        with self.assertRaises(ErrorTSMX):
            importar.comisiones(self.con, "juan", p)
        p.write_text(
            "clave_externa,estado,monto_bruto_mxn,fecha_estado,rfc_valido\nA,estimada,10,2026-11-01,sí\n", encoding="utf-8"
        )
        r = importar.comisiones(self.con, "juan", p)
        self.assertEqual(r.ok, 1)
        estados = [x[0] for x in self.con.execute("SELECT estado FROM importaciones ORDER BY id")]
        self.assertEqual(estados, ["fallida", "completa"])

    def test_mismo_archivo_fallido_se_puede_reintentar(self):
        p = self.csv("k.csv", ["clave_externa"], [{"clave_externa": "A"}])
        for _ in range(2):
            with self.assertRaises(ErrorTSMX):
                importar.costos(self.con, "juan", p)
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM importaciones").fetchone()[0], 1)

    def test_resumen_de_archivo_ya_importado(self):
        p = self.csv(
            "k.csv",
            ["clave_externa", "fecha", "concepto", "categoria", "monto_mxn"],
            [{"clave_externa": "K", "fecha": "2026-11-01", "concepto": "x", "categoria": "otro", "monto_mxn": "1"}],
        )
        importar.costos(self.con, "juan", p)
        self.assertIn("ya se importó", importar.costos(self.con, "juan", p).resumen())

    def test_comisiones_con_referencias_y_valores_invalidos(self):
        base = {
            "clave_externa": "X",
            "estado": "estimada",
            "monto_bruto_mxn": "10",
            "fecha_estado": "2026-11-01",
            "rfc_valido": "sí",
        }
        r = importar.comisiones(
            self.con,
            "juan",
            self.csv(
                "c.csv",
                CAB_COM,
                [
                    dict(base, clave_externa="A", producto_tiktok_id="NOEXISTE"),
                    dict(base, clave_externa="B", url_video="https://t/noexiste"),
                    dict(base, clave_externa="C", rfc_valido="tal vez"),
                    dict(base, clave_externa="D", fecha_estado="11/01/2026"),
                    dict(base, clave_externa="E", estado="pagada"),
                ],
            ),
        )
        self.assertEqual((r.ok, r.rechazadas), (0, 5))
        texto = " ".join(r.errores)
        for fragmento in ("producto NOEXISTE", "no hay publicación", "sí o no", "AAAA-MM-DD", "desconocido"):
            self.assertIn(fragmento, texto)

    def test_productos_actualiza_y_audita_cambios(self):
        cab = ["tiktok_product_id", "nombre", "estado", "precio_mxn"]
        importar.productos(
            self.con,
            "juan",
            self.csv(
                "p1.csv", cab, [{"tiktok_product_id": "1", "nombre": "rodillo", "estado": "en_validacion", "precio_mxn": "199"}]
            ),
        )
        r = importar.productos(
            self.con,
            "juan",
            self.csv(
                "p2.csv",
                cab,
                [
                    {"tiktok_product_id": "1", "nombre": "rodillo", "estado": "en_validacion", "precio_mxn": "179"},
                    {"tiktok_product_id": "2", "nombre": "x", "estado": "raro"},
                ],
            ),
        )
        self.assertEqual((r.ok, r.rechazadas), (1, 1))
        self.assertEqual(self.con.execute("SELECT precio_mxn FROM productos").fetchone()[0], 179)
        det = json.loads(self.con.execute("SELECT detalle FROM auditoria WHERE accion='producto_actualizado'").fetchone()[0])
        self.assertEqual(det["cambios"]["precio_mxn"], [199.0, 179.0])

    def test_plan_con_candidato_inexistente(self):
        p = self.dir / "plan.md"
        p.write_text("### G01 · Uno\n| Candidato · pilar | 9 Otro · P1 X |\ntexto\n", encoding="utf-8")
        r = importar.plan(self.con, "juan", p)
        self.assertEqual(r.rechazadas, 1)
        self.assertIn("candidatos sembrar", r.errores[0])

    def test_url_de_otro_contenido_se_rechaza(self):
        for cid in ("G01", "G02"):
            contenido.crear(self.con, "juan", cid, cid, cid, 1, "P1")
            contenido.solicitar_revision(self.con, "juan", cid)
            contenido.aprobar(self.con, "juan", cid)
        importar.videos(self.con, "juan", self.csv("a.csv", CAB_VIDEOS, [fila_video("G01", "https://t/1", "2026-11-08")]))
        r = importar.videos(self.con, "juan", self.csv("b.csv", CAB_VIDEOS, [fila_video("G02", "https://t/1", "2026-11-08")]))
        self.assertIn("ya pertenece a G01", r.errores[0])


class TestContenidoRamas(Caso):
    def test_estados_invalidos_y_no_encontrado(self):
        with self.assertRaises(NoEncontrado):
            contenido.obtener(self.con, "G99")
        contenido.crear(self.con, "juan", "G01", "x", "x", 1, "P1")
        with self.assertRaises(EstadoInvalido):
            contenido.crear(self.con, "juan", "G01", "x", "x", 1, "P1")
        with self.assertRaises(EstadoInvalido):
            contenido.aprobar(self.con, "juan", "G01")  # no está en revisión
        contenido.solicitar_revision(self.con, "juan", "G01")
        with self.assertRaises(EstadoInvalido):
            contenido.solicitar_revision(self.con, "juan", "G01")
        contenido.archivar(self.con, "juan", "G01", "ya no aplica")
        with self.assertRaises(EstadoInvalido):
            contenido.publicar(self.con, "juan", "G01", "https://t/1", permitir_sin_aprobacion=True)
        self.assertEqual([c["id"] for c in contenido.listar(self.con, "archivado")], ["G01"])


class TestRespaldoRamas(Caso):
    def test_verificar_sin_manifiesto_o_archivo_ilegible(self):
        with self.assertRaises(ErrorTSMX):
            respaldo.verificar(self.dir / "no.db")
        a = respaldo.crear(self.con, "juan", self.dir / "resp")
        a.write_bytes(b"no es una base sqlite")
        rep = respaldo.verificar(a)
        self.assertFalse(rep["valido"])
        self.assertTrue(any("integrity_check" in p for p in rep["problemas"]))


class TestReporteSeguro(Caso):
    def test_texto_importado_se_escapa_en_html(self):
        contenido.crear(self.con, "juan", "G01", "<script>alert(1)</script>", "x", 1, "P1")
        html = reporte.generar(self.con)
        self.assertNotIn("<script>alert(1)</script>", html)
        self.assertIn("&lt;script&gt;", html)


class TestPeticionTikTok(Caso):
    def test_sin_credenciales_con_endpoint_configurado(self):
        with (
            mock.patch.dict(tiktok_shop.ENDPOINTS, {"ordenes_afiliado": "/affiliate_creator/x"}),
            self.assertRaises(ConexionPendiente),
        ):
            tiktok_shop.ClienteTikTokShop(app_key="k").ordenes_afiliado()

    def test_peticion_firmada_sin_red(self):
        capturada = {}

        class Respuesta:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self):
                return b'{"code": 0}'

        def falso_urlopen(req, timeout):
            capturada["req"], capturada["timeout"] = req, timeout
            return Respuesta()

        c = tiktok_shop.ClienteTikTokShop(app_key="k", app_secret="SECRETO", access_token="TOKEN")
        with (
            mock.patch.dict(tiktok_shop.ENDPOINTS, {"ordenes_afiliado": "/ruta/202405"}),
            mock.patch.object(tiktok_shop.urllib.request, "urlopen", falso_urlopen),
        ):
            self.assertEqual(c.ordenes_afiliado(page_size=10), {"code": 0})
        req = capturada["req"]
        self.assertTrue(req.full_url.startswith(tiktok_shop.BASE_API + "/ruta/202405?"))
        self.assertIn("sign=", req.full_url)
        self.assertNotIn("TOKEN", req.full_url)  # el token va en cabecera, no en la consulta
        self.assertNotIn("SECRETO", req.full_url)
        self.assertEqual(req.get_header("X-tts-access-token"), "TOKEN")
        self.assertEqual(req.data, b'{"page_size":10}')
        consulta = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(req.full_url).query))
        firma = consulta.pop("sign")
        self.assertEqual(firma, tiktok_shop.firmar("/ruta/202405", consulta, req.data, "SECRETO"))
        self.assertEqual(set(consulta), {"app_key", "timestamp"})
        self.assertEqual(capturada["timeout"], 30)
