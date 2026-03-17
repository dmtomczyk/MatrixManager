import type { FastifyPluginAsync } from 'fastify';
import { getSessionUsername } from '../auth/session.js';
import { buildGetStartedPage } from '../ui/get-started-page.js';
import { buildLoginPage } from '../ui/login-page.js';

function renderLogin(app: Parameters<FastifyPluginAsync>[0], error = '', next = '/') {
  return buildLoginPage({
    error,
    next,
    logoHref: app.config.logoHref,
    githubUrl: app.config.githubRepoUrl
  });
}

export const pageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request, reply) => {
    const username = getSessionUsername(request);
    if (!username) {
      return reply.redirect('/login?next=%2F');
    }
    return reply.type('text/html; charset=utf-8').send(buildGetStartedPage(username));
  });

  app.get('/canvas', async (request, reply) => {
    const username = getSessionUsername(request);
    if (!username) {
      return reply.redirect('/login?next=%2Fcanvas');
    }
    return reply.type('text/html; charset=utf-8').send(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Matrix Manager · Canvas</title><style>body{font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:32px}main{max-width:900px;margin:0 auto;background:white;border:1px solid #e2e8f0;border-radius:16px;padding:24px;box-shadow:0 10px 30px rgba(15,23,42,.05)}a{color:#0f172a}p{color:#475569;line-height:1.7}</style></head><body><main><h1>Canvas is not ported yet</h1><p>Signed in as <strong>${username}</strong>.</p><p>The TypeScript backend login and home flow are working, but the Canvas page still needs a stable TS-backed render path. For now, use <a href="/">Get Started</a> after login.</p></main></body></html>`);
  });

  app.get('/login', async (request, reply) => {
    if (getSessionUsername(request)) {
      return reply.redirect('/');
    }

    const next = typeof request.query === 'object' && request.query && 'next' in request.query
      ? String((request.query as Record<string, unknown>).next ?? '/')
      : '/';

    return reply.type('text/html; charset=utf-8').send(renderLogin(app, '', next));
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

export function renderLoginError(app: Parameters<FastifyPluginAsync>[0], error: string, next: string) {
  return renderLogin(app, error, next);
}
