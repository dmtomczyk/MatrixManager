const { test, expect } = require('@playwright/test');
const { createOrganization, createEmployee, createProject, createAssignment } = require('./helpers');

async function waitForSelectOption(page, selector, value) {
  await expect
    .poll(async () => page.locator(`${selector} option[value="${value}"]`).count())
    .toBeGreaterThan(0);
}

async function waitForSelectOptionsCount(page, selector, minCount = 2) {
  await expect
    .poll(async () => page.locator(`${selector} option`).count())
    .toBeGreaterThanOrEqual(minCount);
}

test('TP-005 TP-009: create employee from UI with leader type', async ({ page }) => {
  const org = await createOrganization(page, { name: 'Engineering' });

  await page.goto('/');
  await waitForSelectOption(page, '#employee-organization', String(org.id));
  await page.locator('#employee-form input[name="name"]').fill('TP005 Dana Leader');
  await page.locator('#employee-form input[name="role"]').fill('Director');
  await page.locator('#employee-type').selectOption('L');
  await page.locator('#employee-organization').selectOption(String(org.id));
  await page.locator('#employee-form input[name="location"]').fill('Remote');
  await page.locator('#employee-form input[name="capacity"]').fill('1');
  await page.locator('#employee-form button[type="submit"]').click();

  await expect(page.locator('#employee-table')).toContainText('TP005 Dana Leader');
  await expect(page.locator('#employee-table')).toContainText('L');
  await expect(page.locator('#employee-table')).toContainText('Engineering');
});

test('TP-006 TP-011 TP-016: edit employee from UI and convert IC to leader', async ({ page }) => {
  const org = await createOrganization(page, { name: 'Engineering' });
  const ceo = await createEmployee(page, {
    name: 'TP006 CEO',
    employee_type: 'L',
    organization_id: org.id,
    capacity: 1,
  });
  const ic = await createEmployee(page, {
    name: 'TP006 Engineer',
    employee_type: 'IC',
    organization_id: org.id,
    manager_id: ceo.id,
    capacity: 1,
  });

  await page.goto('/');
  const editButton = page.locator(`[data-action="edit-employee"][data-id="${ic.id}"]`);
  await expect(editButton).toBeVisible();
  await editButton.dispatchEvent('click');
  await expect(page.locator('#employee-form input[name="name"]')).toHaveValue('TP006 Engineer');
  await page.locator('#employee-type').selectOption('L');
  await page.locator('#employee-manager').selectOption('');
  await page.locator('#employee-form input[name="role"]').fill('Tech Lead');
  await page.locator('#employee-form button[type="submit"]').click();

  await expect(page.locator('#employee-table')).toContainText('TP006 Engineer');
  const row = page.locator('#employee-table tr').filter({ hasText: 'TP006 Engineer' });
  await expect(row).toContainText('L');
  await expect(row).toContainText('Tech Lead');
});

test('TP-017: filter employees by organization', async ({ page }) => {
  const eng = await createOrganization(page, { name: 'Engineering' });
  const prod = await createOrganization(page, { name: 'Product' });
  const engLead = await createEmployee(page, {
    name: 'TP017 Eng Lead', employee_type: 'L', organization_id: eng.id, capacity: 1,
  });
  const prodLead = await createEmployee(page, {
    name: 'TP017 Prod Lead', employee_type: 'L', organization_id: prod.id, capacity: 1,
  });
  await createEmployee(page, {
    name: 'TP017 Engineer', employee_type: 'IC', organization_id: eng.id, manager_id: engLead.id, capacity: 1,
  });
  await createEmployee(page, {
    name: 'TP017 PM', employee_type: 'IC', organization_id: prod.id, manager_id: prodLead.id, capacity: 1,
  });

  await page.goto('/');
  await waitForSelectOption(page, '#employee-org-filter', String(eng.id));
  await page.locator('#employee-org-filter').selectOption(String(eng.id));
  await expect(page.locator('#employee-table')).toContainText('TP017 Engineer');
  await expect(page.locator('#employee-table')).not.toContainText('TP017 PM');
});

test('TP-022 TP-027 TP-029 TP-030: create assignment and display in schedule surfaces', async ({ page }) => {
  const org = await createOrganization(page, { name: 'Engineering' });
  const leader = await createEmployee(page, {
    name: 'TP022 Lead', employee_type: 'L', organization_id: org.id, capacity: 1,
  });
  const engineer = await createEmployee(page, {
    name: 'TP022 Engineer', employee_type: 'IC', organization_id: org.id, manager_id: leader.id, capacity: 1,
  });
  const project = await createProject(page, {
    name: 'TP022 Atlas', start_date: '2026-03-01', end_date: '2026-03-31', description: 'Core build',
  });

  await page.goto('/');
  await waitForSelectOption(page, '#assignment-employee', String(engineer.id));
  await waitForSelectOption(page, '#assignment-project', String(project.id));
  await waitForSelectOption(page, '#schedule-employee', String(engineer.id));
  await waitForSelectOption(page, '#schedule-project', String(project.id));
  await page.locator('#assignment-employee').selectOption(String(engineer.id));
  await page.locator('#assignment-project').selectOption(String(project.id));
  await page.locator('#assignment-form input[name="start_date"]').fill('2026-03-03');
  await page.locator('#assignment-form input[name="end_date"]').fill('2026-03-10');
  await page.locator('#assignment-form input[name="allocation"]').fill('50');
  await page.locator('#assignment-form textarea[name="notes"]').fill('Initial staffing');
  await page.locator('#assignment-form button[type="submit"]').click();

  await expect(page.locator('#assignment-table')).toContainText('TP022 Engineer');
  await expect(page.locator('#assignment-table')).toContainText('TP022 Atlas');

  await page.locator('#schedule-employee').selectOption(String(engineer.id));
  await expect(page.locator('#employee-schedule')).toContainText('TP022 Atlas');

  await page.locator('#schedule-project').selectOption(String(project.id));
  await expect(page.locator('#project-schedule')).toContainText('TP022 Engineer');
});

test('TP-032 TP-033: allocation surfaces respond to overallocated data', async ({ page }) => {
  const org = await createOrganization(page, { name: 'Engineering' });
  const leader = await createEmployee(page, {
    name: 'TP032 Lead', employee_type: 'L', organization_id: org.id, capacity: 1,
  });
  const engineer = await createEmployee(page, {
    name: 'TP032 Engineer', employee_type: 'IC', organization_id: org.id, manager_id: leader.id, capacity: 1,
  });
  const projectA = await createProject(page, { name: 'TP032 Alpha', start_date: '2026-03-01', end_date: '2026-03-31' });
  const projectB = await createProject(page, { name: 'TP032 Beta', start_date: '2026-03-01', end_date: '2026-03-31' });
  await createAssignment(page, { employee_id: engineer.id, project_id: projectA.id, start_date: '2026-03-01', end_date: '2026-03-15', allocation: 0.75 });
  await createAssignment(page, { employee_id: engineer.id, project_id: projectB.id, start_date: '2026-03-01', end_date: '2026-03-15', allocation: 0.5 });

  await page.goto('/');
  await page.locator('#allocation-preset').selectOption('all');
  await expect(page.locator('#allocation-range-label')).toContainText('Window:');
  await expect(page.locator('#allocation-chart-empty')).toBeHidden();
});
