import type { FastifyPluginAsync } from 'fastify';
import { getSessionUsername } from '../auth/session.js';
import { buildGetStartedPage } from '../ui/get-started-page.js';
import { buildReactPage } from '../ui/react-shell.js';

function renderLogin(app: Parameters<FastifyPluginAsync>[0], error = '', next = '/') {
  return buildReactPage({
    page: 'login',
    title: 'Matrix Manager · Login',
    uiDevUrl: app.config.uiDevUrl,
    props: {
      error,
      next,
      logoHref: app.config.logoHref,
      githubUrl: app.config.githubRepoUrl
    }
  });
}

function renderAuthedPage(app: Parameters<FastifyPluginAsync>[0], page: 'home' | 'canvas', currentUser: string, currentPath: string) {
  return buildReactPage({
    page,
    title: 'Matrix Manager',
    uiDevUrl: app.config.uiDevUrl,
    props: {
      currentUser,
      currentPath
    }
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
    return reply.type('text/html; charset=utf-8').send(renderAuthedPage(app, 'canvas', username, '/canvas'));
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
