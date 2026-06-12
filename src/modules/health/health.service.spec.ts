import { PrismaService } from '../../database/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: {
    $queryRaw: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
    };
    service = new HealthService(prisma as unknown as PrismaService);
  });

  it('returns ok when the database responds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.getHealth()).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        checks: {
          database: 'ok',
        },
        uptime: expect.any(Number) as unknown,
        timestamp: expect.any(String) as unknown,
      }),
    );
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('returns error when the database query fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database unavailable'));

    await expect(service.getHealth()).resolves.toEqual(
      expect.objectContaining({
        status: 'error',
        checks: {
          database: 'error',
        },
      }),
    );
  });
});
