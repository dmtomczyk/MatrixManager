import * as React from 'react';
import ReactDOM from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import LoginPage from './components/LoginPage';
import GetStartedPage from './components/GetStartedPage';
import CanvasPage from './components/CanvasPage';
import { readBootPayload, type LoginPageProps } from './lib/utils';
import './styles.css';

const { page, props } = readBootPayload();

function App() {
  if (page === 'login') return <LoginPage {...(props as LoginPageProps)} />;
  if (page === 'canvas') {
    return (
      <ReactFlowProvider>
        <CanvasPage />
      </ReactFlowProvider>
    );
  }
  return <GetStartedPage />;
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
