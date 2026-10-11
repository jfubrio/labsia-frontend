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
  precio_lista_informativo NUMERIC(12,2),            -- lista/lanzamiento. SOLO informativo; nunca es referencia de descuento
  precio_objetivo          NUMERIC(12,2),            -- objetivo manual; NULL = derivado del precio real de mercado
  precio_maximo            NUMERIC(12,2) NOT NULL,   -- tope duro: nunca se autoriza por encima
  umbral_descuento_pct     NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  mercados                 TEXT[] NOT NULL DEFAULT ARRAY['MX'],   -- mercados vigilados (historial y comparación)
  mercados_compra          TEXT[] NOT NULL DEFAULT ARRAY['MX'],   -- mercados donde se permite comprar; el extranjero exige buzón
  requiere_aprobacion      BOOLEAN NOT NULL DEFAULT TRUE,
  vigilancia_activa        BOOLEAN NOT NULL DEFAULT FALSE,
  intervalo_minutos        INTEGER NOT NULL DEFAULT 360,
  creado_en                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (precio_objetivo IS NULL OR precio_objetivo <= precio_maximo),
  CHECK (umbral_descuento_pct >= 0 AND umbral_descuento_pct <= 100)
);
CREATE UNIQUE INDEX uniq_watch_config_per_product ON caza_watch_configs (product_id);

-- Buzones de recepción en el extranjero. Una compra en EE. UU. es doméstica allí (impuesto de venta). La mercancía
-- entra a casa por cruce personal (franquicia de pasajero; tasa global solo sobre el excedente) o por paquetería
-- (reenvío + importación por tramos de caza_reglas_importacion).
CREATE TABLE caza_buzones (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clave                    TEXT NOT NULL UNIQUE,          -- 'buzon_tx'
  nombre                   TEXT NOT NULL,
  mercado                  CHAR(2) NOT NULL,
  moneda                   CHAR(3) NOT NULL,
  impuesto_venta_pct       NUMERIC(5,2) NOT NULL,         -- según la dirección exacta del buzón
  envio_domestico          NUMERIC(12,2) NOT NULL DEFAULT 0,
  tarifa_recepcion         NUMERIC(12,2) NOT NULL DEFAULT 0, -- por paquete recibido, en moneda del buzón
  modo_ingreso             TEXT NOT NULL DEFAULT 'cruce_personal', -- cruce_personal | paqueteria
  costo_viaje              NUMERIC(12,2) NOT NULL DEFAULT 0, -- cruce_personal: costo del viaje atribuido a la compra
  franquicia_usd           NUMERIC(12,2) NOT NULL DEFAULT 0, -- cruce_personal: franquicia de pasajero por persona y cruce
  tasa_excedente           NUMERIC(6,4) NOT NULL DEFAULT 0.19, -- cruce_personal: tasa global sobre el excedente
  tope_simplificado_usd    NUMERIC(12,2) NOT NULL DEFAULT 3000, -- cruce_personal: por encima requiere agente aduanal
  tarifa_reenvio           NUMERIC(12,2) NOT NULL DEFAULT 0, -- paqueteria: por paquete reenviado, en moneda del buzón
  dias_transito_estimados  INTEGER NOT NULL DEFAULT 7,
  consignatario_con_rfc    BOOLEAN NOT NULL DEFAULT TRUE,
  activo                   BOOLEAN NOT NULL DEFAULT TRUE,
  notas                    TEXT,
  creado_en                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (modo_ingreso IN ('cruce_personal', 'paqueteria'))
);

-- Reglas de importación por tramos de valor (USD) entre un mercado de origen y el de casa. Siempre con fuente y vigencia.
CREATE TABLE caza_reglas_importacion (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  origen         CHAR(2) NOT NULL,
  destino        CHAR(2) NOT NULL,
  min_usd        NUMERIC(12,2) NOT NULL,
  max_usd        NUMERIC(12,2),                           -- NULL = sin tope
  tasa           NUMERIC(6,4) NOT NULL,                   -- fracción: 0.19 = 19 %
  nota           TEXT NOT NULL,
  fuente         TEXT NOT NULL,
  por_confirmar  BOOLEAN NOT NULL DEFAULT TRUE,
  vigente_desde  DATE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (max_usd IS NULL OR max_usd > min_usd)
);
CREATE INDEX idx_reglas_importacion ON caza_reglas_importacion (origen, destino, min_usd);

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
  tienda                   TEXT,                      -- tienda que publica la oferta; NULL = la del conector
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

-- Perfil de PRECIO REAL DE MERCADO por producto, mercado y moneda (motor central, engines/market-price.ts).
-- El precio real sale del comportamiento de la oferta competitiva en el tiempo (mínimo entre tiendas por día,
-- mediana ponderada por recencia, régimen), nunca del precio de lista ni del "antes" anunciado.
CREATE TABLE caza_market_price_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id          UUID NOT NULL REFERENCES caza_products(id) ON DELETE CASCADE,
  mercado             CHAR(2) NOT NULL,
  moneda              CHAR(3) NOT NULL,
  calculado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ventana_dias        INTEGER NOT NULL,
  precio_real         NUMERIC(12,2),
  mediana_ponderada   NUMERIC(12,2),
  mediana_reciente    NUMERIC(12,2),
  mediana_anterior    NUMERIC(12,2),
  piso                NUMERIC(12,2),
  techo               NUMERIC(12,2),
  tendencia_pct       NUMERIC(6,2),
  regimen             TEXT,                           -- bajando | estable | subiendo
  lanzamiento_inflado BOOLEAN NOT NULL DEFAULT FALSE,
  confianza           TEXT NOT NULL,                  -- alta | media | baja | sin_historial
  dias_cubiertos      INTEGER NOT NULL,
  dias_observados     INTEGER NOT NULL,
  muestras            INTEGER NOT NULL,
  tiendas             TEXT[] NOT NULL,
  serie               JSONB NOT NULL,                 -- [{day, precioMinimo, tienda, tiendasObservadas}]
  notas               TEXT[] NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_profiles_product_time ON caza_market_price_profiles (product_id, mercado, calculado_en DESC);

-- Veredictos del motor de validación de descuentos, siempre contra el precio real de mercado
CREATE TABLE caza_discount_verdicts (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  observation_id       UUID NOT NULL UNIQUE REFERENCES caza_price_observations(id) ON DELETE CASCADE,
  profile_id           UUID REFERENCES caza_market_price_profiles(id),
  veredicto            TEXT NOT NULL,                 -- minimo_historico | real | dudoso | falso | sin_historial
  precio_real          NUMERIC(12,2),
  piso                 NUMERIC(12,2),
  techo                NUMERIC(12,2),
  regimen              TEXT,
  confianza            TEXT NOT NULL,
  ahorro_pct_real      NUMERIC(6,2),                  -- vs precio real de mercado
  ahorro_pct_anunciado NUMERIC(6,2),                  -- vs precio_anterior_anunciado (solo informativo)
  ancla_inflada        BOOLEAN NOT NULL DEFAULT FALSE,
  lanzamiento_inflado  BOOLEAN NOT NULL DEFAULT FALSE,
  dias_cubiertos       INTEGER NOT NULL,
  tiendas              INTEGER NOT NULL,
  razon                TEXT NOT NULL,
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (veredicto IN ('minimo_historico', 'real', 'dudoso', 'falso', 'sin_historial'))
);

-- Propuestas de compra generadas por la vigilancia. Esperan approve/reject del operador (fase 5).
CREATE TABLE caza_purchase_proposals (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id             UUID NOT NULL REFERENCES caza_products(id) ON DELETE CASCADE,
  observation_id         UUID NOT NULL UNIQUE REFERENCES caza_price_observations(id) ON DELETE CASCADE,
  verdict_id             UUID REFERENCES caza_discount_verdicts(id),
  precio                 NUMERIC(12,2) NOT NULL,
  moneda                 CHAR(3) NOT NULL,
  precio_objetivo        NUMERIC(12,2) NOT NULL,       -- en moneda base
  objetivo_derivado      BOOLEAN NOT NULL,
  precio_aterrizado_base NUMERIC(12,2) NOT NULL,
  moneda_base            CHAR(3) NOT NULL,
  buzon_id               UUID REFERENCES caza_buzones(id),
  motivo                 TEXT NOT NULL,
  estado                 TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | aprobada | rechazada | expirada
  creado_en              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'expirada'))
);
CREATE INDEX idx_proposals_product_estado ON caza_purchase_proposals (product_id, estado, creado_en DESC);
-- Una sola propuesta pendiente por producto: la vigilancia no debe acumular propuestas que nadie revisa.
CREATE UNIQUE INDEX uniq_pending_proposal_per_product ON caza_purchase_proposals (product_id) WHERE estado = 'pendiente';

-- Corridas de vigilancia: evidencia de que las observaciones son periódicas y de qué pasó en cada una.
CREATE TABLE caza_watch_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES caza_products(id) ON DELETE CASCADE,
  iniciado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terminado_en    TIMESTAMPTZ,
  disparador      TEXT NOT NULL,                     -- scheduler | manual
  conectores      TEXT[] NOT NULL DEFAULT '{}',
  observaciones   INTEGER NOT NULL DEFAULT 0,
  veredictos      INTEGER NOT NULL DEFAULT 0,
  propuestas      INTEGER NOT NULL DEFAULT 0,
  estado          TEXT NOT NULL DEFAULT 'en_curso',  -- en_curso | ok | error
  error           TEXT,
  CHECK (estado IN ('en_curso', 'ok', 'error'))
);
CREATE INDEX idx_watch_runs_product_time ON caza_watch_runs (product_id, iniciado_en DESC);

-- Autorizaciones del operador (approve / reject)
CREATE TABLE caza_purchase_authorizations (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id         UUID NOT NULL REFERENCES caza_products(id),
  observation_id     UUID NOT NULL REFERENCES caza_price_observations(id),
  decision           TEXT NOT NULL,                   -- approve | reject
  precio_maximo      NUMERIC(12,2) NOT NULL,          -- tope autorizado para ESTA oferta, en la moneda de la oferta
  moneda             CHAR(3) NOT NULL,
  precio_aterrizado_base NUMERIC(12,2),               -- estimado en moneda base para compras en el extranjero
  buzon_id           UUID REFERENCES caza_buzones(id),-- buzón de recepción si la compra es en el extranjero
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
  buzon_id           UUID REFERENCES caza_buzones(id),
  guia_reenvio       TEXT,                            -- paqueteria: rastreo del reenvío buzón → casa
  recogido_en        TIMESTAMPTZ,                     -- cruce_personal: cuándo se recogió en el buzón
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
