import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { getSessionUsername } from '../auth/session.js';
import {
  createEmployee,
  createJobCode,
  createOrganization,
  deleteEmployee,
  deleteJobCode,
  deleteOrganization,
  formatWorkforceError,
  listEmployees,
  listJobCodes,
  listOrganizations,
  updateEmployee,
  updateJobCode,
  updateOrganization
} from '../features/workforce/service.js';
import { buildGetStartedPage } from '../ui/get-started-page.js';
import { buildLoginPage } from '../ui/login-page.js';
import { renderAppChrome } from '../ui/chrome.js';
import { buildEmployeesPage, buildJobCodesPage, buildOrganizationsPage } from '../ui/workforce-pages.js';

function renderLogin(app: Parameters<FastifyPluginAsync>[0], error = '', next = '/') {
  return buildLoginPage({
    error,
    next,
    logoHref: app.config.logoHref,
    githubUrl: app.config.githubRepoUrl
  });
}

function redirectWithFlash(reply: FastifyReply, path: string, message: string) {
  return reply.redirect(path + '?flash=' + encodeURIComponent(message));
}

function asBody(body: unknown): Record<string, unknown> {
  return (body ?? {}) as Record<string, unknown>;
}

function checkboxValue(value: unknown): boolean {
  return value === 'on' || value === 'true' || value === true;
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
    return reply.type('text/html; charset=utf-8').send(`<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Matrix Manager · Canvas</title><style>*{box-sizing:border-box}body{font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#0f172a;margin:0}${chrome.css}#root{min-height:100vh}.notice{max-width:1100px;margin:16px auto 0;padding:0 16px;color:#64748b;font-size:14px}</style><script type="module">import RefreshRuntime from "${uiDevUrl}/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>(type)=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module" src="${uiDevUrl}/@vite/client"></script></head><body>${chrome.html}<div class="notice">Canvas is using the React UI against the TypeScript auth flow.</div><div id="root" data-page="canvas"></div><script id="mm-react-props" type="application/json">${bootPayload}</script><script type="module" src="${uiDevUrl}/src/main.tsx"></script></body></html>`);
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
    try {
      const body = asBody(request.body);
      createOrganization({
        name: String(body.name ?? '').trim(),
        description: String(body.description ?? '').trim() || null
      });
      return redirectWithFlash(reply, '/orgs', 'Organization created.');
    } catch (error) {
      return redirectWithFlash(reply, '/orgs', formatWorkforceError(error).detail);
    }
  });

  app.post('/orgs/:organizationId/update', async (request, reply) => {
    const username = getSessionUsername(request);
    if (!username) return reply.redirect('/login?next=%2Forgs');
    try {
      const organizationId = Number((request.params as { organizationId: string }).organizationId);
      const body = asBody(request.body);
      updateOrganization(organizationId, {
        name: String(body.name ?? '').trim(),
        description: String(body.description ?? '').trim() || null
      });
      return redirectWithFlash(reply, '/orgs', 'Organization updated.');
    } catch (error) {
      return redirectWithFlash(reply, '/orgs', formatWorkforceError(error).detail);
    }
  });

  app.post('/orgs/:organizationId/delete', async (request, reply) => {
    const username = getSessionUsername(request);
    if (!username) return reply.redirect('/login?next=%2Forgs');
    const organizationId = Number((request.params as { organizationId: string }).organizationId);
    const result = deleteOrganization(organizationId);
    return redirectWithFlash(reply, '/orgs', result.ok ? 'Organization deleted.' : result.detail);
  });

  app.get('/job-codes', async (request, reply) => {
    const username = getSessionUsername(request);
    if (!username) return reply.redirect('/login?next=%2Fjob-codes');
    return reply.type('text/html; charset=utf-8').send(buildJobCodesPage(username, listJobCodes(), String((request.query as Record<string, unknown> | undefined)?.flash ?? '')));
  });

  app.post('/job-codes/create', async (request, reply) => {
    const username = getSessionUsername(request);
    if (!username) return reply.redirect('/login?next=%2Fjob-codes');
    try {
      const body = asBody(request.body);
      createJobCode({
        name: String(body.name ?? '').trim(),
        is_leader: checkboxValue(body.is_leader)
      });
      return redirectWithFlash(reply, '/job-codes', 'Job code created.');
    } catch (error) {
      return redirectWithFlash(reply, '/job-codes', formatWorkforceError(error).detail);
    }
  });

  app.post('/job-codes/:jobCodeId/update', async (request, reply) => {
    const username = getSessionUsername(request);
    if (!username) return reply.redirect('/login?next=%2Fjob-codes');
    try {
      const jobCodeId = Number((request.params as { jobCodeId: string }).jobCodeId);
      const body = asBody(request.body);
      updateJobCode(jobCodeId, {
        name: String(body.name ?? '').trim(),
        is_leader: checkboxValue(body.is_leader)
      });
      return redirectWithFlash(reply, '/job-codes', 'Job code updated.');
    } catch (error) {
      return redirectWithFlash(reply, '/job-codes', formatWorkforceError(error).detail);
    }
  });

  app.post('/job-codes/:jobCodeId/delete', async (request, reply) => {
    const username = getSessionUsername(request);
    if (!username) return reply.redirect('/login?next=%2Fjob-codes');
    const jobCodeId = Number((request.params as { jobCodeId: string }).jobCodeId);
    const result = deleteJobCode(jobCodeId);
    return redirectWithFlash(reply, '/job-codes', result.ok ? 'Job code deleted.' : result.detail);
  });

  app.get('/people', async (request, reply) => {
    const username = getSessionUsername(request);
    if (!username) return reply.redirect('/login?next=%2Fpeople');
    return reply.type('text/html; charset=utf-8').send(buildEmployeesPage(username, listEmployees(), listOrganizations(), listJobCodes(), String((request.query as Record<string, unknown> | undefined)?.flash ?? '')));
  });

  app.post('/people/create', async (request, reply) => {
    const username = getSessionUsername(request);
    if (!username) return reply.redirect('/login?next=%2Fpeople');
    try {
      const body = asBody(request.body);
      createEmployee({
        name: String(body.name ?? '').trim(),
        organization_id: Number(body.organization_id),
        job_code_id: Number(body.job_code_id),
        role: String(body.role ?? '').trim() || null,
        location: String(body.location ?? '').trim() || null,
        manager_id: body.manager_id ? Number(body.manager_id) : null,
        capacity: Number(body.capacity || 1)
      });
      return redirectWithFlash(reply, '/people', 'Employee created.');
    } catch (error) {
      return redirectWithFlash(reply, '/people', formatWorkforceError(error).detail);
    }
  });

  app.post('/people/:employeeId/update', async (request, reply) => {
    const username = getSessionUsername(request);
    if (!username) return reply.redirect('/login?next=%2Fpeople');
    try {
      const employeeId = Number((request.params as { employeeId: string }).employeeId);
      const body = asBody(request.body);
      updateEmployee(employeeId, {
        name: String(body.name ?? '').trim(),
        organization_id: Number(body.organization_id),
        job_code_id: Number(body.job_code_id),
        role: String(body.role ?? '').trim() || null,
        location: String(body.location ?? '').trim() || null,
        manager_id: body.manager_id ? Number(body.manager_id) : null,
        capacity: Number(body.capacity || 1)
      });
      return redirectWithFlash(reply, '/people', 'Employee updated.');
    } catch (error) {
      return redirectWithFlash(reply, '/people', formatWorkforceError(error).detail);
    }
  });

  app.post('/people/:employeeId/delete', async (request, reply) => {
    const username = getSessionUsername(request);
    if (!username) return reply.redirect('/login?next=%2Fpeople');
    const employeeId = Number((request.params as { employeeId: string }).employeeId);
    const result = deleteEmployee(employeeId);
    return redirectWithFlash(reply, '/people', result.ok ? 'Employee deleted.' : result.detail);
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
