import serverlessExpress from '@codegenie/serverless-express';
import type { Handler } from 'aws-lambda';
import { createNestApp } from './app/create-nest-app';

let cachedHandler: Handler | undefined;

async function bootstrapLambda(): Promise<Handler> {
  const app = await createNestApp({ enableShutdownHooks: false });

  await app.init();

  return serverlessExpress({
    app: app.getHttpAdapter().getInstance(),
  });
}

export const handler: Handler = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  cachedHandler ??= await bootstrapLambda();

  return cachedHandler(event, context, callback);
};
