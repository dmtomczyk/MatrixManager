import { renderAppChrome } from './chrome.js';

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const setupItems = [
  {
    title: 'Organizations',
    href: '/orgs',
    description: 'Create the structural homes for teams and reporting lines.'
  },
  {
    title: 'Job Codes',
    href: '/job-codes',
    description: 'Define role types and leadership eligibility.'
  },
  {
    title: 'Employees',
    href: '/people',
    description: 'Add people and place them into the organization model.'
  },
  {
    title: 'Projects',
    href: '/planning',
    description: 'Represent work demand that requires staffing.'
  },
  {
    title: 'Assignments',
    href: '/staffing',
    description: 'Connect people to work using timing and allocation.'
  }
] as const;

export function buildGetStartedPage(currentUser: string): string {
  const chrome = renderAppChrome(currentUser, '/');
  const cards = setupItems.map((item) => `
    <a class="card" href="${item.href}">
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description)}</p>
      <span>Open →</span>
    </a>
  `).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Matrix Manager</title>
    ${chrome.head}
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #f8fafc; color: #0f172a; }
      ${chrome.css}
      .wrap { width: min(calc(100vw - 2rem), 1600px); max-width: none; margin: 0 auto; padding: 32px 16px 48px; }
      .eyebrow { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #e2e8f0; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #334155; }
      h1 { margin: 16px 0 12px; font-size: 48px; line-height: 1.05; max-width: 800px; }
      .lead { max-width: 760px; color: #475569; font-size: 18px; line-height: 1.7; }
      .meta { margin-top: 16px; color: #64748b; font-size: 14px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 28px; }
      .card { display: block; text-decoration: none; color: inherit; background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05); }
      .card h3 { margin: 0 0 10px; font-size: 20px; }
      .card p { margin: 0 0 16px; color: #475569; line-height: 1.6; }
      .card span { color: #0f172a; font-weight: 600; }
      .order { margin-top: 28px; background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; }
      .order h2 { margin: 0 0 14px; font-size: 24px; }
      .order ol { margin: 0; padding-left: 20px; color: #334155; line-height: 1.8; }
    </style>
  </head>
  <body>
    ${chrome.html}
    <main class="wrap">
      <span class="eyebrow">Get Started</span>
      <h1>Build the planning model in the right order.</h1>
      <p class="lead">Start with the organization structure, define roles, add people, create projects, and then assign work. This gets you to a usable staffing plan fastest.</p>
      <div class="meta">Signed in as <strong>${escapeHtml(currentUser)}</strong></div>
      <div class="grid">${cards}</div>
      <section class="order">
        <h2>Recommended setup sequence</h2>
        <ol>
          <li>Create organizations so every person has a structural home.</li>
          <li>Add job codes before people so role data stays consistent.</li>
          <li>Create employees and reporting lines once the structure exists.</li>
          <li>Create projects after the people model is in place.</li>
          <li>Use assignments to represent who is doing what, when, and at what allocation.</li>
        </ol>
      </section>
    </main>
  </body>
</html>`;
}
