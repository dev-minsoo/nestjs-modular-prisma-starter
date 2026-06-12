import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: {
    getHealth: jest.Mock;
  };
  let response: Pick<Response, 'status'>;

  beforeEach(async () => {
    healthService = {
      getHealth: jest.fn(),
    };
    response = {
      status: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: healthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns an ok status when all checks pass', async () => {
    const health = {
      status: 'ok',
      uptime: 12.34,
      timestamp: '2026-06-11T05:00:00.000Z',
      checks: {
        database: 'ok',
      },
    };

    healthService.getHealth.mockResolvedValue(health);

    await expect(controller.getHealth(response as Response)).resolves.toBe(
      health,
    );
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('returns service unavailable when a check fails', async () => {
    const health = {
      status: 'error',
      uptime: 12.34,
      timestamp: '2026-06-11T05:00:00.000Z',
      checks: {
        database: 'error',
      },
    };

    healthService.getHealth.mockResolvedValue(health);

    await expect(controller.getHealth(response as Response)).resolves.toBe(
      health,
    );
    expect(response.status).toHaveBeenCalledWith(503);
  });
});
