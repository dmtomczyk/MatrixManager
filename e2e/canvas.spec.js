const { test, expect } = require('@playwright/test');
const { createOrganization, createEmployee, createProject, createAssignment } = require('./helpers');

async function openContextMenuFor(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('No bounding box available for context menu target');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
}

async function waitForSelectOption(page, selector, value) {
  await expect
    .poll(async () => page.locator(`${selector} option[value="${value}"]`).count())
    .toBeGreaterThan(0);
}

test('TP-035 TP-036 TP-038: canvas groups employees under managers and supports expand/collapse', async ({ page }) => {
  const eng = await createOrganization(page, { name: 'Engineering' });
  const prod = await createOrganization(page, { name: 'Product' });
  const ceo = await createEmployee(page, { name: 'TP035 CEO', employee_type: 'L', organization_id: eng.id, capacity: 1 });
  const manager = await createEmployee(page, { name: 'TP035 Manager', employee_type: 'L', organization_id: eng.id, manager_id: ceo.id, capacity: 1 });
  await createEmployee(page, { name: 'TP035 Engineer', employee_type: 'IC', organization_id: eng.id, manager_id: manager.id, capacity: 1 });
  const prodLead = await createEmployee(page, { name: 'TP035 Prod Lead', employee_type: 'L', organization_id: prod.id, capacity: 1 });
  await createEmployee(page, { name: 'TP035 PM', employee_type: 'IC', organization_id: prod.id, manager_id: prodLead.id, capacity: 1 });

  await page.goto('/canvas');
  await expect(page.locator('#resource-list')).toContainText('TP035 CEO');
  await expect(page.locator('#resource-list')).not.toContainText('TP035 Manager');

  const ceoCard = page.locator('.resource-item').filter({ hasText: 'TP035 CEO' }).first();
  await ceoCard.locator('[data-manager-toggle]').dispatchEvent('click');
  await expect(page.locator('#resource-list')).toContainText('TP035 Manager');
  await expect(page.locator('#resource-list')).not.toContainText('TP035 Engineer');

  const managerCard = page.locator('.resource-item').filter({ hasText: 'TP035 Manager' }).first();
  await expect(managerCard).toBeVisible();
  await managerCard.locator('[data-manager-toggle]').dispatchEvent('click');
  await expect(page.locator('#resource-list')).toContainText('TP035 Engineer');

  await waitForSelectOption(page, '#canvas-org-filter', String(prod.id));
  await page.locator('#canvas-org-filter').selectOption(String(prod.id));
  await expect(page.locator('#resource-list')).toContainText('TP035 Prod Lead');
  await expect(page.locator('#resource-list')).not.toContainText('TP035 Manager');
});

test('TP-037 TP-042: canvas shows project details and drag-drop assignment preselection', async ({ page }) => {
  const org = await createOrganization(page, { name: 'Engineering' });
  const leader = await createEmployee(page, { name: 'TP037 Lead', employee_type: 'L', organization_id: org.id, capacity: 1 });
  const engineer = await createEmployee(page, { name: 'TP037 Engineer', employee_type: 'IC', organization_id: org.id, manager_id: leader.id, capacity: 1 });
  const project = await createProject(page, { name: 'TP037 Atlas', start_date: '2026-03-01', end_date: '2026-03-31' });
  await createAssignment(page, { employee_id: engineer.id, project_id: project.id, start_date: '2026-03-01', end_date: '2026-03-14', allocation: 1.0 });

  await page.goto('/canvas');
  const projectBox = page.locator('.project-box').filter({ hasText: 'TP037 Atlas' }).first();
  await expect(projectBox).toContainText('TP037 Atlas');
  const leadCard = page.locator('.resource-item').filter({ hasText: 'TP037 Lead' }).first();
  await leadCard.locator('[data-manager-toggle]').click();
  await expect(page.locator('#resource-list')).toContainText('TP037 Engineer');

  await page.evaluate(({ employeeId, projectId }) => {
    window.__canvasTest.openAssignmentModal({ employeeId, projectId });
  }, { employeeId: engineer.id, projectId: project.id });

  await expect(page.locator('#canvas-modal')).toBeVisible();
  await expect(page.locator('#assignment-modal-form select[name="employee_id"]')).toHaveValue(String(engineer.id));
  await expect(page.locator('#assignment-modal-form select[name="project_id"]')).toHaveValue(String(project.id));
  await page.locator('#modal-close').click();

  await projectBox.locator('.project-details').click();
  await expect(page.locator('#canvas-modal')).toBeVisible();
  await expect(page.locator('#modal-body')).toContainText('weekly FTE');
});
