# LABSIA — DOC 10 — SERVICIOS DE NEGOCIO
## Leads y Mensajes con deduplicación atómica

---

**Prerrequisito:** DOC 09 completado (mensajería funciona)
**Entregable:** Race condition probada: 2 mensajes simultáneos → 1 solo lead
**Tiempo estimado:** 2 días

---

## ESTRUCTURA

```
src/modules/leads/
├── leads.service.ts                # CRUD + deduplicación atómica
└── messages.service.ts             # Registro de historial
```

---

## 1. POR QUÉ LA DEDUPLICACIÓN ES CRÍTICA

Contenido fundamental en **`labsia_riesgos_operativos.md` sección 3.1**.

```
ESCENARIO PROBLEMÁTICO:
  Lead manda 2 mensajes en 200ms (WhatsApp tarda en confirmar)
  Worker procesa los 2 en paralelo (concurrency: 10)
  Ambos verifican "¿existe lead con este teléfono?" → NO
  Ambos hacen INSERT → CREAN 2 LEADS DUPLICADOS

CONSECUENCIA:
  - El lead recibe 2 respuestas A1 idénticas (irritante)
  - El operador ve 2 cards del mismo lead
  - Las métricas se inflan
  - Los seguimientos se duplican

SOLUCIÓN:
  INSERT ... ON CONFLICT (tenant_id, telefono) DO NOTHING RETURNING *
  Si dos workers compiten, solo uno inserta. El otro recibe la fila existente.
  La deduplicación se hace en PostgreSQL, no en el código.
```

---

## 2. CONSTRAINT ÚNICO ADICIONAL

Antes de implementar, agregar índice único en la migración:

```sql
-- src/db/migrations/002_unique_phone_per_tenant.sql

-- Solo activos en últimas 24h (permite reactivar leads viejos)
CREATE UNIQUE INDEX uniq_active_lead_per_phone
ON leads (tenant_id, telefono)
WHERE telefono IS NOT NULL
  AND creado_en > NOW() - INTERVAL '24 hours';
```

> Esto es un índice parcial: solo aplica el constraint a leads recientes.
> Permite que un cliente que volvió después de 30 días sea un lead nuevo.

---

## 3. LEADS SERVICE

```typescript
// src/modules/leads/leads.service.ts

import { db } from '@/config/database'
import { leads, type Lead, type InsertLead } from '@/db/schema'
import { eq, and, gt, sql } from 'drizzle-orm'
import { classifyMessage } from '@/modules/classifier/classifier.service'

export interface UpsertResult {
  lead: Lead
  created: boolean
}

/**
 * Inserta un lead nuevo o devuelve el existente.
 * Atómico en PostgreSQL: previene race conditions.
 */
export async function upsertLead(
  tenantId: string,
  telefono: string,
  texto: string,
  config: any
): Promise<UpsertResult> {

  // 1. Buscar lead activo existente
  const existing = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.tenantId, tenantId),
        eq(leads.telefono, telefono),
        gt(leads.creadoEn, sql`NOW() - INTERVAL '24 hours'`)
      )
    )
    .limit(1)

  if (existing.length > 0) {
    return { lead: existing[0], created: false }
  }

  // 2. Clasificar mensaje
  const classification = classifyMessage(texto, config.servicios, config.tono)

  // 3. Insertar con ON CONFLICT
  const result = await db.execute(sql`
    INSERT INTO leads (
      tenant_id, telefono, canal_primario, canales_activos,
      texto_original, intencion, servicio_detectado, es_alto_ticket,
      prioridad, estado, siguiente_accion_en
    ) VALUES (
      ${tenantId}, ${telefono}, 'whatsapp', ARRAY['whatsapp'],
      ${texto}, ${classification.intencion}, ${classification.servicio_detectado},
      ${classification.es_alto_ticket},
      ${classification.es_alto_ticket ? 'alta' : 'normal'},
      'nuevo',
      NOW() + INTERVAL '${sql.raw(String(config.umbrales.tiempo_respuesta_humano_min))} minutes'
    )
    ON CONFLICT ON CONSTRAINT uniq_active_lead_per_phone DO NOTHING
    RETURNING *
  `)

  // Si INSERT no devolvió nada → otro proceso ya lo creó
  if (!result.rows || result.rows.length === 0) {
    const [lead] = await db.select().from(leads)
      .where(and(eq(leads.tenantId, tenantId), eq(leads.telefono, telefono)))
      .limit(1)
    return { lead, created: false }
  }

  return { lead: result.rows[0] as Lead, created: true }
}

export async function updateLeadEstado(
  leadId: string,
  tenantId: string,
  nuevoEstado: string
): Promise<void> {

  // Validar transición (DOC 14 lo expande)
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId))
  if (!lead) throw new Error('Lead not found')

  await db.update(leads)
    .set({ estado: nuevoEstado, actualizadoEn: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))

  // Cancelar jobs pendientes si estado cambió a uno que ya no necesita seguimiento
  if (['en_gestion', 'ganado', 'descartado'].includes(nuevoEstado)) {
    await cancelPendingFollowups(leadId)
  }
}

async function cancelPendingFollowups(leadId: string) {
  // Cancelar jobs A6 con jobId predecible
  const { followupQueue } = await import('@/config/redis')
  const job = await followupQueue.getJob(`followup-A6-${leadId}`)
  if (job) {
    await job.remove()
    console.log(`[Followup] Cancelled A6 for lead ${leadId}`)
  }
}

export async function findLeadById(leadId: string, tenantId: string): Promise<Lead | null> {
  const [lead] = await db.select().from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
    .limit(1)
  return lead ?? null
}
```

---

## 4. MESSAGES SERVICE

Contenido base en **`labsia_fase1_codigo_completo.md` archivo 10**.

```typescript
// src/modules/leads/messages.service.ts

import { db } from '@/config/database'
import { mensajes, type Mensaje } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export interface RecordMessageInput {
  leadId: string
  tenantId: string
  direccion: 'entrante' | 'saliente'
  canal: 'whatsapp' | 'formulario' | 'instagram' | 'email'
  tipo: 'auto' | 'humano' | 'sistema'
  contenido: string
  metaMessageId?: string
  entregado?: boolean
  error?: string
}

export async function recordMessage(input: RecordMessageInput): Promise<Mensaje> {
  const [msg] = await db.insert(mensajes).values({
    tenantId: input.tenantId,
    leadId: input.leadId,
    direccion: input.direccion,
    canal: input.canal,
    tipo: input.tipo,
    contenido: input.contenido,
    metaMessageId: input.metaMessageId,
    entregado: input.entregado ?? false,
    error: input.error,
  }).returning()

  return msg
}

export async function getLeadHistory(
  leadId: string,
  tenantId: string,
  limit: number = 50
): Promise<Mensaje[]> {
  return db.select().from(mensajes)
    .where(and(eq(mensajes.leadId, leadId), eq(mensajes.tenantId, tenantId)))
    .orderBy(desc(mensajes.enviadoEn))
    .limit(limit)
}

export async function getMessageByMetaId(
  metaMessageId: string,
  tenantId: string
): Promise<Mensaje | null> {
  const [msg] = await db.select().from(mensajes)
    .where(and(eq(mensajes.metaMessageId, metaMessageId), eq(mensajes.tenantId, tenantId)))
    .limit(1)
  return msg ?? null
}
```

---

## 5. PRUEBA DE RACE CONDITION

Test de integración crítico:

```typescript
// tests/integration/dedup.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { db, setTenantContext } from '@/config/database'
import { tenants, leads } from '@/db/schema'
import { upsertLead } from '@/modules/leads/leads.service'

describe('Deduplicación atómica', () => {

  let tenantId: string
  const config = {
    umbrales: { tiempo_respuesta_humano_min: 10, precio_alto_ticket: 5000, max_intentos_auto: 2 },
    servicios: [{ nombre: 'Botox', palabras_clave: ['botox'], es_alto_ticket: false }],
    tono: { usa_emojis: true },
  }

  beforeEach(async () => {
    const [t] = await db.insert(tenants).values({
      nombre: 'Test', slug: 'test', tipoNegocio: 'clinica', activo: true, config: {},
    }).returning()
    tenantId = t.id
  })

  it('2 inserts simultáneos = 1 lead', async () => {
    // Ejecutar 2 upsert en paralelo
    const [r1, r2] = await Promise.all([
      upsertLead(tenantId, '+525500000001', 'Quiero botox', config),
      upsertLead(tenantId, '+525500000001', 'Cuanto cuesta', config),
    ])

    // Solo uno debe haber creado (created: true)
    const created = [r1, r2].filter(r => r.created)
    expect(created.length).toBe(1)

    // El otro debe haber devuelto el existente (created: false)
    const reused = [r1, r2].filter(r => !r.created)
    expect(reused.length).toBe(1)

    // Ambos resultados apuntan al mismo lead
    expect(r1.lead.id).toBe(r2.lead.id)

    // En la DB solo hay 1 lead
    const allLeads = await db.select().from(leads).where(eq(leads.tenantId, tenantId))
    expect(allLeads.length).toBe(1)
  })

  it('Lead viejo (> 24h) permite crear uno nuevo con mismo teléfono', async () => {
    // Crear lead viejo manualmente
    await db.insert(leads).values({
      tenantId,
      telefono: '+525500000001',
      canalPrimario: 'whatsapp',
      textoOriginal: 'viejo',
      creadoEn: new Date(Date.now() - 25 * 60 * 60 * 1000),   // hace 25h
    })

    const result = await upsertLead(tenantId, '+525500000001', 'nuevo mensaje', config)

    expect(result.created).toBe(true)

    const allLeads = await db.select().from(leads).where(eq(leads.tenantId, tenantId))
    expect(allLeads.length).toBe(2)
  })
})
```

---

## 6. VALIDACIÓN

```
□ upsertLead crea un lead nuevo si no existe
□ upsertLead devuelve lead existente si está dentro de la ventana 24h
□ Race condition: 2 inserts paralelos → 1 solo lead
□ Lead > 24h: permite crear uno nuevo con mismo teléfono
□ updateLeadEstado actualiza el estado en DB
□ updateLeadEstado cancela jobs A6 pendientes
□ recordMessage inserta en tabla mensajes
□ getLeadHistory devuelve mensajes ordenados desc
□ Test de integración pasa: tests/integration/dedup.test.ts
```

---

## SIGUIENTE PASO

→ **DOC 11 — Operadores** (notificaciones y disponibilidad)

---

*DOC 10 — Servicios de negocio v1.0*
