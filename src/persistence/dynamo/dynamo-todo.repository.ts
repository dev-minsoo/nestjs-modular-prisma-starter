import { DeleteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { getPaginationParams } from '../../common/pagination';
import type { TodoListOrderBy } from '../../modules/todos/dto/list-todos-query.dto';
import type { UpdateTodoDto } from '../../modules/todos/dto/update-todo.dto';
import { TodoNotFoundError } from '../repository-errors';
import type {
  CreateTodoInput,
  ListTodosInput,
  TodoListResult,
  TodoRepository,
} from '../todo.repository';
import { DYNAMODB_DOCUMENT_CLIENT } from './dynamo-db.module';
import { isConditionalWriteFailure } from './dynamo-errors';
import { type DynamoTodoItem, todoKey, toTodoRecord } from './dynamo-items';
import { compareValues, scanAllItems } from './dynamo-utils';

@Injectable()
export class DynamoTodoRepository implements TodoRepository {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT)
    private readonly documentClient: DynamoDBDocumentClient,
    configService: ConfigService,
  ) {
    this.tableName = configService.getOrThrow<string>('DYNAMODB_TABLE_NAME');
  }

  async create(data: CreateTodoInput) {
    const now = new Date().toISOString();
    const id = randomUUID();
    const item: DynamoTodoItem = {
      pk: todoKey(id),
      entityType: 'TODO',
      id,
      title: data.title,
      description: data.description ?? null,
      completed: false,
      ownerId: data.ownerId,
      createdAt: now,
      updatedAt: now,
    };

    await this.documentClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    );

    return toTodoRecord(item);
  }

  async findAll(query: ListTodosInput): Promise<TodoListResult> {
    const todos = await this.scanTodos();
    const search = query.search?.trim().toLowerCase();
    const filteredTodos = todos.filter((todo) => {
      if (query.ownerId && todo.ownerId !== query.ownerId) {
        return false;
      }

      if (query.completed !== undefined && todo.completed !== query.completed) {
        return false;
      }

      if (!search) {
        return true;
      }

      return (
        todo.title.toLowerCase().includes(search) ||
        (todo.description?.toLowerCase().includes(search) ?? false)
      );
    });
    const sortedTodos = [...filteredTodos].sort((left, right) =>
      this.compareTodos(left, right, query.orderBy),
    );

    if (query.orderDirection === 'desc') {
      sortedTodos.reverse();
    }

    const { skip, take } = getPaginationParams(query);

    return {
      items: sortedTodos.slice(skip, skip + take).map(toTodoRecord),
      total: sortedTodos.length,
    };
  }

  async findById(id: string) {
    const item = await this.getTodoItem(id);

    return item ? toTodoRecord(item) : null;
  }

  async update(id: string, data: UpdateTodoDto) {
    const existingTodo = await this.getTodoItem(id);

    if (!existingTodo) {
      throw new TodoNotFoundError(id);
    }

    const updatedTodo: DynamoTodoItem = {
      ...existingTodo,
      title: data.title ?? existingTodo.title,
      description: Object.prototype.hasOwnProperty.call(data, 'description')
        ? (data.description ?? null)
        : existingTodo.description,
      completed: data.completed ?? existingTodo.completed,
      updatedAt: new Date().toISOString(),
    };

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: updatedTodo,
          ConditionExpression: 'attribute_exists(pk)',
        }),
      );
    } catch (error) {
      if (isConditionalWriteFailure(error)) {
        throw new TodoNotFoundError(id);
      }

      throw error;
    }

    return toTodoRecord(updatedTodo);
  }

  async delete(id: string) {
    const existingTodo = await this.getTodoItem(id);

    if (!existingTodo) {
      throw new TodoNotFoundError(id);
    }

    try {
      await this.documentClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            pk: todoKey(id),
          },
          ConditionExpression: 'attribute_exists(pk)',
        }),
      );
    } catch (error) {
      if (isConditionalWriteFailure(error)) {
        throw new TodoNotFoundError(id);
      }

      throw error;
    }

    return toTodoRecord(existingTodo);
  }

  private async getTodoItem(id: string): Promise<DynamoTodoItem | null> {
    const result = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: todoKey(id),
        },
      }),
    );

    return (result.Item as DynamoTodoItem | undefined) ?? null;
  }

  private scanTodos(): Promise<DynamoTodoItem[]> {
    return scanAllItems<DynamoTodoItem>(this.documentClient, {
      TableName: this.tableName,
      FilterExpression: 'entityType = :entityType',
      ExpressionAttributeValues: {
        ':entityType': 'TODO',
      },
    });
  }

  private compareTodos(
    left: DynamoTodoItem,
    right: DynamoTodoItem,
    orderBy: TodoListOrderBy,
  ): number {
    switch (orderBy) {
      case 'completed':
        return compareValues(left.completed, right.completed);
      case 'title':
        return compareValues(left.title, right.title);
      case 'updatedAt':
        return compareValues(
          new Date(left.updatedAt),
          new Date(right.updatedAt),
        );
      case 'createdAt':
        return compareValues(
          new Date(left.createdAt),
          new Date(right.createdAt),
        );
    }
  }
}
