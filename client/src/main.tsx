import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/red-hat-display';
import '@fontsource-variable/red-hat-text';
import '@fontsource-variable/azeret-mono';
import './styles/tokens.css';
import { App } from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
