import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '../generated/prisma/client';

export type PrismaTransactionClient = Prisma.TransactionClient;

export type PrismaTransactionOptions = {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  maxRetries?: number;
  maxWait?: number;
  timeout?: number;
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async runInTransaction<T>(
    callback: (tx: PrismaTransactionClient) => Promise<T>,
    options: PrismaTransactionOptions = {},
  ): Promise<T> {
    const { maxRetries = 0, ...transactionOptions } = options;
    let failedAttempts = 0;

    while (true) {
      try {
        return await this.$transaction(callback, transactionOptions);
      } catch (error) {
        if (!this.shouldRetryTransaction(error, failedAttempts, maxRetries)) {
          throw error;
        }

        failedAttempts += 1;
      }
    }
  }

  private shouldRetryTransaction(
    error: unknown,
    failedAttempts: number,
    maxRetries: number,
  ): boolean {
    return (
      failedAttempts < maxRetries &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }
}
