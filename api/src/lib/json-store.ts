import fs from 'node:fs';
import path from 'node:path';

export interface JsonStoreShape {
  organizations: Array<object>;
  jobCodes?: Array<object>;
  employees: Array<object>;
}

const defaultState: JsonStoreShape = {
  organizations: [],
  jobCodes: [],
  employees: []
};

function ensureParentDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export class JsonStore<T extends JsonStoreShape> {
  constructor(private readonly filePath: string, private readonly initialState: T) {}

  read(): T {
    if (!fs.existsSync(this.filePath)) {
      ensureParentDir(this.filePath);
      fs.writeFileSync(this.filePath, JSON.stringify(this.initialState, null, 2));
      return structuredClone(this.initialState);
    }
    const raw = fs.readFileSync(this.filePath, 'utf8');
    return JSON.parse(raw) as T;
  }

  write(state: T): void {
    ensureParentDir(this.filePath);
    fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2));
  }

  update(updater: (state: T) => T): T {
    const next = updater(this.read());
    this.write(next);
    return next;
  }
}

export { defaultState };
