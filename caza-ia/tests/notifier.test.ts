import { describe, it, expect } from 'vitest'
import { createNotifiers, notifyAll, proposalNotification, type FetchLike } from '../src/notify/notifier.js'

function fakeFetch(status = 200) {
  const calls: { url: string; body: unknown }[] = []
  const f: FetchLike = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) })
    return { ok: status >= 200 && status < 300, status }
  }
  return { f, calls }
}
const n = proposalNotification({ productSlug: 'sony-wh1000xm6', productNombre: 'Sony WH-1000XM6', precio: 299.99, moneda: 'USD', precioAterrizadoBase: 6100.19, monedaBase: 'MXN', buzon: 'buzon_tx', veredicto: 'minimo_historico', tienda: 'bestbuy_us', expiraEn: new Date('2026-10-12T12:00:00Z'), proposalId: 'p1' })

describe('alertas al operador', () => {
  it('sin configuración solo existe el canal console', async () => {
    const lines: string[] = []
    const ns = createNotifiers({ log: (l) => lines.push(l) })
    expect(ns.map((x) => x.canal)).toEqual(['console'])
    const out = await notifyAll(ns, n)
    expect(out).toEqual([{ canal: 'console', estado: 'enviada' }])
    expect(lines[0]).toMatch(/299.99 USD vía buzon_tx/)
  })

  it('el webhook recibe JSON con título, cuerpo, evento, producto y datos', async () => {
    const { f, calls } = fakeFetch()
    const ns = createNotifiers({ webhookUrl: 'https://hooks.example/caza', fetchImpl: f, log: () => {} })
    const out = await notifyAll(ns, n)
    expect(out.find((o) => o.canal === 'webhook')?.estado).toBe('enviada')
    expect(calls[0]!.url).toBe('https://hooks.example/caza')
    const body = calls[0]!.body as Record<string, unknown>
    expect(body.evento).toBe('proposal.created')
    expect(body.producto).toBe('sony-wh1000xm6')
    expect((body.datos as Record<string, unknown>).proposalId).toBe('p1')
  })

  it('telegram usa la Bot API con el chat configurado', async () => {
    const { f, calls } = fakeFetch()
    const ns = createNotifiers({ telegramBotToken: 'T', telegramChatId: '42', fetchImpl: f, log: () => {} })
    await notifyAll(ns, n)
    expect(calls[0]!.url).toBe('https://api.telegram.org/botT/sendMessage')
    expect((calls[0]!.body as Record<string, unknown>).chat_id).toBe('42')
  })

  it('un canal que falla se reporta como fallido y no tumba a los demás', async () => {
    const { f } = fakeFetch(500)
    const ns = createNotifiers({ webhookUrl: 'https://hooks.example/caza', fetchImpl: f, log: () => {} })
    const out = await notifyAll(ns, n)
    expect(out.find((o) => o.canal === 'console')?.estado).toBe('enviada')
    const wh = out.find((o) => o.canal === 'webhook')!
    expect(wh.estado).toBe('fallida')
    expect(wh.error).toMatch(/HTTP 500/)
  })
})
