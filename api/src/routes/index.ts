import type { FastifyPluginAsync } from 'fastify';
import { authRoutes } from './auth.js';
import { healthRoutes } from './health.js';

export const routes: FastifyPluginAsync = async (app) => {
  await app.register(healthRoutes);
  await app.register(authRoutes);
};
