import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { HASH_ROUTER } from './lib/supabase';
import App from './App';
import { I18nProvider } from './lib/i18n';
import { ToastProvider } from './components/ui';
import './index.css';

// Email links come back as /?go=/route&code=... — move the route into the hash
const go = new URLSearchParams(window.location.search).get('go');
if (HASH_ROUTER && go && go.startsWith('/') && !window.location.hash) window.location.hash = go;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <ToastProvider>
        {HASH_ROUTER ? <HashRouter><App /></HashRouter> : <BrowserRouter><App /></BrowserRouter>}
      </ToastProvider>
    </I18nProvider>
  </React.StrictMode>,
);
