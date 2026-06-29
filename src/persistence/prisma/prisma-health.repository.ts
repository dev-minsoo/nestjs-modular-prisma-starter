import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { HealthRepository } from '../health.repository';

@Injectable()
export class PrismaHealthRepository implements HealthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return true;
    } catch {
      return false;
    }
  }
}
