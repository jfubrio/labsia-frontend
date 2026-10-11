"""Conexión a SQLite, migraciones y utilidades de tiempo."""
import datetime as _dt
import hashlib
import os
import sqlite3
from contextlib import contextmanager
from importlib import resources
from pathlib import Path

VERSION_ESQUEMA = 1


def ahora() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def sha256_archivo(path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for bloque in iter(lambda: fh.read(1 << 16), b""):
            h.update(bloque)
    return h.hexdigest()


def ruta_por_defecto() -> Path:
    env = os.environ.get("TSMX_DB")
    if env:
        return Path(env)
    return Path(__file__).resolve().parents[2] / "data" / "tsmx.db"


def conectar(ruta=None) -> sqlite3.Connection:
    ruta = Path(ruta) if ruta else ruta_por_defecto()
    if str(ruta) != ":memory:":
        ruta.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(ruta), isolation_level=None)  # transacciones explícitas
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def migrar(con: sqlite3.Connection) -> int:
    """Aplica el esquema. Idempotente."""
    sql = resources.files("tsmx").joinpath("schema.sql").read_text(encoding="utf-8")
    con.executescript(sql)
    actual = con.execute("PRAGMA user_version").fetchone()[0]
    if actual < VERSION_ESQUEMA:
        con.execute(f"PRAGMA user_version = {VERSION_ESQUEMA}")
    return VERSION_ESQUEMA


@contextmanager
def transaccion(con: sqlite3.Connection):
    """Transacción explícita. Si ya hay una abierta, se une a ella."""
    if con.in_transaction:
        yield con
        return
    con.execute("BEGIN")
    try:
        yield con
        con.execute("COMMIT")
    except BaseException:
        if con.in_transaction:
            con.execute("ROLLBACK")
        raise
