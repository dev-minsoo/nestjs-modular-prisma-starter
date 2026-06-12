import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { PasswordService } from '../../common/security';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { Role } from '../../generated/prisma/enums';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      count: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
    };
  };
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
    prisma = {
      user: {
        count: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    passwordService = {
      hash: jest.fn().mockResolvedValue('hashed-password'),
      compare: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('access-token'),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      passwordService,
      jwtService as unknown as JwtService,
    );
  });

  it('signs up as ADMIN when no admin exists', async () => {
    const adminUser = {
      ...sampleUser,
      role: Role.ADMIN,
    };

    prisma.user.count.mockResolvedValue(0);
    prisma.user.create.mockResolvedValue(adminUser);

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

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: sampleUser.email,
        name: sampleUser.name,
        passwordHash: 'hashed-password',
        role: Role.ADMIN,
      },
    });
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: {
        role: Role.ADMIN,
      },
    });
  });

  it('signs up as USER when an admin already exists', async () => {
    prisma.user.count.mockResolvedValue(1);
    prisma.user.create.mockResolvedValue(sampleUser);

    await service.signup({
      email: sampleUser.email,
      name: sampleUser.name,
      password: 'strong-password',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: Role.USER,
        }) as unknown,
      }),
    );
  });

  it('maps duplicate signup emails to ConflictException', async () => {
    prisma.user.count.mockResolvedValue(1);
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Duplicate email', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.signup({
        email: sampleUser.email,
        password: 'strong-password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(sampleUser);
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

    expect(passwordService.compare).toHaveBeenCalledWith(
      'strong-password',
      sampleUser.passwordHash,
    );
  });

  it('rejects missing users and invalid passwords', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({
        email: sampleUser.email,
        password: 'strong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    prisma.user.findUnique.mockResolvedValue(sampleUser);
    passwordService.compare.mockResolvedValue(false);

    await expect(
      service.login({
        email: sampleUser.email,
        password: 'strong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns the current user without passwordHash', async () => {
    prisma.user.findUnique.mockResolvedValue(sampleUser);

    await expect(
      service.getMe({
        id: sampleUser.id,
        email: sampleUser.email,
        role: sampleUser.role,
      }),
    ).resolves.toEqual(sampleUserResponse);
  });
});
