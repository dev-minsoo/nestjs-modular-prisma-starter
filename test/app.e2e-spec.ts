import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { Prisma } from '../src/generated/prisma/client';
import type { ErrorResponseDto } from '../src/common/errors';

type ExpectedErrorResponse = Omit<ErrorResponseDto, 'timestamp' | 'details'> & {
  details?: string[];
};

function expectErrorResponse(body: unknown, expected: ExpectedErrorResponse) {
  const expectedBody: Record<string, unknown> = {
    statusCode: expected.statusCode,
    code: expected.code,
    message: expected.message,
    path: expected.path,
    timestamp: expect.any(String) as unknown,
  };

  if (expected.details) {
    expectedBody.details = expect.arrayContaining(expected.details) as unknown;
  }

  expect(body).toEqual(expectedBody);
}

describe('AppModule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: {
    $connect: jest.Mock;
    $disconnect: jest.Mock;
    $transaction: jest.Mock;
    user: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const now = new Date('2026-06-11T05:00:00.000Z');
  const sampleUser = {
    id: '2e0a35e2-e1d5-4b3f-a5c6-d15ce8f7a524',
    email: 'minsoo@example.com',
    name: 'Minsoo Kim',
    createdAt: now,
    updatedAt: now,
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
      $transaction: jest.fn((queries: Promise<unknown>[]) =>
        Promise.all(queries),
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
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            status: 'ok',
          }),
        );
      });
  });

  it('/api/users (POST) creates a user', () => {
    prisma.user.create.mockResolvedValue(sampleUser);

    return request(app.getHttpServer())
      .post('/api/users')
      .send({
        email: sampleUser.email,
        name: sampleUser.name,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          ...sampleUser,
          createdAt: sampleUser.createdAt.toISOString(),
          updatedAt: sampleUser.updatedAt.toISOString(),
        });
      });
  });

  it('/api/users (POST) rejects validation failures', () => {
    return request(app.getHttpServer())
      .post('/api/users')
      .send({
        email: 'not-an-email',
        role: 'admin',
      })
      .expect(400)
      .expect(({ body }) => {
        expectErrorResponse(body, {
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          path: '/api/users',
          details: ['email must be an email', 'property role should not exist'],
        });
        expect(prisma.user.create).not.toHaveBeenCalled();
      });
  });

  it('/api/users (POST) maps duplicate email to 409', () => {
    prisma.user.create.mockRejectedValue(prismaError('P2002'));

    return request(app.getHttpServer())
      .post('/api/users')
      .send({
        email: sampleUser.email,
      })
      .expect(409)
      .expect(({ body }) => {
        expectErrorResponse(body, {
          statusCode: 409,
          code: 'CONFLICT',
          message: 'A user with this email already exists',
          path: '/api/users',
        });
      });
  });

  it('/api/users (GET) returns paginated users', () => {
    prisma.user.findMany.mockResolvedValue([sampleUser]);
    prisma.user.count.mockResolvedValue(1);

    return request(app.getHttpServer())
      .get('/api/users')
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
          items: [
            {
              ...sampleUser,
              createdAt: sampleUser.createdAt.toISOString(),
              updatedAt: sampleUser.updatedAt.toISOString(),
            },
          ],
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
          details: ['page must not be less than 1'],
        });
        expect(prisma.user.findMany).not.toHaveBeenCalled();
      });
  });

  it('/api/users/:id (GET) maps missing records to 404', () => {
    prisma.user.findUnique.mockResolvedValue(null);

    return request(app.getHttpServer())
      .get(`/api/users/${sampleUser.id}`)
      .expect(404)
      .expect(({ body }) => {
        expectErrorResponse(body, {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: `User ${sampleUser.id} was not found`,
          path: `/api/users/${sampleUser.id}`,
        });
      });
  });

  it('/api/users/:id (PATCH) maps missing records to 404', () => {
    prisma.user.update.mockRejectedValue(prismaError('P2025'));

    return request(app.getHttpServer())
      .patch(`/api/users/${sampleUser.id}`)
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
        });
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
