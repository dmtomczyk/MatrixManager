function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildLoginPage(params: {
  error?: string;
  next?: string;
  logoHref?: string;
  githubUrl?: string;
} = {}): string {
  const error = params.error ? `<div class="error">${escapeHtml(params.error)}</div>` : '';
  const next = escapeHtml(params.next ?? '/');
  const logo = params.logoHref ? `<img src="${escapeHtml(params.logoHref)}" alt="Matrix Manager" class="logo" />` : '';
  const github = params.githubUrl ? `<a class="secondary" href="${escapeHtml(params.githubUrl)}" target="_blank" rel="noreferrer">View source on GitHub</a>` : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Matrix Manager · Login</title>
    <link rel="icon" href="/static/images/matrix-manager-favicon.ico" sizes="any" />
    <link rel="icon" type="image/svg+xml" href="/static/images/matrix-manager-favicon.svg" />
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #f8fafc; color: #0f172a; }
      .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      .layout { width: 100%; max-width: 1120px; display: grid; gap: 24px; grid-template-columns: minmax(0, 1.15fr) 380px; }
      .hero { display: grid; gap: 24px; }
      .eyebrow { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #e2e8f0; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #334155; }
      h1 { margin: 0; font-size: 52px; line-height: 1.04; max-width: 760px; }
      .lead { margin: 0; max-width: 720px; color: #475569; font-size: 18px; line-height: 1.7; }
      .grid { display: grid; gap: 16px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .tile, .panel, .card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05); }
      .tile, .panel { padding: 20px; }
      .tile small, .muted { color: #64748b; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; font-weight: 700; }
      .tile strong { display: block; margin-top: 10px; font-size: 22px; }
      .tile p, .panel p { color: #475569; line-height: 1.6; }
      .card { padding: 28px; }
      .top { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
      .logo { width: 40px; height: 40px; border-radius: 10px; border: 1px solid #e2e8f0; background: white; padding: 6px; }
      h2 { margin: 0 0 4px; font-size: 28px; }
      .desc { margin: 0; color: #64748b; }
      label { display: block; margin: 14px 0 6px; font-size: 14px; font-weight: 600; }
      input { width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font: inherit; }
      button, .secondary { display: inline-flex; justify-content: center; align-items: center; width: 100%; margin-top: 18px; padding: 12px 14px; border-radius: 10px; font-weight: 700; font: inherit; text-decoration: none; }
      button { border: 0; background: #0f172a; color: white; cursor: pointer; }
      .secondary { border: 1px solid #cbd5e1; background: white; color: #334155; margin-top: 16px; }
      .error { margin-bottom: 16px; border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; border-radius: 10px; padding: 12px 14px; }
      @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } .grid { grid-template-columns: 1fr; } h1 { font-size: 40px; } }
    </style>
  </head>
  <body>
    <main class="wrap">
      <div class="layout">
        <section class="hero">
          <div>
            <span class="eyebrow">Matrix Manager</span>
            <h1>Staffing and project planning in one operational workspace.</h1>
            <p class="lead">Keep organizational structure, people, projects, and assignments in the same system so planning stays visible and decisions stay grounded in current data.</p>
          </div>
          <div class="grid">
            <div class="tile"><small>Organizations</small><strong>Structure</strong><p>Anchor people inside durable reporting homes.</p></div>
            <div class="tile"><small>Projects</small><strong>Demand</strong><p>Represent the work that needs staffing over time.</p></div>
            <div class="tile"><small>Assignments</small><strong>Execution</strong><p>Connect people to work with dates and allocation.</p></div>
          </div>
          <div class="panel">
            <small class="muted">What this app is for</small>
            <p>Use it to model the business first, then plan the work against that model. Start with organizations and roles, add employees and projects next, then use assignments to represent who is working on what and for how much capacity.</p>
          </div>
        </section>
        <section class="card">
          <div class="top">
            ${logo}
            <div>
              <h2>Sign in</h2>
              <p class="desc">Open the current planning workspace.</p>
            </div>
          </div>
          ${error}
          <form method="post" action="/login">
            <input type="hidden" name="next" value="${next}" />
            <label for="username">Username</label>
            <input id="username" name="username" autocomplete="username" required />
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required />
            <button type="submit">Sign in</button>
          </form>
          ${github}
        </section>
      </div>
    </main>
  </body>
</html>`;
}
