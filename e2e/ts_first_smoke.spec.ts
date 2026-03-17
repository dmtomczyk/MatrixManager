import { test, expect } from '@playwright/test';

test('TS-first smoke: health, primary pages, and core CRUD API flow', async ({ page, request }) => {
  const health = await request.get('/health');
  expect(health.ok()).toBeTruthy();

  const home = await page.goto('/');
  expect(home?.ok()).toBeTruthy();
  await expect(page.locator('body')).toContainText('Matrix Manager');
  await expect(page.locator('body')).toContainText('Sign in');

  const orgResponse = await request.post('/organizations', {
    data: { name: 'TS Smoke Org', description: 'Created by Playwright request smoke test' },
  });
  expect(orgResponse.ok()).toBeTruthy();
  const org = await orgResponse.json();

  const leaderResponse = await request.post('/employees', {
    data: {
      name: 'TS Smoke Lead',
      employee_type: 'L',
      organization_id: org.id,
      capacity: 1,
    },
  });
  expect(leaderResponse.ok()).toBeTruthy();
  const leader = await leaderResponse.json();

  const employeeResponse = await request.post('/employees', {
    data: {
      name: 'TS Smoke Engineer',
      employee_type: 'IC',
      organization_id: org.id,
      manager_id: leader.id,
      capacity: 1,
    },
  });
  expect(employeeResponse.ok()).toBeTruthy();
  const employee = await employeeResponse.json();

  const projectResponse = await request.post('/projects', {
    data: {
      name: 'TS Smoke Project',
      start_date: '2026-03-01',
      end_date: '2026-03-31',
    },
  });
  expect(projectResponse.ok()).toBeTruthy();
  const project = await projectResponse.json();

  const assignmentResponse = await request.post('/assignments', {
    data: {
      employee_id: employee.id,
      project_id: project.id,
      start_date: '2026-03-03',
      end_date: '2026-03-14',
      allocation: 0.5,
      notes: 'TS smoke assignment',
    },
  });
  expect(assignmentResponse.ok()).toBeTruthy();

  const assignmentsResponse = await request.get('/assignments');
  expect(assignmentsResponse.ok()).toBeTruthy();
  const assignmentsPayload = await assignmentsResponse.json();
  expect(assignmentsPayload.some((item: { employee_id: number; project_id: number }) => item.employee_id === employee.id && item.project_id === project.id)).toBeTruthy();

  await page.goto('/');
  await expect(page.locator('body')).toContainText('Sign in');
});
