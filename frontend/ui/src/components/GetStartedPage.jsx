import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const principles = [
  {
    title: 'Organizations contain employees',
    body: 'An organization is the home structure for your people. Every employee belongs to one organization, even if they work across multiple projects.',
  },
  {
    title: 'Managers lead reporting trees',
    body: 'Employees with leader roles can manage people. Those direct reports can themselves be managers, giving you a hierarchy inside each organization.',
  },
  {
    title: 'Projects pull people across the org',
    body: 'Projects represent work demand. Assignments connect employees to projects with date ranges and allocation percentages so you can see utilization over time.',
  },
];

const steps = [
  'Define an organization',
  'Set up job codes',
  'Create employees',
  'Create a project',
  'Assign employees to the project',
  'Review the outputs in Canvas and Forecast',
];

const quickLinks = [
  { label: 'Organizations', href: '/orgs' },
  { label: 'Job Codes', href: '/job-codes' },
  { label: 'Employees', href: '/people' },
  { label: 'Projects', href: '/planning' },
  { label: 'Assignments', href: '/staffing' },
];

export default function GetStartedPage() {
  return (
    <main className="ops-page flex flex-col gap-5">
      <Card className="ops-hero-card bg-white/95">
        <CardHeader>
          <p className="ops-kicker">Get Started</p>
          <CardTitle className="text-3xl text-slate-950">How the model works</CardTitle>
          <CardDescription className="max-w-3xl text-base leading-7">
            Matrix Management connects organizations, people, projects, and assignments into one staffing picture.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          {principles.map((item) => (
            <article key={item.title} className="ops-soft-card p-4">
              <h3 className="mb-2 text-base font-semibold text-slate-950">{item.title}</h3>
              <p className="ops-body">{item.body}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="ops-hero-card bg-white/95">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-950">Relationship map</CardTitle>
            <CardDescription>Use this as the mental model for the app.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              {['Organizations', 'Employees', 'Managers', 'Projects', 'Assignments'].map((item, index, items) => (
                <React.Fragment key={item}>
                  <div className="ops-soft-card grid gap-1 px-4 py-3 shadow-sm">
                    <strong className="text-sm text-slate-950">{item}</strong>
                    <span className="text-xs uppercase tracking-[0.12em] text-slate-500">{['Foundation', 'People', 'Structure', 'Work', 'Execution'][index]}</span>
                  </div>
                  {index < items.length - 1 ? <span className="text-sm font-semibold text-slate-400">→</span> : null}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="ops-hero-card bg-white/95">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-950">Quick links</CardTitle>
            <CardDescription>Move through the initial setup sequence quickly.</CardDescription>
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

      <Card className="ops-hero-card bg-white/95">
        <CardHeader>
          <CardTitle className="text-2xl text-slate-950">Create your first plan</CardTitle>
          <CardDescription>One simple path gets a brand-new workspace into a usable state quickly.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {steps.map((step, index) => (
            <div key={step} className="ops-soft-card grid grid-cols-[auto_1fr] items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{index + 1}</div>
              <strong className="text-sm font-semibold text-slate-900">{step}</strong>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
