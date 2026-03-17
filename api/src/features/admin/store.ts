import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { getConfig } from '../../config.js';
import { SqliteStateStore, parseJson } from '../../lib/sqlite-state-store.js';

export interface UserRecord {
  id: number;
  username: string;
  password: string;
  employee_id: number | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountProfileRecord {
  display_name: string | null;
  profile_picture_url: string | null;
}

export interface InboxStateRecord {
  hidden_ids: number[];
  read_ids: number[];
}

export interface AuditEntryRecord {
  id: number;
  at: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  before_json: string | null;
  after_json: string | null;
}

export interface DbConnectionRecord {
  id: number;
  name: string;
  db_type: 'sqlite' | 'postgresql';
  connection_string: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminState {
  users: UserRecord[];
  profiles: Record<string, AccountProfileRecord>;
  inbox: Record<string, InboxStateRecord>;
  audit: AuditEntryRecord[];
  dbConnections: DbConnectionRecord[];
}

const legacyJsonPath = path.resolve(import.meta.dirname, '..', '..', '..', 'data', 'api-admin.json');

function readLegacyState(): AdminState | null {
  if (!fs.existsSync(legacyJsonPath)) return null;
  return {
    users: [],
    profiles: {},
    inbox: {},
    audit: [],
    dbConnections: [],
    ...JSON.parse(fs.readFileSync(legacyJsonPath, 'utf8')) as Partial<AdminState>
  };
}

function getDbPath() {
  return path.resolve(getConfig().tsControlDbPath);
}

function readState(db: DatabaseSync): AdminState {
  return {
    users: (db.prepare('SELECT id, username, password, employee_id, is_admin, created_at, updated_at FROM users ORDER BY id').all() as Array<Omit<UserRecord, 'is_admin'> & { is_admin: number }>).map((row) => ({ ...row, is_admin: Boolean(row.is_admin) })),
    profiles: Object.fromEntries((db.prepare('SELECT username, display_name, profile_picture_url FROM account_profiles ORDER BY username').all() as Array<{ username: string; display_name: string | null; profile_picture_url: string | null }>).map((row) => [row.username, { display_name: row.display_name, profile_picture_url: row.profile_picture_url }])),
    inbox: Object.fromEntries((db.prepare('SELECT username, hidden_ids_json, read_ids_json FROM inbox_states ORDER BY username').all() as Array<{ username: string; hidden_ids_json: string; read_ids_json: string }>).map((row) => [row.username, { hidden_ids: parseJson<number[]>(row.hidden_ids_json, []), read_ids: parseJson<number[]>(row.read_ids_json, []) }])),
    audit: db.prepare('SELECT id, at, actor, action, entity_type, entity_id, summary, before_json, after_json FROM audit_entries ORDER BY id').all() as unknown as AuditEntryRecord[],
    dbConnections: (db.prepare('SELECT id, name, db_type, connection_string, is_active, notes, created_at, updated_at FROM db_connections ORDER BY id').all() as Array<Omit<DbConnectionRecord, 'is_active'> & { is_active: number }>).map((row) => ({ ...row, is_active: Boolean(row.is_active) }))
  };
}

export const adminStore = new SqliteStateStore<AdminState>(
  getDbPath(),
  'admin',
  { users: [], profiles: {}, inbox: {}, audit: [], dbConnections: [] },
  `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      employee_id INTEGER,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS account_profiles (
      username TEXT PRIMARY KEY,
      display_name TEXT,
      profile_picture_url TEXT
    );
    CREATE TABLE IF NOT EXISTS inbox_states (
      username TEXT PRIMARY KEY,
      hidden_ids_json TEXT NOT NULL,
      read_ids_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_entries (
      id INTEGER PRIMARY KEY,
      at TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT
    );
    CREATE TABLE IF NOT EXISTS db_connections (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      db_type TEXT NOT NULL,
      connection_string TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `,
  readState,
  (db, state) => {
    db.exec('DELETE FROM users');
    const userStmt = db.prepare('INSERT INTO users (id, username, password, employee_id, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const user of state.users) userStmt.run(user.id, user.username, user.password, user.employee_id, user.is_admin ? 1 : 0, user.created_at, user.updated_at);

    db.exec('DELETE FROM account_profiles');
    const profileStmt = db.prepare('INSERT INTO account_profiles (username, display_name, profile_picture_url) VALUES (?, ?, ?)');
    for (const [username, profile] of Object.entries(state.profiles)) profileStmt.run(username, profile.display_name, profile.profile_picture_url);

    db.exec('DELETE FROM inbox_states');
    const inboxStmt = db.prepare('INSERT INTO inbox_states (username, hidden_ids_json, read_ids_json) VALUES (?, ?, ?)');
    for (const [username, inbox] of Object.entries(state.inbox)) inboxStmt.run(username, JSON.stringify(inbox.hidden_ids), JSON.stringify(inbox.read_ids));

    db.exec('DELETE FROM audit_entries');
    const auditStmt = db.prepare('INSERT INTO audit_entries (id, at, actor, action, entity_type, entity_id, summary, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const audit of state.audit) auditStmt.run(audit.id, audit.at, audit.actor, audit.action, audit.entity_type, audit.entity_id, audit.summary, audit.before_json, audit.after_json);

    db.exec('DELETE FROM db_connections');
    const connStmt = db.prepare('INSERT INTO db_connections (id, name, db_type, connection_string, is_active, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const connection of state.dbConnections) connStmt.run(connection.id, connection.name, connection.db_type, connection.connection_string, connection.is_active ? 1 : 0, connection.notes, connection.created_at, connection.updated_at);
  },
  readLegacyState
);
