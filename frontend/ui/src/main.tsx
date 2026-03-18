import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import LoginPage from './components/LoginPage';
import GetStartedPage from './components/GetStartedPage';
import RoadmapPage from './components/RoadmapPage';
import CanvasPage from './components/CanvasPage';
import DashboardPage from './components/DashboardPage';
import ForecastPage from './components/ForecastPage';
import AppShell from './components/AppShell';
import { OrganizationsPage, JobCodesPage, EmployeesPage, ProjectsPage, DemandsPage, AssignmentsPage } from './components/WorkforcePages';
import { AccountSettingsPage, InboxPage, UsersPage, AuditPage, RuntimePage, DbManagementPage } from './components/AdminPages';
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

  if (page === 'orgs') return <AppShell {...shellProps}><OrganizationsPage {...authenticatedProps} /></AppShell>;
  if (page === 'jobCodes') return <AppShell {...shellProps}><JobCodesPage {...authenticatedProps} /></AppShell>;
  if (page === 'employees') return <AppShell {...shellProps}><EmployeesPage {...authenticatedProps} /></AppShell>;
  if (page === 'projects') return <AppShell {...shellProps}><ProjectsPage {...authenticatedProps} /></AppShell>;
  if (page === 'demands') return <AppShell {...shellProps}><DemandsPage {...authenticatedProps} /></AppShell>;
  if (page === 'assignments') return <AppShell {...shellProps}><AssignmentsPage {...authenticatedProps} /></AppShell>;
  if (page === 'accountSettings') return <AppShell {...shellProps}><AccountSettingsPage {...authenticatedProps} /></AppShell>;
  if (page === 'inbox') return <AppShell {...shellProps}><InboxPage {...authenticatedProps} /></AppShell>;
  if (page === 'users') return <AppShell {...shellProps}><UsersPage {...authenticatedProps} /></AppShell>;
  if (page === 'audit') return <AppShell {...shellProps}><AuditPage {...authenticatedProps} /></AppShell>;
  if (page === 'runtime') return <AppShell {...shellProps}><RuntimePage {...authenticatedProps} /></AppShell>;
  if (page === 'dbManagement') return <AppShell {...shellProps}><DbManagementPage {...authenticatedProps} /></AppShell>;

  if (page === 'getStarted') return <AppShell {...shellProps}><GetStartedPage /></AppShell>;
  if (page === 'roadmap') return <AppShell {...shellProps}><RoadmapPage /></AppShell>;

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
