/**
 * Estado de los conectores para un producto: validación en DB (fase 0), credenciales en el entorno e identificador.
 * Uso: npm run connectors:status -- [slug]
 */
import { createDb } from '../db/client.js'
import { loadEnv } from '../config/env.js'
import { getProductBySlug } from '../db/repositories/products.repo.js'
import { buildConnectors } from '../connectors/factory.js'

const env = loadEnv()
const db = createDb(env.DATABASE_URL)
const slug = process.argv[2] ?? 'sony-wh1000xm6'
try {
  const product = await getProductBySlug(db, slug)
  const { report } = await buildConnectors(db, product, env)
  console.log(`Conectores para ${product.nombre} (mercados ${product.mercados.join(', ')}):`)
  for (const r of report) {
    console.log(`  ${r.clave.padEnd(16)} ${r.mercado}  validación=${r.estadoValidacion.padEnd(12)} habilitado=${String(r.habilitado).padEnd(5)} credenciales=${String(r.credenciales).padEnd(5)} identificador=${(r.identificador ?? '—').padEnd(14)} → ${r.estado}`)
  }
  const activos = report.filter((r) => r.estado === 'activo').map((r) => r.clave)
  console.log(`activos: ${activos.join(', ') || '(ninguno)'}`)
} finally {
  await db.end()
}
