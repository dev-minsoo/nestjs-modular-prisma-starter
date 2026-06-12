import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '../../generated/prisma/enums';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    signup: jest.Mock;
    login: jest.Mock;
    getMe: jest.Mock;
  };

  const now = new Date('2026-06-11T05:00:00.000Z');
  const sampleUser = {
    id: '2e0a35e2-e1d5-4b3f-a5c6-d15ce8f7a524',
    email: 'minsoo@example.com',
    name: 'Minsoo Kim',
    role: Role.USER,
    createdAt: now,
    updatedAt: now,
  };
  const authResponse = {
    accessToken: 'access-token',
    tokenType: 'Bearer' as const,
    expiresIn: 900,
    user: sampleUser,
  };

  beforeEach(async () => {
    authService = {
      signup: jest.fn(),
      login: jest.fn(),
      getMe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('delegates signup requests to the service', async () => {
    const dto = {
      email: sampleUser.email,
      name: sampleUser.name,
      password: 'strong-password',
    };

    authService.signup.mockResolvedValue(authResponse);

    await expect(controller.signup(dto)).resolves.toEqual(authResponse);
    expect(authService.signup).toHaveBeenCalledWith(dto);
  });

  it('delegates login requests to the service', async () => {
    const dto = {
      email: sampleUser.email,
      password: 'strong-password',
    };

    authService.login.mockResolvedValue(authResponse);

    await expect(controller.login(dto)).resolves.toEqual(authResponse);
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('delegates me requests to the service', async () => {
    const currentUser = {
      id: sampleUser.id,
      email: sampleUser.email,
      role: sampleUser.role,
    };

    authService.getMe.mockResolvedValue(sampleUser);

    await expect(controller.me(currentUser)).resolves.toEqual(sampleUser);
    expect(authService.getMe).toHaveBeenCalledWith(currentUser);
  });
});
