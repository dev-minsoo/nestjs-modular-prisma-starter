import { ConflictException, NotFoundException } from '@nestjs/common';
import type { PasswordService } from '../../common/security';
import { Role } from '../../generated/prisma/enums';
import {
  DuplicateUserEmailError,
  UserNotFoundError,
  type UserRepository,
} from '../../persistence';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<UserRepository>;
  let passwordService: jest.Mocked<Pick<PasswordService, 'hash'>>;

  const now = new Date('2026-06-11T05:00:00.000Z');
  const sampleUser = {
    id: '2e0a35e2-e1d5-4b3f-a5c6-d15ce8f7a524',
    email: 'minsoo@example.com',
    name: 'Minsoo Kim',
    passwordHash: 'hashed-password',
    role: Role.USER,
    createdAt: now,
    updatedAt: now,
  };
  const sampleUserResponse = {
    id: sampleUser.id,
    email: sampleUser.email,
    name: sampleUser.name,
    role: sampleUser.role,
    createdAt: sampleUser.createdAt,
    updatedAt: sampleUser.updatedAt,
  };

  beforeEach(() => {
    userRepository = {
      create: jest.fn(),
      createSignupUser: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    passwordService = {
      hash: jest.fn().mockResolvedValue('hashed-password'),
    };

    service = new UsersService(userRepository, passwordService);
  });

  it('creates a user', async () => {
    userRepository.create.mockResolvedValue(sampleUser);

    await expect(
      service.create({
        email: sampleUser.email,
        name: sampleUser.name,
        password: 'strong-password',
      }),
    ).resolves.toEqual(sampleUserResponse);

    expect(passwordService.hash).toHaveBeenCalledWith('strong-password');
    expect(userRepository.create).toHaveBeenCalledWith({
      email: sampleUser.email,
      name: sampleUser.name,
      passwordHash: 'hashed-password',
      role: Role.USER,
    });
  });

  it('maps duplicate email errors to ConflictException', async () => {
    userRepository.create.mockRejectedValue(new DuplicateUserEmailError());

    await expect(
      service.create({
        email: sampleUser.email,
        password: 'strong-password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns paginated users with default ordering', async () => {
    userRepository.findAll.mockResolvedValue({
      items: [sampleUser],
      total: 1,
    });

    await expect(service.findAll()).resolves.toEqual({
      items: [sampleUserResponse],
      meta: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    });

    expect(userRepository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 20,
        orderBy: 'createdAt',
        orderDirection: 'desc',
      }),
    );
  });

  it('applies search, pagination, and ordering to user list', async () => {
    const query: ListUsersQueryDto = {
      page: 2,
      pageSize: 5,
      search: ' Minsoo ',
      orderBy: 'email',
      orderDirection: 'asc',
    };

    userRepository.findAll.mockResolvedValue({
      items: [sampleUser],
      total: 7,
    });

    await expect(service.findAll(query)).resolves.toEqual({
      items: [sampleUserResponse],
      meta: {
        page: 2,
        pageSize: 5,
        total: 7,
        totalPages: 2,
      },
    });

    expect(userRepository.findAll).toHaveBeenCalledWith(query);
  });

  it('finds one user by id', async () => {
    userRepository.findById.mockResolvedValue(sampleUser);

    await expect(service.findOne(sampleUser.id)).resolves.toEqual(
      sampleUserResponse,
    );
    expect(userRepository.findById).toHaveBeenCalledWith(sampleUser.id);
  });

  it('throws NotFoundException when a user is missing', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(service.findOne(sampleUser.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates a user', async () => {
    userRepository.update.mockResolvedValue({
      ...sampleUser,
      name: 'Updated Name',
    });

    await expect(
      service.update(sampleUser.id, { name: 'Updated Name' }),
    ).resolves.toEqual({
      ...sampleUserResponse,
      name: 'Updated Name',
    });

    expect(userRepository.update).toHaveBeenCalledWith(sampleUser.id, {
      name: 'Updated Name',
    });
  });

  it('maps update missing-record errors to NotFoundException', async () => {
    userRepository.update.mockRejectedValue(
      new UserNotFoundError(sampleUser.id),
    );

    await expect(
      service.update(sampleUser.id, { name: 'Updated Name' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps update duplicate email errors to ConflictException', async () => {
    userRepository.update.mockRejectedValue(new DuplicateUserEmailError());

    await expect(
      service.update(sampleUser.id, { email: sampleUser.email }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('removes a user', async () => {
    userRepository.delete.mockResolvedValue(sampleUser);

    await expect(service.remove(sampleUser.id)).resolves.toEqual(
      sampleUserResponse,
    );
    expect(userRepository.delete).toHaveBeenCalledWith(sampleUser.id);
  });

  it('maps delete missing-record errors to NotFoundException', async () => {
    userRepository.delete.mockRejectedValue(
      new UserNotFoundError(sampleUser.id),
    );

    await expect(service.remove(sampleUser.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
