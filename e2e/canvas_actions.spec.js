const { test, expect } = require('@playwright/test');
const { createOrganization, createEmployee, createProject, createAssignment } = require('./helpers');

async function openContextMenuFor(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('No bounding box available for context menu target');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
}

test('TP-039: edit employee details from the canvas', async ({ page }) => {
  const org = await createOrganization(page, { name: 'Engineering' });
  const leader = await createEmployee(page, { name: 'TP039 Lead', employee_type: 'L', organization_id: org.id, capacity: 1 });
  const employee = await createEmployee(page, { name: 'TP039 Engineer', employee_type: 'IC', organization_id: org.id, manager_id: leader.id, capacity: 1 });

  await page.goto('/canvas');
  const leadCard = page.locator('.resource-item').filter({ hasText: 'TP039 Lead' }).first();
  await leadCard.locator('[data-manager-toggle]').dispatchEvent('click');
  await page.evaluate((employeeId) => {
    window.__canvasTest.openEmployeeModal(employeeId);
  }, employee.id);
  await page.locator('#employee-picker').selectOption(String(employee.id));
  await page.locator('#employee-modal-form input[name="role"]').fill('Principal Engineer');
  await page.locator('#employee-modal-form input[name="location"]').fill('Remote');
  await page.locator('#employee-modal-form button[type="submit"]').click();

  await expect(page.locator('#toast')).toContainText('Employee updated');
  await expect(page.locator('#resource-list')).toContainText('Principal Engineer');
});

test('TP-040: edit project details from the canvas', async ({ page }) => {
  const project = await createProject(page, { name: 'TP040 Atlas', start_date: '2026-03-01', end_date: '2026-03-31' });

  await page.goto('/canvas');
  const projectBox = page.locator(`.project-box[data-id="${project.id}"]`).first();
  await expect(projectBox).toBeVisible();
  await page.evaluate((projectId) => {
    window.__canvasTest.openProjectEditModal(projectId);
  }, project.id);
  await page.locator('#project-picker').selectOption(String(project.id));
  await page.locator('#project-edit-form input[name="name"]').fill('TP040 Atlas Updated');
  await page.locator('#project-edit-form textarea[name="description"]').fill('Updated from canvas');
  await page.locator('#project-edit-form button[type="submit"]').click();

  await expect(page.locator('#toast')).toContainText('Project updated');
  await expect(projectBox).toContainText('TP040 Atlas Updated');
});

test('TP-041: remove assignments from the canvas', async ({ page }) => {
  const org = await createOrganization(page, { name: 'Engineering' });
  const leader = await createEmployee(page, { name: 'TP041 Lead', employee_type: 'L', organization_id: org.id, capacity: 1 });
  const employee = await createEmployee(page, { name: 'TP041 Engineer', employee_type: 'IC', organization_id: org.id, manager_id: leader.id, capacity: 1 });
  const project = await createProject(page, { name: 'TP041 Atlas', start_date: '2026-03-01', end_date: '2026-03-31' });
  const assignment = await createAssignment(page, { employee_id: employee.id, project_id: project.id, start_date: '2026-03-01', end_date: '2026-03-14', allocation: 0.5 });

  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });

  await page.goto('/canvas');
  await expect(page.locator(`.assignment-node[data-id="${assignment.id}"]`).first()).toBeVisible();
  await page.evaluate((assignmentId) => {
    window.__canvasTest.openAssignmentRemovalModal(assignmentId);
  }, assignment.id);
  await page.locator('#assignment-picker').selectOption(String(assignment.id));
  await page.locator('#assignment-remove-confirm').click();

  await expect(page.locator('#toast')).toContainText('Assignment removed');
  await expect(page.locator(`.assignment-node[data-id="${assignment.id}"]`)).toHaveCount(0);
});
