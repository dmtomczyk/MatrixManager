import type { FastifyPluginAsync } from 'fastify';
import { getSessionUsername } from '../auth/session.js';
import { createEmployee, createOrganization, listEmployees, listOrganizations } from '../features/workforce/service.js';
import { buildGetStartedPage } from '../ui/get-started-page.js';
import { buildLoginPage } from '../ui/login-page.js';
import { buildEmployeesPage, buildOrganizationsPage } from '../ui/workforce-pages.js';

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
    return reply.type('text/html; charset=utf-8').send(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Matrix Manager · Canvas</title><style>body{font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#0f172a;margin:0}header{position:sticky;top:0;background:rgba(255,255,255,.95);backdrop-filter:blur(10px);border-bottom:1px solid #e2e8f0;padding:14px 18px;font-weight:700}#root{min-height:100vh}.notice{max-width:1100px;margin:16px auto 0;padding:0 16px;color:#64748b;font-size:14px}</style><script type="module">import RefreshRuntime from \"${app.config.uiDevUrl.replace(/\/$/, '')}/@react-refresh\";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="${app.config.uiDevUrl.replace(/\/$/, '')}/@vite/client"></script></head><body><header>Matrix Manager Canvas</header><div class="notice">Signed in as <strong>${username}</strong>. Canvas is using the React UI against the TypeScript auth flow.</div><div id="root" data-page="canvas"></div><script id="mm-react-props" type="application/json">${JSON.stringify({ currentUser: username, currentPath: '/canvas' }).replaceAll('<', '\u003c')}</script><script type="module" src="${app.config.uiDevUrl.replace(/\/$/, '')}/src/main.tsx"></script></body></html>`);
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

  app.get('/orgs', async (request, reply) => {
    const username = getSessionUsername(request);
    if (!username) return reply.redirect('/login?next=%2Forgs');
    return reply.type('text/html; charset=utf-8').send(buildOrganizationsPage(username, listOrganizations(), String((request.query as Record<string, unknown> | undefined)?.flash ?? '')));
  });

  app.post('/orgs/create', async (request, reply) => {
    const username = getSessionUsername(request);
    if (!username) return reply.redirect('/login?next=%2Forgs');
    const body = (request.body ?? {}) as Record<string, unknown>;
    createOrganization({
      name: String(body.name ?? '').trim(),
      description: String(body.description ?? '').trim() || null
    });
    return reply.redirect('/orgs?flash=' + encodeURIComponent('Organization created.'));
  });

  app.get('/people', async (request, reply) => {
    const username = getSessionUsername(request);
    if (!username) return reply.redirect('/login?next=%2Fpeople');
    return reply.type('text/html; charset=utf-8').send(buildEmployeesPage(username, listEmployees(), listOrganizations(), String((request.query as Record<string, unknown> | undefined)?.flash ?? '')));
  });

  app.post('/people/create', async (request, reply) => {
    const username = getSessionUsername(request);
    if (!username) return reply.redirect('/login?next=%2Fpeople');
    const body = (request.body ?? {}) as Record<string, unknown>;
    createEmployee({
      name: String(body.name ?? '').trim(),
      organization_id: Number(body.organization_id),
      employee_type: String(body.employee_type ?? 'IC').trim() || 'IC',
      location: String(body.location ?? '').trim() || null,
      capacity: Number(body.capacity || 1)
    });
    return reply.redirect('/people?flash=' + encodeURIComponent('Employee created.'));
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
