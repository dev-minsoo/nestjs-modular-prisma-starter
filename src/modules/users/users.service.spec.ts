import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UsersService } from './users.service';

type PrismaUserMock = {
  create: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
  findUnique: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    $transaction: jest.Mock;
    user: PrismaUserMock;
  };

  const now = new Date('2026-06-11T05:00:00.000Z');
  const sampleUser = {
    id: '2e0a35e2-e1d5-4b3f-a5c6-d15ce8f7a524',
    email: 'minsoo@example.com',
    name: 'Minsoo Kim',
    createdAt: now,
    updatedAt: now,
  };

  const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('Prisma request failed', {
      code,
      clientVersion: 'test',
    });

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((queries: Promise<unknown>[]) =>
        Promise.all(queries),
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

    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('creates a user', async () => {
    prisma.user.create.mockResolvedValue(sampleUser);

    await expect(
      service.create({
        email: sampleUser.email,
        name: sampleUser.name,
      }),
    ).resolves.toEqual(sampleUser);

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: sampleUser.email,
        name: sampleUser.name,
      },
    });
  });

  it('maps duplicate email errors to ConflictException', async () => {
    prisma.user.create.mockRejectedValue(prismaError('P2002'));

    await expect(
      service.create({
        email: sampleUser.email,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns paginated users with default ordering', async () => {
    prisma.user.findMany.mockResolvedValue([sampleUser]);
    prisma.user.count.mockResolvedValue(1);

    await expect(service.findAll()).resolves.toEqual({
      items: [sampleUser],
      meta: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
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

    await expect(service.findAll(query)).resolves.toEqual({
      items: [sampleUser],
      meta: {
        page: 2,
        pageSize: 5,
        total: 7,
        totalPages: 2,
      },
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { email: 'asc' },
      skip: 5,
      take: 5,
    });
    expect(prisma.user.count).toHaveBeenCalledWith({ where });
  });

  it('finds one user by id', async () => {
    prisma.user.findUnique.mockResolvedValue(sampleUser);

    await expect(service.findOne(sampleUser.id)).resolves.toEqual(sampleUser);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: sampleUser.id },
    });
  });

  it('throws NotFoundException when a user is missing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findOne(sampleUser.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates a user', async () => {
    prisma.user.update.mockResolvedValue({
      ...sampleUser,
      name: 'Updated Name',
    });

    await expect(
      service.update(sampleUser.id, { name: 'Updated Name' }),
    ).resolves.toEqual({
      ...sampleUser,
      name: 'Updated Name',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: sampleUser.id },
      data: { name: 'Updated Name' },
    });
  });

  it('maps update missing-record errors to NotFoundException', async () => {
    prisma.user.update.mockRejectedValue(prismaError('P2025'));

    await expect(
      service.update(sampleUser.id, { name: 'Updated Name' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps update duplicate email errors to ConflictException', async () => {
    prisma.user.update.mockRejectedValue(prismaError('P2002'));

    await expect(
      service.update(sampleUser.id, { email: sampleUser.email }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('removes a user', async () => {
    prisma.user.delete.mockResolvedValue(sampleUser);

    await expect(service.remove(sampleUser.id)).resolves.toEqual(sampleUser);
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: sampleUser.id },
    });
  });

  it('maps delete missing-record errors to NotFoundException', async () => {
    prisma.user.delete.mockRejectedValue(prismaError('P2025'));

    await expect(service.remove(sampleUser.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
