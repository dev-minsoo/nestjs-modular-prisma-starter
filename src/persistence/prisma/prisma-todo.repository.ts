import { Injectable } from '@nestjs/common';
import { getPaginationParams } from '../../common/pagination';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type {
  TodoListOrderBy,
  TodoListOrderDirection,
} from '../../modules/todos/dto/list-todos-query.dto';
import type { UpdateTodoDto } from '../../modules/todos/dto/update-todo.dto';
import { TodoNotFoundError } from '../repository-errors';
import type {
  CreateTodoInput,
  ListTodosInput,
  TodoListResult,
  TodoRepository,
} from '../todo.repository';

@Injectable()
export class PrismaTodoRepository implements TodoRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateTodoInput) {
    return this.prisma.todo.create({
      data,
    });
  }

  async findAll(query: ListTodosInput): Promise<TodoListResult> {
    const where = this.buildWhere(query);
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

    return { items, total };
  }

  findById(id: string) {
    return this.prisma.todo.findUnique({
      where: { id },
    });
  }

  async update(id: string, data: UpdateTodoDto) {
    try {
      return await this.prisma.todo.update({
        where: { id },
        data,
      });
    } catch (error) {
      this.handlePrismaError(error, id);
    }
  }

  async delete(id: string) {
    try {
      return await this.prisma.todo.delete({
        where: { id },
      });
    } catch (error) {
      this.handlePrismaError(error, id);
    }
  }

  private buildWhere(query: ListTodosInput): Prisma.TodoWhereInput | undefined {
    const filters: Prisma.TodoWhereInput[] = [];
    const trimmedSearch = query.search?.trim();

    if (query.ownerId) {
      filters.push({ ownerId: query.ownerId });
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

  private handlePrismaError(error: unknown, id: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new TodoNotFoundError(id);
    }

    throw error;
  }
}
