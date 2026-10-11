import { z } from 'zod'

/**
 * Fase 1: las compras están deshabilitadas por diseño.
 * No basta con una variable de entorno: el ejecutor además exige PURCHASES_PHASE >= 6.
 * Cambiar esto es una decisión de la fase 6, con aprobación humana registrada.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CAZA_PHASE: z.coerce.number().int().min(0).max(8).default(1),
  PURCHASES_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  DEFAULT_AUTHORIZATION_TTL_HOURS: z.coerce.number().positive().default(24),
  USD_MXN_RATE: z.coerce.number().positive().default(18.5),
  /** Fase 2+: persistencia. Vacía en fase 1 (demo y pruebas unitarias no la necesitan). */
  DATABASE_URL: z.string().default(''),
  /** Fase 2+: programador BullMQ. Vacía si solo se corre watch:once. */
  REDIS_URL: z.string().default(''),
  /** Fase 5: token compartido de la API del operador (cabecera X-CAZA-Token). Obligatorio para levantar la API. */
  CAZA_API_TOKEN: z.string().default(''),
  CAZA_API_PORT: z.coerce.number().int().positive().default(3080),
  /** Fase 7: alertas. Webhook JSON genérico (Apprise /notify, ntfy, Slack/Discord incoming webhook, Make) y/o Telegram. */
  CAZA_NOTIFY_WEBHOOK_URL: z.string().default(''),
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_CHAT_ID: z.string().default(''),
})

export type Env = z.infer<typeof schema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const env = schema.parse(source)
  if (env.PURCHASES_ENABLED && env.CAZA_PHASE < 6) {
    throw new Error(
      `CAZA: PURCHASES_ENABLED=true no está permitido en fase ${env.CAZA_PHASE}. Las compras se habilitan a partir de la fase 6.`,
    )
  }
  return env
}

export const env: Env = loadEnv()

/** Configuración de canales de alerta a partir del entorno. */
export function notifierConfigFrom(e: Env) {
  return {
    webhookUrl: e.CAZA_NOTIFY_WEBHOOK_URL || undefined,
    telegramBotToken: e.TELEGRAM_BOT_TOKEN || undefined,
    telegramChatId: e.TELEGRAM_CHAT_ID || undefined,
  }
}
