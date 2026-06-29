import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppLogger } from '../common/logging';
import { AppModule } from './app.module';

export type CreateNestAppOptions = {
  enableShutdownHooks?: boolean;
};

export async function createNestApp(
  options: CreateNestAppOptions = {},
): Promise<INestApplication> {
  const { enableShutdownHooks = true } = options;
  const app = await NestFactory.create(AppModule);

  configureNestApp(app, { enableShutdownHooks });

  return app;
}

function configureNestApp(
  app: INestApplication,
  options: Required<CreateNestAppOptions>,
): void {
  app.useLogger(app.get(AppLogger));

  if (options.enableShutdownHooks) {
    app.enableShutdownHooks();
  }

  const configService = app.get(ConfigService);
  const corsOrigins = configService.get<string[]>('CORS_ORIGINS', []);

  app.setGlobalPrefix('api');

  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins });
  } else {
    app.enableCors();
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NestJS Modular Prisma Sample')
    .setDescription(
      'Module-based NestJS REST API with Prisma/PostgreSQL and DynamoDB persistence tracks',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);
}
