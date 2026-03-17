import * as React from 'react';

interface EmployeeView {
  id: number;
  name: string;
  organization_name?: string | null;
  manager_name?: string | null;
  active_allocation_percent?: number | null;
  capacity_percent?: number | null;
  active_assignment_count?: number | null;
  load_status?: string | null;
}

interface AssignmentView {
  id: number;
  employee_name?: string | null;
  project_name?: string | null;
  start_date: string;
  end_date: string;
  allocation: number;
  notes?: string | null;
}

interface DashboardData {
  username: string;
  employee_name?: string | null;
  direct_reports: EmployeeView[];
  tracked_employees: EmployeeView[];
  submitted_items: AssignmentView[];
  available_tracking_candidates: EmployeeView[];
}

interface DashboardPageProps {
  currentUser: string;
  flash?: string;
}

const apiBase = (globalThis as typeof globalThis & { __MM_API_BASE__?: string }).__MM_API_BASE__ || '';

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-matrix-user': options.headers && 'x-matrix-user' in new Headers(options.headers) ? new Headers(options.headers).get('x-matrix-user') || '' : '',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || 'Request failed');
  }

  return response.json() as Promise<T>;
}

function fmtFte(value?: number | null): string {
  return Number(value || 0).toFixed(2);
}

function fmtPct(value?: number | null): string {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function statusClasses(status?: string | null): string {
  switch (status) {
    case 'over':
      return 'bg-rose-100 text-rose-800';
    case 'high':
      return 'bg-amber-100 text-amber-800';
    case 'active':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-emerald-100 text-emerald-800';
  }
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
    </div>
  );
}

function EmployeeCard({ employee, removable, onRemove }: { employee: EmployeeView; removable?: boolean; onRemove?: (id: number) => void }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-950">{employee.name}</h3>
      <div className="mt-1 text-sm text-slate-500">{employee.organization_name || 'No organization'} · {employee.manager_name || 'No manager'}</div>
      <div className="mt-2 text-sm text-slate-500">Active allocation {fmtPct(employee.active_allocation_percent)} of {fmtPct(employee.capacity_percent)} · {employee.active_assignment_count ?? 0} assignment(s)</div>
      <div className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${statusClasses(employee.load_status)}`}>{employee.load_status || 'available'}</div>
      {removable ? (
        <button type="button" className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50" onClick={() => onRemove?.(employee.id)}>
          Stop tracking
        </button>
      ) : null}
    </article>
  );
}

export default function DashboardPage({ currentUser, flash }: DashboardPageProps) {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [toast, setToast] = React.useState(flash || '');
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch<DashboardData>('/dashboard-api', { headers: { 'x-matrix-user': currentUser } });
      setData(result);
      setSelectedEmployeeId((prev) => prev || String(result.available_tracking_candidates[0]?.id || ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const updateTrackedEmployees = async (employeeIds: number[], successMessage: string) => {
    try {
      await apiFetch('/dashboard-api/tracked-employees', {
        method: 'PUT',
        headers: { 'x-matrix-user': currentUser },
        body: JSON.stringify({ employee_ids: employeeIds }),
      });
      setToast(successMessage);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    }
  };

  if (loading && !data) return <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-6xl items-center justify-center px-4 py-10 text-slate-500">Loading dashboard…</main>;
  if (!data) return <main className="mx-auto w-full max-w-6xl px-4 py-10"><div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{error || 'Dashboard unavailable.'}</div></main>;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950">{data.employee_name ? `${data.employee_name}'s dashboard` : 'Your dashboard'}</h1>
          <p className="mt-2 max-w-3xl text-slate-600">Quick-reference team utilization and tracked staffing rows, now back in React while staying on the current TypeScript persistence and auth shell.</p>
        </div>
        <button type="button" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{error}</div> : null}
      {toast ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{toast}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Direct reports" value={data.direct_reports.length} />
        <StatCard label="Tracked people" value={data.tracked_employees.length} />
        <StatCard label="Submitted items" value={data.submitted_items.length} />
        <StatCard label="Available to track" value={data.available_tracking_candidates.length} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr,1fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Track employee</h2>
            <p className="mt-1 text-sm text-slate-500">Persist tracked people through the TypeScript dashboard preferences store.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <select className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900" value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)} disabled={!data.available_tracking_candidates.length}>
                {data.available_tracking_candidates.length ? data.available_tracking_candidates.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>) : <option value="">No additional employees available</option>}
              </select>
              <button
                type="button"
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={!selectedEmployeeId}
                onClick={() => {
                  const employeeId = Number(selectedEmployeeId);
                  const nextIds = [...new Set(data.tracked_employees.map((employee) => employee.id).concat(employeeId))];
                  void updateTrackedEmployees(nextIds, 'Employee added to tracked list.');
                }}
              >
                Track employee
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Tracked employees</h2>
            <div className="mt-4 grid gap-4">
              {data.tracked_employees.length ? data.tracked_employees.map((employee) => (
                <EmployeeCard
                  key={employee.id}
                  employee={employee}
                  removable
                  onRemove={(employeeId) => void updateTrackedEmployees(data.tracked_employees.map((item) => item.id).filter((id) => id !== employeeId), 'Employee removed from tracked list.')}
                />
              )) : <p className="text-sm text-slate-500">No tracked employees yet.</p>}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Direct reports</h2>
          <div className="mt-4 grid gap-4">
            {data.direct_reports.length ? data.direct_reports.map((employee) => <EmployeeCard key={employee.id} employee={employee} />) : <p className="text-sm text-slate-500">No direct reports mapped to this signed-in user yet.</p>}
          </div>
        </section>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Recent assignment rows</h2>
            <p className="mt-1 text-sm text-slate-500">Recent TS assignment summaries for the current dashboard context.</p>
          </div>
          <div className="text-sm text-slate-500">Signed in as <span className="font-medium text-slate-800">{currentUser}</span></div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="px-3 py-3 font-semibold">Employee</th>
                <th className="px-3 py-3 font-semibold">Project</th>
                <th className="px-3 py-3 font-semibold">Dates</th>
                <th className="px-3 py-3 font-semibold">Allocation</th>
                <th className="px-3 py-3 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.submitted_items.length ? data.submitted_items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-3 text-slate-900">{item.employee_name || '—'}</td>
                  <td className="px-3 py-3 text-slate-700">{item.project_name || '—'}</td>
                  <td className="px-3 py-3 text-slate-700">{item.start_date} → {item.end_date}</td>
                  <td className="px-3 py-3 text-slate-700">{fmtFte(item.allocation)} FTE</td>
                  <td className="px-3 py-3 text-slate-700">{item.notes || '—'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">No submitted assignment rows yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
