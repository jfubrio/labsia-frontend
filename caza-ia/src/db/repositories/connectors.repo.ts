import type { Db } from '../client.js'
import type { Market, Currency } from '../../types.js'
import type { ValidationStatus } from '../../connectors/types.js'

export interface ConnectorRow {
  id: string
  clave: string
  nombre: string
  mercado: Market
  moneda: Currency
  tipo: 'mock' | 'api' | 'scraping'
  soportaCompra: boolean
  estadoValidacion: ValidationStatus
  notasValidacion: string | null
  habilitado: boolean
}

export async function listConnectors(db: Db): Promise<ConnectorRow[]> {
  const { rows } = await db.query(`SELECT id, clave, nombre, mercado, moneda, tipo, soporta_compra, estado_validacion, notas_validacion, habilitado FROM caza_connectors ORDER BY mercado, clave`)
  return rows.map((r) => ({
    id: r.id,
    clave: r.clave,
    nombre: r.nombre,
    mercado: r.mercado.trim() as Market,
    moneda: r.moneda.trim() as Currency,
    tipo: r.tipo,
    soportaCompra: r.soporta_compra,
    estadoValidacion: r.estado_validacion,
    notasValidacion: r.notas_validacion,
    habilitado: r.habilitado,
  }))
}

/** Cierre de fase 0 por conector: estado de validación con evidencia en notas, y si queda habilitado. */
export async function setConnectorValidation(
  db: Db,
  clave: string,
  v: { estadoValidacion: ValidationStatus; notas: string; habilitado: boolean },
): Promise<ConnectorRow> {
  const { rowCount } = await db.query(
    `UPDATE caza_connectors SET estado_validacion = $2, notas_validacion = $3, habilitado = $4 WHERE clave = $1`,
    [clave, v.estadoValidacion, v.notas, v.habilitado && v.estadoValidacion === 'validado'],
  )
  if (!rowCount) throw new Error(`CAZA: conector '${clave}' no existe`)
  return (await listConnectors(db)).find((c) => c.clave === clave)!
}

/** Identificadores de un producto por conector: { bestbuy_us: '6505727', amazon_mx: 'B0F3...' }. */
export async function identifiersFor(db: Db, productId: string): Promise<Record<string, string>> {
  const { rows } = await db.query(
    `SELECT c.clave, i.identificador FROM caza_product_identifiers i JOIN caza_connectors c ON c.id = i.connector_id WHERE i.product_id = $1`,
    [productId],
  )
  return Object.fromEntries(rows.map((r) => [r.clave, r.identificador]))
}

export async function setIdentifiers(db: Db, productId: string, ids: Record<string, string>): Promise<Record<string, string>> {
  for (const [clave, identificador] of Object.entries(ids)) {
    const { rows } = await db.query(`SELECT id FROM caza_connectors WHERE clave = $1`, [clave])
    if (!rows[0]) throw new Error(`CAZA: conector '${clave}' no existe`)
    if (!identificador) {
      await db.query(`DELETE FROM caza_product_identifiers WHERE product_id = $1 AND connector_id = $2`, [productId, rows[0].id])
      continue
    }
    await db.query(
      `INSERT INTO caza_product_identifiers (product_id, connector_id, identificador) VALUES ($1, $2, $3)
       ON CONFLICT (product_id, connector_id) DO UPDATE SET identificador = EXCLUDED.identificador, actualizado_en = NOW()`,
      [productId, rows[0].id, identificador],
    )
  }
  return identifiersFor(db, productId)
}
