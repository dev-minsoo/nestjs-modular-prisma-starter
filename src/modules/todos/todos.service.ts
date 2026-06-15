import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createPaginatedResult,
  getPaginationParams,
} from '../../common/pagination';
import { AuthenticatedUser } from '../auth';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { Role } from '../../generated/prisma/enums';
import { CreateTodoDto } from './dto/create-todo.dto';
import {
  ListTodosQueryDto,
  TodoListOrderBy,
  TodoListOrderDirection,
} from './dto/list-todos-query.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoRecord, toTodoResponse } from './utils/todo-response.mapper';

@Injectable()
export class TodosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(currentUser: AuthenticatedUser, dto: CreateTodoDto) {
    const todo = await this.prisma.todo.create({
      data: {
        title: dto.title,
        description: dto.description,
        ownerId: currentUser.id,
      },
    });

    return toTodoResponse(todo);
  }

  async findAll(
    currentUser: AuthenticatedUser,
    query: ListTodosQueryDto = new ListTodosQueryDto(),
  ) {
    const where = this.buildWhere(currentUser, query);
    const orderBy = this.buildOrderBy(query.orderBy, query.orderDirection);
    const pagination = getPaginationParams(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.todo.findMany({
        where,
        orderBy,
        ...pagination,
      }),
      this.prisma.todo.count({ where }),
    ]);

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
      const todo = await this.prisma.todo.update({
        where: { id },
        data: dto,
      });

      return toTodoResponse(todo);
    } catch (error) {
      this.handlePrismaError(error, id);
    }
  }

  async remove(currentUser: AuthenticatedUser, id: string) {
    const existingTodo = await this.findTodoRecord(id);
    this.assertCanAccess(currentUser, existingTodo);

    try {
      const todo = await this.prisma.todo.delete({
        where: { id },
      });

      return toTodoResponse(todo);
    } catch (error) {
      this.handlePrismaError(error, id);
    }
  }

  private async findTodoRecord(id: string): Promise<TodoRecord> {
    const todo = await this.prisma.todo.findUnique({
      where: { id },
    });

    if (!todo) {
      throw new NotFoundException(`Todo ${id} was not found`);
    }

    return todo;
  }

  private buildWhere(
    currentUser: AuthenticatedUser,
    query: ListTodosQueryDto,
  ): Prisma.TodoWhereInput | undefined {
    const filters: Prisma.TodoWhereInput[] = [];
    const trimmedSearch = query.search?.trim();

    if (currentUser.role !== Role.ADMIN) {
      filters.push({ ownerId: currentUser.id });
    }

    if (trimmedSearch) {
      filters.push({
        OR: [
          {
            title: {
              contains: trimmedSearch,
              mode: 'insensitive',
            },
          },
          {
            description: {
              contains: trimmedSearch,
              mode: 'insensitive',
            },
          },
        ],
      });
    }

    if (query.completed !== undefined) {
      filters.push({ completed: query.completed });
    }

    if (filters.length === 0) {
      return undefined;
    }

    return { AND: filters };
  }

  private buildOrderBy(
    orderBy: TodoListOrderBy,
    orderDirection: TodoListOrderDirection,
  ): Prisma.TodoOrderByWithRelationInput {
    switch (orderBy) {
      case 'completed':
        return { completed: orderDirection };
      case 'title':
        return { title: orderDirection };
      case 'updatedAt':
        return { updatedAt: orderDirection };
      case 'createdAt':
        return { createdAt: orderDirection };
    }
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

  private handlePrismaError(error: unknown, id: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException(`Todo ${id} was not found`);
    }

    throw error;
  }
}
