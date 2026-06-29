import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { ConfigService } from '@nestjs/config';
import { ListTodosQueryDto } from '../../modules/todos/dto/list-todos-query.dto';
import { TodoNotFoundError } from '../repository-errors';
import { DynamoTodoRepository } from './dynamo-todo.repository';
import { todoKey } from './dynamo-items';

describe('DynamoTodoRepository', () => {
  let repository: DynamoTodoRepository;
  let documentClient: {
    send: jest.Mock;
  };

  const now = '2026-06-16T05:00:00.000Z';
  const sampleTodo = {
    pk: todoKey('3e04e290-47a2-47bf-bba5-955055c60115'),
    entityType: 'TODO',
    id: '3e04e290-47a2-47bf-bba5-955055c60115',
    title: 'Read NestJS docs',
    description: 'Focus on modules',
    completed: false,
    ownerId: '2e0a35e2-e1d5-4b3f-a5c6-d15ce8f7a524',
    createdAt: now,
    updatedAt: now,
  } as const;

  beforeEach(() => {
    documentClient = {
      send: jest.fn(),
    };

    repository = new DynamoTodoRepository(
      documentClient as unknown as DynamoDBDocumentClient,
      createConfigService(),
    );
  });

  it('creates a todo', async () => {
    documentClient.send.mockResolvedValue({});

    await expect(
      repository.create({
        title: sampleTodo.title,
        description: sampleTodo.description,
        ownerId: sampleTodo.ownerId,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        title: sampleTodo.title,
        description: sampleTodo.description,
        completed: false,
        ownerId: sampleTodo.ownerId,
      }),
    );

    const command = documentClient.send.mock.calls[0][0] as PutCommand;
    expect(command).toBeInstanceOf(PutCommand);
    expect(command.input.Item).toEqual(
      expect.objectContaining({
        entityType: 'TODO',
        title: sampleTodo.title,
      }),
    );
  });

  it('lists todos with owner, search, completion, ordering, and pagination', async () => {
    const otherTodo = {
      ...sampleTodo,
      pk: todoKey('ac309676-1f40-48ad-b5b7-325630188dff'),
      id: 'ac309676-1f40-48ad-b5b7-325630188dff',
      title: 'Archive notes',
      ownerId: '7829cc33-7ba8-45be-9b26-39b62f3984d9',
      completed: true,
    };
    const query: ListTodosQueryDto & { ownerId: string } = {
      page: 1,
      pageSize: 20,
      search: 'nest',
      completed: false,
      orderBy: 'title',
      orderDirection: 'asc',
      ownerId: sampleTodo.ownerId,
    };

    documentClient.send.mockResolvedValue({
      Items: [otherTodo, sampleTodo],
    });

    await expect(repository.findAll(query)).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: sampleTodo.id,
        }),
      ],
      total: 1,
    });

    const command = documentClient.send.mock.calls[0][0] as ScanCommand;
    expect(command).toBeInstanceOf(ScanCommand);
    expect(command.input.FilterExpression).toBe('entityType = :entityType');
  });

  it('updates a todo and allows description to be cleared', async () => {
    documentClient.send
      .mockResolvedValueOnce({ Item: sampleTodo })
      .mockResolvedValueOnce({});

    await expect(
      repository.update(sampleTodo.id, { description: null }),
    ).resolves.toEqual(
      expect.objectContaining({
        description: null,
      }),
    );

    const getCommand = documentClient.send.mock.calls[0][0] as GetCommand;
    const putCommand = documentClient.send.mock.calls[1][0] as PutCommand;

    expect(getCommand).toBeInstanceOf(GetCommand);
    expect(putCommand.input.Item).toEqual(
      expect.objectContaining({
        description: null,
      }),
    );
  });

  it('throws when updating a missing todo', async () => {
    documentClient.send.mockResolvedValue({});

    await expect(
      repository.update(sampleTodo.id, { completed: true }),
    ).rejects.toBeInstanceOf(TodoNotFoundError);
  });
});

function createConfigService(): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'DYNAMODB_TABLE_NAME') {
        return 'test-table';
      }

      throw new Error(`Unexpected config key: ${key}`);
    }),
  } as unknown as ConfigService;
}
