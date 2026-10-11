---
name: tsmx-audiencia
description: Ejecuta y mide la fase de audiencia orgánica del proyecto TikTok Shop MX (ticket T02B, docs/tiktok-shop-mx/13_ESTRATEGIA_AUDIENCIA.md): planificar videos por pilar y candidato de nicho, registrar métricas por video en audiencia/registro_videos.csv y calcular seguidores e intención de compra por cada 1,000 vistas con scripts/audiencia.py. Úsala cuando el usuario hable de seguidores, alcance, contenido viral, calendario de publicaciones, ideas de videos, "qué video hago esta semana", "cómo van los videos", métricas de TikTok Studio, o pida aplicar las reglas de decisión de las 6 semanas. No la uses para la investigación de nichos con búsquedas (tsmx-ficha-nicho).
---

# Fase de audiencia (T02B)

La estrategia está en `docs/tiktok-shop-mx/13_ESTRATEGIA_AUDIENCIA.md`. Léela antes de proponer contenido: los pilares salen de preguntas observadas en T02 y las reglas de la sección 8 (solo contenido original, no comprar interacción, divulgación comercial) no se negocian, porque romperlas saca los videos del feed Para ti o invalida la medición.

## Precondiciones

- P-12 aprobado (estrategia) y P-10 resuelto (cuenta creada) en `08_REGISTRO_DECISIONES.md`. Sin eso puedes **planificar** (guiones, calendario), pero no hay nada que publicar ni medir. Publicar lo hace el propietario; el agente no publica.

## Planificar videos

Para cada idea entrega: candidato de nicho, pilar (P1–P5), gancho de 0–2 s con la frase de búsqueda, qué se muestra para retener, dato concreto visible (peso, medida, tiempo), pregunta final y la objeción o pregunta de T02 que responde, citando la ficha. Una idea que no responde una pregunta observada es una apuesta y se etiqueta así.

Rota candidatos para que cada uno llegue a 5 videos con datos antes del corte de la semana 6.

## Registrar métricas

Una fila por video y por lectura en `docs/tiktok-shop-mx/audiencia/registro_videos.csv`. Las cifras se copian de TikTok Studio, Analítica, tal como aparecen ("12.3 mil" es válido). `comentarios_intencion_compra` se cuenta con el criterio de la estrategia §6: dónde comprar, precio o enlace, o compatibilidad con su caso. Lo que no se ve se escribe "no disponible", no 0.

## Medir y decidir

```bash
python3 .claude/skills/tsmx-audiencia/scripts/audiencia.py              # por candidato
python3 .claude/skills/tsmx-audiencia/scripts/audiencia.py --por pilar   # por pilar
```

El script usa la lectura más reciente de cada video y ordena por intención de compra por cada 1,000 vistas; solo ordena grupos con al menos 5 videos con datos (`--min` para cambiarlo). Al aplicar las reglas de la sección 7:

1. Registra la decisión con `tsmx-decision` (D-xx) citando la tabla y la fecha.
2. Copia los indicadores a la ficha de cada candidato como evidencia de "Demanda observable" con fecha, ajusta su nota si corresponde y ejecuta `tsmx-matriz --write`.
3. Actualiza T02B y, si se autoriza, T03 con `tsmx-backlog`.

## Qué no concluir

- Vistas altas no son demanda de compra. Un candidato con muchas vistas y cero intención de compra no pasa a T03 por las vistas.
- La intención de compra en comentarios no es una venta. Es la mejor señal disponible sin afiliación, y así se reporta.
