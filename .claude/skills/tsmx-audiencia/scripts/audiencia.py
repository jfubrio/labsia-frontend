#!/usr/bin/env python3
"""Resume docs/tiktok-shop-mx/audiencia/registro_videos.csv por candidato y por pilar.

  audiencia.py                 tabla por candidato
  audiencia.py --por pilar     tabla por pilar
  audiencia.py --min 5         mínimo de videos para ordenar (por defecto 5)

Indicadores: seguidores por 1,000 vistas e intención de compra por 1,000 vistas.
Ordena por intención de compra, no por vistas (regla 1 de 13_ESTRATEGIA_AUDIENCIA.md §7).
"""

import argparse
import csv
import re
import sys
from collections import defaultdict
from pathlib import Path

OBLIG = [
    "video_id",
    "fecha_pub",
    "url",
    "candidato_num",
    "pilar",
    "fecha_lectura",
    "vistas",
    "seguidores_ganados",
    "comentarios_intencion_compra",
]


def root():
    p = Path.cwd().resolve()
    for c in [p, *p.parents]:
        d = c / "docs" / "tiktok-shop-mx"
        if d.is_dir():
            return d
        if c.name == "tiktok-shop-mx":
            return c
    sys.exit("No se encontró docs/tiktok-shop-mx")


def num(v):
    v = (v or "").strip().lower().replace(",", "")
    if v in ("", "no disponible"):
        return None
    m = re.fullmatch(r"([\d.]+)\s*(mil|k|m|mill(?:ones)?)?", v)
    if not m:
        raise ValueError(v)
    n = float(m.group(1))
    return n * {None: 1, "mil": 1e3, "k": 1e3, "m": 1e6, "mill": 1e6, "millones": 1e6}[m.group(2)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--por", choices=["candidato", "pilar"], default="candidato")
    ap.add_argument("--min", type=int, default=5)
    ap.add_argument("--archivo")
    a = ap.parse_args()
    clave = "candidato_num" if a.por == "candidato" else "pilar"
    f = Path(a.archivo) if a.archivo else root() / "audiencia" / "registro_videos.csv"
    filas = list(csv.DictReader(f.open(encoding="utf-8")))
    if not filas:
        print("El registro está vacío: todavía no hay videos publicados.")
        return
    problemas, ultimo = [], {}
    for i, r in enumerate(filas, 2):
        for c in OBLIG:
            if not (r.get(c) or "").strip():
                problemas.append(f"fila {i}: '{c}' vacío (usa 'no disponible' si no se ve)")
        # una lectura por video: se queda la más reciente
        k = r.get("video_id", "").strip()
        if k and (k not in ultimo or r.get("fecha_lectura", "") >= ultimo[k].get("fecha_lectura", "")):
            ultimo[k] = r
    g = defaultdict(lambda: {"videos": 0, "vistas": 0.0, "seg": 0.0, "int": 0.0, "sin_dato": 0})
    for r in ultimo.values():
        try:
            v, s, it = num(r["vistas"]), num(r["seguidores_ganados"]), num(r["comentarios_intencion_compra"])
        except ValueError as e:
            problemas.append(f"video {r['video_id']}: número ilegible '{e}'")
            continue
        x = g[r.get(clave, "").strip() or "sin asignar"]
        x["videos"] += 1
        if v is None or s is None or it is None:
            x["sin_dato"] += 1
            continue
        x["vistas"] += v
        x["seg"] += s
        x["int"] += it
    if problemas:
        print("PROBLEMAS:", file=sys.stderr)
        for p in problemas[:40]:
            print("  " + p, file=sys.stderr)
    res = []
    for k, x in g.items():
        seg_k = round(x["seg"] / x["vistas"] * 1000, 2) if x["vistas"] else None
        int_k = round(x["int"] / x["vistas"] * 1000, 2) if x["vistas"] else None
        res.append((k, x, seg_k, int_k))
    listos = sorted([r for r in res if r[1]["videos"] - r[1]["sin_dato"] >= a.min], key=lambda r: -(r[3] or 0))
    faltan = [r for r in res if r not in listos]
    print(f"| {clave} | Videos | Con datos | Vistas | Seguidores / 1,000 vistas | Intención de compra / 1,000 vistas | Orden |")
    print("|---|---|---|---|---|---|---|")
    for pos, (k, x, sk, ik) in enumerate(listos, 1):
        print(f"| {k} | {x['videos']} | {x['videos'] - x['sin_dato']} | {int(x['vistas'])} | {sk} | {ik} | {pos} |")
    for k, x, sk, ik in faltan:
        print(
            f"| {k} | {x['videos']} | {x['videos'] - x['sin_dato']} | {int(x['vistas'])} | {sk if sk is not None else 'no disponible'} | {ik if ik is not None else 'no disponible'} | menos de {a.min} videos con datos |"
        )
    print("\nSe usa la lectura más reciente de cada video. Orden por intención de compra; las vistas no ordenan.")


if __name__ == "__main__":
    main()
