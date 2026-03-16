import React from 'react';
import ReactDOM from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import LoginPage from './components/LoginPage';
import GetStartedPage from './components/GetStartedPage';
import CanvasPage from './components/CanvasPage';
import { readBootPayload } from './lib/utils';
import './styles.css';

const { page, props } = readBootPayload();

const App = () => {
  if (page === 'login') return <LoginPage {...props} />;
  if (page === 'canvas') {
    return (
      <ReactFlowProvider>
        <CanvasPage {...props} />
      </ReactFlowProvider>
    );
  }
  return <GetStartedPage {...props} />;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
