import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { applyLanguage } from './i18n/english/language';
import { registerOutagePage } from './features/system/registerOutagePage';
import { pruneDrafts } from './lib/drafts';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

// Temporary English for the team (see i18n/english).
applyLanguage(document.body);
// Drafts older than a week are dropped (request 11/2).
pruneDrafts();
registerOutagePage();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
