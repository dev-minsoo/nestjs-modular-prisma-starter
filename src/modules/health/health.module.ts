import { Module } from '@nestjs/common';
import { PersistenceModule } from '../../persistence';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [PersistenceModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
