"""Contenido versionado y flujo de aprobación (T06).

Reglas:
- Cada edición crea una versión nueva con su hash.
- Una edición invalida todas las aprobaciones previas: el contenido vuelve a borrador.
- Solo se publica una versión con aprobación vigente cuyo hash coincide con el de la versión actual.
- Un revisor no aprueba su propia versión; el propietario sí puede, y queda marcado en la auditoría.
- Contenido con producto exige divulgación comercial al publicar.
"""
import hashlib

from . import permisos
from .auditoria import registrar
from .db import ahora, transaccion
from .errores import EstadoInvalido, NoEncontrado, PermisoDenegado


def hash_cuerpo(cuerpo: str) -> str:
    normal = "\n".join(l.rstrip() for l in cuerpo.strip().splitlines())
    return hashlib.sha256(normal.encode("utf-8")).hexdigest()


def obtener(con, cid: str) -> dict:
    fila = con.execute("SELECT * FROM contenidos WHERE id = ?", (cid,)).fetchone()
    if not fila:
        raise NoEncontrado(f"No existe el contenido {cid}.")
    return dict(fila)


def version_actual(con, cid: str) -> dict:
    c = obtener(con, cid)
    return dict(con.execute("SELECT * FROM contenido_versiones WHERE contenido_id = ? AND version = ?",
                            (cid, c["version_actual"])).fetchone())


def aprobacion_vigente(con, cid: str):
    v = version_actual(con, cid)
    fila = con.execute(
        "SELECT * FROM aprobaciones WHERE contenido_id = ? AND version = ? AND hash = ? "
        "AND decision = 'aprobado' AND vigente = 1 ORDER BY id DESC LIMIT 1",
        (cid, v["version"], v["hash"])).fetchone()
    return dict(fila) if fila else None


def crear(con, actor, cid, titulo, cuerpo, candidato_num=None, pilar=None, producto_id=None):
    permisos.exigir(con, actor, "contenido.editar")
    if con.execute("SELECT 1 FROM contenidos WHERE id = ?", (cid,)).fetchone():
        raise EstadoInvalido(f"El contenido {cid} ya existe; usa editar.")
    t, h = ahora(), hash_cuerpo(cuerpo)
    with transaccion(con):
        con.execute("INSERT INTO contenidos (id, candidato_num, pilar, titulo, estado, version_actual, producto_id, "
                    "creado_por, creado_en, actualizado_en) VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (cid, candidato_num, pilar, titulo, "borrador", 1, producto_id, actor, t, t))
        con.execute("INSERT INTO contenido_versiones (contenido_id, version, cuerpo, hash, autor, creado_en) "
                    "VALUES (?,?,?,?,?,?)", (cid, 1, cuerpo, h, actor, t))
        registrar(con, actor, "contenido_creado", "contenido", cid, version=1, hash=h[:12])
    return 1


def editar(con, actor, cid, cuerpo, titulo=None):
    """Devuelve la versión nueva, o None si el cuerpo no cambió."""
    permisos.exigir(con, actor, "contenido.editar")
    c = obtener(con, cid)
    if c["estado"] in ("publicado", "archivado"):
        raise EstadoInvalido(f"{cid} está {c['estado']}; un contenido publicado no se edita. Crea uno nuevo.")
    h = hash_cuerpo(cuerpo)
    if h == version_actual(con, cid)["hash"] and (titulo is None or titulo == c["titulo"]):
        return None
    nueva, t = c["version_actual"] + 1, ahora()
    with transaccion(con):
        con.execute("INSERT INTO contenido_versiones (contenido_id, version, cuerpo, hash, autor, creado_en) "
                    "VALUES (?,?,?,?,?,?)", (cid, nueva, cuerpo, h, actor, t))
        invalidadas = con.execute("UPDATE aprobaciones SET vigente = 0 WHERE contenido_id = ? AND vigente = 1",
                                  (cid,)).rowcount
        con.execute("UPDATE contenidos SET version_actual = ?, estado = 'borrador', titulo = ?, actualizado_en = ? "
                    "WHERE id = ?", (nueva, titulo or c["titulo"], t, cid))
        registrar(con, actor, "contenido_editado", "contenido", cid, version=nueva, hash=h[:12],
                  aprobaciones_invalidadas=invalidadas, estado_anterior=c["estado"])
    return nueva


def solicitar_revision(con, actor, cid):
    permisos.exigir(con, actor, "contenido.editar")
    c = obtener(con, cid)
    if c["estado"] != "borrador":
        raise EstadoInvalido(f"{cid} está {c['estado']}; solo un borrador pasa a revisión.")
    with transaccion(con):
        con.execute("UPDATE contenidos SET estado = 'en_revision', actualizado_en = ? WHERE id = ?", (ahora(), cid))
        registrar(con, actor, "revision_solicitada", "contenido", cid, version=c["version_actual"])


def _decidir(con, actor, cid, decision, comentario):
    u = permisos.exigir(con, actor, "contenido.aprobar")
    c = obtener(con, cid)
    if c["estado"] != "en_revision":
        raise EstadoInvalido(f"{cid} está {c['estado']}; solo se decide sobre contenido en revisión.")
    v = version_actual(con, cid)
    auto = v["autor"] == actor
    if auto and u["rol"] != "propietario":
        registrar(con, actor, "autoaprobacion_denegada", "contenido", cid, version=v["version"])
        raise PermisoDenegado("Un revisor no puede decidir sobre una versión que escribió.")
    nuevo_estado = "aprobado" if decision == "aprobado" else "borrador"
    with transaccion(con):
        con.execute("INSERT INTO aprobaciones (contenido_id, version, hash, decision, revisor, comentario, creado_en) "
                    "VALUES (?,?,?,?,?,?,?)", (cid, v["version"], v["hash"], decision, actor, comentario, ahora()))
        con.execute("UPDATE contenidos SET estado = ?, actualizado_en = ? WHERE id = ?", (nuevo_estado, ahora(), cid))
        registrar(con, actor, f"contenido_{decision}", "contenido", cid, version=v["version"],
                  hash=v["hash"][:12], autoaprobacion=auto, comentario=comentario)


def aprobar(con, actor, cid, comentario=None):
    _decidir(con, actor, cid, "aprobado", comentario)


def rechazar(con, actor, cid, comentario):
    if not comentario:
        raise EstadoInvalido("Un rechazo necesita comentario: el autor debe saber qué cambiar.")
    _decidir(con, actor, cid, "rechazado", comentario)


def publicar(con, actor, cid, url, fecha_pub=None, divulgacion=None, permitir_sin_aprobacion=False):
    """Registra la publicación hecha en TikTok. El agente no publica; esto solo deja constancia."""
    u = permisos.exigir(con, actor, "contenido.publicar")
    c = obtener(con, cid)
    existente = con.execute("SELECT id, contenido_id FROM publicaciones WHERE url = ?", (url,)).fetchone()
    if existente:
        if existente["contenido_id"] != cid:
            raise EstadoInvalido(f"La URL ya está registrada para {existente['contenido_id']}.")
        return existente["id"]
    if c["estado"] in ("publicado", "archivado"):
        raise EstadoInvalido(f"{cid} ya está {c['estado']}.")
    vigente = aprobacion_vigente(con, cid)
    sin_aprob = 0
    if not vigente:
        if not (permitir_sin_aprobacion and u["rol"] == "propietario"):
            raise EstadoInvalido(f"{cid} no tiene aprobación vigente para su versión actual. Apruébalo antes de publicar.")
        sin_aprob = 1
    if c["producto_id"] and not (divulgacion or "").strip():
        raise EstadoInvalido("Este contenido muestra un producto: registra la divulgación comercial usada.")
    t = ahora()
    with transaccion(con):
        cur = con.execute("INSERT INTO publicaciones (contenido_id, version, url, fecha_pub, divulgacion_comercial, "
                          "sin_aprobacion, creado_en) VALUES (?,?,?,?,?,?,?)",
                          (cid, c["version_actual"], url, fecha_pub, divulgacion, sin_aprob, t))
        con.execute("UPDATE contenidos SET estado = 'publicado', actualizado_en = ? WHERE id = ?", (t, cid))
        registrar(con, actor, "contenido_publicado", "contenido", cid, url=url, version=c["version_actual"],
                  sin_aprobacion=bool(sin_aprob))
    return cur.lastrowid


def archivar(con, actor, cid, motivo):
    permisos.exigir(con, actor, "contenido.editar")
    obtener(con, cid)
    with transaccion(con):
        con.execute("UPDATE contenidos SET estado = 'archivado', actualizado_en = ? WHERE id = ?", (ahora(), cid))
        registrar(con, actor, "contenido_archivado", "contenido", cid, motivo=motivo)


def listar(con, estado=None):
    q = "SELECT c.*, (SELECT COUNT(*) FROM publicaciones p WHERE p.contenido_id = c.id) AS publicaciones FROM contenidos c"
    args = []
    if estado:
        q += " WHERE estado = ?"; args.append(estado)
    return [dict(r) for r in con.execute(q + " ORDER BY id", args)]
