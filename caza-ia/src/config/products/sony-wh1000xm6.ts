import type { ProductConfig } from '../../types.js'

/**
 * Configuración inicial de vigilancia para los Sony WH-1000XM6 (ejemplo para construir la lógica).
 * Valores en MXN.
 *
 * El precio de lista o de lanzamiento es SOLO informativo. El precio real y el objetivo salen del
 * análisis del comportamiento de la oferta competitiva en el tiempo (engines/market-price.ts).
 * precioMaximo es un tope duro de seguridad, no una referencia de valor.
 * Vigilancia desactivada hasta la fase 2; compras deshabilitadas hasta la fase 6.
 */
export const sonyWh1000xm6: ProductConfig = {
  slug: 'sony-wh1000xm6',
  nombre: 'Sony WH-1000XM6',
  marca: 'Sony',
  modelo: 'WH-1000XM6',
  monedaBase: 'MXN',
  precioListaInformativo: 11999, // lanzamiento Sony Store MX; no se usa como referencia
  precioObjetivo: null, // derivado: precio real de mercado menos el umbral
  precioMaximo: 8499,
  umbralDescuentoPct: 12,
  mercados: ['MX', 'US'],
  requiereAprobacion: true,
  vigilanciaActiva: false,
  intervaloMinutos: 360,
}
