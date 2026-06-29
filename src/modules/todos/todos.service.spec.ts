import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '../../generated/prisma/enums';
import { TodoNotFoundError, type TodoRepository } from '../../persistence';
import type { AuthenticatedUser } from '../auth';
import { ListTodosQueryDto } from './dto/list-todos-query.dto';
import { TodosService } from './todos.service';

describe('TodosService', () => {
  let service: TodosService;
  let todoRepository: jest.Mocked<TodoRepository>;

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

  beforeEach(() => {
    todoRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    service = new TodosService(todoRepository);
  });

  it('creates a todo owned by the current user', async () => {
    todoRepository.create.mockResolvedValue(sampleTodo);

    await expect(
      service.create(owner, {
        title: sampleTodo.title,
        description: sampleTodo.description,
      }),
    ).resolves.toEqual(sampleTodoResponse);

    expect(todoRepository.create).toHaveBeenCalledWith({
      title: sampleTodo.title,
      description: sampleTodo.description,
      ownerId: owner.id,
    });
  });

  it('lists only the current user todos for regular users', async () => {
    todoRepository.findAll.mockResolvedValue({
      items: [sampleTodo],
      total: 1,
    });

    await expect(service.findAll(owner)).resolves.toEqual({
      items: [sampleTodoResponse],
      meta: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    });

    expect(todoRepository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        orderBy: 'createdAt',
        orderDirection: 'desc',
        ownerId: owner.id,
      }),
    );
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

    todoRepository.findAll.mockResolvedValue({
      items: [sampleTodo],
      total: 6,
    });

    await expect(service.findAll(admin, query)).resolves.toEqual({
      items: [sampleTodoResponse],
      meta: {
        page: 2,
        pageSize: 5,
        total: 6,
        totalPages: 2,
      },
    });

    expect(todoRepository.findAll).toHaveBeenCalledWith({
      ...query,
      ownerId: undefined,
    });
  });

  it('finds a todo for its owner', async () => {
    todoRepository.findById.mockResolvedValue(sampleTodo);

    await expect(service.findOne(owner, sampleTodo.id)).resolves.toEqual(
      sampleTodoResponse,
    );
    expect(todoRepository.findById).toHaveBeenCalledWith(sampleTodo.id);
  });

  it('lets admins access todos owned by other users', async () => {
    todoRepository.findById.mockResolvedValue(sampleTodo);

    await expect(service.findOne(admin, sampleTodo.id)).resolves.toEqual(
      sampleTodoResponse,
    );
  });

  it('throws NotFoundException when a todo is missing', async () => {
    todoRepository.findById.mockResolvedValue(null);

    await expect(service.findOne(owner, sampleTodo.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws ForbiddenException when a user accesses another user todo', async () => {
    todoRepository.findById.mockResolvedValue(sampleTodo);

    await expect(
      service.findOne(otherUser, sampleTodo.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates a todo for its owner', async () => {
    todoRepository.findById.mockResolvedValue(sampleTodo);
    todoRepository.update.mockResolvedValue({
      ...sampleTodo,
      completed: true,
    });

    await expect(
      service.update(owner, sampleTodo.id, { completed: true }),
    ).resolves.toEqual({
      ...sampleTodoResponse,
      completed: true,
    });

    expect(todoRepository.update).toHaveBeenCalledWith(sampleTodo.id, {
      completed: true,
    });
  });

  it('maps update missing-record errors to NotFoundException', async () => {
    todoRepository.findById.mockResolvedValue(sampleTodo);
    todoRepository.update.mockRejectedValue(
      new TodoNotFoundError(sampleTodo.id),
    );

    await expect(
      service.update(owner, sampleTodo.id, { completed: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes a todo for an admin', async () => {
    todoRepository.findById.mockResolvedValue(sampleTodo);
    todoRepository.delete.mockResolvedValue(sampleTodo);

    await expect(service.remove(admin, sampleTodo.id)).resolves.toEqual(
      sampleTodoResponse,
    );

    expect(todoRepository.delete).toHaveBeenCalledWith(sampleTodo.id);
  });
});
