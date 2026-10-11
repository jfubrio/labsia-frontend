"""Candidatos de nicho, sembrados desde las fichas de docs/tiktok-shop-mx/investigacion/."""
import re
from pathlib import Path

from . import permisos
from .auditoria import registrar
from .db import transaccion


def docs_por_defecto() -> Path:
    return Path(__file__).resolve().parents[3] / "docs" / "tiktok-shop-mx"


def sembrar(con, actor, docs_dir=None) -> int:
    permisos.exigir(con, actor, "importar")
    docs = Path(docs_dir) if docs_dir else docs_por_defecto()
    n = 0
    with transaccion(con):
        for f in sorted((docs / "investigacion").glob("[0-9][0-9]_*.md")):
            m = re.search(r"^#\s*Ficha\s+(\d+)\s*[·\-:]\s*(.+)$", f.read_text(encoding="utf-8"), re.M)
            if not m:
                continue
            num, nombre = int(m.group(1)), m.group(2).strip()
            ficha = f"investigacion/{f.name}"
            fila = con.execute("SELECT nombre, ficha FROM candidatos WHERE num = ?", (num,)).fetchone()
            if fila and (fila["nombre"], fila["ficha"]) == (nombre, ficha):
                continue
            con.execute("INSERT INTO candidatos (num, nombre, ficha) VALUES (?,?,?) "
                        "ON CONFLICT(num) DO UPDATE SET nombre = excluded.nombre, ficha = excluded.ficha",
                        (num, nombre, ficha))
            n += 1
        if n:
            registrar(con, actor, "candidatos_sembrados", "candidato", None, cambios=n, origen=str(docs))
    return n


def listar(con):
    return [dict(r) for r in con.execute("SELECT * FROM candidatos ORDER BY num")]
