"""Comisiones, retenciones y costos (T07).

Distingue siempre comisiones estimadas, aprobadas y liquidadas. El resultado del negocio
solo cuenta comisiones LIQUIDADAS netas menos costos (00_LEER_PRIMERO.md).

Parámetros fiscales tomados de 09_REQUISITOS_AFILIACION_MX.md, fuente [S-8], observada el
2026-10-11 vía fragmento de buscador. Existe una discrepancia con [S-7] (sección 5 de ese
documento): verificar antes de usar las cifras para decisiones.
"""
from . import permisos
from .auditoria import registrar
from .db import ahora, transaccion
from .errores import EstadoInvalido

PARAMETROS = {
    "tasa_iva": 0.16,
    "con_rfc": {"retencion_iva": 0.50, "isr": 0.025},
    "sin_rfc": {"retencion_iva": 1.00, "isr": 0.20},
    "guanajuato_adicional": 0.025,  # sobre la comisión sin IVA, desde 2026-04-01
    "fuente": "09_REQUISITOS_AFILIACION_MX.md [S-8]; verificar discrepancia con [S-7]",
}

ESTADOS = ("estimada", "aprobada", "liquidada", "cancelada")
TRANSICIONES = {
    "estimada": {"aprobada", "liquidada", "cancelada"},
    "aprobada": {"liquidada", "cancelada"},
    "liquidada": set(),
    "cancelada": set(),
}


def calcular_retenciones(bruto: float, rfc_valido: bool, guanajuato: bool = False, p=PARAMETROS) -> dict:
    """La comisión bruta incluye IVA, como en la fórmula oficial [S-8]."""
    if bruto < 0:
        raise EstadoInvalido("El monto bruto no puede ser negativo.")
    tasas = p["con_rfc"] if rfc_valido else p["sin_rfc"]
    sin_iva = bruto / (1 + p["tasa_iva"])
    iva = sin_iva * p["tasa_iva"]
    ret_iva = round(iva * tasas["retencion_iva"], 2)
    ret_isr = round(sin_iva * tasas["isr"], 2)
    ret_est = round(sin_iva * p["guanajuato_adicional"], 2) if guanajuato else 0.0
    return {"sin_iva": round(sin_iva, 2), "iva": round(iva, 2), "retencion_iva": ret_iva,
            "retencion_isr": ret_isr, "retencion_estatal": ret_est,
            "neto": round(bruto - ret_iva - ret_isr - ret_est, 2)}


def registrar_comision(con, actor, d: dict, fuente: str, importacion_id=None) -> str:
    """Alta o avance de estado de una comisión. Devuelve 'nueva', 'duplicada' o 'avanzada'.

    d: clave_externa, estado, monto_bruto_mxn, rfc_valido, guanajuato, fecha_estado,
       y opcionales fecha_pedido, producto_id, publicacion_id, candidato_num.
    """
    permisos.exigir(con, actor, "economia.editar")
    estado = d["estado"]
    if estado not in ESTADOS:
        raise EstadoInvalido(f"Estado de comisión desconocido: {estado}. Usa {ESTADOS}.")
    r = calcular_retenciones(d["monto_bruto_mxn"], d["rfc_valido"], d.get("guanajuato", False))
    previa = con.execute("SELECT * FROM comisiones WHERE clave_externa = ?", (d["clave_externa"],)).fetchone()
    with transaccion(con):
        if not previa:
            con.execute(
                f"INSERT INTO comisiones (clave_externa, producto_id, publicacion_id, candidato_num, fecha_pedido, "
                f"monto_bruto_mxn, estado, rfc_valido, guanajuato, retencion_iva_mxn, retencion_isr_mxn, "
                f"retencion_estatal_mxn, monto_neto_mxn, fecha_{estado}, fuente, importacion_id) "
                f"VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (d["clave_externa"], d.get("producto_id"), d.get("publicacion_id"), d.get("candidato_num"),
                 d.get("fecha_pedido"), d["monto_bruto_mxn"], estado, int(d["rfc_valido"]),
                 int(d.get("guanajuato", False)), r["retencion_iva"], r["retencion_isr"], r["retencion_estatal"],
                 r["neto"], d.get("fecha_estado") or ahora(), fuente, importacion_id))
            registrar(con, actor, "comision_registrada", "comision", d["clave_externa"], estado=estado,
                      bruto=d["monto_bruto_mxn"], neto=r["neto"], fuente=fuente)
            return "nueva"
        if previa["estado"] == estado:
            if abs(previa["monto_bruto_mxn"] - d["monto_bruto_mxn"]) > 0.005:
                raise EstadoInvalido(f"{d['clave_externa']}: mismo estado '{estado}' con otro monto "
                                     f"({previa['monto_bruto_mxn']} frente a {d['monto_bruto_mxn']}). Revisa la fuente.")
            if (previa["rfc_valido"], previa["guanajuato"]) != (int(d["rfc_valido"]), int(d.get("guanajuato", False))):
                raise EstadoInvalido(f"{d['clave_externa']}: mismo estado '{estado}' con otro rfc_valido o guanajuato; "
                                     "cambiaría las retenciones. Revisa la fuente.")
            return "duplicada"
        if estado not in TRANSICIONES[previa["estado"]]:
            raise EstadoInvalido(f"{d['clave_externa']}: no se puede pasar de '{previa['estado']}' a '{estado}'.")
        con.execute(
            f"UPDATE comisiones SET estado = ?, monto_bruto_mxn = ?, rfc_valido = ?, guanajuato = ?, "
            f"retencion_iva_mxn = ?, retencion_isr_mxn = ?, retencion_estatal_mxn = ?, monto_neto_mxn = ?, "
            f"fecha_{estado} = ?, producto_id = COALESCE(?, producto_id), publicacion_id = COALESCE(?, publicacion_id), "
            f"candidato_num = COALESCE(?, candidato_num), fecha_pedido = COALESCE(?, fecha_pedido) "
            f"WHERE clave_externa = ?",
            (estado, d["monto_bruto_mxn"], int(d["rfc_valido"]), int(d.get("guanajuato", False)),
             r["retencion_iva"], r["retencion_isr"], r["retencion_estatal"], r["neto"],
             d.get("fecha_estado") or ahora(), d.get("producto_id"), d.get("publicacion_id"),
             d.get("candidato_num"), d.get("fecha_pedido"), d["clave_externa"]))
        registrar(con, actor, "comision_avanzada", "comision", d["clave_externa"], de=previa["estado"], a=estado,
                  bruto_anterior=previa["monto_bruto_mxn"], bruto=d["monto_bruto_mxn"], fuente=fuente)
    return "avanzada"


def registrar_costo(con, actor, d: dict, importacion_id=None) -> str:
    permisos.exigir(con, actor, "economia.editar")
    previa = con.execute("SELECT * FROM costos WHERE clave_externa = ?", (d["clave_externa"],)).fetchone()
    campos = ("fecha", "concepto", "categoria", "monto_mxn", "candidato_num")
    if previa:
        if all((previa[c] == d.get(c)) or (c == "monto_mxn" and abs(previa[c] - d[c]) < 0.005) for c in campos):
            return "duplicado"
        raise EstadoInvalido(f"El costo {d['clave_externa']} ya existe con otros datos. Usa otra clave o corrige el archivo.")
    with transaccion(con):
        con.execute("INSERT INTO costos (clave_externa, fecha, concepto, categoria, monto_mxn, candidato_num, importacion_id) "
                    "VALUES (?,?,?,?,?,?,?)", (d["clave_externa"], d["fecha"], d["concepto"], d["categoria"],
                                               d["monto_mxn"], d.get("candidato_num"), importacion_id))
        registrar(con, actor, "costo_registrado", "costo", d["clave_externa"], monto=d["monto_mxn"], categoria=d["categoria"])
    return "nuevo"


def resumen(con) -> dict:
    """Totales por candidato y global. 'resultado_liquidado' = liquidadas netas − costos."""
    filas = {}

    def base(k, nombre):
        return filas.setdefault(k, {"candidato_num": k, "candidato": nombre,
                                    **{f"{e}_n": 0 for e in ESTADOS},
                                    **{f"{e}_bruto": 0.0 for e in ESTADOS if e != "cancelada"},
                                    **{f"{e}_neto": 0.0 for e in ESTADOS if e != "cancelada"},
                                    "costos": 0.0})
    nombres = {r["num"]: r["nombre"] for r in con.execute("SELECT num, nombre FROM candidatos")}
    for r in con.execute("SELECT candidato_num, estado, COUNT(*) n, SUM(monto_bruto_mxn) b, SUM(monto_neto_mxn) nt "
                         "FROM comisiones GROUP BY candidato_num, estado"):
        x = base(r["candidato_num"], nombres.get(r["candidato_num"], "sin candidato"))
        x[f"{r['estado']}_n"] = r["n"]
        if r["estado"] != "cancelada":
            x[f"{r['estado']}_bruto"] = round(r["b"], 2)
            x[f"{r['estado']}_neto"] = round(r["nt"], 2)
    for r in con.execute("SELECT candidato_num, SUM(monto_mxn) c FROM costos GROUP BY candidato_num"):
        base(r["candidato_num"], nombres.get(r["candidato_num"], "sin candidato"))["costos"] = round(r["c"], 2)
    for x in filas.values():
        x["resultado_liquidado"] = round(x["liquidada_neto"] - x["costos"], 2)
    total = {"candidato_num": None, "candidato": "TOTAL"}
    for x in filas.values():
        for k, v in x.items():
            if k not in ("candidato_num", "candidato"):
                total[k] = round(total.get(k, 0) + v, 2)
    orden = sorted(filas.values(), key=lambda x: (x["candidato_num"] is None, x["candidato_num"] or 0))
    return {"filas": orden, "total": total if filas else None, "parametros": PARAMETROS}
