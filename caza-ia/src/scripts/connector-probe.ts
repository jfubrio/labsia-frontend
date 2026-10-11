/**
 * Sondeo real de un conector (el día que conectamos): una llamada a la tienda y las ofertas mapeadas, sin persistir.
 * Uso: npm run connector:probe -- <clave> [slug]
 * Requiere DATABASE_URL (identificadores y estado), credenciales del conector en el entorno y que esté validado y habilitado.
 */
import { createDb } from '../db/client.js'
import { loadEnv } from '../config/env.js'
import { getProductBySlug } from '../db/repositories/products.repo.js'
import { buildConnectors } from '../connectors/factory.js'

const clave = process.argv[2]
const slug = process.argv[3] ?? 'sony-wh1000xm6'
if (!clave) {
  console.error('Uso: npm run connector:probe -- <clave> [slug]')
  process.exit(2)
}
const env = loadEnv()
const db = createDb(env.DATABASE_URL)
try {
  const product = await getProductBySlug(db, slug)
  const { connectors, report } = await buildConnectors(db, product, env)
  const r = report.find((x) => x.clave === clave)
  if (!r) throw new Error(`el conector '${clave}' no aplica a los mercados de ${slug}`)
  if (r.estado !== 'activo') throw new Error(`el conector '${clave}' no está activo: ${r.estado}`)
  const c = connectors.find((x) => x.meta.clave === clave)!
  const t0 = Date.now()
  const offers = await c.fetchOffers(slug)
  console.log(`${clave}: ${offers.length} oferta(s) en ${Date.now() - t0} ms`)
  for (const o of offers) console.log(`  ${o.store} ${o.price} ${o.currency} antes=${o.advertisedPreviousPrice ?? '—'} stock=${o.inStock} ${o.seller ?? ''} ${o.url}`)
  if (offers.length === 0) console.log('  (sin ofertas: revisa el identificador del producto en esa tienda)')
} finally {
  await db.end()
}
