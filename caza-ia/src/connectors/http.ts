/**
 * Cliente HTTP mínimo e inyectable para los conectores: fetch nativo con tiempo de espera, sin SDKs.
 * Los conectores reciben `fetchImpl` para poder probarse sin red.
 */
export type HttpFetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<HttpResponse>

export interface HttpResponse {
  ok: boolean
  status: number
  text(): Promise<string>
  json(): Promise<unknown>
}

export const defaultFetch: HttpFetch = (url, init) => fetch(url, init)

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly body: string,
  ) {
    super(`HTTP ${status} en ${url}: ${body.slice(0, 200)}`)
    this.name = 'HttpError'
  }
}

export async function fetchJson<T = unknown>(
  fetchImpl: HttpFetch,
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
  timeoutMs = 10_000,
): Promise<T> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal })
    const text = await res.text()
    if (!res.ok) throw new HttpError(res.status, url, text)
    return (text ? JSON.parse(text) : null) as T
  } finally {
    clearTimeout(t)
  }
}

/** Respuesta falsa para pruebas: `fakeFetch({ 'https://x': { status: 200, body: {...} } })`. */
export function fakeFetch(routes: Record<string, { status?: number; body: unknown } | ((init?: { body?: string; headers?: Record<string, string> }) => { status?: number; body: unknown })>): HttpFetch & { calls: { url: string; init?: { method?: string; headers?: Record<string, string>; body?: string } }[] } {
  const calls: { url: string; init?: { method?: string; headers?: Record<string, string>; body?: string } }[] = []
  const f = (async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
    calls.push({ url, init })
    const key = Object.keys(routes).find((k) => url.startsWith(k))
    if (!key) return { ok: false, status: 404, text: async () => 'no route', json: async () => ({}) }
    const r = routes[key]!
    const resp = typeof r === 'function' ? r(init) : r
    const status = resp.status ?? 200
    const text = typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body)
    return { ok: status >= 200 && status < 300, status, text: async () => text, json: async () => JSON.parse(text) }
  }) as HttpFetch & { calls: typeof calls }
  f.calls = calls
  return f
}
