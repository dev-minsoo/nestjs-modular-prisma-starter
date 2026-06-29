import { ConfigService } from '@nestjs/config';
import { createNestApp } from './app/create-nest-app';

async function bootstrap() {
  const app = await createNestApp();
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('PORT');

  await app.listen(port);
}
void bootstrap();
