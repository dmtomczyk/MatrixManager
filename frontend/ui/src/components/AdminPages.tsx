import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import type { AuthenticatedPageProps } from '../lib/utils';

type User = { id: number; username: string; employee_id: number | null; employee_name?: string | null; is_admin: boolean; created_at: string; updated_at: string; };
type EmployeeOption = { id: number; name: string };
type Account = { username: string; display_name: string | null; profile_picture_url: string | null; employee_id: number | null; employee_name?: string | null; is_admin: boolean; is_env_account: boolean; };
type InboxItem = { id: number; kind: string; title: string; body: string; href: string; created_at: string; is_read: boolean; };
type AuditEntry = { id: number; at: string; actor: string; action: string; entity_type: string; entity_id: string; summary: string; before_json: string | null; after_json: string | null; };
type DbConnection = { id: number; name: string; db_type: 'sqlite' | 'postgresql'; connection_string: string; is_active: boolean; notes: string | null; };
type RuntimeOverview = { overview: { overall_status: string; runtime_environment: string; active_data_db_status: string; control_db_status: string; docker_available: boolean; docker_error: string | null; recent_error_count: number; recommended_actions: string[]; services: Array<{ name: string; status: string; detail: string }>; installed_versions: Array<{ name: string; value: string }>; db_connections: Array<{ name: string; db_type: string; status: string; detail: string }>; }; snapshots: Array<{ id: number; at: string; key: string; status: string; value: string; detail: string }>; recentAudit: AuditEntry[]; };

type PageProps = AuthenticatedPageProps;

function useJson<T>(url: string) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({ detail: 'Failed to load data' }));
        throw new Error(payload.detail || 'Failed to load data');
      }
      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [url]);
  React.useEffect(() => { void load(); }, [load]);
  return { data, loading, error, reload: load, setError };
}

async function sendJson(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(payload.detail || 'Request failed');
  }
  return response.status === 204 ? null : response.json().catch(() => null);
}

function fmt(value?: number | null) { return value == null ? '—' : Number(value).toFixed(2); }

function PageFrame({ title, description, flash, stats, children }: { title: string; description: string; flash?: string; stats: Array<{ label: string; value: string | number }>; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-[min(100%,calc(100vw-2rem))] flex-col gap-6 px-4 py-8">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="max-w-4xl text-base leading-7 text-slate-600">{description}</p>
        {flash ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{flash}</div> : null}
      </div>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{stat.label}</CardDescription>
              <CardTitle className="text-3xl text-slate-950">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>
      {children}
    </main>
  );
}

function TwoPanel({ form, table }: { form: React.ReactNode; table: React.ReactNode }) { return <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">{form}{table}</div>; }
function LoadingState() { return <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-[min(100%,calc(100vw-2rem))] items-center justify-center px-4 py-10 text-slate-500">Loading…</main>; }
function ErrorState({ message }: { message: string }) { return <main className="mx-auto w-full max-w-[min(100%,calc(100vw-2rem))] px-4 py-10"><div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{message}</div></main>; }

export function AccountSettingsPage({ flash = '' }: PageProps) {
  const { data, loading, error, reload, setError } = useJson<Account>('/account-settings.json');
  const [form, setForm] = React.useState({ display_name: '', profile_picture_url: '', password: '' });
  React.useEffect(() => { if (data) setForm({ display_name: data.display_name || '', profile_picture_url: data.profile_picture_url || '', password: '' }); }, [data]);
  if (loading) return <LoadingState />; if (error || !data) return <ErrorState message={error || 'Account unavailable'} />;
  return <PageFrame title="Account Settings" description="Update the current signed-in profile and any TypeScript-managed password." flash={flash} stats={[{ label: 'Username', value: data.username }, { label: 'Role', value: data.is_admin ? 'Admin' : 'User' }, { label: 'Linked employee', value: data.employee_name || 'None' }, { label: 'Account source', value: data.is_env_account ? 'Env login' : 'TS account' }]}><TwoPanel form={<Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>Profile</CardTitle></CardHeader><CardContent><form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); try { await sendJson('/account-settings.json', 'PUT', form); await reload(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } }}><div className="grid gap-2"><Label>Username</Label><Input value={data.username} disabled /></div><div className="grid gap-2"><Label>Display name</Label><Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div><div className="grid gap-2"><Label>Profile picture URL</Label><Input value={form.profile_picture_url} onChange={(e) => setForm({ ...form, profile_picture_url: e.target.value })} /></div><div className="grid gap-2"><Label>New password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} disabled={data.is_env_account} /></div><Button type="submit">Save settings</Button></form></CardContent></Card>} table={<Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>Current account</CardTitle></CardHeader><CardContent><div className="grid gap-4 text-sm"><div><div className="text-slate-500">Linked employee</div><div className="font-medium text-slate-900">{data.employee_name || 'No linked employee'}</div></div><div><div className="text-slate-500">Role</div><div className="font-medium text-slate-900">{data.is_admin ? 'Admin' : 'Standard user'}</div></div><div><div className="text-slate-500">Account source</div><div className="font-medium text-slate-900">{data.is_env_account ? 'Bootstrap env login' : 'TypeScript user account'}</div></div>{data.profile_picture_url ? <img src={data.profile_picture_url} alt="Avatar preview" className="max-w-52 rounded-xl border border-slate-200" /> : null}</div></CardContent></Card>} /></PageFrame>;
}

export function InboxPage({ flash = '' }: PageProps) {
  const { data, loading, error, reload, setError } = useJson<InboxItem[]>('/inbox.json');
  if (loading) return <LoadingState />; if (error || !data) return <ErrorState message={error || 'Inbox unavailable'} />;
  const stats = [{ label: 'Items', value: data.length }, { label: 'Unread', value: data.filter((item) => !item.is_read).length }, { label: 'Read', value: data.filter((item) => item.is_read).length }, { label: 'Kinds', value: new Set(data.map((item) => item.kind)).size }];
  return <PageFrame title="Inbox" description="Actionable staffing signals from utilization, forecast gaps, and recent audit activity." flash={flash} stats={stats}><div className="grid gap-4">{data.length ? data.map((item) => <Card key={item.id} className="border-slate-200 shadow-sm"><CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0"><div><CardDescription>{item.kind} · {item.created_at}</CardDescription><CardTitle className="mt-2 text-2xl">{item.title}</CardTitle></div><Badge variant={item.is_read ? 'secondary' : 'default'}>{item.is_read ? 'Read' : 'Unread'}</Badge></CardHeader><CardContent className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><p className="max-w-3xl text-sm leading-7 text-slate-600">{item.body}</p><div className="flex min-w-44 flex-col gap-2"><Button asChild><a href={item.href}>Open</a></Button><Button variant="outline" onClick={async () => { try { await sendJson(`/inbox/${item.id}.json/read`, 'POST'); await reload(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } }}>{item.is_read ? 'Mark seen' : 'Mark read'}</Button><Button variant="outline" onClick={async () => { try { await sendJson(`/inbox/${item.id}.json`, 'DELETE'); await reload(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } }}>Dismiss</Button></div></CardContent></Card>) : <Card className="border-slate-200 shadow-sm"><CardContent className="p-6 text-slate-500">No inbox items right now.</CardContent></Card>}</div></PageFrame>;
}

export function UsersPage({ flash = '' }: PageProps) {
  const { data, loading, error, reload, setError } = useJson<{ users: User[]; employees: EmployeeOption[] }>('/users.json');
  const [form, setForm] = React.useState({ username: '', password: '', employee_id: '', is_admin: false });
  if (loading) return <LoadingState />; if (error || !data) return <ErrorState message={error || 'Users unavailable'} />;
  const stats = [{ label: 'Users', value: data.users.length }, { label: 'Admins', value: data.users.filter((user) => user.is_admin).length }, { label: 'Linked employees', value: data.users.filter((user) => user.employee_id != null).length }, { label: 'Unlinked', value: data.users.filter((user) => user.employee_id == null).length }];
  return <PageFrame title="Users" description="Manage TypeScript-side Matrix Manager accounts and their employee links." flash={flash} stats={stats}><TwoPanel form={<Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>Create user</CardTitle></CardHeader><CardContent><form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); try { await sendJson('/users.json', 'POST', { username: form.username, password: form.password, employee_id: form.employee_id ? Number(form.employee_id) : null, is_admin: form.is_admin }); setForm({ username: '', password: '', employee_id: '', is_admin: false }); await reload(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } }}><div className="grid gap-2"><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></div><div className="grid gap-2"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div><div className="grid gap-2"><Label>Linked employee</Label><select className="rounded-md border border-slate-200 px-3 py-2" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}><option value="">No linked employee</option>{data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_admin} onChange={(e) => setForm({ ...form, is_admin: e.target.checked })} /> Admin</label><Button type="submit">Create user</Button></form></CardContent></Card>} table={<Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>Current users</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-2 py-3">User</th><th className="px-2 py-3">Employee</th><th className="px-2 py-3">Role</th><th className="px-2 py-3">Actions</th></tr></thead><tbody>{data.users.map((user) => <UserRow key={user.id} user={user} employees={data.employees} onReload={reload} onError={setError} />)}</tbody></table></div></CardContent></Card>} /></PageFrame>;
}

function UserRow({ user, employees, onReload, onError }: { user: User; employees: EmployeeOption[]; onReload: () => Promise<void>; onError: (value: string) => void }) {
  const [form, setForm] = React.useState({ password: '', employee_id: String(user.employee_id ?? ''), is_admin: user.is_admin });
  return <tr className="border-b border-slate-100 align-top"><td className="px-2 py-3"><strong>{user.username}</strong><div className="text-xs text-slate-500">Updated {user.updated_at}</div></td><td className="px-2 py-3">{user.employee_name || '—'}</td><td className="px-2 py-3"><Badge variant={user.is_admin ? 'default' : 'secondary'}>{user.is_admin ? 'Admin' : 'User'}</Badge></td><td className="px-2 py-3"><div className="grid gap-2"><select className="rounded-md border border-slate-200 px-3 py-2" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}><option value="">No linked employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select><Input type="password" placeholder="Leave blank to keep current" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_admin} onChange={(e) => setForm({ ...form, is_admin: e.target.checked })} /> Admin</label><div className="flex gap-2"><Button size="sm" onClick={async () => { try { await sendJson(`/users/${user.id}.json`, 'PUT', { password: form.password || null, employee_id: form.employee_id ? Number(form.employee_id) : null, is_admin: form.is_admin }); await onReload(); } catch (err) { onError(err instanceof Error ? err.message : 'Failed'); } }}>Save</Button><Button size="sm" variant="outline" onClick={async () => { try { await sendJson(`/users/${user.id}.json`, 'DELETE'); await onReload(); } catch (err) { onError(err instanceof Error ? err.message : 'Failed'); } }}>Delete</Button></div></div></td></tr>;
}

export function AuditPage({ flash = '' }: PageProps) {
  const { data, loading, error, reload, setError } = useJson<AuditEntry[]>('/audit.json');
  const [filters, setFilters] = React.useState({ entity_type: '', action: '', actor: '', query: '' });
  if (loading) return <LoadingState />; if (error || !data) return <ErrorState message={error || 'Audit unavailable'} />;
  const filtered = data.filter((entry) => (!filters.entity_type || entry.entity_type.includes(filters.entity_type)) && (!filters.action || entry.action.includes(filters.action)) && (!filters.actor || entry.actor.toLowerCase().includes(filters.actor.toLowerCase())) && (!filters.query || JSON.stringify(entry).toLowerCase().includes(filters.query.toLowerCase())));
  const stats = [{ label: 'Entries', value: data.length }, { label: 'Actors', value: new Set(data.map((entry) => entry.actor)).size }, { label: 'Actions', value: new Set(data.map((entry) => entry.action)).size }, { label: 'Entities', value: new Set(data.map((entry) => entry.entity_type)).size }];
  return <PageFrame title="Audit" description="Review TypeScript-side audit history for migrated page actions." flash={flash} stats={stats}><TwoPanel form={<Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>Filter</CardTitle></CardHeader><CardContent><div className="grid gap-4"><div className="grid gap-2"><Label>Entity type</Label><Input value={filters.entity_type} onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })} /></div><div className="grid gap-2"><Label>Action</Label><Input value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} /></div><div className="grid gap-2"><Label>Actor</Label><Input value={filters.actor} onChange={(e) => setFilters({ ...filters, actor: e.target.value })} /></div><div className="grid gap-2"><Label>Query</Label><Input value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} /></div><Button variant="outline" onClick={async () => { try { await sendJson('/audit.json/clear', 'POST'); await reload(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } }}>Clear audit history</Button></div></CardContent></Card>} table={<Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>Entries</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-2 py-3">At</th><th className="px-2 py-3">Actor</th><th className="px-2 py-3">Action</th><th className="px-2 py-3">Entity</th><th className="px-2 py-3">Summary</th></tr></thead><tbody>{filtered.map((entry) => <tr key={entry.id} className="border-b border-slate-100 align-top"><td className="px-2 py-3">{entry.at}</td><td className="px-2 py-3">{entry.actor}</td><td className="px-2 py-3">{entry.action}</td><td className="px-2 py-3">{entry.entity_type} {entry.entity_id}</td><td className="px-2 py-3"><div className="font-medium text-slate-900">{entry.summary}</div><div className="mt-1 text-xs text-slate-500">{entry.before_json || entry.after_json ? 'Includes before/after payloads' : '—'}</div></td></tr>)}</tbody></table></div></CardContent></Card>} /></PageFrame>;
}

export function RuntimePage({ flash = '' }: PageProps) {
  const { data, loading, error } = useJson<RuntimeOverview>('/runtime.json');
  if (loading) return <LoadingState />; if (error || !data) return <ErrorState message={error || 'Runtime unavailable'} />;
  const stats = [{ label: 'Overall', value: data.overview.overall_status }, { label: 'Data DB', value: data.overview.active_data_db_status }, { label: 'Control DB', value: data.overview.control_db_status }, { label: 'Recent errors', value: data.overview.recent_error_count }];
  return <PageFrame title="Runtime" description="Operational summary for the TypeScript runtime, stores, configured DB profiles, and recent health signals." flash={flash} stats={stats}><div className="grid gap-6 xl:grid-cols-2"><Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>Recommendations</CardTitle></CardHeader><CardContent>{data.overview.recommended_actions.length ? <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">{data.overview.recommended_actions.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="text-sm text-slate-500">No immediate recommendations.</p>}</CardContent></Card><Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>Installed versions</CardTitle></CardHeader><CardContent><div className="grid gap-3 text-sm">{data.overview.installed_versions.map((row) => <div key={row.name} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"><span className="text-slate-500">{row.name}</span><span className="font-medium text-slate-900">{row.value}</span></div>)}</div></CardContent></Card><Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>Services</CardTitle></CardHeader><CardContent><div className="grid gap-3 text-sm">{data.overview.services.map((service) => <div key={service.name} className="rounded-lg border border-slate-200 px-3 py-3"><div className="flex items-center justify-between gap-3"><strong>{service.name}</strong><Badge variant={service.status === 'ok' ? 'default' : 'secondary'}>{service.status}</Badge></div><p className="mt-2 text-slate-600">{service.detail}</p></div>)}</div></CardContent></Card><Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>DB connections</CardTitle></CardHeader><CardContent><div className="grid gap-3 text-sm">{data.overview.db_connections.length ? data.overview.db_connections.map((row) => <div key={row.name} className="rounded-lg border border-slate-200 px-3 py-3"><div className="flex items-center justify-between gap-3"><strong>{row.name}</strong><Badge variant="secondary">{row.db_type}</Badge></div><div className="mt-2 text-slate-600">{row.status} · {row.detail}</div></div>) : <p className="text-slate-500">No DB connections configured.</p>}</div></CardContent></Card></div></PageFrame>;
}

export function DbManagementPage({ flash = '' }: PageProps) {
  const { data, loading, error, reload, setError } = useJson<DbConnection[]>('/db-management.json');
  const [form, setForm] = React.useState({ name: '', db_type: 'sqlite', connection_string: '', is_active: false, notes: '' });
  if (loading) return <LoadingState />; if (error || !data) return <ErrorState message={error || 'DB management unavailable'} />;
  const stats = [{ label: 'Connections', value: data.length }, { label: 'Active', value: data.filter((connection) => connection.is_active).length }, { label: 'SQLite', value: data.filter((connection) => connection.db_type === 'sqlite').length }, { label: 'PostgreSQL', value: data.filter((connection) => connection.db_type === 'postgresql').length }];
  return <PageFrame title="DB Management" description="Manage TypeScript-side connection profiles and inspect the active target." flash={flash} stats={stats}><TwoPanel form={<div className="grid gap-6"><Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>Create connection</CardTitle></CardHeader><CardContent><form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); try { await sendJson('/db-management.json', 'POST', form); setForm({ name: '', db_type: 'sqlite', connection_string: '', is_active: false, notes: '' }); await reload(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } }}><div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>DB type</Label><select className="rounded-md border border-slate-200 px-3 py-2" value={form.db_type} onChange={(e) => setForm({ ...form, db_type: e.target.value as 'sqlite' | 'postgresql' })}><option value="sqlite">sqlite</option><option value="postgresql">postgresql</option></select></div><label className="mt-8 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label></div><div className="grid gap-2"><Label>Connection string</Label><Input value={form.connection_string} onChange={(e) => setForm({ ...form, connection_string: e.target.value })} required /></div><div className="grid gap-2"><Label>Notes</Label><textarea className="min-h-24 rounded-md border border-slate-200 px-3 py-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div><Button type="submit">Save connection</Button></form></CardContent></Card><Card className="border-rose-200 shadow-sm"><CardHeader><CardTitle>Danger zone</CardTitle></CardHeader><CardContent><div className="grid gap-4"><p className="text-sm text-slate-600">Wipe the TypeScript data store used by the migrated app surfaces.</p><Button variant="outline" onClick={async () => { const confirmation = window.prompt('Type WIPE DATA DB to confirm'); if (confirmation !== 'WIPE DATA DB') return; try { await sendJson('/db-management.json/wipe', 'POST', { confirmation_text: confirmation }); await reload(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } }}>Wipe data store</Button></div></CardContent></Card></div>} table={<Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>Saved connections</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-2 py-3">Name</th><th className="px-2 py-3">Type</th><th className="px-2 py-3">Status</th><th className="px-2 py-3">Connection</th><th className="px-2 py-3">Actions</th></tr></thead><tbody>{data.map((connection) => <DbConnectionRow key={connection.id} connection={connection} onReload={reload} onError={setError} />)}</tbody></table></div></CardContent></Card>} /></PageFrame>;
}

function DbConnectionRow({ connection, onReload, onError }: { connection: DbConnection; onReload: () => Promise<void>; onError: (value: string) => void }) {
  const [form, setForm] = React.useState({ name: connection.name, db_type: connection.db_type, connection_string: connection.connection_string, is_active: connection.is_active, notes: connection.notes || '' });
  return <tr className="border-b border-slate-100 align-top"><td className="px-2 py-3"><strong>{connection.name}</strong></td><td className="px-2 py-3">{connection.db_type}</td><td className="px-2 py-3"><Badge variant={connection.is_active ? 'default' : 'secondary'}>{connection.is_active ? 'Active' : 'Saved'}</Badge></td><td className="px-2 py-3"><code className="text-xs">{connection.connection_string}</code></td><td className="px-2 py-3"><div className="grid gap-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><select className="rounded-md border border-slate-200 px-3 py-2" value={form.db_type} onChange={(e) => setForm({ ...form, db_type: e.target.value as 'sqlite' | 'postgresql' })}><option value="sqlite">sqlite</option><option value="postgresql">postgresql</option></select><Input value={form.connection_string} onChange={(e) => setForm({ ...form, connection_string: e.target.value })} /><textarea className="min-h-20 rounded-md border border-slate-200 px-3 py-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label><div className="flex gap-2"><Button size="sm" onClick={async () => { try { await sendJson(`/db-management/${connection.id}.json`, 'PUT', form); await onReload(); } catch (err) { onError(err instanceof Error ? err.message : 'Failed'); } }}>Save</Button><Button size="sm" variant="outline" onClick={async () => { try { await sendJson(`/db-management/${connection.id}.json`, 'DELETE'); await onReload(); } catch (err) { onError(err instanceof Error ? err.message : 'Failed'); } }}>Delete</Button></div></div></td></tr>;
}
