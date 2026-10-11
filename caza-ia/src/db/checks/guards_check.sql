-- CAZA IA — Comprobación manual de las guardas de compra (migración 002).
-- Ejecutar sobre una base de datos de PRUEBA con las migraciones 001–003 aplicadas:
--   psql "$DATABASE_URL" -f src/db/checks/guards_check.sql
-- Resultado esperado: los pasos 1, 2, 4 y 5 terminan en ERROR; el paso 3 crea exactamente una orden.
-- Al final deja purchases_enabled en 'false'.

\set QUIET on
INSERT INTO caza_price_observations (id, product_id, connector_id, precio, precio_anterior_anunciado, moneda, en_stock, url, oferta_hash)
SELECT '11111111-1111-1111-1111-111111111111', p.id, c.id, 7899, 9999, 'MXN', TRUE, 'https://mock.local/mx/sony-wh1000xm6', 'h1'
FROM caza_products p, caza_connectors c WHERE p.slug='sony-wh1000xm6' AND c.clave='mock';
INSERT INTO caza_purchase_authorizations (id, product_id, observation_id, decision, precio_maximo, moneda, autorizado_por, expira_en)
SELECT '22222222-2222-2222-2222-222222222222', p.id, '11111111-1111-1111-1111-111111111111', 'approve', 7899, 'MXN', 'op@labsia.mx', NOW() + INTERVAL '24 hours'
FROM caza_products p WHERE p.slug='sony-wh1000xm6';
\set QUIET off

\echo '--- 1) Compras deshabilitadas: debe fallar y NO consumir la autorización'
INSERT INTO caza_purchase_orders (product_id, authorization_id, connector_id, idempotency_key, moneda, precio_final)
SELECT p.id, '22222222-2222-2222-2222-222222222222', c.id, 'k1', 'MXN', 7899 FROM caza_products p, caza_connectors c WHERE p.slug='sony-wh1000xm6' AND c.clave='mock';
SELECT consumido_en IS NULL AS autorizacion_intacta FROM caza_purchase_authorizations WHERE id='22222222-2222-2222-2222-222222222222';

\echo '--- 2) Simular fase 6: habilitar compras; un precio por encima del tope debe fallar'
UPDATE caza_settings SET valor='true' WHERE clave='purchases_enabled';
INSERT INTO caza_purchase_orders (product_id, authorization_id, connector_id, idempotency_key, moneda, precio_final)
SELECT p.id, '22222222-2222-2222-2222-222222222222', c.id, 'k1', 'MXN', 7900 FROM caza_products p, caza_connectors c WHERE p.slug='sony-wh1000xm6' AND c.clave='mock';

\echo '--- 3) Orden válida: debe crearse y consumir la autorización'
INSERT INTO caza_purchase_orders (product_id, authorization_id, connector_id, idempotency_key, moneda, precio_final)
SELECT p.id, '22222222-2222-2222-2222-222222222222', c.id, 'k1', 'MXN', 7899 FROM caza_products p, caza_connectors c WHERE p.slug='sony-wh1000xm6' AND c.clave='mock';
SELECT consumido_en IS NOT NULL AS autorizacion_consumida FROM caza_purchase_authorizations WHERE id='22222222-2222-2222-2222-222222222222';

\echo '--- 4) Segunda autorización approve para el mismo producto: la orden duplicada debe fallar por índice único'
INSERT INTO caza_purchase_authorizations (id, product_id, observation_id, decision, precio_maximo, moneda, autorizado_por, expira_en)
SELECT '33333333-3333-3333-3333-333333333333', p.id, '11111111-1111-1111-1111-111111111111', 'approve', 7899, 'MXN', 'op@labsia.mx', NOW() + INTERVAL '24 hours'
FROM caza_products p WHERE p.slug='sony-wh1000xm6';
INSERT INTO caza_purchase_orders (product_id, authorization_id, connector_id, idempotency_key, moneda, precio_final)
SELECT p.id, '33333333-3333-3333-3333-333333333333', c.id, 'k2', 'MXN', 7899 FROM caza_products p, caza_connectors c WHERE p.slug='sony-wh1000xm6' AND c.clave='mock';

\echo '--- 5) Audit log inmutable: debe fallar'
UPDATE caza_audit_log SET actor='x';

\echo '--- Resultado esperado: 1 orden'
SELECT count(*) AS ordenes FROM caza_purchase_orders;
UPDATE caza_settings SET valor='false' WHERE clave='purchases_enabled';
