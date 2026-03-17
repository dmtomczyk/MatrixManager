import * as React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import type { LoginPageProps } from '../lib/utils';

const highlights = [
  {
    title: 'Organizations',
    copy: 'Keep reporting lines and home teams grounded in one source of truth.',
  },
  {
    title: 'Projects',
    copy: 'Track work demand with dates, staffing pressure, and real planning context.',
  },
  {
    title: 'Assignments',
    copy: 'Connect people to work with allocation, timing, and manager visibility.',
  },
] as const;

export default function LoginPage({ error = '', next = '/', logoHref = '', githubUrl = '' }: LoginPageProps) {
  return (
    <main className="ops-login-shell">
      <section className="ops-login-panel">
        <p className="ops-kicker">Matrix Manager</p>
        <h1 className="ops-login-title">Plan staffing like an operating system, not a spreadsheet.</h1>
        <p className="ops-login-copy">
          Matrix Manager gives organizations, people, projects, and assignments a single planning model so staffing conversations stay clear, auditable, and aligned.
        </p>
        <div className="ops-login-feature-grid">
          {highlights.map((item) => (
            <article key={item.title} className="ops-login-feature">
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <Card className="ops-signin-card">
        <CardHeader className="items-center text-center">
          {logoHref ? <img src={logoHref} alt="Matrix Management" className="mb-2 h-14 w-14" /> : null}
          <CardTitle className="text-[2rem] tracking-tight text-slate-950">Sign in</CardTitle>
          <CardDescription className="max-w-sm text-[0.95rem] leading-6">
            Access the current planning workspace and continue where you left off.
          </CardDescription>
        </CardHeader>
        <CardContent className="ops-signin-actions">
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
            <Button type="submit" className="mt-1 w-full">Sign in</Button>
          </form>
          {githubUrl ? (
            <a href={githubUrl} target="_blank" rel="noreferrer" className="ops-subtle-link">
              View project on GitHub
            </a>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
