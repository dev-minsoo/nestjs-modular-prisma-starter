import {
  GetCommand,
  ScanCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { ConfigService } from '@nestjs/config';
import { Role } from '../../generated/prisma/enums';
import { ListUsersQueryDto } from '../../modules/users/dto/list-users-query.dto';
import { DuplicateUserEmailError } from '../repository-errors';
import { ADMIN_MARKER_KEY, emailKey, userKey } from './dynamo-items';
import { DynamoUserRepository } from './dynamo-user.repository';

describe('DynamoUserRepository', () => {
  let repository: DynamoUserRepository;
  let documentClient: {
    send: jest.Mock;
  };

  const now = '2026-06-11T05:00:00.000Z';
  const sampleUser = {
    pk: userKey('2e0a35e2-e1d5-4b3f-a5c6-d15ce8f7a524'),
    entityType: 'USER',
    id: '2e0a35e2-e1d5-4b3f-a5c6-d15ce8f7a524',
    email: 'minsoo@example.com',
    name: 'Minsoo Kim',
    passwordHash: 'hashed-password',
    role: Role.USER,
    createdAt: now,
    updatedAt: now,
  } as const;

  beforeEach(() => {
    documentClient = {
      send: jest.fn(),
    };

    repository = new DynamoUserRepository(
      documentClient as unknown as DynamoDBDocumentClient,
      createConfigService(),
    );
  });

  it('creates a user with a user item and email uniqueness item', async () => {
    documentClient.send.mockResolvedValue({});

    await expect(
      repository.create({
        email: sampleUser.email,
        name: sampleUser.name,
        passwordHash: sampleUser.passwordHash,
        role: Role.USER,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        email: sampleUser.email,
        name: sampleUser.name,
        role: Role.USER,
      }),
    );

    const command = documentClient.send.mock
      .calls[0][0] as TransactWriteCommand;
    expect(command).toBeInstanceOf(TransactWriteCommand);
    expect(command.input.TransactItems).toHaveLength(2);
    expect(command.input.TransactItems?.[1].Put?.Item).toEqual(
      expect.objectContaining({
        pk: emailKey(sampleUser.email),
        entityType: 'EMAIL',
      }),
    );
  });

  it('signs up the first user as ADMIN', async () => {
    documentClient.send.mockResolvedValueOnce({}).mockResolvedValueOnce({});

    await expect(
      repository.createSignupUser({
        email: sampleUser.email,
        passwordHash: sampleUser.passwordHash,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        role: Role.ADMIN,
        passwordHash: sampleUser.passwordHash,
      }),
    );

    const getCommand = documentClient.send.mock.calls[0][0] as GetCommand;
    const transactCommand = documentClient.send.mock
      .calls[1][0] as TransactWriteCommand;

    expect(getCommand).toBeInstanceOf(GetCommand);
    expect(getCommand.input.Key).toEqual({ pk: ADMIN_MARKER_KEY });
    expect(transactCommand.input.TransactItems).toHaveLength(3);
  });

  it('maps transaction failures to duplicate email errors', async () => {
    const error = new Error('conditional check failed');
    error.name = 'TransactionCanceledException';
    documentClient.send.mockRejectedValue(error);

    await expect(
      repository.create({
        email: sampleUser.email,
        passwordHash: sampleUser.passwordHash,
        role: Role.USER,
      }),
    ).rejects.toBeInstanceOf(DuplicateUserEmailError);
  });

  it('finds a user by email through the email lookup item', async () => {
    documentClient.send
      .mockResolvedValueOnce({
        Item: {
          pk: emailKey(sampleUser.email),
          entityType: 'EMAIL',
          email: sampleUser.email,
          userId: sampleUser.id,
          createdAt: now,
        },
      })
      .mockResolvedValueOnce({
        Item: sampleUser,
      });

    await expect(repository.findByEmail(sampleUser.email)).resolves.toEqual(
      expect.objectContaining({
        id: sampleUser.id,
        email: sampleUser.email,
        passwordHash: sampleUser.passwordHash,
      }),
    );

    expect(documentClient.send.mock.calls[0][0]).toBeInstanceOf(GetCommand);
    expect(documentClient.send.mock.calls[1][0]).toBeInstanceOf(GetCommand);
  });

  it('lists users with search, ordering, and pagination', async () => {
    const otherUser = {
      ...sampleUser,
      pk: userKey('7829cc33-7ba8-45be-9b26-39b62f3984d9'),
      id: '7829cc33-7ba8-45be-9b26-39b62f3984d9',
      email: 'zoe@example.com',
      name: 'Zoe',
      createdAt: '2026-06-12T05:00:00.000Z',
      updatedAt: '2026-06-12T05:00:00.000Z',
    };
    const query: ListUsersQueryDto = {
      page: 1,
      pageSize: 1,
      search: 'example',
      orderBy: 'email',
      orderDirection: 'desc',
    };

    documentClient.send.mockResolvedValue({
      Items: [sampleUser, otherUser],
    });

    await expect(repository.findAll(query)).resolves.toEqual({
      items: [
        expect.objectContaining({
          email: otherUser.email,
        }),
      ],
      total: 2,
    });

    const command = documentClient.send.mock.calls[0][0] as ScanCommand;
    expect(command).toBeInstanceOf(ScanCommand);
    expect(command.input.FilterExpression).toBe('entityType = :entityType');
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
