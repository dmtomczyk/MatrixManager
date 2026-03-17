import path from 'node:path';
import { JsonStore } from '../../lib/json-store.js';
import type { WorkforceState } from './types.js';

export const workforceStore = new JsonStore<WorkforceState>(
  path.resolve(import.meta.dirname, '..', '..', '..', 'data', 'api-workforce.json'),
  {
    organizations: [],
    employees: []
  }
);
