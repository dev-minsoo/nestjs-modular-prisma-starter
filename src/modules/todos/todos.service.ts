import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createPaginatedResult } from '../../common/pagination';
import { AuthenticatedUser } from '../auth';
import { Role } from '../../generated/prisma/enums';
import {
  TODO_REPOSITORY,
  TodoNotFoundError,
  type TodoRepository,
} from '../../persistence';
import { CreateTodoDto } from './dto/create-todo.dto';
import { ListTodosQueryDto } from './dto/list-todos-query.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoRecord, toTodoResponse } from './utils/todo-response.mapper';

@Injectable()
export class TodosService {
  constructor(
    @Inject(TODO_REPOSITORY)
    private readonly todoRepository: TodoRepository,
  ) {}

  async create(currentUser: AuthenticatedUser, dto: CreateTodoDto) {
    const todo = await this.todoRepository.create({
      title: dto.title,
      description: dto.description,
      ownerId: currentUser.id,
    });

    return toTodoResponse(todo);
  }

  async findAll(
    currentUser: AuthenticatedUser,
    query: ListTodosQueryDto = new ListTodosQueryDto(),
  ) {
    const { items, total } = await this.todoRepository.findAll({
      ...query,
      ownerId: currentUser.role !== Role.ADMIN ? currentUser.id : undefined,
    });

    return createPaginatedResult(items.map(toTodoResponse), total, query);
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    const todo = await this.findTodoRecord(id);

    this.assertCanAccess(currentUser, todo);

    return toTodoResponse(todo);
  }

  async update(currentUser: AuthenticatedUser, id: string, dto: UpdateTodoDto) {
    const existingTodo = await this.findTodoRecord(id);
    this.assertCanAccess(currentUser, existingTodo);

    try {
      const todo = await this.todoRepository.update(id, dto);

      return toTodoResponse(todo);
    } catch (error) {
      this.handleRepositoryError(error, id);
    }
  }

  async remove(currentUser: AuthenticatedUser, id: string) {
    const existingTodo = await this.findTodoRecord(id);
    this.assertCanAccess(currentUser, existingTodo);

    try {
      const todo = await this.todoRepository.delete(id);

      return toTodoResponse(todo);
    } catch (error) {
      this.handleRepositoryError(error, id);
    }
  }

  private async findTodoRecord(id: string): Promise<TodoRecord> {
    const todo = await this.todoRepository.findById(id);

    if (!todo) {
      throw new NotFoundException(`Todo ${id} was not found`);
    }

    return todo;
  }

  private assertCanAccess(
    currentUser: AuthenticatedUser,
    todo: TodoRecord,
  ): void {
    if (currentUser.role === Role.ADMIN || todo.ownerId === currentUser.id) {
      return;
    }

    throw new ForbiddenException('You cannot access this todo');
  }

  private handleRepositoryError(error: unknown, id: string): never {
    if (error instanceof TodoNotFoundError) {
      throw new NotFoundException(`Todo ${id} was not found`);
    }

    throw error;
  }
}
