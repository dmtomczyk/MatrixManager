import * as React from 'react';

interface ForecastProjectView {
  id: number;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  demand_total: number;
  assignment_total: number;
  gap_total: number;
  demand_rows: Array<{ id: number; title: string; required_allocation: number }>;
  assignment_rows: Array<{ id: number; employee_name?: string | null; allocation: number }>;
}

interface ForecastPageProps {
  currentUser: string;
  flash?: string;
}

const apiBase = (globalThis as typeof globalThis & { __MM_API_BASE__?: string }).__MM_API_BASE__ || '';

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${url}`, options);
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || 'Request failed');
  }
  return response.json() as Promise<T>;
}

function fmtFte(value?: number | null): string {
  return Number(value || 0).toFixed(2);
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
    </div>
  );
}

export default function ForecastPage({ currentUser, flash }: ForecastPageProps) {
  const [projects, setProjects] = React.useState<ForecastProjectView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [toast, setToast] = React.useState(flash || '');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch<ForecastProjectView[]>('/forecast-api');
      setProjects(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const totals = React.useMemo(() => projects.reduce((acc, project) => ({
    demand: acc.demand + (project.demand_total || 0),
    assigned: acc.assigned + (project.assignment_total || 0),
    gap: acc.gap + (project.gap_total || 0),
    demandRows: acc.demandRows + project.demand_rows.length,
    assignmentRows: acc.assignmentRows + project.assignment_rows.length,
  }), { demand: 0, assigned: 0, gap: 0, demandRows: 0, assignmentRows: 0 }), [projects]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950">Forecast</h1>
          <p className="mt-2 max-w-3xl text-slate-600">Portfolio-level demand versus assignment rollups are back in React, still powered by the current TypeScript service and SQLite-backed persistence.</p>
        </div>
        <button type="button" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{error}</div> : null}
      {toast ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{toast}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Stat label="Projects" value={projects.length} />
        <Stat label="Demand FTE" value={fmtFte(totals.demand)} />
        <Stat label="Assigned FTE" value={fmtFte(totals.assigned)} />
        <Stat label="Gap FTE" value={fmtFte(totals.gap)} />
        <Stat label="Demand / Assignment rows" value={`${totals.demandRows} / ${totals.assignmentRows}`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr,1.1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">Project rollups</h2>
          <div className="mt-4 grid gap-4">
            {loading && !projects.length ? <p className="text-sm text-slate-500">Loading forecast…</p> : null}
            {!loading && !projects.length ? <p className="text-sm text-slate-500">No forecast data yet.</p> : null}
            {projects.map((project) => (
              <article key={project.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">{project.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{project.start_date || '—'} → {project.end_date || '—'}</p>
                  </div>
                  <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${project.gap_total > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {project.gap_total > 0 ? `${fmtFte(project.gap_total)} FTE gap` : 'Covered'}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div><div className="text-xs uppercase tracking-[0.12em] text-slate-500">Demand</div><div className="mt-1 text-lg font-semibold text-slate-900">{fmtFte(project.demand_total)}</div></div>
                  <div><div className="text-xs uppercase tracking-[0.12em] text-slate-500">Assigned</div><div className="mt-1 text-lg font-semibold text-slate-900">{fmtFte(project.assignment_total)}</div></div>
                  <div><div className="text-xs uppercase tracking-[0.12em] text-slate-500">Rows</div><div className="mt-1 text-lg font-semibold text-slate-900">{project.demand_rows.length} / {project.assignment_rows.length}</div></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Summary table</h2>
              <p className="mt-1 text-sm text-slate-500">Same TS rollup data, just easier to scan across the portfolio.</p>
            </div>
            <div className="text-sm text-slate-500">Signed in as <span className="font-medium text-slate-800">{currentUser}</span></div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-3 py-3 font-semibold">Project</th>
                  <th className="px-3 py-3 font-semibold">Demand</th>
                  <th className="px-3 py-3 font-semibold">Assigned</th>
                  <th className="px-3 py-3 font-semibold">Gap</th>
                  <th className="px-3 py-3 font-semibold">Demands</th>
                  <th className="px-3 py-3 font-semibold">Assignments</th>
                  <th className="px-3 py-3 font-semibold">Dates</th>
                </tr>
              </thead>
              <tbody>
                {projects.length ? projects.map((project) => (
                  <tr key={project.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-3 font-medium text-slate-900">{project.name}</td>
                    <td className="px-3 py-3 text-slate-700">{fmtFte(project.demand_total)}</td>
                    <td className="px-3 py-3 text-slate-700">{fmtFte(project.assignment_total)}</td>
                    <td className={`px-3 py-3 font-medium ${project.gap_total > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{fmtFte(project.gap_total)}</td>
                    <td className="px-3 py-3 text-slate-700">{project.demand_rows.length}</td>
                    <td className="px-3 py-3 text-slate-700">{project.assignment_rows.length}</td>
                    <td className="px-3 py-3 text-slate-700">{project.start_date || '—'} → {project.end_date || '—'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-slate-500">No projects available for forecast rollup.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
