import {
  DEFAULT_TEST_DATABASE_URL,
  getEnvFilePaths,
  resolveAppEnv,
  validateEnvironment,
} from './environment';

describe('environment configuration', () => {
  it('defaults to the local app environment', () => {
    expect(resolveAppEnv(undefined, undefined)).toBe('local');
  });

  it('maps common NODE_ENV values to app environments', () => {
    expect(resolveAppEnv(undefined, 'development')).toBe('dev');
    expect(resolveAppEnv(undefined, 'production')).toBe('prod');
    expect(resolveAppEnv(undefined, 'test')).toBe('test');
  });

  it('uses profile-specific env files before the base .env file', () => {
    expect(getEnvFilePaths('dev')).toEqual([
      '.env.dev.local',
      '.env.dev',
      '.env',
    ]);
  });

  it('keeps test env files isolated from the base .env file', () => {
    expect(getEnvFilePaths('test')).toEqual(['.env.test.local', '.env.test']);
  });

  it('validates and normalizes environment values', () => {
    expect(
      validateEnvironment({
        APP_ENV: 'prod',
        PORT: '8080',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
        CORS_ORIGIN: 'https://example.com, https://admin.example.com',
        JWT_ACCESS_TOKEN_SECRET: 'prod-secret',
      }),
    ).toEqual(
      expect.objectContaining({
        APP_ENV: 'prod',
        PERSISTENCE_DRIVER: 'prisma',
        PORT: 8080,
        DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
        CORS_ORIGINS: ['https://example.com', 'https://admin.example.com'],
        JWT_ACCESS_TOKEN_SECRET: 'prod-secret',
        AWS_REGION: 'us-east-1',
        DYNAMODB_TABLE_NAME: 'nestjs-modular-prod',
      }),
    );
  });

  it('uses a test JWT secret fallback in test environment', () => {
    expect(
      validateEnvironment({
        APP_ENV: 'test',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
      }),
    ).toEqual(
      expect.objectContaining({
        JWT_ACCESS_TOKEN_SECRET: 'test-jwt-access-token-secret',
      }),
    );
  });

  it('uses the default test database URL in test environment', () => {
    expect(
      validateEnvironment({
        APP_ENV: 'test',
      }),
    ).toEqual(
      expect.objectContaining({
        DATABASE_URL: DEFAULT_TEST_DATABASE_URL,
      }),
    );
  });

  it('supports DynamoDB persistence without DATABASE_URL', () => {
    expect(
      validateEnvironment({
        APP_ENV: 'local',
        PERSISTENCE_DRIVER: 'dynamo',
        DYNAMODB_ENDPOINT: 'http://localhost:4566',
        DYNAMODB_TABLE_NAME: 'nestjs-modular-local',
        JWT_ACCESS_TOKEN_SECRET: 'local-secret',
      }),
    ).toEqual(
      expect.objectContaining({
        PERSISTENCE_DRIVER: 'dynamo',
        DATABASE_URL: undefined,
        DYNAMODB_ENDPOINT: 'http://localhost:4566',
        DYNAMODB_TABLE_NAME: 'nestjs-modular-local',
      }),
    );
  });

  it('rejects invalid app environments', () => {
    expect(() => resolveAppEnv('stage', undefined)).toThrow(
      'APP_ENV must be one of',
    );
  });

  it('requires DATABASE_URL', () => {
    expect(() =>
      validateEnvironment({
        APP_ENV: 'local',
      }),
    ).toThrow('DATABASE_URL is required');
  });

  it('rejects invalid persistence drivers', () => {
    expect(() =>
      validateEnvironment({
        APP_ENV: 'local',
        PERSISTENCE_DRIVER: 'mongodb',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
        JWT_ACCESS_TOKEN_SECRET: 'local-secret',
      }),
    ).toThrow('PERSISTENCE_DRIVER must be one of');
  });

  it('rejects invalid PORT values', () => {
    expect(() =>
      validateEnvironment({
        APP_ENV: 'local',
        PORT: '0',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
        JWT_ACCESS_TOKEN_SECRET: 'local-secret',
      }),
    ).toThrow('PORT must be an integer');
  });

  it('requires JWT_ACCESS_TOKEN_SECRET outside test', () => {
    expect(() =>
      validateEnvironment({
        APP_ENV: 'local',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
      }),
    ).toThrow('JWT_ACCESS_TOKEN_SECRET is required');
  });

  it('rejects invalid DynamoDB table names', () => {
    expect(() =>
      validateEnvironment({
        APP_ENV: 'local',
        PERSISTENCE_DRIVER: 'dynamo',
        DYNAMODB_TABLE_NAME: 'no',
        JWT_ACCESS_TOKEN_SECRET: 'local-secret',
      }),
    ).toThrow('DYNAMODB_TABLE_NAME must be 3-255 characters');
  });
});
