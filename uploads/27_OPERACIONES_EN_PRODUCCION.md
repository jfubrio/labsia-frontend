# LABSIA — DOC 26 — OPERACIONES EN PRODUCCIÓN
## DNS, backups, runbook y go-live

---

> **Objetivo:**
> Sistema listo para el primer cliente real con confianza operativa.
>
> **Prerrequisito:**
> DOC 25 completado, deploy automático funcionando.

---

## 1. CONFIGURACIÓN DNS COMPLETA

### 1.1 — Todos los registros DNS de labsia.mx

```
TIPO   NOMBRE          VALOR                                          PROXY    TTL
─────────────────────────────────────────────────────────────────────────────────────
A      @               [IP del sitio actual]                          ON       Auto
A      www             [IP del sitio actual]                          ON       Auto
CNAME  api             xxx.railway.app                                ON       Auto
CNAME  dashboard       cname.vercel-dns.com                           OFF      Auto
CNAME  status          [URL de Better Uptime status page]             OFF      Auto

# Email outbound (SPF + DKIM + DMARC)
TXT    @               v=spf1 include:spf.mtasv.net ~all              N/A      Auto
TXT    pm._domainkey   k=rsa; p=[clave pública de Postmark]           N/A      Auto
TXT    _dmarc          v=DMARC1; p=quarantine;                        N/A      Auto
                       rua=mailto:dmarc@labsia.mx; pct=100

# Email inbound
MX     inbound         inbound.postmarkapp.com (prioridad 10)         N/A      Auto

# Verificación de propiedad (Google, Stripe, etc. si lo piden)
TXT    @               google-site-verification=[código]              N/A      Auto
TXT    @               stripe-domain-verification=[código]            N/A      Auto
```

### 1.2 — Verificación de DNS

```bash
# Verificar que cada registro responde correctamente

# A records
dig +short labsia.mx
# Debe devolver la IP correcta

# CNAMEs
dig +short api.labsia.mx
# Debe devolver xxx.railway.app

dig +short dashboard.labsia.mx
# Debe devolver cname.vercel-dns.com

# SPF
dig +short TXT labsia.mx
# Debe incluir v=spf1 include:spf.mtasv.net

# DKIM
dig +short TXT pm._domainkey.labsia.mx
# Debe devolver la clave RSA

# DMARC
dig +short TXT _dmarc.labsia.mx
# Debe incluir v=DMARC1

# MX para inbound
dig +short MX inbound.labsia.mx
# Debe devolver 10 inbound.postmarkapp.com
```

### 1.3 — Testing de deliverability

```
HERRAMIENTAS:
  https://mail-tester.com
    Envía un email a la dirección que te da
    Reporta puntuación (objetivo: 10/10)

  https://www.mxtoolbox.com
    Verifica SPF, DKIM, DMARC y blacklists

PRUEBA REAL:
  Enviar email desde noreply@labsia.mx a:
    - tu cuenta de Gmail
    - tu cuenta de Outlook/Hotmail
    - tu cuenta de iCloud

  Verificar que TODOS llegan al INBOX, no a Spam.
```

---

## 2. BACKUPS

### 2.1 — Backups automáticos de Railway

```
Railway PostgreSQL hace backups automáticos:
  Frecuencia: cada 24 horas
  Retención: 7 días (plan Hobby) / 30 días (plan Pro)

Acceso:
  Railway Dashboard → PostgreSQL service → Backups tab
  Restauración: 1 click → restore at point in time
```

### 2.2 — Backup adicional a Cloudflare R2

> Una capa más de protección. No reemplaza al de Railway.

```yaml
# .github/workflows/backup-db.yml

name: Daily DB Backup

on:
  schedule:
    - cron: '0 8 * * *'   # 8 AM UTC = 2 AM México (bajo tráfico)
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Install PostgreSQL client
        run: |
          sudo apt-get update
          sudo apt-get install -y postgresql-client-16

      - name: Backup database
        run: |
          DATE=$(date +%Y%m%d-%H%M%S)
          pg_dump ${{ secrets.DATABASE_URL_PRODUCTION }} | gzip > backup-$DATE.sql.gz
          echo "FILENAME=backup-$DATE.sql.gz" >> $GITHUB_ENV

      - name: Upload to R2
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          AWS_ENDPOINT_URL: ${{ secrets.R2_ENDPOINT_URL }}
        run: |
          aws s3 cp $FILENAME s3://labsia-backups/db/ --endpoint-url $AWS_ENDPOINT_URL

      - name: Cleanup old backups (> 30 days)
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
        run: |
          aws s3 ls s3://labsia-backups/db/ --endpoint-url $AWS_ENDPOINT_URL | \
            awk '{ if (strftime("%s", systime() - 30*86400) > strftime("%s", $1 " " $2)) print $4 }' | \
            xargs -I {} aws s3 rm s3://labsia-backups/db/{} --endpoint-url $AWS_ENDPOINT_URL

      - name: Notify success
        if: success()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -d "{\"text\":\"✓ Backup diario completado: $FILENAME\"}"

      - name: Notify failure
        if: failure()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -d "{\"text\":\"🚨 Backup diario FALLÓ - revisar inmediatamente\"}"
```

### 2.3 — Procedimiento de restauración

```bash
# ESCENARIO: necesito restaurar a un punto anterior

# OPCIÓN 1 — Desde Railway (más fácil)
# Railway Dashboard → PostgreSQL → Backups → Select date → Restore
# Tiempo: 5-15 minutos
# Recovery point: máximo 24h anterior

# OPCIÓN 2 — Desde R2 backup (point-in-time específico)
# 1. Descargar el backup
aws s3 cp s3://labsia-backups/db/backup-20250115-080000.sql.gz . \
  --endpoint-url $R2_ENDPOINT_URL

# 2. Crear nueva DB temporal
railway run createdb labsia_restore_test

# 3. Restaurar
gunzip -c backup-20250115-080000.sql.gz | \
  railway run psql $DATABASE_URL -d labsia_restore_test

# 4. Verificar datos
railway run psql $DATABASE_URL -d labsia_restore_test -c "SELECT count(*) FROM leads"

# 5. Si todo OK, swap de bases:
#    Renombrar producción → backup
#    Renombrar restore → producción
#    (Requiere downtime de 2-5 minutos)
```

### 2.4 — Test mensual de restauración

```
EL PRIMER LUNES DE CADA MES:

  □ Descargar el backup más reciente de R2
  □ Restaurar en un servidor de prueba
  □ Verificar:
    - Tablas existen
    - Conteo de registros razonable
    - Queries básicos funcionan
    - RLS sigue funcionando
  □ Documentar tiempo de restauración

SI EL TEST FALLA:
  → Investigar inmediatamente
  → No esperar a un incidente real
```

---

## 3. RUNBOOK DE INCIDENTES (EXPANDIDO)

### Estructura general

```
Para cada incidente:
  1. DETECTAR — cómo nos enteramos
  2. EVALUAR — gravedad y alcance
  3. COMUNICAR — quién necesita saberlo
  4. CONTENER — limitar el daño
  5. RESOLVER — solución
  6. POSTMORTEM — qué aprendimos
```

### Incidente A: Meta WhatsApp API caída

```
DETECCIÓN:
  - Sentry: 50+ errores "META_API_ERROR" en 5 min
  - Circuit breaker abierto: "meta-whatsapp-api"
  - Better Uptime: health check OK (interno funciona)
  - Tweets de @MetaStatus o https://metastatus.com

EVALUAR (5 min):
  curl https://metastatus.com/api/v2/status.json | jq '.status'

  Si Meta confirma incidente:
    → No es nuestro problema técnico
    → Esperar resolución (típicamente 1-4 horas)
  Si Meta NO reporta nada:
    → Verificar nuestro token, configuración, IP
    → Probar llamada directa:
      curl -X POST \
        "https://graph.facebook.com/v19.0/PHONE_ID/messages" \
        -H "Authorization: Bearer $META_ACCESS_TOKEN" \
        -d '{"messaging_product":"whatsapp","to":"NUM","type":"text","text":{"body":"test"}}'

COMUNICAR:
  Notificación automática del Circuit Breaker debe disparar.
  Adicionalmente:
  - Email a clientes activos: "Detectamos incidente en WhatsApp.
    Tus mensajes se están encolando y se enviarán cuando se restablezca."

CONTENER:
  Circuit breaker ya contiene.
  Verificar que los mensajes se están encolando, no perdiendo:

  curl https://api.labsia.mx/admin/queue-status \
    -H "X-Admin-Key: $LABSIA_ADMIN_KEY"

  Si la cola crece descontroladamente (> 1,000 jobs):
  - Aumentar replicas del worker temporalmente
  - O agregar workers

RESOLVER:
  Cuando Meta restablece:
  - Circuit breaker pasa a half-open automáticamente
  - Si las primeras llamadas funcionan, vuelve a closed
  - Los mensajes encolados se procesan automáticamente
  - Verificar que no hay errores residuales

POSTMORTEM:
  □ Duración del incidente
  □ Mensajes retrasados
  □ Clientes que reportaron
  □ ¿La comunicación funcionó?
  □ ¿El sistema se recuperó solo?
  □ Mejoras propuestas
```

### Incidente B: Base de datos lenta

```
DETECCIÓN:
  - Health check reporta "degraded"
  - p95 response time > 1 segundo
  - Sentry: "Query timeout"

EVALUAR (5 min):
  railway connect postgres

  -- Ver queries activos lentos
  SELECT pid, now() - query_start AS duration, state, query
  FROM pg_stat_activity
  WHERE state = 'active'
    AND now() - query_start > interval '5 seconds'
  ORDER BY duration DESC;

  -- Ver conexiones del pool
  SELECT count(*) FROM pg_stat_activity;
  -- > 18 de 20 = pool saturado

  -- Ver tablas más grandes
  SELECT
    relname,
    pg_size_pretty(pg_total_relation_size(relid)) AS size,
    n_live_tup
  FROM pg_stat_user_tables
  ORDER BY pg_total_relation_size(relid) DESC
  LIMIT 10;

CONTENER:
  Si hay query stuck > 30 segundos:
    SELECT pg_terminate_backend(PID);

  Si pool saturado, restart del servicio:
    railway redeploy --service labsia-backend

RESOLVER:
  - Identificar el query problemático
  - Si falta índice: crear con CONCURRENTLY
    CREATE INDEX CONCURRENTLY idx_nombre ON tabla(col);
  - Si query mal escrito: fix + deploy
  - Si volumen crítico: considerar partitioning

POSTMORTEM:
  □ Qué query era el culpable
  □ Por qué no se detectó antes
  □ ¿Falta un alerting?
  □ ¿Falta un índice?
```

### Incidente C: Redis lleno

```
DETECCIÓN:
  - Upstash alerta: memoria > 80%
  - Errores OOM en logs

EVALUAR:
  # Conectar a Redis
  redis-cli -u $REDIS_URL

  # Ver memoria
  INFO memory

  # Ver keys más grandes
  --bigkeys

  # Ver distribución de keys
  --scan --pattern "*" | head -50

CONTENER:
  Eliminar keys huérfanas (sin TTL):
  redis-cli --scan --pattern "intake:*" --count 100 | \
    xargs redis-cli del

  Aumentar plan en Upstash si es legítimo.

RESOLVER:
  - Auditar código: ¿hay keys creadas sin EXPIRE?
  - Implementar limpieza diaria automática
  - Considerar Redis con persistencia AOF vs RDB
```

### Incidente D: Tenant reporta leads perdidos

```
DETECCIÓN:
  - Cliente escribe: "no me llegan mis leads"

EVALUAR — script de investigación:

  -- 1. Verificar tenant activo
  SELECT id, activo, plan, slug FROM tenants WHERE slug = 'X';

  -- 2. Mensajes recibidos hoy
  SELECT count(*), canal FROM mensajes
  WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'X')
    AND direccion = 'entrante'
    AND enviado_en > NOW() - INTERVAL '24 hours'
  GROUP BY canal;

  -- 3. Leads creados hoy
  SELECT count(*), estado FROM leads
  WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'X')
    AND creado_en > NOW() - INTERVAL '24 hours'
  GROUP BY estado;

  -- 4. Errores de envío
  SELECT contenido, error, enviado_en FROM mensajes
  WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'X')
    AND error IS NOT NULL
    AND enviado_en > NOW() - INTERVAL '24 hours';

  -- 5. Verificar quality rating de WhatsApp
  curl https://graph.facebook.com/v19.0/PHONE_ID \
    -H "Authorization: Bearer $META_ACCESS_TOKEN"

POSIBLES CAUSAS:

  a. Tenant suspendido por billing
     → Verificar pago en Stripe, reactivar
     UPDATE tenants SET activo = true WHERE id = 'X';

  b. Número WhatsApp con quality rating RED
     → Pausar mensajes salientes
     → Investigar qué template generó reportes
     → Considerar template "softer"

  c. Webhook desconfigurado en Meta
     → Reconfigurar webhook URL en Meta App
     → Verificar verify token

  d. Templates rechazados
     → Crear templates nuevos con otro nombre
     → Re-enviar a aprobación

COMUNICAR AL CLIENTE:
  Explicación honesta de qué pasó y qué se hizo:
  "Identificamos que [causa]. Lo corregimos [a las X].
   Tus leads del periodo afectado ya están siendo procesados.
   Nos disculpamos por el inconveniente."
```

---

## 4. CHECKLIST DE GO-LIVE FINAL

### Antes del PRIMER cliente real pagando

```
INFRAESTRUCTURA Y CÓDIGO
  □ Backend en Railway producción con health 200
  □ Worker en Railway producción procesando jobs
  □ PostgreSQL con todas las migraciones aplicadas
  □ Redis (Upstash) conectado y funcional
  □ Dashboard en Vercel con SSL activo
  □ Sentry recibiendo eventos de prueba
  □ Better Uptime monitoreando cada 60s

DOMINIO Y DNS
  □ api.labsia.mx responde 200 en /health
  □ dashboard.labsia.mx carga la app
  □ SPF, DKIM, DMARC verificados en mail-tester.com (10/10)
  □ Email de prueba a noreply@labsia.mx llega al INBOX
  □ Email entrante a test@inbound.labsia.mx llega al webhook

META WHATSAPP
  □ Meta Business Manager verificado (palomita azul)
  □ Meta App con WhatsApp habilitado
  □ Número Business registrado (no número personal)
  □ Phone Number ID guardado
  □ Access Token permanente del System User
  □ Webhook configurado y respondiendo verify
  □ 4 templates pre-aprobados:
    - labsia_seguimiento
    - labsia_reactivacion
    - labsia_cierre
    - labsia_recordatorio_cita
  □ Quality rating del número: GREEN

STRIPE
  □ Modo LIVE activado
  □ Productos creados con precios correctos
  □ Webhook /api/v1/webhooks/stripe configurado
  □ Webhook signing secret en variables de entorno
  □ Transacción de prueba: completada y reembolsada
  □ Factura electrónica configurada (RFC mexicano)

CI/CD
  □ Pipeline pasa en cada PR
  □ Deploy a staging automático funcional
  □ Aprobación manual para producción configurada
  □ Backup diario corriendo y notificando

DASHBOARD
  □ Login funcional con cuenta de prueba
  □ Lista de leads se carga
  □ Respuesta manual envía mensaje real
  □ Cambio de estado funciona
  □ Métricas se actualizan
  □ Logout limpia sesión

LEGAL
  □ Términos de Servicio publicados en labsia.mx/terminos
  □ Política de Privacidad publicada en labsia.mx/privacidad
  □ Aviso de Privacidad descargable
  □ DPA template listo para firmar
  □ Contrato del primer cliente firmado

OPERACIONES
  □ Runbook impreso y accesible para el equipo
  □ Acceso a Railway compartido con 2 personas mínimo
  □ Acceso a Stripe compartido con 2 personas
  □ Acceso a Meta Business Manager compartido
  □ Persona on-call designada para los primeros 30 días
  □ Canal de Slack #ops creado
  □ Lista de contactos de emergencia documentada

TESTING
  □ Coverage > 70% en módulos críticos
  □ Tests E2E pasando
  □ Smoke tests en staging exitosos
  □ Test mensual de restauración de backup planeado

COMUNICACIÓN
  □ Cliente conoce el proceso de soporte
  □ Cliente tiene contacto directo del equipo
  □ Cliente firmó contrato y entregó datos para onboarding
  □ Plan de revisión a los días 1, 3, 7, 14, 30
```

---

## 5. PRIMEROS 7 DÍAS DESPUÉS DEL GO-LIVE

```
DÍA 1
  □ Cliente activado y procesando leads reales
  □ Verificar cada 2 horas:
    - Health check verde
    - Sentry sin errores nuevos
    - Mensajes entregándose correctamente
    - Operador del cliente puede usar el dashboard
  □ Reunión de 15 min al final del día con el cliente
  □ Documentar primer día en log de operaciones

DÍA 2-3
  □ Monitoreo cada 4 horas (no 2)
  □ Si hay reportes del cliente: priorizar resolución < 4h
  □ Reunión diaria de 15 min
  □ Identificar friction points del dashboard

DÍA 4-7
  □ Monitoreo normal (revisión 2 veces al día)
  □ Revisión de métricas:
    - Cuántos leads se han procesado
    - Tiempo de respuesta promedio
    - Errores totales (objetivo: < 0.5%)
  □ Encuesta de satisfacción al cliente
  □ Lista de mejoras prioritarias para iterar

SI ALGO SALE MAL:
  □ Aplicar runbook
  □ Comunicar al cliente con transparencia
  □ Resolver en < 4 horas (SLA Enterprise)
  □ Postmortem documentado en menos de 24h
```

---

## 6. POST-MORTEM TEMPLATE

```markdown
# POST-MORTEM: [Nombre del incidente]

## Resumen ejecutivo
[1-2 párrafos: qué pasó, cuándo, impacto]

## Línea de tiempo (UTC)
- HH:MM - Detección
- HH:MM - Equipo notificado
- HH:MM - Contención aplicada
- HH:MM - Resolución
- HH:MM - Verificación

Duración total: X horas Y minutos

## Impacto
- Tenants afectados: [número]
- Leads perdidos: [número o cero]
- Mensajes retrasados: [número]
- Clientes que reportaron: [número]

## Causa raíz
[Análisis técnico de qué falló]

## Lo que funcionó bien
- [Item 1]
- [Item 2]

## Lo que no funcionó
- [Item 1]
- [Item 2]

## Acciones correctivas
| Acción | Responsable | Fecha objetivo |
|---|---|---|
| [Acción 1] | [Nombre] | [Fecha] |
| [Acción 2] | [Nombre] | [Fecha] |

## Lecciones aprendidas
[1-2 párrafos]
```

---

## 7. ESTADO FINAL DEL SISTEMA

Al completar DOC 26:

```
SISTEMA OPERATIVO:
  ✓ Producción funcionando con health checks verdes
  ✓ Backups diarios automáticos
  ✓ Monitoreo activo con alertas
  ✓ Pipeline CI/CD con tests obligatorios
  ✓ Deploy con aprobación manual y rollback rápido

EQUIPO PREPARADO:
  ✓ Runbook documentado con 4 incidentes principales
  ✓ Procedimiento de restauración probado
  ✓ On-call asignado
  ✓ Acceso compartido a todas las plataformas críticas

LEGAL Y COMERCIAL:
  ✓ Documentos legales publicados
  ✓ Primer contrato firmado
  ✓ Cliente onboardeado con el equipo

CALIDAD:
  ✓ Tests pasando con > 70% coverage
  ✓ Sin errores críticos en Sentry
  ✓ Performance dentro de SLA
```

---

## CIERRE DE LA SECUENCIA DE IMPLEMENTACIÓN

```
DOC 00 — Mapa de implementación              ✓
DOC 01 — Preparación del entorno             ✓
DOC 02 — Setup inicial del proyecto          ✓
DOC 03 — Base de datos                       (referencia: fase1_spec sec.2)
DOC 04 — Configuración base                  (referencia: fase1_codigo_completo 1-5)
DOC 05 — Middleware y seguridad              (referencia: fase1_codigo_completo 6)
DOC 06 — Onboarding API                      (referencia: fase1_spec sec.3)
DOC 07 — Webhooks                            (referencia: fase1_spec sec.4-5)
DOC 08 — Workers y colas                     (referencia: fase1_spec sec.6)
DOC 09 — Servicios de mensajería             (referencia: fase1_spec sec.7-9)
DOC 10 — Servicios de negocio                (referencia: fase1_spec sec.10)
DOC 11 — Operadores                          (referencia: fase1_codigo_completo 8-9)
DOC 12 — Cache y configuración               (referencia: fase1_codigo_completo 7)
DOC 13 — Intake guiado                       (referencia: fase2_spec sec.2A)
DOC 14 — Flujo B completo                    (referencia: fase2_spec sec.2B)
DOC 15 — Trigger engine                      (referencia: fase2_spec sec.2C)
DOC 16 — Jobs diferidos y post-conversión    (referencia: fase2_spec sec.2D-2E)
DOC 17 — Modo campaña y multi-operador       (referencia: fase2_spec sec.2F-2G)
DOC 18 — Dashboard backend                   (referencia: fases3_4_spec sec.3A)
DOC 19 — Dashboard frontend                  (referencia: fases3_4_spec sec.3A)
DOC 20 — Resiliencia y monitoreo             (referencia: fases3_4_spec sec.3B-3C)
DOC 21 — Billing con Stripe                  (referencia: fases3_4_spec sec.4B)
DOC 22 — Onboarding self-service             (referencia: fases3_4_spec sec.4A)
DOC 23 — Email + exportación + offboarding   (referencia: fases3_4_spec sec.4C-4E)
DOC 24 — Testing                             ✓
DOC 25 — Deploy y CI/CD                      ✓
DOC 26 — Operaciones en producción           ✓ (este)

TOTAL: 27 documentos. Listos para construir.
```

---

*DOC 26 — Operaciones en producción v1.0*
*Última pieza antes del primer cliente real*
*El sistema está listo. Ahora se construye.*
