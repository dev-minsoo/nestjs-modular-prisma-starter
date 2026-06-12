import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { Prisma } from '../src/generated/prisma/client';
import { Role } from '../src/generated/prisma/enums';
import type { ErrorResponseDto } from '../src/common/errors';
import { AppLogger, REQUEST_ID_HEADER } from '../src/common/logging';

type ExpectedErrorResponse = Omit<ErrorResponseDto, 'timestamp' | 'details'> & {
  details?: string[];
};

type PrismaServiceMock = {
  $connect: jest.Mock;
  $disconnect: jest.Mock;
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
  runInTransaction: jest.Mock;
  user: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

type TransactionCallback = (tx: PrismaServiceMock) => Promise<unknown>;

function expectErrorResponse(body: unknown, expected: ExpectedErrorResponse) {
  const expectedBody: Record<string, unknown> = {
    statusCode: expected.statusCode,
    code: expected.code,
    message: expected.message,
    path: expected.path,
    timestamp: expect.any(String) as unknown,
    requestId: expected.requestId ?? (expect.any(String) as unknown),
  };

  if (expected.details) {
    expectedBody.details = expect.arrayContaining(expected.details) as unknown;
  }

  expect(body).toEqual(expectedBody);
}

describe('AppModule (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let prisma: PrismaServiceMock;

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
    createdAt: sampleUser.createdAt.toISOString(),
    updatedAt: sampleUser.updatedAt.toISOString(),
  };

  const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('Prisma request failed', {
      code,
      clientVersion: 'test',
    });

  beforeEach(async () => {
    prisma = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $queryRaw: jest.fn(),
      $transaction: jest.fn((queries: Promise<unknown>[]) =>
        Promise.all(queries),
      ),
      runInTransaction: jest.fn((callback: TransactionCallback) =>
        callback(prisma),
      ),
      user: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(AppLogger)
      .useValue({
        error: jest.fn(),
        info: jest.fn(),
        warnWithMetadata: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    jwtService = app.get(JwtService);
  });

  it('/api/health (GET)', () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    return request(app.getHttpServer())
      .get('/api/health')
      .set(REQUEST_ID_HEADER, 'e2e-health-request')
      .expect(200)
      .expect(REQUEST_ID_HEADER, 'e2e-health-request')
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            status: 'ok',
            checks: {
              database: 'ok',
            },
          }),
        );
      });
  });

  it('/api/health (GET) returns 503 when database check fails', () => {
    prisma.$queryRaw.mockRejectedValue(new Error('database unavailable'));

    return request(app.getHttpServer())
      .get('/api/health')
      .set(REQUEST_ID_HEADER, 'e2e-health-failure-request')
      .expect(503)
      .expect(REQUEST_ID_HEADER, 'e2e-health-failure-request')
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            status: 'error',
            checks: {
              database: 'error',
            },
          }),
        );
      });
  });

  it('/api/auth/signup (POST) signs up the first user as admin', () => {
    prisma.user.count.mockResolvedValue(0);
    prisma.user.create.mockImplementation(
      ({
        data,
      }: {
        data: {
          email: string;
          name?: string;
          passwordHash: string;
          role: Role;
        };
      }) =>
        Promise.resolve({
          ...sampleUser,
          email: data.email,
          name: data.name ?? null,
          passwordHash: data.passwordHash,
          role: data.role,
        }),
    );

    return request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        email: sampleUser.email,
        name: sampleUser.name,
        password: 'strong-password',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          accessToken: expect.any(String) as unknown,
          tokenType: 'Bearer',
          expiresIn: 900,
          user: {
            ...sampleUserResponse,
            role: Role.ADMIN,
          },
        });
        expect(body).not.toHaveProperty('user.passwordHash');
        expect(prisma.runInTransaction).toHaveBeenCalledWith(
          expect.any(Function),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxRetries: 2,
          },
        );
        expect(prisma.user.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              passwordHash: expect.any(String) as unknown,
              role: Role.ADMIN,
            }) as unknown,
          }),
        );
      });
  });

  it('/api/auth/login (POST) returns an access token', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...sampleUser,
      passwordHash: await bcrypt.hash('strong-password', 10),
    });

    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: sampleUser.email,
        password: 'strong-password',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          accessToken: expect.any(String) as unknown,
          tokenType: 'Bearer',
          expiresIn: 900,
          user: sampleUserResponse,
        });
      });
  });

  it('/api/auth/me (GET) returns the authenticated user', () => {
    prisma.user.findUnique.mockResolvedValue(sampleUser);

    return request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${createAccessToken(Role.USER)}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(sampleUserResponse);
      });
  });

  it('/api/users (POST) creates a user for admins', () => {
    prisma.user.create.mockResolvedValue(sampleUser);

    return request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${createAccessToken(Role.ADMIN)}`)
      .send({
        email: sampleUser.email,
        name: sampleUser.name,
        password: 'strong-password',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual(sampleUserResponse);
      });
  });

  it('/api/users (POST) rejects validation failures', () => {
    return request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${createAccessToken(Role.ADMIN)}`)
      .set(REQUEST_ID_HEADER, 'e2e-validation-request')
      .send({
        email: 'not-an-email',
        password: 'short',
      })
      .expect(400)
      .expect(({ body }) => {
        expectErrorResponse(body, {
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          path: '/api/users',
          requestId: 'e2e-validation-request',
          details: [
            'email must be an email',
            'password must be longer than or equal to 8 characters',
          ],
        });
        expect(prisma.user.create).not.toHaveBeenCalled();
      });
  });

  it('/api/users (POST) maps duplicate email to 409', () => {
    prisma.user.create.mockRejectedValue(prismaError('P2002'));

    return request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${createAccessToken(Role.ADMIN)}`)
      .set(REQUEST_ID_HEADER, 'e2e-conflict-request')
      .send({
        email: sampleUser.email,
        password: 'strong-password',
      })
      .expect(409)
      .expect(({ body }) => {
        expectErrorResponse(body, {
          statusCode: 409,
          code: 'CONFLICT',
          message: 'A user with this email already exists',
          path: '/api/users',
          requestId: 'e2e-conflict-request',
        });
      });
  });

  it('/api/users (GET) returns paginated users', () => {
    prisma.user.findMany.mockResolvedValue([sampleUser]);
    prisma.user.count.mockResolvedValue(1);

    return request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${createAccessToken(Role.ADMIN)}`)
      .query({
        page: '2',
        pageSize: '1',
        search: 'minsoo',
        orderBy: 'email',
        orderDirection: 'asc',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          items: [sampleUserResponse],
          meta: {
            page: 2,
            pageSize: 1,
            total: 1,
            totalPages: 1,
          },
        });
        expect(prisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { email: 'asc' },
            skip: 1,
            take: 1,
          }),
        );
      });
  });

  it('/api/users (GET) rejects invalid pagination', () => {
    return request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${createAccessToken(Role.ADMIN)}`)
      .set(REQUEST_ID_HEADER, 'e2e-pagination-request')
      .query({
        page: '0',
      })
      .expect(400)
      .expect(({ body }) => {
        expectErrorResponse(body, {
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          path: '/api/users?page=0',
          requestId: 'e2e-pagination-request',
          details: ['page must not be less than 1'],
        });
        expect(prisma.user.findMany).not.toHaveBeenCalled();
      });
  });

  it('/api/users (GET) rejects missing and insufficient credentials', async () => {
    await request(app.getHttpServer()).get('/api/users').expect(401);

    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${createAccessToken(Role.USER)}`)
      .expect(403);
  });

  it('/api/users/:id (GET) maps missing records to 404', () => {
    prisma.user.findUnique.mockResolvedValue(null);

    return request(app.getHttpServer())
      .get(`/api/users/${sampleUser.id}`)
      .set('Authorization', `Bearer ${createAccessToken(Role.USER)}`)
      .set(REQUEST_ID_HEADER, 'e2e-get-missing-request')
      .expect(404)
      .expect(({ body }) => {
        expectErrorResponse(body, {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: `User ${sampleUser.id} was not found`,
          path: `/api/users/${sampleUser.id}`,
          requestId: 'e2e-get-missing-request',
        });
      });
  });

  it('/api/users/:id (PATCH) maps missing records to 404', () => {
    prisma.user.update.mockRejectedValue(prismaError('P2025'));

    return request(app.getHttpServer())
      .patch(`/api/users/${sampleUser.id}`)
      .set('Authorization', `Bearer ${createAccessToken(Role.USER)}`)
      .set(REQUEST_ID_HEADER, 'e2e-patch-missing-request')
      .send({
        name: 'Updated Name',
      })
      .expect(404)
      .expect(({ body }) => {
        expectErrorResponse(body, {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: `User ${sampleUser.id} was not found`,
          path: `/api/users/${sampleUser.id}`,
          requestId: 'e2e-patch-missing-request',
        });
      });
  });

  afterEach(async () => {
    await app.close();
  });

  function createAccessToken(role: Role) {
    return jwtService.sign({
      sub: sampleUser.id,
      email: sampleUser.email,
      role,
    });
  }
});
