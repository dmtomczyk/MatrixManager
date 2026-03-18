import { renderAppChrome } from './chrome.js';

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildErrorPage(params: {
  title: string;
  heading: string;
  message: string;
  currentUser?: string;
  currentPath?: string;
  statusCode?: number;
}): string {
  const currentUser = params.currentUser ?? 'guest';
  const currentPath = params.currentPath ?? '/';
  const chrome = renderAppChrome(currentUser, currentPath);
  const status = params.statusCode ? `<div class="status">Error ${params.statusCode}</div>` : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(params.title)}</title>
    ${chrome.head}
    <style>
      *{box-sizing:border-box} body{margin:0;font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#0f172a}
      ${chrome.css}
      .wrap{width:min(calc(100vw - 2rem),1600px);max-width:none;margin:0 auto;padding:32px 16px 48px}
      .card{max-width:960px;background:white;border:1px solid #e2e8f0;border-radius:18px;padding:28px;box-shadow:0 10px 30px rgba(15,23,42,.05)}
      .status{display:inline-block;margin-bottom:14px;padding:6px 10px;border-radius:999px;background:#e2e8f0;color:#334155;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
      h1{margin:0 0 10px;font-size:40px;line-height:1.05}
      p{margin:0;color:#475569;line-height:1.7;font-size:17px}
      .actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}
      .actions a{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border:1px solid #cbd5e1;background:white;color:#334155;padding:11px 14px;border-radius:10px;font-weight:600}
      .actions a.primary{background:#0f172a;color:white;border-color:#0f172a}
    </style>
  </head>
  <body>
    ${chrome.html}
    <main class="wrap">
      <section class="card">
        ${status}
        <h1>${escapeHtml(params.heading)}</h1>
        <p>${escapeHtml(params.message)}</p>
        <div class="actions">
          <a class="primary" href="/">Go to Get Started</a>
          <a href="/orgs">Organizations</a>
          <a href="/people">Employees</a>
        </div>
      </section>
    </main>
  </body>
</html>`;
}
