---
name: tsmx-requisitos
description: Verifica o actualiza los requisitos de afiliación de TikTok Shop México (ticket T01) en docs/tiktok-shop-mx/09_REQUISITOS_AFILIACION_MX.md con fuentes oficiales fechadas, separando requisitos públicos de permisos que solo se comprueban dentro de una cuenta. Úsala cuando el usuario pregunte por requisitos, seguidores mínimos, comisiones, pagos, retenciones, muestras, verificación de identidad, "qué necesito para ser afiliado", "ha cambiado la política", o pida cerrar T01 o volver a verificar una fuente. También cuando otra skill necesite citar un requisito: léelo de aquí, no de memoria.
---

# Requisitos de afiliación (T01)

Los requisitos cambian y las fuentes no oficiales los mezclan con otros programas (Creator Rewards, Creator Marketplace) y otros países (EE. UU. usa 1,000 seguidores y piloto de 5,000; México muestra 2,000 para el piloto). Por eso el documento solo admite como "verificado" lo leído en dominios oficiales de TikTok, con fecha.

## Fuentes oficiales que cuentan

`seller-mx.tiktok.com` (centro de ayuda y políticas MX), `newsroom.tiktok.com`, `www.tiktok.com/community-guidelines`, `support.tiktok.com`, `partner.tiktokshop.com` (API). Páginas de otros países (`seller-us`, `seller-th`) sirven como referencia comparativa y se etiquetan así; nunca como requisito MX.

## Flujo

1. Lee `09_REQUISITOS_AFILIACION_MX.md` completo: tiene 24 fuentes numeradas [S-n] y una tabla de requisitos con columna "Fecha publicación/actualización". Trabaja sobre él; no lo reescribas desde cero.
2. Para cada requisito que verifiques: intenta abrir la URL oficial (WebFetch). Si el proxy bloquea el dominio, usa WebSearch con `allowed_domains: ["seller-mx.tiktok.com"]` o `["tiktok.com"]` y cita el fragmento textual; marca "vía fragmento de buscador". Si una página muestra fecha ("08/25/2025", "Fecha de vigencia"), cópiala en la columna correspondiente.
3. Si un valor cambió respecto al documento, no sobrescribas: añade una fila en una sección "Historial de cambios" con valor anterior, valor nuevo, fuente y fecha. El propietario necesita ver qué cambió.
4. Lo que exige sesión (elegibilidad de una cuenta concreta, catálogo, comisión por producto, muestras, KYC, método de pago) se queda en la sección 3 como NO VERIFICADO con la ruta in-app. Si el propietario reporta el resultado de un recorrido in-app, regístralo como "verificado por el propietario el AAAA-MM-DD" con captura guardada fuera del repositorio.
5. Discrepancias entre páginas oficiales (por ejemplo ISR 2.5 % frente a "1 % del ingreso bruto", liquidación 15 frente a 7 días) van a la sección 5 con ambas fuentes; no elijas una en silencio.
6. T01 pasa a `hecho` solo cuando las ocho páginas clave listadas en su sección 7 se leyeron directamente y el propietario completó el recorrido in-app. Mientras tanto es `preliminar`.

## Al terminar

Actualiza "Fecha de observación" en el encabezado, la lista de fuentes y, si procede, el estado con `tsmx-backlog`. Cualquier cifra nueva relevante para la economía (comisión, retención, umbral de pago) también se refleja en la ficha o en `10_MATRIZ_NICHOS.md` si afecta a la dimensión "Economía del afiliado".
