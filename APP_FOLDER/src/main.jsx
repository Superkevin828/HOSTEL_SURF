import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { DialogProvider } from './context/DialogContext';
import { ToastProvider } from './context/ToastContext';
import './styles/main.css';
import './styles/dash.css';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <ToastProvider>
        <DialogProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </DialogProvider>
      </ToastProvider>
    </HashRouter>
  </React.StrictMode>
);
