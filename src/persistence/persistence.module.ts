import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PrismaTodoRepository } from './prisma/prisma-todo.repository';
import { PrismaUserRepository } from './prisma/prisma-user.repository';
import { TODO_REPOSITORY } from './todo.repository';
import { USER_REPOSITORY } from './user.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    PrismaTodoRepository,
    PrismaUserRepository,
    {
      provide: TODO_REPOSITORY,
      useExisting: PrismaTodoRepository,
    },
    {
      provide: USER_REPOSITORY,
      useExisting: PrismaUserRepository,
    },
  ],
  exports: [TODO_REPOSITORY, USER_REPOSITORY],
})
export class PersistenceModule {}
