import type { Db } from '../client.js'
import { num } from '../client.js'

/**
 * Métricas agregadas para el dashboard. Una sola función con pocas consultas que devuelve un objeto serializable;
 * el endpoint la expone por HTTP y la empuja por SSE. Todo se lee de la base de datos: no hay estado en memoria.
 */
export interface Metrics {
  generadoEn: string
  compras: { habilitadasEnDb: boolean; ordenesActivas: number; ordenesTotales: number }
  productos: { total: number; vigilados: number }
  propuestas: { pendientes: number; aprobadas30d: number; rechazadas30d: number; expiradas30d: number; ultimas: ProposalMetric[] }
  vigilancia: { corridas24h: number; errores24h: number; observaciones24h: number; ultimaCorrida: string | null; ultimaCorridaEstado: string | null }
  alertas: { enviadas24h: number; fallidas24h: number; ultimas: AlertMetric[] }
  gasto: { monedaBase: string; presupuestoMensual: number; comprometidoMes: number; disponible: number; compromisosMes: number; maxOrdenesMes: number } | null
  porProducto: ProductMetric[]
}

export interface ProposalMetric {
  id: string
  producto: string
  tienda: string | null
  precio: number
  moneda: string
  precioAterrizadoBase: number
  monedaBase: string
  veredicto: string | null
  estado: string
  creadoEn: string
  expiraEn: string
}

export interface AlertMetric {
  enviadoEn: string
  canal: string
  evento: string
  titulo: string
  estado: string
}

export interface MarketMetric {
  mercado: string
  moneda: string
  calculadoEn: string
  precioReal: number | null
  piso: number | null
  techo: number | null
  tendenciaPct: number | null
  regimen: string | null
  confianza: string
  diasObservados: number
  tiendas: string[]
  /** Serie competitiva diaria del último perfil. */
  serie: { day: string; precioMinimo: number; tienda: string }[]
}

export interface ProductMetric {
  slug: string
  nombre: string
  monedaBase: string
  precioMaximo: number
  precioObjetivo: number | null
  /** Objetivo efectivo en moneda base: el manual o el derivado del último perfil del mercado de casa. */
  precioObjetivoEfectivo: number | null
  objetivoDerivado: boolean
  umbralDescuentoPct: number
  vigilanciaActiva: boolean
  intervaloMinutos: number
  propuestasPendientes: number
  ultimaCorrida: string | null
  mercados: MarketMetric[]
}

export async function getMetrics(db: Db, now: Date = new Date()): Promise<Metrics> {
  const [settings, orders, products, proposals, runs, obs24, alerts, limit, spend, lastProposals, lastAlerts] = await Promise.all([
    db.query(`SELECT valor FROM caza_settings WHERE clave = 'purchases_enabled'`),
    db.query(`SELECT count(*) FILTER (WHERE status IN ('pending','authorized','placed'))::int AS activas, count(*)::int AS total FROM caza_purchase_orders`),
    db.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE w.vigilancia_activa)::int AS vigilados FROM caza_products p JOIN caza_watch_configs w ON w.product_id = p.id WHERE p.estado = 'activo'`),
    db.query(
      `SELECT count(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes,
              count(*) FILTER (WHERE estado = 'aprobada' AND decidido_en >= $1::timestamptz - interval '30 days')::int AS aprobadas,
              count(*) FILTER (WHERE estado = 'rechazada' AND decidido_en >= $1::timestamptz - interval '30 days')::int AS rechazadas,
              count(*) FILTER (WHERE estado = 'expirada' AND decidido_en >= $1::timestamptz - interval '30 days')::int AS expiradas
         FROM caza_purchase_proposals`,
      [now],
    ),
    db.query(
      `SELECT count(*) FILTER (WHERE iniciado_en >= $1::timestamptz - interval '24 hours')::int AS corridas,
              count(*) FILTER (WHERE iniciado_en >= $1::timestamptz - interval '24 hours' AND estado = 'error')::int AS errores,
              max(iniciado_en) AS ultima,
              (SELECT estado FROM caza_watch_runs ORDER BY iniciado_en DESC LIMIT 1) AS ultima_estado
         FROM caza_watch_runs`,
      [now],
    ),
    db.query(`SELECT count(*)::int AS n FROM caza_price_observations WHERE observado_en >= $1::timestamptz - interval '24 hours'`, [now]),
    db.query(
      `SELECT count(*) FILTER (WHERE estado = 'enviada')::int AS enviadas, count(*) FILTER (WHERE estado = 'fallida')::int AS fallidas
         FROM caza_notifications WHERE enviado_en >= $1::timestamptz - interval '24 hours'`,
      [now],
    ),
    db.query(`SELECT moneda_base, presupuesto_mensual_base, max_ordenes_mes FROM caza_spend_limits WHERE id = 1`),
    db.query(
      `WITH auths AS (
         SELECT COALESCE(a.precio_aterrizado_base, a.precio_maximo) AS monto FROM caza_purchase_authorizations a
          WHERE a.decision = 'approve' AND a.consumido_en IS NULL AND a.expira_en > $1
            AND date_trunc('month', a.creado_en) = date_trunc('month', $1::timestamptz)
       ), ords AS (
         SELECT COALESCE(o.precio_final, a.precio_aterrizado_base, a.precio_maximo) AS monto
           FROM caza_purchase_orders o JOIN caza_purchase_authorizations a ON a.id = o.authorization_id
          WHERE o.status IN ('pending','authorized','placed') AND date_trunc('month', o.creado_en) = date_trunc('month', $1::timestamptz)
       )
       SELECT (SELECT COALESCE(sum(monto),0) FROM auths) + (SELECT COALESCE(sum(monto),0) FROM ords) AS comprometido,
              (SELECT count(*) FROM auths) + (SELECT count(*) FROM ords) AS compromisos`,
      [now],
    ),
    db.query(
      `SELECT pr.id, p.nombre AS producto, o.tienda, pr.precio, pr.moneda, pr.precio_aterrizado_base, pr.moneda_base, v.veredicto, pr.estado, pr.creado_en, pr.expira_en
         FROM caza_purchase_proposals pr JOIN caza_products p ON p.id = pr.product_id
         JOIN caza_price_observations o ON o.id = pr.observation_id LEFT JOIN caza_discount_verdicts v ON v.id = pr.verdict_id
        ORDER BY pr.creado_en DESC LIMIT 10`,
    ),
    db.query(`SELECT enviado_en, canal, evento, titulo, estado FROM caza_notifications ORDER BY enviado_en DESC LIMIT 10`),
  ])

  const { rows: prodRows } = await db.query(
    `SELECT p.id, p.slug, p.nombre, p.moneda_base, w.precio_maximo, w.precio_objetivo, w.umbral_descuento_pct, w.vigilancia_activa, w.intervalo_minutos,
            (SELECT count(*)::int FROM caza_purchase_proposals x WHERE x.product_id = p.id AND x.estado = 'pendiente') AS pendientes,
            (SELECT max(iniciado_en) FROM caza_watch_runs r WHERE r.product_id = p.id) AS ultima_corrida
       FROM caza_products p JOIN caza_watch_configs w ON w.product_id = p.id WHERE p.estado = 'activo' ORDER BY p.slug`,
  )
  const porProducto: ProductMetric[] = []
  for (const p of prodRows) {
    const { rows: profiles } = await db.query(
      `SELECT DISTINCT ON (mercado) mercado, moneda, calculado_en, precio_real, piso, techo, tendencia_pct, regimen, confianza, dias_observados, tiendas, serie
         FROM caza_market_price_profiles WHERE product_id = $1 ORDER BY mercado, calculado_en DESC`,
      [p.id],
    )
    const monedaBase = p.moneda_base.trim()
    const precioMaximo = num(p.precio_maximo)!
    const precioObjetivo = num(p.precio_objetivo)
    const umbral = num(p.umbral_descuento_pct)!
    const home = profiles.find((m) => m.moneda.trim() === monedaBase)
    const homeReal = home ? num(home.precio_real) : null
    const precioObjetivoEfectivo =
      precioObjetivo !== null ? Math.min(precioObjetivo, precioMaximo) : homeReal !== null ? Math.round(Math.min(homeReal * (1 - umbral / 100), precioMaximo) * 100) / 100 : null
    porProducto.push({
      slug: p.slug,
      nombre: p.nombre,
      monedaBase,
      precioMaximo,
      precioObjetivo,
      precioObjetivoEfectivo,
      objetivoDerivado: precioObjetivo === null,
      umbralDescuentoPct: umbral,
      vigilanciaActiva: p.vigilancia_activa,
      intervaloMinutos: p.intervalo_minutos,
      propuestasPendientes: p.pendientes,
      ultimaCorrida: p.ultima_corrida ? new Date(p.ultima_corrida).toISOString() : null,
      mercados: profiles.map((m) => ({
        mercado: m.mercado.trim(),
        moneda: m.moneda.trim(),
        calculadoEn: new Date(m.calculado_en).toISOString(),
        precioReal: num(m.precio_real),
        piso: num(m.piso),
        techo: num(m.techo),
        tendenciaPct: num(m.tendencia_pct),
        regimen: m.regimen,
        confianza: m.confianza,
        diasObservados: m.dias_observados,
        tiendas: m.tiendas,
        serie: (m.serie as { day: string; precioMinimo: number; tienda: string }[]).map((s) => ({ day: s.day, precioMinimo: s.precioMinimo, tienda: s.tienda })),
      })),
    })
  }

  const lim = limit.rows[0]
  const presupuesto = lim ? num(lim.presupuesto_mensual_base)! : null
  const comprometido = num(spend.rows[0].comprometido)!
  return {
    generadoEn: now.toISOString(),
    compras: { habilitadasEnDb: settings.rows[0]?.valor === 'true', ordenesActivas: orders.rows[0].activas, ordenesTotales: orders.rows[0].total },
    productos: { total: products.rows[0].total, vigilados: products.rows[0].vigilados },
    propuestas: {
      pendientes: proposals.rows[0].pendientes,
      aprobadas30d: proposals.rows[0].aprobadas,
      rechazadas30d: proposals.rows[0].rechazadas,
      expiradas30d: proposals.rows[0].expiradas,
      ultimas: lastProposals.rows.map((r) => ({
        id: r.id,
        producto: r.producto,
        tienda: r.tienda,
        precio: num(r.precio)!,
        moneda: r.moneda.trim(),
        precioAterrizadoBase: num(r.precio_aterrizado_base)!,
        monedaBase: r.moneda_base.trim(),
        veredicto: r.veredicto,
        estado: r.estado,
        creadoEn: new Date(r.creado_en).toISOString(),
        expiraEn: new Date(r.expira_en).toISOString(),
      })),
    },
    vigilancia: {
      corridas24h: runs.rows[0].corridas,
      errores24h: runs.rows[0].errores,
      observaciones24h: obs24.rows[0].n,
      ultimaCorrida: runs.rows[0].ultima ? new Date(runs.rows[0].ultima).toISOString() : null,
      ultimaCorridaEstado: runs.rows[0].ultima_estado ?? null,
    },
    alertas: {
      enviadas24h: alerts.rows[0].enviadas,
      fallidas24h: alerts.rows[0].fallidas,
      ultimas: lastAlerts.rows.map((r) => ({ enviadoEn: new Date(r.enviado_en).toISOString(), canal: r.canal, evento: r.evento, titulo: r.titulo, estado: r.estado })),
    },
    gasto: lim
      ? {
          monedaBase: lim.moneda_base.trim(),
          presupuestoMensual: presupuesto!,
          comprometidoMes: comprometido,
          disponible: Math.round((presupuesto! - comprometido) * 100) / 100,
          compromisosMes: Number(spend.rows[0].compromisos),
          maxOrdenesMes: lim.max_ordenes_mes,
        }
      : null,
    porProducto,
  }
}
