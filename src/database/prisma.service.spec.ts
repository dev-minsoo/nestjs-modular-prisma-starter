import { Prisma } from '../generated/prisma/client';
import { PrismaService } from './prisma.service';

type TransactionClientMock = {
  user: Record<string, never>;
};

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

  it('runs a callback inside an interactive transaction', async () => {
    const tx = { user: {} };
    const callback = jest.fn().mockResolvedValue('result');
    const transaction = jest.fn((transactionCallback: TransactionCallback) =>
      transactionCallback(tx),
    );
    const service = createPrismaService({
      $transaction: transaction,
    });

    await expect(
      service.runInTransaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 100,
        timeout: 5_000,
      }),
    ).resolves.toBe('result');

    expect(transaction).toHaveBeenCalledWith(callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 100,
      timeout: 5_000,
    });
    expect(callback).toHaveBeenCalledWith(tx);
  });

  it('retries retryable transaction conflicts', async () => {
    const callback = jest.fn().mockResolvedValue('result');
    const transaction = jest
      .fn()
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Write conflict', {
          code: 'P2034',
          clientVersion: 'test',
        }),
      )
      .mockResolvedValueOnce('result');
    const service = createPrismaService({
      $transaction: transaction,
    });

    await expect(
      service.runInTransaction(callback, { maxRetries: 1 }),
    ).resolves.toBe('result');

    expect(transaction).toHaveBeenCalledTimes(2);
  });

  function createPrismaService(methods: {
    $connect?: jest.Mock;
    $disconnect?: jest.Mock;
    $transaction?: jest.Mock;
  }): PrismaService {
    return Object.assign(Object.create(PrismaService.prototype), {
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      $transaction: jest.fn(),
      ...methods,
    }) as PrismaService;
  }
});

type TransactionCallback = (tx: TransactionClientMock) => Promise<string>;
