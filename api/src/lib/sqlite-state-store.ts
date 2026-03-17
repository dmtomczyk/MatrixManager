import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function ensureParentDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return clone(fallback);
  return JSON.parse(value) as T;
}

export class SqliteStateStore<T extends object> {
  private readonly db: DatabaseSync;

  constructor(
    private readonly dbPath: string,
    private readonly namespace: string,
    private readonly initialState: T,
    private readonly schemaSql: string,
    private readonly readState: (db: DatabaseSync) => T,
    private readonly writeState: (db: DatabaseSync, state: T) => void,
    private readonly migrateLegacy?: () => T | null
  ) {
    ensureParentDir(dbPath);
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS store_meta (
        namespace TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        migrated_from TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    this.db.exec(schemaSql);
    this.initialize();
  }

  private initialize() {
    const meta = this.db.prepare('SELECT namespace FROM store_meta WHERE namespace = ?').get(this.namespace) as { namespace?: string } | undefined;
    if (meta?.namespace) return;
    const legacy = this.migrateLegacy?.() ?? null;
    this.replaceState(legacy ?? clone(this.initialState));
    this.db.prepare(`
      INSERT INTO store_meta (namespace, schema_version, migrated_from, updated_at)
      VALUES (?, 1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(namespace) DO UPDATE SET updated_at = excluded.updated_at, migrated_from = excluded.migrated_from
    `).run(this.namespace, legacy ? 'legacy-json' : null);
  }

  read(): T {
    return this.readState(this.db);
  }

  write(state: T): void {
    this.replaceState(state);
  }

  update(updater: (state: T) => T): T {
    const next = updater(this.read());
    this.replaceState(next);
    return next;
  }

  private replaceState(state: T) {
    this.db.exec('BEGIN');
    try {
      this.writeState(this.db, clone(state));
      this.db.prepare('UPDATE store_meta SET updated_at = CURRENT_TIMESTAMP WHERE namespace = ?').run(this.namespace);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

export { parseJson };
