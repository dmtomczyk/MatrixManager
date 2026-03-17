import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import { getSessionUsername } from './auth/session.js';
import { getConfig } from './config.js';
import { routes } from './routes/index.js';
import { buildErrorPage } from './ui/error-page.js';

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

  app.setNotFoundHandler(async (request, reply) => {
    const username = getSessionUsername(request) ?? undefined;
    reply.code(404).type('text/html; charset=utf-8');
    return buildErrorPage({
      title: 'Matrix Manager · Not Found',
      heading: 'Page not found',
      message: `No page exists at ${request.url}.`,
      currentUser: username,
      currentPath: ['/', '/dashboard', '/canvas', '/orgs', '/people', '/planning', '/forecast', '/demands', '/staffing', '/job-codes'].includes(request.url) ? request.url : '/',
      statusCode: 404
    });
  });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: ReturnType<typeof getConfig>;
  }
}
