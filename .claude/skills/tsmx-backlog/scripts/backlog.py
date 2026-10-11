#!/usr/bin/env python3
"""Cambia el estado de un ticket en 07_BACKLOG_DESARROLLADOR.md y registra el cambio.

Uso:
  backlog.py T02 preliminar --motivo "Ronda 1 sin abrir páginas" [--nota "texto para la columna Notas"] [--fecha AAAA-MM-DD]
  backlog.py --listar
Estados válidos: pendiente, en curso, preliminar, hecho, bloqueado.
"""

import argparse
import datetime
import re
import sys
from pathlib import Path

ESTADOS = ["pendiente", "en curso", "preliminar", "hecho", "bloqueado"]


def root():
    p = Path.cwd().resolve()
    for c in [p, *p.parents]:
        d = c / "docs" / "tiktok-shop-mx"
        if d.is_dir():
            return d
        if c.name == "tiktok-shop-mx":
            return c
    sys.exit("No se encontró docs/tiktok-shop-mx")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ticket", nargs="?")
    ap.add_argument("estado", nargs="?")
    ap.add_argument("--motivo")
    ap.add_argument("--nota")
    ap.add_argument("--fecha", default=datetime.date.today().isoformat())
    ap.add_argument("--listar", action="store_true")
    a = ap.parse_args()
    f = root() / "07_BACKLOG_DESARROLLADOR.md"
    txt = f.read_text(encoding="utf-8")
    filas = re.findall(r"^\|\s*(T\d{2}[A-Z]?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|$", txt, re.M)
    if a.listar or not a.ticket:
        for t, trabajo, _, est, _ in filas:
            print(f"{t}  {est:<11} {trabajo}")
        return
    t = a.ticket.upper()
    if a.estado not in ESTADOS:
        sys.exit(f"Estado inválido. Usa uno de: {', '.join(ESTADOS)}")
    if not a.motivo:
        sys.exit("--motivo es obligatorio: el registro de cambios lo exige.")
    patron = re.compile(rf"^(\|\s*{t}\s*\|[^|]+\|[^|]+\|\s*)([^|]+?)(\s*\|\s*)([^|]*?)(\s*\|)$", re.M)
    m = patron.search(txt)
    if not m:
        sys.exit(f"No existe la fila del ticket {t}")
    anterior = m.group(2).strip()
    nota_nueva = a.nota if a.nota is not None else m.group(4).strip()
    txt = txt[: m.start()] + f"{m.group(1)}{a.estado}{m.group(3)}{nota_nueva}{m.group(5)}" + txt[m.end() :]
    fila_log = f"| {a.fecha} | {t} | {anterior} | {a.estado} | {a.motivo} |\n"
    marca = "## Registro de cambios de estado"
    if marca in txt:
        bloque_ini = txt.index(marca)
        resto = txt[bloque_ini:]
        lineas = resto.split("\n")
        i = 0
        while i < len(lineas) and not lineas[i].startswith("| Fecha"):
            i += 1
        j = i + 2
        while j < len(lineas) and lineas[j].startswith("|"):
            j += 1
        lineas.insert(j, fila_log.rstrip("\n"))
        txt = txt[:bloque_ini] + "\n".join(lineas)
    else:
        txt += f"\n{marca}\n\n| Fecha | Ticket | De | A | Motivo |\n|---|---|---|---|---|\n{fila_log}"
    f.write_text(txt, encoding="utf-8")
    print(f"{t}: {anterior} -> {a.estado} ({a.fecha}). Registrado.")


if __name__ == "__main__":
    main()
