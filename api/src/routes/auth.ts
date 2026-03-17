import type { FastifyPluginAsync } from 'fastify';
import { SESSION_COOKIE_NAME, signSessionValue } from '../auth/session.js';
import { authenticateUser } from '../features/admin/service.js';
import { renderLoginError } from './pages.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/login', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');
    const next = String(body.next ?? '/');

    if (!authenticateUser(username, password)) {
      reply.code(401);
      return reply.type('text/html; charset=utf-8').send(renderLoginError(app, 'Invalid username or password.', next));
    }

    const target = next.startsWith('/') && !['/login', '/logout'].includes(next) ? next : '/';
    reply.setCookie(SESSION_COOKIE_NAME, signSessionValue(username), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax'
    });
    return reply.redirect(target);
  });

  app.post('/logout', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return reply.redirect('/login');
  });

};
