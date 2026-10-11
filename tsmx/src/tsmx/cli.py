"""Interfaz de línea de comandos: python -m tsmx <comando> (o 'tsmx' si se instaló el paquete).

El usuario que actúa se toma de --usuario o de la variable TSMX_USUARIO.
La base se toma de --db o de TSMX_DB (por defecto tsmx/data/tsmx.db, fuera de git).
"""
import argparse
import json
import os
import sys
from pathlib import Path

from . import auditoria, candidatos, contenido, economia, importar, metricas, permisos, reporte, respaldo
from .adaptadores.tiktok_shop import ClienteTikTokShop
from .db import conectar, migrar, ruta_por_defecto
from .errores import ErrorTSMX


def _tabla(filas, columnas):
    if not filas:
        print("(sin datos)")
        return
    anchos = [max(len(c), *(len(str("no disponible" if f.get(c) is None else f.get(c))) for f in filas)) for c in columnas]
    print("  ".join(c.ljust(a) for c, a in zip(columnas, anchos)))
    for f in filas:
        print("  ".join(str("no disponible" if f.get(c) is None else f.get(c)).ljust(a) for c, a in zip(columnas, anchos)))


def construir_parser():
    p = argparse.ArgumentParser(prog="tsmx", description="MVP interno TikTok Shop MX")
    p.add_argument("--db", help="ruta de la base SQLite")
    p.add_argument("--usuario", default=os.environ.get("TSMX_USUARIO"), help="usuario que actúa (o TSMX_USUARIO)")
    sp = p.add_subparsers(dest="cmd", required=True)

    s = sp.add_parser("init", help="crea la base, el propietario y siembra candidatos")
    s.add_argument("--id", required=True); s.add_argument("--nombre", required=True)

    u = sp.add_parser("usuario").add_subparsers(dest="sub", required=True)
    a = u.add_parser("agregar"); a.add_argument("id"); a.add_argument("nombre"); a.add_argument("rol", choices=sorted(permisos.ROLES))
    u.add_parser("listar")
    d = u.add_parser("desactivar"); d.add_argument("id")

    c = sp.add_parser("candidatos").add_subparsers(dest="sub", required=True)
    c.add_parser("sembrar"); c.add_parser("listar")

    i = sp.add_parser("importar", help="importa plan, videos, comisiones, costos o productos")
    i.add_argument("tipo", choices=sorted(importar.IMPORTADORES)); i.add_argument("archivo")
    i.add_argument("--permitir-sin-aprobacion", action="store_true", help="solo propietario; queda en auditoría")

    k = sp.add_parser("contenido").add_subparsers(dest="sub", required=True)
    kl = k.add_parser("listar"); kl.add_argument("--estado")
    kv = k.add_parser("ver"); kv.add_argument("id")
    ke = k.add_parser("editar"); ke.add_argument("id"); ke.add_argument("--archivo", required=True); ke.add_argument("--titulo")
    kr = k.add_parser("revision"); kr.add_argument("id")
    ka = k.add_parser("aprobar"); ka.add_argument("id"); ka.add_argument("--comentario")
    kx = k.add_parser("rechazar"); kx.add_argument("id"); kx.add_argument("--comentario", required=True)
    kp = k.add_parser("publicar"); kp.add_argument("id"); kp.add_argument("--url", required=True)
    kp.add_argument("--fecha"); kp.add_argument("--divulgacion"); kp.add_argument("--permitir-sin-aprobacion", action="store_true")
    kz = k.add_parser("archivar"); kz.add_argument("id"); kz.add_argument("--motivo", required=True)

    m = sp.add_parser("metricas"); m.add_argument("--por", choices=["candidato", "pilar"], default="candidato")
    m.add_argument("--min", type=int, default=5)

    sp.add_parser("economia")

    r = sp.add_parser("respaldo").add_subparsers(dest="sub", required=True)
    rc = r.add_parser("crear"); rc.add_argument("--dir", default=str(Path(__file__).resolve().parents[2] / "respaldos"))
    rv = r.add_parser("verificar"); rv.add_argument("archivo")
    rr = r.add_parser("restaurar"); rr.add_argument("archivo"); rr.add_argument("--destino"); rr.add_argument("--forzar", action="store_true")

    rp = sp.add_parser("reporte"); rp.add_argument("--salida", default="reporte-tsmx.html")
    au = sp.add_parser("auditoria"); au.add_argument("--limite", type=int, default=30); au.add_argument("--entidad"); au.add_argument("--id")
    sp.add_parser("tiktok", help="estado del adaptador de TikTok Shop (sin conexión)")
    return p


def ejecutar(args, con):
    actor = args.usuario
    cmd = args.cmd
    if cmd == "init":
        if con.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0] == 0:
            permisos.crear_usuario(con, None, args.id, args.nombre, "propietario")
            print(f"Propietario '{args.id}' creado.")
        else:
            print("La base ya tenía usuarios; no se creó otro propietario.")
        print(f"Candidatos sembrados o actualizados: {candidatos.sembrar(con, args.id)}")
        print(f"Base lista en {args.db or ruta_por_defecto()}. Usa --usuario {args.id} o TSMX_USUARIO={args.id}.")
        return 0
    if not actor:
        raise ErrorTSMX("Indica quién actúa con --usuario o la variable TSMX_USUARIO.")
    permisos.usuario(con, actor)

    if cmd == "usuario":
        if args.sub == "agregar":
            permisos.crear_usuario(con, actor, args.id, args.nombre, args.rol); print("Usuario creado.")
        elif args.sub == "desactivar":
            permisos.desactivar_usuario(con, actor, args.id); print("Usuario desactivado.")
        else:
            _tabla([dict(r) for r in con.execute("SELECT id, nombre, rol, activo FROM usuarios")], ["id", "nombre", "rol", "activo"])
    elif cmd == "candidatos":
        if args.sub == "sembrar":
            print(f"Cambios: {candidatos.sembrar(con, actor)}")
        else:
            _tabla(candidatos.listar(con), ["num", "nombre", "ficha"])
    elif cmd == "importar":
        fn = importar.IMPORTADORES[args.tipo]
        res = fn(con, actor, args.archivo, args.permitir_sin_aprobacion) if args.tipo == "videos" else fn(con, actor, args.archivo)
        print(res.resumen())
        for e in res.errores:
            print("  " + e)
        return 1 if res.rechazadas else 0
    elif cmd == "contenido":
        permisos.exigir(con, actor, "leer")
        if args.sub == "listar":
            _tabla(contenido.listar(con, args.estado), ["id", "candidato_num", "pilar", "estado", "version_actual", "publicaciones", "titulo"])
        elif args.sub == "ver":
            c, v = contenido.obtener(con, args.id), contenido.version_actual(con, args.id)
            ap = contenido.aprobacion_vigente(con, args.id)
            print(f"{c['id']} · {c['titulo']} · {c['estado']} · versión {v['version']} · hash {v['hash'][:12]}")
            print(f"Aprobación vigente: {'sí, por ' + ap['revisor'] if ap else 'no'}\n")
            print(v["cuerpo"])
        elif args.sub == "editar":
            n = contenido.editar(con, actor, args.id, Path(args.archivo).read_text(encoding="utf-8"), args.titulo)
            print("Sin cambios." if n is None else f"Versión {n} creada. Las aprobaciones previas quedaron invalidadas.")
        elif args.sub == "revision":
            contenido.solicitar_revision(con, actor, args.id); print("En revisión.")
        elif args.sub == "aprobar":
            contenido.aprobar(con, actor, args.id, args.comentario); print("Aprobado.")
        elif args.sub == "rechazar":
            contenido.rechazar(con, actor, args.id, args.comentario); print("Rechazado; vuelve a borrador.")
        elif args.sub == "publicar":
            contenido.publicar(con, actor, args.id, args.url, args.fecha, args.divulgacion, args.permitir_sin_aprobacion)
            print("Publicación registrada.")
        elif args.sub == "archivar":
            contenido.archivar(con, actor, args.id, args.motivo); print("Archivado.")
    elif cmd == "metricas":
        permisos.exigir(con, actor, "leer")
        _tabla(metricas.indicadores(con, args.por, args.min),
               ["grupo", "videos", "con_datos", "vistas", "seguidores_por_mil", "intencion_por_mil", "orden"])
        print("\nOrden por intención de compra por cada 1,000 vistas. Las vistas no ordenan.")
    elif cmd == "economia":
        permisos.exigir(con, actor, "leer")
        r = economia.resumen(con)
        filas = r["filas"] + ([r["total"]] if r["total"] else [])
        _tabla(filas, ["candidato", "estimada_n", "estimada_neto", "aprobada_n", "aprobada_neto", "liquidada_n",
                       "liquidada_neto", "cancelada_n", "costos", "resultado_liquidado"])
        print(f"\nResultado = comisiones liquidadas netas − costos. Parámetros fiscales: {r['parametros']['fuente']}.")
    elif cmd == "respaldo":
        if args.sub == "crear":
            a = respaldo.crear(con, actor, args.dir)
            print(f"Respaldo: {a}\nManifiesto: {a.with_suffix('.json')}")
            print(json.dumps(respaldo.verificar(a), ensure_ascii=False, indent=2))
        elif args.sub == "verificar":
            rep = respaldo.verificar(args.archivo)
            print(json.dumps(rep, ensure_ascii=False, indent=2))
            return 0 if rep["valido"] else 1
        else:
            destino = args.destino or str(args.db or ruta_por_defecto())
            print(json.dumps(respaldo.restaurar(con, actor, args.archivo, destino, args.forzar), ensure_ascii=False, indent=2))
    elif cmd == "reporte":
        permisos.exigir(con, actor, "leer")
        Path(args.salida).write_text(reporte.generar(con), encoding="utf-8")
        print(f"Reporte escrito en {args.salida}")
    elif cmd == "auditoria":
        permisos.exigir(con, actor, "leer")
        _tabla(auditoria.listar(con, args.limite, args.entidad, args.id), ["id", "ts", "usuario", "accion", "entidad", "entidad_id", "detalle"])
    elif cmd == "tiktok":
        print(json.dumps(ClienteTikTokShop().estado(), ensure_ascii=False, indent=2))
        print("Adaptador sin conectar: ver docs/tiktok-shop-mx/15_ARQUITECTURA_MVP.md §7.")
    return 0


def main(argv=None):
    args = construir_parser().parse_args(argv)
    con = conectar(args.db)
    try:
        migrar(con)
        return ejecutar(args, con)
    except ErrorTSMX as e:
        print(f"Error: {e}", file=sys.stderr)
        return 2
    finally:
        con.close()
