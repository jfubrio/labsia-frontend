-- CAZA IA — Fase 1 — Esquema lógico
-- Convención LABSIA: migraciones SQL numeradas, UUID como PK, timestamps TIMESTAMPTZ.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Producto vigilado
CREATE TABLE caza_products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug            TEXT NOT NULL UNIQUE,              -- 'sony-wh1000xm6'
  nombre          TEXT NOT NULL,
  marca           TEXT,
  modelo          TEXT,
  moneda_base     CHAR(3) NOT NULL DEFAULT 'MXN',
  estado          TEXT NOT NULL DEFAULT 'activo',    -- activo | pausado | archivado
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configuración de vigilancia por producto (una activa por producto)
CREATE TABLE caza_watch_configs (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id               UUID NOT NULL REFERENCES caza_products(id) ON DELETE CASCADE,
  precio_referencia        NUMERIC(12,2),            -- precio de lista conocido
  precio_objetivo          NUMERIC(12,2) NOT NULL,   -- a partir de aquí se propone compra
  precio_maximo            NUMERIC(12,2) NOT NULL,   -- nunca se autoriza por encima
  umbral_descuento_pct     NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  mercados                 TEXT[] NOT NULL DEFAULT ARRAY['MX'],
  requiere_aprobacion      BOOLEAN NOT NULL DEFAULT TRUE,
  vigilancia_activa        BOOLEAN NOT NULL DEFAULT FALSE,
  intervalo_minutos        INTEGER NOT NULL DEFAULT 360,
  creado_en                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (precio_objetivo <= precio_maximo),
  CHECK (umbral_descuento_pct >= 0 AND umbral_descuento_pct <= 100)
);
CREATE UNIQUE INDEX uniq_watch_config_per_product ON caza_watch_configs (product_id);

-- Conectores (tiendas) y su estado de validación (fase 0)
CREATE TABLE caza_connectors (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clave              TEXT NOT NULL UNIQUE,            -- 'mock', 'amazon_mx', 'sony_store_mx', 'amazon_us'
  nombre             TEXT NOT NULL,
  mercado            CHAR(2) NOT NULL,                -- 'MX', 'US'
  moneda             CHAR(3) NOT NULL,
  tipo               TEXT NOT NULL,                   -- mock | api | scraping
  soporta_compra     BOOLEAN NOT NULL DEFAULT FALSE,
  estado_validacion  TEXT NOT NULL DEFAULT 'por_validar', -- por_validar | validado | descartado
  notas_validacion   TEXT,
  habilitado         BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Observaciones de precio (historial)
CREATE TABLE caza_price_observations (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id               UUID NOT NULL REFERENCES caza_products(id) ON DELETE CASCADE,
  connector_id             UUID NOT NULL REFERENCES caza_connectors(id),
  observado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  precio                   NUMERIC(12,2) NOT NULL,
  precio_anterior_anunciado NUMERIC(12,2),           -- el "antes" que anuncia la tienda; NO se confía en él
  moneda                   CHAR(3) NOT NULL,
  en_stock                 BOOLEAN NOT NULL DEFAULT TRUE,
  url                      TEXT,
  vendedor                 TEXT,
  oferta_hash              TEXT NOT NULL,             -- hash(connector, precio, moneda, url, vendedor): identifica la oferta
  raw                      JSONB
);
CREATE INDEX idx_observations_product_time ON caza_price_observations (product_id, observado_en DESC);
CREATE INDEX idx_observations_hash ON caza_price_observations (oferta_hash);

-- Veredictos del motor de validación de descuentos
CREATE TABLE caza_discount_verdicts (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  observation_id     UUID NOT NULL UNIQUE REFERENCES caza_price_observations(id) ON DELETE CASCADE,
  veredicto          TEXT NOT NULL,                   -- real | dudoso | falso
  mediana_30d        NUMERIC(12,2),
  mediana_90d        NUMERIC(12,2),
  minimo_90d         NUMERIC(12,2),
  ahorro_pct_real    NUMERIC(6,2),                    -- vs mediana 90d
  ahorro_pct_anunciado NUMERIC(6,2),                  -- vs precio_anterior_anunciado
  muestras           INTEGER NOT NULL,
  razon              TEXT NOT NULL,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Autorizaciones del operador (approve / reject)
CREATE TABLE caza_purchase_authorizations (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id         UUID NOT NULL REFERENCES caza_products(id),
  observation_id     UUID NOT NULL REFERENCES caza_price_observations(id),
  decision           TEXT NOT NULL,                   -- approve | reject
  precio_maximo      NUMERIC(12,2) NOT NULL,          -- tope autorizado para ESTA oferta
  moneda             CHAR(3) NOT NULL,
  autorizado_por     TEXT NOT NULL,                   -- identidad del operador
  expira_en          TIMESTAMPTZ NOT NULL,
  consumido_en       TIMESTAMPTZ,                     -- se marca al crear la orden (un solo uso)
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (decision IN ('approve', 'reject'))
);
CREATE INDEX idx_auth_product ON caza_purchase_authorizations (product_id, creado_en DESC);

-- Órdenes de compra. En fase 1 NO se crea ninguna fila (PURCHASES_ENABLED=false).
CREATE TABLE caza_purchase_orders (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id         UUID NOT NULL REFERENCES caza_products(id),
  authorization_id   UUID NOT NULL UNIQUE REFERENCES caza_purchase_authorizations(id),
  connector_id       UUID NOT NULL REFERENCES caza_connectors(id),
  idempotency_key    TEXT NOT NULL UNIQUE,
  status             TEXT NOT NULL DEFAULT 'pending', -- pending | authorized | placed | cancelled | failed | delivered
  precio_final       NUMERIC(12,2),
  moneda             CHAR(3) NOT NULL,
  referencia_externa TEXT,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log inmutable
CREATE TABLE caza_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  ocurrido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor       TEXT NOT NULL,                          -- 'sistema' | identidad del operador
  evento      TEXT NOT NULL,                          -- observation.recorded | verdict.issued | authorization.approve | ...
  product_id  UUID REFERENCES caza_products(id),
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_audit_product_time ON caza_audit_log (product_id, ocurrido_en DESC);
