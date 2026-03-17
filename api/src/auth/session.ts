import crypto from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { getConfig } from '../config.js';

export const SESSION_COOKIE_NAME = 'matrixmanager_session';

function getSecret(): string {
  const config = getConfig();
  return config.authSecret || `${config.authUsername}:${config.authPassword}`;
}

export function signSessionValue(username: string): string {
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(username)
    .digest('hex');
  return `${username}:${signature}`;
}

export function verifySessionValue(cookieValue?: string): boolean {
  if (!cookieValue || !cookieValue.includes(':')) return false;
  const [username, providedSignature] = cookieValue.split(':', 2);
  if (!username || !providedSignature) return false;
  const expected = signSessionValue(username);
  const [, expectedSignature] = expected.split(':', 2);
  return crypto.timingSafeEqual(Buffer.from(providedSignature), Buffer.from(expectedSignature));
}

export function getSessionUsername(request: FastifyRequest): string | null {
  const raw = request.cookies[SESSION_COOKIE_NAME];
  if (!verifySessionValue(raw)) return null;
  return raw!.split(':', 1)[0] ?? null;
}

export function isAuthenticated(request: FastifyRequest): boolean {
  return getSessionUsername(request) !== null;
}
