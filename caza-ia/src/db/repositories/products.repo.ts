import type { Db } from '../client.js'
import { num } from '../client.js'
import type { ProductConfig, Market, Currency } from '../../types.js'

export interface ProductRow extends ProductConfig {
  id: string
}

export async function listProducts(db: Db, opts: { soloVigilados?: boolean } = {}): Promise<ProductRow[]> {
  const { rows } = await db.query(
    `SELECT p.id, p.slug, p.nombre, p.marca, p.modelo, p.moneda_base,
            w.precio_lista_informativo, w.precio_objetivo, w.precio_maximo, w.umbral_descuento_pct,
            w.mercados, w.mercados_compra, w.requiere_aprobacion, w.vigilancia_activa, w.intervalo_minutos
       FROM caza_products p
       JOIN caza_watch_configs w ON w.product_id = p.id
      WHERE p.estado = 'activo' ${opts.soloVigilados ? 'AND w.vigilancia_activa' : ''}
      ORDER BY p.slug`,
  )
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    nombre: r.nombre,
    marca: r.marca ?? '',
    modelo: r.modelo ?? '',
    monedaBase: r.moneda_base.trim() as Currency,
    precioListaInformativo: num(r.precio_lista_informativo),
    precioObjetivo: num(r.precio_objetivo),
    precioMaximo: num(r.precio_maximo)!,
    umbralDescuentoPct: num(r.umbral_descuento_pct)!,
    mercados: r.mercados as Market[],
    mercadosCompra: r.mercados_compra as Market[],
    requiereAprobacion: r.requiere_aprobacion,
    vigilanciaActiva: r.vigilancia_activa,
    intervaloMinutos: r.intervalo_minutos,
  }))
}

export async function getProductBySlug(db: Db, slug: string): Promise<ProductRow> {
  const all = await listProducts(db)
  const p = all.find((x) => x.slug === slug)
  if (!p) throw new Error(`CAZA: producto '${slug}' no existe en la base de datos`)
  return p
}

export async function setWatchActive(db: Db, slug: string, activa: boolean): Promise<void> {
  await db.query(
    `UPDATE caza_watch_configs w SET vigilancia_activa = $2 FROM caza_products p WHERE p.id = w.product_id AND p.slug = $1`,
    [slug, activa],
  )
}

export async function connectorIdsByClave(db: Db): Promise<Map<string, string>> {
  const { rows } = await db.query(`SELECT id, clave FROM caza_connectors`)
  return new Map(rows.map((r) => [r.clave as string, r.id as string]))
}

export async function buzonIdByClave(db: Db, clave: string): Promise<string | null> {
  const { rows } = await db.query(`SELECT id FROM caza_buzones WHERE clave = $1`, [clave])
  return rows[0]?.id ?? null
}
