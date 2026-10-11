/**
 * Alertas al operador. Un evento se envía a todos los canales configurados; cada envío se registra (enviado o
 * fallido) para que la fase 7 pueda demostrar que las alertas disparan. Un canal que falla nunca detiene la
 * vigilancia: se registra y se sigue.
 *
 *  - console:  siempre disponible; imprime.
 *  - webhook:  POST JSON genérico ({titulo, cuerpo, evento, producto, datos}) a CAZA_NOTIFY_WEBHOOK_URL. Sirve para
 *              Apprise (/notify), ntfy, Slack/Discord incoming webhooks o un escenario de Make.
 *  - telegram: Bot API sendMessage con TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID.
 */
export type NotifyEvent = 'proposal.created' | 'proposal.expired' | 'watch.error' | 'spend.limit'

export interface Notification {
  evento: NotifyEvent
  titulo: string
  cuerpo: string
  productSlug?: string
  datos?: Record<string, unknown>
}

export interface Notifier {
  readonly canal: 'console' | 'webhook' | 'telegram'
  send(n: Notification): Promise<void>
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number }>

export interface NotifierConfig {
  webhookUrl?: string
  telegramBotToken?: string
  telegramChatId?: string
  fetchImpl?: FetchLike
  timeoutMs?: number
  log?: (line: string) => void
}

async function postJson(fetchImpl: FetchLike, url: string, body: unknown, timeoutMs: number): Promise<void> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } finally {
    clearTimeout(t)
  }
}

export function createNotifiers(cfg: NotifierConfig): Notifier[] {
  const fetchImpl: FetchLike = cfg.fetchImpl ?? ((url, init) => fetch(url, init))
  const timeoutMs = cfg.timeoutMs ?? 5_000
  const log = cfg.log ?? ((line) => console.log(line))
  const list: Notifier[] = [
    {
      canal: 'console',
      async send(n) {
        log(`[alerta ${n.evento}] ${n.titulo} — ${n.cuerpo}`)
      },
    },
  ]
  if (cfg.webhookUrl) {
    const url = cfg.webhookUrl
    list.push({
      canal: 'webhook',
      send: (n) => postJson(fetchImpl, url, { titulo: n.titulo, cuerpo: n.cuerpo, evento: n.evento, producto: n.productSlug ?? null, datos: n.datos ?? {} }, timeoutMs),
    })
  }
  if (cfg.telegramBotToken && cfg.telegramChatId) {
    const url = `https://api.telegram.org/bot${cfg.telegramBotToken}/sendMessage`
    const chatId = cfg.telegramChatId
    list.push({
      canal: 'telegram',
      send: (n) => postJson(fetchImpl, url, { chat_id: chatId, text: `${n.titulo}\n${n.cuerpo}`, disable_web_page_preview: true }, timeoutMs),
    })
  }
  return list
}

export interface NotifyOutcome {
  canal: Notifier['canal']
  estado: 'enviada' | 'fallida'
  error?: string
}

/** Envía a todos los canales y devuelve el resultado por canal. Nunca lanza. */
export async function notifyAll(notifiers: Notifier[], n: Notification): Promise<NotifyOutcome[]> {
  return Promise.all(
    notifiers.map(async (nt): Promise<NotifyOutcome> => {
      try {
        await nt.send(n)
        return { canal: nt.canal, estado: 'enviada' }
      } catch (err) {
        return { canal: nt.canal, estado: 'fallida', error: (err as Error).message }
      }
    }),
  )
}

export function proposalNotification(p: { productSlug: string; productNombre: string; precio: number; moneda: string; precioAterrizadoBase: number; monedaBase: string; buzon: string | null; veredicto: string; tienda: string; expiraEn: Date; proposalId: string }): Notification {
  const via = p.buzon ? ` vía ${p.buzon} (aterrizado ${p.precioAterrizadoBase} ${p.monedaBase})` : ''
  return {
    evento: 'proposal.created',
    titulo: `CAZA IA: propuesta para ${p.productNombre}`,
    cuerpo: `${p.tienda}: ${p.precio} ${p.moneda}${via}. Veredicto ${p.veredicto}. Requiere approve antes de ${p.expiraEn.toISOString()}.`,
    productSlug: p.productSlug,
    datos: { proposalId: p.proposalId, precio: p.precio, moneda: p.moneda, precioAterrizadoBase: p.precioAterrizadoBase, veredicto: p.veredicto },
  }
}
