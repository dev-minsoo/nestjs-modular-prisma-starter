import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('PORT');
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
    .setDescription('Module-based NestJS REST API with Prisma and PostgreSQL')
    .setVersion('1.0.0')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  await app.listen(port);
}
void bootstrap();
