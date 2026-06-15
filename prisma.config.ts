import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';
import {
  DEFAULT_TEST_DATABASE_URL,
  getEnvFilePaths,
  resolveAppEnv,
} from './src/config/environment';

const appEnv = resolveAppEnv();

for (const envFilePath of getEnvFilePaths(appEnv)) {
  loadEnv({ path: envFilePath, quiet: true });
}

if (appEnv === 'test') {
  process.env.DATABASE_URL ||= DEFAULT_TEST_DATABASE_URL;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  engine: 'classic',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
