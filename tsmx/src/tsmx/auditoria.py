"""Registro de acciones de solo inserción (T06, T08)."""

import json

from .db import ahora


def registrar(con, usuario: str, accion: str, entidad: str, entidad_id=None, **detalle):
    con.execute(
        "INSERT INTO auditoria (ts, usuario, accion, entidad, entidad_id, detalle) VALUES (?,?,?,?,?,?)",
        (
            ahora(),
            usuario,
            accion,
            entidad,
            None if entidad_id is None else str(entidad_id),
            json.dumps(detalle, ensure_ascii=False, sort_keys=True) if detalle else None,
        ),
    )


def listar(con, limite=50, entidad=None, entidad_id=None):
    q, args = "SELECT * FROM auditoria", []
    filtros = []
    if entidad:
        filtros.append("entidad = ?")
        args.append(entidad)
    if entidad_id:
        filtros.append("entidad_id = ?")
        args.append(str(entidad_id))
    if filtros:
        q += " WHERE " + " AND ".join(filtros)
    q += " ORDER BY id DESC LIMIT ?"
    args.append(limite)
    return [dict(r) for r in con.execute(q, args)]
