"""Respaldos verificables y restauración comprobada (T08).

Un respaldo es una copia consistente de la base (API de respaldo de SQLite) más un manifiesto con
SHA-256 y el conteo de filas de cada tabla. "Restauración comprobada" significa que el archivo
restaurado pasa integrity_check y reproduce exactamente esos conteos.
"""
import datetime as _dt
import hashlib
import json
import shutil
import sqlite3
import tempfile
from pathlib import Path

from . import permisos
from .auditoria import registrar
from .db import ahora
from .errores import ErrorTSMX

TABLAS = ("usuarios", "candidatos", "importaciones", "productos", "contenidos", "contenido_versiones",
          "aprobaciones", "publicaciones", "metricas_video", "comisiones", "costos", "auditoria")


def _sha(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for bloque in iter(lambda: fh.read(1 << 16), b""):
            h.update(bloque)
    return h.hexdigest()


def _conteos(con) -> dict:
    return {t: con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in TABLAS}


def crear(con, actor, destino_dir) -> Path:
    permisos.exigir(con, actor, "respaldo")
    destino_dir = Path(destino_dir)
    destino_dir.mkdir(parents=True, exist_ok=True)
    marca = _dt.datetime.now(_dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archivo = destino_dir / f"tsmx-{marca}.db"
    registrar(con, actor, "respaldo_creado", "respaldo", archivo.name)  # queda dentro del propio respaldo
    dst = sqlite3.connect(str(archivo))
    try:
        con.backup(dst)
    finally:
        dst.close()
    copia = sqlite3.connect(str(archivo))
    try:
        conteos = _conteos(copia)
    finally:
        copia.close()
    manifiesto = {"archivo": archivo.name, "sha256": _sha(archivo), "creado_en": ahora(), "por": actor,
                  "user_version": con.execute("PRAGMA user_version").fetchone()[0], "conteos": conteos}
    archivo.with_suffix(".json").write_text(json.dumps(manifiesto, ensure_ascii=False, indent=2), encoding="utf-8")
    return archivo


def verificar(archivo) -> dict:
    """Comprueba hash, integridad y conteos sobre una copia temporal. No requiere permisos: solo lee."""
    archivo = Path(archivo)
    man_path = archivo.with_suffix(".json")
    if not archivo.exists() or not man_path.exists():
        raise ErrorTSMX(f"Faltan {archivo.name} o su manifiesto {man_path.name}.")
    man = json.loads(man_path.read_text(encoding="utf-8"))
    problemas = []
    if _sha(archivo) != man["sha256"]:
        problemas.append("el SHA-256 no coincide con el manifiesto: el archivo cambió o está dañado")
    with tempfile.TemporaryDirectory() as tmp:
        copia = Path(tmp) / "verificacion.db"
        shutil.copy2(archivo, copia)
        try:
            c = sqlite3.connect(str(copia))
            integridad = c.execute("PRAGMA integrity_check").fetchone()[0]
            conteos = _conteos(c)
            c.close()
        except sqlite3.DatabaseError as e:
            integridad, conteos = f"no se pudo abrir: {e}", {}
    if integridad != "ok":
        problemas.append(f"integrity_check: {integridad}")
    for t, n in man["conteos"].items():
        if conteos.get(t) != n:
            problemas.append(f"tabla {t}: manifiesto {n}, archivo {conteos.get(t)}")
    return {"archivo": archivo.name, "valido": not problemas, "problemas": problemas, "conteos": man["conteos"]}


def restaurar(con_actual, actor, archivo, destino, forzar=False) -> dict:
    """Restaura un respaldo verificado en 'destino'. Si destino existe, lo respalda antes de reemplazarlo."""
    permisos.exigir(con_actual, actor, "respaldo.restaurar")
    rep = verificar(archivo)
    if not rep["valido"]:
        raise ErrorTSMX("El respaldo no pasó la verificación: " + "; ".join(rep["problemas"]))
    destino = Path(destino)
    previo = None
    if destino.exists():
        if not forzar:
            raise ErrorTSMX(f"{destino} ya existe. Usa --forzar; se respaldará antes de reemplazarlo.")
        previo = destino.with_name(destino.stem + "-antes-de-restaurar-" +
                                   _dt.datetime.now(_dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + destino.suffix)
        shutil.copy2(destino, previo)
    tmp = destino.with_suffix(".restaurando")
    shutil.copy2(archivo, tmp)
    c = sqlite3.connect(str(tmp))
    ok = c.execute("PRAGMA integrity_check").fetchone()[0] == "ok" and _conteos(c) == rep["conteos"]
    c.close()
    if not ok:
        tmp.unlink(missing_ok=True)
        raise ErrorTSMX("La copia restaurada no reproduce el manifiesto; no se reemplazó nada.")
    tmp.replace(destino)
    registrar(con_actual, actor, "respaldo_restaurado", "respaldo", Path(archivo).name, destino=str(destino),
              copia_previa=str(previo) if previo else None)
    return {"restaurado": str(destino), "copia_previa": str(previo) if previo else None, "conteos": rep["conteos"]}
