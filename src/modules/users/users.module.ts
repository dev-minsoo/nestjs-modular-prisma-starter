import { Module } from '@nestjs/common';
import { SecurityModule } from '../../common/security';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [DatabaseModule, SecurityModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
