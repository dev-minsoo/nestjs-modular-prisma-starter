import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return 'ok';
    } catch {
      return 'error';
    }
  }
}
