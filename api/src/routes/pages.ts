import type { FastifyPluginAsync } from 'fastify';
import { getSessionUsername } from '../auth/session.js';
import { createEmployee, createOrganization, listEmployees, listOrganizations } from '../features/workforce/service.js';
import { buildGetStartedPage } from '../ui/get-started-page.js';
import { buildLoginPage } from '../ui/login-page.js';
import { renderAppChrome } from '../ui/chrome.js';
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
    const chrome = renderAppChrome(username, '/canvas');
    const uiDevUrl = app.config.uiDevUrl.replace(/\/$/, '');
    const bootPayload = JSON.stringify({ currentUser: username, currentPath: '/canvas' }).replaceAll('<', '\u003c');
    return reply.type('text/html; charset=utf-8').send(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Matrix Manager · Canvas</title><style>*{box-sizing:border-box}body{font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#0f172a;margin:0}${chrome.css}#root{min-height:100vh}.notice{max-width:1100px;margin:16px auto 0;padding:0 16px;color:#64748b;font-size:14px}</style><script type="module">import RefreshRuntime from \"${uiDevUrl}/@react-refresh\";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="${uiDevUrl}/@vite/client"></script></head><body>${chrome.html}<div class="notice">Canvas is using the React UI against the TypeScript auth flow.</div><div id="root" data-page="canvas"></div><script id="mm-react-props" type="application/json">${bootPayload}</script><script type="module" src="${uiDevUrl}/src/main.tsx"></script></body></html>`);
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
