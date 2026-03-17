import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface Principle {
  title: string;
  body: string;
}

interface QuickLink {
  label: string;
  href: string;
}

const principles: Principle[] = [
  {
    title: 'Organizations anchor the model',
    body: 'Every employee lives in a home organization. That gives your staffing plan a durable reporting and ownership structure.',
  },
  {
    title: 'Managers shape hierarchy',
    body: 'Reporting lines sit inside the org structure so leadership, approvals, and span of control remain visible.',
  },
  {
    title: 'Projects express work demand',
    body: 'Projects become real planning objects once you connect people to them through time-bound assignments and allocation.',
  },
];

const steps: string[] = [
  'Create an organization',
  'Define job codes',
  'Add employees',
  'Create a project',
  'Assign employees to the project',
  'Review staffing in Canvas and Forecast',
];

const quickLinks: QuickLink[] = [
  { label: 'Organizations', href: '/orgs' },
  { label: 'Job Codes', href: '/job-codes' },
  { label: 'Employees', href: '/people' },
  { label: 'Projects', href: '/planning' },
  { label: 'Assignments', href: '/staffing' },
];

const relationshipItems = ['Organizations', 'Employees', 'Managers', 'Projects', 'Assignments'] as const;
const relationshipKinds = ['Foundation', 'People', 'Structure', 'Work', 'Execution'] as const;

export default function GetStartedPage() {
  return (
    <main className="ops-page flex flex-col gap-6">
      <Card className="ops-hero-card">
        <CardHeader className="ops-home-hero">
          <div className="ops-home-intro">
            <p className="ops-kicker">Get Started</p>
            <CardTitle className="text-3xl text-slate-950">Build the planning model in the right order.</CardTitle>
            <CardDescription className="max-w-3xl text-base leading-7">
              Matrix Manager works best when you start with structure, then people, then work demand. Once those pieces are in place, the rest of the application becomes much easier to read.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          {principles.map((item) => (
            <article key={item.title} className="ops-soft-card p-5">
              <h3 className="mb-2 text-base font-semibold text-slate-950">{item.title}</h3>
              <p className="ops-body">{item.body}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="ops-hero-card">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-950">Relationship map</CardTitle>
            <CardDescription>Use this as the basic mental model for how the application fits together.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              {relationshipItems.map((item, index) => (
                <React.Fragment key={item}>
                  <div className="ops-soft-card grid gap-1 px-4 py-3 shadow-soft">
                    <strong className="text-sm text-slate-950">{item}</strong>
                    <span className="text-xs uppercase tracking-[0.12em] text-slate-500">{relationshipKinds[index]}</span>
                  </div>
                  {index < relationshipItems.length - 1 ? <span className="text-sm font-semibold text-slate-400">→</span> : null}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="ops-hero-card">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-950">Quick links</CardTitle>
            <CardDescription>Jump directly into the setup sequence.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {quickLinks.map((link) => (
              <a key={link.href} href={link.href} className="ops-link-card">
                <span>{link.label}</span>
                <span className="text-primary">Open</span>
              </a>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="ops-hero-card">
        <CardHeader>
          <CardTitle className="text-2xl text-slate-950">Recommended first pass</CardTitle>
          <CardDescription>A small amount of setup unlocks the rest of the product quickly.</CardDescription>
        </CardHeader>
        <CardContent className="ops-steps-list">
          {steps.map((step, index) => (
            <div key={step} className="ops-step">
              <div className="ops-step-index">{index + 1}</div>
              <strong className="text-sm font-semibold text-slate-900">{step}</strong>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
