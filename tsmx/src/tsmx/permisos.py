"""Roles y permisos (T08). La comprobación ocurre en la capa de servicio, no en la interfaz."""

from .auditoria import registrar
from .db import ahora
from .errores import NoEncontrado, PermisoDenegado

ROLES = {
    "propietario": {
        "leer",
        "contenido.editar",
        "contenido.aprobar",
        "contenido.publicar",
        "importar",
        "economia.editar",
        "respaldo",
        "respaldo.restaurar",
        "usuarios.gestionar",
    },
    "editor": {"leer", "contenido.editar", "contenido.publicar", "importar"},
    "revisor": {"leer", "contenido.aprobar"},
    "lector": {"leer"},
}


def usuario(con, uid: str) -> dict:
    fila = con.execute("SELECT * FROM usuarios WHERE id = ?", (uid,)).fetchone()
    if not fila:
        raise NoEncontrado(f"El usuario '{uid}' no existe. Créalo con: tsmx usuario agregar")
    if not fila["activo"]:
        raise PermisoDenegado(f"El usuario '{uid}' está desactivado.")
    return dict(fila)


def exigir(con, uid: str, permiso: str) -> dict:
    u = usuario(con, uid)
    if permiso not in ROLES[u["rol"]]:
        registrar(con, uid, "permiso_denegado", "permiso", permiso, rol=u["rol"])
        raise PermisoDenegado(f"El rol '{u['rol']}' de '{uid}' no permite '{permiso}'.")
    return u


def crear_usuario(con, actor: str | None, uid: str, nombre: str, rol: str):
    if rol not in ROLES:
        raise PermisoDenegado(f"Rol desconocido: {rol}. Usa uno de {sorted(ROLES)}.")
    hay = con.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0]
    if hay == 0:
        if rol != "propietario":
            raise PermisoDenegado("El primer usuario debe ser el propietario.")
        actor = uid
    else:
        exigir(con, actor, "usuarios.gestionar")
    con.execute("INSERT INTO usuarios (id, nombre, rol, creado_en) VALUES (?,?,?,?)", (uid, nombre, rol, ahora()))
    registrar(con, actor, "usuario_creado", "usuario", uid, rol=rol)


def desactivar_usuario(con, actor: str, uid: str):
    exigir(con, actor, "usuarios.gestionar")
    if uid == actor:
        raise PermisoDenegado("No puedes desactivarte a ti mismo.")
    con.execute("UPDATE usuarios SET activo = 0 WHERE id = ?", (uid,))
    registrar(con, actor, "usuario_desactivado", "usuario", uid)
