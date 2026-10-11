---
name: caza-verify
description: Verificación completa de CAZA IA antes de hacer push o de dar algo por terminado. Úsala siempre que hayas tocado caza-ia/ (motores, SQL, fixtures, configuración, docs) y vayas a commitear, pushear o reportar que algo funciona; también cuando el usuario pida "revisa", "prueba", "verifica" o "¿está bien?" sobre el módulo. Corre typecheck, pruebas, demo y la comprobación de guardas en PostgreSQL, y revisa las reglas no negociables.
---

# Verificar CAZA IA

Un push que rompe CI o afloja una guarda de compra cuesta un ciclo y confianza. Esta skill es la lista corta que
garantiza que lo que se sube funciona y respeta las reglas del proyecto.

## 1. Correr las comprobaciones

Desde `caza-ia/`:

```bash
npm run verify      # typecheck + pruebas unitarias + demo (sin red). ~10 s
npm run db:check    # migraciones en PostgreSQL temporal + guardas. ~5 s. Si tocaste src/db/
npm run test:db     # integración de la vigilancia en PostgreSQL temporal. ~10 s. Si tocaste src/db/ o src/watch/
npm run phase2:check  # dos ciclos de vigilancia persistidos. Si tocaste src/watch/ o los repositorios
npm run phase2:worker-check  # scheduler + worker con Redis temporal. Si tocaste src/watch/scheduler.ts
```

Qué significa cada salida:
- `verify` termina con `Órdenes creadas: 0 (esperado: 0)`. Si aparece otro número, el ejecutor dejó pasar una compra con el interruptor apagado: detente y corrige antes de nada.
- `db:check` termina con `OK: migraciones y guardas verificadas` y reporta 4 errores esperados y 1 orden. Menos errores significa que una guarda dejó de bloquear.

- `test:db` corre `tests/db/` con `DATABASE_URL` exportada por `scripts/with-temp-pg.sh`; en `npm test` esas pruebas se omiten a propósito.

Si falta PostgreSQL, `db:check` sale con código 2 y lo dice. Entonces reporta que las migraciones no se validaron en lugar de asumirlo.

## 2. Releer el diff con las reglas delante

Busca en tu propio diff estas señales y, si aparecen, pregúntate si el usuario lo pidió de forma explícita:

| Señal | Por qué importa |
| --- | --- |
| `PURCHASES_ENABLED`, `CAZA_PHASE`, `purchases_enabled` cambian de valor | Son las tres capas del interruptor de compras |
| Se elimina o relaja un `CHECK`, `UNIQUE INDEX` o trigger en `002_purchase_guards.sql` | Anti-duplicados vive en la base de datos |
| `precioListaInformativo`, `advertisedPreviousPrice` o un precio fijo se usan como referencia de descuento | El precio real sale solo del análisis en el tiempo |
| Un veredicto `real` o `minimo_historico` con `confianza` baja genera propuesta | Prohibido por regla 5 |
| Aparece `amazon` junto a `fetch`, `playwright` o `cheerio` | No se scrapea Amazon |
| Un test se salta (`.skip`), se borra o se afloja su aserción | Nunca para poner algo en verde |

## 3. Mantener los documentos en sintonía

Si cambiaste el motor de precio real o los veredictos, actualiza la sección 3 de `docs/PLAN_DESARROLLO.md`
(algoritmo y ejemplo numérico) y, si los números del ejemplo cambiaron, la tabla del README. Corre
`npm run profile` para sacar los valores reales en vez de escribirlos de memoria.

## 4. Reportar

Di qué corrió y qué salió, con los números: cantidad de pruebas, si `db:check` pasó, y si algo quedó sin verificar
y por qué. No dejes conteos de pruebas fijos en CLAUDE.md ni en el README: envejecen con cada prueba nueva. Un "todo bien" sin evidencia no sirve al que lee el PR.
