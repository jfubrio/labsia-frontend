import type { Market, Currency } from '../types.js'

/**
 * Logística de compra en el extranjero: buzones de recepción y reglas de importación a México.
 *
 * Con un buzón en Texas, una compra en una tienda de EE. UU. es una compra DOMÉSTICA en EE. UU. (paga impuesto de
 * venta de Texas, envío doméstico normalmente gratis) que después se reenvía a México (tarifa del buzón) y paga
 * impuestos de importación por paquetería. El precio aterrizado suma todo eso en MXN; solo así es comparable con
 * una oferta local.
 *
 * Todos los números de aquí son supuestos de fase 1 marcados "por confirmar" en el plan (sección 8).
 */

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
  /** Tarifa del buzón por reenviar un paquete a México, en moneda local del buzón. */
  tarifaReenvio: number
  diasTransitoEstimados: number
  /** Si el consignatario tiene RFC: requisito del procedimiento simplificado de paquetería en México. */
  consignatarioConRfc: boolean
}

/** Buzón de recepción en Texas. Dirección exacta y tarifa real: por confirmar. */
export const buzonTexas: Mailbox = {
  clave: 'buzon_tx',
  nombre: 'Buzón Texas',
  market: 'US',
  currency: 'USD',
  impuestoVentaPct: 8.25, // tope combinado en Texas; la mayoría de las ciudades grandes lo aplican. Confirmar con la dirección.
  envioDomestico: 0,
  tarifaReenvio: 35, // USD por paquete, supuesto; confirmar con el proveedor del buzón
  diasTransitoEstimados: 7,
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
