import type { ProductConfig } from '../../types.js'

/**
 * Configuración inicial de vigilancia para los Sony WH-1000XM6.
 * Valores de precio en MXN. El precio de referencia (lista) está por confirmar.
 * Vigilancia desactivada hasta la fase 2; compras deshabilitadas hasta la fase 6.
 */
export const sonyWh1000xm6: ProductConfig = {
  slug: 'sony-wh1000xm6',
  nombre: 'Sony WH-1000XM6',
  marca: 'Sony',
  modelo: 'WH-1000XM6',
  monedaBase: 'MXN',
  precioReferencia: 9999, // por confirmar
  precioObjetivo: 7999,
  precioMaximo: 8499,
  umbralDescuentoPct: 12,
  mercados: ['MX', 'US'],
  requiereAprobacion: true,
  vigilanciaActiva: false,
  intervaloMinutos: 360,
}
