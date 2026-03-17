import { ZodError } from 'zod';
import {
  employeeCreateSchema,
  employeeUpdateSchema,
  jobCodeCreateSchema,
  jobCodeUpdateSchema,
  organizationCreateSchema,
  organizationUpdateSchema
} from './schemas.js';
import { workforceStore } from './store.js';
import type { EmployeeRecord, JobCodeRecord, OrganizationRecord, WorkforceState } from './types.js';

function nextId(items: Array<{ id: number }>): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function badRequest(detail: string): never {
  const error = new Error(detail) as Error & { statusCode?: number };
  error.statusCode = 400;
  throw error;
}

function ensureOrganizationExists(state: WorkforceState, organizationId: number) {
  if (!state.organizations.some((organization) => organization.id === organizationId)) {
    badRequest('Organization not found');
  }
}

function ensureJobCodeExists(state: WorkforceState, jobCodeId: number | null) {
  if (jobCodeId == null) return null;
  const jobCode = state.jobCodes.find((item) => item.id === jobCodeId);
  if (!jobCode) badRequest('Job code not found');
  return jobCode;
}

function ensureManagerIsValid(state: WorkforceState, employeeId: number | null, managerId: number | null) {
  if (managerId == null) return null;
  if (employeeId != null && managerId === employeeId) badRequest('Employee cannot manage themselves');
  const manager = state.employees.find((item) => item.id === managerId);
  if (!manager) badRequest('Manager not found');
  if (manager.employee_type !== 'L') badRequest('Only leaders can be assigned as managers');
  if (employeeId != null) {
    let cursor: EmployeeRecord | undefined = manager;
    while (cursor?.manager_id != null) {
      if (cursor.manager_id === employeeId) badRequest('Manager assignment would create a cycle');
      cursor = state.employees.find((item) => item.id === cursor?.manager_id);
    }
  }
  return manager;
}

function deriveEmployeeType(explicit: string | undefined, jobCode: JobCodeRecord | null): string {
  if (explicit && explicit.trim()) return explicit.trim();
  return jobCode?.is_leader ? 'L' : 'IC';
}

function validateEmployeeRecord(state: WorkforceState, record: EmployeeRecord, previous?: EmployeeRecord) {
  ensureOrganizationExists(state, record.organization_id);
  const jobCode = ensureJobCodeExists(state, record.job_code_id);
  record.employee_type = deriveEmployeeType(record.employee_type, jobCode);
  ensureManagerIsValid(state, record.id ?? null, record.manager_id);

  if (record.employee_type === 'IC' && record.manager_id == null) {
    badRequest('IC employees must have a manager');
  }

  if (record.employee_type !== 'L') {
    const hasReports = state.employees.some((employee) => employee.manager_id === record.id && employee.id !== previous?.id);
    if (hasReports) {
      badRequest('Employees with direct reports must remain leaders');
    }
  }
}

function serializeOrganization(state: WorkforceState, organization: OrganizationRecord) {
  const owner = organization.owner_employee_id ? state.employees.find((employee) => employee.id === organization.owner_employee_id) : null;
  const parent = organization.parent_organization_id ? state.organizations.find((item) => item.id === organization.parent_organization_id) : null;
  return {
    ...organization,
    parent_organization_name: parent?.name ?? null,
    owner_employee_name: owner?.name ?? null,
    child_organization_count: state.organizations.filter((item) => item.parent_organization_id === organization.id).length,
    employee_count: state.employees.filter((employee) => employee.organization_id === organization.id).length
  };
}

function serializeJobCode(state: WorkforceState, jobCode: JobCodeRecord) {
  return {
    ...jobCode,
    assigned_employee_count: state.employees.filter((employee) => employee.job_code_id === jobCode.id).length
  };
}

function serializeEmployee(state: WorkforceState, employee: EmployeeRecord) {
  const organization = state.organizations.find((item) => item.id === employee.organization_id);
  const manager = employee.manager_id ? state.employees.find((item) => item.id === employee.manager_id) : null;
  const jobCode = employee.job_code_id ? state.jobCodes.find((item) => item.id === employee.job_code_id) : null;
  return {
    ...employee,
    organization_name: organization?.name ?? null,
    manager_name: manager?.name ?? null,
    direct_report_count: state.employees.filter((item) => item.manager_id === employee.id).length,
    role: employee.role ?? jobCode?.name ?? null,
    job_code_name: jobCode?.name ?? null,
    job_code_is_leader: jobCode?.is_leader ?? false
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

export function listJobCodes() {
  const state = workforceStore.read();
  return state.jobCodes
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((jobCode) => serializeJobCode(state, jobCode));
}

export function createJobCode(input: unknown) {
  const payload = jobCodeCreateSchema.parse(input);
  const state = workforceStore.update((current) => {
    const jobCode: JobCodeRecord = {
      id: nextId(current.jobCodes),
      ...payload
    };
    return { ...current, jobCodes: [...current.jobCodes, jobCode] };
  });
  return serializeJobCode(state, state.jobCodes[state.jobCodes.length - 1]!);
}

export function updateJobCode(id: number, input: unknown) {
  const patch = jobCodeUpdateSchema.parse(input);
  let updated: JobCodeRecord | null = null;
  const state = workforceStore.update((current) => {
    const jobCodes = current.jobCodes.map((jobCode) => {
      if (jobCode.id !== id) return jobCode;
      updated = { ...jobCode, ...patch };
      return updated!;
    });

    if (updated && patch.is_leader === false) {
      const managedIds = new Set(current.employees.filter((employee) => employee.manager_id != null).map((employee) => employee.manager_id));
      if (current.employees.some((employee) => employee.job_code_id === id && managedIds.has(employee.id))) {
        badRequest('Cannot mark a job code non-leader while assigned managers still use it');
      }
    }

    return { ...current, jobCodes };
  });
  if (!updated) return null;
  return serializeJobCode(state, updated);
}

export function deleteJobCode(id: number) {
  const state = workforceStore.read();
  if (!state.jobCodes.some((jobCode) => jobCode.id === id)) {
    return { ok: false as const, status: 404, detail: 'Job code not found' };
  }
  if (state.employees.some((employee) => employee.job_code_id === id)) {
    return { ok: false as const, status: 400, detail: 'Cannot delete job code assigned to employees' };
  }
  workforceStore.write({
    ...state,
    jobCodes: state.jobCodes.filter((jobCode) => jobCode.id !== id)
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
  let created: EmployeeRecord | null = null;
  const state = workforceStore.update((current) => {
    const record: EmployeeRecord = {
      id: nextId(current.employees),
      name: payload.name,
      job_code_id: payload.job_code_id,
      employee_type: deriveEmployeeType(payload.employee_type, ensureJobCodeExists(current, payload.job_code_id)),
      role: payload.role,
      location: payload.location,
      capacity: payload.capacity,
      manager_id: payload.manager_id,
      organization_id: payload.organization_id
    };
    validateEmployeeRecord(current, record);
    created = record;
    return { ...current, employees: [...current.employees, record] };
  });
  return serializeEmployee(state, created!);
}

export function updateEmployee(id: number, input: unknown) {
  const patch = employeeUpdateSchema.parse(input);
  let updated: EmployeeRecord | null = null;
  const state = workforceStore.update((current) => {
    const existing = current.employees.find((employee) => employee.id === id);
    if (!existing) return current;
    const next: EmployeeRecord = {
      ...existing,
      ...patch,
      employee_type: deriveEmployeeType(
        patch.employee_type ?? existing.employee_type,
        ensureJobCodeExists(current, patch.job_code_id ?? existing.job_code_id)
      )
    };
    validateEmployeeRecord(current, next, existing);
    updated = next;
    const employees = current.employees.map((employee) => employee.id === id ? next : employee);
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

export function formatWorkforceError(error: unknown): { statusCode: number; detail: string } {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return { statusCode: 400, detail: issue?.message ?? 'Invalid request' };
  }
  if (error instanceof Error && 'statusCode' in error && typeof (error as { statusCode?: unknown }).statusCode === 'number') {
    return { statusCode: (error as { statusCode: number }).statusCode, detail: error.message };
  }
  if (error instanceof Error) {
    return { statusCode: 400, detail: error.message };
  }
  return { statusCode: 500, detail: 'Unexpected workforce error' };
}
