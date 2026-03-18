import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import type { FastifyInstance } from 'fastify';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'matrixmanager-api-test-'));
process.env.NODE_ENV = 'test';
process.env.MATRIX_ENV = 'test';
process.env.MATRIX_AUTH_USERNAME = 'testuser';
process.env.MATRIX_AUTH_PASSWORD = 'testpass';
process.env.MATRIX_AUTH_SECRET = 'test-secret';
process.env.MATRIX_UI_USE_DEV_SERVER = 'false';
process.env.MATRIX_TS_DATA_DB_PATH = path.join(tempRoot, 'data.sqlite');
process.env.MATRIX_TS_CONTROL_DB_PATH = path.join(tempRoot, 'control.sqlite');

const { buildApp } = await import('../src/app.js');
const { signSessionValue, SESSION_COOKIE_NAME } = await import('../src/auth/session.js');
const { workforceStore } = await import('../src/features/workforce/store.js');
const { adminStore } = await import('../src/features/admin/store.js');

let app: FastifyInstance;

function authedCookie() {
  return `${SESSION_COOKIE_NAME}=${signSessionValue('testuser')}`;
}

async function createOrganization(name = 'Engineering') {
  const response = await app.inject({ method: 'POST', url: '/organizations', payload: { name } });
  assert.equal(response.statusCode, 201, response.body);
  return response.json() as { id: number; name: string };
}

async function createJobCode(name: string, isLeader = false) {
  const response = await app.inject({ method: 'POST', url: '/job-codes-api', payload: { name, is_leader: isLeader } });
  assert.equal(response.statusCode, 201, response.body);
  return response.json() as { id: number; name: string; is_leader: boolean };
}

async function createEmployee(params: { organizationId: number; name: string; employeeType?: 'L' | 'IC'; managerId?: number | null; role?: string; capacity?: number; }) {
  const employeeType = params.employeeType ?? 'L';
  const jobCode = await createJobCode(params.role ?? `${params.name} ${employeeType === 'L' ? 'Leader' : 'IC'}`, employeeType === 'L');
  const response = await app.inject({
    method: 'POST',
    url: '/employees',
    payload: {
      name: params.name,
      organization_id: params.organizationId,
      job_code_id: jobCode.id,
      manager_id: params.managerId ?? null,
      role: params.role ?? null,
      capacity: params.capacity ?? 1
    }
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json() as { id: number; name: string; organization_id: number; manager_id: number | null };
}

async function createProject(name = 'Project Atlas', startDate = '2026-03-01', endDate = '2026-03-31') {
  const response = await app.inject({ method: 'POST', url: '/projects', payload: { name, start_date: startDate, end_date: endDate } });
  assert.equal(response.statusCode, 201, response.body);
  return response.json() as { id: number; name: string };
}

async function createAssignment(params: { employeeId: number; projectId: number; startDate?: string; endDate?: string; allocation?: number; notes?: string | null; }) {
  const response = await app.inject({
    method: 'POST',
    url: '/assignments',
    payload: {
      employee_id: params.employeeId,
      project_id: params.projectId,
      start_date: params.startDate ?? '2026-03-03',
      end_date: params.endDate ?? '2026-03-10',
      allocation: params.allocation ?? 0.5,
      notes: params.notes ?? null
    }
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json() as { id: number; employee_name: string; project_name: string; allocation: number };
}

before(async () => {
  app = await buildApp();
});

after(async () => {
  await app.close();
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

beforeEach(() => {
  workforceStore.write({ organizations: [], jobCodes: [], employees: [], projects: [], demands: [], assignments: [], dashboard: {} });
  adminStore.write({ users: [], profiles: {}, inbox: {}, audit: [], dbConnections: [] });
});

test('health and runtime metadata report the TypeScript service', async () => {
  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { ok: true, service: 'matrixmanager-api', mode: 'typescript-migration' });

  const meta = await app.inject({ method: 'GET', url: '/api-meta' });
  assert.equal(meta.statusCode, 200);
  assert.equal(meta.json().runtime, 'node-typescript');
});

test('workforce CRUD, validation, and cascading deletes work through the TS API', async () => {
  const org = await createOrganization();
  const updatedOrg = await app.inject({ method: 'PUT', url: `/organizations/${org.id}`, payload: { name: 'Platform Engineering', description: 'Core systems' } });
  assert.equal(updatedOrg.statusCode, 200, updatedOrg.body);
  assert.equal(updatedOrg.json().name, 'Platform Engineering');

  const leader = await createEmployee({ organizationId: org.id, name: 'Dana Leader', employeeType: 'L' });
  const teamLead = await createEmployee({ organizationId: org.id, name: 'Taylor Lead', employeeType: 'L', managerId: leader.id, role: 'Team Lead' });
  const engineer = await createEmployee({ organizationId: org.id, name: 'Ivy IC', employeeType: 'IC', managerId: teamLead.id, role: 'Developer' });

  const badIc = await app.inject({ method: 'POST', url: '/employees', payload: { name: 'Unmanaged IC', organization_id: org.id, job_code_id: (await createJobCode('Orphan IC', false)).id, capacity: 1 } });
  assert.equal(badIc.statusCode, 400);
  assert.match(badIc.body, /must have a manager/i);

  const cycle = await app.inject({ method: 'PUT', url: `/employees/${leader.id}`, payload: { manager_id: teamLead.id } });
  assert.equal(cycle.statusCode, 400);
  assert.match(cycle.body, /cycle/i);

  const project = await createProject('Apollo');
  const assignment = await createAssignment({ employeeId: engineer.id, projectId: project.id, allocation: 0.5, notes: 'Initial staffing' });
  assert.equal(assignment.employee_name, 'Ivy IC');
  assert.equal(assignment.project_name, 'Apollo');

  const updatedAssignment = await app.inject({ method: 'PUT', url: `/assignments/${assignment.id}`, payload: { allocation: 0.75, notes: 'Expanded scope', end_date: '2026-03-14' } });
  assert.equal(updatedAssignment.statusCode, 200, updatedAssignment.body);
  assert.equal(updatedAssignment.json().allocation, 0.75);

  const employeeSchedule = await app.inject({ method: 'GET', url: `/schedule/employee/${engineer.id}` });
  assert.equal(employeeSchedule.statusCode, 200);
  assert.equal(employeeSchedule.json()[0].project_name, 'Apollo');

  const projectSchedule = await app.inject({ method: 'GET', url: `/schedule/project/${project.id}` });
  assert.equal(projectSchedule.statusCode, 200);
  assert.equal(projectSchedule.json()[0].employee_name, 'Ivy IC');

  const blockedDelete = await app.inject({ method: 'DELETE', url: `/organizations/${org.id}` });
  assert.equal(blockedDelete.statusCode, 400);
  assert.match(blockedDelete.body, /assigned employees/i);

  const deleteEmployee = await app.inject({ method: 'DELETE', url: `/employees/${engineer.id}` });
  assert.equal(deleteEmployee.statusCode, 204);

  const assignmentsAfterCascade = await app.inject({ method: 'GET', url: '/assignments' });
  assert.deepEqual(assignmentsAfterCascade.json(), []);
});

test('HTML surfaces and authenticated admin/runtime pages render from the TS app', async () => {
  const org = await createOrganization();
  const ceo = await createEmployee({ organizationId: org.id, name: 'CEO', employeeType: 'L' });
  const manager = await createEmployee({ organizationId: org.id, name: 'Manager', employeeType: 'L', managerId: ceo.id });
  const report = await createEmployee({ organizationId: org.id, name: 'Engineer', employeeType: 'IC', managerId: manager.id });
  const project = await createProject('Roadmap');
  await createAssignment({ employeeId: report.id, projectId: project.id, allocation: 1 });

  const home = await app.inject({ method: 'GET', url: '/', headers: { cookie: authedCookie() } });
  assert.equal(home.statusCode, 200);
  assert.match(home.body, /Matrix Manager/i);

  const people = await app.inject({ method: 'GET', url: '/people', headers: { cookie: authedCookie() } });
  assert.equal(people.statusCode, 200);
  assert.match(people.body, /data-page="employees"/);
  assert.match(people.body, /Matrix Manager · Employees/);
  assert.match(people.body, /"currentPath":"\/people"/);
  assert.match(people.body, /ui-react\.js/);

  const planning = await app.inject({ method: 'GET', url: '/planning', headers: { cookie: authedCookie() } });
  assert.equal(planning.statusCode, 200);
  assert.match(planning.body, /data-page="projects"/);
  assert.match(planning.body, /Matrix Manager · Projects/);
  assert.match(planning.body, /"currentPath":"\/planning"/);
  assert.match(planning.body, /ui-react\.js/);

  const canvas = await app.inject({ method: 'GET', url: '/canvas', headers: { cookie: authedCookie() } });
  assert.equal(canvas.statusCode, 200);
  assert.match(canvas.body, /data-page="canvas"/);
  assert.match(canvas.body, /ui-react\.js/);

  const employees = await app.inject({ method: 'GET', url: '/employees' });
  const payload = employees.json();
  const managerRow = payload.find((item: { id: number }) => item.id === manager.id);
  const reportRow = payload.find((item: { id: number }) => item.id === report.id);
  assert.equal(managerRow.direct_report_count, 1);
  assert.equal(reportRow.manager_name, 'Manager');

  const runtime = await app.inject({ method: 'GET', url: '/runtime', headers: { cookie: authedCookie() } });
  assert.equal(runtime.statusCode, 200);
  assert.match(runtime.body, /Runtime/i);

  const dbManagement = await app.inject({ method: 'GET', url: '/db-management', headers: { cookie: authedCookie() } });
  assert.equal(dbManagement.statusCode, 200);
  assert.match(dbManagement.body, /DB Management/i);
});
