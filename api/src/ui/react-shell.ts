type BootPage = 'login' | 'home' | 'canvas' | 'dashboard' | 'forecast' | 'orgs' | 'jobCodes' | 'employees' | 'projects' | 'demands' | 'assignments' | 'accountSettings' | 'inbox' | 'users' | 'audit' | 'runtime' | 'dbManagement';

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

export function buildReactPage(params: {
  page: BootPage;
  title: string;
  props: Record<string, unknown>;
  uiDevUrl: string;
  useDevServer?: boolean;
}): string {
  const { page, title, props, uiDevUrl, useDevServer = false } = params;
  const cleanUiDevUrl = uiDevUrl.replace(/\/$/, '');
  const headScripts = useDevServer
    ? `
    <script type="module">
      import RefreshRuntime from "${cleanUiDevUrl}/@react-refresh";
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
    </script>
    <script type="module" src="${cleanUiDevUrl}/@vite/client"></script>`
    : '    <link rel="stylesheet" href="/static/ui-react/ui-react.css" />';
  const appScript = useDevServer
    ? `${cleanUiDevUrl}/src/main.tsx`
    : '/static/ui-react/ui-react.js';
  const devHint = useDevServer
    ? `
    <script>
      window.addEventListener('error', function (event) {
        const target = event && event.target;
        if (target && target.tagName === 'SCRIPT') {
          const note = document.getElementById('mm-react-dev-hint');
          if (note) note.hidden = false;
        }
      }, true);
    </script>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="icon" href="/static/images/matrix-manager-favicon.ico" sizes="any" />
    <link rel="icon" type="image/svg+xml" href="/static/images/matrix-manager-favicon.svg" />
${headScripts}
  </head>
  <body>
    <div id="root" data-page="${page}"></div>
    <div id="mm-react-dev-hint" hidden style="max-width:960px;margin:24px auto 0;padding:12px 16px;border:1px solid #fecaca;background:#fff1f2;color:#991b1b;border-radius:12px;font-family:Inter,system-ui,sans-serif;">
      React dev assets failed to load. If you're using <code>npm run dev</code>, make sure the frontend dev server is up on <code>${escapeHtml(cleanUiDevUrl)}</code>.
    </div>
    <script id="mm-react-props" type="application/json">${escapeJsonForHtml(props)}</script>
    <script type="module" src="${appScript}"></script>${devHint}
  </body>
</html>`;
}
