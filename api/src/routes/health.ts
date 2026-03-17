import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({
    ok: true,
    service: 'matrixmanager-api',
    mode: 'typescript-migration'
  }));

  app.get('/health/ready', async () => ({
    ok: true,
    ready: true
  }));
};
