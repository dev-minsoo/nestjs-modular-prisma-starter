import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('connects when the module initializes', async () => {
    const connect = jest.fn().mockResolvedValue(undefined);
    const service = createPrismaService({
      $connect: connect,
    });

    await service.onModuleInit();

    expect(connect).toHaveBeenCalled();
  });

  it('disconnects when the module is destroyed', async () => {
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const service = createPrismaService({
      $disconnect: disconnect,
    });

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalled();
  });

  function createPrismaService(methods: {
    $connect?: jest.Mock;
    $disconnect?: jest.Mock;
  }): PrismaService {
    return Object.assign(Object.create(PrismaService.prototype), {
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      ...methods,
    }) as PrismaService;
  }
});
