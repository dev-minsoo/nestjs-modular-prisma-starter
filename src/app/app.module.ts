import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from '../common/errors';
import { LoggingModule } from '../common/logging';
import { RequestContextModule } from '../common/request-context';
import { getEnvFilePaths, validateEnvironment } from '../config/environment';
import { AuthModule } from '../modules/auth';
import { HealthModule } from '../modules/health/health.module';
import { TodosModule } from '../modules/todos/todos.module';
import { UsersModule } from '../modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvFilePaths(),
      validate: validateEnvironment,
    }),
    RequestContextModule,
    LoggingModule,
    HealthModule,
    AuthModule,
    UsersModule,
    TodosModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
