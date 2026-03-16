import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

export default function LoginPage({ error = '', next = '/', logoHref = '', githubUrl = '' }) {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-12rem)] w-full max-w-6xl grid-cols-1 items-center gap-6 px-4 py-8 lg:grid-cols-[1.15fr_0.85fr]">
      <Card className="border-slate-200/90 bg-white/90 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Operations planning</p>
          <CardTitle className="max-w-lg text-4xl tracking-tight text-slate-950">Staff planning without the spreadsheet sprawl.</CardTitle>
          <CardDescription className="max-w-xl text-base leading-7">
            Matrix Manager keeps organizations, people, projects, and assignments in one operating view so planning conversations stay grounded in the same data.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {[
            ['Organizations', 'Keep reporting structure and home teams clear.'],
            ['Projects', 'Track demand windows and staffing pressure over time.'],
            ['Assignments', 'Connect people to work with dates and allocation.'],
          ].map(([title, copy]) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-950">{title}</h3>
              <p className="text-sm leading-6 text-slate-600">{copy}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-slate-200/90 bg-white/95 backdrop-blur-sm">
        <CardHeader className="items-center text-center">
          {logoHref ? <img src={logoHref} alt="Matrix Management" className="mb-3 h-16 w-16" /> : null}
          <CardTitle className="text-3xl text-slate-950">Matrix Manager</CardTitle>
          <CardDescription className="text-base">Sign in to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div> : null}
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
            <Button type="submit" className="mt-1 w-full">Sign in</Button>
          </form>
          {githubUrl ? (
            <a href={githubUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
              GitHub
            </a>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
