import * as React from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import type { LoginPageProps } from '../lib/utils';

const summaryItems = [
  {
    label: 'Organizations',
    value: 'Structure',
    body: 'Anchor people inside durable reporting homes.',
  },
  {
    label: 'Projects',
    value: 'Demand',
    body: 'Represent the work that needs staffing over time.',
  },
  {
    label: 'Assignments',
    value: 'Execution',
    body: 'Connect people to work with dates and allocation.',
  },
] as const;

export default function LoginPage({ error = '', next = '/', logoHref = '', githubUrl = '' }: LoginPageProps) {
  return (
    <main className="mx-auto flex w-full max-w-[min(100%,calc(100vw-2rem))] flex-col gap-6 px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_380px] lg:items-start">
        <section className="space-y-6">
          <div className="space-y-4">
            <Badge variant="secondary" className="rounded-md px-3 py-1 text-[0.72rem] uppercase tracking-[0.18em] text-slate-700">
              Matrix Manager
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Staffing and project planning in one operational workspace.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600">
                Keep organizational structure, people, projects, and assignments in the same system so planning stays visible and decisions stay grounded in current data.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {summaryItems.map((item) => (
              <Card key={item.label} className="border-slate-200 shadow-sm">
                <CardHeader className="space-y-2 pb-3">
                  <CardDescription className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {item.label}
                  </CardDescription>
                  <CardTitle className="text-xl text-slate-950">{item.value}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-slate-600">{item.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-slate-200 bg-slate-50/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-slate-950">What this app is for</CardTitle>
              <CardDescription>Use it to model the business first, then plan the work against that model.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm leading-6 text-slate-600 sm:grid-cols-2">
              <p>Start with organizations and roles so the structure is clear before staffing begins.</p>
              <p>Add employees and projects next, then use assignments to represent who is working on what and for how much capacity.</p>
            </CardContent>
          </Card>
        </section>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              {logoHref ? <img src={logoHref} alt="Matrix Management" className="h-10 w-10 rounded-md border border-slate-200 bg-white p-1.5" /> : null}
              <div>
                <CardTitle className="text-2xl text-slate-950">Sign in</CardTitle>
                <CardDescription>Open the current planning workspace.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div> : null}
            <form method="post" action="/login" className="grid gap-4">
              <input type="hidden" name="next" value={next} />
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" name="username" autoComplete="username" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
              </div>
              <Button type="submit" className="w-full">Sign in</Button>
            </form>
            <Separator />
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Project</p>
              {githubUrl ? (
                <Button asChild variant="outline" className="w-full justify-center">
                  <a href={githubUrl} target="_blank" rel="noreferrer">View source on GitHub</a>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
