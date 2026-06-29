import { Module } from '@nestjs/common';
import { SecurityModule } from '../../common/security';
import { PersistenceModule } from '../../persistence';
import { AuthModule } from '../auth';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PersistenceModule, SecurityModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
