import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const sections = [
  {
    title: 'Workforce & planning UX',
    items: [
      'Add sorting, filtering, and saved views across workforce/planning tables.',
      'Improve tree-table controls on Organizations with expand/collapse and subtree filtering.',
      'Keep tightening director-friendly forecast and staffing oversight views.',
    ],
  },
  {
    title: 'Canvas and modeling',
    items: [
      'Improve project detail workflows and larger-graph navigation on Canvas.',
      'Persist more user canvas preferences and shortcuts.',
      'Make project/demand planning feel more visual and less form-heavy.',
    ],
  },
  {
    title: 'Skills / capability modeling',
    items: [
      'Explore linking projects to persistent skillsets/capability profiles.',
      'Let demands reference reusable skill requirements instead of freeform notes only.',
      'Connect workforce capabilities to staffing recommendations without fully designing the feature yet.',
    ],
  },
  {
    title: 'Platform / polish',
    items: [
      'Continue replacing ad hoc CRUD patterns with cleaner reusable React primitives.',
      'Improve dense-data navigation for leaders with lots of demand/allocation rows.',
      'Revisit deeper e2e coverage once the product surface stabilizes further.',
    ],
  },
] as const;

export default function RoadmapPage() {
  return (
    <main className="mx-auto flex w-full max-w-[min(100%,calc(100vw-2rem))] flex-col gap-6 px-4 py-8">
      <section className="space-y-4">
        <Badge variant="secondary" className="rounded-md px-3 py-1 text-[0.72rem] uppercase tracking-[0.18em] text-slate-700">
          Roadmap
        </Badge>
        <div className="space-y-3">
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">Planned improvements and open ideas.</h1>
          <p className="max-w-4xl text-base leading-7 text-slate-600">
            This page is a lightweight home for planned features, product direction, and half-shaped ideas that should not get lost during refactors. It is intentionally simple and can evolve as priorities change.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title} className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-slate-950">{section.title}</CardTitle>
              <CardDescription>Current thinking and likely future work.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
