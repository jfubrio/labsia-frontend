from tsmx import economia, importar
from tsmx.errores import EstadoInvalido, PermisoDenegado

from .base import Caso

CAB = ["clave_externa", "estado", "monto_bruto_mxn", "fecha_estado", "fecha_pedido", "rfc_valido", "guanajuato",
       "producto_tiktok_id", "url_video", "candidato_num"]


class TestEconomia(Caso):
    def test_retenciones_con_y_sin_rfc(self):
        r = economia.calcular_retenciones(116.0, True)
        self.assertEqual((r["sin_iva"], r["iva"], r["retencion_iva"], r["retencion_isr"]), (100.0, 16.0, 8.0, 2.5))
        self.assertEqual(r["neto"], 105.5)
        s = economia.calcular_retenciones(116.0, False)
        self.assertEqual((s["retencion_iva"], s["retencion_isr"], s["neto"]), (16.0, 20.0, 80.0))
        g = economia.calcular_retenciones(116.0, True, guanajuato=True)
        self.assertEqual((g["retencion_estatal"], g["neto"]), (2.5, 103.0))

    def test_ciclo_de_estados_e_importacion(self):
        p = self.csv("c1.csv", CAB, [
            {"clave_externa": "O1:A", "estado": "estimada", "monto_bruto_mxn": "116", "fecha_estado": "2026-11-02", "rfc_valido": "sí", "candidato_num": "2"},
            {"clave_externa": "O2:A", "estado": "estimada", "monto_bruto_mxn": "58", "fecha_estado": "2026-11-02", "rfc_valido": "sí", "candidato_num": "2"},
        ])
        self.assertEqual(importar.comisiones(self.con, "juan", p).ok, 2)
        p2 = self.csv("c2.csv", CAB, [
            {"clave_externa": "O1:A", "estado": "liquidada", "monto_bruto_mxn": "116", "fecha_estado": "2026-11-20", "rfc_valido": "sí", "candidato_num": "2"},
            {"clave_externa": "O2:A", "estado": "cancelada", "monto_bruto_mxn": "58", "fecha_estado": "2026-11-05", "rfc_valido": "sí", "candidato_num": "2"},
            {"clave_externa": "O3:A", "estado": "aprobada", "monto_bruto_mxn": "no disponible", "fecha_estado": "2026-11-05", "rfc_valido": "sí"},
        ])
        r = importar.comisiones(self.con, "juan", p2)
        self.assertEqual((r.ok, r.rechazadas), (2, 1))
        p3 = self.csv("c3.csv", CAB, [
            {"clave_externa": "O1:A", "estado": "aprobada", "monto_bruto_mxn": "116", "fecha_estado": "2026-11-21", "rfc_valido": "sí"},
        ])
        r3 = importar.comisiones(self.con, "juan", p3)
        self.assertEqual(r3.rechazadas, 1)
        self.assertIn("no se puede pasar de 'liquidada' a 'aprobada'", r3.errores[0])

    def test_mismo_estado_otro_monto_es_conflicto(self):
        d = {"clave_externa": "X", "estado": "estimada", "monto_bruto_mxn": 10.0, "rfc_valido": True}
        economia.registrar_comision(self.con, "juan", d, "prueba")
        self.assertEqual(economia.registrar_comision(self.con, "juan", d, "prueba"), "duplicada")
        with self.assertRaises(EstadoInvalido):
            economia.registrar_comision(self.con, "juan", dict(d, monto_bruto_mxn=11.0), "prueba")

    def test_resumen_separa_estados_y_resta_costos(self):
        for clave, estado, monto in (("A", "estimada", 116.0), ("B", "aprobada", 116.0), ("C", "liquidada", 116.0)):
            economia.registrar_comision(self.con, "juan", {"clave_externa": clave, "estado": estado,
                                        "monto_bruto_mxn": monto, "rfc_valido": True, "candidato_num": 2}, "prueba")
        economia.registrar_costo(self.con, "juan", {"clave_externa": "K1", "fecha": "2026-11-01", "concepto": "muestra",
                                                    "categoria": "muestra", "monto_mxn": 50.0, "candidato_num": 2})
        fila = economia.resumen(self.con)["filas"][0]
        self.assertEqual((fila["estimada_n"], fila["aprobada_n"], fila["liquidada_n"]), (1, 1, 1))
        self.assertEqual(fila["liquidada_neto"], 105.5)
        self.assertEqual(fila["resultado_liquidado"], 55.5)  # estimadas y aprobadas NO cuentan

    def test_editor_no_toca_economia(self):
        with self.assertRaises(PermisoDenegado):
            economia.registrar_costo(self.con, "ed", {"clave_externa": "K", "fecha": "2026-11-01", "concepto": "x",
                                                      "categoria": "otro", "monto_mxn": 1.0})

    def test_costos_duplicado_y_conflicto(self):
        cab = ["clave_externa", "fecha", "concepto", "categoria", "monto_mxn", "candidato_num"]
        base = {"clave_externa": "K1", "fecha": "2026-11-01", "concepto": "tripié", "categoria": "herramienta", "monto_mxn": "250"}
        importar.costos(self.con, "juan", self.csv("k1.csv", cab, [base]))
        r = importar.costos(self.con, "juan", self.csv("k2.csv", cab, [base, dict(base, monto_mxn="300"),
                                                                       dict(base, clave_externa="K2", categoria="cafe")]))
        self.assertEqual((r.ok, r.duplicadas, r.rechazadas), (0, 1, 2))

    def test_producto_apto_exige_evidencia(self):
        cab = ["tiktok_product_id", "candidato_num", "nombre", "precio_mxn", "comision_pct", "estado", "evidencia"]
        r = importar.productos(self.con, "juan", self.csv("p.csv", cab, [
            {"tiktok_product_id": "1", "nombre": "rodillo", "estado": "apto", "precio_mxn": "199"},
            {"tiktok_product_id": "2", "nombre": "guante", "estado": "en_validacion"},
        ]))
        self.assertEqual((r.ok, r.rechazadas), (1, 1))
