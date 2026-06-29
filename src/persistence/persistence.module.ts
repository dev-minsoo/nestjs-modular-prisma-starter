import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PersistenceDriver } from '../config/environment';
import { DatabaseModule } from '../database/database.module';
import { DynamoDbModule } from './dynamo/dynamo-db.module';
import { DynamoHealthRepository } from './dynamo/dynamo-health.repository';
import { DynamoTodoRepository } from './dynamo/dynamo-todo.repository';
import { DynamoUserRepository } from './dynamo/dynamo-user.repository';
import { HEALTH_REPOSITORY, type HealthRepository } from './health.repository';
import { PrismaHealthRepository } from './prisma/prisma-health.repository';
import { PrismaTodoRepository } from './prisma/prisma-todo.repository';
import { PrismaUserRepository } from './prisma/prisma-user.repository';
import { TODO_REPOSITORY, type TodoRepository } from './todo.repository';
import { USER_REPOSITORY, type UserRepository } from './user.repository';

@Module({
  imports: [DatabaseModule, DynamoDbModule],
  providers: [
    DynamoHealthRepository,
    DynamoTodoRepository,
    DynamoUserRepository,
    PrismaHealthRepository,
    PrismaTodoRepository,
    PrismaUserRepository,
    {
      provide: HEALTH_REPOSITORY,
      inject: [ConfigService, DynamoHealthRepository, PrismaHealthRepository],
      useFactory: (
        configService: ConfigService,
        dynamoRepository: HealthRepository,
        prismaRepository: HealthRepository,
      ): HealthRepository => {
        return selectPersistenceAdapter(
          configService,
          prismaRepository,
          dynamoRepository,
        );
      },
    },
    {
      provide: TODO_REPOSITORY,
      inject: [ConfigService, DynamoTodoRepository, PrismaTodoRepository],
      useFactory: (
        configService: ConfigService,
        dynamoRepository: TodoRepository,
        prismaRepository: TodoRepository,
      ): TodoRepository => {
        return selectPersistenceAdapter(
          configService,
          prismaRepository,
          dynamoRepository,
        );
      },
    },
    {
      provide: USER_REPOSITORY,
      inject: [ConfigService, DynamoUserRepository, PrismaUserRepository],
      useFactory: (
        configService: ConfigService,
        dynamoRepository: UserRepository,
        prismaRepository: UserRepository,
      ): UserRepository => {
        return selectPersistenceAdapter(
          configService,
          prismaRepository,
          dynamoRepository,
        );
      },
    },
  ],
  exports: [HEALTH_REPOSITORY, TODO_REPOSITORY, USER_REPOSITORY],
})
export class PersistenceModule {}

function selectPersistenceAdapter<T>(
  configService: ConfigService,
  prismaRepository: T,
  dynamoRepository: T,
): T {
  const persistenceDriver =
    configService.getOrThrow<PersistenceDriver>('PERSISTENCE_DRIVER');

  switch (persistenceDriver) {
    case 'dynamo':
      return dynamoRepository;
    case 'prisma':
      return prismaRepository;
  }
}
