import * as React from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';

interface QuickLink {
  label: string;
  href: string;
  description: string;
}

const quickLinks: QuickLink[] = [
  { label: 'Organizations', href: '/orgs', description: 'Create the structural homes for teams and reporting.' },
  { label: 'Job Codes', href: '/job-codes', description: 'Define role types and leadership eligibility.' },
  { label: 'Employees', href: '/people', description: 'Add people and place them into the organization model.' },
  { label: 'Projects', href: '/planning', description: 'Represent work demand that requires staffing.' },
  { label: 'Assignments', href: '/staffing', description: 'Connect people to work using timing and allocation.' },
];

const setupSequence = [
  'Create organizations so every person has a structural home.',
  'Add job codes before people so role data stays consistent.',
  'Create employees and reporting lines once the structure exists.',
  'Create projects after the people model is in place.',
  'Use assignments to represent who is doing what, when, and at what allocation.',
] as const;

const notes = [
  'Structure first',
  'People second',
  'Work demand third',
  'Assignments last',
] as const;

export default function GetStartedPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <section className="space-y-4">
        <Badge variant="secondary" className="rounded-md px-3 py-1 text-[0.72rem] uppercase tracking-[0.18em] text-slate-700">
          Get Started
        </Badge>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Build the planning model in the right order.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600">
              Matrix Manager works best when you establish structure first, then people, then project demand. This page is the fastest way to get a new workspace into a useful state.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <a href="/orgs">Start with organizations</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/planning">Open projects</a>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {notes.map((note) => (
          <Card key={note} className="border-slate-200 bg-slate-50/60 shadow-sm">
            <CardContent className="flex items-center justify-between p-5">
              <span className="text-sm font-medium text-slate-700">{note}</span>
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl text-slate-950">Recommended setup sequence</CardTitle>
            <CardDescription>Work top to bottom once, and the rest of the application will become easier to navigate.</CardDescription>
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
            <CardTitle className="text-2xl text-slate-950">Why this order works</CardTitle>
            <CardDescription>Each step reduces ambiguity in the next one.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-slate-600">
            <p>
              Organizations define the structural model. Job codes define the role model. Employees populate both. Projects then represent demand, and assignments map people onto that demand.
            </p>
            <Separator />
            <p>
              If you skip ahead and create assignments before the foundation exists, the rest of the plan gets harder to read and maintain.
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Core setup areas</h2>
          <p className="text-sm leading-6 text-slate-600">Jump directly into the part of setup you need, or work through them from left to right.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((link) => (
            <Card key={link.href} className="border-slate-200 shadow-sm transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
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
