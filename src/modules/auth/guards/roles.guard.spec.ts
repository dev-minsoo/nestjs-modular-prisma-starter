import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../generated/prisma/enums';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let reflector: {
    getAllAndOverride: jest.Mock;
  };
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows requests when no role metadata exists', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext(Role.USER))).toBe(true);
  });

  it('allows users with a required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    expect(guard.canActivate(createContext(Role.ADMIN))).toBe(true);
  });

  it('rejects users without a required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    expect(guard.canActivate(createContext(Role.USER))).toBe(false);
  });

  function createContext(role?: Role): ExecutionContext {
    return {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({
          user: role
            ? {
                id: 'user-id',
                email: 'minsoo@example.com',
                role,
              }
            : undefined,
        }),
      }),
    } as ExecutionContext;
  }
});
