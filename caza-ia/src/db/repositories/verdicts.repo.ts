import type { Db } from '../client.js'
import type { DiscountVerdict } from '../../types.js'

export async function insertVerdict(db: Db, v: DiscountVerdict, profileId: string | null): Promise<string> {
  const { rows } = await db.query(
    `INSERT INTO caza_discount_verdicts
       (observation_id, profile_id, veredicto, precio_real, piso, techo, regimen, confianza, ahorro_pct_real, ahorro_pct_anunciado,
        ancla_inflada, lanzamiento_inflado, dias_cubiertos, tiendas, razon)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id`,
    [
      v.observationId, profileId, v.veredicto, v.precioReal, v.piso, v.techo, v.regimen, v.confianza, v.ahorroPctReal, v.ahorroPctAnunciado,
      v.anclaInflada, v.lanzamientoInflado, v.diasCubiertos, v.tiendas, v.razon,
    ],
  )
  return rows[0].id as string
}
