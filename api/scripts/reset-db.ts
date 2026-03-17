import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '../src/config.js';

const config = getConfig();
const dataPath = path.resolve(config.tsDataDbPath);
const controlPath = path.resolve(config.tsControlDbPath);

for (const filePath of [dataPath, controlPath]) {
  for (const candidate of [filePath, `${filePath}-wal`, `${filePath}-shm`]) {
    if (fs.existsSync(candidate)) {
      fs.rmSync(candidate, { force: true });
      console.log(`Deleted ${candidate}`);
    }
  }
}

const { workforceStore } = await import('../src/features/workforce/store.js');
const { adminStore } = await import('../src/features/admin/store.js');

workforceStore.write({
  organizations: [],
  jobCodes: [],
  employees: [],
  projects: [],
  demands: [],
  assignments: [],
  dashboard: {}
});

adminStore.write({
  users: [],
  profiles: {},
  inbox: {},
  audit: [],
  dbConnections: []
});

console.log(`Initialized fresh TS databases:`);
console.log(`- data: ${dataPath}`);
console.log(`- control: ${controlPath}`);
