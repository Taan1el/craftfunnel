import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/red-hat-display';
import '@fontsource-variable/red-hat-text';
import '@fontsource-variable/azeret-mono';
import './styles/tokens.css';
import { WorkspaceApp } from './local/WorkspaceApp';
import { registerOffline } from './local/offline';
import './App.css';

registerOffline();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WorkspaceApp />
  </React.StrictMode>
);
