import type { Db } from '../client.js'

export async function startRun(db: Db, productId: string, disparador: 'scheduler' | 'manual', conectores: string[]): Promise<string> {
  const { rows } = await db.query(
    `INSERT INTO caza_watch_runs (product_id, disparador, conectores) VALUES ($1,$2,$3) RETURNING id`,
    [productId, disparador, conectores],
  )
  return rows[0].id as string
}

export async function finishRun(
  db: Db,
  runId: string,
  r: { observaciones: number; veredictos: number; propuestas: number; error?: string },
): Promise<void> {
  await db.query(
    `UPDATE caza_watch_runs SET terminado_en = NOW(), observaciones = $2, veredictos = $3, propuestas = $4,
            estado = $5, error = $6 WHERE id = $1`,
    [runId, r.observaciones, r.veredictos, r.propuestas, r.error ? 'error' : 'ok', r.error ?? null],
  )
}

export async function listRuns(db: Db, productId: string, limit = 10) {
  const { rows } = await db.query(
    `SELECT iniciado_en, terminado_en, disparador, conectores, observaciones, veredictos, propuestas, estado, error
       FROM caza_watch_runs WHERE product_id = $1 ORDER BY iniciado_en DESC LIMIT $2`,
    [productId, limit],
  )
  return rows
}
