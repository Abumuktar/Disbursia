import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { initStore } from './lib/store';
import { seedState } from './lib/seed';
import { resumeInFlight } from './lib/actions';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <div className="flex h-screen items-center justify-center bg-brand-900 text-sm font-medium text-brand-100">Loading Disbursia…</div>,
);

initStore(seedState).then(() => {
  resumeInFlight();
  root.render(<React.StrictMode><App /></React.StrictMode>);
});
