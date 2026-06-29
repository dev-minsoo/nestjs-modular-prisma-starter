import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { PasswordService } from '../../common/security';
import { Role } from '../../generated/prisma/enums';
import {
  DuplicateUserEmailError,
  type UserRepository,
} from '../../persistence';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let passwordService: jest.Mocked<Pick<PasswordService, 'compare' | 'hash'>>;
  let jwtService: {
    signAsync: jest.Mock;
  };

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
      compare: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('access-token'),
    };

    service = new AuthService(
      userRepository,
      passwordService,
      jwtService as unknown as JwtService,
    );
  });

  it('signs up with the repository resolved role', async () => {
    const adminUser = {
      ...sampleUser,
      role: Role.ADMIN,
    };

    userRepository.createSignupUser.mockResolvedValue(adminUser);

    await expect(
      service.signup({
        email: sampleUser.email,
        name: sampleUser.name,
        password: 'strong-password',
      }),
    ).resolves.toEqual({
      accessToken: 'access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        ...sampleUserResponse,
        role: Role.ADMIN,
      },
    });

    expect(passwordService.hash).toHaveBeenCalledWith('strong-password');
    expect(userRepository.createSignupUser).toHaveBeenCalledWith({
      email: sampleUser.email,
      name: sampleUser.name,
      passwordHash: 'hashed-password',
    });
  });

  it('maps duplicate signup emails to ConflictException', async () => {
    userRepository.createSignupUser.mockRejectedValue(
      new DuplicateUserEmailError(),
    );

    await expect(
      service.signup({
        email: sampleUser.email,
        password: 'strong-password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials', async () => {
    userRepository.findByEmail.mockResolvedValue(sampleUser);
    passwordService.compare.mockResolvedValue(true);

    await expect(
      service.login({
        email: sampleUser.email,
        password: 'strong-password',
      }),
    ).resolves.toEqual({
      accessToken: 'access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: sampleUserResponse,
    });

    expect(userRepository.findByEmail).toHaveBeenCalledWith(sampleUser.email);
    expect(passwordService.compare).toHaveBeenCalledWith(
      'strong-password',
      sampleUser.passwordHash,
    );
  });

  it('rejects missing users and invalid passwords', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      service.login({
        email: sampleUser.email,
        password: 'strong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    userRepository.findByEmail.mockResolvedValue(sampleUser);
    passwordService.compare.mockResolvedValue(false);

    await expect(
      service.login({
        email: sampleUser.email,
        password: 'strong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns the current user without passwordHash', async () => {
    userRepository.findById.mockResolvedValue(sampleUser);

    await expect(
      service.getMe({
        id: sampleUser.id,
        email: sampleUser.email,
        role: sampleUser.role,
      }),
    ).resolves.toEqual(sampleUserResponse);
  });
});
