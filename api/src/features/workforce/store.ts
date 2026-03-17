import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { getConfig } from '../../config.js';
import { SqliteStateStore, parseJson } from '../../lib/sqlite-state-store.js';
import type { AssignmentRecord, DashboardPreferencesRecord, DemandRecord, EmployeeRecord, JobCodeRecord, OrganizationRecord, ProjectRecord, WorkforceState } from './types.js';

const legacyJsonPath = path.resolve(import.meta.dirname, '..', '..', '..', 'data', 'api-workforce.json');
const fallbackDbPath = path.resolve(import.meta.dirname, '..', '..', '..', 'data', 'matrixmanager-ts-data.sqlite');

function readLegacyState(): WorkforceState | null {
  if (!fs.existsSync(legacyJsonPath)) return null;
  return {
    organizations: [],
    jobCodes: [],
    employees: [],
    projects: [],
    demands: [],
    assignments: [],
    dashboard: {},
    ...JSON.parse(fs.readFileSync(legacyJsonPath, 'utf8')) as Partial<WorkforceState>
  };
}

function getDbPath() {
  return path.resolve(getConfig().tsDataDbPath || fallbackDbPath);
}

function writeOrganizations(db: DatabaseSync, items: OrganizationRecord[]) {
  db.exec('DELETE FROM organizations');
  const stmt = db.prepare('INSERT INTO organizations (id, name, description, parent_organization_id, owner_employee_id) VALUES (?, ?, ?, ?, ?)');
  for (const item of items) stmt.run(item.id, item.name, item.description, item.parent_organization_id, item.owner_employee_id);
}

function writeJobCodes(db: DatabaseSync, items: JobCodeRecord[]) {
  db.exec('DELETE FROM job_codes');
  const stmt = db.prepare('INSERT INTO job_codes (id, name, is_leader) VALUES (?, ?, ?)');
  for (const item of items) stmt.run(item.id, item.name, item.is_leader ? 1 : 0);
}

function writeEmployees(db: DatabaseSync, items: EmployeeRecord[]) {
  db.exec('DELETE FROM employees');
  const stmt = db.prepare('INSERT INTO employees (id, name, job_code_id, employee_type, role, location, capacity, manager_id, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const item of items) stmt.run(item.id, item.name, item.job_code_id, item.employee_type, item.role, item.location, item.capacity, item.manager_id, item.organization_id);
}

function writeProjects(db: DatabaseSync, items: ProjectRecord[]) {
  db.exec('DELETE FROM projects');
  const stmt = db.prepare('INSERT INTO projects (id, name, description, start_date, end_date) VALUES (?, ?, ?, ?, ?)');
  for (const item of items) stmt.run(item.id, item.name, item.description, item.start_date, item.end_date);
}

function writeDemands(db: DatabaseSync, items: DemandRecord[]) {
  db.exec('DELETE FROM demands');
  const stmt = db.prepare('INSERT INTO demands (id, project_id, title, organization_id, job_code_id, skill_notes, start_date, end_date, required_allocation, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const item of items) stmt.run(item.id, item.project_id, item.title, item.organization_id, item.job_code_id, item.skill_notes, item.start_date, item.end_date, item.required_allocation, item.notes);
}

function writeAssignments(db: DatabaseSync, items: AssignmentRecord[]) {
  db.exec('DELETE FROM assignments');
  const stmt = db.prepare('INSERT INTO assignments (id, employee_id, project_id, demand_id, start_date, end_date, allocation, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const item of items) stmt.run(item.id, item.employee_id, item.project_id, item.demand_id, item.start_date, item.end_date, item.allocation, item.notes, item.status);
}

function writeDashboard(db: DatabaseSync, dashboard: Record<string, DashboardPreferencesRecord>) {
  db.exec('DELETE FROM dashboard_preferences');
  const stmt = db.prepare('INSERT INTO dashboard_preferences (username, tracked_employee_ids_json) VALUES (?, ?)');
  for (const [username, prefs] of Object.entries(dashboard)) stmt.run(username, JSON.stringify(prefs.tracked_employee_ids));
}

function readState(db: DatabaseSync): WorkforceState {
  return {
    organizations: db.prepare('SELECT id, name, description, parent_organization_id, owner_employee_id FROM organizations ORDER BY id').all() as unknown as OrganizationRecord[],
    jobCodes: (db.prepare('SELECT id, name, is_leader FROM job_codes ORDER BY id').all() as Array<{ id: number; name: string; is_leader: number }>).map((item) => ({ ...item, is_leader: Boolean(item.is_leader) })),
    employees: db.prepare('SELECT id, name, job_code_id, employee_type, role, location, capacity, manager_id, organization_id FROM employees ORDER BY id').all() as unknown as EmployeeRecord[],
    projects: db.prepare('SELECT id, name, description, start_date, end_date FROM projects ORDER BY id').all() as unknown as ProjectRecord[],
    demands: db.prepare('SELECT id, project_id, title, organization_id, job_code_id, skill_notes, start_date, end_date, required_allocation, notes FROM demands ORDER BY id').all() as unknown as DemandRecord[],
    assignments: db.prepare('SELECT id, employee_id, project_id, demand_id, start_date, end_date, allocation, notes, status FROM assignments ORDER BY id').all() as unknown as AssignmentRecord[],
    dashboard: Object.fromEntries((db.prepare('SELECT username, tracked_employee_ids_json FROM dashboard_preferences ORDER BY username').all() as Array<{ username: string; tracked_employee_ids_json: string }>).map((row) => [row.username, { tracked_employee_ids: parseJson<number[]>(row.tracked_employee_ids_json, []) }]))
  };
}

export const workforceStore = new SqliteStateStore<WorkforceState>(
  getDbPath(),
  'workforce',
  { organizations: [], jobCodes: [], employees: [], projects: [], demands: [], assignments: [], dashboard: {} },
  `
    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      parent_organization_id INTEGER,
      owner_employee_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS job_codes (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      is_leader INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      job_code_id INTEGER,
      employee_type TEXT NOT NULL,
      role TEXT,
      location TEXT,
      capacity REAL NOT NULL,
      manager_id INTEGER,
      organization_id INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      start_date TEXT,
      end_date TEXT
    );
    CREATE TABLE IF NOT EXISTS demands (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      organization_id INTEGER,
      job_code_id INTEGER,
      skill_notes TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      required_allocation REAL NOT NULL,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY,
      employee_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      demand_id INTEGER,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      allocation REAL NOT NULL,
      notes TEXT,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dashboard_preferences (
      username TEXT PRIMARY KEY,
      tracked_employee_ids_json TEXT NOT NULL
    );
  `,
  readState,
  (db, state) => {
    writeOrganizations(db, state.organizations);
    writeJobCodes(db, state.jobCodes);
    writeEmployees(db, state.employees);
    writeProjects(db, state.projects);
    writeDemands(db, state.demands);
    writeAssignments(db, state.assignments);
    writeDashboard(db, state.dashboard);
  },
  readLegacyState
);
