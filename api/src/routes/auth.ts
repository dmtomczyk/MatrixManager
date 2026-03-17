import type { FastifyPluginAsync } from 'fastify';
import { buildLoginPage } from '../auth/login-page.js';
import { getSessionUsername, SESSION_COOKIE_NAME, signSessionValue } from '../auth/session.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get('/login', async (request, reply) => {
    if (getSessionUsername(request)) {
      return reply.redirect('/session');
    }

    const next = typeof request.query === 'object' && request.query && 'next' in request.query
      ? String((request.query as Record<string, unknown>).next ?? '/')
      : '/';

    return reply.type('text/html; charset=utf-8').send(buildLoginPage({ next }));
  });

  app.post('/login', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');
    const next = String(body.next ?? '/');

    if (
      username !== app.config.authUsername ||
      password !== app.config.authPassword
    ) {
      reply.code(401);
      return reply.type('text/html; charset=utf-8').send(buildLoginPage({
        error: 'Invalid username or password.',
        next
      }));
    }

    const target = next.startsWith('/') && !['/login', '/logout'].includes(next) ? next : '/session';
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

  app.get('/session', async (request, reply) => {
    const username = getSessionUsername(request);
    if (!username) {
      return reply.redirect('/login?next=%2Fsession');
    }

    return {
      authenticated: true,
      username
    };
  });
};
