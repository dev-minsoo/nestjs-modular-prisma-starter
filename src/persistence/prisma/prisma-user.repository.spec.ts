import type { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { Role } from '../../generated/prisma/enums';
import { ListUsersQueryDto } from '../../modules/users/dto/list-users-query.dto';
import {
  DuplicateUserEmailError,
  UserNotFoundError,
} from '../repository-errors';
import { PrismaUserRepository } from './prisma-user.repository';

type PrismaUserMock = {
  create: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
  findUnique: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

type TransactionClientMock = {
  user: {
    count: jest.Mock;
    create: jest.Mock;
  };
};

describe('PrismaUserRepository', () => {
  let repository: PrismaUserRepository;
  let transactionClient: TransactionClientMock;
  let prisma: {
    $transaction: jest.Mock;
    runInTransaction: jest.Mock;
    user: PrismaUserMock;
  };

  const now = new Date('2026-06-11T05:00:00.000Z');
  const sampleUser = {
    id: '2e0a35e2-e1d5-4b3f-a5c6-d15ce8f7a524',
    email: 'minsoo@example.com',
    name: 'Minsoo Kim',
    passwordHash: 'hashed-password',
    role: Role.USER,
    createdAt: now,
    updatedAt: now,
  };

  const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('Prisma request failed', {
      code,
      clientVersion: 'test',
    });

  beforeEach(() => {
    transactionClient = {
      user: {
        count: jest.fn(),
        create: jest.fn(),
      },
    };
    prisma = {
      $transaction: jest.fn((queries: Promise<unknown>[]) =>
        Promise.all(queries),
      ),
      runInTransaction: jest.fn((callback: TransactionCallback) =>
        callback(transactionClient),
      ),
      user: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    repository = new PrismaUserRepository(prisma as unknown as PrismaService);
  });

  it('creates a user', async () => {
    prisma.user.create.mockResolvedValue(sampleUser);

    await expect(
      repository.create({
        email: sampleUser.email,
        name: sampleUser.name,
        passwordHash: sampleUser.passwordHash,
        role: Role.USER,
      }),
    ).resolves.toEqual(sampleUser);

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: sampleUser.email,
        name: sampleUser.name,
        passwordHash: sampleUser.passwordHash,
        role: Role.USER,
      },
    });
  });

  it('resolves first signup as ADMIN inside a serializable transaction', async () => {
    const adminUser = {
      ...sampleUser,
      role: Role.ADMIN,
    };

    transactionClient.user.count.mockResolvedValue(0);
    transactionClient.user.create.mockResolvedValue(adminUser);

    await expect(
      repository.createSignupUser({
        email: sampleUser.email,
        name: sampleUser.name,
        passwordHash: sampleUser.passwordHash,
      }),
    ).resolves.toEqual(adminUser);

    expect(prisma.runInTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxRetries: 2,
    });
    expect(transactionClient.user.count).toHaveBeenCalledWith({
      where: {
        role: Role.ADMIN,
      },
    });
    expect(transactionClient.user.create).toHaveBeenCalledWith({
      data: {
        email: sampleUser.email,
        name: sampleUser.name,
        passwordHash: sampleUser.passwordHash,
        role: Role.ADMIN,
      },
    });
  });

  it('resolves later signups as USER', async () => {
    transactionClient.user.count.mockResolvedValue(1);
    transactionClient.user.create.mockResolvedValue(sampleUser);

    await repository.createSignupUser({
      email: sampleUser.email,
      passwordHash: sampleUser.passwordHash,
    });

    expect(transactionClient.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: Role.USER,
        }) as unknown,
      }),
    );
  });

  it('returns paginated users with default ordering', async () => {
    prisma.user.findMany.mockResolvedValue([sampleUser]);
    prisma.user.count.mockResolvedValue(1);

    await expect(repository.findAll(new ListUsersQueryDto())).resolves.toEqual({
      items: [sampleUser],
      total: 1,
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(prisma.user.count).toHaveBeenCalledWith({ where: undefined });
  });

  it('applies search, pagination, and ordering to user list', async () => {
    const query: ListUsersQueryDto = {
      page: 2,
      pageSize: 5,
      search: ' Minsoo ',
      orderBy: 'email',
      orderDirection: 'asc',
    };
    const where = {
      OR: [
        {
          email: {
            contains: 'Minsoo',
            mode: 'insensitive',
          },
        },
        {
          name: {
            contains: 'Minsoo',
            mode: 'insensitive',
          },
        },
      ],
    };

    prisma.user.findMany.mockResolvedValue([sampleUser]);
    prisma.user.count.mockResolvedValue(7);

    await repository.findAll(query);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { email: 'asc' },
      skip: 5,
      take: 5,
    });
    expect(prisma.user.count).toHaveBeenCalledWith({ where });
  });

  it('finds users by id and email', async () => {
    prisma.user.findUnique.mockResolvedValue(sampleUser);

    await expect(repository.findById(sampleUser.id)).resolves.toEqual(
      sampleUser,
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: sampleUser.id },
    });

    await expect(repository.findByEmail(sampleUser.email)).resolves.toEqual(
      sampleUser,
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: sampleUser.email },
    });
  });

  it('maps Prisma duplicate email errors', async () => {
    prisma.user.create.mockRejectedValue(prismaError('P2002'));

    await expect(
      repository.create({
        email: sampleUser.email,
        passwordHash: sampleUser.passwordHash,
        role: Role.USER,
      }),
    ).rejects.toBeInstanceOf(DuplicateUserEmailError);
  });

  it('maps Prisma missing-record errors', async () => {
    prisma.user.update.mockRejectedValue(prismaError('P2025'));

    await expect(
      repository.update(sampleUser.id, { name: 'Updated Name' }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});

type TransactionCallback = (tx: TransactionClientMock) => Promise<unknown>;
