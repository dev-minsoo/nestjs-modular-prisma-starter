import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '../../generated/prisma/enums';
import type { AuthenticatedUser } from '../auth';
import { ListTodosQueryDto } from './dto/list-todos-query.dto';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';

describe('TodosController', () => {
  let controller: TodosController;
  let todosService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const currentUser: AuthenticatedUser = {
    id: '2e0a35e2-e1d5-4b3f-a5c6-d15ce8f7a524',
    email: 'minsoo@example.com',
    role: Role.USER,
  };
  const now = new Date('2026-06-16T05:00:00.000Z');
  const sampleTodo = {
    id: '3e04e290-47a2-47bf-bba5-955055c60115',
    title: 'Read NestJS docs',
    description: 'Focus on modules',
    completed: false,
    ownerId: currentUser.id,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(async () => {
    todosService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TodosController],
      providers: [
        {
          provide: TodosService,
          useValue: todosService,
        },
      ],
    }).compile();

    controller = module.get<TodosController>(TodosController);
  });

  it('delegates create requests to the service with the current user', async () => {
    const dto = {
      title: sampleTodo.title,
      description: sampleTodo.description,
    };

    todosService.create.mockResolvedValue(sampleTodo);

    await expect(controller.create(currentUser, dto)).resolves.toEqual(
      sampleTodo,
    );
    expect(todosService.create).toHaveBeenCalledWith(currentUser, dto);
  });

  it('delegates list queries to the service with the current user', async () => {
    const query: ListTodosQueryDto = {
      page: 1,
      pageSize: 20,
      orderBy: 'createdAt',
      orderDirection: 'desc',
    };
    const result = {
      items: [sampleTodo],
      meta: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    };

    todosService.findAll.mockResolvedValue(result);

    await expect(controller.findAll(currentUser, query)).resolves.toEqual(
      result,
    );
    expect(todosService.findAll).toHaveBeenCalledWith(currentUser, query);
  });

  it('delegates findOne requests to the service', async () => {
    todosService.findOne.mockResolvedValue(sampleTodo);

    await expect(
      controller.findOne(currentUser, sampleTodo.id),
    ).resolves.toEqual(sampleTodo);
    expect(todosService.findOne).toHaveBeenCalledWith(
      currentUser,
      sampleTodo.id,
    );
  });

  it('delegates update requests to the service', async () => {
    const dto = { completed: true };
    const updatedTodo = { ...sampleTodo, ...dto };

    todosService.update.mockResolvedValue(updatedTodo);

    await expect(
      controller.update(currentUser, sampleTodo.id, dto),
    ).resolves.toEqual(updatedTodo);
    expect(todosService.update).toHaveBeenCalledWith(
      currentUser,
      sampleTodo.id,
      dto,
    );
  });

  it('delegates delete requests to the service without a response body', async () => {
    todosService.remove.mockResolvedValue(sampleTodo);

    await expect(
      controller.remove(currentUser, sampleTodo.id),
    ).resolves.toBeUndefined();
    expect(todosService.remove).toHaveBeenCalledWith(
      currentUser,
      sampleTodo.id,
    );
  });
});
