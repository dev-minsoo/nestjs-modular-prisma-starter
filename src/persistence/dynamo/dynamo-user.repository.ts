import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { getPaginationParams } from '../../common/pagination';
import { Role } from '../../generated/prisma/enums';
import type {
  ListUsersQueryDto,
  UserListOrderBy,
} from '../../modules/users/dto/list-users-query.dto';
import type { UpdateUserDto } from '../../modules/users/dto/update-user.dto';
import {
  DuplicateUserEmailError,
  UserNotFoundError,
} from '../repository-errors';
import type {
  CreateUserInput,
  SignupUserInput,
  UserListResult,
  UserRepository,
  UserWithPassword,
} from '../user.repository';
import { DYNAMODB_DOCUMENT_CLIENT } from './dynamo-db.module';
import {
  ADMIN_MARKER_KEY,
  emailKey,
  type DynamoAdminMarkerItem,
  type DynamoEmailItem,
  type DynamoTodoItem,
  type DynamoUserItem,
  toUserRecord,
  userKey,
} from './dynamo-items';
import { compareValues, scanAllItems } from './dynamo-utils';
import { isConditionalWriteFailure } from './dynamo-errors';

@Injectable()
export class DynamoUserRepository implements UserRepository {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT)
    private readonly documentClient: DynamoDBDocumentClient,
    configService: ConfigService,
  ) {
    this.tableName = configService.getOrThrow<string>('DYNAMODB_TABLE_NAME');
  }

  async create(data: CreateUserInput) {
    return toUserRecord(await this.createUserItem(data, data.role));
  }

  async createSignupUser(data: SignupUserInput): Promise<UserWithPassword> {
    const adminMarker = await this.findAdminMarker();
    const requestedRole = adminMarker ? Role.USER : Role.ADMIN;

    try {
      return this.toUserWithPassword(
        await this.createUserItem(data, requestedRole, {
          requireAdminMarkerAbsent: requestedRole === Role.ADMIN,
        }),
      );
    } catch (error) {
      if (
        requestedRole !== Role.ADMIN ||
        !(await this.isAdminMarkerPresent())
      ) {
        throw error;
      }

      if (await this.isEmailTaken(data.email)) {
        throw new DuplicateUserEmailError();
      }

      return this.toUserWithPassword(
        await this.createUserItem(data, Role.USER),
      );
    }
  }

  async findAll(query: ListUsersQueryDto): Promise<UserListResult> {
    const users = await this.scanUsers();
    const search = query.search?.trim().toLowerCase();
    const filteredUsers = search
      ? users.filter(
          (user) =>
            user.email.toLowerCase().includes(search) ||
            (user.name?.toLowerCase().includes(search) ?? false),
        )
      : users;
    const sortedUsers = [...filteredUsers].sort((left, right) =>
      this.compareUsers(left, right, query.orderBy),
    );

    if (query.orderDirection === 'desc') {
      sortedUsers.reverse();
    }

    const { skip, take } = getPaginationParams(query);

    return {
      items: sortedUsers.slice(skip, skip + take).map(toUserRecord),
      total: sortedUsers.length,
    };
  }

  async findById(id: string): Promise<UserWithPassword | null> {
    const item = await this.getUserItem(id);

    if (!item) {
      return null;
    }

    return {
      ...toUserRecord(item),
      passwordHash: item.passwordHash,
    };
  }

  async findByEmail(email: string): Promise<UserWithPassword | null> {
    const emailItem = await this.getEmailItem(email);

    if (!emailItem) {
      return null;
    }

    return this.findById(emailItem.userId);
  }

  async update(id: string, data: UpdateUserDto) {
    const existingUser = await this.getUserItem(id);

    if (!existingUser) {
      throw new UserNotFoundError(id);
    }

    const updatedUser: DynamoUserItem = {
      ...existingUser,
      email: data.email ?? existingUser.email,
      name: data.name ?? existingUser.name,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (data.email && data.email !== existingUser.email) {
        await this.documentClient.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: this.tableName,
                  Item: {
                    pk: emailKey(data.email),
                    entityType: 'EMAIL',
                    email: data.email,
                    userId: id,
                    createdAt: updatedUser.updatedAt,
                  } satisfies DynamoEmailItem,
                  ConditionExpression: 'attribute_not_exists(pk)',
                },
              },
              {
                Put: {
                  TableName: this.tableName,
                  Item: updatedUser,
                  ConditionExpression: 'attribute_exists(pk)',
                },
              },
              {
                Delete: {
                  TableName: this.tableName,
                  Key: {
                    pk: emailKey(existingUser.email),
                  },
                },
              },
            ],
          }),
        );
      } else {
        await this.documentClient.send(
          new PutCommand({
            TableName: this.tableName,
            Item: updatedUser,
            ConditionExpression: 'attribute_exists(pk)',
          }),
        );
      }
    } catch (error) {
      if (isConditionalWriteFailure(error)) {
        throw new DuplicateUserEmailError();
      }

      throw error;
    }

    return toUserRecord(updatedUser);
  }

  async delete(id: string) {
    const existingUser = await this.getUserItem(id);

    if (!existingUser) {
      throw new UserNotFoundError(id);
    }

    const todos = await this.scanTodosByOwner(id);

    for (const todo of todos) {
      await this.documentClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            pk: todo.pk,
          },
        }),
      );
    }

    const adminMarkerShouldBeDeleted =
      existingUser.role === Role.ADMIN && !(await this.hasOtherAdminUser(id));

    const transactItems: NonNullable<
      TransactWriteCommandInput['TransactItems']
    > = [
      {
        Delete: {
          TableName: this.tableName,
          Key: {
            pk: userKey(id),
          },
          ConditionExpression: 'attribute_exists(pk)',
        },
      },
      {
        Delete: {
          TableName: this.tableName,
          Key: {
            pk: emailKey(existingUser.email),
          },
        },
      },
    ];

    if (adminMarkerShouldBeDeleted) {
      transactItems.push({
        Delete: {
          TableName: this.tableName,
          Key: {
            pk: ADMIN_MARKER_KEY,
          },
        },
      });
    }

    try {
      await this.documentClient.send(
        new TransactWriteCommand({
          TransactItems: transactItems,
        }),
      );
    } catch (error) {
      if (isConditionalWriteFailure(error)) {
        throw new UserNotFoundError(id);
      }

      throw error;
    }

    return toUserRecord(existingUser);
  }

  private async createUserItem(
    data: SignupUserInput,
    role: Role,
    options: { requireAdminMarkerAbsent?: boolean } = {},
  ): Promise<DynamoUserItem> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const userItem: DynamoUserItem = {
      pk: userKey(id),
      entityType: 'USER',
      id,
      email: data.email,
      name: data.name ?? null,
      passwordHash: data.passwordHash,
      role,
      createdAt: now,
      updatedAt: now,
    };

    const transactItems: NonNullable<
      TransactWriteCommandInput['TransactItems']
    > = [
      {
        Put: {
          TableName: this.tableName,
          Item: userItem,
          ConditionExpression: 'attribute_not_exists(pk)',
        },
      },
      {
        Put: {
          TableName: this.tableName,
          Item: {
            pk: emailKey(data.email),
            entityType: 'EMAIL',
            email: data.email,
            userId: id,
            createdAt: now,
          } satisfies DynamoEmailItem,
          ConditionExpression: 'attribute_not_exists(pk)',
        },
      },
    ];

    if (role === Role.ADMIN) {
      transactItems.push({
        Put: {
          TableName: this.tableName,
          Item: {
            pk: ADMIN_MARKER_KEY,
            entityType: 'ADMIN_MARKER',
            userId: id,
            createdAt: now,
          } satisfies DynamoAdminMarkerItem,
          ConditionExpression: options.requireAdminMarkerAbsent
            ? 'attribute_not_exists(pk)'
            : undefined,
        },
      });
    }

    try {
      await this.documentClient.send(
        new TransactWriteCommand({
          TransactItems: transactItems,
        }),
      );
    } catch (error) {
      if (isConditionalWriteFailure(error)) {
        throw new DuplicateUserEmailError();
      }

      throw error;
    }

    return userItem;
  }

  private async getUserItem(id: string): Promise<DynamoUserItem | null> {
    const result = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: userKey(id),
        },
      }),
    );

    return (result.Item as DynamoUserItem | undefined) ?? null;
  }

  private toUserWithPassword(item: DynamoUserItem): UserWithPassword {
    return {
      ...toUserRecord(item),
      passwordHash: item.passwordHash,
    };
  }

  private async getEmailItem(email: string): Promise<DynamoEmailItem | null> {
    const result = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: emailKey(email),
        },
      }),
    );

    return (result.Item as DynamoEmailItem | undefined) ?? null;
  }

  private async findAdminMarker(): Promise<DynamoAdminMarkerItem | null> {
    const result = await this.documentClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: ADMIN_MARKER_KEY,
        },
        ConsistentRead: true,
      }),
    );

    return (result.Item as DynamoAdminMarkerItem | undefined) ?? null;
  }

  private async isAdminMarkerPresent(): Promise<boolean> {
    return (await this.findAdminMarker()) !== null;
  }

  private async isEmailTaken(email: string): Promise<boolean> {
    return (await this.getEmailItem(email)) !== null;
  }

  private async hasOtherAdminUser(userId: string): Promise<boolean> {
    const users = await this.scanUsers();

    return users.some((user) => user.id !== userId && user.role === Role.ADMIN);
  }

  private scanUsers(): Promise<DynamoUserItem[]> {
    return scanAllItems<DynamoUserItem>(this.documentClient, {
      TableName: this.tableName,
      FilterExpression: 'entityType = :entityType',
      ExpressionAttributeValues: {
        ':entityType': 'USER',
      },
    });
  }

  private scanTodosByOwner(ownerId: string): Promise<DynamoTodoItem[]> {
    return scanAllItems<DynamoTodoItem>(this.documentClient, {
      TableName: this.tableName,
      FilterExpression: 'entityType = :entityType AND ownerId = :ownerId',
      ExpressionAttributeValues: {
        ':entityType': 'TODO',
        ':ownerId': ownerId,
      },
    });
  }

  private compareUsers(
    left: DynamoUserItem,
    right: DynamoUserItem,
    orderBy: UserListOrderBy,
  ): number {
    switch (orderBy) {
      case 'email':
        return compareValues(left.email, right.email);
      case 'name':
        return compareValues(left.name, right.name);
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
