import { Inject, Injectable } from '@nestjs/common';
import { HEALTH_REPOSITORY, type HealthRepository } from '../../persistence';

export type HealthStatus = 'error' | 'ok';

export type HealthResponse = {
  status: HealthStatus;
  uptime: number;
  timestamp: string;
  checks: {
    database: HealthStatus;
  };
};

@Injectable()
export class HealthService {
  constructor(
    @Inject(HEALTH_REPOSITORY)
    private readonly healthRepository: HealthRepository,
  ) {}

  async getHealth(): Promise<HealthResponse> {
    const database = await this.checkDatabase();

    return {
      status: database === 'ok' ? 'ok' : 'error',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: {
        database,
      },
    };
  }

  private async checkDatabase(): Promise<HealthStatus> {
    return (await this.healthRepository.checkDatabase()) ? 'ok' : 'error';
  }
}
