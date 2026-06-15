import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { Role } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import type { AuthenticatedUser } from '../auth';
import { ListTodosQueryDto } from './dto/list-todos-query.dto';
import { TodosService } from './todos.service';

type PrismaTodoMock = {
  create: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
  findUnique: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

describe('TodosService', () => {
  let service: TodosService;
  let prisma: {
    $transaction: jest.Mock;
    todo: PrismaTodoMock;
  };

  const now = new Date('2026-06-16T05:00:00.000Z');
  const owner: AuthenticatedUser = {
    id: '2e0a35e2-e1d5-4b3f-a5c6-d15ce8f7a524',
    email: 'owner@example.com',
    role: Role.USER,
  };
  const otherUser: AuthenticatedUser = {
    id: '7829cc33-7ba8-45be-9b26-39b62f3984d9',
    email: 'other@example.com',
    role: Role.USER,
  };
  const admin: AuthenticatedUser = {
    id: 'd83a27c4-0801-4f0f-bf82-0c455c8b9a2d',
    email: 'admin@example.com',
    role: Role.ADMIN,
  };
  const sampleTodo = {
    id: '3e04e290-47a2-47bf-bba5-955055c60115',
    title: 'Read NestJS docs',
    description: 'Focus on modules',
    completed: false,
    ownerId: owner.id,
    createdAt: now,
    updatedAt: now,
  };
  const sampleTodoResponse = {
    ...sampleTodo,
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
      todo: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    service = new TodosService(prisma as unknown as PrismaService);
  });

  it('creates a todo owned by the current user', async () => {
    prisma.todo.create.mockResolvedValue(sampleTodo);

    await expect(
      service.create(owner, {
        title: sampleTodo.title,
        description: sampleTodo.description,
      }),
    ).resolves.toEqual(sampleTodoResponse);

    expect(prisma.todo.create).toHaveBeenCalledWith({
      data: {
        title: sampleTodo.title,
        description: sampleTodo.description,
        ownerId: owner.id,
      },
    });
  });

  it('lists only the current user todos for regular users', async () => {
    prisma.todo.findMany.mockResolvedValue([sampleTodo]);
    prisma.todo.count.mockResolvedValue(1);

    await expect(service.findAll(owner)).resolves.toEqual({
      items: [sampleTodoResponse],
      meta: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    });

    const where = { AND: [{ ownerId: owner.id }] };
    expect(prisma.todo.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(prisma.todo.count).toHaveBeenCalledWith({ where });
  });

  it('lets admins list todos across owners with filters', async () => {
    const query: ListTodosQueryDto = {
      page: 2,
      pageSize: 5,
      search: ' docs ',
      completed: false,
      orderBy: 'title',
      orderDirection: 'asc',
    };
    const where = {
      AND: [
        {
          OR: [
            {
              title: {
                contains: 'docs',
                mode: 'insensitive',
              },
            },
            {
              description: {
                contains: 'docs',
                mode: 'insensitive',
              },
            },
          ],
        },
        { completed: false },
      ],
    };

    prisma.todo.findMany.mockResolvedValue([sampleTodo]);
    prisma.todo.count.mockResolvedValue(6);

    await expect(service.findAll(admin, query)).resolves.toEqual({
      items: [sampleTodoResponse],
      meta: {
        page: 2,
        pageSize: 5,
        total: 6,
        totalPages: 2,
      },
    });

    expect(prisma.todo.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { title: 'asc' },
      skip: 5,
      take: 5,
    });
    expect(prisma.todo.count).toHaveBeenCalledWith({ where });
  });

  it('finds a todo for its owner', async () => {
    prisma.todo.findUnique.mockResolvedValue(sampleTodo);

    await expect(service.findOne(owner, sampleTodo.id)).resolves.toEqual(
      sampleTodoResponse,
    );
    expect(prisma.todo.findUnique).toHaveBeenCalledWith({
      where: { id: sampleTodo.id },
    });
  });

  it('lets admins access todos owned by other users', async () => {
    prisma.todo.findUnique.mockResolvedValue(sampleTodo);

    await expect(service.findOne(admin, sampleTodo.id)).resolves.toEqual(
      sampleTodoResponse,
    );
  });

  it('throws NotFoundException when a todo is missing', async () => {
    prisma.todo.findUnique.mockResolvedValue(null);

    await expect(service.findOne(owner, sampleTodo.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws ForbiddenException when a user accesses another user todo', async () => {
    prisma.todo.findUnique.mockResolvedValue(sampleTodo);

    await expect(
      service.findOne(otherUser, sampleTodo.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates a todo for its owner', async () => {
    prisma.todo.findUnique.mockResolvedValue(sampleTodo);
    prisma.todo.update.mockResolvedValue({
      ...sampleTodo,
      completed: true,
    });

    await expect(
      service.update(owner, sampleTodo.id, { completed: true }),
    ).resolves.toEqual({
      ...sampleTodoResponse,
      completed: true,
    });

    expect(prisma.todo.update).toHaveBeenCalledWith({
      where: { id: sampleTodo.id },
      data: { completed: true },
    });
  });

  it('maps update missing-record errors to NotFoundException', async () => {
    prisma.todo.findUnique.mockResolvedValue(sampleTodo);
    prisma.todo.update.mockRejectedValue(prismaError('P2025'));

    await expect(
      service.update(owner, sampleTodo.id, { completed: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes a todo for an admin', async () => {
    prisma.todo.findUnique.mockResolvedValue(sampleTodo);
    prisma.todo.delete.mockResolvedValue(sampleTodo);

    await expect(service.remove(admin, sampleTodo.id)).resolves.toEqual(
      sampleTodoResponse,
    );

    expect(prisma.todo.delete).toHaveBeenCalledWith({
      where: { id: sampleTodo.id },
    });
  });
});
