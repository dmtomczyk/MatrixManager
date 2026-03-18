import * as React from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';

type QuickLink = {
  label: string;
  href: string;
  description: string;
  group: 'Workforce' | 'Planning' | 'Admin';
};

const quickLinks: QuickLink[] = [
  { label: 'Organizations', href: '/orgs', description: 'Create the structural homes for teams and reporting.', group: 'Workforce' },
  { label: 'Job Codes', href: '/job-codes', description: 'Define role types and leadership eligibility.', group: 'Workforce' },
  { label: 'Employees', href: '/people', description: 'Add people and place them into the organization model.', group: 'Workforce' },
  { label: 'Projects', href: '/planning', description: 'Represent work demand that requires staffing.', group: 'Planning' },
  { label: 'Forecast', href: '/forecast', description: 'Review portfolio demand versus assigned capacity.', group: 'Planning' },
  { label: 'Assignments', href: '/staffing', description: 'Connect people to work using timing and allocation.', group: 'Planning' },
  { label: 'Canvas', href: '/canvas', description: 'Use the visual planning surface for structure and assignment flow.', group: 'Planning' },
  { label: 'Users', href: '/users', description: 'Manage sign-ins and employee-linked accounts.', group: 'Admin' },
  { label: 'Runtime', href: '/runtime', description: 'Check service/runtime health and recent operational signals.', group: 'Admin' },
];

const setupSequence = [
  'Create organizations so every person has a structural home.',
  'Add job codes before people so role data stays consistent.',
  'Create employees and reporting lines once the structure exists.',
  'Create projects after the people model is in place.',
  'Use assignments to represent who is doing what, when, and at what allocation.',
] as const;

const summaryStats = [
  { label: 'Workforce setup', value: '3 areas', detail: 'Organizations, job codes, and employees.' },
  { label: 'Planning flow', value: '4 views', detail: 'Projects, forecast, assignments, and canvas.' },
  { label: 'Best sequence', value: '5 steps', detail: 'Follow the setup order once for the cleanest model.' },
  { label: 'Admin tools', value: '3 areas', detail: 'Users, runtime, and db controls when needed.' },
] as const;

const groupedLinks = [
  { label: 'Workforce', description: 'Structure and people setup.', links: quickLinks.filter((link) => link.group === 'Workforce') },
  { label: 'Planning', description: 'Demand, assignment, and canvas workflows.', links: quickLinks.filter((link) => link.group === 'Planning') },
  { label: 'Admin', description: 'Account and operational controls.', links: quickLinks.filter((link) => link.group === 'Admin') },
] as const;

export default function GetStartedPage() {
  return (
    <main className="mx-auto flex w-full max-w-[min(100%,calc(100vw-2rem))] flex-col gap-6 px-4 py-8">
      <section className="space-y-4">
        <Badge variant="secondary" className="rounded-md px-3 py-1 text-[0.72rem] uppercase tracking-[0.18em] text-slate-700">
          Get Started
        </Badge>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Build the planning model in the right order.
            </h1>
            <p className="max-w-3xl text-base leading-7 text-slate-600">
              Matrix Manager works best when you establish structure first, then people, then project demand. This page now acts more like the rest of the app: one operational home for setup, navigation, and next actions.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <a href="/orgs">Start with organizations</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/canvas">Open canvas</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/dashboard">Open dashboard</a>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryStats.map((stat) => (
          <Card key={stat.label} className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{stat.label}</CardDescription>
              <CardTitle className="text-3xl text-slate-950">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm leading-6 text-slate-600">{stat.detail}</CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl text-slate-950">Recommended setup sequence</CardTitle>
            <CardDescription>Work top to bottom once, and the rest of the application becomes easier to navigate and maintain.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {setupSequence.map((step, index) => (
              <div key={step} className="flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <p className="pt-0.5 text-sm leading-6 text-slate-700">{step}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl text-slate-950">Navigation map</CardTitle>
            <CardDescription>The main route groups you’ll use most often once the app is populated.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm leading-6 text-slate-600">
            {groupedLinks.map((group, index) => (
              <React.Fragment key={group.label}>
                {index ? <Separator /> : null}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">{group.label}</h3>
                    <p className="mt-1 text-sm text-slate-600">{group.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.links.map((link) => (
                      <Button key={link.href} asChild variant="outline" size="sm">
                        <a href={link.href}>{link.label}</a>
                      </Button>
                    ))}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Core setup areas</h2>
          <p className="text-sm leading-6 text-slate-600">Jump directly into the area you need, with the same card/button treatment used throughout the rest of the React app.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((link) => (
            <Card key={link.href} className="border-slate-200 shadow-sm transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <CardDescription className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{link.group}</CardDescription>
                <CardTitle className="text-lg text-slate-950">{link.label}</CardTitle>
                <CardDescription className="text-sm leading-6">{link.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full justify-center">
                  <a href={link.href}>Open {link.label}</a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
