import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import { Select } from './ui/select';
import { Checkbox } from './ui/checkbox';
import type { AuthenticatedPageProps } from '../lib/utils';

type Org = { id: number; name: string; description?: string | null; parent_organization_id?: number | null; parent_organization_name?: string | null; child_organization_count?: number; employee_count?: number };
type JobCode = { id: number; name: string; is_leader: boolean; assigned_employee_count?: number };
type Employee = { id: number; name: string; job_code_id?: number | null; job_code_name?: string | null; employee_type?: string | null; organization_id?: number | null; organization_name?: string | null; manager_id?: number | null; manager_name?: string | null; role?: string | null; location?: string | null; capacity?: number | null; active_assignment_count?: number; active_allocation_percent?: number; load_status?: string };
type Project = { id: number; name: string; description?: string | null; start_date?: string | null; end_date?: string | null; assignment_count?: number; demand_count?: number; assigned_allocation?: number; demanded_allocation?: number };
type Demand = { id: number; project_id: number; project_name?: string | null; title: string; organization_id?: number | null; organization_name?: string | null; job_code_id?: number | null; job_code_name?: string | null; skill_notes?: string | null; start_date: string; end_date: string; required_allocation: number; fulfilled_allocation?: number; remaining_allocation?: number; notes?: string | null };
type Assignment = { id: number; employee_id: number; employee_name?: string | null; project_id: number; project_name?: string | null; demand_id?: number | null; demand_title?: string | null; organization_name?: string | null; start_date: string; end_date: string; allocation: number; notes?: string | null };

type WorkspaceData = { organizations: Org[]; jobCodes: JobCode[]; employees: Employee[]; projects: Project[]; demands: Demand[]; assignments: Assignment[] };
type PageProps = AuthenticatedPageProps;
const emptyData: WorkspaceData = { organizations: [], jobCodes: [], employees: [], projects: [], demands: [], assignments: [] };

function pct(value?: number | null) { return value == null ? '—' : `${Math.round(value)}%`; }
function num(value?: number | null) { return value == null ? '—' : Number(value).toFixed(2); }
function shortDateRange(start?: string | null, end?: string | null) { return `${start || '—'} → ${end || '—'}`; }

function useWorkspaceData() {
  const [data, setData] = React.useState<WorkspaceData>(emptyData);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [organizations, jobCodes, employees, projects, demands, assignments] = await Promise.all([
        fetch('/organizations').then((r) => r.json()),
        fetch('/job-codes-api').then((r) => r.json()),
        fetch('/employees').then((r) => r.json()),
        fetch('/projects').then((r) => r.json()),
        fetch('/demands-api').then((r) => r.json()),
        fetch('/assignments').then((r) => r.json()),
      ]);
      setData({ organizations, jobCodes, employees, projects, demands, assignments });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace data');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);
  return { data, loading, error, reload: load, setError };
}

async function sendJson(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
  const response = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(payload.detail || 'Request failed');
  }
  return response.status === 204 ? null : response.json().catch(() => null);
}

function PageFrame({ title, description, flash, stats, children }: { title: string; description: string; flash?: string; stats: Array<{ label: string; value: string | number }>; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-[min(100%,calc(100vw-2rem))] flex-col gap-5 px-4 py-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="max-w-5xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{description}</p>
        {flash ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{flash}</div> : null}
      </div>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-slate-200 shadow-sm">
            <CardHeader className="space-y-1 pb-2">
              <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{stat.label}</CardDescription>
              <CardTitle className="text-2xl text-slate-950">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>
      {children}
    </main>
  );
}

function TwoPanel({ form, table }: { form: React.ReactNode; table: React.ReactNode }) {
  return <div className="grid gap-5 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">{form}{table}</div>;
}

function LoadingState() { return <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-[min(100%,calc(100vw-2rem))] items-center justify-center px-4 py-10 text-slate-500">Loading…</main>; }
function ErrorState({ message }: { message: string }) { return <main className="mx-auto w-full max-w-[min(100%,calc(100vw-2rem))] px-4 py-10"><div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{message}</div></main>; }

function FormCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <Card className="border-slate-200 shadow-sm"><CardHeader className="pb-4"><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card>;
}

function DataCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <Card className="border-slate-200 shadow-sm"><CardHeader className="pb-3"><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card>;
}

function CompactTable({ headers, children, minWidth = '980px' }: { headers: Array<{ label: string; className?: string }>; children: React.ReactNode; minWidth?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full table-fixed text-sm" style={{ minWidth }}>
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
            {headers.map((header) => <th key={header.label} className={`px-3 py-2.5 font-semibold ${header.className ?? ''}`.trim()}>{header.label}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function CellMain({ title, subtitle, indentLevel = 0 }: { title: React.ReactNode; subtitle?: React.ReactNode; indentLevel?: number }) {
  return <div className="min-w-0" style={{ paddingLeft: indentLevel ? `${indentLevel * 18}px` : undefined }}><div className="truncate font-medium text-slate-950">{title}</div>{subtitle ? <div className="truncate text-xs text-slate-500">{subtitle}</div> : null}</div>;
}

function orderOrganizationsTree(items: Org[]) {
  const byParent = new Map<number | null, Org[]>();
  for (const item of items) {
    const key = item.parent_organization_id ?? null;
    const group = byParent.get(key) ?? [];
    group.push(item);
    byParent.set(key, group);
  }
  for (const group of byParent.values()) {
    group.sort((a, b) => a.name.localeCompare(b.name));
  }
  const ordered: Array<{ org: Org; depth: number }> = [];
  const visit = (parentId: number | null, depth: number) => {
    for (const org of byParent.get(parentId) ?? []) {
      ordered.push({ org, depth });
      visit(org.id, depth + 1);
    }
  };
  visit(null, 0);
  return ordered;
}

function EditorShell({ open, onToggle, onDelete, children }: { open: boolean; onToggle: () => void; onDelete: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={open ? 'secondary' : 'outline'} onClick={onToggle}>{open ? 'Close' : 'Edit'}</Button>
        <Button size="sm" variant="outline" onClick={onDelete}>Delete</Button>
      </div>
      {open ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">{children}</div> : null}
    </div>
  );
}

function SelectField({ label, value, onChange, options, required = true }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; required?: boolean }) {
  return <div className="grid gap-2"><Label>{label}</Label><Select value={value} onChange={(e) => onChange(e.target.value)} required={required}>{options.map((option) => <option key={`${label}-${option.value}`} value={option.value}>{option.label}</option>)}</Select></div>;
}

export function OrganizationsPage({ flash = '' }: PageProps) {
  const { data, loading, error, reload, setError } = useWorkspaceData();
  const [form, setForm] = React.useState({ name: '', description: '' });
  if (loading) return <LoadingState />; if (error) return <ErrorState message={error} />;
  const stats = [{ label: 'Organizations', value: data.organizations.length }, { label: 'Child org links', value: data.organizations.reduce((sum, org) => sum + (org.child_organization_count ?? 0), 0) }, { label: 'People mapped', value: data.organizations.reduce((sum, org) => sum + (org.employee_count ?? 0), 0) }, { label: 'Avg people / org', value: data.organizations.length ? num(data.organizations.reduce((sum, org) => sum + (org.employee_count ?? 0), 0) / data.organizations.length) : '—' }];
  const nestedOrganizations = React.useMemo(() => orderOrganizationsTree(data.organizations), [data.organizations]);
  return <PageFrame title="Organizations" description="Optimized for dense scanning: nested parent/child structure, compact metadata, and expand-to-edit when you need it." flash={flash} stats={stats}><TwoPanel form={<FormCard title="Create organization" description="Add new structural homes without burning table space."><form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); try { await sendJson('/organizations', 'POST', form); setForm({ name: '', description: '' }); await reload(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } }}><div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div><div className="grid gap-2"><Label>Description</Label><Textarea className="min-h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div><Button type="submit">Create organization</Button></form></FormCard>} table={<DataCard title="Organizations" description="Child teams render nested beneath their parents so the hierarchy is visible at a glance."><CompactTable minWidth="900px" headers={[{ label: 'Organization', className: 'w-[32%]' }, { label: 'Description', className: 'w-[30%]' }, { label: 'Children', className: 'w-[8%]' }, { label: 'People', className: 'w-[8%]' }, { label: 'Actions', className: 'w-[22%]' }]}>{nestedOrganizations.map(({ org, depth }) => <OrganizationRow key={org.id} org={org} depth={depth} onReload={reload} onError={setError} />)}</CompactTable></DataCard>} /></PageFrame>;
}

function OrganizationRow({ org, depth, onReload, onError }: { org: Org; depth: number; onReload: () => Promise<void>; onError: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: org.name, description: org.description || '' });
  return <tr className="border-b border-slate-100 align-top"><td className="px-3 py-2.5"><CellMain title={depth ? `↳ ${org.name}` : org.name} subtitle={depth ? `${org.parent_organization_name || 'Parent'} · ID ${org.id}` : `ID ${org.id}`} indentLevel={depth} /></td><td className="px-3 py-2.5 text-sm text-slate-600">{org.description || '—'}</td><td className="px-3 py-2.5 text-sm text-slate-700">{org.child_organization_count ?? 0}</td><td className="px-3 py-2.5 text-sm text-slate-700">{org.employee_count ?? 0}</td><td className="px-3 py-2.5"><EditorShell open={open} onToggle={() => setOpen((v) => !v)} onDelete={async () => { try { await sendJson(`/organizations/${org.id}`, 'DELETE'); await onReload(); } catch (err) { onError(err instanceof Error ? err.message : 'Failed'); } }}><div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(220px,1fr)_auto] xl:items-end"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Textarea className="min-h-20" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><Button size="sm" onClick={async () => { try { await sendJson(`/organizations/${org.id}`, 'PUT', form); await onReload(); setOpen(false); } catch (err) { onError(err instanceof Error ? err.message : 'Failed'); } }}>Save</Button></div></EditorShell></td></tr>;
}

export function JobCodesPage({ flash = '' }: PageProps) {
  const { data, loading, error, reload, setError } = useWorkspaceData();
  const [form, setForm] = React.useState({ name: '', is_leader: false });
  if (loading) return <LoadingState />; if (error) return <ErrorState message={error} />;
  const stats = [{ label: 'Job codes', value: data.jobCodes.length }, { label: 'Leader roles', value: data.jobCodes.filter((code) => code.is_leader).length }, { label: 'IC roles', value: data.jobCodes.filter((code) => !code.is_leader).length }, { label: 'Assigned people', value: data.jobCodes.reduce((sum, code) => sum + (code.assigned_employee_count ?? 0), 0) }];
  return <PageFrame title="Job Codes" description="Compact role rows with leadership status and assignment count visible at a glance." flash={flash} stats={stats}><TwoPanel form={<FormCard title="Create job code" description="Keep the definition panel separate so the table stays dense."><form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); try { await sendJson('/job-codes-api', 'POST', form); setForm({ name: '', is_leader: false }); await reload(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } }}><div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div><label className="flex items-center gap-2 text-sm"><Checkbox checked={form.is_leader} onChange={(e) => setForm({ ...form, is_leader: e.target.checked })} /> Leader role</label><Button type="submit">Create job code</Button></form></FormCard>} table={<DataCard title="Job codes" description="Scan-first rows with edit-on-demand controls."><CompactTable minWidth="760px" headers={[{ label: 'Role', className: 'w-[42%]' }, { label: 'Type', className: 'w-[14%]' }, { label: 'Assigned', className: 'w-[12%]' }, { label: 'Actions', className: 'w-[32%]' }]}>{data.jobCodes.map((jobCode) => <JobCodeRow key={jobCode.id} jobCode={jobCode} onReload={reload} onError={setError} />)}</CompactTable></DataCard>} /></PageFrame>;
}

function JobCodeRow({ jobCode, onReload, onError }: { jobCode: JobCode; onReload: () => Promise<void>; onError: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: jobCode.name, is_leader: jobCode.is_leader });
  return <tr className="border-b border-slate-100 align-top"><td className="px-3 py-2.5"><CellMain title={jobCode.name} subtitle={`ID ${jobCode.id}`} /></td><td className="px-3 py-2.5"><Badge variant={jobCode.is_leader ? 'default' : 'secondary'}>{jobCode.is_leader ? 'Leader' : 'IC'}</Badge></td><td className="px-3 py-2.5 text-sm text-slate-700">{jobCode.assigned_employee_count ?? 0}</td><td className="px-3 py-2.5"><EditorShell open={open} onToggle={() => setOpen((v) => !v)} onDelete={async () => { try { await sendJson(`/job-codes-api/${jobCode.id}`, 'DELETE'); await onReload(); } catch (err) { onError(err instanceof Error ? err.message : 'Failed'); } }}><div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><label className="flex items-center gap-2 text-sm"><Checkbox checked={form.is_leader} onChange={(e) => setForm({ ...form, is_leader: e.target.checked })} /> Leader</label><Button size="sm" onClick={async () => { try { await sendJson(`/job-codes-api/${jobCode.id}`, 'PUT', form); await onReload(); setOpen(false); } catch (err) { onError(err instanceof Error ? err.message : 'Failed'); } }}>Save</Button></div></EditorShell></td></tr>;
}

export function EmployeesPage({ flash = '' }: PageProps) {
  const { data, loading, error, reload, setError } = useWorkspaceData();
  const [form, setForm] = React.useState({ name: '', job_code_id: '', organization_id: '', manager_id: '', role: '', location: '', capacity: '1' });
  if (loading) return <LoadingState />; if (error) return <ErrorState message={error} />;
  const stats = [{ label: 'Headcount', value: data.employees.length }, { label: 'Leaders', value: data.employees.filter((e) => e.employee_type === 'L').length }, { label: 'Active assignments', value: data.employees.reduce((sum, e) => sum + (e.active_assignment_count ?? 0), 0) }, { label: 'Avg allocation', value: data.employees.length ? pct(data.employees.reduce((sum, e) => sum + (e.active_allocation_percent ?? 0), 0) / data.employees.length) : '—' }];
  return <PageFrame title="Employees" description="Designed for larger workforces: dense row summaries, visible utilization, and expandable editors only when needed." flash={flash} stats={stats}><TwoPanel form={<FormCard title="Create employee" description="The table stays compact while the create form remains full-featured."><form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); try { await sendJson('/employees', 'POST', { ...form, job_code_id: Number(form.job_code_id), organization_id: Number(form.organization_id), manager_id: form.manager_id ? Number(form.manager_id) : null, capacity: Number(form.capacity) }); setForm({ name: '', job_code_id: '', organization_id: '', manager_id: '', role: '', location: '', capacity: '1' }); await reload(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } }}><div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div><SelectField label="Job code" value={form.job_code_id} onChange={(value) => setForm({ ...form, job_code_id: value })} options={data.jobCodes.map((code) => ({ value: String(code.id), label: code.name }))} /><SelectField label="Organization" value={form.organization_id} onChange={(value) => setForm({ ...form, organization_id: value })} options={data.organizations.map((org) => ({ value: String(org.id), label: org.name }))} /><SelectField label="Manager" value={form.manager_id} onChange={(value) => setForm({ ...form, manager_id: value })} options={[{ value: '', label: 'No manager' }, ...data.employees.filter((employee) => employee.employee_type === 'L').map((employee) => ({ value: String(employee.id), label: employee.name }))]} required={false} /><div className="grid gap-2"><Label>Role label</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div><div className="grid gap-2"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div><div className="grid gap-2"><Label>Capacity</Label><Input type="number" min="0.1" step="0.1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div><Button type="submit">Create employee</Button></form></FormCard>} table={<DataCard title="Employees" description="Scan name, org, utilization, and status quickly; expand only the row you need."><CompactTable minWidth="1120px" headers={[{ label: 'Employee', className: 'w-[20%]' }, { label: 'Role / Type', className: 'w-[18%]' }, { label: 'Organization', className: 'w-[16%]' }, { label: 'Manager', className: 'w-[16%]' }, { label: 'Allocation', className: 'w-[8%]' }, { label: 'Status', className: 'w-[8%]' }, { label: 'Actions', className: 'w-[14%]' }]}>{data.employees.map((employee) => <EmployeeRow key={employee.id} employee={employee} data={data} onReload={reload} onError={setError} />)}</CompactTable></DataCard>} /></PageFrame>;
}

function EmployeeRow({ employee, data, onReload, onError }: { employee: Employee; data: WorkspaceData; onReload: () => Promise<void>; onError: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: employee.name, job_code_id: String(employee.job_code_id ?? ''), organization_id: String(employee.organization_id ?? ''), manager_id: String(employee.manager_id ?? ''), role: employee.role || '', location: employee.location || '', capacity: String(employee.capacity ?? 1) });
  return <tr className="border-b border-slate-100 align-top"><td className="px-3 py-2.5"><CellMain title={employee.name} subtitle={`ID ${employee.id}`} /></td><td className="px-3 py-2.5 text-sm text-slate-600"><div>{employee.job_code_name || '—'}</div><div className="text-xs text-slate-500">{employee.role || employee.employee_type || '—'}</div></td><td className="px-3 py-2.5 text-sm text-slate-700">{employee.organization_name || '—'}</td><td className="px-3 py-2.5 text-sm text-slate-700">{employee.manager_name || '—'}</td><td className="px-3 py-2.5 text-sm text-slate-700">{pct(employee.active_allocation_percent)}</td><td className="px-3 py-2.5"><Badge variant={employee.load_status === 'active' ? 'default' : 'secondary'}>{employee.load_status || 'available'}</Badge></td><td className="px-3 py-2.5"><EditorShell open={open} onToggle={() => setOpen((v) => !v)} onDelete={async () => { try { await sendJson(`/employees/${employee.id}`, 'DELETE'); await onReload(); } catch (err) { onError(err instanceof Error ? err.message : 'Failed'); } }}><div className="grid gap-3 xl:grid-cols-3"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Select value={form.job_code_id} onChange={(e) => setForm({ ...form, job_code_id: e.target.value })}>{data.jobCodes.map((jobCode) => <option key={jobCode.id} value={jobCode.id}>{jobCode.name}</option>)}</Select><Select value={form.organization_id} onChange={(e) => setForm({ ...form, organization_id: e.target.value })}>{data.organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</Select><Select value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}><option value="">No manager</option>{data.employees.filter((item) => item.employee_type === 'L' && item.id !== employee.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Input placeholder="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /><Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /><div className="xl:col-span-2"><Input type="number" min="0.1" step="0.1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div><div className="xl:col-span-1 xl:justify-self-end"><Button size="sm" onClick={async () => { try { await sendJson(`/employees/${employee.id}`, 'PUT', { ...form, job_code_id: Number(form.job_code_id), organization_id: Number(form.organization_id), manager_id: form.manager_id ? Number(form.manager_id) : null, capacity: Number(form.capacity) }); await onReload(); setOpen(false); } catch (err) { onError(err instanceof Error ? err.message : 'Failed'); } }}>Save</Button></div></div></EditorShell></td></tr>;
}

export function ProjectsPage({ flash = '' }: PageProps) {
  const { data, loading, error, reload, setError } = useWorkspaceData();
  const [form, setForm] = React.useState({ name: '', description: '', start_date: '', end_date: '' });
  if (loading) return <LoadingState />; if (error) return <ErrorState message={error} />;
  const stats = [{ label: 'Projects', value: data.projects.length }, { label: 'Demand rows', value: data.projects.reduce((sum, p) => sum + (p.demand_count ?? 0), 0) }, { label: 'Demand FTE', value: num(data.projects.reduce((sum, p) => sum + (p.demanded_allocation ?? 0), 0)) }, { label: 'Assigned FTE', value: num(data.projects.reduce((sum, p) => sum + (p.assigned_allocation ?? 0), 0)) }];
  return <PageFrame title="Projects" description="Use horizontal space for demand and staffing signals instead of filling each row with permanent editors." flash={flash} stats={stats}><TwoPanel form={<FormCard title="Create project" description="The creation panel stays detailed; the table stays compact."><form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); try { await sendJson('/projects', 'POST', form); setForm({ name: '', description: '', start_date: '', end_date: '' }); await reload(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } }}><div className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div><div className="grid gap-2"><Label>Description</Label><Textarea className="min-h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div><div className="grid gap-2"><Label>End date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div></div><Button type="submit">Create project</Button></form></FormCard>} table={<DataCard title="Projects" description="Quickly compare project load, demand, and staffing gap."><CompactTable minWidth="1180px" headers={[{ label: 'Project', className: 'w-[24%]' }, { label: 'Dates', className: 'w-[15%]' }, { label: 'Demands', className: 'w-[7%]' }, { label: 'Assignments', className: 'w-[8%]' }, { label: 'Demand FTE', className: 'w-[9%]' }, { label: 'Assigned FTE', className: 'w-[9%]' }, { label: 'Gap', className: 'w-[8%]' }, { label: 'Actions', className: 'w-[20%]' }]}>{data.projects.map((project) => <ProjectRow key={project.id} project={project} onReload={reload} onError={setError} />)}</CompactTable></DataCard>} /></PageFrame>;
}

function ProjectRow({ project, onReload, onError }: { project: Project; onReload: () => Promise<void>; onError: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: project.name, description: project.description || '', start_date: project.start_date || '', end_date: project.end_date || '' });
  const gap = (project.demanded_allocation ?? 0) - (project.assigned_allocation ?? 0);
  return <tr className="border-b border-slate-100 align-top"><td className="px-3 py-2.5"><CellMain title={project.name} subtitle={project.description || `ID ${project.id}`} /></td><td className="px-3 py-2.5 text-sm text-slate-700">{shortDateRange(project.start_date, project.end_date)}</td><td className="px-3 py-2.5 text-sm text-slate-700">{project.demand_count ?? 0}</td><td className="px-3 py-2.5 text-sm text-slate-700">{project.assignment_count ?? 0}</td><td className="px-3 py-2.5 text-sm text-slate-700">{num(project.demanded_allocation)}</td><td className="px-3 py-2.5 text-sm text-slate-700">{num(project.assigned_allocation)}</td><td className="px-3 py-2.5 text-sm font-medium text-slate-800">{num(gap)}</td><td className="px-3 py-2.5"><EditorShell open={open} onToggle={() => setOpen((v) => !v)} onDelete={async () => { try { await sendJson(`/projects/${project.id}`, 'DELETE'); await onReload(); } catch (err) { onError(err instanceof Error ? err.message : 'Failed'); } }}><div className="grid gap-3 xl:grid-cols-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /><Textarea className="min-h-20 xl:col-span-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /><div className="xl:justify-self-end"><Button size="sm" onClick={async () => { try { await sendJson(`/projects/${project.id}`, 'PUT', form); await onReload(); setOpen(false); } catch (err) { onError(err instanceof Error ? err.message : 'Failed'); } }}>Save</Button></div></div></EditorShell></td></tr>;
}

export function DemandsPage({ flash = '' }: PageProps) {
  const { data, loading, error, reload, setError } = useWorkspaceData();
  const [form, setForm] = React.useState({ project_id: '', title: '', organization_id: '', job_code_id: '', skill_notes: '', start_date: '', end_date: '', required_allocation: '1', notes: '' });
  if (loading) return <LoadingState />; if (error) return <ErrorState message={error} />;
  const stats = [{ label: 'Demand rows', value: data.demands.length }, { label: 'Need FTE', value: num(data.demands.reduce((sum, d) => sum + (d.required_allocation ?? 0), 0)) }, { label: 'Filled FTE', value: num(data.demands.reduce((sum, d) => sum + (d.fulfilled_allocation ?? 0), 0)) }, { label: 'Gap FTE', value: num(data.demands.reduce((sum, d) => sum + (d.remaining_allocation ?? 0), 0)) }];
  return <PageFrame title="Demands" description="Surface project, role target, dates, and staffing gap in one compact line; expand only when details matter." flash={flash} stats={stats}><TwoPanel form={<FormCard title="Create demand" description="Full demand detail lives in the side panel so the list can stay dense."><form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); try { await sendJson('/demands-api', 'POST', { ...form, project_id: Number(form.project_id), organization_id: form.organization_id ? Number(form.organization_id) : null, job_code_id: form.job_code_id ? Number(form.job_code_id) : null, required_allocation: Number(form.required_allocation) }); setForm({ project_id: '', title: '', organization_id: '', job_code_id: '', skill_notes: '', start_date: '', end_date: '', required_allocation: '1', notes: '' }); await reload(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } }}><SelectField label="Project" value={form.project_id} onChange={(value) => setForm({ ...form, project_id: value })} options={data.projects.map((project) => ({ value: String(project.id), label: project.name }))} /><div className="grid gap-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Organization" value={form.organization_id} onChange={(value) => setForm({ ...form, organization_id: value })} options={[{ value: '', label: 'Any organization' }, ...data.organizations.map((org) => ({ value: String(org.id), label: org.name }))]} required={false} /><SelectField label="Job code" value={form.job_code_id} onChange={(value) => setForm({ ...form, job_code_id: value })} options={[{ value: '', label: 'Any job code' }, ...data.jobCodes.map((jobCode) => ({ value: String(jobCode.id), label: jobCode.name }))]} required={false} /></div><div className="grid gap-2"><Label>Skill notes</Label><Input value={form.skill_notes} onChange={(e) => setForm({ ...form, skill_notes: e.target.value })} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required /></div><div className="grid gap-2"><Label>End date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required /></div></div><div className="grid gap-2"><Label>Required allocation (FTE)</Label><Input type="number" min="0.1" step="0.1" value={form.required_allocation} onChange={(e) => setForm({ ...form, required_allocation: e.target.value })} /></div><div className="grid gap-2"><Label>Notes</Label><Textarea className="min-h-24" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div><Button type="submit">Create demand</Button></form></FormCard>} table={<DataCard title="Demands" description="Densified rows for large staffing backlogs."><CompactTable minWidth="1160px" headers={[{ label: 'Demand', className: 'w-[21%]' }, { label: 'Project / Target', className: 'w-[24%]' }, { label: 'Dates', className: 'w-[14%]' }, { label: 'Need', className: 'w-[7%]' }, { label: 'Filled', className: 'w-[7%]' }, { label: 'Gap', className: 'w-[7%]' }, { label: 'Actions', className: 'w-[20%]' }]}>{data.demands.map((demand) => <DemandRow key={demand.id} demand={demand} data={data} onReload={reload} onError={setError} />)}</CompactTable></DataCard>} /></PageFrame>;
}

function DemandRow({ demand, data, onReload, onError }: { demand: Demand; data: WorkspaceData; onReload: () => Promise<void>; onError: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ project_id: String(demand.project_id), title: demand.title, organization_id: String(demand.organization_id ?? ''), job_code_id: String(demand.job_code_id ?? ''), skill_notes: demand.skill_notes || '', start_date: demand.start_date, end_date: demand.end_date, required_allocation: String(demand.required_allocation), notes: demand.notes || '' });
  return <tr className="border-b border-slate-100 align-top"><td className="px-3 py-2.5"><CellMain title={demand.title} subtitle={`ID ${demand.id}`} /></td><td className="px-3 py-2.5 text-sm text-slate-600"><div>{demand.project_name || '—'}</div><div className="text-xs text-slate-500">{demand.organization_name || 'Any org'} · {demand.job_code_name || 'Any role'}</div></td><td className="px-3 py-2.5 text-sm text-slate-700">{shortDateRange(demand.start_date, demand.end_date)}</td><td className="px-3 py-2.5 text-sm text-slate-700">{num(demand.required_allocation)}</td><td className="px-3 py-2.5 text-sm text-slate-700">{num(demand.fulfilled_allocation)}</td><td className="px-3 py-2.5 text-sm font-medium text-slate-800">{num(demand.remaining_allocation)}</td><td className="px-3 py-2.5"><EditorShell open={open} onToggle={() => setOpen((v) => !v)} onDelete={async () => { try { await sendJson(`/demands-api/${demand.id}`, 'DELETE'); await onReload(); } catch (err) { onError(err instanceof Error ? err.message : 'Failed'); } }}><div className="grid gap-3 xl:grid-cols-3"><Select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>{data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><Input placeholder="Skill notes" value={form.skill_notes} onChange={(e) => setForm({ ...form, skill_notes: e.target.value })} /><Select value={form.organization_id} onChange={(e) => setForm({ ...form, organization_id: e.target.value })}><option value="">Any organization</option>{data.organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</Select><Select value={form.job_code_id} onChange={(e) => setForm({ ...form, job_code_id: e.target.value })}><option value="">Any job code</option>{data.jobCodes.map((jobCode) => <option key={jobCode.id} value={jobCode.id}>{jobCode.name}</option>)}</Select><Input type="number" min="0.1" step="0.1" value={form.required_allocation} onChange={(e) => setForm({ ...form, required_allocation: e.target.value })} /><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /><Textarea className="min-h-20 xl:col-span-3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /><div className="xl:col-span-3 xl:justify-self-end"><Button size="sm" onClick={async () => { try { await sendJson(`/demands-api/${demand.id}`, 'PUT', { ...form, project_id: Number(form.project_id), organization_id: form.organization_id ? Number(form.organization_id) : null, job_code_id: form.job_code_id ? Number(form.job_code_id) : null, required_allocation: Number(form.required_allocation) }); await onReload(); setOpen(false); } catch (err) { onError(err instanceof Error ? err.message : 'Failed'); } }}>Save</Button></div></div></EditorShell></td></tr>;
}

export function AssignmentsPage({ flash = '' }: PageProps) {
  const { data, loading, error, reload, setError } = useWorkspaceData();
  const [form, setForm] = React.useState({ employee_id: '', project_id: '', demand_id: '', start_date: '', end_date: '', allocation: '1', notes: '' });
  if (loading) return <LoadingState />; if (error) return <ErrorState message={error} />;
  const stats = [{ label: 'Assignments', value: data.assignments.length }, { label: 'Allocated FTE', value: num(data.assignments.reduce((sum, assignment) => sum + (assignment.allocation ?? 0), 0)) }, { label: 'Projects staffed', value: new Set(data.assignments.map((assignment) => assignment.project_id)).size }, { label: 'People staffed', value: new Set(data.assignments.map((assignment) => assignment.employee_id)).size }];
  return <PageFrame title="Assignments" description="Compact staffing rows optimized for scanning employee, project, dates, and allocation at scale." flash={flash} stats={stats}><TwoPanel form={<FormCard title="Create assignment" description="Keep the list clean and dedicate detailed entry to the side panel."><form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); try { await sendJson('/assignments', 'POST', { ...form, employee_id: Number(form.employee_id), project_id: Number(form.project_id), demand_id: form.demand_id ? Number(form.demand_id) : null, allocation: Number(form.allocation) }); setForm({ employee_id: '', project_id: '', demand_id: '', start_date: '', end_date: '', allocation: '1', notes: '' }); await reload(); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } }}><SelectField label="Employee" value={form.employee_id} onChange={(value) => setForm({ ...form, employee_id: value })} options={data.employees.map((employee) => ({ value: String(employee.id), label: employee.name }))} /><SelectField label="Project" value={form.project_id} onChange={(value) => setForm({ ...form, project_id: value })} options={data.projects.map((project) => ({ value: String(project.id), label: project.name }))} /><SelectField label="Demand" value={form.demand_id} onChange={(value) => setForm({ ...form, demand_id: value })} options={[{ value: '', label: 'No linked demand' }, ...data.demands.map((demand) => ({ value: String(demand.id), label: `${demand.project_name || 'Project'} · ${demand.title}` }))]} required={false} /><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required /></div><div className="grid gap-2"><Label>End date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required /></div></div><div className="grid gap-2"><Label>Allocation (FTE)</Label><Input type="number" min="0.1" step="0.1" value={form.allocation} onChange={(e) => setForm({ ...form, allocation: e.target.value })} /></div><div className="grid gap-2"><Label>Notes</Label><Textarea className="min-h-24" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div><Button type="submit">Create assignment</Button></form></FormCard>} table={<DataCard title="Assignments" description="High-density staffing rows with on-demand editing."><CompactTable minWidth="1080px" headers={[{ label: 'Employee', className: 'w-[21%]' }, { label: 'Project', className: 'w-[20%]' }, { label: 'Demand', className: 'w-[20%]' }, { label: 'Dates', className: 'w-[15%]' }, { label: 'Allocation', className: 'w-[8%]' }, { label: 'Actions', className: 'w-[16%]' }]}>{data.assignments.map((assignment) => <AssignmentRow key={assignment.id} assignment={assignment} data={data} onReload={reload} onError={setError} />)}</CompactTable></DataCard>} /></PageFrame>;
}

function AssignmentRow({ assignment, data, onReload, onError }: { assignment: Assignment; data: WorkspaceData; onReload: () => Promise<void>; onError: (value: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ employee_id: String(assignment.employee_id), project_id: String(assignment.project_id), demand_id: String(assignment.demand_id ?? ''), start_date: assignment.start_date, end_date: assignment.end_date, allocation: String(assignment.allocation), notes: assignment.notes || '' });
  return <tr className="border-b border-slate-100 align-top"><td className="px-3 py-2.5"><CellMain title={assignment.employee_name || '—'} subtitle={`ID ${assignment.id}`} /></td><td className="px-3 py-2.5 text-sm text-slate-700">{assignment.project_name || '—'}</td><td className="px-3 py-2.5 text-sm text-slate-600">{assignment.demand_title || '—'}</td><td className="px-3 py-2.5 text-sm text-slate-700">{shortDateRange(assignment.start_date, assignment.end_date)}</td><td className="px-3 py-2.5 text-sm font-medium text-slate-800">{num(assignment.allocation)}</td><td className="px-3 py-2.5"><EditorShell open={open} onToggle={() => setOpen((v) => !v)} onDelete={async () => { try { await sendJson(`/assignments/${assignment.id}`, 'DELETE'); await onReload(); } catch (err) { onError(err instanceof Error ? err.message : 'Failed'); } }}><div className="grid gap-3 xl:grid-cols-3"><Select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>{data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</Select><Select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>{data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</Select><Select value={form.demand_id} onChange={(e) => setForm({ ...form, demand_id: e.target.value })}><option value="">No linked demand</option>{data.demands.filter((demand) => String(demand.project_id) === form.project_id || demand.id === assignment.demand_id).map((demand) => <option key={demand.id} value={demand.id}>{demand.title}</option>)}</Select><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /><Input type="number" min="0.1" step="0.1" value={form.allocation} onChange={(e) => setForm({ ...form, allocation: e.target.value })} /><Textarea className="min-h-20 xl:col-span-3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /><div className="xl:col-span-3 xl:justify-self-end"><Button size="sm" onClick={async () => { try { await sendJson(`/assignments/${assignment.id}`, 'PUT', { ...form, employee_id: Number(form.employee_id), project_id: Number(form.project_id), demand_id: form.demand_id ? Number(form.demand_id) : null, allocation: Number(form.allocation) }); await onReload(); setOpen(false); } catch (err) { onError(err instanceof Error ? err.message : 'Failed'); } }}>Save</Button></div></div></EditorShell></td></tr>;
}
