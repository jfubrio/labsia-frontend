import pg from 'pg'

export type Db = pg.Pool

/** Pool de PostgreSQL. DATABASE_URL es obligatoria para todo lo que persiste (fase 2+). */
export function createDb(databaseUrl: string = process.env.DATABASE_URL ?? ''): Db {
  if (!databaseUrl) throw new Error('CAZA: DATABASE_URL no está definida')
  return new pg.Pool({ connectionString: databaseUrl, max: 5 })
}

export async function withTransaction<T>(db: Db, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/** pg devuelve NUMERIC como texto para no perder precisión; CAZA trabaja con 2 decimales, así que number basta. */
export const num = (v: string | number | null): number | null => (v === null ? null : Number(v))
