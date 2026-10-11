"""Importadores con validación, datos ausentes e idempotencia (T05).

Reglas comunes:
- El mismo archivo (mismo SHA-256) no se importa dos veces.
- Cada fila se valida; las inválidas se rechazan con su número de fila y el resto se importa.
- "no disponible" se guarda como NULL. Un campo obligatorio vacío es un error, no un cero.
- Una fila que ya existe idéntica cuenta como duplicada. Si existe con datos distintos, es un conflicto
  y se rechaza: nunca se sobrescribe en silencio.
"""

import csv
import re
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path

from . import contenido, economia, permisos
from .auditoria import registrar
from .db import ahora, sha256_archivo, transaccion
from .errores import ErrorTSMX

NO_DISPONIBLE = {"no disponible", "n/d", "nd"}


@dataclass
class Resultado:
    tipo: str
    archivo: str
    ok: int = 0
    duplicadas: int = 0
    rechazadas: int = 0
    errores: list = field(default_factory=list)
    ya_importado: bool = False

    def resumen(self) -> str:
        if self.ya_importado:
            return f"{self.archivo}: este archivo ya se importó antes ({self.tipo}). Nada que hacer."
        return f"{self.archivo} ({self.tipo}): {self.ok} importadas, {self.duplicadas} duplicadas, {self.rechazadas} rechazadas."


class FilaInvalida(ErrorTSMX):
    pass


def numero(valor, campo, obligatorio=False, entero=False):
    v = (valor or "").strip().lower().replace(",", "")
    if v == "":
        if obligatorio:
            raise FilaInvalida(f"'{campo}' vacío: escribe 'no disponible' si no se ve")
        return None
    if v in NO_DISPONIBLE:
        return None
    m = re.fullmatch(r"\$?\s*(\d+(?:\.\d*)?|\.\d+)\s*(mil|k|m|mill|millones)?", v)
    if not m:
        raise FilaInvalida(f"'{campo}' no es un número: '{valor}'")
    n = float(m.group(1)) * {None: 1, "mil": 1e3, "k": 1e3, "m": 1e6, "mill": 1e6, "millones": 1e6}[m.group(2)]
    return int(round(n)) if entero else n


def texto(valor, campo, obligatorio=False):
    v = (valor or "").strip()
    if v == "" and obligatorio:
        raise FilaInvalida(f"'{campo}' vacío")
    if v.lower() in NO_DISPONIBLE:
        if obligatorio:
            raise FilaInvalida(f"'{campo}' es obligatorio y no puede ser 'no disponible'")
        return None
    return v or None


def fecha(valor, campo, obligatorio=False):
    v = texto(valor, campo, obligatorio)
    if v and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        raise FilaInvalida(f"'{campo}' debe ser AAAA-MM-DD: '{valor}'")
    return v


def booleano(valor, campo):
    v = (valor or "").strip().lower()
    if v in ("sí", "si", "s", "1", "true", "verdadero"):
        return True
    if v in ("no", "n", "0", "false", "falso"):
        return False
    raise FilaInvalida(f"'{campo}' debe ser sí o no: '{valor}'")


def _iniciar(con, actor, tipo, path):
    sha = sha256_archivo(path)
    previa = con.execute("SELECT id, estado FROM importaciones WHERE tipo = ? AND sha256 = ?", (tipo, sha)).fetchone()
    if previa and previa["estado"] == "completa":
        return None
    if previa:
        con.execute(
            "UPDATE importaciones SET estado = 'en_curso', usuario = ?, creado_en = ? WHERE id = ?",
            (actor, ahora(), previa["id"]),
        )
        return previa["id"]
    cur = con.execute(
        "INSERT INTO importaciones (tipo, archivo, sha256, filas_ok, filas_duplicadas, filas_rechazadas, "
        "estado, usuario, creado_en) VALUES (?,?,?,0,0,0,'en_curso',?,?)",
        (tipo, path.name, sha, actor, ahora()),
    )
    return cur.lastrowid


def _cerrar(con, actor, imp_id, res: Resultado, estado="completa"):
    con.execute(
        "UPDATE importaciones SET filas_ok = ?, filas_duplicadas = ?, filas_rechazadas = ?, estado = ? WHERE id = ?",
        (res.ok, res.duplicadas, res.rechazadas, estado, imp_id),
    )
    registrar(
        con,
        actor,
        f"importacion_{estado}",
        "importacion",
        imp_id,
        tipo=res.tipo,
        archivo=res.archivo,
        ok=res.ok,
        duplicadas=res.duplicadas,
        rechazadas=res.rechazadas,
    )


def _ejecutar(con, actor, tipo, path, procesar):
    path = Path(path)
    res = Resultado(tipo, path.name)
    imp = _iniciar(con, actor, tipo, path)
    if imp is None:
        res.ya_importado = True
        return res
    try:
        procesar(res, imp)
    except BaseException:
        _cerrar(con, actor, imp, res, "fallida")
        raise
    _cerrar(con, actor, imp, res)
    return res


def _filas_csv(path, obligatorias):
    with open(path, encoding="utf-8-sig", newline="") as fh:
        lector = csv.DictReader(fh)
        faltan = [c for c in obligatorias if c not in (lector.fieldnames or [])]
        if faltan:
            raise ErrorTSMX(f"{Path(path).name}: faltan columnas {faltan}")
        for i, fila in enumerate(lector, start=2):
            if any((v or "").strip() for v in fila.values()):
                yield i, fila


def _fila(res, i, fn):
    try:
        estado = fn()
    except (ErrorTSMX, sqlite3.IntegrityError) as e:
        res.rechazadas += 1
        res.errores.append(f"fila {i}: {e}")
        return
    if estado in ("duplicada", "duplicado"):
        res.duplicadas += 1
    else:
        res.ok += 1


# ---------- plan de contenido (Markdown) ----------

SECCION = re.compile(r"^###\s+(G\d+)\s*·\s*(.+?)\s*$", re.M)


def leer_plan(path) -> list[dict]:
    txt = Path(path).read_text(encoding="utf-8")
    marcas = list(SECCION.finditer(txt))
    guiones = []
    for k, m in enumerate(marcas):
        fin = marcas[k + 1].start() if k + 1 < len(marcas) else len(txt)
        cuerpo = txt[m.start() : fin]
        cuerpo = re.split(r"^---\s*$|^## ", cuerpo, flags=re.M)[0].strip()
        cp = re.search(r"^\|\s*Candidato · pilar\s*\|\s*(\d+)[^|]*?·\s*(P\d)", cuerpo, re.M)
        guiones.append(
            {
                "id": m.group(1),
                "titulo": m.group(2),
                "cuerpo": cuerpo,
                "candidato_num": int(cp.group(1)) if cp else None,
                "pilar": cp.group(2) if cp else None,
            }
        )
    return guiones


def plan(con, actor, path) -> Resultado:
    permisos.exigir(con, actor, "importar")

    def procesar(res, imp):
        for g in leer_plan(path):

            def una(g=g):
                if (
                    g["candidato_num"]
                    and not con.execute("SELECT 1 FROM candidatos WHERE num = ?", (g["candidato_num"],)).fetchone()
                ):
                    raise FilaInvalida(f"candidato {g['candidato_num']} no existe; ejecuta 'tsmx candidatos sembrar'")
                if not con.execute("SELECT 1 FROM contenidos WHERE id = ?", (g["id"],)).fetchone():
                    contenido.crear(con, actor, g["id"], g["titulo"], g["cuerpo"], g["candidato_num"], g["pilar"])
                    return "nueva"
                return "editada" if contenido.editar(con, actor, g["id"], g["cuerpo"], g["titulo"]) else "duplicada"

            _fila(res, g["id"], una)

    return _ejecutar(con, actor, "plan", path, procesar)


# ---------- registro de videos (CSV) ----------

METRICAS = {
    "vistas": True,
    "tiempo_medio_s": False,
    "pct_completo": False,
    "likes": True,
    "comentarios": True,
    "compartidos": True,
    "guardados": True,
    "visitas_perfil": True,
    "seguidores_ganados": True,
    "comentarios_intencion_compra": True,
    "comentarios_objecion": True,
}
OBLIGATORIAS_VIDEO = ("vistas", "seguidores_ganados", "comentarios_intencion_compra")


def videos(con, actor, path, permitir_sin_aprobacion=False) -> Resultado:
    permisos.exigir(con, actor, "importar")

    def procesar(res, imp):
        for i, f in _filas_csv(path, ["video_id", "url", "fecha_lectura", *METRICAS]):

            def una(f=f):
                cid = texto(f["video_id"], "video_id", True)
                url = texto(f["url"], "url", True)
                if not url.startswith("http"):
                    raise FilaInvalida(f"url inválida: {url}")
                lectura = fecha(f["fecha_lectura"], "fecha_lectura", True)
                datos = {m: numero(f.get(m), m, m in OBLIGATORIAS_VIDEO, entero=ent) for m, ent in METRICAS.items()}
                with transaccion(con):  # publicación y métricas: todo o nada
                    pub = con.execute("SELECT id, contenido_id FROM publicaciones WHERE url = ?", (url,)).fetchone()
                    if pub and pub["contenido_id"] != cid:
                        raise FilaInvalida(f"la url ya pertenece a {pub['contenido_id']}")
                    pub_id = (
                        pub["id"]
                        if pub
                        else contenido.publicar(
                            con,
                            actor,
                            cid,
                            url,
                            fecha(f.get("fecha_pub"), "fecha_pub"),
                            texto(f.get("divulgacion_comercial"), "divulgacion_comercial"),
                            permitir_sin_aprobacion,
                        )
                    )
                    previa = con.execute(
                        "SELECT * FROM metricas_video WHERE publicacion_id = ? AND fecha_lectura = ?", (pub_id, lectura)
                    ).fetchone()
                    if previa:
                        if all(previa[m] == datos[m] for m in METRICAS):
                            return "duplicada"
                        raise FilaInvalida(
                            f"ya hay una lectura de {cid} del {lectura} con otras cifras; usa otra fecha de lectura"
                        )
                    con.execute(
                        f"INSERT INTO metricas_video (publicacion_id, fecha_lectura, {', '.join(METRICAS)}, importacion_id) "
                        f"VALUES (?, ?, {', '.join('?' * len(METRICAS))}, ?)",
                        (pub_id, lectura, *datos.values(), imp),
                    )
                    return "nueva"

            _fila(res, i, una)

    return _ejecutar(con, actor, "videos", path, procesar)


# ---------- comisiones (CSV) ----------


def _producto_id(con, tiktok_id):
    if not tiktok_id:
        return None
    r = con.execute("SELECT id FROM productos WHERE tiktok_product_id = ?", (tiktok_id,)).fetchone()
    if not r:
        raise FilaInvalida(f"producto {tiktok_id} no existe; impórtalo primero")
    return r["id"]


def _publicacion_id(con, url):
    if not url:
        return None
    r = con.execute("SELECT id FROM publicaciones WHERE url = ?", (url,)).fetchone()
    if not r:
        raise FilaInvalida(f"no hay publicación registrada con la url {url}")
    return r["id"]


def comisiones(con, actor, path, fuente="csv_manual") -> Resultado:
    permisos.exigir(con, actor, "economia.editar")

    def procesar(res, imp):
        for i, f in _filas_csv(path, ["clave_externa", "estado", "monto_bruto_mxn", "fecha_estado", "rfc_valido"]):

            def una(f=f):
                bruto = numero(f["monto_bruto_mxn"], "monto_bruto_mxn", True)
                if bruto is None:
                    raise FilaInvalida("monto_bruto_mxn es obligatorio y no puede ser 'no disponible'")
                d = {
                    "clave_externa": texto(f["clave_externa"], "clave_externa", True),
                    "estado": texto(f["estado"], "estado", True).lower(),
                    "monto_bruto_mxn": bruto,
                    "fecha_estado": fecha(f["fecha_estado"], "fecha_estado", True),
                    "fecha_pedido": fecha(f.get("fecha_pedido"), "fecha_pedido"),
                    "rfc_valido": booleano(f["rfc_valido"], "rfc_valido"),
                    "guanajuato": booleano(f.get("guanajuato") or "no", "guanajuato"),
                    "producto_id": _producto_id(con, texto(f.get("producto_tiktok_id"), "producto_tiktok_id")),
                    "publicacion_id": _publicacion_id(con, texto(f.get("url_video"), "url_video")),
                    "candidato_num": numero(f.get("candidato_num"), "candidato_num", entero=True),
                }
                return economia.registrar_comision(con, actor, d, fuente, imp)

            _fila(res, i, una)

    return _ejecutar(con, actor, "comisiones", path, procesar)


# ---------- costos (CSV) ----------


def costos(con, actor, path) -> Resultado:
    permisos.exigir(con, actor, "economia.editar")

    def procesar(res, imp):
        for i, f in _filas_csv(path, ["clave_externa", "fecha", "concepto", "categoria", "monto_mxn"]):

            def una(f=f):
                monto = numero(f["monto_mxn"], "monto_mxn", True)
                if monto is None:
                    raise FilaInvalida("monto_mxn es obligatorio")
                d = {
                    "clave_externa": texto(f["clave_externa"], "clave_externa", True),
                    "fecha": fecha(f["fecha"], "fecha", True),
                    "concepto": texto(f["concepto"], "concepto", True),
                    "categoria": texto(f["categoria"], "categoria", True).lower(),
                    "monto_mxn": monto,
                    "candidato_num": numero(f.get("candidato_num"), "candidato_num", entero=True),
                }
                if d["categoria"] not in ("muestra", "producto_demo", "herramienta", "publicidad", "otro"):
                    raise FilaInvalida(f"categoría desconocida: {d['categoria']}")
                return economia.registrar_costo(con, actor, d, imp)

            _fila(res, i, una)

    return _ejecutar(con, actor, "costos", path, procesar)


# ---------- productos (CSV, resultado de T03) ----------

CAMPOS_PRODUCTO = ("candidato_num", "nombre", "variante", "vendedor", "precio_mxn", "comision_pct", "estado", "evidencia")


def productos(con, actor, path) -> Resultado:
    permisos.exigir(con, actor, "importar")

    def procesar(res, imp):
        for i, f in _filas_csv(path, ["tiktok_product_id", "nombre", "estado"]):

            def una(f=f):
                d = {
                    "tiktok_product_id": texto(f["tiktok_product_id"], "tiktok_product_id", True),
                    "candidato_num": numero(f.get("candidato_num"), "candidato_num", entero=True),
                    "nombre": texto(f["nombre"], "nombre", True),
                    "variante": texto(f.get("variante"), "variante"),
                    "vendedor": texto(f.get("vendedor"), "vendedor"),
                    "precio_mxn": numero(f.get("precio_mxn"), "precio_mxn"),
                    "comision_pct": numero(f.get("comision_pct"), "comision_pct"),
                    "estado": texto(f["estado"], "estado", True).lower(),
                    "evidencia": texto(f.get("evidencia"), "evidencia"),
                }
                if d["estado"] not in ("en_validacion", "apto", "descartado"):
                    raise FilaInvalida(f"estado de producto desconocido: {d['estado']}")
                if d["estado"] == "apto" and (d["precio_mxn"] is None or d["comision_pct"] is None or not d["evidencia"]):
                    raise FilaInvalida("un producto 'apto' necesita precio, comisión y evidencia (T03)")
                previa = con.execute("SELECT * FROM productos WHERE tiktok_product_id = ?", (d["tiktok_product_id"],)).fetchone()
                with transaccion(con):
                    if not previa:
                        con.execute(
                            f"INSERT INTO productos (tiktok_product_id, {', '.join(CAMPOS_PRODUCTO)}, creado_en) "
                            f"VALUES (?, {', '.join('?' * len(CAMPOS_PRODUCTO))}, ?)",
                            (d["tiktok_product_id"], *[d[c] for c in CAMPOS_PRODUCTO], ahora()),
                        )
                        registrar(con, actor, "producto_registrado", "producto", d["tiktok_product_id"], estado=d["estado"])
                        return "nueva"
                    cambios = {c: [previa[c], d[c]] for c in CAMPOS_PRODUCTO if previa[c] != d[c]}
                    if not cambios:
                        return "duplicada"
                    con.execute(
                        f"UPDATE productos SET {', '.join(c + ' = ?' for c in cambios)} WHERE id = ?",
                        (*[d[c] for c in cambios], previa["id"]),
                    )
                    registrar(con, actor, "producto_actualizado", "producto", d["tiktok_product_id"], cambios=cambios)
                return "actualizada"

            _fila(res, i, una)

    return _ejecutar(con, actor, "productos", path, procesar)


IMPORTADORES = {"plan": plan, "videos": videos, "comisiones": comisiones, "costos": costos, "productos": productos}
