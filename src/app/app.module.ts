import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getEnvFilePaths, validateEnvironment } from '../config/environment';
import { DatabaseModule } from '../database/database.module';
import { HealthModule } from '../modules/health/health.module';
import { UsersModule } from '../modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvFilePaths(),
      validate: validateEnvironment,
    }),
    DatabaseModule,
    HealthModule,
    UsersModule,
  ],
})
export class AppModule {}
