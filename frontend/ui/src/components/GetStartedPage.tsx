import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface QuickLink {
  label: string;
  href: string;
  description: string;
}

const quickLinks: QuickLink[] = [
  { label: 'Organizations', href: '/orgs', description: 'Create the structural homes for your teams.' },
  { label: 'Job Codes', href: '/job-codes', description: 'Define roles and leadership eligibility.' },
  { label: 'Employees', href: '/people', description: 'Add people and place them into organizations.' },
  { label: 'Projects', href: '/planning', description: 'Represent the work that needs staffing.' },
  { label: 'Assignments', href: '/staffing', description: 'Connect employees to projects over time.' },
];

const steps: string[] = [
  'Create your organizations',
  'Define job codes and leadership roles',
  'Add employees and reporting lines',
  'Create projects with timing',
  'Assign people to project work',
  'Review staffing in Canvas and Forecast',
];

export default function GetStartedPage() {
  return (
    <main className="ops-page flex flex-col gap-6">
      <section className="ops-home-simple-hero">
        <div className="ops-home-simple-copy">
          <p className="ops-kicker">Get Started</p>
          <h1 className="ops-home-simple-title">Set up the planning model in a few clean steps.</h1>
          <p className="ops-home-simple-body">
            Matrix Manager works best when you start with structure first, then people, then project demand. Once those pieces are in place, the rest of the app becomes much easier to use.
          </p>
        </div>
      </section>

      <div className="ops-home-simple-grid">
        <Card className="ops-hero-card">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-950">Recommended order</CardTitle>
            <CardDescription>Follow this once and the rest of the workspace will make sense.</CardDescription>
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

        <Card className="ops-hero-card">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-950">Start building</CardTitle>
            <CardDescription>Jump directly into the part of setup you need.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {quickLinks.map((link) => (
              <a key={link.href} href={link.href} className="ops-link-card ops-link-card-stacked">
                <div>
                  <div className="ops-link-card-title">{link.label}</div>
                  <div className="ops-link-card-copy">{link.description}</div>
                </div>
                <span className="ops-link-card-cta">Open</span>
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
