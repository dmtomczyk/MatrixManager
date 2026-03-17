import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import LoginPage from './components/LoginPage';
import GetStartedPage from './components/GetStartedPage';
import CanvasPage from './components/CanvasPage';
import DashboardPage from './components/DashboardPage';
import ForecastPage from './components/ForecastPage';
import AppShell from './components/AppShell';
import { readBootPayload, type AuthenticatedPageProps, type LoginPageProps } from './lib/utils';
import './styles.css';

const { page, props } = readBootPayload();

function App() {
  if (page === 'login') return <LoginPage {...(props as LoginPageProps)} />;

  const authenticatedProps = props as AuthenticatedPageProps;
  const shellProps = {
    currentUser: authenticatedProps.currentUser || 'unknown',
    currentPath: authenticatedProps.currentPath || '/',
  };

  if (page === 'canvas') {
    return (
      <AppShell {...shellProps}>
        <ReactFlowProvider>
          <CanvasPage />
        </ReactFlowProvider>
      </AppShell>
    );
  }

  if (page === 'dashboard') {
    return (
      <AppShell {...shellProps}>
        <DashboardPage {...authenticatedProps} currentUser={shellProps.currentUser} />
      </AppShell>
    );
  }

  if (page === 'forecast') {
    return (
      <AppShell {...shellProps}>
        <ForecastPage {...authenticatedProps} currentUser={shellProps.currentUser} />
      </AppShell>
    );
  }

  return (
    <AppShell {...shellProps}>
      <GetStartedPage />
    </AppShell>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
