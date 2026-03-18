import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type BootPage = 'login' | 'getStarted' | 'roadmap' | 'canvas' | 'dashboard' | 'forecast' | 'orgs' | 'jobCodes' | 'employees' | 'projects' | 'demands' | 'assignments' | 'accountSettings' | 'inbox' | 'users' | 'audit' | 'runtime' | 'dbManagement';

export interface LoginPageProps {
  error?: string;
  next?: string;
  logoHref?: string;
  githubUrl?: string;
}

export interface AuthenticatedPageProps {
  currentUser?: string;
  currentPath?: string;
  flash?: string;
}

export interface BootPayload {
  page: BootPage;
  props: Record<string, unknown>;
}

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function readBootPayload(): BootPayload {
  const root = document.getElementById('root');
  const script = document.getElementById('mm-react-props');
  let props: Record<string, unknown> = {};

  if (script?.textContent) {
    try {
      props = JSON.parse(script.textContent) as Record<string, unknown>;
    } catch {
      props = {};
    }
  }

  const pageAttr = root?.dataset.page;
  const page: BootPage = pageAttr === 'login' || pageAttr === 'getStarted' || pageAttr === 'roadmap' || pageAttr === 'canvas' || pageAttr === 'dashboard' || pageAttr === 'forecast' || pageAttr === 'orgs' || pageAttr === 'jobCodes' || pageAttr === 'employees' || pageAttr === 'projects' || pageAttr === 'demands' || pageAttr === 'assignments' || pageAttr === 'accountSettings' || pageAttr === 'inbox' || pageAttr === 'users' || pageAttr === 'audit' || pageAttr === 'runtime' || pageAttr === 'dbManagement' ? pageAttr : 'getStarted';

  return {
    page,
    props,
  };
}
