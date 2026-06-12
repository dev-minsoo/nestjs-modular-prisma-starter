export const APP_ENVIRONMENTS = ['local', 'dev', 'prod', 'test'] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

type RawEnvironment = Record<string, unknown>;

export type ValidatedEnvironment = RawEnvironment & {
  APP_ENV: AppEnvironment;
  PORT: number;
  DATABASE_URL: string;
  CORS_ORIGINS: string[];
};

const NODE_ENV_ALIASES: Record<string, AppEnvironment> = {
  development: 'dev',
  production: 'prod',
  test: 'test',
};

export function resolveAppEnv(
  rawAppEnv?: string,
  rawNodeEnv?: string,
): AppEnvironment {
  const appEnv = arguments.length >= 1 ? rawAppEnv : process.env.APP_ENV;
  const nodeEnv = arguments.length >= 2 ? rawNodeEnv : process.env.NODE_ENV;
  const rawEnv =
    appEnv ??
    (nodeEnv ? (NODE_ENV_ALIASES[nodeEnv] ?? nodeEnv) : undefined) ??
    'local';

  if (isAppEnvironment(rawEnv)) {
    return rawEnv;
  }

  throw new Error(
    `APP_ENV must be one of: ${APP_ENVIRONMENTS.join(', ')}. Received: ${rawEnv}`,
  );
}

export function getEnvFilePaths(appEnv = resolveAppEnv()): string[] {
  const profileFiles =
    appEnv === 'local'
      ? ['.env.local']
      : [`.env.${appEnv}.local`, `.env.${appEnv}`];

  return [...profileFiles, '.env'];
}

export function validateEnvironment(config: RawEnvironment) {
  const appEnv = resolveAppEnv(
    readOptionalString(config.APP_ENV),
    readOptionalString(config.NODE_ENV),
  );
  const port = parsePort(readOptionalString(config.PORT));
  const databaseUrl = parseDatabaseUrl(readOptionalString(config.DATABASE_URL));
  const corsOrigins = parseCorsOrigins(readOptionalString(config.CORS_ORIGIN));

  return {
    ...config,
    APP_ENV: appEnv,
    PORT: port,
    DATABASE_URL: databaseUrl,
    CORS_ORIGINS: corsOrigins,
  } satisfies ValidatedEnvironment;
}

function isAppEnvironment(value: string): value is AppEnvironment {
  return APP_ENVIRONMENTS.some((appEnv) => appEnv === value);
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  throw new Error('Environment variable values must be strings');
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? '3000');

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

function parseDatabaseUrl(value: string | undefined): string {
  if (!value) {
    throw new Error('DATABASE_URL is required');
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid URL');
  }

  if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must use postgresql:// or postgres://');
  }

  return value;
}

function parseCorsOrigins(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of origins) {
    if (origin === '*') {
      continue;
    }

    try {
      new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGIN contains an invalid URL: ${origin}`);
    }
  }

  return origins;
}
