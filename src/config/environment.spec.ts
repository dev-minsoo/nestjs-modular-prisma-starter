import {
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

  it('validates and normalizes environment values', () => {
    expect(
      validateEnvironment({
        APP_ENV: 'prod',
        PORT: '8080',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
        CORS_ORIGIN: 'https://example.com, https://admin.example.com',
      }),
    ).toEqual(
      expect.objectContaining({
        APP_ENV: 'prod',
        PORT: 8080,
        DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
        CORS_ORIGINS: ['https://example.com', 'https://admin.example.com'],
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

  it('rejects invalid PORT values', () => {
    expect(() =>
      validateEnvironment({
        APP_ENV: 'local',
        PORT: '0',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/app',
      }),
    ).toThrow('PORT must be an integer');
  });
});
