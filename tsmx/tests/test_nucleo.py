import sqlite3

from tsmx import permisos
from tsmx.db import migrar
from tsmx.errores import PermisoDenegado

from .base import Caso


class TestNucleo(Caso):
    def test_migracion_idempotente(self):
        migrar(self.con); migrar(self.con)
        self.assertEqual(self.con.execute("PRAGMA user_version").fetchone()[0], 1)

    def test_candidatos_sembrados_desde_fichas(self):
        nums = [r[0] for r in self.con.execute("SELECT num FROM candidatos ORDER BY num")]
        self.assertEqual(nums, [1, 2, 3, 4, 5, 6])

    def test_primer_usuario_debe_ser_propietario(self):
        from tsmx.db import conectar
        c = conectar(self.dir / "otra.db"); migrar(c)
        with self.assertRaises(PermisoDenegado):
            permisos.crear_usuario(c, None, "x", "X", "editor")
        c.close()

    def test_solo_propietario_gestiona_usuarios(self):
        with self.assertRaises(PermisoDenegado):
            permisos.crear_usuario(self.con, "ed", "nuevo", "N", "lector")
        self.assertIn("permiso_denegado", self.acciones())

    def test_usuario_desactivado_no_actua(self):
        permisos.desactivar_usuario(self.con, "juan", "ed")
        with self.assertRaises(PermisoDenegado):
            permisos.exigir(self.con, "ed", "leer")

    def test_auditoria_es_de_solo_insercion(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.con.execute("UPDATE auditoria SET accion = 'x'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.con.execute("DELETE FROM auditoria")
