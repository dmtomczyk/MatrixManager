import * as React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';

type ForecastProjectView = {
  id: number;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  demand_total: number;
  assignment_total: number;
  gap_total: number;
  demand_rows: Array<{ id: number; title: string; required_allocation: number }>;
  assignment_rows: Array<{ id: number; employee_name?: string | null; allocation: number }>;
};

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
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="space-y-1 pb-2">
        <CardDescription className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</CardDescription>
        <CardTitle className="text-2xl text-slate-950">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function sortProjects(projects: ForecastProjectView[]) {
  return [...projects].sort((a, b) => {
    const gapDiff = (b.gap_total || 0) - (a.gap_total || 0);
    if (gapDiff !== 0) return gapDiff;
    const demandDiff = (b.demand_total || 0) - (a.demand_total || 0);
    if (demandDiff !== 0) return demandDiff;
    return a.name.localeCompare(b.name);
  });
}

export default function ForecastPage({ currentUser, flash }: ForecastPageProps) {
  const [projects, setProjects] = React.useState<ForecastProjectView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [toast, setToast] = React.useState(flash || '');
  const [query, setQuery] = React.useState('');
  const [showOnlyGaps, setShowOnlyGaps] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch<ForecastProjectView[]>('/forecast-api');
      setProjects(sortProjects(result));
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

  const filteredProjects = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return projects.filter((project) => {
      if (showOnlyGaps && project.gap_total <= 0) return false;
      if (!normalized) return true;
      const haystack = [project.name, project.start_date || '', project.end_date || '', ...project.demand_rows.map((row) => row.title), ...project.assignment_rows.map((row) => row.employee_name || '')].join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [projects, query, showOnlyGaps]);

  const topGapProjects = React.useMemo(() => filteredProjects.filter((project) => project.gap_total > 0).slice(0, 6), [filteredProjects]);

  return (
    <main className="mx-auto flex w-full max-w-[min(100%,calc(100vw-2rem))] flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950">Forecast</h1>
          <p className="mt-2 max-w-4xl text-slate-600">Director-friendly portfolio view for rapid gap scanning. Projects are sorted by staffing gap first, with compact rollups and denser tables for larger workforces.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => setShowOnlyGaps((value) => !value)}>
            {showOnlyGaps ? 'Show All Projects' : 'Show Only Gaps'}
          </Button>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
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

      <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl text-slate-950">Gap priority queue</CardTitle>
            <CardDescription>The largest project staffing gaps first so leadership can focus quickly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && !projects.length ? <p className="text-sm text-slate-500">Loading forecast…</p> : null}
            {!loading && !topGapProjects.length ? <p className="text-sm text-slate-500">No open project gaps in the current filtered view.</p> : null}
            {topGapProjects.map((project, index) => (
              <div key={project.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Priority #{index + 1}</div>
                    <h3 className="mt-1 text-base font-semibold text-slate-950">{project.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{project.start_date || '—'} → {project.end_date || '—'}</p>
                  </div>
                  <Badge variant="secondary">Gap {fmtFte(project.gap_total)}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-700">
                  <div className="flex items-center justify-between gap-3"><span>Demand FTE</span><strong>{fmtFte(project.demand_total)}</strong></div>
                  <div className="flex items-center justify-between gap-3"><span>Assigned FTE</span><strong>{fmtFte(project.assignment_total)}</strong></div>
                  <div className="flex items-center justify-between gap-3"><span>Demand rows</span><strong>{project.demand_rows.length}</strong></div>
                  <div className="flex items-center justify-between gap-3"><span>Assignments</span><strong>{project.assignment_rows.length}</strong></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <CardTitle className="text-2xl text-slate-950">Portfolio forecast matrix</CardTitle>
                <CardDescription>Dense, sortable-by-default scan of the full project portfolio.</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project, demand, or employee…" className="sm:w-72" />
                <div className="text-sm text-slate-500">Signed in as <span className="font-medium text-slate-800">{currentUser}</span></div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[1120px] table-fixed text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    <th className="w-[24%] px-3 py-2.5 font-semibold">Project</th>
                    <th className="w-[14%] px-3 py-2.5 font-semibold">Dates</th>
                    <th className="w-[8%] px-3 py-2.5 font-semibold">Demand</th>
                    <th className="w-[8%] px-3 py-2.5 font-semibold">Assigned</th>
                    <th className="w-[8%] px-3 py-2.5 font-semibold">Gap</th>
                    <th className="w-[8%] px-3 py-2.5 font-semibold">Demand Rows</th>
                    <th className="w-[8%] px-3 py-2.5 font-semibold">Assignments</th>
                    <th className="w-[22%] px-3 py-2.5 font-semibold">Largest open demand / staffing signal</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.length ? filteredProjects.map((project) => {
                    const topDemand = [...project.demand_rows].sort((a, b) => b.required_allocation - a.required_allocation)[0];
                    const topAssignee = [...project.assignment_rows].sort((a, b) => b.allocation - a.allocation)[0];
                    return (
                      <tr key={project.id} className="border-b border-slate-100 align-top last:border-b-0">
                        <td className="px-3 py-2.5">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-950">{project.name}</div>
                            <div className="truncate text-xs text-slate-500">{project.gap_total > 0 ? 'Needs attention' : 'Covered'} · sorted by gap priority</div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-slate-700">{project.start_date || '—'} → {project.end_date || '—'}</td>
                        <td className="px-3 py-2.5 text-sm text-slate-700">{fmtFte(project.demand_total)}</td>
                        <td className="px-3 py-2.5 text-sm text-slate-700">{fmtFte(project.assignment_total)}</td>
                        <td className={`px-3 py-2.5 text-sm font-semibold ${project.gap_total > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{fmtFte(project.gap_total)}</td>
                        <td className="px-3 py-2.5 text-sm text-slate-700">{project.demand_rows.length}</td>
                        <td className="px-3 py-2.5 text-sm text-slate-700">{project.assignment_rows.length}</td>
                        <td className="px-3 py-2.5 text-sm text-slate-600">
                          <div className="space-y-1">
                            <div className="truncate"><span className="font-medium text-slate-800">Top demand:</span> {topDemand ? `${topDemand.title} (${fmtFte(topDemand.required_allocation)} FTE)` : '—'}</div>
                            <div className="truncate"><span className="font-medium text-slate-800">Top assignee:</span> {topAssignee ? `${topAssignee.employee_name || 'Unnamed'} (${fmtFte(topAssignee.allocation)} FTE)` : '—'}</div>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-slate-500">No projects available for the current forecast filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
