import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [rawKey, ...rawValueParts] = line.split('=');
    const key = rawKey.trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = rawValueParts.join('=').trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
loadEnvFile(path.join(repoRoot, '.env'));

const settingsSchema = z.object({
  host: z.string().default('127.0.0.1'),
  port: z.coerce.number().int().positive().default(8000),
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  matrixEnv: z.enum(['development', 'dev', 'test', 'production']).default('development'),
  authUsername: z.string().default('admin'),
  authPassword: z.string().default('change-me'),
  authSecret: z.string().default('replace-with-a-long-random-secret'),
  baseUrl: z.string().default('http://127.0.0.1:8000'),
  uiDevUrl: z.string().default('http://127.0.0.1:4173'),
  uiUseDevServer: z.boolean().default(true),
  githubRepoUrl: z.string().default('https://github.com/openclaw/openclaw'),
  logoHref: z.string().default('/static/images/matrix-manager-favicon.svg'),
  installMode: z.enum(['sqlite', 'postgresql']).default('sqlite'),
  activeDbType: z.enum(['sqlite', 'postgresql']).default('sqlite'),
  tsDataDbPath: z.string().default(path.join(repoRoot, 'api', 'data', 'matrixmanager-ts-data.sqlite')),
  tsControlDbPath: z.string().default(path.join(repoRoot, 'api', 'data', 'matrixmanager-ts-control.sqlite')),
  postgresHost: z.string().default('127.0.0.1'),
  postgresPort: z.coerce.number().int().positive().default(5432),
  postgresDb: z.string().default('matrixmanager'),
  postgresUser: z.string().default('matrixmanager'),
  postgresPassword: z.string().default('change-me'),
  postgresSslMode: z.string().default('prefer')
});

export type AppConfig = z.infer<typeof settingsSchema>;

export function getConfig(): AppConfig {
  return settingsSchema.parse({
    host: process.env.API_HOST ?? process.env.HOST,
    port: process.env.API_PORT ?? process.env.MATRIX_APP_PORT,
    nodeEnv: process.env.NODE_ENV,
    matrixEnv: process.env.MATRIX_ENV,
    authUsername: process.env.MATRIX_AUTH_USERNAME,
    authPassword: process.env.MATRIX_AUTH_PASSWORD,
    authSecret: process.env.MATRIX_AUTH_SECRET,
    baseUrl: process.env.MATRIX_BASE_URL,
    uiDevUrl: process.env.MATRIX_UI_DEV_URL ?? 'http://127.0.0.1:4173',
    uiUseDevServer: process.env.MATRIX_UI_USE_DEV_SERVER != null
      ? ['1', 'true', 'yes', 'on'].includes(String(process.env.MATRIX_UI_USE_DEV_SERVER).toLowerCase())
      : String(process.env.MATRIX_ENV ?? 'development').toLowerCase() !== 'production',
    githubRepoUrl: process.env.MATRIX_GITHUB_REPO_URL,
    logoHref: process.env.MATRIX_LOGO_HREF,
    installMode: process.env.MATRIX_INSTALL_MODE,
    activeDbType: process.env.MATRIX_ACTIVE_DB_TYPE,
    tsDataDbPath: process.env.MATRIX_TS_DATA_DB_PATH,
    tsControlDbPath: process.env.MATRIX_TS_CONTROL_DB_PATH,
    postgresHost: process.env.POSTGRES_HOST,
    postgresPort: process.env.POSTGRES_PORT,
    postgresDb: process.env.POSTGRES_DB,
    postgresUser: process.env.POSTGRES_USER,
    postgresPassword: process.env.POSTGRES_PASSWORD,
    postgresSslMode: process.env.POSTGRES_SSLMODE
  });
}
