type BootPage = 'login' | 'home' | 'canvas' | 'dashboard' | 'forecast';

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

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
${headScripts}
  </head>
  <body>
    <div id="root" data-page="${page}"></div>
    <script id="mm-react-props" type="application/json">${escapeJsonForHtml(props)}</script>
    <script type="module" src="${appScript}"></script>
  </body>
</html>`;
}
