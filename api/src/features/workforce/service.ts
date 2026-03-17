import { ZodError } from 'zod';
import {
  assignmentCreateSchema,
  assignmentUpdateSchema,
  dashboardTrackedEmployeesSchema,
  demandCreateSchema,
  demandUpdateSchema,
  employeeCreateSchema,
  employeeUpdateSchema,
  jobCodeCreateSchema,
  jobCodeUpdateSchema,
  organizationCreateSchema,
  organizationUpdateSchema,
  projectCreateSchema,
  projectUpdateSchema
} from './schemas.js';
import { workforceStore } from './store.js';
import type {
  AssignmentRecord,
  DashboardPreferencesRecord,
  DemandRecord,
  EmployeeRecord,
  JobCodeRecord,
  OrganizationRecord,
  ProjectRecord,
  WorkforceState
} from './types.js';

function nextId(items: Array<{ id: number }>): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function badRequest(detail: string): never {
  const error = new Error(detail) as Error & { statusCode?: number };
  error.statusCode = 400;
  throw error;
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  return value;
}

function compareDateStrings(left: string | null | undefined, right: string | null | undefined) {
  return String(left ?? '').localeCompare(String(right ?? ''));
}

function dateRangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA <= endB && startB <= endA;
}

function ensureDateOrder(start: string | null | undefined, end: string | null | undefined, label = 'Date range') {
  if (start && end && start > end) badRequest(`${label} start date must be on or before end date`);
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

function ensureProjectExists(state: WorkforceState, projectId: number) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) badRequest('Project not found');
  return project;
}

function ensureDemandExists(state: WorkforceState, demandId: number | null) {
  if (demandId == null) return null;
  const demand = state.demands.find((item) => item.id === demandId);
  if (!demand) badRequest('Demand not found');
  return demand;
}

function ensureEmployeeExists(state: WorkforceState, employeeId: number) {
  const employee = state.employees.find((item) => item.id === employeeId);
  if (!employee) badRequest('Employee not found');
  return employee;
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
    if (hasReports) badRequest('Employees with direct reports must remain leaders');
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

function serializeProject(state: WorkforceState, project: ProjectRecord) {
  const activeAssignments = state.assignments.filter((assignment) => assignment.project_id === project.id);
  const activeDemands = state.demands.filter((demand) => demand.project_id === project.id);
  return {
    ...project,
    assignment_count: activeAssignments.length,
    demand_count: activeDemands.length,
    assigned_allocation: activeAssignments.reduce((sum, assignment) => sum + assignment.allocation, 0),
    demanded_allocation: activeDemands.reduce((sum, demand) => sum + demand.required_allocation, 0)
  };
}

function fulfilledDemandAllocation(state: WorkforceState, demand: DemandRecord) {
  return state.assignments
    .filter((assignment) => assignment.demand_id === demand.id)
    .reduce((sum, assignment) => sum + assignment.allocation, 0);
}

function serializeDemand(state: WorkforceState, demand: DemandRecord) {
  const project = state.projects.find((item) => item.id === demand.project_id);
  const organization = demand.organization_id ? state.organizations.find((item) => item.id === demand.organization_id) : null;
  const jobCode = demand.job_code_id ? state.jobCodes.find((item) => item.id === demand.job_code_id) : null;
  const fulfilled = fulfilledDemandAllocation(state, demand);
  return {
    ...demand,
    project_name: project?.name ?? null,
    organization_name: organization?.name ?? null,
    job_code_name: jobCode?.name ?? null,
    fulfilled_allocation: fulfilled,
    remaining_allocation: Math.max(demand.required_allocation - fulfilled, 0)
  };
}

function serializeAssignment(state: WorkforceState, assignment: AssignmentRecord) {
  const employee = state.employees.find((item) => item.id === assignment.employee_id);
  const project = state.projects.find((item) => item.id === assignment.project_id);
  const demand = assignment.demand_id ? state.demands.find((item) => item.id === assignment.demand_id) : null;
  const organization = employee ? state.organizations.find((item) => item.id === employee.organization_id) : null;
  return {
    ...assignment,
    employee_name: employee?.name ?? null,
    project_name: project?.name ?? null,
    demand_title: demand?.title ?? null,
    organization_id: organization?.id ?? null,
    organization_name: organization?.name ?? null,
    submitted_by_current_user: false,
    requires_current_user_approval: false,
    pending_approver_usernames: [] as string[]
  };
}

function getOrCreateDashboardPreferences(state: WorkforceState, username: string): DashboardPreferencesRecord {
  return state.dashboard[username] ?? { tracked_employee_ids: [] };
}

export function listOrganizations() {
  const state = workforceStore.read();
  return state.organizations.slice().sort((a, b) => a.name.localeCompare(b.name)).map((organization) => serializeOrganization(state, organization));
}

export function createOrganization(input: unknown) {
  const payload = organizationCreateSchema.parse(input);
  const state = workforceStore.update((current) => {
    const organization: OrganizationRecord = { id: nextId(current.organizations), ...payload };
    return { ...current, organizations: [...current.organizations, organization] };
  });
  return serializeOrganization(state, state.organizations[state.organizations.length - 1]!);
}

export function updateOrganization(id: number, input: unknown) {
  const patch = organizationUpdateSchema.parse(input);
  let updated: OrganizationRecord | null = null;
  const state = workforceStore.update((current) => ({
    ...current,
    organizations: current.organizations.map((organization) => {
      if (organization.id !== id) return organization;
      updated = { ...organization, ...patch };
      return updated!;
    })
  }));
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
  workforceStore.write({ ...state, organizations: state.organizations.filter((organization) => organization.id !== id) });
  return { ok: true as const };
}

export function listJobCodes() {
  const state = workforceStore.read();
  return state.jobCodes.slice().sort((a, b) => a.name.localeCompare(b.name)).map((jobCode) => serializeJobCode(state, jobCode));
}

export function createJobCode(input: unknown) {
  const payload = jobCodeCreateSchema.parse(input);
  const state = workforceStore.update((current) => {
    const jobCode: JobCodeRecord = { id: nextId(current.jobCodes), ...payload };
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
  if (!state.jobCodes.some((jobCode) => jobCode.id === id)) return { ok: false as const, status: 404, detail: 'Job code not found' };
  if (state.employees.some((employee) => employee.job_code_id === id)) return { ok: false as const, status: 400, detail: 'Cannot delete job code assigned to employees' };
  if (state.demands.some((demand) => demand.job_code_id === id)) return { ok: false as const, status: 400, detail: 'Cannot delete job code used by demands' };
  workforceStore.write({ ...state, jobCodes: state.jobCodes.filter((jobCode) => jobCode.id !== id) });
  return { ok: true as const };
}

export function listEmployees() {
  const state = workforceStore.read();
  return state.employees.slice().sort((a, b) => a.name.localeCompare(b.name)).map((employee) => serializeEmployee(state, employee));
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
      employee_type: deriveEmployeeType(patch.employee_type ?? existing.employee_type, ensureJobCodeExists(current, patch.job_code_id ?? existing.job_code_id))
    };
    validateEmployeeRecord(current, next, existing);
    updated = next;
    return { ...current, employees: current.employees.map((employee) => employee.id === id ? next : employee) };
  });
  if (!updated) return null;
  return serializeEmployee(state, updated);
}

export function deleteEmployee(id: number) {
  const state = workforceStore.read();
  if (!state.employees.some((employee) => employee.id === id)) return { ok: false as const, status: 404, detail: 'Employee not found' };
  if (state.assignments.some((assignment) => assignment.employee_id === id)) return { ok: false as const, status: 400, detail: 'Cannot delete employee with assignments' };
  workforceStore.write({
    ...state,
    employees: state.employees.filter((employee) => employee.id !== id).map((employee) => employee.manager_id === id ? { ...employee, manager_id: null } : employee),
    dashboard: Object.fromEntries(Object.entries(state.dashboard).map(([username, value]) => [username, { tracked_employee_ids: value.tracked_employee_ids.filter((employeeId) => employeeId !== id) }]))
  });
  return { ok: true as const };
}

export function listProjects() {
  const state = workforceStore.read();
  return state.projects.slice().sort((a, b) => a.name.localeCompare(b.name)).map((project) => serializeProject(state, project));
}

export function createProject(input: unknown) {
  const payload = projectCreateSchema.parse(input);
  ensureDateOrder(payload.start_date, payload.end_date, 'Project');
  const state = workforceStore.update((current) => {
    const record: ProjectRecord = { id: nextId(current.projects), name: payload.name, description: payload.description, start_date: normalizeDate(payload.start_date), end_date: normalizeDate(payload.end_date) };
    return { ...current, projects: [...current.projects, record] };
  });
  return serializeProject(state, state.projects[state.projects.length - 1]!);
}

export function updateProject(id: number, input: unknown) {
  const patch = projectUpdateSchema.parse(input);
  let updated: ProjectRecord | null = null;
  const state = workforceStore.update((current) => {
    const projects = current.projects.map((project) => {
      if (project.id !== id) return project;
      const next = { ...project, ...patch, start_date: normalizeDate(patch.start_date ?? project.start_date), end_date: normalizeDate(patch.end_date ?? project.end_date) };
      ensureDateOrder(next.start_date, next.end_date, 'Project');
      updated = next;
      return next;
    });
    return { ...current, projects };
  });
  if (!updated) return null;
  return serializeProject(state, updated);
}

export function deleteProject(id: number) {
  const state = workforceStore.read();
  if (!state.projects.some((project) => project.id === id)) return { ok: false as const, status: 404, detail: 'Project not found' };
  workforceStore.write({
    ...state,
    projects: state.projects.filter((project) => project.id !== id),
    demands: state.demands.filter((demand) => demand.project_id !== id),
    assignments: state.assignments.filter((assignment) => assignment.project_id !== id)
  });
  return { ok: true as const };
}

export function listDemands() {
  const state = workforceStore.read();
  return state.demands.slice().sort((a, b) => compareDateStrings(a.start_date, b.start_date) || a.title.localeCompare(b.title)).map((demand) => serializeDemand(state, demand));
}

export function createDemand(input: unknown) {
  const payload = demandCreateSchema.parse(input);
  ensureDateOrder(payload.start_date, payload.end_date, 'Demand');
  const state = workforceStore.update((current) => {
    ensureProjectExists(current, payload.project_id);
    if (payload.organization_id != null) ensureOrganizationExists(current, payload.organization_id);
    if (payload.job_code_id != null) ensureJobCodeExists(current, payload.job_code_id);
    const record: DemandRecord = { id: nextId(current.demands), ...payload };
    return { ...current, demands: [...current.demands, record] };
  });
  return serializeDemand(state, state.demands[state.demands.length - 1]!);
}

export function updateDemand(id: number, input: unknown) {
  const patch = demandUpdateSchema.parse(input);
  let updated: DemandRecord | null = null;
  const state = workforceStore.update((current) => {
    const demands = current.demands.map((demand) => {
      if (demand.id !== id) return demand;
      const next = { ...demand, ...patch };
      ensureProjectExists(current, next.project_id);
      if (next.organization_id != null) ensureOrganizationExists(current, next.organization_id);
      if (next.job_code_id != null) ensureJobCodeExists(current, next.job_code_id);
      ensureDateOrder(next.start_date, next.end_date, 'Demand');
      updated = next;
      return next;
    });
    return { ...current, demands };
  });
  if (!updated) return null;
  return serializeDemand(state, updated);
}

export function deleteDemand(id: number) {
  const state = workforceStore.read();
  if (!state.demands.some((demand) => demand.id === id)) return { ok: false as const, status: 404, detail: 'Demand not found' };
  workforceStore.write({
    ...state,
    demands: state.demands.filter((demand) => demand.id !== id),
    assignments: state.assignments.map((assignment) => assignment.demand_id === id ? { ...assignment, demand_id: null } : assignment)
  });
  return { ok: true as const };
}

export function listAssignments() {
  const state = workforceStore.read();
  return state.assignments.slice().sort((a, b) => compareDateStrings(a.start_date, b.start_date) || a.id - b.id).map((assignment) => serializeAssignment(state, assignment));
}

export function createAssignment(input: unknown) {
  const payload = assignmentCreateSchema.parse(input);
  ensureDateOrder(payload.start_date, payload.end_date, 'Assignment');
  const state = workforceStore.update((current) => {
    const employee = ensureEmployeeExists(current, payload.employee_id);
    ensureProjectExists(current, payload.project_id);
    const demand = ensureDemandExists(current, payload.demand_id);
    if (demand && demand.project_id !== payload.project_id) badRequest('Demand must belong to the selected project');
    const overlappingAllocation = current.assignments
      .filter((assignment) => assignment.employee_id === payload.employee_id && dateRangesOverlap(assignment.start_date, assignment.end_date, payload.start_date, payload.end_date))
      .reduce((sum, assignment) => sum + assignment.allocation, payload.allocation);
    if (overlappingAllocation > employee.capacity + 0.0001) badRequest('Assignment exceeds employee capacity in the selected date range');
    const record: AssignmentRecord = { id: nextId(current.assignments), ...payload, notes: payload.notes, status: 'approved' };
    return { ...current, assignments: [...current.assignments, record] };
  });
  return serializeAssignment(state, state.assignments[state.assignments.length - 1]!);
}

export function updateAssignment(id: number, input: unknown) {
  const patch = assignmentUpdateSchema.parse(input);
  let updated: AssignmentRecord | null = null;
  const state = workforceStore.update((current) => {
    const existing = current.assignments.find((assignment) => assignment.id === id);
    if (!existing) return current;
    const next: AssignmentRecord = { ...existing, ...patch };
    ensureDateOrder(next.start_date, next.end_date, 'Assignment');
    const employee = ensureEmployeeExists(current, next.employee_id);
    ensureProjectExists(current, next.project_id);
    const demand = ensureDemandExists(current, next.demand_id);
    if (demand && demand.project_id !== next.project_id) badRequest('Demand must belong to the selected project');
    const overlappingAllocation = current.assignments
      .filter((assignment) => assignment.id !== id && assignment.employee_id === next.employee_id && dateRangesOverlap(assignment.start_date, assignment.end_date, next.start_date, next.end_date))
      .reduce((sum, assignment) => sum + assignment.allocation, next.allocation);
    if (overlappingAllocation > employee.capacity + 0.0001) badRequest('Assignment exceeds employee capacity in the selected date range');
    updated = next;
    return { ...current, assignments: current.assignments.map((assignment) => assignment.id === id ? next : assignment) };
  });
  if (!updated) return null;
  return serializeAssignment(state, updated);
}

export function deleteAssignment(id: number) {
  const state = workforceStore.read();
  if (!state.assignments.some((assignment) => assignment.id === id)) return { ok: false as const, status: 404, detail: 'Assignment not found' };
  workforceStore.write({ ...state, assignments: state.assignments.filter((assignment) => assignment.id !== id) });
  return { ok: true as const };
}

export function getDashboardData(username: string) {
  const state = workforceStore.read();
  const prefs = getOrCreateDashboardPreferences(state, username);
  const trackedSet = new Set(prefs.tracked_employee_ids);
  const leader = state.employees.find((employee) => employee.name.toLowerCase() === username.toLowerCase() || employee.role?.toLowerCase() === username.toLowerCase()) ?? null;
  const directReports = leader ? state.employees.filter((employee) => employee.manager_id === leader.id) : [];
  const today = new Date().toISOString().slice(0, 10);
  const summarizeEmployee = (employee: EmployeeRecord, flags: { is_direct_report?: boolean; is_tracked?: boolean } = {}) => {
    const activeAssignments = state.assignments.filter((assignment) => assignment.employee_id === employee.id && assignment.start_date <= today && assignment.end_date >= today);
    const activeAllocation = activeAssignments.reduce((sum, assignment) => sum + assignment.allocation, 0);
    const organization = state.organizations.find((org) => org.id === employee.organization_id);
    const manager = employee.manager_id ? state.employees.find((item) => item.id === employee.manager_id) : null;
    const ratio = employee.capacity > 0 ? activeAllocation / employee.capacity : 0;
    return {
      id: employee.id,
      name: employee.name,
      organization_name: organization?.name ?? null,
      manager_name: manager?.name ?? null,
      capacity: employee.capacity,
      active_allocation: activeAllocation,
      active_allocation_percent: activeAllocation * 100,
      capacity_percent: employee.capacity * 100,
      load_status: ratio > 1 ? 'over' : ratio >= 0.85 ? 'high' : ratio > 0 ? 'active' : 'available',
      is_direct_report: Boolean(flags.is_direct_report),
      is_indirect_report: false,
      is_tracked: Boolean(flags.is_tracked),
      active_assignment_count: activeAssignments.length
    };
  };

  const directReportSummaries = directReports.map((employee) => summarizeEmployee(employee, { is_direct_report: true })).sort((a, b) => a.name.localeCompare(b.name));
  const trackedSummaries = state.employees.filter((employee) => trackedSet.has(employee.id)).map((employee) => summarizeEmployee(employee, { is_tracked: true })).sort((a, b) => a.name.localeCompare(b.name));
  const assignmentSummaries = state.assignments.map((assignment) => serializeAssignment(state, assignment));

  return {
    username,
    employee_id: leader?.id ?? null,
    employee_name: leader?.name ?? null,
    direct_reports: directReportSummaries,
    tracked_employees: trackedSummaries,
    approval_items: [],
    submitted_items: assignmentSummaries.slice().sort((a, b) => compareDateStrings(a.start_date, b.start_date)).slice(0, 8),
    available_tracking_candidates: listEmployees().filter((employee) => !trackedSet.has(employee.id))
  };
}

export function updateDashboardTrackedEmployees(username: string, input: unknown) {
  const payload = dashboardTrackedEmployeesSchema.parse(input);
  const state = workforceStore.update((current) => ({
    ...current,
    dashboard: {
      ...current.dashboard,
      [username]: {
        tracked_employee_ids: payload.employee_ids.filter((id, index, values) => values.indexOf(id) === index && current.employees.some((employee) => employee.id === id))
      }
    }
  }));
  return getDashboardData(username || Object.keys(state.dashboard)[0] || 'unknown');
}

export function getForecastData() {
  const state = workforceStore.read();
  return state.projects.slice().sort((a, b) => a.name.localeCompare(b.name)).map((project) => {
    const demands = state.demands.filter((demand) => demand.project_id === project.id);
    const assignments = state.assignments.filter((assignment) => assignment.project_id === project.id);
    const demandTotal = demands.reduce((sum, demand) => sum + demand.required_allocation, 0);
    const assignmentTotal = assignments.reduce((sum, assignment) => sum + assignment.allocation, 0);
    return {
      ...serializeProject(state, project),
      demand_total: demandTotal,
      assignment_total: assignmentTotal,
      gap_total: demandTotal - assignmentTotal,
      demand_rows: demands.map((demand) => serializeDemand(state, demand)),
      assignment_rows: assignments.map((assignment) => serializeAssignment(state, assignment))
    };
  });
}

export function formatWorkforceError(error: unknown): { statusCode: number; detail: string } {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return { statusCode: 400, detail: issue?.message ?? 'Invalid request' };
  }
  if (error instanceof Error && 'statusCode' in error && typeof (error as { statusCode?: unknown }).statusCode === 'number') {
    return { statusCode: (error as { statusCode: number }).statusCode, detail: error.message };
  }
  if (error instanceof Error) return { statusCode: 400, detail: error.message };
  return { statusCode: 500, detail: 'Unexpected workforce error' };
}
