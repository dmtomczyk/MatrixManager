function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildLoginPage(options: { error?: string; next?: string } = {}): string {
  const error = options.error ? `<div style="margin-bottom:16px;padding:12px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:8px;">${escapeHtml(options.error)}</div>` : '';
  const next = escapeHtml(options.next ?? '/');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Matrix Manager Login</title>
    <style>
      body { font-family: Inter, system-ui, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; }
      .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      .card { width: 100%; max-width: 420px; background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
      h1 { margin: 0 0 8px; font-size: 28px; }
      p { margin: 0 0 20px; color: #475569; }
      label { display: block; font-size: 14px; font-weight: 600; margin: 14px 0 6px; }
      input { width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; }
      button { width: 100%; margin-top: 18px; padding: 12px 14px; border: 0; border-radius: 10px; background: #0f172a; color: white; font-weight: 700; cursor: pointer; }
      .hint { margin-top: 14px; font-size: 12px; color: #64748b; }
      code { background: #f1f5f9; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <main class="wrap">
      <div class="card">
        <h1>Sign in</h1>
        <p>TypeScript API migration login flow.</p>
        ${error}
        <form method="post" action="/login">
          <input type="hidden" name="next" value="${next}" />
          <label for="username">Username</label>
          <input id="username" name="username" autocomplete="username" required />
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
          <button type="submit">Sign in</button>
        </form>
        <div class="hint">Uses <code>MATRIX_AUTH_USERNAME</code> and <code>MATRIX_AUTH_PASSWORD</code> from <code>.env</code>.</div>
      </div>
    </main>
  </body>
</html>`;
}
