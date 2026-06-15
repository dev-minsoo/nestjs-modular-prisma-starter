import request from 'supertest';
import { Role } from '../src/generated/prisma/enums';
import {
  bearerToken,
  cleanupDatabase,
  closeE2eTestContext,
  createE2eTestContext,
  E2eTestContext,
  expectErrorResponse,
  httpServer,
  signupUser,
  TEST_PASSWORD,
} from './e2e-test.helpers';

describe('AppModule with real database (e2e)', () => {
  let context: E2eTestContext;

  beforeAll(async () => {
    context = await createE2eTestContext();
  });

  beforeEach(async () => {
    await cleanupDatabase(context.prisma);
  });

  afterAll(async () => {
    await closeE2eTestContext(context);
  });

  it('/api/health (GET) checks the real database connection', () => {
    return request(httpServer(context.app))
      .get('/api/health')
      .expect(200)
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

  it('signs up, authenticates, lists, updates, and deletes users through PostgreSQL', async () => {
    const adminSignup = await signupUser(context.app, {
      email: 'db-admin@example.com',
      name: 'DB Admin',
    });

    expect(adminSignup).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String) as unknown,
        tokenType: 'Bearer',
        expiresIn: 900,
        user: expect.objectContaining({
          email: 'db-admin@example.com',
          name: 'DB Admin',
          role: Role.ADMIN,
        }) as unknown,
      }),
    );

    const userSignup = await signupUser(context.app, {
      email: 'db-user@example.com',
      name: 'DB User',
    });

    expect(userSignup).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String) as unknown,
        user: expect.objectContaining({
          email: 'db-user@example.com',
          name: 'DB User',
          role: Role.USER,
        }) as unknown,
      }),
    );

    const userId = userSignup.user.id;
    const storedUser = await context.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(storedUser.passwordHash).not.toBe(TEST_PASSWORD);

    const login = await request(httpServer(context.app))
      .post('/api/auth/login')
      .send({
        email: 'db-user@example.com',
        password: TEST_PASSWORD,
      })
      .expect(200);

    const userToken = (login.body as { accessToken: string }).accessToken;

    await request(httpServer(context.app))
      .get('/api/auth/me')
      .set('Authorization', bearerToken(userToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            id: userId,
            email: 'db-user@example.com',
            role: Role.USER,
          }),
        );
      });

    await request(httpServer(context.app))
      .get('/api/users')
      .set('Authorization', bearerToken(adminSignup.accessToken))
      .query({
        search: 'db-',
        orderBy: 'email',
        orderDirection: 'asc',
      })
      .expect(200)
      .expect(({ body }) => {
        const responseBody = body as {
          items: unknown[];
          meta: Record<string, unknown>;
        };

        expect(responseBody.items).toEqual([
          expect.objectContaining({
            email: 'db-admin@example.com',
            role: Role.ADMIN,
          }),
          expect.objectContaining({
            email: 'db-user@example.com',
            role: Role.USER,
          }),
        ]);
        expect(responseBody.meta).toEqual(
          expect.objectContaining({
            page: 1,
            pageSize: 20,
            total: 2,
            totalPages: 1,
          }),
        );
      });

    await request(httpServer(context.app))
      .patch(`/api/users/${userId}`)
      .set('Authorization', bearerToken(userToken))
      .send({
        name: 'DB User Updated',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            id: userId,
            name: 'DB User Updated',
          }),
        );
      });

    await expect(
      context.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ).resolves.toEqual(
      expect.objectContaining({
        name: 'DB User Updated',
      }),
    );

    await request(httpServer(context.app))
      .delete(`/api/users/${userId}`)
      .set('Authorization', bearerToken(adminSignup.accessToken))
      .expect(204);

    await expect(
      context.prisma.user.findUnique({ where: { id: userId } }),
    ).resolves.toBeNull();
  });

  it('/api/auth/signup (POST) maps real unique constraint failures to 409', async () => {
    const payload = {
      email: 'db-duplicate@example.com',
      name: 'DB Duplicate',
    };

    await signupUser(context.app, payload);

    await request(httpServer(context.app))
      .post('/api/auth/signup')
      .send({
        password: TEST_PASSWORD,
        ...payload,
      })
      .expect(409)
      .expect(({ body }) => {
        expectErrorResponse(body, {
          statusCode: 409,
          code: 'CONFLICT',
          message: 'A user with this email already exists',
          path: '/api/auth/signup',
        });
      });
  });

  it('/api/users (GET) rejects missing credentials and non-admin users', async () => {
    await request(httpServer(context.app)).get('/api/users').expect(401);

    await signupUser(context.app, {
      email: 'db-admin@example.com',
      name: 'DB Admin',
    });
    const userSignup = await signupUser(context.app, {
      email: 'db-user@example.com',
      name: 'DB User',
    });

    await request(httpServer(context.app))
      .get('/api/users')
      .set('Authorization', bearerToken(userSignup.accessToken))
      .expect(403)
      .expect(({ body }) => {
        expectErrorResponse(body, {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Forbidden resource',
          path: '/api/users',
        });
      });
  });

  it('/api/users/:id (GET) maps missing records from PostgreSQL to 404', async () => {
    const signup = await signupUser(context.app, {
      email: 'db-user@example.com',
      name: 'DB User',
    });
    const missingUserId = '00000000-0000-4000-8000-000000000000';

    await request(httpServer(context.app))
      .get(`/api/users/${missingUserId}`)
      .set('Authorization', bearerToken(signup.accessToken))
      .expect(404)
      .expect(({ body }) => {
        expectErrorResponse(body, {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: `User ${missingUserId} was not found`,
          path: `/api/users/${missingUserId}`,
        });
      });
  });

  it('/api/users/:id (PATCH) maps real unique constraint failures to 409', async () => {
    const adminSignup = await signupUser(context.app, {
      email: 'db-admin@example.com',
      name: 'DB Admin',
    });
    const userSignup = await signupUser(context.app, {
      email: 'db-user@example.com',
      name: 'DB User',
    });

    await request(httpServer(context.app))
      .patch(`/api/users/${userSignup.user.id}`)
      .set('Authorization', bearerToken(userSignup.accessToken))
      .send({
        email: adminSignup.user.email,
      })
      .expect(409)
      .expect(({ body }) => {
        expectErrorResponse(body, {
          statusCode: 409,
          code: 'CONFLICT',
          message: 'A user with this email already exists',
          path: `/api/users/${userSignup.user.id}`,
        });
      });
  });
});
