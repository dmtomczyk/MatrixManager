import { organizationCreateSchema, organizationUpdateSchema, employeeCreateSchema, employeeUpdateSchema } from './schemas.js';
import { workforceStore } from './store.js';
import type { EmployeeRecord, OrganizationRecord, WorkforceState } from './types.js';

function nextId(items: Array<{ id: number }>): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function serializeOrganization(state: WorkforceState, organization: OrganizationRecord) {
  const owner = organization.owner_employee_id ? state.employees.find((employee) => employee.id === organization.owner_employee_id) : null;
  const parent = organization.parent_organization_id ? state.organizations.find((item) => item.id === organization.parent_organization_id) : null;
  return {
    ...organization,
    parent_organization_name: parent?.name ?? null,
    owner_employee_name: owner?.name ?? null,
    child_organization_count: state.organizations.filter((item) => item.parent_organization_id === organization.id).length
  };
}

function serializeEmployee(state: WorkforceState, employee: EmployeeRecord) {
  const organization = state.organizations.find((item) => item.id === employee.organization_id);
  const manager = employee.manager_id ? state.employees.find((item) => item.id === employee.manager_id) : null;
  return {
    ...employee,
    organization_name: organization?.name ?? null,
    manager_name: manager?.name ?? null,
    direct_report_count: state.employees.filter((item) => item.manager_id === employee.id).length,
    role: null,
    job_code_name: null,
    job_code_is_leader: false
  };
}

export function listOrganizations() {
  const state = workforceStore.read();
  return state.organizations
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((organization) => serializeOrganization(state, organization));
}

export function createOrganization(input: unknown) {
  const payload = organizationCreateSchema.parse(input);
  const state = workforceStore.update((current) => {
    const organization: OrganizationRecord = {
      id: nextId(current.organizations),
      ...payload
    };
    return { ...current, organizations: [...current.organizations, organization] };
  });
  return serializeOrganization(state, state.organizations[state.organizations.length - 1]!);
}

export function updateOrganization(id: number, input: unknown) {
  const patch = organizationUpdateSchema.parse(input);
  let updated: OrganizationRecord | null = null;
  const state = workforceStore.update((current) => {
    const organizations = current.organizations.map((organization) => {
      if (organization.id !== id) return organization;
      updated = { ...organization, ...patch };
      return updated!;
    });
    return { ...current, organizations };
  });
  if (!updated) return null;
  return serializeOrganization(state, updated);
}

export function deleteOrganization(id: number) {
  const state = workforceStore.read();
  if (state.employees.some((employee) => employee.organization_id === id)) {
    return { ok: false as const, status: 400, detail: 'Cannot delete organization with assigned employees' };
  }
  if (state.organizations.some((organization) => organization.parent_organization_id === id)) {
    return { ok: false as const, status: 400, detail: 'Cannot delete organization with child organizations' };
  }
  if (!state.organizations.some((organization) => organization.id === id)) {
    return { ok: false as const, status: 404, detail: 'Organization not found' };
  }
  workforceStore.write({
    ...state,
    organizations: state.organizations.filter((organization) => organization.id !== id)
  });
  return { ok: true as const };
}

export function listEmployees() {
  const state = workforceStore.read();
  return state.employees
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((employee) => serializeEmployee(state, employee));
}

export function getEmployee(id: number) {
  const state = workforceStore.read();
  const employee = state.employees.find((item) => item.id === id);
  if (!employee) return null;
  return serializeEmployee(state, employee);
}

export function createEmployee(input: unknown) {
  const payload = employeeCreateSchema.parse(input);
  const state = workforceStore.update((current) => {
    const employee: EmployeeRecord = {
      id: nextId(current.employees),
      ...payload
    };
    return { ...current, employees: [...current.employees, employee] };
  });
  return serializeEmployee(state, state.employees[state.employees.length - 1]!);
}

export function updateEmployee(id: number, input: unknown) {
  const patch = employeeUpdateSchema.parse(input);
  let updated: EmployeeRecord | null = null;
  const state = workforceStore.update((current) => {
    const employees = current.employees.map((employee) => {
      if (employee.id !== id) return employee;
      updated = { ...employee, ...patch };
      return updated!;
    });
    return { ...current, employees };
  });
  if (!updated) return null;
  return serializeEmployee(state, updated);
}

export function deleteEmployee(id: number) {
  const state = workforceStore.read();
  if (!state.employees.some((employee) => employee.id === id)) {
    return { ok: false as const, status: 404, detail: 'Employee not found' };
  }
  workforceStore.write({
    ...state,
    employees: state.employees
      .filter((employee) => employee.id !== id)
      .map((employee) => employee.manager_id === id ? { ...employee, manager_id: null } : employee)
  });
  return { ok: true as const };
}
