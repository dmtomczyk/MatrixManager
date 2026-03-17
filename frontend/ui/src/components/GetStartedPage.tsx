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
  { label: 'Organizations', href: '/orgs', description: 'Create the team structure and reporting homes first.' },
  { label: 'Job Codes', href: '/job-codes', description: 'Define roles, leadership eligibility, and staffing categories.' },
  { label: 'Employees', href: '/people', description: 'Add people, assign them to orgs, and establish managers.' },
  { label: 'Projects', href: '/planning', description: 'Create the work that needs capacity across the business.' },
  { label: 'Assignments', href: '/staffing', description: 'Connect employees to projects with dates and allocation.' },
];

const steps = [
  'Start with organizations so every person has a home.',
  'Add job codes before creating employees, so role data stays consistent.',
  'Create employees and reporting lines once the structure is in place.',
  'Create projects after the people model exists.',
  'Use assignments to represent who is doing what, when, and how much.',
] as const;

export default function GetStartedPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-end">
        <div className="space-y-5">
          <Badge variant="secondary" className="rounded-md px-3 py-1 text-[0.72rem] uppercase tracking-[0.18em] text-slate-700">
            Get Started
          </Badge>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
              Build the planning model in the right order.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Matrix Manager gets much easier once you establish structure first, then people, then work demand. This page is the fastest path to a usable workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href="/orgs">Start with organizations</a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="/planning">Open projects</a>
            </Button>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-slate-950">Recommended order</CardTitle>
            <CardDescription>Follow this sequence once and the rest of the app will make sense much faster.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {steps.map((step, index) => (
              <div key={step} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <p className="pt-1 text-sm leading-6 text-slate-700">{step}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Core setup areas</h2>
          <p className="text-sm leading-6 text-slate-600">
            Jump directly into the part of setup you need, or work through them top to bottom.
          </p>
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
