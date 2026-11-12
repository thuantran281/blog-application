import { env } from '../config/env.js'

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

const levelRank: Record<Exclude<LogLevel, 'silent'>, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const configuredLevel = process.env.LOG_LEVEL as LogLevel | undefined
const minimumLevel: LogLevel =
  env.NODE_ENV === 'test' && configuredLevel === undefined ? 'silent' : env.LOG_LEVEL

const secrets = [env.DB_PASSWORD, env.JWT_SECRET]
  .filter((secret) => secret.length >= 8)
  .sort((left, right) => right.length - left.length)

function redactSecrets(value: string) {
  let redacted = value

  for (const secret of secrets) {
    redacted = redacted.split(secret).join('[REDACTED]')
  }

  return redacted
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return { value: String(error) }
}

function write(
  level: Exclude<LogLevel, 'silent'>,
  message: string,
  context: Record<string, unknown> = {},
) {
  if (minimumLevel === 'silent' || levelRank[level] < levelRank[minimumLevel]) {
    return
  }

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }

  const output = redactSecrets(JSON.stringify(entry))

  if (level === 'error') {
    console.error(output)
    return
  }

  console.log(output)
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    write('debug', message, context)
  },
  info(message: string, context?: Record<string, unknown>) {
    write('info', message, context)
  },
  warn(message: string, context?: Record<string, unknown>) {
    write('warn', message, context)
  },
  error(message: string, context?: Record<string, unknown>) {
    write('error', message, context)
  },
  serializeError,
}
