import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';

@Module({
  imports: [PersistenceModule],
  controllers: [TodosController],
  providers: [TodosService],
})
export class TodosModule {}
