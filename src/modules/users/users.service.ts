import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PasswordService } from '../../common/security';
import { createPaginatedResult } from '../../common/pagination';
import { Role } from '../../generated/prisma/enums';
import {
  DuplicateUserEmailError,
  USER_REPOSITORY,
  UserNotFoundError,
  type UserRepository,
} from '../../persistence';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { toUserResponse } from './utils/user-response.mapper';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    private readonly passwordService: PasswordService,
  ) {}

  async create(dto: CreateUserDto) {
    const passwordHash = await this.passwordService.hash(dto.password);

    try {
      const user = await this.userRepository.create({
        email: dto.email,
        name: dto.name,
        passwordHash,
        role: dto.role ?? Role.USER,
      });

      return toUserResponse(user);
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async findAll(query: ListUsersQueryDto = new ListUsersQueryDto()) {
    const { items, total } = await this.userRepository.findAll(query);

    return createPaginatedResult(items.map(toUserResponse), total, query);
  }

  async findOne(id: string) {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User ${id} was not found`);
    }

    return toUserResponse(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    try {
      const user = await this.userRepository.update(id, dto);

      return toUserResponse(user);
    } catch (error) {
      this.handleRepositoryError(error, id);
    }
  }

  async remove(id: string) {
    try {
      const user = await this.userRepository.delete(id);

      return toUserResponse(user);
    } catch (error) {
      this.handleRepositoryError(error, id);
    }
  }

  private handleRepositoryError(error: unknown, id?: string): never {
    if (error instanceof DuplicateUserEmailError) {
      throw new ConflictException('A user with this email already exists');
    }

    if (error instanceof UserNotFoundError) {
      throw new NotFoundException(
        id ? `User ${id} was not found` : 'User was not found',
      );
    }

    throw error;
  }
}
