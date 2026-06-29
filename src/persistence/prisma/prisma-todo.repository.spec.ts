import type { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { Role } from '../../generated/prisma/enums';
import { ListTodosQueryDto } from '../../modules/todos/dto/list-todos-query.dto';
import { TodoNotFoundError } from '../repository-errors';
import type { ListTodosInput } from '../todo.repository';
import { PrismaTodoRepository } from './prisma-todo.repository';

type PrismaTodoMock = {
  create: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
  findUnique: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

describe('PrismaTodoRepository', () => {
  let repository: PrismaTodoRepository;
  let prisma: {
    $transaction: jest.Mock;
    todo: PrismaTodoMock;
  };

  const now = new Date('2026-06-16T05:00:00.000Z');
  const owner = {
    id: '2e0a35e2-e1d5-4b3f-a5c6-d15ce8f7a524',
    email: 'owner@example.com',
    role: Role.USER,
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

    repository = new PrismaTodoRepository(prisma as unknown as PrismaService);
  });

  it('creates a todo', async () => {
    prisma.todo.create.mockResolvedValue(sampleTodo);

    await expect(
      repository.create({
        title: sampleTodo.title,
        description: sampleTodo.description,
        ownerId: owner.id,
      }),
    ).resolves.toEqual(sampleTodo);

    expect(prisma.todo.create).toHaveBeenCalledWith({
      data: {
        title: sampleTodo.title,
        description: sampleTodo.description,
        ownerId: owner.id,
      },
    });
  });

  it('filters todo lists by owner for regular users', async () => {
    const query: ListTodosInput = {
      ...new ListTodosQueryDto(),
      ownerId: owner.id,
    };

    prisma.todo.findMany.mockResolvedValue([sampleTodo]);
    prisma.todo.count.mockResolvedValue(1);

    await expect(repository.findAll(query)).resolves.toEqual({
      items: [sampleTodo],
      total: 1,
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

  it('applies admin filters without owner scope', async () => {
    const query: ListTodosInput = {
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

    await repository.findAll(query);

    expect(prisma.todo.findMany).toHaveBeenCalledWith({
      where,
      orderBy: { title: 'asc' },
      skip: 5,
      take: 5,
    });
    expect(prisma.todo.count).toHaveBeenCalledWith({ where });
  });

  it('finds, updates, and deletes todos by id', async () => {
    prisma.todo.findUnique.mockResolvedValue(sampleTodo);
    prisma.todo.update.mockResolvedValue({ ...sampleTodo, completed: true });
    prisma.todo.delete.mockResolvedValue(sampleTodo);

    await expect(repository.findById(sampleTodo.id)).resolves.toEqual(
      sampleTodo,
    );
    expect(prisma.todo.findUnique).toHaveBeenCalledWith({
      where: { id: sampleTodo.id },
    });

    await expect(
      repository.update(sampleTodo.id, { completed: true }),
    ).resolves.toEqual({ ...sampleTodo, completed: true });
    expect(prisma.todo.update).toHaveBeenCalledWith({
      where: { id: sampleTodo.id },
      data: { completed: true },
    });

    await expect(repository.delete(sampleTodo.id)).resolves.toEqual(sampleTodo);
    expect(prisma.todo.delete).toHaveBeenCalledWith({
      where: { id: sampleTodo.id },
    });
  });

  it('maps Prisma missing-record errors', async () => {
    prisma.todo.update.mockRejectedValue(prismaError('P2025'));

    await expect(
      repository.update(sampleTodo.id, { completed: true }),
    ).rejects.toBeInstanceOf(TodoNotFoundError);
  });
});
