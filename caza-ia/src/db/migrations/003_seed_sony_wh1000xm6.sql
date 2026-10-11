-- CAZA IA — Fase 1 — Datos iniciales: conectores y Sony WH-1000XM6
-- Vigilancia desactivada y compras deshabilitadas. Los conectores reales quedan 'por_validar' (fase 0).

INSERT INTO caza_connectors (clave, nombre, mercado, moneda, tipo, soporta_compra, estado_validacion, habilitado) VALUES
  ('mock',          'Conector de prueba',  'MX', 'MXN', 'mock',     FALSE, 'validado',    TRUE),
  ('webhook',       'Ingesta externa (changedetection.io, Make, manual)', 'MX', 'MXN', 'api', FALSE, 'validado', TRUE),
  ('amazon_mx',     'Amazon México',       'MX', 'MXN', 'api',      TRUE,  'por_validar', FALSE),
  ('sony_store_mx', 'Sony Store México',   'MX', 'MXN', 'scraping', FALSE, 'por_validar', FALSE),
  ('mercadolibre_mx','Mercado Libre',      'MX', 'MXN', 'api',      FALSE, 'por_validar', FALSE),
  ('amazon_us',     'Amazon US',           'US', 'USD', 'api',      FALSE, 'por_validar', FALSE),
  ('bestbuy_us',    'Best Buy',            'US', 'USD', 'api',      FALSE, 'por_validar', FALSE),
  ('walmart_us',    'Walmart',             'US', 'USD', 'api',      FALSE, 'por_validar', FALSE),
  ('ebay_us',       'eBay (Browse API)',   'US', 'USD', 'api',      FALSE, 'por_validar', FALSE),
  ('bhphoto_us',    'B&H Photo',           'US', 'USD', 'scraping', FALSE, 'por_validar', FALSE),
  ('newegg_us',     'Newegg',              'US', 'USD', 'scraping', FALSE, 'por_validar', FALSE);

-- Buzón en Texas con cruce personal por tierra: el comprador vive cerca de la frontera y recoge en el buzón.
-- Dirección (tasa de impuesto de venta), tarifa de recepción, franquicia aplicable (500 USD general 2026; 150 USD
-- para residentes de la franja fronteriza) y tasa sobre el excedente: por confirmar.
INSERT INTO caza_buzones (clave, nombre, mercado, moneda, impuesto_venta_pct, envio_domestico, tarifa_recepcion, modo_ingreso, costo_viaje,
                          franquicia_usd, tasa_excedente, tope_simplificado_usd, tarifa_reenvio, dias_transito_estimados, consignatario_con_rfc, notas)
VALUES ('buzon_tx', 'Buzón Texas', 'US', 'USD', 8.25, 0, 5.00, 'cruce_personal', 0,
        500.00, 0.1900, 3000.00, 35.00, 3, TRUE,
        'Cruce personal. Tope combinado de Texas 8.25 %; confirmar con la dirección. Franquicia 500 USD (PRODECON 2026) o 150 USD si aplica residencia fronteriza; 19 % solo sobre el excedente, con factura. Paquetería solo como ruta alternativa.');

-- Importación por paquetería EE. UU. → México bajo T-MEC (ruta alternativa al cruce personal). Vigencia por confirmar en DOF/SAT.
INSERT INTO caza_reglas_importacion (origen, destino, min_usd, max_usd, tasa, nota, fuente, por_confirmar) VALUES
  ('US', 'MX',    0,    50, 0.0000, 'Exento hasta 50 USD',                                         'FedEx MX Reg Alert 2025; US Country Commercial Guide Mexico', TRUE),
  ('US', 'MX',   50,   117, 0.1700, '17 % entre 50 y 117 USD (origen T-MEC)',                      'FedEx MX Reg Alert 2025; US Country Commercial Guide Mexico', TRUE),
  ('US', 'MX',  117,  2500, 0.1900, '19 % tasa global entre 117 y 2,500 USD (origen T-MEC, con RFC)','FedEx MX Reg Alert 2025; US Country Commercial Guide Mexico', TRUE),
  ('US', 'MX', 2500,  NULL, 0.1900, 'Por encima de 2,500 USD requiere agente aduanal; 19 % como piso','supuesto', TRUE);

WITH p AS (
  INSERT INTO caza_products (slug, nombre, marca, modelo, moneda_base)
  VALUES ('sony-wh1000xm6', 'Sony WH-1000XM6', 'Sony', 'WH-1000XM6', 'MXN')
  RETURNING id
)
-- precio_lista_informativo = lanzamiento en Sony Store MX, solo informativo.
-- precio_objetivo NULL = derivado del precio real de mercado menos el umbral.
INSERT INTO caza_watch_configs
  (product_id, precio_lista_informativo, precio_objetivo, precio_maximo, umbral_descuento_pct, mercados, mercados_compra, requiere_aprobacion, vigilancia_activa, intervalo_minutos)
SELECT id, 11999.00, NULL, 8499.00, 12.00, ARRAY['MX','US'], ARRAY['MX','US'], TRUE, FALSE, 360 FROM p;

INSERT INTO caza_audit_log (actor, evento, product_id, payload)
SELECT 'sistema', 'product.configured', id,
       jsonb_build_object('fase', 1, 'vigilancia_activa', false, 'purchases_enabled', false)
FROM caza_products WHERE slug = 'sony-wh1000xm6';

-- Límites de gasto iniciales (por confirmar): 20,000 MXN al mes y 2 órdenes al mes.
INSERT INTO caza_spend_limits (presupuesto_mensual_base, max_ordenes_mes, actualizado_por)
VALUES (20000.00, 2, 'sistema');
