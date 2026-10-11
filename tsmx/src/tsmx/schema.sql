-- Esquema del MVP interno TikTok Shop MX (T04). Versión 1.
-- Convención: NULL significa "no disponible". Nunca se usa 0 para un dato que no se vio.
-- SQL compatible con SQLite y, salvo los disparadores, con PostgreSQL.

CREATE TABLE IF NOT EXISTS usuarios (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  rol         TEXT NOT NULL CHECK (rol IN ('propietario','editor','revisor','lector')),
  activo      INTEGER NOT NULL DEFAULT 1,
  creado_en   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS candidatos (
  num     INTEGER PRIMARY KEY,
  nombre  TEXT NOT NULL,
  ficha   TEXT
);

CREATE TABLE IF NOT EXISTS importaciones (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo              TEXT NOT NULL,
  archivo           TEXT NOT NULL,
  sha256            TEXT NOT NULL,
  filas_ok          INTEGER NOT NULL,
  filas_duplicadas  INTEGER NOT NULL,
  filas_rechazadas  INTEGER NOT NULL,
  estado            TEXT NOT NULL DEFAULT 'en_curso' CHECK (estado IN ('en_curso','completa','fallida')),
  usuario           TEXT NOT NULL REFERENCES usuarios(id),
  creado_en         TEXT NOT NULL,
  UNIQUE (tipo, sha256)
);

CREATE TABLE IF NOT EXISTS productos (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  tiktok_product_id  TEXT UNIQUE,
  candidato_num      INTEGER REFERENCES candidatos(num),
  nombre             TEXT NOT NULL,
  variante           TEXT,
  vendedor           TEXT,
  precio_mxn         REAL CHECK (precio_mxn IS NULL OR precio_mxn >= 0),
  comision_pct       REAL CHECK (comision_pct IS NULL OR (comision_pct >= 0 AND comision_pct <= 100)),
  estado             TEXT NOT NULL DEFAULT 'en_validacion' CHECK (estado IN ('en_validacion','apto','descartado')),
  evidencia          TEXT,
  creado_en          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contenidos (
  id              TEXT PRIMARY KEY,
  candidato_num   INTEGER REFERENCES candidatos(num),
  pilar           TEXT,
  titulo          TEXT NOT NULL,
  estado          TEXT NOT NULL CHECK (estado IN ('borrador','en_revision','aprobado','publicado','archivado')),
  version_actual  INTEGER NOT NULL,
  producto_id     INTEGER REFERENCES productos(id),
  creado_por      TEXT NOT NULL REFERENCES usuarios(id),
  creado_en       TEXT NOT NULL,
  actualizado_en  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contenido_versiones (
  contenido_id  TEXT NOT NULL REFERENCES contenidos(id),
  version       INTEGER NOT NULL,
  cuerpo        TEXT NOT NULL,
  hash          TEXT NOT NULL,
  autor         TEXT NOT NULL REFERENCES usuarios(id),
  creado_en     TEXT NOT NULL,
  PRIMARY KEY (contenido_id, version)
);

CREATE TABLE IF NOT EXISTS aprobaciones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  contenido_id  TEXT NOT NULL,
  version       INTEGER NOT NULL,
  hash          TEXT NOT NULL,
  decision      TEXT NOT NULL CHECK (decision IN ('aprobado','rechazado')),
  revisor       TEXT NOT NULL REFERENCES usuarios(id),
  comentario    TEXT,
  vigente       INTEGER NOT NULL DEFAULT 1,
  creado_en     TEXT NOT NULL,
  FOREIGN KEY (contenido_id, version) REFERENCES contenido_versiones(contenido_id, version)
);

CREATE TABLE IF NOT EXISTS publicaciones (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  contenido_id           TEXT NOT NULL REFERENCES contenidos(id),
  version                INTEGER NOT NULL,
  url                    TEXT NOT NULL UNIQUE,
  fecha_pub              TEXT,
  divulgacion_comercial  TEXT,
  sin_aprobacion         INTEGER NOT NULL DEFAULT 0,
  creado_en              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metricas_video (
  publicacion_id                INTEGER NOT NULL REFERENCES publicaciones(id),
  fecha_lectura                 TEXT NOT NULL,
  vistas                        INTEGER,
  tiempo_medio_s                REAL,
  pct_completo                  REAL,
  likes                         INTEGER,
  comentarios                   INTEGER,
  compartidos                   INTEGER,
  guardados                     INTEGER,
  visitas_perfil                INTEGER,
  seguidores_ganados            INTEGER,
  comentarios_intencion_compra  INTEGER,
  comentarios_objecion          INTEGER,
  importacion_id                INTEGER REFERENCES importaciones(id),
  PRIMARY KEY (publicacion_id, fecha_lectura)
);

CREATE TABLE IF NOT EXISTS comisiones (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  clave_externa          TEXT NOT NULL UNIQUE,
  producto_id            INTEGER REFERENCES productos(id),
  publicacion_id         INTEGER REFERENCES publicaciones(id),
  candidato_num          INTEGER REFERENCES candidatos(num),
  fecha_pedido           TEXT,
  monto_bruto_mxn        REAL NOT NULL CHECK (monto_bruto_mxn >= 0),
  estado                 TEXT NOT NULL CHECK (estado IN ('estimada','aprobada','liquidada','cancelada')),
  rfc_valido             INTEGER NOT NULL,
  guanajuato             INTEGER NOT NULL DEFAULT 0,
  retencion_iva_mxn      REAL NOT NULL,
  retencion_isr_mxn      REAL NOT NULL,
  retencion_estatal_mxn  REAL NOT NULL,
  monto_neto_mxn         REAL NOT NULL,
  fecha_estimada         TEXT,
  fecha_aprobada         TEXT,
  fecha_liquidada        TEXT,
  fecha_cancelada        TEXT,
  fuente                 TEXT NOT NULL,
  importacion_id         INTEGER REFERENCES importaciones(id)
);

CREATE TABLE IF NOT EXISTS costos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  clave_externa   TEXT NOT NULL UNIQUE,
  fecha           TEXT NOT NULL,
  concepto        TEXT NOT NULL,
  categoria       TEXT NOT NULL CHECK (categoria IN ('muestra','producto_demo','herramienta','publicidad','otro')),
  monto_mxn       REAL NOT NULL CHECK (monto_mxn >= 0),
  candidato_num   INTEGER REFERENCES candidatos(num),
  importacion_id  INTEGER REFERENCES importaciones(id)
);

CREATE TABLE IF NOT EXISTS auditoria (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          TEXT NOT NULL,
  usuario     TEXT NOT NULL,
  accion      TEXT NOT NULL,
  entidad     TEXT NOT NULL,
  entidad_id  TEXT,
  detalle     TEXT
);

-- La auditoría es de solo inserción (T06, T08).
CREATE TRIGGER IF NOT EXISTS auditoria_sin_update BEFORE UPDATE ON auditoria
BEGIN SELECT RAISE(ABORT, 'la auditoria es de solo insercion'); END;
CREATE TRIGGER IF NOT EXISTS auditoria_sin_delete BEFORE DELETE ON auditoria
BEGIN SELECT RAISE(ABORT, 'la auditoria es de solo insercion'); END;

CREATE INDEX IF NOT EXISTS idx_metricas_pub ON metricas_video(publicacion_id, fecha_lectura);
CREATE INDEX IF NOT EXISTS idx_comisiones_estado ON comisiones(estado);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria(entidad, entidad_id);
