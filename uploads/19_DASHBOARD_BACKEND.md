# LABSIA — DOC 18 — DASHBOARD BACKEND API
## Endpoints REST para que el operador gestione leads

---

**Prerrequisito:** DOC 17 completado (Fase 2 cerrada)
**Entregable:** Dashboard puede llamar GET/PUT/POST de leads con auth JWT
**Tiempo estimado:** 3 días

---

## ESTRUCTURA

```
src/modules/
├── auth/
│   ├── auth.route.ts               # POST /api/v1/auth/login, /refresh, /logout
│   └── auth.service.ts             # bcrypt + JWT
└── leads/
    ├── leads.route.ts              # GET /leads, GET /:id, PUT /:id/estado, POST /:id/mensaje
    └── metrics.route.ts            # GET /metricas
```

---

## 1. AUTENTICACIÓN

### Migración: usuarios del dashboard

```sql
-- src/db/migrations/004_dashboard_users.sql

CREATE TABLE dashboard_users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  nombre          TEXT NOT NULL,
  rol             TEXT NOT NULL DEFAULT 'operador',  -- admin | operador
  operador_id     UUID REFERENCES operadores(id),    -- vínculo si es operador
  ultimo_login    TIMESTAMPTZ,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, email)
);

ALTER TABLE dashboard_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dashboard_users
  USING (tenant_id = current_setting('app.tenant_id', true)::UUID);
```

### Auth service

```typescript
// src/modules/auth/auth.service.ts

import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { db } from '@/config/database'
import { dashboardUsers } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { env } from '@/config/env'

export async function login(email: string, password: string, tenantSlug: string) {
  // 1. Buscar tenant
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug))
  if (!tenant) throw new Error('Tenant not found')

  // 2. Buscar usuario
  const [user] = await db.select().from(dashboardUsers)
    .where(and(
      eq(dashboardUsers.tenantId, tenant.id),
      eq(dashboardUsers.email, email)
    ))
  if (!user) throw new Error('Credenciales inválidas')

  // 3. Verificar password
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw new Error('Credenciales inválidas')

  // 4. Generar tokens
  const accessToken = jwt.sign({
    userId: user.id,
    tenantId: tenant.id,
    rol: user.rol,
    operadorId: user.operadorId,
  }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN })

  const refreshToken = jwt.sign({
    userId: user.id,
    type: 'refresh',
  }, env.JWT_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN })

  // 5. Actualizar último login
  await db.update(dashboardUsers)
    .set({ ultimoLogin: new Date() })
    .where(eq(dashboardUsers.id, user.id))

  return { accessToken, refreshToken, user: { id: user.id, nombre: user.nombre, rol: user.rol } }
}

export async function refresh(refreshToken: string) {
  const decoded = jwt.verify(refreshToken, env.JWT_SECRET) as any
  if (decoded.type !== 'refresh') throw new Error('Invalid token type')

  const [user] = await db.select().from(dashboardUsers)
    .where(eq(dashboardUsers.id, decoded.userId))
  if (!user) throw new Error('User not found')

  const accessToken = jwt.sign({
    userId: user.id,
    tenantId: user.tenantId,
    rol: user.rol,
    operadorId: user.operadorId,
  }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN })

  return { accessToken }
}
```

### Auth route

```typescript
// src/modules/auth/auth.route.ts

export async function authRoutes(app: FastifyInstance) {

  app.post('/auth/login', async (req, reply) => {
    const { email, password, tenant_slug } = req.body as any
    try {
      const result = await login(email, password, tenant_slug)

      // Set refresh token en cookie httpOnly (más seguro que localStorage)
      reply.setCookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })

      return reply.send({
        access_token: result.accessToken,
        user: result.user,
      })
    } catch (err: any) {
      return reply.status(401).send({ error: err.message })
    }
  })

  app.post('/auth/refresh', async (req, reply) => {
    const token = req.cookies.refresh_token
    if (!token) return reply.status(401).send({ error: 'No refresh token' })
    try {
      const { accessToken } = await refresh(token)
      return reply.send({ access_token: accessToken })
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' })
    }
  })

  app.post('/auth/logout', async (req, reply) => {
    reply.clearCookie('refresh_token')
    return reply.send({ ok: true })
  })
}
```

---

## 2. ENDPOINTS DE LEADS

Contenido base en **`labsia_fases3_4_spec.md` sección 3A** (líneas 260-323).

```typescript
// src/modules/leads/leads.route.ts

import { z } from 'zod'
import { db } from '@/config/database'
import { leads, mensajes } from '@/db/schema'
import { eq, and, gte, lte, desc, count, sql } from 'drizzle-orm'
import { jwtAuth } from '@/middleware/auth'
import { tenantMiddleware } from '@/middleware/tenant'
import { validarTransicion } from './state-machine'
import { sendWhatsAppMessage } from '@/modules/messaging/sender.service'
import { recordMessage } from './messages.service'
import { followupQueue } from '@/config/redis'

export async function leadsRoutes(app: FastifyInstance) {

  app.addHook('preHandler', jwtAuth)
  app.addHook('preHandler', tenantMiddleware)

  // ─────────────────────────────────────
  // GET /api/v1/leads — lista paginada
  // ─────────────────────────────────────
  app.get('/leads', async (req, reply) => {
    const q = z.object({
      estado: z.string().optional(),
      canal: z.string().optional(),
      desde: z.string().optional(),
      hasta: z.string().optional(),
      page: z.coerce.number().default(1),
      limit: z.coerce.number().max(100).default(50),
    }).parse(req.query)

    const tenantId = (req as any).user.tenantId
    const offset = (q.page - 1) * q.limit

    const conditions = [eq(leads.tenantId, tenantId)]
    if (q.estado) conditions.push(eq(leads.estado, q.estado))
    if (q.canal) conditions.push(eq(leads.canalPrimario, q.canal))
    if (q.desde) conditions.push(gte(leads.creadoEn, new Date(q.desde)))
    if (q.hasta) conditions.push(lte(leads.creadoEn, new Date(q.hasta)))

    const where = and(...conditions)

    const [items, [{ total }]] = await Promise.all([
      db.select().from(leads).where(where).orderBy(desc(leads.creadoEn))
        .limit(q.limit).offset(offset),
      db.select({ total: count() }).from(leads).where(where),
    ])

    return reply.send({
      items,
      pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
    })
  })

  // ─────────────────────────────────────
  // GET /api/v1/leads/:id — detalle + historial
  // ─────────────────────────────────────
  app.get('/leads/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const tenantId = (req as any).user.tenantId

    const [lead] = await db.select().from(leads)
      .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))

    if (!lead) return reply.status(404).send({ error: 'Lead not found' })

    const historial = await db.select().from(mensajes)
      .where(and(eq(mensajes.leadId, id), eq(mensajes.tenantId, tenantId)))
      .orderBy(desc(mensajes.enviadoEn))
      .limit(100)

    return reply.send({ ...lead, mensajes: historial })
  })

  // ─────────────────────────────────────
  // PUT /api/v1/leads/:id/estado — cambiar estado
  // ─────────────────────────────────────
  app.put('/leads/:id/estado', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { estado } = req.body as { estado: string }
    const tenantId = (req as any).user.tenantId

    const [lead] = await db.select().from(leads).where(eq(leads.id, id))
    if (!lead) return reply.status(404).send({ error: 'Lead not found' })

    try {
      validarTransicion(lead.estado as any, estado as any)
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }

    // Cancelar jobs futuros si pasa a estado de no seguimiento
    if (['en_gestion', 'ganado', 'descartado'].includes(estado)) {
      const job = await followupQueue.getJob(`followup-A6-${id}`)
      if (job) await job.remove()
      const b1 = await followupQueue.getJob(`followup-B1-${id}`)
      if (b1) await b1.remove()
      const b2 = await followupQueue.getJob(`followup-B2-${id}`)
      if (b2) await b2.remove()
    }

    await db.update(leads)
      .set({ estado, actualizadoEn: new Date() })
      .where(and(eq(leads.id, id), eq(leads.tenantId, tenantId)))

    return reply.send({ ok: true })
  })

  // ─────────────────────────────────────
  // POST /api/v1/leads/:id/mensaje — respuesta manual desde dashboard
  // ─────────────────────────────────────
  app.post('/leads/:id/mensaje', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { texto } = req.body as { texto: string }
    const tenantId = (req as any).user.tenantId

    if (!texto?.trim()) {
      return reply.status(400).send({ error: 'Texto vacío' })
    }

    const [lead] = await db.select().from(leads).where(eq(leads.id, id))
    if (!lead) return reply.status(404).send({ error: 'Lead not found' })

    const config = await getTenantConfig(tenantId)

    const result = await sendWhatsAppMessage(
      lead.telefono!, texto, config.canales.whatsapp_phone_id
    )

    await recordMessage({
      leadId: id, tenantId,
      direccion: 'saliente', canal: 'whatsapp', tipo: 'humano',
      contenido: texto,
      metaMessageId: result.message_id,
      entregado: result.success,
      error: result.error,
    })

    // Cambio automático de estado al responder manualmente
    if (['nuevo', 'sin_respuesta'].includes(lead.estado)) {
      await db.update(leads).set({ estado: 'en_gestion' }).where(eq(leads.id, id))

      // Cancelar A6 si estaba pendiente
      const a6 = await followupQueue.getJob(`followup-A6-${id}`)
      if (a6) await a6.remove()
    }

    return reply.send({ ok: true, enviado: result.success, error: result.error })
  })
}
```

---

## 3. METRICS ROUTE

```typescript
// src/modules/leads/metrics.route.ts

export async function metricsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', jwtAuth)

  app.get('/metricas', async (req, reply) => {
    const tenantId = (req as any).user.tenantId

    const desde = sql`NOW() - INTERVAL '24 hours'`

    const [
      leadsHoy,
      enGestion,
      ganadosHoy,
      tiempoRespPromedio,
    ] = await Promise.all([
      db.select({ c: count() }).from(leads)
        .where(and(eq(leads.tenantId, tenantId), gte(leads.creadoEn, desde))),

      db.select({ c: count() }).from(leads)
        .where(and(eq(leads.tenantId, tenantId), eq(leads.estado, 'en_gestion'))),

      db.select({ c: count() }).from(leads)
        .where(and(
          eq(leads.tenantId, tenantId),
          eq(leads.estado, 'ganado'),
          gte(leads.actualizadoEn, desde)
        )),

      db.execute(sql`
        SELECT AVG(EXTRACT(EPOCH FROM (m_out.enviado_en - m_in.enviado_en)) / 60) as minutos
        FROM mensajes m_in
        JOIN mensajes m_out ON m_in.lead_id = m_out.lead_id
        WHERE m_in.direccion = 'entrante'
          AND m_out.direccion = 'saliente'
          AND m_out.tipo = 'humano'
          AND m_in.enviado_en > NOW() - INTERVAL '24 hours'
          AND m_out.enviado_en > m_in.enviado_en
      `),
    ])

    return reply.send({
      leadsHoy: leadsHoy[0].c,
      enGestion: enGestion[0].c,
      ganadosHoy: ganadosHoy[0].c,
      respPromedio: Math.round(Number(tiempoRespPromedio.rows[0]?.minutos ?? 0)),
    })
  })
}
```

---

## 4. REGISTRAR RUTAS EN SERVER.TS

```typescript
import { authRoutes } from './modules/auth/auth.route'
import { leadsRoutes } from './modules/leads/leads.route'
import { metricsRoutes } from './modules/leads/metrics.route'

await app.register(authRoutes, { prefix: '/api/v1' })
await app.register(leadsRoutes, { prefix: '/api/v1' })
await app.register(metricsRoutes, { prefix: '/api/v1' })
```

---

## 5. VALIDACIÓN

```bash
# 1. Crear usuario de prueba con bcrypt hash
docker exec -it labsia-postgres psql -U labsia -d labsia_dev -c "
  INSERT INTO dashboard_users (tenant_id, email, password_hash, nombre, rol)
  VALUES ((SELECT id FROM tenants LIMIT 1), 'test@test.mx', '\$2b\$10\$...', 'Test', 'operador')
"

# 2. Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.mx","password":"password","tenant_slug":"clinica-prueba"}'
# Devuelve access_token

# 3. Listar leads con token
curl http://localhost:3000/api/v1/leads \
  -H "Authorization: Bearer ACCESS_TOKEN"

# 4. Cambiar estado de un lead
curl -X PUT http://localhost:3000/api/v1/leads/LEAD_ID/estado \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"estado":"en_gestion"}'
```

```
□ POST /auth/login con credenciales válidas devuelve access_token + refresh_token cookie
□ POST /auth/login con credenciales inválidas devuelve 401
□ GET /leads sin token devuelve 401
□ GET /leads con token devuelve solo los del tenant del token (RLS)
□ GET /leads filtra por estado, canal, fechas
□ GET /leads paginado con limit/page
□ GET /leads/:id devuelve detalle + historial de mensajes
□ PUT /leads/:id/estado valida transición (rechaza inválidas con 400)
□ PUT /leads/:id/estado cancela jobs A6/B1/B2 si pasa a en_gestion
□ POST /leads/:id/mensaje envía WhatsApp y registra en historial
□ POST /leads/:id/mensaje cambia estado a en_gestion si era nuevo/sin_respuesta
□ GET /metricas devuelve estadísticas del día
```

---

## SIGUIENTE PASO

→ **DOC 19 — Dashboard frontend Next.js**

---

*DOC 18 — Dashboard backend API v1.0*
