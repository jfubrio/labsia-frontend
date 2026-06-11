# LABSIA — DOC 19 — DASHBOARD FRONTEND
## Next.js 14 con App Router, Tailwind y React Query

---

**Prerrequisito:** DOC 18 completado (backend API funciona)
**Entregable:** Operador gestiona 50 leads desde el navegador sin problemas
**Tiempo estimado:** 5 días

---

## ESTACK Y STACK

```
Framework:   Next.js 14 (App Router)
Estilos:     Tailwind CSS + shadcn/ui
Datos:       @tanstack/react-query (polling 30s)
Auth:        JWT en httpOnly cookie + access token en memoria
Forms:       react-hook-form + zod
Deploy:      Vercel (dashboard.labsia.mx)
```

---

## ESTRUCTURA DEL REPO

Contenido completo en **`labsia_fases3_4_spec.md` sección 3A** (líneas 40-76).

```
labsia-dashboard/
├── app/
│   ├── layout.tsx                       # Root layout
│   ├── providers.tsx                    # QueryClient + Theme
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                   # Sidebar + header
│   │   ├── page.tsx                     # → /leads
│   │   ├── leads/
│   │   │   ├── page.tsx                 # Tablero
│   │   │   └── [id]/page.tsx            # Detalle
│   │   ├── metricas/page.tsx
│   │   └── configuracion/page.tsx
├── components/
│   ├── leads/
│   │   ├── LeadBoard.tsx
│   │   ├── LeadCard.tsx
│   │   ├── LeadDetail.tsx
│   │   ├── MessageHistory.tsx
│   │   ├── QuickReply.tsx
│   │   └── StatusBadge.tsx
│   ├── metrics/
│   │   ├── StatCard.tsx
│   │   └── LeadsByChannel.tsx
│   └── ui/                              # shadcn/ui
├── hooks/
│   ├── useLeads.ts
│   ├── useLead.ts
│   └── useMetrics.ts
├── lib/
│   ├── api.ts                           # Cliente HTTP con auth
│   ├── auth.ts                          # JWT helpers
│   └── utils.ts
├── tailwind.config.ts
└── next.config.js
```

---

## 1. SETUP DEL PROYECTO

```bash
# Crear proyecto Next.js
npx create-next-app@latest labsia-dashboard \
  --typescript --tailwind --app --no-src-dir --use-npm

cd labsia-dashboard

# Dependencias adicionales
npm install @tanstack/react-query @tanstack/react-query-devtools \
            zod react-hook-form @hookform/resolvers \
            lucide-react clsx tailwind-merge \
            date-fns sonner

# shadcn/ui
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input dialog dropdown-menu \
                          badge tabs select textarea toast
```

---

## 2. CLIENTE API CON AUTH

```typescript
// lib/api.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL!

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...options.headers,
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',   // para cookies httpOnly
  })

  // Si expiró el access token, intentar refresh
  if (res.status === 401 && accessToken) {
    const refreshed = await refreshToken()
    if (refreshed) {
      return request(path, options)   // retry
    } else {
      window.location.href = '/login'
      throw new Error('Sesión expirada')
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }

  return res.json()
}

async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) return false
    const data = await res.json()
    accessToken = data.access_token
    return true
  } catch {
    return false
  }
}

// ─── API METHODS ───────────────────────

export const api = {
  auth: {
    login: (email: string, password: string, tenantSlug: string) =>
      request<{ access_token: string; user: any }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, tenant_slug: tenantSlug }),
      }),

    logout: () => request<{ ok: boolean }>('/api/v1/auth/logout', { method: 'POST' }),
  },

  leads: {
    list: (params: any = {}) => {
      const query = new URLSearchParams(params).toString()
      return request<{ items: any[]; pagination: any }>(`/api/v1/leads?${query}`)
    },

    detail: (id: string) => request<any>(`/api/v1/leads/${id}`),

    updateEstado: (id: string, estado: string) =>
      request<{ ok: boolean }>(`/api/v1/leads/${id}/estado`, {
        method: 'PUT',
        body: JSON.stringify({ estado }),
      }),

    sendMessage: (id: string, texto: string) =>
      request<{ ok: boolean; enviado: boolean }>(`/api/v1/leads/${id}/mensaje`, {
        method: 'POST',
        body: JSON.stringify({ texto }),
      }),
  },

  metrics: {
    get: () => request<any>('/api/v1/metricas'),
  },
}
```

---

## 3. HOOK CON POLLING

Contenido base en **`labsia_fases3_4_spec.md` sección 3A** (líneas 212-256).

```typescript
// hooks/useLeads.ts

'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useLeads(filtros: any = {}) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['leads', filtros],
    queryFn: () => api.leads.list(filtros),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  })

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: api.metrics.get,
    refetchInterval: 60_000,
  })

  // Optimistic update para cambio de estado
  const cambiarEstado = useMutation({
    mutationFn: ({ leadId, estado }: { leadId: string; estado: string }) =>
      api.leads.updateEstado(leadId, estado),
    onMutate: async ({ leadId, estado }) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] })
      const previous = queryClient.getQueryData(['leads', filtros])
      queryClient.setQueryData(['leads', filtros], (old: any) => ({
        ...old,
        items: old?.items?.map((l: any) =>
          l.id === leadId ? { ...l, estado } : l
        ),
      }))
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['leads', filtros], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })

  return {
    leads: data?.items ?? [],
    pagination: data?.pagination,
    metrics,
    isLoading,
    cambiarEstado: cambiarEstado.mutate,
  }
}
```

---

## 4. COMPONENTES PRINCIPALES

### LeadBoard (Kanban)

```typescript
// components/leads/LeadBoard.tsx

'use client'
import { LeadCard } from './LeadCard'
import type { Lead } from '@/lib/types'

const COLUMNAS = [
  { id: 'nuevo',         label: 'Nuevo',         color: 'bg-blue-500'   },
  { id: 'en_gestion',    label: 'En Gestión',    color: 'bg-yellow-500' },
  { id: 'sin_respuesta', label: 'Sin Respuesta', color: 'bg-orange-500' },
  { id: 'perdido',       label: 'Perdido',       color: 'bg-red-500'    },
  { id: 'ganado',        label: 'Ganado',        color: 'bg-green-500'  },
]

export function LeadBoard({ leads, isLoading }: { leads: Lead[]; isLoading: boolean }) {
  if (isLoading) return <div>Cargando...</div>

  return (
    <div className="grid grid-cols-5 gap-4 flex-1">
      {COLUMNAS.map(col => {
        const items = leads.filter(l => l.estado === col.id)
        return (
          <div key={col.id} className="flex flex-col">
            <div className={`${col.color} text-white px-3 py-2 rounded-t-lg text-sm font-semibold`}>
              {col.label} ({items.length})
            </div>
            <div className="flex-1 bg-gray-50 p-2 rounded-b-lg overflow-y-auto space-y-2">
              {items.map(lead => <LeadCard key={lead.id} lead={lead} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

### LeadCard

```typescript
// components/leads/LeadCard.tsx

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export function LeadCard({ lead }: { lead: any }) {
  return (
    <Link href={`/leads/${lead.id}`}>
      <div className="bg-white rounded p-3 shadow-sm border hover:shadow-md cursor-pointer">
        <div className="flex justify-between items-start mb-2">
          <p className="font-semibold text-sm">{lead.nombre ?? lead.telefono}</p>
          {lead.prioridad === 'vip' && <Badge variant="destructive">⚡ VIP</Badge>}
          {lead.prioridad === 'alta' && <Badge variant="secondary">🟡</Badge>}
        </div>
        <p className="text-xs text-gray-600">
          {lead.canalPrimario} · {lead.servicioDetectado ?? 'sin servicio'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {formatDistanceToNow(new Date(lead.creadoEn), { locale: es, addSuffix: true })}
        </p>
      </div>
    </Link>
  )
}
```

### QuickReply

Contenido base en **`labsia_fases3_4_spec.md` líneas 166-210**.

```typescript
// components/leads/QuickReply.tsx

'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

export function QuickReply({ leadId }: { leadId: string }) {
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!texto.trim()) return
    setSending(true)
    try {
      const r = await api.leads.sendMessage(leadId, texto)
      if (r.enviado) {
        setTexto('')
        toast.success('Mensaje enviado')
      } else {
        toast.error('Falló el envío')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex gap-2 p-4 border-t">
      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
          }
        }}
        placeholder="Escribe tu respuesta..."
        className="flex-1 resize-none rounded-lg border p-3 text-sm"
        rows={2}
      />
      <button
        onClick={handleSend}
        disabled={sending || !texto.trim()}
        className="bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {sending ? '...' : 'Enviar'}
      </button>
    </div>
  )
}
```

---

## 5. PÁGINA DE LOGIN

```typescript
// app/(auth)/login/page.tsx

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, setAccessToken } from '@/lib/api'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const data = new FormData(e.currentTarget)
    try {
      const result = await api.auth.login(
        data.get('email') as string,
        data.get('password') as string,
        data.get('tenant_slug') as string,
      )
      setAccessToken(result.access_token)
      router.push('/leads')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-96 space-y-4">
        <h1 className="text-2xl font-bold">LabsIA Dashboard</h1>
        <input name="tenant_slug" placeholder="Negocio (slug)" required className="w-full border p-2 rounded" />
        <input name="email" type="email" placeholder="Email" required className="w-full border p-2 rounded" />
        <input name="password" type="password" placeholder="Contraseña" required className="w-full border p-2 rounded" />
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Iniciando...' : 'Iniciar sesión'}
        </button>
      </form>
    </div>
  )
}
```

---

## 6. VARIABLES DE ENTORNO

```bash
# .env.local (dashboard)
NEXT_PUBLIC_API_URL=http://localhost:3000

# En Vercel
NEXT_PUBLIC_API_URL=https://api.labsia.mx
```

---

## 7. VALIDACIÓN

```
□ Login funciona con usuario válido (creado en DOC 18)
□ Login falla con credenciales inválidas
□ Logout limpia sesión
□ Acceso a /leads sin login redirige a /login
□ Tablero Kanban muestra leads en columnas por estado
□ Polling cada 30s actualiza datos automáticamente
□ Click en lead abre vista de detalle
□ Vista de detalle muestra historial de mensajes
□ Envío de mensaje desde QuickReply funciona
□ Cambio de estado (drag o select) actualiza la DB
□ Refresh token funciona cuando access token expira
□ Mobile responsive (probar en iPhone width 375px)
□ Operador puede gestionar 50 leads en un turno completo
```

---

## SIGUIENTE PASO

→ **DOC 20 — Resiliencia y monitoreo**

---

*DOC 19 — Dashboard frontend v1.0*
