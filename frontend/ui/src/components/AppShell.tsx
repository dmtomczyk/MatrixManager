import * as React from 'react';
import { Button } from './ui/button';

interface AppShellProps {
  currentUser: string;
  currentPath: string;
  children: React.ReactNode;
}

const primaryLinks = [
  { href: '/', label: 'Get Started' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/canvas', label: 'Canvas' },
] as const;

const planningLinks = [
  { href: '/planning', label: 'Projects' },
  { href: '/forecast', label: 'Forecast' },
  { href: '/demands', label: 'Demands' },
  { href: '/staffing', label: 'Assignments' },
] as const;

const workforceLinks = [
  { href: '/orgs', label: 'Organizations' },
  { href: '/people', label: 'Employees' },
  { href: '/job-codes', label: 'Job Codes' },
] as const;

const adminLinks = [
  { href: '/users', label: 'Users' },
  { href: '/audit', label: 'Audit' },
  { href: '/runtime', label: 'Runtime' },
  { href: '/db-management', label: 'DB Management' },
] as const;

function LinkGroup({ label, links, currentPath }: { label: string; links: readonly { href: string; label: string }[]; currentPath: string }) {
  const isActive = links.some((link) => link.href === currentPath);

  return (
    <details className="relative">
      <summary className={`flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 ${isActive ? 'bg-slate-100 text-slate-900' : ''}`}>
        <span>{label}</span>
        <span className="text-xs text-slate-400">▾</span>
      </summary>
      <div className="absolute left-0 top-full z-20 mt-2 min-w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className={`block rounded-md px-3 py-2 text-sm transition hover:bg-slate-100 ${link.href === currentPath ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600'}`}
          >
            {link.label}
          </a>
        ))}
      </div>
    </details>
  );
}

export default function AppShell({ currentUser, currentPath, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[min(100%,calc(100vw-1rem))] items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <a href="/" className="inline-flex shrink-0 items-center gap-[10px] rounded-xl px-[10px] py-2 text-slate-950 transition hover:bg-slate-50">
              <img src="/static/images/matrix-manager-favicon.svg" alt="" className="h-8 w-8 rounded-lg border border-slate-200 bg-white p-1" />
              <span className="flex flex-col leading-[1]">
                <span className="text-[15px] font-bold tracking-[-0.01em] text-slate-950">Matrix Manager</span>
                <span className="mt-[2px] text-[11px] uppercase tracking-[0.08em] text-slate-400 max-[900px]:hidden">Planning Workspace</span>
              </span>
            </a>
            <nav className="hidden items-center gap-1 md:flex">
              {primaryLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition hover:bg-slate-100 hover:text-slate-900 ${link.href === currentPath ? 'bg-slate-100 text-slate-900' : 'text-slate-600'}`}
                >
                  {link.label}
                </a>
              ))}
              <LinkGroup label="Planning" links={planningLinks} currentPath={currentPath} />
              <LinkGroup label="Workforce" links={workforceLinks} currentPath={currentPath} />
              <LinkGroup label="Admin" links={adminLinks} currentPath={currentPath} />
            </nav>
          </div>

          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:bg-slate-50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {currentUser.slice(0, 1).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Signed in as</div>
                <div className="text-sm font-medium text-slate-900">{currentUser}</div>
              </div>
            </summary>
            <div className="absolute right-0 top-full z-20 mt-2 min-w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              <a href="/inbox" className="block rounded-md px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100">Inbox</a>
              <a href="/account-settings" className="block rounded-md px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100">Account Settings</a>
              <a href="/users" className="block rounded-md px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100">Users</a>
              <a href="/audit" className="block rounded-md px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100">Audit</a>
              <a href="/runtime" className="block rounded-md px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100">Runtime</a>
              <a href="/db-management" className="block rounded-md px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100">DB Management</a>
              <div className="my-2 h-px bg-slate-200" />
              <form method="post" action="/logout">
                <Button type="submit" variant="outline" className="w-full justify-center">Log out</Button>
              </form>
            </div>
          </details>
        </div>
      </header>

      {children}

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-2 py-2 text-sm text-slate-600 shadow-sm backdrop-blur">
          <a href="/roadmap" className={`rounded-full px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-900 ${currentPath === '/roadmap' ? 'font-medium text-slate-900' : ''}`}>Roadmap</a>
          <a href="https://github.com/dmtomczyk/matrixmanager" target="_blank" rel="noreferrer" className="rounded-full px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-900">GitHub</a>
        </div>
      </div>
    </div>
  );
}
