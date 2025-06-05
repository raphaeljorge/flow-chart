import './editor/styles/main.css';
import './editor/styles/theme-variables.css';
import '@phosphor-icons/web/regular';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);