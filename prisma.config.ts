import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';
import { getEnvFilePaths } from './src/config/environment';

for (const envFilePath of getEnvFilePaths()) {
  loadEnv({ path: envFilePath, quiet: true });
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
