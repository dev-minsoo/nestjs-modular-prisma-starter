import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app/app.module';
import { AppLogger } from '../src/common/logging';
import { PrismaService } from '../src/database/prisma.service';
import { Role } from '../src/generated/prisma/enums';

describe('AppModule with real database (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
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

    const configService = app.get(ConfigService);
    assertTestDatabaseUrl(configService.getOrThrow<string>('DATABASE_URL'));

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
  });

  it('/api/health (GET) checks the real database connection', () => {
    return request(app.getHttpServer())
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
    const adminSignup = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        email: 'db-admin@example.com',
        name: 'DB Admin',
        password: 'strong-password',
      })
      .expect(201);

    expect(adminSignup.body).toEqual(
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

    const adminToken = adminSignup.body.accessToken as string;

    const userSignup = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        email: 'db-user@example.com',
        name: 'DB User',
        password: 'strong-password',
      })
      .expect(201);

    expect(userSignup.body).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String) as unknown,
        user: expect.objectContaining({
          email: 'db-user@example.com',
          name: 'DB User',
          role: Role.USER,
        }) as unknown,
      }),
    );

    const userId = userSignup.body.user.id as string;
    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(storedUser.passwordHash).not.toBe('strong-password');

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'db-user@example.com',
        password: 'strong-password',
      })
      .expect(200);

    const userToken = login.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`)
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

    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        search: 'db-',
        orderBy: 'email',
        orderDirection: 'asc',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual([
          expect.objectContaining({
            email: 'db-admin@example.com',
            role: Role.ADMIN,
          }),
          expect.objectContaining({
            email: 'db-user@example.com',
            role: Role.USER,
          }),
        ]);
        expect(body.meta).toEqual(
          expect.objectContaining({
            page: 1,
            pageSize: 20,
            total: 2,
            totalPages: 1,
          }),
        );
      });

    await request(app.getHttpServer())
      .patch(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${userToken}`)
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
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ).resolves.toEqual(
      expect.objectContaining({
        name: 'DB User Updated',
      }),
    );

    await request(app.getHttpServer())
      .delete(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await expect(
      prisma.user.findUnique({ where: { id: userId } }),
    ).resolves.toBeNull();
  });

  it('/api/auth/signup (POST) maps real unique constraint failures to 409', async () => {
    const payload = {
      email: 'db-duplicate@example.com',
      name: 'DB Duplicate',
      password: 'strong-password',
    };

    await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send(payload)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send(payload)
      .expect(409)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            statusCode: 409,
            code: 'CONFLICT',
            message: 'A user with this email already exists',
            path: '/api/auth/signup',
          }),
        );
      });
  });
});

function assertTestDatabaseUrl(databaseUrl: string): void {
  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run destructive DB E2E cleanup against non-test database: ${databaseName}`,
    );
  }
}
