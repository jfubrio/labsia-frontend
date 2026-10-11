import csv
import tempfile
import unittest
from pathlib import Path

from tsmx import candidatos, permisos
from tsmx.db import conectar, migrar

DOCS = Path(__file__).resolve().parents[2] / "docs" / "tiktok-shop-mx"


class Caso(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.ruta = self.dir / "t.db"
        self.con = conectar(self.ruta)
        migrar(self.con)
        permisos.crear_usuario(self.con, None, "juan", "Juan", "propietario")
        permisos.crear_usuario(self.con, "juan", "ed", "Editora", "editor")
        permisos.crear_usuario(self.con, "juan", "rev", "Revisor", "revisor")
        permisos.crear_usuario(self.con, "juan", "lec", "Lector", "lector")
        candidatos.sembrar(self.con, "juan", DOCS)

    def tearDown(self):
        self.con.close()
        self.tmp.cleanup()

    def csv(self, nombre, cabecera, filas):
        p = self.dir / nombre
        with open(p, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=cabecera)
            w.writeheader()
            for f in filas:
                w.writerow({k: f.get(k, "") for k in cabecera})
        return p

    def acciones(self):
        return [r["accion"] for r in self.con.execute("SELECT accion FROM auditoria ORDER BY id")]
