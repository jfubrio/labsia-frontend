#!/usr/bin/env python3
"""Plantillas y resumen de la ronda 2 de T02.

  ronda2.py plantilla [--out DIR]      genera los CSV de captura a partir de las fichas
  ronda2.py resumen   [--dir DIR]      valida los CSV llenos e imprime una sección 3b por candidato
  ronda2.py resumen --candidato 2      solo un candidato

Los CSV se generan desde las fichas: las consultas salen de la sección 2 y las URLs a
revisitar de la tabla 3.2. Así la ronda 2 repite exactamente la ronda 1.
"""

import argparse
import csv
import re
import sys
from collections import defaultdict
from pathlib import Path

CAPTURA = [
    "candidato_num",
    "candidato",
    "tipo",
    "consulta",
    "pestana",
    "posicion",
    "fecha_obs",
    "url",
    "formato",
    "creador",
    "senal_mx",
    "fecha_pub",
    "vistas",
    "likes",
    "comentarios",
    "guardados",
    "enlace_tiktok_shop",
    "preguntas_compra",
    "notas",
]
REVISITA = [
    "candidato_num",
    "candidato",
    "fila_r1",
    "prioridad",
    "url",
    "fecha_obs",
    "estado_url",
    "fecha_pub",
    "vistas",
    "likes",
    "comentarios",
    "preguntas_compra",
    "notas",
]
TIENDA = [
    "candidato_num",
    "candidato",
    "consulta",
    "posicion",
    "fecha_obs",
    "producto",
    "precio_mxn",
    "vendidos_autodeclarado",
    "calificacion",
    "num_resenas",
    "tienda",
    "envio",
    "url",
    "notas",
]
OBLIG_CAPTURA = ["fecha_obs", "url", "formato", "creador", "fecha_pub", "vistas", "likes", "comentarios", "preguntas_compra"]
OBLIG_REVISITA = ["fecha_obs", "estado_url"]
ESTADOS_URL = {"disponible", "eliminado", "privado", "requiere sesión", "requiere sesion", "no carga"}


def root():
    p = Path.cwd().resolve()
    for c in [p, *p.parents]:
        d = c / "docs" / "tiktok-shop-mx"
        if d.is_dir():
            return d
        if c.name == "tiktok-shop-mx" and (c / "investigacion").is_dir():
            return c
    sys.exit("No se encontró docs/tiktok-shop-mx")


def seccion(texto, ini, fin):
    m = re.search(rf"^{ini}.*?$(.*?)^{fin}", texto, re.M | re.S)
    return m.group(1) if m else ""


def leer_ficha(p):
    t = p.read_text(encoding="utf-8")
    m = re.search(r"^#\s*Ficha\s+(\d+)\s*[·\-:]\s*(.+)$", t, re.M)
    num, nombre = (int(m.group(1)), m.group(2).strip()) if m else (None, p.stem)
    consultas = []
    for tipo, q in re.findall(r"^\|\s*(\([a-e]\)[^|]*?)\s*\|\s*([^|]+?)\s*\|$", seccion(t, r"## 2\.", r"## 3\."), re.M):
        consultas.append((tipo.strip(), q.strip()))
    filas = []
    for fila, url in re.findall(r"^\|\s*(\d+)\s*\|[^|]*\|\s*(https?://\S+?)\s*\|", seccion(t, r"### 3\.2", r"### 3\.3"), re.M):
        filas.append((int(fila), url))
    s8 = seccion(t, r"## 8\.", r"## 9\.")
    prior = {int(n) for n in re.findall(r"#(\d+)", s8)}
    for grupo in re.findall(r"filas?\s+([\d,\sy]+)", s8):
        prior |= {int(n) for n in re.findall(r"\d+", grupo)}
    return {
        "num": num,
        "nombre": nombre,
        "consultas": consultas,
        "filas": filas,
        "prioridad": prior,
        "creadores_r1": set(re.findall(r"@[\w.]+", seccion(t, r"### 3\.3", r"### 3\.4"))),
    }


def fichas(r):
    out = [leer_ficha(p) for p in sorted((r / "investigacion").glob("[0-9][0-9]_*.md"))]
    for f in out:
        if len(f["consultas"]) != 5:
            print(f"AVISO {f['nombre']}: se esperaban 5 consultas y hay {len(f['consultas'])}", file=sys.stderr)
    return out


def escribir(path, cab, filas):
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(cab)
        w.writerows(filas)


def plantilla(a):
    r = root()
    out = Path(a.out) if a.out else r / "investigacion" / "ronda2"
    out.mkdir(parents=True, exist_ok=True)
    cap, rev, tie = [], [], []
    for f in fichas(r):
        for tipo, q in f["consultas"]:
            for pos in range(1, 11):
                cap.append([f["num"], f["nombre"], tipo, q, "Principal", pos] + [""] * (len(CAPTURA) - 6))
            if "(c)" in tipo or "(e)" in tipo:
                for pos in range(1, 6):
                    tie.append([f["num"], f["nombre"], q, pos] + [""] * (len(TIENDA) - 4))
        for fila, url in f["filas"]:
            rev.append(
                [f["num"], f["nombre"], fila, "alta" if fila in f["prioridad"] else "normal", url] + [""] * (len(REVISITA) - 5)
            )
    rev.sort(key=lambda x: (x[0], x[3] != "alta", x[2]))
    for nombre, cab, filas in [
        ("captura_busquedas.csv", CAPTURA, cap),
        ("revisita_urls_r1.csv", REVISITA, rev),
        ("tienda_busquedas.csv", TIENDA, tie),
    ]:
        if (out / nombre).exists() and not a.force:
            print(f"Existe {out / nombre}; no se sobrescribe (usa --force).", file=sys.stderr)
            continue
        escribir(out / nombre, cab, filas)
        print(f"{out / nombre}: {len(filas)} filas")


def leer_csv(p):
    if not p.exists():
        return []
    with p.open(encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def resumen(a):
    r = root()
    d = Path(a.dir) if a.dir else r / "investigacion" / "ronda2"
    cap = [x for x in leer_csv(d / "captura_busquedas.csv") if x.get("url", "").strip()]
    rev = [x for x in leer_csv(d / "revisita_urls_r1.csv") if x.get("estado_url", "").strip()]
    tie = [x for x in leer_csv(d / "tienda_busquedas.csv") if x.get("producto", "").strip()]
    problemas = []
    for i, x in enumerate(cap, 2):
        for c in OBLIG_CAPTURA:
            if not x.get(c, "").strip():
                problemas.append(f"captura_busquedas.csv fila {i}: '{c}' vacío (escribe 'no disponible' si no se vio)")
        if x["url"].strip() and not x["url"].strip().startswith("http"):
            problemas.append(f"captura_busquedas.csv fila {i}: URL inválida")
        for c in ("vistas", "likes", "comentarios"):
            v = x.get(c, "").strip()
            if v == "0":
                problemas.append(f"captura_busquedas.csv fila {i}: '{c}'=0; confirma que se vio 0 y no que falta el dato")
    for i, x in enumerate(rev, 2):
        if x["estado_url"].strip().lower() not in ESTADOS_URL:
            problemas.append(f"revisita_urls_r1.csv fila {i}: estado_url '{x['estado_url']}' no es uno de {sorted(ESTADOS_URL)}")
    por = defaultdict(lambda: {"cap": [], "rev": [], "tie": []})
    for x in cap:
        por[x["candidato_num"]]["cap"].append(x)
    for x in rev:
        por[x["candidato_num"]]["rev"].append(x)
    for x in tie:
        por[x["candidato_num"]]["tie"].append(x)
    fs = {str(f["num"]): f for f in fichas(r)}
    if problemas:
        print("PROBLEMAS (corrígelos antes de pasar a la ficha):", file=sys.stderr)
        for p in problemas[:60]:
            print("  " + p, file=sys.stderr)
    for num in sorted(por, key=int):
        if a.candidato and str(a.candidato) != num:
            continue
        g, f = por[num], fs.get(num, {"nombre": num, "creadores_r1": set()})
        urls = {}
        for x in g["cap"]:
            urls.setdefault(x["url"].strip(), x)
        creadores = {x["creador"].strip() for x in urls.values() if x["creador"].strip().startswith("@")}
        nuevos = creadores - f["creadores_r1"]
        fechas = sorted({x["fecha_obs"].strip() for x in g["cap"] + g["rev"] if x.get("fecha_obs", "").strip()})
        print(f"\n### 3b. Observaciones — ronda 2 · Ficha {num} · {f['nombre']}\n")
        print(f"- Fecha(s) de observación: {', '.join(fechas) or 'no disponible'}")
        print(f"- Resultados capturados: {len(g['cap'])} filas; URLs únicas: {len(urls)}")
        print(
            f"- Creadores únicos (@): {len(creadores)}; nuevos respecto a ronda 1: {len(nuevos)}"
            + (f" ({', '.join(sorted(nuevos))})" if nuevos else "")
        )
        print(f"- Con señal MX: {sum(1 for x in urls.values() if x.get('senal_mx', '').strip().lower() in ('sí', 'si'))}")
        print(
            f"- Con enlace a TikTok Shop: {sum(1 for x in urls.values() if x.get('enlace_tiktok_shop', '').strip().lower() in ('sí', 'si'))}"
        )
        estados = defaultdict(int)
        for x in g["rev"]:
            estados[x["estado_url"].strip().lower()] += 1
        print(
            f"- URLs de ronda 1 revisitadas: {len(g['rev'])}"
            + (" (" + ", ".join(f"{k}: {v}" for k, v in sorted(estados.items())) + ")" if estados else "")
        )
        print(f"- Productos vistos en la pestaña Tienda: {len(g['tie'])}")
        preg = [
            x["preguntas_compra"].strip()
            for x in urls.values()
            if x.get("preguntas_compra", "").strip().lower() not in ("", "no disponible")
        ]
        if preg:
            print("\nPreguntas de compra observadas (hechos, texto capturado):")
            for p in preg[:15]:
                print(f"- {p}")
        print("\n| # | Tipo | URL | Fecha pub. | Formato | Creador | Vistas | Likes | Comentarios | Shop | Preguntas |")
        print("|---|---|---|---|---|---|---|---|---|---|---|")
        for i, x in enumerate(urls.values(), 1):
            print(
                f"| {i} | {x['tipo']} | {x['url']} | {x['fecha_pub'] or 'no disponible'} | {x['formato'] or 'no disponible'} | {x['creador'] or 'no disponible'} | "
                f"{x['vistas'] or 'no disponible'} | {x['likes'] or 'no disponible'} | {x['comentarios'] or 'no disponible'} | {x.get('enlace_tiktok_shop') or 'no disponible'} | {x['preguntas_compra'] or 'no disponible'} |"
            )
    if not por:
        print("No hay filas capturadas todavía.")


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    p1 = sp.add_parser("plantilla")
    p1.add_argument("--out")
    p1.add_argument("--force", action="store_true")
    p2 = sp.add_parser("resumen")
    p2.add_argument("--dir")
    p2.add_argument("--candidato")
    a = ap.parse_args()
    {"plantilla": plantilla, "resumen": resumen}[a.cmd](a)


if __name__ == "__main__":
    main()
