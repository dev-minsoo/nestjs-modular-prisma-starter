import type { HealthRepository } from '../../persistence';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let healthRepository: jest.Mocked<HealthRepository>;

  beforeEach(() => {
    healthRepository = {
      checkDatabase: jest.fn(),
    };
    service = new HealthService(healthRepository);
  });

  it('returns ok when the database responds', async () => {
    healthRepository.checkDatabase.mockResolvedValue(true);

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
    expect(healthRepository.checkDatabase).toHaveBeenCalled();
  });

  it('returns error when the database query fails', async () => {
    healthRepository.checkDatabase.mockResolvedValue(false);

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
