import { defaultFetch, fetchJson, type HttpFetch } from '../connectors/http.js'

/**
 * Tipo de cambio USD→MXN (fase 4). Fuente primaria: Banxico SIE (FIX oficial, serie SF43718, token gratuito).
 * Respaldo: Frankfurter (agregador de bancos centrales, sin clave, autoalojable). Último recurso: valor fijo del entorno.
 */
export interface FxQuote {
  base: 'USD'
  quote: 'MXN'
  rate: number
  /** Fecha del dato según la fuente (YYYY-MM-DD). */
  fecha: string
  fuente: 'banxico' | 'frankfurter' | 'fijo'
}

export interface FxProvider {
  readonly fuente: FxQuote['fuente']
  latest(now: Date): Promise<FxQuote>
}

const toIsoDate = (ddmmyyyy: string): string => {
  const [d, m, y] = ddmmyyyy.split('/')
  return `${y}-${m}-${d}`
}

/** Banxico SIE REST. Cabecera Bmx-Token. SF43718 = FIX (fecha de determinación). */
export class BanxicoProvider implements FxProvider {
  readonly fuente = 'banxico' as const
  constructor(
    private readonly token: string,
    private readonly fetchImpl: HttpFetch = defaultFetch,
    private readonly baseUrl = 'https://www.banxico.org.mx/SieAPIRest/service/v1',
  ) {
    if (!token) throw new Error('CAZA: Banxico requiere BANXICO_TOKEN')
  }
  async latest(_now: Date): Promise<FxQuote> {
    const data = await fetchJson<{ bmx: { series: { idSerie: string; datos: { fecha: string; dato: string }[] }[] } }>(this.fetchImpl, `${this.baseUrl}/series/SF43718/datos/oportuno`, {
      headers: { 'Bmx-Token': this.token, accept: 'application/json' },
    })
    const dato = data.bmx?.series?.[0]?.datos?.[0]
    const rate = Number(dato?.dato)
    if (!dato || !(rate > 0)) throw new Error('CAZA: Banxico no devolvió un dato oportuno para SF43718')
    return { base: 'USD', quote: 'MXN', rate, fecha: toIsoDate(dato.fecha), fuente: 'banxico' }
  }
}

/** Frankfurter: GET {base}/latest?base=USD&symbols=MXN → { date, rates: { MXN } }. */
export class FrankfurterProvider implements FxProvider {
  readonly fuente = 'frankfurter' as const
  constructor(
    private readonly fetchImpl: HttpFetch = defaultFetch,
    private readonly baseUrl = 'https://api.frankfurter.dev/v1',
  ) {}
  async latest(_now: Date): Promise<FxQuote> {
    const data = await fetchJson<{ date: string; rates: { MXN?: number } }>(this.fetchImpl, `${this.baseUrl}/latest?base=USD&symbols=MXN`)
    const rate = data.rates?.MXN
    if (!rate || !(rate > 0)) throw new Error('CAZA: Frankfurter no devolvió MXN')
    return { base: 'USD', quote: 'MXN', rate, fecha: data.date, fuente: 'frankfurter' }
  }
}

/** Valor fijo del entorno (USD_MXN_RATE): último recurso, siempre marcado como tal. */
export class FixedProvider implements FxProvider {
  readonly fuente = 'fijo' as const
  constructor(private readonly rate: number) {}
  async latest(now: Date): Promise<FxQuote> {
    return { base: 'USD', quote: 'MXN', rate: this.rate, fecha: now.toISOString().slice(0, 10), fuente: 'fijo' }
  }
}
