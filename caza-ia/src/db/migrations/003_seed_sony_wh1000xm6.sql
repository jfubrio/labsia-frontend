-- CAZA IA — Fase 1 — Datos iniciales: conectores y Sony WH-1000XM6
-- Vigilancia desactivada y compras deshabilitadas. Los conectores reales quedan 'por_validar' (fase 0).

INSERT INTO caza_connectors (clave, nombre, mercado, moneda, tipo, soporta_compra, estado_validacion, habilitado) VALUES
  ('mock',          'Conector de prueba',  'MX', 'MXN', 'mock',     FALSE, 'validado',    TRUE),
  ('amazon_mx',     'Amazon México',       'MX', 'MXN', 'api',      TRUE,  'por_validar', FALSE),
  ('sony_store_mx', 'Sony Store México',   'MX', 'MXN', 'scraping', FALSE, 'por_validar', FALSE),
  ('mercadolibre_mx','Mercado Libre',      'MX', 'MXN', 'api',      FALSE, 'por_validar', FALSE),
  ('amazon_us',     'Amazon US',           'US', 'USD', 'api',      FALSE, 'por_validar', FALSE),
  ('bestbuy_us',    'Best Buy',            'US', 'USD', 'api',      FALSE, 'por_validar', FALSE);

WITH p AS (
  INSERT INTO caza_products (slug, nombre, marca, modelo, moneda_base)
  VALUES ('sony-wh1000xm6', 'Sony WH-1000XM6', 'Sony', 'WH-1000XM6', 'MXN')
  RETURNING id
)
-- precio_lista_informativo = lanzamiento en Sony Store MX, solo informativo.
-- precio_objetivo NULL = derivado del precio real de mercado menos el umbral.
INSERT INTO caza_watch_configs
  (product_id, precio_lista_informativo, precio_objetivo, precio_maximo, umbral_descuento_pct, mercados, requiere_aprobacion, vigilancia_activa, intervalo_minutos)
SELECT id, 11999.00, NULL, 8499.00, 12.00, ARRAY['MX','US'], TRUE, FALSE, 360 FROM p;

INSERT INTO caza_audit_log (actor, evento, product_id, payload)
SELECT 'sistema', 'product.configured', id,
       jsonb_build_object('fase', 1, 'vigilancia_activa', false, 'purchases_enabled', false)
FROM caza_products WHERE slug = 'sony-wh1000xm6';
