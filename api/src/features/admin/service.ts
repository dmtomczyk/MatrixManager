import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '../../config.js';
import { listEmployees, listOrganizations, listProjects, listAssignments, getDashboardData } from '../workforce/service.js';
import { workforceStore } from '../workforce/store.js';
import { adminStore, type AccountProfileRecord, type AuditEntryRecord, type DbConnectionRecord, type UserRecord } from './store.js';

function nowIso() {
  return new Date().toISOString();
}

function badRequest(detail: string): never {
  throw new Error(detail);
}

function nextId(items: Array<{ id: number }>) {
  return items.length ? Math.max(...items.map((item) => item.id)) + 1 : 1;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function ensureProfile(username: string): AccountProfileRecord {
  const state = adminStore.read();
  return clone(state.profiles[username] ?? { display_name: null, profile_picture_url: null });
}

export function isAdminUser(username: string): boolean {
  const config = getConfig();
  if (username === config.authUsername) return true;
  const state = adminStore.read();
  return state.users.some((user) => user.username.toLowerCase() === username.toLowerCase() && user.is_admin);
}

export function authenticateUser(username: string, password: string): { username: string } | null {
  const config = getConfig();
  if (username === config.authUsername && password === config.authPassword) return { username };
  const state = adminStore.read();
  const user = state.users.find((entry) => entry.username.toLowerCase() === username.toLowerCase() && entry.password === password);
  return user ? { username: user.username } : null;
}

export function listUsers() {
  return adminStore.read().users.slice().sort((a, b) => a.username.localeCompare(b.username)).map((user) => ({
    ...clone(user),
    employee_name: listEmployees().find((employee) => employee.id === user.employee_id)?.name ?? null
  }));
}

export function createUser(input: { username: string; password: string; employee_id: number | null; is_admin: boolean; }): UserRecord {
  const username = input.username.trim();
  if (!username) badRequest('Username is required');
  if (!input.password) badRequest('Password is required');
  const employees = listEmployees();
  if (input.employee_id != null && !employees.some((employee) => employee.id === input.employee_id)) {
    badRequest('Linked employee was not found');
  }
  const config = getConfig();
  const state = adminStore.read();
  if (username.toLowerCase() === config.authUsername.toLowerCase() || state.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    badRequest('Username already exists');
  }
  const record: UserRecord = { id: nextId(state.users), username, password: input.password, employee_id: input.employee_id, is_admin: input.is_admin, created_at: nowIso(), updated_at: nowIso() };
  adminStore.write({ ...state, users: [...state.users, record] });
  return record;
}

export function updateUser(id: number, input: { password?: string | null; employee_id: number | null; is_admin: boolean; }): UserRecord | null {
  const employees = listEmployees();
  if (input.employee_id != null && !employees.some((employee) => employee.id === input.employee_id)) {
    badRequest('Linked employee was not found');
  }
  let updated: UserRecord | null = null;
  adminStore.update((state) => ({
    ...state,
    users: state.users.map((user) => {
      if (user.id !== id) return user;
      updated = { ...user, password: input.password ? input.password : user.password, employee_id: input.employee_id, is_admin: input.is_admin, updated_at: nowIso() };
      return updated;
    })
  }));
  return updated;
}

export function deleteUser(id: number) {
  const state = adminStore.read();
  if (!state.users.some((user) => user.id === id)) return { ok: false as const, detail: 'User not found' };
  adminStore.write({ ...state, users: state.users.filter((user) => user.id !== id) });
  return { ok: true as const };
}

export function getAccountSettings(username: string) {
  const config = getConfig();
  const profile = ensureProfile(username);
  const user = adminStore.read().users.find((entry) => entry.username.toLowerCase() === username.toLowerCase()) ?? null;
  return {
    username,
    display_name: profile.display_name,
    profile_picture_url: profile.profile_picture_url,
    employee_id: user?.employee_id ?? null,
    employee_name: user?.employee_id ? listEmployees().find((employee) => employee.id === user.employee_id)?.name ?? null : null,
    is_admin: user?.is_admin ?? username === config.authUsername,
    is_env_account: username === config.authUsername && !user
  };
}

export function updateAccountSettings(username: string, input: { display_name: string | null; profile_picture_url: string | null; password: string | null; }) {
  const state = adminStore.read();
  const currentProfile = state.profiles[username] ?? { display_name: null, profile_picture_url: null };
  const users = state.users.map((user) => user.username.toLowerCase() === username.toLowerCase()
    ? { ...user, password: input.password || user.password, updated_at: nowIso() }
    : user);
  adminStore.write({
    ...state,
    users,
    profiles: {
      ...state.profiles,
      [username]: {
        display_name: input.display_name,
        profile_picture_url: input.profile_picture_url
      }
    }
  });
  return {
    before: currentProfile,
    after: { display_name: input.display_name, profile_picture_url: input.profile_picture_url }
  };
}

function getInboxState(username: string) {
  const state = adminStore.read();
  return state.inbox[username] ?? { hidden_ids: [], read_ids: [] };
}

export function listInboxItems(username: string) {
  const dashboard = getDashboardData(username);
  const inboxState = getInboxState(username);
  const visibleIds = new Set<number>();
  const items = [] as Array<{ id: number; kind: string; title: string; body: string; href: string; created_at: string; is_read: boolean; }>;
  const tracked = dashboard.direct_reports.concat(dashboard.tracked_employees);
  tracked.forEach((employee) => {
    if ((employee.active_allocation_percent ?? 0) > (employee.capacity_percent ?? 100)) {
      const id = 100000 + employee.id;
      if (inboxState.hidden_ids.includes(id)) return;
      visibleIds.add(id);
      items.push({ id, kind: 'allocation-alert', title: `${employee.name} is over capacity`, body: `${employee.name} is at ${Math.round(employee.active_allocation_percent ?? 0)}% allocation against ${Math.round(employee.capacity_percent ?? 0)}% capacity.`, href: '/dashboard', created_at: nowIso(), is_read: inboxState.read_ids.includes(id) });
    }
  });
  listProjects().forEach((project) => {
    const gap = (project.demanded_allocation ?? 0) - (project.assigned_allocation ?? 0);
    if (gap > 0.001) {
      const id = 200000 + project.id;
      if (inboxState.hidden_ids.includes(id)) return;
      visibleIds.add(id);
      items.push({ id, kind: 'forecast-gap', title: `${project.name} still has staffing gap`, body: `${gap.toFixed(2)} FTE remains unfilled across current TypeScript demand rows.`, href: '/forecast', created_at: nowIso(), is_read: inboxState.read_ids.includes(id) });
    }
  });
  adminStore.read().audit.slice(-10).reverse().forEach((entry) => {
    const id = 300000 + entry.id;
    if (inboxState.hidden_ids.includes(id)) return;
    visibleIds.add(id);
    items.push({ id, kind: 'audit', title: entry.summary, body: `${entry.actor} · ${entry.entity_type} ${entry.entity_id}`, href: '/audit', created_at: entry.at, is_read: inboxState.read_ids.includes(id) });
  });
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function markInboxItemRead(username: string, id: number) {
  adminStore.update((state) => {
    const current = state.inbox[username] ?? { hidden_ids: [], read_ids: [] };
    return { ...state, inbox: { ...state.inbox, [username]: { ...current, read_ids: [...new Set(current.read_ids.concat(id))] } } };
  });
}

export function deleteInboxItem(username: string, id: number) {
  adminStore.update((state) => {
    const current = state.inbox[username] ?? { hidden_ids: [], read_ids: [] };
    return { ...state, inbox: { ...state.inbox, [username]: { hidden_ids: [...new Set(current.hidden_ids.concat(id))], read_ids: current.read_ids.filter((item) => item !== id) } } };
  });
}

export function listAuditEntries(filters?: { entity_type?: string; action?: string; actor?: string; query?: string; }) {
  return adminStore.read().audit
    .slice()
    .reverse()
    .filter((entry) => !filters?.entity_type || entry.entity_type === filters.entity_type)
    .filter((entry) => !filters?.action || entry.action === filters.action)
    .filter((entry) => !filters?.actor || entry.actor.toLowerCase().includes(filters.actor.toLowerCase()))
    .filter((entry) => !filters?.query || JSON.stringify(entry).toLowerCase().includes(filters.query.toLowerCase()));
}

export function addAuditEntry(input: Omit<AuditEntryRecord, 'id' | 'at'> & { at?: string; }) {
  const state = adminStore.read();
  const entry: AuditEntryRecord = { id: nextId(state.audit), at: input.at ?? nowIso(), actor: input.actor, action: input.action, entity_type: input.entity_type, entity_id: input.entity_id, summary: input.summary, before_json: input.before_json ?? null, after_json: input.after_json ?? null };
  adminStore.write({ ...state, audit: [...state.audit, entry] });
  return entry;
}

export function clearAuditLog(actor: string) {
  const state = adminStore.read();
  adminStore.write({ ...state, audit: [] });
  addAuditEntry({ actor, action: 'clear', entity_type: 'audit', entity_id: 'all', summary: 'Cleared audit history', before_json: null, after_json: null });
}

export function listDbConnections() {
  return adminStore.read().dbConnections.slice().sort((a, b) => a.name.localeCompare(b.name));
}

export function createDbConnection(input: { name: string; db_type: 'sqlite' | 'postgresql'; connection_string: string; is_active: boolean; notes: string | null; }): DbConnectionRecord {
  if (!input.name.trim()) badRequest('Connection name is required');
  if (!input.connection_string.trim()) badRequest('Connection string is required');
  const state = adminStore.read();
  const next: DbConnectionRecord = { id: nextId(state.dbConnections), name: input.name.trim(), db_type: input.db_type, connection_string: input.connection_string.trim(), is_active: input.is_active, notes: input.notes, created_at: nowIso(), updated_at: nowIso() };
  const dbConnections = state.dbConnections.map((item) => input.is_active ? { ...item, is_active: false } : item).concat(next);
  adminStore.write({ ...state, dbConnections });
  return next;
}

export function updateDbConnection(id: number, input: { name: string; db_type: 'sqlite' | 'postgresql'; connection_string: string; is_active: boolean; notes: string | null; }): DbConnectionRecord | null {
  let updated: DbConnectionRecord | null = null;
  adminStore.update((state) => ({
    ...state,
    dbConnections: state.dbConnections
      .map((item) => input.is_active ? { ...item, is_active: false } : item)
      .map((item) => {
        if (item.id !== id) return item;
        updated = { ...item, name: input.name.trim(), db_type: input.db_type, connection_string: input.connection_string.trim(), is_active: input.is_active, notes: input.notes, updated_at: nowIso() };
        return updated;
      })
  }));
  return updated;
}

export function deleteDbConnection(id: number) {
  const state = adminStore.read();
  if (!state.dbConnections.some((item) => item.id === id)) return { ok: false as const, detail: 'Connection not found' };
  adminStore.write({ ...state, dbConnections: state.dbConnections.filter((item) => item.id !== id) });
  return { ok: true as const };
}

export function getRuntimeOverview() {
  const config = getConfig();
  const dataPath = path.resolve(config.tsDataDbPath);
  const controlPath = path.resolve(config.tsControlDbPath);
  const organizations = listOrganizations();
  const employees = listEmployees();
  const projects = listProjects();
  const assignments = listAssignments();
  const dbConnections = listDbConnections();
  const recentAudit = adminStore.read().audit.slice(-8).reverse();
  return {
    overview: {
      overall_status: 'ok',
      runtime_environment: config.matrixEnv,
      active_data_db_status: fs.existsSync(dataPath) ? 'ok' : 'warn',
      control_db_status: fs.existsSync(controlPath) ? 'ok' : 'warn',
      docker_available: fs.existsSync('/var/run/docker.sock'),
      docker_error: fs.existsSync('/var/run/docker.sock') ? null : 'Docker socket not present',
      recent_error_count: 0,
      recommended_actions: dbConnections.length ? [] : ['Create a DB connection profile if you want an admin-visible target list on /db-management.'],
      services: [
        { name: 'matrixmanager-api', status: 'ok', detail: 'Fastify TypeScript service responding.' },
        { name: 'workforce-store', status: fs.existsSync(dataPath) ? 'ok' : 'warn', detail: `${config.activeDbType}:${dataPath}` },
        { name: 'admin-store', status: fs.existsSync(controlPath) ? 'ok' : 'warn', detail: `sqlite:${controlPath}` }
      ],
      installed_versions: [
        { name: 'node', value: process.version },
        { name: 'matrix_env', value: config.matrixEnv },
        { name: 'active_db_type', value: config.activeDbType }
      ],
      db_connections: dbConnections.map((item) => ({ name: item.name, db_type: item.db_type, status: item.is_active ? 'active' : 'available', detail: item.connection_string }))
    },
    snapshots: [
      { id: 1, at: nowIso(), key: 'organizations', status: 'ok', value: String(organizations.length), detail: 'Organizations in TS store' },
      { id: 2, at: nowIso(), key: 'employees', status: 'ok', value: String(employees.length), detail: 'Employees in TS store' },
      { id: 3, at: nowIso(), key: 'projects', status: 'ok', value: String(projects.length), detail: 'Projects in TS store' },
      { id: 4, at: nowIso(), key: 'assignments', status: 'ok', value: String(assignments.length), detail: 'Assignments in TS store' }
    ],
    errorGroups: [],
    errors: [],
    recentAudit
  };
}

export function wipeDataStore() {
  workforceStore.write({ organizations: [], jobCodes: [], employees: [], projects: [], demands: [], assignments: [], dashboard: {} });
}
