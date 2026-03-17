import path from 'node:path';
import { JsonStore } from '../../lib/json-store.js';

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

export const adminStore = new JsonStore<AdminState>(
  path.resolve(import.meta.dirname, '..', '..', '..', 'data', 'api-admin.json'),
  {
    users: [],
    profiles: {},
    inbox: {},
    audit: [],
    dbConnections: []
  }
);
