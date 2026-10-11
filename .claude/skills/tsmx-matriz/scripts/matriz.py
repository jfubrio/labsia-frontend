#!/usr/bin/env python3
"""Recalcula la tabla comparativa de 10_MATRIZ_NICHOS.md a partir de las fichas.

Uso:
  matriz.py            imprime la tabla Markdown y advertencias
  matriz.py --write    reemplaza el bloque entre <!-- matriz:inicio --> y <!-- matriz:fin -->
  matriz.py --json     imprime JSON
  matriz.py --root DIR carpeta docs/tiktok-shop-mx (por defecto se busca desde el cwd)
"""

import argparse
import json
import re
import sys
from pathlib import Path

PESOS = [
    ("Demanda observable", 0.25),
    ("Necesidades sin contenido útil suficiente", 0.20),
    ("Economía del afiliado", 0.25),
    ("Facilidad de demostración original", 0.15),
    ("Calidad operativa del vendedor", 0.15),
]
SIN = {"sin evidencia", "s/e", "no disponible", "sin datos"}
INICIO, FIN = "<!-- matriz:inicio -->", "<!-- matriz:fin -->"


def encontrar_root(explicito):
    if explicito:
        return Path(explicito)
    p = Path.cwd().resolve()
    for cand in [p, *p.parents]:
        d = cand / "docs" / "tiktok-shop-mx"
        if d.is_dir():
            return d
        if cand.name == "tiktok-shop-mx" and (cand / "investigacion").is_dir():
            return cand
    sys.exit("No se encontró docs/tiktok-shop-mx; usa --root")


def norm(s):
    return re.sub(r"\s+", " ", s.replace("*", "")).strip().lower()


def leer_ficha(path):
    texto = path.read_text(encoding="utf-8")
    m = re.search(r"^#\s*Ficha\s+(\d+)\s*[·\-:]\s*(.+)$", texto, re.M)
    numero = int(m.group(1)) if m else None
    nombre = m.group(2).strip() if m else path.stem
    estado_m = re.search(r"\*\*Estado:\*\*\s*([^·\n]+)", texto)
    estado = estado_m.group(1).strip() if estado_m else "no disponible"
    notas, problemas = {}, []
    filas = re.findall(r"^\|\s*([^|]+?)\s*\|\s*\d+\s*%\s*\|\s*([^|]+?)\s*\|", texto, re.M)
    for dim_raw, nota_raw in filas:
        dim = norm(dim_raw)
        for nombre_dim, _ in PESOS:
            if norm(nombre_dim) == dim:
                v = norm(nota_raw)
                if v in SIN:
                    notas[nombre_dim] = None
                else:
                    try:
                        n = int(float(v.replace(",", ".")))
                    except ValueError:
                        problemas.append(f"nota ilegible '{nota_raw.strip()}' en {nombre_dim}")
                        continue
                    if not 0 <= n <= 5:
                        problemas.append(f"nota fuera de rango {n} en {nombre_dim}")
                        continue
                    notas[nombre_dim] = n
    faltan = [d for d, _ in PESOS if d not in notas]
    if faltan:
        problemas.append("sin fila en la rúbrica: " + ", ".join(faltan))
    suma = sum(w * notas[d] for d, w in PESOS if notas.get(d) is not None)
    cubierto = sum(w for d, w in PESOS if notas.get(d) is not None)
    sin_ev = [d for d, _ in PESOS if d in notas and notas[d] is None]
    return {
        "archivo": path.name,
        "numero": numero,
        "nombre": nombre,
        "estado": estado,
        "notas": {d: notas.get(d) for d, _ in PESOS},
        "parcial": round(suma / 5, 2),
        "peso_cubierto": round(cubierto, 2),
        "maximo_alcanzable": round(cubierto, 2),
        "normalizada_5": round(suma / cubierto, 2) if cubierto else None,
        "completa": not sin_ev and not faltan,
        "faltan": sin_ev + faltan,
        "problemas": problemas,
    }


def tabla(fichas):
    cab = (
        "| # | Candidato | "
        + " | ".join(f"{d} ({int(w * 100)} %)" for d, w in PESOS)
        + " | Puntuación parcial | Peso cubierto | Estado | Ficha |"
    )
    sep = "|" + "---|" * (len(PESOS) + 6)
    out = [cab, sep]
    for f in fichas:
        celdas = ["s/e" if f["notas"][d] is None else str(f["notas"][d]) for d, _ in PESOS]
        est = "COMPLETA" if f["completa"] else "INCOMPLETA"
        out.append(
            f"| {f['numero'] or ''} | {f['nombre']} | "
            + " | ".join(celdas)
            + f" | {f['parcial']:.2f} | {int(round(f['peso_cubierto'] * 100))} % | {est} | `investigacion/{f['archivo']}` |"
        )
    nota = (
        '\nNotas de 0 a 5. "s/e" = sin evidencia. Puntuación parcial = Σ(peso × nota)/5 sobre las dimensiones evaluadas; '
        "el máximo alcanzable es igual al peso cubierto (1.00 solo con las cinco dimensiones). "
        "Tabla generada por `.claude/skills/tsmx-matriz/scripts/matriz.py`; no editar a mano."
    )
    return "\n".join(out) + "\n" + nota + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--root")
    a = ap.parse_args()
    root = encontrar_root(a.root)
    fichas = sorted(
        (leer_ficha(p) for p in (root / "investigacion").glob("[0-9][0-9]_*.md")), key=lambda f: (f["numero"] or 99, f["archivo"])
    )
    if not fichas:
        sys.exit("No hay fichas en investigacion/")
    problemas = [(f["archivo"], p) for f in fichas for p in f["problemas"]]
    if a.json:
        print(json.dumps(fichas, ensure_ascii=False, indent=2))
        return
    t = tabla(fichas)
    if problemas:
        print("ADVERTENCIAS:", file=sys.stderr)
        for arch, p in problemas:
            print(f"  {arch}: {p}", file=sys.stderr)
    if a.write:
        if problemas:
            sys.exit("No se escribe la matriz mientras haya advertencias.")
        dest = root / "10_MATRIZ_NICHOS.md"
        txt = dest.read_text(encoding="utf-8")
        if INICIO not in txt or FIN not in txt:
            sys.exit(f"Faltan los marcadores {INICIO} / {FIN} en {dest.name}")
        pre, resto = txt.split(INICIO, 1)
        _, post = resto.split(FIN, 1)
        dest.write_text(pre + INICIO + "\n" + t + FIN + post, encoding="utf-8")
        print(f"Matriz escrita en {dest} ({len(fichas)} fichas).")
    else:
        print(t)


if __name__ == "__main__":
    main()
