import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createPaginatedResult,
  getPaginationParams,
} from '../../common/pagination';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
  ListUsersQueryDto,
  UserListOrderBy,
  UserListOrderDirection,
} from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    try {
      return await this.prisma.user.create({
        data: dto,
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(query: ListUsersQueryDto = new ListUsersQueryDto()) {
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

    return createPaginatedResult(items, total, query);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User ${id} was not found`);
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      this.handlePrismaError(error, id);
    }
  }

  async remove(id: string) {
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

  private handlePrismaError(error: unknown, id?: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('A user with this email already exists');
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException(
        id ? `User ${id} was not found` : 'User was not found',
      );
    }

    throw error;
  }
}
