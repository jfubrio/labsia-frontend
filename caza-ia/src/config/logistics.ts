import type { Market, Currency } from '../types.js'

/**
 * Logística de compra en el extranjero: buzones de recepción y cómo entra la mercancía a México.
 *
 * Con un buzón en Texas, una compra en una tienda de EE. UU. es una compra DOMÉSTICA en EE. UU. (paga impuesto de
 * venta de Texas, envío doméstico normalmente gratis). Después la mercancía entra a México por una de dos vías:
 *
 *  - cruce_personal: el comprador recoge en el buzón y cruza por tierra. No hay reenvío ni importación por
 *    paquetería: aplica la franquicia de pasajero y, si el valor la excede, la tasa global solo sobre el excedente.
 *    Es la vía por defecto: el comprador vive cerca de la frontera y pasa por el buzón.
 *  - paqueteria: el buzón reenvía a casa por mensajería; paga tarifa de reenvío e importación por tramos (T-MEC).
 *
 * El precio aterrizado suma todo eso en MXN; solo así es comparable con una oferta local.
 * Todos los números de aquí son supuestos de fase 1 marcados "por confirmar" en el plan (sección 8).
 */

export type ModoIngreso = 'cruce_personal' | 'paqueteria'

export interface ImportTier {
  /** Valor de la mercancía en USD, límite inferior inclusive. */
  minUsd: number
  /** Límite superior exclusivo; null = sin tope en este esquema. */
  maxUsd: number | null
  /** Tasa global (arancel + IVA) como fracción del valor. */
  tasa: number
  nota: string
}

export interface ImportRules {
  origen: Market
  destino: Market
  tiers: ImportTier[]
  /** Fuente y vigencia, para que nadie confíe en estos números sin revisarlos. */
  fuente: string
  porConfirmar: boolean
}

export interface Mailbox {
  clave: string
  nombre: string
  market: Market
  currency: Currency
  /** Impuesto de venta aplicado por la tienda al enviar al buzón (depende de la dirección exacta). */
  impuestoVentaPct: number
  /** Envío de la tienda al buzón, en moneda local. Casi siempre 0 en EE. UU. por encima de un mínimo. */
  envioDomestico: number
  /** Tarifa del buzón por recibir y guardar un paquete, en moneda local. */
  tarifaRecepcion: number
  /** Cómo entra la mercancía a casa. */
  modoIngreso: ModoIngreso
  /** cruce_personal: costo del viaje al buzón por compra, en moneda local. 0 si el comprador pasa de todos modos. */
  costoViaje: number
  /** cruce_personal: franquicia de pasajero por persona y cruce, en USD. */
  franquiciaUsd: number
  /** cruce_personal: tasa global sobre el excedente de la franquicia. */
  tasaExcedente: number
  /** cruce_personal: valor máximo por encima del cual el pago simplificado no aplica y hace falta agente aduanal. */
  topeSimplificadoUsd: number
  /** paqueteria: tarifa del buzón por reenviar un paquete a casa, en moneda local. */
  tarifaReenvio: number
  diasTransitoEstimados: number
  /** Si el consignatario tiene RFC: requisito del procedimiento simplificado de paquetería en México. */
  consignatarioConRfc: boolean
}

/**
 * Buzón de recepción en Texas, con cruce personal por tierra.
 * Franquicia: la tabla PRODECON 2026 indica 500 USD por vía terrestre (300 USD en las reglas de 2024; 150 USD para
 * residentes de la franja fronteriza, regla 3.4.1 RGCE). Qué monto aplica al comprador: por confirmar.
 * Excedente: tasa global del 19 % sobre lo que supere la franquicia, con factura, hasta 3,000 USD (procedimiento
 * simplificado): por confirmar en RGCE 2026 / ANAM.
 */
export const buzonTexas: Mailbox = {
  clave: 'buzon_tx',
  nombre: 'Buzón Texas',
  market: 'US',
  currency: 'USD',
  impuestoVentaPct: 8.25, // tope combinado en Texas; la mayoría de las ciudades grandes lo aplican. Confirmar con la dirección.
  envioDomestico: 0,
  tarifaRecepcion: 5, // USD por paquete, supuesto; confirmar con el proveedor del buzón
  modoIngreso: 'cruce_personal',
  costoViaje: 0, // el comprador pasa por el buzón de todos modos
  franquiciaUsd: 500,
  tasaExcedente: 0.19,
  topeSimplificadoUsd: 3000,
  tarifaReenvio: 35, // solo si algún día se usa paquetería
  diasTransitoEstimados: 3,
  consignatarioConRfc: true,
}

/**
 * Importación por paquetería EE. UU. → México bajo T-MEC (esquema simplificado).
 * Fuente: alerta regulatoria FedEx MX 2025 y Country Commercial Guide de EE. UU. Vigencia por confirmar en el DOF/SAT.
 */
export const importacionUsaMexico: ImportRules = {
  origen: 'US',
  destino: 'MX',
  tiers: [
    { minUsd: 0, maxUsd: 50, tasa: 0, nota: 'Exento hasta 50 USD' },
    { minUsd: 50, maxUsd: 117, tasa: 0.17, nota: '17 % entre 50 y 117 USD (origen T-MEC)' },
    { minUsd: 117, maxUsd: 2500, tasa: 0.19, nota: '19 % tasa global entre 117 y 2,500 USD (origen T-MEC, con RFC)' },
    { minUsd: 2500, maxUsd: null, tasa: 0.19, nota: 'Por encima de 2,500 USD requiere agente aduanal; se asume 19 % como piso' },
  ],
  fuente: 'FedEx MX Reg Alert 2025; US Country Commercial Guide Mexico (customs regulations)',
  porConfirmar: true,
}

export function importTierFor(rules: ImportRules, valorUsd: number): ImportTier {
  const tier = rules.tiers.find((t) => valorUsd >= t.minUsd && (t.maxUsd === null || valorUsd < t.maxUsd))
  if (!tier) throw new Error(`CAZA: sin regla de importación para ${valorUsd} USD`)
  return tier
}

export const mailboxes: Record<string, Mailbox> = { [buzonTexas.clave]: buzonTexas }
export const importRules: ImportRules[] = [importacionUsaMexico]
