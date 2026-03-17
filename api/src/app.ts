import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { getConfig } from './config.js';
import { routes } from './routes/index.js';

export async function buildApp() {
  const config = getConfig();
  const app = Fastify({
    logger: config.nodeEnv !== 'test'
  });

  await app.register(cors, {
    origin: true,
    credentials: true
  });

  await app.register(cookie, {
    secret: config.authSecret
  });

  await app.register(formbody);

  app.decorate('config', config);

  app.get('/api-meta', async () => ({
    service: 'matrixmanager-api',
    runtime: 'node-typescript',
    env: config.matrixEnv,
    activeDbType: config.activeDbType,
    installMode: config.installMode
  }));

  await app.register(routes);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: ReturnType<typeof getConfig>;
  }
}
