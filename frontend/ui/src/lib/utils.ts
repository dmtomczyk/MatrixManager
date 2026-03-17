import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type BootPage = 'login' | 'home' | 'canvas';

export interface LoginPageProps {
  error?: string;
  next?: string;
  logoHref?: string;
  githubUrl?: string;
}

export interface AuthenticatedPageProps {
  currentUser?: string;
  currentPath?: string;
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
  const page: BootPage = pageAttr === 'login' || pageAttr === 'canvas' ? pageAttr : 'home';

  return {
    page,
    props,
  };
}
