import React from 'react';
import ReactDOM from 'react-dom/client';
import LoginPage from './components/LoginPage';
import GetStartedPage from './components/GetStartedPage';
import { readBootPayload } from './lib/utils';
import './styles.css';

const { page, props } = readBootPayload();

const App = () => {
  if (page === 'login') return <LoginPage {...props} />;
  return <GetStartedPage {...props} />;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
