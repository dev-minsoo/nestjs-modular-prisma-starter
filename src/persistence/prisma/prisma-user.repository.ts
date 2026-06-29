import { Injectable } from '@nestjs/common';
import { getPaginationParams } from '../../common/pagination';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { Role } from '../../generated/prisma/enums';
import type {
  ListUsersQueryDto,
  UserListOrderBy,
  UserListOrderDirection,
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

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserInput) {
    try {
      return await this.prisma.user.create({
        data,
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async createSignupUser(data: SignupUserInput): Promise<UserWithPassword> {
    try {
      return await this.prisma.runInTransaction(
        async (tx) => {
          const role = await this.resolveSignupRole(tx);

          return tx.user.create({
            data: {
              ...data,
              role,
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxRetries: 2,
        },
      );
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(query: ListUsersQueryDto): Promise<UserListResult> {
    const where = this.buildWhere(query.search);
    const orderBy = this.buildOrderBy(query.orderBy, query.orderDirection);
    const pagination = getPaginationParams(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy,
        ...pagination,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id: string, data: UpdateUserDto) {
    try {
      return await this.prisma.user.update({
        where: { id },
        data,
      });
    } catch (error) {
      this.handlePrismaError(error, id);
    }
  }

  async delete(id: string) {
    try {
      return await this.prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      this.handlePrismaError(error, id);
    }
  }

  private buildWhere(search?: string): Prisma.UserWhereInput | undefined {
    const trimmedSearch = search?.trim();

    if (!trimmedSearch) {
      return undefined;
    }

    return {
      OR: [
        {
          email: {
            contains: trimmedSearch,
            mode: 'insensitive',
          },
        },
        {
          name: {
            contains: trimmedSearch,
            mode: 'insensitive',
          },
        },
      ],
    };
  }

  private buildOrderBy(
    orderBy: UserListOrderBy,
    orderDirection: UserListOrderDirection,
  ): Prisma.UserOrderByWithRelationInput {
    switch (orderBy) {
      case 'email':
        return { email: orderDirection };
      case 'name':
        return { name: orderDirection };
      case 'updatedAt':
        return { updatedAt: orderDirection };
      case 'createdAt':
        return { createdAt: orderDirection };
    }
  }

  private async resolveSignupRole(tx: Prisma.TransactionClient): Promise<Role> {
    const adminCount = await tx.user.count({
      where: {
        role: Role.ADMIN,
      },
    });

    return adminCount === 0 ? Role.ADMIN : Role.USER;
  }

  private handlePrismaError(error: unknown, id?: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DuplicateUserEmailError();
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new UserNotFoundError(id);
    }

    throw error;
  }
}
