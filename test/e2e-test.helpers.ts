import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app/app.module';
import { AppLogger } from '../src/common/logging';
import { PrismaService } from '../src/database/prisma.service';
import type { Role } from '../src/generated/prisma/enums';

export const TEST_PASSWORD = 'strong-password';

export type E2eApp = INestApplication;

export type E2eTestContext = {
  app: E2eApp;
  prisma: PrismaService;
};

export type SignupPayload = {
  email: string;
  name?: string;
  password?: string;
};

export type SignupResult = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    createdAt: string;
    updatedAt: string;
  };
};

export async function createE2eTestContext(): Promise<E2eTestContext> {
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

  const app = moduleFixture.createNestApplication();
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

  return {
    app,
    prisma: app.get(PrismaService),
  };
}

export async function closeE2eTestContext(
  context: E2eTestContext,
): Promise<void> {
  await cleanupDatabase(context.prisma);
  await context.app.close();
}

export async function cleanupDatabase(prisma: PrismaService): Promise<void> {
  await prisma.user.deleteMany();
}

export async function signupUser(
  app: E2eApp,
  payload: SignupPayload,
): Promise<SignupResult> {
  const response = await request(httpServer(app))
    .post('/api/auth/signup')
    .send({
      password: TEST_PASSWORD,
      ...payload,
    })
    .expect(201);

  return response.body as SignupResult;
}

export function bearerToken(accessToken: string): string {
  return `Bearer ${accessToken}`;
}

export function httpServer(app: E2eApp): App {
  return app.getHttpServer() as App;
}

export function expectErrorResponse(
  body: unknown,
  expected: Record<string, unknown>,
): void {
  expect(body).toEqual(expect.objectContaining(expected));
}

function assertTestDatabaseUrl(databaseUrl: string): void {
  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run destructive DB E2E cleanup against non-test database: ${databaseName}`,
    );
  }
}
