import React from 'react';
import ReactDOM from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import CanvasApp from './CanvasApp';
import './canvas-react.css';
import '@xyflow/react/dist/style.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ReactFlowProvider>
      <CanvasApp />
    </ReactFlowProvider>
  </React.StrictMode>
);
