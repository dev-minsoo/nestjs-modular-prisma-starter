export const APP_ENVIRONMENTS = ['local', 'dev', 'prod', 'test'] as const;
export const PERSISTENCE_DRIVERS = ['prisma', 'dynamo'] as const;

export const DEFAULT_TEST_DATABASE_URL =
  'postgresql://nest:nest@localhost:5433/nestjs_modular_test?schema=public';

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];
export type PersistenceDriver = (typeof PERSISTENCE_DRIVERS)[number];

type RawEnvironment = Record<string, unknown>;

export type ValidatedEnvironment = RawEnvironment & {
  APP_ENV: AppEnvironment;
  PERSISTENCE_DRIVER: PersistenceDriver;
  PORT: number;
  DATABASE_URL?: string;
  CORS_ORIGINS: string[];
  JWT_ACCESS_TOKEN_SECRET: string;
  AWS_REGION: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  DYNAMODB_ENDPOINT?: string;
  DYNAMODB_TABLE_NAME: string;
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
  if (appEnv === 'local') {
    return ['.env.local', '.env'];
  }

  if (appEnv === 'test') {
    return ['.env.test.local', '.env.test'];
  }

  return [`.env.${appEnv}.local`, `.env.${appEnv}`, '.env'];
}

export function validateEnvironment(config: RawEnvironment) {
  const appEnv = resolveAppEnv(
    readOptionalString(config.APP_ENV),
    readOptionalString(config.NODE_ENV),
  );
  const persistenceDriver = parsePersistenceDriver(
    readOptionalString(config.PERSISTENCE_DRIVER),
  );
  const port = parsePort(readOptionalString(config.PORT));
  const databaseUrl = parseDatabaseUrl(
    readOptionalString(config.DATABASE_URL),
    appEnv,
    persistenceDriver,
  );
  const corsOrigins = parseCorsOrigins(readOptionalString(config.CORS_ORIGIN));
  const jwtAccessTokenSecret = parseJwtAccessTokenSecret(
    readOptionalString(config.JWT_ACCESS_TOKEN_SECRET),
    appEnv,
  );
  const awsRegion = parseAwsRegion(readOptionalString(config.AWS_REGION));
  const dynamodbEndpoint = parseOptionalUrl(
    readOptionalString(config.DYNAMODB_ENDPOINT),
    'DYNAMODB_ENDPOINT',
  );
  const dynamodbTableName = parseDynamodbTableName(
    readOptionalString(config.DYNAMODB_TABLE_NAME),
    appEnv,
  );

  return {
    ...config,
    APP_ENV: appEnv,
    PERSISTENCE_DRIVER: persistenceDriver,
    PORT: port,
    DATABASE_URL: databaseUrl,
    CORS_ORIGINS: corsOrigins,
    JWT_ACCESS_TOKEN_SECRET: jwtAccessTokenSecret,
    AWS_REGION: awsRegion,
    AWS_ACCESS_KEY_ID: readOptionalString(config.AWS_ACCESS_KEY_ID),
    AWS_SECRET_ACCESS_KEY: readOptionalString(config.AWS_SECRET_ACCESS_KEY),
    DYNAMODB_ENDPOINT: dynamodbEndpoint,
    DYNAMODB_TABLE_NAME: dynamodbTableName,
  } satisfies ValidatedEnvironment;
}

function isAppEnvironment(value: string): value is AppEnvironment {
  return APP_ENVIRONMENTS.some((appEnv) => appEnv === value);
}

function parsePersistenceDriver(value: string | undefined): PersistenceDriver {
  const persistenceDriver = value?.trim() || 'prisma';

  if (isPersistenceDriver(persistenceDriver)) {
    return persistenceDriver;
  }

  throw new Error(
    `PERSISTENCE_DRIVER must be one of: ${PERSISTENCE_DRIVERS.join(', ')}. Received: ${persistenceDriver}`,
  );
}

function isPersistenceDriver(value: string): value is PersistenceDriver {
  return PERSISTENCE_DRIVERS.some((driver) => driver === value);
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

function parseDatabaseUrl(
  value: string | undefined,
  appEnv: AppEnvironment,
  persistenceDriver: PersistenceDriver,
): string | undefined {
  const databaseUrl =
    value?.trim() ||
    (appEnv === 'test' && persistenceDriver === 'prisma'
      ? DEFAULT_TEST_DATABASE_URL
      : undefined);

  if (!databaseUrl && persistenceDriver === 'prisma') {
    throw new Error('DATABASE_URL is required');
  }

  if (!databaseUrl) {
    return undefined;
  }

  let url: URL;

  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid URL');
  }

  if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must use postgresql:// or postgres://');
  }

  return databaseUrl;
}

function parseAwsRegion(value: string | undefined): string {
  const awsRegion = value?.trim() || 'us-east-1';

  if (!awsRegion) {
    throw new Error('AWS_REGION is required');
  }

  return awsRegion;
}

function parseOptionalUrl(
  value: string | undefined,
  variableName: string,
): string | undefined {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return undefined;
  }

  try {
    new URL(trimmedValue);
  } catch {
    throw new Error(`${variableName} must be a valid URL`);
  }

  return trimmedValue;
}

function parseDynamodbTableName(
  value: string | undefined,
  appEnv: AppEnvironment,
): string {
  const tableName = value?.trim() || `nestjs-modular-${appEnv}`;

  if (!/^[A-Za-z0-9_.-]{3,255}$/.test(tableName)) {
    throw new Error(
      'DYNAMODB_TABLE_NAME must be 3-255 characters and contain only letters, numbers, underscores, dots, or hyphens',
    );
  }

  return tableName;
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

function parseJwtAccessTokenSecret(
  value: string | undefined,
  appEnv: AppEnvironment,
): string {
  if (value?.trim()) {
    return value;
  }

  if (appEnv === 'test') {
    return 'test-jwt-access-token-secret';
  }

  throw new Error('JWT_ACCESS_TOKEN_SECRET is required');
}
