import type { FastifyPluginAsync } from 'fastify';
import { workforceRoutes } from '../features/workforce/routes.js';
import { authRoutes } from './auth.js';
import { healthRoutes } from './health.js';
import { pageRoutes } from './pages.js';

export const routes: FastifyPluginAsync = async (app) => {
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(pageRoutes);
  await app.register(workforceRoutes);
};
