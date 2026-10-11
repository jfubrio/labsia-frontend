/**
 * Levanta la API del operador (fase 5). Requiere DATABASE_URL y CAZA_API_TOKEN; REDIS_URL es opcional y, si está,
 * resincroniza el programador BullMQ cuando se activa o desactiva la vigilancia de un producto.
 * Página del operador en /ui. Ningún endpoint compra.
 */
import { createDb } from '../db/client.js'
import { loadEnv, notifierConfigFrom } from '../config/env.js'
import { buildApp } from '../api/app.js'
import { syncSchedulers } from '../watch/scheduler.js'
import { defaultComparisonConfig } from '../engines/international-comparison.js'
import { createNotifiers } from '../notify/notifier.js'

const env = loadEnv()
if (env.CAZA_API_TOKEN.length < 24) {
  throw new Error('CAZA: CAZA_API_TOKEN debe tener al menos 24 caracteres (genera uno con: openssl rand -hex 24)')
}
const db = createDb(env.DATABASE_URL)
const app = buildApp({
  db,
  apiToken: env.CAZA_API_TOKEN,
  onWatchChanged: env.REDIS_URL ? async () => { await syncSchedulers(db, env.REDIS_URL) } : undefined,
  env,
  comparison: defaultComparisonConfig(env.USD_MXN_RATE),
  notifiers: createNotifiers(notifierConfigFrom(env)),
})
const port = env.CAZA_API_PORT
await app.listen({ port, host: '0.0.0.0' })
console.log(`CAZA IA API en http://localhost:${port} (operador en /ui). Compras: ${env.PURCHASES_ENABLED ? 'HABILITADAS' : 'deshabilitadas'}.`)
