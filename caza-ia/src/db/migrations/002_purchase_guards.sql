-- CAZA IA — Fase 1 — Guardas de compra
-- La prevención de duplicados vive en PostgreSQL, no solo en el código (mismo criterio que LABSIA DOC 10).

-- 1) Nunca dos órdenes activas para el mismo producto.
CREATE UNIQUE INDEX uniq_active_order_per_product
ON caza_purchase_orders (product_id)
WHERE status IN ('pending', 'authorized', 'placed');

-- 2) Una orden solo puede nacer de una autorización 'approve' vigente y no consumida.
CREATE OR REPLACE FUNCTION caza_check_order_authorization() RETURNS TRIGGER AS $$
DECLARE
  auth caza_purchase_authorizations%ROWTYPE;
BEGIN
  SELECT * INTO auth FROM caza_purchase_authorizations WHERE id = NEW.authorization_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CAZA: autorización % no existe', NEW.authorization_id;
  END IF;
  IF auth.decision <> 'approve' THEN
    RAISE EXCEPTION 'CAZA: la autorización % no es approve', NEW.authorization_id;
  END IF;
  IF auth.product_id <> NEW.product_id THEN
    RAISE EXCEPTION 'CAZA: la autorización % es de otro producto', NEW.authorization_id;
  END IF;
  IF auth.expira_en <= NOW() THEN
    RAISE EXCEPTION 'CAZA: la autorización % expiró', NEW.authorization_id;
  END IF;
  IF auth.consumido_en IS NOT NULL THEN
    RAISE EXCEPTION 'CAZA: la autorización % ya fue consumida', NEW.authorization_id;
  END IF;
  IF NEW.precio_final IS NOT NULL AND NEW.precio_final > auth.precio_maximo THEN
    RAISE EXCEPTION 'CAZA: precio % excede el tope autorizado %', NEW.precio_final, auth.precio_maximo;
  END IF;
  UPDATE caza_purchase_authorizations SET consumido_en = NOW() WHERE id = NEW.authorization_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_requires_valid_authorization
BEFORE INSERT ON caza_purchase_orders
FOR EACH ROW EXECUTE FUNCTION caza_check_order_authorization();

-- 3) Interruptor global en base de datos: mientras sea 'false', ningún INSERT en órdenes prospera.
CREATE TABLE caza_settings (
  clave  TEXT PRIMARY KEY,
  valor  TEXT NOT NULL,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO caza_settings (clave, valor) VALUES ('purchases_enabled', 'false');

CREATE OR REPLACE FUNCTION caza_check_purchases_enabled() RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE((SELECT valor FROM caza_settings WHERE clave = 'purchases_enabled'), 'false') <> 'true' THEN
    RAISE EXCEPTION 'CAZA: las compras están deshabilitadas (caza_settings.purchases_enabled=false)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Se evalúa antes que la autorización para no consumirla si el interruptor está apagado.
CREATE TRIGGER trg_a_purchases_enabled
BEFORE INSERT ON caza_purchase_orders
FOR EACH ROW EXECUTE FUNCTION caza_check_purchases_enabled();

-- 4) Audit log inmutable
CREATE OR REPLACE FUNCTION caza_audit_immutable() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'CAZA: caza_audit_log es inmutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_no_update BEFORE UPDATE OR DELETE ON caza_audit_log
FOR EACH ROW EXECUTE FUNCTION caza_audit_immutable();
