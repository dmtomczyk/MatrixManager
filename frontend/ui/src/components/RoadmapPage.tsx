import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

type RoadmapPhase = {
  phase: string;
  horizon: string;
  goal: string;
  items: string[];
};

const phases: RoadmapPhase[] = [
  {
    phase: 'Now',
    horizon: 'Near-term polish and workflow depth',
    goal: 'Tighten the current React product surface so the app feels faster, denser, and more operationally useful without changing the overall model too much.',
    items: [
      'Add sorting, filtering, and saved views across workforce and planning tables.',
      'Continue improving collapsed tree/table controls for organizations and reporting chains.',
      'Refine fullscreen Canvas into a stronger workspace with better docking, snapping, and keyboard behavior.',
      'Keep improving director-oriented forecast scanning for large portfolios and many staffing gaps.',
      'Add more compact bulk-edit workflows for assignments, demand rows, and people management.',
    ],
  },
  {
    phase: 'Next',
    horizon: 'Capability modeling and planning intelligence',
    goal: 'Move beyond basic staffing CRUD into a richer planning model that better reflects real workforce matching and portfolio planning.',
    items: [
      'Link projects to persistent skillsets or capability profiles instead of relying only on freeform notes.',
      'Let demands reference reusable skill requirements and reusable staffing templates.',
      'Introduce skill/capability visibility on employees and job codes so matching is easier later.',
      'Add better staffing recommendation hints based on availability, org alignment, and capabilities.',
      'Add project and org-level planning views that summarize readiness, gap concentration, and staffing risk.',
    ],
  },
  {
    phase: 'Later',
    horizon: 'Operational maturity and scale',
    goal: 'Make the application easier to operate for leaders managing more people, more projects, and more planning complexity over time.',
    items: [
      'Saved role-based dashboards for managers, directors, and exec-style portfolio review.',
      'Scenario planning / compare plans without overwriting the current staffing picture.',
      'Notifications and inbox triage for approvals, staffing risks, and allocation conflicts.',
      'More robust audit, runtime, and admin tooling once the core workflows settle down.',
      'Revisit broader e2e coverage once feature churn slows and the key workflows stabilize.',
    ],
  },
];

const ideaBacklog = [
  'Heatmap-style team and org utilization views for quickly spotting overloaded groups.',
  'Bench / availability view showing underallocated employees by role, org, and timeframe.',
  'Sticky side-by-side demand and assignment comparison while editing projects or demand rows.',
  'Reusable portfolio labels/tags on projects so leaders can filter strategic initiatives quickly.',
  'Manager handoff notes or staffing rationale captured directly on assignments and demand rows.',
  'Time-phased capacity lanes or mini-timelines embedded in tables for denser planning visibility.',
  'Bulk import/export helpers for orgs, employees, projects, demands, and assignments.',
  'Soft constraints such as preferred orgs, travel rules, location fit, or leadership alignment.',
] as const;

export default function RoadmapPage() {
  return (
    <main className="mx-auto flex w-full max-w-[min(100%,calc(100vw-2rem))] flex-col gap-6 px-4 py-8">
      <section className="space-y-4">
        <Badge variant="secondary" className="rounded-md px-3 py-1 text-[0.72rem] uppercase tracking-[0.18em] text-slate-700">
          Roadmap
        </Badge>
        <div className="space-y-3">
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">Planned improvements, phased.</h1>
          <p className="max-w-4xl text-base leading-7 text-slate-600">
            This page tracks the features worth remembering as the product evolves. The goal is not to over-spec everything now — it is to preserve the right ideas, organize them by likely time horizon, and make sure the app keeps moving toward a more useful workforce planning tool.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {phases.map((phase) => (
          <Card key={phase.phase} className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardDescription className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{phase.horizon}</CardDescription>
              <CardTitle className="text-2xl text-slate-950">{phase.phase}</CardTitle>
              <CardDescription className="text-sm leading-6">{phase.goal}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                {phase.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-slate-950">Idea backlog worth tracking</CardTitle>
          <CardDescription>Not fully designed yet, but interesting enough that they should not disappear.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {ideaBacklog.map((item) => (
              <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
